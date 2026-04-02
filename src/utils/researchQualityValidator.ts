/**
 * Research Quality Validator — Multi-Dimensional Quality Assessment
 *
 * Validates findings throughout research pipeline against:
 * - Breadth: How many sources per finding?
 * - Depth: How specific are the insights (quotes, stats, examples)?
 * - Recency: Are sources recent (2024-2025)?
 * - Diversity: Academic + practitioners + community?
 * - Confidence: Evidence-based vs speculative?
 * - Actionability: Can this be used to guide campaign?
 *
 * Features:
 * - Per-finding quality score (0-100)
 * - Per-dimension quality assessment
 * - Weak finding identification (single source, generic, outdated)
 * - Recommendation: if quality < 70%, flag for re-research
 * - Confidence per dimension
 * - Trend analysis (is quality improving with more research?)
 */

import { createLogger } from './logger';
import type { ResearchFindings, ResearchAuditTrail, ResearchSource } from '../types';

const log = createLogger('researchQualityValidator');

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export interface FindingQualityScore {
  finding: string;
  category: string;
  score: number; // 0-100
  breadthScore: number; // Source count quality
  depthScore: number; // Specificity of finding
  recencyScore: number; // How recent are sources?
  diversityScore: number; // Source type variety
  confidenceScore: number; // Evidence strength
  actionabilityScore: number; // Can this guide decisions?
  sourceCount: number;
  weaknessFlags: string[];
  recommendation: 'use_as_is' | 'use_with_caution' | 'requestion_needed';
}

export interface DimensionQualityAssessment {
  dimension: string;
  overallScore: number; // 0-100
  findingCount: number;
  averageSourcesPerFinding: number;
  sourceTypeCoverage: string[]; // Types of sources used
  confidenceLevel: 'high' | 'medium' | 'low';
  weakFindings: string[];
  trends: {
    improvingWithMoreResearch: boolean;
    plateaued: boolean;
    declining: boolean;
  };
  requiresFollowUp: boolean;
  followUpQueries?: string[];
}

export interface ResearchQualityReport {
  generatedAt: number;
  overallScore: number; // 0-100: holistic quality
  totalFindings: number;
  findingsByQualityTier: {
    excellent: number; // 85-100
    good: number; // 70-84
    mediocre: number; // 50-69
    weak: number; // <50
  };
  dimensionAssessments: Map<string, DimensionQualityAssessment>;
  weakFindings: FindingQualityScore[];
  sourceMetrics: {
    totalSources: number;
    avgSourcesPerFinding: number;
    sourceTypeDistribution: Record<string, number>;
    recencyDistribution: Record<string, number>; // 2025, 2024, 2023, older
    uniqueDomains: number;
  };
  confidenceByDimension: Record<string, number>;
  criticalWeaknesses: string[];
  researchCompleteness: {
    dimensionsFullyCovered: number;
    dimensionsPartiallyCovered: number;
    dimensionsNotCovered: number;
    completionPercentage: number;
  };
  recommendedActions: string[];
}

// ─────────────────────────────────────────────────────────────
// Quality Validation Thresholds
// ─────────────────────────────────────────────────────────────

const QUALITY_THRESHOLDS = {
  minSourcesPerFinding: 3, // At least 3 sources for solid finding
  minUniqueDomainsPerDimension: 5, // Diverse sources
  recencyCutoff: 2023, // Current year - 2 = good recency
  minDepthForActionable: 60, // Need specificity
};

// ─────────────────────────────────────────────────────────────
// Master Validation Function
// ─────────────────────────────────────────────────────────────

