/**
 * computerAgent/executorAgent.ts — vision-guided executor for individual plan steps.
 *
 * Each step runs a loop (soft-nudged, no hard cap):
 *   screenshot → vision describe → executor decide action → DOM execute → self-check → repeat
 * The loop ends when the model declares done, the user aborts, or stuck detection triggers.
 * Soft nudges encourage the model to wrap up at intervals (default every 10 iterations).
 * A safety-net hard break fires at 4x the nudge interval (default 40).
 */

import { ollamaService } from '../ollama';
import { getModelForStage } from '../modelConfig';
import { captureDesktop, verifyState, invalidateScreenshotCache } from './visionAgent';
import { WayfarerSession } from './wayfarerSession';
import { INFRASTRUCTURE } from '../../config/infrastructure';
import type { PlanStep, ExecutorAction, StepResult, ExecutionContext } from './types';
import { desktopBus } from '../desktopBus';

// ─────────────────────────────────────────────────────────────
// AX tree coordinate resolver — NOT LLM input
// The accessibility tree is used only as a deterministic lookup
// to get precise bounding boxes when vision has already identified
// an element by name. The LLM never sees raw AX JSON.
//
// Pattern:
//   1. Vision model sees screenshot → identifies element by description
//   2. If coordinates seem off on retry, call findElementByText()
//      to get the exact center from the AX tree
//   3. Use those coordinates for the click
// ─────────────────────────────────────────────────────────────

/**
 * Look up the center coordinates of an element in the AX tree by text and optional role.
 * This is a code-level lookup — the raw AX JSON never goes to the LLM.
 * Returns {x, y} center of the element's bounding box, or null if not found.
 *
 * Usage: retry path only — when the vision model has named an element but initial
 * coordinate targeting missed. Primary targeting always uses vision coordinates.
 */
