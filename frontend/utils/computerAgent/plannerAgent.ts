/**
 * computerAgent/plannerAgent.ts — high-level planner that breaks goals into steps
 * and reviews results to decide if more work is needed.
 */

import { ollamaService } from '../ollama';
import { getModelForStage } from '../modelConfig';
import { getSessionScreenshot } from './visionAgent';
import { createLogger } from '../logger';
import type { PlanStep, StepResult, Phase } from './types';

const log = createLogger('planner');

/** Max allowed goal length in characters — prevents context overflow */
const MAX_GOAL_LENGTH = 2000;
/** Absolute max plan steps — safety net regardless of maxSteps parameter */
const ABSOLUTE_MAX_STEPS = 15;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function findJsonBounds(text: string, openChar: '{' | '['): [number, number] | null {
  const closeChar = openChar === '{' ? '}' : ']';
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let startIdx = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) { if (depth === 0) startIdx = i; depth++; }
    else if (ch === closeChar) { depth--; if (depth === 0 && startIdx !== -1) return [startIdx, i + 1]; }
  }
  return null;
}

function parseJsonArraySafe<T>(text: string, fallback: T[]): T[] {
  const cleaned = stripThink(text);
  const bounds = findJsonBounds(cleaned, '[');
  if (!bounds) return fallback;
  try {
    const parsed = JSON.parse(cleaned.substring(bounds[0], bounds[1]));
    if (Array.isArray(parsed)) return parsed as T[];
    return fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObjectSafe<T>(text: string, fallback: T): T {
  const cleaned = stripThink(text);
  const bounds = findJsonBounds(cleaned, '{');
  if (!bounds) return fallback;
  try {
    return JSON.parse(cleaned.substring(bounds[0], bounds[1])) as T;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// Decompose goal into phases
// ─────────────────────────────────────────────────────────────

const DECOMPOSER_SYSTEM = `You are a task decomposer. Given a user goal, detect if it contains multiple subtasks and break it into phases.

KEYWORDS for multi-phase: AND, OR, THEN, also, plus, additionally, then, next, followed by, after that
Examples: "look up bears AND download pictures" = 2 phases, "visit Amazon OR Costco" = 2 phases, "search then compare" = 2 phases

SIMPLE (1 phase): direct actions like "click X", "go to URL", "scroll down", "type text", "find info about bears"
COMPLEX (2-5 phases): research + action, multi-page browsing, comparisons, multi-step workflows

For COMPLEX, output phases as a JSON array:
[{"id":"phase_1","name":"Research","instruction":"Search for information about bears and find pictures","type":"research"},
 {"id":"phase_2","name":"Download","instruction":"Download and save the pictures you found","type":"action"}]

Valid types: "action" (single click/type/scroll), "browse" (multi-page exploration), "research" (find info), "summarize" (compile findings)

For SIMPLE, output: [{"id":"phase_1","name":"Execute","instruction":"<the goal>","type":"action"}]

ALWAYS output a JSON array. 1-5 phases. Each instruction is a complete, self-contained goal statement.`;

interface DecomposerPhase {
  id: string;
  name: string;
  instruction: string;
  type?: 'action' | 'browse' | 'summarize' | 'research';
}

/**
 * Decompose a goal into phases. ALWAYS returns an array of at least one phase.
 * Simple goals get a single phase; complex goals get 2-5 phases.
 */
export async function decomposeGoal(goal: string, signal?: AbortSignal): Promise<Phase[]> {
  // Input validation
  if (!goal || goal.trim().length === 0) {
    log.warn('Empty goal passed to decomposeGoal');
    return [{ id: 'phase_1', name: 'Execute', subGoal: 'No goal specified', phaseType: 'action' }];
  }
  const trimmedGoal = goal.length > MAX_GOAL_LENGTH ? goal.slice(0, MAX_GOAL_LENGTH) + '...' : goal;

  let response = '';
  await ollamaService.generateStream(`Goal: ${trimmedGoal}`, DECOMPOSER_SYSTEM, {
    model: getModelForStage('planner'),
    temperature: 0.1,
    think: false,
    num_predict: 300,
    signal: signal ?? AbortSignal.timeout(30000),
    onChunk: (chunk: string) => { response += chunk; },
  });

  const cleaned = stripThink(response);
  const raw = parseJsonArraySafe<DecomposerPhase>(cleaned, []);

  if (raw.length > 0) {
    const clamped = raw.slice(0, 5); // Max 5 phases
    if (raw.length > 5) log.warn('Decomposer returned too many phases, clamping', { returned: raw.length, max: 5 });
    return clamped.map((p, i) => ({
      id: p.id || `phase_${i + 1}`,
      name: p.name || `Phase ${i + 1}`,
      subGoal: p.instruction || goal,
      phaseType: p.type ?? 'action',
    }));
  }

  // Fallback: single phase wrapping the entire goal
  return [{ id: 'phase_1', name: 'Execute', subGoal: goal, phaseType: 'action' }];
}

// ─────────────────────────────────────────────────────────────
// Screenshot capture for planning
// ─────────────────────────────────────────────────────────────

/**
 * Capture a full-resolution screenshot (1920x1080) from an open Wayfarer browser session.
 * Uses the screenshot cache — if a screenshot was taken within 800ms it is reused.
 * Full resolution ensures small text, tiny buttons, and fine UI details are visible.
 * Returns base64 JPEG string (no data: prefix), or null on failure.
 */
export async function captureScreenForPlanning(sessionId: string, signal?: AbortSignal): Promise<string | null> {
  const data = await getSessionScreenshot(sessionId, signal, 1080, 1920, 1080);
  return data || null;
}

// ─────────────────────────────────────────────────────────────
// Create plan
// ─────────────────────────────────────────────────────────────

const PLANNER_SYSTEM = (memoryContext: string, hasScreenshot: boolean, maxSteps: number) =>
  `You are a task planner for a browser automation agent.
Break the task into ${maxSteps} or fewer SIMPLE, CONCRETE steps.
Each step must be ONE browser action: click, type, navigate, scroll, or read.
Keep steps SHORT — under 15 words each. No explanations, no reasoning.

CRITICAL RULES:
- Include full URLs when navigating (e.g. "Navigate to http://localhost:8888/search?q=weather+today")
- "Click the first search result link" NOT "Read results to identify the most relevant link"
- "Scroll down 300 pixels" NOT "Scroll down the page to find more results"
- "Read the main heading text" NOT "Analyze the page content to extract information"
- NEVER ask the executor to "identify", "analyze", "evaluate", or "determine" — just click/type/read
- The executor can see indexed interactive elements on the page and click them by index — you do NOT need to describe element positions precisely
- Maximum ${maxSteps} steps. Fewer is better.

URL SELECTION — choose the right URL for the task:
IMPORTANT: NEVER use google.com for search — it blocks automated browsers with reCAPTCHA.
- Image search ("pictures of", "photos of", "images of") → https://www.bing.com/images/search?q=<query>
- Video search ("youtube", "find a video of", "watch") → https://www.youtube.com/results?search_query=<query>
- Shopping / prices ("buy", "order", "price of") → https://www.bing.com/shop?q=<query>
- Maps / directions ("where is", "directions to") → https://www.openstreetmap.org/search?query=<query>
- General web search (news, facts, reviews, "look up", "search for") → http://localhost:8888/search?q=<query>
- Specific site already mentioned → go directly to that URL
- Research/multi-source queries → http://localhost:8888/search?q=<query>
Extract the real search query from the user's message — do NOT use their raw words as the URL.
${hasScreenshot ? `
You have a screenshot of the current screen. Base your plan on what you SEE — reference visible elements by position.
` : ''}
${memoryContext ? `Past similar tasks:\n${memoryContext}` : ''}

Output ONLY a JSON array:
[{"id":"step_1","instruction":"Navigate to http://example.com","expectedState":"Page loaded","highStakes":false,"context":""}]

highStakes=true ONLY for: deleting files, submitting forms, purchases, sending messages.`;

export interface CreatePlanContext {
  sessionId?: string;
  initialScreenshot?: string;
  maxSteps?: number;
}

/**
 * Generate a sequential plan for the given goal.
 * If context includes a sessionId or initialScreenshot, captures/uses the screenshot
 * as visual input so the planner knows what is actually on screen.
 * @param interpretationNote Optional interpretation from the goal classifier — injected into prompt for complex goals.
 */
export async function createPlan(
  goal: string,
  memoryContext: string,
  signal?: AbortSignal,
  planContext?: CreatePlanContext,
  interpretationNote?: string,
): Promise<PlanStep[]> {
  // Input validation
  if (!goal || goal.trim().length === 0) {
    log.warn('Empty goal passed to createPlan');
    return [{ id: '1', instruction: 'No goal specified', expectedState: '', highStakes: false, context: '' }];
  }

  const maxSteps = Math.min(planContext?.maxSteps ?? 3, ABSOLUTE_MAX_STEPS);

  // Capture or reuse screenshot for visual grounding
  let screenshot: string | null = planContext?.initialScreenshot ?? null;
  if (!screenshot && planContext?.sessionId) {
    screenshot = await captureScreenForPlanning(planContext.sessionId, signal);
  }

  const systemPrompt = PLANNER_SYSTEM(memoryContext, screenshot !== null, maxSteps);

  // Build goal section — inject interpretation note for complex goals
  const goalLine = interpretationNote
    ? `User said: "${goal}"\nInterpretation: ${interpretationNote}\nProceed with this understanding. If your interpretation seems wrong after seeing the screen, adjust.`
    : `Goal: ${goal}`;

  const prompt = screenshot
    ? `${goalLine}\n\nA screenshot of the current screen is attached. Analyze it, then create a step-by-step plan:`
    : `${goalLine}\n\nCreate a step-by-step plan:`;

  let response = '';
  await ollamaService.generateStream(prompt, systemPrompt, {
    model: getModelForStage('planner'),
    temperature: 0.2,
    num_predict: 300,
    signal: signal ?? AbortSignal.timeout(30000),
    ...(screenshot ? { images: [screenshot] } : {}),
    onChunk: (chunk: string) => { response += chunk; },
  });

  const steps = parseJsonArraySafe<PlanStep>(response, []);

  // Validate, normalise, enforce step limit, and dedup
  const seen = new Set<string>();
  const validated = steps
    .filter(s => s && typeof s.instruction === 'string')
    .slice(0, maxSteps)
    .map((s, i) => ({
      id: s.id || `step_${i + 1}`,
      instruction: s.instruction,
      expectedState: s.expectedState || 'Step is complete',
      highStakes: Boolean(s.highStakes),
      context: s.context || '',
    }))
    .filter(s => {
      // Deduplicate: strip non-alpha chars, take first 40 chars as fingerprint
      const key = s.instruction.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Graceful fallback: if planner returned nothing, synthesise a single default step
  if (validated.length === 0) {
    return [{
      id: '1',
      instruction: goal,
      expectedState: 'Goal is complete',
      highStakes: false,
      context: '',
    }];
  }

  return validated;
}

// ─────────────────────────────────────────────────────────────
// Review results
// ─────────────────────────────────────────────────────────────

export interface ReviewOutcome {
  done: boolean;
  summary: string;
  newSteps?: PlanStep[];
}

const REVIEWER_SYSTEM = `You are a desktop automation reviewer. Given a goal, the original plan, and the results of each step, decide whether the goal is complete or whether additional steps are needed.

Output ONLY valid JSON:
{
  "done": true,
  "summary": "The goal was accomplished. Chrome was opened and navigated to google.com.",
  "newSteps": []
}

If done=false, populate newSteps with steps to fix what failed (same format as planner steps).
If done=true, newSteps can be omitted or empty.`;

/**
 * Review all step results and decide if the goal is achieved or more steps are needed.
 */
export async function reviewResults(
  goal: string,
  steps: PlanStep[],
  results: StepResult[],
  signal?: AbortSignal,
): Promise<ReviewOutcome> {
  const stepSummaries = steps.map((s, i) => {
    const r = results[i];
    if (!r) return `Step ${s.id}: not executed`;
    return `Step ${s.id} (${s.instruction}): ${r.success ? 'SUCCESS' : 'FAILED'} — ${r.result}`;
  }).join('\n');

  const prompt =
    `Goal: ${goal}\n\n` +
    `Steps executed:\n${stepSummaries}\n\n` +
    `Is the goal complete? If not, what new steps are needed?`;

  let response = '';
  await ollamaService.generateStream(prompt, REVIEWER_SYSTEM, {
    model: getModelForStage('planner'),
    temperature: 0.2,
    num_predict: 400,
    signal: signal ?? AbortSignal.timeout(30000),
    onChunk: (chunk: string) => { response += chunk; },
  });

  return parseJsonObjectSafe<ReviewOutcome>(response, {
    done: false,
    summary: 'Could not parse reviewer response',
    newSteps: [],
  });
}
