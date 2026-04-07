/**
 * Metrics Collector Module
 *
 * Collects and analyzes click refinement metrics for performance analysis:
 * - Per-click metrics (original/refined coords, method, confidence, success)
 * - Per-method statistics (success rate, avg confidence, avg distance)
 * - Per-session aggregation (total clicks, problematic elements)
 * - Report generation (markdown, CSV, JSON exports)
 *
 * Usage:
 *   const collector = MetricsCollector.getInstance(sessionId);
 *   collector.addClickMetric({ ... });
 *   const report = collector.generateReport();
 */

import { createLogger } from './logger';

const log = createLogger('metricsCollector');

/**
 * Represents a single click metric
 */
export interface ClickMetric {
  /** ISO timestamp of the click */
  timestamp: string;

  /** Original coordinates (from screenshot or initial detection) */
  originalCoords: Coords;

  /** Final refined coordinates (after refinement method applied) */
  refinedCoords: Coords;

  /** Refinement method used: vision, accessibility-tree, retry-jitter, fallback */
  method: 'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback';

  /** Confidence score (0-1) from the model/detector */
  confidence: number;

  /** Euclidean distance between original and refined coordinates */
  distance: number;

  /** Duration of the refinement process in milliseconds */
  duration: number;

  /** Whether the click succeeded (element found, action executed) */
  success: boolean;

  /** Optional notes (element name, error details, etc.) */
  note?: string;

  /** Element information for correlation analysis */
  elementInfo?: {
    name?: string;
    role?: string;
    tag?: string;
  };
}

/**
 * Represents coordinates {x, y}
 */
export interface Coords {
  x: number;
  y: number;
}

/**
 * Per-method success statistics
 */
export interface MethodStats {
  /** Number of times this method was used */
  count: number;

  /** Percentage of successful clicks using this method */
  successRate: number;

  /** Average confidence when using this method */
  avgConfidence: number;

  /** Average distance between original and refined coordinates */
  avgDistance: number;

  /** Average duration of refinement process */
  avgDuration: number;
}

/**
 * Aggregated session metrics
 */
export interface SessionMetrics {
  /** Unique session identifier */
  sessionId: string;

  /** ISO timestamp when session started */
  startTime: string;

  /** Total number of clicks recorded */
  totalClicks: number;

  /** Number of successful clicks */
  successfulClicks: number;

  /** Percentage of successful clicks (0-100) */
  successRate: number;

  /** Average confidence across all clicks */
  avgConfidence: number;

  /** Average distance between original and refined coordinates */
  avgDistance: number;

  /** Per-method statistics */
  methods: {
    vision: MethodStats;
    'accessibility-tree': MethodStats;
    'retry-jitter': MethodStats;
    fallback: MethodStats;
  };

  /** Total cumulative duration of all refinement processes */
  totalDuration: number;

  /** Number of clicks that required fallback method */
  fallbackCount: number;

  /** Elements that had consistent success issues */
  problematicElements: string[];

  /** Elements with high success rates */
  easyElements: string[];
}

/**
 * Statistical summary
 */
export interface StatsSummary {
  /** Success rate percentage */
  successRate: number;

  /** Average confidence across all clicks */
  avgConfidence: number;

  /** Average distance in pixels */
  avgDistance: number;

  /** Distribution of methods used */
  methodDistribution: Record<string, number>;

  /** Percentage of clicks within 50px threshold */
  withinThreshold50: number;

  /** Percentage of clicks within 30px threshold */
  withinThreshold30: number;

  /** Percentage of clicks within 10px threshold */
  withinThreshold10: number;

  /** Total clicks processed */
  totalClicks: number;

  /** Average duration per click */
  avgDuration: number;
}

// === MetricsCollector: Singleton Per Session ===
// Collects and aggregates metrics for coordinate refinement system
// One instance per session ID (isolated tracking)
// Tracks: per-click metrics, per-method stats, element-level success rates
export class MetricsCollector {
  // Static registry: map of sessionId → MetricsCollector instance
  private static instances = new Map<string, MetricsCollector>();

  // Instance properties
  private sessionId: string;                    // Session identifier
  private startTime: number;                    // Session start timestamp
  private metrics: ClickMetric[] = [];          // All recorded click metrics
  private elementSuccessMap = new Map<string, { success: number; total: number }>(); // Per-element success tracking

