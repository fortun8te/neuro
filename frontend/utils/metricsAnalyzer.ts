/**
 * frontend/utils/metricsAnalyzer.ts
 *
 * Advanced analysis functions for coordinate refinement metrics.
 * Provides pattern detection, trend analysis, and comparative metrics.
 *
 * Usage:
 *   const collector = MetricsCollector.getInstance(sessionId);
 *   const accuracy = analyzeClickAccuracy(collector.getMetrics());
 *   const patterns = identifyPatterns(collector.getMetrics());
 *   const report = generateReport(collector);
 */

import type { ClickMetric, SessionMetrics, StatsSummary } from './metricsCollector';
import { createLogger } from './logger';

const log = createLogger('metricsAnalyzer');

/**
 * Accuracy analysis results
 */
export interface AccuracyAnalysis {
  /** Percentage of clicks within 50px threshold */
  withinThreshold50: number;

  /** Percentage of clicks within 30px threshold */
  withinThreshold30: number;

  /** Percentage of clicks within 10px threshold */
  withinThreshold10: number;

  /** Average distance in pixels */
  average: number;

  /** Median distance in pixels */
  median: number;

  /** Standard deviation of distances */
  stdDev: number;

  /** Min and max distances */
  range: { min: number; max: number };

  /** Distribution histogram (10px buckets) */
  histogram: Record<string, number>;
}

/**
 * Confidence distribution analysis
 */
export interface ConfidenceAnalysis {
  /** Percentage of clicks with low confidence (0-0.33) */
  low: number;

  /** Percentage of clicks with medium confidence (0.33-0.66) */
  medium: number;

  /** Percentage of clicks with high confidence (0.66-1.0) */
  high: number;

  /** Average confidence */
  average: number;

  /** Confidence distribution by method */
  byMethod: Record<string, {
    low: number;
    medium: number;
    high: number;
    average: number;
  }>;
}

/**
 * Method effectiveness analysis
 */
export interface MethodEffectivenessAnalysis {
  vision: MethodEffectiveness;
  'accessibility-tree': MethodEffectiveness;
  'retry-jitter': MethodEffectiveness;
  fallback: MethodEffectiveness;
}

export interface MethodEffectiveness {
  /** Success rate percentage */
  successRate: number;

  /** Average confidence when using this method */
  avgConfidence: number;

  /** Average distance when using this method */
  avgDistance: number;

  /** Times this method was used as fallback from another method */
  usedAsFallback: number;

  /** Success rate when used as fallback */
  fallbackSuccessRate: number;

  /** Speed (avg duration in ms) */
  avgDuration: number;

  /** Recommended confidence threshold for this method */
  recommendedThreshold: number;
}

/**
 * Pattern detection results
 */
export interface PatternAnalysis {
  /** Elements with consistently low success rates */
  hardElements: Array<{
    name: string;
    successRate: number;
    attempts: number;
    commonMethod: string;
  }>;

  /** Elements with consistently high success rates */
  easyElements: Array<{
    name: string;
    successRate: number;
    attempts: number;
    commonMethod: string;
  }>;

  /** Elements with specific coordinate issues */
  coordinateIssues: Array<{
    name: string;
    avgDistance: number;
    pattern: 'offset-x' | 'offset-y' | 'overshooting' | 'undershooting' | 'systematic';
  }>;

  /** Time-based patterns */
  timePatterns: {
    earlierSessionSuccess: number;
    laterSessionSuccess: number;
    degradation: boolean;
  };

  /** Method switching patterns */
  methodSwitching: {
    fromVisionToFallback: number;
    fromAxToFallback: number;
    highestReliabilityChain: string;
  };
}

/**
 * Comprehensive markdown report
 */
export interface MarkdownReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  recommendations: string[];
  metadata: {
    generatedAt: string;
    sessionId: string;
    metricsCount: number;
  };
}

interface ReportSection {
  heading: string;
  content: string;
  subsections?: ReportSection[];
}

/**
 * Analyze click accuracy distribution
 */
