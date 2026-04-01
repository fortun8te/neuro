import { INFRASTRUCTURE } from '../config/infrastructure';

// Model configuration for the research + ad pipeline
//
// Model roster:
//   nemotron-3-super:120b   — Hardest thinker: production creative, test evaluation (123.6B params)
//   NEURO-1-B2-4B           — Neuro's personality/identity model (style rewriter, identity questions)
//   allenporter/xlam:1b     — xLAM tool calling specialist (78%+ accuracy, Berkeley BFCL)
//   chromadb/context-1      — Retrieval subagent (Context-1 harness, optional)
//   qwen3.5:2b  (530MB)  — compress text
//   qwen3.5:2b    (1.5GB)  — greetings, tool routing, research synthesis, memory, context compression
//   qwen3.5:4b    (2.8GB)  — intent classify, general chat, research orchestration, reflection
//   qwen3.5:9b    (6.6GB)  — quality chat, computer agent planning, vision, tool-call rescue
//   qwen3.5:27b   (18GB)   — complex/creative tasks
//
// Orchestration (Phase 2):
//   Primary: chromadb/context-1 (if available via VITE_CONTEXT1_URL)
//   Fallback: qwen3.5:4b (always available)
//
// Pipeline: Qwen generates content → NEURO-1-B2-4B rewrites for personality/style → Qwen verifies
// Identity questions (who are you, what's your name) route directly to NEURO-1-B2-4B
// All model assignments are configurable via Dashboard → Settings → Research.
// Each role reads from localStorage with fallback to defaults below.

// ─────────────────────────────────────────────────────────────
// Stage-level model assignments (used by useCycleLoop, wayfarer, etc.)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Model role policy (IMPORTANT — do not violate):
//
//   nemotron-3-super:120b — hardest thinker (Nemotron 3 Super, 123.6B params).
//     · Production creative generation, test evaluation
//     · Primary model for maximum quality creative work
//     · GPU-resident in MAX mode preset
//
//   NEURO-1-B2-4B — personality & identity ONLY. Use for:
//     · Style rewriting (converts Qwen output to Neuro's voice)
//     · Identity questions ("who are you", "what's your name")
//     · NOT for reasoning, tool calling, or analysis
//     · Known issue: sometimes outputs "thinking process" text
//       instead of using think blocks — needs retry logic
//
//   allenporter/xlam:1b — tool calling ONLY. 78%+ accuracy.
//     · Picks which tool to call + fills args
//     · NOT for conversation, reasoning, or content generation
//
//   qwen3.5:2b — compress text only.
//
//   qwen3.5:2b — greetings, tool routing, research synthesis, memory, context compression.
//
//   qwen3.5:4b — intent classify, general chat, research orchestration, reflection.
//
//   qwen3.5:9b — quality chat, computer agent planning, vision, tool-call rescue.
//
//   qwen3.5:27b — complex/creative tasks.
//
//   context-1 — retrieval subagent (hybrid BM25 + dense search).
// ─────────────────────────────────────────────────────────────

export const MODEL_CONFIG: Record<string, string> = {
  // ── Neuro Identity & Style ──
  neuro: 'NEURO-1-B2-4B',              // Personality model — style rewriting & identity
  rewriter: 'NEURO-1-B2-4B',           // Rewrites Qwen output into Neuro's voice

  // ── Routing & Classification (instant, tiny model) ──
  fast: 'qwen3.5:2b',                  // Intent router, classification, title gen
  router: 'qwen3.5:2b',                // Message intent classification
  toolRouter: 'qwen3.5:2b',            // Tool selection router (fallback when xLAM unavailable)
  xlam: 'allenporter/xlam:1b',         // xLAM function calling (primary tool router + rescue)

  // ── Compression & Extraction (small model) ──
  vision: 'qwen3.5:2b',                // Screenshot analysis
  'verify-state': 'qwen3.5:2b',        // State verification
  compression: 'qwen3.5:2b',           // Page compression for research

  // ── Research & Analysis (capable model) ──
  research: 'qwen3.5:9b',              // Web research synthesis
  executor: 'qwen3.5:4b',              // Plan-act execution steps
  orchestrator: 'context-1',           // Research orchestrator (routes to Context-1 w/ Qwen fallback)

  // ── Reasoning & Strategy (strong model) ──
  thinking: 'qwen3.5:9b',              // Deep reasoning / chain-of-thought
  planner: 'qwen3.5:9b',               // Computer task planning
  'brand-dna': 'qwen3.5:9b',           // Multi-step desire analysis
  'persona-dna': 'qwen3.5:9b',         // Complex audience reasoning
  angles: 'qwen3.5:9b',                // Strategic positioning
  strategy: 'qwen3.5:9b',              // Multi-step strategy
  copywriting: 'qwen3.5:9b',           // Deep creative work
  chat: 'qwen3.5:9b',                  // Main chat conversation

  // ── Production (maximum model) ──
  production: 'nemotron-3-super:120b',  // Ad creative generation
  test: 'nemotron-3-super:120b',       // Concept evaluation & ranking

  // ── Deep Reasoning (nemotron — use sparingly, slow but thorough) ──
  'deep-analysis': 'nemotron-3-super:120b',   // Complex technical deep dives
  'security-audit': 'nemotron-3-super:120b',  // Security vulnerability assessment
  'architecture': 'nemotron-3-super:120b',    // System/codebase architecture reasoning
  'code-reasoning': 'nemotron-3-super:120b',  // Deep code analysis + refactoring strategy
};

