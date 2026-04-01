/**
 * NEURO ENHANCED ROUTING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Replaces keyword-based routing with semantic vector-based routing.
 * Leverages Context-1 for:
 * - Intent classification via embeddings
 * - Tool selection via hybrid scoring
 * - Memory of past decisions
 * - Dynamic tool availability based on tokens
 * - Confidence-aware execution
 */

import { semanticRouter, detectIntent, compressContext } from './neuroContext';
import { createLogger } from './logger';

const log = createLogger('neuro-enhanced-routing');

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED ROUTING DECISION MAKER
// ═══════════════════════════════════════════════════════════════════════════

export interface RoutingPhase {
  phase: string;
  decision: string;
  confidence: number;
  model?: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface EnhancedRoutingResult {
  selectedTool: string | null;
  shouldRespond: boolean;
  confidence: number;
  reasoning: string;
  phases: RoutingPhase[];
  totalDurationMs: number;
  memoryInsights?: string;
  tokenBudgetRemaining?: number;
}

export class NeuroEnhancedRouter {
  private tokenBudget: number = 8000;
  private tokensUsed: number = 0;

  /**
   * Make a routing decision using semantic analysis
   */
  async route(
    userMessage: string,
    availableTools: string[],
    context?: string,
    currentTokens?: number
  ): Promise<EnhancedRoutingResult> {
    const startTime = Date.now();
    const phases: RoutingPhase[] = [];

    try {
      // Update token tracking
      if (currentTokens !== undefined) {
        this.tokensUsed = currentTokens;
      }

      const tokenBudgetRemaining = this.tokenBudget - this.tokensUsed;

      // PHASE 1: Intent Detection
      const intentPhaseStart = Date.now();
      const intentResult = await detectIntent(userMessage);
      phases.push({
        phase: 'intent-detection',
        decision: `${intentResult.category.toUpperCase()} (confidence: ${(intentResult.confidence * 100).toFixed(0)}%)`,
        confidence: intentResult.confidence,
        durationMs: Date.now() - intentPhaseStart,
      });

      // PHASE 2: Check if direct response is needed
      const directResponseNeeded = this.shouldRespondDirectly(userMessage);
      if (directResponseNeeded) {
        phases.push({
          phase: 'direct-response-check',
          decision: 'User needs direct answer, skip tools',
          confidence: 0.9,
          durationMs: 0,
        });

        return {
          selectedTool: null,
          shouldRespond: true,
          confidence: 0.9,
          reasoning: 'User query requires direct response',
          phases,
          totalDurationMs: Date.now() - startTime,
          tokenBudgetRemaining,
        };
      }

      phases.push({
        phase: 'direct-response-check',
        decision: 'Tool execution needed',
        confidence: 0.8,
        durationMs: 0,
      });

      // PHASE 3: Check token budget
      const budgetPhaseStart = Date.now();
      const minToolTokens = 100;

      if (tokenBudgetRemaining < minToolTokens) {
        phases.push({
          phase: 'token-budget-check',
          decision: `SOFT WARNING: Only ${tokenBudgetRemaining} tokens left (< ${minToolTokens})`,
          confidence: 1.0,
          durationMs: Date.now() - budgetPhaseStart,
        });

        log.warn('Token budget approaching limit', {
          used: this.tokensUsed,
          budget: this.tokenBudget,
        });
      } else {
        phases.push({
          phase: 'token-budget-check',
          decision: `Budget OK: ${tokenBudgetRemaining}/${this.tokenBudget} tokens available`,
          confidence: 1.0,
          durationMs: Date.now() - budgetPhaseStart,
        });
      }

      // PHASE 4: Tool Selection via Semantic Routing
      const toolPhaseStart = Date.now();
      const availableToolsFiltered = availableTools.filter(tool => {
        // Rough token estimate per tool
        const estimates: Record<string, number> = {
          web_search: 300,
          multi_browse: 400,
          workspace_save: 50,
          workspace_read: 150,
          think: 100,
          search_knowledge: 250,
        };
        const needed = estimates[tool] || 150;
        return needed < tokenBudgetRemaining * 0.8; // Reserve 20% buffer
      });

      const decisionContext = await semanticRouter.decideTools(
        userMessage,
        intentResult.intent,
        availableToolsFiltered.length > 0 ? availableToolsFiltered : availableTools,
        tokenBudgetRemaining
      );

      const selectedTool = decisionContext.recommendedTools[0]?.toolName || null;
      const toolConfidence =
        decisionContext.recommendedTools[0]?.confidence || 0;

      phases.push({
        phase: 'tool-selection',
        decision: selectedTool
          ? `Selected: ${selectedTool} (confidence: ${(toolConfidence * 100).toFixed(0)}%)`
          : 'No suitable tool found',
        confidence: toolConfidence,
        metadata: {
          recommendedTools: decisionContext.recommendedTools.map(t => ({
            name: t.toolName,
            confidence: t.confidence,
          })),
        },
        durationMs: Date.now() - toolPhaseStart,
      });

      // PHASE 5: Memory-based refinement
      const memoryPhaseStart = Date.now();
      const contextMemories = decisionContext.pastSimilarDecisions;
      let memoryInsights: string | undefined;

      if (contextMemories.length > 0) {
        const successfulUses = contextMemories.filter(m => m.confidence > 0.7);
        if (successfulUses.length > 0) {
          memoryInsights = `Learned from ${successfulUses.length} past successful decisions`;
        }
      }

      phases.push({
        phase: 'memory-refinement',
        decision: memoryInsights || 'No relevant past decisions',
        confidence: contextMemories.length > 0 ? 0.85 : 0.5,
        durationMs: Date.now() - memoryPhaseStart,
      });

      // PHASE 6: Confidence check
      const confidenceThreshold = 0.4;
      const shouldProceed = toolConfidence >= confidenceThreshold;

      phases.push({
        phase: 'confidence-check',
        decision: shouldProceed
          ? `Confidence ${(toolConfidence * 100).toFixed(0)}% >= threshold ${(confidenceThreshold * 100).toFixed(0)}%`
          : `Confidence ${(toolConfidence * 100).toFixed(0)}% < threshold`,
        confidence: shouldProceed ? 0.95 : 0.5,
        durationMs: 0,
      });

      // Record this decision in memory
      if (selectedTool) {
        await semanticRouter.getMemoryStore().addMemory(
          `Routed "${userMessage.slice(0, 50)}..." → ${selectedTool}`,
          'decision',
          toolConfidence
        );
      }

      return {
        selectedTool: shouldProceed ? selectedTool : null,
        shouldRespond: !shouldProceed,
        confidence: toolConfidence,
        reasoning: `Intent: ${intentResult.category}, Selected: ${selectedTool || 'respond directly'}`,
        phases,
        totalDurationMs: Date.now() - startTime,
        memoryInsights,
        tokenBudgetRemaining,
      };
    } catch (err) {
      log.error('Enhanced routing failed', {}, err);

      // Fallback: return first available tool
      return {
        selectedTool: availableTools[0] || null,
        shouldRespond: !availableTools[0],
        confidence: 0.3,
        reasoning: 'Fallback routing due to error',
        phases,
        totalDurationMs: Date.now() - startTime,
        tokenBudgetRemaining: this.tokenBudget - this.tokensUsed,
      };
    }
  }

