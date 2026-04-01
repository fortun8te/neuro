/**
 * Blackboard — Shared knowledge store for multi-agent coordination.
 *
 * Any agent (master or worker) can post findings, errors, status updates,
 * file references, or screenshots. The master agent reads the blackboard
 * to stay informed and make decisions.
 *
 * Design: Simple append-only in-memory store. No persistence (lives for the
 * duration of a session). The toContext() method formats entries for LLM
 * context injection so the master agent can reason over worker findings.
 */

// ── Types ──

export interface BlackboardEntry {
  id: string;
  key: string;
  value: string;
  source: string;    // which agent/worker wrote this (e.g. "worker-abc123")
  timestamp: number;
  type: 'finding' | 'error' | 'status' | 'file' | 'screenshot';
}

export type BlackboardEntryType = BlackboardEntry['type'];

export type BlackboardFilter = {
  source?: string;
  type?: BlackboardEntryType;
  since?: number;    // only entries after this timestamp
  key?: string;      // exact key match
};

// ── Event system ──

export type BlackboardEventType = 'entry_added' | 'cleared';

export interface BlackboardEvent {
  type: BlackboardEventType;
  entry?: BlackboardEntry;
  timestamp: number;
}

export type BlackboardListener = (event: BlackboardEvent) => void;

// ── Blackboard class ──

export class Blackboard {
  private entries: BlackboardEntry[] = [];
  private listeners: Map<BlackboardEventType, Set<BlackboardListener>> = new Map();
  private idCounter = 0;

  /** Post a new entry to the blackboard. */
  post(key: string, value: string, source: string, type: BlackboardEntryType): BlackboardEntry {
    const entry: BlackboardEntry = {
      id: `bb-${Date.now()}-${++this.idCounter}`,
      key,
      value,
      source,
      timestamp: Date.now(),
      type,
    };
    this.entries.push(entry);
    this.emit('entry_added', entry);
    return entry;
  }

  /** Read all entries, optionally filtered. */
  read(filter?: BlackboardFilter): BlackboardEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter(e => {
      if (filter.source && e.source !== filter.source) return false;
      if (filter.type && e.type !== filter.type) return false;
      if (filter.since && e.timestamp < filter.since) return false;
      if (filter.key && e.key !== filter.key) return false;
      return true;
    });
  }

  /** Read entries from a specific source (agent/worker). */
  readBySource(source: string): BlackboardEntry[] {
    return this.entries.filter(e => e.source === source);
  }

  /** Read entries of a specific type. */
  readByType(type: BlackboardEntryType): BlackboardEntry[] {
    return this.entries.filter(e => e.type === type);
  }

  /** Get the N most recent entries. */
  getLatest(n: number): BlackboardEntry[] {
    return this.entries.slice(-n);
  }

  /** Get total entry count. */
  get size(): number {
    return this.entries.length;
  }

  /** Clear all entries. */
  clear(): void {
    this.entries = [];
    this.idCounter = 0;
    const listeners = this.listeners.get('cleared');
    if (listeners) {
      const event: BlackboardEvent = { type: 'cleared', timestamp: Date.now() };
      for (const cb of listeners) {
        try { cb(event); } catch { /* listener error, ignore */ }
      }
    }
  }

  /**
   * Format blackboard contents for LLM context injection.
   * Groups by source, most recent entries first within each group.
   * Truncates to stay within a reasonable token budget.
   */
  toContext(maxChars: number = 4000): string {
    if (this.entries.length === 0) return '(blackboard empty)';

    // Group by source
    const bySource = new Map<string, BlackboardEntry[]>();
    for (const entry of this.entries) {
      const list = bySource.get(entry.source) || [];
      list.push(entry);
      bySource.set(entry.source, list);
    }

    const lines: string[] = [`BLACKBOARD (${this.entries.length} entries):`];
    let totalLen = lines[0].length;

    for (const [source, entries] of bySource) {
      const header = `\n[${source}]`;
      if (totalLen + header.length > maxChars) break;
      lines.push(header);
      totalLen += header.length;

      // Show most recent entries first
      const recent = entries.slice(-10).reverse();
      for (const e of recent) {
        const age = formatAge(e.timestamp);
        const line = `  ${e.type.toUpperCase()} "${e.key}": ${e.value.slice(0, 200)}${e.value.length > 200 ? '...' : ''} (${age})`;
        if (totalLen + line.length > maxChars) break;
        lines.push(line);
        totalLen += line.length;
      }
    }

    return lines.join('\n');
  }

  // ── Event system ──

  on(event: BlackboardEventType, callback: BlackboardListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: BlackboardEventType, callback: BlackboardListener): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(type: BlackboardEventType, entry?: BlackboardEntry): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    const event: BlackboardEvent = { type, entry, timestamp: Date.now() };
    for (const cb of listeners) {
      try { cb(event); } catch { /* listener error, ignore */ }
    }
  }
}

// ── Helpers ──

function formatAge(timestamp: number): string {
  const secs = Math.round((Date.now() - timestamp) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Singleton ──

export const blackboard = new Blackboard();
