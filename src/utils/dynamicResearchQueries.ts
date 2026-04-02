/**
 * Dynamic Research Query Generation System
 *
 * Instead of static 89 queries, generates context-specific queries based on:
 * - Current campaign brief
 * - Research findings accumulated so far
 * - Identified gaps and under-researched dimensions
 * - Discovered competitors and trends
 * - Source diversity requirements
 *
 * Features:
 * - Query generator prompt using qwen3.5:27b for highest quality
 * - Query scoring by relevance, diversity, and estimated yield
 * - Adaptive strategy that evolves as research unfolds
 * - Follow-up query generation (discovered competitor → dig deeper)
 * - Source diversity enforcement (academic, Reddit, forums, industry, news)
 * - Query deduplication and freshness tracking
 */

import { ollamaService } from './ollama';
import { createLogger } from './logger';
import { loadPromptBody } from './promptLoader';
import type { Campaign, ResearchFindings } from '../types';

const log = createLogger('dynamicResearchQueries');

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export interface ResearchQuery {
  id: string; // Deterministic hash for deduplication
  query: string;
  source: 'static' | 'generated' | 'adaptive';
  category: QueryCategory;
  subCategory: QuerySubCategory;
  priority: 'high' | 'medium' | 'low';
  relevanceScore: number; // 0-100: how relevant to campaign
  diversityScore: number; // 0-100: how different from already-used queries
  estimatedYield: number; // 0-100: expected quality/quantity of results
  compositScore: number; // Combined score for ranking
  targetSources?: QueryTargetSource[];
  generatedAt: number;
  lastUsed?: number;
  resultsCount?: number;
  qualityFeedback?: 'excellent' | 'good' | 'mediocre' | 'poor';
}

export type QueryCategory =
  | 'market_research'
  | 'competitor_analysis'
  | 'audience_insights'
  | 'objection_handling'
  | 'trend_identification'
  | 'positioning'
  | 'channel_effectiveness'
  | 'identity_markers';

export type QuerySubCategory =
  | 'market_size'
  | 'growth_trends'
  | 'competitor_direct'
  | 'competitor_indirect'
  | 'audience_demographics'
  | 'audience_psychographics'
  | 'objection_evidence'
  | 'objection_frequency'
  | 'emerging_tech'
  | 'consumer_shift'
  | 'messaging'
  | 'visual_style'
  | 'lifestyle_markers'
  | 'values_drivers';

export type QueryTargetSource =
  | 'academic'
  | 'reddit'
  | 'news'
  | 'industry_reports'
  | 'ecommerce'
  | 'forums'
  | 'social_media'
  | 'blogs';

export interface ResearchQueryBatch {
  queries: ResearchQuery[];
  generatedAt: number;
  basedOnFindings: string; // Summary of findings that drove query generation
  targetCoverage: Record<string, boolean>; // Which dimensions we're targeting
  diversityProfile: Record<QueryTargetSource, number>; // Source distribution
}

export interface QueryGenerationRequest {
  campaign: Campaign;
  currentFindings: ResearchFindings | null;
  discoveredCompetitors: string[];
  identifiedGaps: string[];
  previousQueries: ResearchQuery[];
  targetCount: number; // How many queries to generate
  targetSources?: QueryTargetSource[];
}

export interface QueryScoringContext {
  campaignBrief: string;
  currentFindingsSummary: string;
  alreadyResearched: string[];
  targetDimensions: string[];
}

// ─────────────────────────────────────────────────────────────
// Query Generator (using qwen3.5:27b for quality)
// ─────────────────────────────────────────────────────────────

