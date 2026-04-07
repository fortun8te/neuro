# Timeout & Cancellation Bug Fixes — Implementation Checklist

## P0: Critical (Blocking Operations)

### [ ] 1. workspace.ts — Shell API Calls (6 functions)
**File:** `/Users/mk/Downloads/nomads/frontend/utils/workspace.ts`

**Lines to fix:** 37, 91, 122, 139, 167, 184, ~220, ~240

**Current code example (line 37):**
```typescript
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${target}"`, timeout: 5000 }),
});
```

**Required fix:**
```typescript
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${target}"`, timeout: 5000 }),
  signal: AbortSignal.timeout(30_000),  // ADD THIS LINE
});
```

**Functions affected:**
- workspaceMkdir() [line 37]
- ensureWorkspace() [line 91]
- workspaceSave() [line 122, 139]
- workspaceSaveBinary() [line 167, 184]
- workspaceRead() [line ~210]
- workspaceList() [line ~220]
- workspaceDelete() [line ~240]

**Estimated effort:** 10 minutes

---

### [ ] 2. nativeMacBridge.ts — All Desktop Actions
**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/nativeMacBridge.ts`

**Lines to fix:** 37-55 (bridgePost wrapper function)

**Current code:**
```typescript
async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await fetch(`${MAC_BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,  // ONLY USER SIGNAL
  });
  // ...
}
```

**Required fix:**
```typescript
async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs: number = 15_000,  // ADD PARAMETER
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const resp = await fetch(`${MAC_BRIDGE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,  // USE COMPOSED SIGNAL
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '(no body)');
      throw new Error(`Mac bridge ${path} failed: HTTP ${resp.status} — ${text}`);
    }

    return resp.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Affected public methods (will use default 15s timeout):**
- takeScreenshot()
- clickAt()
- typeText()
- pressHotkey()
- scrollAt()

**Estimated effort:** 15 minutes (test all 5 methods)

---

### [ ] 3. wayayerSession.ts — Session Cleanup
**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/wayayerSession.ts`

**Lines to fix:** 114

**Current code:**
```typescript
async close(): Promise<void> {
  if (!this.sessionId) return;
  try {
    await fetch(`${this.baseUrl}/session/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId }),
    });
  } catch {
    // best-effort close
  } finally {
    this.sessionId = null;
    desktopBus.emit({ type: 'browser_stream_stop' });
  }
}
```

**Required fix:**
```typescript
async close(): Promise<void> {
  if (!this.sessionId) return;
  try {
    await fetch(`${this.baseUrl}/session/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId }),
      signal: AbortSignal.timeout(5_000),  // ADD THIS
    });
  } catch {
    // best-effort close
  } finally {
    this.sessionId = null;
    desktopBus.emit({ type: 'browser_stream_stop' });
  }
}
```

**Estimated effort:** 5 minutes

---

### [ ] 4. visionAgent.ts — Screenshot Cache Fetch
**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/visionAgent.ts`

**Lines to fix:** 107, 125

**Current code:**
```typescript
async function _fetchScreenshot(
  sessionId: string,
  signal?: AbortSignal,
  width = 1280,
  height = 800,
): Promise<string> {
  // Primary: GET endpoint
  try {
    const resp = await fetch(
      `${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/screenshot?width=${width}&height=${height}`,
      { signal },  // NO TIMEOUT
    );
    // ...
  } catch (e) {
    log.debug('GET screenshot failed, trying POST fallback', ...);
  }

  // Fallback: POST to /session/action screenshot
  try {
    const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/session/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, action: 'screenshot' }),
      signal,  // NO TIMEOUT
    });
    // ...
  } catch (e) {
    log.warn('POST screenshot fallback also failed', ...);
  }

  return '';
}
```

**Required fix:**
```typescript
async function _fetchScreenshot(
  sessionId: string,
  signal?: AbortSignal,
  width = 1280,
  height = 800,
): Promise<string> {
  const timeout = 15_000;  // 15s for screenshot

  // Primary: GET endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const resp = await fetch(
        `${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/screenshot?width=${width}&height=${height}`,
        { signal: controller.signal },  // COMPOSED SIGNAL
      );
      // ...
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    log.debug('GET screenshot failed, trying POST fallback', ...);
  }

  // Fallback: POST to /session/action screenshot
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/session/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'screenshot' }),
        signal: controller.signal,  // COMPOSED SIGNAL
      });
      // ...
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    log.warn('POST screenshot fallback also failed', ...);
  }

  return '';
}
```

**Estimated effort:** 20 minutes (careful with fallback logic)

---

### [ ] 5. shellExec.ts — Shell API Wrapper
**File:** `/Users/mk/Downloads/nomads/frontend/utils/shellExec.ts`

**Lines to fix:** 25

**Current code:**
```typescript
export async function shellExec(command: string): Promise<ShellExecResult> {
  try {
    const response = await fetch(`${SHELL_EXEC_ENDPOINT}/api/shell-exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });
    // ...
  } catch (error) {
    // ...
  }
}
```

**Required fix:**
```typescript
export async function shellExec(command: string, timeoutMs: number = 30_000): Promise<ShellExecResult> {
  try {
    const response = await fetch(`${SHELL_EXEC_ENDPOINT}/api/shell-exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(timeoutMs),  // ADD THIS
    });
    // ...
  } catch (error) {
    // ...
  }
}
```

**Estimated effort:** 5 minutes

---

### [ ] 6. executorAgent.ts — Shell API Image Copy
**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/executorAgent.ts`

