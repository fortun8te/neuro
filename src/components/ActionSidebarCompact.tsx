/**
 * ActionSidebarCompact — Manus-style agent instruction panel
 *
 * Layout (top to bottom):
 * 1. Activity header: status indicator + step counter
 * 2. Task progression: collapsible step list with step counter
 * 3. Input bar: message input + 4 circular action buttons
 *
 * Features:
 * - Input always enabled (queue model): new messages queue while a run is active
 * - Runs displayed as collapsible blocks with step-level status dots
 * - Step states: pending (dim dot) | running (spinning ring) | done (green) | error (red)
 * - Minimal "Done" footer on completed runs (no star rating, no suggested prompts)
 * - Document card inside run block when a doc is created (plan/write routes)
 * - DocumentViewer modal for full-screen doc reading
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { routeInstruction } from '../utils/agentRouter';
import { detectFastRoute, extractSearchQuery, parseAllSecondaryIntents } from '../utils/routeExecutor';
import { desktopBus } from '../utils/desktopBus';
import type { AskUserRequest } from '../utils/computerAgent/orchestrator';
import { addMemory, searchMemories } from '../utils/memoryStore';
import { addDocument } from '../utils/documentStore';
import type { AgentDocument } from '../utils/documentStore';
import { ollamaService } from '../utils/ollama';
import { getChatModel } from '../utils/modelConfig';
import { DocumentViewer } from './DocumentViewer';
import { ResponseStream } from './ResponseStream';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { vfs, generateSessionId, getSessionSuffix } from '../utils/sessionFileSystem';
import { runMassResearch } from '../utils/massResearch';
import type { ResearchProgressEvent } from '../utils/massResearch';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ActionLogEntry {
  iter: number;
  desc: string;
  type: string;
  ts: number;
}

interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  output?: string;
  subSteps?: { label: string; done: boolean }[];
  isCollapsed?: boolean;
  hidden?: boolean;
  /** When set, this step is a goal clarification question (blue border) */
  clarificationQuestion?: string;
  /** Executor selfCheck / reasoning shown while step is running */
  reasoning?: string;
  /** True when the 120s timeout fired — renders in amber instead of green */
  timedOut?: boolean;
  /** True while the executor verifyState check is in progress */
  verifying?: boolean;
  /** Latest screenshot from the executor vision loop (base64) */
  latestScreenshot?: string;
  /** Action log from the executor vision loop */
  actionLog?: ActionLogEntry[];
  /** Current screen state description from executor */
  screenState?: string;
  /** Current iteration / max iteration for the executor loop */
  iterProgress?: { iter: number; maxIter: number };
}

interface AgentRun {
  id: string;
  userMessage: string;
  steps: AgentStep[];
  status: 'running' | 'done' | 'error';
  rating?: number;
  suggestions?: string[];
  document?: AgentDocument;
  createdAt: number;
  /** Final synthesized answer from the agent (displayed prominently when done) */
  finalAnswer?: string;
  /** Error detail when status is 'error' */
  errorDetail?: string;
}

export interface AgentState {
  phase: 'idle' | 'planning' | 'executing' | 'verifying' | 'asking' | 'done' | 'error';
  message: string;
  stepIndex?: number;
  totalSteps?: number;
  plan?: Array<{ instruction: string; highStakes: boolean }>;
  steps: Array<{ instruction: string; highStakes?: boolean; status: 'pending' | 'running' | 'done' | 'failed'; result?: string }>;
}

interface ActionSidebarCompactProps {
  machineId: string;
  onComputerTask?: (goal: string) => void;
  agentState?: AgentState;
}

// ─────────────────────────────────────────────────────────────
// Route type -> color
// ─────────────────────────────────────────────────────────────

const ROUTE_COLORS: Record<string, string> = {
  search:   'rgba(56,189,248,0.80)',
  write:    'rgba(167,139,250,0.80)',
  browse:   'rgba(52,211,153,0.80)',
  memory:   'rgba(251,191,36,0.80)',
  plan:     'rgba(129,140,248,0.80)',
  research: 'rgba(244,114,182,0.80)',
  chat:     'rgba(255,255,255,0.50)',
};

// ─────────────────────────────────────────────────────────────
// Step dot / spinner
// ─────────────────────────────────────────────────────────────

// Keyframes for _nomad_spin, _nomad_pulse, _nomad_dot1/2/3 are in index.css

// ── Thinking dots — iMessage-style 3-dot typing indicator ──

function ThinkingDots() {
  const dot: React.CSSProperties = {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'rgba(99,155,255,0.70)',
    display: 'inline-block',
    animationDuration: '1.2s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
      <span style={{ ...dot, animationName: '_nomad_dot1' }} />
      <span style={{ ...dot, animationName: '_nomad_dot2' }} />
      <span style={{ ...dot, animationName: '_nomad_dot3' }} />
    </span>
  );
}

function StepDot({ status, timedOut }: { status: AgentStep['status']; timedOut?: boolean }) {
  if (status === 'running') {
    return (
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: '1.5px solid rgba(99,155,255,0.15)',
          borderTopColor: 'rgba(99,155,255,0.7)',
          animation: '_nomad_spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
    );
  }
  if (status === 'done') {
    const bg = timedOut ? 'rgba(251,191,36,0.70)' : 'rgba(52,211,153,0.70)';
    return (
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: bg,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.70)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      </div>
    );
  }
  // pending
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
        flexShrink: 0,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Document card (inline in run block)
// ─────────────────────────────────────────────────────────────

function DocCardInline({
  doc,
  onClick,
}: {
  doc: AgentDocument;
  onClick: () => void;
}) {
  const preview = doc.content
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .slice(0, 2)
    .join(' -- ');

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(30,40,80,0.5)',
        border: '1px solid rgba(60,80,180,0.30)',
        cursor: 'pointer',
        marginTop: 8,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(99,130,255,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(99,130,255,0.90)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {doc.title}
        </div>
        {preview && (
          <div
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 3,
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            } as React.CSSProperties}
          >
            {preview}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: -2 }}>...</div>
    </button>
  );
}


// ─────────────────────────────────────────────────────────────
// Run block
// ─────────────────────────────────────────────────────────────

