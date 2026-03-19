/**
 * OrbitalLoader — Morphing blob thinking indicator
 * Uses framer-motion animate prop for smooth circle-to-rounded-square animation.
 * `size` = overall bounding area.
 */

import { motion } from 'framer-motion';

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
  const blobSize = Math.max(10, Math.round(size * 0.5));

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.div
        style={{
          width: blobSize,
          height: blobSize,
          background: dark
            ? 'linear-gradient(135deg, #4d9aff, #2B79FF, #1a5fd4)'
            : 'linear-gradient(135deg, #4d9aff, #2B79FF, #1a5fd4)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          borderRadius: ['50%', '22%', '50%'],
          rotate: [0, 90, 180],
          scale: [0.95, 1.08, 0.95],
          boxShadow: [
            `0 0 ${blobSize * 0.3}px rgba(43,121,255,0.2), 0 0 ${blobSize * 0.6}px rgba(43,121,255,0.06)`,
            `0 0 ${blobSize * 0.5}px rgba(77,154,255,0.35), 0 0 ${blobSize}px rgba(43,121,255,0.12)`,
            `0 0 ${blobSize * 0.3}px rgba(43,121,255,0.2), 0 0 ${blobSize * 0.6}px rgba(43,121,255,0.06)`,
          ],
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
