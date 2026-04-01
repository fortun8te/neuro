/**
 * BlobAvatar — generative blob avatars for agents and users.
 * Ported from Michael's svg-generator.html blob system.
 *
 * Usage:
 *   <BlobAvatar seed="neuro" color="#3b82f6" size={40} />              // agent orb
 *   <BlobAvatar seed="michael" color="#374151" size={32} initials="MK" /> // user avatar
 */

import React, { useMemo } from 'react';

// ── PRNG (mulberry32) ──
const mb32 = (s: number) => () => {
  s |= 0; s = s + 0x6D2B79F5 | 0;
  let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const hsh = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h || 1;
};

// ── Color utils ──
function hex2hsl(x: string): [number, number, number] {
  const r = parseInt(x.slice(1, 3), 16) / 255;
  const g = parseInt(x.slice(3, 5), 16) / 255;
  const b = parseInt(x.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hsl2hex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const c = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * Math.max(0, Math.min(1, l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))).toString(16).padStart(2, '0');
  };
  return `#${c(0)}${c(8)}${c(4)}`;
}

const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fn = (v: number) => +v.toFixed(3);

// Safety check: ensure SVG string only contains safe SVG elements (no scripts, etc.)
const isSafeSvg = (svg: string): boolean => {
  // Check for dangerous patterns (use word boundaries to avoid false positives like "tableValues")
  return !/<script|javascript:|onerror|onload|\beval\s*\(|window\.|document\./i.test(svg);
};

// ── Palette generation ──
function palette(hex: string): string[] {
  const [h, s, l] = hex2hsl(hex);
  if (s <= 12) {
    // Grayscale with more contrast
    const ctr = cl(l, 12, 88), lo = cl(ctr - 32, 0, 50), hi = cl(ctr + 40, 45, 95), step = (hi - lo) / 8;
    return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => hsl2hex(0, 0, lo + step * i));
  }
  // Saturated, vibrant colors — high saturation, varied lightness
  const bS = cl(s, 65, 100); // Higher minimum saturation for vibrancy
  const bL = cl(l, 35, 60);  // Keep mid-to-bright tones
  return [
    hsl2hex(h + 8, cl(bS - 5, 60, 100), cl(bL - 8, 30, 65)),     // Primary deep
    hsl2hex(h, cl(bS, 65, 100), bL),                              // Base saturated
    hsl2hex(h - 5, cl(bS - 10, 60, 100), cl(bL + 5, 35, 70)),    // Bright variant
    hsl2hex(h - 10, cl(bS - 15, 55, 95), cl(bL + 12, 40, 72)),   // Lighter bright
    hsl2hex(h - 15, cl(bS - 20, 50, 90), cl(bL + 18, 45, 75)),   // Pale but saturated
    hsl2hex(h - 20, cl(bS - 25, 45, 85), cl(bL + 24, 50, 78)),   // Very pale
    hsl2hex(h - 25, cl(bS - 30, 40, 80), cl(bL + 28, 55, 85)),   // Almost white accent
    hsl2hex(h + 28, cl(bS * 0.85, 55, 100), cl(bL + 8, 40, 70)), // Complementary saturated
    hsl2hex(h - 10, cl(bS - 40, 35, 85), cl(bL + 32, 60, 90)),   // Highlight pale
  ];
}

// ── Blob generation ──
interface BlobItem { el: string; id: number; cx: number; cy: number; animEl?: string; }

