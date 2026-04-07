/**
 * CLI Task Manager — Command-line interface for long-running research tasks
 *
 * Commands:
 *   /task create "Title" [description]  - Create a new task
 *   /task list                          - List all tasks
 *   /task start <id>                    - Start a task
 *   /task pause <id>                    - Pause a running task
 *   /task resume <id>                   - Resume a paused task
 *   /task view <id>                     - View task details
 *   /task delete <id>                   - Delete a task
 */

import * as taskExecutor from '../utils/taskExecutor';
import type { ExecutableTask } from '../utils/taskExecutor';

// ── Task execution state ─────────────────────────────────────────────────────
const activeTaskAborts = new Map<string, AbortController>();
const taskMonitorIntervals = new Map<string, NodeJS.Timeout>();

// ── Create a task ────────────────────────────────────────────────────────────
export async function createTask(title: string, description: string = ''): Promise<ExecutableTask> {
  const task = await taskExecutor.createTask(
    title.trim(),
    title.trim(), // Use title as prompt initially
    description.trim(),
    120 // Estimate 2 hours by default
  );

  process.stdout.write(`\n  ✓ Task created: ${task.id}\n`);
  process.stdout.write(`    Title: ${task.title}\n`);
  if (description) process.stdout.write(`    Description: ${description}\n`);
  process.stdout.write(`    Status: ${task.status}\n\n`);

  return task;
}

// ── List all tasks ───────────────────────────────────────────────────────────
export async function listTasks(): Promise<void> {
  const allTasks = await taskExecutor.getAllTasks();

  if (allTasks.length === 0) {
    process.stdout.write('\n  No tasks yet. Create one with: /task create "Title"\n\n');
    return;
  }

  const active = allTasks.filter(t => ['draft', 'queued', 'running', 'paused'].includes(t.status));
  const completed = allTasks.filter(t => t.status === 'completed');
  const errored = allTasks.filter(t => t.status === 'error');

  process.stdout.write('\n  ╔════════════════════════════════════════════════════════════╗\n');
  process.stdout.write('  ║ TASKS\n');
  process.stdout.write('  ╚════════════════════════════════════════════════════════════╝\n\n');

  // Active tasks
  if (active.length > 0) {
    process.stdout.write('  ACTIVE:\n');
    active.forEach(task => {
      const status = task.status.toUpperCase().padEnd(10);
      const progress = `${task.progress}%`.padEnd(5);
      process.stdout.write(`    [${status}] ${progress} ${task.id.slice(0, 8)} ${task.title}\n`);
      if (task.currentPhase) {
        process.stdout.write(`                        Phase: ${task.currentPhase}\n`);
      }
    });
    process.stdout.write('\n');
  }

  // Completed tasks
  if (completed.length > 0) {
    process.stdout.write('  COMPLETED:\n');
    completed.forEach(task => {
      process.stdout.write(`    [DONE    ] ${task.id.slice(0, 8)} ${task.title}\n`);
    });
    process.stdout.write('\n');
  }

  // Error tasks
  if (errored.length > 0) {
    process.stdout.write('  ERRORS:\n');
    errored.forEach(task => {
      process.stdout.write(`    [ERROR   ] ${task.id.slice(0, 8)} ${task.title}\n`);
      if (task.error) {
        process.stdout.write(`               ${task.error}\n`);
      }
    });
    process.stdout.write('\n');
  }
}

// ── View task details ────────────────────────────────────────────────────────
export async function viewTask(taskId: string): Promise<void> {
  const task = await taskExecutor.getTask(taskId);

  if (!task) {
    process.stdout.write(`\n  Error: Task ${taskId} not found\n\n`);
    return;
  }

  process.stdout.write('\n  ╔════════════════════════════════════════════════════════════╗\n');
  process.stdout.write(`  ║ ${task.title}\n`);
  process.stdout.write('  ╚════════════════════════════════════════════════════════════╝\n\n');

  process.stdout.write(`  ID:              ${task.id}\n`);
  process.stdout.write(`  Status:          ${task.status.toUpperCase()}\n`);
  process.stdout.write(`  Progress:        ${task.progress}%\n`);
  if (task.currentPhase) process.stdout.write(`  Current Phase:   ${task.currentPhase}\n`);
  if (task.description) process.stdout.write(`  Description:     ${task.description}\n`);
  process.stdout.write(`  Created:         ${new Date(task.createdAt).toLocaleString()}\n`);

  if (task.startedAt) {
    const startDate = new Date(task.startedAt);
    process.stdout.write(`  Started:         ${startDate.toLocaleString()}\n`);
  }

  if (task.completedAt) {
    const elapsed = task.completedAt - (task.startedAt || task.createdAt);
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    process.stdout.write(`  Completed:       ${new Date(task.completedAt).toLocaleString()}\n`);
    process.stdout.write(`  Duration:        ${mins}m ${secs}s\n`);
  }

  process.stdout.write(`  Failures:        ${task.failureCount}/${task.maxRetries}\n`);
  process.stdout.write(`  Checkpoints:     ${task.checkpoints.length}\n`);

  if (task.error) {
    process.stdout.write(`  Error:           ${task.error}\n`);
  }

  if (task.result) {
    const resultStr = task.result.substring(0, 200);
    process.stdout.write(`  Result:          ${resultStr}${task.result.length > 200 ? '...' : ''}\n`);
  }

  process.stdout.write('\n');
}

