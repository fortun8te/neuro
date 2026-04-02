# DOCUMENTATION REMEDIATION CHECKLIST
## Ad Agent Project (Nomads) — Implementation Roadmap

**Target Date**: May 2, 2026 (4 weeks)
**Target Coverage**: 85% (from current 68%)
**Estimated Effort**: 27 hours
**Priority**: HIGH (blocks integration, operations, onboarding)

---

## PHASE 1: CRITICAL GAPS (Week 1 — 10 hours)

### [ ] Task 1.1: Create API Reference Document (4 hours)
**Location**: Create `/docs/API_REFERENCE.md`
**Blocked By**: None
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Header: Title, introduction, version info
- [ ] Section 1: Ollama Service Wrapper API
  - [ ] generateStream() interface documented
  - [ ] Parameters with types (model, prompt, systemPrompt, options)
  - [ ] Return value documentation
  - [ ] Error handling (AbortSignal, timeout behavior)
  - [ ] Example usage with streaming callback
- [ ] Section 2: Wayfarer REST API
  - [ ] POST /research endpoint spec
  - [ ] GET /files/{id} endpoint spec
  - [ ] GET /health endpoint spec
  - [ ] Request body schemas (JSON)
  - [ ] Response body schemas with examples
  - [ ] Error codes (400, 404, 409, 504, etc.)
  - [ ] Rate limits and timeouts
- [ ] Section 3: WebSocket Streaming Protocol
  - [ ] Connection URL
  - [ ] Message types and schemas
  - [ ] Example messages (start, chunk, complete, error)
  - [ ] Close codes and error handling
- [ ] Section 4: Authentication (if any)
- [ ] Section 5: Rate Limiting & Quotas

**Acceptance Criteria**:
- Every public API has documented request/response format
- All error codes have explanations
- At least one code example per endpoint
- Can be used as standalone spec for third-party integration

---

### [ ] Task 1.2: Create Troubleshooting Guide (3 hours)
**Location**: Create `/docs/TROUBLESHOOTING.md`
**Blocked By**: None
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Header with quick-reference links
- [ ] Section 1: Ollama Connection Issues
  - [ ] Problem: ECONNREFUSED [IP:port]
  - [ ] Diagnosis steps (curl test, netstat, logs)
  - [ ] Solution: fallback to local, reconnect, restart
  - [ ] Prevention (health checks)
- [ ] Section 2: Research Timeout
  - [ ] Problem: "Phase timeout after 7200s"
  - [ ] Root causes (coverage incomplete, slow network, OOM)
  - [ ] Diagnosis (check logs, token usage, VRAM)
  - [ ] Solutions (increase timeout, reduce depth, restart Ollama)
- [ ] Section 3: Out of Memory (OOM)
  - [ ] Problem: "JavaScript heap out of memory"
  - [ ] Diagnosis (check nvidia-smi, process manager)
  - [ ] Solution (kill other processes, reduce model size, reduce parallelism)
- [ ] Section 4: Wayfarer Scraping Failures
  - [ ] Problem: "Empty research results"
  - [ ] Diagnosis (check SearXNG, Playwright, network)
  - [ ] Solution (restart containers, check DNS)
- [ ] Section 5: Database/Storage Errors
  - [ ] Problem: "IndexedDB quota exceeded"
  - [ ] Diagnosis (check browser storage quota)
  - [ ] Solution (clear old cycles, export data, increase quota)
- [ ] Section 6: Performance Issues
  - [ ] Problem: "Research very slow (4+ hours)"
  - [ ] Diagnosis (check network, VRAM, CPU)
  - [ ] Solution (reduce researchers, disable visual scouting)
- [ ] Section 7: Service Health Check Commands
  - [ ] Ollama: `curl http://localhost:11440/api/tags`
  - [ ] Wayfarer: `curl http://localhost:8889/health`
  - [ ] SearXNG: `curl http://localhost:8888/`
