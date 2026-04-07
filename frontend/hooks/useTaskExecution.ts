/**
 * useTaskExecution — Hook for executing tasks with crash recovery
 *
 * Runs task's prompt through full research → objections → taste → make → test → memories cycle
 * Updates task progress and checkpoints via taskExecutor
 * Records heartbeats to prevent timeout crashes
 */

import { useCallback, useRef, useEffect } from 'react';
import * as taskExecutor from '../utils/taskExecutor';
import { useCycleLoop } from './useCycleLoop';

interface UseTaskExecutionOptions {
  onProgress?: (phase: string, progress: number) => void;
  onError?: (error: string) => void;
  onComplete?: (result: string) => void;
}

export function useTaskExecution(options: UseTaskExecutionOptions = {}) {
  const { onProgress, onError, onComplete } = options;
  const activeTaskRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get research cycle loop
  const { runCycle } = useCycleLoop();

  // Execute a task end-to-end
  const executeTask = useCallback(async (taskId: string) => {
    try {
      activeTaskRef.current = taskId;
      abortControllerRef.current = new AbortController();

      // Get task details
      const task = await taskExecutor.getTask(taskId);
      if (!task) throw new Error('Task not found');

      // Start task
      await taskExecutor.startTask(taskId);

      // Record initial checkpoint
      await taskExecutor.addCheckpoint(
        taskId,
        'Starting research cycle',
        0,
        { startedAt: Date.now() }
      );

      // Set up progress callback
      const progressCallback = (phase: string, progress: number) => {
        taskExecutor.recordHeartbeat(taskId);
        taskExecutor.addCheckpoint(taskId, phase, progress);
        onProgress?.(phase, progress);
      };

      // Run the full cycle with the task prompt
      // The prompt is treated as the research question/objective
      const result = await runCycle(
        {
          userInput: task.prompt,
          abortSignal: abortControllerRef.current.signal,
        },
        progressCallback
      );

      // Complete task
      await taskExecutor.completeTask(taskId, JSON.stringify(result, null, 2));
      onComplete?.(JSON.stringify(result));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if this is a user abort vs actual crash
      if (error instanceof Error && error.message !== 'Aborted') {
        // Real error — call failTask which handles retries
        await taskExecutor.failTask(taskId, errorMsg);
      } else if (error instanceof Error && error.message === 'Aborted') {
        // User paused — don't mark as failed
        await taskExecutor.pauseTask(taskId);
      }

      onError?.(errorMsg);
    } finally {
      activeTaskRef.current = null;
      abortControllerRef.current = null;
    }
  }, [runCycle, onProgress, onError, onComplete]);

  // Resume a paused or failed task from last checkpoint
  const resumeTask = useCallback(async (taskId: string) => {
    try {
      // Check if task can resume
      const task = await taskExecutor.getTask(taskId);
      if (!task) throw new Error('Task not found');

      // Resume from last checkpoint
      const lastCheckpoint = await taskExecutor.getLastCheckpoint(taskId);
      if (lastCheckpoint) {
        console.log(`Resuming task ${taskId} from checkpoint: ${lastCheckpoint.phase} (${lastCheckpoint.progress}%)`);
      }

      // Re-run the task (will pick up from checkpoint in the cycle logic)
      await executeTask(taskId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      onError?.(errorMsg);
    }
  }, [executeTask, onError]);

  // Pause current task
  const pauseTask = useCallback(async (taskId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    await taskExecutor.pauseTask(taskId);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    executeTask,
    resumeTask,
    pauseTask,
    isExecuting: activeTaskRef.current !== null,
  };
}
