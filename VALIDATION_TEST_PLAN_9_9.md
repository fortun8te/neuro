# NEURO 9.9/10 — Comprehensive Validation Test Plan

**Status:** Complete testing framework
**Date:** April 2, 2026
**Test Duration:** ~4 hours per phase
**Total Test Time:** 20+ hours (across all phases)

---

## Overview

This document provides comprehensive testing procedures for validating all 5 phases of the 9.9/10 integration. Each test includes:
- Setup steps
- Test execution procedure
- Expected outcomes
- Failure diagnosis
- Remediation steps

---

## Pre-Test Environment Setup

### 1. Infrastructure Verification

```bash
# Step 1: Verify all services running
curl -s http://100.74.135.83:11440/api/tags | jq '.models[] | .name'
# Expected: qwen3.5:0.8b, qwen3.5:2b, qwen3.5:4b, qwen3.5:9b

# Step 2: Check Wayfarer
curl -s http://localhost:8889/health
# Expected: { "status": "healthy" }

# Step 3: Check SearXNG
curl -s http://localhost:8888/ | grep -q "SearXNG"
# Expected: Exit code 0 (found)

# Step 4: Verify dev server starts
cd /Users/mk/Downloads/nomads
npm run build
# Expected: No TypeScript errors, clean build
```

### 2. Test Data Setup

```bash
# Create test campaign
cat > /tmp/test_campaign.json << 'EOF'
{
  "id": "test-campaign-001",
  "name": "NEURO 9.9 Test Campaign",
  "description": "Testing collagen supplement ads for women 35-55 interested in natural health",
  "industry": "supplements",
  "targetAudience": "Women 35-55, health-conscious, e-commerce shoppers",
  "budget": 5000,
  "duration": 30
}
EOF

# Load test campaign
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d @/tmp/test_campaign.json
```

### 3. Baseline Metrics Capture

```typescript
// In browser console, capture baseline
const baseline = {
  timestamp: Date.now(),
  buildTime: 0, // Will fill after build
  tokenCount: 0, // Will fill after first stage
  errorCount: 0,
  stageTimes: {},
};

console.log('BASELINE_START:', baseline);
```

---

## Phase 1: Query Router Testing

**Duration:** ~1 hour
**Risk Level:** Low
**Dependencies:** None

### Test 1.1: Build Verification

**Steps:**
```bash
cd /Users/mk/Downloads/nomads

# Clean build
npm run clean
npm run build

# Check output
echo "Build result: $?"
ls -lh dist/ | head
```

**Expected Results:**
```
✓ Build succeeded (exit code 0)
✓ dist/ contains: index.html, js/*, css/*
✓ No TypeScript errors in output
✓ No console warnings
✓ Build time < 60 seconds
```

**Failure Diagnosis:**
```bash
# If build fails:
npm run build 2>&1 | tee /tmp/build.log
# Check: Type errors, import issues, syntax errors
# Common fixes:
# - Missing imports: Check Phase 1 imports in researchAgents.ts
# - Type errors: Verify queryIntegration.ts exists
# - Module resolution: Check tsconfig.json paths
```

### Test 1.2: Feature Flag Verification

**Steps:**
```bash
# Start dev server
npm run dev

# Open http://localhost:5173 in browser
# In DevTools console:
console.log('Query Routing Enabled:', import.meta.env.VITE_QUERY_ROUTING_ENABLED);
console.log('Strategy:', import.meta.env.VITE_QUERY_ROUTING_STRATEGY);
```

**Expected Results:**
```
✓ VITE_QUERY_ROUTING_ENABLED = 'true'
✓ VITE_QUERY_ROUTING_STRATEGY = 'standard'
✓ No undefined values
✓ .env is loaded correctly
```

**Failure Diagnosis:**
```bash
# Check .env file
cat .env | grep QUERY_ROUTING
# Should show both variables

# Verify Vite config picks up env
grep QUERY_ROUTING vite.config.ts
```

### Test 1.3: Query Generation

**Steps:**
1. Load test campaign
2. Navigate to Campaign Dashboard
3. Click "Start Research" → Select "NR" (Normal) depth
4. Watch console for Phase 1 logs
5. Monitor token count

**Expected Output:**
```
✓ [PHASE_1] Deploying advanced query routing...
✓ [METRICS] Queries: 5, Coverage: 45%, Token Savings: 60%
✓ Research stage completes with ~1,500 tokens
✓ No errors in console
✓ 5 queries visible in activity log
```

**Failure Diagnosis:**
```typescript
// In console:
// Check 1: Is orchestratorWithRouting being called?
console.log('Checking Phase 1 routing...');

// Check 2: Are queries being generated?
// Look for: "Query #1:", "Query #2:", etc. in output

// Check 3: Is token reduction happening?
// Token count should be ~60% of baseline

// Common issues:
// - queryGenerator.ts not found → Import error
// - orchestrator fallback triggered → Wrong model assigned
// - Token count not reduced → Feature flag off or orchestrator not using routing
```

### Test 1.4: Coverage Metrics

**Steps:**
```typescript
// After research completes:
// Check cycle data structure
const cycle = campaign.cycles[0];
console.log('Research stage output:');
console.log(cycle.stages.research.agentOutput);

// Parse metrics
const output = cycle.stages.research.agentOutput;
const metricsMatch = output.match(/\[METRICS\](.*)/);
if (metricsMatch) {
  console.log('Coverage:', metricsMatch[1]);
}
```

