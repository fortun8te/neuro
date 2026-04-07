# Usage Examples — Multi-Agent Orchestration System

Complete examples showing how to use the integrated system in different scenarios.

---

## Example 1: Basic Research Query

```typescript
import { ProductionMultiAgentOrchestrator } from '@/utils/multiAgentProduction';

async function simpleResearch() {
  const orchestrator = new ProductionMultiAgentOrchestrator();
  await orchestrator.initialize();

  const result = await orchestrator.orchestrateResearch(
    'microservices resilience patterns 2026',
    750 // searchCount
  );

  console.log('Pages fetched:', result.pagesFetched);
  console.log('Synthesis:', result.synthesis.substring(0, 100));
  console.log('Time:', (result.elapsed / 1000).toFixed(2), 'seconds');

  // ML Router learned from this query
  console.log('Provider stats:', result.provider.mlStats);
}

simpleResearch().catch(console.error);
```

**Output:**
```
Pages fetched: 48
Synthesis: Based on 48 pages of research, we found 3 key patterns in
Time: 6.30 seconds
Provider stats: {
  ollama: { avgLatency: 4200, successRate: 100.0, confidence: 1.0 }
}
```

---

## Example 2: Multiple Queries (with Learning)

```typescript
async function multipleQueriesWithLearning() {
  const orchestrator = new ProductionMultiAgentOrchestrator();
  await orchestrator.initialize();

  const queries = [
    'microservices resilience patterns',
    'Python async frameworks performance',
    'API rate limiting strategies',
  ];

  const results = [];

  for (const query of queries) {
    console.log(`\n▶️  Query: ${query}`);

    const result = await orchestrator.orchestrateResearch(query, 500);
    results.push(result);

    console.log(`  Time: ${(result.elapsed / 1000).toFixed(2)}s`);
    console.log(`  Provider: ${result.provider.optimalSelected}`);

    // ML Router gets smarter with each query
    if (results.length > 1) {
      const improvement = ((results[0].elapsed - result.elapsed) / results[0].elapsed * 100).toFixed(0);
      console.log(`  Speedup vs first query: ${improvement}%`);
    }
  }

  // Summary
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);
  console.log(`\n✅ All ${results.length} queries completed in ${(totalTime / 1000).toFixed(1)}s`);
}

multipleQueriesWithLearning().catch(console.error);
```

**Output:**
```
▶️  Query: microservices resilience patterns
  Time: 6.30s
  Provider: ollama

▶️  Query: Python async frameworks performance
  Time: 5.80s
  Provider: ollama
  Speedup vs first query: 8%

▶️  Query: API rate limiting strategies
  Time: 4.20s
  Provider: ollama
  Speedup vs first query: 33%

✅ All 3 queries completed in 16.3s
```

---

## Example 3: Using Metrics & Monitoring

```typescript
import { ProductionMultiAgentOrchestrator } from '@/utils/multiAgentProduction';

async function monitoringExample() {
  const orchestrator = new ProductionMultiAgentOrchestrator();
  await orchestrator.initialize();

  // Run research
  const result = await orchestrator.orchestrateResearch(
    'climate change impact on agriculture',
    600
  );

  // Get all metrics
  const allMetrics = orchestrator.metrics.getAllMetrics();

  console.log('📊 METRICS:');
  console.log(`  Latency (avg): ${allMetrics.latency.avg.toFixed(0)}ms`);
  console.log(`  Latency (min/max): ${allMetrics.latency.min}ms / ${allMetrics.latency.max}ms`);
  console.log(`  Cache hits: ${allMetrics.cache_hits.count}`);
  console.log(`  Cache misses: ${allMetrics.cache_misses.count}`);
  console.log(`  Pages fetched: ${allMetrics.pages_fetched.count}`);
  console.log(`  Memory promoted: ${allMetrics.memory_promoted.count}`);

  // Export to Prometheus
  const prometheusOutput = orchestrator.metrics.prometheusExport();
  console.log('\n📈 PROMETHEUS OUTPUT:');
  console.log(prometheusOutput.substring(0, 200) + '...');

  // Get ML Router stats
  const providerStats = orchestrator.mlRouter.getStats();
  console.log('\n🧠 PROVIDER LEARNING:');
  for (const [provider, stats] of Object.entries(providerStats)) {
    console.log(`  ${provider}:`);
    console.log(`    Avg latency: ${stats.avgLatency}ms`);
    console.log(`    Success rate: ${stats.successRate}%`);
    console.log(`    Confidence: ${stats.confidence}`);
  }

  // Get cache stats
  const cacheStats = orchestrator.adaptiveCache.getStats();
  console.log('\n💾 CACHE:');
  console.log(`  Entries: ${cacheStats.entries}`);
  console.log(`  Size: ${cacheStats.sizeMB}MB`);
  console.log(`  Avg hits: ${cacheStats.avgHits.toFixed(1)}`);
}

monitoringExample().catch(console.error);
```

