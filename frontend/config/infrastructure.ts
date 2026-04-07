import { getEnv } from './envLoader';

// SECURITY FIX: Input validation for infrastructure mode
export const VALID_MODES = ['local', 'remote'] as const;

/**
 * Validate that a mode value is one of the allowed modes.
 * Returns a safe default ('remote') if validation fails.
 */
export function validateInfrastructureMode(mode: unknown): 'local' | 'remote' {
  if (typeof mode === 'string' && VALID_MODES.includes(mode as any)) {
    return mode as 'local' | 'remote';
  }
  return 'remote'; // Safe default — never allow arbitrary modes
}

/**
 * Get infrastructure mode from env var, localStorage, or default
 * Priority: VITE_INFRASTRUCTURE_MODE env var > localStorage > 'local' (CLI/server-side default)
 * User can toggle between local and remote in Settings → Infrastructure
 * SECURITY: Validates mode against whitelist to prevent injection
 */
function getInfrastructureMode(): 'local' | 'remote' {
  // Check env var first (for CLI and server-side execution)
  const envMode = getEnv('VITE_INFRASTRUCTURE_MODE');
  if (envMode) {
    return validateInfrastructureMode(envMode);
  }

  // Check localStorage (browser environment)
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const rawMode = localStorage.getItem('neuro_infrastructure_mode');
      if (rawMode) {
        return validateInfrastructureMode(rawMode);
      }
    }
  } catch (e) {
    // localStorage may not be available (SSR, private mode, etc)
  }

  // Default to 'remote' for CLI/server-side, allowing env override
  // In browser without setting, falls back to what's in localStorage or 'remote'
  return 'remote';
}

/**
 * Get active Ollama URL based on infrastructure mode
 * - Local: localhost:11434 (user's machine)
 * - Remote: 100.74.135.83:11434 (remote server via Tailscale)
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

/**
 * Get active Wayfarer URL based on infrastructure mode
 * - Local: localhost:8889 (user's machine)
 * - Remote: 100.74.135.83:8889 (remote server via Tailscale)
 * Can be overridden with VITE_WAYFARER_URL env var
 */
function getWayfarerUrl(): string {
  const envUrl = getEnv('VITE_WAYFARER_URL');
  if (envUrl) return envUrl;

  const mode = getInfrastructureMode();
  if (mode === 'local') {
    return 'http://localhost:8889';
  } else {
    return 'http://100.74.135.83:8889';
  }
}

/**
 * Get active SearXNG URL based on infrastructure mode
 * - Local: localhost:8888 (user's machine)
 * - Remote: 100.74.135.83:8888 (remote server via Tailscale)
 * Can be overridden with VITE_SEARXNG_URL env var
 */
function getSearxngUrl(): string {
  const envUrl = getEnv('VITE_SEARXNG_URL');
  if (envUrl) return envUrl;

  const mode = getInfrastructureMode();
  if (mode === 'local') {
    return 'http://localhost:8888';
  } else {
    return 'http://100.74.135.83:8888';
  }
}

export const INFRASTRUCTURE = {
  get ollamaUrl() { return getOllamaUrl(); },
  get wayfarerUrl() { return getWayfarerUrl(); },
  get searxngUrl() { return getSearxngUrl(); },
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
