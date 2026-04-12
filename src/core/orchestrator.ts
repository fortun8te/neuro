/**
 * Research Orchestrator with Vulnerability Judge Integration
 *
 * Manages the research cycle with core-focused quality assessment.
 *
 * Flow:
 * 1. Execute research phase
 * 2. Run vulnerability judge on findings
 * 3. Decision: continue or terminate
 * 4. If continuing, deploy next iteration
 */

import { createLogger } from '../utils/logger';
import { SubagentPool } from '../utils/subagentManager';
import {
  judgeResearchQuality,
  type VulnerabilityReport,
} from './phases/vulnerabilityJudge';

const log = createLogger('orchestrator');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ResearchContext {
  originalQuestion: string;
  sessionId: string;
  findings: Record<string, any> | null;
  section: string;
  timeLimit: number; // milliseconds
  iterationLimit: number;
  startTime: number;
}

export interface OrchestrationDecision {
  continueResearch: boolean;
  reason: string;
  nextAction?: 'query' | 'expand' | 'deepen' | 'terminate';
  vulnerabilityReport: VulnerabilityReport;
}

export interface ResearchCycle {
  cycleNumber: number;
  findings: Record<string, any>;
  vulnerabilityReport: VulnerabilityReport;
  decision: OrchestrationDecision;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Core Orchestration Logic
// ─────────────────────────────────────────────────────────────

/**
 * Make a research continuation decision based on vulnerability assessment
 *
 * @param context Current research context
 * @param subagentPool Pool for critic deployment
 * @returns Decision object with next actions
 */
export async function orchestrateResearchCycle(
  context: ResearchContext,
  subagentPool: SubagentPool,
): Promise<OrchestrationDecision> {
  const elapsed = Date.now() - context.startTime;
  const timeRemaining = context.timeLimit - elapsed;

  log.info('[Orchestrator] Making research decision');
  log.info(`  Time used: ${(elapsed / 1000).toFixed(1)}s / ${(context.timeLimit / 1000).toFixed(1)}s`);

  // 1. Judge research quality
  let vulnerabilityReport: VulnerabilityReport;
  try {
    vulnerabilityReport = await judgeResearchQuality(
      context.findings,
      context.section,
      context.originalQuestion,
      subagentPool,
    );
  } catch (error) {
    log.error('[Orchestrator] Vulnerability judgment failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback: conservative decision (continue if low coverage)
    vulnerabilityReport = {
      coreTopicCoverage: 0,
      vulnerabilityScore: 100,
      coreGaps: [],
      explanationWeaknesses: [],
      relatedAngles: [],
      recommendations: [],
      isCoreCovered: false,
      coverageByFacet: {},
      generatedAt: Date.now(),
      researchPriority: 'high',
    };
  }

  // 2. Decision logic
  const continueResearch =
    vulnerabilityReport.coreTopicCoverage < 85 && // Still significant gaps
    timeRemaining > 30000 && // At least 30s remaining
    !vulnerabilityReport.isCoreCovered; // Core not fully covered

  let nextAction: 'query' | 'expand' | 'deepen' | 'terminate' | undefined;
  let reason = '';

  if (vulnerabilityReport.coreTopicCoverage >= 85) {
    nextAction = 'terminate';
    reason = `Core topic coverage adequate (${vulnerabilityReport.coreTopicCoverage}% > 85% threshold)`;
  } else if (vulnerabilityReport.coreTopicCoverage >= 70) {
    nextAction = 'expand';
    reason = `Partial coverage (${vulnerabilityReport.coreTopicCoverage}%); need to expand scope`;
  } else if (vulnerabilityReport.coreTopicCoverage >= 40) {
    nextAction = 'deepen';
    reason = `Low coverage (${vulnerabilityReport.coreTopicCoverage}%); need deeper investigation`;
  } else {
    nextAction = 'query';
    reason = `Critical gap (${vulnerabilityReport.coreTopicCoverage}%); need new queries`;
  }

  if (timeRemaining < 30000) {
    nextAction = 'terminate';
    reason = `Time limit approaching (${(timeRemaining / 1000).toFixed(0)}s remaining)`;
  }

  const decision: OrchestrationDecision = {
    continueResearch: nextAction !== 'terminate' && continueResearch,
    reason,
    nextAction,
    vulnerabilityReport,
  };

  logOrchestrationDecision(decision, vulnerabilityReport);

  return decision;
}

// ─────────────────────────────────────────────────────────────
// Cycle Management
// ─────────────────────────────────────────────────────────────

/**
 * Execute a complete research cycle with judgment
 */
export async function executeCycle(
  cycleNumber: number,
  context: ResearchContext,
  subagentPool: SubagentPool,
  executeResearchFn: (ctx: ResearchContext) => Promise<Record<string, any>>,
): Promise<ResearchCycle> {
  log.info(`[Orchestrator] Starting cycle ${cycleNumber}`);

  const startTime = Date.now();

  // Execute research for this cycle
  const findings = await executeResearchFn(context);
  context.findings = findings;

  // Judge the results
  const decision = await orchestrateResearchCycle(context, subagentPool);

  const cycle: ResearchCycle = {
    cycleNumber,
    findings,
    vulnerabilityReport: decision.vulnerabilityReport,
    decision,
    timestamp: Date.now(),
  };

  log.info(`[Orchestrator] Cycle ${cycleNumber} complete in ${(Date.now() - startTime) / 1000}s`);

  return cycle;
}

// ─────────────────────────────────────────────────────────────
// Query Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate next research queries based on vulnerability report
 */
export function generateNextQueries(report: VulnerabilityReport): string[] {
  const queries: string[] = [];

  // Prioritize critical gaps
  const criticalGaps = report.coreGaps
    .filter(g => g.importance === 'critical' && g.affectsDecision)
    .flatMap(g => g.suggestedQueries);

  queries.push(...criticalGaps.slice(0, 2));

  // Add top recommendations
  queries.push(...report.recommendations.slice(0, 2));

  // Remove duplicates and limit to top 5
  const unique = Array.from(new Set(queries));
  return unique.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────
// Status & Output
// ─────────────────────────────────────────────────────────────

/**
 * Format vulnerability report for CLI output
 */
export function formatVulnerabilityReport(report: VulnerabilityReport): string {
  const lines: string[] = [];

  lines.push('─────────────────────────────────────────────────────────');
  lines.push('VULNERABILITY ASSESSMENT');
  lines.push('─────────────────────────────────────────────────────────');
  lines.push('');

  // Coverage status
  lines.push(`Core Topic Coverage: ${report.coreTopicCoverage}%`);
  const coverageBar = createProgressBar(report.coreTopicCoverage, 30);
  lines.push(`  ${coverageBar}`);
  lines.push('');

  // Status
  if (report.isCoreCovered) {
    lines.push('✓ CORE TOPIC ADEQUATELY COVERED');
  } else {
    lines.push('✗ CORE TOPIC NEEDS MORE RESEARCH');
  }
  lines.push('');

  // Gaps
  if (report.coreGaps.length > 0) {
    lines.push('Core Gaps Identified:');
    for (const gap of report.coreGaps.slice(0, 5)) {
      const icon = gap.importance === 'critical' ? '⚠' : '•';
      lines.push(`  ${icon} ${gap.topic} [${gap.importance}]`);
    }
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('Next Research Queries:');
    for (const rec of report.recommendations.slice(0, 3)) {
      lines.push(`  → ${rec}`);
    }
    lines.push('');
  }

  // Priority
  lines.push(`Research Priority: ${report.researchPriority.toUpperCase()}`);
  lines.push('');

  // Coverage by facet
  if (Object.keys(report.coverageByFacet).length > 0) {
    lines.push('Coverage by Topic Facet:');
    for (const [topic, coverage] of Object.entries(report.coverageByFacet)) {
      const bar = createProgressBar(coverage, 20);
      lines.push(`  ${topic}: ${bar} ${coverage}%`);
    }
    lines.push('');
  }

  lines.push('─────────────────────────────────────────────────────────');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function createProgressBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function logOrchestrationDecision(
  decision: OrchestrationDecision,
  report: VulnerabilityReport,
): void {
  log.info('[Orchestrator] Decision made');
  log.info(`  Continue Research: ${decision.continueResearch}`);
  log.info(`  Next Action: ${decision.nextAction}`);
  log.info(`  Reason: ${decision.reason}`);
  log.info(`  Core Coverage: ${report.coreTopicCoverage}%`);

  if (report.coreGaps.length > 0) {
    const critical = report.coreGaps.filter(g => g.importance === 'critical');
    if (critical.length > 0) {
      log.warn(`  Critical Gaps: ${critical.map(g => g.topic).join(', ')}`);
    }
  }
}

export default {
  orchestrateResearchCycle,
  executeCycle,
  generateNextQueries,
  formatVulnerabilityReport,
};
