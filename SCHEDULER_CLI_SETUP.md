# Scheduler CLI Integration Setup

Instructions for integrating scheduler CLI commands into the main CLI interface.

## Files Created

The scheduler system adds these new files:

```
src/utils/
├── scheduler.ts                 # Core scheduling engine
├── schedulerStorage.ts          # IndexedDB persistence
├── heartbeatMonitor.ts          # Health monitoring
├── schedulerCli.ts              # CLI command implementations

src/hooks/
├── useScheduler.ts              # React hook for UI
├── useHeartbeat.ts              # React hook for health UI

src/components/
├── ScheduleManager.tsx          # Task management UI
├── HeartbeatDashboard.tsx       # Health dashboard
├── TaskQueueViewer.tsx          # Execution history

src/utils/__tests__/
└── scheduler.test.ts            # Unit tests

Documentation/
├── SCHEDULER_GUIDE.md           # Full documentation
├── SCHEDULER_INTEGRATION_EXAMPLE.md  # Real-world examples
└── SCHEDULER_CLI_SETUP.md       # This file
```

## CLI Integration Instructions

### Step 1: Add Imports to `src/cli.ts`

```typescript
// Add near the top with other imports
import {
  scheduleList,
  scheduleCreate,
  scheduleDelete,
  schedulePause,
  scheduleResume,
  scheduleRun,
  heartbeatCheck,
  heartbeatLogs,
  heartbeatStatus,
} from './utils/schedulerCli';
import { scheduler } from './utils/scheduler';
import { heartbeatMonitor } from './utils/heartbeatMonitor';
```

### Step 2: Add Command Handlers in CLI

In the `ask()` function of `cli.ts`, add these command handlers after the existing command checks (around line 520):

```typescript
// ─ Scheduler Commands ────────────────────────────────────────
if (userInput.toLowerCase() === '/schedule list') {
  const result = await scheduleList();
  process.stdout.write(`\n${result.message}\n\n`);
  ask();
  return;
}

if (userInput.toLowerCase().startsWith('/schedule create ')) {
  const args = userInput.slice(16).trim().split(/\s+/);
  // Parse: /schedule create <name> <type> <recurring|once> <cron|date> [options]

  if (args.length < 4) {
    process.stdout.write('  Usage: /schedule create <name> <type> <recurring|once> <cron|datetime>\n');
    process.stdout.write('  Example: /schedule create "Daily Research" research recurring "0 9 * * 1-5"\n\n');
    ask();
    return;
  }

  try {
    const name = args[0];
    const type = args[1];
    const scheduleType = args[2];
    const cronOrDate = args.slice(3).join(' ');

    const result = await scheduleCreate(name, type as any, scheduleType as any, cronOrDate);
    process.stdout.write(`\n${result.message}\n\n`);
  } catch (err) {
    process.stdout.write(`\n  Error: ${err}\n\n`);
  }
  ask();
  return;
}

if (userInput.toLowerCase().startsWith('/schedule delete ')) {
  const taskId = userInput.slice(16).trim();
  const result = await scheduleDelete(taskId);
  process.stdout.write(`\n${result.message}\n\n`);
  ask();
  return;
}

if (userInput.toLowerCase().startsWith('/schedule pause ')) {
  const taskId = userInput.slice(15).trim();
  const result = await schedulePause(taskId);
  process.stdout.write(`\n${result.message}\n\n`);
  ask();
  return;
}

if (userInput.toLowerCase().startsWith('/schedule resume ')) {
  const taskId = userInput.slice(16).trim();
  const result = await scheduleResume(taskId);
  process.stdout.write(`\n${result.message}\n\n`);
  ask();
  return;
}

if (userInput.toLowerCase().startsWith('/schedule run ')) {
  const taskId = userInput.slice(13).trim();
  const result = await scheduleRun(taskId);
  process.stdout.write(`\n${result.message}\n\n`);
  if (result.data) {
    process.stdout.write(`  Status: ${result.data.status}\n`);
    process.stdout.write(`  Duration: ${result.data.duration}ms\n\n`);
  }
  ask();
  return;
}

// ─ Heartbeat Commands ────────────────────────────────────────
if (userInput.toLowerCase() === '/heartbeat check') {
  const result = await heartbeatCheck();
  process.stdout.write(`\n${result.message}\n`);
  ask();
  return;
}

if (userInput.toLowerCase().startsWith('/heartbeat logs')) {
  const args = userInput.slice(15).trim();
  const limit = args ? parseInt(args) : 10;
  const result = await heartbeatLogs(limit);
  process.stdout.write(`\n${result.message}\n`);
  ask();
  return;
}

if (userInput.toLowerCase() === '/heartbeat status') {
  const result = await heartbeatStatus();
  process.stdout.write(`\n${result.message}\n`);
  ask();
  return;
}
```

### Step 3: Update Help Text

Update the `printHelp()` function to include scheduler commands:

