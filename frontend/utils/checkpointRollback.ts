/**
 * Checkpoint Rollback Manager
 * Handles checkpoint versioning, backup retention, and rollback on save failure
 */

import { get, set, del } from 'idb-keyval';
import type { Checkpoint, SessionState } from './sessionCheckpoint';

export interface CheckpointBackup {
  id: string; // backup-<checkpoint-id>-<timestamp>
  checkpointId: string;
  sessionId: string;
  checkpoint: Checkpoint;
  backedUpAt: number;
  isCurrentVersion: boolean;
}

interface BackupMetadata {
  checkpointId: string;
  backups: Array<{
    id: string;
    backedUpAt: number;
    isCurrentVersion: boolean;
  }>;
}

const CHECKPOINT_BACKUPS_KEY = 'checkpoint_backups';
const BACKUP_METADATA_KEY = 'checkpoint_backup_metadata';
const MAX_BACKUPS_PER_CHECKPOINT = 3; // Keep last 3 successful versions

/**
 * Manager for checkpoint rollback and backup
 */
export class CheckpointRollbackManager {
  /**
   * Create a backup of a checkpoint before attempting to save
   */
  async backupCheckpoint(checkpoint: Checkpoint): Promise<string> {
    try {
      const backupId = `backup-${checkpoint.id}-${Date.now()}`;

      // Store the backup
      const backupKey = `${CHECKPOINT_BACKUPS_KEY}:${backupId}`;
      await set(backupKey, {
        id: backupId,
        checkpointId: checkpoint.id,
        sessionId: checkpoint.sessionId,
        checkpoint,
        backedUpAt: Date.now(),
        isCurrentVersion: true,
      } as CheckpointBackup);

      // Update metadata (track all backups for this checkpoint)
      await this.updateBackupMetadata(checkpoint.id, backupId);

      // Prune old backups
      await this.pruneOldBackups(checkpoint.id);

      console.log(
        `[CheckpointRollback] Created backup ${backupId} for checkpoint ${checkpoint.id}`
      );
      return backupId;
    } catch (error) {
      console.error('[CheckpointRollback] Failed to backup checkpoint:', error);
      throw error;
    }
  }

  /**
   * Restore checkpoint from a backup
   */
  async restoreFromBackup(backupId: string): Promise<Checkpoint | null> {
    try {
      const backupKey = `${CHECKPOINT_BACKUPS_KEY}:${backupId}`;
      const backup = (await get(backupKey)) as CheckpointBackup | undefined;

      if (!backup) {
        console.error(`[CheckpointRollback] Backup not found: ${backupId}`);
        return null;
      }

      console.log(
        `[CheckpointRollback] Restored checkpoint from backup ${backupId}`
      );
      return backup.checkpoint;
    } catch (error) {
      console.error('[CheckpointRollback] Failed to restore from backup:', error);
      return null;
    }
  }

  /**
   * Get all backups for a checkpoint
   */
  async getCheckpointBackups(checkpointId: string): Promise<CheckpointBackup[]> {
    try {
      const metadata = await this.getBackupMetadata(checkpointId);
      if (!metadata) return [];

      const backups: CheckpointBackup[] = [];
      for (const backup of metadata.backups) {
        const backupKey = `${CHECKPOINT_BACKUPS_KEY}:${backup.id}`;
        const backupData = (await get(backupKey)) as
          | CheckpointBackup
          | undefined;
        if (backupData) {
          backups.push(backupData);
        }
      }

      return backups.sort((a, b) => b.backedUpAt - a.backedUpAt);
    } catch (error) {
      console.error('[CheckpointRollback] Failed to get backups:', error);
      return [];
    }
  }

