/**
 * CampaignContext — Minimal stub for Neuro general-purpose harness.
 * The old ad pipeline (useCycleLoop, Campaign, Cycle) is no longer the focus.
 * This context provides null campaign/cycle so AgentPanel works in pure chat mode.
 */
import { createContext, useContext, useMemo } from 'react';
import type { Campaign, Cycle, CampaignContextType, StageName, CycleMode } from '../types';

export const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function broadcastCycleEvent(
  _type: 'cycle-started' | 'cycle-completed' | 'cycle-aborted',
  _campaignId: string
): void {
  // no-op stub
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const value: CampaignContextType = useMemo(() => ({
    campaign: null,
    cycles: [],
    currentCycle: null,
    isLoaded: true,
    systemStatus: 'idle' as const,
    error: null,
    cycleGeneration: 0,
    incrementCycleGeneration: () => {},
    pendingQuestion: null,
    questionAnswers: [],
    answerQuestion: (_answer: string) => {},
    variableContext: { context: {} },
    createCampaign: async () => {},
    updateCampaign: async () => {},
    startCycle: async (_mode?: CycleMode) => {},
    stopCycle: () => {},
    completeStage: async (_stageName: StageName, _output: string) => {},
    setCampaign: () => {},
    clearCampaign: () => {},
    resetResearch: async () => {},
    loadCampaignById: async (_id: string) => {},
  }), []);

  return (
    <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
  );
}

export function useCampaign(): CampaignContextType {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used within CampaignProvider');
  return ctx;
}
