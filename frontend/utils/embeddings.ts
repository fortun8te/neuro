// @ts-nocheck
/**
 * embeddings.ts — Semantic search foundation using Ollama embeddings.
 *
 * Provides:
 *   1. Embedding generation via Ollama's /api/embed endpoint
 *   2. In-memory vector index with cosine similarity
 *   3. Hybrid search (BM25 keyword + semantic blend)
 *
 * Used by memoryStore and neuroMemory for semantic retrieval.
 */

import { getOllamaEndpoint } from './modelConfig';
import { createLogger } from './logger';

const log = createLogger('embeddings');

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

/** Model used for generating embeddings. Small and fast. */
const EMBED_MODEL = 'nomic-embed-text';

/** Embedding dimensions for nomic-embed-text */
const EMBED_DIM = 768;

/** Max entries in the vector index before pruning oldest */
const MAX_INDEX_SIZE = 1000;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface VectorEntry {
  id: string;
  text: string;
  embedding: Float32Array;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;           // Combined score (0-1)
  semanticScore: number;   // Cosine similarity
  keywordScore: number;    // BM25-like score
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Embedding generation
// ─────────────────────────────────────────────────────────────

let _embedAvailable: boolean | null = null;

/**
 * Check if the embedding model is available on the Ollama server.
 * Caches the result — call resetEmbedAvailability() to re-check.
 */
export async function isEmbeddingAvailable(): Promise<boolean> {
  if (_embedAvailable !== null) return _embedAvailable;
  try {
    const endpoint = getOllamaEndpoint();
    const resp = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) { _embedAvailable = false; return false; }
    const data = await resp.json() as { models?: Array<{ name: string }> };
    _embedAvailable = (data.models ?? []).some(m => m.name.includes('nomic-embed') || m.name.includes('embed'));
    if (!_embedAvailable) {
      log.info('Embedding model not found. Pull it with: ollama pull nomic-embed-text');
    }
    return _embedAvailable;
  } catch {
    _embedAvailable = false;
    return false;
  }
}

export function resetEmbedAvailability(): void {
  _embedAvailable = null;
}

/**
 * Generate an embedding vector for the given text.
 * Returns null if Ollama is unavailable or the model isn't pulled.
 */
export async function embed(text: string, signal?: AbortSignal): Promise<Float32Array | null> {
  if (!await isEmbeddingAvailable()) return null;

  try {
    const endpoint = getOllamaEndpoint();
    const resp = await fetch(`${endpoint}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      signal: signal ?? AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      log.warn('Embed request failed', { status: resp.status });
      return null;
    }

    const data = await resp.json() as { embeddings?: number[][] };
    const vec = data.embeddings?.[0];
    if (!vec || vec.length === 0) return null;

    return new Float32Array(vec);
  } catch (e) {
    log.debug('Embed call failed', {}, e);
    return null;
  }
}

/**
 * Batch embed multiple texts. More efficient than calling embed() in a loop.
 */
export async function embedBatch(texts: string[], signal?: AbortSignal): Promise<(Float32Array | null)[]> {
  if (!await isEmbeddingAvailable()) return texts.map(() => null);
  if (texts.length === 0) return [];

  try {
    const endpoint = getOllamaEndpoint();
    const resp = await fetch(`${endpoint}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
      signal: signal ?? AbortSignal.timeout(30000),
    });

    if (!resp.ok) return texts.map(() => null);

    const data = await resp.json() as { embeddings?: number[][] };
    return (data.embeddings ?? []).map(vec =>
      vec && vec.length > 0 ? new Float32Array(vec) : null
    );
  } catch (e) {
    log.debug('Batch embed failed', { count: texts.length }, e);
    return texts.map(() => null);
  }
}

// ─────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─────────────────────────────────────────────────────────────
// BM25-like keyword scoring
// ─────────────────────────────────────────────────────────────

function bm25Score(query: string, document: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) return 0;

  const docLower = document.toLowerCase();
  const docWords = docLower.split(/\s+/);
  const avgDocLen = 50; // Assume average document length
  const k1 = 1.2;
  const b = 0.75;

  let score = 0;
  for (const term of queryTerms) {
    const tf = docWords.filter(w => w.includes(term)).length;
    if (tf === 0) continue;
    // Simplified BM25 (no IDF since we don't have corpus stats in-memory)
    const normalized = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docWords.length / avgDocLen)));
    score += normalized;
  }

  return score / queryTerms.length; // Normalize by query length
}

// ─────────────────────────────────────────────────────────────
// Vector Index
// ─────────────────────────────────────────────────────────────

export class VectorIndex {
  private entries: VectorEntry[] = [];

  get size(): number { return this.entries.length; }

  /** Add or update an entry in the index. */
  add(id: string, text: string, embedding: Float32Array, metadata?: Record<string, unknown>): void {
    // Update existing
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.entries[idx] = { id, text, embedding, metadata, createdAt: this.entries[idx].createdAt };
      return;
    }

    this.entries.push({ id, text, embedding, metadata, createdAt: Date.now() });

    // Prune oldest if over limit
    if (this.entries.length > MAX_INDEX_SIZE) {
      this.entries.sort((a, b) => b.createdAt - a.createdAt);
      this.entries = this.entries.slice(0, MAX_INDEX_SIZE);
    }
  }

  /** Remove an entry by ID. */
  remove(id: string): void {
    this.entries = this.entries.filter(e => e.id !== id);
  }

  /** Clear all entries. */
  clear(): void {
    this.entries = [];
  }

  /**
   * Hybrid search: combines cosine similarity with BM25 keyword matching.
   *
   * @param queryEmbedding - Embedding of the search query (null = keyword-only mode)
   * @param queryText      - Raw query text for keyword matching
   * @param topK           - Max results to return
   * @param semanticWeight - Weight for semantic score (0-1, default 0.6)
   */
  search(
    queryEmbedding: Float32Array | null,
    queryText: string,
    topK = 10,
    semanticWeight = 0.6,
  ): SearchResult[] {
    if (this.entries.length === 0) return [];

    const keywordWeight = 1 - semanticWeight;

    const scored = this.entries.map(entry => {
      const semanticScore = queryEmbedding
        ? Math.max(0, cosineSimilarity(queryEmbedding, entry.embedding))
        : 0;
      const keywordScore = Math.min(1, bm25Score(queryText, entry.text));

      const score = queryEmbedding
        ? semanticWeight * semanticScore + keywordWeight * keywordScore
        : keywordScore;

      return {
        id: entry.id,
        text: entry.text,
        score,
        semanticScore,
        keywordScore,
        metadata: entry.metadata,
      };
    });

    return scored
      .filter(s => s.score > 0.05) // Filter out near-zero matches
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Get all entries (for serialization). */
  getEntries(): ReadonlyArray<VectorEntry> {
    return this.entries;
  }

  /** Load entries (from serialization). */
  loadEntries(entries: VectorEntry[]): void {
    this.entries = entries;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton index for memory search
// ─────────────────────────────────────────────────────────────

export const memoryIndex = new VectorIndex();
