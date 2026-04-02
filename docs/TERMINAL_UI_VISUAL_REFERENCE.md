# NEURO Terminal UI — Visual Reference Guide

ASCII mockups and color schemes for the OpenCode-style terminal harness.

---

## Full-Screen Terminal Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Campaign: Collagen Ads        ● RUNNING  1h 23m      Tokens: 45K/75K ▓▓▓░░░░░│
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Pipeline Stages ───────────────────────────────────────────────────────────────┐
│                                                                                  │
│  research            15,234 tokens                          Duration: 234s     │
│  [████████░░░░░░░░░░] 40%                                   Quality: 7.3/10    │
│                                                                                  │
│  brand-dna           8,102 tokens  [COMPLETE]               Duration: 89s      │
│  [████████████████████] 100%                                Quality: 8.5/10    │
│                                                                                  │
│  persona-dna [ACTIVE] 6,890 tokens                          Duration: 45s      │
│  [██████░░░░░░░░░░░░░░░░░] 35%                             Quality: 7.8/10    │
│                                                                                  │
│  angles              4,102 tokens                           (pending)          │
│  [░░░░░░░░░░░░░░░░░░░░] 0%                                 Quality: 0.0/10    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─ Metrics ───────────────────────────────────────────────────────────────────────┐
│ Sources: 156/400  │  Coverage: 92%  │  Quality: 8.7/10  │  Tokens: 45K/75K   │
│ Elapsed: 1m 23s                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─ Stuck Detection ───────────────────────────────────────────────────────────────┐
│ ⚠ Stage "research" stuck for 12 minutes                                        │
│ Recommend: [Skip] [Pause] [Restart]                                           │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─ Logs ──────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search logs...                                                       (✕)    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  12:34:56  [INFO]     Phase 1 research initialized                             │
│                    ► Deploying 5 parallel researchers                          │
│                                                                                  │
│  12:35:02  [SUCCESS]  Found 45 sources across 5 domains                        │
│                    ► Details: Reddit (12), Wikipedia (8), Market Research (25) │
│                                                                                  │
│  12:35:30  [WARN]     Researcher 3 timeout on reddit.com                       │
│                    ► Retrying with 60s timeout...                              │
│                                                                                  │
│  12:36:15  [ERROR]    Compression failed for source #23                        │
│                    ► Skipping source, continuing...                            │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─ Shortcuts ─────────────────────────────────────────────────────────────────────┐
│ ⌘K Command Palette  │  ⌘P Pause/Resume  │  ⌘S Skip  │  ⌘E Export  │ ● Services OK
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Split-View Layout (Paused Cycle)

```
┌─ LEFT: Terminal (50%) ────────┬───┬─ RIGHT: Dashboard (50%) ─────────────────┐
│                               │   │                                            │
│ Terminal Header               │▬▬▬│ Campaign Selector / Preview                │
│ Pipeline Stages (clickable)   │▬▬▬│                                            │
│ Metrics Bar                   │▬▬▬│ Stage Details                              │
│ Stuck Detection (if any)      │▬▬▬│ - Research Output                          │
│ Logs (searchable)             │▬▬▬│ - Desire-Driven Analysis                   │
│ Footer (shortcuts)            │   │ - Coverage Metrics                         │
│                               │   │                                            │
└───────────────────────────────┴───┴────────────────────────────────────────────┘
  [< Collapse button on right side]
```

---

## Color Scheme

### Status Indicators

```
● RUNNING     → Green (#22c55e)    — Cycle actively executing
✓ COMPLETE    → Blue (#3b82f6)     — Cycle finished successfully
⚠ WARNING     → Amber (#f59e0b)    — Issue detected but recoverable
✗ ERROR       → Red (#ef4444)      — Critical issue, manual intervention needed
⏸ PAUSED      → Amber (#f59e0b)    — Cycle paused by user
```

### Log Levels

```
[INFO]        → Blue (#3b82f6)     — Informational message
[SUCCESS]     → Green (#22c55e)    — Positive outcome / completion
[WARN]        → Amber (#f59e0b)    — Warning, may need attention
[ERROR]       → Red (#ef4444)      — Error, action required
[DEBUG]       → Purple (#8b5cf6)   — Development/debugging info
```

### Token Budget Bar

```
Progress 0-60%     → Green (#22c55e)     ▓▓▓░░░░░░░░
Progress 60-80%    → Amber (#f59e0b)     ▓▓▓▓▓▓░░░░░
Progress 80-100%   → Red (#ef4444)       ▓▓▓▓▓▓▓▓░░░
```

### Stage Progress Bars

```
Pending   → Gray      [░░░░░░░░░░░░░░░░░░░░] 0%     (Inactive)
Active    → Green     [████████░░░░░░░░░░░░] 40%    (Running)
Complete  → Blue      [████████████████████] 100%   (Finished)
Error     → Red       [████░░░░░░░░░░░░░░░░] 20%    (Failed, stopped)
```

---

