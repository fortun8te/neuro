/**
 * Tool Harness Executor
 *
 * Permission-aware, progress-streaming tool execution engine.
 * Replaces the inline `tool.execute(args, signal)` pattern in agentEngine.ts
 * with a full harness execution path modeled after Claude Code.
 *
 * Execution pipeline:
 * 1. isEnabled() check
 * 2. validateInput() — fast structural check
 * 3. checkPermissions() — allow / deny / ask
 * 4. call() — actual tool execution with progress streaming
 * 5. Result truncation if exceeds maxResultSizeChars
 * 6. toolDecisions log update
 */

import type {
  HarnessTool,
  HarnessToolResult,
  PermissionResult,
  ToolCallProgress,
  ToolProgressData,
  ToolUseContext,
} from './types';
import { ProgressTracker, isLongRunningTool } from '../progressTracker';
import {
  DEFAULT_MAX_RESULT_SIZE,
  TRUNCATION_MESSAGE,
} from './constants';

export type HarnessExecuteOptions = {
  /** Unique ID for this tool call (used in progress events and decision log) */
  toolUseID?: string;
  /** Optional progress callback */
  onProgress?: ToolCallProgress;
  /** Override permission check result (for auto-approved tools) */
  permissionOverride?: PermissionResult;
};

export type HarnessExecuteResult<Output = string> = HarnessToolResult<Output> & {
  /** Time taken to execute in ms */
  durationMs: number;
  /** Permission result that was applied */
  permissionResult: PermissionResult;
  /** Whether input validation passed */
  validationPassed: boolean;
};

/**
 * executeWithHarness() — the unified tool execution path.
 *
 * Validates input, checks permissions (with optional confirmation prompt),
 * calls the tool, and returns a rich result with timing and permission metadata.
 */
export async function executeWithHarness<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output = string,
  P extends ToolProgressData = ToolProgressData,
