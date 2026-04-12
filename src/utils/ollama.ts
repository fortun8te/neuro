/**
 * Ollama Service — CLI/Backend implementation
 * Connects to remote Ollama instance for model inference
 */

import { createLogger } from './logger.js';

const log = createLogger('ollama');

export interface GenerateOptions {
  temperature?: number;
  num_ctx?: number;
  top_p?: number;
  top_k?: number;
}

export class OllamaService {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string = process.env.VITE_OLLAMA_URL || 'http://100.74.135.83:11440') {
    this.baseUrl = baseUrl;
    this.defaultModel = 'qwen3.5:4b';
  }

  /**
   * Generate text using streaming
   */
  async generateStream(
    prompt: string,
    model: string = this.defaultModel,
    options: GenerateOptions = {}
  ): Promise<string> {
    try {
      log.info(`Calling ${model} for generation`);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          temperature: options.temperature ?? 0.7,
          num_ctx: options.num_ctx ?? 4096
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.response || '';
    } catch (error) {
      log.error('Generation failed', { error });
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async embed(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text })
      });

      if (!response.ok) {
        throw new Error(`Embedding error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.embedding || [];
    } catch (error) {
      log.error('Embedding failed', { error });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const ollamaService = new OllamaService();
