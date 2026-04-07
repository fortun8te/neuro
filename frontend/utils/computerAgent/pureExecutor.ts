/**
 * computerAgent/pureExecutor.ts — pure see-screen → act loop.
 *
 * No planner. No PlanSteps. No WayfayerSession.
 * Drives the REAL Mac desktop via the native bridge on :8891.
 *
 * Loop:
 *   1. Screenshot via bridge
 *   2. Send screenshot + task + history to Gemma 4 E2B
 *   3. Parse ONE action from response
 *   4. Execute on Mac (click / type / scroll / press)
 *   5. Take after-screenshot to verify
 *   6. If done → return
 *   7. If stuck 3× in a row → give up
 */

import { ollamaService } from '../ollama';
import {
  takeScreenshot,
  clickAt,
  typeText,
  pressHotkey,
  scrollAt,
  gemmaBoxToClickPoint,
} from './nativeMacBridge';

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export interface ExecutorConfig {
  task: string;
  maxSteps?: number;        // default 30
  signal?: AbortSignal;
  onStep?: (step: ExecutorStep) => void;
}

export interface ExecutorStep {
  n: number;
  screenshot: string;       // base64 before-action screenshot
  action: SimpleAction;
  result: 'ok' | 'failed' | 'done';
  reasoning?: string;
}

export interface SimpleAction {
  type: 'click' | 'type' | 'scroll' | 'press' | 'done' | 'fail';
  // Gemma 4 E2B box_2d [y1,x1,y2,x2] in 0-1000 space — converted internally
  box_2d?: [number, number, number, number];
  // Fallback: plain pixel coordinates (used if box_2d absent)
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
}

export interface ExecutorResult {
  success: boolean;
  steps: ExecutorStep[];
  result: string;
}

// ─────────────────────────────────────────────────────────────
// System prompt — minimal, fast, JSON-only
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Mac desktop controller. One action per response. JSON only.

Format: {"type":"click","box_2d":[y1,x1,y2,x2],"reasoning":"why"}
Types:
  click   — {"type":"click","box_2d":[y1,x1,y2,x2],"reasoning":"..."}
  type    — {"type":"type","text":"hello world","reasoning":"..."}
  scroll  — {"type":"scroll","direction":"down","reasoning":"..."}
  press   — {"type":"press","key":"Return","reasoning":"..."}
  done    — {"type":"done","reasoning":"goal achieved: <summary>"}
  fail    — {"type":"fail","reasoning":"stuck: <why>"}

