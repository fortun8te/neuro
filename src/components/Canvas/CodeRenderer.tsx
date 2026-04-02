/**
 * Code Renderer Component
 * Language-specific syntax highlighting with Highlight.js
 */

import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import DOMPurify from 'dompurify';
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, getColorScheme } from '../../styles/canvasStyles';

interface CodeRendererProps {
  content: string;
  language?: string;
  isDarkMode: boolean;
}

export function CodeRenderer({ content, language = 'plaintext', isDarkMode }: CodeRendererProps) {
  const colors = getColorScheme(isDarkMode);

  let highlightedCode = content;
  try {
    if (language && language !== 'plaintext' && language !== 'txt') {
      highlightedCode = hljs.highlight(content, { language, ignoreIllegals: true }).value;
    } else {
      highlightedCode = hljs.highlight(content, { language: 'plaintext' }).value;
    }
  } catch {
    highlightedCode = hljs.highlight(content, { language: 'plaintext' }).value;
  }

  const lines = content.split('\n');
  const lineNumbers = lines.map((_, i) => i + 1).join('\n');

  return (
    <div
      style={{
        display: 'flex',
        background: colors.codeBg,
        borderRadius: CANVAS_SPACING.md,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Line numbers */}
      <pre
        style={{
          background: colors.hover,
          borderRight: `1px solid ${colors.border}`,
          padding: `${CANVAS_SPACING.lg} ${CANVAS_SPACING.md}`,
          margin: 0,
          color: colors.textQuaternary,
          fontSize: CANVAS_FONT_SIZE.sm,
          lineHeight: '1.6',
          fontFamily: 'monospace',
          overflow: 'hidden',
          textAlign: 'right',
          userSelect: 'none',
          minWidth: '2.5em',
        }}
      >
        {lineNumbers}
      </pre>

      {/* Code content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <pre
          style={{
            padding: `${CANVAS_SPACING.lg} ${CANVAS_SPACING.lg}`,
            margin: 0,
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: CANVAS_FONT_SIZE.sm,
            lineHeight: '1.6',
          }}
        >
          <code
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedCode) }}
            style={{
              color: colors.textSecondary,
            }}
          />
        </pre>
      </div>
    </div>
  );
}
