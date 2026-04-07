/**
 * PermissionModeDropdown — Two-state toggle: Auto vs Plan
 * Clean pill toggle, no dropdown. Auto = run everything, Plan = review first.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import { getPermissionMode, setPermissionMode } from '../utils/permissionMode';
import type { PermissionMode } from '../utils/harness/types';

interface PermissionModeDropdownProps {
  onModeChange?: (mode: PermissionMode) => void;
}

export function PermissionModeDropdown({ onModeChange }: PermissionModeDropdownProps) {
  const { isDarkMode } = useTheme();
  const [mode, setMode] = useState<PermissionMode>(() => getPermissionMode());

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setMode(customEvent.detail.mode);
    };
    window.addEventListener('neuro-permission-mode-changed', handler);
    return () => window.removeEventListener('neuro-permission-mode-changed', handler);
  }, []);

  const toggle = () => {
    const next: PermissionMode = mode === 'bypass' ? 'plan' : 'bypass';
    setMode(next);
    setPermissionMode(next);
    onModeChange?.(next);
  };

  const isPlan = mode === 'plan';

  const bg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const border = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const activeBg = isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)';
  const activeBorder = 'rgba(59,130,246,0.35)';
  const textColor = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const activeText = isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';

  return (
    <button
      onClick={toggle}
      title={isPlan ? 'Plan mode: will generate a plan and wait for approval before executing' : 'Auto mode: runs all tools automatically'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 7,
        border: `1px solid ${isPlan ? activeBorder : border}`,
        background: isPlan ? activeBg : bg,
        cursor: 'pointer',
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        fontWeight: 600,
        color: isPlan ? activeText : textColor,
        transition: 'all 0.15s ease',
        letterSpacing: '0.01em',
      }}
    >
      {isPlan ? (
        /* Plan icon — checklist */
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <polyline points="3 6 4 7 6 5" />
          <polyline points="3 12 4 13 6 11" />
          <polyline points="3 18 4 19 6 17" />
        </svg>
      ) : (
        /* Auto icon — lightning */
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )}
      {isPlan ? 'Plan' : 'Auto'}
    </button>
  );
}
