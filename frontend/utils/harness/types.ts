/**
 * Tool Harness — Type definitions
 *
 * Modeled after Claude Code's Tool<Input, Output, Progress> architecture.
 * Provides a strongly-typed, permission-aware, progress-streaming tool
 * interface with comprehensive safety and metadata support.
 *
 * Key improvements over legacy ToolDef:
 * — Zod input schemas with full type inference
 * — Permission system (validateInput, checkPermissions, rules)
 * — Concurrency safety flags (isConcurrencySafe, isReadOnly, isDestructive)
 * — Progress streaming via onProgress callback
 * — Result size limits with automatic truncation
 * — Rich execution context (sessionId, model, abort, notifications)
 * — Tool metadata (searchHint, activityDescription, useSummary)
 */

// ── Permission System ──────────────────────────────────────────────────────

/**
 * Permission enforcement mode (4 modes)
 *
 * — bypass: Allow all tools without asking (default on, 🟢 green)
 * — default: Ask before destructive operations. Auto-allow read-only tools (🟡 yellow)
 * — strict: Ask before ANY tool execution. Most protective (🔴 red)
 * — plan: Show full execution plan before running. Approve once, then auto-execute (📋 blue)
 */
export type PermissionMode = 'bypass' | 'default' | 'strict' | 'plan';

/**
 * Per-tool permission rules using glob patterns for fine-grained control.
 * Example: { web_search: ["malicious intent*"], file_write: ["*.exe"] }
 */
export type ToolPermissionRules = Record<string, string[]>;

export type ToolPermissionContext = {
  mode: PermissionMode;
  /** Tools always allowed to run without prompting */
  alwaysAllowRules: ToolPermissionRules;
  /** Tools that should always be denied */
  alwaysDenyRules: ToolPermissionRules;
  /** Tools that should always prompt the user */
  alwaysAskRules: ToolPermissionRules;
  /** When true, dangerous operations are denied automatically (no UI prompt) */
  shouldAvoidPermissionPrompts?: boolean;
  /** For 'plan' mode: set to true after plan approval to skip subsequent prompts */
  planApproved?: boolean;
};

export const getDefaultPermissionContext = (): ToolPermissionContext => ({
  mode: 'default',
  alwaysAllowRules: {},
  alwaysDenyRules: {},
  alwaysAskRules: {},
});

export type PermissionResult =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'ask'; prompt: string; riskLevel?: 'low' | 'medium' | 'high' };

// ── Validation ─────────────────────────────────────────────────────────────

export type ValidationResult =
  | { result: true }
  | { result: false; message: string; errorCode: number };

// ── Progress Streaming ─────────────────────────────────────────────────────

export type ToolProgressData =
  | { type: 'status'; message: string; percent?: number }
  | { type: 'chunk'; content: string }
  | { type: 'step'; step: string; of?: number; current?: number }
  | { type: 'custom'; [key: string]: unknown };

export type ToolProgressEvent<P extends ToolProgressData = ToolProgressData> = {
  toolUseID: string;
  data: P;
};

export type ToolCallProgress<P extends ToolProgressData = ToolProgressData> = (
  event: ToolProgressEvent<P>,
) => void;

// ── Tool Result ────────────────────────────────────────────────────────────

