/**
 * TextShimmer -- Premium animated shimmer effect on text.
 *
 * A gradient highlight sweeps across the text in an infinite loop.
 * Customise base/highlight colors via CSS custom properties:
 *   --shimmer-base, --shimmer-highlight
 * or use Tailwind arbitrary-property classes:
 *   [--shimmer-base:rgba(43,121,255,0.3)] [--shimmer-highlight:rgba(43,121,255,0.9)]
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface TextShimmerProps {
  children: string;
  className?: string;
  /** Full cycle duration in seconds (default 2) */
  duration?: number;
  /** Spread of the highlight band, multiplied by text length (default 2) */
  spread?: number;
}

export function TextShimmer({
  children,
  className = '',
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <motion.span
      className={`relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent ${className}`}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{ repeat: Infinity, duration, ease: 'linear' }}
      style={{
        backgroundImage: `linear-gradient(90deg, #0000 calc(50% - ${dynamicSpread}px), var(--shimmer-highlight, #ffffff), #0000 calc(50% + ${dynamicSpread}px)), linear-gradient(var(--shimmer-base, #71717a), var(--shimmer-base, #71717a))`,
        backgroundRepeat: 'no-repeat, padding-box',
      }}
    >
      {children}
    </motion.span>
  );
}
