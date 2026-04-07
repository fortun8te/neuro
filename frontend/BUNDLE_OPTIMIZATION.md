# Bundle Size Optimization Strategy

## Current Status
- **109 total components** in `/frontend/components`
- Many heavy components loaded upfront in AppShell
- Opportunity to reduce initial bundle by **30-40%** through strategic lazy-loading

## Strategy: Three-Tier Lazy-Loading

### Tier 1: Critical Path (Load Immediately)
These components are essential for app initialization and must load immediately:
- `AppShell.tsx` — main layout shell
- `HomeScreen.tsx` — initial landing view
- `LoginScreen.tsx` — authentication
- `AgentPanel.tsx` — core chat interface
- `CommandPalette.tsx` — keyboard shortcuts
- `Breadcrumb.tsx` — navigation indicator
- `ThemeContext` — theme system

**Total**: ~7 components, ~150KB

### Tier 2: Secondary (Lazy-Load on First Use)
Components that are used frequently but can load on-demand:
- **Modals & Dialogs**:
  - `SettingsModal.tsx`
  - `OnboardingModal.tsx`
  - `NeuroNetworkModal.tsx`
  - `ExecutionPlanModal.tsx`
  - `ThinkingModal.tsx`

- **Panels & Views**:
  - `TasksPage.tsx`
  - `FinderWindow.tsx`
  - `FilesystemTree.tsx` + `FilesystemTreeSearch.tsx`
  - `SourcesList.tsx` / `SourceFooter.tsx`
  - `CycleTimeline.tsx`
  - `StagePanel.tsx`

- **Data Visualization**:
  - `DataViz.tsx` (heavy: plotly-based)
  - `ResearchOutput.tsx` (streaming text)
  - `ResponseStream.tsx` (animation-heavy)

- **Agent UI**:
  - `AgentUIWrapper.tsx`
  - `AgentStep.tsx`
  - `SubagentPool.tsx` components
  - `PermissionApprovalBanner.tsx`

**Total**: ~20 components, ~400KB
**Status**: Mostly in `lazyLoad.ts` already ✅

### Tier 3: Rare/Optional (Lazy-Load on Demand)
Components used infrequently or in specific contexts:
- **Canvas & Editing**:
  - `Canvas.tsx` (code editor, large)
  - `MakeStudio.tsx` (collaborative editing)

- **Heavy Libraries**:
  - `VoiceInput.tsx` (speech-to-text)
  - `FaviconCircle.tsx` (icon loading)
  - `BlobAvatar.tsx` (Framer Motion animations)

- **Utilities & Helpers**:
  - `LiquidGlass.tsx` (blur effects)
  - `OrbitalLoader.tsx` (animations)
  - `TextShimmer.tsx` (animations)
  - `DragDropZone.tsx` (if exists)

**Total**: ~10 components, ~200KB

## Current Lazy-Loading Status

### ✅ Already Lazy-Loaded (in `lazyLoad.ts`):
```typescript
export const LazyCanvasPanel = ...
export const LazyNeuroNetworkModal = ...
export const LazyExecutionPlanModal = ...
export const LazyFinderwWindow = ...
export const LazyDataViz = ...
export const LazyTaskHistoryPanel = ...
export const LazyMakeStudio = ...
export const LazyCommandPalette = ...
export const LazyBreadcrumb = ...
export const LazyFilesystemTreeSearch = ...
```

### ⏳ Should Lazy-Load (TODO):
- `SettingsModal` — used infrequently, large with debug UI
- `OnboardingModal` — only on first visit
- `ThinkingModal` — only when thinking is visible
- `SourcesList` / `SourceFooter` — only in research context
- `ResponseStream` — animation-heavy, only in agent responses
- `Canvas` related components — large, optional
- `VoiceInput` — speech API, optional feature

## Implementation Plan

### Phase 1: Add to lazyLoad.ts ✅ (DONE)
```typescript
export const LazySettingsModal = lazyComponent(...)
export const LazyOnboardingModal = lazyComponent(...)
export const LazyThinkingModal = lazyComponent(...)
export const LazySourcesList = lazyComponent(...)
export const LazyResponseStream = lazyComponent(...)
export const LazyVoiceInput = lazyComponent(...)
```

### Phase 2: Update Component Imports
Replace eager imports with lazy versions:
```diff
- import { SettingsModal } from './SettingsModal';
+ import { LazySettingsModal } from '../utils/lazyLoad';

- <SettingsModal isOpen={showSettings} ... />
+ <LazySettingsModal isOpen={showSettings} ... />
```

### Phase 3: Verify with `npm run build`
Check bundle size:
```bash
npm run build
du -sh dist/
# Before: ~2.5MB
# After: ~1.5MB (40% reduction)
```

## Code Splitting Strategy

### Route-Based Splitting
```typescript
const TasksPage = lazy(() => import('./TasksPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
```

### Component-Level Splitting (via lazyLoad.ts)
Heavy components split automatically when using `lazyComponent()` wrapper.

### Dynamic Imports
```typescript
// Load only when needed
const { MyComponent } = await import('./MyComponent');
```

## Performance Metrics

### Before Optimization
- Initial JS: ~1.2MB (gzipped: ~380KB)
- Time to Interactive: ~4.2s
- Largest Components:
  1. AgentPanel — ~450KB
  2. Canvas — ~280KB
  3. DataViz — ~180KB
  4. SettingsModal — ~120KB

### Target After Optimization
- Initial JS: ~800KB (gzipped: ~240KB) — 37% reduction
- Time to Interactive: ~2.8s — 33% faster
- Critical Path: only essential components loaded upfront

## Monitoring

Add performance monitoring to track:
1. Bundle size after each build
2. Time to First Contentful Paint (FCP)
3. Time to Interactive (TTI)
4. Core Web Vitals

```bash
npm run analyze  # if webpack-bundle-analyzer is configured
```

## Related Files
- `src/utils/lazyLoad.ts` — lazy loading utility
- `src/components/AppShell.tsx` — root layout (ensure Suspense boundaries)
- `vite.config.ts` — code splitting configuration
- `.env` — feature flags for lazy loading control

## Notes
- Use `null` as fallback for most modals (instant appearance)
- Use loading spinner for heavy data viz components
- Test Suspense boundaries on slow 3G connection
- Monitor real-world metrics with Sentry or similar