## Terminal Header Details

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Campaign: Collagen Ads        ● RUNNING  1h 23m                         │
│  Stage: angles                 Tokens: 45K/75K ▓▓▓░░░░░░░░              │
└────────────────────────────────────────────────────────────────────────────┘

Components:
- Left: Campaign name + Current stage
- Center: Status (icon + text) + Elapsed time
- Right: Token budget bar with usage percentage
```

---

## Stage Panel (Clickable)

```
┌─ Pipeline Stages ──────────────────────────────────────────┐
│                                                            │
│ research              15,234 tokens  [████████░░░░░░] 40% │
│  Duration: 234s  Quality: 7.3/10                          │
│                                                            │
│ brand-dna             8,102 tokens   [████████████░░] 100%│  ← Clickable
│  Duration: 89s   Quality: 8.5/10                          │
│                                                            │
│ persona-dna [ACTIVE]  6,890 tokens   [██░░░░░░░░░░░░] 35%│
│  Duration: 45s   Quality: 7.8/10                          │
│                                                            │
│ angles                4,102 tokens   [░░░░░░░░░░░░░░░] 0% │
│  (Pending)                           Quality: 0.0/10      │
│                                                            │
│ ... (4 more stages below) ...                             │
│                                                            │
└────────────────────────────────────────────────────────────┘

Per-stage row structure:
[STAGE NAME]          [TOKENS USED]    [Progress bar] [%]
[Duration: Xs Quality: Y.Z/10]
```

---

## Metrics Bar

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  Sources: 156/400  │  Coverage: 92%  │  Quality: 8.7/10  │  Tokens: 45K/ │
│  Token Budget  │  Elapsed: 1m 23s                                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

5 columns:
1. Sources found / target  (e.g., 156/400)
2. Coverage %              (0-100%)
3. Quality score           (0.0-10.0)
4. Token budget            (used/total)
5. Elapsed time            (h:m:s format)
```

---

## Log Viewer

```
┌─ Logs ─────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  🔍 Search logs...                                                   (✕)   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ▼ 12:34:56  [INFO]     Phase 1 research initialized               (📋)   │
│    → Deploying 5 parallel researchers                                     │
│    → Using SearXNG for federated search                                   │
│    → Starting with 20 base queries                                        │
│                                                                             │
│  ▶ 12:35:02  [SUCCESS]  Found 45 sources across 5 domains         (📋)   │
│                                                                             │
│  ▶ 12:35:30  [WARN]     Researcher 3 timeout on reddit.com        (📋)   │
│                                                                             │
│  ▼ 12:36:15  [ERROR]    Compression failed for source #23         (📋)   │
│    error details                                                           │
│    with full stack trace...                                               │
│                                                                             │
│ [auto-scrolling to latest entry] ⬇                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Log entry structure:
[Timestamp] [LEVEL] [Message] (copy icon)
  ▶ Details section (collapsed by default)
  ▼ Details section (expanded, shows full context)

Colors:
- Timestamp: Opacity 50%
- Level: Color-coded (blue/green/amber/red/purple)
- Message: Full opacity
- Icons: Copy (on hover), chevron (expand/collapse)
```

---

## Command Palette (Cmd+K)

```
┌─ Command Palette ──────────────────────────────────────────────────────────┐
│                                                                             │
│  ⌘ Type command or press ESC...                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ⏸ Pause Cycle                                                             │
│  ▶ Resume Cycle                                                            │
│  ⤵ Skip Stage                                                              │
│  ✕ Abort Cycle                                                             │
│  ⬇ Export Report                                                           │
│  ⚙ Open Settings                                                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Shortcuts: Cmd+P • Cmd+S • Cmd+E                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Behavior:
- Click or Enter to execute
- Escape to close
- Search filters in real-time
- Grayed-out commands are disabled
```

---

## Stuck Detection Panel

```
Scenario 1: 5-10 minute warning
┌─ Stuck Detection ──────────────────────────────────────────────────────────┐
│ ⚡ Stuck Detection                                                         │
│ "research" has been running for 7m. Consider skipping or restarting.      │
│                                                                      [Skip] │
└────────────────────────────────────────────────────────────────────────────┘

Scenario 2: 10+ minute critical
┌─ Stuck Detection ──────────────────────────────────────────────────────────┐
│ ⚠ Stuck - Long Running                                                    │
│ "research" has been running for 12m. Recommend abort or skip.             │
│                                                              [Skip][Restart]│
└────────────────────────────────────────────────────────────────────────────┘

Scenario 3: Token budget critical
┌─ Stuck Detection ──────────────────────────────────────────────────────────┐
│ ⚠ Token Budget Critical                                                   │
│ Using 95% of budget. Compress context or skip remaining stages.           │
│                                                              [Skip][Restart]│
└────────────────────────────────────────────────────────────────────────────┘

Scenario 4: Service offline
┌─ Stuck Detection ──────────────────────────────────────────────────────────┐
│ ⚠ Service Offline                                                         │
│ Ollama unreachable. Check connection or pause cycle.                      │
│                                                              [Skip][Restart]│
└────────────────────────────────────────────────────────────────────────────┘

Colors:
- Warning level: Amber background + text
- Error level: Red background + text
- Buttons: Color-matched, clickable
```

