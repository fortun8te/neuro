# Quick Start: Load Monitoring & Model Routing

## 30-Second Overview

The system prevents Ollama overload by:
- Limiting concurrent tasks per model (qwen4b: 8 max, gemma: 1 max)
- Enforcing global cap (15 concurrent tasks total)
- Queueing excess tasks with exponential backoff
- Falling back to lighter models if primary overloaded
- Monitoring GPU memory in real-time

**Result**: No more GPU crashes, no more model overload. System stays stable under high load.

## The Four Files You Need

1. **Config** (`frontend/config/modelRouting.ts`)
   - Model-to-phase mappings
   - Concurrency limits
   - Fallback definitions

2. **Core Service** (`frontend/services/loadMonitor.ts`)
   - Tracks active tasks
   - Manages queue
   - Enforces limits

3. **Fallback Manager** (`frontend/services/modelFallback.ts`)
   - Retries with backoff
   - Falls back to secondary model

4. **Ollama Integration** (`frontend/utils/ollama.ts`)
   - Now includes load monitoring
   - No changes needed for callers

## Copy-Paste Examples

### Check if Model Has Capacity
```typescript
import { loadMonitor } from 'frontend/services/loadMonitor';

const check = await loadMonitor.checkAvailability('qwen3.5:4b');
if (!check.available) {
  console.log(`Unavailable: ${check.reason}`);
  // → "Model at capacity (8/8)"
}
```

### Wait for Capacity (with timeout)
```typescript
import { loadMonitor } from 'frontend/services/loadMonitor';

try {
  await loadMonitor.waitForCapacity('qwen3.5:4b', 300_000); // 5 min
  console.log('Capacity available!');
} catch (err) {
  console.log('Timeout or queue full');
}
```

### Get Current Load Status
```typescript
import { loadMonitor } from 'frontend/services/loadMonitor';

const status = loadMonitor.getStatus();
console.log(`Global: ${status.global.activeTasks}/${status.global.globalMax}`);
// → "Global: 8/15"

status.global.perModel.forEach(m => {
  console.log(`${m.model}: ${m.activeTasks}/${m.maxConcurrency}`);
});
// → "qwen3.5:4b: 6/8"
// → "qwen3.5:9b: 2/3"
```

### Show Live Load Status (CLI)
```typescript
import { showLoadStatus } from 'frontend/cli/loadMonitorCli';

// Show live status for 30 seconds
await showLoadStatus({ intervalMs: 1000, durationMs: 30_000 });

// Or one-liner
console.log(loadMonitor.getCliStatus());
// → "Active: 8/15 (53%) Qwen4b: 6/8, Qwen9b: 2/3"
```

### Ollama Service (No Changes!)
```typescript
import { ollamaService } from 'frontend/utils/ollama';

// Load monitor is automatic — no code changes
const response = await ollamaService.generateStream(
  'Hello',
  'System prompt',
  { model: 'qwen3.5:4b' }
);
// Internally queues if at capacity ✓
```

### Select Best Model (with Fallback)
```typescript
import { modelFallback } from 'frontend/services/modelFallback';

const decision = await modelFallback.selectWithFallback(
  'research',
  'qwen3.5:4b'
);

console.log(`Using ${decision.selectedModel}`);
console.log(`Reason: ${decision.reason}`);
// → "qwen3.5:2b"
// → "fallback-used" (if primary was full)
```

### Check Before Starting Expensive Operation
```typescript
import { assertCapacityAvailable } from 'frontend/cli/loadMonitorCli';

try {
  assertCapacityAvailable(30); // Need 30% free
  // Safe to proceed
} catch (err) {
  console.log(`Can't proceed: ${err.message}`);
}
```

### Wait Until Load Drops (CLI Tool)
```typescript
import { waitForCapacity } from 'frontend/cli/loadMonitorCli';

// Block until ≤50% utilization (max 2 min wait)
await waitForCapacity(50, 120_000);
console.log('Load dropped, proceeding');
```

### Override Model for Testing
```typescript
import { setModelOverride } from 'frontend/utils/modelSelector';

setModelOverride('qwen3.5:2b'); // Force light model
// ... run tests ...
setModelOverride(null); // Clear
```

## Concurrency Limits at a Glance

```
Global Max: 15 concurrent tasks

