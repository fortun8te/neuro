/**
 * Intelligent Model Selector
 *
 * Automatically picks the right model based on task intent and context.
 * Routes to:
 *   - qwen3.5:2b (ultra-fast) for simple tasks
 *   - qwen3.5:4b (balanced) for typical tasks
 *   - qwen3.5:9b (high quality) for complex reasoning
 *   - nemotron-3-super:120b (best reasoning) for planning/routing
 *
 * Uses heuristics:
 *   1. Intent matching (keywords, question patterns)
 *   2. Context complexity (message length, nesting depth)
 *   3. Constraint satisfaction (reasoning budget, time sensitivity)
 */

import { getModelForStage } from './modelConfig';

// Model tiers mapped to actual model names
const MODEL_TIERS = {
  tiny: 'qwen3.5:0.8b',
  small: 'qwen3.5:2b',
  medium: 'qwen3.5:4b',
  large: 'qwen3.5:9b',
  xlarge: 'qwen3.5:27b',
} as const;

/** Get model for a smart tier (maps tier name to model) */
function getModelForSmartTier(tier: string): string {
  return (MODEL_TIERS as Record<string, string>)[tier] || getModelForStage('research');
}

export type ModelTier = keyof typeof MODEL_TIERS | 'fast' | 'balanced' | 'quality' | 'reasoning';

/**
 * Context information about the task
 */
export interface TaskContext {
  messageLength?: number;        // Character count of user message
  conversationLength?: number;   // Total characters in conversation history
  hasImages?: boolean;           // Whether message contains images
  hasCode?: boolean;             // Whether message contains code blocks
  previousFailure?: boolean;     // Whether previous attempt failed
  timeConstraint?: 'urgent' | 'normal' | 'patient';  // Time sensitivity
  requiresReasoning?: boolean;   // Needs thinking tokens / chain-of-thought
  requiresVision?: boolean;      // Needs image analysis capability
  customConstraints?: Record<string, any>;  // Additional task-specific constraints
}

/**
 * Intent classification for routing decisions
 */
interface IntentAnalysis {
  category: 'simple' | 'routine' | 'complex' | 'planning';
  confidence: number;  // 0-1, how sure we are about this classification
  reasoning: string;   // Human-readable explanation
}

/**
 * Analyze the intent of a task
 * Returns classification and confidence score
 */
