/**
 * Task Scheduler — Allow agents to schedule prompts for future execution
 * Stores in IndexedDB, checks every 30s for pending tasks
 * Session-scoped (tasks don't survive page refresh)
 */

import { openDB } from 'idb';
import type { DBSchema } from 'idb';

export interface ScheduledTask {
  id: string;
  prompt: string;
  runAt: number;  // timestamp in ms when task should run
  repeat?: {
    interval: number;  // ms between repeats
    maxRuns?: number;  // max times to run (undefined = infinite)
  };
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  error?: string;
  runsCompleted?: number;
}

interface TaskSchedulerDB extends DBSchema {
  scheduledTasks: {
    key: string;
    value: ScheduledTask;
  };
}

const DB_NAME = 'neuro_task_scheduler';
const DB_VERSION = 1;
const STORE_NAME = 'scheduledTasks';
const CHECK_INTERVAL_MS = 30_000;  // Check every 30 seconds

let dbPromise: Promise<any> | null = null;
let checkIntervalId: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

/**
 * Initialize the IndexedDB database
 */
async function initDB() {
  if (typeof window === 'undefined') throw new Error('TaskScheduler requires browser environment');
  if (dbPromise) return dbPromise;

  dbPromise = openDB<TaskSchedulerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });

  return dbPromise;
}

/**
 * Start the background scheduler (should be called once on app init)
 */
export async function startScheduler(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  try {
    await initDB();
  } catch (e) {
    console.warn('Failed to initialize task scheduler:', e);
    return;
  }

  // Check for pending tasks immediately, then periodically
  await checkAndRunPendingTasks();

  checkIntervalId = setInterval(async () => {
    try {
      await checkAndRunPendingTasks();
    } catch (e) {
      console.error('Task scheduler check failed:', e);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the background scheduler (called on cleanup)
 */
export function stopScheduler(): void {
  if (checkIntervalId !== null) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  isInitialized = false;
}

/**
 * Create and schedule a new task
 */
export async function scheduleTask(
  prompt: string,
  runAtTime: number | Date,
  options?: { repeat?: { interval: number; maxRuns?: number } }
): Promise<ScheduledTask> {
  const db = await initDB();
  const task: ScheduledTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    prompt,
    runAt: typeof runAtTime === 'number' ? runAtTime : runAtTime.getTime(),
    repeat: options?.repeat,
    status: 'pending',
    createdAt: Date.now(),
    runsCompleted: 0,
  };

  await db.add(STORE_NAME, task);
  return task;
}

/**
 * Get all scheduled tasks
 */
export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  try {
    const db = await initDB();
    return (await db.getAll(STORE_NAME)) || [];
  } catch (e) {
    console.warn('Failed to get scheduled tasks:', e);
    return [];
  }
}

/**
 * Get a specific task by ID
 */
export async function getTask(taskId: string): Promise<ScheduledTask | undefined> {
  try {
    const db = await initDB();
    return await db.get(STORE_NAME, taskId);
  } catch (e) {
    console.warn('Failed to get task:', e);
    return undefined;
  }
}

/**
 * Cancel a scheduled task
 */
export async function cancelTask(taskId: string): Promise<void> {
  try {
    const db = await initDB();
    const task = await db.get(STORE_NAME, taskId);
    if (task) {
      task.status = 'cancelled';
      await db.put(STORE_NAME, task);
    }
  } catch (e) {
    console.warn('Failed to cancel task:', e);
  }
}

/**
 * Update a task's status
 */
async function updateTaskStatus(
  taskId: string,
  status: ScheduledTask['status'],
  error?: string
): Promise<void> {
  try {
    const db = await initDB();
    const task = await db.get(STORE_NAME, taskId);
    if (task) {
      task.status = status;
      if (status === 'completed') {
        task.completedAt = Date.now();
      }
      if (error) {
        task.error = error;
      }
      await db.put(STORE_NAME, task);
    }
  } catch (e) {
    console.error('Failed to update task status:', e);
  }
}

/**
 * Check for pending tasks and run them
 * Called by the background scheduler
 */
async function checkAndRunPendingTasks(): Promise<void> {
  try {
    const db = await initDB();
    const tasks = await db.getAll(STORE_NAME);
    const now = Date.now();

    for (const task of tasks) {
      // Skip non-pending tasks
      if (task.status !== 'pending') continue;

      // Skip if not yet time to run
      if (task.runAt > now) continue;

      // Task is ready to run!
      await executeScheduledTask(task);

      // Handle repeating tasks
      if (task.repeat) {
        const maxRuns = task.repeat.maxRuns || Infinity;
        const runsCompleted = (task.runsCompleted || 0) + 1;

        if (runsCompleted < maxRuns) {
          // Reschedule for next run
          task.status = 'pending';
          task.runAt = now + task.repeat.interval;
          task.runsCompleted = runsCompleted;
          await db.put(STORE_NAME, task);
        } else {
          // Max runs reached, mark as completed
          await updateTaskStatus(task.id, 'completed');
        }
      }
    }
  } catch (e) {
    console.error('Error checking pending tasks:', e);
  }
}

/**
 * Execute a scheduled task by dispatching a custom event
 * The app should listen for 'neuro-scheduled-task' events and handle execution
 */
async function executeScheduledTask(task: ScheduledTask): Promise<void> {
  try {
    // Dispatch event that the app can listen to
    window.dispatchEvent(new CustomEvent('neuro-scheduled-task', {
      detail: {
        taskId: task.id,
        prompt: task.prompt,
      },
    }));

    // Mark as completed (or let the listener update it)
    // For now, we'll mark it after a short delay to allow the listener to process
    setTimeout(() => {
      updateTaskStatus(task.id, 'completed').catch(e => {
        console.error('Failed to mark task as completed:', e);
      });
    }, 100);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await updateTaskStatus(task.id, 'failed', errorMsg);
  }
}

/**
 * Clear completed tasks (for cleanup)
 */
export async function clearCompletedTasks(): Promise<void> {
  try {
    const db = await initDB();
    const tasks = await db.getAll(STORE_NAME);
    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        await db.delete(STORE_NAME, task.id);
      }
    }
  } catch (e) {
    console.warn('Failed to clear completed tasks:', e);
  }
}

/**
 * Get task statistics for the UI
 */
export async function getTaskStats(): Promise<{
  total: number;
  pending: number;
  completed: number;
  failed: number;
  cancelled: number;
}> {
  try {
    const tasks = await getScheduledTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
    };
  } catch (e) {
    console.warn('Failed to get task stats:', e);
    return { total: 0, pending: 0, completed: 0, failed: 0, cancelled: 0 };
  }
}
