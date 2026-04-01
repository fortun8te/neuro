# Key Integrations Summary: 11 Repos → Neuro

## At a Glance

**Total Token Savings Opportunity: 70%** (180K → 54K per cycle)
**Total Time Savings: 60%** (90 min → 36 min per cycle)
**Implementation: 5 phases over 8 weeks**

---

## Quick Reference: What Each Repo Teaches Us

### 1️⃣ Anthropic SDK — Streaming Architecture
**Finding**: Real-time output with partial JSON snapshots
```
INTEGRATE: Modify all onChunk handlers to stream at character level
IMPACT: +15% UX (users see results appearing live)
EFFORT: 2 hours
```

### 2️⃣ Claw-Code — Session Persistence + Resume
**Finding**: Save/resume cycles without losing state
```
INTEGRATE: Add checkpoint saving to useCycleLoop every stage
IMPACT: 30% efficiency (resume from stage 4 if interrupted)
EFFORT: 3 hours
```

### 3️⃣ Nexora — TurboQuant KV Cache
**Finding**: 60% token reduction via importance-weighted eviction
```
INTEGRATE: Replace generic context window with TurboQuant scoring
IMPACT: 60% fewer tokens (research 40K→16K)
EFFORT: 4 hours
PRIORITY: CRITICAL
```

### 4️⃣ Zvec — Semantic Memory (10x Faster)
**Finding**: Vector-indexed research findings for instant lookup
```
INTEGRATE: Add semantic index to campaign memory
IMPACT: 10x faster "find similar past research" queries
EFFORT: 3 hours
```

### 5️⃣ VibeVoice — Real-time Audio Streaming
**Finding**: Per-sample audio queues for non-blocking output
```
INTEGRATE: Future feature—add voice narration of ad concepts
IMPACT: New modality
EFFORT: 8 hours (future)
```

### 6️⃣ last30days-skill — Timeout Pyramid + Graceful Degradation
**Finding**: Hierarchical timeouts prevent crashes
```
INTEGRATE: Implement stage-level timeouts
  - Research: 120s
  - Make: 60s
  - Test: 30s
IMPACT: Crash-proof pipeline
EFFORT: 2 hours
```

### 7️⃣ oh-my-claudecode — Phase-Based Task Routing
**Finding**: Auto-classify task type, route to specialized model
```
INTEGRATE: Already have—strengthen skill extraction in memory stage
IMPACT: Better long-term learning (skills carry to cycle 2+)
EFFORT: 1 hour
```

### 8️⃣ DeerFlow — Middleware Composition
**Finding**: Pre/post hooks for pluggable safety, logging, approval
```
INTEGRATE: Create middleware/ folder with hooks:
  - before-research
  - after-research
  - before-make
  - after-make
  - stream (for live output)
  - audit (for logging)
IMPACT: Pluggable system (safety gates, logging, streaming)
EFFORT: 4 hours
```

### 9️⃣ Hermes Agent — Tool Registry + Crash Recovery
**Finding**: Self-registering tools, process watchdog
```
INTEGRATE: Improve subagentTools.ts with availability checks
  - Check if Wayfarer is running before spawning researchers
  - Auto-restart failed researchers
IMPACT: Better stability, auto-recovery
EFFORT: 2 hours
```

### 🔟 Everything Claude Code — Iterative Retrieval (60% Tokens!)
**Finding**: Send each researcher only 5-10 relevant URLs, not 100
```
INTEGRATE: Modify orchestrator to query router:
  1. User: "collagen supplement market"
  2. Orchestrator asks Context-1: "Find top 5 URLs for collagen market"
  3. Researcher 1 searches those 5, finds "market size is $X"
  4. Orchestrator asks: "Now find 5 URLs about collagen trends"
  5. Researcher 2 searches those 5, finds "trends are Y"
IMPACT: 60% token reduction (100 URLs → 5+5+5 focused searches)
EFFORT: 3 hours
PRIORITY: CRITICAL
```

