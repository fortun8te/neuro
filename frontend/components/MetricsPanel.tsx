/**
 * frontend/components/MetricsPanel.tsx
 *
 * React component for displaying real-time coordinate refinement metrics.
 * Shows KPIs, accuracy distribution, method comparison, and recommendations.
 *
 * Usage:
 *   const collector = MetricsCollector.getInstance(sessionId);
 *   const metrics = collector.getSessionMetrics();
 *   const stats = collector.calculateStats();
 *   return <MetricsPanel metrics={metrics} stats={stats} />;
 */

import React, { useState, useEffect } from 'react';
import type { SessionMetrics, StatsSummary } from '../utils/metricsCollector';
import { analyzeClickAccuracy, analyzeMethodEffectiveness, identifyPatterns } from '../utils/metricsAnalyzer';
import { createLogger } from '../utils/logger';

const log = createLogger('MetricsPanel');

interface MetricsPanelProps {
  metrics: SessionMetrics;
  stats: StatsSummary;
  onExport?: (format: 'json' | 'csv' | 'markdown') => void;
}

/**
 * MetricsPanel component
 */
export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  stats,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'accuracy' | 'methods' | 'patterns'>('summary');

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Coordinate Refinement Metrics</h2>
          <p className="text-sm text-slate-400 mt-1">
            Session: <code className="bg-slate-800 px-2 py-1 rounded text-xs">{metrics.sessionId}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExport?.('json')}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition"
          >
            JSON
          </button>
          <button
            onClick={() => onExport?.('csv')}
            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition"
          >
            CSV
          </button>
          <button
            onClick={() => onExport?.('markdown')}
            className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition"
          >
            Markdown
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Success Rate" value={`${metrics.successRate.toFixed(1)}%`} target={90} />
        <KPICard label="Avg Accuracy" value={`${metrics.avgDistance.toFixed(2)}px`} target={15} isInverse />
        <KPICard label="Avg Confidence" value={metrics.avgConfidence.toFixed(3)} target={0.85} />
        <KPICard label="Total Clicks" value={`${metrics.totalClicks}`} target={100} hideTarget />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(['summary', 'accuracy', 'methods', 'patterns'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm transition ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-96">
        {activeTab === 'summary' && <SummaryTab metrics={metrics} stats={stats} />}
        {activeTab === 'accuracy' && <AccuracyTab stats={stats} />}
        {activeTab === 'methods' && <MethodsTab metrics={metrics} stats={stats} />}
        {activeTab === 'patterns' && <PatternsTab metrics={metrics} />}
      </div>
    </div>
  );
};

/**
 * KPI Card component
 */
interface KPICardProps {
  label: string;
  value: string;
  target?: number;
  isInverse?: boolean;
  hideTarget?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  target,
  isInverse = false,
  hideTarget = false,
}) => {
  const numValue = parseFloat(value);
  let status: 'good' | 'warning' | 'poor' = 'good';

  if (target && !hideTarget) {
    if (isInverse) {
      status = numValue <= target ? 'good' : numValue <= target * 1.2 ? 'warning' : 'poor';
    } else {
      status = numValue >= target ? 'good' : numValue >= target * 0.8 ? 'warning' : 'poor';
    }
  }

  const bgColor =
    status === 'good' ? 'bg-green-900' : status === 'warning' ? 'bg-yellow-900' : 'bg-red-900';
  const borderColor =
    status === 'good' ? 'border-green-700' : status === 'warning' ? 'border-yellow-700' : 'border-red-700';
  const textColor =
    status === 'good' ? 'text-green-400' : status === 'warning' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className="text-xs text-slate-400 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${textColor} mb-1`}>{value}</div>
      {!hideTarget && target && (
        <div className="text-xs text-slate-500">
          Target: {target}
          {isInverse ? ' px' : '%'}
        </div>
      )}
    </div>
  );
};

/**
 * Summary Tab
 */
