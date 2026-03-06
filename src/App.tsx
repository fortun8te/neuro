import { CampaignProvider } from './context/CampaignContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/AppShell';
import ForzaXLanding from './components/ForzaXLanding';

const SHOW_FORZAX = new URLSearchParams(window.location.search).has('forzax');

function App() {
  if (SHOW_FORZAX) {
    return <ForzaXLanding />;
  }
  return (
    <ThemeProvider>
      <CampaignProvider>
        <AppShell />
      </CampaignProvider>
    </ThemeProvider>
  );
}

export default App;
