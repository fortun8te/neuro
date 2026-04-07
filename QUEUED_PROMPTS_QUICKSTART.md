# Queued Prompts — Quick Start Guide

Get up and running in 5 minutes.

## Step 1: Copy Files

```bash
# Copy all files to your project
cp src/types/queuedPrompt.ts your-project/src/types/
cp src/utils/queuedPromptManager.ts your-project/src/utils/
cp src/utils/queuedPromptExecutor.ts your-project/src/utils/
cp src/hooks/useQueuedPrompts.ts your-project/src/hooks/
cp src/components/Queue*.tsx your-project/src/components/
```

## Step 2: Add UI to Your App

```typescript
// In your main app component (e.g., Dashboard.tsx)

import QueuedPromptsPanel from '@/components/QueuedPromptsPanel';

export function Dashboard() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Your existing content */}

      {/* Add queued prompts panel */}
      <div className="col-span-1 bg-gray-900 rounded-lg">
        <QueuedPromptsPanel />
      </div>
    </div>
  );
}
```

## Step 3: Use in Your Components

```typescript
import { useQueuedPrompts } from '@/hooks/useQueuedPrompts';

function MyComponent() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const handleStartWorkflow = async () => {
    // 1. Create queue
    const queue = await createQueue('My Workflow');

    // 2. Add items
    await addItemsToQueue(queue.id, [
      {
        label: 'Step 1',
        prompt: 'Do something',
        model: 'qwen3.5:4b',
      },
      {
        label: 'Step 2',
        prompt: 'Based on step 1: {output_0}',
        model: 'qwen3.5:4b',
      },
    ]);

    // 3. Execute
    const result = await executeQueue(queue.id);
    console.log('Done!', result);
  };

  return <button onClick={handleStartWorkflow}>Start</button>;
}
```

## Step 4: Test It

1. Open your app
2. Click "New Queue" in the Queued Prompts panel
3. Click "Add Item" and create a prompt
4. Go to "Execute" tab
5. Click "Execute Queue"
6. Watch it run!

## Common Patterns

### Pattern 1: Sequential Prompts

```typescript
await addItemsToQueue(queue.id, [
  { label: 'Step 1', prompt: 'Analyze something' },
  { label: 'Step 2', prompt: 'Based on step 1: {output_0}' },
  { label: 'Step 3', prompt: 'Summarize: {output_1}' },
]);
```

### Pattern 2: Parallel with Dependencies

```typescript
const items = await addItemsToQueue(queue.id, [
  { label: 'Parallel 1', prompt: 'Task A' },
  { label: 'Parallel 2', prompt: 'Task B' },
  {
    label: 'Combine',
    prompt: 'Combine: {output_0} and {output_1}',
    dependsOnIds: [items[0].id, items[1].id],
  },
]);
```

### Pattern 3: With Error Handling

```typescript
const result = await executeQueue(queue.id, {
  onItemError: (item, error) => {
    console.error(`${item.label} failed:`, error);
  },
  onProgress: (progress) => {
    console.log(`${progress.percentage}% done`);
  },
});
```

### Pattern 4: Using Templates

```typescript
// Save template
const template = {
  id: 'tmpl_1',
  name: 'My Template',
  category: 'creative',
  prompt: 'Create content about: {topic}',
  variables: [
    { name: 'topic', type: 'text', required: true },
  ],
};
await saveTemplate(template);

// Use template
await addItemsToQueue(queue.id, [
  {
    templateId: template.id,
    templateVariables: { topic: 'AI' },
  },
]);
```

## API Cheat Sheet

```typescript
// Queue management
const queue = await createQueue('Name', 'Description');
await updateQueue(queue);
await deleteQueue(queue.id);
const cloned = await cloneQueue(queue.id);

// Items
await addItemsToQueue(queue.id, [{ prompt: '...' }]);
await removeQueueItem(queue.id, itemId);
await reorderQueue(queue.id, [id1, id2, id3]);

// Execution
await executeQueue(queue.id, { onProgress, onError });
cancelQueue(queue.id);

// Storage
const all = await loadAllQueues();
const one = await loadQueue(queueId);
const json = exportQueue(queue);
const imported = await importQueue(json);

// Templates
await saveTemplate(template);
const templates = await loadTemplates();
await deleteTemplate(templateId);

// Events
const unsub = QueuedPromptManager.on(queueId, (event) => {
  console.log(event.type); // queue_started, item_completed, etc
});
unsub(); // Unsubscribe
```

## Configuration

### Queue Settings
```typescript
const queue = await createQueue('My Queue');

// Allow parallel execution
queue.parallelExecutionLimit = 3;

// Retry failed items
queue.retryOnFailure = 2;

// Stop on first error
queue.stopOnError = true;

await updateQueue(queue);
```

