/**
 * Canvas Side Panel — OpenAI Canvas-style document preview with code execution
 *
 * Features:
 * - Clean minimal header: editable title, language badge, icon-only buttons
 * - Context shortcut pills (code: Review/Fix/Comments/Logs/Run, text: Shorter/Longer/Polish/Simplify)
 * - Live HTML preview via sandboxed iframe
 * - JavaScript execution via Web Worker
 * - Line-by-line diff overlay (Show Changes)
 * - Version history (up to 20, ← → navigation)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../constants/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Version {
  id: string;
  timestamp: number;
  content: string;
}

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
  isAIWriting?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLanguageLabel(content: CanvasContent): string {
  if (content.fileType === 'code') return content.language?.toLowerCase() || 'code';
  if (content.fileType === 'md') return 'markdown';
  if (content.fileType === 'html') return 'html';
  if (content.fileType === 'txt') return 'text';
  if (content.fileType === 'pdf') return 'pdf';
  if (content.fileType === 'docx') return 'word';
  return content.fileType;
}

function isCodeFile(content: CanvasContent): boolean {
  return content.fileType === 'code' || content.fileType === 'html';
}

function isTextFile(content: CanvasContent): boolean {
  return content.fileType === 'md' || content.fileType === 'txt';
}

function canRunHTML(content: CanvasContent): boolean {
  return content.fileType === 'html' || (content.fileType === 'code' && content.language?.toLowerCase() === 'html');
}

function canRunJS(content: CanvasContent): boolean {
  return content.fileType === 'code' && (content.language?.toLowerCase() === 'javascript' || content.language?.toLowerCase() === 'js');
}

/** Very simple line-by-line LCS diff — returns array of {type, line} */
function simpleDiff(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; line: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'added' | 'removed'; line: string }[] = [];

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const ops: { type: 'same' | 'added' | 'removed'; line: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'same', line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', line: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: 'removed', line: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IconButton({
  onClick,
  disabled,
  title,
  active,
  isDark,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: active
          ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          : 'transparent',
        border: 'none',
        borderRadius: '5px',
        padding: '5px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled
          ? isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
          : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
        transition: 'background 0.12s, color 0.12s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = active
          ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function Pill({
  label,
  onClick,
  disabled,
  title,
  isDark,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  isDark: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '3px 10px',
        borderRadius: '999px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
        background: 'transparent',
        color: disabled
          ? isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'
          : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)',
        fontSize: '11px',
        fontFamily: FONT_FAMILY,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap' as const,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer (kept compact, reuses existing logic)
// ---------------------------------------------------------------------------

function MarkdownView({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          return inline ? (
            <code
              className={className}
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                padding: '2px 4px',
                borderRadius: '3px',
                fontFamily: FONT_FAMILY_MONO,
                fontSize: '12px',
              }}
              {...props}
            >{children}</code>
          ) : (
            <pre style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              padding: '12px',
              borderRadius: '6px',
              overflow: 'auto',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              marginBottom: '12px',
            }} {...props}>
              <code style={{ fontFamily: FONT_FAMILY_MONO, fontSize: '12px' }}>{children}</code>
            </pre>
          );
        },
        h1: ({ node, ...props }: any) => <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '20px 0 10px', color: isDark ? '#fff' : '#000' }} {...props} />,
        h2: ({ node, ...props }: any) => <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '16px 0 8px', color: isDark ? '#e5e7eb' : '#1f2937' }} {...props} />,
        h3: ({ node, ...props }: any) => <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '12px 0 6px', color: isDark ? '#d1d5db' : '#374151' }} {...props} />,
        p: ({ node, ...props }: any) => <p style={{ marginBottom: '12px', lineHeight: 1.65, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }} {...props} />,
        ul: ({ node, ...props }: any) => <ul style={{ marginLeft: '20px', marginBottom: '12px', listStyle: 'disc' }} {...props} />,
        ol: ({ node, ...props }: any) => <ol style={{ marginLeft: '20px', marginBottom: '12px', listStyle: 'decimal' }} {...props} />,
        li: ({ node, ...props }: any) => <li style={{ marginBottom: '5px', color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)' }} {...props} />,
        table: ({ node, ...props }: any) => <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} {...props} />,
        th: ({ node, ...props }: any) => <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} {...props} />,
        td: ({ node, ...props }: any) => <td style={{ padding: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Diff view
// ---------------------------------------------------------------------------

function DiffView({ oldText, newText, isDark }: { oldText: string; newText: string; isDark: boolean }) {
  const hunks = simpleDiff(oldText, newText);
  return (
    <pre style={{
      fontFamily: FONT_FAMILY_MONO,
      fontSize: '12px',
      lineHeight: 1.6,
      margin: 0,
      padding: 0,
      color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
    }}>
      {hunks.map((h, idx) => {
        const bg = h.type === 'added'
          ? 'rgba(34,197,94,0.08)'
          : h.type === 'removed'
          ? 'rgba(239,68,68,0.08)'
          : 'transparent';
        const borderLeft = h.type === 'added'
          ? '2px solid rgba(34,197,94,0.6)'
          : h.type === 'removed'
          ? '2px solid rgba(239,68,68,0.5)'
          : '2px solid transparent';
        const prefix = h.type === 'added' ? '+ ' : h.type === 'removed' ? '- ' : '  ';
        return (
          <div
            key={idx}
            style={{
              background: bg,
              borderLeft,
              paddingLeft: '10px',
              textDecoration: h.type === 'removed' ? 'line-through' : 'none',
              color: h.type === 'removed' ? (isDark ? 'rgba(239,68,68,0.7)' : 'rgba(200,30,30,0.8)') : undefined,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {prefix}{h.line}
          </div>
        );
      })}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CanvasPanel({ content, onClose, onDownload, onEditModeChange, isAIWriting = false }: CanvasPanelProps) {
  const { isDarkMode } = useTheme();

  // Version history (up to 20)
  const [versions, setVersions] = useState<Version[]>([{ id: '0', timestamp: Date.now(), content: content.content }]);
  const [versionIndex, setVersionIndex] = useState(0);
  const prevContentRef = useRef(content.content);

  // Track content prop changes → push new version
  useEffect(() => {
    if (content.content !== prevContentRef.current) {
      prevContentRef.current = content.content;
      setVersions(prev => {
        const next = [...prev, { id: Date.now().toString(), timestamp: Date.now(), content: content.content }];
        if (next.length > 20) next.shift();
        return next;
      });
      setVersionIndex(prev => Math.min(prev + 1, 19));
    }
  }, [content.content]);

  // Current displayed content (may differ if navigating versions)
  const currentContent = versions[versionIndex]?.content ?? content.content;

  // Editable title
  const [title, setTitle] = useState(content.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  // UI state
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [previewTab, setPreviewTab] = useState<'code' | 'preview'>('code');

  // Code execution state
  const [runOutput, setRunOutput] = useState<{ text: string; error: boolean } | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source === iframeRef.current?.contentWindow) {
        if (e.data?.error) setIframeError(String(e.data.error));
        else if (e.data?.clearError) setIframeError(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Notify parent of edit mode (no edit mode in new design — read-only view with action pills)
  useEffect(() => {
    onEditModeChange?.(false);
  }, [onEditModeChange]);

  // Canvas width
  const getWidth = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    if (w < 640) return 70;
    if (w < 1024) return 45;
    return 45;
  };
  const [canvasWidth, setCanvasWidth] = useState(getWidth);
  useEffect(() => {
    const onResize = () => setCanvasWidth(getWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentContent]);

  const handleDownload = useCallback(() => {
    const blob = content.blob ?? new Blob([currentContent], { type: 'text/plain' });
    onDownload?.(blob, title || content.title);
  }, [content.blob, currentContent, onDownload, title, content.title]);

  const dispatchAction = useCallback((action: string) => {
    window.dispatchEvent(new CustomEvent('neuro-canvas-action', {
      detail: { action, content: currentContent },
    }));
  }, [currentContent]);

  const handleRun = useCallback(() => {
    setRunOutput(null);
    if (canRunJS(content)) {
      try {
        const code = `try { ${currentContent} } catch(e) { postMessage({ error: e.message }) }`;
        const blob = new Blob([code], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = (e) => {
          if (e.data?.error) {
            setRunOutput({ text: e.data.error, error: true });
          } else {
            setRunOutput({ text: String(e.data ?? '(no output)'), error: false });
          }
          worker.terminate();
        };
        worker.onerror = (e) => {
          setRunOutput({ text: e.message || 'Worker error', error: true });
          worker.terminate();
        };
      } catch (e: any) {
        setRunOutput({ text: e.message || 'Failed to run', error: true });
      }
    }
  }, [content, currentContent]);

  // Navigation
  const canGoBack = versionIndex > 0;
  const canGoForward = versionIndex < versions.length - 1;

  const navigateVersion = (delta: number) => {
    setVersionIndex(i => Math.max(0, Math.min(versions.length - 1, i + delta)));
  };

  // Diff: compare current version with previous
  const prevVersionContent = versionIndex > 0 ? versions[versionIndex - 1].content : '';
  const hasPrevForDiff = versionIndex > 0;

  // Language label
  const langLabel = getLanguageLabel(content);

  // ---------------------------------------------------------------------------
  // Colors
  // ---------------------------------------------------------------------------

  const bg = isDarkMode ? '#141420' : '#EEECEA';
  const border = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.85)';
  const textDim = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';

  // ---------------------------------------------------------------------------
  // Render content (code tab / static view)
  // ---------------------------------------------------------------------------

  function renderMainContent() {
    if (showDiff && hasPrevForDiff) {
      return (
        <div style={{ padding: '16px' }}>
          <DiffView oldText={prevVersionContent} newText={currentContent} isDark={isDarkMode} />
        </div>
      );
    }

    const isHTML = canRunHTML(content);
    const isJS = canRunJS(content);

    if (isHTML) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Code / Preview tabs */}
          <div style={{
            display: 'flex',
            gap: '2px',
            padding: '8px 16px 0',
            borderBottom: `1px solid ${border}`,
          }}>
            {(['code', 'preview'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPreviewTab(tab)}
                style={{
                  padding: '5px 12px',
                  border: 'none',
                  borderRadius: '5px 5px 0 0',
                  background: previewTab === tab
                    ? isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                    : 'transparent',
                  color: previewTab === tab ? textPrimary : textDim,
                  fontSize: '11px',
                  fontFamily: FONT_FAMILY,
                  cursor: 'pointer',
                  fontWeight: previewTab === tab ? 500 : 400,
                  borderBottom: previewTab === tab ? `2px solid ${isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}` : '2px solid transparent',
                  transition: 'all 0.12s',
                }}
              >
                {tab === 'code' ? 'Code' : 'Preview'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {previewTab === 'code' ? (
              <div style={{ height: '100%', overflow: 'auto', padding: '16px' }}>
                <pre style={{
                  margin: 0,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: '12px',
                  lineHeight: 1.65,
                  color: textPrimary,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  <code>{currentContent}</code>
                </pre>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                sandbox="allow-scripts allow-same-origin"
                srcDoc={currentContent}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="preview"
              />
            )}
          </div>
          {iframeError && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(239,68,68,0.1)',
              borderTop: '1px solid rgba(239,68,68,0.2)',
              color: isDarkMode ? 'rgba(239,68,68,0.85)' : 'rgba(185,28,28,0.9)',
              fontSize: '11px',
              fontFamily: FONT_FAMILY_MONO,
            }}>
              Error: {iframeError}
              <button
                onClick={() => setIframeError(null)}
                style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: '11px' }}
              >
                dismiss
              </button>
            </div>
          )}
        </div>
      );
    }

    if (content.fileType === 'code' || content.fileType === 'txt') {
      return (
        <div style={{ height: '100%', overflow: 'auto', padding: '16px' }}>
          <pre style={{
            margin: 0,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: '12px',
            lineHeight: 1.65,
            color: textPrimary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            <code>{currentContent}</code>
          </pre>
        </div>
      );
    }

    if (content.fileType === 'md') {
      return (
        <div style={{ height: '100%', overflow: 'auto', padding: '20px 24px', fontSize: '13px', lineHeight: 1.7, fontFamily: FONT_FAMILY }}>
          <MarkdownView text={currentContent} isDark={isDarkMode} />
        </div>
      );
    }

    if (content.fileType === 'pdf' || content.fileType === 'docx') {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: textDim }}>
          <div style={{ fontSize: '11px' }}>
            {content.fileType === 'pdf' ? 'PDF preview not available' : 'Word document preview not available'}
          </div>
          <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.7 }}>Use Download to open in the appropriate application.</div>
        </div>
      );
    }

    return (
      <div style={{ padding: '16px', color: textDim, fontSize: '12px' }}>Unsupported file type.</div>
    );
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: `${canvasWidth}%` }}
        exit={{ opacity: 0, width: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'relative',
          width: `${canvasWidth}%`,
          minWidth: 0,
          height: '100%',
          background: bg,
          borderLeft: `1px solid ${border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* ---- Header ---- */}
        <div style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '44px',
        }}>
          {/* Left: editable title */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}`,
                  outline: 'none',
                  color: textPrimary,
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  width: '100%',
                  padding: '1px 2px',
                }}
                autoFocus
              />
            ) : (
              <span
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: textPrimary,
                  cursor: 'text',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {title || content.title}
              </span>
            )}
          </div>

          {/* Center: language badge */}
          <span style={{
            fontSize: '10px',
            color: textDim,
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            padding: '2px 7px',
            borderRadius: '4px',
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}>
            {langLabel}
          </span>

          {/* Streaming indicator */}
          {content.isWriting && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', flexShrink: 0 }}
            />
          )}

          {/* Version info */}
          {versions.length > 1 && (
            <span style={{ fontSize: '10px', color: textDim, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {versionIndex + 1}/{versions.length}
            </span>
          )}

          {/* Right: icon buttons */}
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
            <IconButton onClick={() => navigateVersion(-1)} disabled={!canGoBack} title="Previous version" isDark={isDarkMode}>
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton onClick={() => navigateVersion(1)} disabled={!canGoForward} title="Next version" isDark={isDarkMode}>
              <ChevronRight size={14} />
            </IconButton>
            <IconButton
              onClick={() => setShowDiff(d => !d)}
              disabled={!hasPrevForDiff}
              title={showDiff ? 'Hide changes' : 'Show changes'}
              active={showDiff}
              isDark={isDarkMode}
            >
              {showDiff ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconButton>
            <IconButton onClick={handleCopy} title={copied ? 'Copied!' : 'Copy'} active={copied} isDark={isDarkMode}>
              <Copy size={14} />
            </IconButton>
            <IconButton onClick={handleDownload} title="Download" isDark={isDarkMode}>
              <Download size={14} />
            </IconButton>
            <IconButton onClick={onClose} title="Close" isDark={isDarkMode}>
              <X size={14} />
            </IconButton>
          </div>
        </div>

        {/* ---- Shortcut pills ---- */}
        <div style={{
          padding: '7px 12px',
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          gap: '6px',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {isCodeFile(content) ? (
            <>
              <Pill label="Review" onClick={() => dispatchAction('review')} isDark={isDarkMode} />
              <Pill label="Fix bugs" onClick={() => dispatchAction('fix_bugs')} isDark={isDarkMode} />
              <Pill label="Add comments" onClick={() => dispatchAction('add_comments')} isDark={isDarkMode} />
              <Pill label="Add logs" onClick={() => dispatchAction('add_logs')} isDark={isDarkMode} />
              {canRunHTML(content) ? (
                <Pill label="Run" onClick={() => setPreviewTab('preview')} isDark={isDarkMode} />
              ) : canRunJS(content) ? (
                <Pill label="Run" onClick={handleRun} isDark={isDarkMode} />
              ) : (
                <Pill label="Run" disabled isDark={isDarkMode} title="Run supported for HTML and JavaScript" />
              )}
            </>
          ) : isTextFile(content) ? (
            <>
              <Pill label="Shorter" onClick={() => dispatchAction('shorter')} isDark={isDarkMode} />
              <Pill label="Longer" onClick={() => dispatchAction('longer')} isDark={isDarkMode} />
              <Pill label="Polish" onClick={() => dispatchAction('polish')} isDark={isDarkMode} />
              <Pill label="Simplify" onClick={() => dispatchAction('simplify')} isDark={isDarkMode} />
            </>
          ) : null}
        </div>

        {/* ---- Main content area ---- */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderMainContent()}
        </div>

        {/* ---- JS Run output panel ---- */}
        {runOutput && (
          <div style={{
            padding: '8px 16px',
            borderTop: `1px solid ${border}`,
            background: isDarkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
            fontFamily: FONT_FAMILY_MONO,
            fontSize: '11px',
            color: runOutput.error
              ? (isDarkMode ? 'rgba(239,68,68,0.85)' : 'rgba(185,28,28,0.9)')
              : textPrimary,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <span style={{ color: textDim, userSelect: 'none', flexShrink: 0 }}>output</span>
            <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{runOutput.text}</span>
            <button
              onClick={() => setRunOutput(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: textDim, fontSize: '11px', flexShrink: 0 }}
            >
              clear
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
