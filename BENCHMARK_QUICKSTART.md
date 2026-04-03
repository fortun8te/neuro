# Neuro Benchmark — Quick Start Guide

## What's Been Designed

A comprehensive **25-test benchmark suite** that validates the entire Neuro agentic harness architecture:

| Tier | Tests | Focus | Validates |
|------|-------|-------|-----------|
| **Verification** | 3 | Real tool execution | Tools actually run (not hallucinated) |
| **Model Routing** | 4 | Correct model selection | Task complexity → model tier mapping |
| **Multi-Step** | 3 | Tool sequencing | Chained tool calls with dependencies |
| **Context** | 3 | Knowledge base integration | Context1 retrieval & citation |
| **Web Search** | 4 | Live data retrieval | Wayfarer returns actual current info |
| **Hallucination** | 3 | Safety & refusal | Agent refuses to fabricate |
| **Full Cycle** | 3 | End-to-end integration | All components work together |

**Success Criterion:** ≥20/25 tests passing = **Architecture is production-ready**

---

## Before Running: Prerequisites

Make sure these are running locally:

```bash
# 1. Start Ollama (in terminal 1)
ollama serve

# 2. Start Wayfarer (in terminal 2)
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# 3. Start SearXNG Docker (in terminal 3)
cd /Users/mk/Downloads/nomads
docker-compose up -d
```

**Models Required (pull if missing):**
```bash
ollama pull qwen3.5:0.8b
ollama pull qwen3.5:2b
ollama pull qwen3.5:4b
ollama pull qwen3.5:9b
ollama pull qwen3.5:27b
ollama pull chromadb-context-1:latest
```

Check status:
```bash
ollama list  # Should show all 5+ models
curl http://localhost:11434/api/tags  # JSON output
curl http://localhost:8889/health     # Wayfarer
curl http://localhost:8888/healthz    # SearXNG
```

---

## Infrastructure Configuration

The benchmark uses **LOCAL infrastructure by default**:

```
Ollama:   http://localhost:11434
Wayfarer: http://localhost:8889
SearXNG:  http://localhost:8888
```

**Why we changed the default:**

Previously, the CLI would default to `'remote'` mode (Tailscale remote server) because localStorage wasn't available. This meant the benchmark would timeout trying to reach `100.74.135.83:11434`.

**Now (fixed):**

1. `getInfrastructureMode()` checks `VITE_INFRASTRUCTURE_MODE` env var first
2. Then checks localStorage (browser)
3. Defaults to `'local'` for CLI/server-side execution

**Override if needed:**

```bash
# Explicitly use remote (e.g., if local Ollama is down)
export VITE_INFRASTRUCTURE_MODE=remote
npm run benchmark

# Or set specific URLs
export VITE_OLLAMA_URL=http://100.74.135.83:11434
export VITE_WAYFARER_URL=http://remote.machine:8889
npm run benchmark
```

---

## Running the Benchmark

### Full Suite (All 25 Tests)
```bash
./run-benchmark.sh
```

This will:
- ✓ Check all prerequisites (services running, ports open)
- ✓ Verify Ollama models are available
- ✓ Run all 25 tests with progress feedback
- ✓ Generate report with pass/fail per category
- ✓ Validate architecture soundness

**Estimated time:** 8-12 minutes (depending on model inference speed)

### By Category

```bash
# Verification tests only (token round-trips)
./run-benchmark.sh --category verification

# Model routing tests only
./run-benchmark.sh --category routing

# Multi-step reasoning tests
./run-benchmark.sh --category multistep

# Context retrieval tests
./run-benchmark.sh --category context

# Web search tests
./run-benchmark.sh --category websearch

# Hallucination safety tests
./run-benchmark.sh --category hallucination

# Full cycle integration tests
./run-benchmark.sh --category fullcycle
```

### Single Test

```bash
# Run just one test to debug
./run-benchmark.sh --test test_token_write_read_simple

# For example, test model routing
./run-benchmark.sh --test test_model_routing_standard
```

