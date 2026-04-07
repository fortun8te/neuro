# Smart Model Selector Integration Guide

This guide shows how to integrate the Smart Model Selector into your existing pipeline.

## Quick Start

### 1. Import the selector

```typescript
import { selectModelForTask } from './utils/smartModelSelector';
```

### 2. Call it with intent + context

```typescript
const model = selectModelForTask(userMessage, {
  messageLength: userMessage.length,
  conversationLength: getConversationLength(),
  hasCode: containsCodeBlock(userMessage),
  previousFailure: lastAttemptFailed,
});

// Use the model
const response = await ollamaService.generateStream({
  model,
  prompt: userMessage,
  signal,
  onChunk: updateUI,
});
```

## Integration Points

### Agent Engine (agentEngine.ts)

**Location:** Main chat loop where models are selected

**Current code:**
```typescript
const effectiveModel = mentionedModel || modelOverride || getModelForStage('research');
```

**Updated code:**
```typescript
import { selectModelForTask } from './utils/smartModelSelector';

const effectiveModel = selectModelForTask(effectiveMessage, {
  messageLength: effectiveMessage.length,
  conversationLength: conversationHistory.reduce((sum, msg) => sum + msg.length, 0),
  hasCode: /```|{|function|const|import|export/.test(effectiveMessage),
  hasImages: conversationHistory.some(msg => msg.includes('[image]')),
  previousFailure: lastToolFailed,
  timeConstraint: userIsWaitingForResponse ? 'urgent' : 'normal',
});
```

### Tool Router (toolRouter.ts)

**Location:** Tool selection routing

**Current:**
```typescript
const routerModel = getModelForStage('toolRouter');
```

**Updated:**
```typescript
import { selectModelForTask } from './smartModelSelector';

const routerModel = selectModelForTask(userMessage, {
  messageLength: userMessage.length,
  conversationLength: conversationHistory.length,
  requiresReasoning: true,  // Tool selection is a reasoning task
});
```

### Research Pipeline (useOrchestratedResearch.ts)

**Location:** Research iteration loops

**Current:**
```typescript
const orchestratorModel = getModelForStage('orchestrator');
```

**Updated:**
```typescript
import { selectModelForTask } from './smartModelSelector';

// Decide what to research next
const orchestratorModel = selectModelForTask(
  `Orchestrate research: ${currentPhase}`,
  {
    messageLength: researchContext.length,
    conversationLength: cumulativeFindings.length,
    requiresReasoning: true,  // Orchestration is planning
  }
);
```

### Vision/Image Analysis

**Location:** Screenshot or image analysis

**Current:**
```typescript
const visionModel = getVisionModel();
```

**Updated:**
```typescript
import { selectModelForTask } from './smartModelSelector';

const visionModel = selectModelForTask(userMessage, {
  hasImages: true,
  messageLength: userMessage.length,
  requiresVision: true,  // Forces 9b minimum
});
```

### Thinking/Reasoning Tasks

**Location:** Deep reasoning loops

**Current:**
```typescript
const thinkingModel = getThinkingModel();
```

**Updated:**
```typescript
import { selectModelForTask } from './smartModelSelector';