---

## Dark Mode vs Light Mode

### Dark Mode (Default)

```
Background:  zinc-950 (#09090b)
Text:        white/[0.87] (rgba(255, 255, 255, 0.87))
Borders:     white/[0.08] (rgba(255, 255, 255, 0.08))
Hover:       white/[0.05] (rgba(255, 255, 255, 0.05))
```

Example:
```
┌─────────────────────────────────────────────────────────────┐
│ Campaign: Collagen Ads        ● RUNNING  1h 23m            │  ← White text
│ Stage: research               Tokens: 45K/75K ▓▓▓░░░       │     on dark bg
└─────────────────────────────────────────────────────────────┘
  ▲ Subtle border
```

### Light Mode

```
Background:  white (#ffffff)
Text:        zinc-900 (#18181b)
Borders:     black/[0.08] (rgba(0, 0, 0, 0.08))
Hover:       black/[0.05] (rgba(0, 0, 0, 0.05))
```

Example:
```
┌─────────────────────────────────────────────────────────────┐
│ Campaign: Collagen Ads        ● RUNNING  1h 23m            │  ← Dark text
│ Stage: research               Tokens: 45K/75K ▓▓▓░░░       │     on light bg
└─────────────────────────────────────────────────────────────┘
  ▲ Subtle border
```

---

## Responsive Behavior

### Full Width (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│ Full-screen terminal (100% viewport width)              │
│                                                         │
│ All components displayed normally                       │
│ - Header spans full width                              │
│ - Stage panel scrolls if >8 stages                      │
│ - Log viewer takes remaining height                     │
└─────────────────────────────────────────────────────────┘
```

### Split View (Paused)

```
┌───────────────────┬───┬───────────────────────────┐
│ Terminal (50%)    │   │ Dashboard (50%)           │
│                   │▬▬▬│                           │
│ All components    │   │ Stage details / output    │
│ normal size       │   │                           │
└───────────────────┴───┴───────────────────────────┘
      ↑ Draggable divider (30%-70% range)
```

---

## Animation & Transitions

### Color Transitions

```
All color changes use CSS transition: 0.3s ease
- Status indicator changes
- Token bar fill updates
- Log level colors
- Hover states
```

### Progress Bars

```
Width changes use transition: all 0.3s ease
- Stage progress bars animate from X% to Y%
- Token budget bar animates smoothly
- Smooth visual feedback during updates
```

### Keyboard Events

```
All keyboard actions have immediate visual feedback:
- Command palette opens/closes instantly
- Log search filters in real-time
- Buttons have :active state feedback
```

### Stuck Detection

```
Panel slides in smoothly with background color
- Warning: Amber background, fades in
- Error: Red background, more prominent
- Removal: Fades out when condition cleared
```

---

## Accessibility Features

### Color Coding

All information conveyed by color also has text labels:
```
● RUNNING       (color: green  + icon + text)
✓ COMPLETE      (color: blue   + icon + text)
⚠ WARNING       (color: amber  + icon + text)
✗ ERROR         (color: red    + icon + text)
```

### Keyboard Navigation

```
Cmd+K  → Command palette (all actions available)
Cmd+P  → Pause/Resume
Cmd+S  → Skip stage
Cmd+E  → Export
Tab    → Navigate between interactive elements (prepared)
Enter  → Execute selected command
Escape → Close modals
```

### Screen Reader Support

```
Semantic HTML used throughout:
<button>  for clickable elements
<label>   for form inputs
<h1-h6>  for heading hierarchy
ARIA labels on status indicators
```

---

## Performance Metrics Display

### Token Budget Visualization

```
Tokens: 15,234/45,000  (33%)  → Green bar     [████░░░░░░░░░░░░░░░░]
Tokens: 27,000/45,000  (60%)  → Green bar     [████████████░░░░░░░░]
Tokens: 36,000/45,000  (80%)  → Amber bar     [████████████████░░░░]
Tokens: 42,750/45,000  (95%)  → Red bar       [████████████████████▓]
```

### Quality Score Display

```
Quality: 0.0/10  → Gray   (Pending)
Quality: 5.5/10  → Amber  (Average)
Quality: 7.8/10  → Green  (Good)
Quality: 9.2/10  → Blue   (Excellent)
```

---

## Footer / Status Bar

```
┌────────────────────────────────────────────────────────────────┐
│ ⌘K Command Palette │ ⌘P Pause │ ⌘S Skip │ ⌘E Export  │ ● OK  │
└────────────────────────────────────────────────────────────────┘

Left: Keyboard shortcuts (4 main actions)
Right: Service health (● Services OK or ● Ollama Offline)
```

---

## Keyboard Shortcut Legend

```
Cmd   = Command key (Mac) or Ctrl (Windows/Linux)
K     = K key
P     = P key
S     = S key
E     = E key

Display in UI: ⌘K (with kbd styling)
```

---

This visual reference matches the actual component implementation exactly. Use this guide to understand layout, colors, and interactions.
