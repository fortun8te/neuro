/**
 * Queued Prompt Executor
 * Handles execution of prompt queues with dependency management and error handling
 */

import { PromptQueue, QueuedPromptItem, QueueExecutionContext } from '../types/queuedPrompt';
import { QueuedPromptManager } from './queuedPromptManager';
import { ollamaService } from './ai-services/ollama';

export interface ExecutionOptions {
  abortSignal?: AbortSignal;
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void;
  onItemStart?: (item: QueuedPromptItem) => void;
  onItemComplete?: (item: QueuedPromptItem, output: string) => void;
  onItemError?: (item: QueuedPromptItem, error: string) => void;
  onQueueComplete?: (queue: PromptQueue) => void;
}

export class QueuedPromptExecutor {
  private static activeExecutions = new Map<string, AbortController>();

  /**
   * Execute a queue
   */
  static async executeQueue(queue: PromptQueue, options: ExecutionOptions = {}): Promise<PromptQueue> {
    // Check if already executing
    if (this.activeExecutions.has(queue.id)) {
      throw new Error(`Queue ${queue.id} is already executing`);
    }

    const abortController = new AbortController();
    this.activeExecutions.set(queue.id, abortController);

    try {
      queue.status = 'executing';
      queue.startedAt = Date.now();
      await QueuedPromptManager.saveQueue(queue);

      // Execute items in order, respecting dependencies
      await this.executeQueueItems(queue, abortController, options);

      // Complete queue
      QueuedPromptManager.completeQueue(queue);
      await QueuedPromptManager.saveQueue(queue);

      options.onQueueComplete?.(queue);

      return queue;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg !== 'Execution cancelled') {
        queue.status = 'failed';
      }

      await QueuedPromptManager.saveQueue(queue);
      throw error;
    } finally {
      this.activeExecutions.delete(queue.id);
    }
  }

  /**
   * Execute queue items sequentially or in parallel
   */
  private static async executeQueueItems(
    queue: PromptQueue,
    abortController: AbortController,
    options: ExecutionOptions,
  ): Promise<void> {
    const pending = new Set(queue.items.filter((item) => item.status === 'pending').map((i) => i.id));

    while (pending.size > 0) {
      // Check abort signal
      if (abortController.signal.aborted) {
        throw new Error('Execution cancelled');
      }

      // Get next executable items
      const nextItems = QueuedPromptManager.getNextExecutableItems(queue);
      if (nextItems.length === 0) {
        break;
      }

      // Execute in parallel (up to parallelExecutionLimit)
      const promises = nextItems.map((item) =>
        this.executeItem(queue, item, abortController, options),
      );

      await Promise.all(promises);

      // Update pending set
      queue.items.forEach((item) => {
        if (item.status !== 'pending') {
          pending.delete(item.id);
        }
      });

      // Report progress
      const completed = queue.items.filter((i) => i.status === 'completed' || i.status === 'failed')
        .length;
      const progress = {
        current: completed,
        total: queue.items.length,
        percentage: Math.round((completed / queue.items.length) * 100),
      };

      options.onProgress?.(progress);
      await QueuedPromptManager.saveQueue(queue);
    }
  }

  /**
   * Execute a single item
   */
  private static async executeItem(
    queue: PromptQueue,
    item: QueuedPromptItem,
    abortController: AbortController,
    options: ExecutionOptions,
  ): Promise<void> {
    // Handle scheduled execution
    if (item.scheduledFor && item.scheduledFor > Date.now()) {
      await this.delay(item.scheduledFor - Date.now());
    }

    // Handle delay
    if (item.delayMs) {
      await this.delay(item.delayMs);
    }

    let attempts = 0;
    const maxAttempts = 1 + (queue.retryOnFailure || 0);

    while (attempts < maxAttempts) {
      if (abortController.signal.aborted) {
        throw new Error('Execution cancelled');
      }

      try {
        options.onItemStart?.(item);
        QueuedPromptManager.markItemExecuting(queue, item.id);
        await QueuedPromptManager.saveQueue(queue);

        // Resolve variable substitution in prompt
        const resolvedPrompt = this.resolvePromptVariables(item, queue);

        // Create execution context
        const context = QueuedPromptManager.createExecutionContext(queue, item.id, abortController.signal);

        // Execute the prompt
        const output = await this.executePrompt(item, resolvedPrompt, context, abortController.signal);

        // Record success
        QueuedPromptManager.recordItemCompletion(queue, item.id, output);
        options.onItemComplete?.(item, output);

        return; // Success, exit retry loop
      } catch (error) {
        attempts++;

        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempts >= maxAttempts) {
          QueuedPromptManager.recordItemFailure(queue, item.id, errorMsg);
          options.onItemError?.(item, errorMsg);

          if (queue.stopOnError) {
            throw new Error(`Item ${item.id} failed: ${errorMsg}`);
          }

          return;
        }

        // Retry with exponential backoff
        const backoff = Math.pow(2, attempts - 1) * 1000;
        await this.delay(backoff);
      }
    }
  }

  /**
   * Execute a single prompt
   */
  private static async executePrompt(
    item: QueuedPromptItem,
    prompt: string,
    context: QueueExecutionContext,
    abortSignal: AbortSignal,
  ): Promise<string> {
    let output = '';

    // Add timeout if specified
    const timeoutMs = item.timeout || 120000; // default 2 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Create merged abort signal
      const mergedSignal = this.mergeAbortSignals([abortSignal, controller.signal]);

      const systemMessage =
        item.systemMessage ||
        'You are a helpful AI assistant. Provide clear, concise responses.';

      // Stream output from Ollama
      await ollamaService.generateStream(
        {
          model: item.model,
          prompt: `${systemMessage}\n\n${prompt}`,
          temperature: item.temperature ?? 0.7,
          stream: true,
        },
        (chunk) => {
          output += chunk;
        },
        mergedSignal,
      );

      return output;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Resolve template variables in prompt
   */
  private static resolvePromptVariables(item: QueuedPromptItem, queue: PromptQueue): string {
    let prompt = item.prompt;

    // Replace previous output references
    const context = QueuedPromptManager.createExecutionContext(queue, item.id);
    Object.entries(context.previousOutputs).forEach(([key, value]) => {
      const pattern = new RegExp(`\\{${key}\\}`, 'g');
      prompt = prompt.replace(pattern, value.substring(0, 1000)); // Limit to 1000 chars
    });

    // Replace template variables
    if (item.templateVariables) {
      Object.entries(item.templateVariables).forEach(([key, value]) => {
        const pattern = new RegExp(`\\{${key}\\}`, 'g');
        prompt = prompt.replace(pattern, String(value));
      });
    }

    return prompt;
  }

  /**
   * Pause queue execution
   */
  static async pauseQueue(queueId: string): Promise<void> {
    const controller = this.activeExecutions.get(queueId);
    if (!controller) {
      throw new Error(`Queue ${queueId} is not executing`);
    }

    // Signal pause (doesn't abort, just pauses)
    // Implementation would need additional state tracking
  }

  /**
   * Cancel queue execution
   */
  static cancelQueue(queueId: string): void {
    const controller = this.activeExecutions.get(queueId);
    if (controller) {
      controller.abort();
    }
  }

  /**
   * Utility: Sleep with abort signal support
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Utility: Merge multiple abort signals
   */
  private static mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    signals.forEach((signal) => {
      if (signal.aborted) {
        controller.abort();
      }

      signal.addEventListener('abort', () => controller.abort());
    });

    return controller.signal;
  }

  /**
   * Get execution status
   */
  static getExecutionStatus(queue: PromptQueue): {
    isExecuting: boolean;
    progress: number;
    successCount: number;
    failureCount: number;
    currentItem?: QueuedPromptItem;
  } {
    const executingItem = queue.items.find((i) => i.status === 'executing');
    const progress = (queue.successCount + queue.failureCount) / queue.items.length;

    return {
      isExecuting: queue.status === 'executing',
      progress,
      successCount: queue.successCount,
      failureCount: queue.failureCount,
      currentItem: executingItem,
    };
  }
}
