# NEURO Feature Roadmap — Phase 11 & Beyond

**Document Date:** April 2, 2026
**Current Status:** Phase 10 complete (UI animation fixes, em dash enforcement)
**Target Score:** GAIA benchmark 9.9/10 (currently 50% / 9.1 harness quality)

---

## Executive Summary

NEURO has achieved foundational excellence with Phase 10:
- **8 stage pipeline** (research → brand DNA → persona DNA → angles → strategy → copywriting → production → test)
- **Subagent architecture** with parallel execution
- **Desire-driven research** with 5-tier depth presets
- **Advanced evaluation** (12-dimensional testing)
- **Audio streaming** and context compression

However, significant capabilities gaps remain that block GAIA benchmark improvements and real-world production use. This roadmap identifies **15 high-impact features** organized into **3 priority tiers**, with implementation recommendations.

---

## PART 1: SYSTEM INVENTORY

### 1.1 Core Architecture (What Exists)

#### Harness & Pipeline
- **8-stage cycle**: Research → Brand DNA → Persona DNA → Angles → Strategy → Copywriting → Production → Test
- **Execution modes**: Full cycle or concepting-only
- **Mode switching**: Dynamic preset selection (5 tiers: SQ/QK/NR/EX/MX)
- **Cycle management**: Resume/pause, checkpoint/restore, abort signal threading
- **Streaming architecture**: onChunk callbacks for real-time token visibility

#### Research System (Phase 1 + 2)
- **Phase 1 (Desire-Driven)**: 4 steps capturing deep customer psychology
- **Phase 2 (Web Research)**: Orchestrator-router with parallel researchers
- **Sources**: Wayfarer web scraping + SearXNG + visual scouting (Playwright)
- **Compression**: Multi-level semantic compression (qwen2b/4b)
- **Synthesis**: Reflection agent fills gaps, verifies coverage
- **Audit trail**: Complete source tracking (URLs, tokens, models, timing)

#### Creative Pipeline (Stages 2-8)
- **Brand/Persona DNA**: Hybrid LLM + user editing
- **Angles**: 50+ ideas → ranked → user selection
- **Strategy**: Feasibility + execution planning
- **Copywriting**: Per-angle messaging (headlines, CTAs)
- **Production**: Ad generation (Freepik pipeline + HTML)
- **Testing**: 12-dimensional evaluation (objection handling, proof strength, CTA clarity, etc.)

#### Storage & State
- **IndexedDB**: Full cycle persistence (brand, personas, research, outputs, version history)
- **Memory management**: Session checkpoints, resumption capability
- **Context preservation**: Multi-phase context bridge (semantic compression + chain of thought)

#### Infrastructure
- **Ollama**: Local/remote model serving (qwen3.5 family + gpt-oss-20b)
- **Models deployed**: 0.8b / 2b / 4b / 9b / 27b (model tier system)
- **Wayfarer**: Python FastAPI (web scraping + visual analysis + screenshot service)
- **SearXNG**: Docker-based meta-search (port 8888)
- **Config**: Centralized `src/config/infrastructure.ts`

#### Tooling & Agents
- **Research agents**: 3 roles (orchestrator, researcher, reflection)
- **Subagent system**: 9+ roles with specialized capabilities
- **Approval gates**: Cost/risk evaluation before execution
- **Tool registry**: Extensible tool attachment system
- **Skill library**: Reusable prompt templates and workflows

#### Quality & Monitoring
- **Token tracking**: Per-model, per-stage usage logging
- **Cost tracking**: Soft/hard limits, budget alerts
- **Health monitoring**: Ollama/Wayfarer/SearXNG status checks
- **Progress tracking**: Real-time metrics (coverage %, iterations, sources)
- **Error recovery**: Crash recovery manager, graceful degradation

#### UI/UX
- **Live activity bar**: Model name, token count, elapsed time
- **Collapsible sections**: Typed output sections (phase, campaign, orchestrator, etc.)
- **Stage tabs**: Click completed tabs to browse outputs
- **Streaming visualization**: Character-by-character text animation (10x faster in Phase 10)
- **Thinking modal**: Live thinking token display with clickable expansion

---

### 1.2 Capability Assessment

#### What NEURO Does Exceptionally Well
✅ **Deep psychological research** — Desire-driven analysis captures emotional drivers
✅ **Parallel orchestration** — Multiple agents working simultaneously on specialized tasks
✅ **Context preservation** — Semantic compression maintains coherence across 100K+ tokens
✅ **Streaming first** — Real-time token visibility, no blocking batches
✅ **Reproducibility** — Full audit trail for debugging and iteration
✅ **Checkpointing** — Resume after pause with partial output preservation

#### What NEURO Can Do (Partial/Rough)
⚠️ **Vision understanding** — Wayfarer screenshots analyzed, but no deep vision model integration
⚠️ **Long-document handling** — Context compression works, but not optimized for 500K+ tokens
⚠️ **Quality evaluation** — 12-dimensional testing exists, but no automated optimization loop
⚠️ **Export formats** — PDF export stubbed out, no HTML/JSON/PowerPoint
⚠️ **Multi-user workflows** — Single user only, no real-time collaboration
⚠️ **Cost visibility** — Tracking exists, but no per-query breakdown or optimization suggestions

