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
import type { CanvasContent } from '../components/Canvas';

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
  isStreaming?: boolean;
  lastChunkTime?: number;
  isEditMode?: boolean;
  isAIWriting?: boolean;
}

/**
 * Hook for managing canvas panel state
 */
export function useCanvasState() {
  const [state, setState] = useState<CanvasState>({
    isOpen: false,
    content: null,
    isLoading: false,
    isEditMode: false,
    isAIWriting: false,
  });

  const openCanvas = useCallback((content: CanvasContent) => {
    setState({
      isOpen: true,
      content,
      isLoading: content.isWriting ?? false,
      error: undefined,
      isEditMode: false,
      isAIWriting: content.isWriting ?? false,
    });
  }, []);

  const closeCanvas = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      isEditMode: false,
    }));
  }, []);

  const updateContent = useCallback((updates: Partial<CanvasContent>) => {
    setState(prev => ({
      ...prev,
      content: prev.content ? { ...prev.content, ...updates } : null,
      isLoading: updates.isWriting ?? prev.isLoading,
      isAIWriting: updates.isWriting ?? prev.isAIWriting,
    }));
  }, []);

  const setWriting = useCallback((isWriting: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: isWriting,
      isAIWriting: isWriting,
      content: prev.content ? { ...prev.content, isWriting } : null,
    }));
  }, []);

  const setError = useCallback((error?: string) => {
    setState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  const streamChunk = useCallback((chunk: string) => {
    setState(prev => {
      if (!prev.content) return prev;

      return {
        ...prev,
        content: {
          ...prev.content,
          content: prev.content.content + chunk,
        },
        isStreaming: true,
        lastChunkTime: Date.now(),
      };
    });
  }, []);

  const endStreaming = useCallback(() => {
    setState(prev => ({
      ...prev,
      isStreaming: false,
      isLoading: false,
      isAIWriting: false,
    }));
  }, []);

  const setEditMode = useCallback((editMode: boolean) => {
    setState(prev => ({
      ...prev,
      isEditMode: editMode,
    }));
  }, []);

  return {
    ...state,
    openCanvas,
    closeCanvas,
    updateContent,
    setWriting,
    setError,
    streamChunk,
    endStreaming,
    setEditMode,
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
 * Helper to detect if a tool should open canvas (tool-based detection)
 */
export function shouldOpenCanvas(toolName: string): boolean {
  const canvasTools = ['create_docx', 'write_content', 'create_pdf', 'create_html', 'write_report'];
  return canvasTools.includes(toolName);
}

/**
 * Content-based canvas detection heuristic
 * Determines if response content is "canvas-worthy" based on:
 * - Character count threshold
 * - Presence of markdown, JSON, code, tables
 */
export function shouldOpenCanvasByContent(response: string): boolean {
  if (!response || response.length === 0) return false;

  const contentLength = response.length;
  const lowerResponse = response.toLowerCase();

  // Regex patterns
  const hasMarkdownHeadings = /^#{1,6}\s+/m.test(response);
  const hasCodeBlocks = /```[\s\S]*?```/m.test(response);
  const hasMarkdownLinks = /\[.+?\]\(.+?\)/m.test(response);
  const hasMarkdownList = /^[\s]*[-*+]\s+/m.test(response);
  const hasJSON = /^[\s]*\{[\s\S]*\}[\s]*$/m.test(response) || /^[\s]*\[[\s\S]*\][\s]*$/m.test(response);
  const hasTable = /^\|.+\|.+\|$/m.test(response);
  const hasHtmlTags = /<[a-z]+[^>]*>/i.test(response);

  // Check for research-related data patterns
  const hasResearchData = (
    lowerResponse.includes('"campaign"') ||
    lowerResponse.includes('"research"') ||
    lowerResponse.includes('"findings"') ||
    lowerResponse.includes('"data"') ||
    /\{[\s\S]*"(campaign|research|findings|audience|market)"[\s\S]*\}/i.test(response)
  );

  // Heuristic: Show canvas if content meets certain criteria
  return (
    (contentLength > 2000) ||                              // Very long response
    (hasCodeBlocks && contentLength > 300) ||              // Code blocks present
    ((hasMarkdownHeadings || hasMarkdownList) && contentLength > 400) || // Markdown formatted
    (hasJSON && contentLength > 200) ||                    // JSON/structured data
    (hasTable && contentLength > 250) ||                   // Tables
    (hasHtmlTags && contentLength > 300) ||                // HTML content
    (hasResearchData && contentLength > 400)               // Research data patterns
  );
}

/**
 * Determines if the "Open in Canvas" button should be shown for a response
 * Hides for simple/short text, shows for actual document content
 */
export function shouldShowOpenCanvasButton(content: string): boolean {
  if (!content || content.length < 500) return false;

  const lowerContent = content.toLowerCase();

  // Check for document-like patterns
  const hasMarkdownHeadings = /^#{1,6}\s+/m.test(content);
  const hasCodeBlocks = /```[\s\S]*?```/m.test(content);
  const hasMarkdownList = /^[\s]*[-*+]\s+/m.test(content);
  const hasTable = /^\|.+\|.+\|$/m.test(content);
  const hasJSON = /^[\s]*[\[\{][\s\S]*[\]\}][\s]*$/m.test(content);

  // Show button if content has substantial formatting
  return (
    hasMarkdownHeadings ||
    (hasCodeBlocks && content.length > 300) ||
    hasMarkdownList ||
    hasTable ||
    (hasJSON && content.length > 200)
  );
}
