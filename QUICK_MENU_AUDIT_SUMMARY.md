# Quick Menu Feature Audit — Executive Summary

## Current State
- **16 slash commands** registered in `/src/utils/slashCommands.ts`
- **Tool router** (qwen3.5:2b) intelligently selects tools
- **CLI infrastructure** with canvas documents, session state
- **Presets system** (5 research depths, 3 Neuro modes, 4 model tiers)
- **Image batch service** exists but not exposed to quick menu
- **Context-1 service** available but unused in CLI
- **Template presets** for campaigns (200+ field examples)

**No implementation of:**
- Image/document referencing
- Output variables ($LAST, $TURN_5)
- Context variables ($MODEL, $STAGE)
- Tool chaining/pipes
- Custom aliases/macros
- Batch operations
- Output formatting
- File system exploration

---

## Top 10 Feature Gaps

| # | Feature | Gap | Impact | Effort | P |
|---|---------|-----|--------|--------|---|
| A | Image Referencing | Can't batch analyze images | HIGH | MED | 1 |
| B | Document Sections | No line/section targeting | HIGH | MED | 1 |
| C | Output Variables | Can't reference $LAST_OUTPUT | HIGH | MED | 1 |
| D | Context Variables | No $MODEL, $STAGE access | HIGH | LOW | 1 |
| E | Tool Chaining | No pipes `/cmd1 | /cmd2` | HIGH | HIGH | 2 |
| F | Templates | No `/template` system | MED | MED | 3 |
| G | Aliases | No custom shortcuts | MED | MED | 3 |
| H | File Operations | No /ls, /find, /grep | MED | LOW | 2 |
| I | Batch Operations | Can't apply command to 50 files | MED | MED | 3 |
| J | Output Formatting | No --format json/csv/markdown | LOW | LOW | 3 |

---

## Implementation Roadmap

### Phase 1 (P1) — Weeks 1-2 | 40-60 Hours
**Goal:** Enable referencing external content and outputs

- **Context Variables** ($MODEL, $STAGE, $CYCLE, $TOKENS_USED) — 8-12 hrs
  - Plumb appState to command parser
  - Substitute before model call

- **Output Variable Storage** ($LAST, $TURN_N) — 12-18 hrs
  - IndexedDB schema for CommandOutput
  - Substitution engine

- **Document Section Referencing** (/reference) — 15-20 hrs
  - Parse `lines N-M`, `section "Header"`, `pattern /regex/`
  - Integrate Context-1 service

- **Image Batch Wrapping** (/image-batch) — 12-18 hrs
  - Expose imageBatchService.ts to CLI
  - Basic descriptions + quality scoring

**Value:** Unlock 60% of advanced workflows

---

### Phase 2 (P2) — Weeks 3-4 | 35-50 Hours
**Goal:** Enable workflow composition and visual analysis

- **Tool Chaining/Pipes** (/cmd1 | /cmd2) — 25-35 hrs
  - Pipe parser (detect `|` separator)
  - Output → Input bridging
  - Error handling per step

- **File System Operations** (/ls, /find, /grep, /tree) — 8-12 hrs
  - Expose shell commands in pretty format
  - Glob expansion for batch

- **Visual Scouting** (/visual-scout, /screenshot-batch) — 15-20 hrs
  - Wrap visualScoutAgent.ts
  - Screenshot + vision analysis
  - Color extraction

**Value:** Transform to "automation platform"

---

### Phase 3 (P3) — Weeks 5-6 | 25-35 Hours
**Goal:** Enable team collaboration and reuse

- **Template System** (/template list/use/create) — 20-25 hrs
  - Registry in IndexedDB
  - 6 built-in templates (research-product, image-audit, competitor-swot, etc.)
  - Template execution engine

- **Custom Aliases** (/alias create/list/delete) — 15-20 hrs
  - Argument substitution ($1, $2, $@)
  - Circular reference detection
  - Conflict prevention

- **Batch Operations** (/batch /cmd *.md) — 18-22 hrs
  - Generic batch executor
  - Parallel execution (configurable concurrency)
  - Result aggregation

- **Output Formatting** (--format json/csv/markdown) — 10-15 hrs
  - Format transformers per tool
  - File export support

**Value:** Enable team collaboration + documented workflows

---

## Priority Matrix