// ─────────────────────────────────────────────────────────────
// Context Window Sizes (num_ctx)
//
// Controls VRAM usage per model. Qwen 3.5 defaults to 262K context which
// balloons a 2b model from 2.7GB → 10.5GB. Explicit num_ctx keeps models
// lean so multiple can coexist in 16GB VRAM (RTX 5080).
//
// VRAM budget with these settings:
//   9b (8K ctx) ≈ 7.5GB  +  2b (4K ctx) ≈ 3GB  =  ~10.5GB ✓
//   9b (8K ctx) ≈ 7.5GB  +  0.8b (4K ctx) ≈ 1.2GB  =  ~8.7GB ✓
// ─────────────────────────────────────────────────────────────
export const CONTEXT_SIZES: Record<string, number> = {
  // Routing & classification — tiny context, just need the message
  toolRouter: 2048,
  router: 2048,
  fast: 4096,

  // Subagent tasks — focused single-task, don't need big context
  subagent: 4096,
  compression: 4096,
  vision: 4096,

  // Main chat & reasoning — moderate context for conversation history
  chat: 8192,
  research: 8192,
  thinking: 8192,
  executor: 8192,
  orchestrator: 8192,
  planner: 8192,

  // Creative & production — larger for complex multi-step generation
  copywriting: 16384,
  production: 16384,
  strategy: 16384,
};

/** Get the num_ctx for a pipeline stage. Returns undefined if not configured (uses model default). */
export function getContextSize(stage: string): number | undefined {
  return CONTEXT_SIZES[stage];
}

/** Derive num_ctx from a model name. Used by VramManager when stage isn't known. */
export function getContextSizeForModel(model: string): number {
  const lc = model.toLowerCase();
  if (lc.includes('0.8b') || lc.includes('0.6b')) return 4096;
  if (lc.includes('1b')) return 4096;
  if (lc.includes('2b')) return 4096;
  if (lc.includes('4b')) return 8192;
  if (lc.includes('9b')) return 8192;
  if (lc.includes('27b')) return 16384;
  if (lc.includes('nemotron') || lc.includes('120b')) return 16384;
  return 8192;
}

/** Neuro personality model — style rewriting & identity questions */
export function getNeuroModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('neuro_model');
    if (stored) return stored;
  }
  return MODEL_CONFIG.neuro;
}

/** Get model for a pipeline stage — reads from localStorage with fallback */
export function getModelForStage(stage: string): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`model_${stage}`);
    if (stored) return stored;
  }
  return MODEL_CONFIG[stage] || 'qwen3.5:4b';
}

/** Vision model — used for screenshot analysis everywhere */
export function getVisionModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('vision_model');
    if (stored) return stored;
  }
  return MODEL_CONFIG.vision;
}

/**
 * Image model — used when the agent loop detects image content in the conversation.
 * Needs to be a model capable of reasoning about image descriptions/context, so minimum 9b.
 * Note: the actual pixel data is handled by image_analyze tool (vision model); this model
 * is for the main agent loop when images are present in the user message.
 */
export function getImageModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('image_model');
    if (stored && !stored.includes('0.8b') && !stored.includes('2b')) return stored;
  }
  return 'qwen3.5:9b';
}

/** Thinking model — used for deep reasoning / chain-of-thought tasks */
export function getThinkingModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('thinking_model');
    if (stored) return stored;
  }
  return MODEL_CONFIG.thinking;
}

/**
 * Get thinking token budget for a specific context
 * Controls how many thinking tokens to allow per LLM call
 * Higher = more reasoning but slower generation
 */
export interface ThinkingBudget {
  maxThinkingTokens?: number;  // max thinking tokens (e.g. 5000, 10000)
  enabled: boolean;             // whether to enable thinking for this context
}

const THINKING_BUDGETS: Record<ThinkContext, ThinkingBudget> = {
  orchestrator: { enabled: true, maxThinkingTokens: 8000 },    // decides what to research
  synthesis: { enabled: true, maxThinkingTokens: 10000 },      // synthesizes findings
  reflection: { enabled: true, maxThinkingTokens: 5000 },      // gap analysis
  strategy: { enabled: true, maxThinkingTokens: 8000 },        // creative strategy
  analysis: { enabled: true, maxThinkingTokens: 6000 },        // deep analysis
  code_reasoning: { enabled: true, maxThinkingTokens: 15000 },       // nemotron deep code analysis
  security_audit: { enabled: true, maxThinkingTokens: 15000 },       // nemotron security assessment
  architecture_analysis: { enabled: true, maxThinkingTokens: 12000 }, // nemotron architecture reasoning
  deep_validation: { enabled: true, maxThinkingTokens: 10000 },      // nemotron post-synthesis validation
  compression: { enabled: false },                             // fast page compression
  extraction: { enabled: false },                              // fact extraction
  title: { enabled: false },                                   // title generation
  vision: { enabled: false },                                  // image analysis
  fast: { enabled: false },                                    // 0.8b fast models
  executor: { enabled: false },                                // plan-act execution
  chat: { enabled: false },                                    // casual conversation
};

/** Get thinking token budget for a given context */
export function getThinkingBudget(context?: ThinkContext): ThinkingBudget {
  if (!context) return { enabled: false };
  return THINKING_BUDGETS[context] ?? { enabled: false };
}

/** Deep reasoning model — nemotron for security, architecture, code analysis */
export function getDeepReasoningModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('deep_reasoning_model');
    if (stored) return stored;
  }
  return MODEL_CONFIG['deep-analysis'];
}

/** Planner model — used by Plan-Act agent for decomposing goals into steps */
export function getPlannerModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('planner_model');
    if (stored) return stored;
  }
  return MODEL_CONFIG.planner;
}

