// @ts-nocheck
// Ollama routing:
//   Default: Wayfayer proxy (localhost:8889/ollama/...) → remote Ollama
//   "local:" prefix: direct to the configured endpoint (bypasses proxy)
// Wayfayer handles: CORS bypass, streaming, duplicate-header tolerance
//
// Endpoint is configurable via Settings → getOllamaEndpoint() (localStorage).
// Retry logic: 3 attempts with 2s delay for transient network failures.
// Health check: ollamaService.healthCheck() returns detailed status.

import { tokenTracker } from './tokenStats';
import { getOllamaEndpoint } from './modelConfig';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { createLogger } from './logger';
import { logModelUsage } from './modelUsageLogger';
import { getOrCreateBreaker } from './circuitBreaker';
import { validateOllamaResponse } from './schemas/ollama.schemas';
import { loadMonitor } from '../services/loadMonitor';

const log = createLogger('ollama');

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DIRECT_OLLAMA = INFRASTRUCTURE.ollamaUrl;
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (doubles each attempt) */
const RETRY_BASE_DELAY_MS = 1000;

/** Connection timeout — how long to wait for the HTTP connection itself.
 *  Set high because Ollama queues requests when busy (main agent + subagents)
 *  and won't send HTTP headers until it starts processing. */
const CONNECT_TIMEOUT_MS = 120_000;
/** Connection timeout for vision calls (larger payloads) */
const CONNECT_TIMEOUT_VISION_MS = 120_000;

// ─────────────────────────────────────────────────────────────
// Connection state — shared across the app
// ─────────────────────────────────────────────────────────────

export type OllamaConnectionStatus = 'unknown' | 'connected' | 'disconnected';

export interface OllamaHealthResult {
  status: OllamaConnectionStatus;
  endpoint: string;
  latencyMs: number;
  modelCount?: number;
  loadedModels?: string[];
  error?: string;
}

let _connectionStatus: OllamaConnectionStatus = 'unknown';
let _lastHealthResult: OllamaHealthResult | null = null;

/** Global health flag — true when Ollama was reachable on last check */
let _ollamaHealthy = true;

type ConnectionListener = (status: OllamaConnectionStatus, result: OllamaHealthResult) => void;
const _listeners = new Set<ConnectionListener>();

function notifyListeners(status: OllamaConnectionStatus, result: OllamaHealthResult) {
  _connectionStatus = status;
  _lastHealthResult = result;
  _ollamaHealthy = status === 'connected';
  for (const cb of _listeners) {
    try { cb(status, result); } catch (e) { log.warn('Connection listener threw', {}, e); }
  }
}

/** Check whether Ollama is currently considered healthy (last probe succeeded). */
export function isOllamaHealthy(): boolean {
  return _ollamaHealthy;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Strip "local:" prefix and return [cleanModel, apiBase] */
function resolveModel(model: string): [string, string] {
  if (model.startsWith('local:')) {
    return [model.slice(6), DIRECT_OLLAMA];
  }
  return [model, getOllamaEndpoint()];
}

/** Sleep for ms (cancellable via signal) */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/** Check if an error is retryable (network / transient server errors) */
function isRetryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network failures
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('econnreset')) return true;
    // Server overloaded / temporarily unavailable
    if (msg.includes('503') || msg.includes('502') || msg.includes('429')) return true;
  }
  return false;
}

/** Returns the currently configured Ollama endpoint (delegates to modelConfig) */
export function getOllamaHost(): string {
  return getOllamaEndpoint();
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];  // base64-encoded images for vision models (attached to user messages)
}

