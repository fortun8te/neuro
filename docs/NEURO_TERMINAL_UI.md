# NEURO Terminal UI — OpenCode-style Harness

The NEURO Terminal UI brings professional-grade terminal-style controls and monitoring to the NOMADS cycle loop. Inspired by OpenCode's stuck detection and command palette patterns, this system provides real-time pipeline visibility with powerful keyboard shortcuts and intelligent stuck-state handling.

---

## Overview

### What It Does

The NeuroTerminalUI component replaces the standard dashboard during cycle execution, providing:

1. **Real-Time Monitoring** — Live stage progress, token usage, coverage metrics
2. **Stuck Detection** — Automatic warnings when stages exceed time thresholds or token budgets
3. **Command Palette** — Lightning-fast control via Cmd+K (pause, resume, skip, abort, export)
4. **Interactive Logs** — Searchable, expandable, color-coded log entries with copy-to-clipboard
5. **Smart Split View** — Optional side-by-side terminal + dashboard when paused
6. **Keyboard Shortcuts** — Instant access to critical actions (Cmd+P, Cmd+S, Cmd+E)

### Architecture

```
App.tsx
  └─ NeuroTerminalWrapper
      ├─ Full Screen: NeuroTerminalUI (when running)
      ├─ Split View: Terminal + Dashboard (when paused)
      └─ Dashboard Only: Standard view (when idle)

NeuroTerminalUI (800+ lines)
  ├─ TerminalHeader (campaign, stage, status, tokens, time)
  ├─ StagePanel (clickable stages, progress bars, metrics)
  ├─ MetricsBar (sources, coverage, quality, tokens, elapsed)
  ├─ StuckDetectionPanel (5min, 10min, token budget, offline warnings)
  ├─ LogViewer (scrollable, searchable, expandable)
  ├─ CommandPalette (Cmd+K modal with actions)
  └─ KeyboardShortcuts (global event listeners)

useNeuroTerminal Hook
  ├─ Log streaming (addLog, clearLogs, exportLogs)
  ├─ Command queueing (pause, resume, skip, abort, export)
  ├─ Stuck detection (5min/10min/token checks)
  └─ Integration with useCycleLoop
```

---

## Components

### 1. NeuroTerminalUI (Main Component)

**Location:** `src/components/NeuroTerminalUI.tsx`

The primary full-screen terminal UI displayed during cycle execution.

#### Props

```typescript
interface NeuroTerminalUIProps {
  cycle: Cycle;
  campaign: Campaign;
  isRunning: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onSkipStage?: () => void;
  onAbortCycle?: () => void;
  onExport?: () => void;
}
```

#### Subcomponents

##### TerminalHeader
Shows campaign name, current stage, elapsed time, status indicator, and token budget bar.

```
┌────────────────────────────────────────────────────────────────┐
│ Campaign: Collagen Ads                    ● RUNNING  1h 23m   │
│ Stage: angles                              Tokens: 45K/75K ▓▓▓ │
└────────────────────────────────────────────────────────────────┘
```

- **Status Icons:** `●` Running, `✓` Complete, `✗` Error, `⏸` Paused
- **Status Colors:** Green (running), Blue (complete), Red (error), Amber (paused)
- **Token Bar:** Color-coded per usage: Green <60%, Amber 60-80%, Red >80%

##### StagePanel
Clickable list of all 8 pipeline stages with per-stage metrics.

```
┌─ Pipeline Stages ─────────────────────────────────────────────┐
│ research            15,234 tokens                            │
│ [████████░░░░░░░░] 40%  Duration: 234s  Quality: 7.3/10    │
│                                                               │
│ brand-dna           8,102 tokens  [Complete]                 │
│ [████████████████] 100%  Duration: 89s   Quality: 8.5/10    │
│                                                               │
│ persona-dna [ACTIVE]   6,890 tokens                          │
│ [██████░░░░░░░░░░░] 35%  Duration: 45s   Quality: 7.8/10    │
└───────────────────────────────────────────────────────────────┘
```

**Features:**
- Click any stage to view its output in the dashboard (when split-view enabled)
- Real-time progress bars for active stages
- Token usage per stage
- Duration (seconds elapsed)
- Quality score (0-10)
- Status color coding (pending gray, active green, complete blue, error red)

##### MetricsBar
Real-time metrics dashboard showing research progress and system health.

