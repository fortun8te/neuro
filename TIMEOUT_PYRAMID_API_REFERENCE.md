# Timeout Pyramid API Reference

## Core Module: `src/utils/stageTimeouts.ts`

### Types

```typescript
export type StageName =
  | 'research' | 'brand-dna' | 'persona-dna'
  | 'angles' | 'strategy' | 'copywriting'
  | 'production' | 'test';

export class TimeoutError extends Error {
  public stageName: StageName;
  public timeoutMs: number;
  constructor(stageName: StageName, timeoutMs: number);
}
```

### Constants

```typescript
export const STAGE_TIMEOUTS: Record<StageName, number> = {
  research: 120_000,      // 2 min
  'brand-dna': 45_000,    // 45 sec
  'persona-dna': 45_000,  // 45 sec
  angles: 30_000,         // 30 sec
  strategy: 30_000,       // 30 sec
  copywriting: 30_000,    // 30 sec
  production: 60_000,     // 1 min
  test: 30_000,           // 30 sec
};
```

### Functions

#### `withTimeout<T>(promise, timeoutMs, stageName?, signal?): Promise<T>`

Wraps a promise with timeout protection.

**Parameters:**
- `promise: Promise<T>` — The promise to protect
- `timeoutMs: number` — Timeout duration in milliseconds
- `stageName?: string` — Name of the stage (for error messages)
- `signal?: AbortController` — Optional controller to abort on timeout

**Returns:** `Promise<T>` — Result of promise or TimeoutError

**Example:**
```typescript
try {
  const result = await withTimeout(
    generateAd(campaign),
    30_000,
    'production',
    abortController
  );
} catch (err) {
  if (err instanceof TimeoutError) {
    console.log(`${err.stageName} timed out after ${err.timeoutMs}ms`);
  }
}
```

#### `getTimeRemaining(startedAt, timeoutMs): TimeRemainingData`

Calculate remaining time for a running stage.

**Parameters:**
- `startedAt: number` — Stage start timestamp (Date.now())
- `timeoutMs: number` — Total timeout duration in milliseconds

**Returns:**
```typescript
{
  remaining: number;              // Remaining milliseconds
  isExpired: boolean;             // true if remaining === 0
  percentElapsed: number;         // 0-100 percentage elapsed
  elapsedSeconds: number;         // Math.floor(elapsed / 1000)
  remainingSeconds: number;       // Math.floor(remaining / 1000)
}
```

**Example:**
```typescript
const data = getTimeRemaining(stage.startedAt, STAGE_TIMEOUTS['research']);
console.log(`${data.remainingSeconds} seconds left`);  // "45 seconds left"
console.log(`${data.percentElapsed}% done`);          // "75% done"
```

#### `formatTimeRemaining(remaining, isWarning?): string`

Format time as human-readable string.

**Parameters:**
- `remaining: number` — Remaining milliseconds
- `isWarning?: boolean` — If true, use urgent language for critical timeouts

**Returns:** `string`

**Examples:**
```typescript
formatTimeRemaining(45000);         // "45 sec remaining"
formatTimeRemaining(5000, true);    // "Timeout in 5 seconds..."
formatTimeRemaining(0);             // "Time expired"
formatTimeRemaining(120000);        // "2 min remaining"
```

#### `getGracefulDegradationStrategy(stageName): DegradationStrategy`

Get fallback strategy if stage times out.

**Parameters:**
- `stageName: StageName` — The stage that timed out

**Returns:**
```typescript
{
  action: string;      // Primary fallback action
  fallback?: string;   // Secondary fallback if primary fails
}
```

**Example:**
```typescript
const strategy = getGracefulDegradationStrategy('research');
// {
//   action: 'Use partial research results collected so far',
//   fallback: 'Continue with prior cycle memories if available'
// }
```

#### `logTimeoutEvent(stageName, timeoutMs, elapsed, degradationStrategy): void`

Log a timeout event for debugging and analytics.

**Parameters:**
- `stageName: StageName` — Stage that timed out
- `timeoutMs: number` — Configured timeout in ms
- `elapsed: number` — Actual elapsed time in ms
- `degradationStrategy: string` — Strategy applied

