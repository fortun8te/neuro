# Coordinate Refinement Metrics Framework

A comprehensive TypeScript framework for collecting, analyzing, and visualizing metrics from the coordinate refinement system. Track click accuracy, method effectiveness, confidence levels, and identify optimization opportunities across browser automation sessions.

## Overview

The metrics framework consists of four core modules:

1. **metricsCollector.ts** — Captures individual click metrics and aggregates session data
2. **metricsAnalyzer.ts** — Statistical analysis, pattern detection, and comparative metrics
3. **storageAdapter.ts** — IndexedDB persistence for historical data and trend analysis
4. **metricsIntegration.ts** — Integration examples and best practices
5. **MetricsPanel.tsx** — React UI component for real-time monitoring

## Quick Start

### 1. Initialize metrics collection

```typescript
import { MetricsCollector } from './metricsCollector';

const sessionId = 'session-' + Date.now();
const collector = MetricsCollector.getInstance(sessionId);
```

### 2. Record click metrics

```typescript
import { recordClickMetric } from './metricsIntegration';

await recordClickMetric(
  sessionId,
  { x: 100, y: 200 },        // original coordinates
  { x: 105, y: 198 },         // refined coordinates
  'vision',                    // refinement method
  0.95,                        // confidence score
  320,                         // duration in ms
  true,                        // success flag
  'Submit Button',             // element name
  'button',                    // ARIA role
);
```

### 3. Get session metrics

```typescript
const metrics = collector.getSessionMetrics();
const stats = collector.calculateStats();

console.log(`Success Rate: ${metrics.successRate.toFixed(1)}%`);
console.log(`Avg Accuracy: ${metrics.avgDistance.toFixed(2)}px`);
```

### 4. Save and analyze

```typescript
import { endSession } from './metricsIntegration';
import { StorageAdapter } from './storageAdapter';

// Save to IndexedDB
await endSession(sessionId);

// Get historical data
const storage = StorageAdapter.getInstance();
const allSessions = await storage.getAllSessions();
const trends = await storage.getTrends(10);
```

## Core Types

### ClickMetric

Represents a single click attempt with refinement details:

```typescript
interface ClickMetric {
  timestamp: string;                    // ISO timestamp
  originalCoords: Coords;               // Initial coordinates
  refinedCoords: Coords;                // After refinement
  method: 'vision' | 'accessibility-tree' | 'retry-jitter' | 'fallback';
  confidence: number;                   // 0-1 confidence score
  distance: number;                     // Euclidean distance in pixels
  duration: number;                     // Refinement time in ms
  success: boolean;                     // Click succeeded?
  note?: string;                        // Element name or error details
  elementInfo?: {
    name?: string;
    role?: string;
    tag?: string;
  };
}
```

### SessionMetrics

Aggregated metrics for an entire session:

```typescript
interface SessionMetrics {
  sessionId: string;
  startTime: string;                    // ISO timestamp
  totalClicks: number;                  // Total clicks in session
  successfulClicks: number;             // Successful clicks
  successRate: number;                  // Success percentage
  avgConfidence: number;                // Average model confidence
  avgDistance: number;                  // Average refinement distance
  methods: {
    vision: MethodStats;                // Per-method statistics
    'accessibility-tree': MethodStats;
    'retry-jitter': MethodStats;
    fallback: MethodStats;
  };
  totalDuration: number;                // Total refinement time
  fallbackCount: number;                // Fallback method usage
  problematicElements: string[];        // Elements with 0% success
  easyElements: string[];               // Elements with 100% success
}
```

### StatsSummary

Quick-reference statistics:

```typescript
interface StatsSummary {
  successRate: number;                  // Success percentage
  avgConfidence: number;                // Average confidence
  avgDistance: number;                  // Average distance (px)
  methodDistribution: Record<string, number>;  // Count per method
  withinThreshold50: number;            // % within 50px
  withinThreshold30: number;            // % within 30px
  withinThreshold10: number;            // % within 10px
  totalClicks: number;                  // Total clicks
  avgDuration: number;                  // Average duration (ms)
}
```

## API Reference

### MetricsCollector

**Static Methods:**

```typescript
// Get or create collector for session
MetricsCollector.getInstance(sessionId: string): MetricsCollector

// Clear all instances
MetricsCollector.clearAll(): void

// Get active session IDs
MetricsCollector.getActiveSessions(): string[]
```

**Instance Methods:**

```typescript
// Add a click metric
addClickMetric(metric: ClickMetric): void

// Get aggregated session metrics
getSessionMetrics(): SessionMetrics

// Get quick statistics
calculateStats(): StatsSummary

// Export as JSON
exportJSON(): string

// Export as CSV
exportCSV(): string

// Generate markdown report
generateReport(): string

// Get raw metrics array
getMetrics(): ClickMetric[]

// Clear metrics (for testing)
reset(): void
```

