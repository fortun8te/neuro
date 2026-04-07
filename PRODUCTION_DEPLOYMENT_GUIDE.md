# Production Deployment Guide

## System Overview

Complete multi-agent research orchestration with ML optimization, metrics collection, and observability.

```
┌──────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR LAYER                                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ProductionMultiAgentOrchestrator                                │
│  ├─ 6 Core Agents (Caching, Dreaming, Provider, etc.)           │
│  └─ Optimization Layer                                           │
│     ├─ MLBasedProviderRouter (learns provider performance)       │
│     ├─ MetricsCollector (real-time metrics)                      │
│     ├─ AdaptiveCacheManager (intelligent caching)                │
│     ├─ AgentMessageBus (inter-agent communication)               │
│     ├─ FallbackExecutor (graceful degradation)                   │
│     └─ PersistentMemoryStore (long-term learning)                │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  OBSERVABILITY LAYER                                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ObservabilityDashboard                                          │
│  ├─ PrometheusExporter (metrics in Prometheus format)            │
│  ├─ TraceCollector (distributed tracing)                         │
│  ├─ HealthMonitor (service health checks)                        │
│  ├─ PerformanceProfiler (latency analysis)                       │
│  └─ AlertManager (rule-based alerting)                           │
│                                                                  │
│  ObservabilityAPI (HTTP endpoints)                               │
│  ├─ GET /metrics — Prometheus metrics                            │
│  ├─ GET /health — Service health                                 │
│  ├─ GET /dashboard — Full snapshot                               │
│  ├─ GET /traces/:id — Distributed trace                          │
│  └─ GET /alerts — Recent alerts                                  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE (Real Services)                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • Ollama (LLM inference)     → http://100.74.135.83:11440       │
│  • Wayfarer (Web scraping)    → http://localhost:8891            │
│  • SearXNG (Search engine)    → http://localhost:8888            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start (5 minutes)

### Prerequisites
```bash
# 1. Ensure Docker is running
open -a Docker

# 2. Start SearXNG
cd /Users/mk/Downloads/nomads
docker-compose up -d

# 3. Start Wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer:app --host 0.0.0.0 --port 8889

# 4. Ensure Ollama is running
# Already at: http://100.74.135.83:11440
```

### Run Integration Test
```bash
node validate-integration.mjs
```

Expected output:
- ✅ Infrastructure connectivity checks
- ✅ ML Router performance prediction
- ✅ Adaptive cache functionality
- ✅ Fallback execution
- ✅ Metrics collection
- ✅ Message bus
- ✅ Persistent memory
- ✅ Circuit breaker

### Run Production Test
```bash
node run-production-multiagent.mjs
```

Expected output:
- 3 research queries executed
- Real Wayfarer web scraping
- Real Ollama synthesis
- ML router learns from each query
- Metrics collected and exported

## Core Components

### 1. ProductionMultiAgentOrchestrator
Main orchestration engine with 3-phase flow:

```typescript
const orchestrator = new ProductionMultiAgentOrchestrator();
await orchestrator.initialize();

const result = await orchestrator.orchestrateResearch(
  'microservices resilience patterns',
  750 // searchCount
);
```

**Result includes:**
- `pagesFetched` — Total pages scraped
- `contentPages` — Pages with extracted content
- `synthesis` — LLM-generated summary
- `provider.mlStats` — ML router learning state
- `adaptiveCache` — Cache stats
- `metrics` — All collected metrics

### 2. ML-Based Provider Router
Learns which provider is best:

```typescript
// Phase 1: Select optimal provider
const provider = await orchestrator.mlRouter.selectOptimalProvider(
  querySize,
  prioritizeSpeed,
  budget
);

// Phase 2: Record actual performance
orchestrator.mlRouter.recordPerformance(
  provider,
  latency,
  tokens,
  success,
  cost
);

