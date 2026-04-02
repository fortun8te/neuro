/**
 * PermissionApprovalBanner — Inline permission approval UI above the chat input.
 *
 * Renders between the messages area and the input box (NOT as a floating modal).
 * Mirrors the Claude Code permission dialog style: tool name, details, Deny / Allow once.
 */

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../constants/ui';

interface PermissionState {
  prompt: string;
  riskLevel?: 'low' | 'medium' | 'high';
  resolve: (approved: boolean) => void;
}

interface PermissionApprovalBannerProps {
  permission: PermissionState | null;
  onApprove: () => void;
  onDeny: () => void;
}

/** Extract tool name from prompt like "Allow file_write(/path/to/file)?" */
function parseToolName(prompt: string): string {
  const match = prompt.match(/^Allow\s+([a-zA-Z0-9_]+)\s*\(/);
  if (match) return match[1];
  // "Review execution plan and approve to proceed with X(...)?"
  const planMatch = prompt.match(/with\s+([a-zA-Z0-9_]+)\s*\(/);
  if (planMatch) return planMatch[1];
  return 'tool';
}

/** Extract the argument portion from prompt like "Allow file_write(/path/to/file)?" */
function parseToolArgs(prompt: string): string | null {
  const match = prompt.match(/\(([^)]*)\)/);
  if (match && match[1]) return match[1];
  return null;
}

/** Human-readable verb for a tool name */
function toolVerb(toolName: string): string {
  const lower = toolName.toLowerCase();
  if (lower.includes('write') || lower.includes('create') || lower.includes('save')) return 'Write';
  if (lower.includes('read') || lower.includes('get') || lower.includes('fetch')) return 'Read';
  if (lower.includes('delete') || lower.includes('remove')) return 'Delete';
  if (lower.includes('search') || lower.includes('find') || lower.includes('query')) return 'Search';
  if (lower.includes('run') || lower.includes('exec') || lower.includes('code')) return 'Run';
  if (lower.includes('browse') || lower.includes('navigate') || lower.includes('open')) return 'Browse';
  if (lower.includes('memory') || lower.includes('store')) return 'Store';
  return 'Run';
}

/** Short description of what a tool does */
function toolDescription(toolName: string): string {
  const lower = toolName.toLowerCase();
  if (lower.includes('file_write') || lower.includes('write_file')) return 'Write content to a file on disk';
  if (lower.includes('file_read') || lower.includes('read_file')) return 'Read a file from disk';
  if (lower.includes('file_delete') || lower.includes('delete_file')) return 'Permanently delete a file';
  if (lower.includes('code') || lower.includes('exec') || lower.includes('run')) return 'Execute code in a sandboxed environment';
  if (lower.includes('browse') || lower.includes('navigate')) return 'Navigate to and read a web page';
  if (lower.includes('search')) return 'Search the web for information';
  if (lower.includes('memory')) return 'Read or write to persistent memory';
  if (lower.includes('computer') || lower.includes('screenshot')) return 'Take a screenshot or interact with the screen';
  return 'Execute this tool action';
}

/** Risk level accent color (border left strip) */
function getRiskColor(riskLevel?: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'high':   return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low':
    default:       return '#3b82f6';
  }
}

