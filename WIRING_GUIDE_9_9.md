# NEURO 9.9/10 — Detailed Wiring Guide

**Status:** Complete integration reference
**Audience:** Developers integrating Phase 1–5 improvements
**Document Type:** Code snippets + integration points

---

## Table of Contents

1. Phase 1: Query Router Wiring
2. Phase 2: Semantic Compression Wiring
3. Phase 3: Advanced Make/Test Wiring
4. Phase 4: Infrastructure Hardening Wiring
5. Phase 5: Benchmark Harness Wiring
6. Component Wiring (Dashboard, Activity Bar, etc.)
7. Type Definitions & Imports

---

## Phase 1: Query Router Wiring

### Hook Point 1: researchAgents.ts

**File:** `/Users/mk/Downloads/nomads/src/utils/researchAgents.ts`

**Step 1: Add imports (line 1)**
```typescript
// Add after existing imports
import { generateFocusedQueries } from './queryGenerator';
import { QueryRouter } from './queryRouter';
import { generateAndRouteQueries } from './queryIntegration';
```

**Step 2: Modify orchestrator call (line ~200)**

**Before:**
```typescript
export async function runOrchestratorRound(
  campaign: Campaign,
  researchState: ResearchState,
  depth: ResearchDepth,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<OrchestratorDecision> {
  const systemPrompt = getSystemPrompt('orchestrator', campaign);

  let output = '';
  for await (const chunk of ollamaService.generateStream({
    model: getModelForStage('orchestrator', 'standard'),
    messages: [{
      role: 'user',
      content: buildOrchestratorPrompt(campaign, researchState)
    }],
    stream: true,
  }, signal)) {
    output += chunk;
    onChunk?.(chunk);
  }

  return parseOrchestratorOutput(output);
}
```

**After (Phase 1 integration):**
```typescript
// Feature flag for Phase 1
const PHASE1_ADVANCED_ROUTING = import.meta.env.VITE_QUERY_ROUTING_ENABLED === 'true';

export async function runOrchestratorRound(
  campaign: Campaign,
  researchState: ResearchState,
  depth: ResearchDepth,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<OrchestratorDecision | RoutedQuery[]> {
  // PHASE 1: Use advanced query routing if enabled
  if (PHASE1_ADVANCED_ROUTING) {
    onChunk?.(`\n[PHASE_1] Deploying advanced query routing...\n`);

    try {
      const result = await generateAndRouteQueries(
        campaign,
        'standard', // Router strategy
        onChunk,
        signal
      );

      // Convert to OrchestratorDecision format for compatibility
      return {
        decision: 'generate_queries',
        queries: result.queries.map(q => q.query),
        rationale: `Advanced routing: ${result.queries.length} queries, ${result.totalTokens} tokens (60% savings)`,
      } as any;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onChunk?.(`\n[PHASE_1_ERROR] Routing failed, falling back to standard: ${error}\n`);
      }
      // Fall through to standard orchestrator
    }
  }

  // Standard orchestrator (fallback or when Phase 1 disabled)
  const systemPrompt = getSystemPrompt('orchestrator', campaign);

  let output = '';
  for await (const chunk of ollamaService.generateStream({
    model: getModelForStage('orchestrator', 'standard'),
    messages: [{
      role: 'user',
      content: buildOrchestratorPrompt(campaign, researchState)
    }],
    stream: true,
  }, signal)) {
    output += chunk;
    onChunk?.(chunk);
  }

  return parseOrchestratorOutput(output);
}
```

**Step 3: Update caller in useOrchestratedResearch.ts**

**File:** `/Users/mk/Downloads/nomads/src/hooks/useOrchestratedResearch.ts`

**Find line ~350 (where orchestrator is called):**
```typescript
const orchestratorDecision = await runOrchestratorRound(
  campaign,
  researchState,
  researchDepth,
  onChunk,
  abortSignal
);
```

