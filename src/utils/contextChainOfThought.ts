/**
 * Context Chain of Thought — Complete Reasoning Provenance
 *
 * Tracks the complete decision tree showing HOW we got from raw data to insights.
 * Enables tracing back any conclusion to its source evidence and the reasoning path.
 *
 * For each major finding, we record:
 * 1. Initial hypothesis
 * 2. Queries that tested it
 * 3. Evidence that supported/refuted it
 * 4. Transformations applied
 * 5. Final insight
 *
 * Output: Complete provenance reports showing confidence and evidence chains
 *
 * Example:
 *   Hypothesis: "Customers fear product side effects"
 *   Queries: ["product side effects", "collagen safety reddit", "skincare side effects review"]
 *   Evidence: [
 *     {url: reddit.com/..., text: "worried about skin reaction", confidence: 85},
 *     {url: beautylish.com/..., text: "does it cause redness?", confidence: 80}
 *   ]
 *   Transformation: "Aggregated 12 sources → 'fear of adverse reactions'"
 *   FinalInsight: "Purchase objection: Worry about side effects (80% confidence)"
 */

import type { ResearchFindings, ResearchSource } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HypothesisTest {
  hypothesisId: string;
  statement: string;          // The claim being tested
  category: 'desire' | 'objection' | 'audience' | 'competitor' | 'emotional';
  initialConfidence: number;  // 0-100, before evidence gathering
  queriesUsed: string[];      // Search queries that tested this
  evidence: EvidenceEntry[];  // Collected evidence
  supportingCount: number;    // How many pieces support it
  refutingCount: number;      // How many pieces refute it
  finalConfidence: number;    // After evidence, 0-100
  verdict: 'SUPPORTED' | 'REFUTED' | 'INCONCLUSIVE';
}

export interface EvidenceEntry {
  sourceUrl: string;
  sourceType: 'reddit' | 'website' | 'academic' | 'social' | 'review' | 'forum';
  snippet: string;            // Direct quote from source
  relevance: number;          // 0-100, how directly relevant
  direction: 'supporting' | 'refuting' | 'neutral';  // Does this support/refute hypothesis?
  weight: number;             // 0-100, importance of this evidence
  extractedAt: number;        // Timestamp
}

export interface ReasoningStep {
  stepNumber: number;
  timestamp: number;
  action: 'query' | 'analyze' | 'synthesize' | 'rank' | 'decide';
  description: string;
  inputData: string[];        // What we analyzed
  outputData: string[];       // What we concluded
  confidence: number;         // How sure are we about this step?
  agentType?: string;         // orchestrator, researcher, reflection, etc.
}

export interface InsightChain {
  insightId: string;
  finalInsight: string;       // The actual finding/insight we're explaining
  insightType: 'desire' | 'objection' | 'persona_trait' | 'competitive_gap' | 'emotional_driver' | 'behavioral_pattern';
  sourceHypotheses: string[]; // Which hypotheses led to this?
  reasoningChain: ReasoningStep[];  // Step-by-step reasoning
  primarySources: ResearchSource[];  // Top 3-5 most important sources
  contradictingSources: ResearchSource[];  // Any conflicting evidence?
  overallConfidence: number;  // Final confidence score
  discoveredAt: number;       // When was this insight discovered?
  strengthScore: number;      // 0-100: how well-supported is this insight?
}

export interface ContextChainOfThoughtReport {
  reportId: string;
  generatedAt: number;
  hypotheses: HypothesisTest[];
  insightChains: InsightChain[];
  reasoningStats: {
    totalHypothesesTested: number;
    supportedHypotheses: number;
    refutedHypotheses: number;
    inconclusiveHypotheses: number;
    avgConfidenceGain: number;  // How much confidence increased from initial→final
    queriesExecuted: number;
    evidencePiecesCollected: number;
  };
  timeline: ReasoningStep[];  // Global timeline of all reasoning
  confidenceDistribution: {
    veryHigh: number;  // 80-100
    high: number;      // 60-80
    medium: number;    // 40-60
    low: number;       // 20-40
    veryLow: number;   // 0-20
  };
}

// ─── Chain of Thought Tracker ────────────────────────────────────────────────

export class ContextChainOfThoughtTracker {
  private hypotheses: Map<string, HypothesisTest> = new Map();
  private insightChains: Map<string, InsightChain> = new Map();
  private reasoningSteps: ReasoningStep[] = [];
  private stepCounter = 0;

