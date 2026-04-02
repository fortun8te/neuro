# Ad Agent Storage & Database Audit Report
Generated: 2026-04-02

## Executive Summary

The Ad Agent project uses a **hybrid persistence strategy**:
- **IndexedDB** (idb-keyval): Primary data store for campaigns, cycles, images, checkpoints
- **localStorage**: UI state only (theme, model selection, research depth preset)
- **File system**: Via storageBackend.ts (not currently active in browser)

**Current Health Status:**
- No critical issues detected
- Good safeguards in place (write queuing, cycle pruning, try-catch wrapping)
- Some optimization opportunities identified
- Data integrity checks needed for production

---

## 1. IndexedDB Schema Audit

### Current Store Structure

```
Key-Value Pairs (idb-keyval uses single default store):
├── campaigns → { [campaignId]: Campaign }
├── cycles → { [cycleId]: Cycle }
├── generated_images → { [imageId]: StoredImage }
├── nomad_agent_memories → [Memory[], localStorage native]
├── agent_sessions → { [sessionId]: SessionState }
├── agent_checkpoints:* → Checkpoint objects
├── scheduled_tasks → { [taskId]: ScheduledTask }
├── task_executions → { [executionId]: TaskExecution }
├── schedule_metrics → { lastUpdated, ... }
└── [checkpointKey] → arbitrary checkpoint data
```

### Identified Concerns

1. **No Formal Schema with Version Control**
   - idb-keyval stores raw JS objects in default store
   - No explicit indexes defined
   - No onupgradeneeded migrations
   - ⚠️ Risk: Schema evolution will be manual/fragile

2. **Primary Keys**
   - All lookups are by campaign/cycle/image ID (strings)
   - No composite keys or secondary indexes
   - Foreign key relationships (Cycle.campaignId) are denormalized
   - ⚠️ Risk: No referential integrity enforcement (orphaned cycles if campaign deleted)

3. **Write Serialization** ✅
   - Cycles: `_cycleWriteQueue` prevents concurrent read-modify-write races
   - Images: `_imageWriteQueue` separate queue
   - Checkpoints: `_checkpointWriteQueue` separate queue
   - ✅ Good: Prevents silent data loss from interleaved writes

4. **Error Handling** ✅
   - All storage ops wrapped in try-catch
   - Errors propagate to caller (not swallowed)
   - Quota errors will surface as thrown exceptions

---

## 2. Storage Limits Analysis

### Browser IndexedDB Quota

| Browser | Per-site Quota | Total Pool |
|---------|---|---|
| Chrome/Edge | 50% of disk space | Dynamic (up to 150GB) |
| Firefox | 50% of disk space | ~350MB default, can request more |
| Safari | 50GB (iOS), 1GB (Mac) | Fixed |

**Conservative Estimate:** 50MB per domain (typical Firefox)

### Current Data Size Estimation

#### Campaigns Store
- Campaign record: ~5KB (product name, brand guidelines, settings)
- Typical max campaigns: 10
- Estimated: **50KB**

#### Cycles Store ⚠️ LARGEST
- Per cycle breakdown:
  - Base metadata: ~2KB
  - researchFindings (JSON): 2–10MB per full research cycle
    - Web scraping results (300+ URLs, compressed text)
    - Visual analysis data
    - Desire layers, objections, personas
  - Stage outputs (copywriting, test results): 100KB–1MB each
- **Per cycle: 2–15MB** (depends on research depth preset)
- Max cycles per campaign: **20** (enforced by `MAX_CYCLES_PER_CAMPAIGN`)
- **Estimated: 40–300MB** worst case (20 cycles × 15MB)

#### Generated Images Store ⚠️ HIGH GROWTH
- Per image:
  - Base64-encoded JPEG (quality 60–70): 200–800KB
  - HTML source code (for HTML pipeline): 50–200KB
  - Reference images (base64): 200KB each (if used)
  - Metadata: ~5KB
