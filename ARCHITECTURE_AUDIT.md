# Neuro Architecture Audit — Tool Calling & Planner Capability Gap

**Date:** April 3, 2026
**Status:** Critical bottleneck identified
**Focus:** Why the planner can't do enough + how to fix it

---

## Executive Summary

**Your problem statement:** "The planner is not doing a fuck tonne. It can't do that much."

**Root cause:** The planner is architecturally limited to only **5 tools** in a **5-step ReAct loop**, while the system is designed for 40+ tools. This is the "fucked architecture" you're experiencing.

**Comparison:**
- **Neuro (current):** 5 tools, 5 max steps, planner tools = {web_search, browse, summarize}
- **OpenClaw (2026):** 40+ tools, SQLite task control plane, per-tool execution context
- **Hermes Agent:** 40+ tools in registry, 3-tier architecture, 11 tool-call parsers for model compatibility
- **OpenAI Codebase:** Similar pattern — 50+ tools, router + executor pattern

**The gap isn't conceptual — it's implementation.** The tool router exists (toolRouter.ts catalogs 40+ tools) but only 5 are implemented. The ReAct loop is correctly designed but hits arbitrary limits.

---

## Current State: The 5-Tool System

### What the Planner Has Access To

Located in: `frontend/utils/subagentTools.ts` (lines 29–160)

```typescript
getSubagentTools() returns:
  1. web_search — SearXNG via Wayfarer
  2. browse — Single URL fetch
  3. multi_browse — Parallel URL fetch (up to 5)
  4. scrape_page — Playwright screenshot + analysis
  5. summarize — Text compression via Ollama
```

### Hard Limits on Tool Usage

**File:** `frontend/utils/subagentManager.ts` (line 561)

```typescript
const MAX_SUBAGENT_TOOL_STEPS = 5; // Hard limit: 5 tool calls per task

const isToolRole = ['researcher', 'validator', 'analyst'].includes(request.role);
// Only 3 of 10 roles can use tools
```

**Impact:**
- Max 5 tool calls per subagent task
- Only researcher/validator/analyst roles get tool access
- Planner (orchestrator role) is NOT in the tool-using roles list
- ReAct loop exits after 5 iterations regardless of task complexity

### Designed But Not Implemented: The "Ghost Tools"

**File:** `frontend/utils/toolRouter.ts` (lines 31–88)

The TOOL_CATALOG describes 40+ tools:

```
SEARCH & WEB (6): web_search, browse, multi_browse, scrape_page, analyze_page, deep_research
FILES & DOCUMENTS (7): file_read, file_write, file_find, file_browse, create_docx, read_pdf, apply_patch
CODE (2): shell_exec, run_code
MEMORY (4): memory_store, memory_search, soul_read, soul_update
COMPUTER (2): use_computer, control_desktop
CONTENT (4): write_content, summarize, extract_data, image_analyze
AGENTS (5): spawn_agents, spawn_worker, check_workers, read_findings, send_instruction
RESEARCH (4): competitor_swot, social_intelligence, google_trends, brand_voice
SYSTEM (2): soul_log, wait
```

**But:** Only 5 are actually implemented. The other 35 are "ghost tools" — they exist in the router catalog but have no execute() function.

**Proof:** Lines 13–16 in subagentTools.ts list 8 items in PARALLEL_SAFE_TOOLS but only 5 are defined:

```typescript
export const PARALLEL_SAFE_TOOLS = new Set([
  'web_search', 'browse', 'scrape_page', 'multi_browse', 'summarize',
  'extract_data', 'image_analyze', 'analyze_page', // ← GHOST TOOLS (not implemented)
]);
```

---

## What's Disabled

### Computer Tools — Explicitly Off

**File:** `frontend/utils/agentEngine.ts` (line 61)

```typescript
const COMPUTER_TOOLS_ENABLED = false;
// Computer tools (use_computer, control_desktop) temporarily disabled while we
// stabilize core research/docx/citation pipeline. Re-enable when sandbox is ready.
```

**Impact:** The infrastructure for browser automation, screenshots, and UI interaction is built (sandboxService, computerAgent/orchestrator, desktopBus) but blocked.

### Missing Major Tool Categories

