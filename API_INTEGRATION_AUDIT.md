# API & Integration Audit Report
**Project:** Nomads Ad Agent
**Date:** April 2, 2026
**Auditor:** Claude API & Integration Audit Agent

---

## EXECUTIVE SUMMARY

The Ad Agent codebase demonstrates **mature API integration patterns** with robust error handling, retry logic, timeout management, and health monitoring. However, several critical gaps exist in rate limiting, circuit breakers, and graceful degradation strategies.

**Overall Health Score: 7.5/10**
- Strengths: Timeout handling, retry logic, health monitoring
- Gaps: Rate limiting, circuit breaker implementation, response validation

---

## 1. EXTERNAL API INTEGRATION HEALTH

### 1.1 Ollama (HTTP://100.74.135.83:11440)

**Status:** HEALTHY with mature error handling

#### Connection Reliability
- **Retry Logic:** 3 attempts with exponential backoff (1s, 2s, 4s for network; 3s, 9s, 27s for 429)
- **Connection Timeout:** 120 seconds (configurable, increased for vision models)
- **Idle Stream Timeout:** 120 seconds (prevents hanging on silent models)
- **Fallback:** Direct IP probe when proxy unavailable

#### Error Handling
```typescript
Location: /src/utils/ollama.ts (lines 97-108, 473-528)

- Retry condition check: isRetryable() distinguishes between:
  ✓ Network failures (ECONNREFUSED, ECONNRESET)
  ✓ Server errors (502, 503, 429)
  ✗ Model not found (404 — non-retryable)
  ✗ User abort (AbortError — non-retryable)
```

#### Strengths
1. **Timeout pyramid approach:**
   - Connection timeout: 120s (covers model queue delay)
   - Idle timeout: 120s (per-token monitoring)
   - User abort signal threaded through entire pipeline

2. **Token tracking & metrics:**
   - `tokenTracker.startCall/endCall()` wraps all model calls
   - Inline thinking (`<think>...</think>`) parsed separately
   - Vision model base64 detection + longer timeouts

3. **Health monitoring:**
   - `isOllamaHealthy()` tracks connection state
   - `healthCheck()` probes endpoint + fallback to direct IP
   - Connection listeners notify UI on status change

#### Gaps
1. **No circuit breaker** — Failed requests still retry immediately after backoff
   - Issue: Persistent disconnection causes N retry attempts per call
   - Suggestion: Implement circuit breaker (fail-fast after 5 consecutive failures)

2. **No per-model rate limiting** — All models share same concurrency
   - Issue: Large vision calls can starve smaller text requests
   - Suggestion: Per-model queues or weighted concurrency

3. **Error message inconsistency:**
   ```typescript
   Line 506: "Cannot reach Ollama at {apiBase}. Is the server running?"
   Line 309: "Ollama API error: {status} {statusText}"
   ```
   - Some errors enhanced, some raw HTTP status
   - Suggestion: Consistent "friendly" error template

---

### 1.2 Wayfarer (HTTP://LOCALHOST:8889 or 100.74.135.83:8889)

**Status:** HEALTHY with basic error handling, but missing graceful degradation

#### Connection Reliability
- **Health Check:** 3-second timeout, 1-minute TTL cache
- **Request Timeout:** 120s for single page, 180s for batch
- **Retry Logic:** 3 attempts for HTTP 5xx, exponential backoff (1s, 2s)
- **Fallback:** Returns empty result on all failures (silent degradation)

#### Error Handling
```typescript
Location: /src/utils/wayfarer.ts (lines 122-178, 260-310)

Patterns:
- research() — falls back to emptyResult(query) on failure
- screenshot() — returns { error: string, image_base64: '' }
- batchCrawl() — returns empty results array on HTTP error
```

#### Strengths
1. **Timeout hierarchy:**
   - Single screenshot: 120s
   - Batch screenshots: 180s (3 concurrent Playwright instances)
   - Session actions: 60s per action

2. **Graceful error returns:**
   - All endpoints return structured responses, never throw
   - Callers get `error` field + fallback values
   - UI doesn't crash on Wayfarer unavailability

#### Gaps
1. **Silent failures — no user notification:**
   - `research()` returns `meta: { error: 'Wayfarer unavailable' }` in empty result
   - Callers must check `result.pages.length === 0` to detect failure
   - Suggestion: Throw explicit "Wayfarer unavailable" error, don't silent-fail

2. **Inconsistent timeout strategy:**
   - `/research`: No explicit timeout (inherits fetch default ~30s)
   - `/screenshot`: 120s hardcoded
   - Suggestion: Standardize to 90s for text, 120s for visual

3. **No retry on abort:**
   ```typescript
   Line 140: if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
   Line 167: if (signal?.aborted) throw error;
   ```
   - User cancellation throws, preventing fallback
   - Suggestion: Return empty result instead of throwing

