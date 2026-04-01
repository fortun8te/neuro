/**
 * BGPattern — Subtle animated dot pattern background layer
 *
 * Uses a radial-gradient dot grid with slow drift animation.
 * GPU-accelerated via will-change + transform.
 */

interface BGPatternProps {
  variant?: 'dots';
  mask?: 'none' | 'fade-edges';
  size?: number;
  fill?: string;
  className?: string;
}

export function BGPattern({
  variant: _variant = 'dots',
  mask = 'fade-edges',
  size = 28,
  fill = 'var(--glass-border-light)',
  className = '',
}: BGPatternProps) {
  const maskStyle: React.CSSProperties =
    mask === 'fade-edges'
      ? {
          maskImage:
            'radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 100%)',
        }
      : {};

  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{
        ...maskStyle,
        backgroundImage: `radial-gradient(circle, ${fill} 0.8px, transparent 0.8px)`,
        backgroundSize: `${size}px ${size}px`,
        animation: `nomad-dot-drift 60s ease-in-out infinite, nomad-dot-pulse 30s ease-in-out infinite`,
        willChange: 'background-position, transform',
        zIndex: 1,
      }}
    />
  );
}
