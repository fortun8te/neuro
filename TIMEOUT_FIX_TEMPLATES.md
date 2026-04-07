# Ready-to-Apply Timeout Fix Templates

These are copy-paste ready code snippets for each critical fix.

---

## 1. workspace.ts — Add Timeout to All Shell Calls

**File:** `/Users/mk/Downloads/nomads/frontend/utils/workspace.ts`

### workspaceMkdir() — Line 37
```typescript
// BEFORE:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${target}"`, timeout: 5000 }),
});

// AFTER:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${target}"`, timeout: 5000 }),
  signal: AbortSignal.timeout(30_000),
});
```

### ensureWorkspace() — Line 91
```typescript
// BEFORE:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${path.replace('~', '$HOME')}"`, timeout: 5000 }),
});

// AFTER:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${path.replace('~', '$HOME')}"`, timeout: 5000 }),
  signal: AbortSignal.timeout(30_000),
});
```

### workspaceSave() — Lines 122, 139
```typescript
// FIRST CALL (mkdir): Line 122
// BEFORE:
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${dir}"`, timeout: 5000 }),
});

// AFTER:
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${dir}"`, timeout: 5000 }),
  signal: AbortSignal.timeout(30_000),
});

// SECOND CALL (write): Line 139
// BEFORE:
const shellResp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: cmd, timeout: 10000 }),
});

// AFTER:
const shellResp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: cmd, timeout: 10000 }),
  signal: AbortSignal.timeout(30_000),
});
```

### workspaceSaveBinary() — Lines 167, 184
```typescript
// FIRST CALL (mkdir): Line 167
// BEFORE:
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${dir}"`, timeout: 5000 }),
});

// AFTER:
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `mkdir -p "${dir}"`, timeout: 5000 }),
  signal: AbortSignal.timeout(30_000),
});

// SECOND CALL (write): Line 184
// BEFORE:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: cmd, timeout: 30000 }),
});

// AFTER:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: cmd, timeout: 30000 }),
  signal: AbortSignal.timeout(30_000),
});
```

### workspaceRead() — Line ~210
```typescript
// BEFORE:
const resp = await fetch('/api/file/read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: fullPath }),
});

// AFTER:
const resp = await fetch('/api/file/read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: fullPath }),
  signal: AbortSignal.timeout(10_000),
});
```

### workspaceList() — Line ~220
```typescript
// BEFORE:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `ls -lah "${path.replace('~', '$HOME')}"`, timeout: 5000 }),
});

// AFTER:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `ls -lah "${path.replace('~', '$HOME')}"`, timeout: 5000 }),
  signal: AbortSignal.timeout(10_000),
});
```

### workspaceDelete() — Line ~240
```typescript
// BEFORE:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `rm -rf "${path.replace('~', '$HOME')}"`, timeout: 10000 }),
});

// AFTER:
const resp = await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: `rm -rf "${path.replace('~', '$HOME')}"`, timeout: 10000 }),
  signal: AbortSignal.timeout(30_000),
});
```

---

## 2. nativeMacBridge.ts — Wrap bridgePost Function

**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/nativeMacBridge.ts`

**Replace lines 37-55:**

```typescript
// BEFORE:
async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await fetch(`${MAC_BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '(no body)');
    throw new Error(`Mac bridge ${path} failed: HTTP ${resp.status} — ${text}`);
  }

  return resp.json() as Promise<T>;
}

// AFTER:
async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs: number = 15_000,
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
      signal: controller.signal,
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

---

## 3. wayayerSession.ts — Close Function Timeout

**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/wayayerSession.ts`

**Replace lines 110-125:**

```typescript
// BEFORE:
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