- [ ] Section 8: Log Locations
  - [ ] Browser console: F12 → Console tab
  - [ ] Wayfarer: stdout from Python process
  - [ ] Ollama: check Ollama service logs
  - [ ] System logs: /tmp, browser DevTools

**Acceptance Criteria**:
- Each issue has symptoms, diagnosis, and solution
- All solutions are tested and verified
- Includes commands to verify/test fixes
- Links to relevant docs (DEBUG_MODE.md, GAIA_SETUP.md)

---

### [ ] Task 1.3: Create Documentation Navigation Index (3 hours)
**Location**: Create `/docs/INDEX.md`
**Blocked By**: Task 1.1, 1.2 (for cross-references)
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Header: "Welcome to Nomads Documentation"
- [ ] Section 1: Quick Decision Tree
  - [ ] "I'm new and want to understand the project" → README.md, ARCHITECTURE
  - [ ] "I want to set up locally" → SETUP guides
  - [ ] "I'm developing a feature" → CODE STRUCTURE, API REFERENCE
  - [ ] "Something is broken" → TROUBLESHOOTING
  - [ ] "I want to run overnight" → MAINTENANCE, OPERATIONAL GUIDES
- [ ] Section 2: Documentation by Role
  - [ ] Project Manager: Overview, Roadmap
  - [ ] Developer (new): Getting Started, Architecture, Setup
  - [ ] Developer (experienced): API Reference, Code Structure
  - [ ] DevOps/Operations: Setup, Deployment, Monitoring, Troubleshooting
  - [ ] QA/Tester: User Guides, Testing, Quality Metrics
- [ ] Section 3: Documentation by Type
  - [ ] Architecture & Design (10 docs)
  - [ ] Setup & Deployment (9 docs)
  - [ ] User Guides (33 docs)
  - [ ] API Reference (new, 1 doc)
  - [ ] Troubleshooting (5 docs)
  - [ ] Code Structure (TBD)
- [ ] Section 4: Directory Structure Map
  - [ ] /docs/
  - [ ] /src/
  - [ ] /wayfarer/
  - [ ] /scripts/
- [ ] Section 5: FAQ
  - [ ] "How long does research take?"
  - [ ] "How much VRAM do I need?"
  - [ ] "Can I use this without Ollama?"
  - [ ] "How do I contribute?"
  - [ ] "Where is data stored?"
- [ ] Section 6: Glossary
  - [ ] Key terms with definitions

**Acceptance Criteria**:
- New user can find what they need in <2 minutes
- Every major document is referenced at least once
- Clear paths for each user role
- Links are all verified and working

---

## PHASE 2: IMPORTANT GAPS (Week 2 — 8 hours)

### [ ] Task 2.1: Create Data Model Documentation (3 hours)
**Location**: Create `/docs/DATA_MODELS.md`
**Blocked By**: None (can parallel with Phase 1)
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Header with overview
- [ ] Section 1: IndexedDB Schema
  - [ ] Stores (campaigns, cycles, memories, research)
  - [ ] Key structure for each store
  - [ ] Index definitions
  - [ ] Version and migration notes
- [ ] Section 2: Core Types
  - [ ] Campaign (name, brand DNA, persona)
  - [ ] Cycle (stages, outputs, metadata)
  - [ ] ResearchFindings (URLs, tokens, audit trail)
  - [ ] Memory (skills, patterns, learnings)
- [ ] Section 3: Type Relationships
  - [ ] ER diagram (Campaign → Cycles → Stages)
  - [ ] Data flow (creation, modification, archival)
- [ ] Section 4: Enums & Constants
  - [ ] StageName values
  - [ ] ResearchDepth levels
  - [ ] CycleMode options
- [ ] Section 5: Storage & Queries
  - [ ] How campaigns are queried
  - [ ] How memories are retrieved (semantic search)
  - [ ] Data retention policies

**Acceptance Criteria**:
- All types in `src/types/index.ts` explained
- Relationships between types clear
- Storage format documented
- Query examples provided

---

