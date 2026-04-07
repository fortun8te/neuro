/**
 * DashboardErrorBoundary — Isolates dashboard/layout failures
 * Prevents: sidebar crashes, modal errors, global UI breakdown
 * Recovery: reload dashboard, reset modals, clear cache
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export function DashboardErrorBoundary({
  children,
  onReset,
}: DashboardErrorBoundaryProps) {
  const isDarkMode = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const fallback = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: isDarkMode ? '#0f0f0f' : '#ffffff',
        color: isDarkMode ? '#888' : '#666',
        gap: 16,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? '#fff' : '#000' }}>
        Dashboard Error
      </div>
      <div
        style={{
          fontSize: 13,
          color: isDarkMode ? '#aaa' : '#666',
          maxWidth: 500,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        The dashboard encountered a critical error. Please refresh the page or try the recovery options below.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px',
            background: isDarkMode ? '#333' : '#f0f0f0',
            border: isDarkMode ? '1px solid #555' : '1px solid #ddd',
            borderRadius: 6,
            color: isDarkMode ? '#fff' : '#000',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Refresh Page
        </button>
        {onReset && (
          <button
            onClick={onReset}
            style={{
              padding: '10px 24px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              border: 'none',
              borderRadius: 6,
              color: isDarkMode ? '#fff' : '#000',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Reset Dashboard
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      name="Dashboard"
      fallback={fallback}
      onReset={onReset}
      onError={(error, info) => {
        console.error('[Dashboard] Critical error:', {
          error: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          timestamp: new Date().toISOString(),
        });
        // Could send to monitoring service here
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
