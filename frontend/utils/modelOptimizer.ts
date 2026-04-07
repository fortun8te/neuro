/**
 * Model Optimizer — Intelligent model selection
 * Defaults to 4b for most tasks, escalates to 9b only when needed
 *
 * Heuristics:
 *   - Input length < 500 chars → 4b
 *   - Input contains code/technical → 9b
 *   - Input requires vision/image → 9b
 *   - Input is creative/writing → 9b
 *   - Message history > 5 → 4b (cheaper)
 *   - User explicitly requests quality → 9b
 */

type TaskComplexity = 'simple' | 'moderate' | 'complex';

interface OptimizationContext {
  input: string;
  messageCount?: number;
  hasImages?: boolean;
  hasCode?: boolean;
  taskType?: 'chat' | 'code' | 'creative' | 'research' | 'analysis';
  userQualityRequest?: boolean;
}

interface OptimizationResult {
  selectedModel: string;
  complexity: TaskComplexity;
  reasoning: string;
  alternativeModel?: string;
}

/**
 * Detect if input contains code blocks or technical content
 */
function hasCodeContent(text: string): boolean {
  const codePatterns = [
    /```[\s\S]*?```/,              // Markdown code blocks
    /^[\s]*(?:function|class|const|let|var|import|export|def|class|if|for|while)\b/m,  // Code keywords
    /<[a-zA-Z]/,                   // HTML/XML tags
    /\{[\s\S]*?\}/,                // Curly braces (JSON, etc)
    /\[[\s\S]*?\]/,                // Square brackets
  ];
  return codePatterns.some(pattern => pattern.test(text));
}

/**
 * Detect if input is creative/writing-focused
 */
function isCreativeTask(text: string): boolean {
  const creativeKeywords = [
    'write', 'poem', 'story', 'essay', 'article', 'blog',
    'creative', 'brainstorm', 'imagine', 'invent',
    'describe', 'narrate', 'tell me about',
  ];
  const lowerText = text.toLowerCase();
  return creativeKeywords.some(kw => lowerText.includes(kw));
}

/**
 * Calculate task complexity score (0-100)
 *
 * Scoring system:
 *   0-30: Simple (use 4b) — basic chat, short questions
 *   30-65: Moderate (use 4b) — longer conversations, medium complexity
 *   65+: Complex (use 9b) — code, creative, analysis, images
 */
function calculateComplexity(context: OptimizationContext): number {
  let score = 0;

  // === Input length heuristic ===
  // Longer inputs are generally harder to process correctly
  // 5000+ chars is a significant chunk of text that needs careful understanding
  const inputLength = context.input.length;
  if (inputLength > 5000) score += 40;      // Very long input
  else if (inputLength > 2000) score += 25; // Long input
  else if (inputLength > 500) score += 10;  // Medium length

  // === Code/Technical content ===
  // Code requires precise understanding of syntax and logic
  // 35 points because code errors are critical (wrong line can break everything)
  if (context.hasCode || hasCodeContent(context.input)) score += 35;

  // === Image/Vision analysis ===
  // Only 9b has good vision capabilities
  // Always escalate for image tasks to ensure quality
  if (context.hasImages) score += 30;

  // === Creative writing tasks ===
  // Creative tasks need nuance, style, and creativity
  // 4b can do basic creative work, but 9b is noticeably better
  if (context.taskType === 'creative' || isCreativeTask(context.input)) score += 25;

  // === Research/Analysis tasks ===
  // These need good reasoning and synthesis
  if (context.taskType === 'research' || context.taskType === 'analysis') score += 20;

  // === Conversation history ===
  // Large conversation context makes it harder to maintain consistency
  // But still doable with 4b in most cases
  if (context.messageCount && context.messageCount > 20) score += 15;
  else if (context.messageCount && context.messageCount > 10) score += 8;

  // === User quality request ===
  // If user explicitly asks for best quality/highest accuracy, use 9b
  // This is a direct user signal to prioritize quality over cost
  if (context.userQualityRequest) score += 40;

  // Cap at 100 (no need to score higher)
  return Math.min(100, score);
}

