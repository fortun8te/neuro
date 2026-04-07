# CRITICAL FIXES CHECKLIST - Module Loading Bugs

**Do these 4 fixes first to prevent crashes:**

---

## Fix 1: cli.ts - Line 492 (WebSocket Server)

**Status**: ❌ NOT FIXED
**Severity**: 🔴 CRITICAL - CLI crashes with `--ws` flag
**File**: `frontend/cli.ts`

### Problem
```typescript
// BROKEN: No try-catch
const { startWebSocketServer } = await import('./utils/webServer');
startWebSocketServer();
```

### Solution
```typescript
// FIXED: With error handling
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
```

### Test
```bash
npm run cli -- --ws
# Should show error message, not crash
```

**Completion**: [ ] Not started  [ ] In progress  [ ] Done

---

## Fix 2: researchAgents.ts - Lines 893 (Subagent Manager)

**Status**: ❌ NOT FIXED
**Severity**: 🔴 CRITICAL - Research pipeline crashes
**File**: `frontend/utils/researchAgents.ts`

### Problem
```typescript
// BROKEN: No try-catch for critical import
const { createSubagentManager } = await import('./subagentManager');
const subMgr = createSubagentManager();
// ... uses subMgr directly, crashes if import fails
```

### Solution
```typescript
// FIXED: With error handling and fallback
let subMgr: ReturnType<typeof createSubagentManager> | null = null;

try {
  const { createSubagentManager } = await import('./subagentManager');
  subMgr = createSubagentManager();
  onProgressUpdate?.(`  [Subagents] Spawning ${researchTopics.length} researcher subagents...\n`);
} catch (err) {
  console.error('[Research] Subagent manager failed to load, falling back to direct research:',
    err instanceof Error ? err.message : String(err));
  subMgr = null;
}

if (subMgr) {
  // Use subagents (existing code)
  const subagentPromises = researchTopics.map((topic, idx) => {
    // ... existing subagent logic
  });
} else {
  // Fallback: Use direct researchers instead
  onProgressUpdate?.(`  [Researchers] Launching ${researchTopics.length} parallel researchers (direct mode)...\n`);
  // ... fallback logic
}
```

### Test
```bash
# Temporarily rename subagentManager.ts
mv frontend/utils/subagentManager.ts frontend/utils/subagentManager.ts.bak
# Run research - should gracefully degrade to direct researchers
# Restore file
mv frontend/utils/subagentManager.ts.bak frontend/utils/subagentManager.ts
```

**Completion**: [ ] Not started  [ ] In progress  [ ] Done

---

## Fix 3: researchAgents.ts - Lines 1067-1068 & 1443-1444 (Visual Scout)

**Status**: ❌ NOT FIXED
**Severity**: 🔴 CRITICAL - Visual research crashes
**File**: `frontend/utils/researchAgents.ts`

### Problem
```typescript
// BROKEN: No try-catch for these imports
const { visualScoutAgent } = await import('./visualScoutAgent');
const { visualProgressStore } = await import('./visualProgressStore');
const visualFindings = await visualScoutAgent.analyzeCompetitorVisuals(...);
```

### Solution
**Location 1 (Line 1067-1068)**:
```typescript
let visualFindings: VisualFindings | null = null;

try {
  const { visualScoutAgent } = await import('./visualScoutAgent');
  const { visualProgressStore } = await import('./visualProgressStore');

  if (!visualScoutAgent?.analyzeCompetitorVisuals) {
    throw new Error('visualScoutAgent not properly loaded');
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
}

if (visualFindings) {
  // Process visual findings
  currentCoverageState = { ...currentCoverageState, visualFindings };
  visualBudgetRemaining--;
} else if (visualScoutUrls.length > 0) {
  onProgressUpdate?.(`[Coverage] Visual scout unavailable, text-based analysis only\n`);
}
```

**Location 2 (Line 1443-1444)** - Apply same pattern:
```typescript
try {
  const { visualScoutAgent } = await import('./visualScoutAgent');
  const { visualProgressStore } = await import('./visualProgressStore');

  if (!visualScoutAgent?.analyzeCompetitorVisuals) {
    throw new Error('visualScoutAgent not properly loaded');
  }

  const visualFindings = await visualScoutAgent.analyzeCompetitorVisuals(...);
  // ... process results
} catch (err) {
  console.warn('[Reflection] Visual analysis unavailable:',
    err instanceof Error ? err.message : String(err));
}
```

