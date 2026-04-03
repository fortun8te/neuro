/**
 * Subagent Manager — Production-quality agent infrastructure
 *
 * Features:
 *  - Retry logic with exponential back-off (configurable, default 3 attempts)
 *  - Per-subagent hard timeout (default 120 s) with clean abort
 *  - Error isolation — one subagent failure never kills the batch
 *  - Full lifecycle registry: idle → spawning → running → completed/failed/cancelled
 *  - Self-assessed confidence scoring (0–1) on every result
 *  - Rich observability callbacks: onSpawned, onProgress, onComplete
 *  - Abort signal fully threaded — external cancel propagates cleanly
 *  - No memory leaks: timers cleared in finally blocks
 */

import { ollamaService } from './ollama';
import { getModelForStage, getThinkMode, getContextSize } from './modelConfig';
import { wayfarerService } from './wayfarer';
import type { SubagentRole } from './subagentRoles';
import { getRoleConfig } from './subagentRoles';
import { recordResearchModel } from './researchAudit';
import { getEnvVariable } from '../config/envLoader';
import {
  getSubagentTools,
  buildToolDescriptions,
  parseSubagentToolCall,
  PARALLEL_SAFE_TOOLS,
} from './subagentTools';
export type { SubagentToolDef } from './subagentTools';

