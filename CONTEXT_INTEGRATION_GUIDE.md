# Context Quality System — Integration Guide

Quick reference for integrating the four context quality modules into the NOMADS pipeline.

## Module Locations

```
src/utils/
├── semanticContextCompression.ts    ← Compress findings 2.1MB → 200KB
├── contextChainOfThought.ts         ← Track hypothesis testing & provenance
├── multiPhaseContextBridge.ts       ← Validate phase transitions
└── contextIntelligentRecall.ts      ← Smart context recall for downstream agents
```

## Integration Points

### 1. Research Phase (Phase 2)

**File**: `src/hooks/useOrchestratedResearch.ts` or `src/utils/researchAgents.ts`

```typescript
import { createChainOfThoughtTracker, recordHypothesis, recordEvidence } from '@/utils/contextChainOfThought';
import { SemanticCompressionEngine } from '@/utils/semanticContextCompression';

// At research start
const cot = createChainOfThoughtTracker();

// During hypothesis testing
recordHypothesis(
  `hyp-${Date.now()}`,
  'Customers fear product side effects',
  'objection',
  initialConfidence=50
);

// As evidence is gathered
recordEvidence(
  hypothesisId,
  sourceUrl,
  snippet,
  sourceType='reddit',
  direction='supporting',
  relevance=85,
  weight=90
);

// After research completes
const findings = await orchestrator.completeResearch();
const engine = new SemanticCompressionEngine();
const compressed = engine.compress(findings, originalSizeBytes);

// Store in campaign context
campaign.researchFindings.compressed = compressed;
campaign.researchFindings.provenance = cot.buildProvenanceReport();
```

### 2. Phase Transition Validation

**File**: `src/hooks/useCycleLoop.ts` or stage transition point

```typescript
import { ContextBridgeManager, ContextBridgeValidator } from '@/utils/multiPhaseContextBridge';

// Before transitioning from Phase 1 to Phase 2
const bridgeManager = new ContextBridgeManager();
const check = await bridgeManager.executeTransition(
  'phase1',
  'phase2',
  {
    deepDesires: campaign.deepDesires,
    objections: campaign.objections,
    avatarLanguage: campaign.avatarLanguage
  }
);

if (!check.canProceed) {
  console.warn('Context gaps detected:', check.gaps);
  const recovery = ContextBridgeValidator.generateRecoveryPlan(check);
  // Show user: "Missing context: [recovery.recommendations]"
  // or automatically re-research with suggested queries
  return; // Don't advance until resolved
}

// Safe to proceed
campaign.currentStage = 'phase3';
```

### 3. Downstream Agents (Make, Test, Production)

**File**: `src/utils/makeAgent.ts`, `src/utils/testAgent.ts`, etc.

```typescript
import { ContextIntelligentRecall } from '@/utils/contextIntelligentRecall';
import { SemanticDecompressor } from '@/utils/semanticContextCompression';

// Initialize recall for this stage
const recall = new ContextIntelligentRecall(windowBudget=8000);

// Use compressed findings from research
if (campaign.researchFindings.compressed) {
  recall.initializeWithCompressed(campaign.researchFindings.compressed);
}

// Make stage: Need emotional & objection context
const makeContext = recall.recall({
  topics: ['emotional_landscape', 'objections', 'social_proof'],
  minConfidence: 80,
  limit: 100
});

console.log(`Using ${makeContext.tokenCount} tokens for context`);
const concepts = await generateAdConcepts(makeContext.findings);

// Test stage: Need audience & competitor context
const testContext = recall.recall({
  topics: ['audience_language', 'competitor_positioning'],
  minConfidence: 75
});

const evaluated = await evaluateConcepts(testContext.findings);

// Check window state
const state = recall.getWindowState();
if (state.percentageUsed > 80) {
  console.warn('Context window 80%+ full');
  const recommendations = recall.getOptimizationRecommendations();
  // Show to user or auto-adjust
}
```