```
┌────────────────────────────────────────────────────────────────┐
│ Sources: 156/400  │  Coverage: 92%  │  Quality: 8.7/10      │
│ Token Budget: 45K/75K  │  Elapsed: 1m 23s                   │
└────────────────────────────────────────────────────────────────┘
```

**Metrics:**
- **Sources:** Found / Target (e.g., 156/400)
- **Coverage:** Dimensional coverage percentage
- **Quality:** Perceived research quality (subjective 0-10)
- **Token Budget:** Used / Available with percentage
- **Elapsed:** Time spent on current cycle

##### StuckDetectionPanel
Intelligent detection of common blocking scenarios with one-click remediation.

```
┌─ Stuck Detection ─────────────────────────────────────────────┐
│ ⚠ Stuck - Long Running                                      │
│ "research" has been running for 12m. Recommend abort/skip.  │
│                                                   [Skip] [Restart] │
└───────────────────────────────────────────────────────────────┘
```

**Detection Triggers:**
1. **5+ minutes elapsed** → "Stuck? Try: [Skip] [Pause] [Restart]" (warn level)
2. **10+ minutes elapsed** → "Stuck - Long Running. Recommend abort/skip." (error level)
3. **Token budget >90%** → "Budget critical. Compress context or skip." (error level)
4. **Ollama offline 30s+** → "Service down. Retry? Pause?" (error level)

**Actions:**
- `[Skip]` — Jump to next stage
- `[Pause]` — Pause cycle for manual review
- `[Restart]` — Pause then immediately resume

##### LogViewer
Scrollable, searchable, expandable log stream with color-coded levels.

```
┌─ Search ──────────────────────────────────────────────────────┐
│ 🔍 Search logs...                                           ✕ │
├───────────────────────────────────────────────────────────────┤
│ 12:34:56 [INFO] Phase 1 research initialized                 │
│   ► [DEBUG] Fetching 5 parallel researchers                  │
│ 12:34:57 [INFO] Researcher 1: Searching "collagen market"   │
│ 12:35:02 [SUCCESS] Found 45 sources across 5 domains        │
│ 12:35:30 [WARN] Researcher 3 timeout on reddit.com          │
│ 12:36:15 [ERROR] Compression failed for source #23          │
└───────────────────────────────────────────────────────────────┘
```

**Features:**
- **Color-coded levels:** Blue (info), Green (success), Yellow (warn), Red (error), Purple (debug)
- **Timestamps:** ISO format, human-readable in UI
- **Expandable entries:** Click chevron to view full details
- **Search:** Real-time filter by message or details (case-insensitive)
- **Copy:** Click copy icon to copy individual log messages
- **Auto-scroll:** Follows new messages as they arrive
- **History:** Keeps last 500 logs in memory

##### CommandPalette
Quick-access command launcher via Cmd+K.

```
┌─ Command Palette ────────────────────────────────────────────┐
│ ⌘ Type command or press ESC...                              │
├───────────────────────────────────────────────────────────────┤
│ ⏸ Pause Cycle                                               │
│ ▶ Resume Cycle                                              │
│ ⤵ Skip Stage                                                │
│ ✕ Abort Cycle                                               │
│ ⬇ Export Report                                             │
│ ⚙ Open Settings                                             │
├───────────────────────────────────────────────────────────────┤
│ Shortcuts: Cmd+P • Cmd+S • Cmd+E                            │
└───────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Opens on Cmd+K, closes on Escape
- Instant search as you type
- Grayed-out disabled commands (e.g., "Resume" when running)
- Shows keyboard shortcuts at bottom
- Click or press Enter to execute

### 2. NeuroTerminalWrapper

**Location:** `src/components/NeuroTerminalWrapper.tsx`

Smart container that switches between full-screen terminal, split view, and dashboard-only based on cycle state.

#### Display Modes

**Mode 1: Full Terminal** (Running)
```
systemStatus === 'running' && !splitViewEnabled
→ Full-screen NeuroTerminalUI
```

**Mode 2: Split View** (Paused or Running with split enabled)
```
systemStatus === 'paused' || (isRunning && splitViewEnabled)
→ Terminal (50%) | Dashboard (50%)
   [resizable divider]
