/**
 * LiveActionFeed -- Real-time display of what the AI is doing on the desktop.
 *
 * Subscribes to desktopBus events:
 *   agent_status       — phase + message (running/done/error/cancelled)
 *   agent_screenshot   — latest screenshot (updates thumbnail)
 *   agent_action_desc  — each action the AI takes (click/type/press/scroll)
 *
 * Shows:
 *   - Status header with RUNNING/DONE/ERROR badge + Stop button
 *   - Step counter (Step N/Total)
 *   - Screenshot thumbnail (updates every step)
 *   - Scrolling action log with status indicators
 *   - Screen state description from last action
 */

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { desktopBus } from '../utils/desktopBus';

// ── Types ──────────────────────────────────────────────────────────────────

type FeedStatus = 'idle' | 'running' | 'done' | 'error';

interface ActionEntry {
  id: string;
  description: string;
  actionType: string;
  iteration: number;
  status: 'running' | 'done' | 'error';
  ts: number;
}

interface LiveActionFeedProps {
  /** Called when Stop is clicked — caller should abort their AbortController */
  onStop?: () => void;
  /** Maximum action entries to keep in the feed (older ones drop off) */
  maxEntries?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Status indicator: filled circle for "running", check for "done", x for "error" */
function StatusDot({ status }: { status: 'running' | 'done' | 'error' }) {
  if (status === 'running') {
    return (
      <span style={{
        display: 'inline-block',
        width: 7, height: 7,
        borderRadius: '50%',
        background: '#3b82f6',
        flexShrink: 0,
        boxShadow: '0 0 5px rgba(59,130,246,0.7)',
        animation: '_nomad_pulse 1.4s ease-in-out infinite',
      }} />
    );
  }
  if (status === 'done') {
    return (
      <span style={{
        display: 'inline-block',
        width: 7, height: 7,
        flexShrink: 0,
        color: '#22c55e',
        fontSize: 9,
        lineHeight: '7px',
        fontWeight: 700,
      }}>+</span>
    );
  }
  // error
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      flexShrink: 0,
      color: '#ef4444',
      fontSize: 9,
      lineHeight: '7px',
      fontWeight: 700,
    }}>x</span>
  );
}

