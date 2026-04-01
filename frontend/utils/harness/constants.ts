/**
 * harness/constants.ts — Shared constants for the tool harness system
 *
 * Centralizes magic numbers, timeouts, limits, and other configuration
 * values used throughout the harness execution pipeline.
 */

// ── Execution Timeouts ─────────────────────────────────────────────────

/** Default timeout for tool execution in milliseconds */
export const TOOL_EXECUTION_TIMEOUT_MS = 30_000;

/** Timeout for permission checks in milliseconds */
export const PERMISSION_CHECK_TIMEOUT_MS = 5_000;

// ── Result Size Limits ─────────────────────────────────────────────────

/** Default maximum result size before truncation (characters) */
export const DEFAULT_MAX_RESULT_SIZE = 50_000;

/** Message appended when output is truncated */
export const TRUNCATION_MESSAGE = (truncatedChars: number, limit: number) =>
  `\n[...truncated ${truncatedChars} chars — exceeded ${limit} char limit]`;

// ── Progress Tracking ──────────────────────────────────────────────────

/** Interval between progress updates in milliseconds */
export const PROGRESS_EMIT_INTERVAL_MS = 2_000;

/** Maximum progress percentage before tool completes (prevents false 100%) */
export const MAX_PROGRESS_BEFORE_COMPLETION = 90;

/**
 * Maps tool names to human-readable progress messages.
 * Used to display status to the user during execution.
 */
export const PROGRESS_MESSAGE_MAP: Record<string, string> = {
  'web_search': 'Searching the web',
  'browse': 'Loading page',
  'multi_browse': 'Scraping pages',
  'scrape_page': 'Extracting content',
  'analyze_page': 'Analyzing page',
  'deep_research': 'Researching',
  'competitor_swot': 'Analyzing competitor',
  'social_intelligence': 'Analyzing social signals',
  'research_loop': 'Running research loop',
};

// ── Permission Modes ──────────────────────────────────────────────────

/** Default permission mode */
export const DEFAULT_PERMISSION_MODE = 'default' as const;

// ── Tool Classifications ───────────────────────────────────────────────

/** Tools that only read and never modify state */
export const READ_ONLY_TOOLS = new Set([
  'web_search',
  'browse',
  'scrape_page',
  'analyze_page',
  'multi_browse',
  'file_read',
  'image_analyze',
  'extract_data',
  'summarize',
  'notes_read',
  'memory_search',
  'think',
  'code_read',
  'dir_list',
  'file_find',
]);

/** Tools that modify system state and are irreversible */
export const DESTRUCTIVE_TOOLS = new Set([
  'file_delete',
  'file_write',
  'shell_exec',
  'run_code',
]);

/** Tools safe to run in parallel without race conditions */
export const CONCURRENT_SAFE_TOOLS = new Set([
  'web_search',
  'browse',
  'scrape_page',
  'analyze_page',
  'multi_browse',
  'file_read',
  'image_analyze',
  'extract_data',
  'summarize',
  'notes_read',
  'memory_search',
]);

/** Tools that require extended execution time and progress tracking */
export const LONG_RUNNING_TOOLS = new Set([
  'web_search',
  'browse',
  'multi_browse',
  'deep_research',
  'scrape_page',
  'analyze_page',
  'competitor_swot',
  'social_intelligence',
  'research_loop',
]);

// ── String Truncation ──────────────────────────────────────────────────

/** Max length for user-facing names before truncation */
export const MAX_NAME_LENGTH = 40;

/** Max length for parameter values in summaries */
export const MAX_PARAM_LENGTH = 30;

/** Max length for parameter summaries in permission prompts */
export const MAX_SUMMARY_LENGTH = 30;

// ── Input Summarization ────────────────────────────────────────────────

/** Maximum number of key-value pairs shown in permission prompts */
export const MAX_SUMMARY_ENTRIES = 2;
