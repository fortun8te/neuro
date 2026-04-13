/**
 * Run Comprehensive Agent Audit
 *
 * Deploys all 7 agents to diagnose and fix RACKS issues:
 * - 3 diagnostic agents (effectiveness, quality, coverage)
 * - 2 bug-fixing agents (critical + logic bugs)
 * - 1 optimization agent (performance)
 * - 1 storage agent (database + retrieval)
 */

import { SubagentPool } from '../utils/subagentManager';
import {
  runComprehensiveAudit,
  printAuditResults,
} from '../agents/agentCoordinator';

export async function runFullAgentAudit() {
  console.log('🤖 RACKS COMPREHENSIVE AUDIT');
  console.log('Deploying 7 parallel agents...\n');

  const pool = new SubagentPool(9); // Support up to 9 concurrent agents

  try {
    const result = await runComprehensiveAudit(
      {
        brandsAnalyzed: 12,
        avgResearchTime: 45000, // 45 seconds
        peakMemory: 850, // 850 MB
        totalFindings: 2847,
        recentErrors: [
          'Vision model timeout on large images',
          'Deduplication incomplete for similar facts',
          'Confidence scoring too conservative',
          'Revenue estimation missing key data points',
          'Social analysis incomplete for emerging platforms',
        ],
      },
      pool,
      (message) => {
        console.log(`  📢 ${message}`);
      },
    );

    // Pretty print results
    printAuditResults(result);

    // Export detailed JSON for further analysis
    console.log('\n📄 DETAILED AUDIT DATA (JSON):');
    console.log(JSON.stringify(result, null, 2).slice(0, 1000) + '...\n');

    // Summary
    console.log('✅ AUDIT COMPLETE - NEXT STEPS:');
    console.log('\n1. Address critical bugs (${result.bugs.critical.length} items, ~' +
      (result.bugs.critical.length * 2) +
      ' hours)');
    console.log('2. Fix logic bugs (${result.bugs.logic.length} items)');
    console.log('3. Apply easy optimizations (${result.optimizations.easiestWins.length} wins, ~1-2 hours)');
    console.log('4. Fix storage/index issues (${result.storage.issues.length} items)');
    console.log('\nTotal estimated effort: ${result.actionPlan.estimatedTotalEffort}');

    return result;
  } catch (error) {
    console.error(
      '❌ Audit failed:',
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/**
 * Run just diagnostic agents (fast)
 */
export async function runDiagnosticsOnly() {
  console.log('🔍 RACKS DIAGNOSTICS');
  console.log('Running 3 diagnostic agents...\n');

  const pool = new SubagentPool(9);
  const { runFullDiagnostics } = await import('../agents/diagnosticAgents');

  try {
    const reports = await runFullDiagnostics(
      {
        // Would be actual findings
        imageAnalysis: { count: 87 },
        productAnalysis: { total: 28 },
        socialAnalysis: { platforms: { length: 4 } },
      },
      'How to position this brand?',
      pool,
    );

    console.log('📊 DIAGNOSTIC RESULTS:');
    reports.forEach(report => {
      console.log(`\n${report.agent} (${report.severity}):`);
      console.log(`  Issues: ${report.issues.length}`);
      report.issues.slice(0, 3).forEach(issue => {
        console.log(`    - ${issue}`);
      });
    });

    return reports;
  } catch (error) {
    console.error(
      '❌ Diagnostics failed:',
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/**
 * Run just bug audit (2 agents)
 */
export async function runBugAuditOnly() {
  console.log('🐛 RACKS BUG AUDIT');
  console.log('Running 2 bug-fixing agents...\n');

  const pool = new SubagentPool(9);
  const { runBugAudit } = await import('../agents/bugFixingAgents');

  try {
    const result = await runBugAudit(
      {
        size: 'Large (~10k LOC)',
        features: [
          'Dynamic research reasoning',
          'Site visual analysis',
          'Parallel analyzers',
        ],
        recentErrors: [
          'Vision model timeout',
          'Confidence scoring',
          'Data deduplication',
        ],
      },
      pool,
    );

    console.log('🔴 CRITICAL BUGS:');
    result.critical.slice(0, 5).forEach((bug, i) => {
      console.log(`\n${i + 1}. ${bug.description}`);
      console.log(`   Location: ${bug.location}`);
      console.log(`   Fix: ${bug.fix}`);
    });

    console.log('\n🟠 LOGIC BUGS:');
    result.logic.slice(0, 5).forEach((bug, i) => {
      console.log(`\n${i + 1}. ${bug.description}`);
      console.log(`   Location: ${bug.location}`);
      console.log(`   Fix: ${bug.fix}`);
    });

    console.log(`\nTotal bugs found: ${result.critical.length + result.logic.length}`);

    return result;
  } catch (error) {
    console.error(
      '❌ Bug audit failed:',
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/**
 * Run just optimization audit
 */
export async function runOptimizationAudit() {
  console.log('⚡ RACKS OPTIMIZATION AUDIT');
  console.log('Running 1 optimization agent...\n');

  const pool = new SubagentPool(9);
  const {
    auditPerformance,
    prioritizeOptimizations,
  } = await import('../agents/optimizationAgent');

  try {
    const opportunities = await auditPerformance(
      {
        avgResearchTime: 45000,
        peakMemory: 850,
        dbQueryCount: 150,
        apiCallCount: 45,
        subagentPoolSize: 9,
        currentConcurrency: 5,
      },
      pool,
    );

    const prioritized = prioritizeOptimizations(opportunities);

    console.log('⚡ TOP OPTIMIZATION OPPORTUNITIES:\n');
    prioritized.slice(0, 10).forEach((opp, i) => {
      console.log(
        `${i + 1}. [${opp.difficulty.toUpperCase()}] ${opp.currentBottleneck}`,
      );
      console.log(`   Expected: ${opp.expectedImprovement}`);
      console.log(`   ROI: ${opp.estimatedROI}`);
      console.log(`   Effort: ${opp.effort}\n`);
    });

    return prioritized;
  } catch (error) {
    console.error(
      '❌ Optimization audit failed:',
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/**
 * Run just storage audit
 */
export async function runStorageAudit() {
  console.log('📦 RACKS STORAGE & RETRIEVAL AUDIT');
  console.log('Running 1 storage agent...\n');

  const pool = new SubagentPool(9);
  const { auditStorage } = await import('../agents/storageRetrievalAgent');

  try {
    const issues = await auditStorage(
      {
        database: 'IndexedDB + SQLite',
        tables: ['findings', 'sessions', 'images', 'products', 'competitors'],
        indexes: ['brandId', 'sessionId', 'timestamp'],
        totalSize: 250,
      },
      pool,
    );

    console.log('📊 STORAGE ISSUES:\n');
    issues.slice(0, 10).forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity.toUpperCase()}] ${issue.component}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Solution: ${issue.solution}\n`);
    });

    console.log(`Total issues: ${issues.length}`);

    return issues;
  } catch (error) {
    console.error(
      '❌ Storage audit failed:',
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runFullAgentAudit().catch(console.error);
}
