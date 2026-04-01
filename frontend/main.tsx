import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// ── Global crash-proof handlers ──────────────────────────────────────────────
// Prevent unhandled promise rejections and uncaught errors from crashing the app
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  event.preventDefault(); // Prevent the default browser error
});

window.addEventListener('error', (event) => {
  console.error('[Uncaught Error]', event.error);
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
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: monospace; background: #1a1a1a; color: #ff0000; min-height: 100vh;">
      <h1>React Initialization Error</h1>
      <p>${msg}</p>
      <pre>${stack}</pre>
    </div>
  `;
}
