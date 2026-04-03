# Neuro Architecture Benchmark (v2)
## Test What the System DOES, Not What It SAYS

---

## Core Philosophy

**Old Benchmark:** "Is the response good?"
```
❌ One response block
❌ Checks response quality
❌ Fake passing (response looks plausible, no real tool use)
```

**New Benchmark:** "Does the system work?"
```
✅ Multiple tool calls
✅ Model switching
✅ Explicit routing decisions
✅ Parallel agent execution
✅ Architectural choices logged
```

**FAIL CONDITION:** If it produces one response block, even if perfect, test FAILS.

**PASS CONDITION:** If system demonstrates:
1. ≥2 tool calls (not 0 or 1)
2. ≥1 model switch (proven by audit trail)
3. ≥1 explicit routing decision logged
4. ≥1 parallel agent coordination
5. ≥1 sub-agent spawned (Trace Analyzer, Manager, etc.)

---

## Test Design

### Test 1: Tool Call Multiplicity
**What it measures:** Does agent call multiple tools?

**Test Query:**
```
"Research TypeScript agent frameworks and create a competitive matrix.
Show your work: list each search, each URL read, each analysis step."
```

**Success Criteria:**
```
Tool calls tracked:
✓ web_search called ≥2 times (different queries)
✓ file_write called ≥1 time (for matrix)
✓ file_read called ≥1 time (to reference previous work)

FAIL: If only 1 tool called OR all calls are to same tool
FAIL: If no tools called at all
```

**Audit Output Required:**
```json
{
  "toolCalls": [
    { "tool": "web_search", "input": "TypeScript agent frameworks 2026", "timestamp": "00:05" },
    { "tool": "web_search", "input": "LLM orchestration patterns", "timestamp": "00:18" },
    { "tool": "file_write", "path": "/tmp/matrix.md", "timestamp": "00:35" },
    { "tool": "file_read", "path": "/tmp/matrix.md", "timestamp": "00:42" }
  ],
  "toolCount": 4,
  "uniqueTools": 3
}
```

---

### Test 2: Model Switching
**What it measures:** Does system switch models for different complexity levels?

**Test Query (explicitly staged complexity):**
```
"1. SIMPLE: What is 2 + 2? (use fastest model)
2. STANDARD: Analyze market trends (use medium model)
3. COMPLEX: Design go-to-market strategy (use best model)

Log which model you use for each subtask."
```

**Success Criteria:**
```
Model assignments proven:
✓ Step 1 uses: qwen3.5:0.8b OR qwen3.5:2b (fast)
✓ Step 2 uses: qwen3.5:4b (standard)
✓ Step 3 uses: qwen3.5:9b OR qwen3.5:27b (quality)
✓ At least 2 different models used

FAIL: If same model used for all steps
FAIL: If model doesn't match complexity level
```

**Audit Output Required:**
```json
{
  "modelSwitches": [
    { "step": 1, "model": "qwen3.5:0.8b", "complexity": "simple", "timestamp": "00:02" },
    { "step": 2, "model": "qwen3.5:4b", "complexity": "standard", "timestamp": "00:15" },
    { "step": 3, "model": "qwen3.5:27b", "complexity": "complex", "timestamp": "00:45" }
  ],
  "uniqueModels": 3,
  "correctTiering": true
}
```

---

### Test 3: Explicit Routing Decisions
**What it measures:** Does system log WHY it makes architectural choices?

**Test Query:**
```
"You have this task: [complex brand research]

Before starting, decide:
1. Is this a research task or analysis task? (DECISION)
2. Which stage comes first? (DECISION)
3. Should you parallelize searches? (DECISION)

Show me your explicit decisions and reasoning."
```

**Success Criteria:**
```
Routing decisions logged:
✓ Decision 1: "This is RESEARCH_TASK (confidence: 0.95)"
✓ Decision 2: "Route to ORCHESTRATOR_STAGE"
✓ Decision 3: "Enable parallel=true for 5 researchers"

Each decision must include:
  - Decision statement (not just thinking)
  - Confidence score
  - Reasoning (1-2 sentences)
  - Timestamp

FAIL: If only thinking (no explicit decision logged)
FAIL: If decisions not timestamped
```

