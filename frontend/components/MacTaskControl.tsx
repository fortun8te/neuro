/**
 * MacTaskControl — minimal Mac desktop AI control panel.
 *
 * Layout (three states):
 *   idle    — task input + Run button
 *   running — live step log + screenshot thumbnail + Stop button
 *   done    — result summary + Run another task / Retry buttons
 *
 * Wires to pureExecutor (real Mac bridge) via runExecutor().
 * Stays self-contained — no external state, no context dependencies.
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { runExecutor, type ExecutorStep, type ExecutorResult } from '../utils/computerAgent/pureExecutor';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'running' | 'done' | 'error';

interface StepDisplay {
  n: number;
  label: string;
  status: 'running' | 'done' | 'failed';
  screenshot?: string; // base64 JPEG, no prefix
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable label for a step action. */
function stepLabel(step: ExecutorStep): string {
  const { action } = step;
  switch (action.type) {
    case 'click': {
      if (action.box_2d) {
        const [y1, x1, y2, x2] = action.box_2d;
        const cx = Math.round((x1 + x2) / 2);
        const cy = Math.round((y1 + y2) / 2);
        return `click (${cx}, ${cy})`;
      }
      if (action.x !== undefined && action.y !== undefined) {
        return `click (${action.x}, ${action.y})`;
      }
      return 'click';
    }
    case 'type':
      return `type "${action.text ?? ''}"`;
    case 'scroll':
      return `scroll ${action.direction ?? 'down'}`;
    case 'press':
      return `press ${action.key ?? ''}`;
    case 'done':
      return 'task complete';
    case 'fail':
      return 'gave up';
    default:
      return action.type;
  }
}

/** Format elapsed seconds as mm:ss. */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Spinning ring — used for running step indicator. */
function Spinner({ size = 10 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid rgba(99,155,255,0.15)`,
        borderTopColor: 'rgba(99,155,255,0.85)',
        animation: '_mac_spin 0.75s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

/** Green check or red X dot for completed steps. */
function StatusDot({ status }: { status: StepDisplay['status'] }) {
  if (status === 'running') return <Spinner />;

  const bg = status === 'done' ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)';
  const path =
    status === 'done'
      ? 'M2 6 5 9 10 3'
      : 'M3 3 9 9M9 3 3 9';

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 10, height: 10, borderRadius: '50%', background: bg, flexShrink: 0,
      }}
    >
      <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={path} />
      </svg>
    </span>
  );
}

/** Inline keyframe injection — avoids adding global CSS. */
function SpinnerStyles() {
  useEffect(() => {
    const id = '_mac_spin_style';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `@keyframes _mac_spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(el);
  }, []);
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MacTaskControlProps {
  /** Max steps per run (default 30). */
  maxSteps?: number;
  /** Optional className applied to the root element. */
  className?: string;
}

