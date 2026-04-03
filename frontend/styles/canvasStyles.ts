/**
 * Canvas Panel Styling System
 * Centralized colors, spacing, responsive breakpoints
 */

export const CANVAS_COLORS = {
  // Dark mode - WCAG AA contrast optimized
  dark: {
    bg: '#141420',
    border: 'rgba(255,255,255,0.12)',
    borderLight: 'rgba(255,255,255,0.08)',
    shadow: '0 -10px 40px rgba(0,0,0,0.3)',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.85)',
    textTertiary: 'rgba(255,255,255,0.65)',
    textQuaternary: 'rgba(255,255,255,0.55)',
    hover: 'rgba(255,255,255,0.06)',
    hoverActive: 'rgba(255,255,255,0.12)',
    bgSubtle: 'rgba(255,255,255,0.04)',
    bgSubtler: 'rgba(0,0,0,0.25)',
    errorBg: 'rgba(239,68,68,0.12)',
    errorBorder: 'rgba(239,68,68,0.35)',
    errorText: '#ef4444',
    codeBg: 'rgba(255,255,255,0.04)',
    inlineCodeBg: 'rgba(255,255,255,0.08)',
    successText: '#22c55e',
    successBg: 'rgba(34,197,94,0.12)',
    infoBg: 'rgba(59,130,246,0.18)',
    infoText: '#3b82f6',
  },
  // Light mode - WCAG AA contrast optimized
  light: {
    bg: '#EEECEA',
    border: 'rgba(0,0,0,0.12)',
    borderLight: 'rgba(0,0,0,0.08)',
    shadow: '0 -10px 40px rgba(0,0,0,0.1)',
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.85)',
    textTertiary: 'rgba(0,0,0,0.65)',
    textQuaternary: 'rgba(0,0,0,0.55)',
    hover: 'rgba(0,0,0,0.06)',
    hoverActive: 'rgba(0,0,0,0.12)',
    bgSubtle: 'rgba(0,0,0,0.04)',
    bgSubtler: 'rgba(0,0,0,0.06)',
    errorBg: 'rgba(239,68,68,0.12)',
    errorBorder: 'rgba(239,68,68,0.25)',
    errorText: '#dc2626',
    codeBg: 'rgba(0,0,0,0.06)',
    inlineCodeBg: 'rgba(0,0,0,0.08)',
    successText: '#15803d',
    successBg: 'rgba(34,197,94,0.12)',
    infoBg: 'rgba(59,130,246,0.12)',
    infoText: '#1d4ed8',
  },
};

export const CANVAS_SPACING = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  xxl: '20px',
};

export const CANVAS_FONT_SIZE = {
  xs: '10px',
  sm: '11px',
  base: '13px',
  lg: '14px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
};

export const CANVAS_RADIUS = {
  sm: '3px',
  md: '6px',
  lg: '8px',
};

export const CANVAS_TRANSITIONS = {
  fast: '0.15s',
  normal: '0.2s',
  slow: '0.3s',
};

export const CANVAS_RESPONSIVE = {
  mobile: { maxWidth: 640, canvasWidth: 70, sidebarWidth: 150 },
  tablet: { maxWidth: 1024, canvasWidth: 45, sidebarWidth: 180 },
  desktop: { maxWidth: Infinity, canvasWidth: 45, sidebarWidth: 200 },
};

// Button style helper with consistent theming
export const getButtonStyle = (isDarkMode: boolean, active = false, disabled = false) => {
  const colors = getColorScheme(isDarkMode);
  if (disabled) {
    return {
      background: 'rgba(255,255,255,0.02)',
      color: colors.textTertiary,
      cursor: 'not-allowed',
      opacity: 0.5,
      border: 'none',
      borderRadius: '6px',
      padding: '6px 8px',
      fontSize: CANVAS_FONT_SIZE.sm,
      transition: `all ${CANVAS_TRANSITIONS.fast}`,
    };
  }
  return {
    background: active ? colors.infoBg : colors.hover,
    border: 'none',
    borderRadius: '6px',
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'flex' as const,
    alignItems: 'center' as const,
    color: active ? colors.infoText : colors.textTertiary,
    fontSize: CANVAS_FONT_SIZE.sm,
    transition: `all ${CANVAS_TRANSITIONS.fast}`,
    outline: 'none',
  };
};

export function getCanvasWidth(): number {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (windowWidth < 640) return 70;
  if (windowWidth < 1024) return 45;
  return 45;
}

export function getSidebarWidth(): number {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  if (windowWidth < 640) return 150;
  if (windowWidth < 1024) return 180;
  return 200;
}

export function getColorScheme(isDarkMode: boolean) {
  return isDarkMode ? CANVAS_COLORS.dark : CANVAS_COLORS.light;
}
