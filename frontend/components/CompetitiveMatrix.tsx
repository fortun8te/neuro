// ══════════════════════════════════════════════════════
// ██  CompetitiveMatrix Component
// Table view of all competitors vs brand with gap badges,
// threat color coding, filters, and expandable profiles.
// ══════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import type { CompetitorProfile, CompetitiveMatrix as CompetitiveMatrixType, CompetitiveInsight, CompetitorAnalysisStatus } from '../types/competitive';

// ── Constants ─────────────────────────────────────────

const THREAT_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Minimal' },
  1: { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  label: 'Low' },
  2: { bg: 'bg-orange-500/10',  text: 'text-orange-400',  label: 'Medium' },
  3: { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'High' },
};

const PRICE_LABELS: Record<CompetitorProfile['pricePoint'], string> = {
  budget: 'Budget',
  mid: 'Mid',
  premium: 'Premium',
  luxury: 'Luxury',
};

const INSIGHT_TYPE_COLORS: Record<CompetitiveInsight['type'], string> = {
  gap:         'border-l-indigo-400 bg-indigo-500/5',
  opportunity: 'border-l-emerald-400 bg-emerald-500/5',
  threat:      'border-l-red-400 bg-red-500/5',
  trend:       'border-l-blue-400 bg-blue-500/5',
};

// ── Sub-components ────────────────────────────────────

