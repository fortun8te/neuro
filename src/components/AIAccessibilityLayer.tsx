/**
 * AIAccessibilityLayer — Semantic metadata helpers for AI agents
 *
 * Zero visual impact. Provides:
 *   - useAIHint(ref, hint) — sets data-ai-hint on a DOM element
 *   - AILabel — visually hidden span with a plain-text description
 *
 * These help small (2B) AI models understand what each element is/does
 * without relying on visual context alone.
 */

import { useEffect, type RefObject } from 'react';

/**
 * Attaches a `data-ai-hint` attribute to a DOM element so that AI agents
 * scanning the page can read plain-text descriptions of what the element does.
 *
 * Usage:
 *   const btnRef = useRef<HTMLButtonElement>(null);
 *   useAIHint(btnRef, 'Click to open Finder file browser');
 */
export function useAIHint(ref: RefObject<HTMLElement | null>, hint: string): void {
  useEffect(() => {
    if (ref.current) {
      ref.current.setAttribute('data-ai-hint', hint);
    }
  }, [ref, hint]);
}

/**
 * Renders a visually hidden <span> containing a plain-text description.
 * Useful for decorative elements that have no visible label.
 *
 * The span is positioned off-screen (not display:none) so it is still
 * reachable by accessibility tooling and AI DOM scanners.
 */
export function AILabel({ children }: { children: string }) {
  return (
    <span
      aria-hidden={false}
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  );
}
