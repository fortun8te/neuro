# Benchmark Test Plan — Phase 1 Multi-Task Fix

**Objective:** Verify that multi-task classification fixes "doesn't call enough tools" problem
**Duration:** 15-30 minutes
**Success Criteria:** Multi-task queries complete end-to-end with full tool set

---

## Test Setup (5 minutes)

### 1. Start Infrastructure

**Terminal 1: Docker + SearXNG**
```bash
cd /Users/mk/Downloads/nomads
docker-compose up -d

# Verify:
curl http://localhost:8888/config 2>/dev/null | head -20
# Should show SearXNG config
```

**Terminal 2: Wayfarer (Python 3.11)**
```bash
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# Verify logs show "Uvicorn running on http://0.0.0.0:8889"
```

**Terminal 3: Dev Server**
```bash
cd /Users/mk/Downloads/nomads
npm run dev

# Verify: "VITE v7.x.x dev server running at http://localhost:5173"
```

### 2. Open AgentPanel
- Navigate to http://localhost:5173
- Verify no errors in browser console
- You should see empty AgentPanel

---

## Test 1: Multi-Task Query (5-10 minutes)

### Goal
Verify that a single query combining research + analysis + creation gets tools from all three categories.

### Test Query
```
Search for the top 3 AI coding assistants (Claude, Copilot, Cursor).
Compare their code generation quality, pricing, and market positioning.
Then draft a brief competitive analysis document highlighting the winner.
```

### What To Watch For

**Phase 1: Research Startup (should see 1-2 researchers spawning)**
```
[Researcher 1] Searching for Claude AI capabilities...
[Researcher 2] Searching for Copilot market position...
(Wait ~5-10 seconds for searches to complete)
```

**Phase 2: Comparison/Analysis (should use analyze tools)**
```
[Analysis] Comparing code generation quality across tools...
[Competitor SWOT] Extracting competitive positioning...
(Wait ~3-5 seconds for analysis)
```

**Phase 3: Document Writing (should use create tools)**
```
[Writer] Drafting competitive analysis document...
[DOCX] Creating formatted Word document...
(Wait ~5-10 seconds for writing)
```

### Success Criteria

✅ **All 3 phases complete without errors**
- Research: Gathers info on all 3 assistants
- Analysis: Compares their positioning
- Writing: Creates a formatted document
- No "I don't have tools for X" messages

❌ **Failure Indicators**
- Gets stuck after research ("I can't analyze this")
- Skips writing phase
- Says "I don't have write_content tool"
- Tool execution errors

### Expected Output
```
Research Summary:
- Claude: Strong general capabilities, $20/month
- Copilot: GitHub integration, $10/month
- Cursor: IDE-native, free tier available

Competitive Analysis:
- Claude: Best for creative/complex coding
- Copilot: Best for GitHub workflows
- Cursor: Best for IDE integration

Winner: Claude (most capable, reasonable pricing)
(Document saved as analysis.docx)
```

---

## Test 2: Subagent Parallelization (3-5 minutes)

### Goal
Verify that subagents can now do more work before hitting the 15-step limit (up from 5).

### Test Query
```
Research 10 different Python web frameworks (Django, Flask, FastAPI,
Pyramid, Tornado, Aiohttp, Sanic, Quart, Starlette, Falcon) in parallel
and create a summary table comparing them.
```

### What To Watch For

**Startup: Subagent Deployment**
```
[Orchestrator] Spawning 5 parallel workers...
[Worker 1] Researching Django...
[Worker 2] Researching Flask...
[Worker 3] Researching FastAPI...
[Worker 4] Researching Pyramid...
[Worker 5] Researching Tornado...
```

**Execution: Multiple Searches Per Worker**
```
[Worker 1] Search 1: "Django Python framework features"
[Worker 1] Search 2: "Django performance benchmarks"
[Worker 1] Search 3: "Django community ecosystem"
(Multiple searches per worker indicates 15-step budget is working)
```

**Completion: Full Coverage**
```
[Orchestrator] Received findings from all workers
[Synthesizer] Creating comparison table...
(Table shows all 10 frameworks with consistent fields)
```

### Success Criteria

✅ **All 10 frameworks researched**
- Each gets 2-3 search queries minimum
- Consistent information (features, performance, ecosystem)
- Table/summary shows complete comparison

❌ **Failure Indicators**
- Only 5 frameworks researched (hit old 5-step limit)
- Frameworks have incomplete information
- Subagents timeout before completing

### Expected Output
| Framework | Type | Performance | Learning Curve | Use Case |
|-----------|------|-------------|---|---|
| Django | Full-stack | Medium | Medium | Rapid development |
| Flask | Micro | Fast | Low | Simple APIs |
| FastAPI | Async | Very Fast | Medium | High-performance APIs |
| ... | ... | ... | ... | ... |

---

## Test 3: Tool Availability Verification (2-3 minutes)

### Goal
Verify that the planner has access to the merged tool sets.

### Debugging: Check Agent UI

In AgentPanel, open DevTools (F12) and run:

```javascript
// Check what tools are available (if exposed in window object)
console.log(window.__AGENT_STATE__ || "Tools not exposed");
```

### Alternative: Watch ResearchOutput