/** Executor model — used by Plan-Act agent for executing individual actions */
export function getExecutorModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('executor_model');
    if (stored) return stored;
  }
  return MODEL_CONFIG.executor;
}

/**
 * Get chat model — used for Brand DNA editor, ActionSidebar conversation,
 * and any feature that requires real conversation/reasoning.
 *
 * IMPORTANT: Always returns at minimum qwen3.5:9b.
 * Do NOT swap this for a 0.8b model — too small for conversation.
 */
export function getChatModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('chat_model');
    // Guard: never use 0.8b for conversation
    if (stored && !stored.includes('0.8b')) return stored;
  }
  return 'qwen3.5:9b';
}

/** Vision executor settings — tuned for FAST action-oriented responses */
export interface VisionExecutorConfig {
  num_predict: number;
  temperature: number;
  top_p: number;
}

/** Get vision executor config — low tokens, low temp for fast action decisions */
export function getVisionExecutorConfig(): VisionExecutorConfig {
  return {
    num_predict: 80,
    temperature: 0.1,
    top_p: 0.8,
  };
}

/** Get vision verifier config — slightly more tokens for verification reasoning */
export function getVisionVerifierConfig(): VisionExecutorConfig {
  return {
    num_predict: 100,
    temperature: 0.2,
    top_p: 0.85,
  };
}

/** Available vision-capable models for the selector */
export const VISION_MODEL_OPTIONS = [
  { value: 'qwen3.5:2b', label: 'Qwen 3.5 0.8B (Fast)' },
  { value: 'qwen3.5:4b', label: 'Qwen 3.5 4B' },
  { value: 'qwen3.5:9b', label: 'Qwen 3.5 9B' },
] as const;

/** Available thinking models for the selector */
export const THINKING_MODEL_OPTIONS = [
  { value: 'qwen3.5:2b', label: 'Qwen 3.5 0.8B (Fast)' },
  { value: 'qwen3.5:4b', label: 'Qwen 3.5 4B' },
  { value: 'qwen3.5:9b', label: 'Qwen 3.5 9B' },
  { value: 'qwen3.5:27b', label: 'Qwen 3.5 27B' },
  { value: 'nemotron-3-super:120b', label: 'Nemotron 3 Super 120B' },
] as const;

/** Available chat/general models for Brand DNA editor etc. */
export const CHAT_MODEL_OPTIONS = [
  { value: 'qwen3.5:2b', label: 'Qwen 3.5 0.8B (Fast)' },
  { value: 'qwen3.5:2b', label: 'Qwen 3.5 2B' },
  { value: 'qwen3.5:4b', label: 'Qwen 3.5 4B' },
  { value: 'qwen3.5:9b', label: 'Qwen 3.5 9B' },
  { value: 'qwen3.5:27b', label: 'Qwen 3.5 27B' },
  { value: 'nemotron-3-super:120b', label: 'Nemotron 3 Super 120B' },
] as const;

// ─────────────────────────────────────────────────────────────
// Research model config — granular per-role assignments
// ─────────────────────────────────────────────────────────────

export interface ResearchModelConfig {
  orchestratorModel: string;          // Decides what to research next (strategic reasoning)
  researcherSynthesisModel: string;   // Synthesizes compressed web pages into findings
  compressionModel: string;           // Compresses raw web pages (fast, small model)
  reflectionModel: string;            // Gap analysis reflection agents
  desireLayerModel: string;           // 7-layer desire analysis
  personaSynthesisModel: string;      // Persona generation (creative + analytical)
  councilBrainModel: string;          // Council of marketing brains
  temperature: number;                // 0-1 global default
  maxContext: number;                 // 2048-32768
}

const RESEARCH_DEFAULTS: ResearchModelConfig = {
  orchestratorModel: 'context-1',      // Context-1 if available (routes via orchestratorRouter)
  researcherSynthesisModel: 'qwen3.5:2b',
  compressionModel: 'qwen3.5:2b',
  reflectionModel: 'qwen3.5:4b',
  desireLayerModel: 'qwen3.5:4b',
  personaSynthesisModel: 'qwen3.5:4b',
  councilBrainModel: 'qwen3.5:9b',
  temperature: 0.7,
  maxContext: 8192,
};

/** Get research model config — reads per-role keys from localStorage with backward compat */
export function getResearchModelConfig(): ResearchModelConfig {
  if (typeof window === 'undefined') return RESEARCH_DEFAULTS;

  // Backward compat: if new per-role keys aren't set, fall back to old 'research_model' key
  const legacyModel = localStorage.getItem('research_model') || '';
  const get = (key: string, fallback: string) =>
    localStorage.getItem(key) || legacyModel || fallback;

  return {
    orchestratorModel: get('orchestrator_model', RESEARCH_DEFAULTS.orchestratorModel),
    researcherSynthesisModel: get('researcher_synthesis_model', RESEARCH_DEFAULTS.researcherSynthesisModel),
    compressionModel: localStorage.getItem('compression_model') || RESEARCH_DEFAULTS.compressionModel,
    reflectionModel: get('reflection_model', RESEARCH_DEFAULTS.reflectionModel),
    desireLayerModel: get('desire_layer_model', RESEARCH_DEFAULTS.desireLayerModel),
    personaSynthesisModel: get('persona_synthesis_model', RESEARCH_DEFAULTS.personaSynthesisModel),
    councilBrainModel: get('council_brain_model', RESEARCH_DEFAULTS.councilBrainModel),
    temperature: parseFloat(localStorage.getItem('research_temperature') || '') || RESEARCH_DEFAULTS.temperature,
    maxContext: parseInt(localStorage.getItem('research_max_context') || '') || RESEARCH_DEFAULTS.maxContext,
  };
}

