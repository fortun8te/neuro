/**
 * ConsolePanelDrawer — collapsible panel showing browser console logs.
 * Fixed to the bottom of the ChromeWindow stream area.
 * Receives messages via the `messages` prop (routed from the parent's WebSocket handler).
 */

import { useRef, useEffect, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────

export interface ConsoleMessage {
  level: 'log' | 'warn' | 'error' | 'info';
  text: string;
  ts: number;
}

interface ConsolePanelDrawerProps {
  messages: ConsoleMessage[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
}

type Filter = 'all' | 'error' | 'warn';

const PANEL_HEIGHT = 120;

// ── Helpers ────────────────────────────────────────────

function levelColor(level: ConsoleMessage['level']): string {
  if (level === 'error') return '#f87171';
  if (level === 'warn') return '#fbbf24';
  return 'var(--text-secondary)';
}

function levelLabel(level: ConsoleMessage['level']): string {
  return level.toUpperCase();
}

// ── Component ──────────────────────────────────────────

export function ConsolePanelDrawer({
  messages,
  isOpen,
  onToggle,
  onClear,
}: ConsolePanelDrawerProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const listRef = useRef<HTMLDivElement>(null);
  const [seenCount, setSeenCount] = useState(0);

  // Count unread errors (errors received since panel was last opened)
  const errorCount = messages.filter(m => m.level === 'error').length;
  const warnCount = messages.filter(m => m.level === 'warn').length;
  const unreadErrors = messages.slice(seenCount).filter(m => m.level === 'error').length;

  // Reset unread when opened
  useEffect(() => {
    if (isOpen) setSeenCount(messages.length);
  }, [isOpen, messages.length]);

  // Reset seenCount when messages are cleared (length drops below seenCount)
  useEffect(() => {
    if (messages.length < seenCount) setSeenCount(messages.length);
  }, [messages.length, seenCount]);

  // Track whether user is scrolled to the bottom
  const isAtBottomRef = useRef(true);

  // Auto-scroll to bottom on new messages only when already at bottom
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isOpen]);

  // Update isAtBottom flag on user scroll
  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 24;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const filtered = filter === 'all'
    ? messages
    : filter === 'warn'
      ? messages.filter(m => m.level === 'warn' || m.level === 'error')
      : messages.filter(m => m.level === filter);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
      }}
    >
      {/* Unread error badge when closed — rendered outside overflow-hidden panel */}
      {!isOpen && unreadErrors > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 8,
          fontSize: 9,
          fontWeight: 700,
          color: '#f87171',
          background: 'rgba(248,113,113,0.15)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 4,
          padding: '0 5px',
          lineHeight: '16px',
          pointerEvents: 'none',
        }}>
          {unreadErrors}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          borderTop: isOpen ? '1px solid var(--border-subtle)' : 'none',
          backdropFilter: 'blur(12px)',
          transition: 'height 0.18s ease',
          height: isOpen ? PANEL_HEIGHT : 0,
          overflow: 'hidden',
        }}
      >
      {/* Header bar — always rendered so it can be toggled from toolbar */}
      {isOpen && (
        <>
          <div style={{
            height: 26,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 8px',
            borderBottom: '1px solid var(--glass-border-light)',
            background: 'var(--bg-tertiary)',
          }}>
            {/* Label */}
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              Console
            </span>

            {/* Error badge */}
            {errorCount > 0 && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#f87171',
                background: 'rgba(248,113,113,0.12)',
                border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: 4,
                padding: '0 5px',
                lineHeight: '16px',
                flexShrink: 0,
              }}>
                {errorCount} ERR
              </span>
            )}

            {/* Warn badge */}
            {warnCount > 0 && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#fbbf24',
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 4,
                padding: '0 5px',
                lineHeight: '16px',
                flexShrink: 0,
              }}>
                {warnCount} WARN
              </span>
            )}

            <div style={{ flex: 1 }} />

            {/* Filter pills */}
            {(['all', 'error', 'warn'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 9,
                  padding: '1px 7px',
                  borderRadius: 4,
                  border: '1px solid',
                  cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: filter === f ? 700 : 400,
                  background: filter === f ? 'var(--border-subtle)' : 'transparent',
                  borderColor: filter === f ? 'var(--glass-border-light)' : 'var(--glass-border-light)',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.12s',
                  flexShrink: 0,
                }}
              >
                {f}
              </button>
            ))}

            {/* Clear button */}
            <button
              onClick={onClear}
              title="Clear console"
              style={{
                fontSize: 9,
                padding: '1px 7px',
                borderRadius: 4,
                border: '1px solid var(--glass-border-light)',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: 'ui-monospace, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                transition: 'all 0.12s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--text-ghost)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--glass-border-light)';
              }}
            >
              Clear
            </button>

            {/* Close toggle */}
            <button
              onClick={onToggle}
              title="Close console"
              style={{
                width: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                borderRadius: 3,
                padding: 0,
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages list */}
          <div
            ref={listRef}
            onScroll={handleListScroll}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '2px 0',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{
                padding: '6px 10px',
                fontSize: 10,
                color: 'var(--glass-border-light)',
                fontFamily: 'ui-monospace, monospace',
              }}>
                No messages.
              </div>
            ) : (
              filtered.map((msg, i) => (
                <div
                  key={`${msg.ts}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '1px 10px',
                    fontSize: 11,
                    fontFamily: 'ui-monospace, monospace',
                    lineHeight: 1.45,
                    color: levelColor(msg.level),
                    borderBottom: '1px solid var(--glass-border-light)',
                  }}
                >
                  <span style={{
                    flexShrink: 0,
                    fontWeight: 700,
                    fontSize: 9,
                    opacity: 0.7,
                    paddingTop: 1,
                    minWidth: 32,
                  }}>
                    [{levelLabel(msg.level)}]
                  </span>
                  <span style={{
                    flex: 1,
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      </div>
    </div>
  );
}
