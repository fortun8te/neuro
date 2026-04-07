/**
 * DebugPanel — Slide-in panel (480px, right edge) for viewing neuroLogger entries.
 * Toggle: Ctrl+Shift+D / Cmd+Shift+D, or click the Debug button in the sidebar.
 *
 * Features:
 *  - Filter tabs: All | Routing | Tool | Response | Error
 *  - Each row: colored dot, type label, model, tool name (mono), duration badge, relative time
 *  - Click a row to expand full data JSON
 *  - Auto-refreshes every 2s
 *  - Export JSON + Clear buttons
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getLogs, clearLogs, exportLogs, type NeuroLogEntry } from '../utils/neuroLogger';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../constants/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'routing' | 'tool' | 'response' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function typeMatchesFilter(type: NeuroLogEntry['type'], filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'routing') return type === 'routing';
  if (filter === 'tool') return type === 'tool_call' || type === 'tool_result';
  if (filter === 'response') return type === 'response' || type === 'model_select';
  if (filter === 'error') return type === 'error';
  return true;
}

function dotColor(type: NeuroLogEntry['type']): string {
  switch (type) {
    case 'routing':      return '#3b82f6'; // blue
    case 'tool_call':    return '#f59e0b'; // amber
    case 'tool_result':  return '#10b981'; // green
    case 'error':        return '#ef4444'; // red
    case 'response':     return '#8b5cf6'; // purple
    case 'model_select': return '#8b5cf6'; // purple
    case 'thinking':     return '#06b6d4'; // cyan
    case 'memory':       return '#ec4899'; // pink
    default:             return '#6b7280'; // gray
  }
}

function typeLabel(type: NeuroLogEntry['type']): string {
  switch (type) {
    case 'routing':      return 'routing';
    case 'tool_call':    return 'tool call';
    case 'tool_result':  return 'tool done';
    case 'error':        return 'error';
    case 'response':     return 'response';
    case 'model_select': return 'model';
    case 'thinking':     return 'thinking';
    case 'memory':       return 'memory';
    case 'system':       return 'system';
    default:             return type;
  }
}

function dataSummary(entry: NeuroLogEntry): string {
  const d = entry.data;
  if (typeof d.decision === 'string') return d.decision.slice(0, 80);
  if (typeof d.message === 'string') return d.message.slice(0, 80);
  if (typeof d.summary === 'string') return d.summary.slice(0, 80);
  if (typeof d.responseLength === 'number') return `${d.responseLength} chars`;
  if (typeof d.success === 'boolean') return d.success ? 'success' : 'failed';
  return '';
}

// ── Log Entry Row ─────────────────────────────────────────────────────────────

interface LogRowProps {
  entry: NeuroLogEntry;
}

function LogRow({ entry }: LogRowProps) {
  const [expanded, setExpanded] = useState(false);

  const color = dotColor(entry.type);
  const label = typeLabel(entry.type);
  const summary = dataSummary(entry);

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        padding: '8px 14px',
        cursor: 'pointer',
        background: expanded ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background 0.1s',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {/* Colored dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: color, flexShrink: 0, marginTop: 1,
        }} />

        {/* Type label */}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
          color, textTransform: 'uppercase' as const, flexShrink: 0,
          fontFamily: FONT_FAMILY,
        }}>
          {label}
        </span>

        {/* Model */}
        {entry.model && (
          <span style={{
            fontSize: 11, color: 'rgba(255,255,255,0.45)',
            fontFamily: FONT_FAMILY, flexShrink: 0,
          }}>
            {entry.model}
          </span>
        )}

        {/* Tool name */}
        {entry.tool && (
          <span style={{
            fontSize: 11, fontFamily: FONT_FAMILY_MONO,
            color: '#f59e0b',
            background: 'rgba(245,158,11,0.1)',
            padding: '1px 5px', borderRadius: 4, flexShrink: 0,
          }}>
            {entry.tool}
          </span>
        )}

        {/* Data summary (when no tool name) */}
        {!entry.tool && summary && (
          <span style={{
            fontSize: 11, color: 'rgba(255,255,255,0.5)',
            fontFamily: FONT_FAMILY, flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
          }}>
            {summary}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Duration badge */}
          {entry.durationMs != null && (
            <span style={{
              fontSize: 10, fontFamily: FONT_FAMILY_MONO,
              color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.06)',
              padding: '1px 5px', borderRadius: 4,
            }}>
              {entry.durationMs < 1000
                ? `${entry.durationMs}ms`
                : `${(entry.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}

          {/* Relative timestamp */}
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.25)',
            fontFamily: FONT_FAMILY,
          }}>
            {relativeTime(entry.timestamp)}
          </span>

          {/* Expand chevron */}
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              color: 'rgba(255,255,255,0.2)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Expanded JSON block */}
      {expanded && (
        <pre style={{
          marginTop: 8, padding: '10px 12px',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          fontSize: 11, fontFamily: FONT_FAMILY_MONO,
          color: 'rgba(255,255,255,0.7)',
          overflow: 'auto', maxHeight: 240,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          margin: 0,
        }}>
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'routing',  label: 'Routing' },
  { id: 'tool',     label: 'Tool' },
  { id: 'response', label: 'Response' },
  { id: 'error',    label: 'Error' },
];

export function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const { isDarkMode } = useTheme();
  const [logs, setLogs] = useState<NeuroLogEntry[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const entries = await getLogs();
    setLogs(entries);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    intervalRef.current = setInterval(refresh, 2000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, refresh]);

  const handleClear = useCallback(async () => {
    await clearLogs();
    setLogs([]);
  }, []);

  const handleExport = useCallback(() => {
    const json = exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuro-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const filtered = logs.filter(e => typeMatchesFilter(e.type, filter));
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);

  // Panel always exists in DOM; slide via transform for smooth animation
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.2)',
            zIndex: 49,
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 480,
          zIndex: 50,
          background: 'rgba(10,10,15,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '13px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          {/* Code icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>

          <span style={{
            flex: 1, fontSize: 13, fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: FONT_FAMILY, letterSpacing: '0.01em',
          }}>
            Debug Logs
          </span>

          {/* Count badge */}
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.3)',
            fontFamily: FONT_FAMILY_MONO,
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {filtered.length} / {logs.length}
          </span>

          {/* Export JSON */}
          <button
            onClick={handleExport}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500,
              color: 'rgba(255,255,255,0.6)',
              padding: '4px 9px',
            }}
            title="Export all logs as JSON"
          >
            Export JSON
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 500,
              color: 'rgba(239,68,68,0.8)',
              padding: '4px 9px',
            }}
          >
            Clear
          </button>

          {/* Close X */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 5,
              color: 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center',
            }}
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: 2,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                cursor: 'pointer', fontFamily: FONT_FAMILY,
                fontSize: 11, fontWeight: 600,
                background: filter === tab.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: filter === tab.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.1s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Log list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 12, padding: 40,
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.12)' }}>
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              <span style={{
                fontSize: 12, color: 'rgba(255,255,255,0.22)',
                fontFamily: FONT_FAMILY, textAlign: 'center', lineHeight: 1.6,
              }}>
                {logs.length === 0
                  ? 'No logs yet — run an agent to see activity'
                  : 'No logs match the current filter'}
              </span>
            </div>
          ) : (
            filtered.map(entry => (
              <LogRow key={entry.id} entry={entry} />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '7px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.18)',
            fontFamily: FONT_FAMILY,
          }}>
            Auto-refreshes every 2s
          </span>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.18)',
            fontFamily: FONT_FAMILY_MONO,
            background: 'rgba(255,255,255,0.05)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {isMac ? '⌘' : 'Ctrl'}+Shift+D
          </span>
        </div>
      </div>
    </>
  );
}
