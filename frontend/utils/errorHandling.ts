/**
 * Unified Error Handling System
 *
 * Integrates browser automation diagnostics + agent system recovery orchestration.
 * Two-tier approach:
 *
 * TACTICAL LAYER (Browser Automation):
 * - Element matching via fuzzy text similarity (Dice coefficient + bigram analysis)
 * - Diagnosis for specific action failures (click, input, navigate)
 * - Recovery strategies: scroll, dismiss overlay, retry at coordinates, find alternative element
 *
 * STRATEGIC LAYER (Agent Systems):
 * - Error classification (network, timeout, model, element, parsing, unknown)
 * - Recovery orchestration (retry, fallback_model, graceful_degrade, abort, log_and_continue)
 * - Used across agentEngine, planActAgent, subagentManager
 *
 * Flow: Try action → fail → classify error → get recovery decision → execute strategy
 */

import type { ElementInfo } from './sandboxService';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — Tactical Layer (Browser Automation)
// ═══════════════════════════════════════════════════════════════════════════

export interface RecoveryContext {
  action: string;
  targetIndex?: number;
  targetText?: string;
  error: string;
  pageUrl: string;
  pageTitle: string;
  attemptCount: number;
  elements?: ElementInfo[];
}

export interface BrowserRecoveryStrategy {
  type:
    | 'retry'
    | 'alternative_element'
    | 'scroll_and_retry'
    | 'wait_and_retry'
    | 'navigate_back'
    | 'refresh'
    | 'skip'
    | 'abort';
  description: string;
  action?: Record<string, unknown>;
  delay?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — Strategic Layer (Agent Systems)
// ═══════════════════════════════════════════════════════════════════════════

export type ErrorKind = 'network' | 'timeout' | 'model' | 'element' | 'parsing' | 'unknown';

export type AgentRecoveryStrategy = 'retry' | 'fallback_model' | 'graceful_degrade' | 'abort_with_message' | 'log_and_continue';

export const RECOVERY_STRATEGIES = {
  RETRY: 'retry' as const,
  FALLBACK_MODEL: 'fallback_model' as const,
  GRACEFUL_DEGRADE: 'graceful_degrade' as const,
  ABORT_WITH_MESSAGE: 'abort_with_message' as const,
  LOG_AND_CONTINUE: 'log_and_continue' as const,
} as const;

export interface AgentRecoveryDecision {
  strategy: AgentRecoveryStrategy;
  reason: string;
  retryCount?: number;
  fallbackModel?: string;
  degradedMode?: string;
  abortMessage?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ErrorContext {
  origin: string; // agentEngine | planActAgent | subagentManager | etc.
  action: string; // what was being attempted
  error: Error | string;
  attemptCount: number;
  maxAttempts?: number;
  context?: Record<string, unknown>; // Additional context (model, goal, etc.)
}

// ═══════════════════════════════════════════════════════════════════════════
// TACTICAL: Text Similarity & Element Matching
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize text for comparison: lowercase, remove punctuation, collapse whitespace
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dice Coefficient: Measure bigram-level text similarity (0–1)
 * Used to find close text matches when exact matching fails
 */
function diceCoefficient(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };

  const setA = bigrams(na);
  const setB = bigrams(nb);
  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Score elements by relevance to a goal string.
 * Returns elements sorted by score descending with a numeric score property.
 *
 * Scoring factors:
 * - Exact substring match: +10
 * - Word match (>2 chars): +3 per word
 * - Bigram similarity: +5 × coefficient (0–5)
 * - Interactive element (button, input, link): +2
 * - ARIA role bonus: +1
 * - Empty element penalty: -2
 */
export function scoreElementsByGoal(
  elements: ElementInfo[],
  goalText: string,
): Array<ElementInfo & { relevanceScore: number }> {
  const goalWords = normalise(goalText).split(/\s+/).filter(w => w.length > 2);

  return elements.map(el => {
    let score = 0;
    const composite = normalise(
      [el.text, el.ariaLabel, el.placeholder, el.role].filter(Boolean).join(' ')
    );

    // Exact substring match is very strong
    if (composite.includes(normalise(goalText))) {
      score += 10;
    }

    // Word-level matches
    for (const word of goalWords) {
      if (composite.includes(word)) score += 3;
    }

    // Bigram similarity
    const similarity = diceCoefficient(goalText, composite);
    score += similarity * 5;

    // Interactive element bonus
    const tag = el.tag?.toUpperCase() || '';
    if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) score += 2;
    if (el.role === 'button' || el.role === 'link') score += 1;

    // Penalize empty elements
    if (!el.text && !el.ariaLabel) score -= 2;

    return { ...el, relevanceScore: score };
  })
  .filter(el => el.relevanceScore > 0)
  .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Find alternative element using fuzzy matching.
 * Returns the index of the best matching element, or null if no good match found.
 */
export function findAlternativeElement(
  targetText: string,
  elements: ElementInfo[],
): number | null {
  if (!targetText || elements.length === 0) return null;

  // Use element scoring for smarter matching
  const scored = scoreElementsByGoal(elements, targetText);
  if (scored.length > 0 && scored[0].relevanceScore >= 3) {
    return scored[0].index;
  }

  // Fallback to bigram matching
  const SIMILARITY_THRESHOLD = 0.4;
  let bestIndex: number | null = null;
  let bestScore = 0;

  for (const el of elements) {
    const composite = [el.text, el.ariaLabel, el.placeholder, el.role]
      .filter(Boolean)
      .join(' ');

    if (!composite) continue;

    if (normalise(composite).includes(normalise(targetText))) {
      return el.index;
    }

    const score = diceCoefficient(targetText, composite);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = el.index;
    }
  }

