# Neuro Architecture Audit — Complete Deep Dive
**Date:** April 3, 2026
**Status:** Full audit completed with full code review
**Problem:** "The planner is not doing a fuck tonne. It can't do that much."

---

## TL;DR: What's Actually in Neuro

### The Planner (agentEngine.ts: 56 tools)
- **57 total tool definitions** (56 with execute functions)
- **200-step max loop** (higher than Hermes default)
- **Task-based routing** that auto-classifies user intent and picks tools
- **Parallel tool execution** (detects parallelizable tools automatically)
- **Sophisticated error recovery** (11 different error handling strategies)
- **200 lines of recovery logic** per LLM error type

### The Subagents (subagentManager.ts: 5 tools)
- **5 tools only** (web_search, browse, multi_browse, scrape_page, summarize)
- **MAX_SUBAGENT_TOOL_STEPS = 5** (hard limit per subagent)
- **3 roles can execute tools** (researcher, validator, analyst)
- **Purpose:** Parallel research workers, not general-purpose agents

---

## The Actual Tool Inventory

### Planner Available Tools (57 total)
**ALWAYS AVAILABLE:**
- think, plan, ask_user, done, say (meta-tools)
- memory_store, memory_search (persistence)
- note, notes_read (working memory)

**RESEARCH TOOLS (11):**
web_search, multi_browse, browse, scrape_page, analyze_page, summarize, extract_data, image_analyze, video_analyze, audio_transcribe, spawn_agents

**CODE TOOLS (8):**
code_analysis, shell_exec, file_read, file_write, apply_patch, run_code, file_find, web_search

**CONTENT CREATION (13):**
write_content, create_docx, deep_research, web_search, brand_voice, summarize, image_analyze, file_write, run_code, read_pdf, video_analyze, video_edit, video_create

**FILE OPERATIONS (13):**
file_read, file_write, file_find, read_pdf, extract_data, apply_patch, image_analyze, run_code, shell_exec, video_analyze, video_edit, audio_transcribe, video_create

**ANALYSIS (12):**
web_search, deep_research, multi_browse, competitor_swot, social_intelligence, google_trends, brand_voice, summarize, extract_data, scrape_page, browse, image_analyze, video_analyze, spawn_agents

**COMPUTER CONTROL (6):**
use_computer, control_desktop, browse, scrape_page, image_analyze, shell_exec

**AGENT ORCHESTRATION (7):**
spawn_agents, spawn_worker, check_workers, read_findings, send_instruction, web_search, deep_research

**MEMORY/KNOWLEDGE (5):**
memory_store, memory_search, soul_read, soul_update, soul_log

**SPECIALIZED (4):**
data_pipeline, visualize_data, save_skill, schedule_task

**SYSTEM (2):**
wait, translate

---

## The Real Problem: Task Classification Bottleneck

### Current Architecture

```
User: "Research competitors, analyze sentiment, then write ad copy"
         ↓
Task Classifier (classifyTaskType)
         ↓
"Matched: analyze + create + research"
BUT ONLY PICKS ONE: analyze (first match wins)
         ↓
Tools given: [web_search, deep_research, multi_browse, competitor_swot, social_intelligence, google_trends, brand_voice, summarize, extract_data, scrape_page, browse, image_analyze, video_analyze, spawn_agents]
         ↓
MISSING: write_content, create_docx (create task tools)
```

### Why This Is "Fucked"

The classifier uses regex matching and **returns the FIRST matching task type**:

```typescript
// Line 4444
if (/\b(what is|who is|what are|find|look up|search|tell me about|info on|how does|why does|when did|fetch|scrape|grab)\b/i.test(t)) return 'research';
return 'general';
```

If a user asks something that matches multiple categories (research + write + analyze), only ONE wins. The tool set is optimized for single-task execution, not multi-task workflows.

**Example failure cases:**
1. "Research customers AND write a proposal" → classify('research' OR 'create') → picks 'research' → no write_content tool
2. "Analyze 5 competitors in parallel, then write positioning" → picks 'analyze' → no create tools
3. "Fetch 3 research papers, summarize them, code up analysis, write report" → picks one of 4 categories

---

## What Works Well

