/**
 * Watchdog Status Display
 *
 * Shows real-time monitoring of research timeouts, slow sites, and coverage
 */

import { useEffect, useState } from 'react';

interface WatchdogStatusProps {
  status?: {
    sitesActive: number;
    sitesCompleted: number;
    sitesFailed: number;
    averageSiteDurationMs: number;
    warningThresholdHits: string[];
    timeoutHits: string[];
    overallElapsedMs: number;
    shouldReplan: boolean;
    replanReason?: string;
  };
  isVisible?: boolean;
}

export function WatchdogStatus({ status, isVisible = true }: WatchdogStatusProps) {
  const [expandedWarnings, setExpandedWarnings] = useState(false);

  if (!isVisible || !status) return null;

  const totalSites = status.sitesCompleted + status.sitesFailed + status.sitesActive;
  const avgMs = status.averageSiteDurationMs;
  const avgSec = avgMs ? (avgMs / 1000).toFixed(1) : '0';
  const totalSec = Math.round(status.overallElapsedMs / 1000);

  const hasIssues = status.warningThresholdHits.length > 0 || status.timeoutHits.length > 0;
  const statusColor = status.shouldReplan ? 'text-amber-500' : hasIssues ? 'text-yellow-600' : 'text-emerald-600';
  const statusIcon = status.shouldReplan ? '🔄' : hasIssues ? '⚠️' : '✓';

  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-sm font-semibold flex items-center gap-2 ${statusColor}`}>
          <span>{statusIcon}</span>
          Watchdog Monitor
        </h4>
        {hasIssues && (
          <button
            onClick={() => setExpandedWarnings(!expandedWarnings)}
            className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
          >
            {expandedWarnings ? 'Hide' : 'Show'} Details
          </button>
        )}
      </div>

      {/* Main status line */}
      <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 mb-2">
        <div>
          Sites: {status.sitesCompleted}/{totalSites} completed
          {status.sitesFailed > 0 && (
            <span className="text-red-600 dark:text-red-400 ml-2">
              ({status.sitesFailed} failed)
            </span>
          )}
        </div>
        <div>
          Avg duration: {avgSec}s | Total elapsed: {totalSec}s
        </div>

        {status.shouldReplan && (
          <div className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            <span>🔄</span>
            <span>Replan triggered: {status.replanReason}</span>
          </div>
        )}
      </div>

      {/* Expanded warnings */}
      {expandedWarnings && hasIssues && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 space-y-2">
          {status.warningThresholdHits.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-1">{'Slow sites (>30s):'}</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {status.warningThresholdHits.map((url, i) => (
                  <li key={i} className="truncate">
                    • {url}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status.timeoutHits.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">{'Timed out (>60s):'}</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {status.timeoutHits.map((url, i) => (
                  <li key={i} className="truncate">
                    • {url}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {totalSites > 0 && (
        <div className="mt-2">
          <div className="w-full bg-slate-300 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-600 transition-all duration-300"
              style={{
                width: `${totalSites > 0 ? (status.sitesCompleted / totalSites) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">
            {Math.round((status.sitesCompleted / totalSites) * 100)}% complete
          </p>
        </div>
      )}
    </div>
  );
}