```

**Mode 3: Dashboard Only** (Idle)
```
systemStatus === 'idle' || no currentCycle
→ Standard Dashboard component
```

#### Features

- **Auto split on pause:** When user pauses via Cmd+P, automatically show split view for side-by-side monitoring
- **Draggable divider:** Resize between 30%-70% terminal width
- **Toggle button:** Collapse split view back to full terminal (top-right corner)
- **Smooth transitions:** All layout changes animated via React state

### 3. useNeuroTerminal Hook

**Location:** `src/hooks/useNeuroTerminal.ts`

Integration layer between terminal UI and the cycle loop.

#### Methods

```typescript
// Add a log entry
addLog(level: 'info' | 'warn' | 'error' | 'success' | 'debug', message: string, details?: string): void

// Clear all logs
clearLogs(): void

// Export logs as .txt file
exportLogs(): void

// Queue a command for execution
queueCommand(command: 'pause' | 'resume' | 'skip' | 'abort' | 'export' | 'settings'): void

// Manual stuck check
checkStuckConditions(): void
```

#### Usage Example

```typescript
const { addLog, queueCommand, exportLogs } = useNeuroTerminal();

// Log a stage completion
addLog('success', 'research stage complete', `Found 156 sources in 234s`);

// Queue a pause
queueCommand('pause');

// Log an error
addLog('error', 'Ollama connection failed', 'Error details here...');

// Export logs
exportLogs(); // Downloads neuro-logs-{timestamp}.txt
```

---

## Keyboard Shortcuts

| Shortcut | Action | Notes |
|----------|--------|-------|
| **Cmd+K** | Open Command Palette | Search and execute commands |
| **Cmd+P** | Pause / Resume | Toggles based on current state |
| **Cmd+S** | Skip Current Stage | Only available when running |
| **Cmd+E** | Export Cycle Report | Generates report + logs |
| **Escape** | Close Command Palette | When modal is open |

---

## Integration Guide

### 1. Replace Dashboard with Wrapper

In `src/components/App.tsx` (or wherever you render the main view):

```typescript
import { NeuroTerminalWrapper } from './components/NeuroTerminalWrapper';

export function App() {
  return (
    <ThemeProvider>
      <CampaignProvider>
        {/* Replace <Dashboard /> with: */}
        <NeuroTerminalWrapper
          onPause={() => console.log('Paused')}
          onResume={() => console.log('Resumed')}
          onSkipStage={() => console.log('Skipped')}
          onAbortCycle={() => console.log('Aborted')}
          onExport={() => console.log('Exported')}
        />
      </CampaignProvider>
    </ThemeProvider>
  );
}
```

### 2. Wire Logs into useCycleLoop

In `src/hooks/useCycleLoop.ts`, import and use the hook:

```typescript
import { useNeuroTerminal } from './useNeuroTerminal';

export function useCycleLoop() {
  // ... existing code ...
  const { addLog } = useNeuroTerminal();

  // Log stage transitions
  useEffect(() => {
    if (currentStage !== previousStage) {
      addLog('info', `Transitioned to stage: ${currentStage}`);
    }
  }, [currentStage]);

  // Log errors
  useEffect(() => {
    if (error) {
      addLog('error', `Cycle error: ${error}`);
    }
  }, [error]);

  // Log stage completions
  if (cycle.stages[stage].status === 'complete') {
    addLog('success', `Stage complete: ${stage}`,
      `Tokens: ${tokens}, Duration: ${duration}s`);
  }
}
```

### 3. Wire Command Handlers

The wrapper's callback props should integrate with your cycle pause/resume/skip logic:

```typescript
// In Dashboard or AppShell
const { pauseCycle, resumeCycle, skipStage, abortCycle } = useCampaign();

<NeuroTerminalWrapper
  onPause={pauseCycle}
  onResume={resumeCycle}
  onSkipStage={skipStage}
  onAbortCycle={abortCycle}
  onExport={() => generateReport(currentCycle)}
/>
```

---

## Customization

### Colors & Theme

All colors are defined inline with dark/light mode support via the `isDarkMode` prop:

```typescript
// Status colors (adjust in TerminalHeader)
const statusColor = status === 'running' ? '#22c55e' : ...

// Log level colors (adjust in LogViewer)
const getLevelColor = (level: LogLevel): string => {
  switch (level) {
    case 'info': return '#3b82f6';     // Blue
    case 'success': return '#22c55e';  // Green
    case 'warn': return '#f59e0b';     // Amber
    case 'error': return '#ef4444';    // Red
    case 'debug': return '#8b5cf6';    // Purple
  }
}
```

To customize, edit these color constants directly in the component.

### Stuck Detection Thresholds

Edit these constants in `NeuroTerminalUI`:

```typescript
// StuckDetectionPanel component
const stageElapsed = ...; // seconds

