/**
 * CLI JSONL Logger
 * Streams all events to JSONL files for complete audit trail
 * Location: ~/.claude/neuro_logs/{timestamp}.jsonl
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LogEntry {
  timestamp: number;
  type: string;
  phase?: string;
  data: Record<string, any>;
}

export interface LogConfig {
  enabled: boolean;
  dir: string;
  filename?: string;
}

let config: LogConfig = {
  enabled: true,
  dir: path.join(os.homedir(), '.claude', 'neuro_logs'),
};

let currentLogPath: string | null = null;
let logStream: fs.WriteStream | null = null;

/**
 * Initialize logger
 */
export function initLogger(customConfig?: Partial<LogConfig>): string {
  if (customConfig) {
    config = { ...config, ...customConfig };
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(config.dir)) {
    fs.mkdirSync(config.dir, { recursive: true });
  }

  // Create log file with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = config.filename || `neuro_${timestamp}.jsonl`;
  currentLogPath = path.join(config.dir, filename);

  // Open write stream
  logStream = fs.createWriteStream(currentLogPath, { flags: 'a', encoding: 'utf-8' });

  return currentLogPath;
}

/**
 * Write a single log entry
 */
export function log(type: string, data: Record<string, any>, phase?: string): void {
  if (!config.enabled || !logStream) {
    return;
  }

  const entry: LogEntry = {
    timestamp: Date.now(),
    type,
    phase,
    data,
  };

  try {
    logStream.write(JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write log entry:', error);
  }
}

/**
 * Log tool call
 */
export function logToolCall(toolName: string, input: any, output: any, duration: number, phase?: string): void {
  log(
    'tool_call',
    {
      tool: toolName,
      input,
      output,
      durationMs: duration,
    },
    phase
  );
}

/**
 * Log routing decision
 */
export function logRoutingDecision(decision: string, confidence: number, reasoning: string, phase?: string): void {
  log(
    'routing_decision',
    {
      decision,
      confidence,
      reasoning,
    },
    phase
  );
}

/**
 * Log model switch
 */
export function logModelSwitch(fromModel: string, toModel: string, reason: string, phase?: string): void {
  log(
    'model_switch',
    {
      from: fromModel,
      to: toModel,
      reason,
    },
    phase
  );
}

/**
 * Log phase completion
 */
export function logPhaseComplete(phase: string, duration: number, metrics: Record<string, any>): void {
  log('phase_complete', { phase, durationMs: duration, ...metrics }, phase);
}

/**
 * Log error
 */
export function logError(error: string, phase?: string, stack?: string): void {
  log('error', { error, stack }, phase);
}

/**
 * Log subagent spawn
 */
export function logSubagentSpawn(role: string, task: string, phase?: string): void {
  log('subagent_spawn', { role, task }, phase);
}

/**
 * Log subagent completion
 */
export function logSubagentComplete(agentId: string, result: any, phase?: string): void {
  log('subagent_complete', { agentId, result }, phase);
}

/**
 * Close logger
 */
export async function closeLogger(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (logStream) {
      logStream.end((err) => {
        if (err) {
          reject(err);
        } else {
          logStream = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

/**
 * Get current log path
 */
export function getLogPath(): string | null {
  return currentLogPath;
}

/**
 * List all log files
 */
export function listLogs(): string[] {
  if (!fs.existsSync(config.dir)) {
    return [];
  }

  return fs
    .readdirSync(config.dir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse(); // Most recent first
}

/**
 * Read a log file (streaming)
 */
export async function readLog(filename: string): Promise<LogEntry[]> {
  const filepath = path.join(config.dir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Log file not found: ${filename}`);
  }

  const entries: LogEntry[] = [];
  const lines = fs.readFileSync(filepath, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      console.error(`Failed to parse log line: ${line}`);
    }
  }

  return entries;
}

/**
 * Get log statistics
 */
export async function getLogStats(filename: string): Promise<{
  totalEntries: number;
  byType: Record<string, number>;
  byPhase: Record<string, number>;
  startTime: number;
  endTime: number;
  duration: number;
}> {
  const entries = await readLog(filename);

  const byType: Record<string, number> = {};
  const byPhase: Record<string, number> = {};

  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    if (entry.phase) {
      byPhase[entry.phase] = (byPhase[entry.phase] || 0) + 1;
    }
  }

  const startTime = entries.length > 0 ? entries[0].timestamp : 0;
  const endTime = entries.length > 0 ? entries[entries.length - 1].timestamp : 0;

  return {
    totalEntries: entries.length,
    byType,
    byPhase,
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}

/**
 * Print log statistics
 */
export async function printLogStats(filename: string): Promise<void> {
  const stats = await getLogStats(filename);

  process.stdout.write(`\n  ┌─ Log Statistics ────────────────────────────────┐\n`);
  process.stdout.write(`  │  File: ${filename}\n`);
  process.stdout.write(`  │  Total entries: ${stats.totalEntries}\n`);
  process.stdout.write(`  │  Duration: ${Math.floor(stats.duration / 1000)}s\n`);
  process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
  process.stdout.write(`  │  By type:\n`);

  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  │    ${type.padEnd(20)} ${count}\n`);
  }

  if (Object.keys(stats.byPhase).length > 0) {
    process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
    process.stdout.write(`  │  By phase:\n`);

    for (const [phase, count] of Object.entries(stats.byPhase).sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  │    ${phase.padEnd(20)} ${count}\n`);
    }
  }

  process.stdout.write(`  └──────────────────────────────────────────────────┘\n\n`);
}
