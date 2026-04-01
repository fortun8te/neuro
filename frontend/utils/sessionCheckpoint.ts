/**
 * Session Checkpoint System — Save/restore agent execution state
 *
 * Provides complete session persistence:
 * - Save checkpoint state after each major agent step
 * - Resume from any checkpoint without losing context
 * - Full state restoration (memory, findings, previous results)
 * - IndexedDB-backed storage
 */

import { get, set, del } from 'idb-keyval';
import type { AgentStep, ToolCall, ToolResult } from './agentEngine';
import type { ResearchFindings } from '../types';

// ── Constants ──

const SESSIONS_KEY = 'agent_sessions';
const CHECKPOINTS_KEY = 'agent_checkpoints';
const MAX_CHECKPOINTS_PER_SESSION = 100; // prevent unbounded growth

// ── Types ──

export interface Checkpoint {
  id: string;                       // Unique checkpoint ID
  sessionId: string;                // Parent session
  timestamp: number;                // When checkpoint was created
  stepNumber: number;               // Which step in the sequence
  stepCount?: number;               // Total expected steps (if known)

  // Agent execution state at this point
  agentState: {
    thinking: string;               // Last thinking output
    nextAction: string;             // What the agent decided to do
    context: Record<string, any>;   // Execution context snapshot
    currentTool?: string;            // Tool being executed
  };

  // Full history up to this point
  steps: AgentStep[];               // All steps taken so far
  toolResults: ToolResult[];         // All tool execution results

  // Persistent data structures
  memory: Array<{ key: string; value: any }>;     // Long-term memory snapshots
  blackboard: Record<string, any>;                // Shared state/variables
  researchFindings?: ResearchFindings;            // Research output so far

  // Metadata
  label?: string;                   // User-given checkpoint name
  estimatedTimeRemaining?: number;  // Minutes estimated to completion
  progress?: {
    completed: number;              // Steps completed
    total: number;                  // Total steps expected
    percentComplete: number;         // 0-100
  };
}

export interface SessionState {
  sessionId: string;                // Unique session ID
  startTime: number;                // When session started
  lastCheckpointId?: string;        // Most recent checkpoint ID
  checkpoints: string[];            // Checkpoint IDs in order

  // Session metadata
  taskDescription?: string;         // What the agent is doing
  campaignId?: string;              // Associated campaign (if any)
  model?: string;                   // Which LLM model
  totalSteps?: number;              // Expected total steps
  elapsedMs?: number;               // Time spent so far

  // Resume state
  isResumed: boolean;               // true if resumed from checkpoint
  resumedFromCheckpointId?: string; // Which checkpoint was resumed from
  resumedAt?: number;               // When it was resumed

  // Session status
  status: 'in-progress' | 'completed' | 'paused' | 'cancelled';
  completedAt?: number;
  cancelledAt?: number;
}

// ── Write Queue for Serialization ──

let _checkpointWriteQueue: Promise<void> = Promise.resolve();

function enqueueCheckpointWrite(fn: () => Promise<void>): Promise<void> {
  _checkpointWriteQueue = _checkpointWriteQueue
    .catch(() => {/* previous failure — proceed */})
    .then(fn);
  return _checkpointWriteQueue;
}

// ── Checkpoint API ──