  /**
   * Determine if direct response is needed (no tools)
   */
  private shouldRespondDirectly(message: string): boolean {
    const directPatterns = [
      /^(hello|hi|hey|thanks|thank you|good|okay|ok|sure|yes|no)\b/i,
      /\?$/, // Questions often need tools, but short ones don't
      /^(who are you|what are you|tell me about yourself)/i,
      /^(explain|describe|clarify)\b/i,
    ];

    // Short messages without specific queries
    if (message.length < 20 && !message.includes('?')) {
      return true;
    }

    return directPatterns.some(p => p.test(message));
  }

  /**
   * Update token budget
   */
  setTokenBudget(budget: number): void {
    this.tokenBudget = budget;
    log.info('Token budget updated', { budget });
  }

  /**
   * Consume tokens
   */
  consumeTokens(amount: number): number {
    this.tokensUsed += amount;
    const remaining = this.tokenBudget - this.tokensUsed;
    log.debug('Tokens consumed', {
      consumed: amount,
      total: this.tokensUsed,
      remaining,
    });
    return remaining;
  }

  /**
   * Get remaining token budget
   */
  getRemainingBudget(): number {
    return this.tokenBudget - this.tokensUsed;
  }

  /**
   * Reset tokens
   */
  resetTokens(): void {
    this.tokensUsed = 0;
    log.info('Tokens reset');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const neuroEnhancedRouter = new NeuroEnhancedRouter();
