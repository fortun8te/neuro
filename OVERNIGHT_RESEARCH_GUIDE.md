# NEURO Overnight Research Guide

## Overview

This guide covers the complete overnight research infrastructure for the NEURO harness, enabling unattended, long-running research cycles optimized for maximum depth and coverage.

**Key Features:**
- MAXIMUM research preset (100 iterations, 400 sources, 5+ hours)
- Automatic checkpointing every 30 seconds
- Service health monitoring
- Graceful recovery from crashes (3 retries)
- Memory management with auto-reset
- Real-time monitoring dashboard
- Streaming document generation
- Comprehensive audit trail

---

## Prerequisites

### System Requirements

- macOS 10.15+ (Catalina or later)
- 16GB RAM minimum (24GB+ recommended for overnight runs)
- 10GB free disk space (for session logs, images, and output)
- Stable internet connection

### Software Prerequisites

1. **Node.js** (v18+)
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **npm** (v9+)
   ```bash
   npm --version   # Should be v9.0.0 or higher
   ```

3. **Docker** (for SearXNG)
   ```bash
   docker --version  # Required for web search
   ```

4. **Python 3.11** (for Wayfarer)
   ```bash
   /opt/homebrew/bin/python3.11 --version  # Must be exactly 3.11
   ```

5. **Ollama** (local or remote via Tailscale)
   - Local: `http://localhost:11434`
   - Remote: `http://100.74.135.83:11440`

### Required Services

All services must be running before starting overnight research:

#### 1. Docker / SearXNG

```bash
# Start Docker (if not running)
open -a Docker

# Verify Docker is running
docker ps

# Start SearXNG in background
cd /Users/mk/Downloads/nomads
docker-compose up -d

# Verify SearXNG is running
curl http://localhost:8888/healthz
```

#### 2. Ollama

For **local Ollama**:
```bash
# Start Ollama (should auto-start on macOS)
# Verify it's running
curl http://localhost:11434/api/tags

# Models needed:
# - qwen3.5:27b (18GB) - orchestrator
# - qwen3.5:9b (6.6GB) - council brains
# - qwen3.5:4b (2.8GB) - researchers
# - qwen3.5:2b (1.5GB) - compression
# - qwen3.5:0.8b (530MB) - classification

# Pull missing models
ollama pull qwen3.5:27b
ollama pull qwen3.5:9b
ollama pull qwen3.5:4b
ollama pull qwen3.5:2b
ollama pull qwen3.5:0.8b
```

For **remote Ollama** (via Tailscale):
```bash
# Verify remote connection
curl http://100.74.135.83:11440/api/tags

# If connection fails, check Tailscale
tailscale status
```

#### 3. Wayfarer

```bash
# Terminal 1: Start SearXNG
cd /Users/mk/Downloads/nomads
docker-compose up -d

# Terminal 2: Start Wayfarer with SearXNG URL
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 \
  /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app \
  --host 0.0.0.0 \
  --port 8889

# Verify Wayfarer is running
curl http://localhost:8889/health
```

### Prerequisites Checklist

```bash
# Run this script to validate all prerequisites
cat << 'EOF' > /tmp/check-prerequisites.sh
#!/bin/bash

echo "Checking NEURO Overnight Research Prerequisites..."
echo ""

# Node.js
if command -v node &> /dev/null; then
  echo "✓ Node.js: $(node --version)"
else
  echo "✗ Node.js: NOT FOUND"
fi

# npm
if command -v npm &> /dev/null; then
  echo "✓ npm: $(npm --version)"
else
  echo "✗ npm: NOT FOUND"
fi

# Docker
if command -v docker &> /dev/null; then
  echo "✓ Docker: $(docker --version)"
else
  echo "✗ Docker: NOT FOUND"
fi

# Python 3.11
if /opt/homebrew/bin/python3.11 --version &> /dev/null; then
  echo "✓ Python 3.11: $(/opt/homebrew/bin/python3.11 --version)"
else
  echo "✗ Python 3.11: NOT FOUND"
fi

echo ""
echo "Checking Running Services..."
echo ""

# Ollama
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "✓ Ollama (local): http://localhost:11434"
elif curl -s http://100.74.135.83:11440/api/tags > /dev/null 2>&1; then
  echo "✓ Ollama (remote): http://100.74.135.83:11440"
else
  echo "✗ Ollama: NOT RUNNING"
fi

# SearXNG
if curl -s http://localhost:8888/healthz > /dev/null 2>&1; then
  echo "✓ SearXNG: http://localhost:8888"
else
  echo "✗ SearXNG: NOT RUNNING"
fi

# Wayfarer
if curl -s http://localhost:8889/health > /dev/null 2>&1; then
  echo "✓ Wayfarer: http://localhost:8889"
else
  echo "✗ Wayfarer: NOT RUNNING"
fi

echo ""
echo "Setup Complete!"
EOF

chmod +x /tmp/check-prerequisites.sh
/tmp/check-prerequisites.sh
```