**Expected Results:**
```
✓ Metrics section appears in output
✓ Coverage percentage 40-60%
✓ Token savings shown as 60%
✓ Queries enumerated (1-5)
✓ URL count displayed
```

**Failure Diagnosis:**
```typescript
// If metrics not appearing:
// Check 1: Is onChunk being called?
console.log(typeof onChunk); // Should be 'function'

// Check 2: Are tokens being counted?
// Research output should contain token count

// Check 3: Is coverage being calculated?
// Look for "coverage" in research output
```

### Test 1.5: Parallel Researcher Execution

**Steps:**
```typescript
// Monitor execution flow
// During research, in console:
const researchOutput = cycle.stages.research.agentOutput;

// Extract researcher logs
const researchers = researchOutput.match(/researcher-\d+/g) || [];
console.log('Researchers executed:', researchers.length);
console.log('Expected: 5 for standard routing, 15 for extended');
```

**Expected Results:**
```
✓ 5 researchers deployed (standard) or 15 (extended)
✓ Parallel execution (time < sequential)
✓ All researchers complete successfully
✓ No duplicate URL results
✓ Coverage > 40%
```

**Failure Diagnosis:**
```
If < 5 researchers:
- Check queryRouter.ts configuration
- Verify parallelization in executeRound()
- Check model tier (affects researcher count)

If duplicate URLs:
- Check deduplication logic in queryRouter.ts
- Verify semantic dedup enabled
```

### Phase 1 Test Summary

**Checklist:**
- [ ] Build compiles cleanly
- [ ] Feature flags set correctly
- [ ] Query generation triggered
- [ ] 5 queries generated
- [ ] Parallel routing active
- [ ] Coverage metrics > 40%
- [ ] Token savings 60%
- [ ] No console errors

**Pass Threshold:** 6/8 checks passed → Phase 1 PASSED

---

## Phase 2: Context Compression Testing

**Duration:** ~1.5 hours
**Risk Level:** Low-Medium
**Dependencies:** Phase 1 completed

### Test 2.1: Compression Algorithm

**Steps:**
```typescript
// Test compression directly
import { compressResearchFindings } from './utils/semanticContextCompression';

// Create sample research findings
const sampleResearch = {
  customerInsights: {
    summary: 'Sample customer insights about collagen supplements...' // 500+ chars
  },
  objections: [
    { statement: 'Too expensive' },
    { statement: 'Doesn\'t work fast enough' }
  ],
  // ... more fields
};

// Compress it
const result = await compressResearchFindings(
  sampleResearch,
  1000, // 1000 token target
  (text) => console.log('Chunk:', text)
);

console.log('Compression Result:');
console.log('Original:', result.originalTokens, 'tokens');
console.log('Compressed:', result.compressedTokens, 'tokens');
console.log('Ratio:', result.compressionRatio.toFixed(2));
console.log('Semantic Preservation:', result.semanticPreservation.toFixed(2));
```

**Expected Results:**
```
✓ Original tokens: 400-600
✓ Compressed tokens: 240-360 (40% reduction)
✓ Compression ratio: ~0.4
✓ Semantic preservation: 0.75-0.95
✓ Compression time: < 30 seconds
✓ No model errors
```

**Failure Diagnosis:**
```
If compression fails:
- Check qwen3.5:2b is loaded
- Verify ollamaService.generateStream works
- Check prompt formatting

If ratio poor (< 30%):
- Increase compression target
- Adjust summarization prompt
- Use faster model (qwen3.5:0.8b)

If semantic preservation < 0.7:
- Adjust compression target upward
- Check semantic scorer prompt
- Validate input research quality
```

### Test 2.2: Context Tiering

**Steps:**
```typescript
import { tierContext } from './utils/semanticContextCompression';

// Test tiering with different model tiers
const tiers = ['light', 'standard', 'quality', 'maximum'] as const;

for (const tier of tiers) {
  const tiered = tierContext(sampleResearch, tier);
  console.log(`${tier}:`, {
    mustHave: tiered.mustHave.length,
    niceToHave: tiered.niceToHave.length,
    archived: tiered.archived.length,
    estimatedTokens: tiered.metadata.estimatedTokens,
  });
}
```

**Expected Results:**
```
✓ light: ~150 tokens (must-have only)
✓ standard: ~300 tokens (must-have + 50% nice)
✓ quality: ~450 tokens (must-have + 100% nice)
✓ maximum: ~600 tokens (all tiers)
✓ Tiers escalate in size
✓ All items non-empty
```

**Failure Diagnosis:**
```
If tier sizes off:
- Check tierContext logic
- Verify estimateTokens function
- Check model tier mapping

If items missing:
- Verify research findings structure
- Check tier selection logic
- Ensure fallback items exist
```

### Test 2.3: Research-to-Make Bridge

**Steps:**
1. Complete research stage
2. Monitor brand-dna stage execution
3. Check if context bridge is applied

**In Console During Brand-DNA Stage:**
```typescript
// Check bridge logs
console.log('Looking for:', '[PHASE_2] Applying research context bridge...');

// Verify bridged context is used
const brandDnaOutput = cycle.stages['brand-dna'].agentOutput;
console.log('Brand-DNA output length:', brandDnaOutput.length);
console.log('Contains research context:', brandDnaOutput.includes('Research Context Bridge'));
```

**Expected Results:**
```
✓ [PHASE_2] Applying research context bridge...
✓ [PHASE_2] Context bridge applied (XXXX tokens, compressed)
✓ Brand-DNA stage completes normally
✓ Output quality > 85/100
✓ Token count reduced 30-40%
```

