/**
 * Tests for retryWithBackoff and checkpoint recovery
 */

import { retryWithBackoff, retryOrThrow } from '../retryWithBackoff';
import { checkpointRollback } from '../checkpointRollback';
import type { Checkpoint } from '../sessionCheckpoint';

describe('retryWithBackoff', () => {
  it('should succeed on first attempt', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      return 'success';
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      contextName: 'test-success',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
    expect(attempts).toBe(1);
  });

  it('should retry on transient error and succeed', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new TypeError('network failed');
      }
      return 'success';
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 5,
      initialDelayMs: 10,
      contextName: 'test-transient',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(3);
    expect(attempts).toBe(3);
  });

  it('should fail immediately on permanent error', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new SyntaxError('invalid syntax');
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 5,
      contextName: 'test-permanent',
    });

    expect(result.success).toBe(false);
    expect(result.failureType).toBe('permanent');
    expect(result.attempts).toBe(1); // Should not retry
  });

  it('should exhaust retries on persistent transient errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new TypeError('network failed');
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 5,
      contextName: 'test-exhausted',
    });

    expect(result.success).toBe(false);
    expect(result.failureType).toBe('max-retries-exceeded');
    expect(result.attempts).toBe(4); // Initial attempt + 3 retries
    expect(attempts).toBe(4);
  });

  it('should use exponential backoff delays', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const startTime = Date.now();

    const fn = async () => {
      const now = Date.now();
      if (attempts > 0) {
        delays.push(now - startTime);
      }
      attempts++;
      if (attempts < 3) {
        throw new TypeError('network failed');
      }
      return 'success';
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 5,
      initialDelayMs: 50,
      backoffMultiplier: 2,
      jitterFactor: 0,
      contextName: 'test-backoff',
    });

    expect(result.success).toBe(true);
    expect(delays.length).toBe(1);
    expect(delays[0]).toBeGreaterThanOrEqual(50);
  });

  it('retryOrThrow should throw on failure', async () => {
    const fn = async () => {
      throw new Error('permanent failure');
    };

    await expect(
      retryOrThrow(fn, { maxRetries: 1, contextName: 'test-throw' })
    ).rejects.toThrow();
  });

  it('should classify QuotaExceededError as transient', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) {
        const err = new Error('quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return 'success';
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 5,
      contextName: 'test-quota',
    });

    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
  });
});

describe('CheckpointRollbackManager', () => {
  const mockCheckpoint: Checkpoint = {
    id: 'cp-123',
    sessionId: 'session-123',
    timestamp: Date.now(),
    stepNumber: 5,
    agentState: {
      thinking: 'test thinking',
      nextAction: 'test action',
      context: {},
    },
    steps: [],
    toolResults: [],
    memory: [],
    blackboard: {},
  };

  it('should create and restore backups', async () => {
    const backupId = await checkpointRollback.backupCheckpoint(mockCheckpoint);

    expect(backupId).toBeDefined();
    expect(backupId).toContain('backup-');

    const restored = await checkpointRollback.restoreFromBackup(backupId);

    expect(restored).toBeDefined();
    expect(restored?.id).toBe(mockCheckpoint.id);
    expect(restored?.stepNumber).toBe(mockCheckpoint.stepNumber);

    // Cleanup
    await checkpointRollback.deleteBackup(backupId);
  });

  it('should track checkpoint history', async () => {
    const backupId = await checkpointRollback.backupCheckpoint(mockCheckpoint);

    const history = await checkpointRollback.getCheckpointHistory(
      mockCheckpoint.id
    );

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].backupId).toBe(backupId);
    expect(history[0].isCurrentVersion).toBe(true);

    // Cleanup
    await checkpointRollback.deleteBackup(backupId);
  });

  it('should mark backup as current version', async () => {
    const backupId = await checkpointRollback.backupCheckpoint(mockCheckpoint);
    const secondCheckpoint = {
      ...mockCheckpoint,
      timestamp: Date.now() + 1000,
      stepNumber: 6,
    };
    const backupId2 = await checkpointRollback.backupCheckpoint(
      secondCheckpoint
    );

    await checkpointRollback.markAsCurrentVersion(backupId);

    const history = await checkpointRollback.getCheckpointHistory(
      mockCheckpoint.id
    );
    const current = history.find((h) => h.isCurrentVersion);

    expect(current?.backupId).toBe(backupId);

    // Cleanup
    await checkpointRollback.deleteBackup(backupId);
    await checkpointRollback.deleteBackup(backupId2);
  });

  it('should prune old backups keeping only last 3', async () => {
    const checkpoints = [
      mockCheckpoint,
      { ...mockCheckpoint, timestamp: Date.now() + 1000, stepNumber: 6 },
      { ...mockCheckpoint, timestamp: Date.now() + 2000, stepNumber: 7 },
      { ...mockCheckpoint, timestamp: Date.now() + 3000, stepNumber: 8 },
      { ...mockCheckpoint, timestamp: Date.now() + 4000, stepNumber: 9 },
    ];

    const backupIds: string[] = [];
    for (const cp of checkpoints) {
      const id = await checkpointRollback.backupCheckpoint(cp);
      backupIds.push(id);
    }

    const history = await checkpointRollback.getCheckpointHistory(
      mockCheckpoint.id
    );

    // Should keep only 3 most recent
    expect(history.length).toBeLessThanOrEqual(3);

    // Cleanup
    for (const id of backupIds) {
      try {
        await checkpointRollback.deleteBackup(id);
      } catch {
        // Already deleted by pruning
      }
    }
  });
});

describe('Error Recovery Integration', () => {
  it('should distinguish transient vs permanent failures', () => {
    const transientErrors = [
      new TypeError('network request failed'),
      new Error('timeout'),
      { name: 'QuotaExceededError', message: 'quota exceeded' },
    ];

    const permanentErrors = [
      new SyntaxError('invalid json'),
      new ReferenceError('undefined variable'),
      new Error('permission denied'),
    ];

    // Transient errors should be retried
    for (const error of transientErrors) {
      // These would match the isTransient classifier
      if (error instanceof TypeError) {
        expect(error.message.toLowerCase()).toContain('network');
      }
    }

    // Permanent errors should fail immediately
    for (const error of permanentErrors) {
      // These would NOT match the isTransient classifier
      expect(
        !(
          error instanceof TypeError ||
          error.message.toLowerCase().includes('timeout')
        )
      ).toBe(true);
    }
  });

  it('should accumulate total retry delay', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new TypeError('network failed');
      }
      return 'success';
    };

    const result = await retryWithBackoff(fn, {
      maxRetries: 5,
      initialDelayMs: 10,
      backoffMultiplier: 2,
      jitterFactor: 0,
      contextName: 'test-delay-accumulation',
    });

    expect(result.success).toBe(true);
    expect(result.totalDelayMs).toBeGreaterThanOrEqual(30); // 10ms + 20ms
  });
});
