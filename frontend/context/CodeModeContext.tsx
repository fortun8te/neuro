/**
 * CodeModeContext — Manages Code Mode state and permission levels
 *
 * Persists to localStorage and syncs with the harness permission system.
 * Exposes 3 permission levels: bypass, strict, plan (not default).
 * Uses quota-aware storage with LRU eviction.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setPermissionMode } from '../utils/permissionMode';
import { setItemWithQuotaHandling, getItemWithTracking, markKeyAsCritical } from '../utils/localStorageManager';

// Mark code mode keys as critical
markKeyAsCritical('neuro_code_mode');
markKeyAsCritical('neuro_code_permission');

// ── Types ─────────────────────────────────────────────────────────────────

export type CodePermission = 'bypass' | 'plan';

interface CodeModeState {
  isCodeMode: boolean;
  permissionLevel: CodePermission;
  activeFiles: string[];
  setCodeMode: (active: boolean) => void;
  setPermissionLevel: (level: CodePermission) => void;
  addActiveFile: (path: string) => void;
  clearActiveFiles: () => void;
}

// ── Storage Keys ──────────────────────────────────────────────────────────

const CODE_MODE_KEY = 'neuro_code_mode';
const CODE_PERMISSION_KEY = 'neuro_code_permission';

// ── Helpers ───────────────────────────────────────────────────────────────

function readCodeMode(): boolean {
  try {
    return localStorage.getItem(CODE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readPermissionLevel(): CodePermission {
  try {
    const stored = localStorage.getItem(CODE_PERMISSION_KEY);
    if (stored === 'bypass' || stored === 'plan') {
      return stored;
    }
  } catch { /* ignore */ }
  return 'bypass';
}

// ── Context ───────────────────────────────────────────────────────────────

const CodeModeContext = createContext<CodeModeState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────

export function CodeModeProvider({ children }: { children: React.ReactNode }) {
  const [isCodeMode, setIsCodeMode] = useState<boolean>(readCodeMode);
  const [permissionLevel, setPermissionLevelState] = useState<CodePermission>(readPermissionLevel);
  const [activeFiles, setActiveFiles] = useState<string[]>([]);

  // Sync permission level with harness when code mode changes
  useEffect(() => {
    if (isCodeMode) {
      setPermissionMode(permissionLevel);
    }
  }, [isCodeMode, permissionLevel]);

  const dispatchModeSwitch = useCallback((from: string, to: string, label?: string) => {
    window.dispatchEvent(new CustomEvent('neuro:mode-switched', { detail: { from, to, label } }));
  }, []);

  const setCodeMode = useCallback((active: boolean) => {
    const prev = isCodeMode;
    setIsCodeMode(active);
    try {
      setItemWithQuotaHandling(CODE_MODE_KEY, String(active));
    } catch { /* ignore */ }

    if (active) {
      setPermissionMode(permissionLevel);
      if (!prev) dispatchModeSwitch('general', `code · ${permissionLevel}`);
    } else {
      setPermissionMode('bypass');
      if (prev) dispatchModeSwitch('code', 'general');
    }
  }, [permissionLevel, isCodeMode, dispatchModeSwitch]);

  const setPermissionLevel = useCallback((level: CodePermission) => {
    setPermissionLevelState(level);
    try {
      setItemWithQuotaHandling(CODE_PERMISSION_KEY, level);
    } catch { /* ignore */ }
    if (isCodeMode) {
      setPermissionMode(level);
      dispatchModeSwitch(permissionLevel, level);
    }
  }, [isCodeMode, permissionLevel, dispatchModeSwitch]);

  const addActiveFile = useCallback((path: string) => {
    setActiveFiles(prev => prev.includes(path) ? prev : [...prev, path]);
  }, []);

  const clearActiveFiles = useCallback(() => {
    setActiveFiles([]);
  }, []);

  return (
    <CodeModeContext.Provider value={{
      isCodeMode,
      permissionLevel,
      activeFiles,
      setCodeMode,
      setPermissionLevel,
      addActiveFile,
      clearActiveFiles,
    }}>
      {children}
    </CodeModeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useCodeMode(): CodeModeState {
  const ctx = useContext(CodeModeContext);
  if (!ctx) {
    throw new Error('useCodeMode must be used inside <CodeModeProvider>');
  }
  return ctx;
}
