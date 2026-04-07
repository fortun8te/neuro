# Recovery Implementation — Quick Reference

## What Was Fixed

**Before**: Async storage operations failed silently on transient errors (network, timeouts)
**After**: All operations auto-retry with exponential backoff and rollback capability

## The 3 New Systems

### 1. Retry with Backoff
**File**: `utils/retryWithBackoff.ts`

```typescript
// Automatic retry with exponential backoff
const result = await retryWithBackoff(fn, {
  maxRetries: 5,           // 6 total attempts
  initialDelayMs: 500,     // Start at 500ms
  maxDelayMs: 8000,        // Cap at 8 seconds
  contextName: 'myOp',
});

if (!result.success) {
  console.error(`Failed after ${result.attempts} attempts`);
  console.error(`Failure type: ${result.failureType}`); // 'transient', 'permanent', 'max-retries-exceeded'
}
```

**Retry Timeline**:
```
Attempt 1: immediately
Attempt 2: ~500ms
Attempt 3: ~1s
Attempt 4: ~2s
Attempt 5: ~4s
Attempt 6: ~8s
```

### 2. Checkpoint Rollback
**File**: `utils/checkpointRollback.ts`

```typescript
// Auto-save backups and rollback on failure
const backupId = await checkpointRollback.backupCheckpoint(checkpoint);
// ... try to save ...
if (saveFailed) {
  const restored = await checkpointRollback.restoreFromBackup(backupId);
  // Last 3 versions kept, automatic pruning
}

// Get version history
const history = await checkpointRollback.getCheckpointHistory(cpId);
// Returns: [{ backupId, backedUpAt, isCurrentVersion }]
```

### 3. Recovery Events
**File**: `utils/recoveryEvents.ts`

```typescript
// Subscribe to recovery notifications
recoveryEvents.subscribe((event) => {
  if (event.type === 'save-retry') {
    ui.updateStatus(`Attempt ${event.attempt}/${event.maxRetries}`);
  }
}, ['save-retry', 'save-permanent-failure']);

// Get failure statistics
const stats = recoveryEvents.getFailureStats();
// { 'save-max-retries-exceeded': 2, 'load-permanent-failure': 1 }
```

## Where It's Used

### Session Management
**File**: `utils/sessionCheckpoint.ts`

All these now auto-retry:
- `saveCheckpoint()` — saves with backup + rollback
- `loadCheckpoint()` — loads with retry
- `createSession()` — creates with retry
- `loadSession()` — loads with retry
- `resumeSession()` — resumes with retry

### Storage Service
**File**: `utils/storage.ts`

All these now auto-retry:
- `saveCampaign()`, `getCampaign()`
- `saveCycle()`, `getCycle()`
- `saveImage()`, `getImage()`
- And more...

## Error Types

### Auto-Retried (Transient)
- Network failures: `TypeError: failed to fetch`
- Timeouts: `AbortError: timeout`
- Storage quota: `QuotaExceededError`

→ Retries automatically, may eventually succeed

### Fail Immediately (Permanent)
- Syntax errors: `SyntaxError: invalid json`
- Reference errors: `ReferenceError: undefined`
- Permission errors: "permission denied"

→ Fails immediately, no retry

## Console Logs to Watch

```
[sessionCheckpoint] saveCheckpoint[cp-123] attempt 1/6
[sessionCheckpoint] saveCheckpoint[cp-123] failed: Network error (transient)
[sessionCheckpoint] saveCheckpoint[cp-123] retrying in 523ms (attempt 2 of 6)
[sessionCheckpoint] saveCheckpoint[cp-123] succeeded on attempt 2/6
```

If you see this:
```
[sessionCheckpoint] Failed to save checkpoint after 6 attempts (max-retries-exceeded)
```

The operation exhausted all retries. Check for:
1. Network connectivity
2. Storage quota issues
3. Browser storage disabled

## Backup Mechanism

```
Save Checkpoint
  ↓
1. Create Backup (auto)
  ↓
2. Attempt Save (retry up to 5 times)
  ├─ Success → Mark as current version
  └─ Permanent Failure → Restore from previous backup

Keeps: Last 3 versions of each checkpoint
Stored: In IndexedDB under checkpoint_backups
```