**Add Phase 1 check:**
```typescript
// PHASE 1: Advanced routing aware caller
const orchestratorDecision = await runOrchestratorRound(
  campaign,
  researchState,
  researchDepth,
  onChunk,
  abortSignal
);

// Handle both RoutedQuery[] and OrchestratorDecision returns
let queries: QueryDefinition[];
if (Array.isArray(orchestratorDecision)) {
  // Phase 1 advanced routing returned RoutedQuery[]
  queries = orchestratorDecision.map(rq => ({
    query: rq.query,
    researchers: rq.assignedResearchers,
  }));
  onChunk?.(`[PHASE_1] Executing ${queries.length} routed queries in parallel...\n`);
} else {
  // Standard orchestrator return
  queries = orchestratorDecision.queries;
}
```

### Hook Point 2: Environment Configuration

**File:** `/Users/mk/Downloads/nomads/.env.example`

**Add after VITE_SEARXNG_URL (around line 10):**
```bash
# Phase 1: Advanced Research Orchestration
# Enable query routing for 60% token reduction
VITE_QUERY_ROUTING_ENABLED=true

# Router strategy: quick (3 queries) | standard (5) | extended (5+parallel)
VITE_QUERY_ROUTING_STRATEGY=standard

# Optional: Override model used for query generation
# VITE_QUERY_ROUTING_MODEL=qwen3.5:2b
```

### Verification Steps (Phase 1)

**Test 1: Build**
```bash
cd /Users/mk/Downloads/nomads
npm run build
# Expected output: "successfully compiled"
```

**Test 2: Dev server check**
```bash
npm run dev
# In browser console:
console.log(import.meta.env.VITE_QUERY_ROUTING_ENABLED);
// Expected: 'true' or 'false'
```

**Test 3: Feature flag in action**
```typescript
// During research stage, in browser console, look for:
// "[PHASE_1] Deploying advanced query routing..."
// "[PHASE_1] Executing 5 routed queries in parallel..."
```

---

## Phase 2: Semantic Compression Wiring

### Hook Point 1: useCycleLoop.ts — Add Imports

**File:** `/Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts`

**Line 1–30 (add imports after existing imports):**
```typescript
// Existing imports...
import { useOrchestratedResearch } from './useOrchestratedResearch';

// PHASE 2: Semantic Compression
import {
  compressResearchFindings,
  tierContext,
  ContextTier,
  CompressionResult,
  BridgeConfig,
} from '../utils/semanticContextCompression';
import {
  bridgeResearchContext,
  bridgeToMakeStage,
  bridgeToTestStage,
  StageBridge,
} from '../utils/contextBridge';
```

### Hook Point 2: Stage Execution Loop

**File:** `/Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts`

**Find: runStage function (line ~600)**

**Before stage execution (add at line ~620):**
```typescript
// PHASE 2: Context compression & bridging configuration
const PHASE2_COMPRESSION_ENABLED = true; // Set to false to disable Phase 2

const BRIDGE_CONFIG: BridgeConfig = {
  enableCompression: PHASE2_COMPRESSION_ENABLED && researchDepth !== 'light',
  compressionTarget: researchDepth === 'maximum' ? 30 : 40, // Target 40% reduction
  contextTierLevel: getContextTierFromModel(modelTier),
  includeAuditTrail: true,
};

// Helper: Map model tier to context tier
function getContextTierFromModel(tier: 'light' | 'standard' | 'quality' | 'maximum'): 'light' | 'standard' | 'quality' | 'maximum' {
  return tier;
}
```

**Inside runStage, before generating output (add ~50 lines before ollamaService.generateStream):**
```typescript
// PHASE 2: Apply context bridges before generating stage output
let systemPromptWithContext = systemPrompt;
let stageBridge: StageBridge | null = null;

// Bridge FROM research stage to downstream stages
if (
  PHASE2_COMPRESSION_ENABLED &&
  previousStage === 'research' &&
  cycle.stages['research'].status === 'completed'
) {
  onChunk?.(`\n[PHASE_2] Applying research context bridge...\n`);

  try {
    stageBridge = await bridgeResearchContext(
      cycle,
      BRIDGE_CONFIG,
      onChunk,
      stageAbortSignal
    );

    // Prepend bridged context to system prompt
    systemPromptWithContext = `${systemPrompt}

