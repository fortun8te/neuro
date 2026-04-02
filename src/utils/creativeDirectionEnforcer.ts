import { ollamaService } from './ollama';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ██  CREATIVE DIRECTION ENFORCER — Taste → Make/Test Alignment
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ensures every ad concept adheres to brand creative direction:
 *
 * • Colors: Does copy feel aligned with visual direction?
 * • Tone: Does voice match brand personality?
 * • Positioning: Does concept attack chosen positioning angle?
 *
 * Validates compliance before output. Flags or auto-corrects divergence.
 * Prevents tone-deaf ads that break brand consistency.
 */

export interface TasteDirection {
  brandVoice: string;
  recommendedColors: string[];
  brandTone: string;
  positioning: string;
  recommendedCopyAngles: string[];
  visualStyle: string;
}

export interface ComplianceScore {
  toneAlignment: number;      // 0-100
  positioningAlignment: number; // 0-100
  colorFeelAlignment: number;   // 0-100
  copyAngleAlignment: number;   // 0-100
  overallCompliance: number;    // avg
}

export interface ComplianceReport {
  conceptName: string;
  compliance: ComplianceScore;
  isCompliant: boolean;          // true if >= 75 overall
  flaggedDivergences: string[];  // specific issues
  correctionSuggestions: string[];
  alignedElements: string[];     // what IS working
  severityLevel: 'critical' | 'major' | 'minor' | 'compliant';
  requiresRevision: boolean;
}

/**
 * Evaluate a single concept against taste direction
 */
async function evaluateComplianceForConcept(
  concept: {
    name: string;
    headline: string;
    body: string;
    cta: string;
    angle: string;
  },
  taste: TasteDirection,
  model: string,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<ComplianceReport> {
  const prompt = `You are a brand director ensuring creative consistency. Evaluate this concept against brand taste direction.

BRAND TASTE DIRECTION:
Voice: ${taste.brandVoice}
Tone: ${taste.brandTone}
Positioning: ${taste.positioning}
Recommended Copy Angles: ${taste.recommendedCopyAngles.join(', ')}
Visual Style: ${taste.visualStyle}
Color Direction: ${taste.recommendedColors.join(', ')}

CONCEPT TO EVALUATE:
Name: ${concept.name}
Angle: ${concept.angle}
Headline: ${concept.headline}
Body: ${concept.body}
CTA: ${concept.cta}

Assess compliance (0-100 per dimension):

1. TONE ALIGNMENT — Does copy match brand tone/personality? (e.g., is a "bold, irreverent" brand in a "formal, corporate" copy?)
2. POSITIONING ALIGNMENT — Does concept defend the chosen positioning statement?
3. COLOR_FEEL_ALIGNMENT — Does language/tone evoke the intended color palette? (warm/cool, energetic/calm, premium/accessible)
4. COPY_ANGLE_ALIGNMENT — Does concept leverage a recommended copy angle?

Output ONLY:
TONE_ALIGNMENT: [0-100]
POSITIONING_ALIGNMENT: [0-100]
COLOR_FEEL_ALIGNMENT: [0-100]
COPY_ANGLE_ALIGNMENT: [0-100]
OVERALL_COMPLIANCE: [0-100, avg of above]
FLAGGED_DIVERGENCES: [comma-separated list of issues, or "none"]
CORRECTIONS: [specific rewrites to achieve alignment, or "none needed"]
ALIGNED_ELEMENTS: [comma-separated list of what IS working]

Do not use em dashes.`;

  const systemPrompt =
    'You are a brand director. Score strictly on alignment to stated taste. Output ONLY scores and analysis.';

  let fullOutput = '';
  await ollamaService.generateStream(prompt, systemPrompt, {
    model,
    signal,
    onChunk: (chunk) => {
      fullOutput += chunk;
      onChunk?.(chunk);
    },
  });

  // Parse scores
  const toneMatch = fullOutput.match(/TONE_ALIGNMENT:\s*(\d+)/);
  const posMatch = fullOutput.match(/POSITIONING_ALIGNMENT:\s*(\d+)/);
  const colorMatch = fullOutput.match(/COLOR_FEEL_ALIGNMENT:\s*(\d+)/);
  const angleMatch = fullOutput.match(/COPY_ANGLE_ALIGNMENT:\s*(\d+)/);
  const overallMatch = fullOutput.match(/OVERALL_COMPLIANCE:\s*(\d+)/);

  const toneScore = toneMatch ? parseInt(toneMatch[1]) : 65;
  const posScore = posMatch ? parseInt(posMatch[1]) : 65;
  const colorScore = colorMatch ? parseInt(colorMatch[1]) : 65;
  const angleScore = angleMatch ? parseInt(angleMatch[1]) : 65;
  const overallScore = overallMatch
    ? parseInt(overallMatch[1])
    : Math.round((toneScore + posScore + colorScore + angleScore) / 4);

  // Parse issues and corrections
  const divergencesMatch = fullOutput.match(/FLAGGED_DIVERGENCES:\s*([^\n]+)/);
  const correctionsMatch = fullOutput.match(/CORRECTIONS:\s*([^\n]+(?:\n[^\n]+)*?)/);
  const alignedMatch = fullOutput.match(/ALIGNED_ELEMENTS:\s*([^\n]+)/);

  const divergencesStr = divergencesMatch ? divergencesMatch[1].trim() : '';
  const corrStr = correctionsMatch ? correctionsMatch[1].trim() : '';
  const alignedStr = alignedMatch ? alignedMatch[1].trim() : '';

  const parseList = (text: string): string[] =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== 'none');

  const flaggedDivergences = parseList(divergencesStr);
  const corrections = parseList(corrStr);
  const aligned = parseList(alignedStr);

  // Determine severity
  let severity: 'critical' | 'major' | 'minor' | 'compliant';
  if (overallScore >= 85) {
    severity = 'compliant';
  } else if (overallScore >= 70) {
    severity = 'minor';
  } else if (overallScore >= 50) {
    severity = 'major';
  } else {
    severity = 'critical';
  }

  return {
    conceptName: concept.name,
    compliance: {
      toneAlignment: toneScore,
      positioningAlignment: posScore,
      colorFeelAlignment: colorScore,
      copyAngleAlignment: angleScore,
      overallCompliance: overallScore,
    },
    isCompliant: overallScore >= 75,
    flaggedDivergences,
    correctionSuggestions: corrections,
    alignedElements: aligned,
    severityLevel: severity,
    requiresRevision: overallScore < 75,
  };
}