## For Developers

### Adding Retry to New Operations

```typescript
import { retryWithBackoff } from './retryWithBackoff';

async myOperation() {
  const result = await retryWithBackoff(
    async () => {
      // Your operation here
      const data = await indexedDB.get('key');
      return data;
    },
    {
      maxRetries: 5,
      initialDelayMs: 500,
      contextName: 'myOperation',
    }
  );

  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
```

### Custom Error Classification

```typescript
const result = await retryWithBackoff(fn, {
  isTransient: (error) => {
    // Return true if error should be retried
    return error.message.includes('custom_transient_error');
  }
});
```

### Testing

```typescript
import { retryWithBackoff } from './retryWithBackoff';

test('should retry on transient error', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    if (attempts < 3) throw new TypeError('network failed');
    return 'success';
  };

  const result = await retryWithBackoff(fn, { maxRetries: 5 });
  expect(result.success).toBe(true);
  expect(attempts).toBe(3);
});
```

## Troubleshooting

### Checkpoint Save Always Fails
1. Check browser console for error type
2. If `QuotaExceededError`: Browser storage full
   - Clear old sessions: `sessionCheckpoint.purgeCompletedSessions()`
   - Check other app data stored in IndexedDB
3. If `TypeError` with network: Check connectivity
4. If other error: Permanent failure, needs code fix

### Data Loss Risk
- Backups prevent most data loss
- If save fails 6 times: Previous checkpoint restored
- Last 3 versions kept for each checkpoint
- Check `recoveryEvents.getHistory()` to see what happened

### Performance Issues
- If operations taking >15 seconds: Retry exhaustion
- Check network connectivity
- Look for storage quota issues
- Review `recoveryEvents.getFailureStats()`

## Testing Checklist

- ✅ Tested network failure recovery
- ✅ Tested transient error retries
- ✅ Tested permanent error immediate failure
- ✅ Tested checkpoint backup/restore
- ✅ Tested backup versioning (max 3)
- ✅ Tested event emissions
- ✅ Zero TypeScript errors
- ✅ All existing tests still pass

## Files to Review

1. **Core Logic**: `utils/retryWithBackoff.ts` (160 lines)
2. **Backups**: `utils/checkpointRollback.ts` (250 lines)
3. **Events**: `utils/recoveryEvents.ts` (130 lines)
4. **Tests**: `utils/__tests__/retryWithBackoff.test.ts` (300 lines)
5. **Integration**: `utils/sessionCheckpoint.ts` (modifications)
6. **Integration**: `utils/storage.ts` (modifications)
7. **Docs**: `RECOVERY_IMPLEMENTATION.md` (comprehensive)
8. **Summary**: `RECOVERY_CHANGES_SUMMARY.md` (detailed)

## API Summary

### retryWithBackoff
```typescript
retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<RetryResult<T>>
```

### checkpointRollback
```typescript
backupCheckpoint(cp: Checkpoint): Promise<string>
restoreFromBackup(id: string): Promise<Checkpoint | null>
getCheckpointBackups(cpId: string): Promise<CheckpointBackup[]>
getMostRecentBackup(cpId: string): Promise<CheckpointBackup | null>
markAsCurrentVersion(id: string): Promise<void>
getCheckpointHistory(cpId: string): Promise<HistoryEntry[]>
deleteBackup(id: string): Promise<void>
clearCheckpointBackups(cpId: string): Promise<void>
```

### recoveryEvents
```typescript
subscribe(fn: RecoveryListener, types?: RecoveryEventType[]): () => void
emit(event: RecoveryEvent): void
getHistory(limit?: number, types?: RecoveryEventType[]): RecoveryEvent[]
getFailureStats(): Record<string, number>
clearHistory(): void
```

## One More Thing

Recovery is **transparent** — no code changes needed for existing operations. All retry happens automatically behind the scenes. Existing callers get better reliability at no cost.

```typescript
// This already works with automatic retry + rollback
await sessionCheckpoint.saveCheckpoint(cp);

// This already works with automatic retry
const cp = await sessionCheckpoint.loadCheckpoint(cpId);
```

That's it!