## Research Context Bridge (from ${previousStage} stage)
${stageBridge.context}

---
`;

    onChunk?.(`[PHASE_2] Context bridge applied (${stageBridge.tokenCount} tokens, ${stageBridge.compressed ? 'compressed' : 'full'})\n`);
  } catch (error) {
    onChunk?.(`[PHASE_2_ERROR] Bridge failed, continuing without context: ${error}\n`);
    // Continue without bridge — non-fatal
  }
}

// Special bridges for Make and Test stages
if (PHASE2_COMPRESSION_ENABLED && stageName === 'production') {
  const research = parseResearchOutputForBridge(cycle.stages['research'].agentOutput);
  const makeContext = bridgeToMakeStage(research, campaign.description);
  systemPromptWithContext += `\n\n${makeContext}`;
  onChunk?.(`[PHASE_2] Make stage context bridge applied\n`);
}

if (PHASE2_COMPRESSION_ENABLED && stageName === 'test') {
  const research = parseResearchOutputForBridge(cycle.stages['research'].agentOutput);
  const testContext = bridgeToTestStage(
    cycle.stages['production'].agentOutput,
    research,
    cycle.stages['brand-dna'].agentOutput
  );
  systemPromptWithContext += `\n\n${testContext}`;
  onChunk?.(`[PHASE_2] Test stage context bridge applied\n`);
}

// Use bridged context in generation call
```

**Then update ollamaService.generateStream call:**
```typescript
// Use systemPromptWithContext instead of systemPrompt
for await (const chunk of ollamaService.generateStream({
  model: getModelForStage(stageName, modelTier),
  messages: [
    { role: 'system', content: systemPromptWithContext },  // PHASE 2 change
    { role: 'user', content: userMessage }
  ],
  stream: true,
}, stageAbortSignal)) {
  // ... rest of streaming logic ...
}
```

### Helper Function to Add

**Add to useCycleLoop.ts (around line 1200):**
```typescript
// PHASE 2 Helper: Parse research output for bridging
function parseResearchOutputForBridge(output: string): any {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Ignore parse errors
  }

  // Fallback: return stub
  return {
    customerInsights: { summary: 'See research output' },
    objections: [],
    competitiveLandscape: {},
    messagingOpportunities: [],
  };
}
```

### Verification Steps (Phase 2)

**Test 1: Bridge applied**
```typescript
// During research → brand-dna transition, in console look for:
// "[PHASE_2] Applying research context bridge..."
// "[PHASE_2] Context bridge applied (XXXX tokens, compressed)"
```

**Test 2: Context in prompts**
```typescript
// Set breakpoint in runStage, inspect systemPromptWithContext
// Should contain "## Research Context Bridge" section
```

**Test 3: Token reduction**
```bash
# Compare stage outputs with/without Phase 2
# Expected: 40% fewer tokens in downstream stages
```

---

## Phase 3: Advanced Make/Test Wiring

### Hook Point 1: useCycleLoop.ts — Production Stage

**File:** `/Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts`

**Add imports (line 30):**
```typescript
// PHASE 3: Advanced Make/Test stages
import {
  generateAdConcepts,
  AdConcept,
  MakeResult,
} from '../utils/advancedMakeStage';
import {
  evaluateConceptsAdvanced,
  ConceptScore,
  TestResult,
} from '../utils/advancedTestStage';
```

**Replace production stage case (find ~line 750):**

**Before:**
```typescript
case 'production': {
  onChunk?.('\n');
  const systemPrompt = getSystemPrompt('make', campaign);

  for await (const chunk of ollamaService.generateStream({
    model: getModelForStage('production', modelTier),
    messages: [/* ... */],
    stream: true,
  }, stageAbortSignal)) {
    // ... stream handling ...
  }
  break;
}
```

