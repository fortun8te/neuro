/**
 * useSystemHealth — Real-time system monitoring hook
 *
 * - Polls Ollama /api/tags every 5s (pauses when tab hidden)
 * - Polls Ollama /api/ps every 5s for running model VRAM
 * - Subscribes to loadMonitor for live task counts
 * - Calculates RPM + error rate from last 60s of TaskEvents
 * - Returns SystemHealth + TaskEvent[] + RPM sparkline points
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMonitor } from '../services/loadMonitor';
import { CONCURRENCY_LIMITS } from '../config/modelRouting';
import { INFRASTRUCTURE } from '../config/infrastructure';
import type { SystemHealth, ModelStatus, TaskEvent, RpmPoint } from '../types/monitoring';

// VRAM estimates per model name (MB)
const VRAM_MB_MAP: Record<string, number> = {
  'qwen3.5:0.8b': 530,
  'qwen3.5:2b': 1500,
  'qwen3.5:4b': 2800,
  'qwen3.5:9b': 6600,
  'qwen3.5:27b': 18000,
  'gpt-oss-20b': 13000,
  'gemma4:e31b': 31000,
  'NEURO-1-B2-4B': 4000,
  'allenporter/xlam:1b': 1000,
  'chromadb-context-1:latest': 2000,
  'nemotron-3-super:120b': 120000,
};

const TOTAL_VRAM_MB = 40 * 1024; // 40GB
const POLL_INTERVAL_MS = 5000;
const TASK_HISTORY_WINDOW_MS = 60_000; // 1 minute
const RPM_BUCKET_COUNT = 60; // one per second for 60s sparkline

function getVramEstimate(modelName: string): number {
  // Direct match
  if (VRAM_MB_MAP[modelName]) return VRAM_MB_MAP[modelName];
  // Partial match
  for (const [key, mb] of Object.entries(VRAM_MB_MAP)) {
    if (modelName.includes(key) || key.includes(modelName.split(':')[0])) return mb;
  }
  return 2000; // default 2GB
}

function deriveModelStatus(
  modelName: string,
  activeTasks: number,
  maxConcurrent: number,
  isKnown: boolean
): ModelStatus['status'] {
  if (!isKnown) return 'offline';
  if (activeTasks === 0) return 'idle';
  if (activeTasks >= maxConcurrent) return 'overloaded';
  return 'busy';
}

let _taskIdCounter = 0;
function makeTaskId(): string {
  return `t_${Date.now()}_${++_taskIdCounter}`;
}

export interface SystemHealthResult {
  health: SystemHealth;
  tasks: TaskEvent[];
  rpmPoints: RpmPoint[];
  isLoading: boolean;
  lastUpdated: number | null;
}

export function useSystemHealth(): SystemHealthResult {
  const startTime = useRef(Date.now());
  const [health, setHealth] = useState<SystemHealth>(() => buildEmptyHealth());
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [rpmPoints, setRpmPoints] = useState<RpmPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Rolling history for RPM + error rate calculation
  const taskHistoryRef = useRef<TaskEvent[]>([]);
  // Known models from /api/tags
  const knownModelsRef = useRef<Set<string>>(new Set());

  // ── Fetch Ollama model list + ps for VRAM ────────────────────
  const fetchOllama = useCallback(async (): Promise<{
    knownModels: Set<string>;
    vramByModel: Record<string, number>;
  }> => {
    const baseUrl = INFRASTRUCTURE.ollamaUrl;
    try {
      const [tagsRes, psRes] = await Promise.all([
        fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) }).catch(() => null),
        fetch(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(4000) }).catch(() => null),
      ]);

      const knownModels = new Set<string>();
      if (tagsRes?.ok) {
        const data = await tagsRes.json() as { models?: Array<{ name: string }> };
        (data.models || []).forEach(m => knownModels.add(m.name));
      }

      const vramByModel: Record<string, number> = {};
      if (psRes?.ok) {
        const data = await psRes.json() as { models?: Array<{ name: string; size_vram: number }> };
        (data.models || []).forEach(m => {
          vramByModel[m.name] = Math.round(m.size_vram / (1024 * 1024)); // bytes -> MB
        });
      }

      return { knownModels, vramByModel };
    } catch {
      return { knownModels: new Set(), vramByModel: {} };
    }
  }, []);

  // ── Build SystemHealth snapshot ──────────────────────────────
  const buildSnapshot = useCallback(async () => {
    const { knownModels, vramByModel } = await fetchOllama();
    knownModelsRef.current = knownModels;

    const lmStatus = loadMonitor.getStatus();
    const now = Date.now();
    const windowStart = now - TASK_HISTORY_WINDOW_MS;

    // Prune old history
    taskHistoryRef.current = taskHistoryRef.current.filter(t => t.startTime > windowStart);
    const recentTasks = taskHistoryRef.current;

    // RPM — count completed/failed tasks in last 60s
    const completedInWindow = recentTasks.filter(t => t.status !== 'running').length;
    const requestsPerMinute = Math.round(completedInWindow * (60000 / TASK_HISTORY_WINDOW_MS));

    // Error rate
    const failedInWindow = recentTasks.filter(t => t.status === 'failed').length;
    const errorRate = recentTasks.length > 0 ? failedInWindow / recentTasks.length : 0;

    // Per-model response times (last 10 completed)
    const responseTimes: Record<string, number[]> = {};
    recentTasks
      .filter(t => t.status === 'completed' && t.durationMs !== undefined)
      .forEach(t => {
        if (!responseTimes[t.modelName]) responseTimes[t.modelName] = [];
        responseTimes[t.modelName].push(t.durationMs!);
      });

    // Error counts per model
    const errorCounts: Record<string, number> = {};
    recentTasks
      .filter(t => t.status === 'failed')
      .forEach(t => {
        errorCounts[t.modelName] = (errorCounts[t.modelName] || 0) + 1;
      });

    const configuredModels = Object.keys(CONCURRENCY_LIMITS.perModel);
    // Also add models seen from Ollama that aren't in our config
    const allModelNames = Array.from(new Set([
      ...configuredModels,
      ...Array.from(knownModels),
    ]));

    const models: ModelStatus[] = allModelNames.map(modelName => {
      const perModelStat = lmStatus.global.perModel.find(m => m.model === modelName);
      const activeTasks = perModelStat?.activeTasks ?? 0;
      const maxConcurrent = CONCURRENCY_LIMITS.perModel[modelName] ?? 1;
      const isKnown = knownModels.has(modelName) || (perModelStat?.activeTasks ?? 0) > 0;
      const vram = vramByModel[modelName] ?? getVramEstimate(modelName);

      const times = responseTimes[modelName] || [];
      const avgResponseTime = times.length > 0
        ? Math.round(times.slice(-10).reduce((s, v) => s + v, 0) / Math.min(times.length, 10))
        : 0;

      const errCount = errorCounts[modelName] || 0;
      // Simple circuit breaker simulation: open if 5+ errors in window
      const circuitState: ModelStatus['circuitState'] = errCount >= 5 ? 'open' : errCount >= 2 ? 'half-open' : 'closed';

      return {
        modelName,
        activeTasks,
        maxConcurrent,
        avgResponseTime,
        successRate: recentTasks.length > 0
          ? 1 - (recentTasks.filter(t => t.modelName === modelName && t.status === 'failed').length /
              Math.max(1, recentTasks.filter(t => t.modelName === modelName).length))
          : 1,
        vramEstimate: vram,
        status: deriveModelStatus(modelName, activeTasks, maxConcurrent, isKnown),
        circuitState,
        errorCount: errCount,
        lastErrorTime: recentTasks
          .filter(t => t.modelName === modelName && t.status === 'failed')
          .sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0))[0]?.endTime ?? null,
        recoveryCountdownMs: circuitState === 'open' ? 30000 : null,
      };
    });

    // VRAM: sum of estimates for active models
    const totalVramUsedMB = models.reduce((sum, m) => {
      if (m.activeTasks > 0) return sum + m.vramEstimate;
      // Also count models loaded in Ollama ps
      if (vramByModel[m.modelName]) return sum + (vramByModel[m.modelName] || 0);
      return sum;
    }, 0);

    const globalActiveTasks = lmStatus.global.activeTasks;
    const overallStatus: SystemHealth['overallStatus'] =
      globalActiveTasks >= CONCURRENCY_LIMITS.globalMax ? 'critical'
      : errorRate > 0.2 ? 'degraded'
      : 'healthy';

    const newHealth: SystemHealth = {
      models,
      globalActiveTasks,
      globalMaxTasks: CONCURRENCY_LIMITS.globalMax,
      totalVramUsedMB: Math.min(totalVramUsedMB, TOTAL_VRAM_MB),
      totalVramAvailableMB: TOTAL_VRAM_MB,
      uptimeMs: now - startTime.current,
      requestsPerMinute,
      errorRate,
      overallStatus,
    };

    // Build RPM sparkline — 60 buckets (1 per second)
    const buckets: RpmPoint[] = [];
    for (let i = RPM_BUCKET_COUNT - 1; i >= 0; i--) {
      const bucketTs = now - i * 1000;
      const count = recentTasks.filter(t => {
        const endT = t.endTime ?? t.startTime;
        return endT >= bucketTs - 500 && endT < bucketTs + 500;
      }).length;
      buckets.push({ ts: bucketTs, count });
    }

    setHealth(newHealth);
    setRpmPoints(buckets);
    setLastUpdated(now);
    setIsLoading(false);
  }, [fetchOllama]);

  // ── Poll on interval, pause when hidden ─────────────────────
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isVisible = !document.hidden;

    buildSnapshot();

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        buildSnapshot();
        // Also sync running tasks to state
        setTasks([...taskHistoryRef.current]);
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) { buildSnapshot(); startPolling(); }
      else stopPolling();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [buildSnapshot]);

  // ── Simulate task tracking via loadMonitor polling ───────────
  // Since loadMonitor doesn't have an event emitter we can subscribe to from React,
  // we poll its status every 1s and diff to detect new/completed tasks
  const prevStatusRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const taskMap = new Map<string, TaskEvent>(); // synthetic task tracking

    const tick = () => {
      const status = loadMonitor.getStatus();
      const now = Date.now();

      status.global.perModel.forEach(({ model, activeTasks }) => {
        const prev = prevStatusRef.current[model] ?? 0;
        if (activeTasks > prev) {
          // New tasks started
          for (let i = 0; i < activeTasks - prev; i++) {
            const id = makeTaskId();
            const ev: TaskEvent = {
              id,
              modelName: model,
              stage: 'inference',
              startTime: now,
              status: 'running',
            };
            taskMap.set(id, ev);
            taskHistoryRef.current.push(ev);
          }
        } else if (activeTasks < prev) {
          // Tasks completed
          const runningForModel = Array.from(taskMap.values())
            .filter(t => t.modelName === model && t.status === 'running');
          const toComplete = Math.min(runningForModel.length, prev - activeTasks);
          for (let i = 0; i < toComplete; i++) {
            const ev = runningForModel[i];
            ev.status = 'completed';
            ev.endTime = now;
            ev.durationMs = now - ev.startTime;
          }
        }
        prevStatusRef.current[model] = activeTasks;
      });

      setTasks([...taskHistoryRef.current.slice(-200)]);
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { health, tasks, rpmPoints, isLoading, lastUpdated };
}

function buildEmptyHealth(): SystemHealth {
  return {
    models: [],
    globalActiveTasks: 0,
    globalMaxTasks: CONCURRENCY_LIMITS.globalMax,
    totalVramUsedMB: 0,
    totalVramAvailableMB: 40 * 1024,
    uptimeMs: 0,
    requestsPerMinute: 0,
    errorRate: 0,
    overallStatus: 'healthy',
  };
}
