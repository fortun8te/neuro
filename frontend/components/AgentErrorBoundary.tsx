/**
 * AgentErrorBoundary — Isolates agent execution failures
 * Prevents: tool call crashes, loop infinite loops, state machine failures
 * Recovery: restart agent, clear state, manual intervention
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface AgentErrorBoundaryProps {
  children: React.ReactNode;
  onRestart?: () => void;
  onClearState?: () => void;
  agentName?: string;
}

export function AgentErrorBoundary({
  children,
  onRestart,
  onClearState,
  agentName = 'Agent',
}: AgentErrorBoundaryProps) {
  const handleReset = () => {
    onRestart?.();
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
        background: isDarkMode ? 'rgba(255, 100, 100, 0.1)' : 'rgba(255, 100, 100, 0.08)',
        border: isDarkMode ? '1px solid rgba(255, 100, 100, 0.3)' : '1px solid rgba(255, 100, 100, 0.2)',
        borderRadius: 8,
        color: isDarkMode ? '#ff8888' : '#d94040',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {agentName} Execution Error
      </div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        The agent encountered an unexpected error during execution. Try restarting or clearing the state to recover.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {onRestart && (
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
            Restart
          </button>
        )}
        {onClearState && (
          <button
            onClick={onClearState}
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
            Clear State
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      name={`${agentName} Execution`}
      fallback={fallback}
      onReset={handleReset}
      onError={(error, info) => {
        console.error(`[${agentName}] Agent error:`, {
          error: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
        });
        // Could send to monitoring service here
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