export function PermissionApprovalBanner({
  permission,
  onApprove,
  onDeny,
}: PermissionApprovalBannerProps) {
  const { isDarkMode } = useTheme();

  // Keyboard shortcuts: Esc = deny, Cmd+Enter = allow
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!permission) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onDeny();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onApprove();
      }
    },
    [permission, onApprove, onDeny],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toolName = permission ? parseToolName(permission.prompt) : '';
  const toolArgs = permission ? parseToolArgs(permission.prompt) : null;
  const riskColor = permission ? getRiskColor(permission.riskLevel) : '#3b82f6';
  const verb = permission ? toolVerb(toolName) : 'Run';
  const desc = permission ? toolDescription(toolName) : '';

  const bg = isDarkMode
    ? 'rgba(16,16,22,0.98)'
    : 'rgba(250,250,252,0.98)';
  const border = isDarkMode
    ? 'rgba(255,255,255,0.09)'
    : 'rgba(0,0,0,0.10)';
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.88)';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';
  const codeBg = isDarkMode ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.05)';
  const codeBorder = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)';

  return (
    <AnimatePresence>
      {permission && (
        <motion.div
          key="permission-banner"
          initial={{ opacity: 0, y: 8, scaleY: 0.96 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: 6, scaleY: 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.6 }}
          style={{
            background: bg,
            border: `1px solid ${border}`,
            borderLeft: `3px solid ${riskColor}`,
            borderRadius: 12,
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-start gap-3 px-4 py-3">
            {/* Left: tool details */}
            <div className="flex-1 min-w-0">
              {/* Header: "Allow Neuro to Run tool_name" */}
              <div style={{ marginBottom: 3 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: textPrimary,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Allow Neuro to{' '}
                  <strong style={{ fontWeight: 700 }}>{verb}</strong>{' '}
                  <code
                    style={{
                      fontSize: 12,
                      fontFamily: FONT_FAMILY_MONO,
                      fontWeight: 600,
                      color: riskColor,
                      background: `${riskColor}18`,
                      border: `1px solid ${riskColor}30`,
                      borderRadius: 5,
                      padding: '1px 6px',
                    }}
                  >
                    {toolName}
                  </code>
                </span>
              </div>

              {/* Description (italicized) */}
              <div
                style={{
                  fontSize: 11.5,
                  fontStyle: 'italic',
                  color: textSecondary,
                  marginBottom: toolArgs ? 6 : 0,
                }}
              >
                {desc}
              </div>

              {/* Args / command code block */}
              {toolArgs && (
                <div
                  style={{
                    background: codeBg,
                    border: `1px solid ${codeBorder}`,
                    borderRadius: 7,
                    padding: '6px 10px',
                  }}
                >
                  <code
                    style={{
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: 11,
                      color: isDarkMode ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      display: 'block',
                    }}
                  >
                    {toolArgs}
                  </code>
                </div>
              )}
            </div>

            {/* Right: buttons */}
            <div className="flex items-center gap-2 shrink-0 ml-3 mt-0.5">
              {/* Deny */}
              <button
                onClick={onDeny}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: 'pointer',
                  background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${border}`,
                  color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)',
                  transition: 'background 0.12s, color 0.12s, outline 0.12s',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = isDarkMode
                    ? 'rgba(255,255,255,0.09)'
                    : 'rgba(0,0,0,0.09)';
                  (e.currentTarget as HTMLButtonElement).style.color = isDarkMode
                    ? 'rgba(255,255,255,0.80)'
                    : 'rgba(0,0,0,0.75)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = isDarkMode
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.color = isDarkMode
                    ? 'rgba(255,255,255,0.55)'
                    : 'rgba(0,0,0,0.50)';
                }}
                onFocus={e => {
                  (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${isDarkMode ? '#3b82f6' : '#0c63e4'}`;
                  (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px';
                }}
                onBlur={e => {
                  (e.currentTarget as HTMLButtonElement).style.outline = 'none';
                }}
                aria-label="Deny this permission request (Esc)"
              >
                Deny
                <kbd
                  style={{
                    fontSize: 9.5,
                    fontFamily: FONT_FAMILY_MONO,
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                    lineHeight: 1.5,
                  }}
                >
                  Esc
                </kbd>
              </button>

              {/* Allow once */}
              <button
                onClick={onApprove}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  cursor: 'pointer',
                  background: isDarkMode
                    ? 'rgba(255,255,255,0.92)'
                    : 'rgba(0,0,0,0.86)',
                  border: 'none',
                  color: isDarkMode ? '#0c0c0f' : '#ffffff',
                  transition: 'opacity 0.12s, outline 0.12s',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
                onFocus={e => {
                  (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${isDarkMode ? '#0c0c0f' : '#ffffff'}`;
                  (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px';
                }}
                onBlur={e => {
                  (e.currentTarget as HTMLButtonElement).style.outline = 'none';
                }}
                aria-label="Allow this permission once (Cmd+Enter or Ctrl+Enter)"
              >
                Allow once
                <kbd
                  style={{
                    fontSize: 9.5,
                    fontFamily: FONT_FAMILY_MONO,
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: isDarkMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.20)',
                    border: `1px solid ${isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'}`,
                    color: isDarkMode ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
                    lineHeight: 1.5,
                  }}
                >
                  {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+↵
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
