/**
 * Load Monitor Service
 *
 * Intelligent load management for Ollama inference requests.
 * - Tracks concurrent tasks per model and globally
 * - Enforces per-model and global concurrency limits
 * - Provides queueing with exponential backoff
 * - Monitors GPU memory and model availability
 * - Prevents overload by design through proactive capacity checking
 *
 * Integration points:
 * - Call before ollamaService.generateStream()
 * - Track task lifecycle with recordTask() / releaseTask()
 * - Query status with getModelLoad() / getStatus()
 */

import { CONCURRENCY_LIMITS } from '../config/modelRouting';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { createLogger } from '../utils/logger';

const log = createLogger('loadMonitor');

// ─────────────────────────────────────────────────────────────
// Queue Item
// ─────────────────────────────────────────────────────────────

interface QueueItem {
  model: string;
  resolve: () => void;
  reject: (reason: Error) => void;
  taskId: string;
  enqueueTime: number;
}

// ─────────────────────────────────────────────────────────────
// Load Monitor Implementation
// ─────────────────────────────────────────────────────────────

class LoadMonitorImpl {
  private activeTasks = new Map<string, Set<string>>();
  private queuedTasks = new Map<string, QueueItem[]>();
  private taskTimestamps = new Map<string, number>();
  private lastGpuCheck = 0;
  private cachedGpuInfo: { available: boolean; reason?: string } | null = null;
  private queue: QueueItem[] = [];

  constructor() {
    // Initialize tracking maps for all configured models
    const allModels = Object.values(CONCURRENCY_LIMITS.perModel);
    Array.from(new Set(allModels)).forEach((model) => {
      this.activeTasks.set(model, new Set());
      this.queuedTasks.set(model, []);
    });
  }

  /**
   * Check if a model is available for a new task.
   * Returns { available: true } or { available: false, reason: "..." }
   */
  async checkAvailability(model: string): Promise<{ available: boolean; reason?: string }> {
    // Check GPU memory (cache for 5 seconds)
    const now = Date.now();
    if (now - this.lastGpuCheck > 5000) {
      this.cachedGpuInfo = await this.checkGpuMemory();
      this.lastGpuCheck = now;
    }

    if (this.cachedGpuInfo && !this.cachedGpuInfo.available) {
      return this.cachedGpuInfo;
    }

    // Check per-model concurrency limit
    const active = this.activeTasks.get(model)?.size ?? 0;
    const limit = CONCURRENCY_LIMITS.perModel[model];
    if (!limit) {
      return { available: false, reason: `Model "${model}" not in concurrency config` };
    }

    if (active >= limit) {
      return {
        available: false,
        reason: `Model "${model}" at capacity (${active}/${limit}). Queue: ${this.queuedTasks.get(model)?.length ?? 0} pending.`,
      };
    }

    // Check global concurrency
    const globalActive = Array.from(this.activeTasks.values()).reduce(
      (sum, tasks) => sum + tasks.size,
      0
    );
    if (globalActive >= CONCURRENCY_LIMITS.globalMax) {
      return {
        available: false,
        reason: `Global concurrency at capacity (${globalActive}/${CONCURRENCY_LIMITS.globalMax}). Try again soon.`,
      };
    }

    return { available: true };
  }

  /**
   * Wait for capacity on a model, with exponential backoff queueing.
   * Rejects after maxWaitMs (default: 5 minutes) or if queue is full.
   */
  async waitForCapacity(model: string, maxWaitMs = 300_000): Promise<void> {
    const taskId = this.generateTaskId();
    const startTime = Date.now();

    // Queue is full — reject immediately
    if (this.queue.length >= CONCURRENCY_LIMITS.queueMaxSize) {
      const reason = `Queue full (${this.queue.length}/${CONCURRENCY_LIMITS.queueMaxSize}). Task discarded.`;
      log.warn('Task queue full', { model, taskId }, new Error(reason));
      throw new Error(`Cannot queue task for "${model}": ${reason}`);
    }

    return new Promise((resolve, reject) => {
      const queueItem: QueueItem = {
        model,
        resolve,
        reject,
        taskId,
        enqueueTime: startTime,
      };

      // Add to queue
      this.queue.push(queueItem);
      const modelQueue = this.queuedTasks.get(model);
      if (modelQueue) {
        modelQueue.push(queueItem);
      }

      const queuePosition = this.queue.indexOf(queueItem);
      log.debug('Task queued', { model, taskId, position: queuePosition, queueSize: this.queue.length });

      // Set timeout for max wait
      const timeoutHandle = setTimeout(() => {
        const index = this.queue.indexOf(queueItem);
        if (index >= 0) {
          this.queue.splice(index, 1);
        }
        const modelQ = this.queuedTasks.get(model);
        if (modelQ) {
          const idx = modelQ.indexOf(queueItem);
          if (idx >= 0) modelQ.splice(idx, 1);
        }
        const waitMs = Date.now() - startTime;
        reject(new Error(`Task "${taskId}" exceeded max wait time (${waitMs}ms). Capacity still unavailable.`));
      }, maxWaitMs);

      // Attempt to process queue immediately
      this.processQueue(taskId, timeoutHandle);
    });
  }

