/**
 * useSessionState — Hook for session persistence and checkpoint management
 *
 * Provides:
 * - Session lifecycle management
 * - Checkpoint creation and restoration
 * - Auto-save at regular intervals
 * - Resume from previous session
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { sessionCheckpoint, type Checkpoint, type SessionState } from '../utils/sessionCheckpoint';
import type { AgentStep, ToolResult } from '../utils/agentEngine';
import type { ResearchFindings } from '../types';

export interface SessionConfig {
  taskDescription?: string;
  campaignId?: string;
  model?: string;
  totalSteps?: number;
  autoSaveIntervalMs?: number;  // Default 60000 (1 minute)
  checkpointIntervalSteps?: number;  // Default 5
}

export interface UseSessionStateReturn {
  // Current state
  sessionId: string | null;
  session: SessionState | null;
  checkpoints: Checkpoint[];
  latestCheckpoint: Checkpoint | null;

  // Control methods
  startSession(config: SessionConfig): Promise<void>;
  createCheckpoint(
    stepNumber: number,
    agentState: any,
    steps: AgentStep[],
    toolResults: ToolResult[],
    memory: Array<{ key: string; value: any }>,
    blackboard: Record<string, any>,
    researchFindings?: ResearchFindings,
    estimatedTimeRemaining?: number,
    label?: string
  ): Promise<void>;
  resumeFromCheckpoint(checkpointId: string): Promise<void>;
  listCheckpoints(): Promise<Checkpoint[]>;
  deleteCheckpoint(checkpointId: string): Promise<void>;
  completeSession(): Promise<void>;
  pauseSession(): Promise<void>;
  deleteSession(): Promise<void>;

  // Status
  loading: boolean;
  error: string | null;
  checkpointSaved: boolean;
}

export function useSessionState(): UseSessionStateReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [latestCheckpoint, setLatestCheckpoint] = useState<Checkpoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointSaved, setCheckpointSaved] = useState(false);

  // Track mount state to avoid setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Auto-save interval
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkpointCounterRef = useRef(0);

  // Start a new session
  const startSession = useCallback(async (config: SessionConfig) => {
    try {
      setLoading(true);
      const newSession = await sessionCheckpoint.createSession(
        config.taskDescription,
        config.campaignId,
        config.model,
        config.totalSteps
      );

      if (mountedRef.current) {
        setSessionId(newSession.sessionId);
        setSession(newSession);
        setCheckpoints([]);
        setLatestCheckpoint(null);
        setError(null);
        checkpointCounterRef.current = 0;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      if (mountedRef.current) {
        setError(msg);
        console.error('[useSessionState] startSession error:', err);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Create checkpoint
  const createCheckpoint = useCallback(
    async (
      stepNumber: number,
      agentState: any,
      steps: AgentStep[],
      toolResults: ToolResult[],
      memory: Array<{ key: string; value: any }>,
      blackboard: Record<string, any>,
      researchFindings?: ResearchFindings,
      estimatedTimeRemaining?: number,
      label?: string
    ) => {
      if (!sessionId) return;

      try {
        setLoading(true);
        const checkpoint = await sessionCheckpoint.createCheckpoint(
          sessionId,
          stepNumber,
          agentState,
          steps,
          toolResults,
          memory,
          blackboard,
          researchFindings,
          estimatedTimeRemaining,
          label
        );

        await sessionCheckpoint.saveCheckpoint(checkpoint);

        // Reload session and checkpoints
        const updatedSession = await sessionCheckpoint.loadSession(sessionId);
        const updatedCheckpoints = await sessionCheckpoint.listCheckpoints(sessionId);
        const latest = await sessionCheckpoint.getLatestCheckpoint(sessionId);

        if (mountedRef.current) {
          setSession(updatedSession);
          setCheckpoints(updatedCheckpoints);
          setLatestCheckpoint(latest);
          setError(null);
          setCheckpointSaved(true);
          setTimeout(() => {
            if (mountedRef.current) setCheckpointSaved(false);
          }, 2000);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create checkpoint';
        if (mountedRef.current) {
          setError(msg);
          console.error('[useSessionState] createCheckpoint error:', err);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [sessionId]
  );

  // Resume from checkpoint
  const resumeFromCheckpoint = useCallback(
    async (checkpointId: string) => {
      if (!sessionId) return;

      try {
        setLoading(true);
        await sessionCheckpoint.resumeSession(sessionId, checkpointId);

        const updatedSession = await sessionCheckpoint.loadSession(sessionId);
        if (mountedRef.current) {
          setSession(updatedSession);
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to resume from checkpoint';
        if (mountedRef.current) {
          setError(msg);
          console.error('[useSessionState] resumeFromCheckpoint error:', err);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [sessionId]
  );

  // List checkpoints
  const listCheckpoints = useCallback(async (): Promise<Checkpoint[]> => {
    if (!sessionId) return [];

    try {
      const cps = await sessionCheckpoint.listCheckpoints(sessionId);
      if (mountedRef.current) {
        setCheckpoints(cps);
        setError(null);
      }
      return cps;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to list checkpoints';
      if (mountedRef.current) {
        setError(msg);
        console.error('[useSessionState] listCheckpoints error:', err);
      }
      return [];
    }
  }, [sessionId]);

  // Delete checkpoint
  const deleteCheckpoint = useCallback(
    async (checkpointId: string) => {
      try {
        setLoading(true);
        await sessionCheckpoint.deleteCheckpoint(checkpointId);

        // Reload checkpoints
        const updatedCheckpoints = sessionId
          ? await sessionCheckpoint.listCheckpoints(sessionId)
          : [];

        if (mountedRef.current) {
          setCheckpoints(updatedCheckpoints);
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete checkpoint';
        if (mountedRef.current) {
          setError(msg);
          console.error('[useSessionState] deleteCheckpoint error:', err);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [sessionId]
  );

  // Complete session
  const completeSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await sessionCheckpoint.completeSession(sessionId);
      const updatedSession = await sessionCheckpoint.loadSession(sessionId);
      if (mountedRef.current) {
        setSession(updatedSession);
        setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete session';
      if (mountedRef.current) {
        setError(msg);
        console.error('[useSessionState] completeSession error:', err);
      }
    }
  }, [sessionId]);

  // Pause session
  const pauseSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await sessionCheckpoint.pauseSession(sessionId);
      const updatedSession = await sessionCheckpoint.loadSession(sessionId);
      if (mountedRef.current) {
        setSession(updatedSession);
        setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause session';
      if (mountedRef.current) {
        setError(msg);
        console.error('[useSessionState] pauseSession error:', err);
      }
    }
  }, [sessionId]);

  // Delete session
  const deleteSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await sessionCheckpoint.deleteSession(sessionId);
      if (mountedRef.current) {
        setSessionId(null);
        setSession(null);
        setCheckpoints([]);
        setLatestCheckpoint(null);
        setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete session';
      if (mountedRef.current) {
        setError(msg);
        console.error('[useSessionState] deleteSession error:', err);
      }
    }
  }, [sessionId]);

  // Cleanup auto-save interval on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, []);

  return {
    sessionId,
    session,
    checkpoints,
    latestCheckpoint,
    startSession,
    createCheckpoint,
    resumeFromCheckpoint,
    listCheckpoints,
    deleteCheckpoint,
    completeSession,
    pauseSession,
    deleteSession,
    loading,
    error,
    checkpointSaved,
  };
}
