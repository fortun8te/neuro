/**
 * Click Enhancements Module
 *
 * Improves click reliability through:
 * - Element type detection (button/link/input/custom)
 * - Optimal click point calculation (center vs. edge)
 * - Post-click focus handling (auto-focus inputs)
 * - Reliability scoring (visibility + state + click point quality)
 *
 * Works with coordinateRefinement.ts to form complete click pipeline.
 */

import { createLogger } from './logger';

const log = createLogger('click-enhancements');

// === Type: Element Classification ===
// Categorizes clickable elements into 4 types for optimized click behavior
export type ClickableType = 'button' | 'link' | 'input' | 'custom';

// === Type: Optimal Click Point ===
// Contains absolute coordinates in viewport space
export interface ClickPoint {
  x: number;              // Absolute viewport x coordinate
  y: number;              // Absolute viewport y coordinate
}


// === Detect Element Type for Click Optimization ===
// Classifies elements into 4 categories to apply type-specific click strategies
// Priority order: native > ARIA role > contenteditable > custom attributes
//
// Returns:
// - 'button': buttons, role=button/menuitem/tab
// - 'link': anchors, role=link
// - 'input': inputs, textareas, contenteditable
// - 'custom': everything else (divs with onclick, etc.)
export function detectClickableType(element: Element): ClickableType {
  // === Native Element Types (Highest Priority) ===
  // These are semantically clear and always take precedence
  if (element instanceof HTMLButtonElement) return 'button';
  if (element instanceof HTMLAnchorElement) return 'link';
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return 'input';
  }

  // === Non-native element — check ARIA role & attributes ===
  if (!(element instanceof HTMLElement)) return 'custom'; // Fallback for non-HTML

  // === ARIA Role (Semantic Classification) ===
  const role = element.getAttribute('role')?.toLowerCase();

  // Button-like roles
  if (role === 'button' || role === 'menuitem' || role === 'tab') {
    return 'button';
  }

  // Link-like role
  if (role === 'link') {
    return 'link';
  }

  // === Contenteditable Elements ===
  // Treat as input if element is contenteditable
  if (element.contentEditable === 'true' || element.contentEditable === 'plaintext-only') {
    return 'input';
  }

  // === Custom Clickable Attributes ===
  // Look for custom markers (data-clickable) or inline onclick handlers
  if (element.getAttribute('data-clickable')) {
    return 'custom';
  }

  if (element.onclick || element.getAttribute('onclick')) {
    return 'custom';
  }

  // === Fallback ===
  // No type determined, treat as custom
  return 'custom';
}


// === Check if Element Needs Scrolling ===
// Returns true if element is not fully visible in viewport
// Used to determine if we should scroll before clicking
export function shouldScrollBeforeClick(element: Element): boolean {
  const rect = element.getBoundingClientRect();

  // === Check if element is completely outside viewport ===
  // If any edge is outside viewport, definitely need to scroll
  if (
    rect.bottom < 0 ||        // Above viewport
    rect.top > window.innerHeight ||  // Below viewport
    rect.right < 0 ||         // Left of viewport
    rect.left > window.innerWidth     // Right of viewport
  ) {
    return true;
  }

  // === Check if element is fully visible ===
  // All edges must be within viewport bounds
  const isFullyVisible =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;

  // Return true if NOT fully visible
  return !isFullyVisible;
}

// === Calculate Optimal Click Point ===
// Returns the best coordinate to click based on element type
// Different strategies for buttons (center), inputs (inside-left), etc.
// Clamps to viewport safe bounds
export function getOptimalClickPoint(element: Element): ClickPoint {
  // === Get Element Bounds and Type ===
  const rect = element.getBoundingClientRect();
  const type = detectClickableType(element);

  // === Calculate Offset from Element Top-Left ===
  // Determines where within the element to click
  let offsetX = 0;
  let offsetY = 0;

  // === Type-Specific Click Strategies ===
  switch (type) {
    case 'button':
      // Click center of button (good for visual feedback)
      offsetX = rect.width / 2;
      offsetY = rect.height / 2;
      break;

    case 'link':
      // Click center of link (standard behavior)
      offsetX = rect.width / 2;
      offsetY = rect.height / 2;
      break;

    case 'input':
      // Click inside field, slightly left of center (positions cursor at start)
      // Use 30% of width or 20px max (whichever is smaller)
      offsetX = Math.min(rect.width * 0.3, 20);
      offsetY = rect.height / 2;
      break;

    case 'custom':
      // Default to center for custom elements
      offsetX = rect.width / 2;
      offsetY = rect.height / 2;
      break;
  }

  // === Convert to Viewport Coordinates ===
  // Element bounds + offset = viewport coordinates
  let x = rect.left + offsetX;
  let y = rect.top + offsetY;

  // === Clamp to Viewport Safe Bounds ===
  // Ensure click coordinates are within viewport with 5px margin
  // Prevents clicking off-screen or in browser chrome
  const margin = 5;
  x = Math.max(margin, Math.min(x, window.innerWidth - margin));
  y = Math.max(margin, Math.min(y, window.innerHeight - margin));

  return { x, y };
}

// === Post-Click Focus Handling ===
// After clicking an element, prepare it for next interaction
// - Auto-focus inputs
// - Select existing text
// - Position cursor for contenteditable
// This bridges the gap between click and type actions
export function postClickFocus(element: Element): void {
  // Only handle HTML elements
  if (!(element instanceof HTMLElement)) {
    return;
  }

  // === Determine if Element Requires Focus Handling ===
  const type = detectClickableType(element);

  // Only apply focus handling to input-type elements
  if (type !== 'input') {
    return;
  }

  // === Step 1: Focus the Element ===
  // Ensures it's the active element for subsequent type actions
  element.focus();

  // === Step 2: Handle Input Elements ===
  if (element instanceof HTMLInputElement) {
    // Selectable input types: text, email, password, search, tel, url
    // Select all existing text to prepare for replacement
    const selectableTypes = [
      'text',
      'email',
      'password',
      'search',
      'tel',
      'url',
    ];

    if (selectableTypes.includes(element.type)) {
      // Select all text (ready to be replaced by type action)
      element.select();
      log.debug('Selected text in input field', {
        type: element.type,
        value: element.value?.substring(0, 20),
      });
    } else if (element.type === 'number' || element.type === 'range') {
      // For number inputs: position caret at end (for appending digits)
      element.setSelectionRange(
        element.value.length,
        element.value.length
      );
    }
  }

  // === Step 3: Handle Textarea Elements ===
  if (element instanceof HTMLTextAreaElement) {
    // Select all text in textarea (prepare for replacement)
    element.select();
    log.debug('Selected text in textarea');
  }

  // === Step 4: Handle Contenteditable Elements ===
  if (element.contentEditable === 'true') {
    // Focus element
    element.focus();

    // Create range to position cursor at end of content
    const range = document.createRange();
    const sel = window.getSelection();

    // Place cursor after last child (at end of content)
    if (element.lastChild) {
      range.setStartAfter(element.lastChild);
    } else {
      range.setStart(element, 0); // Empty element, position at start
    }

    // Collapse range to position cursor
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    log.debug('Placed cursor in contenteditable element');
  }
}