**Failure Diagnosis:**
```
If bridge not applying:
- Check PHASE2_COMPRESSION_ENABLED flag
- Verify bridgeResearchContext call in runStage
- Check previous stage status (must be 'completed')

If context not in output:
- Verify systemPromptWithContext is used in generateStream
- Check bridge context format
- Validate bridge context injection point
```

### Test 2.4: Inter-Stage Context Verification

**Steps:**
```typescript
// After Make stage completes:
const makeOutput = cycle.stages.production.agentOutput;

// Verify it contains research-derived context
const hasDesireAlignment = makeOutput.includes('desire') || makeOutput.includes('Desire');
const hasObjections = makeOutput.includes('objection') || makeOutput.includes('Objection');

console.log('Make stage context quality:');
console.log('- Contains desire alignment:', hasDesireAlignment);
console.log('- Addresses objections:', hasObjections);

// After Test stage:
const testOutput = cycle.stages.test.agentOutput;
const hasScoring = /\d{2,3}\/100/.test(testOutput);
console.log('Test stage context quality:');
console.log('- Scoring present:', hasScoring);
```

**Expected Results:**
```
✓ Make stage output contains desire/objection references
✓ Test stage output contains concept scores
✓ Scoring format: "XX/100"
✓ All stages receive proper context
✓ No missing context warnings
```

**Failure Diagnosis:**
```
If context not flowing:
- Check bridgeToMakeStage function
- Verify buildResearchToMakeBridge output
- Check test stage bridge construction

If scoring wrong format:
- Check ConceptScore interface
- Verify parsing logic in advancedTestStage
- Check format in scoring prompts
```

### Test 2.5: Audit Trail

**Steps:**
```typescript
// Check audit trail in cycle
const auditTrail = cycle.stages['research'].artifacts || [];
console.log('Audit trail entries:', auditTrail.length);

// Each entry should have:
// - timestamp
// - tokens (original + compressed)
// - compression ratio
// - semantic preservation score
auditTrail.forEach((entry, idx) => {
  console.log(`Entry ${idx}:`, {
    timestamp: entry.metadata?.timestamp,
    tokens: entry.metadata?.tokens,
    ratio: entry.metadata?.compressionRatio,
  });
});
```

**Expected Results:**
```
✓ Audit trail entry created per stage
✓ Timestamps recorded
✓ Token counts logged
✓ Compression ratios present
✓ Semantic scores logged
✓ No missing metadata
```

**Failure Diagnosis:**
```
If audit trail empty:
- Check includeAuditTrail in BRIDGE_CONFIG
- Verify artifact creation in bridgeResearchContext
- Check cycle.stages artifact property

If metadata missing:
- Verify bridge return structure
- Check timestamp generation
- Validate token counting
```

### Phase 2 Test Summary

**Checklist:**
- [ ] Compression reduces tokens 40%
- [ ] Semantic preservation > 0.75
- [ ] Context tiers properly sized
- [ ] Research-to-Make bridge works
- [ ] Inter-stage context flows
- [ ] Audit trail complete
- [ ] No compression errors
- [ ] Token reduction verified

**Pass Threshold:** 6/8 checks passed → Phase 2 PASSED

---

## Phase 3: Advanced Make/Test Testing

**Duration:** ~1 hour
**Risk Level:** Medium
**Dependencies:** Phase 1 & 2 completed

### Test 3.1: Multi-Concept Generation

**Steps:**
```typescript
// After production stage completes:
const concepts = cycle.stages.production.artifacts || [];

console.log('Concepts generated:', concepts.length);
console.log('Expected: 3');

concepts.forEach((concept, idx) => {
  const data = JSON.parse(concept.content);
  console.log(`Concept ${idx + 1}:`, {
    title: data.title,
    format: data.format,
    desireAngle: data.desireAngle?.substring(0, 50) + '...',
    estimatedCTR: data.estimatedCTR,
  });
});
```

**Expected Results:**
```
✓ 3 concepts generated
✓ Each has: title, format, desireAngle, objectionHandling, etc.
✓ Formats: 'text', 'html', or 'interactive'
✓ CTR estimates 0-100
✓ All fields populated (no null/undefined)
✓ Output unique (not duplicates)
✓ Generation time < 2 minutes
```

**Failure Diagnosis:**
```
If < 3 concepts:
- Check generateAdConcepts function
- Verify parseConceptsFromOutput logic
- Check Make prompt formatting

If missing fields:
- Verify AdConcept interface
- Check parsing regex in parseMakeConcepts
- Validate model output format

If duplicates:
- Check concept generation seed/randomness
- Verify model temperature settings
- Check prompt diversity requirements
```

### Test 3.2: Concept Artifact Storage

**Steps:**
```typescript
// Verify artifacts stored correctly
const artifacts = cycle.stages.production.artifacts;

artifacts.forEach((artifact, idx) => {
  console.log(`Artifact ${idx + 1}:`, {
    id: artifact.id,
    type: artifact.type,
    hasContent: !!artifact.content,
    hasMetadata: !!artifact.metadata,
    format: artifact.metadata?.format,
  });

  // Try to parse content
  try {
    const parsed = JSON.parse(artifact.content);
    console.log('✓ Content is valid JSON');
  } catch {
    console.log('✗ Content is NOT valid JSON');
  }
});
```

