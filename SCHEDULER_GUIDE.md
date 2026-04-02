# Task Scheduler & Heartbeat System

Comprehensive scheduling and health monitoring system for the Ad Agent. Run automated research cycles, generate reports, monitor service health, and execute custom tasks on a schedule.

## Table of Contents

1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Usage Guide](#usage-guide)
4. [API Reference](#api-reference)
5. [CLI Commands](#cli-commands)
6. [Examples](#examples)
7. [Architecture](#architecture)

## Overview

The scheduler system provides:

- **Task Scheduling**: Cron-based recurring tasks, one-time tasks, and manual execution
- **Health Monitoring**: Real-time service health checks with alerting and recovery
- **Persistence**: IndexedDB storage for scheduled tasks and execution history
- **UI Components**: Dashboard, task manager, and health monitor
- **Retry Logic**: Exponential backoff for failed tasks
- **Audit Trail**: Complete execution history with metrics

## Core Components

### 1. Scheduler (`src/utils/scheduler.ts`)

Main scheduling engine with cron parsing and task execution.

**Key Features**:
- 5-field cron expression support (minute hour day month dow)
- One-time task execution at specific datetime
- Recurring daily/weekly/monthly patterns
- Background execution without blocking UI
- Timeout and retry management
- Custom executor registration

**Exports**:
```typescript
export class Scheduler { ... }
export const scheduler: Scheduler  // singleton
```

### 2. Scheduler Storage (`src/utils/schedulerStorage.ts`)

IndexedDB persistence layer for tasks and execution history.

**Stores**:
- `scheduled_tasks` — All created tasks
- `task_executions` — Execution history (capped at 1000 entries)
- `schedule_metrics` — Performance metrics

### 3. Heartbeat Monitor (`src/utils/heartbeatMonitor.ts`)

Advanced health monitoring extending the base `healthMonitor` with:
- Alert generation and tracking
- Execution log persistence
- Auto-recovery orchestration
- Configurable thresholds and alert levels
- Health report generation

**Services Monitored**:
- Ollama (critical)
- Wayfarer (critical)
- SearXNG (warning)

### 4. Custom Hooks

**useScheduler** (`src/hooks/useScheduler.ts`):
- Task CRUD operations
- Execution history
- Metrics
- Persistent state synchronization

**useHeartbeat** (`src/hooks/useHeartbeat.ts`):
- Live snapshot updates
- Alert subscription
- Configuration management
- Log export

### 5. UI Components

**ScheduleManager** (`src/components/ScheduleManager.tsx`):
- Create/edit/delete tasks
- Pause/resume schedules
- Task form with validation
- Cron expression helper

**HeartbeatDashboard** (`src/components/HeartbeatDashboard.tsx`):
- Real-time service status
- Alert summary
- Health metrics
- Configuration UI
- Manual service checks and recovery

**TaskQueueViewer** (`src/components/TaskQueueViewer.tsx`):
- Execution history browser
- Filter by task
- Success/failure rates
- Duration metrics

## Usage Guide

### In React Components

```typescript
import { useScheduler } from '../hooks/useScheduler';
import { useHeartbeat } from '../hooks/useHeartbeat';

function MyComponent() {
  const scheduler = useScheduler();
  const heartbeat = useHeartbeat();

  // Create a research task
  const createResearchTask = async () => {
    await scheduler.createTask(
      'Daily Deep Research',
      'research',
      'recurring',
      { depth: 'NR' },
      { cron: '0 9 * * 1-5' } // 9am weekdays
    );
  };

  // Manual execution
  const runNow = async () => {
    const execution = await scheduler.executeTaskNow(taskId);
    console.log(`Execution: ${execution.status}`);
  };

  // Health check
  const checkHealth = async () => {
    await heartbeat.checkAll();
    console.log(heartbeat.overallHealth);
  };

  return (
    <div>
      <button onClick={createResearchTask}>Create Task</button>
      <button onClick={runNow}>Run Now</button>
      <button onClick={checkHealth}>Check Health</button>
    </div>
  );
}
```

### Direct Scheduler API

```typescript
import { scheduler } from '../utils/scheduler';

// Create recurring task
const task = scheduler.createTask(
  'Weekly Report',
  'report',
  'recurring',
  { format: 'pdf' },
  {
    cron: '0 17 * * 5', // Friday 5pm
    maxRetries: 3,
    timeout: 60000,
    description: 'Generate weekly performance report'
  }
);

// Create one-time task
const oneTime = scheduler.createTask(
  'Next Tuesday Check',
  'healthcheck',
  'once',
  {},
  {
    runAt: new Date('2026-04-15T14:30:00').getTime(),
    maxRetries: 1
  }
);

// Get all tasks
const allTasks = scheduler.getAllTasks();

// Update task
scheduler.updateTask(task.id, {
  enabled: false,
  maxRetries: 5
});

// Manual execution
const execution = await scheduler.executeTask(task.id);

// Get metrics
const metrics = scheduler.getMetrics();
```

### Heartbeat API

```typescript
import { heartbeatMonitor } from '../utils/heartbeatMonitor';

// Manual snapshot capture
const log = await heartbeatMonitor.captureSnapshot();
console.log(log.overallHealth); // 'healthy' | 'degraded' | 'critical'

// Get health report
const report = await heartbeatMonitor.getHealthReport();
console.log(report.stats.uptimePercent);

// Configure
heartbeatMonitor.setConfig({
  checkIntervalMs: 60000, // 1 minute
  autoRecoveryEnabled: true,
  archiveRetentionDays: 7
});

// Listen to status changes
const unsubscribe = heartbeatMonitor.onStatusChange((alert) => {
  console.log(`Alert: ${alert.service} - ${alert.message}`);
});

// Export logs for analysis
const csv = await heartbeatMonitor.exportLogs(7); // Last 7 days
```

## API Reference

### Scheduler

#### `createTask(name, type, scheduleType, parameters, options)`

Creates a new scheduled task.

**Parameters**:
- `name: string` — Task display name
- `type: TaskType` — 'research' | 'report' | 'healthcheck' | 'custom'
- `scheduleType: ScheduleType` — 'recurring' | 'once' | 'adhoc'
- `parameters: Record<string, any>` — Task-specific parameters
- `options`:
  - `cron?: string` — 5-field cron (required for recurring)
  - `runAt?: number` — Unix timestamp (required for once)
  - `maxRetries?: number` — Default 3
  - `timeout?: number` — Milliseconds, default 30000
  - `description?: string`

**Returns**: `ScheduledTask`

#### `updateTask(id, updates)`

Updates task properties and reschedules if needed.

**Parameters**:
- `id: string` — Task ID
- `updates: Partial<ScheduledTask>`

**Returns**: `ScheduledTask`

#### `deleteTask(id)`

Deletes and cancels a task.

#### `pauseTask(id)` / `resumeTask(id)`

Toggles task enabled state.

#### `executeTask(id, retryCount?)`

Executes a task immediately.

**Returns**: `Promise<TaskExecution>`

#### `getAllTasks()`

Returns all tasks (active and inactive).

#### `getMetrics()`

Returns scheduler metrics:
```typescript
{
  totalTasks: number;
  activeTasks: number;
  totalExecutions: number;
  failureRate: number;
  avgExecutionTime: number;
}
```

#### `registerExecutor(type, executor)`

Register custom task executor:

```typescript
scheduler.registerExecutor('research', async (params) => {
  // your research logic
  return result;
});
```

### Heartbeat Monitor

#### `captureSnapshot()`

Captures and logs current service health.

**Returns**: `Promise<HeartbeatLog>`

#### `getHealthReport()`

Detailed health report with metrics.

**Returns**: `Promise<{ overallHealth, services, stats, recentAlerts }>`

#### `getLogs(limit?)`

Get recent health logs.

**Parameters**:
- `limit?: number` — Default 100

**Returns**: `Promise<HeartbeatLog[]>`

#### `getAlerts(resolved?)`

Get alerts (active or resolved).

**Parameters**:
- `resolved?: boolean` — Filter by resolution status

#### `setConfig(updates)`

Update monitoring configuration.

**Properties**:
- `checkIntervalMs` — Check frequency (default 30000)
- `autoRecoveryEnabled` — Auto-recover failed services
- `archiveRetentionDays` — Log retention (default 30)
- `degradedThreshold` — Failures before degraded
- `downThreshold` — Failures before down

#### `exportLogs(days?)`

Export logs as CSV.

**Parameters**:
- `days?: number` — Days to include (default 1)

**Returns**: `Promise<string>` — CSV data

## CLI Commands

### Task Management

```bash
# List all tasks
/schedule list

# Create recurring task (9am weekdays)
/schedule create "Daily Research" research recurring "0 9 * * 1-5" \
  --description="Full research cycle" --retries=2

# Create one-time task (next Tuesday 2:30pm)
/schedule create "Tuesday Check" healthcheck once "2026-04-15T14:30:00"

# Manual/ad-hoc task
/schedule create "Quick Check" healthcheck adhoc

# Delete task
/schedule delete <task-id>

# Pause/Resume
/schedule pause <task-id>
/schedule resume <task-id>

# Execute immediately
/schedule run <task-id>
```

### Health Monitoring

```bash
# Full health check
/heartbeat check

# Show current status
/heartbeat status

# View recent logs
/heartbeat logs 10

# Export logs (last 7 days)
/heartbeat export 7
```

## Examples

### Daily Research Cycle

```typescript
// Research every weekday at 9am with Normal depth
await scheduler.createTask(
  'Weekday Research',
  'research',
  'recurring',
  { depth: 'NR', campaignId: 'camp-001' },
  {
    cron: '0 9 * * 1-5',
    description: 'Full research cycle Monday-Friday'
  }
);
```

### Cron Expression Examples

```
0 9 * * 1-5      # 9am, Monday to Friday
0 17 * * 5       # 5pm, Friday only
0 0 1 * *        # Midnight, first day of month
*/30 * * * *     # Every 30 minutes
0 9-17 * * *     # Every hour from 9am-5pm
```

### Weekly Report Generation

```typescript
await scheduler.createTask(
  'Weekly Performance Report',
  'report',
  'recurring',
  {
    format: 'pdf',
    include: ['conversions', 'engagement', 'ctr'],
    email: 'team@company.com'
  },
  {
    cron: '0 17 * * 5', // Friday 5pm
    timeout: 300000
  }
);
```

### Health Check with Auto-Recovery

```typescript
const config: HeartbeatConfig = {
  checkIntervalMs: 15000, // Every 15 seconds
  autoRecoveryEnabled: true,
  archiveRetentionDays: 30,
  degradedThreshold: 2,
  downThreshold: 4,
  alertLevelConfig: {
    ollama: 'critical',
    wayfarer: 'critical',
    searxng: 'warning'
  }
};

heartbeatMonitor.setConfig(config);

// Listen for alerts
heartbeatMonitor.onStatusChange((alert) => {
  if (alert.level === 'critical') {
    console.error(`CRITICAL: ${alert.message}`);
    // Send notification
  }
});
```

### Conditional Task Creation

```typescript
// Create research task only if services are healthy
const health = await heartbeatMonitor.captureSnapshot();
const allHealthy = Object.values(health).every(s => s.status === 'healthy');

if (allHealthy) {
  await scheduler.createTask(
    'Safe Research',
    'research',
    'recurring',
    { depth: 'EX' },
    { cron: '0 9 * * *' }
  );
}
```

## Architecture

### Data Flow

```
User Request
    ↓
[CLI/UI] ──→ [Scheduler/Heartbeat] ──→ [Storage]
    ↑                  ↓
    └── [Custom Hooks] ←── [Executors]
                  ↓
          [Service APIs]
```

### Task Lifecycle

```
Create Task
    ↓
Schedule Timer (via CronParser)
    ↓
Timer Triggers
    ↓
Execute Task (with timeout)
    ↓
↙─────────────────────────────────────────┘
│         Success?
├─────────── YES ──→ Update lastRun, save to storage ──→ Complete
│
├─────────── NO ──→ Retry Count < Max?
│                       ├─ YES → Exponential backoff → Retry
│                       └─ NO → Save error, mark failed
│
└─ Reschedule (if recurring)
```

### Storage Schema

**ScheduledTasks**:
```json
{
  "task-id": {
    "id": "task-id",
    "name": "string",
    "type": "research|report|healthcheck|custom",
    "scheduleType": "recurring|once|adhoc",
    "cron": "0 9 * * 1-5",
    "enabled": boolean,
    "lastRun": number,
    "nextRun": number,
    "createdAt": number,
    "updatedAt": number
  }
}
```

**TaskExecutions**:
```json
{
  "exec-id": {
    "id": "exec-id",
    "taskId": "task-id",
    "startedAt": number,
    "completedAt": number,
    "status": "completed|failed|running|pending",
    "duration": number,
    "result": any,
    "error": string,
    "retriesUsed": number
  }
}
```

**HeartbeatLogs**:
```json
{
  "timestamp": number,
  "snapshot": {
    "service-name": {
      "status": "healthy|degraded|down",
      "latencyMs": number,
      "lastCheck": number,
      "consecutiveFailures": number
    }
  },
  "overallHealth": "healthy|degraded|critical",
  "alertsTriggered": ["alert-id"]
}
```

## Integration Points

### With useCycleLoop

To automatically execute research cycles via scheduler:

```typescript
// In scheduler executor registration
scheduler.registerExecutor('research', async (params) => {
  // Call cycle loop with parameters
  const cycle = await startNewCycle({
    depth: params.depth,
    mode: params.mode || 'full'
  });
  return cycle;
});
```

### With Existing Hooks

- **useOrchestratedResearch**: Called by research task executor
- **useCycleLoop**: Main cycle orchestration
- **useStorage**: Persistent task/execution history
- **healthMonitor**: Real-time service status

## Performance Considerations

1. **Task Queue**: Limited to reasonable number of concurrent executions
2. **Storage Capping**: Executions limited to 1000 most recent entries
3. **Log Cleanup**: Automatic archival based on retention policy
4. **Cron Parsing**: Efficient field parsing with memoization
5. **Timeout Management**: Graceful cancellation via AbortSignal

## Error Handling

### Retry Strategy

- **Exponential Backoff**: 1s, 2s, 4s, 8s... (configurable max 3 retries)
- **Timeout Handling**: Task aborted if exceeds timeout threshold
- **Network Errors**: Automatically retried with backoff
- **Execution Errors**: Logged with full context

### Alert Levels

- **INFO**: Status changed, scheduled execution started
- **WARNING**: Service degraded, high latency detected
- **CRITICAL**: Service down, recovery attempted

## Security Considerations

1. **Cron Expression Validation**: Prevents injection attacks
2. **Task Parameter Isolation**: Parameters stored separately from code
3. **Execution Context**: Tasks execute in isolated contexts
4. **Storage Encryption**: Optional via IndexedDB configuration
5. **Access Control**: Future integration with auth/permissions

## Future Enhancements

- [ ] Task dependencies (run task B after task A completes)
- [ ] Distributed scheduling (multiple clients coordinating)
- [ ] Task templating and reuse
- [ ] Advanced cron UI builder
- [ ] Webhook/API triggers
- [ ] Task monitoring dashboard
- [ ] Performance analytics
- [ ] Cost estimation and optimization
