# Master Implementation Plan — All Audits Consolidated
**Date**: April 2, 2026
**Status**: Ready for execution
**Total Scope**: ~550-700 hours across 4 phases
**Team Size**: 2-3 developers recommended

---

## CRITICAL BLOCKERS (MUST FIX FIRST)

### P0-A: Wayfarer File Transfer Architecture (2-3 hours)
**Problem**: Wayfarer runs in remote Docker container. Downloaded/scraped files are in container `/tmp/`, not accessible to client.

**Current State**:
- Wayfarer scrapes web pages (text only)
- No file download capability yet
- No mechanism to retrieve downloaded files from remote container
- Blocks all P1-B features (file analysis)

**Solution**: Add File Transfer Endpoint (Option A — RECOMMENDED)

**Implementation**:
1. Add session-based temp directory: `/tmp/wayfarer_downloads/{session_id}/`
2. Add endpoint to `wayfarer_server.py`:
```python
@app.get("/files/{session_id}/{filename}")
async def get_download_file(session_id: str, filename: str):
    """Stream file from downloads directory (with path traversal protection)."""
    # Validate session_id (alphanumeric only)
    # Validate filename (prevent ../ traversal)
    # Stream file from /tmp/wayfarer_downloads/{session_id}/{filename}
    # Return FileResponse with appropriate headers
    pass

@app.delete("/files/{session_id}")
async def cleanup_downloads(session_id: str):
    """Clean up session downloads after ~24h or on-demand."""
    pass
```

3. Update TypeScript client (`src/utils/wayfayer.ts`):
```typescript
async downloadFile(sessionId: string, filename: string): Promise<Blob> {
  const response = await fetch(
    `${this.baseUrl}/files/${sessionId}/${filename}`
  );
  return response.blob();
}
```

4. Track session_id in all scraping calls
5. Return file manifests in research output

**Files to Modify**:
- `/Users/mk/Downloads/nomads/wayfarer/wayfarer_server.py` — add 2 endpoints
- `/Users/mk/Downloads/nomads/src/utils/wayfayer.ts` — add downloadFile method
- `/Users/mk/Downloads/nomads/src/types/index.ts` — add FileDownload type

**Why First**: Blocks P1-B, P1-C, entire file analysis roadmap. 2-3 hour fix with high impact.

---

## PHASE 0: Quick Wins & Foundation (Week 1, 20-25 hours)

### P0-B: Fix Wayfarer Session Management
**Effort**: 3 hours | **Priority**: P0 (foundation for P0-A)
- Add session tracking to research calls
- Implement temp directory cleanup (24h TTL)
- Add session metadata to audit trail

**Files**: `wayfarer_server.py`, `researchAudit.ts`

### P0-C: Infrastructure Configuration Validation
**Effort**: 2 hours | **Priority**: P0
- Verify all 3 URLs work (Ollama, Wayfarer, SearXNG)
- Add health check for file download endpoint (new)
- Add retry logic for remote services

**Files**: `src/config/infrastructure.ts`, `healthMonitor.ts`

### P0-D: Export Infrastructure Setup
**Effort**: 8 hours | **Priority**: P1 (high user value, quick ROI)
- Add PDF export (use existing pdfUtils + data formatting)
- Add JSON export (complete audit trail)
- Add Markdown export (sharing + documentation)
- Add HTML export (interactive, shareable)

**Why**: Users want to share results with stakeholders. High satisfaction gain from minimal work.

**Files to Create**:
- `src/services/exportService.ts` — master export orchestrator
- `src/utils/exportFormatters/pdfExporter.ts`
- `src/utils/exportFormatters/jsonExporter.ts`
- `src/utils/exportFormatters/markdownExporter.ts`
- `src/utils/exportFormatters/htmlExporter.ts`

---

## PHASE 1: High-Impact Foundation (Weeks 2-3, 80-120 hours)

### 1A: Query-Level Caching & Memoization (P1, 3-4 days)
**Impact**: 5-10% speed improvement on repeated questions
**Effort**: 24-32 hours | **Feasibility**: HIGH

**Why**: GAIA has repeated questions. Hash-based cache saves 30% of model calls.

**Implementation**:
- Add LLM response cache to `ollama.ts`
- Hash-based cache key: SHA256(model + prompt + system)
- TTL: 24 hours per query
- Store in IndexedDB with metadata
- Skip cache for evaluation runs (add flag)