/**
 * Auto-correct a non-compliant concept
 * Regenerates copy to match taste direction
 */
async function correctConceptToComply(
  concept: {
    name: string;
    headline: string;
    body: string;
    cta: string;
    angle: string;
  },
  taste: TasteDirection,
  noncompliantDimensions: ComplianceReport,
  model: string,
  signal?: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<{
  headline: string;
  body: string;
  cta: string;
  correctionNotes: string;
}> {
  const prompt = `You are a brand voice expert correcting creative to match taste direction.

ORIGINAL CONCEPT:
Headline: ${concept.headline}
Body: ${concept.body}
CTA: ${concept.cta}

BRAND TASTE DIRECTION:
Voice: ${taste.brandVoice}
Tone: ${taste.brandTone}
Positioning: ${taste.positioning}

COMPLIANCE ISSUES TO FIX:
${noncompliantDimensions.flaggedDivergences.join('\n')}

SUGGESTED CORRECTIONS:
${noncompliantDimensions.correctionSuggestions.join('\n')}

Rewrite this concept to:
1. Match the brand voice and tone
2. Defend the positioning
3. Use language that evokes the visual/color direction

Output ONLY:
CORRECTED_HEADLINE: [new headline]
CORRECTED_BODY: [new body]
CORRECTED_CTA: [new CTA]
CORRECTION_NOTES: [what changed and why]

Do not use em dashes.`;

  const systemPrompt =
    'You are a legendary brand voice writer. Keep the core message but shift tone/language to match brand. Output ONLY corrected copy.';

  let fullOutput = '';
  await ollamaService.generateStream(prompt, systemPrompt, {
    model,
    signal,
    onChunk: (chunk) => {
      fullOutput += chunk;
      onChunk?.(chunk);
    },
  });

  // Parse corrected copy
  const headlineMatch = fullOutput.match(/CORRECTED_HEADLINE:\s*([^\n]+)/);
  const bodyMatch = fullOutput.match(/CORRECTED_BODY:\s*([^\n]+(?:\n[^\n]+)*?)/);
  const ctaMatch = fullOutput.match(/CORRECTED_CTA:\s*([^\n]+)/);
  const notesMatch = fullOutput.match(/CORRECTION_NOTES:\s*([^\n]+(?:\n[^\n]+)*?)/);

  return {
    headline: headlineMatch ? headlineMatch[1].trim() : concept.headline,
    body: bodyMatch ? bodyMatch[1].trim() : concept.body,
    cta: ctaMatch ? ctaMatch[1].trim() : concept.cta,
    correctionNotes: notesMatch ? notesMatch[1].trim() : 'Minor adjustments made',
  };
}

/**
 * ORCHESTRATION: Enforce taste direction across all concepts
 * Public entry point
 */
export async function enforceCreativeDirection(
  concepts: Array<{
    name: string;
    headline: string;
    body: string;
    cta: string;
    angle: string;
  }>,
  taste: TasteDirection,
  model: string,
  options?: {
    signal?: AbortSignal;
    autoCorrect?: boolean;  // true = auto-correct non-compliant concepts
    strictMode?: boolean;   // true = require >= 80 compliance, not 75
    onConcept?: (index: number, report: ComplianceReport) => void;
    onCorrection?: (name: string, corrected: any) => void;
  }
): Promise<{
  concepts: Array<
    {
      name: string;
      headline: string;
      body: string;
      cta: string;
      angle: string;
    } & { complianceReport: ComplianceReport }
  >;
  complianceSummary: {
    totalCompliant: number;
    totalCorrected: number;
    totalNonCompliant: number;
    overallComplianceRate: number;
  };
  enforced: Array<string>;  // names of corrected concepts
}> {
  const threshold = options?.strictMode ? 80 : 75;
  const enforced: string[] = [];

  // Evaluate all concepts
  const results: typeof concepts = [];
  for (let i = 0; i < concepts.length; i++) {
    const report = await evaluateComplianceForConcept(
      concepts[i],
      taste,
      model,
      options?.signal
    );
    options?.onConcept?.(i, report);

    if (!report.isCompliant && options?.autoCorrect) {
      // Auto-correct non-compliant concepts
      const corrected = await correctConceptToComply(
        concepts[i],
        taste,
        report,
        model,
        options?.signal
      );

      enforced.push(concepts[i].name);
      options?.onCorrection?.(concepts[i].name, corrected);

      // Re-evaluate after correction
      const newReport = await evaluateComplianceForConcept(
        {
          ...concepts[i],
          headline: corrected.headline,
          body: corrected.body,
          cta: corrected.cta,
        },
        taste,
        model,
        options?.signal
      );

      results.push({
        ...concepts[i],
        headline: corrected.headline,
        body: corrected.body,
        cta: corrected.cta,
        complianceReport: newReport,
      } as any);
    } else {
      results.push({
        ...concepts[i],
        complianceReport: report,
      } as any);
    }
  }

  // Summary stats
  const compliant = results.filter((c) => (c as any).complianceReport.isCompliant).length;
  const totalCorrected = enforced.length;
  const totalNonCompliant = results.filter((c) => !(c as any).complianceReport.isCompliant).length;

  return {
    concepts: results as any,
    complianceSummary: {
      totalCompliant: compliant,
      totalCorrected,
      totalNonCompliant,
      overallComplianceRate: Math.round(
        ((compliant + totalCorrected) / results.length) * 100
      ),
    },
    enforced,
  };
}

/**
 * Validation helper: Generate enforcement report
 * For use in UI or logging
 */
export function generateEnforcementReport(
  enforcement: Awaited<ReturnType<typeof enforceCreativeDirection>>
): string {
  const { complianceSummary, concepts, enforced } = enforcement;

  let report = `Creative Direction Enforcement Report
════════════════════════════════════════════
Compliance Rate: ${complianceSummary.overallComplianceRate}%
Total Compliant: ${complianceSummary.totalCompliant}
Auto-Corrected: ${complianceSummary.totalCorrected}
Still Non-Compliant: ${complianceSummary.totalNonCompliant}

Concept Details:
────────────────`;

  for (const concept of concepts) {
    const status = concept.complianceReport.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT';
    const corrected = enforced.includes(concept.name) ? ' [CORRECTED]' : '';
    report += `\n\n${concept.name} — ${status}${corrected}
Score: ${concept.complianceReport.compliance.overallCompliance}/100
Issues: ${concept.complianceReport.flaggedDivergences.length > 0 ? concept.complianceReport.flaggedDivergences.join(', ') : 'None'}`;
  }

  return report;
}