**Expected Results:**
```
✓ 3 artifacts created (one per concept)
✓ id: "concept-1", "concept-2", "concept-3"
✓ type: "ad_concept"
✓ content: valid JSON
✓ metadata: { title, format, estimatedCTR, generatedAt }
✓ All artifacts queryable from cycle data
```

**Failure Diagnosis:**
```
If artifacts missing:
- Check artifact creation in production stage
- Verify cycle.stages.production.artifacts assignment
- Check artifact push/concat logic

If content not JSON:
- Verify JSON.stringify in formatMakeOutput
- Check concept data structure
- Validate artifact content assignment
```

### Test 3.3: Multi-Dimension Concept Scoring

**Steps:**
```typescript
// After test stage completes:
const evaluations = cycle.stages.test.artifacts || [];

console.log('Evaluations:', evaluations.length);
console.log('Expected: 3+ (one per concept)');

evaluations.forEach((eval, idx) => {
  const score = JSON.parse(eval.content);
  console.log(`Evaluation ${idx + 1}:`, {
    conceptId: score.conceptId,
    desireAlignment: score.desireAlignment,
    objectionHandling: score.objectionHandling,
    competitiveUniqueness: score.competitiveUniqueness,
    audienceFit: score.audienceFit,
    overallScore: score.overallScore,
  });

  // Verify all dimensions scored
  const dimensions = [
    score.desireAlignment,
    score.objectionHandling,
    score.competitiveUniqueness,
    score.audienceFit,
  ];

  const allScored = dimensions.every(d => typeof d === 'number' && d >= 0 && d <= 100);
  console.log(`All dimensions scored 0-100: ${allScored ? '✓' : '✗'}`);
});
```

**Expected Results:**
```
✓ 3+ evaluations created
✓ Each has all 4 dimensions scored
✓ Scores 0-100 inclusive
✓ Overall score = average of 4 dimensions
✓ Reasoning > 50 characters
✓ Strengths array not empty
✓ Weaknesses array not empty
✓ Recommendations array not empty
```

**Failure Diagnosis:**
```
If dimensions not scored:
- Check scoreConcept function
- Verify parseConceptScore logic
- Check evaluation prompt format

If scores out of range:
- Validate scoring prompt (0-100)
- Check score parsing regex
- Verify JSON output format

If no reasoning/strengths:
- Check prompt includes these fields
- Verify array parsing in parseConceptScore
- Check fallback values
```

### Test 3.4: Winner Selection

**Steps:**
```typescript
// Check winner selection
const testOutput = cycle.stages.test.agentOutput;

// Look for winner indication
const winnerMatch = testOutput.match(/[Ww]inner[^:]*:\s*(\w+)/);
const winnerScore = testOutput.match(/\d{2,3}\/100/);

console.log('Winner result:');
console.log('Winner mentioned:', !!winnerMatch);
console.log('Winner ID:', winnerMatch?.[1]);
console.log('Winner score:', winnerScore?.[0]);

// Verify winner has highest score
const evaluations = cycle.stages.test.artifacts;
const highestScore = Math.max(...evaluations.map(e =>
  JSON.parse(e.content).overallScore
));
console.log('Highest overall score:', highestScore);
```

**Expected Results:**
```
✓ Winner clearly identified in output
✓ Winner ID matches concept name
✓ Winner score displayed (XX/100)
✓ Winner has highest overall score
✓ Winner selection deterministic
✓ No ties (all scores unique or breaking rule applied)
```

**Failure Diagnosis:**
```
If winner not identified:
- Check generateTestInsights function
- Verify winner extraction in formatTestOutput
- Check test output formatting

If wrong winner:
- Verify scoring is correct
- Check comparison logic
- Validate dimension weighting (all equal 0.25)

If ties:
- Check score precision (decimals vs integers)
- Verify tie-breaking logic
- Check for rounding errors
```

### Test 3.5: Insights Generation

**Steps:**
```typescript
// Check insights quality
const testOutput = cycle.stages.test.agentOutput;

// Extract insights section
const insightsMatch = testOutput.match(/[Ii]nsights\s*[^a-zA-Z]*\n([\s\S]*?)(?=\n[A-Z]|$)/);
const insights = insightsMatch?.[1] || '';

console.log('Insights:', insights.substring(0, 200) + '...');
console.log('Insights length:', insights.length, 'chars');
console.log('Insights present:', insights.length > 100 ? '✓' : '✗');

// Check for key analysis elements
const hasPatterns = insights.includes('pattern') || insights.includes('Pattern');
const hasStrengths = insights.includes('strength') || insights.includes('Strength');
const hasRecommendation = insights.includes('recommend') || insights.includes('Recommend');

console.log('Contains pattern analysis:', hasPatterns ? '✓' : '✗');
console.log('Discusses strengths:', hasStrengths ? '✓' : '✗');
console.log('Provides recommendations:', hasRecommendation ? '✓' : '✗');
```

**Expected Results:**
```
✓ Insights section present
✓ Insights > 200 characters
✓ Discusses patterns across concepts
✓ Identifies winner strengths
✓ Notes weaknesses in runner-ups
✓ Provides next-step recommendations
✓ Actionable and specific
```

**Failure Diagnosis:**
```
If insights missing:
- Check generateTestInsights call
- Verify insights are streamed to output
- Check formatTestOutput includes insights section

If insights generic:
- Verify evaluation data is detailed
- Check prompt asks for specific analysis
- Validate model tier (should be 9b+)

If insights too short:
- Increase prompt context
- Add more specific prompts
- Validate streaming capture
```

### Phase 3 Test Summary

