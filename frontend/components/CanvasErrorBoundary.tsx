/**
 * CanvasErrorBoundary — Isolates canvas/editor failures
 * Prevents: iframe crashes, rendering errors, editor state corruption
 * Recovery: reload canvas, clear history, reset viewport
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface CanvasErrorBoundaryProps {
  children: React.ReactNode;
  onReload?: () => void;
  onReset?: () => void;
}

export function CanvasErrorBoundary({
  children,
  onReload,
  onReset,
}: CanvasErrorBoundaryProps) {
  const isDarkMode = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const fallback = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        background: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(245, 245, 245, 0.95)',
        color: isDarkMode ? '#888' : '#666',
        gap: 16,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: isDarkMode ? '#fff' : '#000' }}>
        Canvas Error
      </div>
      <div
        style={{
          fontSize: 12,
          color: isDarkMode ? '#aaa' : '#666',
          maxWidth: 400,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        The canvas editor encountered an error. Try reloading or resetting the viewport.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {onReload && (
          <button
            onClick={onReload}
            style={{
              padding: '10px 20px',
              background: isDarkMode ? '#333' : '#f0f0f0',
              border: isDarkMode ? '1px solid #555' : '1px solid #ddd',
              borderRadius: 6,
              color: isDarkMode ? '#fff' : '#000',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Reload Canvas
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            style={{
              padding: '10px 20px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              border: 'none',
              borderRadius: 6,
              color: isDarkMode ? '#fff' : '#000',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      name="Canvas Editor"
      fallback={fallback}
      onReset={onReload}
      onError={(error, info) => {
        console.error('[Canvas] Editor error:', {
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
