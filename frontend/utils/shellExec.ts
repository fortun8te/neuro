/**
 * Shell Execution Service
 * Handles filesystem operations via shell commands
 *
 * Note: This requires a backend service endpoint that can execute shell commands
 * For development: use http://localhost:3001 (Node.js backend)
 * For production: use proper IPC or Electron integration
 */

const SHELL_EXEC_ENDPOINT = import.meta.env.VITE_SHELL_EXEC_URL || 'http://localhost:3001';

export interface ShellExecResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  code?: number;
  error?: string;
}

/**
 * Execute a shell command via backend service
 */
export async function shellExec(command: string): Promise<ShellExecResult> {
  try {
    const response = await fetch(`${SHELL_EXEC_ENDPOINT}/api/shell-exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create directory structure
 */
export async function mkdir(path: string): Promise<ShellExecResult> {
  return shellExec(`mkdir -p "${path}"`);
}

/**
 * Read file content
 */
export async function cat(path: string): Promise<ShellExecResult> {
  return shellExec(`cat "${path}"`);
}

/**
 * Write content to file
 */
export async function writeFile(path: string, content: string): Promise<ShellExecResult> {
  // Escape quotes in content
  const escapedContent = content.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return shellExec(`echo -e "${escapedContent}" > "${path}"`);
}

/**
 * Delete file
 */
export async function rm(path: string): Promise<ShellExecResult> {
  return shellExec(`rm -f "${path}"`);
}

/**
 * List directory contents with metadata
 */
export async function ls(dirPath: string): Promise<ShellExecResult> {
  return shellExec(`ls -lah "${dirPath}"`);
}

/**
 * Get file metadata (mtime, size)
 */
export async function stat(path: string): Promise<ShellExecResult> {
  return shellExec(`stat -f "%z %m" "${path}" 2>/dev/null || stat -c "%s %Y" "${path}"`);
}

/**
 * Calculate file checksum (MD5)
 */
export async function md5(path: string): Promise<ShellExecResult> {
  return shellExec(`md5 < "${path}" 2>/dev/null || md5sum "${path}"`);
}

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  const result = await shellExec(`test -f "${path}" && echo "yes" || echo "no"`);
  return result.stdout?.trim() === 'yes';
}

/**
 * Parse ls output into file metadata
 * Handles both macOS and Linux formats
 */
export function parseLsOutput(lsOutput: string): Array<{
  name: string;
  size: number;
  mtime: number;
  isFile: boolean;
}> {
  const files = [];

  const lines = lsOutput.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    // Format: -rw-r--r-- 1 user staff 12345 Mar 31 10:30 filename
    const isFile = parts[0].startsWith('-');
    const size = parseInt(parts[4], 10);
    const name = parts.slice(8).join(' ');

    // Parse date (simplified - use file mtime from stat instead for accuracy)
    files.push({
      name,
      size,
      mtime: Date.now(), // Will be overridden by stat call
      isFile,
    });
  }

  return files;
}