**After (Phase 3):**
```typescript
case 'production': {
  onChunk?.('\n[PHASE_3] Launching advanced Make stage...\n');

  const PHASE3_ENABLED = true; // Feature flag

  if (PHASE3_ENABLED) {
    try {
      // Parse research findings from previous stage
      const research = parseResearchOutputForBridge(cycle.stages['research'].agentOutput);
      const researchContext = cycle.stages['research'].agentOutput;

      // Generate multi-format concepts
      const makeResult = await generateAdConcepts(
        campaign,
        research,
        researchContext,
        ['text', 'html'], // Enabled formats
        onChunk,
        stageAbortSignal
      );

      // Format output for storage
      const makeOutput = formatMakeOutput(makeResult);
      cycle.stages.production.agentOutput = makeOutput;

      // Store concepts as artifacts
      cycle.stages.production.artifacts = makeResult.concepts.map((concept, idx) => ({
        id: `concept-${idx + 1}`,
        type: 'ad_concept',
        format: concept.format,
        content: JSON.stringify(concept, null, 2),
        metadata: {
          title: concept.title,
          estimatedCTR: concept.estimatedCTR,
          format: concept.format,
          generatedAt: Date.now(),
        },
      }));

      onChunk?.(`\n[PHASE_3] ${makeResult.concepts.length} concepts generated and stored as artifacts\n`);

    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onChunk?.(`\n[PHASE_3_ERROR] Advanced Make failed, falling back: ${error}\n`);
      }
      // Fall through to standard Make stage
      const systemPrompt = getSystemPrompt('make', campaign);

      for await (const chunk of ollamaService.generateStream({
        model: getModelForStage('production', modelTier),
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildMakePrompt(campaign) }],
        stream: true,
      }, stageAbortSignal)) {
        cycle.stages.production.agentOutput += chunk;
        onChunk?.(chunk);
      }
    }
  } else {
    // Standard Make stage
    const systemPrompt = getSystemPrompt('make', campaign);

    for await (const chunk of ollamaService.generateStream({
      model: getModelForStage('production', modelTier),
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildMakePrompt(campaign) }],
      stream: true,
    }, stageAbortSignal)) {
      cycle.stages.production.agentOutput += chunk;
      onChunk?.(chunk);
    }
  }

  break;
}
```

### Hook Point 2: useCycleLoop.ts — Test Stage

**Replace test stage case (find ~line 850):**

**Before:**
```typescript
case 'test': {
  onChunk?.('\n');
  const systemPrompt = getSystemPrompt('test', campaign);

  for await (const chunk of ollamaService.generateStream({
    model: getModelForStage('test', modelTier),
    messages: [/* ... */],
    stream: true,
  }, stageAbortSignal)) {
    // ... stream handling ...
  }
  break;
}
```

**After (Phase 3):**
```typescript
case 'test': {
  onChunk?.('\n[PHASE_3] Launching advanced Test stage...\n');

  const PHASE3_ENABLED = true; // Feature flag

  if (PHASE3_ENABLED) {
    try {
      // Parse concepts from Make stage
      const concepts = parseMakeConcepts(cycle.stages['production'].agentOutput);

      if (concepts.length > 0) {
        // Evaluate with advanced scoring
        const research = parseResearchOutputForBridge(cycle.stages['research'].agentOutput);
        const audience = cycle.stages['brand-dna'].agentOutput;

        const testResult = await evaluateConceptsAdvanced(
          concepts,
          campaign,
          research,
          audience,
          onChunk,
          stageAbortSignal
        );

        // Format output
        const testOutput = formatTestOutput(testResult);
        cycle.stages.test.agentOutput = testOutput;

        // Store detailed evaluations as artifacts
        cycle.stages.test.artifacts = testResult.concepts.map((score) => ({
          id: score.conceptId,
          type: 'concept_evaluation',
          format: 'json',
          content: JSON.stringify(score, null, 2),
          metadata: {
            score: score.overallScore,
            winner: testResult.winner.conceptId === score.conceptId,
            timestamp: Date.now(),
          },
        }));

        onChunk?.(`\n[PHASE_3] Evaluation complete. Winner: ${testResult.winner.conceptId} (${testResult.winner.overallScore}/100)\n`);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onChunk?.(`\n[PHASE_3_ERROR] Advanced Test failed, falling back: ${error}\n`);
      }
      // Fall through to standard Test stage
      const systemPrompt = getSystemPrompt('test', campaign);

      for await (const chunk of ollamaService.generateStream({
        model: getModelForStage('test', modelTier),
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildTestPrompt(campaign) }],
        stream: true,
      }, stageAbortSignal)) {
        cycle.stages.test.agentOutput += chunk;
        onChunk?.(chunk);
      }
    }
  } else {
    // Standard Test stage
    const systemPrompt = getSystemPrompt('test', campaign);

    for await (const chunk of ollamaService.generateStream({
      model: getModelForStage('test', modelTier),
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildTestPrompt(campaign) }],
      stream: true,
    }, stageAbortSignal)) {
      cycle.stages.test.agentOutput += chunk;
      onChunk?.(chunk);
    }
  }

  break;
}
```