  // === Static Factory: Get or Create Instance ===
  // Ensures singleton pattern: one collector per sessionId
  static getInstance(sessionId: string): MetricsCollector {
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, new MetricsCollector(sessionId));
    }
    return this.instances.get(sessionId)!;
  }

  // === Constructor: Private ===
  // Only called by getInstance, never directly instantiated
  private constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.startTime = Date.now();
    log.debug(`MetricsCollector initialized for session: ${sessionId}`);
  }

  // === Add Metric ===
  // Records a single click metric and updates element-level tracking
  addClickMetric(metric: ClickMetric): void {
    // Add to metrics array
    this.metrics.push(metric);

    // === Element-Level Success Tracking ===
    // Track success/total per element for pattern detection
    // (e.g., "login button" fails 40% of time, but "submit" always works)
    const elementKey = metric.elementInfo?.name || metric.note || 'unknown';
    if (!this.elementSuccessMap.has(elementKey)) {
      this.elementSuccessMap.set(elementKey, { success: 0, total: 0 });
    }
    const stats = this.elementSuccessMap.get(elementKey)!;
    stats.total++;
    if (metric.success) stats.success++;

    log.debug(`Metric added: ${metric.method} - ${metric.success ? 'success' : 'failed'} - ${metric.distance.toFixed(2)}px`);
  }

  // === Get Aggregated Session Metrics ===
  // Calculates high-level metrics across all clicks in session
  // Returns: total clicks, success rate, avg confidence, method-specific stats
  getSessionMetrics(): SessionMetrics {
    // === Calculate Basic Stats ===
    const successful = this.metrics.filter(m => m.success).length;
    const successRate = this.metrics.length > 0 ? (successful / this.metrics.length) * 100 : 0;

    // === Calculate Average Confidence ===
    // Average confidence score across all clicks
    const avgConfidence = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.confidence, 0) / this.metrics.length
      : 0;

    // === Calculate Average Distance ===
    // Average pixels between original and refined coordinates
    const avgDistance = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.distance, 0) / this.metrics.length
      : 0;

    // === Calculate Total Duration ===
    // Cumulative time across all refinement processes
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);

    // === Calculate Method-Specific Stats ===
    const methods = this.computeMethodStats();
    const fallbackCount = this.metrics.filter(m => m.method === 'fallback').length


    // === Identify Problem Elements ===
    const { problematic, easy } = this.identifyProblematicElements();

    return {
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      totalClicks: this.metrics.length,
      successfulClicks: successful,
      successRate,
      avgConfidence,
      avgDistance,
      methods,
      totalDuration,
      fallbackCount,
      problematicElements: problematic,
      easyElements: easy,
    };
  }

  // === Calculate Statistics Summary ===
  // Derives accuracy thresholds and method distribution
  // Used for reporting and quality analysis
  calculateStats(): StatsSummary {
    // === Basic Stats ===
    const successRate = this.metrics.length > 0
      ? (this.metrics.filter(m => m.success).length / this.metrics.length) * 100
      : 0;

    const avgConfidence = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.confidence, 0) / this.metrics.length
      : 0; // Edge case: Empty metrics returns 0

    const avgDistance = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.distance, 0) / this.metrics.length
      : 0; // Edge case: Empty metrics returns 0

    const avgDuration = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
      : 0;

    // === Method Distribution ===
    // Count how many times each method was used
    const methodCounts: Record<string, number> = {};
    this.metrics.forEach(m => {
      methodCounts[m.method] = (methodCounts[m.method] || 0) + 1;
    });

    // === Accuracy Thresholds ===
    // Percentage of clicks within distance thresholds
    // (e.g., 90% of clicks within 50px = good)
    const within50 = this.metrics.filter(m => m.distance <= 50).length;
    const within30 = this.metrics.filter(m => m.distance <= 30).length;
    const within10 = this.metrics.filter(m => m.distance <= 10).length;

    return {
      successRate,
      avgConfidence,
      avgDistance,
      methodDistribution: methodCounts,
      withinThreshold50: this.metrics.length > 0 ? (within50 / this.metrics.length) * 100 : 0,
      withinThreshold30: this.metrics.length > 0 ? (within30 / this.metrics.length) * 100 : 0,
      withinThreshold10: this.metrics.length > 0 ? (within10 / this.metrics.length) * 100 : 0,
      totalClicks: this.metrics.length,
      avgDuration,
    };
  }

  // === Export as JSON ===
  // Full detailed export: session stats + per-click metrics + summary stats
  // Suitable for programmatic analysis, API storage, or dashboards
  exportJSON(): string {
    const sessionMetrics = this.getSessionMetrics();
    const stats = this.calculateStats();
    return JSON.stringify(
      {
        sessionMetrics,
        detailedMetrics: this.metrics,
        stats,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  // === Export as CSV ===
  // One row per click, suitable for spreadsheet analysis
  // Format: timestamp,originalX,originalY,refinedX,refinedY,method,confidence,distance,duration,success,note
  exportCSV(): string {
    // CSV header row
    const headers = [
      'timestamp',
      'originalX',
      'originalY',
      'refinedX',
      'refinedY',
      'method',
      'confidence',
      'distance',
      'duration',
      'success',
      'note',
    ];

    // Convert each metric to CSV row
    const rows = this.metrics.map(m => [
      m.timestamp,
      m.originalCoords.x,
      m.originalCoords.y,
      m.refinedCoords.x,
      m.refinedCoords.y,
      m.method,
      m.confidence.toFixed(4),
      m.distance.toFixed(2),
      m.duration,
      m.success ? 'true' : 'false',
      (m.note || '').replace(/"/g, '""'), // Escape quotes for CSV
    ].map(v => {
      // Wrap in quotes if value contains comma (CSV standard)
      const str = String(v);
      return str.includes(',') ? `"${str}"` : str;
    }));

    // Combine header + rows
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generate a markdown report
   */
  generateReport(): string {
    const metrics = this.getSessionMetrics();
    const stats = this.calculateStats();

    const duration = Date.now() - this.startTime;
    const durationSec = (duration / 1000).toFixed(1);

    let report = '# Coordinate Refinement Metrics Report\n\n';

    report += `**Session ID:** \`${metrics.sessionId}\`\n\n`;
    report += `**Duration:** ${durationSec}s\n\n`;

    // Summary statistics
    report += '## Summary\n\n';
    report += `- **Total Clicks:** ${stats.totalClicks}\n`;
    report += `- **Success Rate:** ${stats.successRate.toFixed(1)}%\n`;
    report += `- **Avg Confidence:** ${stats.avgConfidence.toFixed(3)}\n`;
    report += `- **Avg Distance:** ${stats.avgDistance.toFixed(2)}px\n`;
    report += `- **Avg Duration:** ${stats.avgDuration.toFixed(0)}ms\n`;
    report += `- **Fallback Count:** ${metrics.fallbackCount}\n\n`;

    // Accuracy thresholds
    report += '## Accuracy Thresholds\n\n';
    report += '| Threshold | Percentage |\n';
    report += '|-----------|------------|\n';
    report += `| Within 10px | ${stats.withinThreshold10.toFixed(1)}% |\n`;
    report += `| Within 30px | ${stats.withinThreshold30.toFixed(1)}% |\n`;
    report += `| Within 50px | ${stats.withinThreshold50.toFixed(1)}% |\n\n`;

    // Method effectiveness
    report += '## Method Effectiveness\n\n';
    report += '| Method | Count | Success Rate | Avg Confidence | Avg Distance |\n';
    report += '|--------|-------|--------------|----------------|--------------|\n';

    Object.entries(metrics.methods).forEach(([method, stat]) => {
      report += `| ${method} | ${stat.count} | ${stat.successRate.toFixed(1)}% | ${stat.avgConfidence.toFixed(3)} | ${stat.avgDistance.toFixed(2)}px |\n`;
    });
    report += '\n';

    // Element analysis
    if (metrics.easyElements.length > 0) {
      report += '## High-Success Elements\n\n';
      metrics.easyElements.forEach(elem => {
        report += `- ${elem}\n`;
      });
      report += '\n';
    }

    if (metrics.problematicElements.length > 0) {
      report += '## Problematic Elements\n\n';
      metrics.problematicElements.forEach(elem => {
        report += `- ${elem}\n`;
      });
      report += '\n';
    }

    // Recommendations
    report += '## Recommendations\n\n';
    report += this.generateRecommendations(stats, metrics);

    return report;
  }

  // === Get Raw Metrics Array ===
  // Returns copy of all metrics (doesn't expose internal array)
  getMetrics(): ClickMetric[] {
    return [...this.metrics];
  }

  // === Reset Metrics ===
  // Clears all collected data and resets start time
  // Used for testing or fresh session start
  reset(): void {
    this.metrics = [];
    this.elementSuccessMap.clear();
    this.startTime = Date.now();
    log.debug('MetricsCollector reset');
  }

  // === Compute Per-Method Statistics ===
  // Calculates success rate, avg confidence, avg distance per refinement method
  // Used by getSessionMetrics to compare method effectiveness
  private computeMethodStats(): Record<'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback', MethodStats> {
    const methods: ('vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback')[] = [
      'vision',
      'accessibility-tree',
      'retry-jitter',
      'fallback',
    ];

    const result: Record<'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback', MethodStats> = {
      'vision': { count: 0, successRate: 0, avgConfidence: 0, avgDistance: 0, avgDuration: 0 },
      'accessibility-tree': { count: 0, successRate: 0, avgConfidence: 0, avgDistance: 0, avgDuration: 0 },
      'retry-jitter': { count: 0, successRate: 0, avgConfidence: 0, avgDistance: 0, avgDuration: 0 },
      'fallback': { count: 0, successRate: 0, avgConfidence: 0, avgDistance: 0, avgDuration: 0 },
    };

    methods.forEach(method => {
      const methodMetrics = this.metrics.filter(m => m.method === method);
      // Edge case: Skip if no metrics for this method (prevents division by zero)
      if (methodMetrics.length === 0) return;

      const successful = methodMetrics.filter(m => m.success).length;
      const stats = result[method];

      stats.count = methodMetrics.length;
      // Safe: methodMetrics.length > 0 checked above, prevents NaN
      stats.successRate = (successful / methodMetrics.length) * 100;
      stats.avgConfidence = methodMetrics.reduce((sum, m) => sum + m.confidence, 0) / methodMetrics.length;
      stats.avgDistance = methodMetrics.reduce((sum, m) => sum + m.distance, 0) / methodMetrics.length;
      stats.avgDuration = methodMetrics.reduce((sum, m) => sum + m.duration, 0) / methodMetrics.length;
    });

    return result;
  }

  // === Identify Problematic and Easy Elements ===
  // Segments elements by success rate for targeted improvement
  // Problematic: 0% success rate (never work)
  // Easy: 100% success rate with 2+ attempts (always work)
  // Used for element-level analysis and debugging
  private identifyProblematicElements(): { problematic: string[]; easy: string[] } {
    const problematic: string[] = [];
    const easy: string[] = [];

    // Iterate through element success map
    this.elementSuccessMap.forEach((stats, element) => {
      // Edge case: Guard against division by zero if stats.total is somehow 0
      if (stats.total <= 0) return;
      const successRate = (stats.success / stats.total) * 100;

      // Only analyze elements with 2+ clicks (reduce noise from 1-off failures)
      if (stats.total >= 2) {
        // Problematic: 0% success (never works)
        if (successRate === 0) {
          problematic.push(element);
        }
        // Easy: 100% success (always works)
        else if (successRate === 100 && stats.total >= 2) {
          easy.push(element);
        }
      }
    });

    return { problematic, easy };
  }

  // === Generate Recommendations ===
  // Analyzes metrics and suggests improvements
  // Based on success rate thresholds, method performance, element patterns
  private generateRecommendations(stats: StatsSummary, metrics: SessionMetrics): string {
    const recommendations: string[] = [];

    if (stats.successRate < 80) {
      recommendations.push('**Low overall success rate.** Consider reviewing vision model confidence thresholds or accessibility tree parsing.');
    }

    if (stats.avgDistance > 20) {
      recommendations.push('**High average distance between original and refined coordinates.** Consider tuning refinement algorithms or increasing vision model resolution.');
    }

    if (metrics.fallbackCount > metrics.totalClicks * 0.2) {
      recommendations.push('**Frequent fallback method usage (>20%).** Primary methods (vision, accessibility-tree) may need improvement.');
    }

    const visionStats = metrics.methods.vision;
    if (visionStats.count > 0 && visionStats.successRate < metrics.methods['accessibility-tree'].successRate) {
      recommendations.push('**Vision method underperforming compared to accessibility-tree.** Consider hybrid approach or improving vision preprocessing.');
    }

    if (stats.withinThreshold30 < 70) {
      recommendations.push('**Less than 70% of clicks within 30px threshold.** Coordinate refinement could be more precise.');
    }

    if (metrics.problematicElements.length > 0) {
      recommendations.push(`**${metrics.problematicElements.length} consistently problematic elements.** Target these for specialized handling or visual analysis.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('**Excellent performance!** All metrics within acceptable ranges. Continue monitoring for consistency.');
    }

    return recommendations.map(r => `- ${r}`).join('\n');
  }
}
