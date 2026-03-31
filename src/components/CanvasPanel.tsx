/**
 * Canvas Side Panel — Document preview & editing with live updates
 *
 * Slides in from right side (45% of viewport) when agent generates documents.
 * Supports DOCX, PDF, Markdown, HTML, Code rendering with real-time animations.
 * Export options: Copy, Download, Save to VFS.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

export function CanvasPanel({ content, onClose, onDownload }: CanvasPanelProps) {
  const { isDarkMode } = useTheme();
  const [copiedRecently, setCopiedRecently] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const wordCount = content.content.split(/\s+/).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '45%',
          height: '100vh',
          background: isDarkMode ? 'rgb(18,18,26)' : '#ffffff',
          borderLeft: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2000,
          boxShadow: isDarkMode ? '0 -10px 40px rgba(0,0,0,0.3)' : '0 -10px 40px rgba(0,0,0,0.08)',
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
          {content.isWriting ? (
            <div style={{ color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}>
              {content.content}
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
            renderContent(content, isDarkMode)
          )}
        </div>

        {/* Status footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
            fontSize: '10px',
            color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
            textAlign: 'right',
            fontFamily: FONT_FAMILY,
          }}
        >
          {content.isWriting ? (
            <span style={{ color: '#3b82f6' }}>✨ Generating...</span>
          ) : (
            <span>✓ Complete</span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