**Checklist:**
- [ ] 3 concepts generated
- [ ] Concepts have all required fields
- [ ] Artifacts properly stored as JSON
- [ ] 3+ evaluations created
- [ ] All 4 dimensions scored 0-100
- [ ] Winner correctly selected
- [ ] Insights generated (>200 chars)
- [ ] No scoring errors

**Pass Threshold:** 6/8 checks passed → Phase 3 PASSED

---

## Phase 4: Infrastructure Hardening Testing

**Duration:** ~1.5 hours
**Risk Level:** Low-Medium
**Dependencies:** All previous phases

### Test 4.1: Timeout Enforcement

**Steps:**
```bash
# Temporarily set aggressive timeout for testing
# Edit src/utils/stageTimeouts.ts:
# STAGE_TIMEOUTS['research'] = 5000 // 5 seconds instead of 10min

# Run research stage
# Monitor console for timeout
```

**In Console:**
```typescript
// Should see timeout messages:
// "[TIMEOUT] research exceeded 5000ms limit"
// "[RECOVERY] Attempting graceful degradation..."
```

**Expected Results:**
```
✓ Timeout triggered after specified duration
✓ Timeout message logged with stage name
✓ Recovery strategy applied
✓ Stage doesn't crash (graceful failure)
✓ Can retry or continue to next stage
✓ Error is recoverable (not fatal)
```

**Failure Diagnosis:**
```
If timeout doesn't trigger:
- Check withTimeout wrapper is used
- Verify STAGE_TIMEOUTS has research entry
- Check timeout value (in ms)
- Verify AbortSignal is being respected

If crash instead of graceful degradation:
- Check error handling in catch block
- Verify getGracefulDegradationStrategy exists
- Check degradation strategy is appropriate

If timeout too aggressive:
- Increase STAGE_TIMEOUTS value
- Check network conditions
- Verify model load times
```

### Test 4.2: Watchdog Monitoring

**Steps:**
```typescript
// Check watchdog is initialized
console.log('Watchdog status:', watchdog?.isMonitoring);

// Wait 30 seconds and check logs
setTimeout(() => {
  console.log('Watchdog heartbeat:', watchdog?.getLastHeartbeat());
}, 30000);

// Monitor for watchdog logs
// Should see periodic: "[WATCHDOG] Monitoring research stage..."
```

**Expected Results:**
```
✓ Watchdog initialized at cycle start
✓ Watchdog starts monitoring
✓ Periodic heartbeat logs appear
✓ Watchdog detects stage changes
✓ Recovery triggered if needed
✓ Watchdog stops cleanly on cycle end
```

**Failure Diagnosis:**
```
If watchdog not initialized:
- Check ResearchWatchdog import
- Verify watchdog = new ResearchWatchdog() in useCycleLoop
- Check startMonitoring() called

If no heartbeat logs:
- Verify watchdog has onChunk callback
- Check monitoring interval (should be 5-10s)
- Validate stage name detection

If recovery not triggered:
- Check watchdog recovery condition
- Verify shouldAttemptRecovery logic
- Check recovery strategy available
```

### Test 4.3: Health Monitor Status

**Steps:**
```typescript
// Check health monitor initialized
console.log('Health monitor:', healthMonitor?.isRunning);

// Get current status
const status = healthMonitor.getStatus();
console.log('Health Status:', status);

// Expected output:
// {
//   ollama: 'healthy' | 'degraded' | 'unhealthy',
//   wayfarer: 'healthy' | 'degraded' | 'unhealthy',
//   searxng: 'healthy' | 'degraded' | 'unhealthy',
//   memoryUsage: '245MB',
//   cpuUsage: '35%',
//   lastCheck: 1712073600000,
//   uptime: '2h 15m'
// }

// Check each service
Object.entries(status).forEach(([service, status]) => {
  console.log(`${service}: ${status}`);
});
```

**Expected Results:**
```
✓ Health monitor started
✓ All services report status
✓ Ollama: healthy (or degraded if Ollama restarting)
✓ Wayfarer: healthy
✓ SearXNG: healthy
✓ Memory usage reported
✓ Last check timestamp recent (< 5s old)
✓ Uptime increasing
```

**Failure Diagnosis:**
```
If health monitor not running:
- Check healthMonitor.startMonitoring() called
- Verify interval timer created
- Check useEffect cleanup

If service unhealthy:
- Verify service is actually running
- Check service URL in INFRASTRUCTURE
- Validate health check endpoint
- Try manual curl to service

If metrics not updating:
- Check monitoring interval (should be 5s)
- Verify getStatus() returns fresh data
- Check timestamp generation
```

### Test 4.4: Graceful Degradation

**Steps:**
1. During research stage, manually stop Ollama
2. Monitor error handling and recovery

```bash
# In separate terminal:
docker stop ollama-container
# Wait 10 seconds for timeout to trigger
```

**In Browser Console:**
```typescript
// Should see degradation:
// "[TIMEOUT] research exceeded 600000ms limit"
// "[RECOVERY] Applying fast-generation strategy..."
// "[RECOVERY] Using qwen3.5:0.8b for speed..."

// Alternative degradation strategies:
// - fast-generation: use smaller model
// - skip-validation: skip validation steps
// - use-cache: return cached results
// - manual-intervention: pause and wait
```

**Expected Results:**
```
✓ Timeout detected
✓ Degradation strategy selected
✓ Strategy applied (model switch, cache use, etc.)
✓ Cycle continues with degraded results
✓ Logs show strategy: "[RECOVERY] Applying X strategy..."
✓ Error is recoverable
```

