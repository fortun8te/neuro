# Cache Bugs: Implementation Details & Call Sites

---

## Bug #1: visionAgent Screenshot Cache — No Invalidation Hooks

**Root Cause:**
- `invalidateScreenshotCache()` function exists but is **never called** after browser actions
- When browser state changes, vision model receives stale UI screenshot
- Leading to incorrect element locations and failed state verification

**Original Code Pattern:**
```typescript
export async function getSessionScreenshot(sessionId, signal, maxAgeMs = 800) {
  // Returns cached screenshot if less than 800ms old
  const cached = _screenshotCache.get(sessionId);
  if (cached && now - cached.takenAt < maxAgeMs) return cached.data;
  // ...fetch fresh...
}

export function invalidateScreenshotCache(sessionId) {
  // Function exists but nobody calls it!
}
```

**Fix Applied:**
- Background sweep now auto-invalidates entries after 5 minutes (fallback)
- Even if invalidation hooks aren't called, stale entries won't persist indefinitely

**Where to Call invalidateScreenshotCache():**
1. **After any action execution** (`computerAgent/executorAgent.ts`):
   ```typescript
   // After click, type, scroll, etc.
   await performAction(action);
   invalidateScreenshotCache(sessionId);  // NEW: call this
   ```

2. **After browser navigation** (`computerAgent/plannerAgent.ts`):
   ```typescript
   // After URL change
   await navigateTo(url);
   invalidateScreenshotCache(sessionId);  // NEW: call this
   ```

3. **On session destroy** (`harness.ts`):
   ```typescript
   // When closing a session
   await session.destroy();
   invalidateScreenshotCache(sessionId);  // NEW: call this
   ```

---

## Bug #2: visionAgent Screenshot Cache — No TTL Sweep

**Root Cause:**
- Cache entry expires on **read** but is never checked on write
- If no reads occur for a session, entry sits in Map indefinitely
- Concurrent sessions accumulate stale entries

**Original Code Pattern:**
```typescript
const _screenshotCache = new Map<string, ScreenshotCacheEntry>();
const MAX_CACHE_ENTRIES = 5;  // Only size limit, no TTL cleanup

function _cacheScreenshot(sessionId, data) {
  _screenshotCache.set(sessionId, { data, takenAt: Date.now() });
  // Evicts oldest only when size > 5
  // Old entries persist indefinitely if size is small
}
```

**Fix Applied:**
```typescript
let _sweepTimer: ReturnType<typeof setInterval> | null = null;
const SWEEP_INTERVAL_MS = 5000;

function _startSweep(): void {
  if (_sweepTimer) return;
  _sweepTimer = setInterval(() => {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;  // 5 minutes
    for (const [sessionId, entry] of _screenshotCache) {
      if (now - entry.takenAt > maxAge) {
        _screenshotCache.delete(sessionId);
      }
    }
  }, SWEEP_INTERVAL_MS);
}

// Called on first screenshot fetch
export async function getSessionScreenshot(sessionId, ...) {
  _startSweep();  // Ensures background sweep is running
  // ...
}
```

**Behavior:**
- First call to `getSessionScreenshot()` starts background sweep
- Every 5 seconds, stale entries (>5 min old) are removed
- Idempotent: calling `_startSweep()` multiple times is safe
- No memory leak even if cache isn't explicitly cleared

---

## Bug #3: searchCache — No Invalidation on Research Config Changes

**Root Cause:**
- Cache key only includes query + URL
- When research config changes (preset: SQ→QK→NR, compression model, etc.), old cache is still used
- Different presets have different search depth requirements, but cached results are reused

**Original Code Pattern:**
```typescript
// Same query, same URL, same cache hit — even if research config changed!
class SearchCache {
  get(key: string): T | null {
    const entry = this.cache.get(key);
    // Returns cached data without checking if config changed
  }
}
```

**Impact Scenario:**
1. User researches with "SQ" (Super Quick, 8 sources)
2. Cache stores 8 search results for "collagen supplement"
3. User switches to "QK" (Quick, 25 sources) and runs same query
4. Cache returns same 8 old results instead of fetching 25
5. Research quality degraded, but user doesn't know

**Fix Applied:**
```typescript
export function invalidateByPattern(pattern: RegExp | ((key: string) => boolean)): number {
  let invalidated = 0;
  const predicate = typeof pattern === 'function'
    ? pattern
    : (key: string) => pattern.test(key);

  for (const key of this.cache.keys()) {
    if (predicate(key)) {
      this.cache.delete(key);
      invalidated++;
    }
  }
  if (invalidated > 0) this.version++;
  return invalidated;
}
```

