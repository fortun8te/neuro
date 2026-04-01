/**
 * FileTree — Dark-themed tree component with inline CRUD operations.
 *
 * Features:
 * - Collapsible folders with animated expand/collapse
 * - Right-click context menu (New File, New Folder, Rename, Delete, Copy Path)
 * - Double-click to rename inline
 * - Extension-based file icon coloring
 * - Vertical indent guide lines
 * - Delete confirmation inline
 * - Wired to VFS callbacks (OnCreateFile, OnCreateFolder, OnRename, OnDelete, OnSelect)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react';

// ── VFS Interface ─────────────────────────────────────────────────────────────

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
  mimeType?: string;
  size?: number;
}

export type OnCreateFile = (parentPath: string, name: string) => void;
export type OnCreateFolder = (parentPath: string, name: string) => void;
export type OnRename = (path: string, newName: string) => void;
export type OnDelete = (path: string) => void;
export type OnSelect = (path: string, node: FileTreeNode) => void;

// ── Extension color map ───────────────────────────────────────────────────────

function getExtensionColor(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return '#9ca3af'; // gray
  const ext = name.slice(dot).toLowerCase();
  if (['.tsx', '.jsx'].includes(ext)) return '#60a5fa'; // blue
  if (['.ts', '.js', '.mjs', '.cjs'].includes(ext)) return '#fbbf24'; // yellow
  if (['.css', '.scss', '.sass'].includes(ext)) return '#a78bfa'; // purple
  if (['.json', '.yaml', '.yml'].includes(ext)) return '#4ade80'; // green
  if (['.md', '.mdx', '.txt'].includes(ext)) return '#9ca3af'; // gray
  if (['.pdf'].includes(ext)) return '#f87171'; // red
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return '#22d3ee'; // cyan
  if (['.html', '.htm'].includes(ext)) return '#fb923c'; // orange
  if (['.py', '.go', '.rs'].includes(ext)) return '#60a5fa'; // blue
  return '#9ca3af';
}

// ── Context Menu ──────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  node: FileTreeNode;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyPath: () => void;
}

function ContextMenu({ menu, onClose, onNewFile, onNewFolder, onRename, onDelete, onCopyPath }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const isFolder = menu.node.type === 'folder';

  const items: Array<{ label: string; icon: React.ReactNode; action: () => void; danger?: boolean }> = [];
  if (isFolder) {
    items.push({ label: 'New File', icon: <FilePlus size={12} />, action: onNewFile });
    items.push({ label: 'New Folder', icon: <FolderPlus size={12} />, action: onNewFolder });
  }
  items.push({ label: 'Rename', icon: <Pencil size={12} />, action: onRename });
  items.push({ label: 'Delete', icon: <Trash2 size={12} />, action: onDelete, danger: true });
  items.push({ label: 'Copy Path', icon: <Copy size={12} />, action: onCopyPath });

  return (
    <div
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 999,
        background: 'rgba(28,28,34,0.98)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '4px 0',
        minWidth: 160,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 14px',
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            color: item.danger ? '#f87171' : 'var(--text-primary)',
            fontFamily: 'system-ui,-apple-system,sans-serif',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--glass-bg-medium)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <span style={{ color: item.danger ? '#f87171' : 'var(--text-ghost)', display: 'flex', alignItems: 'center' }}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Inline Rename Input ───────────────────────────────────────────────────────

function InlineRenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select just the name part (not the extension)
    const dot = initial.lastIndexOf('.');
    if (dot > 0) {
      el.setSelectionRange(0, dot);
    } else {
      el.select();
    }
  }, [initial]);

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(val.trim() || initial); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        e.stopPropagation();
      }}
      onBlur={() => onCommit(val.trim() || initial)}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        fontSize: 12,
        color: 'var(--text-primary)',
        background: 'rgba(234,88,12,0.25)',
        border: '1px solid rgba(234,88,12,0.7)',
        borderRadius: 3,
        outline: 'none',
        padding: '1px 4px',
        width: '100%',
        maxWidth: 180,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        boxSizing: 'border-box' as const,
        lineHeight: '16px',
      }}
    />
  );
}

// ── Inline New Item Input ─────────────────────────────────────────────────────

function InlineNewInput({
  placeholder,
  onCommit,
  onCancel,
}: {
  placeholder: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState('');

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const trimmed = val.trim();
          if (trimmed) onCommit(trimmed);
          else onCancel();
        }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        e.stopPropagation();
      }}
      onBlur={() => {
        const trimmed = val.trim();
        if (trimmed) onCommit(trimmed);
        else onCancel();
      }}
      onClick={e => e.stopPropagation()}
      placeholder={placeholder}
      style={{
        fontSize: 12,
        color: 'var(--text-primary)',
        background: 'rgba(234,88,12,0.2)',
        border: '1px solid rgba(234,88,12,0.6)',
        borderRadius: 3,
        outline: 'none',
        padding: '1px 4px',
        width: '100%',
        maxWidth: 180,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        boxSizing: 'border-box' as const,
        lineHeight: '16px',
      }}
    />
  );
}

// ── Delete Confirmation ───────────────────────────────────────────────────────

function DeleteConfirmation({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 0',
        fontSize: 11,
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ color: '#f87171' }}>Delete "{name}"?</span>
      <button
        onClick={onConfirm}
        style={{
          background: 'rgba(248,113,113,0.2)',
          border: '1px solid rgba(248,113,113,0.4)',
          borderRadius: 3,
          color: '#f87171',
          fontSize: 10,
          padding: '1px 6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        style={{
          background: 'var(--glass-bg-light)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 3,
          color: 'var(--text-secondary)',
          fontSize: 10,
          padding: '1px 6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        No
      </button>
    </div>
  );
}

// ── Tree Node Row ─────────────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: FileTreeNode;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

function TreeNodeRow({
  node,
  level,
  isExpanded,
  isSelected,
  isRenaming,
  isDeleting,
  onToggle,
  onSelect,
  onStartRename: _onStartRename,
  onCommitRename,
  onCancelRename,
  onStartDelete: _onStartDelete,
  onConfirmDelete,
  onCancelDelete,
  onContextMenu,
  onDoubleClick,
}: TreeNodeRowProps) {
  const [hovered, setHovered] = useState(false);
  const extColor = node.type === 'file' ? getExtensionColor(node.name) : undefined;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Vertical indent guide lines */}
      {Array.from({ length: level }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: i * 16 + 11,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--border-subtle)',
            pointerEvents: 'none',
          }}
        />
      ))}

      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={node.type === 'folder' ? isExpanded : undefined}
        onClick={e => {
          e.stopPropagation();
          if (node.type === 'folder') onToggle();
          onSelect();
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          onDoubleClick();
        }}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (node.type === 'folder') onToggle();
            onSelect();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          paddingLeft: level * 16 + 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 5,
          cursor: 'pointer',
          userSelect: 'none',
          outline: 'none',
          transition: 'background 0.12s',
          background: isSelected
            ? 'rgba(96,165,250,0.13)'
            : hovered
              ? 'var(--glass-bg-light)'
              : 'transparent',
          borderLeft: isSelected
            ? '2px solid rgba(96,165,250,0.75)'
            : '2px solid transparent',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          minHeight: 24,
        }}
      >
        {/* Chevron */}
        {node.type === 'folder' ? (
          isExpanded ? (
            <ChevronDown size={11} style={{ color: 'var(--text-ghost)', flexShrink: 0 }} />
          ) : (
            <ChevronRight size={11} style={{ color: 'var(--text-ghost)', flexShrink: 0 }} />
          )
        ) : (
          <span style={{ width: 11, flexShrink: 0 }} />
        )}

        {/* Icon */}
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
          ) : (
            <Folder size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
          )
        ) : (
          <File size={12} style={{ color: extColor ?? '#9ca3af', flexShrink: 0 }} />
        )}

        {/* Label / Rename / Delete */}
        {isDeleting ? (
          <DeleteConfirmation
            name={node.name}
            onConfirm={onConfirmDelete}
            onCancel={onCancelDelete}
          />
        ) : isRenaming ? (
          <InlineRenameInput
            initial={node.name}
            onCommit={onCommitRename}
            onCancel={onCancelRename}
          />
        ) : (
          <span
            style={{
              fontSize: 12,
              lineHeight: '16px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontFamily: node.type === 'file'
                ? 'ui-monospace, SFMono-Regular, monospace'
                : 'inherit',
              color: node.type === 'folder'
                ? 'var(--text-primary)'
                : (extColor ?? 'var(--text-secondary)'),
            }}
          >
            {node.name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main FileTree Component ───────────────────────────────────────────────────

export interface FileTreeProps {
  data: FileTreeNode[];
  selectedPath: string | null;
  onSelect?: OnSelect;
  onCreateFile?: OnCreateFile;
  onCreateFolder?: OnCreateFolder;
  onRename?: OnRename;
  onDelete?: OnDelete;
}

export default function FileTree({
  data,
  selectedPath,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Auto-expand root nodes
    const initial: Record<string, boolean> = {};
    for (const node of data) {
      if (node.type === 'folder') initial[node.id] = true;
    }
    return initial;
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // "Creating new" state: { parentId, type }
  const [creating, setCreating] = useState<{ parentId: string; parentPath: string; type: 'file' | 'folder' } | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSelect = useCallback((node: FileTreeNode) => {
    onSelect?.(node.path, node);
  }, [onSelect]);

  const handleRenameCommit = useCallback((node: FileTreeNode, newName: string) => {
    if (newName && newName !== node.name) {
      onRename?.(node.path, newName);
    }
    setRenamingId(null);
  }, [onRename]);

  const handleDelete = useCallback((node: FileTreeNode) => {
    onDelete?.(node.path);
    setDeletingId(null);
  }, [onDelete]);

  const handleCreateCommit = useCallback((name: string) => {
    if (!creating) return;
    if (creating.type === 'file') {
      onCreateFile?.(creating.parentPath, name);
    } else {
      onCreateFolder?.(creating.parentPath, name);
    }
    // Ensure parent is expanded
    setExpanded(prev => ({ ...prev, [creating.parentId]: true }));
    setCreating(null);
  }, [creating, onCreateFile, onCreateFolder]);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {
      // Fallback -- silently fail
    });
  }, []);

  // Render nodes recursively
  const renderNodes = (nodes: FileTreeNode[], level: number): React.ReactNode =>
    nodes.map(node => {
      const isExpanded = !!expanded[node.id];
      const isSelected = selectedPath === node.path;
      const isRenaming = renamingId === node.id;
      const isDeleting = deletingId === node.id;
      const isCreatingHere = creating?.parentId === node.id;

      return (
        <div key={node.id}>
          <TreeNodeRow
            node={node}
            level={level}
            isExpanded={isExpanded}
            isSelected={isSelected}
            isRenaming={isRenaming}
            isDeleting={isDeleting}
            onToggle={() => toggleExpand(node.id)}
            onSelect={() => handleSelect(node)}
            onStartRename={() => setRenamingId(node.id)}
            onCommitRename={name => handleRenameCommit(node, name)}
            onCancelRename={() => setRenamingId(null)}
            onStartDelete={() => setDeletingId(node.id)}
            onConfirmDelete={() => handleDelete(node)}
            onCancelDelete={() => setDeletingId(null)}
            onContextMenu={e => {
              setContextMenu({ x: e.clientX, y: e.clientY, node });
            }}
            onDoubleClick={() => {
              if (node.type === 'file' || node.type === 'folder') {
                setRenamingId(node.id);
              }
            }}
          />

          {/* Children (animated) */}
          <AnimatePresence initial={false}>
            {node.children && node.children.length > 0 && isExpanded && (
              <motion.div
                key="children"
                role="group"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                {renderNodes(node.children, level + 1)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* "New item" input row when creating inside this folder */}
          <AnimatePresence>
            {isCreatingHere && isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    paddingLeft: (level + 1) * 16 + 6,
                    paddingRight: 6,
                    paddingTop: 3,
                    paddingBottom: 3,
                    minHeight: 24,
                  }}
                >
                  <span style={{ width: 11, flexShrink: 0 }} />
                  {creating.type === 'folder' ? (
                    <Folder size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  ) : (
                    <File size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  )}
                  <InlineNewInput
                    placeholder={creating.type === 'folder' ? 'folder name' : 'file name'}
                    onCommit={handleCreateCommit}
                    onCancel={() => setCreating(null)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Also handle empty folder creation spot */}
          <AnimatePresence>
            {isCreatingHere && !isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    paddingLeft: (level + 1) * 16 + 6,
                    paddingRight: 6,
                    paddingTop: 3,
                    paddingBottom: 3,
                    minHeight: 24,
                  }}
                >
                  <span style={{ width: 11, flexShrink: 0 }} />
                  {creating.type === 'folder' ? (
                    <Folder size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  ) : (
                    <File size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  )}
                  <InlineNewInput
                    placeholder={creating.type === 'folder' ? 'folder name' : 'file name'}
                    onCommit={handleCreateCommit}
                    onCancel={() => setCreating(null)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });

  return (
    <div role="tree" style={{ fontSize: 12, position: 'relative' }}>
      {renderNodes(data, 0)}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewFile={() => {
            const node = contextMenu.node;
            setExpanded(prev => ({ ...prev, [node.id]: true }));
            setCreating({ parentId: node.id, parentPath: node.path, type: 'file' });
          }}
          onNewFolder={() => {
            const node = contextMenu.node;
            setExpanded(prev => ({ ...prev, [node.id]: true }));
            setCreating({ parentId: node.id, parentPath: node.path, type: 'folder' });
          }}
          onRename={() => setRenamingId(contextMenu.node.id)}
          onDelete={() => setDeletingId(contextMenu.node.id)}
          onCopyPath={() => handleCopyPath(contextMenu.node.path)}
        />
      )}
    </div>
  );
}