  /**
   * Register a new hypothesis being tested
   */
  registerHypothesis(
    id: string,
    statement: string,
    category: 'desire' | 'objection' | 'audience' | 'competitor' | 'emotional',
    initialConfidence?: number
  ): void {
    this.hypotheses.set(id, {
      hypothesisId: id,
      statement,
      category,
      initialConfidence: initialConfidence || 50,
      queriesUsed: [],
      evidence: [],
      supportingCount: 0,
      refutingCount: 0,
      finalConfidence: initialConfidence || 50,
      verdict: 'INCONCLUSIVE',
    });
  }

  /**
   * Record a query being executed for hypothesis testing
   */
  recordQuery(hypothesisId: string, query: string): void {
    const hyp = this.hypotheses.get(hypothesisId);
    if (hyp && !hyp.queriesUsed.includes(query)) {
      hyp.queriesUsed.push(query);
    }
    this.addReasoningStep('query', `Executed search query for ${hypothesisId}`, [query], []);
  }

  /**
   * Add evidence to a hypothesis test
   */
  addEvidence(
    hypothesisId: string,
    sourceUrl: string,
    snippet: string,
    sourceType: 'reddit' | 'website' | 'academic' | 'social' | 'review' | 'forum',
    direction: 'supporting' | 'refuting' | 'neutral',
    relevance: number,
    weight: number
  ): void {
    const hyp = this.hypotheses.get(hypothesisId);
    if (!hyp) return;

    hyp.evidence.push({
      sourceUrl,
      sourceType,
      snippet,
      relevance,
      direction,
      weight,
      extractedAt: Date.now(),
    });

    // Update counts
    if (direction === 'supporting') hyp.supportingCount++;
    else if (direction === 'refuting') hyp.refutingCount++;

    // Update confidence based on evidence weight
    this.updateHypothesisConfidence(hypothesisId);
  }

  /**
   * Finalize hypothesis testing with verdict
   */
  finalizeHypothesis(hypothesisId: string): void {
    const hyp = this.hypotheses.get(hypothesisId);
    if (!hyp) return;

    // Calculate final confidence
    const totalEvidence = hyp.supportingCount + hyp.refutingCount;
    if (totalEvidence === 0) {
      hyp.finalConfidence = hyp.initialConfidence;
      hyp.verdict = 'INCONCLUSIVE';
    } else {
      const supportRatio = hyp.supportingCount / totalEvidence;
      hyp.finalConfidence = hyp.initialConfidence * 0.5 + supportRatio * 100 * 0.5;

      if (supportRatio > 0.7) hyp.verdict = 'SUPPORTED';
      else if (supportRatio < 0.3) hyp.verdict = 'REFUTED';
      else hyp.verdict = 'INCONCLUSIVE';
    }

    this.addReasoningStep(
      'decide',
      `Finalized hypothesis: ${hyp.hypothesisId} → ${hyp.verdict}`,
      [hyp.statement],
      [hyp.verdict]
    );
  }

  /**
   * Create an insight chain linking hypotheses to final insight
   */
  createInsightChain(
    insightId: string,
    finalInsight: string,
    insightType: 'desire' | 'objection' | 'persona_trait' | 'competitive_gap' | 'emotional_driver' | 'behavioral_pattern',
    sourceHypotheses: string[],
    primarySources: ResearchSource[],
    contradictingSources?: ResearchSource[]
  ): void {
    // Gather all reasoning steps that led to this insight
    const reasoningChain = this.reasoningSteps.slice(-10);  // Last 10 steps as context

    // Calculate confidence
    const avgConfidence = this.calculateAverageConfidence(sourceHypotheses);
    const strength = this.calculateStrength(primarySources, contradictingSources || []);

    this.insightChains.set(insightId, {
      insightId,
      finalInsight,
      insightType,
      sourceHypotheses,
      reasoningChain,
      primarySources,
      contradictingSources: contradictingSources || [],
      overallConfidence: avgConfidence,
      discoveredAt: Date.now(),
      strengthScore: strength,
    });

    this.addReasoningStep(
      'synthesize',
      `Created insight from hypotheses`,
      sourceHypotheses,
      [finalInsight]
    );
  }

