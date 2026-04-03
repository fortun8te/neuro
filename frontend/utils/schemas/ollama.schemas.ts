/**
 * Zod schemas for Ollama API responses
 * Validates response structure before processing
 */

import { z } from 'zod';

/**
 * Schema for Ollama /api/generate streaming response (one line per event)
 */
export const OllamaGenerateResponseSchema = z.object({
  model: z.string(),
  created_at: z.string(),
  response: z.string().optional(),
  done: z.boolean(),
  context: z.array(z.number()).optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional(),
  // Thinking tokens (for models that support it)
  thinking: z.string().optional(),
});

/**
 * Schema for Ollama /api/chat streaming response (one line per event)
 */
export const OllamaChatResponseSchema = z.object({
  model: z.string(),
  created_at: z.string(),
  message: z.object({
    role: z.string(),
    content: z.string(),
    // Optional image data in responses (some models may return it)
    images: z.array(z.string()).optional(),
    thinking: z.string().optional(),
  }).optional(),
  done: z.boolean(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional(),
});

/**
 * Schema for Ollama /api/tags response
 * Used for listing available models
 */
export const OllamaTagsResponseSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
    modified_at: z.string(),
    size: z.number(),
    digest: z.string(),
    details: z.object({
      families: z.array(z.string()).optional(),
      parameter_size: z.string().optional(),
      quantization_level: z.string().optional(),
    }).optional(),
  })),
});

/**
 * Union of all possible Ollama response types
 */
export const AnyOllamaResponseSchema = z.union([
  OllamaGenerateResponseSchema,
  OllamaChatResponseSchema,
]);

/**
 * Validate a single streaming JSON line from Ollama
 */
export function validateOllamaResponse(data: unknown): z.infer<typeof AnyOllamaResponseSchema> {
  return AnyOllamaResponseSchema.parse(data);
}

/**
 * Validate the /api/tags list response
 */
export function validateOllamaTagsResponse(data: unknown): z.infer<typeof OllamaTagsResponseSchema> {
  return OllamaTagsResponseSchema.parse(data);
}