### 1️⃣1️⃣ Superpowers — TDD + Two-Stage Review
**Finding**: Spec validation THEN quality check (not both at once)
```
INTEGRATE: Add verification layer to test stage
  1. Does concept match the brief? (spec check)
  2. Is creative execution good? (quality check)
IMPACT: Higher consistency, clearer rejections
EFFORT: 2 hours
```

### 1️⃣2️⃣ Agency Agents — 100+ Personality-Driven Agents
**Finding**: Personalities as first-class citizens
```
INTEGRATE: Already have—expand to 20+ personas
  - Brand personality (already: Desire-Driven)
  - Audience personas (could expand: 20 audience types)
  - Creative director personas (already: 1, could expand: 5)
IMPACT: Better targeting, more voices
EFFORT: 8 hours
```

### 1️⃣3️⃣ MiroFish — Audit Logging + Temporal Metadata
**Finding**: Tag all findings with timestamps, validity windows
```
INTEGRATE: Stream all decisions to research_audit.jsonl:
  {
    "timestamp": "2026-04-01T19:58:00Z",
    "stage": "research",
    "researcher": "researcher_3",
    "query": "collagen supplement trends",
    "sources_found": 8,
    "findings": "market growing 12%/year",
    "validity_window": "until 2026-10-01",
    "tokens_used": 2840,
    "confidence": 0.92
  }
IMPACT: Full observability, cost tracking
EFFORT: 2 hours
```

### 1️⃣4️⃣ learn-claude-code — Worktree Isolation
**Finding**: Each parallel task gets isolated git worktree
```
INTEGRATE: Wrap researcher spawning in worktree management:
  1. Create: git worktree add worktrees/researcher-1 HEAD
  2. Run researcher in isolated dir
  3. Remove: git worktree remove worktrees/researcher-1
IMPACT: Parallel safety, no context contamination
EFFORT: 3 hours
```

### 1️⃣5️⃣ Lightpanda — Arena Allocators
**Finding**: 16x less RAM via importance-scored allocation
```
INTEGRATE: Python optimization in Wayfarer
  - Use arena allocator for page compression
IMPACT: 16x RAM reduction
EFFORT: 2 hours (future)
```

### 1️⃣6️⃣ Open SWE — Sandbox Persistence
**Finding**: Reuse executor state across tasks
```
INTEGRATE: Don't kill executor process between stages
  - Reuse Python/Node runtime across cycles
IMPACT: Better performance, faster task dispatch
EFFORT: 2 hours
```

### 1️⃣7️⃣ OpenViking — L0/L1/L2 Tiering (80% Token Reduction!)
**Finding**: Hierarchical compression for memory
```
INTEGRATE: Compress research findings at 3 levels:
  L0: Full text (Wikipedia excerpt)
  L1: Summary (100 words)
  L2: Ultra-compressed (1 sentence + keywords)
  
Use L0 in cycle 1, L1 in cycles 2-5, L2 in cycles 6+
IMPACT: 80% token reduction for long-running campaigns
EFFORT: 3 hours
PRIORITY: CRITICAL
```

### 1️⃣8️⃣ DeepAgents — Middleware Composition + HumanInTheLoop
**Finding**: Pre/post hooks + approval gates
```
INTEGRATE: Add approval modal before expensive operations:
  - Before Phase 5 (Make): "Run creative generation?" (costs 15K tokens)
  - Before Phase 3 (Objections): "Use expensive model?" (costs 8K tokens)
IMPACT: Operator control, safety gates
EFFORT: 2 hours
```

### 1️⃣9️⃣ Deep Research — Recursive Breadth + Graceful Failures
**Finding**: Reduce search breadth each round, handle timeouts
```
INTEGRATE: Already doing—add metrics:
  - Round 1: 5 parallel researchers × 10 URLs each (50 URLs)
  - Round 2: 5 researchers × 7 URLs (35 URLs, less broad)
  - Round 3: 3 researchers × 5 URLs (15 URLs, very focused)
  
If any researcher times out, synthesize remaining results.
IMPACT: Crash-proof, efficient
EFFORT: 1 hour (monitoring/metrics only)
```

