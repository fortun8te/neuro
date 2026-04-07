# Module Loading and Dependency Resolution Audit

## Executive Summary

Found **22 dynamic `await import()` statements** and several module loading issues. Most have proper error handling, but critical issues exist in:

1. **Missing catch blocks** (2 instances) - imports without error handling
2. **Optional module assumptions** - code assumes modules exist
3. **Missing fallback implementations** - html2canvas, neuroMemory
4. **Silent failures** - errors logged but execution continues

---

## Critical Issues Found

### Issue 1: AppShell.tsx - taskScheduler import without error handling
**File**: `/Users/mk/Downloads/nomads/frontend/components/AppShell.tsx:274-277`
**Severity**: MEDIUM
**Problem**:
```typescript
import('../utils/taskScheduler').then(({ startScheduler, stopScheduler }) => {
  startScheduler().catch((e: Error) => console.warn('Failed to start scheduler:', e));
  return () => stopScheduler();
}).catch(() => {});  // ← Silent catch discards error
```
**Issues**:
- Silent failure on module import (no logging)
- No indication if `taskScheduler` module doesn't exist
- Return statement in `.then()` is lost (return value ignored)

**Fix**: Add logging and provide fallback
```typescript
import('../utils/taskScheduler').then(({ startScheduler, stopScheduler }) => {
  startScheduler().catch((e: Error) => console.warn('Failed to start scheduler:', e));
  return () => stopScheduler();
}).catch((err) => {
  console.warn('[AppShell] taskScheduler module not available:', err instanceof Error ? err.message : String(err));
});
```

---

### Issue 2: cli.ts - webServer import without catch
**File**: `/Users/mk/Downloads/nomads/frontend/cli.ts:492-493`
**Severity**: HIGH
**Problem**:
```typescript
const wsMode = args.includes('--ws');
if (wsMode) {
  const { startWebSocketServer } = await import('./utils/webServer');  // ← No catch!
  startWebSocketServer();
}
```
**Issues**:
- No try-catch around import
- If `webServer.ts` doesn't exist, entire CLI crashes
- No fallback for missing module
- Type assertion missing (destructuring will fail if export missing)

**Fix**: Add try-catch and fallback
```typescript
if (wsMode) {
  try {
    const { startWebSocketServer } = await import('./utils/webServer');
    startWebSocketServer();
  } catch (err) {
    console.error('[CLI] WebSocket server module not available:', err instanceof Error ? err.message : String(err));
  }
}
```

---

### Issue 3: AgentPanel.tsx - remoteDockerLauncher import missing error logging
**File**: `/Users/mk/Downloads/nomads/frontend/components/AgentPanel.tsx:1900-1904`
**Severity**: MEDIUM
**Problem**:
```typescript
import('../utils/remoteDockerLauncher').then((mod) => {
  mod.autoLaunchDockerIfNeeded().catch((err) => {
    console.error('Auto-launch Docker error:', err);
  });
});
// ← Missing .catch() on import promise!
```
**Issues**:
- No error handling if module import fails
- If file doesn't exist, error is silently swallowed
- Function call assumes successful import

**Fix**: Add catch block
```typescript
import('../utils/remoteDockerLauncher').then((mod) => {
  mod.autoLaunchDockerIfNeeded().catch((err) => {
    console.error('Auto-launch Docker error:', err);
  });
}).catch((err) => {
  console.debug('[AgentPanel] Docker launcher not available:', err instanceof Error ? err.message : String(err));
});
```

---

### Issue 4: html2canvas - Optional dependency without proper fallback
**Files**:
- `/Users/mk/Downloads/nomads/frontend/components/ComputerDesktop.tsx:446-452`
- `/Users/mk/Downloads/nomads/frontend/components/DataViz.tsx:644-660`
- `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/visionAgent.ts:231-252`

**Severity**: MEDIUM
**Problem**:
```typescript
// ComputerDesktop.tsx
try {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(desktopRef.current, { ... });
  const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  if (b64) desktopBus.emit({ type: 'computer_screenshot', screenshot: b64 });
} catch { /* non-critical */ }  // ← Silently drops errors
```