export async function generateContextSpecificQueries(
  request: QueryGenerationRequest,
  signal?: AbortSignal,
): Promise<ResearchQuery[]> {
  log.info(`[QueryGen] Generating ${request.targetCount} context-specific queries`);

  const prompt = buildQueryGenerationPrompt(request);

  try {
    // Use largest model for query generation (highest quality)
    const generatedText = await ollamaService.generateStream(
      prompt,
      '',
      { model: 'qwen3.5:27b', temperature: 0.7, num_predict: 2000, top_p: 0.9, signal },
    );

    // Parse generated queries
    const queries = parseGeneratedQueries(generatedText, request);

    // Score each query
    const scoringContext: QueryScoringContext = {
      campaignBrief: buildCampaignBrief(request.campaign),
      currentFindingsSummary: summarizeFindings(request.currentFindings),
      alreadyResearched: request.previousQueries.map(q => q.query),
      targetDimensions: request.identifiedGaps,
    };

    const scoredQueries = await scoreQueries(queries, scoringContext, signal);

    // Filter out duplicates with previous queries
    const uniqueQueries = deduplicateQueries(scoredQueries, request.previousQueries);

    // Enforce source diversity
    const diverseQueries = enforceSourceDiversity(uniqueQueries, request.targetSources);

    log.info(`[QueryGen] Generated ${diverseQueries.length} unique, scored queries`);

    return diverseQueries.slice(0, request.targetCount);
  } catch (error) {
    log.error('[QueryGen] Generation failed:', error instanceof Error ? error.message : error);
    // Fallback to static baseline queries
    return generateBaselineQueries(request.campaign);
  }
}

// ─────────────────────────────────────────────────────────────
// Follow-up Query Generation (Adaptive Strategy)
// ─────────────────────────────────────────────────────────────

