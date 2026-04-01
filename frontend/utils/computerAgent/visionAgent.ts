// @ts-nocheck
/**
 * computerAgent/visionAgent.ts — vision helpers: element location, state verification,
 * and desktop screenshot capture.
 */

import { ollamaService } from '../ollama';
import { getVisionModel, getModelForStage } from '../modelConfig';
import { INFRASTRUCTURE } from '../../config/infrastructure';
import { createLogger } from '../logger';
import type { ElementLocation, StateVerification } from './types';

const log = createLogger('vision');

// ─────────────────────────────────────────────────────────────
// Screenshot cache — per-session, reuses screenshots within maxAgeMs.
// Uses a Map keyed by sessionId to prevent cross-session collisions
// when parallel calls are in flight.
// ─────────────────────────────────────────────────────────────

interface ScreenshotCacheEntry {
  data: string;
  takenAt: number;
}

const _screenshotCache = new Map<string, ScreenshotCacheEntry>();
/** Pending fetch promises — prevents duplicate concurrent fetches for the same session */
const _inflight = new Map<string, Promise<string>>();

/** Max cache entries to prevent unbounded growth */
const MAX_CACHE_ENTRIES = 5;

/**
 * Get a browser session screenshot, reusing a cached copy if taken within maxAgeMs.
 * Uses full resolution (1280x800) to preserve small text, tiny buttons, and fine UI details.
 * Falls back to the full-res POST endpoint if the GET endpoint is unavailable.
 *
 * Thread-safe: concurrent calls for the same session share one in-flight fetch.
 */
export async function getSessionScreenshot(
  sessionId: string,
  signal?: AbortSignal,
  maxAgeMs = 800,
  width = 1280,
  height = 800,
): Promise<string> {
  const now = Date.now();

  // Check per-session cache
  const cached = _screenshotCache.get(sessionId);
  if (cached && now - cached.takenAt < maxAgeMs && cached.data) {
    return cached.data;
  }

  // Deduplicate concurrent fetches for the same session
  const existing = _inflight.get(sessionId);
  if (existing) return existing;

  const fetchPromise = _fetchScreenshot(sessionId, signal, width, height);
  _inflight.set(sessionId, fetchPromise);

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    _inflight.delete(sessionId);
  }
}

/** Internal: actually fetch a screenshot from Wayfarer. */
async function _fetchScreenshot(
  sessionId: string,
  signal?: AbortSignal,
  width = 1280,
  height = 800,
): Promise<string> {
  // Primary: GET endpoint
  try {
    const resp = await fetch(
      `${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/screenshot?width=${width}&height=${height}`,
      { signal },
    );
    if (resp.ok) {
      const json = await resp.json() as { screenshot?: string; image_base64?: string };
      const data = json.screenshot ?? json.image_base64 ?? '';
      if (data) {
        _cacheScreenshot(sessionId, data);
        return data;
      }
    }
  } catch (e) {
    log.debug('GET screenshot failed, trying POST fallback', { sessionId }, e);
  }

  // Fallback: POST to /session/action screenshot
  try {
    const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/session/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, action: 'screenshot' }),
      signal,
    });
    if (resp.ok) {
      const json = await resp.json() as { image_base64?: string };
      const data = json.image_base64 ?? '';
      if (data) {
        _cacheScreenshot(sessionId, data);
        return data;
      }
    }
  } catch (e) {
    log.warn('POST screenshot fallback also failed', { sessionId }, e);
  }

  return '';
}

/** Store screenshot in per-session cache, evicting oldest if over limit. */
function _cacheScreenshot(sessionId: string, data: string): void {
  _screenshotCache.set(sessionId, { data, takenAt: Date.now() });
  // Evict oldest entries if cache grows too large
  if (_screenshotCache.size > MAX_CACHE_ENTRIES) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of _screenshotCache) {
      if (entry.takenAt < oldestTime) { oldestTime = entry.takenAt; oldestKey = key; }
    }
    if (oldestKey) _screenshotCache.delete(oldestKey);
  }
}

