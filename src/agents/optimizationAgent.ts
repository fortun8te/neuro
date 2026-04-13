/**
 * Optimization Agent for RACKS
 *
 * Single agent that identifies and recommends optimizations across:
 * - Performance (speed, latency)
 * - Memory (RAM usage, leaks)
 * - Network (bandwidth, API calls)
 * - Computation (algorithm efficiency)
 * - Concurrency (parallelization opportunities)
 */

import { SubagentPool } from '../utils/subagentManager';
import { createLogger } from '../utils/logger';

const log = createLogger('optimizationAgent');

export interface OptimizationOpportunity {
  area: string; // "performance", "memory", "network", "computation", "concurrency"
  currentBottleneck: string;
  expectedImprovement: string; // "2x faster", "50% less memory", etc
  difficulty: 'easy' | 'medium' | 'hard';
  effort: string; // "1 hour", "2-3 days"
  implementation: string[];
  estimatedROI: string; // "Saves 500ms per request"
  dependencies: string[]; // Other changes needed
}

/**
 * Comprehensive optimization audit
 */
export async function auditPerformance(
  metrics: {
    avgResearchTime: number; // ms
    peakMemory: number; // MB
    dbQueryCount: number;
    apiCallCount: number;
    subagentPoolSize: number;
    currentConcurrency: number;
  },
  pool: SubagentPool,
): Promise<OptimizationOpportunity[]> {
  log.info('[Optimizer] Auditing system performance...');

  const response = await pool.submit({
    role: 'performance_optimizer',
    task: 'Identify performance optimization opportunities',
    prompt: `Analyze RACKS system performance and recommend optimizations.

Current metrics:
- Average research time: ${metrics.avgResearchTime}ms
- Peak memory usage: ${metrics.peakMemory}MB
- Database queries: ${metrics.dbQueryCount} per session
- API calls: ${metrics.apiCallCount} per session
- Subagent pool size: ${metrics.subagentPoolSize}
- Current concurrency: ${metrics.currentConcurrency}

OPTIMIZATION AUDIT:

1. PERFORMANCE (Speed)
   - Research taking ${metrics.avgResearchTime}ms — is this acceptable?
   - Which phases are slowest? (planning, research, reflection, synthesis)
   - Can LLM calls be cached?
   - Can results be streamed instead of batch?
   - Where are the blocking operations?

2. MEMORY (RAM)
   - Peak at ${metrics.peakMemory}MB — efficient?
   - Are large results kept in memory?
   - Are caches unbounded?
   - Is there pagination/streaming opportunity?
   - Memory leaks in long-running sessions?

3. NETWORK (Bandwidth)
   - ${metrics.apiCallCount} API calls per session — necessary?
   - Can requests be batched?
   - Are responses too large?
   - Unnecessary retries?
   - Compression opportunities?

4. COMPUTATION (Algorithm)
   - Is deduplication O(n²) when it could be O(n)?
   - Unnecessary sorting/filtering?
   - Redundant calculations?
   - Can expensive operations be approximate?
   - ML model inference opportunities (cache embeddings)?

5. CONCURRENCY (Parallelization)
   - Currently ${metrics.currentConcurrency} concurrent
   - Could increase to ${metrics.subagentPoolSize}?
   - Are analyzers running in sequence when they could parallel?
   - Are database reads blocking writes?
   - Opportunity for async I/O?

For EACH optimization:
- Current behavior (what's slow?)
- Optimization technique (how to fix?)
- Expected speedup (2x? 10x?)
- Complexity (1 hour? 1 week?)
- Risk (safe refactor or requires rewrite?)
- Benchmark before/after

Return JSON with top 20 optimizations ranked by ROI.`,
    context:
      'You are a performance engineer. Find the biggest bottlenecks and easiest wins.',
    maxSteps: 8,
  });

  return parseOptimizations(response.text);
}

/**
 * Parse optimization opportunities from response
 */
