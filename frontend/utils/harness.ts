/**
 * Claude Code Tool Harness — Permission system, tool wrapping, and execution orchestration
 * Handles permission checking, progress streaming, and abort signal propagation
 */

import { intelligentTruncator } from './intelligentTruncator';

export interface ToolUseContext {
  sessionId: string;
  abortController: AbortController;
  model: string;
  tools: WrappedTool[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
}

export interface WrappedTool extends ToolDef {
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  requiresPermission?: boolean;
}

export interface ProgressEvent {
  toolUseID: string;
  data: {
    type: 'status' | 'progress' | 'error';
    message?: string;
    percent?: number;
  };
}

export interface ExecuteOptions {
  toolUseID: string;
  onProgress?: (event: ProgressEvent) => void;
  requestUserConfirmation?: (prompt: string, riskLevel: string) => Promise<boolean>;
}

export interface ParallelBatchItem {
  tool: WrappedTool;
  args: Record<string, unknown>;
  toolUseID: string;
}

export interface ParallelExecuteOptions {
  onItemDone?: (toolUseID: string, toolName: string, result: ToolResult) => void;
  requestUserConfirmation?: (prompt: string, riskLevel: string) => Promise<boolean>;
}

/**
 * Use intelligent truncation that preserves important entities
 */
function truncateToolOutput(text: string, maxChars = 20_000): string {
  return intelligentTruncator.truncate(text, maxChars);
}

/**
 * Build a tool use context for the harness
 */
export function buildToolUseContext(config: {
  sessionId: string;
  abortController: AbortController;
  model: string;
}): ToolUseContext {
  return {
    sessionId: config.sessionId,
    abortController: config.abortController,
    model: config.model,
    tools: [],
  };
}

/**
 * Wrap a legacy tool with harness capabilities (permission checking, progress streaming, error handling)
 */
export function wrapLegacyTool(tool: ToolDef): WrappedTool {
  return {
    ...tool,
    riskLevel: classifyToolRisk(tool.name),
    requiresPermission: shouldRequirePermission(tool.name),
  };
}

/**
 * Execute a single tool through the harness
 * Handles permission checking, progress streaming, and result handling
 */
export async function executeWithHarness(
  tool: WrappedTool,
  args: Record<string, unknown>,
  context: ToolUseContext,
  options: ExecuteOptions
): Promise<ToolResult> {
  const { toolUseID, onProgress, requestUserConfirmation } = options;

  try {
    // Check if tool requires permission
    if (tool.requiresPermission && requestUserConfirmation) {
      const approved = await requestUserConfirmation(
        `Execute tool: ${tool.name}?`,
        tool.riskLevel || 'medium'
      );

      if (!approved) {
        return {
          success: false,
          output: `Tool execution denied by user: ${tool.name}`,
        };
      }
    }

    // Emit progress: starting
    onProgress?.({
      toolUseID,
      data: { type: 'status', message: `Starting ${tool.name}...` },
    });

    // Execute the tool with abort signal
    let result = await tool.execute(args, context.abortController.signal);

    // Apply middle-elision truncation to large outputs (Codex pattern)
    if (result.output && result.output.length > 20_000) {
      result = { ...result, output: truncateToolOutput(result.output) };
    }

    // Emit progress: done
    onProgress?.({
      toolUseID,
      data: { type: 'status', message: `Completed ${tool.name}` },
    });

    return result;
  } catch (error) {
    // Handle abort
    if (context.abortController.signal.aborted) {
      return {
        success: false,
        output: `Tool execution aborted: ${tool.name}`,
      };
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    onProgress?.({
      toolUseID,
      data: { type: 'error', message: errorMessage },
    });

    return {
      success: false,
      output: `Error executing ${tool.name}: ${errorMessage}`,
    };
  }
}

/**
 * Execute multiple tools in parallel through the harness
 * CRITICAL: Properly propagates abort signal to Promise.all()
 */
export async function executeParallelWithHarness(
  batch: ParallelBatchItem[],
  context: ToolUseContext,
  options: ParallelExecuteOptions
): Promise<ToolResult[]> {
  const { onItemDone, requestUserConfirmation } = options;
  const results: Map<string, ToolResult> = new Map();

  // Create promise for each item in the batch
  const promises = batch.map(async (item) => {
    try {
      // Check permissions
      if (item.tool.requiresPermission && requestUserConfirmation) {
        const approved = await requestUserConfirmation(
          `Execute tool: ${item.tool.name}?`,
          item.tool.riskLevel || 'medium'
        );

        if (!approved) {
          const result: ToolResult = {
            success: false,
            output: `Tool execution denied by user: ${item.tool.name}`,
          };
          results.set(item.toolUseID, result);
          onItemDone?.(item.toolUseID, item.tool.name, result);
          return result;
        }
      }

      // Execute the tool with abort signal
      const result = await item.tool.execute(item.args, context.abortController.signal);
      results.set(item.toolUseID, result);
      onItemDone?.(item.toolUseID, item.tool.name, result);
      return result;
    } catch (error) {
      // Handle abort
      if (context.abortController.signal.aborted) {
        const result: ToolResult = {
          success: false,
          output: `Tool execution aborted: ${item.tool.name}`,
        };
        results.set(item.toolUseID, result);
        onItemDone?.(item.toolUseID, item.tool.name, result);
        return result;
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ToolResult = {
        success: false,
        output: `Error executing ${item.tool.name}: ${errorMessage}`,
      };
      results.set(item.toolUseID, result);
      onItemDone?.(item.toolUseID, item.tool.name, result);
      return result;
    }
  });

  // CRITICAL FIX: Listen for abort signal and reject the entire batch if aborted
  // This ensures Promise.all() rejects when the external signal is aborted
  let abortPromiseReject: (reason?: unknown) => void;
  const abortPromise = new Promise<never>((_, reject) => {
    abortPromiseReject = reject;
  });

  const abortListener = () => {
    abortPromiseReject(new Error('Parallel execution aborted'));
  };

  context.abortController.signal.addEventListener('abort', abortListener);

  try {
    // Race: either all promises complete OR abort signal fires
    // Using Promise.all with abort signal listener ensures immediate rejection on abort
    await Promise.race([Promise.all(promises), abortPromise]);
  } finally {
    context.abortController.signal.removeEventListener('abort', abortListener);
  }

  // Return results in original order
  return batch.map((item) => results.get(item.toolUseID) || {
    success: false,
    output: 'No result recorded',
  });
}

/**
 * Classify tool by risk level for permission requirements
 */
function classifyToolRisk(toolName: string): 'low' | 'medium' | 'high' | 'critical' {
  const destructiveTools = [
    'file_delete',
    'file_write',
    'shell_exec',
    'sql_execute',
    'api_delete',
  ];

  const highRiskTools = [
    'run_code',
    'execute_command',
    'system_update',
  ];

  const toolNameLower = toolName.toLowerCase();

  if (destructiveTools.some((t) => toolNameLower.includes(t))) {
    return 'critical';
  }
  if (highRiskTools.some((t) => toolNameLower.includes(t))) {
    return 'high';
  }
  if (toolNameLower.includes('web_') || toolNameLower.includes('search')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Determine if a tool requires explicit permission
 */
function shouldRequirePermission(toolName: string): boolean {
  const requiresPermissionTools = [
    'file_delete',
    'file_write',
    'shell_exec',
    'sql_execute',
    'api_delete',
    'run_code',
  ];

  return requiresPermissionTools.some((t) => toolName.toLowerCase().includes(t));
}
