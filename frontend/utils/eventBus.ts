/**
 * EventBus — Pub-Sub for loose coupling between services
 * Stolen from OpenCode: any service can publish/subscribe without import hell
 */

type EventHandler = (data: any) => Promise<void> | void;

export class EventBus {
  private subscribers = new Map<string, Set<EventHandler>>();

  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(event)?.delete(handler);
    };
  }

  async publish(event: string, data?: any) {
    const handlers = this.subscribers.get(event) || [];
    await Promise.all([...handlers].map(h => Promise.resolve(h(data))));
  }

  // Clear all subscribers for an event (for cleanup/testing)
  clear(event?: string) {
    if (event) {
      this.subscribers.delete(event);
    } else {
      this.subscribers.clear();
    }
  }
}

// Global singleton
export const eventBus = new EventBus();

// Event types (for type safety)
export const EVENTS = {
  // Cycle lifecycle
  'cycle:started': 'cycle:started',
  'cycle:complete': 'cycle:complete',
  'cycle:error': 'cycle:error',

  // Agent execution
  'agent:thinking': 'agent:thinking',
  'agent:tool-call': 'agent:tool-call',
  'agent:tool-result': 'agent:tool-result',

  // UI state
  'ui:theme-changed': 'ui:theme-changed',
  'ui:mode-changed': 'ui:mode-changed',

  // Persistence
  'data:saved': 'data:saved',
  'data:loaded': 'data:loaded',

  // Errors
  'error:critical': 'error:critical',
  'error:warning': 'error:warning',
} as const;
