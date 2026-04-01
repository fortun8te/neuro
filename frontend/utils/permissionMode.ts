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
    label: 'Bypass',
    description: 'Allow all tools without asking. Just do it.',
    color: '#22c55e',
    icon: 'bypass',
  },
  {
    mode: 'default',
    label: 'Default',
    description: 'Ask before destructive operations. Auto-allow read-only tools.',
    color: '#eab308',
    icon: 'default',
  },
  {
    mode: 'strict',
    label: 'Strict',
    description: 'Ask before ANY tool execution. Most protective mode.',
    color: '#ef4444',
    icon: 'strict',
  },
  {
    mode: 'plan',
    label: 'Plan',
    description: 'Show full execution plan before running. Approve once, execute all.',
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
  return 'default';
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
