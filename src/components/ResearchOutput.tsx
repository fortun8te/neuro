import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { ShineText } from './ShineText';
import { playSound } from '../hooks/useSoundEngine';
import { visualProgressStore } from '../utils/visualProgressStore';
import type { VisualBatchState } from '../utils/visualProgressStore';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type SectionKind =
  | 'phase'
  | 'campaign'
  | 'step'
  | 'layer'
  | 'orchestrator'
  | 'researcher'
  | 'reflection'
  | 'reflection-perspective'
  | 'visual'
  | 'thinking'
  | 'metrics'
  | 'coverage'
  | 'deploy'
  | 'complete'
  | 'timelimit'
  | 'error'
  | 'findings'
  | 'ads'
  | 'brain'
  | 'council-head'
  | 'council'
  | 'report'
  | 'raw';

interface Section {
  kind: SectionKind;
  title: string;
  lines: string[];
  badge?: string;
  icon?: string;
  isStreaming?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Parser — turns progressive text stream into structured sections
// (unchanged from previous version — robust, battle-tested)
// ─────────────────────────────────────────────────────────────

function parseOutput(text: string): Section[] {
  const sections: Section[] = [];
  const rawLines = text.split('\n');
  let current: Section | null = null;

  const push = () => {
    if (current) {
      while (current.lines.length > 0 && current.lines[current.lines.length - 1].trim() === '') current.lines.pop();
      if (current.lines.length > 0 || current.kind !== 'raw') sections.push(current);
    }
  };

  for (const line of rawLines) {
    const t = line.trim();
    if (!t || /^[─═]{10,}$/.test(t)) continue;

    // ── Phase headers ──
    if (t.startsWith('[PHASE 1]') && (t.includes('Council') || t.includes('Marketing Brains'))) {
      push(); current = { kind: 'phase', title: 'Council of Marketing Brains', badge: 'Phase 1', lines: [] }; continue;
    }
    if (t.startsWith('[PHASE 1]') || t.includes('ORCHESTRATED RESEARCH:') || t.includes('Desire-Driven') || t.startsWith('RESEARCH PHASE:')) {
      if (!current || current.kind !== 'phase' || current.title !== 'Desire-Driven Analysis') {
        push(); current = { kind: 'phase', title: 'Desire-Driven Analysis', badge: 'Phase 1', lines: [] };
      }
      continue;
    }
    if (t.startsWith('[PHASE 1+2 COMPLETE]')) { if (current) current.lines.push('Council verdict delivered'); continue; }
    if (t.startsWith('[PHASE 2]') || t.includes('Orchestrating Web Search')) {
      push(); current = { kind: 'phase', title: 'Web Research Agents', badge: 'Phase 2', lines: [] }; continue;
    }
    if (t.startsWith('[PHASE 3]') && t.includes('Desire-Driven')) {
      push(); current = { kind: 'phase', title: 'Desire-Driven Deep Dive', badge: 'Phase 3', lines: [] }; continue;
    }
    if (t.startsWith('[PHASE 3]') || t.includes('Competitor Ad Intelligence')) {
      push(); current = { kind: 'phase', title: 'Ad Intelligence', badge: 'Phase 3', lines: [] }; continue;
    }
    if (t.startsWith('[PHASE 4]') && t.includes('Web Research')) {
      push(); current = { kind: 'phase', title: 'Web Research - Gap Filling', badge: 'Phase 4', lines: [] }; continue;
    }
    if (t.startsWith('[PHASE 5]') && t.includes('Council Re-run')) {
      push(); current = { kind: 'phase', title: 'Council Re-analysis', badge: 'Phase 5', lines: [] }; continue;
    }
    if (t.startsWith('[PHASE 6]') && t.includes('Competitor')) {
      push(); current = { kind: 'phase', title: 'Competitor Ad Intelligence', badge: 'Phase 6', lines: [] }; continue;
    }

    // ── Competitor Ads ──
    if (t.includes('[Ads]')) {
      const inner = t.replace(/.*\[Ads\]\s*/, '').trim();
      if (!current || current.kind !== 'ads') { push(); current = { kind: 'ads', title: 'Competitor Ads', badge: 'fetching', lines: [] }; }
      const metaMatch = inner.match(/Meta API:\s*(\d+)\s*ads found for "(.+?)"/);
      if (metaMatch) { const prev = parseInt(current.badge?.match(/\d+/)?.[0] || '0') || 0; current.badge = `${prev + parseInt(metaMatch[1])} ads`; }
      const completeMatch = inner.match(/Complete:\s*(\d+)\s*ad examples.*?(\d+)\s*vision/);
      if (completeMatch) current.badge = `${completeMatch[1]} ads`;
      if (inner.includes('Creative opportunities found:')) { current.lines.push(`Opportunities: ${inner.replace('Creative opportunities found:', '').trim()}`); continue; }
      if (inner) current.lines.push(inner);
      continue;
    }

    if (/^\[PHASE \d/.test(t) && t.includes('COMPLETE]')) { if (current) current.lines.push(t.replace(/\[PHASE \d+ COMPLETE\]\s*/, '').trim() || 'Complete'); continue; }
    if (/^\[PHASE \d/.test(t) && t.includes('ERROR]')) { if (current) current.lines.push(t.replace(/\[PHASE \d+ ERROR\]\s*/, '').trim()); continue; }

    // ── Council ──
    if (t.startsWith('[COUNCIL]') && t.includes('Council of Marketing Brains')) {
      push(); const m = t.match(/Iteration\s+(\d+)\/(\d+)/);
      current = { kind: 'council', title: 'Council of Marketing Brains', badge: m ? `Run ${m[1]}` : 'starting', lines: [] }; continue;
    }
    if (t.startsWith('[COUNCIL]') && t.includes('Round 1')) { push(); current = { kind: 'council', title: 'Round 1 - 7 Brains', badge: 'parallel', lines: [] }; continue; }
    if (t.startsWith('[COUNCIL]') && t.includes('Round 2')) { push(); current = { kind: 'council-head', title: 'Round 2 - Council Heads', badge: 'synthesizing', lines: [] }; continue; }
    if (t.startsWith('[COUNCIL]') && t.includes('Round 3')) { push(); current = { kind: 'council', title: 'Round 3 - Master Verdict', badge: 'deciding', lines: [] }; continue; }
    if (t.startsWith('[COUNCIL]') && t.includes('Verdict delivered')) {
      const m = t.match(/confidence:\s*(\d+)/);
      if (current) { current.badge = m ? `${m[1]}/10` : 'done'; current.lines.push(t.replace('[COUNCIL] ', '')); }
      continue;
    }
    if (t.startsWith('[COUNCIL]')) {
      if (!current || (current.kind !== 'council' && current.kind !== 'council-head')) { push(); current = { kind: 'council', title: 'Council', lines: [] }; }
      current.lines.push(t.replace('[COUNCIL] ', '')); continue;
    }

    // ── Report ──
    if (t.startsWith('[REPORT]')) {
      if (!current || current.kind !== 'report') { push(); current = { kind: 'report', title: 'Research Report', lines: [] }; }
      const c = t.replace('[REPORT] ', '').replace('[REPORT]', ''); if (c.trim()) current.lines.push(c); continue;
    }

    // ── Brain ──
    const brainMatch = t.match(/^\[BRAIN:(\w+)\]\s*(.+)/);
    if (brainMatch) {
      const names: Record<string, string> = { desire: 'Desire Brain', persuasion: 'Persuasion Brain', offer: 'Offer Brain', creative: 'Creative Brain', avatar: 'Avatar Brain', contrarian: 'Contrarian Brain', visual: 'Visual Brain' };
      if (brainMatch[2].includes('analyzing')) { push(); current = { kind: 'brain', title: names[brainMatch[1]] || brainMatch[1], badge: 'analyzing', lines: [] }; }
      else if (brainMatch[2].includes('Failed')) { if (current?.kind === 'brain') current.badge = 'failed'; if (current) current.lines.push(brainMatch[2]); }
      else { if (current) current.lines.push(brainMatch[2]); }
      continue;
    }

    // ── Council Head ──
    const headMatch = t.match(/^\[HEAD:(\S+)\]\s*(.+)/);
    if (headMatch) {
      const names: Record<string, string> = { 'strategy-head': 'Strategy Head', 'creative-head': 'Creative Head', 'challenge-head': 'Challenge Head' };
      if (headMatch[2].includes('synthesizing')) { push(); current = { kind: 'council-head', title: names[headMatch[1]] || headMatch[1], badge: 'synthesizing', lines: [] }; }
      else { if (current) current.lines.push(headMatch[2]); }
      continue;
    }

    // ── Campaign ──
    if (t.startsWith('[CAMPAIGN_DATA]')) { push(); current = { kind: 'campaign', title: 'Campaign Brief', lines: [] }; continue; }

    // ── Steps ──
    const stepMatch = t.match(/^STEP\s+(\d+):\s*(.+)/i);
    if (stepMatch) { push(); current = { kind: 'step', title: stepMatch[2], badge: `Step ${stepMatch[1]}`, lines: [] }; continue; }

    // ── Layers ──
    const layerMatch = t.match(/^LAYER\s+(\d+)[:\s—]+(.+)/i);
    if (layerMatch) { push(); current = { kind: 'layer', title: layerMatch[2].trim(), badge: `Layer ${layerMatch[1]}`, lines: [] }; continue; }
    const layerSubMatch = t.match(/^\s*\[Layer\s+(\d+)\]\s*(.+)/);
    if (layerSubMatch) { if (current?.kind === 'layer') current.lines.push(layerSubMatch[2]); continue; }

    // ── Reflection perspectives ──
    const reflPerspMatch = t.match(/\[Reflection:\s*(Devil's Advocate|Depth Auditor|Coverage Checker)\]\s*(.*)/);
    if (reflPerspMatch) {
      push();
      current = { kind: 'reflection-perspective', title: reflPerspMatch[1], badge: reflPerspMatch[1] === "Devil's Advocate" ? 'bias check' : reflPerspMatch[1] === 'Depth Auditor' ? 'specifics' : 'gaps', lines: [] };
      if (reflPerspMatch[2]) current.lines.push(reflPerspMatch[2]); continue;
    }

    // ── Findings ──
    if (t.startsWith('Identified') && t.includes('desire hierarch')) { if (current?.kind === 'step') { current.badge = (current.badge || '') + ` · ${t.match(/(\d+)/)?.[1]} desires`; current.lines.push(t); } continue; }
    if (t.startsWith('Found') && t.includes('objection')) { if (current?.kind === 'step') { current.badge = (current.badge || '') + ` · ${t.match(/(\d+)/)?.[1]} objections`; current.lines.push(t); } continue; }

    // ── Orchestrator ──
    if (t.includes('[Orchestrator]')) {
      push();
      const iterMatch = t.match(/Iteration\s+(\d+)\/(\d+)/);
      const timeMatch = t.match(/\((\d+)s elapsed\)/);
      current = { kind: 'orchestrator', title: iterMatch ? `Iteration ${iterMatch[1]}/${iterMatch[2]}` : 'Orchestrator', badge: timeMatch ? `${timeMatch[1]}s` : undefined, lines: [] };
      if (t.includes('Pausing')) current.lines.push('Waiting for user input...');
      continue;
    }
    if (t.includes('Deploying') && t.includes('researcher')) {
      const m = t.match(/Deploying\s+(\d+)/);
      if (current?.kind === 'orchestrator') { current.badge = m ? `${m[1]} agents` : current.badge; current.lines.push(`Deploying ${m?.[1] || ''} agents`); }
      continue;
    }
    if (t.includes('[Orchestrator]') && t.includes('→')) {
      const m = t.match(/→\s*"(.+?)"/);
      if (m && current?.kind === 'orchestrator') current.lines.push(`→ "${m[1]}"`);
      continue;
    }
    if (t.includes('[Orchestrator]') && t.includes('Decision:')) {
      if (current?.kind === 'orchestrator') current.lines.push(t.replace(/.*\[Orchestrator\]\s*Decision:\s*/, ''));
      continue;
    }

    // ── Researcher ──
    if (t.includes('[Researcher]')) {
      const inner = t.replace(/.*\[Researcher\]\s*/, '').replace(/^[🔎📄⚠️]\s*/, '');
      if (inner.includes('Searching:')) {
        push();
        const m = inner.match(/Searching:\s*"?(.+?)"?\s*\.{0,3}$/);
        current = { kind: 'researcher', title: m ? m[1].slice(0, 50) : 'Web Search', badge: 'searching', lines: [] };
        continue;
      }
      if (inner.includes('Fetched')) {
        const m = inner.match(/Fetched\s+(\d+)\/(\d+)\s+pages\s+\((.+?)s\)/);
        if (m && current?.kind === 'researcher') current.badge = `${m[1]}/${m[2]} pages`;
        if (current) current.lines.push(inner); continue;
      }
      if (inner.includes('Compress')) { if (current) current.lines.push(inner); continue; }
      if (current) current.lines.push(inner); continue;
    }

    // ── Visual Scout ──
    if (t.includes('[Visual Scout]')) {
      const inner = t.replace(/.*\[Visual Scout\]\s*/, '');
      if (inner.includes('Screenshotting') || inner.includes('Orchestrator requested') || inner.includes('Reflection agent requested')) {
        push();
        const m = inner.match(/(\d+)/);
        current = { kind: 'visual', title: inner.includes('Screenshotting') ? 'Capturing Screenshots' : 'Visual Analysis', badge: m ? `${m[1]} pages` : undefined, lines: [] };
        continue;
      }
      if (!current || current.kind !== 'visual') { push(); current = { kind: 'visual', title: 'Visual Scout', badge: undefined, lines: [] }; }
      if (inner.includes('Analyzed') && inner.includes('competitor')) { const m = inner.match(/(\d+)/); if (m) current.badge = `${m[1]} analyzed`; }
      if (inner.includes('complete')) { current.badge = inner.match(/(\d+)\s+sites/)?.[0] || current.badge; }
      current.lines.push(inner); continue;
    }

    // ── Thinking ──
    if (t.startsWith('[Orchestrator thinking]') || t.startsWith('[Thinking]')) {
      const inner = t.replace(/.*\[(Orchestrator thinking|Thinking)\]\s*/, '');
      if (!current || current.kind !== 'thinking') { push(); current = { kind: 'thinking', title: 'Reasoning', badge: 'live', lines: [] }; }
      if (inner) current.lines.push(inner); continue;
    }

    // ── Metrics ──
    if (t.startsWith('[METRICS]')) {
      push();
      try {
        const json = JSON.parse(t.replace('[METRICS] ', ''));
        const elapsed = json.elapsedSec >= 60 ? `${Math.floor(json.elapsedSec / 60)}m ${json.elapsedSec % 60}s` : `${json.elapsedSec}s`;
        current = { kind: 'metrics', title: `${json.coveragePct}% Coverage`, badge: elapsed, lines: [`${json.coveredDims}/${json.totalDims} dimensions covered`, `${json.totalSources || 0} sources · ${json.totalQueries} queries`] };
      } catch { current = { kind: 'raw', title: 'Metrics', lines: [t] }; }
      continue;
    }

    // ── Reflection ──
    if (t.includes('Running reflection agent') || t.includes('150% bar mode')) { push(); current = { kind: 'reflection', title: 'Reflection', badge: '150% bar', lines: [] }; continue; }
    if (t.includes('[Reflection]')) {
      const inner = t.replace(/.*\[Reflection\]\s*/, '');
      if (!current || current.kind !== 'reflection') { push(); current = { kind: 'reflection', title: 'Reflection', badge: '150% bar', lines: [] }; }
      current.lines.push(inner); continue;
    }
    if (t.includes('Reflection found')) {
      const m = t.match(/found\s+(\d+)\s+gaps/);
      if (current?.kind === 'reflection') { current.badge = m ? `${m[1]} gaps` : current.badge; current.lines.push(t.replace(/^.*?🎯\s*/, '')); }
      continue;
    }

    // ── Coverage ──
    if (t.includes('Coverage:') && t.includes('dimensions')) {
      push();
      const m = t.match(/Coverage:\s*(\d+)%\s*\((\d+)\/(\d+)/);
      const threshMatch = t.match(/threshold:\s*(\d+)%/);
      current = { kind: 'coverage', title: m ? `${m[1]}% Coverage` : 'Coverage', badge: m ? `${m[2]}/${m[3]}` : undefined, lines: threshMatch ? [`Target: ${threshMatch[1]}%`] : [] };
      continue;
    }

    // ── Terminal states ──
    if (t.includes('research complete') || t.includes('RESEARCH COMPLETE') || t.includes('Coverage threshold reached') || t.includes('Orchestrator satisfied')) {
      push(); current = { kind: 'complete', title: 'Research Complete', lines: [t.replace(/^.*?[✓✅]\s*/, '')] }; continue;
    }
    if (t.includes('Time limit reached')) { push(); current = { kind: 'timelimit', title: 'Time Limit', lines: [t.replace(/^.*?⏱️\s*/, '')] }; continue; }
    if (t.startsWith('ERROR') || (t.startsWith('⚠️') && !t.includes('[Reflection]'))) { push(); current = { kind: 'error', title: 'Error', lines: [t] }; continue; }

    // ── Skip boilerplate ──
    if (t.includes('orchestrator deciding what additional research') || t.includes('orchestrator evaluating')) { if (current) current.lines.push('Evaluating research gaps...'); continue; }
    if (t.startsWith('User provided:') && current) { current.lines.push(t); continue; }

    // ── Fallback ──
    if (current) { current.lines.push(t); } else { current = { kind: 'raw', title: 'Output', lines: [t] }; }
  }

  push();
  return sections;
}

// ─────────────────────────────────────────────────────────────
// Incremental parse header regex
// ─────────────────────────────────────────────────────────────

const SECTION_HEADER_RE = /\[PHASE [1-6]\]|Competitor Ad Intelligence|ORCHESTRATED RESEARCH:|Council of Marketing Brains|Desire-Driven|Orchestrating Web Search|\[CAMPAIGN_DATA\]|STEP \d+:|LAYER \d+[:\s—]|Iteration \d+\/|Searching:\s*"|Screenshotting|Orchestrator requested visual|Reflection agent requested visual|Running reflection agent|150% bar mode|\[Reflection:\s*(Devil's Advocate|Depth Auditor|Coverage Checker)\]|Coverage:\s*\d+%.*dimensions|research complete|RESEARCH COMPLETE|Coverage threshold|Orchestrator satisfied|Time limit reached|^ERROR|\[METRICS\]|\[Orchestrator thinking\]|\[Thinking\]|\[Ads\]|\[BRAIN:\w+\]|\[HEAD:\S+\]|\[COUNCIL\]/im;

// ─────────────────────────────────────────────────────────────
// Color system
// ─────────────────────────────────────────────────────────────

type ColorKey = 'emerald' | 'blue' | 'teal' | 'amber' | 'red' | 'zinc';

function kindColor(kind: SectionKind): ColorKey {
  const map: Record<string, ColorKey> = {
    phase: 'zinc', step: 'blue', layer: 'blue', orchestrator: 'blue', researcher: 'teal',
    reflection: 'amber', 'reflection-perspective': 'amber', coverage: 'zinc', visual: 'teal', thinking: 'zinc',
    metrics: 'zinc', deploy: 'teal', complete: 'emerald', timelimit: 'amber',
    error: 'red', ads: 'teal', campaign: 'zinc', findings: 'zinc', raw: 'zinc',
    brain: 'teal', 'council-head': 'amber', council: 'blue', report: 'blue',
  };
  return map[kind] || 'zinc';
}

const DARK_COLORS: Record<ColorKey, string> = {
  emerald: '#34d399', blue: '#60a5fa', teal: '#2dd4bf', amber: '#fbbf24', red: '#f87171', zinc: '#71717a',
};
const LIGHT_COLORS: Record<ColorKey, string> = {
  emerald: '#059669', blue: '#2563eb', teal: '#0d9488', amber: '#d97706', red: '#dc2626', zinc: '#a1a1aa',
};

// ─────────────────────────────────────────────────────────────
// Coverage Bar
// ─────────────────────────────────────────────────────────────

function CoverageBar({ pct, dark, compact }: { pct: number; dark: boolean; compact?: boolean }) {
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`}>
      <div className={`${compact ? 'w-12' : 'flex-1'} h-1 rounded-full overflow-hidden ${dark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums`} style={{ color }}>{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Timeline Action — single item in the left timeline
// ─────────────────────────────────────────────────────────────

function TimelineAction({
  section, isFirst, isLast, isActive, isSelected, onClick, dark,
}: {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
  dark: boolean;
}) {
  const color = kindColor(section.kind);
  const accent = dark ? DARK_COLORS[color] : LIGHT_COLORS[color];
  const isDone = section.kind === 'complete';
  const isError = section.kind === 'error';
  const isTimeout = section.kind === 'timelimit';
  const covPct = (section.kind === 'coverage' || section.kind === 'metrics')
    ? parseInt(section.title.match(/(\d+)%/)?.[1] || '0') : null;

  // Phase divider — horizontal break in the timeline
  if (section.kind === 'phase') {
    return (
      <div className="relative flex items-center py-3 px-4">
        <div className={`h-px flex-1 ${dark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <span className={`px-2.5 text-[9px] uppercase tracking-[0.15em] font-semibold ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {section.badge ? `${section.badge}` : ''} {section.title}
        </span>
        <div className={`h-px flex-1 ${dark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
      </div>
    );
  }

  // Status circle
  const circleColor = (() => {
    if (isActive) return '#3b82f6';
    if (isDone) return '#22c55e';
    if (isError) return '#ef4444';
    if (isTimeout) return '#f59e0b';
    return accent;
  })();

  return (
    <div className="relative flex">
      {/* Connector column */}
      <div className="flex flex-col items-center" style={{ width: 28, flexShrink: 0 }}>
        {/* Top line */}
        <div className={`w-px flex-1 ${isFirst ? 'bg-transparent' : dark ? 'bg-zinc-800/80' : 'bg-zinc-200'}`} />
        {/* Circle */}
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300 ${isActive ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: (isActive || isDone || isError || isTimeout) ? circleColor : 'transparent',
            border: `2px solid ${circleColor}`,
            boxShadow: isActive ? `0 0 8px ${circleColor}40` : 'none',
          }}
        />
        {/* Bottom line */}
        <div className={`w-px flex-1 ${isLast ? 'bg-transparent' : dark ? 'bg-zinc-800/80' : 'bg-zinc-200'}`} />
      </div>

      {/* Content */}
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-2 py-2 pl-2 pr-3 text-left rounded-r-lg transition-all duration-150 min-w-0 ${
          isSelected
            ? dark ? 'bg-zinc-800/70' : 'bg-blue-50/80'
            : dark ? 'hover:bg-zinc-800/30' : 'hover:bg-zinc-50'
        }`}
      >
        {/* Title */}
        <span className={`flex-1 text-[12px] truncate ${
          isActive ? (dark ? 'text-zinc-100 font-medium' : 'text-zinc-800 font-medium') :
          isDone ? (dark ? 'text-emerald-400/80' : 'text-emerald-600') :
          isError ? (dark ? 'text-red-400' : 'text-red-600') :
          dark ? 'text-zinc-400' : 'text-zinc-600'
        }`}>
          {section.title}
        </span>

        {/* Coverage bar (inline) */}
        {covPct !== null && (
          <div className="flex-shrink-0">
            <CoverageBar pct={covPct} dark={dark} compact />
          </div>
        )}

        {/* Badge */}
        {section.badge && covPct === null && (
          <span className={`text-[9px] tabular-nums flex-shrink-0 font-medium`} style={{ color: accent, opacity: 0.7 }}>
            {(section.badge === 'live' || section.badge === 'searching' || section.badge === 'fetching' || section.badge === 'analyzing' || section.badge === 'synthesizing') ? (
              <ShineText variant={dark ? 'dark' : 'light'} className="text-[9px]" speed={2}>{section.badge}</ShineText>
            ) : section.badge}
          </span>
        )}
      </button>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Workspace Content — renders selected section detail
// ─────────────────────────────────────────────────────────────

function WorkspaceContent({
  section, visualBatch, dark,
}: {
  section: Section;
  visualBatch: VisualBatchState | null;
  dark: boolean;
}) {
  const color = kindColor(section.kind);
  const accent = dark ? DARK_COLORS[color] : LIGHT_COLORS[color];
  const txtCls = dark ? 'text-zinc-300' : 'text-zinc-700';
  const dimCls = dark ? 'text-zinc-600' : 'text-zinc-400';

  const covPct = (section.kind === 'coverage' || section.kind === 'metrics')
    ? parseInt(section.title.match(/(\d+)%/)?.[1] || '0') : null;

  return (
    <div className="space-y-3">
      {/* Coverage visualization */}
      {covPct !== null && (
        <div className={`rounded-lg p-4 ${dark ? 'bg-zinc-800/30' : 'bg-zinc-100/60'}`}>
          <CoverageBar pct={covPct} dark={dark} />
        </div>
      )}

      {/* Visual thumbnails */}
      {section.kind === 'visual' && visualBatch && visualBatch.sites.length > 0 && (
        <VisualGrid batch={visualBatch} dark={dark} />
      )}

      {/* Lines */}
      {section.lines.length > 0 && (
        <div className="space-y-0.5">
          {section.lines.map((line, i) => {
            // Query line
            if (line.startsWith('→ "')) {
              return (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <span className="text-[12px] mt-px flex-shrink-0" style={{ color: accent }}>→</span>
                  <span className={`text-[12px] ${txtCls} italic font-medium leading-relaxed`}>{line.slice(2)}</span>
                </div>
              );
            }
            // Numbered
            const findingMatch = line.match(/^\s*\[(\d+)\]\s*(.+)/);
            if (findingMatch) {
              return (
                <div key={i} className="flex gap-2.5 items-start py-1">
                  <span className="text-[11px] font-bold w-4 text-right tabular-nums flex-shrink-0" style={{ color: accent }}>{findingMatch[1]}</span>
                  <span className={`text-[12px] ${txtCls} font-medium leading-relaxed`}>{findingMatch[2]}</span>
                </div>
              );
            }
            // KV
            const kvMatch = line.match(/^(Brand|Target Audience|Marketing Goal|Audience congregates|Key language|Market gap|Patterns|Gaps):\s*(.+)/);
            if (kvMatch) {
              return (
                <div key={i} className="flex gap-1.5 py-0.5">
                  <span className="text-[12px] font-semibold flex-shrink-0" style={{ color: accent }}>{kvMatch[1]}:</span>
                  <span className={`text-[12px] font-medium ${txtCls} leading-relaxed`}>{kvMatch[2]}</span>
                </div>
              );
            }
            // Compress/fetch
            if (line.match(/Compress|Fetched/i)) {
              return <div key={i} className={`text-[10px] font-mono ${dimCls}`}>{line}</div>;
            }
            // JSON
            if (line.match(/^\s*[\[{\]},"]/) || line.match(/^\s*"[a-zA-Z_]+"\s*:/)) {
              return <div key={i} className={`text-[9px] font-mono leading-snug ${dimCls}`}>{line}</div>;
            }
            // Sub-lines
            if (line.match(/^\s*(Surface|Intensity):/i)) {
              return <div key={i} className={`text-[11px] ${dimCls} ml-6 italic`}>{line.trim()}</div>;
            }
            // Default
            return <div key={i} className={`text-[12px] font-medium ${txtCls} leading-relaxed`}>{line}</div>;
          })}
        </div>
      )}

      {/* Thinking content */}
      {section.kind === 'thinking' && section.lines.length > 0 && (
        <pre className={`text-[10px] font-mono leading-relaxed whitespace-pre-wrap ${dark ? 'text-zinc-700' : 'text-zinc-400'}`}>
          {section.lines.join('\n')}
        </pre>
      )}

      {/* Empty state for active section with no lines yet */}
      {section.lines.length === 0 && section.kind !== 'phase' && section.kind !== 'coverage' && section.kind !== 'metrics' && (
        <div className="flex items-center gap-2 py-4">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse`} style={{ backgroundColor: accent }} />
          <span className={`text-[11px] ${dimCls}`}>Processing...</span>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Visual Grid — screenshot thumbnails in workspace
// ─────────────────────────────────────────────────────────────

function VisualGrid({ batch, dark }: { batch: VisualBatchState; dark: boolean }) {
  const statusColor = (s: string) =>
    s === 'pending' ? (dark ? '#3f3f46' : '#d4d4d8') :
    s === 'capturing' ? '#f59e0b' :
    s === 'captured' ? '#3b82f6' :
    s === 'analyzing' ? '#7c3aed' :
    s === 'done' ? '#10b981' : '#ef4444';

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {batch.sites.map((site) => {
          const hostname = (() => { try { return new URL(site.url).hostname.replace('www.', ''); } catch { return site.url.slice(0, 25); } })();
          const sc = statusColor(site.status);
          const isWorking = site.status === 'capturing' || site.status === 'analyzing';
          return (
            <div key={site.url} className={`rounded-lg overflow-hidden border ${dark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}>
              {/* Thumbnail */}
              <div className="relative aspect-[5/3]" style={{ minHeight: 72 }}>
                {site.thumbnail ? (
                  <img
                    src={`data:image/jpeg;base64,${site.thumbnail}`}
                    alt={hostname}
                    className="w-full h-full object-cover"
                    style={{ filter: isWorking ? 'brightness(0.5)' : 'none', transition: 'filter 0.3s' }}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${dark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                    <span className={`w-2 h-2 rounded-full ${isWorking ? 'animate-pulse' : ''}`} style={{ backgroundColor: sc }} />
                  </div>
                )}
                {isWorking && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: sc, opacity: 0.8 }} />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute top-1.5 right-1.5">
                  <span className={`w-2 h-2 rounded-full block ${isWorking ? 'animate-pulse' : ''}`} style={{ backgroundColor: sc }} />
                </div>
              </div>
              {/* Label */}
              <div className={`px-2 py-1.5 border-t ${dark ? 'border-zinc-800/60' : 'border-zinc-200'}`}>
                <p className={`text-[9px] truncate font-medium ${dark ? 'text-zinc-400' : 'text-zinc-600'}`} title={site.url}>{hostname}</p>
                {site.findings && (
                  <p className={`text-[8px] truncate ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {site.findings.tone || ''}{site.findings.colors?.length ? ` · ${site.findings.colors[0]}` : ''}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Synthesis */}
      {batch.synthesisStatus === 'done' && (batch.commonPatterns?.length || batch.visualGaps?.length) && (
        <div className={`mt-3 rounded-lg p-3 ${dark ? 'bg-zinc-800/30' : 'bg-zinc-100/60'}`}>
          {batch.commonPatterns?.length ? (
            <p className={`text-[10px] leading-relaxed ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              <span className="font-semibold">Patterns:</span> {batch.commonPatterns.slice(0, 3).join(' · ')}
            </p>
          ) : null}
          {batch.visualGaps?.length ? (
            <p className={`text-[10px] leading-relaxed mt-1 ${dark ? 'text-teal-500' : 'text-teal-700'}`}>
              <span className="font-semibold">Gaps:</span> {batch.visualGaps.slice(0, 3).join(' · ')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Main Component — Manus-style two-column layout
// ─────────────────────────────────────────────────────────────

interface ResearchOutputProps {
  output: string;
  isDarkMode: boolean;
}

export function ResearchOutput({ output, isDarkMode: dark }: ResearchOutputProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const cacheRef = useRef<{ len: number; sections: Section[] }>({ len: 0, sections: [] });
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const prevLenRef = useRef(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const visualBatches = useSyncExternalStore(visualProgressStore.subscribe, visualProgressStore.getSnapshot);

  // ── Incremental parsing ──
  useEffect(() => {
    if (!output) {
      cacheRef.current = { len: 0, sections: [] };
      setSections([]);
      return;
    }

    const cache = cacheRef.current;
    if (output.length < cache.len) { cache.len = 0; cache.sections = []; }
    if (output.length === cache.len) return;

    const delta = output.slice(cache.len);
    cache.len = output.length;

    // Fast path
    if (!SECTION_HEADER_RE.test(delta) && cache.sections.length > 0) {
      const last = cache.sections[cache.sections.length - 1];
      for (const line of delta.split('\n')) {
        const t = line.trim();
        if (!t || /^[─═]{10,}$/.test(t)) continue;

        if (last.kind === 'researcher' && t.includes('[Researcher]')) {
          const inner = t.replace(/.*\[Researcher\]\s*/, '').replace(/^[🔎📄⚠️]\s*/, '');
          if (inner.includes('Fetched')) { const m = inner.match(/Fetched\s+(\d+)\/(\d+)\s+pages\s+\((.+?)s\)/); if (m) last.badge = `${m[1]}/${m[2]} pages`; }
          last.lines.push(inner);
        } else if (last.kind === 'visual' && t.includes('[Visual Scout]')) {
          const inner = t.replace(/.*\[Visual Scout\]\s*/, '');
          if (inner.includes('Analyzed') || inner.includes('complete')) { const m = inner.match(/(\d+)/); if (m) last.badge = `${m[1]} analyzed`; }
          last.lines.push(inner);
        } else if (last.kind === 'reflection' && t.includes('[Reflection]')) {
          last.lines.push(t.replace(/.*\[Reflection\]\s*/, ''));
        } else if (last.kind === 'thinking' && (t.startsWith('[Orchestrator thinking]') || t.startsWith('[Thinking]'))) {
          last.lines.push(t.replace(/.*\[(Orchestrator thinking|Thinking)\]\s*/, ''));
        } else if (last.kind === 'brain' && t.match(/^\[BRAIN:\w+\]/)) {
          last.lines.push(t.replace(/\[BRAIN:\w+\]\s*/, ''));
        } else if (last.kind === 'council-head' && t.match(/^\[HEAD:\S+\]/)) {
          last.lines.push(t.replace(/\[HEAD:\S+\]\s*/, ''));
        } else if ((last.kind === 'council' || last.kind === 'council-head') && t.startsWith('[COUNCIL]')) {
          last.lines.push(t.replace('[COUNCIL] ', ''));
        } else if (last.kind === 'layer' && t.match(/^\s*\[Layer\s+\d+\]/)) {
          last.lines.push(t.replace(/^\s*\[Layer\s+\d+\]\s*/, ''));
        } else if (last.kind === 'reflection-perspective' && t.match(/\[Reflection:\s*(Devil's Advocate|Depth Auditor|Coverage Checker)\]/)) {
          last.lines.push(t.replace(/.*\[Reflection:\s*(Devil's Advocate|Depth Auditor|Coverage Checker)\]\s*/, ''));
        } else {
          last.lines.push(t);
        }
      }
      setSections([...cache.sections]);
      return;
    }

    // Full re-parse
    cache.sections = parseOutput(output);
    setSections(cache.sections);
  }, [output]);

  // ── Auto-follow: select latest non-phase section when new ones arrive ──
  useEffect(() => {
    if (sections.length > prevLenRef.current) {
      // New section arrived — auto-follow
      const lastNonPhase = (() => {
        for (let i = sections.length - 1; i >= 0; i--) {
          if (sections[i].kind !== 'phase') return i;
        }
        return sections.length - 1;
      })();
      setSelectedIdx(lastNonPhase);
    }
    prevLenRef.current = sections.length;
  }, [sections.length]);

  // ── Auto-scroll timeline to bottom ──
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [sections.length]);

  // Sound on complete
  useEffect(() => {
    if (sections.some(s => s.kind === 'complete')) playSound('stageComplete');
  }, [sections.some(s => s.kind === 'complete')]);

  const activeSection = selectedIdx !== null ? sections[selectedIdx] : null;
  const isDone = sections.some(s => s.kind === 'complete');
  const isTimeout = sections.some(s => s.kind === 'timelimit');
  const isRunning = !isDone && !isTimeout && sections.length > 0;

  // Find last visual batch for workspace
  const activeBatch = visualBatches.length > 0 ? visualBatches[visualBatches.length - 1] : null;

  // ── Stats for header ──
  const searches = sections.filter(s => s.kind === 'researcher').length;
  const metricsSecs = sections.filter(s => s.kind === 'metrics');
  const lastMetrics = metricsSecs[metricsSecs.length - 1];
  const coverageSec = sections.find(s => s.kind === 'coverage');
  const covStr = lastMetrics?.title.match(/(\d+)%/)?.[1] || coverageSec?.title.match(/(\d+)%/)?.[1];
  const covPct = covStr ? parseInt(covStr) : 0;

  // ── Empty state ──
  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full animate-pulse ${dark ? 'bg-blue-400' : 'bg-blue-500'}`} />
          <ShineText variant={dark ? 'dark' : 'light'} className="text-sm" speed={2.5}>
            Starting research agents...
          </ShineText>
        </div>
      </div>
    );
  }

  // Count non-phase items for numbering
  const nonPhaseItems = sections.filter(s => s.kind !== 'phase');

  return (
    <div className="flex h-full min-h-0">
      {/* ══════════════════════════════════════════════
           LEFT — Timeline
         ══════════════════════════════════════════════ */}
      <div className={`flex flex-col flex-shrink-0 border-r ${dark ? 'border-zinc-800/60' : 'border-zinc-200'}`} style={{ width: 280 }}>
        {/* Timeline header */}
        <div className={`flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0 ${dark ? 'border-zinc-800/60' : 'border-zinc-200'}`}>
          {/* Status */}
          <div className="flex items-center gap-1.5">
            {isRunning && <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-blue-500" />}
            <span className={`text-[11px] font-semibold ${
              isDone ? (dark ? 'text-emerald-400' : 'text-emerald-600') :
              isTimeout ? (dark ? 'text-amber-400' : 'text-amber-600') :
              dark ? 'text-zinc-300' : 'text-zinc-600'
            }`}>
              {isDone ? 'Complete' : isTimeout ? 'Timeout' : 'Agent Activity'}
            </span>
          </div>
          {/* Stats */}
          <div className={`ml-auto flex items-center gap-2 text-[9px] tabular-nums ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {searches > 0 && <span>{searches} searches</span>}
            {covPct > 0 && <span>{covPct}%</span>}
          </div>
        </div>

        {/* Coverage bar (sticky below header when coverage exists) */}
        {covPct > 0 && (
          <div className={`px-4 py-1.5 border-b flex-shrink-0 ${dark ? 'border-zinc-800/40' : 'border-zinc-100'}`}>
            <CoverageBar pct={covPct} dark={dark} />
          </div>
        )}

        {/* Timeline items */}
        <div ref={timelineRef} className="flex-1 overflow-y-auto min-h-0 py-1">
          {sections.map((section, idx) => {
            const isLast = idx === sections.length - 1;
            const isActve = isLast && !isDone && !isTimeout && section.kind !== 'phase';
            // Find first/last non-phase for connector lines
            const firstNonPhaseIdx = sections.findIndex(s => s.kind !== 'phase');
            const lastNonPhaseIdx = (() => { for (let i = sections.length - 1; i >= 0; i--) { if (sections[i].kind !== 'phase') return i; } return 0; })();
            return (
              <TimelineAction
                key={idx}
                section={section}
                isFirst={idx <= firstNonPhaseIdx}
                isLast={idx >= lastNonPhaseIdx}
                isActive={isActve}
                isSelected={selectedIdx === idx}
                onClick={() => {
                  setSelectedIdx(idx);
                  playSound('click');
                }}
                dark={dark}
              />
            );
          })}
        </div>

        {/* Timeline footer — item count */}
        <div className={`flex-shrink-0 px-4 py-2 border-t text-[9px] tabular-nums ${dark ? 'border-zinc-800/60 text-zinc-700' : 'border-zinc-200 text-zinc-400'}`}>
          {nonPhaseItems.length} actions
        </div>
      </div>

      {/* ══════════════════════════════════════════════
           RIGHT — Workspace ("Agent's Computer")
         ══════════════════════════════════════════════ */}
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${dark ? 'bg-[#0a0a0a]' : 'bg-zinc-50'}`}>
        {/* Window title bar */}
        <div className={`flex items-center gap-3 px-4 py-2 border-b flex-shrink-0 ${dark ? 'border-zinc-800/60 bg-[#0f0f0f]' : 'border-zinc-200 bg-white'}`}>
          {/* Traffic light dots */}
          <div className="flex gap-1.5 flex-shrink-0">
            <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dark ? '#27272a' : '#e4e4e7' }} />
            <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dark ? '#27272a' : '#e4e4e7' }} />
            <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dark ? '#27272a' : '#e4e4e7' }} />
          </div>
          {/* Title */}
          {activeSection && (
            <>
              <span className={`text-[11px] font-medium truncate flex-1 text-center ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                {activeSection.title}
              </span>
              {activeSection.badge && (
                <span className="text-[9px] tabular-nums flex-shrink-0" style={{ color: dark ? DARK_COLORS[kindColor(activeSection.kind)] : LIGHT_COLORS[kindColor(activeSection.kind)], opacity: 0.7 }}>
                  {activeSection.badge}
                </span>
              )}
            </>
          )}
        </div>

        {/* Workspace content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5">
          {activeSection ? (
            <WorkspaceContent
              section={activeSection}
              visualBatch={activeSection.kind === 'visual' ? activeBatch : null}
              dark={dark}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className={`text-[12px] ${dark ? 'text-zinc-700' : 'text-zinc-400'}`}>
                Select an action to view details
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
