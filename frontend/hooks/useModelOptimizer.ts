/**
 * useModelOptimizer — Automatically select optimal model for each task
 * Reduces cost by using 4b when possible, escalates to 9b when needed
 */

import { useCallback } from 'react';
import { optimizeModel, shouldEscalateToNine, getModelTierForPreset } from '../utils/modelOptimizer';

export function useModelOptimizer() {
  /**
   * Select model for a chat message
   */
  const selectModelForChat = useCallback((
    input: string,
    messageCount: number = 0,
    userQualityRequest: boolean = false,
  ): { model: string; reasoning: string } => {
    const result = optimizeModel({
      input,
      messageCount,
      taskType: 'chat',
      userQualityRequest,
    });

    // Log selection for debugging
    console.debug(`[ModelOptimizer] Chat: ${result.complexity} → ${result.selectedModel}`, {
      reasoning: result.reasoning,
      inputLength: input.length,
      messageCount,
    });

    return {
      model: result.selectedModel,
      reasoning: result.reasoning,
    };
  }, []);

  /**
   * Select model for code execution task
   */
  const selectModelForCode = useCallback((input: string): string => {
    const result = optimizeModel({
      input,
      taskType: 'code',
      hasCode: true,
    });

    console.debug(`[ModelOptimizer] Code: ${result.selectedModel}`, {
      reasoning: result.reasoning,
    });

    return result.selectedModel;
  }, []);

  /**
   * Select model for research task
   */
  const selectModelForResearch = useCallback((
    query: string,
    preset: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX' = 'NR',
  ): { orchestrator: string; researcher: string; synthesis: string } => {
    const tier = getModelTierForPreset(preset);

    console.debug(`[ModelOptimizer] Research (${preset}):`, {
      orchestrator: tier.capable,
      researcher: tier.fast,
      synthesis: tier.capable,
    });

    return {
      orchestrator: tier.capable,  // Orchestrator needs capability
      researcher: tier.fast,        // Researchers can be faster/smaller
      synthesis: tier.capable,      // Synthesis needs quality
    };
  }, []);

  /**
   * Check if we should escalate to 9b after failure
   */
  const checkEscalation = useCallback((
    previousModel: string,
    error?: string,
  ): boolean => {
    const should = shouldEscalateToNine(error, previousModel);

    if (should) {
      console.warn(`[ModelOptimizer] Escalating from ${previousModel} to 9b due to:`, error);
    }

    return should;
  }, []);

  /**
   * Get preferred model size based on context
   */
  const getPreferredSize = useCallback((
    complexity: 'simple' | 'moderate' | 'complex',
  ): string => {
    switch (complexity) {
      case 'simple':
        return 'qwen3.5:2b';   // Fastest, good for trivial tasks
      case 'moderate':
        return 'qwen3.5:4b';   // Balance of speed and capability
      case 'complex':
        return 'qwen3.5:9b';   // Best quality
    }
  }, []);

  return {
    selectModelForChat,
    selectModelForCode,
    selectModelForResearch,
    checkEscalation,
    getPreferredSize,
  };
}