export const sessionCheckpoint = {
  // Create a new checkpoint from current state
  async createCheckpoint(
    sessionId: string,
    stepNumber: number,
    agentState: Checkpoint['agentState'],
    steps: AgentStep[],
    toolResults: ToolResult[],
    memory: Array<{ key: string; value: any }>,
    blackboard: Record<string, any>,
    researchFindings?: ResearchFindings,
    estimatedTimeRemaining?: number,
    label?: string
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: `${sessionId}-cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sessionId,
      timestamp: Date.now(),
      stepNumber,
      agentState,
      steps,
      toolResults,
      memory,
      blackboard,
      researchFindings,
      label,
      estimatedTimeRemaining,
      progress: {
        completed: steps.length,
        total: (blackboard.expectedTotalSteps as number) ?? steps.length + 5,
        percentComplete: Math.round(
          (steps.length / ((blackboard.expectedTotalSteps as number) ?? steps.length + 5)) * 100
        ),
      },
    };

    return checkpoint;
  },

  // Save checkpoint to IndexedDB
  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    return enqueueCheckpointWrite(async () => {
      try {
        // Store the checkpoint itself
        const key = `${CHECKPOINTS_KEY}:${checkpoint.id}`;
        await set(key, checkpoint);

        // Update session's checkpoint list
        const sessions = (await get(SESSIONS_KEY)) || {};
        if (!sessions[checkpoint.sessionId]) {
          sessions[checkpoint.sessionId] = {
            sessionId: checkpoint.sessionId,
            startTime: Date.now(),
            checkpoints: [],
            isResumed: false,
            status: 'in-progress',
          };
        }

        const session = sessions[checkpoint.sessionId] as SessionState;
        if (!session.checkpoints.includes(checkpoint.id)) {
          session.checkpoints.push(checkpoint.id);
        }
        session.lastCheckpointId = checkpoint.id;
        session.elapsedMs = Date.now() - session.startTime;

        // Prune old checkpoints if needed
        if (session.checkpoints.length > MAX_CHECKPOINTS_PER_SESSION) {
          const toRemove = session.checkpoints.slice(0, session.checkpoints.length - MAX_CHECKPOINTS_PER_SESSION);
          for (const cpId of toRemove) {
            await del(`${CHECKPOINTS_KEY}:${cpId}`);
          }
          session.checkpoints = session.checkpoints.slice(-MAX_CHECKPOINTS_PER_SESSION);
        }

        await set(SESSIONS_KEY, sessions);
      } catch (err) {
        console.error('[sessionCheckpoint] saveCheckpoint failed:', err);
        throw err;
      }
    });
  },

  // Load a specific checkpoint
  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const key = `${CHECKPOINTS_KEY}:${checkpointId}`;
      return (await get(key)) ?? null;
    } catch (err) {
      console.error('[sessionCheckpoint] loadCheckpoint failed:', err);
      throw err;
    }
  },

  // List all checkpoints for a session
  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    try {
      const sessions = (await get(SESSIONS_KEY)) || {};
      const session = sessions[sessionId] as SessionState | undefined;
      if (!session) return [];

      const checkpoints: Checkpoint[] = [];
      for (const cpId of session.checkpoints) {
        const cp = await this.loadCheckpoint(cpId);
        if (cp) checkpoints.push(cp);
      }
      return checkpoints;
    } catch (err) {
      console.error('[sessionCheckpoint] listCheckpoints failed:', err);
      throw err;
    }
  },

  // Get the most recent checkpoint for a session
  async getLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
    try {
      const checkpoints = await this.listCheckpoints(sessionId);
      return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    } catch (err) {
      console.error('[sessionCheckpoint] getLatestCheckpoint failed:', err);
      throw err;
    }
  },

  // Delete a specific checkpoint
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    return enqueueCheckpointWrite(async () => {
      try {
        const key = `${CHECKPOINTS_KEY}:${checkpointId}`;
        await del(key);

        // Remove from session's checkpoint list
        const sessions = (await get(SESSIONS_KEY)) || {};
        for (const session of Object.values(sessions) as SessionState[]) {
          const idx = session.checkpoints.indexOf(checkpointId);
          if (idx > -1) {
            session.checkpoints.splice(idx, 1);
          }
        }
        await set(SESSIONS_KEY, sessions);
      } catch (err) {
        console.error('[sessionCheckpoint] deleteCheckpoint failed:', err);
        throw err;
      }
    });
  },

  // Clear all checkpoints for a session
  async clearCheckpoints(sessionId: string): Promise<void> {
    return enqueueCheckpointWrite(async () => {
      try {
        const sessions = (await get(SESSIONS_KEY)) || {};
        const session = sessions[sessionId] as SessionState | undefined;
        if (!session) return;

        for (const cpId of session.checkpoints) {
          await del(`${CHECKPOINTS_KEY}:${cpId}`);
        }
        session.checkpoints = [];
        session.lastCheckpointId = undefined;

        await set(SESSIONS_KEY, sessions);
      } catch (err) {
        console.error('[sessionCheckpoint] clearCheckpoints failed:', err);
        throw err;
      }
    });
  },

  // ── Session Management ──

  // Create a new session
  async createSession(
    taskDescription?: string,
    campaignId?: string,
    model?: string,
    totalSteps?: number
  ): Promise<SessionState> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const session: SessionState = {
      sessionId,
      startTime: Date.now(),
      taskDescription,
      campaignId,
      model,
      totalSteps,
      isResumed: false,
      status: 'in-progress',
      checkpoints: [],
    };

    try {
      const sessions = (await get(SESSIONS_KEY)) || {};
      sessions[sessionId] = session;
      await set(SESSIONS_KEY, sessions);
      return session;
    } catch (err) {
      console.error('[sessionCheckpoint] createSession failed:', err);
      throw err;
    }
  },

  // Load session state
  async loadSession(sessionId: string): Promise<SessionState | null> {
    try {
      const sessions = (await get(SESSIONS_KEY)) || {};
      return sessions[sessionId] ?? null;
    } catch (err) {
      console.error('[sessionCheckpoint] loadSession failed:', err);
      throw err;
    }
  },

  // Resume from a checkpoint
  async resumeSession(sessionId: string, checkpointId: string): Promise<SessionState | null> {
    let result: SessionState | null = null;
    await enqueueCheckpointWrite(async () => {
      try {
        const sessions = (await get(SESSIONS_KEY)) || {};
        const session = sessions[sessionId] as SessionState | undefined;
        if (!session) {
          result = null;
          return;
        }

        session.isResumed = true;
        session.resumedFromCheckpointId = checkpointId;
        session.resumedAt = Date.now();
        await set(SESSIONS_KEY, sessions);
        result = session;
      } catch (err) {
        console.error('[sessionCheckpoint] resumeSession failed:', err);
        throw err;
      }
    });
    return result;
  },

  // Mark session as completed
  async completeSession(sessionId: string): Promise<void> {
    await enqueueCheckpointWrite(async () => {
      try {
        const sessions = (await get(SESSIONS_KEY)) || {};
        const session = sessions[sessionId] as SessionState | undefined;
        if (session) {
          session.status = 'completed';
          session.completedAt = Date.now();
          session.elapsedMs = Date.now() - session.startTime;
          await set(SESSIONS_KEY, sessions);
        }
      } catch (err) {
        console.error('[sessionCheckpoint] completeSession failed:', err);
        throw err;
      }
    });
  },

  // Mark session as paused
  async pauseSession(sessionId: string): Promise<void> {
    await enqueueCheckpointWrite(async () => {
      try {
        const sessions = (await get(SESSIONS_KEY)) || {};
        const session = sessions[sessionId] as SessionState | undefined;
        if (session) {
          session.status = 'paused';
          session.elapsedMs = Date.now() - session.startTime;
          await set(SESSIONS_KEY, sessions);
        }
      } catch (err) {
        console.error('[sessionCheckpoint] pauseSession failed:', err);
        throw err;
      }
    });
  },

  // List all active sessions
  async listSessions(): Promise<SessionState[]> {
    try {
      const sessions = (await get(SESSIONS_KEY)) || {};
      return Object.values(sessions) as SessionState[];
    } catch (err) {
      console.error('[sessionCheckpoint] listSessions failed:', err);
      throw err;
    }
  },

  // Delete a session and all its checkpoints
  async deleteSession(sessionId: string): Promise<void> {
    return enqueueCheckpointWrite(async () => {
      try {
        // Delete all checkpoints
        await this.clearCheckpoints(sessionId);

        // Delete session
        const sessions = (await get(SESSIONS_KEY)) || {};
        delete sessions[sessionId];
        await set(SESSIONS_KEY, sessions);
      } catch (err) {
        console.error('[sessionCheckpoint] deleteSession failed:', err);
        throw err;
      }
    });
  },
};
