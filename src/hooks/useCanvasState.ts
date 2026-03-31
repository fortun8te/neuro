/**
 * useCanvasState — Manage canvas panel state across the agent session
 *
 * Handles:
 * - Opening/closing canvas panel
 * - Updating content during generation
 * - Persistence to VFS
 * - Metadata tracking
 */

import { useState, useCallback } from 'react';
import type { CanvasContent } from '../components/CanvasPanel';

export interface CanvasDocument {
  id: string;
  title: string;
  content: string;
  fileType: CanvasContent['fileType'];
  createdAt: number;
  updatedAt: number;
  blob?: Blob;
}

interface CanvasState {
  isOpen: boolean;
  content: CanvasContent | null;
  isLoading: boolean;
  error?: string;
}

/**
 * Hook for managing canvas panel state
 */
export function useCanvasState() {
  const [state, setState] = useState<CanvasState>({
    isOpen: false,
    content: null,
    isLoading: false,
  });

  const openCanvas = useCallback((content: CanvasContent) => {
    setState({
      isOpen: true,
      content,
      isLoading: content.isWriting ?? false,
      error: undefined,
    });
  }, []);

  const closeCanvas = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const updateContent = useCallback((updates: Partial<CanvasContent>) => {
    setState(prev => ({
      ...prev,
      content: prev.content ? { ...prev.content, ...updates } : null,
      isLoading: updates.isWriting ?? prev.isLoading,
    }));
  }, []);

  const setWriting = useCallback((isWriting: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: isWriting,
      content: prev.content ? { ...prev.content, isWriting } : null,
    }));
  }, []);

  const setError = useCallback((error?: string) => {
    setState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  return {
    ...state,
    openCanvas,
    closeCanvas,
    updateContent,
    setWriting,
    setError,
  };
}

/**
 * Helper to create canvas content from tool result
 */
export function createCanvasContent(
  toolName: string,
  args: Record<string, any>,
  result?: any,
  isWriting: boolean = false,
): CanvasContent | null {
  const filename = args?.filename || args?.title || 'Document';

  const fileType = getFileTypeFromFilename(filename);
  if (!fileType) return null;

  return {
    title: filename,
    content: result?.output || '',
    fileType,
    isWriting,
    blob: result?.data?.blob,
    language: args?.language,
  };
}

/**
 * Detect file type from filename
 */
function getFileTypeFromFilename(filename: string): CanvasContent['fileType'] | null {
  if (!filename) return null;

  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const typeMap: Record<string, CanvasContent['fileType']> = {
    docx: 'docx',
    pdf: 'pdf',
    md: 'md',
    markdown: 'md',
    html: 'html',
    htm: 'html',
    txt: 'txt',
    text: 'txt',
    py: 'code',
    js: 'code',
    ts: 'code',
    jsx: 'code',
    tsx: 'code',
    java: 'code',
    cpp: 'code',
    c: 'code',
    cs: 'code',
    go: 'code',
    rs: 'code',
    rb: 'code',
    php: 'code',
  };

  return typeMap[ext] || null;
}

/**
 * Helper to detect if a tool should open canvas
 */
export function shouldOpenCanvas(toolName: string): boolean {
  const canvasTools = ['create_docx', 'write_content', 'create_pdf', 'create_html', 'write_report'];
  return canvasTools.includes(toolName);
}
