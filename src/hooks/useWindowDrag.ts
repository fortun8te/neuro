/**
 * useWindowDrag — shared drag hook for all floating window components.
 *
 * 1. No jump on first drag: offset is calculated from current visual position at mousedown
 *    via getBoundingClientRect() — no async setState race.
 * 2. Constrained to parent: x clamped to [0, parentW - winW], y to [0, parentH - winH].
 *    Parent rect is re-read on every pointermove, so resize mid-drag is handled.
 * 3. Global body overlay during drag: a fixed full-screen div is appended to document.body
 *    so no child element (live CDP stream img, iframes, etc.) can steal mousemove/mouseup.
 * 4. Cleanup on unmount: an AbortController aborts any in-progress drag and removes all
 *    window-level event listeners. Cleanup is idempotent (guarded flag) so double-fire
 *    from pointerup + abort or mouseleave + pointerup is harmless.
 * 5. Drag only from title bar: buttons, inputs, and anchor tags inside the title bar
 *    do NOT start a drag (checked via .closest()).
 * 6. setPointerCapture is used on the overlay so pointermove/pointerup always fire even
 *    if the cursor leaves the browser window, making the mouseleave fallback redundant
 *    (but kept for safety).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Pos {
  x: number;
  y: number;
}

interface UseWindowDragOptions {
  /** Preferred width of the window (px). Used for initial centering and clamping.
   *  The actual rendered size may be smaller if the parent is smaller. */
  windowWidth: number;
  /** Preferred height of the window (px). Used for initial centering and clamping.
   *  The actual rendered size may be smaller if the parent is smaller. */
  windowHeight: number;
  /**
   * Additional offset added to the centered position on mount.
   * Useful when multiple windows should not overlap perfectly.
   * e.g. { x: 44, y: 36 } offsets Finder from Chrome.
   * Defaults to { x: 0, y: 0 }.
   */
  centerOffset?: Pos;
}

interface UseWindowDragReturn {
  /** ref to attach to the outer window div */
  windowRef: React.RefObject<HTMLDivElement | null>;
  /** Current position (absolute, relative to parent). null = use CSS centering fallback. */
  pos: Pos | null;
  /** Whether a drag is in progress (use to show grabbing cursor overlay inside the window) */
  isDragging: boolean;
  /** Attach to the title bar element's onMouseDown */
  onTitleBarMouseDown: (e: React.MouseEvent) => void;
}

export function useWindowDrag({
  windowWidth,
  windowHeight,
  centerOffset = { x: 0, y: 0 },
}: UseWindowDragOptions): UseWindowDragReturn {
  const windowRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Tracks the in-progress drag so unmount can abort.
  const abortRef = useRef<AbortController | null>(null);
  // Whether the component is still mounted — prevents setState after unmount.
  const mountedRef = useRef(true);

  // Use refs for windowWidth/windowHeight so the onMove closure always reads fresh values
  // without needing to recreate the callback (which would break mid-drag if deps changed).
  const windowWidthRef = useRef(windowWidth);
  const windowHeightRef = useRef(windowHeight);
  windowWidthRef.current = windowWidth;
  windowHeightRef.current = windowHeight;

  // Center on mount, applying the optional offset.
  // Clamp initial position so the window fits inside the parent container.
  useEffect(() => {
    const parent = windowRef.current?.parentElement;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();
    // Effective window size is capped to the parent size (with 8px margin)
    const effW = Math.min(windowWidth, pr.width - 8);
    const effH = Math.min(windowHeight, pr.height - 8);
    setPos({
      x: Math.max(0, (pr.width - effW) / 2 + centerOffset.x),
      y: Math.max(0, (pr.height - effH) / 2 + centerOffset.y),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  // Mark unmounted + abort any live drag to remove dangling listeners.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const onTitleBarMouseDown = useCallback((e: React.MouseEvent) => {
    // Do not start drag when clicking interactive elements inside the title bar.
    if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;
    e.preventDefault();

    // If a previous drag didn't clean up (e.g. mouseup outside browser), abort it now.
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const win = windowRef.current;
    if (!win) return;

    const winRect = win.getBoundingClientRect();
    const parent = win.parentElement;
    if (!parent) return;

    // Calculate the cursor-to-window-top-left offset ONCE at mousedown.
    // This is the core fix for "jump on first drag": we read the live DOM rect
    // directly rather than trusting the potentially-stale React `pos` state.
    const offsetX = e.clientX - winRect.left;
    const offsetY = e.clientY - winRect.top;

    // Sync-set pos from the real DOM position so the window doesn't jump when
    // we switch from CSS transform-centering to explicit left/top values.
    const parentRect = parent.getBoundingClientRect();
    setPos({
      x: winRect.left - parentRect.left,
      y: winRect.top - parentRect.top,
    });
    setIsDragging(true);

    // Body overlay: fixed, full-screen, maximum z-index.
    // Prevents ANY child element (live stream img, iframes, canvas, video) from
    // capturing pointer events while the drag is in progress.
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;cursor:grabbing;touch-action:none;';
    document.body.appendChild(overlay);

    // Capture pointer on the overlay so pointermove/pointerup always fire
    // even if the cursor leaves the browser viewport.
    try {
      overlay.setPointerCapture((e.nativeEvent as unknown as PointerEvent).pointerId);
    } catch {
      // Fallback: some browsers may reject capture if pointerId is invalid (e.g. touch).
    }

    // AbortController so we can tear down everything on unmount.
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    const onMove = (ev: PointerEvent) => {
      // Re-read parent rect on every move so resize mid-drag is handled.
      const pr = win.parentElement?.getBoundingClientRect();
      if (!pr) return;

      const rawX = ev.clientX - pr.left - offsetX;
      const rawY = ev.clientY - pr.top - offsetY;

      // Use the actual rendered window size for clamping (it may be smaller
      // than the preferred size if max-width/max-height constrain it).
      const actualRect = win.getBoundingClientRect();
      const actualW = actualRect.width;
      const actualH = actualRect.height;
      const clampedX = Math.max(0, Math.min(rawX, pr.width - actualW));
      const clampedY = Math.max(0, Math.min(rawY, pr.height - actualH));

      if (mountedRef.current) {
        setPos({ x: clampedX, y: clampedY });
      }
    };

    // Idempotent cleanup — guarded so double-fire (pointerup + abort, or
    // mouseleave + pointerup) is harmless.
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      if (mountedRef.current) {
        setIsDragging(false);
      }
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      // Use { signal } option on addEventListener below so all listeners are
      // auto-removed when the controller aborts. But we also abort here to
      // cover the pointerup / mouseleave paths (non-abort cleanup).
      ac.abort();
      abortRef.current = null;
    };

    // All listeners use { signal } so they are automatically removed when
    // the AbortController fires — no manual removeEventListener needed.
    overlay.addEventListener('pointermove', onMove, { signal });
    overlay.addEventListener('pointerup', cleanup, { signal });
    // Fallback: if the pointer leaves the browser window entirely and pointerup
    // is lost (rare with setPointerCapture, but possible on some platforms).
    document.documentElement.addEventListener('mouseleave', cleanup, { signal });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable callback — reads fresh dimensions via refs

  return { windowRef, pos, isDragging, onTitleBarMouseDown };
}