export function validateResearchQuality(
  findings: ResearchFindings,
  auditTrail: ResearchAuditTrail,
  previousReports?: ResearchQualityReport[],
): ResearchQualityReport {
  const startTime = Date.now();

  log.info('[QualityValidator] Starting comprehensive quality validation');
  log.info(`  Total sources: ${auditTrail.totalSources}`);
  log.info(`  Source types: ${Object.keys(auditTrail.sourcesByType).join(', ')}`);

  // 1. Assess individual findings
  const allFindings = extractAllFindings(findings);
  const findingScores = allFindings.map(f => assessFindingQuality(f, auditTrail, findings));

  // 2. Assess dimensions
  const dimensions = extractDimensions(findings);
  const dimensionAssessments = new Map<string, DimensionQualityAssessment>();

  for (const dimension of dimensions) {
    const assessment = assessDimensionQuality(
      dimension,
      findings,
      auditTrail,
      findingScores.filter(f => f.category === dimension),
      previousReports,
    );
    dimensionAssessments.set(dimension, assessment);
  }

  // 3. Calculate overall metrics
  const weakFindings = findingScores.filter(f => f.score < 70).sort((a, b) => a.score - b.score);

  const sourceMetrics = calculateSourceMetrics(auditTrail);
  const confidenceByDimension = calculateConfidenceByDimension(dimensionAssessments);
  const criticalWeaknesses = identifyCriticalWeaknesses(
    findingScores,
    dimensionAssessments,
    sourceMetrics,
  );
  const completeness = assessResearchCompleteness(dimensionAssessments);

  // 4. Calculate overall quality score
  const qualityTiers = categorizeByQuality(findingScores);
  const overallScore = calculateOverallQualityScore(
    findingScores,
    sourceMetrics,
    completeness,
    dimensionAssessments,
  );

  // 5. Generate recommendations
  const recommendations = generateRecommendations(
    findingScores,
    dimensionAssessments,
    criticalWeaknesses,
    sourceMetrics,
  );

  const elapsed = Date.now() - startTime;

  const report: ResearchQualityReport = {
    generatedAt: Date.now(),
    overallScore,
    totalFindings: allFindings.length,
    findingsByQualityTier: qualityTiers,
    dimensionAssessments,
    weakFindings: weakFindings.slice(0, 10),
    sourceMetrics,
    confidenceByDimension,
    criticalWeaknesses,
    researchCompleteness: completeness,
    recommendedActions: recommendations,
  };

  logQualityReport(report, elapsed);

  return report;
}

// ─────────────────────────────────────────────────────────────
// Individual Finding Assessment
// ─────────────────────────────────────────────────────────────

function assessFindingQuality(
  finding: { text: string; category: string },
  auditTrail: ResearchAuditTrail,
  fullFindings: ResearchFindings,
): FindingQualityScore {
  // Map finding to supporting sources
  const supportingSources = auditTrail.sourceList.filter(
    s =>
      s.extractedSnippet?.includes(finding.text.substring(0, 50)) ||
      s.query?.toLowerCase().includes(finding.category.toLowerCase()),
  );

  const sourceCount = supportingSources.length;

  // Calculate component scores
  const breadthScore = calculateBreadthScore(sourceCount);
  const depthScore = calculateDepthScore(finding.text);
  const recencyScore = calculateRecencyScore(supportingSources);
  const diversityScore = calculateDiversityScore(supportingSources);
  const confidenceScore = calculateConfidenceScore(finding.text, sourceCount);
  const actionabilityScore = calculateActionabilityScore(finding.text);

  // Weighted composite score
  const score =
    breadthScore * 0.25 + // Source count very important
    depthScore * 0.25 + // Specificity crucial
    recencyScore * 0.15 + // Recency bonus
    diversityScore * 0.15 + // Diversity important
    confidenceScore * 0.15 + // Confidence essential
    actionabilityScore * 0.05; // Actionability nice-to-have

  // Identify weakness flags
  const weaknessFlags: string[] = [];
  if (sourceCount < QUALITY_THRESHOLDS.minSourcesPerFinding) {
    weaknessFlags.push(`Only ${sourceCount} sources (need 3+)`);
  }
  if (depthScore < 50) {
    weaknessFlags.push('Generic/vague language — lacks specificity');
  }
  if (recencyScore < 40) {
    weaknessFlags.push('Sources are outdated (2023 or older)');
  }
  if (diversityScore < 50) {
    weaknessFlags.push('Limited source diversity — bias risk');
  }

  // Recommendation
  let recommendation: 'use_as_is' | 'use_with_caution' | 'requestion_needed' = 'use_as_is';
  if (score < 50) {
    recommendation = 'requestion_needed';
  } else if (score < 70) {
    recommendation = 'use_with_caution';
  }

  return {
    finding: finding.text.substring(0, 100),
    category: finding.category,
    score: Math.round(score),
    breadthScore: Math.round(breadthScore),
    depthScore: Math.round(depthScore),
    recencyScore: Math.round(recencyScore),
    diversityScore: Math.round(diversityScore),
    confidenceScore: Math.round(confidenceScore),
    actionabilityScore: Math.round(actionabilityScore),
    sourceCount,
    weaknessFlags,
    recommendation,
  };
}

// ─────────────────────────────────────────────────────────────
// Component Scoring Functions
// ─────────────────────────────────────────────────────────────