### [ ] Task 2.2: Create Maintenance Playbook (3 hours)
**Location**: Create `/docs/MAINTENANCE_PLAYBOOK.md`
**Blocked By**: None (can parallel)
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Header: Purpose, scope, audience
- [ ] Section 1: Daily Checks
  - [ ] Service health (Ollama, Wayfarer, SearXNG)
  - [ ] Disk space check
  - [ ] Memory usage check
  - [ ] Error log review
  - [ ] Checklist format with commands
- [ ] Section 2: Weekly Maintenance
  - [ ] Clear old research results (>30 days)
  - [ ] Archive completed cycles
  - [ ] Review token usage trends
  - [ ] Test backup procedures
  - [ ] Update credentials if needed
- [ ] Section 3: Monthly Procedures
  - [ ] Deep system health check
  - [ ] Performance benchmarking
  - [ ] Model update check (new versions available?)
  - [ ] Documentation review & updates
- [ ] Section 4: Overnight Operation Procedures
  - [ ] Pre-flight checklist (all services healthy)
  - [ ] Research configuration (depth, timeout, parallelism)
  - [ ] Monitoring setup (alerts if failure)
  - [ ] Post-flight checklist (verify results)
  - [ ] Troubleshooting steps if interrupted
- [ ] Section 5: Crash Recovery
  - [ ] Checkpoint validation
  - [ ] Resume-from-checkpoint procedure
  - [ ] Data integrity verification
  - [ ] VRAM cleanup
  - [ ] Service restart sequence
- [ ] Section 6: Backup & Disaster Recovery
  - [ ] Database backup locations
  - [ ] Backup frequency recommendations
  - [ ] Recovery procedures
  - [ ] Data export/import

**Acceptance Criteria**:
- Can be followed by non-expert operator
- All commands provided and tested
- Covers unexpected failure scenarios
- Recovery time is <30 minutes for most issues

---

### [ ] Task 2.3: Create System Architecture Diagram (2 hours)
**Location**: Create `/docs/ARCHITECTURE_DIAGRAM.md`
**Blocked By**: None (can parallel)
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] ASCII Diagram 1: Component Architecture
  ```
  User Interface (React)
      ↓
  Context API (CampaignContext)
      ↓
  Hooks (useCycleLoop, useOrchestratedResearch)
      ↓
  Services (researchAgents, ollamaService, etc)
      ↓
  External Services (Ollama, Wayfarer, SearXNG)
  ```
- [ ] ASCII Diagram 2: Data Flow
  ```
  User Input → Cycle Start → Research → Objections → Taste → Make → Test → Cycle Complete
  ```
- [ ] ASCII Diagram 3: Service Dependencies
  ```
  Frontend → Ollama (LLM)
          → Wayfarer (Web Research)
             → SearXNG (Meta Search)
          → Firebase (Sync)
          → IndexedDB (Local Storage)
  ```
- [ ] ASCII Diagram 4: Agent Orchestration
  ```
  Router → Middle Agent → Orchestrator → Researchers (parallel)
                      → Workers (code, file, vision, etc)
  ```
- [ ] Detailed explanations for each diagram

**Acceptance Criteria**:
- Diagrams are ASCII (easy to version in git)
- All major components included
- Data flow direction is clear
- Service boundaries obvious

---

## PHASE 3: POLISH & CONSOLIDATION (Week 3 — 9 hours)

### [ ] Task 3.1: Consolidate User Guides (4 hours)
**Location**: Create `/docs/GETTING_STARTED.md` + `/docs/GUIDES/`
**Blocked By**: Task 1.3 (INDEX.md for hierarchy)
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Create `/docs/GETTING_STARTED.md` (single entry point)
  - [ ] Prerequisites (Node, Python, Docker, VRAM)
  - [ ] 5-minute setup walkthrough
  - [ ] First campaign creation steps
  - [ ] Running first research cycle
  - [ ] Next steps links