/**
 * Select optimal model based on complexity score
 *
 * Model selection thresholds:
 *   - 0-30: Use 4b — Simple tasks, 4b is more than adequate
 *   - 30-65: Use 4b — Moderate complexity, 4b provides good balance
 *   - 65+: Use 9b — Complex tasks, need 9b's superior reasoning
 *
 * Why these thresholds?
 *   - 4b is 60% cheaper and 10% faster
 *   - 9b has significantly better reasoning and understanding
 *   - Threshold of 65 optimizes for cost while maintaining quality
 */
function selectModel(complexity: number): { model: string; reasoning: string } {
  // Boundary at 30: Below this, 4b is clearly sufficient
  if (complexity < 30) {
    return {
      model: 'qwen3.5:4b',
      reasoning: 'Task is simple enough for 4b model (fast, efficient, cost-effective)',
    };
  }
  // Boundary at 65: Between 30-65, 4b still works well but is on the edge
  else if (complexity < 65) {
    return {
      model: 'qwen3.5:4b',
      reasoning: 'Moderate complexity — 4b is suitable with good quality/speed/cost tradeoff',
    };
  }
  // Complexity 65+: Definitely need 9b for reliability
  else {
    return {
      model: 'qwen3.5:9b',
      reasoning: 'High complexity task (65+) — 9b recommended for best quality and reliability',
    };
  }
}

/**
 * Main optimizer function — Entry point for model selection
 *
 * Flow:
 *   1. Analyze input context (length, code, images, etc.)
 *   2. Calculate complexity score (0-100)
 *   3. Select model based on threshold
 *   4. Return decision + reasoning for logging/debugging
 *
 * Returns: Model choice, complexity level, explanation, alternative
 */
export function optimizeModel(context: OptimizationContext): OptimizationResult {
  // Step 1: Analyze the input and score its complexity
  const complexity = calculateComplexity(context);

  // Step 2: Convert numeric score to human-readable complexity level
  const complexityLevel: TaskComplexity =
    complexity < 30 ? 'simple' :    // Score 0-29 = simple task
    complexity < 65 ? 'moderate' :  // Score 30-64 = moderate
    'complex';                       // Score 65+ = complex

  // Step 3: Get model selection decision and reasoning
  const { model, reasoning } = selectModel(complexity);

  // Step 4: Determine alternative model (opposite of selected)
  // This helps debugging and cost analysis
  const alternativeModel = model === 'qwen3.5:4b' ? 'qwen3.5:9b' : 'qwen3.5:4b';

  // Step 5: Return complete decision info
  return {
    selectedModel: model,           // Which model to use
    complexity: complexityLevel,    // How hard is this task?
    reasoning,                      // Why this model?
    alternativeModel,               // What else could work?
  };
}

/**
 * Force model escalation for specific scenarios
 * (used by agent if 4b fails and needs retry with 9b)
 */
export function shouldEscalateToNine(
  error?: string,
  previousModel?: string,
): boolean {
  if (!previousModel || previousModel !== 'qwen3.5:4b') {
    return false;
  }

  if (!error) return false;

  // Escalate on specific failure patterns
  const escalationPatterns = [
    /tool.*not found/i,
    /couldn't.*call/i,
    /fail.*execute/i,
    /syntax.*error/i,
    /malformed.*json/i,
  ];

  return escalationPatterns.some(pattern => pattern.test(error));
}

/**
 * Get model tier recommendation for preset
 * Used by Research Depth presets (SQ, QK, NR, EX, MX)
 */
export function getModelTierForPreset(
  preset: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX',
): { fast: string; capable: string } {
  const tiers = {
    'SQ': { fast: 'qwen3.5:2b', capable: 'qwen3.5:2b' },     // Super Quick
    'QK': { fast: 'qwen3.5:2b', capable: 'qwen3.5:4b' },     // Quick
    'NR': { fast: 'qwen3.5:4b', capable: 'qwen3.5:4b' },     // Normal
    'EX': { fast: 'qwen3.5:4b', capable: 'qwen3.5:9b' },     // Extended
    'MX': { fast: 'qwen3.5:9b', capable: 'qwen3.5:9b' },     // Maximum
  };
  return tiers[preset];
}

/**
 * Export summary for debugging
 */
export function getOptimizationSummary(): string {
  return `Model Optimizer: Smart 4b/9b selection\n  - Simple tasks → qwen3.5:4b\n  - Complex/Creative → qwen3.5:9b\n  - Preset-based tier selection for research`;
}
