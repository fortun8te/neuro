/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MAKE STAGE WITH CODE GENERATION — Production-Ready Artifacts
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Replaces text-only ad concepts with executable code artifacts.
 * Generates actual Python/TypeScript implementations matching ad strategy.
 *
 * Instead of:
 * "Ad Concept 1: A desire-driven headline about collagen..."
 *
 * We generate:
 * - Python visualization (matplotlib) of engagement metrics
 * - TypeScript React component showing the ad layout
 * - CSV export with segmentation data
 * - Full documentation with implementation notes
 *
 * Each artifact is self-validating and production-ready.
 */

import { ollamaService } from './ollama';
import {
  generateCodeArtifact,
  generateContextAwareArtifacts,
  type GenerationSpec,
  type GeneratedArtifact,
  CodeOptimizer,
} from './codeGenerationEngine';
import { createLogger } from './logger';

const log = createLogger('makeStageCodeGeneration');

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface MakeStageConfig {
  brand: string;
  campaign: string;
  desireContext: string;
  objectionContext: string;
  proofContext: string;
  copyBlocks: string;
  tone: string;
  model: string;
}

export interface ConceptArtifact {
  conceptNumber: 1 | 2 | 3;
  angle: 'desire' | 'objection' | 'proof';
  headline: string;
  body: string;
  cta: string;
  codeArtifacts: GeneratedArtifact[];
  readinessLevel: 'draft' | 'polish' | 'production';
  finalScore: number;
}

