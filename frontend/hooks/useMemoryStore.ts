/**
 * useMemoryStore.ts -- React hook for Long-Term Memory (Phase F)
 *
 * Wraps longTermMemory.ts utilities with React state.
 * Loads on mount, provides save/search/getRelevant helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MemoryEntry, MemoryStore, MemoryEntryType } from '../types/memory';
import {
  loadMemories,
  loadGlobalMemories,
  saveMemory,
  deleteMemoryEntry,
  searchMemories,
  getRelevantMemoriesForContext,
  pruneStaleMemories,
  consolidateMemories,
  extractLearnedPatterns,
  batchSaveMemories,
} from '../utils/longTermMemory';

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export interface UseMemoryStoreReturn {
  store: MemoryStore | null;
  globalMemories: MemoryEntry[];
  isLoading: boolean;
  error: string | null;

  // Actions
  saveMemory: (entry: MemoryEntry) => Promise<void>;
  batchSave: (entries: MemoryEntry[]) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  searchMemories: (query: string, type?: MemoryEntryType) => Promise<MemoryEntry[]>;
  getRelevantMemories: (context: string, limit?: number) => Promise<MemoryEntry[]>;

  // Utility
  extractPatterns: () => string[];
  consolidate: (entries: MemoryEntry[], signal?: AbortSignal) => Promise<MemoryEntry[]>;
  prune: () => Promise<void>;
  reload: () => Promise<void>;

  // Stats
  totalEntries: number;
  avgConfidence: number;
}

export function useMemoryStore(campaignId: string | null): UseMemoryStoreReturn {
  const [store, setStore] = useState<MemoryStore | null>(null);
  const [globalMemories, setGlobalMemories] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campaignIdRef = useRef<string | null>(null);

  // ── Load on mount / campaignId change ──────────────────────

  const reload = useCallback(async () => {
    if (!campaignId) {
      setStore(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [loaded, globals] = await Promise.all([
        loadMemories(campaignId),
        loadGlobalMemories(),
      ]);
      setStore(loaded);
      setGlobalMemories(globals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    campaignIdRef.current = campaignId;
    reload();
  }, [campaignId, reload]);

  // ── Save ────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (entry: MemoryEntry) => {
      await saveMemory(entry);
      if (campaignIdRef.current === entry.campaignId) {
        await reload();
      }
    },
    [reload]
  );

  // ── Batch save ──────────────────────────────────────────────

  const handleBatchSave = useCallback(
    async (entries: MemoryEntry[]) => {
      await batchSaveMemories(entries);
      await reload();
    },
    [reload]
  );

  // ── Delete ──────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (entryId: string) => {
      if (!campaignId) return;
      await deleteMemoryEntry(campaignId, entryId);
      await reload();
    },
    [campaignId, reload]
  );

  // ── Search ──────────────────────────────────────────────────

  const handleSearch = useCallback(
    async (query: string, type?: MemoryEntryType): Promise<MemoryEntry[]> => {
      return searchMemories(query, campaignId ?? undefined, type);
    },
    [campaignId]
  );

  // ── Get relevant ────────────────────────────────────────────

  const handleGetRelevant = useCallback(
    async (context: string, limit = 10): Promise<MemoryEntry[]> => {
      if (!campaignId) return [];
      return getRelevantMemoriesForContext(campaignId, context, limit);
    },
    [campaignId]
  );

  // ── Prune ───────────────────────────────────────────────────

  const handlePrune = useCallback(async () => {
    if (!store) return;
    const pruned = await pruneStaleMemories(store);
    setStore(pruned);
  }, [store]);

  // ── Extract patterns ────────────────────────────────────────

  const handleExtractPatterns = useCallback((): string[] => {
    if (!store) return [];
    return extractLearnedPatterns(store);
  }, [store]);

  // ── Stats ───────────────────────────────────────────────────

  const allEntries: MemoryEntry[] = store
    ? [
        ...store.globalInsights,
        ...store.audiencePatterns,
        ...store.creativePatterns,
        ...store.failurePatterns,
        ...store.successPatterns,
      ]
    : [];

  const totalEntries = allEntries.length;

  const avgConfidence =
    totalEntries > 0
      ? allEntries.reduce((sum, e) => sum + e.confidence, 0) / totalEntries
      : 0;

  return {
    store,
    globalMemories,
    isLoading,
    error,
    saveMemory: handleSave,
    batchSave: handleBatchSave,
    deleteEntry: handleDelete,
    searchMemories: handleSearch,
    getRelevantMemories: handleGetRelevant,
    extractPatterns: handleExtractPatterns,
    consolidate: consolidateMemories,
    prune: handlePrune,
    reload,
    totalEntries,
    avgConfidence,
  };
}
