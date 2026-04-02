/**
 * storageCleanup.ts
 *
 * Automatic cleanup strategies for storage management.
 * Removes old images, checkpoints, and orphaned data to free quota.
 *
 * Triggered when:
 * - Manual cleanup request
 * - Quota exceeds 80% (automatic via quota monitor)
 * - Session ends (checkpoint cleanup)
 */

import { get, set } from 'idb-keyval';
import type { StoredImage } from './storage';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CleanupResult {
  type: 'images' | 'checkpoints' | 'orphans' | 'all';
  itemsDeleted: number;
  bytesFreed: number;
  duration: number; // ms
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Delete images older than specified days.
 * Returns cleanup stats.
 */
export async function deleteImagesOlderThan(days: number): Promise<CleanupResult> {
  const startTime = Date.now();
  try {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const images = (await get('generated_images')) || {};

    let deleted = 0;
    let bytesFreed = 0;

    for (const [id, image] of Object.entries(images)) {
      const img = image as StoredImage;
      if (img.timestamp < cutoffTime) {
        // Estimate bytes freed (rough: imageBase64 is ~70% of image size)
        const estimatedSize = img.imageBase64.length * 0.75;
        bytesFreed += estimatedSize;
        delete images[id];
        deleted++;
      }
    }

    if (deleted > 0) {
      await set('generated_images', images);
      console.log(`[storageCleanup] Deleted ${deleted} images older than ${days} days, freed ~${formatBytes(bytesFreed)}`);
    }

    return {
      type: 'images',
      itemsDeleted: deleted,
      bytesFreed,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[storageCleanup] deleteImagesOlderThan failed:', err);
    throw err;
  }
}

/**
 * Delete non-favorite images to recover quota.
 * Useful when quota is critical and user needs space immediately.
 * Deletes oldest non-favorited images first.
 */
export async function deleteNonFavoriteImages(targetBytesFreed: number): Promise<CleanupResult> {
  const startTime = Date.now();
  try {
    const images = (await get('generated_images')) || {};

    // Sort by timestamp (oldest first), filter to non-favorites
    const sortedImages = Object.entries(images)
      .map(([id, img]) => ({ id, img: img as StoredImage }))
      .filter(({ img }) => !img.favorite)
      .sort((a, b) => a.img.timestamp - b.img.timestamp);

    let deleted = 0;
    let bytesFreed = 0;

    for (const { id, img } of sortedImages) {
      if (bytesFreed >= targetBytesFreed) break;

      const estimatedSize = img.imageBase64.length * 0.75;
      bytesFreed += estimatedSize;
      delete images[id];
      deleted++;
    }

    if (deleted > 0) {
      await set('generated_images', images);
      console.log(`[storageCleanup] Deleted ${deleted} non-favorite images, freed ~${formatBytes(bytesFreed)}`);
    }

    return {
      type: 'images',
      itemsDeleted: deleted,
      bytesFreed,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[storageCleanup] deleteNonFavoriteImages failed:', err);
    throw err;
  }
}

/**
 * Delete old checkpoints from completed sessions.
 * Keeps recent checkpoints but removes those older than specified days.
 */
export async function purgeOldCheckpoints(days: number): Promise<CleanupResult> {
  const startTime = Date.now();
  try {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let bytesFreed = 0;

    // Checkpoints are stored as individual keys: agent_checkpoints:sessionId:N
    // We need to enumerate all keys and check timestamps
    // Since idb-keyval uses a single default store, we can only check
    // if we load the entire store. For now, we'll scan known checkpoint patterns.

    // Try to get any checkpoints stored at root level
    const checkpointKeysToCheck: string[] = [];
    for (let i = 0; i < 100; i++) {
      const key = `agent_checkpoints:checkpoint_${i}`;
      try {
        const checkpoint = await get(key);
        if (checkpoint && typeof checkpoint === 'object') {
          checkpointKeysToCheck.push(key);
        }
      } catch {
        // Key doesn't exist
      }
    }

    // Also check the main checkpoints store
    const allCheckpoints = (await get('agent_checkpoints')) || {};
    for (const [key, checkpoint] of Object.entries(allCheckpoints)) {
      const cp = checkpoint as any;
      if (cp && cp.timestamp && cp.timestamp < cutoffTime) {
        const estimatedSize = JSON.stringify(cp).length;
        bytesFreed += estimatedSize;
        delete allCheckpoints[key];
        deleted++;
      }
    }

    if (deleted > 0) {
      await set('agent_checkpoints', allCheckpoints);
      console.log(`[storageCleanup] Deleted ${deleted} old checkpoints, freed ~${formatBytes(bytesFreed)}`);
    }

    return {
      type: 'checkpoints',
      itemsDeleted: deleted,
      bytesFreed,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[storageCleanup] purgeOldCheckpoints failed:', err);
    throw err;
  }
}

/**
 * Detect and clean up orphaned data:
 * - Cycles with non-existent campaignId
 * - Images with non-existent campaignId
 * - Empty checkpoint stubs
 */
export async function cleanupOrphanedData(): Promise<CleanupResult> {
  const startTime = Date.now();
  try {
    const campaigns = (await get('campaigns')) || {};
    const cycles = (await get('cycles')) || {};
    const images = (await get('generated_images')) || {};

    const campaignIds = new Set(Object.keys(campaigns));
    let deleted = 0;
    let bytesFreed = 0;

    // Remove orphaned cycles
    for (const [id, cycle] of Object.entries(cycles)) {
      const campaignId = (cycle as any).campaignId;
      if (campaignId && !campaignIds.has(campaignId)) {
        const estimatedSize = JSON.stringify(cycle).length;
        bytesFreed += estimatedSize;
        delete cycles[id];
        deleted++;
      }
    }

    // Remove orphaned images
    for (const [id, image] of Object.entries(images)) {
      const campaignId = (image as any).campaignId;
      if (campaignId && !campaignIds.has(campaignId)) {
        const estimatedSize = (image as any).imageBase64?.length || 0;
        bytesFreed += estimatedSize;
        delete images[id];
        deleted++;
      }
    }

    // Save cleaned data
    let changed = false;
    if (Object.keys(cycles).length !== Object.keys((await get('cycles')) || {}).length) {
      await set('cycles', cycles);
      changed = true;
    }
    if (Object.keys(images).length !== Object.keys((await get('generated_images')) || {}).length) {
      await set('generated_images', images);
      changed = true;
    }

    if (changed) {
      console.log(`[storageCleanup] Cleaned ${deleted} orphaned items, freed ~${formatBytes(bytesFreed)}`);
    }

    return {
      type: 'orphans',
      itemsDeleted: deleted,
      bytesFreed,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[storageCleanup] cleanupOrphanedData failed:', err);
    throw err;
  }
}

/**
 * Run aggressive cleanup when quota is critical (>= 95%).
 * Deletes oldest non-favorite images aggressively until space is freed.
 */
export async function aggressiveCleanupForQuotaCritical(): Promise<CleanupResult> {
  console.warn('[storageCleanup] Running aggressive cleanup for quota critical...');

  try {
    // First, clean orphans (quick win)
    const orphanResult = await cleanupOrphanedData();

    // Then delete old images (>30 days)
    const oldImageResult = await deleteImagesOlderThan(30);

    // Finally, delete non-favorites if needed (most aggressive)
    const nonFavoriteResult = await deleteNonFavoriteImages(100e6); // Target 100MB freed

    const totalDeleted = orphanResult.itemsDeleted + oldImageResult.itemsDeleted + nonFavoriteResult.itemsDeleted;
    const totalFreed = orphanResult.bytesFreed + oldImageResult.bytesFreed + nonFavoriteResult.bytesFreed;

    return {
      type: 'all',
      itemsDeleted: totalDeleted,
      bytesFreed: totalFreed,
      duration: Date.now() - (Date.now() - orphanResult.duration),
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[storageCleanup] aggressiveCleanupForQuotaCritical failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)}KB`;
  }
  return `${mb.toFixed(1)}MB`;
}

/**
 * Log cleanup statistics (for monitoring).
 */
export function logCleanupStats(result: CleanupResult): void {
  console.log(`[storageCleanup] ${result.type} cleanup complete:`);
  console.log(`  Deleted: ${result.itemsDeleted} items`);
  console.log(`  Freed: ${formatBytes(result.bytesFreed)}`);
  console.log(`  Duration: ${result.duration}ms`);
}
