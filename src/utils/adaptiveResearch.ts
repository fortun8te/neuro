/**
 * Adaptive Research Depth Calculator
 *
 * Evaluates question complexity and determines optimal research depth
 * Instead of fixed search counts, adapts based on actual question needs
 */

export interface ComplexityAnalysis {
  score: number; // 1-10
  reasoning: string;
  searchCount: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

/**
 * Analyzes question complexity based on multiple factors
 */
export function analyzeComplexity(question: string): ComplexityAnalysis {
  let score = 0;
  const factors = [];

  // Factor 1: Length & Structure (AGGRESSIVE)
  const wordCount = question.split(/\s+/).length;
  if (wordCount > 150) {
    score += 3;
    factors.push('Very long, highly detailed question');
  } else if (wordCount > 100) {
    score += 2.5;
    factors.push('Long, detailed question');
  } else if (wordCount > 50) {
    score += 1.5;
    factors.push('Moderate length');
  }

  // Factor 2: Geographic Scope (AGGRESSIVE)
  const regions = (question.match(/EU|US|China|UK|Canada|APAC|global|international|worldwide|cross-border|multinational/gi) || []).length;
  if (regions >= 3) {
    score += 3.5;
    factors.push(`Multi-region analysis (${regions} regions)`);
  } else if (regions >= 1) {
    score += 1.5;
    factors.push(`Regional context (${regions} region)`);
  }

  // Factor 3: Temporal Scope (AGGRESSIVE)
  if (question.match(/2025-2030|through 2030|2030|emerging|future|long-term|outlook|prediction/i)) {
    score += 2;
    factors.push('Future/long-term perspective needed');
  }
  if (question.match(/historical|past|evolution|trend|change|shift/i)) {
    score += 1;
    factors.push('Historical context and trends required');
  }

  // Factor 4: Data Type Diversity (AGGRESSIVE - each type worth more)
  const hasEconomics = question.match(/economic|market|revenue|pricing|cost|unit economics|financial|valuation|funding/i) ? 1.2 : 0;
  const hasPsychology = question.match(/psychology|behavior|perception|sentiment|motivation|desire|fear|emotion|driver/i) ? 1.2 : 0;
  const hasComparison = question.match(/vs|versus|compare|different|divergent|competing|competitive|advantage|positioning/i) ? 1.2 : 0;
  const hasTrends = question.match(/emerging|trend|shift|evolving|innovation|pattern|movement|dynamic/i) ? 1.2 : 0;
  const hasValidation = question.match(/reality|practice|actual|real|verified|proven|data|evidence|why/i) ? 1.2 : 0;

  const dataTypes = hasEconomics + hasPsychology + hasComparison + hasTrends + hasValidation;
  score += dataTypes;
  if (dataTypes > 0) {
    factors.push(`${dataTypes.toFixed(1)} data types`);
  }

  // Factor 5: Causal/Mechanistic Understanding (AGGRESSIVE)
  if (question.match(/why|how|mechanism|driver|cause|effect|relationship|dynamics|implication|convergence/i)) {
    score += 1.5;
    factors.push('Deep causal analysis needed');
  }

  // Factor 6: Multi-Angle Analysis (AGGRESSIVE)
  const semicolons = (question.match(/[;–—]/g) || []).length;
  const commaCount = (question.match(/,/g) || []).length;
  const totalAngles = semicolons + Math.floor(commaCount / 3);

  if (totalAngles >= 5) {
    score += 2.5;
    factors.push(`Many subtopics (${totalAngles}+ angles)`);
  } else if (totalAngles >= 3) {
    score += 2;
    factors.push(`Multiple subtopics (${totalAngles} angles)`);
  } else if (totalAngles >= 1) {
    score += 1;
    factors.push('Multiple angles');
  }

  // Factor 7: Cross-Domain Synthesis (AGGRESSIVE)
  if (question.match(/convergence|interaction|synergy|integration|overlap|interconnect|multi-factor/i)) {
    score += 1.5;
    factors.push('Complex multi-domain synthesis required');
  }

  // Factor 8: Research Intensity Keywords (NEW)
  if (question.match(/analyze|examine|explore|investigate|deep|comprehensive|thorough/i)) {
    score += 1;
    factors.push('Research-intensive language');
  }

  // Normalize score to 1-10
  score = Math.min(Math.max(score, 1), 10);
  score = Math.round(score * 10) / 10;

  // Determine search count based on complexity
  const searchCount = calculateSearchCount(score);

  // Distribute across tiers
  const tiers = distributeTiers(searchCount);

  const reasoning = factors.join('; ');

  return {
    score,
    reasoning,
    searchCount,
    tier1: tiers.tier1,
    tier2: tiers.tier2,
    tier3: tiers.tier3,
  };
}

/**
 * Determines how many total searches needed based on complexity score
 * AGGRESSIVE: Go deep on complex questions
 */
function calculateSearchCount(complexity: number): number {
  if (complexity <= 2) return 3;
  if (complexity <= 3) return 5;
  if (complexity <= 4) return 8;
  if (complexity <= 5) return 12;
  if (complexity <= 6) return 18;
  if (complexity <= 7) return 25;
  if (complexity <= 8) return 35;
  if (complexity <= 9) return 45;
  return 60; // Maximum: 60 searches for ultra-complex questions
}

/**
 * Distributes search count across 3 tiers (AGGRESSIVE)
 */
function distributeTiers(
  searchCount: number
): { tier1: number; tier2: number; tier3: number } {
  if (searchCount <= 3) {
    return { tier1: searchCount, tier2: 0, tier3: 0 };
  }

  if (searchCount <= 5) {
    return { tier1: 3, tier2: searchCount - 3, tier3: 0 };
  }

  if (searchCount <= 12) {
    return { tier1: 4, tier2: searchCount - 4, tier3: 0 };
  }

  if (searchCount <= 25) {
    // Medium-high: 40% tier1, 60% tier2
    const tier1 = Math.ceil(searchCount * 0.4);
    const tier2 = searchCount - tier1;
    return { tier1, tier2, tier3: 0 };
  }

  // Very high complexity: aggressive use of all 3 tiers
  // 30% tier1, 45% tier2, 25% tier3
  const tier1 = Math.ceil(searchCount * 0.3);
  const tier2 = Math.ceil(searchCount * 0.45);
  const tier3 = searchCount - tier1 - tier2;

  return { tier1, tier2, tier3 };
}

/**
 * Generates DYNAMIC queries for each tier based on topic
 * NOT preset templates - AI generates unique queries per question
 */
export function generateTierQueries(
  topic: string,
  complexity: ComplexityAnalysis
): {
  tier1: string[];
  tier2: string[];
  tier3: string[];
} {
  const tier1 = generateDynamicQueries(topic, complexity.tier1, 'broad');
  const tier2 = generateDynamicQueries(topic, complexity.tier2, 'targeted');
  const tier3 = generateDynamicQueries(topic, complexity.tier3, 'creative');

  return { tier1, tier2, tier3 };
}

/**
 * Dynamically generates unique queries based on topic and tier type
 * Each query is unique, not from presets
 */
function generateDynamicQueries(
  topic: string,
  count: number,
  tier: 'broad' | 'targeted' | 'creative'
): string[] {
  const queries: string[] = [];

  if (tier === 'broad') {
    // Tier 1: Broad market scan - diverse angles
    const broadAngles = [
      `${topic} overview 2025 trends`,
      `${topic} market size growth statistics`,
      `${topic} industry analysis landscape`,
      `${topic} expert forecasts predictions`,
      `${topic} recent developments news`,
      `${topic} competitive analysis players`,
      `${topic} demographics audience breakdown`,
      `${topic} pricing strategies models`,
      `${topic} regulatory environment factors`,
      `${topic} technology adoption rates`,
    ];
    for (let i = 0; i < count && i < broadAngles.length; i++) {
      queries.push(broadAngles[i]);
    }
  } else if (tier === 'targeted') {
    // Tier 2: Targeted deep research - specific angles
    const targetedAngles = [
      `${topic} customer reviews sentiment analysis`,
      `${topic} Reddit discussions authentic feedback`,
      `${topic} emerging trends patterns 2024-2025`,
      `${topic} competitive positioning comparison`,
      `${topic} value proposition messaging`,
      `${topic} customer problems pain points`,
      `${topic} success stories case studies`,
      `${topic} failure reasons lessons learned`,
      `${topic} market gaps opportunities`,
      `${topic} influencer authority perspectives`,
      `${topic} community discussions forums`,
      `${topic} media coverage articles`,
      `${topic} supply chain logistics`,
      `${topic} user experience reviews`,
      `${topic} pricing sensitivity willingness`,
    ];
    for (let i = 0; i < count && i < targetedAngles.length; i++) {
      queries.push(targetedAngles[i]);
    }
  } else {
    // Tier 3: Creative deep dives - psychological & cultural
    const creativeAngles = [
      `${topic} psychological motivations desires`,
      `${topic} cultural shifts identity signals`,
      `${topic} decision triggers micro-moments`,
      `${topic} community building strategies`,
      `${topic} aspirations fears beliefs`,
      `${topic} innovation breakthrough patterns`,
      `${topic} long-form analysis essays`,
      `${topic} research studies evidence`,
      `${topic} future predictions outlook`,
      `${topic} unmet needs gaps`,
      `${topic} brand loyalty narratives`,
      `${topic} behavioral economics factors`,
      `${topic} social proof mechanisms`,
      `${topic} persuasion techniques language`,
      `${topic} lifestyle integration adoption`,
    ];
    for (let i = 0; i < count && i < creativeAngles.length; i++) {
      queries.push(creativeAngles[i]);
    }
  }

  return queries.slice(0, count);
}

/**
 * Calculate sources estimate based on tier breakdown
 */
export function estimateSources(complexity: ComplexityAnalysis): number {
  const tier1Sources = complexity.tier1 * 5;
  const tier2Sources = complexity.tier2 * 8;
  const tier3Sources = complexity.tier3 * 12;
  return tier1Sources + tier2Sources + tier3Sources;
}

/**
 * Calculate tools estimate based on tier breakdown
 */
export function estimateTools(complexity: ComplexityAnalysis): number {
  // Each search = web_search + (N) fetch_page calls
  // Tier 1: 1 web_search + 2 fetch_page = 3 tools per query
  // Tier 2: 1 web_search + 3 fetch_page = 4 tools per query
  // Tier 3: 1 web_search + 4 fetch_page = 5 tools per query
  // Plus: compute + generate = 2 tools

  const tier1Tools = complexity.tier1 * 3;
  const tier2Tools = complexity.tier2 * 4;
  const tier3Tools = complexity.tier3 * 5;
  return tier1Tools + tier2Tools + tier3Tools + 2; // +2 for compute & generate
}

/**
 * Format complexity analysis for logging
 */
export function formatComplexityReport(
  question: string,
  analysis: ComplexityAnalysis
): string {
  const sources = estimateSources(analysis);
  const tools = estimateTools(analysis);

  return `
╔════════════════════════════════════════════════════════════╗
║            ADAPTIVE RESEARCH ANALYSIS                      ║
╚════════════════════════════════════════════════════════════╝

Question: "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"

Complexity Score: ${analysis.score}/10
Reasoning: ${analysis.reasoning}

Research Allocation:
  Total Searches: ${analysis.searchCount}
  ├─ Tier 1: ${analysis.tier1} broad searches (5 sources each)
  ├─ Tier 2: ${analysis.tier2} targeted searches (8 sources each)
  └─ Tier 3: ${analysis.tier3} creative searches (12 sources each)

Resource Estimates:
  Estimated Sources: ${sources}
  Estimated Tools: ${tools}

Status: Ready to execute adaptive research
`;
}
