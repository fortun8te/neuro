# CLI Task System — Terminal-First Research

## Quick Start

```bash
# 1. Start CLI
npm run cli

# 2. Create a task
/task create "Research quantum computing trends 2025"

# 3. List tasks (get the task ID)
/task list

# 4. Start the task
/task start <task-id>

# 5. Monitor with Ctrl+C to pause
#    Use /task resume <task-id> to continue
```

## Commands

### Create Task
```
/task create "Title" [description]

Example:
/task create "Deep research on AI trends 2025" "Focus on language models and multimodal AI"
```
- Creates a task with title and optional description
- Task starts in "draft" status
- Returns task ID for later reference

### List Tasks
```
/task list
```
- Shows all active tasks with status and progress
- Shows completed and errored tasks separately
- Quick view of what's running, paused, or completed

### View Task Details
```
/task view <task-id>

Example:
/task view task_1708329450123_xyz123
```
- Full task information including:
  - Status and progress percentage
  - Current phase (what it's working on)
  - Created/started/completed timestamps
  - Duration
  - Failure count
  - Error messages
  - Result preview

### Start Task
```
/task start <task-id>

Example:
/task start task_1708329450123_xyz123
```
- **Executes the task** with full crash recovery
- Task runs through agent with research tools available
- Progress updates in real-time
- Press **Ctrl+C** to pause (preserves checkpoint)
- Runs until completion or error (max 5 auto-retries)

### Pause Task
```
/task pause <task-id>
```
- Pauses a running task immediately
- Saves current checkpoint
- Task status becomes "paused"
- Can resume later from same point

### Resume Task
```
/task resume <task-id>

Example:
/task resume task_1708329450123_xyz123
```
- Continues paused or failed task
- Resumes from last checkpoint
- Shows which checkpoint it's resuming from
- Press Ctrl+C again to pause

### Delete Task
```
/task delete <task-id>
```
- Deletes task from IndexedDB
- Prompts for confirmation
- Cannot be undone

## How It Works

### Task Lifecycle
```
CREATE        → [draft] task stored in IndexedDB
                ↓
START         → [running] task executes via agent
   ↓
   Checkpoint every tool call / progress event
   Heartbeat recorded every 10 seconds
   ↓
User presses Ctrl+C  → [paused] state saved, checkpoint preserved
                       Can resume from exact point
   ↓
RESUME        → [running] continue from checkpoint
                ↓
COMPLETE      → [completed] result stored
   OR
MAX RETRIES   → [error] requires manual review
```

### Crash Recovery
If the task crashes (browser closes, network fails, etc.):
1. **Heartbeat system** monitors every 10 seconds
2. **Timeout detection** after 2 minutes without heartbeat
3. **Automatic retry**: Task marked as "queued", checkpoint preserved
4. **Manual resume**: User runs `/task resume <id>` to continue
5. **Max 5 retries** then task marked as "error"

### Long-Running Tasks (10+ hours)
- Task execution fully persisted to IndexedDB
- Heartbeat system continuously monitors
- Survives browser restart, system reboot, network interruption
- Run once, walk away, come back tomorrow
- Progress saved at every step
- Resume from exact point of interruption

## Examples

### Research Task
```bash
npm run cli
/task create "Market research: AI safety solutions 2025" "Find market size, key players, growth trends"
/task list
/task start task_1708329450123_abc123
# ... task runs for hours, gathering research
# Press Ctrl+C to pause when needed
/task resume task_1708329450123_abc123
# ... continues from where it stopped
```

### Long-Running Research
```bash
# Morning: Start a 10-hour research task
/task create "Comprehensive analysis of quantum computing applications"
/task start task_1708329450123_def456

# System closes browser, network hiccup, power cycle — doesn't matter
# Recovery is automatic via heartbeat

# Next day: Resume
npm run cli
/task list
# Task shows as "queued" ready for retry
/task resume task_1708329450123_def456
# Continues exactly where it left off
```

### Batch Research
```bash
/task create "Research 1: AI trends"
/task create "Research 2: Quantum computing"
/task create "Research 3: Biotech innovations"

/task list
# Shows all 3 tasks

/task start task_1_id
# Let it run, Ctrl+C to pause

/task start task_2_id
# Start another task
# (Note: Only one task runs at a time in single CLI session)
```

## Status Meanings

| Status | Meaning |
|--------|---------|
| `draft` | Created, not started |
| `queued` | Ready to run or retrying after auto-recovery |
| `running` | Currently executing |
| `paused` | User paused, can resume |
| `completed` | Finished successfully |
| `error` | Exceeded max retries (5) |
| `archived` | Old completed tasks |

## Keyboard Shortcuts

| Keys | Action |
|------|--------|
| Ctrl+C | Pause running task (safe, saves checkpoint) |
| Ctrl+D | Exit CLI (if no task running) |

## Tips & Tricks

### View Long Results
```bash
# If result is too long to see in terminal:
/task view <id>
# Scroll up in terminal to see full result
```

### Check Progress
```bash
# While task is running in another terminal:
npm run cli
/task view <id>
# Shows current progress and phase
```

### Resume Failed Task
```bash
# Task hit max retries (5 failures)
/task view <id>  # shows error message
# Fix the issue (e.g., restart Ollama)
/task resume <id>
# Reset happens automatically on next start
```

### Compare Research Results
```bash
/task create "Research approach A" "Method 1"
/task start task_1_id
# Wait for completion

/task create "Research approach B" "Method 2"
/task start task_2_id
# Wait for completion

/task view task_1_id  # Compare results
/task view task_2_id
```

## Troubleshooting

### Task stuck in "running"
**Cause:** Task crashed or connection lost
**Fix:**
- Wait 2+ minutes (heartbeat timeout)
- Task auto-marks as "queued"
- Run `/task resume <id>` to continue

### Can't start task
**Cause:** Task already running or doesn't exist
**Fix:**
- Check `/task list` to see status
- Make sure task ID is correct

### Heartbeat not recording
**Cause:** IndexedDB not available in CLI environment
**Fix:**
- Should auto-initialize with browser shim
- Check `localStorage` is working

### Task lost after CLI closed
**Cause:** This shouldn't happen — all data in IndexedDB
**Fix:**
- Run `/task list` to verify task still exists
- Use `/task view <id>` to see full details
- IndexedDB persists across sessions

## Advanced

### Batch Processing
```bash
# Create multiple tasks
for i in {1..10}; do
  npm run cli << EOF
/task create "Research topic $i"
EOF
done

# Run them
npm run cli
/task list
/task start <id1>
# When done, start next one
/task start <id2>
```

### Integration with Scripts
```bash
# Create task from script
npm run cli <<EOF
/task create "Automated research $(date)"
/task list
EOF
```

### Monitor Progress Externally
```bash
# Terminal 1: Start task
npm run cli
/task start <id>

# Terminal 2: Check progress
npm run cli
/task view <id>
# Keep running this to watch progress
```

## Limitations

- Only one task executes at a time per CLI instance
- No task scheduling (run on timer)
- No task dependencies (run task B after task A completes)
- Results limited by agent loop token output
- Some agent features unavailable in CLI (voice, images)

## Future Features

- Batch task execution (run multiple in sequence)
- Task scheduling (`/task schedule "daily" <id>`)
- Export results to file (`/task export <id> --format json`)
- Task templates (`/task template "research-template"`)
- Parallel tasks (multiple CLI instances)
- Progress webhooks (notify when complete)
