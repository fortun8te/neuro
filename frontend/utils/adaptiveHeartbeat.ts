/**
 * Adaptive Heartbeat System
 * Monitors service health and launches diagnostic agents when issues are detected.
 * Adjusts polling frequency based on system state and running tasks.
 */

import { healthMonitor, type ServiceHealth } from './healthMonitor';
import { taskQueue } from './taskQueue';

export type TaskType = 'research' | 'analysis' | 'code-execution' | 'web-scraping' | 'default';

export interface HeartbeatConfig {
  taskType: TaskType;
  basePollIntervalMs: number;
  minPollIntervalMs: number;
  maxPollIntervalMs: number;
  unhealthyThreshold: number; // launch diagnostic if > N services unhealthy
  degradedThreshold: number;  // adjust polling if > N services degraded
}

const TASK_CONFIGS: Record<TaskType, HeartbeatConfig> = {
  'research': {
    taskType: 'research',
    basePollIntervalMs: 45_000,   // 45s — web search is critical
    minPollIntervalMs: 15_000,    // 15s — check frequently when searching
    maxPollIntervalMs: 90_000,    // 90s — but don't overload
    unhealthyThreshold: 2,
    degradedThreshold: 1,
  },
  'web-scraping': {
    taskType: 'web-scraping',
    basePollIntervalMs: 30_000,   // 30s — Wayfayer is critical
    minPollIntervalMs: 10_000,    // 10s — tight monitoring
    maxPollIntervalMs: 60_000,
    unhealthyThreshold: 1,
    degradedThreshold: 1,
  },
  'code-execution': {
    taskType: 'code-execution',
    basePollIntervalMs: 60_000,   // 60s — Ollama is critical
    minPollIntervalMs: 30_000,    // 30s — but don't overcheck
    maxPollIntervalMs: 120_000,   // 2 min max
    unhealthyThreshold: 1,
    degradedThreshold: 2,
  },
  'analysis': {
    taskType: 'analysis',
    basePollIntervalMs: 90_000,   // 90s — less critical, can tolerate brief outages
    minPollIntervalMs: 45_000,
    maxPollIntervalMs: 180_000,   // 3 min max
    unhealthyThreshold: 3,
    degradedThreshold: 2,
  },
  'default': {
    taskType: 'default',
    basePollIntervalMs: 30_000,
    minPollIntervalMs: 15_000,
    maxPollIntervalMs: 90_000,
    unhealthyThreshold: 2,
    degradedThreshold: 1,
  },
};

class AdaptiveHeartbeat {
  private config: HeartbeatConfig = TASK_CONFIGS.default;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHealthSnapshot: Record<string, ServiceHealth> = {};
  private consecutiveUnhealthyChecks = 0;
  private diagnosticAgentRunning = false;

  constructor() {
    healthMonitor.onStatusChange(this.onServiceStatusChange.bind(this));
  }

  /**
   * Start heartbeat for a specific task type
   */
  start(taskType: TaskType = 'default') {
    this.config = TASK_CONFIGS[taskType] || TASK_CONFIGS.default;
    console.log(`[Heartbeat] Starting for task: ${taskType}, interval: ${this.config.basePollIntervalMs}ms`);

    if (this.intervalId) clearInterval(this.intervalId);

    const check = async () => {
      await this.performHealthCheck();
      this.adjustPollingFrequency();
    };

    // Run immediately
    check();

    // Then set interval
    this.intervalId = setInterval(check, this.config.basePollIntervalMs);
  }

  /**
   * Stop heartbeat
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Perform health check and launch diagnostics if needed
   */
  private async performHealthCheck() {
    const services = ['ollama', 'searxng', 'wayfayer'];
    const unhealthy = [];
    const degraded = [];

    for (const service of services) {
      try {
        const health = await healthMonitor.checkService(service);
        this.lastHealthSnapshot[service] = health;

        if (health.status === 'down' || health.status === 'unknown') {
          unhealthy.push(service);
        } else if (health.status === 'degraded') {
          degraded.push(service);
        }
      } catch (err) {
        unhealthy.push(service);
      }
    }

    // Track consecutive unhealthy checks
    if (unhealthy.length > 0) {
      this.consecutiveUnhealthyChecks++;
    } else {
      this.consecutiveUnhealthyChecks = 0;
    }

    // Launch diagnostic agent if too many services unhealthy
    if (
      unhealthy.length >= this.config.unhealthyThreshold &&
      !this.diagnosticAgentRunning
    ) {
      this.launchDiagnosticAgent(unhealthy, degraded);
    }

    // Log status
    if (unhealthy.length > 0 || degraded.length > 0) {
      console.warn(`[Heartbeat] Issues detected:`, {
        unhealthy,
        degraded,
        consecutiveChecks: this.consecutiveUnhealthyChecks,
      });
    }
  }

