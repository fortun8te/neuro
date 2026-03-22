/**
 * ComputerViewSimplified — Manus-style side-by-side layout
 *
 * Layout:
 * - Top: full-width tab bar (machine tabs, +, Take Control, restart)
 * - Left (35%): chat/activity panel (ActionSidebarCompact)
 * - Right (65%): computer desktop (ComputerDesktop)
 * - Bottom: progress bar (step description, count, elapsed)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ActionSidebarCompact } from './ActionSidebarCompact';
import { ComputerDesktop } from './ComputerDesktop';
import { ErrorBoundary } from './ErrorBoundary';
import { EtherealBG } from './EtherealBG';
import { desktopBus } from '../utils/desktopBus';
import { checkInfrastructure, type InfrastructureHealth } from '../config/infrastructure';
import type { AgentState } from './ActionSidebarCompact';
import { vfs, vfsReady, generateSessionId, getSessionSuffix } from '../utils/sessionFileSystem';

// Fixed 3-slot palette: blue, silver, grey
const MACHINE_ACCENTS = [
  {
    hex: '#2B79FF',
    glow: 'rgba(43,121,255,0.14)',
    dim:  'rgba(43,121,255,0.06)',
    screenBg: 'linear-gradient(145deg, rgba(8,12,28,0.97) 0%, rgba(6,14,30,0.97) 50%, rgba(8,12,24,0.97) 100%)',
    gradientColors: ['#000000', '#030308', '#060e1a', '#091828', '#1a4fcc'],
  },
  {
    hex: '#D0D0D0',
    glow: 'rgba(210,210,210,0.10)',
    dim:  'rgba(210,210,210,0.04)',
    screenBg: 'linear-gradient(145deg, rgba(11,11,13,0.97) 0%, rgba(10,10,12,0.97) 50%, rgba(11,11,13,0.97) 100%)',
    gradientColors: ['#000000', '#060608', '#0c0c10', '#101014', '#1c1c22'],
  },
  {
    hex: '#888888',
    glow: 'rgba(140,140,140,0.10)',
    dim:  'rgba(140,140,140,0.04)',
    screenBg: 'linear-gradient(145deg, rgba(10,10,10,0.98) 0%, rgba(8,8,8,0.98) 50%, rgba(10,10,10,0.98) 100%)',
    gradientColors: ['#000000', '#040404', '#080808', '#0d0d0d', '#1a1a1a'],
  },
];
const MAX_MACHINES = 3;

interface Machine {
  id: string;
  label: string;
  accentIdx: number;
}

// ── Tiny health dots with hover tooltip ──
function HealthDotsRow({ health }: { health: InfrastructureHealth }) {
  const [hovered, setHovered] = useState(false);
  const dotColor = (ok: boolean | null) => ok === null ? 'rgba(255,255,255,0.25)' : ok ? '#22c55e' : '#ef4444';
  const checkMark = (ok: boolean | null) => ok ? '\u2713' : '\u2717';
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(health.ollama), flexShrink: 0 }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(health.wayfarer), flexShrink: 0 }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(health.searxng), flexShrink: 0 }} />
      </div>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'rgba(10,10,14,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            fontSize: 10,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.65)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          Ollama {checkMark(health.ollama)} &nbsp;|&nbsp; Browser {checkMark(health.wayfarer)} &nbsp;|&nbsp; Search {checkMark(health.searxng)}
        </div>
      )}
    </div>
  );
}

// ── Elapsed time formatter ──
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ComputerViewSimplified() {
  const [initialId] = useState(() => generateSessionId());
  const [machines, setMachines] = useState<Machine[]>(() => [
    { id: initialId, label: `Computer ${getSessionSuffix(initialId)}`, accentIdx: 0 },
  ]);
  const [activeMachineId, setActiveMachineId] = useState(initialId);
  const [agentState, setAgentState] = useState<AgentState>({ phase: 'idle', message: '', steps: [] });
  const [humanControl, setHumanControl] = useState(false);

  // ── Initialize VFS session + computer so Finder has content ──
  useEffect(() => {
    vfsReady().then(() => {
      vfs.initSession(initialId);
      vfs.initComputer(initialId, initialId);
    });
  }, [initialId]);

  // ── Elapsed timer ──
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isActive = agentState.phase !== 'idle' && agentState.phase !== 'done' && agentState.phase !== 'error';
    if (isActive) {
      if (!elapsedRef.current) {
        elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      }
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [agentState.phase]);

  // Reset elapsed when starting new task
  useEffect(() => {
    if (agentState.phase === 'planning') {
      setElapsed(0);
    }
  }, [agentState.phase]);

  // ── Infrastructure health polling ──
  const [health, setHealth] = useState<InfrastructureHealth | null>(null);
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    checkInfrastructure().then(setHealth).catch(() => {});
    healthIntervalRef.current = setInterval(() => {
      checkInfrastructure().then(setHealth).catch(() => {});
    }, 30_000);
    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
    };
  }, []);

  // Subscribe to computer agent orchestrator events via desktopBus
  useEffect(() => {
    return desktopBus.subscribe((event) => {
      if (event.type === 'agent_status') {
        setAgentState(prev => ({
          ...prev,
          phase: event.phase,
          message: event.message,
          stepIndex: event.stepIndex,
          totalSteps: event.totalSteps,
        }));
      } else if (event.type === 'agent_plan') {
        setAgentState(prev => ({
          ...prev,
          plan: event.steps,
          steps: event.steps.map(s => ({ instruction: s.instruction, highStakes: s.highStakes, status: 'pending' as const })),
        }));
      } else if (event.type === 'agent_step_start') {
        setAgentState(prev => ({
          ...prev,
          steps: prev.steps.map((s, i) => i === event.stepIndex ? { ...s, status: 'running' as const } : s),
        }));
      } else if (event.type === 'agent_step_done') {
        setAgentState(prev => ({
          ...prev,
          steps: prev.steps.map((s, i) =>
            i === event.stepIndex
              ? { ...s, status: event.success ? ('done' as const) : ('failed' as const), result: event.result }
              : s
          ),
        }));
      }
    });
  }, []);

  const addMachine = useCallback(() => {
    if (machines.length >= MAX_MACHINES) return;
    const newId = generateSessionId();
    const newLabel = `Computer ${getSessionSuffix(newId)}`;
    const accentIdx = machines.length;
    setMachines(prev => [...prev, { id: newId, label: newLabel, accentIdx }]);
    setActiveMachineId(newId);
    // Initialize VFS for the new machine
    vfs.initSession(newId);
    vfs.initComputer(newId, newId);
  }, [machines.length]);

  const removeMachine = useCallback((id: string) => {
    if (machines.length === 1) return;
    setMachines(prev => {
      const next = prev.filter(m => m.id !== id);
      if (activeMachineId === id) setActiveMachineId(next[0].id);
      return next;
    });
  }, [activeMachineId, machines]);

  const activeMachine = machines.find(m => m.id === activeMachineId);
  const accent = MACHINE_ACCENTS[activeMachine?.accentIdx ?? 0];

  // ── Derived progress data ──
  const isAgentActive = agentState.phase !== 'idle' && agentState.phase !== 'done' && agentState.phase !== 'error';
  const runningStepIdx = agentState.steps.findIndex(s => s.status === 'running');
  const currentStepIndex = agentState.stepIndex ?? (runningStepIdx >= 0 ? runningStepIdx : 0);
  const totalSteps = agentState.totalSteps ?? agentState.steps.length;
  const currentStepDescription = isAgentActive
    ? (agentState.message || (runningStepIdx >= 0 ? agentState.steps[runningStepIdx].instruction : 'Working...'))
    : agentState.phase === 'done'
      ? 'Task completed'
      : agentState.phase === 'error'
        ? 'Task failed'
        : 'Ready';

  return (
    <div className="h-full flex flex-col bg-black relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <EtherealBG color={accent.dim} />
      </div>

      {/* Content */}
      <div className="relative flex flex-col h-full z-10">

        {/* ── Top: full-width tab bar (36px) ── */}
        <div
          style={{
            height: 36,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            background: 'rgba(10,10,14,0.90)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}
        >
          {/* Machine tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            {machines.map((machine) => {
              const a = MACHINE_ACCENTS[machine.accentIdx];
              const isActive = activeMachineId === machine.id;
              return (
                <motion.div
                  key={machine.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1"
                >
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: a.hex,
                    opacity: isActive ? 1 : 0.35,
                    flexShrink: 0,
                  }} />
                  <button
                    onClick={() => setActiveMachineId(machine.id)}
                    className="text-[10px] font-medium rounded-lg px-1.5 py-0.5"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: isActive ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)',
                      transition: 'all 0.15s ease',
                    }}
                    title={`Switch to ${machine.label}`}
                    aria-label={`Switch to ${machine.label}${isActive ? ' (currently active)' : ''}`}
                    data-role="machine-tab"
                    data-machine-id={machine.id}
                    aria-selected={isActive}
                  >
                    {machine.label}
                  </button>
                  {machines.length > 1 && (
                    <button
                      onClick={() => removeMachine(machine.id)}
                      className="p-0.5"
                      style={{ color: 'rgba(255,255,255,0.18)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
                      title={`Remove ${machine.label}`}
                      aria-label={`Remove ${machine.label}`}
                      data-role="machine-tab-close"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6l-12 12M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </motion.div>
              );
            })}
            {machines.length < MAX_MACHINES && (
              <button
                onClick={addMachine}
                title="Add computer"
                className="p-1 rounded-lg"
                style={{ color: 'rgba(255,255,255,0.25)', transition: 'all 0.15s ease' }}
                onMouseEnter={e => { (e.currentTarget.style.color = 'rgba(255,255,255,0.50)'); (e.currentTarget.style.background = 'rgba(255,255,255,0.05)'); }}
                onMouseLeave={e => { (e.currentTarget.style.color = 'rgba(255,255,255,0.25)'); (e.currentTarget.style.background = 'transparent'); }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>

          {/* Right side: health dots + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {health && <HealthDotsRow health={health} />}

            {/* Divider */}
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />

            {/* Take Control / Release button */}
            <button
              onClick={() => setHumanControl(prev => !prev)}
              title={humanControl ? 'Release control back to AI' : 'Take manual control of the desktop'}
              style={{
                padding: '2px 7px',
                borderRadius: 5,
                fontSize: 9,
                fontWeight: 600,
                cursor: 'pointer',
                lineHeight: '14px',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                border: humanControl
                  ? '1px solid rgba(251,191,36,0.30)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: humanControl
                  ? 'rgba(251,191,36,0.10)'
                  : 'rgba(255,255,255,0.03)',
                color: humanControl
                  ? 'rgba(251,191,36,0.85)'
                  : 'rgba(255,255,255,0.30)',
              }}
            >
              {humanControl ? 'Release' : 'Take Control'}
            </button>

            {/* Restart Wayfarer */}
            <button
              onClick={async () => {
                try {
                  await fetch('http://localhost:8889/reset', { method: 'POST' });
                } catch { /* server might restart */ }
              }}
              title="Restart browser (closes all sessions)"
              style={{
                padding: '2px 6px',
                borderRadius: 5,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                color: 'rgba(239,68,68,0.55)',
                fontSize: 9,
                fontWeight: 600,
                cursor: 'pointer',
                lineHeight: '14px',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = 'rgba(239,68,68,0.85)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'rgba(239,68,68,0.55)'; }}
            >
              restart
            </button>
          </div>
        </div>

        {/* ── Middle: Computer fills screen, sidebar floats on right ── */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: accent.screenBg }}>
          {/* Computer Desktop — fills entire area */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              width: '100%', height: '100%',
              pointerEvents: humanControl ? 'auto' : undefined,
            }}
          >
            {/* Health dots — tiny top-right overlay */}
            {health && (
              <div style={{ position: 'absolute', top: 8, right: 360, zIndex: 30 }}>
                <HealthDotsRow health={health} />
              </div>
            )}
            {activeMachine && (
              <ComputerDesktop />
            )}
          </div>

          {/* Activity sidebar — floats on right, top-aligned */}
          <div
            style={{
              position: 'absolute', top: 8, right: 8, bottom: 48,
              width: 340,
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <ErrorBoundary>
              <ActionSidebarCompact
                machineId={activeMachine?.id || 'machine-1'}
                onComputerTask={(goal) => {
                  setAgentState({ phase: 'planning', message: 'Planning...', steps: [] });
                  desktopBus.emit({ type: 'run_goal', goal });
                }}
                agentState={agentState}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* ── Bottom: progress bar (40px) ── */}
        <div
          style={{
            height: 40,
            background: 'rgba(10,10,14,0.85)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Progress dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isAgentActive
                ? '#3b82f6'
                : agentState.phase === 'done'
                  ? 'rgba(52,211,153,0.70)'
                  : agentState.phase === 'error'
                    ? 'rgba(239,68,68,0.70)'
                    : 'rgba(255,255,255,0.15)',
              flexShrink: 0,
              ...(isAgentActive ? { animation: '_nomad_pulse 2s infinite' } : {}),
            }}
          />

          {/* Step description */}
          <span
            style={{
              fontSize: 11,
              color: isAgentActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentStepDescription}
          </span>

          {/* Step count */}
          {totalSteps > 0 && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.30)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {currentStepIndex + 1} / {totalSteps}
            </span>
          )}

          {/* Elapsed */}
          {isAgentActive && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.30)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
