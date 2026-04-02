/**
 * ══════════════════════════════════════════════════════
 * CRASH RECOVERY MANAGER: Persist & resume from checkpoints
 * ══════════════════════════════════════════════════════
 *
 * Automatically saves checkpoints after each phase completes.
 * On crash, detects the failure and resumes from last checkpoint.
 * Zero data loss — all intermediate stages are recoverable.
 */

import { get, set, del } from 'idb-keyval';
import type { Cycle, StageName } from '../types';

export interface CycleCheckpoint {
  sessionId: string;
  cycleId: string;
  timestamp: number;
  lastCompletedPhase: StageName | null;
  phaseData: Record<StageName, unknown>;
  cyclePauseState?: Record<string, unknown>;
  crashDetectionMetadata?: {
    lastHeartbeat: number;
    isAlive: boolean;
  };
}

export interface CrashDetectionMetadata {
  lastHeartbeat: number;
  isAlive: boolean;
}

export interface CrashLogEntry {
  timestamp: number;
  sessionId: string;
  errorMessage: string;
  errorStack: string;
  recoveryDataAvailable: boolean;
}

/**
 * Crash Recovery Manager — Persists cycle state and recovers from crashes.
 *
 * USAGE:
 *   const recovery = new CrashRecoveryManager();
 *
 *   // On app load, detect prior crash
 *   const crashed = await recovery.detectCrash(sessionId);
 *   if (crashed) {
 *     const checkpoint = await recovery.loadCheckpoint(sessionId);
 *     const lastPhase = recovery.getLastCompletedPhase(checkpoint);
 *     // Skip to lastPhase + 1
 *   }
 *
 *   // After each phase completes
 *   await recovery.saveCheckpoint(sessionId, cycleData);
 *
 *   // On error
 *   await recovery.handleCrashGracefully(error, sessionId);
 */
export class CrashRecoveryManager {
  private readonly checkpointKeyPrefix = 'crash_checkpoint_';
  private readonly heartbeatKeyPrefix = 'heartbeat_';
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Detect if a prior cycle crashed.
   * Returns true if:
   * 1. A checkpoint exists for this sessionId AND
   * 2. No heartbeat received in the last 30 seconds
   */
  async detectCrash(sessionId: string): Promise<boolean> {
    try {
      const checkpoint = await get<CycleCheckpoint>(
        this.checkpointKeyPrefix + sessionId,
      );
      if (!checkpoint) return false; // No prior state

      const heartbeatKey = this.heartbeatKeyPrefix + sessionId;
      const lastHeartbeat = await get<number>(heartbeatKey);

      if (!lastHeartbeat) {
        // No heartbeat at all — likely a fresh session
        return false;
      }

      const timeSinceHeartbeat = Date.now() - lastHeartbeat;
      const crashThreshold = 30_000; // 30 seconds

      return timeSinceHeartbeat > crashThreshold;
    } catch (err) {
      console.error('[CrashRecovery] Error detecting crash:', err);
      return false;
    }
  }

  /**
   * Save a checkpoint after a phase completes.
   * Called after each stage finishes successfully.
   */
  async saveCheckpoint(
    sessionId: string,
    cycleData: Partial<Cycle>,
    lastCompletedPhase?: StageName,
  ): Promise<void> {
    try {
      const checkpoint: CycleCheckpoint = {
        sessionId,
        cycleId: cycleData.id || 'unknown',
        timestamp: Date.now(),
        lastCompletedPhase: lastCompletedPhase || null,
        phaseData: {
          research: cycleData.stages?.research || null,
          'brand-dna': cycleData.stages?.['brand-dna'] || null,
          'persona-dna': cycleData.stages?.['persona-dna'] || null,
          angles: cycleData.stages?.angles || null,
          strategy: cycleData.stages?.strategy || null,
          copywriting: cycleData.stages?.copywriting || null,
          production: cycleData.stages?.production || null,
          test: cycleData.stages?.test || null,
        } as Record<StageName, unknown>,
        cyclePauseState: (cycleData as unknown as { pauseState?: Record<string, unknown> }).pauseState,
      };

      const key = this.checkpointKeyPrefix + sessionId;
      await set(key, checkpoint);

      console.log(
        `[CrashRecovery] Checkpoint saved for cycle ${checkpoint.cycleId}, phase: ${lastCompletedPhase}`,
      );
    } catch (err) {
      console.error('[CrashRecovery] Error saving checkpoint:', err);
    }
  }

