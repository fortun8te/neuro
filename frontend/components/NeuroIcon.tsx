import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface NeuroIconProps {
  size?: number;
  className?: string;
}

export function NeuroIcon({ size = 36, className }: NeuroIconProps) {
  const { isDarkMode } = useTheme();

  // Blue gradient in dark mode, dark gray in light
  const gradientStart = isDarkMode ? '#3b82f6' : '#374151';
  const gradientEnd = isDarkMode ? '#60a5fa' : '#6b7280';
  const glowColor = isDarkMode ? 'rgba(59,130,246,0.3)' : 'rgba(55,65,81,0.2)';

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 2px 8px ${glowColor}`,
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        {/* Neural network / brain motif — 3 connected nodes */}
        <circle cx="12" cy="6" r="2.5" fill="white" opacity="0.9" />
        <circle cx="6" cy="18" r="2.5" fill="white" opacity="0.9" />
        <circle cx="18" cy="18" r="2.5" fill="white" opacity="0.9" />
        <line x1="12" y1="8.5" x2="7" y2="15.5" stroke="white" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
        <line x1="12" y1="8.5" x2="17" y2="15.5" stroke="white" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
        <line x1="8.5" y1="18" x2="15.5" y2="18" stroke="white" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