export function MacTaskControl({ maxSteps = 30, className }: MacTaskControlProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<StepDisplay[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutorResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll log
  useLayoutEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [steps]);

  // Elapsed timer
  useEffect(() => {
    if (phase === 'running') {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [phase]);

  // Handle a step arriving from the executor
  const handleStep = useCallback((step: ExecutorStep) => {
    const label = stepLabel(step);

    setSteps(prev => {
      // Mark previous running step as done/failed
      const updated = prev.map(s =>
        s.status === 'running' ? { ...s, status: (step.result === 'failed' ? 'failed' : 'done') as StepDisplay['status'] } : s,
      );
      // Push the new step as running (unless it's a terminal action)
      const isTerminal = step.action.type === 'done' || step.action.type === 'fail';
      updated.push({
        n: step.n,
        label,
        status: isTerminal ? (step.result === 'done' ? 'done' : 'failed') : 'running',
        screenshot: step.screenshot,
      });
      return updated;
    });

    // Update live screenshot
    if (step.screenshot) {
      setCurrentScreenshot(step.screenshot);
    }
  }, []);

  const runTask = useCallback(async () => {
    if (!task.trim() || phase === 'running') return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase('running');
    setSteps([]);
    setCurrentScreenshot(null);
    setResult(null);

    try {
      const r = await runExecutor({
        task: task.trim(),
        maxSteps,
        signal: ctrl.signal,
        onStep: handleStep,
      });

      setResult(r);
      setPhase(r.success ? 'done' : 'error');

      // Mark last running step as done/failed
      setSteps(prev =>
        prev.map(s =>
          s.status === 'running'
            ? { ...s, status: r.success ? 'done' : 'failed' }
            : s,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ success: false, steps: [], result: msg });
      setPhase('error');
      setSteps(prev =>
        prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s),
      );
    } finally {
      abortRef.current = null;
    }
  }, [task, phase, maxSteps, handleStep]);

  const stopTask = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setSteps([]);
    setCurrentScreenshot(null);
    setResult(null);
    setElapsed(0);
    // Focus input on next tick
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runTask();
    }
  }, [runTask]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const isRunning = phase === 'running';
  const isDone = phase === 'done' || phase === 'error';

  return (
    <>
      <SpinnerStyles />
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        {/* ── Task input section (always visible) ──────────────────── */}
        <div style={{ padding: '14px 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Mac Control
          </div>

          <textarea
            ref={inputRef}
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell the AI what to do on your Mac..."
            disabled={isRunning}
            rows={2}
            style={{
              width: '100%',
              resize: 'none',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              outline: 'none',
              boxSizing: 'border-box',
              opacity: isRunning ? 0.5 : 1,
              transition: 'opacity 0.15s ease',
            }}
          />

          {/* Hint */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
            Cmd+Enter to run
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {!isRunning ? (
              <button
                onClick={runTask}
                disabled={!task.trim()}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: 7,
                  border: 'none',
                  background: task.trim() ? '#3b82f6' : 'var(--glass-bg-heavy)',
                  color: task.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: task.trim() ? 'pointer' : 'default',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  letterSpacing: '0.01em',
                }}
              >
                Run Task
              </button>
            ) : (
              <button
                onClick={stopTask}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: 7,
                  border: '1px solid rgba(239,68,68,0.35)',
                  background: 'rgba(239,68,68,0.12)',
                  color: 'rgba(239,68,68,0.9)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                }}
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* ── Divider (only when running or done) ──────────────────── */}
        {(isRunning || isDone) && (
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />
        )}

        {/* ── Running state ─────────────────────────────────────────── */}
        {isRunning && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Status header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size={10} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Running: &ldquo;{task}&rdquo;
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatElapsed(elapsed)}
              </span>
            </div>

            {/* Screenshot thumbnail */}
            {currentScreenshot && (
              <div style={{
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                background: '#000',
                lineHeight: 0,
                flexShrink: 0,
              }}>
                <img
                  src={`data:image/jpeg;base64,${currentScreenshot}`}
                  alt="Current Mac screen"
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 160, objectFit: 'cover', objectPosition: 'top' }}
                />
              </div>
            )}

            {/* Step log */}
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              {steps.map(s => (
                <StepRow key={s.n} step={s} />
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ── Done / Error state ────────────────────────────────────── */}
        {isDone && result && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Result header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: result.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${result.success ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
              }}>
                {result.success ? (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="3" x2="9" y2="9" /><line x1="9" y1="3" x2="3" y2="9" /></svg>
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: result.success ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)' }}>
                  {result.success
                    ? `Done in ${steps.length} step${steps.length !== 1 ? 's' : ''} (${formatElapsed(elapsed)})`
                    : `Stopped after ${steps.length} step${steps.length !== 1 ? 's' : ''}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
                  {result.success
                    ? result.result
                    : `Last state: ${result.result}`}
                </div>
              </div>
            </div>

            {/* Final screenshot */}
            {currentScreenshot && (
              <div style={{
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                background: '#000', lineHeight: 0,
              }}>
                <img
                  src={`data:image/jpeg;base64,${currentScreenshot}`}
                  alt="Final Mac screen state"
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 140, objectFit: 'cover', objectPosition: 'top' }}
                />
              </div>
            )}

            {/* Step log (collapsed, scrollable) */}
            {steps.length > 0 && (
              <StepLogCollapsible steps={steps} />
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={resetToIdle}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 7,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--glass-bg-medium)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {result.success ? 'Run another task' : 'Run different task'}
              </button>
              {!result.success && (
                <button
                  onClick={() => {
                    setPhase('idle');
                    setSteps([]);
                    setCurrentScreenshot(null);
                    setResult(null);
                    setElapsed(0);
                    // Re-run with same task after a tick
                    setTimeout(() => runTask(), 50);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: '1px solid rgba(59,130,246,0.35)',
                    background: 'rgba(59,130,246,0.1)',
                    color: '#3b82f6',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── StepRow ─────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: StepDisplay }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '3px 0',
    }}>
      <StatusDot status={step.status} />
      <span style={{
        fontSize: 11,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        color: step.status === 'failed'
          ? 'rgba(239,68,68,0.75)'
          : step.status === 'running'
          ? 'var(--text-primary)'
          : 'var(--text-secondary)',
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontWeight: step.status === 'running' ? 600 : 500,
      }}>
        {step.label}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {step.n}
      </span>
    </div>
  );
}

// ─── StepLogCollapsible ───────────────────────────────────────────────────────

function StepLogCollapsible({ steps }: { steps: StepDisplay[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 0',
          fontSize: 11,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'inherit',
        }}
      >
        <svg
          width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
        >
          <polyline points="4 2 10 6 4 10" />
        </svg>
        {expanded ? 'Hide' : 'Show'} {steps.length} step{steps.length !== 1 ? 's' : ''}
      </button>

      {expanded && (
        <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {steps.map(s => <StepRow key={s.n} step={s} />)}
        </div>
      )}
    </div>
  );
}
