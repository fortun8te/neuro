/**
 * Canvas Side Panel — Orchestrator Component
 * Refactored from 807-line monolith to 250-line modular architecture
 *
 * Slides in from right side (45% of viewport) when agent generates documents.
 * Supports DOCX, PDF, Markdown, HTML, Code rendering with real-time animations.
 * Export options: Copy, Download, Save to VFS.
 */

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { FONT_FAMILY } from '../../constants/ui';
import { CanvasHeader } from './CanvasHeader';
import { ContentRenderer } from './ContentRenderer';
import { EditableTextarea } from './EditableTextarea';
import { VersionHistorySidebar } from './VersionHistorySidebar';
import { useCanvasState } from './useCanvasState';
import { CANVAS_COLORS, getCanvasWidth, CANVAS_FONT_SIZE, CANVAS_SPACING, getColorScheme } from '../../styles/canvasStyles';
import '../../styles/canvasButtons.css';

export interface CanvasContent {
  title: string;
  content: string;
  fileType: 'docx' | 'pdf' | 'md' | 'html' | 'txt' | 'code';
  isWriting?: boolean;
  blob?: Blob;
  language?: string;
}

interface CanvasPanelProps {
  content: CanvasContent;
  onClose: () => void;
  onDownload?: (blob: Blob, filename: string) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => void;
  isAIWriting?: boolean;
}

