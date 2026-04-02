# Storage Fixes - Phase 1 Implementation Guide

**Completed:** 2026-04-02
**Status:** Priority 1 (Critical) — All fixes implemented

## Overview

Phase 1 critical storage fixes have been implemented to address quota overflow, data integrity, and security issues.

## Fixes Implemented

### 1. Quota Monitoring System (`src/utils/storageQuotaMonitor.ts`)

Real-time storage quota tracking with warnings at 70%, 85%, and 95% thresholds.

**Key Features:**
- `checkQuotaAsync()` - Get current quota status (cached)
- `onQuotaChange()` - Subscribe to quota change events
- `startQuotaMonitoring()` - Start periodic checks (default 30s interval)
- `isQuotaCritical()` - Check if quota >= 95%
- `shouldTriggerCleanup()` - Check if quota >= 80%
- `getStorageBreakdown()` - Detailed usage breakdown (IndexedDB vs localStorage)
- `logQuotaStatus()` - Debug logging

**Usage:**
```typescript
import { startQuotaMonitoring, onQuotaChange, checkQuotaAsync } from '@/utils/storageQuotaMonitor';

// On app startup
startQuotaMonitoring(30000); // Check every 30s

// Listen for quota changes
onQuotaChange((info) => {
  if (info.status === 'critical') {
    console.warn(`Storage at ${info.percentUsed}%! Only ${info.remainingMB} left.`);
  }
});

// Manual check
const quota = await checkQuotaAsync();
console.log(`Used: ${quota.percentUsed}% (${quota.used} / ${quota.quota})`);
```

**Integration Points (TODO in UI):**
- Dashboard status bar: Show "Storage: 42% (21MB / 50MB)"
- Warning modal when >= 85%
- Block new cycle/image creation when >= 95%
- Auto-trigger cleanup when >= 80%

---

### 2. Cascade Delete on Campaign Removal

Updated `storage.ts` `deleteCampaign()` to cascade-delete all associated data.

**What Gets Deleted:**
- All cycles for the campaign
- All generated images for the campaign
- The campaign itself

**Code Changed:**
```typescript
// Before: Only deleted campaign
async deleteCampaign(id: string) {
  delete campaigns[id];
  await set(CAMPAIGNS_KEY, campaigns);
}

// After: Cascade deletes all related data
async deleteCampaign(id: string) {
  await this.deleteCyclesForCampaign(id);        // Delete all cycles
  // [delete all images for campaign]
  delete campaigns[id];                          // Finally delete campaign
}
```

**Safety:**
- Operations serialized via write queues
- All deletions wrapped in try-catch
- Logs deletion details for audit trail

**New Helper Methods Added:**
- `storage.getImagesByCampaign(campaignId)` - Get all images for a campaign
- `storage.deleteImagesForCampaign(campaignId)` - Delete all images for a campaign

---

### 3. Remove Hardcoded User Data

**Issue:** `memoryStore.ts` had hardcoded "User's name is Michael." in default seeds.

**Fix:** Removed hardcoded user name from `getSeededMemories()`.

**Before:**
```typescript
function getSeededMemories(): Memory[] {
  return [
    {
      id: 'user-name',
      type: 'user',
      content: "User's name is Michael.",  // ← SECURITY ISSUE
      // ...
    },
  ];
}
```

**After:**
```typescript
function getSeededMemories(): Memory[] {
  // SECURITY FIX: Remove hardcoded user name from default seeds.
  // User names should only be stored if explicitly provided by user
  // via configuration. Hardcoded values are exposed to anyone with browser access.
  return [];
}
```

**Impact:**
- Removes exposure of hardcoded user identifiers
- Memory system starts empty until user explicitly adds data
- localStorage no longer contains "User's name is Michael"

---

## Priority 2 & 3 Features

### Storage Versioning System (`src/utils/storageVersioning.ts`)

Schema versioning and migration framework for safe data evolution.