### Item Settings
```typescript
const items = await addItemsToQueue(queue.id, [
  {
    label: 'My Item',
    prompt: 'The prompt',
    model: 'qwen3.5:4b',           // Model choice
    temperature: 0.7,              // 0.0-2.0
    maxTokens: 2000,              // Max output length
    timeout: 120000,              // 2 minutes
    delayMs: 5000,                // 5 second delay before
    systemMessage: 'You are...', // System prompt
  },
]);
```

## Monitoring

### Real-Time Progress
```typescript
await executeQueue(queue.id, {
  onProgress: (p) => {
    console.log(`${p.current}/${p.total} (${p.percentage}%)`);
  },
  onItemComplete: (item, output) => {
    console.log(`✓ ${item.label}`);
  },
  onItemError: (item, error) => {
    console.error(`✗ ${item.label}: ${error}`);
  },
  onQueueComplete: (queue) => {
    console.log(`Done in ${queue.totalDuration}ms`);
  },
});
```

### Check Status
```typescript
const status = QueuedPromptExecutor.getExecutionStatus(queue);
console.log(status.isExecuting);      // true/false
console.log(status.progress);         // 0.0-1.0
console.log(status.successCount);     // Number
console.log(status.failureCount);     // Number
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Queue not found" | Make sure you saved queue with `await updateQueue()` |
| Items not executing | Check queue.items.length > 0 and queue status |
| Slow execution | Increase parallelExecutionLimit |
| High token usage | Reduce maxTokens per item |
| Output truncated | Increase maxTokens or reduce prompt complexity |
| Model not found | Check model name is correct (qwen3.5:4b, etc) |

## Examples

### Example 1: Simple 3-Step Workflow

```typescript
async function simpleWorkflow() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const queue = await createQueue('Simple Workflow');

  await addItemsToQueue(queue.id, [
    {
      label: 'Brainstorm',
      prompt: 'Generate 5 ideas for a mobile app',
    },
    {
      label: 'Evaluate',
      prompt: 'Rate these ideas: {output_0}',
    },
    {
      label: 'Refine',
      prompt: 'Improve the top idea: {output_1}',
    },
  ]);

  const result = await executeQueue(queue.id);
  return result;
}
```

### Example 2: Parallel Analysis

```typescript
async function parallelAnalysis() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const queue = await createQueue('Parallel Analysis');
  queue.parallelExecutionLimit = 2; // Run 2 items at once

  const items = await addItemsToQueue(queue.id, [
    {
      label: 'Market Research',
      prompt: 'Research market trends',
    },
    {
      label: 'Competitor Analysis',
      prompt: 'Analyze top 3 competitors',
    },
    {
      label: 'Strategy',
      prompt: 'Create strategy based on: {output_0} and {output_1}',
      dependsOnIds: [items[0].id, items[1].id],
    },
  ]);

  await updateQueue(queue);
  return await executeQueue(queue.id);
}
```

### Example 3: With Error Recovery

```typescript
async function robustWorkflow() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const queue = await createQueue('Robust Workflow');
  queue.retryOnFailure = 2;      // Retry 2 times
  queue.stopOnError = false;      // Continue if item fails

  await addItemsToQueue(queue.id, [
    { label: 'Item 1', prompt: 'Task 1' },
    { label: 'Item 2', prompt: 'Task 2' },
    { label: 'Item 3', prompt: 'Task 3' },
  ]);

  try {
    const result = await executeQueue(queue.id, {
      onItemError: (item, error) => {
        // Item failed, but queue continues due to stopOnError=false
        console.log(`${item.label} failed but continuing...`);
      },
    });

    // Check which items actually succeeded
    result.items.forEach((item) => {
      console.log(`${item.label}: ${item.status}`);
    });

    return result;
  } catch (error) {
    console.error('Queue completely failed:', error);
  }
}
```

## Next Steps

1. Copy files
2. Add UI to app
3. Create a test queue
4. Read `QUEUED_PROMPTS_GUIDE.md` for full features
5. Check `INTEGRATION_EXAMPLES.md` for patterns
6. Integrate with your campaign workflow

## Need Help?

- **API Questions:** See `QUEUED_PROMPTS_GUIDE.md`
- **Architecture Questions:** See `ARCHITECTURE_ANALYSIS.md`
- **Integration Examples:** See `INTEGRATION_EXAMPLES.md`
- **Troubleshooting:** See "Troubleshooting" section in guide

## Tips

- Always call `await updateQueue(queue)` after modifying queue settings
- Use labels to identify items in UI ("Research Phase", "Creative Step", etc)
- Set appropriate `maxTokens` for your use case (2000 is good default)
- Monitor `queue.totalTokensUsed` for cost tracking
- Use templates to avoid repeating the same prompts
- Test with small queues first (1-3 items)
- Check Ollama is running before executing

---

**You're ready!** Start building your queued workflows.
