# NEURO Terminal UI — Quick Start Integration

Get the OpenCode-style terminal running in 3 steps.

---

## Step 1: Import NeuroTerminalWrapper

In the component that renders your main dashboard (likely `src/App.tsx` or `src/components/AppShell.tsx`):

```typescript
import { NeuroTerminalWrapper } from './components/NeuroTerminalWrapper';
```

## Step 2: Replace Dashboard with Wrapper

Find where you're rendering `<Dashboard />` and replace it:

**Before:**
```typescript
export function AppContent() {
  return (
    <ThemeProvider>
      <CampaignProvider>
        <ErrorBoundary>
          <Dashboard />  {/* ← Replace this */}
        </ErrorBoundary>
      </CampaignProvider>
    </ThemeProvider>
  );
}
```

**After:**
```typescript
export function AppContent() {
  return (
    <ThemeProvider>
      <CampaignProvider>
        <ErrorBoundary>
          <NeuroTerminalWrapper
            onPause={() => console.log('Cycle paused')}
            onResume={() => console.log('Cycle resumed')}
            onSkipStage={() => console.log('Stage skipped')}
            onAbortCycle={() => console.log('Cycle aborted')}
            onExport={() => console.log('Exporting...')}
          />
        </ErrorBoundary>
      </CampaignProvider>
    </ThemeProvider>
  );
}
```

## Step 3: Optional - Wire Logs into useCycleLoop

For complete integration, add logging to your cycle execution. In `src/hooks/useCycleLoop.ts`:

```typescript
import { useNeuroTerminal } from './useNeuroTerminal';

export function useCycleLoop() {
  const { addLog } = useNeuroTerminal();
  // ... existing code ...

  // Log stage transitions
  useEffect(() => {
    addLog('info', `Starting stage: ${currentStage}`);
  }, [currentStage, addLog]);

  // Log stage completions
  if (previousStatus !== 'complete' && currentStatus === 'complete') {
    addLog('success', `Stage complete: ${stage}`,
      `Tokens: 15,234 | Duration: 234s | Quality: 8.5/10`);
  }

  // Log errors
  useEffect(() => {
    if (error) {
      addLog('error', `Cycle error occurred`, error);
    }
  }, [error, addLog]);
}
```

---

## Done! 🎉

That's it. Now when you run a cycle:

- **During execution:** Full-screen terminal with real-time monitoring
- **When paused:** Split view (terminal + dashboard)
- **When idle:** Dashboard-only view

### Keyboard Shortcuts Ready to Use

| Key | Action |
|-----|--------|
| `Cmd+K` | Open Command Palette |
| `Cmd+P` | Pause / Resume |
| `Cmd+S` | Skip Stage |
| `Cmd+E` | Export |

---

## What You Get

### Terminal Header
```
Campaign: Collagen Ads                    ● RUNNING  1h 23m
Stage: research                            Tokens: 45K/75K ▓▓▓
```

### Pipeline Stages (Clickable)
```
research            15,234 tokens
[████████░░░░░░░░] 40%  Duration: 234s  Quality: 7.3/10
```

### Real-Time Metrics
```
Sources: 156/400 │ Coverage: 92% │ Quality: 8.7/10
Token Budget: 45K/75K │ Elapsed: 1m 23s
```

### Stuck Detection (Auto-Warnings)
```
⚠ Stuck - Long Running
"research" has been running for 12m. Recommend abort or skip.
                                              [Skip] [Restart]
```

### Searchable Logs
```
🔍 Search logs...
12:34:56 [INFO] Phase 1 research initialized
12:35:02 [SUCCESS] Found 45 sources across 5 domains
12:36:15 [ERROR] Compression failed for source #23
```

### Command Palette (Cmd+K)
```
⌘ Type command or press ESC...
⏸ Pause Cycle
▶ Resume Cycle
⤵ Skip Stage
✕ Abort Cycle
```

---

## Customization (Optional)

### Change Stuck Detection Thresholds

Edit in `src/components/NeuroTerminalUI.tsx` (StuckDetectionPanel):

```typescript
if (stageElapsed > 300) { ... }  // 5 minutes (change this)
if (stageElapsed > 600) { ... }  // 10 minutes (change this)
if (tokenPercent > 90) { ... }   // 90% budget (change this)
```

### Add Custom Log Colors

Edit `getLevelColor()` in LogViewer:

```typescript
const getLevelColor = (level: LogLevel): string => {
  switch (level) {
    case 'info': return '#3b82f6';      // Blue
    case 'success': return '#22c55e';   // Green
    case 'warn': return '#f59e0b';      // Amber
    case 'error': return '#ef4444';     // Red
    case 'debug': return '#8b5cf6';     // Purple
    // Add custom levels here
  }
}
```

### Change Split View Divider Position

Default is 50/50. To change:

```typescript
// In NeuroTerminalWrapper
const [terminalWidth, setTerminalWidth] = useState(60); // 60% terminal, 40% dashboard
```

---

## Troubleshooting

**Terminal not showing?**
- Check that a cycle is running: `systemStatus === 'running'` in CampaignContext
- Verify imports are correct: `import { NeuroTerminalWrapper } from './components/NeuroTerminalWrapper'`

**Logs empty?**
- You need to manually call `addLog()` from useCycleLoop hook
- Without wire-up, you'll only see the mock logs in the demo

**Stuck detection not working?**
- Ensure `cycle.stages[stage].startedAt` is set when stage begins
- Check thresholds (default 5m warning, 10m error)

**Command shortcuts not responding?**
- Ensure no other component is capturing Cmd+K, Cmd+P, etc.
- Check browser console for JavaScript errors

---

## File Locations

- **Main UI:** `src/components/NeuroTerminalUI.tsx`
- **Wrapper:** `src/components/NeuroTerminalWrapper.tsx`
- **Hook:** `src/hooks/useNeuroTerminal.ts`
- **Full Docs:** `docs/NEURO_TERMINAL_UI.md`

---

## Next Steps

1. ✅ Replace Dashboard with Wrapper
2. ✅ Test in-running state (cycle executing)
3. ✅ Test pause state (Cmd+P to pause)
4. ✅ Test idle state (no cycle running)
5. ✅ Try Command Palette (Cmd+K)
6. ✅ Try Stuck Detection (run a stage >5m to trigger)
7. (Optional) Wire addLog() calls into useCycleLoop for full logging

---

**Ready to ship!** 🚀