```typescript
function printHelp() {
  const help = `
  CLI Commands:

  General:
    help              Show this message
    clear             Clear conversation history
    exit              Exit CLI
    /canvas           Show pending patches
    /canvas apply     Apply all patches interactively
    /canvas reset     Discard all patches

  Document Generation:
    /doc <prompt>     Generate a document
    /show             Show current document
    /edit             Edit document
    /save <name>      Save document
    /download         Download document as file
    /versions         Show document history

  Task Scheduling:
    /schedule list                         List all scheduled tasks
    /schedule create <name> <type> <schedule> <cron|date>
                                           Create a new task
    /schedule delete <task-id>             Delete a task
    /schedule pause <task-id>              Pause a task
    /schedule resume <task-id>             Resume a task
    /schedule run <task-id>                Execute immediately

  Health Monitoring:
    /heartbeat check                       Run health check
    /heartbeat status                      Show current status
    /heartbeat logs [limit]                View recent logs

  Task Types: research, report, healthcheck, custom
  Schedule Types: recurring, once, adhoc

  Cron Format (5-field):
    minute (0-59)
    hour (0-23)
    day of month (1-31)
    month (1-12)
    day of week (0-6, 0=Sunday)

  Examples:
    /schedule create "Daily Research" research recurring "0 9 * * 1-5"
    /schedule create "Friday Report" report recurring "0 17 * * 5"
    /schedule list
    /heartbeat check
    /heartbeat logs 20

  `;
  process.stdout.write(help);
}
```

### Step 4: Initialize Scheduler on CLI Start

Add to the `main()` function, after `setupNodeEnvironment()`:

```typescript
// Initialize scheduler and heartbeat
scheduler.registerExecutor('research', async (params: any) => {
  process.stdout.write(`  [scheduler] Research task: ${JSON.stringify(params)}\n`);
  // Integration with actual research cycle would go here
  return { success: true, timestamp: Date.now() };
});

scheduler.registerExecutor('report', async (params: any) => {
  process.stdout.write(`  [scheduler] Report task: ${JSON.stringify(params)}\n`);
  return { success: true, timestamp: Date.now() };
});

scheduler.registerExecutor('healthcheck', async (params: any) => {
  const check = await heartbeatMonitor.captureSnapshot();
  return check;
});

// Optional: Load persisted tasks from storage
const { schedulerStorage } = await import('./utils/schedulerStorage');
const persistedTasks = await schedulerStorage.getAllTasks();
for (const task of persistedTasks) {
  if (task.enabled) {
    scheduler.updateTask(task.id, { enabled: false }); // Disable on startup
    // Manually recreate to trigger scheduling
    // scheduler.createTask(...) with persisted params
  }
}

process.stdout.write('  [scheduler] System initialized\n\n');
```

## Usage Examples

### Create a Daily Research Task

```bash
$ npm run cli
> /schedule create "Daily Research" research recurring "0 9 * * 1-5"
  Created task "Daily Research" (task-1712172000123-abc123)

> /schedule list
  Scheduled Tasks:
  ────────────────────────────────────────────────────────────
  [✓] Daily Research (research)
      Schedule: Recurring: 0 9 * * 1-5
      Next run: Wednesday, April 2, 2026 at 9:00 AM
      Description:
```

### Check System Health

```bash
> /heartbeat check
  Health Check Results:
  ────────────────────────────────────────────────────────────
  Overall Health: HEALTHY

  ✓ ollama         healthy    (45ms)
  ✓ wayfarer       healthy    (123ms)
  ✓ searxng        healthy    (89ms)
```

### View Task History

```bash
> /schedule list
  Scheduled Tasks:
  ────────────────────────────────────────────────────────────
  [✓] Daily Research (research)
      Last run: Wednesday, April 2, 2026 at 9:15 AM
      Next run: Thursday, April 3, 2026 at 9:00 AM
```

### Manual Execution

```bash
> /schedule run task-1712172000123-abc123
  Task execution: completed
  Status: completed
  Duration: 4523ms
```

## Testing

### Run Unit Tests

```bash
npm test -- scheduler.test.ts
```

### Manual Testing Checklist

- [ ] Create recurring task
- [ ] Create one-time task
- [ ] List tasks
- [ ] Update task
- [ ] Pause/resume task
- [ ] Delete task
- [ ] Execute task manually
- [ ] Check health
- [ ] View logs
- [ ] Task persists after restart

## Troubleshooting

### Tasks not executing

Check that executors are registered:
```bash
> /schedule run <task-id>
# Should show "Task execution: completed"
```

### Health check failing

Verify services are running:
```bash
> /heartbeat check
# All services should show "healthy"
```

### Cron expression errors

Validate format (5 fields, space-separated):
```
Valid:   0 9 * * 1-5
Invalid: 0 9 * *    (only 4 fields)
Invalid: 0 9 * * 1-7 (day-of-week only 0-6)
```

## Next Steps

1. **Production Deployment**: Configure persistent storage and backup
2. **Slack Integration**: Send alerts to Slack channel
3. **API Integration**: Expose scheduler via REST API
4. **Web Dashboard**: Full UI for task management
5. **Performance Tuning**: Monitor and optimize task execution
6. **Automation Rules**: Create complex multi-step workflows

## References

- Full API docs: `SCHEDULER_GUIDE.md`
- Real-world examples: `SCHEDULER_INTEGRATION_EXAMPLE.md`
- Unit tests: `src/utils/__tests__/scheduler.test.ts`
