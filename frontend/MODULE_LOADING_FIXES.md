# Module Loading Bug Fixes

This document provides step-by-step fixes for all critical module loading issues identified in MODULE_LOADING_AUDIT.md

---

## Fix 1: cli.ts - WebSocket Server Import (CRITICAL)

**File**: `frontend/cli.ts` (lines 490-494)

**Current Code**:
```typescript
const wsMode = args.includes('--ws');
if (wsMode) {
  const { startWebSocketServer } = await import('./utils/webServer');
  startWebSocketServer();
}
```

**Problem**: No error handling - if module doesn't exist, entire CLI crashes

**Fixed Code**:
```typescript
const wsMode = args.includes('--ws');
if (wsMode) {
  try {
    const { startWebSocketServer } = await import('./utils/webServer');
    startWebSocketServer();
    if (!isBatchMode) {
      process.stdout.write('  [WebSocket] Server started on port 8890\n');
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  [Error] WebSocket server unavailable: ${errorMsg}\n`);
    process.stderr.write('  Run without --ws flag to continue\n');
  }
}
```

---

## Fix 2: AppShell.tsx - Task Scheduler Import (MEDIUM)

**File**: `frontend/components/AppShell.tsx` (lines 273-278)

**Current Code**:
```typescript
import('../utils/taskScheduler').then(({ startScheduler, stopScheduler }) => {
  startScheduler().catch((e: Error) => console.warn('Failed to start scheduler:', e));
  return () => stopScheduler();
}).catch(() => {});
```

**Problem**: Silent catch, no logging if module fails to load

**Fixed Code**:
```typescript
import('../utils/taskScheduler').then(({ startScheduler, stopScheduler }) => {
  startScheduler().catch((e: Error) => console.warn('Failed to start scheduler:', e));
  return () => stopScheduler();
}).catch((err) => {
  console.warn('[AppShell] Task scheduler not available:', err instanceof Error ? err.message : String(err));
  // Scheduler is non-critical, continue without it
});
```

---

## Fix 3: AgentPanel.tsx - Docker Launcher Import (MEDIUM)

**File**: `frontend/components/AgentPanel.tsx` (lines 1897-1906)

**Current Code**:
```typescript
useEffect(() => {
  const shouldAutoLaunch = getItemWithTracking('autoLaunchDocker') === 'true';
  if (shouldAutoLaunch) {
    import('../utils/remoteDockerLauncher').then((mod) => {
      mod.autoLaunchDockerIfNeeded().catch((err) => {
        console.error('Auto-launch Docker error:', err);
      });
    });
  }
}, []);
```

**Problem**: No catch block for import failure

**Fixed Code**:
```typescript
useEffect(() => {
  const shouldAutoLaunch = getItemWithTracking('autoLaunchDocker') === 'true';
  if (shouldAutoLaunch) {
    import('../utils/remoteDockerLauncher').then((mod) => {
      mod.autoLaunchDockerIfNeeded().catch((err) => {
        console.error('Auto-launch Docker error:', err);
      });
    }).catch((err) => {
      console.debug('[AgentPanel] Docker launcher not available:', err instanceof Error ? err.message : String(err));
      // Docker launcher is optional
    });
  }
}, []);
```

---

## Fix 4: researchAgents.ts - Subagent Manager Import (CRITICAL)

**File**: `frontend/utils/researchAgents.ts` (lines 888-895)

**Current Code**:
```typescript
if (limits.useSubagents) {
  const { createSubagentManager } = await import('./subagentManager');
  const subMgr = createSubagentManager();

  onProgressUpdate?.(`  [Subagents] Spawning ${researchTopics.length} researcher subagents...\n`);
  // ... continues with subMgr
}
```

**Problem**: No try-catch - if subagentManager doesn't exist, entire research pipeline fails

**Fixed Code**:
```typescript
if (limits.useSubagents) {
  let subMgr: ReturnType<typeof createSubagentManager> | null = null;

  try {
    const { createSubagentManager } = await import('./subagentManager');
    subMgr = createSubagentManager();
    onProgressUpdate?.(`  [Subagents] Spawning ${researchTopics.length} researcher subagents...\n`);
  } catch (err) {
    console.error('[Research] Subagent manager failed to load, falling back to direct research:',
      err instanceof Error ? err.message : String(err));
    // Will fall through to non-subagent path below
    subMgr = null;
  }

  if (subMgr) {
    // ... existing subagent logic
    const subagentPromises = researchTopics.map((topic, idx) => {
      // ... existing code
    });
  } else {
    // Fallback: use direct parallel researchers instead
    onProgressUpdate?.(`  [Researchers] Launching ${researchTopics.length} parallel researchers (direct mode)...\n`);
    const directPromises = researchTopics.map((topic, idx) => {
      // Reuse existing orchestrator logic without subagents
      return orchestrateResearchIteration(topic, idx, knowledge, state, limits, signal, onProgressUpdate);
    });
    // ... process results from direct researchers
  }
}
```

---

## Fix 5: researchAgents.ts - Visual Scout Imports (CRITICAL)

**File**: `frontend/utils/researchAgents.ts` (lines 1064-1071 and 1440-1448)

**Current Code (Line 1067-1068)**:
```typescript
try {
  const { visualScoutAgent } = await import('./visualScoutAgent');
  const { visualProgressStore } = await import('./visualProgressStore');
  const cappedUrls = visualScoutUrls.slice(0, cappedCount);
  const visualFindings = await visualScoutAgent.analyzeCompetitorVisuals(
    cappedUrls,
    state.campaign,
    signal,
    onProgressUpdate
  );
```

**Problem**: No try-catch for imports

**Fixed Code**:
```typescript
let visualFindings: VisualFindings | null = null;

try {
  const { visualScoutAgent } = await import('./visualScoutAgent');
  const { visualProgressStore } = await import('./visualProgressStore');

  if (!visualScoutAgent || typeof visualScoutAgent.analyzeCompetitorVisuals !== 'function') {
    throw new Error('visualScoutAgent.analyzeCompetitorVisuals is not available');
  }

  const cappedUrls = visualScoutUrls.slice(0, cappedCount);
  onProgressUpdate?.(`\n[Visual Scout] Analyzing ${cappedUrls.length} competitor URLs...\n`);

  visualFindings = await visualScoutAgent.analyzeCompetitorVisuals(
    cappedUrls,
    state.campaign,
    signal,
    onProgressUpdate
  );
} catch (err) {
  console.warn('[Research] Visual scout not available, skipping visual analysis:',
    err instanceof Error ? err.message : String(err));
  visualFindings = null;
  // Continue with text-only research
}

if (visualFindings && visualBudgetRemaining > 0) {
  // Process visual findings
  currentCoverageState = { ...currentCoverageState, visualFindings };
  visualBudgetRemaining--;
} else if (!visualFindings && visualScoutUrls.length > 0) {
  onProgressUpdate?.(`[Coverage] Visual scout unavailable, text-based analysis only\n`);
}
```

**Apply the same pattern at line 1443-1444**:
```typescript
try {
  const { visualScoutAgent } = await import('./visualScoutAgent');
  const { visualProgressStore } = await import('./visualProgressStore');

  if (!visualScoutAgent?.analyzeCompetitorVisuals) {
    throw new Error('visualScoutAgent not properly loaded');
  }

  const visualFindings = await visualScoutAgent.analyzeCompetitorVisuals(
    dedupedUrls.slice(0, reflCappedCount),
    state.campaign,
    signal,
    onProgressUpdate
  );
  // ... process results
} catch (err) {
  console.warn('[Reflection] Visual analysis unavailable:',
    err instanceof Error ? err.message : String(err));
  // Continue with text-based gaps
}
```

---

## Fix 6: executorAgent.ts - Session File System Import (CRITICAL)

**File**: `frontend/utils/computerAgent/executorAgent.ts` (lines 1113-1150)

**Current Code**:
```typescript
const isFileAction = action.type.startsWith('file_');
if (isFileAction) {
  try {
    const { vfs } = await import('../sessionFileSystem');
    switch (action.type) {
      case 'file_create': {
        const filePath = action.path || '/nomad/shared';
        const fileName = action.name || 'untitled.txt';
        const fileContent = action.content || '';
        vfs.createFile(filePath, fileName, fileContent, ...);
```

**Problem**: No error handling for import, uses vfs without null check

**Fixed Code**:
```typescript
const isFileAction = action.type.startsWith('file_');
if (isFileAction) {
  let vfs: typeof import('../sessionFileSystem').vfs | null = null;

  try {
    const mod = await import('../sessionFileSystem');
    vfs = mod.vfs;
  } catch (err) {
    console.warn('[Executor] Session file system unavailable:',
      err instanceof Error ? err.message : String(err));
    findings.push('File operations not available in this environment');
    return { success: false, findings };
  }

  if (!vfs) {
    findings.push('Session file system not initialized');
    return { success: false, findings };
  }

  try {
    switch (action.type) {
      case 'file_create': {
        const filePath = action.path || '/nomad/shared';
        const fileName = action.name || 'untitled.txt';
        const fileContent = action.content || '';
        const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
        const mimeMap: Record<string, string> = {
          txt: 'text/plain', md: 'text/markdown', json: 'application/json',
          csv: 'text/csv', html: 'text/html', css: 'text/css',
          js: 'text/javascript', ts: 'text/typescript',
        };
        vfs.createFile(filePath, fileName, fileContent, mimeMap[ext] || 'text/plain');
        onStatus?.(`[Executor] Created file: ${fileName} in ${filePath}`);
        findings.push(`Created file: ${filePath}/${fileName} (${fileContent.length} chars)`);
        break;
      }
      // ... rest of switch
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Executor] File operation failed:', errorMsg);
    findings.push(`File operation error: ${errorMsg}`);
  }
}
```

---

## Fix 7: ComputerDesktop.tsx - html2canvas Import (MEDIUM)

**File**: `frontend/components/ComputerDesktop.tsx` (lines 442-456)

**Current Code**:
```typescript
useEffect(() => {
  const timer = setTimeout(async () => {
    if (!desktopRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(desktopRef.current, { ... });
      const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      if (b64) desktopBus.emit({ type: 'computer_screenshot', screenshot: b64 });
    } catch { /* non-critical */ }
  }, 500);
  return () => clearTimeout(timer);
}, []);
```

**Problem**: Silent failure, no logging

**Fixed Code**:
```typescript
useEffect(() => {
  const timer = setTimeout(async () => {
    if (!desktopRef.current) return;
    try {
      const { captureElementToBase64 } = await import('../utils/html2canvasLoader');
      const b64 = await captureElementToBase64(desktopRef.current, 0.6);
      if (b64) {
        desktopBus.emit({ type: 'computer_screenshot', screenshot: b64 });
      } else {
        console.debug('[ComputerDesktop] Screenshot capture returned empty');
      }
    } catch (err) {
      console.debug('[ComputerDesktop] Screenshot unavailable:',
        err instanceof Error ? err.message : String(err));
    }
  }, 500);
  return () => clearTimeout(timer);
}, []);
```

---

## Fix 8: DataViz.tsx - html2canvas Import (MEDIUM)

**File**: `frontend/components/DataViz.tsx` (lines 638-661)

**Current Code**:
```typescript
async function downloadChartPNG(spec: ChartSpec, containerRef: HTMLDivElement | null) {
  if (!containerRef) return;

  try {
    const html2canvas = (window as any).html2canvas || (await import('html2canvas').then(m => m.default));
    const canvas = await html2canvas(containerRef, { ... });
    // ...
  } catch (err) {
    console.warn('PNG export unavailable, ensure html2canvas is installed', err);
  }
}
```

**Problem**: Silent failure with misleading error message

**Fixed Code**:
```typescript
async function downloadChartPNG(spec: ChartSpec, containerRef: HTMLDivElement | null) {
  if (!containerRef) return;

  try {
    const { loadHtml2Canvas } = await import('../utils/html2canvasLoader');
    const html2canvas = await loadHtml2Canvas();

    if (!html2canvas) {
      console.warn('[DataViz] PNG export unavailable - html2canvas not loaded');
      // Optionally show user notification
      return;
    }

    const canvas = await html2canvas(containerRef, {
      backgroundColor: '#ffffff',
      scale: 2,
      allowTaint: true,
      useCORS: true,
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${(spec.title || 'chart').replace(/\s+/g, '_')}.png`;
    link.click();
  } catch (err) {
    console.error('[DataViz] PNG export failed:',
      err instanceof Error ? err.message : String(err));
  }
}
```

---

## Fix 9: visionAgent.ts - html2canvas Import (GOOD - Minor Improvement)

**File**: `frontend/utils/computerAgent/visionAgent.ts` (lines 225-253)

**Current Code** (Already has try-catch - good):
```typescript
export async function captureDesktop(desktopEl: HTMLElement): Promise<string> {
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(desktopEl, { ... });
    return canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
  } catch (err) {
    console.warn('[captureDesktop] html2canvas failed:', err instanceof Error ? err.message : String(err));
    return '';
  }
}
```

**Suggestion - Use Centralized Loader**:
```typescript
export async function captureDesktop(desktopEl: HTMLElement): Promise<string> {
  try {
    const { captureElementToBase64 } = await import('../html2canvasLoader');
    const base64 = await captureElementToBase64(desktopEl, 0.72);
    return base64;
  } catch (err) {
    console.warn('[captureDesktop] Desktop capture failed:',
      err instanceof Error ? err.message : String(err));
    return '';
  }
}
```

---

## Fix 10: taskReflection.ts - neuroMemory Import (LOW)

**File**: `frontend/utils/taskReflection.ts` (lines 101-112)

**Current Code** (Already acceptable):
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

**Improvement - Add Logging**:
```typescript
if (gradeScore <= 2 && reflection.improvements.length > 0) {
  try {
    const { neuroMemory } = await import('./neuroMemory');
    if (neuroMemory?.ready) {
      await neuroMemory.remember(
        `Task "${taskLog.name}" grade ${reflection.overallGrade}: ${reflection.improvements.join('; ')}`,
        'principle',
        'task-reflection',
      );
    } else {
      console.debug('[taskReflection] neuroMemory not ready, skipping memory');
    }
  } catch (err) {
    console.debug('[taskReflection] neuroMemory not available:',
      err instanceof Error ? err.message : String(err));
  }
}
```

---

## Implementation Checklist

- [ ] **Fix 1**: cli.ts - Add try-catch for webServer import
- [ ] **Fix 2**: AppShell.tsx - Add logging to taskScheduler catch block
- [ ] **Fix 3**: AgentPanel.tsx - Add catch block for remoteDockerLauncher import
- [ ] **Fix 4**: researchAgents.ts - Add error handling for subagentManager with fallback
- [ ] **Fix 5**: researchAgents.ts - Add error handling for visual scout imports (2 locations)
- [ ] **Fix 6**: executorAgent.ts - Add try-catch and null checks for vfs import
- [ ] **Fix 7**: ComputerDesktop.tsx - Use centralized html2canvasLoader
- [ ] **Fix 8**: DataViz.tsx - Use centralized html2canvasLoader
- [ ] **Fix 9**: visionAgent.ts - Consider using centralized html2canvasLoader
- [ ] **Fix 10**: taskReflection.ts - Add debug logging

---

## Testing After Fixes

1. **Test missing modules**: Temporarily rename modules to verify fallback behavior
2. **Test error messages**: Verify all error messages appear in console/logs
3. **Test graceful degradation**: Verify features degrade gracefully without crashing
4. **TypeScript check**: Run `npx tsc --noEmit` to verify all types are correct
5. **Build test**: Run `npm run build` to ensure no bundle errors