// ─────────────────────────────────────────────────────────────
// Research intensity limits — configurable via Dashboard
// ─────────────────────────────────────────────────────────────

export interface ResearchLimits {
  maxIterations: number;
  minIterations: number;
  coverageThreshold: number;
  minSources: number;
  maxResearchersPerIteration: number;
  maxTimeMinutes: number;
  parallelCompressionCount: number;
  // Max-tier exclusive features
  crossValidation: boolean;        // Re-search to verify claims from multiple sources
  multiLanguageSearch: boolean;    // Search in Spanish, French, German, Japanese etc.
  historicalAnalysis: boolean;     // Search across years (2020-2026) for trend mapping
  communityDeepDive: boolean;     // Dedicated Reddit / Quora / niche forum passes
  competitorAdScrape: boolean;    // Facebook Ad Library, Google Ads scraping
  academicSearch: boolean;         // Google Scholar, PubMed for clinical/scientific backing
  maxVisualBatches: number;       // Max visual scout batches per research run
  maxVisualUrls: number;          // Max total URLs to screenshot for visual analysis
  skipReflection: boolean;        // Skip reflection agents (SQ mode — faster)
  singlePassResearch: boolean;    // Exit after first research iteration (SQ mode)
  useSubagents: boolean;          // Spawn parallel SubagentManager workers (NR/EX/MX only)
}

const LIMITS_DEFAULTS: ResearchLimits = {
  maxIterations: 30,
  minIterations: 8,
  coverageThreshold: 0.99,
  minSources: 75,
  maxResearchersPerIteration: 5,
  maxTimeMinutes: 90,
  parallelCompressionCount: 4,
  crossValidation: false,
  multiLanguageSearch: false,
  historicalAnalysis: false,
  communityDeepDive: false,
  competitorAdScrape: false,
  academicSearch: false,
  maxVisualBatches: 0,
  maxVisualUrls: 0,
  skipReflection: false,
  singlePassResearch: false,
  useSubagents: false,
};

// ─────────────────────────────────────────────────────────────
// Research Depth Presets
// ─────────────────────────────────────────────────────────────

export type ResearchDepthPreset = 'super-quick' | 'quick' | 'normal' | 'extended' | 'max';

export interface ResearchPresetDef {
  id: ResearchDepthPreset;
  label: string;
  shortLabel: string;
  description: string;
  time: string;
  color: string;           // Tailwind accent color class
  limits: ResearchLimits;
}

export const RESEARCH_PRESETS: ResearchPresetDef[] = [
  {
    id: 'super-quick',
    label: 'Flash',
    shortLabel: 'Flash',
    description: 'Surface scan, enough for a quick take',
    time: '~5 min',
    color: 'sky',
    limits: {
      maxIterations: 5,
      minIterations: 2,
      coverageThreshold: 0.55,
      minSources: 8,
      maxResearchersPerIteration: 3,
      maxTimeMinutes: 5,
      parallelCompressionCount: 2,
      crossValidation: false,
      multiLanguageSearch: false,
      historicalAnalysis: false,
      communityDeepDive: false,
      competitorAdScrape: false,
      academicSearch: false,
      maxVisualBatches: 0,
      maxVisualUrls: 0,
      skipReflection: true,
      singlePassResearch: true,
      useSubagents: false,
    },
  },
  {
    id: 'quick',
    label: 'Quick',
    shortLabel: 'Quick',
    description: 'Solid overview with real data',
    time: '~30 min',
    color: 'emerald',
    limits: {
      maxIterations: 12,
      minIterations: 4,
      coverageThreshold: 0.75,
      minSources: 25,
      maxResearchersPerIteration: 4,
      maxTimeMinutes: 30,
      parallelCompressionCount: 4,
      crossValidation: false,
      multiLanguageSearch: false,
      historicalAnalysis: false,
      communityDeepDive: false,
      competitorAdScrape: false,
      academicSearch: false,
      maxVisualBatches: 0,
      maxVisualUrls: 0,
      skipReflection: false,
      singlePassResearch: false,
      useSubagents: false,
    },
  },
  {
    id: 'normal',
    label: 'Standard',
    shortLabel: 'Standard',
    description: 'Thorough analysis, production quality',
    time: '~90 min',
    color: 'blue',
    limits: {
      maxIterations: 30,
      minIterations: 8,
      coverageThreshold: 0.99,
      minSources: 75,
      maxResearchersPerIteration: 5,
      maxTimeMinutes: 90,
      parallelCompressionCount: 6,
      crossValidation: false,
      multiLanguageSearch: false,
      historicalAnalysis: false,
      communityDeepDive: false,
      competitorAdScrape: false,
      academicSearch: false,
      maxVisualBatches: 1,
      maxVisualUrls: 5,
      skipReflection: false,
      singlePassResearch: false,
      useSubagents: true,
    },
  },
  {
    id: 'extended',
    label: 'Deep',
    shortLabel: 'Deep',
    description: 'Deep dive + visual competitor analysis, cross-validation',
    time: '~2 hrs',
    color: 'sky',
    limits: {
      maxIterations: 45,
      minIterations: 12,
      coverageThreshold: 0.99,
      minSources: 200,
      maxResearchersPerIteration: 5,
      maxTimeMinutes: 120,
      parallelCompressionCount: 8,
      crossValidation: true,
      multiLanguageSearch: false,
      historicalAnalysis: false,
      communityDeepDive: true,
      competitorAdScrape: true,
      academicSearch: false,
      maxVisualBatches: 3,
      maxVisualUrls: 15,
      skipReflection: false,
      singlePassResearch: false,
      useSubagents: true,
    },
  },
  {
    id: 'max',
    label: 'Maximum',
    shortLabel: 'Max',
    description: 'Exhaustive — every angle, every source, every language, deep visuals',
    time: '~5 hrs',
    color: 'red',
    limits: {
      maxIterations: 100,
      minIterations: 25,
      coverageThreshold: 0.995,
      minSources: 400,
      maxResearchersPerIteration: 5,
      maxTimeMinutes: 300,
      parallelCompressionCount: 12,
      crossValidation: true,
      multiLanguageSearch: true,
      historicalAnalysis: true,
      communityDeepDive: true,
      competitorAdScrape: true,
      academicSearch: true,
      maxVisualBatches: 5,
      maxVisualUrls: 30,
      skipReflection: false,
      singlePassResearch: false,
      useSubagents: true,
    },
  },
];

