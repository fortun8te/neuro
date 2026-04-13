/**
 * Diagnostic Agents for RACKS Research System
 *
 * 3 agents analyze research quality issues:
 * - Agent 1: Research effectiveness analysis
 * - Agent 2: Data quality assessment
 * - Agent 3: Coverage and depth evaluation
 */

import { SubagentPool } from '../utils/subagentManager';
import { createLogger } from '../utils/logger';

const log = createLogger('diagnosticAgents');

export interface DiagnosticReport {
  agent: string;
  timestamp: number;
  findings: string[];
  issues: string[];
  recommendations: string[];
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Agent 1: Research Effectiveness Analysis
 * Analyzes why research results are weak/generic
 */
export async function analyzeResearchEffectiveness(
  recentFindings: any[],
  pool: SubagentPool,
): Promise<DiagnosticReport> {
  log.info('[Diagnostic-1] Analyzing research effectiveness...');

  const response = await pool.submit({
    role: 'diagnostic_researcher',
    task: 'Analyze why brand research findings are weak or generic',
    prompt: `Analyze these research findings and identify WHY they're weak:

${JSON.stringify(recentFindings.slice(0, 3), null, 2)}

Questions to address:
1. Are queries too broad? (generic "supplement market" vs "collagen shampoo market"?)
2. Are results shallow? (skimming vs deep analysis?)
3. Missing competitor specificity? (not comparing to actual competitors?)
4. Poor source quality? (Reddit vs proprietary research reports?)
5. Insufficient social media depth? (just follower count vs engagement analysis?)
6. Revenue estimation too rough? (missing financial data points?)
7. Audience segmentation weak? (generic demographics vs specific personas?)

For each issue found:
- Why is this happening?
- What specific queries/sources would fix this?
- How to weight this data for better confidence scoring?

Be specific. Not "improve research" but "Add site-specific searches like site:reddit.com/r/collagen"`,
    context:
      'You are a research quality auditor. Identify structural weaknesses in how research is conducted.',
    maxSteps: 5,
  });

  return parseReport(response.text, 'Effectiveness', 'high');
}

/**
 * Agent 2: Data Quality Assessment
 * Checks data consistency, duplication, accuracy
 */
export async function assessDataQuality(
  allFindings: Record<string, any>,
  pool: SubagentPool,
): Promise<DiagnosticReport> {
  log.info('[Diagnostic-2] Assessing data quality...');

  const response = await pool.submit({
    role: 'diagnostic_qa',
    task: 'Assess data quality across all analyzers',
    prompt: `Review data quality across these analysis results:

Images: ${allFindings.imageAnalysis ? `${allFindings.imageAnalysis.count} analyzed` : 'none'}
Products: ${allFindings.productAnalysis ? `${allFindings.productAnalysis.total} found` : 'none'}
Social: ${allFindings.socialAnalysis?.platforms?.length || 0} platforms
Audience: ${allFindings.audienceAnalysis ? 'analyzed' : 'missing'}
Revenue: ${allFindings.revenueAnalysis?.estimate || 'not estimated'}
Competitors: ${allFindings.competitorAnalysis?.competitors?.length || 0} identified

Check for:
1. Data duplication across sources? (same facts mentioned multiple times?)
2. Contradictions? (different revenue estimates, conflicting audience data?)
3. Missing critical fields? (products without prices, social without engagement?)
4. Hallucinated data? (unrealistic numbers, made-up facts?)
5. Source verification? (Are citations actually valid?)
6. Temporal inconsistency? (data from different time periods mixed?)
7. Format inconsistency? (dates, numbers, text in wrong formats?)

For each quality issue:
- How to detect it programmatically?
- How to correct it?
- What validation rules are missing?`,
    context:
      'You are a data quality engineer. Find inconsistencies and gaps in collected data.',
    maxSteps: 5,
  });

  return parseReport(response.text, 'Data Quality', 'critical');
}

/**
 * Agent 3: Coverage and Depth Evaluation
 * Checks if research covers enough dimensions
 */
export async function evaluateCoverageDepth(
  findings: Record<string, any>,
  originalQuestion: string,
  pool: SubagentPool,
): Promise<DiagnosticReport> {
  log.info('[Diagnostic-3] Evaluating coverage and depth...');

  const response = await pool.submit({
    role: 'diagnostic_coverage',
    task: 'Evaluate research coverage completeness',
    prompt: `Original question: "${originalQuestion}"

Current research coverage:
${Object.entries(findings)
  .map(([key, value]) => {
    if (!value) return `- ${key}: NOT COVERED`;
    if (typeof value === 'object' && value.coverage)
      return `- ${key}: ${value.coverage}% covered`;
    return `- ${key}: partially covered`;
  })
  .join('\n')}

Coverage dimension analysis:
1. Brand identity — do we understand who they are? (missing?)
2. Market position — vs competitors? (weak?)
3. Customer motivation — emotional + functional needs? (insufficient?)
4. Revenue/scale — can we estimate business size? (uncertain?)
5. Growth trajectory — are they growing? how fast? (unknown?)
6. Social presence — real engagement vs vanity metrics? (surface level?)
7. Product strategy — intentional positioning or random? (unclear?)
8. Supply chain — how does it affect positioning? (not researched?)
9. Regulatory landscape — are there compliance factors? (missed?)
10. Future roadmap — where are they going? (not forecasted?)

For each gap:
- How important is this to answer the original question?
- How many more sources would be needed?
- What specific research would close the gap?`,
    context:
      'You are a research completeness auditor. Assess if research answers the original question fully.',
    maxSteps: 5,
  });

  return parseReport(response.text, 'Coverage', 'high');
}

/**
 * Run all 3 diagnostic agents in parallel
 */
export async function runFullDiagnostics(
  findings: Record<string, any>,
  question: string,
  pool: SubagentPool,
): Promise<DiagnosticReport[]> {
  log.info('[Diagnostics] Running full diagnostic suite...');

  const [effectiveness, quality, coverage] = await Promise.allSettled([
    analyzeResearchEffectiveness(
      Object.values(findings).filter(f => f),
      pool,
    ),
    assessDataQuality(findings, pool),
    evaluateCoverageDepth(findings, question, pool),
  ]);

  const reports: DiagnosticReport[] = [];

  if (effectiveness.status === 'fulfilled') {
    reports.push(effectiveness.value);
  }
  if (quality.status === 'fulfilled') {
    reports.push(quality.value);
  }
  if (coverage.status === 'fulfilled') {
    reports.push(coverage.value);
  }

  // Summarize findings
  const allIssues = reports.flatMap(r => r.issues);
  const allRecs = reports.flatMap(r => r.recommendations);

  log.info('[Diagnostics] Complete', {
    reports: reports.length,
    issues: allIssues.length,
    recommendations: allRecs.length,
  });

  return reports;
}

/**
 * Parse diagnostic response into structured report
 */
function parseReport(
  text: string,
  agentName: string,
  severity: 'critical' | 'high' | 'medium',
): DiagnosticReport {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const findings: string[] = [];

  // Extract sections from response
  const lines = text.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.toLowerCase().includes('issue') ||
      trimmed.toLowerCase().includes('problem')
    ) {
      currentSection = 'issues';
    } else if (
      trimmed.toLowerCase().includes('recommend') ||
      trimmed.toLowerCase().includes('solution')
    ) {
      currentSection = 'recommendations';
    } else if (
      trimmed.toLowerCase().includes('finding') ||
      trimmed.toLowerCase().includes('observation')
    ) {
      currentSection = 'findings';
    }

    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      const content = trimmed.replace(/^[-•]\s*/, '');
      if (currentSection === 'issues' && content.length > 5) {
        issues.push(content);
      } else if (currentSection === 'recommendations' && content.length > 5) {
        recommendations.push(content);
      } else if (currentSection === 'findings' && content.length > 5) {
        findings.push(content);
      }
    }
  }

  return {
    agent: agentName,
    timestamp: Date.now(),
    findings: findings.slice(0, 10),
    issues: issues.slice(0, 10),
    recommendations: recommendations.slice(0, 10),
    severity,
  };
}

