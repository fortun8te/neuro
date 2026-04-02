/**
 * OutputStore — Persistent storage for command outputs via IndexedDB
 * Phase 1: Output variable tracking and retrieval
 */

import type { CommandOutput, OutputVariable } from '../types/commandOutput';
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface OutputStoreSchema extends DBSchema {
  outputs: {
    key: string; // id
    value: CommandOutput;
    indexes: {
      'by-timestamp': number;
      'by-command': string;
      'by-turn': number;
    };
  };
}

let db: IDBPDatabase<OutputStoreSchema> | null = null;

async function getDB(): Promise<IDBPDatabase<OutputStoreSchema>> {
  if (db) return db;

  db = await openDB<OutputStoreSchema>('neuro-outputs', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('outputs')) {
        const store = db.createObjectStore('outputs', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-command', 'command');
        store.createIndex('by-turn', 'turnNumber');
      }
    },
  });

  return db;
}

const MAX_OUTPUT_LENGTH = 50000; // Truncate outputs larger than 50KB
const MAX_STORAGE_ITEMS = 500;   // Keep max 500 outputs

/**
 * Store a command output in IndexedDB.
 * Automatically truncates large outputs and cleans old entries if needed.
 */
export async function storeCommandOutput(
  command: string,
  input: string,
  output: string,
  turnNumber: number,
  model?: string,
  tokens?: number
): Promise<CommandOutput> {
  const db = await getDB();

  // Truncate if needed
  let truncated = false;
  let originalLength = output.length;
  if (output.length > MAX_OUTPUT_LENGTH) {
    truncated = true;
    output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n[...truncated...]';
  }

  const commandOutput: CommandOutput = {
    id: `${command}-${turnNumber}-${Date.now()}`,
    command,
    input,
    output,
    tokens,
    model,
    timestamp: Date.now(),
    turnNumber,
    truncated,
    originalLength: truncated ? originalLength : undefined,
  };

  await db.add('outputs', commandOutput);

  // Cleanup old entries if we exceed max storage
  const allOutputs = await db.getAll('outputs');
  if (allOutputs.length > MAX_STORAGE_ITEMS) {
    // Sort by timestamp, delete oldest 10%
    const sorted = allOutputs.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = Math.ceil(sorted.length * 0.1);
    for (let i = 0; i < toDelete; i++) {
      await db.delete('outputs', sorted[i].id);
    }
  }

  return commandOutput;
}

/**
 * Get the most recent output from a specific command type.
 */
export async function getLastCommandOutput(command?: string): Promise<CommandOutput | undefined> {
  const db = await getDB();

  if (command) {
    const index = db.transaction('outputs').store.index('by-command');
    const all = await index.getAll(command);
    if (all.length === 0) return undefined;
    return all[all.length - 1];
  } else {
    const all = await db.getAll('outputs');
    if (all.length === 0) return undefined;
    return all[all.length - 1];
  }
}

/**
 * Get output from N turns ago.
 * turnOffset: 0 = most recent, 1 = one turn back, etc.
 */
export async function getOutputByTurnOffset(turnOffset: number): Promise<CommandOutput | undefined> {
  const db = await getDB();
  const all = await db.getAll('outputs');
  if (all.length === 0) return undefined;

  // Sorted by timestamp, latest first
  const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
  return sorted[turnOffset] || undefined;
}

/**
 * Get all outputs from current session (since last clear).
 */
export async function getAllOutputs(): Promise<CommandOutput[]> {
  const db = await getDB();
  const all = await db.getAll('outputs');
  return all.sort((a, b) => a.turnNumber - b.turnNumber);
}

/**
 * Clear all stored outputs.
 */
export async function clearAllOutputs(): Promise<void> {
  const db = await getDB();
  await db.clear('outputs');
}

/**
 * Resolve an output variable to its actual value.
 * Supports: $LAST, $TURN_N, $COMMAND_NAME_OUTPUT
 */
export async function resolveOutputVariable(varName: string): Promise<string | undefined> {
  // $LAST or $LAST_OUTPUT → most recent output
  if (varName === '$LAST' || varName === '$LAST_OUTPUT') {
    const output = await getLastCommandOutput();
    return output?.output;
  }

  // $TURN_N → output from N turns ago
  const turnMatch = varName.match(/^\$TURN_(\d+)$/);
  if (turnMatch) {
    const turnOffset = parseInt(turnMatch[1], 10);
    const output = await getOutputByTurnOffset(turnOffset);
    return output?.output;
  }

  // $COMMAND_NAME_OUTPUT → last output from specific command
  // e.g., $RESEARCH_OUTPUT, $ANALYZE_OUTPUT
  const cmdMatch = varName.match(/^\$([A-Z_]+)_OUTPUT$/);
  if (cmdMatch) {
    const cmdName = cmdMatch[1].toLowerCase().replace(/_/g, '-');
    const output = await getLastCommandOutput(cmdName);
    return output?.output;
  }

  return undefined;
}

/**
 * Get all available output variables for substitution.
 */
export async function getAvailableOutputVariables(): Promise<OutputVariable[]> {
  const all = await getAllOutputs();
  const variables: OutputVariable[] = [];

  // Most recent output
  if (all.length > 0) {
    const last = all[all.length - 1];
    variables.push({
      name: '$LAST',
      value: last.output.slice(0, 100) + (last.output.length > 100 ? '...' : ''),
      source: 'turn',
      age: 0,
    });
  }

  // Recent turns
  for (let i = 1; i < Math.min(5, all.length); i++) {
    const output = all[all.length - 1 - i];
    variables.push({
      name: `$TURN_${i}`,
      value: output.output.slice(0, 100) + (output.output.length > 100 ? '...' : ''),
      source: 'turn',
      age: i,
    });
  }

  // Command-specific variables (last of each command type)
  const byCommand = new Map<string, CommandOutput>();
  all.forEach(output => {
    byCommand.set(output.command, output);
  });

  byCommand.forEach((output, cmd) => {
    const varName = '$' + cmd.toUpperCase().replace(/-/g, '_') + '_OUTPUT';
    variables.push({
      name: varName,
      value: output.output.slice(0, 100) + (output.output.length > 100 ? '...' : ''),
      source: 'command',
      age: all.length - (all.indexOf(output) + 1),
    });
  });

  return variables;
}