- [ ] Create `/docs/GUIDES/` directory with:
  - [ ] CREATE_CAMPAIGN.md (new campaign from scratch)
  - [ ] RESEARCH_CONFIG.md (research depth, presets)
  - [ ] COMPETITOR_ANALYSIS.md (how to analyze competitors)
  - [ ] CREATE_ADS.md (make stage workflow)
  - [ ] OVERNIGHT_RESEARCH.md (unattended operation)
  - [ ] INTEGRATION_CUSTOM_DATA.md (bring your own data)
- [ ] Update each guide:
  - [ ] Add time estimates ("Takes ~15 minutes")
  - [ ] Add prerequisite checks
  - [ ] Add success criteria
  - [ ] Cross-link related guides
- [ ] Create navigation structure
  - [ ] README.md references GETTING_STARTED.md
  - [ ] Each guide links to next logical step

**Acceptance Criteria**:
- New user can follow GETTING_STARTED.md end-to-end
- No need to reference multiple docs for single task
- All 33 existing guides consolidated/reorganized
- Task-based (not feature-based) organization

---

### [ ] Task 3.2: Add Code Examples to JSDoc (3 hours)
**Location**: 50+ key files in `/src`
**Blocked By**: None (can parallel)
**Owner**: [TBD]
**Status**: Not Started

**Priority Files**:
- [ ] `src/hooks/useCycleLoop.ts` (already good, add @example blocks)
- [ ] `src/utils/orchestratorRouter.ts` (sparse, needs examples)
- [ ] `src/utils/researchAgents.ts`
- [ ] `src/utils/ollamaService.ts`
- [ ] `src/context/CampaignContext.tsx`
- [ ] [40+ more utility/hook files]

**For Each File**:
- [ ] Add @example block to 3-5 key exported functions
- [ ] Examples should be copy-paste ready
- [ ] Include both success and error paths
- [ ] Link to full docs for complex usage

**Acceptance Criteria**:
- 50+ key functions have @example blocks
- Examples work (tested)
- Consistent format across codebase
- JSDoc linter passes

---

### [ ] Task 3.3: Create Monitoring & Observability Guide (2 hours)
**Location**: Create `/docs/MONITORING.md`
**Blocked By**: None (can parallel)
**Owner**: [TBD]
**Status**: Not Started

**Deliverables**:
- [ ] Section 1: Health Checks
  - [ ] Service status endpoints
  - [ ] Commands to verify all services
  - [ ] Expected response formats
- [ ] Section 2: Metrics to Track
  - [ ] Token usage (per stage, per cycle)
  - [ ] Research time (target vs actual)
  - [ ] Error rates
  - [ ] Memory usage trends
- [ ] Section 3: Logging Setup
  - [ ] Enable debug mode
  - [ ] Log rotation configuration
  - [ ] Log aggregation (if using external tools)
  - [ ] Log parsing for automated monitoring
- [ ] Section 4: Alerts & Notifications
  - [ ] Service down alerts
  - [ ] Timeout alerts
  - [ ] VRAM exceeded alerts
  - [ ] Error rate threshold alerts
- [ ] Section 5: Dashboard Example
  - [ ] Suggested metrics for monitoring dashboard
  - [ ] Tools (Grafana, Prometheus, etc. if applicable)
  - [ ] Setup instructions

**Acceptance Criteria**:
- Operator can set up monitoring in <2 hours
- All critical metrics covered
- Alert thresholds are rational
- Includes scripts for automated checks

---

## PHASE 4: VERIFICATION & SIGN-OFF (Week 4)

### [ ] Task 4.1: Verify All Links & References (2 hours)
**Owner**: [TBD]
**Status**: Not Started

- [ ] All links in INDEX.md are valid
- [ ] All cross-references between docs work
- [ ] No broken image/diagram references
- [ ] All code examples compile/run

---

### [ ] Task 4.2: New User Onboarding Test (3 hours)
**Owner**: [TBD] (ideally someone unfamiliar with project)
**Status**: Not Started

