/**
 * ChatErrorBoundary — Isolates chat interface failures
 * Prevents: message rendering crashes, input handler errors, streaming failures
 * Recovery: clear messages, reset input, reload conversation
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ChatErrorBoundaryProps {
  children: React.ReactNode;
  onClearMessages?: () => void;
  onReload?: () => void;
}

export function ChatErrorBoundary({
  children,
  onClearMessages,
  onReload,
}: ChatErrorBoundaryProps) {
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
        background: isDarkMode ? 'rgba(150, 100, 200, 0.1)' : 'rgba(150, 100, 200, 0.08)',
        border: isDarkMode ? '1px solid rgba(150, 100, 200, 0.3)' : '1px solid rgba(150, 100, 200, 0.2)',
        borderRadius: 8,
        color: isDarkMode ? '#b88fd9' : '#8b5a9c',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        Chat Interface Error
      </div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        The chat interface encountered an error. Try clearing recent messages or reloading the conversation.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {onClearMessages && (
          <button
            onClick={onClearMessages}
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
            Clear Messages
          </button>
        )}
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
            }}
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      name="Chat Interface"
      fallback={fallback}
      onReset={onReload}
      onError={(error, info) => {
        console.error('[Chat] Interface error:', {
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
