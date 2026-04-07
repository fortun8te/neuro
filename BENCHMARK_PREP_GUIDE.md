# Benchmark Preparation Guide — FINAL CHECKLIST

**Status**: READY FOR BENCHMARK
**Date**: April 4, 2026
**Mode**: Harness Quality Testing (Tool Usage Focus)

---

## Phase 1: Infrastructure Verification ✓

### Services Status

| Service | Port | Status | Command |
|---------|------|--------|---------|
| **Ollama** | 11440 | ✅ ONLINE | `ollama serve` |
| **Wayfayer** | 8889 | ✅ ONLINE | `cd services/wayfayer && SEARXNG_URL=http://localhost:8888 python3.11 -m uvicorn wayfayer_server:app --port 8889` |
| **SearXNG** | 8888 | ✅ ONLINE | `docker-compose up -d` |

**Verification Command**:
```bash
curl http://100.74.135.83:11440/api/tags     # Ollama
curl http://localhost:8889/health             # Wayfayer
curl http://localhost:8888/                   # SearXNG
```

---

## Phase 2: Model Readiness

### Required Models (Download if missing)

```bash
ollama pull qwen3.5:0.8b    # ~530MB  — compression, classification
ollama pull qwen3.5:2b      # ~1.5GB  — page compression, synthesis
ollama pull qwen3.5:4b      # ~2.8GB  — orchestrator, main pipeline
ollama pull qwen3.5:9b      # ~6.6GB  — council brains, Make stage
ollama pull qwen3.5:27b     # ~18GB   — maximum tier (optional)
```

**Quick Check**:
```bash
curl http://100.74.135.83:11440/api/tags | jq '.models[] | .name'
```

---

## Phase 3: Benchmark Framework

### What We're Testing

**NOT** the quality of answers.
**YES** the harness behavior:

1. **Tool Usage**
   - How many tools per question?
   - Tool diversity (web_search vs file_ops vs compute)?
   - Tool sequence (does it chain correctly)?
   - Success/failure rates?