**Failure Diagnosis:**
```
If degradation not triggered:
- Check timeout enforcement (Test 4.1)
- Verify getGracefulDegradationStrategy logic
- Check strategy mapping exists

If wrong strategy selected:
- Verify strategy rules in getGracefulDegradationStrategy
- Check stage-specific strategies configured
- Validate fallback strategy

If degradation crashes:
- Check strategy implementation
- Verify fallback model exists
- Check cache lookup logic
```

### Test 4.5: Recovery & Restart

**Steps:**
```bash
# After Ollama was stopped (Test 4.4):
# Restart Ollama
docker start ollama-container

# Wait for reconnection
# Monitor logs for recovery attempts
```

**In Console:**
```typescript
// Should see:
// "[RECOVERY] Ollama reconnection attempt 1/3..."
// "[RECOVERY] Checking Ollama health..."
// "[RECOVERY] Ollama reconnected!"
// Or eventually: "[ERROR] Recovery failed, need manual intervention"
```

**Expected Results:**
```
✓ Recovery attempts logged (1/3, 2/3, etc.)
✓ Service health checked
✓ Reconnection successful (or max retries reached)
✓ Cycle resumes after recovery
✓ No data loss during recovery
✓ Recovery time < 30 seconds
```

**Failure Diagnosis:**
```
If no recovery attempts:
- Check watchdog.onTimeout handler
- Verify recovery loop exists
- Check retry count setting

If recovery fails to reconnect:
- Verify service actually restarted
- Check service URL/port correct
- Validate health check endpoint
- Check network connectivity

If data loss:
- Verify cycle checkpoint saved before retry
- Check resume logic after recovery
- Validate state restoration
```

### Phase 4 Test Summary

**Checklist:**
- [ ] Timeouts enforce correctly
- [ ] Watchdog monitors actively
- [ ] Health monitor reports status
- [ ] Graceful degradation triggers
- [ ] Recovery attempts logged
- [ ] Service can reconnect
- [ ] No data loss on recovery
- [ ] Error logs comprehensive

**Pass Threshold:** 6/8 checks passed → Phase 4 PASSED

---

## Phase 5: Benchmark Harness Testing

**Duration:** ~2 hours (includes long-run test)
**Risk Level:** Medium
**Dependencies:** All previous phases

### Test 5.1: Benchmark Launch

**Steps:**
```typescript
// In Dashboard or BenchmarkDashboard:
// Click "Start Q3 Benchmark" button

// Monitor startup
// Expected logs:
// "[BENCHMARK] Initializing Q3 harness..."
// "[BENCHMARK] Config: 3 cycles, 1 hour duration, standard stress"
```

**Expected Results:**
```
✓ Benchmark button appears
✓ Benchmark starts cleanly
✓ Initial logs appear
✓ Progress bar initializes
✓ No startup errors
✓ CPU/memory usage increases gradually
```

**Failure Diagnosis:**
```
If button missing:
- Check BenchmarkDashboard component imported
- Verify component added to Dashboard
- Check component render condition

If benchmark won't start:
- Check runQ3Benchmark function
- Verify config passed correctly
- Check onProgress callback setup

If immediate crash:
- Check mock cycle execution
- Verify try/catch in harness
- Check error logging
```

### Test 5.2: Cycle Execution Monitoring

**Steps:**
```typescript
// Monitor during benchmark execution:
// Expected output every 1-2 minutes:
// "[BENCHMARK] Running cycle 1/3..."
// "[BENCHMARK] Cycle 1 complete (2450ms, 5250 tokens)"
// "[BENCHMARK] Running cycle 2/3..."

// Check console for token counts
// Should see 4000-6000 tokens per cycle
```

**In Browser:**
```typescript
// Monitor progress in real-time
// UI should show:
// Progress bar: 0% → 33% → 66% → 100%
// Current cycle: 1/3 → 2/3 → 3/3
// Estimated time: 60 min → 40 min → 20 min → Complete
```

**Expected Results:**
```
✓ Cycles execute sequentially
✓ Each cycle 2-3 minutes
✓ Token counts 4000-6000 per cycle
✓ No errors during execution
✓ Progress updates every cycle
✓ CPU/memory stable (no unbounded growth)
✓ All stages execute per cycle
```

**Failure Diagnosis:**
```
If cycle takes too long:
- Check mock delay times in runBenchmarkCycle
- Verify actual service calls not made (should be mocked)
- Check for bottleneck stages

If token count way off:
- Verify mock token generation in cycle
- Check calculation formula
- Validate estimation logic

If progress not updating:
- Check onProgress callback is called
- Verify progress calculation
- Check UI state updates
```

### Test 5.3: Quality Metrics

**Steps:**
```typescript
// After benchmark completes:
const result = benchmarkResult;

console.log('Quality Metrics:');
console.log('Total cycles:', result.totalCycles);
console.log('Quality score:', result.qualityScore);
console.log('Stability score:', result.stabilityScore);
console.log('Avg time/cycle:', result.averageTimePerCycle);
console.log('Total tokens:', result.tokenCount);
console.log('Avg tokens/cycle:', result.averageTokensPerCycle);

// Check thresholds
const qualityOK = result.qualityScore > 85;
const stabilityOK = result.stabilityScore > 95;
const noErrors = result.errors.length < 2;

console.log('Quality OK (>85):', qualityOK ? '✓' : '✗');
console.log('Stability OK (>95):', stabilityOK ? '✓' : '✗');
console.log('Error rate OK (<2 errors):', noErrors ? '✓' : '✗');
```

