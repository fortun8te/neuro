# Subagent Architecture: Deep Dive + Increased Task Support

**Current State:** MAX_SUBAGENT_TOOL_STEPS = 15
**Proposed:** Increase to 25-30 for more complex workflows
**Example Task:** Research XYZ → Make → Write

---

## How Subagent Tasks Work (Current)

### The ReAct Loop

Each subagent runs a simple loop:

```
for step = 1 to MAX_SUBAGENT_TOOL_STEPS:
  1. Get LLM prompt with:
     - Available tools (web_search, browse, summarize, etc.)
     - Task description
     - Previous step results

  2. LLM decides:
     a) Call a tool with arguments
     b) Give final answer (done)

  3. If tool call:
     - Execute tool (web search, page scrape, etc.)
     - Add result to history
     - Loop back to step 1

  4. If final answer:
     - Break out of loop
     - Return synthesis to parent agent
```

### Example Breakdown: "Research Python async frameworks"

**Step 1 (LLM output):**
```
Tool: web_search
Arguments: {"query": "Python async frameworks 2026", "max_results": 5}
```
↓ Execute
```
Result: 5 search results about asyncio, aiohttp, FastAPI, Trio, etc.
```

**Step 2 (LLM output):**
```
Tool: browse
Arguments: {"url": "https://realpython.com/async-io-python/"}
```
↓ Execute
```
Result: Full article about Python async with examples
```

**Step 3 (LLM output):**
```
Tool: summarize
Arguments: {"text": "[previous results]", "focus": "pros/cons of each framework"}
```
↓ Execute
```
Result: Summary: asyncio (batteries-included), aiohttp (simple), FastAPI (modern), etc.
```

**Step 4 (LLM output):**
```
[Final answer - no tool call]
Found 3 main Python async frameworks:
1. asyncio — Built-in, mature, batteries-included
2. aiohttp — Lightweight HTTP client/server
3. FastAPI — Modern ASGI framework with auto-docs
...
```

Loop exits. Subagent returns synthesis to parent.

---

## Current Limits

### File: `subagentManager.ts` (line 244)
```typescript
const MAX_SUBAGENT_TOOL_STEPS = 15;
```

### Other limits to be aware of:
```typescript
// Per-subagent timeout: 120 seconds
subagentTimeoutMs: 120_000

// Max concurrent subagents: 10 (can spawn up to 10 in parallel)
maxConcurrentSubagents: 10

// Retries on failure: 3 attempts
retryAttempts: 3

// Per-preset pool sizes
poolSizeByPreset: {
  SQ: 1,      // Super Quick — single researcher
  QK: 2,      // Quick — 2 parallel
  NR: 3,      // Normal — 3 parallel
  EX: 4,      // Extended — 4 parallel
  MX: 5       // Maximum — 5 parallel
}
```

---

## Why Increase to 25-30?

### Current Reality (15 steps)

Complex research needs ~3-4 steps:
1. Initial search (1 step)
2. Browse key link (1 step)
3. Summarize findings (1 step)
4. Final answer (not counted, just decision)

So: **5 topics × 3 steps each = 15 steps** ✅ Fits in current budget

But for **deep research on 3 topics with nuance**:
- Topic 1: Search + Browse + Deep dive + Analyze = 4 steps
- Topic 2: Search + Browse + Cross-reference = 3 steps
- Topic 3: Search + Browse + Synthesis = 3 steps
- **Total: 10+ steps** — Getting tight with 15 budget

### Proposed: 25-30 steps

Allows:
- **Deep dives on 5-6 topics** (4-5 steps each)
- **With verification** (re-check sources)
- **With synthesis** (compare across sources)
- **With confidence scoring** (low/medium/high quality)

**Example: "Research 6 competitors comprehensively"**
```
Competitor 1:
  - Search baseline (1 step)
  - Browse company website (1 step)
  - Browse recent news (1 step)
  - Browse customer reviews (1 step)
  - Summarize findings (1 step)
  = 5 steps per competitor × 6 = 30 steps

Plus synthesis pass:
  - Compare all 6 competitors (1 step)
  = 31 steps total

With budget of 25-30, we can handle 5-6 deep competitors.
```

---

## Performance Impact of Increasing Steps

### Time Analysis

Each step takes ~2-3 seconds (median):
- LLM inference: 1-2s
- Tool execution: 0.5-1.5s
- I/O overhead: 0.2-0.5s

**Current (15 steps):** ~30-45 seconds per subagent
**Proposed (25 steps):** ~50-75 seconds per subagent
**Timeout:** 120 seconds — plenty of headroom ✅

### Parallelization Impact

With `poolSizeByPreset`:
- **EX (Extended)**: 4 subagents × 25 steps = 100 tool calls total
- **MX (Maximum)**: 5 subagents × 25 steps = 125 tool calls total

Safe because:
- Tools are read-only (parallel-safe)
- No write contention (SimpleMutex only locks on write tools)
- Network concurrency handled by Wayfarer (concurrency: 50)

---

