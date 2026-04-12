/**
 * Load Monitor CLI Integration
 *
 * Provides real-time load monitoring and status display for Ollama/Llama.
 * - Shows active tasks and capacity per model
 * - Displays global load metrics
 * - Warns when approaching capacity
 * - Can be integrated into any CLI command with --show-load flag
 *
 * Usage:
 *   import { showLoadStatus, formatLoadStatus } from './loadMonitorCli';
 *   await showLoadStatus(); // Continuous monitoring
 *   console.log(formatLoadStatus(loadMonitor.getStatus())); // One-time display
 */

import { loadMonitor } from '../services/loadMonitor';
import { createLogger } from '../utils/logger';

const log = createLogger('loadMonitorCli');

// ─────────────────────────────────────────────────────────────
// Formatting Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Format load status for CLI display
 */
export function formatLoadStatus(status: ReturnType<typeof loadMonitor.getStatus>): string {
  const { global } = status;

  // Global status line
  const statusEmoji = global.status === 'healthy'
    ? '✓'
    : global.status === 'capacity-warning'
      ? '⚠'
      : '🔴';

  const globalLine = `${statusEmoji} Global: ${global.activeTasks}/${global.globalMax} (${global.utilizationPercent}%)`;

  // Per-model status lines (only show models with activity)
  const modelLines = global.perModel
    .filter((m) => m.activeTasks > 0 || m.status !== 'available')
    .map((m) => {
      const modelEmoji = m.status === 'available'
        ? '✓'
        : m.status === 'capacity-warning'
          ? '⚠'
          : '🔴';

      const modelName = m.model
        .replace(/^qwen3\.5:/, 'Qwen')
        .replace(/^gemma4:/, 'Gemma')
        .replace(/^nemotron-3-super:/, 'Nemotron')
        .replace(/^NEURO-1-B2-4B/, 'Neuro');

      return `  ${modelEmoji} ${modelName}: ${m.activeTasks}/${m.maxConcurrency} (${m.utilizationPercent}%)${
        m.queuedTasks > 0 ? ` [Queue: ${m.queuedTasks}]` : ''
      }`;
    });

  // Capacity warning message
  let warning = '';
  if (global.status === 'at-capacity') {
    warning = '\n  ⚠️  At capacity — new tasks will be queued and wait for availability';
  } else if (global.status === 'capacity-warning') {
    warning = '\n  ⚠️  Nearing capacity — consider reducing load or increasing timeouts';
  }

  return [globalLine, ...modelLines, warning].filter(Boolean).join('\n');
}

/**
 * Get CLI-friendly status string (one-liner for inline display)
 */
export function getCliStatusString(): string {
  return loadMonitor.getCliStatus();
}

/**
 * Show load status with continuous updates
 * Useful for monitoring during long-running operations
 */
export async function showLoadStatus(options = { intervalMs: 2000, durationMs: 30_000 }): Promise<void> {
  const startTime = Date.now();
  let iteration = 0;

  const updateInterval = setInterval(() => {
    iteration++;
    const status = loadMonitor.getStatus();
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // Clear previous output and show new status
    process.stdout.write(`\r[${elapsed}s] Load Monitor - Iteration ${iteration}\n`);
    process.stdout.write(formatLoadStatus(status));
    process.stdout.write('\n\n');

    // Check if we should stop
    if (Date.now() - startTime > options.durationMs) {
      clearInterval(updateInterval);
    }
  }, options.intervalMs);

  // Show initial status
  process.stdout.write(`Load Monitor - Started\n`);
  process.stdout.write(formatLoadStatus(loadMonitor.getStatus()));
  process.stdout.write('\n\n');

  // Wait for duration
  await new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(updateInterval);
      process.stdout.write(`Load Monitor - Stopped\n`);
      resolve(undefined);
    }, options.durationMs);
  });
}

/**
 * Quick status display (one-liner to console)
 */
