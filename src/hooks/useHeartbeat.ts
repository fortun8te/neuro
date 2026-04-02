/**
 * useHeartbeat — React hook for health monitoring
 * Provides access to heartbeat monitor with live updates
 */

import { useState, useCallback, useEffect } from 'react';
import { heartbeatMonitor, type HeartbeatAlert, type HeartbeatConfig, type HeartbeatLog } from '../utils/heartbeatMonitor';
import { healthMonitor, type HealthSnapshot } from '../utils/healthMonitor';

export interface UseHeartbeatReturn {
  snapshot: HealthSnapshot | null;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  activeAlerts: HeartbeatAlert[];
  resolvedAlerts: HeartbeatAlert[];
  logs: HeartbeatLog[];
  config: HeartbeatConfig;

  // Actions
  captureSnapshot: () => Promise<HeartbeatLog>;
  checkService: (name: string) => Promise<void>;
  checkAll: () => Promise<void>;
  updateConfig: (updates: Partial<HeartbeatConfig>) => void;

  // History
  getLogs: (limit?: number) => Promise<HeartbeatLog[]>;
  clearLogs: () => Promise<void>;
  exportLogs: (days?: number) => Promise<string>;

  // Manual recovery
  attemptRecovery: (service: string) => Promise<void>;
}

export function useHeartbeat(): UseHeartbeatReturn {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<HeartbeatAlert[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<HeartbeatAlert[]>([]);
  const [logs, setLogs] = useState<HeartbeatLog[]>([]);
  const [config, setConfigState] = useState<HeartbeatConfig>(heartbeatMonitor.getConfig());

  // Setup live alert listener
  useEffect(() => {
    const unsubscribe = heartbeatMonitor.onStatusChange((alert) => {
      setActiveAlerts((prev) => {
        // Update existing alert or add new one
        const existing = prev.find((a) => a.service === alert.service);
        if (existing) {
          return prev.map((a) =>
            a.service === alert.service ? alert : a
          );
        }
        return [alert, ...prev].slice(0, 50);
      });

      if (alert.resolved) {
        setResolvedAlerts((prev) => [alert, ...prev].slice(0, 100));
      }
    });

    return () => unsubscribe();
  }, []);

  // Refresh snapshot on mount
  useEffect(() => {
    const initialSnapshot = heartbeatMonitor.getLatestSnapshot();
    if (initialSnapshot) {
      setSnapshot(initialSnapshot);
    }

    setActiveAlerts(heartbeatMonitor.getAlerts(false));
    setResolvedAlerts(heartbeatMonitor.getAlerts(true));
  }, []);

  const captureSnapshot = useCallback(async (): Promise<HeartbeatLog> => {
    try {
      const log = await heartbeatMonitor.captureSnapshot();
      setSnapshot(log.snapshot);
      return log;
    } catch (err) {
      console.error('[useHeartbeat] captureSnapshot failed:', err);
      throw err;
    }
  }, []);

  const checkService = useCallback(async (name: string): Promise<void> => {
    try {
      await healthMonitor.checkService(name);
      setSnapshot(healthMonitor.getSnapshot());
    } catch (err) {
      console.error('[useHeartbeat] checkService failed:', err);
      throw err;
    }
  }, []);

  const checkAll = useCallback(async (): Promise<void> => {
    try {
      await healthMonitor.checkAll();
      await captureSnapshot();
    } catch (err) {
      console.error('[useHeartbeat] checkAll failed:', err);
      throw err;
    }
  }, [captureSnapshot]);

  const updateConfig = useCallback((updates: Partial<HeartbeatConfig>) => {
    try {
      heartbeatMonitor.setConfig(updates);
      setConfigState(heartbeatMonitor.getConfig());
    } catch (err) {
      console.error('[useHeartbeat] updateConfig failed:', err);
    }
  }, []);

  const getLogs = useCallback(async (limit: number = 100): Promise<HeartbeatLog[]> => {
    try {
      const loaded = await heartbeatMonitor.getLogs(limit);
      setLogs(loaded);
      return loaded;
    } catch (err) {
      console.error('[useHeartbeat] getLogs failed:', err);
      throw err;
    }
  }, []);

  const clearLogs = useCallback(async (): Promise<void> => {
    try {
      await heartbeatMonitor.clearLogs();
      setLogs([]);
    } catch (err) {
      console.error('[useHeartbeat] clearLogs failed:', err);
      throw err;
    }
  }, []);

  const exportLogs = useCallback(
    async (days: number = 1): Promise<string> => {
      try {
        return await heartbeatMonitor.exportLogs(days);
      } catch (err) {
        console.error('[useHeartbeat] exportLogs failed:', err);
        throw err;
      }
    },
    []
  );

  const attemptRecovery = useCallback(async (service: string): Promise<void> => {
    try {
      console.log(`[useHeartbeat] Attempting recovery for ${service}...`);
      await healthMonitor.checkService(service);
      setSnapshot(healthMonitor.getSnapshot());
    } catch (err) {
      console.error('[useHeartbeat] attemptRecovery failed:', err);
      throw err;
    }
  }, []);

  // Determine overall health
  const overallHealth: 'healthy' | 'degraded' | 'critical' =
    snapshot && Object.values(snapshot).some((s) => s.status === 'down')
      ? 'critical'
      : snapshot && Object.values(snapshot).some((s) => s.status === 'degraded')
        ? 'degraded'
        : 'healthy';

  return {
    snapshot,
    overallHealth,
    activeAlerts,
    resolvedAlerts,
    logs,
    config,
    captureSnapshot,
    checkService,
    checkAll,
    updateConfig,
    getLogs,
    clearLogs,
    exportLogs,
    attemptRecovery,
  };
}
