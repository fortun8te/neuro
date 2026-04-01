/**
 * computerAgent/memoryLayer.ts — persistent memory for the computer agent.
 *
 * Uses idb-keyval (IndexedDB) to store outcomes from past tasks.
 * Supports keyword-based recall so the planner can learn from history.
 */

import { get, set, keys, del } from 'idb-keyval';
import type { MemoryEntry } from './types';

const MEMORY_PREFIX = 'computer_memory_';
const MAX_MEMORIES = 50;

// ─────────────────────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────────────────────

/**
 * Save a new memory entry to IndexedDB.
 * Prunes oldest entries if over MAX_MEMORIES.
 */
export async function saveMemory(
  entry: Omit<MemoryEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const id = `${MEMORY_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const full: MemoryEntry = { ...entry, id, timestamp: Date.now() };

  await set(id, full);

  // Prune if over limit
  try {
    const allKeys = (await keys()).filter(k => typeof k === 'string' && (k as string).startsWith(MEMORY_PREFIX)) as string[];
    if (allKeys.length > MAX_MEMORIES) {
      // Load entries to find oldest
      const entries: MemoryEntry[] = [];
      for (const k of allKeys) {
        const e = await get<MemoryEntry>(k);
        if (e) entries.push(e);
      }
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = entries.slice(0, entries.length - MAX_MEMORIES);
      for (const e of toDelete) {
        await del(e.id);
      }
    }
  } catch {
    // Pruning is best-effort
  }
}

// ─────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────

/**
 * Simple keyword match: find memories where tags overlap with words in goal.
 * Returns top 3 most recent matching memories.
 */
export async function searchMemory(goal: string): Promise<MemoryEntry[]> {
  const goalWords = goal
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (goalWords.length === 0) return [];

  try {
    const allKeys = (await keys()).filter(k => typeof k === 'string' && (k as string).startsWith(MEMORY_PREFIX)) as string[];

    const entries: MemoryEntry[] = [];
    for (const k of allKeys) {
      const e = await get<MemoryEntry>(k);
      if (e) entries.push(e);
    }

    // Score by tag overlap
    const scored = entries
      .map(e => {
        const tagSet = new Set(e.tags.map(t => t.toLowerCase()));
        const overlap = goalWords.filter(w => tagSet.has(w)).length;
        return { entry: e, score: overlap };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.entry.timestamp - a.entry.timestamp;  // most recent first on tie
      })
      .slice(0, 3);

    return scored.map(({ entry }) => entry);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Build context string for planner
// ─────────────────────────────────────────────────────────────

/**
 * Build a formatted memory context string for the planner.
 * Returns "" if no relevant memories.
 */
export async function buildMemoryContext(goal: string): Promise<string> {
  const memories = await searchMemory(goal);
  if (memories.length === 0) return '';

  return memories
    .map(m => {
      const stepsSummary = m.steps.slice(0, 4).join(' → ');
      return `Past task: [${m.goal}] → ${m.outcome.toUpperCase()}: ${stepsSummary}`;
    })
    .join('\n');
}
