/**
 * Visibility Optimizer Module
 *
 * Ensures elements are visible for interaction:
 * - Visibility state calculation (% of element visible)
 * - Scroll path calculation (direction + distance)
 * - Smooth scroll with animation completion detection
 * - Retry logic for edge cases (sticky headers, etc.)
 */

import { createLogger } from './logger';

const log = createLogger('visibility-optimizer');

// === Type: Visibility State ===
// Detailed visibility metrics for an element
export interface VisibilityState {
  isFullyVisible: boolean;    // 100% in viewport
  isPartiallyVisible: boolean; // Any part visible
  visiblePercentage: number;  // % of element visible (0-100)
  visibleArea: number;        // Pixels of element visible
  totalArea: number;          // Total element pixels
}

// === Check if Element is Fully Visible ===
// Returns true only if element is 100% within viewport bounds
// Strict check: includes margin requirement and non-zero size
export function isFullyVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const margin = 1; // 1px minimum margin from edges

  return (
    rect.top >= margin &&                     // Top edge at least 1px from top
    rect.left >= margin &&                    // Left edge at least 1px from left
    rect.bottom <= window.innerHeight - margin && // Bottom edge at least 1px from bottom
    rect.right <= window.innerWidth - margin &&   // Right edge at least 1px from right
    rect.width > 0 &&                         // Has non-zero width
    rect.height > 0                           // Has non-zero height
  );
}

// === Get Element Visibility State ===
// Calculates detailed visibility metrics
// Returns percentage visible, absolute area, and boolean flags
export function getVisibilityState(element: Element): VisibilityState {
  const rect = element.getBoundingClientRect();

  // === Check if Fully Visible ===
  const fullyVis = isFullyVisible(element);

  // === Calculate Visible Area ===
  // Intersection of element bounds and viewport bounds
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
  );

  // === Calculate Metrics ===
  const visibleArea = visibleWidth * visibleHeight; // Pixels visible
  const totalArea = rect.width * rect.height;       // Total element pixels
  const visiblePercentage = totalArea > 0 ? (visibleArea / totalArea) * 100 : 0;
  const isPartiallyVis = visibleArea > 0;

  return {
    isFullyVisible: fullyVis,
    isPartiallyVisible: isPartiallyVis,
    visiblePercentage,
    visibleArea,
    totalArea,
  };
}

// === Helper: Calculate Scroll Duration ===
// Estimates animation time based on scroll distance
// Empirically ~0.3ms per pixel (smooth scroll feels natural)
// Capped at 500ms to avoid excessive waits
function estimateScrollDuration(distance: number): number {
  return Math.min(Math.ceil(distance * 0.3), 500);
}

// === Helper: Wait for Scroll Animation to Complete ===
// Detects when browser scroll animation finishes
// Uses: estimated duration + stability detection + hard timeout
// Resolves when scroll position stabilizes (no movement for 2 checks)
async function waitForScrollCompletion(
  estimatedDuration: number = 300, // Time to wait before checking stability
  timeout: number = 5000             // Hard timeout (prevents infinite wait)
): Promise<void> {
  return new Promise((resolve) => {
    // === State Tracking ===
    let scrollStable = false;
    let stableCount = 0;
    let lastScrollX = window.scrollX;
    let lastScrollY = window.scrollY;
    let timeoutId: NodeJS.Timeout;
    let listenerTimeout: NodeJS.Timeout;

    // === Stability Check ===
    // Called repeatedly to check if scroll position has stopped changing
    const checkStability = () => {
      const currentScrollX = window.scrollX;
      const currentScrollY = window.scrollY;

      // Check if position changed since last check
      if (
        currentScrollX === lastScrollX &&
        currentScrollY === lastScrollY
      ) {
        // Position unchanged, increment stable counter
        stableCount++;
        // Consider stable after 2 consecutive unchanged checks
        if (stableCount >= 2) {
          scrollStable = true;
        }
      } else {
        // Position changed, reset counter
        stableCount = 0;
      }

      // Update position for next check
      lastScrollX = currentScrollX;
      lastScrollY = currentScrollY;

      // If stable, cleanup and resolve
      if (scrollStable) {
        cleanup();
        resolve();
      }
    };

    // === Cleanup Function ===
    // Safely clear all listeners and timers
    const cleanup = () => {
      clearTimeout(timeoutId);
      clearTimeout(listenerTimeout);
      window.removeEventListener('scroll', checkStability);
    };

    // === Two-Phase Wait ===
    // Phase 1: Wait for estimated scroll duration
    // (let browser scroll animation complete naturally)
    timeoutId = setTimeout(() => {
      // Phase 2: Start checking stability
      window.addEventListener('scroll', checkStability, { passive: true });

      // Check every 50ms for position changes
      listenerTimeout = setInterval(checkStability, 50);

      // Hard timeout: give up after total timeout
      setTimeout(() => {
        cleanup();
        resolve();
      }, timeout);
    }, estimatedDuration);
  });
}

