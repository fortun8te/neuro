import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Campaign, Cycle, CampaignContextType, StageName, CycleMode, UserQuestion, UserQuestionAnswer } from '../types';
import { useCycleLoop } from '../hooks/useCycleLoop';
import { useStorage } from '../hooks/useStorage';
import { storage } from '../utils/storage';
import { addMemory } from '../utils/memoryStore';

export const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

// ── BroadcastChannel cross-tab sync ──────────────────────────────────────────
// Call this from useCycleLoop (or anywhere) to notify other open tabs.
export function broadcastCycleEvent(
  type: 'cycle-started' | 'cycle-completed' | 'cycle-aborted',
  campaignId: string
): void {
  try {
    const channel = new BroadcastChannel('nomad-state');
    channel.postMessage({ type, payload: { campaignId } });
    channel.close();
  } catch {
    // BroadcastChannel not supported in this environment — silently ignore
  }
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [cycleMode] = useState<CycleMode>('full');
  const [isLoaded, setIsLoaded] = useState(false); // true once initial load from IndexedDB is done

  // Generation counter — incremented on every cycle start or abort.
  // Async callbacks that close over this value can bail if it has changed.
  const [cycleGeneration, setCycleGeneration] = useState(0);
  const incrementCycleGeneration = useCallback(() => {
    setCycleGeneration(g => g + 1);
  }, []);

  // Tracks whether the mount effect already loaded cycles for the current campaign
  // so the secondary loadCycles effect doesn't fire a redundant second IndexedDB fetch.
  const initialCyclesLoadedRef = useRef(false);

  // Interactive question system
  const [pendingQuestion, setPendingQuestion] = useState<UserQuestion | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<UserQuestionAnswer[]>([]);
  const questionResolverRef = useRef<((answer: string) => void) | null>(null);

  // Called by QuestionModal when user picks an answer
  const answerQuestion = useCallback((answer: string) => {
    if (pendingQuestion && questionResolverRef.current) {
      // Record the answer
      setQuestionAnswers(prev => [...prev, {
        questionId: pendingQuestion.id,
        answer,
        checkpoint: pendingQuestion.checkpoint,
      }]);
      // Resolve the promise so the pipeline continues
      questionResolverRef.current(answer);
      questionResolverRef.current = null;
      setPendingQuestion(null);
    }
  }, [pendingQuestion]);

  // Called by useCycleLoop to show a question and wait for answer
  const askUser = useCallback((question: UserQuestion): Promise<string> => {
    return new Promise<string>((resolve) => {
      questionResolverRef.current = resolve;
      setPendingQuestion(question);
    });
  }, []);

  const {
    isRunning,
    currentCycle: cycleLoopCycle,
    error: cycleError,
    start,
    stop,
  } = useCycleLoop(askUser);

  const { saveCampaign, saveCycle, getCyclesByCampaign, getAllCampaigns } = useStorage();

  // Reload most-recent campaign + its cycles from IndexedDB.
  // Called on mount and when BroadcastChannel notifies us another tab changed state.
  const loadCampaignsFromStorage = useCallback(async () => {
    try {
      const allCampaigns = await getAllCampaigns();
      if (allCampaigns.length > 0) {
        const sorted = allCampaigns.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setCampaign(sorted[0]);
        const campaignCycles = await getCyclesByCampaign(sorted[0].id);
        setCycles(campaignCycles);
      }
    } catch (err) {
      console.error('[CampaignContext] Failed to reload campaigns from storage:', err);
    }
  }, [getAllCampaigns, getCyclesByCampaign]);

  // ── BroadcastChannel: listen for cycle events from other tabs ───────────────
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('nomad-state');
      channel.onmessage = (event: MessageEvent) => {
        const { type } = event.data as { type: string; payload?: unknown };
        if (type === 'cycle-started' || type === 'cycle-completed' || type === 'cycle-aborted') {
          // Another tab changed cycle state — reload campaigns + cycles from storage
          loadCampaignsFromStorage();
        }
      };
    } catch {
      // BroadcastChannel not supported — skip
    }
    return () => {
      try { channel?.close(); } catch { /* ignore */ }
    };
  }, [loadCampaignsFromStorage]);

  // Load campaigns from IndexedDB on mount — do NOT auto-select default
  useEffect(() => {
    (async () => {
      try {
        const allCampaigns = await getAllCampaigns();
        // Load campaigns but don't auto-select one — start with blank state
        if (allCampaigns.length > 0) {
          // Campaigns are available but we start blank
          // User can select one from the conversation history
        }
      } catch (err) {
        console.error('Failed to load campaigns from storage:', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync cycle loop state to context
  useEffect(() => {
    setCurrentCycle(cycleLoopCycle);
  }, [cycleLoopCycle]);

  // When a cycle completes, save key research findings as memories
  const savedCycleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cycleLoopCycle || cycleLoopCycle.status !== 'complete') return;
    if (savedCycleIdRef.current === cycleLoopCycle.id) return;
    savedCycleIdRef.current = cycleLoopCycle.id;

    const findings = cycleLoopCycle.researchFindings;
    const brand = campaign?.brand || 'brand';

    if (findings) {
      const desireSummary = findings.deepDesires?.length
        ? findings.deepDesires.slice(0, 3).map(d => `${d.targetSegment}: "${d.deepestDesire}"`).join('; ')
        : null;
      if (desireSummary) {
        addMemory('research', `[${brand}] Deep desires — ${desireSummary}`, [brand, 'desires', 'research']);
      }

      if (findings.rootCauseMechanism?.ahaInsight) {
        addMemory('research', `[${brand}] AHA insight — ${findings.rootCauseMechanism.ahaInsight}`, [brand, 'mechanism', 'insight']);
      }

      const objections = findings.objections?.slice(0, 3).map(o => o.objection).join('; ');
      if (objections) {
        addMemory('research', `[${brand}] Key objections — ${objections}`, [brand, 'objections']);
      }
    }

    const verdict = cycleLoopCycle.testVerdict;
    if (verdict?.winner) {
      addMemory('campaign', `[${brand}] Winning concept: "${verdict.winner}". Next cycle: ${verdict.nextCycleImprovement || 'N/A'}`, [brand, 'test', 'winner']);
    }
  }, [cycleLoopCycle, campaign?.brand]);

  const createCampaign = useCallback(
    async (
      brand: string,
      targetAudience: string,
      marketingGoal: string,
      productDescription: string,
      productFeatures: string[],
      productPrice?: string,
      researchMode: 'interactive' | 'autonomous' = 'autonomous',
      maxResearchIterations?: number,
      maxResearchTimeMinutes?: number,
      brandColors?: string,
      brandFonts?: string,
      brandDNA?: Record<string, string>,
      presetData?: Record<string, any>
    ) => {
      // Pull defaults from localStorage (set in Settings), fallback to hardcoded
      const savedIter = localStorage.getItem('max_research_iterations');
      const savedTime = localStorage.getItem('max_research_time_minutes');
      const finalIterations = maxResearchIterations ?? (savedIter ? parseInt(savedIter) : 15);
      const finalTime = maxResearchTimeMinutes ?? (savedTime ? parseInt(savedTime) : 45);

      // Stop any running cycle from previous campaign
      stop();

      const newCampaign: Campaign = {
        id: `campaign-${Date.now()}`,
        brand,
        targetAudience,
        marketingGoal,
        productDescription,
        productFeatures,
        productPrice,
        researchMode,
        maxResearchIterations: finalIterations,
        maxResearchTimeMinutes: finalTime,
        currentCycle: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        brandColors,
        brandFonts,
        brandDNA,
        presetData,
      };

      await saveCampaign(newCampaign);
      setCampaign(newCampaign);
      setCycles([]);
      setCurrentCycle(null);
    },
    [saveCampaign, stop]
  );

  const updateCampaign = useCallback(async (updates: Partial<Campaign>) => {
    if (!campaign) return;
    const updated = { ...campaign, ...updates, updatedAt: Date.now() };
    await saveCampaign(updated);
    setCampaign(updated);
  }, [campaign, saveCampaign]);

  const clearCampaign = useCallback(() => {
    stop();
    setCampaign(null);
    setCycles([]);
    setCurrentCycle(null);
  }, [stop]);

  // Reset research — delete all cycles for the current campaign, keep campaign itself
  const resetResearch = useCallback(async () => {
    if (!campaign) return;
    stop();
    await storage.deleteCyclesForCampaign(campaign.id);
    setCycles([]);
    setCurrentCycle(null);
  }, [campaign, stop]);

  const startCycle = useCallback(async (mode: CycleMode = cycleMode) => {
    if (!campaign) return;
    await start(campaign, campaign.currentCycle, mode);
  }, [campaign, start, cycleMode]);

  const stopCycle = useCallback(() => {
    stop();
  }, [stop]);

  // Bug fix: completeStage previously closed over `currentCycle` from React
  // state, which lags the live in-progress cycle tracked by useCycleLoop's
  // ref.  The stage data we want to persist is whatever the caller passes in
  // via `output` — we don't need the live cycle object here, only the id from
  // the state snapshot is used as the key to IndexedDB.  The spread is safe
  // because this is only called externally (not mid-pipeline).
  const completeStage = useCallback(
    async (stageName: StageName, output: string) => {
      if (!currentCycle) return;
      const updated = { ...currentCycle };
      updated.stages[stageName] = {
        ...updated.stages[stageName],
        agentOutput: output,
      };
      await saveCycle(updated);
      setCurrentCycle(updated);
    },
    [currentCycle, saveCycle]
  );

  const loadCycles = useCallback(async () => {
    if (!campaign) return;
    const loadedCycles = await getCyclesByCampaign(campaign.id);
    setCycles(loadedCycles);
  }, [campaign, getCyclesByCampaign]);

  // Load cycles when campaign changes (but skip the first time if the mount
  // effect already fetched cycles for this campaign to avoid a double-read).
  useEffect(() => {
    if (initialCyclesLoadedRef.current) {
      // Consume the flag — subsequent campaign changes must re-fetch normally
      initialCyclesLoadedRef.current = false;
      return;
    }
    loadCycles();
  }, [campaign, loadCycles]);

  // Load an existing campaign by ID (used when selecting a preset that already has a campaign)
  const loadCampaignById = useCallback(async (id: string) => {
    const existing = await storage.getCampaign(id);
    if (existing) {
      stop();
      setCampaign(existing);
      const campaignCycles = await getCyclesByCampaign(existing.id);
      setCycles(campaignCycles);
      setCurrentCycle(null);
    }
  }, [stop, getCyclesByCampaign]);

  // Phase 1: Build variable context from campaign state
  const variableContext = useMemo(() => ({
    context: {
      MODEL: localStorage.getItem('selected_model') || 'qwen3.5:4b',
      STAGE: currentCycle?.stages ? Object.keys(currentCycle.stages)[0] : undefined,
      CYCLE: campaign?.currentCycle || undefined,
      TIMESTAMP: new Date().toISOString(),
      TOKENS_USED: 0, // Would be tracked from session
      RESEARCH_DEPTH: localStorage.getItem('research_depth') || 'NR',
      MODE: localStorage.getItem('mode') || 'pro',
      MEMORY_COUNT: 0, // Would be populated from memoryStore
      CANVAS_ITEMS: 0, // Would be populated from storage
    },
  }), [currentCycle?.stages, campaign?.currentCycle]);

  // Memoize the context value so the object reference only changes when one of
  // its fields actually changes.  Without this, every CampaignProvider render
  // (triggered by streaming token throttle updates) would create a new object
  // and force every consumer component to re-render unnecessarily.
  const value: CampaignContextType = useMemo(() => ({
    campaign,
    cycles,
    currentCycle,
    isLoaded,
    systemStatus: isRunning ? 'running' : 'idle',
    error: cycleError,
    cycleGeneration,
    incrementCycleGeneration,
    pendingQuestion,
    questionAnswers,
    answerQuestion,
    variableContext,
    createCampaign,
    updateCampaign,
    startCycle,
    stopCycle,
    completeStage,
    setCampaign,
    clearCampaign,
    resetResearch,
    loadCampaignById,
  }), [
    campaign,
    cycles,
    currentCycle,
    isLoaded,
    isRunning,
    cycleError,
    cycleGeneration,
    incrementCycleGeneration,
    pendingQuestion,
    questionAnswers,
    answerQuestion,
    variableContext,
    createCampaign,
    updateCampaign,
    startCycle,
    stopCycle,
    completeStage,
    setCampaign,
    clearCampaign,
    resetResearch,
    loadCampaignById,
  ]);

  return (
    <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
  );
}

export function useCampaign(): CampaignContextType {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaign must be used within CampaignProvider');
  }
  return context;
}
