/**
 * Permission Mode Manager
 *
 * Handles localStorage persistence and context management for permission modes.
 */

import type { PermissionMode, ToolPermissionContext } from './harness/types';

const PERMISSION_MODE_KEY = 'harness_permission_mode';

export const PERMISSION_MODES: Array<{
  mode: PermissionMode;
  label: string;
  description: string;
  color: string;
  icon: string;
}> = [
  {
    mode: 'bypass',
    label: 'Auto',
    description: 'Run all tools automatically. No interruptions.',
    color: '#22c55e',
    icon: 'bypass',
  },
  {
    mode: 'plan',
    label: 'Plan',
    description: 'Generate a plan first. Review and approve before executing.',
    color: '#3b82f6',
    icon: 'plan',
  },
];

/**
 * Get the current permission mode from localStorage.
 * Defaults to 'bypass' if not set.
 */
export function getPermissionMode(): PermissionMode {
  try {
    const stored = localStorage.getItem(PERMISSION_MODE_KEY);
    if (stored && PERMISSION_MODES.some(m => m.mode === stored)) {
      return stored as PermissionMode;
    }
  } catch { /* localStorage unavailable (incognito / restricted) */ }
  return 'bypass';
}

/**
 * Set the permission mode in localStorage.
 */
export function setPermissionMode(mode: PermissionMode): void {
  localStorage.setItem(PERMISSION_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent('neuro-permission-mode-changed', { detail: { mode } }));
}

/**
 * Get the mode description
 */
export function getModeDescription(mode: PermissionMode): string {
  return PERMISSION_MODES.find(m => m.mode === mode)?.description || 'Unknown mode';
}

/**
 * Listen for permission mode changes
 */
export function onPermissionModeChanged(callback: (mode: PermissionMode) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent;
    callback(customEvent.detail.mode);
  };
  window.addEventListener('neuro-permission-mode-changed', handler);
  return () => window.removeEventListener('neuro-permission-mode-changed', handler);
}

/**
 * Write (destructive) tool names — blocked in plan mode.
 */
export const WRITE_TOOLS = new Set([
  'write_file', 'edit_file', 'create_file', 'delete_file', 'move_file',
  'file_write', 'file_delete', 'file_move', 'file_rename',
  'bash', 'execute_code', 'run_command', 'shell', 'terminal', 'shell_exec', 'run_code',
  'write', 'edit', 'save', 'append_file',
  'memory_store', 'memory_delete',
]);

/**
 * Returns true if the tool name looks like a write/destructive operation.
 */
export function isWriteTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  if (WRITE_TOOLS.has(lower)) return true;
  return (
    lower.includes('write') ||
    lower.includes('edit') ||
    lower.includes('create') ||
    lower.includes('delete') ||
    lower.includes('bash') ||
    lower.includes('execute') ||
    lower.includes('shell') ||
    lower.includes('save')
  );
}
