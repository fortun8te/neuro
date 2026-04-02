# Phase 4 Testing Guide

## Manual Testing Checklist

### 1. Timeout Enforcement Test

**Objective:** Verify that hanging requests are killed after 30s

**Steps:**
1. Start the dev server: `npm run dev`
2. In browser DevTools Console, manually test timeout:
```javascript
import { globalTimeoutManager } from './src/utils/aggressiveTimeouts';

// Create a promise that never resolves
const neverResolves = new Promise(() => {});

// Wrap it with 1s timeout
try {
  await globalTimeoutManager.enforceRequestTimeout(
    neverResolves,
    'test-hang',
    1000 // 1 second timeout
  );
} catch (err) {
  console.log('Caught timeout:', err.message);
}
```

**Expected Result:**
- After 1 second, TimeoutError is thrown
- Console shows: `Caught timeout: Timeout: test-hang exceeded 1000ms...`

---

### 2. Watchdog Process Tracking Test

**Objective:** Verify process watchdog tracks and monitors processes

**Steps:**
1. In browser DevTools Console:
```javascript
import { processWatchdog } from './src/utils/processWatchdog';

// Track a process
const procId = processWatchdog.trackProcess('test-process');
console.log('Process ID:', procId);

// Simulate a crash
const error = new Error('Test crash');
const action = processWatchdog.onProcessCrash(procId, error);
console.log('Action:', action); // Should be 'retry'

// Check stats
const stats = processWatchdog.getStats();
console.log('Stats:', stats);
```

**Expected Result:**
- Process is tracked with unique ID
- Crash returns 'retry' action (not yet at max retries)
- Stats show the process in crash history

---

### 3. Crash Recovery Checkpoint Test

**Objective:** Verify checkpoints are saved and loaded correctly

**Steps:**
1. In browser DevTools Console:
```javascript
import { globalCrashRecoveryManager } from './src/utils/crashRecoveryManager';

const sessionId = 'test-session-' + Date.now();
const mockCycle = {
  id: 'test-cycle-1',
  campaignId: 'test-campaign',
  stages: {
    research: { status: 'complete', agentOutput: 'Research results...' }
  }
};

// Save checkpoint
await globalCrashRecoveryManager.saveCheckpoint(
  sessionId,
  mockCycle,
  'research'
);
console.log('Checkpoint saved');

// Load checkpoint
const checkpoint = await globalCrashRecoveryManager.loadCheckpoint(sessionId);
console.log('Checkpoint loaded:', checkpoint);
```

**Expected Result:**
- Checkpoint saved to IndexedDB
- Checkpoint loaded successfully
- Contains correct cycle ID and phase name

---

### 4. Watchdog Health Monitoring Test

**Objective:** Verify watchdog monitors service health

**Steps:**
1. Start the app with Phase 4 enabled
2. Open browser DevTools Console
3. Monitor the console logs:
```javascript
// Watch for watchdog logs
setInterval(() => {
  const logs = console.log.toString(); // Get recent logs
}, 5000);
```

**Expected Result:**
- Every 30 seconds (VITE_WATCHDOG_INTERVAL), watchdog checks run
- Console shows active process counts
- No errors in watchdog operation

---

### 5. Overnight Mode Stress Test (Optional)

**Objective:** Test 2+ hour continuous operation without crashes

**Setup:**
1. Enable all Phase 4 flags in `.env`:
```bash
VITE_AGGRESSIVE_TIMEOUTS_ENABLED=true
VITE_TIMEOUT_PYRAMID_ENABLED=true
VITE_WATCHDOG_ENABLED=true
VITE_CRASH_RECOVERY_ENABLED=true
VITE_OVERNIGHT_MODE_ENABLED=true
```

2. Set long checkpoint interval:
```bash
VITE_SESSION_CHECKPOINTING_INTERVAL=60000  # 1 minute
VITE_WATCHDOG_INTERVAL=30000                # 30 seconds
```

**Steps:**
1. Start campaign research with overnight mode enabled
2. Let it run for 2+ hours
3. Monitor:
   - IndexedDB for checkpoint growth
   - Browser console for errors
   - Memory usage (watch for leaks)
   - CPU usage (should be stable)

**Expected Result:**
- Cycle completes without hanging
- Checkpoints save periodically
- No memory leaks or CPU spikes
- Services remain stable throughout

---

### 6. Crash Recovery Scenario Test

**Objective:** Verify recovery from simulated crash

**Steps:**
1. Start a research cycle
2. Let it run for 1-2 phases (so checkpoint exists)
3. Close the browser tab/window
4. Reopen the app within 30 seconds
5. Check for crash detection

**Expected Behavior:**
- App detects crash via stale heartbeat
- Loads checkpoint from IndexedDB
- Offers option to resume (future UI feature)
- Can continue from last completed phase