---

## Quick Start

### 1. Start All Services

Open 4 Terminal windows:

**Terminal 1: Docker / SearXNG**
```bash
open -a Docker
cd /Users/mk/Downloads/nomads
docker-compose up -d
```

**Terminal 2: Wayfarer**
```bash
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 \
  /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app \
  --host 0.0.0.0 --port 8889
```

**Terminal 3: Verify Services**
```bash
# Wait 10 seconds then verify
sleep 10
curl http://localhost:8888/healthz   # SearXNG
curl http://localhost:8889/health    # Wayfarer
curl http://localhost:11434/api/tags # Ollama (or remote)
```

**Terminal 4: Start Overnight Research**
```bash
cd /Users/mk/Downloads/nomads
./startOvernightResearch.sh "Your Campaign Brief" "Your Research Topic"
```

### 2. Monitor Progress

Open browser to: `http://localhost:5173`

The OvernightResearchMonitor dashboard displays:
- Real-time iteration progress
- Sources found and tokens used
- Elapsed time and estimated completion
- Memory usage and resource tracking
- Service health status
- Checkpoint statistics

### 3. Session Output

All session files are saved to: `/tmp/neuro-overnight-{timestamp}/`

Contents:
- `session.log` — Complete activity log
- `status.json` — Current session state
- `metrics.json` — Performance metrics
- `overnight_research.docx` — Generated research document (if enabled)
- `images/` — Downloaded competitor images

---

## Configuration

### Research Depth Preset (MAXIMUM)

The overnight research is configured with the MAXIMUM preset:

| Setting | Value |
|---------|-------|
| **Iterations** | 100 (max) |
| **Sources** | 400+ |
| **Time Budget** | 5 hours (research phase only) |
| **Parallel Researchers** | 5 concurrent agents |
| **Compression** | 12 parallel tasks |
| **Cross-Validation** | Enabled |
| **Multi-Language Search** | Enabled |
| **Historical Analysis** | Enabled |
| **Community Deep Dive** | Enabled |
| **Competitor Ad Scraping** | Enabled |
| **Academic Search** | Enabled |
| **Visual Analysis** | 5 batches, 30 URLs |

### Customizing Configuration

Edit `src/config/overtimeResearchConfig.ts`:

```typescript
// Modify research limits
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  maxIterations: 100,      // Increase for deeper research
  minSources: 400,         // Increase for broader coverage
  maxTimeMinutes: 480,     // Increase time budget (in minutes)
  parallelCompressionCount: 12,  // Increase for faster processing
  // ... other settings
};

// Modify checkpointing
checkpoint: {
  intervalMs: 30000,       // Change checkpoint frequency (ms)
  compressionLevel: 'aggressive',
},

// Modify resource limits
resources: {
  memoryLimitMb: 1024,     // Increase if you have 32GB+ RAM
  maxNetworkConcurrency: 32,
},
```

### Environment Variables

Create `.env.local` in project root:

