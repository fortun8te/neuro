/**
 * MultiComputerUI — Machine selector, split view, mission control.
 *
 * Sub-components:
 *  - MachineStatusBar: top pill bar showing all machines
 *  - MachineSidebar: vertical left strip with machine cards
 *  - MissionControl: grid of machine thumbnails
 *  - SplitView: two machines side-by-side with draggable divider
 *  - MultiComputerShell: wraps everything together
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VNCViewer } from './VNCViewer';
import { LiquidGlass } from './LiquidGlass';
import {
  type MachineInfo,
  type MachineStatus,
  type ComputerViewMode,
  type UseMachinePoolReturn,
  statusColor,
  statusLabel,
} from '../utils/machinePool';

// ════════════════════════════════════════════════
// STATUS DOT
// ════════════════════════════════════════════════

function StatusDot({ status, size = 6 }: { status: MachineStatus; size?: number }) {
  const color = statusColor(status);
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: status === 'running' ? `0 0 6px ${color}` : undefined,
      }}
    />
  );
}

// ════════════════════════════════════════════════
// MACHINE STATUS BAR (top pills)
// ════════════════════════════════════════════════

export function MachineStatusBar({
  machines,
  activeMachineId,
  onSelect,
}: {
  machines: MachineInfo[];
  activeMachineId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto">
      {machines.map(m => {
        const active = m.id === activeMachineId;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 transition-all cursor-pointer"
            style={{
              background: active ? 'rgba(43,121,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? 'rgba(43,121,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
            }}
          >
            <StatusDot status={m.status} size={5} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════
// MACHINE SIDEBAR (left strip)
// ════════════════════════════════════════════════

export function MachineSidebar({
  machines,
  activeMachineId,
  expanded,
  onSelect,
  onToggle,
  onAdd,
}: {
  machines: MachineInfo[];
  activeMachineId: string;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <motion.div
      className="shrink-0 flex flex-col h-full nomad-glass-subtle overflow-hidden"
      initial={false}
      animate={{ width: expanded ? 200 : 60 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {expanded && (
          <span className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Machines
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {expanded
              ? <><path d="M11 19l-7-7 7-7" /><path d="M18 19V5" /></>
              : <><path d="M13 5l7 7-7 7" /><path d="M6 5v14" /></>
            }
          </svg>
        </button>
      </div>

      {/* Machine list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
        {machines.map(m => {
          const active = m.id === activeMachineId;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="w-full rounded-lg transition-all cursor-pointer"
              style={{
                padding: expanded ? '8px 10px' : '8px 4px',
                background: active ? 'rgba(43,121,255,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(43,121,255,0.2)' : 'transparent'}`,
              }}
            >
              {expanded ? (
                <div className="flex items-center gap-2.5">
                  {/* Thumbnail placeholder */}
                  <div className="w-10 h-7 rounded shrink-0 flex items-center justify-center" style={{
                    background: m.thumbnail ? undefined : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}>
                    {m.thumbnail ? (
                      <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={m.status} />
                      <span className="text-[10px] font-medium truncate" style={{
                        color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
                      }}>
                        {m.label}
                      </span>
                    </div>
                    {m.currentUrl && (
                      <p className="text-[8px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {(() => { try { return new URL(m.currentUrl).hostname; } catch { return m.currentUrl; } })()}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  {/* Collapsed: just icon + status dot */}
                  <div className="relative">
                    <div className="w-9 h-6 rounded flex items-center justify-center" style={{
                      background: m.thumbnail ? undefined : 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      overflow: 'hidden',
                    }}>
                      {m.thumbnail ? (
                        <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <StatusDot status={m.status} size={4} />
                    </span>
                  </div>
                  <span className="text-[7px] font-medium" style={{ color: active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)' }}>
                    {m.label.replace('Computer ', '#')}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Add machine button */}
      <div className="shrink-0 px-1.5 pb-2">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-colors cursor-pointer hover:bg-white/5"
          style={{
            border: '1px dashed rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {expanded && <span className="text-[9px] font-medium">Add Machine</span>}
        </button>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════
// MISSION CONTROL (grid of thumbnails)
// ════════════════════════════════════════════════

export function MissionControl({
  machines,
  activeMachineId,
  onSelect,
}: {
  machines: MachineInfo[];
  activeMachineId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid gap-3" style={{
        gridTemplateColumns: machines.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
      }}>
        {machines.map(m => {
          const active = m.id === activeMachineId;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="rounded-xl overflow-hidden text-left transition-all cursor-pointer group nomad-glass-subtle"
              style={{
                border: `1px solid ${active ? 'rgba(43,121,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                boxShadow: active ? '0 0 20px rgba(43,121,255,0.1)' : undefined,
              }}
            >
              {/* Thumbnail area */}
              <div className="relative aspect-video flex items-center justify-center" style={{
                background: '#0a0a0c',
              }}>
                {m.thumbnail ? (
                  <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.1)' }}>
                      {m.status === 'idle' ? 'No preview' : statusLabel(m.status)}
                    </span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <span className="text-[10px] font-medium px-3 py-1 rounded-full" style={{
                    background: 'rgba(43,121,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(43,121,255,0.3)',
                  }}>
                    Open
                  </span>
                </div>
              </div>

              {/* Info bar */}
              <div className="px-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={m.status} />
                  <span className="text-[10px] font-medium flex-1 truncate" style={{
                    color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
                  }}>
                    {m.label}
                  </span>
                </div>
                {m.currentUrl && (
                  <p className="text-[8px] truncate" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {m.currentUrl}
                  </p>
                )}
                {m.agentStatus && (
                  <p className="text-[8px] truncate" style={{ color: 'rgba(43,121,255,0.6)' }}>
                    {m.agentStatus}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// SPLIT VIEW (two machines side by side)
// ════════════════════════════════════════════════

export function SplitView({
  primary,
  secondary,
  activePaneId,
  onSelectPane,
}: {
  primary: MachineInfo;
  secondary: MachineInfo;
  activePaneId: string;
  onSelectPane: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0.25, Math.min(0.75, (ev.clientX - rect.left) / rect.width));
      setSplitRatio(ratio);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const renderPane = (machine: MachineInfo, isActive: boolean, widthPct: string) => (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        width: widthPct,
        border: isActive ? '2px solid rgba(43,121,255,0.4)' : '2px solid transparent',
        borderRadius: 8,
        transition: 'border-color 0.15s',
      }}
      onClick={() => onSelectPane(machine.id)}
    >
      {/* Pane header */}
      <LiquidGlass intensity="subtle" className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderRadius: 0 }}>
        <StatusDot status={machine.status} />
        <span className="text-[10px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {machine.label}
        </span>
        {machine.currentUrl && (
          <span className="text-[8px] truncate flex-1 text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {(() => { try { return new URL(machine.currentUrl).hostname; } catch { return ''; } })()}
          </span>
        )}
      </LiquidGlass>
      {/* VNC area */}
      <div className="flex-1 relative" style={{ background: '#0a0a0b' }}>
        {machine.status === 'running' ? (
          <VNCViewer
            wsUrl={machine.vncUrl}
            viewOnly={!isActive}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <StatusDot status={machine.status} size={8} />
              <p className="text-[9px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {statusLabel(machine.status)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="flex-1 flex h-full relative">
      {renderPane(primary, activePaneId === primary.id, `${splitRatio * 100}%`)}

      {/* Draggable divider */}
      <div
        className="relative shrink-0 cursor-col-resize group"
        style={{ width: 8 }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] rounded-full transition-colors"
          style={{
            background: draggingRef.current ? 'rgba(43,121,255,0.5)' : 'rgba(255,255,255,0.08)',
          }}
        />
        {/* Handle grip dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      </div>

      {renderPane(secondary, activePaneId === secondary.id, `${(1 - splitRatio) * 100}%`)}
    </div>
  );
}

// ════════════════════════════════════════════════
// VIEW MODE TOGGLE
// ════════════════════════════════════════════════

export function ViewModeToggle({
  viewMode,
  onChange,
  machineCount,
}: {
  viewMode: ComputerViewMode;
  onChange: (mode: ComputerViewMode) => void;
  machineCount: number;
}) {
  const modes: Array<{ key: ComputerViewMode; label: string; icon: React.ReactNode }> = [
    {
      key: 'single',
      label: 'Single',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      ),
    },
    {
      key: 'split',
      label: 'Split',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      key: 'mission-control',
      label: 'Grid',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {modes.map(m => {
        const active = viewMode === m.key;
        const disabled = m.key === 'split' && machineCount < 2;
        return (
          <button
            key={m.key}
            onClick={() => !disabled && onChange(m.key)}
            disabled={disabled}
            title={m.label}
            className="p-1.5 rounded-md transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
            style={{
              background: active ? 'rgba(43,121,255,0.15)' : 'transparent',
              color: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
            }}
          >
            {m.icon}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════
// MULTI-COMPUTER SHELL (combines everything)
// ════════════════════════════════════════════════

export function MultiComputerShell({
  pool,
  children,
}: {
  pool: UseMachinePoolReturn;
  /** Render function for the single-machine VNC panel. Receives the active machine. */
  children: (machine: MachineInfo) => React.ReactNode;
}) {
  const {
    machines,
    activeMachineId,
    secondaryMachineId,
    viewMode,
    sidebarExpanded,
    setActiveMachine,
    setViewMode,
    setSidebarExpanded,
    addMachine,
    getActiveMachine,
    getSecondaryMachine,
  } = pool;

  const activeMachine = getActiveMachine();
  const secondaryMachine = getSecondaryMachine();

  // Single machine mode: no sidebar, no top bar, just pass through
  if (machines.length <= 1) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {children(activeMachine)}
      </div>
    );
  }

  // Multi-machine mode: show sidebar + top bar + view controls
  // Mission control: click tile -> switch to single + focus that machine
  const handleMissionSelect = (id: string) => {
    setActiveMachine(id);
    setViewMode('single');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar: status pills + view mode toggle */}
      <LiquidGlass intensity="subtle" className="shrink-0 flex items-center justify-between" style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        paddingRight: 12,
      }}>
        <MachineStatusBar
          machines={machines}
          activeMachineId={activeMachineId}
          onSelect={(id) => {
            setActiveMachine(id);
            if (viewMode === 'mission-control') setViewMode('single');
          }}
        />
        <ViewModeToggle
          viewMode={viewMode}
          onChange={setViewMode}
          machineCount={machines.length}
        />
      </LiquidGlass>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Machine sidebar */}
        <MachineSidebar
          machines={machines}
          activeMachineId={activeMachineId}
          expanded={sidebarExpanded}
          onSelect={(id) => {
            setActiveMachine(id);
            if (viewMode === 'mission-control') setViewMode('single');
          }}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onAdd={addMachine}
        />

        {/* Content area based on view mode */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {viewMode === 'mission-control' ? (
              <motion.div
                key="mission"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 overflow-hidden"
              >
                <MissionControl
                  machines={machines}
                  activeMachineId={activeMachineId}
                  onSelect={handleMissionSelect}
                />
              </motion.div>
            ) : viewMode === 'split' && secondaryMachine ? (
              <motion.div
                key="split"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 overflow-hidden"
              >
                <SplitView
                  primary={activeMachine}
                  secondary={secondaryMachine}
                  activePaneId={activeMachineId}
                  onSelectPane={setActiveMachine}
                />
              </motion.div>
            ) : (
              <motion.div
                key="single"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 flex flex-col overflow-hidden min-h-0"
              >
                {children(activeMachine)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
