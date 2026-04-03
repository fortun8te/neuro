/**
 * Render Stage
 * Takes .blend concepts and renders them on remote GPU via Blender addon
 * Feeds rendered images to Test stage for evaluation
 */

import { blenderConnector } from './blenderConnector';
import fs from 'fs';
import path from 'path';

interface ConceptToRender {
  id: string;
  conceptName: string;
  blendFile: string; // path to .blend file
  width?: number;
  height?: number;
  samples?: number;
}

interface RenderedConcept {
  id: string;
  conceptName: string;
  pngBuffer: Buffer;
  renderTime: number;
  success: boolean;
  error?: string;
}

export async function renderConcepts(
  concepts: ConceptToRender[],
  config: {
    blenderHost: string;
    blenderPort: number;
    width?: number;
    height?: number;
    samples?: number;
  },
  signal?: AbortSignal,
  onChunk?: (status: string) => void
): Promise<RenderedConcept[]> {
  const results: RenderedConcept[] = [];

  // Connect to Blender
  onChunk?.(`[Render] Connecting to Blender server at ${config.blenderHost}:${config.blenderPort}...`);

  const connected = await blenderConnector.connect({
    host: config.blenderHost,
    port: config.blenderPort,
  });

  if (!connected) {
    const error = `[Render] Failed to connect to Blender server`;
    onChunk?.(error);
    return concepts.map((c) => ({
      id: c.id,
      conceptName: c.conceptName,
      pngBuffer: Buffer.alloc(0),
      renderTime: 0,
      success: false,
      error,
    }));
  }

  onChunk?.(`[Render] Connected! Processing ${concepts.length} concepts...`);

  // Render each concept
  for (const concept of concepts) {
    if (signal?.aborted) break;

    try {
      onChunk?.(`[Render] Rendering "${concept.conceptName}"...`);

      // Read .blend file
      const blendData = fs.readFileSync(concept.blendFile);

      // Send to Blender
      const startTime = Date.now();
      const result = await blenderConnector.render({
        blendFile: blendData,
        width: concept.width || config.width || 1920,
        height: concept.height || config.height || 1080,
        samples: concept.samples || config.samples || 128,
      });
      const renderTime = Date.now() - startTime;

      if (result.success && result.pngBuffer) {
        onChunk?.(`[Render] ✓ Rendered in ${(renderTime / 1000).toFixed(1)}s`);
        results.push({
          id: concept.id,
          conceptName: concept.conceptName,
          pngBuffer: result.pngBuffer,
          renderTime,
          success: true,
        });
      } else {
        onChunk?.(`[Render] ✗ Failed: ${result.error}`);
        results.push({
          id: concept.id,
          conceptName: concept.conceptName,
          pngBuffer: Buffer.alloc(0),
          renderTime,
          success: false,
          error: result.error,
        });
      }
    } catch (err) {
      const error = String(err);
      onChunk?.(`[Render] ✗ Error: ${error}`);
      results.push({
        id: concept.id,
        conceptName: concept.conceptName,
        pngBuffer: Buffer.alloc(0),
        renderTime: 0,
        success: false,
        error,
      });
    }
  }

  blenderConnector.disconnect();
  onChunk?.(`[Render] Complete - ${results.filter((r) => r.success).length}/${results.length} rendered`);

  return results;
}
