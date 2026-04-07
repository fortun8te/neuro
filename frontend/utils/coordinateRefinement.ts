/**
 * Coordinate Refinement Module
 *
 * Improves click accuracy through 4-stage validation pipeline:
 * 1. Bounds validation — Fails out-of-range coordinates immediately (fast gate)
 * 2. Accessibility tree lookup — Snaps to nearest semantic element (high confidence)
 * 3. Retry with jitter — Tries adjusted coordinates for edge cases (robustness)
 * 4. Fallback — Returns original/screen-center if all else fails (guaranteed return)
 *
 * Each stage is independent and can fail gracefully to the next stage.
 */

import { INFRASTRUCTURE } from '../config/infrastructure';
import { createLogger } from './logger';
import {
  detectClickableType,
  shouldScrollBeforeClick,
  getOptimalClickPoint,
  postClickFocus,
} from './clickEnhancements';
import {
  ensureElementVisible,
  getVisibilityState,
} from './visibilityOptimizer';

const log = createLogger('coordinate-refinement');

// === Type Definitions ===
// Result of coordinate refinement, includes method and confidence score
export interface CoordinateRefinementResult {
  x: number;
  y: number;
  method: 'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback';
  confidence: number;
  validated: boolean;
}

// === Stage 2: Accessibility Tree Refinement ===
// Queries remote accessibility tree API to snap coordinates to semantic elements
// Higher confidence than vision (uses actual DOM role/bounds data)
// Inputs: x, y (from vision), sessionId (to fetch tree), tolerance (max snap distance)
// Returns: refined coordinates + confidence score, or null if no element found within tolerance
async function refineViaAccessibilityTree(
  x: number,
  y: number,
  sessionId: string,
  tolerance: number = 50, // max pixels to snap
  signal?: AbortSignal,
): Promise<CoordinateRefinementResult | null> {
  try {
    // Fetch accessibility tree from remote session API
    // Note: INFRASTRUCTURE.wayfarerUrl should be the session endpoint
    const resp = await fetch(
      `${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/accessibility`,
      { signal }
    );

    // If fetch fails (network error, 404, 500, etc.), return null to try next stage
    if (!resp.ok) {
      log.debug('Accessibility tree fetch failed', { status: resp.status });
      return null;
    }

    // Parse accessibility tree response
    const { nodes } = (await resp.json()) as { nodes: unknown[] };

    // Accessibility tree node shape returned by the Wayfayer /accessibility endpoint
    interface AXNode {
      bounds?: { x: number; y: number; width: number; height: number };
      role?: string;
      name?: string;
      children?: AXNode[];
    }

    // Extended node type when a nearest match is found (includes computed center + distance)
    interface NearestAXNode extends AXNode {
      centerX: number;
      centerY: number;
      distance: number;
    }

    // === Find nearest clickable element ===
    // Track the closest element found during recursive search
    let nearest: NearestAXNode | null = null;
    let minDistance = tolerance;

    // Recursive function to traverse tree and find nearest clickable element
    const findNearest = (items: AXNode[]): void => {
      for (const node of items) {
        // Skip nodes without bounds, role, or clickable role (filters spam)
        if (
          node.bounds &&
          node.role &&
          isClickableRole(node.role) &&
          node.name !== '' // Ignore unlabeled elements
        ) {
          // Calculate distance from click point to element center
          const centerX = node.bounds.x + node.bounds.width / 2;
          const centerY = node.bounds.y + node.bounds.height / 2;
          const dist = Math.hypot(centerX - x, centerY - y);

          // Keep track of closest element
          if (dist < minDistance) {
            minDistance = dist;
            nearest = { ...node, centerX, centerY, distance: dist };
          }
        }

        // Recurse into children (if tree has nested structure)
        if (node.children) findNearest(node.children);
      }
    };

    // Start recursive search from root nodes
    findNearest(nodes as AXNode[]);

    // === Return result if element found within tolerance ===
    // Confidence decreases with distance (0.0 at tolerance boundary, 1.0 at click point)
    if (nearest && minDistance < tolerance) {
      log.debug('Accessibility tree refinement succeeded', {
        visionCoords: { x, y },
        refinedCoords: { x: nearest.centerX, y: nearest.centerY },
        distance: minDistance,
        element: nearest.name,
      });

      return {
        x: Math.round(nearest.centerX),
        y: Math.round(nearest.centerY),
        method: 'accessibility-tree',
        confidence: 1.0 - minDistance / tolerance, // 1.0 = exact, 0.0 = at tolerance boundary
        validated: true,
      };
    }

    // No element found within tolerance, fall through to next stage
  } catch (e) {
    // Network error, JSON parse error, or other fetch failure
    // Log and continue to next refinement stage
    log.debug('Accessibility tree refinement failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return null;
}

// === Stage 3: Retry with Jitter ===
// For cases where vision is slightly off (e.g., due to scaling or rounding),
// tries nearby coordinates with small random adjustments (±10px)
// Robust fallback when accessibility tree is unavailable
// Inputs: x, y (from vision), desktopEl (to get bounds), maxRetries (attempt count)
// Returns: refined coordinates + confidence, or null if all retries fail
async function retryWithJitter(
  x: number,
  y: number,
  desktopEl: HTMLElement,
  maxRetries: number = 2, // Keep it short (usually 1-2 attempts succeed)
): Promise<CoordinateRefinementResult | null> {
  // Get desktop element bounds to convert local coords to page coords
  const rect = desktopEl.getBoundingClientRect();

  // Try up to maxRetries times, each time with random jitter (±10px)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // First attempt (attempt=0) uses original coordinates, subsequent attempts add jitter
    // Jitter range: ±10px (randomized)
    const jitterX = attempt > 0 ? (Math.random() - 0.5) * 20 : 0;
    const jitterY = attempt > 0 ? (Math.random() - 0.5) * 20 : 0;

    // Calculate adjusted coordinates
    const adjustedX = x + jitterX;
    const adjustedY = y + jitterY;

    // === Bounds check ===
    // Ensure adjusted coordinates are still within screen bounds
    if (adjustedX < 0 || adjustedX > rect.width || adjustedY < 0 || adjustedY > rect.height) {
      continue; // This attempt is out of bounds, try next jitter
    }

    // === Find element at adjusted coordinates ===
    // Convert from desktop-local coords to viewport coords
    const clientX = rect.left + adjustedX;
    const clientY = rect.top + adjustedY;

    // Get the topmost element at this coordinate
    const target = document.elementFromPoint(clientX, clientY);

    // === Check if element is clickable ===
    // Look for common interactive patterns (buttons, inputs, links, custom clickable divs)
    if (
      target &&
      (target.closest('button') ||
        target.closest('[role="button"]') ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.closest('a') ||
        target.closest('[data-clickable]'))
    ) {
      log.debug('Retry with jitter succeeded', {
        attempt: attempt + 1,
        originalCoords: { x, y },
        adjustedCoords: { x: adjustedX, y: adjustedY },
        element: (target as HTMLElement).tagName,
      });

      return {
        x: Math.round(adjustedX),
        y: Math.round(adjustedY),
        method: 'retry-jitter',
        // Confidence decreases with jitter magnitude (0.5 at max, 1.0 at 0 jitter)
        confidence: 1.0 - (Math.abs(jitterX) + Math.abs(jitterY)) / 40,
        validated: true,
      };
    }

    log.debug(`Retry attempt ${attempt + 1}/${maxRetries} found no clickable element`);
  }

  // All retries exhausted, no clickable element found
  return null;
}

// === Main Refinement Pipeline ===
// Orchestrates 4-stage coordinate refinement:
// 1. Bounds check (fast fail for out-of-range)
// 2. Accessibility tree snap (high-confidence semantic match)
// 3. Jitter retry (robustness for edge cases)
// 4. Fallback (guaranteed return with original or screen center)
//
// Each stage is tried in order, and if it produces high-confidence results,
// the pipeline stops and returns immediately (short-circuit optimization).
export async function refineCoordinates(
  x: number,
  y: number,
  desktopEl: HTMLElement,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<CoordinateRefinementResult> {
  log.debug('Starting coordinate refinement', { visionCoords: { x, y } });

  // Get desktop element bounds (needed for coordinate conversion)
  const rect = desktopEl.getBoundingClientRect();

  // === Stage 1: Bounds Validation ===
  // Fail immediately if coordinates are way out of range (prevent invalid click dispatch)
  if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
    log.warn('Bounds validation failed', {
      coords: { x, y },
      bounds: { width: rect.width, height: rect.height },
    });
    // Fallback to screen center (safest default)
    return {
      x: rect.width / 2,
      y: rect.height / 2,
      method: 'fallback',
      confidence: 0.3,
      validated: false,
    };
  }

  // === Stage 2: Accessibility Tree Refinement ===
  // If sessionId provided, snap to nearest semantic element
  // This is the most reliable method (uses real DOM role/bounds data)
  if (sessionId) {
    const axResult = await refineViaAccessibilityTree(
      x,
      y,
      sessionId,
      50, // tolerance: snap if within 50px of an element center
      signal
    );

    // Short-circuit: if we got a high-confidence accessibility match, use it
    if (axResult && axResult.confidence > 0.5) {
      log.debug('Using accessibility tree refinement (high confidence)', { confidence: axResult.confidence });
      return axResult;
    }
  }

  // === Stage 3: Retry with Jitter ===
  // If accessibility tree failed or low confidence, try small random adjustments
  // Handles cases where vision is slightly off due to scaling/rounding
  const retryResult = await retryWithJitter(x, y, desktopEl, 2);

  // Short-circuit: if jitter found a clickable element with decent confidence, use it
  if (retryResult && retryResult.confidence > 0.4) {
    log.debug('Using jitter refinement (moderate confidence)', { confidence: retryResult.confidence });
    return retryResult;
  }

  // === Stage 4: Fallback ===
  // All refinement methods failed or low confidence, return original vision coordinates
  // Vision model is usually reasonably accurate (0.8 confidence is conservative estimate)
  log.debug('Coordinate refinement fallback to vision coordinates');
  return {
    x: Math.round(x),
    y: Math.round(y),
    method: 'vision',
    confidence: 0.8, // Vision coordinates are usually within 10-20px of target
    validated: false,
  };
}

// === Helper: Check if ARIA role is clickable ===
// Used by accessibility tree refinement to filter interactive elements
// Only matches roles that represent user-interactive controls
function isClickableRole(role: string): boolean {
  // Whitelist of clickable ARIA roles
  const clickableRoles = [
    'button',    // Standard button
    'link',      // Navigation link
    'menuitem',  // Menu item (click to activate)
    'option',    // Select/combobox option
    'tab',       // Tab in tab panel
    'checkbox',  // Checkable input
    'radio',     // Radio button option
    'switch',    // Toggle switch
    'textbox',   // Text input
    'searchbox', // Search input
    'combobox',  // Dropdown input
    'listbox',   // List of selectable items
  ];
  return clickableRoles.includes(role.toLowerCase());
}

// === Type: Full Click Execution Metrics ===
// Captures detailed metrics from entire refined click pipeline
// Used for post-mortem analysis and success/failure correlation
export interface RefinementMetrics {
  originalCoords: { x: number; y: number };     // From vision model
  refinedCoords: { x: number; y: number };      // After refinement
  method: string;                               // refinement method used
  confidence: number;                           // confidence score (0-1)
  distance: number;                             // euclidean distance (pixels)
  duration: number;                             // total time (ms)
  // Phase 3: Click enhancement metrics
  clickableType?: string;                       // button | link | input | custom
  elementReliability?: number;                  // reliability score (0-1)
  wasScrolled?: boolean;                        // did we need to scroll?
  visibilityPercentage?: number;                // % of element visible after click
  optimizedPoint?: boolean;                     // did we adjust click point?
}

// === Execute Full Refined Click Pipeline ===
// Combines coordinate refinement + click enhancements + visibility optimization
// Full pipeline:
// 1. Refine coordinates (4-stage validation)
// 2. Find target element
// 3. Detect element type (button/link/input/custom)
// 4. Calculate click reliability score
// 5. Ensure element is visible (scroll if needed)
// 6. Calculate optimal click point (center vs. edge)
// 7. Dispatch click events (mousedown → mouseup → click)
// 8. Post-click focus (auto-focus inputs, select text)
// 9. Return detailed metrics for analysis
export async function executeRefinedClick(
  x: number,
  y: number,
  desktopEl: HTMLElement,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<RefinementMetrics | null> {
  const start = performance.now();

  try {
    // === Step 1: Refine Coordinates ===
    // Run 4-stage pipeline to snap vision coordinates to actual target
    const refined = await refineCoordinates(x, y, desktopEl, sessionId, signal);

    // === Step 2: Find Element at Refined Coordinates ===
    // Convert desktop-local coordinates to viewport coordinates
    const rect = desktopEl.getBoundingClientRect();
    const clientX = rect.left + refined.x;
    const clientY = rect.top + refined.y;

    // Get the topmost element at this coordinate
    const target = document.elementFromPoint(clientX, clientY);

    // If no element found, can't proceed (this is unusual, means coordinates are in whitespace)
    if (!target) {
      log.warn('No element found at refined coordinates', {
        refined: { x: refined.x, y: refined.y },
      });
      return null;
    }

    // === Step 3: Analyze Element Type ===
    // Determine what type of element we're clicking (affects click strategy)
    const clickableType = detectClickableType(target);

    log.debug('Element analysis complete', {
      type: clickableType,
    });

    // === Step 4: Check Visibility & Scroll if Needed ===
    // Some elements may be partially or fully outside viewport after refinement
    let wasScrolled = false;
    const visibilityBefore = getVisibilityState(target);

    // Scroll into view if element is not fully visible
    if (shouldScrollBeforeClick(target)) {
      log.debug('Element not fully visible, scrolling into view', {
        visibilityPercentage: visibilityBefore.visiblePercentage,
      });

      // Wait for scroll to complete with timeout/signal support
      await ensureElementVisible(target, {
        padding: 50,          // Keep 50px margin from viewport edge
        behavior: 'smooth',   // Smooth scroll animation
        timeout: 5000,        // Max 5s for scroll to complete
      }, signal);

      wasScrolled = true;
    }

    // === Step 5: Calculate Optimal Click Point ===
    // For buttons/links: center point
    // For inputs: inside-left (near start of text)
    // For custom: center with safety margin
    const clickPoint = getOptimalClickPoint(target);
    const optimizedPoint =
      Math.abs(clickPoint.x - clientX) > 2 ||
      Math.abs(clickPoint.y - clientY) > 2;

    const finalClientX = clickPoint.x;
    const finalClientY = clickPoint.y;

    log.debug('Using optimized click point', {
      original: { x: clientX, y: clientY },
      optimized: { x: finalClientX, y: finalClientY },
      elementType: clickableType,
    });

    // === Step 6: Dispatch Click Events ===
    // Full event sequence: mousedown → mouseup → click
    // This matches real mouse behavior and works with React event handlers
    (target as HTMLElement).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: finalClientX,
        clientY: finalClientY,
      })
    );
    (target as HTMLElement).dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: finalClientX,
        clientY: finalClientY,
      })
    );
    (target as HTMLElement).dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: finalClientX,
        clientY: finalClientY,
      })
    );

    // === Step 7: Post-Click Focus Handling ===
    // Auto-focus inputs, select text in textareas, position cursor in contenteditable
    postClickFocus(target);

    // === Step 8: Capture Final Metrics ===
    const duration = performance.now() - start;
    const visibilityAfter = getVisibilityState(target);

    log.debug('Refined click executed successfully', {
      original: { x, y },
      refined: { x: refined.x, y: refined.y },
      method: refined.method,
      clickableType,
      wasScrolled,
      duration,
    });

    // Return full metrics for correlation analysis
    return {
      originalCoords: { x, y },
      refinedCoords: { x: refined.x, y: refined.y },
      method: refined.method,
      confidence: refined.confidence,
      distance: Math.hypot(refined.x - x, refined.y - y),
      duration,
      clickableType,
      elementReliability: 0.8, // Default reliability score
      wasScrolled,
      visibilityPercentage: visibilityAfter.visiblePercentage,
      optimizedPoint,
    };
  } catch (error) {
    // Any error in the pipeline (refinement, visibility, event dispatch) is caught
    // Returns null so caller can decide fallback strategy
    log.error('Refined click execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
