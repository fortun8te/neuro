/**
 * Queued Prompt Manager
 * Handles queue creation, storage, execution, and state management
 */

import { idb } from './storage/indexedDbService';
import {
  PromptQueue,
  QueuedPromptItem,
  QueueExecutionContext,
  QueueEvent,
  PromptTemplate,
  QueueStorageEntry,
} from '../types/queuedPrompt';

const QUEUE_STORAGE_KEY = 'queued_prompts_v1';
const TEMPLATES_STORAGE_KEY = 'prompt_templates_v1';

export class QueuedPromptManager {
  private static listeners: Map<string, Set<(event: QueueEvent) => void>> = new Map();

  /**
   * Create a new prompt queue
   */
  static createQueue(
    name: string,
    description?: string,
    items: Partial<QueuedPromptItem>[] = [],
  ): PromptQueue {
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queue: PromptQueue = {
      id: queueId,
      name,
      description,
      status: 'pending',
      items: items.map((item, idx) => ({
        id: `item_${idx}_${Date.now()}`,
        queueId,
        sequenceNumber: idx,
        status: 'pending',
        prompt: item.prompt || '',
        model: item.model || 'qwen3.5:4b',
        ...item,
      })),
      currentItemIndex: -1,
      schedule: {
        type: 'immediate',
      },
      parallelExecutionLimit: 1,
      stopOnError: true,
      retryOnFailure: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return queue;
  }

  /**
   * Add items to queue
   */
  static addItemsToQueue(queue: PromptQueue, items: Partial<QueuedPromptItem>[]): QueuedPromptItem[] {
    const newItems: QueuedPromptItem[] = items.map((item, idx) => ({
      id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
      queueId: queue.id,
      sequenceNumber: queue.items.length + idx,
      status: 'pending',
      prompt: item.prompt || '',
      model: item.model || 'qwen3.5:4b',
      ...item,
    }));

    queue.items.push(...newItems);
    queue.updatedAt = Date.now();

    return newItems;
  }

  /**
   * Remove item from queue
   */
  static removeItemFromQueue(queue: PromptQueue, itemId: string): void {
    queue.items = queue.items.filter((item) => item.id !== itemId);
    queue.items.forEach((item, idx) => {
      item.sequenceNumber = idx;
    });
    queue.updatedAt = Date.now();
  }

  /**
   * Reorder items in queue
   */
  static reorderQueue(queue: PromptQueue, itemIds: string[]): void {
    const itemMap = new Map(queue.items.map((item) => [item.id, item]));
    const reordered = itemIds
      .map((id) => itemMap.get(id))
      .filter((item): item is QueuedPromptItem => item !== undefined);

    queue.items = reordered;
    queue.items.forEach((item, idx) => {
      item.sequenceNumber = idx;
    });
    queue.updatedAt = Date.now();
  }

  /**
   * Update item in queue
   */
  static updateQueueItem(
    queue: PromptQueue,
    itemId: string,
    updates: Partial<QueuedPromptItem>,
  ): void {
    const item = queue.items.find((i) => i.id === itemId);
    if (item) {
      Object.assign(item, updates);
      queue.updatedAt = Date.now();
    }
  }

  /**
   * Clone queue (creates independent copy)
   */
  static cloneQueue(queue: PromptQueue, newName?: string): PromptQueue {
    const cloned: PromptQueue = {
      ...queue,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newName || `${queue.name} (Copy)`,
      items: queue.items.map((item) => ({
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending',
        output: undefined,
        error: undefined,
        executedAt: undefined,
        completedAt: undefined,
      })),
      currentItemIndex: -1,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: undefined,
      completedAt: undefined,
    };

    return cloned;
  }

  /**
   * Get next executable items (respecting dependencies)
   */
  static getNextExecutableItems(queue: PromptQueue): QueuedPromptItem[] {
    const executable: QueuedPromptItem[] = [];

    for (const item of queue.items) {
      if (item.status !== 'pending') continue;

      // Check dependencies
      if (item.dependsOnIds && item.dependsOnIds.length > 0) {
        const allDepsComplete = item.dependsOnIds.every((depId) => {
          const dep = queue.items.find((i) => i.id === depId);
          return dep && dep.status === 'completed';
        });

        if (!allDepsComplete) continue;
      }

      executable.push(item);
    }

    // Respect parallelization limit
    return executable.slice(0, queue.parallelExecutionLimit);
  }

  /**
   * Create execution context for an item
   */
  static createExecutionContext(
    queue: PromptQueue,
    itemId: string,
    abortSignal?: AbortSignal,
  ): QueueExecutionContext {
    const item = queue.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in queue`);
    }

    const previousOutputs: Record<string, string> = {};
    queue.items.forEach((prevItem) => {
      if (prevItem.sequenceNumber < item.sequenceNumber && prevItem.output) {
        previousOutputs[`output_${prevItem.sequenceNumber}`] = prevItem.output;
      }
    });

    return {
      queueId: queue.id,
      currentItemId: itemId,
      previousOutputs,
      abortSignal,
      progress: {
        current: queue.items.filter((i) => i.status === 'completed').length,
        total: queue.items.length,
        percentage: 0,
      },
      metrics: {
        startTime: Date.now(),
        itemsCompleted: queue.successCount,
        itemsFailed: queue.failureCount,
        totalTokens: 0,
        averageLatency: 0,
      },
    };
  }

  /**
   * Record item completion
   */
  static recordItemCompletion(
    queue: PromptQueue,
    itemId: string,
    output: string,
    tokensUsed?: number,
  ): void {
    const item = queue.items.find((i) => i.id === itemId);
    if (!item) return;

    item.status = 'completed';
    item.output = output;
    item.completedAt = Date.now();
    item.tokensUsed = tokensUsed;
    if (item.executedAt) {
      item.duration = item.completedAt - item.executedAt;
    }

    queue.successCount++;
    queue.updatedAt = Date.now();

    this.emit('item_completed', {
      type: 'item_completed',
      queueId: queue.id,
      itemId,
      timestamp: Date.now(),
      data: { output: output.substring(0, 100), tokensUsed },
    });
  }

  /**
   * Record item failure
   */
  static recordItemFailure(queue: PromptQueue, itemId: string, error: string): void {
    const item = queue.items.find((i) => i.id === itemId);
    if (!item) return;

    item.status = 'failed';
    item.error = error;
    item.completedAt = Date.now();
    if (item.executedAt) {
      item.duration = item.completedAt - item.executedAt;
    }

    queue.failureCount++;
    queue.updatedAt = Date.now();

    this.emit('item_error', {
      type: 'item_error',
      queueId: queue.id,
      itemId,
      timestamp: Date.now(),
      data: { error },
    });
  }

  /**
   * Mark item as executing
   */
  static markItemExecuting(queue: PromptQueue, itemId: string): void {
    const item = queue.items.find((i) => i.id === itemId);
    if (item) {
      item.status = 'executing';
      item.executedAt = Date.now();
      queue.updatedAt = Date.now();
    }
  }

  /**
   * Pause queue
   */
  static pauseQueue(queue: PromptQueue): void {
    queue.status = 'paused';
    queue.updatedAt = Date.now();
  }

  /**
   * Resume queue
   */
  static resumeQueue(queue: PromptQueue): void {
    queue.status = 'executing';
    queue.updatedAt = Date.now();
  }

  /**
   * Complete queue
   */
  static completeQueue(queue: PromptQueue): void {
    queue.status = 'completed';
    queue.completedAt = Date.now();
    if (queue.startedAt) {
      queue.totalDuration = queue.completedAt - queue.startedAt;
    }
    queue.updatedAt = Date.now();

    this.emit('queue_completed', {
      type: 'queue_completed',
      queueId: queue.id,
      timestamp: Date.now(),
      data: {
        successCount: queue.successCount,
        failureCount: queue.failureCount,
        totalDuration: queue.totalDuration,
      },
    });
  }

  /**
   * Save queue to storage
   */
  static async saveQueue(queue: PromptQueue): Promise<void> {
    try {
      const queues = (await idb.getItem(QUEUE_STORAGE_KEY)) || [];
      const index = queues.findIndex((q: PromptQueue) => q.id === queue.id);

      if (index >= 0) {
        queues[index] = queue;
      } else {
        queues.push(queue);
      }

      await idb.setItem(QUEUE_STORAGE_KEY, queues);
    } catch (error) {
      console.error('Failed to save queue:', error);
    }
  }

  /**
   * Load queue from storage
   */
  static async loadQueue(queueId: string): Promise<PromptQueue | null> {
    try {
      const queues = (await idb.getItem(QUEUE_STORAGE_KEY)) || [];
      return queues.find((q: PromptQueue) => q.id === queueId) || null;
    } catch (error) {
      console.error('Failed to load queue:', error);
      return null;
    }
  }

  /**
   * Load all queues
   */
  static async loadAllQueues(): Promise<PromptQueue[]> {
    try {
      return (await idb.getItem(QUEUE_STORAGE_KEY)) || [];
    } catch (error) {
      console.error('Failed to load queues:', error);
      return [];
    }
  }

  /**
   * Delete queue
   */
  static async deleteQueue(queueId: string): Promise<void> {
    try {
      let queues = (await idb.getItem(QUEUE_STORAGE_KEY)) || [];
      queues = queues.filter((q: PromptQueue) => q.id !== queueId);
      await idb.setItem(QUEUE_STORAGE_KEY, queues);
    } catch (error) {
      console.error('Failed to delete queue:', error);
    }
  }

  /**
   * Save template
   */
  static async saveTemplate(template: PromptTemplate): Promise<void> {
    try {
      const templates = (await idb.getItem(TEMPLATES_STORAGE_KEY)) || [];
      const index = templates.findIndex((t: PromptTemplate) => t.id === template.id);

      if (index >= 0) {
        templates[index] = template;
      } else {
        templates.push(template);
      }

      await idb.setItem(TEMPLATES_STORAGE_KEY, templates);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  }

  /**
   * Load templates by category
   */
  static async loadTemplates(category?: string): Promise<PromptTemplate[]> {
    try {
      const templates = (await idb.getItem(TEMPLATES_STORAGE_KEY)) || [];
      return category ? templates.filter((t: PromptTemplate) => t.category === category) : templates;
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      let templates = (await idb.getItem(TEMPLATES_STORAGE_KEY)) || [];
      templates = templates.filter((t: PromptTemplate) => t.id !== templateId);
      await idb.setItem(TEMPLATES_STORAGE_KEY, templates);
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }

  /**
   * Event system
   */
  static on(queueId: string, listener: (event: QueueEvent) => void): () => void {
    if (!this.listeners.has(queueId)) {
      this.listeners.set(queueId, new Set());
    }

    this.listeners.get(queueId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(queueId)?.delete(listener);
    };
  }

  private static emit(type: string, event: QueueEvent): void {
    const listeners = this.listeners.get(event.queueId);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }
  }

  /**
   * Export queue as JSON
   */
  static exportQueue(queue: PromptQueue): string {
    return JSON.stringify(queue, null, 2);
  }

  /**
   * Import queue from JSON
   */
  static importQueue(json: string): PromptQueue {
    const queue = JSON.parse(json);
    queue.id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    queue.items.forEach((item: QueuedPromptItem) => {
      item.id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      item.status = 'pending';
    });
    return queue;
  }
}
