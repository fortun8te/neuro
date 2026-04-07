/**
 * ModeIndicator — Shows current execution mode (General, Research, Code)
 * Displayed in top bar for real-time feedback
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { eventBus } from '../utils/eventBus';
import { FONT_FAMILY } from '../constants/ui';

type ExecutionMode = 'general' | 'research' | 'code' | 'idle';

interface ModeIndicatorProps {
  compact?: boolean; // Show as icon only in compact mode
}

export function ModeIndicator({ compact = false }: ModeIndicatorProps) {
  // Get theme to render correct colors
  const { isDarkMode } = useTheme();

  // State: What mode is the agent currently in?
  const [mode, setMode] = useState<ExecutionMode>('idle');

  // State: Is the mode indicator currently animating a transition?
  const [isAnimating, setIsAnimating] = useState(false);

  // Listen to eventBus for mode changes from the agent
  // When agent changes mode, update the indicator
  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    let isMounted = true;

    // Subscribe to "mode:general" event
    // Triggered when agent switches to General/Chat mode
    const unsubGeneral = eventBus.subscribe('mode:general', () => {
      if (!isMounted) return;
      setMode('general');
      setIsAnimating(true);
      const timeoutId = setTimeout(() => {
        if (isMounted) setIsAnimating(false); // Pulse animation: 600ms
      }, 600);
      timeoutIds.push(timeoutId);
    });

    // Subscribe to "mode:research" event
    // Triggered when agent starts web research
    const unsubResearch = eventBus.subscribe('mode:research', () => {
      if (!isMounted) return;
      setMode('research');
      setIsAnimating(true);
      const timeoutId = setTimeout(() => {
        if (isMounted) setIsAnimating(false);
      }, 600);
      timeoutIds.push(timeoutId);
    });

    // Subscribe to "mode:code" event
    // Triggered when agent starts code execution
    const unsubCode = eventBus.subscribe('mode:code', () => {
      if (!isMounted) return;
      setMode('code');
      setIsAnimating(true);
      const timeoutId = setTimeout(() => {
        if (isMounted) setIsAnimating(false);
      }, 600);
      timeoutIds.push(timeoutId);
    });

    // Subscribe to "mode:idle" event
    // Triggered when agent finishes and goes idle
    const unsubIdle = eventBus.subscribe('mode:idle', () => {
      if (!isMounted) return;
      setMode('idle');
      setIsAnimating(false); // No animation when going idle
    });

    // Cleanup: Unsubscribe from all events and clear pending timeouts when component unmounts
    return () => {
      isMounted = false;
      unsubGeneral();
      unsubResearch();
      unsubCode();
      unsubIdle();
      // Clear all pending timeouts to prevent state updates on unmounted component
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, []);

  const modes: Record<ExecutionMode, { icon: string; label: string; color: string }> = {
    idle: { icon: '◯', label: 'Idle', color: '#9CA3AF' },
    general: { icon: '◉', label: 'General Mode', color: '#3b82f6' },
    research: { icon: '◈', label: 'Research Mode', color: '#8b5cf6' },
    code: { icon: '◊', label: 'Code Mode', color: '#10b981' },
  };

  const current = modes[mode];
  const bgColor = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  // Don't show anything when idle
  const isIdle = mode === 'idle';
  if (isIdle) return null;

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 4,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          fontSize: 12,
          color: current.color,
          fontWeight: 600,
          transition: 'all 0.2s ease',
          opacity: isIdle ? 0.5 : 1,
          transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
          cursor: 'default',
        }}
        title={current.label}
      >
        {current.icon}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 6,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        fontSize: 12,
        fontFamily: FONT_FAMILY,
        color: current.color,
        fontWeight: 500,
        transition: 'all 0.2s ease',
        opacity: isIdle ? 0.6 : 1,
      }}
    >
      <span
        style={{
          fontSize: 10,
          display: 'inline-block',
          animation: isAnimating ? 'pulse 0.6s ease-out' : 'none',
        }}
      >
        {current.icon}
      </span>
      {current.label}
    </div>
  );
}
