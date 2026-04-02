# Storage & Database Quick Reference

## Data Flow Diagram

```
User Actions
    ↓
React Components (useCampaign, useStorage hooks)
    ↓
CampaignContext Provider (BroadcastChannel sync)
    ↓
Storage Layer:
├─ storage.ts (campaigns, cycles, images)
├─ sessionCheckpoint.ts (checkpoints)
├─ schedulerStorage.ts (tasks, executions)
└─ memoryStore.ts (agent memories)
    ↓
IndexedDB (idb-keyval) + localStorage
    ↓
Browser Quota (50MB typical)
```

## Key Constants

```typescript
// storage.ts
MAX_CYCLES_PER_CAMPAIGN = 20              // Hard cap per campaign

// sessionCheckpoint.ts
MAX_CHECKPOINTS_PER_SESSION = 100         // Hard cap per session
CHECKPOINTS_KEY = 'agent_checkpoints'

// schedulerStorage.ts
MAX_EXECUTION_HISTORY = 1000              // Keep last 1000 executions
```

## Storage Keys Structure

```
IndexedDB (via idb-keyval):
  campaigns              → Object<campaignId, Campaign>
  cycles                 → Object<cycleId, Cycle>
  generated_images       → Object<imageId, StoredImage>
  agent_sessions         → Object<sessionId, SessionState>
  agent_checkpoints:*    → Checkpoint (one key per checkpoint)
  scheduled_tasks        → Object<taskId, ScheduledTask>
  task_executions        → Object<executionId, TaskExecution>
  schedule_metrics       → Object with metrics

localStorage:
  theme                  → 'dark' | 'light'
  animations             → 'true' | 'false'
  selected_model         → 'qwen3.5:4b' (current selection)
  research_depth         → 'NR' (SQ/QK/NR/EX/MX)
  nomad_agent_memories   → JSON array of Memory[]
  nomad_deleted_memories → JSON array of deleted memory IDs
```

## Write Queue Pattern (Thread Safety)

All critical stores use write queues to prevent race conditions:

```typescript
// Example: Cycle writes
let _cycleWriteQueue: Promise<void> = Promise.resolve();

function enqueueCycleWrite(fn: () => Promise<void>): Promise<void> {
  _cycleWriteQueue = _cycleWriteQueue
    .catch(() => {}) // silently allow previous failures
    .then(fn);       // chain current write
  return _cycleWriteQueue;
}

// Usage: saveCycle always goes through queue
async saveCycle(cycle: Cycle): Promise<void> {
  return enqueueCycleWrite(async () => {
    const cycles = (await get(CYCLES_KEY)) || {};
    cycles[cycle.id] = cycle;
    await set(CYCLES_KEY, cycles);
  });
}
```

## Data Size Estimates (Per Instance)

| Type | Min | Typical | Max |
|------|-----|---------|-----|
| Campaign | 5KB | 10KB | 50KB |
| Cycle (research findings) | 2MB | 8MB | 15MB |
| StoredImage | 450KB | 700KB | 1.2MB |
| Checkpoint | 2MB | 3MB | 5MB |
| Memory | 1KB | 5KB | 50KB |
| ScheduledTask | 2KB | 5KB | 20KB |

## Quota Checking

```typescript
// Not currently implemented, but should be:
async function getStorageUsage() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return {
    used: usage,
    quota: quota,
    percentUsed: (usage / quota * 100).toFixed(1),
    remainingMB: ((quota - usage) / 1024 / 1024).toFixed(1)
  };
}

// Would warn:
// - Usage > 80%: Show warning in UI
// - Usage > 95%: Block new cycle/image creation
```

## Cycle Lifecycle & Storage

```
1. Research Stage
   → Creates Cycle with researchFindings (2-15MB)
   → saveCycle() called
   → If 20+ cycles exist for campaign, oldest deleted
   
2. Make Stage
   → Creates StoredImage records (450KB-1.2MB each)
   → saveImage() called (serialized via imageWriteQueue)
   
3. Archive/Delete
   → User can delete campaign
   → ⚠️ Currently: cycles & images NOT cascade-deleted
   → ✅ Should: storage.deleteCampaign() → cleanup FK
```

## Error Scenarios

### Scenario 1: Quota Exceeded
```
User: Saves new cycle (8MB)
Storage quota: 50MB, used: 48MB
Result: ❌ Quota exceeded
Current: Write fails silently, Promise rejects
Should: Show UI warning before write attempt
```

