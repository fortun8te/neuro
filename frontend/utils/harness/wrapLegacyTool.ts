/**
 * wrapLegacyTool — Backwards-compatibility adapter
 *
 * Wraps an existing ToolDef (the old {name, description, parameters, execute}
 * format) into a full HarnessTool<Input, Output, Progress> so the new harness
 * executor can handle all 50+ existing Neuro tools without rewriting them.
 *
 * The wrapper:
 * — Passes the AbortController's signal through to execute()
 * — Maps ToolResult → HarnessToolResult
 * — Classifies tools as read-only / concurrency-safe
 * — Allows all tools by default (no permissions until explicitly configured)
 * — Respects maxResultSizeChars: 50k default
 */

import type { ToolDef, ToolResult } from '../agentEngine';
import type {
  HarnessTool,
  HarnessToolResult,
  PermissionResult,
  ToolUseContext,
} from './types';

// ── Tool Classifications ───────────────────────────────────────────────────

/** Tools classified as read-only (no side effects) */
const READ_ONLY_TOOLS = new Set([
  'web_search', 'browse', 'scrape_page', 'analyze_page', 'multi_browse',
  'file_read', 'image_analyze', 'extract_data', 'summarize',
  'notes_read', 'memory_search', 'think',
  'code_read', 'dir_list', 'file_find',
]);

/** Tools that are destructive (irreversible or modify system state) */
const DESTRUCTIVE_TOOLS = new Set([
  'file_delete', 'file_write', 'shell_exec', 'run_code',
]);

/** Tools safe to run in parallel (concurrency-safe) */
const CONCURRENT_SAFE_TOOLS = new Set([
  'web_search', 'browse', 'scrape_page', 'analyze_page', 'multi_browse',
  'file_read', 'image_analyze', 'extract_data', 'summarize',
  'notes_read', 'memory_search',
]);

/**
 * Tools auto-approved in 'auto' mode.
 * These are safe, read-only operations with no side effects.
 */
const AUTO_SAFE_TOOLS = new Set([
  'web_search', 'browse', 'scrape_page', 'analyze_page', 'multi_browse',
  'file_read', 'image_analyze', 'extract_data', 'summarize',
  'notes_read', 'memory_search', 'think', 'code_read', 'dir_list', 'file_find',
]);

/**
 * Wraps a legacy ToolDef into the new HarnessTool interface.
 * Enables backward compatibility with existing tools while using the new
 * harness execution pipeline.
 */