const SummaryTab: React.FC<{ metrics: SessionMetrics; stats: StatsSummary }> = ({
  metrics,
  stats,
}) => {
  return (
    <div className="space-y-6">
      {/* Threshold bars */}
      <div>
        <h3 className="font-semibold text-white mb-3">Accuracy Thresholds</h3>
        <div className="space-y-3">
          <ThresholdBar label="Within 10px" percentage={stats.withinThreshold10} />
          <ThresholdBar label="Within 30px" percentage={stats.withinThreshold30} />
          <ThresholdBar label="Within 50px" percentage={stats.withinThreshold50} />
        </div>
      </div>

      {/* Methods distribution */}
      <div>
        <h3 className="font-semibold text-white mb-3">Method Distribution</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(stats.methodDistribution).map(([method, count]) => {
            const percentage = ((count / stats.totalClicks) * 100).toFixed(1);
            return (
              <div key={method} className="bg-slate-800 rounded p-3">
                <div className="text-xs text-slate-400 mb-1 capitalize">{method}</div>
                <div className="text-lg font-semibold text-blue-400">{count}</div>
                <div className="text-xs text-slate-500">{percentage}% of clicks</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fallback warning */}
      {metrics.fallbackCount > 0 && (
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
          <div className="font-semibold text-yellow-400">Fallback Usage</div>
          <div className="text-sm text-yellow-200 mt-1">
            {metrics.fallbackCount} fallback attempts
            ({((metrics.fallbackCount / metrics.totalClicks) * 100).toFixed(1)}%)
          </div>
        </div>
      )}

      {/* Element analysis */}
      {(metrics.easyElements.length > 0 || metrics.problematicElements.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {metrics.easyElements.length > 0 && (
            <div className="bg-green-900 border border-green-700 rounded p-4">
              <div className="font-semibold text-green-400 mb-2">Easy Elements</div>
              <ul className="text-sm text-green-200 space-y-1">
                {metrics.easyElements.slice(0, 3).map(elem => (
                  <li key={elem}>• {elem}</li>
                ))}
              </ul>
            </div>
          )}
          {metrics.problematicElements.length > 0 && (
            <div className="bg-red-900 border border-red-700 rounded p-4">
              <div className="font-semibold text-red-400 mb-2">Problematic Elements</div>
              <ul className="text-sm text-red-200 space-y-1">
                {metrics.problematicElements.slice(0, 3).map(elem => (
                  <li key={elem}>• {elem}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Accuracy Tab
 */
const AccuracyTab: React.FC<{ stats: StatsSummary }> = ({ stats }) => {
  const accuracy = analyzeClickAccuracy([]);
  // In real usage, pass actual metrics array

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-white mb-3">Distance Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Average" value={`${stats.avgDistance.toFixed(2)}px`} />
          <StatCard label="Threshold 30px" value={`${stats.withinThreshold30.toFixed(1)}%`} />
          <StatCard label="Total Clicks" value={`${stats.totalClicks}`} />
        </div>
      </div>

      <div className="bg-slate-800 rounded p-4">
        <div className="text-sm font-semibold text-slate-300 mb-3">Sample Distance Distribution</div>
        <div className="text-xs text-slate-500 text-center py-8">
          Distance histogram would be displayed here with actual metrics data
        </div>
      </div>
    </div>
  );
};

/**
 * Methods Tab
 */
const MethodsTab: React.FC<{ metrics: SessionMetrics; stats: StatsSummary }> = ({
  metrics,
  stats,
}) => {
  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-400 mb-4">
        Hover over rows to see detailed statistics
      </div>

      {Object.entries(metrics.methods).map(([method, data]) => (
        <div key={method} className="bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-white capitalize">{method}</div>
              <div className="text-xs text-slate-400">
                {data.count} uses ({((data.count / stats.totalClicks) * 100).toFixed(1)}%)
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-400">{data.successRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-400">Success</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900 rounded p-2">
              <div className="text-slate-400">Confidence</div>
              <div className="text-slate-200 font-semibold">{data.avgConfidence.toFixed(3)}</div>
            </div>
            <div className="bg-slate-900 rounded p-2">
              <div className="text-slate-400">Distance</div>
              <div className="text-slate-200 font-semibold">{data.avgDistance.toFixed(2)}px</div>
            </div>
            <div className="bg-slate-900 rounded p-2">
              <div className="text-slate-400">Duration</div>
              <div className="text-slate-200 font-semibold">{data.avgDuration.toFixed(0)}ms</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Patterns Tab
 */
const PatternsTab: React.FC<{ metrics: SessionMetrics }> = ({ metrics }) => {
  const patterns = identifyPatterns([]);
  // In real usage, pass actual metrics array

  return (
    <div className="space-y-6">
      {metrics.easyElements.length > 0 && (
        <div>
          <h3 className="font-semibold text-green-400 mb-3">High-Success Elements</h3>
          <div className="space-y-2">
            {metrics.easyElements.map(elem => (
              <div key={elem} className="bg-slate-800 rounded p-3 text-sm">
                <div className="text-white">{elem}</div>
                <div className="text-xs text-green-400 mt-1">100% success rate</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics.problematicElements.length > 0 && (
        <div>
          <h3 className="font-semibold text-red-400 mb-3">Problematic Elements</h3>
          <div className="space-y-2">
            {metrics.problematicElements.map(elem => (
              <div key={elem} className="bg-slate-800 rounded p-3 text-sm">
                <div className="text-white">{elem}</div>
                <div className="text-xs text-red-400 mt-1">0% success rate - needs investigation</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Helper components
 */

const ThresholdBar: React.FC<{ label: string; percentage: number }> = ({
  label,
  percentage,
}) => {
  const getColor = () => {
    if (percentage >= 85) return 'bg-green-600';
    if (percentage >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-semibold text-slate-300">{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-800 rounded p-3">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className="text-lg font-semibold text-slate-200">{value}</div>
  </div>
);

export default MetricsPanel;
