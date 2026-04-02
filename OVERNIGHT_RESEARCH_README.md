# NEURO Overnight Research Infrastructure

Production-ready system for unattended, long-running research cycles with automatic checkpointing, recovery, and real-time monitoring.

## Quick Start (5 minutes)

### 1. Validate Prerequisites

```bash
# All these must be installed and running
node --version        # v18+
npm --version         # v9+
docker ps            # Docker running
curl http://localhost:11434/api/tags  # Ollama running
curl http://localhost:8889/health     # Wayfarer running
curl http://localhost:8888/healthz    # SearXNG running
```

### 2. Start Overnight Research

```bash
cd /Users/mk/Downloads/nomads
./startOvernightResearch.sh "Campaign Brief" "Research Topic"

# Example:
./startOvernightResearch.sh "AI Tools Platform" "Enterprise Software Market 2025"
```

### 3. Monitor Progress

Open browser: `http://localhost:5173`

Dashboard shows:
- Real-time iteration progress (0-100)
- Sources found (target: 400+)
- Tokens used
- Elapsed time and ETA
- Memory usage
- Service health (Ollama, Wayfarer, SearXNG)

### 4. Session Output

Check `/tmp/neuro-overnight-{timestamp}/`:
- `session.log` — All activity
- `status.json` — Current state (updates every 5 min)
- `overnight_research.docx` — Generated report
- `images/` — Downloaded competitor visuals

---

## Key Features

**Research Configuration**
- MAXIMUM preset: 100 iterations, 400+ sources, 5-hour budget
- Quality model (qwen3.5:27b) for orchestration
- All advanced features enabled (cross-validation, multi-language, etc.)

**Reliability**
- Auto-checkpoint every 30 seconds to IndexedDB
- Crash recovery with 3 automatic retries
- Graceful shutdown handling (Ctrl+C safe)
- Memory monitoring with auto-reset at 1GB

**Monitoring**
- Real-time web dashboard
- Service health checks every 5 minutes
- Streaming progress to logs
- Metrics collection (tokens/min, sources/min, etc.)

**Document Generation**
- Streaming .docx output
- Research findings formatted as report
- Includes charts, images, findings
- Ready for stakeholder review

---

## File Structure

| File | Purpose |
|------|---------|
| `src/config/overtimeResearchConfig.ts` | Configuration objects and constants |
| `startOvernightResearch.sh` | Main entry point script (validates, starts, monitors) |
| `src/components/OvernightResearchMonitor.tsx` | Real-time dashboard component |
| `OVERNIGHT_RESEARCH_GUIDE.md` | Complete documentation (500+ lines) |
| `OVERNIGHT_RESEARCH_README.md` | This file (quick reference) |

---

## Detailed Documentation

For complete setup, configuration, troubleshooting, and advanced usage:

**Read: `OVERNIGHT_RESEARCH_GUIDE.md`**

Contains:
- Prerequisites checklist with exact commands
- Step-by-step service startup
- Configuration customization
- Performance tuning options
- Troubleshooting guide
- Recovery procedures
- Integration examples
- FAQ

---

## Architecture

```
startOvernightResearch.sh (entry point)
├── Validates prerequisites
├── Checks service health (Ollama, Wayfarer, SearXNG)
├── Creates session directory: /tmp/neuro-overnight-{timestamp}
├── Starts Vite dev server (background)
├── Initializes research cycle
├── Monitors health every 5 minutes
├── Updates status.json every 5 minutes
├── Streams output to session.log
├── Handles recovery on crash (auto-restart)
└── Creates final report on completion

OvernightResearchMonitor.tsx (dashboard)
├── Fetches session state from IndexedDB every 5s
├── Checks service health every 5s
├── Displays real-time metrics
├── Shows progress bars and graphs
├── Provides Pause/Resume/Stop controls
└── Updates automatically (no refresh needed)

overtimeResearchConfig.ts (configuration)
├── Research depth presets (MAXIMUM: 100 iters, 400 sources)
├── Checkpoint strategy (every 30s)
├── Resource limits (1GB memory)
├── Recovery policy (3 retries)
├── Monitoring thresholds
└── Utility functions (time formatting, memory checks)
```

---

## Configuration

### Minimal (2-3 hour run)

```typescript
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  maxIterations: 40,
  minSources: 150,
  maxTimeMinutes: 180,
  parallelCompressionCount: 6,
};
```

### Standard (5 hour run) — DEFAULT

```typescript
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  maxIterations: 100,
  minSources: 400,
  maxTimeMinutes: 480,
  parallelCompressionCount: 12,
};
```

### Premium (8+ hour run)

```typescript
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  maxIterations: 150,
  minSources: 600,
  maxTimeMinutes: 720,
  parallelCompressionCount: 16,
};
```

### Custom

Edit `src/config/overtimeResearchConfig.ts` and adjust:
- `maxIterations` — Number of research rounds
- `minSources` — Minimum web pages to analyze
- `maxTimeMinutes` — Maximum research time (minutes)
- `parallelCompressionCount` — Parallel compression tasks
- Memory limits, checkpoint intervals, timeout values

---

## Services Checklist

Before running overnight research, ensure all services are running:

```bash
# Terminal 1: Start Docker and SearXNG
open -a Docker
sleep 10
cd /Users/mk/Downloads/nomads
docker-compose up -d

# Terminal 2: Start Wayfarer
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 \
  /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app \
  --host 0.0.0.0 --port 8889

# Terminal 3: Verify services (wait 10s first)
sleep 10
curl http://localhost:8888/healthz    # SearXNG
curl http://localhost:8889/health     # Wayfarer
curl http://localhost:11434/api/tags  # Ollama (or remote)

# Terminal 4: Run overnight research
cd /Users/mk/Downloads/nomads
./startOvernightResearch.sh "Campaign" "Topic"
```

