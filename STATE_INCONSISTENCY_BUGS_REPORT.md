# State Inconsistency Bugs Report

## Executive Summary

Identified **6 critical state inconsistency bugs** in multi-step operations where partial state updates leave the application in an unstable state when operations fail. Each bug represents a scenario where:
1. State is updated early in a sequence
2. A subsequent operation fails
3. State remains half-updated, causing cascading failures

---

## Bug #1: Task Scheduler Race Condition on Completion
**Severity**: HIGH
**File**: `/Users/mk/Downloads/nomads/frontend/components/AppShell.tsx` (lines 322-342)
**Pattern**: Multi-step async operation without proper state rollback

### Issue
The scheduled task completion flow has a race condition:

```typescript
// Line 324: Update task status to RUNNING
await markTaskRunning(taskId, newId);
window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));

// Line 326: Set local state
setInitialMessage(prompt);

// Line 327: Navigate (user can see chat)
await navigate(`/neuro/${newId}`);
setShowHome(false);
await refreshChats();

// Line 332-334: Attempt to mark COMPLETED 2 seconds later (delayed)
setTimeout(async () => {
  try {
    await markTaskCompleted(taskId);
    // If this fails, task stays as RUNNING forever
    window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));
  } catch (e) {
    // Silent failure - task still marked as RUNNING
  }
}, 2000);
```

### Problem
1. Task marked as RUNNING immediately (line 324)
2. Navigation and UI updates happen before completion is guaranteed (line 327-329)
3. Completion is delayed by 2 seconds (line 330) - plenty of time for failure
4. If `markTaskCompleted` fails, task remains RUNNING indefinitely
5. Users cannot schedule new tasks while old one is stuck RUNNING

### Root Cause
- No previous state backup before `markTaskRunning`
- No rollback in error handler (line 335-337 only logs error)
- Separation of responsibility: running status set before completion path is guaranteed

### Fix Strategy
Store previous task state before marking RUNNING, and rollback on completion failure:

```typescript
const handleScheduledTask = async (e: Event) => {
  const { taskId, prompt } = (e as CustomEvent<{ taskId: string; prompt: string }>).detail;
  let previousStatus: ScheduledTask['status'] = 'pending';

  try {
    // Get previous state for rollback
    const previousTask = await getTask(taskId);
    if (previousTask) previousStatus = previousTask.status;

    const newId = crypto.randomUUID();
    await markTaskRunning(taskId, newId);
    window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));

    setInitialMessage(prompt);
    await navigate(`/neuro/${newId}`);
    setShowHome(false);
    await refreshChats();

    // Don't delay completion - mark as running ONLY when chat is created
    // Move this into AgentPanel's onComplete callback
    await markTaskCompleted(taskId); // Now truly synchronous with session end
    window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));
    await refreshBadge();
  } catch (err) {
    // CRITICAL FIX: Rollback to previous state
    try {
      await updateTaskStatus(taskId, previousStatus);
      window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    const msg = err instanceof Error ? err.message : String(err);
    await markTaskFailed(taskId, msg);
    window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));
  }
};
```

---

## Bug #2: Campaign Cascade Delete Partial Update
**Severity**: CRITICAL
**File**: `/Users/mk/Downloads/nomads/frontend/utils/storage.ts` (lines 139-167)

### Issue
The `deleteCampaign` function performs a 3-step cascade delete:

```typescript
async deleteCampaign(id: string): Promise<void> {
  try {
    // Step 1: Delete all cycles (can fail)
    await this.deleteCyclesForCampaign(id);

    // Step 2: Delete all images (can fail here)
    const images = (await get(GENERATED_IMAGES_KEY)) || {};
    const imagesToDelete = Object.keys(images).filter(...);
    for (const imgId of imagesToDelete) {
      delete images[imgId];
    }
    if (imagesToDelete.length > 0) {
      await set(GENERATED_IMAGES_KEY, images); // FAILURE POINT #2
    }

    // Step 3: Delete campaign (can fail)
    const campaigns = (await get(CAMPAIGNS_KEY)) || {};
    delete campaigns[id];
    await set(CAMPAIGNS_KEY, campaigns); // FAILURE POINT #3
  } catch (err) {
    // Problem: State is partially deleted
    throw err;
  }
}
```

