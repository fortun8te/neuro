/**
 * useToolBenchmark — Test tool execution capability and auto-fix issues
 */

import { useCallback, useRef, useState } from 'react';
import {
  benchmarkTool,
  benchmarkToolCapability,
  quickToolCheck,
  needsToolCallingImprovement,
  getToolCallingRecommendations,
  type ToolCapabilityScore,
  type BenchmarkResult,
} from '../utils/toolBenchmark';

export function useToolBenchmark() {
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const benchmarkCacheRef = useRef<Map<string, ToolCapabilityScore>>(new Map());

  /**
   * Quick capability check for tools (< 5s total)
   */
  const quickCheck = useCallback(async (
    toolNames: string[],
    executorFn: (tool: string, input: any) => Promise<any>,
  ): Promise<ToolCapabilityScore | null> => {
    try {
      setIsRunning(true);

      // Check cache first
      const cacheKey = toolNames.sort().join(':');
      const cached = benchmarkCacheRef.current.get(cacheKey);
      if (cached) {
        console.debug('[ToolBenchmark] Using cached results');
        return cached;
      }

      const score = await quickToolCheck(toolNames, executorFn);

      // Cache for 5 minutes
      benchmarkCacheRef.current.set(cacheKey, score);
      setTimeout(() => benchmarkCacheRef.current.delete(cacheKey), 5 * 60_000);

      console.debug('[ToolBenchmark] Quick check complete:', {
        canCallTools: score.canCallTools,
        successRate: score.successRate.toFixed(1) + '%',
        avgLatency: score.avgLatencyMs.toFixed(0) + 'ms',
      });

      return score;
    } finally {
      setIsRunning(false);
    }
  }, []);

  /**
   * Comprehensive benchmark for tools
   */
  const fullBenchmark = useCallback(async (
    toolNames: string[],
    executorFn: (tool: string, input: any) => Promise<any>,
  ): Promise<ToolCapabilityScore | null> => {
    try {
      setIsRunning(true);

      const score = await benchmarkToolCapability(toolNames, executorFn);

      // Store results
      setBenchmarkResults(score.details);

      console.debug('[ToolBenchmark] Full benchmark complete:', {
        toolCount: toolNames.length,
        overallSuccessRate: score.successRate.toFixed(1) + '%',
        avgLatency: score.avgLatencyMs.toFixed(0) + 'ms',
      });

      return score;
    } finally {
      setIsRunning(false);
    }
  }, []);

  /**
   * Benchmark single tool
   */
  const benchmarkSingleTool = useCallback(async (
    toolName: string,
    executorFn: (tool: string, input: any) => Promise<any>,
  ): Promise<BenchmarkResult | null> => {
    try {
      setIsRunning(true);

      const result = await benchmarkTool(toolName, executorFn);

      console.debug(`[ToolBenchmark] ${toolName}:`, {
        successRate: result.successRate.toFixed(1) + '%',
        avgLatency: result.avgLatency.toFixed(0) + 'ms',
        errors: result.errors,
      });

      return result;
    } finally {
      setIsRunning(false);
    }
  }, []);

  /**
   * Check if tool calling needs improvement and get recommendations
   */
  const analyzeToolCalling = useCallback((score: ToolCapabilityScore) => {
    const needsImprovement = needsToolCallingImprovement(score);
    const recommendations = getToolCallingRecommendations(score);

    return {
      needsImprovement,
      recommendations,
      currentModel: score.recommendedModel,
    };
  }, []);

  /**
   * Auto-run tool capability check before using tools
   * Returns true if tools are ready, false if not ready or error
   */
  const checkBeforeToolUse = useCallback(async (
    toolNames: string[],
    executorFn: (tool: string, input: any) => Promise<any>,
  ): Promise<boolean> => {
    try {
      const score = await quickCheck(toolNames, executorFn);
      if (!score) return false;

      if (!score.canCallTools) {
        console.warn('[ToolBenchmark] Tools not ready:', {
          successRate: score.successRate.toFixed(1) + '%',
          recommendations: getToolCallingRecommendations(score),
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ToolBenchmark] Check failed:', error);
      return false;
    }
  }, [quickCheck]);

  /**
   * Clear benchmark cache
   */
  const clearCache = useCallback(() => {
    benchmarkCacheRef.current.clear();
    setBenchmarkResults([]);
  }, []);

  return {
    // Methods
    quickCheck,
    fullBenchmark,
    benchmarkSingleTool,
    analyzeToolCalling,
    checkBeforeToolUse,
    clearCache,

    // State
    isRunning,
    benchmarkResults,
  };
}
