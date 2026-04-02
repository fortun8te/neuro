/**
 * storageQuotaMonitor.ts
 *
 * Real-time storage quota monitoring with warnings and automatic cleanup triggers.
 * Monitors IndexedDB + localStorage usage against browser quota limits.
 *
 * Warning thresholds:
 * - 70%: INFO level warning
 * - 85%: WARNING level warning
 * - 95%: CRITICAL level warning
 * - 80%+: Trigger automatic cleanup
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface StorageQuotaInfo {
  used: number;          // Bytes used
  quota: number;         // Total quota in bytes
  percentUsed: number;   // 0-100
  remaining: number;     // Bytes remaining
  remainingMB: string;   // Human-readable remaining
  status: 'ok' | 'warning' | 'critical'; // Based on thresholds
}

export interface StorageBreakdown {
  indexedDbUsage: number;
  localStorageUsage: number;
  totalUsage: number;
  quota: number;
}

type QuotaListener = (info: StorageQuotaInfo) => void;

// ─────────────────────────────────────────────────────────────
// State & Listeners
// ─────────────────────────────────────────────────────────────

let _quotaListeners = new Set<QuotaListener>();
let _lastQuotaCheck: StorageQuotaInfo | null = null;
let _quotaCheckInterval: NodeJS.Timeout | null = null;

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get current storage quota info synchronously (cached).
 * Call checkQuotaAsync() first to refresh the cache.
 */
export function getQuotaSync(): StorageQuotaInfo | null {
  return _lastQuotaCheck;
}

/**
 * Check storage quota asynchronously and cache the result.
 * Returns StorageQuotaInfo with current usage and status.
 */
export async function checkQuotaAsync(): Promise<StorageQuotaInfo> {
  try {
    const quota = await getStorageQuota();

    // Estimate usage (IndexedDB is the main consumer)
    const usage = quota.used;
    const total = quota.quota;
    const percentUsed = Math.round((usage / total) * 100);
    const remaining = total - usage;
    const remainingMB = formatBytes(remaining);

    // Determine status based on percent used
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (percentUsed >= 95) {
      status = 'critical';
    } else if (percentUsed >= 85) {
      status = 'warning';
    } else if (percentUsed >= 70) {
      status = 'warning'; // Still warning, just lower threshold
    }

    const info: StorageQuotaInfo = {
      used: usage,
      quota: total,
      percentUsed,
      remaining,
      remainingMB,
      status,
    };

    _lastQuotaCheck = info;

    // Emit to listeners if status changed or critical threshold hit
    if (percentUsed >= 70) {
      notifyListeners(info);
    }

    return info;
  } catch (err) {
    console.error('[storageQuotaMonitor] checkQuotaAsync failed:', err);
    // Return safe default if estimation fails
    return {
      used: 0,
      quota: 50e6, // 50MB conservative estimate
      percentUsed: 0,
      remaining: 50e6,
      remainingMB: '50.0MB',
      status: 'ok',
    };
  }
}

/**
 * Subscribe to quota change events.
 * Listener is called whenever quota changes or thresholds are crossed.
 */
export function onQuotaChange(listener: QuotaListener): () => void {
  _quotaListeners.add(listener);
  return () => {
    _quotaListeners.delete(listener);
  };
}

/**
 * Start monitoring storage quota at regular intervals.
 * Checks every `intervalMs` (default 30s) and emits warnings.
 */
export function startQuotaMonitoring(intervalMs: number = 30000): void {
  if (_quotaCheckInterval) {
    console.warn('[storageQuotaMonitor] Monitoring already started');
    return;
  }

  // Check immediately on start
  checkQuotaAsync().catch(err => console.error('[storageQuotaMonitor] Initial check failed:', err));

  // Then check at intervals
  _quotaCheckInterval = setInterval(() => {
    checkQuotaAsync().catch(err => console.error('[storageQuotaMonitor] Periodic check failed:', err));
  }, intervalMs);

  console.log(`[storageQuotaMonitor] Started monitoring every ${intervalMs}ms`);
}

