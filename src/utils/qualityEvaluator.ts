import type { StageName, StageData, ResearchFindings } from '../types';
import { ollamaService } from './ollama';
import { INFRASTRUCTURE } from '../config/infrastructure';

/**
 * Quality Evaluation System
 * - Evaluates stage outputs against quality rubrics
 * - Identifies failures and provides actionable feedback
 * - Severity levels: Critical (retry), Warning (flag), Pass
 */

export interface QualityMetric {
  name: string;
  score: number; // 0-100
  threshold: number; // minimum acceptable
  feedback: string;
}

export type SeverityLevel = 'critical' | 'warning' | 'pass';

export interface QualityEvaluation {
  stageName: StageName;
  severity: SeverityLevel;
  overallScore: number; // 0-100
  metrics: QualityMetric[];
  feedback: string;
  shouldRetry: boolean;
  suggestedFix: string;
  timestamp: number;
}

export interface QualityRubric {
  stageName: StageName;
  criteria: Array<{
    name: string;
    description: string;
    threshold: number; // 0-100, minimum acceptable
    weight: number; // 0-1, for weighted average
  }>;
  criticalThreshold: number; // score below this = critical
  warningThreshold: number; // score below this = warning
}

// Quality rubrics per stage
const QUALITY_RUBRICS: Record<StageName, QualityRubric> = {
  research: {
    stageName: 'research',
    criteria: [
      {
        name: 'Coverage Breadth',
        description: 'Research covers desires, objections, audience, competitors',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Source Quality',
        description: 'Sources are authoritative, recent, and relevant',
        threshold: 75,
        weight: 0.2,
      },
      {
        name: 'Relevance Depth',
        description: 'Findings directly address target audience and market',
        threshold: 75,
        weight: 0.25,
      },
      {
        name: 'Structure Clarity',
        description: 'Findings organized into actionable insights',
        threshold: 70,
        weight: 0.15,
      },
      {
        name: 'Data Recency',
        description: 'Research data is current (2024-2025)',
        threshold: 65,
        weight: 0.15,
      },
    ],
    criticalThreshold: 50,
    warningThreshold: 65,
  },

  'brand-dna': {
    stageName: 'brand-dna',
    criteria: [
      {
        name: 'Brand Clarity',
        description: 'Brand identity is distinct and defensible',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Customer Resonance',
        description: 'Brand promise connects with research findings',
        threshold: 75,
        weight: 0.25,
      },
      {
        name: 'Differentiation',
        description: 'Brand stands apart from competitors',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Messaging Coherence',
        description: 'All brand elements align and reinforce each other',
        threshold: 70,
        weight: 0.2,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },

  'persona-dna': {
    stageName: 'persona-dna',
    criteria: [
      {
        name: 'Persona Specificity',
        description: 'Personas are detailed and believable',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Research Grounding',
        description: 'Personas based on actual research findings',
        threshold: 75,
        weight: 0.25,
      },
      {
        name: 'Behavioral Insight',
        description: 'Personas reveal purchase triggers and decision factors',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Language Authenticity',
        description: 'Avatar language matches real audience voice',
        threshold: 70,
        weight: 0.2,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },

  angles: {
    stageName: 'angles',
    criteria: [
      {
        name: 'Idea Novelty',
        description: 'Angles are fresh and not generic',
        threshold: 70,
        weight: 0.3,
      },
      {
        name: 'Audience Resonance',
        description: 'Angles speak directly to discovered desires',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Differentiation',
        description: 'Angles are distinct from competitor positions',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Execution Feasibility',
        description: 'Angles are producible within constraints',
        threshold: 65,
        weight: 0.15,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },

  strategy: {
    stageName: 'strategy',
    criteria: [
      {
        name: 'Clarity & Specificity',
        description: 'Strategy is clear and specific to each angle',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Feasibility',
        description: 'Execution plan is realistic and achievable',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Competitive Advantage',
        description: 'Strategy highlights unique selling points',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Message Consistency',
        description: 'Strategy maintains brand voice and positioning',
        threshold: 70,
        weight: 0.2,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },

  copywriting: {
    stageName: 'copywriting',
    criteria: [
      {
        name: 'Persuasiveness',
        description: 'Copy addresses objections and drives action',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Relevance',
        description: 'Copy speaks directly to target persona',
        threshold: 75,
        weight: 0.25,
      },
      {
        name: 'Brand Voice',
        description: 'Copy matches brand tone and personality',
        threshold: 70,
        weight: 0.2,
      },
      {
        name: 'Clarity & Impact',
        description: 'Headlines and CTAs are clear and compelling',
        threshold: 75,
        weight: 0.25,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },

  production: {
    stageName: 'production',
    criteria: [
      {
        name: 'Visual Impact',
        description: 'Ads are visually compelling and on-brand',
        threshold: 70,
        weight: 0.3,
      },
      {
        name: 'Message Clarity',
        description: 'Core message is clear in 3 seconds',
        threshold: 75,
        weight: 0.25,
      },
      {
        name: 'Technical Quality',
        description: 'Ads are properly formatted and load correctly',
        threshold: 75,
        weight: 0.2,
      },
      {
        name: 'CTA Prominence',
        description: 'Call-to-action is visible and compelling',
        threshold: 70,
        weight: 0.25,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },

  test: {
    stageName: 'test',
    criteria: [
      {
        name: 'Ranking Consistency',
        description: 'Rankings are consistent and well-justified',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Rationale Quality',
        description: 'Evaluator explains why concepts rank as they do',
        threshold: 75,
        weight: 0.3,
      },
      {
        name: 'Winner Clarity',
        description: 'Top concept is clearly the strongest',
        threshold: 70,
        weight: 0.25,
      },
      {
        name: 'Feedback Actionability',
        description: 'Feedback provides clear improvement directions',
        threshold: 70,
        weight: 0.15,
      },
    ],
    criticalThreshold: 55,
    warningThreshold: 68,
  },
};

/**
 * Evaluate stage output against quality rubric
 * Returns structured evaluation with severity, metrics, and retry recommendations
 */
export async function evaluateStageQuality(
  stageName: StageName,
  stageData: StageData,
  previousContext?: string,
): Promise<QualityEvaluation> {
  const rubric = QUALITY_RUBRICS[stageName];
  if (!rubric) {
    return {
      stageName,
      severity: 'pass',
      overallScore: 100,
      metrics: [],
      feedback: 'No quality rubric defined for this stage',
      shouldRetry: false,
      suggestedFix: 'N/A',
      timestamp: Date.now(),
    };
  }

  const output = stageData.agentOutput || '';
  if (!output || output.trim().length < 50) {
    return {
      stageName,
      severity: 'critical',
      overallScore: 0,
      metrics: [
        {
          name: 'Output Presence',
          score: 0,
          threshold: 50,
          feedback: 'Stage output is empty or too short',
        },
      ],
      feedback: 'Critical: No meaningful output generated',
      shouldRetry: true,
      suggestedFix: 'Retry with increased temperature or different model',
      timestamp: Date.now(),
    };
  }

  try {
    // Use LLM to evaluate quality metrics
    const evaluation = await evaluateWithLLM(
      stageName,
      output,
      rubric,
      previousContext,
    );
    return evaluation;
  } catch (error) {
    console.error(`[qualityEvaluator] Evaluation failed for ${stageName}:`, error);
    // On evaluation failure, assume warning level (don't block with retries)
    return {
      stageName,
      severity: 'warning',
      overallScore: 60,
      metrics: [],
      feedback: 'Quality evaluation failed (evaluation system error)',
      shouldRetry: false,
      suggestedFix: 'Check evaluation service connectivity',
      timestamp: Date.now(),
    };
  }
}

/**
 * Use LLM to evaluate quality against rubric
 */
async function evaluateWithLLM(
  stageName: StageName,
  output: string,
  rubric: QualityRubric,
  previousContext?: string,
): Promise<QualityEvaluation> {
  const criteriaList = rubric.criteria
    .map(
      (c) => `
- "${c.name}": ${c.description}
  Threshold: ${c.threshold}/100, Weight: ${c.weight}
`,
    )
    .join('\n');

  const prompt = `You are a quality evaluator for marketing/creative outputs. Evaluate this ${stageName} stage output against the rubric below.

RUBRIC CRITERIA:
${criteriaList}

STAGE OUTPUT:
${output.slice(0, 2000)}${output.length > 2000 ? '\n[... truncated ...]' : ''}

${previousContext ? `\nPREVIOUS CONTEXT:\n${previousContext.slice(0, 500)}\n` : ''}

TASK: Score each criterion 0-100. Provide:
1. Individual metric scores
2. Weighted overall score
3. Brief feedback for each metric
4. Whether output should be retried (failed critical metrics)

Respond in JSON:
{
  "metrics": [
    {
      "name": "criterion name",
      "score": number (0-100),
      "feedback": "brief explanation"
    }
  ],
  "overallScore": number (0-100),
  "generalFeedback": "summary of strengths/weaknesses",
  "retryRecommended": boolean
}`;

  const system = `You are an expert evaluator of marketing content quality. You assess output strictly but fairly against defined rubrics. Always output valid JSON.`;

  try {
    const response = await ollamaService.generateStream(
      prompt,
      system,
      {
        model: 'qwen3.5:9b',
        temperature: 0.3, // Low temperature for consistent evaluation
        onChunk: () => {}, // no chunk callback
      },
    );

    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Build metrics array with thresholds
    const metrics: QualityMetric[] = (parsed.metrics || []).map(
      (m: any) => {
        const rubricCriterion = rubric.criteria.find((c) => c.name === m.name);
        return {
          name: m.name,
          score: Math.max(0, Math.min(100, m.score || 0)),
          threshold: rubricCriterion?.threshold || 70,
          feedback: m.feedback || '',
        };
      },
    );

    const overallScore = Math.max(0, Math.min(100, parsed.overallScore || 0));
    const failedCritical = metrics.some(
      (m) => m.score < rubric.criticalThreshold,
    );
    const failedWarning = metrics.some((m) => m.score < rubric.warningThreshold);

    const severity: SeverityLevel =
      overallScore < rubric.criticalThreshold
        ? 'critical'
        : overallScore < rubric.warningThreshold
          ? 'warning'
          : 'pass';

    const suggestedFix = generateRetryStrategy(stageName, severity, metrics);

    return {
      stageName,
      severity,
      overallScore,
      metrics,
      feedback: parsed.generalFeedback || 'Evaluation complete',
      shouldRetry: failedCritical || overallScore < rubric.criticalThreshold,
      suggestedFix,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[evaluateWithLLM] Parse error:', error);
    throw error;
  }
}

/**
 * Generate retry strategy based on failure analysis
 */
function generateRetryStrategy(
  stageName: StageName,
  severity: SeverityLevel,
  metrics: QualityMetric[],
): string {
  const failedMetrics = metrics
    .filter((m) => m.score < m.threshold)
    .map((m) => m.name)
    .slice(0, 2); // Top 2 failures

  const strategies: Record<string, string> = {
    'Coverage Breadth': 'Increase research iterations or preset depth',
    'Source Quality': 'Filter for higher-authority sources; retry research phase',
    'Relevance Depth': 'Inject more specific research findings; increase prompt context',
    'Persona Specificity': 'Request more detailed persona layers in prompt',
    'Idea Novelty': 'Change temperature to 1.2+; inject competitor positioning gaps',
    'Persuasiveness': 'Focus copy on objection-handling; add social proof injection',
    'Visual Impact': 'Use different template or visual direction; upgrade production model',
    'Ranking Consistency': 'Re-evaluate with explicit ranking criteria; use stronger model',
  };

  if (failedMetrics.length === 0) {
    return 'Output meets quality thresholds; no retry needed';
  }

  return (
    failedMetrics
      .map((m) => strategies[m] || `Improve ${m} in next attempt`)
      .join('; ') +
    '. Consider upgrading model tier or adjusting prompt temperature.'
  );
}

/**
 * Determine if retry is possible within constraints
 */
export interface RetryContext {
  currentRetryCount: number;
  maxRetries: number;
  currentTemperature: number;
  currentModel: string;
  availableModels: string[];
  timeoutMinutes: number;
  elapsedSeconds: number;
}

export function canRetry(context: RetryContext): {
  canRetry: boolean;
  reason?: string;
} {
  // Max 3 retries per stage
  if (context.currentRetryCount >= context.maxRetries) {
    return { canRetry: false, reason: 'Max retries exceeded' };
  }

  // Check time budget
  const timeRemaining = context.timeoutMinutes * 60 - context.elapsedSeconds;
  if (timeRemaining < 30) {
    return { canRetry: false, reason: 'Insufficient time remaining' };
  }

  // At least one alternative model available
  const alternativeModels = context.availableModels.filter(
    (m) => m !== context.currentModel,
  );
  if (alternativeModels.length === 0) {
    return { canRetry: false, reason: 'No alternative models available' };
  }

  return { canRetry: true };
}

/**
 * Generate retry configuration
 */
export interface RetryConfig {
  newModel: string;
  newTemperature: number;
  promptModification: string;
}

export function generateRetryConfig(
  evaluation: QualityEvaluation,
  context: RetryContext,
): RetryConfig {
  const failedMetrics = evaluation.metrics.filter(
    (m) => m.score < m.threshold,
  );
  const topFailure = failedMetrics[0];

  // Determine temperature adjustment
  let newTemperature = context.currentTemperature;
  if (context.currentTemperature < 0.5) {
    // Was too deterministic, increase creativity
    newTemperature = 0.8;
  } else if (context.currentTemperature > 1.0) {
    // Was too random, reduce
    newTemperature = 0.6;
  } else {
    // Default to toggle
    newTemperature = context.currentTemperature > 0.7 ? 0.5 : 0.9;
  }

  // Select alternative model (prefer stronger tier)
  const alternativeModels = context.availableModels.filter(
    (m) => m !== context.currentModel,
  );
  const newModel =
    alternativeModels.find((m) => m.includes('9b') || m.includes('27b')) ||
    alternativeModels[0];

  // Generate prompt modification based on failure
  let promptModification = '';
  if (topFailure) {
    promptModification = `\n\nFOCUS: The previous attempt scored low on "${topFailure.name}".
Specifically address: ${topFailure.feedback}.
Provide additional detail and specificity in this area.`;
  }

  return {
    newModel,
    newTemperature,
    promptModification,
  };
}
