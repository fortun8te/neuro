/**
 * Model Fallback Manager
 *
 * Implements graceful degradation when models are unavailable:
 * - Retries with exponential backoff (2s, 4s, 8s)
 * - Falls back to secondary model after 3 retries + 30s total wait
 * - Logs which fallback was used
 * - Continues processing with fallback (quality may decrease)
 * - Caches fallback decisions to avoid repeated failures
 */

import { loadMonitor } from './loadMonitor';
import { MODEL_ROUTING } from '../config/modelRouting';
import { createLogger } from '../utils/logger';

const log = createLogger('modelFallback');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface FallbackDecision {
  preferredModel: string;
  selectedModel: string;
  reason: 'primary-available' | 'primary-full-retry' | 'primary-timeout' | 'fallback-used';
  retryCount: number;
  totalWaitMs: number;
  timestamp: number;
}

interface FallbackCache {
  decisions: Map<string, FallbackDecision>;
  cacheExpiry: Map<string, number>;
}

// ─────────────────────────────────────────────────────────────
// Fallback Manager
// ─────────────────────────────────────────────────────────────

class ModelFallbackImpl {
  private cache: FallbackCache = {
    decisions: new Map(),
    cacheExpiry: new Map(),
  };

  private readonly CACHE_TTL_MS = 60_000; // 1 minute
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_DELAY_MS = 2000;
  private readonly MAX_WAIT_MS = 30_000;

  /**
   * Get the best available model for a role/phase.
   * Implements graceful degradation:
   * 1. Try primary model with retries (2s, 4s, 8s backoff)
   * 2. If capacity unavailable after retries, use fallback
   * 3. Cache decision for 1 minute to avoid repeated checks
   */
  async selectWithFallback(
    role: string,
    preferredModel: string
  ): Promise<FallbackDecision> {
    // Check cache first
    const cached = this.getCachedDecision(role);
    if (cached && cached.selectedModel === preferredModel) {
      return cached;
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Try primary model with retries
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      const availability = await loadMonitor.checkAvailability(preferredModel);
      if (availability.available) {
        const decision: FallbackDecision = {
          preferredModel,
          selectedModel: preferredModel,
          reason: 'primary-available',
          retryCount: attempt - 1,
          totalWaitMs: Date.now() - startTime,
          timestamp: Date.now(),
        };
        this.setCachedDecision(role, decision);
        return decision;
      }

      lastError = new Error(availability.reason || 'Unknown');

      // Exponential backoff between retries
      if (attempt < this.MAX_RETRIES) {
        const backoffMs = this.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const totalWaitMs = Date.now() - startTime;

        // Don't wait if we've already exceeded max
        if (totalWaitMs + backoffMs > this.MAX_WAIT_MS) {
          break;
        }

        log.debug('Primary model at capacity, retrying', {
          role,
          model: preferredModel,
          attempt,
          backoffMs,
          totalWaitMs,
        });

        await this.sleep(backoffMs);
      }
    }

    // All retries exhausted or timeout — try fallback
    const fallbackModel = this.getFallbackModel(preferredModel);
    if (fallbackModel && fallbackModel !== preferredModel) {
      const fallbackAvailability = await loadMonitor.checkAvailability(fallbackModel);
      const totalWaitMs = Date.now() - startTime;

      if (fallbackAvailability.available) {
        log.warn('Using fallback model', {
          role,
          preferred: preferredModel,
          fallback: fallbackModel,
          reason: lastError?.message,
          retries: this.MAX_RETRIES,
          totalWaitMs,
        });

        const decision: FallbackDecision = {
          preferredModel,
          selectedModel: fallbackModel,
          reason: 'fallback-used',
          retryCount: this.MAX_RETRIES,
          totalWaitMs,
          timestamp: Date.now(),
        };
        this.setCachedDecision(role, decision);
        return decision;
      }

      // Fallback also unavailable
      log.error('Both primary and fallback models unavailable', {
        role,
        preferred: preferredModel,
        fallback: fallbackModel,
        primaryReason: lastError?.message,
        fallbackReason: fallbackAvailability.reason,
      });

      const decision: FallbackDecision = {
        preferredModel,
        selectedModel: preferredModel,
        reason: 'primary-timeout',
        retryCount: this.MAX_RETRIES,
        totalWaitMs: Date.now() - startTime,
        timestamp: Date.now(),
      };

      // Still use primary model even though it's unavailable (degrade gracefully)
      // This allows the system to continue but may fail
      return decision;
    }

    // No fallback defined
    const decision: FallbackDecision = {
      preferredModel,
      selectedModel: preferredModel,
      reason: 'primary-timeout',
      retryCount: this.MAX_RETRIES,
      totalWaitMs: Date.now() - startTime,
      timestamp: Date.now(),
    };

    return decision;
  }

  /**
   * Get the fallback model for a primary model.
   * Looks up in MODEL_ROUTING config.
   */
  private getFallbackModel(primaryModel: string): string | null {
    // Search through MODEL_ROUTING for a config that uses this model
    for (const [, config] of Object.entries(MODEL_ROUTING)) {
      if (config.model === primaryModel && config.fallbackModel) {
        return config.fallbackModel;
      }
    }
    return null;
  }

  /**
   * Get cached decision for a role if still valid.
   */
  private getCachedDecision(role: string): FallbackDecision | null {
    const decision = this.cache.decisions.get(role);
    if (!decision) return null;

    const expiry = this.cache.cacheExpiry.get(role) ?? 0;
    if (Date.now() > expiry) {
      // Cache expired
      this.cache.decisions.delete(role);
      this.cache.cacheExpiry.delete(role);
      return null;
    }

    return decision;
  }

  /**
   * Cache a fallback decision.
   */
  private setCachedDecision(role: string, decision: FallbackDecision): void {
    this.cache.decisions.set(role, decision);
    this.cache.cacheExpiry.set(role, Date.now() + this.CACHE_TTL_MS);
  }

  /**
   * Clear the fallback cache (for testing or manual reset).
   */
  clearCache(): void {
    this.cache.decisions.clear();
    this.cache.cacheExpiry.clear();
  }

  /**
   * Sleep for ms.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get cache status for debugging.
   */
  getCacheStatus() {
    const now = Date.now();
    const entries = Array.from(this.cache.decisions.entries()).map(([role, decision]) => {
      const expiry = this.cache.cacheExpiry.get(role) ?? 0;
      return {
        role,
        decision,
        expiresIn: Math.max(0, expiry - now),
      };
    });

    return {
      cacheSize: entries.length,
      maxSize: 100, // Reasonable upper bound
      entries,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────

export const modelFallback = new ModelFallbackImpl();

/**
 * For testing: create a fresh instance
 */
export function createModelFallback(): ModelFallbackImpl {
  return new ModelFallbackImpl();
}
