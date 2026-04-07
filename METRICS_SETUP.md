# Metrics Framework Setup & Configuration Guide

Complete guide for setting up and integrating the coordinate refinement metrics framework into the Nomads project.

## Installation

### 1. File Locations

All metrics framework files are already in place:

```
frontend/utils/
├── metricsCollector.ts          (449 lines) — Core metric collection
├── metricsAnalyzer.ts           (577 lines) — Statistical analysis
├── storageAdapter.ts            (373 lines) — IndexedDB persistence
├── metricsIntegration.ts        (389 lines) — Integration examples
└── METRICS_README.md            (Complete API reference)

frontend/components/
└── MetricsPanel.tsx             (React UI component)

root/
├── METRICS_DASHBOARD.md         (Dashboard template & KPIs)
└── METRICS_SETUP.md             (This file)
```

### 2. Dependencies

No external dependencies required. Uses:
- TypeScript (already in project)
- React (for UI component)
- IndexedDB (browser API)
- Existing logger utility

### 3. Import Examples

```typescript
// Metric collection
import { MetricsCollector, type ClickMetric, type SessionMetrics } from './utils/metricsCollector';

// Analysis
import {
  analyzeClickAccuracy,
  analyzeMethodEffectiveness,
  identifyPatterns,
  generateReport
} from './utils/metricsAnalyzer';

// Storage
import { StorageAdapter } from './utils/storageAdapter';

// Integration helpers
import {
  recordClickMetric,
  endSession,
  getMethodComparison,
  generateSessionReport
} from './utils/metricsIntegration';

// UI component
import MetricsPanel from './components/MetricsPanel';
```

## Integration Steps

### Step 1: Wire into Executor Agent

**File:** `frontend/utils/computerAgent/executorAgent.ts`

Add metric recording after click execution:

```typescript
// At top of file
import { recordClickMetric } from '../metricsIntegration';

// In the click execution function (around line 200-300)
async function executeClick(sessionId, x, y, refinementMethod) {
  const startTime = Date.now();
  const originalCoords = { x: initialX, y: initialY };
  const refinedCoords = { x, y };

  try {
    // ... existing click logic ...
    const clickSucceeded = await performClick(refinedCoords);

    const duration = Date.now() - startTime;
    await recordClickMetric(
      sessionId,
      originalCoords,
      refinedCoords,
      refinementMethod,
      modelConfidence,
      duration,
      clickSucceeded,
      elementName,
      elementRole,
    );

    return clickSucceeded;
  } catch (error) {
    // Record failed attempt too
    const duration = Date.now() - startTime;
    await recordClickMetric(
      sessionId,
      originalCoords,
      refinedCoords,
      refinementMethod,
      modelConfidence,
      duration,
      false,
      elementName,
      elementRole,
      error instanceof Error ? error.message : 'Unknown error',
    );
    throw error;
  }
}
```

### Step 2: Initialize Metrics on Session Start

**File:** `frontend/utils/desktopVisionLoop.ts` or main browser session handler

```typescript
import { MetricsCollector } from '../utils/metricsCollector';
import { initializeMetrics } from '../utils/metricsIntegration';

export async function startBrowserSession(sessionId: string) {
  // ... existing session setup ...

  // Initialize metrics
  await initializeMetrics(sessionId);

  // ... rest of setup ...
}
```

### Step 3: Save Metrics on Session End

**File:** Same location as session cleanup

```typescript
import { endSession } from '../utils/metricsIntegration';

export async function closeBrowserSession(sessionId: string) {
  // ... existing cleanup ...

  // Save metrics to IndexedDB
  await endSession(sessionId);

  // ... rest of cleanup ...
}
```

### Step 4: Add Metrics Panel to Dashboard

**File:** `frontend/components/Dashboard.tsx` or `StagePanel.tsx`

