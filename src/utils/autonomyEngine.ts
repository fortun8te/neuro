/**
 * autonomyEngine.ts — Proactive decision-making & self-improvement
 *
 * Three core components:
 * 1. AutonomyManager — Decides next action (run research, iterate Make, switch models, pause)
 * 2. SelfImprovementAgent — Learns from cycles, extracts learnings, suggests improvements
 * 3. ProactiveMonitor — Watches token usage, memory pressure, service health
 *
 * Integrates with useCycleLoop via hooks:
 * - On mount: decideNextAction()
 * - After each phase: learnFromCycle()
 * - Every 5min: proactiveMonitor.check()
 */

import { get, set } from 'idb-keyval';
import type { Cycle, Campaign } from '../types';
import { healthMonitor } from './healthMonitor';
import { tokenTracker } from './tokenStats';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CycleMetrics {
  researchCoverage: number;          // 0–100%
  makeQuality: number;               // 0–100
  avgTokensPerStage: Record<string, number>;
  totalTokensUsed: number;
  cycleElapsedMs: number;
  modelSwitchCount: number;
}

export interface AutonomousAction {
  action: 'run-research' | 'iterate-make' | 'switch-model' | 'pause-for-review' | 'continue' | 'optimize-context';
  confidence: number;                // 0–1
  reasoning: string;
  recommendedModel?: string;
  estimatedBenefit?: string;
}

export interface CycleInsight {
  cycleId: string;
  timestamp: number;
  keyFindings: string[];
  whatWorked: string[];
  whatDidNotWork: string[];
  suggestedNextSteps: string[];
  suggestedModelTier?: string;
  visualAnglesThatResonated?: string[];
}

// ─────────────────────────────────────────────────────────────
// AutonomyManager
// ─────────────────────────────────────────────────────────────

class AutonomyManager {
  /**
   * Decide next action based on cycle state & metrics.
   * Confidence thresholds:
   *   - Research <90% coverage → run more research
   *   - Make <85/100 → iterate Make
   *   - Service down 2+ min → pause (don't hang)
   *   - Token budget >80% → optimize context
   */
  async decideNextAction(
    cycleState: { currentStage: string; status: string },
    metrics: CycleMetrics
  ): Promise<AutonomousAction> {
    const decisions: AutonomousAction[] = [];

    // Research coverage check
    if (metrics.researchCoverage < 90) {
      const gap = Math.min(90, Math.max(0, 90 - metrics.researchCoverage));
      decisions.push({
        action: 'run-research',
        confidence: Math.min(0.95, (gap / 10) * 0.3),
        reasoning: `Research coverage at ${Math.round(metrics.researchCoverage)}%. Running additional round to reach 90%+ threshold.`,
        estimatedBenefit: 'Fuller market context → stronger creative angles',
      });
    }

    // Make quality check
    if (metrics.makeQuality < 85 && cycleState.currentStage === 'production') {
      const qualityGap = Math.min(100, Math.max(0, 100 - metrics.makeQuality));
      decisions.push({
        action: 'iterate-make',
        confidence: Math.min(0.90, (qualityGap / 15) * 0.4),
        reasoning: `Make quality at ${Math.round(metrics.makeQuality)}/100. Iterating to reach 85+ threshold.`,
        estimatedBenefit: 'Higher-quality concepts ready for production',
      });
    }

    // Service health check
    const health = healthMonitor.getSnapshot();
    const downServices = Object.values(health).filter(s => s.status === 'down');
    if (downServices.length > 0) {
      const downtime = Date.now() - downServices[0].lastCheck;
      if (downtime > 120_000) {
        // 2+ min
        decisions.push({
          action: 'pause-for-review',
          confidence: 0.95,
          reasoning: `Service "${downServices[0].name}" down for ${(downtime / 1000).toFixed(0)}s. Pausing to prevent timeout cascade.`,
        });
      }
    }

    // Token budget check
    const tokenUsagePercent = (metrics.totalTokensUsed / 100_000) * 100; // assume 100K budget
    if (tokenUsagePercent > 80) {
      decisions.push({
        action: 'optimize-context',
        confidence: 0.85,
        reasoning: `Token usage at ${tokenUsagePercent.toFixed(1)}% of budget. Compressing context to extend runway.`,
        estimatedBenefit: 'Extends cycle without model downgrade',
      });
    }

    // Pick highest confidence decision, fallback to 'continue'
    const bestDecision = decisions.sort((a, b) => b.confidence - a.confidence)[0];
    return bestDecision || { action: 'continue', confidence: 1.0, reasoning: 'All metrics within healthy range.' };
  }
}

// ─────────────────────────────────────────────────────────────
// SelfImprovementAgent
// ─────────────────────────────────────────────────────────────

class SelfImprovementAgent {
  private storageKey = 'autonomy_insights';

