/**
 * CLI Remote Research Runner — Execute research tasks with live logging
 *
 * Enhanced task execution with:
 * - Real-time progress streaming
 * - Detailed event logging
 * - Duration tracking
 * - Graceful pause/resume
 */

import * as taskExecutor from '../utils/taskExecutor';

interface ResearchSession {
  taskId: string;
  startTime: number;
  eventsProcessed: number;
  lastCheckpoint: string;
}

const session: ResearchSession = {
  taskId: '',
  startTime: 0,
  eventsProcessed: 0,
  lastCheckpoint: '',
};

// ── Formatting utilities ──────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ── Live logging ──────────────────────────────────────────────────────────────
export function logResearch(section: string, detail: string): void {
  const elapsed = formatDuration(Date.now() - session.startTime);
  process.stdout.write(`\n  [${formatTime()}] [${elapsed}] [${section}] ${detail}\n`);
}

export function logProgress(progress: number, phase: string): void {
  const elapsed = formatDuration(Date.now() - session.startTime);
  const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
  process.stdout.write(`\r  [${elapsed}] [${bar}] ${progress}% — ${phase}`);
}

// ── Create research task ──────────────────────────────────────────────────────
export async function createResearchTask(title: string, description: string): Promise<string> {
  logResearch('INIT', `Creating research task: ${title}`);

  const task = await taskExecutor.createTask(title, title, description, 600); // 10 hours

  session.taskId = task.id;

  process.stdout.write(`\n\n  ╔════════════════════════════════════════════════════════════╗\n`);
  process.stdout.write(`  ║ RESEARCH SESSION STARTED                                   ║\n`);
  process.stdout.write(`  ╚════════════════════════════════════════════════════════════╝\n`);
  process.stdout.write(`\n  Task ID:    ${task.id}\n`);
  process.stdout.write(`  Title:      ${task.title}\n`);
  process.stdout.write(`  Status:     ${task.status}\n`);
  process.stdout.write(`  Estimated:  ${task.estimatedDuration || 600} minutes\n`);
  process.stdout.write(`  Started:    ${formatTime()}\n\n`);

  return task.id;
}

// ── Execute research with live logs ───────────────────────────────────────────
export async function executeResearch(taskId: string): Promise<void> {
  const task = await taskExecutor.getTask(taskId);

  if (!task) {
    process.stdout.write('\n  Error: Task not found\n\n');
    return;
  }

  session.taskId = taskId;
  session.startTime = Date.now();

  logResearch('START', `Beginning research: ${task.title}`);
  process.stdout.write('\n  Initializing agent loop...\n');

  try {
    await taskExecutor.startTask(taskId);

    // Create abort controller
    const controller = new AbortController();

    // Dynamic import to avoid circular dependencies
    const { runAgentLoop } = await import('../utils/agentEngine');

    // Execute with live event logging
    const result = await runAgentLoop(task.prompt, '', {
      signal: controller.signal,
      onEvent: async (event: any) => {
        try {
          // Record heartbeat
          await taskExecutor.recordHeartbeat(taskId);

          // Log specific event types
          if (event.type === 'tool_start' && event.toolCall) {
            logResearch('TOOL', `Started: ${event.toolCall.name}`);
            session.eventsProcessed++;
          } else if (event.type === 'tool_done' && event.toolCall) {
            const success = event.toolCall.result?.success !== false;
            logResearch('TOOL', `Completed: ${event.toolCall.name} [${success ? 'OK' : 'FAIL'}]`);
          } else if (event.type === 'response_chunk') {
            // Update progress smoothly
            const currentTask = await taskExecutor.getTask(taskId);
            if (currentTask && currentTask.progress < 95) {
              const newProgress = currentTask.progress + 1;
              await taskExecutor.addCheckpoint(taskId, 'Analyzing...', newProgress);
              logProgress(newProgress, currentTask.currentPhase || 'Processing');
            }
          } else if (event.type === 'thinking_start') {
            logResearch('THINK', 'Deep reasoning initiated');
          } else if (event.type === 'thinking_done') {
            const tokens = (event as any).tokens || 0;
            logResearch('THINK', `Reasoning complete [${tokens} tokens]`);
          }
        } catch (e) {
          // Silent fail on event handler errors
        }
      },
    });

    // Mark complete
    await taskExecutor.completeTask(taskId, result.finalResponse || 'Research completed');

    session.eventsProcessed++;

    const totalTime = Date.now() - session.startTime;
    process.stdout.write(`\n\n  ╔════════════════════════════════════════════════════════════╗\n`);
    process.stdout.write(`  ║ RESEARCH COMPLETE                                          ║\n`);
    process.stdout.write(`  ╚════════════════════════════════════════════════════════════╝\n`);
    process.stdout.write(`\n  Total Time:      ${formatDuration(totalTime)}\n`);
    process.stdout.write(`  Events:          ${session.eventsProcessed}\n`);
    process.stdout.write(`  Task ID:         ${taskId}\n`);
    process.stdout.write(`  Status:          COMPLETED\n\n`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isAborted = msg.includes('AbortError') || msg.includes('Aborted');

    if (isAborted) {
      logResearch('PAUSE', 'Research paused by user');
      await taskExecutor.pauseTask(taskId);

      const checkpoint = await taskExecutor.getLastCheckpoint(taskId);
      process.stdout.write(`\n\n  ╔════════════════════════════════════════════════════════════╗\n`);
      process.stdout.write(`  ║ RESEARCH PAUSED                                            ║\n`);
      process.stdout.write(`  ╚════════════════════════════════════════════════════════════╝\n`);
      process.stdout.write(`\n  Can resume with: /task resume ${taskId}\n`);
      if (checkpoint) {
        process.stdout.write(`  From checkpoint: ${checkpoint.phase} (${checkpoint.progress}%)\n`);
      }
      process.stdout.write(`\n`);
    } else {
      logResearch('ERROR', msg);
      await taskExecutor.failTask(taskId, msg);

      process.stdout.write(`\n\n  ╔════════════════════════════════════════════════════════════╗\n`);
      process.stdout.write(`  ║ RESEARCH FAILED                                            ║\n`);
      process.stdout.write(`  ╚════════════════════════════════════════════════════════════╝\n`);
      process.stdout.write(`\n  Error: ${msg}\n`);
      process.stdout.write(`  Retry with: /task resume ${taskId}\n\n`);
    }
  }
}

// ── View live research status ─────────────────────────────────────────────────
export async function watchResearch(taskId: string, intervalMs: number = 5000): Promise<void> {
  const startTime = Date.now();

  process.stdout.write('\n  Monitoring research (updates every 5s, Ctrl+C to exit)...\n\n');

  const interval = setInterval(async () => {
    try {
      const task = await taskExecutor.getTask(taskId);
      if (!task) return;

      const elapsed = formatDuration(Date.now() - startTime);
      const bar = '█'.repeat(Math.floor(task.progress / 5)) + '░'.repeat(20 - Math.floor(task.progress / 5));

      process.stdout.write(`\r  [${elapsed}] [${bar}] ${task.progress}% — ${task.currentPhase}`);

      if (task.status === 'completed' || task.status === 'error') {
        clearInterval(interval);
        process.stdout.write('\n\n  Research finished.\n\n');
      }
    } catch (e) {
      // Silent
    }
  }, intervalMs);

  // Allow Ctrl+C to exit
  process.on('SIGINT', () => {
    clearInterval(interval);
    process.stdout.write('\n\n  Watch ended.\n\n');
    process.exit(0);
  });
}
