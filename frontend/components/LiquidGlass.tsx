import React from 'react';

interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  intensity?: 'subtle' | 'medium' | 'strong';
}

const INTENSITY_CLASS: Record<string, string> = {
  subtle: 'nomad-glass-subtle',
  medium: 'nomad-glass-medium',
  strong: 'nomad-glass-strong',
};

/**
 * LiquidGlass — frosted dark glass wrapper.
 *
 * intensity controls:
 *  subtle  – very light glass, good for overlays/panels on dark bg
 *  medium  – visible glass with inner shadow, good for cards / chrome
 *  strong  – full glass with SVG distortion filter, good for hero elements
 */
export function LiquidGlass({
  children,
  className = '',
  style = {},
  intensity = 'subtle',
}: LiquidGlassProps) {
  return (
    <div
      className={INTENSITY_CLASS[intensity] + (className ? ' ' + className : '')}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * SVG filter definitions for the "strong" glass distortion.
 * Render once at app root level (hidden — zero visual footprint).
 */
export function GlassFilter() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="glass-distortion" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
