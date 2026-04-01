/**
 * Canvas Side Panel — Document preview & editing with live updates
 *
 * Slides in from right side (45% of viewport) when agent generates documents.
 * Supports DOCX, PDF, Markdown, HTML, Code rendering with real-time animations.
 * Export options: Copy, Download, Save to VFS.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, Edit2, RotateCcw, Lock, Unlock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Version {
  id: string;
  timestamp: number;
  content: string;
  title: string;
  savedAt: Date;
}

export interface CanvasContent {
  title: string;
  content: string;
  fileType: 'docx' | 'pdf' | 'md' | 'html' | 'txt' | 'code';
  isWriting?: boolean;
  blob?: Blob;
  language?: string; // for code files
}

interface CanvasPanelProps {
  content: CanvasContent;
  onClose: () => void;
  onDownload?: (blob: Blob, filename: string) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
  isAIWriting?: boolean;
}

/**
 * Render content based on file type
 */
function renderContent(content: CanvasContent, isDarkMode: boolean) {
  const { fileType, content: text, language } = content;

  switch (fileType) {
    case 'md':
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              return inline ? (
                <code
                  className={className}
                  style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontFamily: 'monospace',
                  }}
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <pre
                  style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    padding: '12px',
                    borderRadius: '6px',
                    overflow: 'auto',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    marginBottom: '12px',
                  }}
                  {...props}
                >
                  <code style={{ fontFamily: 'monospace', fontSize: '12px' }}>{children}</code>
                </pre>
              );
            },
            h1: ({ node, ...props }: any) => (
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  marginTop: '20px',
                  marginBottom: '12px',
                  color: isDarkMode ? '#ffffff' : '#000000',
                }}
                {...props}
              />
            ),
            h2: ({ node, ...props }: any) => (
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  marginTop: '16px',
                  marginBottom: '10px',
                  color: isDarkMode ? '#e5e7eb' : '#1f2937',
                }}
                {...props}
              />
            ),
            h3: ({ node, ...props }: any) => (
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginTop: '12px',
                  marginBottom: '8px',
                  color: isDarkMode ? '#d1d5db' : '#374151',
                }}
                {...props}
              />
            ),
            p: ({ node, ...props }: any) => (
              <p
                style={{
                  marginBottom: '12px',
                  lineHeight: 1.6,
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                }}
                {...props}
              />
            ),
            ul: ({ node, ...props }: any) => (
              <ul
                style={{
                  marginLeft: '20px',
                  marginBottom: '12px',
                  listStyle: 'disc',
                }}
                {...props}
              />
            ),
            ol: ({ node, ...props }: any) => (
              <ol
                style={{
                  marginLeft: '20px',
                  marginBottom: '12px',
                  listStyle: 'decimal',
                }}
                {...props}
              />
            ),
            li: ({ node, ...props }: any) => (
              <li
                style={{
                  marginBottom: '6px',
                  color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
                }}
                {...props}
              />
            ),
            table: ({ node, ...props }: any) => (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: '12px',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
                {...props}
              />
            ),
            th: ({ node, ...props }: any) => (
              <th
                style={{
                  padding: '8px',
                  textAlign: 'left',
                  fontWeight: 600,
                  background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
                {...props}
              />
            ),
            td: ({ node, ...props }: any) => (
              <td
                style={{
                  padding: '8px',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
                {...props}
              />
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      );

    case 'code':
      return (
        <pre
          style={{
            background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            padding: '16px',
            borderRadius: '6px',
            overflow: 'auto',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            fontSize: '12px',
            lineHeight: 1.6,
            fontFamily: 'monospace',
            color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
          }}
        >
          <code>{text}</code>
        </pre>
      );

    case 'html':
      return (
        <div
          dangerouslySetInnerHTML={{ __html: text }}
          style={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}
        />
      );

    case 'txt':
      return (
        <pre
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {text}
        </pre>
      );

    case 'pdf':
      return (
        <div
          style={{
            padding: '16px',
            background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderRadius: '8px',
            textAlign: 'center',
            color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>📄 PDF Preview</div>
          <div style={{ fontSize: '11px' }}>PDF rendering not yet supported in preview. Use Download to view.</div>
        </div>
      );

    case 'docx':
      return (
        <div
          style={{
            padding: '16px',
            background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderRadius: '8px',
            textAlign: 'center',
            color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>📝 Word Document</div>
          <div style={{ fontSize: '11px' }}>Use Download button to view full formatting in Microsoft Word.</div>
        </div>
      );

    default:
      return <div style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Unsupported file type</div>;
  }
}

export function CanvasPanel({ content, onClose, onDownload, onEditModeChange, isAIWriting = false }: CanvasPanelProps) {
  const { isDarkMode } = useTheme();
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState(content.content);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([content.content]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Track edit mode changes and notify parent
  useEffect(() => {
    onEditModeChange?.(isEditMode);
  }, [isEditMode, onEditModeChange]);

  // Responsive width: 45% on desktop, smaller on mobile/tablet
  const getCanvasWidth = () => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    if (windowWidth < 640) return Math.min(100, 70); // Mobile: 70% max
    if (windowWidth < 1024) return Math.min(50, 45); // Tablet: 45-50%
    return 45; // Desktop: 45%
  };

  const [canvasWidth, setCanvasWidth] = useState(getCanvasWidth());

  // Update canvas width on window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasWidth(getCanvasWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize with current version
  useEffect(() => {
    if (!versions.length) {
      const initialVersion: Version = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        content: content.content,
        title: content.title,
        savedAt: new Date(),
      };
      setVersions([initialVersion]);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(content.content);
    setCopiedRecently(true);
    setTimeout(() => setCopiedRecently(false), 2000);
  };

  const handleDownload = () => {
    if (!content.blob) {
      // Fallback: create blob from content
      const blob = new Blob([content.content], {
        type: content.fileType === 'code' ? 'text/plain' : 'text/markdown',
      });
      onDownload?.(blob, `${content.title}`);
    } else {
      onDownload?.(content.blob, `${content.title}`);
    }
  };

  const handleSave = () => {
    if (editContent.trim()) {
      // Save to version history
      const newVersion: Version = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        content: editContent,
        title: content.title,
        savedAt: new Date(),
      };
      setVersions([...versions, newVersion]);
      setUndoStack([...undoStack, editContent]);
      setRedoStack([]);
      setIsEditMode(false);
      setCopiedRecently(false);
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 1) {
      const current = undoStack[undoStack.length - 1];
      const previous = undoStack[undoStack.length - 2];
      setRedoStack([...redoStack, current]);
      setUndoStack(undoStack.slice(0, -1));
      setEditContent(previous);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const toRedo = redoStack[redoStack.length - 1];
      setUndoStack([...undoStack, toRedo]);
      setRedoStack(redoStack.slice(0, -1));
      setEditContent(toRedo);
    }
  };

  const handleRevertToVersion = (version: Version) => {
    setEditContent(version.content);
    setIsEditMode(true);
    setShowVersions(false);
  };

  // Show live word count when streaming, or edit word count when editing
  const displayContent = isEditMode ? editContent : content.content;
  const wordCount = displayContent.split(/\s+/).filter(w => w.length > 0).length;

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
          background: isDarkMode ? '#141420' : '#EEECEA',
          borderLeft: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isDarkMode ? '0 -10px 40px rgba(0,0,0,0.3)' : '0 -10px 40px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                margin: 0,
                color: isDarkMode ? '#ffffff' : '#000000',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: FONT_FAMILY,
              }}
            >
              {content.title}
            </h3>
            <div
              style={{
                fontSize: '10px',
                color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
                marginTop: '2px',
                fontFamily: FONT_FAMILY,
              }}
            >
              {wordCount} words • {content.fileType.toUpperCase()}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Lock indicator */}
            {isAIWriting && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: isDarkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)'}`,
                  fontSize: '11px',
                  color: isDarkMode ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.7)',
                }}
                title="AI is writing. Editing is disabled."
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
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: isDarkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)'}`,
                  fontSize: '11px',
                  color: isDarkMode ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.7)',
                }}
                title="AI has started writing. Click Save to keep your changes, then editing will be disabled while AI writes."
              >
                <Unlock size={12} />
                Save before AI
              </div>
            )}

            {!isEditMode && !isAIWriting && (
              <button
                onClick={() => setIsEditMode(true)}
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  fontSize: '11px',
                  transition: 'all 0.15s',
                }}
                title="Edit document"
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                Edit
              </button>
            )}

            {isEditMode && (
              <>
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length <= 1}
                  style={{
                    background: undoStack.length <= 1 ? 'rgba(255,255,255,0.02)' : (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    cursor: undoStack.length <= 1 ? 'default' : 'pointer',
                    color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    fontSize: '11px',
                    opacity: undoStack.length <= 1 ? 0.5 : 1,
                  }}
                  title="Undo"
                >
                  ↶ Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  style={{
                    background: redoStack.length === 0 ? 'rgba(255,255,255,0.02)' : (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    cursor: redoStack.length === 0 ? 'default' : 'pointer',
                    color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    fontSize: '11px',
                    opacity: redoStack.length === 0 ? 0.5 : 1,
                  }}
                  title="Redo"
                >
                  ↷ Redo
                </button>
              </>
            )}

            <button
              onClick={() => setShowVersions(!showVersions)}
              style={{
                background: showVersions ? 'rgba(59,130,246,0.15)' : (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                border: 'none',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: showVersions ? '#3b82f6' : (isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'),
                fontSize: '11px',
                transition: 'all 0.15s',
              }}
              title="Version history"
            >
              ⏱ {versions.length}
            </button>

            <button
              onClick={handleCopy}
              style={{
                background: copiedRecently
                  ? 'rgba(34,197,94,0.1)'
                  : isDarkMode
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: copiedRecently ? '#22c55e' : isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontSize: '11px',
                transition: 'all 0.15s',
              }}
              title="Copy to clipboard"
            >
              <Copy size={12} style={{ marginRight: '4px' }} />
              {copiedRecently ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handleDownload}
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontSize: '11px',
                transition: 'all 0.15s',
              }}
              title="Download file"
            >
              <Download size={12} style={{ marginRight: '4px' }} />
              Download
            </button>

            <button
              onClick={onClose}
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontSize: '11px',
                transition: 'all 0.15s',
              }}
              title="Close canvas"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Streaming progress bar */}
        {content.isWriting && (
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              height: '2px',
              background: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 50%, #8b5cf6 100%)',
              backgroundSize: '200% 100%',
              animation: 'streamGradient 2s ease-in-out infinite',
            }}
          />
        )}

        {/* Main content area with version sidebar */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Content area */}
          <div
            ref={contentRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              fontSize: '13px',
              lineHeight: 1.7,
              fontFamily: FONT_FAMILY,
            }}
          >
            {isEditMode ? (
              <textarea
                ref={editRef}
                value={editContent}
                onChange={e => {
                  if (!isAIWriting) {
                    setEditContent(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight - 200) + 'px';
                  }
                }}
                disabled={isAIWriting}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '12px',
                  borderRadius: '6px',
                  border: `1px solid ${isAIWriting ? (isDarkMode ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)') : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                  background: isAIWriting ? (isDarkMode ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.02)') : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                  color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none',
                  opacity: isAIWriting ? 0.6 : 1,
                  cursor: isAIWriting ? 'not-allowed' : 'text',
                }}
              />
            ) : content.isWriting ? (
              <div style={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}>
                {editContent}
                <span
                  style={{
                    animation: 'blink 1s infinite',
                    marginLeft: '2px',
                    display: 'inline-block',
                  }}
                >
                  ▌
                </span>
              </div>
            ) : (
              renderContent({ ...content, content: editContent }, isDarkMode)
            )}
          </div>

          {/* Version history sidebar */}
          {showVersions && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                borderLeft: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '12px', fontSize: '11px', fontWeight: 600, color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                Versions ({versions.length})
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => handleRevertToVersion(v)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: '10px', color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', fontWeight: 500 }}>
                      v{versions.length - i}
                    </div>
                    <div style={{ fontSize: '9px', color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: '2px' }}>
                      {v.savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Status footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
            fontFamily: FONT_FAMILY,
          }}
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
              onClick={handleSave}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 500,
              }}
            >
              Save Changes
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