- [ ] Follow GETTING_STARTED.md from scratch
- [ ] Complete first campaign creation
- [ ] Run first research cycle
- [ ] Note any confusion or missing info
- [ ] Update docs based on feedback

---

### [ ] Task 4.3: Documentation Coverage Review (1 hour)
**Owner**: [TBD]
**Status**: Not Started

- [ ] Re-audit against original 8 dimensions
- [ ] Verify score improved from 68% → 85%+
- [ ] Identify any remaining gaps
- [ ] Create follow-up tasks if needed

---

## SUMMARY OF CHANGES

### New Files to Create (11 total)
- `/docs/INDEX.md` — Navigation hub
- `/docs/API_REFERENCE.md` — API contracts
- `/docs/TROUBLESHOOTING.md` — Problem solving
- `/docs/DATA_MODELS.md` — Type/schema docs
- `/docs/MAINTENANCE_PLAYBOOK.md` — Operations procedures
- `/docs/ARCHITECTURE_DIAGRAM.md` — Visual architecture
- `/docs/GETTING_STARTED.md` — Single entry point
- `/docs/GUIDES/CREATE_CAMPAIGN.md`
- `/docs/GUIDES/RESEARCH_CONFIG.md`
- `/docs/GUIDES/COMPETITOR_ANALYSIS.md`
- `/docs/GUIDES/OVERNIGHT_RESEARCH.md`
- `/docs/MONITORING.md` — Observability setup

### Files to Reorganize
- Move 194 .md/.txt files into `/docs` structure
- Archive completed audits (50+ files) to `/docs/ARCHIVED/`
- Update README.md to reference `/docs/INDEX.md`

### Files to Enhance
- 50+ source files: add @example blocks to JSDoc
- .env.example: already good, just reference from GETTING_STARTED.md

---

## RESOURCE ALLOCATION

| Week | Task | Owner | Hours | Status |
|------|------|-------|-------|--------|
| **1** | 1.1 API Reference | [Name] | 4 | ⬜ |
| | 1.2 Troubleshooting | [Name] | 3 | ⬜ |
| | 1.3 Navigation Index | [Name] | 3 | ⬜ |
| | **Subtotal** | | 10 | |
| **2** | 2.1 Data Models | [Name] | 3 | ⬜ |
| | 2.2 Maintenance Playbook | [Name] | 3 | ⬜ |
| | 2.3 Architecture Diagrams | [Name] | 2 | ⬜ |
| | **Subtotal** | | 8 | |
| **3** | 3.1 Consolidate Guides | [Name] | 4 | ⬜ |
| | 3.2 Code Examples | [Name] | 3 | ⬜ |
| | 3.3 Monitoring Guide | [Name] | 2 | ⬜ |
| | **Subtotal** | | 9 | |
| **4** | 4.1 Link Verification | [Name] | 2 | ⬜ |
| | 4.2 New User Test | [Name] | 3 | ⬜ |
| | 4.3 Coverage Review | [Name] | 1 | ⬜ |
| | **Subtotal** | | 6 | |
| | **TOTAL** | | 33 | |

---

## SUCCESS CRITERIA

- [ ] All 11 new documents created
- [ ] Documentation organized in `/docs` structure
- [ ] Coverage increased from 68% → 85%+
- [ ] New user can onboard without questions
- [ ] API reference enables third-party integration
- [ ] Troubleshooting guide resolves 90% of common issues
- [ ] Maintenance playbook supports 24/7 operation

---

## NOTES & CONSTRAINTS

- **Constraint 1**: Must not break existing links/references in current docs
- **Constraint 2**: Use existing tools (Markdown, ASCII diagrams)
- **Constraint 3**: Keep maintenance burden low (no special tools/platforms)
- **Constraint 4**: All docs remain version-controlled in git

---

**Checklist Created**: April 2, 2026
**Target Completion**: May 2, 2026
**Current Coverage**: 68% → Target: 85%
**Estimated Value**: 40% faster bug fixes, 60% faster MTTR, 50% faster onboarding