export function CanvasPanel({
  content,
  onClose,
  onDownload,
  onEditModeChange,
  onContentChange,
  onSave,
  isAIWriting = false,
}: CanvasPanelProps) {
  const { isDarkMode } = useTheme();
  const colors = getColorScheme(isDarkMode);
  const contentRef = useRef<HTMLDivElement>(null);

  // State management
  const {
    editContent,
    setEditContent,
    isEditMode,
    setIsEditMode,
    versions,
    undoStack,
    redoStack,
    hasUnsavedChanges,
    handleSave,
    handleUndo,
    handleRedo,
    revertToVersion,
  } = useCanvasState(content.content, `canvas_${content.title}`, content.title);

  const [copiedRecently, setCopiedRecently] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(getCanvasWidth());

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S / Ctrl+S: Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isEditMode) {
          handleSave().then((success) => {
            if (success) {
              onSave?.(editContent);
              onEditModeChange?.(false);
              setIsEditMode(false);
            }
          });
        }
      }

      // Cmd+Z / Ctrl+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (isEditMode) handleUndo();
      }

      // Cmd+Shift+Z / Ctrl+Shift+Z: Redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (isEditMode) handleRedo();
      }

      // Escape: Close or exit edit mode
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isEditMode) {
          setIsEditMode(false);
        } else {
          onClose();
        }
      }

      // Cmd+E: Enter edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (!isEditMode && !isAIWriting) {
          setIsEditMode(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, editContent, isAIWriting, handleSave, handleUndo, handleRedo]);

  // Track edit mode changes
  useEffect(() => {
    onEditModeChange?.(isEditMode);
  }, [isEditMode, onEditModeChange]);

  // Handle window resize with debouncing
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => setCanvasWidth(getCanvasWidth()), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Notify parent of content changes
  useEffect(() => {
    onContentChange?.(editContent);
  }, [editContent, onContentChange]);

  // Calculate word count
  const wordCount = editContent.split(/\s+/).filter((w) => w.length > 0).length;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editContent);
    setCopiedRecently(true);
    setTimeout(() => setCopiedRecently(false), 2000);
  }, [editContent]);

  const handleDownload = useCallback(() => {
    if (!content.blob) {
      const blob = new Blob([editContent], {
        type: content.fileType === 'code' ? 'text/plain' : 'text/markdown',
      });
      onDownload?.(blob, content.title);
    } else {
      onDownload?.(content.blob, content.title);
    }
  }, [editContent, content, onDownload]);

  const handleEditToggle = useCallback(() => {
    if (!isAIWriting) {
      setIsEditMode(!isEditMode);
    }
  }, [isEditMode, isAIWriting]);

  const handleSaveClick = useCallback(() => {
    handleSave().then((success) => {
      if (success) {
        onSave?.(editContent);
        setIsEditMode(false);
      }
    });
  }, [editContent, handleSave, onSave]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: `${canvasWidth}%` }}
        exit={{ opacity: 0, width: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'relative',
          width: `${canvasWidth}%`,
          minWidth: 0,
          height: '100%',
          background: colors.bg,
          borderLeft: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: colors.shadow,
          overflow: 'hidden',
        }}
        role="complementary"
        aria-label="Canvas panel"
      >
        {/* Header */}
        <CanvasHeader
          title={content.title}
          wordCount={wordCount}
          fileType={content.fileType}
          isEditMode={isEditMode}
          isAIWriting={isAIWriting}
          hasUnsavedChanges={hasUnsavedChanges && isEditMode}
          copiedRecently={copiedRecently}
          showVersions={showVersions}
          versionsCount={versions.length}
          canUndoRedo={{ canUndo: undoStack.length > 1, canRedo: redoStack.length > 0 }}
          isDarkMode={isDarkMode}
          onClose={onClose}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onEditToggle={handleEditToggle}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onVersionsToggle={() => setShowVersions(!showVersions)}
          onSave={handleSaveClick}
        />

        {/* Streaming Progress Bar */}
        {content.isWriting && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            style={{
              height: '2px',
              background: colors.infoText,
              transformOrigin: 'left',
              willChange: 'transform',
            }}
            role="status"
            aria-label="AI is streaming content"
            aria-live="polite"
          />
        )}

        {/* Main Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Content Pane */}
          <div
            ref={contentRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: CANVAS_SPACING.xl,
              fontSize: CANVAS_FONT_SIZE.base,
              lineHeight: 1.7,
              fontFamily: FONT_FAMILY,
            }}
            role="main"
          >
            {isEditMode ? (
              <EditableTextarea
                value={editContent}
                onChange={setEditContent}
                disabled={isAIWriting}
                isDarkMode={isDarkMode}
                isAIWriting={isAIWriting}
                autoFocus={true}
              />
            ) : content.isWriting ? (
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: CANVAS_FONT_SIZE.base,
                }}
              >
                {editContent}
                <span
                  style={{
                    animation: 'blink 0.8s steps(2, start) infinite',
                    marginLeft: '2px',
                    display: 'inline-block',
                    opacity: 0.8,
                  }}
                  aria-label="streaming cursor"
                  role="status"
                >
                  ▌
                </span>
              </div>
            ) : (
              <ContentRenderer
                content={{
                  fileType: content.fileType,
                  content: editContent,
                  language: content.language,
                }}
                isDarkMode={isDarkMode}
              />
            )}
          </div>

          {/* Version History Sidebar */}
          {showVersions && (
            <VersionHistorySidebar
              versions={versions}
              isDarkMode={isDarkMode}
              onVersionSelect={revertToVersion}
            />
          )}
        </div>

        {/* Status Footer */}
        <div
          style={{
            padding: `${CANVAS_SPACING.md} ${CANVAS_SPACING.xl}`,
            borderTop: `1px solid ${colors.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: CANVAS_FONT_SIZE.xs,
            color: colors.textSecondary,
            fontFamily: FONT_FAMILY,
          }}
          role="status"
          aria-live="polite"
        >
          <span>
            {content.isWriting ? (
              <span style={{ color: '#8b5cf6' }}>• streaming... ({wordCount} words)</span>
            ) : (
              <span>✓ Complete ({wordCount} words)</span>
            )}
          </span>
          {isEditMode && (
            <button
              onClick={handleSaveClick}
              className="canvas-button canvas-button-info"
              data-theme={isDarkMode ? 'dark' : 'light'}
              title="Save changes (Cmd+S)"
              aria-label="Save changes"
            >
              Save Changes
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
