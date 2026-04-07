/**
 * html2canvas Singleton Loader
 * Centralized dynamic import with error handling and feature detection
 * Prevents duplicate imports and provides consistent fallback behavior
 */

let _html2canvas: typeof import('html2canvas').default | null = undefined;
let _loadPromise: Promise<typeof import('html2canvas').default | null> | null = null;

/**
 * Load html2canvas library with caching and feature detection
 * Returns cached result on subsequent calls
 * @returns html2canvas library or null if unavailable
 */
export async function loadHtml2Canvas(): Promise<typeof import('html2canvas').default | null> {
  // Return cached success/failure result
  if (_html2canvas !== undefined) {
    return _html2canvas;
  }

  // Return existing loading promise to avoid duplicate imports
  if (_loadPromise !== null) {
    return _loadPromise;
  }

  _loadPromise = (async () => {
    try {
      const mod = await import('html2canvas');
      _html2canvas = mod.default;
      console.debug('[html2canvasLoader] Loaded successfully');
      return _html2canvas;
    } catch (err) {
      _html2canvas = null; // Cache failure
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn('[html2canvasLoader] Failed to load (screenshots/exports disabled):', errorMsg);
      return null;
    }
  })();

  return _loadPromise;
}

/**
 * Check if html2canvas is available without loading it
 * Useful for feature detection in UI
 * @returns true if library is available, false otherwise
 */
export function isHtml2CanvasAvailable(): boolean {
  return _html2canvas !== null && _html2canvas !== undefined;
}

/**
 * Clear cache (useful for testing or module reloading)
 */
export function clearHtml2CanvasCache(): void {
  _html2canvas = undefined;
  _loadPromise = null;
}

/**
 * Utility: Capture HTML element to JPEG base64
 * @param element - HTML element to capture
 * @param quality - JPEG quality (0-1), default 0.8
 * @returns Base64 string without data URL prefix, or empty string if failed
 */
export async function captureElementToBase64(
  element: HTMLElement,
  quality: number = 0.8
): Promise<string> {
  const html2canvas = await loadHtml2Canvas();
  if (!html2canvas) {
    return '';
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 1,
      useCORS: true,
      logging: false,
      allowTaint: true,
      ignoreElements: (el) => {
        try {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage || '';
          // Skip elements with gradient backgrounds that might have non-finite stops
          if (bg.includes('gradient') && el.getBoundingClientRect().width === 0) return true;
        } catch {
          // getComputedStyle can throw on detached elements
        }
        return false;
      },
    });

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];
    return base64 || '';
  } catch (err) {
    console.warn('[captureElementToBase64] Capture failed:', err instanceof Error ? err.message : String(err));
    return '';
  }
}
