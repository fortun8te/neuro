/**
 * AppShell — Top-level layout with navigation
 *
 * Three views:
 * - Make (default) — SaaS-style creative tool
 * - Research — Full pipeline view (old Dashboard)
 * - Test — Evaluation results
 *
 * Navigation is clean, minimal — matches the Creatify-style look.
 */

import { useState, useCallback, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useTheme } from '../context/ThemeContext';
import { useSoundEngine } from '../hooks/useSoundEngine';
import { MakeStudio } from './MakeStudio';
import { Dashboard } from './Dashboard';
import { SettingsModal } from './SettingsModal';
import { BrandHubDrawer, DNAIcon } from './BrandHubDrawer';
import { NomadIcon } from './NomadIcon';
import { ShineText } from './ShineText';

export type AppView = 'make' | 'research' | 'test';

export function AppShell() {
  const [activeView, setActiveView] = useState<AppView>('make');
  const [showSettings, setShowSettings] = useState(false);
  const [showBrandHub, setShowBrandHub] = useState(false);
  const { systemStatus, currentCycle, campaign } = useCampaign() as any;
  const { startCycle, stopCycle, clearCampaign } = useCampaign() as any;
  const { theme } = useTheme();
  const { play } = useSoundEngine();

  const isRunning = systemStatus === 'running';

  const handleStartPipeline = useCallback(() => {
    if (campaign) {
      play('launch');
      startCycle();
    }
  }, [campaign, startCycle, play]);

  // Listen for cross-component view switch events (e.g. DesireBoard → Research)
  useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent).detail as AppView;
      if (view) setActiveView(view);
    };
    window.addEventListener('nomad-switch-view', handler);
    return () => window.removeEventListener('nomad-switch-view', handler);
  }, []);

  // Listen for sidebar Brand DNA card click → open BrandHubDrawer
  useEffect(() => {
    const handler = () => setShowBrandHub(true);
    window.addEventListener('nomad-open-brand-hub', handler);
    return () => window.removeEventListener('nomad-open-brand-hub', handler);
  }, []);

  // Status color
  const statusColor = isRunning ? 'bg-emerald-500' : 'bg-zinc-300';

  // Stage status for nav badges
  const researchStatus = currentCycle?.stages?.research?.status;
  const anglesStatus = currentCycle?.stages?.angles?.status;
  const productionStatus = currentCycle?.stages?.production?.status;
  const testStatus = currentCycle?.stages?.test?.status;

  const getStageBadge = (status: string | undefined) => {
    if (!status || status === 'pending') return null;
    if (status === 'complete') return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />;
    if (status === 'in-progress') return <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />;
    return null;
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}`}>
      {/* ── Top Navigation Bar ── */}
      <nav className={`${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80'} border-b px-6 py-0 flex-shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}>
        <div className="flex items-center h-14">
          {/* Left: Logo + Status */}
          <div className="flex items-center gap-4 z-10 flex-1">
            <div className="flex items-center gap-2.5 group cursor-default">
              <div className="transition-transform duration-300 group-hover:-translate-y-px">
                <NomadIcon size={22} animated={isRunning} className={theme === 'dark' ? 'text-white' : 'text-zinc-900'} />
              </div>
              <span className={`text-sm font-bold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>NOMAD</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${isRunning ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-zinc-400 uppercase tracking-wider">
                {isRunning ? (
                  <ShineText className="text-xs uppercase tracking-wider" speed={2.5}>Running</ShineText>
                ) : 'Idle'}
              </span>
            </div>
            {campaign && (
              <span className="text-xs text-zinc-400">{campaign.brand}</span>
            )}
          </div>

          {/* Center: View Tabs — flex-1 with justify-center for true centering */}
          <div className="flex-1 flex justify-center">
          <div className={`flex items-center gap-1 ${theme === 'dark' ? 'bg-zinc-800/80' : 'bg-zinc-100/80'} rounded-xl p-1 shadow-inner`}>
            {([
              { key: 'research' as AppView, label: 'Research', badge: researchStatus || anglesStatus, icon: (active: boolean) => (
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 group-hover/tab:scale-110 group-hover/tab:rotate-[-8deg]`}
                  style={{ background: active ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : theme === 'dark' ? '#52525b' : '#d4d4d8' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
              )},
              { key: 'make' as AppView, label: 'Make', badge: productionStatus, icon: (active: boolean) => (
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 group-hover/tab:scale-110 group-hover/tab:-translate-y-0.5`}
                  style={{ background: active ? 'linear-gradient(135deg, #ef4444, #f97316)' : theme === 'dark' ? '#52525b' : '#d4d4d8' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 4-1 8 7-1-11 13 1-8-7 1z" />
                  </svg>
                </div>
              )},
              { key: 'test' as AppView, label: 'Test', badge: testStatus, icon: (active: boolean) => (
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 group-hover/tab:scale-110 group-hover/tab:rotate-[8deg]`}
                  style={{ background: active ? 'linear-gradient(135deg, #eab308, #f59e0b)' : theme === 'dark' ? '#52525b' : '#d4d4d8' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="m7 16 4-8 4 4 4-10" />
                  </svg>
                </div>
              )},
            ]).map(({ key, label, badge, icon }) => (
              <button
                key={key}
                onClick={() => { if (activeView !== key) play('navigate'); setActiveView(key); }}
                className={`group/tab relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeView === key
                    ? theme === 'dark'
                      ? 'bg-zinc-700 text-white shadow-[0_1px_3px_rgba(0,0,0,0.3),0_1px_1px_rgba(0,0,0,0.2)]'
                      : 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.06)]'
                    : theme === 'dark'
                    ? 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700/40'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-white/40'
                }`}
              >
                {icon(activeView === key)}
                {getStageBadge(badge)}
                {label}
              </button>
            ))}
          </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 z-10 flex-1 justify-end">
            {/* Pipeline controls */}
            {!isRunning && campaign && (
              <button
                onClick={handleStartPipeline}
                className="px-3.5 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-px active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              >
                Run Pipeline
              </button>
            )}
            {isRunning && (
              <button
                onClick={() => { play('stop'); stopCycle(); }}
                className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:border-red-400 hover:bg-red-50 transition-all"
              >
                Stop
              </button>
            )}

            {campaign && (
              <button
                onClick={() => { play('reset'); clearCampaign(); }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors"
                title="Reset campaign"
              >
                Reset
              </button>
            )}

            {/* Brand Hub (DNA + Persona + Strategy) */}
            <button
              onClick={() => { play('open'); setShowBrandHub(true); }}
              className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:shadow-[0_0_12px_rgba(139,92,246,0.15)]' : 'hover:shadow-[0_0_12px_rgba(139,92,246,0.12)]'}`}
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.1))'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.06))',
              }}
              title="Brand DNA"
            >
              <DNAIcon size={16} isDark={theme === 'dark'} />
            </button>

            {/* Settings */}
            <button
              onClick={() => { play('open'); setShowSettings(true); }}
              className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── View Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeView === 'make' && <MakeStudio />}
        {activeView === 'research' && <Dashboard embedded />}
        {activeView === 'test' && <TestView />}
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => { play('close'); setShowSettings(false); }} isRunning={isRunning} />

      {/* Brand DNA Modal */}
      <BrandHubDrawer
        isOpen={showBrandHub}
        onClose={() => { play('close'); setShowBrandHub(false); }}
        brandDNA={currentCycle?.brandDNA}
        personas={currentCycle?.personas}
        creativeStrategy={currentCycle?.creativeStrategy}
        presetBrand={campaign?.presetData?.brand}
        presetAudience={campaign?.presetData?.audience}
        presetProduct={campaign?.presetData?.product}
        presetCompetitive={campaign?.presetData?.competitive}
        presetStrategy={campaign?.presetData?.strategy}
        presetMessaging={campaign?.presetData?.messaging}
        presetPersonas={campaign?.presetData?.personas}
      />
    </div>
  );
}

// ── Test View (placeholder for now) ──

function TestView() {
  const { currentCycle } = useCampaign();
  const { theme } = useTheme();
  const testOutput = currentCycle?.stages?.test?.agentOutput;
  const testComplete = currentCycle?.stages?.test?.status === 'complete';

  return (
    <div className={`h-full flex items-center justify-center p-8 overflow-y-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-[#f7f7f8]'}`}>
      {testComplete && testOutput ? (
        <div className={`max-w-3xl w-full rounded-2xl shadow-sm border p-8 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
          <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-800'}`}>Test Results</h2>
          <div className={`font-mono text-xs whitespace-pre-wrap leading-relaxed ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
            {testOutput}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-2xl shadow-sm border border-dashed flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <NomadIcon size={24} className={theme === 'dark' ? 'text-zinc-700' : 'text-zinc-300'} />
          </div>
          <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>No test results yet</p>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Run the full pipeline to evaluate ad concepts</p>
        </div>
      )}
    </div>
  );
}