### Scenario 2: Concurrent Writes
```
Parallel: saveCycle(cycleA), saveCycle(cycleB)
Without queue: Race condition, cycleB overwrites cycleA
With queue: Serialized, both saved safely
Current: ✅ Uses _cycleWriteQueue, safe
```

### Scenario 3: Corrupted Data
```
If researchFindings contains circular references:
Result: JSON.stringify() throws
Current: Caught by try-catch, error propagates
Should: Schema validation before write
```

## BroadcastChannel Sync (Multi-tab)

```typescript
// When cycle completes in Tab A:
broadcastCycleEvent('cycle-completed', campaignId)
  → BroadcastChannel sends message

// Tab B listens:
if (type === 'cycle-completed') {
  loadCampaignsFromStorage()  // Reload from IDB
}

// Ensures multi-tab consistency
```

## Best Practices

1. **Always await storage calls**
   ```typescript
   const campaign = await storage.getCampaign(id);  // ✅
   storage.getCampaign(id);  // ❌ Fire-and-forget loses errors
   ```

2. **Check for null before using**
   ```typescript
   const campaign = await storage.getCampaign(id);
   if (!campaign) {
     // Handle not found
   }
   ```

3. **Use proper error handling**
   ```typescript
   try {
     await storage.saveCycle(cycle);
   } catch (err) {
     if (err.message.includes('quota')) {
       // Show quota warning
     }
   }
   ```

4. **Don't store circular references**
   ```typescript
   const badData = { self: null };
   badData.self = badData;
   await storage.saveCycle(badData);  // ❌ Will fail
   ```

## Cleanup Opportunities

### Manual Cleanup (For Users)
```typescript
// Delete old images
const images = await storage.getAllImages();
const old = images.filter(img => 
  Date.now() - img.timestamp > 30 * 24 * 60 * 60 * 1000
);
for (const img of old) {
  await storage.deleteImage(img.id);
}

// Delete all data
await storage.clear();
```

### Automatic Cleanup (Should Implement)
```typescript
// On app load:
await storage.deleteImagesOlderThan(30);  // 30 days
await sessionCheckpoint.purgeOldCheckpoints(7);  // 7 days
await schedulerStorage.clearExecutionHistory();  // Keep 1000
```

## Migration Pattern (When Schema Changes)

Current approach: ❌ Manual, fragile

Proposed approach:
```typescript
const STORAGE_VERSION = 2;

async function migrateIfNeeded() {
  const version = localStorage.getItem('storage_version') || '1';
  
  if (version === '1') {
    // v1 → v2: Add 'desireId' field to cycles
    const cycles = (await get('cycles')) || {};
    for (const id in cycles) {
      if (!cycles[id].desireId) {
        cycles[id].desireId = 'legacy';
      }
    }
    await set('cycles', cycles);
  }
  
  localStorage.setItem('storage_version', String(STORAGE_VERSION));
}

// Call on app init:
if (typeof window !== 'undefined') {
  migrateIfNeeded().catch(err => console.error(err));
}
```

## Monitoring Checklist

Use this to track storage health:

```
Daily:
  □ Check browser console for storage errors
  □ Verify new cycles saved without errors
  □ Test image generation (at least one)

Weekly:
  □ Check IndexedDB size in DevTools
  □ Verify multi-tab sync works (open in 2 tabs)
  □ Test delete campaign (verify cycles deleted)

Monthly:
  □ Run export/import cycle (after implemented)
  □ Verify old data still loads correctly
  □ Check for orphaned records (after implemented)
```

## Testing Storage Layer

```bash
# Run storage tests (if available)
npm run test -- storage

# Manual testing in DevTools:
// Check all campaigns
const campaigns = await storage.getAllCampaigns();
console.log(campaigns);

// Check quota
const est = await navigator.storage.estimate();
console.log(`Used: ${(est.usage/1024/1024).toFixed(1)}MB / ${(est.quota/1024/1024).toFixed(1)}MB`);

// Check for orphans
const cycles = await storage.getCyclesByCampaign('nonexistent');
console.log('Orphaned cycles:', cycles.length);  // Should be 0
```

---

**Last Updated:** 2026-04-02
**Full Audit:** See STORAGE_AUDIT.md
