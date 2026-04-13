/**
 * MemoryVault.tsx -- Phase F Long-Term Memory UI
 *
 * Shows the campaign's memory store organized by type.
 * Tabs: Insights/Patterns, Audience, Creative, Failures, Successes, Global
 * Each entry: content, confidence bar, usage badge, tags, impact.
 * Search, delete, health stats.
 */

import { useState, useCallback, useMemo } from 'react';
import type { MemoryEntry, MemoryEntryType } from '../types/memory';
import { useMemoryStore } from '../hooks/useMemoryStore';

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface ConfidenceBarProps {
  value: number; // 0-1
}

function ConfidenceBar({ value }: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75
      ? 'bg-emerald-500'
      : pct >= 50
      ? 'bg-amber-500'
      : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/40 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

interface ImpactBadgeProps {
  impact: 'high' | 'medium' | 'low';
}

function ImpactBadge({ impact }: ImpactBadgeProps) {
  const cls =
    impact === 'high'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      : impact === 'medium'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-white/5 text-white/40 border-white/10';

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${cls} font-medium`}>
      {impact}
    </span>
  );
}

interface MemoryCardProps {
  entry: MemoryEntry;
  onDelete: (id: string) => void;
}

function MemoryCard({ entry, onDelete }: MemoryCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="group bg-white/5 border border-white/10 rounded-xl p-3 space-y-2 hover:border-white/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white/85 leading-relaxed flex-1">{entry.content}</p>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {showConfirm ? (
            <>
              <button
                onClick={() => onDelete(entry.id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-500/10"
              >
                Delete
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-xs text-white/40 hover:text-white/60 px-2 py-0.5"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-xs text-white/30 hover:text-white/60 px-1.5 py-0.5"
              title="Delete memory"
            >
              x
            </button>
          )}
        </div>
      </div>

      {/* Confidence */}
      <ConfidenceBar value={entry.confidence} />

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ImpactBadge impact={entry.impact} />
          {entry.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30 shrink-0">
          {entry.usageCount > 0 && (
            <span className="bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20">
              {entry.usageCount}x used
            </span>
          )}
          <span>{date}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────

type Tab =
  | 'insights'
  | 'audience'
  | 'creative'
  | 'failures'
  | 'successes'
  | 'global';

const TABS: { id: Tab; label: string; types: MemoryEntryType[] | null }[] = [
  { id: 'insights', label: 'Insights', types: ['insight', 'pattern'] },
  { id: 'audience', label: 'Audience', types: ['audience'] },
  { id: 'creative', label: 'Creative', types: ['creative'] },
  { id: 'failures', label: 'Failures', types: ['failure'] },
  { id: 'successes', label: 'Successes', types: ['success'] },
  { id: 'global', label: 'Global', types: null },
];

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface MemoryVaultProps {
  campaignId: string | null;
}

export function MemoryVault({ campaignId }: MemoryVaultProps) {
  const [activeTab, setActiveTab] = useState<Tab>('insights');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    store,
    globalMemories,
    isLoading,
    error,
    deleteEntry,
    prune,
    totalEntries,
    avgConfidence,
  } = useMemoryStore(campaignId);

  // ── Tab entries ─────────────────────────────────────────────

  const entriesForTab = useMemo((): MemoryEntry[] => {
    if (!store && activeTab !== 'global') return [];

    if (activeTab === 'global') return globalMemories;

    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab || !tab.types || !store) return [];

    const all: MemoryEntry[] = [];
    for (const type of tab.types) {
      switch (type) {
        case 'insight':
        case 'pattern':
          all.push(...store.globalInsights.filter((e) => e.type === type));
          break;
        case 'audience':
          all.push(...store.audiencePatterns);
          break;
        case 'creative':
          all.push(...store.creativePatterns);
          break;
        case 'failure':
          all.push(...store.failurePatterns);
          break;
        case 'success':
          all.push(...store.successPatterns);
          break;
      }
    }
    return all;
  }, [store, globalMemories, activeTab]);

  // ── Filtered by search ──────────────────────────────────────

  const filtered = useMemo((): MemoryEntry[] => {
    if (!searchQuery.trim()) return entriesForTab;
    const q = searchQuery.toLowerCase();
    return entriesForTab.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [entriesForTab, searchQuery]);

  // ── Handlers ────────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string) => {
      deleteEntry(id);
    },
    [deleteEntry]
  );

  const handlePrune = useCallback(() => {
    prune();
  }, [prune]);

  // ── Tab counts ──────────────────────────────────────────────

  const tabCount = useCallback(
    (tab: Tab): number => {
      if (!store && tab !== 'global') return 0;
      if (tab === 'global') return globalMemories.length;
      const t = TABS.find((t) => t.id === tab);
      if (!t || !t.types || !store) return 0;
      let n = 0;
      for (const type of t.types) {
        if (type === 'insight' || type === 'pattern')
          n += store.globalInsights.filter((e) => e.type === type).length;
        else if (type === 'audience') n += store.audiencePatterns.length;
        else if (type === 'creative') n += store.creativePatterns.length;
        else if (type === 'failure') n += store.failurePatterns.length;
        else if (type === 'success') n += store.successPatterns.length;
      }
      return n;
    },
    [store, globalMemories]
  );

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  if (!campaignId) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30 text-sm">
        No campaign selected
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white/90">Memory Vault</h2>
            <p className="text-xs text-white/40 mt-0.5">Long-term campaign learnings</p>
          </div>
          <button
            onClick={handlePrune}
            className="text-xs text-white/30 hover:text-white/60 px-2 py-1 rounded bg-white/5 border border-white/10 transition-colors"
            title="Remove stale low-impact entries"
          >
            Prune
          </button>
        </div>

        {/* Health stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-white/90 tabular-nums">{totalEntries}</p>
            <p className="text-xs text-white/40">Entries</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-white/90 tabular-nums">
              {Math.round(avgConfidence * 100)}%
            </p>
            <p className="text-xs text-white/40">Avg Confidence</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-white/90 tabular-nums">
              {store?.totalCycles ?? 0}
            </p>
            <p className="text-xs text-white/40">Cycles</p>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {TABS.map((tab) => {
          const count = tabCount(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors relative ${
                isActive
                  ? 'text-white/90 border-b-2 border-indigo-400'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 text-xs px-1 rounded-full ${
                    isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-white/30'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-white/30 text-sm">
            Loading memories...
          </div>
        )}

        {error && !isLoading && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            {error}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-white/25 text-sm gap-1">
            <span>No memories yet</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {!isLoading &&
          !error &&
          filtered.map((entry) => (
            <MemoryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
            />
          ))}

        {activeTab === 'global' && filtered.length > 0 && (
          <p className="text-xs text-white/25 text-center pt-2">
            Cross-campaign insights -- shared across all campaigns
          </p>
        )}
      </div>
    </div>
  );
}
