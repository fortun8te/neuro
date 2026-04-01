/**
 * progressTracker.ts — Real-time progress tracking for long-running tools
 *
 * Manages progress emission during tool execution with periodic updates.
 * Used by the harness executor to notify UI of ongoing work (web_search,
 * browse, deep_research, etc.). Automatically stops at 90% until tool
 * completes, preventing false completion signals.
 */

import {
  PROGRESS_EMIT_INTERVAL_MS,
  MAX_PROGRESS_BEFORE_COMPLETION,
  LONG_RUNNING_TOOLS,
  PROGRESS_MESSAGE_MAP,
} from './harness/constants';

// ── Types ──────────────────────────────────────────────────────────────

/** Progress update event emitted periodically during tool execution */
export interface ProgressUpdate {
  /** Name of the tool being executed */
  toolName: string;
  /** Unique ID for this tool invocation */
  toolUseID: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Human-readable status message */
  message: string;
  /** Elapsed time in milliseconds since start */
  elapsedMs: number;
}

/** Callback invoked when progress is updated */
export type ProgressCallback = (update: ProgressUpdate) => void;

// ── Detectors & Formatters ────────────────────────────────────────────

/**
 * Detects if a tool is long-running and should emit progress updates.
 * Long-running tools get periodic status updates while executing.
 */
export function isLongRunningTool(toolName: string): boolean {
  return LONG_RUNNING_TOOLS.has(toolName);
}

/**
 * Gets a human-readable progress message for a tool with percentage.
 * Example: "Searching the web... 42%"
 */
export function getProgressMessage(toolName: string, percent: number): string {
  const base = PROGRESS_MESSAGE_MAP[toolName] || `Running ${toolName}`;
  return `${base}... ${Math.round(percent)}%`;
}

/**
 * ProgressTracker — Manages periodic progress updates during tool execution
 *
 * Emits progress updates at regular intervals, gradually incrementing from 0
 * to 90%. When the tool completes, emits final 100% update. This prevents
 * false completion signals while tool is still running.
 *
 * Usage:
 *   const tracker = new ProgressTracker('web_search', 'tc-123', onProgress);
 *   try {
 *     tracker.start();
 *     const result = await tool.execute(params);
 *     return result;
 *   } finally {
 *     tracker.stop();
 *   }
 */
export class ProgressTracker {
  private readonly toolName: string;
  private readonly toolUseID: string;
  private readonly onProgress: ProgressCallback | undefined;
  private readonly startTime: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private progress: number = 0;

  constructor(
    toolName: string,
    toolUseID: string,
    onProgress?: ProgressCallback,
  ) {
    this.toolName = toolName;
    this.toolUseID = toolUseID;
    this.onProgress = onProgress;
    this.startTime = Date.now();
  }

  /**
   * Start emitting periodic progress updates.
   * Only activates for long-running tools; fast tools skip updates.
   */
  start(): void {
    if (!isLongRunningTool(this.toolName)) {
      return; // Skip for fast tools
    }

    if (this.intervalHandle !== null) {
      return; // Already started
    }

    this.intervalHandle = setInterval(
      () => this.updateProgress(),
      PROGRESS_EMIT_INTERVAL_MS,
    );
  }

  /**
   * Stop emitting updates and emit final 100% completion signal.
   * Clears the interval and sets progress to 100%.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Emit final update at 100%
    this.progress = 100;
    this.emitProgress();
  }

  /**
   * Manually set progress to a specific percentage (0-100).
   * Clamps value to valid range and emits update.
   */
  setProgress(percent: number): void {
    this.progress = Math.min(Math.max(percent, 0), 100);
    this.emitProgress();
  }

  /**
   * Emit a manual progress update with custom message and optional percentage.
   * Useful for tool implementations to report custom milestones.
   */
  emit(message: string, percent?: number): void {
    if (percent !== undefined) {
      this.progress = Math.min(Math.max(percent, 0), 100);
    }
    if (!this.onProgress) return;

    this.onProgress({
      toolName: this.toolName,
      toolUseID: this.toolUseID,
      percent: this.progress,
      message,
      elapsedMs: Date.now() - this.startTime,
    });
  }

  /**
   * Get elapsed time in milliseconds since tracker start.
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Gradually increment progress, capping at 90% to prevent premature
   * completion signals. Adds random jitter to avoid linear appearance.
   */
  private updateProgress(): void {
    const increment = Math.random() * 15;
    this.progress = Math.min(
      this.progress + increment,
      MAX_PROGRESS_BEFORE_COMPLETION,
    );
    this.emitProgress();
  }

  /**
   * Internal helper to emit current progress with formatted message.
   */
  private emitProgress(): void {
    if (!this.onProgress) return;

    const message = getProgressMessage(this.toolName, this.progress);
    this.onProgress({
      toolName: this.toolName,
      toolUseID: this.toolUseID,
      percent: this.progress,
      message,
      elapsedMs: Date.now() - this.startTime,
    });
  }
}
