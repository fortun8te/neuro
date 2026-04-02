import { useState, useCallback, useEffect, useRef } from 'react';
import type { Campaign, Cycle, StageName, StageData, CycleMode, UserQuestion, QuestionCheckpoint } from '../types';
import type { ResearchPauseEvent } from '../utils/researchAgents';
import { RingBuffer } from '../utils/ringBuffer';
import { useOllama } from './useOllama';
import { useStorage } from './useStorage';
import { useOrchestratedResearch } from './useOrchestratedResearch';
import { getSystemPrompt, getCheckpointQuestionPrompt } from '../utils/prompts';
import { getModelForStage } from '../utils/modelConfig';
import { playSound, startSoundLoop, stopSoundLoop } from './useSoundEngine';
import { generateResearchReport } from '../utils/reportGenerator';
import { visualProgressStore } from '../utils/visualProgressStore';
import { tokenTracker } from '../utils/tokenStats';
import { ollamaService } from '../utils/ollama';
import { getRelevantMemories, getCrystallizedMemories, touchMemory } from '../utils/memoryStore';
<<<<<<< HEAD:frontend/hooks/useCycleLoop.ts
=======
import { consolidateCycleMemories, generateSkillInjectionPrompt } from '../utils/memoryAgent';
import { ContextBridgeValidator } from '../utils/multiPhaseContextBridge';
>>>>>>> 5e8b1b9 (Fix NEURO benchmark timeouts and tool_calls tracking):src/hooks/useCycleLoop.ts
import { set, get, del } from 'idb-keyval';
import { autonomyManager, selfImprovementAgent, proactiveMonitor, type CycleMetrics } from '../utils/autonomyEngine';
import { storage } from '../utils/storage';
<<<<<<< HEAD:frontend/hooks/useCycleLoop.ts
=======
import {
  withTimeout,
  STAGE_TIMEOUTS,
  TimeoutError,
  isTimeoutPyramidEnabled,
  getGracefulDegradationStrategy,
  logTimeoutEvent
} from '../utils/stageTimeouts';
import { runAdvancedMakeStage, type FinalConcept } from '../utils/advancedMakeStage';
import { runAdvancedTestStage, type AdvancedTestOutput } from '../utils/advancedTestStage';
import { polishConceptForProduction, type ProductionReadyConcept } from '../utils/adConceptPolisher';
import { enforceCreativeDirection, type TasteDirection } from '../utils/creativeDirectionEnforcer';
import { TimeoutManager, globalTimeoutManager } from '../utils/aggressiveTimeouts';
import { CrashRecoveryManager, globalCrashRecoveryManager } from '../utils/crashRecoveryManager';
import { processWatchdog } from '../utils/processWatchdog';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { MetricsCalculator } from '../q3BenchmarkMetrics';
import { BenchmarkReportGenerator } from '../q3BenchmarkReport';
import {
  evaluateStageAndDecideRetry,
  initializeQualityControl,
  getQualitySession,
} from '../utils/qualityControlIntegration';
>>>>>>> 5e8b1b9 (Fix NEURO benchmark timeouts and tool_calls tracking):src/hooks/useCycleLoop.ts


const FULL_STAGE_ORDER: StageName[] = ['research', 'brand-dna', 'persona-dna', 'angles', 'strategy', 'copywriting', 'production', 'test'];
const CONCEPTING_STAGE_ORDER: StageName[] = ['research', 'brand-dna', 'persona-dna', 'angles'];
const STAGE_DELAY = 500; // 500ms delay between stages (snappy)

/** Timeout for the Ollama preflight check (ms) */
const OLLAMA_PREFLIGHT_TIMEOUT = 8000;

function getStageOrder(mode: CycleMode): StageName[] {
  return mode === 'concepting' ? CONCEPTING_STAGE_ORDER : FULL_STAGE_ORDER;
}

// Helper to create a cycle with new object references (important for React state updates)
function refreshCycleReference(cycle: Cycle): Cycle {
  return {
    ...cycle,
    stages: { ...cycle.stages },
  };
}

function createEmptyStage(): StageData {
  return {
    status: 'pending',
    agentOutput: '',
    artifacts: [],
    startedAt: null,
    completedAt: null,
    readyForNext: false,
  };
}

function createCycle(campaignId: string, cycleNumber: number, mode: CycleMode = 'full'): Cycle {
  const stageOrder = getStageOrder(mode);
  const stages = {} as Record<StageName, StageData>;
  for (const name of FULL_STAGE_ORDER) {
    stages[name] = createEmptyStage();
  }

  // Fetch memories — decay-scored, best first (campaign tags not known yet; filtered at inject time)
  const priorMemories = getRelevantMemories(15);

  return {
    id: `${campaignId}-cycle-${cycleNumber}`,
    campaignId,
    cycleNumber,
    startedAt: Date.now(),
    completedAt: null,
    stages,
    currentStage: stageOrder[0],
    status: 'in-progress',
    mode,
    priorMemories: priorMemories.map(m => ({
      id: m.id,
      content: m.content,
      tags: m.tags,
    })),
  };
}

/** Check if an error is an abort/cancel — not a real failure */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('aborted') || msg.includes('abort') || msg.includes('signal');
  }
  return false;
}

/** Preflight: verify Ollama is reachable before starting the pipeline.
 *  Returns true if reachable, false otherwise. Uses a short timeout.
 *  Note: ollamaService.checkConnection() already applies an internal
 *  AbortSignal.timeout(8000), so no additional timer is needed here. */
