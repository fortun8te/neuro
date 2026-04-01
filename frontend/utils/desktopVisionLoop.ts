/**
 * desktopVisionLoop — vision-driven desktop control.
 *
 * Screenshots the desktop React component via html2canvas,
 * sends the image to the vision model, gets a click/type/scroll/done action,
 * executes it on the DOM, repeats until goal achieved or max steps reached.
 *
 * No tools. No explicit bridges. The model just looks at the screen and acts.
 */

import { ollamaService } from './ollama';
import { getVisionModel } from './modelConfig';
import { createLogger } from './logger';

const log = createLogger('desktop-vision');

export interface DesktopAction {
  action: 'click' | 'type' | 'scroll' | 'press' | 'done';
  x?: number;         // pixel x in the DESKTOP ELEMENT's local coordinate space
  y?: number;         // pixel y in the DESKTOP ELEMENT's local coordinate space
  text?: string;      // for type action
  key?: string;       // for press: "Enter", "Escape", "Tab", etc.
  direction?: 'up' | 'down'; // for scroll
  reasoning: string;
  done?: boolean;
}

export interface VisionLoopOptions {
  signal?: AbortSignal;
  onStep?: (description: string) => void;
  onScreenshot?: (base64: string) => void;
  maxSteps?: number;
}

/** Capture the desktop element as a JPEG base64 string using html2canvas */
async function captureDesktop(el: HTMLElement): Promise<string> {
  // html2canvas is already in the project (used for PDF export)
  // Import it dynamically to avoid bundle bloat at module load time
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, {
    scale: 1,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
  // Return just the base64 data (strip data URL prefix)
  return canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
}

const VISION_SYSTEM_PROMPT = `You control a macOS-style desktop UI. Look at the screenshot and decide the single next action to accomplish the goal.

Output ONLY valid JSON (no markdown, no explanation):
{
  "action": "click|type|scroll|press|done",
  "x": <integer pixel x coordinate in the screenshot>,
  "y": <integer pixel y coordinate in the screenshot>,
  "text": "<text to type — only for type action>",
  "key": "<key name — only for press action: Enter, Escape, Tab, Backspace>",
  "direction": "down",
  "reasoning": "<one sentence>",
  "done": false
}

Rules:
- For click: x and y are pixel coordinates visible in the screenshot. Click the center of the target element.
- For type: first click the input field, then use type on the next step.
- Set done=true when the goal is fully complete.
- After every click that opens something (window, menu, dialog), take stock of the new state before acting further.
- The dock is at the bottom. App icons are visible. Windows appear in the desktop area above the dock.`;

async function decideAction(
  goal: string,
  screenshotBase64: string,
  history: string[],
  signal?: AbortSignal,
): Promise<DesktopAction> {
  const historyText = history.slice(-6).join('\n') || 'None yet';
  const prompt =
    `Goal: ${goal}\n\n` +
    `Actions taken so far:\n${historyText}\n\n` +
    `What is the single next action?`;

  let response = '';
  await ollamaService.generateStream(prompt, VISION_SYSTEM_PROMPT, {
    model: getVisionModel(),
    images: [screenshotBase64],
    temperature: 0.1,
    num_predict: 400,
    signal,
    onChunk: (chunk: string) => { response += chunk; },
  });

  // Strip thinking tags if present
  response = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as DesktopAction;
    } catch {
      // fall through
    }
  }

  // Fallback — log the failure and signal done
  log.warn('Could not parse vision response', { responsePreview: response.slice(0, 200) });
  return { action: 'done', reasoning: 'Could not parse vision model response', done: true };
}

/**
 * Wait for DOM stability — observes mutations and resolves once the DOM
 * stops changing for `quietMs`. Falls back to `maxWaitMs` if mutations
 * keep happening (animations, clocks, etc.).
 */
function waitForDomStability(target: HTMLElement, quietMs = 200, maxWaitMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    let lastMutationTime = Date.now();
    let settled = false;

    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastMutationTime >= quietMs || now - lastMutationTime > maxWaitMs) {
        if (!settled) {
          settled = true;
          observer.disconnect();
          clearInterval(checkInterval);
          clearTimeout(maxTimer);
          resolve();
        }
      }
    }, 50);

    const maxTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        observer.disconnect();
        clearInterval(checkInterval);
        resolve();
      }
    }, maxWaitMs);
  });
}

