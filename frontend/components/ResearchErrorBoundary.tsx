/**
 * ResearchErrorBoundary — Isolates research pipeline failures
 * Prevents: orchestration crashes, researcher loops, compression timeouts
 * Recovery: retry research, skip to next phase, manual research input
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ResearchErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
  onSkip?: () => void;
  phaseName?: string;
}

export function ResearchErrorBoundary({
  children,
  onRetry,
  onSkip,
  phaseName = 'Research',
}: ResearchErrorBoundaryProps) {
  const handleReset = () => {
    // Clear research abort signals and retry
    onRetry?.();
  };

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
        background: isDarkMode ? 'rgba(200, 50, 50, 0.1)' : 'rgba(200, 50, 50, 0.08)',
        border: isDarkMode ? '1px solid rgba(200, 50, 50, 0.3)' : '1px solid rgba(200, 50, 50, 0.2)',
        borderRadius: 8,
        color: isDarkMode ? '#ff9999' : '#c84545',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {phaseName} Pipeline Error
      </div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        The research phase encountered an error. You can retry the operation or skip to the next phase.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {onRetry && (
          <button
            onClick={handleReset}
            style={{
              padding: '6px 12px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              border: 'none',
              borderRadius: 4,
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            style={{
              padding: '6px 12px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              border: 'none',
              borderRadius: 4,
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            Skip Phase
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      name={phaseName}
      fallback={fallback}
      onReset={handleReset}
      onError={(error, info) => {
        console.error(`[${phaseName}] Research error:`, {
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