function genAnimCSS(items: BlobItem[], rng: () => number, maxAnimated = 10, intensity: 'idle' | 'active' | 'thinking' = 'idle'): string {
  // Matches svg-generator.html — uses individual CSS properties (rotate, translate, scale)
  // to avoid overriding SVG transform attributes on ellipses.
  // GPU-optimized: will-change hints + capped animation count.
  const rf = (a: number, b: number) => rng() * (b - a) + a;
  const pc = (p: number) => rng() < p;

  // Intensity-dependent animation parameters
  const durRange: [number, number] = intensity === 'thinking' ? [3, 6] : intensity === 'active' ? [8, 15] : [18, 40];
  const driftMax = intensity === 'thinking' ? 6 : intensity === 'active' ? 4 : 2.5;
  const scaleMax = intensity === 'thinking' ? 1.14 : intensity === 'active' ? 1.10 : 1.08;

  let css = '@media(prefers-reduced-motion:reduce){';
  // Disable all blob animations for users with reduced-motion preference
  items.forEach(({ id }) => { css += `.b${id}{animation:none!important}`; });
  css += '}';
  let animated = 0;
  items.forEach(({ id, cx, cy }) => {
    if (animated >= maxAnimated) return;
    animated++;
    const type = rng();
    const dur = fn(rf(durRange[0], durRange[1]));
    const delay = fn(rf(0, 5));
    if (type < 0.4) {
      const dir = pc(0.5) ? '' : ' reverse';
      css += `.b${id}{animation:r${id} ${dur}s linear${dir} infinite;animation-delay:-${delay}s;transform-origin:${cx}px ${cy}px;will-change:rotate}`;
      css += `@keyframes r${id}{to{rotate:360deg}}`;
    } else if (type < 0.75) {
      const dx = fn(rf(-driftMax, driftMax)), dy = fn(rf(-driftMax, driftMax));
      css += `.b${id}{animation:d${id} ${dur}s ease-in-out infinite alternate;animation-delay:-${delay}s;will-change:translate}`;
      css += `@keyframes d${id}{to{translate:${dx}px ${dy}px}}`;
    } else {
      const s = fn(rf(1.02, scaleMax));
      css += `.b${id}{animation:p${id} ${dur}s ease-in-out infinite alternate;animation-delay:-${delay}s;transform-origin:${cx}px ${cy}px;will-change:scale}`;
      css += `@keyframes p${id}{to{scale:${s}}}`;
    }
  });
  return css;
}

function generateBlobs(pal: string[], rng: () => number, animated = false): BlobItem[] {
  const rf = (a: number, b: number) => rng() * (b - a) + a;
  // ri (random int) removed — was dead code
  const pk = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const pc = (p: number) => rng() < p;

  let blobIdx = 0;
  const items: BlobItem[] = [];

  const makeBlob = (cx: number, cy: number, rx: number, ry: number, col: string): BlobItem => {
    const kind = rng();
    const id = blobIdx++;
    let tr: string;

    if (kind < 0.35) {
      const ang = rf(-180, 180);
      tr = `rotate(${fn(ang)} ${fn(cx)} ${fn(cy)})`;
    } else if (kind < 0.75) {
      const a = rf(0, 6.283), fx = pc(0.35) ? -1 : 1, fy = pc(0.2) ? -1 : 1;
      const co = Math.cos(a), si = Math.sin(a);
      tr = `matrix(${fn(co * fx)} ${fn(si * fx)} ${fn(-si * fy)} ${fn(co * fy)} ${fn(cx)} ${fn(cy)})`;
    } else {
      const a = rf(0, 6.283), sc = rf(0.7, 1);
      const co = Math.cos(a) * sc, si = Math.sin(a) * sc;
      const tx = rf(6, 42), ty = rf(4, 42);
      tr = `matrix(${fn(co)} ${fn(si)} ${fn(-si)} ${fn(co)} ${fn(tx)} ${fn(ty)})`;
    }

    const ecx = kind < 0.35 ? cx : fn(rx * rf(-0.2, 0.2));
    const ecy = kind < 0.35 ? cy : fn(ry * rf(-0.2, 0.2));
    const cls = animated ? ` class="b${id}"` : '';
    return {
      el: `<ellipse${cls} cx="${fn(ecx)}" cy="${fn(ecy)}" rx="${fn(rx)}" ry="${fn(ry)}" fill="${col}" transform="${tr}"/>`,
      id, cx: fn(cx), cy: fn(cy),
    };
  };

  const pool: string[] = [];
  [2, 3, 3, 3, 3, 2, 2, 1, 1].forEach((w, i) => { for (let j = 0; j < w; j++) pool.push(pal[i]); });
  const CX = 24, CY = 24;

  // Large base blobs
  for (let i = 0; i < 4; i++) {
    const a = rf(0, 6.283), d = rf(0, 10);
    items.push(makeBlob(CX + Math.cos(a) * d, CY + Math.sin(a) * d, rf(9, 16), rf(11, 18), pk([pal[0], pal[1], pal[2]])));
  }
  // Medium blobs
  for (let i = 0; i < 7; i++) {
    const a = rf(0, 6.283), d = rf(0, 14), thin = pc(0.3);
    items.push(makeBlob(CX + Math.cos(a) * d, CY + Math.sin(a) * d, thin ? rf(2, 5) : rf(5, 12), thin ? rf(8, 15) : rf(6, 13), pk(pool)));
  }
  // Thin wisps
  for (let i = 0; i < 3; i++) {
    const a = rf(0, 6.283), d = rf(3, 16);
    items.push(makeBlob(CX + Math.cos(a) * d, CY + Math.sin(a) * d, rf(0.7, 2), rf(10, 17), pk([pal[4], pal[5], pal[6], pal[8]])));
  }
  // Small accent blobs
  for (let i = 0; i < 4; i++) {
    const a = rf(0, 6.283), d = rf(0, 15);
    items.push(makeBlob(CX + Math.cos(a) * d, CY + Math.sin(a) * d, rf(3, 8), rf(4, 10), pk([pal[4], pal[5], pal[6], pal[7], pal[8]])));
  }
  return items;
}

