# UI & Feature Improvements - Implementation Guide

**Status:** ✅ Completed (5/14) | ⏳ In Progress | ⏰ Pending

## Completed ✅
1. [x] Fix all TypeScript errors (15 → 0)
2. [x] Remove Neuro Network modal
3. [x] Set Remote as default infrastructure mode
4. [x] Make week view default in Tasks calendar
5. [x] Remove long-term memory (cross-chat persistence)

---

## Next Priority Items (In Progress)

### 1. Task UI Centering Issues
**File:** `frontend/components/TasksPage.tsx` + `frontend/components/TaskPanel.tsx`

**Issue:** Tasks/chat not centered properly, layout misaligned

**Fix Strategy:**
```typescript
// In TaskPanel.tsx (line 254-264):
// Ensure wrapper has proper centering
// Current: position: 'fixed', right: 0
// Should verify max-width constraints and centering logic

// Check:
- Padding and margins symmetrical
- Max-width constraints applied
- Flex alignment correct (center, space-between vs space-around)
- Media queries for mobile responsive behavior
```

**Test:**
- Open Tasks panel
- Verify centered alignment on all screen sizes
- Check that content doesn't overflow

---

### 2. Research Depth & Crash Prevention
**Files:**
- `frontend/hooks/useOrchestratedResearch.ts` (main loop)
- `frontend/utils/modelConfig.ts` (presets)
- `frontend/utils/researchAgents.ts` (orchestrator logic)

**Issues:**
- Research doesn't do enough even when asked for deep research
- Sometimes does excessive research (runs too long)
- Crashes on extended research sessions

**Fix Strategy:**

#### A. Add Adaptive Stopping Logic (Priority: HIGH)
```typescript
// In useOrchestratedResearch.ts, add coverage-based early exit:

// After each research iteration, check:
const shouldStop =
  (currentCoverage >= limits.coverageThreshold) &&
  (iterationCount >= limits.minIterations) &&
  (coverageImprovement < 0.05); // Less than 5% new coverage in last 2 iterations

// This prevents:
// ✓ Running too many iterations when coverage is good
// ✓ Excessive research that never reaches threshold
// ✓ Infinite loops from low-quality data
```

#### B. Enforce Timeouts (Priority: HIGH)
```typescript
// In useOrchestratedResearch.ts:
const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
if (elapsedMinutes > limits.maxTimeMinutes * 1.1) {
  onProgress?.(`⚠ Research timeout (${limits.maxTimeMinutes}m limit exceeded)\n`);
  break; // Force exit current research phase
}

// Add AbortSignal checks at critical junctures:
if (signal?.aborted) {
  onProgress?.(`⏸ Research interrupted\n`);
  throw new DOMException('Aborted', 'AbortError');
}
```

#### C. Adjust Preset Minimums (Priority: MEDIUM)
```typescript
// In modelConfig.ts RESEARCH_PRESETS:
// Current minimums may be too aggressive

// Recommended changes:
quick:   minIterations: 4 → 3   (allow earlier exit if coverage good)
normal:  minIterations: 8 → 5
extended: minIterations: 12 → 8  (Extended should still be thorough but not rigid)
max:     minIterations: 25 → 20  (Max can stay aggressive but not excessive)

// Also add coverage early-exit bonus:
if (coverage >= 0.95 && iterationCount >= minIterations + 2) {
  exit early; // Don't force max iterations if coverage is exceptional
}
```

#### D. Add Compression Monitoring (Priority: MEDIUM)
```typescript
// Track compression failures that can crash research:
const compressionFailures = [];
researcher.onCompressionError = (error, url) => {
  compressionFailures.push({ url, error });
  if (compressionFailures.length > limit.maxCompressionFailures) {
    onProgress?.(`⚠ Too many compression failures, reducing page fetch rate\n`);
    maxResearchersPerIteration /= 2; // Back off parallelism
  }
}
```

**Test Plan:**
- [ ] Run Quick preset: should complete in ~15-20 min (not exceed 30m)
- [ ] Run Deep preset: should not run >2 hours even if told "really deep"
- [ ] Run on poor connection: should gracefully degrade, not crash
- [ ] Check coverage: should stop early if 95%+ coverage achieved
- [ ] Monitor console: no uncaught Promise rejections

---

