/**
 * Progress Indicator Components
 * Linear progress bars and circular progress rings
 * WCAG AA contrast compliant
 */

import React from 'react';
import { getColorScheme, CANVAS_SPACING, CANVAS_FONT_SIZE, CANVAS_RADIUS } from '../../styles/canvasStyles';

interface ProgressBarProps {
  value: number;
  label: string;
  max?: string;
  isDarkMode?: boolean;
  showPercent?: boolean;
}

interface CircularProgressProps {
  value: number;
  label: string;
  size?: number;
  isDarkMode?: boolean;
}

const getProgressColor = (value: number): string => {
  if (value >= 70) return '#22c55e';
  if (value >= 40) return '#fb923c';
  return '#ef4444';
};

export function ProgressBar({
  value,
  label,
  max,
  isDarkMode = true,
  showPercent = true,
}: ProgressBarProps) {
  const colors = getColorScheme(isDarkMode);
  const clampedValue = Math.max(0, Math.min(100, value));
  const color = getProgressColor(clampedValue);
  const bgColor = colors.hover;
  const textColor = colors.textSecondary;

  return (
    <div style={{ marginBottom: CANVAS_SPACING.xxl }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: CANVAS_SPACING.md,
          gap: CANVAS_SPACING.lg,
        }}
      >
        <span
          style={{
            fontSize: CANVAS_FONT_SIZE.base,
            color: textColor,
            fontWeight: 500,
            flex: 1,
          }}
        >
          {label}
        </span>
        {(showPercent || max) && (
          <span style={{ fontSize: CANVAS_FONT_SIZE.base, color: textColor, flexShrink: 0 }}>
            {showPercent && `${clampedValue}%`}
            {max && showPercent && ` — ${max}`}
            {max && !showPercent && max}
          </span>
        )}
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          background: bgColor,
          borderRadius: CANVAS_RADIUS.md,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clampedValue}%`,
            height: '100%',
            background: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

export function CircularProgress({
  value,
  label,
  size = 100,
  isDarkMode = true,
}: CircularProgressProps) {
  const colors = getColorScheme(isDarkMode);
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  const color = getProgressColor(clampedValue);
  const bgColor = colors.hover;
  const textColor = colors.textSecondary;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: CANVAS_SPACING.lg,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{
            transform: 'rotate(-90deg)',
            filter: isDarkMode ? '' : 'none',
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth="4"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.3s ease',
            }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: `${size * 0.25}px`,
              fontWeight: 'bold',
              color: color,
            }}
          >
            {clampedValue}%
          </div>
        </div>
      </div>
      <span
        style={{
          fontSize: CANVAS_FONT_SIZE.base,
          color: textColor,
          textAlign: 'center',
          maxWidth: size,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}
