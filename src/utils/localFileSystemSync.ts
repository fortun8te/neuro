/**
 * Local Filesystem Sync — Bidirectional sync between VFS and ~/Neuro/Documents/
 *
 * Handles:
 * - Watch ~/Neuro/Documents/ for changes
 * - Sync files to IndexedDB VFS
 * - Sync VFS documents to local disk
 * - File metadata tracking (timestamps, checksums)
 * - Directory structure: Canvas/, Research/, Workspace/
 *
 * Note: Requires backend service at VITE_SHELL_EXEC_URL for filesystem operations
 */

import * as shell from './shellExec';

export interface LocalFileMetadata {
  path: string;
  filename: string;
  category: 'Canvas' | 'Research' | 'Workspace';
  mtime: number;
  size: number;
  checksum?: string;
}

export interface SyncEvent {
  type: 'file_added' | 'file_modified' | 'file_deleted';
  path: string;
  metadata?: LocalFileMetadata;
}

export class LocalFileSystemSync {
  private baseDir = `${process.env.HOME}/Neuro/Documents`;
  private categories = ['Canvas', 'Research', 'Workspace'];
  private watchIntervalId?: NodeJS.Timeout;
  private lastFileHashes: Map<string, string> = new Map();
  private onSyncEvent?: (event: SyncEvent) => Promise<void>;

