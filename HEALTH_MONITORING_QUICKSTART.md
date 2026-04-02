# Health Monitoring — Quick Start Guide

## 30-Second Setup

### 1. Initialize on App Startup

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { initializeHealthMonitoring } from './utils/healthMonitorIntegration';

export function App() {
  useEffect(() => {
    initializeHealthMonitoring();
  }, []);

  return <Dashboard />;
}
```

### 2. Add Health Status to Dashboard

```typescript
// src/components/Dashboard.tsx
import { HealthStatusPanel } from './components/HealthStatusPanel';

export function Dashboard() {
  return (
    <div className="dashboard">
      <HealthStatusPanel />
      {/* rest of dashboard */}
    </div>
  );
}
```

### 3. Check Before Starting Research

```typescript
// src/hooks/useCycleLoop.ts (or wherever research starts)
import { gracefulDegradation } from '../utils/gracefulDegradation';

async function startResearchCycle() {
  const canProceed = await gracefulDegradation.canProceed();

  if (!canProceed) {
    const msg = await gracefulDegradation.getStatusMessage();
    showError(msg); // "Ollama is unavailable. Please wait..."
    return;
  }

  // Proceed with research
  await runResearch();
}
```

### 4. Track Researcher Processes

```typescript
// In research orchestrator
import { processWatchdog } from '../utils/processWatchdog';

const processId = processWatchdog.trackProcess('researcher-batch-1');

try {
  const result = await runResearcher();
  processWatchdog.onProcessComplete(processId);
  return result;
} catch (error) {
  const action = processWatchdog.onProcessCrash(processId, error);

  if (action === 'retry') {
    // Retry the operation
    return runResearcherWithRetry(processId);
  } else if (action === 'skip') {
    // Max retries exceeded
    console.warn('Researcher skipped after max retries');
    return null;
  }
}
```

## Common Patterns

### Pattern 1: Execute with Fallback

```typescript
import { gracefulDegradation } from './utils/gracefulDegradation';

const result = await gracefulDegradation.executeWithFallback(
  'wayfarer',
  async () => wayfarerService.research(query),
  async () => directSearXNG(query),
);
```

### Pattern 2: Execute with Retry

```typescript
const result = await gracefulDegradation.executeWithRetry(
  'ollama',
  async () => ollamaService.generateStream(prompt),
  maxRetries = 2,
  delayMs = 1000,
);
```

### Pattern 3: Conditional Execution

```typescript
const result = await executeIfHealthy(
  async () => runExpensiveOperation(),
  'Expensive operation',
);
if (!result) {
  console.log('Operation skipped due to service unavailability');
}
```

### Pattern 4: Monitor for Alerts

```typescript
gracefulDegradation.onDegradation((event) => {
  if (event.status === 'unavailable') {
    // Alert operations team
    sendAlert(`${event.tool} is down: ${event.message}`);
  }
});

processWatchdog.onCrash((metrics) => {
  // Track crash patterns
  logCrash(`${metrics.name} crashed: ${metrics.lastError}`);
});
```

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Enable health monitoring (default: true)
VITE_HEALTH_MONITORING_ENABLED=true

# Enable graceful degradation (default: true)
VITE_GRACEFUL_DEGRADATION_ENABLED=true

# Enable process watchdog (default: true)
VITE_PROCESS_WATCHDOG_ENABLED=true
```

### Service URLs

Health monitor reads from `src/config/infrastructure.ts`:

```typescript
export const INFRASTRUCTURE = {
  ollamaUrl: 'http://100.74.135.83:11434',      // Remote
  wayfarerUrl: 'http://localhost:8889',          // Local
  searxngUrl: 'http://localhost:8888',           // Docker
  // ...
};
```

Override with environment variables:

```bash
VITE_OLLAMA_URL=http://localhost:11434
VITE_WAYFARER_URL=http://192.168.1.100:8889
VITE_SEARXNG_URL=http://192.168.1.100:8888
```

## Testing

### Test 1: Service Down

```bash
# Terminal 1: Stop Wayfarer
# (kill wayfarer process or stop Docker container)

# Terminal 2: Check in app console
> const health = await toolRegistry.checkTool('wayfarer')
> console.log(health.status) // 'down'
```

### Test 2: Graceful Degradation

```typescript
// In browser console
> const result = await gracefulDegradation.executeWithFallback(
    'wayfarer',
    () => { throw new Error('Primary failed'); },
    () => 'Fallback succeeded'
  )
> console.log(result) // 'Fallback succeeded'
```

### Test 3: Process Crash Recovery

