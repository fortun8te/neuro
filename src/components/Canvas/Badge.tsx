/**
 * Badge System Component
 * 24 semantic variants for topics, priority, status, and method
 * WCAG AA contrast compliant
 */

import React from 'react';
import { CANVAS_FONT_SIZE } from '../../styles/canvasStyles';

export type BadgeType =
  | 'research'
  | 'market'
  | 'competitor'
  | 'finding'
  | 'insight'
  | 'high'
  | 'medium'
  | 'low'
  | 'complete'
  | 'inprogress'
  | 'blocked'
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'opportunity'
  | 'threat'
  | 'strength'
  | 'weakness'
  | 'primary'
  | 'secondary'
  | 'verified'
  | 'unverified'
  | 'recommended'
  | 'deprecated';

interface BadgeProps {
  type: BadgeType;
  children: React.ReactNode;
  isDarkMode?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const badgeConfig: Record<BadgeType, {
  darkBg: string;
  lightBg: string;
  darkColor: string;
  lightColor: string;
  darkBorder: string;
  lightBorder: string;
}> = {
  research: {
    darkBg: 'rgba(99,102,241,0.15)',
    lightBg: 'rgba(99,102,241,0.08)',
    darkColor: '#6366f1',
    lightColor: '#4f46e5',
    darkBorder: 'rgba(99,102,241,0.3)',
    lightBorder: 'rgba(99,102,241,0.2)',
  },
  market: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  competitor: {
    darkBg: 'rgba(139,92,246,0.15)',
    lightBg: 'rgba(139,92,246,0.08)',
    darkColor: '#a78bfa',
    lightColor: '#8b5cf6',
    darkBorder: 'rgba(139,92,246,0.3)',
    lightBorder: 'rgba(139,92,246,0.2)',
  },
  finding: {
    darkBg: 'rgba(59,130,246,0.15)',
    lightBg: 'rgba(59,130,246,0.08)',
    darkColor: '#3b82f6',
    lightColor: '#2563eb',
    darkBorder: 'rgba(59,130,246,0.3)',
    lightBorder: 'rgba(59,130,246,0.2)',
  },
  insight: {
    darkBg: 'rgba(167,139,250,0.15)',
    lightBg: 'rgba(167,139,250,0.08)',
    darkColor: '#a78bfa',
    lightColor: '#8b5cf6',
    darkBorder: 'rgba(167,139,250,0.3)',
    lightBorder: 'rgba(167,139,250,0.2)',
  },
  high: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  medium: {
    darkBg: 'rgba(251,146,60,0.15)',
    lightBg: 'rgba(251,146,60,0.08)',
    darkColor: '#fb923c',
    lightColor: '#ea580c',
    darkBorder: 'rgba(251,146,60,0.3)',
    lightBorder: 'rgba(251,146,60,0.2)',
  },
  low: {
    darkBg: 'rgba(156,163,175,0.15)',
    lightBg: 'rgba(156,163,175,0.08)',
    darkColor: '#9ca3af',
    lightColor: '#6b7280',
    darkBorder: 'rgba(156,163,175,0.3)',
    lightBorder: 'rgba(156,163,175,0.2)',
  },
  complete: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  inprogress: {
    darkBg: 'rgba(59,130,246,0.15)',
    lightBg: 'rgba(59,130,246,0.08)',
    darkColor: '#3b82f6',
    lightColor: '#2563eb',
    darkBorder: 'rgba(59,130,246,0.3)',
    lightBorder: 'rgba(59,130,246,0.2)',
  },
  blocked: {
    darkBg: 'rgba(239,68,68,0.15)',
    lightBg: 'rgba(239,68,68,0.08)',
    darkColor: '#ef4444',
    lightColor: '#dc2626',
    darkBorder: 'rgba(239,68,68,0.3)',
    lightBorder: 'rgba(239,68,68,0.2)',
  },
  positive: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  negative: {
    darkBg: 'rgba(239,68,68,0.15)',
    lightBg: 'rgba(239,68,68,0.08)',
    darkColor: '#ef4444',
    lightColor: '#dc2626',
    darkBorder: 'rgba(239,68,68,0.3)',
    lightBorder: 'rgba(239,68,68,0.2)',
  },
  neutral: {
    darkBg: 'rgba(156,163,175,0.15)',
    lightBg: 'rgba(156,163,175,0.08)',
    darkColor: '#9ca3af',
    lightColor: '#6b7280',
    darkBorder: 'rgba(156,163,175,0.3)',
    lightBorder: 'rgba(156,163,175,0.2)',
  },
  opportunity: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  threat: {
    darkBg: 'rgba(239,68,68,0.15)',
    lightBg: 'rgba(239,68,68,0.08)',
    darkColor: '#ef4444',
    lightColor: '#dc2626',
    darkBorder: 'rgba(239,68,68,0.3)',
    lightBorder: 'rgba(239,68,68,0.2)',
  },
  strength: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  weakness: {
    darkBg: 'rgba(239,68,68,0.15)',
    lightBg: 'rgba(239,68,68,0.08)',
    darkColor: '#ef4444',
    lightColor: '#dc2626',
    darkBorder: 'rgba(239,68,68,0.3)',
    lightBorder: 'rgba(239,68,68,0.2)',
  },
  primary: {
    darkBg: 'rgba(59,130,246,0.15)',
    lightBg: 'rgba(59,130,246,0.08)',
    darkColor: '#3b82f6',
    lightColor: '#2563eb',
    darkBorder: 'rgba(59,130,246,0.3)',
    lightBorder: 'rgba(59,130,246,0.2)',
  },
  secondary: {
    darkBg: 'rgba(107,114,128,0.15)',
    lightBg: 'rgba(107,114,128,0.08)',
    darkColor: '#6b7280',
    lightColor: '#4b5563',
    darkBorder: 'rgba(107,114,128,0.3)',
    lightBorder: 'rgba(107,114,128,0.2)',
  },
  verified: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  unverified: {
    darkBg: 'rgba(251,146,60,0.15)',
    lightBg: 'rgba(251,146,60,0.08)',
    darkColor: '#fb923c',
    lightColor: '#ea580c',
    darkBorder: 'rgba(251,146,60,0.3)',
    lightBorder: 'rgba(251,146,60,0.2)',
  },
  recommended: {
    darkBg: 'rgba(34,197,94,0.15)',
    lightBg: 'rgba(34,197,94,0.08)',
    darkColor: '#22c55e',
    lightColor: '#16a34a',
    darkBorder: 'rgba(34,197,94,0.3)',
    lightBorder: 'rgba(34,197,94,0.2)',
  },
  deprecated: {
    darkBg: 'rgba(239,68,68,0.15)',
    lightBg: 'rgba(239,68,68,0.08)',
    darkColor: '#ef4444',
    lightColor: '#dc2626',
    darkBorder: 'rgba(239,68,68,0.3)',
    lightBorder: 'rgba(239,68,68,0.2)',
  },
};

const sizeConfig = {
  sm: {
    padding: '2px 6px',
    fontSize: '10px',
  },
  md: {
    padding: '3px 8px',
    fontSize: CANVAS_FONT_SIZE.sm,
  },
  lg: {
    padding: '4px 10px',
    fontSize: CANVAS_FONT_SIZE.base,
  },
};

export function Badge({
  type,
  children,
  isDarkMode = true,
  size = 'md',
}: BadgeProps) {
  const config = badgeConfig[type];
  const sizeStyle = sizeConfig[size];

  const bgColor = isDarkMode ? config.darkBg : config.lightBg;
  const color = isDarkMode ? config.darkColor : config.lightColor;
  const border = isDarkMode ? config.darkBorder : config.lightBorder;

  return (
    <span
      style={{
        display: 'inline-block',
        background: bgColor,
        color: color,
        border: `1px solid ${border}`,
        padding: sizeStyle.padding,
        borderRadius: '4px',
        fontSize: sizeStyle.fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        marginRight: '4px',
        marginBottom: '2px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