function calculateBreadthScore(sourceCount: number): number {
  // 0 sources = 0, 3 sources = 60, 10+ sources = 100
  if (sourceCount === 0) return 0;
  if (sourceCount >= 10) return 100;
  return (sourceCount / 10) * 100;
}

function calculateDepthScore(text: string): number {
  // Measure specificity: quotes, statistics, examples
  const hasQuotes = /"[^"]{20,}"/g.test(text) ? 20 : 0;
  const hasStatistics = /\d+%|\$\d+|[\d,]+\s+(?:million|billion)/g.test(text) ? 25 : 0;
  const hasExamples = /(?:e\.g\.|example|case|such as)/i.test(text) ? 15 : 0;
  const hasSpecificBrands = /[A-Z][a-zA-Z]+\s+(?:brand|product|company)/g.test(text) ? 20 : 0;
  const length = Math.min((text.length / 500) * 20, 20); // Long, detailed text is better

  return hasQuotes + hasStatistics + hasExamples + hasSpecificBrands + length;
}

function calculateRecencyScore(sources: ResearchSource[]): number {
  if (sources.length === 0) return 0;

  const currentYear = new Date().getFullYear();
  let recentCount = 0;

  for (const source of sources) {
    // Extract year from URL or metadata
    const yearMatch = source.url?.match(/20\d{2}/) || [];
    if (yearMatch.length > 0) {
      const year = parseInt(yearMatch[0]);
      if (year >= currentYear - 1) {
        recentCount++;
      }
    }
  }

  // 80%+ recent sources = 100
  return Math.min((recentCount / sources.length) * 100 * 1.25, 100);
}

function calculateDiversityScore(sources: ResearchSource[]): number {
  if (sources.length === 0) return 0;

  // Count unique source types
  const sourceTypes = new Set(sources.map(s => s.source));
  const uniqueDomains = new Set(sources.map(s => extractDomain(s.url)));

  // Type diversity (max 5 types for simplicity)
  const typeScore = Math.min((sourceTypes.size / 3) * 50, 50);
  // Domain diversity (max 10 unique domains)
  const domainScore = Math.min((uniqueDomains.size / 10) * 50, 50);

  return typeScore + domainScore;
}

function calculateConfidenceScore(text: string, sourceCount: number): number {
  // Confidence based on language certainty + source corroboration
  const hasConfidentLanguage = /clear|evident|demonstrated|proven|consensus/i.test(text) ? 20 : 0;
  const hasUnconfidentLanguage = /appears|seems|might|could|possibly|unclear/i.test(text) ? -15 : 0;
  const sourceBonus = Math.min((sourceCount / 5) * 80, 80); // 5+ sources for high confidence

  return Math.max(0, Math.min(100, hasConfidentLanguage + hasUnconfidentLanguage + sourceBonus));
}

function calculateActionabilityScore(text: string): number {
  // Can this finding guide campaign decisions?
  const hasActionTerms = /recommendation|suggest|approach|strategy|should|must/i.test(text) ? 50 : 20;
  const isSpecific = text.length > 150 && /[A-Z][a-zA-Z]+.*[a-z]+$/g.test(text) ? 30 : 10;
  const targetsDecisionMaker = /brand|campaign|message|positioning|targeting/i.test(text) ? 20 : 0;

  return hasActionTerms + isSpecific + targetsDecisionMaker;
}

// ─────────────────────────────────────────────────────────────
// Dimension Assessment
// ─────────────────────────────────────────────────────────────