/**
 * Generate improvement action plan from diagnostics
 */
export function generateImprovementPlan(
  reports: DiagnosticReport[],
): { priority: string; action: string; effort: string }[] {
  const plan: { priority: string; action: string; effort: string }[] = [];
  const seen = new Set<string>();

  // Collect unique recommendations prioritized by severity
  const criticalRecs = reports
    .filter(r => r.severity === 'critical')
    .flatMap(r => r.recommendations);
  const highRecs = reports
    .filter(r => r.severity === 'high')
    .flatMap(r => r.recommendations);
  const mediumRecs = reports
    .filter(r => r.severity === 'medium')
    .flatMap(r => r.recommendations);

  // Add critical items first
  for (const rec of criticalRecs) {
    if (!seen.has(rec)) {
      seen.add(rec);
      plan.push({
        priority: 'CRITICAL',
        action: rec,
        effort: estimateEffort(rec),
      });
    }
  }

  // Then high priority
  for (const rec of highRecs.slice(0, 5)) {
    if (!seen.has(rec)) {
      seen.add(rec);
      plan.push({
        priority: 'HIGH',
        action: rec,
        effort: estimateEffort(rec),
      });
    }
  }

  // Then medium
  for (const rec of mediumRecs.slice(0, 3)) {
    if (!seen.has(rec)) {
      seen.add(rec);
      plan.push({
        priority: 'MEDIUM',
        action: rec,
        effort: estimateEffort(rec),
      });
    }
  }

  return plan;
}

/**
 * Estimate effort for an action
 */
function estimateEffort(action: string): string {
  const lower = action.toLowerCase();

  if (lower.includes('add') || lower.includes('create')) {
    return '2-4 hours';
  }
  if (lower.includes('refactor') || lower.includes('restructure')) {
    return '4-8 hours';
  }
  if (lower.includes('fix') || lower.includes('improve')) {
    return '1-2 hours';
  }
  if (lower.includes('optimize') || lower.includes('enhance')) {
    return '3-6 hours';
  }

  return '2-3 hours';
}