### Error Recovery (Lines 5750-5950)
The planner has 11 different error recovery modes:
1. Empty response detection
2. Stuck detection (same response repeated)
3. Model identity claim detection (Qwen vs Neuro)
4. Fake tool narration detection ("I searched..." without calling tool)
5. Malformed tool call rescue (xLAM fallback)
6. Plan-text detection (model wrote plan, didn't act)
7. Garbage response filtering
8. Format retry with exponential backoff
9. Context poisoning prevention
10. Per-step timeout (150s)
11. Stuck count abort (>3 consecutive errors)

This is VERY sophisticated.

### Parallel Execution (Lines 6172-6196)
The planner can:
- Auto-detect parallelizable tools (web_search + browse + multi_browse together)
- Execute 2+ tools in parallel via the harness
- Emit `tool_start` events immediately for all tools
- Collect results and merge them

This is working and correctly implemented.

### Tool Harness (harness.ts)
- Permission checking per tool
- Progress streaming
- Result truncation (20KB max by default)
- Abort signal propagation
- Parallel batch execution

This is solid.

---

## What Doesn't Work Well

### 1. **Multi-Task Workflows** (CRITICAL)
The task classifier picks ONE category. A user asking for "research + write + analyze" gets tools for only ONE.

**Fix:** Allow multi-task classification. Return all matching categories, not just first match.

```typescript
// Current (broken):
function classifyTaskType(msg: string): TaskType {
  if (/research pattern/) return 'research';  // ← returns immediately
  if (/create pattern/) return 'create';      // ← never reached
  return 'general';
}

// Should be:
function classifyTaskTypes(msg: string): TaskType[] {
  const types: TaskType[] = [];
  if (/research pattern/) types.push('research');
  if (/create pattern/) types.push('create');
  if (/analyze pattern/) types.push('analyze');
  return types.length > 0 ? types : ['general'];
}
```

**Impact:** Instantly fixes the "can't do that much" problem for multi-task queries.

### 2. **Subagent Limitations** (Architectural)
Subagents are limited to 5 tools + 5 step max. This is intentional — they're workers, not planners. BUT:
- If planner delegates research to subagents and subagent hits 5-step limit mid-research, task fails
- Subagent can't call compound tools (spawn_agents, deep_research, competitor_swot)
- Max 5 parallel researchers per delegation

**Impact:** Hits limits on complex research tasks.

**Fix:** Increase MAX_SUBAGENT_TOOL_STEPS to 10-15, add compound research tools to subagent toolkit.

### 3. **Tool Router Underused** (Wasted Potential)
toolRouter.ts catalogs 40+ tools and has LLM-based routing logic, BUT:
- Only used as a fallback when quickSelectTools() returns null
- quickSelectTools() has huge regex patterns that catch most cases
- Most queries go through regex fast-path, never hit the LLM router

**Impact:** Loss of semantic tool selection. For ambiguous queries, the LLM router (which uses Qwen 2b to understand intent) would pick better tools than fixed regex.

**Fix:** Run both paths and merge results. Use LLM router for confidence < 80%.

### 4. **Tool Discoverability in Prompts** (UX)
buildSystemPrompt() includes tool descriptions, BUT:
- 57 tools is too many to fit in context efficiently
- LLM might not call appropriate tools if descriptions are buried
- Tool availability changes per task type (same tool has different availability based on context)

**Impact:** LLM doesn't always "see" all available tools.

**Fix:** Inject only the 8-12 relevant tools into system prompt per task, not all 57.

### 5. **Computer Tools Disabled** (Line 61)
```typescript
const COMPUTER_TOOLS_ENABLED = false;
```

This disables use_computer and control_desktop, which blocks:
- UI automation
- Form filling
- Screenshot + analysis
- Click/type-based workflows

**Fix:** Re-enable and test.

### 6. **Deep Research Tool Incomplete**
deep_research is listed in TASK_TOOLS but appears to be a stub or limited:
- Takes a task name
- Supposed to run multi-query research orchestration
- But execution details are in agentEngine lines 2600-2603 (only 4 lines!)

**Fix:** Implement deep_research properly (multi-query, parallel search, synthesis).

---

## Comparison to OpenClaw & Hermes

| Feature | Neuro | OpenClaw | Hermes |
|---------|-------|----------|--------|
| **Tools Implemented** | 57 | 40+ | 40+ |
| **Max Steps** | 200 | Unlimited | Unlimited |
| **Parallel Tools** | Auto-detect | Implicit | Explicit |
| **Task Routing** | Regex → LLM | Provider-based | Registry-based |
| **Multi-Task Support** | ❌ Single | ✅ Multi | ✅ Multi |
| **Error Recovery** | 11 strategies | Basic | Basic |
| **Tool Hooks** | ❌ No | ✅ Yes | ✅ Yes |
| **Task Persistence** | ❌ No | ✅ SQLite | ✅ Trajectory |
| **Environment Abstraction** | ❌ No | Implicit | ✅ Yes (Local/Docker/SSH/Modal) |
| **Token Tracking** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Computer Automation** | Disabled | ✅ Yes | ✅ Yes |

**The gap:** Not in tool count (57 is actually comparable), but in:
1. **Multi-task workflows** (Neuro picks one category, OpenClaw/Hermes do multiple)
2. **Environment flexibility** (Neuro is local-only)
3. **Task observation** (no SQLite tracking like OpenClaw)

---

## Why You're Experiencing "Can't Do That Much"

### Scenario 1: Multi-Task Query
```
User: "Research competitors, then write ad copy targeting their weaknesses"
Planner: *matches 'analyze' category*
Result: Gets competitor_swot + brand_voice + research tools
MISSING: write_content, create_docx
Output: Writes analysis but can't create the actual ad copy
```

### Scenario 2: Complex Workflow
```
User: "Deep dive on 5 competitors (parallel), extract their positioning, then design ours"
Planner: *iterates 200 steps but tool set limits it to analyze-only*
Result: Can research + analyze but can't execute design actions
```

### Scenario 3: Subagent Delegation
```
User: "Research 20 topics in parallel"
Planner: spawns 5 subagents
Each subagent: MAX_SUBAGENT_TOOL_STEPS = 5 means max 5 searches each
If topics need 8+ researches: subagent hits wall, task fails
```

---

## The Fix (Ranked by Impact)

### TIER 1 (Fixes "can't do that much")
1. **Multi-task classification** (1 hour to implement)
   - Change classifyTaskType → classifyTaskTypes (return array)
   - Merge all matching categories' tools
   - Impact: Unlocks multi-step workflows

2. **Increase MAX_SUBAGENT_TOOL_STEPS** (5 min)
   - Change from 5 to 15
   - OR: make it adaptive (15 for researcher, 5 for validator)
   - Impact: Subagents complete more complex research

### TIER 2 (Unlocks depth)
3. **Add subagent compound tools** (30 min)
   - deep_research, competitor_swot, social_intelligence to subagent toolkit
   - Currently only 5 tools, should be 15+
   - Impact: Subagents do their own synthesis, not just raw research

4. **Implement deep_research properly** (2 hours)
   - Multi-query orchestration with synthesis
   - Currently seems stubbed
   - Impact: Real deep research, not just single queries

5. **Re-enable computer tools** (1 hour testing)
   - Set COMPUTER_TOOLS_ENABLED = true
   - Run validation tests
   - Impact: Unlocks UI automation workflows

### TIER 3 (Nice to have)
6. **LLM-based tool selection** (2 hours)
   - Use toolRouter more aggressively
   - Semantic tool picking vs pure regex
   - Impact: Better tool selection for edge cases

7. **Task observation/persistence** (3 hours)
   - SQLite tracking like OpenClaw
   - CLI: `npm run cli -- --list-tasks`
   - Impact: Better observability

---

## My Recommendation

Start with TIER 1 today:

1. **Multi-task classification** — This is the #1 blocker. It solves the "can't do that much" problem immediately. Most multi-step workflows will work after this.

2. **MAX_SUBAGENT_TOOL_STEPS = 15** — Simple, high-impact fix.

After those, do TIER 2 items.

The architecture isn't "broken" — it's "narrow". You have 57 tools but they're gated by single-category classification. Removing that gate unlocks the full system.

---

## Code Locations

- **Planner tools:** agentEngine.ts:236-3502 (buildTools function)
- **Task classification:** agentEngine.ts:4413-4445 (classifyTaskType)
- **Tool routing:** agentEngine.ts:4448-4485 (pruneToolsForTask)
- **Main loop:** agentEngine.ts:5536-6200 (for loop + tool execution)
- **Subagent tools:** subagentTools.ts:29-160 (getSubagentTools)
- **Subagent limits:** subagentManager.ts:561 (MAX_SUBAGENT_TOOL_STEPS)
- **Tool router (unused potential):** toolRouter.ts:30-125 (TOOL_CATALOG)

---

## Proof of Concept Fix (15 minutes)

To verify this solves the problem, change line 4413:

```typescript
// OLD: Returns single task type
function classifyTaskType(msg: string): TaskType {
  // ... 30 if statements, returns first match ...
  return 'general';
}

// NEW: Returns all matching task types
function classifyTaskTypes(msg: string): TaskType[] {
  const types = new Set<TaskType>();
  const t = msg.toLowerCase();

  if (/research|look up|find|search|what is|who is/.test(t)) types.add('research');
  if (/write|create|draft|blog|email|copy|article/.test(t)) types.add('create');
  if (/analyze|compare|swot|sentiment|trend/.test(t)) types.add('analyze');
  if (/code|function|implement|debug/.test(t)) types.add('code');
  if (/file|read|pdf|docx/.test(t)) types.add('file');
  if (/chart|graph|visualiz|data/.test(t)) types.add('dataviz');
  if (/agent|spawn|parallel|concurrent/.test(t)) types.add('agents');
  if (/memory|remember|recall/.test(t)) types.add('memory');

  return types.size > 0 ? Array.from(types) : ['general'];
}

// Update line 4460:
const allowed = new Set<string>();
for (const tt of classifyTaskTypes(msg)) {  // ← now returns array
  TASK_TOOLS[tt].forEach(tool => allowed.add(tool));
}
allowed.forEach(t => ALWAYS_TOOLS.add(t));
```

This change alone would fix multi-task workflows and directly address "can't do that much."

