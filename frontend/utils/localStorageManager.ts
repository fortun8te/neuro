/**
 * localStorageManager.ts — Quota-aware localStorage management with LRU eviction
 *
 * Handles QuotaExceededError by:
 * 1. Tracking access time for all localStorage keys (via metadata)
 * 2. Implementing LRU (Least Recently Used) eviction
 * 3. Preserving critical keys (auth, user prefs) during cleanup
 * 4. Retrying setItem after eviction
 * 5. Logging all evictions for debugging
 */

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────

const METADATA_KEY = '__localStorage_metadata__';
const CRITICAL_KEYS = new Set([
  'authToken',
  'user',
  'expiresAt',
  'theme',
  'animations',
  'nomads_user_email',
  'harness_permission_mode',
  'neuro_user_avatar_seed',
  'neuro_rewrite_enabled',
  'neuro_max_subagents',
  'neuro_auto_parallel',
  'neuro_infrastructure_mode',
  'autoLaunchDocker',
  'CODE_MODE',
  'CODE_PERMISSION',
  'sound_enabled',
  'sound_volume',
  // Campaign context and cycle storage
  'campaign_context',
  'campaign_list',
  'cycle_data',
  'cycle_history',
]);

interface KeyMetadata {
  key: string;
  lastAccessedAt: number;
  size: number; // Approximate size in bytes
  accessCount: number;
  isCritical: boolean;
}

interface StorageMetadata {
  keys: Record<string, KeyMetadata>;
  lastCleanupAt: number;
  evictionLog: Array<{
    timestamp: number;
    freedBytes: number;
    keysRemoved: string[];
  }>;
}

// ─────────────────────────────────────────────────────────────
// Metadata Update Queueing (Race Condition Fix)
// ─────────────────────────────────────────────────────────────

/** Serializes metadata read-modify-write operations to prevent concurrent updates from losing data */
let _metadataUpdateQueue: Promise<void> = Promise.resolve();

function enqueueMetadataUpdate(fn: () => void): Promise<void> {
  _metadataUpdateQueue = _metadataUpdateQueue
    .catch(() => {/* previous failure — proceed */})
    .then(() => {
      fn();
      return Promise.resolve();
    });
  return _metadataUpdateQueue;
}

// ─────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────

function estimateSize(value: string): number {
  // Each character is roughly 1-2 bytes in UTF-16 encoding
  // This is approximate but good enough for eviction decisions
  return new Blob([value]).size;
}

function isStorageMetadata(obj: unknown): obj is StorageMetadata {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const m = obj as Record<string, unknown>;
  return (
    typeof m.keys === 'object' && m.keys !== null && !Array.isArray(m.keys) &&
    typeof m.lastCleanupAt === 'number' &&
    Array.isArray(m.evictionLog) &&
    m.evictionLog.every((e: unknown) => {
      const evt = e as Record<string, unknown>;
      return typeof evt.timestamp === 'number' &&
             typeof evt.freedBytes === 'number' &&
             Array.isArray(evt.keysRemoved);
    })
  );
}

function getMetadata(): StorageMetadata {
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isStorageMetadata(parsed)) {
        return parsed;
      } else {
        console.warn('[localStorageManager] Stored metadata has invalid structure, using defaults');
      }
    }
  } catch (e) {
    console.warn('[localStorageManager] Failed to load metadata:', e instanceof Error ? e.message : String(e));
  }
  return {
    keys: {},
    lastCleanupAt: Date.now(),
    evictionLog: [],
  };
}

function saveMetadata(meta: StorageMetadata): void {
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
  } catch (e) {
    // If we can't save metadata, it's not critical, but log it
    console.debug('[localStorageManager] Failed to save metadata:', e instanceof Error ? e.message : String(e));
  }
}

function updateKeyMetadata(key: string, value: string): Promise<void> {
  return enqueueMetadataUpdate(() => {
    const meta = getMetadata();
    const isCritical = CRITICAL_KEYS.has(key);

    if (!meta.keys[key]) {
      meta.keys[key] = {
        key,
        lastAccessedAt: Date.now(),
        size: estimateSize(value),
        accessCount: 1,
        isCritical,
      };
    } else {
      meta.keys[key].lastAccessedAt = Date.now();
      meta.keys[key].size = estimateSize(value);
      meta.keys[key].accessCount += 1;
    }

    saveMetadata(meta);
  });
}