  /**
   * Get the most recent successful backup for a checkpoint
   */
  async getMostRecentBackup(
    checkpointId: string
  ): Promise<CheckpointBackup | null> {
    const backups = await this.getCheckpointBackups(checkpointId);
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Mark a backup as the current version (after successful save)
   */
  async markAsCurrentVersion(backupId: string): Promise<void> {
    try {
      const backupKey = `${CHECKPOINT_BACKUPS_KEY}:${backupId}`;
      const backup = (await get(backupKey)) as CheckpointBackup | undefined;

      if (!backup) return;

      // Update all backups for this checkpoint: only one can be current
      const metadata = await this.getBackupMetadata(backup.checkpointId);
      if (metadata) {
        for (const m of metadata.backups) {
          const key = `${CHECKPOINT_BACKUPS_KEY}:${m.id}`;
          const data = (await get(key)) as CheckpointBackup | undefined;
          if (data) {
            data.isCurrentVersion = m.id === backupId;
            await set(key, data);
          }
        }
      }

      console.log(
        `[CheckpointRollback] Marked backup ${backupId} as current version`
      );
    } catch (error) {
      console.error('[CheckpointRollback] Failed to mark as current:', error);
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupKey = `${CHECKPOINT_BACKUPS_KEY}:${backupId}`;
      const backup = (await get(backupKey)) as CheckpointBackup | undefined;

      if (backup) {
        await del(backupKey);

        // Update metadata
        const metadata = await this.getBackupMetadata(backup.checkpointId);
        if (metadata) {
          metadata.backups = metadata.backups.filter((b) => b.id !== backupId);
          if (metadata.backups.length > 0) {
            await set(
              `${BACKUP_METADATA_KEY}:${backup.checkpointId}`,
              metadata
            );
          } else {
            await del(`${BACKUP_METADATA_KEY}:${backup.checkpointId}`);
          }
        }
      }
    } catch (error) {
      console.error('[CheckpointRollback] Failed to delete backup:', error);
    }
  }

  /**
   * Clean up all backups for a checkpoint
   */
  async clearCheckpointBackups(checkpointId: string): Promise<void> {
    try {
      const backups = await this.getCheckpointBackups(checkpointId);
      for (const backup of backups) {
        await this.deleteBackup(backup.id);
      }
    } catch (error) {
      console.error('[CheckpointRollback] Failed to clear backups:', error);
    }
  }

  /**
   * Get checkpoint snapshot history (last 3 versions with timestamps)
   */
  async getCheckpointHistory(
    checkpointId: string
  ): Promise<
    Array<{ backupId: string; backedUpAt: number; isCurrentVersion: boolean }>
  > {
    try {
      const metadata = await this.getBackupMetadata(checkpointId);
      return metadata
        ? metadata.backups.map((b) => ({
            backupId: b.id,
            backedUpAt: b.backedUpAt,
            isCurrentVersion: b.isCurrentVersion,
          }))
        : [];
    } catch (error) {
      console.error('[CheckpointRollback] Failed to get history:', error);
      return [];
    }
  }

  /**
   * Internal: Update backup metadata
   */
  private async updateBackupMetadata(
    checkpointId: string,
    backupId: string
  ): Promise<void> {
    try {
      const metadataKey = `${BACKUP_METADATA_KEY}:${checkpointId}`;
      let metadata = (await get(metadataKey)) as
        | BackupMetadata
        | undefined;

      if (!metadata) {
        metadata = {
          checkpointId,
          backups: [],
        };
      }

      // Add new backup to metadata
      metadata.backups.push({
        id: backupId,
        backedUpAt: Date.now(),
        isCurrentVersion: true,
      });

      // Mark all previous backups as not current
      for (const backup of metadata.backups.slice(0, -1)) {
        backup.isCurrentVersion = false;
      }

      await set(metadataKey, metadata);
    } catch (error) {
      console.error('[CheckpointRollback] Failed to update metadata:', error);
      throw error;
    }
  }

  /**
   * Internal: Get backup metadata
   */
  private async getBackupMetadata(
    checkpointId: string
  ): Promise<BackupMetadata | null> {
    try {
      const metadataKey = `${BACKUP_METADATA_KEY}:${checkpointId}`;
      return ((await get(metadataKey)) as BackupMetadata | undefined) || null;
    } catch (error) {
      console.error('[CheckpointRollback] Failed to get metadata:', error);
      return null;
    }
  }

  /**
   * Internal: Prune old backups, keep only MAX_BACKUPS_PER_CHECKPOINT
   */
  private async pruneOldBackups(checkpointId: string): Promise<void> {
    try {
      const metadata = await this.getBackupMetadata(checkpointId);
      if (!metadata || metadata.backups.length <= MAX_BACKUPS_PER_CHECKPOINT) {
        return;
      }

      // Sort by timestamp, keep newest
      metadata.backups.sort((a, b) => b.backedUpAt - a.backedUpAt);

      const toDelete = metadata.backups.slice(MAX_BACKUPS_PER_CHECKPOINT);
      for (const backup of toDelete) {
        const backupKey = `${CHECKPOINT_BACKUPS_KEY}:${backup.id}`;
        await del(backupKey);
      }

      metadata.backups = metadata.backups.slice(0, MAX_BACKUPS_PER_CHECKPOINT);
      await set(`${BACKUP_METADATA_KEY}:${checkpointId}`, metadata);

      console.log(
        `[CheckpointRollback] Pruned ${toDelete.length} old backups for checkpoint ${checkpointId}`
      );
    } catch (error) {
      console.error('[CheckpointRollback] Failed to prune backups:', error);
    }
  }
}

export const checkpointRollback = new CheckpointRollbackManager();