**Files**:
- `src/services/ollama.ts` — add caching layer
- `src/types/index.ts` — add CacheMetadata type
- `src/hooks/useCycleLoop.ts` — pass cache-bypass flag for eval mode

**Success Criteria**:
- Cache hit rate > 10% on GAIA
- Latency: -5-10% on repeat queries
- Zero quality degradation

---

### 1B: File Download & Analysis System (P1, 2-3 weeks)
**Impact**: Unlocks document analysis, competitor research, multi-media content
**Effort**: 60-80 hours | **Feasibility**: MEDIUM-HIGH

**Why**: Can't analyze documents, PDFs, or download competitor materials. Blocks research depth.

**Breakdown**:
- **Week 1 (24h)**: Download service + streaming analysis
  - Add `downloadService.ts` (retry logic, URL validation, streaming)
  - Add `/files/{session_id}/{filename}` endpoint to Wayfarer
  - Add CSV/JSON streaming analyzer

- **Week 2 (28h)**: PDF + text extraction
  - Enhance PDF parser (pdfUtils)
  - Add table extraction from PDFs
  - Add full-text search via Context-1

- **Week 3 (16h)**: Integration + testing
  - Wire downloads into research stage
  - Add UI for file attachments
  - E2E test with 100MB+ files

**Files**:
- `src/services/downloadService.ts` — NEW
- `src/services/fileAnalysisService.ts` — NEW
- `wayfarer/wayfarer_server.py` — add file download endpoints
- `src/components/FileUploadWidget.tsx` — NEW
- `src/types/index.ts` — FileDownload, FileMetadata types

**Success Criteria**:
- Download 500MB files without memory issues
- Analyze CSV/JSON with 100K+ rows
- Extract tables from PDFs with 90%+ accuracy

---

### 1C: Long-Context Management (100K+ tokens) (P1, 2-3 days)
**Impact**: Unblock document analysis, large context windows
**Effort**: 20-25 hours | **Feasibility**: HIGH

**Why**: Can't analyze documents >20K tokens. Need hierarchical chunking.

**Implementation**:
- Use Context-1 semantic chunking
- Add sliding window with reranking
- Implement "most relevant section first" strategy
- Add chunk boundary detection (sentence-level)

**Files**:
- `src/services/contextManagement.ts` — new service
- `src/utils/semanticChunking.ts` — use Context-1
- `src/hooks/useLongContextProcessor.ts` — new hook

**Success Criteria**:
- Process 100K token documents in <30s
- Zero OOM errors
- Retrieval accuracy > 85% for queries

---

### 1D: Quality Metrics & Automated Evaluation (P1, 3 days)
**Impact**: Gate bad answers, auto-retry on failures
**Effort**: 24-32 hours | **Feasibility**: HIGH

**Why**: No feedback loop. Eval model scores output; if <60, retry automatically.

**Implementation**:
- Add 5-criteria eval model (qwen3.5:2b)
  1. Coherence (logical consistency)
  2. Relevance (answers the question)
  3. Completeness (covers all angles)
  4. Accuracy (no hallucinations)
  5. Specificity (concrete vs vague)
- Route to larger model if score < 60
- Auto-retry up to 2x with adjusted prompt

**Files**:
- `src/services/evaluationService.ts` — NEW
- `src/utils/evalCriteria.ts` — eval frameworks
- `src/hooks/useAutoRetry.ts` — retry orchestration

**Success Criteria**:
- Eval accuracy > 90%
- Auto-retry success rate > 75%
- 0% low-quality output shipped (score < 40)

---

## PHASE 2: Leverage & Quality (Weeks 4-5, 60-90 hours)

### 2A: Vision & Multimodal Integration (P1, 1 week)
**Impact**: True image understanding in all stages
**Effort**: 40-48 hours | **Feasibility**: MEDIUM

**Why**: Wayfarer Plus isolated. Need qwen-vl in research, make, test stages.

**Current**: Visual Scout Agent works for Wayfarer Plus only (50 URLs max).
**Goal**: Integrate vision analysis into research cycle, competitor analysis, creative feedback.

