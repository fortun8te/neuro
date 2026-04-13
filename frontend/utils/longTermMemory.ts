/**
 * longTermMemory.ts -- Phase F Long-Term Memory System
 *
 * Persistent ad-campaign learnings stored in IndexedDB (idb-keyval).
 * Supports per-campaign stores + cross-campaign global insights.
 * LLM deduplication and consolidation via qwen3.5:2b.
 * Automatic pruning of stale, low-impact entries older than 30 days.
 */

import { get, set, keys, del } from 'idb-keyval';
import type { MemoryEntry, MemoryStore, MemoryEntryType } from '../types/memory';
import { ollamaService } from './ollama';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CAMPAIGN_MEMORY_PREFIX = 'memory-';
const GLOBAL_MEMORY_KEY = 'memory-global';
const CONSOLIDATION_MODEL = 'qwen3.5:2b';
const STALE_DAYS = 30;
const MAX_ENTRIES_PER_BUCKET = 200;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `ltm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyStore(campaignId: string): MemoryStore {
  return {
    campaignId,
    globalInsights: [],
    audiencePatterns: [],
    creativePatterns: [],
    failurePatterns: [],
    successPatterns: [],
    totalCycles: 0,
    lastUpdated: Date.now(),
  };
}

function bucketForType(store: MemoryStore, type: MemoryEntryType): MemoryEntry[] {
  switch (type) {
    case 'insight':
    case 'pattern':
      return store.globalInsights;
    case 'audience':
      return store.audiencePatterns;
    case 'creative':
      return store.creativePatterns;
    case 'failure':
      return store.failurePatterns;
    case 'success':
      return store.successPatterns;
    default:
      return store.globalInsights;
  }
}

function allEntries(store: MemoryStore): MemoryEntry[] {
  return [
    ...store.globalInsights,
    ...store.audiencePatterns,
    ...store.creativePatterns,
    ...store.failurePatterns,
    ...store.successPatterns,
  ];
}

function daysSince(ts: number): number {
  return (Date.now() - ts) / 86_400_000;
}

/**
 * Relevance score for sorting: combines recency + confidence + usage.
 * Returns 0-1.
 */
function scoreEntry(entry: MemoryEntry): number {
  const LAMBDA = Math.LN2 / 30; // 30-day half-life
  const ageDays = daysSince(entry.lastUsed);
  const recency = Math.exp(-LAMBDA * Math.max(0, ageDays));
  const freq = Math.min(1, entry.usageCount / 10);
  const impactBoost = entry.impact === 'high' ? 1.2 : entry.impact === 'medium' ? 1.0 : 0.8;
  return Math.min(1, (0.5 * recency + 0.3 * entry.confidence + 0.2 * freq) * impactBoost);
}

// ─────────────────────────────────────────────────────────────
// Core CRUD — IndexedDB
// ─────────────────────────────────────────────────────────────

/**
 * Save a single MemoryEntry into the campaign's MemoryStore.
 * Creates the store if it doesn't exist yet.
 * Skips exact-content duplicates within the same type bucket.
 */
export async function saveMemory(entry: MemoryEntry): Promise<void> {
  try {
    const store = await loadMemories(entry.campaignId);
    const bucket = bucketForType(store, entry.type);

    // Dedup: skip if identical content already in bucket
    const isDup = bucket.some(
      (e) => e.content.trim().toLowerCase() === entry.content.trim().toLowerCase()
    );
    if (isDup) return;

    bucket.push(entry);

    // Cap bucket size — evict lowest-scored entries
    if (bucket.length > MAX_ENTRIES_PER_BUCKET) {
      bucket.sort((a, b) => scoreEntry(b) - scoreEntry(a));
      bucket.splice(MAX_ENTRIES_PER_BUCKET);
    }

    store.lastUpdated = Date.now();
    await set(`${CAMPAIGN_MEMORY_PREFIX}${entry.campaignId}`, store);

    // Mirror high-impact insights to the global store for cross-campaign learning
    if (entry.impact === 'high' && (entry.type === 'insight' || entry.type === 'pattern' || entry.type === 'success')) {
      await saveGlobalInsight(entry);
    }
  } catch (e) {
    console.warn('[longTermMemory] saveMemory failed:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Load the full MemoryStore for a campaign.
 * Returns an empty store (not persisted yet) if none exists.
 */
export async function loadMemories(campaignId: string): Promise<MemoryStore> {
  try {
    const stored = await get<MemoryStore>(`${CAMPAIGN_MEMORY_PREFIX}${campaignId}`);
    if (stored) return stored;
    return emptyStore(campaignId);
  } catch (e) {
    console.warn('[longTermMemory] loadMemories failed:', e instanceof Error ? e.message : String(e));
    return emptyStore(campaignId);
  }
}

/**
 * Load cross-campaign global insights (high-impact, broadly applicable patterns).
 */
export async function loadGlobalMemories(): Promise<MemoryEntry[]> {
  try {
    const stored = await get<MemoryEntry[]>(GLOBAL_MEMORY_KEY);
    return stored ?? [];
  } catch (e) {
    console.warn('[longTermMemory] loadGlobalMemories failed:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function saveGlobalInsight(entry: MemoryEntry): Promise<void> {
  try {
    const globals = await loadGlobalMemories();
    const isDup = globals.some(
      (e) => e.content.trim().toLowerCase() === entry.content.trim().toLowerCase()
    );
    if (isDup) return;
    globals.push({ ...entry, id: `global-${entry.id}` });
    if (globals.length > 500) {
      globals.sort((a, b) => scoreEntry(b) - scoreEntry(a));
      globals.splice(500);
    }
    await set(GLOBAL_MEMORY_KEY, globals);
  } catch (e) {
    console.warn('[longTermMemory] saveGlobalInsight failed:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Delete a specific memory entry by ID from a campaign's store.
 */
export async function deleteMemoryEntry(campaignId: string, entryId: string): Promise<void> {
  try {
    const store = await loadMemories(campaignId);
    const buckets: (keyof MemoryStore)[] = [
      'globalInsights',
      'audiencePatterns',
      'creativePatterns',
      'failurePatterns',
      'successPatterns',
    ];
    for (const key of buckets) {
      const arr = store[key] as MemoryEntry[];
      const idx = arr.findIndex((e) => e.id === entryId);
      if (idx !== -1) {
        arr.splice(idx, 1);
        break;
      }
    }
    store.lastUpdated = Date.now();
    await set(`${CAMPAIGN_MEMORY_PREFIX}${campaignId}`, store);
  } catch (e) {
    console.warn('[longTermMemory] deleteMemoryEntry failed:', e instanceof Error ? e.message : String(e));
  }
}

// ─────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────

/**
 * Search memories across a campaign store (and optionally global).
 * Returns entries sorted by relevance score descending.
 */
export async function searchMemories(
  query: string,
  campaignId?: string,
  type?: MemoryEntryType,
  includeGlobal = true
): Promise<MemoryEntry[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return [];

  let candidates: MemoryEntry[] = [];

  if (campaignId) {
    const store = await loadMemories(campaignId);
    candidates = type ? bucketForType(store, type) : allEntries(store);
  }

  if (includeGlobal) {
    const globals = await loadGlobalMemories();
    const filtered = type ? globals.filter((e) => e.type === type) : globals;
    candidates = [...candidates, ...filtered];
  }

  // Score by keyword overlap + activation
  const scored = candidates.map((entry) => {
    const text = (entry.content + ' ' + entry.tags.join(' ')).toLowerCase();
    let kwScore = 0;
    for (const word of words) {
      if (text.includes(word)) kwScore += 1;
    }
    const activation = scoreEntry(entry);
    return { entry, score: kwScore * 0.7 + activation * 0.3 };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}

// ─────────────────────────────────────────────────────────────
// LLM Consolidation
// ─────────────────────────────────────────────────────────────

/**
 * Consolidate a list of MemoryEntries using qwen3.5:2b to de-duplicate and merge.
 * Returns a cleaned, merged list. Falls back to original list on LLM failure.
 */
export async function consolidateMemories(
  entries: MemoryEntry[],
  signal?: AbortSignal
): Promise<MemoryEntry[]> {
  if (entries.length <= 3) return entries;

  try {
    const contentList = entries
      .map((e, i) => `[${i}] (${e.type}, confidence: ${e.confidence.toFixed(2)}) ${e.content}`)
      .join('\n');

    const prompt = `You are a memory consolidation agent. Below is a list of marketing insights extracted from ad campaigns.

