import type { Cycle, StageName, Campaign, StageData } from '../types';
import type { QualityEvaluation } from './qualityEvaluator';
import type { RetryConfig } from './qualityEvaluator';
import { evaluateStageQuality, canRetry, generateRetryConfig } from './qualityEvaluator';
import { getModelForStage } from './modelConfig';

/**
 * Quality Control Integration
 * - Hooks into cycle execution to evaluate and retry
 * - Manages retry state and feedback injection
 */

export interface StageQualityHistory {
  stageName: StageName;
  attempts: Array<{
    attemptNumber: number;
    timestamp: number;
    model: string;
    temperature: number;
    evaluation: QualityEvaluation;
    passed: boolean;
  }>;
  finalStatus: 'passed' | 'failed' | 'skipped';
  totalRetries: number;
}

export interface QualityControlSession {
  cycleId: string;
  stageHistory: Record<StageName, StageQualityHistory>;
  totalRetriesMade: number;
  overallQualityScore: number;
}

// Track quality state per cycle
const qualitySessionMap = new Map<string, QualityControlSession>();

/**
 * Initialize quality control for a cycle
 */
export function initializeQualityControl(cycleId: string): void {
  if (!qualitySessionMap.has(cycleId)) {
    qualitySessionMap.set(cycleId, {
      cycleId,
      stageHistory: {} as Record<StageName, StageQualityHistory>,
      totalRetriesMade: 0,
      overallQualityScore: 100,
    });
  }
}

/**
 * Evaluate stage and determine if retry is needed
 * Called after stage execution completes
 */
export async function evaluateStageAndDecideRetry(
  cycle: Cycle,
  stageName: StageName,
  stageData: StageData,
  campaign: Campaign,
  options: {
    enableAutoRetry?: boolean;
    maxRetries?: number;
    timeoutMinutes?: number;
  } = {},
): Promise<{
  evaluation: QualityEvaluation;
  shouldRetry: boolean;
  retryConfig?: RetryConfig;
  reason: string;
}> {
  const {
    enableAutoRetry = true,
    maxRetries = 3,
    timeoutMinutes = 30,
  } = options;

  initializeQualityControl(cycle.id);
  const session = qualitySessionMap.get(cycle.id)!;

  // Initialize stage history if needed
  if (!session.stageHistory[stageName]) {
    session.stageHistory[stageName] = {
      stageName,
      attempts: [],
      finalStatus: 'skipped',
      totalRetries: 0,
    };
  }

  const stageHistory = session.stageHistory[stageName];
  const attemptNumber = stageHistory.attempts.length + 1;

  // Get previous stage outputs for context
  const previousContext = buildPreviousStageContext(cycle, stageName);

  // Evaluate quality
  const evaluation = await evaluateStageQuality(
    stageName,
    stageData,
    previousContext,
  );

  // Record attempt
  stageHistory.attempts.push({
    attemptNumber,
    timestamp: Date.now(),
    model: stageData.model || getModelForStage(stageName),
    temperature: 0.7, // would be tracked in actual execution
    evaluation,
    passed: evaluation.severity === 'pass',
  });

  // Decide on retry
  if (!enableAutoRetry || evaluation.severity === 'pass') {
    stageHistory.finalStatus = evaluation.severity === 'pass' ? 'passed' : 'failed';
    return {
      evaluation,
      shouldRetry: false,
      reason: evaluation.severity === 'pass'
        ? 'Quality evaluation passed'
        : 'Auto-retry disabled',
    };
  }

  // Check retry constraints
  const canRetryResult = canRetry({
    currentRetryCount: attemptNumber - 1,
    maxRetries,
    currentTemperature: 0.7,
    currentModel: stageData.model || getModelForStage(stageName),
    availableModels: ['qwen3.5:2b', 'qwen3.5:4b', 'qwen3.5:9b', 'qwen3.5:27b', 'nemotron-3-super:120b'],
    timeoutMinutes,
    elapsedSeconds: (stageData.processingTime || 0) / 1000,
  });

  if (!canRetryResult.canRetry) {
    stageHistory.finalStatus = 'failed';
    return {
      evaluation,
      shouldRetry: false,
      reason: canRetryResult.reason || 'Retry constraints not met',
    };
  }

  // Generate retry configuration
  const retryConfig = generateRetryConfig(evaluation, {
    currentRetryCount: attemptNumber - 1,
    maxRetries,
    currentTemperature: 0.7,
    currentModel: stageData.model || getModelForStage(stageName),
    availableModels: ['qwen3.5:2b', 'qwen3.5:4b', 'qwen3.5:9b', 'qwen3.5:27b', 'nemotron-3-super:120b'],
    timeoutMinutes,
    elapsedSeconds: (stageData.processingTime || 0) / 1000,
  });

  session.totalRetriesMade += 1;

  return {
    evaluation,
    shouldRetry: true,
    retryConfig,
    reason: `Quality score ${evaluation.overallScore}/100 below ${evaluation.severity} threshold`,
  };
}