function ThreatBadge({ level }: { level: 0 | 1 | 2 | 3 }) {
  const c = THREAT_COLORS[level];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          level === 0 ? 'bg-emerald-400' :
          level === 1 ? 'bg-yellow-400' :
          level === 2 ? 'bg-orange-400' : 'bg-red-400'
        }`}
      />
      {c.label}
    </span>
  );
}

function StatusDot({ status }: { status: CompetitorAnalysisStatus['status'] }) {
  if (status === 'analyzing') {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" title="Analyzing..." />
    );
  }
  if (status === 'error') {
    return <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Analysis failed" />;
  }
  if (status === 'complete') {
    return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Complete" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-600" title="Pending" />;
}

function GapBadge({ gap }: { gap: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mr-1 mb-1">
      {gap}
    </span>
  );
}

function CompetitorCard({
  profile,
  status,
  isDark,
  onRemove,
}: {
  profile: CompetitorProfile;
  status?: CompetitorAnalysisStatus;
  isDark: boolean;
  onRemove: (domain: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tc = THREAT_COLORS[profile.threatLevel];

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      isDark
        ? `border-white/[0.08] ${profile.threatLevel === 3 ? 'border-red-500/20' : ''}`
        : `border-black/[0.06] ${profile.threatLevel === 3 ? 'border-red-400/30' : ''}`
    }`}>
      {/* ── Header row ── */}
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'
        }`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status dot */}
        {status && <StatusDot status={status.status} />}

        {/* Favicon */}
        <img
          src={`https://www.google.com/s2/favicons?sz=16&domain=${profile.domain}`}
          alt=""
          className="w-4 h-4 rounded flex-shrink-0 opacity-70"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Name + domain */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-semibold truncate ${isDark ? 'text-white/[0.85]' : 'text-zinc-900'}`}>
              {profile.name}
            </span>
            <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>
              {profile.domain}
            </span>
          </div>
          {profile.positioning && (
            <p className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-white/[0.45]' : 'text-zinc-500'}`}>
              {profile.positioning}
            </p>
          )}
        </div>

        {/* Price + Threat */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            isDark ? 'bg-white/[0.06] text-white/[0.50]' : 'bg-zinc-100 text-zinc-500'
          }`}>
            {PRICE_LABELS[profile.pricePoint]}
          </span>
          <ThreatBadge level={profile.threatLevel} />
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-150 flex-shrink-0 ${isDark ? 'text-white/[0.25]' : 'text-zinc-300'} ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Expanded profile ── */}
      {expanded && (
        <div className={`px-4 pb-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-black/[0.04]'}`}>
          <div className="pt-3 grid grid-cols-2 gap-4">

            {/* Left column */}
            <div className="space-y-3">
              {profile.targetAudience && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Target Audience</p>
                  <p className={`text-[11px] ${isDark ? 'text-white/[0.65]' : 'text-zinc-600'}`}>{profile.targetAudience}</p>
                </div>
              )}

              {profile.keyMessages.length > 0 && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Key Messages</p>
                  <ul className="space-y-0.5">
                    {profile.keyMessages.map((msg, i) => (
                      <li key={i} className={`text-[10px] flex items-start gap-1.5 ${isDark ? 'text-white/[0.60]' : 'text-zinc-600'}`}>
                        <span className="mt-1 w-1 h-1 rounded-full bg-current flex-shrink-0 opacity-40" />
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.channels.length > 0 && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Channels</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.channels.map((ch, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        isDark ? 'bg-white/[0.06] text-white/[0.50]' : 'bg-zinc-100 text-zinc-500'
                      }`}>{ch}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-3">
              {profile.strengths.length > 0 && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Strengths</p>
                  <ul className="space-y-0.5">
                    {profile.strengths.map((s, i) => (
                      <li key={i} className={`text-[10px] flex items-start gap-1.5 text-emerald-500`}>
                        <span className="mt-1 w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        <span className={isDark ? 'text-white/[0.60]' : 'text-zinc-600'}>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.weaknesses.length > 0 && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Weaknesses</p>
                  <ul className="space-y-0.5">
                    {profile.weaknesses.map((w, i) => (
                      <li key={i} className={`text-[10px] flex items-start gap-1.5 text-red-400`}>
                        <span className="mt-1 w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        <span className={isDark ? 'text-white/[0.60]' : 'text-zinc-600'}>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.visualStyle && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Visual Style</p>
                  <p className={`text-[10px] ${isDark ? 'text-white/[0.55]' : 'text-zinc-500'}`}>{profile.visualStyle}</p>
                </div>
              )}

              {profile.ctaStyle && (
                <div>
                  <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>CTA Style</p>
                  <p className={`text-[10px] ${isDark ? 'text-white/[0.55]' : 'text-zinc-500'}`}>{profile.ctaStyle}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {profile.recentActivity.length > 0 && (
            <div className="mt-3">
              <p className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-white/[0.30]' : 'text-zinc-400'}`}>Recent Activity</p>
              <div className="flex flex-wrap gap-1">
                {profile.recentActivity.map((a, i) => (
                  <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                  }`}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Remove button */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(profile.domain); }}
              className={`text-[10px] transition-colors ${
                isDark ? 'text-red-400/50 hover:text-red-400' : 'text-red-400 hover:text-red-600'
              }`}
            >
              Remove competitor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────

interface CompetitiveMatrixProps {
  matrix: CompetitiveMatrixType;
  insights: CompetitiveInsight[];
  competitorStatuses: CompetitorAnalysisStatus[];
  loading: boolean;
  error: string | null;
  isDark: boolean;
  onAddCompetitor: (url: string) => void;
  onRemoveCompetitor: (domain: string) => void;
  onRefresh: () => void;
}

export function CompetitiveMatrix({
  matrix,
  insights,
  competitorStatuses,
  loading,
  error,
  isDark,
  onAddCompetitor,
  onRemoveCompetitor,
  onRefresh,
}: CompetitiveMatrixProps) {
  const [newUrl, setNewUrl] = useState('');
  const [filterPricePoint, setFilterPricePoint] = useState<CompetitorProfile['pricePoint'] | 'all'>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterThreat, setFilterThreat] = useState<number | 'all'>('all');

  const handleAddSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    onAddCompetitor(newUrl.trim());
    setNewUrl('');
  }, [newUrl, onAddCompetitor]);

  // Build filter options from actual data
  const allChannels = Array.from(new Set(matrix.competitors.flatMap(c => c.channels))).sort();

  // Apply filters
  const filteredCompetitors = matrix.competitors.filter(c => {
    if (filterPricePoint !== 'all' && c.pricePoint !== filterPricePoint) return false;
    if (filterChannel !== 'all' && !c.channels.some(ch => ch.toLowerCase() === filterChannel.toLowerCase())) return false;
    if (filterThreat !== 'all' && c.threatLevel !== filterThreat) return false;
    return true;
  });

  // Sort by threat descending
  const sortedCompetitors = [...filteredCompetitors].sort((a, b) => b.threatLevel - a.threatLevel);

  const topThreat = matrix.competitors.length > 0
    ? [...matrix.competitors].sort((a, b) => b.threatLevel - a.threatLevel)[0]
    : null;

  const divider = isDark ? 'border-white/[0.08]' : 'border-black/[0.06]';
  const labelCls = isDark ? 'text-white/[0.35]' : 'text-zinc-400';

  return (
    <div className="flex flex-col gap-5 p-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className={`text-[14px] font-semibold ${isDark ? 'text-white/[0.87]' : 'text-zinc-900'}`}>
            Competitive Intelligence
          </h2>
          <p className={`text-[11px] mt-0.5 ${labelCls}`}>
            {matrix.competitors.length === 0
              ? 'No competitors added yet'
              : `${matrix.competitors.length} competitor${matrix.competitors.length !== 1 ? 's' : ''} tracked`}
            {topThreat && topThreat.threatLevel >= 2 && (
              <span className="ml-2 text-orange-400 font-medium">
                Top threat: {topThreat.name}
              </span>
            )}
          </p>
        </div>

        {matrix.competitors.length > 0 && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`text-[10px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
              isDark
                ? 'bg-white/[0.06] text-white/[0.55] hover:bg-white/[0.10] disabled:opacity-40'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-40'
            }`}
          >
            {loading ? (
              <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            )}
            Refresh Matrix
          </button>
        )}
      </div>

      {/* ── Add competitor form ── */}
      <form onSubmit={handleAddSubmit} className="flex gap-2">
        <input
          type="text"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          placeholder="Add competitor URL (e.g. competitor.com)"
          className={`flex-1 text-[11px] px-3 py-2 rounded-lg outline-none transition-colors ${
            isDark
              ? 'bg-white/[0.05] border border-white/[0.10] text-white/[0.80] placeholder-white/[0.25] focus:border-white/[0.20]'
              : 'bg-white border border-black/[0.10] text-zinc-800 placeholder-zinc-400 focus:border-black/[0.20]'
          }`}
        />
        <button
          type="submit"
          disabled={!newUrl.trim() || loading}
          className={`text-[11px] font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0 ${
            isDark
              ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed'
              : 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          Analyze
        </button>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className={`text-[11px] px-3 py-2 rounded-lg ${
          isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
          {error}
        </div>
      )}

      {/* ── Analyzing status ── */}
      {competitorStatuses.some(s => s.status === 'analyzing') && (
        <div className={`text-[11px] px-3 py-2 rounded-lg flex items-center gap-2 ${
          isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'
        }`}>
          <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0" />
          Analyzing {competitorStatuses.filter(s => s.status === 'analyzing').map(s => s.domain).join(', ')}...
        </div>
      )}

      {/* ── Market Gaps ── */}
      {matrix.marketGaps.length > 0 && (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-indigo-500/[0.05] border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-200/50'}`}>
          <p className={`text-[9px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-indigo-400/70' : 'text-indigo-500'}`}>
            Market Gaps Identified
          </p>
          <div className="flex flex-wrap">
            {matrix.marketGaps.map((gap, i) => (
              <GapBadge key={i} gap={gap} />
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      {matrix.competitors.length > 1 && (
        <div className={`flex items-center gap-3 pb-3 border-b ${divider}`}>
          <span className={`text-[9px] uppercase tracking-wider font-semibold flex-shrink-0 ${labelCls}`}>Filter:</span>

          <select
            value={filterThreat}
            onChange={e => setFilterThreat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className={`text-[10px] px-2 py-1 rounded-md outline-none ${
              isDark ? 'bg-white/[0.06] text-white/[0.55] border border-white/[0.08]' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
            }`}
          >
            <option value="all">All threats</option>
            <option value="3">High threat</option>
            <option value="2">Medium threat</option>
            <option value="1">Low threat</option>
            <option value="0">Minimal threat</option>
          </select>

          <select
            value={filterPricePoint}
            onChange={e => setFilterPricePoint(e.target.value as CompetitorProfile['pricePoint'] | 'all')}
            className={`text-[10px] px-2 py-1 rounded-md outline-none ${
              isDark ? 'bg-white/[0.06] text-white/[0.55] border border-white/[0.08]' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
            }`}
          >
            <option value="all">All prices</option>
            <option value="budget">Budget</option>
            <option value="mid">Mid</option>
            <option value="premium">Premium</option>
            <option value="luxury">Luxury</option>
          </select>

          {allChannels.length > 0 && (
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              className={`text-[10px] px-2 py-1 rounded-md outline-none ${
                isDark ? 'bg-white/[0.06] text-white/[0.55] border border-white/[0.08]' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
              }`}
            >
              <option value="all">All channels</option>
              {allChannels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
          )}

          {(filterThreat !== 'all' || filterPricePoint !== 'all' || filterChannel !== 'all') && (
            <button
              onClick={() => { setFilterThreat('all'); setFilterPricePoint('all'); setFilterChannel('all'); }}
              className={`text-[10px] transition-colors ${isDark ? 'text-white/[0.35] hover:text-white/[0.55]' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Competitor Cards ── */}
      {sortedCompetitors.length > 0 ? (
        <div className="space-y-2">
          {sortedCompetitors.map(profile => (
            <CompetitorCard
              key={profile.domain}
              profile={profile}
              status={competitorStatuses.find(s => s.domain === profile.domain)}
              isDark={isDark}
              onRemove={onRemoveCompetitor}
            />
          ))}
        </div>
      ) : matrix.competitors.length > 0 ? (
        <p className={`text-[11px] text-center py-6 ${labelCls}`}>
          No competitors match the current filters.
        </p>
      ) : null}

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <div>
          <p className={`text-[9px] uppercase tracking-wider font-semibold mb-2 ${labelCls}`}>
            Intelligence Insights ({insights.length})
          </p>
          <div className="space-y-2">
            {insights.slice(0, 8).map((insight, i) => (
              <div
                key={i}
                className={`px-3 py-2.5 rounded-lg border-l-2 text-[11px] ${INSIGHT_TYPE_COLORS[insight.type]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className={isDark ? 'text-white/[0.75]' : 'text-zinc-700'}>
                    {insight.description}
                  </p>
                  <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded capitalize font-medium ${
                    isDark ? 'bg-white/[0.06] text-white/[0.40]' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {insight.type}
                  </span>
                </div>
                {insight.recommendation && insight.recommendation !== insight.description && (
                  <p className={`mt-1.5 text-[10px] ${isDark ? 'text-white/[0.40]' : 'text-zinc-400'}`}>
                    Recommendation: {insight.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Positioning Opportunities ── */}
      {matrix.positioningOpportunities.length > 0 && (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-emerald-500/[0.04] border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200/50'}`}>
          <p className={`text-[9px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600'}`}>
            Positioning Opportunities
          </p>
          <ul className="space-y-1">
            {matrix.positioningOpportunities.map((opp, i) => (
              <li key={i} className={`text-[11px] flex items-start gap-2 ${isDark ? 'text-white/[0.65]' : 'text-zinc-600'}`}>
                <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                {opp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Empty state ── */}
      {matrix.competitors.length === 0 && !loading && (
        <div className={`flex flex-col items-center justify-center py-12 text-center ${labelCls}`}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="mb-3 opacity-30">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
          </svg>
          <p className="text-[12px] font-medium">No competitors tracked yet</p>
          <p className="text-[11px] mt-1 opacity-70">Add competitor URLs above to analyze positioning, pricing, and messaging gaps</p>
        </div>
      )}

      {/* ── Footer timestamp ── */}
      {matrix.timestamp > 0 && matrix.competitors.length > 0 && (
        <p className={`text-[9px] text-center ${labelCls}`}>
          Last updated: {new Date(matrix.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
