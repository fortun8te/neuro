import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TAILSCALE_IP = '100.74.135.83';
const REMOTE_USER = 'mk';
const REMOTE_PATH = '~/Downloads/nomads';
const SSH_TIMEOUT = 30000; // 30 seconds

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sshKey, skipHealthCheck } = req.body;

    // Get SSH key from environment or request body
    const key = sshKey || process.env.TAILSCALE_SSH_KEY;

    if (!key) {
      return res.status(400).json({
        error: 'Missing SSH key',
        details:
          'TAILSCALE_SSH_KEY not found in environment or request body',
      });
    }

    // Build SSH command with key provided via stdin to avoid file system issues
    // Using bash process substitution: ssh -i <(echo "$SSH_KEY")
    const sshCommand = `
      set -e
      ssh -i <(echo "$SSH_KEY") \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=10 \
        -o BatchMode=yes \
        ${REMOTE_USER}@${TAILSCALE_IP} \
        'cd ${REMOTE_PATH} && docker-compose up -d'
    `;

    const { stdout, stderr } = await execAsync(sshCommand, {
      env: { ...process.env, SSH_KEY: key },
      timeout: SSH_TIMEOUT,
      shell: '/bin/bash',
    });

    console.log('SSH output:', stdout);
    if (stderr) console.log('SSH stderr:', stderr);

    // If skipHealthCheck is false, wait a moment and verify
    if (!skipHealthCheck) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const response = await fetch(
          `http://${TAILSCALE_IP}:8888/config`,
          {
            signal: AbortSignal.timeout(5000),
          } as any
        );
        const isHealthy = response.ok;

        return res.status(isHealthy ? 200 : 202).json({
          success: isHealthy,
          message: isHealthy
            ? 'Docker services launched and verified'
            : 'Docker launch initiated (services may take a moment)',
          stdout,
          stderr: stderr || undefined,
        });
      } catch (healthErr) {
        // Health check failed but SSH succeeded, so launch is probably working
        return res.status(202).json({
          success: false, // Unverified
          message: 'Docker launch initiated (health check pending)',
          stdout,
          stderr: stderr || undefined,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Docker launch command executed',
      stdout,
      stderr: stderr || undefined,
    });
  } catch (err: any) {
    console.error('Docker launch error:', err);

    // Distinguish between SSH errors and execution errors
    let details = '';
    if (err.message.includes('command not found')) {
      details = 'docker-compose not found on remote system';
    } else if (err.message.includes('Connection refused')) {
      details = 'Cannot reach local PC via Tailscale (100.74.135.83)';
    } else if (err.message.includes('Permission denied')) {
      details = 'SSH authentication failed (check private key)';
    } else if (err.message.includes('timeout')) {
      details = 'Operation timed out after 30 seconds';
    } else {
      details = err.message || 'Unknown error';
    }

    return res.status(500).json({
      error: 'Failed to launch Docker',
      details,
      message: err.message,
    });
  }
}