  /**
   * Add a custom reasoning step (for any agent action)
   */
  addReasoningStep(
    action: 'query' | 'analyze' | 'synthesize' | 'rank' | 'decide',
    description: string,
    inputData: string[],
    outputData: string[],
    agentType?: string
  ): void {
    this.reasoningSteps.push({
      stepNumber: this.stepCounter++,
      timestamp: Date.now(),
      action,
      description,
      inputData,
      outputData,
      confidence: 75,  // Default, can be overridden
      agentType,
    });
  }

  /**
   * Build complete provenance report
   */
  buildProvenanceReport(): ContextChainOfThoughtReport {
    const hypothesesArray = Array.from(this.hypotheses.values());
    const insightChainsArray = Array.from(this.insightChains.values());

    const stats = {
      totalHypothesesTested: hypothesesArray.length,
      supportedHypotheses: hypothesesArray.filter(h => h.verdict === 'SUPPORTED').length,
      refutedHypotheses: hypothesesArray.filter(h => h.verdict === 'REFUTED').length,
      inconclusiveHypotheses: hypothesesArray.filter(h => h.verdict === 'INCONCLUSIVE').length,
      avgConfidenceGain: this.calculateAvgConfidenceGain(hypothesesArray),
      queriesExecuted: hypothesesArray.reduce((sum, h) => sum + h.queriesUsed.length, 0),
      evidencePiecesCollected: hypothesesArray.reduce((sum, h) => sum + h.evidence.length, 0),
    };

    const confidenceDistribution = this.calculateConfidenceDistribution(insightChainsArray);

    return {
      reportId: `cot-${Date.now()}`,
      generatedAt: Date.now(),
      hypotheses: hypothesesArray,
      insightChains: insightChainsArray,
      reasoningStats: stats,
      timeline: this.reasoningSteps,
      confidenceDistribution,
    };
  }

  /**
   * Generate human-readable provenance for an insight
   */
  getProvenanceForInsight(insightId: string): string {
    const chain = this.insightChains.get(insightId);
    if (!chain) return 'Insight not found';

    const lines: string[] = [
      `═══════════════════════════════════════════════════════`,
      `PROVENANCE: ${chain.finalInsight}`,
      `═══════════════════════════════════════════════════════`,
      ``,
      `Insight Type: ${chain.insightType}`,
      `Confidence: ${chain.overallConfidence.toFixed(0)}%`,
      `Strength: ${chain.strengthScore.toFixed(0)}/100`,
      ``,
      `─ Source Hypotheses ─`,
    ];

    chain.sourceHypotheses.forEach(hypId => {
      const hyp = this.hypotheses.get(hypId);
      if (hyp) {
        lines.push(`  • ${hyp.statement}`);
        lines.push(`    Verdict: ${hyp.verdict} (${hyp.finalConfidence.toFixed(0)}% confidence)`);
        lines.push(`    Evidence: ${hyp.supportingCount} supporting, ${hyp.refutingCount} refuting`);
      }
    });

    lines.push(``, `─ Primary Sources (Top ${Math.min(3, chain.primarySources.length)}) ─`);
    chain.primarySources.slice(0, 3).forEach((source, idx) => {
      lines.push(`  ${idx + 1}. ${source.url}`);
      lines.push(`     Query: "${source.query}"`);
      if (source.extractedSnippet) {
        lines.push(`     Evidence: "${source.extractedSnippet}"`);
      }
    });

    if (chain.contradictingSources.length > 0) {
      lines.push(``, `─ Contradicting Evidence ─`);
      chain.contradictingSources.forEach(source => {
        lines.push(`  • ${source.url}`);
        if (source.extractedSnippet) {
          lines.push(`    "${source.extractedSnippet}"`);
        }
      });
    }

    lines.push(``, `─ Reasoning Chain (Last ${Math.min(5, chain.reasoningChain.length)} steps) ─`);
    chain.reasoningChain.slice(-5).forEach(step => {
      lines.push(`  Step ${step.stepNumber}: ${step.action.toUpperCase()}`);
      lines.push(`    ${step.description}`);
      if (step.outputData.length > 0) {
        lines.push(`    → ${step.outputData.join(', ')}`);
      }
    });

    lines.push(``, `═══════════════════════════════════════════════════════`);
    return lines.join('\n');
  }