### Design Only (No Execution)
```bash
# Review benchmark architecture without running
./run-benchmark.sh --design-only

# Shows:
# - Test structure validation
# - Category breakdown
# - Success criteria
# - Estimated time per test
```

---

## Test Descriptions

### Tier 1: Verification (Real Execution)

**What it tests:** Can the agent actually execute tools, or just hallucinate tool calls?

**How it works:**
1. Generate a random UUID token (e.g., `a1b2c3d4-e5f6-4g7h...`)
2. Tell agent: "Write this token to a file, then read it back"
3. Check if agent returns the exact token

**Why it works:**
- Random UUID is impossible to guess/hallucinate
- Proves file_write + file_read actually executed
- Model cannot return token without actually reading the file

**Tests:**
- `test_token_write_read_simple`: 0.8b model, basic round-trip (30s)
- `test_token_write_read_standard`: 4b model, with instruction complexity (30s)
- `test_token_write_read_complex`: 9b model, conditional logic (45s)

---

### Tier 2: Model Routing (Correct Model Selection)

**What it tests:** Does the system select the right model for the task complexity?

**Task Tiers:**
- **Simple** (0.8b/2b): "What is 2 + 2?"
- **Standard** (4b): "Analyze this market segment..."
- **Complex** (9b): "Create competitive positioning framework..."
- **Deep** (27b): "Design comprehensive go-to-market strategy..."

**How it works:**
- Agent audit trail logs which model was selected
- Test checks if selected model matches expected tier

**Tests:**
- `test_model_routing_simple`: Simple → 0.8b/2b (20s)
- `test_model_routing_standard`: Medium → 4b (40s)
- `test_model_routing_quality`: Complex → 9b (60s)
- `test_model_routing_maximum`: Deep → 27b (120s)

---

### Tier 3: Multi-Step Reasoning (Tool Chaining)

**What it tests:** Can agent call multiple tools in sequence with dependencies?

**Example Flow:**
1. Read config file → get topic
2. web_search using that topic
3. Write findings to output file

**How it works:**
- Track all tool_start/tool_done events
- Verify tool order (read → search → write)
- Check that outputs of one tool feed into next

**Tests:**
- `test_threestep_sequential`: Read → search → write (60s)
- `test_fourfold_dependency`: Read twice → search → write (90s)
- `test_conditional_branching`: Read → if/else → search/skip → write (60s)

---

### Tier 4: Context & Knowledge Base

**What it tests:** Is Context1 (internal knowledge base) being retrieved and cited?

**How it works:**
- Ask question that should hit Context1
- Check audit trail for context retrieval event
- Verify response cites the knowledge base

**Tests:**
- `test_context1_retrieval`: Context retrieved & logged (60s)
- `test_context_citation`: Response cites source (60s)
- `test_context_freshness`: Knowledge base has recent project info (60s)

---

### Tier 5: Web Search (Live Data)

**What it tests:** Does web_search actually return current 2026 data, not hallucination?

**How it works:**
- Ask about something definitely not in training data (April 2026 events)
- Check response includes:
  - URLs (proof of search)
  - 2026 dates (proof of recency)
  - Specific findings (not generic knowledge)

**Tests:**
- `test_web_search_current_events`: April 2026 benchmarks (90s)
- `test_web_search_specific_urls`: Domain-specific scraping (90s)
- `test_web_search_fallback_handling`: Graceful degradation if empty (90s)
- `test_web_search_integration_full`: Multi-step research workflow (120s)

---

### Tier 6: Hallucination Detection (Safety)

**What it tests:** Does agent refuse to fabricate data, or admit uncertainty?

**How it works:**
- Ask for impossible/nonexistent data (e.g., "Neuro's Series A funding details")
- Check that response:
  - Does NOT contain fabricated numbers
  - Does NOT claim confidence in made-up data
  - DOES acknowledge uncertainty/unavailability

