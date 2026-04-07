# Orchestration Patterns Guide

This document clarifies the four main agent orchestration systems and when to use each.

## 1. AgentCoordinator — Worker Pool Management

**File**: `utils/agentCoordinator.ts`

**Purpose**: Spawns and manages worker agents with master/worker messaging via a shared blackboard.

**When to use**:
- Need to spawn independent worker agents with goals
- Want event-driven coordination (on/off listeners)
- Need master-to-worker messaging capability
- Worker failures should not cascade
- Blackboard visibility is helpful for debugging

**Key Features**:
- Spawns workers with `spawnWorker(machineId, goal, signal)`
- Posts findings to shared Blackboard
- Event system with listener pattern
- Abort signal support (parent abort cascades to children)
- Per-worker message queue for follow-ups

**Usage in codebase**:
- `agentEngine.ts`: Tools like `spawn_worker`, `check_workers`, `read_findings` use this pattern
- Exposes worker status and findings to the ReAct loop

**Example**:
```typescript
const workerId = agentCoordinator.spawnWorker('local', 'Analyze competitor website', signal);
agentCoordinator.on('worker_done', (event) => {
  console.log('Worker found:', event.finding);
});
```

---

## 2. SubagentPlanner — Task Complexity Analysis

**File**: `utils/subagentPlanner.ts`

**Purpose**: Analyzes user messages to decide IF and HOW MANY subagents to spawn.

**When to use**:
- Need intelligent subagent allocation based on task complexity
- Want to avoid spawning agents for trivial tasks
- Need role assignment based on domain (security, architecture, research)
- Explicit user directives should override automatic decisions

**Key Features**:
- Complexity analysis: trivial → simple → medium → complex
- Keyword-based role detection (security, architecture, code analysis)
- Parses explicit "sub for X" directives from user messages
- Maps complexity to role assignments

**Usage in codebase**:
- `agentEngine.ts` calls `planSubagents(message, context)` to decide spawning strategy
- Used in ReAct loop before creating subagent pool

**Example**:
```typescript
const plan = await planSubagents('Deep dive analysis of attack surface', conversationContext);
// plan = { count: 2, roles: ['security-analyst', 'researcher'], reason: 'Security audit detected' }
```

---

## 3. SubagentPool — Production-Grade Parallel Agent Management

**File**: `utils/subagentManager.ts` (exports `SubagentPool`)

**Purpose**: Manages a bounded pool of concurrent subagents with retry logic, timeouts, and error isolation.

**When to use**:
- Need parallel agent execution with controlled concurrency
- Must survive individual agent failures (fault isolation)
- Need retry logic with exponential backoff
- Must report per-agent confidence and token usage
- Timeout handling is critical

**Key Features**:
- Bounded queue (maxConcurrent controls parallelism)
- Per-subagent hard timeout (120s default)
- Retry with exponential backoff (configurable, default 3 attempts)
- Error isolation — one failure never kills the batch
- Confidence scoring on every result
- Full lifecycle registry (idle → spawning → running → done/failed)
- Rich observability callbacks

**Usage in codebase**:
- `agentEngine.ts` uses SubagentPool for parallel research queries
- Creates pool with `maxConcurrent: 4`, submits 5 requests (capped)
- Callbacks report progress and completion to UI

**Example**:
```typescript
const pool = new SubagentPool({ id: 'research-pool', maxConcurrent: 4 });
const results = await pool.submitAll([
  { id: 'task-1', role: 'researcher', task: 'Search X', model: 'qwen3.5:2b' },
  { id: 'task-2', role: 'analyzer', task: 'Analyze Y', model: 'qwen3.5:2b' },
], callbacks);
```

---

## 4. Council of Marketing Brains — Multi-Brain Voting System

**File**: `utils/council.ts`

**Purpose**: Scales marketing analysis based on research preset; different presets run different numbers of brains.

**When to use**:
- Analyzing marketing/positioning insights from research findings
- Need multi-perspective consensus voting
- Want confidence scoring from council verdict
- Scaling with presets (SQ/QK skip council entirely, EX/MX expand brains)

**Key Features**:
- Preset-based scaling: SQ/QK skip, NR 4 brains→1 head, EX 7→2, MX 13→4
- Vision analysis support (Playwright screenshots + qwen vision)
- Brain definitions for specialized roles (brand strategist, copywriter, etc.)
- Council heads synthesize outputs
- Master verdict mechanism
- Integration with brand DNA and audience data

**Usage in codebase**:
- `hooks/useOrchestratedResearch.ts` calls `runCouncil()` after desire-driven analysis
- Consumes research findings as context
- Outputs `CouncilVerdict` fed to downstream Make/Test stages

**Example**:
```typescript
const verdict = await runCouncil(
  campaign,
  findings,
  signal,
  onProgress,
);
// verdict includes: strategicDirection, primaryAdType, headlineStrategy, keyInsights, etc.
```

---

## Architecture Overview

```
User Input
  ↓
ReAct Loop (agentEngine)
  ├─ SubagentPlanner → decide if agents needed
  │
  ├─ AgentCoordinator (for browser automation)
  │   └─ runPlanAct workers → post findings to Blackboard
  │
  ├─ SubagentPool (for parallel research)
  │   └─ Multiple SubagentRole workers in parallel
  │
  └─ useOrchestratedResearch (research phase)
      ├─ Phase 1: Desire-Driven Analysis
      ├─ Phase 2: Web Research Orchestration
      ├─ Council of Marketing Brains ← voting happens here
      └─ Outputs: researchFindings + councilVerdict
         └─ Feeds downstream stages (objections, taste, make, test)
```

---

## Decision Flow

**Should I use AgentCoordinator?**
- Yes if: need master/worker with blackboard messaging
- No if: need parallel independent agents (use SubagentPool instead)

**Should I use SubagentPlanner?**
- Always: call first in ReAct loop to decide spawning strategy
- Complements whichever pool you choose

**Should I use SubagentPool?**
- Yes if: need parallel agents with retry, timeout, confidence scoring
- Yes if: individual failures must not stop the batch
- No if: simple sequential execution (use AgentCoordinator)

**Should I use Council?**
- Yes if: analyzing marketing insights after research
- No if: doing browser automation or code analysis
- Only in research phase (useOrchestratedResearch)

---

## Error Recovery Integration

All orchestration systems integrate with `errorRecovery.ts`:
- AgentCoordinator → runPlanAct → planActAgent (uses errorRecovery)
- SubagentPool → executeSubagent → tool execution → errorRecovery fallback
- Council → ollamaService errors handled per-brain

See `ERROR_RECOVERY_PIPELINE.md` for unified error orchestration.

---

## Summary Table

| System | Purpose | Concurrency | Used For | Retry/Timeout |
|--------|---------|-------------|----------|---------------|
| **AgentCoordinator** | Worker pool + blackboard | 1 per worker | Browser automation, master/worker | Limited |
| **SubagentPlanner** | Task complexity analysis | N/A | Spawning decisions | N/A |
| **SubagentPool** | Parallel agent pool | Bounded (4 typical) | Parallel research, parallel analysis | Full (3 attempts, 120s) |
| **Council** | Marketing brains voting | Sequential (GPU constraint) | Post-research analysis | Per-brain rollback |

