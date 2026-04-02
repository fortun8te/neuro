/**
 * Semantic Highlighting Component
 * Provides color-coded inline highlights for key insights, warnings, evidence
 * WCAG AA contrast compliant
 */

import React from 'react';
import { getColorScheme, CANVAS_SPACING } from '../../styles/canvasStyles';

export type HighlightType = 'key' | 'warn' | 'insight' | 'evidence' | 'note';

interface SemanticHighlightProps {
  type: HighlightType;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const highlightConfig: Record<HighlightType, {
  color: string;
  bg: string;
  darkBg: string;
  lightBg: string;
  borderLeft: string;
}> = {
  key: {
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.15)',
    darkBg: 'rgba(34,197,94,0.12)',
    lightBg: 'rgba(34,197,94,0.08)',
    borderLeft: '3px solid #22c55e',
  },
  warn: {
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.15)',
    darkBg: 'rgba(251,146,60,0.12)',
    lightBg: 'rgba(251,146,60,0.08)',
    borderLeft: '3px solid #fb923c',
  },
  insight: {
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.15)',
    darkBg: 'rgba(167,139,250,0.12)',
    lightBg: 'rgba(167,139,250,0.08)',
    borderLeft: '3px solid #a78bfa',
  },
  evidence: {
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    darkBg: 'rgba(59,130,246,0.12)',
    lightBg: 'rgba(59,130,246,0.08)',
    borderLeft: '3px solid #3b82f6',
  },
  note: {
    color: '#9ca3af',
    bg: 'rgba(156,163,175,0.15)',
    darkBg: 'rgba(156,163,175,0.12)',
    lightBg: 'rgba(156,163,175,0.08)',
    borderLeft: '3px solid #9ca3af',
  },
};

export function SemanticHighlight({
  type,
  children,
  isDarkMode = true,
}: SemanticHighlightProps) {
  const config = highlightConfig[type];
  const bgColor = isDarkMode ? config.darkBg : config.lightBg;

  return (
    <span
      style={{
        display: 'inline-block',
        background: bgColor,
        borderLeft: config.borderLeft,
        paddingLeft: CANVAS_SPACING.md,
        paddingRight: CANVAS_SPACING.md,
        marginLeft: `-${CANVAS_SPACING.md}`,
        borderRadius: '2px',
        color: config.color,
        fontWeight: 500,
        lineHeight: '1.4',
      }}
    >
      {children}
    </span>
  );
}
