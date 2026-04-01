import { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Trash2,
  Upload,
  Plus,
  Search,
  X,
  ChevronRight,
  Check,
} from 'lucide-react';
import type { WorkspaceFile } from '../utils/workspace';

// ── Types ────────────────────────────────────────────────────────────────

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Array<{ key: string; content: string }>;
  onDeleteMemory?: (index: number) => void;
  onAddMemory?: (key: string, content: string) => void;
  onEditMemory?: (index: number, key: string, content: string) => void;
  workspaceFiles?: WorkspaceFile[];
  onUploadFile?: () => void;
  onDeleteFile?: (filename: string) => void;
  onCreateFolder?: (name: string) => void;
  workspacePath?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const BLUE = 'rgba(59,130,246,0.8)';
const BLUE_DIM = 'rgba(59,130,246,0.15)';
const BLUE_BORDER = 'rgba(59,130,246,0.25)';

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext))
    return <FileImage size={14} className="text-emerald-400/70 shrink-0" />;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext))
    return <FileText size={14} className="text-blue-400/70 shrink-0" />;
  if (['xlsx', 'xls', 'csv'].includes(ext))
    return <FileSpreadsheet size={14} className="text-green-400/70 shrink-0" />;
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext))
    return <FileArchive size={14} className="text-amber-400/70 shrink-0" />;
  return <FileIcon size={14} className="text-white/30 shrink-0" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getKeyColor(key: string): string {
  const colors: Record<string, string> = {
    brand: BLUE,
    audience: 'rgba(34,197,94,0.7)',
    competitor: 'rgba(251,146,60,0.7)',
    product: 'rgba(96,165,250,0.7)',
    tone: 'rgba(147,197,253,0.7)',
    insight: 'rgba(56,189,248,0.7)',
    objection: 'rgba(248,113,113,0.7)',
    desire: 'rgba(251,191,36,0.7)',
    user: 'rgba(96,165,250,0.7)',
    session: 'rgba(129,140,248,0.7)',
  };
  const lower = key.toLowerCase();
  for (const [k, c] of Object.entries(colors)) {
    if (lower.includes(k)) return c;
  }
  return BLUE;
}

// ── Component ────────────────────────────────────────────────────────────

