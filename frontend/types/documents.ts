/**
 * Document Types — Comprehensive type system for canvas documents,
 * VFS storage, and cloud synchronization
 */

export type FileType = 'docx' | 'pdf' | 'md' | 'html' | 'txt' | 'code';
export type DocumentTag = 'canvas' | 'research' | 'workspace' | 'personal' | 'archived';
export type SyncState = 'local' | 'syncing' | 'synced' | 'conflict' | 'offline';

/**
 * Canvas Document — Represents a document created by or with the agent
 * Stored in IndexedDB (VFS) + synced to cloud + written to ~/Neuro/Documents/
 */
export interface CanvasDocument {
  /** Unique document ID */
  id: string;

  /** Display title */
  title: string;

  /** Document content (text-based) */
  content: string;

  /** File type for rendering + export */
  fileType: FileType;

  /** Programming language (for code files) */
  language?: string;

  /** Tags for organization and filtering */
  tags: DocumentTag[];

  /** Binary blob (for DOCX, PDF, images) */
  blob?: Blob;

  /** Document creation timestamp */
  createdAt: number;

  /** Last modification timestamp */
  updatedAt: number;

  /** Session this document belongs to */
  sessionId: string;

  /** User who created the document */
  createdBy: string;

  /** Cloud sync metadata */
  sync: {
    state: SyncState;
    cloudVersion: number;
    lastSyncedAt?: number;
    localVersion: number;
    lastModifiedLocally: number;
    lastModifiedCloud?: number;
  };

  /** Edit history for non-destructive editing */
  edits?: DocumentEdit[];

  /** Is document marked for deletion */
  isDeleted?: boolean;

  /** Custom metadata (tool args, agent context, etc) */
  metadata?: Record<string, any>;
}

/**
 * Document Edit — Single edit to a document for version tracking
 */
export interface DocumentEdit {
  id: string;
  timestamp: number;
  operation: 'insert' | 'delete' | 'replace';
  startPos: number;
  endPos: number;
  oldText?: string;
  newText?: string;
  userId: string;
}

/**
 * Document Metadata for UI display
 */
export interface DocumentMetadata {
  wordCount: number;
  charCount: number;
  readingTimeMinutes: number;
  fileSizeBytes: number;
}

/**
 * Document Filter for searching/filtering
 */
export interface DocumentFilter {
  query?: string;
  tags?: DocumentTag[];
  fileType?: FileType[];
  createdAfter?: number;
  createdBefore?: number;
  modifiedAfter?: number;
  modifiedBefore?: number;
  syncState?: SyncState;
}

/**
 * Document Storage Statistics
 */
export interface DocumentStorageStats {
  totalDocuments: number;
  totalSizeBytes: number;
  byTag: Record<DocumentTag, number>;
  byFileType: Record<FileType, number>;
  syncStatus: {
    synced: number;
    syncing: number;
    conflicts: number;
    offline: number;
  };
}