const thinkingModel = selectModelForTask(userMessage, {
  requiresReasoning: true,
  conversationLength: conversationHistory.length,
  timeConstraint: 'patient',  // Reasoning can be slow
});
```

## Common Patterns

### Pattern 1: Chat Message Routing

```typescript
function getChatModel(userMessage: string, context: ConversationContext): string {
  return selectModelForTask(userMessage, {
    messageLength: userMessage.length,
    conversationLength: context.history.reduce((sum, m) => sum + m.content.length, 0),
    hasCode: /```|{|function|const/.test(userMessage),
    hasImages: context.attachments?.some(a => a.type === 'image'),
    previousFailure: context.lastAttemptFailed,
    timeConstraint: context.userWaitingFor ? 'urgent' : 'normal',
  });
}

// Usage
const model = getChatModel(userMessage, conversationContext);
const response = await ollamaService.generateStream({ model, prompt: userMessage });
```

### Pattern 2: Tool Selection

```typescript
function getToolRouterModel(userIntent: string, context: RoutingContext): string {
  return selectModelForTask(userIntent, {
    messageLength: userIntent.length,
    conversationLength: context.conversationLength,
    requiresReasoning: true,  // Tool selection needs reasoning
    timeConstraint: context.isUrgent ? 'urgent' : 'normal',
  });
}

// Usage
const routerModel = getToolRouterModel(userMessage, routingContext);
const toolSelection = await selectTools({ goal: userMessage }, { model: routerModel });
```

### Pattern 3: Research Orchestration

```typescript
function getResearchModel(phase: string, context: ResearchContext): string {
  return selectModelForTask(`orchestrate ${phase}`, {
    messageLength: phase.length,
    conversationLength: context.cumulativeFindings.length,
    requiresReasoning: true,  // Orchestration is planning
    timeConstraint: context.hasTimeLimit ? 'normal' : 'patient',
  });
}

// Usage
const orchestratorModel = getResearchModel('phase2', researchContext);
const nextStep = await orchestrateResearch({
  model: orchestratorModel,
  currentFindings,
});
```

### Pattern 4: Vision + Reasoning

```typescript
function getAnalysisModel(imageUrl: string, question: string, context: AnalysisContext): string {
  return selectModelForTask(question, {
    messageLength: question.length,
    hasImages: true,
    requiresVision: true,
    requiresReasoning: context.needsDeepAnalysis,
    conversationLength: context.analysisHistory.length,
  });
}

// Usage
const model = getAnalysisModel(imageUrl, userQuestion, analysisContext);
const analysis = await analyzeImage({
  model,
  imageUrl,
  question: userQuestion,
});
```

## Context Building Helpers

Create utility functions to build context consistently:

```typescript
// src/utils/contextBuilders.ts

export function buildChatContext(
  message: string,
  history: Message[],
  state: AppState
): TaskContext {
  return {
    messageLength: message.length,
    conversationLength: history.reduce((sum, m) => sum + m.content.length, 0),
    hasCode: /```|{|function|const|import/.test(message),
    hasImages: history.some(m => m.attachments?.some(a => a.type === 'image')),
    previousFailure: state.lastActionFailed,
    timeConstraint: state.userWaitingFor ? 'urgent' : 'normal',
    customConstraints: {
      userPreference: state.userModelPreference,
      budget: state.tokenBudget,
    },
  };
}

export function buildResearchContext(
  query: string,
  findings: ResearchFindings,
  config: ResearchConfig
): TaskContext {
  return {
    messageLength: query.length,
    conversationLength: findings.cumulativeLength,
    requiresReasoning: true,
    timeConstraint: config.hasDeadline ? 'urgent' : 'patient',
    customConstraints: {
      depth: config.researchDepth,
      coverage: findings.coveragePercent,
    },
  };
}

export function buildVisionContext(
  prompt: string,
  imageCount: number = 1
): TaskContext {
  return {
    messageLength: prompt.length,
    hasImages: imageCount > 0,
    requiresVision: true,
    customConstraints: {
      imageCount,
      analysisDepth: 'detailed',
    },
  };
}

// Usage
const chatModel = selectModelForTask(
  userMessage,
  buildChatContext(userMessage, conversation, appState)
);
```

## Testing Your Integration

### Unit Tests

```typescript
import { selectModelForTask } from './utils/smartModelSelector';

describe('Model selection in my feature', () => {
  test('simple edit uses 2b', () => {
    const model = selectModelForTask('rename this var', {
      hasCode: true,
      messageLength: 30,
    });
    expect(model).toBe('qwen3.5:2b');  // Should be 4b actually
  });

  // Fix test
  test('simple edit uses 4b', () => {
    const model = selectModelForTask('rename this var', {
      hasCode: true,
      messageLength: 30,
    });
    expect(model).toBe('qwen3.5:4b');
  });
});
```

### Manual Testing

Use the debug helper to see selection decisions:

```typescript
import { analyzeModelSelection } from './utils/smartModelSelector';

const analysis = analyzeModelSelection('test message', { hasCode: true });
console.table({
  Intent: analysis.intent,
  Category: analysis.analysis.category,
  Confidence: analysis.analysis.confidence.toFixed(2),
  Reasoning: analysis.analysis.reasoning,
  SelectedTier: analysis.selectedTier,
  SelectedModel: analysis.selectedModel,
});

// Output:
// ┌──────────────────┬────────────────────────────────┐
// │ Intent           │ test message                   │
// │ Category         │ routine                        │
// │ Confidence       │ 0.60                           │
// │ Reasoning        │ Medium-length message          │
// │ SelectedTier     │ balanced                       │
// │ SelectedModel    │ qwen3.5:4b                     │
// └──────────────────┴────────────────────────────────┘
```

## Monitoring & Debugging

### Enable Debug Logging

Open browser console (localhost only):

```javascript
// Automatically logged by smartModelSelector in dev mode
// Look for: [SmartModelSelector] intent="..." category=...
```

### Track Model Distribution

```typescript
// Add to your monitoring/analytics
const modelUsageStats = new Map<string, number>();

const model = selectModelForTask(userMessage, context);
const count = (modelUsageStats.get(model) || 0) + 1;
modelUsageStats.set(model, count);

// Check periodically
console.log('Model distribution:', Object.fromEntries(modelUsageStats));
```

### Profile Performance

```typescript
function profileModelSelection(messages: string[]): void {
  const results = new Map<string, { count: number; avgTime: number }>();

  for (const msg of messages) {
    const start = performance.now();
    const model = selectModelForTask(msg, { messageLength: msg.length });
    const duration = performance.now() - start;

    const existing = results.get(model) || { count: 0, avgTime: 0 };
    results.set(model, {
      count: existing.count + 1,
      avgTime: (existing.avgTime * existing.count + duration) / (existing.count + 1),
    });
  }

  console.table(Object.fromEntries(results));
}
```

## Rollout Strategy

### Phase 1: Pilot (One feature)
- Integrate into one feature (e.g., chat messages)
- Monitor for 1-2 weeks
- Verify model selection makes sense

### Phase 2: Expand (Multiple features)
- Add to research pipeline
- Add to tool routing
- Monitor VRAM usage and latency

### Phase 3: Full Rollout (All pipeline)
- Replace all `getModelForStage()` calls
- Update documentation
- Create team training

### Phase 4: Optimize (Feedback loop)
- Collect metrics on model selection accuracy
- Adjust confidence thresholds based on data
- Add semantic intent routing if needed

## Fallback Strategy

If smart selection causes issues, fall back to explicit stage models:

```typescript
let model: string;

try {
  model = selectModelForTask(userMessage, buildContext());
} catch (error) {
  console.warn('Smart selection failed, falling back to stage model', error);
  model = getModelForStage('research');  // Safe fallback
}
```

## Troubleshooting

### Model always picks 2b
- **Cause:** Intent is too simple
- **Fix:** Add more context: `messageLength`, `conversationLength`, `hasCode`

### Model picks nemotron for everything
- **Cause:** `requiresReasoning: true` on all tasks
- **Fix:** Only set `requiresReasoning` for actual reasoning tasks

### VRAM exploding
- **Cause:** Too many 9b/nemotron models running in parallel
- **Fix:** Add time constraint or implement request queuing

### Selection feels wrong
- **Fix:** Add `customConstraints` for your specific use case
- **Better:** Use `analyzeModelSelection()` to debug the decision

## Next Steps

1. **Pick one integration point** (e.g., chat messages)
2. **Test thoroughly** with the test suite
3. **Monitor for 1-2 weeks** before expanding
4. **Gather feedback** from users/metrics
5. **Optimize confidence thresholds** based on real data
6. **Expand to other pipeline stages**
7. **Consider semantic routing** (embeddings-based) for future

## Support

See `SMART_MODEL_SELECTOR.md` for:
- Full API documentation
- Intent category details
- Performance characteristics
- Known limitations