**Implementation**:
- Extend `visualScoutAgent.ts` to support URL lists
- Add vision to objections stage (image-based objection detection)
- Add visual feedback to make stage (competitor aesthetic analysis)
- Add visual ranking to test stage (which creative wins visually)

**Files**:
- `src/utils/visualScoutAgent.ts` — refactor for general use
- `src/hooks/useResearchAgent.ts` — add image URLs to research phase
- Extend objections, make, test stages to use vision

**Success Criteria**:
- Vision analysis <30s per 10 URLs
- Visual insights in 100% of campaigns
- Competitor aesthetic patterns captured

---

### 2B: Knowledge Base / RAG System (P1, 1 week)
**Impact**: 20%+ faster on follow-ups, eliminate duplicated research
**Effort**: 32-40 hours | **Feasibility**: MEDIUM

**Why**: All findings trapped in IndexedDB. Chroma enables retrieval.

**Current**: Context-1 exists but not leveraged for knowledge.
**Goal**: Index all findings, surface "similar to Q3" when new questions arrive.

**Implementation**:
- Use Chroma (in-process) or local embeddings
- Index all findings per cycle
- On new question, retrieve similar past answers
- Surface "Similar to Cycle X: here's what we learned" in research phase
- Track learned patterns (successful angles, objections, audiences)

**Files**:
- `src/services/knowledgeBaseService.ts` — NEW
- `src/services/semanticSearchService.ts` — retrieval
- `src/components/SimilarFindingsPanel.tsx` — NEW UI
- Update research phase to include similar findings

**Success Criteria**:
- Retrieval accuracy > 85%
- 10%+ of queries find relevant past answers
- Reuse rate tracked and improving

---

### 2C: Autonomous Improvement Loop (P2, 1 week)
**Impact**: Fewer repeated mistakes, self-improving system
**Effort**: 28-36 hours | **Feasibility**: MEDIUM

**Why**: Same failures repeat. LLM analyzes root cause, adjusts strategy.

**Implementation**:
- Track failures (low eval scores, user corrections)
- LLM root cause analysis: "Why did this fail?"
- Adaptation strategy: "Try this different approach"
- Retry with adjusted prompt/parameters
- Log learnings back to knowledge base

**Files**:
- `src/services/improvementLoopService.ts` — NEW
- `src/utils/rootCauseAnalysis.ts` — LLM root cause
- `src/hooks/useAdaptiveRetry.ts` — adaptive parameters

**Success Criteria**:
- Root cause accuracy > 80%
- Adaptation success rate > 70%
- Repeated failure rate drops >30%

---

## PHASE 3: Team & Reusability (Weeks 6-7, 40-60 hours)

### 3A: Advanced Search & Full-Text Retrieval (P2, 3 days)
**Impact**: Find past work quickly
**Effort**: 18-24 hours | **Feasibility**: HIGH

**Implementation**:
- SQLite FTS (full-text search) on all findings
- Semantic search via embeddings
- Faceted search (date range, stage, quality, brand)
- Search UI with filters

**Files**:
- `src/services/searchService.ts` — NEW
- `src/components/SearchPanel.tsx` — NEW

---

### 3B: Export & Sharing (P2, 2-3 days)
**Note**: P0-D exports foundation already built. This adds polish.
**Effort**: 12-20 hours | **Feasibility**: HIGH

**Addition**:
- PowerPoint export (executive summary format)
- Shareable links (public read-only cycle views)
- Branding customization (logos, colors in exports)

---

### 3C: Custom Workflow Designer (P3, 1-2 weeks)
**Impact**: Adapt to different question types
**Effort**: 40-50 hours | **Feasibility**: MEDIUM

**Implementation**:
- Visual workflow builder (React Flow)
- DAG execution engine
- Conditional routing (if low confidence → more research)
- Template workflows (competitive analysis, product launch, etc.)

---

## DEPENDENCY MAP

