/**
 * wayfarerSession — Playwright browser session via Wayfarer server.
 *
 * Used by the computer agent executor when interacting with web page content
 * (as opposed to the React desktop UI, which uses DOM events).
 *
 * Wayfarer runs a real Chromium browser via Playwright.
 * Each session is isolated (separate BrowserContext — no cookie leakage).
 */

import { INFRASTRUCTURE } from '../../config/infrastructure';
import { desktopBus } from '../desktopBus';

export interface SessionScreenshot {
  image_base64: string;
  url: string;
  title: string;
  width: number;
  height: number;
}

export interface SessionActionResult {
  ok?: boolean;
  error?: string;
  image_base64?: string;
  result?: unknown;
  title?: string;
  url?: string;
  current_url?: string;
}

export interface FindResult {
  tag: string;
  text: string;
  href?: string;
  rect?: { x: number; y: number; width: number; height: number };
}

/** Check whether Wayfarer is reachable. */
export async function isWayfarerHealthy(): Promise<boolean> {
  try {
    const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch { return false; }
}

export class WayfarerSession {
  private sessionId: string | null = null;
  private baseUrl = INFRASTRUCTURE.wayfarerUrl;
  /** True when the session is healthy — false after connection failures. */
  healthy = true;

  get isOpen(): boolean {
    return this.sessionId !== null;
  }

  get id(): string | null {
    return this.sessionId;
  }

  // ─────────────────────────────────────────────────────────────
  // Session lifecycle
  // ─────────────────────────────────────────────────────────────

  /** Open a new browser session at the given URL. Returns initial screenshot.
   *  On connection failure, returns an empty screenshot with healthy=false instead of throwing. */
  async open(url: string, signal?: AbortSignal): Promise<SessionScreenshot> {
    try {
      const data = await this.post<{
        session_id: string;
        image_base64: string;
        url: string;
        title: string;
        width: number;
        height: number;
        current_url?: string;
        error?: string;
      }>('/session/open', { url, viewport_width: 1920, viewport_height: 1080, use_cookies: true }, signal);

      if (data.error) {
        console.warn(`[WayfarerSession] open returned error: ${data.error}`);
        this.healthy = false;
        return { image_base64: '', url, title: '', width: 0, height: 0 };
      }

      this.sessionId = data.session_id;
      this.healthy = true;
      // Notify the desktop to connect the live stream
      desktopBus.emit({ type: 'browser_stream', sessionId: this.sessionId, frame: '' });
      return {
        image_base64: data.image_base64,
        url: data.current_url ?? data.url,
        title: data.title,
        width: data.width,
        height: data.height,
      };
    } catch (err) {
      console.warn(`[WayfarerSession] open unreachable: ${err instanceof Error ? err.message : String(err)}`);
      this.healthy = false;
      return { image_base64: '', url, title: '', width: 0, height: 0 };
    }
  }

  /** Close the session and free browser resources. */
  async close(): Promise<void> {
    if (!this.sessionId) return;
    try {
      await fetch(`${this.baseUrl}/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId }),
      });
    } catch {
      // best-effort close
    } finally {
      this.sessionId = null;
      desktopBus.emit({ type: 'browser_stream_stop' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────

  /** Navigate to a URL within the current session. */
  async navigate(url: string, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.healthy) { console.warn('[WayfarerSession] navigate no-op: session unhealthy'); return { error: 'Session unhealthy' }; }
    return this.actionSafe({ action: 'navigate', js: url }, signal);
  }

  /** Click at viewport coordinates. */
  async click(x: number, y: number, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.healthy) { console.warn('[WayfarerSession] click no-op: session unhealthy'); return { error: 'Session unhealthy' }; }
    return this.actionSafe({ action: 'click', click_x: x, click_y: y }, signal);
  }

  /** Right-click at viewport coordinates (opens context menu). */
  async rightClick(x: number, y: number, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.healthy) { console.warn('[WayfarerSession] rightClick no-op: session unhealthy'); return { error: 'Session unhealthy' }; }
    return this.actionSafe({ action: 'right_click', click_x: x, click_y: y }, signal);
  }

  /** Double-click at viewport coordinates. */
  async doubleClick(x: number, y: number, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.healthy) { console.warn('[WayfarerSession] doubleClick no-op: session unhealthy'); return { error: 'Session unhealthy' }; }
    return this.actionSafe({ action: 'double_click', click_x: x, click_y: y }, signal);
  }

  /** Navigate forward in browser history. */
  async forward(signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.healthy) return { error: 'Session unhealthy' };
    return this.actionSafe({ action: 'forward' }, signal);
  }

  /** Upload a file to an input[type=file] element. */
  async uploadFile(selector: string, filePath: string, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.sessionId) throw new Error('WayfarerSession: no open session');
    return this.post<SessionActionResult>(
      `/session/${this.sessionId}/upload`,
      { selector, file_path: filePath },
      signal,
    );
  }

  /** Get cookies for the current page context. */
  async getCookies(signal?: AbortSignal): Promise<Array<{ name: string; value: string; domain: string }>> {
    if (!this.sessionId) return [];
    try {
      const resp = await this.post<{ cookies: Array<{ name: string; value: string; domain: string }> }>(
        `/session/${this.sessionId}/cookies/get`, {}, signal,
      );
      return resp.cookies ?? [];
    } catch { return []; }
  }

  /** Set cookies on the current browser context. */
  async setCookies(cookies: Array<{ name: string; value: string; domain: string; path?: string }>, signal?: AbortSignal): Promise<void> {
    if (!this.sessionId) return;
    await this.post(`/session/${this.sessionId}/cookies/set`, { cookies }, signal);
  }

  /** Click a CSS selector. */
  async clickSelector(selector: string, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.healthy) { console.warn('[WayfarerSession] clickSelector no-op: session unhealthy'); return { error: 'Session unhealthy' }; }
    return this.actionSafe({ action: 'click', selector }, signal);
  }

  /**
   * Type text into the page.
   * If selector is provided, that element is focused first.
   * If clear is true (default), existing text is cleared with Ctrl+A + Delete before
   * typing so new text replaces rather than appends. (fix #2)
   */
  async type(
    text: string,
    selector?: string,
    clear = true,
    signal?: AbortSignal,
  ): Promise<SessionActionResult> {
    if (!this.healthy) { console.warn('[WayfarerSession] type no-op: session unhealthy'); return { error: 'Session unhealthy' }; }
    if (!this.sessionId) throw new Error('WayfarerSession: no open session');
    return this.post<SessionActionResult>(
      `/session/${this.sessionId}/type`,
      { text, selector: selector ?? '', clear },
      signal,
    );
  }

  /** Take a screenshot. Returns base64 JPEG + actual viewport dimensions.
   *  Returns empty string on failure instead of throwing. */
  async screenshot(signal?: AbortSignal): Promise<SessionScreenshot> {
    if (!this.healthy || !this.sessionId) {
      return { image_base64: '', url: '', title: '', width: 0, height: 0 };
    }
    try {
      const result = await this.action({ action: 'screenshot' }, signal);
      return {
        image_base64: result.image_base64 ?? '',
        url: result.current_url ?? '',
        title: result.title ?? '',
        width: (result as { viewportWidth?: number }).viewportWidth ?? 1280,
        height: (result as { viewportHeight?: number }).viewportHeight ?? 800,
      };
    } catch (err) {
      console.warn(`[WayfarerSession] screenshot failed: ${err instanceof Error ? err.message : String(err)}`);
      this.healthy = false;
      return { image_base64: '', url: '', title: '', width: 0, height: 0 };
    }
  }

  /**
   * Scroll the page using window.scrollBy (legacy — kept for attention drift recovery).
   * Positive pixels = scroll down, negative = scroll up.
   */
  async scroll(
    direction: 'up' | 'down',
    pixels = 400,
    signal?: AbortSignal,
  ): Promise<SessionActionResult> {
    const scroll_y = direction === 'down' ? pixels : -pixels;
    return this.action({ action: 'scroll', scroll_y }, signal);
  }

  /**
   * Scroll the page using page.mouse.wheel — more reliable than window.scrollBy.
   * Supports all 4 directions and optional x/y position to scroll at a specific element.
   * Maps to POST /session/{id}/scroll on the server. (fix #1)
   */
  async scrollAt(
    direction: 'up' | 'down' | 'left' | 'right',
    distance = 300,
    x?: number,
    y?: number,
    signal?: AbortSignal,
  ): Promise<SessionActionResult> {
    if (!this.sessionId) throw new Error('WayfarerSession: no open session');
    let deltaX = 0;
    let deltaY = 0;
    switch (direction) {
      case 'up':    deltaY = -distance; break;
      case 'down':  deltaY =  distance; break;
      case 'left':  deltaX = -distance; break;
      case 'right': deltaX =  distance; break;
    }
    return this.post<SessionActionResult>(
      `/session/${this.sessionId}/scroll`,
      {
        x: x ?? 640,
        y: y ?? 400,
        deltaX,
        deltaY,
      },
      signal,
    );
  }

  /** Press a key (Enter, Tab, Escape, Backspace, etc.). */
  async press(key: string, signal?: AbortSignal): Promise<SessionActionResult> {
    return this.action({ action: 'keypress', js: key }, signal);
  }

  /**
   * Send a keyboard shortcut combo via page.keyboard.press().
   * Examples: "Control+t", "Control+l", "Escape", "Control+a"
   * Maps to POST /session/{id}/shortcut on the server. (fix #6)
   */
  async shortcut(keys: string, signal?: AbortSignal): Promise<SessionActionResult> {
    if (!this.sessionId) throw new Error('WayfarerSession: no open session');
    return this.post<SessionActionResult>(
      `/session/${this.sessionId}/shortcut`,
      { keys },
      signal,
    );
  }

  /**
   * Perform a human-like drag from (startX, startY) to (endX, endY).
   * Uses the dedicated /session/{id}/drag endpoint which runs _human_drag
   * (bezier path with mousedown held, micro-jitter, overshoot+correction).
   */
  async drag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    signal?: AbortSignal,
  ): Promise<SessionActionResult> {
    if (!this.sessionId) throw new Error('WayfarerSession: no open session');
    return this.post<SessionActionResult>(
      `/session/${this.sessionId}/drag`,
      { startX, startY, endX, endY },
      signal,
    );
  }

  /**
   * Evaluate a JavaScript expression in the page context.
   * Returns the raw result value, or throws on error.
   */
  async evalJs(js: string, signal?: AbortSignal): Promise<unknown> {
    const result = await this.action({ action: 'evaluate', js }, signal);
    if (result.error) throw new Error(`WayfarerSession.evalJs: ${result.error}`);
    return result.result;
  }

  /**
   * Download images from the current page (or explicit URL list) using the
   * Playwright browser context so cookies/auth are preserved.
   * Returns list of saved filenames — they appear in /downloads automatically.
   */
  async saveImages(
    urls: string[] = [],
    maxImages = 20,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; saved: string[]; count: number }> {
    if (!this.healthy || !this.sessionId) return { ok: false, saved: [], count: 0 };
    try {
      const resp = await fetch(`${this.baseUrl}/session/save_images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId, urls, max_images: maxImages }),
        signal,
      });
      if (!resp.ok) return { ok: false, saved: [], count: 0 };
      return resp.json() as Promise<{ ok: boolean; saved: string[]; count: number }>;
    } catch {
      return { ok: false, saved: [], count: 0 };
    }
  }

  /** Extract text content from the page (title + h1 + body up to 8000 chars). */
  async extractText(signal?: AbortSignal): Promise<string> {
    const result = await this.action({ action: 'extract_text' }, signal);
    const data = result.result as { title?: string; h1?: string; meta?: string; body?: string } | null;
    if (!data) return '';
    return [data.title, data.h1, data.meta, data.body].filter(Boolean).join('\n\n');
  }

  /**
   * Get all visible interactive elements as an indexed list.
   * Used by the executor for browser-use style element targeting by index.
   * Returns elements with idx, tag, role, label, x, y, w, h plus a text summary.
   */
  async getElements(signal?: AbortSignal): Promise<{
    elements: Array<{ idx: number; tag: string; role: string; label: string; x: number; y: number; w: number; h: number }>;
    text: string;
    count: number;
  }> {
    if (!this.healthy || !this.sessionId) {
      return { elements: [], text: 'No interactive elements (session unavailable)\n', count: 0 };
    }
    try {
      const controller = new AbortController();
      const combinedSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;
      const timer = setTimeout(() => controller.abort(), 15_000);
      const resp = await fetch(`${this.baseUrl}/session/${this.sessionId}/elements`, { signal: combinedSignal });
      clearTimeout(timer);
      if (!resp.ok) {
        return { elements: [], text: 'Failed to fetch interactive elements\n', count: 0 };
      }
      return resp.json();
    } catch (err) {
      console.warn(`[WayfarerSession] getElements failed: ${err instanceof Error ? err.message : String(err)}`);
      return { elements: [], text: 'Failed to fetch interactive elements\n', count: 0 };
    }
  }

  /**
   * Find elements matching a CSS selector.
   * Returns up to 20 element descriptors.
   */
  async find(selector: string, signal?: AbortSignal): Promise<FindResult[]> {
    const result = await this.action({ action: 'find', selector }, signal);
    const raw = result.result as Array<{
      tag: string;
      text: string;
      href?: string;
      rect?: { x: number; y: number; w: number; h: number };
    }> | null;
    if (!Array.isArray(raw)) return [];
    return raw.map(el => ({
      tag: el.tag,
      text: el.text,
      href: el.href || undefined,
      rect: el.rect
        ? { x: el.rect.x, y: el.rect.y, width: el.rect.w, height: el.rect.h }
        : undefined,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  /** Send a raw action to the session endpoint (public for executor use). */
  async action(
    fields: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<SessionActionResult> {
    if (!this.sessionId) throw new Error('WayfarerSession: no open session');
    return this.post<SessionActionResult>(
      '/session/action',
      { session_id: this.sessionId, ...fields },
      signal,
    );
  }

  /**
   * Safe action wrapper — catches errors and marks session unhealthy instead of throwing.
   * Used by public action methods (click, navigate, etc.) for graceful degradation.
   */
  private async actionSafe(
    fields: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<SessionActionResult> {
    try {
      return await this.action(fields, signal);
    } catch (err) {
      console.warn(`[WayfarerSession] action failed (marking unhealthy): ${err instanceof Error ? err.message : String(err)}`);
      this.healthy = false;
      return { error: `Session action failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /**
   * POST with timeout, retry on 5xx, and graceful network error handling.
   * Retries up to 2 times on 5xx or network errors with exponential backoff.
   */
  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 30_000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const combinedSignal = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal;
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const resp = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: combinedSignal,
        });

        clearTimeout(timer);

        if (resp.ok) {
          return resp.json() as Promise<T>;
        }

        // Retry on 5xx server errors
        if (resp.status >= 500 && attempt < MAX_RETRIES) {
          console.warn(`[WayfarerSession] ${path} returned ${resp.status}, retrying (${attempt + 1}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        throw new Error(`WayfarerSession ${path} HTTP ${resp.status}`);
      } catch (err) {
        // If the caller's signal was aborted, propagate immediately
        if (signal?.aborted) throw err;

        // Retry on network errors (not abort)
        if (attempt < MAX_RETRIES && err instanceof TypeError) {
          console.warn(`[WayfarerSession] ${path} network error, retrying (${attempt + 1}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        throw err;
      }
    }

    // Should not reach here, but satisfy TypeScript
    throw new Error(`WayfarerSession ${path} failed after ${MAX_RETRIES + 1} attempts`);
  }
}