/** Apply a research depth preset — writes all values to localStorage */
export function applyResearchPreset(presetId: ResearchDepthPreset): void {
  const preset = RESEARCH_PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  const l = preset.limits;
  localStorage.setItem('research_depth_preset', presetId);
  localStorage.setItem('max_research_iterations', String(l.maxIterations));
  localStorage.setItem('min_research_iterations', String(l.minIterations));
  localStorage.setItem('coverage_target', String(l.coverageThreshold));
  localStorage.setItem('min_research_sources', String(l.minSources));
  localStorage.setItem('max_researchers_per_iteration', String(l.maxResearchersPerIteration));
  localStorage.setItem('max_research_time_minutes', String(l.maxTimeMinutes));
  localStorage.setItem('parallel_compression_count', String(l.parallelCompressionCount));
  localStorage.setItem('research_cross_validation', String(l.crossValidation));
  localStorage.setItem('research_multi_language', String(l.multiLanguageSearch));
  localStorage.setItem('research_historical_analysis', String(l.historicalAnalysis));
  localStorage.setItem('research_community_deep_dive', String(l.communityDeepDive));
  localStorage.setItem('research_competitor_ad_scrape', String(l.competitorAdScrape));
  localStorage.setItem('research_academic_search', String(l.academicSearch));
  localStorage.setItem('max_visual_batches', String(l.maxVisualBatches));
  localStorage.setItem('max_visual_urls', String(l.maxVisualUrls));
  localStorage.setItem('research_skip_reflection', String(l.skipReflection));
  localStorage.setItem('research_single_pass', String(l.singlePassResearch));
  localStorage.setItem('research_use_subagents', String(l.useSubagents));
}

/** Get the active research depth preset (or 'custom' if values were tweaked) */
export function getActiveResearchPreset(): ResearchDepthPreset | 'custom' {
  const stored = localStorage.getItem('research_depth_preset');
  if (stored && RESEARCH_PRESETS.some(p => p.id === stored)) {
    return stored as ResearchDepthPreset;
  }
  return 'normal'; // default
}

/** Get research intensity limits from localStorage with fallback to defaults */
export function getResearchLimits(): ResearchLimits {
  if (typeof window === 'undefined') return LIMITS_DEFAULTS;

  const getInt = (key: string, fallback: number) => {
    const v = parseInt(localStorage.getItem(key) || '');
    return isNaN(v) ? fallback : v;
  };
  const getFloat = (key: string, fallback: number) => {
    const v = parseFloat(localStorage.getItem(key) || '');
    return isNaN(v) ? fallback : v;
  };

  const getBool = (key: string, fallback: boolean) => {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  };

  return {
    maxIterations: getInt('max_research_iterations', LIMITS_DEFAULTS.maxIterations),
    minIterations: getInt('min_research_iterations', LIMITS_DEFAULTS.minIterations),
    coverageThreshold: getFloat('coverage_target', LIMITS_DEFAULTS.coverageThreshold),
    minSources: getInt('min_research_sources', LIMITS_DEFAULTS.minSources),
    maxResearchersPerIteration: getInt('max_researchers_per_iteration', LIMITS_DEFAULTS.maxResearchersPerIteration),
    maxTimeMinutes: getInt('max_research_time_minutes', LIMITS_DEFAULTS.maxTimeMinutes),
    parallelCompressionCount: getInt('parallel_compression_count', LIMITS_DEFAULTS.parallelCompressionCount),
    crossValidation: getBool('research_cross_validation', LIMITS_DEFAULTS.crossValidation),
    multiLanguageSearch: getBool('research_multi_language', LIMITS_DEFAULTS.multiLanguageSearch),
    historicalAnalysis: getBool('research_historical_analysis', LIMITS_DEFAULTS.historicalAnalysis),
    communityDeepDive: getBool('research_community_deep_dive', LIMITS_DEFAULTS.communityDeepDive),
    competitorAdScrape: getBool('research_competitor_ad_scrape', LIMITS_DEFAULTS.competitorAdScrape),
    academicSearch: getBool('research_academic_search', LIMITS_DEFAULTS.academicSearch),
    maxVisualBatches: getInt('max_visual_batches', LIMITS_DEFAULTS.maxVisualBatches),
    maxVisualUrls: getInt('max_visual_urls', LIMITS_DEFAULTS.maxVisualUrls),
    skipReflection: getBool('research_skip_reflection', LIMITS_DEFAULTS.skipReflection),
    singlePassResearch: getBool('research_single_pass', LIMITS_DEFAULTS.singlePassResearch),
    useSubagents: getBool('research_use_subagents', LIMITS_DEFAULTS.useSubagents),
  };
}

// ─────────────────────────────────────────────────────────────
// Neuro Mode system — hardware-targeted presets (LITE / PRO / MAX)
// ─────────────────────────────────────────────────────────────

export type NeuroMode = 'lite' | 'pro' | 'max';

