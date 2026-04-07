# Queued Prompts Feature Guide

## Overview

The Queued Prompts system allows you to create, manage, and execute sequences of AI prompts with advanced features including:

- Sequential and parallel execution with dependency management
- Prompt templates for reusable workflows
- Progress tracking and live execution monitoring
- Retry logic and error handling
- Import/export for queue persistence
- Full execution history and analytics

## Architecture

### Core Files

**Type Definitions:**
- `/src/types/queuedPrompt.ts` — Complete TypeScript type definitions

**Management:**
- `/src/utils/queuedPromptManager.ts` — Queue CRUD, storage, and state management
- `/src/utils/queuedPromptExecutor.ts` — Execution engine with dependency resolution

**React Integration:**
- `/src/hooks/useQueuedPrompts.ts` — Custom hook for queue management
- `/src/components/QueuedPromptsPanel.tsx` — Main UI container
- `/src/components/QueueBuilder.tsx` — Queue creation and editing
- `/src/components/QueueItemEditor.tsx` — Individual item configuration
- `/src/components/QueueExecutor.tsx` — Execution monitoring
- `/src/components/QueueHistory.tsx` — Historical queue results
- `/src/components/TemplateManager.tsx` — Template CRUD

### Data Models

#### PromptQueue
Represents a complete queue of prompts:

```typescript
{
  id: string;                           // Unique queue ID
  name: string;                         // User-friendly name
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'paused';
  items: QueuedPromptItem[];           // Ordered list of prompts
  currentItemIndex: number;             // Currently executing item
  schedule: {
    type: 'immediate' | 'scheduled' | 'delayed';
    startTime?: number;                 // Unix timestamp
  };
  parallelExecutionLimit: number;       // Max concurrent items
  stopOnError: boolean;                 // Stop queue on first error
  retryOnFailure: number;               // Retry attempts per item
  successCount: number;                 // Completed successfully
  failureCount: number;                 // Failed items
  totalDuration?: number;               // Total execution time
  totalTokensUsed?: number;             // Aggregate token usage
}
```

#### QueuedPromptItem
Individual prompt within a queue:

```typescript
{
  id: string;                           // Unique item ID
  queueId: string;                      // Parent queue
  sequenceNumber: number;               // 0-indexed position
  status: 'pending' | 'executing' | 'completed' | 'failed';

  prompt: string;                       // Prompt text (supports variables)
  templateId?: string;                  // Reference to saved template
  model: string;                        // Model to use
  temperature?: number;                 // 0.0-2.0
  maxTokens?: number;

  dependsOnIds?: string[];              // Items that must complete first
  outputReference?: string;             // Reference previous output

  scheduledFor?: number;                // Unix timestamp for scheduled execution
  delayMs?: number;                     // Delay after previous completion
  timeout?: number;                     // Execution timeout

  output?: string;                      // Generated output
  error?: string;                       // Error message if failed
  tokensUsed?: number;
  duration?: number;                    // Execution time in ms
  executedAt?: number;
  completedAt?: number;
}
```

#### PromptTemplate
Reusable prompt template:

```typescript
{
  id: string;
  name: string;
  description: string;
  category: 'research' | 'creative' | 'analysis' | 'custom';
  prompt: string;                       // Can contain {variable_name}
  variables: PromptVariable[];          // Variable definitions
  tags: string[];
  isPublic: boolean;
  usageCount: number;                   // Track usage
  createdAt: number;
  updatedAt: number;
}
```

## Usage Examples

### Example 1: Create and Execute a Simple Queue

```typescript
import { useQueuedPrompts } from './hooks/useQueuedPrompts';

function MyComponent() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const handleCreateWorkflow = async () => {
    // Create queue
    const queue = await createQueue(
      'Market Research Flow',
      'Research competitors and market trends',
    );

    // Add items
    await addItemsToQueue(queue.id, [
      {
        label: 'Research Step 1',
        prompt: 'Analyze top 5 competitors in the SaaS market',
        model: 'qwen3.5:4b',
      },
      {
        label: 'Research Step 2',
        prompt: 'Based on the analysis above, identify market gaps: {output_0}',
        model: 'qwen3.5:4b',
      },
      {
        label: 'Creative Step',
        prompt: 'Generate 3 innovative product ideas that address these gaps: {output_1}',
        model: 'qwen3.5:9b',
        temperature: 0.9,
      },
    ]);

    // Execute
    await executeQueue(queue.id);
  };

  return <button onClick={handleCreateWorkflow}>Start Research Flow</button>;
}
```

### Example 2: Queue with Dependencies

```typescript
const queue = await createQueue('Parallel Analysis');

const item1 = await addItemsToQueue(queue.id, [
  {
    label: 'Market Research',
    prompt: 'Research market trends',
  },
])[0];

const item2 = await addItemsToQueue(queue.id, [
  {
    label: 'Competitive Analysis',
    prompt: 'Analyze competitors',
  },
])[0];

const item3 = await addItemsToQueue(queue.id, [
  {
    label: 'Strategy',
    prompt: 'Combine insights: Market={output_0}, Competitors={output_1}',
    dependsOnIds: [item1.id, item2.id], // Waits for both to complete
  },
])[0];

// Items 1 & 2 execute in parallel, then item 3 runs
await executeQueue(queue.id);
```

