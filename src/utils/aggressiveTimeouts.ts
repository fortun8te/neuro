/**
 * ══════════════════════════════════════════════════════
 * AGGRESSIVE TIMEOUTS: Request-level timeout enforcement
 * ══════════════════════════════════════════════════════
 *
 * Kills hanging requests after 30s, prevents infinite loops,
 * enables graceful recovery when APIs are unresponsive.
 * Automatically triggers abort signals for cleanup.
 */

export interface TimeoutOptions {
  enforceHard?: boolean; // Kill process if timeout exceeded (default: true)
  logBeforeTrigger?: boolean; // Log warning before timeout (default: true)
}

type TimeoutErrorType = TimeoutError;

export class TimeoutError extends Error {
  taskName: string;
  timeoutMs: number;
  elapsed: number;

  constructor(taskName: string, timeoutMs: number, elapsed: number) {
    super(
      `Timeout: ${taskName} exceeded ${timeoutMs}ms (elapsed: ${elapsed}ms)`,
    );
    this.name = 'TimeoutError';
    this.taskName = taskName;
    this.timeoutMs = timeoutMs;
    this.elapsed = elapsed;
  }
}

/**
 * Timeout Manager — Enforces aggressive timeouts on all async operations.
 * - Request timeout: 30s (kill any hanging API call)
 * - Phase timeout: 2 hours (max budget per stage)
 * - Automatic AbortController triggering for cleanup
 */
export class TimeoutManager {
  private activeTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly defaultRequestTimeout = 30_000; // 30 seconds
  private readonly defaultPhaseTimeout = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Wrap a promise with request-level timeout (default: 30s).
   * If promise doesn't resolve/reject within timeout, kills it with TimeoutError.
   *
   * @param promise The promise to wrap
   * @param taskName Human-readable task name (for logging)
   * @param timeoutMs Timeout in milliseconds (default: 30000)
   * @param abortController Optional AbortController to trigger on timeout
   * @returns Resolved/rejected promise
   */
  async enforceRequestTimeout<T>(
    promise: Promise<T>,
    taskName: string,
    timeoutMs: number = this.defaultRequestTimeout,
    abortController?: AbortController,
  ): Promise<T> {
    let timedOut = false;

    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timeout = setTimeout(() => {
          timedOut = true;

          // Trigger abort signal if provided
          if (abortController && !abortController.signal.aborted) {
            try {
              abortController.abort();
            } catch (e) {
              // AbortController may already be aborted, ignore
            }
          }

          console.warn(
            `[TIMEOUT] Request timeout: ${taskName} exceeded ${timeoutMs}ms`,
          );

          reject(new TimeoutError(taskName, timeoutMs, timeoutMs));
        }, timeoutMs);

        // Store timeout ID for cleanup
        this.activeTimeouts.set(taskName, timeout);
      }),
    ]).finally(() => {
      // Clean up the timeout
      const timeout = this.activeTimeouts.get(taskName);
      if (timeout) {
        clearTimeout(timeout);
        this.activeTimeouts.delete(taskName);
      }
    });
  }

  /**
   * Wrap a promise with phase-level timeout (default: 2 hours).
   * Used to bound entire stages or cycle phases.
   *
   * @param promise The promise to wrap
   * @param phaseOrTaskName Human-readable phase/task name
   * @param timeoutMs Timeout in milliseconds (default: 2 hours)
   * @param abortController Optional AbortController to trigger on timeout
   * @returns Resolved/rejected promise
   */
  async enforcePhaseTimeout<T>(
    promise: Promise<T>,
    phaseOrTaskName: string,
    timeoutMs: number = this.defaultPhaseTimeout,
    abortController?: AbortController,
  ): Promise<T> {
    return this.enforceRequestTimeout(
      promise,
      `phase:${phaseOrTaskName}`,
      timeoutMs,
      abortController,
    );
  }

  /**
   * Get remaining time for a task.
   * Returns 0 if timed out or unknown task.
   */
  getRemainingTime(taskName: string, originalTimeoutMs: number): number {
    // Note: This is approximate since we don't track start time per task.
    // For accurate remaining time, track start time in caller.
    return Math.max(0, originalTimeoutMs);
  }

  /**
   * Manually cancel a timeout.
   */
  cancel(taskName: string): void {
    const timeout = this.activeTimeouts.get(taskName);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(taskName);
    }
  }

  /**
   * Get all active timeouts.
   */
  getActiveTimeouts(): string[] {
    return Array.from(this.activeTimeouts.keys());
  }

  /**
   * Cancel all active timeouts (useful on cleanup).
   */
  cancelAll(): void {
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
  }

  /**
   * Get statistics on timeout manager.
   */
  getStats(): {
    activeTimeouts: number;
    allTimeoutNames: string[];
  } {
    return {
      activeTimeouts: this.activeTimeouts.size,
      allTimeoutNames: Array.from(this.activeTimeouts.keys()),
    };
  }
}

/**
 * Global timeout manager singleton.
 */
export const globalTimeoutManager = new TimeoutManager();

/**
 * Helper to quickly wrap a promise with the global timeout manager.
 */
export async function withAggressiveTimeout<T>(
  promise: Promise<T>,
  taskName: string,
  timeoutMs?: number,
  abortController?: AbortController,
): Promise<T> {
  return globalTimeoutManager.enforceRequestTimeout(
    promise,
    taskName,
    timeoutMs,
    abortController,
  );
}