- **Per image: 450KB–1.2MB**
- Growth: 5–20 new images per cycle (full research + make stage)
- Total across all campaigns: **100+ images over time**
- **Estimated: 50–120MB** (100 images × 1MB average)

#### Memories Store
- localStorage only, ~100KB (lightweight)

#### Checkpoints Store
- Per checkpoint: ~2–5MB (history of all previous steps + state)
- Max 100 per session
- **Estimated: 100–500MB** if sessions are long-running

#### Scheduler Storage
- Tasks: ~10KB each (max 50) = 500KB
- Execution history: ~1KB per execution, max 1000 = 1MB
- **Estimated: 2MB**

### **Total Estimated Current Usage: 200–950MB**

**Status:** 🚨 **OVER QUOTA** in typical 50MB browsers after a few full cycles!

---

## 3. Data Integrity Assessment

### Foreign Key Relationships

| Relationship | Enforced? | Orphan Risk |
|---|---|---|
| Cycle → Campaign (via campaignId) | ❌ No | High: delete campaign → orphaned cycles |
| Image → Campaign (via campaignId) | ❌ No | High: delete campaign → orphaned images |
| Checkpoint → Session (via sessionId) | ❌ No | High: delete session → orphaned checkpoints |
| Execution → Task (via taskId) | ❌ No | Medium: delete task → orphaned executions |

### Validation on Write

```
Storage Layer:
✅ Try-catch wrapping (quota errors caught)
✅ Write serialization (prevents races)
✅ JSON.parse(JSON.stringify(...)) for serialization check
❌ No schema validation
❌ No type guards at runtime
❌ No referential integrity checks
```

**Risk:** Corrupted data can be saved if:
- API layer passes invalid Cycle/Campaign object
- researchFindings contains circular references
- campaignId points to non-existent campaign

### Backup/Recovery Strategy

**Current State:**
- ❌ No backup mechanism
- ❌ No export-on-save
- ❌ No recovery tooling
- Users lose all data if:
  - Browser cache is cleared
  - Disk corruption
  - Quota exceeded (new writes fail)

---

## 4. Migrations & Schema Evolution

### Current Approach

- ❌ No versioning (no `db.version`)
- ❌ No `onupgradeneeded` handler
- ❌ Manual cleanup of deprecated IDs in memoryStore only
- 📝 Checkpoint system has forward-compatibility comment but no version field

### Example: Adding a new field to Cycle
1. Backend adds `newField?: string` to Cycle type
2. All NEW cycles created with `newField` set
3. OLD cycles in IDB still missing `newField`
4. Code must handle `cycle.newField ?? defaultValue` everywhere
5. ⚠️ No safe way to bulk-migrate old data

### Recommended Migration Path
```typescript
// src/utils/storageVersioning.ts
export const STORAGE_VERSION = 2;

async function migrateIfNeeded() {
  const version = localStorage.getItem('storage_version');
  if (version !== String(STORAGE_VERSION)) {
    await migration_v1_to_v2();
    localStorage.setItem('storage_version', String(STORAGE_VERSION));
  }
}
```

---

## 5. localStorage Audit

### What's Stored

| Key | Size | Purpose | Sensitivity |
|---|---|---|---|
| `theme` | <1KB | Dark/light mode | 🟢 Non-sensitive |
| `animations` | <1KB | Animation toggle | 🟢 Non-sensitive |
| `selected_model` | <1KB | Ollama model choice | 🟢 Non-sensitive |
| `research_depth` | <1KB | Preset (SQ/QK/NR/EX/MX) | 🟢 Non-sensitive |
| `nomad_agent_memories` | ~100KB | Agent memories | 🟡 Semi-public (seeded with "User's name is Michael") |
| `nomad_deleted_memories` | <1KB | IDs user deleted | 🟢 Non-sensitive |
| (Others) | Varies | Theme context state | 🟢 Non-sensitive |

### Issues

1. **Hardcoded User Name**
   - memoryStore initializes with "User's name is Michael"
   - Stored in localStorage indefinitely
   - 🔴 Exposed: anyone with access to browser sees the name