### metricsAnalyzer

```typescript
// Analyze click accuracy distribution
analyzeClickAccuracy(metrics: ClickMetric[]): AccuracyAnalysis

// Analyze confidence levels
analyzeConfidenceDistribution(metrics: ClickMetric[]): ConfidenceAnalysis

// Analyze method effectiveness
analyzeMethodEffectiveness(metrics: ClickMetric[]): MethodEffectivenessAnalysis

// Identify patterns and anomalies
identifyPatterns(metrics: ClickMetric[]): PatternAnalysis

// Generate comprehensive report
generateReport(collector: MetricsCollector): MarkdownReport
```

### StorageAdapter

**Static Methods:**

```typescript
// Get singleton instance
StorageAdapter.getInstance(): StorageAdapter
```

**Instance Methods:**

```typescript
// Initialize IndexedDB
init(): Promise<void>

// Save metrics
saveMetrics(sessionId: string, sessionMetrics: SessionMetrics, clickMetrics: ClickMetric[]): Promise<void>

// Load session metrics
loadMetrics(sessionId: string): Promise<StoredSession | null>

// Get all session summaries
getAllSessions(): Promise<SessionSummary[]>

// Delete session
deleteSession(sessionId: string): Promise<void>

// Export all sessions as JSON
exportAllSessions(): Promise<string>

// Import sessions from JSON
importSessions(jsonData: string): Promise<number>

// Get trend data
getTrends(limit?: number): Promise<TrendData[]>

// Clear all storage
clear(): Promise<void>

// Get storage statistics
getStats(): Promise<StorageStats>

// Query metrics by time range
queryRange(startTime: string, endTime: string): Promise<ClickMetric[]>
```

## Integration Examples

### Integrating with Executor Agent

In `executorAgent.ts`, after a click action completes:

```typescript
import { recordClickMetric } from '../metricsIntegration';

// After click attempt
await recordClickMetric(
  sessionId,
  visionCoords,
  finalCoords,
  refinementMethod,
  modelConfidence,
  elapsedTime,
  clickSucceeded,
  elementName,
  elementRole,
);
```

### React UI Integration

```typescript
import MetricsPanel from '../components/MetricsPanel';
import { MetricsCollector } from '../utils/metricsCollector';

export function Dashboard({ sessionId }: { sessionId: string }) {
  const collector = MetricsCollector.getInstance(sessionId);
  const metrics = collector.getSessionMetrics();
  const stats = collector.calculateStats();

  const handleExport = (format: 'json' | 'csv' | 'markdown') => {
    const data = format === 'json'
      ? collector.exportJSON()
      : format === 'csv'
      ? collector.exportCSV()
      : collector.generateReport();

    // Download file...
  };

  return <MetricsPanel metrics={metrics} stats={stats} onExport={handleExport} />;
}
```

### Health Checks During Session

```typescript
import { checkAccuracyHealth } from '../metricsIntegration';

// Check periodically
const health = checkAccuracyHealth(sessionId);
if (!health.isHealthy) {
  health.warnings.forEach(warning => {
    console.warn(`[METRICS] ${warning}`);
  });
  // Trigger mitigation (pause, reset, etc.)
}
```

### Session Comparison

```typescript
import { compareSessions } from '../metricsIntegration';

const comparison = await compareSessions(sessionId1, sessionId2);
console.log(comparison.summary);
// Session s-5a2f9e1b vs s-3f1a2b:
// Success: 89.5% → 91.3% (+1.8%)
// Accuracy: 12.3px → 10.8px (+1.5px)
// Confidence: 0.892 → 0.905 (+0.013)
```

## Measurement Guidelines

### What to Measure

1. **Every click attempt** — both vision-based and fallback refinements
2. **Method transitions** — when moving from one method to another
3. **Element interactions** — track which elements succeed/fail
4. **Confidence scores** — capture model confidence at refinement time
5. **Duration** — measure refinement overhead

### Accuracy Thresholds

- **Excellent:** Within 10px (>70%)
- **Good:** Within 30px (>85%)
- **Acceptable:** Within 50px (>95%)
- **Poor:** >50px (<5%)

### Success Rates

- **Target:** >90%
- **Acceptable:** >85%
- **Warning:** 80-85%
- **Critical:** <80%

### Confidence Targets

- **High (0.66-1.0):** >80% of clicks
- **Medium (0.33-0.66):** <15% of clicks
- **Low (0-0.33):** <5% of clicks