4. **File transfer endpoints untested:**
   - `/session/open`, `/session/action`, `/session/close` exist but not validated in audit
   - No size limits documented
   - Suggestion: Add file size validation + timeout guards

---

### 1.3 SearXNG (HTTP://LOCALHOST:8888 or 100.74.135.83:8888)

**Status:** HEALTHY, minimal integration

#### Connection Reliability
- **Health Check:** 3-second timeout
- **Search Via Wayfarer:** Text queries routed through Wayfarer's `/research` endpoint
- **Direct Query Rate:** Configured for 32 concurrent searches (INFRASTRUCTURE config)

#### Error Handling
```typescript
Location: /src/utils/wayfarer.ts (line 103-108)

export async function isSearxngHealthy(): Promise<boolean> {
  try {
    const resp = await fetch(`${INFRASTRUCTURE.searxngUrl}/healthz`,
      { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch { return false; }
}
```

#### Gaps
1. **No rate limiting in client:**
   - Config specifies `searxngConcurrency: 32` but not enforced in frontend
   - Backend may rate-limit (429) but client doesn't handle intelligently
   - Suggestion: Implement request queue with 429 backoff handling

2. **No direct search integration:**
   - All SearXNG queries go through Wayfarer `/research`
   - If Wayfarer down, SearXNG completely unreachable
   - Suggestion: Add direct search endpoint as fallback

---

## 2. ERROR HANDLING ASSESSMENT

### 2.1 Network Failures

**Handled Correctly:**
- Connection timeout (120s for Ollama, 90-180s for Wayfarer)
- ECONNREFUSED, ECONNRESET detection
- Exponential backoff (1s, 2s, 4s for network; 3s, 9s, 27s for 429)
- Idle stream timeout (120s for stuck connections)

**Gaps:**
- No DNS resolution timeout (fetch default is variable per browser)
- No connection pool management (unbounded concurrent fetch requests)
- No circuit breaker to prevent thundering herd during outage

### 2.2 HTTP Status Codes

| Status | Handled | Behavior |
|--------|---------|----------|
| 200 OK | ✓ | Process response normally |
| 4xx Client Error | ✓ | Non-retryable (except timeout) |
| 404 Not Found | ✓ | Model not found — helpful message |
| 429 Too Many Requests | ✓ | Retryable with 3x backoff (9s, 27s, 81s) |
| 5xx Server Error | ✓ | Retryable (Wayfarer), or endpoint probe fallback (Ollama) |
| No response body | ✓ | Wayfarer returns empty, Ollama throws |

**Gap:** 503 Service Unavailable — retried but no circuit breaker to stop retrying after system is truly down.

### 2.3 Data Validation

**Input Validation:**
- Ollama prompt length: Not checked (assumes Ollama enforces context window)
- Wayfarer URLs: Not validated before request
- Screenshot dimensions: Hardcoded (1280x720 default)

**Output Validation:**
- JSON parsing: Try/catch blocks present, fallback to empty/error
- Streaming response: Line-by-line JSON parsing with error suppression
- Base64 images: No size validation after download

**Recommendation:** Add schema validation (zod/ajv) for:
- Ollama response: `{ response?, message?, thinking?, done? }`
- Wayfarer result: `{ pages: [], sources: [], meta: {} }`
- Screenshot batch: `{ screenshots: [{ error?, image_base64 }] }`

### 2.4 Error Messages

**Strengths:**
- Descriptive context (endpoint, model name, timeout duration)
- Stack traces in dev logs
- User-friendly fallback messages

**Weaknesses:**
```typescript
// Inconsistent error formats:
"Cannot reach Ollama at {endpoint}. Is the server running?" — good
"Ollama API error: {status} {statusText}. {errorText || 'Check server'}" — generic
"Failed to fetch" — browser default, uninformative
```

**Suggestion:** Normalize to:
```
[ServiceName] [Action] failed: [Reason]
Expected: [Expected behavior]
Status: [HTTP status or error code]
```

---

## 3. DATA FLOW VALIDATION

### 3.1 Type Safety

**Strong Points:**
- TypeScript strict mode enforced
- Request types: `OllamaOptions`, `WayfayerResult`, `ScreenshotResult` well-defined
- Response parsing with fallback types

**Weak Points:**
```typescript
// Line 379 (ollama.ts) — unsafe type narrowing:
const token = useChat ? json.message?.content : json.response;
if (token) { ... } // What if token is not a string?

// Line 348 (wayfarer.ts) — no array validation:
try {
  const data = await resp.json();
  return data.screenshots; // What if .screenshots is not an array?
} catch { ... }
```

**Recommendation:** Add runtime validation:
```typescript
const schema = z.object({ screenshots: z.array(...) });
const validated = schema.parse(data);
```