function assessDimensionQuality(
  dimension: string,
  findings: ResearchFindings,
  auditTrail: ResearchAuditTrail,
  findingScores: FindingQualityScore[],
  previousReports?: ResearchQualityReport[],
): DimensionQualityAssessment {
  const relevantSources = auditTrail.sourceList.filter(
    s =>
      s.query?.toLowerCase().includes(dimension.replace(/_/g, ' ')) ||
      s.source === dimension,
  );

  const sourceTypeCoverage = Array.from(new Set(relevantSources.map(s => s.source)));
  const avgSourcesPerFinding = relevantSources.length / Math.max(1, findingScores.length);
  const avgFindingScore = findingScores.length > 0
    ? findingScores.reduce((sum, f) => sum + f.score, 0) / findingScores.length
    : 50;

  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
  if (avgFindingScore > 75 && avgSourcesPerFinding > 5 && sourceTypeCoverage.length > 2) {
    confidenceLevel = 'high';
  } else if (avgFindingScore < 60 || avgSourcesPerFinding < 2 || sourceTypeCoverage.length < 2) {
    confidenceLevel = 'low';
  }

  // Trend analysis
  const trends = {
    improvingWithMoreResearch: false,
    plateaued: false,
    declining: false,
  };

  if (previousReports && previousReports.length > 0) {
    const previousScore = previousReports[previousReports.length - 1].dimensionAssessments.get(dimension)?.overallScore || 0;
    if (avgFindingScore > previousScore + 5) {
      trends.improvingWithMoreResearch = true;
    } else if (Math.abs(avgFindingScore - previousScore) < 3) {
      trends.plateaued = true;
    } else if (avgFindingScore < previousScore - 5) {
      trends.declining = true;
    }
  }

  const weakFindings = findingScores.filter(f => f.score < 60).map(f => f.finding);
  const requiresFollowUp = weakFindings.length > 0 || avgFindingScore < 70;

  return {
    dimension,
    overallScore: Math.round(avgFindingScore),
    findingCount: findingScores.length,
    averageSourcesPerFinding: Math.round(avgSourcesPerFinding * 10) / 10,
    sourceTypeCoverage,
    confidenceLevel,
    weakFindings,
    trends,
    requiresFollowUp,
  };
}

// ─────────────────────────────────────────────────────────────
// Overall Quality Calculation
// ─────────────────────────────────────────────────────────────