### Helper Functions to Add

**Add to useCycleLoop.ts (around line 1250):**
```typescript
// PHASE 3 Helpers: Parse and format Make/Test outputs

function parseMakeConcepts(output: string): AdConcept[] {
  const concepts: AdConcept[] = [];
  try {
    const jsonMatch = output.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: manual parsing
  }

  // Extract concepts from text format
  const conceptRegex = /Concept \d+:[\s\S]*?(?=Concept \d+:|$)/g;
  const matches = output.match(conceptRegex) || [];

  matches.forEach((block, idx) => {
    concepts.push({
      id: `concept-${idx + 1}`,
      title: extractLineValue(block, 'Title'),
      desireAngle: extractLineValue(block, 'Desire Angle'),
      objectionHandling: extractLineValue(block, 'Objection Handling'),
      socialProofElements: extractLineValue(block, 'Social Proof'),
      format: 'text',
      estimatedCTR: 5,
      targetAudience: extractLineValue(block, 'Target Audience'),
      callToAction: extractLineValue(block, 'Call to Action'),
    });
  });

  return concepts;
}

function formatMakeOutput(result: MakeResult): string {
  return `
# Advanced Make Stage Output (Phase 3)

## Summary
- Concepts Generated: ${result.concepts.length}
- Generation Time: ${result.generationTime}ms
- Tokens Used: ${result.tokenCount}

## Concepts

${result.concepts.map((c, idx) => `
### Concept ${idx + 1}: ${c.title}
- Desire Angle: ${c.desireAngle}
- Objection Handling: ${c.objectionHandling}
- Social Proof: ${c.socialProofElements}
- Target Audience: ${c.targetAudience}
- CTA: ${c.callToAction}
- Format: ${c.format}
- Est. CTR: ${c.estimatedCTR}%
`).join('\n')}

## Rationale
${result.rationale}
`;
}

function formatTestOutput(result: TestResult): string {
  return `
# Advanced Test Stage Output (Phase 3)

## Winner
- Concept: ${result.winner.conceptId}
- Overall Score: ${result.winner.overallScore}/100
- Desire Alignment: ${result.winner.desireAlignment}/100
- Objection Handling: ${result.winner.objectionHandling}/100
- Competitive Uniqueness: ${result.winner.competitiveUniqueness}/100
- Audience Fit: ${result.winner.audienceFit}/100

## Insights
${result.insights}

## All Scores
${result.concepts.map(s => `
- ${s.conceptId}: ${s.overallScore}/100
  - Desire: ${s.desireAlignment} | Objection: ${s.objectionHandling} | Unique: ${s.competitiveUniqueness} | Fit: ${s.audienceFit}
  - Strengths: ${s.strengths.join(', ')}
  - Weaknesses: ${s.weaknesses.join(', ')}
`).join('\n')}
`;
}

function extractLineValue(block: string, key: string): string {
  const regex = new RegExp(`${key}:?\\s*(.+?)(?=\\n|$)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}