**Audit Output Required:**
```json
{
  "routingDecisions": [
    {
      "decision": "TASK_CLASSIFICATION",
      "value": "RESEARCH_TASK",
      "confidence": 0.95,
      "reasoning": "Complex brand analysis requires web search + synthesis",
      "timestamp": "00:03"
    },
    {
      "decision": "STAGE_SELECTION",
      "value": "ORCHESTRATOR_RESEARCH",
      "confidence": 0.88,
      "reasoning": "Multi-phase research needs coordination layer",
      "timestamp": "00:05"
    },
    {
      "decision": "PARALLELIZATION",
      "value": true,
      "parallelAgents": 5,
      "reasoning": "Competitive + audience + market data can be researched in parallel",
      "timestamp": "00:08"
    }
  ],
  "decisionsLogged": 3
}
```

---

### Test 4: Parallel Agent Coordination
**What it measures:** Can system run multiple agents at same time?

**Test Query:**
```
"Research 3 competitors in parallel:
- Agent 1: Research Competitor A
- Agent 2: Research Competitor B
- Agent 3: Research Competitor C

All 3 must run at the same time (not sequentially).
Show timestamps proving parallelism."
```

**Success Criteria:**
```
Parallelism proven by timestamps:
✓ Agent 1 starts: 00:00
✓ Agent 2 starts: 00:01 (within 1s of Agent 1, parallel)
✓ Agent 3 starts: 00:02 (within 1s of Agent 1, parallel)
✓ All agents finish at similar times (overlap visible)

FAIL: If agents start sequentially (A finishes, then B starts)
FAIL: If only 1 agent active at a time
```

**Audit Output Required:**
```json
{
  "parallelAgents": [
    {
      "agent": "research_competitor_a",
      "startTime": "00:00",
      "endTime": "00:45",
      "duration": "45s"
    },
    {
      "agent": "research_competitor_b",
      "startTime": "00:01",
      "endTime": "00:46",
      "duration": "45s"
    },
    {
      "agent": "research_competitor_c",
      "startTime": "00:02",
      "endTime": "00:47",
      "duration": "45s"
    }
  ],
  "parallelismProven": true,
  "overlapDuration": "43s"
}
```

---

### Test 5: Sub-Agent Spawning (Trace Analyzer)
**What it measures:** Does system spawn background agents for insights?

**Test Query:**
```
"Research the market. After research completes, spawn a 'Trace Analyzer' agent
that extracts insights about:
- What was researched?
- What gaps remain?
- What patterns emerged?

Show me the insights extracted."
```

**Success Criteria:**
```
Sub-agent spawned:
✓ Trace Analyzer spawned after research stage
✓ Analyzes research audit trail
✓ Extracts insights (not just repeating input)
✓ Writes findings to persistent storage

Insights extracted must include:
  - Gaps identified (specific missing info)
  - Patterns found (recurring themes)
  - Recommendations (what to research next)

FAIL: If Trace Analyzer not spawned
FAIL: If insights are generic/templated
```

**Audit Output Required:**
```json
{
  "subAgents": [
    {
      "type": "trace_analyzer",
      "spawned": "00:45",
      "completed": "00:50",
      "duration": "5s",
      "insights": {
        "gaps": [
          "Pricing strategy not found for Competitor B",
          "Social media presence data incomplete"
        ],
        "patterns": [
          "All 3 competitors focus on developer experience",
          "Price range clusters around $10-50/month"
        ],
        "recommendations": [
          "Search for Competitor B pricing models",
          "Analyze competitor social channels for messaging"
        ]
      }
    }
  ],
  "subAgentCount": 1
}
```

---

### Test 6: Loop Detection & Escalation
**What it measures:** Does system detect and escalate when stuck?

**Test Query:**
```
"Research brand positioning. If you get stuck or loop, escalate to manager.
Manager should make a tie-breaking decision."
```

**Success Criteria:**
```
Loop detection proven:
✓ After iteration N, detect state hash unchanged
✓ Flag as potential loop (with proof)
✓ Spawn Manager Agent in escalation mode
✓ Manager makes tie-breaking decision
✓ Continue with new direction

Math-based proof required:
  - state_hash_iter_1: abc123
  - state_hash_iter_2: abc123 (SAME = loop)
  - Loop proven at iteration 2
  - Escalate to manager

FAIL: If only "I think I'm looping" without hash proof
FAIL: If no escalation happens
```

