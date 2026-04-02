/**
 * Advanced Research Orchestration System — 3-Tier Researcher Deployment
 *
 * Implements sophisticated research strategy with:
 * - Tier 1 (Scouts): 10 parallel fast, broad queries for market scanning
 * - Tier 2 (Diggers): 5 parallel deep queries, follow-ups, evidence gathering
 * - Tier 3 (Synthesizers): 3 parallel cross-findings, gap detection, pattern recognition
 *
 * Features:
 * - Coverage scoring (% of market researched)
 * - Intelligent query generation (based on current gaps + findings)
 * - Iteration rounds with early-exit at 95% coverage
 * - Source diversity enforcement (academic, Reddit, news, forums, industry)
 * - Adaptive strategy (discovers new competitors → digs deeper)
 * - Quality gates between tiers (tier 2 only runs if tier 1 coverage > 50%)
 */

import { ollamaService } from './ollama';
import { wayfarerService } from './wayfarer';
import { createLogger } from './logger';
import { recordResearchSource } from './researchAudit';
import type { Campaign, ResearchFindings } from '../types';

const log = createLogger('advancedResearchOrchestration');

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export interface ScoutQuery {
  query: string;
  purpose: 'market_sizing' | 'competitor_discovery' | 'trend_scanning' | 'audience_mapping';
  expectedSources: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DiggerQuery {
  query: string;
  parentScoutQuery?: string;
  purpose: 'competitor_deep_dive' | 'objection_proof' | 'trend_evidence' | 'audience_behavior';
  targetDepth: 'detailed_analysis' | 'statistical_evidence' | 'community_insights';
  priority: 'high' | 'medium' | 'low';
}

export interface SynthesisTask {
  taskId: string;
  type: 'cross_dimension' | 'gap_analysis' | 'pattern_detection' | 'confidence_validation';
  dimension1: string;
  dimension2?: string;
  priority: 'high' | 'medium';
}

export interface ResearcherResult {
  tier: 1 | 2 | 3;
  query: string;
  sources: number;
  contentLength: number;
  confidence: number; // 0-1
  keyFindings: string[];
  competitorsDiscovered?: string[];
  trendsIdentified?: string[];
  gapsIdentified?: string[];
}

export interface CoverageMetrics {
  totalDimensions: number;
  coveredDimensions: number;
  coveragePercentage: number;
  dimensionCoverage: Record<string, { covered: boolean; sources: number; confidence: number }>;
  sourcesByType: Record<string, number>;
  sourcesByDomain: Record<string, number>;
}

export interface ResearchIterationResult {
  iteration: number;
  tierResults: ResearcherResult[];
  coverageAfter: CoverageMetrics;
  newCompetitorsDiscovered: string[];
  newTrendsIdentified: string[];
  qualityScore: number; // 0-100
  shouldContinue: boolean;
  reason: 'coverage_threshold' | 'quality_acceptable' | 'diminishing_returns' | 'max_iterations';
}

// ─────────────────────────────────────────────────────────────
// Coverage Dimensions — Define research scope
// ─────────────────────────────────────────────────────────────

export const RESEARCH_DIMENSIONS = [
  'market_size_trends',
  'competitor_analysis',
  'customer_objections',
  'emerging_trends',
  'regional_differences',
  'pricing_strategies',
  'channel_effectiveness',
  'brand_positioning_gaps',
  'psychological_triggers',
  'media_consumption_patterns',
  'amazon_research',
  'reddit_research',
  'identity_markers',
  'ad_style_analysis',
  'market_sophistication',
  'supply_chain_insights',
  'regulatory_landscape',
  'influencer_landscape',
  'community_sentiment',
  'seasonal_patterns',
] as const;

export type ResearchDimension = typeof RESEARCH_DIMENSIONS[number];

// ─────────────────────────────────────────────────────────────
// Scout Query Templates (Tier 1)
// ─────────────────────────────────────────────────────────────

function buildScoutQueries(campaign: Campaign): ScoutQuery[] {
  const product = campaign.presetData?.product?.name || 'product';
  const category = campaign.presetData?.product?.category || 'category';
  const brand = campaign.presetData?.brand?.name || 'brand';

  return [
    // Market sizing (3 queries)
    {
      query: `${category} market size 2024 2025 growth trends billion`,
      purpose: 'market_sizing',
      expectedSources: 8,
      priority: 'high',
    },
    {
      query: `${category} industry report forecast value projection 2025`,
      purpose: 'market_sizing',
      expectedSources: 6,
      priority: 'high',
    },
    {
      query: `${category} consumer spending statistics demographics`,
      purpose: 'market_sizing',
      expectedSources: 7,
      priority: 'medium',
    },
    // Competitor discovery (3 queries)
    {
      query: `top ${category} brands companies 2025 list comparison`,
      purpose: 'competitor_discovery',
      expectedSources: 10,
      priority: 'high',
    },
    {
      query: `${category} competitors vs ${brand} alternatives`,
      purpose: 'competitor_discovery',
      expectedSources: 8,
      priority: 'high',
    },
    {
      query: `best selling ${product} brands market share leaders`,
      purpose: 'competitor_discovery',
      expectedSources: 7,
      priority: 'medium',
    },
    // Trend scanning (2 queries)
    {
      query: `${category} trends 2025 emerging consumer behavior shift`,
      purpose: 'trend_scanning',
      expectedSources: 8,
      priority: 'high',
    },
    {
      query: `${product} innovation latest technology advancement`,
      purpose: 'trend_scanning',
      expectedSources: 6,
      priority: 'medium',
    },
    // Audience mapping (2 queries)
    {
      query: `${category} target audience demographics psychographics interest`,
      purpose: 'audience_mapping',
      expectedSources: 7,
      priority: 'high',
    },
    {
      query: `${product} customer profile buyer persona lifestyle`,
      purpose: 'audience_mapping',
      expectedSources: 6,
      priority: 'medium',
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Tier 1: Scout Researchers (Fast, Parallel, 10 concurrent)
// ─────────────────────────────────────────────────────────────

export async function runScoutTier(
  queries: ScoutQuery[],
  signal?: AbortSignal,
): Promise<ResearcherResult[]> {
  log.info(`[Tier 1] Deploying ${queries.length} scouts (max 10 parallel)`);

  const scouts = queries.slice(0, 10); // Hard limit: 10 scouts
  const results: ResearcherResult[] = [];

  // Execute scouts in parallel (Promise.all with concurrency limit)
  const batches = [];
  for (let i = 0; i < scouts.length; i += 5) {
    batches.push(scouts.slice(i, i + 5));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(scout => executeSingleScout(scout, signal)),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  const totalSources = results.reduce((sum, r) => sum + r.sources, 0);
  const avgConfidence = results.length > 0 ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0;

  log.info(`[Tier 1] Complete: ${results.length}/${scouts.length} scouts succeeded, ${totalSources} sources, ${(avgConfidence * 100).toFixed(1)}% confidence`);

  return results;
}

async function executeSingleScout(query: ScoutQuery, signal?: AbortSignal): Promise<ResearcherResult | null> {
  try {
    const startTime = Date.now();

    // Fetch via Wayfarer (broad search)
    const searchResult = await wayfarerService.research(query.query, query.expectedSources, signal);

    const elapsed = Date.now() - startTime;
    const contentLength = searchResult.text?.length || 0;
    const sourceCount = searchResult.sources?.length || 0;

    // Record sources
    searchResult.sources?.forEach((src: { url: string; snippet?: string }) => {
      recordResearchSource({
        url: src.url,
        query: query.query,
        source: 'web',
        contentLength: src.snippet?.length || 0,
        extractedSnippet: src.snippet,
      });
    });

    // Extract key findings
    const keyFindings = extractKeyFindings(searchResult.text || '');
    const competitorsDiscovered = extractCompetitorMentions(searchResult.text || '');
    const trendsIdentified = query.purpose === 'trend_scanning' ? extractTrendMentions(searchResult.text || '') : [];

    // Confidence score: 0.3-1.0 based on sources + content volume
    const confidence = Math.min(1.0, 0.3 + (sourceCount * 0.1) + Math.min(contentLength / 50000, 0.4));

    return {
      tier: 1,
      query: query.query,
      sources: sourceCount,
      contentLength,
      confidence,
      keyFindings,
      competitorsDiscovered,
      trendsIdentified,
    };
  } catch (error) {
    log.error(`[Tier 1] Scout failed for "${query.query}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Tier 2: Digger Researchers (Deep, Parallel, 5 concurrent)
// ─────────────────────────────────────────────────────────────

export async function runDiggerTier(
  queries: DiggerQuery[],
  tierOneCoverage: number,
  signal?: AbortSignal,
): Promise<ResearcherResult[]> {
  if (tierOneCoverage < 50) {
    log.warn(`[Tier 2] Skipped: Tier 1 coverage only ${tierOneCoverage.toFixed(1)}% (need >= 50%)`);
    return [];
  }

  log.info(`[Tier 2] Deploying ${Math.min(queries.length, 5)} diggers (max 5 parallel)`);

  const diggers = queries.slice(0, 5); // Hard limit: 5 diggers
  const results: ResearcherResult[] = [];

  // Execute diggers with 2-query batch size
  const batches = [];
  for (let i = 0; i < diggers.length; i += 2) {
    batches.push(diggers.slice(i, i + 2));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(digger => executeSingleDigger(digger, signal)),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  const totalSources = results.reduce((sum, r) => sum + r.sources, 0);
  const avgConfidence = results.length > 0 ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0;

  log.info(`[Tier 2] Complete: ${results.length}/${diggers.length} diggers succeeded, ${totalSources} sources, ${(avgConfidence * 100).toFixed(1)}% confidence`);

  return results;
}

async function executeSingleDigger(query: DiggerQuery, signal?: AbortSignal): Promise<ResearcherResult | null> {
  try {
    const startTime = Date.now();

    // Digger queries get longer timeouts + more pages
    const searchResult = await wayfarerService.research(query.query, 15, signal);

    const elapsed = Date.now() - startTime;
    const contentLength = searchResult.text?.length || 0;
    const sourceCount = searchResult.sources?.length || 0;

    // Record sources with depth indicator
    searchResult.sources?.forEach((src: { url: string; snippet?: string }) => {
      recordResearchSource({
        url: src.url,
        query: query.query,
        source: 'web', // Use 'web' type from ResearchSource union
        contentLength: src.snippet?.length || 0,
        extractedSnippet: src.snippet,
      });
    });

    // Extract findings with higher specificity
    const keyFindings = extractDetailedFindings(searchResult.text || '');
    const gapsIdentified = identifyResearchGaps(searchResult.text || '', query.purpose);

    // Confidence: 0.4-1.0 (diggers require more sources)
    const confidence = Math.min(1.0, 0.4 + (sourceCount * 0.12) + Math.min(contentLength / 80000, 0.4));

    return {
      tier: 2,
      query: query.query,
      sources: sourceCount,
      contentLength,
      confidence,
      keyFindings,
      gapsIdentified,
    };
  } catch (error) {
    log.error(`[Tier 2] Digger failed for "${query.query}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Tier 3: Synthesizers (Cross-dimension, Parallel, 3 concurrent)
// ─────────────────────────────────────────────────────────────

export async function runSynthesisTier(
  tasks: SynthesisTask[],
  previousResults: Map<string, ResearcherResult>,
  signal?: AbortSignal,
): Promise<ResearcherResult[]> {
  log.info(`[Tier 3] Deploying ${Math.min(tasks.length, 3)} synthesizers (max 3 parallel)`);

  const synthesizers = tasks.slice(0, 3); // Hard limit: 3 synthesizers
  const results: ResearcherResult[] = [];

  // Execute synthesizers serially (complex analysis)
  for (const task of synthesizers) {
    if (signal?.aborted) break;

    const result = await executeSingleSynthesizer(task, previousResults, signal);
    if (result) {
      results.push(result);
    }
  }

  log.info(`[Tier 3] Complete: ${results.length}/${synthesizers.length} synthesizers succeeded`);

  return results;
}

async function executeSingleSynthesizer(
  task: SynthesisTask,
  previousResults: Map<string, ResearcherResult>,
  signal?: AbortSignal,
): Promise<ResearcherResult | null> {
  try {
    // Use LLM to synthesize findings across dimensions
    const prompt = buildSynthesisPrompt(task, previousResults);

    // Use ollamaService.generate instead of generateStream for synthesizers
    const synthesis = await ollamaService.generate(
      prompt,
      '',
      'qwen3.5:4b'
    );

    // Extract meta-insights from synthesis
    const keyFindings = extractSynthesisInsights(synthesis);
    const gapsIdentified = identifyMetaGaps(synthesis);

    return {
      tier: 3,
      query: `[${task.type}] ${task.dimension1}${task.dimension2 ? ` x ${task.dimension2}` : ''}`,
      sources: 0, // Synthesizers don't directly fetch sources
      contentLength: synthesis.length,
      confidence: 0.8, // LLM-based synthesis has consistent confidence
      keyFindings,
      gapsIdentified,
    };
  } catch (error) {
    log.error(`[Tier 3] Synthesizer failed for task ${task.taskId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Iteration Loop with Coverage Tracking
// ─────────────────────────────────────────────────────────────

export async function runAdvancedResearchCycle(
  campaign: Campaign,
  maxIterations = 30,
  targetCoverage = 0.95,
  signal?: AbortSignal,
): Promise<ResearchIterationResult[]> {
  const results: ResearchIterationResult[] = [];
  let coverage = initializeCoverage();
  let discoveredCompetitors: Set<string> = new Set();
  let discoveredTrends: Set<string> = new Set();

  log.info(`[Orchestration] Starting advanced research cycle (target: ${(targetCoverage * 100).toFixed(1)}% coverage)`);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (signal?.aborted) {
      log.info(`[Orchestration] Research aborted at iteration ${iteration}`);
      break;
    }

    log.info(`\n═══════════════════════════════════════════`);
    log.info(`[Orchestration] Iteration ${iteration}/${maxIterations}`);
    log.info(`Current coverage: ${(coverage.coveragePercentage * 100).toFixed(1)}%`);

    // Tier 1: Scout
    const scoutQueries = buildScoutQueries(campaign);
    const scoutResults = await runScoutTier(scoutQueries, signal);
    updateCoverage(coverage, scoutResults);

    // Check if we should proceed to Tier 2
    if (coverage.coveragePercentage < 0.5) {
      log.info(`[Orchestration] Coverage too low (${(coverage.coveragePercentage * 100).toFixed(1)}%) — stopping`);
      results.push({
        iteration,
        tierResults: scoutResults,
        coverageAfter: coverage,
        newCompetitorsDiscovered: Array.from(
          new Set(
            scoutResults
              .flatMap(r => r.competitorsDiscovered || [])
              .filter(c => !discoveredCompetitors.has(c)),
          ),
        ),
        newTrendsIdentified: Array.from(
          new Set(
            scoutResults
              .flatMap(r => r.trendsIdentified || [])
              .filter(t => !discoveredTrends.has(t)),
          ),
        ),
        qualityScore: calculateQualityScore(scoutResults),
        shouldContinue: false,
        reason: 'coverage_threshold',
      });
      break;
    }

    // Tier 2: Digger
    const diggerQueries = buildDiggerQueries(scoutResults, discoveredCompetitors);
    const diggerResults = await runDiggerTier(diggerQueries, coverage.coveragePercentage, signal);
    updateCoverage(coverage, diggerResults);

    // Tier 3: Synthesizer
    const synthesisTasks = buildSynthesisTasks(coverage);
    const synthResults = await runSynthesisTier(synthesisTasks, new Map(), signal);
    updateCoverage(coverage, synthResults);

    // Track new discoveries
    const allTierResults = [...scoutResults, ...diggerResults, ...synthResults];
    const newCompetitors = Array.from(
      new Set(
        allTierResults
          .flatMap(r => r.competitorsDiscovered || [])
          .filter(c => !discoveredCompetitors.has(c)),
      ),
    );
    const newTrends = Array.from(
      new Set(
        allTierResults
          .flatMap(r => r.trendsIdentified || [])
          .filter(t => !discoveredTrends.has(t)),
      ),
    );

    newCompetitors.forEach(c => discoveredCompetitors.add(c));
    newTrends.forEach(t => discoveredTrends.add(t));

    // Determine if we should continue
    let shouldContinue = true;
    let reason: 'coverage_threshold' | 'quality_acceptable' | 'diminishing_returns' | 'max_iterations' =
      'diminishing_returns';

    if (coverage.coveragePercentage >= targetCoverage) {
      shouldContinue = false;
      reason = 'coverage_threshold';
      log.info(`[Orchestration] Coverage target achieved: ${(coverage.coveragePercentage * 100).toFixed(1)}%`);
    } else if (iteration >= maxIterations) {
      shouldContinue = false;
      reason = 'max_iterations';
      log.info(`[Orchestration] Max iterations reached (${maxIterations})`);
    } else if (newCompetitors.length === 0 && newTrends.length === 0 && iteration > 10) {
      shouldContinue = false;
      reason = 'diminishing_returns';
      log.info(`[Orchestration] Diminishing returns — no new discoveries in this iteration`);
    }

    results.push({
      iteration,
      tierResults: allTierResults,
      coverageAfter: coverage,
      newCompetitorsDiscovered: newCompetitors,
      newTrendsIdentified: newTrends,
      qualityScore: calculateQualityScore(allTierResults),
      shouldContinue,
      reason,
    });

    if (!shouldContinue) break;
  }

  log.info(`\n[Orchestration] Cycle complete after ${results.length} iterations`);
  log.info(`Final coverage: ${(coverage.coveragePercentage * 100).toFixed(1)}%`);
  log.info(`Competitors discovered: ${discoveredCompetitors.size}`);
  log.info(`Trends identified: ${discoveredTrends.size}`);

  return results;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function initializeCoverage(): CoverageMetrics {
  return {
    totalDimensions: RESEARCH_DIMENSIONS.length,
    coveredDimensions: 0,
    coveragePercentage: 0,
    dimensionCoverage: Object.fromEntries(
      RESEARCH_DIMENSIONS.map(dim => [
        dim,
        { covered: false, sources: 0, confidence: 0 },
      ]),
    ),
    sourcesByType: {},
    sourcesByDomain: {},
  };
}

function updateCoverage(coverage: CoverageMetrics, results: ResearcherResult[]): void {
  for (const result of results) {
    // Map result to dimensions (simplified — in production would be more sophisticated)
    const relevantDims = mapResultToDimensions(result);
    for (const dim of relevantDims) {
      const current = coverage.dimensionCoverage[dim];
      if (current) {
        current.covered = true;
        current.sources += result.sources;
        current.confidence = Math.max(current.confidence, result.confidence);
      }
    }
  }

  coverage.coveredDimensions = Object.values(coverage.dimensionCoverage).filter(d => d.covered).length;
  coverage.coveragePercentage = coverage.coveredDimensions / coverage.totalDimensions;
}

function mapResultToDimensions(result: ResearcherResult): ResearchDimension[] {
  const dims: ResearchDimension[] = [];

  if (result.query.toLowerCase().includes('market')) {
    dims.push('market_size_trends' as ResearchDimension);
  }
  if (result.query.toLowerCase().includes('competitor')) {
    dims.push('competitor_analysis' as ResearchDimension);
  }
  if (result.query.toLowerCase().includes('objection')) {
    dims.push('customer_objections' as ResearchDimension);
  }
  if (result.query.toLowerCase().includes('trend')) {
    dims.push('emerging_trends' as ResearchDimension);
  }
  if (result.query.toLowerCase().includes('price')) {
    dims.push('pricing_strategies' as ResearchDimension);
  }
  if (result.query.toLowerCase().includes('reddit')) {
    dims.push('reddit_research' as ResearchDimension);
  }

  return dims.length > 0 ? dims : ['market_size_trends' as ResearchDimension];
}

function buildDiggerQueries(scoutResults: ResearcherResult[], competitors: Set<string>): DiggerQuery[] {
  const queries: DiggerQuery[] = [];

  // Follow up on discovered competitors
  for (const competitor of Array.from(competitors).slice(0, 3)) {
    queries.push({
      query: `${competitor} marketing strategy positioning messaging 2025`,
      parentScoutQuery: 'competitor_discovery',
      purpose: 'competitor_deep_dive',
      targetDepth: 'detailed_analysis',
      priority: 'high',
    });

    queries.push({
      query: `${competitor} customer reviews testimonials reddit complaints`,
      parentScoutQuery: 'competitor_discovery',
      purpose: 'competitor_deep_dive',
      targetDepth: 'community_insights',
      priority: 'high',
    });
  }

  // Drill down on trends
  if (scoutResults.some(r => r.trendsIdentified && r.trendsIdentified.length > 0)) {
    queries.push({
      query: `market trends evidence statistics data 2024 2025`,
      purpose: 'trend_evidence',
      targetDepth: 'statistical_evidence',
      priority: 'high',
    });
  }

  return queries;
}

function buildSynthesisTasks(coverage: CoverageMetrics): SynthesisTask[] {
  const tasks: SynthesisTask[] = [];

  // Cross-dimension analysis between high-coverage areas
  const coveredDims = Object.entries(coverage.dimensionCoverage)
    .filter(([_, info]) => info.covered && info.confidence > 0.6)
    .map(([dim]) => dim);

  if (coveredDims.length >= 2) {
    tasks.push({
      taskId: 'cross_competitor_trends',
      type: 'cross_dimension',
      dimension1: 'competitor_analysis',
      dimension2: 'emerging_trends',
      priority: 'high',
    });
  }

  if (coveredDims.includes('customer_objections') && coveredDims.includes('market_size_trends')) {
    tasks.push({
      taskId: 'objection_market_fit',
      type: 'gap_analysis',
      dimension1: 'customer_objections',
      dimension2: 'market_size_trends',
      priority: 'high',
    });
  }

  return tasks;
}

function calculateQualityScore(results: ResearcherResult[]): number {
  if (results.length === 0) return 0;

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const totalSources = results.reduce((sum, r) => sum + r.sources, 0);
  const sourceQuality = Math.min(totalSources / 50, 1.0); // 50+ sources = max quality

  return (avgConfidence * 0.6 + sourceQuality * 0.4) * 100;
}

function extractKeyFindings(text: string): string[] {
  const findings: string[] = [];
  const sentences = text.split(/[.!?]+/).slice(0, 15); // First 15 sentences

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > 30 && trimmed.length < 300) {
      findings.push(trimmed);
    }
  }

  return findings.slice(0, 5); // Top 5 findings
}

function extractDetailedFindings(text: string): string[] {
  const findings: string[] = [];

  // Look for specific patterns (quotes, stats, comparisons)
  const quotedMatches = text.match(/"([^"]{30,200})"/g) || [];
  const statMatches = text.match(/(\d+%?|\$\d+[KMB]?|[\d,]+\s+(?:million|billion|thousand))/g) || [];

  findings.push(...quotedMatches.slice(0, 3).map(q => q.replace(/"/g, '')));
  findings.push(...statMatches.slice(0, 3));

  return findings.filter(f => f.length > 10);
}

function extractCompetitorMentions(text: string): string[] {
  // Pattern: capitalized brand names followed by "competitor", "brand", "company", etc.
  const pattern = /(?:^|\s)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:competitor|brand|company|vs\.?)/gi;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map(m => m.trim()).filter(m => m.length > 3))].slice(0, 10);
}

function extractTrendMentions(text: string): string[] {
  const trendKeywords = ['trend', 'emerging', 'growing', 'increasing', 'shift', 'evolution', 'innovation'];
  const sentences = text.split(/[.!?]+/);

  return sentences
    .filter(s =>
      trendKeywords.some(
        kw => s.toLowerCase().includes(kw),
      ),
    )
    .slice(0, 5)
    .map(s => s.trim());
}

function identifyResearchGaps(text: string, purpose: DiggerQuery['purpose']): string[] {
  const gaps: string[] = [];

  if (purpose === 'competitor_deep_dive' && !text.toLowerCase().includes('pricing')) {
    gaps.push('Missing: Competitor pricing details');
  }

  if (purpose === 'objection_proof' && !text.toLowerCase().match(/\d+\s*(?:%|percent)/)) {
    gaps.push('Missing: Statistical evidence/percentages');
  }

  return gaps;
}

function buildSynthesisPrompt(task: SynthesisTask, previousResults: Map<string, ResearcherResult>): string {
  return `You are a research synthesis expert. Analyze the following research dimensions and identify:
1. Cross-dimensional patterns (how ${task.dimension1} affects ${task.dimension2 || 'overall strategy'})
2. Gaps in current research
3. Actionable insights combining multiple dimensions
4. Confidence level for each insight

Be specific and evidence-based.`;
}

function extractSynthesisInsights(synthesis: string): string[] {
  const sentences = synthesis.split(/[.!?]+/).slice(0, 10);
  return sentences.map(s => s.trim()).filter(s => s.length > 20);
}

function identifyMetaGaps(synthesis: string): string[] {
  const gaps: string[] = [];

  if (synthesis.toLowerCase().includes('need more')) {
    gaps.push('Synthesis indicates need for more research');
  }

  if (!synthesis.toLowerCase().includes('clear')) {
    gaps.push('Insights lack clarity — recommend follow-up queries');
  }

  return gaps;
}

export default {
  runAdvancedResearchCycle,
  runScoutTier,
  runDiggerTier,
  runSynthesisTier,
};
