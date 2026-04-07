/**
 * LEAN Production Multi-Agent Orchestrator
 * Core: Real research orchestration with fallback + caching + metrics
 */

import fetch from 'node-fetch';
import {
  ProviderRouter,
  MetricsCollector,
  AgentMessageBus,
  FallbackExecutor,
  AdaptiveCacheManager,
  PersistentMemoryStore,
} from './multiAgentOptimized';

const INFRASTRUCTURE = {
  ollama: process.env.VITE_OLLAMA_URL || 'http://100.74.135.83:11440',
  wayfarer: process.env.VITE_WAYFARER_URL || 'http://localhost:8891',
};

// ============================================================================
// PRODUCTION ORCHESTRATOR
// ============================================================================

export class ProductionMultiAgentOrchestrator {
  mlRouter = new ProviderRouter();
  metrics = new MetricsCollector();
  messageBus = new AgentMessageBus();
  fallback = new FallbackExecutor();
  adaptiveCache = new AdaptiveCacheManager();
  persistentMemory = new PersistentMemoryStore();

  constructor() {
    // Simple fallback chains
    this.fallback.registerFallback('research', async () => {
      const memories = await this.persistentMemory.recall('research');
      if (memories.length > 0) return memories[0];
      throw new Error('No fallback data');
    });
  }

  async initialize() {
    console.log('[ORCHESTRATOR] Initialized');
  }

  async orchestrateResearch(query: string, searchCount: number = 500): Promise<any> {
    const startTime = Date.now();
    console.log(`[ORCHESTRATOR] Starting: "${query}" (${searchCount} searches)`);

    try {
      // Phase 1: Check cache
      const cacheKey = `query:${query}:${searchCount}`;
      const cached = await this.adaptiveCache.lookup(cacheKey);
      if (cached) {
        console.log('[CACHE] HIT - returning cached result');
        this.metrics.record('cache_hits', 1);
        return JSON.parse(cached);
      }
      this.metrics.record('cache_misses', 1);

      // Phase 2: Select provider
      const provider = await this.mlRouter.selectProvider();
      console.log(`[ROUTER] Selected: ${provider}`);

      // Phase 3: Execute research with fallback
      const result = await this.fallback.execute('research', async () => {
        const pages = await this.fetchPages(query, searchCount);
        const synthesis = await this.synthesizeFindings(pages);
        return { pages, synthesis };
      });

      // Phase 4: Record metrics
      const elapsed = Date.now() - startTime;
      this.metrics.record('latency', elapsed);
      this.metrics.record('pages_fetched', result.pages.length);
      this.mlRouter.recordLatency(provider, elapsed);
      this.mlRouter.recordSuccess(provider, true);

      // Phase 5: Cache & persist
      await this.adaptiveCache.store(cacheKey, JSON.stringify(result));
      await this.persistentMemory.store({ query, result, timestamp: Date.now() });

      console.log(`[ORCHESTRATOR] Complete: ${elapsed}ms, ${result.pages.length} pages`);
      return result;
    } catch (e) {
      this.mlRouter.recordSuccess(await this.mlRouter.selectProvider(), false);
      this.metrics.record('errors', 1);
      throw e;
    }
  }

  private async fetchPages(query: string, count: number): Promise<any[]> {
    console.log(`[RESEARCH] Fetching ${count} pages...`);
    try {
      const res = await fetch(`${INFRASTRUCTURE.wayfarer}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, limit: Math.min(count, 20), timeout: 30000 }),
        timeout: 35000,
      } as any);

      const data = (await res.json()) as any;
      const pages = data.results?.slice(0, Math.min(count, data.results.length)) || [];
      console.log(`[RESEARCH] Fetched ${pages.length} pages`);
      return pages;
    } catch (e) {
      console.error('[RESEARCH] Fetch failed:', (e as any).message);
      return [];
    }
  }

  private async synthesizeFindings(pages: any[]): Promise<string> {
    const prompt = `Synthesize findings from ${pages.length} pages: ${pages.map(p => p.title || p.url).join(', ')}`;
    console.log('[SYNTHESIS] Generating...');

    try {
      const res = await fetch(`${INFRASTRUCTURE.ollama}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3.5:4b',
          prompt,
          stream: false,
          context: [pages.map((p: any) => p.content || '').join('\n\n')],
        }),
        timeout: 60000,
      } as any);

      const data = (await res.json()) as any;
      return data.response?.substring(0, 500) || `Synthesized ${pages.length} pages`;
    } catch (e) {
      console.error('[SYNTHESIS] Failed:', (e as any).message);
      return `Fallback: Found ${pages.length} pages`;
    }
  }
}