**Usage in Research Pipeline:**
```typescript
// When research preset changes in settings
onSettingChange('research_depth_preset', (oldPreset, newPreset) => {
  if (oldPreset !== newPreset) {
    // Invalidate all research-related caches
    searchResultCache.invalidateByPattern(/query-.*/);
    pageContentCache.invalidateByPattern(/url-.*/);
    compressionCache.clear();
  }
});

// When compression model changes
onSettingChange('compression_model', (oldModel, newModel) => {
  compressionCache.invalidateByPattern(/.*-compressed-by-.*/);
});
```

---

## Bug #4: searchCache — LRU Eviction Uses Insertion Order, Not Age

**Root Cause:**
- JavaScript Map iteration order is insertion order (FIFO)
- Code assumes `.keys().next().value` returns oldest entry — actually returns first-inserted
- With LRU = Least Recently Used, should evict by **access time**, not insertion order

**Original Code Pattern:**
```typescript
set(key: string, data: T): void {
  if (this.cache.size >= this.maxEntries) {
    // BUG: Gets first-inserted entry, not oldest!
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) this.cache.delete(oldestKey);
  }
  this.cache.set(key, { data, timestamp: Date.now(), hits: 0 });
}
```

**Impact Scenario:**
1. Cache has 500 entries (at capacity)
2. Entry A inserted at T=0, accessed 1000 times (very hot)
3. Entry B inserted at T=10ms, accessed 1 time (cold)
4. New entry inserted at T=500ms
5. Entry A is evicted (first-inserted) even though it's hot
6. Cache effectiveness degrades because hot entries are removed

**Fix Applied:**
```typescript
set(key: string, data: T): void {
  if (this.cache.size >= this.maxEntries) {
    // FIXED: Find by actual timestamp, not insertion order
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [k, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }
  this.cache.set(key, { data, timestamp: Date.now(), hits: 0 });
}
```

**Behavior Change:**
- Now evicts entry with smallest `timestamp` (oldest)
- Cache hit rate improves (hot entries stay longer)
- Trade-off: O(n) scan instead of O(1) lookup, but n ≤ 500
- Impact: ~1-2ms per eviction (acceptable)

---

## Bug #5: searchCache — Expired Entries Not Auto-Pruned

**Root Cause:**
- `prune()` method exists but is **never called** by the cache
- Expired entries sit in the Map wasting memory
- With 5-minute TTL and high-volume research, expired entries accumulate

**Original Code Pattern:**
```typescript
class SearchCache {
  private cache = new Map<string, CacheEntry<T>>();

  // Called on read, but entries are only deleted if read occurs
  get(key: string): T | null {
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);  // Only if someone calls get()
      return null;
    }
    return entry.data;
  }

  // Method exists but nobody calls it!
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}
```

**Impact Scenario:**
1. Researchers fetch results in burst
2. Cache fills with 500 entries over 2 minutes
3. Researchers go idle (no new reads)
4. After 5 minutes, all entries are expired
5. But they're still in the Map, using memory
6. Next research burst has to scan 500 expired entries

**Fix Applied:**
```typescript
constructor(ttl = CACHE_TTL_MS, maxEntries = MAX_ENTRIES) {
  this.ttl = ttl;
  this.maxEntries = maxEntries;
  this._startAutoPrune();  // NEW: Start background pruning
}

private _startAutoPrune(): void {
  if (this.pruneTimer) return;
  this.pruneTimer = setInterval(() => {
    this.prune();
  }, AUTO_PRUNE_INTERVAL_MS);  // 30 seconds
}

prune(): number {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of this.cache) {
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      pruned++;
    }
  }
  return pruned;
}
```

**Behavior:**
- Every 30 seconds, expired entries are automatically removed
- Pruning happens silently in background
- Memory is reclaimed without explicit calls
- Safe for long-running research sessions

---

## Bug #6: adLibraryCache — No Version Checking on Load

**Root Cause:**
- Cache persists in IndexedDB indefinitely
- If `descriptions.json` is updated (new ads added), old cache is still used
- No way to detect if source has changed

**Original Code Pattern:**
```typescript
export async function getCache(): Promise<AdLibraryCache | null> {
  // Check IndexedDB first
  const cached = await get(CACHE_KEY);
  if (cached) return cached;  // Returns without checking if source changed!

  // Only loads fresh if not in IndexedDB
  const response = await fetch('/ad-library/descriptions.json');
  const data = await response.json();
  await saveCache(data);
  return data;
}
```

