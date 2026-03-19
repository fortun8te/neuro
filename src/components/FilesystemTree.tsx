/**
 * FilesystemTree -- animated collapsible file/folder tree view
 *
 * Dark-themed, compact, uses framer-motion for expand/collapse.
 * Clicking a file either invokes onFileClick callback or copies path to clipboard.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────

export type FileNode = {
  name: string;
  size?: string;
  path?: string;
  modifiedStr?: string;
  nodes?: FileNode[];
};

export interface FilesystemTreeProps {
  nodes: FileNode[];
  className?: string;
  /** If provided, called when a file is clicked (instead of clipboard copy) */
  onFileClick?: (node: FileNode) => void;
}

// ── Inline SVG icons ───────────────────────────────────────────────────────

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FolderClosedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2B79FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#2B79FF" stroke="#2B79FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fillOpacity="0.2">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function TreeFileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ImageFileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/** Get file type icon color based on extension */
function getFileIconColor(name: string): string {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  if (['.md', '.txt', '.log'].includes(ext)) return 'rgba(255,255,255,0.35)';
  if (['.json', '.csv', '.xml'].includes(ext)) return 'rgba(43,121,255,0.5)';
  if (['.js', '.ts', '.py', '.sh'].includes(ext)) return 'rgba(34,197,94,0.5)';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'rgba(168,85,247,0.5)';
  if (['.pdf'].includes(ext)) return 'rgba(239,68,68,0.5)';
  return 'rgba(255,255,255,0.3)';
}

function isImageFile(name: string): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext);
}

// ── Toast state (module-level singleton) ───────────────────────────────────

let _toastTimer: ReturnType<typeof setTimeout> | null = null;
let _toastListeners: Array<(msg: string | null) => void> = [];

function showCopiedToast(msg: string) {
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastListeners.forEach(fn => fn(msg));
  _toastTimer = setTimeout(() => {
    _toastListeners.forEach(fn => fn(null));
    _toastTimer = null;
  }, 1200);
}

function useToast(): string | null {
  const [toast, setToast] = useState<string | null>(null);
  useState(() => {
    _toastListeners.push(setToast);
  });
  return toast;
}

// ── TreeNode (recursive) ───────────────────────────────────────────────────

const collapseTransition = { type: 'spring' as const, bounce: 0, duration: 0.4 };

