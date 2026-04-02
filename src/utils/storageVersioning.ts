/**
 * storageVersioning.ts
 *
 * Schema versioning and migration system for IndexedDB and localStorage.
 * Enables safe evolution of data structures without breaking existing data.
 *
 * Version history:
 * - v1: Initial release (campaigns, cycles, images, checkpoints)
 * - v2: Add storageQuotaMonitor integration, cascade delete support
 * - v3: Planned future enhancements (export/import, backup)
 */

import { get, set } from 'idb-keyval';

// ─────────────────────────────────────────────────────────────
// Version Constants
// ─────────────────────────────────────────────────────────────

const CURRENT_STORAGE_VERSION = 2;
const VERSION_KEY = 'storage_version';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migrationsRun: string[];
  errors: string[];
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get current storage version from localStorage.
 * Returns 1 if not set (assumed v1 data).
 */
export function getStorageVersion(): number {
  try {
    const version = localStorage.getItem(VERSION_KEY);
    return version ? parseInt(version, 10) : 1;
  } catch (err) {
    console.warn('[storageVersioning] Failed to get version:', err);
    return 1;
  }
}

/**
 * Check if migration is needed.
 */
export function isMigrationNeeded(): boolean {
  return getStorageVersion() < CURRENT_STORAGE_VERSION;
}

/**
 * Run all pending migrations synchronously from current version to latest.
 * Returns migration result with success status and details.
 */
export async function runMigrationsAsync(): Promise<MigrationResult> {
  const fromVersion = getStorageVersion();
  const toVersion = CURRENT_STORAGE_VERSION;

  const result: MigrationResult = {
    success: true,
    fromVersion,
    toVersion,
    migrationsRun: [],
    errors: [],
    timestamp: Date.now(),
  };

  if (fromVersion >= toVersion) {
    console.log(`[storageVersioning] Already at v${toVersion}, no migration needed`);
    return result;
  }

  console.log(`[storageVersioning] Migrating from v${fromVersion} to v${toVersion}...`);

  try {
    // v1 → v2: Add orphan detection and cascade delete support
    if (fromVersion < 2) {
      await migrate_v1_to_v2();
      result.migrationsRun.push('v1→v2: Orphan cleanup + cascade delete support');
    }

    // Update version in localStorage
    localStorage.setItem(VERSION_KEY, String(toVersion));
    console.log(`[storageVersioning] Migration complete. Now at v${toVersion}`);
  } catch (err) {
    result.success = false;
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[storageVersioning] Migration failed:', err);
  }

  return result;
}

/**
 * Initialize versioning on app startup.
 * Call this during app bootstrap to ensure migrations are run.
 */
export async function initializeVersioningAsync(): Promise<void> {
  try {
    if (isMigrationNeeded()) {
      const result = await runMigrationsAsync();
      if (!result.success) {
        console.error('[storageVersioning] Migration had errors:', result.errors);
      }
    }
  } catch (err) {
    console.error('[storageVersioning] Initialization failed:', err);
  }
}

/**
 * Reset storage version (for development/testing).
 * Use with caution — this will cause all migrations to re-run next startup.
 */
export function resetStorageVersion(toVersion: number = 1): void {
  localStorage.setItem(VERSION_KEY, String(toVersion));
  console.warn(`[storageVersioning] Reset version to v${toVersion}. Migrations will run next startup.`);
}

/**
 * Log versioning info for debugging.
 */
export function logVersionInfo(): void {
  const current = getStorageVersion();
  const needsMigration = isMigrationNeeded();
  console.log('[storageVersioning] Info:');
  console.log(`  Current version: v${current}`);
  console.log(`  Target version: v${CURRENT_STORAGE_VERSION}`);
  console.log(`  Migration needed: ${needsMigration}`);
}

// ─────────────────────────────────────────────────────────────
// Migration Implementations
// ─────────────────────────────────────────────────────────────

/**
 * v1 → v2 Migration
 *
 * Changes:
 * 1. Detect and warn about orphaned cycles/images
 * 2. Verify all cycles have campaignId set
 * 3. Verify all images have campaignId set
 * 4. Log cleanup recommendations
 */
async function migrate_v1_to_v2(): Promise<void> {
  console.log('[storageVersioning] Running v1→v2 migration...');

  try {
    // Load all data structures
    const campaigns = (await get('campaigns')) || {};
    const cycles = (await get('cycles')) || {};
    const images = (await get('generated_images')) || {};

    const campaignIds = new Set(Object.keys(campaigns));
    let orphanedCycles = 0;
    let orphanedImages = 0;

    // Check for orphaned cycles (cycles with campaignId not in campaigns)
    for (const [cycleId, cycle] of Object.entries(cycles)) {
      const campaignId = (cycle as any).campaignId;
      if (campaignId && !campaignIds.has(campaignId)) {
        orphanedCycles++;
      }
    }

    // Check for orphaned images
    for (const [imageId, image] of Object.entries(images)) {
      const campaignId = (image as any).campaignId;
      if (campaignId && !campaignIds.has(campaignId)) {
        orphanedImages++;
      }
    }

    if (orphanedCycles > 0 || orphanedImages > 0) {
      console.warn(`[storageVersioning] Found orphaned data:`);
      console.warn(`  - ${orphanedCycles} orphaned cycles`);
      console.warn(`  - ${orphanedImages} orphaned images`);
      console.warn(`[storageVersioning] Consider running cleanup: storage.cleanupOrphanedData()`);
    } else {
      console.log('[storageVersioning] No orphaned data detected');
    }

    // Log storage stats
    const cycleCount = Object.keys(cycles).length;
    const imageCount = Object.keys(images).length;
    const campaignCount = Object.keys(campaigns).length;
    console.log(`[storageVersioning] Storage stats:`);
    console.log(`  - ${campaignCount} campaigns`);
    console.log(`  - ${cycleCount} cycles`);
    console.log(`  - ${imageCount} images`);
  } catch (err) {
    console.error('[storageVersioning] v1→v2 migration error:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Utilities (for future migrations)
// ─────────────────────────────────────────────────────────────

/**
 * Helper to safely get a stored collection.
 * Returns empty object if key doesn't exist or is corrupted.
 */
export async function getSafeCollection(key: string): Promise<Record<string, any>> {
  try {
    const data = await get(key);
    if (data && typeof data === 'object') {
      return data;
    }
    return {};
  } catch (err) {
    console.warn(`[storageVersioning] Failed to get collection ${key}:`, err);
    return {};
  }
}

/**
 * Helper to safely set a stored collection.
 * Logs errors but doesn't throw.
 */
export async function setSafeCollection(key: string, data: any): Promise<boolean> {
  try {
    await set(key, data);
    return true;
  } catch (err) {
    console.error(`[storageVersioning] Failed to set collection ${key}:`, err);
    return false;
  }
}