Per-Model Limits:
  qwen3.5:2b  → 16  (tiny)
  qwen3.5:4b  →  8  (standard)
  qwen3.5:9b  →  3  (quality)
  gemma4:e31b →  1  (expensive)

Queue Settings:
  Max queued:    50 tasks
  Max wait:      5 minutes
  Initial backoff: 100ms
  Max backoff:   10s
  Multiplier:    1.5x
```

## Status Display Examples

### Healthy
```
✓ Global: 5/15 (33%)
  ✓ Qwen4b: 4/8 (50%)
  ✓ Qwen9b: 1/3 (33%)
```

### Warning (>85% utilization)
```
⚠ Global: 13/15 (87%)
  ⚠ Qwen4b: 8/8 (100%)
  ✓ Qwen9b: 1/3 (33%)
```

### At Capacity (100%)
```
🔴 Global: 15/15 (100%)
  🔴 Qwen4b: 8/8 (100%)
  🔴 Qwen9b: 3/3 (100%)
  ⚠️  At capacity — new tasks will be queued
```

## Integration Points

### In CLI Commands
```typescript
// At command start
const status = loadMonitor.getStatus();
if (status.global.status === 'at-capacity') {
  console.warn('System at capacity, queueing task');
}

// During long-running task
const interval = setInterval(
  () => console.log(loadMonitor.getCliStatus()),
  5000
);

// After completion
clearInterval(interval);
```

### In React Components
```typescript
import { useEffect, useState } from 'react';
import { loadMonitor } from 'frontend/services/loadMonitor';

export function LoadIndicator() {
  const [status, setStatus] = useState(loadMonitor.getStatus());

  useEffect(() => {
    const interval = setInterval(
      () => setStatus(loadMonitor.getStatus()),
      1000
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      Active: {status.global.activeTasks}/{status.global.globalMax}
      ({status.global.utilizationPercent}%)
    </div>
  );
}
```

## Troubleshooting

### "Model at capacity (8/8)"
- Wait 10-30 seconds for current tasks to complete
- Or switch to fallback model (automatically happens with modelFallback)

### "Queue full (50/50)"
- System is severely overloaded
- Check what's running: `loadMonitor.getStatus()`
- Wait for tasks to complete or restart Ollama

### "Task exceeded max wait time (300000ms)"
- Task waited 5 minutes but still no capacity
- Try: restart Ollama, reduce concurrency limits, or increase hardware

### "Both primary and fallback at capacity"
- Even fallback model is full
- Check: Are there hung tasks? 
- Command: `ollamaService.getLoadedModels()`
- Solution: Restart Ollama

## Performance Tips

### For Maximum Throughput
```typescript
// Use lighter models
selectModel({ phase: 'researcher' }) // Uses qwen4b with fallback to qwen2b

// Reduce context window
{ model: 'qwen3.5:4b', num_ctx: 2048 } // Lower VRAM per task
```

### For Lower Latency
```typescript
// Check capacity first
await assertCapacityAvailable(25); // Need 25% free

// Use lightweight model
setModelOverride('qwen3.5:2b');
```

### For Reliability
```typescript
// Use graceful fallback
const decision = await modelFallback.selectWithFallback(
  'research',
  'qwen3.5:4b'
);

// Always wait with timeout
await waitForCapacity(70, 60_000); // Wait max 1 min for ≤70% load
```

## Files to Know

| File | Purpose |
|------|---------|
| `frontend/config/modelRouting.ts` | Configuration: limits, models, tiers |
| `frontend/services/loadMonitor.ts` | Core: task tracking, queueing |
| `frontend/services/modelFallback.ts` | Fallback: retry with degradation |
| `frontend/utils/modelSelector.ts` | Selection: smart model picking |
| `frontend/utils/ollama.ts` | Integration: built-in monitoring |
| `frontend/cli/loadMonitorCli.ts` | CLI: monitoring and display |
| `frontend/docs/MODEL_ROUTING_GUIDE.md` | Full documentation |
| `frontend/tests/loadMonitor.test.ts` | Test suite |

## Next Steps

1. **For Monitoring**: Use `loadMonitor.getStatus()` in dashboards
2. **For Safety**: Call `assertCapacityAvailable()` before expensive ops
3. **For Stability**: Let Ollama service handle queueing automatically
4. **For Debugging**: Check `getCliStatus()` or `getDetailedReport()`

That's it! The system is automatic once configured.
