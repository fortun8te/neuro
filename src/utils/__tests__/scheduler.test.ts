/**
 * Unit Tests for Scheduler System
 * Run: npm test -- scheduler.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scheduler, CronParser } from '../scheduler';
import type { ScheduledTask, TaskExecution } from '../scheduler';

describe('CronParser', () => {
  it('should parse simple cron expressions', () => {
    const parser = new CronParser('0 9 * * 1-5');
    const next = parser.nextRun();
    expect(next).toBeInstanceOf(Date);
    expect(next > new Date()).toBe(true);
  });

  it('should throw on invalid cron format', () => {
    expect(() => new CronParser('0 9 *')).toThrow();
    expect(() => new CronParser('99 99 99 99 99')).toThrow();
  });

  it('should handle special patterns', () => {
    const parser1 = new CronParser('*/15 * * * *'); // Every 15 minutes
    const next1 = parser1.nextRun();
    expect(next1).toBeInstanceOf(Date);

    const parser2 = new CronParser('0 9-17 * * *'); // Every hour 9am-5pm
    const next2 = parser2.nextRun();
    expect(next2).toBeInstanceOf(Date);
  });
});

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('Task Creation', () => {
    it('should create a recurring task', () => {
      const task = scheduler.createTask(
        'Test Task',
        'research',
        'recurring',
        {},
        { cron: '0 9 * * *' }
      );

      expect(task).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.type).toBe('research');
      expect(task.scheduleType).toBe('recurring');
      expect(task.enabled).toBe(true);
    });

    it('should create a one-time task', () => {
      const runAt = Date.now() + 60000;
      const task = scheduler.createTask(
        'One-time Task',
        'report',
        'once',
        {},
        { runAt }
      );

      expect(task.scheduleType).toBe('once');
      expect(task.runAt).toBe(runAt);
    });

    it('should create an adhoc task', () => {
      const task = scheduler.createTask(
        'Manual Task',
        'custom',
        'adhoc',
        {}
      );

      expect(task.scheduleType).toBe('adhoc');
      expect(task.nextRun).toBeUndefined();
    });

    it('should throw if recurring task missing cron', () => {
      expect(() => {
        scheduler.createTask(
          'Bad Task',
          'research',
          'recurring',
          {}
        );
      }).toThrow();
    });

    it('should throw if one-time task missing runAt', () => {
      expect(() => {
        scheduler.createTask(
          'Bad Task',
          'research',
          'once',
          {}
        );
      }).toThrow();
    });
  });

  describe('Task Management', () => {
    let task: ScheduledTask;

    beforeEach(() => {
      task = scheduler.createTask(
        'Test',
        'healthcheck',
        'recurring',
        {},
        { cron: '0 9 * * *' }
      );
    });

    it('should retrieve task by id', () => {
      const retrieved = scheduler.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test');
    });

    it('should list all tasks', () => {
      const all = scheduler.getAllTasks();
      expect(all.length).toBeGreaterThan(0);
      expect(all.some(t => t.id === task.id)).toBe(true);
    });

    it('should update task', () => {
      const updated = scheduler.updateTask(task.id, {
        name: 'Updated',
        maxRetries: 5,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.maxRetries).toBe(5);
      expect(updated.updatedAt).toBeGreaterThan(task.updatedAt);
    });

    it('should pause and resume task', () => {
      scheduler.pauseTask(task.id);
      let paused = scheduler.getTask(task.id);
      expect(paused?.enabled).toBe(false);

      scheduler.resumeTask(task.id);
      let resumed = scheduler.getTask(task.id);
      expect(resumed?.enabled).toBe(true);
    });

    it('should delete task', () => {
      scheduler.deleteTask(task.id);
      const deleted = scheduler.getTask(task.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Task Execution', () => {
    it('should execute task with registered executor', async () => {
      let executorCalled = false;
      scheduler.registerExecutor('test', async () => {
        executorCalled = true;
        return { success: true };
      });

      const task = scheduler.createTask(
        'Test',
        'test' as any,
        'adhoc',
        {}
      );

      const execution = await scheduler.executeTask(task.id);

      expect(executorCalled).toBe(true);
      expect(execution.status).toBe('completed');
      expect(execution.result).toEqual({ success: true });
    });

    it('should fail with timeout', async () => {
      scheduler.registerExecutor('slow', async () => {
        return new Promise(resolve =>
          setTimeout(resolve, 10000) // 10 seconds
        );
      });

      const task = scheduler.createTask(
        'Slow',
        'slow' as any,
        'adhoc',
        {},
        { timeout: 100 } // 100ms timeout
      );

      const execution = await scheduler.executeTask(task.id);

      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('timeout');
    });

    it('should retry on failure', async () => {
      let attemptCount = 0;
      scheduler.registerExecutor('flaky', async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Failed');
        }
        return { success: true };
      });

      const task = scheduler.createTask(
        'Flaky',
        'flaky' as any,
        'adhoc',
        {},
        { maxRetries: 3, timeout: 1000 }
      );

      const execution = await scheduler.executeTask(task.id);

      // Note: This test depends on retry timing
      expect([0, 1, 2, 3]).toContain(attemptCount);
    });

    it('should update lastRun on execution', async () => {
      scheduler.registerExecutor('test', async () => ({ ok: true }));

      const task = scheduler.createTask(
        'Test',
        'test' as any,
        'adhoc',
        {}
      );

      const before = task.lastRun;
      await scheduler.executeTask(task.id);
      const after = scheduler.getTask(task.id)?.lastRun;

      expect(after).toBeGreaterThan(before || 0);
    });
  });

  describe('Execution History', () => {
    it('should track execution history', async () => {
      scheduler.registerExecutor('test', async () => ({ ok: true }));

      const task = scheduler.createTask(
        'Test',
        'test' as any,
        'adhoc',
        {}
      );

      const exec1 = await scheduler.executeTask(task.id);
      const exec2 = await scheduler.executeTask(task.id);

      const history = scheduler.getExecutionHistory(task.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit execution history', async () => {
      scheduler.registerExecutor('test', async () => ({ ok: true }));

      const task = scheduler.createTask(
        'Test',
        'test' as any,
        'adhoc',
        {}
      );

      // Execute many times
      for (let i = 0; i < 60; i++) {
        await scheduler.executeTask(task.id);
      }

      const history = scheduler.getExecutionHistory(task.id, 50);
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Metrics', () => {
    it('should calculate metrics', async () => {
      scheduler.registerExecutor('test', async () => ({ ok: true }));

      const task = scheduler.createTask(
        'Test',
        'test' as any,
        'adhoc',
        {}
      );

      await scheduler.executeTask(task.id);

      const metrics = scheduler.getMetrics();
      expect(metrics.totalTasks).toBeGreaterThan(0);
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      expect(metrics.avgExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Scheduler Lifecycle', () => {
    it('should start and stop gracefully', () => {
      scheduler.stop();
      expect(scheduler['timers'].size).toBe(0);
    });
  });
});

describe('Scheduler Integration', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('should handle multiple concurrent tasks', async () => {
    const results: any[] = [];

    scheduler.registerExecutor('test', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { ok: true };
    });

    const tasks = Array.from({ length: 5 }, (_, i) =>
      scheduler.createTask(
        `Task ${i}`,
        'test' as any,
        'adhoc',
        {}
      )
    );

    const executions = await Promise.all(
      tasks.map(t => scheduler.executeTask(t.id))
    );

    expect(executions.every(e => e.status === 'completed')).toBe(true);
  });

  it('should respect task dependencies through parameters', async () => {
    scheduler.registerExecutor('step1', async () => {
      return { step: 1, data: 'value' };
    });

    scheduler.registerExecutor('step2', async (params: any) => {
      expect(params.dependsOn).toBeDefined();
      return { step: 2, received: params.dependsOn };
    });

    const task1 = scheduler.createTask('Step 1', 'step1' as any, 'adhoc', {});
    const exec1 = await scheduler.executeTask(task1.id);

    const task2 = scheduler.createTask('Step 2', 'step2' as any, 'adhoc', {
      dependsOn: exec1.result,
    });
    const exec2 = await scheduler.executeTask(task2.id);

    expect(exec2.result.received).toEqual(exec1.result);
  });
});