/**
 * Build context from previous stages for evaluation
 */
function buildPreviousStageContext(cycle: Cycle, currentStage: StageName): string {
  const stageOrder: StageName[] = [
    'research',
    'brand-dna',
    'persona-dna',
    'angles',
    'strategy',
    'copywriting',
    'production',
    'test',
  ];

  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex <= 0) return '';

  const contexts: string[] = [];
  for (let i = Math.max(0, currentIndex - 2); i < currentIndex; i++) {
    const prevStage = stageOrder[i];
    const prevData = cycle.stages[prevStage];
    if (prevData && prevData.agentOutput) {
      contexts.push(
        `[${prevStage}]\n${prevData.agentOutput.slice(0, 300)}...`,
      );
    }
  }

  return contexts.join('\n\n');
}

/**
 * Get quality session for a cycle
 */
export function getQualitySession(cycleId: string): QualityControlSession | null {
  return qualitySessionMap.get(cycleId) || null;
}

/**
 * Generate quality summary for cycle
 */
export function generateQualitySummary(cycleId: string): {
  totalStages: number;
  evaluatedStages: number;
  passedStages: number;
  failedStages: number;
  totalRetries: number;
  averageQualityScore: number;
  qualityTrend: 'improving' | 'stable' | 'declining';
} {
  const session = qualitySessionMap.get(cycleId);
  if (!session) {
    return {
      totalStages: 0,
      evaluatedStages: 0,
      passedStages: 0,
      failedStages: 0,
      totalRetries: 0,
      averageQualityScore: 0,
      qualityTrend: 'stable',
    };
  }

  const stages = Object.values(session.stageHistory);
  const evaluated = stages.filter((s) => s.attempts.length > 0).length;
  const passed = stages.filter((s) => s.finalStatus === 'passed').length;
  const failed = stages.filter((s) => s.finalStatus === 'failed').length;

  const allScores = stages.flatMap((s) =>
    s.attempts.map((a) => a.evaluation.overallScore),
  );
  const avgScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

  // Trend analysis: compare early vs late scores
  const qualityTrend = analyzeQualityTrend(stages);

  return {
    totalStages: 8,
    evaluatedStages: evaluated,
    passedStages: passed,
    failedStages: failed,
    totalRetries: session.totalRetriesMade,
    averageQualityScore: avgScore,
    qualityTrend,
  };
}

/**
 * Analyze quality trend across stages
 */
function analyzeQualityTrend(
  stages: StageQualityHistory[],
): 'improving' | 'stable' | 'declining' {
  const allAttempts = stages.flatMap((s) => s.attempts);
  if (allAttempts.length < 2) return 'stable';

  const firstHalf = allAttempts
    .slice(0, Math.ceil(allAttempts.length / 2))
    .map((a) => a.evaluation.overallScore);
  const secondHalf = allAttempts
    .slice(Math.ceil(allAttempts.length / 2))
    .map((a) => a.evaluation.overallScore);

  const avgFirst =
    firstHalf.length > 0
      ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      : 0;
  const avgSecond =
    secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : 0;

  const diff = avgSecond - avgFirst;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * Clear quality session
 */
export function clearQualitySession(cycleId: string): void {
  qualitySessionMap.delete(cycleId);
}

/**
 * Export quality data for analytics
 */
export function exportQualityMetrics(cycleId: string): object {
  const session = qualitySessionMap.get(cycleId);
  if (!session) return {};

  const summary = generateQualitySummary(cycleId);
  const stageMetrics: Record<string, object> = {};

  for (const [stageName, history] of Object.entries(session.stageHistory)) {
    stageMetrics[stageName] = {
      finalStatus: history.finalStatus,
      totalAttempts: history.attempts.length,
      latestScore:
        history.attempts.length > 0
          ? history.attempts[history.attempts.length - 1].evaluation.overallScore
          : null,
      severity:
        history.attempts.length > 0
          ? history.attempts[history.attempts.length - 1].evaluation.severity
          : null,
    };
  }

  return {
    summary,
    stageMetrics,
    exportedAt: Date.now(),
  };
}
