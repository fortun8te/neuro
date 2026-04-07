# Unified Error Recovery Pipeline

## Overview

Error handling was scattered across 7 files with inconsistent strategies. This document defines the unified error recovery pipeline using `errorRecoveryOrchestrator.ts`.

**Goal**: Replace ad-hoc try/catch with systematic recovery decisions.

## Architecture

```
Any async operation
  ↓
executeWithRecovery() or executeWithRetry()
  ↓
classifyError() → detect error kind
  ↓
getRecoveryDecision() → return strategy
  ↓
logRecoveryDecision() → metrics + logging
  ↓
RecoveryStrategy
  ├─ RETRY: Attempt again (max 3 times)
  ├─ FALLBACK_MODEL: Switch to lighter model (qwen3.5:2b)
  ├─ GRACEFUL_DEGRADE: Continue with reduced scope
  ├─ ABORT_WITH_MESSAGE: Stop cleanly with user message
  └─ LOG_AND_CONTINUE: Log error, return null
```

## Error Classification

Errors are classified into 6 kinds:

| Kind | Patterns | Recovery |
|------|----------|----------|
| **network** | DNS, ECONNREFUSED, fetch failed | RETRY → ABORT |
| **timeout** | timeout, timed out, deadline exceeded | RETRY → GRACEFUL_DEGRADE |
| **model** | model, ollama, vram, out of memory | FALLBACK_MODEL |
| **element** | element not found, stale, detached | GRACEFUL_DEGRADE |
| **parsing** | parse, json, format, invalid | LOG_AND_CONTINUE |
| **unknown** | (default) | GRACEFUL_DEGRADE |

## 5 Recovery Strategies

### 1. RETRY
Attempt the same operation again (up to maxAttempts, default 3).

**When applied**:
- Network errors (if attempts remain)
- Timeout errors (on first/second attempt)

**Caller responsibility**:
- Catch error, log it, call function again
- Or use `executeWithRetry()` helper

**Example**:
```typescript
const decision = getRecoveryDecision({
  origin: 'agentEngine',
  action: 'fetch_research',
  error: new Error('ECONNREFUSED'),
  attemptCount: 0,
  maxAttempts: 3,
});
// decision.strategy === 'retry'
```

### 2. FALLBACK_MODEL
Switch to a lighter model (typically qwen3.5:2b).

**When applied**:
- Model/VRAM errors (out of memory, model overloaded)

**Caller responsibility**:
- Check `decision.fallbackModel`
- Re-run operation with lighter model
- Likely to succeed but with reduced quality

**Example**:
```typescript
const decision = getRecoveryDecision({
  origin: 'agentEngine',
  action: 'generate_strategy',
  error: new Error('out of memory'),
  attemptCount: 1,
});
// decision.strategy === 'fallback_model'
// decision.fallbackModel === 'qwen3.5:2b'
```

### 3. GRACEFUL_DEGRADE
Continue with reduced functionality or scope.

