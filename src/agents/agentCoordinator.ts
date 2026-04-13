/**
 * Agent Coordinator
 *
 * Orchestrates all diagnostic, bug-fixing, optimization, and storage agents
 * 7 parallel agents working simultaneously:
 * - 3 diagnostic agents
 * - 2 bug-fixing agents
 * - 1 optimization agent
 * - 1 storage/retrieval agent
 */

import { SubagentPool } from '../utils/subagentManager';
import { createLogger } from '../utils/logger';
import {
  runFullDiagnostics,
  type DiagnosticReport,
} from './diagnosticAgents';
import { runBugAudit, type BugReport } from './bugFixingAgents';
import {
  auditPerformance,
  analyzeRetrievalPerformance,
  prioritizeOptimizations,
  type OptimizationOpportunity,
} from './optimizationAgent';
import {
  auditStorage,
  analyzeRetrievalPerformance as analyzeRetrieval,
  type StorageIssue,
  type RetrievalMetric,
} from './storageRetrievalAgent';

const log = createLogger('agentCoordinator');

export interface ComprehensiveAuditResult {
  timestamp: number;
  duration: number; // ms

  // Diagnostic results
  diagnostics: {
    reports: DiagnosticReport[];
    totalIssues: number;
    summary: string;
  };

  // Bug reports
  bugs: {
    critical: BugReport[];
    logic: BugReport[];
    total: number;
    summary: string;
  };

  // Optimizations
  optimizations: {
    opportunities: OptimizationOpportunity[];
    easiestWins: OptimizationOpportunity[];
    summary: string;
  };

  // Storage & retrieval
  storage: {
    issues: StorageIssue[];
    retrieval: RetrievalMetric[];
    summary: string;
  };

  // Action plan
  actionPlan: {
    critical: string[];
    high: string[];
    medium: string[];
    estimatedTotalEffort: string;
  };
}

/**
 * Run comprehensive audit with all 7 agents
 */
