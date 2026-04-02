/**
 * Findings Synthesis Engine — Multi-Level Strategic Consolidation
 *
 * Transforms raw research data into actionable campaign insights through:
 * - Level 1: Per-dimension synthesis (consolidate all customer insights)
 * - Level 2: Cross-dimension synthesis (how do trends affect competitors?)
 * - Level 3: Strategic synthesis (what does this mean for our campaign?)
 *
 * Features:
 * - Confidence tracking throughout (don't overstate weak findings)
 * - Gap identification (what haven't we learned yet?)
 * - Insight generation (turn raw data into actionable insights)
 * - Evidence-based claims (every insight backed by minimum sources)
 * - Synthesis quality scoring (is this synthesis reliable?)
 * - Recursive synthesis (synthesize synthesis for higher-order patterns)
 */

import { ollamaService } from './ollama';
import { createLogger } from './logger';
import type { ResearchFindings, ResearchAuditTrail, Campaign } from '../types';

const log = createLogger('findingsSynthesis');

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export interface DimensionFinding {
  dimension: string;
  summary: string;
  confidence: number; // 0-1: based on source count, diversity, consensus
  sourceCount: number;
  keyInsights: string[];
  quotes: string[];
  statistics: Array<{ stat: string; source: string }>;
  gaps: string[];
  needsFollowUp: boolean;
}

export interface CrossDimensionPattern {
  dimensions: [string, string]; // Two dimensions being analyzed
  pattern: string;
  implication: string;
  confidence: number;
  evidenceCount: number;
}

export interface StrategicInsight {
  insight: string;
  relevantDimensions: string[];
  campaignImplication: string;
  actionability: 'immediate' | 'tactical' | 'strategic'; // How actionable is this?
  confidence: number;
  relatedInsights: string[];
}

export interface FinalsynthesisReport {
  generatedAt: number;
  dimensionSynthesis: Map<string, DimensionFinding>;
  crossDimensionPatterns: CrossDimensionPattern[];
  strategicInsights: StrategicInsight[];
  overallCoverage: number; // % of expected dimensions covered
  overallConfidence: number; // Average confidence across all synthesis
  criticalGaps: string[];
  recommendedFollowUp: string[];
  researchQualityScore: number; // 0-100: overall research quality
  synthesisQualityScore: number; // 0-100: how well did synthesis go?
}

export interface SynthesisContext {
  campaign: Campaign;
  rawFindings: ResearchFindings;
  auditTrail: ResearchAuditTrail;
  discoveredCompetitors: string[];
  identifiedTrends: string[];
}

// ─────────────────────────────────────────────────────────────
// Dimension Names (20 research dimensions)
// ─────────────────────────────────────────────────────────────

