/**
 * Orchestrator Router — Qwen 3.5:4b for research orchestration
 *
 * Previously attempted to route to Context-1, but Context-1 is a retrieval
 * subagent (finds documents), NOT an orchestrator (decides what to research).
 * Context-1 is available via context1Service.retrieve() as a tool/subagent.
 *
 * Orchestration always uses Qwen 3.5:4b.
 */

import { ollamaService } from './ollama';
import { createLogger } from './logger';

const log = createLogger('orchestratorRouter');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrchestratorDecisionOptions {
  model?: string;
  temperature?: number;
  numPredict?: number;
  think?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  onThinkChunk?: (chunk: string) => void;
}

export interface OrchestratorSource {
  model: string;
  endpoint: string;
  latencyMs: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

let _lastSource: OrchestratorSource | null = null;

export const orchestratorRouter = {
  /**
   * Generate orchestrator decision using Qwen 3.5:4b.
   */
  async generateOrchestratorDecision(
    prompt: string,
    systemPrompt: string,
    options?: OrchestratorDecisionOptions
  ): Promise<string> {
    const startTime = Date.now();
    const model = options?.model ?? 'qwen3.5:4b';

    try {
      log.info(`Orchestrator: ${model}`);
      const result = await ollamaService.generateStream(
        prompt,
        systemPrompt,
        {
          model,
          temperature: options?.temperature ?? 0.5,
          num_predict: options?.numPredict ?? 400,
          think: options?.think ?? false,
          signal: options?.signal,
          onChunk: options?.onChunk,
          onThink: options?.onThinkChunk,
        }
      );

      _lastSource = { model, endpoint: 'ollama', latencyMs: Date.now() - startTime };
      return result;
    } catch (err) {
      log.error('Orchestrator failed', {}, err);
      throw new Error(`Orchestrator failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  },

  getLastOrchestratorSource(): OrchestratorSource | null { return _lastSource; },
  resetLastSource(): void { _lastSource = null; },
};
