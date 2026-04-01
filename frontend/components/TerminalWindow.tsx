/**
 * TerminalWindow -- Simulated terminal. Commands (ls, cd, pwd, echo, cat, mkdir, rm,
 * clear, help, history) run locally against VFS. Others emit `terminal_run` via desktopBus.
 */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { desktopBus } from '../utils/desktopBus';
import { vfs } from '../utils/sessionFileSystem';

type LT = 'prompt' | 'output' | 'error' | 'success' | 'system';
interface TLine { id: string; type: LT; text: string; }

const PS = '$ ';
const uid = () => `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const lc = (t: LT) => t === 'prompt' ? '#4ade80' : t === 'error' ? '#ef4444' : t === 'success' ? '#22c55e' : t === 'system' ? 'var(--text-muted)' : 'var(--text-secondary)';

function resolve(cwd: string, target: string): string {
  if (target.startsWith('/')) return target;
  const p = cwd.split('/').filter(Boolean);
  for (const s of target.split('/')) { if (s === '..') p.pop(); else if (s !== '.') p.push(s); }
  return '/' + p.join('/');
}

const WELCOME: TLine[] = [
  { id: 'w1', type: 'system', text: 'Neuro Terminal  v1.0.0' },
  { id: 'w2', type: 'system', text: 'Type "help" for available commands.' },
  { id: 'w3', type: 'system', text: '' },
];

export interface TerminalWindowHandle { runCommand: (cmd: string) => void; }

export const TerminalWindow = forwardRef<TerminalWindowHandle, { onClose: () => void; zIndex?: number; onFocus?: () => void }>(function TerminalWindow({ onClose, zIndex, onFocus }, ref) {
  const [lines, setLines] = useState<TLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [_hIdx, setHIdx] = useState(-1);
  const [cwd, setCwd] = useState('/nomad');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { windowRef, pos, isDragging, onTitleBarMouseDown } = useWindowDrag({ windowWidth: 640, windowHeight: 380 });

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const add = useCallback((type: LT, text: string) => { setLines(p => [...p, { id: uid(), type, text }]); }, []);

  const exec = useCallback((raw: string) => {
    if (!raw.trim()) return;
    add('prompt', `${PS}${raw}`);
    setHist(p => [raw, ...p.filter(c => c !== raw)].slice(0, 100));
    setHIdx(-1); setInput('');

    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmd === 'clear') { setLines([]); return; }
    if (cmd === 'help') { ['ls [path]  -- list directory', 'cd <path>  -- change directory', 'pwd        -- print working directory', 'echo <txt> -- print text', 'cat <file> -- display file contents', 'mkdir <nm> -- create directory', 'rm <path>  -- remove file/folder', 'clear      -- clear terminal', 'history    -- command history', 'help       -- this message'].forEach(l => add('success', '  ' + l)); add('output', 'Other commands forwarded to agent.'); return; }
    if (cmd === 'history') { if (hist.length === 0) add('output', 'No history.'); else hist.forEach((c, i) => add('output', `  ${i + 1}  ${c}`)); return; }
    if (cmd === 'pwd') { add('output', cwd); return; }
    if (cmd === 'echo') { add('output', args); return; }
    if (cmd === 'ls') { const t = args ? resolve(cwd, args) : cwd; const it = vfs.listFolder(t); if (it.length === 0) add('output', '(empty)'); else it.forEach(i => add('output', `  ${i.name}${i.type === 'folder' ? '/' : ''}`)); return; }
    if (cmd === 'cd') { if (!args || args === '~') { setCwd('/nomad'); return; } const t = resolve(cwd, args); const n = vfs.getByPath(t); if (!n || n.type !== 'folder') add('error', `cd: no such directory: ${args}`); else setCwd(t); return; }
    if (cmd === 'cat') { if (!args) { add('error', 'cat: missing file'); return; } const n = vfs.readFile(resolve(cwd, args)); if (!n) add('error', `cat: ${args}: No such file`); else if (n.type === 'folder') add('error', `cat: ${args}: Is a directory`); else (n.data || '(empty)').split('\n').forEach(l => add('output', l)); return; }
    if (cmd === 'mkdir') { if (!args) { add('error', 'mkdir: missing operand'); return; } vfs.createFolder(cwd, args); add('success', `Created: ${args}/`); return; }
    if (cmd === 'rm') { if (!args) { add('error', 'rm: missing operand'); return; } if (vfs.deleteNode(resolve(cwd, args))) add('success', `Removed: ${args}`); else add('error', `rm: '${args}': No such file`); return; }

    desktopBus.emit({ type: 'terminal_run', command: raw });
    add('system', `[forwarded to agent]: ${raw}`);
  }, [add, cwd, hist]);

  useImperativeHandle(ref, () => ({ runCommand: (c: string) => { setTimeout(() => exec(c), 0); } }), [exec]);

  // DesktopBus: inject agent output
  useEffect(() => {
    const unsub = desktopBus.subscribe(ev => {
      if (ev.type === 'terminal_run' && ev.command) {
        ev.command.split('\n').forEach(l => setLines(p => [...p, { id: uid(), type: 'output', text: l }]));
      }
    });
    return unsub;
  }, []);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); exec(input.trim()); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHIdx(p => { const n = Math.min(p + 1, hist.length - 1); if (hist[n] !== undefined) setInput(hist[n]); return n; }); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHIdx(p => { const n = Math.max(p - 1, -1); setInput(n === -1 ? '' : (hist[n] ?? '')); return n; }); return; }
    if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); add('error', '^C'); setInput(''); return; }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
  }, [exec, input, hist, add]);

  const [curVis, setCurVis] = useState(true);
  useEffect(() => { const iv = setInterval(() => setCurVis(v => !v), 530); return () => clearInterval(iv); }, []);

  return (
    <motion.div ref={windowRef} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }} onClick={() => inputRef.current?.focus()} onMouseDownCapture={onFocus} style={{ position: 'absolute', ...(pos ? { left: pos.x, top: pos.y, transform: 'none' } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }), width: 640, height: 380, maxWidth: 'calc(100% - 8px)', maxHeight: 'calc(100% - 8px)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: zIndex ?? 220, pointerEvents: 'auto', background: 'var(--bg-primary)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: 'none', fontFamily: 'ui-monospace,"SF Mono","Fira Mono","Cascadia Code","JetBrains Mono",monospace', userSelect: 'none' }}>
      {isDragging && <div style={{ position: 'absolute', inset: 0, zIndex: 9999, cursor: 'grabbing' }} />}
      {/* Title bar */}
      <div onMouseDown={onTitleBarMouseDown} style={{ height: 36, display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, cursor: isDragging ? 'grabbing' : 'grab', position: 'relative' }}>
        <button onClick={onClose} style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--text-ghost)', border: 'none', cursor: 'pointer', padding: 0 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,95,87,0.7)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--text-ghost)'; }} title="Close" />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: 0.2 }}>Terminal</div>
      </div>
      {/* Output */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {lines.map(l => <div key={l.id} style={{ fontSize: 12.5, lineHeight: 1.6, color: lc(l.type), whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: l.text === '' ? '0.8em' : undefined }}>{l.text}</div>)}
      </div>
      {/* Input */}
      <div style={{ height: 38, borderTop: '1px solid var(--border-subtle)', background: '#0d0d10', display: 'flex', alignItems: 'center', padding: '0 14px', flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, color: '#4ade80', whiteSpace: 'nowrap', flexShrink: 0, userSelect: 'none' }}>{PS}</span>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'inherit', caretColor: 'transparent', width: '100%' }} />
          <span style={{ position: 'absolute', left: `${input.length}ch`, top: '50%', transform: 'translateY(-50%)', width: '0.55em', height: '1.2em', background: curVis ? '#4ade80' : 'transparent', display: 'inline-block', pointerEvents: 'none' }} />
        </div>
      </div>
    </motion.div>
  );
});