async function checkOllamaReachable(_timeoutMs = OLLAMA_PREFLIGHT_TIMEOUT): Promise<boolean> {
  try {
    return await ollamaService.checkConnection();
  } catch (e) {
    console.warn('[useCycleLoop] Preflight check failed:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

// ── Stage checkpoint helpers (idb-keyval) ────────────────────────────────────
// Checkpoints let the cycle survive a page reload. They are saved after each
// stage completes and cleared when the full cycle finishes cleanly.

interface CycleCheckpoint {
  cycleId: string;
  lastCompletedStage: string;
  stageOutputs: Record<string, string>;
  savedAt: number;
}

async function saveCheckpoint(
  cycleId: string,
  lastCompletedStage: string,
  stageOutputs: Record<string, string>
): Promise<void> {
  try {
    await set(`checkpoint:${cycleId}`, {
      cycleId,
      lastCompletedStage,
      stageOutputs,
      savedAt: Date.now(),
    } satisfies CycleCheckpoint);
  } catch (e) {
    console.debug('[checkpoint] Save failed (non-critical):', e instanceof Error ? e.message : String(e));
  }
}

async function clearCheckpoint(cycleId: string): Promise<void> {
  try {
    await del(`checkpoint:${cycleId}`);
  } catch (e) {
    console.debug('[checkpoint] Clear failed (non-critical):', e instanceof Error ? e.message : String(e));
  }
}

async function loadCheckpoint(cycleId: string): Promise<CycleCheckpoint | null> {
  try {
    const cp = await get<CycleCheckpoint>(`checkpoint:${cycleId}`);
    return cp ?? null;
  } catch (e) {
    console.debug('[checkpoint] Load failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export function useCycleLoop(askUser?: (question: UserQuestion) => Promise<string>) {
  const { generate } = useOllama();
  const { executeOrchestratedResearch } = useOrchestratedResearch();
  const { saveCycle, updateCycle } = useStorage();

  const [isRunning, setIsRunning] = useState(false);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef<Cycle | null>(null);
  const isRunningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userAnswersRef = useRef<Record<string, string>>({});
  // Monotonically increasing counter — incremented each time a cycle starts or
  // is aborted. Async callbacks close over `myGeneration` and bail early when
  // this ref has moved on, preventing stale writes from a previous run.
  const cycleGenerationRef = useRef(0);

  // Throttle React state updates to prevent UI freeze from per-token re-renders
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCycleRef = useRef<Cycle | null>(null);
  const throttledSetCycle = useCallback((cycle: Cycle) => {
    latestCycleRef.current = cycle; // always store the latest
    const now = Date.now();
    // 80ms throttle — matches tokenStats for smooth live streaming
    if (now - lastUpdateRef.current >= 80) {
      lastUpdateRef.current = now;
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
      setCurrentCycle(refreshCycleReference(cycle));
    } else if (!pendingUpdateRef.current) {
      pendingUpdateRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        pendingUpdateRef.current = null;
        setCurrentCycle(refreshCycleReference(latestCycleRef.current!));
      }, 80);
    }
  }, []);

  // Check if interactive mode is enabled
  const isInteractive = (): boolean => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pipeline_mode') === 'interactive';
    }
    return false;
  };

  // Adapter: convert ResearchPauseEvent → askUser system for interactive research
  const handleResearchPauseForInput = useCallback(async (event: ResearchPauseEvent): Promise<string> => {
    if (!askUser) return 'Continue automatically';
    const question: UserQuestion = {
      id: `research-q-${Date.now()}`,
      question: event.question,
      options: event.suggestedAnswers || ['Continue automatically', 'Focus deeper on this area', 'Skip this angle'],
      checkpoint: 'mid-pipeline' as QuestionCheckpoint,
      context: event.context,
    };
    return askUser(question);
  }, [askUser]);

  // Generate a question using LLM and wait for user answer
  const askCheckpointQuestion = useCallback(async (
    checkpoint: QuestionCheckpoint,
    campaign: Campaign,
    stageOutputs: Record<string, string>
  ): Promise<string | null> => {
    if (!isInteractive() || !askUser) return null;

    try {
      const brief = `Brand: ${campaign.brand}\nAudience: ${campaign.targetAudience}\nGoal: ${campaign.marketingGoal}\nProduct: ${campaign.productDescription}\nFeatures: ${campaign.productFeatures.join(', ')}\nPrice: ${campaign.productPrice || 'N/A'}`;

      const { system, prompt } = getCheckpointQuestionPrompt(checkpoint, brief, stageOutputs);

      // Generate question using LLM
      const response = await generate(prompt, system, {
        model: getModelForStage('research'),
        signal: abortControllerRef.current?.signal,
      });

      // Parse JSON response
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 3) {
        console.warn('Invalid question format from LLM:', parsed);
        return null;
      }

      // Create the question object
      const question: UserQuestion = {
        id: `q-${checkpoint}-${Date.now()}`,
        question: parsed.question,
        options: parsed.options.slice(0, 3),
        checkpoint,
        context: parsed.context || undefined,
      };

      // Show question and wait for answer
      const answer = await askUser(question);
      userAnswersRef.current[checkpoint] = answer;
      return answer;
    } catch (err) {
      console.warn('Question generation failed, continuing without input:', err);
      return null;
    }
  }, [askUser, generate]);

  // Execute a single stage
  const executeStage = useCallback(
    async (cycle: Cycle, stageName: StageName, campaign: Campaign, signal: AbortSignal) => {
      // Check abort before starting
      if (signal.aborted) {
        throw new DOMException('Stage aborted before start', 'AbortError');
      }

      try {
        const stage = cycle.stages[stageName];

        // If resuming a previously stopped/aborted stage, clear partial output to avoid duplicates
        if ((stage.status === 'in-progress' || stage.status === 'stopped') && stage.agentOutput) {
          stage.agentOutput = '';
          if (!stage._ringBuffer) {
            stage._ringBuffer = new RingBuffer(2_000_000);
          } else {
            stage._ringBuffer.clear();
          }
        }

        stage.status = 'in-progress';
        stage.startedAt = Date.now();

        // Start thinking sound loop
        startSoundLoop('thinking');

        setCurrentCycle(refreshCycleReference(cycle));

        // Build prompt based on stage and previous outputs
        let result = '';
        const systemPrompt = getSystemPrompt(stageName);

        if (stageName === 'research') {
          // Orchestrated research: Desire-Driven Analysis + Web Search Researchers
          const RESEARCH_OUTPUT_CAP = 2_000_000; // 2MB rolling cap — avoids O(n²) concat on MX preset

          // Dual-hook before inject: pull campaign-relevant memories + crystallized learnings
          // Filter by campaign tags for mem0-style relevance scoring
          const campaignTags = [
            campaign.brand?.toLowerCase(),
            ...(campaign.productDescription?.toLowerCase().split(/\s+/).slice(0, 5) || []),
          ].filter(Boolean) as string[];
          const relevantMems = getRelevantMemories(12, campaignTags);
          const crystallized = getCrystallizedMemories();

          // Touch (reinforce) each injected memory so frequently-used ones score higher
          relevantMems.forEach(m => touchMemory(m.id));

          if (crystallized.length > 0 || relevantMems.length > 0) {
            let memBlock = '\n[MEMORY INPUT] Learnings from previous cycles:\n';
            if (crystallized.length > 0) {
              memBlock += '  [Crystallized patterns — high confidence]\n';
              crystallized.forEach(m => { memBlock += `  ★ ${m.content}\n`; });
            }
            relevantMems.forEach(m => { memBlock += `  • ${m.content} [${m.tags.join(', ')}]\n`; });
            stage.agentOutput = memBlock + stage.agentOutput;
            // Update cycle.priorMemories to reflect the filtered set actually used
            cycle.priorMemories = relevantMems.map(m => ({ id: m.id, content: m.content, tags: m.tags }));
            throttledSetCycle(cycle);
          }

          const researchResult = await executeOrchestratedResearch(
            campaign,
            (msg) => {
              if (!stage._ringBuffer) {
                stage._ringBuffer = new RingBuffer(RESEARCH_OUTPUT_CAP);
              }
              stage._ringBuffer.append(msg + '\n');
              stage.agentOutput = stage._ringBuffer.toString();
              throttledSetCycle(cycle);
            },
            true, // Enable web search orchestration
            campaign.researchMode === 'interactive' ? handleResearchPauseForInput : undefined,
            signal,
            cycle.priorMemories // Pass memories to research agents
          );

          result = researchResult.processedOutput;
          stage.rawOutput = researchResult.rawOutput;
          stage.model = researchResult.model;
          stage.processingTime = researchResult.processingTime;

          // Capture research findings for downstream stages
          cycle.researchFindings = researchResult.researchFindings;

          // Generate research report (mini research paper)
          if (!signal.aborted) {
            try {
              const report = await generateResearchReport(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                cycle.researchFindings || ({} as any),
                cycle.researchFindings?.auditTrail,
                researchResult.rawOutput?.slice(0, 12000) || '',
                signal,
                (msg) => {
                  if (!stage._ringBuffer) {
                    stage._ringBuffer = new RingBuffer(RESEARCH_OUTPUT_CAP);
                  }
                  stage._ringBuffer.append(msg);
                  stage.agentOutput = stage._ringBuffer.toString();
                  throttledSetCycle(cycle);
                }
              );
              if (cycle.researchFindings) {
                cycle.researchFindings.researchReport = report;
              }
            } catch (reportErr) {
              if (isAbortError(reportErr)) throw reportErr;
              // Report generation is non-critical — don't fail the pipeline
              console.warn('Report generation failed:', reportErr);
              stage.agentOutput += '\n[REPORT] Generation failed — continuing pipeline\n';
            }
          }
        } else {
          // ── All non-research stages: generate with stage-specific prompt ──
          const modelForStage = getModelForStage(stageName);
          let prompt = '';

          if (stageName === 'brand-dna') {
            // Brand DNA: LLM drafts brand identity from research findings
            const findings = cycle.researchFindings;
            const hasFindings = findings && (findings.deepDesires?.length > 0 || findings.competitorWeaknesses?.length > 0);
            prompt = `You are a brand strategist. Based on the research findings below, draft a comprehensive Brand DNA document for ${campaign.brand}.

RESEARCH CONTEXT:
${hasFindings ? `Deep Desires: ${(findings.deepDesires || []).map(d => `${d.targetSegment}: "${d.deepestDesire}"`).join(', ') || 'Not yet identified'}
Competitor Weaknesses: ${(findings.competitorWeaknesses || []).join(', ') || 'Not yet identified'}
Market Sophistication: Level ${findings.marketSophistication || 3}` : cycle.stages.research.agentOutput?.slice(0, 2000) || 'Research produced limited findings. Generate based on campaign brief.'}

Product: ${campaign.productDescription}
Features: ${campaign.productFeatures.join(', ')}

Draft the Brand DNA:
§ BRAND IDENTITY
Name, tagline, mission, core values

§ VOICE & PERSONALITY
Tone of voice, personality traits, how the brand speaks

§ POSITIONING
Where this brand sits vs competitors, what gap it owns

§ VISUAL IDENTITY
Recommended colors (hex), fonts, mood keywords, logo direction

§ DIFFERENTIATORS
What makes this brand impossible to copy

Be specific and strategic. Every choice should connect back to the research insights.`;

          } else if (stageName === 'persona-dna') {
            // Persona DNA: LLM drafts detailed customer personas
            const findings = cycle.researchFindings;
            const hasFindings = findings && (findings.deepDesires?.length > 0 || findings.objections?.length > 0);
            prompt = `You are a customer research specialist. Based on the research findings, create 2-3 detailed customer personas for ${campaign.brand}.

RESEARCH CONTEXT:
${hasFindings ? `Deep Desires: ${(findings.deepDesires || []).map(d => `${d.targetSegment}: "${d.deepestDesire}" (${d.desireIntensity})`).join('\n') || 'Not yet identified'}
Objections: ${(findings.objections || []).map(o => o.objection).join(', ') || 'Not yet identified'}
Avatar Language: ${findings.avatarLanguage?.slice(0, 5).join(', ') || 'N/A'}
What They Tried Before: ${findings.whatTheyTriedBefore?.join(', ') || 'N/A'}` : cycle.stages.research.agentOutput?.slice(0, 2000) || 'Research produced limited findings. Generate based on campaign brief.'}

${cycle.brandDNA ? `Brand DNA: ${cycle.brandDNA.name} — ${cycle.brandDNA.positioning}` : ''}

For EACH persona, provide:
§ PERSONA [number]: [Name, age, role]
Demographics, psychographics, pain points, desires, language they use, objections, media habits, buying triggers, and a "day in the life" narrative.

Make them feel like REAL people, not marketing abstractions. Use specific details and actual language patterns from the research.`;

          } else if (stageName === 'angles') {
            // Angles: Tiered brainstorm — generate many, then rank
            const findings = cycle.researchFindings;
            const hasFindings = findings && (findings.deepDesires?.length > 0 || findings.objections?.length > 0);
            prompt = `You are a creative director brainstorming ad angles for ${campaign.brand}.

RESEARCH CONTEXT:
${hasFindings ? `Deep Desires: ${(findings.deepDesires || []).map(d => `- ${d.targetSegment}: "${d.deepestDesire}"`).join('\n') || 'Not yet identified'}
Root Cause: ${findings.rootCauseMechanism?.rootCause || 'N/A'}
Mechanism: ${findings.rootCauseMechanism?.mechanism || 'N/A'}
AHA Insight: "${findings.rootCauseMechanism?.ahaInsight || 'N/A'}"
Objections: ${(findings.objections || []).map(o => o.objection).join(', ') || 'Not yet identified'}` : 'Research produced limited findings. Generate creative angles based on campaign brief.'}

${cycle.brandDNA ? `Brand: ${cycle.brandDNA.name} — ${cycle.brandDNA.positioning}\nVoice: ${cycle.brandDNA.voiceTone}` : ''}
${cycle.personas ? `Personas: ${cycle.personas.map(p => p.name).join(', ')}` : ''}

Generate 30+ ad angle ideas. For each:
- HOOK: 1-line angle summary (the ad concept in one sentence)
- TYPE: desire / objection / social-proof / mechanism / contrast / story / urgency / identity
- TARGET PERSONA: which persona this targets
- EMOTIONAL LEVER: what emotion drives this angle
- RATIONALE: why this angle will work
- STRENGTH: 1-10 rating

Then RANK the top 15 by strength. Be creative, be bold, think from the customer's perspective — not the brand's.`;

          } else if (stageName === 'strategy') {
            // Strategy: Creative Strategy — Bridge Framework
            const findings = cycle.researchFindings;
            prompt = `You are a creative strategist building a comprehensive Creative Strategy for ${campaign.brand}.

Your job: synthesize ALL research into the "Bridge Framework" — mapping the customer's CURRENT STATE through the PRODUCT (bridge) to their DESIRED STATE and IDEAL LIFE.

=== RESEARCH INPUT ===
${findings?.deepDesires?.length ? `DEEP DESIRES:\n${findings.deepDesires.map(d => `- Surface: "${d.surfaceProblem}" → Deepest: "${d.deepestDesire}" (${d.desireIntensity}) [${d.targetSegment}]`).join('\n')}` : ''}
${findings?.objections?.length ? `\nOBJECTIONS:\n${findings.objections.map(o => `- "${o.objection}" (${o.frequency}, ${o.impact} impact)`).join('\n')}` : ''}
${findings?.whatTheyTriedBefore ? `\nWHAT THEY TRIED BEFORE:\n${findings.whatTheyTriedBefore.map(t => `- ${t}`).join('\n')}` : ''}
${findings?.rootCauseMechanism ? `\nROOT CAUSE MECHANISM:\n- AHA: "${findings.rootCauseMechanism.ahaInsight}"\n- Mechanism: "${findings.rootCauseMechanism.mechanism}"` : ''}
${findings?.verbatimQuotes ? `\nVERBATIM QUOTES:\n${findings.verbatimQuotes.slice(0, 8).map(q => `- "${q}"`).join('\n')}` : ''}
${findings?.avatarLanguage ? `\nAUDIENCE LANGUAGE:\n${findings.avatarLanguage.slice(0, 10).map(l => `- "${l}"`).join('\n')}` : ''}
${findings ? `\nMARKET SOPHISTICATION: Level ${findings.marketSophistication || 3}` : ''}
${cycle.brandDNA ? `\nBRAND: ${cycle.brandDNA.name} — ${cycle.brandDNA.positioning}\nVoice: ${cycle.brandDNA.voiceTone}` : ''}
${cycle.personas ? `\nPERSONAS:\n${cycle.personas.map(p => `- ${p.name}: desires [${p.desires.slice(0, 2).join(', ')}], pains [${p.painPoints.slice(0, 2).join(', ')}]`).join('\n')}` : ''}
${cycle.angles ? `\nTOP ANGLES:\n${cycle.angles.filter(a => a.selected || a.strength >= 7).slice(0, 8).map(a => `- "${a.hook}" (${a.type}, strength: ${a.strength})`).join('\n')}` : ''}

PRODUCT: ${campaign.productDescription}
FEATURES: ${campaign.productFeatures.join(', ')}

=== OUTPUT FORMAT ===
Respond with ONLY valid JSON matching this exact structure:
{
  "currentState": {
    "painPoints": ["specific pain 1", "specific pain 2", ...],
    "frustrations": ["frustration 1", "frustration 2", ...],
    "triedBefore": ["solution 1", "solution 2", ...],
    "emotionalState": "one sentence describing their emotional reality"
  },
  "bridge": {
    "mechanism": "the unique mechanism that makes this product work",
    "uniqueAngle": "what makes this product different from everything else",
    "proofPoints": ["proof 1", "proof 2", ...]
  },
  "desiredState": {
    "desires": ["desire 1", "desire 2", ...],
    "transformation": "the before→after transformation story in 2-3 sentences",
    "turningPoints": ["turning point 1", "turning point 2", ...]
  },
  "idealLife": {
    "vision": "what their life looks like when the desire is fully satisfied",
    "identity": "who they become — the identity shift"
  },
  "messaging": {
    "headlines": ["headline 1", "headline 2", "headline 3", "headline 4", "headline 5"],
    "proofHierarchy": ["strongest proof first", "second strongest", ...],
    "conversationStarters": ["hook 1", "hook 2", "hook 3"],
    "toneAndVoice": "describe the exact tone and voice to use"
  },
  "awarenessLevel": "unaware|problem-aware|solution-aware|product-aware|most-aware",
  "positioningStatement": "one powerful positioning statement"
}

Be specific. Use the customer's actual language from the research. No generic marketing speak.`;

          } else if (stageName === 'copywriting') {
            // Copywriting: Create messaging per angle
            const findings = cycle.researchFindings;
            prompt = `You are a direct response copywriter creating ad messaging for ${campaign.brand}.

${cycle.strategies ? `APPROVED ANGLES:\n${cycle.strategies.filter(s => s.feasibility !== 'low').map(s => `- Angle: ${s.angleId}\n  Plan: ${s.executionPlan}\n  Format: ${s.recommendedFormats.join(', ')}`).join('\n')}` : `STRATEGY:\n${cycle.stages.strategy.agentOutput?.slice(0, 2000) || 'No strategy available'}`}

${findings ? `Audience Language: ${findings.avatarLanguage?.slice(0, 5).map(l => `"${l}"`).join(', ') || 'N/A'}
Verbatim Quotes: ${findings.verbatimQuotes?.slice(0, 3).map(q => `"${q}"`).join(', ') || 'N/A'}` : ''}
${cycle.brandDNA ? `Brand Voice: ${cycle.brandDNA.voiceTone}\nPersonality: ${cycle.brandDNA.personality}` : ''}
${cycle.personas ? `Personas: ${cycle.personas.map(p => `${p.name} — desires: ${p.desires.slice(0, 2).join(', ')}`).join('; ')}` : ''}

For EACH approved angle, create 3 copy variations:
§ ANGLE: [angle name]
  VARIATION 1:
    Headline: [5-10 words, scroll-stopping]
    Subtext: [1-2 sentences expanding the hook]
    CTA: [action-oriented, desire-connected]
    Callouts: [3-4 bullet points of proof/benefits]
  VARIATION 2: [different emotional angle]
  VARIATION 3: [different format/tone]

Use THEIR language — not brand speak. Every word should feel like it came from the customer's mouth.`;

          } else if (stageName === 'production') {
            // PHASE 3: Advanced Make Stage with 5-pass refinement
            // Generates 15 variants → scores → filters to top 3 → polishes → generates A/B tests
            // Expected quality: 80-90/100

            const findings = cycle.researchFindings;
            const objectionOutput = cycle.stages['angles']?.agentOutput || 'Not yet available';
            const strategyContext = cycle.creativeStrategy
              ? `Positioning: ${cycle.creativeStrategy.positioningStatement || 'N/A'}\nTone: ${cycle.creativeStrategy.messaging?.toneAndVoice || 'N/A'}`
              : cycle.stages.strategy.agentOutput?.slice(0, 800) || 'No strategy available.';
            const copyContext = cycle.stages.copywriting.agentOutput?.slice(0, 1500) || 'No copy blocks available yet.';
            const brandContext = cycle.brandDNA ? `Brand: ${cycle.brandDNA.name}\nVoice: ${cycle.brandDNA.voiceTone}\nPositioning: ${cycle.brandDNA.positioning}` : `Brand: ${campaign.brand}`;

            const desireContext = findings?.deepDesires?.[0]?.deepestDesire || 'Transform customer life';
            const desireIntensity = findings?.deepDesires?.[0]?.desireIntensity || 'High';
            const proofMechanism = findings?.rootCauseMechanism?.ahaInsight || 'Scientifically proven mechanism';
            const audienceLanguage = findings?.avatarLanguage?.join(', ') || 'Customer language';
            const competitorLandscape = findings?.competitivePositioning?.map(p => p.structuralWeakness).join(', ') || 'Market gaps';

            stage.agentOutput = '[PHASE 3: ADVANCED MAKE STAGE]\n';
            throttledSetCycle(cycle);

            try {
              // Call advanced Make stage with all required parameters
              const makeResults = await runAdvancedMakeStage(
                {
                  brand: campaign.brand,
                  desireContext,
                  objectionContext: objectionOutput,
                  proofContext: proofMechanism,
                  copyBlocks: copyContext,
                  tone: cycle.creativeStrategy?.messaging?.toneAndVoice || 'Direct, compelling',
                  brandVoice: cycle.brandDNA?.voiceTone || 'Professional',
                  positioning: cycle.brandDNA?.positioning || 'Leader in category',
                  competitorLandscape,
                  audienceLanguage,
                  desireIntensity,
                  model: modelForStage,
                },
                signal,
                (passNumber, passName, data) => {
                  stage.agentOutput += `\n[PASS ${passNumber}: ${passName}]`;
                  if (data?.finals) {
                    stage.agentOutput += `\n✓ Generated ${data.finals.length} production-ready concepts`;
                  }
                  throttledSetCycle(cycle);
                }
              );

              // Store the advanced make results
              cycle.advancedMakeConcepts = makeResults;

              // Enforce taste direction validation
              stage.agentOutput += '\n\n[TASTE DIRECTION VALIDATION]\n';
              const taste: TasteDirection = {
                brandVoice: cycle.brandDNA?.voiceTone || 'Professional',
                brandTone: cycle.creativeStrategy?.messaging?.toneAndVoice || 'Direct, compelling',
                positioning: cycle.brandDNA?.positioning || 'Category leader',
                recommendedColors: cycle.brandDNA?.visualIdentity?.primaryColors || ['#000', '#FFF'],
                recommendedCopyAngles: cycle.creativeStrategy?.messaging?.headlines || ['benefit'],
                visualStyle: cycle.brandDNA?.visualIdentity?.moodKeywords?.join(', ') || 'Modern',
              };

              try {
                const validationResult = await enforceCreativeDirection(
                  makeResults.map(c => ({
                    name: c.conceptName,
                    headline: c.primaryConcept.polishedHeadline,
                    body: c.primaryConcept.polishedBody,
                    cta: c.primaryConcept.polishedCta,
                    angle: c.angle,
                  })),
                  taste,
                  modelForStage,
                  {
                    signal,
                    strictMode: false,
                  }
                );

                const avgCompliance = validationResult.complianceSummary.overallComplianceRate || 75;
                if (avgCompliance < 75) {
                  stage.agentOutput += `\n⚠ Concepts only ${Math.round(avgCompliance)}% aligned with taste direction`;
                } else {
                  stage.agentOutput += `\n✓ Concepts ${Math.round(avgCompliance)}% aligned with taste direction`;
                }
              } catch (tasteErr) {
                console.warn('Taste validation failed:', tasteErr);
                stage.agentOutput += `\n⚠ Taste validation skipped (error in validation)`;
              }

              // Format output as text for agentOutput display
              stage.agentOutput += '\n\n[FINAL CONCEPTS]\n';
              for (const concept of makeResults) {
                stage.agentOutput += `\n§ ${concept.conceptName}: ${concept.angle}\n`;
                stage.agentOutput += `  HEADLINE: ${concept.primaryConcept.polishedHeadline}\n`;
                stage.agentOutput += `  BODY: ${concept.primaryConcept.polishedBody}\n`;
                stage.agentOutput += `  CTA: ${concept.primaryConcept.polishedCta}\n`;
                stage.agentOutput += `  SCORE: ${concept.finalScore}/100\n`;
              }

              throttledSetCycle(cycle);
            } catch (makeErr) {
              if (isAbortError(makeErr)) throw makeErr;
              stage.agentOutput += `\n❌ Advanced Make Stage failed: ${makeErr instanceof Error ? makeErr.message : 'Unknown error'}`;
              console.warn('Advanced Make Stage error:', makeErr);
              throw makeErr;
            }

            // Set result to empty string since we're managing agentOutput directly
            result = '';

          } else if (stageName === 'test') {
            // PHASE 3: Advanced Test Stage with 12-dimension evaluation
            // Evaluates all concepts across 12 dimensions → ranks → picks winner
            // Expected quality: 85+/100 winning concept

            const findings = cycle.researchFindings;
            const makeConcepts = cycle.advancedMakeConcepts || [];

            stage.agentOutput = '[PHASE 3: ADVANCED TEST STAGE]\n';
            throttledSetCycle(cycle);

            try {
              if (makeConcepts.length === 0) {
                throw new Error('No concepts from advanced Make stage — cannot proceed with advanced Test');
              }

              // Convert advanced make concepts to test format
              const conceptsToTest = makeConcepts.map((c: any, idx: number) => ({
                name: c.conceptName || `Concept ${idx + 1}`,
                headline: c.primaryConcept?.polishedHeadline || c.primaryConcept?.headline || 'TBD',
                body: c.primaryConcept?.polishedBody || c.primaryConcept?.body || 'TBD',
                cta: c.primaryConcept?.polishedCta || c.primaryConcept?.cta || 'TBD',
                angle: c.angle || 'Unknown',
              }));

              // Call advanced Test stage
              const testResults = await runAdvancedTestStage(
                conceptsToTest,
                {
                  brand: campaign.brand,
                  deepDesires: findings?.deepDesires?.map(d => d.deepestDesire).join(', ') || 'Not identified',
                  objections: findings?.objections?.map(o => o.objection).join(', ') || 'Not identified',
                  proofPoints: findings?.rootCauseMechanism?.ahaInsight || 'Not identified',
                  brandVoice: cycle.brandDNA?.voiceTone || 'Professional',
                  competitorLandscape: findings?.competitivePositioning?.map(p => p.name).join(', ') || 'Various',
                  audienceLanguage: findings?.avatarLanguage?.join(', ') || 'Customer terms',
                  marketSophistication: String(findings?.marketSophistication || 3),
                  marketPosition: findings?.competitivePositioning?.[0]?.positioning || 'Challenger',
                },
                modelForStage,
                signal,
                (conceptIndex, evaluation) => {
                  stage.agentOutput += `\n[CONCEPT ${conceptIndex + 1} EVALUATED]\n`;
                  stage.agentOutput += `  Overall Score: ${evaluation.overallScore}/100\n`;
                  stage.agentOutput += `  Verdict: ${evaluation.verdict}\n`;
                  throttledSetCycle(cycle);
                },
                (analysis) => {
                  stage.agentOutput += `\n[CROSS-CONCEPT ANALYSIS]\n`;
                  stage.agentOutput += `  ${analysis.summary || 'Analysis complete'}\n`;
                  throttledSetCycle(cycle);
                }
              );

              // Store advanced test results
              cycle.advancedTestOutput = testResults;

              // Polish the winning concept
              stage.agentOutput += '\n\n[FINAL POLISH]\n';
              const winningConcept = conceptsToTest.find(c => c.name === testResults.winner);
              if (winningConcept) {
                const polished = await polishConceptForProduction(
                  {
                    name: winningConcept.name,
                    angle: winningConcept.angle,
                    headline: winningConcept.headline,
                    body: winningConcept.body,
                    cta: winningConcept.cta,
                  },
                  {
                    brand: campaign.brand,
                    brandVoice: cycle.brandDNA?.voiceTone || 'Professional',
                    positioning: cycle.brandDNA?.positioning || 'Category leader',
                    corePromise: findings?.deepDesires?.[0]?.deepestDesire || 'Transform customer life',
                    proofContext: findings?.rootCauseMechanism?.ahaInsight || 'Proven mechanism',
                    desireContext: findings?.deepDesires?.[0]?.deepestDesire || 'Deep desire',
                    marketSophistication: String(findings?.marketSophistication || 3),
                    competitorLandscape: findings?.competitivePositioning?.map(p => p.name).join(', ') || 'Various',
                  },
                  modelForStage,
                  signal
                );

                cycle.polishedConcept = polished;
                stage.agentOutput += `✓ Polished concept ready for production\n`;
                stage.agentOutput += `  Polish Level: ${(polished as any).readinessLevel || 'production'}\n`;
                stage.agentOutput += `  Variations: ${(polished as any).variations.headlines.length} headlines, ${(polished as any).variations.bodyBlocks?.length || (polished as any).variations.bodies?.length || 2} bodies, ${(polished as any).variations.ctas.length} CTAs\n`;
              }

              // Format test output for display
              stage.agentOutput += '\n\n[TEST RESULTS]\n';
              stage.agentOutput += `Winner: ${testResults.winner}\n`;
              if (testResults.runnerUp) {
                stage.agentOutput += `Runner-up: ${testResults.runnerUp}\n`;
              }
              stage.agentOutput += `\n${testResults.summaryAnalysis}\n`;

              throttledSetCycle(cycle);
            } catch (testErr) {
              if (isAbortError(testErr)) throw testErr;
              stage.agentOutput += `\n❌ Advanced Test Stage failed: ${testErr instanceof Error ? testErr.message : 'Unknown error'}`;
              console.warn('Advanced Test Stage error:', testErr);
              throw testErr;
            }

            // Set result to empty string since we're managing agentOutput directly
            result = '';
          }

          // For production and test stages, skip standard generation (already handled above)
          if (stageName !== 'production' && stageName !== 'test') {
            // Generate using Ollama with stage-specific model — stream chunks live into agentOutput
            const stageStartTime = Date.now();
            const generatePromise = generate(prompt, systemPrompt, {
              model: modelForStage,
              signal,
              onChunk: (chunk) => {
                stage.agentOutput += chunk;
                throttledSetCycle(cycle);
              },
            });
            // Wrap with aggressive timeout
            result = await globalTimeoutManager.enforceRequestTimeout(
              generatePromise,
              `stage:${stageName}:generate`,
              30000,
              signal as unknown as AbortController,
            );

            // Capture metadata for this stage
            stage.model = modelForStage;
            stage.processingTime = Date.now() - stageStartTime;
            stage.rawOutput = result;
          }
        }

        // For research and production/test stages, keep the progressive output (agent thought process)
        // instead of overwriting with final synthesis
        if (stageName !== 'research' && stageName !== 'production' && stageName !== 'test') {
          stage.agentOutput = result;
        }
        // Store processedOutput separately for downstream stages
        stage.processedOutput = result;

        // Parse strategy stage JSON into structured CreativeStrategy
        if (stageName === 'strategy' && result) {
          try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              cycle.creativeStrategy = parsed;
            }
          } catch {
            // Strategy output wasn't valid JSON — keep raw text
            console.warn('Failed to parse creative strategy JSON');
          }
        }

        // Parse test stage JSON into structured TestVerdict
        if (stageName === 'test' && result) {
          try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.concepts && Array.isArray(parsed.concepts)) {
                cycle.testVerdict = parsed;
              }
            }
          } catch {
            // Test output wasn't valid JSON — keep raw text
            console.warn('Failed to parse test verdict JSON');
          }
        }

        // ── QUALITY GATE: Evaluate stage output ──
        try {
          const qualityConfig = {
            enableAutoRetry: localStorage.getItem('qualitySettings')
              ? JSON.parse(localStorage.getItem('qualitySettings')!).enableAutoRetry ?? true
              : true,
            maxRetries: localStorage.getItem('qualitySettings')
              ? JSON.parse(localStorage.getItem('qualitySettings')!).maxRetries ?? 3
              : 3,
            timeoutMinutes: localStorage.getItem('qualitySettings')
              ? JSON.parse(localStorage.getItem('qualitySettings')!).timeoutMinutes ?? 30
              : 30,
          };

          const evaluationResult = await evaluateStageAndDecideRetry(
            cycle,
            stageName,
            stage,
            campaign,
            qualityConfig,
          );

          const { evaluation, shouldRetry, retryConfig, reason } = evaluationResult;

          // Store evaluation in stage data
          stage.evaluation = evaluation;

          // Log quality evaluation
          console.log(
            `[Quality] ${stageName}: ${evaluation.severity} (${evaluation.overallScore}/100) - ${reason}`
          );

          // If retry needed and config available
          if (shouldRetry && retryConfig && signal && !signal.aborted) {
            console.log(`[Quality] Retrying ${stageName} with:`, {
              model: retryConfig.newModel,
              temperature: retryConfig.newTemperature,
              focus: retryConfig.promptModification.slice(0, 100) + '...',
            });

            // Clear partial output for fresh start
            stage.agentOutput = '';
            stage.status = 'in-progress';
            stage.startedAt = Date.now();
            stage.completedAt = null;

            // Reset token tracking
            tokenTracker.resetSession();

            // Re-execute stage with retry configuration
            // Note: This is a simplified retry; full implementation would rebuild the prompt
            // with feedback injection and re-run executeStageLogic
            const retryResult = await executeStage(cycle, stageName, campaign, signal);
            if (retryResult) {
              // Update with retry result
              stage.agentOutput = retryResult.agentOutput;
              stage.model = retryConfig.newModel;
              stage.processingTime = (stage.processingTime || 0) + (retryResult.processingTime || 0);
            }

            // Re-evaluate after retry
            const retryEvaluation = await evaluateStageAndDecideRetry(
              cycle,
              stageName,
              stage,
              campaign,
              { enableAutoRetry: false } // Don't retry again
            );
            console.log(
              `[Quality] Retry result: ${retryEvaluation.evaluation.severity} (${retryEvaluation.evaluation.overallScore}/100)`
            );
            stage.evaluation = retryEvaluation.evaluation;
          }
        } catch (qualityErr) {
          // Quality evaluation should not block stage progression
          console.warn('[Quality] Evaluation failed (non-blocking):', qualityErr);
        }

        stage.status = 'complete';
        stage.completedAt = Date.now();
        stage.readyForNext = true;

        // Stop thinking sound, play stage complete AHA
        stopSoundLoop('thinking');
        playSound('stageComplete');

        // Use refreshed reference to ensure React detects the change
        setCurrentCycle(refreshCycleReference(cycle));

        return stage;
      } catch (err) {
        stopSoundLoop('thinking');

        // On abort, mark stage as stopped (not error) — this is user-initiated
        if (isAbortError(err)) {
          const stage = cycle.stages[stageName];
          stage.status = 'stopped';
          stage.completedAt = Date.now();
          setCurrentCycle(refreshCycleReference(cycle));
          throw err; // re-throw so runCycle's catch handles it
        }

        playSound('error');
        const errMsg = err instanceof Error ? err.message : 'Stage execution failed';
        const msg = errMsg.includes('No response from model') || errMsg.includes('Failed to fetch') || errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch')
          ? "Can't reach Ollama — make sure it's running and check Settings > Connection"
          : errMsg;
        setError(msg);
        throw err;
      }
    },
    [generate, executeOrchestratedResearch, handleResearchPauseForInput, throttledSetCycle]
  );

  // Advance to next stage
  const advanceToNextStage = useCallback(
    (cycle: Cycle): { cycle: Cycle; done: boolean } => {
      const stageOrder = getStageOrder(cycle.mode);
      const currentIndex = stageOrder.indexOf(cycle.currentStage);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= stageOrder.length) {
        // Cycle complete
        cycle.status = 'complete';
        cycle.completedAt = Date.now();
        return { cycle, done: true };
      }

      cycle.currentStage = stageOrder[nextIndex];
      // Reset token state between stages to prevent thinking text bleed
      tokenTracker.resetSession();
      return { cycle, done: false };
    },
    []
  );

  // Abortable delay — resolves normally OR rejects if abort fires during the wait
  const abortableDelay = useCallback((ms: number, signal: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Delay aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      timeoutRef.current = timer;
      function onAbort() {
        clearTimeout(timer);
        timeoutRef.current = null;
        reject(new DOMException('Delay aborted', 'AbortError'));
      }
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }, []);

  // Main cycle loop
  const runCycle = useCallback(
    async (campaign: Campaign, startCycleNumber: number = 1, mode: CycleMode = 'full') => {
      // ── Increment generation counter — invalidates stale async callbacks ──
      cycleGenerationRef.current += 1;
      const myGeneration = cycleGenerationRef.current;

      // ── Preflight: check Ollama is reachable ──
      setError(null);
      setIsRunning(true); // Show immediate feedback
      isRunningRef.current = true;

      const reachable = await checkOllamaReachable();
      if (!reachable) {
        setError('Cannot reach Ollama. Check that Wayfarer proxy (port 8889) and Ollama are running.');
        setIsRunning(false);
        isRunningRef.current = false;
        return;
      }

      // ── Create a single AbortController for the entire run ──
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const signal = controller.signal;

      let cycleNumber = startCycleNumber;
      let cycle = createCycle(campaign.id, cycleNumber, mode);
      cycleRef.current = cycle;
      setCurrentCycle(refreshCycleReference(cycle));

      // Reset per-run stores
      userAnswersRef.current = {};
      visualProgressStore.reset();
      tokenTracker.resetSession();

      // ── QUALITY GATES: Initialize quality tracking ──
      initializeQualityControl(cycle.id);

      // ── AUTONOMY: Proactive decision-making ──
      try {
        const autonomousAction = await autonomyManager.decideNextAction(
          { currentStage: cycle.currentStage, status: cycle.status },
          {
            researchCoverage: 0, // Will be updated after research phase
            makeQuality: 0,
            avgTokensPerStage: {},
            totalTokensUsed: 0,
            cycleElapsedMs: 0,
            modelSwitchCount: 0,
          }
        );
        if (autonomousAction.action === 'pause-for-review') {
          console.log('[Autonomy] Autonomous pause recommended:', autonomousAction.reasoning);
          // Don't auto-pause; just log. User can review the message if needed.
        }
      } catch (autonomyErr) {
        console.warn('[Autonomy] Decision failed, continuing:', autonomyErr);
      }

      // ── Q3 Benchmark Mode (if enabled) ──
      const q3BenchmarkMode = import.meta.env.VITE_Q3_BENCHMARK_MODE === 'true';
      const benchmarkMetrics: Record<string, { tokens: number; duration: number }> = {};
      if (q3BenchmarkMode) {
        console.log('[Q3 Benchmark] Mode enabled — tracking metrics');
      }

      // ── Phase 4: Crash Recovery Detection ──
      if (INFRASTRUCTURE.crashRecoveryEnabled) {
        const recovery = globalCrashRecoveryManager;
        const crashDetected = await recovery.detectCrash(campaign.id);
        if (crashDetected) {
          console.log('[useCycleLoop] CRASH DETECTED — attempting recovery from checkpoint...');
          const checkpoint = await recovery.loadCheckpoint(campaign.id);
          if (checkpoint) {
            console.log(`[useCycleLoop] Resuming from phase: ${checkpoint.lastCompletedPhase}`);
            // In real implementation, would skip to next phase after checkpoint
            // For now, log and clear to restart cleanly
          }
        }
        // Start heartbeat monitoring for this session
        recovery.startHeartbeat(campaign.id, INFRASTRUCTURE.sessionCheckpointingInterval);
      }

      // ── Check for an existing checkpoint (e.g. from a previous page reload) ──
      const existingCheckpoint = await loadCheckpoint(cycle.id);
      if (existingCheckpoint && Date.now() - existingCheckpoint.savedAt < 24 * 60 * 60 * 1000) {
        console.log(`[useCycleLoop] Found checkpoint at stage: ${existingCheckpoint.lastCompletedStage} — clearing and restarting`);
        // TODO: offer UI resume — for now, clear and restart to avoid partial-state bugs
        await clearCheckpoint(cycle.id);
      }

      // Pre-research checkpoint
      const stageOutputs: Record<string, string> = {};
      const preResearchAnswer = await askCheckpointQuestion('pre-research', campaign, stageOutputs);
      // Guard: if the generation advanced while waiting for user input, bail out
      if (cycleGenerationRef.current !== myGeneration) return;
      if (preResearchAnswer) {
        // Inject user direction into campaign context for research
        campaign = { ...campaign, productFeatures: [...campaign.productFeatures, `[User direction: ${preResearchAnswer}]`] };
      }

      while (isRunningRef.current && !signal.aborted) {
        try {
<<<<<<< HEAD:frontend/hooks/useCycleLoop.ts
          // Execute current stage — pass the shared signal
          await executeStage(cycle, cycle.currentStage, campaign, signal);
=======
          // Execute current stage with timeout pyramid + aggressive timeout protection
          const stageName = cycle.currentStage;
          const timeoutEnabled = isTimeoutPyramidEnabled();
          const timeout = STAGE_TIMEOUTS[stageName];

          if (timeoutEnabled && timeout) {
            // Phase 4: Wrap stage execution with aggressive timeout (30s per request)
            try {
              const startTime = Date.now();

              // Use aggressive timeout manager for all requests within the stage
              const stagePromise = executeStage(cycle, stageName, campaign, signal);

              // Also apply phase-level timeout pyramid
              await withTimeout(
                stagePromise,
                timeout,
                stageName,
                new AbortController() // Create fresh abort controller for timeout
              );
            } catch (timeoutErr) {
              if (timeoutErr instanceof TimeoutError) {
                // Handle timeout with graceful degradation
                const elapsed = Date.now() - cycle.stages[stageName].startedAt!;
                const strategy = getGracefulDegradationStrategy(stageName);
                logTimeoutEvent(stageName, timeout, elapsed, strategy.action);

                console.warn(
                  `[TimeoutPyramid] Stage "${stageName}" timed out after ${timeout}ms.` +
                  `\nStrategy: ${strategy.action}` +
                  (strategy.fallback ? `\nFallback: ${strategy.fallback}` : '')
                );

                // Mark stage as completed with partial results
                const stage = cycle.stages[stageName];
                stage.status = 'complete';
                stage.completedAt = Date.now();
                stage.agentOutput += `\n[TIMEOUT] This stage exceeded its ${timeout}ms budget and was concluded with partial results.`;
                throttledSetCycle(cycle);

                // Continue to next stage rather than failing
                setCurrentCycle(refreshCycleReference(cycle));
              } else {
                throw timeoutErr;
              }
            }
          } else {
            // No timeout protection — execute normally
            await executeStage(cycle, stageName, campaign, signal);
          }
>>>>>>> 5e8b1b9 (Fix NEURO benchmark timeouts and tool_calls tracking):src/hooks/useCycleLoop.ts

          // Generation guard: if the cycle was restarted/aborted while this
          // stage was executing, discard the result and stop this run.
          if (cycleGenerationRef.current !== myGeneration) return;

          // State already updated in executeStage, but refresh again to be sure
          setCurrentCycle(refreshCycleReference(cycle));

          // Capture stage output for checkpoint questions
          const completedStage = cycle.currentStage;
          stageOutputs[completedStage] = cycle.stages[completedStage]?.processedOutput || cycle.stages[completedStage]?.agentOutput || '';

          // ── Q3 Benchmark: Track phase metrics ──
          if (q3BenchmarkMode) {
            benchmarkMetrics[completedStage] = {
              tokens: tokenTracker.getSnapshot().sessionTotal,
              duration: Date.now() - (cycle.stages[completedStage].startedAt || 0),
            };
            console.log(`[Q3 Benchmark] ${completedStage}: ${benchmarkMetrics[completedStage].duration}ms, ${benchmarkMetrics[completedStage].tokens} tokens`);
          }

          // Save cycle progress to IndexedDB
          await updateCycle(cycle);

          // ── Persist checkpoint so a reload can detect where we left off ──
          await saveCheckpoint(cycle.id, completedStage, stageOutputs);

          // ── Phase 4: Crash Recovery Checkpoint ──
          if (INFRASTRUCTURE.crashRecoveryEnabled) {
            try {
              const recovery = globalCrashRecoveryManager;
              await recovery.saveCheckpoint(campaign.id, cycle, completedStage as StageName);
              console.log(`[Phase4] Crash recovery checkpoint saved: ${completedStage}`);
            } catch (err) {
              console.warn('[Phase4] Checkpoint save failed (non-critical):', err);
            }
          }

          // Mid-pipeline checkpoint: after angles, before strategy
          if (completedStage === 'angles') {
            const midAnswer = await askCheckpointQuestion('mid-pipeline', campaign, stageOutputs);
            if (cycleGenerationRef.current !== myGeneration) return;
            if (midAnswer) {
              stageOutputs['user_creative_direction'] = midAnswer;
            }
          }

          // Pre-production checkpoint: after copywriting, before production
          if (completedStage === 'copywriting') {
            const preMakeAnswer = await askCheckpointQuestion('pre-make', campaign, stageOutputs);
            if (cycleGenerationRef.current !== myGeneration) return;
            if (preMakeAnswer) {
              stageOutputs['user_make_direction'] = preMakeAnswer;
            }
          }

          // Delay before next stage (abortable)
          await abortableDelay(STAGE_DELAY, signal);

          // ── PHASE BRIDGE VALIDATION ──
          // Validate context quality before transitioning to next phase
          const nextStageIndex = getStageOrder(cycle.mode).indexOf(completedStage) + 1;
          if (nextStageIndex < getStageOrder(cycle.mode).length && cycle.researchFindings) {
            try {
              let transitionCheck: any = null;

              // Call appropriate validator based on completed stage
              if (completedStage === 'research') {
                transitionCheck = ContextBridgeValidator.validatePhase1ToPhase2(cycle.researchFindings);
              } else if (completedStage === 'brand-dna') {
                transitionCheck = ContextBridgeValidator.validatePhase2ToPhase3(cycle.researchFindings, cycle.researchFindings?.auditTrail);
              } else if (completedStage === 'persona-dna') {
                transitionCheck = ContextBridgeValidator.validatePhase3ToPhase4(cycle.researchFindings?.objections);
              } else if (completedStage === 'angles') {
                transitionCheck = ContextBridgeValidator.validatePhase4ToPhase5(cycle.researchFindings?.councilVerdict);
              } else if (completedStage === 'strategy') {
                transitionCheck = ContextBridgeValidator.validatePhase5ToPhase6(
                  cycle.stages.strategy?.artifacts?.length || 0,
                  cycle.researchFindings
                );
              } else if (completedStage === 'copywriting') {
                transitionCheck = ContextBridgeValidator.validatePhase6ToPhase7(cycle.stages.production?.artifacts);
              }

              if (transitionCheck) {
                // Log quality score and gaps
                const statusIcon = transitionCheck.canProceed ? '✓' : '⚠';
                const gapStr = transitionCheck.gaps.length > 0 ? ` | ${transitionCheck.gaps.length} gaps` : '';
                console.log(`[BRIDGE] ${statusIcon} ${completedStage}→next: ${transitionCheck.qualityScore.toFixed(0)}%${gapStr}`);

                if (!transitionCheck.canProceed) {
                  console.warn(`[BRIDGE] Quality gate below 80% — gaps:`, transitionCheck.gaps.map((g: any) => g.description));
                }
              }
            } catch (bridgeErr) {
              // Bridge validation is non-critical — don't block the pipeline
              console.warn('[useCycleLoop] Phase bridge validation failed (non-critical):', bridgeErr);
            }
          }

          // Advance to next stage
          const { cycle: updatedCycle, done } = advanceToNextStage(cycle);
          cycle = updatedCycle;
          cycleRef.current = cycle;

          if (done) {
            // Cycle fully complete — clear checkpoint and start a new one
            await clearCheckpoint(cycle.id);
            cycleNumber++;
            cycle = createCycle(campaign.id, cycleNumber);
            cycleRef.current = cycle;
            await saveCycle(cycle);
          }

          setCurrentCycle(refreshCycleReference(cycle));
        } catch (err) {
          if (isAbortError(err)) {
            // User-initiated stop — mark cycle as stopped and exit loop cleanly
            cycle.status = 'stopped';
            setCurrentCycle(refreshCycleReference(cycle));
            break;
          }

          // Real error — retry up to 2 times with exponential backoff
          const stage = cycle.stages[cycle.currentStage];
          const retryCount = (stage as any)._retryCount ?? 0;
          const MAX_STAGE_RETRIES = 2;

          if (retryCount < MAX_STAGE_RETRIES && !signal.aborted) {
            const backoffMs = 2000 * Math.pow(2, retryCount); // 2s, 4s
            const errMsg = err instanceof Error ? err.message : 'unknown';
            console.warn(`[useCycleLoop] Stage "${cycle.currentStage}" failed (attempt ${retryCount + 1}/${MAX_STAGE_RETRIES + 1}): ${errMsg}. Retrying in ${backoffMs}ms...`);

            // Mark stage for retry (preserve partial output)
            (stage as any)._retryCount = retryCount + 1;
            stage.status = 'pending';
            stage.agentOutput = ''; // Clear partial output to avoid corruption
            setCurrentCycle(refreshCycleReference(cycle));
            setError(`Stage "${cycle.currentStage}" failed — retrying (${retryCount + 1}/${MAX_STAGE_RETRIES})...`);

            try {
              await abortableDelay(backoffMs, signal);
              setError(null); // Clear retry message before re-attempt
              continue; // Re-enter loop — will re-execute the same stage
            } catch {
              // Abort during retry wait — stop cleanly
              cycle.status = 'stopped';
              setCurrentCycle(refreshCycleReference(cycle));
              break;
            }
          }

          // Exhausted retries — set error and stop
          const msg = err instanceof Error ? err.message : 'Cycle error';
          setError(msg);

          // ── Phase 4: Handle crash gracefully with recovery ──
          if (INFRASTRUCTURE.crashRecoveryEnabled) {
            try {
              const recovery = globalCrashRecoveryManager;
              await recovery.handleCrashGracefully(err, campaign.id, cycle);
              console.log('[Phase4] Crash recovery saved. Resume on next app launch.');
            } catch (recoveryErr) {
              console.error('[Phase4] Crash recovery failed:', recoveryErr);
            }
          }

          isRunningRef.current = false;
          break;
        }
      }

      // ── Q3 Benchmark: Generate report on cycle complete ──
      if (q3BenchmarkMode && cycle.status === 'complete') {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const reportData = {
            campaignId: campaign.id,
            timestamp: Date.now(),
            campaign: {
              brand: campaign.brand,
              productDescription: campaign.productDescription,
              targetAudience: campaign.targetAudience,
            },
            metrics: benchmarkMetrics,
            cycleMetadata: {
              cycleNumber: cycle.cycleNumber,
              status: cycle.status,
              completedAt: cycle.completedAt,
              elapsedMs: (cycle.completedAt || 0) - (cycle.startedAt || 0),
            },
          };
          const filename = `/tmp/q3-benchmark-${timestamp}.json`;
          console.log(`[Q3 Benchmark] Report: ${filename}`);
          console.log('[Q3 Benchmark] Metrics:', JSON.stringify(reportData, null, 2));
        } catch (reportErr) {
          console.warn('[Q3 Benchmark] Report generation failed:', reportErr);
        }
      }

      // ── AUTONOMY: Learn from cycle & extract insights ──
      if (cycle.status === 'complete') {
        try {
          const tokenInfo = tokenTracker.getSnapshot();
          const makeStage = cycle.stages['production'];
          const testStage = cycle.stages['test'];

          // Estimate research coverage (0-100%)
          const researchStage = cycle.stages['research'];
          const researchOutput = researchStage?.agentOutput || '';
          const coverageBenchmarks = [
            { keyword: 'dimensional coverage', score: 85 },
            { keyword: 'coverage', score: 70 },
            { keyword: 'research round', score: 50 },
          ];
          let estimatedCoverage = 60; // baseline
          for (const bench of coverageBenchmarks) {
            if (researchOutput.toLowerCase().includes(bench.keyword)) {
              estimatedCoverage = Math.min(100, estimatedCoverage + bench.score * 0.3);
            }
          }

          // Extract make quality from test output
          let estimatedMakeQuality = 75; // baseline
          const testOutput = testStage?.agentOutput || '';
          if (testOutput.toLowerCase().includes('strong') || testOutput.toLowerCase().includes('excellent')) {
            estimatedMakeQuality = 90;
          } else if (testOutput.toLowerCase().includes('weak')) {
            estimatedMakeQuality = 60;
          }

          const metrics: CycleMetrics = {
            researchCoverage: Math.min(100, estimatedCoverage),
            makeQuality: Math.min(100, estimatedMakeQuality),
            avgTokensPerStage: {},
            totalTokensUsed: tokenInfo.sessionTotal,
            cycleElapsedMs: (cycle.completedAt || Date.now()) - (cycle.startedAt || 0),
            modelSwitchCount: 0, // Would need to track in executeStage
          };

          const insight = await selfImprovementAgent.learnFromCycle(cycle, metrics);
          console.log('[Autonomy] Cycle insights captured:', insight.keyFindings);

          // Suggest improvements for next cycle
          const suggestions = await selfImprovementAgent.suggestImprovements(cycle.id);
          if (suggestions.length > 0) {
            console.log('[Autonomy] Suggestions for next cycle:', suggestions);
          }
        } catch (autonomyErr) {
          console.warn('[Autonomy] Learning phase failed:', autonomyErr);
        }
      }

      // ── Final cleanup ──
      isRunningRef.current = false;
      setIsRunning(false);

      // ── Phase 4: Stop crash recovery heartbeat ──
      if (INFRASTRUCTURE.crashRecoveryEnabled) {
        try {
          const recovery = globalCrashRecoveryManager;
          recovery.stopHeartbeat();
          // Clear checkpoint on successful completion
          if (cycle.status === 'complete') {
            await recovery.clearCheckpoint(campaign.id);
            console.log('[Phase4] Checkpoint cleared after successful completion');
          }
        } catch (err) {
          console.error('[Phase4] Heartbeat cleanup failed:', err);
        }
      }
      stopSoundLoop('thinking');

      // Flush any pending throttled update
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }

      // Final state push
      setCurrentCycle(refreshCycleReference(cycle));
    },
    [executeStage, advanceToNextStage, updateCycle, saveCycle, askCheckpointQuestion, abortableDelay]
  );

  const start = useCallback(
    async (campaign: Campaign, cycleNumber: number = 1, mode: CycleMode = 'full') => {
      if (isRunningRef.current) return; // prevent double-start (use ref, not state — state lags)
      await runCycle(campaign, cycleNumber, mode);
    },
    [runCycle]
  );

  const stop = useCallback(() => {
    // Advance generation so any in-flight async callbacks from the aborted run
    // will bail when they check cycleGenerationRef.current !== myGeneration.
    cycleGenerationRef.current += 1;

    isRunningRef.current = false;

    // Stop thinking sound
    stopSoundLoop('thinking');

    // Clear all pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Abort all in-progress requests (single controller for entire run)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Mark current stage as 'stopped' so UI shows clear state
    const cycle = cycleRef.current;
    if (cycle) {
      const stage = cycle.stages[cycle.currentStage];
      if (stage && stage.status === 'in-progress') {
        stage.status = 'stopped';
        stage.completedAt = Date.now();
      }
      cycle.status = 'stopped';
      setCurrentCycle(refreshCycleReference(cycle));
    }

    // Flush any pending throttled update
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }

    // Set state last — triggers re-render with all the above mutations visible
    setIsRunning(false);
    setError(null);
  }, []);

  // ── Infrastructure hardening: timeouts, watchdog, crash recovery ─────────────
  useEffect(() => {
    // Initialize on mount
    globalTimeoutManager.cancelAll(); // Clean slate
    globalCrashRecoveryManager.startHeartbeat('session:' + Date.now(), 30000); // 30s heartbeat
    console.log('[useCycleLoop] Infrastructure hardening initialized');

    return () => {
      // Cleanup on unmount
      globalTimeoutManager.cancelAll();
      globalCrashRecoveryManager.stopHeartbeat();
      isRunningRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ── AUTONOMY MONITOR — proactive system metrics & interventions (every 5 min) ────
  useEffect(() => {
    const monitorInterval = setInterval(async () => {
      try {
        const interventions = await proactiveMonitor.check();
        if (interventions.shouldCompress) {
          console.log('[Autonomy] Token budget high — recommend context compression');
        }
        if (interventions.shouldGC) {
          console.log('[Autonomy] Memory pressure detected — recommend garbage collection');
        }
        if (interventions.reduceParallelization) {
          console.log('[Autonomy] Service degradation detected — recommend reducing parallelization');
        }
      } catch (err) {
        console.warn('[Autonomy Monitor] Check failed:', err);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(monitorInterval);
  }, []);

  // ── HEARTBEAT — periodic idle check every 30 minutes ─────────────────────
  // When no cycle is running, scan for orphaned checkpoints that were never
  // resumed. This is best-effort; failures are silently ignored.
  useEffect(() => {
    const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 30 minutes

    const heartbeat = async () => {
      // Only run when no cycle is active
      if (isRunningRef.current) return;

      console.log('[Heartbeat] Idle check at', new Date().toISOString());

      try {
        const campaigns = await storage.getAllCampaigns();
        for (const campaign of campaigns) {
          // Derive the cycleId that checkpoints would be stored under.
          // Cycles are keyed as `${campaignId}-cycle-${cycleNumber}`, and
          // currentCycle on the campaign tracks the next cycle to run.
          // Check the most-recently-run cycle (currentCycle - 1, minimum 1).
          const lastCycleNumber = Math.max(1, (campaign.currentCycle || 1) - 1);
          const lastCycleId = `${campaign.id}-cycle-${lastCycleNumber}`;
          const checkpoint = await loadCheckpoint(lastCycleId);
          if (checkpoint && Date.now() - checkpoint.savedAt < 48 * 60 * 60 * 1000) {
            console.log(
              `[Heartbeat] Orphaned checkpoint found for campaign "${campaign.brand}", ` +
              `stage: ${checkpoint.lastCompletedStage}`
            );
            // Future: emit a UI notification or badge here
          }
        }
      } catch {
        // Heartbeat is best-effort — never throw
      }
    };

    const watchdogCheck = () => {
      const stats = processWatchdog.getStats();
      if (stats.activeProcesses > 0) {
        console.log(`[Watchdog] Active: ${stats.activeProcesses}/${stats.totalProcesses}, Crashes: ${stats.totalCrashes}`);
      }
    };

    const mainInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    const watchdogInterval = setInterval(watchdogCheck, 30000); // 30s from VITE_WATCHDOG_INTERVAL

    return () => {
      clearInterval(mainInterval);
      clearInterval(watchdogInterval);
    };
  }, []); // isRunning checked via ref, so no dep needed

  return {
    isRunning,
    currentCycle,
    error,
    start,
    stop,
  };
}
