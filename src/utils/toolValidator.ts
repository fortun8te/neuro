/**
 * Tool Validation Module
 *
 * Handles parsing, validation, and classification of tool calls from LLM output.
 * Extracted from agentEngine.ts for single responsibility and testability.
 */

import { isIdentityQuestion, rewriteWithNeuro } from './neuroRewriter';

export type ToolErrorKind = 'respond_to_model' | 'fatal' | 'malformed';

export interface ToolCallError {
  kind: ToolErrorKind;
  message: string;
}

export interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Parse a single tool call from text.
 * Looks for patterns like:
 *   ```tool
 *   { "name": "...", "args": {...} }
 *   ```
 */
export function parseToolCall(text: string): ParsedToolCall | null {
  const pattern = /```tool\n\s*([\s\S]*?)\n\s*```/;
  const match = text.match(pattern);

  if (!match) return null;

  try {
    const json = JSON.parse(match[1]);
    if (json.name && typeof json.name === 'string' && json.args && typeof json.args === 'object') {
      return { name: json.name, args: json.args };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Parse all tool calls from text (handles multiple sequential calls).
 */
export function parseAllToolCalls(text: string): ParsedToolCall[] {
  const pattern = /```tool\n\s*([\s\S]*?)\n\s*```/g;
  const calls: ParsedToolCall[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      if (json.name && typeof json.name === 'string' && json.args && typeof json.args === 'object') {
        calls.push({ name: json.name, args: json.args });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  return calls;
}

/**
 * Extract parallel tool calls from explicit syntax like:
 * ```parallel
 * tool1: { ... }
 * tool2: { ... }
 * ```
 */
export function parseExplicitParallel(text: string): string[] {
  const pattern = /```parallel\n([\s\S]*?)\n```/;
  const match = text.match(pattern);
  if (!match) return [];

  const lines = match[1].split('\n');
  const toolIds: string[] = [];
  for (const line of lines) {
    const toolMatch = line.match(/^(\w+):\s*\{/);
    if (toolMatch) toolIds.push(toolMatch[1]);
  }
  return toolIds;
}

/**
 * Normalize tool names (lowercase, underscores).
 */
export function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[-\s]/g, '_');
}

/**
 * Check if text looks like a fake tool narration (pretend tool use without actual format).
 */
export function looksLikeFakeToolNarration(text: string, _stepHadToolCall: boolean): boolean {
  const fakePatterns = [
    /I (would|would've|could|will) (call|use|invoke)/i,
    /\(calling.*?\)/i,
    /\[calling.*?\]/i,
    /I should (call|use|invoke)/i,
  ];

  // If text mentions tools but has no actual tool format, likely fake
  if (fakePatterns.some(p => p.test(text))) {
    return !text.includes('```tool') && !text.includes('```parallel');
  }

  return false;
}

/**
 * Check if text contains a model identity claim (e.g., "I'm Claude" or "I'm Qwen").
 */
export function looksLikeModelIdentityClaim(text: string): boolean {
  // Check for explicit claims
  const claimPatterns = [
    /I['´]?m\s+(an?\s+)?(?:Claude|GPT|Qwen|Llama|Mistral|Llama|Deepseek|Qwq|Grok)/i,
    /(?:I'm|I am)\s+(?:Claude|GPT|Qwen|Llama|Mistral|deepseek|Qwq|Grok)/i,
    /my name is (?:Claude|GPT|Qwen|Llama|Mistral|deepseek|Qwq|Grok)/i,
    /^(?:Claude|GPT|Qwen|Llama|Mistral|deepseek|Qwq|Grok)[,:.\s]/i,
    /(?:built by|developed by|created by) (?:Anthropic|OpenAI|Alibaba|Meta|Mistral|DeepSeek|xAI)/i,
  ];

  return claimPatterns.some(pattern => pattern.test(text));
}

/**
 * Count emojis in text.
 */
export function countEmoji(text: string): number {
  const emojiPattern =
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  const matches = text.match(emojiPattern);
  return matches ? matches.length : 0;
}

/**
 * Classify tool errors for LLM feedback.
 */
export function classifyToolError(errorOutput: string): ToolCallError {
  if (errorOutput.startsWith('Unknown tool:')) {
    return { kind: 'fatal', message: errorOutput };
  }
  if (
    errorOutput.includes('JSON') ||
    errorOutput.includes('parse') ||
    errorOutput.includes('SyntaxError')
  ) {
    return { kind: 'malformed', message: errorOutput };
  }
  return { kind: 'respond_to_model', message: errorOutput };
}

/**
 * Detect if text looks like a malformed tool call (JSON parse error, missing fields, etc.).
 */
export function looksLikeMalformedToolCall(text: string): boolean {
  // Patterns that indicate attempted tool call but malformed
  return (
    (text.includes('```tool') && text.includes('SyntaxError')) ||
    (text.includes('"name"') && text.includes('"args"') && !text.includes('```tool')) ||
    (/\{.*"name".*"args"/s.test(text) && !text.includes('```')) ||
    text.includes('JSON.parse') ||
    text.includes('unexpected token')
  );
}

/**
 * Detect if text looks like an error response (often prefixed with "Error:" or similar).
 */
export function looksLikeErrorResponse(text: string): boolean {
  const errorPatterns = [
    /^Error:/i,
    /^Failed:/i,
    /^Unable to:/i,
    /^Sorry, I (can't|cannot)/i,
    /^Unfortunately,.*(?:not|unable|failed|error)/i,
  ];

  return errorPatterns.some(p => p.test(text.trim()));
}

/**
 * Sanitize agent output (remove invalid characters, enforce formatting rules).
 */
export function sanitizeAgentOutput(text: string): string {
  if (!text) return '';

  // Replace em-dash characters with standard hyphen in tool calls to prevent parsing issues
  let cleaned = text.replace(/[—–]/g, '-');

  // Remove control characters except newlines and tabs
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Extract thinking/reasoning from step output (usually wrapped in <thinking> tags).
 */
export function extractThinking(text: string): string {
  const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/;
  const match = text.match(thinkingPattern);
  return match ? match[1].trim() : '';
}