**Tests:**
- `test_refuse_fabrication`: Refuses to make up funding data (30s)
- `test_confidence_calibration`: Rates confidence (high/medium/low) accurately (60s)
- `test_knowledge_boundaries`: Acknowledges training data cutoff (60s)

---

### Tier 7: Full Cycle Integration

**What it tests:** Do all components work together end-to-end?

**Tests:**
- `test_full_cycle_simple`: 1 tool, fast model, 30s (45s)
- `test_full_cycle_standard`: 2-3 tools, 4b model, context, 60s (90s)
- `test_full_cycle_complex`: 4+ tools, 9b model, web + context, synthesis (180s)

---

## Interpreting Results

### Sample Output

```
═══════════════════════════════════════════════════════════════════
  🧠 Neuro Benchmark Report
═══════════════════════════════════════════════════════════════════

SUMMARY: 23/25 tests passed (92%)

TIER 1: VERIFICATION (3/3 passed) ✅
  ✓ test_token_write_read_simple     [0.8b]  8.2s
  ✓ test_token_write_read_standard   [4b]    12.5s
  ✓ test_token_write_read_complex    [9b]    18.3s

TIER 2: MODEL ROUTING (4/4 passed) ✅
  ✓ test_model_routing_simple        [0.8b]  4.1s
  ✓ test_model_routing_standard      [4b]    15.3s
  ✓ test_model_routing_quality       [9b]    28.5s
  ✓ test_model_routing_maximum       [27b]   45.2s

TIER 3: MULTI-STEP (3/3 passed) ✅
  ✓ test_threestep_sequential        3 tools 22.1s
  ✓ test_fourfold_dependency         4 tools 35.8s
  ✓ test_conditional_branching       3 tools 19.4s

TIER 4: CONTEXT (3/3 passed) ✅
  ✓ test_context1_retrieval          context 28.3s
  ✓ test_context_citation            cited   24.1s
  ✓ test_context_freshness           recent  21.5s

TIER 5: WEB SEARCH (3/4 passed) ⚠️
  ✓ test_web_search_current_events   2026    42.1s
  ✓ test_web_search_specific_urls    urls    38.5s
  ✗ test_web_search_fallback_handling         [TIMEOUT 90s]
  ✓ test_web_search_integration_full multi    68.3s

TIER 6: HALLUCINATION (3/3 passed) ✅
  ✓ test_refuse_fabrication          refused 8.5s
  ✓ test_confidence_calibration      rated   15.2s
  ✓ test_knowledge_boundaries        cutoff  12.1s

TIER 7: FULL CYCLE (3/4 passed) ⚠️
  ✓ test_full_cycle_simple           simple  18.5s
  ✓ test_full_cycle_standard         medium  52.3s
  ✗ test_full_cycle_complex          complex [FAILED: missing web data]


ARCHITECTURE VALIDATION:
  ✅ Real execution proven (3/3 token tests)
  ✅ Model routing working (4/4 routing tests)
  ✅ Multi-step reasoning (3/3 reasoning tests)
  ✅ Context integration (3/3 context tests)
  ⚠️  Web search (3/4 tests - check Wayfarer)
  ✅ Hallucination safety (3/3 tests)
  ⚠️  Full cycle (3/4 tests - 1 timeout, investigate)

OVERALL: ✅ ARCHITECTURE SOUND (23/25 passing)
  → Ready for: Tool calling, multi-step reasoning, context retrieval
  → Needs investigation: Web search timeout, complex cycle slowness
```

### Interpretation

**✅ Green (passing):** Architecture component is working correctly

**⚠️ Yellow (failing):** Component needs investigation:
- Check if Wayfarer is running (web_search tests)
- Check if models are loaded (routing tests)
- Check timeout settings (full cycle tests)
- Check network connectivity (context tests)

**❌ Red (critical failing):** Architecture broken, requires fixes

### Pass Thresholds

```
≥20/25 (80%) → Architecture is production-ready
  - Can deploy for real tool calling
  - Can rely on model routing
  - Can use for agentic loops

15-19/25 (60-76%) → Architecture mostly works
  - Core components solid
  - Some subsystems need fixes
  - Not ready for production

<15/25 (<60%) → Major issues
  - Core problem preventing operation
  - Requires debugging/fixes
```

