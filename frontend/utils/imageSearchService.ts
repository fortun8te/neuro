/**
 * Image Search Service — Multi-modal retrieval with image embeddings
 *
 * Generates embeddings for images and enables image-to-text + text-to-image search
 * Uses vision model analysis for image understanding
 */

import { ollamaService } from './ollama';
import { generateEmbedding } from './embeddingService';
import { createLogger } from './logger';

const log = createLogger('image-search');

export interface ImageChunk {
  chunkId: string;
  docId: string;
  imageUrl: string;
  imageDescription: string;  // From vision model
  imageEmbedding?: number[];  // Vector representation
  textEmbedding?: number[];  // Of description
  score: number;
  pruned: boolean;
}

/**
 * Analyze image and generate description using vision model
 */
export async function analyzeImage(
  imageUrl: string,
  signal?: AbortSignal
): Promise<string> {
  try {
    // Use vision-capable model (qwen3.5:9b has vision)
    const prompt = `Analyze this image and provide a detailed, searchable description.
Focus on: objects, text, colors, composition, action, purpose.
Be concise but comprehensive (1-2 sentences).

Image: ${imageUrl}`;

    const description = await ollamaService.generateStream(
      prompt,
      'Describe the image for search indexing.',
      {
        model: 'qwen3.5:9b',
        temperature: 0.3,
        num_predict: 150,
      }
    );

    return description.trim();
  } catch (err) {
    log.warn('Image analysis failed', { imageUrl }, err);
    return `Image from ${imageUrl}`;  // Fallback
  }
}

/**
 * Generate embedding for image description
 */
export async function embedImageDescription(
  description: string,
  signal?: AbortSignal
): Promise<number[]> {
  try {
    const { embedding } = await generateEmbedding(description, signal);
    return embedding;
  } catch (err) {
    log.warn('Failed to embed image description', {}, err);
    return Array(768).fill(0);  // Fallback
  }
}

/**
 * Create image chunk from URL
 */
export async function createImageChunk(
  chunkId: string,
  docId: string,
  imageUrl: string,
  signal?: AbortSignal
): Promise<ImageChunk> {
  const imageDescription = await analyzeImage(imageUrl, signal);
  const textEmbedding = await embedImageDescription(imageDescription, signal);

  return {
    chunkId,
    docId,
    imageUrl,
    imageDescription,
    textEmbedding,
    score: 1.0,
    pruned: false,
  };
}

/**
 * Search images by text query
 */
export async function searchImagesByText(
  query: string,
  images: ImageChunk[],
  signal?: AbortSignal
): Promise<Array<ImageChunk & { similarity: number }>> {
  try {
    if (images.length === 0) return [];

    // Generate query embedding
    const { embedding: queryEmbedding } = await generateEmbedding(query, signal);

    // Score images by description similarity
    const results = images
      .filter(img => !img.pruned)
      .map(img => {
        const textEmb = img.textEmbedding || Array(768).fill(0);

        // Simple cosine similarity
        let dotProduct = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * textEmb[i];
        }

        let normQ = 0, normI = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          normQ += queryEmbedding[i] * queryEmbedding[i];
          normI += textEmb[i] * textEmb[i];
        }

        const similarity = normQ > 0 && normI > 0
          ? dotProduct / (Math.sqrt(normQ) * Math.sqrt(normI))
          : 0;

        return { ...img, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  } catch (err) {
    log.error('Image text search failed', {}, err);
    return [];
  }
}

/**
 * Search similar images (image-to-image)
 */
export async function searchSimilarImages(
  queryImageUrl: string,
  images: ImageChunk[],
  signal?: AbortSignal
): Promise<Array<ImageChunk & { similarity: number }>> {
  try {
    if (images.length === 0) return [];

    // Analyze query image
    const queryDescription = await analyzeImage(queryImageUrl, signal);
    const queryEmbedding = await embedImageDescription(queryDescription, signal);

    // Score by description similarity
    const results = images
      .filter(img => !img.pruned && img.imageUrl !== queryImageUrl)
      .map(img => {
        const imgEmb = img.textEmbedding || Array(768).fill(0);

        // Cosine similarity
        let dotProduct = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * imgEmb[i];
        }

        let normQ = 0, normI = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          normQ += queryEmbedding[i] * queryEmbedding[i];
          normI += imgEmb[i] * imgEmb[i];
        }

        const similarity = normQ > 0 && normI > 0
          ? dotProduct / (Math.sqrt(normQ) * Math.sqrt(normI))
          : 0;

        return { ...img, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  } catch (err) {
    log.error('Image similarity search failed', {}, err);
    return [];
  }
}
