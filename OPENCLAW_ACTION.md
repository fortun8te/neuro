# OpenClaw Patterns: Quick Integration Guide
## 7 Patterns to Add to Neuro (From OpenClaw's Production Experience)

---

## What Changed (Updated from original ACTION_PLAN.md)

Original Phase 1.3 (Integration Patterns): 5 frameworks
- MassGen: Trace Analyzer
- LangGraph: Routing Decisions
- AutoGen: Message Handlers
- OpenRouter: Model Router
- 2026: Loop Detection

**NEW Phase 1.3** (Integration Patterns): **6 frameworks + OpenClaw**
- MassGen: Trace Analyzer
- LangGraph: Routing Decisions
- AutoGen: Message Handlers
- OpenRouter: Model Router
- 2026: Loop Detection
- **OpenClaw: 7 patterns (see below)**

---

## 7 OpenClaw Patterns (High ROI, Low Effort)

### Pattern 1: Skill Registry Metadata ⭐⭐⭐ (Highest ROI)
**Time:** 2-3 hours | **Effort:** Copy-paste structure

**What to do:**
```typescript
// Before: Tools scattered, no metadata
const tools = {
  web_search: webSearchTool,
  file_write: fileWriteTool,
};

// After: Tools have discoverable metadata
const tools = {
  web_search: {
    metadata: {
      name: 'Web Search',
      version: '1.0.0',
      category: 'research',
      modelTierRequired: 'standard',
      parallelizable: true,
      timeout: 30000,
      permissions: ['network:internet'],
      examples: [...]
    },
    fn: webSearchTool,
  },
  // ... etc
};
```

**Integration point:** Update `frontend/utils/subagentTools.ts`

**Benefit:**
- Automatic tool discovery
- Audit trail shows tool properties
- Permission checking
- Perfect for benchmark test #3 (routing decisions)

---

### Pattern 2: Task Classifier (Model Routing) ⭐⭐⭐ (High ROI)
**Time:** 1-2 hours | **Effort:** New small function + integrate

**What to do:**
```typescript
// NEW: frontend/agentic/taskClassifier.ts

async function classifyTaskComplexity(prompt: string): Promise<'simple' | 'standard' | 'complex' | 'deep'> {
  // Use FAST model (0.8b) to classify
  // Output: one of 4 complexity levels
  // Route to appropriate model tier
}

// Usage: Before calling orchestrator, classify first
const complexity = await classifyTaskComplexity(userPrompt);
const model = await routeModel(complexity);
```

**Integration point:** `frontend/utils/modelRouter.ts` (NEW)

