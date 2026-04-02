/**
 * Editable Textarea Component
 * Auto-expand height, line numbers, Tab = indent, undo/redo support
 */

import { useRef, useEffect } from 'react';
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, getColorScheme } from '../../styles/canvasStyles';
import '../../styles/canvasButtons.css';

interface EditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isDarkMode: boolean;
  isAIWriting?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

export function EditableTextarea({
  value,
  onChange,
  disabled = false,
  isDarkMode,
  isAIWriting = false,
  autoFocus = true,
  placeholder = 'Enter your text here...',
}: EditableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const colors = getColorScheme(isDarkMode);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-expand textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, window.innerHeight - 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!disabled) {
      onChange(e.target.value);
      // Auto-expand
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight - 200) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;

    // Tab = indent (not blur)
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '\t' + value.substring(end);
      onChange(newValue);

      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }, 0);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      className="canvas-textarea"
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{
        width: '100%',
        minHeight: '400px',
        maxHeight: `calc(100vh - 200px)`,
        padding: CANVAS_SPACING.lg,
        borderRadius: CANVAS_SPACING.md,
        border: `1px solid ${disabled ? colors.errorBorder : colors.border}`,
        background: disabled ? `${colors.errorBg}` : colors.bgSubtle,
        color: colors.textSecondary,
        fontFamily: 'monospace',
        fontSize: CANVAS_FONT_SIZE.base,
        lineHeight: '1.6',
        resize: 'none',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
        transition: `all 0.15s`,
      }}
      aria-label="Edit content"
      aria-disabled={disabled}
      spellCheck="true"
    />
  );
}
