# Integration Patterns
## Steal from MassGen, AutoGen, LangGraph — Make Neuro Better

---

## Pattern 1: Trace Analyzer Subagent (FROM MassGen)
### What It Does
After each stage completes, spawn a background agent that analyzes what just happened and extracts insights.

### Implementation

**File:** `frontend/agentic/traceAnalyzer.ts` (NEW)

```typescript
import { agentEngine } from '../utils/agentEngine';
import { ollamaService } from '../utils/ollama';

export interface TraceInsights {
  stage: string;
  timestamp: number;
  researchedTopics: string[];
  gaps: string[];
  patterns: string[];
  recommendations: string[];
}

export async function analyzeStageTrace(
  stageName: string,
  stageAudit: any[],
  stageOutput: string
): Promise<TraceInsights> {
  const prompt = `
You are a Trace Analyzer. Your job is to extract insights from execution traces.

STAGE: ${stageName}
OUTPUT: ${stageOutput.substring(0, 1000)}...

Analyze this stage execution and answer:

1. RESEARCHED TOPICS: What specific topics/areas were researched?
   Extract: [list of 3-5 topics]

2. GAPS: What information was NOT found or IS missing?
   Extract: [list of 2-3 gaps]

3. PATTERNS: What recurring themes or patterns did you notice?
   Extract: [list of 2-3 patterns]

4. RECOMMENDATIONS: What should be researched next?
   Extract: [list of 2-3 next steps]

Format your response as JSON:
{
  "topics": [...],
  "gaps": [...],
  "patterns": [...],
  "recommendations": [...]
}
`;

  // Use fast model for analysis (2b)
  const response = await ollamaService.generateStream({
    model: 'qwen3.5:2b',
    prompt,
    stream: false,
  });

  try {
    const json = JSON.parse(response);
    return {
      stage: stageName,
      timestamp: Date.now(),
      researchedTopics: json.topics || [],
      gaps: json.gaps || [],
      patterns: json.patterns || [],
      recommendations: json.recommendations || [],
    };
  } catch {
    return {
      stage: stageName,
      timestamp: Date.now(),
      researchedTopics: [],
      gaps: [],
      patterns: [],
      recommendations: [],
    };
  }
}

export async function spawnTraceAnalyzer(
  stageName: string,
  stageAudit: any[],
  stageOutput: string
): Promise<void> {
  console.log(`[TRACE ANALYZER] Analyzing ${stageName} stage...`);

  const insights = await analyzeStageTrace(stageName, stageAudit, stageOutput);

  // Store in IndexedDB for next cycle
  await storeCycleInsights(insights);

  console.log(`[TRACE ANALYZER] Insights extracted:`);
  console.log(`  Topics: ${insights.researchedTopics.join(', ')}`);
  console.log(`  Gaps: ${insights.gaps.join(', ')}`);
  console.log(`  Patterns: ${insights.patterns.join(', ')}`);
}
```

**Integration in useCycleLoop:**

```typescript
// After research stage completes
const researchOutput = await useOrchestratedResearch(...);

// SPAWN trace analyzer (background, non-blocking)
spawnTraceAnalyzer('research', researchAudit, researchOutput).catch(console.error);

// Continue with next stage immediately
const objectionsOutput = await useObjections(researchOutput);
```

---

## Pattern 2: Explicit Routing Decisions (FROM LangGraph)
### What It Does
Every architectural choice is logged with reasoning and confidence score.

### Implementation

**File:** `frontend/agentic/routingDecisions.ts` (NEW)