/**
 * Auto-focus: after a click action, if the clicked element is or contains
 * an input/textarea, focus it so the next type action works immediately.
 */
function autoFocusAfterClick(desktopEl: HTMLElement, clientX: number, clientY: number): void {
  const target = document.elementFromPoint(clientX, clientY);
  if (!target) return;

  // Direct input/textarea
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.focus();
    return;
  }

  // Check if the target contains an input (e.g., clicked a label or wrapper)
  const input = (target as HTMLElement).querySelector?.('input, textarea') as HTMLElement | null;
  if (input) {
    input.focus();
  }
}

/**
 * Execute an action on the desktop element.
 * Uses elementFromPoint for clicks — works naturally with React's event system.
 */
function executeAction(action: DesktopAction, desktopEl: HTMLElement): void {
  const rect = desktopEl.getBoundingClientRect();

  if (action.action === 'click' && action.x !== undefined && action.y !== undefined) {
    // Convert from desktop-local coords to viewport coords
    const clientX = rect.left + action.x;
    const clientY = rect.top + action.y;
    const target = document.elementFromPoint(clientX, clientY);
    if (target) {
      // Use native .click() first (works for buttons, links, etc.)
      // Then also dispatch MouseEvent for components listening to synthetic events
      (target as HTMLElement).dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX, clientY }),
      );
      (target as HTMLElement).dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX, clientY }),
      );
      (target as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }),
      );
      // Auto-focus input elements after click
      autoFocusAfterClick(desktopEl, clientX, clientY);
    }
  } else if (action.action === 'type' && action.text) {
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
      // React-compatible value setter
      const proto = active instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(active, action.text);
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  } else if (action.action === 'press' && action.key) {
    const target = document.activeElement ?? desktopEl;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: action.key, bubbles: true }));
    if (action.key === 'Enter') {
      target.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    }
  } else if (action.action === 'scroll') {
    desktopEl.scrollBy({ top: action.direction === 'down' ? 300 : -300, behavior: 'smooth' });
  }
}

/**
 * Run the vision-driven desktop control loop.
 *
 * @param goal        Natural language goal, e.g. "open Chrome and go to google.com"
 * @param desktopEl   The HTMLElement of the desktop container to screenshot and control
 * @param options     Signal, step callback, screenshot callback, max steps
 * @returns           Summary string of what was accomplished
 */
export async function runDesktopVisionLoop(
  goal: string,
  desktopEl: HTMLElement,
  options: VisionLoopOptions = {},
): Promise<string> {
  const { signal, onStep, onScreenshot, maxSteps = 25 } = options;
  const history: string[] = [];

  onStep?.(`[Desktop] Starting vision loop: "${goal.slice(0, 60)}"`);

  for (let step = 1; step <= maxSteps; step++) {
    if (signal?.aborted) break;

    // 1. Capture current screen state
    onStep?.(`[Desktop] Step ${step}/${maxSteps}: capturing screen...`);
    let screenshot: string;
    try {
      screenshot = await captureDesktop(desktopEl);
      onScreenshot?.(screenshot);
    } catch (err) {
      onStep?.(`[Desktop] Screenshot failed: ${err}`);
      break;
    }

    if (signal?.aborted) break;

    // 2. Ask vision model for next action
    onStep?.(`[Desktop] Asking vision model...`);
    const action = await decideAction(goal, screenshot, history, signal);
    onStep?.(`[Desktop] Decision: ${action.action} — ${action.reasoning}`);

    // 3. Check if done
    if (action.done || action.action === 'done') {
      return `Done after ${step - 1} steps: ${action.reasoning}`;
    }

    // 4. Execute action
    executeAction(action, desktopEl);
    history.push(`Step ${step}: ${action.action}(${action.x ?? ''},${action.y ?? ''}${action.text ? ',text=' + action.text : ''}) — ${action.reasoning}`);

    // 5. Wait for DOM to stabilize before next screenshot (dynamic, not fixed 700ms)
    await waitForDomStability(desktopEl, 150, 1200);
  }

  return `Reached ${maxSteps} vision steps. Last actions: ${history.slice(-3).join('; ')}. The agent can call use_computer again to continue.`;
}
