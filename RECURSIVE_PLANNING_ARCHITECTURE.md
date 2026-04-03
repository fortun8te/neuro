# Recursive Nested Planning Architecture
## How OpenClaw, Hermes, and Neuro Handle Deep Task Hierarchies

---

## The Problem You're Solving

```
User: "Build a feature: analyze user data, code the backend, test it,
        then write documentation"

This requires:
1. Analysis (understand requirements)
   ├─ Subtask 1a: Analyze user data requirements
   └─ Subtask 1b: Analyze performance requirements
2. Code Backend (implement)
   ├─ Subtask 2a: Design API schema
   ├─ Subtask 2b: Implement endpoints
   └─ Subtask 2c: Add error handling
3. Test (verify)
   ├─ Subtask 3a: Unit tests
   ├─ Subtask 3b: Integration tests
   └─ Subtask 3c: Load testing
4. Documentation (document)
   ├─ Subtask 4a: API documentation
   └─ Subtask 4b: Setup guides

Each subtask might have sub-subtasks.
Traditional planners: FAIL (too much context)
Recursive planners: Each task gets its own planner
```

---

## How OpenClaw Does It: Conductor + Specialists

```
User Input
    ↓
┌──────────────────────────────────┐
│ CONDUCTOR AGENT (Orchestrator)   │
├──────────────────────────────────┤
│ Job: Decompose into subtasks     │
│ Tools: Decompose, Delegate       │
│ Memory: Task DAG, Dependencies   │
│                                  │
│ Actions:                         │
│ 1. Parse user request            │
│ 2. Build recursive task DAG      │
│ 3. Assign tasks to specialists   │
│ 4. Monitor progress              │
│ 5. Aggregate results             │
│ 6. Verify coherence              │
└──────────────────────────────────┘
    ↓ (via message-passing)
┌──────────────────────────────────┐
│ SPECIALIST AGENTS (Executors)    │
├──────────────────────────────────┤
│                                  │
│ ┌─ Specialist 1: Analyzer       │
│ │  Task: "Analyze user data"    │
│ │  Tools: research, extract     │
│ │  Can spawn sub-specialists   │
│ │                               │
│ ├─ Specialist 2: Backend Dev    │
│ │  Task: "Code the endpoints"   │
│ │  Tools: code_analysis, shell  │
│ │  Can spawn sub-specialists   │
│ │                               │
│ └─ Specialist 3: QA             │
│    Task: "Test everything"      │
│    Tools: test runners, analyze │
│    Can spawn sub-specialists   │
│                                  │
└──────────────────────────────────┘
    ↓ (results via message-passing)
┌──────────────────────────────────┐
│ CONDUCTOR (Synthesis)            │
│ ├─ Merge results                 │
│ ├─ Verify cross-task coherence   │
│ └─ Return unified response       │
└──────────────────────────────────┘
```

**Key Pattern:** Conductor is a planner that delegates to specialists. Each specialist can itself be a planner that delegates further.

**Message-Passing:** Conductor → Specialists → Sub-Specialists all communicate via structured messages, not shared state.

---

## How Hermes Does It: Isolated Subagents + Council

```
User Input
    ↓
┌──────────────────────────────────┐
│ MAIN AGENT (Reflection Loop)     │
├──────────────────────────────────┤
│ Loop:                            │
│ 1. Analyze task                  │
│ 2. Decide: handle locally or     │
│    spawn subagents?              │
│ 3. If complex → spawn council    │
│ 4. Gather subagent results       │
│ 5. Synthesize + verify           │
│ 6. Check: gaps? → loop again     │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ COUNCIL BRAINS (Subagents)       │
├──────────────────────────────────┤
│ Each isolated from others        │
│ Own: conversation, terminal, RPC │
│                                  │
│ Council Types:                   │
│ • Validator: "Is this good?"     │
│ • Analyzer: "What does this do?" │
│ • Optimizer: "Can we improve?"   │
│ • Researcher: "What's missing?"  │
│                                  │
│ They debate before decision      │
│ (hermes-council MCP)             │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ DEPENDENCY-AWARE DAG             │
├──────────────────────────────────┤
│ Task 1 (analyze)                 │
│  ├─ Subtask 1a (parallel)        │
│  └─ Subtask 1b (parallel)        │
│     ↓ (depends on Task 1)        │
│ Task 2 (code)                    │
│  ├─ Subtask 2a (depends on 1a)   │
│  ├─ Subtask 2b (depends on 1a)   │
│  └─ Subtask 2c (parallel)        │
│     ↓ (depends on Task 2)        │
│ Task 3 (test)                    │
│     ↓ (depends on Task 2+3)      │
│ Task 4 (document)                │
│                                  │
│ Execution: Parallel where safe   │
│ Recovery: Crash detection +      │
│           auto-restart           │
└──────────────────────────────────┘
```

