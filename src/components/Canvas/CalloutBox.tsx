/**
 * Callout Box Component
 * Displays tip, warning, critical, success, and quote callouts
 * WCAG AA contrast compliant
 */

import React from 'react';
import { getColorScheme, CANVAS_SPACING, CANVAS_FONT_SIZE, CANVAS_RADIUS } from '../../styles/canvasStyles';

export type CalloutType = 'tip' | 'warning' | 'critical' | 'success' | 'quote';

interface CalloutBoxProps {
  type: CalloutType;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const calloutConfig: Record<CalloutType, {
  icon: string;
  color: string;
  darkBg: string;
  lightBg: string;
  darkBorder: string;
  lightBorder: string;
  borderColor: string;
  title: string;
}> = {
  tip: {
    icon: '💡',
    color: '#3b82f6',
    darkBg: 'rgba(59,130,246,0.12)',
    lightBg: 'rgba(59,130,246,0.08)',
    darkBorder: 'rgba(59,130,246,0.35)',
    lightBorder: 'rgba(59,130,246,0.25)',
    borderColor: '#3b82f6',
    title: 'Tip',
  },
  warning: {
    icon: '⚠',
    color: '#fb923c',
    darkBg: 'rgba(251,146,60,0.12)',
    lightBg: 'rgba(251,146,60,0.08)',
    darkBorder: 'rgba(251,146,60,0.35)',
    lightBorder: 'rgba(251,146,60,0.25)',
    borderColor: '#fb923c',
    title: 'Warning',
  },
  critical: {
    icon: '❌',
    color: '#ef4444',
    darkBg: 'rgba(239,68,68,0.12)',
    lightBg: 'rgba(239,68,68,0.08)',
    darkBorder: 'rgba(239,68,68,0.35)',
    lightBorder: 'rgba(239,68,68,0.25)',
    borderColor: '#ef4444',
    title: 'Critical',
  },
  success: {
    icon: '✓',
    color: '#22c55e',
    darkBg: 'rgba(34,197,94,0.12)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkBorder: 'rgba(34,197,94,0.35)',
    lightBorder: 'rgba(34,197,94,0.25)',
    borderColor: '#22c55e',
    title: 'Success',
  },
  quote: {
    icon: '"',
    color: 'rgba(255,255,255,0.65)',
    darkBg: 'rgba(255,255,255,0.02)',
    lightBg: 'rgba(0,0,0,0.02)',
    darkBorder: 'rgba(255,255,255,0.12)',
    lightBorder: 'rgba(0,0,0,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
    title: 'Quote',
  },
};

export function CalloutBox({
  type,
  children,
  isDarkMode = true,
}: CalloutBoxProps) {
  const config = calloutConfig[type];
  const colors = getColorScheme(isDarkMode);

  const bgColor = isDarkMode ? config.darkBg : config.lightBg;
  const borderColor = isDarkMode ? config.darkBorder : config.lightBorder;
  const textColor = colors.textSecondary;

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${config.borderColor}`,
        borderRadius: CANVAS_RADIUS.md,
        padding: `${CANVAS_SPACING.lg} ${CANVAS_SPACING.lg}`,
        margin: `${CANVAS_SPACING.lg} 0`,
        display: 'flex',
        gap: CANVAS_SPACING.lg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span
        style={{
          fontSize: '20px',
          lineHeight: '1.4',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {config.icon}
      </span>
      <div
        style={{
          color: textColor,
          flex: 1,
          fontSize: CANVAS_FONT_SIZE.base,
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </div>
  );
}
