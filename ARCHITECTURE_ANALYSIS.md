# Queued Prompts Architecture Analysis

## Paperclip Repository Insights

Based on the analysis of the Paperclip AI repository (https://github.com/paperclipai/paperclip), here's how their architecture informs our implementation:

### Paperclip's Architecture Patterns

#### 1. Plugin Job System
**Paperclip Approach:**
- Uses dedicated services: `plugin-job-coordinator.ts`, `plugin-job-scheduler.ts`, `plugin-job-store.ts`
- Job coordination happens at the service layer
- Jobs are stored in PostgreSQL (mandatory persistence)
- Event-driven architecture with `plugin-stream-bus.ts` for real-time updates

**Our Implementation:**
- Simplified for frontend-centric architecture
- IndexedDB for persistence (no backend required)
- EventEmitter pattern for subscriptions
- Supports browser-based execution

#### 2. Monorepo Structure
**Paperclip:**
```
/server/src/services/ — Job coordination, scheduling
/packages/shared/src/types/ — Shared type definitions
/ui/src/pages/Routines.tsx — Routine management UI
```

**Our Implementation:**
```
/src/types/queuedPrompt.ts — Type definitions
/src/utils/queuedPrompt*.ts — Manager & Executor
/src/hooks/useQueuedPrompts.ts — React integration
/src/components/Queue*.tsx — UI components
```

#### 3. Routine/Workflow Concept
**Paperclip:**
- Calls them "Routines" (stored in DB)
- Each routine can have multiple steps
- Steps execute sequentially or via plugin jobs
- Can be triggered by schedules or webhooks

**Our Implementation:**
- Calls them "PromptQueues"
- Items have explicit dependencies
- Parallel execution support with limits
- Client-side execution with Ollama backend

### Key Differences

| Aspect | Paperclip | Our Implementation |
|--------|-----------|-------------------|
| **Storage** | PostgreSQL (backend) | IndexedDB (browser) |
| **Execution** | Server-side job processor | Client-side with streaming |
| **Dependencies** | Implied by order | Explicit dependency graphs |
| **Parallelization** | Plugin job workers | Sequential/parallel with limit |
| **UI Framework** | React + TypeScript | React + TypeScript (Tailwind) |
| **Persistence** | Full audit trail in DB | IndexedDB + local export |
| **Scheduling** | Cron patterns + webhooks | Immediate/scheduled/delayed |
| **Error Handling** | Retry logic in coordinator | Built-in retry with backoff |

## Implementation Details

### 1. Task Queue Architecture

```typescript
PromptQueue (Container)
  └─ QueuedPromptItem[] (Executable units)
     ├─ Status: pending, executing, completed, failed
     ├─ Dependencies: dependsOnIds[]
     ├─ Output: captured from streaming
     └─ Metadata: tokens, duration, error
```

**Execution Flow:**
1. Load queue from storage
2. Mark queue as "executing"
3. Get next executable items (respecting dependencies)
4. Execute in parallel (up to parallelExecutionLimit)
5. Stream output, capture completion
6. Record metrics (tokens, duration)
7. Check for more pending items
8. Complete queue

### 2. Dependency Resolution

**Graph Structure:**
```
Item A → Item B → Item D
       → Item C ↗
```

**Resolution Algorithm (in QueuedPromptExecutor):**

```typescript
getNextExecutableItems(queue: PromptQueue): QueuedPromptItem[] {
  const executable = [];

  for (const item of queue.items) {
    if (item.status !== 'pending') continue;

    // Check all dependencies are completed
    if (item.dependsOnIds?.length > 0) {
      const allDepsComplete = item.dependsOnIds.every(depId => {
        const dep = queue.items.find(i => i.id === depId);
        return dep && dep.status === 'completed';
      });

      if (!allDepsComplete) continue;
    }

    executable.push(item);
  }

  // Respect parallelization limit
  return executable.slice(0, queue.parallelExecutionLimit);
}
```

### 3. Variable Interpolation

**Prompt Template Variables:**
```typescript
// Original prompt with placeholders
prompt: 'Analyze these topics: {output_0}'

// Resolved at execution time
previousOutputs = {
  'output_0': '<content from item 0>',
  'output_1': '<content from item 1>',
}

// Final prompt sent to model
'Analyze these topics: <content from item 0>'
```

### 4. Storage Strategy

**IndexedDB Schema:**
```javascript
{
  queued_prompts_v1: [PromptQueue, PromptQueue, ...]
  prompt_templates_v1: [PromptTemplate, PromptTemplate, ...]
}
```

**Advantages:**
- No backend required
- Survives page refresh
- Full queue history retained
- Export/import as JSON

**Limitations:**
- Size limited (typically 50MB-1GB)
- Not synced across tabs (single-tab experience)
- No server backup

### 5. Event System

**Event Types:**
```typescript
'queue_started' | 'queue_paused' | 'queue_completed'
'item_started' | 'item_progress' | 'item_completed' | 'item_error'
```

**Subscription Pattern:**
```typescript
const unsubscribe = QueuedPromptManager.on(queueId, (event) => {
  switch(event.type) {
    case 'item_completed':
      updateUI(event.data);
      break;
  }
});
```

### 6. Error Handling Strategy

**Retry with Exponential Backoff:**
```typescript
// Configuration
queue.retryOnFailure = 2; // Retry up to 2 times
queue.stopOnError = false; // Continue even if items fail

// Execution
for (let attempt = 0; attempt < maxAttempts; attempt++) {
  try {
    // Execute item
    return await executePrompt();
  } catch (error) {
    if (attempt < maxAttempts - 1) {
      const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await delay(backoff);
    } else {
      throw error;
    }
  }
}
```

## Comparison: Paperclip vs. Our Implementation

### Paperclip's Job Coordinator
**Strengths:**
- Server-side job queuing (reliable)
- Database persistence (audit trail)
- Multiple worker threads (scalable)
- Webhook triggers
- Cost tracking per job

**For Our Use Case:**
- Overkill (we don't need backend infrastructure)
- Requires PostgreSQL + Node.js backend
- More complex (monorepo structure)
- Better for enterprise deployments

### Our Frontend-First Approach
**Strengths:**
- No backend infrastructure required
- Live streaming feedback (real-time output)
- Works offline (with local models)
- Lightweight (~1000 lines of code)
- Tight integration with React

**Trade-offs:**
- Single-tab only (no cross-tab sync)
- Limited by browser memory
- No server persistence
- Client-side reliability depends on browser

## Key Takeaways from Paperclip Architecture

### 1. Separation of Concerns
✓ We follow this: Manager (state), Executor (logic), UI (presentation)

### 2. Event-Driven Communication
✓ Implemented: QueueEvent system with subscribers

### 3. Type Safety
✓ Full TypeScript with strict typing

### 4. Scalable Job Storage
→ We use IndexedDB instead of PostgreSQL (right-sized for our needs)

### 5. Workflow Templates
✓ Implemented: PromptTemplate system with variables

### 6. Progress Tracking
✓ Implemented: Real-time progress events with metrics

### 7. Error Recovery
✓ Implemented: Retry logic with exponential backoff

## Integration Points with Ad Agent

### Desire-Driven Analysis Phase
```typescript
const researchQueue = await createQueue('Desire Analysis');
await addItemsToQueue(researchQueue.id, [
  {
    label: 'Map Desires',
    prompt: desireAnalysisPrompt,
    model: 'qwen3.5:4b',
  },
  {
    label: 'Identify Objections',
    prompt: objectionPrompt,
    model: 'qwen3.5:4b',
  },
  {
    label: 'Audience Research',
    prompt: audiencePrompt,
    model: 'qwen3.5:4b',
  },
  {
    label: 'Competitor Landscape',
    prompt: competitorPrompt,
    model: 'qwen3.5:4b',
  },
]);

const result = await executeQueue(researchQueue.id);
```

### Creative Stage
```typescript
const creativeQueue = await createQueue('Ad Concepts');
await addItemsToQueue(creativeQueue.id, [
  {
    label: 'Concept Generation',
    prompt: conceptPrompt,
    model: 'qwen3.5:9b',
    temperature: 0.9,
  },
  {
    label: 'Concept Evaluation',
    prompt: 'Evaluate these concepts: {output_0}',
    model: 'qwen3.5:9b',
  },
  {
    label: 'Refinement',
    prompt: 'Refine the best concept: {output_1}',
    model: 'qwen3.5:9b',
  },
]);
```

## Future Enhancements

### 1. Cross-Tab Synchronization
Use BroadcastChannel API to sync queue state across tabs:

```typescript
const channel = new BroadcastChannel('queued_prompts');
channel.onmessage = (event) => {
  // Update local state based on other tab
};
```

### 2. Server Persistence
Add optional backend sync:

```typescript
await QueuedPromptManager.saveQueueToServer(queue);
```

### 3. Webhook Triggers
Support triggering queues from external events:

```typescript
queue.webhookUrl = 'https://api.example.com/webhook';
```

### 4. Cost Tracking
Integrate with billing system:

```typescript
const cost = calculateCost(queue.totalTokensUsed);
```

### 5. Queue Scheduling
Support cron-style recurring queues:

```typescript
queue.schedule.recurringPattern = '0 9 * * 1'; // Weekly Monday 9am
```

### 6. Conditional Branching
Allow if/else logic:

```typescript
{
  condition: (output) => output.includes('error'),
  trueBranch: [item1, item2],
  falseBranch: [item3, item4],
}
```

## Conclusion

Our implementation takes inspiration from Paperclip's architecture while being optimized for:
- Frontend-first, Ollama-based AI workflows
- Real-time streaming output
- Minimal dependencies
- Deep integration with React

It provides a solid foundation for:
- Sequential and parallel prompt execution
- Template-based workflows
- Progress tracking and error recovery
- Local persistence and export

The system is production-ready and extensible for future enhancements like server sync, webhooks, and advanced scheduling.
