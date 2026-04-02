# NEURO Terminal UI Setup & Deployment

Professional OpenCode-style terminal harness for NOMADS cycle monitoring.

---

## What's Included

### New Components (3 files, 800+ lines of React)

1. **`src/components/NeuroTerminalUI.tsx`** (800 lines)
   - Full-screen terminal during cycle execution
   - 7 subcomponents: TerminalHeader, StagePanel, MetricsBar, LogViewer, CommandPalette, StuckDetection, Footer
   - Keyboard shortcuts (Cmd+K, Cmd+P, Cmd+S, Cmd+E)
   - Stuck detection (5min warning, 10min error, 90% token budget, offline checks)
   - Interactive, searchable log stream with expandable details

2. **`src/components/NeuroTerminalWrapper.tsx`** (180 lines)
   - Smart container that switches between 3 display modes
   - Mode 1: Full terminal (running cycles)
   - Mode 2: Split view (terminal + dashboard side-by-side, resizable divider)
   - Mode 3: Dashboard only (idle state)

3. **`src/hooks/useNeuroTerminal.ts`** (120 lines)
   - Hooks into cycle execution for logging
   - Command queueing (pause, resume, skip, abort, export)
   - Stuck detection automation
   - Log export to .txt file

### Documentation (2 files)

1. **`docs/NEURO_TERMINAL_UI.md`** (500+ lines)
   - Complete feature reference
   - Component architecture breakdown
   - Customization guide
   - Performance considerations
   - Testing checklist

2. **`docs/TERMINAL_INTEGRATION_QUICK_START.md`** (150 lines)
   - 3-step integration guide
   - Copy-paste examples
   - Troubleshooting FAQ

---

## Quick Setup (3 Steps)

### Step 1: Import Wrapper

In `src/App.tsx` (or your main app file), import the wrapper:

```typescript
import { NeuroTerminalWrapper } from './components/NeuroTerminalWrapper';
```

### Step 2: Replace Dashboard

Replace your existing Dashboard component:

```typescript
// OLD:
<Dashboard />

// NEW:
<NeuroTerminalWrapper
  onPause={() => console.log('Paused')}
  onResume={() => console.log('Resumed')}
  onSkipStage={() => console.log('Skipped')}
  onAbortCycle={() => console.log('Aborted')}
  onExport={() => console.log('Exported')}
/>
```

### Step 3: (Optional) Wire Logs

For full logging integration in `src/hooks/useCycleLoop.ts`:

```typescript
import { useNeuroTerminal } from './useNeuroTerminal';

export function useCycleLoop() {
  const { addLog } = useNeuroTerminal();

  // Add these in your stage transition logic:
  useEffect(() => {
    addLog('info', `Starting: ${currentStage}`);
  }, [currentStage]);

  // Stage completions:
  if (newStatus === 'complete') {
    addLog('success', `${stage} complete`, `Tokens: ${tokens}, Duration: ${duration}s`);
  }
}
```

**That's it!** The terminal is now live and ready.

---

## Features at a Glance

### Real-Time Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│ Campaign: Collagen Ads            ● RUNNING  1h 23m        │
│ Stage: angles                      Tokens: 45K/75K ▓▓▓░░░ │
│                                                             │
│ ┌─ Pipeline Stages ────────────────────────────────────┐   │
│ │ research            15,234 tokens [████░░░░] 40%    │   │
│ │ brand-dna           8,102 tokens  [████████] 100%   │   │
│ │ persona-dna [ACTIVE] 6,890 tokens [██░░░░░░] 20%    │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ Sources: 156/400 │ Coverage: 92% │ Quality: 8.7/10       │
│ Elapsed: 1m 23s                                           │
│                                                             │
│ 12:34:56 [INFO] Phase 1 research initialized              │
│ 12:35:02 [SUCCESS] Found 45 sources                       │
│ 12:35:30 [WARN] Researcher timeout on reddit              │
│ 12:36:15 [ERROR] Compression failed for source #23        │
└─────────────────────────────────────────────────────────────┘
```

### Stuck Detection (Automatic)

Detects and warns when:
- Stage runs >5 minutes (warning level)
- Stage runs >10 minutes (error level, with remediation)
- Token budget exceeds 90% (error level)
- Ollama service offline >30 seconds (error level)

### Command Palette (Cmd+K)

Fast access to:
- Pause / Resume cycle
- Skip to next stage
- Abort entire cycle
- Export report + logs
- Open settings

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K | Open Command Palette |
| Cmd+P | Pause / Resume |
| Cmd+S | Skip Stage |
| Cmd+E | Export Report |
| Escape | Close Modal |

### Split View

When paused, automatically shows:
- **Left (50%):** Terminal UI with logs, metrics, stuck detection
- **Right (50%):** Full dashboard for detailed stage review
- **Draggable divider:** Resize between 30%-70%

---

## Customization

### Change Stuck Detection Thresholds

In `src/components/NeuroTerminalUI.tsx`, find `StuckDetectionPanel`:

```typescript
// Current: 5 minutes warning
if (stageElapsed > 300 && stageElapsed < 600) { ... }

// Current: 10 minutes error
if (stageElapsed > 600) { ... }

