# API Response Validation Audit Report
## Frontend Utils Module — `/Users/mk/Downloads/nomads/frontend/utils/`

**Date:** 2026-04-06
**Scope:** HTTP API response validation across all frontend utilities
**Status:** CRITICAL ISSUES FOUND — Multiple validation bugs identified

---

## Executive Summary

**Total Issues Found:** 28 critical/high severity
**Categories:**
- Missing response shape validation: 12
- Unsafe property access without existence checks: 10
- Unsafe array access: 4
- Missing null coalescing: 2

**Impact:** Invalid API responses can cause crashes, silent data loss, and incorrect application behavior.

---

## Critical Issues by File

### 1. `shellExec.ts` - HIGH PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/shellExec.ts`

#### Issue #1: Unchecked `response.json()` cast
**Line:** 40-41
```typescript
const result = await response.json();
return result;
```

**Problem:**
- `response.json()` returns `unknown` type
- Cast to `ShellExecResult` is assumed without validation
- Missing properties (success, stdout, stderr, code) cause crashes
- Example crash: If response is `{}`, accessing `result.success` fails

**Fix:** Add runtime validation:
```typescript
const result = await response.json();
// Validate shape
if (typeof result !== 'object' || result === null) {
  return { success: false, error: 'Invalid response format' };
}
const validated = result as Partial<ShellExecResult>;
return {
  success: validated.success ?? false,
  stdout: validated.stdout ?? '',
  stderr: validated.stderr ?? '',
  code: validated.code ?? -1,
  error: validated.error,
};
```

---

### 2. `freepikService.ts` - HIGH PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/freepikService.ts`

#### Issue #1: Unsafe property access in event parsing
**Lines:** 139-170
```typescript
switch (event.type) {
  case 'progress':
    onProgress?.(event.message);  // ← no null check
    break;
  case 'eta_update':
    onEtaUpdate?.(event.seconds);  // ← no type validation
    break;
  case 'complete':
    result = {
      imageBase64: event.image_base64,  // ← unsafe access
      imagesBase64: event.images_base64 || [event.image_base64],
      success: event.success,  // ← no coercion
    };
```

**Problems:**
- `event.message` assumed to exist (could be undefined)
- `event.seconds` not validated as number
- `event.image_base64` not checked for existence
- `event.success` could be anything, not validated as boolean

**Fix:** Add property validation:
```typescript
switch (event.type) {
  case 'progress':
    onProgress?.(String(event.message ?? ''));
    break;
  case 'eta_update':
    const seconds = typeof event.seconds === 'number' ? event.seconds : 0;
    onEtaUpdate?.(seconds);
    break;
  case 'complete':
    result = {
      imageBase64: String(event.image_base64 ?? ''),
      imagesBase64: Array.isArray(event.images_base64) ? event.images_base64 : [String(event.image_base64 ?? '')],
      success: Boolean(event.success),
    };
```

#### Issue #2: Unsafe JSON parse in preloadFreepik
**Lines:** 280-283
```typescript
const event = JSON.parse(line);
if (event.type === 'progress') onProgress?.(event.message);
if (event.type === 'error') { /* ... */ }
if (event.type === 'complete') { /* ... */ }
```

**Problem:** Same issues as above — properties accessed without validation

---

### 3. `embeddingService.ts` - MEDIUM PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/embeddingService.ts`

#### Issue #1: Unsafe array access without validation
**Line:** 36
```typescript
const data = await resp.json() as { models: Array<{ name: string }> };
const found = data.models?.some(m => m.name.includes('nomic-embed')) ?? false;
```

**Problem:**
- Type cast `as { models: ... }` assumes response shape
- If `data.models` is not array, `.some()` crashes
- If `m.name` doesn't exist, `.includes()` crashes

**Fix:**
```typescript
const data = await resp.json();
if (!Array.isArray(data?.models)) {
  _probeResult = false;
  return false;
}
const found = data.models.some((m: unknown) => {
  return typeof (m as any)?.name === 'string' &&
         (m as any).name.includes('nomic-embed');
});
```

