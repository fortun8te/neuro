#!/usr/bin/env node
/**
 * Neuro Research CLI - Autonomous research loop mode
 * Run: npm run research [objective] [--options]
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { setupNodeEnvironment } from './utils/nodeAdapter';
import type { ResearchTask } from './utils/autonomousResearchLoop';

// Setup Node.js environment BEFORE any other imports
setupNodeEnvironment();

// Global execution log
let executionLog: any[] = [];
let totalTokensUsed = 0;

function logExecution(event: string, data: any): void {
  const logEntry: any = { timestamp: Date.now(), event, data };
  if (data?.inputTokens !== undefined) {
    totalTokensUsed += data.inputTokens + (data.outputTokens || 0) + (data.thinkingTokens || 0);
  }
  executionLog.push(logEntry);
}

function saveResearchResults(
  objective: string,
  finalResult: string,
  tracker: any,
  finalScore: number
): string {
  const downloadsPath = path.join(process.env.HOME || '/tmp', 'Downloads');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const slug = objective.substring(0, 40).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const resultsDir = path.join(downloadsPath, 'research-results', `general-research-${timestamp}-${slug}`);

  try {
    fs.mkdirSync(resultsDir, { recursive: true });
  } catch (error) {
    console.error('failed to create results dir:', error);
    return '';
  }

  try {
    fs.writeFileSync(path.join(resultsDir, 'data.json'), tracker.exportJSON(), 'utf-8');
    fs.writeFileSync(path.join(resultsDir, 'data.csv'), tracker.exportCSV(), 'utf-8');
    fs.writeFileSync(path.join(resultsDir, 'report.txt'), tracker.generateReport(), 'utf-8');
    fs.writeFileSync(path.join(resultsDir, 'chart.txt'), tracker.generateASCIIChart(), 'utf-8');
    fs.writeFileSync(path.join(resultsDir, 'findings.txt'), finalResult, 'utf-8');
    fs.writeFileSync(
      path.join(resultsDir, 'execution-log.json'),
      JSON.stringify(executionLog, null, 2),
      'utf-8'
    );

    const summary = {
      objective,
      timestamp: new Date().toISOString(),
      finalScore,
      resultsPath: resultsDir,
      executionEvents: executionLog.length,
      totalTokensUsed,
      files: {
        data: 'data.json',
        csv: 'data.csv',
        report: 'report.txt',
        chart: 'chart.txt',
        findings: 'findings.txt',
        executionLog: 'execution-log.json',
      },
    };

    fs.writeFileSync(
      path.join(resultsDir, 'SUMMARY.txt'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    );

    console.log(`\n  saved -> ${resultsDir}`);
    console.log(`  events: ${executionLog.length}  tokens: ${totalTokensUsed}`);
    return resultsDir;
  } catch (error) {
    console.error('failed to save results:', error);
    return '';
  }
}

interface ResearchConfig {
  defaults: {
    maxIterations: number;
    qualityThreshold: number;
    maxTimePerIteration: number;
    maxTokensPerIteration: number;
  };
  models: {
    evaluator: string;
    adjuster: string;
    researcher: string;
  };
  prompts: {
    evaluation: string;
    adjustment: string;
  };
  reporting: {
    showProgressChart: boolean;
    showDetailedReport: boolean;
    exportCSV: boolean;
    exportJSON: boolean;
    showIterationDetails: boolean;
  };
  ui: {
    showBanner: boolean;
    colorOutput: boolean;
    verboseLogging: boolean;
    updateFrequency: number;
  };
}

function loadConfig(): ResearchConfig {
  const configPath = path.join(process.cwd(), 'research-config.json');
  const defaultConfig: ResearchConfig = {
    defaults: {
      maxIterations: 10,
      qualityThreshold: 85,
      maxTimePerIteration: 60,
      maxTokensPerIteration: 5000,
    },
    models: {
      evaluator: 'qwen3.5:4b',
      adjuster: 'qwen3.5:4b',
      researcher: 'qwen3.5:9b',
    },
    prompts: {
      evaluation: 'strict',
      adjustment: 'strategic',
    },
    reporting: {
      showProgressChart: true,
      showDetailedReport: true,
      exportCSV: true,
      exportJSON: true,
      showIterationDetails: true,
    },
    ui: {
      showBanner: true,
      colorOutput: true,
      verboseLogging: false,
      updateFrequency: 1000,
    },
  };

  try {
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...defaultConfig, ...fileConfig };
    }
  } catch {
    console.warn('[config] failed to load config file, using defaults');
  }

  return defaultConfig;
}

function parseArgs(): Partial<ResearchConfig['defaults']> {
  const args = process.argv.slice(2);
  const options: Partial<ResearchConfig['defaults']> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--max-iterations' && args[i + 1]) {
      options.maxIterations = parseInt(args[++i]) || 10;
    } else if (arg === '--threshold' && args[i + 1]) {
      options.qualityThreshold = parseInt(args[++i]) || 85;
    } else if (arg === '--max-time' && args[i + 1]) {
      options.maxTimePerIteration = parseInt(args[++i]) || 60;
    } else if (arg === '--max-tokens' && args[i + 1]) {
      options.maxTokensPerIteration = parseInt(args[++i]) || 5000;
    }
  }

  return options;
}

function printBanner(config: ResearchConfig) {
  if (!config.ui.showBanner) return;
  process.stdout.write('\n  NEURO  research mode\n');
  process.stdout.write('  ' + '─'.repeat(38) + '\n\n');
}

function sectionHeader(title: string) {
  process.stdout.write(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}\n\n`);
}

function subsection(title: string) {
  process.stdout.write(`\n  ${title}\n  ${'─'.repeat(40)}\n`);
}

async function runInteractiveResearch(config: ResearchConfig, runAutonomousResearchLoop: any) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printBanner(config);

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    subsection('Research Objective');
    const objective = await question('  objective: ');

    if (!objective.trim()) {
      process.stdout.write('  no objective provided, exiting\n');
      rl.close();
      return;
    }

    subsection('Evaluation Criteria');
    process.stdout.write('  enter criteria (one per line, blank to finish):\n');
    const criteria: string[] = [];
    while (true) {
      const criterion = await question(`  ${criteria.length + 1}: `);
      if (!criterion.trim()) break;
      criteria.push(criterion);
    }

    if (criteria.length === 0) {
      process.stdout.write('  using default criteria\n');
      criteria.push('Covers main aspects of the topic');
      criteria.push('Information is recent and relevant');
      criteria.push('Multiple perspectives included');
      criteria.push('Sources are credible');
      criteria.push('Findings are actionable');
    }

    subsection('Configuration');
    const maxIterStr = await question(`  max iterations (default ${config.defaults.maxIterations}): `);
    const maxIterations = parseInt(maxIterStr) || config.defaults.maxIterations;

    const thresholdStr = await question(`  quality threshold 0-100 (default ${config.defaults.qualityThreshold}): `);
    const qualityThreshold = (parseInt(thresholdStr) || config.defaults.qualityThreshold) / 100;

    rl.close();

    const task: ResearchTask = {
      objective,
      evaluationCriteria: criteria,
      maxIterations,
      constraints: {
        maxTimePerIteration: config.defaults.maxTimePerIteration,
        qualityThreshold,
      },
    };

    sectionHeader('STARTING RESEARCH');

    let lastProgressTime = 0;
    const result = await runAutonomousResearchLoop(
      task,
      (tracker: any) => {
        const now = Date.now();
        if (now - lastProgressTime >= config.ui.updateFrequency) {
          const progress = tracker.getProgress();
          const bar = '█'.repeat(Math.floor(progress.totalIterations / 2));
          process.stdout.write(
            `\r  [${bar.padEnd(5)}] ${progress.totalIterations}/${task.maxIterations}  best:${progress.bestScore}/100   `
          );
          lastProgressTime = now;
        }
      },
      logExecution
    );

    process.stdout.write('\n');

    if (config.reporting.showDetailedReport) {
      sectionHeader('RESULTS');
      process.stdout.write(result.finalResult + '\n');
    }

    if (config.reporting.showProgressChart) {
      sectionHeader('PROGRESS CHART');
      process.stdout.write(result.tracker.generateASCIIChart() + '\n');
    }

    sectionHeader('COMPLETE');
    const progress = result.tracker.getProgress();
    process.stdout.write(`  score:     ${result.finalScore}/100\n`);
    process.stdout.write(`  iters:     ${progress.totalIterations}/${maxIterations}\n`);
    process.stdout.write(`  kept:      ${progress.keptIterations}\n`);
    process.stdout.write(`  elapsed:   ${progress.elapsedSeconds}s\n`);

    saveResearchResults(objective, result.finalResult, result.tracker, result.finalScore);

    process.stdout.write('\n');
  } catch (error) {
    console.error('[error]', error);
  }
}

async function runQuickResearch(
  objective: string,
  config: ResearchConfig,
  cliOptions: Partial<ResearchConfig['defaults']>,
  runAutonomousResearchLoop: any
) {
  printBanner(config);

  const mergedDefaults = { ...config.defaults, ...cliOptions };

  const task: ResearchTask = {
    objective,
    evaluationCriteria: [
      'Covers main aspects of the topic',
      'Information is recent and relevant',
      'Multiple perspectives included',
      'Sources are credible',
      'Findings are actionable',
    ],
    maxIterations: mergedDefaults.maxIterations,
    constraints: {
      maxTimePerIteration: mergedDefaults.maxTimePerIteration,
      qualityThreshold: mergedDefaults.qualityThreshold / 100,
    },
  };

  sectionHeader('STARTING RESEARCH');
  process.stdout.write(`  objective: ${objective}\n`);
  process.stdout.write(`  max iters: ${task.maxIterations}\n`);
  process.stdout.write(`  threshold: ${mergedDefaults.qualityThreshold}%\n\n`);

  let lastProgressTime = 0;
  const result = await runAutonomousResearchLoop(
    task,
    (tracker: any) => {
      const now = Date.now();
      if (now - lastProgressTime >= config.ui.updateFrequency) {
        const progress = tracker.getProgress();
        const bar = '█'.repeat(Math.floor(progress.totalIterations / 2));
        process.stdout.write(
          `\r  [${bar.padEnd(5)}] ${progress.totalIterations}/${task.maxIterations}  best:${progress.bestScore}/100   `
        );
        lastProgressTime = now;
      }
    },
    logExecution
  );

  process.stdout.write('\n');

  if (config.reporting.showDetailedReport) {
    sectionHeader('RESULTS');
    process.stdout.write(result.finalResult + '\n');
  }

  if (config.reporting.showProgressChart) {
    sectionHeader('PROGRESS CHART');
    process.stdout.write(result.tracker.generateASCIIChart() + '\n');
  }

  sectionHeader('COMPLETE');
  const progress = result.tracker.getProgress();
  process.stdout.write(`  score:     ${result.finalScore}/100\n`);
  process.stdout.write(`  iters:     ${progress.totalIterations}/${task.maxIterations}\n`);
  process.stdout.write(`  kept:      ${progress.keptIterations}\n`);
  process.stdout.write(`  discarded: ${progress.discardedIterations}\n`);
  process.stdout.write(`  elapsed:   ${progress.elapsedSeconds}s\n\n`);

  saveResearchResults(objective, result.finalResult, result.tracker, result.finalScore);
}

async function main() {
  const { runAutonomousResearchLoop } = await import('./utils/autonomousResearchLoop');

  const config = loadConfig();
  const cliOptions = parseArgs();
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

  if (args.length > 0 && !args[0].startsWith('--')) {
    await runQuickResearch(args.join(' '), config, cliOptions, runAutonomousResearchLoop).catch(
      console.error
    );
  } else {
    await runInteractiveResearch(config, runAutonomousResearchLoop).catch(console.error);
  }
}

main();