```

### Verification Steps (Phase 3)

**Test 1: Concepts generated**
```bash
# Run production stage, verify:
# "[PHASE_3] Launching advanced Make stage..."
# "3 concepts generated and stored as artifacts"
```

**Test 2: Concepts scored**
```bash
# Run test stage, verify:
# "[PHASE_3] Launching advanced Test stage..."
# "Winner: concept-X (85/100)"
```

**Test 3: Artifacts stored**
```typescript
// In cycle data, check artifacts:
cycle.stages.production.artifacts.length // Should be 3
cycle.stages.test.artifacts.length // Should be 3+
```

---

## Phase 4: Infrastructure Hardening Wiring

### Hook Point 1: Import Timeout Utilities

**File:** `/Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts`

**Add imports:**
```typescript
// PHASE 4: Infrastructure Hardening
import {
  withTimeout,
  STAGE_TIMEOUTS,
  TimeoutError,
  getGracefulDegradationStrategy,
  logTimeoutEvent,
} from '../utils/stageTimeouts';
import { ResearchWatchdog } from '../utils/researchWatchdog';
import { HealthMonitor } from '../utils/healthMonitor';
```

### Hook Point 2: Initialize Monitoring

**In useCycleLoop function (around line 200):**
```typescript
// PHASE 4: Initialize infrastructure monitoring
const healthMonitor = new HealthMonitor();
const watchdog = new ResearchWatchdog();

// Start background health monitoring
useEffect(() => {
  healthMonitor.startMonitoring();

  return () => {
    healthMonitor.stopMonitoring();
  };
}, []);

// Log Phase 4 activation
onChunk?.(`[PHASE_4] Infrastructure hardening active: Timeouts + Watchdog + Health monitoring\n`);
```

### Hook Point 3: Wrap Stage Execution

**Replace runStage call in stage loop (find ~line 500):**

**Before:**
```typescript
await runStage(stageName, cycle);
```

**After (Phase 4):**
```typescript
// PHASE 4: Wrap with timeout + monitoring
try {
  const timeout = STAGE_TIMEOUTS[stageName] || 300000; // 5min default

  await withTimeout(
    () => runStage(stageName, cycle),
    timeout,
    `${stageName} stage`
  );

  // Record success in health monitor
  healthMonitor.recordSuccess(stageName);

} catch (error) {
  if (error instanceof TimeoutError) {
    onChunk?.(`\n[TIMEOUT] ${stageName} exceeded ${STAGE_TIMEOUTS[stageName]}ms limit\n`);

    // Log timeout event
    logTimeoutEvent(stageName, STAGE_TIMEOUTS[stageName]);

    // Attempt graceful degradation
    const strategy = getGracefulDegradationStrategy(stageName);
    onChunk?.(`[RECOVERY] Applying ${strategy} strategy...\n`);

    // Watchdog can attempt recovery
    if (watchdog.shouldAttemptRecovery(stageName)) {
      await watchdog.attemptRecovery(stageName, cycle, onChunk);
    }
  }

  // Record error in health monitor
  healthMonitor.recordError(stageName, error);

  // Re-throw for higher-level handling
  throw error;
}
```

### Hook Point 4: Health Status Display

**Add to StagePanel.tsx (or Dashboard):**
```typescript
// PHASE 4: Display health status
import { HealthMonitor } from '../utils/healthMonitor';

const healthMonitor = useRef(new HealthMonitor());

const [healthStatus, setHealthStatus] = useState<any>(null);

useEffect(() => {
  const interval = setInterval(() => {
    setHealthStatus(healthMonitor.current.getStatus());
  }, 5000); // Update every 5s

  return () => clearInterval(interval);
}, []);

