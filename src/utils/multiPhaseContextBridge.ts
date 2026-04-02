/**
 * Multi-Phase Context Bridge — Explicit Handoffs with Verification
 *
 * At each stage transition, verify that critical context has been captured:
 * - Phase 1→2: Verify desires/objections/audiences are complete before research
 * - Phase 2→3: Verify research findings are comprehensive before objection handling
 * - Phase 3→4: Verify objections have proof before taste direction
 * - Phase 4→5: Verify taste direction is coherent before concepts
 * - Phase 5→6: Verify concepts match research before production
 * - Phase 6→7: Verify test results are valid before memory archival
 *
 * If gaps detected: Gracefully trigger re-research or re-analysis
 * Quality score for each transition (0-100, 80+ is safe to proceed)
 *
 * Example:
 *   Phase 1→2 Handoff:
 *   - Verify: ≥3 deep desires captured
 *   - Verify: ≥5 objections identified
 *   - Verify: ≥2 audience segments
 *   - Quality score: 87/100 → Safe to proceed
 *
 * If Quality < 80:
 *   - Flag missing contexts
 *   - Recommend re-research queries
 *   - Allow graceful recovery (no abrupt failure)
 */

import type {
  ResearchFindings,
  DeepDesire,
  Objection,
  AvatarPersona,
  CouncilVerdict,
  StyleDNA,
} from '../types';

// ─── Phase Transition Types ───────────────────────────────────────────────────

export type PhaseName = 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'phase5' | 'phase6' | 'phase7';

export interface ContextGap {
  category: string;
  description: string;
  severity: 'critical' | 'warning' | 'minor';
  suggestedAction: string;
  requiredQueries?: string[];  // Queries to fill this gap
}

export interface PhaseTransitionCheck {
  fromPhase: PhaseName;
  toPhase: PhaseName;
  timestamp: number;
  checkedItems: ContextCheckItem[];
  gaps: ContextGap[];
  qualityScore: number;  // 0-100
  canProceed: boolean;   // true if >= 80
  recommendations: string[];
}

export interface ContextCheckItem {
  name: string;
  required: boolean;
  present: boolean;
  value?: string | number;
  confidence?: number;
}

export interface PhaseTransitionReport {
  transitions: PhaseTransitionCheck[];
  overallQuality: number;
  blockingIssues: string[];
  recoveryPlan: string[];
}

// ─── Verification Checklists (per phase) ──────────────────────────────────────

const PHASE_CHECKLISTS = {
  // Phase 1 Output → Phase 2 Input
  phase1_phase2: {
    requiredDesires: 3,
    requiredObjections: 5,
    requiredAudienceSegments: 2,
    checks: [
      { name: 'Deep desires mapped', required: true },
      { name: 'Objections identified', required: true },
      { name: 'Audience language captured', required: true },
      { name: 'Competitor landscape sketched', required: false },
      { name: 'Root cause mechanisms identified', required: false },
    ],
  },

  // Phase 2 Output → Phase 3 Input
  phase2_phase3: {
    minSourceCount: 50,
    minCoverage: 0.7,  // 70% dimensional coverage
    checks: [
      { name: 'Web research completed', required: true },
      { name: 'Desires validated by research', required: true },
      { name: 'Purchase journey mapped', required: false },
      { name: 'Emotional landscape identified', required: false },
      { name: 'Visual patterns analyzed', required: false },
      { name: 'Audit trail complete', required: true },
    ],
  },

  // Phase 3 Output → Phase 4 Input
  phase3_phase4: {
    checks: [
      { name: 'Objections have proof points', required: true },
      { name: 'Messaging angles identified', required: true },
      { name: 'Proof hierarchy established', required: false },
      { name: 'Social proof collected', required: false },
    ],
  },

  // Phase 4 Output → Phase 5 Input
  phase4_phase5: {
    checks: [
      { name: 'Creative direction established', required: true },
      { name: 'Brand voice defined', required: true },
      { name: 'Visual direction sketched', required: false },
      { name: 'Tone/personality locked', required: true },
      { name: 'Avoid list created', required: false },
    ],
  },

  // Phase 5 Output → Phase 6 Input
  phase5_phase6: {
    minConcepts: 3,
    checks: [
      { name: 'Ad concepts created', required: true },
      { name: 'Concepts match research findings', required: true },
      { name: 'Concepts address objections', required: true },
      { name: 'Creative angles tested', required: false },
    ],
  },

  // Phase 6 Output → Phase 7 Input
  phase6_phase7: {
    checks: [
      { name: 'Test results valid', required: true },
      { name: 'Winner selected', required: true },
      { name: 'Performance metrics captured', required: false },
    ],
  },
};