#### What NEURO Cannot Do (Major Gaps)
❌ **Caching at query level** — Repeated prompts hit Ollama fresh (no semantic caching)
❌ **Speculative decoding** — No draft-token acceleration (missing 2-3x speedup)
❌ **Knowledge base** — No RAG system, can't retrieve similar prior research
❌ **Full-text search** — Can't search across past cycles efficiently
❌ **Custom workflows** — Pipeline is fixed, no visual workflow designer
❌ **Automated testing** — No test suite for regression detection
❌ **Model fine-tuning** — Only prompt engineering, no adaptation learning
❌ **Mobile responsiveness** — Desktop-first only
❌ **Offline mode** — Must have Ollama/Wayfarer/SearXNG running
❌ **Real-time collab** — No WebSocket infrastructure

---

### 1.3 GAIA Benchmark Status

**Current Performance:**
- **Score**: 50% (5/10 questions answered correctly)
- **Runtime**: 1,902 seconds (~32 minutes)
- **Harness Quality**: 9.1/10

**Bottlenecks Identified:**
1. **Accuracy gaps** — Some questions answered partially or incorrectly
2. **Speed**: 32 min per run is slow (target: <10 min)
3. **Context window efficiency** — Not maximizing available context
4. **Knowledge retrieval** — Can't reuse findings from prior questions

**Improvements That Would Help GAIA:**
- ✅ Caching (5-10% speed gain per repeat query)
- ✅ Speculative decoding (2-3x speed gain overall)
- ✅ Long-context optimization (enable 100K+ token analysis)
- ✅ Quality eval framework (catch and retry failed answers)
- ✅ Knowledge base (retrieve similar answers for consistency)

---

## PART 2: GAP ANALYSIS

### 2.1 Technical Capability Gaps

#### A. Query-Level Caching & Memoization
**Current State:** Only search result cache (Wayfarer + SearXNG results cached for 5 min)
**Gap:** No LLM output caching — repeated questions always hit model fresh

**Why This Matters:**
- GAIA benchmark has repeated/similar questions → cache could skip 30% of model calls
- Large research cycles repeat similar queries → redundant compression runs
- Cost explosion on large projects (no reuse opportunity)

**Feasibility:** HIGH (simple hash-based cache layer)

---

#### B. Speculative Decoding / Draft Token Optimization
**Current State:** Not implemented
**Gap:** Linear token generation (no parallelization of generation)

**Why This Matters:**
- Small model (qwen2b) generates draft tokens → large model (qwen9b) validates
- Can achieve 2-3x generation speedup on benchmarks
- GAIA currently limited by generation speed

**Feasibility:** MEDIUM (need dual-model orchestration)

---

#### C. Long-Context Document Understanding (100K+)
**Current State:** Context compression works, but not tested at scale
**Gap:** No intelligent chunking strategy for documents > 20K tokens

**Why This Matters:**
- GAIA includes questions requiring analysis of large documents/codebases
- Current: throw away context when over window, lose nuance
- Needed: hierarchical summaries → section retrieval → detail expansion

**Feasibility:** HIGH (Context-1 service already does semantic chunking)

---

#### D. Vision & Multimodal Integration
**Current State:** Wayfarer screenshots + basic qwen vision for competitor analysis
**Gap:** No deep vision model integration into main pipeline

**Why This Matters:**
- Research stage could analyze product images, competitor layouts
- Make stage could generate with visual reasoning
- Wayfarer Plus visual scouting is isolated, not used by downstream stages

**Feasibility:** MEDIUM (need qwen-vl model, API wiring)

---