export interface ModePreset {
  label: string;
  description: string;
  fastModel: string;
  capableModel: string;
  heavyModel: string;
  residentModel?: string;   // GPU-resident for MAX
  visionModel: string;
  toolRouter: string;
  maxParallelSubagents: number;
  maxContextTokens: number;
  maxResearchDepth: string;  // SQ/QK/NR/EX/MX
}

export const MODE_PRESETS: Record<NeuroMode, ModePreset> = {
  lite: {
    label: 'NEURO LITE',
    description: 'M1 Max 32GB -- local, fast, chill',
    fastModel: 'qwen3.5:2b',
    capableModel: 'qwen3.5:2b',
    heavyModel: 'qwen3.5:4b',
    visionModel: 'qwen3.5:2b',
    toolRouter: 'allenporter/xlam:1b',
    maxParallelSubagents: 2,
    maxContextTokens: 4096,
    maxResearchDepth: 'QK',
  },
  pro: {
    label: 'NEURO PRO',
    description: 'M5 Max 48GB -- balanced quality and speed',
    fastModel: 'qwen3.5:2b',
    capableModel: 'qwen3.5:4b',
    heavyModel: 'qwen3.5:9b',
    visionModel: 'qwen3.5:2b',
    toolRouter: 'allenporter/xlam:1b',
    maxParallelSubagents: 4,
    maxContextTokens: 8192,
    maxResearchDepth: 'EX',
  },
  max: {
    label: 'NEURO MAX',
    description: 'RTX 5080 + 128GB -- maximum everything',
    fastModel: 'qwen3.5:4b',
    capableModel: 'qwen3.5:9b',
    heavyModel: 'qwen3.5:27b',
    residentModel: 'nemotron-3-super:120b',  // Nemotron 3 Super 120B GPU-resident
    visionModel: 'qwen3.5:2b',
    toolRouter: 'allenporter/xlam:1b',
    maxParallelSubagents: 8,
    maxContextTokens: 32768,
    maxResearchDepth: 'MX',
  },
};

/** Read the current Neuro mode from localStorage (default: 'max') */
export function getCurrentMode(): NeuroMode {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('neuro_mode');
    if (stored && (stored === 'lite' || stored === 'pro' || stored === 'max')) {
      return stored;
    }
  }
  return 'max';
}

/** Set the active Neuro mode and apply its model assignments */
export function setMode(mode: NeuroMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('neuro_mode', mode);

  const preset = MODE_PRESETS[mode];

  // Apply stage-level model assignments (unless per-stage override exists)
  const stageMap: Record<string, string> = {
    // fast tier
    compression: preset.fastModel,
    vision: preset.visionModel,
    'verify-state': preset.fastModel,
    executor: preset.fastModel,
    fast: preset.fastModel,
    router: preset.fastModel,
    toolRouter: preset.fastModel,
    // capable tier
    research: preset.capableModel,
    'brand-dna': preset.capableModel,
    'persona-dna': preset.capableModel,
    angles: preset.capableModel,
    strategy: preset.capableModel,
    copywriting: preset.capableModel,
    thinking: preset.capableModel,
    planner: preset.capableModel,
    chat: preset.capableModel,
    // heavy tier
    production: preset.heavyModel,
    test: preset.heavyModel,
  };

  for (const [stage, model] of Object.entries(stageMap)) {
    localStorage.setItem(`model_${stage}`, model);
  }

  // Research role assignments
  localStorage.setItem('orchestrator_model', preset.capableModel);
  localStorage.setItem('researcher_synthesis_model', preset.fastModel);
  localStorage.setItem('compression_model', preset.fastModel);
  localStorage.setItem('reflection_model', preset.capableModel);
  localStorage.setItem('desire_layer_model', preset.capableModel);
  localStorage.setItem('persona_synthesis_model', preset.capableModel);
  localStorage.setItem('council_brain_model', preset.heavyModel);

  // Vision + chat + thinking
  localStorage.setItem('vision_model', preset.visionModel);
  localStorage.setItem('chat_model', preset.capableModel);
  localStorage.setItem('thinking_model', preset.capableModel);
  localStorage.setItem('planner_model', preset.capableModel);
  localStorage.setItem('executor_model', preset.fastModel);

  // xLAM tool router
  localStorage.setItem('model_xlam', preset.toolRouter);

  // Context limit
  localStorage.setItem('research_max_context', String(preset.maxContextTokens));
}

/** Get the active mode preset definition */
export function getModePreset(): ModePreset {
  return MODE_PRESETS[getCurrentMode()];
}

/** Get max allowed research depth labels for the current mode */
export function getModeMaxResearchDepth(): string {
  return getModePreset().maxResearchDepth;
}

/** Get max parallel subagents for the current mode */
export function getModeMaxParallelSubagents(): number {
  return getModePreset().maxParallelSubagents;
}

/** Get max context tokens for the current mode */
export function getModeMaxContextTokens(): number {
  return getModePreset().maxContextTokens;
}

// ─────────────────────────────────────────────────────────────
// Model Tier system — one-click presets for all model assignments
// ─────────────────────────────────────────────────────────────

export type ModelTier = 'light' | 'standard' | 'quality' | 'maximum';

export interface ModelTierDef {
  id: ModelTier;
  label: string;
  description: string;
  /** [fast model, capable model] — fast for compression/extraction, capable for reasoning */
  models: [string, string];
}

