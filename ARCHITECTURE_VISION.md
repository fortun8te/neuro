# Neuro Architecture Vision: Current vs Desired

---

## What You Have NOW (Linear Bottleneck)

```
User Input
    ↓
Task Classifier (picks ONE category)
    ↓
    ├─ Is it research? → Get research tools only
    ├─ Is it create? → Get create tools only
    ├─ Is it code? → Get code tools only
    └─ Is it analyze? → Get analyze tools only
    ↓
Single Planner (200 steps)
    ├─ Can call tools sequentially
    ├─ Can run some tools in parallel
    └─ Can spawn up to 5 subagents
    ↓
Output (whatever the one category allowed)
```

**Problem:** A user asking "research competitors → analyze sentiment → write ad copy" only gets tools for ONE of those three tasks.

---

## What You WANT (Recursive Task Tree)

```
User Input: "Research competitors, analyze sentiment, then write ad copy"
    ↓
Route & Plan (NOT classify - PLAN)
    ├─ Decompose into tasks:
    │   ├─ Task 1: Research competitors (needs research tools)
    │   ├─ Task 2: Analyze sentiment (needs analyze tools)
    │   └─ Task 3: Write ad copy (needs create tools)
    ├─ Determine dependencies:
    │   ├─ Task 2 depends on Task 1
    │   └─ Task 3 depends on Task 1 + Task 2
    └─ Build execution plan (DAG - Directed Acyclic Graph)
    ↓
Execute Plan (Tree of Planners)
    ├─ Planner for Task 1 (research)
    │   ├─ Gets: web_search, multi_browse, competitor_swot, etc.
    │   ├─ Spawns subagents if needed
    │   └─ Returns: structured findings
    │
    ├─ Planner for Task 2 (analyze)
    │   ├─ Gets: social_intelligence, sentiment tools, etc.
    │   ├─ Input: Task 1 output
    │   └─ Returns: sentiment analysis
    │
    └─ Planner for Task 3 (create)
        ├─ Gets: write_content, create_docx, brand_voice, etc.
        ├─ Input: Task 1 + Task 2 output
        └─ Returns: ad copy
    ↓
Aggregate Results (merge Task 1 + 2 + 3 outputs)
    ↓
Final Response to User
```

**Why this is better:**
- Each task gets the RIGHT tools for what it does
- Tasks can depend on other tasks' outputs
- Can parallelize independent tasks
- Can run sub-planners (double-wrapped) within tasks

---

## How OpenClaw Does It

```
User Input
    ↓
Routing Layer (multi-phase)
    ├─ Phase 1: Understand intent (via hooks)
    ├─ Phase 2: Route to provider (Ollama, Claude, GPT)
    ├─ Phase 3: Decide execution mode (sync, async, parallel)
    └─ Phase 4: Deploy task to control plane
    ↓
Task Control Plane (SQLite-backed)
    ├─ Track task state (queued, running, completed)
    ├─ Allow sub-tasks (fork/join pattern)
    ├─ Support task cancellation
    └─ Persist lineage
    ↓
Execute (can spawn subtasks)
    ├─ Each subtask gets own executor
    ├─ Subtasks can be parallel or sequential
    └─ All tracked in SQLite
    ↓
Merge Results
```

Key feature: **Real control plane** - you can query `openclaw flows list` and see all tasks, subTasks, and their status.

---

## How Hermes Does It

```
User Input
    ↓
Agent Loop (AIAgent class)
    ├─ Classify task type
    ├─ Pick model tier
    └─ Select tool subset
    ↓
Main Agent executes (200+ steps possible)
    ├─ Can spawn Council Brains (subagents)
    │   └─ Each council member: specialized analysis
    ├─ Can use Skills (multi-step tool chains)
    │   └─ Skills are reusable workflows
    └─ Can iterate and refine
    ↓
Reflection Agent
    ├─ Checks: "Did we miss anything?"
    ├─ Spawns more research if gaps found
    └─ Synthesizes final answer
    ↓
Output
```

Key feature: **Skill chaining** - you can define "competitor_analysis_skill" that includes 5 chained tool calls, reuse it anywhere.

---

## How OpenCode Does It

```
User Input
    ↓
Parse Intent (via regex + LLM)
    ↓
Route to Specialist Agent
    ├─ Coder Agent (for code tasks)
    ├─ Task Agent (for general tasks)
    └─ Title Agent (for naming)
    ↓
Agent Executes (sequential tool calls)
    ├─ Each tool call via MCP
    ├─ User approves before execution
    └─ Interactive back-and-forth
    ↓
Output
```

Key feature: **MCP-first** - all tools are external, pluggable via stdio. Same code works with any MCP server.

---

## What Neuro SHOULD Do (Recommended)

### Architecture: Multi-Level Task Tree

