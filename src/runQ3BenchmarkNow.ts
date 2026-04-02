#!/usr/bin/env node
/**
 * Q3 Benchmark Runner
 *
 * Simple executable script to run the complete benchmark:
 *   npx ts-node src/runQ3BenchmarkNow.ts "campaign title" "campaign brief"
 *
 * Features:
 *   - Infrastructure health checks before startup
 *   - Real-time progress display with live updates
 *   - Automatic report generation (Markdown + JSON)
 *   - Clean exit on completion
 *   - Error recovery with detailed logs
 */

import { config as loadDotenv } from 'dotenv';
import { resolve, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

// Load environment
loadDotenv({ path: resolve(process.cwd(), '.env') });

// Browser shims
if (typeof globalThis.indexedDB === 'undefined') {
  (globalThis as any).indexedDB = {
    open: () => ({ addEventListener: () => {}, onsuccess: null, onerror: null }),
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

import { setupNodeEnvironment } from './utils/nodeAdapter';
import { runQ3Benchmark, logger } from './q3BenchmarkHarness';
import type { BenchmarkConfig } from './q3BenchmarkHarness';
import { MetricsCalculator, MetricsFormatter } from './q3BenchmarkMetrics';
import { BenchmarkReportGenerator } from './q3BenchmarkReport';

setupNodeEnvironment();

// ─────────────────────────────────────────────────────────────
// CLI Interface
// ─────────────────────────────────────────────────────────────

interface CLIArgs {
  campaignTitle: string;
  campaignBrief: string;
  maxIterations?: number;
  maxSources?: number;
  enableVisualScouting?: boolean;
  qualityGate?: number;
  previousScore?: number;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  return {
    campaignTitle: args[0],
    campaignBrief: args[1],
    maxIterations: parseInt(args[2] || '100'),
    maxSources: parseInt(args[3] || '400'),
    enableVisualScouting: args[4] !== 'false',
    qualityGate: parseFloat(args[5] || '70'),
    previousScore: args[6] ? parseFloat(args[6]) : undefined,
  };
}

function printUsage() {
  console.log(`
Usage: npx ts-node src/runQ3BenchmarkNow.ts [options]

Arguments:
  <title>              Campaign title (required)
  <brief>              Campaign brief/description (required)
  [iterations]         Max research iterations (default: 100)
  [sources]            Max sources per iteration (default: 400)
  [visual]             Enable visual scouting (default: true)
  [quality-gate]       Quality threshold (default: 70)
  [prev-score]         Previous benchmark score for comparison

Examples:
  npx ts-node src/runQ3BenchmarkNow.ts "Collagen Supplements" "15K-25K word atlas"
  npx ts-node src/runQ3BenchmarkNow.ts "Skincare" "Product comparison guide" 150 500 true 75 7.8
`);
}

// ─────────────────────────────────────────────────────────────
// Progress Display
// ─────────────────────────────────────────────────────────────

class ProgressDisplay {
  private startTime = Date.now();
  private lastUpdate = Date.now();
  private updateInterval = 1000; // 1 second

  shouldUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdate >= this.updateInterval) {
      this.lastUpdate = now;
      return true;
    }
    return false;
  }

  displayPhaseProgress(phase: string, progress: number, max: number) {
    const percent = Math.round((progress / max) * 100);
    const bar = this.progressBar(progress / max, 40);
    const elapsed = this.formatElapsed(Date.now() - this.startTime);

    process.stdout.write(
      `\r  ${phase.padEnd(30)} ${bar} ${percent}% | ${elapsed}`
    );
  }

  displayPhaseComplete(phase: string, metrics: Record<string, any>) {
    const elapsed = this.formatElapsed(Date.now() - this.startTime);
    console.log(`\n  ✓ ${phase} — ${JSON.stringify(metrics)} (${elapsed})`);
  }

  displayError(message: string) {
    console.error(`\n  ✗ ERROR: ${message}`);
  }

  private progressBar(percent: number, width: number): string {
    const filled = Math.round(percent * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  private formatElapsed(ms: number): string {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}m ${s}s`;
  }
}

const display = new ProgressDisplay();

// ─────────────────────────────────────────────────────────────
// Report Saving
// ─────────────────────────────────────────────────────────────

function ensureOutputDir(): string {
  const outputDir = join(process.cwd(), 'benchmarks');
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    // Directory already exists
  }
  return outputDir;
}

function saveReport(
  benchmarkId: string,
  result: any,
  metricsReport: any,
  report: any
): void {
  const outputDir = ensureOutputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  // Save JSON result
  const jsonPath = join(outputDir, `${timestamp}-result.json`);
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\n  Saved JSON result: ${jsonPath}`);

  // Save metrics report
  const metricsPath = join(outputDir, `${timestamp}-metrics.json`);
  const metricsForSerialization = {
    ...metricsReport,
    improvementDimensions: Object.fromEntries(metricsReport.comparison.improvementDimensions),
    regressions: Object.fromEntries(metricsReport.comparison.regressions),
    dimensions: metricsReport.dimensions.map((d: any) => ({
      name: d.name,
      score: d.score,
      maxScore: d.maxScore,
      weight: d.weight,
      description: d.description,
    })),
  };
  writeFileSync(metricsPath, JSON.stringify(metricsForSerialization, null, 2));
  console.log(`  Saved metrics: ${metricsPath}`);

  // Save markdown report
  const mdPath = join(outputDir, `${timestamp}-report.md`);
  writeFileSync(mdPath, report.markdown);
  console.log(`  Saved report: ${mdPath}`);
}

// ─────────────────────────────────────────────────────────────
// Main Execution
// ─────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  console.log('\n');
  console.log('  ╔════════════════════════════════════════════╗');
  console.log('  ║     Q3 BENCHMARK EXECUTOR — v1.0          ║');
  console.log('  ║   All Phase 10 Improvements Enabled        ║');
  console.log('  ╚════════════════════════════════════════════╝\n');

  console.log(`  Campaign: ${args.campaignTitle}`);
  console.log(`  Brief: ${args.campaignBrief.slice(0, 50)}...`);
  console.log(`  Research Preset: MAXIMUM (${args.maxIterations} iterations, ${args.maxSources}+ sources)`);
  console.log('\n');

  const config: BenchmarkConfig = {
    campaignTitle: args.campaignTitle,
    campaignBrief: args.campaignBrief,
    maxResearchIterations: args.maxIterations || 100,
    maxSourcesPerIteration: args.maxSources || 400,
    enableVisualScouting: args.enableVisualScouting !== false,
    qualityGateThreshold: args.qualityGate || 70,
    verifyFixLoopsMax: 5,
    checkpointInterval: 60000, // 1 minute
    timeoutMinutes: 360, // 6 hours
  };

  try {
    // Run benchmark
    console.log('  Starting benchmark...\n');
    const result = await runQ3Benchmark(config);

    // Generate metrics
    console.log('\n  Generating metrics report...');
    const calculator = new MetricsCalculator(result);
    const metricsReport = calculator.generateReport(args.previousScore);

    // Display formatted metrics
    const metricsFormatted = MetricsFormatter.formatConsole(metricsReport);
    console.log(metricsFormatted);

    // Generate report
    console.log('  Generating benchmark report...');
    const reportGenerator = new BenchmarkReportGenerator(result, metricsReport);
    const report = reportGenerator.generateReport(args.previousScore);

    // Save all reports
    saveReport(result.campaignId, result, metricsReport, report);

    // Summary
    console.log('\n  ╔════════════════════════════════════════════╗');
    console.log('  ║         BENCHMARK COMPLETE                 ║');
    console.log('  ╚════════════════════════════════════════════╝\n');
    console.log(`  Overall Score: ${result.overallQualityScore.toFixed(2)}/10`);
    console.log(`  Production Readiness: ${result.productionReadiness}`);
    console.log(`  Total Time: ${(result.elapsedMs / 1000).toFixed(1)}s`);

    if (args.previousScore) {
      const improvement = result.overallQualityScore - args.previousScore;
      const percent = (improvement / args.previousScore * 100).toFixed(1);
      console.log(`  Improvement: +${improvement.toFixed(2)} points (+${percent}%)`);
    }

    console.log('\n  All reports saved to ./benchmarks/\n');
    process.exit(0);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n  BENCHMARK FAILED: ${message}\n`);
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error(`\nFatal error: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
