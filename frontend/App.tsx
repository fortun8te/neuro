import { useEffect } from 'react';
import { CampaignProvider } from './context/CampaignContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import ForzaXLanding from './components/ForzaXLanding';
import { processWatchdog } from './utils/processWatchdog';
import { INFRASTRUCTURE } from './config/infrastructure';

const SHOW_FORZAX = new URLSearchParams(window.location.search).has('forzax');

function AppContent() {
  useEffect(() => {
    // Phase 4: Wire watchdog on app mount
    if (INFRASTRUCTURE.watchdogEnabled) {
      console.log('[App] Initializing Process Watchdog (Phase 4)...');

      // Start health monitoring
      const interval = setInterval(async () => {
        try {
          // Watchdog periodically cleans up old processes and monitors active ones
          const stats = processWatchdog.getStats();
          if (stats.activeProcesses > 0) {
            console.debug(`[App] ${stats.activeProcesses} active processes being monitored`);
          }
        } catch (err) {
          console.error('[App] Watchdog error:', err);
        }
      }, INFRASTRUCTURE.watchdogInterval);

      return () => {
        clearInterval(interval);
        console.log('[App] Process Watchdog stopped');
      };
    }
  }, []);

  if (SHOW_FORZAX) {
    return <ForzaXLanding />;
  }

  return (
    <ThemeProvider>
      <CampaignProvider>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </CampaignProvider>
    </ThemeProvider>
  );
}

function App() {
  return <AppContent />;
}

export default App;