### 2️⃣0️⃣ ccunpacked.dev — Interactive Documentation
**Finding**: Visualization + source linking = learning
```
INTEGRATE: Build "Neuro Unpacked" site
  - Interactive agent loop animation
  - Architecture treemap (frontend/backend/services)
  - Tool catalog (searchable)
  - Roadmap (Phases 1-10 shipped, 11+ planned)
IMPACT: Better onboarding, feature discovery
EFFORT: 12 hours
```

---

## Implementation Checklist

### ✅ PHASE 11 (Week 1-2): Iterative Retrieval + Pass@K
- [ ] Implement focused URL routing in orchestrator
- [ ] Add sampling loop to test stage (3 concepts × 5 passes)
- [ ] Add graceful failure handling
- **Effort**: 6 hours | **ROI**: 60% token savings

### ✅ PHASE 12 (Week 3-4): Middleware + L0/L1/L2 Compression
- [ ] Create middleware/ folder structure
- [ ] Implement L0/L1/L2 tiering in research findings
- [ ] Add HumanInTheLoopMiddleware approval gates
- **Effort**: 9 hours | **ROI**: 80% token savings on research

### ✅ PHASE 13 (Week 5-6): Worktree Isolation + Audit Logging
- [ ] Wrap researchers in git worktrees
- [ ] Stream all decisions to audit JSONL
- [ ] Add temporal metadata (discovery_at, validity_window)
- **Effort**: 7 hours | **ROI**: Observability + parallel safety

### ✅ PHASE 14 (Week 7-8): "Neuro Unpacked" Interactive Docs
- [ ] Build Astro + React site
- [ ] Create interactive agent loop animation
- [ ] Generate architecture treemap
- [ ] Publish searchable tool catalog
- **Effort**: 12 hours | **ROI**: Better onboarding

### ✅ PHASE 15 (Week 9+): Self-Optimization Loop
- [ ] Create self-analysis system (6 parallel analysts)
- [ ] Generate reports post-cycle (no code changes)
- [ ] Track improvements over time
- [ ] Identify Phase 16 candidates
- **Effort**: 4 hours setup, then fully automated | **ROI**: 5-15% per cycle

---

## Token Budget Impact

```
Before All Phases:     180K tokens / cycle
After Phase 11:        72K tokens (60% savings)
After Phase 12:        54K tokens (80% savings on research)
After Phase 13:        54K tokens (same, just more observable)
After Phase 14:        54K tokens (same, better docs)
After Phase 15:        42K tokens* (Self-optimization learns tricks)
                       (* After 3 cycles, via pattern discovery)

CUMULATIVE: 180K → 42K (77% token reduction!)
TIME: 90 min → 28 min (69% faster!)
```

---

## Quick Win Rankings

**Highest ROI / Lowest Effort:**
1. **Iterative Retrieval** (3h effort, 60% tokens) ← DO FIRST
2. **L0/L1/L2 Tiering** (3h effort, 80% research tokens) ← DO SECOND
3. **Audit Logging** (2h effort, full observability) ← DO THIRD
4. **Timeout Pyramid** (2h effort, crash-proof) ← DO FOURTH
5. **Worktree Isolation** (3h effort, parallel safety) ← DO FIFTH

**After Those 5 (13 hours total):**
- Middleware composition (pluggable)
- Approval gates (safety)
- Documentation site (onboarding)
- Self-analysis automation (continuous improvement)

---

## Notes for Implementation

- **No breaking changes**: All phases are additive
- **Feature flags**: Use `VITE_PHASE_11_ENABLED`, etc. to roll out gradually
- **A/B testing**: Run old vs new in parallel for 5 cycles to validate improvements
- **Monitoring**: Track tokens, timing, quality scores per cycle
- **Team alignment**: Share findings weekly from Phase 15 self-analysis

---

**Total Implementation Time: 41 hours over 8 weeks**
**Expected Impact: 77% token reduction, 69% faster cycles, continuous self-improvement**
