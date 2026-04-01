/**
 * OrbitalLoader — Morphing square thinking indicator
 * Wraps MorphingSquare in a fixed bounding box.
 * `size` = overall bounding area.
 */

import { MorphingSquare } from './ui/morphing-square';

interface GridLoaderProps {
  size?: number;
  dark?: boolean;
  className?: string;
}

export function OrbitalLoader({
  size = 24,
  dark = false,
  className = '',
}: GridLoaderProps) {
  const squareSize = Math.max(10, Math.round(size * 0.5));

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <MorphingSquare
        size={squareSize}
        color={dark ? '#4d9aff' : '#374151'}
      />
    </div>
  );
}