export const MODEL_TIERS: ModelTierDef[] = [
  { id: 'light',    label: 'Light',    description: '0.8b + 2b — fastest, least VRAM',   models: ['qwen3.5:2b', 'qwen3.5:2b'] },
  { id: 'standard', label: 'Standard', description: '2b + 4b — good balance',            models: ['qwen3.5:2b',   'qwen3.5:4b'] },
  { id: 'quality',  label: 'Quality',  description: '4b + 9b — higher quality output',   models: ['qwen3.5:4b',   'qwen3.5:9b'] },
  { id: 'maximum',  label: 'Maximum',  description: '9b + 27b — best quality, most VRAM', models: ['qwen3.5:9b',  'qwen3.5:27b'] },
];

/** Apply a model tier — sets all stage + research role model assignments */
export function applyModelTier(tierId: ModelTier): void {
  const tier = MODEL_TIERS.find(t => t.id === tierId);
  if (!tier) return;
  const [fast, capable] = tier.models;

  // Stage-level assignments
  const stageAssignments: Record<string, string> = {
    research: capable,
    'brand-dna': capable,
    'persona-dna': capable,
    angles: capable,
    strategy: capable,
    copywriting: capable,
    production: capable,
    test: capable,
    vision: fast,
    thinking: capable,
    planner: capable,
    executor: fast,
  };
  for (const [stage, model] of Object.entries(stageAssignments)) {
    localStorage.setItem(`model_${stage}`, model);
  }

  // Research role assignments
  localStorage.setItem('orchestrator_model', capable);
  localStorage.setItem('researcher_synthesis_model', fast);
  localStorage.setItem('compression_model', fast);
  localStorage.setItem('reflection_model', capable);
  localStorage.setItem('desire_layer_model', capable);
  localStorage.setItem('persona_synthesis_model', capable);
  localStorage.setItem('council_brain_model', capable);

  // Chat model
  localStorage.setItem('chat_model', capable);

  // Vision model
  localStorage.setItem('vision_model', fast);
  localStorage.setItem('thinking_model', capable);
  localStorage.setItem('planner_model', capable);
  localStorage.setItem('executor_model', fast);

  // Store the active tier
  localStorage.setItem('model_tier', tierId);
}

/** Get the active model tier */
export function getActiveModelTier(): ModelTier {
  const stored = localStorage.getItem('model_tier');
  if (stored && MODEL_TIERS.some(t => t.id === stored)) return stored as ModelTier;
  return 'standard';
}

/** Get model role assignments for a given tier */
export function getModelRoleAssignments(tierId: ModelTier): Record<string, string> {
  const tier = MODEL_TIERS.find(t => t.id === tierId);
  if (!tier) return {};
  const [fast, capable] = tier.models;
  return {
    'Orchestrator (research planning)': capable,
    'Researcher (synthesis)': fast,
    'Compression': fast,
    'Reflection (analysis)': capable,
    'Desire Analysis': capable,
    'Persona Synthesis': capable,
    'Council Brain': capable,
    'Chat & Thinking': capable,
    'Vision Analysis': fast,
    'Tool Router': 'allenporter/xlam:1b',
  };
}

// ─────────────────────────────────────────────────────────────
// Think mode — global toggle for Qwen 3.5 thinking
// ─────────────────────────────────────────────────────────────

/**
 * Context-aware think mode — decides automatically based on task type.
 * No manual toggle needed; the system picks the right mode per situation.
 *
 * Think ON:  orchestrator decisions, synthesis, strategy, complex analysis
 * Think OFF: compression, extraction, title generation, vision, small models, greetings
 */
export type ThinkContext =
  | 'orchestrator'    // deciding what to research next → think
  | 'synthesis'       // synthesizing research findings → think
  | 'reflection'      // evaluating coverage gaps → think
  | 'strategy'        // creative/brand strategy → think
  | 'analysis'        // deep analysis tasks → think
  | 'code_reasoning'       // deep code analysis with extended thinking → think (nemotron)
  | 'security_audit'       // security vulnerability assessment → think (nemotron)
  | 'architecture_analysis' // system architecture reasoning → think (nemotron)
  | 'deep_validation'      // nemotron validates findings after synthesis → think (nemotron)
  | 'compression'     // page compression → no think
  | 'extraction'      // fact extraction → no think
  | 'title'           // auto-title generation → no think
  | 'vision'          // image analysis → no think
  | 'fast'            // 0.8b fast path, greetings → no think
  | 'executor'        // plan-act executor → no think
  | 'chat';           // casual chat → no think

const THINK_CONTEXTS: Record<ThinkContext, boolean> = {
  orchestrator: true,
  synthesis: true,
  reflection: true,
  strategy: true,
  analysis: true,
  code_reasoning: true,
  security_audit: true,
  architecture_analysis: true,
  deep_validation: true,
  compression: false,
  extraction: false,
  title: false,
  vision: false,
  fast: false,
  executor: false,
  chat: false,
};

/** Get think mode for a given context. Defaults to false for unknown contexts. */
export function getThinkMode(context?: ThinkContext): boolean {
  if (!context) return false;
  return THINK_CONTEXTS[context] ?? false;
}

// ─────────────────────────────────────────────────────────────
// Ollama endpoint URL — configurable via Settings
// ─────────────────────────────────────────────────────────────

/** Get the user-configured Ollama endpoint (or default) */
export function getOllamaEndpoint(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('ollama_endpoint');
    if (stored) return stored;
  }
  return INFRASTRUCTURE.ollamaUrl;
}

/** Set the Ollama endpoint URL */
export function setOllamaEndpoint(url: string): void {
  localStorage.setItem('ollama_endpoint', url);
}

// ─────────────────────────────────────────────────────────────
// Agent max duration
// ─────────────────────────────────────────────────────────────

export type AgentDuration = '30m' | '1h' | '2h' | '5h' | 'unlimited';

