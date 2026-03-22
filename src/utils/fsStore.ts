/**
 * fsStore — reactive filesystem store for FinderWindow
 *
 * Now delegates to SessionFileSystem (VFS) for real persistence.
 * Maintains backward compatibility with the path-array API used by FinderWindow.
 */

import { useSyncExternalStore } from 'react';
import { vfs } from './sessionFileSystem';
import type { VFSNode } from './sessionFileSystem';

// ── Types ────────────────────────────────────────────────────────────────────

export type FSTag = 'session' | 'memory' | 'export';

export interface FSNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  extension?: string;
  size?: string;
  modified: string;
  tag?: FSTag;
  /** VFS path for navigation */
  vfsPath?: string;
}

// ── Conversion helpers ──────────────────────────────────────────────────────

function vfsToFSNode(node: VFSNode): FSNode {
  const ext = vfs.getExtension(node);
  let tag: FSTag | undefined;
  if (node.path.includes('/computers/') || node.path.includes('/screenshots')) tag = 'session';
  else if (node.path.includes('/notes') || node.path.includes('/shared')) tag = 'memory';
  else if (node.path.includes('/exports')) tag = 'export';

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    extension: ext,
    size: node.type === 'file' ? vfs.formatSize(node) : undefined,
    modified: vfs.formatModified(node),
    tag,
    vfsPath: node.path,
  };
}

/** Convert a string[] path (used by FinderWindow) to a VFS path string */
function pathArrayToVFS(path: string[]): string {
  if (path.length === 0) return '/nomad';
  return '/nomad/' + path.join('/');
}

// ── Public API (backward compatible) ────────────────────────────────────────

export function getItems(path: string[]): FSNode[] {
  const vfsPath = pathArrayToVFS(path);
  return vfs.listFolder(vfsPath).map(vfsToFSNode);
}

export function addItem(path: string[], node: FSNode): void {
  const vfsPath = pathArrayToVFS(path);
  if (node.type === 'folder') {
    vfs.createFolder(vfsPath, node.name);
  } else {
    vfs.createFile(vfsPath, node.name, node.size ?? '', node.extension ? `application/${node.extension}` : 'application/octet-stream');
  }
}

export function removeItem(path: string[], id: string): void {
  const node = vfs.getById(id);
  if (node) vfs.deleteNode(node.path);
}

export function renameItem(path: string[], id: string, newName: string): void {
  const node = vfs.getById(id);
  if (node) vfs.renameNode(node.path, newName);
}

export function createFolder(path: string[], name: string): FSNode {
  const vfsPath = pathArrayToVFS(path);
  const node = vfs.createFolder(vfsPath, name);
  return vfsToFSNode(node);
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Re-renders whenever the VFS changes.
 * Returns a version counter (not the map) -- callers use getItems() to read.
 */
export function useFSStore(): number {
  return useSyncExternalStore(
    (cb) => vfs.subscribe(cb),
    () => vfs.getSnapshot(),
  );
}