  /**
   * Launch a diagnostic agent to troubleshoot issues
   */
  private async launchDiagnosticAgent(unhealthy: string[], degraded: string[]) {
    if (this.diagnosticAgentRunning) return;

    this.diagnosticAgentRunning = true;
    console.log(`[Heartbeat] Launching diagnostic agent for: ${unhealthy.join(', ')}`);

    const diagnosticTask = {
      id: `diag-${Date.now()}`,
      name: 'Health Diagnostic',
      description: `Diagnose unhealthy services: ${unhealthy.join(', ')}`,
      priority: 'high' as const,
      maxRetries: 1,
      execute: async () => {
        // Diagnostic checks
        const results: Record<string, any> = {};

        for (const service of unhealthy) {
          try {
            const probe = this.buildProbe(service);
            const start = performance.now();
            const resp = await fetch(probe.url, {
              method: probe.method || 'GET',
              signal: AbortSignal.timeout(5000),
            });
            const latency = performance.now() - start;

            results[service] = {
              status: resp.status,
              statusText: resp.statusText,
              latencyMs: Math.round(latency),
              headers: {
                contentType: resp.headers.get('content-type'),
                cacheControl: resp.headers.get('cache-control'),
              },
            };

            if (resp.ok) {
              console.log(`[Diagnostic] ${service} recovered!`);
            }
          } catch (err) {
            results[service] = {
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }

        return {
          timestamp: Date.now(),
          checkedServices: unhealthy,
          results,
          recommendation: this.generateRecommendation(results),
        };
      },
    };

    // Add to queue
    taskQueue.add(diagnosticTask);

    // Listen for completion
    const unsubscribe = taskQueue.on((task, event) => {
      if (task.id === diagnosticTask.id && (event === 'completed' || event === 'failed')) {
        this.diagnosticAgentRunning = false;
        unsubscribe();
        console.log(`[Heartbeat] Diagnostic complete:`, task.result || task.error);
      }
    });
  }

  /**
   * Adjust polling frequency based on system health
   */
  private adjustPollingFrequency() {
    const unhealthy = Object.values(this.lastHealthSnapshot).filter((h) => h.status === 'down').length;
    const degraded = Object.values(this.lastHealthSnapshot).filter((h) => h.status === 'degraded').length;

    let newInterval = this.config.basePollIntervalMs;

    if (unhealthy >= this.config.unhealthyThreshold) {
      // System is down — check more frequently
      newInterval = this.config.minPollIntervalMs;
    } else if (degraded >= this.config.degradedThreshold) {
      // System is degraded — check more frequently
      newInterval = Math.max(this.config.minPollIntervalMs, this.config.basePollIntervalMs * 0.6);
    } else if (unhealthy === 0 && degraded === 0) {
      // System is healthy — relax polling
      newInterval = Math.min(this.config.maxPollIntervalMs, this.config.basePollIntervalMs * 1.2);
    }

    if (newInterval !== this.config.basePollIntervalMs) {
      console.log(`[Heartbeat] Adjusted interval: ${this.config.basePollIntervalMs}ms → ${Math.round(newInterval)}ms`);
      this.stop();
      this.config.basePollIntervalMs = newInterval;
      this.start(this.config.taskType);
    }
  }

  /**
   * Handle status changes from health monitor
   */
  private onServiceStatusChange(name: string, oldStatus: string, newStatus: string) {
    if (oldStatus !== newStatus) {
      console.log(`[Heartbeat] Service status changed: ${name} ${oldStatus} → ${newStatus}`);
    }
  }

  /**
   * Build probe URL for a service
   */
  private buildProbe(service: string): { url: string; method?: string } {
    const probes: Record<string, { url: string; method?: string }> = {
      ollama: {
        url: 'http://100.74.135.83:11440/api/tags',
        method: 'GET',
      },
      searxng: {
        url: 'http://localhost:8888/healthz',
        method: 'GET',
      },
      wayfayer: {
        url: 'http://localhost:8889/health',
        method: 'GET',
      },
    };
    return probes[service] || { url: 'http://localhost:3000/health' };
  }

  /**
   * Generate recommendation based on diagnostic results
   */
  private generateRecommendation(results: Record<string, any>): string {
    const failures = Object.entries(results).filter(([_, r]) => r.error);
    if (failures.length === 0) {
      return 'All services recovered. System is healthy.';
    }

    const failedServices = failures.map(([s]) => s).join(', ');
    if (failures.length === 1 && failures[0][0] === 'ollama') {
      return 'Ollama is down. Restart: docker restart ollama-container or check port 11440.';
    }
    if (failures.length === 1 && failures[0][0] === 'searxng') {
      return 'SearXNG is down. Restart: docker-compose up -d searxng.';
    }

    return `Services down: ${failedServices}. Check Docker containers and logs.`;
  }
}

export const adaptiveHeartbeat = new AdaptiveHeartbeat();
