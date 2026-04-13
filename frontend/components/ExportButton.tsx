/**
 * ExportButton.tsx — PDF export trigger with options modal
 *
 * Shows after a cycle completes (status === 'complete').
 * Grayed out with tooltip if no cycle data exists yet.
 */

import { useState, useCallback } from 'react';
import type { Campaign, Cycle } from '../types';
import {
  exportCyclePDF,
  type CyclePDFExportOptions,
  type ExportSectionFlags,
  DEFAULT_SECTION_FLAGS,
} from '../utils/pdfExporter';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface ExportButtonProps {
  campaign: Campaign | null;
  cycle: Cycle | null;
  isDark?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export function ExportButton({ campaign, cycle, isDark = true }: ExportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hasData = !!(campaign && cycle && cycle.status === 'complete');
  const hasPartialData = !!(campaign && cycle && cycle.status !== 'pending');

  const handleClick = () => {
    if (!hasPartialData) return;
    setShowModal(true);
  };

  const handleExport = useCallback(async (options: CyclePDFExportOptions) => {
    if (!campaign || !cycle) return;
    setIsExporting(true);
    setShowModal(false);
    try {
      await exportCyclePDF(campaign, cycle, options);
    } catch (err) {
      console.error('[ExportButton] export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [campaign, cycle]);

  const disabledReason = !hasPartialData
    ? 'Run a cycle first'
    : !hasData
    ? 'Cycle is still in progress'
    : null;

  return (
    <>
      <div className="relative group">
        <button
          onClick={handleClick}
          disabled={!hasPartialData || isExporting}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            hasPartialData
              ? isDark
                ? 'bg-white/[0.05] text-white/[0.65] border border-white/[0.10] hover:bg-white/[0.09] hover:text-white/[0.85] hover:border-white/[0.18]'
                : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200 hover:text-zinc-800 hover:border-zinc-300'
              : isDark
                ? 'bg-transparent text-white/[0.25] border border-white/[0.05] cursor-not-allowed'
                : 'bg-transparent text-zinc-300 border border-zinc-100 cursor-not-allowed'
          }`}
          title={disabledReason ?? 'Export PDF report'}
          aria-label="Export PDF report"
        >
          {isExporting ? (
            <svg
              width="11" height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="animate-spin"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </button>

        {/* Tooltip for disabled state */}
        {disabledReason && (
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-[9px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
            isDark ? 'bg-zinc-800 text-white/80' : 'bg-zinc-900 text-white'
          }`}>
            {disabledReason}
          </div>
        )}
      </div>

      {showModal && campaign && cycle && (
        <ExportModal
          campaign={campaign}
          cycle={cycle}
          isDark={isDark}
          onExport={handleExport}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Options modal
// ──────────────────────────────────────────────────────────────

interface ExportModalProps {
  campaign: Campaign;
  cycle: Cycle;
  isDark: boolean;
  onExport: (opts: CyclePDFExportOptions) => void;
  onClose: () => void;
}

const SECTION_LABELS: { key: keyof ExportSectionFlags; label: string; desc: string }[] = [
  { key: 'research',    label: 'Research Summary',     desc: 'Desires, objections, audience insights' },
  { key: 'competitors', label: 'Competitor Analysis',  desc: 'Competitor matrix & positioning gaps' },
  { key: 'factCheck',   label: 'Fact Check Report',    desc: 'Verified claims & credibility score' },
  { key: 'visual',      label: 'Visual Intelligence',  desc: 'Color palettes, layouts, visual gaps' },
  { key: 'concepts',    label: 'Ad Concepts',          desc: 'All 3 concepts with full copy' },
  { key: 'testResults', label: 'Test Results',         desc: 'Rankings, scores, winner rationale' },
  { key: 'memories',    label: 'Memories Extracted',   desc: 'Patterns archived for next cycle' },
  { key: 'auditTrail',  label: 'Audit Trail',          desc: 'URLs, models, tokens, timing' },
];

function ExportModal({ campaign, cycle, isDark, onExport, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'full' | 'executive'>('full');
  const [sections, setSections] = useState<ExportSectionFlags>({ ...DEFAULT_SECTION_FLAGS });
  const [includeRawData, setIncludeRawData] = useState(false);

  const toggleSection = (key: keyof ExportSectionFlags) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportFull = () => onExport({ format: 'full', sections, includeRawData });
  const handleExportExec = () => onExport({ format: 'executive', sections, includeRawData });

  const bg = isDark ? 'bg-[#111113]' : 'bg-white';
  const border = isDark ? 'border-white/[0.08]' : 'border-zinc-200';
  const textPrimary = isDark ? 'text-white/[0.87]' : 'text-zinc-900';
  const textMuted = isDark ? 'text-white/[0.40]' : 'text-zinc-400';
  const rowHover = isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-zinc-50';
  const checkBorder = isDark ? 'border-white/[0.18]' : 'border-zinc-300';
  const checkChecked = 'border-orange-500 bg-orange-500';

  const formatBtnBase = `flex-1 py-2 rounded-md text-[11px] font-medium transition-all border`;
  const formatBtnActive = isDark
    ? 'bg-orange-950/40 border-orange-600/60 text-orange-400'
    : 'bg-orange-50 border-orange-400 text-orange-700';
  const formatBtnInactive = isDark
    ? 'bg-white/[0.03] border-white/[0.08] text-white/[0.45] hover:bg-white/[0.06]'
    : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className={`w-full max-w-sm rounded-xl border ${bg} ${border} shadow-2xl overflow-hidden`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${border}`}>
          <div>
            <p className={`text-[13px] font-semibold ${textPrimary}`}>Export PDF Report</p>
            <p className={`text-[10px] mt-0.5 ${textMuted}`}>{campaign.brand} — Cycle {cycle.cycleNumber}</p>
          </div>
          <button onClick={onClose} className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/[0.35] hover:text-white/[0.65] hover:bg-white/[0.06]' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Format selector */}
        <div className={`px-4 py-3 border-b ${border}`}>
          <p className={`text-[9px] uppercase tracking-wider font-semibold mb-2 ${textMuted}`}>Format</p>
          <div className="flex gap-2">
            <button onClick={() => setFormat('full')} className={`${formatBtnBase} ${format === 'full' ? formatBtnActive : formatBtnInactive}`}>
              Full Report
            </button>
            <button onClick={() => setFormat('executive')} className={`${formatBtnBase} ${format === 'executive' ? formatBtnActive : formatBtnInactive}`}>
              Executive (2-page)
            </button>
          </div>
          {format === 'executive' && (
            <p className={`text-[9px] mt-1.5 ${textMuted}`}>Winner concept on page 1, top insights on page 2. Designed for sharing with clients.</p>
          )}
        </div>

        {/* Section toggles — only for full report */}
        {format === 'full' && (
          <div className={`px-4 py-3 border-b ${border} max-h-64 overflow-y-auto`}>
            <p className={`text-[9px] uppercase tracking-wider font-semibold mb-2 ${textMuted}`}>Sections</p>
            <div className="space-y-1">
              {SECTION_LABELS.map(({ key, label, desc }) => {
                const checked = sections[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleSection(key)}
                    className={`w-full flex items-start gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${rowHover}`}
                  >
                    <div className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded border transition-colors ${checked ? checkChecked : checkBorder}`} style={{ marginTop: 2 }}>
                      {checked && (
                        <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-[11px] font-medium ${textPrimary}`}>{label}</p>
                      <p className={`text-[9.5px] ${textMuted}`}>{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Raw data toggle */}
        {format === 'full' && (
          <div className={`px-4 py-2.5 border-b ${border}`}>
            <button
              onClick={() => setIncludeRawData(v => !v)}
              className={`flex items-center gap-2.5 ${rowHover} w-full px-2 py-1.5 rounded-md`}
            >
              <div className={`w-3.5 h-3.5 flex-shrink-0 rounded border transition-colors ${includeRawData ? checkChecked : checkBorder}`} style={{ marginTop: 1 }}>
                {includeRawData && (
                  <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-[11px] font-medium ${textPrimary}`}>Include raw data</p>
                <p className={`text-[9.5px] ${textMuted}`}>Confidence scores, source URLs in research sections</p>
              </div>
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 py-3 flex gap-2">
          <button
            onClick={onClose}
            className={`flex-1 py-2 rounded-md text-[11px] font-medium border transition-colors ${
              isDark ? 'border-white/[0.08] text-white/[0.45] hover:bg-white/[0.04]' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={format === 'executive' ? handleExportExec : handleExportFull}
            className="flex-1 py-2 rounded-md text-[11px] font-semibold text-white transition-all"
            style={{ background: 'rgba(234,88,12,0.9)', boxShadow: '0 2px 10px rgba(234,88,12,0.25)' }}
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