  /**
   * Learn from cycle: extract what worked, what didn't, patterns.
   */
  async learnFromCycle(cycle: Cycle, finalMetrics: CycleMetrics): Promise<CycleInsight> {
    const insight: CycleInsight = {
      cycleId: cycle.id,
      timestamp: Date.now(),
      keyFindings: [],
      whatWorked: [],
      whatDidNotWork: [],
      suggestedNextSteps: [],
    };

    // Extract quality signals from stages
    const makeStage = cycle.stages['production'];
    const testStage = cycle.stages['test'];
    const researchStage = cycle.stages['research'];

    if (makeStage?.artifacts && makeStage.artifacts.length > 0) {
      insight.whatWorked.push('Production generated multiple concepts');
    }

    if (testStage?.agentOutput) {
      const testOutput = testStage.agentOutput.toLowerCase();
      if (testOutput.includes('strong') || testOutput.includes('resonat')) {
        insight.whatWorked.push('Test identified strong concepts');
      }
      if (testOutput.includes('weak') || testOutput.includes('flat')) {
        insight.whatDidNotWork.push('Some concepts rated weak in test phase');
      }
    }

    if (finalMetrics.researchCoverage < 75) {
      insight.whatDidNotWork.push('Research coverage below 75%');
      insight.suggestedNextSteps.push('Increase research iteration count next cycle');
    }

    if (finalMetrics.makeQuality < 80) {
      insight.whatDidNotWork.push('Make quality below target');
      insight.suggestedNextSteps.push('Consider higher-tier model for creative generation');
      insight.suggestedModelTier = '9b';
    }

    insight.keyFindings = [
      `Cycle completed in ${(finalMetrics.cycleElapsedMs / 1000 / 60).toFixed(1)} min`,
      `Used ${finalMetrics.totalTokensUsed} tokens across ${Object.keys(finalMetrics.avgTokensPerStage).length} stages`,
      `Research coverage: ${finalMetrics.researchCoverage}%`,
      `Make quality: ${finalMetrics.makeQuality}/100`,
    ];

    // Persist insight
    await this.storeInsight(insight);
    return insight;
  }

  /**
   * Suggest improvements based on prior cycles.
   */
  async suggestImprovements(cycleId: string): Promise<string[]> {
    const insights = await this.loadAllInsights();
    const suggestions: string[] = [];

    if (insights.length === 0) return suggestions;

    // Aggregate patterns
    const avgCoverage = insights.reduce((sum, i) => {
      const match = i.keyFindings[2]?.match(/\d+/)?.[0];
      return sum + (match ? parseInt(match, 10) : 0);
    }, 0) / insights.length;
    const avgQuality = insights.reduce((sum, i) => {
      const match = i.keyFindings[3]?.match(/\d+/)?.[0];
      return sum + (match ? parseInt(match, 10) : 0);
    }, 0) / insights.length;

    if (avgCoverage < 80) {
      suggestions.push('Consistent pattern: increase research depth presets (move to EX or MX)');
    }

    if (avgQuality < 82) {
      suggestions.push('Quality trending low: experiment with 9b model tier for Make stage');
    }

    const failurePatterns = insights
      .filter(i => i.whatDidNotWork.length > 0)
      .map(i => i.whatDidNotWork[0]);

    if (failurePatterns.filter(p => p?.includes('coverage')).length > insights.length * 0.5) {
      suggestions.push('Weak research coverage patterns detected: allocate more iterations to Phase 2 orchestration');
    }

    return suggestions;
  }

  private async storeInsight(insight: CycleInsight): Promise<void> {
    const all = await this.loadAllInsights();
    all.push(insight);
    // Keep last 20 insights
    const trimmed = all.slice(-20);
    await set(this.storageKey, trimmed);
  }

  private async loadAllInsights(): Promise<CycleInsight[]> {
    try {
      const data = await get<CycleInsight[]>(this.storageKey);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ProactiveMonitor
// ─────────────────────────────────────────────────────────────

interface MonitorMetrics {
  tokenBudgetPercent: number;
  memoryUsageMB: number;
  serviceDegradation: number; // count of degraded services
  lastCheckTime: number;
}

class ProactiveMonitor {
  private lastCheckTime = 0;
  private checkIntervalMs = 5 * 60 * 1000; // 5 min
  private metrics: MonitorMetrics = {
    tokenBudgetPercent: 0,
    memoryUsageMB: 0,
    serviceDegradation: 0,
    lastCheckTime: 0,
  };

  /**
   * Poll system metrics & issue interventions:
   * - Token budget >80% → auto-compress context
   * - Memory >800MB → auto-gc
   * - Service degradation → reduce parallelization
   */
  async check(): Promise<{ shouldCompress: boolean; shouldGC: boolean; reduceParallelization: boolean }> {
    const now = Date.now();
    if (now - this.lastCheckTime < this.checkIntervalMs) {
      return { shouldCompress: false, shouldGC: false, reduceParallelization: false };
    }

    this.lastCheckTime = now;
    const actions = { shouldCompress: false, shouldGC: false, reduceParallelization: false };

    // Token usage check
    const tokenInfo = tokenTracker.getSnapshot();
    const tokenPercent = (tokenInfo.sessionTotal / 100_000) * 100;
    if (tokenPercent > 80) {
      actions.shouldCompress = true;
    }

    // Memory check (estimated via IndexedDB size or performance.memory if available)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memMB = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
      if (memMB > 800) {
        actions.shouldGC = true;
      }
    }

    // Service health check
    const health = healthMonitor.getSnapshot();
    const degradedCount = Object.values(health).filter(s => s.status === 'degraded').length;
    if (degradedCount > 1) {
      actions.reduceParallelization = true;
    }

    const memMB = typeof performance !== 'undefined' && (performance as any).memory
      ? (performance as any).memory.usedJSHeapSize / 1024 / 1024
      : 0;

    this.metrics = {
      tokenBudgetPercent: tokenPercent,
      memoryUsageMB: memMB,
      serviceDegradation: degradedCount,
      lastCheckTime: now,
    };

    return actions;
  }

  getMetrics(): MonitorMetrics {
    return { ...this.metrics };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton exports
// ─────────────────────────────────────────────────────────────

export const autonomyManager = new AutonomyManager();
export const selfImprovementAgent = new SelfImprovementAgent();
export const proactiveMonitor = new ProactiveMonitor();