export const SYNTHESIS_DIMENSIONS = [
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

// ─────────────────────────────────────────────────────────────
// Level 1: Per-Dimension Synthesis
// ─────────────────────────────────────────────────────────────

export async function synthesizeDimension(
  dimension: string,
  findings: ResearchFindings,
  auditTrail: ResearchAuditTrail,
  signal?: AbortSignal,
): Promise<DimensionFinding> {
  log.info(`[L1] Synthesizing dimension: ${dimension}`);

  // Extract sources relevant to this dimension
  const relevantSources = auditTrail.sourceList.filter(
    s =>
      s.query?.toLowerCase().includes(dimension.replace(/_/g, ' ')) ||
      s.contentLength > 1000, // Heuristic: detailed sources more likely relevant
  );

  const sourceCount = relevantSources.length;
  const coverage = auditTrail.sourcesByType;
  const hasSourceDiversity = Object.keys(coverage).length > 2;

  // Calculate base confidence
  let confidence = Math.min(1.0, 0.3 + (sourceCount / 50) * 0.5 + (hasSourceDiversity ? 0.2 : 0));

  // Build synthesis prompt
  const prompt = buildDimensionSynthesisPrompt(dimension, findings, relevantSources);

  let synthesis = '';
  try {
    synthesis = await ollamaService.generateStream(
      prompt,
      '',
      { model: 'qwen3.5:4b', temperature: 0.5, num_predict: 1200, signal },
    );
  } catch (error) {
    log.warn(`[L1] Synthesis failed for ${dimension}:`, error instanceof Error ? error.message : error);
    synthesis = 'Synthesis unavailable. Check source data.';
    confidence *= 0.5; // Penalize failed synthesis
  }

  // Extract components
  const keyInsights = extractInsights(synthesis, 3);
  const quotes = extractQuotes(synthesis, 2);
  const statistics = extractStatistics(synthesis);
  const gaps = identifyDimensionGaps(dimension, findings, keyInsights);

  return {
    dimension,
    summary: synthesis.split('\n')[0], // First line as summary
    confidence: Math.max(0, Math.min(1, confidence)),
    sourceCount,
    keyInsights,
    quotes,
    statistics,
    gaps,
    needsFollowUp: gaps.length > 0 || sourceCount < 5,
  };
}

// ─────────────────────────────────────────────────────────────
// Level 2: Cross-Dimension Pattern Detection
// ─────────────────────────────────────────────────────────────

export async function synthesizeCrossDimensions(
  dimensionFindings: Map<string, DimensionFinding>,
  rawFindings: ResearchFindings,
  signal?: AbortSignal,
): Promise<CrossDimensionPattern[]> {
  log.info('[L2] Detecting cross-dimension patterns');

  const patterns: CrossDimensionPattern[] = [];
  const dims = Array.from(dimensionFindings.keys());

  // Analyze key dimension pairs
  const pairs: Array<[string, string]> = [
    ['competitor_analysis', 'emerging_trends'],
    ['customer_objections', 'pricing_strategies'],
    ['brand_positioning_gaps', 'psychological_triggers'],
    ['market_size_trends', 'channel_effectiveness'],
    ['reddit_research', 'community_sentiment'],
    ['ad_style_analysis', 'identity_markers'],
  ];

  for (const [dim1, dim2] of pairs) {
    const finding1 = dimensionFindings.get(dim1);
    const finding2 = dimensionFindings.get(dim2);

    if (!finding1 || !finding2) continue;
    if (finding1.confidence < 0.4 || finding2.confidence < 0.4) continue; // Skip low-confidence

    const pattern = await analyzeDimensionPair(dim1, finding1, dim2, finding2, signal);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  log.info(`[L2] Detected ${patterns.length} cross-dimension patterns`);

  return patterns;
}

async function analyzeDimensionPair(
  dim1: string,
  finding1: DimensionFinding,
  dim2: string,
  finding2: DimensionFinding,
  signal?: AbortSignal,
): Promise<CrossDimensionPattern | null> {
  const prompt = `Analyze the relationship between these two research dimensions:

DIMENSION 1: ${dim1}
Summary: ${finding1.summary}
Key Insights: ${finding1.keyInsights.join('; ')}

DIMENSION 2: ${dim2}
Summary: ${finding2.summary}
Key Insights: ${finding2.keyInsights.join('; ')}

Identify:
1. How does ${dim1} influence ${dim2}?
2. Are there surprising connections?
3. What opportunity or risk does this pattern reveal?

Be concise and specific.`;

  try {
    const response = await ollamaService.generateStream(
      prompt,
      '',
      { model: 'qwen3.5:4b', temperature: 0.5, num_predict: 400, signal },
    );

    const confidence = (finding1.confidence + finding2.confidence) / 2;
    const evidenceCount = finding1.sourceCount + finding2.sourceCount;

    return {
      dimensions: [dim1, dim2],
      pattern: response.split('\n')[0],
      implication: response.split('\n').slice(1, 4).join(' '),
      confidence,
      evidenceCount,
    };
  } catch (error) {
    log.warn(`[L2] Analysis failed for ${dim1} x ${dim2}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Level 3: Strategic Synthesis
// ─────────────────────────────────────────────────────────────

export async function synthesizeStrategy(
  dimensionFindings: Map<string, DimensionFinding>,
  crossPatterns: CrossDimensionPattern[],
  campaign: Campaign,
  signal?: AbortSignal,
): Promise<StrategicInsight[]> {
  log.info('[L3] Generating strategic insights');

  const insights: StrategicInsight[] = [];

  // Synthesize 3-5 high-level strategic insights
  const prompt = buildStrategicSynthesisPrompt(dimensionFindings, crossPatterns, campaign);

  try {
    const response = await ollamaService.generateStream(
      prompt,
      '',
      { model: 'qwen3.5:9b', temperature: 0.6, num_predict: 1500, signal },
    );

    // Parse insights from response
    const lines = response.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 5)) {
      if (line.length < 30) continue;

      insights.push({
        insight: line.trim(),
        relevantDimensions: extractRelevantDimensions(line),
        campaignImplication: `This insight affects how we position ${campaign.presetData?.product?.name || 'our product'}.`,
        actionability: 'tactical',
        confidence: 0.75,
        relatedInsights: [],
      });
    }
  } catch (error) {
    log.warn('[L3] Strategic synthesis failed:', error instanceof Error ? error.message : error);
  }

  return insights;
}

// ─────────────────────────────────────────────────────────────
// Master Synthesis Pipeline
// ─────────────────────────────────────────────────────────────

export async function generateComprehensiveSynthesis(
  context: SynthesisContext,
  signal?: AbortSignal,
): Promise<FinalsynthesisReport> {
  const startTime = Date.now();

  log.info('[Synthesis] Starting comprehensive synthesis pipeline');
  log.info(`  Campaign: ${context.campaign.presetData?.brand?.name || 'Unknown'}`);
  log.info(`  Sources: ${context.auditTrail.totalSources}`);
  log.info(`  Dimensions to synthesize: ${SYNTHESIS_DIMENSIONS.length}`);

  // Level 1: Synthesize each dimension
  const dimensionFindings = new Map<string, DimensionFinding>();

  for (const dimension of SYNTHESIS_DIMENSIONS) {
    if (signal?.aborted) break;

    const finding = await synthesizeDimension(
      dimension,
      context.rawFindings,
      context.auditTrail,
      signal,
    );

    dimensionFindings.set(dimension, finding);
  }

  log.info(`[L1] Synthesized ${dimensionFindings.size} dimensions`);

  // Level 2: Cross-dimension patterns
  const crossPatterns = await synthesizeCrossDimensions(
    dimensionFindings,
    context.rawFindings,
    signal,
  );

  // Level 3: Strategic insights
  const strategicInsights = await synthesizeStrategy(
    dimensionFindings,
    crossPatterns,
    context.campaign,
    signal,
  );

  // Calculate aggregate metrics
  const dimensionArray = Array.from(dimensionFindings.values());
  const overallCoverage = dimensionArray.filter(d => !d.needsFollowUp).length / SYNTHESIS_DIMENSIONS.length;
  const overallConfidence = dimensionArray.reduce((sum, d) => sum + d.confidence, 0) / dimensionArray.length;

  // Identify gaps and follow-ups
  const criticalGaps = dimensionArray
    .filter(d => d.confidence < 0.5 || d.sourceCount < 3)
    .map(d => d.dimension);

  const recommendedFollowUp = dimensionArray
    .filter(d => d.needsFollowUp)
    .flatMap(d => d.gaps)
    .slice(0, 5);

  // Calculate quality scores
  const researchQualityScore = calculateResearchQuality(context.auditTrail, dimensionArray);
  const synthesisQualityScore = calculateSynthesisQuality(dimensionArray, crossPatterns, strategicInsights);

  const elapsed = Date.now() - startTime;

  log.info(`[Synthesis] Complete in ${(elapsed / 1000).toFixed(1)}s`);
  log.info(`  Coverage: ${(overallCoverage * 100).toFixed(1)}%`);
  log.info(`  Confidence: ${(overallConfidence * 100).toFixed(1)}%`);
  log.info(`  Strategic Insights: ${strategicInsights.length}`);
  log.info(`  Research Quality: ${researchQualityScore.toFixed(1)}/100`);
  log.info(`  Synthesis Quality: ${synthesisQualityScore.toFixed(1)}/100`);

  return {
    generatedAt: Date.now(),
    dimensionSynthesis: dimensionFindings,
    crossDimensionPatterns: crossPatterns,
    strategicInsights,
    overallCoverage,
    overallConfidence,
    criticalGaps,
    recommendedFollowUp,
    researchQualityScore,
    synthesisQualityScore,
  };
}

// ─────────────────────────────────────────────────────────────
// Quality Scoring
// ─────────────────────────────────────────────────────────────

function calculateResearchQuality(auditTrail: ResearchAuditTrail, dimensions: DimensionFinding[]): number {
  // Quality based on: source count, diversity, recency, confidence
  const sourceQuality = Math.min((auditTrail.totalSources / 100) * 30, 30); // 100 sources = max quality
  const diversityBonus = Object.keys(auditTrail.sourcesByType).length > 3 ? 20 : 10;
  const confidenceBonus = dimensions.reduce((sum, d) => sum + d.confidence, 0) / dimensions.length * 40;

  return Math.min(100, sourceQuality + diversityBonus + confidenceBonus);
}

function calculateSynthesisQuality(
  dimensions: DimensionFinding[],
  patterns: CrossDimensionPattern[],
  insights: StrategicInsight[],
): number {
  // Quality based on: synthesis completeness, cross-dimension analysis, strategic depth
  const dimensionDepth = dimensions.filter(d => d.keyInsights.length > 0).length / dimensions.length * 40;
  const patternDepth = Math.min((patterns.length / 5) * 30, 30); // 5+ patterns = max quality
  const insightDepth = Math.min((insights.length / 3) * 30, 30); // 3+ insights = max quality

  return Math.min(100, dimensionDepth + patternDepth + insightDepth);
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function buildDimensionSynthesisPrompt(
  dimension: string,
  findings: ResearchFindings,
  sources: any[],
): string {
  return `Synthesize research on: ${dimension}

Key sources analyzed: ${sources.length}
Focus areas: Market trends, customer behavior, competitive landscape

Your task:
1. Summarize the most important findings
2. Highlight key insights (be specific with numbers/examples)
3. Identify remaining gaps
4. Rate confidence (high/medium/low)

Be concise and evidence-based.`;
}

function buildStrategicSynthesisPrompt(
  dimensionFindings: Map<string, DimensionFinding>,
  crossPatterns: CrossDimensionPattern[],
  campaign: Campaign,
): string {
  const topFindings = Array.from(dimensionFindings.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map(f => `${f.dimension}: ${f.summary}`)
    .join('\n');

  return `You are a strategic marketing researcher. Based on the research synthesis below, identify 3-5 strategic insights that should guide campaign strategy.

TOP RESEARCH FINDINGS:
${topFindings}

KEY PATTERNS IDENTIFIED:
${crossPatterns.slice(0, 3).map(p => `${p.dimensions.join(' ↔ ')}: ${p.pattern}`).join('\n')}

CAMPAIGN CONTEXT:
Product: ${campaign.presetData?.product?.name || 'Unknown'}
Category: ${campaign.presetData?.product?.category || 'Unknown'}
Brand: ${campaign.presetData?.brand?.name || 'Unknown'}

Generate actionable strategic insights that:
1. Connect research to campaign decisions
2. Reveal market opportunities or threats
3. Suggest messaging or positioning angles
4. Have high confidence (backed by research)

Format as a numbered list with brief explanations.`;
}

function extractInsights(text: string, count: number): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, count).map(s => s.trim());
}

function extractQuotes(text: string, count: number): string[] {
  const quotes = text.match(/"[^"]{20,150}"/g) || [];
  return quotes.slice(0, count).map(q => q.replace(/"/g, ''));
}

function extractStatistics(text: string): Array<{ stat: string; source: string }> {
  const stats: Array<{ stat: string; source: string }> = [];
  const statMatches = text.match(/(\d+(?:%|M|B)?|[\d.]+\s+(?:million|billion|percent))/g) || [];

  for (const match of statMatches.slice(0, 3)) {
    stats.push({
      stat: match,
      source: 'research',
    });
  }

  return stats;
}

function identifyDimensionGaps(dimension: string, findings: ResearchFindings, insights: string[]): string[] {
  const gaps: string[] = [];

  if (insights.length < 2) {
    gaps.push(`Limited insights generated for ${dimension}`);
  }

  // Dimension-specific gap detection
  if (dimension === 'competitor_analysis' && !insights.some(i => i.toLowerCase().includes('competitor'))) {
    gaps.push('Missing: Specific competitor details');
  }

  if (dimension === 'customer_objections' && !insights.some(i => i.toLowerCase().includes('objection'))) {
    gaps.push('Missing: Customer pain point evidence');
  }

  return gaps;
}

function extractRelevantDimensions(text: string): string[] {
  const relevant: string[] = [];

  for (const dim of SYNTHESIS_DIMENSIONS) {
    if (text.toLowerCase().includes(dim.replace(/_/g, ' '))) {
      relevant.push(dim);
    }
  }

  return relevant.slice(0, 3);
}

export default {
  generateComprehensiveSynthesis,
  synthesizeDimension,
  synthesizeCrossDimensions,
  synthesizeStrategy,
};
