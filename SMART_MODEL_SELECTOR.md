# Intelligent Model Selection System

## Overview

The Smart Model Selector automatically picks the right model based on task intent and context. This eliminates manual model configuration for routine tasks while ensuring quality when needed.

**Models Available:**
- `qwen3.5:2b` (ultra-fast) — Simple tasks, acks, formatting
- `qwen3.5:4b` (balanced) — Default for most tasks
- `qwen3.5:9b` (high quality) — Complex reasoning, vision
- `nemotron-3-super:120b` (best reasoning) — Planning, tool routing, orchestration

## Architecture

### Core Files

1. **`frontend/utils/smartModelSelector.ts`** — Main selection logic
   - `selectModelForTask(intent, context)` — Primary entry point
   - `analyzeIntent()` — Intent classification engine
   - `selectTierForIntent()` — Tier selection with constraints
   - `analyzeModelSelection()` — Debugging helper

2. **`frontend/utils/modelConfig.ts`** — Configuration layer
   - `SMART_MODEL_TIERS` — Tier-to-model mapping
   - `getModelForSmartTier()` — Get model for a tier
   - `STAGE_TIER_HINTS` — Stage-to-tier mapping (optional)

## Usage

### Basic Usage

```typescript
import { selectModelForTask } from './utils/smartModelSelector';

// Simple ack
const model = selectModelForTask('ok', {});
// Returns: 'qwen3.5:2b'

// Routine refactoring
const model = selectModelForTask('refactor this function', { hasCode: true });
// Returns: 'qwen3.5:4b'

// Complex analysis
const model = selectModelForTask('debug this issue', {
  hasCode: true,
  messageLength: 500
});
// Returns: 'qwen3.5:9b'

// Tool selection (needs reasoning)
const model = selectModelForTask('which tool should I use?', {
  conversationLength: 2000,
});
// Returns: 'nemotron-3-super:120b'
```

### Advanced Context

The `TaskContext` provides rich information for selection:

```typescript
interface TaskContext {
  messageLength?: number;        // Character count
  conversationLength?: number;   // Total history
  hasImages?: boolean;           // Image in message
  hasCode?: boolean;             // Code block in message
  previousFailure?: boolean;     // Previous attempt failed
  timeConstraint?: 'urgent' | 'normal' | 'patient';  // Time sensitivity
  requiresReasoning?: boolean;   // Needs thinking tokens
  requiresVision?: boolean;      // Needs image capability
  customConstraints?: Record<string, any>;  // Task-specific
}
```

## Intent Categories

### SIMPLE (2b) — Ultra-fast
Triggers for:
- One-word acks: "ok", "yes", "got it"
- Status checks: "what time is it?", "is X done?"
- Text ops: "copy this", "format text", "fix the line"
- One-liner edits: "rename this variable"
- Simple CLI: "run npm test"

**Confidence:** 0.8–0.95

### ROUTINE (4b) — Balanced (Default)
Triggers for:
- Code refactoring: "rename vars", "reorganize"
- File operations: "read file", "write config"
- Simple bug fixes: "there's an error" (small code block)
- Content generation: "write a blog post"
- Data extraction: "parse this JSON"
- Research queries: "look up X", "explain Y"

**Confidence:** 0.75–0.85

### COMPLEX (9b) — High Quality
Triggers for:
- Architecture decisions: "system design", "design pattern"
- Deep code analysis: "what's wrong?" (large codebase)
- Complex bug investigation: Multi-file issues
- Multi-file refactoring: "reorganize entire codebase"
- Creative work: "create an ad", "write copy"
- Long-form content: >200 char requests

**Confidence:** 0.75–0.9

### PLANNING (nemotron) — Best Reasoning
Triggers for:
- Tool/function selection: "which tool should I use?"
- Orchestration: "plan the workflow"
- Decision-making: "should I...", "best approach?"
- Complex problem solving: With 1000+ char history

**Confidence:** 0.75–0.9

## Integration Points

### 1. Agent Engine (agentEngine.ts)

Replace model selection calls with smart routing:

**Before:**
```typescript
const model = getModelForStage('research');
```

**After:**
```typescript
import { selectModelForTask } from './smartModelSelector';

const model = selectModelForTask(userMessage, {
  messageLength: userMessage.length,
  conversationLength: conversationHistory.length,
  hasCode: containsCodeBlock(userMessage),
  previousFailure: lastAttemptFailed,
});
```

### 2. Research Pipeline (useOrchestratedResearch.ts)

Use smart selection for research agent selection:

```typescript
import { selectModelForTask } from './smartModelSelector';

const researcherModel = selectModelForTask(
  `research: ${searchQuery}`,
  { messageLength: searchQuery.length }
);
```

### 3. Tool Router (toolRouter.ts)

Route tool selection to appropriate model:

```typescript
import { selectModelForTask } from './smartModelSelector';

const routerModel = selectModelForTask(userMessage, {
  messageLength: userMessage.length,
  requiresReasoning: true,  // Tool selection needs reasoning
});
```

### 4. Stage Configuration (modelConfig.ts)

Optional: Link stages to tier hints:

```typescript
export const STAGE_TIER_HINTS: Record<string, ModelTier> = {
  'fast': 'fast',
  'router': 'balanced',
  'orchestrator': 'quality',
  'tool-selection': 'reasoning',
};
```

