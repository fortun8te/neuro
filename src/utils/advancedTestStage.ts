import { ollamaService } from './ollama';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ██  ADVANCED TEST STAGE — 12-Dimensional Production Quality Evaluation
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Expands evaluation from 6 → 12 dimensions:
 *
 * ORIGINAL 6:
 * 1. Objection Handling — does it address purchase objections?
 * 2. Proof Strength — is evidence compelling?
 * 3. CTA Clarity — is next action obvious?
 * 4. Brand Alignment — does it fit brand voice/positioning?
 * 5. Differentiation — owns competitive gap?
 * 6. Copy Strength — powerful language, rhythm, persuasion?
 *
 * NEW 6:
 * 7. Emotional Resonance — activates limbic response?
 * 8. Specificity — concrete details vs generic claims?
 * 9. Scarcity/Urgency — creates purchase friction?
 * 10. Social Proof Strength — credibility signals clear?
 * 11. Memorability — sticks in mind after scroll?
 * 12. Conversion Potential — likelihood to drive action?
 *
 * Output: Detailed scoring, specific improvement suggestions, quality tier assignment
 */

export interface DimensionScore {
  dimension: string;
  score: number;           // 0-100
  explanation: string;
  strengthBullets: string[];
  weaknessBullets: string[];
  improvementSuggestions: string[];
}

export interface ConceptEvaluation {
  conceptName: string;
  dimension1_objectionHandling: DimensionScore;
  dimension2_proofStrength: DimensionScore;
  dimension3_ctaClarity: DimensionScore;
  dimension4_brandAlignment: DimensionScore;
  dimension5_differentiation: DimensionScore;
  dimension6_copyStrength: DimensionScore;
  dimension7_emotionalResonance: DimensionScore;
  dimension8_specificity: DimensionScore;
  dimension9_scarcityUrgency: DimensionScore;
  dimension10_socialProofStrength: DimensionScore;
  dimension11_memorability: DimensionScore;
  dimension12_conversionPotential: DimensionScore;
  overallScore: number;
  verdict: 'elite' | 'production' | 'test' | 'revision' | 'skip';
  qualityTier: 'premium' | 'standard' | 'emerging' | 'needs_work';
  weakestDimension: DimensionScore;
  strongestDimension: DimensionScore;
  evaluationEvolution?: string;  // how did this concept improve through cycles?
  readinessForLaunch: number;     // 0-100
}

export interface AdvancedTestOutput {
  concepts: ConceptEvaluation[];
  winner: string;
  runnerUp?: string;
  summaryAnalysis: string;
  crossConceptInsights: string[];
  nextCycleStrategy: string;
  highImpactImprovements: string[];
}

/**
 * Comprehensive 12-dimensional evaluation of a single concept
 */