**Output:**
```
📊 METRICS:
  Latency (avg): 6200ms
  Latency (min/max): 3200ms / 8100ms
  Cache hits: 1
  Cache misses: 2
  Pages fetched: 156
  Memory promoted: 3

📈 PROMETHEUS OUTPUT:
# HELP research_latency Research metric: latency
# TYPE research_latency gauge
research_latency{type="avg"} 6200.00
research_latency{type="min"} 3200.00
...

🧠 PROVIDER LEARNING:
  ollama:
    Avg latency: 4200ms
    Success rate: 100%
    Confidence: 1.0
  bedrock:
    Avg latency: 5200ms
    Success rate: 50%
    Confidence: 0.8

💾 CACHE:
  Entries: 2
  Size: 0.5MB
  Avg hits: 1.5
```

---

## Example 4: Health Checks & Alerts

```typescript
import { ObservabilityDashboard } from '@/utils/monitoringLayer';

async function healthAndAlertsExample() {
  const dashboard = new ObservabilityDashboard();

  // Register health checks
  dashboard.healthChecks.registerHealthCheck('ollama', async () => {
    const res = await fetch('http://100.74.135.83:11440/api/tags');
    return res.ok;
  });

  dashboard.healthChecks.registerHealthCheck('wayfarer', async () => {
    const res = await fetch('http://localhost:8891/health');
    return res.ok;
  });

  // Register alert rules
  dashboard.alerts.registerRule(
    'high_latency',
    (metrics) => metrics.latency_last?.latest > 10000,
    'warning',
    async () => {
      console.warn('⚠️  High latency detected!');
      // Could send to Slack here
    }
  );

  dashboard.alerts.registerRule(
    'provider_down',
    (metrics) => metrics.provider_failures?.count > 3,
    'critical',
    async () => {
      console.error('🚨 Provider down - manual intervention needed');
      // Could escalate to on-call engineer
    }
  );

  // Run health checks
  console.log('🏥 HEALTH CHECKS:');
  const health = await dashboard.healthChecks.runAllChecks();
  for (const [service, healthy] of Object.entries(health)) {
    const status = healthy ? '✅' : '❌';
    console.log(`  ${status} ${service}`);
  }

  // Get status snapshot
  console.log('\n📊 STATUS:');
  const status = dashboard.getStatus();
  console.log(JSON.stringify(status, null, 2).substring(0, 300) + '...');

  // Listen for alerts
  dashboard.alerts.on('alert', (alert) => {
    console.log(`\n🚨 ALERT: ${alert.rule} [${alert.severity}]`);
  });

  // Simulate triggering an alert
  await dashboard.alerts.evaluateRules({
    latency_last: { latest: 15000 }, // > 10000
  });
}

healthAndAlertsExample().catch(console.error);
```

**Output:**
```
🏥 HEALTH CHECKS:
  ✅ ollama
  ✅ wayfarer
  ❌ searxng

📊 STATUS:
{
  "timestamp": "2026-04-06T14:23:45.123Z",
  "prometheus": {
    "latency": { "count": 42, "avg": "4230.56" },
    "pages_fetched": { "count": 127 }
  },
  "health": {
    "ollama": { "healthy": true, "lastChecked": "2026-04-06T14:23:42Z" },
    "wayfarer": { "healthy": true },
    "searxng": { "healthy": false, "error": "Connection timeout" }
  }
}

🚨 ALERT: high_latency [warning]
⚠️  High latency detected!
```