export function analyzeClickAccuracy(metrics: ClickMetric[]): AccuracyAnalysis {
  if (metrics.length === 0) {
    return {
      withinThreshold50: 0,
      withinThreshold30: 0,
      withinThreshold10: 0,
      average: 0,
      median: 0,
      stdDev: 0,
      range: { min: 0, max: 0 },
      histogram: {},
    };
  }

  const distances = metrics.map(m => m.distance);

  const within50 = distances.filter(d => d <= 50).length;
  const within30 = distances.filter(d => d <= 30).length;
  const within10 = distances.filter(d => d <= 10).length;

  const average = distances.reduce((a, b) => a + b, 0) / distances.length;
  const sorted = [...distances].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const variance = distances.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);

  const histogram: Record<string, number> = {};
  distances.forEach(d => {
    const bucket = Math.floor(d / 10) * 10;
    const key = `${bucket}-${bucket + 10}px`;
    histogram[key] = (histogram[key] || 0) + 1;
  });

  return {
    withinThreshold50: (within50 / distances.length) * 100,
    withinThreshold30: (within30 / distances.length) * 100,
    withinThreshold10: (within10 / distances.length) * 100,
    average,
    median,
    stdDev,
    range: { min: Math.min(...distances), max: Math.max(...distances) },
    histogram,
  };
}

/**
 * Analyze confidence distribution
 */
export function analyzeConfidenceDistribution(metrics: ClickMetric[]): ConfidenceAnalysis {
  if (metrics.length === 0) {
    return {
      low: 0,
      medium: 0,
      high: 0,
      average: 0,
      byMethod: {
        vision: { low: 0, medium: 0, high: 0, average: 0 },
        'accessibility-tree': { low: 0, medium: 0, high: 0, average: 0 },
        'retry-jitter': { low: 0, medium: 0, high: 0, average: 0 },
        fallback: { low: 0, medium: 0, high: 0, average: 0 },
      },
    };
  }

  const low = metrics.filter(m => m.confidence <= 0.33).length;
  const medium = metrics.filter(m => m.confidence > 0.33 && m.confidence <= 0.66).length;
  const high = metrics.filter(m => m.confidence > 0.66).length;
  const average = metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length;

  const byMethod: Record<string, { low: number; medium: number; high: number; average: number }> = {
    vision: { low: 0, medium: 0, high: 0, average: 0 },
    'accessibility-tree': { low: 0, medium: 0, high: 0, average: 0 },
    'retry-jitter': { low: 0, medium: 0, high: 0, average: 0 },
    fallback: { low: 0, medium: 0, high: 0, average: 0 },
  };

  Object.keys(byMethod).forEach(method => {
    const methodMetrics = metrics.filter(m => m.method === method);
    if (methodMetrics.length === 0) return;

    const lowCount = methodMetrics.filter(m => m.confidence <= 0.33).length;
    const mediumCount = methodMetrics.filter(m => m.confidence > 0.33 && m.confidence <= 0.66).length;
    const highCount = methodMetrics.filter(m => m.confidence > 0.66).length;
    const avgConf = methodMetrics.reduce((sum, m) => sum + m.confidence, 0) / methodMetrics.length;

    byMethod[method] = {
      low: (lowCount / methodMetrics.length) * 100,
      medium: (mediumCount / methodMetrics.length) * 100,
      high: (highCount / methodMetrics.length) * 100,
      average: avgConf,
    };
  });

  return {
    low: (low / metrics.length) * 100,
    medium: (medium / metrics.length) * 100,
    high: (high / metrics.length) * 100,
    average,
    byMethod,
  };
}

/**
 * Analyze method effectiveness
 */
