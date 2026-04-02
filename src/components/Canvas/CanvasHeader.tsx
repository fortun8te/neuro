/**
 * Canvas Header Component
 * Title, metadata, action buttons, unsaved indicator
 */

import { Copy, Download, Edit2, RotateCcw, Lock, Unlock, X } from 'lucide-react';
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, CANVAS_TRANSITIONS, getColorScheme } from '../../styles/canvasStyles';
import { FONT_FAMILY } from '../../constants/ui';
import '../../styles/canvasButtons.css';

interface CanvasHeaderProps {
  title: string;
  wordCount: number;
  fileType: string;
  isEditMode: boolean;
  isAIWriting: boolean;
  hasUnsavedChanges: boolean;
  copiedRecently: boolean;
  showVersions: boolean;
  versionsCount: number;
  canUndoRedo: { canUndo: boolean; canRedo: boolean };
  isDarkMode: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onEditToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onVersionsToggle: () => void;
  onSave?: () => void;
}

export function CanvasHeader({
  title,
  wordCount,
  fileType,
  isEditMode,
  isAIWriting,
  hasUnsavedChanges,
  copiedRecently,
  showVersions,
  versionsCount,
  canUndoRedo,
  isDarkMode,
  onClose,
  onCopy,
  onDownload,
  onEditToggle,
  onUndo,
  onRedo,
  onVersionsToggle,
  onSave,
}: CanvasHeaderProps) {
  const colors = getColorScheme(isDarkMode);
  const theme = isDarkMode ? 'dark' : 'light';

  return (
    <div
      style={{
        padding: `${CANVAS_SPACING.md} ${CANVAS_SPACING.xl}`,
        borderBottom: `1px solid ${colors.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: CANVAS_SPACING.md,
      }}
      role="banner"
    >
      {/* Title & Metadata */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: CANVAS_SPACING.sm,
          }}
        >
          <h3
            style={{
              fontSize: CANVAS_FONT_SIZE.sm,
              fontWeight: 600,
              margin: 0,
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: FONT_FAMILY,
            }}
          >
            {title}
          </h3>
          {hasUnsavedChanges && !isEditMode && (
            <span
              style={{
                fontSize: CANVAS_FONT_SIZE.xs,
                color: colors.textQuaternary,
                whiteSpace: 'nowrap',
              }}
              aria-label="unsaved changes indicator"
            >
              ● unsaved
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: CANVAS_FONT_SIZE.xs,
            color: colors.textQuaternary,
            marginTop: '2px',
            fontFamily: FONT_FAMILY,
          }}
        >
          {wordCount} words • {fileType.toUpperCase()}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: CANVAS_SPACING.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* AI Writing Indicator */}
        {isAIWriting && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: CANVAS_SPACING.xs,
              padding: `${CANVAS_SPACING.sm} ${CANVAS_SPACING.md}`,
              borderRadius: CANVAS_SPACING.md,
              background: colors.errorBg,
              border: `1px solid ${colors.errorBorder}`,
              fontSize: CANVAS_FONT_SIZE.xs,
              color: colors.errorText,
            }}
            title="AI is writing. Editing is disabled."
            aria-label="AI writing indicator"
          >
            <Lock size={12} />
            AI writing
          </div>
        )}

        {isEditMode && isAIWriting && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: CANVAS_SPACING.xs,
              padding: `${CANVAS_SPACING.sm} ${CANVAS_SPACING.md}`,
              borderRadius: CANVAS_SPACING.md,
              background: colors.errorBg,
              border: `1px solid ${colors.errorBorder}`,
              fontSize: CANVAS_FONT_SIZE.xs,
              color: colors.errorText,
            }}
            title="AI has started writing. Save your changes first."
            aria-label="Save before AI warning"
          >
            <Unlock size={12} />
            Save before AI
          </div>
        )}

        {/* Edit/Mode Buttons */}
        {!isEditMode && !isAIWriting && (
          <button
            onClick={onEditToggle}
            className="canvas-button"
            data-theme={theme}
            title="Edit document (Cmd+E)"
            aria-label="Enter edit mode"
          >
            <Edit2 size={12} />
            Edit
          </button>
        )}

        {isEditMode && (
          <>
            <button
              onClick={onUndo}
              disabled={!canUndoRedo.canUndo}
              className="canvas-button"
              data-theme={theme}
              title="Undo (Cmd+Z)"
              aria-label={canUndoRedo.canUndo ? 'Undo changes' : 'Cannot undo (no history)'}
            >
              ↶ Undo
            </button>
            <button
              onClick={onRedo}
              disabled={!canUndoRedo.canRedo}
              className="canvas-button"
              data-theme={theme}
              title="Redo (Cmd+Shift+Z)"
              aria-label={canUndoRedo.canRedo ? 'Redo changes' : 'Cannot redo (no history)'}
            >
              ↷ Redo
            </button>
          </>
        )}

        {/* Versions */}
        <button
          onClick={onVersionsToggle}
          className={`canvas-button ${showVersions ? 'active' : ''}`}
          data-theme={theme}
          title="Version history"
          aria-label={`Version history (${versionsCount} versions)`}
          aria-pressed={showVersions}
        >
          ⏱ {versionsCount}
        </button>

        {/* Copy */}
        <button
          onClick={onCopy}
          className={`canvas-button ${copiedRecently ? 'canvas-button-success' : ''}`}
          data-theme={theme}
          title="Copy to clipboard"
          aria-label={copiedRecently ? 'Content copied to clipboard' : 'Copy content to clipboard'}
        >
          <Copy size={12} />
          {copiedRecently ? 'Copied' : 'Copy'}
        </button>

        {/* Download */}
        <button
          onClick={onDownload}
          className="canvas-button"
          data-theme={theme}
          title="Download file"
          aria-label="Download file"
        >
          <Download size={12} />
          Download
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="canvas-button"
          data-theme={theme}
          title="Close (Escape)"
          aria-label="Close canvas"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
