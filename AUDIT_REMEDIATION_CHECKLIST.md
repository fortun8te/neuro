# API & Integration Audit — Remediation Checklist

**Project:** Nomads Ad Agent
**Audit Date:** April 2, 2026
**Checklist Version:** 1.0

---

## PHASE 1: CRITICAL FIXES (HIGH PRIORITY)

### Task 1: Implement Circuit Breaker for Ollama
- [ ] Create `src/utils/circuitBreaker.ts` with:
  - [ ] State machine (CLOSED → OPEN → HALF_OPEN)
  - [ ] Consecutive failure counter
  - [ ] 30-second open window
  - [ ] Half-open test request every 30s
- [ ] Integrate into `src/utils/ollama.ts` generateStream():
  - [ ] Check state before each call
  - [ ] Increment failure on error
  - [ ] Reset on success
  - [ ] Throw "Circuit breaker open" on OPEN state
- [ ] Add health monitor listener
- [ ] Write unit tests:
  - [ ] CLOSED state passes requests
  - [ ] 3 consecutive failures → OPEN
  - [ ] OPEN state throws immediately
  - [ ] HALF_OPEN allows 1 test request
  - [ ] Successful test → CLOSED
- **File:** `src/utils/ollama.ts` (lines 228-512)
- **Effort:** 2-3 hours
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

### Task 2: Implement Circuit Breaker for Wayfarer
- [ ] Apply same circuit breaker pattern to Wayfarer
- [ ] Lower threshold (2 consecutive failures → OPEN)
- [ ] Shorter window (15 seconds)
- [ ] Integrate into `src/utils/wayfarer.ts` research():
  - [ ] Check state before POST
  - [ ] Fail-fast on OPEN
- **File:** `src/utils/wayfarer.ts` (lines 122-178)
- **Effort:** 1 hour
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

### Task 3: Add Zod Schema Validation
- [ ] Install zod: `npm install zod`
- [ ] Create `src/utils/schemas/`:
  - [ ] `ollama.schemas.ts` — response validation
  - [ ] `wayfarer.schemas.ts` — result validation
  - [ ] `screenshot.schemas.ts` — batch screenshots
- [ ] Define schemas:
  ```typescript
  // ollama.schemas.ts
  export const OllamaResponseSchema = z.object({
    response: z.string().optional(),
    message: z.object({
      content: z.string(),
      thinking: z.string().optional(),
    }).optional(),
    thinking: z.string().optional(),
    done: z.boolean(),
  });

  // wayfarer.schemas.ts
  export const WayfayerResultSchema = z.object({
    query: z.string(),
    text: z.string(),
    pages: z.array(z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      snippet: z.string(),
      source: z.string(),
    })),
    sources: z.array(z.object({
      url: z.string(),
      title: z.string(),
      snippet: z.string(),
    })),
    meta: z.object({
      total: z.number(),
      success: z.number(),
      elapsed: z.number(),
      error: z.string().optional(),
    }),
  });

  // screenshot.schemas.ts
  export const ScreenshotBatchSchema = z.object({
    screenshots: z.array(z.object({
      url: z.string(),
      image_base64: z.string(),
      width: z.number(),
      height: z.number(),
      error: z.string().nullable(),
    })),
  });
  ```
- [ ] Integrate into response handlers:
  - [ ] `src/utils/ollama.ts` — wrap JSON parsing (line 376)
  - [ ] `src/utils/wayfarer.ts` — wrap resp.json() calls (lines 161, 195, 347)
  - [ ] Catch validation errors, throw/log
- [ ] Add error logging:
  ```typescript
  try {
    return schema.parse(data);
  } catch (err) {
    log.error('Schema validation failed', { service: 'ollama', error: err.issues });
    throw new Error(`Invalid response from Ollama: ${err.issues[0]?.message}`);
  }
  ```
- **Files:** `src/utils/ollama.ts`, `src/utils/wayfarer.ts`, NEW: `src/utils/schemas/`
- **Effort:** 3-4 hours
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

---

## PHASE 2: MEDIUM PRIORITY FIXES

### Task 4: Replace Silent Wayfarer Failures
- [ ] Update `src/utils/wayfarer.ts` research() (lines 122-178):
  - [ ] Remove `emptyResult()` fallback
  - [ ] Throw explicit error instead:
    ```typescript
    if (!resp.ok) {
      throw new Error(`Wayfarer research failed: HTTP ${resp.status} ${resp.statusText}`);
    }
    try {
      return await resp.json();
    } catch {
      throw new Error(`Wayfarer returned non-JSON response`);
    }
    ```