### 3. Quick Menu Missing Items
**File:** `frontend/components/QuickMenu.tsx` (or wherever quick actions are)

**Current Items:** ? (Find which are present)

**Missing Items to Add:**
```typescript
const QUICK_MENU_ITEMS = [
  // ... existing items

  // Add these:
  { icon: 'Settings', label: 'Settings', action: 'openSettings' },
  { icon: 'Calendar', label: 'Tasks', action: 'openTasks' },
  { icon: 'History', label: 'Cycles', action: 'viewCycles' },
  { icon: 'Database', label: 'Memory', action: 'viewMemory' },
  // Tool icons (from tool use system):
  { icon: 'Search', label: 'Web Search', action: 'toolWeb' },
  { icon: 'Code', label: 'Code', action: 'toolCode' },
  { icon: 'FileText', label: 'Files', action: 'toolFiles' },
];
```

**Implementation:**
- Don't rewrite the component, just add to the items array
- Use tool icons from lucide-react where available
- Each item should dispatch a custom event or callback

---

### 4. Plan Mode Improvements
**File:** `frontend/components/ExecutionPlanModal.tsx` + `frontend/utils/agentEngine.ts`

**Current Issues:** Behavior is unpredictable/weird

**Fix Strategy:**
```typescript
// In agentEngine.ts, where plan mode is triggered:

// Add clear state transitions:
type PlanState = 'suggesting' | 'awaiting_approval' | 'executing' | 'complete' | 'error';

// Ensure:
1. Plan is always shown before execution (not sometimes skipped)
2. User approval is required before ANY execution
3. Progress updates during execution
4. Proper error recovery if plan fails mid-execution
5. Clear ability to modify plan before execution

// Test: Run any task → should ALWAYS see plan approval modal
```

---

### 5. Task Scheduling (Dependent Tasks)
**File:** `frontend/utils/taskScheduler.ts` + `frontend/components/TaskScheduleView.tsx`

**Feature:** Schedule task B to start when task A finishes

**Implementation:**
```typescript
// Add to ScheduledTask interface:
export interface ScheduledTask {
  // ... existing
  dependsOnTaskId?: string;  // Task that must complete first
  chainedFrom?: string;       // Task that triggered this one
}

// In taskScheduler.ts, when task completes:
async function onTaskComplete(taskId: string) {
  const chainedTasks = await db.getAll(STORE_NAME).filter(t => t.dependsOnTaskId === taskId);
  for (const chained of chainedTasks) {
    // Set new scheduledStart to NOW + small delay
    chained.scheduledStart = Date.now() + 30_000; // 30s after predecessor
    chained.status = 'pending';
    await db.put(STORE_NAME, chained);
  }
  window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));
}

// In TaskScheduleView.tsx, visualize chains:
// - Show arrow from completed task to dependent task
// - Highlight chain path when hovering
```

---

### 6. Settings Icons (Replace Emojis)
**Files:**
- `frontend/components/SettingsModal.tsx` (all emoji replacements)
- `frontend/types/index.ts` (icon definitions if needed)

**Approach:** Use tool-use icons from lucide-react

**Mapping:**
```typescript
const SETTINGS_ICONS = {
  infrastructure: 'Network',      // not 🌐
  avatar: 'Users',               // not 👤
  theme: 'Sun',                  // not 🌓
  notifications: 'Bell',         // not 🔔
  research: 'Search',            // not 🔍
  memory: 'Database',            // not 💾
  advanced: 'Settings',          // not ⚙️
  about: 'Info',                 // not ℹ️
};

// Usage:
<Lucide.Network size={16} /> {/* Instead of 🌐 */}
```

**Test:**
- [ ] Settings modal opens
- [ ] All icons visible and appropriate
- [ ] Consistent with quick menu icon style
- [ ] Dark/light mode contrast acceptable

---

### 7. Avatar Color Picker (Non-Preset)
**File:** `frontend/components/SettingsModal.tsx` + New component `AvatarColorPicker.tsx`

**Requirement:** NOT preset colors, but custom picker