// ─── Context Bridge Validator ────────────────────────────────────────────────

export class ContextBridgeValidator {
  /**
   * Validate Phase 1 → Phase 2 transition
   */
  static validatePhase1ToPhase2(findings: ResearchFindings): PhaseTransitionCheck {
    const checks: ContextCheckItem[] = [];
    const gaps: ContextGap[] = [];

    // Check desires
    const desireCount = findings.deepDesires?.length || 0;
    checks.push({
      name: 'Deep desires mapped',
      required: true,
      present: desireCount >= PHASE_CHECKLISTS.phase1_phase2.requiredDesires,
      value: desireCount,
      confidence: this.calculateDesireCompleteness(findings.deepDesires),
    });

    if (desireCount < PHASE_CHECKLISTS.phase1_phase2.requiredDesires) {
      gaps.push({
        category: 'desires',
        description: `Only ${desireCount} desires identified, need ${PHASE_CHECKLISTS.phase1_phase2.requiredDesires}`,
        severity: 'critical',
        suggestedAction: 'Re-run desire analysis with deeper questioning',
        requiredQueries: [
          'customer deepest needs and desires',
          'why do customers really buy this',
          'emotional drivers behind purchase',
        ],
      });
    }

    // Check objections
    const objectionCount = findings.objections?.length || 0;
    checks.push({
      name: 'Objections identified',
      required: true,
      present: objectionCount >= PHASE_CHECKLISTS.phase1_phase2.requiredObjections,
      value: objectionCount,
      confidence: 80,
    });

    if (objectionCount < PHASE_CHECKLISTS.phase1_phase2.requiredObjections) {
      gaps.push({
        category: 'objections',
        description: `Only ${objectionCount} objections found, need ${PHASE_CHECKLISTS.phase1_phase2.requiredObjections}`,
        severity: 'critical',
        suggestedAction: 'Dig deeper into purchase blockers and concerns',
        requiredQueries: [
          'why do customers NOT buy this product',
          'common complaints about similar products',
          'purchase hesitations and concerns',
        ],
      });
    }

    // Check audience
    const languageCount = findings.avatarLanguage?.length || 0;
    checks.push({
      name: 'Audience language captured',
      required: true,
      present: languageCount > 0,
      value: languageCount,
      confidence: 75,
    });

    if (languageCount === 0) {
      gaps.push({
        category: 'audience',
        description: 'No customer language patterns captured',
        severity: 'warning',
        suggestedAction: 'Extract verbatim language from customer reviews and forums',
        requiredQueries: [
          'customer reviews and testimonials',
          'forum discussions about this problem',
          'how customers describe their pain',
        ],
      });
    }

    // Calculate quality score
    const presentCount = checks.filter(c => c.present).length;
    const qualityScore = (presentCount / checks.length) * 100;
    const hasCriticalGaps = gaps.filter(g => g.severity === 'critical').length === 0;

    return {
      fromPhase: 'phase1',
      toPhase: 'phase2',
      timestamp: Date.now(),
      checkedItems: checks,
      gaps,
      qualityScore,
      canProceed: (qualityScore >= 80) && hasCriticalGaps,
      recommendations: gaps.map(g => g.suggestedAction),
    };
  }

