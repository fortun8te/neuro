/**
 * AICursor — AI agent cursor overlay with spring-physics interpolation.
 *
 * Features:
 *   - requestAnimationFrame spring physics (not CSS transitions)
 *   - Waypoint arc pathing for long-distance moves
 *   - Multi-ring click ripple effect
 *   - Per-state visual: idle/thinking/acting/clicking/typing/dragging
 *   - Chrome-to-desktop coordinate mapping via chrome_window_bounds bus event
 *   - Invisible when no agent is running
 */

import { useEffect, useRef, useCallback } from 'react';
import { desktopBus } from '../utils/desktopBus';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CursorState = 'idle' | 'thinking' | 'acting' | 'clicking' | 'typing' | 'dragging';

export interface AICursorProps {
  x: number;
  y: number;
  cursorState: CursorState;
  visible: boolean;
}

// ── Spring constants ──────────────────────────────────────────────────────────

const SPRING_K = 0.12;   // spring constant — lower = more lag = silkier
const DAMPING  = 0.75;   // damping — higher = less bouncy

// ── Waypoint helpers ──────────────────────────────────────────────────────────

interface Point { x: number; y: number }

/** Generate arc-curved intermediate waypoints for long moves. */
function buildWaypoints(from: Point, to: Point): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= 200) return [to];

  // Perpendicular offset for arc curvature (scales with distance, capped)
  const arcAmount = Math.min(dist * 0.15, 60);
  const midX = from.x + dx * 0.5;
  const midY = from.y + dy * 0.5;
  // Perpendicular direction
  const perpX = -dy / dist;
  const perpY =  dx / dist;

  if (dist <= 400) {
    // One curved midpoint
    return [
      { x: midX + perpX * arcAmount, y: midY + perpY * arcAmount },
      to,
    ];
  }

  // Two curved midpoints for very long moves
  return [
    { x: from.x + dx * 0.33 + perpX * arcAmount,       y: from.y + dy * 0.33 + perpY * arcAmount },
    { x: from.x + dx * 0.66 + perpX * arcAmount * 0.6, y: from.y + dy * 0.66 + perpY * arcAmount * 0.6 },
    to,
  ];
}

/** Distance between two points */
function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Chrome-to-desktop coordinate mapping ─────────────────────────────────────

interface ChromeBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  headerHeight: number;
  streamWidth: number;
  streamHeight: number;
}