---

## Troubleshooting

### "Network error: timeout"
**Cause:** Infrastructure URL pointing to wrong machine

**Fix:**
```bash
# Check where it's connecting
curl -v http://localhost:11434/api/tags

# If this fails, Ollama isn't running locally
# Start it: ollama serve

# Or use remote if Ollama is down locally:
export VITE_INFRASTRUCTURE_MODE=remote
./run-benchmark.sh
```

### "Model not available"
**Cause:** Model not pulled yet

**Fix:**
```bash
ollama pull qwen3.5:4b  # Pull missing model
ollama list             # Verify it's available
./run-benchmark.sh      # Retry
```

### "web_search returning empty"
**Cause:** Wayfarer not running or SearXNG not available

**Fix:**
```bash
# Check Wayfarer
curl http://localhost:8889/health

# Check SearXNG
curl http://localhost:8888/healthz

# If either fails, restart:
# Terminal 2: wayfarer_server
# Terminal 3: docker-compose up -d
```

### "Test timeout after 90s"
**Cause:** Slow inference (usually first test on cold model)

**Fix:**
- This is normal for first run (model loads into VRAM)
- Subsequent tests are faster
- If all tests timeout, check:
  - Model is actually loaded: `ollama list`
  - System has enough RAM: `free -h` or `vm_stat` (macOS)
  - No other processes hogging GPU

### "Context retrieval not logged"
**Cause:** Context1 model not loaded, or context search disabled

**Fix:**
```bash
# Make sure context1 model exists
ollama pull chromadb-context-1:latest

# Check model is available
ollama list | grep context
```

---

## Next Steps (After Benchmark Passes)

### If all 25/25 tests pass:
1. ✅ Tool calling works → Deploy CLI with tool support
2. ✅ Model routing works → Can use tier system for different tasks
3. ✅ Multi-step reasoning → Can build agentic loops
4. ✅ Context integration → Can add knowledge base features
5. ✅ Web search → Can do real-time research
6. ✅ Hallucination safety → Can trust agent to refuse bad data
7. ✅ Full cycle → All components integrated properly

**Next milestone:** Build self-improvement loop (agent learns from cycles)

### If 20-24/25 pass:
1. Investigate failing tests
2. Fix root cause (usually infrastructure or model)
3. Re-run full suite
4. Once ≥20 pass, architecture is solid → Move forward

### If <20/25 pass:
1. Check infrastructure (all services running?)
2. Check logs (any error messages in services?)
3. Check network (localhost accessible?)
4. Check models (all required ones pulled?)
5. Reach out with benchmark report

---

## Files Created

```
BENCHMARK_ARCHITECTURE.md      - Complete design & validation criteria
BENCHMARK_TESTS.md             - Detailed test implementations (Tier 1-7)
BENCHMARK_QUICKSTART.md        - This file
run-benchmark.sh               - Executable benchmark runner
```

## Configuration Files Modified

```
frontend/config/infrastructure.ts  - Fixed to check VITE_INFRASTRUCTURE_MODE env var
.env.example                       - Updated with infrastructure mode docs
```

---

## Design Philosophy

The benchmark is designed to **prove the architecture works**, not just check if responses look plausible:

- **Verification tests** prove tools execute (not hallucinated)
- **Routing tests** prove correct model selection
- **Multi-step tests** prove tool chaining works
- **Context tests** prove knowledge base integration
- **Web search tests** prove live data retrieval (not knowledge)
- **Hallucination tests** prove safety constraints
- **Full cycle tests** prove all components together

**Why this matters:** Previous benchmark checked "Does response look good?" This one checks "Can the agent actually do what we're asking?"

---

That's it! You now have a complete, scientifically-sound benchmark for validating Neuro as a production-ready agentic harness.

Ready to run?

```bash
./run-benchmark.sh
```