```typescript
import { useState, useEffect } from 'react';
import MetricsPanel from './MetricsPanel';
import { MetricsCollector } from '../utils/metricsCollector';

export function Dashboard({ sessionId }: { sessionId: string }) {
  const [metrics, setMetrics] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const collector = MetricsCollector.getInstance(sessionId);
    const interval = setInterval(() => {
      setMetrics(collector.getSessionMetrics());
      setStats(collector.calculateStats());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [sessionId]);

  if (!metrics || !stats) return <div>Loading metrics...</div>;

  return (
    <div className="space-y-6">
      {/* Existing dashboard content */}
      <div>{/* other components */}</div>

      {/* Add metrics panel */}
      <MetricsPanel
        metrics={metrics}
        stats={stats}
        onExport={(format) => {
          const collector = MetricsCollector.getInstance(sessionId);
          const data = format === 'json'
            ? collector.exportJSON()
            : format === 'csv'
            ? collector.exportCSV()
            : collector.generateReport();

          const blob = new Blob([data], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `metrics-${sessionId}.${format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'md'}`;
          a.click();
        }}
      />
    </div>
  );
}
```

### Step 5: Add Health Monitoring

**File:** `frontend/utils/researchWatchdog.ts` or similar monitoring location

```typescript
import { checkAccuracyHealth } from '../utils/metricsIntegration';

export async function monitorSessionHealth(sessionId: string) {
  const healthCheck = setInterval(() => {
    const health = checkAccuracyHealth(sessionId);

    if (!health.isHealthy) {
      health.warnings.forEach(warning => {
        console.warn(`[METRICS ALERT] ${warning}`);
        // Could trigger UI notification or mitigation
      });
    }
  }, 30000); // Check every 30 seconds

  return () => clearInterval(healthCheck);
}
```

## Configuration

### 1. Refinement Methods

Define which methods your implementation uses:

```typescript
type RefinementMethod = 'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback';
```

**Update in:** `frontend/utils/computerAgent/types.ts` if needed

### 2. Confidence Thresholds

Adjust based on your model's calibration:

```typescript
const CONFIDENCE_THRESHOLDS = {
  vision: 0.70,              // Minimum confidence for vision-based refinement
  'accessibility-tree': 0.60, // Minimum for AX tree lookups
  'retry-jitter': 0.50,       // Minimum for retry attempts
  fallback: 0.30,             // Minimum for fallback method
};

// In executorAgent.ts, use these to decide method chains
if (confidence >= CONFIDENCE_THRESHOLDS.vision) {
  method = 'vision';
} else if (confidence >= CONFIDENCE_THRESHOLDS['accessibility-tree']) {
  method = 'accessibility-tree';
} else {
  method = 'fallback';
}
```

### 3. Accuracy Thresholds

Customize based on application requirements:

```typescript
const ACCURACY_TARGETS = {
  threshold10: 0.70,   // >70% within 10px
  threshold30: 0.85,   // >85% within 30px
  threshold50: 0.95,   // >95% within 50px
};
```

### 4. Session Cleanup Policy

Configure auto-cleanup of old sessions:

```typescript
// In a scheduled task or on app startup
import { cleanupOldSessions } from '../utils/metricsIntegration';

await cleanupOldSessions(keepDays = 30); // Keep 30 days of data
```

## Usage Patterns

### Pattern 1: Real-Time Monitoring

```typescript
function MonitoringDashboard() {
  const [metrics, setMetrics] = useState(null);
  const sessionId = useSessionId();

  useEffect(() => {
    const collector = MetricsCollector.getInstance(sessionId);

    const interval = setInterval(() => {
      const current = collector.getSessionMetrics();
      setMetrics(current);

      // Alert on issues
      if (current.successRate < 85) {
        console.warn('Success rate below target');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId]);

  return <MetricsPanel metrics={metrics} />;
}
```

### Pattern 2: End-of-Session Analysis

```typescript
async function onSessionComplete(sessionId) {
  const collector = MetricsCollector.getInstance(sessionId);
  const report = generateSessionReport(sessionId);

  // Save to database
  await saveReport(sessionId, report);

  // Display summary
  showAlert({
    title: 'Session Complete',
    message: `Success Rate: ${collector.getSessionMetrics().successRate.toFixed(1)}%`,
  });

  // Clean up
  await endSession(sessionId);
}
```