export function wrapLegacyTool(tool: ToolDef): HarnessTool {
  return {
    name: tool.name,
    aliases: [],
    searchHint: undefined,
    maxResultSizeChars: 50_000,

    // ── Execution ──────────────────────────────────────────────────────
    async call(
      args: Record<string, unknown>,
      context: ToolUseContext,
    ): Promise<HarnessToolResult<string>> {
      const signal = context.abortController.signal;

      let result: ToolResult;
      try {
        result = await tool.execute(args, signal);
      } catch (err) {
        if (signal.aborted) {
          return { success: false, output: 'Aborted by user' };
        }
        return {
          success: false,
          output: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // Truncate oversized output
      let output = result.output;
      if (output.length > 50_000) {
        output = output.slice(0, 50_000) + `\n[...truncated ${output.length - 50_000} chars]`;
      }

      return {
        success: result.success,
        output,
        data: result.data,
      };
    },

    // ── Description & Display ──────────────────────────────────────────
    description() {
      return tool.description;
    },

    prompt() {
      return '';
    },

    userFacingName(input?: Partial<Record<string, unknown>>) {
      if (input) {
        const { query, url, path, filename, command, urls } = input as Record<string, string | string[]>;
        if (query) return `Searching: ${String(query).slice(0, 40)}`;
        if (url) return `Browsing: ${String(url).slice(0, 40)}`;
        if (urls) return `Browsing ${Array.isArray(urls) ? urls.length : 1} URLs`;
        if (path || filename) return `File: ${String(path || filename).slice(0, 40)}`;
        if (command) return `Running: ${String(command).slice(0, 40)}`;
      }
      return tool.name;
    },

    getActivityDescription(input?: Partial<Record<string, unknown>>) {
      const activityMap: Record<string, string> = {
        web_search: 'Searching the web',
        browse: 'Browsing page',
        multi_browse: 'Scraping pages',
        scrape_page: 'Scraping page',
        shell_exec: 'Running command',
        run_code: 'Executing code',
        file_read: 'Reading file',
        file_write: 'Writing file',
        think: 'Thinking',
        memory_store: 'Storing memory',
        memory_search: 'Searching memory',
        spawn_agents: 'Spawning agents',
        deep_research: 'Researching',
        image_analyze: 'Analyzing image',
        create_docx: 'Creating document',
        write_content: 'Writing content',
      };
      if (input) {
        const { query, url, path } = input as Record<string, string>;
        if (tool.name === 'web_search' && query) return `Searching: ${String(query).slice(0, 40)}`;
        if (tool.name === 'browse' && url) return `Reading: ${String(url).slice(0, 40)}`;
        if (tool.name === 'file_read' && path) return `Reading: ${String(path).slice(0, 40)}`;
      }
      return activityMap[tool.name] ?? null;
    },

    getToolUseSummary(input?: Partial<Record<string, unknown>>) {
      if (!input) return tool.name;
      const { query, url, path, command } = input as Record<string, string>;
      if (query) return `${tool.name}(${String(query).slice(0, 30)})`;
      if (url) return `${tool.name}(${String(url).slice(0, 30)})`;
      if (path) return `${tool.name}(${String(path).slice(0, 30)})`;
      if (command) return String(command).slice(0, 40);
      return tool.name;
    },

    // ── Safety Classification ──────────────────────────────────────────
    isConcurrencySafe() {
      return CONCURRENT_SAFE_TOOLS.has(tool.name);
    },

    isReadOnly() {
      return READ_ONLY_TOOLS.has(tool.name);
    },

    isDestructive() {
      return DESTRUCTIVE_TOOLS.has(tool.name);
    },

    isEnabled() {
      return true;
    },

    // ── Permission & Validation ────────────────────────────────────────
    async validateInput() {
      return { result: true as const };
    },

    async checkPermissions(
      input: Record<string, unknown>,
      context: ToolUseContext,
    ): Promise<PermissionResult> {
      return evaluateToolPermissions(tool.name, input, context);
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds a HarnessToolResult from a legacy ToolResult,
 * handling output truncation.
 */
function buildToolResult(result: ToolResult): HarnessToolResult<string> {
  let output = result.output;
  const maxSize = 50_000;

  if (output.length > maxSize) {
    const truncatedSize = output.length - maxSize;
    output = output.slice(0, maxSize) +
      `\n[...truncated ${truncatedSize} chars]`;
  }

  return {
    success: result.success,
    output,
    data: result.data,
  };
}

/**
 * Builds a human-readable name for the tool from input parameters.
 * Used in UI to show what the tool is doing.
 */
function buildUserFacingName(
  toolName: string,
  input?: Partial<Record<string, unknown>>,
): string {
  if (!input) return toolName;

  const { query, url, path, filename, command, urls } =
    input as Record<string, string | string[]>;

  if (query) return `Searching: ${String(query).slice(0, 40)}`;
  if (url) return `Browsing: ${String(url).slice(0, 40)}`;
  if (urls) {
    const count = Array.isArray(urls) ? urls.length : 1;
    return `Browsing ${count} URLs`;
  }
  if (path || filename) return `File: ${String(path || filename).slice(0, 40)}`;
  if (command) return `Running: ${String(command).slice(0, 40)}`;

  return toolName;
}

/**
 * Builds an activity description (present tense) for spinners.
 * Shows what the tool is doing right now.
 */
function buildActivityDescription(
  toolName: string,
  input?: Partial<Record<string, unknown>>,
): string | null {
  const activityMap: Record<string, string> = {
    web_search: 'Searching the web',
    browse: 'Browsing page',
    multi_browse: 'Scraping pages',
    scrape_page: 'Scraping page',
    shell_exec: 'Running command',
    run_code: 'Executing code',
    file_read: 'Reading file',
    file_write: 'Writing file',
    think: 'Thinking',
    memory_store: 'Storing memory',
    memory_search: 'Searching memory',
    spawn_agents: 'Spawning agents',
    deep_research: 'Researching',
    image_analyze: 'Analyzing image',
    create_docx: 'Creating document',
    write_content: 'Writing content',
  };

  if (input) {
    const { query, url, path } = input as Record<string, string>;
    if (toolName === 'web_search' && query) {
      return `Searching: ${String(query).slice(0, 40)}`;
    }
    if (toolName === 'browse' && url) {
      return `Reading: ${String(url).slice(0, 40)}`;
    }
    if (toolName === 'file_read' && path) {
      return `Reading: ${String(path).slice(0, 40)}`;
    }
  }

  return activityMap[toolName] ?? null;
}

/**
 * Builds a compact summary of tool usage for compact views.
 * Example: "web_search(my query)" instead of full input object.
 */
function buildToolUseSummary(
  toolName: string,
  input?: Partial<Record<string, unknown>>,
): string | null {
  if (!input) return toolName;

  const { query, url, path, command } = input as Record<string, string>;

  if (query) return `${toolName}(${String(query).slice(0, 30)})`;
  if (url) return `${toolName}(${String(url).slice(0, 30)})`;
  if (path) return `${toolName}(${String(path).slice(0, 30)})`;
  if (command) return String(command).slice(0, 40);

  return toolName;
}

/**
 * Evaluates whether a tool should be allowed to run based on
 * permission mode and configured rules.
 *
 * Permission logic:
 * 1. Check global deny/ask/allow rules first (always override mode)
 * 2. Apply mode-specific logic
 */
function evaluateToolPermissions(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolUseContext,
): PermissionResult {
  const { permissionContext } = context;

  // Bypass mode: allow everything
  if (permissionContext.mode === 'bypass') {
    return { type: 'allow' };
  }

  // Check deny rules first (highest priority)
  const denyPatterns = permissionContext.alwaysDenyRules[toolName] ?? [];
  for (const pattern of denyPatterns) {
    if (matchesPattern(input, pattern)) {
      return { type: 'deny', reason: `Blocked by rule: ${pattern}` };
    }
  }

  // Check ask rules (explicit prompts)
  const askPatterns = permissionContext.alwaysAskRules[toolName] ?? [];
  for (const pattern of askPatterns) {
    if (matchesPattern(input, pattern)) {
      return {
        type: 'ask',
        prompt: `Allow ${toolName}(${summarizeInput(input)})?`,
        riskLevel: DESTRUCTIVE_TOOLS.has(toolName) ? 'high' : 'medium',
      };
    }
  }

  // Check allow rules (skip further checks)
  const allowPatterns = permissionContext.alwaysAllowRules[toolName] ?? [];
  for (const pattern of allowPatterns) {
    if (matchesPattern(input, pattern)) {
      return { type: 'allow' };
    }
  }

  // ── Mode-specific logic ────────────────────────────────────────────────────

  // 'plan' mode: after plan approval, auto-allow subsequent tools
  if (permissionContext.mode === 'plan' && permissionContext.planApproved) {
    return { type: 'allow' };
  }

  // 'plan' mode: first tool in execution, show plan
  if (permissionContext.mode === 'plan' && !permissionContext.planApproved) {
    return {
      type: 'ask',
      prompt: `Review execution plan and approve to proceed with ${toolName}(${summarizeInput(input)})?`,
      riskLevel: 'low',
    };
  }

  // 'strict' mode: ask for everything
  if (permissionContext.mode === 'strict') {
    return {
      type: 'ask',
      prompt: `Allow ${toolName}(${summarizeInput(input)})?`,
      riskLevel: DESTRUCTIVE_TOOLS.has(toolName) ? 'high' : 'medium',
    };
  }

  // 'default' mode: only ask for destructive operations
  if (permissionContext.mode === 'default' && DESTRUCTIVE_TOOLS.has(toolName)) {
    return {
      type: 'ask',
      prompt: `Allow ${toolName}(${summarizeInput(input)})?`,
      riskLevel: 'high',
    };
  }

  // Fallback: allow
  return { type: 'allow' };
}

/**
 * Simple glob-style pattern matching against tool input parameters.
 * Supports wildcard matching (e.g. "rm -rf*").
 */
function matchesPattern(input: Record<string, unknown>, pattern: string): boolean {
  const inputStr = Object.values(input)
    .filter(v => typeof v === 'string')
    .join(' ')
    .toLowerCase();

  if (pattern.endsWith('*')) {
    return inputStr.includes(pattern.slice(0, -1).toLowerCase());
  }

  return inputStr.includes(pattern.toLowerCase());
}

/**
 * Creates a compact summary of tool args for permission prompts.
 * Shows first 2 key=value pairs, truncated to 30 chars each.
 */
function summarizeInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .slice(0, 2)
    .map(([k, v]) => `${k}=${String(v).slice(0, 30)}`);
  return entries.join(', ');
}
