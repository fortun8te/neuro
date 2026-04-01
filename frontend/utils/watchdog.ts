/**
 * watchdog — Budget enforcement, loop detection, kill logic.
 *
 * Monitors agents, enforces budgets, kills runaways.
 * No LLM calls. Port of specs/watchdog.py.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AgentBudget {
  maxTokensPerResponse: number;
  maxSecondsPerStep: number;
  maxTotalSeconds: number;
  maxIterations: number;
  maxThinkingTokens: number; // 0 = thinking off
}

// ─────────────────────────────────────────────────────────────
// Budget table
// ─────────────────────────────────────────────────────────────

export const BUDGETS: Record<string, AgentBudget> = {
  'qwen3.5:2b':         { maxTokensPerResponse: 500,  maxSecondsPerStep: 15,  maxTotalSeconds: 30,   maxIterations: 1,  maxThinkingTokens: 0   },
  'qwen3.5:4b':         { maxTokensPerResponse: 4000, maxSecondsPerStep: 60,  maxTotalSeconds: 600,  maxIterations: 20, maxThinkingTokens: 0   },
  'qwen3.5:9b':         { maxTokensPerResponse: 6000, maxSecondsPerStep: 120, maxTotalSeconds: 1800, maxIterations: 50, maxThinkingTokens: 400 },
  'qwen3.5:9b-council': { maxTokensPerResponse: 3000, maxSecondsPerStep: 60,  maxTotalSeconds: 120,  maxIterations: 1,  maxThinkingTokens: 300 },
  'qwen3.5:27b':        { maxTokensPerResponse: 8000, maxSecondsPerStep: 180, maxTotalSeconds: 300,  maxIterations: 3,  maxThinkingTokens: 600 },
};

// ─────────────────────────────────────────────────────────────
// VRAM table (MB)
// ─────────────────────────────────────────────────────────────

export const VRAM_MB: Record<string, number> = {
  'qwen3.5:2b':         1500,
  'qwen3.5:4b':         2500,
  'qwen3.5:9b':         5500,
  'qwen3.5:9b-council': 5500,
  'qwen3.5:27b':        15000,
};

export const TOTAL_VRAM = 16000; // RTX 5080

// ─────────────────────────────────────────────────────────────
// Loop detection
// ─────────────────────────────────────────────────────────────

/**
 * Compute the length of the longest common substring of two strings.
 * Used internally by detectLoop for similarity comparison.
 */
function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  let best = 0;
  // Use a single-row DP approach to keep memory O(min(m,n))
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const prev = new Array<number>(shorter.length + 1).fill(0);

  for (let j = 1; j <= longer.length; j++) {
    let diagPrev = 0;
    for (let i = 1; i <= shorter.length; i++) {
      const diagCurr = prev[i]; // save before overwrite
      if (longer[j - 1] === shorter[i - 1]) {
        prev[i] = diagPrev + 1;
        if (prev[i] > best) best = prev[i];
      } else {
        prev[i] = 0;
      }
      diagPrev = diagCurr;
    }
  }

  return best;
}

/**
 * Returns true when the agent appears to be stuck in a loop.
 *
 * Two consecutive outputs are considered "similar" when their longest
 * common substring exceeds 90 % of the shorter string's length — a
 * pure-TypeScript equivalent of Python's SequenceMatcher.ratio() > 0.9.
 *
 * @param outputs - Ordered list of agent output strings (oldest first)
 * @param window  - How many recent outputs to examine (default 3)
 */