**Key Pattern:** Isolated subagents (separate conversations, no shared state). Main agent reflects and decides when to spawn councils. DAG ensures dependencies are honored.

---

## How Neuro Should Do It: Recursive TaskPlanners

```
┌────────────────────────────────────────────────────┐
│ ROUTER (Strategic)                                 │
├────────────────────────────────────────────────────┤
│ Input: "Build feature, analyze, code, test, docs" │
│                                                    │
│ 1. Parse → Tasks: [analyze, code, test, doc]      │
│ 2. Build DAG:                                      │
│    analyze → code → test → doc                     │
│ 3. Determine depth:                                │
│    • "code" is complex → needs subtasks            │
│    • "test" is complex → needs subtasks            │
│ 4. Spawn TaskPlanners (NOT flat, RECURSIVE)        │
└────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────┐
│ TASKPLANNER LEVEL 1 (Tactical)                     │
├────────────────────────────────────────────────────┤
│                                                    │
│ TaskPlanner("analyze", tools: [research, extract])│
│ └─ Output: requirements + data model               │
│                                                    │
│ TaskPlanner("code", tools: [code_analysis, shell])│
│ └─ RECURSIVE: Decides this needs subtasks          │
│    │                                               │
│    └─ Spawns TASKPLANNER LEVEL 2:                  │
│       ├─ TaskPlanner("design_schema")              │
│       │  └─ Output: API schema                     │
│       ├─ TaskPlanner("implement_endpoints")        │
│       │  └─ Output: working endpoints              │
│       └─ TaskPlanner("error_handling")             │
│          └─ Output: error layer                    │
│                                                    │
│ TaskPlanner("test", tools: [shell, code_analysis])│
│ └─ Output: test results                            │
│                                                    │
│ TaskPlanner("doc", tools: [write_content])         │
│ └─ Output: documentation                           │
└────────────────────────────────────────────────────┘
         ↓ (aggregate)
┌────────────────────────────────────────────────────┐
│ OUTPUT AGGREGATOR                                  │
├────────────────────────────────────────────────────┤
│ Merge all levels:                                  │
│ • Analysis → requirements                          │
│ • Code design → schema                             │
│ • Code impl → endpoints + error handling           │
│ • Tests → validation                               │
│ • Doc → user guide                                 │
│                                                    │
│ Cross-reference: "Step 3 depends on Step 2"        │
└────────────────────────────────────────────────────┘
```

**Key Pattern:**
- TaskPlanner checks task complexity
- If simple → execute directly
- If complex → spawn child TaskPlanners
- Each level has its own 50-step max
- Can nest infinitely (3-4 levels typical)

---

## Implementation: Recursive TaskPlanner

### Current Code (Non-recursive)

```typescript
// agentEngine.ts - single flat planner
export async function runAgentLoop(
  userMessage: string,
  options: AgentLoopOptions
): Promise<AgentResult> {
  const allTools = buildTools();
  const tools = filterToolsByCategory(userMessage);

  for (let step = 0; step < 200; step++) {
    // Execute tools sequentially
  }
}
```

### New Code (Recursive)