function TreeNodeRow({ node, depth, onFileClick }: { node: FileNode; depth: number; onFileClick?: (node: FileNode) => void }) {
  const [open, setOpen] = useState(false);
  const isFolder = Array.isArray(node.nodes) && node.nodes.length > 0;

  const handleClick = useCallback(() => {
    if (isFolder) {
      setOpen(o => !o);
    } else if (onFileClick) {
      onFileClick(node);
    } else if (node.path) {
      navigator.clipboard.writeText(node.path);
      showCopiedToast('Copied!');
    }
  }, [isFolder, node, onFileClick]);

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1 py-0.5 text-left rounded transition-colors"
        style={{
          paddingLeft: depth * 14 + 4,
          paddingRight: 4,
          background: 'transparent',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        title={node.path || node.name}
      >
        {/* Chevron (folders only) */}
        {isFolder ? (
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={collapseTransition}
            className="flex items-center justify-center shrink-0"
            style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.25)' }}
          >
            <ChevronRightIcon />
          </motion.span>
        ) : (
          <span style={{ width: 12 }} />
        )}

        {/* Icon */}
        <span className="shrink-0 flex items-center justify-center" style={{ width: 14 }}>
          {isFolder
            ? (open ? <FolderOpenIcon /> : <FolderClosedIcon />)
            : <span style={{ color: getFileIconColor(node.name) }}>
                {isImageFile(node.name) ? <ImageFileIcon /> : <TreeFileIcon />}
              </span>
          }
        </span>

        {/* Name */}
        <span
          className="text-[11px] flex-1 truncate"
          style={{ color: isFolder ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.6)' }}
        >
          {node.name}
        </span>

        {/* Modified time */}
        {node.modifiedStr && (
          <span className="text-[8px] font-sans shrink-0 ml-1" style={{ color: 'rgba(255,255,255,0.15)' }}>
            {node.modifiedStr}
          </span>
        )}

        {/* Size */}
        {node.size && (
          <span className="text-[9px] font-sans shrink-0 ml-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {node.size}
          </span>
        )}
      </button>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isFolder && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            {node.nodes!.map((child, i) => (
              <TreeNodeRow key={child.name + '-' + i} node={child} depth={depth + 1} onFileClick={onFileClick} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function FilesystemTree({ nodes, className, onFileClick }: FilesystemTreeProps) {
  const toast = useToast();

  return (
    <div className={'relative ' + (className || '')}>
      {nodes.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No files yet</span>
        </div>
      ) : (
        nodes.map((node, i) => (
          <TreeNodeRow key={node.name + '-' + i} node={node} depth={0} onFileClick={onFileClick} />
        ))
      )}

      {/* Copied toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-[10px] font-medium pointer-events-none"
            style={{
              background: 'rgba(43,121,255,0.15)',
              color: 'rgba(43,121,255,0.9)',
              border: '1px solid rgba(43,121,255,0.25)',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a flat list of { name, sizeStr } into FileNode[] tree,
 * grouping by "/" subdirectories if paths contain them.
 */
export function buildTreeFromFlatFiles(files: Array<{ name: string; sizeStr?: string; size?: string; modifiedStr?: string }>, basePath?: string): FileNode[] {
  // Group files by their directory prefix
  const dirMap = new Map<string, FileNode[]>();
  const rootFiles: FileNode[] = [];

  for (const f of files) {
    const parts = f.name.split('/');
    const sizeLabel = f.sizeStr || f.size;
    if (parts.length === 1) {
      rootFiles.push({
        name: f.name,
        size: sizeLabel,
        modifiedStr: f.modifiedStr,
        path: basePath ? basePath + '/' + f.name : f.name,
      });
    } else {
      const dir = parts[0];
      const rest = parts.slice(1).join('/');
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push({
        name: rest,
        size: sizeLabel,
        modifiedStr: f.modifiedStr,
        path: basePath ? basePath + '/' + f.name : f.name,
      });
    }
  }

  const result: FileNode[] = [];

  // Add directories first
  for (const [dirName, children] of dirMap) {
    // Recursively build subtrees
    const subtree = buildTreeFromFlatFiles(
      children.map(c => ({ name: c.name, sizeStr: c.size, modifiedStr: c.modifiedStr })),
      basePath ? basePath + '/' + dirName : dirName
    );
    result.push({
      name: dirName,
      path: basePath ? basePath + '/' + dirName : dirName,
      nodes: subtree,
    });
  }

  // Then add root-level files
  result.push(...rootFiles);
  return result;
}

/**
 * Render a mini filesystem tree for workspace tool results in step cards.
 * Returns a React element showing the workspace files/saved file.
 */
export function renderWorkspaceResult(toolName: string, resultText: string): React.ReactNode | null {
  if (toolName === 'workspace_list') {
    // Parse the result text for file listings
    // Expected format: lines like "filename (size)" or JSON
    const lines = resultText.split('\n').filter(l => l.trim());
    const files: FileNode[] = [];
    for (const line of lines) {
      const match = line.match(/^[-\s]*(.+?)\s*\(([^)]+)\)\s*$/);
      if (match) {
        files.push({ name: match[1].trim(), size: match[2].trim() });
      } else if (line.trim() && !line.includes('files in workspace') && !line.includes('empty')) {
        files.push({ name: line.trim() });
      }
    }
    if (files.length === 0) return null;
    return (
      <div className="mt-1.5 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', maxWidth: 280 }}>
        <div className="px-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-[9px] font-sans" style={{ color: 'rgba(255,255,255,0.25)' }}>Workspace</span>
        </div>
        <FilesystemTree nodes={buildTreeFromFlatFiles(files)} />
      </div>
    );
  }

  if (toolName === 'workspace_save' || toolName === 'sandbox_pull') {
    // Parse saved filename from result
    const nameMatch = resultText.match(/saved?\s+(?:as\s+)?["']?([^\s"']+)["']?/i)
      || resultText.match(/["']([^"']+\.\w+)["']/)
      || resultText.match(/Pulled\s+"([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : null;
    if (!name) return null;
    const sizeMatch = resultText.match(/\(([^)]+)\)/);
    const file: FileNode = { name, size: sizeMatch ? sizeMatch[1] : undefined };
    return (
      <div className="mt-1.5 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', maxWidth: 280 }}>
        <div className="px-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-[9px] font-sans" style={{ color: 'rgba(255,255,255,0.25)' }}>{toolName === 'sandbox_pull' ? 'Pulled' : 'Saved'}</span>
        </div>
        <FilesystemTree nodes={[file]} />
      </div>
    );
  }

  // Computer session summary card
  if (toolName === 'use_computer') {
    const pagesMatch = resultText.match(/Pages visited:\s*(.+)/);
    const actionsMatch = resultText.match(/(\d+)\s*actions/);
    const filesMatch = resultText.match(/Files saved:\s*(.+)/);
    const durationMatch = resultText.match(/(\d+)s/);

    const pages = pagesMatch ? pagesMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
    const actionsCount = actionsMatch ? actionsMatch[1] : '0';
    const savedFiles = filesMatch ? filesMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
    const duration = durationMatch ? durationMatch[1] : '?';

    return (
      <div className="mt-1.5 rounded-lg overflow-hidden" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.12)', maxWidth: 300 }}>
        <div className="px-2.5 py-1.5 flex items-center gap-1.5" style={{ borderBottom: '1px solid rgba(168,85,247,0.08)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className="text-[9px] font-semibold" style={{ color: 'rgba(168,85,247,0.7)' }}>Computer session</span>
          <span className="text-[9px] font-sans ml-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>{duration}s</span>
        </div>
        <div className="px-2.5 py-1.5 space-y-0.5">
          {pages.length > 0 && (
            <div className="flex items-start gap-1">
              <span className="text-[8px] font-sans shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>URLs</span>
              <div className="flex-1">
                {pages.slice(0, 3).map((url, i) => (
                  <div key={i} className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{url}</div>
                ))}
                {pages.length > 3 && <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.15)' }}>+{pages.length - 3} more</span>}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{actionsCount} actions</span>
            {savedFiles.length > 0 && <span className="text-[9px]" style={{ color: 'rgba(34,197,94,0.5)' }}>{savedFiles.length} files saved</span>}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