  /**
   * Validate Phase 2 → Phase 3 transition
   */
  static validatePhase2ToPhase3(findings: ResearchFindings, auditTrail?: unknown): PhaseTransitionCheck {
    const checks: ContextCheckItem[] = [];
    const gaps: ContextGap[] = [];

    // Check source count
    const sourceCount = (findings.auditTrail?.totalSources as number) || 0;
    checks.push({
      name: 'Sufficient sources gathered',
      required: true,
      present: sourceCount >= PHASE_CHECKLISTS.phase2_phase3.minSourceCount,
      value: sourceCount,
      confidence: 85,
    });

    if (sourceCount < PHASE_CHECKLISTS.phase2_phase3.minSourceCount) {
      gaps.push({
        category: 'research_depth',
        description: `Only ${sourceCount} sources, recommend ${PHASE_CHECKLISTS.phase2_phase3.minSourceCount}+`,
        severity: 'warning',
        suggestedAction: 'Continue research to achieve broader coverage',
        requiredQueries: [
          'market trends and industry reports',
          'competitor product reviews',
          'consumer psychology research',
        ],
      });
    }

    // Check research completion
    checks.push({
      name: 'Web research completed',
      required: true,
      present: sourceCount > 20,
      value: sourceCount,
      confidence: 85,
    });

    // Check desire validation
    const desiresValidated = (findings.deepDesires?.length || 0) > 0;
    checks.push({
      name: 'Desires validated by research',
      required: true,
      present: desiresValidated,
      confidence: 80,
    });

    // Optional: Check visual analysis
    const hasVisuals = (findings.visualFindings?.competitorVisuals?.length || 0) > 0;
    checks.push({
      name: 'Visual patterns analyzed',
      required: false,
      present: hasVisuals,
      value: findings.visualFindings?.competitorVisuals?.length || 0,
      confidence: 75,
    });

    // Optional: Check emotional landscape
    const hasEmotional = !!findings.emotionalLandscape;
    checks.push({
      name: 'Emotional landscape identified',
      required: false,
      present: hasEmotional,
      confidence: 70,
    });

    const presentCount = checks.filter(c => c.present).length;
    const qualityScore = (presentCount / checks.length) * 100;

    return {
      fromPhase: 'phase2',
      toPhase: 'phase3',
      timestamp: Date.now(),
      checkedItems: checks,
      gaps,
      qualityScore,
      canProceed: qualityScore >= 75,
      recommendations: gaps.map(g => g.suggestedAction),
    };
  }

  /**
   * Validate Phase 3 → Phase 4 transition
   */
  static validatePhase3ToPhase4(objections: Objection[] | undefined): PhaseTransitionCheck {
    const checks: ContextCheckItem[] = [];
    const gaps: ContextGap[] = [];

    const hasObjections = (objections?.length || 0) > 0;
    checks.push({
      name: 'Objections identified',
      required: true,
      present: hasObjections,
      value: objections?.length || 0,
      confidence: 85,
    });

    // Check if objections have proof points
    let withProof = 0;
    objections?.forEach(obj => {
      if (obj.requiredProof && obj.requiredProof.length > 0) withProof++;
    });

    checks.push({
      name: 'Objections have proof points',
      required: true,
      present: withProof > 0,
      value: withProof,
      confidence: 80,
    });

    if (withProof === 0) {
      gaps.push({
        category: 'proof_strategy',
        description: 'No proof strategies identified for objections',
        severity: 'critical',
        suggestedAction: 'Define proof points and evidence for each objection',
      });
    }

    const presentCount = checks.filter(c => c.present).length;
    const qualityScore = (presentCount / checks.length) * 100;

    return {
      fromPhase: 'phase3',
      toPhase: 'phase4',
      timestamp: Date.now(),
      checkedItems: checks,
      gaps,
      qualityScore,
      canProceed: qualityScore >= 80 && gaps.length === 0,
      recommendations: gaps.map(g => g.suggestedAction),
    };
  }