**Expected Results:**
```
✓ Quality score 80-95/100
✓ Stability score 95-100/100
✓ < 2 errors in 3 cycles
✓ Avg time per cycle 2-3 min
✓ Avg tokens per cycle 4000-6000
✓ Memory peak < 350MB
✓ No unbounded growth
```

**Failure Diagnosis:**
```
If quality score low (<80):
- Check concept generation quality
- Verify Make stage output
- Check semantic preservation

If stability score low (<95):
- Count actual errors
- Review error logs
- Check recovery mechanism

If memory usage high (>350MB):
- Check for memory leaks
- Verify artifact cleanup
- Monitor ResearchWatchdog memory
- Check IndexedDB size
```

### Test 5.4: Error Handling

**Steps:**
```typescript
// After benchmark:
const result = benchmarkResult;

console.log('Errors during benchmark:');
result.errors.forEach((error, idx) => {
  console.log(`Error ${idx + 1}:`, {
    timestamp: new Date(error.timestamp).toISOString(),
    stage: error.stage,
    error: error.error.substring(0, 100),
    recovered: error.recovered ? '✓' : '✗',
  });
});

// Verify all errors recovered
const allRecovered = result.errors.every(e => e.recovered);
console.log('All errors recovered:', allRecovered ? '✓' : '✗');
```

**Expected Results:**
```
✓ Error count 0-2 per 3 cycles
✓ Each error has timestamp
✓ Each error has stage name
✓ Error message is descriptive
✓ All errors marked as recovered
✓ Cycle continued after error
✓ Error details in report
```

**Failure Diagnosis:**
```
If errors not logged:
- Check BenchmarkError structure
- Verify error catching in runBenchmarkCycle
- Check errors array populated

If errors not marked recovered:
- Check error.recovered flag
- Verify recovery attempted
- Check cycle continuation

If too many errors:
- Investigate error patterns
- Check service stability
- Verify mock/real execution

If errors disappear:
- Verify error handling doesn't swallow errors
- Check try/catch scope
- Validate error collection
```

### Test 5.5: Report Generation

**Steps:**
```typescript
// Check report format
const report = benchmarkResult.report;

console.log('Report length:', report.length);
console.log('Report preview:', report.substring(0, 200));

// Check required sections
const sections = {
  'Execution Summary': report.includes('Execution Summary'),
  'Quality Metrics': report.includes('Quality Metrics'),
  'Issues Encountered': report.includes('Issues Encountered'),
  'Conclusion': report.includes('Conclusion'),
};

Object.entries(sections).forEach(([section, present]) => {
  console.log(`${section}: ${present ? '✓' : '✗'}`);
});

// Check data in report
const cycleMatch = report.match(/Cycles Completed: (\d+)/);
const qualityMatch = report.match(/Quality Score: (\d+)/);
const conclusionMatch = report.match(/PASSED|REVIEW NEEDED/);

console.log('Cycles in report:', cycleMatch?.[1]);
console.log('Quality in report:', qualityMatch?.[1]);
console.log('Conclusion stated:', conclusionMatch?.[0]);
```

**Expected Results:**
```
✓ Report > 500 characters
✓ All sections present
✓ Metrics match result object
✓ Cycles: 3
✓ Quality Score: value from result
✓ Stability Score: value from result
✓ Error list comprehensive
✓ Conclusion clear (PASSED or REVIEW NEEDED)
✓ Report is human-readable
```

**Failure Diagnosis:**
```
If sections missing:
- Check generateBenchmarkReport function
- Verify all sections in template
- Check formatting

If metrics wrong:
- Check report calculation
- Verify result object values
- Check data type conversions

If conclusion wrong:
- Check threshold logic (quality > 90 && stability > 95)
- Verify OR condition if needed
- Check logic branches

If report truncated:
- Check string concatenation
- Verify no max length limit
- Check encoding issues
```

### Test 5.6: Long-Run Stability (Optional)

**Steps:**
```bash
# Edit benchmark config for longer run:
# runDuration: 14400000, // 4 hours
# cycleTarget: 8,

# Start benchmark
# Monitor for 4 hours
# Check memory doesn't grow unbounded
```

**In Console (every 30 min):**
```typescript
// Check memory
console.log('Memory usage:', performance.memory);
// Should stay relatively stable after first cycle

// Check cycle times
// Should be consistent ±10%

// Check token counts
// Should be consistent ±5%
```

**Expected Results:**
```
✓ All 8 cycles complete
✓ Memory stabilizes after cycle 1-2
✓ No memory leak (growth < 50MB total)
✓ Cycle times consistent within 10%
✓ Token counts consistent within 5%
✓ < 5 errors total across 8 cycles
✓ Quality/stability scores maintained
✓ Full report generated
```

**Failure Diagnosis:**
```
If memory grows unbounded:
- Check artifact cleanup
- Verify cycle completion cleanup
- Monitor ResearchWatchdog memory

If cycle times degrade:
- Check model performance
- Monitor CPU usage
- Verify no accumulation of pending tasks

If token counts vary:
- Check for non-determinism
- Verify model seeding
- Check random query generation

If errors accumulate:
- Check for cascading failures
- Verify error recovery
- Monitor service health
```

### Phase 5 Test Summary

**Checklist:**
- [ ] Benchmark launches cleanly
- [ ] All 3 cycles execute
- [ ] Quality score > 85/100
- [ ] Stability score > 95/100
- [ ] < 2 errors total
- [ ] Memory stable (no leaks)
- [ ] Report comprehensive
- [ ] Conclusion accurate

