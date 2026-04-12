# Model Routing & Load Management Guide

## Overview

The Model Routing and Load Management system prevents Ollama/Llama overload through:

1. **Per-model concurrency limits** — Each model has a max concurrent task limit
2. **Global concurrency cap** — Hard limit of 15 concurrent tasks across all models
3. **Intelligent queueing** — Exponential backoff queue with 50-task limit
4. **GPU memory monitoring** — Health checks via Ollama `/api/ps` endpoint
5. **Graceful degradation** — Automatic fallback to secondary models
6. **Real-time monitoring** — CLI status display and metrics

## Architecture

### Core Services

#### `frontend/config/modelRouting.ts`
- **MODEL_ROUTING**: Phase-to-model mappings with fallbacks
  - `planner`: gemma4:e31b (1 concurrent)
  - `researcher`: qwen3.5:4b (8 concurrent)
  - `reflector`: qwen3.5:4b (2 concurrent)
  - `critic`: qwen3.5:4b (2 concurrent)
  - `synthesizer`: qwen3.5:9b (1 concurrent)

- **CONCURRENCY_LIMITS**: Global config
  - `globalMax`: 15 total concurrent tasks
  - `perModel`: Per-model limits (qwen4b: 8, qwen9b: 3, etc.)
  - `queueMaxSize`: 50 pending tasks max
  - `backoffMs`: Initial 100ms, max 10s, 1.5x multiplier

- **MODEL_TIERS**: Preset quality/speed tradeoffs
  - light: qwen2b + qwen2b
  - standard: qwen2b + qwen4b (DEFAULT)
  - quality: qwen4b + qwen9b
  - maximum: qwen9b + qwen27b

#### `frontend/services/loadMonitor.ts`
Singleton service managing load state and queueing.

**Key Methods:**
- `checkAvailability(model)` — Async check if model has capacity
- `waitForCapacity(model, maxWaitMs)` — Block until model capacity available
- `recordTask(model)` — Mark task as started, return taskId
- `releaseTask(model, taskId)` — Mark task as complete
- `getModelLoad(model)` — Current load 0-100%
- `getGlobalLoad()` — Global load 0-100%
- `getStatus()` — Detailed per-model status
- `getCliStatus()` — Human-readable status string

**Queue Processing:**
- FIFO queue, processed when capacity freed
- Exponential backoff: 100ms → 150ms → 225ms → 337ms → 500ms → 750ms → 1s → 10s
- Max 50 pending tasks before rejecting new ones
- 5-minute max wait per task

#### `frontend/services/modelFallback.ts`
Graceful degradation when models unavailable.

**Key Methods:**
- `selectWithFallback(role, preferredModel)` — Select best model with retries
  1. Try primary with backoff (2s, 4s, 8s retries)
  2. Use fallback if primary capacity exhausted
  3. Cache decision for 1 minute to avoid repeated checks

#### `frontend/utils/modelSelector.ts`
High-level model selection with overrides and fallbacks.

**Key Methods:**
- `selectModel(options)` — Async selection with availability check
- `getPhaseModel(phase)` — Sync model lookup
- `getAllConfiguredModels()` — List all available models
- `getModelConcurrencyLimit(model)` — Get model's task limit

#### `frontend/utils/ollama.ts` (Updated)
Integrated loadMonitor lifecycle:
1. Before request: `await loadMonitor.waitForCapacity(model)`
2. At start: `taskId = loadMonitor.recordTask(model)`
3. At completion/error: `loadMonitor.releaseTask(model, taskId)`

#### `frontend/cli/loadMonitorCli.ts`
CLI integration for real-time monitoring.

**Key Functions:**
- `formatLoadStatus(status)` — Pretty-print status
- `getCliStatusString()` — One-liner status
- `showLoadStatus()` — Continuous monitoring display
- `logLoadStatus()` — Log to logger
- `assertCapacityAvailable()` — Precondition check
- `waitForCapacity()` — Block until load drops
- `getDetailedReport()` — Full report text

## Usage Examples

### Example 1: Basic Model Selection

