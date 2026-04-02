/**
 * Text Renderer Component
 * Plain text display with minimal formatting
 */

import { CANVAS_COLORS, CANVAS_FONT_SIZE, getColorScheme } from '../../styles/canvasStyles';

interface TextRendererProps {
  content: string;
  isDarkMode: boolean;
}

export function TextRenderer({ content, isDarkMode }: TextRendererProps) {
  const colors = getColorScheme(isDarkMode);

  return (
    <pre
      style={{
        fontSize: CANVAS_FONT_SIZE.lg,
        lineHeight: 1.6,
        color: colors.textSecondary,
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        fontFamily: 'monospace',
        margin: 0,
      }}
    >
      {content}
    </pre>
  );
}
