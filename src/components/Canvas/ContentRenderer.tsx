/**
 * Content Renderer Component
 * Routes to specialized renderers based on file type
 */

import DOMPurify from 'dompurify';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeRenderer } from './CodeRenderer';
import { TextRenderer } from './TextRenderer';
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, getColorScheme } from '../../styles/canvasStyles';

export interface ContentRendererContent {
  fileType: 'docx' | 'pdf' | 'md' | 'html' | 'txt' | 'code';
  content: string;
  language?: string;
}

interface ContentRendererProps {
  content: ContentRendererContent;
  isDarkMode: boolean;
}

export function ContentRenderer({ content, isDarkMode }: ContentRendererProps) {
  const colors = getColorScheme(isDarkMode);
  const { fileType, content: text, language } = content;

  switch (fileType) {
    case 'md':
      return <MarkdownRenderer content={text} isDarkMode={isDarkMode} />;

    case 'code':
      return <CodeRenderer content={text} language={language} isDarkMode={isDarkMode} />;

    case 'txt':
      return <TextRenderer content={text} isDarkMode={isDarkMode} />;

    case 'html':
      return (
        <div
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }}
          style={{ color: colors.textSecondary }}
          role="article"
        />
      );

    case 'pdf':
      return (
        <div
          style={{
            padding: CANVAS_SPACING.xl,
            background: colors.bgSubtle,
            borderRadius: CANVAS_SPACING.lg,
            textAlign: 'center',
            color: colors.textTertiary,
          }}
          role="status"
        >
          <div style={{ fontSize: CANVAS_FONT_SIZE.base, marginBottom: CANVAS_SPACING.md }}>PDF Preview</div>
          <div style={{ fontSize: CANVAS_FONT_SIZE.sm }}>
            PDF rendering not yet supported in preview. Use Download to view.
          </div>
        </div>
      );

    case 'docx':
      return (
        <div
          style={{
            padding: CANVAS_SPACING.xl,
            background: colors.bgSubtle,
            borderRadius: CANVAS_SPACING.lg,
            textAlign: 'center',
            color: colors.textTertiary,
          }}
          role="status"
        >
          <div style={{ fontSize: CANVAS_FONT_SIZE.base, marginBottom: CANVAS_SPACING.md }}>Word Document</div>
          <div style={{ fontSize: CANVAS_FONT_SIZE.sm }}>
            Use Download button to view full formatting in Microsoft Word.
          </div>
        </div>
      );

    default:
      return (
        <div style={{ color: colors.textTertiary }}>
          Unsupported file type
        </div>
      );
  }
}
