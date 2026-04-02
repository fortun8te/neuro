/**
 * useScheduler — React hook for task scheduling
 * Provides UI access to scheduler with automatic persistence
 */

import { useState, useCallback, useEffect } from 'react';
import { scheduler, type ScheduledTask, type TaskExecution } from '../utils/scheduler';
import { schedulerStorage } from '../utils/schedulerStorage';
import type { TaskType, ScheduleType } from '../utils/scheduler';

export interface UseSchedulerReturn {
  tasks: ScheduledTask[];
  executions: TaskExecution[];
  metrics: {
    totalTasks: number;
    activeTasks: number;
    totalExecutions: number;
    failureRate: number;
    avgExecutionTime: number;
  };

  // Task management
  createTask: (
    name: string,
    type: TaskType,
    scheduleType: ScheduleType,
    parameters: Record<string, any>,
    options?: any
  ) => Promise<ScheduledTask>;
  updateTask: (id: string, updates: Partial<ScheduledTask>) => Promise<ScheduledTask>;
  deleteTask: (id: string) => Promise<void>;
  pauseTask: (id: string) => Promise<void>;
  resumeTask: (id: string) => Promise<void>;

  // Execution
  executeTaskNow: (id: string) => Promise<TaskExecution>;
  getExecutionHistory: (taskId?: string) => TaskExecution[];

  // Reload state
  reload: () => Promise<void>;
}

export function useScheduler(): UseSchedulerReturn {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);

  // Load initial state from storage
  useEffect(() => {
    const loadState = async () => {
      try {
        const storedTasks = await schedulerStorage.getAllTasks();
        setTasks(storedTasks);

        const history = await schedulerStorage.getExecutionHistory(undefined, 100);
        setExecutions(history);
      } catch (err) {
        console.error('[useScheduler] Failed to load state:', err);
      }
    };

    loadState();
  }, []);

  const createTask = useCallback(
    async (
      name: string,
      type: TaskType,
      scheduleType: ScheduleType,
      parameters: Record<string, any>,
      options?: any
    ): Promise<ScheduledTask> => {
      try {
        const task = scheduler.createTask(name, type, scheduleType, parameters, options);
        await schedulerStorage.saveTask(task);

        setTasks((prev) => [...prev, task]);
        return task;
      } catch (err) {
        console.error('[useScheduler] createTask failed:', err);
        throw err;
      }
    },
    []
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> => {
      try {
        const task = scheduler.updateTask(id, updates);
        await schedulerStorage.saveTask(task);

        setTasks((prev) =>
          prev.map((t) => (t.id === id ? task : t))
        );
        return task;
      } catch (err) {
        console.error('[useScheduler] updateTask failed:', err);
        throw err;
      }
    },
    []
  );

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    try {
      scheduler.deleteTask(id);
      await schedulerStorage.deleteTask(id);

      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('[useScheduler] deleteTask failed:', err);
      throw err;
    }
  }, []);

  const pauseTask = useCallback(async (id: string): Promise<void> => {
    try {
      scheduler.pauseTask(id);
      const task = scheduler.getTask(id);
      if (task) {
        await schedulerStorage.saveTask(task);
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? task : t))
        );
      }
    } catch (err) {
      console.error('[useScheduler] pauseTask failed:', err);
      throw err;
    }
  }, []);

  const resumeTask = useCallback(async (id: string): Promise<void> => {
    try {
      scheduler.resumeTask(id);
      const task = scheduler.getTask(id);
      if (task) {
        await schedulerStorage.saveTask(task);
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? task : t))
        );
      }
    } catch (err) {
      console.error('[useScheduler] resumeTask failed:', err);
      throw err;
    }
  }, []);

  const executeTaskNow = useCallback(
    async (id: string): Promise<TaskExecution> => {
      try {
        const execution = await scheduler.executeTask(id);
        await schedulerStorage.saveExecution(execution);

        setExecutions((prev) => [execution, ...prev].slice(0, 100));
        return execution;
      } catch (err) {
        console.error('[useScheduler] executeTaskNow failed:', err);
        throw err;
      }
    },
    []
  );

  const getExecutionHistory = useCallback((taskId?: string): TaskExecution[] => {
    if (taskId) {
      return executions.filter((e) => e.taskId === taskId);
    }
    return executions;
  }, [executions]);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const storedTasks = await schedulerStorage.getAllTasks();
      setTasks(storedTasks);

      const history = await schedulerStorage.getExecutionHistory(undefined, 100);
      setExecutions(history);
    } catch (err) {
      console.error('[useScheduler] reload failed:', err);
      throw err;
    }
  }, []);

  return {
    tasks,
    executions,
    metrics: scheduler.getMetrics(),
    createTask,
    updateTask,
    deleteTask,
    pauseTask,
    resumeTask,
    executeTaskNow,
    getExecutionHistory,
    reload,
  };
}