**Key Features:**
- `getStorageVersion()` - Get current version from localStorage
- `isMigrationNeeded()` - Check if migration required
- `runMigrationsAsync()` - Execute all pending migrations
- `initializeVersioningAsync()` - Call during app bootstrap
- `resetStorageVersion(toVersion)` - Development/testing reset

**Current Migrations:**
- v1→v2: Orphan detection + cascade delete support

**Future Migrations:**
- v2→v3: Export/import functionality
- v3→v4: Backup system

**Integration (TODO):**
Call during app initialization:
```typescript
// In main.tsx or CampaignContext
import { initializeVersioningAsync } from '@/utils/storageVersioning';

await initializeVersioningAsync();
```

---

### Cleanup Utilities (`src/utils/storageCleanup.ts`)

Automatic cleanup strategies to free quota.

**Available Functions:**

1. **`deleteImagesOlderThan(days: number)`**
   - Deletes images older than N days
   - Returns cleanup stats (items deleted, bytes freed)

2. **`deleteNonFavoriteImages(targetBytesFreed: number)`**
   - Deletes oldest non-favorite images
   - Targets specified bytes to free
   - Preserves user-favorited images

3. **`purgeOldCheckpoints(days: number)`**
   - Deletes old checkpoints from completed sessions
   - Keeps recent checkpoints

4. **`cleanupOrphanedData()`**
   - Removes cycles/images with non-existent campaignId
   - Useful after imports or corrupted deletes

5. **`aggressiveCleanupForQuotaCritical()`**
   - Runs all cleanup strategies in order
   - Most aggressive approach for quota emergency
   - Used when quota >= 95%

**Usage Example:**
```typescript
import { deleteImagesOlderThan, aggressiveCleanupForQuotaCritical } from '@/utils/storageCleanup';

// Manual cleanup of old images
const result = await deleteImagesOlderThan(30);
console.log(`Freed ${result.bytesFreed} bytes`);

// Emergency cleanup
if (quota.percentUsed >= 95) {
  await aggressiveCleanupForQuotaCritical();
}
```

---

### Checkpoint TTL Management (`src/utils/sessionCheckpoint.ts` - Extended)

New TTL methods for checkpoint cleanup.

**New Functions:**

1. **`purgeOldSessions(days: number)`**
   - Deletes completed/cancelled sessions older than N days
   - Keeps in-progress and paused sessions
   - Returns count of deleted sessions/checkpoints

2. **`purgeCompletedSessions()`**
   - Aggressively delete all completed/cancelled sessions
   - Keeps only in-progress and paused sessions
   - Useful for quota emergency

3. **`getCheckpointStats()`**
   - Returns total sessions, checkpoints, averages
   - Useful for monitoring

**Usage:**
```typescript
import { sessionCheckpoint } from '@/utils/sessionCheckpoint';

// Cleanup old sessions (>7 days old)
const stats = await sessionCheckpoint.purgeOldSessions(7);
console.log(`Deleted ${stats.sessionsDeleted} sessions`);

// Get stats
const cpStats = await sessionCheckpoint.getCheckpointStats();
console.log(`${cpStats.totalCheckpoints} checkpoints across ${cpStats.totalSessions} sessions`);
```

---

## Integration Checklist

### Immediate (Next PR):
- [ ] Call `initializeVersioningAsync()` in app bootstrap (main.tsx or App.tsx)
- [ ] Call `startQuotaMonitoring()` in app bootstrap
- [ ] Update Dashboard to show quota status in header/sidebar

### Short-term (1-2 PRs):
- [ ] Add warning modal when quota >= 85%
- [ ] Block new cycles/images when quota >= 95%
- [ ] Add "Clean Storage" button in Settings
- [ ] Auto-trigger cleanup when quota >= 80%

### Medium-term (2-4 PRs):
- [ ] Add Storage Health panel (Dashboard → Storage tab)
- [ ] Show breakdown of storage usage by type
- [ ] UI for manual image/checkpoint deletion
- [ ] Auto-cleanup on session completion