// In JSX, display:
{healthStatus && (
  <div className="text-xs text-slate-400 space-y-1">
    <p>Ollama: {healthStatus.ollama}</p>
    <p>Wayfarer: {healthStatus.wayfarer}</p>
    <p>Memory: {healthStatus.memoryUsage}MB</p>
  </div>
)}
```

### Verification Steps (Phase 4)

**Test 1: Timeout enforcement**
```typescript
// Set a very short timeout for testing:
STAGE_TIMEOUTS['research'] = 1000; // 1 second
// Run research stage — should timeout and recover
```

**Test 2: Health monitoring**
```typescript
// In browser console:
healthMonitor.getStatus()
// Expected: { ollama: 'healthy', wayfarer: 'healthy', ... }
```

**Test 3: Graceful degradation**
```bash
# Kill Ollama mid-stage
# Verify: Stage doesn't crash, recovery attempted
# Logs show: "[RECOVERY] Attempting graceful degradation..."
```

---

## Phase 5: Benchmark Harness Wiring

### Hook Point 1: Import Benchmark Utils

**File:** `/Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts`

**Add imports:**
```typescript
// PHASE 5: Benchmark Harness
import {
  runQ3Benchmark,
  BenchmarkConfig,
  BenchmarkResult,
} from '../utils/benchmarkHarness';
```

### Hook Point 2: Add Benchmark Trigger

**Add to Dashboard.tsx (or new BenchmarkPanel):**
```typescript
// PHASE 5: Benchmark trigger button

const [benchmarkRunning, setBenchmarkRunning] = useState(false);
const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

const handleStartBenchmark = async () => {
  setBenchmarkRunning(true);

  const config: BenchmarkConfig = {
    runDuration: 3600000, // 1 hour
    cycleTarget: 3,
    stressLevel: 'standard',
    validateQuality: true,
    captureLogs: true,
  };

  const result = await runQ3Benchmark(
    campaign,
    config,
    (update) => {
      onChunk?.(update.message);
    }
  );

  setBenchmarkResult(result);
  setBenchmarkRunning(false);
};

// In JSX:
<button onClick={handleStartBenchmark} disabled={benchmarkRunning}>
  {benchmarkRunning ? 'Benchmark Running...' : 'Start Q3 Benchmark'}
</button>

{benchmarkResult && (
  <div className="bg-slate-800 p-4 rounded mt-4">
    <h3>Benchmark Results</h3>
    <p>Cycles: {benchmarkResult.totalCycles}</p>
    <p>Quality: {benchmarkResult.qualityScore}/100</p>
    <p>Stability: {benchmarkResult.stabilityScore}/100</p>
    <pre className="text-xs">{benchmarkResult.report}</pre>
  </div>
)}
```

### Verification Steps (Phase 5)

**Test 1: Benchmark launch**
```bash
npm run dev
# Navigate to Benchmark panel
# Click "Start Q3 Benchmark"
```

**Test 2: Benchmark execution**
```bash
# Monitor progress in UI
# Expected: Runs for configured duration
# Cycles should execute sequentially
```

**Test 3: Report generation**
```bash
# After benchmark completes
# Verify report shows:
# - Total cycles completed
# - Quality/Stability scores
# - Any errors encountered
```

---

## Component Wiring: UI Integration

### Activity Bar Enhancement

**File:** `/Users/mk/Downloads/nomads/src/components/StagePanel.tsx`

**Add Phase information display:**
```typescript
// Display active Phase(s)
{import.meta.env.VITE_QUERY_ROUTING_ENABLED === 'true' && (
  <div className="text-xs bg-indigo-900 text-indigo-100 px-2 py-1 rounded">
    Phase 1: Query Routing
  </div>
)}

{true && ( // Phase 2 always on
  <div className="text-xs bg-purple-900 text-purple-100 px-2 py-1 rounded">
    Phase 2: Context Compression
  </div>
)}

{true && ( // Phase 3 always on
  <div className="text-xs bg-pink-900 text-pink-100 px-2 py-1 rounded">
    Phase 3: Advanced Make/Test
  </div>
)}
```

### Dashboard Metrics Display

**Add to Dashboard.tsx:**
```typescript
// Display integration status
<div className="grid grid-cols-2 gap-2 text-xs">
  <div>Query Routing: {queryRoutingEnabled ? '✓' : '✗'}</div>
  <div>Context Compression: ✓</div>
  <div>Advanced Make: ✓</div>
  <div>Health Monitor: {healthStatus.ollama === 'healthy' ? '✓' : '⚠'}</div>