### Test
```bash
# Temporarily rename visual modules
mv frontend/utils/visualScoutAgent.ts frontend/utils/visualScoutAgent.ts.bak
# Run research - should continue with text-only analysis
# Restore file
mv frontend/utils/visualScoutAgent.ts.bak frontend/utils/visualScoutAgent.ts
```

**Completion**: [ ] Not started  [ ] In progress  [ ] Done

---

## Fix 4: executorAgent.ts - Line 1116 (Session File System)

**Status**: ❌ NOT FIXED
**Severity**: 🔴 CRITICAL - File operations crash
**File**: `frontend/utils/computerAgent/executorAgent.ts`

### Problem
```typescript
// BROKEN: No catch block, vfs used without null check
try {
  const { vfs } = await import('../sessionFileSystem');
  switch (action.type) {
    case 'file_create': {
      vfs.createFile(...);  // Crashes if import failed
```

### Solution
```typescript
// FIXED: With error handling and null guards
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
```

### Test
```bash
# Temporarily rename sessionFileSystem.ts
mv frontend/utils/sessionFileSystem.ts frontend/utils/sessionFileSystem.ts.bak
# Run agent with file operations - should show error, not crash
# Restore file
mv frontend/utils/sessionFileSystem.ts.bak frontend/utils/sessionFileSystem.ts
```

**Completion**: [ ] Not started  [ ] In progress  [ ] Done

---

## Verification Steps (After All Fixes)

### Step 1: TypeScript Compilation
```bash
cd /Users/mk/Downloads/nomads
npx tsc --noEmit
# Should show 0 errors
```

### Step 2: Module Deletion Test
```bash
# Test each fix by temporarily removing modules

# Test Fix 1
mv frontend/utils/webServer.ts frontend/utils/webServer.ts.bak
npm run cli -- --ws 2>&1 | grep -E "(Error|available)"
mv frontend/utils/webServer.ts.bak frontend/utils/webServer.ts

# Test Fix 2
mv frontend/utils/subagentManager.ts frontend/utils/subagentManager.ts.bak
npm run cli "research collagen" 2>&1 | grep -E "(Subagent|direct|Error)"
mv frontend/utils/subagentManager.ts.bak frontend/utils/subagentManager.ts

# Test Fix 3
mv frontend/utils/visualScoutAgent.ts frontend/utils/visualScoutAgent.ts.bak
npm run cli "research cosmetics" 2>&1 | grep -E "(Visual|text-based|Error)"
mv frontend/utils/visualScoutAgent.ts.bak frontend/utils/visualScoutAgent.ts

# Test Fix 4
mv frontend/utils/sessionFileSystem.ts frontend/utils/sessionFileSystem.ts.bak
# Run agent with file create action - should show error
mv frontend/utils/sessionFileSystem.ts.bak frontend/utils/sessionFileSystem.ts
```

### Step 3: Error Message Verification
```bash
# Run each scenario and verify error messages appear
npm run cli -- --ws 2>&1 | head -20
npm run cli "test research" 2>&1 | head -20
npm run build 2>&1 | head -30
```

---

## Implementation Order

1. **Fix 1 first** (cli.ts) - Easiest, smallest change
2. **Fix 4 second** (executorAgent.ts) - Critical for file ops
3. **Fix 2 third** (researchAgents subagent) - Largest change
4. **Fix 3 fourth** (researchAgents visual) - 2 locations to fix

---

## Quick Status Summary

| Fix | File | Issue | Status |
|-----|------|-------|--------|
| 1 | cli.ts:492 | Missing try-catch | [ ] TODO |
| 2 | researchAgents.ts:893 | Missing try-catch | [ ] TODO |
| 3 | researchAgents.ts:1067,1443 | Missing try-catch | [ ] TODO |
| 4 | executorAgent.ts:1116 | Missing try-catch | [ ] TODO |

---

## After Completing All 4 Fixes

1. Commit with message: `fix: Add error handling for critical dynamic imports`
2. Run `npm run build` to verify build succeeds
3. Test each scenario from verification steps
4. Update this checklist to mark as complete

---

## Need Help?

See full details in:
- MODULE_LOADING_AUDIT.md - Complete analysis
- MODULE_LOADING_FIXES.md - All 10 fixes with examples
- CIRCULAR_DEPENDENCY_CHECK.md - Dependency verification