// Check what it learned
const stats = orchestrator.mlRouter.getStats();
// { ollama: { avgLatency: 4200, successRate: 100.0, confidence: 1.0 } }
```

### 3. Adaptive Cache Manager
Intelligent caching with adaptive TTL:

```typescript
// Check cache
const cached = await orchestrator.adaptiveCache.lookup(key);

// Store in cache
await orchestrator.adaptiveCache.store(key, value);

// Check stats
const stats = orchestrator.adaptiveCache.getStats();
// { entries: 12, sizeMB: 2.4, avgHits: 3.2 }
```

### 4. Metrics Collector
Real-time metrics with Prometheus export:

```typescript
// Record metrics throughout pipeline
orchestrator.metrics.record('pages_fetched', 48);
orchestrator.metrics.record('cache_hits', 2);
orchestrator.metrics.record('latency', 6300);

// Export to Prometheus
const prometheusOutput = orchestrator.metrics.prometheusExport();
```

### 5. Fallback Executor
Graceful degradation:

```typescript
const results = await orchestrator.fallback.execute('research', async () => {
  return await wayfarer.research(query, 750);
});
// If Wayfarer fails → falls back to cached results
// If all fallbacks fail → throws error
```

### 6. Observability Dashboard
Monitoring and alerting:

```typescript
import { ObservabilityDashboard } from '@/utils/monitoringLayer';

const dashboard = new ObservabilityDashboard();

// Register health checks
dashboard.healthChecks.registerHealthCheck('ollama', async () => {...});

// Register alert rules
dashboard.alerts.registerRule('high_latency', (metrics) => {...}, 'warning');

// Get status
const status = dashboard.getStatus();
// { prometheus: {...}, health: {...}, recentAlerts: [...] }
```

## API Endpoints

All endpoints are automatically registered by `setupObservabilityAPI()`:

### Metrics
```bash
# Prometheus-format metrics
curl http://localhost:3000/metrics

# Snapshot (JSON)
curl http://localhost:3000/metrics/snapshot
```

### Health
```bash
# Overall health
curl http://localhost:3000/health

# Service-specific
curl http://localhost:3000/health/ollama
curl http://localhost:3000/health/wayfarer
curl http://localhost:3000/health/searxng
```

### Observability
```bash
# Full dashboard snapshot
curl http://localhost:3000/dashboard

# Distributed trace
curl http://localhost:3000/traces/:traceId

# Recent alerts
curl http://localhost:3000/alerts

# Performance report
curl http://localhost:3000/performance
```

## Monitoring Setup

### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'nomads-orchestrator'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana Dashboard
Import dashboard with:
- Latency (avg, p50, p95)
- Cache hit rate
- Provider failover count
- Memory promoted
- Content extraction success rate
- Service health status

### Alert Rules
```yaml
# alerting rules
groups:
  - name: orchestrator
    interval: 30s
    rules:
      - alert: HighLatency
        expr: research_latency_last > 10000
        annotations:
          summary: "Research latency exceeds 10s"

      - alert: HighCacheMissRate
        expr: research_cache_misses_total / (research_cache_hits_total + research_cache_misses_total) > 0.8
        annotations:
          summary: "Cache miss rate > 80%"

      - alert: ProviderDown
        expr: up{job="ollama"} == 0
        annotations:
          summary: "Ollama provider is down"
```

## Performance Tuning

### Increase Parallelism
```typescript
// Default: 3 agents
// Increase to 5:
const agents = await orchestrator.provider.allocateResearcherAgents(5, queries);
```

### Adjust Cache Eviction
```typescript
// In AdaptiveCacheManager constructor:
private readonly maxSize = 100 * 1024 * 1024; // 100MB instead of 50MB
```

### Optimize Provider Selection
```typescript
// Budget-aware selection
const provider = await orchestrator.mlRouter.selectOptimalProvider(
  query.length,
  false, // don't prioritize speed
  searchCount * 0.01 // higher budget allows more expensive provider
);
```

### Enable Trace Collection
```typescript
const traceId = `research-${Date.now()}`;
const span = orchestrator.traces.startTrace(traceId, 'orchestration');