```
PHASE 0 (Blocker)
├── P0-A: Wayfarer File Transfer
│   ├── UNBLOCKS: P0-D, 1B, 1C, 2A
│   └── UNBLOCKS: All file-related research
├── P0-B: Session Management
│   └── ENABLES: P0-A, all phases
└── P0-C: Infrastructure Validation
    └── ENABLES: All file operations

PHASE 1 (High-Impact)
├── 1A: Query Caching
│   └── INDEPENDENT (pure optimization)
├── 1B: File Download & Analysis
│   ├── REQUIRES: P0-A ✓
│   └── UNBLOCKS: 1C, 2A, knowledge base
├── 1C: Long-Context
│   ├── REQUIRES: 1B
│   └── ENABLES: Document analysis
└── 1D: Quality Eval
    └── INDEPENDENT (pure quality gate)

PHASE 2 (Leverage)
├── 2A: Vision Integration
│   └── INDEPENDENT (standalone upgrade)
├── 2B: Knowledge Base
│   ├── REQUIRES: 1B (file analysis)
│   └── ENABLES: 2C learnings
└── 2C: Improvement Loop
    ├── REQUIRES: 1D (eval), 2B (KB)
    └── IMPROVES: All stages

PHASE 3 (Team)
├── 3A: Search
│   └── REQUIRES: All previous (full data)
├── 3B: Export Polish
│   └── REQUIRES: P0-D foundation
└── 3C: Workflow Designer
    └── INDEPENDENT (new feature)
```

---

## EXECUTION TIMELINE

| Week | Phase | Features | Hours | Status |
|------|-------|----------|-------|--------|
| **W1** | **P0** | Wayfarer Fix (P0-A, B, C) | 8-10h | **START NOW** |
| | | Export Foundation (P0-D) | 8h | Parallel |
| **W2-3** | **P1** | Caching, File System, QA (1A-D) | 80-120h | Sequential |
| **W4-5** | **P2** | Vision, RAG, Improvement (2A-C) | 60-90h | Sequential |
| **W6-7** | **P3** | Search, Export, Workflows (3A-C) | 40-60h | As bandwidth |
| **W8** | | Testing, GAIA benchmark, docs | 20-25h | Validation |

**Total**: ~275-335 hours (7-8 weeks, 1 full-time developer)

---

## SUCCESS METRICS

### Phase 0 (End of Week 1)
- [ ] `/files/{session_id}/{filename}` endpoint working
- [ ] File download integrated into research
- [ ] 4 export formats (PDF, JSON, Markdown, HTML)
- [ ] Zero errors on file operations

### Phase 1 (End of Week 3)
- [ ] Query cache hit rate > 10%
- [ ] 500MB files downloaded without memory issues
- [ ] PDF tables extracted with 90%+ accuracy
- [ ] Eval scores > 0.85 on test set
- [ ] Speed: GAIA baseline → ?% improvement

### Phase 2 (End of Week 5)
- [ ] Vision integrated in research, objections, make, test
- [ ] Knowledge base retrieval accuracy > 85%
- [ ] Similar findings surface in 10% of queries
- [ ] Improvement loop: repeated failures drop 30%

### Phase 3 (End of Week 7)
- [ ] Full-text search with 5+ facets working
- [ ] PowerPoint export production-ready
- [ ] Workflow designer MVP tested
- [ ] GAIA: Target 70%+ (up from 50%)

---

## RISK ASSESSMENT & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Caching breaks with model updates | Medium | High | VERSION prompts, reindex quarterly |
| Spec decoding quality drop | Medium | High | A/B testing, easy rollback feature flag |
| Long-context OOM | Low | Critical | Memory limits, auto-chunk on OOM |
| Chroma index diverges from source | Low | Medium | Reindex monthly, versioning |
| File operations break on remote Wayfarer | Low | Critical | Comprehensive path validation, test both local + remote |
| Vision API timeout on large batches | Medium | Medium | Concurrency limits, batch size tuning |

**Mitigation Strategy**:
- Phased rollout per feature (feature flags)
- A/B testing for major changes
- Comprehensive test suite (50+ scenarios)
- Easy rollback plan per feature
- Weekly status check-ins

---

## CONSOLIDATED RECOMMENDATIONS FROM AUDITS

### Feature Roadmap Audit (binah9dd7.txt)
**Key Takeaways**:
- GAIA bottleneck: Speed (generation) + accuracy (repeat failures) + reuse (knowledge)
- P1 priorities: Caching → Long-context → Quality Eval → Spec Decoding
- P2 priorities: Knowledge Base → Autonomous Improvement
- Expected GAIA boost: 50% → 70%+ with P1 features

**Alignment**: ✓ Fully incorporated as Phase 1-2