## Common Patterns

### Detecting Session Degradation

```typescript
const metrics = collector.getSessionMetrics();
const successDropped = metrics.successRate < 0.85;
const accuracyWorsened = metrics.avgDistance > 20;

if (successDropped || accuracyWorsened) {
  console.warn('Session degradation detected');
  // Trigger intervention
}
```

### Finding Problematic Elements

```typescript
const patterns = identifyPatterns(collector.getMetrics());
patterns.hardElements.forEach(elem => {
  console.log(`${elem.name}: ${elem.attempts} attempts, ${elem.successRate.toFixed(1)}% success`);
  // Implement specialized handling
});
```

### Identifying Best Practices

```typescript
const methodEffectiveness = analyzeMethodEffectiveness(collector.getMetrics());
const bestMethods = Object.entries(methodEffectiveness)
  .filter(([_, data]) => data.successRate > 85)
  .sort((a, b) => b[1].successRate - a[1].successRate);

console.log('Best performing methods:', bestMethods.map(m => m[0]));
```

## Performance Considerations

### Memory Usage

- Metrics stored in-memory per session
- ~100 bytes per ClickMetric
- 1000 clicks = ~100KB memory
- IndexedDB for persistent storage

### Database Storage

- Each session stored as single record
- Indexes on sessionId and timestamp
- Typical session: 5-50KB on disk
- Auto-cleanup of old sessions recommended

### Computation

- `calculateStats()`: O(n) where n = clicks
- `identifyPatterns()`: O(n log n) due to sorting
- `analyzeClickAccuracy()`: O(n)
- All analysis functions complete in <100ms for 1000+ clicks

## Troubleshooting

### Metrics not recording

```typescript
// Check if collector is properly initialized
const collector = MetricsCollector.getInstance(sessionId);
console.log('Collector session:', collector.getSessionMetrics().sessionId);

// Verify metrics are being added
collector.addClickMetric({
  timestamp: new Date().toISOString(),
  originalCoords: { x: 100, y: 200 },
  refinedCoords: { x: 105, y: 198 },
  method: 'vision',
  confidence: 0.95,
  distance: 7,
  duration: 300,
  success: true,
});
```

### Storage not persisting

```typescript
// Ensure storage is initialized
const storage = StorageAdapter.getInstance();
await storage.init();

// Check if metrics were saved
const session = await storage.loadMetrics(sessionId);
console.log('Saved metrics count:', session?.metrics.length);
```

### Inaccurate statistics

```typescript
// Verify metric calculations
const metrics = collector.getMetrics();
const calculated = {
  totalClicks: metrics.length,
  successfulClicks: metrics.filter(m => m.success).length,
  avgDistance: metrics.reduce((sum, m) => sum + m.distance, 0) / metrics.length,
};
console.log('Verification:', calculated);
```

## Best Practices

1. **Record metrics immediately** — Capture data right after click completion
2. **Use consistent sessionIds** — Ensures data correlation
3. **Clean up old sessions** — Prevents IndexedDB bloat
4. **Save sessions periodically** — Don't wait until end
5. **Monitor for degradation** — Check health during long sessions
6. **Use patterns for optimization** — Target improvements based on data
7. **Compare sessions** — Track improvements over time
8. **Export for analysis** — Share data with team

## Testing

```typescript
import { MetricsCollector } from './metricsCollector';

describe('MetricsCollector', () => {
  it('should calculate success rate correctly', () => {
    const collector = MetricsCollector.getInstance('test-session');

    for (let i = 0; i < 10; i++) {
      collector.addClickMetric({
        timestamp: new Date().toISOString(),
        originalCoords: { x: 0, y: 0 },
        refinedCoords: { x: 1, y: 1 },
        method: 'vision',
        confidence: 0.9,
        distance: 1.4,
        duration: 100,
        success: i < 9, // 9 successes, 1 failure
      });
    }

    const metrics = collector.getSessionMetrics();
    expect(metrics.successRate).toBeCloseTo(90, 1);
  });
});
```

## Related Files

- `metricsCollector.ts` — Core metrics collection
- `metricsAnalyzer.ts` — Statistical analysis
- `storageAdapter.ts` — IndexedDB persistence
- `metricsIntegration.ts` — Integration examples
- `MetricsPanel.tsx` — React UI component
- `executorAgent.ts` — Where metrics are captured
- `METRICS_DASHBOARD.md` — Dashboard reference

## Version History

- **1.0.0** (2025-04-05) — Initial framework with full feature set
  - Click metric collection
  - Session aggregation
  - Pattern detection
  - IndexedDB persistence
  - React UI component

## License

Part of the Nomads project. Internal use only.
