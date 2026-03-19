/**
 * SidebarGradient — WebGL mesh gradient background using @paper-design/shaders-react
 *
 * Renders a dark, slowly-moving mesh gradient with deep navy/blue tones.
 * Falls back to a CSS radial-gradient animation if WebGL is unavailable.
 */
import { useEffect, useRef, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

/** CSS fallback for environments without WebGL */
function CSSFallbackGradient() {
  const injected = useRef(false);

  // Randomize animation delays so each mount looks unique
  const delays = useRef({
    d1: Math.random() * -20,
    d2: Math.random() * -30,
    d3: Math.random() * -25,
    d4: Math.random() * -15,
  });
  const d = delays.current;

  useEffect(() => {
    if (injected.current || typeof document === 'undefined') return;
    injected.current = true;
    const s = document.createElement('style');
    s.id = 'nomad-sidebar-css-fallback';
    s.textContent = `
      @keyframes nsg-css-drift1 {
        0%   { background-position: 20% 50%, 80% 20%, 0 0; }
        50%  { background-position: 15% 65%, 70% 35%, 0 0; }
        100% { background-position: 20% 50%, 80% 20%, 0 0; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <div
      className="absolute inset-0"
      style={{
        background: [
          'radial-gradient(ellipse 55% 60% at 25% 50%, rgba(43,121,255,0.08) 0%, transparent 100%)',
          'radial-gradient(ellipse 50% 50% at 75% 30%, rgba(43,121,255,0.04) 0%, transparent 100%)',
          '#000',
        ].join(', '),
        backgroundSize: '200% 200%, 200% 200%, 100% 100%',
        animation: `nsg-css-drift1 50s ease-in-out infinite`,
        animationDelay: `${d.d1}s`,
        willChange: 'background-position',
      }}
    />
  );
}

// Stable RNG at module level — never re-randomized on re-render
const GRADIENT_RNG = {
  rotation: Math.random() * 360,
  tx: (Math.random() - 0.5) * 40,
  ty: (Math.random() - 0.5) * 40,
  speed: 0.15 + Math.random() * 0.08,
};

export const SidebarGradient = /* @__PURE__ */ function SidebarGradient() {
  const [webglFailed, setWebglFailed] = useState(false);

  const rng = { current: GRADIENT_RNG };

  // Check WebGL support on mount
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setWebglFailed(true);
    } catch {
      setWebglFailed(true);
    }
  }, []);

  const { rotation, tx, ty, speed } = rng.current;

  return (
    <div
      className="absolute pointer-events-none"
      style={{ overflow: 'hidden', top: 0, bottom: 0, left: 0, width: 340 }}
    >
      {/* Black base */}
      <div className="absolute bg-black" style={{ inset: 0 }} />

      {webglFailed ? (
        <CSSFallbackGradient />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: -80,
            bottom: -80,
            left: -60,
            right: -60,
            transform: `rotate(${rotation}deg) translate(${tx}px, ${ty}px)`,
          }}
        >
          <MeshGradient
            colors={[
              '#000000',
              '#030308',
              '#06101e',
              '#0a1a35',
              '#2B79FF',
            ]}
            speed={speed}
            distortion={0.6}
            swirl={0.25}
            grainMixer={0.0}
            grainOverlay={0.015}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0.85,
            }}
          />
        </div>
      )}
    </div>
  );
}
