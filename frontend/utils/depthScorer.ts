/**
 * Depth Scorer — Evaluates completeness of research results
 *
 * Scores results 0-100% based on:
 * - Breadth: How many dimensional coverage areas are addressed
 * - Depth: Presence of specific data (quotes, stats, URLs)
 * - Confidence markers: Evidence of multi-source agreement
 *
 * Returns confidence score + list of gap dimensions
 */

export interface DepthScore {
  score: number; // 0-100, higher = more complete
  coverageBreadth: number; // % of dimensions covered
  depthMetrics: {
    quoteCount: number;
    statCount: number;
    sourceCount: number;
    competitorCount: number;
  };
  gaps: string[]; // Dimensions with low/no coverage
  isIncomplete: boolean; // true if score < 70%
  recommendation: 'sufficient' | 'followup_recommended' | 'deep_followup_needed';
}

export interface CoverageGraph {
  market_size_trends: boolean;
  competitor_analysis: boolean;
  customer_objections: boolean;
  emerging_trends: boolean;
  regional_differences: boolean;
  pricing_strategies: boolean;
  channel_effectiveness: boolean;
  brand_positioning_gaps: boolean;
  psychological_triggers: boolean;
  media_consumption_patterns: boolean;
  visual_competitive_analysis?: boolean;
  amazon_research?: boolean;
  reddit_research?: boolean;
  identity_markers?: boolean;
  ad_style_analysis?: boolean;
  market_sophistication?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * Score research result completeness
 * Returns 0-100 with reasoning
 */
export function scoreResearchDepth(
  findings: string,
  coverage: CoverageGraph,
  sourceCount: number,
): DepthScore {
  const dimensionKeys = Object.keys(coverage).filter(k => k !== '__typename');
  const coveredDimensions = dimensionKeys.filter(k => coverage[k as keyof CoverageGraph] === true).length;
  const totalDimensions = dimensionKeys.length;
  const coverageBreadth = totalDimensions > 0 ? (coveredDimensions / totalDimensions) * 100 : 0;

  // Extract depth metrics
  const quoteCount = (findings.match(/"[^"]{20,}"/g) || []).length;
  const statMatches = findings.match(/\$\d+|[\d,]+(?:\s+(?:million|billion|thousand|%|percent))?/g) || [];
  const statCount = Math.min(statMatches.length, 30); // Cap at 30 to avoid false positives
  const competitorCount = (findings.match(/competitor|brand|company|vs\.|versus/gi) || []).length;

  // Score formula: 40% breadth + 30% depth + 30% sources
  const depthScore = (quoteCount * 5) + (statCount * 3) + (competitorCount * 2); // Raw depth points
  const maxDepthPoints = 200; // Normalization ceiling
  const depthComponent = Math.min((depthScore / maxDepthPoints) * 100, 100);
  const sourceComponent = Math.min((sourceCount / 10) * 100, 100); // 10+ sources = 100%

  const score = (coverageBreadth * 0.35) + (depthComponent * 0.40) + (sourceComponent * 0.25);

  // Identify gaps (dimensions with no coverage)
  const gaps = dimensionKeys.filter(k => coverage[k as keyof CoverageGraph] === false);

  // Recommendation logic
  let recommendation: 'sufficient' | 'followup_recommended' | 'deep_followup_needed' = 'sufficient';
  if (score < 50) {
    recommendation = 'deep_followup_needed';
  } else if (score < 70) {
    recommendation = 'followup_recommended';
  }

  return {
    score: Math.round(score),
    coverageBreadth: Math.round(coverageBreadth),
    depthMetrics: {
      quoteCount,
      statCount,
      sourceCount,
      competitorCount,
    },
    gaps,
    isIncomplete: score < 70,
    recommendation,
  };
}

/**
 * Generate targeted follow-up queries based on gaps
 * Returns array of specific queries to fill missing dimensions
 */
export function generateFollowupQueries(
  topic: string,
  gaps: string[],
  depthMetrics: { quoteCount: number; statCount: number; sourceCount: number; competitorCount: number },
  findings: string,
): string[] {
  const followups: string[] = [];
  const gapSet = new Set(gaps);

  // For each major gap, create a targeted follow-up
  if (gapSet.has('market_size_trends')) {
    followups.push(`${topic} market size TAM total addressable market 2024 2025 growth rate`);
  }
  if (gapSet.has('competitor_analysis') || (depthMetrics.competitorCount < 3)) {
    followups.push(`${topic} competitors comparison brands market leaders vs alternatives`);
  }
  if (gapSet.has('customer_objections') || !findings.includes('objection')) {
    followups.push(`${topic} customer objections complaints concerns Reddit reviews why people don't buy`);
  }
  if (gapSet.has('emerging_trends')) {
    followups.push(`${topic} emerging trends 2025 new developments growth areas innovation`);
  }
  if (gapSet.has('regional_differences')) {
    followups.push(`${topic} regional differences geographic variations Europe Asia US market differences`);
  }
  if (gapSet.has('pricing_strategies') || (depthMetrics.statCount < 5)) {
    followups.push(`${topic} pricing price point cost average price range willingness to pay`);
  }
  if (gapSet.has('channel_effectiveness')) {
    followups.push(`${topic} distribution channels retail e-commerce online marketplace sales channels`);
  }
  if (gapSet.has('psychological_triggers')) {
    followups.push(`${topic} psychological triggers emotional motivation fear desire pain points`);
  }
  if (gapSet.has('identity_markers')) {
    followups.push(`${topic} identity tribe community values aspirations cultural belonging`);
  }
  if (gapSet.has('customer_objections') && depthMetrics.quoteCount < 3) {
    // If we have objections gaps AND few quotes, do a quote-specific search
    followups.push(`${topic} customer quotes testimonials what people say Reddit reviews actual words`);
  }

  // If very few sources, add a generic re-search to find better sources
  if (depthMetrics.sourceCount < 5) {
    followups.unshift(`${topic} comprehensive overview detailed research 2025`);
  }

  return followups.slice(0, 5); // Max 5 follow-ups per research cycle
}

/**
 * Merge findings with follow-up results
 * Deduplicates and combines insights from multiple passes
 */
export function mergeResearchResults(
  original: string,
  followup: string,
): string {
  // Combine with clear section marker
  const combined = `${original}\n\n--- FOLLOW-UP RESEARCH ---\n${followup}`;

  // TODO: In future, deduplicate similar findings across sections
  // For now, simple concatenation preserves all context

  return combined;
}
