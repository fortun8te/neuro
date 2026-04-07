/**
 * neuroLogger — Persistent event log for all agent activity.
 * Stores to IndexedDB (idb-keyval custom store), auto-prunes to 1000 entries.
 * Exports as JSON for debugging.
 */

import { createStore, get, set } from 'idb-keyval';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NeuroLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  type: 'routing' | 'tool_call' | 'tool_result' | 'response' | 'error' | 'model_select' | 'thinking' | 'memory' | 'system';
  model?: string;
  tool?: string;
  durationMs?: number;
  tokenCount?: number;
  data: Record<string, unknown>;
  chatId?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 1000;
const LOG_STORE_KEY = 'neuro-log-entries';

// ── Session ID (stable per page load) ────────────────────────────────────────

const SESSION_ID = crypto.randomUUID();

// ── IndexedDB store ──────────────────────────────────────────────────────────

const logStore = createStore('neuro-logs', 'logs');

// ── In-memory write buffer (flush every 500ms to avoid hammering IDB) ────────

let _writeBuffer: NeuroLogEntry[] = [];
let _cache: NeuroLogEntry[] | null = null;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

async function _getAll(): Promise<NeuroLogEntry[]> {
  if (_cache !== null) return _cache;
  try {
    const stored = await get<NeuroLogEntry[]>(LOG_STORE_KEY, logStore);
    _cache = Array.isArray(stored) ? stored : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function _flush(): Promise<void> {
  if (_writeBuffer.length === 0) return;
  const toWrite = [..._writeBuffer];
  _writeBuffer = [];

  try {
    const existing = await _getAll();
    const merged = [...existing, ...toWrite];
    // Prune: keep only the most recent MAX_LOG_ENTRIES
    const pruned = merged.length > MAX_LOG_ENTRIES
      ? merged.slice(merged.length - MAX_LOG_ENTRIES)
      : merged;
    _cache = pruned;
    await set(LOG_STORE_KEY, pruned, logStore);
  } catch (e) {
    console.warn('[neuroLogger] Flush failed:', e);
    // Re-queue — will retry on next flush
    _writeBuffer = [...toWrite, ..._writeBuffer];
  }
}

function _scheduleFlush(): void {
  if (_flushTimer !== null) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    _flush().catch(() => {});
  }, 500);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Log an event to the persistent store.
 * Fire-and-forget in normal usage — awaitable if you need confirmation.
 */
export async function logEvent(
  entry: Omit<NeuroLogEntry, 'id' | 'timestamp' | 'sessionId'>,
): Promise<void> {
  const full: NeuroLogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    sessionId: SESSION_ID,
    ...entry,
  };
  _writeBuffer.push(full);
  // Also append to cache immediately so getLogs is up-to-date within same session
  if (_cache !== null) {
    _cache.push(full);
    if (_cache.length > MAX_LOG_ENTRIES) {
      _cache = _cache.slice(_cache.length - MAX_LOG_ENTRIES);
    }
  }
  _scheduleFlush();
}

/**
 * Retrieve the most recent log entries.
 * @param limit  Max entries to return (default: all, capped at MAX_LOG_ENTRIES)
 */
export async function getLogs(limit?: number): Promise<NeuroLogEntry[]> {
  const all = await _getAll();
  const effective = limit ? all.slice(-limit) : all;
  return [...effective].reverse(); // newest first
}

/**
 * Clear all persisted logs.
 */
export async function clearLogs(): Promise<void> {
  _writeBuffer = [];
  _cache = [];
  try {
    await set(LOG_STORE_KEY, [], logStore);
  } catch (e) {
    console.warn('[neuroLogger] Clear failed:', e);
  }
}

/**
 * Export all logs as a formatted JSON string.
 */
export function exportLogs(): string {
  const all = _cache ?? [];
  return JSON.stringify(all, null, 2);
}

/**
 * Convenience: log a routing decision.
 */
export function logRouting(decision: string, model?: string, durationMs?: number, chatId?: string): void {
  logEvent({
    type: 'routing',
    model,
    durationMs,
    chatId,
    data: { decision },
  }).catch(() => {});
}

/**
 * Convenience: log a tool call start.
 */
export function logToolCall(toolName: string, args: Record<string, unknown>, chatId?: string): void {
  logEvent({
    type: 'tool_call',
    tool: toolName,
    chatId,
    data: { args: _safeArgs(args) },
  }).catch(() => {});
}

/**
 * Convenience: log a tool call result.
 */
export function logToolResult(
  toolName: string,
  success: boolean,
  resultSummary: string,
  durationMs: number,
  chatId?: string,
): void {
  logEvent({
    type: 'tool_result',
    tool: toolName,
    durationMs,
    chatId,
    data: { success, summary: resultSummary.slice(0, 300) },
  }).catch(() => {});
}

/**
 * Convenience: log a response completion.
 */
export function logResponse(responseLength: number, model: string, durationMs?: number, chatId?: string): void {
  logEvent({
    type: 'response',
    model,
    durationMs,
    chatId,
    data: { responseLength },
  }).catch(() => {});
}

/**
 * Convenience: log an error.
 */
export function logError(message: string, context?: string, chatId?: string): void {
  logEvent({
    type: 'error',
    chatId,
    data: { message: message.slice(0, 500), context },
  }).catch(() => {});
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _safeArgs(args: Record<string, unknown>): Record<string, unknown> {
  // Truncate any large string values to keep log entries lean
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.length > 200) {
      out[k] = v.slice(0, 200) + '…';
    } else {
      out[k] = v;
    }
  }
  return out;
}