**Console Output:**
```
[TimeoutPyramid] Stage timeout occurred: {
  timestamp: "2026-04-01T12:34:56.789Z",
  stageName: "research",
  timeoutMs: 120000,
  elapsedMs: 125234,
  elapsedSeconds: 125,
  overageMs: 5234,
  overageSeconds: 5,
  degradationStrategy: "Use partial research results..."
}
```

#### `isTimeoutPyramidEnabled(): boolean`

Check if timeout pyramid feature is enabled.

**Returns:** `boolean`

**Checks (in order):**
1. localStorage.getItem('timeout_pyramid_enabled')
2. import.meta.env.VITE_TIMEOUT_PYRAMID_ENABLED
3. Default: false

**Example:**
```typescript
if (isTimeoutPyramidEnabled()) {
  // Wrap stage with timeout
  await withTimeout(stage, STAGE_TIMEOUTS[stageName], stageName);
} else {
  // Execute without timeout protection
  await stage;
}
```

#### `setTimeoutPyramidEnabled(enabled: boolean): void`

Enable or disable timeout pyramid at runtime.

**Parameters:**
- `enabled: boolean` — true to enable, false to disable

**Persists to:** localStorage ('timeout_pyramid_enabled')

**Example:**
```typescript
// User toggles in Settings
setTimeoutPyramidEnabled(true);    // Save to localStorage
window.location.reload();            // Optional: reload app
```

---

## UI Component: `src/components/TimeoutCountdown.tsx`

### TimeoutCountdown

Live countdown display for active stages.

**Props:**
```typescript
interface TimeoutCountdownProps {
  stageName: StageName;           // e.g., 'research'
  stage: StageData;               // Current stage data
  isRunning: boolean;             // Is cycle running?
}
```

**Renders:**
- Stage name + remaining time
- Progress bar (fills as time elapses)
- Color: Green → Yellow → Red
- Critical warning at ≤5 sec

**Example:**
```typescript
<TimeoutCountdown
  stageName="research"
  stage={cycle.stages.research}
  isRunning={isRunning}
/>
```

**Output:**
```
┌─────────────────────────────────┐
│ Research    45 sec remaining    │
│ [████████████░░░░░░░░░░░░░░░░] │
└─────────────────────────────────┘
```

### TimeoutCountdownContainer

Wrapper that conditionally renders countdown.

**Props:**
```typescript
interface TimeoutCountdownsProps {
  stageName: StageName;
  stage: StageData;
  isRunning: boolean;
  isEnabled: boolean;             // Feature flag
}
```

**Example:**
```typescript
<TimeoutCountdownContainer
  stageName={cycle.currentStage}
  stage={cycle.stages[cycle.currentStage]}
  isRunning={isRunning}
  isEnabled={isTimeoutPyramidEnabled()}
/>
```

---

## Integration: `src/hooks/useCycleLoop.ts`

### Timeout Wrapping Pattern

```typescript
import { withTimeout, STAGE_TIMEOUTS, TimeoutError, isTimeoutPyramidEnabled, getGracefulDegradationStrategy, logTimeoutEvent } from '../utils/stageTimeouts';

// In runCycle loop:
const timeoutEnabled = isTimeoutPyramidEnabled();
const timeout = STAGE_TIMEOUTS[stageName];

if (timeoutEnabled && timeout) {
  try {
    await withTimeout(
      executeStage(cycle, stageName, campaign, signal),
      timeout,
      stageName,
      new AbortController()
    );
  } catch (timeoutErr) {
    if (timeoutErr instanceof TimeoutError) {
      const elapsed = Date.now() - cycle.stages[stageName].startedAt!;
      const strategy = getGracefulDegradationStrategy(stageName);
      logTimeoutEvent(stageName, timeout, elapsed, strategy.action);

      // Graceful degradation
      const stage = cycle.stages[stageName];
      stage.status = 'complete';
      stage.completedAt = Date.now();
      stage.agentOutput += `\n[TIMEOUT] ...with partial results.`;

      // Continue to next stage
    } else {
      throw timeoutErr;
    }
  }
} else {
  // No timeout protection
  await executeStage(cycle, stageName, campaign, signal);
}
```

