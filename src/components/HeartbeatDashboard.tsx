/**
 * HeartbeatDashboard — Real-time health monitoring UI
 */

import React, { useEffect, useState } from 'react';
import { useHeartbeat } from '../hooks/useHeartbeat';
import type { HealthSnapshot, ServiceStatus } from '../utils/healthMonitor';

function getStatusColor(status: ServiceStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'degraded':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'down':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function getStatusIcon(status: ServiceStatus): string {
  switch (status) {
    case 'healthy':
      return '✓';
    case 'degraded':
      return '!';
    case 'down':
      return '✕';
    default:
      return '?';
  }
}

interface ServiceCardProps {
  name: string;
  status: ServiceStatus;
  latency: number;
  lastCheck: number;
  error?: string;
  onCheck: (name: string) => Promise<void>;
  onRecover: (name: string) => Promise<void>;
}

function ServiceCard({
  name,
  status,
  latency,
  lastCheck,
  error,
  onCheck,
  onRecover,
}: ServiceCardProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      await onCheck(name);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRecover = async () => {
    setIsRecovering(true);
    try {
      await onRecover(name);
    } finally {
      setIsRecovering(false);
    }
  };

  const lastCheckAgo = Date.now() - lastCheck;
  const lastCheckText =
    lastCheckAgo < 60000
      ? `${Math.floor(lastCheckAgo / 1000)}s ago`
      : lastCheckAgo < 3600000
        ? `${Math.floor(lastCheckAgo / 60000)}m ago`
        : 'Never';

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor(status)}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold">{getStatusIcon(status)}</span>
            <h3 className="text-lg font-semibold capitalize">{name}</h3>
          </div>

          <div className="space-y-1 text-sm">
            <p>Status: {status.toUpperCase()}</p>
            <p>Latency: {latency}ms</p>
            <p>Last check: {lastCheckText}</p>
            {error && <p className="text-xs mt-1">Error: {error}</p>}
          </div>
        </div>

        <div className="flex gap-2 flex-col">
          <button
            onClick={handleCheck}
            disabled={isChecking}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Check'}
          </button>

          {status !== 'healthy' && (
            <button
              onClick={handleRecover}
              disabled={isRecovering}
              className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {isRecovering ? 'Recovering...' : 'Recover'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HeartbeatDashboard() {
  const {
    snapshot,
    overallHealth,
    activeAlerts,
    config,
    captureSnapshot,
    checkService,
    checkAll,
    updateConfig,
    attemptRecovery,
  } = useHeartbeat();

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      captureSnapshot().catch(console.error);
    }, config.checkIntervalMs);

    return () => clearInterval(interval);
  }, [autoRefresh, config.checkIntervalMs, captureSnapshot]);

  // Initial capture
  useEffect(() => {
    captureSnapshot().catch(console.error);
  }, [captureSnapshot]);

  const healthColors = {
    healthy: 'bg-green-100 border-green-300 text-green-900',
    degraded: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    critical: 'bg-red-100 border-red-300 text-red-900',
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">System Health Monitor</h1>
          <p className="text-gray-600 mt-2">Real-time service status and alerting</p>
        </div>

        {/* Overall Status */}
        <div className={`p-6 rounded-lg border-2 mb-6 ${healthColors[overallHealth]}`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold capitalize">{overallHealth} Status</h2>
              <p className="text-sm mt-2">All systems operational</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => checkAll()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Check All
              </button>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Auto-refresh</span>
              </label>
            </div>
          </div>
        </div>

        {/* Alert Summary */}
        {activeAlerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
            <h3 className="font-semibold text-red-900 mb-2">
              {activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}
            </h3>
            <ul className="space-y-1 text-sm text-red-800">
              {activeAlerts.slice(0, 5).map((alert) => (
                <li key={alert.id}>{alert.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {snapshot &&
            Object.entries(snapshot).map(([name, service]) => (
              <ServiceCard
                key={name}
                name={name}
                status={service.status}
                latency={service.latencyMs}
                lastCheck={service.lastCheck}
                error={service.lastError}
                onCheck={checkService}
                onRecover={attemptRecovery}
              />
            ))}
        </div>

        {/* Configuration */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Configuration</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check Interval (ms)
              </label>
              <input
                type="number"
                min="5000"
                step="5000"
                value={config.checkIntervalMs}
                onChange={(e) =>
                  updateConfig({ checkIntervalMs: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archive Retention (days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={config.archiveRetentionDays}
                onChange={(e) =>
                  updateConfig({
                    archiveRetentionDays: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoRecoveryEnabled}
              onChange={(e) =>
                updateConfig({ autoRecoveryEnabled: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Enable Auto-Recovery</span>
          </label>
        </div>
      </div>
    </div>
  );
}