### Example 3: Using Templates

```typescript
const { saveTemplate, loadTemplates } = useQueuedPrompts();

// Create a reusable template
const template = {
  id: 'template_research_brief',
  name: 'Research Brief Template',
  category: 'research',
  prompt: 'Research {topic} and create a brief covering: {scope}',
  variables: [
    {
      id: 'topic',
      name: 'topic',
      type: 'text',
      placeholder: 'Enter topic',
      required: true,
    },
    {
      id: 'scope',
      name: 'scope',
      type: 'textarea',
      placeholder: 'What should the brief cover?',
      required: true,
    },
  ],
};

await saveTemplate(template);

// Use template in a queue
await addItemsToQueue(queue.id, [
  {
    templateId: template.id,
    templateVariables: {
      topic: 'AI in Marketing',
      scope: 'Applications, benefits, challenges',
    },
  },
]);
```

### Example 4: Error Handling and Retries

```typescript
const queue = await createQueue('Resilient Workflow');

// Configure retry and error handling
queue.retryOnFailure = 2; // Retry failed items twice
queue.stopOnError = false; // Continue even if items fail

await updateQueue(queue);

// Execute with error callbacks
await executeQueue(queue.id, {
  onItemError: (item, error) => {
    console.error(`Item ${item.id} failed: ${error}`);
    // Notify user, log to analytics, etc.
  },
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  },
});
```

## Features

### 1. Queue Management

**Create Queue:**
```typescript
const queue = await createQueue('My Queue', 'Description');
```

**Add Items:**
```typescript
await addItemsToQueue(queue.id, [
  { prompt: 'First prompt', model: 'qwen3.5:4b' },
  { prompt: 'Second prompt', model: 'qwen3.5:4b' },
]);
```

**Reorder Items:**
```typescript
await reorderQueue(queue.id, ['item_2_id', 'item_1_id', 'item_3_id']);
```

**Clone Queue:**
```typescript
const cloned = await cloneQueue(queue.id, 'My Queue Copy');
```

### 2. Execution Control

**Execute:**
```typescript
const result = await executeQueue(queue.id);
```

**Cancel:**
```typescript
cancelQueue(queue.id);
```

**Progress Monitoring:**
```typescript
await executeQueue(queue.id, {
  onProgress: (progress) => {
    console.log(`${progress.current}/${progress.total} (${progress.percentage}%)`);
  },
  onItemComplete: (item, output) => {
    console.log('Item completed:', output);
  },
  onItemError: (item, error) => {
    console.error('Item error:', error);
  },
  onQueueComplete: (queue) => {
    console.log('Queue finished:', queue.totalDuration);
  },
});
```

### 3. Variable Interpolation

Reference previous outputs in prompts:

```typescript
await addItemsToQueue(queue.id, [
  {
    label: 'Step 1',
    prompt: 'Generate a list of topics',
  },
  {
    label: 'Step 2',
    prompt: 'Expand on these topics: {output_0}',
  },
  {
    label: 'Step 3',
    prompt: 'Synthesize summary: {output_1}',
  },
]);
```

### 4. Dependency Management

```typescript
// Item C only runs after items A and B complete
const itemC = {
  prompt: 'Combine results from A and B',
  dependsOnIds: [itemA.id, itemB.id],
};
```

### 5. Scheduling and Delays

```typescript
const item = {
  prompt: 'Run this later',
  scheduledFor: Date.now() + 60000, // Run in 60 seconds
};

// Or delay after previous item
const item2 = {
  prompt: 'Run after 5 second delay',
  delayMs: 5000,
};
```

### 6. Storage & Persistence

Queues are automatically persisted to IndexedDB:

```typescript
// Load all queues
const allQueues = await QueuedPromptManager.loadAllQueues();

// Load specific queue
const queue = await QueuedPromptManager.loadQueue(queueId);

// Delete queue
await QueuedPromptManager.deleteQueue(queueId);
```

### 7. Import/Export

```typescript
// Export queue as JSON
const json = QueuedPromptManager.exportQueue(queue);

// Share/backup
const backup = JSON.stringify(json);

// Import from JSON
const restored = await importQueue(backup);
```

## UI Components

### QueuedPromptsPanel
Main container component with tabs for:
- **Builder** — Create and edit queues
- **Execute** — Run queues and monitor progress
- **History** — View completed queues
- **Templates** — Manage prompt templates

### QueueBuilder
- Add/remove items
- Drag-to-reorder
- Queue configuration (parallel limit, retry, error handling)

### QueueExecutor
- Start/cancel execution
- Live progress bar
- Real-time item status updates
- Output preview

### QueueHistory
- View completed/failed queues
- Success rates and timing
- Token usage analytics
- Item-level results