function analyzeIntent(intent: string, context: TaskContext): IntentAnalysis {
  const lc = intent.toLowerCase().trim();

  // ─────────────────────────────────────────────────────────────
  // SIMPLE — ultra-fast 2b tasks
  // ─────────────────────────────────────────────────────────────
  // One-word acks
  if (/^(ok|yes|no|got it|thanks|sure|yep|nope)$/i.test(lc)) {
    return {
      category: 'simple',
      confidence: 0.95,
      reasoning: 'Single-word acknowledgment',
    };
  }

  // Status checks ("what time is it", "is X done?", "am i online?")
  if (/^(what|is|am|are|can|do).*\?$/.test(lc) && lc.length < 50) {
    if (/time|status|done|online|available|working/.test(lc)) {
      return {
        category: 'simple',
        confidence: 0.85,
        reasoning: 'Quick status question',
      };
    }
  }

  // Copy/paste operations
  if (/copy|paste|format|fix (the )?text|(make|add|remove) (a )?line/.test(lc) && lc.length < 60) {
    return {
      category: 'simple',
      confidence: 0.9,
      reasoning: 'Text formatting/copying',
    };
  }

  // One-liner edits
  if (/^(change|replace|rename|delete|add) /.test(lc) && lc.length < 80) {
    if (!lc.includes('entire') && !lc.includes('all ')) {
      return {
        category: 'simple',
        confidence: 0.8,
        reasoning: 'Single-file one-liner edit',
      };
    }
  }

  // Simple CLI commands
  if (/^(run|execute|start|stop|restart|ls|pwd|cd) /.test(lc) && lc.length < 100) {
    return {
      category: 'simple',
      confidence: 0.8,
      reasoning: 'Simple CLI command',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ROUTINE — balanced 4b tasks (default)
  // ─────────────────────────────────────────────────────────────
  // Code refactoring (rename vars, reorganize)
  if (/refactor|rename|reorganize|reorder|restructure/.test(lc) && lc.length < 150) {
    return {
      category: 'routine',
      confidence: 0.85,
      reasoning: 'Code refactoring task',
    };
  }

  // File operations (read, write, modify)
  if (/read|write|update|create|modify|edit (the |a )?file/.test(lc)) {
    if (!lc.includes('multiple') && !lc.includes('all')) {
      return {
        category: 'routine',
        confidence: 0.8,
        reasoning: 'Single/multi-file read/write',
      };
    }
  }

  // Simple bug fixes
  if (/fix (the |a |this )?bug|debug|there'?s an error/.test(lc) && lc.length < 150) {
    if (context.hasCode && context.messageLength && context.messageLength < 500) {
      return {
        category: 'routine',
        confidence: 0.75,
        reasoning: 'Simple bug fix (small code block)',
      };
    }
  }

  // Content generation (blogs, emails, summaries)
  if (/write|generate|create|draft|compose/.test(lc)) {
    const contentTypes = /blog|email|summary|description|title|headline|post|article/;
    if (contentTypes.test(lc) && lc.length < 200) {
      return {
        category: 'routine',
        confidence: 0.8,
        reasoning: 'Standard content generation',
      };
    }
  }

  // Data extraction / transformation
  if (/extract|parse|transform|convert|map|reorganize (data|information)/.test(lc)) {
    return {
      category: 'routine',
      confidence: 0.8,
      reasoning: 'Data extraction/transformation',
    };
  }

  // Research queries (normal complexity)
  if (/research|look up|find|search|what is|explain/.test(lc) && lc.length < 200) {
    return {
      category: 'routine',
      confidence: 0.75,
      reasoning: 'Standard research question',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // COMPLEX — high quality 9b tasks
  // ─────────────────────────────────────────────────────────────
  // Architecture decisions
  if (/architecture|design|system design|design pattern/.test(lc)) {
    return {
      category: 'complex',
      confidence: 0.9,
      reasoning: 'Architecture/design decision',
    };
  }

  // Deep code analysis
  if (/analyze|investigate|understand|what'?s wrong|why|how does/.test(lc) && context.hasCode) {
    if (context.messageLength && context.messageLength > 200) {
      return {
        category: 'complex',
        confidence: 0.85,
        reasoning: 'Deep code analysis',
      };
    }
  }

  // Complex bug investigation
  if (/bug|error|issue|problem|failing|broken/.test(lc) && context.hasCode) {
    if (context.messageLength && context.messageLength > 300) {
      return {
        category: 'complex',
        confidence: 0.8,
        reasoning: 'Complex multi-file bug investigation',
      };
    }
  }

  // Multi-file refactoring
  if (/refactor|reorganize|restructure/.test(lc) && context.messageLength && context.messageLength > 150) {
    return {
      category: 'complex',
      confidence: 0.8,
      reasoning: 'Multi-file refactoring',
    };
  }

  // Creative work (ads, copy, design)
  if (/create.*ad|write.*copy|design.*campaign|creative/.test(lc)) {
    return {
      category: 'complex',
      confidence: 0.85,
      reasoning: 'Creative content generation',
    };
  }

  // Long-form content
  if (/write|create|draft/.test(lc) && context.messageLength && context.messageLength > 200) {
    return {
      category: 'complex',
      confidence: 0.75,
      reasoning: 'Long-form content generation',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PLANNING — nemotron reasoning tasks
  // ─────────────────────────────────────────────────────────────
  // Tool/function selection
  if (/which (tool|function|api|service)|pick.*tool|route|call|use/.test(lc)) {
    return {
      category: 'planning',
      confidence: 0.9,
      reasoning: 'Tool selection / routing decision',
    };
  }

  // Planning & orchestration
  if (/plan|orchestrate|coordinate|strategy|workflow|process/.test(lc)) {
    return {
      category: 'planning',
      confidence: 0.85,
      reasoning: 'Planning / orchestration task',
    };
  }

  // Decision-making under ambiguity
  if (/decide|should|recommendation|best approach|tradeoff|constraint/.test(lc)) {
    if (context.messageLength && context.messageLength > 150) {
      return {
        category: 'planning',
        confidence: 0.8,
        reasoning: 'Decision-making with constraints',
      };
    }
  }

  // Complex problem solving
  if (/solve|tackle|approach|strategy|reason/.test(lc)) {
    if (context.conversationLength && context.conversationLength > 1000) {
      return {
        category: 'planning',
        confidence: 0.75,
        reasoning: 'Complex problem solving',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DEFAULT — use message length + context as tiebreaker
  // ─────────────────────────────────────────────────────────────
  if (!context.messageLength) {
    return {
      category: 'routine',
      confidence: 0.5,
      reasoning: 'Default (no message length provided)',
    };
  }

  if (context.messageLength < 50) {
    return {
      category: 'simple',
      confidence: 0.6,
      reasoning: 'Very short message',
    };
  }

  if (context.messageLength < 200) {
    return {
      category: 'routine',
      confidence: 0.6,
      reasoning: 'Medium-length message',
    };
  }

  if (context.messageLength > 1000) {
    return {
      category: 'complex',
      confidence: 0.6,
      reasoning: 'Long message with substantial content',
    };
  }

  return {
    category: 'routine',
    confidence: 0.5,
    reasoning: 'Fallback to balanced model',
  };
}

/**
 * Select the best tier for a task
 * Applies constraint satisfaction, time pressure, and recovery logic
 */
function selectTierForIntent(intent: string, context: TaskContext): ModelTier {
  const analysis = analyzeIntent(intent, context);

  // Special handling: vision tasks always need 9b minimum
  if (context.requiresVision || context.hasImages) {
    return 'quality';  // 9b minimum for vision
  }

  // Special handling: deep reasoning needs thinking tokens
  if (context.requiresReasoning && !context.timeConstraint || context.timeConstraint === 'patient') {
    return 'reasoning';  // nemotron for deep thinking
  }

  // Time pressure can override quality (e.g., urgent request with simple task)
  if (context.timeConstraint === 'urgent') {
    if (analysis.category === 'simple') return 'fast';  // 2b for urgency
    if (analysis.category === 'routine') return 'balanced';  // 4b for speed
    // For complex/planning under time pressure, still need quality
    return 'quality';
  }

  // Recovery from failure: escalate one tier
  if (context.previousFailure) {
    switch (analysis.category) {
      case 'simple':
        return 'balanced';  // 2b → 4b
      case 'routine':
        return 'quality';  // 4b → 9b
      case 'complex':
        return 'reasoning';  // 9b → nemotron
      case 'planning':
        return 'reasoning';  // stay at nemotron
    }
  }

  // Standard routing by intent category
  switch (analysis.category) {
    case 'simple':
      return 'fast';  // 2b
    case 'routine':
      return 'balanced';  // 4b (default)
    case 'complex':
      return 'quality';  // 9b
    case 'planning':
      return 'reasoning';  // nemotron
  }
}

/**
 * Get the actual model name for a tier
 * Wrapper around getModelForSmartTier from modelConfig
 * Used by stages/pipeline to get concrete model strings
 */
export function getModelForTier(tier: ModelTier): string {
  return getModelForSmartTier(tier as 'fast' | 'balanced' | 'quality' | 'reasoning');
}

/**
 * Main entry point: select the right model for a task
 *
 * Example usage:
 *   const model = selectModelForTask('refactor this function', { hasCode: true });
 *   // Returns: 'qwen3.5:4b'
 *
 *   const model = selectModelForTask('ok', {});
 *   // Returns: 'qwen3.5:2b'
 *
 *   const model = selectModelForTask('which tool should I use?', { conversationLength: 2000 });
 *   // Returns: 'nemotron-3-super:120b'
 */
export function selectModelForTask(intent: string, context: TaskContext = {}): string {
  const tier = selectTierForIntent(intent, context);
  const model = getModelForTier(tier);

  // Log selection for debugging (only in dev)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const analysis = analyzeIntent(intent, context);
    console.debug(
      '[SmartModelSelector]',
      `intent="${intent.slice(0, 50)}..."`,
      `category=${analysis.category}`,
      `tier=${tier}`,
      `model=${model}`,
      `confidence=${analysis.confidence.toFixed(2)}`
    );
  }

  return model;
}

/**
 * Get routing details for debugging
 * Returns the analysis + selected tier + model
 */
export function analyzeModelSelection(intent: string, context: TaskContext = {}) {
  const analysis = analyzeIntent(intent, context);
  const tier = selectTierForIntent(intent, context);
  const model = getModelForTier(tier);

  return {
    intent: intent.slice(0, 100),
    analysis,
    selectedTier: tier,
    selectedModel: model,
    context: {
      messageLength: context.messageLength,
      conversationLength: context.conversationLength,
      hasImages: context.hasImages,
      hasCode: context.hasCode,
      timeConstraint: context.timeConstraint,
    },
  };
}

/**
 * Stage-to-tier mapping for pipeline stages
 * Used by useCycleLoop and related orchestrators
 *
 * Format: { stageName: 'tier' }
 * This allows stages to declare their ideal tier, which can be overridden
 * by runtime smart selection if needed.
 */
export const STAGE_TIER_HINTS: Record<string, ModelTier> = {
  // Fast/Simple tiers
  'fast': 'fast',
  'compression': 'fast',
  'verify-state': 'fast',

  // Balanced tier (default for most work)
  'router': 'balanced',
  'intent-classify': 'balanced',
  'research': 'balanced',
  'executor': 'balanced',

  // Quality tier (9b) for complex reasoning
  'orchestrator': 'quality',
  'reflection': 'quality',
  'thinking': 'quality',
  'planner': 'quality',
  'vision': 'quality',
  'brand-dna': 'quality',
  'persona-dna': 'quality',

  // Reasoning tier (nemotron) for planning/tool selection
  'tool-selection': 'reasoning',
  'routing': 'reasoning',
  'deep-analysis': 'reasoning',
  'architecture': 'reasoning',
};

/**
 * Get the recommended tier for a stage
 * Falls back to 'balanced' if stage not configured
 */
export function getTierForStage(stageName: string): ModelTier {
  return STAGE_TIER_HINTS[stageName] || 'balanced';
}