export function logLoadStatus(): void {
  const status = loadMonitor.getStatus();
  const line = [
    `Active: ${status.global.activeTasks}/${status.global.globalMax}`,
    `(${status.global.utilizationPercent}%)`,
    status.global.status === 'healthy'
      ? '✓ Healthy'
      : status.global.status === 'capacity-warning'
        ? '⚠ Warning'
        : '🔴 At Capacity',
  ].join(' ');

  log.info(line);
}

/**
 * Assert that load is healthy (throws if at capacity)
 * Useful as a precondition check before starting tasks
 */
export function assertCapacityAvailable(minCapacityPercent: number = 25): void {
  const status = loadMonitor.getStatus();
  const availablePercent = 100 - status.global.utilizationPercent;

  if (availablePercent < minCapacityPercent) {
    throw new Error(
      `Insufficient capacity: ${availablePercent}% available, need ${minCapacityPercent}%. ` +
      `Active: ${status.global.activeTasks}/${status.global.globalMax}. Wait for tasks to complete.`
    );
  }
}

/**
 * Wait until load drops below a threshold
 * Useful before starting resource-heavy operations
 */
export async function waitForCapacity(
  maxUtilizationPercent: number = 50,
  maxWaitMs: number = 120_000
): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 1000; // Check every second

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const status = loadMonitor.getStatus();
      const elapsed = Date.now() - startTime;

      if (status.global.utilizationPercent <= maxUtilizationPercent) {
        clearInterval(interval);
        log.info(`Capacity available (${status.global.utilizationPercent}% <= ${maxUtilizationPercent}%)`);
        resolve();
        return;
      }

      if (elapsed > maxWaitMs) {
        clearInterval(interval);
        reject(
          new Error(
            `Timeout waiting for capacity. ` +
            `Current: ${status.global.utilizationPercent}%, Target: ${maxUtilizationPercent}%. ` +
            `Waited: ${Math.round(elapsed / 1000)}s.`
          )
        );
        return;
      }

      // Log progress every 10 seconds
      if (elapsed % 10_000 < checkInterval) {
        log.debug(
          `Waiting for capacity (${status.global.utilizationPercent}% active, ` +
          `target: ${maxUtilizationPercent}%, elapsed: ${Math.round(elapsed / 1000)}s)`
        );
      }
    }, checkInterval);
  });
}

/**
 * Get a detailed report of model usage and capacity
 */
export function getDetailedReport(): string {
  const status = loadMonitor.getStatus();

  const lines: string[] = [
    '=== Load Monitor Report ===',
    `Timestamp: ${new Date(status.timestamp).toISOString()}`,
    '',
    '--- Global Status ---',
    `Active Tasks: ${status.global.activeTasks}/${status.global.globalMax}`,
    `Utilization: ${status.global.utilizationPercent}%`,
    `Status: ${status.global.status.toUpperCase()}`,
    '',
    '--- Per-Model Status ---',
  ];

  status.global.perModel.forEach((model) => {
    lines.push(`${model.model}:`);
    lines.push(`  Active: ${model.activeTasks}/${model.maxConcurrency} (${model.utilizationPercent}%)`);
    lines.push(`  Queued: ${model.queuedTasks}`);
    lines.push(`  Status: ${model.status}`);
  });

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// CLI Flag Integration Helper
// ─────────────────────────────────────────────────────────────

/**
 * Parse --show-load flag from CLI arguments
 * Returns true if flag is present
 */
export function hasShowLoadFlag(args: string[]): boolean {
  return args.includes('--show-load');
}

/**
 * Parse --load-watch flag with optional duration (e.g., --load-watch 30000)
 * Returns duration in ms or null if flag not present
 */
export function getLoadWatchDuration(args: string[]): number | null {
  const idx = args.indexOf('--load-watch');
  if (idx === -1) return null;
  if (idx + 1 < args.length) {
    const duration = parseInt(args[idx + 1], 10);
    if (!isNaN(duration)) return duration;
  }
  return 30_000; // Default 30 seconds
}