function parseOptimizations(text: string): OptimizationOpportunity[] {
  const opportunities: OptimizationOpportunity[] = [];
  const sections = text.split(/optimization\s+\d+:|###/i);

  const areas = [
    'performance',
    'memory',
    'network',
    'computation',
    'concurrency',
  ];

  for (const section of sections.slice(1)) {
    const lines = section.split('\n');
    let opp: Partial<OptimizationOpportunity> = {};

    // Try to detect area
    for (const area of areas) {
      if (section.toLowerCase().includes(area)) {
        opp.area = area;
        break;
      }
    }

    // Extract fields
    for (const line of lines) {
      if (line.includes('bottleneck') || line.includes('issue:')) {
        opp.currentBottleneck = extractValue(line);
      } else if (
        line.includes('improvement') ||
        line.includes('speedup:')
      ) {
        opp.expectedImprovement = extractValue(line);
      } else if (line.includes('difficulty') || line.includes('complexity:')) {
        const val = extractValue(line).toLowerCase();
        if (val.includes('easy'))
          opp.difficulty = 'easy';
        else if (val.includes('medium'))
          opp.difficulty = 'medium';
        else if (val.includes('hard'))
          opp.difficulty = 'hard';
      } else if (line.includes('effort') || line.includes('time:')) {
        opp.effort = extractValue(line);
      } else if (line.includes('implementation') || line.includes('steps:')) {
        opp.implementation = extractValue(line)
          .split(/,|;/)
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .slice(0, 5);
      } else if (line.includes('roi') || line.includes('saves:')) {
        opp.estimatedROI = extractValue(line);
      } else if (line.includes('depend') || line.includes('requires:')) {
        opp.dependencies = extractValue(line)
          .split(/,|;/)
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .slice(0, 3);
      }
    }

    if (opp.currentBottleneck && opp.area) {
      opportunities.push({
        area: opp.area || 'performance',
        currentBottleneck: opp.currentBottleneck || '',
        expectedImprovement: opp.expectedImprovement || '',
        difficulty: opp.difficulty || 'medium',
        effort: opp.effort || '2-3 hours',
        implementation: opp.implementation || [],
        estimatedROI: opp.estimatedROI || '',
        dependencies: opp.dependencies || [],
      });
    }
  }

  return opportunities.slice(0, 20);
}

/**
 * Extract value from "key: value" line
 */
function extractValue(line: string): string {
  const match = line.match(/:\s*(.+)$/);
  return match ? match[1].trim() : '';
}

/**
 * Prioritize optimizations by ROI
 */
export function prioritizeOptimizations(
  opportunities: OptimizationOpportunity[],
): OptimizationOpportunity[] {
  return opportunities.sort((a, b) => {
    // Score by difficulty and effort
    const difficultyScore: Record<string, number> = {
      easy: 3,
      medium: 2,
      hard: 1,
    };

    const effortScore =
      (a.effort?.includes('1') ? 3 : a.effort?.includes('2-3') ? 2 : 1) -
      (b.effort?.includes('1') ? 3 : b.effort?.includes('2-3') ? 2 : 1);

    const diffScore =
      difficultyScore[a.difficulty] - difficultyScore[b.difficulty];

    return effortScore + diffScore;
  });
}

/**
 * Generate optimization report
 */
export function generateOptimizationReport(
  opportunities: OptimizationOpportunity[],
): string {
  const easy = opportunities.filter(o => o.difficulty === 'easy');
  const medium = opportunities.filter(o => o.difficulty === 'medium');
  const hard = opportunities.filter(o => o.difficulty === 'hard');

  let report = `
⚡ RACKS PERFORMANCE OPTIMIZATION REPORT

Quick Wins (Easy, 1-2 hours each):
${easy.slice(0, 3).map(o => `  ✅ ${o.currentBottleneck} → ${o.expectedImprovement}`).join('\n')}

Medium Effort (2-3 hours each):
${medium.slice(0, 3).map(o => `  🟡 ${o.currentBottleneck} → ${o.expectedImprovement}`).join('\n')}

Major Refactors (Days):
${hard.slice(0, 3).map(o => `  🔴 ${o.currentBottleneck} → ${o.expectedImprovement}`).join('\n')}

Recommended path:
1. Start with easy wins (2-3 hours, ~20% speedup)
2. Then medium effort (6-9 hours, ~40% additional speedup)
3. Finally hard refactors (days, massive speedup)

Total potential: ${(opportunities.length > 10 ? '5-10x' : '2-3x')} performance improvement
`;

  return report;
}
