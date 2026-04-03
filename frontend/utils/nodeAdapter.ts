/**
 * Node.js Adapter — Shim browser APIs for use in Node.js
 * Provides mock implementations of browser-only features.
 * Critically: intercepts /api/shell and /api/file/* calls so agentEngine
 * tools (shell_exec, read_file, write_file, etc.) work in CLI mode without
 * a running Vite dev server.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Node.js fetch intercept for /api/* routes ─────────────────────────────────
// agentEngine calls fetch('/api/shell', ...) etc. In CLI mode there is no
// HTTP server. We intercept those calls here and handle them natively.

const HOME = os.homedir();
const BLOCKED_SHELL = [
  /\brm\s+-rf\s+\/(?!\S)/,
  /\bsudo\b/,
  />\s*\/etc\//,
  />\s*\/usr\//,
  />\s*\/System\//,
];

function isBlockedShell(cmd: string) {
  return BLOCKED_SHELL.some(r => r.test(cmd));
}

function expandPath(p: string) {
  return p.replace(/^\$HOME/, HOME).replace(/^~/, HOME);
}

function makeFakeResponse(body: unknown, status = 200) {
  const json = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(json),
    clone: function() { return this; },
  };
}

function handleApiShell(body: any) {
  const { command, timeout = 30000 } = body;
  if (!command) return makeFakeResponse({ error: 'missing command' }, 400);
  if (isBlockedShell(command)) {
    return makeFakeResponse({ stdout: '', stderr: 'Blocked: dangerous pattern', exitCode: 1 }, 403);
  }
  try {
    const stdout = execSync(command, {
      timeout,
      shell: '/bin/zsh',
      cwd: HOME,
      env: { ...process.env, HOME },
      maxBuffer: 4 * 1024 * 1024,
    }).toString();
    return makeFakeResponse({ stdout: stdout.slice(0, 8000), stderr: '', exitCode: 0 });
  } catch (e: any) {
    return makeFakeResponse({
      stdout: (e.stdout || '').toString().slice(0, 4000),
      stderr: (e.stderr || e.message || '').toString().slice(0, 2000),
      exitCode: e.status ?? 1,
    });
  }
}

function handleApiFileRead(body: any) {
  const { path: p, maxLines = 500 } = body;
  if (!p) return makeFakeResponse({ error: 'missing path' }, 400);
  try {
    const ep = expandPath(p);
    const raw = fs.readFileSync(ep, 'utf8');
    const lines = raw.split('\n');
    const content = lines.slice(0, maxLines).join('\n') + (lines.length > maxLines ? '\n...[truncated]' : '');
    return makeFakeResponse({ content });
  } catch (e: any) {
    return makeFakeResponse({ error: String(e.message) }, 500);
  }
}

function handleApiFileWrite(body: any) {
  const { path: p, content } = body;
  if (!p) return makeFakeResponse({ error: 'missing path' }, 400);
  try {
    const ep = expandPath(p);
    fs.mkdirSync(path.dirname(ep), { recursive: true });
    fs.writeFileSync(ep, content ?? '', 'utf8');
    return makeFakeResponse({ ok: true });
  } catch (e: any) {
    return makeFakeResponse({ error: String(e.message) }, 500);
  }
}

function handleApiFileDelete(body: any) {
  const { path: p } = body;
  if (!p) return makeFakeResponse({ error: 'missing path' }, 400);
  try {
    const ep = expandPath(p);
    if (fs.existsSync(ep)) fs.unlinkSync(ep);
    return makeFakeResponse({ ok: true });
  } catch (e: any) {
    return makeFakeResponse({ error: String(e.message) }, 500);
  }
}

function handleApiFileList(body: any) {
  const { dir } = body;
  if (!dir) return makeFakeResponse({ error: 'missing dir', entries: [] }, 400);
  try {
    const ep = expandPath(dir);
    const entries = fs.readdirSync(ep, { withFileTypes: true }).map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
      size: e.isFile() ? (() => { try { return fs.statSync(path.join(ep, e.name)).size; } catch { return 0; } })() : 0,
    }));
    return makeFakeResponse({ entries });
  } catch (e: any) {
    return makeFakeResponse({ error: String(e.message), entries: [] }, 500);
  }
}

// Wrap the global fetch to intercept /api/* routes
function patchFetchForCLI() {
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as any).url || '';

    if (urlStr.startsWith('/api/') || urlStr === '/api/shell' || urlStr.includes('localhost/api/')) {
      // Parse relative or localhost /api/* routes
      const route = urlStr.replace(/^https?:\/\/[^/]+/, '');
      let body: any = {};
      if (init?.body) {
        try { body = JSON.parse(init.body as string); } catch { body = {}; }
      }
      if (route === '/api/shell')       return Promise.resolve(handleApiShell(body) as any);
      if (route === '/api/file/read')   return Promise.resolve(handleApiFileRead(body) as any);
      if (route === '/api/file/write')  return Promise.resolve(handleApiFileWrite(body) as any);
      if (route === '/api/file/delete') return Promise.resolve(handleApiFileDelete(body) as any);
      if (route === '/api/file/list')   return Promise.resolve(handleApiFileList(body) as any);
    }
    return originalFetch(url, init);
  };
}

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

    // Intercept /api/shell and /api/file/* so agent tools work in CLI mode
    patchFetchForCLI();
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