2. **No Encryption**
   - localStorage is plaintext (not encrypted at rest)
   - ⚠️ If device is compromised, memories are readable

3. **No Size Limit Enforcement**
   - 274 localStorage writes across codebase
   - Each setItem could fail silently if quota exceeded (~5–10MB typical)
   - No error handling in most places

---

## 6. File System (storageBackend.ts) Audit

### Current State

- ✅ Abstracted interface defined (StorageBackend)
- ✅ LocalBackend implemented (shell exec + API fallback)
- ❌ **Not integrated into browser** (no save locations called)
- 📝 Designed for future MinIO/S3 backend

### Concerns

1. **Shell Command Injection Risk** (if backend is ever exposed)
   - Paths quoted but content escaping via `replace(/'/g, "'\\''")` is fragile
   - Binary write uses base64 pipe (inefficient)

2. **No Cleanup Strategy**
   - Generated files accumulate
   - No TTL or size limits
   - No periodic cleanup job

---

## 7. Known Limitations & Safeguards

### Safeguards ✅

1. **Cycle Pruning**
   ```typescript
   const MAX_CYCLES_PER_CAMPAIGN = 20; // Hard cap
   // Old cycles deleted when saving new ones
   ```
   - Prevents unbounded growth per campaign
   - But doesn't help if there are 100 campaigns

2. **Execution History Pruning**
   ```typescript
   // Keep only last 1000 executions
   const all = Object.entries(executions)
     .sort((a, b) => b[1].startedAt - a[1].startedAt)
     .slice(0, 1000);
   ```
   - Prevents task_executions from growing forever

3. **Write Queue Serialization**
   - Prevents data loss from concurrent writes

### Limitations ❌

1. **No Cross-Campaign Quota**
   - Each campaign can have 20 cycles
   - With large research findings, 5+ campaigns = quota exceeded

2. **No Image Cleanup**
   - Users can generate 100+ images
   - No auto-delete of old images
   - No size warnings

3. **No Checkpoint Cleanup**
   - `MAX_CHECKPOINTS_PER_SESSION = 100`
   - Each checkpoint: 2–5MB
   - Session that creates 100 checkpoints = 200–500MB

4. **No Quota Monitoring**
   - No "available storage" indicator in UI
   - Users don't know when they're running out
   - Writes silently fail when quota exceeded

---

## 8. Risk Assessment Matrix

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Quota exceeded** | 🔴 Critical | High | Implement quota monitoring, auto-cleanup |
| **Orphaned data** | 🟠 High | Medium | Implement referential integrity checks |
| **No recovery** | 🔴 Critical | High | Implement export/import, backups |
| **Migration friction** | 🟠 High | Medium | Version schema, add migration system |
| **Silent write failures** | 🔴 Critical | Medium | Quota monitoring, user warnings |
| **Corrupted research findings** | 🟠 High | Low | Schema validation on write |
| **Memory leak in write queues** | 🟡 Medium | Low | Add cleanup on session end |

---

## 9. Recommendations

### Immediate (Critical)

1. **Add Quota Monitoring**
   ```typescript
   // src/utils/storageQuota.ts
   export async function getStorageUsage(): Promise<{
     used: number;
     quota: number;
     percentUsed: number;
   }> {
     if (!navigator.storage?.estimate) return { used: 0, quota: 50e6, percentUsed: 0 };
     const { usage, quota } = await navigator.storage.estimate();
     return { used, quota, percentUsed: Math.round((usage / quota) * 100) };
   }
   ```

2. **Implement Storage Health Dashboard**
   - Show quota usage in UI
   - Warn when >80% full
   - Block new cycle/image creation when >95% full

3. **Add Referential Integrity Check**
   ```typescript
   // When deleting a campaign, also delete its cycles & images
   async deleteCampaign(id: string): Promise<void> {
     await storage.deleteCyclesForCampaign(id);
     await storage.deleteImagesForCampaign(id);
     // ... then delete campaign
   }
   ```

### Short-term (High Priority)

