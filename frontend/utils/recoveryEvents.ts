/**
 * Recovery Event System
 * Emits events for storage failures, retries, and rollbacks
 * UI can subscribe to notify users of issues
 */

export type RecoveryEventType =
  | 'save-attempt'
  | 'save-success'
  | 'save-retry'
  | 'save-permanent-failure'
  | 'save-max-retries-exceeded'
  | 'load-attempt'
  | 'load-success'
  | 'load-retry'
  | 'load-permanent-failure'
  | 'load-max-retries-exceeded'
  | 'checkpoint-rollback'
  | 'checkpoint-recovery-failed';

export interface RecoveryEvent {
  type: RecoveryEventType;
  timestamp: number;
  contextName: string;
  attempt?: number;
  maxRetries?: number;
  error?: unknown;
  delayMs?: number;
  retryAfterMs?: number;
  backupId?: string;
  checkpointId?: string;
  details?: Record<string, any>;
}

type RecoveryListener = (event: RecoveryEvent) => void;

class RecoveryEventSystem {
  private listeners = new Map<RecoveryEventType | 'all', Set<RecoveryListener>>();
  private eventHistory: RecoveryEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to recovery events
   * Type 'all' subscribes to all event types
   */
  subscribe(
    listener: RecoveryListener,
    types: RecoveryEventType[] | 'all' = 'all'
  ): () => void {
    const typeList: Array<RecoveryEventType | 'all'> =
      types === 'all'
        ? ['all']
        : (Array.isArray(types) ? types : [types]);

    for (const type of typeList) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)!.add(listener);
    }

    // Return unsubscribe function
    return () => {
      for (const type of typeList) {
        this.listeners.get(type)?.delete(listener);
      }
    };
  }

  /**
   * Emit a recovery event
   */
  emit(event: Omit<RecoveryEvent, 'timestamp'>): void {
    const fullEvent: RecoveryEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Store in history
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify all listeners
    const allListeners = this.listeners.get('all') || new Set();
    const typeListeners = this.listeners.get(event.type) || new Set();

    const subscribers = new Set([...allListeners, ...typeListeners]);
    for (const listener of subscribers) {
      try {
        listener(fullEvent);
      } catch (err) {
        console.warn('[recoveryEvents] Listener threw:', err);
      }
    }
  }

  /**
   * Get event history (recent events)
   */
  getHistory(
    limit = 20,
    types?: RecoveryEventType[]
  ): RecoveryEvent[] {
    let events = [...this.eventHistory];

    if (types && types.length > 0) {
      const typeSet = new Set(types);
      events = events.filter((e) => typeSet.has(e.type));
    }

    return events.slice(-limit);
  }

  /**
   * Get count of failures by type
   */
  getFailureStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const event of this.eventHistory) {
      if (
        event.type.includes('failure') ||
        event.type.includes('max-retries')
      ) {
        stats[event.type] = (stats[event.type] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

export const recoveryEvents = new RecoveryEventSystem();

/**
 * Helper hook for React components to subscribe to recovery events
 * Usage: const unsubscribe = useRecoveryEvents((event) => console.log(event))
 */
export function createRecoveryListener(
  callback: (event: RecoveryEvent) => void,
  types?: RecoveryEventType[]
): () => void {
  return recoveryEvents.subscribe(callback, types);
}