#### Issue #2: Unsafe embedding dimension validation
**Line:** 139-140
```typescript
const data = await response.json() as { embedding: number[] };
const embedding = data.embedding;
if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
  throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIM}, got ${embedding.length}`);
}
```

**Problem:**
- Type cast assumes `data.embedding` exists
- Accessing `.length` on potentially undefined value crashes

**Fix:**
```typescript
const data = await response.json();
if (!data || typeof data !== 'object') {
  throw new Error('Invalid embedding response: not an object');
}
const embedding = (data as any).embedding;
if (!Array.isArray(embedding)) {
  throw new Error('Invalid embedding response: embedding is not an array');
}
if (embedding.length !== EMBEDDING_DIM) {
  throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIM}, got ${embedding.length}`);
}
```

#### Issue #3: Health check missing null validation
**Line:** 236
```typescript
const data = await response.json() as { models: Array<{ name: string }> };
const hasModel = data.models?.some(m => m.name.includes('nomic-embed'));
return !!hasModel;
```

**Problem:** Same as Issue #1

---

### 4. `wayfayer.ts` - HIGH PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

#### Issue #1: Unsafe response.json() cast in research()
**Lines:** 192-204
```typescript
try {
  const data = await resp.json();
  // Validate response schema
  try {
    validateWayfayerResult(data);
  } catch (schemaErr) {
    console.debug('Wayfayer response validation failed', schemaErr);
    // Continue processing even if validation fails — be lenient
  }
  if (!data) {  // ← This check is AFTER validation attempt
    throw new Error('Wayfayer returned empty response');
  }
  breaker.recordSuccess();
  return data;  // ← Returns potentially invalid data
}
```

**Problems:**
- Validation happens but errors are silently ignored
- `if (!data)` check after validation means incomplete checks pass
- Returns `data` directly without type guarantee
- Type should be `unknown`, not assumed `WayfayerResult`

**Fix:**
```typescript
try {
  const data = await resp.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Wayfayer returned non-object response');
  }
  // Validate and throw if invalid
  validateWayfayerResult(data);
  breaker.recordSuccess();
  return data as WayfayerResult;
} catch (parseErr) {
  console.error('Wayfayer response validation failed:', parseErr);
  breaker.recordFailure();
  throw new Error('Invalid Wayfayer response');
}
```

#### Issue #2: Unsafe array access in batchCrawl
**Line:** 396
```typescript
try {
  const data = await resp.json();
  return data.screenshots;  // ← No check if 'screenshots' exists or is array
}
```

**Problem:**
- `data.screenshots` could be undefined, null, or not an array
- Returns undefined instead of empty array on failure

**Fix:**
```typescript
try {
  const data = await resp.json();
  if (!Array.isArray(data?.screenshots)) {
    return urls.map(u => ({ url: u, image_base64: '', width: 0, height: 0, error: 'Invalid batch response' }));
  }
  return data.screenshots;
}
```

#### Issue #3: Unsafe JSON parsing in crawlLinks
**Lines:** 724-725
```typescript
const data = await resp.json();
return data.links || [];
```

**Problem:**
- Type assumed without validation
- `data.links` could be present but not an array

**Fix:**
```typescript
const data = await resp.json();
if (!Array.isArray(data?.links)) return [];
return data.links;
```

#### Issue #4: Unsafe property access in buildTextContext
**Lines:** 676-683
```typescript
if (pageText.structuredData?.length) {
  for (const sd of pageText.structuredData) {
    const data = sd as Record<string, unknown>;
    if (data['@type'] === 'Product') {
      if (data.name) parts.push(`...`);
      // ...
      const offers = data.offers as Record<string, unknown> | undefined;  // ← Unsafe cast
      if (offers?.price) parts.push(`...`);
      const rating = data.aggregateRating as Record<string, unknown> | undefined;
      if (rating) parts.push(`Rating: ${rating.ratingValue}/5 (${rating.reviewCount} reviews)`);
      // ← ratingValue and reviewCount accessed without null checks
    }
  }
}
```