export function WorkspaceModal({
  isOpen,
  onClose,
  memories,
  onDeleteMemory,
  onAddMemory,
  onEditMemory,
  workspaceFiles = [],
  onUploadFile,
  onDeleteFile,
  onCreateFolder,
  workspacePath,
}: WorkspaceModalProps) {
  const [tab, setTab] = useState<'files' | 'memory'>('files');
  const [search, setSearch] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [addingMemory, setAddingMemory] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return memories.map((m, i) => ({ ...m, _idx: i }));
    const q = search.toLowerCase();
    return memories
      .map((m, i) => ({ ...m, _idx: i }))
      .filter(m => m.key.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
  }, [memories, search]);


  const handleSaveEdit = useCallback(() => {
    if (editingIdx !== null && onEditMemory && editingKey.trim()) {
      onEditMemory(editingIdx, editingKey.trim(), editingContent.trim());
    }
    setEditingIdx(null);
  }, [editingIdx, editingKey, editingContent, onEditMemory]);

  const handleAddMemory = useCallback(() => {
    if (onAddMemory && newKey.trim() && newContent.trim()) {
      onAddMemory(newKey.trim(), newContent.trim());
      setNewKey('');
      setNewContent('');
      setAddingMemory(false);
    }
  }, [newKey, newContent, onAddMemory]);

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (name && onCreateFolder) {
      onCreateFolder(name);
      setNewFolderName('');
      setCreatingFolder(false);
    }
  }, [newFolderName, onCreateFolder]);

  // Build tree: separate top-level folders and files, group nested files under folders
  const { topFolders, topFiles, filesByFolder } = useMemo(() => {
    const folders: WorkspaceFile[] = [];
    const files: WorkspaceFile[] = [];
    const byFolder: Record<string, WorkspaceFile[]> = {};

    const q = search.toLowerCase();
    for (const f of workspaceFiles) {
      const matchesSearch = !q || f.name.toLowerCase().includes(q);
      if (f.isFolder) {
        if (!q || f.name.toLowerCase().includes(q)) folders.push(f);
      } else if (f.name.includes('/')) {
        // nested file — put under its parent folder
        const parts = f.name.split('/');
        const parentFolder = parts[0];
        if (!byFolder[parentFolder]) byFolder[parentFolder] = [];
        if (matchesSearch) byFolder[parentFolder].push(f);
        // ensure parent folder appears even if not explicitly listed
        if (!folders.find(fd => fd.name === parentFolder)) {
          folders.push({ name: parentFolder, size: 0, sizeStr: '', isFolder: true });
        }
      } else {
        if (matchesSearch) files.push(f);
      }
    }

    return { topFolders: folders, topFiles: files, filesByFolder: byFolder };
  }, [workspaceFiles, search]);

  if (!isOpen) return null;

  const totalSize = workspaceFiles.filter(f => !f.isFolder).reduce((s, f) => s + f.size, 0);

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[900]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[901] pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl rounded-2xl overflow-hidden mx-4"
          style={{
            background: 'rgba(18,18,24,0.98)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <Folder size={16} style={{ color: BLUE }} />
              <span className="text-[13px] font-semibold text-white/90">Workspace</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06] text-white/40 hover:text-white/70"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-3 flex items-center justify-between">
            <div className="inline-flex rounded-lg p-0.5" style={{ background: 'var(--glass-bg-light)' }}>
              {(['files', 'memory'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSearch(''); }}
                  className="px-3.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150"
                  style={
                    tab === t
                      ? { background: 'var(--glass-bg-medium)', color: 'var(--text-primary)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {t === 'files' ? `Files${workspaceFiles.length > 0 ? ` (${workspaceFiles.length})` : ''}` : `Memory${memories.length > 0 ? ` (${memories.length})` : ''}`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/25" />
              <input
                ref={searchRef}
                type="text"
                placeholder={tab === 'files' ? 'Search files...' : 'Search memories...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-48 h-7 pl-7 pr-3 rounded-lg text-[11px] outline-none transition-colors"
                style={{
                  background: 'var(--glass-bg-light)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 max-h-[28rem] overflow-y-auto">

            {/* ── FILES TAB ─────────────────────────────────────────── */}
            {tab === 'files' ? (
              <div className="flex flex-col gap-3">
                {/* Action bar: upload + new folder */}
                <div className="flex gap-2">
                  <button
                    onClick={onUploadFile}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors cursor-pointer"
                    style={{
                      border: '1.5px dashed var(--text-ghost)',
                      background: 'var(--glass-bg-light)',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                      e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                      e.currentTarget.style.color = 'rgba(59,130,246,0.7)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--text-ghost)';
                      e.currentTarget.style.background = 'var(--glass-bg-light)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <Upload size={13} />
                    <span className="text-[11px] font-medium">Upload file</span>
                  </button>
                  {onCreateFolder && (
                    <button
                      onClick={() => { setCreatingFolder(true); setTimeout(() => folderInputRef.current?.focus(), 50); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl transition-colors cursor-pointer"
                      style={{
                        border: '1.5px dashed var(--text-ghost)',
                        background: 'var(--glass-bg-light)',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                        e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                        e.currentTarget.style.color = 'rgba(59,130,246,0.7)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--text-ghost)';
                        e.currentTarget.style.background = 'var(--glass-bg-light)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                      title="New folder"
                    >
                      <FolderPlus size={13} />
                      <span className="text-[11px] font-medium">New folder</span>
                    </button>
                  )}
                </div>

                {/* Inline folder name input */}
                {creatingFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <FolderPlus size={13} style={{ color: BLUE }} className="shrink-0" />
                    <input
                      ref={folderInputRef}
                      type="text"
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                      }}
                      className="flex-1 text-[12px] bg-transparent outline-none"
                      style={{ color: 'var(--text-primary)' }}
                    />
                    <button onClick={handleCreateFolder} className="text-blue-400 hover:text-blue-300 transition-colors" title="Create">
                      <Check size={13} />
                    </button>
                    <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="text-white/20 hover:text-white/50 transition-colors" title="Cancel">
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* File tree */}
                {(topFolders.length === 0 && topFiles.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-1.5">
                    <FileIcon size={20} className="text-white/10" />
                    <span className="text-[11px] text-white/20">
                      {search ? 'No files match' : 'No files in workspace'}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Stats bar */}
                    <div className="flex items-center justify-between text-[10px] text-white/30 px-1">
                      <span>{workspaceFiles.filter(f => !f.isFolder).length} file{workspaceFiles.filter(f => !f.isFolder).length !== 1 ? 's' : ''}{topFolders.length > 0 ? `, ${topFolders.length} folder${topFolders.length !== 1 ? 's' : ''}` : ''}</span>
                      <span>{formatSize(totalSize)}</span>
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                      {/* Folders */}
                      {topFolders.map((folder, i) => {
                        const isExpanded = expandedFolders.has(folder.name);
                        const children = filesByFolder[folder.name] || [];
                        return (
                          <div key={folder.name}>
                            <div
                              className="flex items-center gap-2 px-3 py-2.5 group transition-colors cursor-pointer"
                              style={{
                                background: 'transparent',
                                borderTop: i > 0 ? '1px solid var(--glass-bg-light)' : undefined,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg-light)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              onClick={() => setExpandedFolders(prev => {
                                const next = new Set(prev);
                                if (next.has(folder.name)) next.delete(folder.name); else next.add(folder.name);
                                return next;
                              })}
                            >
                              <ChevronRight size={12} className="text-white/25 shrink-0 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : undefined }} />
                              {isExpanded
                                ? <FolderOpen size={14} className="text-blue-400/60 shrink-0" />
                                : <Folder size={14} className="text-blue-400/60 shrink-0" />}
                              <span className="flex-1 text-[12px] text-white/70 truncate font-medium">{folder.name}</span>
                              {children.length > 0 && <span className="text-[10px] text-white/25 shrink-0">{children.length}</span>}
                              {onDeleteFile && (
                                <button
                                  onClick={e => { e.stopPropagation(); onDeleteFile(folder.name); }}
                                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center transition-all shrink-0 text-white/20 hover:text-red-400/70"
                                  title="Remove folder"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            {/* Children */}
                            {isExpanded && children.map((f, _ci) => (
                              <div
                                key={f.name}
                                className="flex items-center gap-2 px-3 py-2 group transition-colors"
                                style={{
                                  background: 'var(--glass-bg-light)',
                                  borderTop: '1px solid var(--glass-bg-light)',
                                  paddingLeft: '2.25rem',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg-medium)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--glass-bg-light)')}
                              >
                                {getFileIcon(f.name)}
                                <span className="flex-1 text-[11px] text-white/55 truncate">{f.name.split('/').slice(1).join('/')}</span>
                                <span className="text-[10px] text-white/20 tabular-nums shrink-0">{f.sizeStr || formatSize(f.size)}</span>
                                {onDeleteFile && (
                                  <button
                                    onClick={() => onDeleteFile(f.name)}
                                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center transition-all shrink-0 text-white/20 hover:text-red-400/70"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* Top-level files */}
                      {topFiles.map((f, i) => (
                        <div
                          key={f.name}
                          className="flex items-center gap-3 px-3 py-2.5 group transition-colors"
                          style={{
                            background: 'transparent',
                            borderTop: (topFolders.length > 0 || i > 0) ? '1px solid var(--glass-bg-light)' : undefined,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg-light)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {getFileIcon(f.name)}
                          <span className="flex-1 text-[12px] text-white/70 truncate">{f.name}</span>
                          <span className="text-[10px] text-white/25 tabular-nums shrink-0">{f.sizeStr || formatSize(f.size)}</span>
                          {f.modifiedStr && (
                            <span className="text-[10px] text-white/20 shrink-0 w-16 text-right">{f.modifiedStr}</span>
                          )}
                          {onDeleteFile && (
                            <button
                              onClick={() => onDeleteFile(f.name)}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center transition-all shrink-0 text-white/20 hover:text-red-400/70"
                              title="Remove file"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Workspace path */}
                {workspacePath && (
                  <div className="text-[9px] text-white/15 font-mono truncate px-1">{workspacePath}</div>
                )}
              </div>
            ) : (
              /* ── MEMORY TAB ─────────────────────────────────────── */
              <div className="flex flex-col gap-3">
                {/* Add memory button */}
                {onAddMemory && !addingMemory && (
                  <button
                    onClick={() => setAddingMemory(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-[11px] font-medium"
                    style={{
                      border: `1px dashed ${BLUE_BORDER}`,
                      background: BLUE_DIM,
                      color: BLUE,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = BLUE_DIM)}
                  >
                    <Plus size={12} />
                    Add memory
                  </button>
                )}

                {/* Add memory form */}
                {addingMemory && (
                  <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(59,130,246,0.06)', border: `1px solid ${BLUE_BORDER}` }}>
                    <input
                      autoFocus
                      type="text"
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      className="w-full h-7 px-2.5 rounded-lg text-[11px] outline-none font-mono"
                      style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      placeholder="Key (e.g. brand_voice)"
                    />
                    <textarea
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="w-full h-16 px-2.5 py-1.5 rounded-lg text-[11px] outline-none resize-none"
                      style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      placeholder="Content"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddMemory}
                        className="flex-1 h-7 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ background: BLUE, color: 'white' }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingMemory(false); setNewKey(''); setNewContent(''); }}
                        className="flex-1 h-7 rounded-lg text-[11px] font-medium transition-colors text-white/50 hover:text-white/70"
                        style={{ background: 'var(--glass-bg-light)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Memory list */}
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-1.5">
                    <span className="text-[11px] text-white/20">
                      {search ? 'No memories match' : 'No memories stored yet'}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    {filtered.map((m, i) => (
                      <div
                        key={m._idx}
                        className="px-3.5 py-3 group transition-colors"
                        style={{
                          background: 'transparent',
                          borderTop: i > 0 ? '1px solid var(--glass-bg-light)' : undefined,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg-light)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {editingIdx === m._idx ? (
                          /* Edit mode */
                          <div className="flex flex-col gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={editingKey}
                              onChange={e => setEditingKey(e.target.value)}
                              className="w-full h-7 px-2.5 rounded-lg text-[11px] outline-none font-mono"
                              style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                              placeholder="Key"
                            />
                            <textarea
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              className="w-full h-20 px-2.5 py-1.5 rounded-lg text-[11px] outline-none resize-none"
                              style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                              placeholder="Content"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="flex-1 h-7 rounded-lg text-[11px] font-medium transition-colors"
                                style={{ background: BLUE, color: 'white' }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingIdx(null)}
                                className="flex-1 h-7 rounded-lg text-[11px] font-medium transition-colors text-white/50 hover:text-white/70"
                                style={{ background: 'var(--glass-bg-light)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display mode */
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                setEditingIdx(m._idx);
                                setEditingKey(m.key);
                                setEditingContent(m.content);
                              }}
                            >
                              <span
                                className="inline-block text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded mb-1.5"
                                style={{
                                  color: getKeyColor(m.key),
                                  background: `${getKeyColor(m.key)}15`,
                                  border: `1px solid ${getKeyColor(m.key)}25`,
                                }}
                              >
                                {m.key}
                              </span>
                              <p className="text-[11px] leading-relaxed text-white/50">
                                {m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content}
                              </p>
                            </div>
                            {onDeleteMemory && (
                              <button
                                onClick={() => onDeleteMemory(m._idx)}
                                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center transition-all shrink-0 mt-0.5 text-white/20 hover:text-red-400/70"
                                title="Remove memory"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