```typescript
// neuroTaskPlanner.ts - recursive
interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  tools: ToolDef[];
  maxSteps: number;
  dependencies: string[]; // task IDs this depends on
  isComplex: boolean; // if true, consider spawning subtasks
}

async function recursiveTaskPlanner(
  task: TaskDefinition,
  depth: number = 0,
  parentContext?: string
): Promise<TaskResult> {

  // Base case: simple task, execute directly
  if (!task.isComplex || depth > 4) {
    return await executeTask(task, task.maxSteps);
  }

  // Recursive case: decompose into subtasks
  const subtasks = await analyzeAndDecompose(task, depth);

  if (subtasks.length === 0) {
    // No decomposition possible, execute normally
    return await executeTask(task, task.maxSteps);
  }

  // Spawn child planners for subtasks
  const results = await Promise.all(
    subtasks.map(subtask =>
      recursiveTaskPlanner(subtask, depth + 1, task.id)
    )
  );

  // Synthesize subtask results
  return synthesizeResults(results, task);
}
```

### Decision Logic: When to Decompose

```typescript
function shouldDecompose(task: TaskDefinition): boolean {
  // Heuristics for decomposition:

  // 1. Task has multiple distinct goals
  if (/\b(and|plus|then|also|meanwhile)\b/i.test(task.description)) {
    return true;
  }

  // 2. Task mentions "multiple", "several", "many", "parallel"
  if (/\b(multiple|several|many|parallel|concurrent)\b/i.test(task.description)) {
    return true;
  }

  // 3. Task is very long and complex
  if (task.description.length > 200) {
    return true;
  }

  // 4. Explicit signals: "first X, then Y, finally Z"
  if (/^(first|then|next|finally|after that)\b/i.test(task.description)) {
    return true;
  }

  return false;
}

async function analyzeAndDecompose(
  task: TaskDefinition,
  depth: number
): Promise<TaskDefinition[]> {
  // LLM-based: ask what subtasks this task needs
  const prompt = `
    Task: ${task.description}

    What are the key subtasks needed to accomplish this?
    Return JSON: { subtasks: [ { title, description } ] }
  `;

  const response = await ollamaService.generateStream(prompt, ...);
  const { subtasks } = JSON.parse(response);

  return subtasks.map((st, i) => ({
    id: `${task.id}-${i}`,
    title: st.title,
    description: st.description,
    tools: filterToolsForTask(st.description),
    maxSteps: 50, // not 200, each level gets 50
    dependencies: buildDependencies(subtasks, i),
    isComplex: shouldDecompose(st),
  }));
}
```

---

## Execution: With Your Heartbeat System

```typescript
// Integration with existing heartbeat
const heartbeat = new TaskHeartbeat({
  intervalMs: 5000,
  onTick: (status) => {
    // Each level reports:
    // Level 0: Task 1 of 4 (analyze)
    // Level 1: Task 1a of 3 (request analysis)
    // Level 2: Searching requirements... step 3/50
  },
});

async function recursiveTaskPlannerWithHeartbeat(
  task: TaskDefinition,
  depth: number = 0,
  heartbeat: TaskHeartbeat
): Promise<TaskResult> {
  heartbeat.start(`Task: ${task.title} (depth ${depth})`);

  try {
    if (!task.isComplex || depth > 4) {
      return await executeTask(task, task.maxSteps, heartbeat);
    }

    const subtasks = await analyzeAndDecompose(task, depth);
    const results = await Promise.all(
      subtasks.map(st =>
        recursiveTaskPlannerWithHeartbeat(st, depth + 1, heartbeat)
      )
    );

    heartbeat.complete(`${task.title}: complete`);
    return synthesizeResults(results, task);
  } catch (err) {
    heartbeat.error(`${task.title}: ${err.message}`);
    throw err;
  }
}
```

---

## Comparison: Flat vs Recursive

### Flat Planning (Current)

```
User: "Analyze competitors, code feature, test, write docs"
       ↓
Classifier picks ONE category: "analyze"
       ↓
Gets: competitor_swot, social_intelligence, analyze tools
       ↓
MISSING: shell_exec, code_analysis (code tools)
       ↓
FAILS: Can't write the code
```

### Recursive Planning (Proposed)

