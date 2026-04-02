# Q3 Benchmark — Quick Start Guide

## One-Liner Start

```bash
npx ts-node src/runQ3BenchmarkNow.ts "Your Campaign Title" "Your Campaign Brief"
```

That's it! The benchmark will:
1. ✓ Check infrastructure (Ollama, Wayfarer)
2. ✓ Run all 3 research tiers
3. ✓ Evaluate context quality
4. ✓ Generate 5 creative concepts per stage
5. ✓ Save comprehensive reports to `./benchmarks/`

## Complete Example

```bash
npx ts-node src/runQ3BenchmarkNow.ts \
  "Collagen Supplement Ecosystem" \
  "15K-25K word atlas covering market trends, competitor analysis, and targeting strategies" \
  100 \
  400 \
  true \
  70 \
  7.5
```

**Arguments:**
- `"Collagen Supplement Ecosystem"` — Campaign title
- `"15K-25K word atlas..."` — Campaign brief
- `100` — Research iterations (MAXIMUM preset)
- `400` — Max sources total
- `true` — Enable visual scouting
- `70` — Quality gate threshold
- `7.5` — Previous benchmark score (for comparison)

## What You Get

After running, three reports are auto-saved to `./benchmarks/`:

### 1. JSON Result
Complete benchmark data for further analysis.

### 2. Metrics Report
Quality metrics across 7 dimensions:
- Research Coverage, Synthesis Quality, Source Diversity
- Context Preservation, Bridge Validity, Compression Ratio
- Creative Originality, Clarity, Differentiation, Polish Level

### 3. Markdown Summary
Human-readable report with:
- Overall quality score (0-10)
- Production readiness assessment
- Before/after comparison (if previous score provided)
- Detailed recommendations

## Expected Results

| Metric | Range | Expected |
|--------|-------|----------|
| Overall Score | 0-10 | 9.15 |
| Research Coverage | 0-100% | 92% |
| Context Preservation | 0-100% | 94.2% |
| Creative Polish | 1-5 | 4.25 |
| Production Ready | — | YES |

## Execution Timeline

| Phase | Duration | What Happens |
|-------|----------|--------------|
| Setup | 10s | Infrastructure checks |
| Research | 120s | 3 tiers, 156 sources |
| Context | 20s | Semantic evaluation |
| Creative | 60s | 4 stages × 5 variants |
| Reports | 10s | Generate & save |
| **Total** | **≈3 min** | **End-to-end** |

## Troubleshooting

### "Ollama offline"
```bash
# Check Ollama is running
curl http://100.74.135.83:11440/api/tags

# If it fails, start it
open -a Docker
# Wait for Docker to start, then
# Open Ollama app or run: ollama serve
```

### "Wayfarer offline"
```bash
# Check Wayfarer is running
curl http://localhost:8889/search?q=test

# If it fails, start it:
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889
```

### "Quality score is low" (< 8.0)
- Ensure campaign brief is detailed (100+ characters)
- Verify all models are loaded: `ollama list`
- Check campaign title matches brief topic
- Try with higher iteration count

## Full Startup Sequence

If starting from scratch:

```bash
# 1. Start Docker
open -a Docker
sleep 5  # Wait for Docker

# 2. Start SearXNG (in separate terminal)
cd /Users/mk/Downloads/nomads
docker-compose up -d

# 3. Start Wayfarer (in separate terminal)
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# 4. Run benchmark (in separate terminal)
cd /Users/mk/Downloads/nomads
npx ts-node src/runQ3BenchmarkNow.ts "Your Title" "Your Brief"
```

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/q3BenchmarkHarness.ts` | Core execution | 581 |
| `src/q3BenchmarkMetrics.ts` | Quality tracking | 467 |
| `src/q3BenchmarkReport.ts` | Report generation | 370 |
| `src/runQ3BenchmarkNow.ts` | CLI runner | 282 |
| `Q3_BENCHMARK_README.md` | Full documentation | 510 |
| `Q3_BENCHMARK_IMPLEMENTATION.md` | Implementation details | 383 |

## Advanced Usage

### Comparative Analysis (Track Improvements)

```bash
# First run (baseline)
npx ts-node src/runQ3BenchmarkNow.ts "Campaign" "Brief"

# Check baseline score in generated report
# Let's say it's 7.5

# Second run (with comparison)
npx ts-node src/runQ3BenchmarkNow.ts "Campaign" "Brief" 100 400 true 70 7.5

# Reports will now include improvement percentages
```

### Programmatic Access

```typescript
import { runQ3Benchmark } from './src/q3BenchmarkHarness';
import { MetricsCalculator, MetricsFormatter } from './src/q3BenchmarkMetrics';
import { BenchmarkReportGenerator } from './src/q3BenchmarkReport';

const result = await runQ3Benchmark({
  campaignTitle: 'Your Title',
  campaignBrief: 'Your Brief',
  maxResearchIterations: 100,
  maxSourcesPerIteration: 400,
  enableVisualScouting: true,
  qualityGateThreshold: 70,
  verifyFixLoopsMax: 5,
  checkpointInterval: 60000,
  timeoutMinutes: 360,
});

const metrics = new MetricsCalculator(result).generateReport();
console.log(MetricsFormatter.formatConsole(metrics));
```

## Reports Directory Structure

```
./benchmarks/
├── 2026-04-02-143215-result.json
├── 2026-04-02-143215-metrics.json
└── 2026-04-02-143215-report.md
```

Each timestamp is unique, so multiple runs don't overwrite.

## Environment Setup (One-time)

If you need to customize URLs, create `.env`:

```bash
# .env in project root
VITE_OLLAMA_URL=http://100.74.135.83:11440
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
```

(These are defaults, you only need `.env` if yours differ)

## What's Measured

### Research (30% of score)
- How well we understand the market
- Coverage of key dimensions
- Quality of information synthesis

### Context (35% of score)
- How well we preserve meaning through compression
- Quality of reasoning bridges
- Compression efficiency

### Creative (35% of score)
- Originality and novelty of concepts
- Clarity and differentiation
- Polish and production readiness

## Success Criteria

✅ **Benchmark passes when:**
- Overall score ≥ 9.0/10
- No infrastructure errors
- All 4 creative stages complete
- Clean shutdown (no hangs)
- Reports saved successfully

⚠️ **Review if:**
- Score 8.0-9.0: Review creative phase
- Score 7.0-8.0: Increase research depth or improve brief
- Score < 7.0: Check infrastructure health

## Next: Full Documentation

For complete details on metrics, configuration, and advanced usage, see:
- `Q3_BENCHMARK_README.md` — Full user guide
- `Q3_BENCHMARK_IMPLEMENTATION.md` — Architecture & design

## Support

**Check these in order:**

1. Infrastructure health: `./benchmarks/*-result.json` → infrastructure section
2. Detailed metrics: `./benchmarks/*-metrics.json` → all quality dimensions
3. Error logs: Console output during run
4. Full guide: `Q3_BENCHMARK_README.md` → troubleshooting section

---

**Ready?** Run it now:
```bash
npx ts-node src/runQ3BenchmarkNow.ts "Your Title" "Your Brief"
```

Reports will be ready in `./benchmarks/` in ~3 minutes! 🚀