```typescript
import { selectModel } from 'frontend/utils/modelSelector';

// Select model for a phase with availability check
const selection = await selectModel({
  phase: 'researcher',
  allowUnavailable: false,
});

console.log(`Using model: ${selection.model} (load: ${selection.load}%)`);
// Output: Using model: qwen3.5:4b (load: 62%)
```

### Example 2: Integrated with Ollama Service

```typescript
import { ollamaService } from 'frontend/utils/ollama';

// Load monitor is automatically integrated
const response = await ollamaService.generateStream(
  'What is the capital of France?',
  'You are a helpful assistant.',
  {
    model: 'qwen3.5:4b',
    // ... other options
  }
);
// Internally:
// 1. await loadMonitor.waitForCapacity('qwen3.5:4b')
// 2. taskId = loadMonitor.recordTask('qwen3.5:4b')
// 3. ... perform inference ...
// 4. loadMonitor.releaseTask('qwen3.5:4b', taskId)
```

### Example 3: Graceful Degradation

```typescript
import { modelFallback } from 'frontend/services/modelFallback';

// Automatically falls back to secondary model with retries
const decision = await modelFallback.selectWithFallback(
  'research',
  'qwen3.5:4b' // preferred
);

console.log(`Using ${decision.selectedModel} (retries: ${decision.retryCount})`);
// If qwen4b is at capacity:
//   - Try 3 times (wait 2s, 4s, 8s between)
//   - After 30s max wait, use fallback (qwen2b)
// Output: Using qwen3.5:2b (retries: 3)
```

### Example 4: Load Monitoring in CLI

```typescript
import { showLoadStatus, getCliStatusString } from 'frontend/cli/loadMonitorCli';

// Show continuous monitoring for 30 seconds
await showLoadStatus({ intervalMs: 1000, durationMs: 30_000 });

// Or get one-liner status
console.log(getCliStatusString());
// Output: Active: 8/15 (53%) Qwen4b: 6/8, Qwen9b: 2/3, Gemma: 0/1
```

### Example 5: Precondition Check

```typescript
import { assertCapacityAvailable, waitForCapacity } from 'frontend/cli/loadMonitorCli';

// Assert at least 25% capacity is free
try {
  assertCapacityAvailable(25);
  console.log('Capacity sufficient');
} catch (e) {
  console.log(`Error: ${e.message}`);
  // Error: Insufficient capacity: 10% available, need 25%. ...
}

// Or wait for capacity to drop below threshold
await waitForCapacity(50, 120_000); // Wait max 2 minutes for ≤50% load
console.log('Capacity available, proceeding with task');
```

### Example 6: Override for Testing

```typescript
import { setModelOverride } from 'frontend/utils/modelSelector';

// Force all model selections to use a specific model
setModelOverride('qwen3.5:2b');

const selection = await selectModel({ phase: 'synthesizer' });
console.log(selection.model); // Output: qwen3.5:2b (regardless of phase)

// Clear override
setModelOverride(null);
```

## Concurrency Limits Reference

| Model | Limit | Memory | Reason |
|-------|-------|--------|--------|
| `qwen3.5:2b` | 16 | 1GB | Tiny, can handle high concurrency |
| `qwen3.5:4b` | 8 | 3GB | Good balance, primary researcher |
| `qwen3.5:9b` | 3 | 8GB | Medium, quality model |
| `qwen3.5:27b` | 1 | 18GB | Massive, single-threaded |
| `gemma4:e31b` | 1 | 31GB | Very expensive, single-threaded |
| `nemotron-3-super:120b` | 1 | 120GB | Massive, production only |
| **GLOBAL** | **15** | — | Hard cap across all models |

## Load Status Levels

| Status | Global Utilization | Meaning | Action |
|--------|-------------------|---------|--------|
| **healthy** | 0-84% | Normal operation | Continue |
| **capacity-warning** | 85-99% | Nearing capacity | Consider reducing load |
| **at-capacity** | 100% | Full | Queue new tasks, wait |
| **overloaded** | >100% | Error state | Check for deadlock |

## Preventing Overload: Design Patterns

### Pattern 1: Fail-Safe Default

