// @ts-nocheck
/**
 * computerAgent/orchestrator.ts — top-level computer agent runner.
 *
 * Orchestrates: memory recall → planning → step execution → review → memory save.
 * Handles high-stakes pauses and step-level retries on failure.
 */

import { buildMemoryContext, saveMemory } from './memoryLayer';
import { createPlan, reviewResults, decomposeGoal, captureScreenForPlanning } from './plannerAgent';
import { runExecutorStep } from './executorAgent';
import { WayfarerSession, isWayfarerHealthy } from './wayfarerSession';
import type { StepResult, PlanStep, GoalAnalysis, Phase } from './types';
import { desktopBus } from '../desktopBus';
import { ollamaService } from '../ollama';
import { rewriteWithNeuro, isNeuroAvailable } from '../neuroRewriter';
import { createLogger } from '../logger';
import { vfs, generateSessionId } from '../sessionFileSystem';
import { INFRASTRUCTURE } from '../../config/infrastructure';

const log = createLogger('orchestrator');

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export interface AskUserRequest {
  id: string;
  question: string;
  context: string;
  options: Array<{ label: string; value: string }>;
  allowCustom: boolean;
  screenshot?: string;
  /** When true, this is a goal clarification question (not a high-stakes action pause) */
  isClarification?: boolean;
}

export interface AskUserResponse {
  value: string;
  label: string;
}

export interface OrchestratorOptions {
  signal?: AbortSignal;
  onStatus?: (msg: string) => void;
  /** Streaming chunk callback — surfaces interpretation notes and status in real-time */
  onChunk?: (chunk: string) => void;
  onScreenshot?: (base64: string) => void;
  onAskUser?: (request: AskUserRequest) => Promise<AskUserResponse>;
  /** Called whenever Playwright navigates to a new URL — use to sync ChromeWindow address bar */
  onBrowserUrl?: (url: string) => void;
  /** Workspace/chat ID — used to copy downloaded images into the Neuro workspace folder */
  workspaceId?: string;
}

// ─────────────────────────────────────────────────────────────
// Goal ambiguity classifier
// ─────────────────────────────────────────────────────────────

const GOAL_CLASSIFIER_SYSTEM = `You are a goal analyzer for a computer automation agent.
Given a user's instruction, determine:
1. Is it clear enough to act on immediately?
2. Is it ambiguous and needs clarification?
3. Is it complex but inferable (figure it out yourself)?

CLEAR: "open chrome and google cats" — obvious, act immediately
COMPLEX: "set up my development environment" — complex but inferable, make reasonable assumptions
AMBIGUOUS: "do that thing" / "fix it" / "make it better" — unclear, need to ask

Return JSON only:
{"clarity":"clear"|"ambiguous"|"complex","interpretation":"...","missingInfo":"...","clarifyQuestion":"one short question","confidence":0.8}`;

/**
 * Fast-path check: only run the classifier if the goal is potentially vague.
 * Short, clear commands skip it entirely for speed.
 */
function needsAmbiguityCheck(goal: string): boolean {
  const words = goal.trim().split(/\s+/);
  // Skip for short goals (4 words or fewer)
  if (words.length <= 4) return false;
  // Check for vague pronouns/references
  const vaguePattern = /\b(it|that|this|the\s+thing|those|these|them|there)\b/i;
  if (vaguePattern.test(goal)) return true;
  // Check for missing clear verb+object (very short action without specifics)
  const hasVerb = /^(open|close|click|type|go|navigate|search|find|create|delete|move|copy|download|upload|run|start|stop|install|launch|write|read|send|save|show|hide|scroll|zoom|resize|press|drag)/i.test(goal.trim());
  if (!hasVerb) return true;
  return false;
}

/**
 * Parse the goal classifier JSON response safely.
 */
function parseGoalAnalysis(text: string): GoalAnalysis | null {
  // Strip think tags
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  // Find JSON bounds
  let depth = 0;
  let startIdx = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { if (depth === 0) startIdx = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0 && startIdx !== -1) {
      try {
        const parsed = JSON.parse(cleaned.substring(startIdx, i + 1)) as Partial<GoalAnalysis>;
        if (!parsed.clarity) return null;
        return {
          clarity: parsed.clarity,
          interpretation: parsed.interpretation || '',
          missingInfo: parsed.missingInfo,
          clarifyQuestion: parsed.clarifyQuestion,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        };
      } catch { return null; }
    }}
  }
  return null;
}