| Category | Count | Status | Reason |
|----------|-------|--------|--------|
| File Ops | 7 | Not implemented | No fs hooks |
| Code Execution | 2 | Not implemented | Sandbox disabled |
| Memory | 4 | Not implemented | No memory service |
| Computer | 2 | Disabled | Stability concerns |
| Content Gen | 4 | Partial | summarize only |
| Agents | 5 | Partial | Only subagent manager |

---

## How This Compares to OpenClaw (2026)

### OpenClaw's Approach

**Real-time task control plane:**
```
openclaw flows list|show|cancel
↓
SQLite-backed task tracking
↓
Per-tool execution context
↓
Unified across: ACP, subagent, cron, CLI
```

**SearXNG integration:**
- Bundled provider plugin (configurable hosts)
- Not just a library call, but a proper service integration

**Tool execution:**
- MCP tool materialization (serverName__toolName)
- Per-server connection timeouts
- Hooks for before_agent_reply (inject synthetic replies after tool calls)

### What Neuro Is Missing

1. **Task persistence:** No SQLite tracking of tool executions across sessions
2. **Tool hooks:** No before/after execution handlers
3. **Provider configuration:** Hard-coded service URLs, not provider-aware
4. **Per-tool context:** No execution environment abstraction (Local, Docker, SSH, Modal)

---

## How This Compares to Hermes Agent

### Hermes' Tool Registry Pattern

```python
# tools/registry.py
TOOL_REGISTRY = {
    'web_search': WebSearchTool(),
    'file_read': FileReadTool(),
    'shell_exec': ShellExecTool(),
    # ... 37 more tools
}

# tools/environments/ — abstraction layer
- LocalEnvironment
- DockerEnvironment
- SSHEnvironment
- ModalEnvironment
```

**Key insight:** Tools are registered at import time + execution environment is abstracted. You write tools once, they work in any environment.

### What Neuro Is Missing

1. **Environment abstraction:** All execution is hardcoded to local/Wayfarer
2. **Tool discovery:** No import-time registration, static list only
3. **Skill chaining:** No mechanism for multi-step tool pipelines
4. **Tool-call parsers:** Only one parser (parseSubagentToolCall), vs Hermes' 11

---

## The Architecture Problem (Why It's "Fucked")

### The Planner Bottleneck

**Current flow:**

```
User Task
    ↓
Orchestrator (useOrchestratedResearch)
    ↓
Deploy 5 subagents in parallel
    ↓
Each subagent: ReAct loop (5 steps max) using 5 tools
    ↓
Subagents report back: findings + JSON
    ↓
Orchestrator synthesizes
    ↓
Output
```

**Problem:** The orchestrator itself has NO direct tool access. It can only:
1. Deploy subagents
2. Synthesize their results
3. Decide what to research next

It **cannot:**
- Read files
- Write reports
- Execute code
- Perform shell operations
- Access memory
- Control the browser
- Create documents
- Download images
- Analyze deeply

### Why Only 5 Tools

The system was designed with the assumption that:
- Subagents would be parallelized workers (correct)
- Planner would orchestrate them (correct)
- **But planner would also need tools** (forgotten)

The tool router catalogs 40+ because someone planned for this, but implementation stopped at 5.

---

## What We Need: The Fix

### Phase 1: Expand Planner Tool Access (Critical)

**1.1 Add Planner to Tool-Using Roles**

```typescript
// subagentManager.ts line 556
const toolRoles = ['researcher', 'validator', 'analyst', 'orchestrator', 'planner'];
const isToolRole = toolRoles.includes(request.role);
```

**1.2 Increase MAX_SUBAGENT_TOOL_STEPS**

```typescript
// Adaptive limit based on role
const maxSteps = request.role === 'planner' ? 20 : 5;
```

**1.3 Implement Top-10 Missing Tools**

Priority order based on "can't do that much":

```
TIER 1 (Unblocks deep research):
  1. deep_research — Multi-query, multi-source research with synthesis
  2. memory_store — Save findings for next cycle
  3. memory_search — Recall past research

TIER 2 (Unblocks content creation):
  4. create_docx — Generate Word documents
  5. write_content — Polish ad copy, emails, reports
  6. extract_data — Parse tables, JSON, structured data

TIER 3 (Unblocks file operations):
  7. file_read — Read arbitrary files
  8. file_write — Write artifacts
  9. file_browse — List directories

TIER 4 (Unblocks automation):
  10. shell_exec — Run commands (sandboxed)
```

### Phase 2: Re-Enable Computer Tools

