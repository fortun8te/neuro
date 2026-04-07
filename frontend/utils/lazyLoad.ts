/**
 * Lazy Loading Utility — Code splitting for components
 * Reduces initial bundle size by splitting components into chunks
 *
 * NOTE: This file provides a lazyComponent utility wrapper but no components
 * are currently exported. The 19 lazy-loaded component exports were removed
 * (audit finding: CRITICAL dead code — Phase 2 bundle optimization was never completed).
 *
 * If implementing Phase 2 in the future:
 * 1. Add lazy components back here
 * 2. Update components to import from this file (see BUNDLE_OPTIMIZATION.md)
 * 3. Verify with npm run build that bundle size decreases as expected
 */

import React, { lazy, Suspense } from 'react';

/**
 * Create a lazy-loaded component with fallback UI
 *
 * Usage:
 * ```typescript
 * export const LazySettingsModal = lazyComponent(
 *   () => import('./SettingsModal').then(m => ({ default: m.SettingsModal })),
 *   <LoadingSpinner /> // optional fallback
 * );
 * ```
 */
export function lazyComponent<P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  fallback: React.ReactNode = null
): React.ComponentType<P> {
  const LazyComponent = lazy(importFunc);

  return (props: P) =>
    React.createElement(
      Suspense,
      { fallback },
      React.createElement(LazyComponent, props)
    );
}