```bash
# Ollama Configuration
VITE_OLLAMA_URL=http://100.74.135.83:11440  # Remote Ollama
# VITE_OLLAMA_URL=http://localhost:11434    # Local Ollama

# Wayfarer Configuration
VITE_WAYFARER_URL=http://localhost:8889

# SearXNG Configuration
VITE_SEARXNG_URL=http://localhost:8888

# Search concurrency
VITE_SEARXNG_CONCURRENCY=32
VITE_WAYFARER_CONCURRENCY=20

# Feature flags
VITE_HEALTH_MONITORING_ENABLED=true
VITE_GRACEFUL_DEGRADATION_ENABLED=true
```

---

## Running Overnight Research

### Basic Usage

```bash
./startOvernightResearch.sh "Campaign Name" "Research Topic"
```

### Examples

**Example 1: Product Research**
```bash
./startOvernightResearch.sh \
  "Collagen Supplement Brand" \
  "Premium collagen supplement market trends 2025"
```

**Example 2: Market Analysis**
```bash
./startOvernightResearch.sh \
  "B2B SaaS Platform" \
  "Enterprise software project management market analysis"
```

**Example 3: Competitive Intelligence**
```bash
./startOvernightResearch.sh \
  "AI Writing Assistant" \
  "AI copywriting tools competitive landscape"
```

### What the Script Does

1. **Validates** all prerequisites (Node, npm, Docker, services)
2. **Checks** that Ollama, Wayfarer, and SearXNG are running
3. **Creates** session directory: `/tmp/neuro-overnight-{timestamp}`
4. **Starts** Vite dev server in background
5. **Initializes** research cycle with MAXIMUM preset
6. **Streams** all output to `session.log`
7. **Updates** `status.json` every 5 minutes
8. **Monitors** service health continuously
9. **Handles** graceful shutdown on Ctrl+C

### Session Directory Structure

```
/tmp/neuro-overnight-1712192400/
├── session.log              # Complete activity log
├── status.json              # Current session state (updates every 5 min)
├── metrics.json             # Performance metrics
├── overnight_research.docx  # Generated research document
├── images/                  # Downloaded competitor images
│   ├── image-001.jpg
│   ├── image-002.png
│   └── ...
└── .env.local              # Session environment variables
```

---

## Monitoring Progress

### 1. Web Dashboard

The easiest way to monitor progress:

```bash
open http://localhost:5173
```

The OvernightResearchMonitor component displays:
- **Progress Bar**: Iteration completion percentage
- **Sources Found**: Number of web pages analyzed
- **Tokens Used**: LLM token consumption
- **Elapsed Time**: How long the research has been running
- **Estimated Completion**: Based on iteration speed
- **Memory Usage**: RAM consumption and trend
- **Service Health**: Status of Ollama, Wayfarer, SearXNG
- **Checkpoint Status**: Recovery point creation and restoration

### 2. Log File

```bash
# Watch logs in real-time
tail -f /tmp/neuro-overnight-{timestamp}/session.log

# Search for errors
grep ERROR /tmp/neuro-overnight-{timestamp}/session.log

# Count by log level
grep -c "INFO" /tmp/neuro-overnight-{timestamp}/session.log
grep -c "WARN" /tmp/neuro-overnight-{timestamp}/session.log
grep -c "ERROR" /tmp/neuro-overnight-{timestamp}/session.log
```

### 3. Status File

```bash
# Check current status
cat /tmp/neuro-overnight-{timestamp}/status.json | jq .

# Watch status updates
while true; do
  clear
  cat /tmp/neuro-overnight-{timestamp}/status.json | jq .
  sleep 5
done
```

### 4. Performance Metrics

```bash
# View metrics (updated every minute)
cat /tmp/neuro-overnight-{timestamp}/metrics.json | jq .

# Calculate sources per hour
cat /tmp/neuro-overnight-{timestamp}/metrics.json | \
  jq '.sourcesPerMinute * 60'

# Calculate tokens per hour
cat /tmp/neuro-overnight-{timestamp}/metrics.json | \
  jq '.tokensPerMinute * 60'
```

---

## Resuming After Crash

The overnight research system includes automatic crash recovery:

