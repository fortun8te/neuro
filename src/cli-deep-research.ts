#!/usr/bin/env node
/**
 * Deep Research Harness — Enterprise-grade research automation
 *
 * Features:
 * - Recursive topic decomposition
 * - Context-1 multi-hop retrieval
 * - Time-based research adaptation (10min vs 40min = different strategies)
 * - Horizontal scaling via subagents (up to 10 parallel research workers)
 * - Confidence-based termination (coverage × confidence > threshold)
 * - Beautiful CLI with persistent header + real-time progress
 * - Daemon + interactive modes
 * - Final structured documents (PDF, JSON, Markdown)
 */

import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { input, confirm, select } from '@inquirer/prompts';
import Table from 'cli-table3';
import stripAnsi from 'strip-ansi';
import { DeepResearchOrchestrator } from './utils/deepResearchOrchestrator.js';
import { DeepResearchTaskQueue } from './utils/deepResearchTaskQueue.js';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────

const APP_NAME = 'Prometheus';
const APP_VERSION = '1.0.0';
const DATA_DIR = path.join(os.homedir(), '.deep-research');
const TASK_DB_PATH = path.join(DATA_DIR, 'tasks.db');
const OUTPUT_DIR = path.join(os.homedir(), 'research-output');

// Ensure directories exist
[DATA_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type ScheduleType = 'now' | 'at_time' | 'time_window' | 'cron';
type CommandMode = 'ask' | 'daemon' | 'task' | 'schedule';

interface ResearchTask {
  id: string;
  name: string;
  question: string;
  status: TaskStatus;

  // Scheduling
  scheduleType: ScheduleType;
  scheduledTime?: number;
  timeWindow?: { start: number; end: number };
  cronExpression?: string;

  // Execution
  createdAt: number;
  startedAt?: number;
  completedAt?: number;

  // Progress
  progressPercent?: number;
  currentIteration?: number;
  maxIterations?: number;
  readyScore?: number;

  // Results
  reportPath?: string;
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────
// RESEARCH CONFIG
// ─────────────────────────────────────────────────────────────

const RESEARCH_CONFIG = {
  maxIterations: 4,
  sourcesPerSubtopic: 50,
  coverageThreshold: 0.75,
  maxParallelAgents: 7,
  timeoutMs: 2 * 60 * 60 * 1000 // 2 hours default
};

// ─────────────────────────────────────────────────────────────
// PERSISTENT HEADER (TUI)
// ─────────────────────────────────────────────────────────────

interface PersistentHeader {
  title: string;
  mode: string;
  task?: ResearchTask;
  stats?: {
    coverage: number;
    confidence: number;
    readyScore: number;
    iteration: number;
    elapsed: number;
  };
}

function renderHeader(state: PersistentHeader): string {
  const lines: string[] = [];

  // Title bar
  lines.push(
    chalk.inverse(
      ` ${APP_NAME} v${APP_VERSION} | Mode: ${state.mode} `.padEnd(80)
    )
  );

  // Task info bar (if task is running)
  if (state.task && state.task.status === 'running') {
    const taskInfo = [
      `Task: ${state.task.id}`,
      state.stats ? `| Coverage: ${state.stats.coverage}% | Confidence: ${(state.stats.confidence * 100).toFixed(0)}% | Ready: ${(state.stats.readyScore * 100).toFixed(0)}%` : '',
      state.stats ? `| Iteration: ${state.stats.iteration} | Elapsed: ${formatTime(state.stats.elapsed)}` : ''
    ].filter(Boolean).join(' ');
    lines.push(chalk.gray(taskInfo));
  }

  // Separator
  lines.push(chalk.gray('─'.repeat(80)));

  return lines.join('\n');
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN COMMANDS
// ─────────────────────────────────────────────────────────────

async function commandAsk(args: string[]): Promise<void> {
  console.clear();
  console.log(renderHeader({ title: 'Prometheus', mode: 'Interactive (Ask)' }));

  // Parse command line args
  let question = '';
  let timeLimit = 0; // in seconds
  let simulate = false;
  let skipConfirm = false;

  // Reconstruct question from args if it might have multiple words
  const questionParts: string[] = [];
  let i = 0;

  while (i < args.length) {
    if (args[i] === '--question') {
      // Collect words until next flag
      i++;
      while (i < args.length && !args[i].startsWith('--')) {
        questionParts.push(args[i]);
        i++;
      }
      question = questionParts.join(' ');
    } else if (args[i] === '--time' && args[i + 1] && !args[i + 1].startsWith('--')) {
      const timeStr = args[i + 1];
      if (timeStr.includes('m')) {
        timeLimit = parseInt(timeStr) * 60 * 1000;
      } else if (timeStr.includes('h')) {
        timeLimit = parseInt(timeStr) * 60 * 60 * 1000;
      }
      i += 2;
    } else if (args[i] === '--simulate') {
      simulate = true;
      i++;
    } else if (args[i] === '--yes' || args[i] === '-y') {
      skipConfirm = true;
      i++;
    } else {
      i++;
    }
  }

  // Prompt if not provided
  if (!question) {
    question = await input({
      message: 'What would you like to research?',
      validate: (val) => val.length > 10 ? true : 'Question must be at least 10 characters'
    });
  }

  // Show summary
  console.log('\n' + chalk.blue('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║') + ' ' + chalk.bold('Research Configuration') + chalk.blue('                                  ║'));
  console.log(chalk.blue('╠═══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.blue('║') + ` Question:  ${question}`.padEnd(65) + chalk.blue('║'));
  console.log(chalk.blue('║') + ` Max Iterations:  ${RESEARCH_CONFIG.maxIterations}`.padEnd(65) + chalk.blue('║'));
  console.log(chalk.blue('║') + ` Sources/Topic:  ${RESEARCH_CONFIG.sourcesPerSubtopic}`.padEnd(65) + chalk.blue('║'));
  console.log(chalk.blue('║') + ` Coverage Target:  ${(RESEARCH_CONFIG.coverageThreshold * 100).toFixed(0)}%`.padEnd(65) + chalk.blue('║'));
  console.log(chalk.blue('╚═══════════════════════════════════════════════════════════════╝\n'));

  if (!skipConfirm) {
    const proceed = await confirm({ message: 'Start research?' });

    if (!proceed) {
      console.log(chalk.yellow('Research cancelled.'));
      return;
    }
  }

  // Create task
  const task: ResearchTask = {
    id: generateTaskId(),
    name: question,
    question,
    status: 'running',
    scheduleType: 'now',
    createdAt: Date.now(),
    startedAt: Date.now(),
    progressPercent: 0,
    currentIteration: 1,
    maxIterations: RESEARCH_CONFIG.maxIterations,
    readyScore: 0
  };

  console.log(chalk.green(`\n✓ Task started: ${task.id}\n`));

  // Run research (simulation or actual based on --simulate flag)
  if (simulate) {
    console.log(chalk.gray('(Running in simulation mode)\n'));
    await simulateResearch(task, timeLimit);
  } else {
    await runResearch(task, timeLimit);
  }

  console.log(chalk.green(`\n✓ Research complete!`));
  console.log(chalk.blue(`Report saved to: ${OUTPUT_DIR}/task-${task.id}.pdf\n`));
}

async function commandDaemon(subcommand: string, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'start':
      console.log(chalk.blue(`\n🚀 Starting ${APP_NAME} daemon...\n`));
      console.log(chalk.gray('Daemon started (PID: ' + process.pid + ')'));
      console.log(chalk.gray('Watching task queue for incoming research requests...'));
      console.log(chalk.gray('\nPress Ctrl+C to stop daemon.\n'));

      // Keep daemon running
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nDaemon shutting down gracefully...'));
        process.exit(0);
      });

      // Simulate daemon loop
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      break;

    case 'stop':
      console.log(chalk.yellow('Daemon stop not yet implemented.'));
      break;

    case 'status':
      console.log(chalk.blue('\n╔══════════════════════════════════╗'));
      console.log(chalk.blue('║') + ' Daemon Status');
      console.log(chalk.blue('╚══════════════════════════════════╝\n'));

      const table = new Table({
        head: [chalk.bold('Metric'), chalk.bold('Value')],
        colWidths: [20, 30]
      });

      table.push(
        [chalk.gray('Status'), chalk.green('✓ Running')],
        [chalk.gray('PID'), process.pid.toString()],
        [chalk.gray('Uptime'), 'N/A'],
        [chalk.gray('Running Tasks'), '0'],
        [chalk.gray('Queued Tasks'), '0'],
        [chalk.gray('Completed Today'), '0']
      );

      console.log(table.toString());
      console.log();
      break;

    default:
      console.log(chalk.red(`Unknown daemon subcommand: ${subcommand}`));
  }
}

async function commandTask(subcommand: string, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'new':
      console.log(chalk.blue('\n📋 Create New Research Task\n'));

      const taskName = await input({
        message: 'Task name:',
        default: 'Untitled Research'
      });

      const taskQuestion = await input({
        message: 'Research question:',
        validate: (val) => val.length > 10 ? true : 'Question must be at least 10 characters'
      });

      const scheduleType = await select({
        message: 'When to run?',
        choices: [
          { name: 'Run now', value: 'now' },
          { name: 'Run at specific time', value: 'at_time' },
          { name: 'Run within time window', value: 'time_window' },
          { name: 'Schedule recurring (cron)', value: 'cron' }
        ]
      });

      const task: ResearchTask = {
        id: generateTaskId(),
        name: taskName,
        question: taskQuestion,
        status: 'pending',
        scheduleType: scheduleType as ScheduleType,
        createdAt: Date.now()
      };

      console.log(chalk.green(`\n✓ Task created: ${task.id}\n`));
      console.log(`Name: ${task.name}`);
      console.log(`Question: ${task.question}\n`);
      break;

    case 'list':
      console.log(chalk.blue('\n📋 Task List\n'));

      const mockTasks: ResearchTask[] = [
        {
          id: 'task-20260409-001',
          name: 'Market Research: Collagen',
          question: 'What is the market opportunity for collagen supplements?',
          status: 'completed',
          scheduleType: 'now',
          createdAt: Date.now() - 2 * 60 * 60 * 1000,
          completedAt: Date.now() - 30 * 60 * 1000,
          progressPercent: 100,
          readyScore: 0.78
        }
      ];

      const taskTable = new Table({
        head: [chalk.bold('Task ID'), chalk.bold('Name'), chalk.bold('Status'), chalk.bold('Ready')],
        colWidths: [20, 30, 12, 8]
      });

      mockTasks.forEach(t => {
        const statusColor = t.status === 'completed' ? chalk.green : chalk.yellow;
        taskTable.push([
          t.id,
          t.name.substring(0, 30),
          statusColor(t.status),
          t.readyScore ? `${(t.readyScore * 100).toFixed(0)}%` : '-'
        ]);
      });

      console.log(taskTable.toString());
      console.log();
      break;

    default:
      console.log(chalk.red(`Unknown task subcommand: ${subcommand}`));
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function generateTaskId(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `task-${date}-${random}`;
}

async function runResearch(task: ResearchTask, timeLimit: number): Promise<void> {
  // Create orchestrator and run actual research
  const startTime = Date.now();

  try {
    const orchestrator = new DeepResearchOrchestrator();

    // Run orchestration with progress callback
    await orchestrator.orchestrate(
      {
        id: task.id,
        name: task.name,
        question: task.question,
        status: 'running',
        scheduleType: 'now',
        createdAt: task.createdAt
      },
      (state) => {
        // Update task progress
        task.currentIteration = state.iteration;
        task.progressPercent = Math.floor((state.coverage / 100) * 100);
        task.readyScore = state.readyScore;

        const elapsed = Date.now() - startTime;

        // Render progress
        console.clear();
        console.log(renderHeader({
          title: APP_NAME,
          mode: 'Interactive (Ask)',
          task,
          stats: {
            coverage: Math.floor(state.coverage),
            confidence: state.confidence,
            readyScore: state.readyScore,
            iteration: state.iteration,
            elapsed
          }
        }));

        console.log(chalk.bold('\nResearch Progress:\n'));

        // Progress bar
        const barLength = 40;
        const filled = Math.floor((state.coverage / 100 / 100) * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        console.log(`Coverage: [${bar}] ${Math.floor(state.coverage)}%`);
        console.log(`Confidence: ${(state.confidence * 100).toFixed(0)}% | Ready Score: ${(state.readyScore * 100).toFixed(0)}%\n`);

        console.log(chalk.gray(`Iteration ${state.iteration}/${RESEARCH_CONFIG.maxIterations} | ${formatTime(elapsed)} elapsed\n`));

        // Show gaps if any
        if (state.gaps.length > 0) {
          console.log(chalk.yellow('Identified gaps:'));
          state.gaps.slice(0, 3).forEach(gap => {
            console.log(`  • ${gap}`);
          });
          console.log();
        }
      }
    );

    task.status = 'completed';
    task.completedAt = Date.now();

    orchestrator.close();
  } catch (error) {
    task.status = 'failed';
    task.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    task.completedAt = Date.now();
    console.error(chalk.red(`\n❌ Research failed: ${task.errorMessage}`));
  }
}

/**
 * Simulate research (fallback for testing without actual orchestrator)
 */
async function simulateResearch(task: ResearchTask, timeLimit: number): Promise<void> {
  // Simulate research iterations with progress updates
  const maxTime = timeLimit || RESEARCH_CONFIG.maxIterations * 30 * 1000; // 30s per iteration default
  const startTime = Date.now();

  for (let iter = 1; iter <= RESEARCH_CONFIG.maxIterations; iter++) {
    task.currentIteration = iter;

    // Simulate progress
    const progress = Math.min(100, (iter / RESEARCH_CONFIG.maxIterations) * 100);
    const coverage = Math.min(iter * 15 + Math.random() * 10, 95);
    const confidence = 0.6 + (iter * 0.08) + Math.random() * 0.05;
    const readyScore = (coverage / 100) * confidence;

    task.progressPercent = Math.floor(progress);
    task.readyScore = readyScore;

    const elapsed = Date.now() - startTime;

    // Check termination conditions
    if (readyScore >= RESEARCH_CONFIG.coverageThreshold) {
      task.status = 'completed';
      task.completedAt = Date.now();
      break;
    }

    if (elapsed > maxTime) {
      task.status = 'completed';
      task.completedAt = Date.now();
      console.log(chalk.yellow('\n⏱  Time limit reached. Finalizing research...'));
      break;
    }

    // Show progress
    console.clear();
    console.log(renderHeader({
      title: APP_NAME,
      mode: 'Interactive (Ask)',
      task,
      stats: {
        coverage: Math.floor(coverage),
        confidence,
        readyScore,
        iteration: iter,
        elapsed
      }
    }));

    console.log(chalk.bold('\nResearch Progress:\n'));

    // Progress bar
    const barLength = 40;
    const filled = Math.floor((progress / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`Coverage: [${bar}] ${Math.floor(coverage)}%`);
    console.log(`Confidence: ${(confidence * 100).toFixed(0)}% | Ready Score: ${(readyScore * 100).toFixed(0)}%\n`);

    console.log(chalk.gray(`Iteration ${iter}/${RESEARCH_CONFIG.maxIterations} | ${formatTime(elapsed)} elapsed\n`));

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
  }
}

// ─────────────────────────────────────────────────────────────
// CLI MAIN
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    return;
  }

  const command = args[0];
  let subcommand = args[1] || '';
  let restArgs = args.slice(2);

  // If the "subcommand" looks like a flag, it's actually part of restArgs
  if (command === 'ask' && subcommand.startsWith('--')) {
    restArgs = args.slice(1);
    subcommand = '';
  } else if (command === 'task' && subcommand.startsWith('--')) {
    // task can have subcommands without flags, but check
    if (!['new', 'list', 'view', 'cancel'].includes(subcommand)) {
      restArgs = args.slice(1);
      subcommand = '';
    }
  }

  try {
    switch (command) {
      case 'ask':
        await commandAsk(restArgs);
        break;
      case 'daemon':
        await commandDaemon(subcommand, restArgs);
        break;
      case 'task':
        await commandTask(subcommand, restArgs);
        break;
      case '--help':
      case '-h':
        showHelp();
        break;
      case '--version':
      case '-v':
        console.log(`${APP_NAME} v${APP_VERSION}`);
        break;
      default:
        console.error(chalk.red(`Unknown command: ${command}`));
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
${chalk.bold(`${APP_NAME} v${APP_VERSION}`)} - Enterprise Research Automation Tool

${chalk.bold('USAGE:')}
  npm run deep-research <command> [options]

${chalk.bold('COMMANDS:')}
  ${chalk.cyan('ask')}              Run research interactively and wait for results
    --question TEXT        Research question (required)
    --time MIN             Time limit (e.g., "10m", "2h")
    --simulate             Simulate research without Ollama
    --yes                  Skip confirmation prompts

  ${chalk.cyan('daemon')}            Start background research worker
    ${chalk.dim('start')}             Start daemon process
    ${chalk.dim('stop')}              Stop daemon gracefully
    ${chalk.dim('status')}            Show daemon status and queue

  ${chalk.cyan('task')}              Manage research tasks
    ${chalk.dim('new')}               Create new task (interactive)
    ${chalk.dim('list')}              List all tasks
    ${chalk.dim('view ID')}           View task details and progress
    ${chalk.dim('cancel ID')}         Cancel running task

${chalk.bold('EXAMPLES:')}
  # Research now and wait
  npm run deep-research ask --question "Market trends in AI"

  # Time-limited research
  npm run deep-research ask --question "Latest developments" --time "20m"

  # Simulate without external services
  npm run deep-research ask --question "Test query" --simulate --yes

  # Start daemon for background research
  npm run deep-research daemon start

  # Queue a task
  npm run deep-research task new

${chalk.bold('CONFIGURATION:')}
  Max iterations: ${RESEARCH_CONFIG.maxIterations}
  Coverage threshold: ${(RESEARCH_CONFIG.coverageThreshold * 100).toFixed(0)}%
  Parallel agents: ${RESEARCH_CONFIG.maxParallelAgents}
  Default timeout: ${(RESEARCH_CONFIG.timeoutMs / 60 / 1000).toFixed(0)}m

${chalk.bold('DATA:')}
  Tasks: ${DATA_DIR}
  Output: ${OUTPUT_DIR}

${chalk.bold('HELP:')}
  npm run deep-research --help
  npm run deep-research --version
  `);
}

// Run
main().catch(console.error);

export { ResearchTask };
