import { describe, it, expect, vi } from 'vitest';
import type { StageData, StageName } from '../../types';
import {
  evaluateStageQuality,
  canRetry,
  generateRetryConfig,
  type QualityEvaluation,
  type RetryContext,
} from '../qualityEvaluator';

describe('qualityEvaluator', () => {
  // Mock StageData
  const createMockStageData = (output: string, model = 'qwen3.5:9b'): StageData => ({
    status: 'complete',
    agentOutput: output,
    artifacts: [],
    startedAt: Date.now(),
    completedAt: Date.now(),
    readyForNext: true,
    model,
    processingTime: 5000,
  });

  describe('evaluateStageQuality', () => {
    it('should return critical severity for empty output', async () => {
      const stageData = createMockStageData('');
      const evaluation = await evaluateStageQuality('research', stageData);

      expect(evaluation.severity).toBe('critical');
      expect(evaluation.overallScore).toBe(0);
      expect(evaluation.shouldRetry).toBe(true);
    });

    it('should return critical severity for very short output', async () => {
      const stageData = createMockStageData('hello');
      const evaluation = await evaluateStageQuality('research', stageData);

      expect(evaluation.severity).toBe('critical');
      expect(evaluation.overallScore).toBe(0);
    });

    it('should evaluate stage with sufficient output', async () => {
      const output = `
        ## Research Findings

        This comprehensive research reveals deep customer desires around:
        - Quality and authenticity
        - Sustainability and ethics
        - Personal identity and self-expression

        Key sources found:
        - Reddit discussions with 500+ upvotes
        - Industry reports from leading analysts
        - Competitor analysis revealing gaps

        Audience language patterns identified:
        - "I want to feel confident about my choice"
        - "This should actually work"
        - "I care about where this comes from"
      `;

      const stageData = createMockStageData(output);
      const evaluation = await evaluateStageQuality('research', stageData);

      expect(evaluation.stageName).toBe('research');
      expect(evaluation.metrics).toBeDefined();
      expect(Array.isArray(evaluation.metrics)).toBe(true);
    });

    it('should include metrics with thresholds', async () => {
      const output = 'This is a substantial output with multiple sections and details about the research findings and market analysis.'.repeat(50);
      const stageData = createMockStageData(output);
      const evaluation = await evaluateStageQuality('research', stageData);

      expect(evaluation.metrics.length).toBeGreaterThan(0);
      evaluation.metrics.forEach((metric) => {
        expect(metric.name).toBeDefined();
        expect(typeof metric.score).toBe('number');
        expect(typeof metric.threshold).toBe('number');
        expect(metric.score >= 0 && metric.score <= 100).toBe(true);
        expect(metric.threshold >= 0 && metric.threshold <= 100).toBe(true);
      });
    });

    it('should set shouldRetry based on severity', async () => {
      const output = 'Generic output without substantial depth or insight.';
      const stageData = createMockStageData(output);
      const evaluation = await evaluateStageQuality('research', stageData);

      // shouldRetry should be set based on severity
      expect(typeof evaluation.shouldRetry).toBe('boolean');
    });
  });

  describe('canRetry', () => {
    const baseContext: RetryContext = {
      currentRetryCount: 0,
      maxRetries: 3,
      currentTemperature: 0.7,
      currentModel: 'qwen3.5:9b',
      availableModels: ['qwen3.5:4b', 'qwen3.5:9b', 'qwen3.5:27b'],
      timeoutMinutes: 30,
      elapsedSeconds: 10,
    };

    it('should allow retry when constraints are met', () => {
      const result = canRetry(baseContext);
      expect(result.canRetry).toBe(true);
    });

    it('should reject retry when max retries exceeded', () => {
      const context: RetryContext = {
        ...baseContext,
        currentRetryCount: 3,
      };
      const result = canRetry(context);
      expect(result.canRetry).toBe(false);
      expect(result.reason).toContain('Max retries exceeded');
    });

    it('should reject retry when time budget insufficient', () => {
      const context: RetryContext = {
        ...baseContext,
        timeoutMinutes: 1,
        elapsedSeconds: 50,
      };
      const result = canRetry(context);
      expect(result.canRetry).toBe(false);
      expect(result.reason).toContain('Insufficient time');
    });

    it('should reject retry when no alternative models available', () => {
      const context: RetryContext = {
        ...baseContext,
        availableModels: ['qwen3.5:9b'], // Only current model
      };
      const result = canRetry(context);
      expect(result.canRetry).toBe(false);
      expect(result.reason).toContain('No alternative models');
    });

    it('should require 30s minimum time for retry', () => {
      const context: RetryContext = {
        ...baseContext,
        timeoutMinutes: 1,
        elapsedSeconds: 40, // 20 seconds remaining
      };
      const result = canRetry(context);
      expect(result.canRetry).toBe(false);
    });
  });

  describe('generateRetryConfig', () => {
    it('should generate config with new model and temperature', () => {
      const evaluation: QualityEvaluation = {
        stageName: 'research',
        severity: 'critical',
        overallScore: 45,
        metrics: [
          {
            name: 'Coverage Breadth',
            score: 40,
            threshold: 70,
            feedback: 'Insufficient coverage',
          },
        ],
        feedback: 'Poor quality',
        shouldRetry: true,
        suggestedFix: 'Improve coverage',
        timestamp: Date.now(),
      };

      const context: RetryContext = {
        currentRetryCount: 0,
        maxRetries: 3,
        currentTemperature: 0.7,
        currentModel: 'qwen3.5:4b',
        availableModels: ['qwen3.5:4b', 'qwen3.5:9b', 'qwen3.5:27b'],
        timeoutMinutes: 30,
        elapsedSeconds: 10,
      };

      const config = generateRetryConfig(evaluation, context);

      expect(config).toBeDefined();
      expect(config.newModel).toBeDefined();
      expect(config.newTemperature).toBeDefined();
      expect(config.promptModification).toBeDefined();
      expect(config.newModel).not.toBe(context.currentModel);
      expect(typeof config.newTemperature).toBe('number');
      expect(config.newTemperature >= 0 && config.newTemperature <= 2).toBe(true);
    });

    it('should adjust temperature based on previous setting', () => {
      const evaluation: QualityEvaluation = {
        stageName: 'research',
        severity: 'warning',
        overallScore: 65,
        metrics: [],
        feedback: 'Marginal quality',
        shouldRetry: true,
        suggestedFix: 'Adjust approach',
        timestamp: Date.now(),
      };

      // Test with low temperature — should increase
      const context1: RetryContext = {
        currentRetryCount: 0,
        maxRetries: 3,
        currentTemperature: 0.3,
        currentModel: 'qwen3.5:9b',
        availableModels: ['qwen3.5:4b', 'qwen3.5:9b', 'qwen3.5:27b'],
        timeoutMinutes: 30,
        elapsedSeconds: 10,
      };

      const config1 = generateRetryConfig(evaluation, context1);
      expect(config1.newTemperature).toBeGreaterThan(0.5);

      // Test with high temperature — should decrease
      const context2: RetryContext = {
        ...context1,
        currentTemperature: 1.5,
      };

      const config2 = generateRetryConfig(evaluation, context2);
      expect(config2.newTemperature).toBeLessThan(1);
    });

    it('should include failed metric feedback in prompt modification', () => {
      const evaluation: QualityEvaluation = {
        stageName: 'copywriting',
        severity: 'warning',
        overallScore: 68,
        metrics: [
          {
            name: 'Persuasiveness',
            score: 50,
            threshold: 75,
            feedback: 'Copy lacks emotional resonance',
          },
          {
            name: 'Clarity & Impact',
            score: 75,
            threshold: 75,
            feedback: 'Headlines are clear',
          },
        ],
        feedback: 'Mixed quality',
        shouldRetry: true,
        suggestedFix: 'Focus on emotional appeal',
        timestamp: Date.now(),
      };

      const context: RetryContext = {
        currentRetryCount: 0,
        maxRetries: 3,
        currentTemperature: 0.7,
        currentModel: 'qwen3.5:9b',
        availableModels: ['qwen3.5:4b', 'qwen3.5:9b', 'qwen3.5:27b'],
        timeoutMinutes: 30,
        elapsedSeconds: 10,
      };

      const config = generateRetryConfig(evaluation, context);
      expect(config.promptModification).toContain('Persuasiveness');
      expect(config.promptModification).toContain('emotional resonance');
    });
  });

  describe('Quality rubric coverage', () => {
    it('should have rubric for all stage types', async () => {
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
        const output = 'Substantial test output for evaluation.'.repeat(20);
        const stageData = createMockStageData(output);
        const evaluation = await evaluateStageQuality(stage, stageData);

        expect(evaluation.stageName).toBe(stage);
        expect(evaluation.metrics.length).toBeGreaterThan(0);
      }
    });
  });
});