1. **Automatic Detection**: Monitors process health every 5 minutes
2. **Checkpoint Restoration**: Restores from most recent checkpoint (every 30s)
3. **Retry Policy**: Up to 3 automatic restarts
4. **Backoff Strategy**: Exponential backoff (5s, 10s, 20s)

### Manual Resume

If automatic recovery fails, manually resume:

```bash
# Get the session ID from the status file
SESSION_ID=$(jq -r '.sessionId' /tmp/neuro-overnight-{timestamp}/status.json)

# Resume from the latest checkpoint
./startOvernightResearch.sh "Campaign" "Topic" --resume-session $SESSION_ID
```

---

## Troubleshooting

### Services Not Running

**Problem**: "Service not responding" errors

**Solution**:
```bash
# Check each service
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:8889/health     # Wayfarer
curl http://localhost:8888/healthz    # SearXNG

# Restart Wayfarer if needed
pkill -f "wayfarer_server"
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 \
  /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app \
  --host 0.0.0.0 --port 8889

# Restart Docker if needed
docker-compose -f /Users/mk/Downloads/nomads/docker-compose.yml down
docker-compose -f /Users/mk/Downloads/nomads/docker-compose.yml up -d
```

### Memory Issues

**Problem**: "Memory limit exceeded" or process killed

**Solution**:
1. Increase memory limit in `overtimeResearchConfig.ts`:
   ```typescript
   resources: {
     memoryLimitMb: 2048,  // Increase from 1024
   }
   ```

2. Or reduce research depth:
   ```typescript
   maxIterations: 50,      // Reduce from 100
   parallelCompressionCount: 6,  // Reduce from 12
   ```

3. Monitor memory usage during run:
   ```bash
   watch -n 1 'ps aux | grep node | grep -v grep'
   ```

### Slow Iterations

**Problem**: Research is slower than expected

**Causes & Solutions**:
- **SearXNG bottleneck**: Reduce `VITE_SEARXNG_CONCURRENCY` to 16
- **Ollama bottleneck**: Check Ollama memory with `ollama ps`
- **Network saturation**: Reduce parallel researchers from 5 to 3
- **Compression queue**: Reduce `parallelCompressionCount` from 12 to 8

### Checkpoint Failures

**Problem**: "Checkpoint creation failed" warnings

**Solution**:
1. Check IndexedDB storage:
   ```bash
   # Browser console
   const db = await idb.openDB('neuro-checkpoint-db');
   const keys = await db.getAllKeys('sessions');
   console.log(keys);  // Should be growing
   ```

2. Clear old checkpoints:
   ```typescript
   // In browser console
   const db = await idb.openDB('neuro-checkpoint-db');
   await db.clear('sessions');
   ```

3. Restart the session

### High Token Usage

**Problem**: "Tokens per minute is too high"

**Solution**:
- This is usually normal during MAXIMUM preset research
- Expected: 200-500 tokens/second
- If exceeding 1000 tokens/second, check for loops:
  ```bash
  grep "infinite\|loop\|retry" /tmp/neuro-overnight-{timestamp}/session.log
  ```

---

## Performance Tuning

### For Faster Results

```typescript
// In overtimeResearchConfig.ts
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  maxIterations: 50,           // Reduce from 100
  minSources: 200,            // Reduce from 400
  maxTimeMinutes: 240,        // Reduce from 480
  parallelCompressionCount: 8, // Reduce from 12
  skipReflection: false,      // Keep enabled for quality
  multiLanguageSearch: false, // Disable if not needed
  historicalAnalysis: false,  // Disable if not needed
};
```

**Expected Result**: 2-3 hour research phase instead of 5 hours

### For Better Quality

```typescript
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  maxIterations: 150,         // Increase from 100
  minSources: 600,           // Increase from 400
  maxTimeMinutes: 720,       // Increase to 12 hours
  parallelCompressionCount: 16, // Increase from 12
  crossValidation: true,     // Enable
  multiLanguageSearch: true, // Enable
  communityDeepDive: true,   // Enable
  academicSearch: true,      // Enable
};
```

**Expected Result**: More comprehensive research, higher quality findings

### For Minimal Memory Usage