  /**
   * Validate Phase 4 → Phase 5 transition
   */
  static validatePhase4ToPhase5(verdict?: CouncilVerdict): PhaseTransitionCheck {
    const checks: ContextCheckItem[] = [];
    const gaps: ContextGap[] = [];

    const hasVerdict = !!verdict;
    checks.push({
      name: 'Creative direction established',
      required: true,
      present: hasVerdict && !!verdict?.strategicDirection,
      confidence: 85,
    });

    if (!hasVerdict) {
      gaps.push({
        category: 'creative_direction',
        description: 'Council verdict not generated',
        severity: 'critical',
        suggestedAction: 'Run council of marketing brains analysis',
      });
    }

    checks.push({
      name: 'Tone/personality locked',
      required: true,
      present: hasVerdict && !!verdict?.audienceLanguage,
      confidence: 80,
    });

    checks.push({
      name: 'Avoid list created',
      required: false,
      present: hasVerdict && !!verdict?.avoidList,
      confidence: 75,
    });

    const presentCount = checks.filter(c => c.present).length;
    const qualityScore = (presentCount / checks.length) * 100;

    return {
      fromPhase: 'phase4',
      toPhase: 'phase5',
      timestamp: Date.now(),
      checkedItems: checks,
      gaps,
      qualityScore,
      canProceed: qualityScore >= 80,
      recommendations: gaps.map(g => g.suggestedAction),
    };
  }

  /**
   * Validate Phase 5 → Phase 6 transition
   */
  static validatePhase5ToPhase6(conceptCount: number, findingsContext: unknown): PhaseTransitionCheck {
    const checks: ContextCheckItem[] = [];
    const gaps: ContextGap[] = [];
    const findings = findingsContext as unknown as ResearchFindings;

    const minConcepts = PHASE_CHECKLISTS.phase5_phase6.minConcepts;
    checks.push({
      name: 'Ad concepts created',
      required: true,
      present: conceptCount >= minConcepts,
      value: conceptCount,
      confidence: 85,
    });

    if (conceptCount < minConcepts) {
      gaps.push({
        category: 'concepts',
        description: `Only ${conceptCount} concepts, need ${minConcepts}`,
        severity: 'warning',
        suggestedAction: 'Generate more concept variations',
      });
    }

    // Check alignment with research
    const hasAlignment = findings && findings.deepDesires && findings.deepDesires.length > 0;
    checks.push({
      name: 'Concepts match research findings',
      required: true,
      present: hasAlignment,
      confidence: 80,
    });

    const presentCount = checks.filter(c => c.present).length;
    const qualityScore = (presentCount / checks.length) * 100;

    return {
      fromPhase: 'phase5',
      toPhase: 'phase6',
      timestamp: Date.now(),
      checkedItems: checks,
      gaps,
      qualityScore,
      canProceed: qualityScore >= 80,
      recommendations: gaps.map(g => g.suggestedAction),
    };
  }

  /**
   * Validate Phase 6 → Phase 7 transition
   */
  static validatePhase6ToPhase7(testResults: unknown): PhaseTransitionCheck {
    const checks: ContextCheckItem[] = [];
    const gaps: ContextGap[] = [];

    const hasResults = !!testResults;
    checks.push({
      name: 'Test results valid',
      required: true,
      present: hasResults,
      confidence: 85,
    });

    if (!hasResults) {
      gaps.push({
        category: 'testing',
        description: 'No test results available',
        severity: 'critical',
        suggestedAction: 'Run test phase on concepts',
      });
    }

    const presentCount = checks.filter(c => c.present).length;
    const qualityScore = (presentCount / checks.length) * 100;

    return {
      fromPhase: 'phase6',
      toPhase: 'phase7',
      timestamp: Date.now(),
      checkedItems: checks,
      gaps,
      qualityScore,
      canProceed: qualityScore >= 80,
      recommendations: gaps.map(g => g.suggestedAction),
    };
  }

