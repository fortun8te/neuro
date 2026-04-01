/**
 * MiniCursorOverlay — renders a scaled-down cursor on the AgentPanel mini-screen thumbnail.
 *
 * Listens to desktopBus cursor events and scales coordinates from the full desktop
 * viewport (1280x800 browser space) down to the mini-screen dimensions.
 * Uses imperative DOM manipulation to avoid React re-renders.
 */

import { useEffect, useRef, useCallback } from 'react';
import { desktopBus } from '../utils/desktopBus';

interface MiniCursorOverlayProps {
  /** Width of the mini-screen container in px */
  width: number;
  /** Height of the mini-screen container in px */
  height: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Browser viewport that screenshots originate from */
const VIEWPORT_W = 1280;
const VIEWPORT_H = 800;

const CURSOR_SIZE = 10;
const RIPPLE_DURATION = 350;
const SCROLL_DURATION = 500;

export function MiniCursorOverlay({ width, height }: MiniCursorOverlayProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scaleX = width / VIEWPORT_W;
  const scaleY = height / VIEWPORT_H;

  /** Move the cursor to scaled coordinates and show it */
  const moveTo = useCallback((bx: number, by: number) => {
    const el = cursorRef.current;
    if (!el) return;
    el.style.left = `${bx * scaleX}px`;
    el.style.top = `${by * scaleY}px`;
    el.style.opacity = '1';
    // Auto-hide after 3s of no movement
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (el) el.style.opacity = '0';
    }, 3000);
  }, [scaleX, scaleY]);

  /** Spawn a click ripple at scaled coordinates */
  const spawnRipple = useCallback((bx: number, by: number) => {
    const container = overlayRef.current;
    if (!container) return;
    const x = bx * scaleX;
    const y = by * scaleY;
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      border: 1.5px solid rgba(255,107,61,0.8);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: miniRipple ${RIPPLE_DURATION}ms ease-out forwards;
    `;
    container.appendChild(ring);
    setTimeout(() => ring.remove(), RIPPLE_DURATION + 50);
  }, [scaleX, scaleY]);

  /** Spawn a scroll indicator */
  const spawnScrollIndicator = useCallback((bx: number, by: number, dir: string) => {
    const container = overlayRef.current;
    if (!container) return;
    const x = bx * scaleX;
    const y = by * scaleY;
    const arrow = document.createElement('div');
    const rotation = dir === 'down' ? 90 : dir === 'up' ? -90 : dir === 'right' ? 0 : 180;
    const moveY = (dir === 'down' ? 12 : dir === 'up' ? -12 : 0);
    const moveX = (dir === 'right' ? 12 : dir === 'left' ? -12 : 0);
    arrow.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      transform: translate(-50%, -50%) rotate(${rotation}deg);
      pointer-events: none;
      color: rgba(255,107,61,0.8);
      font-size: 10px;
      font-weight: bold;
      text-shadow: 0 0 3px rgba(255,107,61,0.5);
      animation: miniScrollMove ${SCROLL_DURATION}ms ease-out forwards;
      --move-x: ${moveX}px;
      --move-y: ${moveY}px;
    `;
    arrow.textContent = '\u276F\u276F'; // double chevrons
    container.appendChild(arrow);
    setTimeout(() => arrow.remove(), SCROLL_DURATION + 50);
  }, [scaleX, scaleY]);

  // Subscribe to desktopBus events
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'ai_cursor_move') {
        moveTo(event.x, event.y);
      } else if (event.type === 'ai_cursor_click') {
        moveTo(event.x, event.y);
        spawnRipple(event.x, event.y);
      } else if (event.type === 'ai_cursor_scroll') {
        moveTo(event.x, event.y);
        spawnScrollIndicator(event.x, event.y, event.direction);
      } else if (event.type === 'ai_cursor_state') {
        if (event.state === 'idle') {
          const el = cursorRef.current;
          if (el) el.style.opacity = '0';
        }
      }
    });
    return () => {
      unsub();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [moveTo, spawnRipple, spawnScrollIndicator]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        borderRadius: 'inherit',
      }}
    >
      {/* Inline keyframe styles */}
      <style>{`
        @keyframes miniRipple {
          0% { width: 0; height: 0; opacity: 0.9; }
          100% { width: 20px; height: 20px; opacity: 0; }
        }
        @keyframes miniScrollMove {
          0% { opacity: 0.8; transform: translate(-50%, -50%) rotate(var(--rotation, 0deg)) translate(0, 0); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--move-x, 0px)), calc(-50% + var(--move-y, 0px))) rotate(var(--rotation, 0deg)); }
        }
      `}</style>

      {/* Mini cursor arrow */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          width: CURSOR_SIZE,
          height: CURSOR_SIZE,
          opacity: 0,
          transition: 'left 0.15s ease-out, top 0.15s ease-out, opacity 0.3s ease',
          pointerEvents: 'none',
          zIndex: 10,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
        }}
      >
        <svg width={CURSOR_SIZE} height={CURSOR_SIZE} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 2 L4 20 L9 15 L13 22 L15.5 21 L11.5 14 L18 14 Z"
            fill="#FF6B3D"
            stroke="#FF8C5A"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