Your task: identify and merge DUPLICATE or NEAR-DUPLICATE insights. Two insights are duplicates if they express the same core finding even in different words.

For each group of duplicates, keep ONE merged version with the highest confidence. Return ONLY the indices to KEEP (space-separated), nothing else.

INSIGHTS:
${contentList}

Return ONLY the indices to keep (e.g.: 0 2 3 5 7). Do NOT explain. Do NOT use em dashes.`;

    const response = await ollamaService.generateStream(prompt, '', {
      model: CONSOLIDATION_MODEL,
      temperature: 0.1,
      num_predict: 200,
      signal,
    });

    // Parse indices from response
    const indices = response
      .trim()
      .split(/\s+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n < entries.length);

    if (indices.length === 0) return entries;

    return indices.map((i) => entries[i]);
  } catch (e) {
    // Non-critical — return original list on failure
    console.warn('[longTermMemory] consolidateMemories LLM call failed:', e instanceof Error ? e.message : String(e));
    return entries;
  }
}

// ─────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────

/**
 * Rank entries by relevance to the current context string.
 * Combines keyword overlap with activation scoring.
 * Pure synchronous — no LLM needed.
 */
export function rankByRelevance(entries: MemoryEntry[], currentContext: string): MemoryEntry[] {
  const words = currentContext.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const scored = entries.map((entry) => {
    const text = (entry.content + ' ' + entry.tags.join(' ')).toLowerCase();
    let kwScore = 0;
    for (const word of words) {
      if (text.includes(word)) kwScore += 1;
    }
    const activation = scoreEntry(entry);
    return { entry, score: kwScore * 0.6 + activation * 0.4 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}

// ─────────────────────────────────────────────────────────────
// Pruning
// ─────────────────────────────────────────────────────────────

/**
 * Remove stale, low-impact entries older than STALE_DAYS with low usage.
 * Persists updated store to IndexedDB.
 */
export async function pruneStaleMemories(store: MemoryStore): Promise<MemoryStore> {
  const shouldPrune = (entry: MemoryEntry): boolean => {
    const age = daysSince(entry.createdAt);
    const isStale = age > STALE_DAYS;
    const isLowValue = entry.impact === 'low' && entry.usageCount < 2 && entry.confidence < 0.5;
    return isStale && isLowValue;
  };

  const pruneList = (arr: MemoryEntry[]): MemoryEntry[] =>
    arr.filter((e) => !shouldPrune(e));

  const pruned: MemoryStore = {
    ...store,
    globalInsights: pruneList(store.globalInsights),
    audiencePatterns: pruneList(store.audiencePatterns),
    creativePatterns: pruneList(store.creativePatterns),
    failurePatterns: pruneList(store.failurePatterns),
    successPatterns: pruneList(store.successPatterns),
    lastUpdated: Date.now(),
  };

  try {
    await set(`${CAMPAIGN_MEMORY_PREFIX}${store.campaignId}`, pruned);

    // Also prune global memories
    const globals = await loadGlobalMemories();
    const prunedGlobals = globals.filter((e) => !shouldPrune(e));
    await set(GLOBAL_MEMORY_KEY, prunedGlobals);
  } catch (e) {
    console.warn('[longTermMemory] pruneStaleMemories persist failed:', e instanceof Error ? e.message : String(e));
  }

  return pruned;
}

// ─────────────────────────────────────────────────────────────
// Pattern Extraction for Prompt Injection
// ─────────────────────────────────────────────────────────────

/**
 * Extract the top learned patterns from a store as plain strings.
 * Used to inject context into research and make prompts.
 * Returns up to 10 strings, highest-impact first.
 */
export function extractLearnedPatterns(store: MemoryStore): string[] {
  const all = allEntries(store);
  const ranked = rankByRelevance(all, '');
  return ranked
    .filter((e) => e.confidence >= 0.5)
    .slice(0, 10)
    .map((e) => {
      const prefix =
        e.impact === 'high' ? '[HIGH]' : e.impact === 'medium' ? '[MED]' : '[LOW]';
      return `${prefix} [${e.type}] ${e.content}`;
    });
}

/**
 * Get top-N relevant memories for a given context string and campaignId.
 * Merges campaign-specific + global memories, ranks, deduplicates.
 */
export async function getRelevantMemoriesForContext(
  campaignId: string,
  context: string,
  limit = 10
): Promise<MemoryEntry[]> {
  const [store, globals] = await Promise.all([
    loadMemories(campaignId),
    loadGlobalMemories(),
  ]);

  const campaignEntries = allEntries(store);
  // Give global entries a slightly lower base weight
  const combined = [
    ...campaignEntries,
    ...globals.map((e) => ({ ...e, confidence: e.confidence * 0.9 })),
  ];

  const ranked = rankByRelevance(combined, context);

  // Deduplicate by content similarity (first occurrence wins)
  const seen = new Set<string>();
  const deduped: MemoryEntry[] = [];
  for (const entry of ranked) {
    const key = entry.content.trim().toLowerCase().slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(entry);
    }
    if (deduped.length >= limit) break;
  }

  return deduped;
}

// ─────────────────────────────────────────────────────────────
// Batch helpers
// ─────────────────────────────────────────────────────────────

/**
 * Bulk-save multiple MemoryEntries efficiently (single store read/write per campaignId batch).
 */
export async function batchSaveMemories(entries: MemoryEntry[]): Promise<void> {
  // Group by campaignId
  const byId: Record<string, MemoryEntry[]> = {};
  for (const e of entries) {
    (byId[e.campaignId] = byId[e.campaignId] || []).push(e);
  }

  for (const [campaignId, batch] of Object.entries(byId)) {
    const store = await loadMemories(campaignId);

    for (const entry of batch) {
      const bucket = bucketForType(store, entry.type);
      const isDup = bucket.some(
        (e) => e.content.trim().toLowerCase() === entry.content.trim().toLowerCase()
      );
      if (!isDup) {
        bucket.push(entry);
        // Cap
        if (bucket.length > MAX_ENTRIES_PER_BUCKET) {
          bucket.sort((a, b) => scoreEntry(b) - scoreEntry(a));
          bucket.splice(MAX_ENTRIES_PER_BUCKET);
        }
      }
    }

    store.lastUpdated = Date.now();
    await set(`${CAMPAIGN_MEMORY_PREFIX}${campaignId}`, store);
  }
}

/**
 * List all campaign IDs that have stored memories.
 */
export async function listMemorizedCampaigns(): Promise<string[]> {
  try {
    const allKeys = await keys();
    return (allKeys as string[])
      .filter((k) => typeof k === 'string' && k.startsWith(CAMPAIGN_MEMORY_PREFIX) && k !== GLOBAL_MEMORY_KEY)
      .map((k) => (k as string).slice(CAMPAIGN_MEMORY_PREFIX.length));
  } catch (e) {
    console.warn('[longTermMemory] listMemorizedCampaigns failed:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Wipe all long-term memory for a campaign (for testing / user reset).
 */
export async function clearCampaignMemory(campaignId: string): Promise<void> {
  try {
    await del(`${CAMPAIGN_MEMORY_PREFIX}${campaignId}`);
  } catch (e) {
    console.warn('[longTermMemory] clearCampaignMemory failed:', e instanceof Error ? e.message : String(e));
  }
}

// ─────────────────────────────────────────────────────────────
// Cycle-end extraction helper
// ─────────────────────────────────────────────────────────────

/**
 * Build a MemoryEntry from a raw insight string.
 * Infers type, impact and tags from content keywords.
 */
export function buildMemoryEntry(
  content: string,
  campaignId: string,
  cycleNumber: number,
  overrides: Partial<MemoryEntry> = {}
): MemoryEntry {
  const lower = content.toLowerCase();

  let type: MemoryEntryType = 'insight';
  if (/fail|didn't work|poor|weak|avoid|mistake|backfired/.test(lower)) type = 'failure';
  else if (/success|worked|strong|win|top performer|highest score/.test(lower)) type = 'success';
  else if (/audience|customer|buyer|persona|segment|demographic/.test(lower)) type = 'audience';
  else if (/creative|headline|hook|ad|copy|visual|format|cta/.test(lower)) type = 'creative';
  else if (/pattern|trend|recurring|consistent|always|every/.test(lower)) type = 'pattern';

  let impact: 'high' | 'medium' | 'low' = 'medium';
  if (/critical|key|most important|highest|primary|strongest/.test(lower)) impact = 'high';
  else if (/minor|slight|small|low impact|marginal/.test(lower)) impact = 'low';

  // Extract tags from nouns/keywords
  const tagWords = content
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const now = Date.now();

  return {
    id: generateId(),
    campaignId,
    cycleNumber,
    type,
    content: content.trim(),
    confidence: 0.7,
    usageCount: 0,
    lastUsed: now,
    createdAt: now,
    tags: tagWords,
    impact,
    ...overrides,
  };
}