function browserToDesktop(bx: number, by: number, bounds: ChromeBounds): Point | null {
  // Guard against division by zero when stream dimensions are missing/zero
  if (bounds.streamWidth <= 0 || bounds.streamHeight <= 0) return null;
  const scaleX = bounds.width  / bounds.streamWidth;
  const scaleY = (bounds.height - bounds.headerHeight) / bounds.streamHeight;
  const x = bounds.left + bx * scaleX;
  const y = bounds.top  + bounds.headerHeight + by * scaleY;
  // Guard against NaN/Infinity from degenerate values
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

// ── SVG cursor icons ──────────────────────────────────────────────────────────

const ARROW_PATH = 'M4 2 L4 20 L9 15 L13 22 L15.5 21 L11.5 14 L18 14 Z';

function ArrowCursor({ color, strokeColor, glow }: { color: string; strokeColor: string; glow?: string }) {
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24" fill="none"
      style={{
        display: 'block',
        filter: glow ? `drop-shadow(0 0 6px ${glow})` : 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
      }}
    >
      <path
        d={ARROW_PATH}
        fill={color}
        stroke={strokeColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IBeamCursor() {
  return (
    <svg width="10" height="24" viewBox="0 0 10 24" fill="none"
      style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
      <line x1="5" y1="0"  x2="5" y2="24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
      <line x1="1" y1="0"  x2="9" y2="0"  stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
      <line x1="1" y1="24" x2="9" y2="24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function FistCursor() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
      style={{ display: 'block', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
      {/* Simplified closed-fist shape */}
      <rect x="4" y="9" width="14" height="9" rx="3" fill="#d1d5db" stroke="#6b7280" strokeWidth="1"/>
      <rect x="4" y="6" width="4"  height="5" rx="2" fill="#d1d5db" stroke="#6b7280" strokeWidth="1"/>
      <rect x="9" y="5" width="4"  height="5" rx="2" fill="#d1d5db" stroke="#6b7280" strokeWidth="1"/>
      <rect x="14" y="6" width="4" height="5" rx="2" fill="#d1d5db" stroke="#6b7280" strokeWidth="1"/>
      <rect x="2" y="11" width="4" height="5" rx="2" fill="#d1d5db" stroke="#6b7280" strokeWidth="1"/>
    </svg>
  );
}

// ── Ripple ring ───────────────────────────────────────────────────────────────

interface RippleRing {
  id: number;
  x: number;
  y: number;
  startMs: number;
  color: string;
  delay: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AICursor({ x, y, cursorState, visible }: AICursorProps) {
  // Canvas-style RAF rendering — we use a single <div> moved via direct style manipulation
  // to avoid React re-renders on every animation frame.
  const containerRef  = useRef<HTMLDivElement>(null);
  const cursorIconRef = useRef<HTMLDivElement>(null);
  const glowRef       = useRef<HTMLDivElement>(null);
  const pulseRingRef  = useRef<HTMLDivElement>(null);
  const rippleContainerRef = useRef<HTMLDivElement>(null);

  // Spring state (mutable refs, not state — updated in RAF)
  const posRef  = useRef<Point>({ x, y });
  const velRef  = useRef<Point>({ x: 0, y: 0 });
  const targetRef = useRef<Point>({ x, y });

  // Waypoint queue
  const waypointsRef   = useRef<Point[]>([]);
  const wpTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click animation state
  const clickStartRef  = useRef<number>(0);
  const isClickingRef  = useRef(false);

  // Ripple ring list (managed imperatively)
  const ripplesRef     = useRef<RippleRing[]>([]);
  const rippleIdRef    = useRef(0);

  // Chrome bounds for coordinate mapping
  const chromeBoundsRef = useRef<ChromeBounds | null>(null);

  // Current cursor state (ref so RAF closure can read latest)
  const stateRef       = useRef<CursorState>(cursorState);
  const visibleRef     = useRef(visible);

  // RAF handle
  const rafRef         = useRef<number | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Advance waypoint queue: sets next target when current waypoint is close enough */
  const advanceWaypoints = useCallback(() => {
    if (waypointsRef.current.length === 0) return;
    const cur = posRef.current;
    const wp  = waypointsRef.current[0];
    if (dist(cur, wp) < 6) {
      waypointsRef.current.shift();
      if (waypointsRef.current.length > 0) {
        targetRef.current = waypointsRef.current[0];
      }
    }
  }, []);

  /** Spawn click ripple rings at a position */
  const spawnRipples = useCallback((rx: number, ry: number, color: string) => {
    const now = Date.now();
    const rings: RippleRing[] = [
      { id: ++rippleIdRef.current, x: rx, y: ry, startMs: now, color, delay: 0 },
      { id: ++rippleIdRef.current, x: rx, y: ry, startMs: now, color, delay: 80 },
      { id: ++rippleIdRef.current, x: rx, y: ry, startMs: now, color, delay: 160 },
    ];
    ripplesRef.current = [...ripplesRef.current, ...rings];
  }, []);

  /** Render one ripple ring DOM element (called from RAF loop) */
  const renderRipples = useCallback((now: number) => {
    const container = rippleContainerRef.current;
    if (!container) return;

    const DURATION = 400;
    const alive: RippleRing[] = [];
    const children: HTMLDivElement[] = [];

    for (const ring of ripplesRef.current) {
      const elapsed = now - ring.startMs - ring.delay;
      if (elapsed < 0) { alive.push(ring); continue; }
      const t = elapsed / DURATION; // 0..1
      if (t >= 1) continue; // expired, drop

      alive.push(ring);
      const size   = 8 + t * 32;       // 8px → 40px
      const opacity = (1 - t) * 0.75;

      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        left: ${ring.x - size / 2}px;
        top:  ${ring.y - size / 2}px;
        width:  ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 1.5px solid ${ring.color};
        opacity: ${opacity};
        pointer-events: none;
      `;
      children.push(el);
    }

    ripplesRef.current = alive;
    container.replaceChildren(...children);
  }, []);

  // ── RAF animation loop ────────────────────────────────────────────────────────

  const animate = useCallback(() => {
    rafRef.current = requestAnimationFrame(animate);
    const now = Date.now();

    // Advance waypoints
    advanceWaypoints();

    // Spring physics
    const cur = posRef.current;
    const vel = velRef.current;
    const tgt = targetRef.current;

    const ax = (tgt.x - cur.x) * SPRING_K;
    const ay = (tgt.y - cur.y) * SPRING_K;
    vel.x = (vel.x + ax) * DAMPING;
    vel.y = (vel.y + ay) * DAMPING;

    // Guard against NaN/Infinity — snap to target if physics produces degenerate values
    if (!Number.isFinite(vel.x) || !Number.isFinite(vel.y)) {
      vel.x = 0;
      vel.y = 0;
      cur.x = tgt.x;
      cur.y = tgt.y;
    } else {
      cur.x += vel.x;
      cur.y += vel.y;
    }

    // ── Cursor container position ──
    const container = containerRef.current;
    if (container) {
      container.style.left    = `${cur.x}px`;
      container.style.top     = `${cur.y}px`;
      container.style.opacity = visibleRef.current ? '1' : '0';
    }

    // ── Click squish animation ──
    const cursorIcon = cursorIconRef.current;
    if (cursorIcon) {
      if (isClickingRef.current) {
        const elapsed = now - clickStartRef.current;
        if (elapsed < 100) {
          // Squish in
          const t = elapsed / 100;
          const sx = 1 + t * 0.15;   // 1 → 1.15
          const sy = 1 - t * 0.15;   // 1 → 0.85
          cursorIcon.style.transform = `scale(${sx}, ${sy})`;
        } else if (elapsed < 220) {
          // Spring back
          const t = (elapsed - 100) / 120;
          const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
          const sx = 1.15 - ease * 0.15;
          const sy = 0.85 + ease * 0.15;
          cursorIcon.style.transform = `scale(${sx}, ${sy})`;
        } else {
          cursorIcon.style.transform = 'scale(1, 1)';
          isClickingRef.current = false;
        }
      } else if (stateRef.current === 'thinking') {
        // Slow spin
        const angle = (now / 3000) * 360;
        cursorIcon.style.transform = `rotate(${angle}deg)`;
      } else if (stateRef.current === 'idle') {
        // Gentle vertical bob
        const bob = Math.sin(now / 1200) * 1.5;
        cursorIcon.style.transform = `translateY(${bob}px)`;
      } else {
        cursorIcon.style.transform = 'none';
      }
    }

    // ── Glow / pulse ring ──
    const glow = glowRef.current;
    if (glow) {
      const state = stateRef.current;
      if (state === 'acting' || state === 'clicking') {
        const pulse = 0.18 + 0.07 * Math.sin(now / 400);
        glow.style.opacity     = String(pulse + 0.15);
        glow.style.display     = 'block';
      } else if (state === 'idle') {
        const pulse = 0.08 + 0.04 * Math.sin(now / 1800);
        glow.style.opacity     = String(pulse);
        glow.style.display     = 'block';
      } else {
        glow.style.display = 'none';
      }
    }

    const pulseRing = pulseRingRef.current;
    if (pulseRing) {
      const state = stateRef.current;
      if (state === 'thinking') {
        const scale = 1 + 0.15 * Math.sin(now / 900);
        const alpha = 0.3 + 0.15 * Math.sin(now / 900);
        pulseRing.style.transform = `scale(${scale})`;
        pulseRing.style.opacity   = String(alpha);
        pulseRing.style.display   = 'block';
      } else if (state === 'idle') {
        const scale = 1 + 0.08 * Math.sin(now / 1600);
        pulseRing.style.transform = `scale(${scale})`;
        pulseRing.style.opacity   = '0.2';
        pulseRing.style.display   = 'block';
      } else {
        pulseRing.style.display = 'none';
      }
    }

    // ── Ripples ──
    renderRipples(now);
  }, [advanceWaypoints, renderRipples]);

  // ── Start/stop RAF ───────────────────────────────────────────────────────────

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (wpTimerRef.current !== null) clearTimeout(wpTimerRef.current);
      wpTimerRef.current = null;
      // Clean up ripple state and DOM
      ripplesRef.current = [];
      if (rippleContainerRef.current) rippleContainerRef.current.replaceChildren();
    };
  }, [animate]);

  // ── Sync target position → waypoints ─────────────────────────────────────────

  useEffect(() => {
    const newTarget = { x, y };
    const from      = posRef.current;

    const waypoints = buildWaypoints(from, newTarget);
    waypointsRef.current = waypoints;
    if (waypoints.length > 0) {
      targetRef.current = waypoints[0];
    }
  }, [x, y]);

  // ── Sync cursor state ─────────────────────────────────────────────────────────

  useEffect(() => {
    stateRef.current = cursorState;
  }, [cursorState]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // ── Listen to desktopBus events ───────────────────────────────────────────────

  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'chrome_window_bounds') {
        chromeBoundsRef.current = {
          left:         event.left,
          top:          event.top,
          width:        event.width,
          height:       event.height,
          headerHeight: event.headerHeight,
          streamWidth:  event.streamWidth,
          streamHeight: event.streamHeight,
        };
      } else if (event.type === 'ai_cursor_click') {
        // Convert browser coords to desktop coords if we have bounds
        let cx = event.x;
        let cy = event.y;
        if (chromeBoundsRef.current) {
          const mapped = browserToDesktop(event.x, event.y, chromeBoundsRef.current);
          if (mapped) { cx = mapped.x; cy = mapped.y; }
        }
        // Start click squish
        isClickingRef.current = true;
        clickStartRef.current = Date.now();
        stateRef.current = 'clicking';

        // Spawn ripples
        const isChromeCtx = chromeBoundsRef.current !== null;
        const color = isChromeCtx ? 'rgba(255,107,61,0.8)' : 'rgba(255,255,255,0.6)';
        spawnRipples(cx, cy, color);

        // Return to prior state after click animation (RAF loop resets isClickingRef after 220ms,
        // so this timeout only needs to fix up the cursor state label)
        setTimeout(() => {
          if (stateRef.current === 'clicking') stateRef.current = 'acting';
        }, 300);
      } else if (event.type === 'ai_cursor_move') {
        // If coords look like browser-space and we have chrome bounds, map them
        if (chromeBoundsRef.current &&
            chromeBoundsRef.current.streamWidth > 0 &&
            chromeBoundsRef.current.streamHeight > 0 &&
            event.x <= chromeBoundsRef.current.streamWidth &&
            event.y <= chromeBoundsRef.current.streamHeight) {
          const mapped = browserToDesktop(event.x, event.y, chromeBoundsRef.current);
          if (mapped) {
            const from   = posRef.current;
            const waypoints = buildWaypoints(from, mapped);
            waypointsRef.current = waypoints;
            if (waypoints.length > 0) targetRef.current = waypoints[0];
          }
        }
      }
    });
    return unsub;
  }, [spawnRipples]);

  // ── Cursor icon selection ─────────────────────────────────────────────────────

  function renderCursorIcon() {
    switch (cursorState) {
      case 'typing':
        return <IBeamCursor />;
      case 'dragging':
        return <FistCursor />;
      case 'idle':
        return <ArrowCursor color="#9ca3af" strokeColor="#6b7280" />;
      case 'thinking':
        return <ArrowCursor color="#9ca3af" strokeColor="#6b7280" />;
      case 'acting':
        return <ArrowCursor color="#FF6B3D" strokeColor="#FF8C5A" glow="rgba(255,107,61,0.7)" />;
      case 'clicking':
        return <ArrowCursor color="#FF8C00" strokeColor="#FFB347" glow="rgba(255,140,0,0.9)" />;
    }
  }

  // ── Glow color per state ──────────────────────────────────────────────────────

  function glowStyle(): React.CSSProperties {
    const base: React.CSSProperties = {
      position: 'absolute',
      borderRadius: '50%',
      pointerEvents: 'none',
    };
    switch (cursorState) {
      case 'acting':
      case 'clicking':
        return { ...base, left: -10, top: -10, width: 44, height: 44,
          background: 'radial-gradient(circle, rgba(255,107,61,0.35) 0%, transparent 70%)' };
      case 'idle':
        return { ...base, left: -8, top: -8, width: 40, height: 40,
          background: 'radial-gradient(circle, rgba(200,200,220,0.12) 0%, transparent 70%)' };
      default:
        return base;
    }
  }

  // ── Pulse ring color per state ────────────────────────────────────────────────

  function pulseRingStyle(): React.CSSProperties {
    const base: React.CSSProperties = {
      position: 'absolute',
      borderRadius: '50%',
      pointerEvents: 'none',
    };
    switch (cursorState) {
      case 'thinking':
        return { ...base, left: -8, top: -8, width: 40, height: 40,
          border: '1.5px solid rgba(156,163,175,0.45)' };
      case 'idle':
        return { ...base, left: -6, top: -6, width: 36, height: 36,
          border: '1px solid rgba(200,200,220,0.2)' };
      default:
        return base;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Ripple container — positioned absolute in the desktop layer */}
      <div
        ref={rippleContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9997,
          overflow: 'hidden',
        }}
      />

      {/* Cursor */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          willChange: 'left, top, opacity',
        }}
      >
        {/* Glow layer */}
        <div ref={glowRef} style={glowStyle()} />

        {/* Pulse ring */}
        <div ref={pulseRingRef} style={pulseRingStyle()} />

        {/* Icon — squish/spin applied here */}
        <div ref={cursorIconRef} style={{ display: 'block', transformOrigin: 'top left' }}>
          {renderCursorIcon()}
        </div>
      </div>
    </>
  );
}
