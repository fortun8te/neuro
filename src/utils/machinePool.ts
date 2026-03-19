/**
 * MachinePool — Types, mock data, and state management for multi-computer UI.
 *
 * Provides a simple interface for managing multiple sandbox machines.
 * Currently uses mock data; designed to be easily wired to real MachinePool later.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Types ──

export type MachineStatus = 'running' | 'idle' | 'error' | 'connecting';

export interface MachineInfo {
  id: string;
  label: string;
  status: MachineStatus;
  currentUrl: string;
  currentTitle: string;
  /** VNC websocket URL for live viewer */
  vncUrl: string;
  /** Sandbox API base URL */
  apiUrl: string;
  /** Last screenshot as base64 data URL (for thumbnails) */
  thumbnail: string | null;
  /** Agent status text, e.g. "Step 3: clicking button" */
  agentStatus: string | null;
}

// ── Mock Data ──

const DEFAULT_MACHINES: MachineInfo[] = [
  {
    id: 'machine-1',
    label: 'Computer 1',
    status: 'idle',
    currentUrl: '',
    currentTitle: '',
    vncUrl: 'ws://localhost:5901',
    apiUrl: 'http://localhost:8080',
    thumbnail: null,
    agentStatus: null,
  },
];

// ── Hook ──

export type ComputerViewMode = 'single' | 'split' | 'mission-control';

export interface UseMachinePoolReturn {
  machines: MachineInfo[];
  activeMachineId: string;
  secondaryMachineId: string | null;
  viewMode: ComputerViewMode;
  sidebarExpanded: boolean;
  setActiveMachine: (id: string) => void;
  setSecondaryMachine: (id: string | null) => void;
  setViewMode: (mode: ComputerViewMode) => void;
  setSidebarExpanded: (expanded: boolean) => void;
  addMachine: () => void;
  removeMachine: (id: string) => void;
  updateMachine: (id: string, patch: Partial<MachineInfo>) => void;
  getActiveMachine: () => MachineInfo;
  getSecondaryMachine: () => MachineInfo | null;
}

export function useMachinePool(): UseMachinePoolReturn {
  const [machines, setMachines] = useState<MachineInfo[]>(DEFAULT_MACHINES);
  const [activeMachineId, setActiveMachineId] = useState(DEFAULT_MACHINES[0].id);
  const [secondaryMachineId, setSecondaryMachineId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ComputerViewMode>('single');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const nextIdRef = useRef(DEFAULT_MACHINES.length + 1);

  const setActiveMachine = useCallback((id: string) => {
    setActiveMachineId(id);
  }, []);

  const setSecondaryMachine = useCallback((id: string | null) => {
    setSecondaryMachineId(id);
  }, []);

  const addMachine = useCallback(() => {
    const n = nextIdRef.current++;
    const newMachine: MachineInfo = {
      id: `machine-${n}`,
      label: `Computer ${n}`,
      status: 'idle',
      currentUrl: '',
      currentTitle: '',
      vncUrl: `ws://localhost:${5900 + n}`,
      apiUrl: `http://localhost:${8079 + n}`,
      thumbnail: null,
      agentStatus: null,
    };
    setMachines(prev => [...prev, newMachine]);
  }, []);

  const removeMachine = useCallback((id: string) => {
    setMachines(prev => prev.filter(m => m.id !== id));
    setActiveMachineId(prev => prev === id ? DEFAULT_MACHINES[0].id : prev);
  }, []);

  const updateMachine = useCallback((id: string, patch: Partial<MachineInfo>) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const getActiveMachine = useCallback(() => {
    return machines.find(m => m.id === activeMachineId) || machines[0];
  }, [machines, activeMachineId]);

  const getSecondaryMachine = useCallback(() => {
    if (!secondaryMachineId) return null;
    return machines.find(m => m.id === secondaryMachineId) || null;
  }, [machines, secondaryMachineId]);

  // Auto-set secondary when entering split mode
  useEffect(() => {
    if (viewMode === 'split' && !secondaryMachineId) {
      const other = machines.find(m => m.id !== activeMachineId);
      if (other) setSecondaryMachineId(other.id);
    }
    if (viewMode !== 'split') {
      setSecondaryMachineId(null);
    }
  }, [viewMode, activeMachineId, machines, secondaryMachineId]);

  return {
    machines,
    activeMachineId,
    secondaryMachineId,
    viewMode,
    sidebarExpanded,
    setActiveMachine,
    setSecondaryMachine,
    setViewMode,
    setSidebarExpanded,
    addMachine,
    removeMachine,
    updateMachine,
    getActiveMachine,
    getSecondaryMachine,
  };
}

// ── Status color helpers ──

export function statusColor(status: MachineStatus): string {
  switch (status) {
    case 'running': return '#10b981';
    case 'idle': return 'rgba(255,255,255,0.25)';
    case 'error': return '#ef4444';
    case 'connecting': return '#2B79FF';
  }
}

export function statusLabel(status: MachineStatus): string {
  switch (status) {
    case 'running': return 'Running';
    case 'idle': return 'Idle';
    case 'error': return 'Error';
    case 'connecting': return 'Connecting';
  }
}