### 4. Transparency & Audit Trail

**File**: `src/components/CycleTimeline.tsx` or report generation

```typescript
import { SemanticDecompressor } from '@/utils/semanticContextCompression';

// Generate transparent provenance report for client
function generateProvenanceReport(campaign: Campaign) {
  const cot = campaign.researchFindings.chainOfThought;
  const provenanceReport = cot.buildProvenanceReport();

  // Find specific insight
  const objectionInsights = provenanceReport.insightChains.filter(
    i => i.insightType === 'objection'
  );

  objectionInsights.forEach(insight => {
    const provenance = cot.getProvenanceForInsight(insight.insightId);
    // Include in PDF or web report
    addToReport(`\n${provenance}\n`);
  });

  // Also export knowledge graph visualization
  const graph = SemanticDecompressor.exportAsKnowledgeGraph(
    campaign.researchFindings.compressed
  );
  // Render nodes/edges in Figma or visualization tool
}
```

### 5. Memory Archival (Phase 7)

**File**: `src/utils/memoryAgent.ts` or phase 7 handler

```typescript
import { SemanticCompressionEngine } from '@/utils/semanticContextCompression';

// Archive compressed findings for next cycle
const memory = {
  cycle: campaign.cycleNumber,
  compressed: campaign.researchFindings.compressed,
  provenance: campaign.researchFindings.provenance,

  // Knowledge graph for visualization
  graph: SemanticDecompressor.exportAsKnowledgeGraph(
    campaign.researchFindings.compressed
  ),

  // Phase transition quality scores
  transitionQuality: campaign.contextBridgeQuality,

  // What worked (for next cycle learning)
  winningConcept: campaign.testResults.winner,
  performanceMetrics: campaign.testResults.metrics
};

await memoryStore.save(memory);
```

---

## Usage Examples by Stage

### Stage 3: Objection Handling

```typescript
// Recall only objection-related context
const objContext = recall.recall({
  topics: ['objections', 'purchase_blockers', 'fear'],
  relationshipTypes: ['required_proof', 'handling_approach', 'impact'],
  minConfidence: 80
});

const objectionHandling = await generateObjectionMessaging(objContext.findings);
```

### Stage 4: Taste Direction

```typescript
// Recall emotional & brand context
const tasteContext = recall.recall({
  topics: ['emotional_landscape', 'identity_signal', 'brand_voice'],
  relationshipTypes: ['triggers_emotion', 'primary_emotion', 'identity'],
  minConfidence: 80
});

const taseDirection = await generateCreativeDirection(tasteContext.findings);
```

### Stage 5: Ad Concepts

```typescript
// Recall desires, objections, and emotional context
const conceptContext = recall.recallMultiple([
  { topics: ['deep_desires'], minConfidence: 85 },
  { topics: ['objections', 'proof'], minConfidence: 80 },
  { topics: ['emotional_landscape'], minConfidence: 75 }
]);

const concepts = await generateConcepts(conceptContext);
```

### Stage 6: Production

```typescript
// Recall visual + style direction
const prodContext = recall.recall({
  topics: ['visual_patterns', 'colors', 'layout', 'brand_voice'],
  minConfidence: 80
});

const assets = await generateAssets(prodContext.findings);
```

---

## API Quick Reference

### Semantic Compression

```typescript
// Compress
const engine = new SemanticCompressionEngine();
const compressed = engine.compress(findings, sizeBytes);

// Decompress partial
const triples = SemanticDecompressor.partialRecall(compressed, 'topic');

// Reconstruct
const reconstructed = SemanticDecompressor.reconstructForTopic(compressed, 'topic');

// Export graph
const { nodes, edges } = SemanticDecompressor.exportAsKnowledgeGraph(compressed);

// Serialize/deserialize
const json = serializeCompressed(compressed);
const restored = deserializeCompressed(json);
```

### Chain of Thought

