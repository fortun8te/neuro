/**
 * Semaphore for controlling concurrency.
 * Limits the number of simultaneous async operations.
 *
 * Usage:
 *   const semaphore = new Semaphore(4);
 *   const result = await semaphore.run(() => expensiveOperation());
 *
 * This prevents overwhelming Ollama with 20+ concurrent requests;
 * keeps queue depth at 0-2 by serializing large batches.
 */
export class Semaphore {
  permits: number;
  waiting: Array<() => void> = [];

  constructor(permits: number) {
    if (permits <= 0) throw new Error('Semaphore permits must be > 0');
    this.permits = permits;
  }

  /**
   * Acquire a permit. Blocks if none available.
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(() => {
        this.permits--;
        resolve(undefined);
      });
    });
  }

  /**
   * Release a permit. Resumes next waiter if any.
   */
  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) {
        this.permits++;
        next();
      }
    } else {
      this.permits++;
    }
  }

  /**
   * Convenience: run a function with automatic acquire/release.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current permit count (for debugging).
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get waiting count (for debugging).
   */
  waitingCount(): number {
    return this.waiting.length;
  }
}
