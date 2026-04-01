import { getEnv } from './envLoader';

/**
 * Get infrastructure mode from localStorage, with fallback to 'remote'
 * User can toggle between local and remote in Settings → Infrastructure
 */
function getInfrastructureMode(): 'local' | 'remote' {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const mode = localStorage.getItem('neuro_infrastructure_mode') as 'local' | 'remote' | null;
      return mode || 'remote';
    }
  } catch (e) {
    // localStorage may not be available (SSR, private mode, etc)
  }
  return 'remote';
}

/**
 * Get active Ollama URL based on infrastructure mode
 * - Local: localhost:11434 (user's machine)
 * - Remote: 100.74.135.83:11440 (Michael's PC via Tailscale)
 * Can be overridden with VITE_OLLAMA_URL env var
 */
function getOllamaUrl(): string {
  const envUrl = getEnv('VITE_OLLAMA_URL');
  if (envUrl) return envUrl;

  const mode = getInfrastructureMode();
  if (mode === 'local') {
    return 'http://localhost:11434';
  } else {
    return 'http://100.74.135.83:11434';
  }
}

export const INFRASTRUCTURE = {
  get ollamaUrl() { return getOllamaUrl(); },
  get wayfarerUrl() { return getEnv('VITE_WAYFARER_URL', 'http://localhost:8889'); },
  get searxngUrl() { return getEnv('VITE_SEARXNG_URL', 'http://localhost:8888'); },
  // Context-1 is served via the main Ollama instance (chromadb-context-1:latest)
  // This URL is only needed if running a separate harness server (optional/legacy)
  context1Url: getEnv('VITE_CONTEXT1_URL', ''),
  context1Model: 'chromadb-context-1:latest',
  // SearXNG: 8 instances (4 base + 4 autocalled), zero rate limiting
  // Throughput: ~59 searches/min, ~9.2s avg per search
  searxngConcurrency: parseInt(getEnv('VITE_SEARXNG_CONCURRENCY', '32'), 10),
  searxngInstances: parseInt(getEnv('VITE_SEARXNG_INSTANCES', '8'), 10),
  // Wayfarer page fetch concurrency (headless browser instances)
  wayfarerConcurrency: parseInt(getEnv('VITE_WAYFARER_CONCURRENCY', '20'), 10),
  // Helper to get current infrastructure mode
  getMode: getInfrastructureMode,
};

export type InfrastructureHealth = {
  ollama: boolean;
  wayfarer: boolean;
  searxng: boolean;
  context1: boolean;
};

export async function checkInfrastructure(): Promise<InfrastructureHealth> {
  const check = async (url: string) => {
    try { return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok; }
    catch { return false; }
  };
  const [ollama, wayfarer, searxng, context1] = await Promise.all([
    check(`${INFRASTRUCTURE.ollamaUrl}/api/tags`),
    check(`${INFRASTRUCTURE.wayfarerUrl}/health`),
    check(`${INFRASTRUCTURE.searxngUrl}/healthz`),
    check(`${INFRASTRUCTURE.ollamaUrl}/api/tags`),
  ]);
  return { ollama, wayfarer, searxng, context1 };
}