  /**
   * Find all insights related to a keyword
   */
  findRelatedInsights(keyword: string): InsightChain[] {
    const keywordLower = keyword.toLowerCase();
    return Array.from(this.insightChains.values()).filter(chain =>
      chain.finalInsight.toLowerCase().includes(keywordLower) ||
      chain.insightType.toLowerCase().includes(keywordLower)
    );
  }

  /**
   * Export full chain of thought as JSON for debugging
   */
  exportAsJSON(): Record<string, unknown> {
    return {
      hypotheses: Array.from(this.hypotheses.values()),
      insightChains: Array.from(this.insightChains.values()),
      timeline: this.reasoningSteps,
      stats: this.buildProvenanceReport().reasoningStats,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private updateHypothesisConfidence(hypothesisId: string): void {
    const hyp = this.hypotheses.get(hypothesisId);
    if (!hyp || hyp.evidence.length === 0) return;

    // Weighted average of all evidence
    let totalWeight = 0;
    let weightedConfidence = 0;

    hyp.evidence.forEach(ev => {
      const direction = ev.direction === 'supporting' ? 1 : ev.direction === 'refuting' ? 0 : 0.5;
      const weight = ev.weight * ev.relevance;
      totalWeight += weight;
      weightedConfidence += direction * weight;
    });

    if (totalWeight > 0) {
      const ratio = weightedConfidence / totalWeight;
      hyp.finalConfidence = hyp.initialConfidence * 0.3 + ratio * 100 * 0.7;
    }
  }

  private calculateAverageConfidence(hypothesisIds: string[]): number {
    if (hypothesisIds.length === 0) return 50;

    let totalConfidence = 0;
    hypothesisIds.forEach(id => {
      const hyp = this.hypotheses.get(id);
      if (hyp) totalConfidence += hyp.finalConfidence;
    });

    return totalConfidence / hypothesisIds.length;
  }

  private calculateStrength(supporting: ResearchSource[], contradicting: ResearchSource[]): number {
    const total = supporting.length + contradicting.length;
    if (total === 0) return 0;

    const supportRatio = supporting.length / total;
    return supportRatio * 100;
  }

  private calculateAvgConfidenceGain(hypotheses: HypothesisTest[]): number {
    if (hypotheses.length === 0) return 0;

    const totalGain = hypotheses.reduce((sum, h) => sum + (h.finalConfidence - h.initialConfidence), 0);
    return totalGain / hypotheses.length;
  }

  private calculateConfidenceDistribution(
    insights: InsightChain[]
  ): ContextChainOfThoughtReport['confidenceDistribution'] {
    const distribution = { veryHigh: 0, high: 0, medium: 0, low: 0, veryLow: 0 };

    insights.forEach(insight => {
      const conf = insight.overallConfidence;
      if (conf >= 80) distribution.veryHigh++;
      else if (conf >= 60) distribution.high++;
      else if (conf >= 40) distribution.medium++;
      else if (conf >= 20) distribution.low++;
      else distribution.veryLow++;
    });

    return distribution;
  }
}

// ─── Global Instance ──────────────────────────────────────────────────────────

let globalChainOfThought: ContextChainOfThoughtTracker | null = null;

export function createChainOfThoughtTracker(): ContextChainOfThoughtTracker {
  globalChainOfThought = new ContextChainOfThoughtTracker();
  return globalChainOfThought;
}

export function getChainOfThoughtTracker(): ContextChainOfThoughtTracker | null {
  return globalChainOfThought;
}

export function recordHypothesis(
  id: string,
  statement: string,
  category: 'desire' | 'objection' | 'audience' | 'competitor' | 'emotional',
  confidence?: number
): void {
  globalChainOfThought?.registerHypothesis(id, statement, category, confidence);
}

export function recordQuery(hypothesisId: string, query: string): void {
  globalChainOfThought?.recordQuery(hypothesisId, query);
}

export function recordEvidence(
  hypothesisId: string,
  sourceUrl: string,
  snippet: string,
  sourceType: 'reddit' | 'website' | 'academic' | 'social' | 'review' | 'forum',
  direction: 'supporting' | 'refuting' | 'neutral',
  relevance: number,
  weight: number
): void {
  globalChainOfThought?.addEvidence(hypothesisId, sourceUrl, snippet, sourceType, direction, relevance, weight);
}

export function getProvenanceReport(): ContextChainOfThoughtReport | undefined {
  return globalChainOfThought?.buildProvenanceReport();
}
