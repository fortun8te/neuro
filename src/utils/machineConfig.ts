/**
 * Machine Config — loads sandbox machine definitions from machines.json
 * and provides a MachinePool for acquiring/releasing sandboxes.
 */

import type {
  ElementInfo,
  PageInfo,
  ViewResult,
  ScreenshotResult,
  TabInfo,
} from './sandboxService';

// ── Types ──

export interface MachineConfig {
  id: string;
  baseUrl: string;
  vncWsUrl: string;
  label: string;
}

export interface MachinesFile {
  machines: MachineConfig[];
}

export type MachineStatus = 'idle' | 'busy' | 'offline';

export interface MachineState {
  config: MachineConfig;
  status: MachineStatus;
  acquiredBy: string | null;
}

// ── Default fallback (matches machines.json) ──

const DEFAULT_MACHINES: MachineConfig[] = [
  { id: 'sandbox-1', baseUrl: 'http://localhost:8080', vncWsUrl: 'ws://localhost:5901', label: 'Computer 1' },
  { id: 'sandbox-2', baseUrl: 'http://localhost:8081', vncWsUrl: 'ws://localhost:5902', label: 'Computer 2' },
  { id: 'sandbox-3', baseUrl: 'http://localhost:8082', vncWsUrl: 'ws://localhost:5903', label: 'Computer 3' },
];

// ── Module state ──

let machineConfigs: MachineConfig[] = [];
let loaded = false;

// ── Loader ──

/**
 * Load machine definitions from /machines.json (served by Vite as a static asset).
 * Falls back to hardcoded defaults if the fetch fails.
 */
