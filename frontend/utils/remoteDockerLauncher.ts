import { INFRASTRUCTURE } from '../config/infrastructure';

export interface RemoteDockerStatus {
  isRunning: boolean;
  timestamp: number;
  error?: string;
}

/**
 * Check if Docker services are accessible via Tailscale
 */
export async function checkRemoteDockerHealth(): Promise<RemoteDockerStatus> {
  try {
    // Try to reach SearXNG config endpoint
    const response = await fetch(`${INFRASTRUCTURE.searxngUrl}/config`, {
      signal: AbortSignal.timeout(3000),
    });

    return {
      isRunning: response.ok,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      isRunning: false,
      timestamp: Date.now(),
      error: err instanceof Error ? err.message : 'Health check failed',
    };
  }
}

/**
 * Launch remote Docker on local PC via SSH
 * Requires SSH key stored in environment variable or function parameter
 */
export async function launchRemoteDocker(
  options?: {
    sshKey?: string;
    timeout?: number;
    skipHealthCheck?: boolean;
  }
): Promise<{ success: boolean; message: string; details?: string }> {
  const timeout = options?.timeout ?? 30000;

  try {
    // 1. Check if already running
    const health = await checkRemoteDockerHealth();
    if (health.isRunning) {
      return {
        success: true,
        message: 'Docker services already running on local PC',
      };
    }

    // 2. Send launch request to backend API
    const response = await fetch('/api/launch-docker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sshKey: options?.sshKey,
        skipHealthCheck: options?.skipHealthCheck ?? false,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to launch Docker: ${result.error || 'Unknown error'}`,
        details: result.details,
      };
    }

    // 3. Wait for services to become ready (up to 10 seconds)
    if (!options?.skipHealthCheck) {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const healthAfterLaunch = await checkRemoteDockerHealth();
        if (healthAfterLaunch.isRunning) {
          return {
            success: true,
            message: 'Docker services launched and ready',
          };
        }
      }

      // Services didn't come up but launch succeeded
      return {
        success: true,
        message:
          'Docker launch initiated (services may take a moment to start)',
        details: result.message,
      };
    }

    return {
      success: result.success ?? true,
      message: result.message || 'Docker launch initiated',
      details: result.details,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to launch Docker',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Auto-launch Docker if needed (called on app startup)
 */
export async function autoLaunchDockerIfNeeded(): Promise<boolean> {
  const health = await checkRemoteDockerHealth();

  if (health.isRunning) {
    console.log('✅ Docker already running on local PC');
    return true;
  }

  console.log('🔄 Attempting to auto-launch Docker...');
  const result = await launchRemoteDocker();

  if (result.success) {
    console.log('✅ Docker launched:', result.message);
    return true;
  } else {
    console.warn('⚠️ Auto-launch failed:', result.message);
    return false;
  }
}