  /**
   * Initialize local filesystem structure
   */
  async initialize(): Promise<void> {
    console.log(`[LocalFS] Initializing directories under ${this.baseDir}`);

    try {
      // Create base directory
      await shell.mkdir(this.baseDir);

      // Create category subdirectories
      for (const cat of this.categories) {
        const dirPath = `${this.baseDir}/${cat}`;
        const result = await shell.mkdir(dirPath);
        if (result.success) {
          console.log(`[LocalFS] Ensured directory: ${dirPath}`);
        } else {
          console.error(`[LocalFS] Failed to create directory: ${dirPath}`, result.error);
        }
      }
    } catch (error) {
      console.error('[LocalFS] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Scan local filesystem for changes
   */
  async scanForChanges(): Promise<SyncEvent[]> {
    const events: SyncEvent[] = [];

    try {
      for (const cat of this.categories) {
        const dirPath = `${this.baseDir}/${cat}`;
        const lsResult = await shell.ls(dirPath);

        if (!lsResult.success || !lsResult.stdout) {
          console.warn(`[LocalFS] Failed to list directory: ${dirPath}`, lsResult.error);
          continue;
        }

        // Parse ls output
        const files = shell.parseLsOutput(lsResult.stdout);

        for (const file of files) {
          const filePath = `${dirPath}/${file.name}`;

          // Get current checksum
          const checksumResult = await shell.md5(filePath);
          const currentChecksum = checksumResult.stdout?.trim() || 'unknown';

          const previousChecksum = this.lastFileHashes.get(filePath);

          if (!previousChecksum) {
            // File is new
            events.push({
              type: 'file_added',
              path: filePath,
              metadata: {
                path: filePath,
                filename: file.name,
                category: cat as any,
                mtime: file.mtime,
                size: file.size,
                checksum: currentChecksum,
              },
            });
            this.lastFileHashes.set(filePath, currentChecksum);
          } else if (previousChecksum !== currentChecksum) {
            // File was modified
            events.push({
              type: 'file_modified',
              path: filePath,
              metadata: {
                path: filePath,
                filename: file.name,
                category: cat as any,
                mtime: file.mtime,
                size: file.size,
                checksum: currentChecksum,
              },
            });
            this.lastFileHashes.set(filePath, currentChecksum);
          }
        }

        // Check for deleted files
        for (const [trackedPath, _] of this.lastFileHashes) {
          if (trackedPath.startsWith(dirPath) && !files.some(f => `${dirPath}/${f.name}` === trackedPath)) {
            events.push({
              type: 'file_deleted',
              path: trackedPath,
            });
            this.lastFileHashes.delete(trackedPath);
          }
        }
      }
    } catch (error) {
      console.error('[LocalFS] Scan error:', error);
    }

    return events;
  }

  /**
   * Start watching filesystem for changes
   */
  startWatching(
    intervalMs: number = 5000,
    onEvent?: (event: SyncEvent) => Promise<void>,
  ): void {
    this.onSyncEvent = onEvent;
    console.log(`[LocalFS] Starting watch every ${intervalMs}ms`);

    this.watchIntervalId = setInterval(() => {
      this.scanForChanges()
        .then(events => {
          for (const event of events) {
            this.onSyncEvent?.(event).catch(err => {
              console.error('[LocalFS] Sync event handler error:', err);
            });
          }
        })
        .catch(error => {
          console.error('[LocalFS] Scan error:', error);
        });
    }, intervalMs);
  }

  /**
   * Stop watching filesystem
   */
  stopWatching(): void {
    if (this.watchIntervalId) {
      clearInterval(this.watchIntervalId);
      this.watchIntervalId = undefined;
      console.log('[LocalFS] Watch stopped');
    }
  }

  /**
   * Write document to local disk
   */
  async writeDocumentToDisk(
    filename: string,
    content: string | Blob,
    category: 'Canvas' | 'Research' | 'Workspace',
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const filePath = `${this.baseDir}/${category}/${filename}`;
      console.log(`[LocalFS] Writing to disk: ${filePath}`);

      // Convert Blob to string if needed
      let contentStr = content instanceof Blob ? await content.text() : content;

      // Write to disk via shell
      const result = await shell.writeFile(filePath, contentStr);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Calculate and store checksum
      const checksumResult = await shell.md5(filePath);
      const checksum = checksumResult.stdout?.trim() || 'unknown';
      this.lastFileHashes.set(filePath, checksum);

      console.log(`[LocalFS] Successfully wrote: ${filePath}`);
      return { success: true, path: filePath };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Read document from disk
   */
  async readDocumentFromDisk(
    path: string,
  ): Promise<{ content: string | Blob; metadata: LocalFileMetadata } | null> {
    try {
      console.log(`[LocalFS] Reading from disk: ${path}`);

      // Read file content
      const catResult = await shell.cat(path);
      if (!catResult.success || catResult.stdout === undefined) {
        console.error(`[LocalFS] Failed to read file: ${path}`, catResult.error);
        return null;
      }

      // Get file metadata
      const statResult = await shell.stat(path);
      let mtime = Date.now();
      let size = catResult.stdout?.length || 0;

      if (statResult.success && statResult.stdout) {
        const parts = statResult.stdout.split(/\s+/);
        if (parts.length >= 2) {
          size = parseInt(parts[0], 10) || size;
          mtime = parseInt(parts[1], 10) * 1000 || Date.now(); // Convert seconds to ms
        }
      }

      // Parse category from path
      const category = path.includes('/Canvas/')
        ? ('Canvas' as const)
        : path.includes('/Research/')
          ? ('Research' as const)
          : ('Workspace' as const);

      const filename = path.split('/').pop() || 'unknown';

      // Calculate checksum
      const checksumResult = await shell.md5(path);
      const checksum = checksumResult.stdout?.trim();

      return {
        content: catResult.stdout,
        metadata: {
          path,
          filename,
          category,
          mtime,
          size,
          checksum,
        },
      };
    } catch (error) {
      console.error('[LocalFS] Read error:', error);
      return null;
    }
  }

  /**
   * Delete document from disk
   */
  async deleteDocumentFromDisk(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[LocalFS] Deleting from disk: ${path}`);

      const result = await shell.rm(path);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      this.lastFileHashes.delete(path);
      console.log(`[LocalFS] Successfully deleted: ${path}`);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<LocalFileMetadata | null> {
    try {
      // Get file stats
      const statResult = await shell.stat(path);
      if (!statResult.success || !statResult.stdout) {
        return null;
      }

      const parts = statResult.stdout.split(/\s+/);
      const size = parseInt(parts[0], 10) || 0;
      const mtimeSeconds = parseInt(parts[1], 10) || Math.floor(Date.now() / 1000);
      const mtime = mtimeSeconds * 1000; // Convert to milliseconds

      // Parse category
      const category = path.includes('/Canvas/')
        ? ('Canvas' as const)
        : path.includes('/Research/')
          ? ('Research' as const)
          : ('Workspace' as const);

      const filename = path.split('/').pop() || 'unknown';

      // Get checksum
      const checksumResult = await shell.md5(path);
      const checksum = checksumResult.stdout?.trim();

      return {
        path,
        filename,
        category,
        mtime,
        size,
        checksum,
      };
    } catch {
      return null;
    }
  }

  /**
   * List all files in category
   */
  async listFiles(category: 'Canvas' | 'Research' | 'Workspace'): Promise<LocalFileMetadata[]> {
    const files: LocalFileMetadata[] = [];

    try {
      const dirPath = `${this.baseDir}/${category}`;
      const lsResult = await shell.ls(dirPath);

      if (!lsResult.success || !lsResult.stdout) {
        console.warn(`[LocalFS] Failed to list directory: ${dirPath}`, lsResult.error);
        return files;
      }

      // Parse ls output
      const parsedFiles = shell.parseLsOutput(lsResult.stdout);

      for (const file of parsedFiles) {
        const filePath = `${dirPath}/${file.name}`;

        // Get full metadata including checksum
        const metadata = await this.getFileMetadata(filePath);
        if (metadata) {
          files.push(metadata);
        }
      }
    } catch (error) {
      console.error('[LocalFS] List files error:', error);
    }

    return files;
  }

  /**
   * Calculate file checksum using Web Crypto API
   */
  private async calculateChecksum(content: string | Blob): Promise<string> {
    try {
      let buffer: ArrayBuffer;

      if (content instanceof Blob) {
        buffer = await content.arrayBuffer();
      } else {
        const encoder = new TextEncoder();
        buffer = encoder.encode(content).buffer;
      }

      // Use SHA256 for checksums
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return hashHex;
    } catch (error) {
      console.error('[LocalFS] Checksum calculation error:', error);
      return 'error';
    }
  }
}

// Global instance
export const localFileSystemSync = new LocalFileSystemSync();