  /**
   * Load a checkpoint (called when resuming after crash).
   */
  async loadCheckpoint(sessionId: string): Promise<CycleCheckpoint | null> {
    try {
      const checkpoint = await get<CycleCheckpoint>(
        this.checkpointKeyPrefix + sessionId,
      );
      if (checkpoint) {
        console.log(
          `[CrashRecovery] Loaded checkpoint: cycle ${checkpoint.cycleId}, last phase: ${checkpoint.lastCompletedPhase}`,
        );
      }
      return checkpoint || null;
    } catch (err) {
      console.error('[CrashRecovery] Error loading checkpoint:', err);
      return null;
    }
  }

  /**
   * Get the last completed phase from a checkpoint.
   */
  getLastCompletedPhase(checkpoint: CycleCheckpoint): StageName | null {
    return checkpoint.lastCompletedPhase;
  }

  /**
   * Get the next phase to run after recovery.
   */
  getNextPhaseAfterCrash(checkpoint: CycleCheckpoint, allPhases: StageName[]): StageName | null {
    if (!checkpoint.lastCompletedPhase) {
      return allPhases[0] || null; // Start from beginning
    }

    const currentIndex = allPhases.indexOf(checkpoint.lastCompletedPhase);
    if (currentIndex === -1 || currentIndex === allPhases.length - 1) {
      return null; // No next phase
    }

    return allPhases[currentIndex + 1];
  }

  /**
   * Handle a crash gracefully.
   * Saves current error state and logs metadata for debugging.
   */
  async handleCrashGracefully(
    error: unknown,
    sessionId: string,
    cycleData?: Partial<Cycle>,
  ): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      console.error(
        `[CrashRecovery] Handling crash in session ${sessionId}:`,
        errorMessage,
      );
      console.error('[CrashRecovery] Stack:', errorStack);

      // Save current state as checkpoint for recovery
      if (cycleData) {
        await this.saveCheckpoint(sessionId, cycleData);
      }

      // Log to persistent store for analysis
      const crashLog = {
        timestamp: Date.now(),
        sessionId,
        errorMessage,
        errorStack: errorStack || 'no stack',
        recoveryDataAvailable: !!cycleData,
      };

      const crashLogsKey = 'crash_logs';
      let crashes = await get<typeof crashLog[]>(crashLogsKey);
      crashes = crashes ? [...crashes, crashLog] : [crashLog];

      // Keep last 100 crashes
      if (crashes.length > 100) {
        crashes = crashes.slice(-100);
      }

      await set(crashLogsKey, crashes);
      console.log(`[CrashRecovery] Crash logged. Total crashes on record: ${crashes.length}`);
    } catch (err) {
      console.error('[CrashRecovery] Error in handleCrashGracefully:', err);
    }
  }

  /**
   * Start heartbeat monitoring for a session.
   * Periodically updates the heartbeat so we can detect crashes.
   */
  startHeartbeat(sessionId: string, intervalMs: number = 10_000): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        const key = this.heartbeatKeyPrefix + sessionId;
        await set(key, Date.now());
      } catch (err) {
        console.error('[CrashRecovery] Error updating heartbeat:', err);
      }
    }, intervalMs);

    console.log(
      `[CrashRecovery] Heartbeat started for session ${sessionId} (interval: ${intervalMs}ms)`,
    );
  }

  /**
   * Stop heartbeat monitoring.
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[CrashRecovery] Heartbeat stopped');
    }
  }

  /**
   * Clear checkpoint for a session (e.g., after successful completion).
   */
  async clearCheckpoint(sessionId: string): Promise<void> {
    try {
      const key = this.checkpointKeyPrefix + sessionId;
      await del(key);
      const heartbeatKey = this.heartbeatKeyPrefix + sessionId;
      await del(heartbeatKey);
      console.log(
        `[CrashRecovery] Checkpoint and heartbeat cleared for session ${sessionId}`,
      );
    } catch (err) {
      console.error('[CrashRecovery] Error clearing checkpoint:', err);
    }
  }

  /**
   * Get all recent crashes (for debugging).
   */
  async getCrashHistory(): Promise<CrashLogEntry[] | null> {
    try {
      return await get<CrashLogEntry[]>('crash_logs');
    } catch (err) {
      console.error('[CrashRecovery] Error retrieving crash history:', err);
      return null;
    }
  }

  /**
   * Clear crash history (destructive).
   */
  async clearCrashHistory(): Promise<void> {
    try {
      await del('crash_logs');
      console.log('[CrashRecovery] Crash history cleared');
    } catch (err) {
      console.error('[CrashRecovery] Error clearing crash history:', err);
    }
  }
}

/**
 * Global crash recovery manager singleton.
 */
export const globalCrashRecoveryManager = new CrashRecoveryManager();