```typescript
export interface RoutingDecision {
  id: string;
  type: 'task_classification' | 'stage_routing' | 'model_selection' | 'parallelization' | 'escalation';
  decision: string; // "RESEARCH_TASK", "ORCHESTRATOR", etc.
  confidence: number; // 0-1
  reasoning: string;
  timestamp: number;
  metadata?: any;
}

export class RoutingDecisionLogger {
  private decisions: RoutingDecision[] = [];

  log(
    type: RoutingDecision['type'],
    decision: string,
    confidence: number,
    reasoning: string,
    metadata?: any
  ): void {
    const entry: RoutingDecision = {
      id: `${type}-${Date.now()}`,
      type,
      decision,
      confidence,
      reasoning,
      timestamp: Date.now(),
      metadata,
    };

    this.decisions.push(entry);

    // Also log to console for visibility
    console.log(`\n📍 ROUTING DECISION: ${type.toUpperCase()}`);
    console.log(`   Decision: ${decision}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(0)}%`);
    console.log(`   Reasoning: ${reasoning}`);
  }

  getDecisions(): RoutingDecision[] {
    return [...this.decisions];
  }

  getDecisionsSince(timestamp: number): RoutingDecision[] {
    return this.decisions.filter(d => d.timestamp > timestamp);
  }
}

export const routingLogger = new RoutingDecisionLogger();
```

**Usage Example:**

```typescript
// In agentEngine, before choosing stage
routingLogger.log(
  'task_classification',
  'COMPLEX_RESEARCH_REQUIRED',
  0.92,
  'User requested competitive analysis + market research (multi-phase task)',
  {
    userQuery: userInput.substring(0, 100),
    phases: ['market', 'competitive', 'audience'],
  }
);

// Before selecting model
routingLogger.log(
  'model_selection',
  'qwen3.5:4b',
  0.88,
  'Standard complexity task (research orchestration) requires balanced model',
  {
    taskComplexity: 'standard',
    expectedInference: '30-45s',
  }
);

// Before parallel execution
routingLogger.log(
  'parallelization',
  'true',
  0.95,
  'Market + audience + competitive data can be researched independently',
  {
    parallelAgents: 3,
    expectedSpeedup: '2.5x',
  }
);
```

---

## Pattern 3: Message Handler Registry (FROM AutoGen)
### What It Does
Instead of checking message type with `if` statements, register handlers explicitly.

### Current Code (Bad)
```typescript
// agentEngine.ts
if (message.type === 'research_query') {
  // ...
} else if (message.type === 'tool_result') {
  // ...
} else if (message.type === 'error') {
  // ...
}
```

### New Approach (Good)

**File:** `frontend/agentic/messageHandlers.ts` (NEW)

```typescript
export type MessageType = 'research_query' | 'tool_result' | 'error' | 'synthesis';

export interface MessageHandler {
  type: MessageType;
  handle: (message: any) => Promise<string>;
  priority: number;
}

export class MessageHandlerRegistry {
  private handlers: Map<MessageType, MessageHandler[]> = new Map();

  register(type: MessageType, handler: (msg: any) => Promise<string>, priority: number = 0): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }

    this.handlers.get(type)!.push({ type, handle: handler, priority });

    // Sort by priority (descending)
    this.handlers.get(type)!.sort((a, b) => b.priority - a.priority);
  }

  async handle(type: MessageType, message: any): Promise<string> {
    const handlers = this.handlers.get(type);
    if (!handlers || handlers.length === 0) {
      throw new Error(`No handler registered for message type: ${type}`);
    }

    return handlers[0].handle(message);
  }
}

// Create global registry
export const messageRegistry = new MessageHandlerRegistry();

// Register handlers
messageRegistry.register(
  'research_query',
  async (msg) => {
    // Research orchestration logic
    return 'research_results';
  },
  10 // Higher priority
);

messageRegistry.register(
  'tool_result',
  async (msg) => {
    // Process tool result
    return 'synthesis_prompt';
  },
  5
);
```

**Usage in agentEngine:**

```typescript
// OLD
if (message.type === 'research_query') {
  // ... 50 lines
}

// NEW
const result = await messageRegistry.handle(message.type, message);
```

---

## Pattern 4: Model Router with Fallback Chain (FROM OpenRouter)

**File:** `frontend/agentic/modelRouter.ts` (NEW)

