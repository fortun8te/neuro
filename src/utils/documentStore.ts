/**
 * documentStore — Persistent document storage (localStorage-backed)
 *
 * Stores agent-generated documents (plans, write output, research summaries).
 * Follows the same pattern as memoryStore: useSyncExternalStore-based React hook.
 */

import { useSyncExternalStore } from 'react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AgentDocument {
  id: string;
  title: string;
  content: string;      // full text (markdown-like)
  type: 'doc' | 'plan' | 'research';
  createdAt: number;    // Unix ms
}

// ─────────────────────────────────────────────────────────────
// Internal store
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nomad_agent_documents';

type Listener = () => void;
const _listeners = new Set<Listener>();
let _cache: AgentDocument[] | null = null;

function notify() {
  _cache = null;
  for (const cb of _listeners) {
    try { cb(); } catch { /* ignore */ }
  }
}

/** Validate that a parsed object has the minimum required AgentDocument fields. */
function isValidDocument(d: unknown): d is AgentDocument {
  if (!d || typeof d !== 'object') return false;
  const doc = d as Record<string, unknown>;
  return (
    typeof doc.id === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.content === 'string' &&
    typeof doc.createdAt === 'number' &&
    // Bug fix #12: 'type' field was added later — coerce missing/invalid values
    // to 'doc' so old records don't produce undefined types in consumers.
    (doc.type === 'doc' || doc.type === 'plan' || doc.type === 'research' || doc.type == null)
  );
}

function loadAll(): AgentDocument[] {
  if (_cache !== null) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _cache = [];
    } else {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        _cache = [];
      } else {
        // Bug fix #12: filter out malformed entries and coerce missing 'type' to 'doc'
        _cache = parsed
          .filter(isValidDocument)
          .map(d => ({ ...d, type: d.type ?? 'doc' } as AgentDocument));
      }
    }
  } catch {
    _cache = [];
  }
  return _cache;
}

function saveAll(docs: AgentDocument[]): void {
  try {
    _cache = docs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    notify();
  } catch {
    console.warn('[documentStore] Failed to persist documents');
  }
}

function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function addDocument(
  params: Omit<AgentDocument, 'id' | 'createdAt'>
): AgentDocument {
  const doc: AgentDocument = {
    id: generateId(),
    ...params,
    createdAt: Date.now(),
  };
  const docs = loadAll();
  docs.unshift(doc);
  saveAll(docs);
  return doc;
}

export function getDocuments(): AgentDocument[] {
  return loadAll();
}

export function deleteDocument(id: string): void {
  saveAll(loadAll().filter(d => d.id !== id));
}

// ─────────────────────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────────────────────

function subscribe(cb: Listener): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

export function useDocuments(): AgentDocument[] {
  return useSyncExternalStore(subscribe, loadAll, () => []);
}