```typescript
resources: {
  memoryLimitMb: 512,        // Reduce from 1024
  maxCpuPercent: 60,         // Reduce from 85
  maxNetworkConcurrency: 16, // Reduce from 32
},

// Also reduce limits
parallelCompressionCount: 4,
maxResearchersPerIteration: 2,
```

**Expected Result**: Runs on 8GB RAM systems, slower but more stable

---

## Exporting Results

### Download Session Files

```bash
# Archive entire session
SESSION_ID="overnight-1712192400"
cd /tmp
zip -r "neuro-${SESSION_ID}.zip" "neuro-${SESSION_ID}/"

# Move to Downloads
mv "neuro-${SESSION_ID}.zip" ~/Downloads/
```

### Convert DOCX Output

```bash
# The generated overnight_research.docx can be:

# 1. Opened directly in Microsoft Word
open /tmp/neuro-overnight-{timestamp}/overnight_research.docx

# 2. Converted to PDF
soffice --headless --convert-to pdf \
  /tmp/neuro-overnight-{timestamp}/overnight_research.docx

# 3. Converted to markdown
pandoc /tmp/neuro-overnight-{timestamp}/overnight_research.docx -t markdown \
  -o /tmp/neuro-overnight-{timestamp}/overnight_research.md
```

### Import into Figma

The research findings can be integrated into Figma for design work:

1. Export key insights from `overnight_research.docx`
2. Import competitor images from `images/` directory
3. Use findings to inform design decisions
4. Link to Code Connect for implementation

---

## Cleanup

### After Session Completes

```bash
# Archive old sessions
SESSION_ID="overnight-1712192400"
cd /tmp
tar -czf "neuro-${SESSION_ID}.tar.gz" "neuro-${SESSION_ID}/"
rm -rf "neuro-${SESSION_ID}/"

# Keep only recent sessions (optional)
find /tmp/neuro-overnight-* -mtime +7 -exec rm -rf {} \;
```

### Free Up Space

```bash
# Remove old images (keeps last 5 sessions)
find /tmp/neuro-overnight-*/images -mtime +7 -delete

# Compress logs (reduces by 80%)
find /tmp/neuro-overnight-*/session.log -exec gzip {} \;
```

---

## Scheduling Overnight Research

### Automate Nightly Runs

```bash
# Edit crontab
crontab -e

# Add this line to run research every night at 8 PM
0 20 * * * /Users/mk/Downloads/nomads/startOvernightResearch.sh \
  "Nightly Research" "Market trends $(date +\%Y-\%m-\%d)" \
  >> /tmp/neuro-cron.log 2>&1
```

### Weekly Deep Dive

```bash
# Run MAXIMUM preset every Sunday at 10 PM
0 22 * * 0 /Users/mk/Downloads/nomads/startOvernightResearch.sh \
  "Weekly Deep Dive" "Competitive landscape deep analysis" \
  >> /tmp/neuro-cron.log 2>&1
```

---

## Advanced Usage

### Custom Research Topics

```bash
# For different markets
./startOvernightResearch.sh "B2B SaaS" "Project management software 2025"
./startOvernightResearch.sh "E-commerce" "Organic skincare market trends"
./startOvernightResearch.sh "AI Tools" "Generative AI writing assistants"

# For different campaigns
./startOvernightResearch.sh "Product A" "Market positioning strategy"
./startOvernightResearch.sh "Product B" "Competitor feature analysis"
./startOvernightResearch.sh "Product C" "Customer pain point research"
```

### Parallel Research Sessions

You can run multiple overnight research sessions in parallel:

```bash
# Terminal 1: Research Topic A
./startOvernightResearch.sh "Campaign A" "Topic A"

# Terminal 2: Research Topic B
./startOvernightResearch.sh "Campaign B" "Topic B"

# Note: Each session uses separate session directory and log files
# Monitor both at http://localhost:5173 (single dashboard)
```

### Integration with CI/CD

