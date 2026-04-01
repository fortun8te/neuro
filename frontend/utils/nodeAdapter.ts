/**
 * Node.js Adapter — Shim browser APIs for use in Node.js
 * Provides mock implementations of browser-only features
 */

/**
 * Mock localStorage for Node.js environment
 */
export const createLocalStorageMock = () => {
  const store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key in store) {
        delete store[key];
      }
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };
};

/**
 * Mock crypto for Node.js environment
 */
export const createCryptoMock = () => {
  return {
    randomUUID: () => {
      // Simple UUID v4 implementation
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
};

/**
 * Setup Node.js environment with browser API mocks
 */
export function setupNodeEnvironment() {
  if (typeof window === 'undefined') {
    // We're in Node.js
    (globalThis as any).localStorage = createLocalStorageMock();

    // crypto is already available in Node.js 15+, so we don't override it
    // Only set it if it doesn't exist
    if (typeof globalThis.crypto === 'undefined') {
      (globalThis as any).crypto = createCryptoMock();
    }

    // Setup IndexedDB mock
    const mockIndexedDB = getMockIndexedDB();
    (globalThis as any).indexedDB = {
      open: (name: string) => {
        const db = mockIndexedDB.openDatabase(name);
        return {
          onsuccess: undefined,
          onerror: undefined,
          addEventListener: function(event: string, handler: Function) {
            if (event === 'success') {
              setTimeout(() => handler({ target: { result: db } }));
            }
          },
        };
      },
    };

    // Mock fetch if not available (shouldn't happen in modern Node.js)
    if (typeof fetch === 'undefined') {
      // @ts-ignore
      globalThis.fetch = async (url: string, init?: RequestInit) => {
        const nodeFetch = await import('node-fetch');
        return nodeFetch.default(url, init);
      };
    }
  }
}

/**
 * Create a terminal-compatible event emitter
 * (since we can't use React events in CLI)
 */
export class TerminalEventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  clear() {
    this.listeners.clear();
  }
}

/**
 * Mock IndexedDB for Node.js (uses in-memory store)
 */
export class MockIndexedDB {
  private stores: Map<string, Map<string, any>> = new Map();

  openDatabase(name: string): MockDatabase {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return new MockDatabase(this.stores.get(name)!);
  }
}

class MockDatabase {
  private data: Map<string, any>;

  constructor(data: Map<string, any>) {
    this.data = data;
  }

  getItem(key: string) {
    return this.data.get(key) || null;
  }

  setItem(key: string, value: any) {
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  getAllItems() {
    return Array.from(this.data.entries()).map(([key, value]) => ({ key, value }));
  }

  clear() {
    this.data.clear();
  }
}

// Singleton instance
let mockIndexedDB: MockIndexedDB | null = null;

export function getMockIndexedDB(): MockIndexedDB {
  if (!mockIndexedDB) {
    mockIndexedDB = new MockIndexedDB();
  }
  return mockIndexedDB;
}