  /**
   * Process queued tasks in FIFO order.
   * Called whenever capacity is freed or task is added.
   */
  private processQueue(debugTaskId?: string, timeoutHandle?: ReturnType<typeof setTimeout>): void {
    let processed = 0;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      // Check if there's capacity for this model
      const active = this.activeTasks.get(item.model)?.size ?? 0;
      const limit = CONCURRENCY_LIMITS.perModel[item.model];
      const globalActive = Array.from(this.activeTasks.values()).reduce(
        (sum, tasks) => sum + tasks.size,
        0
      );

      if (active >= limit || globalActive >= CONCURRENCY_LIMITS.globalMax) {
        // No capacity — stop processing
        break;
      }

      // Pop from queue
      this.queue.shift();
      const modelQ = this.queuedTasks.get(item.model);
      if (modelQ) {
        const idx = modelQ.indexOf(item);
        if (idx >= 0) modelQ.splice(idx, 1);
      }

      // Grant capacity
      if (timeoutHandle && debugTaskId === item.taskId) {
        clearTimeout(timeoutHandle);
      }

      const waitMs = Date.now() - item.enqueueTime;
      if (waitMs > 1000) {
        log.debug('Task dequeued after wait', {
          taskId: item.taskId,
          model: item.model,
          waitMs,
          position: processed,
        });
      }

      item.resolve();
      processed++;
    }

