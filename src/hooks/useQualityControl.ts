import { useCallback, useRef } from 'react';
import type { StageName, StageData, Cycle } from '../types';
import {
  evaluateStageQuality,
  canRetry,
  generateRetryConfig,
  type QualityEvaluation,
  type RetryContext,
} from '../utils/qualityEvaluator';
import { getModelForStage } from '../utils/modelConfig';

/**
 * Quality Control Hook
 * - Evaluates stage output quality
 * - Manages auto-retry with feedback injection
 * - Tracks retry history in cycle
 */

export interface RetryHistory {
  attempt: number;
  timestamp: number;
  evaluation: QualityEvaluation;
  model: string;
  temperature: number;
  status: 'retried' | 'passed' | 'failed';
}

export interface QualityControlState {
  retryHistory: RetryHistory[];
  currentAttempt: number;
  lastEvaluation?: QualityEvaluation;
}

interface UseQualityControlOptions {
  maxRetries?: number;
  timeoutMinutes?: number;
  enableAutoRetry?: boolean;
}

export function useQualityControl(options: UseQualityControlOptions = {}) {
  const {
    maxRetries = 3,
    timeoutMinutes = 30,
    enableAutoRetry = true,
  } = options;

  const qualityStateRef = useRef<Map<StageName, QualityControlState>>(
    new Map(),
  );

  /**
   * Initialize quality state for a stage
   */
  const initializeStageQuality = useCallback((stageName: StageName) => {
    if (!qualityStateRef.current.has(stageName)) {
      qualityStateRef.current.set(stageName, {
        retryHistory: [],
        currentAttempt: 1,
      });
    }
  }, []);

  /**
   * Evaluate stage output and determine retry need
   */
  const evaluateAndDecideRetry = useCallback(
    async (
      stageName: StageName,
      stageData: StageData,
      cycle: Cycle,
      previousContext?: string,
    ): Promise<{
      evaluation: QualityEvaluation;
      shouldRetry: boolean;
      reason: string;
    }> => {
      initializeStageQuality(stageName);
      const state = qualityStateRef.current.get(stageName)!;

      // Evaluate quality
      const evaluation = await evaluateStageQuality(
        stageName,
        stageData,
        previousContext,
      );
      state.lastEvaluation = evaluation;

      // Store evaluation in retry history
      state.retryHistory.push({
        attempt: state.currentAttempt,
        timestamp: Date.now(),
        evaluation,
        model: stageData.model || getModelForStage(stageName),
        temperature: 0.7, // default, would be tracked in actual implementation
        status: evaluation.shouldRetry ? 'retried' : 'passed',
      });

      // Decide if retry is needed and possible
      if (!enableAutoRetry || !evaluation.shouldRetry) {
        return {
          evaluation,
          shouldRetry: false,
          reason: 'Quality evaluation passed or auto-retry disabled',
        };
      }

      // Check retry constraints
      const retryContext: RetryContext = {
        currentRetryCount: state.currentAttempt - 1,
        maxRetries,
        currentTemperature: 0.7,
        currentModel: stageData.model || getModelForStage(stageName),
        availableModels: getAvailableModelsForStage(stageName),
        timeoutMinutes,
        elapsedSeconds: stageData.processingTime
          ? stageData.processingTime / 1000
          : 10,
      };

      const canRetryResult = canRetry(retryContext);
      if (!canRetryResult.canRetry) {
        return {
          evaluation,
          shouldRetry: false,
          reason: canRetryResult.reason || 'Retry constraints not met',
        };
      }

      return {
        evaluation,
        shouldRetry: true,
        reason: `Quality score ${evaluation.overallScore}/100 below threshold ${evaluation.severity === 'critical' ? '(critical)' : '(warning)'}`,
      };
    },
    [enableAutoRetry, maxRetries, timeoutMinutes, initializeStageQuality],
  );

  /**
   * Get retry configuration for next attempt
   */
  const getRetryConfig = useCallback(
    (stageName: StageName, stageData: StageData) => {
      const state = qualityStateRef.current.get(stageName);
      if (!state || !state.lastEvaluation) {
        return null;
      }

      const retryContext: RetryContext = {
        currentRetryCount: state.currentAttempt - 1,
        maxRetries,
        currentTemperature: 0.7,
        currentModel: stageData.model || getModelForStage(stageName),
        availableModels: getAvailableModelsForStage(stageName),
        timeoutMinutes,
        elapsedSeconds: stageData.processingTime
          ? stageData.processingTime / 1000
          : 10,
      };

      return generateRetryConfig(state.lastEvaluation, retryContext);
    },
    [maxRetries, timeoutMinutes],
  );

  /**
   * Record retry attempt
   */
  const recordRetryAttempt = useCallback(
    (stageName: StageName, success: boolean) => {
      const state = qualityStateRef.current.get(stageName);
      if (state) {
        state.currentAttempt += 1;
        if (state.retryHistory.length > 0) {
          const lastHistory = state.retryHistory[state.retryHistory.length - 1];
          lastHistory.status = success ? 'passed' : 'failed';
        }
      }
    },
    [],
  );

  /**
   * Get quality metrics for cycle
   */
  const getCycleQualityMetrics = useCallback(
    (cycle: Cycle): Partial<Record<StageName, QualityControlState>> => {
      const metrics: Partial<Record<StageName, QualityControlState>> = {};
      const stages: StageName[] = [
        'research',
        'brand-dna',
        'persona-dna',
        'angles',
        'strategy',
        'copywriting',
        'production',
        'test',
      ];

      for (const stage of stages) {
        metrics[stage] = qualityStateRef.current.get(stage);
      }
      return metrics;
    },
    [],
  );

  /**
   * Reset quality state for stage
   */
  const resetStageQuality = useCallback((stageName: StageName) => {
    qualityStateRef.current.delete(stageName);
  }, []);

  /**
   * Clear all quality state
   */
  const clearAllQuality = useCallback(() => {
    qualityStateRef.current.clear();
  }, []);

  return {
    initializeStageQuality,
    evaluateAndDecideRetry,
    getRetryConfig,
    recordRetryAttempt,
    getCycleQualityMetrics,
    resetStageQuality,
    clearAllQuality,
  };
}

/**
 * Get available models for stage (for retry model selection)
 */
function getAvailableModelsForStage(stageName: StageName): string[] {
  // Models available for upgrade/retry purposes
  const modelTiers = {
    'qwen3.5:2b': 1,
    'qwen3.5:4b': 2,
    'qwen3.5:9b': 3,
    'qwen3.5:27b': 4,
    'nemotron-3-super:120b': 5,
  };

  // Return all available models
  return Object.keys(modelTiers).sort(
    (a, b) => modelTiers[b as keyof typeof modelTiers] - modelTiers[a as keyof typeof modelTiers],
  );
}
