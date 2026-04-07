/**
 * nativeMacBridge.ts — TypeScript client for the native Mac bridge server.
 *
 * The bridge server (bridge_server.py, port 8891) uses ScreenCaptureKit /
 * pyautogui / CGEventPost to interact with the REAL Mac desktop — not the browser DOM.
 *
 * Coordinate system:
 *   - All coordinates sent to the bridge are in LOGICAL pixels (not Retina/physical pixels).
 *   - The bridge handles Retina 2x scaling internally via pyautogui's platform detection.
 *   - Gemma 4 E2B outputs 0-1000 normalised coordinates — convert with gemmaBoxToClickPoint()
 *     before calling any bridge function.
 *
 * Error handling:
 *   - Every function throws on network failure or non-OK HTTP status so callers can react.
 *   - Use the MAC_BRIDGE_URL constant to override the default port if needed.
 */

const MAC_BRIDGE_URL = 'http://localhost:8891';

// ─────────────────────────────────────────────────────────────
// Types matching bridge_server.py response shapes
// ─────────────────────────────────────────────────────────────

export interface ScreenshotResult {
  /** Base64-encoded JPEG of the full Mac screen (no data URL prefix). */
  image_base64: string;
  /** Logical width of the screen in points (not physical Retina pixels). */
  width: number;
  /** Logical height of the screen in points (not physical Retina pixels). */
  height: number;
}

// ─────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────

async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await fetch(`${MAC_BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '(no body)');
    throw new Error(`Mac bridge ${path} failed: HTTP ${resp.status} — ${text}`);
  }

  return resp.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Capture the full Mac screen via ScreenCaptureKit / screencapture CLI.
 * Returns base64 JPEG plus the logical screen dimensions.
 *
 * Use the returned width/height to convert vision model coordinates:
 *   const { width, height } = await takeScreenshot();
 *   const pt = gemmaBoxToClickPoint(box, width, height);
 */
export async function takeScreenshot(signal?: AbortSignal): Promise<ScreenshotResult> {
  return bridgePost<ScreenshotResult>('/screenshot', {}, signal);
}

/**
 * Move the mouse and click at logical coordinates (x, y).
 *
 * @param x       Logical x coordinate (points, not Retina pixels)
 * @param y       Logical y coordinate (points, not Retina pixels)
 * @param opts    Optional: double-click or right-click
 * @param signal  Abort signal
 */
export async function clickAt(
  x: number,
  y: number,
  opts?: { double?: boolean; right?: boolean },
  signal?: AbortSignal,
): Promise<void> {
  await bridgePost<{ ok: boolean }>(
    '/click',
    {
      x,
      y,
      button: opts?.right ? 'right' : 'left',
      double: opts?.double ?? false,
    },
    signal,
  );
}

/**
 * Type a string of text using the system keyboard.
 * Sends characters one by one with realistic timing (handled server-side).
 *
 * @param text    Text to type
 * @param signal  Abort signal
 */
export async function typeText(text: string, signal?: AbortSignal): Promise<void> {
  await bridgePost<{ ok: boolean }>('/type', { text }, signal);
}

/**
 * Press a keyboard hotkey combination.
 *
 * @param keys    Array of key names, e.g. ["cmd", "s"] or ["ctrl", "c"]
 *                Supported modifiers: "cmd" | "ctrl" | "alt" | "shift" | "fn"
 *                Supported keys: any single char, "enter", "escape", "tab",
 *                "backspace", "delete", "space", "up", "down", "left", "right",
 *                "f1"-"f12", etc.
 * @param signal  Abort signal
 */
export async function pressHotkey(keys: string[], signal?: AbortSignal): Promise<void> {
  await bridgePost<{ ok: boolean }>('/hotkey', { keys }, signal);
}

/**
 * Scroll the mouse wheel at logical coordinates (x, y).
 *
 * @param x         Logical x coordinate where scroll is applied
 * @param y         Logical y coordinate where scroll is applied
 * @param direction 'up' or 'down'
 * @param amount    Number of scroll "clicks" (default 3, each ~120 logical pixels)
 * @param signal    Abort signal
 */
export async function scrollAt(
  x: number,
  y: number,
  direction: 'up' | 'down',
  amount = 3,
  signal?: AbortSignal,
): Promise<void> {
  await bridgePost<{ ok: boolean }>('/scroll', { x, y, direction, amount }, signal);
}

/**
 * Health check — returns true if the bridge server is reachable.
 * Does not throw; returns false on any error.
 */
export async function isBridgeHealthy(signal?: AbortSignal): Promise<boolean> {
  try {
    const resp = await fetch(`${MAC_BRIDGE_URL}/health`, {
      signal: signal ?? AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Coordinate conversion helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert a Gemma 4 E2B bounding box to a logical click point.
 *
 * Gemma outputs: { "box_2d": [y1, x1, y2, x2] } in 0-1000 normalised space.
 * This converts to logical pixel coordinates at the box center.
 *
 * @param box      [y1, x1, y2, x2] in 0-1000 space (Gemma output order)
 * @param screenW  Logical screen width  (from takeScreenshot().width)
 * @param screenH  Logical screen height (from takeScreenshot().height)
 * @returns        { x, y } in logical pixels ready for clickAt()
 */
export function gemmaBoxToClickPoint(
  box: [number, number, number, number],
  screenW: number,
  screenH: number,
): { x: number; y: number } {
  const [y1, x1, y2, x2] = box;
  return {
    x: Math.round(((x1 + x2) / 2) / 1000 * screenW),
    y: Math.round(((y1 + y2) / 2) / 1000 * screenH),
  };
}

/**
 * Convert normalised 0-1 coordinates (e.g. from a vision model that outputs
 * fractions of screen size) to logical pixels.
 */
export function normalisedToLogical(
  nx: number,
  ny: number,
  screenW: number,
  screenH: number,
): { x: number; y: number } {
  return {
    x: Math.round(nx * screenW),
    y: Math.round(ny * screenH),
  };
}
