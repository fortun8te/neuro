/**
 * Task Queue — Sequential execution with isolated context per task
 * Each task starts with zero context from previous tasks by default.
 * Supports priority, retries, and status tracking.
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface QueuedTask {
  id: string;
  name: string;
  description?: string;
  execute: () => Promise<any>;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  retries: number;
  maxRetries: number;
  inheritContext?: boolean; // false = start with 0 context (default)
  contextFromTask?: string; // task ID to inherit context from
}

type QueueListener = (task: QueuedTask, event: 'added' | 'started' | 'completed' | 'failed') => void;

export class TaskQueue {
  private queue: QueuedTask[] = [];
  private running = false;
  private currentTask: QueuedTask | null = null;
  private listeners: Set<QueueListener> = new Set();
  private completedTasks: Map<string, QueuedTask> = new Map(); // LRU cache of completed tasks
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 1) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a task to the queue
   */
  add(task: {
    id: string;
    name: string;
    description?: string;
    execute: () => Promise<any>;
    priority: TaskPriority;
    maxRetries: number;
    inheritContext?: boolean;
    contextFromTask?: string;
  }): QueuedTask {
    const queuedTask: QueuedTask = {
      ...task,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
    };

    // Insert by priority (higher priority first, then FIFO)
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const insertIndex = this.queue.findIndex(
      (t) => priorityOrder[t.priority] > priorityOrder[task.priority]
    );

    if (insertIndex === -1) {
      this.queue.push(queuedTask);
    } else {
      this.queue.splice(insertIndex, 0, queuedTask);
    }

    this.emit(queuedTask, 'added');
    this.processNext();

    return queuedTask;
  }

  /**
   * Add multiple tasks at once
   */
  addBatch(tasks: Array<Parameters<TaskQueue['add']>[0]>): QueuedTask[] {
    return tasks.map(t => this.add(t));
  }

  /**
   * Get task by ID
   */
  get(id: string): QueuedTask | undefined {
    return this.queue.find((t) => t.id === id) || this.completedTasks.get(id);
  }

  /**
   * Cancel a task
   */
  cancel(id: string): boolean {
    const task = this.queue.find((t) => t.id === id);
    if (!task) return false;

    if (task.status === 'running') {
      // Can't cancel while running, but mark for cancellation
      task.status = 'cancelled';
      return true;
    }

    task.status = 'cancelled';
    this.queue = this.queue.filter((t) => t.id !== id);
    return true;
  }

  /**
   * Get queue status
   */
  status() {
    return {
      pending: this.queue.filter((t) => t.status === 'pending').length,
      running: this.currentTask ? 1 : 0,
      completed: this.completedTasks.size,
      failed: this.queue.filter((t) => t.status === 'failed').length,
      currentTask: this.currentTask,
      nextTasks: this.queue.slice(0, 5),
    };
  }

  /**
   * Listen to queue events
   */
  on(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Process next task in queue
   */
  private async processNext() {
    if (this.running || this.queue.length === 0) return;

    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task || task.status === 'cancelled') continue;

      this.currentTask = task;
      task.status = 'running';
      task.startedAt = Date.now();

      this.emit(task, 'started');

      try {
        task.result = await task.execute();
        task.status = 'completed';
        task.completedAt = Date.now();

        // Store in completed cache (keep last 50)
        this.completedTasks.set(task.id, task);
        if (this.completedTasks.size > 50) {
          const oldest = Array.from(this.completedTasks.entries()).sort(
            (a, b) => a[1].completedAt! - b[1].completedAt!
          )[0];
          this.completedTasks.delete(oldest[0]);
        }

        this.emit(task, 'completed');

        // Async reflection (fire and forget)
        if (task.status === 'completed' && task.result) {
          const log: import('./taskStore').TaskLog = {
            id: task.id,
            name: task.name,
            description: task.description,
            status: 'completed',
            priority: task.priority,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            durationMs: task.completedAt && task.startedAt ? task.completedAt - task.startedAt : undefined,
            toolCalls: [],
            result: typeof task.result === 'string' ? task.result : JSON.stringify(task.result),
          };
          import('./taskStore').then(({ saveTaskLog }) => saveTaskLog(log)).catch(() => {});
          import('./taskReflection').then(({ gradeTask }) => gradeTask(log)).catch(() => {});
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);

        if (task.retries < task.maxRetries) {
          task.retries++;
          task.status = 'pending';
          // Re-add to queue
          this.queue.unshift(task);
          console.warn(
            `Task ${task.id} failed (attempt ${task.retries}/${task.maxRetries}): ${error}`
          );
        } else {
          task.status = 'failed';
          task.error = error;
          task.completedAt = Date.now();
          this.emit(task, 'failed');
          console.error(`Task ${task.id} failed permanently: ${error}`);

          // Async failure log (fire and forget)
          const failedLog: import('./taskStore').TaskLog = {
            id: task.id,
            name: task.name,
            status: 'failed',
            priority: task.priority,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: Date.now(),
            toolCalls: [],
            error,
          };
          import('./taskStore').then(({ saveTaskLog }) => saveTaskLog(failedLog)).catch(() => {});
        }
      }

      this.currentTask = null;

      // Yield to event loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    this.running = false;
  }

  private emit(task: QueuedTask, event: 'added' | 'started' | 'completed' | 'failed') {
    for (const listener of this.listeners) {
      try {
        listener(task, event);
      } catch {
        /* ignore */
      }
    }
  }
}

// Global singleton
export const taskQueue = new TaskQueue(1);