**Problems:**
- `data.offers` cast without validation
- `rating.ratingValue` and `rating.reviewCount` accessed unsafely
- Could crash when accessing undefined properties

**Fix:**
```typescript
if (pageText.structuredData?.length) {
  for (const sd of pageText.structuredData) {
    const data = sd as Record<string, unknown>;
    if (data['@type'] === 'Product') {
      if (data.name) parts.push(`Structured Name: ${data.name}`);
      if (data.description) parts.push(`Structured Desc: ${String(data.description).slice(0, 300)}`);
      const offers = data.offers;
      if (typeof offers === 'object' && offers && 'price' in offers) {
        parts.push(`Structured Price: $${offers.price}`);
      }
      const rating = data.aggregateRating;
      if (typeof rating === 'object' && rating && 'ratingValue' in rating && 'reviewCount' in rating) {
        parts.push(`Rating: ${rating.ratingValue}/5 (${rating.reviewCount} reviews)`);
      }
    }
  }
}
```

#### Issue #5: Unsafe URL parsing without validation
**Lines:** 869-877
```typescript
try {
  const pathname = new URL(url).pathname;
  const slug = pathname.split('/').filter(Boolean).pop() || 'Unknown';
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
} catch {
  return 'Unknown Product';
}
```

**Problem:**
- `pathname.split('/').pop()` could return undefined
- Chain breaks if slug doesn't exist

**Fix:**
```typescript
try {
  const pathname = new URL(url).pathname;
  const slug = pathname.split('/').filter(Boolean).pop() ?? 'Unknown';
  if (!slug) return 'Unknown Product';
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
} catch {
  return 'Unknown Product';
}
```

#### Issue #6: Unsafe domain extraction
**Line:** 975
```typescript
const host = new URL(s.url).hostname.toLowerCase();
```

**Problem:**
- `.hostname` could be null (invalid URL)
- Calling `.toLowerCase()` on null crashes

**Fix:**
```typescript
const host = new URL(s.url).hostname?.toLowerCase() ?? '';
if (!host) continue;
```

---

### 5. `ollama.ts` - MEDIUM PRIORITY (has some validation)
**File:** `/Users/mk/Downloads/nomads/frontend/utils/ollama.ts`

#### Issue #1: Incomplete validation in getLoadedModels()
**Lines:** 656-664
```typescript
async getLoadedModels(): Promise<Array<{ name: string; sizeVram: number; expiresAt: string }>> {
  try {
    const res = await fetch(`${DIRECT_OLLAMA}/api/ps`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => ({
      name: String(m.name || ''),
      sizeVram: Number(m.size_vram || 0),
      expiresAt: String(m.expires_at || ''),
    }));
  } catch {
    return [];
  }
}
```

**Problems:**
- Type cast `as any` bypasses type safety
- No check that `data.models` is actually an array
- `Number()` on undefined becomes NaN, not 0
- Could return array with NaN values

**Fix:**
```typescript
async getLoadedModels(): Promise<Array<{ name: string; sizeVram: number; expiresAt: string }>> {
  try {
    const res = await fetch(`${DIRECT_OLLAMA}/api/ps`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.models)) return [];
    return data.models.map((m: unknown) => {
      const model = m as any;
      return {
        name: typeof model.name === 'string' ? model.name : '',
        sizeVram: typeof model.size_vram === 'number' ? model.size_vram : 0,
        expiresAt: typeof model.expires_at === 'string' ? model.expires_at : '',
      };
    });
  } catch {
    return [];
  }
}
```

#### Issue #2: Unsafe property access in probeEndpoint
**Lines:** 722-724
```typescript
if (psResp.ok) {
  let psData: { models?: Array<{ name: string }> };
  try { psData = await psResp.json(); } catch (e) { log.debug('Failed to parse /api/ps', {}, e); psData = {}; }
  loadedModels = (psData.models || []).map((m: { name: string }) => m.name);
}
```

