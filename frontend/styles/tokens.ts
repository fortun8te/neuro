/**
 * Design Tokens — Single source of truth for all theme values
 *
 * Color system:
 *   - Backgrounds: #09090b (primary), #0f0f0f (secondary/panels), #0c0c0c (tertiary)
 *   - Text: rgba(255,255,255,0.85) (primary), rgba(255,255,255,0.55) (secondary),
 *           rgba(255,255,255,0.30) (muted/dim), rgba(255,255,255,0.15) (ghost)
 *   - Borders: rgba(255,255,255,0.08) everywhere
 *   - Accent: #374151 (dark gray/light), #3b82f6 (blue/dark), #22c55e (green), #ef4444 (red)
 *
 * Font sizes:
 *   - Headers: 13-14px semibold
 *   - Body: 12px regular/medium
 *   - Labels/small: 10-11px medium
 *   - Tiny: 9px (uppercase tracking labels)
 *   - Mono/code: JetBrains Mono / ui-monospace
 */

export const tokens = {
  colors: {
    bg: {
      primary:   { dark: '#09090b', light: '#F4F4F1' },
      secondary: { dark: '#0f0f0f', light: '#EEEEE9' },
      tertiary:  { dark: '#0c0c0c', light: '#f9f9f9' },
      card:      { dark: 'rgba(24, 24, 27, 0.8)', light: 'rgba(255, 255, 255, 0.9)' },
      sidebar:   { dark: '#09090b', light: '#ffffff' },
      hover:     { dark: 'rgba(255,255,255,0.04)', light: 'rgba(0,0,0,0.03)' },
      selected:  { dark: 'rgba(255,255,255,0.08)', light: 'rgba(0,0,0,0.06)' },
    },
    accent: {
      primary: '#374151',
      secondary: '#1f2937',
      tertiary: '#6b7280',
      dark: {
        primary: '#3b82f6',
        secondary: '#2563eb',
        tertiary: '#60a5fa',
      },
    },
    semantic: {
      green: '#22c55e',
      red: '#ef4444',
      blue: '#3b82f6',
      emerald: '#10b981',
    },
    gradient: {
      primary: 'from-orange-600 via-orange-500 to-orange-600',
      subtle: 'from-orange-500/10 via-orange-500/5 to-orange-500/10',
      text: 'from-orange-400 to-orange-300',
      mesh: {
        spot1: 'rgba(234, 88, 12, 0.08)',
        spot2: 'rgba(234, 88, 12, 0.06)',
        spot3: 'rgba(234, 88, 12, 0.04)',
      },
    },
    text: {
      primary:   { dark: 'rgba(255,255,255,0.85)', light: '#18181b' },
      secondary: { dark: 'rgba(255,255,255,0.55)', light: '#71717a' },
      muted:     { dark: 'rgba(255,255,255,0.30)', light: '#a1a1aa' },
      ghost:     { dark: 'rgba(255,255,255,0.15)', light: '#d4d4d8' },
    },
    border: {
      subtle:  { dark: 'rgba(255,255,255,0.08)', light: 'rgba(0,0,0,0.06)' },
      medium:  { dark: 'rgba(255,255,255,0.12)', light: 'rgba(0,0,0,0.10)' },
      active:  { dark: 'rgba(234, 88, 12, 0.3)', light: 'rgba(234, 88, 12, 0.2)' },
    },
    status: {
      healthy: '#22c55e',
      degraded: '#3b82f6',
      down: '#ef4444',
      unknown: '#71717a',
    },
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '9999px',
  },
  shadow: {
    card: '0 4px 24px rgba(0, 0, 0, 0.2)',
    glow: '0 0 20px rgba(234, 88, 12, 0.1)',
    elevated: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  sidebar: {
    collapsed: 64,
    expanded: 220,
  },
  animation: {
    spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
    gentle: { type: 'spring' as const, stiffness: 200, damping: 25 },
    stagger: 0.05,
  },
} as const;

// ── Tailwind class helpers ──

/** Standard border class — always use this for dividers/borders */
export function borderColor(dark: boolean): string {
  return dark ? 'border-white/[0.08]' : 'border-black/[0.06]';
}

export function glassCard(dark: boolean): string {
  return dark
    ? 'bg-zinc-900/80 border border-white/[0.08] rounded-2xl backdrop-blur-xl shadow-lg shadow-black/20'
    : 'bg-white border border-black/[0.08] rounded-2xl shadow-sm shadow-black/[0.04]';
}

export function statusColor(status: 'healthy' | 'degraded' | 'down' | 'unknown'): string {
  return tokens.colors.status[status];
}

/** Returns the accent color for the current mode — blue in dark, dark gray in light */
export function accentColor(dark: boolean): string {
  return dark ? '#3b82f6' : '#374151';
}

/** Returns the accent hover color for the current mode */
export function accentColorHover(dark: boolean): string {
  return dark ? '#2563eb' : '#1f2937';
}