  return bestScore >= SIMILARITY_THRESHOLD ? bestIndex : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TACTICAL: Diagnosis Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect element-not-found type errors
 */
function isElementNotFound(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('no element') ||
    lower.includes('no such') ||
    lower.includes('invalid index') ||
    lower.includes('out of range') ||
    lower.includes('stale element') ||
    lower.includes('detached')
  );
}

/**
 * Detect network-level errors
 */
function isNetworkError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('dns') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('err_name_not_resolved')
  );
}

/**
 * Detect timeout errors
 */
function isTimeout(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline exceeded')
  );
}

/**
 * Detect redirect loop errors
 */
function isRedirectLoop(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('redirect') ||
    lower.includes('too many redirects') ||
    lower.includes('err_too_many_redirects')
  );
}

/**
 * Detect click-interception errors (overlay, modal, covered)
 */
function isClickIntercepted(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('intercept') ||
    lower.includes('obscured') ||
    lower.includes('overlay') ||
    lower.includes('not clickable') ||
    lower.includes('another element would receive')
  );
}

/**
 * Find dismiss button in element list (close, modal dismiss, etc.)
 */
function findDismissButton(elements: ElementInfo[]): number | null {
  const dismissPatterns = [
    /close/i, /dismiss/i, /got it/i, /accept/i,
    /no thanks/i, /\u00d7/, /\u2715/, /^x$/i,
  ];

  for (const el of elements) {
    const text = el.text || el.ariaLabel || '';
    for (const pattern of dismissPatterns) {
      if (pattern.test(text)) {
        return el.index;
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TACTICAL: Browser Recovery Orchestration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main diagnosis function: Analyze browser action failure and generate ranked recovery strategies.
 * Returns array of strategies sorted by priority (best first).
 */
export function diagnoseAndRecover(ctx: RecoveryContext): BrowserRecoveryStrategy[] {
  const strategies: BrowserRecoveryStrategy[] = [];
  const { action, attemptCount } = ctx;

  // Give up after too many attempts
  if (attemptCount >= 5) {
    strategies.push({
      type: 'abort',
      description: `Giving up after ${attemptCount} attempts.`,
    });
    return strategies;
  }

  // Dispatch to action-specific diagnosis
  switch (action) {
    case 'click':
      diagnoseClick(ctx, strategies);
      break;
    case 'input':
      diagnoseInput(ctx, strategies);
      break;
    case 'navigate':
      diagnoseNavigate(ctx, strategies);
      break;
    default:
      diagnoseGeneric(ctx, strategies);
      break;
  }

  // Add universal fallbacks if not already present
  const presentTypes = new Set(strategies.map(s => s.type));

  if (!presentTypes.has('wait_and_retry') && attemptCount < 2) {
    strategies.push({
      type: 'wait_and_retry',
      description: 'Page may be loading or transitioning — wait 500ms then retry the same action.',
      delay: 500,
    });
  }

  if (!presentTypes.has('refresh') && attemptCount < 3) {
    strategies.push({
      type: 'refresh',
      description: 'Page may be in a bad state — full reload then retry from this step.',
    });
  }

  if (!presentTypes.has('navigate_back')) {
    strategies.push({
      type: 'navigate_back',
      description: 'This approach is not working — go back and try a different path to the goal.',
    });
  }

  if (!presentTypes.has('skip')) {
    strategies.push({
      type: 'skip',
      description: 'Step is non-critical — skip it and continue with the remaining plan.',
    });
  }

  if (!presentTypes.has('abort')) {
    strategies.push({
      type: 'abort',
      description: 'All recovery options exhausted — abort task.',
    });
  }

  return strategies;
}

/**
 * Diagnosis for click failures
 */
function diagnoseClick(ctx: RecoveryContext, strategies: BrowserRecoveryStrategy[]): void {
  const { error, elements = [], targetText, targetIndex, attemptCount } = ctx;

  if (isClickIntercepted(error)) {
    const dismissIdx = findDismissButton(elements);
    if (dismissIdx !== null) {
      strategies.push({
        type: 'alternative_element',
        description: `Click dismiss/close button [${dismissIdx}] to clear the overlay blocking the target.`,
        action: { index: dismissIdx, followUp: 'retry_original' },
      });
    }
    strategies.push({
      type: 'retry',
      description: 'Press Escape to close modal/popup, then retry the original click.',
      action: { pressEscape: true },
    });
  }

  if (isElementNotFound(error)) {
    strategies.push({
      type: 'scroll_and_retry',
      description: 'Element may be below the fold — scroll down 600px and re-scan.',
      action: { direction: 'down', amount: 600 },
    });
    strategies.push({
      type: 'scroll_and_retry',
      description: 'Element may be above viewport — scroll up 600px and re-scan.',
      action: { direction: 'up', amount: 600 },
    });

    // Use element scoring for smarter alternative finding
    if (targetText && elements.length > 0) {
      const scored = scoreElementsByGoal(elements, targetText);
      if (scored.length > 0 && scored[0].index !== targetIndex) {
        const el = scored[0];
        const elLabel = el.text || el.ariaLabel || `[${el.tag}]`;
        strategies.push({
          type: 'alternative_element',
          description: `Try "${elLabel}" [${el.index}] instead — best text match (score: ${el.relevanceScore.toFixed(1)}).`,
          action: { index: el.index },
        });
      }
      if (scored.length > 1 && scored[1].index !== targetIndex) {
        const el = scored[1];
        const elLabel = el.text || el.ariaLabel || `[${el.tag}]`;
        strategies.push({
          type: 'alternative_element',
          description: `Fallback: "${elLabel}" [${el.index}] (score: ${el.relevanceScore.toFixed(1)}).`,
          action: { index: el.index },
        });
      }
    }
  }

  if (!isElementNotFound(error) && !isClickIntercepted(error)) {
    if (targetIndex !== undefined) {
      const targetEl = elements.find(el => el.index === targetIndex);
      if (targetEl?.rect) {
        const cx = targetEl.rect.x + targetEl.rect.w / 2;
        const cy = targetEl.rect.y + targetEl.rect.h / 2;
        strategies.push({
          type: 'retry',
          description: `Click failed at index — retry at pixel coordinates (${Math.round(cx)}, ${Math.round(cy)}).`,
          action: { clickCoords: { x: cx, y: cy } },
        });
      }
    }

    if (attemptCount < 2) {
      strategies.unshift({
        type: 'wait_and_retry',
        description: 'Page may still be loading — wait 500ms then retry.',
        delay: 500,
      });
    }
  }
}

/**
 * Diagnosis for input field failures
 */
function diagnoseInput(ctx: RecoveryContext, strategies: BrowserRecoveryStrategy[]): void {
  const { error, elements = [], targetText, targetIndex, attemptCount } = ctx;

  if (isElementNotFound(error)) {
    strategies.push({
      type: 'scroll_and_retry',
      description: 'Scroll down to reveal the input field.',
      action: { direction: 'down', amount: 600 },
    });

    if (targetText && elements.length > 0) {
      const scored = scoreElementsByGoal(elements, targetText);
      if (scored.length > 0 && scored[0].index !== targetIndex) {
        strategies.push({
          type: 'alternative_element',
          description: `Found similar input [${scored[0].index}].`,
          action: { index: scored[0].index },
        });
      }
    }
  }

  const lower = error.toLowerCase();
  if (lower.includes('readonly') || lower.includes('disabled') || lower.includes('not editable')) {
    if (targetIndex !== undefined) {
      strategies.push({
        type: 'retry',
        description: 'Click field first to activate, then retry.',
        action: { clickFirst: true, index: targetIndex },
      });
    }
  }

  if (attemptCount < 2) {
    strategies.unshift({
      type: 'wait_and_retry',
      description: 'Wait 500ms for field to become interactive.',
      delay: 500,
    });
  }
}

/**
 * Diagnosis for navigation failures
 */
function diagnoseNavigate(ctx: RecoveryContext, strategies: BrowserRecoveryStrategy[]): void {
  const { error, attemptCount } = ctx;

  if (isNetworkError(error)) {
    strategies.push({
      type: 'abort',
      description: 'DNS or network error — cannot reach destination.',
    });
    return;
  }

  if (isRedirectLoop(error)) {
    strategies.push({
      type: 'navigate_back',
      description: 'Redirect loop detected — going back.',
    });
    return;
  }

  if (isTimeout(error)) {
    if (attemptCount < 2) {
      strategies.push({
        type: 'wait_and_retry',
        description: 'Navigation timed out — retry with longer timeout.',
        delay: 2000,
      });
    }
    strategies.push({
      type: 'refresh',
      description: 'Refresh page after timeout.',
    });
  }
}

/**
 * Generic diagnosis (fallback for unknown action types)
 */
function diagnoseGeneric(ctx: RecoveryContext, strategies: BrowserRecoveryStrategy[]): void {
  const { attemptCount } = ctx;

  if (attemptCount < 2) {
    strategies.push({
      type: 'wait_and_retry',
      description: 'Wait and retry.',
      delay: 500,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIC: Error Classification & Decision Logic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify error into broad category for recovery decision.
 * Used by agent system to decide whether to retry, fallback model, degrade, etc.
 */
export function classifyError(error: Error | string): ErrorKind {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('dns')
  ) {
    return 'network';
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('deadline')) {
    return 'timeout';
  }

  if (
    lower.includes('model') ||
    lower.includes('ollama') ||
    lower.includes('vram') ||
    lower.includes('out of memory')
  ) {
    return 'model';
  }

  if (
    lower.includes('element') ||
    lower.includes('not found') ||
    lower.includes('stale') ||
    lower.includes('detached')
  ) {
    return 'element';
  }

  if (
    lower.includes('parse') ||
    lower.includes('json') ||
    lower.includes('format') ||
    lower.includes('invalid')
  ) {
    return 'parsing';
  }

  return 'unknown';
}

/**
 * Get recovery decision for an agent system error.
 * Determines what the agent should do: retry, fallback model, degrade, abort, or log.
 */
export function getRecoveryDecision(ctx: ErrorContext): AgentRecoveryDecision {
  const errorKind = classifyError(ctx.error);
  const maxAttempts = ctx.maxAttempts || 3;
  const canRetry = ctx.attemptCount < maxAttempts;

  // Network errors — retry if attempts remain, abort otherwise
  if (errorKind === 'network') {
    if (canRetry) {
      return {
        strategy: RECOVERY_STRATEGIES.RETRY,
        reason: `Network error (${ctx.action}) — retrying (attempt ${ctx.attemptCount + 1}/${maxAttempts})`,
        logLevel: 'warn',
        retryCount: ctx.attemptCount + 1,
      };
    }
    return {
      strategy: RECOVERY_STRATEGIES.ABORT_WITH_MESSAGE,
      reason: `Network error (${ctx.action}) — max retries exhausted`,
      logLevel: 'error',
      abortMessage: `Failed to reach service after ${maxAttempts} attempts. Please check network connectivity.`,
    };
  }

  // Timeout errors — graceful degrade or retry with longer timeout
  if (errorKind === 'timeout') {
    if (ctx.origin === 'agentEngine' || ctx.origin === 'subagentManager') {
      return {
        strategy: RECOVERY_STRATEGIES.GRACEFUL_DEGRADE,
        reason: `Timeout (${ctx.action}) — reducing scope or model tier`,
        logLevel: 'warn',
        degradedMode: 'skip_optional_steps',
      };
    }
    if (canRetry) {
      return {
        strategy: RECOVERY_STRATEGIES.RETRY,
        reason: `Timeout (${ctx.action}) — retrying with longer timeout`,
        logLevel: 'warn',
        retryCount: ctx.attemptCount + 1,
      };
    }
    return {
      strategy: RECOVERY_STRATEGIES.GRACEFUL_DEGRADE,
      reason: `Timeout (${ctx.action}) — falling back to faster model`,
      logLevel: 'warn',
      degradedMode: 'use_fast_model',
    };
  }

  // Model/VRAM errors — fallback to lighter model
  if (errorKind === 'model') {
    return {
      strategy: RECOVERY_STRATEGIES.FALLBACK_MODEL,
      reason: `Model error (${ctx.action}) — switching to lighter model`,
      logLevel: 'warn',
      fallbackModel: 'qwen3.5:2b', // Default fallback; can be overridden
    };
  }

  // Element/UI errors — graceful degrade (skip visual-dependent operations)
  if (errorKind === 'element') {
    return {
      strategy: RECOVERY_STRATEGIES.GRACEFUL_DEGRADE,
      reason: `Element error (${ctx.action}) — skipping visual steps`,
      logLevel: 'warn',
      degradedMode: 'skip_visual_steps',
    };
  }

  // Parsing errors — log and continue (often non-critical)
  if (errorKind === 'parsing') {
    return {
      strategy: RECOVERY_STRATEGIES.LOG_AND_CONTINUE,
      reason: `Parsing error (${ctx.action}) — using fallback data`,
      logLevel: 'debug',
    };
  }

  // Unknown errors — default to graceful degrade
  return {
    strategy: RECOVERY_STRATEGIES.GRACEFUL_DEGRADE,
    reason: `Unknown error (${ctx.action}) — reducing scope`,
    logLevel: 'warn',
    degradedMode: 'reduce_scope',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIC: Execution Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute with automatic recovery.
 * Wraps an async function and applies recovery decisions on error.
 */
export async function executeWithRecovery<T>(
  fn: () => Promise<T>,
  ctx: ErrorContext,
  onRecovery?: (decision: AgentRecoveryDecision) => Promise<void>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    ctx.error = error instanceof Error ? error : new Error(String(error));
    const decision = getRecoveryDecision(ctx);

    // Log the decision
    logRecoveryDecision(decision);

    // Invoke optional callback
    if (onRecovery) {
      await onRecovery(decision);
    }

    // Decide what to return/throw based on strategy
    switch (decision.strategy) {
      case RECOVERY_STRATEGIES.LOG_AND_CONTINUE:
        return null; // Caller should handle null gracefully
      case RECOVERY_STRATEGIES.GRACEFUL_DEGRADE:
        return null; // Caller should check null and use fallback
      case RECOVERY_STRATEGIES.ABORT_WITH_MESSAGE:
        throw new Error(decision.abortMessage || decision.reason);
      case RECOVERY_STRATEGIES.RETRY:
      case RECOVERY_STRATEGIES.FALLBACK_MODEL:
      default:
        // Caller should handle these strategies
        throw error;
    }
  }
}

/**
 * Execute with retry loop.
 * Retries a function up to maxAttempts times, using recovery decisions.
 */
export async function executeWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  origin: string,
  action: string,
  maxAttempts: number = 3,
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      const ctx: ErrorContext = {
        origin,
        action,
        error,
        attemptCount: attempt,
        maxAttempts,
      };

      const decision = getRecoveryDecision(ctx);
      logRecoveryDecision(decision);

      if (decision.strategy !== RECOVERY_STRATEGIES.RETRY || attempt === maxAttempts - 1) {
        if (decision.strategy === RECOVERY_STRATEGIES.GRACEFUL_DEGRADE || decision.strategy === RECOVERY_STRATEGIES.LOG_AND_CONTINUE) {
          return null; // Fail gracefully
        }
        throw error; // Re-throw on abort
      }

      // Continue to next attempt if RETRY
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING & METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log recovery decision to console with appropriate level
 */
function logRecoveryDecision(decision: AgentRecoveryDecision): void {
  const prefix = `[ErrorRecovery] ${decision.strategy.toUpperCase()}`;
  const logFn = console[decision.logLevel] || console.log;

  logFn(`${prefix}: ${decision.reason}`);

  if (decision.fallbackModel) {
    logFn(`  → Fallback model: ${decision.fallbackModel}`);
  }
  if (decision.degradedMode) {
    logFn(`  → Degraded mode: ${decision.degradedMode}`);
  }
  if (decision.abortMessage) {
    logFn(`  → Message to user: ${decision.abortMessage}`);
  }
}

/**
 * In-memory metrics tracking for recovery strategies
 */
interface RecoveryMetrics {
  strategyCount: Map<AgentRecoveryStrategy, number>;
  errorKindCount: Map<ErrorKind, number>;
  totalRecoveries: number;
}

const metrics: RecoveryMetrics = {
  strategyCount: new Map(),
  errorKindCount: new Map(),
  totalRecoveries: 0,
};

/**
 * Record recovery event in metrics
 */
export function recordRecovery(strategy: AgentRecoveryStrategy, errorKind: ErrorKind): void {
  metrics.strategyCount.set(strategy, (metrics.strategyCount.get(strategy) || 0) + 1);
  metrics.errorKindCount.set(errorKind, (metrics.errorKindCount.get(errorKind) || 0) + 1);
  metrics.totalRecoveries++;
}

/**
 * Get current recovery metrics
 */
export function getRecoveryMetrics(): RecoveryMetrics {
  return metrics;
}

/**
 * Reset recovery metrics (for testing)
 */
export function resetRecoveryMetrics(): void {
  metrics.strategyCount.clear();
  metrics.errorKindCount.clear();
  metrics.totalRecoveries = 0;
}