- [ ] Update callers to handle throws:
  - [ ] `src/utils/researchAgents.ts` — catch + log
  - [ ] `src/hooks/useOrchestratedResearch.ts` — propagate error to UI
- [ ] UI: Display error banner "Research temporarily unavailable"
- [ ] Testing:
  - [ ] Wayfarer down → error thrown (not empty result)
  - [ ] Callers handle error gracefully
  - [ ] UI shows error message
- **Files:** `src/utils/wayfarer.ts`, `src/utils/researchAgents.ts`, `src/hooks/`
- **Effort:** 1-2 hours
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

### Task 5: Implement Rate Limiting Queue (SearXNG)
- [ ] Create `src/utils/requestQueue.ts`:
  ```typescript
  export class RequestQueue {
    private queue: Array<() => Promise<unknown>> = [];
    private activeCount = 0;
    private maxConcurrent = 5;

    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
        this.process();
      });
    }

    private async process() {
      if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;
      this.activeCount++;
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        this.activeCount--;
        this.process();
      }
    }
  }
  ```
- [ ] Integrate into Wayfarer `/research` endpoint:
  - [ ] Create singleton queue instance
  - [ ] Enqueue each search request
  - [ ] Honor 429 with exponential backoff:
    ```typescript
    if (resp.status === 429) {
      const retryAfter = resp.headers.get('retry-after') || '10';
      const delayMs = parseInt(retryAfter) * 1000;
      await sleep(delayMs);
      return this.research(query, numResults, signal, freshness); // retry
    }
    ```
- [ ] Testing:
  - [ ] 10 concurrent requests → only 5 execute at once
  - [ ] 429 rate limit → backoff, then retry
  - [ ] Queue fills but doesn't overflow
- **Files:** NEW: `src/utils/requestQueue.ts`, `src/utils/wayfarer.ts`
- **Effort:** 2-3 hours
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

### Task 6: Standardize Error Messages
- [ ] Create error template in `src/utils/errorFormatter.ts`:
  ```typescript
  export interface FormattedError {
    service: string;
    action: string;
    reason: string;
    httpStatus?: number;
    suggestion?: string;
  }

  export function formatError(error: FormattedError): string {
    let msg = `${error.service} ${error.action} failed: ${error.reason}`;
    if (error.httpStatus) msg += ` (HTTP ${error.httpStatus})`;
    if (error.suggestion) msg += `. ${error.suggestion}`;
    return msg;
  }
  ```
- [ ] Apply to Ollama errors:
  - [ ] Line 506: "Cannot reach Ollama at {endpoint}..." → formatError()
  - [ ] Line 309: "Ollama API error..." → formatError()
  - [ ] Line 244: "Connection timeout..." → formatError()
- [ ] Apply to Wayfarer errors:
  - [ ] Line 150: "HTTP 5xx on attempt..." → formatError()
  - [ ] Line 156: "Wayfarer error..." → formatError()
  - [ ] Line 170: "Wayfarer fetch error..." → formatError()
- [ ] Apply to SearXNG errors (if any)
- [ ] Testing:
  - [ ] All errors follow same format
  - [ ] HTTP status codes included
  - [ ] Helpful suggestions present
- **Files:** NEW: `src/utils/errorFormatter.ts`, `src/utils/ollama.ts`, `src/utils/wayfarer.ts`
- **Effort:** 1-2 hours
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

---

## PHASE 3: LOW PRIORITY FIXES

### Task 7: Add DNS Timeout
- [ ] Update `src/utils/ollama.ts` generateStream():
  - [ ] Line 288: Add DNS timeout to fetch options
  - [ ] Use AbortSignal composition:
    ```typescript
    const dnsController = new AbortController();
    const dnsTimer = setTimeout(() => dnsController.abort(), 10000); // 10s DNS timeout
    const combinedSignal = AbortSignal.any([connectController.signal, dnsController.signal]);

    try {
      response = await fetch(endpoint, { signal: combinedSignal, ... });
    } finally {
      clearTimeout(dnsTimer);
    }
    ```
- [ ] Testing:
  - [ ] DNS timeout fires after 10s
  - [ ] Connection timeout still enforced
  - [ ] Both signals work together
- **Files:** `src/utils/ollama.ts`
- **Effort:** 1 hour
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