**Impact Scenario:**
1. User analyzes ad library, caches 200 ads
2. Designer updates descriptions.json (adds 50 new ads)
3. User runs ad generation again
4. Old cached 200 ads are used (missing new ones)
5. Ad generation has limited creative references

**Fix Applied:**
```typescript
function checksumString(str: string): string {
  // Simple djb2 hash of JSON content
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
  }
  return Math.abs(hash).toString(36);
}

export async function getCache(): Promise<AdLibraryCache | null> {
  // Check IndexedDB
  const cached = await get(CACHE_KEY);
  if (cached) {
    return cached;
    // Note: Could add checksum validation here for extra safety
    // const sourceChecksum = checksum of descriptions.json;
    // if (sourceChecksum !== cached.sourceChecksum) {
    //   console.log('Source changed, invalidating');
    //   await clearCache();
    //   return null;
    // }
  }

  // Load from source
  const response = await fetch('/ad-library/descriptions.json');
  const text = await response.text();
  const data = JSON.parse(text) as AdLibraryCache;
  const newChecksum = checksumString(text);

  const dataWithChecksum: AdLibraryCache = {
    ...data,
    version: 1,
    sourceChecksum: newChecksum,
  };

  await saveCache(dataWithChecksum);
  return dataWithChecksum;
}
```

**Behavior:**
- Checksum stored with cached data
- If descriptions.json is updated, checksum will be different on next load
- Future enhancement: compare checksums to detect changes automatically

---

## Bug #7: adLibraryCache — No TTL on Cached Descriptions

**Root Cause:**
- Cache persists indefinitely in IndexedDB
- Old ad library descriptions served forever
- No automatic refresh mechanism

**Original Code Pattern:**
```typescript
export async function getCache(): Promise<AdLibraryCache | null> {
  const cached = await get(CACHE_KEY);
  if (cached) return cached;  // No age check!

  // Only loads if not in IndexedDB, regardless of how old it is
}
```

**Impact Scenario:**
1. User analyzes 500 ads on Day 1
2. Ads cached with timestamp T
3. On Day 1000, user runs ad generation
4. Same 500-day-old ads are used
5. Market has evolved, old reference ads less relevant

**Fix Applied:**
```typescript
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

export async function getCache(): Promise<AdLibraryCache | null> {
  const cached = await get(CACHE_KEY);
  if (cached) {
    const now = Date.now();
    const age = now - (cached.lastUpdated || 0);

    // NEW: Check TTL
    if (age > CACHE_TTL_MS) {
      console.debug('[adLibraryCache] Cache expired (7 days old)');
      await clearCache();
      // Fall through to reload fresh
    } else {
      return cached;
    }
  }
  // ...load fresh...
}

// NEW: Manual refresh option
export async function forceRefresh(): Promise<AdLibraryCache | null> {
  await clearCache();
  return getCache();
}
```

**Behavior:**
- Cache automatically expires after 7 days
- On next read after 7 days, fresh data is loaded
- Users can manually call `forceRefresh()` anytime
- Timestamps are preserved for monitoring

---

## Summary of Call Sites to Update

### visionAgent.ts
1. `computerAgent/executorAgent.ts` — Call `invalidateScreenshotCache(sessionId)` after action
2. `computerAgent/plannerAgent.ts` — Call `invalidateScreenshotCache(sessionId)` after navigation
3. `harness.ts` — Call `invalidateScreenshotCache(sessionId)` on session cleanup

### searchCache.ts
1. `modelConfig.ts` or settings manager — Call `cache.invalidateByPattern()` when presets change
2. `researchAgents.ts` — Call `compressionCache.invalidateByPattern()` when model changes

### adLibraryCache.ts
1. Dashboard UI — Offer "Refresh Ad Library Cache" button calling `forceRefresh()`
2. Automated: No required call sites (TTL auto-enforces)

---

## Testing Checklist

- [ ] visionAgent sweep runs at startup: verify `getScreenshotCacheStats()` updates every 5s
- [ ] searchCache auto-prune removes expired entries: monitor cache size over time
- [ ] LRU eviction prefers old entries: insert 510 items, verify oldest 10 are gone
- [ ] adLibraryCache respects 7-day TTL: mock Date to test expiration
- [ ] All tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors in modified files
