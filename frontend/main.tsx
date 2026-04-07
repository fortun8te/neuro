import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// ── Global crash-proof handlers ──────────────────────────────────────────────
// Prevent unhandled promise rejections and uncaught errors from crashing the app
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const isCircuitBreaker = typeof reason === 'string' && reason.includes('Circuit breaker');
  const isNetworkError = reason instanceof Error && (
    reason.message.includes('fetch') ||
    reason.message.includes('network') ||
    reason.message.includes('timeout')
  );

  // Log with appropriate level based on error type
  if (isCircuitBreaker) {
    console.warn('[Service Unavailable]', reason, '— Service may be recovering');
  } else if (isNetworkError) {
    console.warn('[Network Error]', reason, '— Check connection');
  } else {
    console.error('[Unhandled Promise Rejection]', reason);
  }

  event.preventDefault(); // Prevent the default browser error
});

window.addEventListener('error', (event) => {
  const error = event.error;
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('ResizeObserver')) {
    // ResizeObserver errors are often benign, log at debug level
    console.debug('[ResizeObserver Error]', message);
  } else {
    console.error('[Uncaught Error]', error);
  }

  event.preventDefault();
});

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found!');
  }

  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
} catch (error) {
  console.error('Failed to render React app:', error);
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';
  const isDev = import.meta.env.DEV;
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;">
      <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ff4444; border-radius: 8px; padding: 32px; background: rgba(255, 68, 68, 0.05);">
        <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #ff4444;">Application Error</h1>
        <p style="margin: 0 0 20px 0; opacity: 0.8;">${msg}</p>
        ${isDev ? `<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; max-height: 200px; margin: 0 0 20px 0;">${stack}</pre>` : ''}
        <button onclick="location.reload()" style="padding: 12px 24px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">Reload Page</button>
      </div>
    </div>
  `;
}