Use with:
```typescript
import { getTierForStage, getModelForSmartTier } from './smartModelSelector';

const tier = getTierForStage('tool-selection');
const model = getModelForSmartTier(tier);
```

## Configuration

### Runtime Overrides

Users can customize tier-to-model mapping via localStorage:

```typescript
// Override the 'quality' tier to use a different model
localStorage.setItem('smart_tier_quality', 'qwen3.5:27b');
```

### Environment Overrides

Models respect INFRASTRUCTURE config:
```typescript
import { INFRASTRUCTURE } from '../config/infrastructure';

// All models are served through INFRASTRUCTURE.ollamaUrl
```

## Debugging

### Get Selection Details

```typescript
import { analyzeModelSelection } from './smartModelSelector';

const analysis = analyzeModelSelection('refactor this', { hasCode: true });
console.log(analysis);
// {
//   intent: "refactor this",
//   analysis: {
//     category: 'routine',
//     confidence: 0.85,
//     reasoning: 'Code refactoring task'
//   },
//   selectedTier: 'balanced',
//   selectedModel: 'qwen3.5:4b',
//   context: { ... }
// }
```

### Debug Logging

Dev mode logging (localhost only):
```typescript
const model = selectModelForTask('test', {});
// Console logs: [SmartModelSelector] intent="test" category=simple tier=fast model=qwen3.5:2b confidence=0.95
```

## Performance Characteristics

| Model | Speed | Quality | VRAM | Best For |
|-------|-------|---------|------|----------|
| **2b** | 🚀🚀🚀 | ⭐ | 2-3GB | Acks, formatting, compression |
| **4b** | 🚀🚀 | ⭐⭐⭐ | 3-4GB | Default, most tasks |
| **9b** | 🚀 | ⭐⭐⭐⭐ | 6-8GB | Complex reasoning, vision |
| **nemotron 120b** | 🐢 | ⭐⭐⭐⭐⭐ | 25+GB | Best reasoning, planning |

## Test Cases

```typescript
// SIMPLE (2b)
selectModelForTask('ok', {}) → 'qwen3.5:2b'
selectModelForTask('yes', {}) → 'qwen3.5:2b'
selectModelForTask('what time is it?', {}) → 'qwen3.5:2b'
selectModelForTask('copy this', {}) → 'qwen3.5:2b'

// ROUTINE (4b)
selectModelForTask('refactor this function', { hasCode: true }) → 'qwen3.5:4b'
selectModelForTask('read the file', {}) → 'qwen3.5:4b'
selectModelForTask('write a blog post', {}) → 'qwen3.5:4b'
selectModelForTask('look up X', {}) → 'qwen3.5:4b'

// COMPLEX (9b)
selectModelForTask('architecture decision', {}) → 'qwen3.5:9b'
selectModelForTask('what's wrong?', { hasCode: true, messageLength: 500 }) → 'qwen3.5:9b'
selectModelForTask('write a long form article', { messageLength: 300 }) → 'qwen3.5:9b'

// PLANNING (nemotron)
selectModelForTask('which tool should I use?', { conversationLength: 2000 }) → 'nemotron-3-super:120b'
selectModelForTask('plan the workflow', {}) → 'nemotron-3-super:120b'
selectModelForTask('should I refactor this?', { conversationLength: 1500 }) → 'nemotron-3-super:120b'

// SPECIAL CASES
selectModelForTask('ok', { previousFailure: true }) → 'qwen3.5:4b'  // escalate on failure
selectModelForTask('ok', { timeConstraint: 'urgent' }) → 'qwen3.5:2b'  // speed for urgent
selectModelForTask('any task', { requiresVision: true }) → 'qwen3.5:9b'  // 9b minimum for vision
selectModelForTask('any task', { timeConstraint: 'patient', requiresReasoning: true }) → 'nemotron-3-super:120b'  // reasoning tier
```

## Migration Checklist

- [ ] Import `selectModelForTask` in target files
- [ ] Replace `getModelForStage()` calls with smart selection
- [ ] Add `TaskContext` information from message/history
- [ ] Test with various intents to verify routing
- [ ] Check console logs in dev mode (localhost)
- [ ] Profile VRAM usage to confirm tier distribution
- [ ] Update documentation for team

## Known Limitations

1. **Intent classification is heuristic-based** — May misclassify edge cases
   - **Fix:** Add custom constraints via `TaskContext.customConstraints`

2. **No learning/feedback loop** — Static rules
   - **Future:** Add telemetry to optimize confidence thresholds

3. **Message length is crude proxy for complexity** — Doesn't capture semantic difficulty
   - **Workaround:** Explicitly set `requiresReasoning` or `requiresVision`

4. **No cost tracking** — May use expensive models unnecessarily
   - **Future:** Integrate with cost tracker to weight selections

## Future Enhancements

1. **Semantic Intent Routing** — Use embeddings for more precise classification
2. **Feedback Loop** — Track success/failure rates per intent category
3. **Cost Optimization** — Weight model selection by token cost
4. **A/B Testing** — Compare tier recommendations across similar tasks
5. **Adaptive Confidence** — Learn which intents are hard to classify
