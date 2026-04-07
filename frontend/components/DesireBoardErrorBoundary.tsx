/**
 * DesireBoardErrorBoundary — Isolates desire-driven research tree failures
 * Prevents: tree rendering crashes, desire state corruption
 * Recovery: reload desire board, reset selection
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface DesireBoardErrorBoundaryProps {
  children: React.ReactNode;
  onReload?: () => void;
}

export function DesireBoardErrorBoundary({
  children,
  onReload,
}: DesireBoardErrorBoundaryProps) {
  const isDarkMode = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const fallback = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        background: isDarkMode ? 'rgba(100, 150, 200, 0.1)' : 'rgba(100, 150, 200, 0.08)',
        border: isDarkMode ? '1px solid rgba(100, 150, 200, 0.3)' : '1px solid rgba(100, 150, 200, 0.2)',
        borderRadius: 8,
        color: isDarkMode ? '#8db4d9' : '#4a7ba7',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        Desire Board Error
      </div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        The desire tree failed to render. Try reloading to recover.
      </div>
      {onReload && (
        <button
          onClick={onReload}
          style={{
            padding: '6px 12px',
            background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            border: 'none',
            borderRadius: 4,
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          Reload
        </button>
      )}
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      name="Desire Board"
      fallback={fallback}
      onReset={onReload}
      onError={(error, info) => {
        console.error('[Desire Board] Render error:', {
          error: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
