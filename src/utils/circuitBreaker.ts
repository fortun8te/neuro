/**
 * Circuit Breaker Pattern Implementation
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail immediately
 * - HALF_OPEN: Recovery mode, allows 1 test request
 *
 * Transitions:
 * - CLOSED → OPEN: After N consecutive failures
 * - OPEN → HALF_OPEN: After timeout duration
 * - HALF_OPEN → CLOSED: After successful test request
 * - HALF_OPEN → OPEN: After failed test request
 */

import { createLogger } from './logger';

const log = createLogger('circuitBreaker');

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;        // Number of consecutive failures to open (default: 5)
  resetTimeout?: number;             // Milliseconds before attempting recovery (default: 30s)
  name?: string;                     // Service name for logging
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30_000;
    this.name = options.name ?? 'UnnamedService';
  }

  /**
   * Check if a request should be allowed through.
   * Throws if circuit is OPEN, allows if CLOSED or HALF_OPEN.
   */
  canAttempt(): void {
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - (this.lastFailureTime ?? 0);
      const remainingWait = Math.max(0, this.resetTimeout - timeSinceFailure);

      throw new Error(
        `Circuit breaker OPEN for ${this.name}. ` +
        `Service unavailable (${this.failureCount} consecutive failures). ` +
        `Retry in ${Math.ceil(remainingWait / 1000)}s.`
      );
    }
  }

  /**
   * Record a successful request. Resets failure counter.
   */
  recordSuccess(): void {
    if (this.state !== 'CLOSED') {
      log.info(`Circuit breaker recovery: ${this.name} is healthy again`, { previousState: this.state });
    }

    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Record a failed request. Increments failure counter.
   * If threshold reached, opens the circuit.
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.openCircuit();
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get diagnostic info
   */
  getStatus(): { state: CircuitBreakerState; failureCount: number; timeSinceLastFailure: number | null } {
    const timeSinceLastFailure = this.lastFailureTime ? Date.now() - this.lastFailureTime : null;
    return {
      state: this.state,
      failureCount: this.failureCount,
      timeSinceLastFailure,
    };
  }

  /**
   * Reset the circuit manually (used for testing or admin operations)
   */
  reset(): void {
    log.info(`Circuit breaker reset: ${this.name}`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  private openCircuit(): void {
    if (this.state === 'OPEN') return; // Already open, don't log again

    log.warn(
      `Circuit breaker OPEN for ${this.name}`,
      { failureCount: this.failureCount, resetTimeout: this.resetTimeout }
    );

    this.state = 'OPEN';

    // Schedule half-open attempt
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.resetTimeout);
  }

  private transitionToHalfOpen(): void {
    log.info(`Circuit breaker HALF_OPEN: ${this.name} — attempting recovery`);
    this.state = 'HALF_OPEN';
    this.resetTimer = null;
  }
}

/**
 * Global registry of circuit breakers, keyed by service name.
 * Allows central monitoring and management.
 */
const breakers = new Map<string, CircuitBreaker>();

export function getOrCreateBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker({ ...options, name }));
  }
  return breakers.get(name)!;
}

export function getAllBreakers(): Map<string, CircuitBreaker> {
  return new Map(breakers);
}

/**
 * Wraps an async function with circuit breaker logic.
 * Returns the result if successful, or throws if circuit is open or function fails.
 */
export async function executeWithBreaker<T>(
  breakerName: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<T> {
  const breaker = getOrCreateBreaker(breakerName, options);

  breaker.canAttempt();

  try {
    const result = await fn();
    breaker.recordSuccess();
    return result;
  } catch (error) {
    breaker.recordFailure();
    throw error;
  }
}
