/**
 * FinderWindow -- Session-aware file browser for the Nomad agent system.
 *
 * Hierarchy:
 *   Nomad (root)
 *     Sessions
 *       Session ABC
 *         Notes
 *         Computers
 *           Computer 1
 *             Downloads / Screenshots / Activity
 *         Exports
 *     Shared
 *
 * Uses the VFS (sessionFileSystem) for all data.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { vfs, vfsReady } from '../utils/sessionFileSystem';
import type { VFSNode } from '../utils/sessionFileSystem';
import { useFSStore } from '../utils/fsStore';
import { desktopBus } from '../utils/desktopBus';

// ── Icons ──────────────────────────────────────────────────────────────────

const ico = {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

function FolderIcon({ color = '#5B9BF8', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} fillOpacity={size > 20 ? 0.15 : 0}
      stroke={color} strokeWidth={size > 20 ? 1.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function folderColor(node: VFSNode): string {
  if (node.path.includes('/shared')) return '#34d399';
  if (node.path.includes('/notes')) return '#a78bfa';
  if (node.path.includes('/exports')) return '#34d399';
  if (node.path.includes('/computers')) return '#60a5fa';
  if (node.path.includes('/downloads')) return '#f59e0b';
  if (node.path.includes('/screenshots')) return '#f472b6';
  if (node.path.includes('/activity')) return '#94a3b8';
  if (node.path.includes('/sessions/')) return '#818cf8';
  return '#5B9BF8';
}

function fileColor(ext?: string): string {
  if (!ext) return '#9ca3af';
  if (/pdf/i.test(ext)) return '#ef4444';
  if (/json/i.test(ext)) return '#f59e0b';
  if (/md|txt/i.test(ext)) return '#6b7280';
  if (/jpe?g|png|gif|webp|svg/i.test(ext)) return '#a855f7';
  if (/html|css/i.test(ext)) return '#f97316';
  if (/tsx?|jsx?|py|go|rs/i.test(ext)) return '#38bdf8';
  return '#9ca3af';
}

function FileIcon({ extension, size = 14 }: { extension?: string; size?: number }) {
  const color = fileColor(extension);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} fillOpacity={size > 20 ? 0.12 : 0}
      stroke={color} strokeWidth={size > 20 ? 1.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l5 5v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <polyline points="14 2 14 8 20 8" strokeOpacity={0.4} />
    </svg>
  );
}

function IcoChevron({ dir = 'right' }: { dir?: 'right' | 'left' }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: dir === 'left' ? 'rotate(180deg)' : 'none' }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IcoGrid() {
  return <svg {...ico} width={13} height={13}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function IcoList() {
  return <svg {...ico} width={13} height={13}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" /></svg>;
}
function IcoSearch() {
  return <svg {...ico} width={11} height={11}><circle cx="10" cy="10" r="7" /><line x1="21" y1="21" x2="15" y2="15" /></svg>;
}
function IcoFolderPlus() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function IcoSidebar({ label }: { label: string }) {
  if (label === 'Nomad') return <svg {...ico} stroke="#60a5fa"><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" strokeOpacity={0.3} /></svg>;
  if (label === 'Sessions') return <svg {...ico} stroke="#818cf8"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
  if (label === 'Shared') return <svg {...ico} stroke="#34d399"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>;
  if (label === 'Downloads') return <svg {...ico} stroke="#f59e0b"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
  if (label === 'Screenshots') return <svg {...ico} stroke="#f472b6"><rect x="2" y="4" width="20" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M21 18l-6-7-4 5-3-3-5 5" /></svg>;
  if (label === 'Notes') return <svg {...ico} stroke="#a78bfa"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
  return <svg {...ico} stroke="#94a3b8"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></svg>;
}

// ── Traffic Lights ─────────────────────────────────────────────────────────

function TrafficLights({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center">
      <button onClick={onClose} style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', padding: 0 }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,95,87,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
        title="Close"
      />
    </div>
  );
}

// ── Rename Input ────────────────────────────────────────────────────────────

function RenameInput({
  initial, onCommit, onCancel,
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
    el.select();
  }, []);

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(val.trim() || initial); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      onBlur={() => onCommit(val.trim() || initial)}
      onClick={e => e.stopPropagation()}
      style={{
        fontSize: 11,
        color: '#fff',
        background: 'rgba(43,121,255,0.3)',
        border: '1px solid rgba(43,121,255,0.8)',
        borderRadius: 3,
        outline: 'none',
        padding: '0 3px',
        width: '100%',
        maxWidth: 76,
        textAlign: 'center',
        fontFamily: 'system-ui,-apple-system,sans-serif',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Grid Item ──────────────────────────────────────────────────────────────

interface DisplayNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  extension?: string;
  size?: string;
  modified: string;
  color: string;
  vfsPath: string;
  hasData?: boolean;
  mimeType?: string;
}

function vfsToDisplay(node: VFSNode): DisplayNode {
  const ext = vfs.getExtension(node);
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    extension: ext,
    size: node.type === 'file' ? vfs.formatSize(node) : undefined,
    modified: vfs.formatModified(node),
    color: node.type === 'folder' ? folderColor(node) : fileColor(ext),
    vfsPath: node.path,
    hasData: !!node.data,
    mimeType: node.mimeType,
  };
}

function GridItem({
  item, selected, renaming, onSelect, onOpen, onRenameCommit, onRenameCancel, onContextMenu,
}: {
  item: DisplayNode;
  selected: boolean;
  renaming: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      onDoubleClick={renaming ? undefined : onOpen}
      onContextMenu={onContextMenu}
      className="flex flex-col items-center gap-1 p-2 rounded-lg cursor-default select-none"
      style={{ background: selected ? 'rgba(43,121,255,0.25)' : 'transparent', minWidth: 80, maxWidth: 80 }}
    >
      <div className="flex items-center justify-center" style={{ width: 52, height: 52 }}>
        {item.type === 'folder'
          ? <FolderIcon size={52} color={item.color} />
          : <FileIcon size={52} extension={item.extension} />}
      </div>
      {renaming ? (
        <RenameInput initial={item.name} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span style={{
          fontSize: 11, color: selected ? '#fff' : 'rgba(255,255,255,0.75)',
          fontFamily: 'system-ui,-apple-system,sans-serif', textAlign: 'center',
          maxWidth: 76, display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as unknown as undefined, overflow: 'hidden', lineHeight: 1.3,
        }}>
          {item.name}
        </span>
      )}
    </motion.div>
  );
}

// ── List Row ───────────────────────────────────────────────────────────────

function ListRow({
  item, selected, isFirst, renaming, onSelect, onOpen, onRenameCommit, onRenameCancel, onContextMenu,
}: {
  item: DisplayNode;
  selected: boolean;
  isFirst: boolean;
  renaming: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={renaming ? undefined : onOpen}
      onContextMenu={onContextMenu}
      className="flex items-center gap-2 px-3 cursor-default select-none"
      style={{
        background: selected ? 'rgba(43,121,255,0.25)' : 'transparent',
        borderTop: isFirst ? 'none' : '1px solid rgba(255,255,255,0.04)', height: 28,
      }}
    >
      <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {item.type === 'folder'
          ? <FolderIcon color={item.color} />
          : <FileIcon extension={item.extension} />}
      </div>
      {renaming ? (
        <RenameInput initial={item.name} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span style={{ flex: 1, fontSize: 12, color: selected ? '#fff' : 'rgba(255,255,255,0.8)', fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </span>
      )}
      {!renaming && (
        <>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 90, textAlign: 'right', flexShrink: 0, fontFamily: 'system-ui,-apple-system,sans-serif', whiteSpace: 'nowrap' }}>
            {item.modified ?? '--'}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 60, textAlign: 'right', flexShrink: 0, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            {item.size ?? '--'}
          </span>
        </>
      )}
    </div>
  );
}

// ── File Preview Panel ──────────────────────────────────────────────────────

function FilePreview({ node }: { node: DisplayNode }) {
  const vfsNode = vfs.getById(node.id);
  const ext = (node.extension || '').toLowerCase();
  const extLabel = ext ? ext.toUpperCase() + ' File' : 'File';

  const isImage = node.mimeType?.startsWith('image/') || /^(jpe?g|png|gif|webp|svg)$/.test(ext);
  const isPdf = ext === 'pdf' || node.mimeType === 'application/pdf';
  const isText = /^(txt|md|json|ts|tsx|js|jsx|css|html|py|go|rs|toml|yaml|yml|sh|env|log)$/.test(ext);
  const isCsv = ext === 'csv';
  const isEditable = /^(txt|md)$/.test(ext);

  const data = vfsNode?.data ?? '';

  // Image zoom state
  const [zoom, setZoom] = useState(1);

  // CSV parsing
  const csvRows = useMemo(() => {
    if (!isCsv || !data) return [];
    return data.split('\n').filter(Boolean).map(row => row.split(','));
  }, [isCsv, data]);

  // Text edit state (for .txt / .md)
  const [editedText, setEditedText] = useState(data);
  useEffect(() => { setEditedText(data); setZoom(1); }, [data]);

  const saveText = useCallback(() => {
    if (!vfsNode || !isEditable) return;
    vfs.createFile(
      vfsNode.path.slice(0, vfsNode.path.lastIndexOf('/')),
      vfsNode.name,
      editedText,
      vfsNode.mimeType || 'text/plain',
    );
  }, [vfsNode, isEditable, editedText]);

  const previewStyle: React.CSSProperties = {
    borderTop: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(14,14,18,0.98)',
    flexShrink: 0,
    overflow: 'auto',
    maxHeight: 280,
    minHeight: 80,
  };

  // -- Image preview --
  if (isImage && data) {
    const src = data.startsWith('data:') ? data : `data:${node.mimeType || 'image/jpeg'};base64,${data}`;
    return (
      <div style={previewStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{node.name}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>-</button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>+</button>
          <button onClick={() => setZoom(1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 10, padding: '0 4px' }}>Reset</button>
        </div>
        <div style={{ overflow: 'auto', padding: 12, display: 'flex', justifyContent: 'center' }}>
          <img src={src} alt={node.name} style={{ maxWidth: `${zoom * 100}%`, height: 'auto', borderRadius: 4, imageRendering: zoom >= 2 ? 'pixelated' : 'auto' }} />
        </div>
      </div>
    );
  }

  // -- PDF preview --
  if (isPdf) {
    const isBlobUrl = data.startsWith('blob:');
    return (
      <div style={previewStyle}>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileIcon size={16} extension="pdf" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{node.name}</span>
        </div>
        {isBlobUrl ? (
          <iframe src={data} title={node.name} style={{ width: '100%', height: 240, border: 'none', background: '#222' }} />
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            PDF preview -- {node.size || 'unknown size'}
          </div>
        )}
      </div>
    );
  }

  // -- Text / code preview --
  if (isText && data) {
    return (
      <div style={previewStyle}>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileIcon size={16} extension={ext} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{node.name}</span>
          {isEditable && (
            <button onClick={saveText} style={{ marginLeft: 'auto', background: 'rgba(43,121,255,0.2)', border: '1px solid rgba(43,121,255,0.4)', borderRadius: 4, color: '#5B9BF8', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
          )}
        </div>
        <textarea
          value={isEditable ? editedText : data}
          onChange={isEditable ? (e) => setEditedText(e.target.value) : undefined}
          readOnly={!isEditable}
          spellCheck={false}
          style={{
            width: '100%',
            height: 200,
            background: 'rgba(0,0,0,0.3)',
            color: 'rgba(255,255,255,0.8)',
            border: 'none',
            outline: 'none',
            padding: 12,
            fontSize: 11,
            fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
            resize: 'none',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  // -- CSV table preview --
  if (isCsv && csvRows.length > 0) {
    return (
      <div style={previewStyle}>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileIcon size={16} extension="csv" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{node.name} -- {csvRows.length} rows</span>
        </div>
        <div style={{ overflow: 'auto', maxHeight: 200 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: '"SF Mono", monospace' }}>
            <tbody>
              {csvRows.slice(0, 100).map((row, ri) => (
                <tr key={ri} style={{ background: ri === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '3px 8px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      color: ri === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.5)',
                      fontWeight: ri === 0 ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // -- Default: file icon + metadata --
  return (
    <div style={{
      ...previewStyle,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ flexShrink: 0 }}>
        <FileIcon size={36} extension={node.extension} />
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontFamily: 'system-ui,-apple-system,sans-serif', marginTop: 2 }}>
          {extLabel}
          {node.size && ` -- ${node.size}`}
          {node.modified && ` -- ${node.modified}`}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'system-ui,-apple-system,sans-serif', marginTop: 2 }}>
          {node.vfsPath}
        </div>
      </div>
    </div>
  );
}

function FolderPreview({ node, items }: { node: DisplayNode; items: DisplayNode[] }) {
  const childCount = items.filter(i => i.vfsPath.startsWith(node.vfsPath + '/')).length || 0;
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(14,14,18,0.98)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ flexShrink: 0 }}>
        <FolderIcon size={36} color={node.color} />
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontFamily: 'system-ui,-apple-system,sans-serif', marginTop: 2 }}>
          Folder -- {childCount} item{childCount !== 1 ? 's' : ''}
          {node.modified && ` -- ${node.modified}`}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'system-ui,-apple-system,sans-serif', marginTop: 2 }}>
          {node.vfsPath}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Tree Item ───────────────────────────────────────────────────────

interface SidebarEntry {
  id: string;
  label: string;
  vfsPath: string;
  depth: number;
  icon: React.ReactNode;
  hasChildren: boolean;
}

function buildSidebarTree(): SidebarEntry[] {
  const entries: SidebarEntry[] = [];

  // Root: Nomad
  entries.push({ id: 'nomad', label: 'Nomad', vfsPath: '/nomad', depth: 0, icon: <IcoSidebar label="Nomad" />, hasChildren: true });

  // Sessions
  entries.push({ id: 'sessions', label: 'Sessions', vfsPath: '/nomad/sessions', depth: 1, icon: <IcoSidebar label="Sessions" />, hasChildren: true });

  // Each session
  const sessionIds = vfs.getSessionIds();
  for (const sid of sessionIds) {
    const sessionPath = `/nomad/sessions/${sid}`;
    entries.push({ id: `s-${sid}`, label: `Session ${sid.slice(0, 8)}`, vfsPath: sessionPath, depth: 2, icon: <IcoSidebar label="Sessions" />, hasChildren: true });

    // Notes
    entries.push({ id: `s-${sid}-notes`, label: 'Notes', vfsPath: `${sessionPath}/notes`, depth: 3, icon: <IcoSidebar label="Notes" />, hasChildren: false });

    // Computers
    const computerIds = vfs.getComputerIds(sid);
    if (computerIds.length > 0) {
      entries.push({ id: `s-${sid}-computers`, label: 'Computers', vfsPath: `${sessionPath}/computers`, depth: 3, icon: <IcoSidebar label="Sessions" />, hasChildren: true });
      for (const cid of computerIds) {
        const cPath = `${sessionPath}/computers/${cid}`;
        entries.push({ id: `c-${cid}`, label: `Computer ${cid.slice(0, 8)}`, vfsPath: cPath, depth: 4, icon: <IcoSidebar label="Sessions" />, hasChildren: true });
        entries.push({ id: `c-${cid}-dl`, label: 'Downloads', vfsPath: `${cPath}/downloads`, depth: 5, icon: <IcoSidebar label="Downloads" />, hasChildren: false });
        entries.push({ id: `c-${cid}-ss`, label: 'Screenshots', vfsPath: `${cPath}/screenshots`, depth: 5, icon: <IcoSidebar label="Screenshots" />, hasChildren: false });
        entries.push({ id: `c-${cid}-act`, label: 'Activity', vfsPath: `${cPath}/activity`, depth: 5, icon: <IcoSidebar label="" />, hasChildren: false });
      }
    }

    // Exports
    entries.push({ id: `s-${sid}-exports`, label: 'Exports', vfsPath: `${sessionPath}/exports`, depth: 3, icon: <IcoSidebar label="Shared" />, hasChildren: false });
  }

  // Shared
  entries.push({ id: 'shared', label: 'Shared', vfsPath: '/nomad/shared', depth: 1, icon: <IcoSidebar label="Shared" />, hasChildren: false });

  return entries;
}

// ── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenu {
  x: number;
  y: number;
  nodeId: string;
  nodeType: 'folder' | 'file';
}

// ── Main ───────────────────────────────────────────────────────────────────

export function FinderWindow({ onClose, zIndex, onFocus }: { onClose: () => void; zIndex?: number; onFocus?: () => void }) {
  // Subscribe to VFS changes
  useFSStore();

  const [ready, setReady] = useState(false);
  const [currentVFSPath, setCurrentVFSPath] = useState('/nomad');
  const [history, setHistory] = useState<string[]>(['/nomad']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // Window drag
  const {
    windowRef,
    pos,
    isDragging: isDraggingWindow,
    onTitleBarMouseDown,
  } = useWindowDrag({ windowWidth: 860, windowHeight: 540, centerOffset: { x: 44, y: 36 } });

  // Sidebar resize
  const isSidebarDragging = useRef(false);
  const sidebarStart = useRef({ x: 0, w: 200 });
  const containerDivRef = useRef<HTMLDivElement>(null);

  // Load VFS on mount
  useEffect(() => {
    vfsReady().then(() => setReady(true));
  }, []);

  // Snapshot for reactivity
  const snapshot = useFSStore();

  // List items in current folder
  const items: DisplayNode[] = useMemo(() => {
    if (!ready) return [];
    const raw = vfs.listFolder(currentVFSPath).map(vfsToDisplay);
    if (!searchQuery) return raw;
    return raw.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVFSPath, searchQuery, ready, snapshot]);

  const selectedNode = selectedId ? items.find(i => i.id === selectedId) ?? null : null;

  // Sidebar entries
  const sidebarEntries = useMemo(() => {
    if (!ready) return [];
    return buildSidebarTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, snapshot]);

  // ── Context menu close on outside click / Escape ──────────────────────────

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      setContextMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [contextMenu]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = useCallback((vfsPath: string) => {
    setCurrentVFSPath(vfsPath);
    setSelectedId(null);
    setSearchQuery('');
    setContextMenu(null);
    setRenamingId(null);
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const next = [...trimmed, vfsPath];
      setHistoryIdx(next.length - 1);
      return next;
    });
  }, [historyIdx]);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setCurrentVFSPath(history[idx]);
      setSelectedId(null);
    }
  }, [historyIdx, history]);

  const goForward = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const idx = historyIdx + 1;
      setHistoryIdx(idx);
      setCurrentVFSPath(history[idx]);
      setSelectedId(null);
    }
  }, [historyIdx, history]);

  const openItem = useCallback((item: DisplayNode) => {
    if (item.type === 'folder') {
      navigateTo(item.vfsPath);
    } else {
      // Emit event for file opening (PDF viewer, image viewer, etc.)
      const event = new CustomEvent('vfs-open-file', {
        detail: { id: item.id, path: item.vfsPath, mimeType: item.mimeType, name: item.name },
      });
      window.dispatchEvent(event);
    }
  }, [navigateTo]);

  // ── CRUD actions ──────────────────────────────────────────────────────────

  const startRename = useCallback((id: string) => {
    setRenamingId(id);
    setContextMenu(null);
  }, []);

  const commitRename = useCallback((id: string, newName: string) => {
    const node = vfs.getById(id);
    if (node) vfs.renameNode(node.path, newName);
    setRenamingId(null);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const deleteById = useCallback((id: string) => {
    const node = vfs.getById(id);
    if (!node) return;
    const confirmed = window.confirm(`Delete "${node.name}"?`);
    if (confirmed) {
      vfs.deleteNode(node.path);
      if (selectedId === id) setSelectedId(null);
    }
    setContextMenu(null);
  }, [selectedId]);

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    deleteById(selectedNode.id);
  }, [selectedNode, deleteById]);

  const handleNewFolder = useCallback(() => {
    const existing = items.map(n => n.name);
    let name = 'New Folder';
    let counter = 1;
    while (existing.includes(name)) {
      name = `New Folder ${counter++}`;
    }
    const node = vfs.createFolder(currentVFSPath, name);
    setSelectedId(node.id);
    setRenamingId(node.id);
  }, [currentVFSPath, items]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const onContainerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (renamingId) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
      e.preventDefault();
      deleteSelected();
    }
    if (e.key === 'F2' && selectedNode) {
      e.preventDefault();
      startRename(selectedNode.id);
    }
    if (e.key === 'Escape') {
      setSelectedId(null);
      setContextMenu(null);
    }
  }, [renamingId, selectedNode, deleteSelected, startRename]);

  // ── Desktop bus events (agent-driven navigation) ──────────────────────────

  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'finder_navigate') {
        navigateTo(event.path);
      } else if (event.type === 'finder_open_file') {
        // Navigate to parent folder, then select and open the file
        const lastSlash = event.path.lastIndexOf('/');
        const parentPath = lastSlash > 0 ? event.path.slice(0, lastSlash) : '/nomad';
        navigateTo(parentPath);
        // Try to find and select the file after navigation settles
        setTimeout(() => {
          const node = vfs.getByPath(event.path);
          if (node) {
            setSelectedId(node.id);
            // Trigger the open event for file viewers
            const customEvt = new CustomEvent('vfs-open-file', {
              detail: { id: node.id, path: node.path, mimeType: node.mimeType, name: node.name },
            });
            window.dispatchEvent(customEvt);
          }
        }, 100);
      } else if (event.type === 'finder_select_file') {
        const node = vfs.getByPath(event.path);
        if (node) {
          setSelectedId(node.id);
        }
      }
    });
    return unsub;
  }, [navigateTo]);

  // ── Context menu ──────────────────────────────────────────────────────────

  const onItemContextMenu = useCallback((e: React.MouseEvent, node: DisplayNode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(node.id);
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: node.type });
  }, []);

  // ── Sidebar resize ───────────────────────────────────────────────────────

  const onSidebarDividerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isSidebarDragging.current = true;
    sidebarStart.current = { x: e.clientX, w: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!isSidebarDragging.current) return;
      const delta = ev.clientX - sidebarStart.current.x;
      setSidebarWidth(Math.max(140, Math.min(300, sidebarStart.current.w + delta)));
    };
    const onUp = () => {
      isSidebarDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;

  // Breadcrumb from VFS path
  const breadcrumbs = useMemo(() => {
    const segs = currentVFSPath.split('/').filter(Boolean);
    return segs.map((seg, i) => ({
      label: seg.length > 12 ? seg.slice(0, 8) + '...' : seg,
      path: '/' + segs.slice(0, i + 1).join('/'),
    }));
  }, [currentVFSPath]);

  if (!ready) {
    return null;
  }

  return (
    <motion.div
      ref={windowRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseDownCapture={onFocus}
      style={{
        position: 'absolute',
        ...(pos !== null
          ? { left: pos.x, top: pos.y, transform: 'none' }
          : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        ),
        width: 860,
        height: 540,
        maxWidth: 'calc(100% - 8px)',
        maxHeight: 'calc(100% - 8px)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: zIndex ?? 200,
        pointerEvents: 'auto',
        background: '#121216',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        border: 'none',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Drag overlay -- prevents content from stealing mousemove during drag */}
      {isDraggingWindow && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9999, cursor: 'grabbing' }} />
      )}

      {/* Outer keyboard-handler div */}
      <div
        ref={containerDivRef}
        tabIndex={0}
        onKeyDown={onContainerKeyDown}
        style={{ display: 'contents', outline: 'none' }}
      >

      {/* Title bar */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          height: 36, display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14,
          background: '#1c1c1e', borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0, cursor: isDraggingWindow ? 'grabbing' : 'grab', position: 'relative',
        }}
      >
        <TrafficLights onClose={onClose} />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/icons/finder.png" alt="" width={14} height={14} style={{ borderRadius: 3, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: -0.2 }}>Files</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
        background: '#1a1a1e', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        {/* Back / Forward */}
        {[{ fn: goBack, can: canBack, ico: <IcoChevron dir="left" /> }, { fn: goForward, can: canForward, ico: <IcoChevron dir="right" /> }].map((btn, i) => (
          <button key={i} onClick={btn.fn} disabled={!btn.can} style={{
            background: 'none', border: 'none', padding: '4px 5px', borderRadius: 5,
            color: btn.can ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)',
            cursor: btn.can ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
          }}>
            {btn.ico}
          </button>
        ))}

        {/* Breadcrumb */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', minWidth: 0 }}>
          {breadcrumbs.map((bc, i, arr) => (
            <div key={bc.path} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: i < arr.length - 1 ? 1 : 0 }}>
              {i > 0 && <IcoChevron dir="right" />}
              <button
                onClick={() => { if (i < arr.length - 1) navigateTo(bc.path); }}
                style={{
                  background: 'none', border: 'none', padding: '2px 4px', borderRadius: 4,
                  fontSize: 12, cursor: i < arr.length - 1 ? 'pointer' : 'default',
                  color: i === arr.length - 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.38)',
                  fontWeight: i === arr.length - 1 ? 600 : 400,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
                  textTransform: i === 0 ? 'capitalize' : 'none',
                }}
              >
                {bc.label}
              </button>
            </div>
          ))}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2 }}>
          {(['grid', 'list'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              background: viewMode === mode ? 'rgba(255,255,255,0.12)' : 'none',
              border: 'none', padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
              color: viewMode === mode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.38)',
              display: 'flex', alignItems: 'center',
            }}>
              {mode === 'grid' ? <IcoGrid /> : <IcoList />}
            </button>
          ))}
        </div>

        {/* New Folder button */}
        <button
          onClick={handleNewFolder}
          title="New Folder"
          style={{
            background: 'none', border: 'none', padding: '4px 6px', borderRadius: 5, cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <IcoFolderPlus />
        </button>

        {/* Search */}
        <div style={{ position: 'relative', width: 150 }}>
          <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }}>
            <IcoSearch />
          </div>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search"
            style={{
              width: '100%', paddingLeft: 24, paddingRight: 8, height: 26,
              borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)',
              fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: sidebarWidth, background: 'rgba(16,16,20,0.98)', borderRight: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, overflowY: 'auto', paddingTop: 8 }}>
          {sidebarEntries.map(entry => (
            <button
              key={entry.id}
              onClick={() => navigateTo(entry.vfsPath)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                width: `calc(100% - 8px)`, margin: '0 4px', padding: '5px 8px',
                paddingLeft: 8 + entry.depth * 12,
                border: 'none', borderRadius: 8, cursor: 'pointer', boxSizing: 'border-box',
                background: currentVFSPath === entry.vfsPath ? 'rgba(43,121,255,0.2)' : 'transparent',
                color: currentVFSPath === entry.vfsPath ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
                fontSize: 12.5, textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: currentVFSPath === entry.vfsPath ? '#5B9BF8' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {entry.icon}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.label}
              </span>
            </button>
          ))}
        </div>

        {/* Sidebar resize handle */}
        <div
          onMouseDown={onSidebarDividerDown}
          style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, zIndex: 1 }}
        />

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* List header */}
          {viewMode === 'list' && (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 12px', height: 26,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(18,18,24,0.95)',
            }}>
              {[['Name', 1, 'left'], ['Modified', '90px', 'right'], ['Size', '60px', 'right']].map(([label, w, align]) => (
                <span key={label as string} style={{
                  flex: w === 1 ? 1 : undefined, width: w !== 1 ? w as string : undefined,
                  fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)',
                  textAlign: align as 'left' | 'right', flexShrink: w !== 1 ? 0 : undefined,
                }}>
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Files */}
          <div
            style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'grid' ? 12 : 0 }}
            onClick={() => { setSelectedId(null); setContextMenu(null); }}
          >
            {items.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)', fontSize: 13, gap: 8 }}>
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                Empty
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <AnimatePresence>
                  {items.map(item => (
                    <GridItem
                      key={item.id}
                      item={item}
                      selected={selectedId === item.id}
                      renaming={renamingId === item.id}
                      onSelect={e => { e.stopPropagation(); setSelectedId(item.id); }}
                      onOpen={() => openItem(item)}
                      onRenameCommit={name => commitRename(item.id, name)}
                      onRenameCancel={cancelRename}
                      onContextMenu={e => onItemContextMenu(e, item)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div>
                {items.map((item, i) => (
                  <ListRow
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    isFirst={i === 0}
                    renaming={renamingId === item.id}
                    onSelect={e => { e.stopPropagation(); setSelectedId(item.id); }}
                    onOpen={() => openItem(item)}
                    onRenameCommit={name => commitRename(item.id, name)}
                    onRenameCancel={cancelRename}
                    onContextMenu={e => onItemContextMenu(e, item)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* File preview panel -- shows for any selected item */}
          {selectedNode && (
            selectedNode.type === 'folder'
              ? <FolderPreview node={selectedNode} items={items} />
              : <FilePreview node={selectedNode} />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(16,16,20,0.98)', borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0,
      }}>
        {items.length} item{items.length !== 1 ? 's' : ''}
        {selectedNode && ` -- "${selectedNode.name}" selected`}
        <span style={{ marginLeft: 12, opacity: 0.5 }}>{currentVFSPath}</span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 500,
            background: 'rgba(28,28,34,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '4px 0',
            minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {[
            {
              label: 'Rename',
              action: () => { startRename(contextMenu.nodeId); },
              danger: false,
            },
            {
              label: 'Delete',
              action: () => deleteById(contextMenu.nodeId),
              danger: true,
            },
            ...(contextMenu.nodeType === 'folder' ? [{
              label: 'New Folder Inside',
              action: () => {
                const node = items.find(n => n.id === contextMenu.nodeId);
                if (node) {
                  navigateTo(node.vfsPath);
                  setContextMenu(null);
                }
              },
              danger: false,
            }] : []),
          ].map((opt, i) => (
            <button
              key={i}
              onClick={opt.action}
              style={{
                display: 'block', width: '100%', padding: '6px 14px',
                textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12.5, color: opt.danger ? '#f87171' : 'rgba(255,255,255,0.8)',
                fontFamily: 'system-ui,-apple-system,sans-serif',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      </div>{/* end keyboard-handler div */}
    </motion.div>
  );
}