```
User: "Analyze competitors, code feature, test, write docs"
       ↓
Router: "This needs [analyze, code, test, doc]"
       ↓
Spawn Level 1 TaskPlanners:
├─ TaskPlanner("analyze") → gets analyze tools → completes
├─ TaskPlanner("code") → gets code tools
│  └─ Sees complexity → spawns Level 2:
│     ├─ TaskPlanner("design_schema") → completes
│     ├─ TaskPlanner("implement") → completes
│     └─ TaskPlanner("error_handling") → completes
├─ TaskPlanner("test") → gets test tools → completes
└─ TaskPlanner("doc") → gets doc tools → completes
       ↓
Aggregate all results
       ↓
SUCCESS: Full feature built
```

---

## Your Heartbeat + Analysis Pattern

Your current system has:
```typescript
// Heartbeat already exists
const heartbeat = new TaskHeartbeat();

// What you need to add:
const analysis = await analyzeTask(userMessage);
// "code" is complex → needs subtasks
// "test" is complex → needs subtasks

// Then execute recursively
const result = await recursiveTaskPlanner(
  parseUserInputToTask(userMessage),
  0,
  heartbeat
);
```

The heartbeat becomes **per-depth-level** reporting:
```
[Depth 0] Main Task: Building feature (step 1/4)
  [Depth 1] Subtask: Analyzing (step 2/50)
    [Depth 2] Sub-subtask: Fetching requirements (step 15/50)
  [Depth 1] Subtask: Coding schema (step 3/50)
  [Depth 1] Subtask: Implementing endpoints (step 25/50)
  [Depth 1] Subtask: Testing (step 12/50)
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create `recursiveTaskPlanner.ts`
- [ ] Implement `TaskDefinition` interface
- [ ] Add `shouldDecompose()` logic
- [ ] Test with 2-level decomposition

### Week 2: Integration
- [ ] Wire into Router (replace single-category classification)
- [ ] Integrate with heartbeat system
- [ ] Add dependency resolution (topological sort)
- [ ] Test: "analyze AND code AND test AND doc" query

### Week 3: Optimization
- [ ] Add memoization for similar subtasks
- [ ] Implement result caching per depth level
- [ ] Add cross-level context sharing
- [ ] Performance testing

### Week 4: Advanced
- [ ] Add skill chaining (like Hermes) — reusable subtask sequences
- [ ] Implement council brains (multi-perspective subtasks)
- [ ] Add crash recovery + replay (like Hermes)
- [ ] SQLite persistence (like OpenClaw)

---

## Why This Is Better Than Flat Planning

| Aspect | Flat | Recursive |
|--------|------|-----------|
| "Analyze + Code + Test + Doc" | ❌ Fails | ✅ Works |
| "Code complex feature" | ❌ 200-step chaos | ✅ 50-step per level, clear hierarchy |
| "Code has subtasks" | ❌ Can't decompose | ✅ Spawns Level 2 planners |
| Context management | ❌ Huge context | ✅ Small per level |
| Error recovery | ❌ Whole task fails | ✅ Retry specific subtask |
| Parallelization | ❌ Limited | ✅ Full DAG parallelization |
| Deep complex tasks | ❌ Fails | ✅ Unlimited depth (3-4 typical) |

---

## Key Insight

You already have:
- Router (user → decompose)
- Heartbeat (progress tracking)
- Tools (57 of them)
- Subagents (parallel workers)

You need to add:
- **Recursive task decomposition** — each task analyzes itself and decides if it needs subtasks
- **Depth-aware execution** — each level gets own step budget (50 steps, not 200)
- **Synthesis layer** — aggregate results from all depth levels

That's 2-3 functions, not a major rewrite.

---

## Sources

- [OpenClaw clawflow skill and task orchestration](https://playbooks.com/skills/openclaw/skills/clawflow)
- [OpenClaw 2026 Enterprise Architecture](https://kollox.com/openclaw-2-0-architecting-agentic-workflows-for-enterprise-scale/)
- [Hermes Agent Multi-Agent Architecture with Council Brains](https://github.com/NousResearch/hermes-agent/issues/344)
- [Hermes Isolated Subagents with Crash Recovery](https://ghost.codersera.com/blog/hermes-agent-guide-to-multi-agent-ai-setup/)
- [Recursive Agent Swarms Decomposition Pattern](https://agentiagency.com/blog/2026-01-15-decomposition-dividend.html)