export function analyzeMethodEffectiveness(metrics: ClickMetric[]): MethodEffectivenessAnalysis {
  const methods = ['vision', 'accessibility-tree', 'retry-jitter', 'fallback'] as const;

  const result: MethodEffectivenessAnalysis = {
    vision: createEmptyMethodEffectiveness(),
    'accessibility-tree': createEmptyMethodEffectiveness(),
    'retry-jitter': createEmptyMethodEffectiveness(),
    fallback: createEmptyMethodEffectiveness(),
  };

  methods.forEach(method => {
    const methodMetrics = metrics.filter(m => m.method === method);
    if (methodMetrics.length === 0) return;

    const successful = methodMetrics.filter(m => m.success).length;
    const avgConfidence = methodMetrics.reduce((sum, m) => sum + m.confidence, 0) / methodMetrics.length;
    const avgDistance = methodMetrics.reduce((sum, m) => sum + m.distance, 0) / methodMetrics.length;
    const avgDuration = methodMetrics.reduce((sum, m) => sum + m.duration, 0) / methodMetrics.length;

    // Detect if used as fallback (lower confidence than previous method)
    let usedAsFallback = 0;
    let fallbackSuccess = 0;
    methodMetrics.forEach((m, idx) => {
      if (idx > 0) {
        const prev = methodMetrics[idx - 1];
        if (m.confidence < prev.confidence) {
          usedAsFallback++;
          if (m.success) fallbackSuccess++;
        }
      }
    });

    // Confidence threshold is usually mean confidence
    const recommendedThreshold = avgConfidence * 0.85; // 85% of average

    result[method] = {
      successRate: (successful / methodMetrics.length) * 100,
      avgConfidence,
      avgDistance,
      usedAsFallback,
      fallbackSuccessRate: usedAsFallback > 0 ? (fallbackSuccess / usedAsFallback) * 100 : 0,
      avgDuration,
      recommendedThreshold,
    };
  });

  return result;
}

/**
 * Identify patterns in metrics
 */
export function identifyPatterns(metrics: ClickMetric[]): PatternAnalysis {
  if (metrics.length === 0) {
    return {
      hardElements: [],
      easyElements: [],
      coordinateIssues: [],
      timePatterns: { earlierSessionSuccess: 0, laterSessionSuccess: 0, degradation: false },
      methodSwitching: { fromVisionToFallback: 0, fromAxToFallback: 0, highestReliabilityChain: '' },
    };
  }

  // Element analysis
  const elementMap = new Map<string, ClickMetric[]>();
  metrics.forEach(m => {
    const key = m.elementInfo?.name || m.note || 'unknown';
    if (!elementMap.has(key)) {
      elementMap.set(key, []);
    }
    elementMap.get(key)!.push(m);
  });

  const hardElements: PatternAnalysis['hardElements'] = [];
  const easyElements: PatternAnalysis['easyElements'] = [];

  elementMap.forEach((elemMetrics, name) => {
    if (elemMetrics.length < 2) return;

    const successRate = (elemMetrics.filter(m => m.success).length / elemMetrics.length) * 100;
    const commonMethod = getMode(elemMetrics.map(m => m.method));

    if (successRate === 0) {
      hardElements.push({ name, successRate, attempts: elemMetrics.length, commonMethod });
    } else if (successRate === 100) {
      easyElements.push({ name, successRate, attempts: elemMetrics.length, commonMethod });
    }
  });

  // Coordinate issue detection
  const coordinateIssues: PatternAnalysis['coordinateIssues'] = [];
  elementMap.forEach((elemMetrics, name) => {
    if (elemMetrics.length < 3) return;

    const avgDistance = elemMetrics.reduce((sum, m) => sum + m.distance, 0) / elemMetrics.length;
    if (avgDistance > 15) {
      const xOffsets = elemMetrics.map(m => m.refinedCoords.x - m.originalCoords.x);
      const yOffsets = elemMetrics.map(m => m.refinedCoords.y - m.originalCoords.y);

      const avgXOffset = xOffsets.reduce((a, b) => a + b, 0) / xOffsets.length;
      const avgYOffset = yOffsets.reduce((a, b) => a + b, 0) / yOffsets.length;

      let pattern: 'offset-x' | 'offset-y' | 'overshooting' | 'undershooting' | 'systematic' = 'systematic';
      const xVariance = variance(xOffsets);
      const yVariance = variance(yOffsets);

      if (xVariance < yVariance && Math.abs(avgXOffset) > 10) {
        pattern = 'offset-x';
      } else if (yVariance < xVariance && Math.abs(avgYOffset) > 10) {
        pattern = 'offset-y';
      } else if (avgDistance > 25 && elemMetrics.filter(m => m.success).length === 0) {
        pattern = 'overshooting';
      } else if (avgDistance > 20) {
        pattern = 'undershooting';
      }

      coordinateIssues.push({ name, avgDistance, pattern });
    }
  });

  // Time-based patterns
  const midpoint = Math.floor(metrics.length / 2);
  const earlierMetrics = metrics.slice(0, midpoint);
  const laterMetrics = metrics.slice(midpoint);

  const earlierSuccess = earlierMetrics.filter(m => m.success).length / Math.max(1, earlierMetrics.length) * 100;
  const laterSuccess = laterMetrics.filter(m => m.success).length / Math.max(1, laterMetrics.length) * 100;
  const degradation = laterSuccess < earlierSuccess - 10;

  // Method switching patterns
  let fromVisionToFallback = 0;
  let fromAxToFallback = 0;

  for (let i = 1; i < metrics.length; i++) {
    const prev = metrics[i - 1];
    const curr = metrics[i];
    if (curr.method === 'fallback') {
      if (prev.method === 'vision') fromVisionToFallback++;
      if (prev.method === 'accessibility-tree') fromAxToFallback++;
    }
  }

  const methods = ['vision', 'accessibility-tree', 'retry-jitter', 'fallback'] as const;
  const methodSuccessRates = methods.map(m => ({
    method: m,
    rate: (metrics.filter(n => n.method === m && n.success).length / Math.max(1, metrics.filter(n => n.method === m).length)) * 100,
  }));
  const highestReliabilityChain = methodSuccessRates
    .filter(m => m.rate > 80)
    .map(m => m.method)
    .join(' -> ') || 'mixed';

  return {
    hardElements,
    easyElements,
    coordinateIssues,
    timePatterns: {
      earlierSessionSuccess: earlierSuccess,
      laterSessionSuccess: laterSuccess,
      degradation,
    },
    methodSwitching: {
      fromVisionToFallback,
      fromAxToFallback,
      highestReliabilityChain,
    },
  };
}