### Task 8: Document Infrastructure Setup
- [ ] Create `INFRASTRUCTURE.md`:
  - [ ] Port configuration guide
  - [ ] Health probe endpoints
  - [ ] Service recovery runbook
  - [ ] Scaling guidelines
- [ ] Add to `.env.example`:
  ```
  # API Integration
  VITE_OLLAMA_URL=http://100.74.135.83:11440
  VITE_WAYFARER_URL=http://localhost:8889
  VITE_SEARXNG_URL=http://localhost:8888

  # Rate Limiting
  VITE_SEARXNG_CONCURRENCY=32
  VITE_WAYFARER_CONCURRENCY=20

  # Circuit Breaker (optional)
  VITE_CIRCUIT_BREAKER_FAILURES=3
  VITE_CIRCUIT_BREAKER_TIMEOUT=30000
  ```
- **Files:** NEW: `INFRASTRUCTURE.md`, Updated: `.env.example`
- **Effort:** 1 hour
- **Owner:** [TBD]
- **Status:** [ ] NOT STARTED

---

## PHASE 4: TESTING & VALIDATION

### Task 9: Integration Tests
- [ ] Create `src/__tests__/ollama.integration.test.ts`:
  - [ ] Test Ollama unavailable → 3 retries, then circuit open
  - [ ] Test successful request → circuit CLOSED
  - [ ] Test connection timeout handling
  - [ ] Test abort signal propagation
  - [ ] Test schema validation (malformed response)

- [ ] Create `src/__tests__/wayfarer.integration.test.ts`:
  - [ ] Test research() throws on error (after fix)
  - [ ] Test timeout handling
  - [ ] Test rate limiting queue
  - [ ] Test abort signal
  - [ ] Test schema validation

- [ ] Create `src/__tests__/circuitBreaker.test.ts`:
  - [ ] State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
  - [ ] Failure counter increments
  - [ ] Success resets counter
  - [ ] Half-open allows 1 test request

- [ ] Create `src/__tests__/requestQueue.test.ts`:
  - [ ] Max concurrency enforced
  - [ ] FIFO ordering preserved
  - [ ] Errors propagate to callers

**Effort:** 4-5 hours
**Owner:** [TBD]
**Status:** [ ] NOT STARTED

### Task 10: Load Testing
- [ ] Set up load test harness:
  - [ ] 10 concurrent Ollama calls (5 vision, 5 text)
  - [ ] 50 concurrent Wayfarer searches
  - [ ] Monitor VRAM, CPU, network
  - [ ] Check for resource leaks

- [ ] Run chaos tests:
  - [ ] Kill Ollama mid-request → verify graceful recovery
  - [ ] Network packet loss (10%, 50%) → verify backoff
  - [ ] Slow responses (10s, 60s) → verify timeout

**Effort:** 2-3 hours
**Owner:** [TBD]
**Status:** [ ] NOT STARTED

---

## TRACKING & SIGN-OFF

### Completion Checklist

**PHASE 1:**
- [ ] Circuit breaker (Ollama) — approved by [TBD], merged by [TBD]
- [ ] Circuit breaker (Wayfarer) — approved by [TBD], merged by [TBD]
- [ ] Schema validation — approved by [TBD], merged by [TBD]

**PHASE 2:**
- [ ] Silent failures fixed — approved by [TBD], merged by [TBD]
- [ ] Rate limiting queue — approved by [TBD], merged by [TBD]
- [ ] Error messages standardized — approved by [TBD], merged by [TBD]

**PHASE 3:**
- [ ] DNS timeout added — approved by [TBD], merged by [TBD]
- [ ] Infrastructure documented — approved by [TBD], merged by [TBD]

**PHASE 4:**
- [ ] Integration tests passing — [TBD]
- [ ] Load tests completed — [TBD]
- [ ] Code review approved — [TBD]
- [ ] Merged to main — [TBD]

### Sign-Off

- [ ] All critical findings addressed
- [ ] Audit report reviewed and accepted
- [ ] New health score: __ / 10 (target: 9.0+)
- [ ] Production deployment approved

**Signed by:** _____________________ **Date:** __________

---

## RELATED DOCUMENTS

- Full Audit Report: `API_INTEGRATION_AUDIT.md`
- Findings Summary: `AUDIT_FINDINGS_SUMMARY.txt`
- Infrastructure Config: `src/config/infrastructure.ts`
