/**
 * frontend/utils/metricsIntegration.ts
 *
 * Example integration of the metrics framework into the coordinate refinement system.
 * Shows how to wire MetricsCollector into executorAgent and related components.
 *
 * This file demonstrates best practices for metric collection throughout the click pipeline.
 */

import type { ExecutorAction } from './computerAgent/types';
import { MetricsCollector } from './metricsCollector';
import { generateReport, analyzeClickAccuracy, analyzeMethodEffectiveness } from './metricsAnalyzer';
import { StorageAdapter } from './storageAdapter';
import { createLogger } from './logger';

const log = createLogger('metricsIntegration');

/**
 * Example: Record a successful click with metrics
 *
 * Call this in executorAgent.ts after a click action completes.
 * Record both attempts (original and any retries) with the same sessionId.
 */
export async function recordClickMetric(
  sessionId: string,
  originalCoords: { x: number; y: number },
  refinedCoords: { x: number; y: number },
  refinementMethod: 'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback',
  modelConfidence: number,
  durationMs: number,
  success: boolean,
  elementName?: string,
  elementRole?: string,
  note?: string,
): Promise<void> {
  const collector = MetricsCollector.getInstance(sessionId);

  const distance = Math.sqrt(
    Math.pow(refinedCoords.x - originalCoords.x, 2) +
    Math.pow(refinedCoords.y - originalCoords.y, 2)
  );

  collector.addClickMetric({
    timestamp: new Date().toISOString(),
    originalCoords,
    refinedCoords,
    method: refinementMethod,
    confidence: modelConfidence,
    distance,
    duration: durationMs,
    success,
    note: note || elementName,
    elementInfo: {
      name: elementName,
      role: elementRole,
    },
  });

  log.debug(
    `Recorded: ${refinementMethod} - ${success ? 'SUCCESS' : 'FAILED'} - ` +
    `distance: ${distance.toFixed(1)}px - confidence: ${modelConfidence.toFixed(3)}`
  );
}

/**
 * Example: End session and persist metrics
 *
 * Call this when a browser session completes or is archived.
 * Saves metrics to IndexedDB for historical analysis and trend tracking.
 */
export async function endSession(sessionId: string): Promise<void> {
  const collector = MetricsCollector.getInstance(sessionId);
  const sessionMetrics = collector.getSessionMetrics();
  const metrics = collector.getMetrics();

  const storage = StorageAdapter.getInstance();
  await storage.init();
  await storage.saveMetrics(sessionId, sessionMetrics, metrics);

  log.info(
    `Session ${sessionId} ended: ${metrics.length} clicks, ` +
    `${sessionMetrics.successRate.toFixed(1)}% success rate, ` +
    `${sessionMetrics.avgDistance.toFixed(2)}px avg accuracy`
  );
}

/**
 * Example: Get current session report
 *
 * Call this to generate a markdown report of current session metrics.
 * Useful for debugging, analysis, and UI display.
 */
export function generateSessionReport(sessionId: string): string {
  const collector = MetricsCollector.getInstance(sessionId);
  const report = generateReport(collector);

  const markdown = formatReportAsMarkdown(report);
  return markdown;
}

/**
 * Example: Analyze accuracy and alert if degrading
 *
 * Call this periodically during a session to detect performance issues.
 * Triggers alerts if accuracy falls below thresholds.
 */
export function checkAccuracyHealth(sessionId: string): {
  isHealthy: boolean;
  warnings: string[];
} {
  const collector = MetricsCollector.getInstance(sessionId);
  const metrics = collector.getMetrics();

  if (metrics.length < 10) {
    return { isHealthy: true, warnings: [] };
  }

  const accuracy = analyzeClickAccuracy(metrics);
  const warnings: string[] = [];

  if (accuracy.average > 20) {
    warnings.push(`Accuracy degradation: average distance ${accuracy.average.toFixed(2)}px (target <15px)`);
  }

  if (accuracy.withinThreshold30 < 85) {
    warnings.push(`Precision issue: only ${accuracy.withinThreshold30.toFixed(1)}% within 30px (target >85%)`);
  }

  const recent10 = metrics.slice(-10);
  const recentSuccess = (recent10.filter(m => m.success).length / recent10.length) * 100;
  if (recentSuccess < 80) {
    warnings.push(`Success rate dropping: recent success ${recentSuccess.toFixed(1)}% (target >90%)`);
  }

  return {
    isHealthy: warnings.length === 0,
    warnings,
  };
}

/**
 * Example: Get method comparison for UI display
 *
 * Call this to power method effectiveness charts and tables.
 * Useful for real-time monitoring dashboard.
 */
export function getMethodComparison(sessionId: string) {
  const collector = MetricsCollector.getInstance(sessionId);
  const metrics = collector.getMetrics();
  const effectiveness = analyzeMethodEffectiveness(metrics);
  const stats = collector.calculateStats();

  return {
    methods: effectiveness,
    distribution: stats.methodDistribution,
    totalMetrics: stats.totalClicks,
    bestMethod: Object.entries(effectiveness).reduce((best, [method, data]) => {
      return data.successRate > best.rate ? { method, rate: data.successRate } : best;
    }, { method: 'vision', rate: 0 }),
  };
}

/**
 * Example: Export session for analysis
 *
 * Call this to export metrics in various formats for external analysis.
 */
