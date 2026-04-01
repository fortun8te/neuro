/**
 * Search Result Cache — In-memory TTL cache for web search results
 *
 * Prevents re-fetching the same URL/query within a configurable window.
 * Dramatically reduces SearXNG and Wayfarer load during multi-iteration research.
 *
 * Default TTL: 5 minutes (tunable via CACHE_TTL_MS)
 * Max entries: 500 (LRU eviction)
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

class SearchCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;
  private maxEntries: number;

  constructor(ttl = CACHE_TTL_MS, maxEntries = MAX_ENTRIES) {
    this.ttl = ttl;
    this.maxEntries = maxEntries;
  }

  /** Get cached result if fresh, or null */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  /** Store a result */
  set(key: string, data: T): void {
    // LRU eviction if at capacity
    if (this.cache.size >= this.maxEntries) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /** Check if key exists and is fresh */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /** Get stats */
  stats(): { size: number; hitRate: string } {
    let totalHits = 0;
    let totalEntries = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalEntries++;
    }
    return {
      size: totalEntries,
      hitRate: totalEntries > 0 ? `${((totalHits / Math.max(totalEntries, 1)) * 100).toFixed(0)}%` : '0%',
    };
  }

  /** Clear all entries */
  clear(): void {
    this.cache.clear();
  }

  /** Prune expired entries */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// ── Singleton instances ──

/** Cache for SearXNG search results (query -> results array) */
export const searchResultCache = new SearchCache<Array<{ url: string; title: string; snippet?: string }>>();

/** Cache for Wayfarer page content (url -> page text) */
export const pageContentCache = new SearchCache<{ content: string; title: string }>();

/** Cache for compressed page summaries (url+query -> compressed text) */
export const compressionCache = new SearchCache<string>();

/**
 * Normalize a search query for cache key
 * Lowercases, trims, and removes extra whitespace
 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get a cache key for a page compression (url + query combo)
 */
export function compressionKey(url: string, query: string): string {
  return `${url}||${normalizeQuery(query)}`;
}