function touchKeyMetadata(key: string): Promise<void> {
  return enqueueMetadataUpdate(() => {
    const meta = getMetadata();
    if (meta.keys[key]) {
      meta.keys[key].lastAccessedAt = Date.now();
      meta.keys[key].accessCount += 1;
      saveMetadata(meta);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Cache Eviction
// ─────────────────────────────────────────────────────────────

/**
 * Evict LRU items from localStorage until minBytes are available.
 * Skips critical keys.
 *
 * Returns: { freedBytes, keysRemoved }
 */
export function cleanupLocalStorage(minBytes: number = 1_000_000): { freedBytes: number; keysRemoved: string[] } {
  // Note: This must be called ONLY from within an enqueued metadata update
  // to avoid races with concurrent setItemWithQuotaHandling calls
  const meta = getMetadata();
  const keysToRemove: string[] = [];
  let freedBytes = 0;

  // Get all non-critical keys, sorted by least-recently-used
  const evictableCandidates = Object.values(meta.keys)
    .filter(k => !k.isCritical && k.key !== METADATA_KEY)
    .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

  console.log(
    `[localStorageManager] Evicting LRU items to free ${minBytes} bytes. Candidates: ${evictableCandidates.length}`
  );

  for (const candidate of evictableCandidates) {
    if (freedBytes >= minBytes) break;

    try {
      localStorage.removeItem(candidate.key);
      freedBytes += candidate.size;
      keysToRemove.push(candidate.key);
      delete meta.keys[candidate.key];

      console.log(
        `[localStorageManager] Evicted "${candidate.key}" (${candidate.size} bytes, last accessed ${new Date(candidate.lastAccessedAt).toISOString()})`
      );
    } catch (e) {
      console.warn(
        `[localStorageManager] Failed to evict "${candidate.key}":`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // Log the cleanup event
  meta.lastCleanupAt = Date.now();
  meta.evictionLog.push({
    timestamp: Date.now(),
    freedBytes,
    keysRemoved: keysToRemove,
  });

  // Keep eviction log bounded to last 100 events
  if (meta.evictionLog.length > 100) {
    meta.evictionLog = meta.evictionLog.slice(-100);
  }

  saveMetadata(meta);

  console.log(
    `[localStorageManager] Cleanup complete. Freed ${freedBytes} bytes by removing ${keysToRemove.length} keys.`
  );

  return { freedBytes, keysRemoved: keysToRemove };
}

/**
 * Get the current eviction log (for debugging/monitoring).
 */
export function getEvictionLog(): Array<{
  timestamp: number;
  freedBytes: number;
  keysRemoved: string[];
}> {
  const meta = getMetadata();
  return meta.evictionLog;
}

/**
 * Get storage statistics.
 */
export function getStorageStats(): {
  totalEstimatedBytes: number;
  numKeys: number;
  numCriticalKeys: number;
  lastCleanupAt: number;
  recentEvictions: number;
} {
  const meta = getMetadata();
  const totalEstimatedBytes = Object.values(meta.keys).reduce((sum, k) => sum + k.size, 0);
  const numCriticalKeys = Object.values(meta.keys).filter(k => k.isCritical).length;

  return {
    totalEstimatedBytes,
    numKeys: Object.keys(meta.keys).length,
    numCriticalKeys,
    lastCleanupAt: meta.lastCleanupAt,
    recentEvictions: meta.evictionLog.filter(e => e.timestamp > Date.now() - 3600_000).length,
  };
}

// ─────────────────────────────────────────────────────────────
// Quota-Aware setItem Wrapper
// ─────────────────────────────────────────────────────────────

/**
 * Safe setItem with automatic eviction fallback.
 * If QuotaExceededError occurs, evicts LRU items and retries.
 * All operations are serialized via metadata queue to prevent races.
 *
 * Returns: Promise<boolean> — true if successful, false if retried after eviction failed
 */
export async function setItemWithQuotaHandling(key: string, value: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    enqueueMetadataUpdate(() => {
      try {
        localStorage.setItem(key, value);
        // Update metadata (must happen within the enqueued fn)
        const meta = getMetadata();
        const isCritical = CRITICAL_KEYS.has(key);
        if (!meta.keys[key]) {
          meta.keys[key] = {
            key,
            lastAccessedAt: Date.now(),
            size: estimateSize(value),
            accessCount: 1,
            isCritical,
          };
        } else {
          meta.keys[key].lastAccessedAt = Date.now();
          meta.keys[key].size = estimateSize(value);
          meta.keys[key].accessCount += 1;
        }
        saveMetadata(meta);
        resolve(true);
      } catch (e) {
        // Check if this is a QuotaExceededError
        const isQuotaError =
          e instanceof DOMException &&
          (e.code === 22 || // QuotaExceededError
            e.name === 'QuotaExceededError' ||
            e.message.includes('QuotaExceededError'));

        if (!isQuotaError) {
          // Some other error, re-throw
          console.error(`[localStorageManager] Unexpected error in setItem("${key}"):`, e);
          resolve(false);
          return;
        }

        console.warn(`[localStorageManager] QuotaExceededError for key "${key}". Initiating LRU eviction...`);

        // Estimate value size + buffer
        const valueSize = estimateSize(value);
        const targetFree = valueSize + 100_000; // 100KB buffer

        // Evict until we have space (within the enqueued fn, so no concurrent races)
        const { freedBytes, keysRemoved } = cleanupLocalStorage(targetFree);

        if (freedBytes < valueSize) {
          console.error(
            `[localStorageManager] After eviction freed ${freedBytes} bytes, but need ${valueSize}. Cannot store key "${key}".`
          );
          resolve(false);
          return;
        }

        // Retry the setItem
        try {
          localStorage.setItem(key, value);
          // Update metadata again after successful retry
          const meta = getMetadata();
          const isCritical = CRITICAL_KEYS.has(key);
          if (!meta.keys[key]) {
            meta.keys[key] = {
              key,
              lastAccessedAt: Date.now(),
              size: estimateSize(value),
              accessCount: 1,
              isCritical,
            };
          } else {
            meta.keys[key].lastAccessedAt = Date.now();
            meta.keys[key].size = estimateSize(value);
            meta.keys[key].accessCount += 1;
          }
          saveMetadata(meta);
          console.log(`[localStorageManager] Successfully stored "${key}" after evicting ${keysRemoved.length} items.`);
          resolve(true);
        } catch (retryError) {
          console.error(
            `[localStorageManager] Failed to store "${key}" even after eviction:`,
            retryError instanceof Error ? retryError.message : String(retryError)
          );
          resolve(false);
        }
      }
    });
  });
}

/**
 * Safe getItem that tracks access.
 */
export async function getItemWithTracking(key: string): Promise<string | null> {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      await touchKeyMetadata(key);
    }
    return value;
  } catch (e) {
    console.warn(`[localStorageManager] Error reading key "${key}":`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Safe removeItem that updates metadata.
 */
export function removeItemWithTracking(key: string): Promise<void> {
  return enqueueMetadataUpdate(() => {
    try {
      localStorage.removeItem(key);
      const meta = getMetadata();
      delete meta.keys[key];
      saveMetadata(meta);
    } catch (e) {
      console.warn(`[localStorageManager] Error removing key "${key}":`, e instanceof Error ? e.message : String(e));
    }
  });
}

/**
 * Get keys that are marked as critical (should never be evicted).
 */
export function getCriticalKeys(): string[] {
  return Array.from(CRITICAL_KEYS);
}

/**
 * Mark a key as critical (will not be evicted).
 */
export function markKeyAsCritical(key: string): void {
  CRITICAL_KEYS.add(key);
  const meta = getMetadata();
  if (meta.keys[key]) {
    meta.keys[key].isCritical = true;
    saveMetadata(meta);
  }
}
