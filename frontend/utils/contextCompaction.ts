/**
 * Context Auto-Compaction — Token management for conversations
 * Monitors conversation size and warns when approaching limits
 */

import type { Conversation, StoredMessageBlock } from './chatHistory';

const MAX_TOKENS = 128000; // Claude context window
const COMPACT_THRESHOLD = 0.8; // Warn when 80% full
const CRITICAL_THRESHOLD = 0.95; // Critical when 95% full

/**
 * Rough token estimation (1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate conversation tokens
 */
export function estimateConversationTokens(messages: StoredMessageBlock[]): number {
  return messages.reduce((sum, msg) => {
    const tokens = estimateTokens(msg.content || '');
    return sum + tokens;
  }, 0);
}

/**
 * Create a summary of old messages
 */
function createSummary(messages: StoredMessageBlock[]): string {
  if (messages.length === 0) return '';

  const topics = messages
    .slice(0, Math.max(3, Math.floor(messages.length * 0.2)))
    .map(m => m.content?.slice(0, 80))
    .filter(Boolean)
    .join('; ');

  return `[Conversation history: ${messages.length} messages, topics: ${topics}...]`;
}

/**
 * Check if conversation needs compaction
 */
export function needsCompaction(conversation: Conversation): boolean {
  const tokens = estimateConversationTokens(conversation.messages);
  return tokens >= MAX_TOKENS * COMPACT_THRESHOLD;
}

/**
 * Check if at critical threshold (should stop accepting more)
 */
export function isCritical(conversation: Conversation): boolean {
  const tokens = estimateConversationTokens(conversation.messages);
  return tokens >= MAX_TOKENS * CRITICAL_THRESHOLD;
}

/**
 * Get compaction stats for UI display
 */
export function getCompactionStats(conversation: Conversation) {
  const tokens = estimateConversationTokens(conversation.messages);
  const percentFull = (tokens / MAX_TOKENS) * 100;
  const remaining = MAX_TOKENS - tokens;

  return {
    currentTokens: tokens,
    maxTokens: MAX_TOKENS,
    remainingTokens: Math.max(0, remaining),
    percentFull: percentFull.toFixed(1),
    percentFullNumber: percentFull,
    needsCompaction: percentFull >= COMPACT_THRESHOLD * 100,
    isCritical: percentFull >= CRITICAL_THRESHOLD * 100,
    messageCount: conversation.messages.length,
    userMessageCount: conversation.messages.filter(m => m.type === 'user').length,
  };
}

/**
 * Suggest message pruning (remove oldest user messages)
 */
export function getSuggestedPruning(
  conversation: Conversation,
  targetReduction: number = 0.2, // Reduce by 20%
): number {
  const stats = getCompactionStats(conversation);

  if (!stats.needsCompaction) {
    return 0; // No pruning needed
  }

  // Calculate how many messages to remove
  const messagesPerToken = stats.messageCount / stats.currentTokens;
  const tokensToRemove = stats.currentTokens * targetReduction;
  const messagesToRemove = Math.ceil(tokensToRemove * messagesPerToken);

  return Math.min(messagesToRemove, stats.userMessageCount - 2); // Keep at least 2 user messages
}

/**
 * Check if conversation should auto-save due to size
 */
export function shouldAutoSave(conversation: Conversation): boolean {
  return needsCompaction(conversation);
}
