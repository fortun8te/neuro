/**
 * Context-1 Service — Production harness for Chroma's chromadb-context-1 model
 *
 * Context-1 (chromadb-context-1:latest on Ollama) is a 20.9B retrieval model
 * (GPT-OSS family, 32×2.4B MoE) that runs an observe-reason-act loop with 4 tools.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * OLLAMA TOKEN FORMAT (verified via live testing on remote Ollama):
 *
 *   System:      <|start|>system<|channel|>final<|message|>{text}<|end|>
 *   User:        <|start|>user<|channel|>final<|message|>{text}<|end|>
 *   Thinking:    <|start|>assistant<|channel|>analysis<|message|>{text}<|end|>
 *   Response:    <|start|>assistant<|channel|>final<|message|>{text}<|end|>
 *   Tool call:   ...to={tool}...<|message|>{args_json}<|call|>...
 *   Tool result: <|start|>tool to={tool}<|channel|>result<|message|>{result}<|end|>
 *
 * The model generates MULTI-TURN sequences per generation call:
 *   analysis → final → tool_call  (all in one response)
 * So we generate WITHOUT stop tokens and scan the full output.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SELF-EDITING CONTEXT WINDOW (per Chroma's research paper):
 *
 *   Token Budget:  32,768 tokens tracked across full trajectory
 *   Soft Limit:    50% — model is told to consider pruning
 *   Hard Cutoff:   85% — only prune_chunks allowed
 *   Deduplication: seenChunkIds prevent re-retrieval across searches
 *   Termination:   text-only response (no tool calls) OR step limit
 *
 * @see https://www.trychroma.com/research/context-1
 */

import { INFRASTRUCTURE } from '../config/infrastructure';
import { createLogger } from './logger';
import { wayfarerService } from './wayfarer';
import { generateEmbedding, cosineSimilarity } from './embeddingService';
import { rerankChunks } from './rerankerService';

const log = createLogger('context1');

// FIX #5: Corpus chunk caching to avoid re-chunking on every retrieval
interface CachedDocument {
  docId: string;
  contentHash: string;
  chunks: CorpusChunk[];
  lastAccessed: number;
}

class CorpusCache {
  cache: Map<string, CachedDocument> = new Map();
  maxCached: number = 50;  // Max documents to cache

  set(docId: string, content: string, chunks: CorpusChunk[]): void {
    const contentHash = this.hashContent(content);
    this.cache.set(docId, {
      docId,
      contentHash,
      chunks,
      lastAccessed: Date.now(),
    });

    // Evict oldest if cache too large
    if (this.cache.size > this.maxCached) {
      let oldest: [string, CachedDocument] | null = null;
      for (const entry of this.cache.entries()) {
        if (!oldest || entry[1].lastAccessed < oldest[1].lastAccessed) {
          oldest = entry;
        }
      }
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }
  }

  get(docId: string, contentHash: string): CorpusChunk[] | null {
    const cached = this.cache.get(docId);
    if (cached && cached.contentHash === contentHash) {
      cached.lastAccessed = Date.now();
      return cached.chunks;
    }
    return null;
  }

  clear(): void {
    this.cache.clear();
  }

  hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(content.length, 1000); i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

const corpusCache = new CorpusCache();

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTEXT1_MODEL = 'chromadb-context-1:latest';

// Default configuration — can be overridden per request
const DEFAULT_CONFIG = {
  chunkSizeWords: 200,
  maxCorpusDocs: 40,
  charsPerToken: 4,
  tokenBudget: 32_768,
  softThreshold: 0.50,   // 50% — inject pruning suggestion
  hardCutoff: 0.85,      // 85% — reject all tools except prune
  generateTimeout: 30_000,
  maxParallelTools: 4,   // Per Chroma: avg 2.56 tools/turn, we allow up to 4
};

// Backward-compatible constants using defaults
const CHUNK_SIZE_WORDS = DEFAULT_CONFIG.chunkSizeWords;
const MAX_CORPUS_DOCS = DEFAULT_CONFIG.maxCorpusDocs;
const CHARS_PER_TOKEN = DEFAULT_CONFIG.charsPerToken;
const TOKEN_BUDGET = DEFAULT_CONFIG.tokenBudget;
const SOFT_THRESHOLD = DEFAULT_CONFIG.softThreshold;
const HARD_CUTOFF = DEFAULT_CONFIG.hardCutoff;

// Special tokens (verified via live testing)
const T = {
  START:     '<|start|>',
  END:       '<|end|>',
  CHANNEL:   '<|channel|>',
  MSG:       '<|message|>',
  CALL:      '<|call|>',
  CONSTRAIN: '<|constrain|>',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  chunkId: string;
  docId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  tokensUsed: number;
  steps: number;
  durationMs: number;
  toolCalls?: Array<{ tool: string; args: string; resultChunks: number }>;
}

export interface RetrievalEvent {
  type: 'tool_call' | 'observation' | 'reasoning' | 'prune' | 'budget_warning' | 'done' | 'error';
  tool?: string;
  args?: string;
  chunksFound?: number;
  chunksPruned?: number;
  tokensUsed?: number;
  tokenBudget?: number;
  message?: string;
}

export interface Context1HealthResult {
  status: 'connected' | 'disconnected';
  endpoint: string;
  latencyMs: number;
  modelLoaded?: boolean;
  error?: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface CorpusDoc {
  docId: string;
  url: string;
  title: string;
  fullContent: string;
  chunks: CorpusChunk[];
  images?: Array<{ url: string; description: string }>;  // NEW: Multi-modal support
}

interface CorpusChunk {
  chunkId: string;
  docId: string;
  content: string;
  score: number;
  pruned: boolean;
  embedding?: number[];  // NEW: Vector embedding for semantic search
}

interface ParsedToolCall {
  tool: string;
  args: Record<string, unknown>;
  reasoning: string;
}

interface QueryDecomposition {
  originalQuery: string;
  subqueries: Array<{ query: string; purpose: string }>;
}

interface RetrievalOptions {
  maxChunks?: number;
  maxSteps?: number;
  tokenBudget?: number;
  signal?: AbortSignal;
  onEvent?: (event: RetrievalEvent) => void;
  config?: Partial<typeof DEFAULT_CONFIG>;
  decomposeQuery?: boolean;  // Auto-decompose complex queries
}

// ─── Corpus helpers ───────────────────────────────────────────────────────────

function chunkText(text: string, docId: string, startIdx: number): CorpusChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: CorpusChunk[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE_WORDS) {
    const slice = words.slice(i, i + CHUNK_SIZE_WORDS).join(' ');
    if (slice.trim().length < 30) continue;
    chunks.push({
      chunkId: `${docId}_c${startIdx + chunks.length}`,
      docId,
      content: slice,
      score: 0,
      pruned: false,
    });
  }
  return chunks;
}

/** BM25-lite: count unique query terms present in chunk, length-normalised */
function scoreChunk(chunk: string, queryTerms: string[]): number {
  const lower = chunk.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (lower.includes(term)) hits++;
  }
  const density = hits / (queryTerms.length || 1);
  const lengthBonus = Math.min(chunk.length / 500, 1);
  return density * 0.8 + lengthBonus * 0.2;
}

function tokEst(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function sysTurn(c: string): string { return `${T.START}system${T.CHANNEL}final${T.MSG}${c}${T.END}\n`; }
function usrTurn(c: string): string { return `${T.START}user${T.CHANNEL}final${T.MSG}${c}${T.END}\n`; }
function toolRes(tool: string, json: string): string { return `${T.START}tool to=${tool}${T.CHANNEL}result${T.MSG}${json}${T.END}\n`; }

const SYSTEM_PROMPT = `You are Context-1, a retrieval-only agent. You do NOT generate answers — you find the most relevant document chunks for a query.

Available tools:
  search_corpus(query: str)       — hybrid BM25 + dense vector search, returns top chunks + reranks
  search_images(query: str)       — image similarity search (text or image URL to find relevant images)
  grep_corpus(pattern: str)       — regex search across all chunks in the corpus
  read_document(doc_id: str)      — retrieve full document content by doc ID
  write_chunk(doc_id: str, content: str) — NEW: add new chunk to document
  update_chunk(chunk_id: str, content: str) — NEW: update existing chunk content
  delete_chunk(chunk_id: str)     — NEW: remove chunk from corpus
  prune_chunks(chunk_ids: list)   — remove irrelevant chunks to free token budget

STRATEGY:
1. Start with search_corpus using the original query and varied reformulations
2. Execute 2–4 diverse searches to get broad coverage across different aspects
3. Use grep_corpus for specific terms, numbers, or proper nouns
4. Use read_document when a chunk looks very promising and you need full context
5. Watch your token budget — when it gets high, prune chunks that are off-topic or redundant
6. Stop (output text with no tool calls) when you have 8–15 high-quality, diverse chunks

TOKEN BUDGET:
After each tool result you will see "[Token usage: X/32,768]".
When usage exceeds 50%, actively prune low-quality chunks before searching more.
When usage exceeds 85%, you MUST prune — no other tools will be accepted.

DEDUPLICATION:
Search results automatically exclude previously seen chunks. Use varied queries to find new content.`;

// ─── Robust tool call parser ──────────────────────────────────────────────────

/**
 * Find ALL tool calls in a model response.
 * Handles three observed format variants:
 *   1. commentary to=TOOL <|constrain|>json<|message|>{args}<|call|>
 *   2. to=TOOL<|channel|>commentary N<|message|>{args}
 *   3. to=TOOL<|channel|>commentary <|constrain|>json<|message|>{args}
 */
function findToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const toRe = /\bto=([a-zA-Z_]+)/g;
  let m: RegExpExecArray | null;

  while ((m = toRe.exec(text)) !== null) {
    const tool = m[1];
    const afterTo = text.slice(m.index + m[0].length);

    // Find the next <|message|> after the "to=" marker
    const msgIdx = afterTo.indexOf(T.MSG);
    if (msgIdx === -1) continue;

    const afterMsg = afterTo.slice(msgIdx + T.MSG.length);

    // Content goes until <|call|>, <|end|>, or next <|start|>
    const terminators = [T.CALL, T.END, T.START];
    let endIdx = Infinity;
    for (const t of terminators) {
      const i = afterMsg.indexOf(t);
      if (i !== -1 && i < endIdx) endIdx = i;
    }
    const jsonStr = (endIdx === Infinity ? afterMsg : afterMsg.slice(0, endIdx)).trim();

    // Extract reasoning (after <|call|> if present)
    let reasoning = '';
    const callIdx = afterTo.indexOf(T.CALL);
    if (callIdx !== -1) {
      const afterCall = afterTo.slice(callIdx + T.CALL.length);
      const reasonMsgIdx = afterCall.indexOf(T.MSG);
      if (reasonMsgIdx !== -1) {
        const afterReasonMsg = afterCall.slice(reasonMsgIdx + T.MSG.length);
        const reasonEnd = afterReasonMsg.indexOf(T.END);
        reasoning = (reasonEnd !== -1 ? afterReasonMsg.slice(0, reasonEnd) : afterReasonMsg).trim();
      }
    }

    // Parse JSON args
    try {
      const args = JSON.parse(jsonStr) as Record<string, unknown>;
      calls.push({ tool, args, reasoning });
    } catch {
      // Try extracting just the JSON object
      const jm = jsonStr.match(/(\{[\s\S]*?\})/);
      if (jm) {
        try {
          const args = JSON.parse(jm[1]) as Record<string, unknown>;
          calls.push({ tool, args, reasoning });
        } catch { /* skip malformed */ }
      }
    }
  }

  return calls;
}

