# NEURO: Master Plan
## Making the Best Local AI Tool-Calling Harness

---

## Vision

**Neuro is not a product. Neuro is a harness.**

It's the bulletproof foundation for agentic AI systems that:
- ✅ Actually execute tools (proven, not hallucinated)
- ✅ Route to correct models (task complexity → capability matching)
- ✅ Chain tools with dependencies (multi-step reasoning)
- ✅ Integrate knowledge bases (Context1)
- ✅ Search live data (Wayfarer → real current info)
- ✅ Refuse to fabricate (safety built-in)
- ✅ Self-improve (test → identify gaps → add tools → rewrite code)

Everything else (mass research, creative strategist, brand analysis, model monitoring) is **built ON TOP** of this harness.

---

## Phase 0: Prove It Works (THIS PHASE - Foundation)

### Goal
Make sure Neuro can actually do what it claims. Not "the code looks like it should work." Actually work.

### Milestones

#### 0.1: Real Benchmark Execution ✅ DESIGNED (NOT RUN YET)
**What:** Run the 25-test suite and prove ≥20/25 pass

**Why:**
- Previous benchmark was fake (checked "does response look good?" not "did tool actually run?")
- Need REAL proof: tokens, URLs, tool chains, context retrieval all verified

**How:**
```
1. Start all 3 services locally (Ollama, Wayfarer, SearXNG)
2. Run ./run-benchmark.sh (full 25-test suite)
3. Target: ≥20/25 passing
4. Capture audit trail, timing, model selection for each test
5. Generate report: BENCHMARK_REPORT.json
```

**Blockers to resolve:**
- [ ] Ollama models all pulled? (0.8b, 2b, 4b, 9b, 27b, context-1)
- [ ] Wayfarer running? (localhost:8889)
- [ ] SearXNG running? (localhost:8888)
- [ ] Infrastructure mode correct? (VITE_INFRASTRUCTURE_MODE=local)

**Output:**
- `BENCHMARK_REPORT.json` — Pass/fail per test, timing, audit trail
- `BENCHMARK_ANALYSIS.md` — What works, what needs fixing

---

#### 0.2: CLI Polish & Logging System
**What:** Make the CLI actually usable and debuggable