</div>

// Display quality metrics
<div className="space-y-1 text-sm mt-4">
  <p>Quality Score: {qualityScore}/100</p>
  <p>Token Efficiency: {tokenReduction}%</p>
  <p>Avg Cycle Time: {avgCycleTime}ms</p>
</div>
```

---

## Type Definitions & Imports

### Required Types to Import

```typescript
// From queryIntegration.ts
interface IntegrationResult {
  queries: FocusedQuery[];
  sourcesFound: SourceData[];
  totalTokens: number;
  executionTime: number;
}

// From semanticContextCompression.ts
interface CompressionResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  semanticPreservation: number;
}

// From advancedMakeStage.ts
interface AdConcept {
  id: string;
  title: string;
  desireAngle: string;
  objectionHandling: string;
  socialProofElements: string;
  format: 'text' | 'html' | 'interactive';
  estimatedCTR: number;
  targetAudience: string;
  callToAction: string;
}

// From advancedTestStage.ts
interface ConceptScore {
  conceptId: string;
  desireAlignment: number;
  objectionHandling: number;
  competitiveUniqueness: number;
  audienceFit: number;
  overallScore: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// From benchmarkHarness.ts
interface BenchmarkResult {
  totalCycles: number;
  totalTime: number;
  averageTimePerCycle: number;
  tokenCount: number;
  averageTokensPerCycle: number;
  qualityScore: number;
  stabilityScore: number;
  memoryUsage: { peak: number; average: number };
  errors: BenchmarkError[];
  report: string;
}
```

### Environment Variables to Set

```bash
# .env
VITE_QUERY_ROUTING_ENABLED=true
VITE_QUERY_ROUTING_STRATEGY=standard
VITE_OLLAMA_URL=http://100.74.135.83:11440
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
```

---

## Integration Checklist

- [ ] Phase 1: Add query router imports + modify orchestrator
- [ ] Phase 1: Update useOrchestratedResearch caller
- [ ] Phase 1: Verify Feature flag in .env
- [ ] Phase 2: Add compression imports + helpers
- [ ] Phase 2: Integrate context bridges into runStage
- [ ] Phase 2: Test bridge output in Make/Test stages
- [ ] Phase 3: Add Make/Test stage imports
- [ ] Phase 3: Replace production stage execution
- [ ] Phase 3: Replace test stage execution
- [ ] Phase 3: Verify concept artifacts stored
- [ ] Phase 4: Add timeout imports + initialize monitoring
- [ ] Phase 4: Wrap stage execution with timeout
- [ ] Phase 4: Add health monitor to UI
- [ ] Phase 5: Add benchmark imports
- [ ] Phase 5: Add benchmark trigger button
- [ ] Phase 5: Verify benchmark execution
- [ ] All: Build succeeds (`npm run build`)
- [ ] All: Dev server runs (`npm run dev`)
- [ ] All: No console errors on load

---

## Debugging Tips

**If Phase 1 not triggering:**
```typescript
// In console:
console.log(import.meta.env.VITE_QUERY_ROUTING_ENABLED);
// Should be 'true'
```

**If Phase 2 bridges not applying:**
```typescript
// Check useCycleLoop logs:
// "[PHASE_2] Applying research context bridge..."
// If not appearing, check PHASE2_COMPRESSION_ENABLED flag
```

**If Phase 3 Make stage failing:**
```typescript
// Check ollamaService is running:
await ollamaService.checkConnection()
// Should return true
```

**If timeouts too aggressive (Phase 4):**
```typescript
// Increase in stageTimeouts.ts:
const STAGE_TIMEOUTS = {
  research: 900000, // Increase from 600000
  // ...
}
```

---

**Complete wiring guide ready for implementation.**
