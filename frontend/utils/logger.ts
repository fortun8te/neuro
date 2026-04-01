/**
 * logger.ts — Structured logging utility for Neuro.
 *
 * Provides component-scoped, level-aware logging with structured metadata.
 * All logs include timestamp, component tag, and optional context object.
 * In production builds, debug-level logs are suppressed.
 */

import { getEnvVariable } from '../config/envLoader';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
  error?: { message: string; stack?: string };
}

type LogListener = (entry: LogEntry) => void;

// ─────────────────────────────────────────────────────────────
// Ring buffer for recent logs (accessible from UI/debug panel)
// ─────────────────────────────────────────────────────────────

const LOG_BUFFER_SIZE = 500;
const _logBuffer: LogEntry[] = [];
const _listeners = new Set<LogListener>();

/** Get the last N log entries (newest last). */
export function getRecentLogs(count = 100): ReadonlyArray<LogEntry> {
  return _logBuffer.slice(-count);
}

/** Subscribe to new log entries in real time. Returns unsubscribe function. */
export function onLog(cb: LogListener): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

// ─────────────────────────────────────────────────────────────
// Level filtering
// ─────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const IS_DEV = getEnvVariable('VITE_DEV') === 'true' || process.env.NODE_ENV === 'development';
let _minLevel: LogLevel = IS_DEV ? 'debug' : 'info';

export function setLogLevel(level: LogLevel): void {
  _minLevel = level;
}

// ─────────────────────────────────────────────────────────────
// Core log function
// ─────────────────────────────────────────────────────────────

function emit(level: LogLevel, component: string, message: string, data?: Record<string, unknown>, err?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[_minLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...(data ? { data } : {}),
    ...(err ? {
      error: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    } : {}),
  };

  // Ring buffer
  _logBuffer.push(entry);
  if (_logBuffer.length > LOG_BUFFER_SIZE) _logBuffer.shift();

  // Notify listeners
  for (const cb of _listeners) {
    try { cb(entry); } catch { /* listener error — ignore */ }
  }

  // Console output
  const tag = `[${component}]`;
  switch (level) {
    case 'debug': console.debug(tag, message, data ?? ''); break;
    case 'info':  console.info(tag, message, data ?? ''); break;
    case 'warn':  console.warn(tag, message, data ?? '', err ?? ''); break;
    case 'error': console.error(tag, message, data ?? '', err ?? ''); break;
  }
}

// ─────────────────────────────────────────────────────────────
// Scoped logger factory
// ─────────────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>, err?: unknown): void;
  error(message: string, data?: Record<string, unknown>, err?: unknown): void;
}

/**
 * Create a logger scoped to a specific component.
 *
 * Usage:
 *   const log = createLogger('ollama');
 *   log.info('Connected', { endpoint, latencyMs: 42 });
 *   log.warn('Retry failed', { attempt: 2 }, error);
 */
export function createLogger(component: string): Logger {
  return {
    debug: (msg, data) => emit('debug', component, msg, data),
    info:  (msg, data) => emit('info', component, msg, data),
    warn:  (msg, data, err) => emit('warn', component, msg, data, err),
    error: (msg, data, err) => emit('error', component, msg, data, err),
  };
}
