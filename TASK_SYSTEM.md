# Task System — 10-Hour Research with Crash Recovery

## Overview
The new Task System is designed for long-running research tasks (10+ hours) with automatic crash recovery, checkpoint-based resumption, and heartbeat monitoring.

## Architecture

### Core Components

#### 1. **taskExecutor.ts** - Crash Recovery Engine
**Purpose:** Manages task persistence, heartbeat monitoring, and crash recovery.

**Key Features:**
- **Heartbeat System:** 30-second monitoring interval, 2-minute timeout detection
- **Checkpoint System:** Save progress at each stage, resume from last checkpoint
- **Retry Logic:** Automatic retry on crash (max 5 retries per task)
- **Full Persistence:** All state stored in IndexedDB, survives process crashes
- **Progress Tracking:** 0-100% with phase descriptions

**Key Functions:**
```typescript
createTask(title, prompt, description, estimatedDuration)  // Create task
startTask(taskId)                                           // Begin execution
recordHeartbeat(taskId)                                     // Update last heartbeat
addCheckpoint(taskId, phase, progress, result)            // Save checkpoint
failTask(taskId, error)                                     // Handle error/retry
completeTask(taskId, result)                               // Mark done
```

**Task States:**
- `draft` - Created, not started
- `queued` - Ready to run or retrying after crash
- `running` - Currently executing
- `paused` - User paused, can resume
- `completed` - Finished successfully
- `error` - Exceeded max retries
- `archived` - Completed and archived

#### 2. **TaskManager.tsx** - Simple Task UI
**Purpose:** Todoist-style interface for task creation and execution.

**Features:**
- Quick task creation (title + optional description)
- Inline editing
- Progress visualization (with current phase)
- Pause/Resume controls
- Error display
- Completed tasks section
- Auto-refresh (5 seconds)

**Task Workflow:**
1. User creates task with title (e.g., "Research AI trends 2025")
2. Task stored as draft in IndexedDB
3. User clicks "Start" → task begins executing
4. Task runs through `runAgentLoop` with research tools available
5. Progress updates via checkpoints
6. If crash detected: system automatically marks for retry (queued status)
7. User can manually pause/resume
8. On completion or max retries, task marked as done/error

#### 3. **AppShell.tsx** - Navigation Integration
- Added Chat/Tasks toggle in main toolbar
- Renders TaskManager when Tasks view active
- Removed old TasksPage (calendar-focused)
- Maintains AppShell layout with sidebar

### How It Works

#### Task Execution Flow
```
User creates task → stored in IndexedDB
User clicks "Start"
  ↓
Task marked as "running"
  ↓
runAgentLoop executes task.prompt with research tools
  ↓
Every event updates heartbeat & checkpoint
  ↓
Heartbeat system monitors (30s intervals)
  ↓
If no heartbeat for 2 min → Task marked "queued" for retry
  ↓
On completion → marked "completed"
On error → marked "error" (if max retries exceeded)
```

#### Crash Recovery Flow
```
Task running → Agent crashes/browser closes
  ↓
Heartbeat system detects missing heartbeat (after 2 min)
  ↓
System checks failure count
  ↓
If failures < 5:
  - Increment failure count
  - Mark task as "queued"
  - Last checkpoint preserved
  ↓
If failures >= 5:
  - Mark task as "error"
  - User must manually review/debug
```

#### Resume Flow
```
User sees task in "paused" or "queued" status
  ↓
User clicks "Resume" button (or "Start" for queued)
  ↓
Get last checkpoint (phase, progress)
  ↓
Resume execution from that point
  ↓
Continue until completion or error
```

## Configuration

### Heartbeat Settings
- **Interval:** 30 seconds (check each running task)
- **Timeout:** 2 minutes (mark as crashed if no heartbeat)
- **Max Retries:** 5 per task
- **Checkpoint Limit:** Last 100 checkpoints per task

### Storage
- **Database:** IndexedDB (browser-native)
- **Database Name:** `neuro_tasks`
- **Store:** tasks (key: taskId, value: ExecutableTask)
- **Durability:** Survives browser restart, process crash, page reload