export const AGENT_DURATION_OPTIONS: { value: AgentDuration; label: string }[] = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '5h', label: '5 hours' },
  { value: 'unlimited', label: 'Unlimited' },
];

export function getAgentMaxDuration(): AgentDuration {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('agent_max_duration');
    if (stored && AGENT_DURATION_OPTIONS.some(o => o.value === stored)) return stored as AgentDuration;
  }
  return '5h';
}

export function setAgentMaxDuration(dur: AgentDuration): void {
  localStorage.setItem('agent_max_duration', dur);
}

// ─────────────────────────────────────────────────────────────
// Workspace path
// ─────────────────────────────────────────────────────────────

export function getWorkspacePath(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('workspace_path') || '';
  }
  return '';
}

export function setWorkspacePath(path: string): void {
  localStorage.setItem('workspace_path', path);
}

// ─────────────────────────────────────────────────────────────
// localStorage migration — clears dead keys from old versions
// ─────────────────────────────────────────────────────────────

const MIGRATION_VERSION = 3;

/** Run once on first load — removes dead localStorage keys from old model configs */
export function runSettingsMigration(): void {
  if (typeof window === 'undefined') return;
  const migrated = parseInt(localStorage.getItem('settings_migration_version') || '0');
  if (migrated >= MIGRATION_VERSION) return;

  // Dead keys from old model families (GLM, LFM, gpt-oss, minicpm)
  const deadKeys = [
    'research_model',         // replaced by per-role keys + tier system
    'ollama_host',            // replaced by ollama_endpoint
    'model_glm',
    'model_lfm',
    'model_gpt_oss',
    'model_minicpm',
    'glm_model',
    'lfm_model',
    'gpt_oss_model',
    'minicpm_model',
    'minicpm_v_model',
    'vision_model_minicpm',
  ];

  for (const key of deadKeys) {
    localStorage.removeItem(key);
  }

  localStorage.setItem('settings_migration_version', String(MIGRATION_VERSION));
}

// ─────────────────────────────────────────────────────────────
// Per-brain temperature settings
// ─────────────────────────────────────────────────────────────

const BRAIN_TEMP_DEFAULTS: Record<string, number> = {
  desire: 0.8,
  persuasion: 0.7,
  offer: 0.6,
  creative: 0.9,
  avatar: 0.7,
  contrarian: 0.85,
  visual: 0.5,
  // MX-tier brains
  data: 0.3,
  meme: 0.95,
  luxury: 0.6,
  scrappy: 0.9,
  psychology: 0.5,
  cultural: 0.8,
};

/** Get temperature for a specific brain — checks localStorage override first */
export function getBrainTemperature(brainId: string): number {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`brain_temp_${brainId}`);
    if (stored) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= 0 && val <= 2) return val;
    }
  }
  return BRAIN_TEMP_DEFAULTS[brainId] ?? 0.7;
}

/** Set temperature for a specific brain */
export function setBrainTemperature(brainId: string, temp: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`brain_temp_${brainId}`, temp.toString());
  }
}

/** Get all brain temperature defaults (for UI rendering) */
export function getAllBrainTempDefaults(): Record<string, number> {
  return { ...BRAIN_TEMP_DEFAULTS };
}

// ─────────────────────────────────────────────────────────────
// Council scaling config — brain/head count per preset
// ─────────────────────────────────────────────────────────────

export interface CouncilScalingConfig {
  skipCouncil: boolean;          // SQ/QK: skip council entirely
  brainIds: string[];            // which brains to run
  councilHeadCount: number;      // how many heads synthesize
  councilHeadIds: string[];      // which head IDs to use
  creativeEngineEnabled: boolean; // run creative engine after verdict
}

/**
 * Get council scaling config based on the active research preset.
 * SQ/QK: skip council entirely, just use orchestrator decisions
 * NR: 4 brains -> 1 verdict (via single head pass)
 * EX: 7 brains -> 2 council heads -> 1 verdict
 * MX: 12+ brains -> 4 council heads -> 1 master verdict
 */
export function getCouncilScaling(): CouncilScalingConfig {
  const preset = getActiveResearchPreset();

  switch (preset) {
    case 'super-quick':
    case 'quick':
      return {
        skipCouncil: true,
        brainIds: [],
        councilHeadCount: 0,
        councilHeadIds: [],
        creativeEngineEnabled: false,
      };
    case 'normal':
      return {
        skipCouncil: false,
        brainIds: ['desire', 'persuasion', 'creative', 'contrarian'],
        councilHeadCount: 1,
        councilHeadIds: ['strategy-head'],
        creativeEngineEnabled: true,
      };
    case 'extended':
      return {
        skipCouncil: false,
        brainIds: ['desire', 'persuasion', 'offer', 'creative', 'avatar', 'contrarian', 'visual'],
        councilHeadCount: 2,
        councilHeadIds: ['strategy-head', 'creative-head'],
        creativeEngineEnabled: true,
      };
    case 'max':
      return {
        skipCouncil: false,
        brainIds: [
          'desire', 'persuasion', 'offer', 'creative', 'avatar', 'contrarian', 'visual',
          'data', 'meme', 'luxury', 'scrappy', 'psychology', 'cultural',
        ],
        councilHeadCount: 4,
        councilHeadIds: ['strategy-head', 'creative-head', 'challenge-head', 'culture-head'],
        creativeEngineEnabled: true,
      };
    default:
      // custom or unknown — use NR defaults
      return {
        skipCouncil: false,
        brainIds: ['desire', 'persuasion', 'creative', 'contrarian'],
        councilHeadCount: 1,
        councilHeadIds: ['strategy-head'],
        creativeEngineEnabled: true,
      };
  }
}
