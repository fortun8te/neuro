/**
 * tokenCounter.ts -- Rough token estimation and context management.
 *
 * No tiktoken dependency -- uses character-based approximation.
 * Rule of thumb: 1 token ~ 4 characters for English text.
 * Images: ~1000 tokens per image at standard JPEG resolution.
 */

// ─────────────────────────────────────────────────────────────
// Estimation
// ─────────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateImageTokens(): number {
  return 1000; // rough estimate for a JPEG screenshot
}

// ─────────────────────────────────────────────────────────────
// Context budget
// ─────────────────────────────────────────────────────────────

export interface ContextBudget {
  maxTokens: number;         // model's context window
  reserveForOutput: number;  // tokens reserved for LLM response
  systemPromptTokens: number;
  messageTokens: number;
  imageTokens: number;
  available: number;         // how many tokens are left
  utilizationPct: number;    // 0-100
}

export function calculateBudget(
  maxContext: number,
  reserveOutput: number,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  imageCount: number = 0,
): ContextBudget {
  const systemTokens = estimateTokens(systemPrompt);
  const msgTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const imgTokens = imageCount * estimateImageTokens();
  const used = systemTokens + msgTokens + imgTokens + reserveOutput;
  const available = Math.max(0, maxContext - used);

  return {
    maxTokens: maxContext,
    reserveForOutput: reserveOutput,
    systemPromptTokens: systemTokens,
    messageTokens: msgTokens,
    imageTokens: imgTokens,
    available,
    utilizationPct: Math.round((used / maxContext) * 100),
  };
}

// ─────────────────────────────────────────────────────────────
// Model context windows
// ─────────────────────────────────────────────────────────────

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'qwen3.5:0.8b': 8192,
  'qwen3.5:2b': 32768,
  'qwen3.5:4b': 32768,
  'qwen3.5:9b': 32768,
  'qwen3.5:27b': 32768,
  'nemotron-3-super:120b': 131072,
  'chromadb-context-1:latest': 131072,
};

export function getContextWindow(model: string): number {
  return MODEL_CONTEXT_WINDOWS[model] || 8192;
}

// ─────────────────────────────────────────────────────────────
// Context compaction
// ─────────────────────────────────────────────────────────────

/**
 * Compact messages when context is running low.
 * Strategy: keep the last N messages intact, summarize everything before.
 */
export function compactMessages(
  messages: Array<{ role: string; content: string }>,
  targetTokens: number,
): Array<{ role: string; content: string }> {
  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  if (totalTokens <= targetTokens) return messages;

  // Keep the 5 most recent messages
  const keepLast = 5;
  const recentMessages = messages.slice(-keepLast);
  const oldMessages = messages.slice(0, -keepLast);

  if (oldMessages.length === 0) {
    // Can't compact further -- truncate individual messages
    return recentMessages.map(m => ({
      ...m,
      content: m.content.slice(0, 1000) + '... (truncated)',
    }));
  }

  // Summarize old messages into a compact summary
  const summary = oldMessages.map(m => {
    const prefix = m.role === 'user' ? 'User' : 'Agent';
    return `${prefix}: ${m.content.slice(0, 100)}`;
  }).join('\n');

  const compactedSummary: { role: string; content: string } = {
    role: 'system',
    content: `[Earlier in this conversation]\n${summary}\n[End of earlier context]`,
  };

  return [compactedSummary, ...recentMessages];
}
