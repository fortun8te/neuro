/**
 * Overnight Research Monitor Component
 *
 * Real-time dashboard for monitoring long-running overnight research cycles
 * Displays progress, performance metrics, service health, and controls
 *
 * Features:
 * - Live progress display (iterations, sources, tokens)
 * - Elapsed time and estimated completion
 * - Memory usage graph
 * - Service health status
 * - Checkpoint tracking
 * - Image download progress
 * - Pause/Resume/Stop controls
 * - Auto-refresh every 5 seconds
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { OvernightSessionState } from '../config/overtimeResearchConfig';
import { OVERNIGHT_CONSTANTS, OvernightUtils } from '../config/overtimeResearchConfig';
import { INFRASTRUCTURE } from '../config/infrastructure';

interface OvernightResearchMonitorProps {
  sessionId?: string;
  isVisible?: boolean;
  refreshIntervalMs?: number;
}

interface ServiceHealth {
  name: string;
  healthy: boolean;
  lastCheck: number;
  status: string;
}

export const OvernightResearchMonitor: React.FC<OvernightResearchMonitorProps> = ({
  sessionId,
  isVisible = true,
  refreshIntervalMs = 5000,
}) => {
  const [sessionState, setSessionState] = useState<OvernightSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([
    { name: 'Ollama', healthy: false, lastCheck: 0, status: 'unknown' },
    { name: 'Wayfarer', healthy: false, lastCheck: 0, status: 'unknown' },
    { name: 'SearXNG', healthy: false, lastCheck: 0, status: 'unknown' },
  ]);

  // Fetch session state from IndexedDB or API
  const fetchSessionState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In production, this would fetch from IndexedDB or API
      // For now, we'll provide a placeholder that can be integrated with actual data
      if (sessionId && typeof window !== 'undefined' && 'indexedDB' in window) {
        // This would be the actual implementation
        // const db = await getDB();
        // const state = await db.get(OVERNIGHT_CONSTANTS.STATE_KEY_PREFIX + sessionId);
        // setSessionState(state);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session state');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Check service health
  const checkServiceHealth = useCallback(async () => {
    const checks: Promise<ServiceHealth>[] = [
      (async () => {
        try {
          const response = await fetch(`${INFRASTRUCTURE.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
          return {
            name: 'Ollama',
            healthy: response.ok,
            lastCheck: Date.now(),
            status: response.ok ? 'Healthy' : 'Unhealthy',
          };
        } catch {
          return { name: 'Ollama', healthy: false, lastCheck: Date.now(), status: 'Unreachable' };
        }
      })(),
      (async () => {
        try {
          const response = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/health`, { signal: AbortSignal.timeout(3000) });
          return {
            name: 'Wayfarer',
            healthy: response.ok,
            lastCheck: Date.now(),
            status: response.ok ? 'Healthy' : 'Unhealthy',
          };
        } catch {
          return { name: 'Wayfarer', healthy: false, lastCheck: Date.now(), status: 'Unreachable' };
        }
      })(),
      (async () => {
        try {
          const response = await fetch(`${INFRASTRUCTURE.searxngUrl}/healthz`, { signal: AbortSignal.timeout(3000) });
          return {
            name: 'SearXNG',
            healthy: response.ok,
            lastCheck: Date.now(),
            status: response.ok ? 'Healthy' : 'Unhealthy',
          };
        } catch {
          return { name: 'SearXNG', healthy: false, lastCheck: Date.now(), status: 'Unreachable' };
        }
      })(),
    ];

    const results = await Promise.all(checks);
    setServiceHealth(results);
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    if (!isVisible) return;

    fetchSessionState();
    checkServiceHealth();

    const interval = setInterval(() => {
      fetchSessionState();
      checkServiceHealth();
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [isVisible, refreshIntervalMs, fetchSessionState, checkServiceHealth]);

  if (!isVisible) return null;

  if (loading && !sessionState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session state...</p>
        </div>
      </div>
    );
  }

  if (error && !sessionState) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error Loading Session</p>
        <p className="text-red-700 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!sessionState) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 font-semibold">No Active Session</p>
        <p className="text-yellow-700 text-sm mt-1">Start an overnight research session to begin monitoring</p>
      </div>
    );
  }

  const elapsedMs = Date.now() - sessionState.config.startTime;
  const elapsedTime = OvernightUtils.formatElapsedTime(elapsedMs);
  const estimatedRemainingMs = OvernightUtils.estimateTimeRemaining(sessionState);
  const estimatedRemainingTime = OvernightUtils.formatElapsedTime(estimatedRemainingMs);
  const progressPercent = Math.min(
    100,
    (sessionState.research.iterationsCompleted / sessionState.config.researchLimits.maxIterations) * 100
  );

  const memoryPercent = Math.min(100, (sessionState.resources.memoryUsageMb / sessionState.config.resources.memoryLimitMb) * 100);
  const sourcesPerHour = (sessionState.research.sourcesFound / (elapsedMs / 3600000)) || 0;
  const tokensPerSecond = (sessionState.research.tokensUsed / (elapsedMs / 1000)) || 0;

  const allServicesHealthy = serviceHealth.every((s) => s.healthy);

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Overnight Research Monitor</h2>
          <p className="text-sm text-slate-600 mt-1">Session: {sessionState.config.sessionId}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-600 font-mono">
            {new Date(sessionState.config.startTime).toLocaleString()}
          </div>
          <div className={`text-sm font-semibold mt-1 ${sessionState.status === 'running' ? 'text-green-600' : 'text-yellow-600'}`}>
            {sessionState.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Campaign and Research Topic */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Campaign Brief</label>
          <p className="text-slate-900 font-medium mt-1">{sessionState.config.campaignBrief}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Research Topic</label>
          <p className="text-slate-900 font-medium mt-1">{sessionState.config.researchTopic}</p>
        </div>
      </div>

      {/* Main Progress Section */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Research Progress</h3>

        <div className="space-y-4">
          {/* Iteration Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Iterations</label>
              <span className="text-sm font-mono text-slate-600">
                {sessionState.research.iterationsCompleted} / {sessionState.config.researchLimits.maxIterations}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 mt-1">{progressPercent.toFixed(1)}% complete</p>
          </div>

          {/* Time Tracking */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded p-3 border border-blue-200">
              <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Elapsed Time</label>
              <p className="text-lg font-mono font-bold text-blue-900 mt-1">{elapsedTime}</p>
            </div>
            <div className="bg-purple-50 rounded p-3 border border-purple-200">
              <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Est. Remaining</label>
              <p className="text-lg font-mono font-bold text-purple-900 mt-1">{estimatedRemainingTime}</p>
            </div>
            <div className="bg-green-50 rounded p-3 border border-green-200">
              <label className="text-xs font-semibold text-green-600 uppercase tracking-wide">Current Stage</label>
              <p className="text-lg font-mono font-bold text-green-900 mt-1">{sessionState.currentStage}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Research Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Data Collection</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Sources Found</span>
              <span className="text-lg font-mono font-bold text-slate-900">
                {OvernightUtils.formatNumber(sessionState.research.sourcesFound)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Sources/Hour</span>
              <span className="text-lg font-mono font-bold text-slate-900">{sourcesPerHour.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Images Downloaded</span>
              <span className="text-lg font-mono font-bold text-slate-900">{sessionState.images.downloaded}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Token Usage</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Tokens Used</span>
              <span className="text-lg font-mono font-bold text-slate-900">
                {OvernightUtils.formatNumber(sessionState.research.tokensUsed)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Tokens/Second</span>
              <span className="text-lg font-mono font-bold text-slate-900">{tokensPerSecond.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Avg Iter. Time</span>
              <span className="text-lg font-mono font-bold text-slate-900">
                {sessionState.research.averageIterationTimeMs.toFixed(0)}ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Memory and Resources */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Resources</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Memory Usage</label>
              <span className="text-sm font-mono text-slate-600">
                {sessionState.resources.memoryUsageMb} / {sessionState.config.resources.memoryLimitMb} MB
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  memoryPercent > 80 ? 'bg-red-600' : memoryPercent > 50 ? 'bg-yellow-600' : 'bg-green-600'
                }`}
                style={{ width: `${memoryPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">CPU Usage</span>
            <span className="text-sm font-mono text-slate-900">{sessionState.resources.cpuPercentUsed.toFixed(1)}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Requests In Flight</span>
            <span className="text-sm font-mono text-slate-900">{sessionState.resources.requestsInFlight}</span>
          </div>
        </div>
      </div>

      {/* Service Health */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">
          Service Health
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ml-2 text-xs font-bold ${
            allServicesHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {allServicesHealthy ? '✓' : '✗'}
          </span>
        </h3>

        <div className="space-y-2">
          {serviceHealth.map((service) => (
            <div key={service.name} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${service.healthy ? 'bg-green-600' : 'bg-red-600'}`}></div>
                <span className="text-sm font-medium text-slate-700">{service.name}</span>
              </div>
              <span className={`text-xs font-mono ${service.healthy ? 'text-green-700' : 'text-red-700'}`}>
                {service.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Checkpointing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Checkpoints</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Created</span>
              <span className="text-lg font-mono font-bold text-slate-900">{sessionState.checkpoints.totalCheckpoints}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Last Checkpoint</span>
              <span className="text-sm font-mono text-slate-900">
                {sessionState.checkpoints.lastCheckpointTime === 0
                  ? 'N/A'
                  : OvernightUtils.formatElapsedTime(Date.now() - sessionState.checkpoints.lastCheckpointTime) + ' ago'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Recovery</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Retry Count</span>
              <span className="text-lg font-mono font-bold text-slate-900">{sessionState.recovery.retryCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Checkpoint Failures</span>
              <span className={`text-lg font-mono font-bold ${
                sessionState.checkpoints.checkpointFailures > 0 ? 'text-orange-700' : 'text-slate-900'
              }`}>
                {sessionState.checkpoints.checkpointFailures}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            isPaused
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
          }`}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={() => {
            if (window.confirm('Are you sure? This will stop the research cycle.')) {
              // Handle stop action
            }
          }}
          className="px-6 py-2 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          Stop
        </button>

        <button
          onClick={() => {
            fetchSessionState();
            checkServiceHealth();
          }}
          className="px-6 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-xs text-slate-500 text-center">
        Auto-refreshing every {refreshIntervalMs / 1000}s
      </div>
    </div>
  );
};

export default OvernightResearchMonitor;