export interface MakeStageOutput {
  concepts: ConceptArtifact[];
  executiveSummary: string;
  createdAt: number;
  totalTokensUsed: number;
  validationReport: {
    allValid: boolean;
    issues: string[];
    warnings: string[];
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CORE GENERATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate 3 fully-featured ad concepts with production-ready code artifacts
 */
export async function generateMakeStageWithCodeGeneration(
  config: MakeStageConfig,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<MakeStageOutput> {
  const startTime = Date.now();
  const concepts: ConceptArtifact[] = [];
  const allValidationIssues: string[] = [];
  const allValidationWarnings: string[] = [];

  try {
    log.info('Starting Make Stage with Code Generation', {
      brand: config.brand,
      campaign: config.campaign,
    });

    // Stream: Generate 3 core concepts
    onChunk?.('phase|MAKE STAGE: Generating Production-Ready Ad Concepts with Code Artifacts\n');

    // Step 1: Generate concept copy
    onChunk?.('step|STEP 1: Generate Core Ad Concepts\n');
    const conceptPrompt = buildConceptPrompt(config);

    const conceptOutput = await streamGeneratedText(
      config.model,
      conceptPrompt,
      signal,
      (chunk: string) => onChunk?.(`generation|${chunk}`)
    );

    // Parse concepts from LLM output
    const parsedConcepts = parseConceptsFromLLM(conceptOutput);

    // Step 2: For each concept, generate supporting artifacts
    onChunk?.('step|STEP 2: Generate Code Artifacts for Each Concept\n');

    for (let i = 0; i < parsedConcepts.length; i++) {
      const concept = parsedConcepts[i];
      const conceptNum = (i + 1) as 1 | 2 | 3;

      onChunk?.(
        `orchestrator|Concept ${conceptNum} (${concept.angle}): Generating code artifacts for "${concept.headline}"\n`
      );

      // Generate artifacts for this concept
      const artifacts = await generateConceptArtifacts(
        conceptNum,
        concept,
        config,
        signal,
        (chunk: string) => onChunk?.(`generation|  ${chunk}`)
      );

      // Score the artifacts
      const finalScore = await scoreConceptArtifacts(
        concept,
        artifacts,
        config.model,
        signal,
        (chunk: string) => onChunk?.(`generation|  ${chunk}`)
      );

      // Collect validation issues
      for (const artifact of artifacts) {
        if (!artifact.validation.isValid) {
          allValidationIssues.push(`[Concept ${conceptNum}] ${artifact.code}: ${artifact.validation.errors.join(', ')}`);
        }
        allValidationWarnings.push(...artifact.validation.warnings);
      }

      concepts.push({
        conceptNumber: conceptNum,
        angle: concept.angle,
        headline: concept.headline,
        body: concept.body,
        cta: concept.cta,
        codeArtifacts: artifacts,
        readinessLevel: finalScore > 85 ? 'production' : finalScore > 70 ? 'polish' : 'draft',
        finalScore,
      });

      onChunk?.(
        `orchestrator|Concept ${conceptNum}: ${artifacts.length} artifacts generated | Score: ${finalScore.toFixed(1)}/100\n`
      );
    }

    // Step 3: Generate executive summary
    onChunk?.('step|STEP 3: Generate Executive Summary\n');
    const summaryPrompt = buildSummaryPrompt(concepts, config);
    const summary = await streamGeneratedText(
      config.model,
      summaryPrompt,
      signal,
      (chunk: string) => onChunk?.(`generation|${chunk}`)
    );

    onChunk?.('complete|Make Stage Complete\n');

    return {
      concepts,
      executiveSummary: summary,
      createdAt: Date.now(),
      totalTokensUsed: 0, // Would be tracked by ollamaService
      validationReport: {
        allValid: allValidationIssues.length === 0,
        issues: allValidationIssues,
        warnings: Array.from(new Set(allValidationWarnings)), // Deduplicate
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log.warn('Make stage aborted');
      throw error;
    }
    log.error('Make stage failed', {}, error);
    throw new Error(`Make stage failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ARTIFACT GENERATION FOR EACH CONCEPT
// ══════════════════════════════════════════════════════════════════════════════

async function generateConceptArtifacts(
  conceptNum: 1 | 2 | 3,
  concept: ParsedConcept,
  config: MakeStageConfig,
  signal: AbortSignal | undefined,
  onChunk?: (chunk: string) => void
): Promise<GeneratedArtifact[]> {
  const artifacts: GeneratedArtifact[] = [];

  // Artifact 1: Python visualization (matplotlib)
  const vizSpec: GenerationSpec = {
    language: 'python',
    artifactType: 'visualization',
    title: `EngagementMetrics_Concept${conceptNum}`,
    description: `Matplotlib visualization of predicted engagement metrics for concept ${conceptNum} (${concept.angle} angle). Shows CTR, conversion, ROAS projections.`,
    requirements: [
      'Import matplotlib.pyplot, numpy',
      'Define engagement projection data',
      'Create multi-panel visualization (CTR, Conversion, ROAS)',
      'Add annotations and legend',
      'Generate PNG export',
    ],
  };

  artifacts.push(await generateCodeArtifact(vizSpec));
  onChunk?.('Python visualization artifact generated\n');

  // Artifact 2: TypeScript React component (ad preview)
  const componentSpec: GenerationSpec = {
    language: 'typescript',
    artifactType: 'component',
    title: `AdPreview_Concept${conceptNum}`,
    description: `React component rendering the ad concept with proper styling. Shows headline, body, CTA button. Responsive design with Tailwind CSS.`,
    requirements: [
      'Import React, Tailwind CSS',
      'Define props: headline, body, cta, tone, angle',
      'Render ad layout with proper typography',
      'Add CTA button with hover states',
      'Support dark mode',
      'Include accessibility attributes',
    ],
    constraints: {
      requireTypes: true,
      requireErrors: true,
      requireComments: true,
    },
  };

  artifacts.push(await generateCodeArtifact(componentSpec));
  onChunk?.('React component artifact generated\n');

  // Artifact 3: CSV data export (segmentation insights)
  const csvSpec: GenerationSpec = {
    language: 'python',
    artifactType: 'csv-export',
    title: `SegmentationData_Concept${conceptNum}`,
    description: `Python script to generate CSV with audience segmentation insights. Includes demographics, psychographics, intent signals for ${concept.angle} angle.`,
    requirements: [
      'Import pandas',
      'Define segment data (age, income, interests, intent)',
      'Create DataFrame with 10+ segments',
      'Export to CSV with headers',
      'Include engagement probability column',
    ],
  };

  artifacts.push(await generateCodeArtifact(csvSpec));
  onChunk?.('CSV export artifact generated\n');

  // Artifact 4: SQL query (database integration)
  const sqlSpec: GenerationSpec = {
    language: 'sql',
    artifactType: 'query',
    title: `ConceptAnalytics_Concept${conceptNum}`,
    description: `SQL queries to extract and analyze performance metrics for this concept. Includes CTR, conversion, ROAS calculations.`,
    requirements: [
      'Define ads table schema',
      'Calculate CTR: clicks / impressions',
      'Calculate conversion rate: conversions / clicks',
      'Calculate ROAS: revenue / spend',
      'Filter by concept ID and date range',
      'Include GROUP BY date, segment',
    ],
  };

  artifacts.push(await generateCodeArtifact(sqlSpec));
  onChunk?.('SQL query artifact generated\n');

  // Artifact 5: Markdown documentation
  const docSpec: GenerationSpec = {
    language: 'markdown',
    artifactType: 'document',
    title: `ConceptGuide_Concept${conceptNum}`,
    description: `Complete implementation guide for concept ${conceptNum}. Explains strategy, creative rationale, audience targeting, success metrics.`,
    requirements: [
      'Headline and executive summary',
      'Creative angle explanation',
      'Audience persona description',
      'Success metrics and KPIs',
      'Implementation checklist',
      'A/B testing recommendations',
      'Expected performance ranges',
    ],
  };

  artifacts.push(await generateCodeArtifact(docSpec));
  onChunk?.('Markdown documentation artifact generated\n');

  return artifacts;
}

// ══════════════════════════════════════════════════════════════════════════════
// SCORING & QUALITY ASSURANCE
// ══════════════════════════════════════════════════════════════════════════════

async function scoreConceptArtifacts(
  concept: ParsedConcept,
  artifacts: GeneratedArtifact[],
  model: string,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<number> {
  // Calculate score based on:
  // 1. All artifacts validate successfully (40 points)
  // 2. Code quality (readability, complexity, comments) (30 points)
  // 3. Token efficiency (optimized code, no bloat) (20 points)
  // 4. Business alignment (headline clarity, CTA strength) (10 points)

  let score = 0;

  // Check validation (40 points)
  const validationScore = (artifacts.filter(a => a.validation.isValid).length / artifacts.length) * 40;
  score += validationScore;

  // Check code quality (30 points)
  let qualityScore = 0;
  for (const artifact of artifacts) {
    const readability = artifact.optimizations?.readabilityScore || 0;
    qualityScore += readability / 100;
  }
  score += (qualityScore / artifacts.length) * 30;

  // Check token efficiency (20 points)
  let efficiencyScore = 0;
  for (const artifact of artifacts) {
    const opt = artifact.optimizations;
    if (opt) {
      const savings = Math.min(opt.savings / 100, 1); // Normalize to 0-1
      efficiencyScore += savings;
    }
  }
  score += (efficiencyScore / artifacts.length) * 20;

  // Business alignment (10 points) — based on concept strength
  const businessBonus = (concept.body.length > 50 && concept.cta.length > 5) ? 10 : 5;
  score += businessBonus;

  return Math.round(score);
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

interface ParsedConcept {
  angle: 'desire' | 'objection' | 'proof';
  headline: string;
  body: string;
  cta: string;
}

function buildConceptPrompt(config: MakeStageConfig): string {
  return `You are a direct response copywriter and ad strategist.

BRAND: ${config.brand}
CAMPAIGN: ${config.campaign}
TONE: ${config.tone}

DEEP DESIRE CONTEXT:
${config.desireContext}

OBJECTION CONTEXT:
${config.objectionContext}

PROOF CONTEXT:
${config.proofContext}

AVAILABLE COPY BLOCKS:
${config.copyBlocks}

Generate exactly 3 ad concepts—one for each angle (desire, objection, proof).

For each concept, output:

CONCEPT: [desire | objection | proof]
HEADLINE: [compelling, benefit-driven, <12 words]
BODY: [emotional resonance, addresses angle, 50—100 words]
CTA: [clear action, urgency, 5—10 words]

Focus on originality, clarity, and conversion potential. Ensure each concept is distinct and addresses a different psychological lever.`;
}

function buildSummaryPrompt(concepts: ConceptArtifact[], config: MakeStageConfig): string {
  return `You are a creative director evaluating three ad concepts.

BRAND: ${config.brand}
CAMPAIGN: ${config.campaign}

CONCEPTS GENERATED:
${concepts
  .map(
    (c, i) =>
      `
Concept ${i + 1} (${c.angle}):
- Headline: ${c.headline}
- Body: ${c.body}
- CTA: ${c.cta}
- Artifacts Generated: ${c.codeArtifacts.length} (visualization, component, CSV, SQL, docs)
- Quality Score: ${c.finalScore}/100
`
  )
  .join('\n')}

Write a 150—200 word executive summary that:
1. Highlights the strongest concept and why
2. Notes complementary angles across the three
3. Suggests immediate next steps (testing, refinement, launch)
4. Identifies any risks or gaps

Keep language clear and actionable.`;
}

function parseConceptsFromLLM(output: string): ParsedConcept[] {
  const concepts: ParsedConcept[] = [];
  const conceptBlocks = output.split('CONCEPT:').slice(1);

  const angleMap: Record<string, 'desire' | 'objection' | 'proof'> = {
    desire: 'desire',
    objection: 'objection',
    proof: 'proof',
  };

  for (const block of conceptBlocks) {
    const angleMatch = block.match(/\[(desire|objection|proof)\]/i);
    const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?:\n|$)/);
    const bodyMatch = block.match(/BODY:\s*(.+?)(?:\n|$)/);
    const ctaMatch = block.match(/CTA:\s*(.+?)(?:\n|$)/);

    if (angleMatch && headlineMatch && bodyMatch && ctaMatch) {
      concepts.push({
        angle: angleMap[angleMatch[1].toLowerCase()] || 'desire',
        headline: headlineMatch[1].trim(),
        body: bodyMatch[1].trim(),
        cta: ctaMatch[1].trim(),
      });
    }
  }

  // Ensure we have exactly 3 concepts (pad with defaults if needed)
  while (concepts.length < 3) {
    concepts.push({
      angle: ['desire', 'objection', 'proof'][concepts.length] as 'desire' | 'objection' | 'proof',
      headline: `Concept ${concepts.length + 1}`,
      body: 'Body copy goes here',
      cta: 'Click here',
    });
  }

  return concepts.slice(0, 3);
}

async function streamGeneratedText(
  model: string,
  prompt: string,
  signal: AbortSignal | undefined,
  onChunk?: (chunk: string) => void
): Promise<string> {
  let fullText = '';

  await ollamaService.generateStream(
    prompt,
    '', // systemPrompt
    {
      model,
      onChunk: (chunk: string) => {
        fullText += chunk;
        onChunk?.(chunk);
      },
      signal,
    }
  );

  return fullText;
}

export default {
  generateMakeStageWithCodeGeneration,
};