```typescript
// Always provide a fallback model
const routingConfig = {
  researcher: {
    model: 'qwen3.5:4b',
    maxConcurrency: 8,
    fallbackModel: 'qwen3.5:2b', // ← Always set
    timeout: 30_000,
  },
};
```

### Pattern 2: Pre-Flight Checks

```typescript
// Check capacity before starting expensive operations
await assertCapacityAvailable(20); // Need 20% free
const result = await expensiveOperation();
```

### Pattern 3: Graceful Queue Management

```typescript
// Queue tasks intelligently, not fire-and-forget
try {
  await loadMonitor.waitForCapacity(model, 300_000); // Wait max 5 min
  // Task now guaranteed to fit
} catch (queueErr) {
  // Queue full or timeout — reject task politely
  return { error: 'System overloaded, try again later' };
}
```

### Pattern 4: Monitoring During Operations

```typescript
// Show live load while task runs
import { logLoadStatus } from 'frontend/cli/loadMonitorCli';

const interval = setInterval(logLoadStatus, 5000); // Every 5s
try {
  await longRunningTask();
} finally {
  clearInterval(interval);
}
```

## Troubleshooting

### "Model at capacity (8/8)"

The model has reached its concurrency limit. Options:
1. Wait for existing tasks to complete (typically 30-60s)
2. Use a lighter fallback model (qwen2b instead of qwen4b)
3. Reduce num_ctx to lower VRAM usage per task
4. Check if any tasks are hung: `ollamaService.getLoadedModels()`

### "Queue full (50/50)"

Too many tasks pending. System is severely overloaded.
- Stop submitting new tasks
- Monitor load with `showLoadStatus()`
- Increase timeouts if tasks are completing slowly
- Consider restarting Ollama if it's hung

### Global capacity stuck at 100%

Possible deadlock or hung task.
1. Check `loadMonitor.getStatus().perModel` for which model is stuck
2. If model is hung, restart Ollama: `ollamaService.unloadModel(modelName)`
3. Review logs for errors in task cleanup

### High GPU memory but low utilization?

Some models keep loaded in VRAM (via `keep_alive` setting).
1. Check `ollamaService.getLoadedModels()` for resident models
2. Unload unused models: `ollamaService.unloadModel(model)`
3. Reduce `keep_alive` timeout in preload config

## Monitoring Dashboard Integration

For a React component showing real-time load:

```typescript
import { useEffect, useState } from 'react';
import { loadMonitor } from 'frontend/services/loadMonitor';

export function LoadStatusWidget() {
  const [status, setStatus] = useState(loadMonitor.getStatus());

  useEffect(() => {
    const interval = setInterval(
      () => setStatus(loadMonitor.getStatus()),
      1000 // Update every second
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h3>Load Monitor</h3>
      <p>Global: {status.global.activeTasks}/{status.global.globalMax}</p>
      <div>
        {status.global.perModel.map((m) => (
          <div key={m.model}>
            {m.model}: {m.activeTasks}/{m.maxConcurrency}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Performance Tuning

### For throughput (maximize tasks):
- Increase per-model limits (carefully)
- Use smaller context windows (num_ctx: 2048)
- Use lighter models where possible (qwen2b vs qwen4b)

### For latency (fastest individual responses):
- Decrease per-model limits
- Reduce global max
- Increase timeouts (task might wait in queue longer)

### For reliability (fewest failures):
- Keep limits conservative
- Use graceful fallbacks
- Monitor and alert on queue depth

## Integration Checklist

- [ ] Import loadMonitor in ollama.ts
- [ ] Add waitForCapacity() before requests
- [ ] Track taskId with recordTask()
- [ ] Release task in finally block
- [ ] Test with --show-load flag
- [ ] Monitor queue depth in production
- [ ] Set up alerts for at-capacity events
- [ ] Document fallback models in runbooks
- [ ] Train team on load patterns

## References

- `/frontend/config/modelRouting.ts` — Configuration
- `/frontend/services/loadMonitor.ts` — Core load tracking
- `/frontend/services/modelFallback.ts` — Fallback logic
- `/frontend/utils/modelSelector.ts` — Model selection
- `/frontend/cli/loadMonitorCli.ts` — CLI integration
- `/frontend/utils/ollama.ts` — Ollama service integration