### Pattern 3: Comparative Analysis

```typescript
async function compareLastTwoSessions() {
  const storage = StorageAdapter.getInstance();
  const sessions = await storage.getAllSessions();

  if (sessions.length < 2) return;

  const [prev, curr] = sessions.slice(-2);
  const comparison = await compareSessions(prev.sessionId, curr.sessionId);

  console.log(comparison.summary);
  // Provides improvement/regression analysis
}
```

### Pattern 4: Trend Tracking

```typescript
async function drawTrendChart() {
  const storage = StorageAdapter.getInstance();
  const trends = await storage.getTrends(10); // Last 10 sessions

  // Use for chart.js, d3, or similar
  const data = {
    labels: trends.map(t => new Date(t.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Success Rate',
        data: trends.map(t => t.successRate),
        borderColor: 'rgb(75, 192, 192)',
      },
    ],
  };

  renderChart(data);
}
```

## Testing

### Unit Tests

```typescript
import { MetricsCollector } from '../utils/metricsCollector';

describe('Metrics Framework', () => {
  beforeEach(() => {
    MetricsCollector.clearAll();
  });

  it('should calculate success rate', () => {
    const collector = MetricsCollector.getInstance('test-1');

    for (let i = 0; i < 10; i++) {
      collector.addClickMetric({
        timestamp: new Date().toISOString(),
        originalCoords: { x: 0, y: 0 },
        refinedCoords: { x: 1, y: 1 },
        method: 'vision',
        confidence: 0.9,
        distance: 1.4,
        duration: 100,
        success: i < 8, // 8 successes
      });
    }

    expect(collector.getSessionMetrics().successRate).toBe(80);
  });

  it('should track element patterns', () => {
    const collector = MetricsCollector.getInstance('test-2');

    // Add metrics for same element, all failing
    for (let i = 0; i < 5; i++) {
      collector.addClickMetric({
        timestamp: new Date().toISOString(),
        originalCoords: { x: 0, y: 0 },
        refinedCoords: { x: 2, y: 2 },
        method: 'vision',
        confidence: 0.5,
        distance: 2.8,
        duration: 150,
        success: false,
        elementInfo: { name: 'problematic-button' },
      });
    }

    const metrics = collector.getSessionMetrics();
    expect(metrics.problematicElements).toContain('problematic-button');
  });
});
```

### Integration Tests

```typescript
describe('Metrics Integration', () => {
  it('should record click metrics through integration', async () => {
    const sessionId = 'integration-test-' + Date.now();
    await initializeMetrics(sessionId);

    await recordClickMetric(
      sessionId,
      { x: 100, y: 200 },
      { x: 105, y: 198 },
      'vision',
      0.95,
      320,
      true,
      'Test Button',
    );

    const collector = MetricsCollector.getInstance(sessionId);
    expect(collector.getMetrics()).toHaveLength(1);
    expect(collector.getSessionMetrics().successRate).toBe(100);
  });

  it('should persist metrics to IndexedDB', async () => {
    const sessionId = 'persistence-test-' + Date.now();
    const collector = MetricsCollector.getInstance(sessionId);

    collector.addClickMetric({
      timestamp: new Date().toISOString(),
      originalCoords: { x: 0, y: 0 },
      refinedCoords: { x: 1, y: 1 },
      method: 'vision',
      confidence: 0.9,
      distance: 1.4,
      duration: 100,
      success: true,
    });

    const storage = StorageAdapter.getInstance();
    await storage.init();
    await storage.saveMetrics(
      sessionId,
      collector.getSessionMetrics(),
      collector.getMetrics(),
    );

    const loaded = await storage.loadMetrics(sessionId);
    expect(loaded?.metrics).toHaveLength(1);
  });
});
```

## Troubleshooting

### Issue: Metrics not recording