**Implementation:**
```typescript
// Create NEW: frontend/components/AvatarColorPicker.tsx
export function AvatarColorPicker({ value, onChange }: Props) {
  // Use HTML5 color input, NOT presets
  return (
    <div>
      <label>Avatar Color</label>
      <input
        type="color"
        value={value || '#3b82f6'}
        onChange={e => onChange(e.target.value)}
      />
      <div style={{ background: value }} className="w-12 h-12 rounded" />
    </div>
  );
}

// In SettingsModal.tsx:
const [avatarColor, setAvatarColor] = useState(
  localStorage.getItem('avatar_color') || '#3b82f6'
);

// Update avatar generation:
const getAvatarColorForUser = (userId: string, overrideColor?: string) => {
  if (overrideColor) return overrideColor;
  // fallback to hash-based color
  return hashToColor(userId);
};
```

**Test:**
- [ ] Color picker appears in settings
- [ ] Can pick any color (not limited to presets)
- [ ] Avatar updates in real-time as color changes
- [ ] Color persists across page reloads
- [ ] Works in dark/light mode

---

### 8. Telegram Bot Updates
**File:** `telegram-bot.js` + Messages/Event handling

**Feature:** Bot posts when tasks start/complete

**Implementation:**
```javascript
// In telegram-bot.js, add listeners:

// Listen for task events:
neuronEmitter.on('task:started', (task) => {
  const msg = `🚀 Task Started: "${task.prompt.slice(0, 50)}..."\nEstimated: ${task.duration || '?'} min`;
  bot.sendMessage(chatId, msg);
});

neuronEmitter.on('task:completed', (task, result) => {
  const msg = `✅ Task Complete: "${task.prompt.slice(0, 50)}..."\nCompleted in ${result.elapsedTime}m`;
  bot.sendMessage(chatId, msg);
});

neuronEmitter.on('task:failed', (task, error) => {
  const msg = `❌ Task Failed: "${task.prompt.slice(0, 50)}..."\nError: ${error.message}`;
  bot.sendMessage(chatId, msg);
});

// Wire up in AgentPanel.tsx:
useEffect(() => {
  const handleTaskUpdate = (event) => {
    // Dispatch to telegram via custom event
    window.dispatchEvent(new CustomEvent('neuro-task-update', { detail: event }));
  };
  window.addEventListener('neuro-tasks-updated', handleTaskUpdate);
  return () => window.removeEventListener('neuro-tasks-updated', handleTaskUpdate);
}, []);
```

---

### 9. CLI/Terminal Version
**File:** `frontend/cli.ts` + New infrastructure

**Complexity:** HIGH - This requires mirroring UI features in CLI

**Approach:**
```bash
# Commands needed:
neuro research --topic "X" --depth quick|normal|deep|max
neuro task --create "Task description" [--duration 30] [--category research]
neuro task --list [--view day|week|month]
neuro task --schedule --after task_id "Next task"
neuro automation --create "name" "command" [--cron "0 9 * * *"]
neuro automation --run automation_id
neuro automation --list

# Implementation:
1. Create CLI commands in cli.ts using yargs
2. Reuse hooks (useResearch, useTaskScheduler) via Node.js entry point
3. Add text-based UI using ink/cli-table
4. Wire up same localStorage/IndexedDB for data persistence
5. Test: Can create and view tasks from CLI + UI
```

---

## Code Quality Guidelines ⚡

**When making edits:**
1. ✅ Make **targeted edits**, not full file rewrites
2. ✅ Add **proper error handling** with try-catch or fallbacks
3. ✅ Use **incremental updates** (don't rewrite if you can add)
4. ✅ **Test edge cases**: empty state, timeout, network failure, etc.
5. ✅ Keep **formatting clean** - consistent indentation, no dead code
6. ✅ **Comment why**, not what - explain intent, not just what code does

**Before submitting code:**
```bash
# Run type checker
npm run build

# Check for console errors
npm run lint

# Verify affected components still work
```

---

## Testing Checklist

After each feature:
- [ ] No TypeScript errors
- [ ] No console errors/warnings
- [ ] Feature works in dark mode
- [ ] Feature works on mobile (< 768px)
- [ ] Undo/redo works if applicable
- [ ] Network failure handled gracefully

---

## Progress Tracking

**Estimated Effort:**
- Research depth: 2-3 hours
- Quick menu: 30 minutes
- Plan mode: 1-2 hours
- Task scheduling: 1.5 hours
- Settings icons: 1 hour
- Avatar picker: 1 hour
- Telegram bot: 1 hour
- CLI: 4-6 hours (complex)

**Total: ~15 hours** of focused work

