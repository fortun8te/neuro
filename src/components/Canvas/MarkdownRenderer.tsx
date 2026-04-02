/**
 * Markdown Renderer Component
 * GFM support with Highlight.js syntax highlighting
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import DOMPurify from 'dompurify';
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, getColorScheme } from '../../styles/canvasStyles';
import { SemanticHighlight } from './SemanticHighlight';
import { CalloutBox } from './CalloutBox';
import { Badge } from './Badge';
import { DataTable, type Column } from './DataTable';

interface MarkdownRendererProps {
  content: string;
  isDarkMode: boolean;
}

/**
 * Parse semantic highlight markers ([KEY], [WARN], [INSIGHT], [EVIDENCE], [NOTE])
 * and convert to React components
 */
function renderHighlightedContent(text: string, isDarkMode: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const highlightRegex = /\[(KEY|WARN|INSIGHT|EVIDENCE|NOTE)\]\s*([^\n]*)/g;
  let lastIndex = 0;

  let match;
  while ((match = highlightRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const type = match[1].toLowerCase() as 'key' | 'warn' | 'insight' | 'evidence' | 'note';
    const content = match[2];

    parts.push(
      <SemanticHighlight key={`${type}-${match.index}`} type={type} isDarkMode={isDarkMode}>
        {content}
      </SemanticHighlight>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function MarkdownRenderer({ content, isDarkMode }: MarkdownRendererProps) {
  const colors = getColorScheme(isDarkMode);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match?.[1] || 'text';
          const codeString = String(children).replace(/\n$/, '');

          if (inline) {
            return (
              <code
                style={{
                  background: colors.inlineCodeBg,
                  padding: '2px 4px',
                  borderRadius: CANVAS_SPACING.sm,
                  fontFamily: 'monospace',
                  fontSize: CANVAS_FONT_SIZE.sm,
                  color: colors.textSecondary,
                }}
                {...props}
              >
                {children}
              </code>
            );
          }

          let highlightedCode = codeString;
          try {
            highlightedCode = hljs.highlight(codeString, { language, ignoreIllegals: true }).value;
          } catch {
            // Fallback to plain text if language not supported
            highlightedCode = hljs.highlight(codeString, { language: 'plaintext' }).value;
          }

          return (
            <div
              style={{
                position: 'relative',
                background: colors.codeBg,
                padding: CANVAS_SPACING.lg,
                borderRadius: CANVAS_SPACING.md,
                overflow: 'auto',
                border: `1px solid ${colors.border}`,
                marginBottom: CANVAS_SPACING.lg,
              }}
            >
              {language && language !== 'text' && (
                <div
                  style={{
                    position: 'absolute',
                    top: CANVAS_SPACING.sm,
                    right: CANVAS_SPACING.md,
                    fontSize: CANVAS_FONT_SIZE.xs,
                    color: colors.textQuaternary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {language}
                </div>
              )}
              <pre
                style={{
                  margin: 0,
                  overflow: 'auto',
                }}
              >
                <code
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedCode) }}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: CANVAS_FONT_SIZE.sm,
                    lineHeight: '1.5',
                    color: colors.textSecondary,
                  }}
                />
              </pre>
            </div>
          );
        },
        h1: ({ node, ...props }: any) => (
          <h1
            style={{
              fontSize: CANVAS_FONT_SIZE['3xl'],
              fontWeight: 700,
              marginTop: CANVAS_SPACING.xxl,
              marginBottom: CANVAS_SPACING.lg,
              color: colors.text,
            }}
            {...props}
          />
        ),
        h2: ({ node, ...props }: any) => (
          <h2
            style={{
              fontSize: CANVAS_FONT_SIZE['2xl'],
              fontWeight: 600,
              marginTop: CANVAS_SPACING.xl,
              marginBottom: CANVAS_SPACING.lg,
              color: colors.text,
            }}
            {...props}
          />
        ),
        h3: ({ node, ...props }: any) => (
          <h3
            style={{
              fontSize: CANVAS_FONT_SIZE.xl,
              fontWeight: 600,
              marginTop: CANVAS_SPACING.lg,
              marginBottom: CANVAS_SPACING.md,
              color: colors.textSecondary,
            }}
            {...props}
          />
        ),
        p: ({ node, children, ...props }: any) => {
          // Check if this paragraph contains semantic highlight markers
          const textContent = node?.children?.[0]?.value || '';
          const hasHighlights = /\[(KEY|WARN|INSIGHT|EVIDENCE|NOTE)\]/.test(textContent);

          return (
            <p
              style={{
                marginBottom: CANVAS_SPACING.lg,
                lineHeight: 1.6,
                color: colors.textSecondary,
              }}
              {...props}
            >
              {hasHighlights ? renderHighlightedContent(textContent, isDarkMode) : children}
            </p>
          );
        },
        ul: ({ node, ...props }: any) => (
          <ul
            style={{
              marginLeft: CANVAS_SPACING.xl,
              marginBottom: CANVAS_SPACING.lg,
              listStyle: 'disc',
            }}
            {...props}
          />
        ),
        ol: ({ node, ...props }: any) => (
          <ol
            style={{
              marginLeft: CANVAS_SPACING.xl,
              marginBottom: CANVAS_SPACING.lg,
              listStyle: 'decimal',
            }}
            {...props}
          />
        ),
        li: ({ node, ...props }: any) => (
          <li
            style={{
              marginBottom: CANVAS_SPACING.md,
              color: colors.textSecondary,
            }}
            {...props}
          />
        ),
        table: ({ node, children, ...props }: any) => {
          // Extract columns from table header
          const headerRow = node?.children?.[0]?.children || [];
          const bodyRows = node?.children?.[1]?.children || [];

          if (headerRow.length === 0 || bodyRows.length === 0) {
            // Fallback to standard table if structure is unexpected
            return (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: CANVAS_SPACING.lg,
                  border: `1px solid ${colors.border}`,
                }}
                {...props}
              >
                {children}
              </table>
            );
          }

          // Build columns from header cells
          const columns: Column[] = headerRow.map((cell: any, idx: number) => {
            const text = cell.children?.[0]?.value || '';
            return {
              key: `col${idx}`,
              label: text,
              sortable: true,
              align: 'left' as const,
            };
          });

          // Build rows from body cells
          const rows = bodyRows.map((row: any) => {
            const rowObj: Record<string, any> = {};
            row.children?.forEach((cell: any, idx: number) => {
              const text = cell.children?.[0]?.value || '';
              rowObj[`col${idx}`] = text;
            });
            return rowObj;
          });

          return (
            <DataTable
              columns={columns}
              rows={rows}
              isDarkMode={isDarkMode}
              striped={true}
            />
          );
        },
        th: ({ node, ...props }: any) => (
          <th
            style={{
              padding: CANVAS_SPACING.md,
              textAlign: 'left',
              fontWeight: 600,
              background: colors.hover,
              border: `1px solid ${colors.border}`,
            }}
            {...props}
          />
        ),
        td: ({ node, ...props }: any) => (
          <td
            style={{
              padding: CANVAS_SPACING.md,
              border: `1px solid ${colors.border}`,
            }}
            {...props}
          />
        ),
        blockquote: ({ node, ...props }: any) => (
          <blockquote
            style={{
              marginLeft: 0,
              paddingLeft: CANVAS_SPACING.lg,
              borderLeft: `3px solid ${colors.infoText}`,
              color: colors.textTertiary,
              fontStyle: 'italic',
              marginBottom: CANVAS_SPACING.lg,
            }}
            {...props}
          />
        ),
        hr: () => (
          <hr
            style={{
              border: 'none',
              borderTop: `1px solid ${colors.border}`,
              margin: `${CANVAS_SPACING.xl} 0`,
            }}
          />
        ),
        div: ({ node, className, children, ...props }: any) => {
          // Handle callout syntax: ::: tip ... :::
          if (className?.includes('callout-')) {
            const calloutType = className.replace('callout-', '') as 'tip' | 'warning' | 'critical' | 'success' | 'quote';
            return (
              <CalloutBox type={calloutType} isDarkMode={isDarkMode}>
                {children}
              </CalloutBox>
            );
          }
          return <div className={className} {...props}>{children}</div>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