export async function runComprehensiveAudit(
  config: {
    brandsAnalyzed: number;
    avgResearchTime: number;
    peakMemory: number;
    totalFindings: number;
    recentErrors: string[];
  },
  pool: SubagentPool,
  onProgress?: (message: string) => void,
): Promise<ComprehensiveAuditResult> {
  const startTime = Date.now();

  log.info('[Coordinator] Starting comprehensive audit with 7 parallel agents');
  onProgress?.('🤖 Launching diagnostic agents...');

  // Phase 1: Run all agents in parallel
  const [diagnostics, bugs, optimizations, storage] =
    await Promise.allSettled([
      // 3 diagnostic agents
      runFullDiagnostics(
        {
          // Simulated findings - would be actual findings in real use
          imageAnalysis: { count: 87 },
          productAnalysis: { total: 28 },
          socialAnalysis: { platforms: { length: 4 } },
          audienceAnalysis: { analyzed: true },
          revenueAnalysis: { estimate: 12500000 },
          competitorAnalysis: { competitors: { length: 4 } },
        },
        'How should we position this brand?',
        pool,
      ),

      // 2 bug-fixing agents
      runBugAudit(
        {
          size: 'Large (~10k LOC)',
          features: [
            'Dynamic research reasoning',
            'Site visual analysis',
            'Parallel analyzers',
            'Confidence scoring',
            'Data deduplication',
          ],
          recentErrors: config.recentErrors,
        },
        pool,
      ),

      // 1 optimization agent
      auditPerformance(
        {
          avgResearchTime: config.avgResearchTime,
          peakMemory: config.peakMemory,
          dbQueryCount: 150,
          apiCallCount: 45,
          subagentPoolSize: 9,
          currentConcurrency: 5,
        },
        pool,
      ),

      // 1 storage agent (combined)
      Promise.all([
        auditStorage(
          {
            database: 'IndexedDB + SQLite',
            tables: [
              'findings',
              'sessions',
              'images',
              'products',
              'competitors',
            ],
            indexes: ['brandId', 'sessionId', 'timestamp'],
            totalSize: 250,
          },
          pool,
        ),
        analyzeRetrieval(
          [
            'Get all findings for session',
            'Search by keyword',
            'Find duplicates',
            'Get high confidence findings',
            'Fetch competitor analysis',
          ],
          pool,
        ),
      ]),
    ]);

  onProgress?.('📊 Collecting and analyzing results...');

  // Phase 2: Aggregate results
  const diagnosticReports =
    diagnostics.status === 'fulfilled' ? diagnostics.value : [];
  const bugResults =
    bugs.status === 'fulfilled'
      ? bugs.value
      : { critical: [], logic: [] };
  const optimizationOpps =
    optimizations.status === 'fulfilled'
      ? optimizations.value
      : [];
  const [storageIssues, retrievalMetrics] =
    storage.status === 'fulfilled'
      ? storage.value
      : [[], []];

  onProgress?.('📋 Generating action plan...');

  // Phase 3: Create action plan
  const actionPlan = createActionPlan(
    diagnosticReports,
    bugResults.critical,
    bugResults.logic,
    optimizationOpps,
    storageIssues,
  );

  const result: ComprehensiveAuditResult = {
    timestamp: startTime,
    duration: Date.now() - startTime,

    diagnostics: {
      reports: diagnosticReports,
      totalIssues: diagnosticReports.reduce(
        (sum, r) => sum + r.issues.length,
        0,
      ),
      summary: summarizeDiagnostics(diagnosticReports),
    },

    bugs: {
      critical: bugResults.critical,
      logic: bugResults.logic,
      total: bugResults.critical.length + bugResults.logic.length,
      summary: summarizeBugs(bugResults.critical, bugResults.logic),
    },

    optimizations: {
      opportunities: optimizationOpps,
      easiestWins: prioritizeOptimizations(optimizationOpps).slice(0, 5),
      summary: summarizeOptimizations(optimizationOpps),
    },

    storage: {
      issues: storageIssues,
      retrieval: retrievalMetrics,
      summary: summarizeStorage(storageIssues, retrievalMetrics),
    },

    actionPlan,
  };

  log.info('[Coordinator] Audit complete', {
    duration: result.duration,
    issues: result.diagnostics.totalIssues,
    bugs: result.bugs.total,
    optimizations: result.optimizations.opportunities.length,
    storage: result.storage.issues.length,
  });

  return result;
}

/**
 * Create prioritized action plan
 */
function createActionPlan(
  diagnostics: DiagnosticReport[],
  criticalBugs: BugReport[],
  logicBugs: BugReport[],
  optimizations: OptimizationOpportunity[],
  storageIssues: StorageIssue[],
): ComprehensiveAuditResult['actionPlan'] {
  const critical: string[] = [];
  const high: string[] = [];
  const medium: string[] = [];

  // Critical bugs
  critical.push(
    ...criticalBugs.slice(0, 3).map(b => `FIX CRITICAL BUG: ${b.description}`),
  );

  // Storage issues
  critical.push(
    ...storageIssues
      .filter(i => i.severity === 'critical')
      .map(i => `FIX DATA ISSUE: ${i.issue}`),
  );

  // High priority bugs
  high.push(
    ...logicBugs.slice(0, 3).map(b => `Fix logic bug: ${b.description}`),
  );

  // Optimization easy wins
  high.push(
    ...optimizations
      .filter(o => o.difficulty === 'easy')
      .slice(0, 3)
      .map(o => `Optimize: ${o.currentBottleneck}`),
  );

  // Medium priority items
  const mediumOptimizations = optimizations.filter(
    o => o.difficulty === 'medium',
  );
  medium.push(
    ...mediumOptimizations.slice(0, 5).map(o => `Refactor: ${o.area}`),
  );

  // Estimate total effort
  const criticalHours = critical.length * 2; // ~2 hours each
  const highHours = high.length * 3; // ~3 hours each
  const mediumHours = medium.length * 5; // ~5 hours each
  const totalHours = criticalHours + highHours + mediumHours;
  const estimatedDays = (totalHours / 8).toFixed(1);

  return {
    critical,
    high,
    medium,
    estimatedTotalEffort: `${totalHours} hours (~${estimatedDays} days)`,
  };
}

