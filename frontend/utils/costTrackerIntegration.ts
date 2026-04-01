/**
 * costTrackerIntegration.ts — Integration points for cost tracking with the harness executor
 *
 * Provides hooks for the executor to report token usage and cost events.
 * Should be called after tool execution completes.
 */

import { costTracker } from './costTracker';

/**
 * Record a tool execution's cost.
 * Returns true if execution should continue, false if hard limit exceeded.
 */
export function recordToolCost(
  tokensUsed: number,
  model: string,
  toolName?: string
): boolean {
  return costTracker.recordUsage(tokensUsed, model, toolName);
}

/**
 * Check if a tool execution would exceed the hard limit BEFORE executing.
 * Use this to pre-check costs.
 */
export function canExecuteTool(estimatedTokens: number): boolean {
  return !costTracker.wouldExceedHardLimit(estimatedTokens);
}

/**
 * Get a user-friendly message about current cost status.
 */
export function getCostStatusMessage(): string {
  const usage = costTracker.getUsage();
  const config = costTracker.getConfig();
  const percentage = costTracker.getUsagePercentage();

  if (percentage >= 100) {
    return `Hard limit exceeded: ${usage.totalTokens.toLocaleString()} / ${config.hardLimitTokens.toLocaleString()} tokens`;
  }

  if (percentage >= 80) {
    return `Warning: 80% of budget used (${usage.totalTokens.toLocaleString()} / ${config.hardLimitTokens.toLocaleString()} tokens)`;
  }

  return `Budget usage: ${percentage.toFixed(1)}% (${usage.totalTokens.toLocaleString()} tokens)`;
}

/**
 * Hook for the harness executor to call after tool execution.
 * Extracts token count from Ollama response metadata.
 */
export function handleToolExecutionComplete(
  toolName: string,
  model: string,
  result: {
    usage?: { output_tokens?: number; input_tokens?: number; total_tokens?: number };
    eval_count?: number; // Ollama's token count
  }
): boolean {
  const tokens = result.eval_count || result.usage?.total_tokens || 0;

  if (tokens > 0) {
    return recordToolCost(tokens, model, toolName);
  }

  return true; // No tokens tracked, continue
}