// ── Start a task ─────────────────────────────────────────────────────────────
export async function startTask(taskId: string, onEvent?: (phase: string, progress: number) => void): Promise<void> {
  const task = await taskExecutor.getTask(taskId);

  if (!task) {
    process.stdout.write(`\n  Error: Task ${taskId} not found\n\n`);
    return;
  }

  if (task.status === 'running') {
    process.stdout.write(`\n  Error: Task is already running\n\n`);
    return;
  }

  process.stdout.write(`\n  Starting task: ${task.title}\n`);
  process.stdout.write(`  ID: ${taskId}\n`);
  process.stdout.write('  Press Ctrl+C to pause\n\n');

  try {
    // Start the task
    await taskExecutor.startTask(taskId);

    // Create abort controller for this task
    const controller = new AbortController();
    activeTaskAborts.set(taskId, controller);

    // Import and run agent loop
    const { runAgentLoop } = await import('../utils/agentEngine');

    // Set up heartbeat recording
    let lastHeartbeat = Date.now();
    const heartbeatInterval = setInterval(async () => {
      try {
        await taskExecutor.recordHeartbeat(taskId);
        lastHeartbeat = Date.now();
      } catch (e) {
        console.error('Error recording heartbeat:', e);
      }
    }, 10000); // Record every 10 seconds

    taskMonitorIntervals.set(taskId, heartbeatInterval);

    // Run the agent loop
    const result = await runAgentLoop(task.prompt, '', {
      signal: controller.signal,
      onEvent: async (event: any) => {
        try {
          // Update heartbeat and checkpoint on each event
          await taskExecutor.recordHeartbeat(taskId);

          if (event.type === 'tool_start' && event.toolCall) {
            await taskExecutor.addCheckpoint(taskId, `Running ${event.toolCall.name}`, task.progress + 1);
            process.stdout.write(`  [tool] ${event.toolCall.name}\n`);
            onEvent?.(`Running ${event.toolCall.name}`, task.progress + 1);
          } else if (event.type === 'response_chunk') {
            const currentTask = await taskExecutor.getTask(taskId);
            if (currentTask && currentTask.progress < 95) {
              const newProgress = currentTask.progress + 1;
              await taskExecutor.addCheckpoint(taskId, 'Processing...', newProgress);
              onEvent?.('Processing...', newProgress);
            }
          }
        } catch (e) {
          console.error('Error in task event handler:', e);
        }
      },
    });

    // Clean up
    clearInterval(heartbeatInterval);
    taskMonitorIntervals.delete(taskId);
    activeTaskAborts.delete(taskId);

    // Mark as complete
    await taskExecutor.completeTask(taskId, result.finalResponse || 'Task completed');

    process.stdout.write(`\n  Task completed successfully!\n`);
    process.stdout.write(`  Result: ${result.finalResponse?.substring(0, 100) || 'Done'}...\n\n`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isAborted = msg.includes('AbortError') || msg.includes('Aborted');

    // Clean up
    const interval = taskMonitorIntervals.get(taskId);
    if (interval) clearInterval(interval);
    taskMonitorIntervals.delete(taskId);
    activeTaskAborts.delete(taskId);

    if (isAborted) {
      // User paused
      await taskExecutor.pauseTask(taskId);
      process.stdout.write(`\n  Task paused. Run /task resume ${taskId} to continue\n\n`);
    } else {
      // Real error
      console.error(`\n  Error: ${msg}\n`);
      await taskExecutor.failTask(taskId, msg);
    }
  }
}

// ── Pause a task ─────────────────────────────────────────────────────────────
export async function pauseTask(taskId: string): Promise<void> {
  const controller = activeTaskAborts.get(taskId);
  if (controller) {
    controller.abort();
    activeTaskAborts.delete(taskId);
  }

  const interval = taskMonitorIntervals.get(taskId);
  if (interval) {
    clearInterval(interval);
    taskMonitorIntervals.delete(taskId);
  }

  await taskExecutor.pauseTask(taskId);
  process.stdout.write(`\n  Task paused. Run /task resume ${taskId} to continue\n\n`);
}

// ── Resume a task ────────────────────────────────────────────────────────────
export async function resumeTask(taskId: string, onEvent?: (phase: string, progress: number) => void): Promise<void> {
  const task = await taskExecutor.getTask(taskId);

  if (!task) {
    process.stdout.write(`\n  Error: Task ${taskId} not found\n\n`);
    return;
  }

  if (task.status === 'running') {
    process.stdout.write(`\n  Error: Task is already running\n\n`);
    return;
  }

  // Check if can resume
  if (task.failureCount >= task.maxRetries) {
    process.stdout.write(`\n  Error: Task has exceeded max retries (${task.failureCount}/${task.maxRetries})\n\n`);
    return;
  }

  process.stdout.write(`\n  Resuming task: ${task.title}\n`);

  const lastCheckpoint = await taskExecutor.getLastCheckpoint(taskId);
  if (lastCheckpoint) {
    process.stdout.write(`  From checkpoint: ${lastCheckpoint.phase} (${lastCheckpoint.progress}%)\n`);
  }
  process.stdout.write('  Press Ctrl+C to pause\n\n');

  // Resume execution (same as start)
  await startTask(taskId, onEvent);
}

// ── Delete a task ────────────────────────────────────────────────────────────
export async function deleteTask(taskId: string): Promise<void> {
  const task = await taskExecutor.getTask(taskId);

  if (!task) {
    process.stdout.write(`\n  Error: Task ${taskId} not found\n\n`);
    return;
  }

  await taskExecutor.deleteTask(taskId);
  process.stdout.write(`\n  Deleted: ${task.title}\n\n`);
}