/**
 * Stop quota monitoring.
 */
export function stopQuotaMonitoring(): void {
  if (_quotaCheckInterval) {
    clearInterval(_quotaCheckInterval);
    _quotaCheckInterval = null;
    console.log('[storageQuotaMonitor] Stopped monitoring');
  }
}

/**
 * Get detailed breakdown of storage usage.
 * This is approximate since we rely on navigator.storage.estimate().
 */
export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  try {
    const quota = await getStorageQuota();

    // Rough estimate: localStorage is typically <5MB, rest is IndexedDB
    const localStorageUsage = estimateLocalStorageSize();
    const indexedDbUsage = Math.max(0, quota.used - localStorageUsage);

    return {
      indexedDbUsage,
      localStorageUsage,
      totalUsage: quota.used,
      quota: quota.quota,
    };
  } catch (err) {
    console.error('[storageQuotaMonitor] getStorageBreakdown failed:', err);
    return {
      indexedDbUsage: 0,
      localStorageUsage: 0,
      totalUsage: 0,
      quota: 50e6,
    };
  }
}

/**
 * Check if storage quota is exceeded (>= 95%).
 * Used to block new cycle/image creation.
 */
export async function isQuotaCritical(): Promise<boolean> {
  const info = await checkQuotaAsync();
  return info.percentUsed >= 95;
}

/**
 * Check if storage quota is concerning (>= 80%).
 * Used to trigger automatic cleanup.
 */
export async function shouldTriggerCleanup(): Promise<boolean> {
  const info = await checkQuotaAsync();
  return info.percentUsed >= 80;
}

/**
 * Format bytes to human-readable string (e.g., "42.5MB").
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)}KB`;
  }
  return `${mb.toFixed(1)}MB`;
}

// ─────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get storage quota from browser's StorageManager API.
 * Falls back to 50MB estimate if unavailable.
 */
async function getStorageQuota(): Promise<{ used: number; quota: number }> {
  if (!navigator.storage?.estimate) {
    console.warn('[storageQuotaMonitor] navigator.storage.estimate not available, using default');
    return { used: 0, quota: 50e6 }; // 50MB default
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage ?? 0,
      quota: estimate.quota ?? 50e6,
    };
  } catch (err) {
    console.error('[storageQuotaMonitor] Failed to get quota:', err);
    return { used: 0, quota: 50e6 };
  }
}

/**
 * Estimate localStorage size by summing key sizes.
 * Approximation: assumes each character is 1 byte.
 */
function estimateLocalStorageSize(): number {
  if (typeof localStorage === 'undefined') return 0;

  try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          // Rough estimate: key + value + overhead (~50 bytes per entry)
          totalSize += key.length + value.length + 50;
        }
      }
    }
    return totalSize;
  } catch (err) {
    console.warn('[storageQuotaMonitor] Failed to estimate localStorage:', err);
    return 0;
  }
}

/**
 * Notify all listeners of quota change.
 */
function notifyListeners(info: StorageQuotaInfo): void {
  _quotaListeners.forEach((listener) => {
    try {
      listener(info);
    } catch (err) {
      console.error('[storageQuotaMonitor] Listener threw error:', err);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Logging helpers (for monitoring)
// ─────────────────────────────────────────────────────────────

/**
 * Log current quota status to console (for debugging).
 */
export async function logQuotaStatus(): Promise<void> {
  const info = await checkQuotaAsync();
  const breakdown = await getStorageBreakdown();

  console.log('[storageQuotaMonitor] Status:');
  console.log(`  Total Used: ${formatBytes(info.used)} / ${formatBytes(info.quota)} (${info.percentUsed}%)`);
  console.log(`  Status: ${info.status.toUpperCase()}`);
  console.log(`  Remaining: ${info.remainingMB}`);
  console.log(`  Breakdown:`);
  console.log(`    - IndexedDB: ${formatBytes(breakdown.indexedDbUsage)}`);
  console.log(`    - localStorage: ${formatBytes(breakdown.localStorageUsage)}`);
}