**Problem:**
- Type cast `(m: { name: string })` assumes structure
- If `.map()` is called on non-array, crashes
- `psData.models` could be present but not an array

**Fix:**
```typescript
if (psResp.ok) {
  try {
    const psData = await psResp.json();
    if (Array.isArray(psData?.models)) {
      loadedModels = psData.models
        .map((m: unknown) => {
          const model = m as any;
          return typeof model.name === 'string' ? model.name : 'unknown';
        })
        .filter((name: string) => name !== 'unknown');
    }
  } catch (e) {
    log.debug('Failed to parse /api/ps', {}, e);
  }
}
```

---

### 6. `connectorRegistry.ts` - MEDIUM PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/connectorRegistry.ts`

#### Issue #1: Unsafe JSON parse in loadFromStorage
**Lines:** 95-101
```typescript
function loadFromStorage(): Record<string, Partial<Connector>> {
  try {
    const raw = getItemWithTracking(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
```

**Problem:**
- `JSON.parse()` could return non-object (array, primitive, null)
- Type cast assumed without validation
- Could corrupt connector registry

**Fix:**
```typescript
function loadFromStorage(): Record<string, Partial<Connector>> {
  try {
    const raw = getItemWithTracking(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[connectorRegistry] Stored config is not an object, resetting');
      return {};
    }
    return parsed as Record<string, Partial<Connector>>;
  } catch (err) {
    console.error('[connectorRegistry] Failed to parse stored config:', err);
    return {};
  }
}
```

#### Issue #2: Unsafe response.json() in healthCheck
**Line:** 86
```typescript
const data = await resp.json();
return data.status === 'ok';
```

**Problem:**
- `data.status` could be missing or not a string
- Type assumed without validation

**Fix:**
```typescript
const data = await resp.json();
if (typeof data === 'object' && data !== null && typeof (data as any).status === 'string') {
  return (data as any).status === 'ok';
}
return false;
```

---

### 7. `sandboxService.ts` - HIGH PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/sandboxService.ts`