### Problem
1. **Step 1 succeeds, Step 2 fails**: Cycles deleted but campaign + images remain → orphaned images
2. **Step 1-2 succeed, Step 3 fails**: Campaign metadata deleted, but cycles still exist → zombie cycles
3. **No idempotency**: Retrying creates duplicated work or errors
4. **No rollback**: Previous steps' state changes are permanent

### Root Cause
- Multi-step operation without atomic boundaries
- No previous state snapshot before modifications
- No transaction semantics (IndexedDB doesn't support multi-store transactions easily)
- try-catch at end doesn't help because some mutations already occurred

### Fix Strategy
Use a pre-flight check, backup, and rollback pattern:

```typescript
async deleteCampaign(id: string): Promise<void> {
  // Phase 1: Validation & Backup
  const backup = {
    campaignId: id,
    cycles: [] as string[],
    images: [] as string[],
    timestamp: Date.now(),
  };

  try {
    // Get all affected data BEFORE deletion
    const cycles = await this.getCyclesByCampaign(id);
    backup.cycles = cycles.map(c => c.id);

    const allImages = (await get(GENERATED_IMAGES_KEY)) || {};
    const affectedImages = Object.entries(allImages)
      .filter(([, img]) => (img as StoredImage).campaignId === id)
      .map(([id]) => id);
    backup.images = affectedImages;

    // Phase 2: Delete with checkpoints
    const deleteCyclesResult = await this._safeCycleDelete(backup.cycles);
    if (!deleteCyclesResult.success) {
      throw new Error(`Failed to delete cycles: ${deleteCyclesResult.error}`);
    }

    const deleteImagesResult = await this._safeImageDelete(backup.images);
    if (!deleteImagesResult.success) {
      // Restore cycles since images failed
      await this._restoreCycles(backup.cycles);
      throw new Error(`Failed to delete images: ${deleteImagesResult.error}`);
    }

    const deleteCampaignResult = await this._safeCampaignDelete(id);
    if (!deleteCampaignResult.success) {
      // Restore everything
      await this._restoreCycles(backup.cycles);
      await this._restoreImages(backup.images);
      throw new Error(`Failed to delete campaign: ${deleteCampaignResult.error}`);
    }

    console.log(`[storage] Successfully cascade deleted campaign ${id}`);
  } catch (err) {
    console.error('[storage] deleteCampaign failed:', err);
    throw err;
  }
}
```

---

## Bug #3: Session Checkpoint Save Without Rollback
**Severity**: HIGH
**File**: `/Users/mk/Downloads/nomads/frontend/utils/sessionCheckpoint.ts` (lines 148-237)

### Issue
The `saveCheckpoint` function has multi-step updates without atomic semantics:

```typescript
async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  return enqueueCheckpointWrite(async () => {
    // Step 1: Attempt backup (optional, can fail silently)
    let backupId: string | null = null;
    try {
      backupId = await checkpointRollback.backupCheckpoint(checkpoint);
    } catch (backupErr) {
      // Silent continuation - no backup!
    }

    // Step 2: Save with retry (can fail)
    const result = await retryWithBackoff(async () => {
      // PARTIAL UPDATES:
      await set(key, checkpoint); // State A updated

      const sessions = (await get(SESSIONS_KEY)) || {};
      if (!sessions[checkpoint.sessionId]) {
        sessions[checkpoint.sessionId] = { ... };
      }
      const session = sessions[checkpoint.sessionId];
      if (!session.checkpoints.includes(checkpoint.id)) {
        session.checkpoints.push(checkpoint.id); // State B updated
      }
      session.lastCheckpointId = checkpoint.id;
      session.elapsedMs = Date.now() - session.startTime;

      // Pruning mutates the checkpoint array IN-PLACE
      if (session.checkpoints.length > MAX_CHECKPOINTS_PER_SESSION) {
        const toRemove = session.checkpoints.slice(0, ...);
        for (const cpId of toRemove) {
          await del(`${CHECKPOINTS_KEY}:${cpId}`); // State C deleted
        }
        session.checkpoints = session.checkpoints.slice(-MAX_CHECKPOINTS_PER_SESSION);
      }

      // Step 3: Final write (can fail after A, B, C already done)
      await set(SESSIONS_KEY, sessions);
    }, ...);
  });
}
```

### Problem
1. If `set(key, checkpoint)` succeeds but `retryWithBackoff` fails overall:
   - New checkpoint is saved in IndexedDB
   - But session list doesn't include it
   - Orphaned checkpoint that can't be recovered

2. If pruning's `del()` succeeds but final `set()` fails:
   - Checkpoints deleted from DB
   - Session list still references them
   - Broken references in session state

3. Backup can fail silently (line 155), then main save fails without backup

### Root Cause
- Multi-step mutations without transaction semantics
- Checkpoint stored separately from session list (2 separate writes)
- In-place mutations during retry loop make rollback impossible

### Fix Strategy
Use all-or-nothing semantics:

```typescript
async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  return enqueueCheckpointWrite(async () => {
    const previousSession = await this._loadSession(checkpoint.sessionId);

    const result = await retryWithBackoff(async () => {
      // Phase 1: Prepare
      const checkpointKey = `${CHECKPOINTS_KEY}:${checkpoint.id}`;
      const sessions = (await get(SESSIONS_KEY)) || {};
      const session = sessions[checkpoint.sessionId] ?? {
        sessionId: checkpoint.sessionId,
        startTime: Date.now(),
        checkpoints: [],
        isResumed: false,
        status: 'in-progress',
      };

      // Phase 2: Calculate new state (no mutations yet)
      const newCheckpoints = session.checkpoints.includes(checkpoint.id)
        ? session.checkpoints
        : [...session.checkpoints, checkpoint.id];

      const checkpointsToKeep = newCheckpoints
        .slice(-MAX_CHECKPOINTS_PER_SESSION);

      // Phase 3: Atomic write (all-or-nothing)
      const checkpointsToDelete = newCheckpoints.filter(
        id => !checkpointsToKeep.includes(id)
      );

      // Use Promise.all for atomicity
      await Promise.all([
        set(checkpointKey, checkpoint),
        ...checkpointsToDelete.map(id => del(`${CHECKPOINTS_KEY}:${id}`)),
        set(SESSIONS_KEY, {
          ...sessions,
          [checkpoint.sessionId]: {
            ...session,
            checkpoints: checkpointsToKeep,
            lastCheckpointId: checkpoint.id,
            elapsedMs: Date.now() - session.startTime,
          }
        }),
      ]);
    }, ...);

    if (!result.success) {
      // Restore previous session state if we have a backup
      if (previousSession) {
        try {
          await set(SESSIONS_KEY, { ...sessions, [checkpoint.sessionId]: previousSession });
        } catch (e) {
          console.error('[sessionCheckpoint] Restore failed:', e);
        }
      }
      throw result.error || new Error('Failed to save checkpoint');
    }
  });
}
```

---

## Bug #4: Task Scheduler Repeat Reschedule Race
**Severity**: MEDIUM
**File**: `/Users/mk/Downloads/nomads/frontend/utils/taskScheduler.ts` (lines 338-355)

### Issue
Repeating task reschedule can leave task in inconsistent state:

```typescript
async function checkAndRunPendingTasks(): Promise<void> {
  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    if (task.runAt > now) continue;
    if (task.queued && hasRunning) continue;

    // Task is ready to run!
    await executeScheduledTask(task); // Can fail, no state update

    // Handle repeating tasks
    if (task.repeat) {
      const maxRuns = task.repeat.maxRuns || Infinity;
      const runsCompleted = (task.runsCompleted || 0) + 1;

      if (runsCompleted < maxRuns) {
        // IN-PLACE MUTATION (problem!)
        task.status = 'pending';
        task.runAt = now + task.repeat.interval;
        task.runsCompleted = runsCompleted;
        await db.put(STORE_NAME, task); // Can fail
      } else {
        // Max runs reached, mark as completed
        await updateTaskStatus(task.id, 'completed'); // Can fail
      }
    }
  }
}
```

### Problem
1. `executeScheduledTask` dispatches event but doesn't update DB
2. If task execution fails internally, task stays as 'pending'
3. If `db.put()` fails to reschedule, task is lost in limbo state
4. Next check either re-runs immediately or loses the task entirely
5. In-place mutation of `task` object makes it unclear what DB state actually is

### Root Cause
- Event dispatch without state mutation (task stays pending)
- Reschedule write can fail, leaving inconsistent state
- No previous state snapshot for rollback

### Fix Strategy

```typescript
async function checkAndRunPendingTasks(): Promise<void> {
  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    if (task.runAt > now) continue;
    if (task.queued && hasRunning) continue;

    // Store previous state
    const previousStatus = task.status;
    const previousRunAt = task.runAt;
    const previousRunsCompleted = task.runsCompleted ?? 0;

    try {
      // Execute (event-based, no state change)
      await executeScheduledTask(task);

      // Handle repeating tasks
      if (task.repeat) {
        const maxRuns = task.repeat.maxRuns || Infinity;
        const runsCompleted = previousRunsCompleted + 1;

        if (runsCompleted < maxRuns) {
          // Create new object (don't mutate)
          const rescheduledTask = {
            ...task,
            status: 'pending' as const,
            runAt: now + task.repeat.interval,
            runsCompleted,
          };

          // Save with error handling
          try {
            await db.put(STORE_NAME, rescheduledTask);
          } catch (e) {
            console.error(`Failed to reschedule task ${task.id}:`, e);
            // Mark as failed instead of leaving in pending state
            await updateTaskStatus(task.id, 'failed', `Reschedule failed: ${String(e)}`);
          }
        } else {
          // Max runs reached
          try {
            await updateTaskStatus(task.id, 'completed');
          } catch (e) {
            console.error(`Failed to complete task ${task.id}:`, e);
            // Fallback: mark as pending again to retry later
            await updateTaskStatus(task.id, 'pending');
          }
        }
      }
    } catch (e) {
      console.error(`Task execution failed for ${task.id}:`, e);
      // Mark failed but don't reschedule
      await updateTaskStatus(task.id, 'failed', String(e)).catch(err => {
        console.error('Failed to mark task as failed:', err);
      });
    }
  }
}
```

---

## Bug #5: Metrics Storage Concurrent Save Race
**Severity**: MEDIUM
**File**: `/Users/mk/Downloads/nomads/frontend/utils/storageAdapter.ts` (lines 109-133)

### Issue
`saveMetrics` doesn't prevent concurrent saves to same session:

```typescript
async saveMetrics(
  sessionId: string,
  sessionMetrics: SessionMetrics,
  clickMetrics: ClickMetric[],
): Promise<void> {
  await this.init(); // No write queue serialization

  const stored: StoredSession = {
    sessionId,
    startTime: sessionMetrics.startTime,
    metrics: clickMetrics,
    sessionMetrics,
    exportedAt: new Date().toISOString(),
  };

  // Two concurrent calls can race here:
  // Call A: reads session, modifies, writes
  // Call B: reads same session (still has Call A's old data), modifies, writes
  // Result: Call B's write overwrites Call A's changes
  return this._withTransaction(STORE_NAME, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.put(stored); // No read-modify-write atomicity
      req.onsuccess = () => {
        log.debug(`Saved metrics for session ${sessionId}`);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  });
}
```

### Problem
1. No write queue serialization (unlike `storage.ts` with `_cycleWriteQueue`)
2. Concurrent calls can lose updates
3. `put()` overwrites entirely, losing any concurrent modifications
4. No version check or merge strategy

### Root Cause
- Missing serialization queue (see `storage.ts` line 63)
- No read-modify-write atomicity
- Assumed single-threaded access (wrong assumption with Service Workers, async jobs)

### Fix Strategy
Add write queue like `storage.ts`:

```typescript
// At top of StorageAdapter class
private saveMetricsQueue: Promise<void> = Promise.resolve();

async saveMetrics(
  sessionId: string,
  sessionMetrics: SessionMetrics,
  clickMetrics: ClickMetric[],
): Promise<void> {
  // Serialize writes per session
  return new Promise((resolve, reject) => {
    this.saveMetricsQueue = this.saveMetricsQueue
      .catch(() => { /* continue on failure */ })
      .then(async () => {
        await this.init();

        const stored: StoredSession = {
          sessionId,
          startTime: sessionMetrics.startTime,
          metrics: clickMetrics,
          sessionMetrics,
          exportedAt: new Date().toISOString(),
        };

        return this._withTransaction(STORE_NAME, 'readwrite', (store) => {
          return new Promise<void>((res, rej) => {
            const req = store.put(stored);
            req.onsuccess = () => {
              log.debug(`Saved metrics for session ${sessionId}`);
              res();
            };
            req.onerror = () => rej(req.error);
          });
        });
      })
      .then(resolve)
      .catch(reject);
  });
}
```

---

## Bug #6: Error State Not Cleared on Successful Retry
**Severity**: LOW
**File**: `/Users/mk/Downloads/nomads/frontend/hooks/useStorage.ts` (lines 15-23)

### Issue
Hook state doesn't clear errors on subsequent operations if first operation failed:

```typescript
const saveCampaign = useCallback(async (campaign: Campaign) => {
  try {
    await storage.saveCampaign(campaign);
    if (mountedRef.current) setError(null); // Only called on success
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save campaign';
    if (mountedRef.current) setError(msg);
    throw err; // Error is NOT cleared on next retry
  }
}, []);
```

### Problem
1. If first call fails with "Quota exceeded", error state is set
2. User retries the operation
3. Second call succeeds
4. But `setError(null)` is called at line 18
5. However, if caller catches the exception and doesn't know about error clearing, UI still shows old error

More critical: If multiple components use this hook, one might fail while another succeeds, causing confusion.

### Root Cause
- Error state not cleared at operation START
- Expected caller to know to clear error before retry
- No "loading" state to distinguish "attempting" from "failed"

### Fix Strategy

```typescript
export function useStorage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveCampaign = useCallback(async (campaign: Campaign) => {
    // Clear error at START of operation
    setError(null);
    setIsLoading(true);

    try {
      await storage.saveCampaign(campaign);
      if (mountedRef.current) {
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save campaign';
      if (mountedRef.current) {
        setError(msg);
        setIsLoading(false);
      }
      throw err;
    }
  }, []);

  return {
    error,
    isLoading,
    saveCampaign,
    // ... other methods
  };
}
```

---

## Summary of Fixes

| Bug | File | Severity | Type | Fix |
|-----|------|----------|------|-----|
| #1 | AppShell.tsx | HIGH | Race Condition | Store previous state, rollback on failure |
| #2 | storage.ts | CRITICAL | Cascade Delete | Atomic multi-step with rollback |
| #3 | sessionCheckpoint.ts | HIGH | Orphaned Records | All-or-nothing write semantics |
| #4 | taskScheduler.ts | MEDIUM | Repeat Reschedule | Previous state snapshots |
| #5 | storageAdapter.ts | MEDIUM | Concurrent Writes | Add write queue serialization |
| #6 | useStorage.ts | LOW | Error State | Clear error at operation start |

---

## Testing Recommendations

1. **Simulate IDB quota exceeded** during multi-step operations
2. **Kill processes mid-operation** to test rollback paths
3. **Concurrent API calls** to verify serialization
4. **Inspect IndexedDB directly** to find orphaned records
5. **Monitor for "stuck" task states** in production logs
6. **Verify deletion cascades** actually remove all associated data
