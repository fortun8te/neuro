import React from 'react';

interface State { hasError: boolean; error: string }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; onReset?: () => void },
  State
> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0a0a0c', color: '#888', gap: 12 }}>
          <div style={{ fontSize: 14 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: '#555', maxWidth: 400, textAlign: 'center' }}>{this.state.error}</div>
          <button onClick={() => { this.setState({ hasError: false, error: '' }); this.props.onReset?.(); }}
            style={{ padding: '6px 16px', background: '#222', border: '1px solid #333', borderRadius: 6, color: '#aaa', cursor: 'pointer', fontSize: 12 }}>
            Restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
