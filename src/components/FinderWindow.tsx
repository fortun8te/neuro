/**
 * FinderWindow -- Session-aware file browser. Uses VFS for all data.
 * Sidebar: file-tree component. Main: grid/list view. Preview panel. Context menu.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { vfs, vfsReady } from '../utils/sessionFileSystem';
import type { VFSNode } from '../utils/sessionFileSystem';
import { useFSStore } from '../utils/fsStore';
import { desktopBus } from '../utils/desktopBus';
import FileTree, { type FileTreeNode } from './ui/file-tree';

// ── Helpers ─────────────────────────────────────────────────────────────
const S: React.CSSProperties = { fontFamily: 'system-ui,-apple-system,sans-serif' };

function vfsToTreeNode(n: VFSNode): FileTreeNode {
  const ch = n.type === 'folder' ? vfs.listFolder(n.path) : [];
  return { id: n.id, name: n.name, type: n.type, path: n.path, mimeType: n.mimeType, size: n.size, children: ch.length > 0 ? ch.map(vfsToTreeNode) : undefined };
}

interface DNode { id: string; name: string; type: 'folder' | 'file'; extension?: string; size?: string; modified: string; vfsPath: string; hasData?: boolean; mimeType?: string; }

function toDisplay(n: VFSNode): DNode {
  const ext = vfs.getExtension(n);
  return { id: n.id, name: n.name, type: n.type, extension: ext, size: n.type === 'file' ? vfs.formatSize(n) : undefined, modified: vfs.formatModified(n), vfsPath: n.path, hasData: !!n.data, mimeType: n.mimeType };
}

// ── Preview ─────────────────────────────────────────────────────────────
function Preview({ node }: { node: DNode }) {
  const vn = vfs.getById(node.id);
  const ext = (node.extension || '').toLowerCase();
  const isImg = node.mimeType?.startsWith('image/') || /^(jpe?g|png|gif|webp|svg)$/.test(ext);
  const isPdf = ext === 'pdf' || node.mimeType === 'application/pdf';
  const isTxt = /^(txt|md|json|ts|tsx|js|jsx|css|html|py|go|rs|toml|yaml|yml|sh|env|log)$/.test(ext);
  const canEdit = /^(txt|md)$/.test(ext);
  const data = vn?.data ?? '';
  const [zoom, setZoom] = useState(1);
  const [edited, setEdited] = useState(data);
  useEffect(() => { setEdited(data); setZoom(1); }, [data]);

  const save = useCallback(() => {
    if (!vn || !canEdit) return;
    vfs.createFile(vn.path.slice(0, vn.path.lastIndexOf('/')), vn.name, edited, vn.mimeType || 'text/plain');
  }, [vn, canEdit, edited]);

  const ps: React.CSSProperties = { borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(14,14,18,0.98)', flexShrink: 0, overflow: 'auto', maxHeight: 260, minHeight: 60 };

  if (node.type === 'folder') {
    const ch = vfs.listFolder(node.vfsPath);
    return (<div style={{ ...ps, padding: '10px 14px' }}><div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{node.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>Folder -- {ch.length} item{ch.length !== 1 ? 's' : ''}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>{node.vfsPath}</div></div>);
  }
  if (isImg && data) {
    const src = data.startsWith('data:') ? data : `data:${node.mimeType || 'image/jpeg'};base64,${data}`;
    return (<div style={ps}><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}><span>{node.name}</span><span style={{ flex: 1 }} /><button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>-</button><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', minWidth: 28, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>+</button></div><div style={{ overflow: 'auto', padding: 8, display: 'flex', justifyContent: 'center' }}><img src={src} alt={node.name} style={{ maxWidth: `${zoom * 100}%`, height: 'auto', borderRadius: 4, imageRendering: zoom >= 2 ? 'pixelated' : 'auto' }} /></div></div>);
  }
  if (isPdf) {
    const blob = data.startsWith('blob:');
    return (<div style={ps}><div style={{ padding: '4px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{node.name}</div>{blob ? <iframe src={data} title={node.name} style={{ width: '100%', height: 220, border: 'none', background: '#222' }} /> : <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>PDF -- {node.size || 'unknown size'}</div>}</div>);
  }
  if (isTxt && data) {
    return (<div style={ps}><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{node.name}{canEdit && <button onClick={save} style={{ marginLeft: 'auto', background: 'rgba(43,121,255,0.2)', border: '1px solid rgba(43,121,255,0.4)', borderRadius: 4, color: '#5B9BF8', fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}>Save</button>}</div><textarea value={canEdit ? edited : data} onChange={canEdit ? e => setEdited(e.target.value) : undefined} readOnly={!canEdit} spellCheck={false} style={{ width: '100%', height: 180, background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.8)', border: 'none', outline: 'none', padding: 10, fontSize: 11, fontFamily: '"SF Mono",monospace', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }} /></div>);
  }
  return (<div style={{ ...ps, padding: '10px 14px' }}><div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{node.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{ext ? ext.toUpperCase() + ' File' : 'File'}{node.size && ` -- ${node.size}`}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>{node.vfsPath}</div></div>);
}

// ── Rename Input ────────────────────────────────────────────────────────
function RenameInput({ initial, onCommit, onCancel }: { initial: string; onCommit: (n: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState(initial);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return <input ref={ref} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCommit(val.trim() || initial); } if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }} onBlur={() => onCommit(val.trim() || initial)} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#fff', background: 'rgba(43,121,255,0.3)', border: '1px solid rgba(43,121,255,0.8)', borderRadius: 3, outline: 'none', padding: '0 3px', width: '100%', maxWidth: 76, textAlign: 'center', ...S, boxSizing: 'border-box' }} />;
}

// ── Context Menu ────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; nodeId: string; nodeType: 'folder' | 'file'; vfsPath: string; }

function CtxPopup({ menu, onClose, onAction }: { menu: CtxMenu; onClose: () => void; onAction: (a: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const items: Array<{ label: string; act: string; danger?: boolean }> = [];
  if (menu.nodeType === 'folder') { items.push({ label: 'New Folder', act: 'new-folder' }); items.push({ label: 'New File', act: 'new-file' }); }
  items.push({ label: 'Rename', act: 'rename' }); items.push({ label: 'Delete', act: 'delete', danger: true });
  return (<div ref={ref} onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 999, background: 'rgba(28,28,34,0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 0', minWidth: 150, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>{items.map((it, i) => (<button key={i} onClick={() => { onAction(it.act); onClose(); }} style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: it.danger ? '#f87171' : 'rgba(255,255,255,0.8)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>{it.label}</button>))}</div>);
}

// ── Main ─────────────────────────────────────────────────────────────────
export function FinderWindow({ onClose, zIndex, onFocus, rootPath = '/nomad' }: { onClose: () => void; zIndex?: number; onFocus?: () => void; rootPath?: string }) {
  useFSStore();
  const [ready, setReady] = useState(false);
  const [curPath, setCurPath] = useState(rootPath);
  const [hist, setHist] = useState<string[]>([rootPath]);
  const [hIdx, setHIdx] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [sbW, setSbW] = useState(200);
  const [renId, setRenId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const sbDrag = useRef(false);
  const sbStart = useRef({ x: 0, w: 200 });
  const kbRef = useRef<HTMLDivElement>(null);
  const { windowRef, pos, isDragging, onTitleBarMouseDown } = useWindowDrag({ windowWidth: 860, windowHeight: 540, centerOffset: { x: 44, y: 36 } });

  useEffect(() => { vfsReady().then(() => setReady(true)); }, []);
  const snap = useFSStore();

  const items: DNode[] = useMemo(() => {
    if (!ready) return [];
    const raw = vfs.listFolder(curPath).map(toDisplay);
    return search ? raw.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPath, search, ready, snap]);

  const selNode = selId ? items.find(i => i.id === selId) ?? null : null;
  const treeData = useMemo(() => ready ? vfs.listFolder(rootPath).map(vfsToTreeNode) : [], [ready, snap, rootPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
  const navTo = useCallback((p: string) => {
    // Restrict navigation to rootPath and below
    if (!p.startsWith(rootPath)) return;
    setCurPath(p); setSelId(null); setSearch(''); setCtx(null); setRenId(null);
    setHist(prev => { const t = prev.slice(0, hIdx + 1); const n = [...t, p]; setHIdx(n.length - 1); return n; });
  }, [hIdx, rootPath]);
  const goBack = useCallback(() => { if (hIdx > 0) { setHIdx(hIdx - 1); setCurPath(hist[hIdx - 1]); setSelId(null); } }, [hIdx, hist]);
  const goFwd = useCallback(() => { if (hIdx < hist.length - 1) { setHIdx(hIdx + 1); setCurPath(hist[hIdx + 1]); setSelId(null); } }, [hIdx, hist]);
  const openItem = useCallback((it: DNode) => { if (it.type === 'folder') navTo(it.vfsPath); else window.dispatchEvent(new CustomEvent('vfs-open-file', { detail: { id: it.id, path: it.vfsPath, mimeType: it.mimeType, name: it.name } })); }, [navTo]);

  // CRUD
  const commitRen = useCallback((id: string, name: string) => { const n = vfs.getById(id); if (n) vfs.renameNode(n.path, name); setRenId(null); }, []);
  const delById = useCallback((id: string) => { const n = vfs.getById(id); if (!n) return; if (window.confirm(`Delete "${n.name}"?`)) { vfs.deleteNode(n.path); if (selId === id) setSelId(null); } setCtx(null); }, [selId]);
  const newFolder = useCallback(() => { const ex = items.map(i => i.name); let nm = 'New Folder'; let c = 1; while (ex.includes(nm)) nm = `New Folder ${c++}`; const n = vfs.createFolder(curPath, nm); setSelId(n.id); setRenId(n.id); }, [curPath, items]);
  const ctxAction = useCallback((a: string) => { if (!ctx) return; if (a === 'rename') setRenId(ctx.nodeId); else if (a === 'delete') delById(ctx.nodeId); else if (a === 'new-folder') { const n = vfs.createFolder(ctx.vfsPath, 'New Folder'); setRenId(n.id); } else if (a === 'new-file') { const n = vfs.createFile(ctx.vfsPath, 'untitled.txt', '', 'text/plain'); setRenId(n.id); } setCtx(null); }, [ctx, delById]);

  // Keyboard
  const onKb = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (renId) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selNode) { e.preventDefault(); delById(selNode.id); }
    if (e.key === 'F2' && selNode) { e.preventDefault(); setRenId(selNode.id); }
    if (e.key === 'Escape') { setSelId(null); setCtx(null); }
  }, [renId, selNode, delById]);

  // DesktopBus
  useEffect(() => {
    const unsub = desktopBus.subscribe(ev => {
      if (ev.type === 'finder_navigate') navTo(ev.path);
      else if (ev.type === 'finder_open_file') { const sl = ev.path.lastIndexOf('/'); navTo(sl > 0 ? ev.path.slice(0, sl) : rootPath); setTimeout(() => { const n = vfs.getByPath(ev.path); if (n) { setSelId(n.id); window.dispatchEvent(new CustomEvent('vfs-open-file', { detail: { id: n.id, path: n.path, mimeType: n.mimeType, name: n.name } })); } }, 100); }
      else if (ev.type === 'finder_select_file') { const n = vfs.getByPath(ev.path); if (n) setSelId(n.id); }
    });
    return unsub;
  }, [navTo]);

  // Sidebar resize
  const onSbDown = useCallback((e: React.MouseEvent) => { e.preventDefault(); sbDrag.current = true; sbStart.current = { x: e.clientX, w: sbW }; const mv = (ev: MouseEvent) => { if (!sbDrag.current) return; setSbW(Math.max(140, Math.min(300, sbStart.current.w + ev.clientX - sbStart.current.x))); }; const up = () => { sbDrag.current = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); }, [sbW]);

  const crumbs = useMemo(() => { const s = curPath.split('/').filter(Boolean); return s.map((seg, i) => ({ label: seg.length > 12 ? seg.slice(0, 8) + '...' : seg, path: '/' + s.slice(0, i + 1).join('/') })); }, [curPath]);

  // FileTree callbacks
  const treeSelect = useCallback((_p: string, n: FileTreeNode) => { if (n.type === 'folder') navTo(n.path); else { const sl = n.path.lastIndexOf('/'); navTo(sl > 0 ? n.path.slice(0, sl) : rootPath); setTimeout(() => { const v = vfs.getByPath(n.path); if (v) setSelId(v.id); }, 50); } }, [navTo, rootPath]);

  if (!ready) return null;

  const canBack = hIdx > 0, canFwd = hIdx < hist.length - 1;
  const chev = (rot: boolean) => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={rot ? { transform: 'rotate(180deg)' } : undefined}><polyline points="9 18 15 12 9 6" /></svg>;

  return (
    <motion.div ref={windowRef} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }} onMouseDownCapture={onFocus} style={{ position: 'absolute', ...(pos ? { left: pos.x, top: pos.y, transform: 'none' } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }), width: 860, height: 540, maxWidth: 'calc(100% - 8px)', maxHeight: 'calc(100% - 8px)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: zIndex ?? 200, pointerEvents: 'auto', background: '#0a0a0c', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: 'none', ...S, userSelect: 'none' }}>
      {isDragging && <div style={{ position: 'absolute', inset: 0, zIndex: 9999, cursor: 'grabbing' }} />}
      <div ref={kbRef} tabIndex={0} onKeyDown={onKb} style={{ display: 'contents', outline: 'none' }}>
        {/* Title bar */}
        <div onMouseDown={onTitleBarMouseDown} style={{ height: 36, display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14, background: '#1c1c1e', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, cursor: isDragging ? 'grabbing' : 'grab', position: 'relative' }}>
          <button onClick={onClose} style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', padding: 0 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,95,87,0.7)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }} title="Close" />
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: -0.2 }}>Files</div>
        </div>
        {/* Toolbar */}
        <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, background: '#1a1a1e', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
          <button onClick={goBack} disabled={!canBack} style={{ background: 'none', border: 'none', padding: '4px 5px', borderRadius: 5, color: canBack ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)', cursor: canBack ? 'pointer' : 'default', display: 'flex' }}>{chev(true)}</button>
          <button onClick={goFwd} disabled={!canFwd} style={{ background: 'none', border: 'none', padding: '4px 5px', borderRadius: 5, color: canFwd ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)', cursor: canFwd ? 'pointer' : 'default', display: 'flex' }}>{chev(false)}</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', minWidth: 0 }}>
            {crumbs.map((bc, i, a) => (<div key={bc.path} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: i < a.length - 1 ? 1 : 0 }}>{i > 0 && chev(false)}<button onClick={() => { if (i < a.length - 1) navTo(bc.path); }} style={{ background: 'none', border: 'none', padding: '2px 4px', borderRadius: 4, fontSize: 12, cursor: i < a.length - 1 ? 'pointer' : 'default', color: i === a.length - 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.38)', fontWeight: i === a.length - 1 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120, textTransform: i === 0 ? 'capitalize' : 'none' }}>{bc.label}</button></div>))}
          </div>
          <div style={{ display: 'flex', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2 }}>
            {(['grid', 'list'] as const).map(m => (<button key={m} onClick={() => setView(m)} style={{ background: view === m ? 'rgba(255,255,255,0.12)' : 'none', border: 'none', padding: '3px 7px', borderRadius: 5, cursor: 'pointer', color: view === m ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.38)', fontSize: 10 }}>{m === 'grid' ? 'Grid' : 'List'}</button>))}
          </div>
          <button onClick={newFolder} title="New Folder" style={{ background: 'none', border: 'none', padding: '4px 6px', borderRadius: 5, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 11 }} onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}>+ Folder</button>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" style={{ width: 140, paddingLeft: 8, paddingRight: 8, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: sbW, background: 'rgba(16,16,20,0.98)', borderRight: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, overflowY: 'auto', padding: '8px 4px' }}>
            <FileTree data={treeData} selectedPath={curPath} onSelect={treeSelect} onCreateFile={(p, n) => vfs.createFile(p, n, '', 'text/plain')} onCreateFolder={(p, n) => vfs.createFolder(p, n)} onRename={(p, n) => vfs.renameNode(p, n)} onDelete={p => vfs.deleteNode(p)} />
          </div>
          <div onMouseDown={onSbDown} style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, zIndex: 1 }} />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {view === 'list' && (<div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 26, borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(18,18,24,0.95)' }}><span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>Name</span><span style={{ width: 90, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textAlign: 'right', flexShrink: 0 }}>Modified</span><span style={{ width: 60, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textAlign: 'right', flexShrink: 0 }}>Size</span></div>)}
            <div style={{ flex: 1, overflowY: 'auto', padding: view === 'grid' ? 12 : 0 }} onClick={() => { setSelId(null); setCtx(null); }}>
              {items.length === 0 ? (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Empty</div>) : view === 'grid' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><AnimatePresence>{items.map(it => (
                  <motion.div key={it.id} whileTap={{ scale: 0.96 }} onClick={e => { e.stopPropagation(); setSelId(it.id); }} onDoubleClick={renId === it.id ? undefined : () => openItem(it)} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelId(it.id); setCtx({ x: e.clientX, y: e.clientY, nodeId: it.id, nodeType: it.type, vfsPath: it.vfsPath }); }} className="flex flex-col items-center gap-1 p-2 rounded-lg cursor-default select-none" style={{ background: selId === it.id ? 'rgba(43,121,255,0.25)' : 'transparent', minWidth: 80, maxWidth: 80 }}>
                    <div style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{it.type === 'folder' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</div>
                    {renId === it.id ? <RenameInput initial={it.name} onCommit={n => commitRen(it.id, n)} onCancel={() => setRenId(null)} /> : <span style={{ fontSize: 11, color: selId === it.id ? '#fff' : 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 76, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as unknown as undefined, lineHeight: 1.3 }}>{it.name}</span>}
                  </motion.div>
                ))}</AnimatePresence></div>
              ) : (<div>{items.map((it, i) => (
                <div key={it.id} onClick={e => { e.stopPropagation(); setSelId(it.id); }} onDoubleClick={renId === it.id ? undefined : () => openItem(it)} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelId(it.id); setCtx({ x: e.clientX, y: e.clientY, nodeId: it.id, nodeType: it.type, vfsPath: it.vfsPath }); }} className="flex items-center gap-2 px-3 cursor-default select-none" style={{ background: selId === it.id ? 'rgba(43,121,255,0.25)' : 'transparent', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)', height: 28 }}>
                  <span style={{ fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 }}>{it.type === 'folder' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
                  {renId === it.id ? <RenameInput initial={it.name} onCommit={n => commitRen(it.id, n)} onCancel={() => setRenId(null)} /> : <span style={{ flex: 1, fontSize: 12, color: selId === it.id ? '#fff' : 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>}
                  {renId !== it.id && <><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 90, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>{it.modified}</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 60, textAlign: 'right', flexShrink: 0 }}>{it.size ?? '--'}</span></>}
                </div>
              ))}</div>)}
            </div>
            {selNode && <Preview node={selNode} />}
          </div>
        </div>
        {/* Status bar */}
        <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,16,20,0.98)', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
          {items.length} item{items.length !== 1 ? 's' : ''}{selNode && ` -- "${selNode.name}" selected`}<span style={{ marginLeft: 12, opacity: 0.5 }}>{curPath}</span>
        </div>
        {ctx && <CtxPopup menu={ctx} onClose={() => setCtx(null)} onAction={ctxAction} />}
      </div>
    </motion.div>
  );
}