// ... do work ...

orchestrator.traces.addSpanTag(traceId, span, 'provider', 'ollama');
orchestrator.traces.endSpan(traceId, span);

// Export trace
const trace = orchestrator.traces.exportAsJSON(traceId);
```

## Troubleshooting

### High Latency
```bash
# Check provider stats
curl http://localhost:3000/dashboard | jq '.prometheus'

# Check for alerts
curl http://localhost:3000/alerts

# Profile performance
curl http://localhost:3000/performance
```

### Cache Misses
```bash
# Check cache stats
curl http://localhost:3000/dashboard | jq '.prometheus' | grep cache

# Increase cache size
# See "Performance Tuning" above
```

### Provider Failures
```bash
# Check service health
curl http://localhost:3000/health

# Check specific provider
curl http://localhost:3000/health/ollama

# Check failover stats
curl http://localhost:3000/dashboard | jq '.prometheus' | grep failover
```

### Memory Issues
```bash
# Check persistent memory
curl http://localhost:3000/dashboard | jq '.prometheus' | grep memory

# Prune old memories
await orchestrator.persistentMemory.prune(7 * 24 * 60 * 60 * 1000); // 7 days
```

## Deployment Checklist

- [ ] All infrastructure services running (Ollama, Wayfarer, SearXNG)
- [ ] Integration validation passed: `node validate-integration.mjs`
- [ ] Production test successful: `node run-production-multiagent.mjs`
- [ ] Prometheus scraping configured
- [ ] Grafana dashboards imported
- [ ] Alert rules defined
- [ ] Health checks registered
- [ ] Performance profiling enabled
- [ ] API endpoints accessible
- [ ] Logging configured
- [ ] Backups configured (persistent memory)
- [ ] Monitoring active

## Files

### Core
- `src/utils/multiAgentProduction.ts` — Production orchestrator (with optimization)
- `src/utils/multiAgentOptimized.ts` — Optimization layer components
- `src/utils/monitoringLayer.ts` — Observability infrastructure
- `src/utils/observabilityAPI.ts` — HTTP endpoints for monitoring

### Testing
- `validate-integration.mjs` — Comprehensive integration validation
- `test-integrated-production.mjs` — Integration test with mini components
- `run-production-multiagent.mjs` — Production test with real infrastructure

### Documentation
- `INTEGRATED_OPTIMIZATION_SUMMARY.md` — Technical reference
- `INTEGRATION_QUICKSTART.md` — Quick start guide
- `PRODUCTION_DEPLOYMENT_GUIDE.md` — This file

## Architecture Decisions

### Why ML-Based Provider Routing?
Static weights don't adapt. ML router learns from every query and improves.

### Why Adaptive Cache?
Fixed TTL wastes space on cold data and loses hot data. Adaptive TTL is intelligent.

### Why Message Bus?
Agents need to coordinate. Event-driven architecture is more modular.

### Why Observability Layer?
Production systems need monitoring, alerting, and debugging. We built it in.

## Next Steps

1. **Deploy to production** → Test with real traffic
2. **Monitor metrics** → Connect to Grafana dashboards
3. **Set up alerting** → Get notified of issues
4. **Optimize based on metrics** → Tune parameters based on real usage
5. **Scale horizontally** → Use message queue for distributed execution
6. **Add more features** → Implement approval webhooks, visual scouting, etc.

## Support

For issues or questions:
1. Check `/alerts` endpoint for active alerts
2. Review `/health` endpoint for service status
3. Check `/dashboard` for metrics snapshot
4. Export trace for debugging: `/traces/:id`
5. Run validation: `node validate-integration.mjs`

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-04-06
**Version:** 1.0.0 (Full Optimization + Observability)
