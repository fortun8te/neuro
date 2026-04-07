/**
 * MakeStudioErrorBoundary — Isolates Make/creative generation failures
 * Prevents: LLM generation crashes, image processing errors, HTML rendering issues
 * Recovery: retry generation, clear cache, reload studio
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface MakeStudioErrorBoundaryProps {
  children: React.ReactNode;
  onRetryGeneration?: () => void;
  onClearCache?: () => void;
}

export function MakeStudioErrorBoundary({
  children,
  onRetryGeneration,
  onClearCache,
}: MakeStudioErrorBoundaryProps) {
  const isDarkMode = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const fallback = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        padding: 20,
        background: isDarkMode ? 'rgba(200, 120, 50, 0.1)' : 'rgba(200, 120, 50, 0.08)',
        border: isDarkMode ? '1px solid rgba(200, 120, 50, 0.3)' : '1px solid rgba(200, 120, 50, 0.2)',
        borderRadius: 8,
        color: isDarkMode ? '#d9a574' : '#a86437',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>
        Creative Generation Error
      </div>
      <div style={{ fontSize: 11, opacity: 0.9, lineHeight: 1.5 }}>
        The Make studio encountered an error during creative generation. This could be due to:
        <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
          <li>LLM connection issues</li>
          <li>Image processing timeout</li>
          <li>HTML rendering error</li>
        </ul>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {onRetryGeneration && (
          <button
            onClick={onRetryGeneration}
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
            Retry Generation
          </button>
        )}
        {onClearCache && (
          <button
            onClick={onClearCache}
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
            Clear Cache
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      name="Make Studio"
      fallback={fallback}
      onReset={onRetryGeneration}
      onError={(error, info) => {
        console.error('[Make Studio] Generation error:', {
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