**Audit Output Required:**
```json
{
  "loopDetection": {
    "detected": true,
    "iteration": 3,
    "proof": {
      "stateHash_iter1": "abc123def456",
      "stateHash_iter2": "xyz789ghi012",
      "stateHash_iter3": "abc123def456",
      "loopingStateHash": "abc123def456"
    },
    "escalated": true,
    "escalationTimestamp": "00:30",
    "managerDecision": "Pivot to competitor research (different angle)"
  }
}
```

---

## Benchmark Execution

### Run Command
```bash
./run-architecture-benchmark.sh
```

### What Happens
```
1. Start all 3 services (Ollama, Wayfarer, SearXNG)
2. Run Test 1: Tool Call Multiplicity (2 min)
3. Run Test 2: Model Switching (3 min)
4. Run Test 3: Routing Decisions (2 min)
5. Run Test 4: Parallel Coordination (5 min)
6. Run Test 5: Sub-Agent Spawning (3 min)
7. Run Test 6: Loop Detection (3 min)

Total: ~18 minutes
```

### Output Report
```
NEURO ARCHITECTURE BENCHMARK REPORT
===================================

TEST 1: Tool Call Multiplicity
Result: ✅ PASS
  Tool calls: 4 (need ≥2)
  Unique tools: 3 (need ≥1)
  Details: web_search×2, file_write×1, file_read×1

TEST 2: Model Switching
Result: ✅ PASS
  Models used: 3 (0.8b, 4b, 27b)
  Correct tiering: YES
  Switches: 2 (0.8b→4b at 00:15, 4b→27b at 00:45)

TEST 3: Routing Decisions
Result: ✅ PASS
  Decisions logged: 3
  Confidence avg: 0.92
  All timestamped: YES

TEST 4: Parallel Agents
Result: ✅ PASS
  Agents spawned: 3
  Overlap: 43s (agents ran simultaneously)
  Sequential: NO (parallel confirmed)

TEST 5: Sub-Agent Spawning
Result: ✅ PASS
  Trace Analyzer spawned: YES
  Insights extracted: 6 gaps, 4 patterns, 3 recommendations
  Persistent storage: YES

TEST 6: Loop Detection
Result: ⚠️ NOT TRIGGERED
  Loop detected: NO
  Reason: Task completed without looping
  Status: Ready if needed

===================================
OVERALL: ✅ 5/6 PASS (1 not applicable)
===================================

ARCHITECTURE VERDICT: ✅ SYSTEM WORKS
- Multiple tools called (not one response block)
- Model switching proven
- Routing decisions explicit and logged
- Parallel execution demonstrated
- Sub-agents coordinate properly
- Loop safety ready
```

---

## Success Criteria

### Must-Have (All 6 Required for PASS)
```
✅ Test 1: Tool Multiplicity ≥2 tools
✅ Test 2: Model Switching ≥2 different models
✅ Test 3: Routing Decisions ≥1 explicit decision logged
✅ Test 4: Parallel Agents timestamps prove overlap
✅ Test 5: Sub-Agent Spawning Trace Analyzer works
✅ Test 6: Loop Detection (optional unless triggered)
```

### Nice-to-Have (Indicates Robustness)
```
🟢 Decision confidence ≥0.85
🟢 Parallel overlap ≥50% of runtime
🟢 Sub-agent insights ≥3 gaps + 3 patterns
🟢 Model switching happens at right complexity boundaries
```

---

## Why This Benchmark is Better

| Old Benchmark | New Benchmark |
|---------------|---------------|
| "Is response good?" | "Does system work?" |
| Measures output quality | Measures architectural behavior |
| Easy to fake (hallucinate) | Impossible to fake (audited) |
| 1 test per skill | 6 tests of system interactions |
| Pass if response plausible | Pass if architecture proven |
| No tool execution verified | Tool calls timestamped & counted |

**Result:** We don't care if the research is perfect. We care if the SYSTEM behaves correctly.

