# Queued Prompts Feature — Complete Index

## Overview

A production-ready queued prompts system for executing sequential and parallel AI prompt workflows with advanced dependency management, error handling, and persistence.

**Status:** ✓ Ready for Integration
**Total Lines of Code:** ~2,200 implementation + 1,300+ documentation
**Dependencies:** Zero external (uses existing project utilities)

## File Structure

```
nomads/
├── src/
│   ├── types/
│   │   └── queuedPrompt.ts              (220 lines) - Type definitions
│   ├── utils/
│   │   ├── queuedPromptManager.ts       (380 lines) - State & storage
│   │   └── queuedPromptExecutor.ts      (320 lines) - Execution logic
│   ├── hooks/
│   │   └── useQueuedPrompts.ts          (280 lines) - React hook
│   └── components/
│       ├── QueuedPromptsPanel.tsx       (120 lines) - Main UI
│       ├── QueueBuilder.tsx             (180 lines) - Queue editor
│       ├── QueueItemEditor.tsx          (160 lines) - Item editor
│       ├── QueueExecutor.tsx            (200 lines) - Executor UI
│       ├── QueueHistory.tsx             (150 lines) - History viewer
│       └── TemplateManager.tsx          (200 lines) - Template manager
└── Documentation/
    ├── QUEUED_PROMPTS_INDEX.md          (This file)
    ├── QUEUED_PROMPTS_SUMMARY.md        Complete feature overview
    ├── QUEUED_PROMPTS_GUIDE.md          Full documentation & API reference
    ├── QUEUED_PROMPTS_QUICKSTART.md    5-minute setup guide
    ├── ARCHITECTURE_ANALYSIS.md         Design decisions & comparisons
    ├── INTEGRATION_EXAMPLES.md          6 complete working examples
    └── ARCHITECTURE_ANALYSIS.md         Paperclip comparison
```

## Quick Navigation

### Getting Started
- **START HERE:** [QUEUED_PROMPTS_QUICKSTART.md](./QUEUED_PROMPTS_QUICKSTART.md) — 5-minute setup
- **Overview:** [QUEUED_PROMPTS_SUMMARY.md](./QUEUED_PROMPTS_SUMMARY.md) — Feature summary
- **Full Guide:** [QUEUED_PROMPTS_GUIDE.md](./QUEUED_PROMPTS_GUIDE.md) — Complete documentation

### Reference
- **API Reference:** See section 9 in [QUEUED_PROMPTS_GUIDE.md](./QUEUED_PROMPTS_GUIDE.md)
- **Type Definitions:** [src/types/queuedPrompt.ts](./src/types/queuedPrompt.ts)
- **Architecture:** [ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)

### Learning & Integration
- **Examples:** [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md) — 6 working examples
- **Best Practices:** See section 8 in [QUEUED_PROMPTS_GUIDE.md](./QUEUED_PROMPTS_GUIDE.md)
- **Troubleshooting:** See section 10 in [QUEUED_PROMPTS_GUIDE.md](./QUEUED_PROMPTS_GUIDE.md)

## Key Features

### Core Functionality
- ✓ Sequential & parallel prompt execution
- ✓ Dependency resolution (DAG execution)
- ✓ Variable interpolation ({output_0}, {output_1})
- ✓ Error handling with retry & backoff
- ✓ Progress tracking & monitoring
- ✓ Output streaming integration
- ✓ Timeout management per item
- ✓ Template system for reusability

### UI Components
- ✓ Main control panel with tabs
- ✓ Queue builder with drag-to-reorder
- ✓ Live execution monitor
- ✓ Output viewer with expand/collapse
- ✓ History & analytics viewer
- ✓ Template manager

### Storage & Persistence
- ✓ IndexedDB for full persistence
- ✓ JSON import/export
- ✓ Execution history retention
- ✓ Survives page refresh

### Event System
- ✓ Publish/subscribe architecture
- ✓ Queue-level events
- ✓ Item-level events
- ✓ Progress updates
- ✓ Error notifications

## Component Map

```
useQueuedPrompts (Hook)
  ├── State Management
  │   ├── queues: PromptQueue[]
  │   ├── selectedQueue: PromptQueue
  │   └── templates: PromptTemplate[]
  │
  ├── Queue Operations
  │   ├── createQueue()
  │   ├── updateQueue()
  │   ├── deleteQueue()
  │   ├── cloneQueue()
  │   └── executeQueue()
  │
  └── Storage Operations
      ├── saveQueue()
      ├── loadQueue()
      ├── loadAllQueues()
      └── deleteQueue()

QueuedPromptsPanel (Main Container)
  ├── Header
  │   ├── Queue selector dropdown
  │   ├── Control buttons (Clone, Execute, Delete)
  │   └── New Queue button
  │
  └── Tabs
      ├── Builder Tab → QueueBuilder
      ├── Execute Tab → QueueExecutor
      ├── History Tab → QueueHistory
      └── Templates Tab → TemplateManager

QueueBuilder
  ├── Queue Settings Panel
  │   ├── Parallel Execution Limit
  │   ├── Retry on Failure Count
  │   └── Stop on Error Flag
  │
  └── Items List
      ├── Drag-to-reorder
      ├── Item Preview
      ├── Edit Button → QueueItemEditor
      └── Delete Button

QueueExecutor
  ├── Control Section
  │   ├── Execute Button
  │   ├── Cancel Button
  │   └── Status Indicator
  │
  └── Progress Section
      ├── Progress Bar
      ├── Statistics (completed/failed)
      └── Items List with Live Updates

QueueHistory
  └── Completed Queues
      ├── Success/Failure Status
      ├── Execution Time
      ├── Token Usage
      └── Item-level Results

TemplateManager
  ├── Template List by Category
  ├── New Template Form
  └── Template Details
      ├── Variables
      ├── Tags
      └── Usage Metrics
```