box_2d: [y1,x1,y2,x2] in 0-1000 normalised space (Gemma bounding box format).
Keys: Return, Escape, Tab, BackSpace, space, cmd+c, cmd+v, cmd+a.
No markdown. No explanation. Only the JSON object.`;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function parseAction(raw: string): SimpleAction | null {
  const cleaned = stripThink(raw).trim();
  // Find the first JSON object in the response
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    // Type guard: must be an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const type = obj['type'];
    // Validate action type
    const validTypes = ['click', 'type', 'scroll', 'press', 'done', 'fail'] as const;
    if (!validTypes.includes(type as any)) {
      return null;
    }
    const action: SimpleAction = { type: type as SimpleAction['type'] };
    // Validate box_2d: must be array of exactly 4 numbers
    if (Array.isArray(obj['box_2d']) && obj['box_2d'].length === 4) {
      const box = obj['box_2d'] as unknown[];
      if (box.every(v => typeof v === 'number')) {
        action.box_2d = box as [number, number, number, number];
      }
    }
    if (typeof obj['x'] === 'number') action.x = obj['x'];
    if (typeof obj['y'] === 'number') action.y = obj['y'];
    if (typeof obj['text'] === 'string') action.text = obj['text'];
    if (typeof obj['key'] === 'string') action.key = obj['key'];
    if (obj['direction'] === 'up' || obj['direction'] === 'down') {
      action.direction = obj['direction'];
    }
    return action;
  } catch {
    return null;
  }
}

/** Parse a key string like "cmd+c" into an array of key names for pressHotkey. */
function parseKeyCombo(key: string): string[] {
  return key.split('+').map(k => k.trim());
}

/** Check if two actions look identical (stuck detection). */
function actionSignature(a: SimpleAction): string {
  return JSON.stringify({
    t: a.type,
    b: a.box_2d,
    x: a.x,
    y: a.y,
    text: a.text,
    key: a.key,
    dir: a.direction,
  });
}

// ─────────────────────────────────────────────────────────────
// Ask Gemma 4 E2B for next action
// ─────────────────────────────────────────────────────────────

async function decideAction(
  task: string,
  screenshotBase64: string,
  history: string[],
  signal?: AbortSignal,
): Promise<SimpleAction | null> {
  const historyText = history.length > 0
    ? `Actions so far:\n${history.slice(-5).join('\n')}`
    : 'No actions yet.';

  const prompt =
    `Task: ${task}\n\n` +
    `${historyText}\n\n` +
    `What is the ONE next action? JSON only:`;

  let response = '';
  try {
    await ollamaService.generateStream(prompt, SYSTEM_PROMPT, {
      model: 'gemma4:e2b',
      images: [screenshotBase64],
      temperature: 0.1,
      num_predict: 200,
      signal: signal ?? AbortSignal.timeout(30_000),
      onChunk: (chunk: string) => { response += chunk; },
    });
  } catch (err) {
    // Propagate abort; swallow other errors (network, timeout)
    if (signal?.aborted) throw err;
    console.warn('[pureExecutor] decideAction error:', err instanceof Error ? err.message : String(err));
    return null;
  }

  return parseAction(response);
}

// ─────────────────────────────────────────────────────────────
// Execute one action on the real Mac
// ─────────────────────────────────────────────────────────────

async function executeAction(
  action: SimpleAction,
  screenW: number,
  screenH: number,
  signal?: AbortSignal,
): Promise<'ok' | 'failed' | 'done'> {
  try {
    switch (action.type) {
      case 'done':
        return 'done';

      case 'fail':
        return 'failed';

      case 'click': {
        let x: number;
        let y: number;
        if (action.box_2d) {
          const pt = gemmaBoxToClickPoint(action.box_2d, screenW, screenH);
          x = pt.x;
          y = pt.y;
        } else if (action.x !== undefined && action.y !== undefined) {
          x = action.x;
          y = action.y;
        } else {
          console.warn('[pureExecutor] click action missing coordinates');
          return 'failed';
        }
        await clickAt(x, y, undefined, signal);
        return 'ok';
      }

      case 'type': {
        if (!action.text) {
          console.warn('[pureExecutor] type action missing text');
          return 'failed';
        }
        await typeText(action.text, signal);
        return 'ok';
      }

      case 'scroll': {
        // Scroll at the center of the screen
        const cx = Math.round(screenW / 2);
        const cy = Math.round(screenH / 2);
        await scrollAt(cx, cy, action.direction ?? 'down', 3, signal);
        return 'ok';
      }

      case 'press': {
        if (!action.key) {
          console.warn('[pureExecutor] press action missing key');
          return 'failed';
        }
        const keys = parseKeyCombo(action.key);
        await pressHotkey(keys, signal);
        return 'ok';
      }

      default:
        return 'failed';
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[pureExecutor] executeAction error:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}

// ─────────────────────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────────────────────

/**
 * Run a pure see-screen → act loop against the real Mac desktop.
 *
 * No planner. No plan steps. One model call per iteration.
 * Stops when the model says "done", gets stuck 3× in a row,
 * or maxSteps is reached.
 */
export async function runExecutor(config: ExecutorConfig): Promise<ExecutorResult> {
  const { task, maxSteps = 30, signal, onStep } = config;

  const steps: ExecutorStep[] = [];
  const history: string[] = [];

  // Stuck detection: last 3 action signatures
  const recentSigs: string[] = [];
  let stuckCount = 0;

  for (let n = 1; n <= maxSteps; n++) {
    if (signal?.aborted) {
      return {
        success: false,
        steps,
        result: 'Aborted by caller',
      };
    }

    // 1. Take screenshot
    let screenshotBase64 = '';
    let screenW = 1440;
    let screenH = 900;
    try {
      const shot = await takeScreenshot(signal);
      screenshotBase64 = shot.image_base64;
      screenW = shot.width;
      screenH = shot.height;
    } catch (err) {
      if (signal?.aborted) {
        return { success: false, steps, result: 'Aborted during screenshot' };
      }
      console.warn('[pureExecutor] screenshot failed:', err instanceof Error ? err.message : String(err));
      return {
        success: false,
        steps,
        result: `Screenshot failed at step ${n}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // 2. Ask model for next action
    const action = await decideAction(task, screenshotBase64, history, signal);

    if (!action) {
      // Could not parse — count as stuck
      stuckCount++;
      history.push(`Step ${n}: [parse failure]`);
      if (stuckCount >= 3) {
        return {
          success: false,
          steps,
          result: `Gave up after ${stuckCount} consecutive parse failures`,
        };
      }
      continue;
    }

    // 3. Stuck detection
    const sig = actionSignature(action);
    recentSigs.push(sig);
    if (recentSigs.length > 3) recentSigs.shift();

    if (
      recentSigs.length === 3 &&
      recentSigs[0] === recentSigs[1] &&
      recentSigs[1] === recentSigs[2]
    ) {
      stuckCount++;
      if (stuckCount >= 3) {
        const step: ExecutorStep = {
          n,
          screenshot: screenshotBase64,
          action,
          result: 'failed',
          reasoning: action.key ?? action.text ?? action.type,
        };
        steps.push(step);
        onStep?.(step);
        return {
          success: false,
          steps,
          result: `Stuck: repeated the same action 3× at step ${n}`,
        };
      }
    } else {
      stuckCount = 0;
    }

    // 4. Execute action
    const result = await executeAction(action, screenW, screenH, signal);

    // Build step record using before-action screenshot
    const step: ExecutorStep = {
      n,
      screenshot: screenshotBase64,
      action,
      result,
      reasoning: typeof action.key !== 'undefined'
        ? action.key
        : typeof action.text !== 'undefined'
        ? action.text
        : action.type,
    };
    steps.push(step);
    onStep?.(step);

    // Record action for history
    const historyLine = `Step ${n}: ${action.type}` +
      (action.box_2d ? ` box_2d=[${action.box_2d.join(',')}]` : '') +
      (action.x !== undefined ? ` x=${action.x} y=${action.y}` : '') +
      (action.text ? ` text="${action.text}"` : '') +
      (action.key ? ` key=${action.key}` : '') +
      (action.direction ? ` direction=${action.direction}` : '') +
      ` → ${result}`;
    history.push(historyLine);

    // 5. Check terminal states
    if (result === 'done') {
      return {
        success: true,
        steps,
        result: `Done at step ${n}`,
      };
    }

    if (result === 'failed' && action.type === 'fail') {
      return {
        success: false,
        steps,
        result: `Model gave up at step ${n}`,
      };
    }

    // Brief pause so the screen can settle before next screenshot
    await new Promise<void>(resolve => setTimeout(resolve, 400));
  }

  return {
    success: false,
    steps,
    result: `Reached max steps (${maxSteps}) without completing task`,
  };
}
