/**
 * Heartbeat Monitor — Advanced health checking with persistence & alerts
 * Extends healthMonitor with archival, thresholds, and recovery actions
 */

import { healthMonitor, type HealthSnapshot, type ServiceStatus } from './healthMonitor';
import type { Scheduler } from './scheduler';
import { set, get, del } from 'idb-keyval';

const HEARTBEAT_LOG_KEY = 'heartbeat_logs';
const HEARTBEAT_ALERTS_KEY = 'heartbeat_alerts';
const HEARTBEAT_CONFIG_KEY = 'heartbeat_config';

export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertAction = 'notify' | 'auto-recover' | 'escalate';

export interface HeartbeatAlert {
  id: string;
  timestamp: number;
  service: string;
  level: AlertLevel;
  message: string;
  previousStatus?: ServiceStatus;
  newStatus?: ServiceStatus;
  action?: AlertAction;
  resolved: boolean;
}

export interface HeartbeatLog {
  timestamp: number;
  snapshot: HealthSnapshot;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  alertsTriggered: string[];
}

export interface HeartbeatConfig {
  checkIntervalMs: number;
  degradedThreshold: number;
  downThreshold: number;
  autoRecoveryEnabled: boolean;
  alertLevelConfig: Record<string, AlertLevel>;
  archiveRetentionDays: number;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  checkIntervalMs: 30000, // 30 seconds
  degradedThreshold: 2, // consecutive failures
  downThreshold: 4,
  autoRecoveryEnabled: true,
  alertLevelConfig: {
    ollama: 'critical',
    wayfarer: 'critical',
    searxng: 'warning',
  },
  archiveRetentionDays: 30,
};

class HeartbeatMonitor {
  private logs: HeartbeatLog[] = [];
  private alerts: Map<string, HeartbeatAlert> = new Map();
  private config: HeartbeatConfig = DEFAULT_CONFIG;
  private lastSnapshot: HealthSnapshot | null = null;
  private statusChangeListeners: Set<(alert: HeartbeatAlert) => void> = new Set();
  private recoveryAttempts: Map<string, number> = new Map();
  private scheduler: Scheduler | null = null;

  constructor() {
    this.loadConfig();
    this.setupStatusChangeListener();
  }

  private loadConfig(): void {
    // Load config from session storage (can be modified by settings UI)
    const stored = sessionStorage.getItem('heartbeat_config');
    if (stored) {
      try {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      } catch {
        this.config = DEFAULT_CONFIG;
      }
    }
  }

  setScheduler(scheduler: Scheduler): void {
    this.scheduler = scheduler;
  }

  private setupStatusChangeListener(): void {
    healthMonitor.onStatusChange((name, oldStatus, newStatus) => {
      if (oldStatus !== newStatus) {
        this.handleStatusChange(name, oldStatus, newStatus);
      }
    });
  }

