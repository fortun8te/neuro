/**
 * thoughtFolder.ts -- DeepAgent-inspired memory consolidation
 *
 * When reasoning gets long or unproductive, fold the entire interaction
 * history into a structured 3-tier memory:
 *   1. Episodic: What happened (task events, decisions, milestones)
 *   2. Working: What's happening now (current goals, challenges)
 *   3. Tool: What worked/failed (tool usage patterns)
 *
 * This replaces the raw history, preventing context explosion and
 * enabling strategy reconsideration.
 */

import { ollamaService } from './ollama';
import { getModelForStage, getContextSize } from './modelConfig';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface FoldedMemory {
  episodic: string;        // "User asked about X. I searched for Y. Found Z."
  working: string;         // "Currently trying to synthesize results. Need to..."
  tool: string;            // "web_search: worked (3x). run_code: failed (2x)."
  foldedAt: number;        // timestamp
  originalLength: number;  // chars before folding
  compressedLength: number; // chars after folding
}

export interface ThoughtFolderConfig {
  /** Max context chars before auto-fold triggers */
  autoFoldThreshold: number;
  /** Max consecutive tool failures before suggesting fold */
  maxConsecutiveFailures: number;
  /** Model to use for compression */
  model?: string;
}

// ---------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------

const DEFAULT_CONFIG: ThoughtFolderConfig = {
  autoFoldThreshold: 15_000,
  maxConsecutiveFailures: 3,
};

// ---------------------------------------------------------------
// Core: fold interaction history into 3-tier memory
// ---------------------------------------------------------------

/**
 * Compress a full interaction history into structured 3-tier memory.
 * Uses an auxiliary LLM call to do the compression.
 */
export async function foldThought(
  history: string[],
  userQuestion: string,
  config: Partial<ThoughtFolderConfig> = {},
  signal?: AbortSignal,
): Promise<FoldedMemory> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const fullHistory = history.join('\n');
  const originalLength = fullHistory.length;

  const compressionPrompt = `You are a memory consolidation system. Compress the following agent interaction history into structured memory. Be concise but preserve ALL critical information.

USER'S ORIGINAL QUESTION: ${userQuestion}

INTERACTION HISTORY:
${fullHistory.slice(0, 12_000)}

Output EXACTLY this JSON format (no markdown, no code blocks):
{
  "episodic": "What happened so far: key decisions, search results found, tools used, important findings. 2-4 sentences max.",
  "working": "Current state: what the agent is trying to do right now, what's blocking it, what's the next logical step. 1-2 sentences.",
  "tool": "Tool effectiveness: which tools worked and what they returned, which tools failed and why. List format."
}`;

  const model = cfg.model || getModelForStage('compression');
  let response = '';

  try {
    response = await ollamaService.generateStream(
      compressionPrompt,
      'You compress interaction histories into structured JSON memory. Output only valid JSON.',
      {
        model,
        temperature: 0.1,
        num_predict: 600,
        num_ctx: getContextSize('compression'),
        signal,
      },
    );
  } catch {
    // Fallback: simple truncation if LLM fails
    return {
      episodic: fullHistory.slice(0, 500),
      working: 'Memory compression failed. Continuing with truncated history.',
      tool: '',
      foldedAt: Date.now(),
      originalLength,
      compressedLength: 500,
    };
  }

  // Parse the JSON response
  try {
    // Strip markdown code blocks if present
    const cleaned = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    const memory: FoldedMemory = {
      episodic: String(parsed.episodic || ''),
      working: String(parsed.working || ''),
      tool: String(parsed.tool || ''),
      foldedAt: Date.now(),
      originalLength,
      compressedLength:
        (parsed.episodic?.length || 0) +
        (parsed.working?.length || 0) +
        (parsed.tool?.length || 0),
    };
    return memory;
  } catch {
    // JSON parse failed -- use raw response as episodic
    return {
      episodic: response.slice(0, 400),
      working: 'Failed to parse structured memory. Using raw summary.',
      tool: '',
      foldedAt: Date.now(),
      originalLength,
      compressedLength: response.length,
    };
  }
}

// ---------------------------------------------------------------
// Unfold: convert folded memory back into LLM context
// ---------------------------------------------------------------

/**
 * Convert folded memory back into a context string for the LLM.
 */
export function unfoldMemory(memory: FoldedMemory): string {
  return `[FOLDED MEMORY -- compressed from ${memory.originalLength} chars at ${new Date(memory.foldedAt).toISOString()}]

WHAT HAPPENED:
${memory.episodic}

CURRENT STATE:
${memory.working}

TOOL NOTES:
${memory.tool}

[END FOLDED MEMORY -- Continue from where you left off. Do NOT repeat work already done. Focus on what is needed next.]`;
}

// ---------------------------------------------------------------
// Trigger logic: should we fold?
// ---------------------------------------------------------------

/**
 * Check if the context should be folded based on size or failure patterns.
 */
export function shouldFold(
  contextEntries: string[],
  consecutiveFailures: number,
  config: Partial<ThoughtFolderConfig> = {},
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const totalChars = contextEntries.reduce((sum, e) => sum + e.length, 0);

  if (totalChars > cfg.autoFoldThreshold) return true;
  if (consecutiveFailures >= cfg.maxConsecutiveFailures) return true;

  return false;
}

// ---------------------------------------------------------------
// StuckDetector: track consecutive failures and repeated tools
// ---------------------------------------------------------------

/**
 * Track consecutive tool failures to detect when the agent is stuck.
 */
export class StuckDetector {
  private consecutiveFailures = 0;
  private lastToolNames: string[] = [];
  private readonly maxRepeatSameTool = 3;

  recordSuccess(_toolName: string): void {
    this.consecutiveFailures = 0;
    this.lastToolNames = [];
  }

  recordFailure(toolName: string): number {
    this.consecutiveFailures++;
    this.lastToolNames.push(toolName);
    return this.consecutiveFailures;
  }

  isStuck(): boolean {
    if (this.consecutiveFailures >= 3) return true;
    // Also detect repeated same-tool retries
    if (this.lastToolNames.length >= this.maxRepeatSameTool) {
      const last3 = this.lastToolNames.slice(-this.maxRepeatSameTool);
      if (last3.every((n) => n === last3[0])) return true;
    }
    return false;
  }

  getStuckReason(): string {
    if (this.lastToolNames.length >= this.maxRepeatSameTool) {
      const last3 = this.lastToolNames.slice(-this.maxRepeatSameTool);
      if (last3.every((n) => n === last3[0])) {
        return `Tool "${last3[0]}" has been retried ${this.maxRepeatSameTool} times consecutively`;
      }
    }
    return `${this.consecutiveFailures} consecutive tool failures`;
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.lastToolNames = [];
  }
}