```
HIGH Impact, LOW Effort   → P1 Context & Output Variables
HIGH Impact, MED Effort   → P1 Document & Image Referencing
HIGH Impact, HIGH Effort  → P2 Tool Chaining
MED Impact, MED Effort    → P3 Templates & Aliases
LOW Impact, LOW Effort    → P3 Output Formatting
```

---

## Technical Architecture

### New Services (P1)
```typescript
contextVariables.ts      // Get/substitute $MODEL, $STAGE, etc.
commandOutputStorage.ts  // Store/retrieve CommandOutput
documentSectionService.ts// Parse lines/sections, integrate Context-1
imageReferenceService.ts // Wrap imageBatchService
```

### Parser Enhancements
```typescript
slashCommands.parseSlashHints()
  → Detect and substitute $VARIABLES
  → Detect and resolve /aliases
  → Detect and route /pipes
```

### Storage (IndexedDB)
```
commandOutputs     // Last 50 outputs, 500KB each max
templates          // Built-in + custom templates
aliases            // User-created aliases
documentSections   // Cache of parsed sections
```

---

## Success Metrics

### P1 (Foundation)
- [ ] All context variables accessible
- [ ] $LAST_OUTPUT reference works
- [ ] Document sections load correctly
- [ ] Image batch produces results
- [ ] 95%+ test coverage

### P2 (Composition)
- [ ] Pipes execute multi-step workflows
- [ ] File operations fast and reliable
- [ ] Visual scouting finds colors/layout
- [ ] Error handling robust
- [ ] <50ms pipe setup overhead

### P3 (Collaboration)
- [ ] Templates discoverable via /template list
- [ ] Aliases prevent shadowing built-ins
- [ ] Batch operations parallelize (4+ concurrent)
- [ ] Export formats work for all tools
- [ ] Documentation complete

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Variable substitution bugs | HIGH | Comprehensive validation + clear error msgs |
| Pipe output format mismatch | MED | Normalize to text, let model interpret |
| Token explosion in pipes | MED | Track tokens/step, abort if over budget |
| IndexedDB storage limit | MED | Auto-delete old outputs, 50 output limit |
| UX complexity | HIGH | Progressive disclosure, /help system |
| Circular alias references | LOW | Depth-first cycle detection |

---

## Estimated Cost

| Phase | Hours | Complexity | Risk |
|-------|-------|-----------|------|
| P1 (Foundation) | 40-60 | MED | LOW |
| P2 (Composition) | 35-50 | HIGH | MED |
| P3 (Collaboration) | 25-35 | MED | LOW |
| **Total** | **80-120** | **MED-HIGH** | **LOW-MED** |

---

## Key Integration Points

- **Context-1 Service** (`findSections`, `filterDocument`) — for document parsing
- **imageBatchService** — for parallel image analysis
- **visualScoutAgent** — for competitor visual analysis
- **subagentManager** — for parallel batch execution
- **ollamaService** — for all LLM calls
- **IndexedDB (idb-keyval)** — for output/template/alias persistence
- **Wayfarer API** — for screenshots
- **skillLibrary** — potential integration for learned patterns

---

## Recommendations

### Immediate (Next 2 Weeks)
1. **Implement P1** (context + output variables + document referencing)
   - Unblocks downstream features
   - Low risk, high leverage
   - Build in parallel: variables + document + image wrapping

2. **Design Pipe Syntax**
   - Finalize grammar: `/cmd1 [args] | /cmd2 [args]`
   - Error handling strategy
   - Tool compatibility matrix

3. **Create Help System**
   - `/help [command]` with examples
   - Cheat sheet for new syntax
   - Tutorial for advanced features

### Medium-term (Weeks 3-4)
4. **Deploy P2** (pipes + file operations + visual scouting)
   - Biggest UX improvement
   - Enable automation workflows
   - Comprehensive testing

### Future (Weeks 5-6+)
5. **Build P3** (templates, aliases, batch, formatting)
   - Polish based on P1/P2 feedback
   - Enable team collaboration
   - Document best practices

---

## Next Steps

1. [ ] Review audit with engineering team
2. [ ] Prioritize features vs roadmap needs
3. [ ] Spike on P1 implementation (2-3 days)
4. [ ] Finalize API signatures and syntax
5. [ ] Begin P1 with test-first approach
6. [ ] Plan documentation alongside coding
7. [ ] Beta test with team before P2

---

**Full 2000+ word audit available in:** `QUICK_MENU_FEATURE_AUDIT.md`