export interface OllamaOptions {
  model?: string;
  temperature?: number;
  top_p?: number;        // nucleus sampling (default 0.9)
  num_predict?: number;  // max tokens to generate (caps output length)
  num_ctx?: number;      // context window size — controls VRAM usage. Lower = more models fit in VRAM.
  images?: string[];     // base64-encoded images (no data: prefix), for vision models
  think?: boolean;       // Enable/disable thinking (default: model's default)
  messages?: ChatMessage[]; // When provided, uses /api/chat for proper conversation turns
  onChunk?: (chunk: string) => void;
  onThink?: (chunk: string) => void;  // thinking/reasoning tokens (Qwen3.5 27b+)
  onComplete?: () => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
  keep_alive?: string;   // e.g. "30m" — keep model loaded in VRAM
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export const ollamaService = {
  /** Quick connectivity check — returns true if Ollama responds */
  async checkConnection(): Promise<boolean> {
    try {
      const endpoint = getOllamaEndpoint();
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      return response.ok;
    } catch (e) {
      log.debug('Connection check failed', { endpoint: getOllamaEndpoint() }, e);
      return false;
    }
  },

  /**
   * Detailed health check — returns endpoint, latency, model count, loaded models.
   * Tries the configured endpoint first; if it fails, tries the direct Tailscale IP
   * as fallback (useful when Wayfayer is down).
   */
  async healthCheck(): Promise<OllamaHealthResult> {
    const endpoint = getOllamaEndpoint();
    const result = await probeEndpoint(endpoint);
    if (result.status === 'connected') {
      notifyListeners('connected', result);
      return result;
    }

    // Fallback: try direct Ollama if the configured endpoint is the proxy
    if (!endpoint.includes(DIRECT_OLLAMA)) {
      const fallback = await probeEndpoint(DIRECT_OLLAMA);
      if (fallback.status === 'connected') {
        fallback.error = `Primary endpoint (${endpoint}) unreachable; fell back to direct (${DIRECT_OLLAMA}). Note: direct may be blocked by browser CORS.`;
        notifyListeners('connected', fallback);
        return fallback;
      }
    }

    notifyListeners('disconnected', result);
    return result;
  },

  /** Subscribe to connection status changes */
  onConnectionChange(cb: ConnectionListener): () => void {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
  },

  /** Get the last known connection status without making a request */
  getConnectionStatus(): OllamaConnectionStatus { return _connectionStatus; },
  getLastHealthResult(): OllamaHealthResult | null { return _lastHealthResult; },

  /**
   * Run a startup connectivity test. Called once on app init.
   * Logs result but does not throw.
   */
  async startupCheck(): Promise<void> {
    const result = await this.healthCheck();
    if (result.status === 'connected') {
      log.info('Connected', { endpoint: result.endpoint, latencyMs: result.latencyMs, modelCount: result.modelCount });
    } else {
      log.warn('Cannot reach Ollama', { endpoint: result.endpoint, error: result.error });
    }
  },

  async generateStream(
    prompt: string,
    systemPrompt: string,
    options: OllamaOptions = {}
  ): Promise<string> {
    const { model = 'qwen3.5:9b', temperature = 0.7, top_p = 0.9, num_predict, num_ctx, images, think = false, messages, onChunk, onThink, onComplete, onError, signal, keep_alive } = options;
    const [cleanModel, apiBase] = resolveModel(model);

    const useChat = !!messages;
    const fullPrompt = useChat ? '' : `${systemPrompt}\n\n${prompt}`;

    // Log model usage start
    const startTime = Date.now();

    // Check load monitor before attempting request
    // Wait for capacity with 5-minute timeout
    try {
      await loadMonitor.waitForCapacity(cleanModel, 300_000);
    } catch (loadErr) {
      log.warn('Load monitor rejection', { model: cleanModel }, loadErr);
      onError?.(loadErr as Error);
      throw loadErr;
    }

    // Record task start
    const taskId = loadMonitor.recordTask(cleanModel);

    // Check circuit breaker before attempting request
    const breaker = getOrCreateBreaker('ollama', {
      failureThreshold: 5,
      resetTimeout: 30_000,
      name: 'Ollama'
    });

    try {
      breaker.canAttempt();
    } catch (cbError) {
      loadMonitor.releaseTask(cleanModel, taskId);
      log.warn('Circuit breaker blocking request', {}, cbError);
      onError?.(cbError as Error);
      throw cbError;
    }

    // Retry wrapper for transient failures
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let fullResponse = '';
      let trackingEnded = false;
      tokenTracker.startCall(cleanModel);

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        // Connection timeout: shorter for text, longer for vision (large base64 payloads)
        const hasImages = images && images.length > 0;
        const connectTimeoutMs = hasImages ? CONNECT_TIMEOUT_VISION_MS : CONNECT_TIMEOUT_MS;

        // Combine user abort signal + connection timeout into one
        const connectController = new AbortController();
        const onUserAbort = () => connectController.abort(signal?.reason);
        signal?.addEventListener('abort', onUserAbort, { once: true });
        timeoutId = setTimeout(() => connectController.abort(new Error(
          `Connection timeout after ${connectTimeoutMs / 1000}s — Ollama at ${apiBase} did not respond. Is the server running?`
        )), connectTimeoutMs);

        const endpoint = useChat ? `${apiBase}/api/chat` : `${apiBase}/api/generate`;

        // For /api/chat, images must be attached to the last user message, not top-level
        let chatMessages = messages;
        if (useChat && hasImages && messages) {
          chatMessages = messages.map((msg, idx) =>
            idx === messages.length - 1 && msg.role === 'user'
              ? { ...msg, images }
              : msg
          );
        }

        // Ollama's /api/chat accepts temperature/num_predict at top level,
        // but /api/generate requires them inside "options". We use "options"
        // for both to be safe — Ollama accepts it either way for /api/chat.
        const modelOptions: Record<string, unknown> = {
          temperature,
          top_p,
          ...(num_predict ? { num_predict } : {}),
          ...(num_ctx ? { num_ctx } : {}),
        };

        const body = useChat
          ? {
              model: cleanModel,
              messages: chatMessages,
              stream: true,
              options: modelOptions,
              ...(keep_alive ? { keep_alive } : {}),
              ...(think !== undefined ? { think } : {}),
            }
          : {
              model: cleanModel,
              prompt: fullPrompt,
              stream: true,
              options: modelOptions,
              ...(keep_alive ? { keep_alive } : {}),
              ...(hasImages ? { images } : {}),
              ...(think !== undefined ? { think } : {}),
            };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(body),
          signal: connectController.signal,
        });

