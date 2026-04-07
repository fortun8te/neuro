/**
 * Hook for managing queued prompts
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PromptQueue,
  QueuedPromptItem,
  PromptTemplate,
  QueueEvent,
} from '../types/queuedPrompt';
import { QueuedPromptManager } from '../utils/queuedPromptManager';
import { QueuedPromptExecutor, ExecutionOptions } from '../utils/queuedPromptExecutor';

export function useQueuedPrompts() {
  const [queues, setQueues] = useState<PromptQueue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubscribersRef = useRef<Map<string, () => void>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load queues and templates on mount
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const loadedQueues = await QueuedPromptManager.loadAllQueues();
        const loadedTemplates = await QueuedPromptManager.loadTemplates();

        setQueues(loadedQueues);
        setTemplates(loadedTemplates);

        // Subscribe to events for each queue
        loadedQueues.forEach((queue) => {
          subscribeToQueue(queue.id);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      // Cleanup subscriptions
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribersRef.current.clear();
    };
  }, [subscribeToQueue]);

  /**
   * Subscribe to queue events
   */
  const subscribeToQueue = useCallback((queueId: string) => {
    if (unsubscribersRef.current.has(queueId)) {
      return; // Already subscribed
    }

    const unsubscribe = QueuedPromptManager.on(queueId, (event: QueueEvent) => {
      // Update queue in state based on event
      setQueues((prev) =>
        prev.map((q) => (q.id === queueId ? { ...q } : q)), // Trigger re-render
      );
    });

    unsubscribersRef.current.set(queueId, unsubscribe);
  }, []);

  /**
   * Create new queue
   */
  const createQueue = useCallback(
    async (
      name: string,
      description?: string,
      items?: Partial<QueuedPromptItem>[],
    ): Promise<PromptQueue> => {
      const queue = QueuedPromptManager.createQueue(name, description, items);
      await QueuedPromptManager.saveQueue(queue);

      setQueues((prev) => [...prev, queue]);
      subscribeToQueue(queue.id);

      return queue;
    },
    [subscribeToQueue],
  );

  /**
   * Update queue
   */
  const updateQueue = useCallback(async (queue: PromptQueue) => {
    await QueuedPromptManager.saveQueue(queue);
    setQueues((prev) => prev.map((q) => (q.id === queue.id ? queue : q)));
  }, []);

  /**
   * Delete queue
   */
  const deleteQueue = useCallback(async (queueId: string) => {
    await QueuedPromptManager.deleteQueue(queueId);
    setQueues((prev) => prev.filter((q) => q.id !== queueId));

    setSelectedQueueId((prev) => (prev === queueId ? null : prev));

    const unsubscribe = unsubscribersRef.current.get(queueId);
    if (unsubscribe) {
      unsubscribe();
      unsubscribersRef.current.delete(queueId);
    }
  }, []);

  /**
   * Add items to queue
   */
  const addItemsToQueue = useCallback(
    async (queueId: string, items: Partial<QueuedPromptItem>[]) => {
      const queue = queues.find((q) => q.id === queueId);
      if (!queue) return;

      QueuedPromptManager.addItemsToQueue(queue, items);
      await QueuedPromptManager.saveQueue(queue);
      setQueues((prev) => prev.map((q) => (q.id === queueId ? queue : q)));
    },
    [queues],
  );

  /**
   * Remove item from queue
   */
  const removeQueueItem = useCallback(
    async (queueId: string, itemId: string) => {
      const queue = queues.find((q) => q.id === queueId);
      if (!queue) return;

      QueuedPromptManager.removeItemFromQueue(queue, itemId);
      await QueuedPromptManager.saveQueue(queue);
      setQueues((prev) => prev.map((q) => (q.id === queueId ? queue : q)));
    },
    [queues],
  );

  /**
   * Reorder queue items
   */
  const reorderQueue = useCallback(
    async (queueId: string, itemIds: string[]) => {
      const queue = queues.find((q) => q.id === queueId);
      if (!queue) return;

      QueuedPromptManager.reorderQueue(queue, itemIds);
      await QueuedPromptManager.saveQueue(queue);
      setQueues((prev) => prev.map((q) => (q.id === queueId ? queue : q)));
    },
    [queues],
  );

  /**
   * Execute queue
   */
  const executeQueue = useCallback(
    async (queueId: string): Promise<PromptQueue> => {
      const queue = queues.find((q) => q.id === queueId);
      if (!queue) throw new Error(`Queue ${queueId} not found`);

      abortControllerRef.current = new AbortController();

      try {
        const options: ExecutionOptions = {
          abortSignal: abortControllerRef.current.signal,
          onProgress: (progress) => {
            // Update queue progress
            setQueues((prev) =>
              prev.map((q) => (q.id === queueId ? { ...q } : q)),
            );
          },
          onItemComplete: (item, output) => {
            console.log(`Item ${item.id} completed`);
          },
          onItemError: (item, error) => {
            console.error(`Item ${item.id} error:`, error);
          },
          onQueueComplete: (completedQueue) => {
            setQueues((prev) =>
              prev.map((q) => (q.id === queueId ? completedQueue : q)),
            );
          },
        };

        const executedQueue = await QueuedPromptExecutor.executeQueue(queue, options);
        setQueues((prev) =>
          prev.map((q) => (q.id === queueId ? executedQueue : q)),
        );

        return executedQueue;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [queues],
  );

  /**
   * Cancel queue execution
   */
  const cancelQueue = useCallback((queueId: string) => {
    QueuedPromptExecutor.cancelQueue(queueId);
  }, []);

  /**
   * Clone queue
   */
  const cloneQueue = useCallback(
    async (queueId: string, newName?: string): Promise<PromptQueue> => {
      const queue = queues.find((q) => q.id === queueId);
      if (!queue) throw new Error(`Queue ${queueId} not found`);

      const cloned = QueuedPromptManager.cloneQueue(queue, newName);
      await QueuedPromptManager.saveQueue(cloned);

      setQueues((prev) => [...prev, cloned]);
      subscribeToQueue(cloned.id);

      return cloned;
    },
    [queues, subscribeToQueue],
  );

  /**
   * Save template
   */
  const saveTemplate = useCallback(async (template: PromptTemplate) => {
    await QueuedPromptManager.saveTemplate(template);
    setTemplates((prev) => {
      const index = prev.findIndex((t) => t.id === template.id);
      return index >= 0
        ? [...prev.slice(0, index), template, ...prev.slice(index + 1)]
        : [...prev, template];
    });
  }, []);

  /**
   * Delete template
   */
  const deleteTemplate = useCallback(async (templateId: string) => {
    await QueuedPromptManager.deleteTemplate(templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  /**
   * Export queue
   */
  const exportQueue = useCallback((queueId: string): string | null => {
    const queue = queues.find((q) => q.id === queueId);
    return queue ? QueuedPromptManager.exportQueue(queue) : null;
  }, [queues]);

  /**
   * Import queue
   */
  const importQueue = useCallback(async (json: string): Promise<PromptQueue> => {
    const importedQueue = QueuedPromptManager.importQueue(json);
    await QueuedPromptManager.saveQueue(importedQueue);

    setQueues((prev) => [...prev, importedQueue]);
    subscribeToQueue(importedQueue.id);

    return importedQueue;
  }, [subscribeToQueue]);

  const selectedQueue = selectedQueueId
    ? queues.find((q) => q.id === selectedQueueId)
    : null;

  return {
    // State
    queues,
    selectedQueue,
    selectedQueueId,
    templates,
    isLoading,
    error,

    // Selection
    setSelectedQueueId,

    // Queue operations
    createQueue,
    updateQueue,
    deleteQueue,
    cloneQueue,
    executeQueue,
    cancelQueue,

    // Item operations
    addItemsToQueue,
    removeQueueItem,
    reorderQueue,

    // Template operations
    saveTemplate,
    deleteTemplate,

    // Import/export
    exportQueue,
    importQueue,
  };
}