/**
 * Ensures element is fully visible in viewport
 *
 * Strategy:
 * 1. Check if already fully visible
 * 2. Calculate scroll path
 * 3. Perform smooth scroll
 * 4. Wait for animation to complete
 * 5. Verify visibility (retry with larger padding if needed)
 *
 * @param element Element to make visible
 * @param options Scroll options
 * @param signal Abort signal for cancellation
 */
export async function ensureElementVisible(
  element: Element,
  options?: {
    padding?: number;
    behavior?: ScrollBehavior;
    timeout?: number;
    maxRetries?: number;
  },
  signal?: AbortSignal
): Promise<void> {
  const {
    padding: initialPadding = 50,
    behavior = 'smooth',
    timeout = 5000,
    maxRetries = 3,
  } = options ?? {};

  let currentPadding = initialPadding;
  let retries = 0;

  while (retries < maxRetries) {
    if (signal?.aborted) {
      log.debug('ensureElementVisible cancelled by abort signal');
      return;
    }

    // Check current visibility
    const visibility = getVisibilityState(element);

    if (visibility.isFullyVisible) {
      log.debug('Element is fully visible, no scroll needed', {
        visiblePercentage: visibility.visiblePercentage,
      });
      return;
    }

    log.debug('Scrolling element into view', {
      visiblePercentage: visibility.visiblePercentage,
      padding: currentPadding,
    });

    // === Perform Scroll ===
    // Use native scrollIntoView with smooth animation
    element.scrollIntoView({ behavior: behavior as ScrollBehavior, block: 'center' });

    // === Estimate Duration and Wait ===
    // Calculate reasonable wait time based on viewport size
    const estimatedDistance = Math.max(window.innerHeight, window.innerWidth) / 2;
    const scrollDuration = estimateScrollDuration(estimatedDistance);

    // Wait for scroll to complete
    try {
      await waitForScrollCompletion(scrollDuration, timeout);
    } catch (error) {
      log.debug('Scroll wait timeout (continuing anyway)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Verify visibility (allow small padding reduction on retry)
    const newVisibility = getVisibilityState(element);

    if (newVisibility.isFullyVisible) {
      log.debug('Element is now fully visible after scroll', {
        visiblePercentage: newVisibility.visiblePercentage,
      });
      return;
    }

    if (newVisibility.visiblePercentage >= 95) {
      log.debug('Element is 95%+ visible, accepting', {
        visiblePercentage: newVisibility.visiblePercentage,
      });
      return;
    }

    retries++;
    log.debug(`Scroll attempt ${retries}/${maxRetries} - element still not fully visible`, {
      visiblePercentage: newVisibility.visiblePercentage,
      padding: currentPadding,
    });

    // Reduce padding for next attempt (min 20px)
    currentPadding = Math.max(20, currentPadding - 10);
  }

  log.warn('Failed to fully ensure element visibility after retries', {
    maxRetries,
    finalVisibility: getVisibilityState(element),
  });
}

// === Helper: Is Element Scrollable to Visible State ===
// Quick check if element is visible enough for interaction
// Returns true if >= minVisiblePercentage (default 80%)
// Used to validate element visibility without triggering scroll
export function isScrollable(element: Element, minVisiblePercentage: number = 80): boolean {
  const visibility = getVisibilityState(element);
  return visibility.visiblePercentage >= minVisiblePercentage;
}

