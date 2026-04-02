/**
 * Accurate token counting using js-tiktoken
 */

import { encodingForModel } from 'js-tiktoken';

// Use cl100k_base encoding (similar to Claude/Qwen models)
const encoding = encodingForModel('gpt-3.5-turbo');

export function countTokensAccurate(text: string): number {
  if (!text) return 0;
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (e) {
    console.warn('Token counting error, falling back to heuristic');
    return countTokensEstimate(text);
  }
}

export function countTokensEstimate(text: string): number {
  // Conservative fallback: 1 token per 3.5 chars
  return Math.ceil(text.length / 3.5);
}

/**
 * Image token counting for vision models
 */
export function countImageTokens(
  width: number,
  height: number,
  detail: 'low' | 'high' = 'high'
): number {
  if (detail === 'low') {
    return 85; // Low detail always 85
  }

  // High detail: 170 base + 129 per 512x512 tile
  const tiles = Math.ceil((width * height) / (512 * 512));
  return 170 + (tiles * 129);
}

/**
 * JSON token counting (accounts for structure)
 */
export function countJSONTokens(obj: unknown): number {
  const json = JSON.stringify(obj, null, 2);
  return countTokensAccurate(json);
}
