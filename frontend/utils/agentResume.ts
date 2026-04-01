/**
 * Agent Resume / Continue Command System
 *
 * Phase 2 Feature: Allow agents to resume from checkpoints after stop/crash
 *
 * Features:
 * - Auto-save checkpoint when agent stops or crashes
 * - Resume from last checkpoint with "continue" command
 * - Resume via UI button or chat message
 * - Restore full state and continue from step N+1
 */

import { sessionCheckpoint, type Checkpoint, type SessionState } from './sessionCheckpoint';
import type { AgentStep, ToolResult } from './agentEngine';

/**
 * Represents a resumable agent state snapshot
 */
export interface ResumableAgentState {
  sessionId: string;
  checkpointId: string;
  lastStepNumber: number;
  canResume: boolean;
  resumedBefore: boolean;
  savedAt: number;
  estimatedTimeRemaining?: number;
}

/**
 * Parse chat message for "continue" keyword
 * Matches: "continue", "resume", "continue from here", "resume from checkpoint", etc.
 */
export function parseResumeCommand(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const continuePatterns = [
    /^continue\b/,
    /\bcontinue\s*from\s*here\b/,
    /^resume\b/,
    /\bresume\s*from\b/,
    /^go\s+again\b/,
    /^retry\b/,
  ];

  return continuePatterns.some(pattern => pattern.test(normalized));
}

/**
 * Attempt to restore agent state from a checkpoint
 * Returns the restored state if successful, null if checkpoint not found
 */
export async function restoreFromCheckpoint(
  checkpointId: string
): Promise<{
  checkpoint: Checkpoint;
  session: SessionState;
} | null> {
  try {
    const checkpoint = await sessionCheckpoint.loadCheckpoint(checkpointId);
    if (!checkpoint) return null;

    const session = await sessionCheckpoint.loadSession(checkpoint.sessionId);
    if (!session) return null;

    return { checkpoint, session };
  } catch (err) {
    console.error('[agentResume] restoreFromCheckpoint failed:', err);
    return null;
  }
}

/**
 * Get the latest resumable checkpoint for a session
 * Returns null if no checkpoint exists or session not found
 */
export async function getLatestResumableCheckpoint(
  sessionId: string
): Promise<ResumableAgentState | null> {
  try {
    const checkpoint = await sessionCheckpoint.getLatestCheckpoint(sessionId);
    if (!checkpoint) return null;

    return {
      sessionId: checkpoint.sessionId,
      checkpointId: checkpoint.id,
      lastStepNumber: checkpoint.stepNumber,
      canResume: true,
      resumedBefore: false,
      savedAt: checkpoint.timestamp,
      estimatedTimeRemaining: checkpoint.estimatedTimeRemaining,
    };
  } catch (err) {
    console.error('[agentResume] getLatestResumableCheckpoint failed:', err);
    return null;
  }
}

/**
 * Check if user has a recent checkpoint they can resume from
 * Used to show "Continue?" button in UI
 */
export async function hasResumableCheckpoint(sessionId: string): Promise<boolean> {
  try {
    const checkpoint = await sessionCheckpoint.getLatestCheckpoint(sessionId);
    if (!checkpoint) return false;

    // Only allow resume if checkpoint is less than 24 hours old
    const hoursSinceCheckpoint = (Date.now() - checkpoint.timestamp) / (1000 * 60 * 60);
    return hoursSinceCheckpoint < 24;
  } catch (err) {
    console.error('[agentResume] hasResumableCheckpoint failed:', err);
    return false;
  }
}

/**
 * Auto-save a checkpoint when agent stops or crashes
 * Called from AgentPanel when user clicks "Stop" or agent crashes
 */
export async function autoSaveStopCheckpoint(
  sessionId: string,
  stepNumber: number,
  agentState: any,
  steps: AgentStep[],
  toolResults: ToolResult[],
  memory: Array<{ key: string; value: any }>,
  blackboard: Record<string, any>,
  label: string = 'Agent stopped'
): Promise<Checkpoint | null> {
  try {
    const checkpoint = await sessionCheckpoint.createCheckpoint(
      sessionId,
      stepNumber,
      agentState,
      steps,
      toolResults,
      memory,
      blackboard,
      undefined,
      undefined,
      label
    );

    await sessionCheckpoint.saveCheckpoint(checkpoint);

    // Mark session as paused
    await sessionCheckpoint.pauseSession(sessionId);

    console.log(`[agentResume] Auto-saved checkpoint ${checkpoint.id} for session ${sessionId}`);
    return checkpoint;
  } catch (err) {
    console.error('[agentResume] autoSaveStopCheckpoint failed:', err);
    return null;
  }
}

/**
 * Mark a session as resumed so we don't ask the user again
 */
export async function markSessionResumed(sessionId: string, checkpointId: string): Promise<void> {
  try {
    await sessionCheckpoint.resumeSession(sessionId, checkpointId);
  } catch (err) {
    console.error('[agentResume] markSessionResumed failed:', err);
  }
}

/**
 * Format resumable state for UI display
 * Example: "Step 23 of 45 — about 8 min remaining"
 */
export function formatResumableState(state: ResumableAgentState, totalSteps?: number): string {
  let msg = `Step ${state.lastStepNumber}`;

  if (totalSteps) {
    msg += ` of ${totalSteps}`;
  }

  if (state.estimatedTimeRemaining) {
    const minutes = Math.ceil(state.estimatedTimeRemaining / 60);
    msg += ` — about ${minutes} min remaining`;
  }

  return msg;
}

/**
 * Build a resume prompt that instructs the agent to continue from a checkpoint
 * Inserted at the start of the agent's context when resuming
 */
export function buildResumePrompt(checkpoint: Checkpoint): string {
  const steps = checkpoint.steps.length;
  const nextStep = checkpoint.stepNumber + 1;

  return `
[RESUMED FROM CHECKPOINT]
You are resuming execution from step ${checkpoint.stepNumber} (of ~${checkpoint.stepCount || 'unknown'} total).
You have already completed ${steps} steps. Do NOT repeat them.
Continue with step ${nextStep} and beyond.
Current progress: ${checkpoint.progress?.percentComplete || 0}% complete.
${checkpoint.agentState.context?.taskDescription ? `Task: ${checkpoint.agentState.context.taskDescription}` : ''}
`;
}