## Task Properties
```typescript
interface ExecutableTask {
  id: string                        // Unique task ID
  title: string                     // User-provided title
  description: string               // Optional description
  prompt: string                    // Task prompt/objective

  status: TaskStatus               // Current state
  progress: number                 // 0-100%
  currentPhase: string             // Current operation

  lastHeartbeat: number            // Last heartbeat timestamp
  checkpoints: TaskCheckpoint[]    // Progress checkpoints
  failureCount: number             // Crash/error count
  maxRetries: number               // Max retry attempts

  createdAt: number                // Creation timestamp
  startedAt?: number               // Execution start time
  completedAt?: number             // Completion time
  estimatedDuration?: number       // Minutes (for display)

  result?: string                  // Final result/output
  error?: string                   // Error message
}
```

## Using the Task System

### For Users
1. **Create Task:**
   - Click "Tasks" tab in toolbar
   - Enter task title (e.g., "Research quantum computing applications")
   - (Optional) Add description
   - Click "Create Task"

2. **Start Task:**
   - Click "Start" button on task
   - Task runs in background
   - Progress shown with percentage and current phase

3. **Monitor Progress:**
   - Progress bar updates every 5 seconds
   - Current phase displayed (e.g., "Running web_search")
   - Heartbeat recorded automatically

4. **Pause/Resume:**
   - Click "Pause" on running task
   - Task stops, current checkpoint saved
   - Click "Resume" to continue from checkpoint

5. **View Results:**
   - On completion, task marked "Done"
   - Click task to view full result
   - Results stored in task.result

### For Developers
```typescript
// Import task system
import {
  createTask, getTask, startTask, recordHeartbeat,
  addCheckpoint, completeTask, failTask, getAllTasks
} from '../utils/taskExecutor';

// Create task
const task = await createTask(
  'Research Title',
  'Full research prompt here',
  'Optional description',
  120 // estimated minutes
);

// Start execution
await startTask(task.id);

// Record progress
await addCheckpoint(task.id, 'Researching...', 25);
await recordHeartbeat(task.id);

// Handle completion
await completeTask(task.id, 'Final results...');

// Handle error
await failTask(task.id, 'Error message');
```

## Key Design Decisions

1. **No Presets:** Tasks are simple — just title and objective. No complex preset selection.
2. **Heartbeat Over Polling:** Server-agnostic heartbeat system (client-side via IndexedDB)
3. **Checkpoint-Based Recovery:** Resume from last known good state, not from scratch
4. **Automatic Retry:** Transparent recovery without user intervention (up to 5 times)
5. **Full UI Integration:** Tasks are first-class citizens in Neuro alongside Chat
6. **IndexedDB Persistence:** No network required for task state, full offline resilience

## Limitations & Future Work

**Current Limitations:**
- Task execution uses `runAgentLoop` (general agent executor)
- Long-running tasks may benefit from explicit stage milestone tracking
- Checkpoint data is basic (progress %, phase name, optional result)
- No distributed task execution (single browser/device per task)

**Future Improvements:**
- Deep research preset for complex investigations (10+ hours)
- Task scheduling (run at specific time)
- Batch task creation (multiple objectives)
- Export task results (PDF/JSON)
- Task analytics (time spent, tools used, iterations)
- Shared task templates
- Multi-device task sync

## Testing Checklist

- [ ] Create task, verify stored in IndexedDB
- [ ] Start task, see progress updates
- [ ] Pause task, checkpoint saved
- [ ] Resume task, continues from checkpoint
- [ ] Let task run 1+ hour unattended
- [ ] Simulate crash (close tab/browser during execution)
- [ ] Verify task retries automatically
- [ ] Complete task, verify result stored
- [ ] View task results after page refresh
- [ ] Completed section toggles correctly
- [ ] Edit task while in draft state
- [ ] Delete task with confirmation

## Troubleshooting

**Task stuck in "running" after crash:**
- Wait 2+ minutes for heartbeat timeout
- System will auto-retry (marked as "queued")
- If still stuck, check browser console for errors

**Progress not updating:**
- Verify heartbeat is being called by task executor
- Check IndexedDB (DevTools > Application > IndexedDB > neuro_tasks)
- Ensure no errors in task.onEvent callback

**Task not resuming from checkpoint:**
- Check that last checkpoint was saved (via addCheckpoint)
- Verify failureCount < maxRetries
- Check console for failTask errors

**Results lost after completion:**
- Results stored in task.result (checked in TaskManager.tsx)
- Verify completeTask() was called with result parameter
- Check IndexedDB for task record with status='completed'
