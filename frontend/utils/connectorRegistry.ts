/**
 * Connector Registry — Manages all Neuro integrations
 *
 * Stores connector state in localStorage for now.
 * Will migrate to account-level storage when auth is ready.
 */

import type { Connector, ConnectorConfig, ConnectorHealthResult, ConnectorStatus } from '../types/connector';
import { INFRASTRUCTURE } from '../config/infrastructure';

const STORAGE_KEY = 'neuro_connectors';

// ─── Built-in connectors ──────────────────────────────────────────────────────

const BUILT_IN_CONNECTORS: Connector[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local/remote LLM inference server',
    icon: '🧠',
    category: 'compute',
    status: 'available',
    authType: 'url',
    config: { url: INFRASTRUCTURE.ollamaUrl },
    builtIn: true,
    healthUrl: `${INFRASTRUCTURE.ollamaUrl}/api/tags`,
  },
  {
    id: 'searxng',
    name: 'SearXNG',
    description: 'Privacy-respecting meta search engine',
    icon: '🔍',
    category: 'search',
    status: 'available',
    authType: 'url',
    config: { url: INFRASTRUCTURE.searxngUrl },
    builtIn: true,
    healthUrl: `${INFRASTRUCTURE.searxngUrl}/healthz`,
  },
  {
    id: 'wayfarer',
    name: 'Wayfarer',
    description: 'Web scraping and page analysis service',
    icon: '🌐',
    category: 'search',
    status: 'available',
    authType: 'url',
    config: { url: INFRASTRUCTURE.wayfarerUrl },
    builtIn: true,
    healthUrl: `${INFRASTRUCTURE.wayfarerUrl}/health`,
  },
  {
    id: 'context1',
    name: 'Context-1',
    description: 'Chroma retrieval subagent (20B, 4-tool harness)',
    icon: '📚',
    category: 'retrieval',
    status: 'available',
    authType: 'none',
    config: { model: 'chromadb-context-1:latest' },
    builtIn: true,
  },
  {
    id: 'freepik',
    name: 'Freepik',
    description: 'Stock photos and creative assets',
    icon: '🎨',
    category: 'creative',
    status: 'available',
    authType: 'api_key',
    config: {},
    builtIn: true,
  },
];

// ─── Future connectors (stubs) ────────────────────────────────────────────────

const FUTURE_CONNECTORS: Connector[] = [
  { id: 'google_drive', name: 'Google Drive', description: 'Cloud file storage and collaboration', icon: '📁', category: 'storage', status: 'available', authType: 'oauth', config: {}, },
  { id: 'notion', name: 'Notion', description: 'Notes, docs, and knowledge base', icon: '📝', category: 'storage', status: 'available', authType: 'oauth', config: {}, },
  { id: 'slack', name: 'Slack', description: 'Team messaging and communication', icon: '💬', category: 'communication', status: 'available', authType: 'oauth', config: {}, },
  { id: 'github', name: 'GitHub', description: 'Code repositories and issues', icon: '🐙', category: 'storage', status: 'available', authType: 'oauth', config: {}, },
  { id: 'figma', name: 'Figma', description: 'Design files and prototypes', icon: '🎨', category: 'creative', status: 'available', authType: 'oauth', config: {}, },
  { id: 'linear', name: 'Linear', description: 'Project management and issue tracking', icon: '📋', category: 'analytics', status: 'available', authType: 'oauth', config: {}, },
  { id: 'gmail', name: 'Gmail', description: 'Email reading and sending', icon: '📧', category: 'communication', status: 'available', authType: 'oauth', config: {}, },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

function loadFromStorage(): Record<string, Partial<Connector>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(overrides: Record<string, Partial<Connector>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch { /* storage full — ignore */ }
}

export const connectorRegistry = {
  /** Get all connectors (built-in + future), merged with stored config */
  getAll(): Connector[] {
    const stored = loadFromStorage();
    return [...BUILT_IN_CONNECTORS, ...FUTURE_CONNECTORS].map(c => ({
      ...c,
      ...stored[c.id],
      config: { ...c.config, ...(stored[c.id]?.config || {}) },
    }));
  },

  /** Get only connected connectors */
  getConnected(): Connector[] {
    return this.getAll().filter(c => c.status === 'connected');
  },

  /** Get a single connector by ID */
  get(id: string): Connector | undefined {
    return this.getAll().find(c => c.id === id);
  },

  /** Update a connector's config and/or status */
  update(id: string, updates: { config?: ConnectorConfig; status?: ConnectorStatus }) {
    const stored = loadFromStorage();
    stored[id] = { ...stored[id], ...updates };
    if (updates.config) {
      stored[id].config = { ...(stored[id].config || {}), ...updates.config };
    }
    saveToStorage(stored);
  },

  /** Connect a connector (set status + config) */
  connect(id: string, config: ConnectorConfig) {
    this.update(id, { config, status: 'connected' });
  },

  /** Disconnect a connector */
  disconnect(id: string) {
    this.update(id, { status: 'available' });
  },

  /** Health check a single connector */
  async healthCheck(id: string): Promise<ConnectorHealthResult> {
    const connector = this.get(id);
    if (!connector) return { connectorId: id, status: 'error', latencyMs: 0, error: 'Not found' };
    if (!connector.healthUrl) return { connectorId: id, status: connector.status, latencyMs: 0 };

    const start = Date.now();
    try {
      const res = await fetch(connector.healthUrl, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - start;
      const status: ConnectorStatus = res.ok ? 'connected' : 'error';
      this.update(id, { status });
      return { connectorId: id, status, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      this.update(id, { status: 'error' });
      return { connectorId: id, status: 'error', latencyMs, error: err instanceof Error ? err.message : 'Unknown' };
    }
  },

  /** Health check all connectors with health URLs */
  async healthCheckAll(): Promise<ConnectorHealthResult[]> {
    const all = this.getAll().filter(c => c.healthUrl);
    return Promise.all(all.map(c => this.healthCheck(c.id)));
  },
};
