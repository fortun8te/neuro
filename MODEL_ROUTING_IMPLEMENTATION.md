# Model Routing & Load Management Implementation

## Summary

A comprehensive Model Routing and Load Management system has been implemented to prevent Ollama/Llama GPU overload. This system provides intelligent concurrency control, graceful degradation, and real-time monitoring.

## What Was Implemented

### 1. Core Configuration (`frontend/config/modelRouting.ts`)
- **MODEL_ROUTING**: Phase-to-model mappings with explicit fallbacks
  - planner → gemma4:e31b (fallback: qwen3.5:9b)
  - researcher → qwen3.5:4b (fallback: qwen3.5:2b)
  - reflector → qwen3.5:4b (fallback: qwen3.5:2b)
  - critic → qwen3.5:4b (fallback: qwen3.5:2b)
  - synthesizer → qwen3.5:9b (fallback: qwen3.5:4b)

- **CONCURRENCY_LIMITS**: Global configuration
  - globalMax: 15 total concurrent tasks (hard cap)
  - perModel: Fine-grained limits (qwen4b: 8, qwen9b: 3, gemma: 1, etc.)
  - queueMaxSize: 50 pending tasks before rejection
  - backoffMs: Exponential backoff (100ms → 10s with 1.5x multiplier)
  - memoryPerModel: VRAM requirements per model

- **MODEL_TIERS**: One-click quality/speed presets
  - light: Minimum VRAM (qwen2b + qwen2b)
  - standard: Good balance (qwen2b + qwen4b) — DEFAULT
  - quality: Higher quality (qwen4b + qwen9b)
  - maximum: Best quality (qwen9b + qwen27b)

- **TypeScript Types**: LoadStatus, ModelLoadStatus, GlobalLoadStatus for monitoring

### 2. Load Monitoring Service (`frontend/services/loadMonitor.ts`)
Singleton service managing concurrency and queueing.

**Key Features:**
- Tracks active tasks per model and globally
- Enforces per-model concurrency limits with blocking
- Implements FIFO queue with exponential backoff
- Monitors GPU memory via Ollama health endpoint
- Processes queue automatically when capacity freed
- 5-minute max wait per queued task
- Cache-aware (GPU check cached for 5 seconds)

**Public API:**
```typescript
// Check if model has capacity (non-blocking)
await loadMonitor.checkAvailability(model)

// Wait for capacity with queueing
await loadMonitor.waitForCapacity(model, maxWaitMs)

// Record task lifecycle
const taskId = loadMonitor.recordTask(model)
loadMonitor.releaseTask(model, taskId)

// Get metrics
loadMonitor.getModelLoad(model)        // 0-100%
loadMonitor.getGlobalLoad()             // 0-100%
loadMonitor.getStatus()                 // Detailed status object
loadMonitor.getCliStatus()              // Human-readable string
```

### 3. Graceful Degradation (`frontend/services/modelFallback.ts`)
Automatic fallback when primary models unavailable.

**Key Features:**
- Retries with exponential backoff (2s, 4s, 8s)
- Falls back to secondary model after retries
- Caches fallback decisions for 1 minute
- Logs which model was used and why
- Continues processing even if both primary and fallback at capacity

**Public API:**
```typescript
const decision = await modelFallback.selectWithFallback(role, preferredModel)
// Returns: { preferredModel, selectedModel, reason, retryCount, totalWaitMs }

modelFallback.clearCache()  // For testing
modelFallback.getCacheStatus()  // Debugging
```

### 4. Model Selector (`frontend/utils/modelSelector.ts`)
High-level model selection with availability checks.

**Key Features:**
- Selection priority: override → phase routing → role config → fallback
- Async availability checking
- Global model override for testing (setModelOverride)
- Validates model names against configured set
- Provides memory and concurrency info per model

**Public API:**
```typescript
const selection = await selectModel({
  phase: 'researcher',
  modelOverride: 'qwen3.5:2b',  // optional
  allowUnavailable: false,
})
// Returns: { model, reason, isAvailable, load }

getPhaseModel(phase)             // Sync lookup
getAllConfiguredModels()         // Get available models
isValidModel(model)              // Check if configured
getModelMemoryRequired(model)    // Get VRAM requirement
getModelConcurrencyLimit(model)  // Get task limit
```

### 5. Ollama Service Integration (`frontend/utils/ollama.ts`)
Load monitor integrated into generateStream() lifecycle.

**Changes:**
1. Before request: `await loadMonitor.waitForCapacity(model, 300_000)` (5-min timeout)
2. At start: `taskId = loadMonitor.recordTask(model)` (record task)
3. On success: `loadMonitor.releaseTask(model, taskId)` (free capacity)
4. On error: `loadMonitor.releaseTask(model, taskId)` (free capacity, then throw)
5. On abort: `loadMonitor.releaseTask(model, taskId)` (free capacity, then rethrow)

**Guarantees:**
- Task capacity always released (in finally-like pattern)
- No task leaks even on errors
- Integration transparent to callers

