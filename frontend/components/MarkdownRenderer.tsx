import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import React, { useState, useMemo } from 'react';
import { SourceChips, ChartBlock, WidgetWeatherCard, WidgetTimeCard, type ChartSpec, type WidgetWeatherData, type WidgetTimeData } from './DataViz';

interface MarkdownRendererProps {
  content: string;
  onSaveFile?: (filename: string, content: string) => void;
  onFileClick?: (filePath: string) => void;
}

/* ── File path detection ──────────────────────────────── */

/**
 * Detect if a URL-like string is actually a file path (not a web URL)
 * File paths: /path/to/file.md, ./relative/file.txt, ~/user/file.json
 * Web URLs: http://example.com, https://example.com, www.example.com
 */
function isFilePath(href: string): boolean {
  if (!href) return false;
  // Web URLs
  if (/^https?:\/\//.test(href) || /^www\./.test(href)) return false;
  // File paths
  if (/^[/~.]/.test(href)) return true;
  // Relative paths with extension
  if (/\.[a-z]{2,4}$/i.test(href) && !href.includes('://')) return true;
  return false;
}

/**
 * Get a readable filename from a file path
 */
function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Get file icon based on extension
 */
function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    'md': '📝',
    'txt': '📄',
    'json': '{}',
    'js': '🟨',
    'ts': '🔵',
    'tsx': '⚛️',
    'jsx': '⚛️',
    'css': '🎨',
    'html': '🌐',
    'py': '🐍',
    'sh': '🔧',
    'yaml': '⚙️',
    'yml': '⚙️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🎬',
    'pdf': '📕',
    'docx': '📘',
    'xlsx': '📊',
  };
  return icons[ext] || '📎';
}

/* ── Source-line parser ───────────────────────────────── */

const SOURCES_HEADING = /^##\s+Sources\s*$/m;
// Matches lines like: [1] Title - https://example.com  or  [1] Title — https://example.com
// More robust: handles URLs on same line OR next line
const SOURCE_LINE = /^\[(\d+)\]\s+(.+?)(?:\s*[-–—]\s*(https?:\/\/\S+))?$/;
const SOURCE_URL_LINE = /^(https?:\/\/\S+)\s*$/;
// Snippet line that follows a source line
const SNIPPET_LINE = /^snippet:\s*(.+)/i;

function extractSources(content: string): {
  body: string;
  sources: Array<{ index: number; title: string; url: string; snippet?: string }> | null;
} {
  const headingMatch = content.match(SOURCES_HEADING);
  if (!headingMatch || headingMatch.index === undefined) {
    return { body: content, sources: null };
  }

  const before = content.slice(0, headingMatch.index).trimEnd();
  const afterBlock = content.slice(headingMatch.index + headingMatch[0].length).trim();

  const lines = afterBlock.split('\n');
  const sources: Array<{ index: number; title: string; url: string; snippet?: string }> = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }
    const m = trimmed.match(SOURCE_LINE);
    if (m) {
      const source: { index: number; title: string; url: string; snippet?: string } = {
        index: parseInt(m[1], 10),
        title: m[2].trim(),
        url: m[3]?.trim() || '',
      };

      // If URL wasn't on same line, check next line
      if (!source.url) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.match(SOURCE_URL_LINE)) {
          source.url = nextLine;
          i++; // consume the URL line
        }
      }

      // Check for snippet line
      const nextLine = lines[i + 1]?.trim();
      if (nextLine) {
        const sm = nextLine.match(SNIPPET_LINE);
        if (sm) {
          source.snippet = sm[1].trim();
          i++; // consume the snippet line too
        }
      }

      if (source.url) {
        sources.push(source);
      }
    } else {
      // Non-source line after heading — stop parsing
      break;
    }
    i++;
  }

  if (sources.length === 0) {
    return { body: content, sources: null };
  }

  return { body: before, sources };
}

/* ── Smart text processing ────────────────────────────── */

/**
 * Apply smart typography to text:
 * - Smart quotes: "text" → "text"
 * - Proper em-dashes: -- → —
 * - Better spacing around punctuation
 */
function applySmartTypography(text: string): string {
  if (!text) return text;

  let result = text;

  // Replace ... with ellipsis
  result = result.replace(/\.\.\./g, '…');

  return result;
}

/* ── Copy button ──────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-bg-light)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

/* ── Main renderer ────────────────────────────────────── */

