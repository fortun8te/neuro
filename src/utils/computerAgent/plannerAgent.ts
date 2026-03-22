/**
 * computerAgent/plannerAgent.ts — high-level planner that breaks goals into steps
 * and reviews results to decide if more work is needed.
 */

import { ollamaService } from '../ollama';
import { getModelForStage } from '../modelConfig';
import { getSessionScreenshot } from './visionAgent';
import type { PlanStep, StepResult, Phase } from './types';

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

const DECOMPOSER_SYSTEM = `You are a task decomposer. Given a user goal, decide if it needs multiple phases.

SIMPLE (1 phase): direct actions like "click X", "go to URL", "scroll down", "type text"
COMPLEX (2-5 phases): research, multi-page browsing, comparing things, finding specific info

For COMPLEX, output phases as a JSON array:
[{"id":"phase_1","name":"Search competitors","instruction":"Search for vitamin c competitors on the search engine","type":"browse"},
 {"id":"phase_2","name":"Visit results","instruction":"Visit the top 3 results and read their product pages","type":"browse"},
 {"id":"phase_3","name":"Summarize findings","instruction":"Summarize what you found about competitor pricing","type":"summarize"}]

Valid types: "action" (single click/type/scroll), "browse" (multi-page exploration), "summarize" (compile findings), "research" (deep multi-page investigation)

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
  let response = '';
  await ollamaService.generateStream(`Goal: ${goal}`, DECOMPOSER_SYSTEM, {
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
    return raw.map((p, i) => ({
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
 * Capture a full-resolution screenshot (1280x800) from an open Wayfarer browser session.
 * Uses the screenshot cache — if a screenshot was taken within 800ms it is reused.
 * Full resolution ensures small text, tiny buttons, and fine UI details are visible.
 * Returns base64 JPEG string (no data: prefix), or null on failure.
 */
export async function captureScreenForPlanning(sessionId: string, signal?: AbortSignal): Promise<string | null> {
  const data = await getSessionScreenshot(sessionId, signal, 800, 1280, 800);
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

SEARCH QUERIES:
When the user wants to search for something, YOU must extract the actual search query from their message.
- "can u look up what time it is" — search for "current time"
- "what's the weather in amsterdam" — search for "weather amsterdam"
- "find me vitamin c serum reviews" — search for "vitamin c serum reviews"
- "who won the world cup" — search for "world cup winner 2026"
Navigate to http://localhost:8888/search?q=<your+extracted+query> — do NOT use the raw user message as the query.
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
  const maxSteps = planContext?.maxSteps ?? 3;

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

  // Validate, normalise, and enforce step limit
  const validated = steps
    .filter(s => s && typeof s.instruction === 'string')
    .slice(0, maxSteps)
    .map((s, i) => ({
      id: s.id || `step_${i + 1}`,
      instruction: s.instruction,
      expectedState: s.expectedState || 'Step is complete',
      highStakes: Boolean(s.highStakes),
      context: s.context || '',
    }));

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
