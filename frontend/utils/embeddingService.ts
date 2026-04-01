/**
 * Embedding Service — Generate and cache vector embeddings
 *
 * Uses nomic-embed-text (90M params) for fast, accurate embeddings
 * Vectors cached in memory during session
 */

import { INFRASTRUCTURE } from '../config/infrastructure';
import { createLogger } from './logger';

const log = createLogger('embedding');

const EMBEDDING_MODEL = 'nomic-embed-text:latest';
const EMBEDDING_DIM = 768;  // nomic-embed-text output dimension

// In-memory cache: text → embedding
const embeddingCache = new Map<string, number[]>();

// Flag to avoid spamming logs when embedding model isn't available
let embeddingModelUnavailable = false;

// ── Probe: one-shot check if nomic-embed-text is available ──
let _probeResult: boolean | null = null; // null = not yet probed
let _probePromise: Promise<boolean> | null = null;

/** One-shot probe: check /api/tags for nomic-embed-text. Cached after first call. */
export async function probeEmbeddingModel(): Promise<boolean> {
  if (_probeResult !== null) return _probeResult;
  if (_probePromise) return _probePromise;
  _probePromise = (async () => {
    try {
      const resp = await fetch(`${INFRASTRUCTURE.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) { _probeResult = false; return false; }
      const data = await resp.json() as { models: Array<{ name: string }> };
      const found = data.models?.some(m => m.name.includes('nomic-embed')) ?? false;
      if (!found) {
        embeddingModelUnavailable = true;
        log.warn(`Embedding model "${EMBEDDING_MODEL}" not found on server — embeddings disabled`);
      }
      _probeResult = found;
      return found;
    } catch {
      _probeResult = false;
      embeddingModelUnavailable = true;
      return false;
    } finally {
      _probePromise = null;
    }
  })();
  return _probePromise;
}

/** Synchronous check — returns false until probe completes and finds the model. */
export function isEmbeddingAvailable(): boolean {
  // Kick off probe if not yet started (fire-and-forget)
  if (_probeResult === null) { probeEmbeddingModel(); }
  return _probeResult === true;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  cached: boolean;
}

/**
 * Generate embedding for text using Ollama
 * Results are cached to avoid redundant calls
 */
export async function generateEmbedding(
  text: string,
  signal?: AbortSignal
): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    return { text, embedding: Array(EMBEDDING_DIM).fill(0), cached: true };
  }

  // Check cache first
  const normalized = text.toLowerCase().trim();
  if (embeddingCache.has(normalized)) {
    return {
      text,
      embedding: embeddingCache.get(normalized)!,
      cached: true,
    };
  }

  try {
    // Skip if embedding model previously failed or probe says unavailable
    if (embeddingModelUnavailable || _probeResult === false) {
      return { text, embedding: Array(EMBEDDING_DIM).fill(0), cached: true };
    }

    // Always apply a hard 5s timeout — if nomic-embed-text isn't loaded the
    // fetch hangs indefinitely with no timeout, blocking the entire agent loop.
    const timeoutSignal = AbortSignal.timeout(5000);
    const combinedSignal = signal
      ? (AbortSignal as any).any
        ? (AbortSignal as any).any([signal, timeoutSignal])
        : timeoutSignal
      : timeoutSignal;
    const response = await fetch(`${INFRASTRUCTURE.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
      signal: combinedSignal,
    });

    if (!response.ok) {
      // If model not found, mark unavailable and return zero vector silently
      if (response.status === 404) {
        if (!embeddingModelUnavailable) {
          embeddingModelUnavailable = true;
          log.warn(`Embedding model "${EMBEDDING_MODEL}" not available — embeddings disabled. Pull it with: ollama pull ${EMBEDDING_MODEL}`);
        }
        return { text, embedding: Array(EMBEDDING_DIM).fill(0), cached: true };
      }
      throw new Error(`Ollama embeddings failed: HTTP ${response.status}`);
    }

    const data = await response.json() as { embedding: number[] };
    const embedding = data.embedding;

    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIM}, got ${embedding.length}`);
    }

    // Cache for future use
    embeddingCache.set(normalized, embedding);

    return { text, embedding, cached: false };
  } catch (err) {
    log.error('Failed to generate embedding', { text: text.slice(0, 100) }, err);
    throw err;
  }
}

/**
 * Generate embeddings for multiple texts in parallel
 */
export async function generateEmbeddings(
  texts: string[],
  signal?: AbortSignal
): Promise<EmbeddingResult[]> {
  return Promise.all(
    texts.map(text => generateEmbedding(text, signal))
  );
}

/**
 * Cosine similarity between two vectors (0 = orthogonal, 1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) return 0;

  // Dot product
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  // Norms
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Find top-K most similar vectors
 */
export function topKSimilar(
  queryVector: number[],
  candidates: Array<{ id: string; vector: number[] }>,
  k: number = 10
): Array<{ id: string; similarity: number }> {
  return candidates
    .map(c => ({
      id: c.id,
      similarity: cosineSimilarity(queryVector, c.vector),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * Batch similarity computation (optimized for many comparisons)
 */
export function batchSimilarity(
  queryVector: number[],
  vectorMap: Map<string, number[]>
): Map<string, number> {
  const results = new Map<string, number>();

  for (const [id, vector] of vectorMap.entries()) {
    results.set(id, cosineSimilarity(queryVector, vector));
  }

  return results;
}

/**
 * Health check — ensure embedding model is loaded
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${INFRASTRUCTURE.ollamaUrl}/api/tags`);
    const data = await response.json() as { models: Array<{ name: string }> };
    const hasModel = data.models?.some(m => m.name.includes('nomic-embed'));
    return !!hasModel;
  } catch (err) {
    log.warn('Embedding health check failed', {}, err);
    return false;
  }
}

/**
 * Clear embedding cache (useful for memory management)
 */
export function clearCache(): void {
  const size = embeddingCache.size;
  embeddingCache.clear();
  log.info(`Cleared embedding cache (${size} entries)`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size,
    sizeBytes: embeddingCache.size * EMBEDDING_DIM * 4,  // 4 bytes per float32
  };
}
