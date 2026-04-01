/**
 * useCanvasDocuments — Hook for managing canvas documents with VFS + cloud sync
 *
 * Provides:
 * - CRUD operations (create, read, update, delete)
 * - Filtering and searching
 * - VFS persistence (IndexedDB)
 * - Cloud synchronization
 * - Edit history tracking
 * - Quota management
 */

import { useState, useCallback, useEffect } from 'react';
import { type CanvasDocument, type DocumentFilter, type DocumentStorageStats } from '../types/documents';
import { cloudSyncManager } from '../utils/cloudSyncManager';
// import { localFileSystemSync } from '../utils/localFileSystemSync';
import { vfs } from '../utils/sessionFileSystem';

export function useCanvasDocuments(sessionId: string, userId: string) {
  const [documents, setDocuments] = useState<CanvasDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DocumentStorageStats>({
    totalDocuments: 0,
    totalSizeBytes: 0,
    byTag: { canvas: 0, research: 0, workspace: 0, personal: 0, archived: 0 },
    byFileType: { docx: 0, pdf: 0, md: 0, html: 0, txt: 0, code: 0 },
    syncStatus: { synced: 0, syncing: 0, conflicts: 0, offline: 0 },
  });

  /**
   * Load all documents from VFS for this session
   */
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Query VFS (vfs) for documents in this session
      // Filter by sessionId and fileType matching CanvasDocument types
      const loadedDocs: CanvasDocument[] = [];
      // for await (const file of vfs.listFiles(sessionId)) {
      //   if (isCanvasDocument(file)) {
      //     loadedDocs.push(file as CanvasDocument);
      //   }
      // }
      setDocuments(loadedDocs);
      updateStats(loadedDocs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  /**
   * Create new canvas document
   */
  const createDocument = useCallback(
    async (doc: Omit<CanvasDocument, 'id' | 'createdAt' | 'updatedAt' | 'sessionId' | 'createdBy' | 'sync'>) => {
      try {
        const newDoc: CanvasDocument = {
          ...doc,
          id: crypto.randomUUID(),
          sessionId,
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sync: {
            state: 'local',
            cloudVersion: 0,
            localVersion: 1,
            lastModifiedLocally: Date.now(),
          },
        };

        // Save to VFS
        vfs.saveDownload(
          sessionId,
          'canvas-document',
          `${newDoc.id}.${doc.fileType}`,
          newDoc.content,
          `text/${doc.fileType}`,
        );

        // Add to documents list
        setDocuments(prev => [...prev, newDoc]);
        updateStats([...documents, newDoc]);

        // Attempt cloud sync (async, don't block)
        cloudSyncManager
          .uploadDocument({
            ...newDoc,
            blob: doc.blob,
          } as any)
          .catch(err => console.error('[useCanvasDocuments] Cloud upload error:', err));

        return newDoc;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [sessionId, userId, documents],
  );

  /**
   * Update existing document
   */
  const updateDocument = useCallback(
    async (docId: string, updates: Partial<CanvasDocument>) => {
      try {
        setDocuments(prev =>
          prev.map(doc => {
            if (doc.id !== docId) return doc;

            const updated: CanvasDocument = {
              ...doc,
              ...updates,
              updatedAt: Date.now(),
              sync: {
                ...doc.sync,
                state: 'syncing',
                localVersion: doc.sync.localVersion + 1,
                lastModifiedLocally: Date.now(),
              },
            };

            // Save to VFS
            vfs.saveDownload(
              sessionId,
              'canvas-document',
              `${docId}.${updated.fileType}`,
              updated.content,
              `text/${updated.fileType}`,
            );

            // Cloud sync
            cloudSyncManager.uploadDocument(updated as any).catch(err => {
              console.error('[useCanvasDocuments] Cloud upload error:', err);
              // Mark sync as failed
              setDocuments(prev =>
                prev.map(d => (d.id === docId ? { ...d, sync: { ...d.sync, state: 'conflict' } } : d)),
              );
            });

            return updated;
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [sessionId, documents],
  );

  /**
   * Delete document
   */
  const deleteDocument = useCallback(
    async (docId: string) => {
      try {
        // Soft delete: mark as deleted but keep in history
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === docId ? { ...doc, isDeleted: true, updatedAt: Date.now() } : doc,
          ),
        );

        // Cloud sync deletion
        cloudSyncManager
          .uploadDocument({
            id: docId,
            isDeleted: true,
            updatedAt: Date.now(),
          } as any)
          .catch(err => console.error('[useCanvasDocuments] Cloud delete error:', err));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [],
  );

  /**
   * Filter documents by criteria
   */
  const filterDocuments = useCallback(
    (filter: DocumentFilter): CanvasDocument[] => {
      return documents.filter(doc => {
        if (doc.isDeleted) return false;

        if (filter.query) {
          const q = filter.query.toLowerCase();
          if (!doc.title.toLowerCase().includes(q) && !doc.content.toLowerCase().includes(q)) {
            return false;
          }
        }

        if (filter.tags && filter.tags.length > 0) {
          if (!filter.tags.some(tag => doc.tags.includes(tag))) {
            return false;
          }
        }

        if (filter.fileType && filter.fileType.length > 0) {
          if (!filter.fileType.includes(doc.fileType)) {
            return false;
          }
        }

        if (filter.createdAfter && doc.createdAt < filter.createdAfter) {
          return false;
        }
        if (filter.createdBefore && doc.createdAt > filter.createdBefore) {
          return false;
        }

        if (filter.modifiedAfter && doc.updatedAt < filter.modifiedAfter) {
          return false;
        }
        if (filter.modifiedBefore && doc.updatedAt > filter.modifiedBefore) {
          return false;
        }

        if (filter.syncState && doc.sync.state !== filter.syncState) {
          return false;
        }

        return true;
      });
    },
    [documents],
  );

  /**
   * Update statistics
   */
  const updateStats = useCallback((docs: CanvasDocument[]) => {
    const newStats: DocumentStorageStats = {
      totalDocuments: docs.filter(d => !d.isDeleted).length,
      totalSizeBytes: docs.reduce((sum, d) => sum + new Blob([d.content]).size, 0),
      byTag: { canvas: 0, research: 0, workspace: 0, personal: 0, archived: 0 },
      byFileType: { docx: 0, pdf: 0, md: 0, html: 0, txt: 0, code: 0 },
      syncStatus: { synced: 0, syncing: 0, conflicts: 0, offline: 0 },
    };

    for (const doc of docs) {
      if (doc.isDeleted) continue;

      for (const tag of doc.tags) {
        newStats.byTag[tag]++;
      }
      newStats.byFileType[doc.fileType]++;
      newStats.syncStatus[doc.sync.state === 'conflict' ? 'conflicts' : doc.sync.state]++;
    }

    setStats(newStats);
  }, []);

  /**
   * Sync all documents with cloud
   */
  const syncWithCloud = useCallback(async () => {
    try {
      setError(null);
      const syncStatus = await cloudSyncManager.syncAll(
        documents.map(d => ({
          ...d,
          blob: d.blob,
        } as any)),
      );

      // Update document sync states based on sync result
      setDocuments(prev =>
        prev.map(doc => {
          const syncedDoc = syncStatus.conflicts.find(c => c.docId === doc.id);
          return syncedDoc
            ? { ...doc, sync: { ...doc.sync, state: 'conflict' } }
            : { ...doc, sync: { ...doc.sync, state: 'synced', lastSyncedAt: Date.now() } };
        }),
      );

      return syncStatus;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, [documents]);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    isLoading,
    error,
    stats,
    createDocument,
    updateDocument,
    deleteDocument,
    filterDocuments,
    loadDocuments,
    syncWithCloud,
  };
}