```typescript
const cot = createChainOfThoughtTracker();

// Register hypothesis
cot.registerHypothesis(id, statement, category, confidence);

// Record query & evidence
cot.recordQuery(hypothesisId, query);
cot.addEvidence(hypothesisId, url, snippet, type, direction, relevance, weight);

// Finalize & report
cot.finalizeHypothesis(hypothesisId);
const report = cot.buildProvenanceReport();
const provenance = cot.getProvenanceForInsight(insightId);
```

### Phase Bridge

```typescript
const bridgeManager = new ContextBridgeManager();
const check = await bridgeManager.executeTransition(fromPhase, toPhase, context);

if (!check.canProceed) {
  const recovery = ContextBridgeValidator.generateRecoveryPlan(check);
}

const report = bridgeManager.getOverallQuality();
```

### Context Recall

```typescript
const recall = new ContextIntelligentRecall(windowBudget);

// Initialize
recall.initializeWithCompressed(compressed);
recall.initializeWithRaw(findings, sizeBytes);

// Recall
const context = recall.recall({ topics, relationshipTypes, minConfidence, limit });
const contexts = recall.recallMultiple([query1, query2]);

// Monitor
const state = recall.getWindowState();
const recommendations = recall.getOptimizationRecommendations();
const history = recall.exportHistory();

// Strategies
const minimal = ContextRecallStrategies.minimalRecall(compressed);
const focused = ContextRecallStrategies.focusedRecall(compressed, goal);
const evidenceBacked = ContextRecallStrategies.evidenceBackedRecall(compressed, minSources);
const recent = ContextRecallStrategies.timeBasedRecall(compressed, maxAgeMs);
```

---

## Troubleshooting

### Compression ratio not 10x?
- Check that findings include all optional fields (visualFindings, emotionalLandscape, etc.)
- More complete findings = better compression ratio
- Minimum ~5x even with sparse findings

### Phase transition failing?
- Review check.gaps for specifics
- Execute suggested queries from recovery plan
- Rerun validation after re-research

### Context window warnings?
- Switch to `ContextRecallStrategies.minimalRecall()` or `focusedRecall()`
- Check getOptimizationRecommendations() for specific actions
- Consider splitting into multiple recall calls

### Low confidence insights?
- Check hypothesis.evidence - may need more sources
- Verify sourceCount in triples - increase minSourceCount filter
- Look at reasoningChain - reasoning steps clear?

---

## Type Definitions

All types are exported from respective modules:

```typescript
// Compression
import type {
  SemanticTriple,
  CompressedResearchFindings,
  CompressionMetadata,
  ReconstructionMap
} from '@/utils/semanticContextCompression';

// Chain of Thought
import type {
  HypothesisTest,
  EvidenceEntry,
  InsightChain,
  ContextChainOfThoughtReport
} from '@/utils/contextChainOfThought';

// Phase Bridge
import type {
  PhaseTransitionCheck,
  ContextGap,
  PhaseTransitionReport
} from '@/utils/multiPhaseContextBridge';

// Context Recall
import type {
  ContextQuery,
  RecalledContext,
  ContextWindowState
} from '@/utils/contextIntelligentRecall';
```

---

## Testing Checklist

- [ ] Compression achieves 10x ratio with <2% info loss
- [ ] Phase 1→2 transition detects missing desires
- [ ] Phase 2→3 transition detects insufficient sources
- [ ] Recall saves 50-75% context window space
- [ ] Provenance reports are human-readable
- [ ] Knowledge graph exports valid node/edge structures
- [ ] No TypeScript errors in build
- [ ] All modules integrated into useCycleLoop

---

## Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Compress findings | <500ms | 100-200ms |
| Decompress partial | <100ms | 10-50ms |
| Phase validation | <200ms | 50-100ms |
| Context recall | <100ms | 20-50ms |
| Build size impact | <100KB | 60KB gzipped |

---

## Questions?

Refer to CONTEXT_QUALITY_SYSTEM.md for detailed documentation of each module.