**Symptoms:** MetricsPanel shows 0 clicks

**Solution:**
1. Verify `recordClickMetric()` is called after clicks
2. Check sessionId is consistent
3. Verify no errors in console

```typescript
const collector = MetricsCollector.getInstance(sessionId);
console.log('Metrics count:', collector.getMetrics().length);
```

### Issue: High memory usage

**Symptoms:** App slows down after many clicks

**Solution:**
1. Save and reset metrics periodically
2. Reduce metric granularity
3. Use storage cleanup

```typescript
// Every 1000 clicks
if (clickCount % 1000 === 0) {
  await endSession(sessionId);
  collector.reset();
  sessionId = 'session-' + Date.now();
}
```

### Issue: IndexedDB errors

**Symptoms:** Storage operations fail silently

**Solution:**
1. Check browser IndexedDB quota
2. Clear old data
3. Verify IndexedDB access

```typescript
const storage = StorageAdapter.getInstance();
await storage.init();
const stats = await storage.getStats();
console.log('Storage stats:', stats);
```

## Performance Optimization

### 1. Batch Metric Additions

Instead of adding metrics one-by-one in a loop, batch them:

```typescript
// Bad: Adds 100 items individually
for (const metric of metrics) {
  collector.addClickMetric(metric);
}

// Good: Single batch operation
metrics.forEach(m => collector.addClickMetric(m));
// Saves trigger of reactive updates
```

### 2. Defer Analysis

Don't run expensive analysis during session:

```typescript
// During session: just collect
collector.addClickMetric(metric);

// On session end: run analysis
const patterns = identifyPatterns(collector.getMetrics());
const report = generateReport(collector);
```

### 3. Limit UI Updates

Don't update UI on every metric:

```typescript
// Bad: Updates every metric
metrics.forEach(m => {
  collector.addClickMetric(m);
  setMetricsDisplay(collector.getSessionMetrics());
});

// Good: Update every N metrics
let count = 0;
metrics.forEach(m => {
  collector.addClickMetric(m);
  if (++count % 10 === 0) {
    setMetricsDisplay(collector.getSessionMetrics());
  }
});
```

## Monitoring Dashboard

### Recommended Metrics to Display

1. **Real-time KPIs**
   - Success Rate (%)
   - Avg Accuracy (px)
   - Avg Confidence (0-1)
   - Total Clicks

2. **Method Comparison**
   - Usage % per method
   - Success rate per method
   - Avg distance per method

3. **Alerts**
   - Success rate < 85%
   - Avg accuracy > 20px
   - Fallback usage > 20%

4. **Trends**
   - Success rate over time
   - Accuracy trending
   - Confidence distribution

See `METRICS_DASHBOARD.md` for detailed template.

## FAQ

**Q: How often should I check metrics?**
A: Real-time (every 1-2 sec) for dashboard, analysis-level checks every 30 seconds.

**Q: Can I disable metrics for performance?**
A: Yes, remove integration points or guard with feature flag.

**Q: How long does data persist?**
A: Indefinitely in IndexedDB until cleanup. Use `cleanupOldSessions()` to manage storage.

**Q: Can I export data for external analysis?**
A: Yes, use `exportJSON()`, `exportCSV()`, or direct database export via storage adapter.

**Q: How do I track custom metrics?**
A: Extend `ClickMetric` interface and `elementInfo` field for custom properties.

## Next Steps

1. ✅ Files created and in place
2. → Integrate into executorAgent.ts (Week 1)
3. → Add UI component to Dashboard (Week 1)
4. → Set up monitoring and alerts (Week 2)
5. → Collect baseline metrics (Week 2-3)
6. → Analyze patterns and optimize (Week 3+)

## Support

For issues or questions, refer to:
- `METRICS_README.md` — API documentation
- `metricsIntegration.ts` — Usage examples
- `METRICS_DASHBOARD.md` — KPI reference

---

**Last Updated:** 2025-04-05
**Framework Version:** 1.0.0
**Status:** Ready for Integration