// ── Simple mutex for write-like tool serialization ────────────────────────
class SimpleMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    return new Promise(resolve => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const globalWriteLock = new SimpleMutex();

/** Local agent configuration — previously imported from infrastructure */
const AGENT_CONFIG = {
  subagentTimeoutMs: 120_000,
  retryAttempts: 3,
  retryDelayMs: 1000,
  maxConcurrentSubagents: 10, // Default max parallel agents (Phase 1 feature)
  resultConfidenceThreshold: 0.4,
  devLogging: getEnvVariable('VITE_DEV') === 'true' || process.env.NODE_ENV === 'development',
  poolSizeByPreset: { SQ: 1, QK: 2, NR: 3, EX: 4, MX: 5 } as Record<string, number>,
  enableQueueProgressReporting: true, // Show queue status in UI (Phase 1 feature)
};
import type {
  SubagentStatus,
  SubagentMessage,
  SubagentParentContext,
  SubagentResult,
  SubagentPoolStats,
} from '../types';

// Re-export for consumers that only import from this module
export type { SubagentStatus, SubagentMessage, SubagentParentContext, SubagentResult, SubagentPoolStats };

// ─────────────────────────────────────────────────────────────
// Request / Progress types
// ─────────────────────────────────────────────────────────────

export interface SubagentSpawnRequest {
  /** Unique ID for this instance — caller is responsible for uniqueness */
  id: string;
  role: SubagentRole;
  /** One-sentence task description visible in debug logs and UI */
  task: string;
  /** Background context injected into the system prompt */
  context: string;
  /** Optional structured parent context (brand, campaign, previous findings) */
  parentContext?: SubagentParentContext;
  /** Raw input data — search query, page content, findings to analyse, etc. */
  input?: string;
  /** Override the default model for this role */
  model?: string;
  /** Hard timeout in ms — subagent is aborted after this (default: AGENT_CONFIG.subagentTimeoutMs) */
  timeoutMs?: number;
  /** Max retry attempts on transient failure (default: AGENT_CONFIG.retryAttempts) */
  retryAttempts?: number;
  /** Base delay ms before first retry, doubles each attempt (default: AGENT_CONFIG.retryDelayMs) */
  retryDelayMs?: number;
  /** External abort signal — mirrors to internal controller */
  signal?: AbortSignal;
  /** Delay before starting (ms) — used to stagger parallel launches */
  startDelayMs?: number;
}

export interface SubagentProgress {
  subagentId: string;
  role: SubagentRole;
  status: SubagentStatus;
  /** 0–100 estimated progress (based on elapsed / estimated duration) */
  progress: number;
  elapsedMs: number;
  /** Partial output streamed so far (may be empty until model starts responding) */
  partialOutput?: string;
  /** Current retry attempt (0-based) */
  attempt?: number;
}

// Callbacks exposed to callers
export interface SubagentCallbacks {
  onSpawned?: (id: string, role: SubagentRole, task: string) => void;
  onProgress?: (progress: SubagentProgress) => void;
  onComplete?: (result: SubagentResult) => void;
}

// Queue progress for UI display (Phase 1 subagent limiting feature)
export interface SubagentQueueProgress {
  poolId: string;
  running: number;      // Currently executing
  queued: number;       // Waiting to run
  completed: number;    // Finished
  failed: number;       // Failed
  total: number;        // Total requested
  percentComplete: number; // 0-100
}

// ─────────────────────────────────────────────────────────────
// Internal registry entry
// ─────────────────────────────────────────────────────────────

interface SubagentEntry {
  request: SubagentSpawnRequest;
  status: SubagentStatus;
  controller: AbortController;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  startTime: number;
  completedTime?: number;
  result?: SubagentResult;
  attempt: number;
  partialOutput: string;
  callbacks?: SubagentCallbacks;
  externalSignalWired?: boolean; // Flag to prevent duplicate signal listener attachment
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes('abort') || m.includes('signal') || m.includes('cancel');
  }
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Sleep aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Sleep aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Derive a naive confidence score (0–1) from the output text.
 * Heuristics: length, presence of structured blocks, source citations.
 * Subagents can override by embedding [CONFIDENCE:0.85] in their output.
 */
function scoreConfidence(output: string, status: SubagentStatus): number {
  if (status !== 'completed') return 0;
  if (!output || output.length < 50) return 0.1;

  // Check for explicit self-report
  const explicit = output.match(/\[CONFIDENCE:\s*([\d.]+)\]/i);
  if (explicit) {
    const v = parseFloat(explicit[1]);
    if (!isNaN(v) && v >= 0 && v <= 1) return v;
  }

  let score = 0.5; // baseline

  // Length bonus (up to 0.2)
  const len = Math.min(output.length, 4000);
  score += (len / 4000) * 0.2;

  // Structured block bonus
  const hasBlocks = /\[(FINDINGS|ANALYSIS|SYNTHESIS|VALIDATION|STRATEGY|COMPRESSED|EVALUATION)\]/i.test(output);
  if (hasBlocks) score += 0.1;

  // Source citation bonus
  const sourceMentions = (output.match(/\[Source:/gi) || []).length;
  score += Math.min(sourceMentions * 0.02, 0.1);

  // Gap acknowledgement shows self-awareness — slight bonus
  if (/gaps:/i.test(output)) score += 0.05;

  return Math.min(1, Math.max(0, score));
}

function devLog(msg: string, ...args: unknown[]): void {
  if (AGENT_CONFIG.devLogging) {
    console.log(`[SubagentManager] ${msg}`, ...args);
  }
}

// ─────────────────────────────────────────────────────────────
// Subagent Tool System — mini ReAct loop for tool-using subagents
// Tool definitions are in subagentTools.ts (imported above).
// ─────────────────────────────────────────────────────────────

// Increased from 5 → 15 to allow subagents to complete complex research
// without hitting the hard step limit mid-task (Phase 1 performance fix)
const MAX_SUBAGENT_TOOL_STEPS = 15;

// ─────────────────────────────────────────────────────────────
// SubagentManager — core class
// ─────────────────────────────────────────────────────────────

export class SubagentManager {
  private registry = new Map<string, SubagentEntry>();
  /** role → count of currently-running instances */
  private roleActiveCounts = new Map<SubagentRole, number>();
  /** Async mutex to protect roleActiveCounts from interleaved mutations */
  private _roleLock = Promise.resolve();

  private _withRoleLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const p = this._roleLock.then(fn);
    this._roleLock = p.then(() => {}, () => {});
    return p;
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Spawn a subagent and await its result.
   * - Retries up to `retryAttempts` times on transient error
   * - Enforces `timeoutMs` hard limit (aborts the LLM call)
   * - Never throws — always resolves to a SubagentResult
   */
  async spawn(
    request: SubagentSpawnRequest,
    callbacks?: SubagentCallbacks,
  ): Promise<SubagentResult> {
    // Guard: if external signal already aborted, return immediately
    if (request.signal?.aborted) {
      return this._buildCancelledResult(request, 0);
    }

    const entry: SubagentEntry = {
      request,
      status: 'spawning',
      controller: new AbortController(),
      timeoutHandle: null,
      startTime: Date.now(),
      attempt: 0,
      partialOutput: '',
      callbacks,
    };

    this.registry.set(request.id, entry);

    // Mirror external abort → internal controller (only once)
    if (request.signal && !entry.externalSignalWired) {
      request.signal.addEventListener('abort', () => {
        this._cancelEntry(entry);
      }, { once: true });
      entry.externalSignalWired = true;
    }

    devLog(`spawning ${request.id} [${request.role}] "${request.task}"`);
    callbacks?.onSpawned?.(request.id, request.role, request.task);

    const result = await this._runWithRetry(entry);

    entry.result = result;
    entry.completedTime = Date.now();
    entry.status = result.status;

    devLog(
      `${result.status} ${request.id} [${request.role}] in ${result.durationMs}ms ` +
      `confidence=${result.confidence.toFixed(2)} tokens=${result.tokensUsed}`,
    );

    callbacks?.onComplete?.(result);
    return result;
  }

  /** Abort a specific subagent by ID */
  abortSubagent(subagentId: string): void {
    const entry = this.registry.get(subagentId);
    if (entry) this._cancelEntry(entry);
  }

  /** Abort all registered subagents */
  abortAll(): void {
    for (const entry of this.registry.values()) {
      this._cancelEntry(entry);
    }
  }

  /** Live status snapshot for a single subagent */
  getStatus(subagentId: string): SubagentProgress | null {
    const entry = this.registry.get(subagentId);
    if (!entry) return null;
    return this._buildProgress(entry);
  }

  /** Live status for all registered subagents */
  getAllStatuses(): SubagentProgress[] {
    return Array.from(this.registry.values()).map(e => this._buildProgress(e));
  }

  /** Count of currently-running (not completed/failed/cancelled) subagents */
  getActiveCount(): number {
    let n = 0;
    for (const e of this.registry.values()) {
      if (e.status === 'running' || e.status === 'spawning') n++;
    }
    return n;
  }

  getActiveCountForRole(role: SubagentRole): number {
    return this.roleActiveCounts.get(role) || 0;
  }

  /** Clear completed/failed/cancelled entries from the registry */
  cleanup(): void {
    for (const [id, entry] of this.registry.entries()) {
      if (
        entry.status === 'completed' ||
        entry.status === 'failed' ||
        entry.status === 'cancelled'
      ) {
        this.registry.delete(id);
      }
    }
  }

  // ── Internal execution ──────────────────────────────────────

  private async _runWithRetry(entry: SubagentEntry): Promise<SubagentResult> {
    const maxAttempts = entry.request.retryAttempts ?? AGENT_CONFIG.retryAttempts;
    const baseDelay = entry.request.retryDelayMs ?? AGENT_CONFIG.retryDelayMs;

    let lastError: string = '';

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      // FIX: Check both internal and external abort signals between attempts
      // External signal may have been aborted while awaiting retry delay
      if (entry.controller.signal.aborted || entry.request.signal?.aborted) {
        return this._buildCancelledResult(entry.request, Date.now() - entry.startTime);
      }

      entry.attempt = attempt;

      if (attempt > 0) {
        // Exponential back-off: 1s → 2s → 4s
        const delay = baseDelay * Math.pow(2, attempt - 1);
        devLog(`retry ${attempt}/${maxAttempts} for ${entry.request.id} after ${delay}ms`);
        try {
          await sleep(delay, entry.controller.signal);
        } catch {
          return this._buildCancelledResult(entry.request, Date.now() - entry.startTime);
        }
      }

      entry.status = 'running';
      entry.partialOutput = '';

      // Increment role concurrency counter (guarded against async interleaving)
      await this._withRoleLock(() => {
        const rolePrev = this.roleActiveCounts.get(entry.request.role) || 0;
        this.roleActiveCounts.set(entry.request.role, rolePrev + 1);
      });

      // Set per-attempt timeout — deep roles (nemotron) get 4 min, others default 2 min
      const roleConf = getRoleConfig(entry.request.role);
      const defaultTimeout = roleConf.modelOverride
        ? Math.max(AGENT_CONFIG.subagentTimeoutMs, roleConf.estimatedDurationMs * 2)
        : AGENT_CONFIG.subagentTimeoutMs;
      const timeoutMs = entry.request.timeoutMs ?? defaultTimeout;
      let timedOut = false;
      entry.timeoutHandle = setTimeout(() => {
        timedOut = true;
        entry.controller.abort();
      }, timeoutMs);

      try {
        const result = await this._executeOnce(entry);

        if (result.status === 'cancelled') {
          return result; // Never retry an abort
        }

        // Success path
        entry.status = 'completed';
        return { ...result, retryCount: attempt };
      } catch (err) {
        if (isAbortError(err)) {
          if (timedOut) {
            // Timeout — treat as a retriable failure but record it
            lastError = `Timeout after ${timeoutMs}ms`;
            devLog(`timeout on ${entry.request.id} attempt ${attempt}`);
            // Reset controller for next attempt (create fresh one)
            // Note: external signal listener already attached in spawn(), no need to re-attach
            entry.controller = new AbortController();
          } else {
            // External cancel — do not retry
            return this._buildCancelledResult(entry.request, Date.now() - entry.startTime);
          }
        } else {
          lastError = err instanceof Error ? err.message : String(err);
          devLog(`error on ${entry.request.id} attempt ${attempt}: ${lastError}`);
        }
      } finally {
        // Always clear timeout handle and decrement role counter
        if (entry.timeoutHandle !== null) {
          clearTimeout(entry.timeoutHandle);
          entry.timeoutHandle = null;
        }
        // Decrement guarded against async interleaving
        await this._withRoleLock(() => {
          const roleNow = this.roleActiveCounts.get(entry.request.role) || 0;
          this.roleActiveCounts.set(entry.request.role, Math.max(0, roleNow - 1));
        });
      }
    }

    // All attempts exhausted
    entry.status = 'failed';
    const durationMs = Date.now() - entry.startTime;
    return {
      subagentId: entry.request.id,
      role: entry.request.role,
      task: entry.request.task,
      status: 'failed',
      output: entry.partialOutput || '',
      confidence: 0,
      tokensUsed: 0,
      durationMs,
      startedAt: entry.startTime,
      completedAt: Date.now(),
      error: `Failed after ${maxAttempts + 1} attempts. Last error: ${lastError}`,
      retryCount: maxAttempts,
    };
  }

  private async _executeOnce(entry: SubagentEntry): Promise<SubagentResult> {
    const { request } = entry;
    const roleConfig = getRoleConfig(request.role);
    // Model selection: deep roles use nemotron via modelOverride, others use fast tier
    const model = request.model || roleConfig.modelOverride || getModelForStage('fast');
    const useThinking = roleConfig.thinkContext ? getThinkMode(roleConfig.thinkContext as any) : false;
    const startTime = Date.now();

    // Notify progress callbacks on each attempt
    const reportProgress = () => {
      entry.callbacks?.onProgress?.(this._buildProgress(entry));
    };

    // Concurrency guard — respect role's maxConcurrent limit
    const roleActive = this.roleActiveCounts.get(request.role) || 0;
    if (roleActive > roleConfig.maxConcurrent) {
      // This attempt hits the ceiling — treat as a soft error so it can retry
      // after another subagent of this role finishes
      throw new Error(
        `Concurrency ceiling: ${roleActive}/${roleConfig.maxConcurrent} for role '${request.role}'`,
      );
    }

    // Record which model is being used
    recordResearchModel(model);

    // Stagger start if requested (prevents all agents hammering Ollama at once)
    if (request.startDelayMs && request.startDelayMs > 0) {
      await sleep(request.startDelayMs, entry.controller.signal);
      if (entry.controller.signal.aborted) return this._buildCancelledResult(request, Date.now() - startTime);
    }

    // Build context block
    let contextBlock = request.context;
    if (request.parentContext) {
      const pc = request.parentContext;
      contextBlock += `\n\nParent Context:\n- Brand: ${pc.brand}\n- Product: ${pc.productDescription}\n- Audience: ${pc.targetAudience}\n- Goal: ${pc.marketingGoal}${pc.previousFindings ? `\n- Prior findings: ${pc.previousFindings.slice(0, 400)}` : ''}${pc.userDirection ? `\n- Direction: ${pc.userDirection}` : ''}`;
    }

    let finalOutput = '';
    let totalTokensUsed = 0;

    reportProgress();

    // ── Phase 1: Run web search directly (no LLM tool-call parsing needed) ──
    // Only search if: researcher/validator role AND task looks like a real research query.
    // Avoid searching for trivial tasks like "say hi" or "summarize this text".
    const isResearchRole = ['researcher', 'validator'].includes(request.role);
    const looksLikeResearch = request.task.length > 15 && /\b(research|find|search|look up|what is|who is|how does|compare|analyze|news|price|review|latest|current|trend|report|data|stat|info|about|tips|best|guide|top|ways|how|why|when|strategies|techniques|practices|methods|tools|tips|performance|optimize|improve|benchmark|feature|overview|tutorial)\b/i.test(request.task);
    const needsSearch = isResearchRole && looksLikeResearch;
    let searchContext = request.input || '';

    if (needsSearch && request.task) {
      if (entry.controller.signal.aborted) return this._buildCancelledResult(request, Date.now() - startTime);

      entry.partialOutput = '[searching...]\n';
      reportProgress();

      try {
        const searchResult = await wayfarerService.research(request.task, 5, entry.controller.signal);
        if (searchResult.sources.length > 0 || searchResult.text) {
          const sourceList = searchResult.sources.slice(0, 5)
            .map((s, i) => `${i + 1}. ${s.title} — ${s.url}\n   ${s.snippet}`)
            .join('\n');
          searchContext = `Search results for "${request.task}":\n\nSources:\n${sourceList}\n\nContent:\n${searchResult.text.slice(0, 3000)}`;
          entry.partialOutput = `[found ${searchResult.sources.length} sources]\n`;
          reportProgress();
        }
      } catch (err) {
        if (isAbortError(err)) return this._buildCancelledResult(request, Date.now() - startTime);
        // Search failed — still try to synthesize from task alone
        searchContext = `Note: web search failed (${err instanceof Error ? err.message : err}). Respond based on general knowledge.`;
      }
    }

    // ── Phase 1.5: Tool-using ReAct loop (roles that may use tools) ──
    // Roles that need web tools run a multi-step loop; others skip straight to synthesis.
    const tools = getSubagentTools();
    const toolMap = new Map(tools.map(t => [t.name, t]));
    const isToolRole = ['researcher', 'validator', 'analyst'].includes(request.role);

    if (isToolRole && !searchContext.includes('Search results')) {
      // Run up to MAX_SUBAGENT_TOOL_STEPS tool calls before final synthesis
      const toolHistory: string[] = [];
      for (let step = 0; step < MAX_SUBAGENT_TOOL_STEPS; step++) {
        if (entry.controller.signal.aborted) return this._buildCancelledResult(request, Date.now() - startTime);

        const toolSystemPrompt = `${buildToolDescriptions(tools)}\n\nContext:\n${contextBlock}`;
        const toolUserPrompt = [
          `Task: ${request.task}`,
          searchContext ? `\nInitial context:\n${searchContext}` : '',
          toolHistory.length ? `\nPrevious steps:\n${toolHistory.join('\n')}` : '',
          '\nDecide: call a tool or give your final answer.',
        ].join('');

        let toolResponse = '';
        try {
          toolResponse = await ollamaService.generateStream(
            toolUserPrompt,
            toolSystemPrompt,
            {
              model,
              temperature: 0.1,
              num_predict: 400,
              num_ctx: getContextSize('subagent'),
              signal: entry.controller.signal,
            },
          );
        } catch (err) {
          if (isAbortError(err)) return this._buildCancelledResult(request, Date.now() - startTime);
          break; // tool decision failed — fall through to synthesis
        }

        const toolCall = parseSubagentToolCall(toolResponse);
        if (!toolCall) break; // no tool call — LLM gave final answer, exit loop

        const tool = toolMap.get(toolCall.name);
        if (!tool) {
          toolHistory.push(`Step ${step + 1}: Unknown tool "${toolCall.name}"`);
          break;
        }

        // Parallel-safety: if tool is write-like, serialize via globalWriteLock
        let toolResult: string;
        if (PARALLEL_SAFE_TOOLS.has(toolCall.name)) {
          toolResult = await tool.execute(toolCall.args, entry.controller.signal);
        } else {
          toolResult = await globalWriteLock.runExclusive(() =>
            tool.execute(toolCall.args, entry.controller.signal),
          );
        }

        toolHistory.push(`Step ${step + 1} — ${toolCall.name}:\n${toolResult.slice(0, 1000)}`);
        entry.partialOutput += `[tool:${toolCall.name}] `;
        reportProgress();
      }

      if (toolHistory.length > 0) {
        searchContext = toolHistory.join('\n---\n');
      }
    }

    // ── Phase 2: LLM synthesis — just summarize, no tool calls needed ──
    if (entry.controller.signal.aborted) return this._buildCancelledResult(request, Date.now() - startTime);

    const systemPrompt = `You are a focused research subagent. Your job is to synthesize information and produce a clear, structured answer.

${contextBlock}

Be concise. Use bullet points. Cite sources with their URLs when available. At the end include [CONFIDENCE:0.XX].`;

    let inputSection = `Task: ${request.task}`;
    if (searchContext) inputSection += `\n\n${searchContext}`;
    if (request.input && !searchContext.includes(request.input)) inputSection += `\n\nAdditional input:\n${request.input}`;

    const userPrompt = `${inputSection}\n\nSynthesize the above into a clear answer. Be direct and factual.`;

    entry.partialOutput += '[synthesizing...]\n';
    reportProgress();

    finalOutput = await ollamaService.generateStream(
      userPrompt,
      systemPrompt,
      {
        model,
        temperature: roleConfig.temperature,
        // Deep roles (nemotron) get full token budget; fast roles capped at 800
        num_predict: useThinking ? roleConfig.maxTokens : Math.min(roleConfig.maxTokens, 800),
        num_ctx: getContextSize('subagent'),
        think: useThinking,
        signal: entry.controller.signal,
        onChunk: (chunk: string) => {
          entry.partialOutput += chunk;
          reportProgress();
        },
      },
    );

    if (entry.controller.signal.aborted) return this._buildCancelledResult(request, Date.now() - startTime);
    totalTokensUsed = Math.round(finalOutput.split(/\s+/).length * 1.3);

    const durationMs = Date.now() - startTime;
    const confidence = scoreConfidence(finalOutput, 'completed');

    devLog(`${request.id} completed in ${durationMs}ms, ~${totalTokensUsed} tokens`);

    return {
      subagentId: request.id,
      role: request.role,
      task: request.task,
      status: 'completed',
      output: finalOutput,
      confidence,
      tokensUsed: totalTokensUsed,
      durationMs,
      startedAt: startTime,
      completedAt: Date.now(),
    };
  }

  // ── Private helpers ─────────────────────────────────────────

  private _cancelEntry(entry: SubagentEntry): void {
    if (entry.status === 'completed' || entry.status === 'failed' || entry.status === 'cancelled') {
      return;
    }
    entry.status = 'cancelled';
    if (entry.timeoutHandle !== null) {
      clearTimeout(entry.timeoutHandle);
      entry.timeoutHandle = null;
    }
    entry.controller.abort();
  }

  private _buildProgress(entry: SubagentEntry): SubagentProgress {
    const elapsedMs = Date.now() - entry.startTime;
    const estimatedDuration = getRoleConfig(entry.request.role).estimatedDurationMs;
    const progress = Math.min(100, Math.round((elapsedMs / estimatedDuration) * 100));
    return {
      subagentId: entry.request.id,
      role: entry.request.role,
      status: entry.status,
      progress,
      elapsedMs,
      partialOutput: entry.partialOutput || undefined,
      attempt: entry.attempt,
    };
  }

  private _buildCancelledResult(
    request: SubagentSpawnRequest,
    durationMs: number,
  ): SubagentResult {
    return {
      subagentId: request.id,
      role: request.role,
      task: request.task,
      status: 'cancelled',
      output: '',
      confidence: 0,
      tokensUsed: 0,
      durationMs,
      startedAt: Date.now() - durationMs,
      completedAt: Date.now(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// SubagentPool — manages a bounded queue of subagents
// ─────────────────────────────────────────────────────────────

interface PoolQueueItem {
  request: SubagentSpawnRequest;
  callbacks?: SubagentCallbacks;
  resolve: (result: SubagentResult) => void;
}

/**
 * SubagentPool manages a bounded number of concurrent subagents.
 * Queues excess requests and drains them as slots open.
 * Tracks aggregate token usage and emits pool-level stats.
 *
 * Phase 1 Features (Parallelization Limits):
 * - Configurable MAX_PARALLEL_SUBAGENTS (default 10)
 * - Queue progress reporting to UI
 * - Real-time status: "Running 8/30, Queued 12, Completed 10"
 */
export class SubagentPool {
  private id: string;
  private maxConcurrent: number;
  private manager: SubagentManager;
  private queue: PoolQueueItem[] = [];
  private active = 0;
  private completedCount = 0;
  private failedCount = 0;
  private cancelledCount = 0;
  private totalRequested = 0; // Track total agents submitted (Phase 1)
  private totalTokensUsed = 0;
  private confidenceSum = 0;
  private activeEntryTimes: Map<string, number> = new Map();
  private onStats?: (stats: SubagentPoolStats) => void;
  private onQueueProgress?: (progress: SubagentQueueProgress) => void; // Phase 1 callback
  private isDraining = false; // FIX: Prevent concurrent drain() calls causing race condition

  /**
   * Async mutex protecting pool stats (active, completedCount, failedCount, etc.)
   * from interleaved mutations when multiple subagents complete between microtasks.
   */
  private _stateLock = Promise.resolve();

  private _withStateLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const p = this._stateLock.then(fn);
    this._stateLock = p.then(() => {}, () => {});
    return p;
  }

  constructor(opts: {
    id?: string;
    maxConcurrent?: number;
    onStats?: (stats: SubagentPoolStats) => void;
    onQueueProgress?: (progress: SubagentQueueProgress) => void; // Phase 1 queue UI updates
  } = {}) {
    this.id = opts.id ?? `pool-${Date.now()}`;
    this.maxConcurrent = opts.maxConcurrent ?? AGENT_CONFIG.maxConcurrentSubagents;
    this.manager = new SubagentManager();
    this.onStats = opts.onStats;
    this.onQueueProgress = opts.onQueueProgress; // Phase 1
  }

  /**
   * Submit a subagent to the pool.
   * If the pool is at capacity, the request is queued and will run when a slot opens.
   * Always resolves — never rejects.
   *
   * Phase 1: Emits queue progress for UI visibility
   */
  submit(request: SubagentSpawnRequest, callbacks?: SubagentCallbacks): Promise<SubagentResult> {
    return new Promise<SubagentResult>((resolve) => {
      const item: PoolQueueItem = { request, callbacks, resolve };

      // Guard all reads/writes of active + totalRequested behind the state lock
      // so concurrent submit() calls don't over-dispatch past maxConcurrent.
      this._withStateLock(() => {
        this.totalRequested++; // Phase 1: track total

        if (this.active < this.maxConcurrent) {
          this._dispatch(item);
        } else {
          this.queue.push(item);
          devLog(`pool ${this.id}: queued ${request.id} (queue depth: ${this.queue.length})`);
        }

        // Phase 1: Emit queue progress for UI
        this._emitQueueProgress();
      });
    });
  }

  /**
   * Submit multiple requests and wait for all to complete.
   * Results are returned in the same order as the input requests.
   */
  async submitAll(
    requests: SubagentSpawnRequest[],
    callbacks?: SubagentCallbacks,
  ): Promise<SubagentResult[]> {
    const promises = requests.map(r => this.submit(r, callbacks));
    return Promise.all(promises);
  }

  /** Abort all queued and running subagents */
  abortAll(): void {
    this.queue = []; // drain queue — pending items will never run
    this.manager.abortAll();
  }

  /** Resize the pool's concurrency limit at runtime */
  resize(newMax: number): void {
    this.maxConcurrent = Math.max(1, newMax);
    // Drain queue into newly available slots
    this._drain();
  }

  /** Current pool stats snapshot (consistent read via state lock) */
  getStats(): SubagentPoolStats {
    // Synchronous read is safe when called from within _withStateLock.
    // For external callers, build the snapshot from current values --
    // individual field reads are atomic in JS, and the lock serializes writers.
    const activeCount = this.active;
    let oldestActiveMs = 0;
    const now = Date.now();
    for (const startTime of this.activeEntryTimes.values()) {
      const elapsed = now - startTime;
      if (elapsed > oldestActiveMs) oldestActiveMs = elapsed;
    }
    const totalCompleted = this.completedCount;
    const averageConfidence =
      totalCompleted > 0 ? this.confidenceSum / totalCompleted : 0;

    return {
      poolId: this.id,
      active: activeCount,
      queued: this.queue.length,
      completed: this.completedCount,
      failed: this.failedCount,
      cancelled: this.cancelledCount,
      totalTokensUsed: this.totalTokensUsed,
      oldestActiveMs,
      averageConfidence,
    };
  }

  private _dispatch(item: PoolQueueItem): void {
    // Increment active count synchronously within the state lock chain
    // to stay consistent with _onSubagentComplete's decrement.
    this._withStateLock(() => {
      this.active++;
      this.activeEntryTimes.set(item.request.id, Date.now());
      this._emitStats();
    });

    const wrappedCallbacks: SubagentCallbacks = {
      onSpawned: item.callbacks?.onSpawned,
      onProgress: item.callbacks?.onProgress,
      onComplete: (result) => {
        item.callbacks?.onComplete?.(result);
        this._onSubagentComplete(result);
        item.resolve(result);
      },
    };

    // Fire and forget — result flows through callbacks
    this.manager.spawn(item.request, wrappedCallbacks).catch((err) => {
      // manager.spawn never throws, but be defensive
      devLog(`pool ${this.id}: unexpected throw from manager.spawn: ${err}`);
    });
  }

  private _onSubagentComplete(result: SubagentResult): void {
    // All stat mutations go through the state lock to prevent async interleaving
    // when multiple subagents complete in the same microtask batch.
    this._withStateLock(() => {
      this.active = Math.max(0, this.active - 1);
      this.activeEntryTimes.delete(result.subagentId);
      this.totalTokensUsed += result.tokensUsed;

      switch (result.status) {
        case 'completed':
          this.completedCount++;
          this.confidenceSum += result.confidence;
          break;
        case 'failed':
          this.failedCount++;
          break;
        case 'cancelled':
          this.cancelledCount++;
          break;
      }

      this._emitStats();
      this._emitQueueProgress(); // Phase 1: update queue status
      this._drain();
    });
  }

  private _drain(): void {
    // FIX: Guard against concurrent drain() calls that can race and cause double-dispatch
    // This can happen when multiple _onSubagentComplete callbacks fire in quick succession
    if (this.isDraining) return;

    this.isDraining = true;
    try {
      while (this.active < this.maxConcurrent && this.queue.length > 0) {
        const next = this.queue.shift()!;
        this._dispatch(next);
      }
    } finally {
      this.isDraining = false;
    }
  }

  private _emitStats(): void {
    this.onStats?.(this.getStats());
  }

  /** Phase 1: Emit queue progress for UI display */
  private _emitQueueProgress(): void {
    if (!AGENT_CONFIG.enableQueueProgressReporting || !this.onQueueProgress) return;

    const progress: SubagentQueueProgress = {
      poolId: this.id,
      running: this.active,
      queued: this.queue.length,
      completed: this.completedCount,
      failed: this.failedCount,
      total: this.totalRequested,
      percentComplete: this.totalRequested > 0
        ? Math.round((this.completedCount / this.totalRequested) * 100)
        : 0,
    };

    this.onQueueProgress(progress);
  }
}

// ─────────────────────────────────────────────────────────────
// Result aggregation
// ─────────────────────────────────────────────────────────────

/**
 * Aggregate results from a batch of subagents into a single coherent block.
 *
 * - Filters out low-confidence results (below threshold) — flags them separately
 * - Deduplicates by URL citations and near-identical opening sentences
 * - Sorts by confidence descending
 * - Returns a merged text block + metadata
 */
export interface AggregatedResult {
  mergedOutput: string;
  totalSources: number;
  averageConfidence: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  failedCount: number;
  lowConfidenceWarnings: string[];
}

export function aggregateResults(
  results: SubagentResult[],
  confidenceThreshold = AGENT_CONFIG.resultConfidenceThreshold,
): AggregatedResult {
  const high: SubagentResult[] = [];
  const low: SubagentResult[] = [];
  const failed: SubagentResult[] = [];

  for (const r of results) {
    if (r.status === 'failed' || r.status === 'cancelled') {
      failed.push(r);
    } else if (r.confidence >= confidenceThreshold) {
      high.push(r);
    } else {
      low.push(r);
    }
  }

  // Sort high-confidence results by confidence descending
  high.sort((a, b) => b.confidence - a.confidence);

  // Deduplicate: remove results whose first 120 chars match a prior result's
  const seen = new Set<string>();
  const deduped: SubagentResult[] = [];
  for (const r of high) {
    const fingerprint = r.output.slice(0, 120).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      deduped.push(r);
    }
  }

  // Also deduplicate cited URLs across outputs
  const seenUrls = new Set<string>();
  const urlPattern = /https?:\/\/[^\s\])\n]+/g;
  for (const r of deduped) {
    const urls = r.output.match(urlPattern) || [];
    urls.forEach(u => seenUrls.add(u));
  }

  // Build merged text
  const sections = deduped.map((r, i) => {
    const roleLabel = r.role.charAt(0).toUpperCase() + r.role.slice(1);
    return `=== ${roleLabel} Result ${i + 1} (confidence: ${r.confidence.toFixed(2)}) ===\n${r.output.trim()}`;
  });

  if (low.length > 0) {
    sections.push(
      `=== Low-Confidence Findings (below ${confidenceThreshold}) ===\n` +
      low.map(r => `[${r.role}] ${r.output.slice(0, 300).trim()}`).join('\n---\n'),
    );
  }

  const mergedOutput = sections.join('\n\n');

  const totalConfidence = deduped.reduce((s, r) => s + r.confidence, 0);
  const averageConfidence = deduped.length > 0 ? totalConfidence / deduped.length : 0;

  const lowConfidenceWarnings = low.map(
    r => `[${r.role}] task="${r.task}" confidence=${r.confidence.toFixed(2)}`,
  );

  return {
    mergedOutput,
    totalSources: seenUrls.size,
    averageConfidence,
    highConfidenceCount: deduped.length,
    lowConfidenceCount: low.length,
    failedCount: failed.length,
    lowConfidenceWarnings,
  };
}

// ─────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────

/** Create a standalone SubagentManager (one per research cycle is typical) */
export function createSubagentManager(): SubagentManager {
  return new SubagentManager();
}

/**
 * Create a SubagentPool sized for the given research preset.
 * Preset → concurrency: SQ=1, QK=2, NR=3, EX=4, MX=5
 */
export function createSubagentPool(
  preset: string,
  onStats?: (stats: SubagentPoolStats) => void,
): SubagentPool {
  const concurrency =
    AGENT_CONFIG.poolSizeByPreset[preset] ?? AGENT_CONFIG.maxConcurrentSubagents;
  return new SubagentPool({ id: `pool-${preset}-${Date.now()}`, maxConcurrent: concurrency, onStats });
}

// ─────────────────────────────────────────────────────────────
// Global singleton manager (optional convenience)
// ─────────────────────────────────────────────────────────────

let globalManager: SubagentManager | null = null;

export function getGlobalSubagentManager(): SubagentManager {
  if (!globalManager) {
    globalManager = new SubagentManager();
  }
  return globalManager;
}

export function resetGlobalSubagentManager(): void {
  if (globalManager) {
    globalManager.abortAll();
  }
  globalManager = null;
}
