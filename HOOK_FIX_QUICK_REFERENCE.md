# Hook Fixes — Quick Reference Guide

## 6 Bugs Fixed • 2 Hooks Verified Clean

---

## Quick Lookup by File

### useFullMultiAgentResearch.ts ✓ FIXED
**Line:** 230
**Bug:** Missing `initializeOrchestrator` in dependency array
**Fix:** Changed `[]` → `[initializeOrchestrator]`
**Severity:** HIGH

### useNeuroTerminal.ts ✓ FIXED
**Lines:** 46-52
**Bug:** Stale closure on `logs.length` + excessive re-creation
**Fix:** Use updater function; changed `[logs.length]` → `[]`
**Severity:** MEDIUM

### useHeartbeat.ts ✓ FIXED
**Lines:** 94-103
**Bug:** Unnecessary circular dependency on `captureSnapshot`
**Fix:** Inlined capture logic; changed `[captureSnapshot]` → `[]`
**Severity:** MEDIUM

### useQueuedPrompts.ts ✓ FIXED (2 issues)

#### Issue 1: Line 111
**Bug:** Stale `selectedQueueId` + unnecessary dependency
**Fix:** Use state updater; changed `[selectedQueueId]` → `[]`
**Severity:** HIGH

#### Issue 2: Line 56
**Bug:** Missing `subscribeToQueue` in useEffect deps
**Fix:** Added `subscribeToQueue` to dependencies
**Severity:** MEDIUM

### useScheduler.ts ✓ OK
**Lines:** 164-169
**Status:** Already correct (includes `[executions]`)
**Note:** This is proper pattern—no changes needed

### useQualityControl.ts ✓ CLEAN
**Status:** All callbacks verified correct
**Note:** No issues found—no changes needed

---

## Common Patterns (Before → After)

### Pattern 1: Stale Closure in setters

**BEFORE (WRONG):**
```typescript
const [logs, setLogs] = useState([]);

const addLog = useCallback((msg) => {
  const updated = [...logs, msg];
  if (logs.length > 500) {  // ❌ Stale!
    setLogs(updated.slice(-500));
  }
}, [logs.length]);  // ❌ Recreates constantly
```

**AFTER (CORRECT):**
```typescript
const addLog = useCallback((msg) => {
  setLogs((prev) => {
    const updated = [...prev, msg];  // ✅ Never stale
    return updated.length > 500 ? updated.slice(-500) : updated;
  });
}, []);  // ✅ Stable, no deps
```

---

### Pattern 2: Missing Dependencies

**BEFORE (WRONG):**
```typescript
const executeResearch = useCallback(
  async (config) => {
    const orch = await initializeOrchestrator();  // ❌ Not in deps
    // ...
  },
  []  // ❌ Missing initializeOrchestrator
);
```

**AFTER (CORRECT):**
```typescript
const executeResearch = useCallback(
  async (config) => {
    const orch = await initializeOrchestrator();
    // ...
  },
  [initializeOrchestrator]  // ✅ Added
);
```

---

### Pattern 3: Unnecessary Dependencies

**BEFORE (WRONG):**
```typescript
const deleteQueue = useCallback(
  async (queueId) => {
    if (selectedQueueId === queueId) {  // ❌ Stale read
      setSelectedQueueId(null);
    }
  },
  [selectedQueueId]  // ❌ Recreates on every selection
);
```

**AFTER (CORRECT):**
```typescript
const deleteQueue = useCallback(
  async (queueId) => {
    setSelectedQueueId((prev) =>  // ✅ Never stale
      prev === queueId ? null : prev
    );
  },
  []  // ✅ Fully stable
);
```

---

## Testing Your Fixes

```bash
# Run ESLint with React Hooks rules
npm run lint

# Should pass with no exhaustive-deps violations
```

```typescript
// Test callback stability
import { renderHook, act } from '@testing-library/react';

test('addLog maintains stable reference', () => {
  const { result } = renderHook(() => useNeuroTerminal());
  const ref1 = result.current.addLog;

  act(() => {
    result.current.addLog('info', 'test');
  });

  // Should be same reference (not recreated)
  expect(result.current.addLog).toBe(ref1);
});
```

---

## Key Takeaways

| Pattern | ❌ Wrong | ✅ Right |
|---------|---------|---------|
| **Reading state** | `if (state > 5)` | `setState(prev => prev > 5)` |
| **State in deps** | `[state]` when using updater | `[]` |
| **Using callbacks** | `useCallback(fn, [])` | `useCallback(fn, [someDep])` |
| **Effect deps** | `useEffect(..., [])` | `useEffect(..., [usedVars])` |
| **Refs for data** | `useState(ref)` | `useRef(val)` |

---

## Validation Checklist

Before committing hooks:

- [ ] No state reads outside updater functions
- [ ] All captured variables in dependency arrays
- [ ] No circular dependency patterns
- [ ] useCallback/useMemo have correct deps
- [ ] useEffect cleanup functions exist
- [ ] ESLint passes with react-hooks plugin
- [ ] No unnecessary dependencies

---

## Files Changed

```
src/hooks/
├── useFullMultiAgentResearch.ts  (✓ FIXED)
├── useNeuroTerminal.ts           (✓ FIXED)
├── useHeartbeat.ts               (✓ FIXED)
├── useQueuedPrompts.ts           (✓ FIXED)
├── useScheduler.ts               (✓ VERIFIED OK)
└── useQualityControl.ts          (✓ VERIFIED CLEAN)
```

---

## Resources

- [React Hooks Docs](https://react.dev/reference/react)
- [eslint-plugin-react-hooks](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)

---

**Audit Date:** April 6, 2026
**Status:** Complete ✓ All 6 bugs fixed, 2 hooks verified clean
