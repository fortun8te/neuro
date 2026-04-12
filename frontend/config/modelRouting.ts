/**
 * Model Routing & Load Management Configuration
 *
 * Defines:
 * - Per-model concurrency limits
 * - Per-model timeout thresholds
 * - Global concurrency cap
 * - Memory requirements per model
 *
 * Purpose: Prevent Ollama GPU overload by enforcing strict concurrency limits
 * and intelligent load distribution across models.
 */

// ─────────────────────────────────────────────────────────────
// Model Configuration
// ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  model: string;
  maxConcurrency: number;
  timeout: number; // milliseconds
  fallbackModel?: string;
}

export interface ModelRoutingConfig {
  planner: ModelConfig;
  researcher: ModelConfig;
  reflector: ModelConfig;
  critic: ModelConfig;
  synthesizer: ModelConfig;
  [key: string]: ModelConfig;
}

/**
 * Model-specific routing configuration
 *
 * Concurrency limits based on model size and VRAM requirements:
 * - gemma4:e31b: Very expensive (31B params), GPU-heavy. Limit to 1.
 * - qwen3.5:4b: Lightweight (4B params). Can sustain 8 concurrent.
 * - qwen3.5:9b: Medium (9B params). Limit to 2-3 concurrent.
 * - nemotron-3-super:120b: Massive (120B params). Limit to 1 (for production creative).
 * - NEURO-1-B2-4B: Medium (4B). Limit to 4 concurrent.
 *
 * Timeouts account for:
 * - Model loading (first call)
 * - Queue wait time (if other tasks are running)
 * - Actual inference time
 */
export const MODEL_ROUTING: ModelRoutingConfig = {
  planner: {
    model: 'gemma4:e31b',
    maxConcurrency: 1,
    timeout: 45_000,
    fallbackModel: 'qwen3.5:9b',
  },
  researcher: {
    model: 'qwen3.5:4b',
    maxConcurrency: 8,
    timeout: 30_000,
    fallbackModel: 'qwen3.5:2b',
  },
  reflector: {
    model: 'qwen3.5:4b',
    maxConcurrency: 2,
    timeout: 30_000,
    fallbackModel: 'qwen3.5:2b',
  },
  critic: {
    model: 'qwen3.5:4b',
    maxConcurrency: 2,
    timeout: 25_000,
    fallbackModel: 'qwen3.5:2b',
  },
  synthesizer: {
    model: 'qwen3.5:9b',
    maxConcurrency: 1,
    timeout: 45_000,
    fallbackModel: 'qwen3.5:4b',
  },
};

// ─────────────────────────────────────────────────────────────
// Concurrency Limits
// ─────────────────────────────────────────────────────────────

export interface ConcurrencyLimits {
  perModel: Record<string, number>;
  globalMax: number;
  memoryPerModel: Record<string, string>;
  queueMaxSize: number;
  backoffMs: {
    initial: number;
    max: number;
    multiplier: number;
  };
}

/**
 * Global concurrency management
 *
 * Key constraints:
 * - globalMax (15): Total concurrent tasks across all models
 *   Prevents global GPU overload even if individual model limits allow more.
 * - perModel: Per-model limits based on VRAM + reasonable task concurrency
 * - queueMaxSize (50): Max pending tasks before rejecting new ones
 * - backoffMs: Exponential backoff for queue waits
 *   - 100ms initial
 *   - 10s max
 *   - 1.5x multiplier (100 → 150 → 225 → 337 → 500 → 750 → 1000+ → 10000)
 */
export const CONCURRENCY_LIMITS: ConcurrencyLimits = {
  perModel: {
    'gemma4:e31b': 1,
    'qwen3.5:2b': 16,
    'qwen3.5:4b': 8,
    'qwen3.5:9b': 3,
    'qwen3.5:27b': 1,
    'nemotron-3-super:120b': 1,
    'NEURO-1-B2-4B': 4,
    'allenporter/xlam:1b': 16,
    'chromadb-context-1:latest': 2,
  },
  globalMax: 15,
  memoryPerModel: {
    'gemma4:e31b': '31GB',
    'qwen3.5:2b': '1GB',
    'qwen3.5:4b': '3GB',
    'qwen3.5:9b': '8GB',
    'qwen3.5:27b': '18GB',
    'nemotron-3-super:120b': '120GB',
    'NEURO-1-B2-4B': '4GB',
    'allenporter/xlam:1b': '1GB',
    'chromadb-context-1:latest': '2GB',
  },
  queueMaxSize: 50,
  backoffMs: {
    initial: 100,
    max: 10_000,
    multiplier: 1.5,
  },
};

// ─────────────────────────────────────────────────────────────
// Model Tier Definitions
// ─────────────────────────────────────────────────────────────

export type ModelTier = 'light' | 'standard' | 'quality' | 'maximum';

export interface ModelTierConfig {
  tier: ModelTier;
  fastModel: string;
  capableModel: string;
  description: string;
}

/**
 * One-click model tier presets
 *
 * Maps research depth / quality tier to (fast, capable) model pairs.
 * - light: Minimal VRAM (0.8b + 2b)
 * - standard: Good balance (2b + 4b) — DEFAULT
 * - quality: Higher quality (4b + 9b)
 * - maximum: Best quality (9b + 27b)
 */
export const MODEL_TIERS: Record<ModelTier, ModelTierConfig> = {
  light: {
    tier: 'light',
    fastModel: 'qwen3.5:2b',
    capableModel: 'qwen3.5:2b',
    description: 'Minimal VRAM, fastest execution',
  },
  standard: {
    tier: 'standard',
    fastModel: 'qwen3.5:2b',
    capableModel: 'qwen3.5:4b',
    description: 'Good balance of speed and quality (default)',
  },
  quality: {
    tier: 'quality',
    fastModel: 'qwen3.5:4b',
    capableModel: 'qwen3.5:9b',
    description: 'Higher quality output',
  },
  maximum: {
    tier: 'maximum',
    fastModel: 'qwen3.5:9b',
    capableModel: 'qwen3.5:27b',
    description: 'Best quality, most VRAM required',
  },
};

// ─────────────────────────────────────────────────────────────
// Load Status Types
// ─────────────────────────────────────────────────────────────

export interface ModelLoadStatus {
  model: string;
  activeTasks: number;
  maxConcurrency: number;
  queuedTasks: number;
  utilizationPercent: number;
  status: 'available' | 'capacity-warning' | 'at-capacity' | 'overloaded';
}

export interface GlobalLoadStatus {
  activeTasks: number;
  globalMax: number;
  utilizationPercent: number;
  status: 'healthy' | 'capacity-warning' | 'at-capacity' | 'overloaded';
  perModel: ModelLoadStatus[];
}

export interface LoadStatus {
  timestamp: number;
  global: GlobalLoadStatus;
}