### 3.2 Request Format

All APIs use:
- `POST` with `Content-Type: application/json`
- `AbortSignal` for cancellation
- Standard timeout/retry patterns

**Gap:** No request signing or authentication (all APIs public/LAN-only).

### 3.3 Response Parsing

| Service | Format | Parser | Error Handling |
|---------|--------|--------|-----------------|
| Ollama | Streaming JSON-lines | Line-by-line parse | Suppress parse errors, continue |
| Wayfarer | JSON | `resp.json()` | Try/catch, return fallback |
| SearXNG | JSON | Via Wayfarer | N/A |

---

## 4. RATE LIMITING & BACKPRESSURE

### 4.1 Per-Service Limits

**Ollama:** No client-side rate limiting
- Relies on Ollama queue (default unbounded)
- Multiple models can share VRAM
- Vision calls (base64 payloads) may block text requests

**Wayfarer:** No client-side rate limiting
- Configured concurrency: 20 pages per research call
- Playwright batch: 3 concurrent browser instances
- Session pool: Unbounded (no max session cleanup)

**SearXNG:** Configured but not enforced
- Config: `searxngConcurrency: 32`
- Actual enforcement: Only in Wayfarer `/research` dispatch
- Direct API: No limiting

### 4.2 Backoff Strategy

**Ollama (aggressive):**
- Network: 1s, 2s, 4s (2x exponential)
- 429 Rate Limit: 3s, 9s, 27s (3x exponential)
- Max retries: 3

**Wayfarer (moderate):**
- HTTP 5xx: 1s, 2s, 2s (linear)
- Max retries: 3

**Gap:** No adaptive backoff based on success rate or error type.

### 4.3 Recommended Rate Limiting Architecture

```
Priority: Ollama > Wayfarer > SearXNG
- Ollama: Token bucket (refill 10/sec) per model
- Wayfarer: Queue (max 5 concurrent), 2s between batches
- SearXNG: Via Wayfarer, honor 429 with jitter
```

---

## 5. RECOVERY STRATEGY ASSESSMENT

### 5.1 Circuit Breaker (Missing)

**Current:** No circuit breaker — failed requests retry immediately
**Impact:** During Ollama downtime, every call attempts 3 retries (6s to 12s latency each)

**Recommendation:** Implement circuit breaker with states:
- **Closed** (normal): Pass requests through
- **Open** (failing): Reject new requests, fail-fast after 3 consecutive failures
- **Half-Open** (recovery): Allow 1 test request every 30s

```typescript
// Pseudocode
if (consecutiveFailures > 3) {
  circuitBreaker.open();
  throw new Error('Circuit breaker open, service unavailable');
}
await sleep(exponentialBackoff);
```

### 5.2 Graceful Degradation

**Implemented:**
- Wayfarer unavailable → return empty results (silent)
- Ollama unavailable → throw + UI displays error
- Health monitor tracks status, UI can show warning

**Missing:**
- No fallback to local model if remote unavailable
- No cache of previous research results
- No UI queue of pending requests

### 5.3 Crash Recovery

**Health Monitoring:**
- Continuous heartbeat (30s interval)
- Tracks consecutive failures + latency
- Status change notifications to listeners

**Session Checkpointing:**
- Auto-saves to IndexedDB
- Allows resume after browser crash
- No rollback of partial results

**Gap:** No automatic restart of hung agents (would require external process manager).

---

## 6. INFRASTRUCTURE CONFIGURATION

### 6.1 Environment Variables

**Defined:**
```
VITE_OLLAMA_URL         — Ollama endpoint (default: 100.74.135.83:11440)
VITE_WAYFARER_URL       — Wayfarer endpoint (default: localhost:8889)
VITE_SEARXNG_URL        — SearXNG endpoint (default: localhost:8888)
VITE_CONTEXT1_URL       — Context-1 harness (optional)
VITE_SEARXNG_CONCURRENCY — Search concurrency (default: 32)
VITE_WAYFARER_CONCURRENCY — Page fetch concurrency (default: 20)
```

**Gap:** No documentation for infrastructure setup (ports, dependencies, health probe URLs).

### 6.2 Health Endpoints

| Service | Endpoint | Timeout | Purpose |
|---------|----------|---------|---------|
| Ollama | `/api/tags` | 8s (probe), 5s (model list) | List available models |
| Wayfarer | `/health` | 5s | Server alive check |
| SearXNG | `/healthz` | 3s | Server alive check |

---

## 7. PERFORMANCE BOTTLENECKS

### 7.1 Identified

1. **Ollama connection timeout:** 120s is generous but blocks UI during outage
   - Recommendation: 30s for connection, 120s for idle stream

2. **Wayfarer visual processing:** 120-180s per batch limits throughput
   - Recommendation: Parallel screenshot batches (currently 3 concurrent)

