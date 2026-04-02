/**
 * useCanvasState Hook
 * Manages edit state, version history, undo/redo, and IndexedDB persistence
 */

import { useState, useCallback, useEffect } from 'react';
import { set, get, del } from 'idb-keyval';

export interface CanvasVersion {
  id: string;
  timestamp: number;
  content: string;
  title: string;
  savedAt: Date;
}

const MAX_VERSIONS = 50;
const DB_KEY_VERSIONS = (docId: string) => `canvas_versions_${docId}`;

export function useCanvasState(initialContent: string, docId: string, title: string) {
  const [editContent, setEditContent] = useState(initialContent);
  const [isEditMode, setIsEditMode] = useState(false);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([initialContent]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load versions from IndexedDB on mount
  useEffect(() => {
    loadVersionsFromDB();
  }, [docId]);

  // Sync editContent with prop changes (when content is updated from outside)
  useEffect(() => {
    setEditContent(initialContent);
    setUndoStack([initialContent]);
    setRedoStack([]);
    setHasUnsavedChanges(false);
  }, [initialContent]);

  const loadVersionsFromDB = useCallback(async () => {
    try {
      const stored = await get<CanvasVersion[]>(DB_KEY_VERSIONS(docId));
      if (stored && Array.isArray(stored)) {
        setVersions(stored);
      } else {
        // Initialize with first version
        const initialVersion: CanvasVersion = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          content: initialContent,
          title,
          savedAt: new Date(),
        };
        setVersions([initialVersion]);
      }
    } catch (error) {
      console.warn('Failed to load canvas versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [docId, initialContent, title]);

  const saveVersionToDB = useCallback(async (newVersions: CanvasVersion[]) => {
    try {
      await set(DB_KEY_VERSIONS(docId), newVersions);
    } catch (error) {
      console.warn('Failed to save canvas versions:', error);
    }
  }, [docId]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!editContent.trim()) {
      return false; // Reject empty content
    }

    // Create new version
    const newVersion: CanvasVersion = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      content: editContent,
      title,
      savedAt: new Date(),
    };

    // Trim old versions if exceeding max
    let newVersions = [...versions, newVersion];
    if (newVersions.length > MAX_VERSIONS) {
      newVersions = newVersions.slice(-MAX_VERSIONS);
    }

    setVersions(newVersions);
    await saveVersionToDB(newVersions);

    // Update undo stack
    setUndoStack([...undoStack, editContent]);
    setRedoStack([]);
    setHasUnsavedChanges(false);

    return true;
  }, [editContent, versions, title, undoStack, saveVersionToDB]);

  const handleUndo = useCallback(() => {
    if (undoStack.length > 1) {
      const current = undoStack[undoStack.length - 1];
      const previous = undoStack[undoStack.length - 2];
      setRedoStack([...redoStack, current]);
      setUndoStack(undoStack.slice(0, -1));
      setEditContent(previous);
      setHasUnsavedChanges(true);
    }
  }, [undoStack, redoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const toRedo = redoStack[redoStack.length - 1];
      setUndoStack([...undoStack, toRedo]);
      setRedoStack(redoStack.slice(0, -1));
      setEditContent(toRedo);
      setHasUnsavedChanges(true);
    }
  }, [undoStack, redoStack]);

  const revertToVersion = useCallback((version: CanvasVersion) => {
    setEditContent(version.content);
    setUndoStack([...undoStack, version.content]);
    setRedoStack([]);
    setIsEditMode(true);
    setHasUnsavedChanges(true);
  }, [undoStack]);

  const clearVersions = useCallback(async () => {
    setVersions([]);
    try {
      await del(DB_KEY_VERSIONS(docId));
    } catch (error) {
      console.warn('Failed to clear canvas versions:', error);
    }
  }, [docId]);

  const handleContentChange = useCallback((newContent: string) => {
    setEditContent(newContent);
    setHasUnsavedChanges(true);
  }, []);

  return {
    editContent,
    setEditContent: handleContentChange,
    isEditMode,
    setIsEditMode,
    versions,
    undoStack,
    redoStack,
    hasUnsavedChanges,
    isLoading,
    // Methods
    handleSave,
    handleUndo,
    handleRedo,
    revertToVersion,
    clearVersions,
  };
}