## Example Workflow: "Research XYZ → Make → Write"

### Phase 1: Research XYZ (Subagent Pool)

**Task Breakdown:**
```
User Query:
"Research the top 3 video editing tools (DaVinci Resolve, Adobe Premiere, Final Cut Pro).
Create 3 design mockups showcasing each one.
Write a 500-word comparison guide."
```

**Step 1 — Task Classification**
```
classifyTaskTypes("research...make...write")
→ ['research', 'create', 'code']
→ Planner gets tools: [web_search, browse, ...] + [design_tool, create_image] + [write_content]
```

**Step 2 — Orchestrator Spawns Subagents**
```
Orchestrator: "I need deep research on 3 tools. Spawning 3 subagents."

Subagent 1 (task="Research DaVinci Resolve"):
├─ Step 1: web_search("DaVinci Resolve features 2026")
│  Result: 5 sources about color grading, editing, fusion, fairlight
│
├─ Step 2: browse("https://blackmagicdesign.com/products/davinciresolve")
│  Result: Official specs, pricing, comparison to alternatives
│
├─ Step 3: browse("https://reddit.com/r/davinciresolve/...")
│  Result: User reviews, pain points, community feedback
│
├─ Step 4: summarize(results)
│  Result: Comprehensive summary (features, pros, cons, pricing)
│
└─ Final answer: [Synthesis of all findings]

[Simultaneously running...]

Subagent 2 (task="Research Adobe Premiere Pro"):
├─ Step 1: web_search("Adobe Premiere Pro 2026 features")
├─ Step 2: browse(official page)
├─ Step 3: browse(reddit/reviews)
├─ Step 4: summarize(results)
└─ Final answer: [Synthesis]

Subagent 3 (task="Research Final Cut Pro"):
├─ Step 1-4: [Same pattern as above]
└─ Final answer: [Synthesis]

All 3 running in PARALLEL (takes ~60 seconds total, not 3×60)
```

**Output from Phase 1:**
```
Research Results:
{
  "davinci_resolve": {
    "features": "Color grading, editing, fusion, fairlight, cut page",
    "pros": "Free version, non-linear editing, VFX capabilities",
    "cons": "Steep learning curve, GPU requirements",
    "pricing": "Free (Studio $295 one-time)"
  },
  "adobe_premiere": {
    "features": "Timeline editing, effects, dynamic link, lumetri color",
    "pros": "Widely used, Adobe ecosystem integration, good for collaboration",
    "cons": "Subscription ($55/mo), slower on weaker hardware",
    "pricing": "Subscription only"
  },
  "final_cut_pro": {
    "features": "Magnetic timeline, multicam, color grading, motion",
    "pros": "One-time purchase, optimized for Mac, fast",
    "cons": "Mac-only, smaller ecosystem, steeper learning curve",
    "pricing": "$300 one-time"
  }
}
```

**Time**: ~60 seconds (3 subagents in parallel, 4 steps each)

---

### Phase 2: Create Mockups (Planner + Tool Use)

**Planner Decision:**
```
"Now I need to create 3 visual mockups. I'll use design tool."

Tool: create_visual_mockup
Prompt: "Create a mockup of DaVinci Resolve interface showing:
- Color grading panel (top right)
- Timeline (bottom)
- Footage preview (left)
- Use professional dark theme, blue accents"

Tool: create_visual_mockup
Prompt: "Create mockup of Adobe Premiere showing:
- Essential graphics panel
- Lumetri color panel
- Timeline with nested sequences"

Tool: create_visual_mockup
Prompt: "Create mockup of Final Cut Pro showing:
- Magnetic timeline (showing clips floating)
- Media library (left)
- Viewer (top center)
- Scoped tools (right)"
```

**Output**: 3 high-quality mockup images

**Time**: ~30 seconds (3 tool calls in sequence)

---

### Phase 3: Write Comparison (Planner)

**Planner Decision:**
```
"Now synthesize everything into a 500-word guide."

Tool: write_content
System prompt: [Research findings from Phase 1]
User prompt: "Write a 500-word comparison guide of the 3 video editing tools.
Structure:
1. Intro (best for whom)
2. Feature comparison table
3. Pricing breakdown
4. Learning curve analysis
5. Recommendation by use case
6. Conclusion"
```

**Output:**
```
# Video Editing Tools Comparison 2026

## DaVinci Resolve: Best for Color Grading Enthusiasts
DaVinci Resolve remains the gold standard for color grading...
[Full 500-word article]
```

**Time**: ~20 seconds

---

## Total Workflow Timeline

```
User Query
↓ (1 second)
Task Classification + Tool Merging
↓ (60 seconds)
Phase 1: Research (3 subagents in parallel, 4 steps each)
↓ (30 seconds)
Phase 2: Create Mockups (3 design tool calls)
↓ (20 seconds)
Phase 3: Write Guide (1 synthesis call)
↓ (1 second)
Final Output: Research summary + 3 mockups + 500-word guide
───────────────────────────────────────────────────────────
TOTAL TIME: ~112 seconds (~2 minutes)
```