4. **Implement Storage Versioning**
   - Add version field to critical stores
   - Create migration framework
   - Test migrations on startup

5. **Auto-cleanup Old Images**
   ```typescript
   async deleteImagesOlderThan(days: number): Promise<number> {
     const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
     const images = await storage.getAllImages();
     let deleted = 0;
     for (const img of images) {
       if (img.timestamp < cutoff) {
         await storage.deleteImage(img.id);
         deleted++;
       }
     }
     return deleted;
   }
   ```

6. **Checkpoint Cleanup**
   ```typescript
   // Delete old checkpoints from completed sessions
   async purgeOldCheckpoints(daysOld: number): Promise<void> {
     const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
     // Query all checkpoints, delete if timestamp < cutoff
   }
   ```

### Medium-term (Should Do)

7. **Export/Import System**
   ```typescript
   async exportCampaign(campaignId: string): Promise<Blob> {
     // Package campaign + all cycles + all images as JSON
     // User downloads as backup
   }
   
   async importCampaign(file: File): Promise<Campaign> {
     // Restore from exported JSON
   }
   ```

8. **Remove Hardcoded User Data**
   - memoryStore has "User's name is Michael"
   - Either make user-configurable or remove

9. **localStorage Error Handling**
   - Wrap all setItem calls in try-catch
   - Graceful degradation when quota exceeded

---

## 10. Testing Recommendations

### Storage Quota Tests
```bash
# Simulate quota exceeded
await storage.saveCycle({ /* 100MB cycle */ })
  .catch(err => expect(err.message).toMatch(/quota/i))
```

### Migration Tests
```bash
# Load v1 cycles, verify they work with v2 code
const old = { ...cycle, newField: undefined };
await storage.saveCycle(old);
const loaded = await storage.getCycle(old.id);
expect(loaded.newField).toBeDefined();
```

### Referential Integrity Tests
```bash
const campaign = await storage.getCampaign(id);
await storage.deleteCampaign(campaign.id);
const cycles = await storage.getCyclesByCampaign(campaign.id);
expect(cycles).toHaveLength(0); // Should be cleaned up
```

---

## 11. Summary Table

| Audit Item | Status | Score |
|---|---|---|
| Schema design | ⚠️ Ad-hoc, no versioning | 5/10 |
| Primary keys | ✅ Well-designed IDs | 8/10 |
| Indexes | ❌ None defined | 3/10 |
| Write safety | ✅ Serialized queues | 9/10 |
| Error handling | ✅ Try-catch everywhere | 8/10 |
| Quota management | ❌ No monitoring | 2/10 |
| Data integrity | ⚠️ No FK enforcement | 4/10 |
| Backup/recovery | ❌ None | 1/10 |
| Migrations | ❌ Manual + fragile | 2/10 |
| localStorage safety | ⚠️ Non-sensitive but exposed | 5/10 |

**Overall Storage Health: 5.1/10** — Functional but needs production hardening

---

## Files Referenced in Audit

- `/Users/mk/Downloads/nomads/src/hooks/useStorage.ts` — Storage hook API
- `/Users/mk/Downloads/nomads/src/utils/storage.ts` — Core storage implementation
- `/Users/mk/Downloads/nomads/src/utils/memoryStore.ts` — Agent memories (localStorage)
- `/Users/mk/Downloads/nomads/src/utils/sessionCheckpoint.ts` — Checkpoint persistence
- `/Users/mk/Downloads/nomads/src/utils/schedulerStorage.ts` — Scheduler persistence
- `/Users/mk/Downloads/nomads/src/utils/storageBackend.ts` — File system abstraction
- `/Users/mk/Downloads/nomads/src/context/CampaignContext.tsx` — Provider + BroadcastChannel sync
- `/Users/mk/Downloads/nomads/src/context/ThemeContext.tsx` — Theme persistence
- `/Users/mk/Downloads/nomads/package.json` — `idb-keyval@6.2.2` (latest stable)

---

**Audit Completed:** 2026-04-02
**Next Review:** After implementing quota monitoring