// ─── Ollama raw generate ──────────────────────────────────────────────────────

/**
 * Call Ollama /api/generate directly — NO stop token.
 * Context-1 outputs multi-turn sequences (analysis → final → tool call) so
 * we let it generate fully and scan the entire output for tool calls.
 *
 * Includes timeout protection (30s) to prevent indefinite hangs.
 */
async function ollamaGenerate(prompt: string, signal?: AbortSignal): Promise<string> {
  const endpoint = INFRASTRUCTURE.ollamaUrl;

  // Compose abort signal with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_CONFIG.generateTimeout);
  const composedSignal = signal && signal.aborted ? signal : controller.signal;

  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONTEXT1_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.0,
          num_predict: 800,
          repeat_penalty: 1.05,
        },
      }),
      signal: composedSignal,
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed: HTTP ${response.status}`);
    }

    const data = await response.json() as { response: string };
    return data.response ?? '';
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Hybrid search (BM25 + dense vectors) ─────────────────────────────────────

/**
 * Hybrid search combining BM25 keyword matching with vector semantic similarity.
 * Chunks that score high in both methods get highest final scores.
 */
async function execHybridSearch(
  query: string,
  corpus: Map<string, CorpusDoc>,
  seenChunkIds: Set<string>,
  remainingBudget: number,
  signal?: AbortSignal
): Promise<CorpusChunk[]> {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  try {
    // Generate query embedding
    const { embedding: queryEmbedding } = await generateEmbedding(query, signal);

    // Get all candidate chunks
    const candidates: CorpusChunk[] = [];
    for (const doc of corpus.values()) {
      for (const chunk of doc.chunks) {
        if (!chunk.pruned && !seenChunkIds.has(chunk.chunkId)) {
          candidates.push(chunk);
        }
      }
    }

    // Score by BM25
    const bm25Scores = new Map<string, number>();
    for (const chunk of candidates) {
      bm25Scores.set(chunk.chunkId, scoreChunk(chunk.content, queryTerms));
    }

    // Score by vector similarity — batch-generate missing embeddings in parallel
    const missingEmbeddings = candidates.filter(c => !c.embedding);
    if (missingEmbeddings.length > 0) {
      await Promise.all(missingEmbeddings.map(async (chunk) => {
        try {
          const { embedding } = await generateEmbedding(chunk.content, signal);
          chunk.embedding = embedding;
        } catch (err) {
          log.warn(`Failed to embed chunk ${chunk.chunkId}`, {}, err);
          chunk.embedding = Array(768).fill(0); // fallback zero vector
        }
      }));
    }

    const vectorScores = new Map<string, number>();
    for (const chunk of candidates) {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding!);
      vectorScores.set(chunk.chunkId, similarity);
    }

    // Combine scores (average of both, weighted)
    const combinedScores = new Map<string, number>();
    for (const chunk of candidates) {
      const bm25 = bm25Scores.get(chunk.chunkId) || 0;
      const vector = vectorScores.get(chunk.chunkId) || 0;

      // Weight: 40% BM25, 60% vector (semantic > keyword)
      const combined = bm25 * 0.4 + vector * 0.6;
      combinedScores.set(chunk.chunkId, combined);
    }

    // Select top chunks by combined score
    const scored = candidates
      .map(c => ({ ...c, score: combinedScores.get(c.chunkId) || 0 }))
      .sort((a, b) => b.score - a.score);

    // Truncate to fit budget
    const results: CorpusChunk[] = [];
    let budgetUsed = 0;
    for (const c of scored) {
      const cTokens = tokEst(c.content);
      if (budgetUsed + cTokens > remainingBudget * 0.3) break;
      results.push(c);
      budgetUsed += cTokens;
      seenChunkIds.add(c.chunkId);
      if (results.length >= 12) break;
    }

    return results;
  } catch (err) {
    log.warn('Hybrid search failed, falling back to BM25', {}, err);
    // Fall back to BM25-only search
    return execSearchCorpus(query, corpus, seenChunkIds, remainingBudget, signal);
  }
}

// ─── Tool executors ───────────────────────────────────────────────────────────

async function execSearchCorpus(
  query: string,
  corpus: Map<string, CorpusDoc>,
  seenChunkIds: Set<string>,
  remainingBudget: number,
  signal?: AbortSignal
): Promise<CorpusChunk[]> {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  // Fetch new web content via Wayfarer if under doc limit
  if (corpus.size < MAX_CORPUS_DOCS) {
    try {
      const result = await wayfarerService.research(query, 5, signal);
      for (const page of result.pages) {
        if (corpus.has(page.url)) continue;
        const docId = `d${corpus.size + 1}`;
        const content = page.content || page.snippet;
        // FIX #5: Use cached chunks if content unchanged
        const contentHash = corpusCache.hashContent(content);
        let chunks = corpusCache.get(docId, contentHash);
        if (!chunks) {
          chunks = chunkText(content, docId, 0);
          corpusCache.set(docId, content, chunks);
        }
        for (const c of chunks) c.score = scoreChunk(c.content, queryTerms);
        corpus.set(page.url, {
          docId, url: page.url, title: page.title,
          fullContent: content, chunks,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      log.warn('Wayfarer search failed, using in-memory corpus only', {}, err);
    }
  }

  // Score all non-pruned, non-duplicate chunks
  const scored: CorpusChunk[] = [];
  for (const doc of corpus.values()) {
    for (const c of doc.chunks) {
      if (c.pruned || seenChunkIds.has(c.chunkId)) continue;
      scored.push({ ...c, score: scoreChunk(c.content, queryTerms) });
    }
  }

  // Sort by score, truncate to fit remaining token budget
  scored.sort((a, b) => b.score - a.score);
  const results: CorpusChunk[] = [];
  let budgetUsed = 0;
  for (const c of scored) {
    const cTokens = tokEst(c.content);
    if (budgetUsed + cTokens > remainingBudget * 0.3) break; // don't use more than 30% of remaining budget per search
    results.push(c);
    budgetUsed += cTokens;
    seenChunkIds.add(c.chunkId);
    if (results.length >= 12) break;
  }

  return results;
}

function execGrepCorpus(
  pattern: string,
  corpus: Map<string, CorpusDoc>,
  seenChunkIds: Set<string>
): CorpusChunk[] {
  let regex: RegExp;
  try { regex = new RegExp(pattern, 'i'); }
  catch { regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }

  const matches: CorpusChunk[] = [];
  for (const doc of corpus.values()) {
    for (const c of doc.chunks) {
      if (!c.pruned && !seenChunkIds.has(c.chunkId) && regex.test(c.content)) {
        matches.push({ ...c, score: 0.7 });
        seenChunkIds.add(c.chunkId);
      }
    }
  }
  return matches.slice(0, 5);
}

function execReadDocument(
  docId: string,
  corpus: Map<string, CorpusDoc>,
  remainingBudget: number
): string {
  for (const doc of corpus.values()) {
    if (doc.docId === docId) {
      // Truncate to remaining budget (cap at ~25% of remaining)
      const maxChars = Math.min(doc.fullContent.length, Math.floor(remainingBudget * 0.25 * CHARS_PER_TOKEN));
      return doc.fullContent.slice(0, maxChars);
    }
  }
  return `Document "${docId}" not found in corpus.`;
}

function execPruneChunks(chunkIds: string[], corpus: Map<string, CorpusDoc>): { pruned: number; tokensFreed: number } {
  let pruned = 0;
  let tokensFreed = 0;
  for (const doc of corpus.values()) {
    for (const c of doc.chunks) {
      if (chunkIds.includes(c.chunkId) && !c.pruned) {
        c.pruned = true;
        pruned++;
        tokensFreed += tokEst(c.content);
      }
    }
  }
  return { pruned, tokensFreed };
}

async function execSearchImages(
  query: string,
  corpus: Map<string, CorpusDoc>,
  seenChunkIds: Set<string>,
  signal?: AbortSignal
): Promise<CorpusChunk[]> {
  // Extract all images from corpus
  const images: Array<{ chunkId: string; docId: string; url: string; description: string }> = [];

  for (const doc of corpus.values()) {
    if (doc.images) {
      doc.images.forEach((img, idx) => {
        images.push({
          chunkId: `${doc.docId}_img${idx}`,
          docId: doc.docId,
          url: img.url,
          description: img.description,
        });
      });
    }
  }

  if (images.length === 0) return [];

  // Score images by query relevance (simple text matching on descriptions)
  const queryTerms = query.toLowerCase().split(/\s+/);
  const scored = images
    .filter(img => !seenChunkIds.has(img.chunkId))
    .map(img => {
      const descLower = img.description.toLowerCase();
      let matches = 0;
      for (const term of queryTerms) {
        if (descLower.includes(term)) matches++;
      }
      const score = matches / (queryTerms.length || 1);
      return { img, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Convert to CorpusChunk format
  return scored.map(({ img, score }) => {
    seenChunkIds.add(img.chunkId);
    return {
      chunkId: img.chunkId,
      docId: img.docId,
      content: `[IMAGE] ${img.url}\n${img.description}`,
      score,
      pruned: false,
    };
  });
}

function execWriteChunk(
  docId: string,
  content: string,
  corpus: Map<string, CorpusDoc>
): { success: boolean; chunkId?: string; error?: string } {
  const doc = corpus.get(docId);
  if (!doc) {
    return { success: false, error: `Document ${docId} not found` };
  }

  // Create new chunk
  const newChunkId = `${docId}_c${doc.chunks.length}`;
  const newChunk: CorpusChunk = {
    chunkId: newChunkId,
    docId,
    content,
    score: 1.0,
    pruned: false,
  };

  doc.chunks.push(newChunk);
  return { success: true, chunkId: newChunkId };
}

function execUpdateChunk(
  chunkId: string,
  content: string,
  corpus: Map<string, CorpusDoc>
): { success: boolean; error?: string } {
  for (const doc of corpus.values()) {
    const chunk = doc.chunks.find(c => c.chunkId === chunkId);
    if (chunk) {
      chunk.content = content;
      return { success: true };
    }
  }

  return { success: false, error: `Chunk ${chunkId} not found` };
}

function execDeleteChunk(
  chunkId: string,
  corpus: Map<string, CorpusDoc>
): { success: boolean; error?: string } {
  for (const doc of corpus.values()) {
    const idx = doc.chunks.findIndex(c => c.chunkId === chunkId);
    if (idx >= 0) {
      doc.chunks.splice(idx, 1);
      return { success: true };
    }
  }

  return { success: false, error: `Chunk ${chunkId} not found` };
}

// ─── Query decomposition ──────────────────────────────────────────────────────

/**
 * Decompose a complex query into subqueries using the model.
 * Useful for multi-faceted questions like "find X, compare Y, identify Z"
 */
async function decomposeQuery(query: string, signal?: AbortSignal): Promise<QueryDecomposition> {
  const decompositionPrompt = `${T.START}system${T.CHANNEL}final${T.MSG}You are a query decomposition assistant. Break down complex queries into focused subqueries.