**Current Behavior (without recovery UI):**
- Logs: `[CrashRecovery] Crash detected...`
- Attempts to load checkpoint
- Restarts cleanly if recovery enabled

---

## Automated Testing

Run the test suite:
```bash
npm test -- src/utils/__tests__/phase4-integration.test.ts
```

Test coverage includes:
- Timeout enforcement and cancellation
- Checkpoint persistence
- Crash detection logic
- Process tracking metrics
- Feature flag configuration

---

## Monitoring & Debugging

### Enable Debug Logs

Add to `src/config/infrastructure.ts`:
```typescript
// Add verbose logging
const DEBUG = localStorage.getItem('phase4_debug') === 'true';

if (DEBUG) {
  console.log('[Phase4] All systems online');
  console.log('[Phase4] Timeouts:', INFRASTRUCTURE.aggressiveTimeoutsEnabled);
  console.log('[Phase4] Crash Recovery:', INFRASTRUCTURE.crashRecoveryEnabled);
  console.log('[Phase4] Watchdog:', INFRASTRUCTURE.watchdogEnabled);
}
```

Enable debug mode:
```javascript
localStorage.setItem('phase4_debug', 'true');
location.reload();
```

### Check IndexedDB State

In browser DevTools → Application → IndexedDB → nomads:
```javascript
// List all keys
const keys = await db.getAllKeys();
console.log('All keys:', keys);

// Check checkpoints
const checkpoints = keys.filter(k => k.startsWith('crash_checkpoint_'));
console.log('Checkpoints:', checkpoints);

// Check crash logs
const logs = await db.get('crash_logs');
console.log('Crash history:', logs);
```

### Monitor Network Requests

Watch for timeout patterns:
1. DevTools → Network → Filter by type
2. Look for requests hitting 30s timeout limit
3. Verify abort signal is triggered
4. Check retry count and backoff

---

## Known Limitations

1. **Recovery UI not yet implemented** — Checkpoint exists but no UI to choose resume vs restart
2. **Heartbeat monitoring is basic** — Just checks timestamp, doesn't validate service health
3. **No distributed recovery** — Only works within single browser session
4. **No metrics export** — Crashes/timeouts logged locally only

---

## Future Enhancements

- [ ] Dashboard widget showing Phase 4 status
- [ ] UI modal offering checkpoint recovery on crash
- [ ] Automatic service restart with health checks
- [ ] Metrics export to analytics backend
- [ ] Graceful degradation strategies per stage
- [ ] Network latency detection
- [ ] Predictive timeout adjustment

---

## Troubleshooting

### Issue: Timeouts trigger too frequently
**Solution:** Increase `VITE_HEALTH_CHECK_TIMEOUT` and `STAGE_TIMEOUTS`

### Issue: Crash recovery doesn't activate
**Solution:**
1. Verify `VITE_CRASH_RECOVERY_ENABLED=true`
2. Check heartbeat is running: `globalCrashRecoveryManager.getStats()`
3. Verify IndexedDB is not disabled

### Issue: High memory usage
**Solution:**
1. Check `processWatchdog.cleanup()` is running (every 60s)
2. Reduce `sessionCheckpointingInterval` to clear old checkpoints faster
3. Monitor `crash_logs` size limit (max 100 entries)

### Issue: Requests timing out incorrectly
**Solution:**
1. Lower `VITE_AGGRESSIVE_TIMEOUTS_ENABLED` to false for testing
2. Check Ollama/Wayfarer response times
3. Increase request timeout threshold temporarily

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Request timeout detection | <100ms | ✓ Verified |
| Checkpoint save latency | <500ms | ✓ Expected |
| Watchdog health check | <1s | ✓ Expected |
| Memory overhead (idle) | <5MB | TBD |
| CPU overhead (monitoring) | <1% | TBD |
| Recovery time | <5s | TBD |

---

## Log Examples

### Normal Operation Logs
```
[App] Initializing Process Watchdog (Phase 4)...
[useCycleLoop] CRASH DETECTED — attempting recovery from checkpoint...
[Phase4] Crash recovery checkpoint saved: research
[CrashRecovery] Heartbeat started for session campaign-1 (interval: 30000ms)
[Phase4] Checkpoint cleared after successful completion
```

### Error Handling Logs
```
[TIMEOUT] Request timeout: research-iteration exceeded 30000ms
[Watchdog] Process test-process crashed (attempt 1/3). Will retry in 1000ms.
[Watchdog] Process test-process exceeded max retries. Skipping.
[CrashRecovery] Crash recovery saved. Resume on next app launch.
```

---

## Conclusion

Phase 4 testing is designed to be incremental:
1. Start with manual console tests
2. Verify timeouts and watchdog work
3. Test checkpoint save/load
4. Run automated test suite
5. Perform overnight stress test if available

All systems are production-ready upon successful completion of these tests.
