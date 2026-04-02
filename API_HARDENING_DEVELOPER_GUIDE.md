# API Hardening Developer Guide

Quick reference for using the new Phase 1 infrastructure.

---

## Circuit Breaker

### Check if service is available before expensive operations

```typescript
import { getOrCreateBreaker } from './utils/circuitBreaker';

const breaker = getOrCreateBreaker('my-service', {
  failureThreshold: 5,    // Open after 5 failures
  resetTimeout: 30_000,   // Retry after 30s
  name: 'MyService'
});

// Before attempting request
breaker.canAttempt(); // Throws if circuit is OPEN

// Record outcomes
if (success) {
  breaker.recordSuccess(); // Resets counter
} else {
  breaker.recordFailure(); // Increments counter
}
```

### Monitor circuit status

```typescript
import { getAllBreakers } from './utils/circuitBreaker';

for (const [name, breaker] of getAllBreakers()) {
  const status = breaker.getStatus();
  console.log(`${name}:`, status);
  // { state: 'CLOSED'|'OPEN'|'HALF_OPEN', failureCount: 0, timeSinceLastFailure: null }
}
```

### Automatic wrapping

```typescript
import { executeWithBreaker } from './utils/circuitBreaker';

const result = await executeWithBreaker(
  'my-service',
  async () => {
    // Your async operation
    return await fetch(...).then(r => r.json());
  },
  { failureThreshold: 5, resetTimeout: 30_000 }
);
// Returns result or throws if breaker is OPEN
```

---

## Schema Validation

### Ollama Responses

```typescript
import { validateOllamaResponse } from './utils/schemas/ollama.schemas';

const json = JSON.parse(line);
try {
  validateOllamaResponse(json); // Throws if invalid
  const token = json.response || json.message?.content;
} catch (err) {
  log.warn('Validation failed', err);
  // Continue processing (lenient mode)
}
```

### Wayfarer Responses

```typescript
import {
  validateWayfarerResult,
  validateScreenshotBatch
} from './utils/schemas/wayfarer.schemas';

// Research result
try {
  const data = await resp.json();
  validateWayfarerResult(data); // Type-safe
  return data;
} catch (err) {
  throw new Error('Invalid research result');
}

// Screenshot batch
const screenshotData = await resp.json();
try {
  validateScreenshotBatch(screenshotData);
} catch (err) {
  log.error('Screenshot validation failed', err);
}
```

---

## Request Queue

### Basic usage

```typescript
import { getOrCreateQueue, enqueueRequest } from './utils/requestQueue';

const queue = getOrCreateQueue('wayfarer-research', 5); // Max 5 concurrent

// Method 1: Use queue directly
const result = await queue.enqueue(async () => {
  return await fetch('/api/research').then(r => r.json());
});

// Method 2: One-liner
const result = await enqueueRequest(
  'wayfarer-research',
  async () => await fetch('/api/research').then(r => r.json()),
  5  // max concurrency
);
```

### Monitor queue

```typescript
const queue = getOrCreateQueue('wayfarer-research');
const stats = queue.getStats();
console.log(`Queued: ${stats.queued}, Active: ${stats.active}, Completed: ${stats.completed}`);
```

### Adjust concurrency dynamically

```typescript
const queue = getOrCreateQueue('wayfarer-research');
queue.setMaxConcurrent(10); // Increase from 5 to 10
```

### Wait for all pending work

```typescript
import { drainAllQueues } from './utils/requestQueue';

await drainAllQueues(); // Blocks until all queued requests complete
```

---

## Error Formatting

### Use error factories

```typescript
import { errorFactories } from './utils/errorFormatter';

// Connection error
throw errorFactories.connectionFailed('Ollama', 'http://localhost:11440', 120000);

// HTTP error
throw errorFactories.httpError('Wayfarer', 'research', 503, 'Service Unavailable');

// Timeout
throw errorFactories.timeout('Ollama', 'generate', 120000);

// Invalid JSON
throw errorFactories.invalidJson('Wayfarer', 'research');

// Circuit breaker
throw errorFactories.circuitBreakerOpen('Ollama', 5, 30000);

// Rate limited
throw errorFactories.rateLimited('SearXNG', 60);
```

### Custom formatting

```typescript
import { formatError } from './utils/errorFormatter';

const message = formatError({
  service: 'MyAPI',
  action: 'fetch',
  reason: 'Connection refused',
  httpStatus: 500,
  suggestion: 'Check server status'
});
// "MyAPI fetch failed: Connection refused (HTTP 500). Check server status"
```

---

## Integration Patterns

### Pattern 1: Ollama with Circuit Breaker + Schema Validation

```typescript
import { getOrCreateBreaker } from './utils/circuitBreaker';
import { validateOllamaResponse } from './utils/schemas/ollama.schemas';

const breaker = getOrCreateBreaker('ollama');

try {
  breaker.canAttempt(); // Fail fast if circuit open

  const resp = await fetch('/api/generate', { method: 'POST', ... });
  const json = await resp.json();

  try {
    validateOllamaResponse(json); // Validate structure
  } catch (err) {
    log.debug('Validation failed (lenient)', err);
  }

  breaker.recordSuccess(); // Reset counter
  return json;
} catch (err) {
  breaker.recordFailure(); // Increment counter, possibly open circuit
  throw err;
}
```

