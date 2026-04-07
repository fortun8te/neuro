/**
 * Zod schemas for Wayfayer API responses
 * Validates response structure before processing
 */

import { z } from 'zod';

/**
 * Schema for a single page result from Wayfayer research
 */
const WayfayerPageSchema = z.object({
  url: z.string().url('Invalid URL in page result'),
  title: z.string(),
  content: z.string(),
  snippet: z.string(),
  source: z.string(),
});

/**
 * Schema for a source metadata entry
 */
const WayfayerSourceSchema = z.object({
  url: z.string().url('Invalid URL in source'),
  title: z.string(),
  snippet: z.string(),
});

/**
 * Schema for research metadata
 */
const WayfayerMetaSchema = z.object({
  total: z.number().int().min(0),
  success: z.number().int().min(0),
  elapsed: z.number().min(0),
  error: z.string().optional(),
});

/**
 * Schema for Wayfayer /research endpoint response
 */
export const WayfayerResultSchema = z.object({
  query: z.string(),
  text: z.string(),
  pages: z.array(WayfayerPageSchema),
  sources: z.array(WayfayerSourceSchema),
  meta: WayfayerMetaSchema,
});

/**
 * Schema for a single screenshot result
 */
const ScreenshotResultSchema = z.object({
  url: z.string().url('Invalid URL in screenshot result'),
  image_base64: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  error: z.string().nullable().optional(),
});

/**
 * Schema for Wayfayer /screenshot/batch endpoint response
 */
export const ScreenshotBatchSchema = z.object({
  screenshots: z.array(ScreenshotResultSchema),
});

/**
 * Schema for Wayfayer /screenshot single endpoint response
 */
export const ScreenshotSingleSchema = z.object({
  url: z.string(),
  image_base64: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  error: z.string().nullable().optional(),
});

/**
 * Schema for session operations (start, action, end)
 */
export const SessionOperationSchema = z.object({
  session_id: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  result: z.unknown().optional(),
});

/**
 * Validate a research result from Wayfayer
 */
export function validateWayfayerResult(data: unknown): z.infer<typeof WayfayerResultSchema> {
  return WayfayerResultSchema.parse(data);
}

/**
 * Validate a screenshot batch response
 */
export function validateScreenshotBatch(data: unknown): z.infer<typeof ScreenshotBatchSchema> {
  return ScreenshotBatchSchema.parse(data);
}

/**
 * Validate a single screenshot response
 */
export function validateScreenshotSingle(data: unknown): z.infer<typeof ScreenshotSingleSchema> {
  return ScreenshotSingleSchema.parse(data);
}

/**
 * Validate a session operation response
 */
export function validateSessionOperation(data: unknown): z.infer<typeof SessionOperationSchema> {
  return SessionOperationSchema.parse(data);
}
