/**
 * CLI Error Handler & Recovery System
 * Captures, logs, and recovers from errors during execution
 */

export interface ErrorLog {
  timestamp: number;
  phase: string;
  error: string;
  stack?: string;
  recoverable: boolean;
  action?: string;
}

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

const DEFAULT_CONFIG: ErrorRecoveryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
};

let errorLog: ErrorLog[] = [];

/**
 * Classify error as recoverable or fatal
 */
function isRecoverable(error: Error | string): boolean {
  const msg = error instanceof Error ? error.message : String(error);

  // Network errors are recoverable
  if (msg.includes('ECONNREFUSED') || msg.includes('timeout') || msg.includes('ENOTFOUND')) {
    return true;
  }

  // Service temporarily unavailable
  if (msg.includes('503') || msg.includes('unavailable')) {
    return true;
  }

  // Memory/resource errors may be recoverable
  if (msg.includes('ENOMEM') || msg.includes('out of memory')) {
    return true;
  }

  // Syntax/type errors are NOT recoverable
  if (msg.includes('SyntaxError') || msg.includes('TypeError')) {
    return false;
  }

  return true;
}

/**
 * Log an error with context
 */
export function logError(phase: string, error: Error | string, context?: Record<string, any>): ErrorLog {
  const entry: ErrorLog = {
    timestamp: Date.now(),
    phase,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    recoverable: isRecoverable(error),
    action: context?.action,
  };

  errorLog.push(entry);

  // Also print to console
  const icon = entry.recoverable ? '⚠️' : '❌';
  process.stdout.write(`\n  ${icon} [${phase}] ${entry.error}\n`);

  if (context?.action) {
    process.stdout.write(`     Action: ${context.action}\n`);
  }

  return entry;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  phase: string,
  config: Partial<ErrorRecoveryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRecoverable(lastError)) {
        logError(phase, lastError, { action: 'Fatal error, not retrying' });
        throw lastError;
      }

      if (attempt < cfg.maxRetries) {
        const delayMs = cfg.exponentialBackoff
          ? cfg.retryDelayMs * Math.pow(2, attempt - 1)
          : cfg.retryDelayMs;

        logError(phase, lastError, { action: `Retrying in ${delayMs}ms (attempt ${attempt}/${cfg.maxRetries})` });

        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        logError(phase, lastError, { action: `Max retries (${cfg.maxRetries}) exceeded` });
      }
    }
  }

  throw lastError || new Error(`Failed after ${cfg.maxRetries} retries`);
}

/**
 * Get error log summary
 */
export function getErrorSummary(): {
  totalErrors: number;
  recoverableErrors: number;
  fatalErrors: number;
  phases: string[];
} {
  return {
    totalErrors: errorLog.length,
    recoverableErrors: errorLog.filter((e) => e.recoverable).length,
    fatalErrors: errorLog.filter((e) => !e.recoverable).length,
    phases: Array.from(new Set(errorLog.map((e) => e.phase))),
  };
}

/**
 * Print error log
 */
export function printErrorLog(): void {
  const summary = getErrorSummary();

  if (summary.totalErrors === 0) {
    process.stdout.write(`\n  ✅ No errors\n\n`);
    return;
  }

  process.stdout.write(`\n  ┌─ Error Log ─────────────────────────────────────┐\n`);
  process.stdout.write(`  │  Total: ${summary.totalErrors}\n`);
  process.stdout.write(`  │  Recoverable: ${summary.recoverableErrors}\n`);
  process.stdout.write(`  │  Fatal: ${summary.fatalErrors}\n`);

  if (summary.phases.length > 0) {
    process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
    process.stdout.write(`  │  Phases with errors:\n`);
    for (const phase of summary.phases) {
      const phaseErrors = errorLog.filter((e) => e.phase === phase).length;
      process.stdout.write(`  │    ${phase}: ${phaseErrors}\n`);
    }
  }

  process.stdout.write(`  └──────────────────────────────────────────────────┘\n\n`);
}

/**
 * Clear error log
 */
export function clearErrorLog(): void {
  errorLog = [];
}

/**
 * Get full error log for export
 */
export function exportErrorLog(): ErrorLog[] {
  return [...errorLog];
}