### TemplateManager
- Save reusable templates
- Organize by category (research, creative, analysis, custom)
- Track usage

## Best Practices

### 1. Prompt Design

Use descriptive labels and organize logically:

```typescript
{
  label: 'Market Size Analysis',
  prompt: 'Calculate the TAM for our target market',
}
```

### 2. Error Recovery

Always set retry policies:

```typescript
queue.retryOnFailure = 2;
queue.stopOnError = false;
```

### 3. Resource Management

Limit parallel execution based on model capacity:

```typescript
queue.parallelExecutionLimit = 3; // Don't overwhelm the backend
```

### 4. Monitoring

Always subscribe to progress events:

```typescript
await executeQueue(queue.id, {
  onProgress: (p) => updateUI(p),
  onItemError: (item, error) => logError(item, error),
});
```

### 5. Template Reuse

Create templates for common workflows:

```typescript
const template = {
  name: 'Content Expansion',
  category: 'creative',
  prompt: 'Expand this outline: {outline}',
  variables: [
    { name: 'outline', type: 'textarea', required: true },
  ],
};
```

## Performance Considerations

### Token Usage

Monitor token consumption:

```typescript
queue.items.forEach((item) => {
  console.log(`${item.label}: ${item.tokensUsed} tokens`);
});

console.log(`Total: ${queue.totalTokensUsed}`);
```

### Execution Time

Optimize with parallel execution:

```typescript
// Instead of sequential (3x slow):
queue.parallelExecutionLimit = 1;

// Use parallel where dependencies allow:
queue.parallelExecutionLimit = 3;
```

### Model Selection

Choose appropriate models:

```typescript
- 0.8b/2b: Fast, lightweight analysis
- 4b: Default, good balance
- 9b: Higher quality, creative work
- 27b: Maximum quality, expensive
```

## Integration with Ad Agent

### Research Queues

```typescript
const researchQueue = await createQueue('Market Research');
await addItemsToQueue(researchQueue.id, [
  {
    label: 'Desire Analysis',
    prompt: 'Analyze customer desires for [product]',
  },
  {
    label: 'Objections',
    prompt: 'Identify purchase objections based on: {output_0}',
  },
  {
    label: 'Audience Insights',
    prompt: 'Profile target audience based on: {output_0}, {output_1}',
  },
]);
```

### Creative Queues

```typescript
const creativeQueue = await createQueue('Ad Copy Generation');
await addItemsToQueue(creativeQueue.id, [
  {
    label: 'Generate 3 concepts',
    prompt: 'Create 3 ad concepts addressing: {desire}',
    model: 'qwen3.5:9b',
    temperature: 0.9,
  },
  {
    label: 'Evaluate concepts',
    prompt: 'Rate these concepts: {output_0}',
    model: 'qwen3.5:9b',
  },
  {
    label: 'Polish winner',
    prompt: 'Refine the best concept: {output_1}',
    model: 'qwen3.5:9b',
  },
]);
```

## Troubleshooting

### Queue Not Executing

- Check queue.items.length > 0
- Verify model names are valid
- Check abortSignal not already aborted
- Look for network errors to Ollama

### Items Stuck in 'Pending'

- Check dependency IDs are valid
- Verify no circular dependencies
- Check queue.status is 'executing'

### High Token Usage

- Reduce maxTokens per item
- Use smaller models where appropriate
- Consider compressing lengthy prompts

### Slow Execution

- Increase parallelExecutionLimit
- Use faster models (0.8b/2b)
- Break long prompts into smaller steps
- Consider batch operations

## API Reference

### QueuedPromptManager

Static methods for queue persistence and storage:

- `createQueue(name, description?, items?)` → PromptQueue
- `addItemsToQueue(queue, items)` → QueuedPromptItem[]
- `removeItemFromQueue(queue, itemId)` → void
- `reorderQueue(queue, itemIds)` → void
- `cloneQueue(queue, newName?)` → PromptQueue
- `saveQueue(queue)` → Promise<void>
- `loadQueue(queueId)` → Promise<PromptQueue | null>
- `loadAllQueues()` → Promise<PromptQueue[]>
- `deleteQueue(queueId)` → Promise<void>
- `exportQueue(queue)` → string
- `importQueue(json)` → PromptQueue
- `on(queueId, listener)` → () => void (unsubscribe)

### QueuedPromptExecutor

Static methods for queue execution:

- `executeQueue(queue, options?)` → Promise<PromptQueue>
- `cancelQueue(queueId)` → void
- `getExecutionStatus(queue)` → ExecutionStatus

### useQueuedPrompts Hook

React hook with full queue management:

Returns object with:
- State: queues, selectedQueue, templates, isLoading, error
- Queue ops: createQueue, updateQueue, deleteQueue, executeQueue
- Item ops: addItemsToQueue, removeQueueItem, reorderQueue
- Template ops: saveTemplate, deleteTemplate
- Import/export: exportQueue, importQueue

## License

Part of the Ad Agent project. See main LICENSE file.