**Lines to fix:** 1529

**Current code:**
```typescript
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: `mkdir -p "${destDir}" && cp ${(savedFiles || []).map(f => `"${sessionDir}/${f}"`).join(' ')} "${destDir}/"`,
    timeout: 10000,
  }),
});
```

**Required fix:**
```typescript
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: `mkdir -p "${destDir}" && cp ${(savedFiles || []).map(f => `"${sessionDir}/${f}"`).join(' ')} "${destDir}/"`,
    timeout: 10000,
  }),
  signal: AbortSignal.timeout(20_000),  // ADD THIS
});
```

**Estimated effort:** 5 minutes

---

## P1: High Priority (Improves Experience)

### [ ] 7. wayfayer.ts — batchCrawl() Timeout
**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

**Lines to fix:** 231

**Current code:**
```typescript
async batchCrawl(urls: string[], concurrency: number = 10, signal?: AbortSignal): Promise<BatchCrawlResult> {
  try {
    const resp = await fetch(`${getHost()}/crawl/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, concurrency, extract_mode: 'article' }),
      signal,  // NO TIMEOUT
    });
    // ...
  } catch (error) {
    if (signal?.aborted) throw error;
    // ...
  }
}
```

**Required fix:**
```typescript
async batchCrawl(urls: string[], concurrency: number = 10, signal?: AbortSignal): Promise<BatchCrawlResult> {
  const controller = new AbortController();
  const timeout = urls.length * 3000 + 10000;  // 3s per URL + 10s overhead
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const resp = await fetch(`${getHost()}/crawl/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, concurrency, extract_mode: 'article' }),
      signal: controller.signal,
    });
    // ...
  } catch (error) {
    if (signal?.aborted) throw error;
    // ...
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Estimated effort:** 15 minutes

---

### [ ] 8. wayfayer.ts — research() Timeout
**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

**Lines to fix:** 172

**Current code:**
```typescript
async research(
  query: string,
  numResults: number = 10,
  signal?: AbortSignal,
  freshness?: 'any' | 'week' | 'month',
): Promise<WayfayerResult> {
  // ...
  const resp = await fetch(`${getHost()}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,  // NO TIMEOUT
  });
  // ...
}
```

**Required fix:**
```typescript
async research(
  query: string,
  numResults: number = 10,
  signal?: AbortSignal,
  freshness?: 'any' | 'week' | 'month',
  timeoutMs: number = 120_000,  // ADD PARAMETER
): Promise<WayfayerResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const resp = await fetch(`${getHost()}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,  // COMPOSED SIGNAL
    });
    // ...
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    // ...
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Estimated effort:** 15 minutes

---

### [ ] 9. visionAgent.ts — locateElement() and verifyState() Timeout
**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/visionAgent.ts`

**Lines to fix:** 265-287, 299-327

**Current code (locateElement):**
```typescript
export async function locateElement(
  query: string,
  screenshotBase64: string,
  signal?: AbortSignal,
): Promise<ElementLocation> {
  const prompt = `Find: "${query}"\nReturn JSON: ...`;

  let response = '';
  await ollamaService.generateStream(prompt, LOCATE_SYSTEM, {
    model: getVisionModel(),
    ...(screenshotBase64 ? { images: [screenshotBase64] } : {}),
    temperature: 0.1,
    num_predict: 200,
    signal,  // RELIES ON OLLAMA'S INTERNAL TIMEOUT
    onChunk: (chunk: string) => { response += chunk; },
  });

  return parseJsonSafe<ElementLocation>(response, { /* fallback */ });
}
```

**Required fix (add wrapper):**
```typescript
export async function locateElement(
  query: string,
  screenshotBase64: string,
  signal?: AbortSignal,
  timeoutMs: number = 30_000,  // ADD PARAMETER
): Promise<ElementLocation> {
  const prompt = `Find: "${query}"\nReturn JSON: ...`;

  let response = '';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    await ollamaService.generateStream(prompt, LOCATE_SYSTEM, {
      model: getVisionModel(),
      ...(screenshotBase64 ? { images: [screenshotBase64] } : {}),
      temperature: 0.1,
      num_predict: 200,
      signal: controller.signal,  // COMPOSED SIGNAL
      onChunk: (chunk: string) => { response += chunk; },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  return parseJsonSafe<ElementLocation>(response, { /* fallback */ });
}
```

**Apply same fix to verifyState() (line 299)**

**Estimated effort:** 20 minutes

---

### [ ] 10. wayfayer.ts — analyzeProductPage LLM Call
**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

**Lines to fix:** 539-609

**Current code:**
```typescript
async function parseProductPageVision(
  visionOutput: string,
  signal?: AbortSignal
): Promise<Partial<ProductPageAnalysis>> {
  // ...
  const response = await ollamaService.generateStream(
    extractionPrompt,
    'Extract product page data into structured JSON.',
    { model: getResearchModelConfig().researcherSynthesisModel, signal }  // NO EXPLICIT TIMEOUT
  );
  // ...
}
```

**Required fix:**
```typescript
async function parseProductPageVision(
  visionOutput: string,
  signal?: AbortSignal,
  timeoutMs: number = 45_000  // ADD PARAMETER
): Promise<Partial<ProductPageAnalysis>> {
  // ...
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await ollamaService.generateStream(
      extractionPrompt,
      'Extract product page data into structured JSON.',
      { model: getResearchModelConfig().researcherSynthesisModel, signal: controller.signal }
    );
    // ...
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Update caller (line 611 analyzeProductPage) to pass signal through:**
```typescript
export async function analyzeProductPage(
  url: string,
  productName: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<ProductPageAnalysis> {
  // ...
  const parsed = await parseProductPageVision(pageData.page_text, signal, 45_000);  // PASS SIGNAL
  // ...
}
```

**Estimated effort:** 20 minutes

---

## P2: Medium Priority (Nice-to-Have)

### [ ] 11. deepResearchOrchestrator.ts — Multi-Iteration Timeout
**File:** `/Users/mk/Downloads/nomads/frontend/utils/deepResearchOrchestrator.ts`

**Add overall timeout wrapper around research loop (estimated line ~150-200)**

**Pattern to apply:**
```typescript
// Wrap entire orchestration with timeout
const orchestration = Promise.race([
  performResearchOrchestration(signal),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Research exceeded 5-minute timeout')), 5 * 60_000)
  ),
]);
```

**Estimated effort:** 25 minutes

---

### [ ] 12. connectorRegistry.ts — Promise.allSettled Timeout
**File:** `/Users/mk/Downloads/nomads/frontend/utils/connectorRegistry.ts`

**Wrap health check array with timeout:**
```typescript
// BEFORE:
await Promise.allSettled(names.map(n => this.checkService(n)));

// AFTER:
await Promise.race([
  Promise.allSettled(names.map(n => this.checkService(n))),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Health check timeout')), 30_000)
  ),
]);
```

**Estimated effort:** 10 minutes

---

### [ ] 13. sessionCheckpoint.ts — Database Write Timeout
**File:** `/Users/mk/Downloads/nomads/frontend/utils/sessionCheckpoint.ts`

**Pattern:**
```typescript
// Wrap IndexedDB writes with timeout
await Promise.race([
  Promise.all(updates),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DB write timeout')), 10_000)
  ),
]);
```

**Estimated effort:** 10 minutes

---

## Testing Checklist

After implementing all fixes:

- [ ] Run `npm run build` — verify no TypeScript errors
- [ ] Run `npm run dev` — verify app starts
- [ ] Test workspace file operations (create/read/write/delete)
- [ ] Test desktop automation clicks/scroll/type (if Mac bridge running)
- [ ] Test Wayfayer research operations
- [ ] Test vision model calls (element locate, state verify)
- [ ] Simulate network timeout: DevTools → Network → Throttling
- [ ] Simulate server hang: Stop Wayfayer/Ollama, verify graceful timeout
- [ ] Verify abort signals propagate correctly (no hanging promises)

---

## Estimated Total Effort

| Priority | Count | Effort |
|----------|-------|--------|
| P0 | 6 | 60 min |
| P1 | 4 | 70 min |
| P2 | 3 | 45 min |
| **TOTAL** | **13** | **175 min** (~3 hours) |

---

## Implementation Order

1. **Start with P0** (critical path operations)
   - workspace.ts (60 min)
   - nativeMacBridge.ts (15 min)
   - wayayerSession.ts (5 min)

2. **Then P1** (high-impact operations)
   - visionAgent.ts (20 min)
   - wayfayer.ts research/batchCrawl (30 min)

3. **Finally P2** (orchestration-level)
   - deepResearchOrchestrator.ts (25 min)
   - connectorRegistry.ts (10 min)
   - sessionCheckpoint.ts (10 min)

---

**Created:** 2026-04-06
**Status:** Ready to implement
