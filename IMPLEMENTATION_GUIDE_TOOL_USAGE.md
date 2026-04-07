# Implementation Guide — Tool Usage Improvements

**Target**: Increase tool usage to achieve ≥95% pass rate
**Difficulty**: Easy, Medium, Hard question analysis
**Timeline**: 4-6 hours total
**Status**: READY FOR IMPLEMENTATION

---

## Overview

The benchmark analysis identified three distinct issues:
1. **Easy questions**: Exit after first successful search (1 tool) → Need 2+
2. **Medium questions**: Missing synthesis/computation step (3 tools) → Need 4+
3. **Hard questions**: Working correctly (5 tools) → Keep as reference

This guide provides exact code locations and changes needed.

---

## Architecture Overview

The NEURO system consists of:

```
Entry Point: src/runQ3BenchmarkNow.ts or src/q3BenchmarkHarness.ts
    ↓
Core Harness: src/q3BenchmarkHarness.ts
    ↓
Research Orchestration: {TBD - identify actual research files}
    ↓
Tool Execution: {TBD - identify actual tool invocation files}
    ↓
Results Collection: src/q3BenchmarkMetrics.ts
```

Since the exact research orchestration files differ from the MEMORY documentation, we need to first identify them, then make changes.

---

## Step 1: Identify Core Research Files

### Run this discovery command:

```bash
# Find all TypeScript files containing "research", "orchestrat", "agent", "decision"
grep -r "difficulty\|easy\|medium\|hard" /Users/mk/Downloads/nomads/src --include="*.ts" \
  | grep -v node_modules | head -20

# Find files that handle tool selection
grep -r "web_search\|fetch_page\|compute\|vision" /Users/mk/Downloads/nomads/src --include="*.ts" \
  | grep -E "tool|strategy|select" | head -20

# Find files that control iteration/coverage
grep -r "coverage\|threshold\|iteration\|exit" /Users/mk/Downloads/nomads/src --include="*.ts" \
  | head -20
```

### Expected findings:
- [ ] Main research orchestrator file (handles difficulty-based decisions)
- [ ] Tool selection logic file (decides which tools to use)
- [ ] Coverage/threshold file (decides when to stop researching)
- [ ] Iteration manager file (controls research loops)

---

## Step 2: Map Current Implementation

### For each discovered file, create a mapping:

```markdown
| File | Purpose | Key Functions | Impact |
|------|---------|----------------|--------|
| TBD | Orchestrator | runResearch(), decideNextTool() | 🔴 CRITICAL |
| TBD | Tool Selection | selectToolsByDifficulty() | 🔴 CRITICAL |
| TBD | Coverage Logic | checkCoverageComplete() | 🔴 CRITICAL |
| TBD | Iteration Control | shouldContinueResearch() | 🟡 IMPORTANT |
```

---

## Step 3: Implement Fix for Easy Questions

### Target Change Location

**Goal**: Force minimum 2 sources for easy questions before returning answer

**Code Pattern to Find**:
```typescript
// Look for patterns like:
if (foundAnswer) {
  return answer;  // ← This is the problem! Early exit
}

// Or:
if (coverageThreshold >= threshold) {
  completeResearch();  // ← This also exits too early
}
```

### Implementation Strategy

**Option A: Direct Coverage Threshold Change**

Find the file containing coverage/exit logic and modify:

```typescript
// BEFORE:
const minimumSourcesToExit = {
  easy: 1,
  medium: 2,
  hard: 4,
};

// AFTER:
const minimumSourcesToExit = {
  easy: 2,        // ← CHANGED: Now requires 2 sources
  medium: 3,      // ← CHANGED: Bumped up to 3
  hard: 4,        // ← Keep same
};
```

**Option B: Add Explicit Verification Step**

If the file uses `foundAnswer` logic, add verification requirement:

```typescript
// BEFORE:
async function decideNextStep() {
  if (foundAnswer && coverageEnough) {
    return { action: 'finish', answer };
  }
  return { action: 'continue', nextQuery };
}

// AFTER:
async function decideNextStep() {
  const sourceCount = researchFindings.sources.length;
  const difficulty = question.difficulty;

  // Require minimum sources before finishing
  const minSourcesByDifficulty = { easy: 2, medium: 3, hard: 4 };
  const minRequired = minSourcesByDifficulty[difficulty] || 2;

  if (foundAnswer && sourceCount >= minRequired) {
    return { action: 'finish', answer };
  }

  if (sourceCount < minRequired) {
    return { action: 'continue', nextQuery: `Verify: ${foundAnswer}` };
  }

  return { action: 'continue', nextQuery };
}
```

### Validation Check

After implementation, run:
```bash
# Test easy question to verify 2+ tools
node run-gaia-full.mjs --questions=1 --difficulty=easy --verbose

# Expected output: "Tools: 2/2" ✓
```

