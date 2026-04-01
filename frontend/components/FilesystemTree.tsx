/**
 * FilesystemTree — animated collapsible file/folder tree
 *
 * Uses framer-motion for smooth expand/collapse, lucide-react for icons.
 * Designed for dark glass UI. Fully accessible (role=tree/treeitem).
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Folder, File, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchSources } from './SearchSources';

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
  onFileClick?: (node: FileNode) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFileColor(name: string): string {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  if (['.md', '.txt', '.log'].includes(ext)) return 'var(--text-secondary)';
  if (['.json', '.csv', '.xml'].includes(ext)) return 'rgba(234,88,12,0.55)';
  if (['.js', '.ts', '.py', '.sh'].includes(ext)) return 'rgba(34,197,94,0.55)';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'rgba(168,85,247,0.55)';
  if (['.pdf'].includes(ext)) return 'rgba(239,68,68,0.55)';
  return 'var(--text-muted)';
}

function isImageFile(name: string): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext);
}

// ── Toast ─────────────────────────────────────────────────────────────────

let _toastTimer: ReturnType<typeof setTimeout> | null = null;
const _toastListeners: Array<(msg: string | null) => void> = [];

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
  useEffect(() => {
    _toastListeners.push(setToast);
    return () => {
      const i = _toastListeners.indexOf(setToast);
      if (i !== -1) _toastListeners.splice(i, 1);
    };
  }, []);
  return toast;
}

// ── TreeNodeRow ────────────────────────────────────────────────────────────

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 };

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

  const fileColor = isFolder ? undefined : getFileColor(node.name);

  return (
    <div>
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? open : undefined}
        className={cn(
          'flex items-center gap-1.5 py-[3px] rounded cursor-pointer transition-colors outline-none select-none',
          'hover:bg-white/[0.04] focus-visible:bg-white/[0.06]'
        )}
        style={{ paddingLeft: depth * 14 + 4, paddingRight: 4 }}
        onClick={handleClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        title={node.path || node.name}
      >
        {isFolder ? (
          open
            ? <ChevronDown size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            : <ChevronRight size={10} style={{ color: 'var(--text-ghost)', flexShrink: 0 }} />
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}

        {isFolder ? (
          <Folder size={12} style={{ color: open ? 'rgba(234,88,12,0.9)' : 'rgba(234,88,12,0.6)', flexShrink: 0, fill: open ? 'rgba(234,88,12,0.15)' : 'none' }} />
        ) : isImageFile(node.name) ? (
          <Image size={12} style={{ color: fileColor, flexShrink: 0 }} />
        ) : (
          <File size={12} style={{ color: fileColor, flexShrink: 0 }} />
        )}

        <span className="text-[11px] flex-1 truncate leading-none" style={{ color: isFolder ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {node.name}
        </span>

        {node.modifiedStr && (
          <span className="text-[8px] font-sans shrink-0 ml-1" style={{ color: 'var(--text-ghost)' }}>
            {node.modifiedStr}
          </span>
        )}
        {node.size && (
          <span className="text-[9px] font-sans shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>
            {node.size}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isFolder && open && (
          <motion.div
            key="children"
            role="group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            {node.nodes!.map((child, i) => (
              <TreeNodeRow key={child.name + i} node={child} depth={depth + 1} onFileClick={onFileClick} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── FilesystemTree ─────────────────────────────────────────────────────────

export function FilesystemTree({ nodes, className, onFileClick }: FilesystemTreeProps) {
  const toast = useToast();

  return (
    <div role="tree" className={cn('relative', className)}>
      {nodes.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <span className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>No files yet</span>
        </div>
      ) : (
        nodes.map((node, i) => (
          <TreeNodeRow key={node.name + i} node={node} depth={0} onFileClick={onFileClick} />
        ))
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-[10px] font-medium pointer-events-none"
            style={{ background: 'rgba(234,88,12,0.15)', color: 'rgba(234,88,12,0.9)', border: '1px solid rgba(234,88,12,0.25)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── buildTreeFromFlatFiles ─────────────────────────────────────────────────

export function buildTreeFromFlatFiles(
  files: Array<{ name: string; sizeStr?: string; size?: string; modifiedStr?: string }>,
  basePath?: string
): FileNode[] {
  const dirMap = new Map<string, Array<{ name: string; sizeStr?: string; modifiedStr?: string }>>();
  const rootFiles: FileNode[] = [];

  for (const f of files) {
    const parts = f.name.split('/');
    const sizeLabel = f.sizeStr || f.size;
    if (parts.length === 1) {
      rootFiles.push({ name: f.name, size: sizeLabel, modifiedStr: f.modifiedStr, path: basePath ? basePath + '/' + f.name : f.name });
    } else {
      const dir = parts[0];
      const rest = parts.slice(1).join('/');
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push({ name: rest, sizeStr: sizeLabel, modifiedStr: f.modifiedStr });
    }
  }

  const result: FileNode[] = [];
  for (const [dirName, children] of dirMap) {
    result.push({
      name: dirName,
      path: basePath ? basePath + '/' + dirName : dirName,
      nodes: buildTreeFromFlatFiles(children, basePath ? basePath + '/' + dirName : dirName),
    });
  }
  result.push(...rootFiles);
  return result;
}

// ── renderWorkspaceResult ──────────────────────────────────────────────────

export function renderWorkspaceResult(toolName: string, resultText: string): React.ReactNode | null {
  // Workspace tools removed — use sessionFileSystem instead

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
          <span className="text-[9px] font-sans ml-auto" style={{ color: 'var(--text-ghost)' }}>{duration}s</span>
        </div>
        <div className="px-2.5 py-1.5 space-y-0.5">
          {pages.length > 0 && (
            <div className="flex items-start gap-1">
              <span className="text-[8px] font-sans shrink-0 mt-0.5" style={{ color: 'var(--text-ghost)' }}>URLs</span>
              <div className="flex-1">
                {pages.slice(0, 3).map((url, i) => (
                  <div key={i} className="text-[9px] truncate" style={{ color: 'var(--text-secondary)' }}>{url}</div>
                ))}
                {pages.length > 3 && <span className="text-[8px]" style={{ color: 'var(--text-ghost)' }}>+{pages.length - 3} more</span>}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{actionsCount} actions</span>
            {savedFiles.length > 0 && <span className="text-[9px]" style={{ color: 'rgba(34,197,94,0.5)' }}>{savedFiles.length} files saved</span>}
          </div>
        </div>
      </div>
    );
  }

  if (toolName === 'web_search') {
    return <SearchSources resultText={resultText} />;
  }

  return null;
}