export type HarnessToolResult<T = string> = {
  success: boolean;
  /** Primary text output shown to agent */
  output: T;
  /** Structured data (e.g. blob, parsed JSON, chart spec) */
  data?: unknown;
  /** Additional messages to inject into conversation */
  newMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

// ── Execution Context ──────────────────────────────────────────────────────

export type ToolUseContext = {
  /** Unique session ID */
  sessionId: string;
  /** Abort controller for cancellation */
  abortController: AbortController;
  /** Current conversation messages */
  messages: Array<{ role: string; content: string }>;
  /** Working directory for file operations */
  workingDirectory?: string;
  /** Active model name */
  model: string;
  /** All available tools for this context */
  tools: HarnessTool[];
  /** Permission rules */
  permissionContext: ToolPermissionContext;
  /** Max token budget (optional) */
  maxTokens?: number;
  /** Notify user of non-blocking information */
  addNotification?: (message: string, type?: 'info' | 'warning' | 'error') => void;
  /** Request user confirmation for dangerous operations */
  requestUserConfirmation?: (prompt: string, riskLevel?: 'low' | 'medium' | 'high') => Promise<boolean>;
  /** LRU file content cache to avoid re-reading */
  fileReadCache?: Map<string, { content: string; readAt: number }>;
  /** Tool decision log — records allow/deny decisions per toolUseID */
  toolDecisions?: Map<string, { source: string; decision: 'accept' | 'reject'; timestamp: number }>;
};

// ── The Tool Interface ─────────────────────────────────────────────────────

/**
 * HarnessTool<Input, Output, Progress>
 *
 * The universal tool contract. Every tool in Neuro implements this interface.
 * Legacy ToolDef tools are automatically wrapped via wrapLegacyTool().
 */
export type HarnessTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output = string,
  P extends ToolProgressData = ToolProgressData,
> = {
  // ── Identity ──────────────────────────────────────────────────────────
  readonly name: string;
  /** Alternative names (for backwards compatibility when renamed) */
  aliases?: string[];
  /** Short keyword hint for ToolSearch (3-10 words, no period) */
  searchHint?: string;

  // ── Execution ─────────────────────────────────────────────────────────
  call(
    args: Input,
    context: ToolUseContext,
    onProgress?: ToolCallProgress<P>,
  ): Promise<HarnessToolResult<Output>>;

  // ── Description & Display ─────────────────────────────────────────────
  /** Full description/instructions for the LLM */
  description(): string;
  /** System prompt contribution (capabilities overview) */
  prompt?(): string;
  /** Short human-facing name for UI (e.g. "Reading file...") */
  userFacingName(input?: Partial<Input>): string;
  /** Present-tense activity description for spinner (e.g. "Searching for cats") */
  getActivityDescription?(input?: Partial<Input>): string | null;
  /** One-line summary for compact views (e.g. "git status") */
  getToolUseSummary?(input?: Partial<Input>): string | null;

  // ── Limits & Sizing ───────────────────────────────────────────────────
  /** Max output chars before truncation (Infinity = never truncate) */
  maxResultSizeChars: number;

  // ── Safety Classification ─────────────────────────────────────────────
  /** True if safe to run in parallel with other tools of same type */
  isConcurrencySafe(input: Input): boolean;
  /** True if tool only reads (never modifies) */
  isReadOnly(input: Input): boolean;
  /** True if operation is irreversible (delete, send, overwrite) */
  isDestructive?(input: Input): boolean;
  /** Whether this tool is currently available */
  isEnabled(): boolean;

  // ── Permission & Validation ───────────────────────────────────────────
  /** Fast structural validation before any permission checks */
  validateInput?(input: Input, context: ToolUseContext): Promise<ValidationResult>;
  /** Returns allow/deny/ask decision */
  checkPermissions(input: Input, context: ToolUseContext): Promise<PermissionResult>;
  /** Optional: pattern matcher for fine-grained permission rules */
  preparePermissionMatcher?(input: Input): Promise<(pattern: string) => boolean>;
};

export type HarnessTools = readonly HarnessTool[];

// ── Factory Helper ─────────────────────────────────────────────────────────

/**
 * createTool() — Convenience factory with sensible defaults.
 *
 * Handles defaults for isReadOnly (true), isConcurrencySafe (false),
 * isEnabled (true), checkPermissions (allow), maxResultSizeChars (50000).
 *
 * Usage:
 *   const MyTool = createTool({
 *     name: 'my_tool',
 *     description: () => 'Does something cool',
 *     userFacingName: () => 'Doing something',
 *     isReadOnly: () => true,
 *     call: async (args, ctx) => ({ success: true, output: 'done' }),
 *   });
 */
export function createTool<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output = string,
  P extends ToolProgressData = ToolProgressData,
>(
  def: Partial<HarnessTool<Input, Output, P>> &
    Pick<HarnessTool<Input, Output, P>, 'name' | 'description' | 'call'>,
): HarnessTool<Input, Output, P> {
  return {
    aliases: [],
    searchHint: undefined,
    maxResultSizeChars: 50_000,
    isEnabled: () => true,
    isReadOnly: () => true,
    isConcurrencySafe: () => false,
    isDestructive: () => false,
    userFacingName: () => def.name,
    getActivityDescription: () => null,
    getToolUseSummary: () => null,
    prompt: () => '',
    checkPermissions: async () => ({ type: 'allow' }),
    ...def,
  } as HarnessTool<Input, Output, P>;
}
