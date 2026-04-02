/**
 * Context window configuration for different models
 */

export const CONTEXT_LIMITS = {
  'qwen3.5:0.8b': { window: 8192, reserve: 1024 },
  'qwen3.5:2b': { window: 32768, reserve: 4000 },
  'qwen3.5:4b': { window: 32768, reserve: 4000 },
  'qwen3.5:9b': { window: 32768, reserve: 4000 },
  'qwen3.5:27b': { window: 32768, reserve: 4000 },
  'chromadb-context-1:latest': { window: 131072, reserve: 8000 },
  'nemotron-3-super:120b': { window: 131072, reserve: 8000 },
};

export function getContextLimit(model: string) {
  return CONTEXT_LIMITS[model as keyof typeof CONTEXT_LIMITS] || {
    window: 8192,
    reserve: 1024
  };
}