/** Render inline [N] citation markers as clickable superscripts */
function CitationInline({ num, sources }: { num: number; sources: Array<{ index: number; title: string; url: string }> | null }) {
  const [tip, setTip] = useState(false);
  const src = sources?.find(s => s.index === num);
  if (!src) return <>[{num}]</>;
  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <sup>
        <a
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => { e.stopPropagation(); }}
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          style={{
            color: 'rgba(59,130,246,0.8)', textDecoration: 'none',
            fontSize: '0.7em', fontWeight: 600, padding: '0 2px',
            borderRadius: 3, background: 'rgba(59,130,246,0.1)',
            cursor: 'pointer', transition: 'all 0.12s',
          }}
        >
          {num}
        </a>
      </sup>
      {tip && (
        <span style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,18,0.97)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 6, padding: '5px 9px', fontSize: 10, whiteSpace: 'nowrap',
          color: 'rgba(255,255,255,0.8)', zIndex: 50, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', maxWidth: 220,
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {src.title}
        </span>
      )}
    </span>
  );
}

/** Inject inline citation components into a text node */
function renderWithCitations(text: string, sources: Array<{ index: number; title: string; url: string }> | null): React.ReactNode[] {
  if (!sources || sources.length === 0) return [text];
  const parts: React.ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (sources.some(s => s.index === num)) {
      if (match.index > last) parts.push(text.slice(last, match.index));
      parts.push(<CitationInline key={`cit-${match.index}`} num={num} sources={sources} />);
      last = match.index + match[0].length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

export function MarkdownRenderer({ content, onSaveFile, onFileClick }: MarkdownRendererProps) {
  const { body, sources } = useMemo(() => extractSources(content), [content]);

  return (
    <div className="markdown-body" style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Code blocks
          pre({ children, ...props }) {
            // If the child is a ChartBlock, skip the code-block styling
            const hasChart = Array.isArray(children)
              ? (children as React.ReactNode[]).some((c) => React.isValidElement(c) && (c.props as any)?.['data-chart'])
              : React.isValidElement(children) && (children as any).props?.['data-chart'];
            if (hasChart) return <>{children}</>;
            return (
              <pre
                {...props}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--glass-bg-light)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  overflowX: 'auto',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: '12px 0',
                  position: 'relative',
                }}
              >
                {children}
              </pre>
            );
          },
          code({ node, className, children, ...props }: any) {
            const isBlock = !!className;
            const codeText = String(children).replace(/\n$/, '');
            const lang = className?.replace('language-', '') || '';

            // ── Widget blocks: render as rich cards ──
            if (isBlock && lang === 'chart') {
              try {
                const spec = JSON.parse(codeText) as ChartSpec;
                return <ChartBlock spec={spec} />;
              } catch { /* fall through */ }
            }
            if (isBlock && lang === 'widget-weather') {
              try {
                const data = JSON.parse(codeText) as WidgetWeatherData;
                return <WidgetWeatherCard data={data} />;
              } catch { /* fall through */ }
            }
            if (isBlock && lang === 'widget-time') {
              try {
                const data = JSON.parse(codeText) as WidgetTimeData;
                return <WidgetTimeCard data={data} />;
              } catch { /* fall through */ }
            }
            if (!isBlock) {
              return (
                <code
                  style={{
                    background: 'rgba(234,88,12,0.08)',
                    color: 'rgba(234,88,12,0.85)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: '0.9em',
                    fontFamily: '"SF Mono", "Monaco", monospace',
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 4px', borderBottom: '1px solid var(--glass-border-light)', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{lang || 'code'}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onSaveFile && codeText.split('\n').length >= 5 && (
                      <button
                        onClick={() => {
                          const ext = lang === 'python' ? 'py' : lang === 'typescript' || lang === 'ts' ? 'ts' : lang === 'javascript' || lang === 'js' ? 'js' : lang === 'bash' || lang === 'sh' ? 'sh' : lang === 'css' ? 'css' : lang === 'html' ? 'html' : lang === 'json' ? 'json' : 'txt';
                          const filename = `script.${ext}`;
                          onSaveFile(filename, codeText);
                        }}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.2)', color: 'rgba(234,88,12,0.7)', cursor: 'pointer' }}
                      >
                        save file
                      </button>
                    )}
                    <CopyButton text={codeText} />
                  </div>
                </div>
                <code className={className} {...props}>{children}</code>
              </div>
            );
          },
          // Tables
          table({ children }) {
            return (
              <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid var(--glass-bg-light)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, background: 'rgba(0,0,0,0.1)' }}>{children}</th>;
          },
          td({ children }) {
            return <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--glass-border-light)', color: 'var(--text-primary)' }}>{children}</td>;
          },
          // Headings — improved spacing and visual hierarchy
          h1({ children }) {
            const text = typeof children === 'string' ? applySmartTypography(children) : children;
            return <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 12px', borderBottom: '2px solid var(--glass-bg-light)', paddingBottom: 8, letterSpacing: '-0.5px' }}>{text}</h1>;
          },
          h2({ children }) {
            const text = typeof children === 'string' ? applySmartTypography(children) : children;
            return <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{text}</h2>;
          },
          h3({ children }) {
            const text = typeof children === 'string' ? applySmartTypography(children) : children;
            return <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.95)', margin: '12px 0 6px', opacity: 0.95 }}>{text}</h3>;
          },
          // Lists — better spacing and visual separation
          ul({ children }) { return <ul style={{ paddingLeft: 20, margin: '8px 0', listStyleType: 'disc' }}>{children}</ul>; },
          ol({ children }) { return <ol style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ol>; },
          li({ children }) {
            const processedChildren = React.Children.map(children, (child) => {
              if (typeof child !== 'string') return child;
              return applySmartTypography(child);
            });
            return <li style={{ margin: '4px 0', color: 'var(--text-primary)', lineHeight: 1.6 }}>{processedChildren}</li>;
          },
          // Blockquote — more prominent styling with smart typography
          blockquote({ children }) {
            const processedChildren = React.Children.map(children, (child) => {
              if (typeof child !== 'string') return child;
              return applySmartTypography(child);
            });
            return <blockquote style={{ borderLeft: '3px solid rgba(234,88,12,0.5)', paddingLeft: 12, paddingRight: 8, margin: '10px 0', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', background: 'rgba(234,88,12,0.04)', padding: '8px 12px', borderRadius: 4 }}>{processedChildren}</blockquote>;
          },
          // Paragraph — inject inline citation superscripts for [N] markers + smart typography
          p({ children }) {
            const processedChildren = React.Children.map(children, (child) => {
              if (typeof child !== 'string') return child;
              const smartText = applySmartTypography(child);
              const parts = renderWithCitations(smartText, sources);
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
            });
            return <p style={{ margin: '6px 0', color: 'var(--text-primary)', lineHeight: 1.7 }}>{processedChildren}</p>;
          },
          // Strong/em — better visual distinction
          strong({ children }) { return <strong style={{ color: 'var(--text-primary)', fontWeight: 700, opacity: 1 }}>{children}</strong>; },
          em({ children }) { return <em style={{ color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', opacity: 0.95 }}>{children}</em>; },
          // Links — detect file paths and render as clickable file links
          a({ href, children }) {
            if (!href) return <span>{children}</span>;

            // Check if this is a file path
            if (isFilePath(href) && onFileClick) {
              const fileName = getFileName(href);
              const icon = getFileIcon(href);
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onFileClick(href);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(59,130,246,0.85)',
                    textDecoration: 'underline',
                    textDecorationStyle: 'dotted',
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    const btn = e.currentTarget;
                    btn.style.color = 'rgba(59,130,246,1)';
                    btn.style.textDecorationStyle = 'solid';
                    btn.style.fontWeight = '500';
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.currentTarget;
                    btn.style.color = 'rgba(59,130,246,0.85)';
                    btn.style.textDecorationStyle = 'dotted';
                    btn.style.fontWeight = 'normal';
                  }}
                  title={`Click to preview: ${href}`}
                >
                  {icon} {children || fileName}
                </button>
              );
            }

            // Regular web links
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'rgba(234,88,12,0.85)',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'rgba(234,88,12,1)';
                  e.currentTarget.style.fontWeight = '500';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(234,88,12,0.85)';
                  e.currentTarget.style.fontWeight = 'normal';
                }}
              >
                {children}
              </a>
            );
          },
          // HR — visual separator with better spacing
          hr() { return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0' }} />; },
        }}
      >
        {body}
      </ReactMarkdown>

      {sources && sources.length > 0 && (
        <SourceChips sources={sources} />
      )}
    </div>
  );
}