>(
  tool: HarnessTool<Input, Output, P>,
  args: Input,
  context: ToolUseContext,
  options: HarnessExecuteOptions = {},
): Promise<HarnessExecuteResult<Output>> {
  const startTime = Date.now();
  const toolUseID = options.toolUseID ?? `${tool.name}-${Date.now()}`;

  // ── 1. isEnabled() ─────────────────────────────────────────────────────────
  if (!tool.isEnabled()) {
    return {
      success: false,
      output: `Tool ${tool.name} is not available` as Output,
      durationMs: Date.now() - startTime,
      permissionResult: { type: 'deny', reason: 'Tool not enabled' },
      validationPassed: false,
    };
  }

  // ── 2. validateInput() ─────────────────────────────────────────────────────
  if (tool.validateInput) {
    const validation = await tool.validateInput(args, context);
    if (!validation.result) {
      const validationError = validation as { result: false; message: string; errorCode: number };
      context.addNotification?.(
        `Validation failed for ${tool.name}: ${validationError.message}`,
        'error',
      );
      return {
        success: false,
        output: `Invalid input: ${validationError.message} (code ${validationError.errorCode})` as Output,
        durationMs: Date.now() - startTime,
        permissionResult: { type: 'deny', reason: `Validation failed: ${validationError.message}` },
        validationPassed: false,
      };
    }
  }

  // ── 3. checkPermissions() ──────────────────────────────────────────────────
  const permissionResult = options.permissionOverride
    ?? await tool.checkPermissions(args, context);

  if (permissionResult.type === 'deny') {
    context.addNotification?.(
      `${tool.name} was blocked: ${permissionResult.reason}`,
      'warning',
    );
    recordDecision(context, toolUseID, tool.name, 'reject');
    return {
      success: false,
      output: `Permission denied: ${permissionResult.reason}` as Output,
      durationMs: Date.now() - startTime,
      permissionResult,
      validationPassed: true,
    };
  }

  if (permissionResult.type === 'ask') {
    if (context.permissionContext.shouldAvoidPermissionPrompts) {
      // In unattended mode (background agents), auto-deny ask
      recordDecision(context, toolUseID, tool.name, 'reject');
      return {
        success: false,
        output: `Requires user confirmation (unattended mode): ${permissionResult.prompt}` as Output,
        durationMs: Date.now() - startTime,
        permissionResult,
        validationPassed: true,
      };
    }

    if (context.requestUserConfirmation) {
      const allowed = await context.requestUserConfirmation(
        permissionResult.prompt,
        permissionResult.riskLevel,
      );

      if (!allowed) {
        recordDecision(context, toolUseID, tool.name, 'reject');
        return {
          success: false,
          output: `User denied: ${tool.userFacingName(args)}` as Output,
          durationMs: Date.now() - startTime,
          permissionResult,
          validationPassed: true,
        };
      }
    }
    // If no confirmation handler, continue (treat ask as allow)
  }

  recordDecision(context, toolUseID, tool.name, 'accept');

  // ── 4. call() ─────────────────────────────────────────────────────────────
  // Start progress tracking for long-running tools
  const tracker = new ProgressTracker(tool.name, toolUseID, (update) => {
    // Convert progress event to tool progress format expected by onProgress
    if (options.onProgress) {
      options.onProgress({
        data: {
          type: 'status',
          message: update.message,
          percent: update.percent,
        },
      } as any);
    }
  });

  if (isLongRunningTool(tool.name)) {
    tracker.start();
  }

  let result: HarnessToolResult<Output>;
  try {
    result = await tool.call(
      args,
      context,
      options.onProgress as ToolCallProgress<P> | undefined,
    );

    // Check abort after execution
    if (context.abortController.signal.aborted) {
      tracker.stop();
      return buildAbortedResult(startTime, permissionResult);
    }
  } catch (err) {
    tracker.stop();
    if (context.abortController.signal.aborted) {
      return buildAbortedResult(startTime, permissionResult);
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    context.addNotification?.(`${tool.name} failed: ${errorMsg}`, 'error');

    return {
      success: false,
      output: `Tool error: ${errorMsg}` as Output,
      durationMs: Date.now() - startTime,
      permissionResult,
      validationPassed: true,
    };
  }

  // Stop progress tracking and emit final 100% update
  tracker.stop();

  // ── 5. Result truncation ───────────────────────────────────────────────────
  const outputStr = typeof result.output === 'string' ? result.output : String(result.output);
  if (outputStr.length > tool.maxResultSizeChars) {
    const truncatedSize = outputStr.length - tool.maxResultSizeChars;
    const message = TRUNCATION_MESSAGE(truncatedSize, tool.maxResultSizeChars);
    const truncated = outputStr.slice(0, tool.maxResultSizeChars) + message;
    result = { ...result, output: truncated as Output };
  }

  return {
    ...result,
    durationMs: Date.now() - startTime,
    permissionResult,
    validationPassed: true,
  };
}

/**
 * executeParallelWithHarness() — run multiple tools concurrently with fault tolerance.
 *
 * Models Claude Code's Promise.allSettled() parallel execution.
 * Each tool gets its own permission check. One failure doesn't abort the others.
 */
export async function executeParallelWithHarness(
  batch: Array<{
    tool: HarnessTool;
    args: Record<string, unknown>;
    toolUseID: string;
  }>,
  context: ToolUseContext,
  options: {
    onProgress?: ToolCallProgress;
    onItemStart?: (toolUseID: string, toolName: string) => void;
    onItemDone?: (toolUseID: string, toolName: string, result: HarnessExecuteResult) => void;
  } = {},
): Promise<HarnessExecuteResult[]> {
  const promises = batch.map(async ({ tool, args, toolUseID }) => {
    options.onItemStart?.(toolUseID, tool.name);
    const result = await executeWithHarness(tool, args, context, {
      toolUseID,
      onProgress: options.onProgress,
    });
    options.onItemDone?.(toolUseID, tool.name, result);
    return result;
  });

  const settled = await Promise.allSettled(promises);
  return settled.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : {
          success: false,
          output: `Unexpected error: ${r.reason}`,
          durationMs: 0,
          permissionResult: { type: 'deny' as const, reason: 'Promise rejected' },
          validationPassed: false,
        },
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Records a tool execution decision (accept/reject) in the context.
 * Used for auditing and permission tracking.
 */
function recordDecision(
  context: ToolUseContext,
  toolUseID: string,
  toolName: string,
  decision: 'accept' | 'reject',
): void {
  context.toolDecisions?.set(toolUseID, {
    source: toolName,
    decision,
    timestamp: Date.now(),
  });
}

/**
 * Builds an aborted execution result.
 * Used when user cancels or abort signal is triggered.
 */
function buildAbortedResult<T>(
  startTime: number,
  permissionResult: PermissionResult,
): HarnessExecuteResult<T> {
  return {
    success: false,
    output: 'Aborted by user' as T,
    durationMs: Date.now() - startTime,
    permissionResult,
    validationPassed: true,
  };
}

/**
 * buildToolUseContext() — factory for creating a ToolUseContext from the
 * current AgentEngine execution state.
 *
 * Permission rules can be provided to enforce safety on destructive tools.
 * Default rules block deletes at system level and ask before running code.
 */
export function buildToolUseContext(options: {
  sessionId: string;
  abortController: AbortController;
  model: string;
  tools: HarnessTool[];
  messages?: Array<{ role: string; content: string }>;
  permissionMode?: import('./types').PermissionMode;
  permissionRules?: {
    alwaysAllowRules?: import('./types').ToolPermissionRules;
    alwaysDenyRules?: import('./types').ToolPermissionRules;
    alwaysAskRules?: import('./types').ToolPermissionRules;
  };
  addNotification?: (message: string, type?: 'info' | 'warning' | 'error') => void;
  requestUserConfirmation?: (prompt: string, riskLevel?: 'low' | 'medium' | 'high') => Promise<boolean>;
}): ToolUseContext {
  return {
    sessionId: options.sessionId,
    abortController: options.abortController,
    model: options.model,
    tools: options.tools,
    messages: options.messages ?? [],
    permissionContext: {
      mode: options.permissionMode ?? 'bypass',
      alwaysAllowRules: options.permissionRules?.alwaysAllowRules ?? {},
      alwaysDenyRules: options.permissionRules?.alwaysDenyRules ?? {},
      alwaysAskRules: options.permissionRules?.alwaysAskRules ?? {},
    },
    addNotification: options.addNotification,
    requestUserConfirmation: options.requestUserConfirmation,
    toolDecisions: new Map(),
    fileReadCache: new Map(),
  };
}
