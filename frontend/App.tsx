import { CampaignProvider } from './context/CampaignContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import ForzaXLanding from './components/ForzaXLanding';

const SHOW_FORZAX = new URLSearchParams(window.location.search).has('forzax');

function App() {
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

export default App;