### 6. CLI Monitoring (`frontend/cli/loadMonitorCli.ts`)
Real-time load monitoring for command-line interfaces.

**Key Functions:**
```typescript
// Formatting
formatLoadStatus(status)        // Pretty-print with symbols
getCliStatusString()            // One-liner status

// Monitoring
await showLoadStatus({ intervalMs: 1000, durationMs: 30_000 })
logLoadStatus()                 // Log to logger

// Precondition checks
assertCapacityAvailable(25)     // Throw if <25% free
await waitForCapacity(50, 120_000)  // Block until ≤50% load

// Reporting
getDetailedReport()             // Full text report

// CLI integration
hasShowLoadFlag(args)           // Check --show-load flag
getLoadWatchDuration(args)      // Parse --load-watch 30000
```

**Example Output:**
```
✓ Active: 8/15 (53%)
  ✓ Qwen4b: 6/8 (75%)
  ✓ Qwen9b: 2/3 (67%)
  ✓ Gemma: 0/1 (0%)
```

### 7. Tests (`frontend/tests/loadMonitor.test.ts`)
Comprehensive test suite covering:
- Task recording and release
- Capacity checking per model and globally
- Queue management with timeouts
- Load calculations
- Status reporting
- Edge cases (nonexistent models, tasks, etc.)

## Key Design Patterns

### Pattern 1: Prevent Overload by Design
```typescript
// Global cap at 15 concurrent tasks ensures GPU never gets >15 inference requests
const globalMax = 15;

// Per-model limits respect model VRAM:
// gemma4:e31b (31GB) → 1 concurrent
// qwen3.5:4b (3GB) → 8 concurrent
// qwen3.5:2b (1GB) → 16 concurrent
```

### Pattern 2: Intelligent Queueing
```typescript
// Exponential backoff prevents thundering herd:
// Try immediately (0ms)
// Wait 100ms, retry
// Wait 150ms, retry
// Wait 225ms, retry
// ... up to 10s max
// After 5 minutes, give up
```

### Pattern 3: Graceful Degradation
```typescript
// If primary model unavailable, use fallback:
try {
  qwen4b → SUCCESS
} catch (at-capacity) {
  qwen2b → SUCCESS (lower quality, but operational)
}
```

### Pattern 4: Transparent Integration
```typescript
// Ollama service automatically manages load:
// Users just call: ollamaService.generateStream(...)
// Load monitor handles queueing invisibly
// No API changes needed
```

## Concurrency Limits Reference

| Model | Limit | Memory | Notes |
|-------|-------|--------|-------|
| qwen3.5:2b | 16 | 1GB | Lightweight, high throughput |
| qwen3.5:4b | 8 | 3GB | Primary researcher, good balance |
| qwen3.5:9b | 3 | 8GB | Quality model, medium |
| qwen3.5:27b | 1 | 18GB | Large, single-threaded |
| gemma4:e31b | 1 | 31GB | Very expensive, single-threaded |
| nemotron-3-super:120b | 1 | 120GB | Massive, production only |
| NEURO-1-B2-4B | 4 | 4GB | Identity/style model |
| **GLOBAL** | **15** | — | Hard cap across all models |

## File Structure

```
frontend/
├── config/
│   └── modelRouting.ts                  (NEW) Config + types
├── services/
│   ├── loadMonitor.ts                   (NEW) Core load tracking
│   └── modelFallback.ts                 (NEW) Graceful degradation
├── utils/
│   ├── ollama.ts                        (UPDATED) Integrated load monitor
│   ├── modelSelector.ts                 (NEW) Model selection logic
│   └── modelConfig.ts                   (UNCHANGED) Existing config
├── cli/
│   └── loadMonitorCli.ts                (NEW) CLI integration
├── docs/
│   └── MODEL_ROUTING_GUIDE.md           (NEW) Complete documentation
└── tests/
    └── loadMonitor.test.ts              (NEW) Test suite
```

## How It Prevents Overload

### 1. Per-Model Limits
Gemma (31GB params) limited to 1 concurrent task, preventing GPU from attempting to load multiple instances.

### 2. Global Hard Cap
15 concurrent tasks maximum across all models, regardless of per-model limits. Even if all models are "available", global queue enforces the cap.

### 3. Active Queueing
Instead of failing when at capacity, tasks queue and wait. Exponential backoff prevents CPU spinning. Automatic processing when capacity freed.

### 4. Memory Awareness
Checks Ollama health endpoint (`/api/ps`) to see loaded models and estimate GPU usage. Queues new tasks if VRAM appears exhausted.

### 5. Timeout Protection
- Per-task max wait: 5 minutes
- Per-task max queue depth: 50
- Connection timeout: 120 seconds
- Idle timeout: 120 seconds

Prevents hung tasks from permanently blocking capacity.

### 6. Graceful Degradation
If primary model overloaded, falls back to secondary. This maintains system availability at the cost of quality.

## Integration Checklist

