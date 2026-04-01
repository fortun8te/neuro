/**
 * Session Checkpoint System Tests
 *
 * Verifies:
 * - Checkpoint creation and storage
 * - Session persistence
 * - Resume from checkpoint
 * - Checkpoint cleanup and pruning
 */

import { sessionCheckpoint, type Checkpoint, type SessionState } from '../sessionCheckpoint';

// Mock IndexedDB-keyval (in real tests, use the actual idb-keyval)
// For now, these are integration tests that verify the API shape

describe('sessionCheckpoint', () => {
  describe('Session Management', () => {
    test('should create a new session', async () => {
      const session = await sessionCheckpoint.createSession(
        'Test task',
        'campaign-123',
        'qwen3.5:4b',
        30
      );

      expect(session).toMatchObject({
        sessionId: expect.stringContaining('session-'),
        taskDescription: 'Test task',
        campaignId: 'campaign-123',
        model: 'qwen3.5:4b',
        totalSteps: 30,
        isResumed: false,
        status: 'in-progress',
        checkpoints: [],
      });

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });

    test('should load a session', async () => {
      const created = await sessionCheckpoint.createSession('Load test');
      const loaded = await sessionCheckpoint.loadSession(created.sessionId);

      expect(loaded).toMatchObject({
        sessionId: created.sessionId,
        taskDescription: 'Load test',
      });

      // Cleanup
      await sessionCheckpoint.deleteSession(created.sessionId);
    });

    test('should mark session as completed', async () => {
      const session = await sessionCheckpoint.createSession('Complete test');
      await sessionCheckpoint.completeSession(session.sessionId);
      const updated = await sessionCheckpoint.loadSession(session.sessionId);

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });

    test('should mark session as paused', async () => {
      const session = await sessionCheckpoint.createSession('Pause test');
      await sessionCheckpoint.pauseSession(session.sessionId);
      const updated = await sessionCheckpoint.loadSession(session.sessionId);

      expect(updated?.status).toBe('paused');

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });
  });

  describe('Checkpoint Operations', () => {
    test('should create and save a checkpoint', async () => {
      const session = await sessionCheckpoint.createSession('Checkpoint test');

      const checkpoint = await sessionCheckpoint.createCheckpoint(
        session.sessionId,
        5,
        {
          thinking: 'Test thinking',
          nextAction: 'Test action',
          context: { key: 'value' },
        },
        [], // steps
        [], // toolResults
        [{ key: 'memory-1', value: 'data' }],
        { var1: 'value1' }
      );

      await sessionCheckpoint.saveCheckpoint(checkpoint);

      const loaded = await sessionCheckpoint.loadCheckpoint(checkpoint.id);
      expect(loaded).toMatchObject({
        id: checkpoint.id,
        sessionId: session.sessionId,
        stepNumber: 5,
      });

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });

    test('should list all checkpoints for a session', async () => {
      const session = await sessionCheckpoint.createSession('List test');

      // Create multiple checkpoints
      for (let i = 1; i <= 3; i++) {
        const cp = await sessionCheckpoint.createCheckpoint(
          session.sessionId,
          i * 5,
          {
            thinking: `Thinking ${i}`,
            nextAction: `Action ${i}`,
            context: {},
          },
          [],
          [],
          [],
          {}
        );
        await sessionCheckpoint.saveCheckpoint(cp);
      }

      const checkpoints = await sessionCheckpoint.listCheckpoints(session.sessionId);
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].stepNumber).toBe(5);
      expect(checkpoints[2].stepNumber).toBe(15);

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });

    test('should get the latest checkpoint', async () => {
      const session = await sessionCheckpoint.createSession('Latest test');

      // Create checkpoints with delay
      let latest: Checkpoint | null = null;
      for (let i = 1; i <= 2; i++) {
        const cp = await sessionCheckpoint.createCheckpoint(
          session.sessionId,
          i * 5,
          {
            thinking: `Thinking ${i}`,
            nextAction: `Action ${i}`,
            context: {},
          },
          [],
          [],
          [],
          {}
        );
        await sessionCheckpoint.saveCheckpoint(cp);
        latest = cp;
      }

      const retrievedLatest = await sessionCheckpoint.getLatestCheckpoint(session.sessionId);
      expect(retrievedLatest?.stepNumber).toBe(10);

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });

    test('should delete a checkpoint', async () => {
      const session = await sessionCheckpoint.createSession('Delete test');

      const cp = await sessionCheckpoint.createCheckpoint(
        session.sessionId,
        5,
        {
          thinking: 'Test',
          nextAction: 'Test',
          context: {},
        },
        [],
        [],
        [],
        {}
      );
      await sessionCheckpoint.saveCheckpoint(cp);

      // Verify it exists
      let loaded = await sessionCheckpoint.loadCheckpoint(cp.id);
      expect(loaded).toBeDefined();

      // Delete it
      await sessionCheckpoint.deleteCheckpoint(cp.id);

      // Verify it's gone
      loaded = await sessionCheckpoint.loadCheckpoint(cp.id);
      expect(loaded).toBeNull();

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });

    test('should clear all checkpoints for a session', async () => {
      const session = await sessionCheckpoint.createSession('Clear test');

      // Create multiple checkpoints
      for (let i = 1; i <= 3; i++) {
        const cp = await sessionCheckpoint.createCheckpoint(
          session.sessionId,
          i * 5,
          {
            thinking: `Thinking ${i}`,
            nextAction: `Action ${i}`,
            context: {},
          },
          [],
          [],
          [],
          {}
        );
        await sessionCheckpoint.saveCheckpoint(cp);
      }

      // Clear them
      await sessionCheckpoint.clearCheckpoints(session.sessionId);

      // Verify they're gone
      const checkpoints = await sessionCheckpoint.listCheckpoints(session.sessionId);
      expect(checkpoints).toHaveLength(0);

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });
  });

  describe('Resume Functionality', () => {
    test('should resume a session from a checkpoint', async () => {
      const session = await sessionCheckpoint.createSession('Resume test');

      const cp = await sessionCheckpoint.createCheckpoint(
        session.sessionId,
        5,
        {
          thinking: 'Test',
          nextAction: 'Test',
          context: {},
        },
        [],
        [],
        [],
        {}
      );
      await sessionCheckpoint.saveCheckpoint(cp);

      // Resume from checkpoint
      await sessionCheckpoint.resumeSession(session.sessionId, cp.id);

      const updated = await sessionCheckpoint.loadSession(session.sessionId);
      expect(updated?.isResumed).toBe(true);
      expect(updated?.resumedFromCheckpointId).toBe(cp.id);
      expect(updated?.resumedAt).toBeDefined();

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });
  });

  describe('Session Listing', () => {
    test('should list all sessions', async () => {
      // Create multiple sessions
      const s1 = await sessionCheckpoint.createSession('Session 1');
      const s2 = await sessionCheckpoint.createSession('Session 2');
      const s3 = await sessionCheckpoint.createSession('Session 3');

      const sessions = await sessionCheckpoint.listSessions();
      const sessionIds = sessions.map((s) => s.sessionId);

      expect(sessionIds).toContain(s1.sessionId);
      expect(sessionIds).toContain(s2.sessionId);
      expect(sessionIds).toContain(s3.sessionId);

      // Cleanup
      await sessionCheckpoint.deleteSession(s1.sessionId);
      await sessionCheckpoint.deleteSession(s2.sessionId);
      await sessionCheckpoint.deleteSession(s3.sessionId);
    });
  });

  describe('Checkpoint Data Integrity', () => {
    test('should preserve complex checkpoint data', async () => {
      const session = await sessionCheckpoint.createSession('Data test');

      const complexMemory = [
        { key: 'research_findings', value: { topics: ['A', 'B', 'C'] } },
        { key: 'user_context', value: { preferences: { theme: 'dark' } } },
      ];

      const complexBlackboard = {
        executionPath: ['step1', 'step2', 'step3'],
        results: { success: true, data: [1, 2, 3] },
        metadata: { timestamp: Date.now(), version: '1.0' },
      };

      const cp = await sessionCheckpoint.createCheckpoint(
        session.sessionId,
        10,
        {
          thinking: 'Complex thinking',
          nextAction: 'Execute next step',
          context: { model: 'qwen3.5:4b', temperature: 0.7 },
        },
        [],
        [],
        complexMemory,
        complexBlackboard
      );

      await sessionCheckpoint.saveCheckpoint(cp);

      const loaded = await sessionCheckpoint.loadCheckpoint(cp.id);
      expect(loaded?.memory).toEqual(complexMemory);
      expect(loaded?.blackboard).toEqual(complexBlackboard);

      // Cleanup
      await sessionCheckpoint.deleteSession(session.sessionId);
    });
  });
});

// Export for manual testing
export { sessionCheckpoint };
