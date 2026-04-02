/**
 * Request Queue Implementation
 *
 * Enforces maximum concurrency for outbound requests.
 * Prevents overwhelming remote services with too many simultaneous requests.
 * Implements FIFO ordering with configurable max concurrency.
 */

import { createLogger } from './logger';

const log = createLogger('requestQueue');

export interface QueueStats {
  queued: number;
  active: number;
  completed: number;
  failed: number;
}

/**
 * Generic request queue with configurable concurrency limit
 */
export class RequestQueue {
  private queue: Array<() => Promise<unknown>> = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private completed = 0;
  private failed = 0;
  private name: string;

  constructor(maxConcurrent: number = 5, name: string = 'RequestQueue') {
    this.maxConcurrent = maxConcurrent;
    this.name = name;
  }

  /**
   * Enqueue a request function.
   * Returns a promise that resolves with the function's result.
   * Automatically processes the queue when requests complete.
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedFn = async () => {
        try {
          const result = await fn();
          this.completed++;
          resolve(result);
        } catch (err) {
          this.failed++;
          reject(err);
        } finally {
          this.activeCount--;
          this.process();
        }
      };

      this.queue.push(wrappedFn);
      this.process();
    });
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return {
      queued: this.queue.length,
      active: this.activeCount,
      completed: this.completed,
      failed: this.failed,
    };
  }

  /**
   * Reset statistics (useful for load testing)
   */
  resetStats(): void {
    this.completed = 0;
    this.failed = 0;
  }

  /**
   * Set maximum concurrent requests
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.process();
  }

  /**
   * Drain the queue — wait until all pending requests complete
   */
  async drain(): Promise<void> {
    while (this.activeCount > 0 || this.queue.length > 0) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────

  private process(): void {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const fn = this.queue.shift();

    if (fn) {
      fn().catch(() => {
        // Error already handled in wrappedFn catch block
      });
    }
  }
}

/**
 * Global rate limiting queues for different services
 */
const queues = new Map<string, RequestQueue>();

/**
 * Get or create a queue for a service
 */
export function getOrCreateQueue(
  serviceName: string,
  maxConcurrent: number = 5
): RequestQueue {
  if (!queues.has(serviceName)) {
    const queue = new RequestQueue(maxConcurrent, serviceName);
    queues.set(serviceName, queue);
    log.debug(`Created queue for ${serviceName}`, { maxConcurrent });
  }
  return queues.get(serviceName)!;
}

/**
 * Get all active queues
 */
export function getAllQueues(): Map<string, RequestQueue> {
  return new Map(queues);
}

/**
 * Enqueue a request with automatic rate limiting
 */
export async function enqueueRequest<T>(
  serviceName: string,
  fn: () => Promise<T>,
  maxConcurrent: number = 5
): Promise<T> {
  const queue = getOrCreateQueue(serviceName, maxConcurrent);
  return queue.enqueue(fn);
}

/**
 * Wait for all pending requests to complete
 */
export async function drainAllQueues(): Promise<void> {
  await Promise.all(
    Array.from(queues.values()).map(q => q.drain())
  );
}