function RunBlock({
  run,
  onDocClick,
  isLatest,
}: {
  run: AgentRun;
  onDocClick: (doc: AgentDocument) => void;
  isLatest?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!isLatest && run.status !== 'running');
  // Track which steps are collapsed (by id). Default: all completed steps collapsed, running/latest expanded.
  const [collapsedSteps, setCollapsedSteps] = useState<Set<string>>(() => new Set());

  const doneSteps = run.steps.filter(s => s.status === 'done').length;
  const totalSteps = run.steps.length;
  const routeType = run.steps[1]?.label.toLowerCase().includes('search') ? 'search'
    : run.steps[1]?.label.toLowerCase().includes('plan') ? 'plan'
    : run.steps[1]?.label.toLowerCase().includes('memor') ? 'memory'
    : run.steps[1]?.label.toLowerCase().includes('brows') ? 'browse'
    : run.steps[1]?.label.toLowerCase().includes('writ') ? 'write'
    : 'chat';
  const accentColor = ROUTE_COLORS[routeType] || ROUTE_COLORS.chat;

  const visibleSteps = run.steps.filter(s => !s.hidden);
  const lastVisibleIndex = visibleSteps.length - 1;

  const toggleStep = useCallback((stepId: string) => {
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 8,
        marginBottom: 4,
        overflow: 'hidden',
      }}
    >
      {/* Run header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Status dot indicator */}
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            flexShrink: 0,
            background: run.status === 'done'
              ? 'rgba(52,211,153,0.70)'
              : run.status === 'error'
                ? 'rgba(239,68,68,0.70)'
                : accentColor,
            ...(run.status === 'running' ? { animation: '_nomad_spin 2s linear infinite' } : {}),
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: 11,
            color: 'rgba(255,255,255,0.65)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {run.userMessage.length > 50 ? run.userMessage.slice(0, 50) + '...' : run.userMessage}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {doneSteps}/{totalSteps}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            color: 'rgba(255,255,255,0.20)',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 10px 8px' }}>
              {visibleSteps.map((step, idx) => {
                const isStepCollapsed = collapsedSteps.has(step.id);
                const isLastStep = idx === lastVisibleIndex;
                const isStepDone = step.status === 'done' || step.status === 'error';
                // Default expand: latest step or running step. Others collapsed if done.
                const shouldDefaultExpand = isLastStep || step.status === 'running';

                return (
                  <div key={step.id}>
                    {/* Collapsible step header (only for agent steps with content worth collapsing) */}
                    {isStepDone && !isLastStep && step.id.startsWith('agent_step_') ? (
                      <>
                        <button
                          onClick={() => toggleStep(step.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 0',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{
                            fontSize: 10,
                            color: 'rgba(156,163,175,0.50)',
                            display: 'inline-block',
                            transition: 'transform 0.15s ease',
                            transform: isStepCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}>
                            &#9656;
                          </span>
                          <StepDot status={step.status} timedOut={step.timedOut} />
                          <span style={{
                            flex: 1,
                            fontSize: 10,
                            color: step.timedOut ? 'rgba(251,191,36,0.50)' : 'rgba(255,255,255,0.40)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {step.label}
                          </span>
                          {step.actionLog && step.actionLog.length > 0 && (
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.20)', flexShrink: 0 }}>
                              {step.actionLog.length} actions
                            </span>
                          )}
                        </button>
                        {!isStepCollapsed && (
                          <StepRow step={step} defaultExpanded={false} />
                        )}
                      </>
                    ) : (
                      <StepRow step={step} defaultExpanded={shouldDefaultExpand} />
                    )}
                  </div>
                );
              })}

              {/* Document card */}
              {run.document && (
                <DocCardInline doc={run.document} onClick={() => onDocClick(run.document!)} />
              )}

              {/* Task completed footer with final answer */}
              {run.status === 'done' && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {run.finalAnswer ? (
                    <div
                      style={{
                        background: 'rgba(52,211,153,0.06)',
                        border: '1px solid rgba(52,211,153,0.15)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: 9, color: 'rgba(52,211,153,0.70)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Answer</span>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto' }}>
                        {run.finalAnswer}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span style={{ fontSize: 10, color: 'rgba(52,211,153,0.80)' }}>Done</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error footer with detail */}
              {run.status === 'error' && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {run.errorDetail ? (
                    <div
                      style={{
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: 8,
                        padding: '8px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="rgba(239,68,68,0.80)" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="3" y1="3" x2="9" y2="9" />
                          <line x1="9" y1="3" x2="3" y2="9" />
                        </svg>
                        <span style={{ fontSize: 9, color: 'rgba(239,68,68,0.70)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Error</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        {run.errorDetail}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.80)' }}>Task failed</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step row
// ─────────────────────────────────────────────────────────────

const StepRow = memo(function StepRow({ step, defaultExpanded }: { step: AgentStep; defaultExpanded?: boolean }) {
  // Auto-show output for response/streaming steps so the user actually sees the answer
  const isResponseStep = /stream|generat|response/i.test(step.label);
  const [showOutput, setShowOutput] = useState(isResponseStep);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [showActionLog, setShowActionLog] = useState(defaultExpanded ?? step.status === 'running');
  const hasOutput = !!step.output && step.output.trim().length > 0;
  const isAgentStep = step.id.startsWith('agent_step_');
  const hasActionLog = isAgentStep && step.actionLog && step.actionLog.length > 0;
  const hasScreenshot = isAgentStep && !!step.latestScreenshot;
  const actionLogCount = step.actionLog?.length ?? 0;

  // Keep action log expanded while step is running
  useEffect(() => {
    if (step.status === 'running') setShowActionLog(true);
  }, [step.status]);

  // Chevron helper
  const Chevron = ({ expanded, size = 10 }: { expanded: boolean; size?: number }) => (
    <span style={{
      fontSize: size,
      color: 'rgba(156,163,175,0.50)',
      display: 'inline-block',
      transition: 'transform 0.15s ease',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      flexShrink: 0,
      lineHeight: 1,
    }}>
      &#9656;
    </span>
  );

  // Clarification question — render as blue-border inline card
  if (step.clarificationQuestion) {
    const isAnswered = step.status === 'done';
    return (
      <div style={{
        marginBottom: 6,
        padding: '8px 10px',
        borderRadius: 7,
        border: '1px solid rgba(59,130,246,0.35)',
        background: 'rgba(59,130,246,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: 10, color: 'rgba(147,197,253,0.90)', lineHeight: 1.5 }}>
            {step.clarificationQuestion}
          </span>
        </div>
        {isAnswered && step.output && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.55)', paddingLeft: 16, lineHeight: 1.5 }}>
            {step.output}
          </div>
        )}
        {!isAnswered && (
          <div style={{ marginTop: 5, paddingLeft: 16, fontSize: 9, color: 'rgba(147,197,253,0.50)', fontStyle: 'italic' }}>
            Waiting for your answer...
          </div>
        )}
      </div>
    );
  }

  // Left border accent for expanded state
  const isExpanded = showOutput || showActionLog || showScreenshot;

  return (
    <div style={{
      marginBottom: 6,
      borderLeft: isExpanded ? '2px solid rgba(59,130,246,0.30)' : '2px solid transparent',
      paddingLeft: isExpanded ? 10 : 10,
      transition: 'border-color 0.15s ease',
    }}>
      {/* Step header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StepDot status={step.status} timedOut={step.timedOut} />
        <button
          onClick={() => hasOutput && setShowOutput(s => !s)}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: step.status === 'running'
              ? 'rgba(255,255,255,0.80)'
              : step.status === 'done'
                ? step.timedOut ? 'rgba(251,191,36,0.65)' : 'rgba(255,255,255,0.55)'
                : step.status === 'error'
                  ? 'rgba(239,68,68,0.80)'
                  : 'rgba(255,255,255,0.28)',
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: hasOutput ? 'pointer' : 'default',
            padding: 0,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {step.label}
          </span>
          {/* Iteration badge */}
          {step.iterProgress && step.status === 'running' && (
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'rgba(99,155,255,0.90)',
              background: 'rgba(99,155,255,0.12)',
              border: '1px solid rgba(99,155,255,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
            }}>
              {step.iterProgress.iter}/{step.iterProgress.maxIter}
            </span>
          )}
          {hasOutput && (
            <Chevron expanded={showOutput} />
          )}
        </button>
      </div>

      {/* Screen state description */}
      {isAgentStep && step.screenState && step.status === 'running' && (
        <div style={{
          marginLeft: 12,
          marginTop: 3,
          fontSize: 10,
          color: 'rgba(156,163,175,0.65)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          <span style={{ color: 'rgba(99,155,255,0.60)', marginRight: 4 }}>screen:</span>
          {step.screenState.slice(0, 80)}{step.screenState.length > 80 ? '...' : ''}
        </div>
      )}

      {/* ── Collapsible Screenshot ── */}
      {hasScreenshot && (
        <div style={{ marginLeft: 12, marginTop: 4 }}>
          <button
            onClick={() => setShowScreenshot(s => !s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 10,
              color: showScreenshot ? 'rgba(156,163,175,0.65)' : 'rgba(156,163,175,0.40)',
            }}
          >
            <Chevron expanded={showScreenshot} />
            <span style={{ fontSize: 9 }}>screenshot</span>
          </button>
          <AnimatePresence>
            {showScreenshot && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ marginTop: 4, marginLeft: 12 }}>
                  {/* Thumbnail */}
                  <img
                    src={`data:image/jpeg;base64,${step.latestScreenshot}`}
                    alt="Agent view"
                    style={{
                      width: 80,
                      height: 50,
                      objectFit: 'cover',
                      borderRadius: 5,
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'block',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      // Toggle between thumbnail and full size
                      const img = e.currentTarget;
                      if (img.style.width === '80px' || img.style.width === '') {
                        img.style.width = '100%';
                        img.style.maxWidth = '280px';
                        img.style.height = 'auto';
                      } else {
                        img.style.width = '80px';
                        img.style.maxWidth = '';
                        img.style.height = '50px';
                      }
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Collapsible Action Log ── */}
      {hasActionLog && (
        <div style={{ marginLeft: 12, marginTop: 3 }}>
          <button
            onClick={() => setShowActionLog(s => !s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 10,
              color: showActionLog ? 'rgba(156,163,175,0.65)' : 'rgba(156,163,175,0.40)',
            }}
          >
            <Chevron expanded={showActionLog} />
            <span style={{ fontSize: 9 }}>
              {showActionLog ? `Actions (${actionLogCount})` : `${actionLogCount} actions`}
            </span>
          </button>
          {showActionLog && (
            <div style={{ marginLeft: 12, marginTop: 2 }}>
              {(step.actionLog ?? []).map((entry, i) => {
                const isVerify = entry.type === 'verify';
                const isOk = entry.desc.includes('OK');
                return (
                  <div
                    key={`${entry.ts}_${i}`}
                    style={{
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isVerify
                        ? isOk ? 'rgba(52,211,153,0.70)' : 'rgba(251,191,36,0.60)'
                        : 'rgba(156,163,175,0.55)',
                      lineHeight: 1.5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.18)', marginRight: 3 }}>-&gt;</span>
                    {entry.desc}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reasoning line: shown while step is running (non-agent steps) */}
      {step.status === 'running' && step.reasoning && !isAgentStep && (
        <div style={{
          marginLeft: 12,
          marginTop: 2,
          fontSize: 11,
          color: 'rgba(156,163,175,0.75)',
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}>
          {`Checking: ${step.reasoning.slice(0, 80)}${step.reasoning.length > 80 ? '...' : ''}`}
        </div>
      )}
      {/* Verifying indicator */}
      {step.status === 'running' && step.verifying && (
        <div style={{
          marginLeft: 12,
          marginTop: 2,
          fontSize: 10,
          color: 'rgba(156,163,175,0.50)',
          fontStyle: 'italic',
        }}>
          Verifying...
        </div>
      )}

      {/* Output (expanded) */}
      <AnimatePresence>
        {showOutput && hasOutput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 4,
                marginLeft: 12,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.50)',
                lineHeight: 1.55,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <ResponseStream
                textStream={step.output || ''}
                mode="typewriter"
                speed={50}
                className="text-xs"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-steps */}
      {step.subSteps && step.subSteps.length > 0 && (
        <div style={{ marginLeft: 12, marginTop: 4 }}>
          {step.subSteps.map((ss, i) => (
            <div key={`${ss.label}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <div style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: ss.done ? 'rgba(52,211,153,0.60)' : 'rgba(255,255,255,0.15)',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{ss.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Circular icon button (for input bar)
// ─────────────────────────────────────────────────────────────

function CircleButton({
  children,
  onClick,
  disabled,
  title,
  active,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'rgba(43,121,255,0.18)' : 'rgba(255,255,255,0.06)',
        border: active ? '1px solid rgba(43,121,255,0.30)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? 'rgba(43,121,255,0.9)' : disabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ID generator
// ─────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Combine a user-controlled AbortSignal with a timeout so LLM/bus calls don't hang forever. */
function combinedSignal(userSignal: AbortSignal, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);

  const onUserAbort = () => {
    controller.abort(userSignal.reason);
    clearTimeout(timer);
  };

  if (userSignal.aborted) {
    controller.abort(userSignal.reason);
    clearTimeout(timer);
  } else {
    userSignal.addEventListener('abort', onUserAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      userSignal.removeEventListener('abort', onUserAbort);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Agent status panel (computer agent orchestrator)
// ─────────────────────────────────────────────────────────────

function AgentStatusStep({
  step,
  index,
  iterLabel,
}: {
  step: AgentState['steps'][number];
  index: number;
  iterLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = !!step.result && step.result.trim().length > 0;

  const dotColor =
    step.status === 'running'  ? undefined
    : step.status === 'done'   ? 'rgba(52,211,153,0.75)'
    : step.status === 'failed' ? 'rgba(239,68,68,0.75)'
    : 'rgba(255,255,255,0.14)'; // pending

  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        {/* Status indicator */}
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {step.status === 'running' ? (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: '1.5px solid rgba(99,155,255,0.18)',
                borderTopColor: 'rgba(99,155,255,0.75)',
                animation: '_nomad_spin 0.75s linear infinite',
              }}
            />
          ) : (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotColor,
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* Instruction text */}
        <button
          onClick={() => hasResult && setExpanded(e => !e)}
          style={{
            flex: 1,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: step.status === 'running'
              ? 'rgba(255,255,255,0.82)'
              : step.status === 'done'
                ? 'rgba(255,255,255,0.48)'
                : step.status === 'failed'
                  ? 'rgba(239,68,68,0.75)'
                  : 'rgba(255,255,255,0.26)',
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: hasResult ? 'pointer' : 'default',
            padding: 0,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.20)', marginRight: 4 }}>{String(index + 1).padStart(2, '0')}</span>
          {step.instruction}
          {iterLabel && (
            <span style={{
              marginLeft: 5,
              fontSize: 8,
              color: 'rgba(255,255,255,0.28)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {iterLabel}
            </span>
          )}
          {step.highStakes && (
            <span style={{
              marginLeft: 5,
              fontSize: 8,
              color: 'rgba(251,191,36,0.70)',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.18)',
              borderRadius: 3,
              padding: '1px 4px',
            }}>
              high-stakes
            </span>
          )}
          {hasResult && (
            <span style={{ marginLeft: 4, color: 'rgba(255,255,255,0.18)', fontSize: 7 }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </button>
      </div>

      {/* Result detail */}
      <AnimatePresence>
        {expanded && hasResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 3,
                marginLeft: 15,
                padding: '5px 7px',
                borderRadius: 5,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(255,255,255,0.42)',
                lineHeight: 1.5,
                maxHeight: 100,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {step.result}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentStatusPanel({ state, iterCount }: { state: AgentState; iterCount?: { iter: number; maxIter: number; stepIndex: number } | null }) {
  const { phase, message, stepIndex, totalSteps, steps } = state;

  if (phase === 'idle') return null;

  const phaseColor =
    phase === 'planning'  ? 'rgba(129,140,248,0.80)'
    : phase === 'executing' ? 'rgba(56,189,248,0.80)'
    : phase === 'verifying' ? 'rgba(251,191,36,0.80)'
    : phase === 'asking'    ? 'rgba(251,191,36,0.80)'
    : phase === 'done'      ? 'rgba(52,211,153,0.80)'
    : phase === 'error'     ? 'rgba(239,68,68,0.80)'
    : 'rgba(255,255,255,0.40)';

  const phaseLabel =
    phase === 'planning'  ? 'Planning'
    : phase === 'executing' ? 'Executing'
    : phase === 'verifying' ? 'Verifying'
    : phase === 'asking'    ? 'Waiting'
    : phase === 'done'      ? 'Done'
    : phase === 'error'     ? 'Error'
    : phase;

  return (
    <div
      style={{
        margin: '0 12px 8px',
        padding: '10px 11px',
        borderRadius: 9,
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Phase header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: steps.length > 0 ? 8 : 0 }}>
        {/* Phase dot / spinner */}
        {phase === 'planning' || phase === 'executing' || phase === 'verifying' || phase === 'asking' ? (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              border: `1.5px solid ${phaseColor.replace('0.80', '0.18')}`,
              borderTopColor: phaseColor,
              animation: '_nomad_spin 0.75s linear infinite',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: phaseColor, flexShrink: 0 }} />
        )}

        <span style={{ fontSize: 10, fontWeight: 600, color: phaseColor, letterSpacing: '0.04em' }}>
          {phaseLabel}
        </span>

        {totalSteps !== undefined && stepIndex !== undefined && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginLeft: 2, fontVariantNumeric: 'tabular-nums' }}>
            {stepIndex + 1} / {totalSteps}
          </span>
        )}

        <span
          style={{
            flex: 1,
            fontSize: 9,
            color: 'rgba(255,255,255,0.40)',
            fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginLeft: 4,
          }}
          title={message}
        >
          {message}
        </span>
      </div>

      {/* Step list */}
      {steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {steps.map((step, i) => (
            <AgentStatusStep
              key={`agent_status_${i}_${step.instruction.slice(0, 20)}`}
              step={step}
              index={i}
              iterLabel={iterCount && iterCount.stepIndex === i && step.status === 'running'
                ? `attempt ${iterCount.iter}/${iterCount.maxIter}`
                : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function ActionSidebarCompact({ machineId: _machineId, onComputerTask, agentState }: ActionSidebarCompactProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [pendingQueue, setPendingQueue] = useState<string[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const isRoutingRef = useRef(false); // synchronous guard — React state is async and races
  const [input, setInput] = useState('');
  const [viewingDoc, setViewingDoc] = useState<AgentDocument | null>(null);
  const [isTaskExpanded, setIsTaskExpanded] = useState(true);
  const [iterCount, setIterCount] = useState<{ iter: number; maxIter: number; stepIndex: number } | null>(null);
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);
  const askUserResolveRef = useRef<((r: import('../utils/computerAgent/orchestrator').AskUserResponse) => void) | null>(null);
  const [clarifyStepId, setClarifyStepId] = useState<string | null>(null);
  const prevAskUserRef = useRef<AskUserRequest | null>(null);

  const [showNewActivity, setShowNewActivity] = useState(false);
  const [sessionSavedFlash, setSessionSavedFlash] = useState(false);
  const [computerId, setComputerId] = useState(() => generateSessionId());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userScrolledRef = useRef(false);
  // stepId -> setTimeout handle for the 120s running-stuck timeout
  const stepTimeoutMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track when the current run started (for restart button prominence)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runLongRunning, setRunLongRunning] = useState(false);

  // ── Track long-running tasks for restart button prominence ──
  useEffect(() => {
    if (!runStartedAt) { setRunLongRunning(false); return; }
    const elapsed = Date.now() - runStartedAt;
    if (elapsed >= 30_000) { setRunLongRunning(true); return; }
    const timer = setTimeout(() => setRunLongRunning(true), 30_000 - elapsed);
    return () => clearTimeout(timer);
  }, [runStartedAt]);

  // ── Unmount cleanup: abort in-flight LLM call + clear all step timeouts ──

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stepTimeoutMapRef.current.forEach(h => clearTimeout(h));
      stepTimeoutMapRef.current.clear();
    };
  }, []);

  // ── desktopBus listener — agent_iteration + ask_user + step stuck cleanup ──

  useEffect(() => {
    return desktopBus.subscribe(ev => {
      switch (ev.type) {
        case 'agent_iteration':
          setIterCount({ iter: ev.iter, maxIter: ev.maxIter, stepIndex: ev.stepIndex });
          // Update reasoning + iterProgress on the running agent step
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            const agentSteps = run.steps.filter(s => s.id.startsWith('agent_step_'));
            const target = agentSteps[ev.stepIndex];
            if (!target || target.status !== 'running') return run;
            return {
              ...run,
              steps: run.steps.map(s =>
                s.id === target.id
                  ? { ...s, reasoning: `Attempt ${ev.iter}/${ev.maxIter}`, iterProgress: { iter: ev.iter, maxIter: ev.maxIter } }
                  : s
              ),
            };
          }));
          break;
        case 'agent_plan':
          // Orchestrator emitted a plan — inject step rows into the active run
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            const newSteps: AgentStep[] = ev.steps.map((s, i) => ({
              id: `agent_step_${Date.now()}_${i}`,
              label: s.instruction,
              status: 'pending' as const,
            }));
            return { ...run, steps: [...run.steps, ...newSteps] };
          }));
          break;
        case 'agent_step_start':
          // Mark the matching pending step as running (by stepIndex)
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            // Find pending agent steps (those with ids starting with agent_step_)
            const agentSteps = run.steps.filter(s => s.id.startsWith('agent_step_'));
            const target = agentSteps[ev.stepIndex];
            if (!target) return run;
            return {
              ...run,
              steps: run.steps.map(s =>
                s.id === target.id
                  ? { ...s, status: 'running' as const, reasoning: ev.reasoning, verifying: false }
                  : s
              ),
            };
          }));
          break;
        case 'agent_step_done':
          setIterCount(null);
          // Mark the matching step as done/error
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            const agentSteps = run.steps.filter(s => s.id.startsWith('agent_step_'));
            const target = agentSteps[ev.stepIndex];
            if (!target) return run;
            return {
              ...run,
              steps: run.steps.map(s =>
                s.id === target.id
                  ? { ...s, status: ev.success ? 'done' as const : 'error' as const, output: ev.result, reasoning: undefined, verifying: false }
                  : s
              ),
            };
          }));
          break;
        case 'agent_step_verify':
          // Show "Verifying..." on the currently running step
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            return {
              ...run,
              steps: run.steps.map(s =>
                s.status === 'running' ? { ...s, verifying: true } : s
              ),
            };
          }));
          break;
        case 'ask_user':
          setAskUserRequest(ev.request);
          askUserResolveRef.current = ev.resolve;
          // For clarification requests, inject a question step into the active run
          if (ev.request.isClarification) {
            setActiveRunId(activeId => {
              if (activeId) {
                const stepId = `clarify_${Date.now()}`;
                setClarifyStepId(stepId);
                setRuns(prev => prev.map(r => {
                  if (r.id !== activeId) return r;
                  return {
                    ...r,
                    steps: [...r.steps, {
                      id: stepId,
                      label: ev.request.question,
                      status: 'running' as const,
                      clarificationQuestion: ev.request.question,
                    }],
                  };
                }));
              }
              return activeId;
            });
          }
          break;
        case 'agent_screenshot':
          // Store the latest screenshot on the currently running agent step
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            const runningStep = run.steps.find(s => s.id.startsWith('agent_step_') && s.status === 'running');
            if (!runningStep) return run;
            return {
              ...run,
              steps: run.steps.map(s =>
                s.id === runningStep.id
                  ? { ...s, latestScreenshot: ev.screenshot }
                  : s
              ),
            };
          }));
          break;
        case 'agent_action_desc':
          // Append action description to the running step's action log + update screenState
          setRuns(prev => prev.map(run => {
            if (run.status !== 'running') return run;
            const runningStep = run.steps.find(s => s.id.startsWith('agent_step_') && s.status === 'running');
            if (!runningStep) return run;
            const newEntry: ActionLogEntry = {
              iter: ev.iteration,
              desc: ev.description,
              type: ev.actionType,
              ts: Date.now(),
            };
            return {
              ...run,
              steps: run.steps.map(s =>
                s.id === runningStep.id
                  ? {
                      ...s,
                      actionLog: [...(s.actionLog ?? []), newEntry],
                      ...(ev.screenState ? { screenState: ev.screenState } : {}),
                    }
                  : s
              ),
            };
          }));
          break;
        default:
          break;
      }
    });
  }, []);

  // ── Mark clarification step done when modal closes ──

  useEffect(() => {
    const prev = prevAskUserRef.current;
    prevAskUserRef.current = askUserRequest;
    // Transition: had a clarification request → now null (user answered)
    if (prev?.isClarification && !askUserRequest && clarifyStepId) {
      setRuns(r => r.map(run => ({
        ...run,
        steps: run.steps.map(s =>
          s.id === clarifyStepId
            ? { ...s, status: 'done' as const, output: 'Got it, proceeding...' }
            : s
        ),
      })));
      setClarifyStepId(null);
    }
  }, [askUserRequest, clarifyStepId]);

  // ── Prune old completed runs to prevent unbounded growth ──

  const MAX_RUNS = 30;
  const pruneRuns = useCallback((allRuns: AgentRun[]): AgentRun[] => {
    if (allRuns.length <= MAX_RUNS) return allRuns;
    const running = allRuns.filter(r => r.status === 'running');
    const finished = allRuns.filter(r => r.status !== 'running');
    const keep = finished.slice(-(MAX_RUNS - running.length));
    return [...running, ...keep].sort((a, b) => a.createdAt - b.createdAt);
  }, []);

  // ── Run mutation helpers ──

  const updateRun = useCallback((runId: string, updater: (r: AgentRun) => AgentRun) => {
    setRuns(prev => prev.map(r => r.id === runId ? updater(r) : r));
  }, []);

  const updateStep = useCallback((runId: string, stepId: string, updater: (s: AgentStep) => AgentStep) => {
    setRuns(prev => prev.map(r => {
      if (r.id !== runId) return r;
      return {
        ...r,
        steps: r.steps.map(s => {
          if (s.id !== stepId) return s;
          const updated = updater(s);
          // Clear the 120s timeout when step leaves running
          if (s.status === 'running' && updated.status !== 'running') {
            const handle = stepTimeoutMapRef.current.get(stepId);
            if (handle) {
              clearTimeout(handle);
              stepTimeoutMapRef.current.delete(stepId);
            }
          }
          return updated;
        }),
      };
    }));
  }, []);

  const addStep = useCallback((runId: string, step: AgentStep) => {
    setRuns(prev => prev.map(r => {
      if (r.id !== runId) return r;
      return { ...r, steps: [...r.steps, step] };
    }));
    // Auto-complete if stuck running for > 120s — mark with timedOut warning
    if (step.status === 'running') {
      const existing = stepTimeoutMapRef.current.get(step.id);
      if (existing) clearTimeout(existing);
      const handle = setTimeout(() => {
        stepTimeoutMapRef.current.delete(step.id);
        setRuns(prev => prev.map(r => {
          if (r.id !== runId) return r;
          return {
            ...r,
            steps: r.steps.map(s =>
              s.id === step.id && s.status === 'running'
                ? { ...s, status: 'done' as const, timedOut: true, output: 'Step timed out after 2 minutes.' }
                : s
            ),
          };
        }));
      }, 120_000);
      stepTimeoutMapRef.current.set(step.id, handle);
    }
  }, []);


  // ── Scroll helpers ──

  const scrollToBottomNow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    userScrolledRef.current = false;
    setShowNewActivity(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (!userScrolledRef.current) {
        scrollToBottomNow();
      } else {
        setShowNewActivity(true);
      }
    }, 20);
  }, [scrollToBottomNow]);

  // Attach wheel/touchmove listeners to the scroll container
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onManualScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      if (atBottom) {
        userScrolledRef.current = false;
        setShowNewActivity(false);
      } else {
        userScrolledRef.current = true;
      }
    };

    const onWheel = () => {
      // Mark as user-scrolled immediately; the scroll event will resolve direction
      userScrolledRef.current = true;
    };

    el.addEventListener('scroll', onManualScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchmove', onWheel, { passive: true });

    return () => {
      el.removeEventListener('scroll', onManualScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onWheel);
    };
  }, []);


  // ── Execute a run ──

  const executeRun = useCallback(async (runId: string, userMessage: string) => {
    isRoutingRef.current = true; // sync guard — prevents race on fast double-submit
    setIsRouting(true);
    setActiveRunId(runId);
    setRunStartedAt(Date.now());

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    // Step 1: Routing
    const routeStepId = uid();
    setRuns(prev => prev.map(r => {
      if (r.id !== runId) return r;
      return {
        ...r,
        steps: [{
          id: routeStepId,
          label: 'Routing instruction',
          status: 'running',
          hidden: true,
        }],
      };
    }));
    scrollToBottom();

    try {
      // ── Fast-path regex routing (no LLM needed for obvious cases) ──
      const fastRoute = detectFastRoute(userMessage);

      // Build conversation history for context-aware routing
      const conversationHistory = runs
        .slice(-5)
        .flatMap(run => [
          { role: 'user' as const, content: run.userMessage },
          ...(run.steps.some(s => s.output) ? [{ role: 'assistant' as const, content: run.steps.find(s => s.output)?.output || '' }] : [])
        ]);

      const route = fastRoute
        ? { type: fastRoute as import('../utils/agentRouter').AgentRouteType, payload: userMessage }
        : await routeInstruction(userMessage, conversationHistory);

      updateStep(runId, routeStepId, s => ({
        ...s,
        status: 'done',
        output: `Route: ${route.type}`,
      }));

      let responseText = '';

      // Step 2: Route-specific
      const actionStepId = uid();
      const actionLabel = route.type === 'search' ? 'Searching the web'
        : route.type === 'write' ? 'Writing document'
        : route.type === 'browse' ? 'Browsing page'
        : route.type === 'memory' ? 'Recalling from memory'
        : route.type === 'plan' ? 'Running computer agent'
        : route.type === 'research' ? 'Researching'
        : 'Generating response';

      addStep(runId, {
        id: actionStepId,
        label: actionLabel,
        status: 'running',
      });
      scrollToBottom();

      switch (route.type) {
        case 'memory': {
          // Search existing memories for relevant content; if none found, save instead
          const memQuery = userMessage.replace(/^(remember|recall|find in memory|what do you know about)\s+/i, '').trim();
          const matches = searchMemories(memQuery);
          const relevant = matches.filter(m => !m.tags.includes('do-not-surface-unprompted')).slice(0, 5);
          if (relevant.length > 0) {
            const summary = relevant.map(m => `- ${m.content}`).join('\n');
            updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: summary }));
            responseText = summary;
          } else {
            addMemory('general', userMessage);
            updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: 'Saved to memory.' }));
            responseText = 'Saved to memory.';
          }
          break;
        }

        case 'search': {
          // Don't pre-navigate. Give the FULL user message to the computer agent.
          // The agent's planner will decide what to search for and how.
          desktopBus.emit({ type: 'open_window', window: 'chrome' });

          updateStep(runId, actionStepId, s => ({ ...s, output: `Working on: ${userMessage}` }));
          responseText = `Working on: ${userMessage}`;

          const searchGoal = `The user asked: "${userMessage}". Open the browser, search for the relevant information, read the results, and come back with a clear, direct answer. Use the search engine at ${INFRASTRUCTURE.searxngUrl} to search.`;

          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const cleanup = () => { settled = true; unsub(); clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); };

            const unsub = desktopBus.subscribe((busEv) => {
              if (settled) return;
              if (busEv.type === 'agent_status' && (busEv.phase === 'done' || busEv.phase === 'error')) {
                const finalOutput = busEv.phase === 'done'
                  ? busEv.message
                  : `Error: ${busEv.message}`;
                updateStep(runId, actionStepId, s => ({
                  ...s,
                  status: busEv.phase === 'done' ? 'done' : 'error',
                  output: finalOutput,
                }));
                // Store final answer or error detail on the run for prominent display
                if (busEv.phase === 'done') {
                  updateRun(runId, r => ({ ...r, finalAnswer: busEv.message }));
                } else {
                  updateRun(runId, r => ({ ...r, errorDetail: busEv.message }));
                }
                responseText = finalOutput;
                cleanup();
                resolve();
              }
            });

            const timer = setTimeout(() => {
              if (settled) return;
              cleanup();
              reject(new DOMException('Search agent timed out', 'TimeoutError'));
            }, 300_000);

            const onAbort = () => { if (!settled) { cleanup(); reject(abort.signal.reason ?? new DOMException('Aborted', 'AbortError')); } };
            if (abort.signal.aborted) { cleanup(); reject(new DOMException('Aborted', 'AbortError')); return; }
            abort.signal.addEventListener('abort', onAbort, { once: true });

            // Dispatch immediately — agent handles everything including navigation
            setTimeout(() => {
              if (!settled) desktopBus.emit({ type: 'run_goal', goal: searchGoal });
            }, 800);
          });
          break;
        }

        case 'browse': {
          // Don't pre-navigate or extract URLs — let the agent handle everything
          desktopBus.emit({ type: 'open_window', window: 'chrome' });

          const browseGoal = `The user asked: "${userMessage}". Open the browser, navigate to the requested page, and complete whatever they asked. If they just want to visit a site, navigate there, confirm it loaded, and describe what you see.`;

          updateStep(runId, actionStepId, s => ({ ...s, output: `Working on: ${userMessage}` }));
          responseText = `Working on: ${userMessage}`;

          // Dispatch to computer agent — the task is not done until the agent reports back
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const cleanup = () => { settled = true; unsub(); clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); };

            const unsub = desktopBus.subscribe((busEv) => {
              if (settled) return;
              if (busEv.type === 'agent_status' && (busEv.phase === 'done' || busEv.phase === 'error')) {
                const finalOutput = busEv.phase === 'done'
                  ? busEv.message
                  : `Error: ${busEv.message}`;
                updateStep(runId, actionStepId, s => ({
                  ...s,
                  status: busEv.phase === 'done' ? 'done' : 'error',
                  output: finalOutput,
                }));
                // Store final answer or error detail on the run for prominent display
                if (busEv.phase === 'done') {
                  updateRun(runId, r => ({ ...r, finalAnswer: busEv.message }));
                } else {
                  updateRun(runId, r => ({ ...r, errorDetail: busEv.message }));
                }
                responseText = finalOutput;
                cleanup();
                resolve();
              }
            });

            const timer = setTimeout(() => {
              if (settled) return;
              cleanup();
              reject(new DOMException('Browse agent timed out', 'TimeoutError'));
            }, 300_000);

            const onAbort = () => { if (!settled) { cleanup(); reject(abort.signal.reason ?? new DOMException('Aborted', 'AbortError')); } };
            if (abort.signal.aborted) { cleanup(); reject(new DOMException('Aborted', 'AbortError')); return; }
            abort.signal.addEventListener('abort', onAbort, { once: true });

            // Dispatch immediately — agent handles everything including navigation
            setTimeout(() => {
              if (!settled) desktopBus.emit({ type: 'run_goal', goal: browseGoal });
            }, 800);
          });
          break;
        }

        case 'desktop': {
          // Parse common desktop patterns without running the full vision loop
          const lower = userMessage.toLowerCase();
          let handled = false;

          // Open/close window commands — also handle "launch" as a synonym for "open"
          const openMatch = lower.match(/(?:open|launch)\s+(chrome|finder|terminal)/);
          const closeMatch = lower.match(/close\s+(chrome|finder|terminal)/);
          const navigateMatch = lower.match(/(?:navigate|go)\s+(?:to\s+)?(\S+)/);

          if (openMatch) {
            const win = openMatch[1] as 'chrome' | 'finder' | 'terminal';
            desktopBus.emit({ type: 'open_window', window: win });

            // Collect ALL secondary intents from compound/multi-part commands
            const secondaryActions = parseAllSecondaryIntents(userMessage);

            if (secondaryActions.length > 0) {
              const outputParts: string[] = [`Opened ${win}`];
              secondaryActions.forEach((action, idx) => {
                const delay = 800 + idx * 600;
                if (action.kind === 'search') {
                  setTimeout(() => desktopBus.emit({ type: 'navigate_chrome', url: action.url }), delay);
                  outputParts.push(`searching: ${action.query}`);
                } else if (action.kind === 'browse') {
                  setTimeout(() => desktopBus.emit({ type: 'navigate_chrome', url: action.url }), delay);
                  outputParts.push(`navigating to ${action.url}`);
                } else if (action.kind === 'finder') {
                  setTimeout(() => desktopBus.emit({ type: 'open_path', path: action.path }), delay);
                  outputParts.push(`opening ${action.path}`);
                }
              });
              const summary = outputParts.join(' → ');
              updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: summary }));
              responseText = summary;
            } else {
              updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: `Opened ${win}` }));
              responseText = `Opened ${win}`;
            }
            handled = true;
          } else if (closeMatch) {
            const win = closeMatch[1] as 'chrome' | 'finder' | 'terminal';
            desktopBus.emit({ type: 'close_window', window: win });
            updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: `Closed ${win}` }));
            responseText = `Closed ${win}`;
            handled = true;
          } else if (navigateMatch) {
            let url = navigateMatch[1];
            if (!url.startsWith('http')) url = 'https://' + url;
            desktopBus.emit({ type: 'navigate_chrome', url });
            updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: `Navigating to ${url}` }));
            responseText = `Navigating to ${url}`;
            handled = true;
          }

          if (!handled) {
            // Fall back to full computer agent for complex desktop goals.
            // Keep step 'running' and wait for agent_status done/error before finalizing.
            updateStep(runId, actionStepId, s => ({ ...s, output: 'Running goal in vision loop...' }));
            responseText = `Running desktop task: ${userMessage}`;

            await new Promise<void>((resolve, reject) => {
              let settled = false;
              const cleanup = () => { settled = true; unsub(); clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); };

              const unsub = desktopBus.subscribe((busEv) => {
                if (settled) return;
                if (busEv.type === 'agent_status' && (busEv.phase === 'done' || busEv.phase === 'error')) {
                  const finalOutput = busEv.phase === 'done'
                    ? `Done: ${busEv.message}`
                    : `Error: ${busEv.message}`;
                  updateStep(runId, actionStepId, s => ({
                    ...s,
                    status: busEv.phase === 'done' ? 'done' : 'error',
                    output: finalOutput,
                  }));
                  responseText = finalOutput;
                  cleanup();
                  resolve();
                }
              });

              // Timeout after 5 minutes
              const timer = setTimeout(() => {
                if (settled) return;
                cleanup();
                reject(new DOMException('Desktop agent timed out after 5 minutes', 'TimeoutError'));
              }, 300_000);

              // User abort
              const onAbort = () => { if (!settled) { cleanup(); reject(abort.signal.reason ?? new DOMException('Aborted', 'AbortError')); } };
              if (abort.signal.aborted) { cleanup(); reject(new DOMException('Aborted', 'AbortError')); return; }
              abort.signal.addEventListener('abort', onAbort, { once: true });

              desktopBus.emit({ type: 'run_goal', goal: userMessage });
            });
          }
          break;
        }

        case 'plan': {
          // Complex task — hand off to computer agent vision loop
          updateStep(runId, actionStepId, s => ({ ...s, output: 'Dispatching to computer agent...' }));
          responseText = `Running complex task: ${userMessage}`;

          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const cleanup = () => { settled = true; unsub(); clearTimeout(timer); abort.signal.removeEventListener('abort', onAbort); };

            const unsub = desktopBus.subscribe((busEv) => {
              if (settled) return;
              if (busEv.type === 'agent_status' && (busEv.phase === 'done' || busEv.phase === 'error')) {
                const finalOutput = busEv.phase === 'done'
                  ? busEv.message
                  : `Error: ${busEv.message}`;
                updateStep(runId, actionStepId, s => ({
                  ...s,
                  status: busEv.phase === 'done' ? 'done' : 'error',
                  output: finalOutput,
                }));
                // Store final answer or error detail on the run for prominent display
                if (busEv.phase === 'done') {
                  updateRun(runId, r => ({ ...r, finalAnswer: busEv.message }));
                } else {
                  updateRun(runId, r => ({ ...r, errorDetail: busEv.message }));
                }
                responseText = finalOutput;
                cleanup();
                resolve();
              }
            });

            // Timeout after 5 minutes
            const timer = setTimeout(() => {
              if (settled) return;
              cleanup();
              reject(new DOMException('Plan agent timed out after 5 minutes', 'TimeoutError'));
            }, 300_000);

            // User abort
            const onAbort = () => { if (!settled) { cleanup(); reject(abort.signal.reason ?? new DOMException('Aborted', 'AbortError')); } };
            if (abort.signal.aborted) { cleanup(); reject(new DOMException('Aborted', 'AbortError')); return; }
            abort.signal.addEventListener('abort', onAbort, { once: true });

            desktopBus.emit({ type: 'run_goal', goal: userMessage });
            if (onComputerTask) onComputerTask(userMessage);
          });
          break;
        }

        case 'write': {
          const streamStepId = uid();
          addStep(runId, {
            id: streamStepId,
            label: 'Writing content',
            status: 'running',
          });
          scrollToBottom();

          updateStep(runId, actionStepId, s => ({ ...s, status: 'done' }));

          const writePrompt = `Write a detailed, well-structured document about: ${userMessage}`;
          const writeSystemPrompt = 'You are a skilled writer. Produce clear, well-structured content with ## headings.';

          const { signal: writeSignal, cleanup: writeCleanup } = combinedSignal(abort.signal, 60_000);
          try {
            await ollamaService.generateStream(
              writePrompt,
              writeSystemPrompt,
              {
                model: getChatModel(),
                temperature: 0.6,
                num_predict: 500,
                signal: writeSignal,
                onChunk: (chunk) => {
                  responseText += chunk;
                  updateStep(runId, streamStepId, s => ({ ...s, output: responseText }));
                  scrollToBottom();
                },
              }
            );
          } finally {
            writeCleanup();
          }

          updateStep(runId, streamStepId, s => ({ ...s, status: 'done' }));

          if (responseText.length > 200) {
            const firstLine = responseText.split('\n').find(l => l.trim()) || userMessage;
            const title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 60) || userMessage.slice(0, 60);
            const savedDoc = addDocument({ title, content: responseText, type: 'doc' });
            updateRun(runId, r => ({ ...r, document: savedDoc }));
          }
          break;
        }

        case 'research': {
          // Mass web fetch pipeline — NOT browser automation
          // Uses Wayfarer batch scraping + qwen3.5:2b summarization + qwen3.5:4b synthesis
          updateStep(runId, actionStepId, s => ({ ...s, status: 'done', output: 'Starting research pipeline' }));

          const queryStepId = uid();
          addStep(runId, { id: queryStepId, label: 'Generating search queries', status: 'running' });
          scrollToBottom();

          const searchStepId = uid();
          const fetchStepId = uid();
          const summarizeStepId = uid();
          const synthesizeStepId = uid();

          const { signal: researchSignal, cleanup: researchCleanup } = combinedSignal(abort.signal, 600_000);
          try {
            const result = await runMassResearch(userMessage, {
              maxSources: 20,
              maxSearchQueries: 5,
              signal: researchSignal,
              onProgress: (ev: ResearchProgressEvent) => {
                switch (ev.type) {
                  case 'generating_queries':
                    updateStep(runId, queryStepId, s => ({ ...s, status: 'running' }));
                    break;
                  case 'searching':
                    updateStep(runId, queryStepId, s => ({
                      ...s,
                      status: 'done',
                      output: `Queries: ${ev.queries.join(', ')}`,
                    }));
                    addStep(runId, { id: searchStepId, label: 'Searching SearXNG', status: 'running' });
                    scrollToBottom();
                    break;
                  case 'found_urls':
                    updateStep(runId, searchStepId, s => ({
                      ...s,
                      status: 'done',
                      output: `Found ${ev.count} unique URLs`,
                    }));
                    addStep(runId, { id: fetchStepId, label: `Fetching ${ev.count} pages`, status: 'running' });
                    scrollToBottom();
                    break;
                  case 'fetching':
                    updateStep(runId, fetchStepId, s => ({
                      ...s,
                      output: `Scraping ${ev.total} pages via Wayfarer...`,
                    }));
                    break;
                  case 'summarizing':
                    updateStep(runId, fetchStepId, s => ({ ...s, status: 'done', output: `Fetched ${ev.total} pages` }));
                    addStep(runId, { id: summarizeStepId, label: `Summarizing ${ev.total} pages`, status: 'running' });
                    scrollToBottom();
                    break;
                  case 'summarizing_page':
                    updateStep(runId, summarizeStepId, s => ({
                      ...s,
                      output: `[${ev.index + 1}] ${ev.url.slice(0, 60)}...`,
                    }));
                    break;
                  case 'synthesizing':
                    updateStep(runId, summarizeStepId, s => ({ ...s, status: 'done' }));
                    addStep(runId, { id: synthesizeStepId, label: 'Synthesizing findings', status: 'running' });
                    scrollToBottom();
                    break;
                  case 'done':
                    updateStep(runId, synthesizeStepId, s => ({ ...s, status: 'done' }));
                    break;
                }
              },
            });

            responseText = result.synthesis;

            // Save findings to VFS
            const sessionId = generateSessionId();
            try {
              vfs.saveActivity(sessionId, machineId, `Research: ${userMessage}`, JSON.stringify({
                query: result.query,
                totalSources: result.totalSources,
                elapsed: result.elapsed,
                sources: result.sources.map(s => ({ url: s.url, title: s.title, summary: s.summary })),
                synthesis: result.synthesis,
              }));
            } catch (e) {
              console.warn('[ActionSidebar] Failed to save research to VFS:', e);
            }

            // Store final answer on the run for prominent display
            updateRun(runId, r => ({ ...r, finalAnswer: result.synthesis }));

          } finally {
            researchCleanup();
          }
          break;
        }

        case 'chat':
        default: {
          const streamStepId = uid();
          addStep(runId, {
            id: streamStepId,
            label: 'Streaming response',
            status: 'running',
          });
          scrollToBottom();

          updateStep(runId, actionStepId, s => ({ ...s, status: 'done' }));

          const systemPrompt = `You are Glance. NOT Qwen, ChatGPT, or Claude — always say "I'm Glance" if asked.
Be extremely concise — 1-3 sentences max for simple questions. No preamble, no "Sure!", no trailing summaries.
Match the user's energy. Direct answers only.`;

          const { signal: chatSignal, cleanup: chatCleanup } = combinedSignal(abort.signal, 15_000);
          try {
            await ollamaService.generateStream(
              userMessage,
              systemPrompt,
              {
                model: 'qwen3.5:4b',
                temperature: 0.6,
                num_predict: 220,
                signal: chatSignal,
                onChunk: (chunk) => {
                  responseText += chunk;
                  updateStep(runId, streamStepId, s => ({ ...s, output: responseText }));
                  scrollToBottom();
                },
              }
            );
          } finally {
            chatCleanup();
          }

          updateStep(runId, streamStepId, s => ({ ...s, status: 'done' }));
          break;
        }
      }

      // Mark run done — extract the final answer from responseText or last step output
      updateRun(runId, r => {
        const answer = responseText.replace(/^Done:\s*/i, '').trim() || undefined;
        // Fallback: if responseText is empty, grab last step's output
        const fallbackAnswer = !answer
          ? [...r.steps].reverse().find(s => s.output && s.output.trim().length > 0 && !s.hidden)?.output?.replace(/^Done:\s*/i, '').trim()
          : undefined;
        return { ...r, status: 'done', finalAnswer: answer || fallbackAnswer };
      });

    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        console.error('[ActionSidebar] Run error:', err);
      }
      // Surface the error in the UI so the user knows what happened
      const errMsg = isAbort
        ? 'Aborted.'
        : (err instanceof Error ? err.message : 'An unexpected error occurred.');
      // Mark any still-running step as error, then add an error message step
      setRuns(prev => prev.map(r => {
        if (r.id !== runId) return r;
        const steps = r.steps.map(s =>
          s.status === 'running' ? { ...s, status: 'error' as const, output: errMsg } : s
        );
        // If no step was running, append a dedicated error step
        const hasErrorStep = steps.some(s => s.status === 'error');
        const finalSteps = hasErrorStep ? steps : [
          ...steps,
          {
            id: uid(),
            label: isAbort ? 'Aborted' : 'Error',
            status: 'error' as const,
            output: errMsg,
          },
        ];
        // Build error detail summary from step statuses
        const completedSteps = finalSteps.filter(s => s.status === 'done' && !s.hidden);
        const failedSteps = finalSteps.filter(s => s.status === 'error');
        const parts: string[] = [];
        if (completedSteps.length > 0) parts.push(`${completedSteps.length} step${completedSteps.length !== 1 ? 's' : ''} completed`);
        if (failedSteps.length > 0) {
          const failNames = failedSteps.length <= 3
            ? ': ' + failedSteps.map(s => s.label).join(', ')
            : '';
          parts.push(`${failedSteps.length} step${failedSteps.length !== 1 ? 's' : ''} failed${failNames}`);
        }
        if (errMsg) parts.push(errMsg);
        return {
          ...r,
          status: 'error',
          steps: finalSteps,
          errorDetail: parts.join('\n'),
        };
      }));
    } finally {
      setActiveRunId(null);
      setIterCount(null);
      setRunStartedAt(null);
      // Force scroll to bottom on task completion so user sees result/error
      userScrolledRef.current = false;
      scrollToBottomNow();

      // Process pending queue — if items remain, keep isRoutingRef locked
      // to prevent a race where handleSendInstruction starts a parallel run.
      setPendingQueue(prev => {
        if (prev.length === 0) {
          // Nothing queued — fully unlock
          isRoutingRef.current = false;
          setIsRouting(false);
          return prev;
        }
        // Dequeue next — keep isRoutingRef=true so no duplicate runs start
        const [next, ...rest] = prev;
        const newRunId = uid();
        const newRun: AgentRun = {
          id: newRunId,
          userMessage: next,
          steps: [],
          status: 'running',
          createdAt: Date.now(),
        };
        setRuns(r => pruneRuns([...r, newRun]));
        Promise.resolve().then(() => executeRun(newRunId, next));
        return rest;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStep, addStep, updateRun, onComputerTask, scrollToBottom, pruneRuns]);

  // ── Restart ──

  const handleNewSession = useCallback(() => {
    // Abort any in-flight operation
    abortRef.current?.abort();
    abortRef.current = null;

    // Clear all step timeouts
    stepTimeoutMapRef.current.forEach(h => clearTimeout(h));
    stepTimeoutMapRef.current.clear();

    // Save current session activity to VFS before clearing
    if (runs.length > 0) {
      try {
        const sessionData = runs.map(r => ({
          id: r.id,
          userMessage: r.userMessage,
          status: r.status,
          createdAt: r.createdAt,
          finalAnswer: r.finalAnswer,
          errorDetail: r.errorDetail,
          steps: r.steps.map(s => ({
            id: s.id,
            label: s.label,
            status: s.status,
            output: s.output,
          })),
        }));
        vfs.saveActivity(computerId, computerId, `Session ended with ${runs.length} task(s)`, JSON.stringify(sessionData));
      } catch (e) {
        console.warn('[ActionSidebar] Failed to save session activity:', e);
      }
    }

    // Reset all state
    setRuns([]);
    setPendingQueue([]);
    setActiveRunId(null);
    isRoutingRef.current = false;
    setIsRouting(false);
    setIterCount(null);
    setShowNewActivity(false);
    setRunStartedAt(null);
    setRunLongRunning(false);
    userScrolledRef.current = false;
    setAskUserRequest(null);
    askUserResolveRef.current = null;
    setClarifyStepId(null);
    setViewingDoc(null);

    // Generate a new session/computer ID
    setComputerId(generateSessionId());

    // Flash "Session saved"
    setSessionSavedFlash(true);
    setTimeout(() => setSessionSavedFlash(false), 1500);
  }, [runs, computerId]);

  // ── Submit ──

  const handleSendInstruction = useCallback((overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;

    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    if (isRouting || isRoutingRef.current) {
      setPendingQueue(prev => [...prev, text]);
      return;
    }

    const runId = uid();
    const newRun: AgentRun = {
      id: runId,
      userMessage: text,
      steps: [],
      status: 'running',
      createdAt: Date.now(),
    };

    setRuns(prev => pruneRuns([...prev, newRun]));
    scrollToBottom();
    executeRun(runId, text);
  }, [input, isRouting, executeRun, scrollToBottom, pruneRuns]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 72) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInstruction();
    }
  };

  // ── Derived state ──

  const activeRun = activeRunId ? runs.find(r => r.id === activeRunId) : null;
  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const currentRun = activeRun || latestRun;
  const currentDone = currentRun ? currentRun.steps.filter(s => s.status === 'done').length : 0;
  const currentTotal = currentRun ? currentRun.steps.length : 0;

  // Current status text for computer preview
  const agentPhase = agentState?.phase ?? 'idle';
  const agentIsActive = agentPhase !== 'idle' && agentPhase !== 'done' && agentPhase !== 'error';
  const statusText = agentIsActive
    ? agentState!.message
    : isRouting && currentRun
      ? currentRun.steps.find(s => s.status === 'running')?.label || 'Working...'
      : 'Idle';

  // Show thinking dots when the agent is active but between steps (no step is actively running)
  // This is the "processing" gap — LLM is deciding the next action
  const hasRunningStep = currentRun?.steps.some(s => s.status === 'running') ?? false;
  const showThinkingDots = isRouting && !hasRunningStep;

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,20,0.88) 0%, rgba(10,12,18,0.92) 100%)',
          backdropFilter: 'blur(16px)',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.04)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Activity header + task progression ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* Compact activity header */}
          <button
            onClick={() => setIsTaskExpanded(e => !e)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px 7px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {isRouting && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'rgba(52,211,153,0.8)',
                    animation: '_nomad_pulse 1.2s ease-in-out infinite',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
              )}
              <span style={{
                fontSize: 11,
                color: isRouting ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {isRouting ? statusText : (runs.length > 0 ? `${runs.length} task${runs.length !== 1 ? 's' : ''}` : 'Activity')}
              </span>
              {/* Thinking dots: shown between iterations when agent is processing */}
              {showThinkingDots && <ThinkingDots />}
              {currentTotal > 0 && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {currentDone}/{currentTotal}
                </span>
              )}
              {/* Session ID badge */}
              <span
                title={computerId}
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  flexShrink: 0,
                  cursor: 'default',
                  letterSpacing: '0.5px',
                }}
              >
                {getSessionSuffix(computerId)}
              </span>
            </div>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{
                color: 'rgba(255,255,255,0.20)',
                transform: isTaskExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Task progression (collapsible) */}
          <AnimatePresence>
            {isTaskExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="relative flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)', minHeight: 0 }}>
                  {/* Agent status panel — shown when computer agent orchestrator is active */}
                  {agentState && agentState.phase !== 'idle' && (
                    <AgentStatusPanel state={agentState} iterCount={iterCount} />
                  )}

                  {/* Top fade */}
                  <div className="absolute top-0 left-0 right-0 h-3 pointer-events-none z-10"
                    style={{ background: 'linear-gradient(to bottom, rgba(12,14,20,0.8), transparent)' }}
                  />

                  <div
                    className="px-2 py-1"
                    ref={scrollRef}
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
                  >
                    {runs.length === 0 ? (
                      <div className="py-6" />
                    ) : (
                      <AnimatePresence>
                        {runs.map((run, runIdx) => (
                          <motion.div
                            key={run.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                          >
                            <RunBlock
                              run={run}
                              onDocClick={setViewingDoc}
                              isLatest={runIdx === runs.length - 1}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>

                  {/* Bottom fade */}
                  <div className="absolute bottom-0 left-0 right-0 h-3 pointer-events-none z-10"
                    style={{ background: 'linear-gradient(to top, rgba(12,14,20,0.8), transparent)' }}
                  />

                  {/* New activity pill */}
                  <AnimatePresence>
                    {showNewActivity && (
                      <motion.button
                        initial={{ opacity: 0, y: 4, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.92 }}
                        transition={{ duration: 0.15 }}
                        onClick={scrollToBottomNow}
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 20,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 12,
                          background: 'rgba(43,121,255,0.20)',
                          border: '1px solid rgba(43,121,255,0.35)',
                          color: 'rgba(43,121,255,0.90)',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          backdropFilter: 'blur(8px)',
                          whiteSpace: 'nowrap',
                        }}
                        aria-label="Scroll to latest activity"
                      >
                        <span>↓</span>
                        <span>New activity</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Input bar ── */}
        <div
          style={{
            padding: '12px 14px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isRouting ? 'Queue next task...' : 'Give Glance a task...'}
            data-role="instruction-input"
            aria-label="Send a message to the Glance agent"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 12,
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(255,255,255,0.08)',
              outline: 'none',
              resize: 'none',
              minHeight: 40,
              maxHeight: 72,
              lineHeight: 1.5,
              fontFamily: 'inherit',
              backdropFilter: 'blur(8px)',
              transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
              cursor: 'text',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />

          {/* Agent running hint */}
          {isRouting && (
            <div style={{
              marginTop: 5,
              fontSize: 9,
              color: 'rgba(255,255,255,0.28)',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}>
              Agent running — type to queue next task
            </div>
          )}

          {/* Queue badge */}
          {isRouting && pendingQueue.length > 0 && (
            <div style={{ marginTop: 6, marginBottom: -2 }}>
              <span
                style={{
                  fontSize: 9,
                  color: 'rgba(251,191,36,0.70)',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.15)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {pendingQueue.length} queued
              </span>
            </div>
          )}

          {/* Button row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            {/* Left buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {/* + (attach/new) */}
              <CircleButton title="Attach or start new task" aria-label="Attach file or start new task">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </CircleButton>

              {/* New Session button — saves current session then starts fresh */}
              <div style={runLongRunning && !sessionSavedFlash ? { animation: '_nomad_pulse 2s ease-in-out infinite' } : undefined}>
                <CircleButton
                  title="New session (saves current)"
                  aria-label="New session"
                  onClick={handleNewSession}
                  active={runLongRunning && !sessionSavedFlash}
                >
                  {sessionSavedFlash ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(52,211,153,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={runLongRunning ? 'rgba(251,191,36,0.85)' : 'currentColor'} strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </CircleButton>
              </div>
            </div>

            {/* Right buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Abort — always visible and clickable during loading */}
              {isRouting ? (
                <CircleButton
                  title="Abort current operation"
                  aria-label="Abort agent"
                  onClick={() => abortRef.current?.abort()}
                  active
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </CircleButton>
              ) : (
                /* Mic (placeholder, disabled when not running) */
                <CircleButton title="Voice input (coming soon)" aria-label="Voice input" disabled>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </CircleButton>
              )}

              {/* Send */}
              <CircleButton
                onClick={() => handleSendInstruction()}
                disabled={!input.trim()}
                active={!!input.trim()}
                title={isRouting ? 'Queue task' : 'Send message'}
                aria-label="Send message"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </CircleButton>
            </div>
          </div>
        </div>
      </div>

      {/* ── Document viewer modal ── */}
      <DocumentViewer document={viewingDoc} onClose={() => setViewingDoc(null)} />

      {/* ── Ask-user pause card — only for high-stakes (non-clarification) pauses ── */}
      <AnimatePresence>
        {askUserRequest && !askUserRequest.isClarification && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed',
              bottom: 80,
              right: 16,
              width: 280,
              zIndex: 200,
              background: 'rgba(18,20,30,0.96)',
              border: '1px solid rgba(251,191,36,0.28)',
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'rgba(251,191,36,0.80)',
                animation: '_nomad_pulse 1.2s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(251,191,36,0.80)', letterSpacing: '0.04em' }}>
                Agent paused
              </span>
              <button
                onClick={() => {
                  askUserResolveRef.current?.({ value: 'abort', label: 'Abort' });
                  askUserResolveRef.current = null;
                  setAskUserRequest(null);
                }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.30)', fontSize: 12, padding: 0, lineHeight: 1 }}
                aria-label="Dismiss and abort"
              >
                ×
              </button>
            </div>

            {/* Screenshot thumbnail */}
            {askUserRequest.screenshot && (
              <img
                src={`data:image/jpeg;base64,${askUserRequest.screenshot}`}
                alt="Current browser state"
                style={{
                  width: '100%',
                  maxHeight: 120,
                  objectFit: 'contain',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: 8,
                  display: 'block',
                }}
              />
            )}

            {/* Question */}
            <p style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.70)',
              lineHeight: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {askUserRequest.question}
            </p>

            {/* Context */}
            {askUserRequest.context && askUserRequest.context !== askUserRequest.question && (
              <p style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.4,
                margin: '5px 0 0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {askUserRequest.context}
              </p>
            )}

            {/* Response buttons */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {(askUserRequest.options && askUserRequest.options.length > 0
                ? askUserRequest.options
                : [{ label: 'Proceed', value: 'proceed' }, { label: 'Skip', value: 'skip' }, { label: 'Abort', value: 'abort' }]
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    askUserResolveRef.current?.({ value: opt.value, label: opt.label });
                    askUserResolveRef.current = null;
                    setAskUserRequest(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: opt.value === 'proceed'
                      ? '1px solid rgba(52,211,153,0.35)'
                      : opt.value === 'abort'
                        ? '1px solid rgba(239,68,68,0.30)'
                        : '1px solid rgba(255,255,255,0.12)',
                    background: opt.value === 'proceed'
                      ? 'rgba(52,211,153,0.12)'
                      : opt.value === 'abort'
                        ? 'rgba(239,68,68,0.08)'
                        : 'rgba(255,255,255,0.04)',
                    color: opt.value === 'proceed'
                      ? 'rgba(52,211,153,0.90)'
                      : opt.value === 'abort'
                        ? 'rgba(239,68,68,0.85)'
                        : 'rgba(255,255,255,0.60)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