Look at the ResearchOutput UI for tool names:
- Search tools: `web_search`, `multi_browse`, `scrape_page`
- Analysis tools: `competitor_swot`, `social_intelligence`
- Create tools: `write_content`, `create_docx`
- Meta: `think`, `plan`, `ask_user`, `done`

✅ **Success:** See tools from MULTIPLE categories
❌ **Failure:** See tools from only ONE category (means fix didn't apply)

---

## Test 4: Single-Task Queries Still Work (1 minute)

### Goal
Ensure backwards compatibility—single-task queries should still work normally.

### Test Queries
```
1. "Search for recent AI news"        → Should work (research only)
2. "Write a product description"      → Should work (create only)
3. "Analyze this code for bugs"       → Should work (code only)
```

### Success Criteria

✅ Single-task queries execute normally without multi-category interference
❌ Single-task queries are slower or broken (regressions)

---

## Benchmark Scorecard

### Before Phase 1 Fix
```
Multi-task query: "research + analyze + write"
├─ Task classification: 'analyze' (first match only)
├─ Tools given: 14 (just analyze category)
├─ Missing tools: write_content, create_docx
├─ Result: ❌ FAILS after analysis phase
└─ Status: "Can't write document"

Subagent budget: 5 steps max
├─ Complex research: ~4 steps per topic
├─ 20 topics in parallel: ❌ FAILS (5-step limit)
└─ Result: "Research incomplete, hit tool limit"
```

### After Phase 1 Fix
```
Multi-task query: "research + analyze + write"
├─ Task classification: ['analyze', 'create', 'research']
├─ Tools given: 24+ (union of all categories)
├─ Includes: write_content, create_docx, web_search, etc.
├─ Result: ✅ COMPLETES all phases
└─ Status: "Full workflow successful"

Subagent budget: 15 steps max
├─ Complex research: ~10-12 steps per topic
├─ 20 topics in parallel: ✅ SUCCEEDS
└─ Result: "All topics researched thoroughly"
```

---

## Troubleshooting

### Issue: Tools not showing in tool descriptions
**Solution:**
- Check build: `npm run build` should complete
- Check no TypeScript errors: `npm run build 2>&1 | grep error`
- Restart dev server: Kill Terminal 3, re-run `npm run dev`

### Issue: Searches fail ("Wayfarer error")
**Solution:**
- Verify SearXNG: `curl http://localhost:8888/config`
- Verify Wayfarer: `curl http://localhost:8889/health` (if endpoint exists)
- Check SEARXNG_URL is set: `echo $SEARXNG_URL` (should be http://localhost:8888)

### Issue: Subagents timeout
**Solution:**
- Check Ollama is running: `curl http://100.74.135.83:11440/api/tags`
- Check VRAM: `nvidia-smi` or `watch nvidia-smi`
- Reduce workers: Edit subagentManager.ts if needed

### Issue: Agent stuck in loop
**Solution:**
- This is error recovery working (trying different approaches)
- Wait 30-60 seconds for recovery
- Or click "Cancel" to abort and try simpler query

---

## Reporting Results

After tests complete, report:

```markdown
## Benchmark Results

### Multi-Task Query Test
- [x] All 3 phases completed
- [ ] Partial (stopped at phase __)
- [ ] Failed

### Subagent Parallelization Test
- [x] All 10 frameworks researched
- [ ] Partial (__/10 completed)
- [ ] Failed

### Tool Availability Test
- [x] Multi-category tools visible
- [ ] Single-category only
- [ ] Not visible

### Backwards Compatibility
- [x] Single-task queries work
- [ ] Some failures
- [ ] All broken

### Overall Status
[✅ PASS / ⚠️ PARTIAL / ❌ FAIL]

### Issues Encountered
(List any errors, timeouts, or unexpected behavior)

### Performance Notes
(Timing for each phase, token counts if visible, resource usage)
```

---

## Success Definition

✅ **Phase 1 is successful if:**
1. Multi-task query completes all 3 phases
2. Tools from multiple categories are used
3. No "don't have tools for X" errors
4. Subagents complete more work (15 steps vs 5)
5. Build clean, TypeScript errors = 0

Then we proceed to benchmark suite and Phase 2 planning.

---

## Time Budget

| Test | Time |
|------|------|
| Setup | 5 min |
| Test 1 (multi-task) | 10 min |
| Test 2 (subagents) | 5 min |
| Test 3 (tools) | 3 min |
| Test 4 (backwards compat) | 2 min |
| **Total** | **25 min** |

---

## Next Commands

Once testing is complete:

```bash
# If all tests pass:
git add -A
git commit -m "Phase 1: Multi-task classification + subagent budget fix"
git push origin main

# If issues found:
# Debug, then re-run tests

# For Phase 2 planning:
# Read ARCHITECTURE_VISION.md + RECURSIVE_PLANNING_ARCHITECTURE.md
```

---

## Questions?

Refer to:
- IMPLEMENTATION_SUMMARY.md — What changed and why
- PHASE_1_MULTI_TASK_FIX.md — Technical details
- REAL_ARCHITECTURE_AUDIT.md — Root cause analysis
- agentEngine.ts:4413-4502 — Code changes (classifyTaskTypes, pruneToolsForTask)
- subagentManager.ts:242 — Subagent budget change
