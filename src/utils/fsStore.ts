/**
 * fsStore — reactive filesystem store for FinderWindow
 * Uses useSyncExternalStore pattern (no new packages).
 *
 * Map<path, FSNode[]> where path is like '/session', '/session/screenshots'
 */

import { useSyncExternalStore } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type FSTag = 'session' | 'memory' | 'export';

export interface FSNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  extension?: string;
  size?: string;
  modified: string;
  tag?: FSTag;
}

// ── Initial data (mirrors the old FS const) ──────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const INITIAL_DATA: [string, FSNode[]][] = [
  ['/session', [
    { id: makeId(), name: 'screenshots',       type: 'folder', modified: 'just now', tag: 'session' },
    { id: makeId(), name: 'browser_artifacts', type: 'folder', modified: '2m ago',   tag: 'session' },
    { id: makeId(), name: 'page_cache',        type: 'folder', modified: '5m ago',   tag: 'session' },
    { id: makeId(), name: 'clipboard.txt',     type: 'file', extension: 'txt', size: '2 KB',   modified: '1m ago' },
    { id: makeId(), name: 'session_log.json',  type: 'file', extension: 'json', size: '14 KB', modified: 'just now' },
  ]],
  ['/session/screenshots', [
    { id: makeId(), name: 'screen_001.png', type: 'file', extension: 'png', size: '1.2 MB', modified: '3m ago' },
    { id: makeId(), name: 'screen_002.png', type: 'file', extension: 'png', size: '980 KB', modified: '2m ago' },
  ]],
  ['/session/browser_artifacts', [
    { id: makeId(), name: 'dom_snapshot.html', type: 'file', extension: 'html', size: '48 KB',  modified: '4m ago' },
    { id: makeId(), name: 'network_log.json',  type: 'file', extension: 'json', size: '220 KB', modified: '5m ago' },
  ]],
  ['/memory', [
    { id: makeId(), name: 'research',            type: 'folder', modified: 'today', tag: 'memory' },
    { id: makeId(), name: 'summaries',           type: 'folder', modified: 'today', tag: 'memory' },
    { id: makeId(), name: 'brand_dna.json',      type: 'file', extension: 'json', size: '8 KB',  modified: 'today' },
    { id: makeId(), name: 'audience_insights.md',type: 'file', extension: 'md',   size: '22 KB', modified: 'yesterday' },
    { id: makeId(), name: 'competitor_map.json', type: 'file', extension: 'json', size: '36 KB', modified: '2 days ago' },
  ]],
  ['/memory/research', [
    { id: makeId(), name: 'market_analysis.md',   type: 'file', extension: 'md',   size: '44 KB',  modified: 'today' },
    { id: makeId(), name: 'customer_desires.json',type: 'file', extension: 'json', size: '18 KB',  modified: 'today' },
    { id: makeId(), name: 'objections.md',        type: 'file', extension: 'md',   size: '12 KB',  modified: 'yesterday' },
    { id: makeId(), name: 'raw_sources.json',     type: 'file', extension: 'json', size: '140 KB', modified: 'today' },
  ]],
  ['/memory/summaries', [
    { id: makeId(), name: 'cycle_1_summary.md', type: 'file', extension: 'md', size: '6 KB', modified: 'yesterday' },
    { id: makeId(), name: 'what_worked.md',     type: 'file', extension: 'md', size: '4 KB', modified: 'yesterday' },
  ]],
  ['/exports', [
    { id: makeId(), name: 'ad_concepts',        type: 'folder', modified: 'today',     tag: 'export' },
    { id: makeId(), name: 'briefs',             type: 'folder', modified: 'yesterday', tag: 'export' },
    { id: makeId(), name: 'campaign_v1.pdf',    type: 'file', extension: 'pdf', size: '3.2 MB', modified: 'today' },
    { id: makeId(), name: 'creative_board.png', type: 'file', extension: 'png', size: '8.4 MB', modified: 'today' },
  ]],
  ['/exports/ad_concepts', [
    { id: makeId(), name: 'concept_desire.md',    type: 'file', extension: 'md', size: '3 KB',   modified: 'today' },
    { id: makeId(), name: 'concept_objection.md', type: 'file', extension: 'md', size: '2.8 KB', modified: 'today' },
    { id: makeId(), name: 'concept_social.md',    type: 'file', extension: 'md', size: '3.1 KB', modified: 'today' },
  ]],
  ['/exports/briefs', [
    { id: makeId(), name: 'research_brief.pdf', type: 'file', extension: 'pdf', size: '1.8 MB', modified: 'yesterday' },
    { id: makeId(), name: 'creative_brief.pdf', type: 'file', extension: 'pdf', size: '2.1 MB', modified: 'today' },
  ]],
];

// ── Store internals ──────────────────────────────────────────────────────────

type Listener = () => void;
type StoreMap = Map<string, FSNode[]>;

let state: StoreMap = new Map(INITIAL_DATA);
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreMap {
  return state;
}

// ── Mutations ────────────────────────────────────────────────────────────────

function pathKey(path: string[]): string {
  return '/' + path.join('/');
}

export function getItems(path: string[]): FSNode[] {
  return state.get(pathKey(path)) ?? [];
}

export function addItem(path: string[], node: FSNode): void {
  const key = pathKey(path);
  const existing = state.get(key) ?? [];
  state = new Map(state);
  state.set(key, [...existing, node]);
  notify();
}

export function removeItem(path: string[], id: string): void {
  const key = pathKey(path);
  const existing = state.get(key) ?? [];
  state = new Map(state);
  state.set(key, existing.filter(n => n.id !== id));
  notify();
}

export function renameItem(path: string[], id: string, newName: string): void {
  const key = pathKey(path);
  const existing = state.get(key) ?? [];
  // Derive extension from new name
  const ext = newName.includes('.') ? newName.split('.').pop() : undefined;
  state = new Map(state);
  state.set(key, existing.map(n =>
    n.id === id
      ? { ...n, name: newName, ...(n.type === 'file' ? { extension: ext } : {}), modified: 'just now' }
      : n
  ));
  notify();
}

export function createFolder(path: string[], name: string): FSNode {
  const node: FSNode = {
    id: makeId(),
    name,
    type: 'folder',
    modified: 'just now',
  };
  addItem(path, node);
  return node;
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Returns the full store map and re-renders whenever it changes.
 * Components that only need items for a specific path can call
 * `getItems(path)` on the returned map or use the exported `getItems` fn.
 */
export function useFSStore(): StoreMap {
  return useSyncExternalStore(subscribe, getSnapshot);
}
