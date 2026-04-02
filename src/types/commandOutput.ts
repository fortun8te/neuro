/**
 * Command Output & Variable Types
 * Phase 1: Output tracking, variable substitution, context variables
 */

/** Stored output from a command execution */
export interface CommandOutput {
  id: string;
  command: string;              // e.g., 'research', 'analyze', 'browse'
  input: string;                // Original user prompt/args
  output: string;               // Raw command output (may be truncated for storage)
  tokens?: number;              // Tokens used by this command
  model?: string;               // Model used (e.g., 'qwen3.5:9b')
  timestamp: number;            // Unix timestamp
  turnNumber: number;           // Sequential turn in session (0-indexed)
  truncated?: boolean;          // true if output was truncated for storage
  originalLength?: number;      // Original output length before truncation
}

/** Output variable references available in quick menu */
export interface OutputVariable {
  name: string;                 // e.g., '$LAST', '$TURN_3', '$RESEARCH_OUTPUT'
  value: string;               // Substituted text
  source: 'turn' | 'command';   // From turn N or from specific command
  age: number;                 // How many turns ago (0 = most recent)
}

/** Context variables injected from system state */
export interface ContextVariable {
  MODEL: string;               // Current model name
  STAGE: string;               // Current pipeline stage
  CYCLE: number;               // Current cycle number
  TIMESTAMP: string;           // ISO timestamp
  TOKENS_USED: number;         // Tokens used in this session
  RESEARCH_DEPTH: string;      // Current preset (SQ/QK/NR/EX/MX)
  MODE: string;                // Mode (lite/pro/max)
  MEMORY_COUNT: number;        // Items in persistent memory
  CANVAS_ITEMS: number;        // Number of canvas documents
}

/** Registry of all available variables for a session */
export interface VariableRegistry {
  context: Partial<ContextVariable>;
  outputs: OutputVariable[];
}

/** Reference target in /reference command */
export type ReferenceSelector =
  | { type: 'lines'; start: number; end: number }
  | { type: 'section'; name: string }
  | { type: 'pattern'; regex: RegExp }
  | { type: 'range'; percent: number };

/** Result of reference resolution */
export interface ResolvedReference {
  filename: string;
  content: string;
  selector: ReferenceSelector;
  lineRange?: [number, number];
}

/** Command result with metadata */
export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  tokens?: number;
  model?: string;
  metadata?: Record<string, any>;
}