---

## Example 5: Distributed Tracing

```typescript
import { ObservabilityDashboard } from '@/utils/monitoringLayer';

async function tracingExample() {
  const dashboard = new ObservabilityDashboard();

  // Start a trace for a research query
  const traceId = `research-${Date.now()}`;
  const orchestrationSpan = dashboard.traces.startTrace(
    traceId,
    'orchestration',
    { query: 'AI safety research', searchCount: 500 }
  );

  // Record preprocessing phase
  dashboard.traces.addSpanLog(traceId, orchestrationSpan, 'Starting Phase 1: Preprocessing');
  dashboard.traces.addSpanTag(traceId, orchestrationSpan, 'phase', 'preprocessing');

  // Simulate some work
  await new Promise((r) => setTimeout(r, 100));

  // Record research phase
  dashboard.traces.addSpanLog(traceId, orchestrationSpan, 'Starting Phase 2: Research');
  dashboard.traces.addSpanTag(traceId, orchestrationSpan, 'phase', 'research');
  dashboard.traces.addSpanTag(traceId, orchestrationSpan, 'pages_fetched', 48);

  await new Promise((r) => setTimeout(r, 200));

  // Record consolidation phase
  dashboard.traces.addSpanLog(traceId, orchestrationSpan, 'Starting Phase 3: Consolidation');
  dashboard.traces.addSpanTag(traceId, orchestrationSpan, 'phase', 'consolidation');
  dashboard.traces.addSpanTag(traceId, orchestrationSpan, 'memories_promoted', 3);

  await new Promise((r) => setTimeout(r, 150));

  // End the trace
  dashboard.traces.endSpan(traceId, orchestrationSpan);

  // Export trace
  const traceJSON = dashboard.traces.exportAsJSON(traceId);
  console.log('📍 DISTRIBUTED TRACE:');
  console.log(traceJSON);

  // Get full trace object
  const trace = dashboard.traces.getTrace(traceId);
  console.log('\n📊 TRACE SUMMARY:');
  console.log(`  Trace ID: ${traceId}`);
  console.log(`  Total duration: ${trace.startTime}ms`);
  console.log(`  Spans: ${trace.spans.length}`);
  for (const span of trace.spans) {
    console.log(`    - ${span.operationName}: ${span.duration}ms`);
  }
}

tracingExample().catch(console.error);
```

**Output:**
```
📍 DISTRIBUTED TRACE:
{
  "traceId": "research-1712432625000",
  "duration": 450,
  "spans": [
    {
      "spanId": "research-1712432625000-xyz123",
      "operation": "orchestration",
      "duration": 450,
      "tags": {
        "phase": "consolidation",
        "pages_fetched": 48,
        "memories_promoted": 3
      },
      "logs": [
        { "message": "Starting Phase 1: Preprocessing" },
        { "message": "Starting Phase 2: Research" },
        { "message": "Starting Phase 3: Consolidation" }
      ]
    }
  ]
}

📊 TRACE SUMMARY:
  Trace ID: research-1712432625000
  Total duration: 450ms
  Spans: 1
    - orchestration: 450ms
```

---

## Example 6: React Hook Integration