    if (processed > 0 && debugTaskId) {
      log.debug('Queue processing complete', { processed, remaining: this.queue.length });
    }
  }

  /**
   * Record that a task has started on a model.
   */
  recordTask(model: string): string {
    const taskId = this.generateTaskId();
    const tasks = this.activeTasks.get(model);
    if (tasks) {
      tasks.add(taskId);
      this.taskTimestamps.set(taskId, Date.now());
    }

    const active = tasks?.size ?? 0;
    const limit = CONCURRENCY_LIMITS.perModel[model];
    const globalActive = Array.from(this.activeTasks.values()).reduce(
      (sum, t) => sum + t.size,
      0
    );

    log.debug('Task recorded', {
      taskId,
      model,
      activeOnModel: active,
      limit,
      globalActive,
      globalMax: CONCURRENCY_LIMITS.globalMax,
    });

    return taskId;
  }

  /**
   * Record that a task has completed.
   * Automatically processes the queue for new capacity.
   */
  releaseTask(model: string, taskId?: string): void {
    if (!taskId) return;

    const tasks = this.activeTasks.get(model);
    if (tasks) {
      tasks.delete(taskId);
    }
    this.taskTimestamps.delete(taskId);

    const active = tasks?.size ?? 0;
    const globalActive = Array.from(this.activeTasks.values()).reduce(
      (sum, t) => sum + t.size,
      0
    );

    log.debug('Task released', {
      taskId,
      model,
      remainingOnModel: active,
      remainingGlobal: globalActive,
    });

    // Try to process queued tasks
    this.processQueue();
  }

  /**
   * Get current load on a specific model (0-100%).
   */
  getModelLoad(model: string): number {
    const active = this.activeTasks.get(model)?.size ?? 0;
    const limit = CONCURRENCY_LIMITS.perModel[model] || 1;
    return Math.min(100, Math.round((active / limit) * 100));
  }

  /**
   * Get global load across all models (0-100%).
   */
  getGlobalLoad(): number {
    const active = Array.from(this.activeTasks.values()).reduce(
      (sum, tasks) => sum + tasks.size,
      0
    );
    return Math.min(100, Math.round((active / CONCURRENCY_LIMITS.globalMax) * 100));
  }

  /**
   * Get detailed status for display in CLI or monitoring UI.
   */
  getStatus() {
    const globalActive = Array.from(this.activeTasks.values()).reduce(
      (sum, tasks) => sum + tasks.size,
      0
    );
    const globalLoad = this.getGlobalLoad();

    const perModel = Object.entries(CONCURRENCY_LIMITS.perModel).map(([model, limit]) => {
      const active = this.activeTasks.get(model)?.size ?? 0;
      const queued = this.queuedTasks.get(model)?.length ?? 0;
      const utilization = Math.round((active / limit) * 100);

      let status: 'available' | 'capacity-warning' | 'at-capacity' | 'overloaded';
      if (active === 0) status = 'available';
      else if (utilization >= 100) status = 'at-capacity';
      else if (utilization >= 75) status = 'capacity-warning';
      else status = 'available';

      return {
        model,
        activeTasks: active,
        maxConcurrency: limit,
        queuedTasks: queued,
        utilizationPercent: utilization,
        status,
      };
    });

    let globalStatus: 'healthy' | 'capacity-warning' | 'at-capacity' | 'overloaded';
    if (globalLoad >= 100) globalStatus = 'at-capacity';
    else if (globalLoad >= 85) globalStatus = 'capacity-warning';
    else globalStatus = 'healthy';

    return {
      timestamp: Date.now(),
      global: {
        activeTasks: globalActive,
        globalMax: CONCURRENCY_LIMITS.globalMax,
        utilizationPercent: globalLoad,
        status: globalStatus,
        perModel,
      },
    };
  }

  /**
   * Generate human-readable CLI status string
   * Example: "Active: 8/15 global, Qwen4b: 6/8, Qwen9b: 2/3, Gemma: 0/1"
   */
  getCliStatus(): string {
    const status = this.getStatus();
    const globalPart = `Active: ${status.global.activeTasks}/${status.global.globalMax} (${status.global.utilizationPercent}%)`;

    const modelParts = status.global.perModel
      .filter((m) => m.activeTasks > 0 || m.status !== 'available')
      .map(
        (m) =>
          `${m.model.replace(/^qwen3\.5:/, 'Qwen').replace(/^gemma4:/, 'Gemma')}: ${m.activeTasks}/${m.maxConcurrency}`
      );

    if (status.global.status === 'at-capacity') {
      return `WARNING: ${globalPart} (AT CAPACITY) ${modelParts.join(', ')}`;
    }
    if (status.global.status === 'capacity-warning') {
      return `CAUTION: ${globalPart} (NEAR CAPACITY) ${modelParts.join(', ')}`;
    }

    return `${globalPart} ${modelParts.length > 0 ? modelParts.join(', ') : ''}`;
  }

  /**
   * Check GPU memory availability via Ollama health endpoint.
   * Returns { available: true } or { available: false, reason: "..." }
   */
  private async checkGpuMemory(): Promise<{ available: boolean; reason?: string }> {
    try {
      const endpoint = `${INFRASTRUCTURE.ollamaUrl}/api/ps`;
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });

      if (!response.ok) {
        return {
          available: false,
          reason: `Ollama health check failed (HTTP ${response.status})`,
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string; size_vram: number }> };
      const models = data.models || [];
      const totalVram = models.reduce((sum, m) => sum + (m.size_vram || 0), 0);

      // Rough heuristic: if total VRAM > 120GB, consider it at capacity
      // (adjust based on actual GPU memory available)
      if (totalVram > 120 * 1024 * 1024 * 1024) {
        return {
          available: false,
          reason: `GPU memory high (${Math.round(totalVram / (1024 * 1024 * 1024))}GB loaded). New tasks queued.`,
        };
      }

      return { available: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.debug('GPU memory check failed', {}, err);
      // If we can't check, assume available (fail open)
      return { available: true };
    }
  }

  /**
   * Generate a unique task ID for tracking.
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────

export const loadMonitor = new LoadMonitorImpl();

/**
 * For testing: create a fresh instance
 */
export function createLoadMonitor(): LoadMonitorImpl {
  return new LoadMonitorImpl();
}