2. **Harness Quality**
   - Error handling present? (try/catch, .catch())
   - Abort signal threading? (can it cancel mid-execution?)
   - Permission gates working? (security checks)
   - Retry logic? (handles transient failures?)
   - Timeout enforcement? (doesn't hang forever?)

3. **Execution Metrics**
   - Time per question
   - Tool calls per question
   - Error recovery count
   - Success rate

### Test Questions Breakdown

| ID | Question | Difficulty | Expected Tools | Analysis |
|----|----------|------------|-----------------|----------|
| 1 | "What is the capital of France?" | Easy | 2 | Basic web search |
| 2 | "Compare React vs Vue in 2024" | Medium | 4-5 | Multi-source comparison |
| 3 | "Bitcoin price analysis over 5 years" | Medium | 5-6 | Time series + analysis |
| 4 | "Latest AI regulations by country" | Hard | 6-8 | Complex research |
| 5 | "Figma competitors analysis" | Hard | 8+ | Deep competitive analysis |
| 6 | "Python version recommendation" | Easy | 2-3 | Straightforward lookup |
| 7 | "How ML improves search" | Medium | 4-5 | Technical explanation |
| 8 | "Cloud computing trends 2024" | Hard | 6-8 | Trend analysis |
| 9 | "Browser JavaScript execution" | Medium | 4-5 | Technical deep-dive |
| 10 | "Serverless architecture pros/cons" | Hard | 6+ | Architecture analysis |

---

## Phase 4: Running the Benchmark

### Quick Start (5 Questions)

```bash
# Terminal 1: Verify services are running
curl http://100.74.135.83:11440/api/tags
curl http://localhost:8889/health
curl http://localhost:8888/

# Terminal 2: Start the frontend agent
cd /Users/mk/Downloads/nomads
npm run dev

# Terminal 3: Run benchmark
node run-gaia-full.mjs --questions=5 --verbose --output=benchmark-results-quick.jsonl
```

### Full Benchmark (50 Questions)

```bash
node run-gaia-full.mjs --questions=50 --verbose --output=benchmark-results-full.jsonl
```

### Custom Query (Single Question)

```bash
node run-gaia-full.mjs --questions=1 --verbose
```

---

## Phase 5: Analysis Per Question

### What to Look For After Each Question

```
After Question N executes:

✓ PASS Criteria:
  □ Tool count >= 70% of expected
  □ Tool diversity >= 2 different categories
  □ No unhandled errors
  □ Execution time < 30 seconds
  □ Response addresses question

⚠ WARN Criteria:
  □ Tool count < 50% expected (but functioning)
  □ Single tool category only (no diversity)
  □ 1-2 error recoveries (acceptable)
  □ Execution time 30-60 seconds

❌ FAIL Criteria:
  □ Tool count < 30% expected
  □ Zero tools used
  □ Unhandled exceptions
  □ Execution time > 60 seconds
  □ No response generated
```

### Harness Quality Scoring

| Component | Points | What to Check |
|-----------|--------|---------------|
| Error Handling | 2 | try/catch, .catch(), error boundaries |
| Abort Signal | 2 | Can cancel mid-execution? |
| Permission Gates | 2 | Security checks present? |
| Retry Logic | 2 | Handles transient failures? |
| Timeout | 2 | Doesn't hang? |
| **Total** | **10** | Sum of all components |

**Good Score**: 7-10 (70%+)
**Acceptable**: 5-6 (50-60%)
**Poor**: 0-4 (<50%)

---

## Phase 6: Metrics Collection

### Per Question (Required)

```json
{
  "id": "1",
  "question": "What is the capital of France?",
  "difficulty": "easy",
  "execution_time_ms": 2341,
  "tool_usage": {
    "total": 3,
    "distinct": 2,
    "diversity": 0.67,
    "by_category": {
      "web_search": 2,
      "fetch_page": 1
    },
    "sequence": ["web_search", "fetch_page", "web_search"]
  },
  "harness_quality": {
    "error_handling": true,
    "abort_signal": true,
    "permission_gates": true,
    "retry_logic": true,
    "timeout": true,
    "score": 10
  },
  "verdict": "✓ PASS"
}
```

### Summary Report (After All Questions)

```json
{
  "total_questions": 50,
  "summary": {
    "avg_tools_per_question": 4.2,
    "avg_tool_diversity": "78%",
    "avg_harness_score": "8.5/10",
    "total_pass": 48,
    "total_warn": 2,
    "total_fail": 0,
    "execution_time_total": "2h 34m"
  },
  "tool_usage_breakdown": {
    "web_search": 145,
    "fetch_page": 98,
    "compute": 34,
    "vision": 12,
    "memory": 8
  },
  "harness_components": {
    "error_handling": "100%",
    "abort_signal": "96%",
    "permission_gates": "100%",
    "retry_logic": "92%",
    "timeout": "100%"
  }
}
```

---

## Phase 7: Success Criteria

### Benchmark is READY TO SHIP if:

✅ **Tool Usage**
- Average tools per question: >= 3.5
- Tool diversity: >= 60%
- Tool categories used: >= 4 different

✅ **Harness Quality**
- Average harness score: >= 8/10
- Error handling: 100%
- Abort signal: >= 90%
- Permission gates: 100%

✅ **Execution**
- Pass rate: >= 95% (48/50)
- Avg execution time: < 3 minutes/question
- No crashes or unhandled exceptions

✅ **Consistency**
- Easy questions: 2-3 tools, ~10-15s
- Medium questions: 4-5 tools, ~20-30s
- Hard questions: 6+ tools, ~30-60s

---

## Phase 8: Debugging Issues

### If Tool Usage is Low

1. Check if tools are being invoked at all
2. Verify tool descriptions are in agent prompt
3. Check token budget (might be cutting off tool use)
4. Inspect abort signal (might be stopping early)

**Debug Command**:
```bash
node run-gaia-full.mjs --questions=1 --verbose 2>&1 | grep -i "tool\|invoke\|error"
```

### If Harness Score is Low

1. Check error handling (should have try/catch)
2. Verify abort signal is threaded through (checkAbortSignal calls)
3. Validate permission gates are being called
4. Look for timeout enforcement

**Debug Command**:
```bash
grep -r "try\|catch\|abort\|permission\|timeout" frontend/utils/agentEngine.ts | head -20
```

### If Execution is Slow

1. Check model sizes (might be using 27b instead of 4b)
2. Look for sequential vs parallel execution
3. Verify no infinite loops or hangs
4. Check token generation speed (tokens/sec)

---

## Phase 9: Reporting Template

### Final Benchmark Report

```markdown
# Benchmark Results — [Date]

## Summary
- Questions Run: 50/50 ✓
- Pass Rate: 96% (48/50)
- Avg Tools: 4.3 per question
- Avg Time: 2m 12s per question
- Harness Score: 8.6/10

## Tool Usage
- Total Invocations: 215
- Categories Used: 5 (web_search, fetch, compute, vision, memory)
- Diversity: 82%

## Harness Quality
- Error Handling: ✓ 100%
- Abort Signals: ✓ 98%
- Permission Gates: ✓ 100%
- Retry Logic: ✓ 92%
- Timeout: ✓ 100%

## Verdict
🟢 **READY FOR PRODUCTION**
```

---

## Quick Commands Reference

```bash
# Check services
curl http://100.74.135.83:11440/api/tags
curl http://localhost:8889/health
curl http://localhost:8888/

# Run benchmark
node run-gaia-full.mjs --questions=50 --verbose

# View results
jq '.' benchmark-results-full.jsonl | head -50

# Compare runs
diff <(jq '.summary' benchmark-1.jsonl) <(jq '.summary' benchmark-2.jsonl)

# Extract tool usage
jq '.[] | .tool_usage.total' benchmark-results-full.jsonl | awk '{sum+=$1} END {print "Avg Tools:", sum/NR}'
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama offline | `ollama serve` in separate terminal |
| Wayfayer timeout | Check SEARXNG_URL is set, restart with 8888 |
| SearXNG offline | `docker-compose up -d` in nomads root |
| No models | `ollama pull qwen3.5:4b` (requires ~2.8GB) |
| Too slow | Switch to smaller model: qwen3.5:2b |
| High error rate | Check logs: `tail -f /tmp/wayfayer.log` |
| Out of memory | Reduce --questions, use smaller model |

---

## Final Checklist

- [ ] All services online (Ollama, Wayfayer, SearXNG)
- [ ] All models downloaded (at least qwen3.5:4b)
- [ ] benchmark-harness.mjs ready
- [ ] run-gaia-full.mjs working
- [ ] Test with 1 question first
- [ ] Monitor first 5 questions
- [ ] Run full 50 question benchmark
- [ ] Collect metrics
- [ ] Generate report
- [ ] Compare vs previous runs
- [ ] Document results

---

**Ready to benchmark? GO! 🚀**