**Problem:**
- No structured logs (hard to debug failures)
- No error recovery (crashes lose context)
- No progress reporting (black box during execution)
- No result storage (can't review what happened)

**Implementation:**

```
Directory: frontend/cli/
├── cli.ts (EXISTING - entry point, mostly working)
├── cliLogger.ts (NEW - structured logging)
├── cliReporter.ts (NEW - progress + final report)
├── cliState.ts (NEW - persist execution state)
└── cliErrorHandler.ts (NEW - recovery logic)
```

**Features:**

1. **Structured Logging**
   ```typescript
   // cliLogger.ts
   interface LogEntry {
     timestamp: ISO8601;
     level: 'debug' | 'info' | 'warn' | 'error';
     component: string;
     message: string;
     metadata?: Record<string, any>;
     stack?: string;
   }

   // Writes to: ~/.claude/neuro_logs/{timestamp}.jsonl
   // Also: stdout (pretty formatted)
   ```

2. **Live Progress Reporting**
   ```
   [00:12] [RESEARCH] Reading market data... (45s elapsed)
   [00:45] [SEARCH] Querying competitors (3 parallel) ▓▓▓░░ 60%
   [01:22] [SYNTHESIS] Building analysis...
   ```

3. **Result Persistence**
   ```
   ~/.claude/neuro_runs/{timestamp}/
   ├── run.json (metadata: model, task, duration, pass/fail)
   ├── transcript.jsonl (full conversation + tool calls)
   ├── audit.json (infrastructure, timing, tokens)
   └── output.md (final response)
   ```

4. **Error Recovery**
   - Catch crashes mid-execution
   - Save checkpoint before risky operations
   - Auto-resume from checkpoint on restart
   - Report what failed and why

**Timeline:** 3-4 hours (mostly boilerplate + file I/O)

**Success:** Can run CLI, crash it, restart, see full history + resume capability

---

#### 0.3: Infrastructure Validation
**What:** Prove local infrastructure is solid, no hidden network calls

**Current Setup:**
```
Ollama:    localhost:11434 (Local)
Wayfarer:  localhost:8889 (Local)
SearXNG:   localhost:8888 (Docker, Local)
Context1:  qwen3.5 model in Ollama (Local)
```

**Validation Script:**
```bash
#!/bin/bash
# neuro-infrastructure-check.sh

echo "🌍 Infrastructure Check"
echo ""

# 1. Service connectivity
check_service() {
  local name=$1
  local host=$2
  local port=$3

  if nc -z $host $port 2>/dev/null; then
    echo "✓ $name ($host:$port)"
  else
    echo "✗ $name OFFLINE"
  fi
}

check_service "Ollama" localhost 11434
check_service "Wayfarer" localhost 8889
check_service "SearXNG" localhost 8888

# 2. Model availability
echo ""
echo "📦 Models:"
curl -s http://localhost:11434/api/tags | jq '.models[] | .name'

# 3. Network isolation check
echo ""
echo "🔒 Network Isolation:"
# Should NOT see any 100.74.135.83 connections
netstat -an | grep 100.74.135 && echo "⚠️  Found remote connections!" || echo "✓ No remote connections"

# 4. Feature check
echo ""
echo "✨ Features:"
curl -s http://localhost:8889/health && echo "✓ Wayfarer" || echo "✗ Wayfarer"
curl -s http://localhost:8888/healthz && echo "✓ SearXNG" || echo "✗ SearXNG"
```

**Output:**
- `INFRASTRUCTURE_CHECK.json` — status of all services
- Alert if any unexpected remote calls detected

---

#### 0.4: Codebase Cleanup
**What:** Remove dead code, organize structure, reduce confusion

**Current Issues:**
```
frontend/utils/
├── agentEngine.ts (6448 lines - HUGE, monolithic)
├── researchAgents.ts
├── ollama.ts
├── wayfarer.ts
├── subagentManager.ts
├── subagentRoles.ts
├── subagentTools.ts
└── [15 more files...]

Components scattered across:
├── StagePanel.tsx
├── ResearchOutput.tsx
├── ThinkingModal.tsx
├── AgentUIWrapper.tsx
└── [various orphaned components...]
```

**Reorganization:**

```
frontend/
├── core/
│   ├── agentEngine.ts (keep, but break into modules)
│   ├── agentEngine.types.ts (types)
│   ├── agentEngine.tools.ts (tool execution logic)
│   ├── agentEngine.models.ts (model routing)
│   ├── agentEngine.loop.ts (ReAct loop)
│   └── agentEngine.audit.ts (audit trail)
├── infrastructure/
│   ├── ollama.ts (LLM service)
│   ├── wayfarer.ts (web search)
│   ├── searxng.ts (meta search)
│   ├── context1.ts (knowledge base)
│   └── healthMonitor.ts (service health)
├── agentic/
│   ├── subagentManager.ts
│   ├── subagentRoles.ts (observer, executor, synthesizer, etc.)
│   ├── subagentTools.ts
│   └── subagentReporting.ts (NEW)
├── cli/
│   ├── cli.ts (entry point)
│   ├── cliLogger.ts (NEW)
│   ├── cliReporter.ts (NEW)
│   ├── cliState.ts (NEW)
│   └── cliErrorHandler.ts (NEW)
├── components/
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── CycleTimeline.tsx
│   │   └── StagePanel.tsx
│   ├── research/
│   │   ├── ResearchOutput.tsx
│   │   └── ResearchProgress.tsx
│   ├── agent/
│   │   ├── AgentUIWrapper.tsx
│   │   ├── AgentStep.tsx
│   │   ├── ThinkingModal.tsx
│   │   └── AgentReporting.tsx (NEW)
│   └── shared/
│       ├── ActivityBar.tsx
│       └── HealthStatus.tsx
└── config/
    ├── infrastructure.ts (FIXED)
    ├── modelConfig.ts
    └── constants.ts (no module-level captures!)
```

**Cleanup Tasks:**

1. **Break agentEngine.ts into modules** (~1500 lines each, focused)
   - agentEngine.core.ts — ReAct loop, state machine
   - agentEngine.tools.ts — Tool execution, result handling
   - agentEngine.models.ts — Model selection, routing
   - agentEngine.audit.ts — Tracking, timing, token counting

2. **Remove dead code**
   - Search for: `// OLD`, `// UNUSED`, `TODO:`, `DEPRECATED`
   - Remove unused imports
   - Delete orphaned test files

3. **Organize components** by feature (dashboard, research, agent, shared)

4. **Create index.ts files** for clean imports
   ```typescript
   // frontend/core/index.ts
   export { AgentEngine } from './agentEngine.core';
   export { ToolExecutor } from './agentEngine.tools';
   export { ModelRouter } from './agentEngine.models';
   export type { AgentState, ToolCall } from './agentEngine.types';
   ```

**Timeline:** 6-8 hours

**Success Metric:**
- No circular imports
- Max file size: 2000 lines (preferably <1500)
- All exports documented
- Import chain clear (no magic)

---

### 0.5: Model Investigation
**What:** Evaluate new models, pick the best for each tier

**Current Setup:**
```
Tier 1 (Fast):     qwen3.5:0.8b, qwen3.5:2b
Tier 2 (Standard): qwen3.5:4b
Tier 3 (Quality):  qwen3.5:9b
Tier 4 (Maximum):  qwen3.5:27b
Knowledge:         chromadb-context-1:latest
```

**New Models to Evaluate:**

| Model | Size | VRAM | Strengths | Benchmark |
|-------|------|------|-----------|-----------|
| **Gemma 2 2B** | 2B | 4GB | Fast, good for simple | Tool use? |
| **Gemma 2 27B** | 27B | 32GB | High quality | vs Qwen 27b? |
| **Mixtral 8x7B** | 47B (MoE) | 20GB | Expert routing | Overkill? |
| **Upstage Solar** | 10.7B | 20GB | Strong reasoning | Latest from Upstage |
| **MassAgent** | (custom) | varies | Multi-agent ops | Investigate update |

**Evaluation Criteria:**

1. **Tool Use Performance**
   - Can it follow complex tool schemas?
   - Does it hallucinate tool calls?
   - How many retries before success?

2. **Context Window**
   - Can it handle 8K+ context for research tasks?
   - How does it handle long audit trails?

3. **Speed**
   - First-token latency (user experience)
   - Tokens-per-second (throughput)
   - VRAM footprint (can we run locally?)

4. **Reasoning**
   - Multi-step task success rate
   - Hallucination detection (refuses bad data)
   - Confidence calibration

**Approach:**

```bash
# Test each new model on subset of benchmark
for model in gemma2-2b, gemma2-27b, solar-10.7b; do
  ollama pull $model

  # Run 3 tests per model (verification, routing, websearch)
  npm run benchmark -- --model $model --test "verify,route,search"

  # Generate report: MODEL_EVAL_$model.json
done

# Compare: MODELS_COMPARISON.md
```

**Decision Framework:**
- If new model beats Qwen in 2+ categories → Consider swapping
- If new model matches Qwen but faster → Swap for cost/speed
- If new model matches Qwen → Keep Qwen (known working)

**Timeline:** 4-6 hours (mostly download + testing)

**Output:**
- `MODELS_COMPARISON.md` — Side-by-side evaluation
- Updated `modelConfig.ts` if we add new tiers

---

### 0.6: Self-Improvement Loop (Prototype)
**What:** Agent learns to identify missing capabilities and propose solutions

**Vision:**
1. Agent runs a task
2. Hits a limitation: "I can't do X"
3. Logs: "Need tool: image_analysis"
4. Next run, includes that tool
5. Over time: agent's capability set grows

**Phase 0 Implementation (Minimal):**

```typescript
// frontend/agentic/selfImprovement.ts

interface CapabilityGap {
  task: string;
  limitation: string;
  suggestedTool: string;
  evidence: string[];
}

class SelfImprovementEngine {
  // After each run, analyze for gaps
  async identifyGaps(auditTrail: AuditEntry[]): Promise<CapabilityGap[]> {
    // Parse model responses for patterns like:
    // "I cannot", "I don't have access to", "I would need"
    // Extract what's missing
  }

  // Store gaps in IndexedDB
  async persistGaps(gaps: CapabilityGap[]): Promise<void> {
    // ~/.claude/neuro_gaps.json
    // Cumulative list of all identified gaps
  }

  // Report top gaps
  async reportTopGaps(limit: number = 5): Promise<CapabilityGap[]> {
    // Most common gaps across all runs
  }
}
```

**Immediate Use:**
- After each run, identify what agent couldn't do
- Log to file: `~/.claude/neuro_gaps.json`
- Periodically review: "What should we add next?"

**Example Output:**
```json
{
  "gaps": [
    {
      "task": "brand_research",
      "limitation": "Cannot analyze competitor Instagram posts",
      "suggestedTool": "social_media_analyzer",
      "count": 3
    },
    {
      "task": "content_strategy",
      "limitation": "Cannot generate visual mockups",
      "suggestedTool": "figma_generator",
      "count": 2
    }
  ]
}
```

**Timeline:** 2-3 hours

**Success:** Agent identifies real capability gaps from execution

---

## Phase 1: Custom Use Case (Mass Research)
### Goal
Build the **first real utility** on top of Neuro harness

### Use Case: Mass Brand Research
**Input:** Brand name or URL
**Output:** Deep research report with:
- Brand positioning & history
- Audience analysis
- Competitor landscape
- Market gaps
- Recommended messaging angles

**Architecture:**
```
CLI: neuro research --brand "Typeform"
  ↓
brandResearchOrchestrator.ts (NEW)
  ├── Phase 1: Brand Discovery
  │   ├── Search brand history
  │   ├── Find founding info
  │   └── Map positioning evolution
  ├── Phase 2: Audience Analysis
  │   ├── Reddit/Twitter sentiment
  │   ├── User segments
  │   └── Pain points
  ├── Phase 3: Competitive Mapping
  │   ├── Direct competitors
  │   ├── Market positioning
  │   └── Feature comparison
  └── Phase 4: Synthesis
      └── Generate angles + report

Output: brand_research_{timestamp}.md
```

**Why This Use Case:**
- Proves Neuro can handle real multi-phase workflows
- Tests: web search, synthesis, report generation
- Foundation for future tools (creative strategist, statics analyzer)

**Timeline:** 8-12 hours (after Phase 0 complete)

---

## Phase 2: Agent Monitoring & Alerts (Optional Early)
### Goal
Agent watches for new models, alerts user

**Minimal Implementation:**
```typescript
// frontend/agentic/modelWatcher.ts

class ModelWatcher {
  // Every 6 hours, check for new Ollama models
  async checkNewModels(): Promise<string[]> {
    const current = await ollama.listModels();
    const previous = await storage.getLastModelList();
    const newModels = current.filter(m => !previous.includes(m));

    if (newModels.length > 0) {
      // Alert: "New models available: llama2-70b, mistral-7b"
      await alerts.send(`New models: ${newModels.join(', ')}`);
      await storage.saveModelList(current);
    }
  }
}

// Runs as background task (if harness is long-running)
// Or polls on each CLI run
```

**Alerts Sent To:**
- Console: "New model available: X"
- Log file: `~/.claude/neuro_alerts.log`
- Future: SMS/Slack (when integrated)

---

## Phase 3: Code Self-Improvement (Future)
### Goal
Agent can rewrite its own code to improve performance

**Not in Phase 0, but architecture to support it:**
- ✅ Audit trail tracks performance metrics
- ✅ Self-improvement engine identifies gaps
- ✅ Agent has code_edit tool (commented out for safety)
- ⚠️ Need: approval gates before code changes
- ⚠️ Need: test suite validates changes don't break

**When This Activates:**
- Agent identifies a gap
- Proposes code change
- Runs benchmark to validate
- If pass rate improves: auto-merge
- If same/worse: reject, try different approach

---

## Implementation Roadmap

```
PHASE 0: Foundation (1-2 weeks)
├─ 0.1: Run real benchmark ✅ DESIGNED
│  └─ Start: ./run-benchmark.sh
│  └─ Target: ≥20/25 pass
│  └─ Output: BENCHMARK_REPORT.json
│
├─ 0.2: CLI logging & reporting (3-4 hrs)
│  └─ Creates: cliLogger, cliReporter, cliState
│  └─ Output: ~/.claude/neuro_runs/{timestamp}/ + logs
│
├─ 0.3: Infrastructure validation (1 hr)
│  └─ Script: neuro-infrastructure-check.sh
│  └─ Output: INFRASTRUCTURE_CHECK.json
│
├─ 0.4: Codebase cleanup (6-8 hrs)
│  └─ Break agentEngine into modules
│  └─ Reorganize components by feature
│  └─ Remove dead code
│  └─ Output: Clean, readable codebase
│
├─ 0.5: Model investigation (4-6 hrs)
│  └─ Test: Gemma 2, Solar, MassAgent updates
│  └─ Decide: Keep Qwen or swap?
│  └─ Output: MODELS_COMPARISON.md
│
└─ 0.6: Self-improvement prototype (2-3 hrs)
   └─ Agent logs capability gaps
   └─ Output: ~/.claude/neuro_gaps.json

PHASE 1: First Custom Utility (1-2 weeks)
└─ Mass Brand Research tool
   ├─ Discovery → Audience → Competitive → Synthesis
   ├─ Multi-phase orchestration
   └─ Real proof it works end-to-end

PHASE 2: Monitoring (Optional)
└─ Model watcher alerts user to new releases

PHASE 3: Self-Improvement Loop (Future)
└─ Agent rewrites own code based on performance
```

---

## Success Criteria

### Phase 0 Complete When:
- ✅ Benchmark runs, ≥20/25 pass (REAL execution proven)
- ✅ CLI has structured logging + result storage
- ✅ Infrastructure check shows all services healthy
- ✅ Codebase is organized, no dead code
- ✅ Know which models to use (Qwen validated or swapped)
- ✅ Know what to build next (capability gaps identified)

### Phase 1 Complete When:
- ✅ `neuro research --brand "X"` produces a real research report
- ✅ Report includes positioning, audience, competitors, angles
- ✅ Multi-phase orchestration proven to work
- ✅ Ready to build on top of Neuro

### Overall Success:
**Neuro becomes "the best local AI tool-calling harness"**
- Real tool execution (proven)
- Correct model routing (proven)
- Multi-step reasoning (proven)
- Safe, refuses to hallucinate (proven)
- Self-improving (gaps identified)
- Custom tools easy to build (brand research example)

---

## Key Decisions Made

1. **Keep Qwen 3.5 family** — Proven working, good across tiers
2. **Keep Context1** — Knowledge base advantage
3. **Investigate but don't rush new models** — Only swap if clearly better
4. **Modular architecture** — Break agentEngine into manageable pieces
5. **Structured logging everywhere** — Debug infrastructure, not guessing
6. **Real benchmark first** — Prove it works before building on top
7. **Self-improvement optional early** — But log gaps for future use

---

## What NOT to Do (Yet)

❌ Build UI polish (focus on core harness)
❌ Integrate Vercel/deployment (premature optimization)
❌ Build Nomads ad tool (save for later when Neuro is proven)
❌ Add 50 new models (stick with proven tiers)
❌ Auto-rewrite code (too risky, test manually first)
❌ Deploy to production (local research only)

---

## Timeline Estimate

| Phase | Tasks | Time | Start | End |
|-------|-------|------|-------|-----|
| **0** | 6 subtasks | 18-24 hrs | Day 1 | Day 2-3 |
| **1** | Brand research tool | 8-12 hrs | Day 3 | Day 4-5 |
| **2** | Model watcher | 2-3 hrs | Day 5 | Day 5 |
| **3** | Self-improvement | 10-15 hrs | Day 6+ | Later |

**Total to "best harness":** ~30-35 hours of focused work

**Estimated completion:** This week (if focused)

---

## Next Step

**START PHASE 0.1: Run the benchmark**

```bash
cd /Users/mk/Downloads/nomads

# Prerequisites check
./run-benchmark.sh

# This will:
# 1. Verify Ollama/Wayfarer/SearXNG running
# 2. Check all required models loaded
# 3. Run 25 tests
# 4. Generate report
```

**When it's done:**
- We'll know what works and what doesn't
- We'll have real proof (not fake)
- We'll move to Phase 0.2 (CLI polish) with confidence

---

## Ownership

**This is YOUR harness, YOUR vision.**

I'm implementing YOUR requirements:
- ✅ Neuro = best local tool-calling harness
- ✅ Real proof it works (benchmark)
- ✅ Clean, organized codebase
- ✅ Foundation for custom tools
- ✅ Self-improving over time

Ready?

