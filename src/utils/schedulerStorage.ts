/**
 * Scheduler Storage — Persistence layer for IndexedDB
 * Handles saving/loading scheduled tasks and execution history
 */

import { set, get, del } from 'idb-keyval';
import type { ScheduledTask, TaskExecution } from './scheduler';

const TASKS_KEY = 'scheduled_tasks';
const EXECUTIONS_KEY = 'task_executions';
const SCHEDULE_METRICS_KEY = 'schedule_metrics';

interface StoredTasks {
  [taskId: string]: ScheduledTask;
}

interface StoredExecutions {
  [executionId: string]: TaskExecution;
}

export const schedulerStorage = {
  // ── Task persistence ──

  async saveTask(task: ScheduledTask): Promise<void> {
    try {
      const tasks = ((await get(TASKS_KEY)) as StoredTasks | undefined) || {};
      tasks[task.id] = task;
      await set(TASKS_KEY, tasks);
    } catch (err) {
      console.error('[schedulerStorage] saveTask failed:', err);
      throw err;
    }
  },

  async saveAllTasks(tasks: ScheduledTask[]): Promise<void> {
    try {
      const stored: StoredTasks = {};
      for (const task of tasks) {
        stored[task.id] = task;
      }
      await set(TASKS_KEY, stored);
    } catch (err) {
      console.error('[schedulerStorage] saveAllTasks failed:', err);
      throw err;
    }
  },

  async getTask(id: string): Promise<ScheduledTask | null> {
    try {
      const tasks = ((await get(TASKS_KEY)) as StoredTasks | undefined) || {};
      return tasks[id] ?? null;
    } catch (err) {
      console.error('[schedulerStorage] getTask failed:', err);
      throw err;
    }
  },

  async getAllTasks(): Promise<ScheduledTask[]> {
    try {
      const tasks = ((await get(TASKS_KEY)) as StoredTasks | undefined) || {};
      return Object.values(tasks);
    } catch (err) {
      console.error('[schedulerStorage] getAllTasks failed:', err);
      throw err;
    }
  },

  async deleteTask(id: string): Promise<void> {
    try {
      const tasks = ((await get(TASKS_KEY)) as StoredTasks | undefined) || {};
      delete tasks[id];
      await set(TASKS_KEY, tasks);
    } catch (err) {
      console.error('[schedulerStorage] deleteTask failed:', err);
      throw err;
    }
  },

  // ── Execution history ──

  async saveExecution(execution: TaskExecution): Promise<void> {
    try {
      const executions = ((await get(EXECUTIONS_KEY)) as StoredExecutions | undefined) || {};
      executions[execution.id] = execution;

      // Keep only last 1000 executions to prevent unbounded growth
      const all = Object.entries(executions)
        .sort((a, b) => b[1].startedAt - a[1].startedAt)
        .slice(0, 1000);

      await set(
        EXECUTIONS_KEY,
        Object.fromEntries(all)
      );
    } catch (err) {
      console.error('[schedulerStorage] saveExecution failed:', err);
      throw err;
    }
  },

  async getExecutionHistory(
    taskId?: string,
    limit: number = 100
  ): Promise<TaskExecution[]> {
    try {
      const executions = ((await get(EXECUTIONS_KEY)) as StoredExecutions | undefined) || {};
      let all = Object.values(executions);

      if (taskId) {
        all = all.filter((e) => e.taskId === taskId);
      }

      return all
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    } catch (err) {
      console.error('[schedulerStorage] getExecutionHistory failed:', err);
      throw err;
    }
  },

  async clearExecutionHistory(taskId?: string): Promise<void> {
    try {
      if (taskId) {
        const executions = ((await get(EXECUTIONS_KEY)) as StoredExecutions | undefined) || {};
        for (const [id, exec] of Object.entries(executions)) {
          if (exec.taskId === taskId) {
            delete executions[id];
          }
        }
        await set(EXECUTIONS_KEY, executions);
      } else {
        await set(EXECUTIONS_KEY, {});
      }
    } catch (err) {
      console.error('[schedulerStorage] clearExecutionHistory failed:', err);
      throw err;
    }
  },

  // ── Metrics ──

  async saveMetrics(metrics: any): Promise<void> {
    try {
      await set(SCHEDULE_METRICS_KEY, {
        ...metrics,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      console.error('[schedulerStorage] saveMetrics failed:', err);
      throw err;
    }
  },

  async getMetrics(): Promise<any> {
    try {
      return (await get(SCHEDULE_METRICS_KEY)) ?? null;
    } catch (err) {
      console.error('[schedulerStorage] getMetrics failed:', err);
      throw err;
    }
  },

  // ── Cleanup & migration ──

  async clear(): Promise<void> {
    try {
      await del(TASKS_KEY);
      await del(EXECUTIONS_KEY);
      await del(SCHEDULE_METRICS_KEY);
    } catch (err) {
      console.error('[schedulerStorage] clear failed:', err);
      throw err;
    }
  },

  async getStorageSize(): Promise<{ tasks: number; executions: number }> {
    try {
      const tasks = Object.keys(((await get(TASKS_KEY)) as StoredTasks | undefined) || {}).length;
      const executions = Object.keys(((await get(EXECUTIONS_KEY)) as StoredExecutions | undefined) || {}).length;
      return { tasks, executions };
    } catch (err) {
      console.error('[schedulerStorage] getStorageSize failed:', err);
      throw err;
    }
  },
};