**Pass Threshold:** 6/8 checks passed → Phase 5 PASSED

---

## Cross-Phase Integration Testing

**Duration:** ~2 hours
**Risk Level:** Medium
**Dependencies:** All phases 1-5 passed individually

### Test I.1: Full Cycle with All Phases

**Steps:**
```bash
# Verify all phase flags enabled
grep -E "PHASE[1-5]" /Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts

# Start fresh campaign
# Run full cycle: research → production → test

# Monitor console for all phase markers
```

**Expected Output (in order):**
```
[PHASE_1] Deploying advanced query routing...
[METRICS] Queries: 5, Coverage: 45%, Token Savings: 60%
[PHASE_2] Applying research context bridge...
[PHASE_2] Context bridge applied (XXXX tokens, compressed)
[PHASE_3] Launching advanced Make stage...
3 concepts generated and stored as artifacts
[PHASE_3] Launching advanced Test stage...
Evaluation complete. Winner: concept-X (85/100)
[PHASE_4] Infrastructure hardening active
[PHASE_4] All stages wrapped with timeout protection
```

**Expected Results:**
```
✓ All phases activate in sequence
✓ No missing phase logs
✓ All stage completions logged
✓ No console errors
✓ Cycle completes successfully
✓ All artifacts stored
✓ Report comprehensive
✓ Timing < 45 minutes
```

**Failure Diagnosis:**
```
If a phase doesn't activate:
- Check feature flag enabled
- Verify imports added
- Check integration point code

If phase partially executes:
- Check error handling
- Verify fallback logic
- Check abort signal usage

If cycle hangs:
- Check timeout values (Phase 4)
- Monitor network connectivity
- Check model availability

If artifacts missing:
- Verify all phases store artifacts
- Check artifact creation logic
- Check cycle data structure
```

### Test I.2: Score Progression

**Steps:**
```typescript
// After full cycle:
// Calculate quality progression

const metrics = {
  phase1: {
    tokenReduction: 0.60, // 60%
  },
  phase2: {
    compressionRatio: 0.40, // 40%
    semanticPreservation: 0.85, // 85%
  },
  phase3: {
    conceptCount: 3,
    scoringDimensions: 4,
    winnerScore: 85,
  },
  phase4: {
    timeoutRecovery: 'working',
    healthMonitor: 'active',
  },
  phase5: {
    qualityScore: 92,
    stabilityScore: 98,
  },
};

console.log('Metrics Summary:', JSON.stringify(metrics, null, 2));

// Expected progression:
// 9.1 → 9.2 → 9.5 → 9.7 → 9.8 → 9.9
```

**Expected Results:**
```
✓ Token reduction 60%
✓ Compression ratio 40%
✓ Semantic preservation 0.85+
✓ 3 concepts scored on 4 dimensions
✓ Winner score 80+/100
✓ Timeout recovery working
✓ Health monitor active
✓ Quality 90+/100
✓ Stability 95+/100
```

**Failure Diagnosis:**
```
If metrics lower than expected:
- Check each phase implementation
- Verify feature flags all enabled
- Check integration points

If metrics inconsistent:
- Run multiple cycles
- Check for variability
- Verify model seeding

If quality doesn't reach 9.9:
- Review each phase contribution
- Check threshold calculations
- Validate scoring logic
```

### Test I.3: Rollback Testing

**Steps:**
```bash
# Test rollback of one phase (e.g., Phase 1)
git checkout src/utils/researchAgents.ts

# Rebuild and verify
npm run build

# Run cycle
# Should work without Phase 1 features

# Reapply Phase 1
git checkout HEAD -- src/utils/researchAgents.ts
npm run build

# Verify Phase 1 features return
```

**Expected Results:**
```
✓ Rollback succeeds
✓ Build completes cleanly
✓ App runs without rolled-back phase
✓ Reapply succeeds
✓ Features return when reapplied
✓ No side effects from rollback
```

**Failure Diagnosis:**
```
If rollback fails:
- Check for phase dependencies
- Verify imports are optional
- Check feature flags guard code

If app crashes after rollback:
- Check for hard dependencies
- Verify fallback logic works
- Check try/catch scope
```

---

## Summary & Sign-Off

### Test Coverage
- **Phase 1:** 5 tests, 6 checkpoints
- **Phase 2:** 5 tests, 6 checkpoints
- **Phase 3:** 5 tests, 8 checkpoints
- **Phase 4:** 5 tests, 8 checkpoints
- **Phase 5:** 6 tests, 8 checkpoints
- **Integration:** 3 cross-phase tests
- **Total:** 29 tests, 60+ checkpoints

### Pass Criteria
- **Per Phase:** 6/8 checks must pass
- **Integration:** All 3 cross-phase tests pass
- **Overall:** 50/60+ checkpoints pass
- **Quality:** Final score ≥ 9.8/10

### Sign-Off Template

```
VALIDATION COMPLETE ✓

Phase 1: [PASS] | [FAIL]
Phase 2: [PASS] | [FAIL]
Phase 3: [PASS] | [FAIL]
Phase 4: [PASS] | [FAIL]
Phase 5: [PASS] | [FAIL]
Integration: [PASS] | [FAIL]

Final Quality Score: 9.X / 10.0
Approved by: _________________
Date: ________________________
```

---

**Comprehensive validation plan ready for implementation. Estimated total test time: 20+ hours.**