export function detectLoop(outputs: string[], window = 3): boolean {
  if (outputs.length < window) return false;

  const recent = outputs.slice(-window);

  // Exact-duplicate shortcut
  if (new Set(recent).size === 1) return true;

  for (let i = 0; i < recent.length - 1; i++) {
    const a = recent[i];
    const b = recent[i + 1];
    const shorterLen = Math.min(a.length, b.length);
    if (shorterLen === 0) continue;
    const lcs = longestCommonSubstringLength(a, b);
    if (lcs / shorterLen > 0.9) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// Kill decision
// ─────────────────────────────────────────────────────────────

/**
 * Returns a kill reason string if the agent should be terminated,
 * or null if it is still within budget.
 */
export function shouldKill(
  agentModel: string,
  elapsedSeconds: number,
  iteration: number,
  tokensGenerated: number,
  thinkingTokens: number,
  outputs: string[],
): string | null {
  const budget = BUDGETS[agentModel];
  if (!budget) return null;

  if (elapsedSeconds > budget.maxTotalSeconds) {
    return `total_timeout (${elapsedSeconds.toFixed(0)}s > ${budget.maxTotalSeconds}s)`;
  }

  if (elapsedSeconds > budget.maxSecondsPerStep * 2) {
    return `step_timeout (${Math.round(elapsedSeconds)}s > ${budget.maxSecondsPerStep * 2}s)`;
  }

  if (iteration > budget.maxIterations) {
    return `max_iterations (${iteration} > ${budget.maxIterations})`;
  }

  if (budget.maxThinkingTokens > 0 && thinkingTokens > budget.maxThinkingTokens * 1.5) {
    return `thinking_overflow (${thinkingTokens} > ${Math.round(budget.maxThinkingTokens * 1.5)})`;
  }

  if (detectLoop(outputs)) {
    return 'loop_detected';
  }

  if (tokensGenerated > budget.maxTokensPerResponse * 1.5) {
    return `token_overflow (${tokensGenerated} > ${budget.maxTokensPerResponse * 1.5})`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// VRAM management
// ─────────────────────────────────────────────────────────────

/**
 * Returns true if loading the given model would keep total VRAM within budget.
 */
export function canLoadModel(model: string, currentlyLoaded: string[]): boolean {
  const used = currentlyLoaded.reduce((sum, m) => sum + (VRAM_MB[m] ?? 0), 0);
  const needed = VRAM_MB[model] ?? 0;
  return used + needed <= TOTAL_VRAM;
}

// ─────────────────────────────────────────────────────────────
// TaskHeartbeat — in-browser watchdog for long-running tasks
// ─────────────────────────────────────────────────────────────

export interface HeartbeatOpts {
  /** How often to check (ms). Default: 30s */
  intervalMs?: number;
  /** Stall threshold — no activity for this long = stall (ms). Default: 2min */
  stallThresholdMs?: number;
  /** Called every pulse with elapsed ms and last-activity age ms */
  onPulse?: (elapsedMs: number, lastActivityAgeMs: number) => void;
  /** Called when agent appears stalled */
  onStall?: () => void;
}

export class TaskHeartbeat {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastActivityTs: number = Date.now();
  private startTs: number = Date.now();
  private readonly intervalMs: number;
  private readonly stallThresholdMs: number;
  private readonly onPulse?: HeartbeatOpts['onPulse'];
  private readonly onStall?: HeartbeatOpts['onStall'];
  private stalled = false;

  constructor(opts: HeartbeatOpts = {}) {
    this.intervalMs = opts.intervalMs ?? 30_000;
    this.stallThresholdMs = opts.stallThresholdMs ?? 120_000;
    this.onPulse = opts.onPulse;
    this.onStall = opts.onStall;
  }

  /** Record any agent activity — resets stall timer */
  recordActivity(): void {
    this.lastActivityTs = Date.now();
    this.stalled = false;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.startTs = Date.now();
    this.lastActivityTs = Date.now();
    this.intervalId = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    const elapsedMs = now - this.startTs;
    const lastActivityAgeMs = now - this.lastActivityTs;

    this.onPulse?.(elapsedMs, lastActivityAgeMs);

    if (!this.stalled && lastActivityAgeMs > this.stallThresholdMs) {
      this.stalled = true;
      this.onStall?.();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Token budget circuit breaker
// ─────────────────────────────────────────────────────────────

export type BudgetField = 'tokens' | 'time' | 'iterations';

export interface BudgetCheckResult {
  allowed: boolean;
  /** Which limit was hit (null if allowed) */
  limitHit: BudgetField | 'loop' | null;
  /** Human-readable reason string */
  reason: string;
  /** Percentage of budget consumed (0-1+) for the tightest limit */
  utilization: number;
}

/**
 * Pre-flight budget check — call BEFORE starting a new LLM call.
 * Returns { allowed: false } if the agent should stop.
 *
 * Unlike shouldKill() (which is post-hoc), this is a gate that
 * prevents wasting tokens on calls that will be killed anyway.
 */
export function checkBudget(
  agentModel: string,
  elapsedSeconds: number,
  iteration: number,
  tokensGenerated: number,
  outputs: string[],
): BudgetCheckResult {
  const budget = BUDGETS[agentModel];
  if (!budget) return { allowed: true, limitHit: null, reason: 'No budget defined', utilization: 0 };

  const timeUtil = elapsedSeconds / budget.maxTotalSeconds;
  const iterUtil = iteration / budget.maxIterations;
  const tokenUtil = tokensGenerated / budget.maxTokensPerResponse;
  const utilization = Math.max(timeUtil, iterUtil, tokenUtil);

  // Hard stops (same logic as shouldKill, but pre-flight)
  if (elapsedSeconds >= budget.maxTotalSeconds) {
    return { allowed: false, limitHit: 'time', reason: `Time budget exhausted (${Math.round(elapsedSeconds)}s / ${budget.maxTotalSeconds}s)`, utilization };
  }
  if (iteration >= budget.maxIterations) {
    return { allowed: false, limitHit: 'iterations', reason: `Iteration limit reached (${iteration} / ${budget.maxIterations})`, utilization };
  }
  if (tokensGenerated >= budget.maxTokensPerResponse * 1.2) {
    return { allowed: false, limitHit: 'tokens', reason: `Token budget nearly exhausted (${tokensGenerated} / ${budget.maxTokensPerResponse})`, utilization };
  }
  if (detectLoop(outputs)) {
    return { allowed: false, limitHit: 'loop', reason: 'Loop detected in recent outputs', utilization };
  }

  return { allowed: true, limitHit: null, reason: '', utilization };
}

/**
 * Get a warning message if budget is >80% consumed.
 * Useful for injecting "wrap up" hints into prompts.
 */
export function getBudgetWarning(
  agentModel: string,
  elapsedSeconds: number,
  iteration: number,
  tokensGenerated: number,
): string | null {
  const budget = BUDGETS[agentModel];
  if (!budget) return null;

  const warnings: string[] = [];
  if (elapsedSeconds / budget.maxTotalSeconds > 0.8) {
    warnings.push(`time ${Math.round(elapsedSeconds)}s/${budget.maxTotalSeconds}s`);
  }
  if (iteration / budget.maxIterations > 0.8) {
    warnings.push(`iterations ${iteration}/${budget.maxIterations}`);
  }
  if (tokensGenerated / budget.maxTokensPerResponse > 0.8) {
    warnings.push(`tokens ${tokensGenerated}/${budget.maxTokensPerResponse}`);
  }

  return warnings.length > 0 ? `BUDGET WARNING: Approaching limits — ${warnings.join(', ')}. Wrap up soon.` : null;
}

// ─────────────────────────────────────────────────────────────
// VRAM management
// ─────────────────────────────────────────────────────────────

/**
 * Returns the list of currently-loaded models ordered by eviction priority
 * (lowest-priority first), excluding the active model.
 */
export function evictionOrder(currentlyLoaded: string[], activeModel: string): string[] {
  const priority: Record<string, number> = {
    'qwen3.5:2b':         0,
    'qwen3.5:4b':         1,
    'qwen3.5:9b':         2,
    'qwen3.5:9b-council': 3,
    'qwen3.5:27b':        3,
  };

  return currentlyLoaded
    .filter(m => m !== activeModel)
    .sort((a, b) => (priority[a] ?? 0) - (priority[b] ?? 0));
}