async function findElementByText(
  sessionId: string,
  searchText: string,
  role?: string,
  signal?: AbortSignal,
): Promise<{ x: number; y: number } | null> {
  try {
    const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/accessibility`, { signal });
    if (!resp.ok) return null;
    const { nodes } = await resp.json() as { nodes: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const find = (items: any[]): any => {
      for (const n of items) {
        const nameMatch = typeof n.name === 'string' &&
          n.name.toLowerCase().includes(searchText.toLowerCase());
        const roleMatch = !role || n.role === role;
        if (nameMatch && roleMatch && n.bounds) return n;
        const child = find(n.children ?? []);
        if (child) return child;
      }
      return null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = find(nodes as any[]);
    if (node?.bounds) {
      return {
        x: node.bounds.x + node.bounds.width / 2,
        y: node.bounds.y + node.bounds.height / 2,
      };
    }
  } catch { /* AX lookup is best-effort */ }
  return null;
}

// Export for use in retry paths from orchestrator or future tooling
export { findElementByText };

// ─────────────────────────────────────────────────────────────
// Cursor coordinate mapping
// ─────────────────────────────────────────────────────────────

/**
 * Convert browser-internal coordinates (0-1280 x 0-800 Playwright viewport)
 * to desktop-area coordinates (relative to the flex-1 desktop area container).
 *
 * ChromeWindow: 780x460px, tab bar (36px) + toolbar (44px) = 80px header.
 * Locates the Chrome window in the DOM at call time so dragged windows work.
 */
function browserToDesktopCoords(
  browserX: number,
  browserY: number,
  desktopEl: HTMLElement,
): { x: number; y: number } {
  const chromeWin = desktopEl.querySelector<HTMLElement>('[data-chrome-window]');
  if (chromeWin) {
    const desktopRect = desktopEl.getBoundingClientRect();
    const chromeRect = chromeWin.getBoundingClientRect();
    const relLeft = chromeRect.left - desktopRect.left;
    const relTop = chromeRect.top - desktopRect.top;
    const CHROME_HEADER_H = 80; // tab bar (36) + toolbar (44)
    const viewportW = chromeRect.width;
    const viewportH = chromeRect.height - CHROME_HEADER_H;
    return {
      x: relLeft + (browserX / 1280) * viewportW,
      y: relTop + CHROME_HEADER_H + (browserY / 800) * viewportH,
    };
  }
  // Fallback: scale linearly to desktop container dimensions
  const desktopRect = desktopEl.getBoundingClientRect();
  return {
    x: (browserX / 1280) * desktopRect.width,
    y: (browserY / 800) * desktopRect.height,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ── Human-timing helpers ──

/** Reading pause after seeing a screenshot — proportional to content volume. */
function readingPause(screenshotBase64Length: number): number {
  // Very rough proxy: longer base64 = more content on screen.
  // Scale 300–800ms; base64 of ~50KB (typical screenshot) ≈ 66KB → maps to ~500ms
  const normalized = Math.min(1, screenshotBase64Length / 80_000);
  return 300 + normalized * 500;
}

/** Pause after clicking — brief human reaction moment. */
function clickPause(): number {
  return Math.random() * 200 + 100; // 100–300ms
}

/** Pause after navigation — waiting for page to settle. */
function navPause(): number {
  return Math.random() * 800 + 600; // 600–1400ms
}

/** Pause before any action — "I just read the screen" moment. */
function thinkPause(): number {
  return Math.random() * 400 + 200; // 200–600ms
}

// ─────────────────────────────────────────────────────────────
// URL normalisation (fix #4)
// ─────────────────────────────────────────────────────────────

/** Track whether SearXNG is available — starts optimistic, toggled by health probe. */
let _searxngAvailable = true;

/** Probe SearXNG once (3s timeout). Called lazily on first search-query normalisation. */
async function probeSearxng(): Promise<boolean> {
  try {
    const resp = await fetch(`${INFRASTRUCTURE.searxngUrl}/healthz`, { signal: AbortSignal.timeout(3000) });
    _searxngAvailable = resp.ok;
  } catch {
    _searxngAvailable = false;
  }
  return _searxngAvailable;
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  // Ignore about:blank — don't navigate to it
  if (trimmed === 'about:blank' || trimmed === '') return '';
  // If it looks like a search query (spaces, or no dot after stripping protocol)
  // Exception: localhost (with or without port) is a valid host
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const isLocalhost = /^localhost(:\d+)?(\/|$|\?)/.test(withoutProtocol);
  if (!isLocalhost && (withoutProtocol.includes(' ') || !withoutProtocol.includes('.'))) {
    // Prefer SearXNG (no bot detection) — fall back to DuckDuckGo if SearXNG is down
    if (_searxngAvailable) {
      // Fire-and-forget probe to update the flag for next time
      probeSearxng();
      return `${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(trimmed)}`;
    }
    // Fallback: DuckDuckGo HTML search (works without JavaScript)
    return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
  }
  // Prepend https:// if missing
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────
// Viewport tracking for coordinate scaling (fix #3)
// ─────────────────────────────────────────────────────────────

interface ViewportInfo {
  width: number;
  height: number;
}

// Default viewport — matches _CONTEXT_KWARGS in wayfarer_server.py (1280×800)
const DEFAULT_VIEWPORT: ViewportInfo = { width: 1280, height: 800 };

/**
 * Scale coordinates from screenshot pixel space to actual browser viewport space.
 * The vision model may analyse a JPEG that was scaled differently from the viewport.
 */
function scaleCoords(
  x: number,
  y: number,
  screenshotDims: ViewportInfo,
  viewportDims: ViewportInfo,
): { x: number; y: number } {
  const scaleX = viewportDims.width / screenshotDims.width;
  const scaleY = viewportDims.height / screenshotDims.height;
  return { x: Math.round(x * scaleX), y: Math.round(y * scaleY) };
}

// ─────────────────────────────────────────────────────────────
// Human-like click jitter (fix #5)
// ─────────────────────────────────────────────────────────────

/** Add ±maxOffset px of random noise to avoid exact-center clicks flagged by bot detectors. */
function jitterCoord(v: number, maxOffset = 2): number {
  return v + (Math.random() * maxOffset * 2 - maxOffset);
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  const cleaned = stripThink(text);
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// DOM action execution
// ─────────────────────────────────────────────────────────────

function executeAction(action: ExecutorAction, desktopEl: HTMLElement): boolean {
  const rect = desktopEl.getBoundingClientRect();

  if (action.type === 'click' && action.x !== undefined && action.y !== undefined) {
    const clientX = rect.left + jitterCoord(action.x);
    const clientY = rect.top + jitterCoord(action.y);
    const target = document.elementFromPoint(clientX, clientY);
    if (target) {
      // Pre-action visibility check
      const style = window.getComputedStyle(target);
      const targetRect = target.getBoundingClientRect();
      const isVisible = style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && targetRect.width > 0
        && targetRect.height > 0;
      if (!isVisible) {
        // Element exists but is hidden — skip firing events
        return false;
      }
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX, clientY }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX, clientY }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }));
      return true;
    }
    // target is null — element not found
    return false;
  } else if (action.type === 'type' && action.text) {
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
      const proto = active instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(active, action.text);
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return true;
  } else if (action.type === 'press' && action.key) {
    const target = document.activeElement ?? desktopEl;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: action.key, bubbles: true }));
    return true;
  } else if (action.type === 'scroll') {
    // Fix #1 desktop scroll: respect direction + distance fields
    const distance = action.distance ?? 300;
    let deltaX = 0;
    let deltaY = 0;
    switch (action.direction) {
      case 'up':    deltaY = -distance; break;
      case 'down':  deltaY =  distance; break;
      case 'left':  deltaX = -distance; break;
      case 'right': deltaX =  distance; break;
      default:      deltaY =  distance; break;
    }
    desktopEl.scrollBy({ left: deltaX, top: deltaY, behavior: 'smooth' });
    return true;
  }
  // 'wait' and 'done'/'fail' are handled by the loop, not DOM
  return true;
}

// ─────────────────────────────────────────────────────────────
// Prose detection
// ─────────────────────────────────────────────────────────────

const PROSE_PATTERNS = /\bI will\b|\bLet me\b|\bI'll\b|\bI can\b|\bI need\b|\bI see\b|\bI would\b|\bHere\b|\bThe\s/i;

function looksLikeProse(text: string): boolean {
  const stripped = stripThink(text).trim();
  // If there's no JSON-like structure at all, it's prose
  if (!stripped.includes('{') && !stripped.includes('[')) return true;
  // Aggressive check: if the first 10 non-whitespace characters don't start with { or [, it's prose
  const first10 = stripped.slice(0, 10).trimStart();
  if (first10.length > 0 && first10[0] !== '{' && first10[0] !== '[') return true;
  // If it has conversational starters before any JSON, it's prose
  if (PROSE_PATTERNS.test(stripped)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// Executor LLM
// ─────────────────────────────────────────────────────────────

function buildExecutorSystemPrompt(step: PlanStep, iteration: number): string {
  const iterHint = iteration > 1
    ? ` Iteration ${iteration}.`
    : '';

  return `You see a screenshot of a desktop with windows. Your task: ${step.instruction}
Expected outcome: ${step.expectedState}${iterHint}

Actions (respond with ONE JSON object, no other text):

BROWSER ACTIONS (for web browsing inside Chrome):
  browser_click — {"type":"browser_click","x":450,"y":230,"reasoning":"click search"} Optional: "targetText":"Buy Now" or "selector":"#btn"
  browser_type — {"type":"browser_type","text":"hello","selector":"input#search","reasoning":"type query"} "clear":true clears first
  browser_scroll — {"type":"browser_scroll","direction":"down","distance":300,"reasoning":"scroll to see more"}
  browser_navigate — {"type":"browser_navigate","url":"https://example.com","reasoning":"go to site"}
  browser_press — {"type":"browser_press","key":"Enter","reasoning":"submit form"}

DESKTOP ACTIONS (for managing windows and apps):
  desktop_open_app — {"type":"desktop_open_app","app":"chrome","reasoning":"open browser"} app: "chrome"|"finder"|"terminal"
  desktop_close_window — {"type":"desktop_close_window","app":"chrome","reasoning":"close browser"}
  desktop_drag_window — {"type":"desktop_drag_window","app":"finder","toX":100,"toY":100,"reasoning":"move window"}
  desktop_focus_window — {"type":"desktop_focus_window","app":"terminal","reasoning":"bring to front"}
  desktop_scroll — {"type":"desktop_scroll","app":"finder","direction":"down","amount":300,"reasoning":"scroll in window"}

FINDER ACTIONS (for file management):
  finder_navigate — {"type":"finder_navigate","path":"/nomad/sessions","reasoning":"open folder"}
  finder_open_file — {"type":"finder_open_file","path":"/nomad/sessions/abc/notes/draft.md","reasoning":"preview file"}

TERMINAL ACTIONS:
  terminal_run — {"type":"terminal_run","command":"search collagen trends","reasoning":"run search"}

FILE OPERATIONS (for saving findings, organizing data):
  file_create — {"type":"file_create","path":"/nomad/shared","name":"findings.txt","content":"Research notes...","reasoning":"save findings"}
  file_read — {"type":"file_read","path":"/nomad/shared/findings.txt","reasoning":"read saved findings"}
  file_write — {"type":"file_write","path":"/nomad/shared/findings.txt","content":"Updated notes...","reasoning":"update file"}
  file_delete — {"type":"file_delete","path":"/nomad/shared/old-draft.txt","reasoning":"remove old file"}
  file_rename — {"type":"file_rename","path":"/nomad/shared/draft.txt","newName":"final.txt","reasoning":"rename file"}
  file_move — {"type":"file_move","path":"/nomad/shared/file.txt","destPath":"/nomad/sessions/abc/notes/file.txt","reasoning":"move file"}
  file_download — {"type":"file_download","url":"current_page","destPath":"/nomad/shared","reasoning":"save page content as file"}
  file_list — {"type":"file_list","path":"/nomad/shared","reasoning":"list folder contents"}

COMPLETION:
  done — {"type":"done","result":"what was achieved","reasoning":"task complete"}

x,y are pixel coordinates from the screenshot. Always include "screenState" (one sentence: what you see) and "reasoning".`;
}

const JSON_ONLY_HINT = `JSON ONLY. No text. Example: {"type":"browser_click","x":100,"y":200,"screenState":"Google homepage","reasoning":"click search box"}`;

async function decideAction(
  step: PlanStep,
  screenshotBase64: string,
  screenDescription: string,
  lastActions: string[],
  iteration: number,
  signal?: AbortSignal,
): Promise<ExecutorAction> {
  const systemPrompt = buildExecutorSystemPrompt(step, iteration);
  const prompt =
    `You are looking at a screenshot of a web browser.${screenDescription ? ` You can see: ${screenDescription}` : ''}\n` +
    `Your task: ${step.instruction}\n\n` +
    (lastActions.length > 0 ? `Previous actions:\n${lastActions.join('\n')}\n\n` : '') +
    `Choose ONE action. Respond with JSON only:`;

  let response = '';
  await ollamaService.generateStream(prompt, systemPrompt, {
    model: getModelForStage('executor'),
    images: [screenshotBase64],
    temperature: 0.15,
    num_predict: 300,
    signal,
    onChunk: (chunk: string) => { response += chunk; },
  });

  // Check for prose response — if so, inject the JSON-only hint and retry once
  if (looksLikeProse(response)) {
    const retrySystemPrompt = `${systemPrompt}\n\n${JSON_ONLY_HINT}`;
    let retryResponse = '';
    await ollamaService.generateStream(prompt, retrySystemPrompt, {
      model: getModelForStage('executor'),
      images: [screenshotBase64],
      temperature: 0.1,
      num_predict: 300,
      signal,
      onChunk: (chunk: string) => { retryResponse += chunk; },
    });
    response = retryResponse;
  }

  return parseJsonSafe<ExecutorAction>(response, {
    type: 'fail',
    reasoning: 'Could not parse executor response',
    selfCheck: 'Parse failure',
  });
}

// ─────────────────────────────────────────────────────────────
// Executor loop options
// ─────────────────────────────────────────────────────────────

export interface ExecutorOptions {
  signal?: AbortSignal;
  onStatus?: (msg: string) => void;
  onScreenshot?: (base64: string) => void;
  /** How often (in iterations) soft nudges encourage the model to wrap up. Default 10. */
  softNudgeInterval?: number;
  /** @deprecated — kept for backward compat. Mapped to softNudgeInterval (value / 2). */
  maxIterations?: number;
  wayfarerSession?: WayfarerSession;
  onContextSwitch?: (context: ExecutionContext) => void;
  onIterationUpdate?: (current: number, max: number) => void;
  onBrowserUrl?: (url: string) => void;
  /**
   * Actual browser viewport dimensions (from session open response).
   * Used to scale coordinates from vision model screenshots.
   * Defaults to 1280×800.
   */
  browserViewport?: ViewportInfo;
  /**
   * Screenshot dimensions returned by the last browser screenshot.
   * If undefined, assumed equal to browserViewport (no scaling needed).
   */
  screenshotDims?: ViewportInfo;
}

// ─────────────────────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────────────────────

/**
 * Execute a single plan step using a vision-guided executor loop.
 *
 * Supports dual-mode execution:
 *   - Desktop actions → DOM event dispatch on the React UI (default)
 *   - browser_* actions → Playwright via Wayfarer session (when wayfarerSession provided)
 */
export async function runExecutorStep(
  step: PlanStep,
  desktopEl: HTMLElement,
  options: ExecutorOptions = {},
): Promise<StepResult> {
  const {
    signal,
    onStatus,
    onScreenshot,
    wayfarerSession,
    onContextSwitch,
    onIterationUpdate,
  } = options;

  // Resolve nudge interval: explicit softNudgeInterval takes priority,
  // then backward-compat maxIterations (mapped to half), then default 10.
  const softNudgeInterval = options.softNudgeInterval
    ?? (options.maxIterations ? Math.max(5, Math.floor(options.maxIterations / 2)) : 10);

  // Safety-net hard limit: 4x the nudge interval
  const hardLimit = softNudgeInterval * 4;

  // Viewport tracking for coordinate scaling (fix #3)
  const browserViewport: ViewportInfo = options.browserViewport ?? DEFAULT_VIEWPORT;
  let screenshotDims: ViewportInfo = options.screenshotDims ?? browserViewport;

  const actionsTaken: string[] = [];
  const lastFiveActions: string[] = [];
  // currentScreenshot tracks the most recent screenshot regardless of source
  let currentScreenshot = '';
  let lastStateDescription = '';
  // Accumulate meaningful findings: extracted text snippets and screen observations
  const findings: string[] = [];

  // Action loop detection: track last N action signatures
  const recentActionSignatures: string[] = [];

  // Attention drift: track consecutive scroll-down iterations without finding target
  let consecutiveScrollDownCount = 0;
  let totalScrolledDownPx = 0;

  // Store done result from executor for passing back to orchestrator
  let doneResult = '';

  onStatus?.(`[Executor] Starting step: ${step.instruction}`);
  // Cursor starts in thinking state as we begin the step
  desktopBus.emit({ type: 'ai_cursor_state', state: 'thinking' });

  for (let iter = 1; ; iter++) {
    if (signal?.aborted) break;

    // Safety-net hard break: force done at hardLimit
    if (iter > hardLimit) {
      onStatus?.(`[Executor] Safety-net hard limit reached (${hardLimit} iterations), forcing done`);
      break;
    }

    onIterationUpdate?.(iter, hardLimit);
    onStatus?.(`[Executor] Iteration ${iter}: capturing screen...`);

    // Soft nudges: inject hints into lastFiveActions at interval thresholds
    if (iter === softNudgeInterval) {
      lastFiveActions.push(
        `SYSTEM: You've been working on this step for ${softNudgeInterval} iterations. If you're making progress, continue. If you're stuck, declare done with what you have so far.`
      );
      if (lastFiveActions.length > 6) lastFiveActions.shift();
    } else if (iter === softNudgeInterval * 2) {
      lastFiveActions.push(
        `SYSTEM: You've been working for ${softNudgeInterval * 2} iterations. Wrap up — declare done with your current findings, even if incomplete.`
      );
      if (lastFiveActions.length > 6) lastFiveActions.shift();
    } else if (iter === softNudgeInterval * 3) {
      lastFiveActions.push(
        `SYSTEM: Final warning — declare done NOW with whatever you have.`
      );
      if (lastFiveActions.length > 6) lastFiveActions.shift();
    }
    // Between iterations the agent is thinking / looking at the screen
    desktopBus.emit({ type: 'ai_cursor_state', state: 'thinking' });

    // 1. Capture screenshot (desktop by default)
    try {
      currentScreenshot = await captureDesktop(desktopEl);
      onScreenshot?.(currentScreenshot);
      // Emit screenshot to sidebar for thumbnail display
      desktopBus.emit({ type: 'agent_screenshot', stepIndex: 0, screenshot: currentScreenshot, iteration: iter });
    } catch (err) {
      onStatus?.(`[Executor] Screenshot failed: ${err}`);
      break;
    }

    if (signal?.aborted) break;

    // Gate reading pause to browser actions only (QW-6)
    // For desktop DOM actions, a short flat pause is sufficient.
    const lastActionType = lastFiveActions.length > 0
      ? (lastFiveActions[lastFiveActions.length - 1].match(/^\d+\[(?:SUCCESS|FAILED)\]: (\S+)/) ?? [])[1] ?? ''
      : '';
    const lastWasBrowserAction = lastActionType.startsWith('browser_') || lastActionType.startsWith('page_');
    if (lastWasBrowserAction || lastFiveActions.length === 0) {
      // Human-like reading pause proportional to screenshot size (browser context)
      await sleep(readingPause(currentScreenshot.length));
    } else {
      await sleep(50);
    }
    if (signal?.aborted) break;

    // 2. (ME-2) Skip separate verifyState LLM call — executor now includes screenState in its JSON.
    // lastStateDescription carries forward from the previous iteration's action screenState field.
    onStatus?.(`[Executor] Screen state: ${lastStateDescription.slice(0, 120)}`);

    if (signal?.aborted) break;

    // 3. Executor LLM: decide next action
    // Count repeated failed actions and append hint if any action has failed 2+ times
    const failedCounts = new Map<string, number>();
    for (const entry of lastFiveActions) {
      if (entry.includes('[FAILED]')) {
        const key = entry.replace(/^\d+\[FAILED\]: /, '').split(' — ')[0];
        failedCounts.set(key, (failedCounts.get(key) ?? 0) + 1);
      }
    }
    const repeatedFailures = [...failedCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([action]) => `  - ${action}`);

    const actionsWithHints = repeatedFailures.length > 0
      ? [...lastFiveActions, `HINT: These actions have failed repeatedly, avoid them:\n${repeatedFailures.join('\n')}`]
      : lastFiveActions;

    // Brief think pause — human-like for browser context, flat 50ms for desktop DOM (QW-6)
    await sleep(lastWasBrowserAction || lastFiveActions.length === 0 ? thinkPause() : 50);
    if (signal?.aborted) break;

    const action = await decideAction(
      step,
      currentScreenshot,
      lastStateDescription,
      actionsWithHints.slice(-5),
      iter,
      signal,
    );
    // ME-2: capture screenState from executor JSON to use as context next iteration
    if (action.screenState) {
      lastStateDescription = action.screenState;
    }
    onStatus?.(`[Executor] Action: ${action.type} — ${action.reasoning}`);

    // Emit human-readable action description for sidebar visibility
    {
      let desc = '';
      switch (action.type) {
        case 'browser_click':
        case 'click':
          desc = `Clicking "${action.targetText || action.selector || 'element'}" at (${action.x ?? '?'}, ${action.y ?? '?'})`;
          break;
        case 'browser_type':
        case 'type':
          desc = `Typing "${(action.text ?? '').slice(0, 40)}${(action.text ?? '').length > 40 ? '...' : ''}"${action.selector ? ` into ${action.selector}` : ''}`;
          break;
        case 'browser_navigate':
          desc = `Navigating to ${(action.url ?? '').slice(0, 60)}${(action.url ?? '').length > 60 ? '...' : ''}`;
          break;
        case 'browser_scroll':
        case 'scroll':
          desc = `Scrolling ${action.direction ?? 'down'} ${action.distance ?? 300}px`;
          break;
        case 'browser_press':
        case 'press':
          desc = `Pressing ${action.key ?? 'Enter'}`;
          break;
        case 'browser_screenshot':
          desc = 'Taking screenshot';
          break;
        case 'browser_drag':
          desc = `Dragging from (${action.startX}, ${action.startY}) to (${action.endX}, ${action.endY})`;
          break;
        case 'browser_hover':
          desc = `Hovering at (${action.x ?? '?'}, ${action.y ?? '?'})`;
          break;
        case 'browser_eval':
          desc = `Evaluating JS: ${(action.script ?? '').slice(0, 50)}`;
          break;
        case 'browser_extract_text':
          desc = 'Extracting page text';
          break;
        case 'browser_back':
          desc = 'Navigating back';
          break;
        case 'browser_reload':
          desc = 'Reloading page';
          break;
        case 'browser_select':
          desc = `Selecting "${action.optionText || action.value || ''}" in ${action.selector || 'dropdown'}`;
          break;
        case 'browser_shortcut':
          desc = `Shortcut: ${action.keys ?? ''}`;
          break;
        case 'desktop_open_app':
          desc = `Opening ${action.app ?? 'app'}`;
          break;
        case 'desktop_close_window':
          desc = `Closing ${action.app ?? 'window'}`;
          break;
        case 'desktop_drag_window':
          desc = `Moving ${action.app ?? 'window'} to (${action.toX ?? '?'}, ${action.toY ?? '?'})`;
          break;
        case 'desktop_resize_window':
          desc = `Resizing ${action.app ?? 'window'} to ${action.width ?? '?'}x${action.height ?? '?'}`;
          break;
        case 'desktop_focus_window':
          desc = `Focusing ${action.app ?? 'window'}`;
          break;
        case 'desktop_scroll':
          desc = `Scrolling ${action.direction ?? 'down'} in ${action.app ?? 'window'}`;
          break;
        case 'finder_navigate':
          desc = `Finder: navigating to ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'finder_select_file':
          desc = `Finder: selecting ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'finder_open_file':
          desc = `Finder: opening ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'terminal_run':
          desc = `Terminal: ${(action.command ?? '').slice(0, 50)}`;
          break;
        case 'terminal_read':
          desc = 'Terminal: reading output';
          break;
        case 'file_create':
          desc = `File: creating ${action.name ?? 'file'} in ${(action.path ?? '').slice(0, 40)}`;
          break;
        case 'file_read':
          desc = `File: reading ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'file_write':
          desc = `File: writing ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'file_delete':
          desc = `File: deleting ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'file_rename':
          desc = `File: renaming to ${action.newName ?? '?'}`;
          break;
        case 'file_move':
          desc = `File: moving to ${(action.destPath ?? '').slice(0, 40)}`;
          break;
        case 'file_download':
          desc = `File: downloading to ${(action.destPath ?? '').slice(0, 40)}`;
          break;
        case 'file_list':
          desc = `File: listing ${(action.path ?? '').slice(0, 50)}`;
          break;
        case 'done':
          desc = 'Step completed';
          break;
        case 'fail':
          desc = `Failed: ${(action.reasoning ?? '').slice(0, 60)}`;
          break;
        case 'wait':
          desc = 'Waiting...';
          break;
        default:
          desc = `${action.type}`;
      }
      desktopBus.emit({
        type: 'agent_action_desc',
        stepIndex: 0,
        description: desc,
        actionType: action.type,
        iteration: iter,
        screenState: action.screenState,
      });
    }

    desktopBus.emit({
      type: 'agent_step_start',
      stepIndex: iter - 1,
      description: action.reasoning ?? step.instruction,
      reasoning: action.selfCheck || action.reasoning || '',
    });

    // 4. Handle terminal actions
    if (action.type === 'done') {
      doneResult = action.result || action.reasoning || '';
      // Never accept done on iteration 1
      if (iter <= 1) {
        onStatus?.(`[Executor] Model said done too early (iter ${iter}), requiring verification...`);
        lastFiveActions.push(`HINT: The task does not appear complete yet. Continue.`);
        if (lastFiveActions.length > 5) lastFiveActions.shift();
        // Don't break — do at least one more verification iteration
      } else {
        // Require verifyState to return success:true AND confidence high or medium
        const doneCheck = await verifyState(step.expectedState, currentScreenshot, signal);
        if (doneCheck.matches && (doneCheck.confidence === 'high' || doneCheck.confidence === 'medium')) {
          onStatus?.(`[Executor] Step verified done (${doneCheck.confidence} confidence): ${doneResult.slice(0, 100)}`);
          break;
        } else {
          onStatus?.(`[Executor] Model said done but state not verified (confidence=${doneCheck.confidence}, ${doneCheck.currentStateDescription.slice(0, 100)}), continuing...`);
          lastFiveActions.push(`HINT: The task does not appear complete yet. Continue.`);
          if (lastFiveActions.length > 5) lastFiveActions.shift();
          // Don't break — state not confirmed, keep looping
        }
      }
    }
    if (action.type === 'fail') {
      const result: StepResult = {
        stepId: step.id,
        success: false,
        result: `Executor declared failure: ${action.reasoning}`,
        screenshot: currentScreenshot,
        currentStateDescription: lastStateDescription,
        actionsTaken,
        failureReason: action.reasoning,
      };
      return result;
    }
    if (action.type === 'wait') {
      onStatus?.('[Executor] Waiting 1s...');
      await sleep(1000);
      continue;
    }

    // 5a. Action loop detection — same action+coords repeated 3+ times in a row
    {
      const sig = `${action.type}:${Math.round((action.x ?? 0) / 5) * 5}:${Math.round((action.y ?? 0) / 5) * 5}`;
      recentActionSignatures.push(sig);
      if (recentActionSignatures.length > 6) recentActionSignatures.shift();
      const repeatCount = recentActionSignatures.filter(s => s === sig).length;
      if (repeatCount >= 3) {
        onStatus?.(`[Executor] Action loop detected (${sig} repeated ${repeatCount}x), injecting hint`);
        lastFiveActions.push(
          `SYSTEM: You've repeated this action multiple times with no progress. Try a different approach — scroll down, look for alternative buttons, or use keyboard shortcuts.`
        );
        if (lastFiveActions.length > 5) lastFiveActions.shift();
        recentActionSignatures.length = 0; // reset loop tracker after hint
      }
    }

    // 5b. Attention drift recovery:
    // If we've been scrolling down for 3+ consecutive iterations without finding
    // the target, pause and scroll back up a bit — simulates a human re-checking.
    if (action.type === 'browser_scroll' && action.direction === 'down') {
      consecutiveScrollDownCount++;
      totalScrolledDownPx += action.distance ?? 400;
    } else if (action.type !== 'browser_screenshot') {
      consecutiveScrollDownCount = 0;
    }

    if (consecutiveScrollDownCount >= 3) {
      onStatus?.('[Executor] Attention drift — scrolling back up to re-check...');
      await sleep(500);
      if (!signal?.aborted && wayfarerSession?.isOpen) {
        const scrollBackPx = Math.round(totalScrolledDownPx * 0.30);
        await wayfarerSession.scroll('up', scrollBackPx, signal);
      }
      consecutiveScrollDownCount = 0;
      totalScrolledDownPx = 0;
      await sleep(300);
    }

    // 5c-pre. Desktop / Finder / Terminal actions — handled via desktopBus, not Wayfarer
    const isDesktopMgmtAction = action.type.startsWith('desktop_')
      || action.type.startsWith('finder_')
      || action.type.startsWith('terminal_');

    if (isDesktopMgmtAction) {
      onContextSwitch?.('desktop');
      switch (action.type) {
        case 'desktop_open_app':
          desktopBus.emit({ type: 'open_window', app: (action.app || 'chrome') as 'chrome' | 'finder' | 'terminal' });
          break;
        case 'desktop_close_window':
          desktopBus.emit({ type: 'close_window', app: (action.app || 'chrome') as string });
          break;
        case 'desktop_drag_window':
          desktopBus.emit({ type: 'move_window', app: action.app || 'chrome', x: action.toX ?? 100, y: action.toY ?? 100 });
          break;
        case 'desktop_resize_window':
          desktopBus.emit({ type: 'resize_window', app: action.app || 'chrome', width: action.width ?? 800, height: action.height ?? 600 });
          break;
        case 'desktop_focus_window':
          desktopBus.emit({ type: 'focus_window', app: (action.app || 'chrome') as string });
          break;
        case 'desktop_scroll':
          if (action.app === 'chrome' || !action.app) {
            if (wayfarerSession?.isOpen && wayfarerSession.healthy) {
              await wayfarerSession.scrollAt(action.direction ?? 'down', action.amount ?? 300, undefined, undefined, signal);
            }
          } else {
            desktopBus.emit({ type: 'window_scroll', app: action.app, direction: action.direction ?? 'down', amount: action.amount ?? 300 });
          }
          break;
        case 'finder_navigate':
          desktopBus.emit({ type: 'open_window', app: 'finder' });
          desktopBus.emit({ type: 'finder_navigate', path: action.path || '/' });
          break;
        case 'finder_select_file':
          desktopBus.emit({ type: 'finder_select_file', path: action.path || '' });
          break;
        case 'finder_open_file':
          desktopBus.emit({ type: 'finder_open_file', path: action.path || '' });
          break;
        case 'terminal_run':
          desktopBus.emit({ type: 'open_window', app: 'terminal' });
          desktopBus.emit({ type: 'terminal_run', command: action.command || '' });
          break;
        case 'terminal_read':
          break;
      }
      await sleep(400);
      try {
        const updatedShot = await captureDesktop(desktopEl);
        currentScreenshot = updatedShot;
        onScreenshot?.(currentScreenshot);
      } catch { /* keep previous screenshot */ }

      const actionRecord = `${iter}[SUCCESS]: ${action.type}(${action.app ?? ''}${action.path ? ',path=' + action.path.slice(0, 30) : ''}${action.command ? ',cmd=' + action.command.slice(0, 30) : ''}) — ${action.reasoning}`;
      actionsTaken.push(actionRecord);
      lastFiveActions.push(actionRecord);
      if (lastFiveActions.length > 5) lastFiveActions.shift();
      continue;
    }

    // 5c-file. File operations — handled directly via VFS, no browser/desktop needed
    const isFileAction = action.type.startsWith('file_');
    if (isFileAction) {
      try {
        const { vfs } = await import('../sessionFileSystem');
        switch (action.type) {
          case 'file_create': {
            const filePath = action.path || '/nomad/shared';
            const fileName = action.name || 'untitled.txt';
            const fileContent = action.content || '';
            const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
            const mimeMap: Record<string, string> = {
              txt: 'text/plain', md: 'text/markdown', json: 'application/json',
              csv: 'text/csv', html: 'text/html', css: 'text/css',
              js: 'text/javascript', ts: 'text/typescript',
            };
            vfs.createFile(filePath, fileName, fileContent, mimeMap[ext] || 'text/plain');
            onStatus?.(`[Executor] Created file: ${fileName} in ${filePath}`);
            findings.push(`Created file: ${filePath}/${fileName} (${fileContent.length} chars)`);
            break;
          }
          case 'file_read': {
            const readNode = vfs.readFile(action.path || '');
            if (readNode?.data) {
              const snippet = readNode.data.slice(0, 500);
              onStatus?.(`[Executor] Read file: ${readNode.name} (${readNode.data.length} chars)`);
              findings.push(`File ${readNode.name}: ${snippet}`);
              lastFiveActions.push(`file_read: ${readNode.name} -- ${snippet.slice(0, 100)}`);
              if (lastFiveActions.length > 5) lastFiveActions.shift();
            } else {
              onStatus?.(`[Executor] file_read: file not found or empty at ${action.path}`);
            }
            break;
          }
          case 'file_write': {
            const writeNode = vfs.readFile(action.path || '');
            if (writeNode) {
              const parentDir = (action.path || '').slice(0, (action.path || '').lastIndexOf('/'));
              vfs.createFile(parentDir, writeNode.name, action.content || '', writeNode.mimeType || 'text/plain');
              onStatus?.(`[Executor] Updated file: ${writeNode.name}`);
            } else {
              onStatus?.(`[Executor] file_write: file not found at ${action.path}`);
            }
            break;
          }
          case 'file_delete': {
            const deleted = vfs.deleteNode(action.path || '');
            onStatus?.(`[Executor] ${deleted ? 'Deleted' : 'Could not delete'}: ${action.path}`);
            break;
          }
          case 'file_rename': {
            const renamed = vfs.renameNode(action.path || '', action.newName || '');
            onStatus?.(`[Executor] ${renamed ? 'Renamed' : 'Could not rename'}: ${action.path} -> ${action.newName}`);
            break;
          }
          case 'file_move': {
            const moved = vfs.moveNode(action.path || '', action.destPath || '');
            onStatus?.(`[Executor] ${moved ? 'Moved' : 'Could not move'}: ${action.path} -> ${action.destPath}`);
            break;
          }
          case 'file_download': {
            if (wayfarerSession?.isOpen && wayfarerSession.healthy) {
              const pageText = await wayfarerSession.extractText(signal);
              const destDir = action.destPath || '/nomad/shared';
              const safeName = (action.url || 'page').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) + '.txt';
              vfs.createFile(destDir, safeName, pageText, 'text/plain');
              onStatus?.(`[Executor] Downloaded page content to ${destDir}/${safeName}`);
              findings.push(`Downloaded ${safeName}: ${pageText.slice(0, 200)}`);
            } else {
              onStatus?.('[Executor] file_download: no browser session available');
            }
            break;
          }
          case 'file_list': {
            const folder = vfs.listFolder(action.path || '/nomad');
            const listing = folder.map(n => `${n.type === 'folder' ? '[dir]' : '[file]'} ${n.name}`).join(', ');
            onStatus?.(`[Executor] file_list ${action.path}: ${listing.slice(0, 200)}`);
            findings.push(`Folder ${action.path}: ${listing}`);
            lastFiveActions.push(`file_list: ${listing.slice(0, 100)}`);
            if (lastFiveActions.length > 5) lastFiveActions.shift();
            break;
          }
        }
        const fileRecord = `${iter}[SUCCESS]: ${action.type}(${action.path || action.name || ''}) -- ${action.reasoning}`;
        actionsTaken.push(fileRecord);
        lastFiveActions.push(fileRecord);
        if (lastFiveActions.length > 5) lastFiveActions.shift();
      } catch (fileErr) {
        const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
        onStatus?.(`[Executor] File action failed: ${msg}`);
        lastFiveActions.push(`${iter}[FAILED]: ${action.type} -- ${msg}`);
        if (lastFiveActions.length > 5) lastFiveActions.shift();
      }
      continue;
    }

    // 5d. Execute action — browser or desktop
    const isBrowserAction = action.type.startsWith('browser_');

    if (isBrowserAction && wayfarerSession?.isOpen && wayfarerSession.healthy) {
      // ── Browser path: Playwright via Wayfarer ──
      onContextSwitch?.('browser');

      // Emit cursor position before executing the action
      {
        const hasCoords = action.x !== undefined && action.y !== undefined;
        if (action.type === 'browser_navigate') {
          // Navigating: cursor goes to thinking state (loading new page)
          desktopBus.emit({ type: 'ai_cursor_state', state: 'thinking' });
        } else if (hasCoords) {
          const desktopCoords = browserToDesktopCoords(action.x ?? 0, action.y ?? 0, desktopEl);
          desktopBus.emit({ type: 'ai_cursor_move', x: desktopCoords.x, y: desktopCoords.y, state: 'acting' });
        }
      }

      try {
        switch (action.type) {
          case 'browser_navigate': {
            // Fix #4: normalise URL before navigating
            const normUrl = normaliseUrl(action.url ?? '');
            if (!normUrl) {
              onStatus?.('[Executor] browser_navigate: blank/empty URL — skipping');
              break;
            }
            await wayfarerSession.navigate(normUrl, signal);
            // Exponential backoff polling: 300, 600, 1200, 2400, 4800ms = max ~9.3s total
            {
              let pageReady = false;
              const backoffDelays = [300, 600, 1200, 2400, 4800];
              for (let attempt = 0; attempt < backoffDelays.length && !pageReady; attempt++) {
                await new Promise(r => setTimeout(r, backoffDelays[attempt]));
                if (signal?.aborted) break;
                try {
                  // Check document.readyState via evaluate if available
                  let readyStateComplete = false;
                  try {
                    const evalResult = await wayfarerSession.evalJs('document.readyState', signal);
                    readyStateComplete = evalResult === 'complete' || evalResult === 'interactive';
                  } catch { /* evaluate not supported or failed — fall through */ }

                  const probe = await wayfarerSession.screenshot(signal);
                  // Consider page ready if we get a valid screenshot with a real URL
                  // and (if we could check) the document is ready
                  if (probe.url && probe.url !== 'about:blank' && probe.image_base64) {
                    if (readyStateComplete || attempt >= 2) {
                      pageReady = true;
                      currentScreenshot = probe.image_base64;
                      // Update screenshot dims for coordinate scaling (fix #3)
                      if (probe.width && probe.height) {
                        screenshotDims = { width: probe.width, height: probe.height };
                      }
                      if (probe.url) options.onBrowserUrl?.(probe.url);
                    }
                  }
                } catch { /* still loading */ }
              }
              if (!pageReady) {
                // Fallback: just take screenshot with whatever loaded
                try {
                  const fallbackShot = await wayfarerSession.screenshot(signal);
                  if (fallbackShot.image_base64) currentScreenshot = fallbackShot.image_base64;
                  if (fallbackShot.width && fallbackShot.height) {
                    screenshotDims = { width: fallbackShot.width, height: fallbackShot.height };
                  }
                  if (fallbackShot.url) options.onBrowserUrl?.(fallbackShot.url);
                } catch { /* non-critical */ }
              }
            }
            break;
          }
          case 'browser_click': {
            // QW-5: warn if dims stayed at default (may indicate missing viewport data)
            if (screenshotDims.width === DEFAULT_VIEWPORT.width && screenshotDims.height === DEFAULT_VIEWPORT.height) {
              console.warn('[Executor] screenshotDims at default — viewport data not received from server');
            }

            // ME-1: Selector-first hybrid click — try DOM targeting before pixel coords
            let clickX = action.x ?? 640;
            let clickY = action.y ?? 400;
            // Track whether coords came from DOM (already in viewport space — no scaling needed)
            let coordsFromDom = false;

            if (action.selector || action.targetText) {
              try {
                const evalScript = action.selector
                  ? `(()=>{const el=document.querySelector(${JSON.stringify(action.selector)});if(el){const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,found:true}}return {found:false}})()`
                  : `(()=>{const els=document.querySelectorAll('a,button,input,[role="button"],label,span,div');const el=Array.from(els).find(e=>e.textContent?.trim().includes(${JSON.stringify(action.targetText ?? '')}));if(el){const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,found:true}}return {found:false}})()`;
                const domResult = await wayfarerSession.evalJs(evalScript, signal) as { found?: boolean; x?: number; y?: number } | null;
                if (domResult?.found && domResult.x !== undefined && domResult.x > 0) {
                  clickX = domResult.x;
                  clickY = domResult.y ?? clickY;
                  coordsFromDom = true;
                  onStatus?.(`[Executor] selector-first: found at ${clickX},${clickY} via ${action.selector || action.targetText}`);
                }
              } catch {
                // fall through to pixel coordinates
              }
            }

            // Fix #3: scale coordinates from screenshot dims to actual viewport
            // Skip scaling when coords came from DOM getBoundingClientRect (already viewport space)
            const scaled = coordsFromDom
              ? { x: Math.round(clickX), y: Math.round(clickY) }
              : scaleCoords(clickX, clickY, screenshotDims, browserViewport);
            // Fix #5: add small human-like jitter
            const finalX = jitterCoord(scaled.x);
            const finalY = jitterCoord(scaled.y);
            const dc = browserToDesktopCoords(finalX, finalY, desktopEl);
            desktopBus.emit({ type: 'ai_cursor_move', x: dc.x, y: dc.y, state: 'acting' });
            await wayfarerSession.click(finalX, finalY, signal);
            // Emit click ripple after the click lands
            desktopBus.emit({ type: 'ai_cursor_click', x: dc.x, y: dc.y });
            // Post-click reaction pause (browser context)
            await sleep(clickPause());
            break;
          }
          case 'browser_type':
            await wayfarerSession.type(action.text ?? '', action.selector, action.clear ?? true, signal);
            break;
          case 'browser_scroll': {
            const scrollDir = action.direction ?? 'down';
            const scrollDist = action.distance ?? 300;
            await wayfarerSession.scrollAt(scrollDir, scrollDist, action.x, action.y, signal);
            break;
          }
          case 'browser_press':
            await wayfarerSession.press(action.key ?? 'Enter', signal);
            // Enter often triggers navigation or form submission — add a nav-style wait
            if ((action.key ?? 'Enter') === 'Enter') {
              await sleep(navPause());
            }
            break;
          case 'browser_screenshot':
            // fall through — screenshot taken below
            break;
          case 'browser_drag': {
            const dragStart = scaleCoords(action.startX ?? 0, action.startY ?? 0, screenshotDims, browserViewport);
            const dragEnd = scaleCoords(action.endX ?? 0, action.endY ?? 0, screenshotDims, browserViewport);
            const dragStartDc = browserToDesktopCoords(dragStart.x, dragStart.y, desktopEl);
            desktopBus.emit({ type: 'ai_cursor_move', x: dragStartDc.x, y: dragStartDc.y, state: 'dragging' });
            await wayfarerSession.drag(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y, signal);
            const dragEndDc = browserToDesktopCoords(dragEnd.x, dragEnd.y, desktopEl);
            desktopBus.emit({ type: 'ai_cursor_move', x: dragEndDc.x, y: dragEndDc.y, state: 'acting' });
            break;
          }
          case 'browser_shortcut':
            // Fix #6: send keyboard shortcut via dedicated shortcut endpoint
            await wayfarerSession.shortcut(action.keys ?? 'Escape', signal);
            break;
          case 'browser_select': {
            // QW-1: select a <select> dropdown option by value or visible text
            const sel = action.selector || 'select';
            const val = action.value || action.optionText || '';
            await wayfarerSession.evalJs(
              `(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(el){const opt=Array.from(el.options).find(o=>o.value===${JSON.stringify(val)}||o.text.includes(${JSON.stringify(val)}));if(opt){el.value=opt.value;el.dispatchEvent(new Event('change',{bubbles:true}))}}})()`,
              signal,
            );
            break;
          }
          case 'browser_back':
            // QW-2: navigate back in browser history
            await wayfarerSession.action({ action: 'back' }, signal);
            await sleep(navPause());
            break;
          case 'browser_reload':
            // QW-2: reload the current page
            await wayfarerSession.action({ action: 'reload' }, signal);
            await sleep(navPause());
            break;
          case 'browser_eval': {
            // QW-2: evaluate JS and log result
            const evalResult = await wayfarerSession.evalJs(action.script || '', signal);
            const evalStr = JSON.stringify(evalResult);
            onStatus?.(`[Executor] browser_eval result: ${evalStr.slice(0, 200)}`);
            lastFiveActions.push(`eval: ${(action.script || '').slice(0, 60)} → ${evalStr.slice(0, 80)}`);
            if (lastFiveActions.length > 5) lastFiveActions.shift();
            // Accumulate eval results as findings
            if (evalStr.length > 5) findings.push(`eval(${(action.script || '').slice(0, 40)}): ${evalStr.slice(0, 400)}`);
            break;
          }
          case 'browser_extract_text': {
            // QW-2: extract page text and surface as context
            const pageText = await wayfarerSession.extractText(signal);
            const snippet = pageText.slice(0, 500);
            onStatus?.(`[Executor] browser_extract_text: ${snippet}`);
            lastFiveActions.push(`extract_text: ${snippet}`);
            if (lastFiveActions.length > 5) lastFiveActions.shift();
            // Accumulate extracted text as a finding (up to 800 chars)
            findings.push(pageText.slice(0, 800));
            break;
          }
          case 'browser_hover': {
            // QW-3: hover over element (use before dropdown menus that require hover to appear)
            const hoverScaled = scaleCoords(action.x ?? 0, action.y ?? 0, screenshotDims, browserViewport);
            const hoverDc = browserToDesktopCoords(hoverScaled.x, hoverScaled.y, desktopEl);
            desktopBus.emit({ type: 'ai_cursor_move', x: hoverDc.x, y: hoverDc.y, state: 'acting' });
            await wayfarerSession.action({ action: 'hover', click_x: hoverScaled.x, click_y: hoverScaled.y }, signal);
            break;
          }
          default:
            onStatus?.(`[Executor] Unknown browser action type: ${action.type}`);
            break;
        }
        // After any browser action, invalidate the cache and get the real browser view from Wayfarer
        invalidateScreenshotCache();
        const browserShot = await wayfarerSession.screenshot(signal);
        currentScreenshot = browserShot.image_base64;
        // Update screenshot dims for next coordinate scaling
        if (browserShot.width && browserShot.height) {
          screenshotDims = { width: browserShot.width, height: browserShot.height };
        }
        onScreenshot?.(currentScreenshot);
        // Emit post-action screenshot for sidebar thumbnail
        desktopBus.emit({ type: 'agent_screenshot', stepIndex: 0, screenshot: currentScreenshot, iteration: iter });
      } catch (browserErr) {
        const errMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
        onStatus?.(`[Executor] Browser action failed: ${errMsg}`);

        // Session recovery: if the session died (connection refused, HTTP 5xx, no session),
        // try to reopen it once. If that also fails, mark it unhealthy and continue
        // with desktop-only execution for the remaining iterations.
        const isSessionDead = errMsg.includes('no open session')
          || errMsg.includes('Failed to fetch')
          || errMsg.includes('HTTP 5')
          || errMsg.includes('network')
          || errMsg.includes('ECONNREFUSED');

        if (isSessionDead && wayfarerSession) {
          onStatus?.('[Executor] Session appears dead, attempting recovery...');
          try {
            await wayfarerSession.close();
            const lastUrl = wayfarerSession.id ? '' : 'about:blank';
            await wayfarerSession.open(lastUrl, signal);
            if (wayfarerSession.isOpen && wayfarerSession.healthy) {
              onStatus?.('[Executor] Session recovered successfully');
            } else {
              onStatus?.('[Executor] Session recovery returned unhealthy, continuing with desktop only');
            }
          } catch (recoveryErr) {
            onStatus?.(`[Executor] Session recovery failed: ${recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)}`);
            wayfarerSession.healthy = false;
          }
        }
      }
    } else {
      // ── Desktop path: DOM event dispatch ──
      onContextSwitch?.('desktop');
      // Emit cursor move for desktop click/scroll actions
      if ((action.type === 'click' || action.type === 'scroll') && action.x !== undefined && action.y !== undefined) {
        desktopBus.emit({ type: 'ai_cursor_move', x: action.x, y: action.y, state: 'acting' });
        if (action.type === 'click') {
          desktopBus.emit({ type: 'ai_cursor_click', x: action.x, y: action.y });
        }
      }
      const actionDispatched = executeAction(action, desktopEl);
      if (!actionDispatched) {
        onStatus?.(`[Executor] Action skipped — element not visible or not found`);
      }
      await sleep(600);

      // Re-capture desktop view after DOM action
      try {
        const updatedShot = await captureDesktop(desktopEl);
        currentScreenshot = updatedShot;
        onScreenshot?.(currentScreenshot);
      } catch {
        // keep previous screenshot
      }
    }

    if (signal?.aborted) break;

    // 6. Self-check: only every 3rd iteration to save time (the next screenshot already shows if it worked)
    const doSelfCheck = iter % 3 === 0;
    if (doSelfCheck) {
      desktopBus.emit({ type: 'agent_step_verify' });
      const selfCheck = await verifyState(
        `Did the action "${action.reasoning}" succeed? ${step.expectedState}`,
        currentScreenshot,
        signal,
      );
      onStatus?.(`[Executor] Self-check: ${selfCheck.matches ? 'success' : 'not yet'} — ${selfCheck.currentStateDescription.slice(0, 100)}`);
      desktopBus.emit({
        type: 'agent_action_desc',
        stepIndex: 0,
        description: selfCheck.matches ? 'Verifying... OK' : 'Verifying... not yet',
        actionType: 'verify',
        iteration: iter,
      });

      const outcome = selfCheck?.matches ? 'SUCCESS' : 'FAILED';
      const actionRecord = `${iter}[${outcome}]: ${action.type}(${action.x ?? ''},${action.y ?? ''}${action.text ? ',text=' + action.text.slice(0, 20) : ''}${action.url ? ',url=' + action.url : ''}) — ${action.reasoning}`;
      actionsTaken.push(actionRecord);
      lastFiveActions.push(actionRecord);
      if (lastFiveActions.length > 5) lastFiveActions.shift();

      if (selfCheck.matches && selfCheck.confidence !== 'low') {
        onStatus?.(`[Executor] Step verified (${selfCheck.confidence} confidence)`);
        lastStateDescription = selfCheck.currentStateDescription;
        break;
      }
      if (selfCheck.matches && selfCheck.confidence === 'low') {
        onStatus?.(`[Executor] Possible match but low confidence, continuing...`);
      }
    } else {
      // Skip self-check: record action optimistically and continue
      const actionRecord = `${iter}[PENDING]: ${action.type}(${action.x ?? ''},${action.y ?? ''}${action.text ? ',text=' + action.text.slice(0, 20) : ''}${action.url ? ',url=' + action.url : ''}) — ${action.reasoning}`;
      actionsTaken.push(actionRecord);
      lastFiveActions.push(actionRecord);
      if (lastFiveActions.length > 5) lastFiveActions.shift();
    }
  }

  // 7. State Capture: final verification of expectedState
  let finalScreenshot = currentScreenshot;
  try {
    finalScreenshot = await captureDesktop(desktopEl);
    onScreenshot?.(finalScreenshot);
  } catch {
    // use currentScreenshot
  }

  const finalVerification = await verifyState(step.expectedState, finalScreenshot, signal);

  // Build a rich result that includes accumulated findings
  // Prefer the executor's own done result if available (more specific than vision verify)
  const baseResult = finalVerification.matches
    ? (doneResult || `Step achieved: ${finalVerification.currentStateDescription}`)
    : `Step incomplete: ${finalVerification.discrepancy ?? 'Unknown discrepancy'}`;
  const richResult = findings.length > 0
    ? `${baseResult}\n\nFindings:\n${findings.join('\n---\n').slice(0, 2000)}`
    : baseResult;

  return {
    stepId: step.id,
    success: finalVerification.matches,
    result: richResult,
    screenshot: finalScreenshot,
    currentStateDescription: finalVerification.currentStateDescription,
    actionsTaken,
    failureReason: finalVerification.matches ? undefined : finalVerification.discrepancy,
  };
}