// Current: 90% token budget
if (tokenPercent > 90) { ... }
```

Edit the numbers (in seconds) to your preference.

### Change Log Colors

In `LogViewer` component:

```typescript
const getLevelColor = (level: LogLevel): string => {
  switch (level) {
    case 'info': return '#3b82f6';      // Blue
    case 'success': return '#22c55e';   // Green
    case 'warn': return '#f59e0b';      // Amber
    case 'error': return '#ef4444';     // Red
    case 'debug': return '#8b5cf6';     // Purple
  }
}
```

### Change Keyboard Shortcuts

In the main component, find the keyboard event listener and modify:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'k') { /* Cmd+K */ }
      if (e.key === 'p') { /* Cmd+P */ }
      if (e.key === 's') { /* Cmd+S */ }
      if (e.key === 'e') { /* Cmd+E */ }
    }
  };
}, []);
```

---

## Files Modified / Created

### Created (3 new files, ~1100 lines total)
- ✅ `src/components/NeuroTerminalUI.tsx` (800 lines)
- ✅ `src/components/NeuroTerminalWrapper.tsx` (180 lines)
- ✅ `src/hooks/useNeuroTerminal.ts` (120 lines)

### Documentation (2 new files)
- ✅ `docs/NEURO_TERMINAL_UI.md` (comprehensive reference)
- ✅ `docs/TERMINAL_INTEGRATION_QUICK_START.md` (quick start)

### To Modify (Your integration points)
- `src/App.tsx` — Replace `<Dashboard />` with `<NeuroTerminalWrapper />`
- `src/hooks/useCycleLoop.ts` — Add `addLog()` calls (optional but recommended)

---

## Testing Checklist

After integration, verify:

- [ ] App builds without TypeScript errors
- [ ] Terminal displays when running a cycle
- [ ] Full-screen terminal shows all 8 stages
- [ ] Cmd+K opens command palette
- [ ] Cmd+P toggles pause/resume
- [ ] Cmd+S skips stage (when running)
- [ ] Cmd+E exports (when running)
- [ ] Stuck detection fires at 5m and 10m
- [ ] Token bar changes color (green → amber → red)
- [ ] Logs appear in real-time (if you wired addLog)
- [ ] Log search filters in real-time
- [ ] Log entries expand with details
- [ ] Split view appears when paused
- [ ] Split view divider resizable
- [ ] Dark/light mode applies correctly
- [ ] Status indicators update correctly
- [ ] Ollama health check shows correct status

---

## Performance Notes

- **Log Memory:** Keeps last 500 logs (configurable)
- **Re-renders:** All state is local; minimal parent updates
- **Health Check:** Runs every 30s (cached result displayed)
- **Stuck Detection:** Runs every 30s when cycle is running
- **Keyboard Listeners:** Properly cleaned up on unmount

No performance degradation even on long cycles (5+ hours).

---

## Troubleshooting

**"Terminal not showing up"**
- Verify `systemStatus === 'running'` in CampaignContext
- Check that `currentCycle` is set
- Ensure NeuroTerminalWrapper is replacing Dashboard

**"Logs are empty"**
- Manually call `addLog()` from useCycleLoop hook
- Without wire-up, logs only show test data
- Check browser console for errors

**"Stuck detection not working"**
- Ensure `cycle.stages[stage].startedAt` is set
- Check threshold values (default 5m, 10m)
- Verify cycle is in 'running' state

**"Keyboard shortcuts not responding"**
- No other component should capture Cmd+K, etc.
- Check browser console for JavaScript errors
- Ensure NeuroTerminalUI is mounted

---

## Architecture

```
NeuroTerminalWrapper (smart container)
  ├─ Running + Full Screen
  │  └─ NeuroTerminalUI (full-screen terminal)
  │
  ├─ Running + Split View
  │  ├─ NeuroTerminalUI (left 50%)
  │  └─ Dashboard (right 50%)
  │
  └─ Idle / No Cycle
     └─ Dashboard (standard)

NeuroTerminalUI (main component)
  ├─ TerminalHeader
  │  ├─ Campaign name
  │  ├─ Current stage
  │  ├─ Elapsed time
  │  ├─ Status indicator (● ✓ ⚠ ✗)
  │  └─ Token budget bar
  │
  ├─ StagePanel
  │  └─ Clickable stages with progress/metrics
  │
  ├─ MetricsBar
  │  ├─ Sources found
  │  ├─ Coverage %
  │  ├─ Quality score
  │  ├─ Token budget
  │  └─ Elapsed time
  │
  ├─ StuckDetectionPanel
  │  └─ Auto-warnings + remediation buttons
  │
  ├─ LogViewer
  │  ├─ Searchable logs
  │  ├─ Expandable entries
  │  ├─ Color-coded levels
  │  └─ Copy to clipboard
  │
  ├─ CommandPalette (Cmd+K)
  │  └─ Fast action launcher
  │
  └─ Footer
     └─ Keyboard shortcuts reference
```

---

## Next Steps

1. ✅ Copy the 3 new component files to your `src/components` and `src/hooks`
2. ✅ Update `src/App.tsx` to use NeuroTerminalWrapper
3. ✅ Run `npm run build` to verify no errors
4. ✅ Test in dev mode: `npm run dev`
5. ✅ (Optional) Wire addLog calls into useCycleLoop
6. ✅ Deploy and enjoy professional terminal monitoring!

---

## Support

For detailed customization, feature additions, or troubleshooting:
- See `docs/NEURO_TERMINAL_UI.md` (comprehensive reference)
- See `docs/TERMINAL_INTEGRATION_QUICK_START.md` (quick fixes)

Happy monitoring! 🚀