function noiseColor(hex: string): string {
  const [h, s, l] = hex2hsl(hex);
  if (s <= 12) return hsl2hex(0, 0, cl(l + 45, 85, 97));
  return hsl2hex(h - 15, cl(s * 0.35, 8, 35), cl(l + 35, 75, 92));
}

function buildSVG(hex: string, seedNum: number, animated = false, intensity: 'idle' | 'active' | 'thinking' = 'idle'): string {
  const rng = mb32(seedNum);
  const pal = palette(hex);
  const items = generateBlobs(pal, rng, animated);
  const els = items.map(b => b.el).join('\n');
  const animRng = mb32(seedNum + 999); // separate rng for animation so static SVG is stable
  const cssBlock = animated ? `\n  <style>${genAnimCSS(items, animRng, 10, intensity)}</style>` : '';
  const ns = Math.floor(rng() * 9000) + 1000;
  const nc = noiseColor(hex);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">${cssBlock}
  <mask id="m" width="38" height="38" x="5" y="5" maskUnits="userSpaceOnUse" style="mask-type:alpha">
    <circle cx="24" cy="24" r="19" fill="#D9D9D9"/>
  </mask>
  <g mask="url(#m)">
    <g filter="url(#bl)">
${els}
    </g>
    <g filter="url(#tx)">
      <rect x="-5" y="-1" width="58" height="54" fill="#fff" fill-opacity=".02"/>
    </g>
  </g>
  <defs>
    <filter id="bl" x="-6" y="-6" width="60" height="60" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="tx" x="-10" y="-4" width="68" height="60" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
      <feFlood flood-opacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="shape"/>
      <feTurbulence baseFrequency="5.88" numOctaves="3" result="turb" seed="${ns}" stitchTiles="stitch" type="fractalNoise"/>
      <feColorMatrix in="turb" result="aN" type="luminanceToAlpha"/>
      <feComponentTransfer in="aN" result="n1"><feFuncA tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0" type="discrete"/></feComponentTransfer>
      <feComposite in="n1" in2="shape" operator="in" result="c1"/>
      <feComponentTransfer in="aN" result="n2"><feFuncA tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0" type="discrete"/></feComponentTransfer>
      <feComposite in="n2" in2="shape" operator="in" result="c2"/>
      <feFlood flood-color="${nc}" result="f1"/><feComposite in="f1" in2="c1" operator="in" result="o1"/>
      <feFlood flood-color="rgba(255,255,255,.25)" result="f2"/><feComposite in="f2" in2="c2" operator="in" result="o2"/>
      <feMerge><feMergeNode in="shape"/><feMergeNode in="o1"/><feMergeNode in="o2"/></feMerge>
    </filter>
  </defs>
</svg>`;
}

// ── Component ──

interface BlobAvatarProps {
  /** Seed string — same seed + color = same avatar. Use user ID, agent name, etc. */
  seed: string;
  /** Base color hex (e.g. "#3b82f6" for blue, "#374151" for gray) */
  color?: string;
  /** Size in pixels */
  size?: number;
  /** Initials to overlay (e.g. "MK") — makes it a user avatar */
  initials?: string;
  /** Enable slow CSS animation (rotate, drift, pulse on blobs) */
  animated?: boolean;
  /** Animation intensity: idle (default slow), active (faster + wider), thinking (rapid + widest) */
  intensity?: 'idle' | 'active' | 'thinking';
  /** Additional className */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

// Pre-defined agent colors for variety
const AGENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
];

export function getAgentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

export default function BlobAvatar({ seed, color, size = 40, initials, animated = false, intensity = 'idle', className, style }: BlobAvatarProps) {
  const seedNum = useMemo(() => Math.abs(hsh(seed)) || 1, [seed]);
  // Auto-pick a vibrant color from the palette when none is provided
  const resolvedColor = useMemo(() => color || AGENT_COLORS[seedNum % AGENT_COLORS.length], [color, seedNum]);
  // Skip internal animations for tiny avatars (< 28px) — imperceptible and wastes GPU
  const shouldAnimate = animated && size >= 28;
  const svgString = useMemo(() => buildSVG(resolvedColor, seedNum, shouldAnimate, intensity), [resolvedColor, seedNum, shouldAnimate, intensity]);

  // Make SVG filter IDs and animation classes unique per instance to avoid conflicts
  const uniqueId = useMemo(() => `ba-${seedNum}`, [seedNum]);
  const uniqueSvg = useMemo(() => {
    let result = svgString
      .replace(/id="m"/g, `id="m-${uniqueId}"`)
      .replace(/mask="url\(#m\)"/g, `mask="url(#m-${uniqueId})"`)
      .replace(/id="bl"/g, `id="bl-${uniqueId}"`)
      .replace(/filter="url\(#bl\)"/g, `filter="url(#bl-${uniqueId})"`)
      .replace(/id="tx"/g, `id="tx-${uniqueId}"`)
      .replace(/filter="url\(#tx\)"/g, `filter="url(#tx-${uniqueId})"`);

    // Also namespace animation class names if animations are enabled
    // This prevents conflicts when multiple avatars with the same seed are rendered
    if (shouldAnimate) {
      // Replace class names: b0, b1, b2, etc. → ba-{uniqueId}-b0, etc.
      result = result.replace(/class="b(\d+)"/g, (_, num) => `class="${uniqueId}-b${num}"`);
      // Replace animation selectors: .b0 { → .ba-{uniqueId}-b0 {
      result = result.replace(/\.b(\d+)\{/g, (_, num) => `.${uniqueId}-b${num}{`);
      // Replace keyframe references in animation rules: animation:r0 → animation:r0-{uniqueId}
      // and @keyframes r0 → @keyframes r0-{uniqueId}
      result = result.replace(/animation:([rpd])(\d+)/g, (_, type, num) => `animation:${type}${num}-${uniqueId}`);
      result = result.replace(/@keyframes ([rpd])(\d+)/g, (_, type, num) => `@keyframes ${type}${num}-${uniqueId}`);
    }

    // Safety check: ensure the SVG string is safe before rendering
    if (!isSafeSvg(result)) {
      console.warn('[BlobAvatar] Unsafe SVG detected, rendering fallback');
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${resolvedColor}"/></svg>`;
    }

    return result;
  }, [svgString, uniqueId, resolvedColor, animated]);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        contain: 'strict',
        ...style,
      }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: uniqueSvg }}
        style={{ width: '100%', height: '100%', contain: 'layout style' }}
      />
      {initials && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.36,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            letterSpacing: '0.02em',
            fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
            pointerEvents: 'none',
          }}
        >
          {initials.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}
