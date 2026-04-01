/**
 * ChromeWindow -- minimal dark browser window with CDP screencast.
 *
 * - Draggable via useWindowDrag (tab bar is the drag handle)
 * - Tab bar (36px), toolbar (40px), stream area (flex fill)
 * - WebSocket binary frames (type 0x01 + JPEG) with RAF governor
 * - Session reuse via localStorage + module-level mutex
 * - Human control: click/scroll/drag/keyboard forwarding
 * - Overlays: AccessibilityOverlay, ConsolePanelDrawer, drag canvas, cursor trail
 */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { desktopBus, type HumanAction } from '../utils/desktopBus';
import { AccessibilityOverlay } from './AccessibilityOverlay';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { ConsolePanelDrawer, type ConsoleMessage } from './ConsolePanelDrawer';

// ── Types ─────────────────────────────────────────────────

export interface ChromeTab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  history: string[];
  historyIndex: number;
}

interface ChromeWindowProps {
  onClose?: () => void;
  initialTabs?: Partial<ChromeTab>[];
  className?: string;
  style?: React.CSSProperties;
  zIndex?: number;
  onFocus?: () => void;
  /** External human-control state from parent (syncs with internal state) */
  externalHumanControl?: boolean;
  onHumanControlChange?: (value: boolean) => void;
}

export interface ChromeWindowHandle {
  navigateTo: (url: string) => void;
  openTab: (url?: string) => void;
  connectStream: (sessionId: string) => void;
  disconnectStream: () => void;
}

// ── Module-level mutex ────────────────────────────────────

let _sessionLock = false;

// ── Constants ─────────────────────────────────────────────

const WAYFARER_URL = import.meta.env.VITE_WAYFARER_URL || 'http://localhost:8889';
const NEW_TAB = 'chrome://newtab';
const MAX_RECONNECT = 5;
const DRAG_THRESHOLD = 8;
const spring = { type: 'spring' as const, bounce: 0, duration: 0.22 };

// ── Helpers ───────────────────────────────────────────────

function tabId() { return Math.random().toString(36).slice(2, 9); }

function cleanUrl(url: string): string {
  try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : ''); }
  catch { return url; }
}

function isBlank(url: string) { return !url || url === NEW_TAB || url === 'about:blank'; }

function makeTab(o: Partial<ChromeTab> = {}): ChromeTab {
  return { id: tabId(), title: 'New Tab', url: NEW_TAB, isActive: true, canGoBack: false, canGoForward: false, history: [NEW_TAB], historyIndex: 0, ...o };
}

function scaleXY(e: MouseEvent, el: HTMLImageElement) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(((e.clientX - r.left) / r.width) * 1280), y: Math.round(((e.clientY - r.top) / r.height) * 800) };
}

// ── Inline SVG icons ──────────────────────────────────────

function LockIcon({ locked = true }: { locked?: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={locked ? 'rgba(134,239,172,0.7)' : 'var(--text-ghost)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      {locked ? <path d="M7 11V7a5 5 0 0110 0v4" /> : <path d="M7 11V7a5 5 0 019.9-1" />}
    </svg>
  );
}

function ReloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}>
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10" /><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14" />
    </motion.svg>
  );
}

const ArrowLeft = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 5l-7 7 7 7" /></svg>;
const ArrowRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>;
const PlusIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const CloseTabIcon = () => <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;

// ── FaviconDot ────────────────────────────────────────────

function FaviconDot({ favicon, size = 13 }: { favicon?: string; size?: number }) {
  if (!favicon) return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: 'var(--glass-text-light)', flexShrink: 0 }} />;
  if (favicon.length <= 2) return <span style={{ fontSize: size - 2, lineHeight: 1, flexShrink: 0 }}>{favicon}</span>;
  return <img src={favicon} width={size} height={size} style={{ borderRadius: 2, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />;
}

// ── NavButton ─────────────────────────────────────────────

function NavButton({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', color: disabled ? 'var(--glass-text-light)' : 'var(--text-muted)', transition: 'color 0.15s, background 0.15s', flexShrink: 0 }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--glass-bg-light)'; } }}
      onMouseLeave={e => { e.currentTarget.style.color = disabled ? 'var(--glass-text-light)' : 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}>
      {children}
    </button>
  );
}

// ── TabButton ─────────────────────────────────────────────