### Data Visualization Audit (bbgzlr93n.txt)
**Key Takeaways**:
- P1 features: Color highlighting, callout boxes, data tables, progress bars
- P2: Charts, metrics visualization, advanced formatting
- Expected UX improvement: 3-4x clearer research output

**Alignment**: ✓ Recommend as Phase 1.5 (short term, high user value)
**Action**: Create `/src/components/RichFormatting/` with:
- `HighlightedText.tsx` — color coding ([KEY], [WARN], [INSIGHT])
- `CalloutBox.tsx` — semantic containers
- `DataTable.tsx` — sortable, styled
- `ProgressBar.tsx` — linear + circular variants

**Effort**: 16-20 hours (can run parallel with file system work)

### Quick Menu Audit (bnj3v637i.txt)
**Key Takeaways**:
- P1 features: Context variables, output variables, document referencing
- P2: Pipes, file operations, templates
- P3: Batch operations, aliases, custom formatting
- Total: 80-120 hours across 3 phases

**Alignment**: ✓ Post-Phase 3 roadmap (separate from core NEURO)
**Action**: This is a future enhancement for CLI power users. Not blocking GAIA improvement.

### File Download & Analysis Audit (bbrqxlz38.txt)
**Key Takeaways**:
- P1 (3 weeks): Download service, PDF, CSV/JSON, images
- P2: Video, audio, archives, office docs
- Safety critical: URL validation, file size limits, zip bomb prevention
- Total: 120h P1 + 160h P2

**Alignment**: ✓ Fully incorporated as Phase 1-2
**Note**: Audit had full implementation patterns ready. Just needs execution.

---

## QUICK REFERENCE: FILES TO CREATE/MODIFY

### Phase 0 (Critical Blockers)
**Create**:
- `src/services/exportService.ts` — master orchestrator
- `src/utils/exportFormatters/*.ts` — 4 export modules

**Modify**:
- `/wayfarer/wayfarer_server.py` — add 2 endpoints
- `src/utils/wayfayer.ts` — add downloadFile method
- `src/types/index.ts` — add types

### Phase 1 (Foundation)
**Create**:
- `src/services/downloadService.ts`
- `src/services/fileAnalysisService.ts`
- `src/services/evaluationService.ts`
- `src/services/contextManagement.ts`
- `src/components/RichFormatting/*.tsx` (5 components)

**Modify**:
- `src/services/ollama.ts` — add caching
- `src/hooks/useCycleLoop.ts` — integrate all new services
- `src/types/index.ts` — add 10+ new types

### Phase 2 (Leverage)
**Create**:
- `src/services/knowledgeBaseService.ts`
- `src/services/improvementLoopService.ts`
- `src/components/SimilarFindingsPanel.tsx`

**Modify**:
- `src/utils/visualScoutAgent.ts` — generalize
- Research pipeline hooks — integrate KB + vision

---

## TEAM ASSIGNMENTS (2-3 developers)

**Developer 1** (Architect/Lead): P0, 1A, 1D, 2B-C, integration
**Developer 2** (Backend): 1B-C, 2A, 3A (file/search/vision)
**Developer 3** (UI/Polish): 0D-export, rich formatting, 3B-C, testing

---

## NEXT STEPS (THIS WEEK)

1. **TODAY**: Approve PHASE 0 scope (P0-A is 2-3h fix)
2. **Tomorrow**: Implement P0-A (file transfer endpoint)
3. **This week**: Validate all 3 infrastructure services
4. **Friday**: P0-D export foundation (parallel work)
5. **Next week**: Kick off Phase 1 (caching + file system)

---

## APPENDIX: GAIA Benchmark Target

**Baseline (Current)**: 50% accuracy, 32 min runtime

**Phase 1 Target**: 65% accuracy, 22 min runtime
- Query caching: 5-10% speed boost
- Quality gates: Fewer repeat failures
- Long-context: Unblock document answers

**Phase 2 Target**: 70% accuracy, 18 min runtime
- Knowledge base: Faster follow-ups
- Improvement loop: Better strategy selection

**Final Goal**: 85%+ accuracy, <15 min runtime
- Vision integration: Multi-modal reasoning
- Workflow optimization: Custom routing

---

**Document Status**: Ready for team review and approval.
**Next Review**: Weekly during Phase 0 implementation.
