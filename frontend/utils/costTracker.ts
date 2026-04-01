/**
 * costTracker.ts — Token usage cost tracking and budgeting system
 *
 * Tracks:
 * - Per-model token costs (Qwen 3.5, Nemotron-3-Super, GPT-OSS-20B)
 * - Per-tool usage
 * - Per-session totals
 * - Per-task costs
 *
 * Budgeting:
 * - Soft limit (warning at 80%) — yellow, continue execution
 * - Hard limit (refuse at 100%) — red, block tool execution
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CostConfig {
  hardLimitTokens: number;      // refuse execution if exceeded
  softLimitTokens: number;      // warn when reached (typically 80% of hard limit)
  modelPrices: Record<string, number>; // $ per 1k tokens
  trackingGranularity: 'global' | 'perSession' | 'perTask';
  warnOnSoftLimit: boolean;     // show warning toast/modal
  monthlyBudgetTokens?: number; // optional: total monthly cap
}

export interface CostUsage {
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  byTool: Record<string, { tokens: number; cost: number }>;
  lastUpdate: number;
  timestamp: number;
}

export interface CostEvent {
  type: 'cost_update' | 'soft_limit_exceeded' | 'hard_limit_exceeded';
  tokens: number;
  cost: number;
  model: string;
  tool?: string;
  totalTokens: number;
  totalCost: number;
  softLimitTokens: number;
  hardLimitTokens: number;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────

const DEFAULT_COST_CONFIG: CostConfig = {
  hardLimitTokens: 1_000_000,           // 1M tokens default
  softLimitTokens: 800_000,             // 80% of hard limit
  modelPrices: {
    'qwen3.5:0.8b': 0.00003,            // $ per 1k tokens
    'qwen3.5:2b': 0.0001,
    'qwen3.5:4b': 0.0003,
    'qwen3.5:9b': 0.0008,
    'qwen3.5:27b': 0.002,
    'nemotron-3-super:120b': 0.01,
    'gpt-oss-20b': 0.0005,
  },
  trackingGranularity: 'perSession',
  warnOnSoftLimit: true,
};

// ─────────────────────────────────────────────────────────────
// Internal State
// ─────────────────────────────────────────────────────────────

const COST_CONFIG_KEY = 'neuro_cost_config';
const COST_USAGE_KEY = 'neuro_cost_usage';
const COST_HISTORY_KEY = 'neuro_cost_history';

let config: CostConfig = loadConfigFromStorage();
let usage: CostUsage = loadUsageFromStorage();
const listeners = new Set<(event: CostEvent) => void>();

// ─────────────────────────────────────────────────────────────
// Storage Operations
// ─────────────────────────────────────────────────────────────

function loadConfigFromStorage(): CostConfig {
  try {
    const stored = localStorage.getItem(COST_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load cost config from storage:', e);
  }
  return { ...DEFAULT_COST_CONFIG };
}

function saveConfigToStorage(cfg: CostConfig) {
  try {
    localStorage.setItem(COST_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('Failed to save cost config to storage:', e);
  }
}

function loadUsageFromStorage(): CostUsage {
  try {
    const stored = localStorage.getItem(COST_USAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Reset daily if needed
      if (isNewDay(parsed.timestamp)) {
        return createEmptyUsage();
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load cost usage from storage:', e);
  }
  return createEmptyUsage();
}

function saveUsageToStorage(u: CostUsage) {
  try {
    localStorage.setItem(COST_USAGE_KEY, JSON.stringify(u));
  } catch (e) {
    console.warn('Failed to save cost usage to storage:', e);
  }
}

function createEmptyUsage(): CostUsage {
  return {
    totalTokens: 0,
    totalCost: 0,
    byModel: {},
    byTool: {},
    lastUpdate: Date.now(),
    timestamp: Date.now(),
  };
}

function isNewDay(timestamp: number): boolean {
  const lastDate = new Date(timestamp).toDateString();
  const todayDate = new Date().toDateString();
  return lastDate !== todayDate;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export const costTracker = {
  // ── Configuration ──

  getConfig(): CostConfig {
    return { ...config };
  },

  setConfig(newConfig: Partial<CostConfig>) {
    config = { ...config, ...newConfig };
    saveConfigToStorage(config);
  },

  setSoftLimit(tokens: number) {
    config.softLimitTokens = tokens;
    saveConfigToStorage(config);
  },

  setHardLimit(tokens: number) {
    config.hardLimitTokens = tokens;
    saveConfigToStorage(config);
  },

  setModelPrice(model: string, pricePerKTokens: number) {
    config.modelPrices[model] = pricePerKTokens;
    saveConfigToStorage(config);
  },

  // ── Usage Tracking ──

  getUsage(): CostUsage {
    return { ...usage };
  },

  /**
   * Record a token usage event.
   * Returns true if usage is within hard limit, false if exceeded.
   */
  recordUsage(tokens: number, model: string, tool?: string): boolean {
    // Calculate cost
    const pricePerToken = config.modelPrices[model] || 0.0005;
    const cost = (tokens * pricePerToken) / 1000;

    // Update totals
    usage.totalTokens += tokens;
    usage.totalCost += cost;
    usage.lastUpdate = Date.now();

    // Update by-model
    if (!usage.byModel[model]) {
      usage.byModel[model] = { tokens: 0, cost: 0 };
    }
    usage.byModel[model].tokens += tokens;
    usage.byModel[model].cost += cost;

    // Update by-tool
    if (tool) {
      if (!usage.byTool[tool]) {
        usage.byTool[tool] = { tokens: 0, cost: 0 };
      }
      usage.byTool[tool].tokens += tokens;
      usage.byTool[tool].cost += cost;
    }

    // Save to storage
    saveUsageToStorage(usage);

    // Check limits and emit events
    const event: CostEvent = {
      type: 'cost_update',
      tokens,
      cost,
      model,
      tool,
      totalTokens: usage.totalTokens,
      totalCost: usage.totalCost,
      softLimitTokens: config.softLimitTokens,
      hardLimitTokens: config.hardLimitTokens,
      timestamp: Date.now(),
    };

    // Check soft limit
    if (
      config.warnOnSoftLimit &&
      usage.totalTokens >= config.softLimitTokens &&
      usage.totalTokens - tokens < config.softLimitTokens // First time crossing
    ) {
      event.type = 'soft_limit_exceeded';
      emit(event);
      return true;
    }

    // Check hard limit
    if (usage.totalTokens >= config.hardLimitTokens) {
      event.type = 'hard_limit_exceeded';
      emit(event);
      return false; // BLOCK execution
    }

    emit(event);
    return true; // OK to continue
  },

  /**
   * Check if hard limit would be exceeded with the given tokens.
   * Does NOT record usage — just checks.
   */
  wouldExceedHardLimit(tokens: number): boolean {
    return usage.totalTokens + tokens >= config.hardLimitTokens;
  },

  /**
   * Check if soft limit would be exceeded with the given tokens.
   */
  wouldExceedSoftLimit(tokens: number): boolean {
    return usage.totalTokens + tokens >= config.softLimitTokens;
  },

  /**
   * Get cost breakdown by model.
   */
  getCostByModel(): Record<string, { tokens: number; cost: number; percentage: number }> {
    const result: Record<string, { tokens: number; cost: number; percentage: number }> = {};
    for (const [model, data] of Object.entries(usage.byModel)) {
      result[model] = {
        ...data,
        percentage: usage.totalCost > 0 ? (data.cost / usage.totalCost) * 100 : 0,
      };
    }
    return result;
  },

  /**
   * Get cost breakdown by tool.
   */
  getCostByTool(): Record<string, { tokens: number; cost: number; percentage: number }> {
    const result: Record<string, { tokens: number; cost: number; percentage: number }> = {};
    for (const [tool, data] of Object.entries(usage.byTool)) {
      result[tool] = {
        ...data,
        percentage: usage.totalCost > 0 ? (data.cost / usage.totalCost) * 100 : 0,
      };
    }
    return result;
  },

  /**
   * Get remaining budget before hard limit.
   */
  getRemainingTokens(): number {
    return Math.max(0, config.hardLimitTokens - usage.totalTokens);
  },

  /**
   * Get percentage of hard limit used (0-100).
   */
  getUsagePercentage(): number {
    return (usage.totalTokens / config.hardLimitTokens) * 100;
  },

  /**
   * Reset session usage (e.g., start of new day).
   */
  resetUsage() {
    usage = createEmptyUsage();
    saveUsageToStorage(usage);
  },

  /**
   * Get historical cost data for a date range.
   */
  getHistoricalCosts(): Record<string, CostUsage> {
    try {
      const history = localStorage.getItem(COST_HISTORY_KEY);
      return history ? JSON.parse(history) : {};
    } catch (e) {
      console.warn('Failed to load cost history:', e);
      return {};
    }
  },

  /**
   * Archive current usage to history (call at end of day).
   */
  archiveToHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(COST_HISTORY_KEY) || '{}');
      const dateKey = new Date().toISOString().split('T')[0];
      history[dateKey] = { ...usage };
      localStorage.setItem(COST_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to archive cost history:', e);
    }
  },

  /**
   * Subscribe to cost events.
   */
  subscribe(fn: (event: CostEvent) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ─────────────────────────────────────────────────────────────
// Event Emission
// ─────────────────────────────────────────────────────────────

function emit(event: CostEvent) {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.error('Cost event listener error:', e);
    }
  });
}