3. **JSON parsing overhead:** Line-by-line streaming parsing is correct but CPU-bound for large responses
   - Recommendation: Monitor if models output >100KB streaming responses

### 7.2 Scaling Limits

- **Concurrent Ollama requests:** Limited by VRAM (each model loaded once)
- **Concurrent Wayfarer requests:** Limited by browser/Python concurrency (3-20)
- **Concurrent SearXNG queries:** Limited by 8 SearXNG instances (8 queries/30s)

---

## 8. CRITICAL FINDINGS

### Finding 1: No Circuit Breaker (HIGH)
**Impact:** Cascading failures during service outages
**Fix:** Implement circuit breaker in ollama.ts + wayfarer.ts
**Effort:** 2-3 hours

### Finding 2: Silent Wayfarer Failures (MEDIUM)
**Impact:** UI doesn't know if research failed or returned no results
**Fix:** Throw explicit error instead of returning empty result
**Effort:** 1 hour

### Finding 3: No Rate Limiting on SearXNG (MEDIUM)
**Impact:** Can overwhelm SearXNG or hit rate limits without backoff
**Fix:** Enforce concurrency queue with 429 handling
**Effort:** 2-3 hours

### Finding 4: Inconsistent Error Messages (LOW)
**Impact:** Debugging harder, user confusion
**Fix:** Standardize error template across all APIs
**Effort:** 1-2 hours

### Finding 5: No Schema Validation (MEDIUM)
**Impact:** Malformed responses can crash parser
**Fix:** Add zod/ajv validation for all API responses
**Effort:** 3-4 hours

---

## 9. TESTING RECOMMENDATIONS

### Integration Tests Needed:
1. **Ollama unavailable** — Expect: fail-fast after 3 retries (12s), circuit breaker after that
2. **Wayfarer timeout** — Expect: return empty result with error metadata
3. **429 Rate Limit** — Expect: exponential backoff (3s, 9s, 27s)
4. **Network interrupted mid-stream** — Expect: abort signal propagates, cleanup occurs
5. **Malformed JSON response** — Expect: graceful fallback, not crash

### Load Testing:
- 10 concurrent Ollama calls (5 vision, 5 text)
- 50 concurrent Wayfarer searches
- Monitor VRAM, CPU, network bandwidth

---

## 10. RECOMMENDATIONS (PRIORITY ORDER)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **HIGH** | Implement circuit breaker (Ollama, Wayfarer) | 3h | Fail-fast, prevent resource waste |
| **HIGH** | Add schema validation (zod) | 4h | Prevent crashes from malformed responses |
| **MEDIUM** | Implement rate limiting queue (SearXNG) | 3h | Prevent rate limiting, smooth throughput |
| **MEDIUM** | Replace silent failures with explicit errors | 2h | Better debugging, user notification |
| **MEDIUM** | Standardize error messages | 2h | Consistent UX, easier i18n |
| **LOW** | Add DNS timeout | 1h | Prevent hanging on unreachable domains |
| **LOW** | Document health probe endpoints | 1h | Ops reference |

---

## APPENDIX: Configuration Summary

```typescript
// Key infrastructure parameters
INFRASTRUCTURE = {
  ollamaUrl: 'http://100.74.135.83:11440',
  wayfarerUrl: 'http://localhost:8889',
  searxngUrl: 'http://localhost:8888',
  searxngConcurrency: 32,
  wayfarerConcurrency: 20,
}

// Timeout hierarchy (seconds)
Ollama:
  - Connection timeout: 120
  - Idle stream timeout: 120
  - Preload timeout: 60

Wayfarer:
  - Single screenshot: 120
  - Batch screenshot: 180
  - Session action: 60
  - Research: 90 (implicit)

// Retry strategy
Ollama: 3 attempts
  - Network error: 1s, 2s, 4s
  - 429 (rate limit): 3s, 9s, 27s
  - 404 (model not found): no retry

Wayfarer: 3 attempts
  - HTTP 5xx: 1s, 2s, 2s
  - All other errors: no retry

// Health monitoring
Interval: 30s
Down threshold: 4 consecutive failures
Degraded threshold: 2 consecutive failures
Probe timeout: 5s (Ollama), 5s (Wayfarer), 3s (SearXNG)
```

---

## CONCLUSION

The Ad Agent's API integration layer is **mature and production-ready** for single-user or small-team deployment. The retry logic, timeout handling, and health monitoring demonstrate solid engineering practices.

However, the absence of a circuit breaker, rate limiting enforcement, and schema validation represents moderate risk for production use at scale. Implementing these three items (HIGH priority) would elevate the system to enterprise-grade reliability.

**Next Phase:** Propose circuit breaker RFC + schema validation rollout plan.