---

## Settings Integration: `src/components/SettingsModal.tsx`

### Pipeline Tab

New tab in SettingsModal for timeout pyramid settings.

**Features:**
- Toggle switch: "Timeout Pyramid"
- Info card: Shows all stage timeouts
- Persists to localStorage

**Usage:**
```typescript
// In SettingsModal
const [timeoutPyramidEnabled, setTimeoutPyramidState] = useState(() => isTimeoutPyramidEnabled());

// On toggle
const newState = !timeoutPyramidEnabled;
setTimeoutPyramidState(newState);
setTimeoutPyramidEnabled(newState);
```

---

## Environment Variables

### VITE_TIMEOUT_PYRAMID_ENABLED

Enable timeout pyramid at startup via env var.

**Usage:**
```bash
export VITE_TIMEOUT_PYRAMID_ENABLED=true
npm run dev
```

**Checked in:** `isTimeoutPyramidEnabled()`

---

## Error Handling

### TimeoutError

Thrown when stage exceeds timeout.

```typescript
try {
  await withTimeout(stage, timeoutMs, stageName);
} catch (err) {
  if (err instanceof TimeoutError) {
    console.log(`${err.stageName} timed out after ${err.timeoutMs}ms`);
    // Apply graceful degradation
  } else {
    // Other error
    throw err;
  }
}
```

### Console Logging

When timeout occurs:

```
[TimeoutPyramid] Stage "research" timed out after 120000ms.
Strategy: Use partial research results collected so far
Fallback: Continue with prior cycle memories if available
```

Event log structure:
```typescript
{
  timestamp: string;              // ISO 8601
  stageName: StageName;
  timeoutMs: number;
  elapsedMs: number;
  elapsedSeconds: number;
  overageMs: number;
  overageSeconds: number;
  degradationStrategy: string;
}
```

---

## Testing

### Test File: `src/utils/__tests__/stageTimeouts.test.ts`

Comprehensive test suite covering:
- `withTimeout` resolve/reject
- `TimeoutError` construction
- `STAGE_TIMEOUTS` config
- `getTimeRemaining` calculations
- `formatTimeRemaining` formatting
- `getGracefulDegradationStrategy` strategies
- Feature flag toggle

**Run:**
```bash
# In browser console
import { runAllTests } from '../utils/__tests__/stageTimeouts.test.ts';
runAllTests();
```

---

## Quick Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `withTimeout(p, ms, name, sig)` | Wrap promise with timeout | Promise<T> or TimeoutError |
| `getTimeRemaining(start, ms)` | Calculate remaining time | TimeRemainingData |
| `formatTimeRemaining(ms)` | Human-readable string | "45 sec remaining" |
| `getGracefulDegradationStrategy(stage)` | Fallback strategy | {action, fallback} |
| `logTimeoutEvent(...)` | Log for debugging | void |
| `isTimeoutPyramidEnabled()` | Check feature flag | boolean |
| `setTimeoutPyramidEnabled(bool)` | Toggle feature flag | void |

---

## Migration Guide (for Vite projects)

To use Timeout Pyramid in another React/Vite project:

1. **Copy files:**
   ```
   src/utils/stageTimeouts.ts
   src/components/TimeoutCountdown.tsx
   ```

2. **Import timeout utilities:**
   ```typescript
   import { withTimeout, STAGE_TIMEOUTS, TimeoutError, isTimeoutPyramidEnabled } from '../utils/stageTimeouts';
   ```

3. **Wrap your async operations:**
   ```typescript
   await withTimeout(asyncFunction(), STAGE_TIMEOUTS.research, 'research');
   ```

4. **Add UI (optional):**
   ```typescript
   import { TimeoutCountdownContainer } from '../components/TimeoutCountdown';
   ```

5. **Add feature flag toggle to settings**

---

**Last Updated:** 2026-04-01
**Status:** Production Ready
**Version:** 1.0