        // Connection established — clear the connection timeout, remove listener
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = undefined; }
        signal?.removeEventListener('abort', onUserAbort);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Ollama API error:', response.status, response.statusText, errorText);
          const httpErr = new Error(
            response.status === 404
              ? `Model "${cleanModel}" not found on Ollama server. Pull it first with: ollama pull ${cleanModel}`
              : `Ollama API error: ${response.status} ${response.statusText}. ${errorText || 'Check server connection'}`
          );
          // 404 (model not found) is not retryable
          if (response.status === 404) {
            if (!trackingEnded) { tokenTracker.endCall(); trackingEnded = true; }
            onError?.(httpErr);
            throw httpErr;
          }
          throw httpErr;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body from Ollama. The server may not support streaming.');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        // FIX #6: Parse thinking tags with regex instead of char-by-char iteration
        const parseThinkingTags = (token: string): Array<{type: 'think'|'response', content: string}> => {
          const parts: Array<{type: 'think'|'response', content: string}> = [];
          const regex = /<think>([\s\S]*?)<\/think>/g;
          let lastIdx = 0;
          let match;

          while ((match = regex.exec(token)) !== null) {
            // Content before the think tag
            if (match.index > lastIdx) {
              const content = token.slice(lastIdx, match.index);
              if (content) parts.push({ type: 'response', content });
            }
            // The think tag content
            parts.push({ type: 'think', content: match[1] });
            lastIdx = match.index + match[0].length;
          }

          // Remaining content after last think tag
          if (lastIdx < token.length) {
            const remaining = token.slice(lastIdx);
            if (remaining) parts.push({ type: 'response', content: remaining });
          }

          return parts;
        };

        // Idle timeout: abort if no data received for 120 seconds
        // (Ollama may be busy with another request and delay the first token)
        const STREAM_IDLE_TIMEOUT_MS = 120_000;
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        let idleTimedOut = false;

        const resetIdleTimer = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            idleTimedOut = true;
            reader.cancel().catch(() => {});
          }, STREAM_IDLE_TIMEOUT_MS);
        };

        // Start the idle timer (covers initial model loading silence)
        resetIdleTimer();

        // Also listen for external abort to clean up
        const onExternalAbort = () => {
          if (idleTimer) clearTimeout(idleTimer);
          reader.cancel().catch(() => {});
        };
        signal?.addEventListener('abort', onExternalAbort, { once: true });

        try {
        while (true) {
          const { done, value } = await reader.read();

          // reader.cancel() from idle timeout or external abort resolves with done=true
          if (done) {
            if (idleTimedOut) {
              throw new Error(`No response from model — no data received for ${STREAM_IDLE_TIMEOUT_MS / 1000} seconds. Check Ollama connection and model status.`);
            }
            break;
          }

          // Data received — reset the idle timer
          resetIdleTimer();

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line);

                // Validate against schema
                try {
                  validateOllamaResponse(json);
                } catch (schemaErr) {
                  log.debug('Ollama response validation failed', { line: line.slice(0, 100) }, schemaErr);
                  // Continue processing even if validation fails — be lenient with unexpected fields
                }

                // Response tokens — /api/generate uses json.response, /api/chat uses json.message.content
                const token = useChat ? json.message?.content : json.response;
                if (token) {
                  // Parse inline <think>...</think> tags with regex (FIX #6)
                  const parts = parseThinkingTags(token as string);
                  for (const part of parts) {
                    if (part.type === 'think') {
                      onThink?.(part.content);
                      tokenTracker.tickThinking(part.content);
                    } else {
                      fullResponse += part.content;
                      onChunk?.(part.content);
                      tokenTracker.tick(part.content);
                    }
                  }
                }

                // Thinking tokens — /api/generate uses json.thinking, /api/chat uses json.message.thinking
                const thinkToken = useChat ? json.message?.thinking : json.thinking;
                if (thinkToken) {
                  tokenTracker.tickThinking(thinkToken);
                  onThink?.(thinkToken);
                }

                if (json.done) {
                  const evalCount = typeof json.eval_count === 'number' ? json.eval_count : undefined;
                  const evalDuration = typeof json.eval_duration === 'number' ? json.eval_duration : undefined;
                  tokenTracker.endCall(evalCount, evalDuration);
                  trackingEnded = true;
                }
              } catch (parseErr) {
                log.debug('Stream JSON parse error', { line: line.slice(0, 100) }, parseErr);
              }
            }
          }
        }
        } finally {
          if (idleTimer) clearTimeout(idleTimer);
          signal?.removeEventListener('abort', onExternalAbort);
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const json = JSON.parse(buffer);
            const token = useChat ? json.message?.content : json.response;
            if (token) {
              fullResponse += token;
              onChunk?.(token);
              tokenTracker.tick(token);
            }
            const thinkToken = useChat ? json.message?.thinking : json.thinking;
            if (thinkToken) {
              tokenTracker.tickThinking(thinkToken);
              onThink?.(thinkToken);
            }
            if (json.done) {
              const evalCount = typeof json.eval_count === 'number' ? json.eval_count : undefined;
              const evalDuration = typeof json.eval_duration === 'number' ? json.eval_duration : undefined;
              tokenTracker.endCall(evalCount, evalDuration);
              trackingEnded = true;
            }
          } catch (bufferErr) {
            log.debug('Buffer parse error', { buffer: buffer.slice(0, 100) }, bufferErr);
          }
        }

        if (!trackingEnded) { tokenTracker.endCall(); trackingEnded = true; }
        onComplete?.();

        // Log successful model usage
        const duration = Date.now() - startTime;
        logModelUsage({
          model: cleanModel,
          role: useChat ? 'chat' : 'generate',
          duration,
          tokens: fullResponse.length,
          success: true,
        });

        // Record success in circuit breaker
        breaker.recordSuccess();

        // Release task capacity
        loadMonitor.releaseTask(cleanModel, taskId);

        return fullResponse;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!trackingEnded) { tokenTracker.endCall(); trackingEnded = true; }
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failure in circuit breaker
        breaker.recordFailure();

        // Don't retry on user abort
        if (signal?.aborted) {
          loadMonitor.releaseTask(cleanModel, taskId);
          onError?.(lastError);
          throw lastError;
        }

        // Retry if transient and we have attempts left — exponential backoff
        if (isRetryable(error) && attempt < MAX_RETRIES) {
          const is429 = lastError.message.includes('429');
          const backoffMs = is429
            ? RETRY_BASE_DELAY_MS * Math.pow(3, attempt)  // 3s, 9s, 27s for rate limits
            : RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s for network errors
          log.warn('Retrying', { attempt, maxRetries: MAX_RETRIES, backoffMs, reason: lastError.message, isRateLimit: is429 });
          await sleep(backoffMs, signal);
          continue;
        }

        // Final attempt or non-retryable: mark unhealthy and enhance error message
        const isConnectionFailure = lastError.message.includes('Failed to fetch')
          || lastError.message.includes('econnrefused')
          || lastError.message.includes('network')
          || lastError.message.includes('Connection timeout');
        if (isConnectionFailure) {
          _ollamaHealthy = false;
          _connectionStatus = 'disconnected';
        }
        const finalError = new Error(
          lastError.message.includes('Failed to fetch')
            ? `Cannot reach Ollama at ${apiBase}. Is the server running? Check Settings > Connection.`
            : lastError.message
        );

        // Release task capacity before throwing
        loadMonitor.releaseTask(cleanModel, taskId);
        onError?.(finalError);
        throw finalError;
      }
    }

    // Should never reach here, but TypeScript needs it
    const fallbackErr = lastError ?? new Error('Ollama request failed after retries');

    // Log failed model usage
    const duration = Date.now() - startTime;
    logModelUsage({
      model: cleanModel,
      role: useChat ? 'chat' : 'generate',
      duration,
      success: false,
      error: fallbackErr.message,
    });

    // Release task capacity before throwing
    loadMonitor.releaseTask(cleanModel, taskId);
    onError?.(fallbackErr);
    throw fallbackErr;
  },

  async generate(
    prompt: string,
    systemPrompt: string,
    model: string = 'qwen3.5:9b'
  ): Promise<string> {
    return this.generateStream(prompt, systemPrompt, { model });
  },

  /**
   * Preload models into VRAM with keep_alive so they stay resident.
   * Call once at app start — fires and forgets, doesn't block.
   * Uses small num_ctx to minimize VRAM footprint during preload.
   */
  async preloadModels(models: Array<{ model: string; num_ctx?: number; keep_alive?: string }>): Promise<void> {
    const endpoint = `${getOllamaEndpoint()}/api/generate`;
    await Promise.allSettled(models.map(async (m) => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m.model,
            prompt: 'hi',
            stream: false,
            keep_alive: m.keep_alive || '30m',
            options: { num_predict: 1, num_ctx: m.num_ctx || 2048 },
          }),
          signal: AbortSignal.timeout(180_000),
        });
        if (res.ok) {
          log.info(`Preloaded ${m.model} (keep_alive=${m.keep_alive || '30m'}, ctx=${m.num_ctx || 2048})`);
        } else {
          log.warn(`Preload ${m.model} failed: ${res.status}`);
        }
      } catch (err) {
        log.warn(`Preload ${m.model} error`, {}, err);
      }
    }));
  },

  /**
   * Get currently loaded models from Ollama.
   * Returns model name, VRAM size, and expiry time.
   */
  async getLoadedModels(): Promise<Array<{ name: string; sizeVram: number; expiresAt: string }>> {
    try {
      const res = await fetch(`${DIRECT_OLLAMA}/api/ps`, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        name: String(m.name || ''),
        sizeVram: Number(m.size_vram || 0),
        expiresAt: String(m.expires_at || ''),
      }));
    } catch {
      return [];
    }
  },

  /**
   * Unload a model from VRAM by setting keep_alive to "0".
   */
  async unloadModel(model: string): Promise<void> {
    try {
      await fetch(`${DIRECT_OLLAMA}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: '', stream: false, keep_alive: '0', options: { num_predict: 0 } }),
        signal: AbortSignal.timeout(10_000),
      });
      log.info(`Unloaded ${model}`);
    } catch (err) {
      log.warn(`Unload ${model} failed`, {}, err);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Internal: probe a single endpoint
// ─────────────────────────────────────────────────────────────

async function probeEndpoint(endpoint: string): Promise<OllamaHealthResult> {
  const start = performance.now();
  try {
    const tagsResp = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    const latency = Math.round(performance.now() - start);

    if (!tagsResp.ok) {
      return { status: 'disconnected', endpoint, latencyMs: latency, error: `HTTP ${tagsResp.status}` };
    }

    let data: { models?: unknown[] };
    try {
      data = await tagsResp.json();
    } catch (jsonErr) {
      log.warn('Invalid JSON from /api/tags', { endpoint }, jsonErr);
      return { status: 'disconnected', endpoint, latencyMs: latency, error: 'Invalid JSON from /api/tags' };
    }
    const modelCount = data.models?.length ?? 0;

    // Try to get loaded models
    let loadedModels: string[] = [];
    try {
      const psResp = await fetch(`${endpoint}/api/ps`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (psResp.ok) {
        let psData: { models?: Array<{ name: string }> };
        try { psData = await psResp.json(); } catch (e) { log.debug('Failed to parse /api/ps', {}, e); psData = {}; }
        loadedModels = (psData.models || []).map((m: { name: string }) => m.name);
      }
    } catch (e) { log.debug('Failed to fetch loaded models', { endpoint }, e); }

    return { status: 'connected', endpoint, latencyMs: latency, modelCount, loadedModels };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'disconnected', endpoint, latencyMs: latency, error: msg };
  }
}