  /**
   * Generate recovery plan if gaps detected
   */
  static generateRecoveryPlan(check: PhaseTransitionCheck): string[] {
    const plan: string[] = [];

    check.gaps.forEach(gap => {
      if (gap.severity === 'critical') {
        plan.push(`CRITICAL: ${gap.suggestedAction}`);
        if (gap.requiredQueries) {
          plan.push(`  Execute queries: ${gap.requiredQueries.join(', ')}`);
        }
      } else if (gap.severity === 'warning') {
        plan.push(`OPTIONAL: ${gap.suggestedAction}`);
      }
    });

    if (plan.length === 0) {
      plan.push('All context requirements met. Safe to proceed.');
    }

    return plan;
  }

  // ─── Helper Methods ─────────────────────────────────────────────────────

  private static calculateDesireCompleteness(desires?: DeepDesire[]): number {
    if (!desires || desires.length === 0) return 0;

    let completeness = 0;
    desires.forEach(d => {
      let score = 0;
      if (d.surfaceProblem) score += 20;
      if (d.layers && d.layers.length > 0) score += 20;
      if (d.deepestDesire) score += 20;
      if (d.turningPoint) score += 20;
      if (d.amplifiedDesireType) score += 20;
      completeness += score / 100;
    });

    return (completeness / desires.length) * 100;
  }
}

// ─── Context Bridge Manager (orchestration) ──────────────────────────────────

export class ContextBridgeManager {
  private transitions: PhaseTransitionCheck[] = [];

  /**
   * Execute a phase transition with validation
   */
  async executeTransition(
    fromPhase: PhaseName,
    toPhase: PhaseName,
    context: Record<string, unknown>
  ): Promise<PhaseTransitionCheck> {
    let check: PhaseTransitionCheck | null = null;

    // Route to appropriate validator
    switch (`${fromPhase}_${toPhase}`) {
      case 'phase1_phase2':
        check = ContextBridgeValidator.validatePhase1ToPhase2(context as unknown as ResearchFindings);
        break;
      case 'phase2_phase3':
        check = ContextBridgeValidator.validatePhase2ToPhase3(context as unknown as ResearchFindings);
        break;
      case 'phase3_phase4':
        check = ContextBridgeValidator.validatePhase3ToPhase4(context.objections as unknown as Objection[]);
        break;
      case 'phase4_phase5':
        check = ContextBridgeValidator.validatePhase4ToPhase5(context.verdict as unknown as CouncilVerdict);
        break;
      case 'phase5_phase6':
        check = ContextBridgeValidator.validatePhase5ToPhase6(
          context.conceptCount as number,
          context as unknown as ResearchFindings
        );
        break;
      case 'phase6_phase7':
        check = ContextBridgeValidator.validatePhase6ToPhase7(context.testResults);
        break;
      default:
        throw new Error(`Unknown transition: ${fromPhase} → ${toPhase}`);
    }

    this.transitions.push(check);
    return check;
  }

  /**
   * Get overall quality across all transitions
   */
  getOverallQuality(): PhaseTransitionReport {
    const overallQuality = this.transitions.length > 0
      ? this.transitions.reduce((sum, t) => sum + t.qualityScore, 0) / this.transitions.length
      : 0;

    const blockingIssues: string[] = [];
    const recoveryPlan: string[] = [];

    this.transitions.forEach(check => {
      if (!check.canProceed) {
        blockingIssues.push(`${check.fromPhase} → ${check.toPhase}: Quality ${check.qualityScore.toFixed(0)}/100`);
        recoveryPlan.push(...ContextBridgeValidator.generateRecoveryPlan(check));
      }
    });

    return {
      transitions: this.transitions,
      overallQuality,
      blockingIssues,
      recoveryPlan,
    };
  }
}