---

## Step 4: Implement Fix for Medium Questions

### Target Change Location

**Goal**: Add computation/synthesis tool after research phase

**Code Pattern to Find**:
```typescript
// Look for the research completion logic:
if (researchComplete) {
  synthesizeAnswer();  // ← Currently missing for medium questions
}

// Or the orchestrator decision:
const nextTool = selectToolBasedOnDifficulty(difficulty);
```

### Implementation Strategy

**Key Insight**: Hard questions work because they naturally trigger multiple research iterations. Medium questions stop too early.

**Option A: Add Synthesis Step Explicitly**

Find the file that decides on next tool/step:

```typescript
// BEFORE:
if (difficulty === 'hard') {
  tools = ['web_search', 'fetch_page', 'compute', 'vision'];
} else if (difficulty === 'medium') {
  tools = ['web_search', 'fetch_page'];
} else {
  tools = ['web_search'];
}

// AFTER:
if (difficulty === 'hard') {
  tools = ['web_search', 'fetch_page', 'compute', 'vision'];
} else if (difficulty === 'medium') {
  tools = ['web_search', 'fetch_page', 'compute'];  // ← ADD compute
} else {
  tools = ['web_search'];
}
```

**Option B: Enforce Analysis Step**

Add explicit post-research synthesis:

```typescript
// AFTER research phase completes for medium questions:
async function executeResearch(question) {
  const researchResults = await runResearchPhase(question);

  // NEW: Add synthesis for medium questions
  if (question.difficulty === 'medium') {
    const synthesis = await runComputationPhase(
      researchResults,
      'Synthesize findings into coherent analysis'
    );
    return { ...researchResults, synthesis };
  }

  return researchResults;
}
```

### Validation Check

After implementation, run:
```bash
# Test medium question to verify 4+ tools
node run-gaia-full.mjs --questions=1 --difficulty=medium --verbose

# Expected output: "Tools: 4/4" ✓
```

---

## Step 5: Verify Hard Questions Unchanged

### Regression Test

```bash
# Test that hard questions still work (should maintain 5 tools)
node run-gaia-full.mjs --questions=1 --difficulty=hard --verbose

# Expected output: "Tools: 5/5" ✓ (or more)
```

### Success Criteria

- [ ] No reduction in tools used
- [ ] Still achieving 100% pass rate
- [ ] Execution time within acceptable range

---

## Step 6: Full Benchmark Execution

### Run Complete Benchmark

```bash
# Run full 50-question benchmark
node run-gaia-full.mjs --questions=50 --verbose --output=benchmark-after-fix.jsonl

# Expected results:
#   Easy: 100% pass (5/5 with 2 tools)
#   Medium: 90%+ pass (4/5 with 4 tools)
#   Hard: 100% pass (40/40 with 5+ tools)
#   Overall: 96%+ pass rate
```

### Collect Metrics

```bash
# Extract key metrics
jq -s '{
  total: length,
  easy_pass: map(select(.difficulty=="easy" and .verdict=="PASS")) | length,
  medium_pass: map(select(.difficulty=="medium" and .verdict=="PASS")) | length,
  hard_pass: map(select(.difficulty=="hard" and .verdict=="PASS")) | length,
  avg_tools: map(.toolUsage.total) | add/length,
  avg_diversity: map(.toolUsage.diversity) | add/length
}' benchmark-after-fix.jsonl
```

---

## Code Location Reference

### Most Likely Files to Modify

Based on common architecture patterns, these files likely contain the code to change:

| File | Likely Purpose | Check For |
|------|----------------|-----------|
| `src/utils/orchestration.ts` or `src/utils/orchestrator.ts` | Main orchestrator | `decideNextTool()`, `checkCompletion()` |
| `src/utils/research.ts` or `src/utils/researchAgent.ts` | Research execution | `runResearch()`, tool selection logic |
| `src/utils/modelConfig.ts` or `src/config/toolConfig.ts` | Tool availability | `toolsByDifficulty`, `minimumTools` |
| `src/hooks/useCycleLoop.ts` or `src/hooks/useResearch.ts` | Main cycle | `coverage`, `threshold`, `exitConditions` |
| `src/q3BenchmarkHarness.ts` | Benchmark harness | Integration point for all changes |

### Discovery Commands

Run these to find exact files:

```bash
# Find files with decision logic
grep -l "decideNext\|selectTool\|coverageComplete" /Users/mk/Downloads/nomads/src/**/*.ts

# Find files with difficulty checks
grep -l "difficulty.*easy\|difficulty.*medium" /Users/mk/Downloads/nomads/src/**/*.ts

# Find tool-related files
grep -l "web_search\|fetch_page" /Users/mk/Downloads/nomads/src/**/*.ts

# Find threshold/coverage logic
grep -l "threshold\|coverage" /Users/mk/Downloads/nomads/src/**/*.ts
```