**Benefit:**
- Save 50%+ tokens on simple tasks
- Automatic model selection
- Log routing decision (benchmark test #3)

---

### Pattern 3: Checkpoint Manager (Crash Recovery) ⭐⭐ (Medium ROI)
**Time:** 3-4 hours | **Effort:** State persistence + resumption logic

**What to do:**
```typescript
// NEW: frontend/agentic/checkpointManager.ts

class CheckpointManager {
  checkpoint(cycleId, stage, step, state) {
    // Save current state to IndexedDB
  }

  async resume(cycleId) {
    // Load latest checkpoint
    // Return state to resume from
  }
}

// Usage: Save state after each stage
checkpointMgr.checkpoint(cycleId, 'research', 1, currentState);
researchOutput = await useOrchestratedResearch(...);

checkpointMgr.checkpoint(cycleId, 'objections', 1, { ...currentState, researchOutput });
objectionsOutput = await useObjections(...);

// On crash + resume: load latest checkpoint, skip redone stages
```

**Integration point:** `frontend/hooks/useCycleLoop.ts` (MODIFY)

**Benefit:**
- Zero data loss on crash
- Can pause/resume without re-running stages
- Better UX for long cycles

---

### Pattern 4: Tool Metadata Frontmatter ⭐⭐ (Medium ROI)
**Time:** 1 hour | **Effort:** Documentation + schema

**What to do:**
```yaml
# Every tool documents itself

# tool: web_search
name: Web Search
version: 1.0.0
description: Search the web using Wayfarer + SearXNG
category: research
model_tier_required: standard
parallelizable: true
timeout: 30000
cost_tier: low
permissions:
  - network:internet
  - api:wayfarer
examples:
  - input: "Search: TypeScript frameworks"
    output: "[{url, title, snippet}, ...]"
```

**Integration point:** `frontend/utils/subagentTools.ts` (documentation)

**Benefit:**
- Self-documenting tools
- Automatic permission checking
- Audit trail more informative

---

### Pattern 5: Wayfarer Confidence Scores ⭐ (Lower Priority)
**Time:** 2 hours | **Effort:** Extend Wayfarer response

**What to do:**
```typescript
// Current Wayfarer response:
{ content: "..." }

// Enhanced response (Firecrawl pattern):
{
  content: "...",
  metadata: {
    confidence: 0.95, // How confident is extraction?
    sections: [
      { title: "Intro", wordCount: 245 },
      { title: "Details", wordCount: 1200 },
    ],
    sourceQuality: 'high', // based on domain authority
  }
}
```

**Integration point:** `frontend/utils/wayfarer.ts` (response format)

**Benefit:**
- Synthesis agent knows which sections are most reliable
- Audit trail shows extraction confidence
- Better for multi-source synthesis

---

### Pattern 6: Campaign Isolation (Already Done) ✅
**Status:** Already implemented in your preset system

```typescript
// Your system already does this:
campaign.researchDepth = 'EX' // → uses qwen3.5:9b
campaign.researchDepth = 'SQ' // → uses qwen3.5:2b

// Parallel campaigns with different presets automatically isolate
// Model tiers don't cross-contaminate
```

**Benefit:** No work needed, validates architecture at scale (OpenClaw handles 12+ channels in production)

---

### Pattern 7: Sandboxing (Future, Phase 3+)
**Status:** Not urgent

```typescript
// For Phase 3 when agents self-improve
// Reference: KubeClaw for kubernetes
// For now: agents run in Node.js, can't harm system

// Post-Phase 1: consider adding nanoVM or QuickJS sandbox
// for agent code execution
```

---

## Integration Timeline (Updated Phase 1.3)

### Phase 1.3: Integration Patterns (8-10h → **11-13h**)

**Original 5 patterns (8-10h):**
- Trace Analyzer (MassGen) — 1h
- Routing Decisions (LangGraph) — 1h
- Message Handlers (AutoGen) — 1h
- Model Router (OpenRouter) — 1h
- Loop Detection (2026) — 1h
- **Testing & integration** — 3-5h

**Add 7 OpenClaw Patterns (+3-4h):**
- Pattern 1: Skill metadata — 2-3h
- Pattern 2: Task classifier — 1-2h
- Pattern 3: Checkpoints — 3-4h ← Do this FIRST
- Patterns 4-7: Skip for now (low priority or done)

**Optimized approach:**
1. **First:** Do Pattern 3 (Checkpoints) — enables crash recovery immediately
2. **Then:** Do Pattern 1 (Skill metadata) — enables tool discovery for benchmark
3. **Then:** Do Pattern 2 (Task classifier) — enables model routing test
4. **Integrate all 5 frameworks** — with OpenClaw metadata + checkpoints

**New timeline:**
- 1.3: Integration Patterns (MassGen + LangGraph + AutoGen + OpenRouter + 2026 + OpenClaw) — **11-13h instead of 8-10h**
- Total Phase 1: **25-32h instead of 22-29h**
- Still done by end of week

---

## Updated Architecture with OpenClaw Patterns

```
┌─── INFRASTRUCTURE ─────────────────────────────────────────────┐
│  Ollama, Wayfarer, SearXNG (local/remote)                      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─── CHECKPOINT MANAGER (OpenClaw Pattern 3) ─────────────────┐
│  Save state after each stage                                  │
│  Resume from last checkpoint on crash                         │
│  Zero data loss                                               │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─── TASK CLASSIFIER (OpenClaw Pattern 2) ─────────────────────┐
│  Classify: simple → standard → complex → deep               │
│  Route to: 0.8b → 2b → 4b → 9b → 27b                       │
│  Save 50%+ tokens on simple tasks                            │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─── MODEL ROUTING (with OpenClaw fallback) ──────────────────┐
│  Select model by complexity                                  │
│  Log decision (LangGraph pattern)                            │
│  Fallback if model unavailable (OpenRouter pattern)          │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─── AGENTIC CORE ─────────────────────────────────────────────┐
│  ReAct Loop with:                                             │
│  - Message Handlers (AutoGen pattern)                        │
│  - Loop Detection (2026 pattern)                             │
│  - Tool Metadata (OpenClaw Pattern 1)                        │
│  - Routing Decisions (LangGraph pattern)                     │
│  - Trace Analyzer (MassGen pattern)                          │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─── SUBAGENT LAYER ─────────────────────────────────────────┐
│  Researchers, Analyzer, Loop Detector, Manager               │
│  All with tool metadata for discovery                        │
│  All save checkpoints                                        │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─── AUDIT TRAIL ────────────────────────────────────────────┐
│  Tool calls + metadata                                       │
│  Model selections + reasoning                                │
│  Routing decisions + confidence                              │
│  Checkpoints at each stage                                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Benchmark Impact (How OpenClaw Helps Tests Pass)

| Test | OpenClaw Pattern | How It Helps |
|------|------------------|-------------|
| **Tool Multiplicity** | Skill Metadata | Tools discoverable, audit shows count |
| **Model Switching** | Task Classifier | Explicitly routes to different tiers |
| **Routing Decisions** | All 7 patterns | Explicit logged decisions everywhere |
| **Parallelization** | Campaign Isolation | Parallel campaigns don't interfere |
| **Sub-Agent Spawning** | Trace Analyzer | Analyzer spawns, extracts insights |
| **Loop Detection** | Checkpoint Manager | State hashes prove no loop |

---

## OpenClaw Pattern Priority

### Must-Have (Do Immediately)
- [ ] Pattern 3: Checkpoint Manager (enables crash recovery)
- [ ] Pattern 1: Skill Metadata (enables tool discovery)
- [ ] Pattern 2: Task Classifier (enables model routing proof)

### Nice-to-Have (If Time)
- [ ] Pattern 4: Tool Metadata Frontmatter (documentation)
- [ ] Pattern 5: Wayfarer Confidence Scores (better synthesis)

### Not Yet (Phase 3+)
- [ ] Pattern 6: Already done via presets
- [ ] Pattern 7: Sandboxing (only for self-improvement phase)

---

## How This Compares to OpenClaw

| Feature | OpenClaw | Neuro (with OpenClaw patterns) |
|---------|----------|------|
| **Skill Metadata** | 13,729 registry | Internal tool discovery |
| **Model Routing** | Task-based (simple/complex) | Complexity-based (4 tiers) |
| **Crash Recovery** | Heartbeat loop | Checkpoint manager |
| **Web Search** | Multi-provider | Single (Wayfarer) but visual |
| **Visual Intelligence** | No | Yes (Wayfarer Plus) |
| **Learning Loop** | Per-task | Per-cycle (Phase 7+) |

---

## Files to Create/Modify (Updated from ACTION_PLAN.md)

**Add from OpenClaw:**
```
frontend/agentic/
├── checkpointManager.ts    (NEW - Pattern 3)
├── taskClassifier.ts       (NEW - Pattern 2)
└── skillRegistry.ts        (NEW - Pattern 1, extends subagentTools)

frontend/utils/
└── modelRouter.ts          (MODIFY - integrate classifier)
```

**Modify:**
```
frontend/hooks/
└── useCycleLoop.ts         (add checkpoint logic)

frontend/utils/
├── subagentTools.ts        (add metadata)
└── wayfarer.ts             (add confidence scores - optional)
```

---

## Summary

**OpenClaw validates & enhances your architecture:**
- ✅ Task classification (you'll implement)
- ✅ Model routing (you have, improve with classifier)
- ✅ Crash recovery (checkpoint manager)
- ✅ Tool metadata (skill discovery)
- ✅ Multi-channel isolation (you have via presets)

**Time impact:**
- +3-4 hours for 3 critical patterns
- Phase 1 still done by end of week
- Massive value: crash recovery + automated model routing

**Benefit:**
- Beat OpenClaw on desire-driven research + visual intelligence
- Learn from OpenClaw's proven patterns
- 157K stars = production-tested architecture

---

**Recommendation: Add Patterns 1, 2, 3 to Phase 1.3. Skip 4-7 for now.**

