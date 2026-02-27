import { useState } from 'react';

function App() {
  const [step, setStep] = useState('starting');

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui', fontSize: '16px' }}>
      <h1>NOMADS Research Agent</h1>
      <p>Current step: <strong>{step}</strong></p>

      <button onClick={() => loadTheme()}>Load Theme Provider</button>
      <button onClick={() => loadCampaign()}>Load Campaign Provider</button>
      <button onClick={() => loadDashboard()}>Load Dashboard</button>
    </div>
  );

  async function loadTheme() {
    try {
      setStep('loading-theme');
      const mod = await import('./context/ThemeContext');
      console.log('Theme loaded:', mod);
      setStep('theme-loaded');
    } catch (err) {
      console.error('Theme error:', err);
      setStep(`ERROR: ${err}`);
    }
  }

  async function loadCampaign() {
    try {
      setStep('loading-campaign');
      const mod = await import('./context/CampaignContext');
      console.log('Campaign loaded:', mod);
      setStep('campaign-loaded');
    } catch (err) {
      console.error('Campaign error:', err);
      setStep(`ERROR: ${err}`);
    }
  }

  async function loadDashboard() {
    try {
      setStep('loading-dashboard');
      const mod = await import('./components/Dashboard');
      console.log('Dashboard loaded:', mod);
      setStep('dashboard-loaded');
    } catch (err) {
      console.error('Dashboard error:', err);
      setStep(`ERROR: ${err}`);
    }
  }
}

export default App;