/** Invalidate the screenshot cache — call after any action that changes screen state. */
export function invalidateScreenshotCache(sessionId?: string): void {
  if (sessionId) {
    _screenshotCache.delete(sessionId);
  } else {
    _screenshotCache.clear();
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Strip <think>...</think> tags and surrounding whitespace from LLM output */
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/** Extract first JSON object from a string, with fallback */
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

// ─────────────────────────────────────────────────────────────
// Desktop capture
// ─────────────────────────────────────────────────────────────

/**
 * Capture the desktop element as a JPEG base64 string using html2canvas.
 * Returns just the base64 data (no data URL prefix).
 */
export async function captureDesktop(desktopEl: HTMLElement): Promise<string> {
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(desktopEl, {
      scale: 1,
      useCORS: true,
      logging: false,
      allowTaint: true,
      // Prevent non-finite gradient crashes by ignoring elements with problematic styles
      ignoreElements: (el) => {
        try {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage || '';
          // Skip elements with gradient backgrounds that might have non-finite stops
          if (bg.includes('gradient') && el.getBoundingClientRect().width === 0) return true;
        } catch { /* getComputedStyle can throw on detached elements — skip them */ }
        return false;
      },
    });
    return canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
  } catch (err) {
    console.warn('[captureDesktop] html2canvas failed:', err instanceof Error ? err.message : String(err));
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Element location
// ─────────────────────────────────────────────────────────────

const LOCATE_SYSTEM = `You are a UI element locator. Given a screenshot and a description of what to find, return the pixel coordinates of that element.
When locating a reCAPTCHA or "I'm not a robot" checkbox: identify the small square checkbox (usually ~24x24px) at the left side of the reCAPTCHA widget and return its center coordinates. Note whether it is unchecked (empty square) or checked (green checkmark). If an image challenge grid is visible, describe each tile and its coordinates.`;

/**
 * Ask the vision model to locate a UI element in a screenshot.
 */
export async function locateElement(
  query: string,
  screenshotBase64: string,
  signal?: AbortSignal,
): Promise<ElementLocation> {
  const prompt = `Find: "${query}"\nReturn JSON: { found, x, y, elementDescription, confidence }`;

  let response = '';
  await ollamaService.generateStream(prompt, LOCATE_SYSTEM, {
    model: getVisionModel(),
    ...(screenshotBase64 ? { images: [screenshotBase64] } : {}),
    temperature: 0.1,
    num_predict: 200,
    signal,
    onChunk: (chunk: string) => { response += chunk; },
  });

  return parseJsonSafe<ElementLocation>(response, {
    found: false,
    elementDescription: 'Could not parse vision response',
    confidence: 'low',
  });
}

// ─────────────────────────────────────────────────────────────
// State verification
// ─────────────────────────────────────────────────────────────

const VERIFY_SYSTEM = `You are a UI state verifier. Compare the screenshot to the expected state description and report whether it matches.
When you see a reCAPTCHA or "I'm not a robot" checkbox: describe its exact pixel location, note whether it is unchecked (empty square) or checked (green checkmark), note if an image challenge grid is visible, and provide precise coordinates for clicking the checkbox center. Keywords to watch for: captcha, recaptcha, robot, verify, checkbox, human verification.`;

/**
 * Ask the vision model whether the current screenshot matches the expected state.
 */
export async function verifyState(
  expectedState: string,
  screenshotBase64: string,
  signal?: AbortSignal,
): Promise<StateVerification> {
  const prompt = `Expected: "${expectedState}"\nReturn JSON: { matches, confidence, currentStateDescription, discrepancy } where confidence is "high", "medium", or "low"`;

  let response = '';
  await ollamaService.generateStream(prompt, VERIFY_SYSTEM, {
    model: getModelForStage('verify-state'),
    ...(screenshotBase64 ? { images: [screenshotBase64] } : {}),
    temperature: 0.1,
    num_predict: 300,
    signal,
    onChunk: (chunk: string) => { response += chunk; },
  });

  const parsed = parseJsonSafe<Omit<StateVerification, 'screenshot'>>(response, {
    matches: false,
    confidence: 'low',
    currentStateDescription: 'Could not parse vision response',
  });

  if (parsed.currentStateDescription === 'Could not parse vision response') {
    console.warn('[Vision] Failed to parse verifyState response:', response.slice(0, 200));
  }

  return { ...parsed, screenshot: screenshotBase64 };
}
