# NEURO: Action Plan
## Immediate Next Steps (What to Do Right Now)

---

## Current State

✅ **DONE (Designed, Not Implemented)**
- New benchmark architecture (measures tool calls, model switches, decisions)
- CLI fixes & unlocking (logging, error handling, health checks)
- Integration patterns from best frameworks (MassGen, AutoGen, LangGraph)
- Parallel agent infrastructure (2-3x faster execution)

---

## Phase 1: Prove the Foundation (This Week)
### Goal: Make Neuro "the best local harness"

#### 1.1: CLI Health & Unlocking (4-6 hours)
**What:** Fix CLI so it's not locked, add transparency

Files to create:
- `frontend/cli/cliHealthCheck.ts` — Service connectivity
- `frontend/cli/cliInfrastructureTest.ts` — Mode switching
- `frontend/cli/cliModelSwitchTest.ts` — Model routing (light)
- `frontend/cli/cliErrorHandler.ts` — Error recovery
- `frontend/cli/cliState.ts` — Session persistence
- `frontend/cli/cliLogger.ts` — JSONL logging

**Success:** Can run CLI, see what's happening, restart if it crashes

```bash
npm run cli:health-check
npm run cli:infrastructure-test
npm run cli:model-switch-test
```

---

#### 1.2: Implement Architecture Benchmark (6-8 hours)
**What:** Test system behavior, not response quality

Create: `frontend/cli/architectureBenchmark.ts`

**Tests:**
1. Tool Call Multiplicity (≥2 tools)
2. Model Switching (≥2 models)
3. Explicit Routing Decisions (≥1 logged)
4. Parallel Agent Execution (timestamps overlap)
5. Sub-Agent Spawning (Trace Analyzer)
6. Loop Detection (graceful escalation)

**Success:** Can run benchmark, get 5/6 PASS

```bash
./run-architecture-benchmark.sh
# Output: ARCHITECTURE_REPORT.json
```

---

#### 1.3: Integrate Framework Patterns (8-10 hours)
**What:** Steal best practices from MassGen, AutoGen, LangGraph

Create:
- `frontend/agentic/traceAnalyzer.ts` (MassGen pattern)
- `frontend/agentic/routingDecisions.ts` (LangGraph pattern)
- `frontend/agentic/messageHandlers.ts` (AutoGen pattern)
- `frontend/agentic/modelRouter.ts` (OpenRouter pattern)
- `frontend/agentic/loopDetection.ts` (2026 safety)

**Success:** Each pattern integrated, tested in isolation

```bash
npm test -- agentic/  # Run all integration tests
```

---

#### 1.4: Parallel Execution (4-5 hours)
**What:** Run multiple agents/stages at same time

Create:
- `frontend/utils/parallelResearch.ts`
- `frontend/agentic/parallelSubagents.ts`
- `frontend/utils/parallelTools.ts`
- `frontend/utils/abortController.ts`

Modify:
- `frontend/hooks/useCycleLoop.ts` — Use Promise.all() for stages

**Success:** Cycle runs 2-3x faster, benchmark shows parallelism

---

## Phase 2: Deploy Research Agents (Week 2)
### Goal: First real utility working end-to-end

#### 2.1: Mass Brand Research Tool
**What:** `neuro research --brand "Typeform"`

Creates:
- Brand discovery (history, positioning)
- Audience analysis (segments, pain points)
- Competitive mapping (positioning, features)
- Synthesis (angles, recommendations)

**Success:** Can run tool, get structured research report

```bash
neuro research --brand "Typeform" --output research_report.md
```

---

## Files to Create/Modify

### New Files (Total: ~25 files)

**CLI Layer (6 files)**
```
frontend/cli/
├── cliHealthCheck.ts
├── cliInfrastructureTest.ts
├── cliModelSwitchTest.ts
├── cliErrorHandler.ts
├── cliState.ts
└── cliLogger.ts
```

**Benchmark (1 file)**
```
frontend/cli/
└── architectureBenchmark.ts
```

**Agentic Patterns (5 files)**
```
frontend/agentic/
├── traceAnalyzer.ts
├── routingDecisions.ts
├── messageHandlers.ts
├── modelRouter.ts
└── loopDetection.ts
```

**Parallel Execution (4 files)**
```
frontend/utils/
├── parallelResearch.ts
└── abortController.ts

frontend/agentic/
├── parallelSubagents.ts
└── (parallelTools.ts via utils)
```

**Use Cases (3+ files)**
```
frontend/tools/
├── brandResearch.ts
├── brandResearchOrchestrator.ts
└── brandResearchReporter.ts
```

**Scripts (1 file)**
```
run-architecture-benchmark.sh
```

### Modified Files (6 files)