function calculateOverallQualityScore(
  findingScores: FindingQualityScore[],
  sourceMetrics: any,
  completeness: any,
  dimensionAssessments: Map<string, DimensionQualityAssessment>,
): number {
  if (findingScores.length === 0) return 0;

  const avgFindingScore = findingScores.reduce((sum, f) => sum + f.score, 0) / findingScores.length;
  const sourceQuality = Math.min((sourceMetrics.totalSources / 100) * 30, 30);
  const completenessBonus = (completeness.completionPercentage / 100) * 25;
  const dimensionConsistency =
    (Array.from(dimensionAssessments.values()).filter(d => d.overallScore > 70).length /
      dimensionAssessments.size) *
    15;

  return Math.round(avgFindingScore * 0.4 + sourceQuality + completenessBonus + dimensionConsistency);
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function extractAllFindings(findings: ResearchFindings): Array<{ text: string; category: string }> {
  const allFindings: Array<{ text: string; category: string }> = [];

  // Extract from various finding types
  if (findings.deepDesires) {
    findings.deepDesires.forEach(d => {
      allFindings.push({ text: d.deepestDesire, category: 'desires' });
    });
  }

  if (findings.objections) {
    findings.objections.forEach(o => {
      allFindings.push({ text: o.objection, category: 'objections' });
    });
  }

  return allFindings;
}

function extractDimensions(findings: ResearchFindings): string[] {
  return [
    'market_research',
    'competitor_analysis',
    'customer_objections',
    'emerging_trends',
    'audience_insights',
    'positioning',
  ];
}

function calculateSourceMetrics(auditTrail: ResearchAuditTrail) {
  const sourceTypeDistribution = auditTrail.sourcesByType;
  const uniqueDomains = new Set(auditTrail.sourceList.map(s => extractDomain(s.url)));

  // Recency distribution
  const recencyDistribution: Record<string, number> = { '2025': 0, '2024': 0, '2023': 0, 'older': 0 };
  for (const source of auditTrail.sourceList) {
    const yearMatch = source.url?.match(/20\d{2}/);
    if (yearMatch) {
      const year = yearMatch[0];
      if (year === '2025') recencyDistribution['2025']++;
      else if (year === '2024') recencyDistribution['2024']++;
      else if (year === '2023') recencyDistribution['2023']++;
      else recencyDistribution['older']++;
    }
  }

  return {
    totalSources: auditTrail.totalSources,
    avgSourcesPerFinding: auditTrail.totalSources / Math.max(1, 10), // Placeholder
    sourceTypeDistribution,
    recencyDistribution,
    uniqueDomains: uniqueDomains.size,
  };
}

function calculateConfidenceByDimension(
  dimensionAssessments: Map<string, DimensionQualityAssessment>,
): Record<string, number> {
  const confidence: Record<string, number> = {};

  for (const [dim, assessment] of dimensionAssessments) {
    const levelMap = { high: 0.9, medium: 0.6, low: 0.3 };
    confidence[dim] = levelMap[assessment.confidenceLevel] * (assessment.overallScore / 100);
  }

  return confidence;
}

function identifyCriticalWeaknesses(
  findingScores: FindingQualityScore[],
  dimensionAssessments: Map<string, DimensionQualityAssessment>,
  sourceMetrics: any,
): string[] {
  const weaknesses: string[] = [];

  const lowQualityFindings = findingScores.filter(f => f.score < 40).length;
  if (lowQualityFindings > 0) {
    weaknesses.push(`${lowQualityFindings} findings with very low quality scores (<40)`);
  }

  const lowConfidenceDims = Array.from(dimensionAssessments.values()).filter(d => d.confidenceLevel === 'low');
  if (lowConfidenceDims.length > 2) {
    weaknesses.push(`${lowConfidenceDims.length} dimensions with low confidence`);
  }

  if (sourceMetrics.uniqueDomains < 5) {
    weaknesses.push('Limited domain diversity — potential bias');
  }

  return weaknesses;
}

function assessResearchCompleteness(dimensionAssessments: Map<string, DimensionQualityAssessment>) {
  const totalDimensions = dimensionAssessments.size;
  const fullyCovered = Array.from(dimensionAssessments.values()).filter(d => d.overallScore > 75).length;
  const partiallyCovered = Array.from(dimensionAssessments.values()).filter(
    d => d.overallScore > 50 && d.overallScore <= 75,
  ).length;
  const notCovered = totalDimensions - fullyCovered - partiallyCovered;

  return {
    dimensionsFullyCovered: fullyCovered,
    dimensionsPartiallyCovered: partiallyCovered,
    dimensionsNotCovered: notCovered,
    completionPercentage: (fullyCovered / totalDimensions) * 100,
  };
}

function categorizeByQuality(findingScores: FindingQualityScore[]) {
  const tiers = { excellent: 0, good: 0, mediocre: 0, weak: 0 };

  for (const score of findingScores) {
    if (score.score >= 85) tiers.excellent++;
    else if (score.score >= 70) tiers.good++;
    else if (score.score >= 50) tiers.mediocre++;
    else tiers.weak++;
  }

  return tiers;
}

function generateRecommendations(
  findingScores: FindingQualityScore[],
  dimensionAssessments: Map<string, DimensionQualityAssessment>,
  criticalWeaknesses: string[],
  sourceMetrics: any,
): string[] {
  const recommendations: string[] = [];

  // Low-quality findings
  const lowQuality = findingScores.filter(f => f.recommendation === 'requestion_needed');
  if (lowQuality.length > 0) {
    recommendations.push(`Re-research ${lowQuality.length} findings with low quality scores`);
  }

  // Low-confidence dimensions
  const lowConfidenceDims = Array.from(dimensionAssessments.values())
    .filter(d => d.confidenceLevel === 'low')
    .map(d => d.dimension);
  if (lowConfidenceDims.length > 0) {
    recommendations.push(`Increase sources for: ${lowConfidenceDims.slice(0, 2).join(', ')}`);
  }

  // Source diversity
  if (sourceMetrics.uniqueDomains < 5) {
    recommendations.push('Expand source diversity to reduce bias (target: 5+ unique domains)');
  }

  // Outdated sources
  const outdated = sourceMetrics.recencyDistribution['older'] || 0;
  if (outdated > sourceMetrics.totalSources * 0.3) {
    recommendations.push('Many sources are outdated — prioritize 2024-2025 sources');
  }

  return recommendations;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function logQualityReport(report: ResearchQualityReport, elapsed: number): void {
  log.info(`[QualityValidator] Report complete in ${(elapsed / 1000).toFixed(1)}s`);
  log.info(`  Overall Score: ${report.overallScore}/100`);
  log.info(`  Findings: ${report.findingsByQualityTier.excellent} excellent, ${report.findingsByQualityTier.good} good, ${report.findingsByQualityTier.mediocre} mediocre, ${report.findingsByQualityTier.weak} weak`);
  log.info(`  Dimensions: ${report.researchCompleteness.dimensionsFullyCovered} fully covered, ${report.researchCompleteness.dimensionsPartiallyCovered} partially covered`);
  log.info(`  Sources: ${report.sourceMetrics.totalSources} total, ${report.sourceMetrics.uniqueDomains} unique domains`);
  if (report.criticalWeaknesses.length > 0) {
    log.warn(`  Critical Weaknesses: ${report.criticalWeaknesses.join('; ')}`);
  }
  if (report.recommendedActions.length > 0) {
    log.info(`  Recommended Actions: ${report.recommendedActions.slice(0, 2).join('; ')}`);
  }
}

export default {
  validateResearchQuality,
  assessFindingQuality,
  assessDimensionQuality,
};
