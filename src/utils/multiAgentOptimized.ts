/**
 * LEAN Multi-Agent Optimization Layer
 * Core: Simple provider selection, metrics, fallback, caching, memory
 */

import crypto from 'crypto';

// ============================================================================
// SIMPLE PROVIDER ROUTER (no ML, no over-fitting)
// ============================================================================

export class ProviderRouter {
  private stats: Map<string, { latency: number; success: number }> = new Map();
  private readonly providers = ['ollama', 'bedrock'];

  constructor() {
    this.providers.forEach(p => this.stats.set(p, { latency: 0, success: 1 }));
  }

  /**
   * Select provider: ollama if fast, fallback to bedrock
   */
  async selectProvider(): Promise<string> {
    const stats = this.stats.get('ollama');
    if (stats && stats.latency < 5000 && stats.success > 0.8) return 'ollama';
    return 'bedrock';
  }

  recordLatency(provider: string, ms: number) {
    const s = this.stats.get(provider) || { latency: 0, success: 1 };
    s.latency = s.latency * 0.7 + ms * 0.3;
    this.stats.set(provider, s);
  }

  recordSuccess(provider: string, success: boolean) {
    const s = this.stats.get(provider) || { latency: 0, success: 1 };
    s.success = s.success * 0.9 + (success ? 1 : 0) * 0.1;
    this.stats.set(provider, s);
  }

  getStats() {
    const result: any = {};
    this.stats.forEach((v, k) => {
      result[k] = { avgLatency: Math.round(v.latency), successRate: (v.success * 100).toFixed(1) };
    });
    return result;
  }
}

// ============================================================================
// SIMPLE METRICS (no Prometheus export, just counters)
// ============================================================================

export class MetricsCollector {
  private metrics: Map<string, number> = new Map();
  private counts: Map<string, number> = new Map();

  record(name: string, value: number) {
    this.metrics.set(name, value);
    this.counts.set(name, (this.counts.get(name) || 0) + 1);
  }

  getAll() {
    const result: any = {};
    this.metrics.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }

  getCounts() {
    const result: any = {};
    this.counts.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }
}

// ============================================================================
// AGENT MESSAGE BUS (simple event pub/sub)
// ============================================================================

export class AgentMessageBus {
  private listeners: Map<string, Function[]> = new Map();

  publish(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
  }
}

// ============================================================================
// FALLBACK EXECUTOR (simple 2-level fallback)
// ============================================================================

export class FallbackExecutor {
  private fallbacks: Map<string, Function[]> = new Map();

  registerFallback(operation: string, handler: Function) {
    if (!this.fallbacks.has(operation)) this.fallbacks.set(operation, []);
    this.fallbacks.get(operation)!.push(handler);
  }

  async execute(operation: string, primary: Function): Promise<any> {
    try {
      return await primary();
    } catch (e) {
      const fallbacks = this.fallbacks.get(operation) || [];
      for (const fallback of fallbacks) {
        try {
          return await fallback();
        } catch (fe) {
          // try next fallback
        }
      }
      throw new Error(`${operation} failed: no fallbacks worked`);
    }
  }
}

// ============================================================================
// ADAPTIVE CACHE (simple LRU with TTL)
// ============================================================================

export class AdaptiveCacheManager {
  private cache: Map<string, { value: any; expires: number; hits: number }> = new Map();
  private readonly maxSize = 50 * 1024 * 1024; // 50MB
  private currentSize = 0;

  async lookup(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    entry.hits++;
    return entry.value;
  }

  async store(key: string, value: any) {
    // Simple TTL: 1-3 days based on hits
    const hits = this.cache.get(key)?.hits || 0;
    const ttlDays = Math.min(1 + hits * 0.5, 3);
    const expires = Date.now() + ttlDays * 24 * 60 * 60 * 1000;

    this.cache.set(key, { value, expires, hits: 0 });

    // LRU eviction if over size
    if (this.currentSize > this.maxSize) {
      const lru = Array.from(this.cache.entries()).sort((a, b) => a[1].hits - b[1].hits)[0];
      if (lru) this.cache.delete(lru[0]);
    }
  }

  getStats() {
    const entries = this.cache.size;
    const hits = Array.from(this.cache.values()).reduce((sum, e) => sum + e.hits, 0);
    return { entries, sizeMB: (this.currentSize / 1024 / 1024).toFixed(1), avgHits: entries > 0 ? (hits / entries).toFixed(1) : 0 };
  }
}

// ============================================================================
// PERSISTENT MEMORY (simple file-based store)
// ============================================================================

export class PersistentMemoryStore {
  private memories: any[] = [];

  async store(finding: any) {
    this.memories.push({ ...finding, timestamp: Date.now() });
  }

  async recall(query: string): Promise<any[]> {
    // Simple keyword match
    return this.memories.filter(m => JSON.stringify(m).toLowerCase().includes(query.toLowerCase()));
  }

  async prune(maxAge: number) {
    const cutoff = Date.now() - maxAge;
    this.memories = this.memories.filter(m => m.timestamp > cutoff);
  }

  getMemories() {
    return this.memories;
  }
}