**Issues**:
- Silent error swallowing (users don't know screenshots failed)
- No indicator that module is optional
- No feature detection or degradation
- Three separate import locations without shared handling

**Fix**: Centralize with feature detection
```typescript
// utils/html2canvasLoader.ts
let _html2canvas: typeof import('html2canvas').default | null = null;

export async function loadHtml2Canvas(): Promise<typeof import('html2canvas').default | null> {
  if (_html2canvas !== null) return _html2canvas; // already loaded
  try {
    const mod = await import('html2canvas');
    _html2canvas = mod.default;
    console.debug('[html2canvas] Loaded successfully');
    return _html2canvas;
  } catch (err) {
    console.warn('[html2canvas] Failed to load (screenshots disabled):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Usage in ComputerDesktop.tsx
const html2canvas = await loadHtml2Canvas();
if (!html2canvas) {
  console.warn('[ComputerDesktop] Screenshots unavailable - html2canvas not loaded');
  return;
}
```

---

### Issue 5: neuroMemory - Optional module without feature check
**File**: `/Users/mk/Downloads/nomads/frontend/utils/taskReflection.ts:103-111`
**Severity**: LOW
**Problem**:
```typescript
if (gradeScore <= 2 && reflection.improvements.length > 0) {
  try {
    const { neuroMemory } = await import('./neuroMemory');
    if (neuroMemory.ready) {
      await neuroMemory.remember(...);
    }
  } catch { /* neuroMemory not available — silent */ }
}
```

**Issues**:
- Silent failure doesn't log which memory operations were skipped
- No indication if module exists or is disabled
- Could hide bugs in memory system

**Fix**: Add logging
```typescript
if (gradeScore <= 2 && reflection.improvements.length > 0) {
  try {
    const { neuroMemory } = await import('./neuroMemory');
    if (neuroMemory.ready) {
      await neuroMemory.remember(...);
    } else {
      console.debug('[taskReflection] neuroMemory not ready, skipping memory');
    }
  } catch (err) {
    console.debug('[taskReflection] neuroMemory not available:', err instanceof Error ? err.message : String(err));
  }
}
```

---

### Issue 6: researchAgents.ts - Subagent imports without individual error handling
**File**: `/Users/mk/Downloads/nomads/frontend/utils/researchAgents.ts:893, 1067-1068, 1443-1444`
**Severity**: MEDIUM
**Problem**:
```typescript
const { createSubagentManager } = await import('./subagentManager');  // line 893
// No try-catch — if module doesn't exist, research pipeline crashes

const { visualScoutAgent } = await import('./visualScoutAgent');  // line 1067
const { visualProgressStore } = await import('./visualProgressStore');  // line 1068
// No try-catch — if either missing, research fails
```

**Issues**:
- Critical imports for research pipeline have no error handling
- If subagent system fails, entire research phase aborts
- No graceful degradation

**Fix**: Wrap with error handling and fallback
```typescript
let subMgr: ReturnType<typeof createSubagentManager> | null = null;
try {
  const { createSubagentManager } = await import('./subagentManager');
  subMgr = createSubagentManager();
} catch (err) {
  console.error('[Research] Subagent system unavailable, falling back to direct research:', err);
  // Fall back to direct researcher agent instead of subagents
  useDirectResearch = true;
}

if (subMgr) {
  // Use subagents
  const subagentPromises = researchTopics.map(...);
} else {
  // Fall back to direct parallel researchers
  const parallelPromises = researchTopics.map(topic =>
    orchestrateResearch(topic, ...)
  );
}
```

---

### Issue 7: sessionFileSystem import without error message
**File**: `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/executorAgent.ts:1116`
**Severity**: MEDIUM
**Problem**:
```typescript
try {
  const { vfs } = await import('../sessionFileSystem');
  switch (action.type) {
    case 'file_create': {
      // ... uses vfs directly
      vfs.createFile(filePath, fileName, fileContent, mimeMap[ext] || 'text/plain');
```

**Issues**:
- If `sessionFileSystem` doesn't exist, entire file operations fail
- No graceful fallback for file operations
- Error swallowed without logging

**Fix**: Add logging and graceful handling
```typescript
let vfs: typeof import('../sessionFileSystem').vfs | null = null;
try {
  const mod = await import('../sessionFileSystem');
  vfs = mod.vfs;
} catch (err) {
  console.warn('[Executor] Session file system not available:', err instanceof Error ? err.message : String(err));
}

if (!vfs) {
  return { success: false, output: 'File operations not available in this environment' };
}
```

---

### Issue 8: Wayfarer screenshotService import with adequate fallback
**File**: `/Users/mk/Downloads/nomads/frontend/utils/agentEngine.ts:1617-1626`
**Severity**: LOW (well-handled)
**Status**: GOOD - Has proper fallback
```typescript
try {
  const { screenshotService } = await import('./wayfayer');
  const result = await screenshotService.screenshot(imageSrc);
  base64 = result.image_base64;
} catch {
  // Direct fetch fallback ✓ Good!
  const imgResp = await fetch(imageSrc, { signal });
  if (!imgResp.ok) return { success: false, output: `Cannot fetch image: ${imgResp.status}` };
  const buf = await imgResp.arrayBuffer();
  base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
}
```

---

### Issue 9: Node.js fs/path imports - Conditional require pattern
**Files**:
- `/Users/mk/Downloads/nomads/frontend/utils/promptLoader.ts:18-31`
- `/Users/mk/Downloads/nomads/frontend/utils/applyPatch.ts:31-42`

**Severity**: LOW (well-handled)
**Status**: GOOD - Proper environment detection
```typescript
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;

// Only load Node.js modules in Node.js environment
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
  try {
    fs = require('fs');
    path = require('path');
  } catch (e) {
    // Modules not available in this environment
  }
}
```
**Good practices**:
- Type annotations with null union
- Environment detection before require
- Silent fail with fallback to null
- Guard checks before usage

---

### Issue 10: taskQueue.ts - Fire-and-forget imports with catch
**File**: `/Users/mk/Downloads/nomads/frontend/utils/taskQueue.ts:183-184`
**Severity**: LOW (acceptable for fire-and-forget)
**Status**: ACCEPTABLE
```typescript
import('./taskStore').then(({ saveTaskLog }) => saveTaskLog(log)).catch(() => {});
import('./taskReflection').then(({ gradeTask }) => gradeTask(log)).catch(() => {});
```
**Notes**:
- These are non-critical async operations
- Silent catch is acceptable for fire-and-forget patterns
- Could benefit from debug logging though

**Improvement**:
```typescript
import('./taskStore').then(({ saveTaskLog }) => saveTaskLog(log)).catch(() => {
  console.debug('[taskQueue] Task log save skipped (taskStore unavailable)');
});
```

---

## Summary of All Dynamic Imports

| File | Line | Import | Error Handling | Status |
|------|------|--------|-----------------|--------|
| cli.ts | 492 | ./utils/webServer | ❌ None | **CRITICAL** |
| AppShell.tsx | 274 | ../utils/taskScheduler | ⚠️ Silent catch | **MEDIUM** |
| AgentPanel.tsx | 1900 | ../utils/remoteDockerLauncher | ❌ None | **MEDIUM** |
| ComputerDesktop.tsx | 446 | html2canvas | ✓ Try-catch | ⚠️ Silent fail |
| DataViz.tsx | 644 | html2canvas | ✓ Try-catch | ⚠️ Silent fail |
| visionAgent.ts | 231 | html2canvas | ✓ Try-catch | ✓ Good |
| taskReflection.ts | 103 | ./neuroMemory | ✓ Try-catch | ⚠️ Silent |
| researchAgents.ts | 893 | ./subagentManager | ❌ None | **CRITICAL** |
| researchAgents.ts | 1067 | ./visualScoutAgent | ❌ None | **CRITICAL** |
| researchAgents.ts | 1068 | ./visualProgressStore | ❌ None | **CRITICAL** |
| researchAgents.ts | 1443 | ./visualScoutAgent | ❌ None | **CRITICAL** |
| researchAgents.ts | 1444 | ./visualProgressStore | ❌ None | **CRITICAL** |
| executorAgent.ts | 1116 | ../sessionFileSystem | ❌ None | **CRITICAL** |
| orchestrator.ts | 177 | ./visionAgent | ✓ Try-catch | ✓ Good |
| orchestrator.ts | 559 | ./visionAgent | ✓ Try-catch | ✓ Good |
| orchestrator.ts | 619 | ./visionAgent | ✓ Try-catch | ✓ Good |
| agentEngine.ts | 1259 | fs/promises | ✓ Try-catch | ✓ Good |
| agentEngine.ts | 1260 | path | ✓ Try-catch | ✓ Good |
| agentEngine.ts | 1617 | ./wayfayer | ✓ Try-catch | ✓ Good |
| agentEngine.ts | 2335 | child_process | ✓ Try-catch | ✓ Good |
| agentEngine.ts | 2336 | util | ✓ Try-catch | ✓ Good |
| taskQueue.ts | 183 | ./taskStore | ✓ Try-catch | ✓ Acceptable |
| taskQueue.ts | 184 | ./taskReflection | ✓ Try-catch | ✓ Acceptable |
| promptLoader.ts | 25-27 | fs/path/url | ✓ Conditional require | ✓ Good |
| applyPatch.ts | 37-38 | fs/path | ✓ Conditional require | ✓ Good |

---

## Recommended Fixes (Priority Order)

### CRITICAL (Fix immediately)
1. **cli.ts:492** - Add try-catch around webServer import
2. **researchAgents.ts:893** - Add try-catch around subagentManager import
3. **researchAgents.ts:1067-1068** - Add try-catch around visual scout imports
4. **executorAgent.ts:1116** - Add try-catch around sessionFileSystem import

### HIGH
5. **AppShell.tsx:274** - Add error logging instead of silent catch
6. **AgentPanel.tsx:1900** - Add catch block for import failure
7. **Centralize html2canvas loading** - Create html2canvasLoader.ts with singleton pattern

### MEDIUM
8. **taskReflection.ts:103** - Add debug logging for silent failures
9. **taskQueue.ts:183-184** - Add debug logging for fire-and-forget operations

---

## Best Practices Applied in Codebase

✓ Environment detection before conditional requires (promptLoader.ts, applyPatch.ts)
✓ Type annotations for optional modules (fs: typeof import('fs') | null)
✓ Guard checks before module usage
✓ Proper try-catch in most locations
✓ Graceful fallbacks for optional dependencies

---

## Recommended Patterns for Future Development

### Pattern 1: Conditional Module Loading
```typescript
// Good: with feature detection
let moduleInstance: Type | null = null;
try {
  const mod = await import('./module');
  moduleInstance = mod.default;
} catch (err) {
  console.warn('[Feature] Module unavailable:', err instanceof Error ? err.message : String(err));
}

if (!moduleInstance) {
  // Handle gracefully or skip feature
  return fallbackValue;
}
```

### Pattern 2: Fire-and-Forget with Logging
```typescript
// Instead of: import('./module').then(...).catch(() => {})
import('./module').then(...).catch((err) => {
  console.debug('[Feature] Async operation skipped:', err instanceof Error ? err.message : String(err));
});
```

### Pattern 3: Singleton Loader
```typescript
// utils/moduleLoader.ts
let _module: Module | null = undefined; // undefined = not loaded yet, null = failed

export async function getModule(): Promise<Module | null> {
  if (_module !== undefined) return _module; // return cached result
  try {
    const mod = await import('./expensive-module');
    _module = mod.default;
    return _module;
  } catch (err) {
    _module = null; // cache failure
    console.warn('[Module] Failed to load:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
```

---

## Testing Recommendations

1. **Missing module scenario** - Delete a module temporarily and verify graceful handling
2. **Module loading timing** - Test when modules load at different lifecycle points
3. **Error scenarios** - Inject failures in imports to verify error handling
4. **Fallback paths** - Verify fallback implementations work correctly
5. **TypeScript compilation** - Run `tsc --noEmit` to catch type issues

---

## Notes

- No circular dependency risks detected in dynamic imports
- All imports occur at appropriate lifecycle points (no premature initialization)
- Lazy loading is minimal (only 22 dynamic imports found)
- Most critical imports happen after environment initialization
- Bundle size impact is minimal from these imports