#### E. Quality Metrics & Automated Evaluation
**Current State:** 12-dimensional test evaluation exists, but no feedback loop
**Gap:** No automated optimization (if quality < threshold, don't proceed)

**Why This Matters:**
- GAIA: if answer quality drops, need to retry with different approach
- Production: gates prevent low-quality output from shipping
- Currently: output whatever the model produces, no quality gate

**Feasibility:** HIGH (add eval-based routing layer)

---

#### F. Knowledge Base / RAG System
**Current State:** None
**Gap:** All findings are siloed in IndexedDB, no semantic search or retrieval

**Why This Matters:**
- GAIA: "Answer based on what we learned in Q1" → retrieve Q1 findings
- Production: avoid re-researching same topic multiple times
- Cross-project consistency: "This is similar to client X research, apply findings"

**Feasibility:** MEDIUM (need vector DB + embedding service)

---

#### G. Advanced Caching (Multi-Level)
**Current State:** Search cache only
**Gap:** No prompt cache, embedding cache, or semantic cache

**Why This Matters:**
- **Prompt cache**: identical prompts to same model → reuse context
- **Embedding cache**: vector embeddings expensive, cache them
- **Semantic cache**: similar prompts → similar outputs (use approximate matching)

**Feasibility:** MEDIUM (need cache implementation per layer)

---

#### H. Cost Tracking & Optimization
**Current State:** Cost tracking exists (hard/soft limits)
**Gap:** No per-query breakdown, no optimization suggestions

**Why This Matters:**
- No visibility into which stage costs most
- Can't suggest "use smaller model for this step"
- No automated budget-aware routing

**Feasibility:** HIGH (mostly logging + math)

---

### 2.2 UX/Feature Gaps

#### I. Export & Sharing (PDF, HTML, JSON, PowerPoint)
**Current State:** PDF export stubbed out
**Gap:** Can't export findings in usable formats

**Why This Matters:**
- Stakeholders can't review outside NEURO
- No shareable reports
- Hides work in IndexedDB

**Feasibility:** HIGH (many libraries available)

---

#### J. Advanced Search & Knowledge Retrieval
**Current State:** None
**Gap:** Can't search past cycles, findings, or decisions

**Why This Matters:**
- "Find research from Q3 about collagen" — impossible today
- Knowledge silos: each project independent
- Missed reuse opportunities

**Feasibility:** MEDIUM (FTS + semantic search)

---

#### K. Real-Time Collaboration & Multi-User
**Current State:** Single user only
**Gap:** No WebSocket, no multi-user state sync

**Why This Matters:**
- Teams can't work together (only watch one person run cycle)
- No shared decision points (can't have co-pilots)

**Feasibility:** MEDIUM-HIGH (need WebSocket + conflict resolution)

---

#### L. Custom Workflow Designer
**Current State:** Fixed 8-stage pipeline
**Gap:** Can't customize for different question types

**Why This Matters:**
- Some questions need deep research, others need quick angles
- Can't skip stages or reorder
- No conditional routing

**Feasibility:** MEDIUM (need workflow engine + UI)

---

#### M. Mobile Responsiveness
**Current State:** Desktop-first UI
**Gap:** No mobile support

**Why This Matters:**
- Can't view results on phone
- Streaming updates not mobile-friendly

**Feasibility:** MEDIUM (React responsive design)

---

#### N. Offline Mode
**Current State:** Must have all services running
**Gap:** Can't work offline with local Ollama

**Why This Matters:**
- Wayfarer/SearXNG optional, but needed for full power
- Local Ollama allows offline creativity work

**Feasibility:** HIGH (mostly graceful degradation)

---

### 2.3 System Architecture Gaps

#### O. Automated Testing Framework
**Current State:** Manual GAIA benchmark run
**Gap:** No regression suite, no continuous evaluation

**Why This Matters:**
- Can't ensure changes don't break quality
- Optimizations might backfire (no early detection)
- GAIA score opaque (no per-question breakdown)

**Feasibility:** MEDIUM (need test data + metrics)

---

#### P. Model Adaptation & Few-Shot Learning
**Current State:** Static prompts
**Gap:** No learning from failures, no in-context adaptation

**Why This Matters:**
- Repeated mistakes (same failure mode)
- No context carry-over between cycles
- Prompts tuned once, not per-task

**Feasibility:** HIGH (mostly prompt engineering)

---

#### Q. Autonomous Improvement Loop
**Current State:** Manual optimization cycle
**Gap:** System doesn't learn from failures

**Why This Matters:**
- After failed attempt, manually adjust and retry
- No pattern detection (this type of question fails because X)
- No automatic refinement (if this fails, try this variation)

**Feasibility:** MEDIUM (need failure tracking + routing logic)

---

## PART 3: DEEP THINKING & STRATEGIC PROPOSALS

### Feature Proposal A: Query-Level Caching & Memoization

**Problem Statement:**
Every time a prompt is repeated (same question, same model), NEURO hits Ollama fresh. No memoization of LLM outputs. For GAIA with repeated questions, this is 10-30% of calls wasted.

**Proposed Solution:**
1. **Prompt hash cache**: hash(prompt + model) → cached response (TTL: 24h)
2. **Semantic cache**: embedding-based similarity (find "similar" past prompts, suggest cached response)
3. **Embedding cache**: cache vector embeddings for retrieval
4. **Session cache**: in-memory cache for within-session reuse

**Implementation:**
- Add cache layer to `ollama.ts` (before HTTP call)
- Key: `SHA256(prompt + model + params)`
- Value: `{ text, tokens, timestamp }`
- Persistence: IndexedDB for cross-session
- Invalidation: 24h TTL or manual clear

**Impact:**
- **Speed**: 5-10% faster on GAIA (repeat questions)
- **Cost**: 5-10% reduction
- **GAIA value**: HIGH (repeated questions common)

**Effort:** 2-3 days
**Priority:** P1 (quick win)

---

### Feature Proposal B: Speculative Decoding

**Problem Statement:**
LLM generation speed is bottleneck. Token generation is inherently sequential (can't parallelize). For 10K token output, this is 10-30 seconds per request.

**Proposed Solution:**
1. **Draft stage**: qwen2b generates draft tokens (very fast, 100+ tokens/sec)
2. **Validation stage**: qwen9b validates each draft token (accept/reject)
3. **Acceptance**: Keep draft tokens where qwen9b agrees, regenerate where diverges

**Algorithm:**
```
draft_tokens = []
for i in range(num_draft_tokens):
  draft = qwen2b.gen_next(context) // ~10 tokens at a time
  validation = qwen9b.score(context + draft)
  if validation > threshold:
    accept draft
    context += draft
  else:
    regenerate with qwen9b
```

**Impact:**
- **Speed**: 2-3x faster generation (draft is 10-20x faster)
- **Quality**: slightly lower (draft model less capable)
- **GAIA value**: MEDIUM-HIGH (speed limited by generation)

**Effort:** 3-5 days (need orchestration + validation scoring)
**Priority:** P1 (major speed improvement)

---

### Feature Proposal C: Long-Context Management (100K+ tokens)

**Problem Statement:**
For questions requiring document analysis (code, transcripts, long reports), context window fills up fast. Current: truncate or summarize. Better: intelligent hierarchical retrieval.

**Proposed Solution:**
1. **Smart chunking**: Context-1 semantic chunking (not just size-based)
2. **Hierarchical summaries**:
   - Original document
   - Section summaries (1-level up)
   - Chapter summary (1-level further)
3. **Reranking**: Keep most relevant chunks in context window
4. **Sliding window**: For documents longer than context, iterate through sections

**Implementation:**
- Leverage existing `contextIntelligentRecall.ts`
- Add hierarchical chunking strategy
- Use embeddings for relevance ranking
- Query-guided chunk selection

**Impact:**
- **Capability**: Can now analyze 500K+ token documents
- **Quality**: More coherent (structure preserved)
- **GAIA value**: HIGH (large document analysis needed)

**Effort:** 4-5 days (mostly algorithm work)
**Priority:** P1 (unblocks document questions)

---

### Feature Proposal D: Quality Metrics & Eval Framework

**Problem Statement:**
No automated quality checking. If an answer is wrong, system doesn't know. No feedback loop.

**Proposed Solution:**
1. **Evaluation criteria** (per question type):
   - Coherence: Does it make sense?
   - Relevance: Answers the question?
   - Completeness: Covers all aspects?
   - Accuracy: Fact-checkable?
   - Specificity: Concrete vs generic?

2. **Eval model**: qwen2b rapid-eval (3-5 secs per answer)
3. **Scoring**: 0-100 per criteria, combined score
4. **Routing**: If score < 60, retry with different approach / larger model / longer research
5. **Learning**: Track which approaches work for which question types

**Implementation:**
- New `evaluationFramework.ts`
- Add eval prompts per criteria
- Gate before returning results (no <60 score answers)
- Log scores for ML later

**Impact:**
- **Quality**: No low-quality output ships
- **Reliability**: Failed attempts auto-retry
- **GAIA value**: HIGH (catch wrong answers before finalizing)

**Effort:** 3-4 days
**Priority:** P2 (quality assurance)

---

### Feature Proposal E: Knowledge Base / RAG System

**Problem Statement:**
All research findings siloed in IndexedDB. Can't retrieve similar prior research. Repeat work cycle after cycle.

**Proposed Solution:**
1. **Vector DB**: Chroma (lightweight, in-process) or Qdrant (production)
2. **Indexing**: Every finding, source, decision gets embedded + stored
3. **Semantic search**: Given a new question, find similar past answers
4. **Augmentation**: Combine new research with retrieved past findings
5. **Version tracking**: Which cycle produced which findings

**Implementation:**
- Add `chromadb` dependency
- Create `knowledgeBase.ts` service
- On cycle complete: embed all findings, store in Chroma
- On new cycle start: query Chroma for related findings
- Surface "Similar to Q3 research: here are findings" in UI

**Data to index:**
- Deep desires (Q: what are customer fears? A: [findings])
- Objections and solutions
- Competitor patterns
- Audience language samples
- Product positioning

**Impact:**
- **Reuse**: Skip re-research for known topics
- **Consistency**: Apply learned patterns across projects
- **Speed**: 20% faster on follow-up questions
- **GAIA value**: MEDIUM (follow-up questions could retrieve prior answers)

**Effort:** 4-5 days
**Priority:** P2 (knowledge leverage)

---

### Feature Proposal F: Advanced Search & Full-Text Retrieval

**Problem Statement:**
Can't search past cycles. "Find all research about collagen" impossible today.

**Proposed Solution:**
1. **Full-text search**: SQLite FTS (simple, no dependencies)
2. **Semantic search**: Vector similarity (via embeddings)
3. **Filters**: By date, stage, model, quality, campaign
4. **UI**: Search bar with results + facets

**Implementation:**
- Use IndexedDB's native indexing
- Add SQLite FTS on top (hybrid)
- New `searchService.ts` with union of FTS + semantic
- UI: search input + results grid (click to view full cycle)

**Data to index:**
- Findings text
- Research notes
- Ad copy
- Decision rationales
- Lessons learned

**Impact:**
- **Discoverability**: Find past work quickly
- **Learning**: See patterns over time
- **GAIA value**: MEDIUM (retrieve relevant context)

**Effort:** 3 days
**Priority:** P3 (convenience)

---

### Feature Proposal G: Export & Sharing System

**Problem Statement:**
All work trapped in NEURO. Can't share with stakeholders or external tools.

**Proposed Solution:**
1. **PDF export**: Professional report (styled, with charts)
2. **HTML export**: Interactive report (clickable TOC)
3. **JSON export**: Structured data (for integrations)
4. **Markdown export**: For wikis/docs
5. **PowerPoint**: Slide deck from findings

**Implementation:**
- Use `pdfkit` or `puppeteer` for PDF generation
- HTML: Tailwind-styled template
- JSON: Direct cycle serialization
- Markdown: Template with frontmatter
- PPTX: `pptx-gen-js` library

**What to include:**
- Brand DNA
- Persona profiles
- Top angles (ranked)
- Competitive landscape
- Ad concepts + test results
- Audit trail (sources, models, timing)

**Impact:**
- **Sharing**: Stakeholders can review offline
- **Integration**: JSON enables downstream tools
- **GAIA value**: NONE (not directly)

**Effort:** 4-5 days
**Priority:** P3 (usability)

---

### Feature Proposal H: Real-Time Collaboration & Multi-User

**Problem Statement:**
Single-user only. Teams can't work together.

**Proposed Solution:**
1. **WebSocket server**: Broadcast cycle state changes
2. **User presence**: See who's viewing what
3. **Collaborative editing**: Multiple people edit BrandDNA simultaneously
4. **Comment threads**: Annotate findings with feedback
5. **Role-based access**: Admin/editor/viewer permissions

**Implementation:**
- Add Node.js WebSocket server (socket.io)
- Sync state: cycles, documents, approvals
- Conflict resolution: last-write-wins or merge strategies
- Session management: track active users

**Schema:**
- Cycle state → broadcast to all clients
- User edits → increment version counter
- Approval decisions → queue for consensus

**Impact:**
- **Teamwork**: Async + sync collaboration
- **Transparency**: Everyone sees progress
- **GAIA value**: NONE (single-user benchmark)

**Effort:** 5-7 days
**Priority:** P3 (team feature)

---

### Feature Proposal I: Custom Workflow Designer

**Problem Statement:**
8-stage pipeline is fixed. Can't customize for different question types.

**Proposed Solution:**
1. **Workflow builder UI**: Drag-drop stages
2. **Stage config**: Custom prompts, model selection, timeout
3. **Conditional routing**: if X then skip Y, else do Z
4. **Parallel branches**: Run multiple stages simultaneously
5. **Save as template**: Reuse workflows

**Implementation:**
- React Flow library for visual builder
- Workflow engine: DAG execution (topological sort)
- Config schema: `{ id, name, type, config, input, output, downstream }`
- Persistence: Save to IndexedDB

**Example workflows:**
- "Quick angles": skip research, go straight to ideation
- "Deep research": double iterations, visual scouting
- "Competitor tracker": skip make/test, focus on research
- "Batch optimization": run test on all prior concepts

**Impact:**
- **Flexibility**: Adapt to different question types
- **Speed**: Skip unnecessary stages
- **GAIA value**: LOW (benchmark has fixed pipeline)

**Effort:** 6-8 days
**Priority:** P3 (flexibility)

---

### Feature Proposal J: Autonomous Improvement Loop

**Problem Statement:**
Same mistakes repeated. No learning between cycles.

**Proposed Solution:**
1. **Failure tracking**: When eval score < 60, record failure
2. **Root cause analysis**: Why did this fail? (LLM analyzes failure)
3. **Strategy adjustment**:
   - If "missing detail", add search query for that detail
   - If "wrong angle", try different persona
   - If "low proof", research more social proof examples
4. **Adaptive retry**: Retry with adjusted approach
5. **Pattern learning**: Track which adjustments work

**Implementation:**
- New `failureAnalyzer.ts`: LLM-based root cause detection
- `adaptationStrategy.ts`: Suggest modifications
- Feedback loop: track success rate per adaptation
- Persistence: learn patterns across cycles

**Feedback mechanisms:**
- If eval detects "weak proof", boost research queries for proof
- If answer is "too generic", add specificity prompt
- If facts wrong, cite sources more carefully

**Impact:**
- **Quality**: Fewer repeated mistakes
- **Speed**: Fewer retries needed
- **Learning**: System improves over time
- **GAIA value**: MEDIUM-HIGH (auto-retry improves score)

**Effort:** 4-6 days
**Priority:** P2 (continuous improvement)

---

### Feature Proposal K: Vision & Multimodal Pipeline

**Problem Statement:**
Wayfarer Plus visual scouting is isolated. No deep vision understanding in main pipeline.

**Proposed Solution:**
1. **Vision model**: qwen-vl-max (or equivalent)
2. **Integration points**:
   - Research: analyze competitor product images
   - Make: generate with visual reasoning (colors, layouts)
   - Test: visual evaluation of ad concepts (composition, readability)
3. **Image understanding**: Extract colors, layouts, tone, CTA patterns
4. **Visual consistency**: Ensure ads match brand DNA visually

**Implementation:**
- Wrap vision model in `visionService.ts`
- Add to research: "Find competitor product images, describe visual patterns"
- Add to make: "Generate ad concept that visually matches [brand colors]"
- Add to test: "Score visual coherence of this concept"

**Data flow:**
- Research: screenshot URLs → vision model → color/layout analysis
- Make: brand DNA (visual) + competitor visuals → generation prompt
- Test: ad concept image → vision scoring for visual appeal

**Impact:**
- **Capability**: True multimodal understanding
- **Quality**: Visual consistency checked
- **GAIA value**: MEDIUM (visual reasoning questions)

**Effort:** 5-6 days
**Priority:** P2 (multimodal advantage)

---

### Feature Proposal L: Model Adaptation & Few-Shot Learning

**Problem Statement:**
Prompts are static. No context carry-over between cycles. No task-specific tuning.

**Proposed Solution:**
1. **In-context learning**: Provide 3-5 past good examples in prompt
2. **Few-shot examples**: "Here's how we nailed this before, apply same approach"
3. **Task-specific prompts**: Different prompt templates for different question categories
4. **Synthetic data**: Generate good examples from past successful cycles

**Implementation:**
- New `fewShotLibrary.ts`: Store good examples per task type
- On cycle start: retrieve 3-5 best past examples for this question type
- Append to prompt: "Previous successful examples: [examples]"
- Measure: does output quality improve with examples?

**Examples to store:**
- Great desire analysis (Q: customer pain? A: structured analysis)
- Strong objections framework (Q: what blocks purchase? A: comprehensive list)
- Winning ad concepts (Q: angles for product X? A: top-performing ad copy)

**Impact:**
- **Quality**: Better outputs with context
- **Consistency**: Apply patterns learned before
- **GAIA value**: MEDIUM (few-shot helps with varied questions)

**Effort:** 3-4 days
**Priority:** P3 (optimization)

---

### Feature Proposal M: Cost Tracking & Optimization

**Problem Statement:**
No per-query cost breakdown. Can't optimize spending.

**Proposed Solution:**
1. **Fine-grained tracking**: Tokens per query, per stage, per model
2. **Cost attribution**: Which stage is most expensive?
3. **Alerts**: Warn if exceeding budget
4. **Suggestions**: "Use qwen2b here instead of 4b, save 70%"
5. **Trends**: Cost per cycle over time

**Implementation:**
- Enhance `costTracker.ts` with query-level granularity
- New UI: cost dashboard (bar chart by stage, trend line)
- Auto-suggest: "This stage used $50. Try model X for $10 (90% savings)"

**Data to track:**
- Tokens per: model, stage, tool, query type
- Cost per: cycle, brand, campaign
- Budget: soft limit (warning), hard limit (block)

**Impact:**
- **Cost visibility**: Know where money goes
- **Optimization**: Reduce spend without sacrificing quality
- **GAIA value**: NONE (no cost constraint in benchmark)

**Effort:** 3-4 days
**Priority:** P3 (business)

---

### Feature Proposal N: Automated Testing Framework

**Problem Statement:**
No regression detection. Optimizations might break things silently.

**Proposed Solution:**
1. **Test suite**: 30-50 diverse questions (varied difficulty, types)
2. **Metrics**: Per-question score + aggregate GAIA-like metric
3. **Regression detection**: If metric drops >5%, alert
4. **Variance analysis**: Track score variance (not just mean)
5. **CI/CD integration**: Auto-test on every code push

**Implementation:**
- Create `testCases.json`: [{ question, context, expectedScore, category }]
- New `testHarness.ts`: Run all test cases, compare against baseline
- Store baseline: `baseline.json` with per-question scores
- Report: HTML report with regressions highlighted

**What to test:**
- Research quality (coverage, synthesis accuracy)
- Angle generation (diversity, relevance)
- Ad creation (quality, brand fit)
- Test evaluation (scoring accuracy)

**Impact:**
- **Stability**: Catch regressions early
- **Confidence**: Safe to refactor
- **GAIA value**: HIGH (enables safe optimization)

**Effort:** 4-5 days
**Priority:** P3 (quality assurance)

---

## PART 4: PRIORITIZED ROADMAP

### Priority Matrix

| Feature | Impact | Effort | GAIA Value | Dependencies | Priority |
|---------|--------|--------|-----------|--------------|----------|
| **Query Caching** | HIGH | MEDIUM | HIGH | None | 🔴 P1 |
| **Speculative Decoding** | MEDIUM-HIGH | MEDIUM | MEDIUM-HIGH | Dual model setup | 🔴 P1 |
| **Long-Context Mgmt** | HIGH | MEDIUM | HIGH | Context-1 service | 🔴 P1 |
| **Quality Metrics & Eval** | MEDIUM | MEDIUM | HIGH | None | 🟠 P2 |
| **Autonomous Improvement** | HIGH | HIGH | MEDIUM-HIGH | Eval framework | 🟠 P2 |
| **Vision & Multimodal** | HIGH | HIGH | MEDIUM | Vision model, qwen-vl | 🟠 P2 |
| **Knowledge Base / RAG** | MEDIUM-HIGH | MEDIUM | MEDIUM | Embeddings, vector DB | 🟠 P2 |
| **Advanced Search** | MEDIUM | MEDIUM | MEDIUM | Knowledge base | 🟡 P3 |
| **Model Adaptation** | MEDIUM-HIGH | MEDIUM | MEDIUM | None | 🟡 P3 |
| **Custom Workflows** | MEDIUM | HIGH | LOW | Workflow engine | 🟡 P3 |
| **Real-Time Collab** | MEDIUM | HIGH | NONE | WebSocket server | 🟡 P3 |
| **Cost Tracking & Opt** | MEDIUM | LOW | NONE | None | 🟡 P3 |
| **Export & Sharing** | MEDIUM | MEDIUM | NONE | Export libraries | 🟡 P3 |
| **Automated Testing** | MEDIUM | MEDIUM | NONE | Test data | 🟡 P3 |
| **Mobile Responsive** | LOW-MEDIUM | MEDIUM | NONE | None | 🟡 P3 |

---

### Phase 11 Roadmap (Next 6-8 Weeks)

#### Week 1-2: Query Caching
- [ ] Implement hash-based prompt cache (24h TTL)
- [ ] Add embedding cache layer
- [ ] Test on GAIA benchmark (measure speedup)
- [ ] Expected impact: 5-10% faster, 5-10% cheaper

#### Week 2-3: Long-Context Management
- [ ] Implement hierarchical chunking (Context-1 semantic)
- [ ] Add reranking with embeddings
- [ ] Test on 100K+ token documents
- [ ] Expected impact: Unblock large document questions

#### Week 3-4: Quality Metrics Framework
- [ ] Design eval criteria per question type
- [ ] Implement eval model scoring
- [ ] Add routing: if score < 60, retry
- [ ] Expected impact: Catch bad answers, auto-retry

#### Week 4-5: Speculative Decoding
- [ ] Implement dual-model orchestration (qwen2b draft, qwen9b validate)
- [ ] Add acceptance threshold tuning
- [ ] Measure generation speed improvement
- [ ] Expected impact: 2-3x faster generation

#### Week 5-6: Knowledge Base (Chroma)
- [ ] Add vector DB (Chroma in-process)
- [ ] Index all findings from past cycles
- [ ] Implement semantic search + retrieval
- [ ] Surface "similar to X" in UI
- [ ] Expected impact: Reuse knowledge, faster follow-ups

#### Week 6-7: Autonomous Improvement Loop
- [ ] Implement failure tracking + LLM root cause analysis
- [ ] Add strategy adaptation layer
- [ ] Create feedback loop: fail → analyze → adjust → retry
- [ ] Expected impact: Fewer retries, higher quality

#### Week 7-8: Testing & Integration
- [ ] Create test suite (30-50 questions)
- [ ] Run GAIA benchmark (measure score improvement)
- [ ] Profile speed (target: <15 min per run)
- [ ] Document all changes

**Expected Outcome:**
- GAIA score: 50% → 70-75% (with auto-retry + caching)
- Speed: 32 min → 15-20 min (with spec decoding + caching)
- Harness quality: 9.1 → 9.5+

---

### Phase 12+ Roadmap (Months 3-4)

#### Priority 2A: Vision & Multimodal (2-3 weeks)
- [ ] Integrate qwen-vl-max model
- [ ] Add visual understanding to research stage
- [ ] Add visual reasoning to make stage
- [ ] Visual scoring in test stage

#### Priority 2B: Autonomous Improvement Loop Enhancements (1-2 weeks)
- [ ] Pattern detection: which question types need which adjustments?
- [ ] Synthetic data generation: create training examples
- [ ] In-context few-shot integration

#### Priority 2C: Advanced Search (1-2 weeks)
- [ ] Full-text search across all cycles
- [ ] Faceted search (by date, campaign, stage)
- [ ] UI: search dashboard

#### Priority 3: Remaining Features (4-8 weeks)
- [ ] Export & sharing (PDF, HTML, JSON, PowerPoint)
- [ ] Custom workflow designer (visual builder)
- [ ] Real-time collaboration (WebSocket)
- [ ] Cost tracking & optimization dashboard
- [ ] Automated testing framework (CI/CD integration)

---

## PART 5: IMPLEMENTATION RECOMMENDATIONS

### Recommended Architecture for Phase 11

#### Backend Services (Node.js/TypeScript)
```
src/utils/
  ├── cacheService.ts          # Query-level caching (NEW)
  ├── speculativeDecoding.ts   # Draft-validate orchestration (NEW)
  ├── knowledgeBase.ts         # Chroma integration (NEW)
  ├── evaluationFramework.ts   # Quality scoring (NEW)
  ├── failureAnalyzer.ts       # Root cause analysis (NEW)
  ├── contextIntelligentRecall.ts  # (ENHANCE for 100K+)
  └── [existing services]
```

#### Database/Storage
```
IndexedDB:
  - Keep: cycles, campaigns, documents
  - Add: test results, failure logs, knowledge entries

Chroma (Vector DB):
  - Index: research findings, ad concepts, decisions
  - Metadata: cycle ID, date, type, quality score
```

#### React Components
```
src/components/
  ├── QualityDashboard.tsx    # Show eval scores, auto-retry status (NEW)
  ├── KnowledgeSearch.tsx     # Search + retrieve past findings (NEW)
  ├── CostDashboard.tsx       # Per-stage cost breakdown (NEW)
  └── [existing UI]
```

#### Hooks (React)
```
src/hooks/
  ├── useQualityEval.ts       # Quality checking + retry routing (NEW)
  ├── useKnowledgeRetrieval.ts # Chroma queries (NEW)
  ├── useCostTracking.ts      # Per-query cost aggregation (NEW)
  └── [existing hooks]
```

---

### Testing Strategy

#### GAIA Benchmark Integration
```typescript
// runQ3BenchmarkNow.ts (ENHANCE)
for (const question of testQuestions) {
  // NEW: Check knowledge base for similar past answers
  const retrieved = await knowledgeBase.search(question);

  // NEW: Evaluate answer quality
  const score = await evaluationFramework.score(answer);
  if (score < 60) {
    // NEW: Auto-retry with adjusted strategy
    const adjusted = await failureAnalyzer.adapt(failure);
    answer = await retryWithStrategy(adjusted);
  }

  // Log metrics
  metrics.log({ question, score, time, tokens });
}
```

#### Regression Testing
```typescript
// testHarness.ts (NEW)
const baseline = loadBaseline('baseline.json');
const current = await runTestSuite(testCases);
const regressions = current
  .filter(t => baseline[t.id] - current[t.id] > 5)
  .map(t => `${t.id}: ${baseline[t.id]}→${current[t.id]}`);

if (regressions.length > 0) {
  throw new Error(`Regressions detected: ${regressions.join(', ')}`);
}
```

---

### Success Metrics

#### Phase 11 Success Criteria
- [ ] GAIA benchmark: 50% → 70%+
- [ ] Speed: 32 min → 15-20 min per run
- [ ] Query caching: 10% hit rate on repeated questions
- [ ] Eval framework: 95%+ accuracy on quality scoring
- [ ] Knowledge base: 20%+ reuse rate on follow-ups
- [ ] Zero regressions on existing test suite

#### Phase 12+ Goals
- [ ] GAIA benchmark: 70% → 85%+
- [ ] Speed: 15 min → 8-10 min
- [ ] Vision integration: 5+ new question types enabled
- [ ] Cost optimization: 30% spending reduction
- [ ] User satisfaction: 90%+ on quality, speed

---

## PART 6: RISK & MITIGATION

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Caching breaks with model updates | LOW | HIGH | Version prompts, invalidate on model change |
| Spec decoding quality drops | MEDIUM | MEDIUM | Validate draft acceptance rate, easy rollback |
| Long-context causes OOM | MEDIUM | HIGH | Add memory limits, graceful degradation |
| Chroma diverges from reality | MEDIUM | HIGH | Regular reindex, audit trail |
| Eval model wrong answers | HIGH | HIGH | Validate eval scores on test set first |
| Autonomous retry loops | LOW | MEDIUM | Add loop detection, max retry count |

### Mitigation Strategies
1. **Phased rollout**: Enable features with feature flags
2. **A/B testing**: Run old vs new in parallel, compare metrics
3. **Audit trail**: Log all decisions (enable debugging)
4. **Rollback plan**: Each feature independently reversible
5. **Test suite**: Regression detection (catch breaks early)

---

## PART 7: EFFORT ESTIMATES & TIMELINE

### Detailed Time Breakdown

| Feature | Analysis | Implementation | Testing | Total |
|---------|----------|-----------------|---------|-------|
| Query Caching | 4h | 16h | 4h | **24h (3d)** |
| Long-Context | 4h | 12h | 4h | **20h (2.5d)** |
| Spec Decoding | 8h | 16h | 8h | **32h (4d)** |
| Quality Eval | 6h | 12h | 6h | **24h (3d)** |
| Knowledge Base | 8h | 16h | 8h | **32h (4d)** |
| Autonomous Improve | 8h | 16h | 8h | **32h (4d)** |
| Integration & Testing | — | 16h | 24h | **40h (5d)** |

**Total Phase 11: ~204 hours (25-30 developer-days)**

Assuming 1 developer, 5 days/week: **6-7 weeks**

---

## PART 8: QUICK WINS vs STRATEGIC BETS

### Quick Wins (1-2 days each)
1. **Cost tracking dashboard** — per-stage breakdown UI only
2. **Export to JSON** — direct serialization of cycle
3. **Offline mode detection** — graceful degradation
4. **Mobile viewport meta tag** — make responsive-ready

### Strategic Bets (3-5 days each)
1. **Caching layer** — unlocks efficiency, but needs careful validation
2. **Eval framework** — enables autonomous improvement, but risk of wrong scoring
3. **Knowledge base** — high ROI but needs embeddings + search UX
4. **Spec decoding** — major speed win but complex orchestration

### Recommended Approach
1. **Weeks 1-2**: Do quick wins in parallel with caching
2. **Weeks 2-4**: Major features (long-context, spec decoding, eval)
3. **Weeks 4-6**: Integration (knowledge base, autonomous improve)
4. **Weeks 6-7**: Test, measure, optimize for GAIA

---

## CONCLUSION

NEURO has achieved **Phase 10 excellence** with sophisticated research, creative pipeline, and streaming architecture. To reach GAIA benchmark targets (70%+ score, <15 min runtime), Phase 11 must focus on:

1. **Speed optimizations** (caching, spec decoding): 2-3x faster
2. **Quality gates** (eval framework, autonomous improve): Catch + fix bad answers
3. **Knowledge leverage** (RAG, search): Reuse findings, consistency
4. **Context efficiency** (long-document management): Unblock large analyses

The recommended **6-7 week Phase 11 roadmap** targets:
- **GAIA score**: 50% → 70%+
- **Runtime**: 32 min → 15-20 min
- **Quality**: Automated gates, no low-quality output

Success metrics are clear, risks mitigated, and implementation path is well-defined. Ready to execute.

---

**Document prepared by:** Agent: Feature Roadmap Planning
**Last updated:** April 2, 2026
**Next review:** After Phase 11 completion