Output format:
SUBQUERY: [focused search query 1]
PURPOSE: [what this finds]

SUBQUERY: [focused search query 2]
PURPOSE: [what this finds]

(up to 3 subqueries)${T.END}

${T.START}user${T.CHANNEL}final${T.MSG}${query}${T.END}

${T.START}assistant${T.CHANNEL}final${T.MSG}`;

  try {
    const response = await ollamaGenerate(decompositionPrompt, signal);
    const subqueries: Array<{ query: string; purpose: string }> = [];

    // Parse SUBQUERY: ... PURPOSE: ... pattern
    const subqRegex = /SUBQUERY:\s*([^\n]+)\s*PURPOSE:\s*([^\n]+)/g;
    let match;
    while ((match = subqRegex.exec(response)) !== null) {
      subqueries.push({
        query: match[1].trim(),
        purpose: match[2].trim(),
      });
    }

    return {
      originalQuery: query,
      subqueries: subqueries.length > 0 ? subqueries : [{ query, purpose: 'Original query' }],
    };
  } catch (err) {
    log.warn('Query decomposition failed, using original query', {}, err);
    return {
      originalQuery: query,
      subqueries: [{ query, purpose: 'Original query' }],
    };
  }
}

// ─── Document Analysis API ────────────────────────────────────────────────────

/**
 * Find specific sections/paragraphs matching a query
 * Uses Context-1's grep-like tool to locate relevant text chunks
 */
export async function findSections(
  document: string,
  query: string,
  maxResults: number = 10,
  signal?: AbortSignal
): Promise<string[]> {
  try {
    log.debug('Finding sections matching query', { queryLength: query.length, docLength: document.length, maxResults });

    const result = await context1Service.retrieve(query, {
      maxChunks: maxResults,
      maxSteps: 10,
      signal,
      onEvent: (evt: RetrievalEvent) => {
        if (evt.type === 'error') {
          log.warn('Context-1 event', evt as unknown as Record<string, unknown>);
        }
      },
    });

    return result.chunks.map((c) => c.content);
  } catch (err) {
    log.warn('findSections failed, falling back to naive search', { error: String(err) });
    // Fallback: simple substring search
    const lines = document.split('\n');
    const matches: string[] = [];
    const queryLower = query.toLowerCase();
    for (const line of lines) {
      if (line.toLowerCase().includes(queryLower) && matches.length < maxResults) {
        matches.push(line);
      }
    }
    return matches;
  }
}

/**
 * Filter document: keep only paragraphs matching criteria
 * Returns a filtered version of the document with only matching sections
 */
export async function filterDocument(
  document: string,
  criteria: string,
  signal?: AbortSignal
): Promise<string> {
  const sections = await findSections(document, criteria, 50, signal);
  return sections.join('\n\n');
}

/**
 * Analyze document structure: find key sections, summarize content
 * Returns overview of document organization
 */
export async function analyzeDocumentStructure(
  document: string,
  signal?: AbortSignal
): Promise<{
  sections: string[];
  keyPoints: string[];
  suggestedEdits: string[];
}> {
  try {
    log.info('Analyzing document structure', { docLength: document.length });

    // Find major section headings
    const headings = findSections(document, 'heading title section chapter', 5, signal);

    // Find key points
    const keyPoints = findSections(document, 'important key finding conclusion summary', 5, signal);

    // Use Context-1 to suggest improvements
    const improvementPrompt =
      `Review this document excerpt and suggest 3 specific improvements:\n\n${document.slice(0, 2000)}...`;
    const improvementResult = await context1Service.retrieve(improvementPrompt, {
      maxChunks: 3,
      maxSteps: 8,
      signal,
    });

    return {
      sections: await Promise.resolve(headings),
      keyPoints: await Promise.resolve(keyPoints),
      suggestedEdits: improvementResult.chunks.map((c) => c.content),
    };
  } catch (err) {
    log.warn('analyzeDocumentStructure failed', { error: String(err) });
    return {
      sections: [],
      keyPoints: [],
      suggestedEdits: [],
    };
  }
}

/**
 * Answer questions about document content
 * Uses Context-1 to find and synthesize relevant sections
 */
export async function askAboutDocument(
  document: string,
  question: string,
  signal?: AbortSignal
): Promise<string> {
  try {
    log.info('Answering document question', { questionLength: question.length, docLength: document.length });

    const result = await context1Service.retrieve(question, {
      maxChunks: 5,
      maxSteps: 12,
      signal,
    });

    if (result.chunks.length === 0) {
      return 'No relevant sections found for this question.';
    }

    // Synthesize answer from chunks
    const synthesisPrompt = `Based on these document excerpts, answer: ${question}\n\nExcerpts:\n${result.chunks
      .map((c) => c.content)
      .join('\n\n')}`;

    return synthesisPrompt;
  } catch (err) {
    log.warn('askAboutDocument failed', { error: String(err) });
    return `Error analyzing document: ${String(err)}`;
  }
}

// ─── Main harness ─────────────────────────────────────────────────────────────

export const context1Service = {
  /**
   * Run a retrieval query through the Context-1 harness.
   *
   * Implements Chroma's full observe-reason-act loop with:
   *   - Self-editing context window (token budget tracking + soft/hard thresholds)
   *   - Chunk deduplication across all searches
   *   - Tool execution: search→Wayfarer, grep→regex, read→full doc, prune→evict
   *   - Query decomposition for complex multi-faceted queries
   *   - Parallel tool execution (up to 4 tools per turn)
   *   - Automatic termination on text-only response or budget exhaustion
   */
  async retrieve(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const {
      maxChunks = 10,
      maxSteps = 15,
      tokenBudget = DEFAULT_CONFIG.tokenBudget,
      signal,
      onEvent,
      config: userConfig,
      decomposeQuery: shouldDecompose,
    } = options;

    // Merge user config with defaults
    const cfg = { ...DEFAULT_CONFIG, ...userConfig };
    const startTime = Date.now();

    // Optionally decompose complex query into subqueries
    let queriesToRun = [query];
    if (shouldDecompose) {
      try {
        const decomp = await decomposeQuery(query, signal);
        queriesToRun = decomp.subqueries.map(sq => sq.query);
        log.info(`Query decomposed into ${queriesToRun.length} subqueries`, { decomp });
        onEvent?.({ type: 'observation', tool: 'decompose', chunksFound: queriesToRun.length, message: `Decomposed into: ${queriesToRun.join('; ')}` });
      } catch (err) {
        log.warn('Query decomposition failed, using original', {}, err);
      }
    }

    // Per-session state (shared across all subqueries)
    const corpus = new Map<string, CorpusDoc>();
    const seenChunkIds = new Set<string>();
    const toolCallLog: Array<{ tool: string; args: string; resultChunks: number }> = [];
    let totalChunksCollected = 0;

    let step = 0;
    let tokensUsed = 0;
    let prunedTokens = 0;       // tokens reclaimed by prune_chunks
    let softWarningIssued = false;

    // Build initial prompt with all queries (if decomposed, they're already separated)
    const combinedQuery = queriesToRun.length > 1
      ? `Research these topics in order and collect relevant chunks for each:\n${queriesToRun.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : query;

    let prompt = sysTurn(SYSTEM_PROMPT) + usrTurn(combinedQuery) + `${T.START}assistant`;
    tokensUsed += tokEst(prompt);

    try {
      while (step < maxSteps) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // ── Generate (no stop token — model outputs multi-turn sequences) ──
        const responseText = await ollamaGenerate(prompt, signal);
        tokensUsed += tokEst(responseText);

        // Append full response to prompt (ensure clean end)
        const lastEnd = responseText.lastIndexOf(T.END);
        const cleanResponse = lastEnd !== -1
          ? responseText.slice(0, lastEnd + T.END.length)
          : responseText + T.END;
        prompt += cleanResponse + '\n';

        // ── Parse for tool calls ──
        const toolCalls = findToolCalls(responseText);

        if (toolCalls.length === 0) {
          // No tool calls — model has finished retrieving
          onEvent?.({ type: 'done', tokensUsed, tokenBudget, message: 'Retrieval complete' });
          break;
        }

        // Execute ALL tool calls in parallel (Chroma design: avg 2.56 tools/turn)
        const toolsToExecute = toolCalls.slice(0, DEFAULT_CONFIG.maxParallelTools);

        // Calculate effective budget ONCE for all tools
        const netTokensUsed = tokensUsed - prunedTokens;
        const effectiveBudget = tokenBudget - netTokensUsed;
        const usageRatio = netTokensUsed / tokenBudget;

        // Check budget before executing any tools
        for (const tc of toolsToExecute) {
          onEvent?.({ type: 'tool_call', tool: tc.tool, args: JSON.stringify(tc.args), tokensUsed, tokenBudget, message: tc.reasoning });
        }

        // ── Token budget enforcement ──

        if (usageRatio >= cfg.hardCutoff) {
          // Hard cutoff: only allow prune_chunks
          const nonPrune = toolsToExecute.filter(t => t.tool !== 'prune_chunks');
          if (nonPrune.length > 0) {
            const rejection = `[BUDGET EXCEEDED: ${netTokensUsed}/${tokenBudget} tokens (${Math.round(usageRatio * 100)}%). Only prune_chunks is allowed. Prune irrelevant chunks or conclude by outputting your final assessment with no tool calls.]`;
            for (const tc of nonPrune) {
              prompt += toolRes(tc.tool, JSON.stringify({ error: 'Budget exceeded — only prune_chunks allowed' }));
            }
            prompt += `\n${rejection}\n${T.START}assistant`;
            onEvent?.({ type: 'budget_warning', tokensUsed, tokenBudget, message: 'Hard cutoff — only prune allowed' });
            step++;
            continue;
          }
        }

        // Execute tools in parallel — each catches its own errors so one failure doesn't kill the batch
        const toolResults: Array<{ tool: string; result: string; chunks: number }> = [];
        await Promise.all(toolsToExecute.map(async tc => {
          const argsStr = JSON.stringify(tc.args);
          let resultChunks: CorpusChunk[] = [];
          let resultJson = '';

          try {
            switch (tc.tool) {
              case 'search_corpus': {
                const q = (tc.args.query as string) || query;
                // Try hybrid search first (BM25 + vectors)
                resultChunks = await execHybridSearch(q, corpus, seenChunkIds, effectiveBudget, signal);

                // Rerank if we have enough chunks
                if (resultChunks.length > 1) {
                  try {
                    const reranked = await rerankChunks(
                      q,
                      resultChunks.map(c => ({ chunkId: c.chunkId, content: c.content })),
                      { enabled: true }
                    );
                    // Update scores and sort by rerank score
                    resultChunks = resultChunks.map((c, i) => ({
                      ...c,
                      score: reranked.find(r => r.chunkId === c.chunkId)?.relevanceScore ?? c.score,
                    }))
                    .sort((a, b) => b.score - a.score);
                    onEvent?.({ type: 'observation', tool: 'rerank', chunksFound: resultChunks.length });
                  } catch (err) {
                    log.warn('Reranking failed, using hybrid search results', {}, err);
                  }
                }

                const serialized = resultChunks.map(c => ({
                  chunk_id: c.chunkId,
                  doc_id: c.docId,
                  content: c.content,
                  score: +c.score.toFixed(3),
                  metadata: { url: [...corpus.entries()].find(([, d]) => d.docId === c.docId)?.[0] ?? '' },
                }));
                resultJson = JSON.stringify(serialized);
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: resultChunks.length });
                break;
              }

              case 'grep_corpus': {
                const pattern = (tc.args.pattern as string) || '';
                resultChunks = execGrepCorpus(pattern, corpus, seenChunkIds);
                resultJson = JSON.stringify(resultChunks.map(c => ({
                  chunk_id: c.chunkId, doc_id: c.docId, content: c.content, score: c.score,
                })));
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: resultChunks.length });
                break;
              }

              case 'read_document': {
                const docId = (tc.args.doc_id as string) || '';
                const content = execReadDocument(docId, corpus, effectiveBudget);
                // Add document chunks to deduplication set
                for (const doc of corpus.values()) {
                  if (doc.docId === docId) {
                    for (const c of doc.chunks) {
                      seenChunkIds.add(c.chunkId);
                    }
                    break;
                  }
                }
                resultJson = JSON.stringify({ doc_id: docId, content });
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: 1 });
                break;
              }

              case 'search_images': {
                const q = (tc.args.query as string) || query;
                resultChunks = await execSearchImages(q, corpus, seenChunkIds, signal);
                resultJson = JSON.stringify(resultChunks.map(c => ({
                  chunk_id: c.chunkId,
                  content: c.content,
                  score: +c.score.toFixed(3),
                })));
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: resultChunks.length });
                break;
              }

              case 'write_chunk': {
                const docId = (tc.args.doc_id as string) || '';
                const content = (tc.args.content as string) || '';
                const result = execWriteChunk(docId, content, corpus);
                resultJson = JSON.stringify(result);
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: result.success ? 1 : 0 });
                break;
              }

              case 'update_chunk': {
                const chunkId = (tc.args.chunk_id as string) || '';
                const content = (tc.args.content as string) || '';
                const result = execUpdateChunk(chunkId, content, corpus);
                resultJson = JSON.stringify(result);
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: result.success ? 1 : 0 });
                break;
              }

              case 'delete_chunk': {
                const chunkId = (tc.args.chunk_id as string) || '';
                const result = execDeleteChunk(chunkId, corpus);
                resultJson = JSON.stringify(result);
                onEvent?.({ type: 'observation', tool: tc.tool, chunksFound: result.success ? 1 : 0 });
                break;
              }

              case 'prune_chunks': {
                const ids = (tc.args.chunk_ids as string[]) || [];
                const result = execPruneChunks(ids, corpus);
                prunedTokens += result.tokensFreed;
                resultJson = JSON.stringify({ pruned: result.pruned, tokens_freed: result.tokensFreed });
                onEvent?.({ type: 'prune', chunksPruned: result.pruned, tokensUsed });
                break;
              }

              default:
                resultJson = JSON.stringify({ error: `Unknown tool: ${tc.tool}` });
            }

            toolResults.push({ tool: tc.tool, result: resultJson, chunks: resultChunks.length });
            tokensUsed += tokEst(resultJson);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            toolResults.push({ tool: tc.tool, result: JSON.stringify({ error: errMsg }), chunks: 0 });
            onEvent?.({ type: 'error', message: `Tool ${tc.tool} failed: ${errMsg}` });
          }
        }));

        // ── Inject all tool results + token usage observation ──
        for (const { tool, result } of toolResults) {
          prompt += toolRes(tool, result);
          toolCallLog.push({ tool, args: JSON.stringify(toolsToExecute.find(t => t.tool === tool)?.args ?? {}), resultChunks: toolResults.find(r => r.tool === tool)?.chunks ?? 0 });
        }

        const usageAfter = tokensUsed - prunedTokens;
        let observation = `\n[Token usage: ${usageAfter.toLocaleString()}/${tokenBudget.toLocaleString()}]\n`;

        // Soft threshold warning
        if (!softWarningIssued && usageAfter / tokenBudget >= cfg.softThreshold) {
          observation += `[Note: Context is filling up (${Math.round(usageAfter / tokenBudget * 100)}%). Consider pruning irrelevant chunks before searching more. Use prune_chunks to free space.]\n`;
          softWarningIssued = true;
          onEvent?.({ type: 'budget_warning', tokensUsed: usageAfter, tokenBudget, message: 'Soft threshold — consider pruning' });
        }

        prompt += observation + `${T.START}assistant`;
        step++;
      }

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        log.info('Context-1 retrieval aborted');
        throw err;
      }
      log.error('Context-1 harness error', {}, err);
      onEvent?.({ type: 'error', message: err instanceof Error ? err.message : 'Unknown' });
    }

    // ── Collect final ranked chunks ──
    const allChunks: RetrievedChunk[] = [];
    for (const doc of corpus.values()) {
      for (const c of doc.chunks) {
        if (!c.pruned && c.score > 0) {
          allChunks.push({
            chunkId: c.chunkId,
            docId: c.docId,
            content: c.content,
            score: c.score,
            metadata: { url: doc.url, title: doc.title },
          });
        }
      }
    }

    return {
      chunks: allChunks.sort((a, b) => b.score - a.score).slice(0, maxChunks),
      tokensUsed,
      steps: step,
      durationMs: Date.now() - startTime,
      toolCalls: toolCallLog,
    };
  },

  /** Health check — verifies chromadb-context-1:latest is available on Ollama */
  async healthCheck(): Promise<Context1HealthResult> {
    const endpoint = INFRASTRUCTURE.ollamaUrl;
    const start = Date.now();
    try {
      const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(30000) });
      const latencyMs = Date.now() - start;
      if (!res.ok) return { status: 'disconnected', endpoint, latencyMs, error: `HTTP ${res.status}` };
      const data = await res.json() as { models: Array<{ name: string }> };
      const loaded = data.models?.some(m => m.name.includes('chromadb-context-1')) ?? false;
      return {
        status: loaded ? 'connected' : 'disconnected',
        endpoint, latencyMs, modelLoaded: loaded,
        error: loaded ? undefined : 'chromadb-context-1 not found',
      };
    } catch (err) {
      return {
        status: 'disconnected', endpoint,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },

  async isAvailable(): Promise<boolean> {
    try { return (await this.healthCheck()).status === 'connected'; }
    catch { return false; }
  },
};

// ─── Cached availability ──────────────────────────────────────────────────────

let _cachedHealth: { ok: boolean; ts: number } | null = null;
const CACHE_TTL = 30_000;

export async function isContext1Available(): Promise<boolean> {
  if (_cachedHealth && Date.now() - _cachedHealth.ts < CACHE_TTL) return _cachedHealth.ok;
  const ok = await context1Service.isAvailable();
  _cachedHealth = { ok, ts: Date.now() };
  return ok;
}
