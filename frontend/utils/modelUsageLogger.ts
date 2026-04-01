/**
 * Model Usage Logger — Track which models are used per session for debugging
 * Data is stored in sessionStorage and IndexedDB for analysis
 */

export interface ModelUsageEntry {
  timestamp: number;
  model: string;
  role: string;  // e.g., 'orchestrator', 'researcher', 'compression', 'chat'
  taskId?: string;
  duration?: number;  // milliseconds
  tokens?: number;
  success: boolean;
  error?: string;
}

export interface ModelUsageSession {
  sessionId: string;
  startTime: number;
  entries: ModelUsageEntry[];
}

const SESSION_KEY = 'neuro_model_usage_session';
const STORAGE_KEY = 'neuro_model_usage_log';

/**
 * Get or create session ID for tracking model usage across page lifetime
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'unknown';

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Log a model usage entry
 */
export function logModelUsage(entry: Omit<ModelUsageEntry, 'timestamp'>): void {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getSessionId();
    const log = getModelUsageLog();

    log.entries.push({
      ...entry,
      timestamp: Date.now(),
    });

    // Keep only last 1000 entries per session
    if (log.entries.length > 1000) {
      log.entries = log.entries.slice(-1000);
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(log));

    // Periodic cleanup: remove very old sessions (>1 hour)
    cleanupOldSessions();
  } catch (e) {
    // Silently fail if storage is unavailable
  }
}

/**
 * Get current session's model usage log
 */
export function getModelUsageLog(): ModelUsageSession {
  if (typeof window === 'undefined') return { sessionId: 'unknown', startTime: 0, entries: [] };

  const sessionId = getSessionId();
  const stored = sessionStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      const log = JSON.parse(stored) as ModelUsageSession;
      if (log.sessionId === sessionId) {
        return log;
      }
    } catch (e) {
      // Fall through to create new log
    }
  }

  return {
    sessionId,
    startTime: Date.now(),
    entries: [],
  };
}

/**
 * Get model usage summary for current session
 */
export function getModelUsageSummary(): Record<string, { count: number; duration: number; successRate: number }> {
  const log = getModelUsageLog();
  const summary: Record<string, { count: number; duration: number; successRate: number }> = {};

  for (const entry of log.entries) {
    if (!summary[entry.model]) {
      summary[entry.model] = { count: 0, duration: 0, successRate: 0 };
    }
    summary[entry.model].count++;
    if (entry.duration) summary[entry.model].duration += entry.duration;
    if (entry.success) summary[entry.model].successRate++;
  }

  // Convert counts to rates
  for (const model in summary) {
    if (summary[model].count > 0) {
      summary[model].successRate /= summary[model].count;
    }
  }

  return summary;
}

/**
 * Export model usage data as JSON (for debugging)
 */
export function exportModelUsageData(): string {
  const log = getModelUsageLog();
  const summary = getModelUsageSummary();

  return JSON.stringify({
    session: log,
    summary,
    generatedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * Clear model usage log for current session
 */
export function clearModelUsageLog(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Clean up model usage logs from old sessions (>1 hour old)
 */
function cleanupOldSessions(): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    const log = getModelUsageLog();

    // Remove entries older than 1 hour
    log.entries = log.entries.filter(e => (now - e.timestamp) < ONE_HOUR);

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch (e) {
    // Silently fail
  }
}

/**
 * Get debug info for console logging
 */
export function getModelUsageDebugInfo(): string {
  const summary = getModelUsageSummary();
  const lines = [
    '=== Model Usage Debug Info ===',
    `Session: ${getSessionId()}`,
    '',
    'Models Used:',
  ];

  for (const [model, stats] of Object.entries(summary)) {
    lines.push(`  ${model}: ${stats.count} calls, ${stats.duration}ms total, ${(stats.successRate * 100).toFixed(1)}% success`);
  }

  return lines.join('\n');
}