export async function loadMachines(): Promise<MachineConfig[]> {
  if (loaded) return machineConfigs;

  try {
    const res = await fetch('/machines.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: MachinesFile = await res.json();
    if (Array.isArray(data.machines) && data.machines.length > 0) {
      machineConfigs = data.machines;
    } else {
      machineConfigs = DEFAULT_MACHINES;
    }
  } catch {
    machineConfigs = DEFAULT_MACHINES;
  }

  loaded = true;
  return machineConfigs;
}

/** Return the current machine list (call loadMachines first). */
export function getMachineConfigs(): MachineConfig[] {
  if (!loaded) return DEFAULT_MACHINES;
  return machineConfigs;
}

// ── Machine Pool ──

/**
 * Manages a pool of sandbox machines. Tracks which are idle/busy/offline,
 * and provides acquire/release semantics so multiple agents can work in
 * parallel without colliding.
 */
export class MachinePool {
  private machines: Map<string, MachineState> = new Map();

  /** Register all machines from config. */
  registerAll(configs: MachineConfig[]): void {
    for (const cfg of configs) {
      this.machines.set(cfg.id, { config: cfg, status: 'idle', acquiredBy: null });
    }
  }

  /** Register a single machine. */
  register(config: MachineConfig): void {
    this.machines.set(config.id, { config, status: 'idle', acquiredBy: null });
  }

  /** Get all machine states. */
  getAll(): MachineState[] {
    return Array.from(this.machines.values());
  }

  /** Get a specific machine state by ID. */
  get(id: string): MachineState | undefined {
    return this.machines.get(id);
  }

  /**
   * Acquire the first idle machine. Returns null if none available.
   * The `owner` string identifies who is using it (e.g. agent ID or task name).
   */
  acquire(owner: string): MachineState | null {
    for (const state of this.machines.values()) {
      if (state.status === 'idle') {
        state.status = 'busy';
        state.acquiredBy = owner;
        return state;
      }
    }
    return null;
  }

  /** Acquire a specific machine by ID. Returns null if not idle. */
  acquireById(id: string, owner: string): MachineState | null {
    const state = this.machines.get(id);
    if (!state || state.status !== 'idle') return null;
    state.status = 'busy';
    state.acquiredBy = owner;
    return state;
  }

  /** Release a machine back to the pool. */
  release(id: string): void {
    const state = this.machines.get(id);
    if (state) {
      state.status = 'idle';
      state.acquiredBy = null;
    }
  }

  /** Mark a machine as offline (e.g. health check failed). */
  markOffline(id: string): void {
    const state = this.machines.get(id);
    if (state) {
      state.status = 'offline';
      state.acquiredBy = null;
    }
  }

  /** Mark a machine as idle (e.g. came back online). */
  markOnline(id: string): void {
    const state = this.machines.get(id);
    if (state && state.status === 'offline') {
      state.status = 'idle';
      state.acquiredBy = null;
    }
  }

  /** Count of idle machines. */
  get availableCount(): number {
    let count = 0;
    for (const s of this.machines.values()) {
      if (s.status === 'idle') count++;
    }
    return count;
  }

  /** Total registered machines. */
  get totalCount(): number {
    return this.machines.size;
  }

  /**
   * Health-check all machines and update their status.
   * Returns a map of id -> online boolean.
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const checks = Array.from(this.machines.entries()).map(async ([id, state]) => {
      try {
        const res = await fetch(`${state.config.baseUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const online = data.status === 'ok';
        results.set(id, online);

        if (online && state.status === 'offline') {
          state.status = 'idle';
        } else if (!online && state.status === 'idle') {
          state.status = 'offline';
        }
      } catch {
        results.set(id, false);
        if (state.status === 'idle') {
          state.status = 'offline';
        }
      }
    });

    await Promise.all(checks);
    return results;
  }
}

// ── Sandbox client factory ──

/**
 * Create a sandboxService-compatible client bound to a specific machine's baseUrl.
 * This mirrors the API of the original sandboxService singleton but targets
 * whichever machine you point it at.
 */
export function createSandboxClient(machine: MachineConfig) {
  const baseUrl = machine.baseUrl;

  async function post<T = PageInfo>(path: string, body?: object): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Sandbox API ${path}: ${res.status}`);
    return res.json();
  }

  return {
    machineId: machine.id,
    label: machine.label,

    async health(): Promise<boolean> {
      try {
        const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return false;
        const data = await res.json();
        return data.status === 'ok';
      } catch {
        return false;
      }
    },

    async navigate(url: string): Promise<PageInfo> {
      return post('/browser/navigate', { url });
    },

    async view(): Promise<ViewResult> {
      return post<ViewResult>('/browser/view');
    },

    async click(index: number): Promise<PageInfo> {
      return post('/browser/click', { index });
    },

    async clickCoords(x: number, y: number): Promise<PageInfo> {
      return post('/browser/click', { x, y });
    },

    async input(index: number, text: string, pressEnter = false): Promise<PageInfo> {
      return post('/browser/input', { index, text, press_enter: pressEnter });
    },

    async scroll(direction: 'up' | 'down' = 'down', amount = 500): Promise<PageInfo> {
      return post('/browser/scroll', { direction, amount });
    },

    async pressKey(key: string): Promise<PageInfo> {
      return post('/browser/press_key', { key });
    },

    async back(): Promise<PageInfo> {
      return post('/browser/back');
    },

    async forward(): Promise<PageInfo> {
      return post('/browser/forward');
    },

    async screenshot(quality = 60): Promise<ScreenshotResult> {
      return post<ScreenshotResult>('/browser/screenshot', { quality });
    },

    async consoleExec(js: string): Promise<{ error: string | null; result: string | null }> {
      return post('/browser/console_exec', { js });
    },

    async listTabs(): Promise<TabInfo[]> {
      try {
        return await post<TabInfo[]>('/browser/tabs');
      } catch {
        return [];
      }
    },

    async openTab(url?: string): Promise<PageInfo> {
      return post('/browser/tab/open', { url: url || 'about:blank' });
    },

    async switchTab(index: number): Promise<PageInfo> {
      return post('/browser/tab/switch', { index });
    },

    async closeTab(): Promise<PageInfo> {
      return post('/browser/tab/close');
    },

    formatElements(elements: ElementInfo[]): string {
      return elements.map(el => {
        const tag = el.tag.toUpperCase();
        const text = el.text.slice(0, 60);
        const placeholder = el.placeholder;
        const type = el.type;
        const role = el.role;

        if (tag === 'INPUT') {
          let desc = `INPUT[${type}]`;
          if (placeholder) desc += ` placeholder="${placeholder}"`;
          if (text) desc += ` value="${text}"`;
          return `[${el.index}] ${desc}`;
        }
        if (tag === 'TEXTAREA') {
          let desc = 'TEXTAREA';
          if (placeholder) desc += ` placeholder="${placeholder}"`;
          return `[${el.index}] ${desc}`;
        }
        if (tag === 'SELECT') {
          return `[${el.index}] SELECT${text ? ` selected="${text}"` : ''}`;
        }
        if (tag === 'A') {
          return `[${el.index}] LINK "${text}"`;
        }
        if (tag === 'BUTTON' || role === 'button') {
          return `[${el.index}] BUTTON "${text}"`;
        }
        let desc = tag;
        if (role) desc += `[${role}]`;
        if (text) desc += ` "${text}"`;
        return `[${el.index}] ${desc}`;
      }).join('\n');
    },

    get vncUrl(): string {
      return machine.vncWsUrl;
    },
  };
}

// ── Singleton pool instance ──

export const machinePool = new MachinePool();

/**
 * Initialize the pool: load machines.json and register all machines.
 * Call once at app startup.
 */
export async function initMachinePool(): Promise<MachinePool> {
  const configs = await loadMachines();
  machinePool.registerAll(configs);
  return machinePool;
}
