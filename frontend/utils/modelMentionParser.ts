/**
 * @model mention parser — Extract model overrides from user messages
 *
 * Supports:
 *   @nemotron → nemotron-3-super:120b
 *   @qwen3.5:4b → qwen3.5:4b
 *   @qwen3.5:9b → qwen3.5:9b
 *   @qwen3.5:2b → qwen3.5:2b
 *   @gpt-oss-20b → gpt-oss-20b
 *   @neuro → NEURO-1-B2-4B
 *   @context1 → context-1
 */

export interface ModelMentionResult {
  mentionedModel: string | null;     // e.g. "nemotron-3-super:120b"
  cleanedMessage: string;             // message with @mention removed
  displayName: string | null;         // e.g. "Nemotron" for UI badge
}

/**
 * Model mention → actual model name mapping
 * Handles aliases and short names
 */
const MODEL_MENTION_MAP: Record<string, { model: string; display: string }> = {
  // Nemotron (hardest thinker)
  nemotron: { model: 'nemotron-3-super:120b', display: 'Nemotron' },
  'nemotron-3-super': { model: 'nemotron-3-super:120b', display: 'Nemotron' },
  'nemotron:120b': { model: 'nemotron-3-super:120b', display: 'Nemotron' },

  // Qwen models
  'qwen3.5:0.8b': { model: 'qwen3.5:0.8b', display: 'Qwen 0.8b' },
  'qwen0.8b': { model: 'qwen3.5:0.8b', display: 'Qwen 0.8b' },
  'qwen-tiny': { model: 'qwen3.5:0.8b', display: 'Qwen 0.8b' },

  'qwen3.5:2b': { model: 'qwen3.5:2b', display: 'Qwen 2b' },
  'qwen2b': { model: 'qwen3.5:2b', display: 'Qwen 2b' },
  'qwen-small': { model: 'qwen3.5:2b', display: 'Qwen 2b' },

  'qwen3.5:4b': { model: 'qwen3.5:4b', display: 'Qwen 4b' },
  'qwen4b': { model: 'qwen3.5:4b', display: 'Qwen 4b' },
  'qwen-medium': { model: 'qwen3.5:4b', display: 'Qwen 4b' },

  'qwen3.5:9b': { model: 'qwen3.5:9b', display: 'Qwen 9b' },
  'qwen9b': { model: 'qwen3.5:9b', display: 'Qwen 9b' },
  'qwen-large': { model: 'qwen3.5:9b', display: 'Qwen 9b' },

  'qwen3.5:27b': { model: 'qwen3.5:27b', display: 'Qwen 27b' },
  'qwen27b': { model: 'qwen3.5:27b', display: 'Qwen 27b' },
  'qwen-xlarge': { model: 'qwen3.5:27b', display: 'Qwen 27b' },

  // GPT-OSS
  'gpt-oss-20b': { model: 'gpt-oss-20b', display: 'GPT-OSS 20b' },
  'gpt-oss': { model: 'gpt-oss-20b', display: 'GPT-OSS 20b' },
  'gpt20b': { model: 'gpt-oss-20b', display: 'GPT-OSS 20b' },

  // Neuro identity model
  neuro: { model: 'NEURO-1-B2-4B', display: 'Neuro' },
  'neuro-1-b2-4b': { model: 'NEURO-1-B2-4B', display: 'Neuro' },

  // Context-1 retrieval
  'context-1': { model: 'context-1', display: 'Context-1' },
  context1: { model: 'context-1', display: 'Context-1' },

  // xLAM tool calling
  xlam: { model: 'allenporter/xlam:1b', display: 'xLAM' },

  // Aliases for common use cases
  fast: { model: 'qwen3.5:2b', display: 'Qwen 2b (fast)' },
  small: { model: 'qwen3.5:2b', display: 'Qwen 2b' },
  medium: { model: 'qwen3.5:4b', display: 'Qwen 4b' },
  large: { model: 'qwen3.5:9b', display: 'Qwen 9b' },
  xlarge: { model: 'qwen3.5:27b', display: 'Qwen 27b' },
  best: { model: 'nemotron-3-super:120b', display: 'Nemotron' },
  powerful: { model: 'nemotron-3-super:120b', display: 'Nemotron' },
};

/**
 * Parse @model mention from message
 *
 * Regex: /@([\w\-.:0-9]+)/g
 * Captures: @nemotron, @qwen3.5:4b, @gpt-oss-20b, etc.
 *
 * Returns:
 *   - mentionedModel: actual model name (e.g. "qwen3.5:4b") or null if not found
 *   - cleanedMessage: message with @mention removed
 *   - displayName: human-readable name for UI (e.g. "Qwen 4b")
 */
export function parseModelMention(message: string): ModelMentionResult {
  const mentionRegex = /@([\w\-.:0-9]+)/g;
  let match = mentionRegex.exec(message);

  if (!match) {
    // No @mention found
    return {
      mentionedModel: null,
      cleanedMessage: message,
      displayName: null,
    };
  }

  // Extract the first @mention (ignore duplicates)
  const mentionedStr = match[1].toLowerCase();
  const config = MODEL_MENTION_MAP[mentionedStr];

  if (!config) {
    // Unknown model mentioned — ignore and return original message
    return {
      mentionedModel: null,
      cleanedMessage: message,
      displayName: null,
    };
  }

  // Remove the @mention from the message (keep the rest)
  // Also collapse multiple spaces into one
  const cleanedMessage = message.replace(/@[\w\-.:0-9]+/, '').replace(/\s+/g, ' ').trim();

  return {
    mentionedModel: config.model,
    cleanedMessage,
    displayName: config.display,
  };
}

/**
 * Check if a given model name is recognized in our registry
 */
export function isKnownModel(modelName: string): boolean {
  return modelName.toLowerCase() in MODEL_MENTION_MAP;
}

/**
 * Get all available model aliases for autocomplete/help
 */
export function getAvailableModelMentions(): Array<{ mention: string; model: string; display: string }> {
  const seen = new Set<string>();
  const result: Array<{ mention: string; model: string; display: string }> = [];

  for (const [mention, config] of Object.entries(MODEL_MENTION_MAP)) {
    const key = config.model; // Use actual model as dedup key
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ mention, model: config.model, display: config.display });
    }
  }

  return result.sort((a, b) => a.model.localeCompare(b.model));
}