```bash
#!/bin/bash
# In your CI/CD pipeline (e.g., GitHub Actions)

# Start services
docker-compose up -d

# Wait for services to be ready
sleep 30

# Run research
./startOvernightResearch.sh \
  "${{ github.event.inputs.campaign }}" \
  "${{ github.event.inputs.topic }}"

# Capture output
SESSION_ID=$(ls -t /tmp/neuro-overnight-* | head -1)
echo "session_id=$SESSION_ID" >> $GITHUB_OUTPUT

# Upload results
aws s3 sync "$SESSION_ID" "s3://my-bucket/research/"
```

---

## Support and Debugging

### Enable Debug Logging

```typescript
// In overtimeResearchConfig.ts
monitoring: {
  logLevel: 'debug',  // Change from 'info'
  enableVerboseApiLogging: true,
},
```

### Collect Debug Information

```bash
# Create debug bundle
mkdir -p /tmp/neuro-debug
cp /tmp/neuro-overnight-{timestamp}/session.log /tmp/neuro-debug/
cp /tmp/neuro-overnight-{timestamp}/status.json /tmp/neuro-debug/
cp /tmp/neuro-overnight-{timestamp}/metrics.json /tmp/neuro-debug/
tail -100 ~/.ollama/logs/server.log > /tmp/neuro-debug/ollama.log
tar -czf /tmp/neuro-debug.tar.gz /tmp/neuro-debug/
```

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Service not responding" | Service crashed | Restart Ollama/Wayfarer/Docker |
| "Memory limit exceeded" | Too many parallel tasks | Reduce `parallelCompressionCount` |
| "No sources found" | Search query issues | Check SearXNG health |
| "Slow iterations" | Model overloaded | Reduce concurrent researchers |
| "Checkpoint failures" | IndexedDB full | Clear old sessions |

---

## API Reference

### Configuration Types

```typescript
// Complete configuration object
interface OvernightSessionConfig {
  sessionId: string;
  campaignBrief: string;
  researchTopic: string;
  startTime: number;
  researchLimits: ResearchLimits;
  checkpoint: { intervalMs: number; compressionLevel: string };
  resources: { memoryLimitMb: number; maxCpuPercent: number };
  recovery: { enabled: boolean; maxRetries: number };
  monitoring: { healthCheckIntervalMs: number; logLevel: string };
  document: { enabled: boolean; format: 'docx' };
  images: { enabled: boolean; maxImagesPerSession: number };
  timeouts: { researchPhaseMaxMs: number };
  logging: { enabled: boolean; logDir: string };
}
```

### Utility Functions

```typescript
// Estimate remaining time
const remainingMs = OvernightUtils.estimateTimeRemaining(state);

// Format elapsed time
const formatted = OvernightUtils.formatElapsedTime(elapsedMs);

// Check memory pressure
const shouldReset = OvernightUtils.shouldResetMemory(memoryMb);

// Format large numbers
const formatted = OvernightUtils.formatNumber(1000000); // "1,000,000"
```

---

## FAQ

**Q: How long does a MAXIMUM preset research take?**
A: 5-6 hours for the research phase, plus 1-2 hours for subsequent stages (objections, taste, make, test), totaling 6-8 hours.

**Q: Can I run multiple overnight sessions?**
A: Yes, each session has its own directory and logs. Monitor all at the same web dashboard.

**Q: What if the server crashes?**
A: The system automatically restarts up to 3 times from the latest checkpoint (created every 30s).

**Q: How much disk space do I need?**
A: About 500MB per 5-hour session (logs, images, documents). Archive and compress old sessions to save space.

**Q: Can I resume a session the next day?**
A: Yes, if the session is paused gracefully. Use `--resume-session` flag with the session ID.

**Q: How do I stop research without losing progress?**
A: Send SIGINT (Ctrl+C). The script creates a checkpoint and exits cleanly. Resume with `--resume-session`.

---

## Next Steps

1. Validate all prerequisites (checklist above)
2. Start all services in 4 terminal windows
3. Run first overnight research session
4. Monitor progress with web dashboard
5. Export results and integrate with your workflow
6. Schedule recurring overnight runs with cron

For questions or issues, check the logs and troubleshooting section above.