  private handleStatusChange(service: string, oldStatus: ServiceStatus, newStatus: ServiceStatus): void {
    const alertLevel =
      this.config.alertLevelConfig[service] ?? 'warning';

    let alertMsg = '';
    if (newStatus === 'down') {
      alertMsg = `Service "${service}" is DOWN (was ${oldStatus})`;
    } else if (newStatus === 'degraded') {
      alertMsg = `Service "${service}" is DEGRADED (was ${oldStatus})`;
    } else if (newStatus === 'healthy' && oldStatus !== 'unknown') {
      alertMsg = `Service "${service}" recovered to HEALTHY`;
    }

    if (alertMsg) {
      const alert: HeartbeatAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        service,
        level: alertLevel as AlertLevel,
        message: alertMsg,
        previousStatus: oldStatus,
        newStatus,
        resolved: newStatus === 'healthy',
      };

      this.alerts.set(alert.id, alert);

      // Trigger listeners
      for (const listener of this.statusChangeListeners) {
        try {
          listener(alert);
        } catch (err) {
          console.error('[HeartbeatMonitor] Listener error:', err);
        }
      }

      // Try auto-recovery if enabled
      if (this.config.autoRecoveryEnabled && newStatus === 'down') {
        this.attemptRecovery(service);
      }
    }
  }

  private attemptRecovery(service: string): void {
    const attempts = (this.recoveryAttempts.get(service) ?? 0) + 1;
    this.recoveryAttempts.set(service, attempts);

    if (attempts > 3) {
      console.log(`[HeartbeatMonitor] Max recovery attempts for ${service}, giving up`);
      return;
    }

    console.log(
      `[HeartbeatMonitor] Attempting recovery for ${service} (attempt ${attempts}/3)...`
    );

    // Schedule retry check in 15 seconds
    setTimeout(() => {
      healthMonitor.checkService(service).catch((err) => {
        console.error(`[HeartbeatMonitor] Recovery check failed for ${service}:`, err);
      });
    }, 15000);
  }

  onStatusChange(listener: (alert: HeartbeatAlert) => void): () => void {
    this.statusChangeListeners.add(listener);
    return () => this.statusChangeListeners.delete(listener);
  }

  async captureSnapshot(): Promise<HeartbeatLog> {
    const snapshot = healthMonitor.getSnapshot();
    this.lastSnapshot = snapshot;

    const services = Object.values(snapshot);
    const downCount = services.filter((s) => s.status === 'down').length;
    const degradedCount = services.filter((s) => s.status === 'degraded').length;

    const overallHealth: 'healthy' | 'degraded' | 'critical' =
      downCount > 0 ? 'critical' : degradedCount > 0 ? 'degraded' : 'healthy';

    const alertIds = Array.from(this.alerts.values())
      .filter((a) => a.timestamp > Date.now() - 60000 && !a.resolved) // Last 1 min, unresolved
      .map((a) => a.id);

    const log: HeartbeatLog = {
      timestamp: Date.now(),
      snapshot,
      overallHealth,
      alertsTriggered: alertIds,
    };

    this.logs.push(log);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Persist
    await this.persistLog(log);

    return log;
  }

  private async persistLog(log: HeartbeatLog): Promise<void> {
    try {
      const logs = ((await get(HEARTBEAT_LOG_KEY)) as HeartbeatLog[] | undefined) || [];
      logs.push(log);

      // Keep last 1000
      if (logs.length > 1000) {
        logs.shift();
      }

      await set(HEARTBEAT_LOG_KEY, logs);
    } catch (err) {
      console.error('[HeartbeatMonitor] Failed to persist log:', err);
    }
  }

  async getLogs(limit: number = 100): Promise<HeartbeatLog[]> {
    try {
      const logs = ((await get(HEARTBEAT_LOG_KEY)) as HeartbeatLog[] | undefined) || [];
      return logs.slice(-limit);
    } catch (err) {
      console.error('[HeartbeatMonitor] Failed to load logs:', err);
      return [];
    }
  }

  getAlerts(resolved: boolean = false): HeartbeatAlert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.resolved === resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getLatestSnapshot(): HealthSnapshot | null {
    return this.lastSnapshot;
  }

  async getHealthReport(): Promise<{
    timestamp: number;
    overallHealth: 'healthy' | 'degraded' | 'critical';
    services: any[];
    recentAlerts: HeartbeatAlert[];
    stats: {
      uptimePercent: number;
      averageLatency: Record<string, number>;
      failureCount: Record<string, number>;
    };
  }> {
    const snapshot = healthMonitor.getSnapshot();
    const services = Object.values(snapshot);

    // Calculate uptime from last 100 logs
    const logs = this.logs.slice(-100);
    let healthyCount = 0;
    for (const log of logs) {
      if (log.overallHealth === 'healthy') healthyCount++;
    }
    const uptimePercent = logs.length > 0 ? (healthyCount / logs.length) * 100 : 100;

    // Calculate average latency per service
    const avgLatency: Record<string, number[]> = {};
    for (const log of logs) {
      for (const [name, svc] of Object.entries(log.snapshot)) {
        if (!avgLatency[name]) avgLatency[name] = [];
        avgLatency[name].push(svc.latencyMs);
      }
    }

    const avgLatencyResult: Record<string, number> = {};
    for (const [name, latencies] of Object.entries(avgLatency)) {
      avgLatencyResult[name] = Math.round(
        latencies.reduce((a, b) => a + b, 0) / latencies.length
      );
    }

    // Count failures per service
    const failureCount: Record<string, number> = {};
    for (const log of logs) {
      for (const [name, svc] of Object.entries(log.snapshot)) {
        if (svc.status !== 'healthy') {
          failureCount[name] = (failureCount[name] ?? 0) + 1;
        }
      }
    }

    const overallHealth: 'healthy' | 'degraded' | 'critical' =
      services.filter((s) => s.status === 'down').length > 0
        ? 'critical'
        : services.filter((s) => s.status === 'degraded').length > 0
          ? 'degraded'
          : 'healthy';

    return {
      timestamp: Date.now(),
      overallHealth,
      services,
      recentAlerts: this.getAlerts(false).slice(0, 10),
      stats: {
        uptimePercent: Math.round(uptimePercent * 100) / 100,
        averageLatency: avgLatencyResult,
        failureCount,
      },
    };
  }

  setConfig(updates: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...updates };
    sessionStorage.setItem('heartbeat_config', JSON.stringify(this.config));
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  async clearLogs(): Promise<void> {
    try {
      await del(HEARTBEAT_LOG_KEY);
      this.logs = [];
    } catch (err) {
      console.error('[HeartbeatMonitor] Failed to clear logs:', err);
    }
  }

  async exportLogs(days: number = 1): Promise<string> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const logs = await this.getLogs(1000);
    const filtered = logs.filter((l) => l.timestamp >= cutoff);

    // Format as CSV
    let csv = 'timestamp,overallHealth,healthyServices,degradedServices,downServices\n';
    for (const log of filtered) {
      const services = Object.values(log.snapshot);
      const healthy = services.filter((s) => s.status === 'healthy').length;
      const degraded = services.filter((s) => s.status === 'degraded').length;
      const down = services.filter((s) => s.status === 'down').length;

      csv += `${new Date(log.timestamp).toISOString()},${log.overallHealth},${healthy},${degraded},${down}\n`;
    }

    return csv;
  }
}

// Singleton
export const heartbeatMonitor = new HeartbeatMonitor();