## Data Flow

### Execution Flow

```
User clicks "Execute Queue"
  ↓
Hook calls executeQueue(queueId)
  ↓
QueuedPromptExecutor.executeQueue()
  ├─ Mark queue as "executing"
  ├─ Loop: Get next executable items
  │   ├─ Resolve dependencies
  │   ├─ Respect parallelExecutionLimit
  │   └─ Execute in parallel:
  │       ├─ Resolve variables
  │       ├─ Call ollamaService.generateStream()
  │       ├─ Stream output to item.output
  │       └─ Record metrics
  │
  ├─ Emit events:
  │   ├─ item_started
  │   ├─ item_progress
  │   ├─ item_completed
  │   └─ item_error
  │
  └─ Mark queue as "completed"
    ├─ Emit queue_completed
    └─ Persist to IndexedDB

Hook receives events via subscription
  ↓
Update React state
  ↓
UI updates (components re-render)
```

### Storage Flow

```
QueuedPromptManager
  ├─ In-memory cache (Map)
  └─ IndexedDB persistence
      ├─ queued_prompts_v1: PromptQueue[]
      └─ prompt_templates_v1: PromptTemplate[]

Save Operations:
  1. User modifies queue
  2. Hook calls updateQueue()
  3. QueuedPromptManager.saveQueue()
  4. Persists to IndexedDB

Load Operations:
  1. Component mounts
  2. Hook calls useEffect
  3. QueuedPromptManager.loadAllQueues()
  4. Returns from IndexedDB
  5. Sets in React state

Event System:
  1. Manager.on(queueId, listener)
  2. When queue event emitted
  3. All listeners called
  4. UI updates via React state
```

## Integration Checklist

- [ ] Copy all files to your project
- [ ] Import useQueuedPrompts hook in components
- [ ] Add QueuedPromptsPanel to your layout
- [ ] Test with simple 1-item queue
- [ ] Test with multi-item sequential queue
- [ ] Test with parallel execution
- [ ] Test variable interpolation
- [ ] Test dependency resolution
- [ ] Integrate with campaign workflow
- [ ] Set up monitoring/logging
- [ ] Test error recovery
- [ ] Test persistence (page refresh)
- [ ] Load test with large queues
- [ ] Monitor token usage
- [ ] Deploy to production

## Configuration Options

### Queue Level
```typescript
queue.parallelExecutionLimit    // 1-10, default 1
queue.stopOnError               // true/false, default true
queue.retryOnFailure            // 0-5, default 0
queue.schedule.type             // 'immediate', 'scheduled', 'delayed'
```

### Item Level
```typescript
item.model                      // 'qwen3.5:4b', 'qwen3.5:9b', etc
item.temperature               // 0.0-2.0, default 0.7
item.maxTokens                 // 100-8000, default 2000
item.timeout                   // milliseconds, default 120000
item.delayMs                   // milliseconds before item
item.scheduledFor              // unix timestamp
item.dependsOnIds              // array of item IDs
```

## Performance Targets

- Single item execution: 2-10 seconds
- 10-item sequential queue: 30-60 seconds
- 10-item parallel (limit=3): 15-25 seconds
- Memory per queue: ~5-10KB overhead
- Memory per item: ~2-5KB
- Persistence latency: <100ms

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Queue not executing | items empty | Use addItemsToQueue() |
| Model not found | Wrong model name | Use correct: qwen3.5:4b |
| Slow execution | Parallel limit too low | Increase parallelExecutionLimit |
| Token overflow | maxTokens too high | Reduce maxTokens per item |
| Output lost | Not persisting | Call updateQueue() |
| Variables not replaced | Wrong format | Use {output_0}, {output_1} |
| Circular dependency | Dependency loop | Check dependencies form DAG |

## Next Steps

1. **Read Quick Start:** [QUEUED_PROMPTS_QUICKSTART.md](./QUEUED_PROMPTS_QUICKSTART.md)
2. **Copy Implementation Files** to your project
3. **Review Examples:** [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md)
4. **Test Locally** with a simple workflow
5. **Integrate** with your campaign system
6. **Monitor & Optimize** token usage and execution time

## Support Resources

- **Getting Started:** [QUEUED_PROMPTS_QUICKSTART.md](./QUEUED_PROMPTS_QUICKSTART.md)
- **Full API:** [QUEUED_PROMPTS_GUIDE.md](./QUEUED_PROMPTS_GUIDE.md) Section 9
- **Examples:** [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md)
- **Architecture:** [ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)
- **Troubleshooting:** [QUEUED_PROMPTS_GUIDE.md](./QUEUED_PROMPTS_GUIDE.md) Section 10

## Version Info

- **Created:** April 2026
- **Status:** Production Ready
- **TypeScript:** Strict mode
- **React:** 18.0+
- **Tailwind CSS:** v4
- **No External Dependencies:** Uses project's existing utilities

## License

Same as main Ad Agent project. See LICENSE file.

---

**Ready to start?** Jump to [QUEUED_PROMPTS_QUICKSTART.md](./QUEUED_PROMPTS_QUICKSTART.md)