### Pattern 2: Wayfarer with Queue + Circuit Breaker

```typescript
import { enqueueRequest } from './utils/requestQueue';
import { getOrCreateBreaker } from './utils/circuitBreaker';
import { validateWayfarerResult } from './utils/schemas/wayfarer.schemas';

const breaker = getOrCreateBreaker('wayfarer-research', {
  failureThreshold: 2,
  resetTimeout: 15_000
});

const result = await enqueueRequest(
  'wayfarer-research',
  async () => {
    breaker.canAttempt();

    const resp = await fetch('/research', {
      method: 'POST',
      body: JSON.stringify({ query: '...' })
    });

    if (!resp.ok) {
      breaker.recordFailure();
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    validateWayfarerResult(data);
    breaker.recordSuccess();
    return data;
  },
  5  // Max 5 concurrent research requests
);
```

---

## Debugging

### Check circuit breaker states

```typescript
import { getAllBreakers } from './utils/circuitBreaker';

console.table(
  Array.from(getAllBreakers()).map(([name, breaker]) => ({
    service: name,
    ...breaker.getStatus()
  }))
);
```

### Check queue depth

```typescript
import { getAllQueues } from './utils/requestQueue';

console.table(
  Array.from(getAllQueues()).map(([name, queue]) => ({
    service: name,
    ...queue.getStats()
  }))
);
```

### Enable debug logging

```typescript
// In your app initialization
localStorage.setItem('DEBUG', '*');
// Or for specific module:
localStorage.setItem('DEBUG', 'circuitBreaker,requestQueue');
```

---

## Common Scenarios

### Scenario: Ollama becomes unavailable

1. First request fails → `recordFailure()` (count = 1)
2. Second request fails → `recordFailure()` (count = 2)
3. ... repeat 5 times ...
4. After 5th failure → circuit opens
5. 6th request → `canAttempt()` throws immediately (no retry)
6. User sees error message → can retry after 30s
7. After 30s → circuit enters HALF_OPEN
8. Next request is test request → succeeds → circuit closes

### Scenario: Wayfarer rate limiting

1. 10 requests queued (maxConcurrent = 5)
2. First 5 execute immediately
3. 6-10 wait in queue
4. As requests complete, next ones execute
5. FIFO order preserved
6. All requests eventually complete

### Scenario: Malformed response

1. Response JSON is valid but doesn't match schema
2. Validation throws error
3. In lenient mode: logged at DEBUG, processing continues
4. In strict mode: error thrown, request fails
5. Circuit breaker records failure if needed

---

## Best Practices

1. **Always record success/failure** — Circuit breaker depends on it
2. **Use lenient validation** — Malformed responses shouldn't crash
3. **Set appropriate thresholds** — Ollama: 5, Wayfarer: 2 (more aggressive)
4. **Monitor queue depth** — Prevent unbounded queue growth
5. **Log circuit state changes** — Helps debugging production issues
6. **Test failure scenarios** — Kill services to verify circuit breaker works

---

## Troubleshooting

| Problem | Diagnosis | Solution |
|---------|-----------|----------|
| Requests fail immediately | Circuit breaker open | Wait 30s or check service |
| Queue grows unbounded | Max concurrency too low | Increase with `setMaxConcurrent()` |
| Validation errors in logs | Malformed response | Check service version/format |
| Circuit never reopens | Stuck in HALF_OPEN | Manually call `breaker.reset()` |
| High latency on failures | Too many retries | Use circuit breaker to fail fast |

---

## API Reference

### CircuitBreaker

```typescript
class CircuitBreaker {
  canAttempt(): void;
  recordSuccess(): void;
  recordFailure(): void;
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  getStatus(): { state, failureCount, timeSinceLastFailure };
  reset(): void;
}

function getOrCreateBreaker(name, options?): CircuitBreaker
function executeWithBreaker<T>(name, fn, options?): Promise<T>
function getAllBreakers(): Map<string, CircuitBreaker>
```

### RequestQueue

```typescript
class RequestQueue {
  enqueue<T>(fn): Promise<T>;
  getStats(): { queued, active, completed, failed };
  setMaxConcurrent(max): void;
  drain(): Promise<void>;
  resetStats(): void;
}

function getOrCreateQueue(name, maxConcurrent?): RequestQueue
function enqueueRequest<T>(name, fn, maxConcurrent?): Promise<T>
function getAllQueues(): Map<string, RequestQueue>
function drainAllQueues(): Promise<void>
```

### Schema Validation

```typescript
// Ollama
validateOllamaResponse(data): void          // Throws on invalid
validateOllamaTagsResponse(data): void

// Wayfarer
validateWayfarerResult(data): void
validateScreenshotBatch(data): void
validateScreenshotSingle(data): void
validateSessionOperation(data): void
```

### Error Formatting

```typescript
function formatError(options): string
function createFormattedError(options): Error

errorFactories.connectionFailed(service, endpoint, timeout?)
errorFactories.httpError(service, action, status, statusText)
errorFactories.timeout(service, action, timeoutMs)
errorFactories.invalidJson(service, action)
errorFactories.schemaValidation(service, fieldName, expectedType)
errorFactories.circuitBreakerOpen(service, failureCount, resetTimeMs)
errorFactories.rateLimited(service, retryAfterSeconds?)
errorFactories.aborted(service, action)
```
