/**
 * Task Executor — Long-running task execution with crash recovery
 *
 * Handles:
 * - Task execution with checkpoint system
 * - Automatic heartbeat/recovery
 * - Persistent state to IndexedDB
 * - Streaming progress updates
 * - Graceful recovery from crashes
 */

import { openDB, type DBSchema } from 'idb';

export type TaskStatus = 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'error' | 'archived';

export interface TaskCheckpoint {
  timestamp: number;
  phase: string;
  progress: number; // 0-100
  result?: any;
  error?: string;
}

export interface ExecutableTask {
  id: string;
  title: string;
  description: string;
  prompt: string;

  // Execution state
  status: TaskStatus;
  progress: number; // 0-100
  currentPhase: string;

  // Recovery system
  lastHeartbeat: number;
  checkpoints: TaskCheckpoint[];
  failureCount: number;
  maxRetries: number;

  // Metadata
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number; // minutes

  // Result
  result?: string;
  error?: string;
}

interface TaskDB extends DBSchema {
  tasks: { key: string; value: ExecutableTask };
}

const DB_NAME = 'neuro_tasks';
const DB_VERSION = 1;

let _db: ReturnType<typeof openDB<TaskDB>> | null = null;

async function db() {
  if (!_db) {
    _db = await openDB<TaskDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
      },
    });
  }
  return _db;
}

// ── Task CRUD ────────────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  prompt: string,
  description?: string,
  estimatedDuration?: number
): Promise<ExecutableTask> {
  const task: ExecutableTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    description: description || '',
    prompt,
    status: 'draft',
    progress: 0,
    currentPhase: 'Initializing',
    lastHeartbeat: Date.now(),
    checkpoints: [],
    failureCount: 0,
    maxRetries: 5,
    createdAt: Date.now(),
    estimatedDuration: estimatedDuration || 60,
  };

  const taskDb = await db();
  await taskDb.put('tasks', task);
  return task;
}

export async function getTask(taskId: string): Promise<ExecutableTask | undefined> {
  const taskDb = await db();
  return taskDb.get('tasks', taskId);
}

export async function getAllTasks(): Promise<ExecutableTask[]> {
  const taskDb = await db();
  return taskDb.getAll('tasks');
}

export async function updateTask(taskId: string, updates: Partial<ExecutableTask>): Promise<void> {
  const taskDb = await db();
  const task = await taskDb.get('tasks', taskId);
  if (!task) return;

  const updated = { ...task, ...updates };
  await taskDb.put('tasks', updated);
}

export async function deleteTask(taskId: string): Promise<void> {
  const taskDb = await db();
  await taskDb.delete('tasks', taskId);
}

export async function archiveTask(taskId: string): Promise<void> {
  await updateTask(taskId, { status: 'archived' });
}

// ── Execution Control ────────────────────────────────────────────────────────

export async function startTask(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');

  await updateTask(taskId, {
    status: 'running',
    startedAt: Date.now(),
    failureCount: 0,
    lastHeartbeat: Date.now(),
  });
}

export async function pauseTask(taskId: string): Promise<void> {
  await updateTask(taskId, { status: 'paused' });
}

export async function resumeTask(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');

  if (task.failureCount >= task.maxRetries) {
    throw new Error(`Task has failed ${task.failureCount} times. Max retries exceeded.`);
  }

  await updateTask(taskId, {
    status: 'running',
    lastHeartbeat: Date.now(),
  });
}

// ── Checkpoint System (for recovery) ──────────────────────────────────────────

export async function addCheckpoint(
  taskId: string,
  phase: string,
  progress: number,
  result?: any
): Promise<void> {
  const task = await getTask(taskId);
  if (!task) return;

  const checkpoint: TaskCheckpoint = {
    timestamp: Date.now(),
    phase,
    progress,
    result,
  };

  task.checkpoints.push(checkpoint);

  // Keep only last 100 checkpoints to avoid bloat
  if (task.checkpoints.length > 100) {
    task.checkpoints = task.checkpoints.slice(-100);
  }

  await updateTask(taskId, {
    checkpoints: task.checkpoints,
    currentPhase: phase,
    progress,
    lastHeartbeat: Date.now(),
  });
}

export async function getLastCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
  const task = await getTask(taskId);
  if (!task || task.checkpoints.length === 0) return null;
  return task.checkpoints[task.checkpoints.length - 1];
}

// ── Heartbeat System (crash recovery) ────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 120_000; // 2 minutes — mark as crashed if no heartbeat

let heartbeatInterval: NodeJS.Timeout | null = null;

export async function startHeartbeat(): Promise<void> {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(async () => {
    try {
      const tasks = await getAllTasks();
      const now = Date.now();

      for (const task of tasks) {
        if (task.status !== 'running') continue;

        // Check if task has missed heartbeat
        const timeSinceHeartbeat = now - task.lastHeartbeat;

        if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          // Task crashed — attempt recovery
          console.warn(`Task ${task.id} missed heartbeat. Attempting recovery...`);

          task.failureCount++;

          if (task.failureCount >= task.maxRetries) {
            // Too many failures
            await updateTask(task.id, {
              status: 'error',
              error: `Task crashed ${task.failureCount} times. Max retries exceeded.`,
            });
          } else {
            // Retry from last checkpoint
            const checkpoint = await getLastCheckpoint(task.id);
            if (checkpoint) {
              console.log(`Resuming from checkpoint: ${checkpoint.phase} (${checkpoint.progress}%)`);
            }

            // Mark as recoverable — external executor will restart
            await updateTask(task.id, {
              status: 'queued', // Ready to be picked up by executor again
              failureCount: task.failureCount,
            });
          }
        }
      }
    } catch (error) {
      console.error('Heartbeat check failed:', error);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export async function stopHeartbeat(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export async function recordHeartbeat(taskId: string): Promise<void> {
  await updateTask(taskId, { lastHeartbeat: Date.now() });
}

// ── Completion ───────────────────────────────────────────────────────────────

export async function completeTask(taskId: string, result: string): Promise<void> {
  await updateTask(taskId, {
    status: 'completed',
    completedAt: Date.now(),
    progress: 100,
    result,
  });
}

export async function failTask(taskId: string, error: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) return;

  task.failureCount++;

  if (task.failureCount >= task.maxRetries) {
    await updateTask(taskId, {
      status: 'error',
      error: `${error} (failed ${task.failureCount} times)`,
    });
  } else {
    // Mark for retry
    await updateTask(taskId, {
      status: 'queued',
      error,
      failureCount: task.failureCount,
    });
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

export async function clearOldTasks(olderThanDays: number = 7): Promise<number> {
  const tasks = await getAllTasks();
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (const task of tasks) {
    if (task.status === 'archived' && task.completedAt && task.completedAt < cutoff) {
      await deleteTask(task.id);
      deleted++;
    }
  }

  return deleted;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
