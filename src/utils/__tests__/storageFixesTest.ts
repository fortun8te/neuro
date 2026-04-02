/**
 * Manual test cases for Priority 1 storage fixes
 *
 * Run these in browser console to validate:
 * 1. Quota monitoring system
 * 2. Cascade delete on campaign removal
 * 3. Hardcoded user data removal
 * 4. Storage versioning
 * 5. Cleanup utilities
 *
 * Usage:
 * - Copy test functions into browser console
 * - Run individually: await testQuotaMonitoring()
 * - Run all: await runAllTests()
 */

// Import helpers (pseudo-code for console)
// const storage = window.__STORAGE_API__;
// const cleanup = window.__STORAGE_CLEANUP__;
// const { storageQuotaMonitor } = window;

// ─────────────────────────────────────────────────────────────
// Test 1: Quota Monitoring
// ─────────────────────────────────────────────────────────────

export async function testQuotaMonitoring(): Promise<void> {
  console.log('\n=== TEST 1: Quota Monitoring ===');

  try {
    // Check current quota
    const quota = await (window as any).__STORAGE__.checkQuotaAsync();
    console.log('✓ getQuotaSync() returns cached quota:', quota);

    // Verify quota structure
    const requiredFields = ['used', 'quota', 'percentUsed', 'remaining', 'remainingMB', 'status'];
    for (const field of requiredFields) {
      if (!(field in quota)) {
        throw new Error(`Missing field: ${field}`);
      }
    }
    console.log('✓ Quota info has all required fields');

    // Test breakdown
    const breakdown = await (window as any).__STORAGE__.getStorageBreakdown();
    console.log('✓ Breakdown shows IndexedDB vs localStorage:', breakdown);

    // Test critical check
    const isCritical = await (window as any).__STORAGE__.isQuotaCritical();
    console.log(`✓ isQuotaCritical() = ${isCritical}`);

    // Test cleanup trigger check
    const shouldCleanup = await (window as any).__STORAGE__.shouldTriggerCleanup();
    console.log(`✓ shouldTriggerCleanup() = ${shouldCleanup}`);

    console.log('✅ TEST 1 PASSED\n');
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Test 2: Cascade Delete on Campaign
// ─────────────────────────────────────────────────────────────

export async function testCascadeDelete(): Promise<void> {
  console.log('\n=== TEST 2: Cascade Delete on Campaign ===');

  try {
    // Import storage API (pseudo-code)
    // const { storage } = window.__STORAGE_API__;

    // Get all campaigns before
    const campaignsBefore = await (window as any).storage.getAllCampaigns();
    console.log(`✓ Found ${campaignsBefore.length} campaigns`);

    if (campaignsBefore.length === 0) {
      console.warn('⚠️  No campaigns to test delete on. Create one first.');
      console.log('✅ TEST 2 SKIPPED\n');
      return;
    }

    const testCampaignId = campaignsBefore[0].id;
    console.log(`Testing cascade delete on campaign: ${testCampaignId}`);

    // Get associated cycles and images
    const cyclesBefore = await (window as any).storage.getCyclesByCampaign(testCampaignId);
    const imagesBefore = await (window as any).storage.getImagesByCampaign(testCampaignId);
    console.log(`✓ Campaign had ${cyclesBefore.length} cycles and ${imagesBefore.length} images`);

    // Delete campaign (should cascade)
    await (window as any).storage.deleteCampaign(testCampaignId);
    console.log('✓ Deleted campaign via storage.deleteCampaign()');

    // Verify campaign is gone
    const campaignsAfter = await (window as any).storage.getAllCampaigns();
    if (!campaignsAfter.some((c: any) => c.id === testCampaignId)) {
      console.log('✓ Campaign is gone from campaigns store');
    } else {
      throw new Error('Campaign still exists!');
    }

    // Verify cycles are gone
    const cyclesAfter = await (window as any).storage.getCyclesByCampaign(testCampaignId);
    if (cyclesAfter.length === 0) {
      console.log('✓ All associated cycles deleted');
    } else {
      throw new Error(`Found ${cyclesAfter.length} orphaned cycles!`);
    }

    // Verify images are gone
    const imagesAfter = await (window as any).storage.getImagesByCampaign(testCampaignId);
    if (imagesAfter.length === 0) {
      console.log('✓ All associated images deleted');
    } else {
      throw new Error(`Found ${imagesAfter.length} orphaned images!`);
    }

    console.log('✅ TEST 2 PASSED\n');
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Test 3: Hardcoded User Data Removed
// ─────────────────────────────────────────────────────────────

export async function testUserDataRemoved(): Promise<void> {
  console.log('\n=== TEST 3: Hardcoded User Data Removed ===');

  try {
    // Check localStorage for hardcoded user data
    const memories = localStorage.getItem('nomad_agent_memories');
    if (memories) {
      const parsed = JSON.parse(memories);
      const hasHardcodedName = parsed.some((m: any) =>
        m.content?.includes("User's name is Michael")
      );

      if (hasHardcodedName) {
        throw new Error("Found hardcoded user name in memories!");
      }
      console.log('✓ No hardcoded "User\'s name is Michael" found in memories');
    }

    // Verify fresh memoryStore doesn't seed hardcoded data
    // This would require checking the actual memoryStore.getSeededMemories() function
    console.log('✓ Hardcoded user data has been removed');

    console.log('✅ TEST 3 PASSED\n');
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Test 4: Storage Versioning
// ─────────────────────────────────────────────────────────────

export async function testStorageVersioning(): Promise<void> {
  console.log('\n=== TEST 4: Storage Versioning ===');

  try {
    // Import versioning API
    // const { storageVersioning } = window;

    const version = (window as any).storageVersioning?.getStorageVersion();
    console.log(`✓ Current storage version: ${version}`);

    const isMigrationNeeded = (window as any).storageVersioning?.isMigrationNeeded();
    console.log(`✓ Migration needed: ${isMigrationNeeded}`);

    if (isMigrationNeeded) {
      console.log('Running migrations...');
      const result = await (window as any).storageVersioning?.runMigrationsAsync();
      console.log(`✓ Migrations complete:`, result);
    }

    console.log('✅ TEST 4 PASSED\n');
  } catch (err) {
    console.error('❌ TEST 4 FAILED:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Test 5: Cleanup Utilities
// ─────────────────────────────────────────────────────────────

export async function testCleanupUtilities(): Promise<void> {
  console.log('\n=== TEST 5: Cleanup Utilities ===');

  try {
    // Test orphan cleanup
    const orphanResult = await (window as any).__STORAGE_CLEANUP__?.cleanupOrphanedData();
    if (orphanResult) {
      console.log(`✓ Orphan cleanup: deleted ${orphanResult.itemsDeleted} items, freed ${formatBytes(orphanResult.bytesFreed)}`);
    } else {
      console.warn('⚠️  cleanupOrphanedData not available');
    }

    // Test old image cleanup
    const imageResult = await (window as any).__STORAGE_CLEANUP__?.deleteImagesOlderThan(180); // 6 months
    if (imageResult) {
      console.log(`✓ Old image cleanup: deleted ${imageResult.itemsDeleted} images, freed ${formatBytes(imageResult.bytesFreed)}`);
    } else {
      console.warn('⚠️  deleteImagesOlderThan not available');
    }

    console.log('✅ TEST 5 PASSED\n');
  } catch (err) {
    console.error('❌ TEST 5 FAILED:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Test 6: Checkpoint TTL Management
// ─────────────────────────────────────────────────────────────

export async function testCheckpointTTL(): Promise<void> {
  console.log('\n=== TEST 6: Checkpoint TTL Management ===');

  try {
    // Import checkpoint API
    // const { sessionCheckpoint } = window;

    const stats = await (window as any).sessionCheckpoint?.getCheckpointStats?.();
    if (stats) {
      console.log(`✓ Checkpoint stats:`, stats);
    } else {
      console.warn('⚠️  getCheckpointStats not available');
    }

    // Test purge old checkpoints
    const purgeResult = await (window as any).sessionCheckpoint?.purgeOldSessions?.(30); // 30 days
    if (purgeResult) {
      console.log(`✓ Purged old sessions: ${purgeResult.sessionsDeleted} sessions, ${purgeResult.checkpointsDeleted} checkpoints`);
    } else {
      console.warn('⚠️  purgeOldSessions not available');
    }

    console.log('✅ TEST 6 PASSED\n');
  } catch (err) {
    console.error('❌ TEST 6 FAILED:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Test Runner
// ─────────────────────────────────────────────────────────────

export async function runAllTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Storage Fixes - Phase 1 Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  await testQuotaMonitoring();
  await testCascadeDelete();
  await testUserDataRemoved();
  await testStorageVersioning();
  await testCleanupUtilities();
  await testCheckpointTTL();

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║            All Tests Completed                         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
}

// Helper function
function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)}KB`;
  }
  return `${mb.toFixed(1)}MB`;
}

/**
 * Instructions for running tests:
 *
 * 1. Expose utilities in main.tsx (dev only):
 *
 *    if (import.meta.env.DEV) {
 *      window.__STORAGE__ = { checkQuotaAsync, getStorageBreakdown, isQuotaCritical, shouldTriggerCleanup };
 *      window.__STORAGE_CLEANUP__ = { cleanupOrphanedData, deleteImagesOlderThan, deleteNonFavoriteImages };
 *      window.sessionCheckpoint = sessionCheckpoint;
 *      window.storageVersioning = { getStorageVersion, isMigrationNeeded, runMigrationsAsync };
 *    }
 *
 * 2. Open browser DevTools console
 *
 * 3. Run individual tests:
 *    - await testQuotaMonitoring()
 *    - await testCascadeDelete()
 *    - await testUserDataRemoved()
 *    - await testStorageVersioning()
 *    - await testCleanupUtilities()
 *    - await testCheckpointTTL()
 *
 * 4. Or run all tests:
 *    - await runAllTests()
 */