```
┌─────────────────────────────────────────────────────────────┐
│ Neuro Router (Strategic Layer)                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Input: "Research competitors, analyze, then write"      ││
│ │ → Parse into tasks: [research, analyze, write]           ││
│ │ → Build DAG: research → analyze → write                  ││
│ │ → Assign executors: TaskPlanner, TaskPlanner, TaskPlanner││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
           ↓ (parallel or sequential based on DAG)
┌─────────────────────────────────────────────────────────────┐
│ Task Executor Layer (Tactical)                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ TaskPlanner(Task 1: research)                            ││
│ │ ├─ Tools: [web_search, competitor_swot, multi_browse]   ││
│ │ ├─ Steps: 50 max (not global 200)                       ││
│ │ ├─ Can spawn subagents for this task                    ││
│ │ └─ Returns: { findings, metadata, sources }             ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ TaskPlanner(Task 2: analyze)                            ││
│ │ ├─ Input: Task 1 output (findings)                      ││
│ │ ├─ Tools: [social_intelligence, sentiment_tools]        ││
│ │ ├─ Steps: 50 max                                        ││
│ │ └─ Returns: { sentiment, insights, confidence }         ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ TaskPlanner(Task 3: write)                              ││
│ │ ├─ Input: Task 1 + Task 2 output (findings + sentiment) ││
│ │ ├─ Tools: [write_content, create_docx, brand_voice]     ││
│ │ ├─ Steps: 50 max                                        ││
│ │ └─ Returns: { ad_copy, variations, metadata }           ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
           ↓ (aggregate results)
┌─────────────────────────────────────────────────────────────┐
│ Output Aggregator (Synthesis)                               │
│ ├─ Merge all task outputs                                  │
│ ├─ Add cross-references (Task 1 → Task 2 → Task 3)        │
│ └─ Return unified response                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Components Needed

1. **TaskParser** (new)
   - Input: User message
   - Output: List of tasks with dependencies
   - Logic: NLP to extract: "research X", "analyze Y", "write Z"

2. **TaskDAG** (new)
   - Directed Acyclic Graph of tasks
   - Determines execution order
   - Can parallelize independent tasks

3. **TaskPlanner** (refactor current Planner)
   - Takes: Task + relevant tools + dependencies
   - Returns: Task output
   - Knows: This task is step 1 of 3, runs for 50 steps max (not 200)

4. **Orchestrator** (new)
   - Coordinates TaskPlanners
   - Handles inter-task communication
   - Manages memory/context passing

### Code Structure (Current → New)

**Current:**
```
agentEngine.ts
├─ buildTools() — 57 tools defined
├─ classifyTaskType() — picks ONE category
├─ runAgentLoop() — 200 steps
└─ tool execution
```

**New:**
```
neuroOrchestrator.ts (new)
├─ parseUserInputToTasks()
├─ buildTaskDAG()
└─ executeTaskTree()

taskPlanner.ts (refactor agentEngine)
├─ runTaskLoop() — 50 steps per task
├─ getToolsForTask()
└─ tool execution

taskParsing.ts (new)
├─ extractTasks()
├─ identifyDependencies()
└─ orderTasks()
```

---

## Implementation Path (Phased)

### Phase 1: Enable Multi-Task (This Week)
- [ ] Change classifyTaskType() → classifyTaskTypes() (return array)
- [ ] Merge tool sets from multiple categories
- [ ] Test: "research AND write" queries work
- **Impact:** Fixes 70% of "can't do that much" issue

### Phase 2: Add Task Parsing (Next Week)
- [ ] Implement TaskParser to extract tasks from user message
- [ ] Build TaskDAG for dependencies
- [ ] Create TaskPlanner (refactored from Planner)
- **Impact:** Full multi-task workflows

### Phase 3: Task Persistence (Following Week)
- [ ] Add SQLite task tracking (like OpenClaw)
- [ ] Implement `npm run cli -- tasks list|show|cancel`
- [ ] Support task resume/retry
- **Impact:** Production-ready task management

### Phase 4: Advanced Features (Month 2)
- [ ] Skill chaining (like Hermes) — define reusable multi-step workflows
- [ ] Environment abstraction (like Hermes) — support Docker/SSH
- [ ] Real control plane hooks (like OpenClaw)
- **Impact:** Enterprise-grade orchestration

---

## Example: How It Would Work

**User:** "Research the top 5 AI agents, compare their architectures, then recommend which one to copy features from"

**Current System (Broken):**
```
Classifier: "This is 'analyze' → picks analyze tools"
Result: Gets competitor_swot, social_intelligence
Missing: web_search, deep_research for initial gathering
Output: "I don't have enough information about these agents"
```

**New System (Fixed):**
```
TaskParser:
├─ Task 1: Research (web_search, multi_browse, scrape_page)
├─ Task 2: Analyze (competitor_swot, extract_data, summarize)
└─ Task 3: Recommend (write_content, create_docx, brand_voice)

Execution:
├─ TaskPlanner 1: Researches 5 agents → { descriptions, features, links }
├─ TaskPlanner 2: Analyzes architectures → { comparison_matrix, gaps, strengths }
└─ TaskPlanner 3: Writes recommendation → { doc with rationale, feature prioritization }

Output: Complete analysis + actionable recommendation
```

---

## Comparison Summary

| System | Strength | How They Do It | What You Learn |
|--------|----------|---|---|
| **Neuro (Current)** | Best research tools | Visual + comprehensive | Single-category gating is the bottleneck |
| **OpenClaw** | Best task orchestration | Real SQLite control plane | Need persistent task tracking |
| **Hermes** | Best multi-level planning | Recursive agent loop + skills | Skill chaining = reusable workflows |
| **OpenCode** | Best tool flexibility | MCP-based tools | Tools as external processes |

**Best hybrid:** Neuro's visual intelligence + OpenClaw's control plane + Hermes' skill chaining + OpenCode's tool flexibility.

---

## Decision: What Do You Build First?

1. **Phase 1 (Easy, High Impact):** Multi-task classification (this is the 15-min fix)
2. **Phase 2 (Medium, Game-Changer):** Task parsing + DAG execution
3. **Phase 3 (Hard, Enterprise):** SQLite control plane + persistence

After Phase 2, you'll have the tree-based architecture you want. After Phase 3, you'll rival OpenClaw.