// AFTER:
async close(): Promise<void> {
  if (!this.sessionId) return;
  try {
    await fetch(`${this.baseUrl}/session/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // best-effort close
  } finally {
    this.sessionId = null;
    desktopBus.emit({ type: 'browser_stream_stop' });
  }
}
```

---

## 4. shellExec.ts — Shell Execution Timeout

**File:** `/Users/mk/Downloads/nomads/frontend/utils/shellExec.ts`

**Replace line 23 function signature and line 25-31:**

```typescript
// BEFORE:
export async function shellExec(command: string): Promise<ShellExecResult> {
  try {
    const response = await fetch(`${SHELL_EXEC_ENDPOINT}/api/shell-exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

// AFTER:
export async function shellExec(command: string, timeoutMs: number = 30_000): Promise<ShellExecResult> {
  try {
    const response = await fetch(`${SHELL_EXEC_ENDPOINT}/api/shell-exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(timeoutMs),
    });
```

---

## 5. executorAgent.ts — Image Copy Shell Call

**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/executorAgent.ts`

**Line ~1529, replace fetch call:**

```typescript
// BEFORE:
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: `mkdir -p "${destDir}" && cp ${(savedFiles || []).map(f => `"${sessionDir}/${f}"`).join(' ')} "${destDir}/"`,
    timeout: 10000,
  }),
});

// AFTER:
await fetch('/api/shell', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: `mkdir -p "${destDir}" && cp ${(savedFiles || []).map(f => `"${sessionDir}/${f}"`).join(' ')} "${destDir}/"`,
    timeout: 10000,
  }),
  signal: AbortSignal.timeout(20_000),
});
```

---

## 6. visionAgent.ts — Screenshot Fetch Timeouts

**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/visionAgent.ts`

**Replace entire _fetchScreenshot function (lines 98-144):**

```typescript
// BEFORE:
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
      { signal },
    );
    if (resp.ok) {
      const json = await resp.json() as { screenshot?: string; image_base64?: string };
      const data = json.screenshot ?? json.image_base64 ?? '';
      if (data) {
        _cacheScreenshot(sessionId, data);
        return data;
      }
    }
  } catch (e) {
    log.debug('GET screenshot failed, trying POST fallback', { sessionId, error: e instanceof Error ? e.message : String(e) });
  }

  // Fallback: POST to /session/action screenshot
  try {
    const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/session/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, action: 'screenshot' }),
      signal,
    });
    if (resp.ok) {
      const json = await resp.json() as { image_base64?: string };
      const data = json.image_base64 ?? '';
      if (data) {
        _cacheScreenshot(sessionId, data);
        return data;
      }
    }
  } catch (e) {
    log.warn('POST screenshot fallback also failed', { sessionId }, e as Error);
  }

  return '';
}

// AFTER:
async function _fetchScreenshot(
  sessionId: string,
  signal?: AbortSignal,
  width = 1280,
  height = 800,
): Promise<string> {
  const timeout = 15_000;

  // Primary: GET endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const resp = await fetch(
        `${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/screenshot?width=${width}&height=${height}`,
        { signal: controller.signal },
      );
      if (resp.ok) {
        const json = await resp.json() as { screenshot?: string; image_base64?: string };
        const data = json.screenshot ?? json.image_base64 ?? '';
        if (data) {
          _cacheScreenshot(sessionId, data);
          return data;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    log.debug('GET screenshot failed, trying POST fallback', { sessionId, error: e instanceof Error ? e.message : String(e) });
  }

  // Fallback: POST to /session/action screenshot
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/session/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'screenshot' }),
        signal: controller.signal,
      });
      if (resp.ok) {
        const json = await resp.json() as { image_base64?: string };
        const data = json.image_base64 ?? '';
        if (data) {
          _cacheScreenshot(sessionId, data);
          return data;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    log.warn('POST screenshot fallback also failed', { sessionId }, e as Error);
  }

  return '';
}
```

---

## 7. wayfayer.ts — batchCrawl Timeout

**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

**Replace batchCrawl method (lines 230-255):**

```typescript
// BEFORE:
async batchCrawl(urls: string[], concurrency: number = 10, signal?: AbortSignal): Promise<BatchCrawlResult> {
  try {
    const resp = await fetch(`${getHost()}/crawl/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, concurrency, extract_mode: 'article' }),
      signal,
    });

    if (!resp.ok) {
      return { results: [], total: urls.length, success: 0 };
    }

    try {
      return await resp.json();
    } catch {
      console.error('Wayfayer: non-JSON response from /crawl/batch');
      return { results: [], total: urls.length, success: 0 };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error('Batch crawl error:', error);
    return { results: [], total: urls.length, success: 0 };
  }
},