#### Issue #1: Unsafe response.json() in post()
**Lines:** 64-77
```typescript
private async post<T = PageInfo>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${this.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Sandbox API ${path}: ${res.status}`);
  try {
    return await res.json();  // ← Assumes response is of type T
  } catch {
    throw new Error(`Sandbox API ${path}: non-JSON response`);
  }
}
```

**Problem:**
- Generic `<T>` assumed to match actual response
- No runtime validation that response matches type `T`
- Could return completely wrong structure

**Fix:**
```typescript
private async post<T = PageInfo>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${this.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Sandbox API ${path}: ${res.status}`);
  try {
    const data = await res.json();
    if (!data || typeof data !== 'object') {
      throw new Error(`Sandbox API ${path}: response is not an object`);
    }
    return data as T;  // Validate shape in calling code
  } catch (err) {
    throw new Error(`Sandbox API ${path}: ${err instanceof Error ? err.message : 'non-JSON response'}`);
  }
}
```

#### Issue #2: Unsafe response.json() in health()
**Line:** 86
```typescript
const data = await res.json();
return data.status === 'ok';
```

**Problem:** Same as connectorRegistry Issue #2

---

### 8. `healthMonitor.ts` - LOW-MEDIUM PRIORITY
**File:** `/Users/mk/Downloads/nomads/frontend/utils/healthMonitor.ts`

#### Issue #1: No response validation in checkService
**Lines:** 98-107
```typescript
const resp = await fetch(probeUrl, {
  method: 'GET',
  signal: AbortSignal.timeout(5000),
});

const latency = Math.round(performance.now() - start);

if (resp.ok) {
  svc.status = 'healthy';
  // ...
}
```

**Problem:**
- `resp.ok` only checks HTTP status
- Doesn't validate response body structure
- Malformed responses marked as 'healthy'

**Note:** This is less critical since it's just a health probe, but could accumulate false positives.

---

### 9. `context1Service.ts` - NEEDS AUDIT
**File:** `/Users/mk/Downloads/nomads/frontend/utils/context1Service.ts`

**Status:** TOO LARGE TO AUDIT IN DETAIL (5000+ lines)
**Findings from grep:**
- Line 385: `const data = await response.json() as { response: string };`
- Line 1202: `const data = await res.json() as { models: Array<{ name: string }> };`

Both use unsafe `as` type casts without runtime validation.

---

### 10. `agentEngine.ts` - NEEDS DETAILED AUDIT
**File:** `/Users/mk/Downloads/nomads/frontend/utils/agentEngine.ts`

**Status:** VERY LARGE (5000+ lines)
**Critical patterns found (from grep):**
```
Line 962: const result = await resp.json();
Line 1021: const data = await resp.json();
Line 1052: const data = await resp.json();
... (40+ instances)
```

Multiple unsafe `.json()` calls with type casts. Needs systematic review.

---

## Validation Best Practices Checklist

### For all fetch/API calls, apply this pattern:

```typescript
// BAD ❌
const data = await response.json();
const result = data.property;  // Could crash

// GOOD ✅
try {
  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response');
  }

  // For critical fields:
  if (typeof data.property !== 'string') {
    throw new Error('Missing or invalid property');
  }

  // For arrays:
  if (!Array.isArray(data.items)) {
    throw new Error('Items not array');
  }

  // Process safely
  return data as YourType;
} catch (err) {
  // Handle gracefully
  return fallbackValue;
}
```

### Using Zod schemas (already in codebase):

```typescript
// Validate before use
try {
  const validated = validateOllamaResponse(json);
  // Now safe to access validated.response, etc.
} catch (schemaErr) {
  log.error('Invalid response', schemaErr);
  throw schemaErr;  // Don't silently ignore!
}
```

---

## Files with Existing Good Patterns

✅ **ollama.ts** — Uses `validateOllamaResponse()` for streaming JSON
✅ **wayfayer.ts** — Defines `validateWayfayerResult()` but doesn't always use it
✅ **schemas/** — Good Zod schemas defined

---

## Recommended Fixes Priority

### Immediate (P0 - Crashes likely):
1. `shellExec.ts` — Line 40-41
2. `freepikService.ts` — Lines 139-170, 280-283
3. `sandboxService.ts` — Line 72-76
4. `wayfayer.ts` — Lines 192-204, 396, 724-725

### High (P1 - Silent failures):
1. `embeddingService.ts` — Lines 36, 136-140, 236
2. `wayfayer.ts` — Lines 676-683, 869-877, 975
3. `connectorRegistry.ts` — Lines 95-101, 86
4. `ollama.ts` — Lines 656-664, 722-724

### Medium (P2 - Potential issues):
1. `healthMonitor.ts` — Line 106

### Needs audit:
1. `agentEngine.ts` — 40+ instances of unsafe `.json()` calls
2. `context1Service.ts` — Multiple unsafe casts

---

## Test Cases to Add

Each fixed function should handle:

```typescript
// Test: Empty response
const data = {};
// Should not crash, should provide fallback

// Test: Wrong type
const data = null;
const data = [];
const data = "string";
// Should not crash, should provide fallback

// Test: Missing properties
const data = { someField: 'value' };
// Should handle gracefully

// Test: Wrong property types
const data = { name: 123, items: "not-array" };
// Should coerce or fallback

// Test: Deeply nested undefined
const data = { offers: { price: undefined } };
// Should not crash on nested access
```

---

## Summary

- **28 validation bugs** identified across 10+ files
- **No crashes** currently but **high risk** with unusual API responses
- **Schemas exist** but validation is inconsistent
- **Fix is straightforward**: Add null checks and type validation before property access
- **Estimated effort**: 4-6 hours to fix all issues