/**
 * Generate comprehensive markdown report
 */
export function generateReport(collector: {
  getMetrics(): ClickMetric[];
  getSessionMetrics(): SessionMetrics;
  calculateStats(): StatsSummary;
}): MarkdownReport {
  const metrics = collector.getMetrics();
  const sessionMetrics = collector.getSessionMetrics();
  const stats = collector.calculateStats();

  const accuracy = analyzeClickAccuracy(metrics);
  const confidence = analyzeConfidenceDistribution(metrics);
  const methodEffectiveness = analyzeMethodEffectiveness(metrics);
  const patterns = identifyPatterns(metrics);

  const sections: ReportSection[] = [];

  // Accuracy section
  sections.push({
    heading: 'Click Accuracy Analysis',
    content: `
- **Average Distance:** ${accuracy.average.toFixed(2)}px
- **Median Distance:** ${accuracy.median.toFixed(2)}px
- **Standard Deviation:** ${accuracy.stdDev.toFixed(2)}px
- **Range:** ${accuracy.range.min.toFixed(0)}px to ${accuracy.range.max.toFixed(0)}px
- **Within 10px:** ${accuracy.withinThreshold10.toFixed(1)}%
- **Within 30px:** ${accuracy.withinThreshold30.toFixed(1)}%
- **Within 50px:** ${accuracy.withinThreshold50.toFixed(1)}%

**Distance Distribution:**
${Object.entries(accuracy.histogram)
  .sort()
  .map(([bucket, count]) => `- ${bucket}: ${count} clicks (${((count / metrics.length) * 100).toFixed(1)}%)`)
  .join('\n')}
    `.trim(),
  });

  // Confidence section
  sections.push({
    heading: 'Confidence Analysis',
    content: `
- **Average Confidence:** ${confidence.average.toFixed(3)}
- **Low Confidence (0-0.33):** ${confidence.low.toFixed(1)}%
- **Medium Confidence (0.33-0.66):** ${confidence.medium.toFixed(1)}%
- **High Confidence (0.66-1.0):** ${confidence.high.toFixed(1)}%

**By Method:**
${Object.entries(confidence.byMethod)
  .map(([method, data]) => `
- **${method}**
  - Average: ${data.average.toFixed(3)}
  - Low: ${data.low.toFixed(1)}%
  - Medium: ${data.medium.toFixed(1)}%
  - High: ${data.high.toFixed(1)}%
`)
  .join('\n')}
    `.trim(),
  });

  // Method effectiveness section
  sections.push({
    heading: 'Method Effectiveness',
    content: `
${Object.entries(methodEffectiveness)
  .map(([method, data]) => `
- **${method}** (${stats.methodDistribution[method] || 0} uses)
  - Success Rate: ${data.successRate.toFixed(1)}%
  - Avg Confidence: ${data.avgConfidence.toFixed(3)}
  - Avg Distance: ${data.avgDistance.toFixed(2)}px
  - Avg Duration: ${data.avgDuration.toFixed(0)}ms
  - Used as Fallback: ${data.usedAsFallback} times
  - Fallback Success Rate: ${data.fallbackSuccessRate.toFixed(1)}%
  - Recommended Threshold: ${data.recommendedThreshold.toFixed(3)}
`)
  .join('\n')}
    `.trim(),
  });

  // Pattern analysis
  if (patterns.hardElements.length > 0 || patterns.easyElements.length > 0) {
    sections.push({
      heading: 'Element Pattern Analysis',
      content: `
${patterns.hardElements.length > 0 ? `
**Hard Elements (0% success):**
${patterns.hardElements.map(e => `- ${e.name} (${e.attempts} attempts, common: ${e.commonMethod})`).join('\n')}
` : ''}

${patterns.easyElements.length > 0 ? `
**Easy Elements (100% success):**
${patterns.easyElements.map(e => `- ${e.name} (${e.attempts} attempts, common: ${e.commonMethod})`).join('\n')}
` : ''}

${patterns.coordinateIssues.length > 0 ? `
**Coordinate Issues:**
${patterns.coordinateIssues.map(e => `- ${e.name}: ${e.avgDistance.toFixed(2)}px avg (${e.pattern})`).join('\n')}
` : ''}
      `.trim(),
    });
  }

  // Time patterns
  if (patterns.timePatterns.degradation) {
    sections.push({
      heading: 'Session Degradation Warning',
      content: `
- **Earlier Session Success:** ${patterns.timePatterns.earlierSessionSuccess.toFixed(1)}%
- **Later Session Success:** ${patterns.timePatterns.laterSessionSuccess.toFixed(1)}%
- **Degradation Detected:** Yes

This suggests performance degradation over time. Consider investigating fatigue, resource exhaustion, or changing page state.
      `.trim(),
    });
  }

  const recommendations: string[] = [];

  if (stats.successRate < 80) {
    recommendations.push('Improve primary detection methods (vision/accessibility-tree) or adjust confidence thresholds');
  }

  if (accuracy.average > 20) {
    recommendations.push('Refine coordinate algorithms to reduce average offset distance');
  }

  if (stats.methodDistribution.fallback && stats.methodDistribution.fallback > stats.totalClicks * 0.2) {
    recommendations.push('Investigate why primary methods fall back frequently (>20% of clicks)');
  }

  if (patterns.hardElements.length > 0) {
    recommendations.push(`Target ${patterns.hardElements.length} problematic elements with specialized detection logic`);
  }

  if (confidence.low > 30) {
    recommendations.push('Address low confidence clicks (>30%) with better feature extraction or model tuning');
  }

  return {
    title: 'Coordinate Refinement Metrics Report',
    summary: `Session ${sessionMetrics.sessionId} processed ${metrics.length} clicks with ${stats.successRate.toFixed(1)}% success rate and ${accuracy.average.toFixed(2)}px average accuracy.`,
    sections,
    recommendations,
    metadata: {
      generatedAt: new Date().toISOString(),
      sessionId: sessionMetrics.sessionId,
      metricsCount: metrics.length,
    },
  };
}

/**
 * Helper: Calculate variance
 */
function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
}

/**
 * Helper: Get most common value (mode)
 */
function getMode<T>(values: T[]): T {
  const counts = new Map<T, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  let maxCount = 0;
  let mode = values[0];
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      mode = value;
    }
  });
  return mode;
}

/**
 * Helper: Create empty method effectiveness
 */
function createEmptyMethodEffectiveness(): MethodEffectiveness {
  return {
    successRate: 0,
    avgConfidence: 0,
    avgDistance: 0,
    usedAsFallback: 0,
    fallbackSuccessRate: 0,
    avgDuration: 0,
    recommendedThreshold: 0.5,
  };
}