```
frontend/cli.ts                      (wire in health checks)
frontend/config/infrastructure.ts    (already fixed ✅)
frontend/utils/modelConfig.ts        (safe exports for CLI)
frontend/hooks/useCycleLoop.ts       (add Promise.all parallelism)
frontend/utils/researchAgents.ts     (expose for parallel)
.env.example                         (already updated ✅)
```

---

## Timeline

| Phase | Work | Time | Days |
|-------|------|------|------|
| **1.1** | CLI Fixes | 4-6h | 0.5-1 |
| **1.2** | Architecture Benchmark | 6-8h | 1 |
| **1.3** | Integration Patterns | 8-10h | 1-1.5 |
| **1.4** | Parallel Execution | 4-5h | 0.5-1 |
| **2.1** | Brand Research Tool | 8-12h | 1-2 |
| **Testing & Polish** | End-to-end | 4-6h | 0.5-1 |
| **TOTAL** | **30-47h** | **4-6 days** |

---

## Success Criteria

### Phase 1 (This Week)
```
✅ CLI runs without crashing
✅ Can see what's happening (logs)
✅ Architecture benchmark: 5/6 PASS
✅ Tool calls visible in audit trail
✅ Model switches visible in audit trail
✅ Routing decisions logged
✅ Parallel execution proven (timestamps overlap)
✅ Sub-agents spawning & working
✅ Cycle time reduced 2-3x

RESULT: "Neuro is the best local harness for tool-calling"
```

### Phase 2 (Week 2)
```
✅ neuro research --brand works
✅ Returns structured report (discovery, audience, competitive, synthesis)
✅ All 3 research phases run in parallel
✅ Trace Analyzer extracts insights
✅ Report saved to file

RESULT: First real utility proven end-to-end
```

---

## Documentation Already Created

You now have comprehensive docs for:

1. **ARCHITECTURE_BENCHMARK.md** — New benchmark design (6 tests)
2. **CLI_FIXES.md** — How to fix & unlock CLI
3. **INTEGRATION_PATTERNS.md** — Steal from frameworks
4. **PARALLEL_AGENTS.md** — Make it 2-3x faster
5. **NEURO_MASTER_PLAN.md** — Overall vision
6. **BENCHMARK_ARCHITECTURE.md** — Old benchmark (reference)
7. **BENCHMARK_QUICKSTART.md** — Old benchmark setup

**All code snippets are copy-paste ready. Just need to wire them together.**

---

## What I'm NOT Doing (You'll Do Later)

❌ Nomads ad tool (save for when Neuro is proven)
❌ Vercel deployment (not yet)
❌ UI prettification (focus on core)
❌ Auto-code-rewriting (too risky, test manually first)
❌ Production hardening (get working first)
❌ Full test suite (once architecture locked)

---

## What You Do Now

1. **Read** the 4 main docs (30 min)
   - ARCHITECTURE_BENCHMARK.md
   - CLI_FIXES.md
   - INTEGRATION_PATTERNS.md
   - PARALLEL_AGENTS.md

2. **Approve** the approach (10 min)
   - Does this align with your vision?
   - Want any changes?

3. **I'll implement** Phase 1.1 (CLI fixes) (6 hours)
   - You can watch/guide as needed
   - Or I can work autonomously

4. **Test** Phase 1.2 (Architecture benchmark) (1-2 hours)
   - Run it, see what works/breaks
   - Fix issues as they come up

5. **Iterate** through 1.3 & 1.4 (1-2 weeks)
   - Each pattern tested
   - Each integration verified

---

## Key Differences from Old Plan

| Old | New |
|-----|-----|
| Benchmark measured response quality | Measures architectural behavior |
| One response block = pass | One tool call = FAIL |
| Hard to fake passing tests | Impossible to fake (audited) |
| CLI mysterious (no logs) | CLI fully transparent |
| Sequential execution (slow) | Parallel execution (2-3x faster) |
| Patterns scattered | Patterns organized + documented |

---

## Bottom Line

**Neuro will be:**
- ✅ Fastest local harness (parallel execution)
- ✅ Most transparent (logged decisions)
- ✅ Proven to work (architectural benchmark)
- ✅ Most reliable (error handling, loop detection)
- ✅ Best patterns (stolen from enterprises)
- ✅ Ready for custom tools (brand research example)

**Then you build:**
- Creative strategist
- Statics analyzer
- Model monitor
- Self-improving loop
- Whatever else you want

**All on proven foundation.**

---

## Next Step

**You decide:**

**Option A: I start implementing Phase 1.1 immediately**
- I build CLI fixes & logging infrastructure
- Takes ~6 hours
- You can watch/guide or hands-off

**Option B: You review docs first**
- Take 30 min to read the 4 docs
- Give feedback/changes
- Then I implement

**Option C: Something else entirely**
- You have a different vision
- Tell me, I'll adjust plan

What's your preference?

