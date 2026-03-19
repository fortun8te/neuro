/**
 * EXAMPLE: Integration of Ad Council into Test Stage
 *
 * This shows how to integrate the Council persona system into the Test stage hook.
 * Copy patterns from this example into your actual useTestStage hook.
 */

import { useCallback } from "react";
import {
  runCouncilEvaluation,
  CreativeForEvaluation,
  CouncilReport,
} from "@/utils/councilEvaluator";
import { ollamaService } from "@/utils/ollamaService";

/**
 * STEP 1: Parse Make stage output into structured concepts
 */
interface AdConcept {
  id: string;
  title: string;
  desire: string; // Which customer desire does this address?
  headline: string;
  bodyText: string;
  cta: string;
  offer?: string;
  positioning?: string;
  councilReport?: CouncilReport;
  consensusScore?: number;
  ranking?: number;
}

function parseConceptsFromMake(makeOutput: string): AdConcept[] {
  // This is example parsing—adapt to your actual Make stage output format
  // Assuming Make stage outputs 3 concepts in a structured format

  const concepts: AdConcept[] = [];

  // Parse makeOutput string into 3 concepts
  // This depends on your Make stage output format
  // For now, showing the structure you'd extract

  return concepts;
}

/**
 * STEP 2: Convert AdConcept to CreativeForEvaluation for council
 */
function conceptToCreative(
  concept: AdConcept,
  campaignContext: {
    brandName: string;
    category: string;
    targetAudience: string;
  }
): CreativeForEvaluation {
  return {
    headline: concept.headline,
    bodyText: concept.bodyText,
    cta: concept.cta,
    offer: concept.offer,
    productName: campaignContext.brandName,
    productCategory: campaignContext.category,
    targetAudience: campaignContext.targetAudience,
  };
}

/**
 * STEP 3: Run council evaluation on each concept
 */
async function evaluateConceptWithCouncil(
  concept: AdConcept,
  campaignContext: {
    brandName: string;
    category: string;
    targetAudience: string;
  },
  options: {
    model?: string;
    onProgress?: (message: string) => void;
    abortSignal?: AbortSignal;
  }
): Promise<AdConcept> {
  const creative = conceptToCreative(concept, campaignContext);

  options.onProgress?.(
    `🎭 Sending "${concept.title}" to Ad Council for evaluation...\n`
  );

  try {
    const councilReport = await runCouncilEvaluation(creative, {
      model: options.model || "glm-4.7-flash:q4_K_M",
      parallel: false, // Sequential to be gentler on resources
      personaIds: undefined, // Use all 8 personas
      onPersonaComplete: (persona, evaluation) => {
        options.onProgress?.(
          `${persona.name}: ${evaluation.score}/10\n`
        );
      },
      abortSignal: options.abortSignal,
    });

    // Attach council report and consensus score to concept
    concept.councilReport = councilReport;
    concept.consensusScore = councilReport.consensus.averageScore;

    return concept;
  } catch (error) {
    if (options.abortSignal?.aborted) {
      throw new Error("Council evaluation aborted");
    }
    throw error;
  }
}

/**
 * STEP 4: Rank concepts by consensus score
 */
function rankConceptsByCouncil(concepts: AdConcept[]): AdConcept[] {
  const sorted = [...concepts].sort((a, b) => {
    const scoreA = a.consensusScore || 0;
    const scoreB = b.consensusScore || 0;
    return scoreB - scoreA; // Higher score first
  });

  // Add ranking
  return sorted.map((concept, index) => ({
    ...concept,
    ranking: index + 1,
  }));
}

/**
 * STEP 5: Build Test stage output (streaming format)
 */
function buildTestStageOutput(rankedConcepts: AdConcept[]): string {
  let output = "TEST STAGE: COUNCIL EVALUATION COMPLETE\n";
  output += "═══════════════════════════════════════\n\n";

  for (const concept of rankedConcepts) {
    const report = concept.councilReport;
    if (!report) continue;

    const isWinner = concept.ranking === 1 ? "🏆 WINNER" : "";
    output += `${concept.ranking}. ${concept.title} — ${concept.consensusScore}/10 ${isWinner}\n`;
    output += `   Desire: ${concept.desire}\n`;

    // Show individual persona scores
    output += "   Persona Feedback:\n";
    for (const evaluation of report.evaluations) {
      output += `     • ${evaluation.personaName}: ${evaluation.score}/10\n`;
    }

    output += "\n";
  }

  // Show consensus insights for winner
  const winner = rankedConcepts[0];
  if (winner.councilReport) {
    const report = winner.councilReport;

    output += "WINNING CONCEPT: COUNCIL CONSENSUS\n";
    output += "═══════════════════════════════════════\n";

    output += "\n✅ TOP STRENGTHS:\n";
    for (const strength of report.consensus.topStrengths) {
      output += `   • ${strength}\n`;
    }

    output += "\n⚠️  TOP GAPS:\n";
    for (const gap of report.consensus.topGaps) {
      output += `   • ${gap}\n`;
    }

    output += "\n📋 PRIORITY RECOMMENDATIONS:\n";
    for (const rec of report.recommendations.priority) {
      output += `   • ${rec}\n`;
    }

    output += "\n⚡ QUICK WINS:\n";
    for (const win of report.recommendations.quickWins) {
      output += `   • ${win}\n`;
    }
  }

  output += "\n═══════════════════════════════════════\n";
  return output;
}