export async function exportSession(
  sessionId: string,
  format: 'json' | 'csv' | 'markdown'
): Promise<string> {
  const collector = MetricsCollector.getInstance(sessionId);

  switch (format) {
    case 'json':
      return collector.exportJSON();
    case 'csv':
      return collector.exportCSV();
    case 'markdown':
      return collector.generateReport();
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Example: Compare two sessions
 *
 * Call this to benchmark improvements or regression detection.
 */
export async function compareSessions(
  sessionId1: string,
  sessionId2: string,
): Promise<{
  improvement: Record<string, number>;
  regression: Record<string, number>;
  summary: string;
}> {
  const storage = StorageAdapter.getInstance();
  await storage.init();

  const session1 = await storage.loadMetrics(sessionId1);
  const session2 = await storage.loadMetrics(sessionId2);

  if (!session1 || !session2) {
    throw new Error('One or both sessions not found in storage');
  }

  const metrics1 = session1.sessionMetrics;
  const metrics2 = session2.sessionMetrics;

  const improvement: Record<string, number> = {};
  const regression: Record<string, number> = {};

  const successDiff = metrics2.successRate - metrics1.successRate;
  if (successDiff > 0) {
    improvement['successRate'] = successDiff;
  } else if (successDiff < 0) {
    regression['successRate'] = Math.abs(successDiff);
  }

  const accuracyDiff = metrics1.avgDistance - metrics2.avgDistance;
  if (accuracyDiff > 0) {
    improvement['avgDistance'] = accuracyDiff;
  } else if (accuracyDiff < 0) {
    regression['avgDistance'] = Math.abs(accuracyDiff);
  }

  const confidenceDiff = metrics2.avgConfidence - metrics1.avgConfidence;
  if (confidenceDiff > 0) {
    improvement['avgConfidence'] = confidenceDiff;
  } else if (confidenceDiff < 0) {
    regression['avgConfidence'] = Math.abs(confidenceDiff);
  }

  const summary =
    `Session ${sessionId2} vs ${sessionId1}:\n` +
    `Success: ${metrics1.successRate.toFixed(1)}% → ${metrics2.successRate.toFixed(1)}% (${successDiff > 0 ? '+' : ''}${successDiff.toFixed(1)}%)\n` +
    `Accuracy: ${metrics1.avgDistance.toFixed(2)}px → ${metrics2.avgDistance.toFixed(2)}px (${accuracyDiff > 0 ? '+' : ''}${accuracyDiff.toFixed(2)}px)\n` +
    `Confidence: ${metrics1.avgConfidence.toFixed(3)} → ${metrics2.avgConfidence.toFixed(3)} (${confidenceDiff > 0 ? '+' : ''}${confidenceDiff.toFixed(3)})`;

  return { improvement, regression, summary };
}

/**
 * Example: Get historical trends
 *
 * Call this to display trend charts and historical analysis.
 */
export async function getHistoricalTrends(limit = 10) {
  const storage = StorageAdapter.getInstance();
  await storage.init();

  const sessions = await storage.getAllSessions();
  const sorted = sessions.sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const trends = sorted.slice(-limit).map(s => ({
    sessionId: s.sessionId,
    timestamp: s.startTime,
    successRate: s.successRate,
    avgDistance: s.avgAccuracy,
    metricsCount: s.metricsCount,
  }));

  return trends;
}

/**
 * Example: Reset session metrics
 *
 * Call this to clear metrics for a fresh session start.
 * Use with caution — this erases in-memory metrics (saved sessions not affected).
 */
export function resetSessionMetrics(sessionId: string): void {
  const collector = MetricsCollector.getInstance(sessionId);
  collector.reset();
  log.info(`Reset metrics for session ${sessionId}`);
}

/**
 * Helper: Format report object as markdown
 */
function formatReportAsMarkdown(report: ReturnType<typeof generateReport>): string {
  let markdown = `# ${report.title}\n\n`;
  markdown += `${report.summary}\n\n`;
  markdown += `**Generated:** ${report.metadata.generatedAt}\n`;
  markdown += `**Metrics Count:** ${report.metadata.metricsCount}\n\n`;

  // Format sections
  report.sections.forEach(section => {
    markdown += `## ${section.heading}\n\n`;
    markdown += `${section.content}\n\n`;

    if (section.subsections) {
      section.subsections.forEach(subsection => {
        markdown += `### ${subsection.heading}\n\n`;
        markdown += `${subsection.content}\n\n`;
      });
    }
  });

  // Format recommendations
  if (report.recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    report.recommendations.forEach(rec => {
      markdown += `- ${rec}\n`;
    });
    markdown += '\n';
  }

  return markdown;
}

/**
 * Example: Initialize metrics system for a session
 *
 * Call this at the start of each browser session to set up metric collection.
 */
export async function initializeMetrics(sessionId: string): Promise<void> {
  const collector = MetricsCollector.getInstance(sessionId);
  const storage = StorageAdapter.getInstance();

  await storage.init();

  log.info(`Metrics system initialized for session ${sessionId}`);
}

/**
 * Example: Clean up old sessions
 *
 * Call this periodically to remove old metric data and free storage.
 */
export async function cleanupOldSessions(keepDays = 30): Promise<number> {
  const storage = StorageAdapter.getInstance();
  await storage.init();

  const sessions = await storage.getAllSessions();
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const session of sessions) {
    if (new Date(session.startTime).getTime() < cutoffTime) {
      await storage.deleteSession(session.sessionId);
      deletedCount++;
    }
  }

  log.info(`Cleaned up ${deletedCount} sessions older than ${keepDays} days`);
  return deletedCount;
}