function actionTypeLabel(actionType: string): string {
  switch (actionType) {
    case 'click':          return 'click';
    case 'type':           return 'type';
    case 'press':          return 'key';
    case 'scroll':         return 'scroll';
    case 'done':           return 'done';
    case 'browser_click':  return 'click';
    case 'browser_type':   return 'type';
    case 'browser_scroll': return 'scroll';
    case 'browser_press':  return 'key';
    case 'browser_navigate': return 'navigate';
    default:               return actionType.replace('browser_', '').replace('desktop_', '');
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function LiveActionFeed({ onStop, maxEntries = 30 }: LiveActionFeedProps) {
  const [status, setStatus] = useState<FeedStatus>('idle');
  const [message, setMessage] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [screenState, setScreenState] = useState('');

  const feedRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll feed to bottom when new entries arrive
  useEffect(() => {
    if (autoScrollRef.current && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [actions]);

  const addAction = useCallback((entry: Omit<ActionEntry, 'id' | 'ts'>) => {
    setActions(prev => {
      // Mark the previous last entry as done (it was in-progress)
      const updated = prev.map((a, i) =>
        i === prev.length - 1 && a.status === 'running'
          ? { ...a, status: 'done' as const }
          : a
      );
      const next: ActionEntry = { ...entry, id: uid(), ts: Date.now() };
      const all = [...updated, next];
      return all.length > maxEntries ? all.slice(-maxEntries) : all;
    });
  }, [maxEntries]);

  useEffect(() => {
    return desktopBus.subscribe((event) => {
      switch (event.type) {
        case 'agent_status': {
          const phase = event.phase as string;
          if (phase === 'executing' || phase === 'planning') {
            setStatus('running');
          } else if (phase === 'done') {
            setStatus('done');
            // Mark last action done
            setActions(prev => prev.map((a, i) =>
              i === prev.length - 1 && a.status === 'running'
                ? { ...a, status: 'done' as const }
                : a
            ));
          } else if (phase === 'error') {
            setStatus('error');
            setActions(prev => prev.map((a, i) =>
              i === prev.length - 1 && a.status === 'running'
                ? { ...a, status: 'error' as const }
                : a
            ));
          }
          setMessage(event.message ?? '');
          if (event.stepIndex !== undefined) setStepIndex(event.stepIndex + 1);
          if (event.totalSteps !== undefined) setTotalSteps(event.totalSteps);
          break;
        }

        case 'agent_screenshot':
          setScreenshot(event.screenshot);
          break;

        case 'computer_screenshot':
          // Also accept computer_screenshot events
          setScreenshot(event.screenshot);
          break;

        case 'agent_action_desc':
          addAction({
            description: event.description,
            actionType: event.actionType,
            iteration: event.iteration,
            status: 'running',
          });
          if (event.screenState) setScreenState(event.screenState);
          break;
      }
    });
  }, [addAction]);

  // Reset feed when a new run starts (planning phase)
  useEffect(() => {
    return desktopBus.subscribe((event) => {
      if (event.type === 'agent_status' && event.phase === 'planning') {
        setActions([]);
        setScreenshot(null);
        setScreenState('');
        setStepIndex(0);
        setTotalSteps(0);
        setStatus('running');
      }
    });
  }, []);

  // Don't render if never activated
  if (status === 'idle' && actions.length === 0) return null;

  const isRunning = status === 'running';

  // Badge styling
  const badgeStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    ...(isRunning
      ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.30)' }
      : status === 'done'
        ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }
        : { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
    ),
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      border: '1px solid var(--glass-border-light)',
      borderRadius: 10,
      background: 'rgba(8,10,18,0.85)',
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
      fontSize: 11,
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px',
        borderBottom: '1px solid var(--glass-border-light)',
        background: 'rgba(0,0,0,0.25)',
      }}>
        {/* Status badge */}
        <div style={badgeStyle}>
          {isRunning && (
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#3b82f6',
              animation: '_nomad_pulse 1.4s ease-in-out infinite',
              display: 'inline-block',
            }} />
          )}
          {status === 'running' ? 'Running' : status === 'done' ? 'Done' : 'Error'}
        </div>

        {/* Step counter */}
        {totalSteps > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Step {stepIndex}/{totalSteps}
          </span>
        )}

        <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: 'var(--text-ghost)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message}
        </span>

        {/* Stop button */}
        {isRunning && onStop && (
          <button
            onClick={onStop}
            title="Stop AI control"
            style={{
              padding: '3px 9px', borderRadius: 5, cursor: 'pointer', flexShrink: 0,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.30)',
              color: '#f87171', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
          >
            Stop
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Screenshot thumbnail */}
        {screenshot && (
          <div style={{
            width: 100, flexShrink: 0,
            borderRight: '1px solid var(--glass-border-light)',
            padding: 6,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          }}>
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Current screen"
              style={{
                width: '100%', height: 60, objectFit: 'cover',
                borderRadius: 5,
                border: '1px solid var(--border-subtle)',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Action log */}
        <div
          ref={feedRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
          }}
          style={{
            flex: 1, minWidth: 0,
            maxHeight: 140, overflowY: 'auto',
            padding: '6px 8px',
          }}
        >
          {actions.length === 0 && (
            <div style={{ color: 'var(--text-ghost)', fontSize: 10, fontStyle: 'italic', padding: '4px 0' }}>
              Waiting for first action...
            </div>
          )}
          {actions.map((entry, i) => {
            const isLast = i === actions.length - 1;
            const typeLabel = actionTypeLabel(entry.actionType);
            const entryColor = entry.status === 'done'
              ? 'var(--text-muted)'
              : entry.status === 'error'
                ? 'rgba(239,68,68,0.75)'
                : 'var(--text-secondary)';
            const typeColor = entry.status === 'done'
              ? 'rgba(99,155,255,0.45)'
              : entry.status === 'error'
                ? 'rgba(239,68,68,0.60)'
                : 'rgba(99,155,255,0.80)';

            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 5,
                  marginBottom: isLast ? 0 : 3,
                  opacity: entry.status === 'done' && !isLast ? 0.65 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <StatusDot status={entry.status} />
                <span style={{
                  fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                  color: typeColor, flexShrink: 0, minWidth: 38, paddingTop: 1,
                }}>
                  {typeLabel}
                </span>
                <span style={{
                  fontSize: 10, color: entryColor, lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }}>
                  {entry.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Screen state footer ── */}
      {screenState && isRunning && (
        <div style={{
          padding: '4px 10px',
          borderTop: '1px solid var(--glass-border-light)',
          fontSize: 9, color: 'var(--text-ghost)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <span style={{ color: 'rgba(99,155,255,0.45)', marginRight: 4 }}>screen:</span>
          {screenState.slice(0, 100)}{screenState.length > 100 ? '...' : ''}
        </div>
      )}
    </div>
  );
}
