/**
 * Exponential Backoff Retry Wrapper
 * Implements transient vs permanent failure detection with configurable retry strategies
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 500) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 8000) */
  maxDelayMs?: number;
  /** Delay multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Optional jitter factor 0-1 to randomize delays (default: 0.1) */
  jitterFactor?: number;
  /** Custom error classifier: returns true if error is transient (retriable) */
  isTransient?: (error: unknown) => boolean;
  /** Optional context name for logging */
  contextName?: string;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
  failureType: 'transient' | 'permanent' | 'max-retries-exceeded';
}

/** Default transient error detector */
function isTransientError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('failed to fetch')) {
      return true;
    }
  }

  // Timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('abort')) {
      return true;
    }
  }

  // IndexedDB quota exceeded is transient (might clear space)
  if (error instanceof Error) {
    if (
      error.name === 'QuotaExceededError' ||
      error.message.includes('quota') ||
      error.message.includes('storage full')
    ) {
      return true; // Might recover after cleanup
    }
  }

  // Assume other errors are permanent
  return false;
}

/**
 * Execute function with exponential backoff retry logic
 * Returns detailed result object with attempt count and failure type
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 5,
    initialDelayMs = 500,
    maxDelayMs = 8000,
    backoffMultiplier = 2,
    jitterFactor = 0.1,
    isTransient = isTransientError,
    contextName = 'operation',
  } = options;

  let lastError: unknown;
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.log(
          `[retryWithBackoff] ${contextName} succeeded on attempt ${attempt}/${maxRetries + 1}`
        );
      }
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalDelayMs,
        failureType: 'transient',
      };
    } catch (error) {
      lastError = error;

      // Check if this is a transient error
      const transient = isTransient(error);
      const isLastAttempt = attempt === maxRetries + 1;

      console.warn(
        `[retryWithBackoff] ${contextName} attempt ${attempt}/${maxRetries + 1} failed:`,
        error instanceof Error ? error.message : String(error),
        `(transient=${transient})`
      );

      // Permanent error: fail immediately
      if (!transient) {
        console.error(
          `[retryWithBackoff] ${contextName} failed with permanent error on attempt ${attempt}`
        );
        return {
          success: false,
          error,
          attempts: attempt,
          totalDelayMs,
          failureType: 'permanent',
        };
      }

      // Last attempt: fail with max retries exceeded
      if (isLastAttempt) {
        console.error(
          `[retryWithBackoff] ${contextName} exceeded max retries (${maxRetries})`
        );
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelayMs,
          failureType: 'max-retries-exceeded',
        };
      }

      // Calculate backoff delay for next attempt
      const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      const jitter = cappedDelay * jitterFactor * Math.random();
      const delayMs = Math.ceil(cappedDelay + jitter);

      totalDelayMs += delayMs;

      console.log(
        `[retryWithBackoff] ${contextName} retrying in ${delayMs}ms (attempt ${attempt + 1} of ${maxRetries + 1})`
      );

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but provide fallback
  return {
    success: false,
    error: lastError || new Error('Unknown retry error'),
    attempts: maxRetries + 1,
    totalDelayMs,
    failureType: 'max-retries-exceeded',
  };
}

/**
 * Convenience wrapper: throw on failure, return data on success
 * Useful for drop-in replacements where you want exceptions
 */
export async function retryOrThrow<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await retryWithBackoff(fn, options);
  if (result.success) {
    return result.data!;
  }
  throw result.error || new Error('Retry failed');
}

/**
 * Event emitter for retry events (for UI notifications)
 */
type RetryListener = (event: RetryEvent) => void;

export interface RetryEvent {
  type: 'attempt' | 'success' | 'permanent-failure' | 'max-retries-exceeded';
  contextName: string;
  attempt: number;
  maxRetries: number;
  error?: unknown;
  delayMs?: number;
}

class RetryEventEmitter {
  private listeners = new Set<RetryListener>();

  subscribe(listener: RetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: RetryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.warn('[RetryEventEmitter] Listener threw:', e);
      }
    }
  }
}

export const retryEvents = new RetryEventEmitter();