// Warning threshold: 5 minutes
if (stageElapsed > 300 && stageElapsed < 600) { ... }

// Error threshold: 10 minutes
if (stageElapsed > 600) { ... }

// Token budget: 90% critical
if (tokenPercent > 90) { ... }
```

### Log Capacity

Maximum 500 logs kept in memory. To increase:

```typescript
// In LogViewer
if (logs.length > 500) {  // Change 500 to desired limit
  setLogs((prev) => prev.slice(-500));
}
```

### Command Palette Options

Add/remove commands in `CommandPalette`:

```typescript
const commands = [
  { name: 'Pause Cycle', key: 'pause', icon: Pause, disabled: !isRunning },
  { name: 'Resume Cycle', key: 'resume', icon: Play, disabled: isRunning },
  // Add your own:
  // { name: 'Snapshot State', key: 'snapshot', icon: Save, disabled: false },
];
```

---

## Performance Considerations

1. **Log Memory:** Keeps last 500 logs. On very long cycles, consider archiving older logs.
2. **Re-renders:** All state updates are local to the component; parent re-renders are minimal.
3. **Ollama Health Check:** Runs every 30 seconds; cached result shown in header.
4. **Keyboard Listeners:** Global listeners added/removed on component mount/unmount.

---

## Testing Checklist

- [ ] Full-screen terminal displays all 8 stages
- [ ] Clicking a stage shows its output in split view
- [ ] Cmd+K opens command palette, Escape closes
- [ ] Cmd+P toggles pause/resume
- [ ] Cmd+S skips stage (only when running)
- [ ] Cmd+E exports logs
- [ ] Stuck detection fires at 5m and 10m marks
- [ ] Token budget colors change (green→amber→red) correctly
- [ ] Log search filters entries in real-time
- [ ] Log entries are expandable (details view)
- [ ] Copy button works on log messages
- [ ] Split view resizes correctly with draggable divider
- [ ] Dark/light mode applies to all text and backgrounds
- [ ] Status indicator updates when cycle state changes
- [ ] Elapsed time increments every second when running
- [ ] Ollama health check shows correct status

---

## Future Enhancements

1. **Persistent Log Export:** Archive logs to IndexedDB per cycle
2. **Live Streaming Integration:** Show streaming JSON tokens in log entries
3. **Advanced Metrics:** CPU/GPU usage, network bandwidth
4. **Stage Bookmarks:** Mark interesting log entries for quick reference
5. **Custom Alerts:** User-defined stuck conditions (e.g., "skip if quality <7")
6. **Replay Mode:** Play back cycle execution from logs
7. **Terminal Themes:** Predefined color schemes (dracula, nord, solarized, etc.)

---

## Files Created/Modified

### New Files

- `src/components/NeuroTerminalUI.tsx` — Main terminal component (800+ lines)
- `src/components/NeuroTerminalWrapper.tsx` — Smart container wrapper
- `src/hooks/useNeuroTerminal.ts` — Terminal integration hook
- `docs/NEURO_TERMINAL_UI.md` — This documentation

### Files to Modify

- `src/App.tsx` — Replace Dashboard with NeuroTerminalWrapper
- `src/hooks/useCycleLoop.ts` — Add `useNeuroTerminal()` calls for logging
- `src/components/AppShell.tsx` (optional) — If currently using Dashboard directly

---

## Troubleshooting

### Terminal Not Showing

- Check `systemStatus === 'running'` in NeuroTerminalWrapper
- Ensure `currentCycle` exists in CampaignContext
- Verify NeuroTerminalUI import exists

### Stuck Detection Not Firing

- Check `STAGE_TIMEOUT` constants (default 5m and 10m)
- Ensure `cycle.stages[stage].startedAt` is set
- Verify cycle is in `running` state

### Logs Not Appearing

- Confirm `addLog()` is called with correct params
- Check browser console for errors
- Verify LogViewer is not filtered by search query

### Ollama Health Check Always "Down"

- Verify INFRASTRUCTURE.ollamaUrl is correct
- Ensure `http://100.74.135.83:11440/api/tags` is accessible
- Check network connectivity / firewall rules

---

## License

Part of NOMADS project. See LICENSE for details.
