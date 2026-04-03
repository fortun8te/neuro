/**
 * CLI Health Check System
 * Validates service connectivity before running benchmarks
 * Tests: Ollama, Wayfarer, SearXNG
 */

import { INFRASTRUCTURE } from '../config/infrastructure';

export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  responseTime: number; // ms
  error?: string;
}

export interface HealthCheckResult {
  timestamp: number;
  mode: 'local' | 'remote';
  services: ServiceHealth[];
  allHealthy: boolean;
  summary: string;
}

/**
 * Check a single service endpoint
 */
async function checkService(name: string, url: string, timeout: number = 5000): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);
    const responseTime = Date.now() - startTime;

    return {
      name,
      url,
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTime,
      error: !response.ok ? `HTTP ${response.status}` : undefined,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    return {
      name,
      url,
      status: isTimeout ? 'timeout' : 'unhealthy',
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run full health check for all services
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const mode = INFRASTRUCTURE.getMode();

  const services = await Promise.all([
    checkService('Ollama', `${INFRASTRUCTURE.ollamaUrl}/api/tags`),
    checkService('Wayfarer', `${INFRASTRUCTURE.wayfarerUrl}/health`),
    checkService('SearXNG', `${INFRASTRUCTURE.searxngUrl}/healthz`),
  ]);

  const allHealthy = services.every((s) => s.status === 'healthy');

  const summary = allHealthy
    ? `✅ All services healthy (${mode} mode)`
    : `⚠️ ${services.filter((s) => s.status !== 'healthy').length} service(s) offline`;

  return {
    timestamp: Date.now(),
    mode,
    services,
    allHealthy,
    summary,
  };
}

/**
 * Pretty-print health check results
 */
export function printHealthCheck(result: HealthCheckResult): void {
  process.stdout.write(`\n  ┌─ Health Check ─────────────────────────────────────┐\n`);
  process.stdout.write(`  │  Mode: ${result.mode === 'local' ? 'Local' : 'Remote'}\n`);
  process.stdout.write(`  ├─────────────────────────────────────────────────────\n`);

  for (const service of result.services) {
    const icon =
      service.status === 'healthy'
        ? '✅'
        : service.status === 'timeout'
          ? '⏱️'
          : '❌';

    const status =
      service.status === 'healthy'
        ? 'OK'
        : service.status === 'timeout'
          ? 'TIMEOUT'
          : 'OFFLINE';

    const time = service.responseTime > 0 ? ` (${service.responseTime}ms)` : '';
    process.stdout.write(`  │  ${icon} ${service.name.padEnd(12)} ${status.padEnd(8)}${time}\n`);

    if (service.error) {
      const errorMsg = service.error.length > 40 ? service.error.substring(0, 40) + '...' : service.error;
      process.stdout.write(`  │     → ${errorMsg}\n`);
    }
  }

  const offlineServices = result.services.filter((s) => s.status !== 'healthy');
  if (offlineServices.length > 0) {
    process.stdout.write(`  ├─────────────────────────────────────────────────────\n`);
    process.stdout.write(`  │  ⚠️ Offline services (graceful degradation):\n`);
    for (const service of offlineServices) {
      process.stdout.write(`  │    • ${service.name}: ${service.url}\n`);
      if (service.status === 'timeout') {
        process.stdout.write(`  │      → Timeout: Check remote service is running\n`);
      } else {
        process.stdout.write(`  │      → Connection refused: Is remote Docker running?\n`);
      }
    }
  }

  process.stdout.write(`  ├─────────────────────────────────────────────────────\n`);
  process.stdout.write(`  │  ${result.summary}\n`);
  if (!result.allHealthy) {
    process.stdout.write(`  │  See README.md for remote setup instructions\n`);
  }
  process.stdout.write(`  └─────────────────────────────────────────────────────┘\n\n`);
}

/**
 * CLI entrypoint: Run health check
 */
export async function runHealthCheckCLI(): Promise<boolean> {
  const result = await healthCheck();
  printHealthCheck(result);
  return result.allHealthy;
}