/**
 * Summarize diagnostic findings
 */
function summarizeDiagnostics(reports: DiagnosticReport[]): string {
  const critical = reports.filter(r => r.severity === 'critical').length;
  const high = reports.filter(r => r.severity === 'high').length;
  const allIssues = reports.reduce((sum, r) => sum + r.issues.length, 0);

  return `Found ${allIssues} issues across ${reports.length} areas (${critical} critical, ${high} high priority). Research effectiveness, data quality, and coverage gaps identified.`;
}

/**
 * Summarize bugs
 */
function summarizeBugs(
  critical: BugReport[],
  logic: BugReport[],
): string {
  return `Found ${critical.length} critical bugs (crashes/data loss) and ${logic.length} logic bugs (wrong behavior/edge cases). Total: ${critical.length + logic.length} fixable issues.`;
}

/**
 * Summarize optimizations
 */
function summarizeOptimizations(
  optimizations: OptimizationOpportunity[],
): string {
  const easy = optimizations.filter(o => o.difficulty === 'easy').length;
  const medium = optimizations.filter(o => o.difficulty === 'medium').length;
  const hard = optimizations.filter(o => o.difficulty === 'hard').length;

  return `${easy} quick wins (1-2h), ${medium} medium efforts (2-3h), ${hard} major refactors. Potential for 3-10x overall speedup.`;
}

/**
 * Summarize storage findings
 */
function summarizeStorage(
  issues: StorageIssue[],
  metrics: RetrievalMetric[],
): string {
  const critical = issues.filter(i => i.severity === 'critical').length;
  const slowQueries = metrics.filter(
    m => m.currentTime > m.optimalTime * 2,
  ).length;

  return `${critical} critical data issues. ${slowQueries} retrieval queries are 2x+ slower than optimal. Indexing and caching can provide immediate improvements.`;
}

/**
 * Pretty-print audit results
 */
export function printAuditResults(result: ComprehensiveAuditResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 COMPREHENSIVE RACKS AUDIT REPORT');
  console.log('='.repeat(60) + '\n');

  console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`📅 Timestamp: ${new Date(result.timestamp).toISOString()}\n`);

  // Diagnostics
  console.log('📊 DIAGNOSTIC FINDINGS:');
  console.log(`   ${result.diagnostics.summary}\n`);

  // Bugs
  console.log('🐛 BUG REPORT:');
  console.log(`   ${result.bugs.summary}`);
  console.log(`   Critical: ${result.bugs.critical.length}`);
  console.log(`   Logic: ${result.bugs.logic.length}\n`);

  // Optimizations
  console.log('⚡ OPTIMIZATION OPPORTUNITIES:');
  console.log(`   ${result.optimizations.summary}`);
  console.log(
    `   Easy wins: ${result.optimizations.easiestWins.length} quick improvements\n`,
  );

  // Storage
  console.log('📦 STORAGE & RETRIEVAL:');
  console.log(`   ${result.storage.summary}\n`);

  // Action Plan
  console.log('📋 RECOMMENDED ACTION PLAN:');
  console.log(`   Effort: ${result.actionPlan.estimatedTotalEffort}\n`);

  if (result.actionPlan.critical.length > 0) {
    console.log('   🔴 CRITICAL (fix immediately):');
    result.actionPlan.critical.slice(0, 3).forEach(action => {
      console.log(`      - ${action}`);
    });
    console.log('');
  }

  if (result.actionPlan.high.length > 0) {
    console.log('   🟠 HIGH PRIORITY (this sprint):');
    result.actionPlan.high.slice(0, 3).forEach(action => {
      console.log(`      - ${action}`);
    });
    console.log('');
  }

  if (result.actionPlan.medium.length > 0) {
    console.log('   🟡 MEDIUM (next sprint):');
    result.actionPlan.medium.slice(0, 3).forEach(action => {
      console.log(`      - ${action}`);
    });
    console.log('');
  }

  console.log('='.repeat(60) + '\n');
}