---

## Testing

### Manual Testing in Browser DevTools Console:

```javascript
// Check current quota
const quota = await window.__STORAGE__.checkQuotaAsync();
console.log(quota);

// Get breakdown
const breakdown = await window.__STORAGE__.getStorageBreakdown();
console.log(breakdown);

// Get all campaigns
const campaigns = await storage.getAllCampaigns();
console.log(`${campaigns.length} campaigns`);

// Cleanup old images
const result = await window.__STORAGE_CLEANUP__.deleteImagesOlderThan(30);
console.log(`Freed ${(result.bytesFreed / 1024 / 1024).toFixed(1)}MB`);

// Check for orphans
const orphanResult = await window.__STORAGE_CLEANUP__.cleanupOrphanedData();
console.log(`Cleaned ${orphanResult.itemsDeleted} orphaned items`);
```

### To Expose Utilities in Console (for testing):

```typescript
// In main.tsx (dev only)
if (import.meta.env.DEV) {
  window.__STORAGE__ = { checkQuotaAsync, getStorageBreakdown, ... };
  window.__STORAGE_CLEANUP__ = { deleteImagesOlderThan, ... };
  window.__STORAGE_CHECKPOINT__ = sessionCheckpoint;
}
```

---

## Monitoring

### Health Check Script

Run periodically to monitor storage health:

```typescript
// src/utils/storageHealthCheck.ts (create new file)
export async function runStorageHealthCheck() {
  const quota = await checkQuotaAsync();
  const breakdown = await getStorageBreakdown();
  const cpStats = await sessionCheckpoint.getCheckpointStats();

  console.log('=== Storage Health Check ===');
  console.log(`Quota: ${quota.percentUsed}% (${formatBytes(quota.used)}/${formatBytes(quota.quota)})`);
  console.log(`IndexedDB: ${formatBytes(breakdown.indexedDbUsage)}`);
  console.log(`localStorage: ${formatBytes(breakdown.localStorageUsage)}`);
  console.log(`Sessions: ${cpStats.totalSessions}, Checkpoints: ${cpStats.totalCheckpoints}`);

  if (quota.percentUsed >= 80) {
    console.warn('⚠️  Storage usage critical! Run cleanup.');
  }
}
```

---

## File Changes Summary

| File | Changes | Lines Added |
|------|---------|------------|
| `src/utils/storageQuotaMonitor.ts` | NEW | 380 |
| `src/utils/storageVersioning.ts` | NEW | 310 |
| `src/utils/storageCleanup.ts` | NEW | 420 |
| `src/utils/storage.ts` | Modified `deleteCampaign()`, added helpers | +40 |
| `src/utils/sessionCheckpoint.ts` | Extended with TTL management | +120 |
| `src/utils/memoryStore.ts` | Removed hardcoded user name | -5 |

**Total New Code:** ~1,265 lines of storage fixes

---

## Next Steps (Priority 2-3)

1. **Export/Import Functionality** (Priority 2)
   - `storage.exportCampaign(campaignId)` → Blob
   - `storage.importCampaign(file)` → Campaign
   - Backup/restore workflows

2. **UI Integration** (Priority 2)
   - Storage health dashboard
   - Warning modals + cleanup triggers
   - Manual cleanup controls

3. **Error Handling** (Priority 3)
   - Graceful degradation on quota exceeded
   - Better error logging
   - User-friendly error messages

4. **Health Endpoint** (Priority 3)
   - `/api/storage/health` endpoint
   - Monitoring/metrics collection
   - Quota prediction

---

## Reference Materials

- STORAGE_AUDIT.md — Complete audit findings
- STORAGE_QUICK_REFERENCE.md — Quick lookup tables
- src/config/infrastructure.ts — Configuration
- src/context/CampaignContext.tsx — Provider using storage

---

**Implementation Date:** 2026-04-02
**Implemented By:** Storage Database Fixes Agent
**Status:** ✅ Complete - Ready for integration