**Without parallelization:** ~180 seconds (3 minutes)
**Speedup**: 1.6x faster with subagent parallelization ✅

---

## How to Increase MAX_SUBAGENT_TOOL_STEPS

### Option 1: Increase to 25 (Conservative)
```typescript
// subagentManager.ts line 244
const MAX_SUBAGENT_TOOL_STEPS = 25;  // was 15
```

**Impact:**
- ✅ Allows deeper research on 5 topics
- ✅ Still fits in 120s timeout (25 × 3s = 75s max)
- ✅ Small risk, big benefit
- ✅ Backwards compatible

### Option 2: Increase to 30 (Aggressive)
```typescript
const MAX_SUBAGENT_TOOL_STEPS = 30;  // was 15 (2x improvement)
```

**Impact:**
- ✅ Allows very deep research on 5-6 topics
- ✅ Still fits in timeout (30 × 3s = 90s max)
- ⚠️ Higher memory usage per subagent
- ⚠️ More context in tool history
- ✅ Still backwards compatible

### Option 3: Dynamic Based on Preset
```typescript
function getMaxSubagentSteps(preset: ResearchPreset): number {
  switch (preset) {
    case 'SQ': return 8;   // Super Quick — minimal steps
    case 'QK': return 15;  // Quick — current standard
    case 'NR': return 20;  // Normal — deeper research
    case 'EX': return 25;  // Extended — comprehensive
    case 'MX': return 30;  // Maximum — exhaustive
  }
}
```

**Impact:**
- ✅ Scales with user intent
- ✅ Super Quick still fast
- ✅ Maximum preset gets full power
- ✅ Most flexible approach
- ⚠️ More complex (requires changes in 2+ files)

---

## Recommended Change

**Implement Option 1: Increase to 25**

Simple, low-risk, high-impact change:
- Change 1 line: `const MAX_SUBAGENT_TOOL_STEPS = 25;`
- Allows ~60% more research depth
- Still completes in <100 seconds
- No timeout issues
- Backwards compatible

**Later (Phase 2):** Implement Option 3 (dynamic per preset)

---

## How Subagents Are Different from Planner

### Planner (Main Agent)
- Runs in browser context
- Has access to ALL tools (24+)
- Used for orchestration and decision-making
- Can spawn subagents
- Can see full workflow

### Subagent (Worker Agent)
- Runs in a specific role (researcher, analyzer, creator)
- Has access to SUBSET of tools (5-8)
- Focused on single task (one competitor research, one document write)
- Can't spawn other subagents
- Works in isolation, returns results to parent

### Tool Budget Comparison
```
Planner:
- Max tool calls: UNLIMITED (no step counter)
- Timeout: 60 seconds (session-based)
- Tools: Union of all categories (24+)
- Purpose: Orchestration

Subagent:
- Max tool calls: 15 (currently) → 25 (proposed)
- Timeout: 120 seconds (per subagent)
- Tools: Role-specific subset (5-8)
- Purpose: Focused execution
```

---

## Testing the Change

### Before Change
```bash
# Test deep research on 5 competitors
npm run dev
# AgentPanel → "Research 5 competitors: Apple, Microsoft, Google, Amazon, Meta"
# Expected: Some compression (not all details)
```

### After Change (25 steps)
```bash
npm run dev
# Same query
# Expected: Much more detail per competitor
# Should complete in <80 seconds
```

### Verification
```typescript
// In browser DevTools console
// Should see ~25 tool calls for 5 competitors in parallel
window.__SUBAGENT_STATS__ = {
  totalToolCalls: 125,  // 5 subagents × 25 steps
  totalTime: 65000,     // milliseconds
  avgPerSubagent: 5000, // Should be <10s per tool call
}
```

---

## Rollback Plan

If issues occur (OOM, timeouts, etc.):
```typescript
// Quick rollback
const MAX_SUBAGENT_TOOL_STEPS = 15;  // Back to original

// Investigate
// - Check browser memory (DevTools → Memory)
// - Check context size (should be ~4000 tokens)
// - Check Ollama token throughput
```

---

## Next Steps

1. **Implement increase:**
   ```bash
   # Edit line 244 in subagentManager.ts
   const MAX_SUBAGENT_TOOL_STEPS = 25;
   npm run build  # Should still be clean
   ```

2. **Test with benchmark:**
   ```
   Query: "Research 5 Python frameworks in depth"
   Expect: ~4-5 steps per framework
   Time: ~60-75 seconds
   ```

3. **Monitor performance:**
   - Watch browser memory (should stay <200MB)
   - Check tool execution times (should average 2-3s)
   - Verify no timeout errors

4. **Decide on dynamic scaling:**
   - Later: Implement Option 3 (per-preset scaling)
   - Allow MX preset to use 30 steps
   - Keep other presets at current levels

---

## Questions?

- Want to increase to 25 or 30?
- Should we implement dynamic scaling from the start?
- Want to test with specific research queries first?
