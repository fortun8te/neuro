export const INFRASTRUCTURE = {
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL || 'http://100.74.135.83:11440',
  wayfarerUrl: import.meta.env.VITE_WAYFARER_URL || 'http://localhost:8889',
  searxngUrl: import.meta.env.VITE_SEARXNG_URL || 'http://localhost:8888',
};

export type InfrastructureHealth = { ollama: boolean; wayfarer: boolean; searxng: boolean };

export async function checkInfrastructure(): Promise<InfrastructureHealth> {
  const check = async (url: string) => {
    try { return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok; }
    catch { return false; }
  };
  const [ollama, wayfarer, searxng] = await Promise.all([
    check(`${INFRASTRUCTURE.ollamaUrl}/api/tags`),
    check(`${INFRASTRUCTURE.wayfarerUrl}/health`),
    check(`${INFRASTRUCTURE.searxngUrl}/healthz`),
  ]);
  return { ollama, wayfarer, searxng };
}