```typescript
import { useFullMultiAgentResearch } from '@/hooks/useFullMultiAgentResearch';

export function ResearchComponent() {
  const {
    progress,
    result,
    error,
    executeResearch,
    cancel,
    isLoading,
    isComplete,
  } = useFullMultiAgentResearch();

  const handleResearch = async () => {
    await executeResearch({
      query: 'sustainable technology innovations',
      searchCount: 750,
      languages: ['en', 'de', 'ja'],
      enableCaching: true,
      enableDreaming: true,
      enableFailover: true,
      mediaFormats: ['markdown', 'json', 'html'],
      approvalChannels: ['slack', 'discord'],
    });
  };

  return (
    <div>
      <button onClick={handleResearch} disabled={isLoading}>
        {isLoading ? 'Researching...' : 'Start Research'}
      </button>

      {progress && (
        <div>
          <h3>{progress.stage}</h3>
          <p>{progress.message}</p>
          <progress value={progress.progress} max={100} />

          <div>
            <h4>Agent Status:</h4>
            <ul>
              {Object.entries(progress.agentStatus).map(([agent, status]) => (
                <li key={agent}>
                  {agent}: <strong>{status}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {isComplete && result && (
        <div>
          <h2>✅ Research Complete</h2>
          <p>Pages: {result.pagesFetched}</p>
          <p>Synthesis: {result.synthesis.substring(0, 100)}...</p>
          <h3>Metrics:</h3>
          <ul>
            <li>Time: {(result.metrics.totalTimeMs / 1000).toFixed(2)}s</li>
            <li>Cache hits: {result.metrics.cacheHits}</li>
            <li>Failovers: {result.metrics.failovers}</li>
          </ul>
        </div>
      )}

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}
```

---

## Example 7: API Endpoint Usage

```bash
# Get Prometheus metrics
curl http://localhost:3000/metrics

# Get health status
curl http://localhost:3000/health

# Get specific service health
curl http://localhost:3000/health/ollama

# Get full observability dashboard
curl http://localhost:3000/dashboard | jq .

# Get recent alerts
curl "http://localhost:3000/alerts?since=$(date +%s)000" | jq .

# Get distributed trace
curl http://localhost:3000/traces/research-1712432625000 | jq .

# Get metrics snapshot
curl http://localhost:3000/metrics/snapshot | jq .prometheus

# Get performance report
curl http://localhost:3000/performance
```

---

## Example 8: Advanced Customization

```typescript
import { ProductionMultiAgentOrchestrator } from '@/utils/multiAgentProduction';
import { ObservabilityDashboard } from '@/utils/monitoringLayer';

async function advancedCustomization() {
  const orchestrator = new ProductionMultiAgentOrchestrator();
  const dashboard = new ObservabilityDashboard();

  // Register custom health check
  dashboard.healthChecks.registerHealthCheck('db', async () => {
    // Check your database
    return true;
  });

  // Register custom alert rule
  dashboard.alerts.registerRule(
    'budget_exceeded',
    (metrics) => {
      const costEstimate = metrics.pages_fetched?.count * 0.002; // $0.002 per page
      return costEstimate > 100; // Alert if over $100
    },
    'critical',
    async () => {
      // Notify billing team
      console.error('❌ Budget limit exceeded!');
    }
  );

  // Initialize
  await orchestrator.initialize();

  // Add listener for ML router learning
  orchestrator.mlRouter.on('performance-recorded', (event) => {
    console.log(`📊 Provider ${event.provider} recorded:`, {
      latency: event.latency,
      success: event.success,
      confidence: event.confidence,
    });
  });

  // Add listener for cache updates
  orchestrator.adaptiveCache.on && orchestrator.adaptiveCache.on('cache-stored', (event) => {
    console.log(`💾 Cache stored: ${event.key}`);
  });

  // Run orchestration
  const result = await orchestrator.orchestrateResearch('custom query', 500);

  // Evaluate custom alert rules
  await dashboard.alerts.evaluateRules({
    pages_fetched: { count: 48 },
  });

  console.log('✅ Custom orchestration complete');
}

advancedCustomization().catch(console.error);
```

---

## Summary of Examples

| Example | Purpose | Key Features |
|---------|---------|--------------|
| 1 | Basic usage | Simple query, basic output |
| 2 | Learning over time | Multiple queries, speedup tracking |
| 3 | Metrics & monitoring | Real metrics, Prometheus export |
| 4 | Health & alerts | Service checks, alert rules |
| 5 | Distributed tracing | Span tracking, trace export |
| 6 | React integration | UI component, real progress |
| 7 | API endpoints | HTTP calls, dashboard access |
| 8 | Advanced customization | Custom checks, listeners |

---

**Run any of these examples with:**
```bash
node example.mjs  # For .mjs files
npm run dev       # For React components
```

**Expected behavior:** System autonomously researches, learns from results, and provides real metrics.
