/**
 * storageBackend.ts -- Storage abstraction interface + local backend
 *
 * Provides a unified StorageBackend interface with a LocalBackend
 * implementation that wraps the existing shell-based file operations.
 * MinIO/S3 backend can be added later without changing consumers.
 */


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface StorageFile {
  name: string;
  size: number;
  sizeStr: string;
  modifiedAt?: string;
  isFolder?: boolean;
}

export interface StorageBackend {
  save(path: string, content: string): Promise<{ success: boolean; error?: string }>;
  saveBinary(path: string, data: ArrayBuffer | Uint8Array): Promise<{ success: boolean; error?: string }>;
  read(path: string, maxLines?: number): Promise<{ success: boolean; content: string; error?: string }>;
  list(prefix: string): Promise<{ success: boolean; files: StorageFile[]; error?: string }>;
  delete(path: string): Promise<{ success: boolean; error?: string }>;
  exists(path: string): Promise<boolean>;
  getUrl?(path: string): Promise<string | null>;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Expand ~ to $HOME for shell commands */
function shellPath(path: string): string {
  return path.replace(/^~/, '$HOME');
}

/** Shell exec helper -- matches the pattern from workspace.ts */
async function shellExec(command: string, timeout = 10000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const resp = await fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, timeout }),
    });
    if (!resp.ok) return { stdout: '', stderr: `Shell API returned ${resp.status}`, exitCode: 1 };
    return await resp.json();
  } catch (e) {
    return { stdout: '', stderr: e instanceof Error ? e.message : String(e), exitCode: 1 };
  }
}

// ─────────────────────────────────────────────────────────────
// LocalBackend -- wraps existing shell-based file operations
// ─────────────────────────────────────────────────────────────

class LocalBackend implements StorageBackend {

  async save(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    const sp = shellPath(path);

    // Ensure parent directory exists
    const dir = sp.substring(0, sp.lastIndexOf('/'));
    if (dir) {
      await shellExec(`mkdir -p "${dir}"`, 5000);
    }

    // Try file write API first
    try {
      const resp = await fetch('/api/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      if (resp.ok) return { success: true };
    } catch { /* fall through to shell */ }

    // Fallback: shell heredoc write
    const escaped = content.replace(/'/g, "'\\''");
    const result = await shellExec(
      `cat > "${sp}" << 'STORAGE_EOF'\n${escaped}\nSTORAGE_EOF`,
      15000,
    );

    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || 'Write failed' };
    }
    return { success: true };
  }

  async saveBinary(path: string, data: ArrayBuffer | Uint8Array): Promise<{ success: boolean; error?: string }> {
    const sp = shellPath(path);

    // Ensure parent directory exists
    const dir = sp.substring(0, sp.lastIndexOf('/'));
    if (dir) {
      await shellExec(`mkdir -p "${dir}"`, 5000);
    }

    // Convert to base64 and write via shell
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const result = await shellExec(
      `echo "${base64}" | base64 -d > "${sp}"`,
      30000,
    );

    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || 'Binary write failed' };
    }
    return { success: true };
  }

  async read(path: string, maxLines?: number): Promise<{ success: boolean; content: string; error?: string }> {
    // Try file read API first
    try {
      const resp = await fetch('/api/file/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, maxLines: maxLines || 500 }),
      });
      if (resp.ok) {
        const result = await resp.json();
        return { success: true, content: result.content || '' };
      }
    } catch { /* fall through to shell */ }

    // Fallback: shell cat
    const sp = shellPath(path);
    const cmd = maxLines
      ? `head -n ${maxLines} "${sp}"`
      : `cat "${sp}"`;

    const result = await shellExec(cmd);
    if (result.exitCode !== 0) {
      return { success: false, content: '', error: result.stderr || 'Read failed' };
    }
    return { success: true, content: result.stdout || '' };
  }

  async list(prefix: string): Promise<{ success: boolean; files: StorageFile[]; error?: string }> {
    const sp = shellPath(prefix);

    // Use find + stat to get files and top-level dirs with metadata
    const cmd = `{ find "${sp}" -maxdepth 1 -type f -exec stat -f '%m %z %N' {} + 2>/dev/null; find "${sp}" -mindepth 1 -maxdepth 1 -type d -exec stat -f '%m 0 %N' {} + 2>/dev/null; } | sort -rn 2>/dev/null`;
    const result = await shellExec(cmd);

    if (result.exitCode !== 0 || !result.stdout?.trim()) {
      // Directory may not exist -- not an error per se
      return { success: true, files: [] };
    }

    const files: StorageFile[] = [];
    for (const line of result.stdout.trim().split('\n')) {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (match) {
        const epoch = parseInt(match[1]) * 1000;
        const size = parseInt(match[2]) || 0;
        const fullPath = match[3];
        // Strip prefix to get relative name
        const name = fullPath.startsWith(sp.replace('$HOME', ''))
          ? fullPath.substring(sp.replace('$HOME', '').length).replace(/^\//, '')
          : fullPath.substring(fullPath.lastIndexOf('/') + 1);
        const isFolder = size === 0 && !name.includes('/');
        files.push({
          name: name || fullPath.substring(fullPath.lastIndexOf('/') + 1),
          size,
          sizeStr: isFolder ? '' : formatBytes(size),
          modifiedAt: new Date(epoch).toISOString(),
          isFolder,
        });
      }
    }

    return { success: true, files };
  }

  async delete(path: string): Promise<{ success: boolean; error?: string }> {
    // Try file delete API first
    try {
      const resp = await fetch('/api/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (resp.ok) return { success: true };
    } catch { /* fall through to shell */ }

    // Fallback: shell rm
    const sp = shellPath(path);
    const result = await shellExec(`rm -f "${sp}"`, 5000);
    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || 'Delete failed' };
    }
    return { success: true };
  }

  async exists(path: string): Promise<boolean> {
    const sp = shellPath(path);
    const result = await shellExec(`test -e "${sp}" && echo "yes" || echo "no"`, 5000);
    return result.stdout?.trim() === 'yes';
  }

  async getUrl(path: string): Promise<string | null> {
    // Local backend has no URL serving -- return null
    // Future MinIO backend would return a presigned URL here
    void path;
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────

let _instance: StorageBackend | null = null;

/**
 * Get the storage backend singleton.
 * Currently returns LocalBackend. MinIO backend will be added later.
 */
export function getStorageBackend(): StorageBackend {
  if (!_instance) {
    _instance = new LocalBackend();
  }
  return _instance;
}