```typescript
const COMPUTER_TOOLS_ENABLED = true;
// Sandbox fully stabilized; computer agent orchestrator ready
```

This gives the planner:
- Click, type, screenshot, navigate
- Form filling, authentication
- Visual analysis (UI interaction patterns)

### Phase 3: Adopt Hermes-Style Environment Abstraction

```typescript
// environments/index.ts
interface ExecutionEnvironment {
  name: 'local' | 'docker' | 'ssh' | 'modal';
  execute(command: string, args: Record): Promise<string>;
}

export const environments = {
  local: new LocalEnvironment(),
  docker: new DockerEnvironment(DOCKER_HOST),
  ssh: new SSHEnvironment(REMOTE_SERVER),
};
```

This allows:
- Same tools, multiple backends
- Planner can say: "Run this in Docker, not local"
- Graceful fallback (can't reach Docker? Use local)

### Phase 4: Adopt OpenClaw's Task Persistence

```typescript
// Store tool executions in IndexedDB (already available)
// {
//   id: 'task-123',
//   tool: 'web_search',
//   args: {...},
//   result: {...},
//   timestamp: Date.now(),
// }

// Enable: openclaw flows list|show|cancel
// (We can implement this via CLI)
```

---

## Implementation Roadmap

### Week 1: Planner Tool Access (Quick Win)
- Add orchestrator/planner to isToolRole
- Increase MAX_SUBAGENT_TOOL_STEPS to 15
- Add deep_research tool (multi-query orchestration)
- **Result:** Planner can now do 15 tool calls + can chain research queries

### Week 2: Core Tools (Blockers)
- Implement: memory_store, memory_search
- Implement: create_docx, write_content
- Implement: file_read, file_write
- **Result:** Planner can save findings, write reports, manage files

### Week 3: Automation Tools (Depth)
- Re-enable COMPUTER_TOOLS_ENABLED
- Add: shell_exec (sandboxed)
- Add: extract_data (JSON/table parsing)
- **Result:** Planner can script, parse, interact with UI

### Week 4: Polish + Benchmarking
- Fix tool-call parsing edge cases
- Add tool execution tracking (decision log)
- CLI verification: `npm run benchmark -- --tools`
- **Result:** Architecture validated, "calling enough tools"

---

## Comparison Scorecard

| Aspect | Neuro (Current) | OpenClaw | Hermes | Target |
|--------|---|---|---|---|
| **Tools Implemented** | 5 | 40+ | 40+ | 30+ |
| **Max Tool Steps** | 5 | Unlimited | Unlimited | 20 (planner), 5 (subagent) |
| **Planner Tool Access** | No | Yes | Yes | Yes |
| **File Operations** | ✗ | ✓ | ✓ | ✓ |
| **Code Execution** | ✗ | ✓ | ✓ | ✓ |
| **Computer/Browser** | Disabled | ✓ | ✓ | ✓ |
| **Memory Operations** | ✗ | ✓ | ✓ | ✓ |
| **Environment Abstraction** | ✗ | Implicit | ✓ (environments/) | ✓ |
| **Task Persistence** | ✗ | ✓ (SQLite) | ✓ | ✓ |
| **Tool Hooks** | ✗ | ✓ | ✓ | ✓ |

---

## Why This Matters

**Current state:** Planner can only coordinate web research. Can't:
- Save findings to disk
- Write reports
- Read files back
- Analyze code
- Run automation
- Remember previous work

**After fixes:** Planner becomes a true autonomous agent:
- Research → Save findings → Read them back → Synthesize → Write report
- Multi-step workflows without manual intervention
- Tool chaining (research → extract → write)
- Memory across cycles

This is the difference between "nice research assistant" and "best harness ever for A.I. for general-purpose tool calling."

---

## Recommended Next Steps

1. **Validate this audit** — Does this match what you're seeing?
2. **Pick Phase 1 priority** — Which tools unblock you first?
3. **Set tool limit** — MAX_SUBAGENT_TOOL_STEPS = 15? 20? Unlimited?
4. **Voice integration** — This is orthogonal but can be added after planner fixes

---

## References

- [OpenClaw Releases 2026](https://github.com/openclaw/openclaw/releases)
- [Hermes Agent Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/)
- Neuro codebase: frontend/utils/{subagentTools, subagentManager, toolRouter, agentEngine}.ts