- [x] Core configuration (modelRouting.ts)
- [x] Load monitoring service (loadMonitor.ts)
- [x] Fallback manager (modelFallback.ts)
- [x] Model selector (modelSelector.ts)
- [x] Ollama service integration (ollama.ts updated)
- [x] CLI monitoring (loadMonitorCli.ts)
- [x] Test suite (loadMonitor.test.ts)
- [x] Documentation (MODEL_ROUTING_GUIDE.md)
- [x] TypeScript: All files compile cleanly
- [ ] Add --show-load flag to CLI commands (per-project integration)
- [ ] Set up monitoring dashboard (React component example in docs)
- [ ] Configure alerts for at-capacity events (optional, per-project)

## Usage Examples

### Example 1: Automatic Load Management
```typescript
// No code changes needed — ollama service handles it
const response = await ollamaService.generateStream(
  'Hello world',
  'You are helpful',
  { model: 'qwen3.5:4b' }
);
// Internally:
// 1. Waits if qwen4b at capacity
// 2. Records task start
// 3. Performs inference
// 4. Releases task
// No overload possible
```

### Example 2: Check Capacity Before Starting
```typescript
import { loadMonitor } from 'frontend/services/loadMonitor';

const availability = await loadMonitor.checkAvailability('qwen3.5:9b');
if (!availability.available) {
  console.log(`Unavailable: ${availability.reason}`);
} else {
  // Safe to start resource-heavy operation
}
```

### Example 3: Monitor Load in CLI
```typescript
import { showLoadStatus } from 'frontend/cli/loadMonitorCli';

// Show live load status for 30 seconds
await showLoadStatus({ intervalMs: 1000, durationMs: 30_000 });
```

### Example 4: Force Model Override for Testing
```typescript
import { setModelOverride } from 'frontend/utils/modelSelector';

setModelOverride('qwen3.5:2b');  // Use light model for testing
// ... run tests ...
setModelOverride(null);  // Clear override
```

## Testing

Run the test suite:
```bash
npm test -- frontend/tests/loadMonitor.test.ts
```

Tests cover:
- Task lifecycle (record, release)
- Capacity enforcement per model
- Global concurrency limiting
- Queue management and timeouts
- Load calculations
- Status reporting
- Edge cases

## Performance Characteristics

### Throughput (optimized for max tasks)
- Global: 15 concurrent
- Per-model qwen4b: 8 concurrent
- Total per-model qwen2b: 16 concurrent

### Latency (worst-case queueing)
- Queue check: O(1)
- Task record: O(1)
- Task release: O(1) → O(queueSize) for dequeue
- Status: O(numModels)

### Memory
- Per task: ~100 bytes (taskId, timestamp)
- Per model: ~1KB (tracking data)
- Queue: ~200 bytes per item
- Typical footprint: <50KB

## Monitoring & Debugging

### View Load Status
```typescript
const status = loadMonitor.getStatus();
console.log(status.global.activeTasks);  // Current active tasks
console.log(status.global.utilizationPercent);  // 0-100%
status.global.perModel.forEach(m => {
  console.log(`${m.model}: ${m.activeTasks}/${m.maxConcurrency}`);
});
```

### Check Queue Depth
```typescript
const status = loadMonitor.getStatus();
const queuedCount = status.global.perModel
  .reduce((sum, m) => sum + m.queuedTasks, 0);
console.log(`Queued tasks: ${queuedCount}`);
```

### Monitor in Real-Time
```bash
# In CLI, if --show-load flag is implemented:
npm run dev -- --show-load
```

## Known Limitations

1. **Queue depth heuristic**: Currently max 50 queued. Could be dynamic based on task type.
2. **GPU memory estimation**: Uses Ollama `/api/ps`, may not be perfectly accurate for all model swaps.
3. **Fairness**: Queue is FIFO, no priority scheduling for urgent tasks.
4. **Per-request config**: Timeout per task is fixed, could be configurable.

## Future Enhancements

1. **Priority queues**: Allow urgent tasks to skip ahead
2. **Dynamic limits**: Adjust concurrency based on actual GPU utilization
3. **Task cancellation**: Allow explicit task cancellation with cleanup
4. **Metrics export**: Prometheus metrics for Grafana dashboards
5. **Adaptive backoff**: Learn optimal backoff timing per model
6. **Task affinity**: Pin tasks to specific GPU devices

## References

- **Configuration**: `frontend/config/modelRouting.ts`
- **Core Service**: `frontend/services/loadMonitor.ts`
- **Fallback Logic**: `frontend/services/modelFallback.ts`
- **Model Selection**: `frontend/utils/modelSelector.ts`
- **Ollama Integration**: `frontend/utils/ollama.ts` (lines 1-20, 214-260, 509-527)
- **CLI Monitoring**: `frontend/cli/loadMonitorCli.ts`
- **Tests**: `frontend/tests/loadMonitor.test.ts`
- **Documentation**: `frontend/docs/MODEL_ROUTING_GUIDE.md`

## Support

For issues or questions:
1. Check `MODEL_ROUTING_GUIDE.md` for usage examples
2. Review test suite for integration patterns
3. Check logs with: `loadMonitor.getCliStatus()`
4. Get detailed report: `getDetailedReport()` from loadMonitorCli