```typescript
// In browser console
> const id = processWatchdog.trackProcess('test');
> const action = processWatchdog.onProcessCrash(id, new Error('crash'));
> console.log(action) // 'retry'
> const action2 = processWatchdog.onProcessCrash(id, new Error('crash 2'));
> console.log(action2) // 'retry'
> const action3 = processWatchdog.onProcessCrash(id, new Error('crash 3'));
> console.log(action3) // 'retry'
> const action4 = processWatchdog.onProcessCrash(id, new Error('crash 4'));
> console.log(action4) // 'skip'
```

### Test 4: Dashboard Status

```typescript
// Click the HealthStatusPanel in dashboard
// Should show:
// - Ollama status + latency
// - Wayfarer status + latency
// - SearXNG status + latency
// - Context-1 status + latency
// - Recent degradation events (if any)
// - Overall system status message
```

## Monitoring & Alerts

### Export Health Metrics

```typescript
// In your monitoring setup
gracefulDegradation.getDetailedReport().then(report => {
  // Send to Prometheus, DataDog, etc.
  metrics.set('service.ollama.status', report.tools[0].latencyMs);
  metrics.set('service.wayfarer.status', report.tools[1].latencyMs);
  // ...
});
```

### Send to Slack/PagerDuty

```typescript
healthMonitor.onStatusChange((name, oldStatus, newStatus) => {
  if (newStatus === 'down') {
    sendToSlack(`Alert: ${name} is down!`);
  }
});
```

### Track to Sentry

```typescript
gracefulDegradation.onDegradation((event) => {
  Sentry.captureMessage(`Service degraded: ${event.tool}`, {
    level: 'warning',
    tags: { tool: event.tool, status: event.status },
  });
});
```

## Troubleshooting

### Health Monitor Not Starting

```typescript
// Check if running
console.log(healthMonitor.isRunning()); // Should be true

// If false, start it manually
healthMonitor.start();
```

### Service Status Wrong

```typescript
// Force a check
const health = await healthMonitor.checkService('wayfarer');
console.log(health);

// Check the URL
const snapshot = healthMonitor.getSnapshot();
console.log(snapshot.wayfarer.url);
```

### Fallback Not Working

```typescript
// Check tool availability
const fallback = await toolRegistry.getFallback('wayfarer');
console.log(fallback); // Should be 'searxng_direct' if wayfarer down

// Check the tool itself
const tools = await toolRegistry.listTools();
console.log(tools.find(t => t.name === 'wayfarer'));
```

### Process Not Restarting

```typescript
// Check watchdog status
const stats = processWatchdog.getStats();
console.log(stats);

// Check crash history
const crashes = processWatchdog.getCrashHistory();
console.log(crashes);

// Check if max retries exceeded
const proc = processWatchdog.getProcess(processId);
console.log(proc?.restartCount);
```

## File Reference

| File | Purpose |
|------|---------|
| `src/utils/healthMonitor.ts` | Continuous service polling |
| `src/utils/toolRegistry.ts` | Tool availability registry |
| `src/utils/gracefulDegradation.ts` | Fallback execution |
| `src/utils/processWatchdog.ts` | Process crash tracking |
| `src/components/HealthStatusPanel.tsx` | Dashboard UI |
| `src/utils/healthMonitorIntegration.ts` | Usage examples |
| `HEALTH_MONITORING.md` | Full documentation |

## Key Concepts

**Service Status Levels:**
- `healthy` — Responding normally
- `degraded` — 2+ consecutive failures (still usable)
- `down` — 4+ consecutive failures (not usable)
- `unknown` — Never checked

**Tool Availability:**
- `available` — Tool is healthy
- `degraded` — Tool is responding but slow
- `unavailable` — Tool is down

**Process Actions:**
- `retry` — Restart the process (< 3 retries)
- `skip` — Skip (max 3 retries reached)
- `fatal` — Cannot proceed (critical service down)

## Production Checklist

- [ ] `initializeHealthMonitoring()` called on app startup
- [ ] `HealthStatusPanel` added to dashboard
- [ ] Pre-flight checks before expensive operations
- [ ] Process watchdog tracking for long-running tasks
- [ ] Degradation events logged to monitoring system
- [ ] Feature flags enabled in production (`VITE_*=true`)
- [ ] Service URLs configured correctly
- [ ] Error messages ready for UI display
- [ ] Monitoring/alerts set up (Sentry, Slack, etc.)

## Support

See full documentation in:
- `HEALTH_MONITORING.md` — Complete reference
- `PHASE_11_IMPLEMENTATION_REPORT.md` — Implementation details
- `src/utils/healthMonitorIntegration.ts` — Code examples