**When applied**:
- Timeout (after retries exhausted)
- Element/UI errors (visual steps can't run)
- Unknown errors

**Caller responsibility**:
- Check `decision.degradedMode`
- Skip optional/expensive steps
- Continue with core functionality

**Degraded modes**:
- `skip_optional_steps` — Don't do visual analysis, confidence scoring, etc.
- `use_fast_model` — Use 2b model instead of 9b
- `skip_visual_steps` — Skip Playwright screenshots, vision analysis
- `reduce_scope` — Limit depth/parallelism

**Example**:
```typescript
const decision = getRecoveryDecision({
  origin: 'subagentManager',
  action: 'screenshot_batch',
  error: new Error('timeout after 120s'),
  attemptCount: 2,
  maxAttempts: 3,
});
// decision.strategy === 'graceful_degrade'
// decision.degradedMode === 'skip_visual_steps'
```

### 4. ABORT_WITH_MESSAGE
Stop cleanly and communicate to user.

**When applied**:
- Network errors (max retries exhausted)
- No recovery possible

**Caller responsibility**:
- Show `decision.abortMessage` to user
- Clean up resources
- Transition to error state

**Example**:
```typescript
const decision = getRecoveryDecision({
  origin: 'agentEngine',
  action: 'fetch_research',
  error: new Error('ECONNREFUSED'),
  attemptCount: 3,
  maxAttempts: 3,
});
// decision.strategy === 'abort_with_message'
// decision.abortMessage === 'Failed to reach service...'
```

### 5. LOG_AND_CONTINUE
Log the error but don't interrupt flow.

**When applied**:
- Parsing errors (often non-critical)
- Data format mismatches
- Optional validation failures

**Caller responsibility**:
- Check for null return value
- Use fallback data or defaults
- Continue execution

**Example**:
```typescript
const decision = getRecoveryDecision({
  origin: 'agentEngine',
  action: 'parse_response',
  error: new Error('invalid json'),
  attemptCount: 1,
});
// decision.strategy === 'log_and_continue'
// Caller should: fallbackData = defaultValue; continue
```

## Integration Points

### Pattern 1: executeWithRecovery()

For single-attempt operations that may fail:

```typescript
import { executeWithRecovery, RecoveryStrategy } from './errorRecoveryOrchestrator';

const result = await executeWithRecovery(
  async () => {
    return await ollamaService.generateStream('prompt', signal);
  },
  {
    origin: 'agentEngine',
    action: 'generate_response',
    attemptCount: 0,
    maxAttempts: 3,
    context: { model: 'qwen3.5:4b', tokens: 5000 },
  },
  async (decision) => {
    // Optional callback for custom handling
    if (decision.strategy === 'fallback_model') {
      console.log(`Switching to ${decision.fallbackModel}`);
    }
  },
);

if (result === null) {
  // Handle graceful failure
}
```

### Pattern 2: executeWithRetry()

For operations that may be transient:

```typescript
import { executeWithRetry } from './errorRecoveryOrchestrator';

const result = await executeWithRetry(
  async (attempt) => {
    console.log(`Attempt ${attempt + 1}`);
    return await wayfererService.fetchContent(url);
  },
  'agentEngine',
  'fetch_research',
  3, // maxAttempts
);

if (result === null) {
  // All retries exhausted; fall back
}
```

### Pattern 3: Manual Decision (for complex flows)

```typescript
import { getRecoveryDecision } from './errorRecoveryOrchestrator';

try {
  const output = await ollamaService.generateStream(prompt, signal);
  return output;
} catch (error) {
  const decision = getRecoveryDecision({
    origin: 'subagentManager',
    action: 'generate_stream',
    error,
    attemptCount: attempt,
    maxAttempts: 3,
  });

  switch (decision.strategy) {
    case RecoveryStrategy.RETRY:
      return await retryOperation();
    case RecoveryStrategy.FALLBACK_MODEL:
      return await executeWithFallbackModel(decision.fallbackModel);
    case RecoveryStrategy.GRACEFUL_DEGRADE:
      return getMinimalFallback(decision.degradedMode);
    case RecoveryStrategy.ABORT_WITH_MESSAGE:
      throw new Error(decision.abortMessage);
    case RecoveryStrategy.LOG_AND_CONTINUE:
      return null;
  }
}
```

## Metrics & Monitoring

Track error recovery patterns:

```typescript
import { getRecoveryMetrics, recordRecovery } from './errorRecoveryOrchestrator';

// Record a recovery decision
recordRecovery(RecoveryStrategy.FALLBACK_MODEL, 'model');

// Query metrics
const metrics = getRecoveryMetrics();
console.log(`Total recoveries: ${metrics.totalRecoveries}`);
console.log(`Strategies:`, Object.fromEntries(metrics.strategyCount));
console.log(`Error kinds:`, Object.fromEntries(metrics.errorKindCount));
```

## Migration Guide

### Old Pattern (scattered try/catch)
```typescript
try {
  const result = await operation();
  return result;
} catch (error) {
  console.error('Failed:', error);
  // Ad-hoc retry or abort
  throw error;
}
```

### New Pattern (unified pipeline)
```typescript
const result = await executeWithRecovery(
  () => operation(),
  {
    origin: 'myModule',
    action: 'operation_name',
    attemptCount: 0,
    maxAttempts: 3,
  },
);
```

## FAQ

**Q: When should I use executeWithRecovery() vs executeWithRetry()?**
- Use `executeWithRecovery()` for single attempts with recovery fallbacks.
- Use `executeWithRetry()` when you expect transient failures and want automatic retries.

**Q: Can I override the recovery decision?**
- Yes. Call `getRecoveryDecision()`, inspect the result, then implement custom logic.

**Q: How do I add a new error kind?**
- Update `ErrorKind` type in `errorRecoveryOrchestrator.ts`
- Update `classifyError()` function to recognize it
- Update decision logic in `getRecoveryDecision()`

**Q: How do I customize the fallback model?**
- Pass `context.fallbackModel` in ErrorContext, or update the default in `getRecoveryDecision()`.

## Files Affected

Once full migration completes, these files will use the unified pipeline:

- `agentEngine.ts` (103 try/catch blocks → executeWithRecovery / executeWithRetry)
- `planActAgent.ts` (16 try/catch blocks → unified)
- `subagentManager.ts` (8 try/catch blocks → unified)
- `ollama.ts` (stream error handling)
- `wayfayer.ts` (network error handling)
- `visualScoutAgent.ts` (vision error handling)
- Any tool execution path

## Performance Considerations

- `getRecoveryDecision()` is synchronous and lightweight (~1ms)
- Classification uses regex patterns (cached in next iteration)
- Metrics tracking is in-memory, negligible overhead
- Recommend resetting metrics periodically (e.g., per cycle)