function TabButton({ tab, onActivate, onClose }: { tab: ChromeTab; onActivate: () => void; onClose: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  const title = tab.title.length > 18 ? tab.title.slice(0, 18) + '\u2026' : tab.title;
  return (
    <motion.div layout initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={spring}
      onClick={onActivate} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ height: 34, maxWidth: 200, minWidth: 60, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 10px', borderRadius: '7px 7px 0 0', cursor: 'pointer', flexShrink: 1, overflow: 'hidden', position: 'relative',
        background: tab.isActive ? 'var(--glass-bg-light)' : hovered ? 'var(--glass-bg-light)' : 'transparent',
        borderTop: tab.isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
        borderLeft: tab.isActive ? '1px solid var(--glass-bg-light)' : '1px solid transparent',
        borderRight: tab.isActive ? '1px solid var(--glass-bg-light)' : '1px solid transparent',
        transition: 'background 0.15s',
      }}>
      {tab.isActive && <div style={{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,155,255,0.4), transparent)' }} />}
      <FaviconDot favicon={tab.favicon} />
      <span style={{ flex: 1, fontSize: 11, fontWeight: tab.isActive ? 500 : 400, color: tab.isActive ? 'var(--text-secondary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none' }}>{title}</span>
      <button onClick={onClose}
        style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hovered || tab.isActive ? 'var(--glass-bg-light)' : 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', opacity: hovered || tab.isActive ? 1 : 0, transition: 'opacity 0.15s, background 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,80,60,0.2)'; e.currentTarget.style.color = 'rgba(255,100,80,0.9)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-bg-light)'; e.currentTarget.style.color = 'var(--text-ghost)'; }}>
        <CloseTabIcon />
      </button>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export const ChromeWindow = forwardRef<ChromeWindowHandle, ChromeWindowProps>(function ChromeWindow(
  { onClose, initialTabs, className = '', style, zIndex, onFocus, externalHumanControl, onHumanControlChange },
  ref,
) {
  // ── Tab state ──
  const [tabs, setTabs] = useState<ChromeTab[]>(() => {
    if (initialTabs?.length) return initialTabs.map((t, i) => makeTab({ ...t, isActive: i === 0 }));
    return [makeTab()];
  });

  // ── URL bar state ──
  const [urlInput, setUrlInput] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const urlFocusedRef = useRef(false);

  // ── Stream state ──
  const [streamId, setStreamId] = useState<string | null>(null);
  const [streamOk, setStreamOk] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const hasFrameRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const sessionRef = useRef<string | null>(null);
  const latestFrameRef = useRef<string>('');
  const latestBinaryRef = useRef<ArrayBuffer | null>(null);
  const rafRef = useRef(false);
  const prevBlobRef = useRef('');
  const lastFrameTimeRef = useRef(0);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const pageVisibleRef = useRef(!document.hidden);
  const connCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stable refs for circular-dep avoidance ──
  const navigateToRef = useRef<(url: string) => void>(() => {});
  const connectStreamRef = useRef<(sid: string) => void>(() => {});
  const openOrReuseRef = useRef<(url: string) => Promise<void>>(() => Promise.resolve());

  // ── A11y + Console ──
  const [a11yOn, setA11yOn] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleMsgs, setConsoleMsgs] = useState<ConsoleMessage[]>([]);

  // ── Human control ──
  const [humanControlInternal, setHumanControlInternal] = useState(false);
  const humanControl = externalHumanControl ?? humanControlInternal;
  const setHumanControl = useCallback((val: boolean) => {
    setHumanControlInternal(val);
    onHumanControlChange?.(val);
  }, [onHumanControlChange]);
  const humanRef = useRef(false);
  const humanActionsRef = useRef<HumanAction[]>([]);
  humanRef.current = humanControl;

  // Sync external -> internal
  useEffect(() => {
    if (externalHumanControl !== undefined) setHumanControlInternal(externalHumanControl);
  }, [externalHumanControl]);

  // ── Focus region overlay ──
  const [focusRegion, setFocusRegion] = useState<{ x: number; y: number; w: number; h: number; phase: 'in' | 'hold' | 'out' } | null>(null);
  const focusRegionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stream focus + drag state ──
  const streamFocusedRef = useRef(false);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const trailPoints = useRef<{ x: number; y: number; t: number }[]>([]);
  const trailCursorState = useRef<string>('acting');
  const trailFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailAnimRef = useRef<number | null>(null);
  const dragCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef({ down: false, startX: 0, startY: 0, startCX: 0, startCY: 0, curCX: 0, curCY: 0, isDragging: false });

  // ── Window drag ──
  const { windowRef, pos, isDragging: isDraggingWindow, onTitleBarMouseDown: onTabBarMouseDown } = useWindowDrag({ windowWidth: 780, windowHeight: 460 });
  const containerRef = windowRef as React.RefObject<HTMLDivElement>;

  // ── Derived ──
  const activeTab = tabs.find(t => t.isActive) ?? tabs[0];
  const showBlank = isBlank(activeTab?.url ?? '');

  // ── Tab helpers ─────────────────────────────────────────

  const activateTab = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.map(t => ({ ...t, isActive: t.id === id }));
      const activated = next.find(t => t.id === id);
      if (activated && !isBlank(activated.url) && sessionRef.current) {
        fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action: 'navigate', js: activated.url }) }).catch(() => {});
      }
      return next;
    });
    setEditingUrl(false);
  }, []);

  const openTab = useCallback((url = NEW_TAB, title = 'New Tab', favicon?: string) => {
    setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), makeTab({ url, title, favicon, history: [url], historyIndex: 0 })]);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.length === 1) return [makeTab()];
      const idx = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      if (prev[idx].isActive) next[Math.max(0, idx - 1)] = { ...next[Math.max(0, idx - 1)], isActive: true };
      return next;
    });
  }, []);

  // ── Navigation ──────────────────────────────────────────

  const navigateTo = useCallback((rawUrl: string) => {
    let url = rawUrl.trim();
    if (!url) return;
    const looksUrl = /^https?:\/\//.test(url) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/.test(url) || url === NEW_TAB;
    if (!looksUrl) url = `${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(url)}`;
    else if (!/^https?:\/\//.test(url) && url !== NEW_TAB) url = 'https://' + url;

    setLoading(true);
    setIsNavigating(true);
    setEditingUrl(false);

    setTabs(prev => prev.map(t => {
      if (!t.isActive) return t;
      const h = [...t.history.slice(0, t.historyIndex + 1), url];
      return { ...t, url, title: isBlank(url) ? 'New Tab' : (cleanUrl(url) || 'Loading...'), canGoBack: h.length > 1, canGoForward: false, history: h, historyIndex: h.length - 1 };
    }));

    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = setTimeout(() => { loadTimerRef.current = null; setLoading(false); setIsNavigating(false); }, 8000);

    if (!isBlank(url)) {
      try { localStorage.setItem('chrome_last_url', url); } catch { /* quota */ }
      openOrReuseRef.current(url);
    }
  }, []);

  navigateToRef.current = navigateTo;

  const navAction = useCallback(async (action: 'back' | 'forward') => {
    if (!activeTab) return;
    const isBack = action === 'back';
    if (isBack && !activeTab.canGoBack) return;
    if (!isBack && !activeTab.canGoForward) return;
    const ni = activeTab.historyIndex + (isBack ? -1 : 1);
    const url = activeTab.history[ni];
    setTabs(prev => prev.map(t => {
      if (!t.isActive) return t;
      return { ...t, url, historyIndex: ni, canGoBack: ni > 0, canGoForward: ni < t.history.length - 1, title: isBlank(url) ? 'New Tab' : (cleanUrl(url) || 'Loading...') };
    }));
    if (sessionRef.current) {
      try {
        const res = await fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action }) });
        const d = await res.json() as { current_url?: string; title?: string };
        if (d.current_url && d.current_url !== 'about:blank') {
          setTabs(prev => prev.map(t => t.isActive ? { ...t, url: d.current_url!, title: d.title || cleanUrl(d.current_url!) } : t));
        }
      } catch { /* non-critical */ }
    }
  }, [activeTab]);

  const reload = useCallback(() => {
    if (!activeTab || isBlank(activeTab.url)) return;
    setLoading(true);
    if (sessionRef.current) {
      fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action: 'reload' }) }).catch(() => {}).finally(() => setTimeout(() => setLoading(false), 500));
    } else setTimeout(() => setLoading(false), 700);
  }, [activeTab]);

  // ── WebSocket stream ────────────────────────────────────

  const connectStream = useCallback((sid: string) => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    wsRef.current?.close();
    wsRef.current = null;
    const same = sessionRef.current === sid;
    setStreamId(sid);
    setStreamOk(false);
    if (!same || !hasFrameRef.current) { setHasFrame(false); hasFrameRef.current = false; }
    reconnectCountRef.current = 0;

    function openWs() {
      let base = WAYFARER_URL;
      if (!/^https?:\/\//.test(base)) base = 'http://' + base;
      const wsUrl = `${base.replace('http://', 'ws://').replace('https://', 'wss://')}/session/${sid}/stream`;
      let ws: WebSocket;
      try { ws = new WebSocket(wsUrl); } catch { return; }
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => { reconnectCountRef.current = 0; setStreamOk(true); };

      function applyBinary(jpeg: ArrayBuffer) {
        if (!pageVisibleRef.current) return;
        latestBinaryRef.current = jpeg;
        latestFrameRef.current = '';
        if (!rafRef.current) {
          rafRef.current = true;
          requestAnimationFrame(() => {
            rafRef.current = false;
            const pending = latestBinaryRef.current;
            latestBinaryRef.current = null;
            if (!imgRef.current || !pending) return;
            if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
            const blobUrl = URL.createObjectURL(new Blob([pending], { type: 'image/jpeg' }));
            prevBlobRef.current = blobUrl;
            imgRef.current.src = blobUrl;
            lastFrameTimeRef.current = Date.now();
          });
        }
      }

      function applyBase64(data: string) {
        if (!pageVisibleRef.current) return;
        latestFrameRef.current = data;
        latestBinaryRef.current = null;
        if (!rafRef.current) {
          rafRef.current = true;
          requestAnimationFrame(() => {
            rafRef.current = false;
            if (!latestFrameRef.current || !imgRef.current) return;
            if (prevBlobRef.current) { URL.revokeObjectURL(prevBlobRef.current); prevBlobRef.current = ''; }
            imgRef.current.src = 'data:image/jpeg;base64,' + latestFrameRef.current;
            lastFrameTimeRef.current = Date.now();
          });
        }
      }

      function markHasFrame() {
        if (!hasFrameRef.current) { hasFrameRef.current = true; setHasFrame(true); }
      }

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          const t = new Uint8Array(ev.data)[0];
          if (t === 1) { markHasFrame(); applyBinary(ev.data.slice(1)); }
          return;
        }
        if (ev.data instanceof Blob) {
          (ev.data as Blob).arrayBuffer().then(buf => {
            if (new Uint8Array(buf)[0] === 1) { markHasFrame(); applyBinary(buf.slice(1)); }
          }).catch(() => {});
          return;
        }
        try {
          const m = JSON.parse(ev.data as string) as Record<string, unknown>;
          if (m.type === 'frame' && m.data) { markHasFrame(); applyBase64(m.data as string); }
          else if (m.type === 'url' && m.url) {
            const newUrl = m.url as string;
            setIsNavigating(false);
            setTabs(prev => prev.map(t => {
              if (!t.isActive) return t;
              if (t.history[t.historyIndex] === newUrl) return t;
              const h = [...t.history.slice(0, t.historyIndex + 1), newUrl];
              return { ...t, url: newUrl, title: cleanUrl(newUrl), history: h, historyIndex: h.length - 1, canGoBack: h.length > 1, canGoForward: false };
            }));
            try { localStorage.setItem('chrome_last_url', newUrl); } catch { /* quota */ }
          }
          else if (m.type === 'title' && m.title) {
            const title = m.title as string;
            setTabs(prev => prev.map(t => t.isActive ? { ...t, title } : t));
          }
          else if (m.type === 'console') {
            const level = (m.level as ConsoleMessage['level']) ?? 'log';
            const text = (m.text as string) ?? JSON.stringify(m);
            setConsoleMsgs(prev => { const next = [...prev, { level, text, ts: Date.now() }]; return next.length > 200 ? next.slice(-200) : next; });
          }
          else if (m.type === 'loaded') {
            if (loadTimerRef.current) { clearTimeout(loadTimerRef.current); loadTimerRef.current = null; }
            setLoading(false);
            setIsNavigating(false);
          }
          else if (m.type === 'hello') { /* handshake ack */ }
          else if (m.type === 'ping') { ws.send('ping'); }
        } catch { /* parse error */ }
      };

      ws.onclose = (evt) => {
        setStreamOk(false);
        if (wsRef.current === ws) wsRef.current = null;
        const attempts = reconnectCountRef.current;
        if (sessionRef.current === sid && attempts < MAX_RECONNECT && !evt.wasClean) {
          reconnectCountRef.current += 1;
          reconnectTimerRef.current = setTimeout(async () => {
            if (sessionRef.current !== sid) return;
            try {
              const r = await fetch(`${WAYFARER_URL}/sessions`);
              const d = await r.json() as { sessions: Array<{ session_id: string; url: string; is_closed: boolean }> };
              const active = d.sessions.filter(s => !s.is_closed);
              const ours = active.find(s => s.session_id === sid);
              if (!ours && active.length > 0) {
                const adopted = active[0];
                sessionRef.current = adopted.session_id;
                const last = localStorage.getItem('chrome_last_url');
                if (last && (!adopted.url || adopted.url === 'about:blank')) navigateToRef.current(last);
                else if (adopted.url && adopted.url !== 'about:blank') {
                  setTabs(prev => prev.map(t => t.isActive ? { ...t, url: adopted.url, title: cleanUrl(adopted.url) } : t));
                }
                connectStreamRef.current(adopted.session_id);
              } else if (ours) openWs();
            } catch { openWs(); }
          }, 2000);
        }
      };

      ws.onerror = () => setStreamOk(false);
    }

    openWs();
  }, []);

  connectStreamRef.current = connectStream;

  const disconnectStream = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    reconnectCountRef.current = MAX_RECONNECT;
    wsRef.current?.close();
    wsRef.current = null;
    setStreamId(null);
    setHasFrame(false);
    hasFrameRef.current = false;
    if (prevBlobRef.current) { URL.revokeObjectURL(prevBlobRef.current); prevBlobRef.current = ''; }
    setStreamOk(false);
  }, []);

  // ── Session management ──────────────────────────────────

  const openOrReuse = useCallback(async (url: string) => {
    // Fast path: session exists
    if (sessionRef.current) {
      try { await fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action: 'navigate', js: url }) }); } catch { /* */ }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) connectStream(sessionRef.current);
      return;
    }

    if (_sessionLock) return;
    _sessionLock = true;

    try {
      setSessionLoading(true);
      const storedId = localStorage.getItem('chrome_session_id');
      if (storedId) {
        try {
          const r = await fetch(`${WAYFARER_URL}/sessions`);
          const d = await r.json() as { sessions: Array<{ session_id: string; is_closed: boolean }> };
          if (d.sessions.find(s => s.session_id === storedId && !s.is_closed)) sessionRef.current = storedId;
          else localStorage.removeItem('chrome_session_id');
        } catch { localStorage.removeItem('chrome_session_id'); }
      }

      if (sessionRef.current) {
        await fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action: 'navigate', js: url }) });
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) connectStream(sessionRef.current);
      } else {
        const r = await fetch(`${WAYFARER_URL}/session/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, viewport_width: 1280, viewport_height: 800 }) });
        const d = await r.json() as { session_id?: string };
        if (d.session_id) {
          sessionRef.current = d.session_id;
          try { localStorage.setItem('chrome_session_id', d.session_id); } catch { /* */ }
          connectStream(d.session_id);
        }
      }
    } catch (err) { console.warn('[Chrome] Session error:', err); }
    finally { setSessionLoading(false); _sessionLock = false; }
  }, [connectStream]);

  openOrReuseRef.current = openOrReuse;

  // ── Human control release ───────────────────────────────

  const releaseControl = useCallback(async () => {
    const actions = humanActionsRef.current;
    humanActionsRef.current = [];
    setHumanControl(false);

    let screenshot = '';
    if (imgRef.current) {
      try {
        const c = document.createElement('canvas'); c.width = 1280; c.height = 800;
        const ctx = c.getContext('2d');
        if (ctx) { ctx.drawImage(imgRef.current, 0, 0, 1280, 800); screenshot = c.toDataURL('image/jpeg', 0.7).replace(/^data:image\/jpeg;base64,/, ''); }
      } catch { /* tainted */ }
    }

    const lines = actions.map(a => {
      if (a.type === 'click') return `Clicked at (${a.x}, ${a.y})`;
      if (a.type === 'scroll') return `Scrolled ${(a.deltaY ?? 0) > 0 ? 'down' : 'up'} ${Math.abs(a.deltaY ?? 0)}px`;
      if (a.type === 'type') return `Typed "${a.text}"`;
      if (a.type === 'drag') return `Dragged from (${a.x}, ${a.y}) to (${a.endX}, ${a.endY})`;
      return '';
    });
    const summary = actions.length === 0 ? 'User took control but performed no actions.' : `User performed ${actions.length} action(s): ${lines.join('; ')}`;
    desktopBus.emit({ type: 'human_control_summary', actions, screenshot, summary });
  }, []);

  // ── Imperative handle ───────────────────────────────────

  useImperativeHandle(ref, () => ({
    navigateTo,
    openTab: (url?: string) => openTab(url),
    connectStream,
    disconnectStream,
  }), [navigateTo, openTab, connectStream, disconnectStream]);

  // ══════════════════════════════════════════════════════
  //  EFFECTS
  // ══════════════════════════════════════════════════════

  // Auto-open session on mount
  useEffect(() => {
    if (sessionRef.current) return;
    const last = localStorage.getItem('chrome_last_url');
    if (!last || isBlank(last)) return;
    const t = setTimeout(() => openOrReuseRef.current(last), 300);
    return () => { clearTimeout(t); _sessionLock = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emit chrome_window_bounds on position/size changes
  useEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    function emit() {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = el.offsetParent as HTMLElement | null;
      const pr = p ? p.getBoundingClientRect() : { left: 0, top: 0 };
      desktopBus.emit({ type: 'chrome_window_bounds', left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height, headerHeight: 76, streamWidth: 1280, streamHeight: 800 });
    }
    emit();
    const ro = new ResizeObserver(emit);
    ro.observe(el);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // Wheel forwarding (non-passive)
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const h = (e: WheelEvent) => {
      if (!sessionRef.current || !humanRef.current) return;
      e.preventDefault(); e.stopPropagation();
      humanActionsRef.current.push({ type: 'scroll', deltaY: Math.round(e.deltaY), timestamp: Date.now() });
      fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action: 'scroll', scroll_y: Math.round(e.deltaY) }) }).catch(() => {});
    };
    img.addEventListener('wheel', h, { passive: false });
    return () => img.removeEventListener('wheel', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFrame]);

  // Pointer events: click + drag detection
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const drawDrag = (sx: number, sy: number, ex: number, ey: number) => {
      const canvas = dragCanvasRef.current;
      if (!canvas) return;
      const rect = img.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ox = sx - rect.left, oy = sy - rect.top, cx = ex - rect.left, cy = ey - rect.top;
      ctx.save();
      ctx.strokeStyle = 'rgba(99,155,255,0.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(99,155,255,0.6)'; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
      const a = Math.atan2(cy - oy, cx - ox), hl = 10;
      ctx.fillStyle = 'rgba(99,155,255,0.88)'; ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx - hl * Math.cos(a - Math.PI / 6), cy - hl * Math.sin(a - Math.PI / 6));
      ctx.lineTo(cx - hl * Math.cos(a + Math.PI / 6), cy - hl * Math.sin(a + Math.PI / 6));
      ctx.closePath(); ctx.fill(); ctx.restore();
    };

    const clearDrag = () => { const c = dragCanvasRef.current; if (c) { const x = c.getContext('2d'); if (x) x.clearRect(0, 0, c.width, c.height); } };

    const onDown = (e: PointerEvent) => {
      if (!sessionRef.current || !humanRef.current) return;
      e.stopPropagation();
      streamFocusedRef.current = true;
      img.setPointerCapture(e.pointerId);
      const { x, y } = scaleXY(e as unknown as MouseEvent, img);
      const ds = dragState.current;
      ds.down = true; ds.startX = x; ds.startY = y;
      ds.startCX = e.clientX; ds.startCY = e.clientY;
      ds.curCX = e.clientX; ds.curCY = e.clientY; ds.isDragging = false;
    };

    const onMove = (e: PointerEvent) => {
      const ds = dragState.current;
      if (!ds.down || !sessionRef.current) return;
      ds.curCX = e.clientX; ds.curCY = e.clientY;
      if (Math.hypot(e.clientX - ds.startCX, e.clientY - ds.startCY) > DRAG_THRESHOLD) {
        ds.isDragging = true;
        drawDrag(ds.startCX, ds.startCY, e.clientX, e.clientY);
      }
    };

    const onUp = (e: PointerEvent) => {
      const ds = dragState.current;
      if (!ds.down || !sessionRef.current) return;
      ds.down = false; clearDrag();
      const { x, y } = scaleXY(e as unknown as MouseEvent, img);
      if (ds.isDragging) {
        humanActionsRef.current.push({ type: 'drag', x: ds.startX, y: ds.startY, endX: x, endY: y, timestamp: Date.now() });
        fetch(`${WAYFARER_URL}/session/${sessionRef.current}/drag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startX: ds.startX, startY: ds.startY, endX: x, endY: y }) }).catch(() => {});
      } else {
        humanActionsRef.current.push({ type: 'click', x: ds.startX, y: ds.startY, timestamp: Date.now() });
        fetch(`${WAYFARER_URL}/session/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionRef.current, action: 'click', click_x: ds.startX, click_y: ds.startY }) }).catch(() => {});
      }
      ds.isDragging = false;
    };

    const onCancel = () => { dragState.current.down = false; dragState.current.isDragging = false; clearDrag(); };

    img.addEventListener('pointerdown', onDown);
    img.addEventListener('pointermove', onMove);
    img.addEventListener('pointerup', onUp);
    img.addEventListener('pointercancel', onCancel);
    return () => { img.removeEventListener('pointerdown', onDown); img.removeEventListener('pointermove', onMove); img.removeEventListener('pointerup', onUp); img.removeEventListener('pointercancel', onCancel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFrame]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    reconnectCountRef.current = MAX_RECONNECT;
    wsRef.current?.close();
    if (connCheckRef.current) { clearInterval(connCheckRef.current); connCheckRef.current = null; }
    _sessionLock = false;
  }, []);

  // Visibility: drop frames when hidden
  useEffect(() => {
    const h = () => { pageVisibleRef.current = !document.hidden; };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  // Connection status checker
  useEffect(() => {
    if (connCheckRef.current) clearInterval(connCheckRef.current);
    if (!streamId) { setConnStatus('disconnected'); return; }
    connCheckRef.current = setInterval(() => {
      if (!streamOk) setConnStatus(reconnectCountRef.current < MAX_RECONNECT ? 'connecting' : 'disconnected');
      else if (lastFrameTimeRef.current > 0 && Date.now() - lastFrameTimeRef.current > 3000) setConnStatus('connecting');
      else setConnStatus('connected');
    }, 1000);
    return () => { if (connCheckRef.current) clearInterval(connCheckRef.current); };
  }, [streamId, streamOk]);

  useEffect(() => {
    if (!streamId) { setConnStatus('disconnected'); return; }
    setConnStatus(streamOk ? 'connected' : 'connecting');
  }, [streamOk, streamId]);

  // URL polling -- sync address bar every 2s
  const urlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (urlPollRef.current) clearInterval(urlPollRef.current);
    if (!streamId || !streamOk) return;
    urlPollRef.current = setInterval(async () => {
      if (urlFocusedRef.current || !sessionRef.current) return;
      try {
        const r = await fetch(`${WAYFARER_URL}/session/${sessionRef.current}/url`);
        const d = await r.json() as { url: string | null };
        if (!d.url || d.url === 'about:blank') return;
        setTabs(prev => {
          const a = prev.find(t => t.isActive);
          if (!a || a.url === d.url) return prev;
          setIsNavigating(false);
          try { localStorage.setItem('chrome_last_url', d.url!); } catch { /* */ }
          return prev.map(t => {
            if (!t.isActive) return t;
            if (t.history[t.historyIndex] === d.url) return t;
            const h = [...t.history.slice(0, t.historyIndex + 1), d.url!];
            return { ...t, url: d.url!, title: cleanUrl(d.url!), history: h, historyIndex: h.length - 1, canGoBack: h.length > 1, canGoForward: false };
          });
        });
      } catch { /* wayfarer not reachable */ }
    }, 2000);
    return () => { if (urlPollRef.current) clearInterval(urlPollRef.current); };
  }, [streamId, streamOk]);

  // Keyboard shortcuts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); urlRef.current?.focus(); urlRef.current?.select(); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reload(); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); openTab(); }
      else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); if (activeTab) closeTab(activeTab.id); }
    };
    el.addEventListener('keydown', h);
    return () => el.removeEventListener('keydown', h);
  }, [reload, openTab, closeTab, activeTab]);

  // Keyboard forwarding to Playwright
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: KeyboardEvent) => {
      if (!streamFocusedRef.current || !sessionRef.current || urlFocusedRef.current || !humanRef.current) return;
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      humanActionsRef.current.push({ type: 'type', text: e.key, timestamp: Date.now() });
      fetch(`${WAYFARER_URL}/session/${sessionRef.current}/shortcut`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: e.key }) }).catch(() => {});
    };
    el.addEventListener('keydown', h);
    return () => el.removeEventListener('keydown', h);
  }, []);

  // Blur stream focus
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = () => { streamFocusedRef.current = false; };
    el.addEventListener('blur', h, true);
    return () => el.removeEventListener('blur', h, true);
  }, []);

  // Cursor trail
  const drawTrail = useCallback(() => {
    const canvas = trailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    trailPoints.current.forEach((pt, i) => {
      const age = now - pt.t;
      if (age > 1500) return;
      const alpha = (1 - age / 1500) * ((i + 1) / trailPoints.current.length) * 0.8;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = trailCursorState.current === 'acting' ? `rgba(255,100,50,${alpha})` : `rgba(160,160,170,${alpha})`;
      ctx.fill();
    });
  }, []);

  // Bus subscriptions: cursor trail + focus region
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'ai_cursor_move') {
        trailCursorState.current = event.state;
        trailPoints.current.push({ x: event.x, y: event.y, t: Date.now() });
        if (trailPoints.current.length > 30) trailPoints.current.shift();
        if (trailAnimRef.current !== null) cancelAnimationFrame(trailAnimRef.current);
        trailAnimRef.current = requestAnimationFrame(drawTrail);
        if (trailFadeTimer.current) clearTimeout(trailFadeTimer.current);
        trailFadeTimer.current = setTimeout(() => {
          trailPoints.current = [];
          if (trailAnimRef.current !== null) cancelAnimationFrame(trailAnimRef.current);
          trailAnimRef.current = requestAnimationFrame(drawTrail);
        }, 1500);
      } else if (event.type === 'ai_cursor_focus_region') {
        if (focusRegionTimer.current) clearTimeout(focusRegionTimer.current);
        setFocusRegion({ x: event.x, y: event.y, w: event.w, h: event.h, phase: 'in' });
        focusRegionTimer.current = setTimeout(() => {
          setFocusRegion(prev => prev ? { ...prev, phase: 'hold' } : null);
          focusRegionTimer.current = setTimeout(() => {
            setFocusRegion(prev => prev ? { ...prev, phase: 'out' } : null);
            focusRegionTimer.current = setTimeout(() => setFocusRegion(null), 200);
          }, 300);
        }, 200);
      }
    });
    return () => { unsub(); if (trailFadeTimer.current) clearTimeout(trailFadeTimer.current); if (trailAnimRef.current !== null) cancelAnimationFrame(trailAnimRef.current); if (focusRegionTimer.current) clearTimeout(focusRegionTimer.current); };
  }, [drawTrail]);

  // ── URL bar handlers ────────────────────────────────────

  const onUrlFocus = () => { urlFocusedRef.current = true; setEditingUrl(true); setUrlInput(activeTab?.url ?? ''); setTimeout(() => urlRef.current?.select(), 50); };
  const onUrlBlur = () => { urlFocusedRef.current = false; setEditingUrl(false); };
  const onUrlSubmit = (e: React.FormEvent) => { e.preventDefault(); navigateTo(urlInput); };
  const onUrlKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { setEditingUrl(false); urlRef.current?.blur(); } };
  const displayUrl = showBlank ? '' : cleanUrl(activeTab?.url ?? '');
  const isSecure = activeTab ? activeTab.url.startsWith('https://') : false;

  // ══════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════

  return (
    <motion.div ref={windowRef} data-chrome-window tabIndex={-1}
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className} onMouseDownCapture={onFocus}
      style={{
        position: 'absolute',
        ...(pos ? { left: pos.x, top: pos.y, transform: 'none' } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
        width: '90%', height: '85%', maxWidth: 1200, maxHeight: 700,
        display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden',
        background: 'var(--bg-primary)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        zIndex: zIndex ?? 210, pointerEvents: 'auto', outline: 'none', userSelect: 'none',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
        ...style,
      }}>

      {/* ── TAB BAR (36px) ── */}
      <div onMouseDown={onTabBarMouseDown}
        style={{ height: 36, display: 'flex', alignItems: 'flex-end', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--glass-bg-light)', paddingLeft: 40, paddingRight: 8, position: 'relative', cursor: isDraggingWindow ? 'grabbing' : 'grab' }}>

        {/* Close dot */}
        <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
          <button onClick={onClose}
            style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--glass-text-light)', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,95,87,0.7)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-text-light)'; }}
            title="Close" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <AnimatePresence initial={false}>
            {tabs.map(tab => <TabButton key={tab.id} tab={tab} onActivate={() => activateTab(tab.id)} onClose={e => { e.stopPropagation(); closeTab(tab.id); }} />)}
          </AnimatePresence>
          <motion.button onClick={() => openTab()} whileHover={{ scale: 1.1, color: 'var(--text-secondary)' }} whileTap={{ scale: 0.92 }}
            style={{ width: 28, height: 28, borderRadius: 6, marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', flexShrink: 0, marginLeft: 4 }}>
            <PlusIcon />
          </motion.button>
        </div>

        {/* Control + status (right side of tab bar) */}
        {streamId && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => { if (humanControl) releaseControl(); else { humanActionsRef.current = []; setHumanControl(true); } }}
              style={{ padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 600, letterSpacing: '0.04em', lineHeight: '14px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                border: humanControl ? '1px solid rgba(251,191,36,0.35)' : '1px solid var(--border-subtle)',
                background: humanControl ? 'rgba(251,191,36,0.12)' : 'var(--glass-bg-light)',
                color: humanControl ? 'rgba(251,191,36,0.9)' : 'var(--text-muted)',
              }}
              title={humanControl ? 'Release control back to AI' : 'Take control of the browser'}>
              {humanControl ? 'Release Control' : 'Take Control'}
            </button>
            <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.06em', pointerEvents: 'none', whiteSpace: 'nowrap', color: humanControl ? 'rgba(251,191,36,0.7)' : 'rgba(99,155,255,0.6)' }}>
              {humanControl ? 'YOU' : 'AI'}
            </span>
            <div title={connStatus === 'connected' ? 'Stream connected' : connStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, pointerEvents: 'none', transition: 'background 0.4s, box-shadow 0.4s',
                background: connStatus === 'connected' ? '#28c840' : connStatus === 'connecting' ? '#febc2e' : '#ff5f57',
                boxShadow: connStatus === 'connected' ? '0 0 5px rgba(40,200,64,0.7)' : connStatus === 'connecting' ? '0 0 5px rgba(254,188,46,0.7)' : '0 0 5px rgba(255,95,87,0.7)',
              }} />
          </div>
        )}
      </div>

      {/* ── TOOLBAR (40px) ── */}
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--bg-secondary)' }}>
        {/* A11y toggle */}
        <button onClick={() => setA11yOn(v => !v)} title={a11yOn ? 'Hide accessibility overlay' : 'Show accessibility overlay'}
          style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em', transition: 'all 0.15s', flexShrink: 0,
            background: a11yOn ? 'rgba(168,85,247,0.15)' : 'none',
            border: a11yOn ? '1px solid rgba(168,85,247,0.35)' : '1px solid transparent',
            color: a11yOn ? '#a855f7' : 'var(--text-muted)',
          }}
          onMouseEnter={e => { if (!a11yOn) { e.currentTarget.style.color = 'rgba(168,85,247,0.75)'; e.currentTarget.style.background = 'rgba(168,85,247,0.08)'; } }}
          onMouseLeave={e => { if (!a11yOn) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; } }}>
          A11y
        </button>

        {/* Console toggle */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setConsoleOpen(v => !v)} title={consoleOpen ? 'Hide console' : 'Show console'}
            style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em', transition: 'all 0.15s',
              background: consoleOpen ? 'rgba(59,130,246,0.12)' : 'none',
              border: consoleOpen ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              color: consoleOpen ? '#3b82f6' : 'var(--text-muted)',
            }}
            onMouseEnter={e => { if (!consoleOpen) { e.currentTarget.style.color = 'rgba(59,130,246,0.75)'; e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; } }}
            onMouseLeave={e => { if (!consoleOpen) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; } }}>
            &gt;_
          </button>
          {consoleMsgs.some(m => m.level === 'error') && (
            <div style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px rgba(248,113,113,0.7)', pointerEvents: 'none' }} />
          )}
        </div>

        <NavButton onClick={() => navAction('back')} disabled={!activeTab?.canGoBack} title="Back"><ArrowLeft /></NavButton>
        <NavButton onClick={() => navAction('forward')} disabled={!activeTab?.canGoForward} title="Forward"><ArrowRight /></NavButton>
        <NavButton onClick={reload} disabled={!sessionRef.current} title="Reload"><ReloadIcon spinning={loading} /></NavButton>

        {/* URL Bar */}
        <form onSubmit={onUrlSubmit} style={{ flex: 1, display: 'flex' }}>
          <div onClick={onUrlFocus}
            style={{
              flex: 1, height: 32, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', position: 'relative', cursor: editingUrl ? 'text' : 'pointer', pointerEvents: 'auto', overflow: 'hidden', transition: 'all 0.15s ease',
              background: editingUrl ? 'var(--glass-bg-light)' : 'var(--glass-bg-light)',
              border: editingUrl ? '1px solid rgba(99,155,255,0.4)' : isNavigating ? '1px solid rgba(59,130,246,0.35)' : '1px solid var(--glass-bg-light)',
              boxShadow: editingUrl ? '0 0 0 3px rgba(59,130,246,0.12)' : isNavigating ? '0 0 0 2px rgba(59,130,246,0.08)' : 'none',
            }}>
            {isNavigating && !editingUrl && (
              <motion.div initial={{ x: '-100%' }} animate={{ x: '200%' }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', bottom: 0, left: 0, width: '50%', height: 2, background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), transparent)', pointerEvents: 'none', borderRadius: 99 }} />
            )}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {isNavigating && !editingUrl
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid rgba(59,130,246,0.25)', borderTopColor: 'rgba(59,130,246,0.8)' }} />
                : <LockIcon locked={isSecure} />}
            </div>
            {editingUrl ? (
              <input ref={urlRef} value={urlInput} onChange={e => setUrlInput(e.target.value)} onBlur={onUrlBlur} onKeyDown={onUrlKey} autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', caretColor: '#3b82f6', fontFamily: 'ui-monospace, monospace', pointerEvents: 'auto' }} />
            ) : (
              <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none', transition: 'color 0.2s',
                color: showBlank ? 'var(--text-ghost)' : isNavigating ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                {showBlank ? 'Search or navigate...' : displayUrl}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── STREAM AREA ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {/* Loading bar */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 0.85 }} exit={{ scaleX: 1, opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', transformOrigin: 'left', zIndex: 10 }} />
          )}
        </AnimatePresence>

        {streamId && hasFrame ? (
          <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg-primary)', overflow: 'hidden', touchAction: 'none' }}>
            <img ref={imgRef} alt="Live browser" draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: humanControl ? 'crosshair' : 'default', border: 'none', pointerEvents: humanControl ? 'auto' : 'none' }} />

            <canvas ref={trailCanvasRef} width={1280} height={800} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} />
            <canvas ref={dragCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8 }} />

            <AccessibilityOverlay sessionId={streamId} streamWidth={imgRef.current?.clientWidth ?? 780} streamHeight={imgRef.current?.clientHeight ?? 380} enabled={a11yOn} />
            <ConsolePanelDrawer messages={consoleMsgs} isOpen={consoleOpen} onToggle={() => setConsoleOpen(v => !v)} onClear={() => setConsoleMsgs([])} />

            {/* Focus region highlight */}
            {focusRegion && (
              <div style={{
                position: 'absolute',
                left: `${(focusRegion.x / 1280) * 100}%`, top: `${(focusRegion.y / 800) * 100}%`,
                width: `${(focusRegion.w / 1280) * 100}%`, height: `${(focusRegion.h / 800) * 100}%`,
                border: '1.5px solid rgba(255,140,50,0.75)', background: 'rgba(255,120,40,0.07)', borderRadius: 4, pointerEvents: 'none', zIndex: 6,
                opacity: focusRegion.phase === 'hold' ? 0.4 : 0,
                transition: focusRegion.phase === 'in' ? 'opacity 0.2s ease-in' : focusRegion.phase === 'out' ? 'opacity 0.2s ease-out' : 'none',
                boxShadow: '0 0 8px rgba(255,120,40,0.25)',
              }} />
            )}

            {/* Connection label */}
            <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '1px 5px', pointerEvents: 'none', zIndex: 7,
              color: streamOk ? 'rgba(40,200,64,0.5)' : 'var(--glass-text-light)' }}>
              {streamOk ? 'live' : 'connecting...'}
            </div>
          </div>
        ) : (streamId && !hasFrame) || sessionLoading ? (
          <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: '2px solid var(--glass-bg-light)', borderTopColor: 'var(--text-ghost)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 10, color: 'var(--text-ghost)' }}>Connecting browser...</span>
          </div>
        ) : showBlank ? (
          /* Dark placeholder with search */
          <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const q = (fd.get('q') as string || '').trim(); if (!q) return; const isUrl = /^https?:\/\//.test(q) || /^[a-z0-9-]+\.[a-z]{2,}/.test(q); navigateTo(isUrl ? (q.startsWith('http') ? q : 'https://' + q) : `${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(q)}`); }}
              style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-bg-light)', borderRadius: 99, padding: '0 16px', height: 44 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input name="q" autoFocus placeholder="Search or enter URL" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-secondary)', caretColor: '#3b82f6' }} />
              </div>
            </form>
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: '2px solid var(--glass-bg-light)', borderTopColor: 'var(--text-ghost)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 10, color: 'var(--text-ghost)' }}>Opening browser...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});