async function evaluateConceptOnAllDimensions(
  concept: {
    name: string;
    headline: string;
    body: string;
    cta: string;
    angle: string;
  },
  context: {
    brand: string;
    deepDesires: string;
    objections: string;
    proofPoints: string;
    brandVoice: string;
    competitorLandscape: string;
    audienceLanguage: string;
    marketSophistication: string;
  },
  model: string,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<ConceptEvaluation> {
  const prompt = `You are an elite ad evaluator trained on high-performing advertisements. Evaluate this concept on 12 dimensions of production quality.

BRAND: ${context.brand}
CONCEPT NAME: ${concept.name}
ANGLE: ${concept.angle}

CONCEPT TEXT:
Headline: ${concept.headline}
Body: ${concept.body}
CTA: ${concept.cta}

CONTEXT:
Brand Voice: ${context.brandVoice}
Deep Desires: ${context.deepDesires}
Key Objections: ${context.objections}
Proof Points: ${context.proofPoints}
Competitor Landscape: ${context.competitorLandscape}
Audience Language: ${context.audienceLanguage}
Market Sophistication: ${context.marketSophistication}

Evaluate on these 12 dimensions (0-100 each):

1. OBJECTION HANDLING — Does it proactively address purchase objections? (risk, cost, skepticism)
2. PROOF STRENGTH — How compelling is the evidence? (concrete, credible, specific)
3. CTA CLARITY — How obvious is the next action? (button text, benefit, urgency)
4. BRAND ALIGNMENT — Does tone/voice/positioning match brand? (consistency, authenticity)
5. DIFFERENTIATION — Does it own a gap competitors can't claim? (unique position, defensible)
6. COPY STRENGTH — Powerful language, rhythm, persuasion density? (word choice, flow, impact)
7. EMOTIONAL RESONANCE — Does it activate limbic/emotional response? (connection, desire, identity)
8. SPECIFICITY — Concrete details vs generic claims? (details, examples, data)
9. SCARCITY/URGENCY — Creates purchase friction/motivation? (FOMO, time-limit, exclusive)
10. SOCIAL PROOF STRENGTH — Credibility signals clear? (testimonials, metrics, authority)
11. MEMORABILITY — Sticks in mind after scroll? (unique, quotable, distinctive)
12. CONVERSION POTENTIAL — Likelihood to drive purchase action? (momentum, clear benefit, friction-free)

For EACH dimension, output:
DIMENSION [number]: [dimension name]
SCORE: [0-100]
EXPLANATION: [2-3 sentence analysis]
STRENGTHS: [2-3 bullets]
WEAKNESSES: [2-3 bullets]
IMPROVEMENTS: [2-3 specific fixes]

Then output:
OVERALL_SCORE: [avg of 12 dimensions]
VERDICT: [elite|production|test|revision|skip]
QUALITY_TIER: [premium|standard|emerging|needs_work]
READINESS_FOR_LAUNCH: [0-100]

Do not use em dashes.`;

  const systemPrompt = `You are a legendary ad evaluator. Score ruthlessly but fairly. Provide specific, actionable feedback. Every score must be justified. Output ONLY the evaluation structure.`;

  let fullOutput = '';
  await ollamaService.generateStream(prompt, systemPrompt, {
    model,
    signal,
    onChunk: (chunk) => {
      fullOutput += chunk;
      onChunk?.(chunk);
    },
  });

  // Parse all 12 dimension scores
  const dimensionRegex =
    /DIMENSION\s*(\d+):\s*([^\n]+)\s*SCORE:\s*(\d+)\s*EXPLANATION:\s*([^\n]+(?:\n[^\n]+)*?)\s*STRENGTHS:\s*((?:\n[^\n]+)*?)\s*WEAKNESSES:\s*((?:\n[^\n]+)*?)\s*IMPROVEMENTS:\s*((?:\n[^\n]+)*?)(?=DIMENSION|\OVERALL_|$)/gi;

  const dimensions: DimensionScore[] = [];
  let match;

  while ((match = dimensionRegex.exec(fullOutput)) !== null) {
    const dimNum = parseInt(match[1]);
    const dimName = match[2].trim();
    const score = parseInt(match[3]) || 50;
    const explanation = match[4].trim();

    const parseList = (text: string): string[] =>
      text
        .split('\n')
        .map((s) => s.replace(/^[-•*]\s*/, '').trim())
        .filter((s) => s.length > 0);

    const strengths = parseList(match[5]);
    const weaknesses = parseList(match[6]);
    const improvements = parseList(match[7]);

    dimensions.push({
      dimension: `${dimNum}. ${dimName}`,
      score: Math.min(100, Math.max(0, score)),
      explanation,
      strengthBullets: strengths.slice(0, 3),
      weaknessBullets: weaknesses.slice(0, 3),
      improvementSuggestions: improvements.slice(0, 3),
    });
  }

  // Parse overall verdict
  const overallMatch = fullOutput.match(/OVERALL_SCORE:\s*(\d+)/);
  const verdictMatch = fullOutput.match(
    /VERDICT:\s*(\w+)\s*(?:\n|$)/
  );
  const tierMatch = fullOutput.match(
    /QUALITY_TIER:\s*(\w+)/
  );
  const readinessMatch = fullOutput.match(
    /READINESS_FOR_LAUNCH:\s*(\d+)/
  );

  const overallScore = overallMatch ? parseInt(overallMatch[1]) : 65;
  const verdict = (verdictMatch ? verdictMatch[1].toLowerCase() : 'test') as
    | 'elite'
    | 'production'
    | 'test'
    | 'revision'
    | 'skip';
  const qualityTier = (tierMatch ? tierMatch[1].toLowerCase() : 'standard') as
    | 'premium'
    | 'standard'
    | 'emerging'
    | 'needs_work';
  const readiness = readinessMatch ? parseInt(readinessMatch[1]) : 65;

  // Ensure exactly 12 dimensions; fill gaps if needed
  while (dimensions.length < 12) {
    dimensions.push({
      dimension: `${dimensions.length + 1}. [Dimension]`,
      score: 65,
      explanation: 'Not evaluated',
      strengthBullets: [],
      weaknessBullets: [],
      improvementSuggestions: [],
    });
  }

  const sorted = [...dimensions].sort((a, b) => b.score - a.score);

  const evaluation: ConceptEvaluation = {
    conceptName: concept.name,
    dimension1_objectionHandling: dimensions[0] || createEmptyDimension(1),
    dimension2_proofStrength: dimensions[1] || createEmptyDimension(2),
    dimension3_ctaClarity: dimensions[2] || createEmptyDimension(3),
    dimension4_brandAlignment: dimensions[3] || createEmptyDimension(4),
    dimension5_differentiation: dimensions[4] || createEmptyDimension(5),
    dimension6_copyStrength: dimensions[5] || createEmptyDimension(6),
    dimension7_emotionalResonance: dimensions[6] || createEmptyDimension(7),
    dimension8_specificity: dimensions[7] || createEmptyDimension(8),
    dimension9_scarcityUrgency: dimensions[8] || createEmptyDimension(9),
    dimension10_socialProofStrength: dimensions[9] || createEmptyDimension(10),
    dimension11_memorability: dimensions[10] || createEmptyDimension(11),
    dimension12_conversionPotential: dimensions[11] || createEmptyDimension(12),
    overallScore,
    verdict,
    qualityTier,
    weakestDimension: sorted[sorted.length - 1],
    strongestDimension: sorted[0],
    readinessForLaunch: readiness,
  };

  return evaluation;
}

/**
 * Helper: Create empty dimension for missing parses
 */
function createEmptyDimension(num: number): DimensionScore {
  return {
    dimension: `${num}. [Dimension]`,
    score: 65,
    explanation: 'Auto-scored (parsing fallback)',
    strengthBullets: [],
    weaknessBullets: [],
    improvementSuggestions: [],
  };
}

/**
 * Comparative analysis across multiple concepts
 * Identifies patterns, gaps, strategic insights
 */
async function performCrossConceptAnalysis(
  evaluations: ConceptEvaluation[],
  context: { brand: string; marketPosition: string },
  model: string,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<{
  insights: string[];
  nextCycleStrategy: string;
  highImpactImprovements: string[];
}> {
  const conceptSummaries = evaluations
    .map(
      (e) =>
        `${e.conceptName}: Overall ${e.overallScore}/100, Strongest: ${e.strongestDimension.dimension} (${e.strongestDimension.score}), Weakest: ${e.weakestDimension.dimension} (${e.weakestDimension.score})`
    )
    .join('\n');

  const prompt = `You are a strategic ad director analyzing 3 concept evaluations.

BRAND: ${context.brand}
MARKET POSITION: ${context.marketPosition}

CONCEPT SCORES:
${conceptSummaries}

Identify:
1. Cross-concept patterns (what works, what's missing)
2. Dimension trends (which dimensions are collectively weak?)
3. Strategic gaps (positioning opportunity not yet claimed)
4. Next cycle improvement priorities (3 highest-impact changes)

Output:
INSIGHTS: [3-4 bullets on patterns/trends]
NEXT_CYCLE_STRATEGY: [specific direction for next iteration]
HIGH_IMPACT_IMPROVEMENTS: [3 specific, measurable improvements]

Do not use em dashes.`;

  const systemPrompt =
    'You are a strategic brand director. Identify patterns and opportunities. Output ONLY insights and strategy.';

  let fullOutput = '';
  await ollamaService.generateStream(prompt, systemPrompt, {
    model,
    signal,
    onChunk: (chunk) => {
      fullOutput += chunk;
      onChunk?.(chunk);
    },
  });

  // Parse insights
  const insightsMatch = fullOutput.match(/INSIGHTS:([\s\S]*?)(?=NEXT_CYCLE|$)/);
  const strategyMatch = fullOutput.match(/NEXT_CYCLE_STRATEGY:([\s\S]*?)(?=HIGH_IMPACT|$)/);
  const improvementsMatch = fullOutput.match(/HIGH_IMPACT_IMPROVEMENTS:([\s\S]*?)$/);

  const parseList = (text: string): string[] =>
    text
      .split('\n')
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter((s) => s.length > 0);

  const insights = insightsMatch ? parseList(insightsMatch[1]) : [];
  const strategy = strategyMatch ? strategyMatch[1].trim() : 'Continue testing current angles.';
  const improvements = improvementsMatch ? parseList(improvementsMatch[1]) : [];

  return {
    insights: insights.slice(0, 4),
    nextCycleStrategy: strategy,
    highImpactImprovements: improvements.slice(0, 3),
  };
}

/**
 * ORCHESTRATION: Full 12-dimensional evaluation pipeline
 * Public entry point for advanced Test stage
 */
export async function runAdvancedTestStage(
  concepts: Array<{
    name: string;
    headline: string;
    body: string;
    cta: string;
    angle: string;
  }>,
  context: {
    brand: string;
    deepDesires: string;
    objections: string;
    proofPoints: string;
    brandVoice: string;
    competitorLandscape: string;
    audienceLanguage: string;
    marketSophistication: string;
    marketPosition: string;
  },
  model: string,
  signal?: AbortSignal,
  onConcept?: (conceptIndex: number, evaluation: ConceptEvaluation) => void,
  onAnalysis?: (analysis: any) => void
): Promise<AdvancedTestOutput> {
  try {
    // Evaluate each concept on all 12 dimensions
    const evaluations: ConceptEvaluation[] = [];
    for (let i = 0; i < concepts.length; i++) {
      const conceptEval = await evaluateConceptOnAllDimensions(
        concepts[i],
        context,
        model,
        signal,
        () => {}
      );
      evaluations.push(conceptEval);
      onConcept?.(i, conceptEval);
    }

    // Perform cross-concept analysis
    const analysis = await performCrossConceptAnalysis(
      evaluations,
      { brand: context.brand, marketPosition: context.marketPosition },
      model,
      signal
    );
    onAnalysis?.(analysis);

    // Determine winner and runner-up
    const sorted = [...evaluations].sort((a, b) => b.overallScore - a.overallScore);
    const winner = sorted[0]?.conceptName || 'Unknown';
    const runnerUp = sorted[1]?.conceptName;

    // Generate summary
    const summaryAnalysis = `
Evaluation Summary (${evaluations.length} concepts):
- Winner: ${winner} (${sorted[0]?.overallScore}/100)
- Average Score: ${Math.round(evaluations.reduce((s, e) => s + e.overallScore, 0) / evaluations.length)}/100
- Quality Distribution: ${evaluations.filter((e) => e.verdict === 'elite').length} elite, ${evaluations.filter((e) => e.verdict === 'production').length} production, ${evaluations.filter((e) => e.verdict === 'test').length} test
    `.trim();

    return {
      concepts: evaluations,
      winner,
      runnerUp,
      summaryAnalysis,
      crossConceptInsights: analysis.insights,
      nextCycleStrategy: analysis.nextCycleStrategy,
      highImpactImprovements: analysis.highImpactImprovements,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error('Advanced Test Stage error:', err);
    throw err;
  }
}

/**
 * Comparison helper: Track how a concept improved across cycles
 * Used to measure quality lift from cycle N-1 to N
 */
export function compareConceptEvolution(
  currentEval: ConceptEvaluation,
  priorEval?: ConceptEvaluation
): string {
  if (!priorEval) return 'First evaluation of this concept.';

  const scoreDiff = currentEval.overallScore - priorEval.overallScore;
  const direction = scoreDiff > 0 ? 'improved' : scoreDiff < 0 ? 'declined' : 'remained unchanged';

  const prior12 = [
    priorEval.dimension1_objectionHandling.score,
    priorEval.dimension2_proofStrength.score,
    priorEval.dimension3_ctaClarity.score,
    priorEval.dimension4_brandAlignment.score,
    priorEval.dimension5_differentiation.score,
    priorEval.dimension6_copyStrength.score,
    priorEval.dimension7_emotionalResonance.score,
    priorEval.dimension8_specificity.score,
    priorEval.dimension9_scarcityUrgency.score,
    priorEval.dimension10_socialProofStrength.score,
    priorEval.dimension11_memorability.score,
    priorEval.dimension12_conversionPotential.score,
  ];

  const current12 = [
    currentEval.dimension1_objectionHandling.score,
    currentEval.dimension2_proofStrength.score,
    currentEval.dimension3_ctaClarity.score,
    currentEval.dimension4_brandAlignment.score,
    currentEval.dimension5_differentiation.score,
    currentEval.dimension6_copyStrength.score,
    currentEval.dimension7_emotionalResonance.score,
    currentEval.dimension8_specificity.score,
    currentEval.dimension9_scarcityUrgency.score,
    currentEval.dimension10_socialProofStrength.score,
    currentEval.dimension11_memorability.score,
    currentEval.dimension12_conversionPotential.score,
  ];

  const biggest = Math.max(
    ...current12.map((c, i) => Math.abs(c - prior12[i]))
  );
  const biggestIdx = current12.findIndex((c, i) => Math.abs(c - prior12[i]) === biggest);

  return `Concept ${direction} by ${Math.abs(scoreDiff)} points (${currentEval.overallScore}/100). Biggest shift: Dimension ${biggestIdx + 1} (${Math.abs(current12[biggestIdx] - prior12[biggestIdx])} points).`;
}