export async function generateFollowUpQueries(
  discoveredCompetitor: string,
  discoveredTrend: string,
  campaign: Campaign,
  signal?: AbortSignal,
): Promise<ResearchQuery[]> {
  log.info(`[FollowUp] Generating follow-ups for competitor "${discoveredCompetitor}" + trend "${discoveredTrend}"`);

  const prompt = `You are a research strategist. Given:
- Discovered competitor: ${discoveredCompetitor}
- Identified trend: ${discoveredTrend}
- Product category: ${campaign.presetData?.product?.category || 'N/A'}

Generate 5 high-precision follow-up research queries that:
1. Deep-dive into this specific competitor's strategy
2. Investigate this trend's evidence and impact
3. Connect competitor actions to the identified trend
4. Are specific enough to yield actionable insights
5. Target different sources (mix of industry reports, community insights, competitive intelligence)

Format each query on a new line with source preference at end: [academic|reddit|news|industry]

Example:
"${discoveredCompetitor} marketing positioning strategy 2025 [industry]"
"how ${discoveredTrend} affecting ${campaign.presetData?.product?.category || 'market'} sales [news]"`;

  try {
    const generatedText = await ollamaService.generateStream(
      prompt,
      '',
      { model: 'qwen3.5:9b', temperature: 0.6, num_predict: 800, signal },
    );

    const followUps = parseFollowUpQueries(generatedText, discoveredCompetitor, discoveredTrend);

    log.info(`[FollowUp] Generated ${followUps.length} follow-up queries`);

    return followUps;
  } catch (error) {
    log.error('[FollowUp] Generation failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Query Scoring Engine
// ─────────────────────────────────────────────────────────────

export async function scoreQueries(
  queries: ResearchQuery[],
  context: QueryScoringContext,
  signal?: AbortSignal,
): Promise<ResearchQuery[]> {
  // Score each query on: relevance, diversity, estimated yield
  for (const query of queries) {
    const relevance = scoreRelevance(query.query, context.campaignBrief);
    const diversity = scoreDiversity(query.query, context.alreadyResearched);
    const estimatedYield = scoreEstimatedYield(query.query, context.targetDimensions);

    // Composite score: weighted average
    query.relevanceScore = relevance;
    query.diversityScore = diversity;
    query.estimatedYield = estimatedYield;
    query.compositScore = relevance * 0.4 + diversity * 0.3 + estimatedYield * 0.3;
  }

  // Sort by composite score
  return queries.sort((a, b) => b.compositScore - a.compositScore);
}

function scoreRelevance(query: string, campaignBrief: string): number {
  const queryLower = query.toLowerCase();
  const briefTerms = campaignBrief.toLowerCase().split(/\s+/);

  let score = 0;
  for (const term of briefTerms) {
    if (term.length > 3 && queryLower.includes(term)) {
      score += 15;
    }
  }

  // Penalize very common terms
  const commonTerms = ['the', 'a', 'an', 'and', 'or', 'is', 'are'];
  for (const term of commonTerms) {
    if (queryLower.includes(term)) {
      score -= 2;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function scoreDiversity(query: string, alreadyResearched: string[]): number {
  // Check overlap with existing queries
  const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 3));

  let maxOverlap = 0;
  for (const existing of alreadyResearched) {
    const existingTerms = new Set(existing.toLowerCase().split(/\s+/));
    const overlap = [...queryTerms].filter(t => existingTerms.has(t)).length / queryTerms.size;
    maxOverlap = Math.max(maxOverlap, overlap);
  }

  // If no previous queries, diversity is high
  if (alreadyResearched.length === 0) return 100;

  // 100% overlap = 0 diversity, 0% overlap = 100 diversity
  return Math.max(0, (1 - maxOverlap) * 100);
}

function scoreEstimatedYield(query: string, targetDimensions: string[]): number {
  // Higher yield for specific, data-rich queries
  const hasNumbers = /\b\d{4}\b|\d+%/.test(query); // Year or percentage
  const hasQuoteMarks = query.includes('"');
  const hasComparison = /vs\.|versus|alternative|competitor|vs/i.test(query);
  const hasSiteOperator = /site:/i.test(query);

  let score = 50; // Base score
  if (hasNumbers) score += 20;
  if (hasQuoteMarks) score += 15;
  if (hasComparison) score += 15;
  if (hasSiteOperator) score += 10;

  // Bonus for targeting identified gaps
  const queryLower = query.toLowerCase();
  for (const dim of targetDimensions) {
    if (queryLower.includes(dim.replace(/_/g, ' '))) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

// ─────────────────────────────────────────────────────────────
// Query Deduplication
// ─────────────────────────────────────────────────────────────

export function deduplicateQueries(newQueries: ResearchQuery[], previousQueries: ResearchQuery[]): ResearchQuery[] {
  const previousSet = new Set(previousQueries.map(q => generateQueryId(q.query)));

  return newQueries.filter(q => !previousSet.has(generateQueryId(q.query)));
}

function generateQueryId(query: string): string {
  // Normalize and hash query for deduplication
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  // Simple hash function (in production, use crypto)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ─────────────────────────────────────────────────────────────
// Source Diversity Enforcement
// ─────────────────────────────────────────────────────────────

export function enforceSourceDiversity(
  queries: ResearchQuery[],
  targetSources?: QueryTargetSource[],
): ResearchQuery[] {
  if (!targetSources || targetSources.length === 0) {
    targetSources = ['academic', 'reddit', 'news', 'industry_reports', 'ecommerce', 'forums'];
  }

  const diverse: ResearchQuery[] = [];
  const sourceCount: Record<QueryTargetSource, number> = Object.fromEntries(
    targetSources.map(s => [s, 0]),
  ) as Record<QueryTargetSource, number>;

  const targetPerSource = Math.ceil(queries.length / targetSources.length);

  // Distribute queries across sources
  for (const source of targetSources) {
    const queriesForSource = queries.filter(
      q => q.targetSources && q.targetSources.includes(source) && diverse.length < queries.length,
    );

    for (const query of queriesForSource.slice(0, targetPerSource)) {
      if (!diverse.includes(query)) {
        diverse.push(query);
        sourceCount[source]++;
      }
    }
  }

  log.info(`[Diversity] Enforced source distribution:`, sourceCount);

  return diverse;
}

// ─────────────────────────────────────────────────────────────
// Baseline Queries (Fallback)
// ─────────────────────────────────────────────────────────────

function generateBaselineQueries(campaign: Campaign): ResearchQuery[] {
  const product = campaign.presetData?.product?.name || 'product';
  const category = campaign.presetData?.product?.category || 'category';
  const brand = campaign.presetData?.brand?.name || 'brand';

  const queries: ResearchQuery[] = [
    {
      id: generateQueryId(`${category} market size 2025`),
      query: `${category} market size 2024 2025 growth forecast`,
      source: 'static',
      category: 'market_research',
      subCategory: 'market_size',
      priority: 'high',
      relevanceScore: 85,
      diversityScore: 100,
      estimatedYield: 80,
      compositScore: 85,
      targetSources: ['academic', 'industry_reports'],
      generatedAt: Date.now(),
    },
    {
      id: generateQueryId(`${category} competitors comparison`),
      query: `top ${category} brands 2025 comparison features pricing`,
      source: 'static',
      category: 'competitor_analysis',
      subCategory: 'competitor_direct',
      priority: 'high',
      relevanceScore: 90,
      diversityScore: 100,
      estimatedYield: 85,
      compositScore: 88,
      targetSources: ['news', 'industry_reports', 'ecommerce'],
      generatedAt: Date.now(),
    },
    {
      id: generateQueryId(`${product} customer reviews reddit`),
      query: `${product} customer reviews reddit experiences site:reddit.com`,
      source: 'static',
      category: 'audience_insights',
      subCategory: 'audience_psychographics',
      priority: 'high',
      relevanceScore: 80,
      diversityScore: 100,
      estimatedYield: 85,
      compositScore: 82,
      targetSources: ['reddit'],
      generatedAt: Date.now(),
    },
  ];

  return queries;
}

// ─────────────────────────────────────────────────────────────
// Prompt Building & Parsing
// ─────────────────────────────────────────────────────────────

function buildQueryGenerationPrompt(request: QueryGenerationRequest): string {
  const campaignBrief = buildCampaignBrief(request.campaign);
  const findingsSummary = summarizeFindings(request.currentFindings);
  const gapsSummary = request.identifiedGaps.join(', ') || 'None identified yet';
  const competitorsSummary = request.discoveredCompetitors.slice(0, 5).join(', ') || 'Not yet discovered';

  return `You are an expert market research strategist. Your task is to generate ${request.targetCount} high-quality, context-specific research queries.

CAMPAIGN BRIEF:
${campaignBrief}

CURRENT FINDINGS SUMMARY:
${findingsSummary}

IDENTIFIED GAPS (areas needing more research):
${gapsSummary}

DISCOVERED COMPETITORS:
${competitorsSummary}

PREVIOUS QUERIES (avoid these to maintain diversity):
${request.previousQueries
  .slice(-5)
  .map(q => `- ${q.query}`)
  .join('\n') || '- None yet'}

YOUR TASK:
Generate ${request.targetCount} research queries that:
1. Address identified gaps and under-researched dimensions
2. Follow up on discovered competitors and trends
3. Maintain source diversity (target: academic, Reddit, news, industry reports, forums)
4. Are specific and actionable (not generic)
5. Don't duplicate previous queries
6. Vary in scope: some broad, some very specific

FORMAT EACH QUERY:
"[query text]" [category] [source1|source2|source3]

CATEGORIES: market_research|competitor_analysis|audience_insights|objection_handling|trend_identification|positioning|channel_effectiveness|identity_markers

SOURCES: academic|reddit|news|industry_reports|ecommerce|forums|social_media|blogs

EXAMPLE:
"${request.campaign.presetData?.brand?.name || 'BrandX'} customer pain points objection handling proof site:reddit.com" competitor_analysis reddit|forums
"${request.campaign.presetData?.product?.category || 'category'} emerging ingredient trends 2025 market adoption" trend_identification academic|industry_reports|news

Now generate your queries:`;
}

function parseGeneratedQueries(text: string, request: QueryGenerationRequest): ResearchQuery[] {
  const queries: ResearchQuery[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Parse format: "[query]" [category] [source|source]
    const match = trimmed.match(/"([^"]+)"\s+(\w+)\s+(\w+(?:\|\w+)*)/);
    if (!match) continue;

    const [, queryText, category, sourcesStr] = match;
    const sources = sourcesStr.split('|') as QueryTargetSource[];

    const query: ResearchQuery = {
      id: generateQueryId(queryText),
      query: queryText,
      source: 'generated',
      category: category as QueryCategory || 'market_research',
      subCategory: 'market_size', // Simplified — in production would parse more precisely
      priority: 'high',
      relevanceScore: 0, // Will be scored later
      diversityScore: 0,
      estimatedYield: 0,
      compositScore: 0,
      targetSources: sources,
      generatedAt: Date.now(),
    };

    queries.push(query);
  }

  log.info(`[QueryGen] Parsed ${queries.length} queries from LLM output`);

  return queries;
}

function parseFollowUpQueries(text: string, competitor: string, trend: string): ResearchQuery[] {
  const queries: ResearchQuery[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('"')) continue;

    const match = trimmed.match(/"([^"]+)"\s*\[(\w+)\]?/);
    if (!match) continue;

    const [, queryText, sourceStr] = match;
    const source = sourceStr as QueryTargetSource || 'news';

    const query: ResearchQuery = {
      id: generateQueryId(queryText),
      query: queryText,
      source: 'adaptive',
      category: 'competitor_analysis',
      subCategory: 'competitor_direct',
      priority: 'high',
      relevanceScore: 85,
      diversityScore: 90,
      estimatedYield: 80,
      compositScore: 85,
      targetSources: [source],
      generatedAt: Date.now(),
    };

    queries.push(query);
  }

  return queries;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function buildCampaignBrief(campaign: Campaign): string {
  const parts: string[] = [];

  if (campaign.presetData?.brand?.name) {
    parts.push(`Brand: ${campaign.presetData.brand.name}`);
  }

  if (campaign.presetData?.brand?.positioning) {
    parts.push(`Positioning: ${campaign.presetData.brand.positioning}`);
  }

  if (campaign.presetData?.product?.name) {
    parts.push(`Product: ${campaign.presetData.product.name}`);
  }

  if (campaign.presetData?.product?.category) {
    parts.push(`Category: ${campaign.presetData.product.category}`);
  }

  if (campaign.presetData?.product?.ingredients) {
    parts.push(`Key Ingredients: ${campaign.presetData.product.ingredients}`);
  }

  return parts.join('\n') || 'No campaign data available';
}

function summarizeFindings(findings: ResearchFindings | null): string {
  if (!findings) return 'No findings yet — initial research phase';

  const parts: string[] = [];

  if (findings.deepDesires && findings.deepDesires.length > 0) {
    parts.push(`Identified ${findings.deepDesires.length} deep customer desires`);
  }

  if (findings.objections && findings.objections.length > 0) {
    parts.push(`Discovered ${findings.objections.length} key objections`);
  }

  if (findings.competitorAds && findings.competitorAds.competitors && findings.competitorAds.competitors.length > 0) {
    parts.push(`Analyzed ${findings.competitorAds.competitors.length} competitors`);
  }

  if (findings.purchaseJourney && findings.purchaseJourney.searchTerms && findings.purchaseJourney.searchTerms.length > 0) {
    parts.push(`Identified ${findings.purchaseJourney.searchTerms.length} search intent patterns`);
  }

  return parts.join('; ') || 'Research in progress';
}

export default {
  generateContextSpecificQueries,
  generateFollowUpQueries,
  scoreQueries,
  deduplicateQueries,
  enforceSourceDiversity,
};