/**
 * MAIN: useTestStage Hook Integration Example
 *
 * This is the entry point. Call this from your Test stage orchestration.
 */
export function useTestStageWithCouncil() {
  const runTest = useCallback(
    async (
      makeOutput: string,
      campaignContext: {
        brandName: string;
        category: string;
        targetAudience: string;
      },
      options: {
        model?: string;
        onChunk?: (chunk: string) => void;
        abortSignal?: AbortSignal;
      }
    ): Promise<{
      output: string;
      rankedConcepts: AdConcept[];
      winner: AdConcept;
    }> => {
      const onProgress = (message: string) => {
        options.onChunk?.(message);
      };

      // STEP 1: Parse Make stage output
      onProgress("📊 Parsing ad concepts from Make stage...\n");
      const concepts = parseConceptsFromMake(makeOutput);

      if (concepts.length === 0) {
        throw new Error("No concepts found in Make stage output");
      }

      onProgress(`Found ${concepts.length} concepts to evaluate.\n\n`);

      // STEP 2: Evaluate each concept with the Ad Council
      const evaluatedConcepts: AdConcept[] = [];

      for (const concept of concepts) {
        try {
          const evaluated = await evaluateConceptWithCouncil(
            concept,
            campaignContext,
            {
              model: options.model,
              onProgress,
              abortSignal: options.abortSignal,
            }
          );
          evaluatedConcepts.push(evaluated);
          onProgress(`\n✓ ${concept.title} evaluated\n\n`);
        } catch (error) {
          if (options.abortSignal?.aborted) {
            throw error;
          }
          onProgress(`✗ Error evaluating ${concept.title}: ${error}\n\n`);
        }
      }

      // STEP 3: Rank concepts
      onProgress("🏆 Ranking concepts by council consensus...\n");
      const rankedConcepts = rankConceptsByCouncil(evaluatedConcepts);

      // STEP 4: Build output
      const output = buildTestStageOutput(rankedConcepts);
      onProgress(output);

      return {
        output,
        rankedConcepts,
        winner: rankedConcepts[0],
      };
    },
    []
  );

  return { runTest };
}

/**
 * USAGE EXAMPLE in useCycleLoop:
 *
 * const { runTest } = useTestStageWithCouncil();
 *
 * // ... after Make stage completes
 *
 * const testResult = await runTest(
 *   makeOutput,
 *   {
 *     brandName: campaign.brand.name,
 *     category: campaign.category,
 *     targetAudience: campaign.targetAudience,
 *   },
 *   {
 *     model: "glm-4.7-flash:q4_K_M",
 *     onChunk: (chunk) => {
 *       // Stream output to UI
 *       setCycleOutput(prev => prev + chunk);
 *     },
 *     abortSignal: stageAbortController.signal,
 *   }
 * );
 *
 * // Store winner and full ranked results
 * setCycleData(prev => ({
 *   ...prev,
 *   testStage: {
 *     output: testResult.output,
 *     rankedConcepts: testResult.rankedConcepts,
 *     winner: testResult.winner,
 *     timestamp: new Date().toISOString(),
 *   },
 * }));
 */

/**
 * OPTIONAL: Function to re-evaluate a specific concept
 * (if user wants to iterate on a specific concept mid-cycle)
 */
export async function reevaluateConceptWithCouncil(
  concept: AdConcept,
  campaignContext: {
    brandName: string;
    category: string;
    targetAudience: string;
  },
  options?: {
    model?: string;
    onProgress?: (message: string) => void;
    abortSignal?: AbortSignal;
  }
): Promise<AdConcept> {
  return evaluateConceptWithCouncil(concept, campaignContext, {
    model: options?.model || "glm-4.7-flash:q4_K_M",
    onProgress: options?.onProgress || (() => {}),
    abortSignal: options?.abortSignal,
  });
}

/**
 * OPTIONAL: Function to compare all concepts side-by-side by criteria
 */
export function compareConceptsAcrossPersonas(
  concepts: AdConcept[]
): {
  personaName: string;
  scores: Record<string, number>; // concept.title -> score
}[] {
  const comparison: Record<
    string,
    { personaName: string; scores: Record<string, number> }
  > = {};

  for (const concept of concepts) {
    if (!concept.councilReport) continue;

    for (const evaluation of concept.councilReport.evaluations) {
      if (!comparison[evaluation.personaName]) {
        comparison[evaluation.personaName] = {
          personaName: evaluation.personaName,
          scores: {},
        };
      }
      comparison[evaluation.personaName].scores[concept.title] =
        evaluation.score;
    }
  }

  return Object.values(comparison);
}

/**
 * OPTIONAL: Export concept + council report as JSON for storage/analysis
 */
export function exportConceptForArchive(concept: AdConcept): string {
  return JSON.stringify(
    {
      id: concept.id,
      title: concept.title,
      desire: concept.desire,
      headline: concept.headline,
      bodyText: concept.bodyText,
      cta: concept.cta,
      offer: concept.offer,
      consensusScore: concept.consensusScore,
      ranking: concept.ranking,
      councilReport: concept.councilReport,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}