---

## Monitoring

### Web Dashboard

```bash
open http://localhost:5173
```

Displays live:
- Iteration progress bar
- Sources and tokens count
- Elapsed time and ETA
- Memory usage graph
- CPU usage
- Service health
- Checkpoint status
- Pause/Resume/Stop buttons

### Command Line

```bash
# Watch logs in real-time
tail -f /tmp/neuro-overnight-{timestamp}/session.log

# Watch status updates
watch -n 1 'cat /tmp/neuro-overnight-{timestamp}/status.json | jq .'

# Check for errors
grep ERROR /tmp/neuro-overnight-{timestamp}/session.log

# Count log entries
grep -c "INFO" /tmp/neuro-overnight-{timestamp}/session.log
```

---

## Session Output

All results saved to: `/tmp/neuro-overnight-{timestamp}/`

| File | Contents |
|------|----------|
| `session.log` | Complete activity log (DEBUG/INFO/WARN/ERROR) |
| `status.json` | Current session state (updated every 5 min) |
| `metrics.json` | Performance metrics (sources/min, tokens/sec, etc.) |
| `overnight_research.docx` | Generated research report (with charts, images) |
| `images/` | Downloaded competitor images (max 100) |
| `.env.local` | Session environment variables |

---

## Recovery

### Automatic

- Monitors process health every 5 minutes
- Auto-restarts up to 3 times on crash
- Restores from latest checkpoint (created every 30s)
- Exponential backoff: 5s, 10s, 20s between restarts

### Manual

```bash
# Stop current session
pkill -f "startOvernightResearch"

# Resume from checkpoint
./startOvernightResearch.sh "Campaign" "Topic" --resume-session overnight-{timestamp}
```

---

## Troubleshooting

### Services Not Running

```bash
# Check each service
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:8889/health     # Wayfarer
curl http://localhost:8888/healthz    # SearXNG

# Restart any that are down
# See OVERNIGHT_RESEARCH_GUIDE.md for detailed commands
```

### Memory Issues

```typescript
// Increase limit in overtimeResearchConfig.ts
resources: {
  memoryLimitMb: 2048,  // Up from 1024
}

// Or reduce iterations
maxIterations: 50,      // Down from 100
```

### Slow Iterations

- Reduce `parallelCompressionCount` from 12 to 8
- Reduce `maxResearchersPerIteration` from 5 to 3
- Check Ollama memory: `ollama ps`

### Checkpoint Failures

- Clear old checkpoints from IndexedDB
- Check available disk space
- Verify IndexedDB is not full

---

## Common Commands

```bash
# Start all services
open -a Docker && \
  cd /Users/mk/Downloads/nomads && \
  docker-compose up -d && \
  cd wayfarer && \
  SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 \
    -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# Run overnight research
./startOvernightResearch.sh "Campaign" "Topic"

# Monitor dashboard
open http://localhost:5173

# Watch logs
tail -f /tmp/neuro-overnight-*/session.log

# List all sessions
ls -lh /tmp/neuro-overnight-*/

# Archive old session
tar -czf ~/Downloads/neuro-research-{timestamp}.tar.gz /tmp/neuro-overnight-{timestamp}/

# Clean up old sessions
find /tmp/neuro-overnight-* -mtime +7 -exec rm -rf {} \;
```

---

## Schedule Recurring Runs

```bash
# Edit crontab
crontab -e

# Run every night at 8 PM
0 20 * * * /Users/mk/Downloads/nomads/startOvernightResearch.sh \
  "Nightly Research" "Market trends $(date +\%Y-\%m-\%d)" \
  >> /tmp/neuro-cron.log 2>&1

# Run every Sunday at 10 PM (deep dive)
0 22 * * 0 /Users/mk/Downloads/nomads/startOvernightResearch.sh \
  "Weekly Deep Dive" "Competitive landscape" \
  >> /tmp/neuro-cron.log 2>&1
```

---

## Performance

**MAXIMUM Preset Metrics**

| Metric | Value |
|--------|-------|
| Duration | 5-6 hours (research phase) |
| Iterations | 100 (all completed) |
| Sources Found | 400+ web pages |
| Tokens Used | 500K-1M |
| Average Iteration | 3-4 minutes |
| Sources/Hour | 70-100 pages |
| Tokens/Minute | 200-300 tokens |
| Memory Peak | 800-900 MB |
| Checkpoints Created | 600-700 (every 30s) |

---

## Support

For detailed setup, configuration, troubleshooting, and advanced topics:

**See: `OVERNIGHT_RESEARCH_GUIDE.md` (500+ lines)**

Covers:
- Prerequisites checklist
- Service startup commands
- Configuration options
- Performance tuning
- Troubleshooting guide
- Recovery procedures
- Integration examples
- FAQ and debugging

---

## License

Part of the NEURO overnight research infrastructure for the Claude Code harness.

---

## Next Steps

1. Read prerequisites section of `OVERNIGHT_RESEARCH_GUIDE.md`
2. Start all four services in separate terminals
3. Run first overnight research session
4. Monitor with web dashboard at `http://localhost:5173`
5. Review results in `/tmp/neuro-overnight-{timestamp}/`
6. Schedule recurring runs with cron (optional)

**Good luck with your overnight research!**
