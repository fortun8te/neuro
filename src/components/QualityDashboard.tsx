import React, { useMemo } from 'react';
import type { Cycle, StageName } from '../types';
import { getQualitySession, generateQualitySummary } from '../utils/qualityControlIntegration';

interface QualityDashboardProps {
  cycle: Cycle | null;
  onClose?: () => void;
}

const STAGE_DISPLAY_NAMES: Record<StageName, string> = {
  'research': 'Research',
  'brand-dna': 'Brand DNA',
  'persona-dna': 'Personas',
  'angles': 'Angles',
  'strategy': 'Strategy',
  'copywriting': 'Copywriting',
  'production': 'Production',
  'test': 'Testing',
};

export function QualityDashboard({ cycle, onClose }: QualityDashboardProps) {
  const qualitySession = useMemo(() => {
    if (!cycle) return null;
    return getQualitySession(cycle.id);
  }, [cycle]);

  const qualitySummary = useMemo(() => {
    if (!cycle) return null;
    return generateQualitySummary(cycle.id);
  }, [cycle]);

  if (!cycle || !qualitySession || !qualitySummary) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No quality data available yet.</p>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'pass':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'CR';
      case 'warning':
        return 'WN';
      case 'pass':
        return 'OK';
      default:
        return '--';
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Quality Control Dashboard</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            x
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-blue-700 mb-1">Avg Score</div>
          <div className="text-3xl font-bold text-blue-900">
            {qualitySummary.averageQualityScore}
          </div>
          <div className="text-xs text-blue-600 mt-1">/100</div>
        </div>

        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
          <div className="text-sm font-medium text-green-700 mb-1">Passed</div>
          <div className="text-3xl font-bold text-green-900">
            {qualitySummary.passedStages}
          </div>
          <div className="text-xs text-green-600 mt-1">of {qualitySummary.evaluatedStages}</div>
        </div>

        <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200">
          <div className="text-sm font-medium text-red-700 mb-1">Failed</div>
          <div className="text-3xl font-bold text-red-900">
            {qualitySummary.failedStages}
          </div>
          <div className="text-xs text-red-600 mt-1">{qualitySummary.totalRetries} retries</div>
        </div>

        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
          <div className="text-sm font-medium text-purple-700 mb-1">Trend</div>
          <div className="text-xl font-bold text-purple-900 capitalize">
            {qualitySummary.qualityTrend}
          </div>
          <div className="text-xs text-purple-600 mt-1">Quality trajectory</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Stage Evaluations</h3>
        <div className="space-y-2">
          {Object.entries(qualitySession.stageHistory).map(([stageName, history]) => {
            const lastAttempt = history.attempts[history.attempts.length - 1];
            if (!lastAttempt) return null;

            const { evaluation } = lastAttempt;
            return (
              <details
                key={stageName}
                className={`p-4 rounded-lg border ${getSeverityColor(evaluation.severity)}`}
              >
                <summary className="cursor-pointer font-medium flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold">[{getSeverityBadge(evaluation.severity)}]</span>
                    <span>{STAGE_DISPLAY_NAMES[stageName as StageName]}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">{evaluation.overallScore}/100</span>
                    {history.totalRetries > 0 && (
                      <span className="text-xs px-2 py-1 bg-black bg-opacity-10 rounded">
                        {history.totalRetries} retries
                      </span>
                    )}
                  </div>
                </summary>

                <div className="mt-4 space-y-3 text-sm">
                  {evaluation.metrics.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Criteria Scores:</h4>
                      <div className="space-y-2">
                        {evaluation.metrics.map((metric) => (
                          <div
                            key={metric.name}
                            className="flex items-center justify-between p-2 bg-white bg-opacity-50 rounded"
                          >
                            <div>
                              <div className="font-medium">{metric.name}</div>
                              <div className="text-xs opacity-75">{metric.feedback}</div>
                            </div>
                            <div className="font-bold whitespace-nowrap">
                              {metric.score}/{metric.threshold}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-1">Feedback:</h4>
                    <p className="opacity-75">{evaluation.feedback}</p>
                  </div>

                  {evaluation.suggestedFix && (
                    <div>
                      <h4 className="font-medium mb-1">Suggested Fix:</h4>
                      <p className="opacity-75">{evaluation.suggestedFix}</p>
                    </div>
                  )}

                  {history.attempts.length > 1 && (
                    <div className="text-xs opacity-75 pt-2 border-t border-current border-opacity-20">
                      Attempted {history.attempts.length} times
                      {history.totalRetries > 0 && ` ({history.totalRetries} retries)`}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
        <p>Quality control is designed to catch issues early and improve output reliability.</p>
      </div>
    </div>
  );
}