/**
 * Run a quick LLM goal analysis — qwen3.5:2b, max 200 tokens, 3s timeout.
 */
async function analyzeGoal(goal: string, signal?: AbortSignal): Promise<GoalAnalysis> {
  const fallback: GoalAnalysis = { clarity: 'clear', interpretation: goal, confidence: 1.0 };
  let response = '';
  try {
    // Combine caller signal with a 3s timeout — abort whichever fires first
    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => timeoutController.abort(), 3000);
    const onCallerAbort = signal ? () => timeoutController.abort() : null;
    if (signal && onCallerAbort) signal.addEventListener('abort', onCallerAbort, { once: true });
    try {
      await ollamaService.generateStream(
        `Goal: ${goal}`,
        GOAL_CLASSIFIER_SYSTEM,
        {
          model: 'qwen3.5:2b',
          temperature: 0.1,
          num_predict: 200,
          signal: timeoutController.signal,
          onChunk: (chunk: string) => { response += chunk; },
        },
      );
    } finally {
      clearTimeout(timeoutHandle);
      if (signal && onCallerAbort) signal.removeEventListener('abort', onCallerAbort);
    }
    return parseGoalAnalysis(response) ?? fallback;
  } catch (err) {
    console.warn('[Agent] Goal analysis failed, using fallback:', err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function captureDesktopForAsk(desktopEl: HTMLElement): Promise<string> {
  try {
    const { captureDesktop } = await import('./visionAgent');
    return await captureDesktop(desktopEl);
  } catch (err) {
    console.warn('[Agent] captureDesktopForAsk failed:', err instanceof Error ? err.message : String(err));
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Phase runner
// ─────────────────────────────────────────────────────────────

/** Map phase type to executor maxIterations ceiling */
function getMaxIterationsForPhase(phaseType?: string): number {
  switch (phaseType) {
    case 'research':  return 30;
    case 'browse':    return 25;
    case 'summarize': return 15;
    case 'action':    return 15;
    default:          return 20;
  }
}

async function runPhase(
  phaseGoal: string,
  steps: PlanStep[],
  desktopEl: HTMLElement,
  session: WayfarerSession,
  options: OrchestratorOptions,
  maxStepRetries = 2,
  maxIterations = 20,
): Promise<{ allResults: StepResult[]; done: boolean; summary: string }> {
  const { signal, onStatus, onScreenshot, onAskUser, onBrowserUrl, workspaceId } = options;
  const allResults: StepResult[] = [];

  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) break;

    const step = steps[i];
    onStatus?.(`[Agent] Step ${i + 1}/${steps.length}: ${step.instruction}`);

    desktopBus.emit({ type: 'agent_step_start', stepIndex: i, description: step.instruction });
    desktopBus.emit({ type: 'agent_status', phase: 'executing', message: step.instruction, stepIndex: i, totalSteps: steps.length });

    // High-stakes pause
    if (step.highStakes && onAskUser) {
      const askScreenshot = await captureDesktopForAsk(desktopEl);
      const request: AskUserRequest = {
        id: `ask_${step.id}`,
        question: `About to execute a high-stakes action: "${step.instruction}"`,
        context: step.context || `This step is part of: ${phaseGoal}`,
        options: [
          { label: 'Proceed', value: 'proceed' },
          { label: 'Skip this step', value: 'skip' },
          { label: 'Abort entire task', value: 'abort' },
        ],
        allowCustom: false,
        screenshot: askScreenshot || undefined,
      };

      const userResp = await onAskUser(request);

      if (userResp.value === 'abort') {
        const summary = `Task aborted by user before high-stakes step: "${step.instruction}"`;
        onStatus?.(`[Agent] ${summary}`);
        return { allResults, done: false, summary };
      }

      if (userResp.value === 'skip') {
        onStatus?.(`[Agent] Step ${i + 1} skipped by user`);
        allResults.push({
          stepId: step.id,
          success: false,
          result: 'Skipped by user',
          screenshot: '',
          currentStateDescription: 'Skipped',
          actionsTaken: [],
          failureReason: 'User skipped this step',
        });
        continue;
      }
    }

    // Open browser session lazily if not yet open
    const looksLikeBrowserStep =
      /navigate|browse|open.*url|go to|http|www\.|website|webpage|search|google/i.test(step.instruction);
    if (looksLikeBrowserStep && !session.isOpen) {
      onStatus?.('[Agent] Opening Playwright browser session...');
      // Extract URL from step if present, otherwise about:blank
      const stepUrlMatch = step.instruction.match(/https?:\/\/[^\s"'<>]+/);
      const openUrl = stepUrlMatch ? stepUrlMatch[0].replace(/[.,;)]+$/, '') : 'about:blank';
      await session.open(openUrl, signal);
      if (session.isOpen && session.healthy) {
        onStatus?.('[Agent] Browser session ready');
      } else {
        onStatus?.(`[Agent] Browser session failed to open (healthy=${session.healthy}, isOpen=${session.isOpen}) -- will use desktop only`);
      }
    }

    // Execute step with retry budget
    let stepRetry = 0;
    let result = await runExecutorStep(step, desktopEl, {
      signal,
      onStatus,
      onScreenshot,
      maxIterations,
      wayfarerSession: (session.isOpen && session.healthy) ? session : undefined,
      onContextSwitch: (ctx) => {
        onStatus?.(`[Agent] Context: ${ctx}`);
      },
      onBrowserUrl,
      workspaceId,
      onIterationUpdate: (iter, maxIter) => {
        desktopBus.emit({ type: 'agent_iteration', iteration: iter, maxIterations: maxIter });
        onStatus?.(`[Executor] Iteration ${iter}/${maxIter}`);
      },
    });

    while (!result.success && !signal?.aborted && stepRetry < maxStepRetries) {
      stepRetry++;

      if (stepRetry === 1) {
        // First retry: ask planner for recovery steps
        onStatus?.('[Agent] Requesting recovery plan from planner...');
        const recovery = await reviewResults(phaseGoal, [step], [result], signal);

        if (recovery.newSteps && recovery.newSteps.length > 0) {
          onStatus?.(`[Agent] Retrying with ${recovery.newSteps.length} recovery step(s)`);

          for (const recoveryStep of recovery.newSteps) {
            if (signal?.aborted) break;
            onStatus?.(`[Agent] Recovery: ${recoveryStep.instruction}`);
            const recoveryResult = await runExecutorStep(recoveryStep, desktopEl, {
              signal,
              onStatus,
              onScreenshot,
              wayfarerSession: (session.isOpen && session.healthy) ? session : undefined,
              onBrowserUrl,
              workspaceId,
              onIterationUpdate: (iter, maxIter) => {
                desktopBus.emit({ type: 'agent_iteration', iteration: iter, maxIterations: maxIter });
                onStatus?.(`[Executor] Iteration ${iter}/${maxIter}`);
              },
            });
            allResults.push(recoveryResult);
            onStatus?.(recoveryResult.success
              ? '[Agent] Recovery step done'
              : `[Agent] Recovery step failed: ${recoveryResult.failureReason}`);

            if (recoveryResult.success) {
              result = recoveryResult;
              break;
            }
          }
        }
      } else {
        // Subsequent retries: wait then re-run original step directly
        await new Promise(res => setTimeout(res, 1000 * stepRetry));
        onStatus?.(`[Agent] Retry ${stepRetry}/${maxStepRetries}: ${step.instruction}`);
        result = await runExecutorStep(step, desktopEl, {
          signal,
          onStatus,
          onScreenshot,
          wayfarerSession: (session.isOpen && session.healthy) ? session : undefined,
          onContextSwitch: (ctx) => {
            onStatus?.(`[Agent] Context: ${ctx}`);
          },
          onBrowserUrl,
          workspaceId,
          onIterationUpdate: (iter, maxIter) => {
            desktopBus.emit({ type: 'agent_iteration', iteration: iter, maxIterations: maxIter });
            onStatus?.(`[Executor] Iteration ${iter}/${maxIter}`);
          },
        });
      }
    }

    if (!result.success && stepRetry >= maxStepRetries) {
      onStatus?.(`[Agent] Step ${i + 1} failed after ${maxStepRetries} retries`);
    }

    allResults.push(result);

    // Sync ChromeWindow URL bar if browser navigated
    if (session.isOpen && onBrowserUrl) {
      try {
        const shot = await session.screenshot(signal);
        if (shot.url && shot.url !== 'about:blank') {
          onBrowserUrl(shot.url);
        }
      } catch (e) {
        log.debug('URL sync failed', {}, e);
      }
    }

    desktopBus.emit({ type: 'agent_step_done', stepIndex: i, success: result.success, result: result.success ? result.result : (result.failureReason ?? 'unknown reason') });
    onStatus?.(result.success
      ? `[Agent] Step ${i + 1} done`
      : `[Agent] Step ${i + 1} failed: ${result.failureReason ?? 'unknown reason'}`);
  }

  // Skip review if aborted — no point calling the LLM
  if (signal?.aborted) {
    return { allResults, done: false, summary: 'Aborted by user' };
  }

  const review = await reviewResults(phaseGoal, steps, allResults, signal);
  return { allResults, done: review.done, summary: review.summary };
}

// ─────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────

/**
 * Run the computer agent for a natural language goal.
 *
 * @param goal       What the user wants to accomplish
 * @param desktopEl  The desktop HTMLElement to screenshot and control
 * @param options    Signal, status/screenshot callbacks, user pause handler
 * @returns          Summary string of what was accomplished
 */
export async function runComputerAgent(
  goal: string,
  desktopEl: HTMLElement,
  options: OrchestratorOptions = {},
): Promise<string> {
  const { signal, onStatus, onChunk } = options;

  // ── Wayfarer health check — auto-start if offline ──
  if (!await isWayfarerHealthy()) {
    onStatus?.('[Agent] Wayfarer offline — starting...');
    desktopBus.emit({ type: 'agent_status', phase: 'executing', message: 'Starting browser server...' });
    try {
      await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'cd "$HOME/Downloads/nomads/wayfarer" && SEARXNG_URL=http://localhost:8888 nohup /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889 >> /tmp/wayfarer.log 2>&1 &',
          timeout: 5000,
        }),
      });
    } catch (e) {
      log.warn('Failed to start Wayfarer via shell API', {}, e);
    }

    // Poll up to 20s for Wayfarer to come up
    let up = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await isWayfarerHealthy()) { up = true; break; }
    }
    if (!up) {
      const msg = 'Could not start the browser server (Wayfarer). Make sure Python 3.11 is installed at /opt/homebrew/bin/python3.11.';
      desktopBus.emit({ type: 'agent_status', phase: 'done', message: msg });
      return msg;
    }
    desktopBus.emit({ type: 'agent_status', phase: 'executing', message: 'Browser server ready.' });
  }

  // Open a Wayfarer session — lazy: only actually used on first browser_* action
  const session = new WayfarerSession();

  // VFS: generate a unique agent session ID and computer ID for this run
  const agentSessionId = generateSessionId();
  const computerId = generateSessionId();
  vfs.initComputer(agentSessionId, computerId);

  // VFS: subscribe to screenshots emitted by the executor and save them
  const unsubScreenshots = desktopBus.subscribe((event) => {
    if (event.type === 'agent_screenshot' && event.screenshot) {
      vfs.saveScreenshot(agentSessionId, computerId, event.screenshot);
    }
  });

  // VFS: poll Wayfarer /downloads endpoint to sync downloaded files into VFS
  let downloadPollTimer: ReturnType<typeof setInterval> | null = null;
  const knownDownloads = new Set<string>();
  const startDownloadPoll = () => {
    downloadPollTimer = setInterval(async () => {
      try {
        const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/downloads`, { signal: AbortSignal.timeout(3000) });
        if (!resp.ok) return;
        const { downloads } = await resp.json() as { downloads: Array<{ filename: string; path: string; size: number; session_id: string; timestamp: number }> };
        for (const dl of downloads) {
          const key = `${dl.session_id}:${dl.filename}:${dl.timestamp}`;
          if (knownDownloads.has(key)) continue;
          knownDownloads.add(key);
          // Save a lightweight entry (no base64 data -- file lives on disk at dl.path)
          vfs.saveDownload(agentSessionId, computerId, dl.filename, `[disk:${dl.path}]`, 'application/octet-stream');
        }
      } catch (e) { log.debug('Download poll failed', {}, e); }
    }, 3000);
  };
  startDownloadPoll();

  // Declared outside try so catch block can access them for rich error context
  const allStepResults: StepResult[] = [];
  const executedStepInstructions: string[] = [];

  try {
    // 0. Goal ambiguity check — fast-path bypass for short/clear goals
    let effectiveGoal = goal;
    let interpretationNote: string | undefined;

    // Skip clarification for creative/generative intents — just do it
    const isCreativeIntent = /\b(write|create|make|generate|compose|draw|design|build|craft|produce)\b/i.test(goal);

    if (!isCreativeIntent && needsAmbiguityCheck(goal)) {
      onStatus?.('[Agent] Analyzing goal clarity...');
      const analysis = await analyzeGoal(goal, signal);

      if (analysis.clarity === 'ambiguous' && analysis.confidence < 0.6 && options.onAskUser) {
        // Pause and ask the user for clarification
        const clarifyQuestion = analysis.clarifyQuestion || analysis.missingInfo || 'Could you clarify what you mean?';
        const request: AskUserRequest = {
          id: `clarify_${Date.now()}`,
          question: clarifyQuestion,
          context: `Your goal "${goal}" is unclear. ${analysis.missingInfo ?? ''}`.trim(),
          options: [],
          allowCustom: true,
          isClarification: true,
        };

        onStatus?.(`[Agent] Asking for clarification: ${clarifyQuestion}`);
        const userResp = await options.onAskUser(request);

        if (userResp.value === 'abort') {
          const summary = 'Task aborted by user during goal clarification.';
          onStatus?.(`[Agent] ${summary}`);
          return summary;
        }

        if (userResp.value && userResp.value !== 'skip') {
          // Prepend user's clarification to the goal and re-analyze
          effectiveGoal = `${goal} — User clarified: ${userResp.value}`;
          onStatus?.(`[Agent] Goal refined: ${effectiveGoal}`);
          onChunk?.(`Got it, proceeding with: ${userResp.value}\n`);
        }
      } else if (analysis.clarity === 'complex' && analysis.interpretation) {
        // Log interpretation and proceed
        interpretationNote = analysis.interpretation;
        onStatus?.(`[Agent] Interpreting as: ${analysis.interpretation}`);
        onChunk?.(`Interpreting as: ${analysis.interpretation}\n`);
      }
    }

    // 1. Build memory context from past tasks
    onStatus?.('[Agent] Recalling relevant past tasks...');
    const memoryContext = await buildMemoryContext(effectiveGoal);
    if (memoryContext) {
      onStatus?.(`[Agent] Found relevant memories:\n${memoryContext}`);
    }

    // 2. Open browser session proactively so screenshots work from the start
    if (!session.isOpen) {
      onStatus?.('[Agent] Opening browser session...');
      desktopBus.emit({ type: 'agent_status', phase: 'executing', message: 'Opening browser...' });
      // Extract URL from goal if present, otherwise start with about:blank
      const goalUrlMatch = effectiveGoal.match(/https?:\/\/[^\s"'<>]+/);
      const goalDomainMatch = !goalUrlMatch && effectiveGoal.match(/\b([a-z0-9][-a-z0-9]*\.(?:com|org|net|io|co|dev|app|ai|xyz|me|us|uk))\b/i);
      const startUrl = goalUrlMatch ? goalUrlMatch[0].replace(/[.,;)]+$/, '') : goalDomainMatch ? `https://${goalDomainMatch[1]}` : 'about:blank';
      try {
        const openResult = await session.open(startUrl, signal);
        if (openResult.image_base64) {
          desktopBus.emit({ type: 'computer_screenshot', screenshot: openResult.image_base64 });
          desktopBus.emit({ type: 'agent_screenshot', screenshot: openResult.image_base64 });
        }
        onStatus?.(`[Agent] Browser opened at ${startUrl}`);
      } catch (openErr) {
        onStatus?.(`[Agent] Failed to open browser: ${openErr instanceof Error ? openErr.message : openErr}`);
      }
    }

    // Capture initial screenshot for visual grounding before planning
    onStatus?.('[Agent] Capturing initial screen state...');
    let initialScreenshot: string | null = null;
    if (session.isOpen && session.id) {
      initialScreenshot = await captureScreenForPlanning(session.id, signal);
    }
    if (!initialScreenshot) {
      try {
        const { captureDesktop } = await import('./visionAgent');
        initialScreenshot = await captureDesktop(desktopEl);
      } catch (e) { log.debug('Desktop capture failed for planning', {}, e); }
    }
    if (initialScreenshot) {
      onStatus?.('[Agent] Screen captured — planning with visual context');
      options.onScreenshot?.(initialScreenshot);
    }

    const planContext = {
      sessionId: session.id ?? undefined,
      initialScreenshot: initialScreenshot ?? undefined,
    };

    // 3. Decompose goal — skip LLM call for short/clear goals (saves ~10-30s)
    let phases: Phase[];
    const goalWords = effectiveGoal.trim().split(/\s+/).length;
    if (goalWords <= 8) {
      // Short goal → single phase, no LLM decomposition needed
      onStatus?.('[Agent] Simple goal — single phase');
      phases = [{ id: 'phase_1', name: 'Execute', subGoal: effectiveGoal, phaseType: 'action' }];
    } else {
      onStatus?.('[Agent] Analyzing goal complexity...');
      try {
        phases = await decomposeGoal(effectiveGoal, signal);
      } catch (decompErr) {
        onStatus?.(`[Agent] Goal decomposition failed (${decompErr instanceof Error ? decompErr.message : String(decompErr)}), treating as simple goal`);
        phases = [{ id: 'phase_1', name: 'Execute', subGoal: effectiveGoal, phaseType: 'action' }];
      }
    }

    let finalSummary = '';
    let finalDone = false;

    const isMultiPhase = phases.length > 1;
    if (isMultiPhase) {
      onStatus?.(`[Agent] Complex goal — ${phases.length} phases: ${phases.map(p => p.name).join(' → ')}`);
    } else {
      onStatus?.(`[Agent] Simple goal — single phase`);
    }
    desktopBus.emit({ type: 'agent_status', phase: 'planning', message: isMultiPhase ? `${phases.length} phases: ${phases.map(p => p.name).join(' → ')}` : `Planning...`, totalSteps: phases.length });

    let cumulativeContext = memoryContext;
    for (let pi = 0; pi < phases.length; pi++) {
      if (signal?.aborted) break;
      const ph = phases[pi];
      const phaseMaxIter = getMaxIterationsForPhase(ph.phaseType);

      if (isMultiPhase) {
        onStatus?.(`[Agent] === Phase ${pi + 1}/${phases.length}: ${ph.name} ===`);
        desktopBus.emit({ type: 'agent_status', phase: 'executing', message: `Phase ${pi + 1}/${phases.length}: ${ph.name}`, stepIndex: pi, totalSteps: phases.length });
      }

      // Capture fresh screenshot between phases so later phases see updated screen
      if (pi > 0) {
        let freshScreenshot: string | null = null;
        try {
          if (session.isOpen && session.id) {
            freshScreenshot = await captureScreenForPlanning(session.id, signal);
          } else {
            const { captureDesktop } = await import('./visionAgent');
            freshScreenshot = await captureDesktop(desktopEl);
          }
        } catch (e) {
          log.debug('Fresh screenshot between phases failed', {}, e);
        }
        if (freshScreenshot) {
          planContext.initialScreenshot = freshScreenshot;
          options.onScreenshot?.(freshScreenshot);
        }
      }

      // Build phase goal with context from previous phases
      const phaseGoalWithContext = isMultiPhase && pi > 0
        ? `${ph.subGoal}\n\nContext from previous phases:\n${cumulativeContext}`
        : ph.subGoal;

      const phaseSteps = await createPlan(phaseGoalWithContext, isMultiPhase ? '' : cumulativeContext, signal, planContext, interpretationNote);

      if (phaseSteps.length === 0) {
        onStatus?.(`[Agent] Phase ${pi + 1} planner returned no steps — skipping`);
        continue;
      }

      const usingFallback = phaseSteps.length === 1 && phaseSteps[0].id === '1' && phaseSteps[0].instruction === phaseGoalWithContext;
      if (usingFallback) {
        onStatus?.(`[Agent] Phase ${pi + 1} planner returned no steps — using single fallback step`);
      }
      onStatus?.(`[Agent] Phase ${pi + 1} plan: ${phaseSteps.length} step(s) (maxIter=${phaseMaxIter})`);
      phaseSteps.forEach((s, i) => onStatus?.(`[Agent]   ${i + 1}. ${s.instruction}`));
      desktopBus.emit({ type: 'agent_plan', steps: phaseSteps.map(s => ({ instruction: s.instruction, highStakes: s.highStakes })) });
      // Collect step instructions for memory (QW-4)
      phaseSteps.forEach(s => executedStepInstructions.push(s.instruction));

      const phaseResult = await runPhase(ph.subGoal, phaseSteps, desktopEl, session, options, 2, phaseMaxIter);
      finalDone = phaseResult.done;
      finalSummary = phaseResult.summary;
      allStepResults.push(...phaseResult.allResults);

      // Accumulate context from completed phases so later phases know what happened
      cumulativeContext += `\nPhase "${ph.name}" result: ${phaseResult.done ? 'DONE' : 'INCOMPLETE'} — ${phaseResult.summary}`;

      if (!phaseResult.done && !signal?.aborted) {
        onStatus?.(`[Agent] Phase ${pi + 1} incomplete: ${phaseResult.summary}`);
        // Don't abort — continue with next phase
      }
    }

    // Final review for multi-phase: check if overall goal was met
    if (isMultiPhase && !signal?.aborted && allStepResults.length > 0 && !finalDone) {
      onStatus?.('[Agent] Checking if overall goal was met...');
      const allStepInstructions: PlanStep[] = executedStepInstructions.map((instr, i) => ({
        id: `review_${i}`,
        instruction: instr,
        expectedState: '',
        highStakes: false,
        context: '',
      }));
      const finalReview = await reviewResults(effectiveGoal, allStepInstructions, allStepResults, signal);
      if (!finalReview.done && finalReview.newSteps && finalReview.newSteps.length > 0) {
        onStatus?.(`[Agent] Goal not fully met — running ${finalReview.newSteps.length} recovery step(s)`);
        desktopBus.emit({ type: 'agent_plan', steps: finalReview.newSteps.map(s => ({ instruction: s.instruction, highStakes: s.highStakes })) });
        finalReview.newSteps.forEach(s => executedStepInstructions.push(s.instruction));
        const recoveryResult = await runPhase(effectiveGoal, finalReview.newSteps, desktopEl, session, options, 1, 15);
        finalDone = recoveryResult.done;
        finalSummary = recoveryResult.summary;
        allStepResults.push(...recoveryResult.allResults);
      } else {
        finalDone = finalReview.done;
        finalSummary = finalReview.summary;
      }
    }

    // If aborted, override status
    if (signal?.aborted) {
      finalDone = false;
      if (!finalSummary) finalSummary = 'Aborted by user';
    }

    // Synthesize a final answer from all step results
    if (!signal?.aborted && allStepResults.length > 0) {
      try {
        onStatus?.('[Agent] Compiling final answer...');
        const stepDigest = allStepResults
          .map((r, i) => `Step ${i + 1} [${r.success ? 'OK' : 'FAIL'}]: ${r.result.slice(0, 400)}`)
          .join('\n');

        // Extract all URLs visited during execution for source attribution
        const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
        const allUrls = new Set<string>();
        allStepResults.forEach(r => {
          const matches = r.result.match(urlPattern) || [];
          matches.forEach(url => {
            // Filter out obvious non-content URLs
            if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
              allUrls.add(url.split('?')[0]); // Remove query params for dedup
            }
          });
        });

        const sourceSection = allUrls.size > 0
          ? `\n\n## Sources\nInformation gathered from these URLs:\n${Array.from(allUrls).slice(0, 8).map(u => `• ${u}`).join('\n')}`
          : '';

        let synthesized = '';
        await ollamaService.generateStream(
          `You just completed a task for the user. Here is what you found:\n\n${stepDigest.slice(0, 3000)}${sourceSection}\n\nThe user's original question was: "${effectiveGoal}"\n\nProvide a clear, direct answer based on what you found. Be concise and helpful. Include the sources where you found the information. If the task was an action (not a question), confirm what was done.`,
          'You are a helpful assistant summarizing the results of a computer automation task. Answer directly and concisely. Do not use emojis. Do not use hyphens as dashes — use em dashes instead.',
          {
            model: 'qwen3.5:2b',
            temperature: 0.3,
            num_predict: 300,
            signal: signal ?? AbortSignal.timeout(10000),
            onChunk: (chunk: string) => { synthesized += chunk; },
          },
        );
        // Strip think tags from the synthesized answer
        let cleanAnswer = synthesized.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // NEURO-1-B2-4B style rewrite — give the computer agent's answer Neuro's voice
        if (cleanAnswer.length > 10 && await isNeuroAvailable()) {
          cleanAnswer = await rewriteWithNeuro(cleanAnswer, effectiveGoal, {
            signal: signal ?? undefined,
          });
        }

        if (cleanAnswer.length > 10) {
          finalSummary = cleanAnswer;
        }
      } catch (synthErr) {
        console.warn('[Agent] Final answer synthesis failed:', synthErr instanceof Error ? synthErr.message : String(synthErr));
        // Fall back to existing finalSummary
      }
    }

    // 3. Save memory (QW-4: pass actual step instructions, not empty array)
    const outcome = finalDone ? 'success' : 'failure';
    try {
      await saveMemory({
        goal: effectiveGoal,
        steps: executedStepInstructions,
        outcome,
        tags: effectiveGoal.split(' ').filter(w => w.length > 3),
      });
    } catch (memErr) {
      console.warn('[Agent] Failed to save memory:', memErr instanceof Error ? memErr.message : String(memErr));
    }

    // Collect final screenshots from step results for the answer
    const finalScreenshots = allStepResults
      .filter(r => r.screenshot)
      .map(r => r.screenshot as string)
      .slice(-3); // Last 3 screenshots

    desktopBus.emit({
      type: 'agent_status',
      phase: signal?.aborted ? 'error' : 'done',
      message: finalSummary,
      screenshots: finalScreenshots.length > 0 ? finalScreenshots : undefined,
    } as any);

    return finalSummary;

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Build rich error context: include what step failed and last known screen state
    const lastResult = allStepResults.length > 0 ? allStepResults[allStepResults.length - 1] : null;
    const lastStepLabel = executedStepInstructions.length > 0
      ? executedStepInstructions[executedStepInstructions.length - 1]
      : 'unknown step';
    const screenContext = lastResult?.currentStateDescription
      ? ` Screen showed: ${lastResult.currentStateDescription.slice(0, 150)}`
      : '';
    const failedStepContext = lastResult?.failureReason
      ? ` Reason: ${lastResult.failureReason.slice(0, 150)}`
      : '';
    const richError = `Failed during "${lastStepLabel}": ${errorMessage}${failedStepContext}${screenContext}`;
    desktopBus.emit({ type: 'agent_status', phase: 'error', message: richError });
    throw err;
  } finally {
    // VFS: clean up subscriptions and polling
    unsubScreenshots();
    if (downloadPollTimer) clearInterval(downloadPollTimer);

    // Always close the Playwright session — even if an error was thrown
    if (session.isOpen) {
      await session.close();
      options.onStatus?.('[Agent] Browser session closed');
    }
  }
}