// AFTER:
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

    if (!resp.ok) {
      return { results: [], total: urls.length, success: 0 };
    }

    try {
      return await resp.json();
    } catch {
      console.error('Wayfayer: non-JSON response from /crawl/batch');
      return { results: [], total: urls.length, success: 0 };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error('Batch crawl error:', error);
    return { results: [], total: urls.length, success: 0 };
  } finally {
    clearTimeout(timeoutId);
  }
},
```

---

## 8. wayfayer.ts — research() Timeout

**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

**Replace research method signature and fetch call (lines 135-178):**

```typescript
// BEFORE:
async research(
  query: string,
  numResults: number = 10,
  signal?: AbortSignal,
  freshness?: 'any' | 'week' | 'month',
): Promise<WayfayerResult> {
  // ...
  try {
    const resp = await fetch(`${getHost()}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

// AFTER:
async research(
  query: string,
  numResults: number = 10,
  signal?: AbortSignal,
  freshness?: 'any' | 'week' | 'month',
  timeoutMs: number = 120_000,
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
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) {
        clearTimeout(timeoutId);
        breaker.recordFailure();
        throw new DOMException('Aborted', 'AbortError');
      }
      try {
        const resp = await fetch(`${getHost()}/research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        // ... rest of logic ...
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }
}
```

---

## 9. visionAgent.ts — locateElement Timeout

**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/visionAgent.ts`

**Replace locateElement function (lines 265-287):**

```typescript
// BEFORE:
export async function locateElement(
  query: string,
  screenshotBase64: string,
  signal?: AbortSignal,
): Promise<ElementLocation> {
  const prompt = `Find: "${query}"\nReturn JSON: { found, x, y, elementDescription, confidence }`;

  let response = '';
  await ollamaService.generateStream(prompt, LOCATE_SYSTEM, {
    model: getVisionModel(),
    ...(screenshotBase64 ? { images: [screenshotBase64] } : {}),
    temperature: 0.1,
    num_predict: 200,
    signal,
    onChunk: (chunk: string) => { response += chunk; },
  });

  return parseJsonSafe<ElementLocation>(response, {
    found: false,
    elementDescription: 'Could not parse vision response',
    confidence: 'low',
  });
}

// AFTER:
export async function locateElement(
  query: string,
  screenshotBase64: string,
  signal?: AbortSignal,
  timeoutMs: number = 30_000,
): Promise<ElementLocation> {
  const prompt = `Find: "${query}"\nReturn JSON: { found, x, y, elementDescription, confidence }`;

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
      signal: controller.signal,
      onChunk: (chunk: string) => { response += chunk; },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  return parseJsonSafe<ElementLocation>(response, {
    found: false,
    elementDescription: 'Could not parse vision response',
    confidence: 'low',
  });
}
```

---

## 10. visionAgent.ts — verifyState Timeout

**File:** `/Users/mk/Downloads/nomads/frontend/utils/computerAgent/visionAgent.ts`

**Replace verifyState function (lines 299-327), apply same pattern as locateElement above**

---

## 11. wayfayer.ts — analyzeProductPage Timeout Wrapper

**File:** `/Users/mk/Downloads/nomads/frontend/utils/wayfayer.ts`

**Update parseProductPageVision call signature and add timeout wrapper:**

```typescript
// BEFORE (line 539):
async function parseProductPageVision(
  visionOutput: string,
  signal?: AbortSignal
): Promise<Partial<ProductPageAnalysis>> {

// AFTER:
async function parseProductPageVision(
  visionOutput: string,
  signal?: AbortSignal,
  timeoutMs: number = 45_000,
): Promise<Partial<ProductPageAnalysis>> {
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
    // ... existing logic ...
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

**Also update caller (line ~626) to pass signal:**
```typescript
// BEFORE:
const pageData = await screenshotService.analyzePage(url, { ... });

// AFTER:
const pageData = await screenshotService.analyzePage(url, {
  viewportWidth: 1280,
  viewportHeight: 1080,
  quality: 70,
  signal,  // ADD THIS
});

// Then pass signal through to vision parsing:
const parsed = await parseProductPageVision(pageData.page_text, signal, 45_000);
```

---

## Verification Checklist

After applying each fix:

- [ ] File compiles (no TypeScript errors): `npm run build`
- [ ] No console errors in dev mode: `npm run dev`
- [ ] Function still accessible from callers
- [ ] Timeout value is reasonable for the operation
- [ ] Abort signal is properly propagated through finally blocks
- [ ] No new memory leaks (timers are cleared)

---

**Total fixes:** 11 files, 13 timeout/abort bugs
**Estimated implementation time:** 2-3 hours
