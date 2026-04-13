// ══════════════════════════════════════════════════════
// ██  useCompetitiveIntelligence Hook
// Manages competitor analysis state, persists matrix to IndexedDB
// ══════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import {
  analyzeCompetitor,
  buildCompetitiveMatrix,
  identifyGaps,
} from '../utils/competitiveIntelligence';
import type { CompetitorProfile, CompetitiveMatrix, CompetitiveInsight, CompetitorAnalysisStatus } from '../types/competitive';

interface UseCompetitiveIntelligenceOptions {
  campaignId: string;
  brand: string;
  researchFindings?: Record<string, unknown>;
}

interface UseCompetitiveIntelligenceReturn {
  matrix: CompetitiveMatrix | null;
  loading: boolean;
  /** Per-competitor analysis status */
  competitorStatuses: CompetitorAnalysisStatus[];
  insights: CompetitiveInsight[];
  error: string | null;
  /** Analyze an array of competitor URLs (auto-deduplicates) */
  analyzeCompetitors: (urls: string[], signal?: AbortSignal) => Promise<void>;
  /** Add a single competitor URL and trigger analysis */
  addCompetitor: (url: string) => Promise<void>;
  /** Remove a competitor by domain */
  removeCompetitor: (domain: string) => Promise<void>;
  /** Force-refresh the matrix synthesis (does not re-scrape) */
  refreshMatrix: () => Promise<void>;
  /** Clear all competitive data for this campaign */
  clearMatrix: () => Promise<void>;
}

const DB_KEY_PREFIX = 'competitive-';

function dbKey(campaignId: string): string {
  return `${DB_KEY_PREFIX}${campaignId}`;
}

export function useCompetitiveIntelligence({
  campaignId,
  brand,
  researchFindings = {},
}: UseCompetitiveIntelligenceOptions): UseCompetitiveIntelligenceReturn {
  const [matrix, setMatrix] = useState<CompetitiveMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [competitorStatuses, setCompetitorStatuses] = useState<CompetitorAnalysisStatus[]>([]);
  const [insights, setInsights] = useState<CompetitiveInsight[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the accumulated profiles so callbacks always see fresh data
  const profilesRef = useRef<CompetitorProfile[]>([]);

  // ── Load persisted matrix on mount / campaignId change ──
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await get<CompetitiveMatrix>(dbKey(campaignId));
        if (!cancelled && stored) {
          setMatrix(stored);
          profilesRef.current = stored.competitors;
          setInsights(identifyGaps(stored));
        }
      } catch {
        // IDB read failure — start fresh
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // ── Persist matrix to IndexedDB whenever it changes ──
  const persistMatrix = useCallback(async (m: CompetitiveMatrix) => {
    try {
      await set(dbKey(campaignId), m);
    } catch (err) {
      console.warn('[CompetitiveIntel] IDB persist failed:', err);
    }
  }, [campaignId]);

  // ── Update a single competitor status ──
  const setStatus = useCallback((domain: string, patch: Partial<CompetitorAnalysisStatus>) => {
    setCompetitorStatuses(prev => {
      const existing = prev.find(s => s.domain === domain);
      if (existing) {
        return prev.map(s => s.domain === domain ? { ...s, ...patch } : s);
      }
      return [...prev, { domain, status: 'pending', ...patch }];
    });
  }, []);

  // ── Rebuild matrix from current profiles ──
  const rebuildMatrix = useCallback(async (
    profiles: CompetitorProfile[],
    signal?: AbortSignal
  ): Promise<CompetitiveMatrix> => {
    const m = await buildCompetitiveMatrix(brand, profiles, researchFindings, signal);
    setMatrix(m);
    setInsights(identifyGaps(m));
    await persistMatrix(m);
    return m;
  }, [brand, researchFindings, persistMatrix]);

  // ── Main: analyze an array of competitor URLs ──
  const analyzeCompetitors = useCallback(async (
    urls: string[],
    signal?: AbortSignal
  ): Promise<void> => {
    if (!urls.length) return;
    setLoading(true);
    setError(null);

    // Deduplicate against already-analyzed competitors
    const existingDomains = new Set(profilesRef.current.map(p => p.domain));
    const newUrls = urls.filter(url => {
      const domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0];
      return !existingDomains.has(domain);
    });

    if (!newUrls.length) {
      setLoading(false);
      return;
    }

    // Initialize statuses
    newUrls.forEach(url => {
      const domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0];
      setStatus(domain, { domain, status: 'analyzing', startedAt: Date.now() });
    });

    // Analyze all new URLs (sequential to avoid hammering Wayfarer)
    const newProfiles: CompetitorProfile[] = [];
    for (const url of newUrls) {
      if (signal?.aborted) break;
      const domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0];
      try {
        const profile = await analyzeCompetitor(url, signal);
        newProfiles.push(profile);
        setStatus(domain, { status: 'complete', completedAt: Date.now() });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus(domain, { status: 'error', error: 'Aborted' });
          break;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(domain, { status: 'error', error: msg, completedAt: Date.now() });
        // Continue to next competitor even on failure
      }
    }

    // Merge new profiles with existing
    const allProfiles = [...profilesRef.current, ...newProfiles];
    profilesRef.current = allProfiles;

    // Build updated matrix
    try {
      await rebuildMatrix(allProfiles, signal);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError('Failed to synthesize competitive matrix. Individual profiles are saved.');
      }
    }

    setLoading(false);
  }, [rebuildMatrix, setStatus]);

  // ── Add a single competitor URL ──
  const addCompetitor = useCallback(async (url: string): Promise<void> => {
    await analyzeCompetitors([url]);
  }, [analyzeCompetitors]);

  // ── Remove a competitor by domain ──
  const removeCompetitor = useCallback(async (domain: string): Promise<void> => {
    const filtered = profilesRef.current.filter(p => p.domain !== domain);
    profilesRef.current = filtered;
    setCompetitorStatuses(prev => prev.filter(s => s.domain !== domain));

    if (filtered.length === 0) {
      const empty: CompetitiveMatrix = {
        brand,
        competitors: [],
        marketGaps: [],
        positioningOpportunities: [],
        directThreats: [],
        timestamp: Date.now(),
      };
      setMatrix(empty);
      setInsights([]);
      await persistMatrix(empty);
      return;
    }

    setLoading(true);
    try {
      await rebuildMatrix(filtered);
    } finally {
      setLoading(false);
    }
  }, [brand, rebuildMatrix, persistMatrix]);

  // ── Force-refresh matrix synthesis (no re-scraping) ──
  const refreshMatrix = useCallback(async (): Promise<void> => {
    if (!profilesRef.current.length) return;
    setLoading(true);
    try {
      await rebuildMatrix(profilesRef.current);
    } finally {
      setLoading(false);
    }
  }, [rebuildMatrix]);

  // ── Clear all data for this campaign ──
  const clearMatrix = useCallback(async (): Promise<void> => {
    profilesRef.current = [];
    setMatrix(null);
    setInsights([]);
    setCompetitorStatuses([]);
    try {
      await set(dbKey(campaignId), null);
    } catch {
      // ignore
    }
  }, [campaignId]);

  return {
    matrix,
    loading,
    competitorStatuses,
    insights,
    error,
    analyzeCompetitors,
    addCompetitor,
    removeCompetitor,
    refreshMatrix,
    clearMatrix,
  };
}