```typescript
export interface ModelRoutingRequest {
  taskDescription: string;
  preferredTier: 'fast' | 'standard' | 'quality' | 'maximum';
  maxLatency?: number;
  fallbackChain?: string[];
}

export interface ModelRoutingResult {
  selectedModel: string;
  reason: string;
  fallback: boolean;
}

export async function routeModel(request: ModelRoutingRequest): Promise<ModelRoutingResult> {
  const tiersToModels = {
    fast: ['qwen3.5:0.8b', 'qwen3.5:2b'],
    standard: ['qwen3.5:4b'],
    quality: ['qwen3.5:9b'],
    maximum: ['qwen3.5:27b'],
  };

  const preferredModels = tiersToModels[request.preferredTier];
  const fallback = request.fallbackChain || [
    'qwen3.5:27b',
    'qwen3.5:9b',
    'qwen3.5:4b',
    'qwen3.5:2b',
  ];

  // Try to use preferred model
  for (const model of preferredModels) {
    if (await isModelAvailable(model)) {
      routingLogger.log(
        'model_selection',
        model,
        0.95,
        `Model available and matches ${request.preferredTier} tier`,
        { tier: request.preferredTier }
      );

      return {
        selectedModel: model,
        reason: `Selected ${model} (${request.preferredTier} tier)`,
        fallback: false,
      };
    }
  }

  // Fallback to available model
  for (const model of fallback) {
    if (await isModelAvailable(model)) {
      routingLogger.log(
        'model_selection',
        model,
        0.70,
        `Preferred model unavailable, using fallback`,
        { preferredTier: request.preferredTier, fallback: model }
      );

      return {
        selectedModel: model,
        reason: `Fallback to ${model} (preferred tier unavailable)`,
        fallback: true,
      };
    }
  }

  throw new Error('No models available');
}

async function isModelAvailable(model: string): Promise<boolean> {
  try {
    const models = await ollamaService.listModels();
    return models.includes(model);
  } catch {
    return false;
  }
}
```

---

## Pattern 5: Loop Detection (FROM 2026 Safety Patterns)

**File:** `frontend/agentic/loopDetection.ts` (NEW)

```typescript
import crypto from 'crypto';

export interface LoopDetectionResult {
  looping: boolean;
  iterationCount: number;
  loopingStateHash: string;
  proof: {
    hashes: Map<number, string>;
    firstLoopDetectedAt: number;
  };
}

export class LoopDetector {
  private stateHashes: Map<number, string> = new Map();
  private iteration: number = 0;

  recordState(state: any): void {
    const hash = crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
    this.stateHashes.set(this.iteration, hash);
    this.iteration++;
  }

  detectLoop(threshold: number = 2): LoopDetectionResult | null {
    if (this.iteration < threshold + 1) {
      return null; // Not enough iterations to detect loop
    }

    // Check if state hashes repeat
    const hashes = Array.from(this.stateHashes.values());
    const lastHash = hashes[hashes.length - 1];

    let loopDetectedAt = -1;
    for (let i = 0; i < hashes.length - 1; i++) {
      if (hashes[i] === lastHash) {
        loopDetectedAt = i;
        break;
      }
    }

    if (loopDetectedAt !== -1) {
      return {
        looping: true,
        iterationCount: this.iteration,
        loopingStateHash: lastHash,
        proof: {
          hashes: this.stateHashes,
          firstLoopDetectedAt: loopDetectedAt,
        },
      };
    }

    return null;
  }

  reset(): void {
    this.stateHashes.clear();
    this.iteration = 0;
  }
}

export const loopDetector = new LoopDetector();
```

---

## Integration Checklist

- [ ] Add Trace Analyzer (MassGen pattern)
- [ ] Add Routing Decision Logger (LangGraph pattern)
- [ ] Add Message Handler Registry (AutoGen pattern)
- [ ] Add Model Router with Fallback (OpenRouter pattern)
- [ ] Add Loop Detection (2026 safety pattern)
- [ ] Wire all into useCycleLoop
- [ ] Test each pattern in isolation
- [ ] Test integration end-to-end

**Time Estimate:** 8-10 hours

**Result:** Neuro now has enterprise-grade patterns stolen from best frameworks