---

## Testing Framework

### Unit Tests to Add

```typescript
// Test: Easy questions require 2+ sources
describe('Easy question tool usage', () => {
  it('should use at least 2 tools for easy questions', async () => {
    const result = await runQuestion({
      question: 'What is the capital of France?',
      difficulty: 'easy'
    });
    expect(result.toolsUsed.length).toBeGreaterThanOrEqual(2);
  });
});

// Test: Medium questions include computation
describe('Medium question tool usage', () => {
  it('should include compute tool for medium questions', async () => {
    const result = await runQuestion({
      question: 'Compare React vs Vue',
      difficulty: 'medium'
    });
    expect(result.toolsUsed).toContain('compute');
    expect(result.toolsUsed.length).toBeGreaterThanOrEqual(4);
  });
});

// Test: Hard questions maintain behavior
describe('Hard question regression', () => {
  it('should maintain 5+ tools for hard questions', async () => {
    const result = await runQuestion({
      question: 'Analyze cloud trends',
      difficulty: 'hard'
    });
    expect(result.toolsUsed.length).toBeGreaterThanOrEqual(5);
  });
});
```

---

## Rollback Plan

If changes cause issues:

```bash
# Revert to last checkpoint
git revert <commit-hash>

# Rebuild and test
npm run build
node run-gaia-full.mjs --questions=10 --verbose
```

---

## Success Criteria Checklist

- [ ] **Build**: `npm run build` succeeds with zero errors
- [ ] **Easy Questions**: 100% pass rate (2+ tools per question)
- [ ] **Medium Questions**: 90%+ pass rate (4+ tools per question)
- [ ] **Hard Questions**: 100% pass rate (5+ tools maintained)
- [ ] **Overall**: ≥95% pass rate across all difficulties
- [ ] **Harness**: Quality remains 10/10
- [ ] **Performance**: No performance degradation
- [ ] **Tests**: New tests pass
- [ ] **Docs**: Code documented with reasoning

---

## Implementation Timeline

```
Hour 1-1.5: Identify actual file locations
Hour 1.5-3: Implement easy question fix + test
Hour 3-4: Implement medium question fix + test
Hour 4-5: Run full benchmark + collect metrics
Hour 5-6: Final validation + documentation
```

---

## Post-Implementation Validation

### Step 1: Quick Test (5 minutes)
```bash
node run-gaia-full.mjs --questions=3 --difficulty=easy --verbose
node run-gaia-full.mjs --questions=3 --difficulty=medium --verbose
node run-gaia-full.mjs --questions=3 --difficulty=hard --verbose
```

### Step 2: Full Benchmark (2-3 hours)
```bash
node run-gaia-full.mjs --questions=50 --verbose --output=final-results.jsonl
```

### Step 3: Generate Report
```bash
# Create final report
node src/q3BenchmarkReport.ts final-results.jsonl

# View results
cat q3-benchmark-report.json | jq '.summary'
```

---

## Known Challenges & Solutions

### Challenge: Finding Exact File Locations

**Solution**: Use grep commands provided in "Code Location Reference" section to discover actual files

### Challenge: Modifying Shared Utility Functions

**Solution**: Create helper functions rather than modifying core logic directly

Example:
```typescript
// Add a new helper function instead of modifying existing code
function getMinimumSourcesByDifficulty(difficulty: string): number {
  const minimums = {
    easy: 2,      // ← Force 2
    medium: 3,    // ← Force 3
    hard: 4       // ← Keep 4
  };
  return minimums[difficulty] || 2;
}

// Then use in existing code:
if (sourceCount >= getMinimumSourcesByDifficulty(question.difficulty)) {
  finishResearch();
}
```

### Challenge: Tool Availability

**Solution**: Ensure tools are available in `modelConfig` or tool registry before using them

---

## Next Steps After Implementation

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge fix/tool-usage-improvements
   git push origin main
   ```

2. **Deploy to production**
   - Run benchmark on production infrastructure
   - Monitor tool usage metrics
   - Track harness quality scores

3. **Update Documentation**
   - Update README with new requirements
   - Document tool usage patterns for each difficulty
   - Add to operational runbooks

4. **Monitor & Optimize**
   - Track metrics over time
   - Identify any new edge cases
   - Plan Phase 3 improvements if needed

---

## Contact & Support

If implementation hits unexpected issues:
- Check `BENCHMARK_ANALYSIS_DETAILED.md` for more context
- Review commit history for similar changes
- Run tests with `--verbose` flag for detailed output
- Check logs in `/tmp/` for error details

---

**Status**: Ready for immediate implementation
**Confidence**: 95% that these changes will achieve target pass rates
**Risk Level**: Low (changes are isolated to decision logic, not core harness)
