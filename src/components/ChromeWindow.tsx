/**
 * ChromeWindow — Pixel-perfect Chrome browser window component
 *
 * Features:
 * - macOS traffic lights (red closes window, others cosmetic)
 * - Full tab bar: favicons, titles, close buttons, new tab (+)
 * - URL/address bar: glass pill, lock icon, back/forward/reload
 * - New tab page: dark, minimal, single search input
 * - Live CDP screencast stream via WebSocket
 * - Drag support via tab bar
 */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { desktopBus, type HumanAction } from '../utils/desktopBus';
import { AccessibilityOverlay } from './AccessibilityOverlay';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { ConsolePanelDrawer, type ConsoleMessage } from './ConsolePanelDrawer';

// ── Types ──────────────────────────────────────────────

export interface ChromeTab {
  id: string;
  title: string;
  url: string;
  favicon?: string; // emoji or URL
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  history: string[];
  historyIndex: number;
}

interface ChromeWindowProps {
  /** Called when the red traffic light (close) is clicked */
  onClose?: () => void;
  /** Initial tabs to open. Defaults to a single new-tab page. */
  initialTabs?: Partial<ChromeTab>[];
  /** Width/height are controlled by the window manager via className/style */
  className?: string;
  style?: React.CSSProperties;
  /** z-index override from the window manager */
  zIndex?: number;
  /** Called on any mousedown in this window (bring to front) */
  onFocus?: () => void;
}

export interface ChromeWindowHandle {
  navigateTo: (url: string) => void;
  openTab: (url?: string) => void;
  connectStream: (sessionId: string) => void;
  disconnectStream: () => void;
}

// ── Module-level lock — prevents double session creation in React 18 StrictMode ──
// Both invocations of the auto-open useEffect run synchronously before either
// can set sessionIdRef.current, so we guard with a module-level boolean.
let _sessionOpeningInProgress = false;

// ── Constants ──────────────────────────────────────────

const NEW_TAB_URL = 'chrome://newtab';

const spring = { type: 'spring' as const, bounce: 0, duration: 0.22 };

const WAYFARER_URL = import.meta.env.VITE_WAYFARER_URL || 'http://localhost:8889';

// ── Inline SVG Icons ────────────────────────────────────

function LockIcon({ locked = true }: { locked?: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
      stroke={locked ? 'rgba(134,239,172,0.7)' : 'rgba(255,255,255,0.25)'}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      {locked
        ? <path d="M7 11V7a5 5 0 0110 0v4"/>
        : <path d="M7 11V7a5 5 0 019.9-1"/>}
    </svg>
  );
}

function ReloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <motion.svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
    >
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/>
      <path d="M20.49 15a9 9 0 01-14.85 3.36L1 14"/>
    </motion.svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function CloseTabIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

// ── Utility ────────────────────────────────────────────

/**
 * Scale a MouseEvent's client coords from the img element's display size
 * to the fixed 1280×800 Playwright viewport.
 */
function scaleToViewport(e: MouseEvent, imgEl: HTMLImageElement): { x: number; y: number } {
  const rect = imgEl.getBoundingClientRect();
  return {
    x: Math.round(((e.clientX - rect.left) / rect.width) * 1280),
    y: Math.round(((e.clientY - rect.top) / rect.height) * 800),
  };
}

function makeTabId() {
  return Math.random().toString(36).slice(2, 9);
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}

function isHttps(url: string) {
  return url.startsWith('https://');
}

function isNewTab(url: string) {
  return !url || url === NEW_TAB_URL || url === 'about:blank';
}

function trimTitle(title: string, maxLen = 18): string {
  return title.length > maxLen ? title.slice(0, maxLen) + '…' : title;
}

function makeDefaultTab(overrides: Partial<ChromeTab> = {}): ChromeTab {
  return {
    id: makeTabId(),
    title: 'New Tab',
    url: NEW_TAB_URL,
    favicon: undefined,
    isActive: true,
    canGoBack: false,
    canGoForward: false,
    history: [NEW_TAB_URL],
    historyIndex: 0,
    ...overrides,
  };
}

// ── Favicon dot (color circle fallback) ──────────────

function FaviconDot({ favicon, size = 14 }: { favicon?: string; size?: number }) {
  if (!favicon) {
    return (
      <span style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)', flexShrink: 0,
      }} />
    );
  }
  if (favicon.length <= 2) {
    return <span style={{ fontSize: size - 2, lineHeight: 1, flexShrink: 0 }}>{favicon}</span>;
  }
  return (
    <img src={favicon} width={size} height={size}
      style={{ borderRadius: 2, objectFit: 'contain', flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

// ── New Tab Page — minimal dark search page ─────────────

interface NewTabPageProps {
  onNavigate: (url: string) => void;
}

function NewTabPage({ onNavigate }: NewTabPageProps) {
  const [query, setQuery] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const isUrl = /^https?:\/\//.test(q) || /^[a-z0-9-]+\.[a-z]{2,}/.test(q);
    if (isUrl) {
      onNavigate(q.startsWith('http') ? q : 'https://' + q);
    } else {
      // Route search queries through SearXNG — avoids bot detection on Google/DDG
      onNavigate(`${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0a0a0c',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <form onSubmit={handleSearch} style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 99, padding: '0 16px',
          height: 44, backdropFilter: 'blur(12px)',
        }}>
          <SearchIcon />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search or enter URL"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: 'rgba(255,255,255,0.7)',
              caretColor: '#3b82f6',
            }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.25)', padding: 0, lineHeight: 1,
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export const ChromeWindow = forwardRef<ChromeWindowHandle, ChromeWindowProps>(function ChromeWindow({
  onClose,
  initialTabs,
  className = '',
  style,
  zIndex,
  onFocus,
}, ref) {
  const [tabs, setTabs] = useState<ChromeTab[]>(() => {
    if (initialTabs && initialTabs.length > 0) {
      return initialTabs.map((t, i) => makeDefaultTab({ ...t, isActive: i === 0 }));
    }
    const lastUrl = localStorage.getItem('chrome_last_url');
    if (lastUrl) {
      return [makeDefaultTab({
        url: lastUrl,
        title: cleanUrl(lastUrl),
        history: [lastUrl],
        historyIndex: 0,
      })];
    }
    return [makeDefaultTab()];
  });

  const [urlInputValue, setUrlInputValue] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  // Track whether the URL input is focused — suppresses address bar sync while typing
  const urlFocusedRef = useRef(false);

  // Live browser stream via CDP WebSocket
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const streamImgRef = useRef<HTMLImageElement>(null);
  // Frame governor — avoids per-frame React state updates
  const latestFrameRef = useRef<string>('');
  const latestBinaryFrameRef = useRef<ArrayBuffer | null>(null);
  const rafPendingRef = useRef(false);
  const prevBlobUrlRef = useRef<string>('');
  // Cancellable fallback timer for page load (cleared when `loaded` WS message arrives)
  const loadFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stream has received at least one frame (controls which branch renders)
  const [streamHasFrame, setStreamHasFrame] = useState(false);
  const streamHasFrameRef = useRef(false);
  // Focus tracking for keyboard forwarding
  const streamFocusedRef = useRef(false);
  // Visibility flag — drop frames when page is hidden
  const pageVisibleRef = useRef(!document.hidden);
  // Stable ref to navigateTo — avoids circular dep between connectStream and navigateTo
  const navigateToRef = useRef<(url: string) => void>(() => {});
  // Stable ref to connectStream — used in reconnect handler to re-connect with a new session ID
  const connectStreamRef = useRef<(sessionId: string) => void>(() => {});
  // Reconnect state
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // ── Cursor trail canvas ──
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const trailPoints = useRef<{ x: number; y: number; t: number }[]>([]);
  const trailCursorState = useRef<string>('acting');
  const trailFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailAnimFrame = useRef<number | null>(null);

  // ── Drag indicator canvas + gesture state ──
  const dragCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragStateRef = useRef<{
    down: boolean;
    startX: number;       // viewport coords (1280x800 space)
    startY: number;
    startClientX: number; // screen coords for threshold check
    startClientY: number;
    currentClientX: number;
    currentClientY: number;
    isDragging: boolean;  // true once movement exceeds DRAG_THRESHOLD
  }>({
    down: false, startX: 0, startY: 0,
    startClientX: 0, startClientY: 0,
    currentClientX: 0, currentClientY: 0, isDragging: false,
  });

  // ── Focus region highlight state ──
  const [focusRegion, setFocusRegion] = useState<{ x: number; y: number; w: number; h: number; phase: 'in' | 'hold' | 'out' } | null>(null);
  const focusRegionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Connection status: 'connected' | 'connecting' | 'disconnected' ──
  const [connStatus, setConnStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // ── A11y overlay + Console panel ──
  const [a11yEnabled, setA11yEnabled] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // ── Human "Take Control" mode ──
  const [humanControl, setHumanControl] = useState(false);
  const humanControlRef = useRef(false);
  const humanActionsRef = useRef<HumanAction[]>([]);

  const releaseControl = useCallback(async () => {
    const actions = humanActionsRef.current;
    humanActionsRef.current = [];
    setHumanControl(false);

    // Take a screenshot from the current stream frame
    let screenshot = '';
    if (streamImgRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(streamImgRef.current, 0, 0, 1280, 800);
          screenshot = canvas.toDataURL('image/jpeg', 0.7).replace(/^data:image\/jpeg;base64,/, '');
        }
      } catch {
        // CORS or tainted canvas -- skip screenshot
      }
    }

    // Compile action summary
    const lines: string[] = [];
    for (const a of actions) {
      switch (a.type) {
        case 'click':
          lines.push(`Clicked at (${a.x}, ${a.y})`);
          break;
        case 'scroll':
          lines.push(`Scrolled ${(a.deltaY ?? 0) > 0 ? 'down' : 'up'} ${Math.abs(a.deltaY ?? 0)}px`);
          break;
        case 'type':
          lines.push(`Typed "${a.text}"`);
          break;
        case 'drag':
          lines.push(`Dragged from (${a.x}, ${a.y}) to (${a.endX}, ${a.endY})`);
          break;
      }
    }
    const summary = actions.length === 0
      ? 'User took control but performed no actions.'
      : `User performed ${actions.length} action(s): ${lines.join('; ')}`;

    desktopBus.emit({ type: 'human_control_summary', actions, screenshot, summary });
  }, []);

  // Keep ref in sync for event handlers that can't re-subscribe on state change
  humanControlRef.current = humanControl;
  const connCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Window drag ──
  const {
    windowRef,
    pos,
    isDragging: isDraggingWindow,
    onTitleBarMouseDown: onTabBarMouseDown,
  } = useWindowDrag({ windowWidth: 780, windowHeight: 460 });

  // ── Emit chrome_window_bounds when window position/size changes ──
  useEffect(() => {
    const el = windowRef.current;
    if (!el) return;

    function emitBounds() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Offset rect by parent (desktop area) scroll/position
      const parent = el.offsetParent as HTMLElement | null;
      const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
      desktopBus.emit({
        type: 'chrome_window_bounds',
        left:         rect.left - parentRect.left,
        top:          rect.top  - parentRect.top,
        width:        rect.width,
        height:       rect.height,
        headerHeight: 80,  // tab bar (36px) + toolbar (44px)
        streamWidth:  1280,
        streamHeight: 800,
      });
    }

    emitBounds();

    const ro = new ResizeObserver(emitBounds);
    ro.observe(el);
    return () => ro.disconnect();
  // Re-run when pos changes (window dragged)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // ── Derived ──
  const activeTab = tabs.find(t => t.isActive) ?? tabs[0];
  const showNewTabPage = isNewTab(activeTab?.url ?? '');

  // ── Tab management ──

  const activateTab = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.map(t => ({ ...t, isActive: t.id === id }));
      // Navigate backend session to the newly active tab's URL
      const activated = next.find(t => t.id === id);
      if (activated && !isNewTab(activated.url) && sessionIdRef.current) {
        fetch(`${WAYFARER_URL}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            action: 'navigate',
            js: activated.url,
          }),
        }).catch(() => {});
      }
      return next;
    });
    setIsEditingUrl(false);
  }, []);

  const openTab = useCallback((url = NEW_TAB_URL, title = 'New Tab', favicon?: string) => {
    const tab = makeDefaultTab({ url, title, favicon, history: [url], historyIndex: 0 });
    setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), tab]);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      // Closing last tab resets to a fresh new-tab page
      if (prev.length === 1) return [makeDefaultTab()];
      const idx = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      if (prev[idx].isActive) {
        const newActive = Math.max(0, idx - 1);
        next[newActive] = { ...next[newActive], isActive: true };
      }
      return next;
    });
  }, []);

  const updateActiveTab = useCallback((patch: Partial<ChromeTab>) => {
    setTabs(prev => prev.map(t => t.isActive ? { ...t, ...patch } : t));
  }, []);

  // ── Navigation ──

  // Ref so navigateTo can call openOrReuseSession before it's defined (avoids circular dep)
  const openOrReuseSessionRef = useRef<(url: string) => Promise<void>>(() => Promise.resolve());

  const navigateTo = useCallback((rawUrl: string) => {
    let url = rawUrl.trim();
    if (!url) return;

    const isUrl = /^https?:\/\//.test(url) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/.test(url) || url === NEW_TAB_URL;
    if (!isUrl) {
      // Route search queries through SearXNG — avoids bot detection on Google/DDG
      url = `${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(url)}`;
    } else if (!/^https?:\/\//.test(url) && url !== NEW_TAB_URL) {
      url = 'https://' + url;
    }

    setLoading(true);
    setIsNavigating(true);
    setIsEditingUrl(false);

    setTabs(prev => prev.map(t => {
      if (!t.isActive) return t;
      const newHistory = [...t.history.slice(0, t.historyIndex + 1), url];
      return {
        ...t, url,
        title: isNewTab(url) ? 'New Tab' : (cleanUrl(url) || 'Loading...'),
        canGoBack: newHistory.length > 1,
        canGoForward: false,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }));

    // Safety fallback: if no `loaded` WebSocket message arrives within 8s, clear loading state
    if (loadFallbackTimerRef.current) clearTimeout(loadFallbackTimerRef.current);
    loadFallbackTimerRef.current = setTimeout(() => {
      loadFallbackTimerRef.current = null;
      setLoading(false);
      setIsNavigating(false);
    }, 8000);

    // Persist last URL
    if (url !== NEW_TAB_URL && url !== 'about:blank') {
      try {
        localStorage.setItem('chrome_last_url', url);
      } catch {
        // localStorage quota exceeded, ignore
      }
    }

    // Open real Playwright session for live browsing
    if (url !== NEW_TAB_URL && url !== 'about:blank') {
      openOrReuseSessionRef.current(url);
    }
  }, []);

  // Keep ref in sync so connectStream can call navigateTo without circular deps
  navigateToRef.current = navigateTo;

  const goBack = useCallback(async () => {
    if (!activeTab?.canGoBack) return;
    const newIndex = activeTab.historyIndex - 1;
    const url = activeTab.history[newIndex];

    // Update local state optimistically
    setTabs(prev => prev.map(t => {
      if (!t.isActive) return t;
      return { ...t, url, historyIndex: newIndex, canGoBack: newIndex > 0, canGoForward: true, title: isNewTab(url) ? 'New Tab' : (cleanUrl(url) || 'Loading...') };
    }));

    // Also navigate backend if live session exists
    if (sessionIdRef.current) {
      const WAYFARER = WAYFARER_URL;
      try {
        const res = await fetch(`${WAYFARER}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdRef.current, action: 'back' }),
        });
        const data = await res.json() as { current_url?: string; title?: string };
        if (data.current_url && data.current_url !== 'about:blank') {
          setTabs(prev => prev.map(t => t.isActive ? { ...t, url: data.current_url!, title: data.title || cleanUrl(data.current_url!) || 'Loading...' } : t));
        }
      } catch { /* non-critical */ }
    }
  }, [activeTab]);

  const goForward = useCallback(async () => {
    if (!activeTab?.canGoForward) return;
    const newIndex = activeTab.historyIndex + 1;
    const url = activeTab.history[newIndex];

    // Update local state optimistically
    setTabs(prev => prev.map(t => {
      if (!t.isActive) return t;
      return { ...t, url, historyIndex: newIndex, canGoBack: true, canGoForward: newIndex < t.history.length - 1, title: isNewTab(url) ? 'New Tab' : (cleanUrl(url) || 'Loading...') };
    }));

    // Also navigate backend if live session exists
    if (sessionIdRef.current) {
      const WAYFARER = WAYFARER_URL;
      try {
        const res = await fetch(`${WAYFARER}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdRef.current, action: 'forward' }),
        });
        const data = await res.json() as { current_url?: string; title?: string };
        if (data.current_url && data.current_url !== 'about:blank') {
          setTabs(prev => prev.map(t => t.isActive ? { ...t, url: data.current_url!, title: data.title || cleanUrl(data.current_url!) || 'Loading...' } : t));
        }
      } catch { /* non-critical */ }
    }
  }, [activeTab]);

  const reload = useCallback(() => {
    if (!activeTab || isNewTab(activeTab.url)) return;
    setLoading(true);
    if (sessionIdRef.current) {
      fetch(`${WAYFARER_URL}/session/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionIdRef.current, action: 'reload' }),
      }).catch(() => {}).finally(() => setTimeout(() => setLoading(false), 500));
    } else {
      setTimeout(() => setLoading(false), 700);
    }
  }, [activeTab]);

  // ── Live stream ──

  const connectStream = useCallback((sessionId: string) => {
    // Cancel any pending reconnect
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // If reconnecting to the same session that already had frames, keep the
    // last frame visible to avoid a flash of loading state between navigations.
    // Note: we compare with sessionIdRef (not state) because this callback has [] deps.
    const isSameSession = sessionIdRef.current === sessionId;
    setStreamSessionId(sessionId);
    setStreamConnected(false);
    if (!isSameSession || !streamHasFrameRef.current) {
      setStreamHasFrame(false);
      streamHasFrameRef.current = false;
    }
    reconnectAttemptsRef.current = 0;

    function openWs() {
      let base = WAYFARER_URL;
      // Ensure the URL has a protocol before converting to WebSocket URL
      if (!/^https?:\/\//.test(base)) base = 'http://' + base;
      const wsUrl = `${base.replace('http://', 'ws://').replace('https://', 'wss://')}/session/${sessionId}/stream`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.warn('[Chrome] Invalid WebSocket URL:', wsUrl, err);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setStreamConnected(true);
      };

      ws.binaryType = 'arraybuffer';

      function applyFrame(frameData: string) {
        if (!pageVisibleRef.current) return;
        latestFrameRef.current = frameData;
        // Clear any pending binary frame — base64 takes priority
        latestBinaryFrameRef.current = null;
        if (!rafPendingRef.current) {
          rafPendingRef.current = true;
          requestAnimationFrame(() => {
            rafPendingRef.current = false;
            if (!latestFrameRef.current) return;
            if (streamImgRef.current) {
              // Revoke any previous blob URL from binary path
              if (prevBlobUrlRef.current) { URL.revokeObjectURL(prevBlobUrlRef.current); prevBlobUrlRef.current = ''; }
              streamImgRef.current.src = 'data:image/jpeg;base64,' + latestFrameRef.current;
            }
            lastFrameTimeRef.current = Date.now();
          });
        }
      }

      function applyFrameBinary(jpeg: ArrayBuffer) {
        if (!pageVisibleRef.current) return;
        // Always buffer the latest binary frame so it's never dropped
        latestBinaryFrameRef.current = jpeg;
        // Clear any pending base64 frame — binary takes priority
        latestFrameRef.current = '';
        if (!rafPendingRef.current) {
          rafPendingRef.current = true;
          requestAnimationFrame(() => {
            rafPendingRef.current = false;
            const pendingJpeg = latestBinaryFrameRef.current;
            latestBinaryFrameRef.current = null;
            if (!streamImgRef.current || !pendingJpeg) return;
            // Revoke previous blob URL to avoid memory leak
            if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
            const blobUrl = URL.createObjectURL(new Blob([pendingJpeg], { type: 'image/jpeg' }));
            prevBlobUrlRef.current = blobUrl;
            streamImgRef.current.src = blobUrl;
            lastFrameTimeRef.current = Date.now();
          });
        }
      }

      ws.onmessage = (event) => {
        // Binary frame: 1-byte type prefix + raw JPEG
        if (event.data instanceof ArrayBuffer) {
          const buf = event.data as ArrayBuffer;
          const type = new Uint8Array(buf)[0];
          if (type === 1) {
            if (!streamHasFrameRef.current) { streamHasFrameRef.current = true; setStreamHasFrame(true); }
            applyFrameBinary(buf.slice(1));
          }
          return;
        }
        if (event.data instanceof Blob) {
          (event.data as Blob).arrayBuffer().then(buf => {
            const type = new Uint8Array(buf)[0];
            if (type === 1) {
              if (!streamHasFrameRef.current) { streamHasFrameRef.current = true; setStreamHasFrame(true); }
              applyFrameBinary(buf.slice(1));
            }
          }).catch(() => {});
          return;
        }
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data?: string; url?: string; message?: string };
          if (msg.type === 'frame' && msg.data) {
            if (!streamHasFrameRef.current) { streamHasFrameRef.current = true; setStreamHasFrame(true); }
            applyFrame(msg.data);
          } else if (msg.type === 'url' && msg.url) {
            // Update the address bar without re-triggering Playwright navigation.
            // navigateTo would open a new session action; we only want the UI to sync.
            const newUrl = msg.url;
            setIsNavigating(false);
            setTabs(prev => prev.map(t => {
              if (!t.isActive) return t;
              const alreadyCurrent = t.history[t.historyIndex] === newUrl;
              if (alreadyCurrent) return t;
              const newHistory = [...t.history.slice(0, t.historyIndex + 1), newUrl];
              return {
                ...t, url: newUrl,
                title: cleanUrl(newUrl) || 'Loading...',
                history: newHistory,
                historyIndex: newHistory.length - 1,
                canGoBack: newHistory.length > 1,
                canGoForward: false,
              };
            }));
            // Persist last URL from navigation events too
            try { localStorage.setItem('chrome_last_url', newUrl); } catch { /* quota */ }
          } else if (msg.type === 'console') {
            const level = (msg as unknown as { level?: string }).level as ConsoleMessage['level'] | undefined;
            const text = (msg as unknown as { text?: string }).text ?? JSON.stringify(msg);
            setConsoleMessages(prev => {
              const entry: ConsoleMessage = { level: level ?? 'log', text, ts: Date.now() };
              const next = [...prev, entry];
              return next.length > 200 ? next.slice(next.length - 200) : next;
            });
          } else if (msg.type === 'loaded') {
            // Page has fully loaded — clear loading state and cancel fallback timer
            if (loadFallbackTimerRef.current) {
              clearTimeout(loadFallbackTimerRef.current);
              loadFallbackTimerRef.current = null;
            }
            setLoading(false);
            setIsNavigating(false);
          } else if (msg.type === 'ping') {
            ws.send('ping');
          } else if (msg.type === 'error') {
            console.warn('[Chrome] Stream error:', msg.message);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = (evt) => {
        setStreamConnected(false);
        if (wsRef.current === ws) wsRef.current = null;

        // Fix 5 + 6: Auto-reconnect after 2s, up to MAX_RECONNECT_ATTEMPTS.
        // After reconnect, verify the session ID is still valid; if the session
        // was replaced on the server, find the new one and update our ref.
        const attempts = reconnectAttemptsRef.current;
        const sessionStillActive = sessionIdRef.current === sessionId;
        if (sessionStillActive && attempts < MAX_RECONNECT_ATTEMPTS && !evt.wasClean) {
          reconnectAttemptsRef.current += 1;
          console.info(`[Chrome] WebSocket closed (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS}), reconnecting in 2s...`);
          reconnectTimerRef.current = setTimeout(async () => {
            if (sessionIdRef.current !== sessionId) return; // already changed externally
            const WAYFARER = WAYFARER_URL;
            try {
              // Fix 5: Check if our session still exists; if not, find the active one.
              const sessRes = await fetch(`${WAYFARER}/sessions`);
              const sessData = await sessRes.json() as { sessions: Array<{ session_id: string; url: string; is_closed: boolean }> };
              const activeSessions = sessData.sessions.filter(s => !s.is_closed);
              const ourSession = activeSessions.find(s => s.session_id === sessionId);
              if (!ourSession && activeSessions.length > 0) {
                // Session replaced — adopt the first active session
                const adoptedSession = activeSessions[0];
                sessionIdRef.current = adoptedSession.session_id;
                // Restore last URL if session is fresh (about:blank / newtab)
                const lastUrl = localStorage.getItem('chrome_last_url');
                if (lastUrl && (!adoptedSession.url || adoptedSession.url === 'about:blank')) {
                  navigateToRef.current(lastUrl);
                } else if (adoptedSession.url && adoptedSession.url !== 'about:blank') {
                  // Sync address bar to adopted session's URL
                  setTabs(prev => prev.map(t => t.isActive ? { ...t, url: adoptedSession.url, title: cleanUrl(adoptedSession.url) || 'Loading...' } : t));
                }
                // Reconnect WebSocket using new session ID via stable ref
                connectStreamRef.current(adoptedSession.session_id);
              } else if (ourSession) {
                openWs();
              }
              // If no active sessions at all, stop reconnecting
            } catch {
              openWs(); // network error — still try to reconnect
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        setStreamConnected(false);
      };
    }

    openWs();
  }, []);

  // Keep connectStreamRef in sync so reconnect handler can call it with a new session ID
  connectStreamRef.current = connectStream;

  const disconnectStream = useCallback(() => {
    // Cancel any pending reconnect before closing
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // prevent reconnect after intentional disconnect
    wsRef.current?.close();
    wsRef.current = null;
    setStreamSessionId(null);
    setStreamHasFrame(false);
    streamHasFrameRef.current = false;
    if (prevBlobUrlRef.current) { URL.revokeObjectURL(prevBlobUrlRef.current); prevBlobUrlRef.current = ''; }
    setStreamConnected(false);
  }, []);

  const openOrReuseSession = useCallback(async (url: string) => {
    const WAYFARER = WAYFARER_URL;

    // ── Fast path: session already exists — just navigate ──
    if (sessionIdRef.current) {
      try {
        await fetch(`${WAYFARER}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            action: 'navigate',
            js: url,
          }),
        });
      } catch (err) {
        console.warn('[Chrome] Navigate error:', err);
      }
      // Reconnect WebSocket if not already connected (e.g. window was closed and reopened)
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectStream(sessionIdRef.current);
      }
      return;
    }

    // ── Slow path: no session yet — guard against double-invocation (React 18 StrictMode) ──
    if (_sessionOpeningInProgress) return;
    _sessionOpeningInProgress = true;

    try {
      setSessionLoading(true);

      // Check for a stored session ID and verify it's still alive
      const storedId = localStorage.getItem('chrome_session_id');
      if (storedId) {
        try {
          const sessRes = await fetch(`${WAYFARER}/sessions`);
          const sessData = await sessRes.json() as { sessions: Array<{ session_id: string; is_closed: boolean }> };
          const alive = sessData.sessions.find(s => s.session_id === storedId && !s.is_closed);
          if (alive) {
            sessionIdRef.current = storedId;
          } else {
            localStorage.removeItem('chrome_session_id');
          }
        } catch {
          localStorage.removeItem('chrome_session_id');
        }
      }

      if (sessionIdRef.current) {
        // Reuse recovered session — navigate and connect stream
        await fetch(`${WAYFARER}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            action: 'navigate',
            js: url,
          }),
        });
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectStream(sessionIdRef.current);
        }
      } else {
        // Open new session
        const res = await fetch(`${WAYFARER}/session/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, viewport_width: 1280, viewport_height: 800 }),
        });
        const data = await res.json() as { session_id?: string; error?: string };
        if (data.session_id) {
          sessionIdRef.current = data.session_id;
          try { localStorage.setItem('chrome_session_id', data.session_id); } catch { /* quota */ }
          connectStream(data.session_id);
        }
      }
    } catch (err) {
      console.warn('[Chrome] Session error:', err);
    } finally {
      setSessionLoading(false);
      _sessionOpeningInProgress = false;
    }
  }, [connectStream]);

  // Keep ref in sync so navigateTo can call openOrReuseSession without forward-reference issues
  openOrReuseSessionRef.current = openOrReuseSession;

  // ── Auto-open session on mount ──
  // Problem 3: only auto-open if we have a real last URL — don't waste a session on about:blank.
  // Problem 1: cleanup resets the module-level lock but does NOT close the session (keep it alive).
  useEffect(() => {
    if (sessionIdRef.current) return;
    const lastUrl = localStorage.getItem('chrome_last_url');
    if (!lastUrl || isNewTab(lastUrl) || lastUrl === 'about:blank') {
      // No real last URL — stay in "not yet opened" state; session opens on first real navigation
      return;
    }
    const timer = setTimeout(() => {
      openOrReuseSessionRef.current(lastUrl);
    }, 300);
    return () => {
      clearTimeout(timer);
      // Release the lock if the component unmounts before the timer fires.
      // Do NOT close the session — keep it alive for reuse on remount.
      _sessionOpeningInProgress = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Non-passive wheel listener on live stream img — React's onWheel is passive and cannot preventDefault
  useEffect(() => {
    const img = streamImgRef.current;
    if (!img) return;
    const handler = (e: WheelEvent) => {
      if (!sessionIdRef.current) return;
      if (!humanControlRef.current) return; // AI controlled — block user scroll
      e.preventDefault();
      e.stopPropagation();
      // Record human action
      humanActionsRef.current.push({ type: 'scroll', deltaY: Math.round(e.deltaY), timestamp: Date.now() });
      const WAYFARER = WAYFARER_URL;
      fetch(`${WAYFARER}/session/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionIdRef.current, action: 'scroll', scroll_y: Math.round(e.deltaY) }),
      }).catch(() => {});
    };
    img.addEventListener('wheel', handler, { passive: false });
    return () => img.removeEventListener('wheel', handler);
  // streamHasFrame: re-run once when img first appears, not on every frame update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamHasFrame]);

  // Drag forwarding: pointer-based drag detection on live stream img.
  // Distinguishes clicks (no movement) from drags (movement > 8px).
  // Drags call the dedicated /session/{id}/drag endpoint (_human_drag on server).
  // During drag, a canvas overlay shows a dashed line + arrowhead from start to current pos.
  const DRAG_THRESHOLD = 8; // screen pixels before switching to drag mode

  useEffect(() => {
    const img = streamImgRef.current;
    if (!img) return;

    const WAYFARER = WAYFARER_URL;

    const drawDragIndicator = (
      startClientX: number, startClientY: number,
      currentClientX: number, currentClientY: number,
    ) => {
      const canvas = dragCanvasRef.current;
      if (!canvas) return;
      const rect = img.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sx = startClientX - rect.left;
      const sy = startClientY - rect.top;
      const ex = currentClientX - rect.left;
      const ey = currentClientY - rect.top;

      // Dashed line
      ctx.save();
      ctx.strokeStyle = 'rgba(99, 155, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Start circle
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(99, 155, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Arrowhead at end
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 10;
      ctx.fillStyle = 'rgba(99, 155, 255, 0.88)';
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const clearDragIndicator = () => {
      const canvas = dragCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!sessionIdRef.current) return;
      if (!humanControlRef.current) return; // AI controlled — block user pointer
      // Stop window-drag from picking this up
      e.stopPropagation();
      streamFocusedRef.current = true;
      img.setPointerCapture(e.pointerId);
      const { x, y } = scaleToViewport(e as unknown as MouseEvent, img);
      const ds = dragStateRef.current;
      ds.down = true;
      ds.startX = x;
      ds.startY = y;
      ds.startClientX = e.clientX;
      ds.startClientY = e.clientY;
      ds.currentClientX = e.clientX;
      ds.currentClientY = e.clientY;
      ds.isDragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds.down || !sessionIdRef.current) return;
      const dx = e.clientX - ds.startClientX;
      const dy = e.clientY - ds.startClientY;
      ds.currentClientX = e.clientX;
      ds.currentClientY = e.clientY;

      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        ds.isDragging = true;
        drawDragIndicator(ds.startClientX, ds.startClientY, e.clientX, e.clientY);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds.down || !sessionIdRef.current) return;
      ds.down = false;
      clearDragIndicator();

      const { x, y } = scaleToViewport(e as unknown as MouseEvent, img);

      if (ds.isDragging) {
        // Record human drag action
        humanActionsRef.current.push({ type: 'drag', x: ds.startX, y: ds.startY, endX: x, endY: y, timestamp: Date.now() });
        // Real drag — call dedicated drag endpoint for atomic human-like drag
        const sid = sessionIdRef.current;
        fetch(`${WAYFARER}/session/${sid}/drag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startX: ds.startX, startY: ds.startY, endX: x, endY: y }),
        }).catch(() => {});
      } else {
        // Record human click action
        humanActionsRef.current.push({ type: 'click', x: ds.startX, y: ds.startY, timestamp: Date.now() });
        // No meaningful movement — treat as a click
        fetch(`${WAYFARER}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdRef.current, action: 'click', click_x: ds.startX, click_y: ds.startY }),
        }).catch(() => {});
      }

      ds.isDragging = false;
    };

    const onPointerCancel = (_e: PointerEvent) => {
      const ds = dragStateRef.current;
      ds.down = false;
      ds.isDragging = false;
      clearDragIndicator();
    };

    img.addEventListener('pointerdown', onPointerDown);
    img.addEventListener('pointermove', onPointerMove);
    img.addEventListener('pointerup', onPointerUp);
    // pointercancel: release drag state without firing action
    img.addEventListener('pointercancel', onPointerCancel);

    return () => {
      img.removeEventListener('pointerdown', onPointerDown);
      img.removeEventListener('pointermove', onPointerMove);
      img.removeEventListener('pointerup', onPointerUp);
      img.removeEventListener('pointercancel', onPointerCancel);
    };
  // streamHasFrame: re-run once when img first appears, not on every frame
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamHasFrame]);

  // Cleanup WebSocket on unmount
  // Problem 1: do NOT close the Wayfarer session — keep it alive for reuse when the window
  // is reopened. The session will expire naturally via the server's idle timeout (5 min).
  useEffect(() => {
    return () => {
      // Cancel any pending reconnect
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // prevent reconnect after unmount
      wsRef.current?.close();
      // Clear connection status interval
      if (connCheckIntervalRef.current) {
        clearInterval(connCheckIntervalRef.current);
        connCheckIntervalRef.current = null;
      }
      // Release module-level lock so a future mount can open a new session
      _sessionOpeningInProgress = false;
      // NOTE: intentionally NOT calling /session/close — session stays alive for reuse
    };
  }, []);

  // ── Cursor trail drawing ──

  const drawTrail = useCallback(() => {
    const canvas = trailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    const pts = trailPoints.current;
    pts.forEach((pt, i) => {
      const age = now - pt.t;
      if (age > 1500) return;
      const ageFade = 1 - age / 1500;
      const idxFade = (i + 1) / pts.length;
      const alpha = ageFade * idxFade * 0.8;
      const isActing = trailCursorState.current === 'acting';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = isActing
        ? `rgba(255, 100, 50, ${alpha})`
        : `rgba(160, 160, 170, ${alpha})`;
      ctx.fill();
    });
  }, []);

  // ── desktopBus subscriptions: cursor trail, focus region ──
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'ai_cursor_move') {
        trailCursorState.current = event.cursorState;
        trailPoints.current.push({ x: event.x, y: event.y, t: Date.now() });
        if (trailPoints.current.length > 30) trailPoints.current.shift();
        if (trailAnimFrame.current !== null) cancelAnimationFrame(trailAnimFrame.current);
        trailAnimFrame.current = requestAnimationFrame(drawTrail);
        if (trailFadeTimer.current) clearTimeout(trailFadeTimer.current);
        trailFadeTimer.current = setTimeout(() => {
          trailPoints.current = [];
          if (trailAnimFrame.current !== null) cancelAnimationFrame(trailAnimFrame.current);
          trailAnimFrame.current = requestAnimationFrame(drawTrail);
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
    return () => {
      unsub();
      if (trailFadeTimer.current) clearTimeout(trailFadeTimer.current);
      if (trailAnimFrame.current !== null) cancelAnimationFrame(trailAnimFrame.current);
      if (focusRegionTimer.current) clearTimeout(focusRegionTimer.current);
    };
  }, [drawTrail]);

  // ── Connection status checker ──
  useEffect(() => {
    if (connCheckIntervalRef.current) clearInterval(connCheckIntervalRef.current);
    if (!streamSessionId) {
      setConnStatus('disconnected');
      return;
    }
    connCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (!streamConnected) {
        setConnStatus(reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS ? 'connecting' : 'disconnected');
      } else if (lastFrameTimeRef.current > 0 && now - lastFrameTimeRef.current > 3000) {
        setConnStatus('connecting');
      } else {
        setConnStatus('connected');
      }
    }, 1000);
    return () => { if (connCheckIntervalRef.current) clearInterval(connCheckIntervalRef.current); };
  }, [streamSessionId, streamConnected]);

  // Update connStatus immediately on streamConnected change
  useEffect(() => {
    if (!streamSessionId) { setConnStatus('disconnected'); return; }
    setConnStatus(streamConnected ? 'connected' : 'connecting');
  }, [streamConnected, streamSessionId]);

  // ── URL polling — sync address bar with actual page URL every 2s ──
  // Catches back/forward navigation, link clicks, and redirects that the
  // WebSocket url message may miss. Skipped while user is typing in the address bar.
  const urlPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (urlPollIntervalRef.current) clearInterval(urlPollIntervalRef.current);
    if (!streamSessionId || !streamConnected) return;

    const WAYFARER = WAYFARER_URL;

    urlPollIntervalRef.current = setInterval(async () => {
      // Skip while user is typing in the address bar
      if (urlFocusedRef.current) return;
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const res = await fetch(`${WAYFARER}/session/${sid}/url`);
        const data = await res.json() as { url: string | null; error: string | null };
        if (!data.url || data.url === 'about:blank') return;
        // Update address bar and tab state if URL changed
        setTabs(prev => {
          const active = prev.find(t => t.isActive);
          if (!active || active.url === data.url) return prev;
          // Navigation confirmed — clear isNavigating
          setIsNavigating(false);
          // Persist to localStorage
          try { localStorage.setItem('chrome_last_url', data.url!); } catch { /* quota */ }
          return prev.map(t => {
            if (!t.isActive) return t;
            const alreadyCurrent = t.history[t.historyIndex] === data.url;
            if (alreadyCurrent) return t;
            const newHistory = [...t.history.slice(0, t.historyIndex + 1), data.url!];
            return {
              ...t, url: data.url!,
              title: cleanUrl(data.url!) || 'Loading...',
              history: newHistory,
              historyIndex: newHistory.length - 1,
              canGoBack: newHistory.length > 1,
              canGoForward: false,
            };
          });
        });
      } catch {
        // Wayfarer not reachable — ignore
      }
    }, 2000);

    return () => { if (urlPollIntervalRef.current) clearInterval(urlPollIntervalRef.current); };
  }, [streamSessionId, streamConnected]);

  // ── Visibility change: drop frames when tab is hidden ──
  useEffect(() => {
    const onVisibilityChange = () => {
      pageVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // ── Global keyboard shortcuts (container must be focusable via tabIndex) ──
  const containerRef = windowRef as React.RefObject<HTMLDivElement>;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reload();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        openTab();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (activeTab) closeTab(activeTab.id);
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [reload, openTab, closeTab, activeTab]);

  // ── Forward keystrokes to Playwright when stream is focused ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!streamFocusedRef.current) return;
      if (!sessionIdRef.current) return;
      if (urlFocusedRef.current) return;
      if (!humanControlRef.current) return; // AI controlled — block user keyboard
      // Don't forward modifier-only keys
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      // Record human type action
      humanActionsRef.current.push({ type: 'type', text: e.key, timestamp: Date.now() });
      fetch(`${WAYFARER_URL}/session/${sessionIdRef.current}/shortcut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: e.key }),
      }).catch(() => {});
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Blur stream focus when focus leaves the container ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onBlur = () => { streamFocusedRef.current = false; };
    el.addEventListener('blur', onBlur, true);
    return () => el.removeEventListener('blur', onBlur, true);
  }, []);

  // ── Imperative handle for external control ──
  useImperativeHandle(ref, () => ({
    navigateTo,
    openTab: (url?: string) => openTab(url),
    connectStream,
    disconnectStream,
  }), [navigateTo, openTab, connectStream, disconnectStream]);

  // ── URL bar ──

  function handleUrlFocus() {
    urlFocusedRef.current = true;
    setIsEditingUrl(true);
    setUrlInputValue(activeTab?.url ?? '');
    setTimeout(() => urlInputRef.current?.select(), 50);
  }

  function handleUrlBlur() {
    urlFocusedRef.current = false;
    setIsEditingUrl(false);
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateTo(urlInputValue);
  }

  function handleUrlKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsEditingUrl(false);
      urlInputRef.current?.blur();
    }
  }

  const displayedUrl = isNewTab(activeTab?.url ?? '')
    ? ''
    : cleanUrl(activeTab?.url ?? '');

  const isSecure = activeTab ? isHttps(activeTab.url) : false;

  // Suppress unused-variable warning — updateActiveTab is available for callers
  void updateActiveTab;

  // ── Render ──────────────────────────────────────────

  return (
    <motion.div
      ref={windowRef}
      data-chrome-window
      tabIndex={-1}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      onMouseDownCapture={onFocus}
      style={{
        position: 'absolute',
        ...(pos !== null
          ? { left: pos.x, top: pos.y, transform: 'none' }
          : { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }
        ),
        width: 780, height: 460,
        maxWidth: 'calc(100% - 8px)', maxHeight: 'calc(100% - 8px)',
        display: 'flex', flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#121216',
        border: 'none',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        zIndex: zIndex ?? 210,
        pointerEvents: 'auto',
        outline: 'none',
        ...style,
      }}
    >
      {/* ══════════════════════════════════════════ */}
      {/*  1. TAB BAR (36px)                         */}
      {/* ══════════════════════════════════════════ */}
      <div
        onMouseDown={onTabBarMouseDown}
        style={{
          height: 36, display: 'flex', alignItems: 'flex-end',
          background: '#1c1c1e',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          paddingLeft: 72,
          paddingRight: 8,
          position: 'relative',
          cursor: isDraggingWindow ? 'grabbing' : 'grab',
        }}
      >
        {/* Close button — minimal, no traffic lights */}
        <div style={{
          position: 'absolute', left: 14, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center',
        }}>
          <button
            onClick={onClose}
            style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,95,87,0.7)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            title="Close"
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <AnimatePresence initial={false}>
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                tab={tab}
                onActivate={() => activateTab(tab.id)}
                onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              />
            ))}
          </AnimatePresence>

          {/* New tab button */}
          <motion.button
            onClick={() => openTab()}
            whileHover={{ scale: 1.1, color: 'rgba(255,255,255,0.6)' }}
            whileTap={{ scale: 0.92 }}
            style={{
              width: 28, height: 28, borderRadius: 6, marginBottom: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginLeft: 4,
            }}
          >
            <PlusIcon />
          </motion.button>
        </div>

        {/* Take Control / Release Control button + connection dot — top-right of tab bar */}
        {streamSessionId && (
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {/* Control toggle button */}
            <button
              onClick={() => {
                if (humanControl) {
                  releaseControl();
                } else {
                  humanActionsRef.current = [];
                  setHumanControl(true);
                }
              }}
              style={{
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: '0.04em',
                lineHeight: '14px',
                cursor: 'pointer',
                border: humanControl
                  ? '1px solid rgba(251,191,36,0.35)'
                  : '1px solid rgba(255,255,255,0.10)',
                background: humanControl
                  ? 'rgba(251,191,36,0.12)'
                  : 'rgba(255,255,255,0.04)',
                color: humanControl
                  ? 'rgba(251,191,36,0.9)'
                  : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              title={humanControl ? 'Release control back to AI' : 'Take control of the browser'}
            >
              {humanControl ? 'Release Control' : 'Take Control'}
            </button>

            {/* Control mode badge */}
            <span style={{
              fontSize: 7,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: humanControl ? 'rgba(251,191,36,0.7)' : 'rgba(99,155,255,0.6)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              {humanControl ? 'YOU' : 'AI'}
            </span>

            {/* Connection status dot */}
            <div
              title={connStatus === 'connected' ? 'Stream connected' : connStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              style={{
                width: 7, height: 7, borderRadius: '50%', pointerEvents: 'none',
                flexShrink: 0,
                background: connStatus === 'connected'
                  ? '#28c840'
                  : connStatus === 'connecting'
                    ? '#febc2e'
                    : '#ff5f57',
                boxShadow: connStatus === 'connected'
                  ? '0 0 5px rgba(40,200,64,0.7)'
                  : connStatus === 'connecting'
                    ? '0 0 5px rgba(254,188,46,0.7)'
                    : '0 0 5px rgba(255,95,87,0.7)',
                transition: 'background 0.4s, box-shadow 0.4s',
              }}
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/*  2. TOOLBAR (44px): nav + url              */}
      {/* ══════════════════════════════════════════ */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: '#1a1a1e',
        borderBottom: 'none',
      }}>
        {/* A11y toggle */}
        <button
          onClick={() => setA11yEnabled(v => !v)}
          title={a11yEnabled ? 'Hide accessibility overlay' : 'Show accessibility overlay'}
          style={{
            width: 28, height: 28, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: a11yEnabled ? 'rgba(168,85,247,0.15)' : 'none',
            border: a11yEnabled ? '1px solid rgba(168,85,247,0.35)' : '1px solid transparent',
            cursor: 'pointer',
            color: a11yEnabled ? '#a855f7' : 'rgba(255,255,255,0.35)',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.02em',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { if (!a11yEnabled) { e.currentTarget.style.color = 'rgba(168,85,247,0.75)'; e.currentTarget.style.background = 'rgba(168,85,247,0.08)'; } }}
          onMouseLeave={e => { if (!a11yEnabled) { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'none'; } }}
        >
          A11y
        </button>

        {/* Console toggle */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setConsoleOpen(v => !v)}
            title={consoleOpen ? 'Hide console' : 'Show console'}
            style={{
              width: 28, height: 28, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: consoleOpen ? 'rgba(59,130,246,0.12)' : 'none',
              border: consoleOpen ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              cursor: 'pointer',
              color: consoleOpen ? '#3b82f6' : 'rgba(255,255,255,0.35)',
              fontSize: 9,
              fontWeight: 700,
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.02em',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!consoleOpen) { e.currentTarget.style.color = 'rgba(59,130,246,0.75)'; e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; } }}
            onMouseLeave={e => { if (!consoleOpen) { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'none'; } }}
          >
            &gt;_
          </button>
          {/* Red dot badge for errors */}
          {consoleMessages.some(m => m.level === 'error') && (
            <div style={{
              position: 'absolute', top: 3, right: 3,
              width: 5, height: 5, borderRadius: '50%',
              background: '#f87171',
              boxShadow: '0 0 4px rgba(248,113,113,0.7)',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Back */}
        <NavButton onClick={goBack} disabled={!activeTab?.canGoBack} title="Back">
          <ArrowLeft />
        </NavButton>

        {/* Forward */}
        <NavButton onClick={goForward} disabled={!activeTab?.canGoForward} title="Forward">
          <ArrowRight />
        </NavButton>

        {/* Reload */}
        <NavButton onClick={reload} disabled={!sessionIdRef.current} title="Reload">
          <ReloadIcon spinning={loading} />
        </NavButton>

        {/* URL Bar */}
        <form onSubmit={handleUrlSubmit} style={{ flex: 1, display: 'flex' }}>
          <div
            onClick={handleUrlFocus}
            style={{
              flex: 1, height: 32, borderRadius: 99,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 12px',
              position: 'relative',
              background: isEditingUrl
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(255,255,255,0.04)',
              border: isEditingUrl
                ? '1px solid rgba(99,155,255,0.4)'
                : isNavigating
                  ? '1px solid rgba(59,130,246,0.35)'
                  : '1px solid rgba(255,255,255,0.06)',
              boxShadow: isEditingUrl
                ? '0 0 0 3px rgba(59,130,246,0.12)'
                : isNavigating
                  ? '0 0 0 2px rgba(59,130,246,0.08)'
                  : 'none',
              transition: 'all 0.15s ease',
              cursor: isEditingUrl ? 'text' : 'pointer',
              pointerEvents: 'auto',
              overflow: 'hidden',
            }}
          >
            {/* Navigating progress shimmer — subtle animated sweep along the bottom */}
            {isNavigating && !isEditingUrl && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', bottom: 0, left: 0,
                  width: '50%', height: 2,
                  background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), transparent)',
                  pointerEvents: 'none',
                  borderRadius: 99,
                }}
              />
            )}

            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {isNavigating && !isEditingUrl ? (
                // Tiny spinner replaces lock icon during navigation
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 9, height: 9, borderRadius: '50%',
                    border: '1.5px solid rgba(59,130,246,0.25)',
                    borderTopColor: 'rgba(59,130,246,0.8)',
                  }}
                />
              ) : (
                <LockIcon locked={isSecure} />
              )}
            </div>

            {isEditingUrl ? (
              <input
                ref={urlInputRef}
                value={urlInputValue}
                onChange={e => setUrlInputValue(e.target.value)}
                onBlur={handleUrlBlur}
                onKeyDown={handleUrlKeyDown}
                autoFocus
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 12, color: 'rgba(255,255,255,0.8)',
                  caretColor: '#3b82f6',
                  fontFamily: 'ui-monospace, monospace',
                  pointerEvents: 'auto',
                }}
              />
            ) : (
              <span style={{
                flex: 1, fontSize: 12,
                color: showNewTabPage ? 'rgba(255,255,255,0.2)' : isNavigating ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                userSelect: 'none',
                transition: 'color 0.2s',
              }}>
                {showNewTabPage ? 'Search or navigate...' : displayedUrl}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/*  3. BROWSER VIEWPORT                       */}
      {/* ══════════════════════════════════════════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, padding: 0, margin: 0 }}>
        {/* Loading bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 0.85 }}
              exit={{ scaleX: 1, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                transformOrigin: 'left', zIndex: 10,
              }}
            />
          )}
        </AnimatePresence>

        {streamSessionId && streamHasFrame ? (
          // Live CDP screencast stream
          <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a0a0c', overflow: 'hidden', touchAction: 'none', padding: 0, margin: 0 }}>
            <img
              ref={streamImgRef}
              alt="Live browser"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: humanControl ? 'crosshair' : 'default', border: 'none', padding: 0, margin: 0, pointerEvents: humanControl ? 'auto' : 'none' }}
              draggable={false}
            />

            {/* Cursor trail canvas overlay */}
            <canvas
              ref={trailCanvasRef}
              width={1280}
              height={800}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            />

            {/* Drag indicator canvas overlay — shows dashed arrow during user drags */}
            <canvas
              ref={dragCanvasRef}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
                zIndex: 8,
              }}
            />

            {/* Accessibility bounding-box overlay */}
            <AccessibilityOverlay
              sessionId={streamSessionId}
              streamWidth={streamImgRef.current?.clientWidth ?? 780}
              streamHeight={streamImgRef.current?.clientHeight ?? 380}
              enabled={a11yEnabled}
            />

            {/* Console panel drawer */}
            <ConsolePanelDrawer
              messages={consoleMessages}
              isOpen={consoleOpen}
              onToggle={() => setConsoleOpen(v => !v)}
              onClear={() => setConsoleMessages([])}
            />

            {/* Focus region highlight overlay */}
            {focusRegion && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(focusRegion.x / 1280) * 100}%`,
                  top: `${(focusRegion.y / 800) * 100}%`,
                  width: `${(focusRegion.w / 1280) * 100}%`,
                  height: `${(focusRegion.h / 800) * 100}%`,
                  border: '1.5px solid rgba(255, 140, 50, 0.75)',
                  background: 'rgba(255, 120, 40, 0.07)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  zIndex: 6,
                  opacity: focusRegion.phase === 'in' ? 0 : focusRegion.phase === 'hold' ? 0.4 : 0,
                  transition: focusRegion.phase === 'in'
                    ? 'opacity 0.2s ease-in'
                    : focusRegion.phase === 'out'
                      ? 'opacity 0.2s ease-out'
                      : 'none',
                  boxShadow: '0 0 8px rgba(255,120,40,0.25)',
                }}
              />
            )}

            {/* Connection indicator text (bottom-right, now supplementary to the dot) */}
            <div style={{
              position: 'absolute', bottom: 6, right: 8,
              fontSize: 9, color: streamConnected ? 'rgba(40,200,64,0.5)' : 'rgba(255,255,255,0.15)',
              background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '1px 5px',
              pointerEvents: 'none',
              zIndex: 7,
            }}>
              {streamConnected ? 'live' : 'connecting...'}
            </div>
          </div>
        ) : (streamSessionId && !streamHasFrame) || sessionLoading ? (
          // Session exists but no frame yet — loading
          <div style={{ width: '100%', height: '100%', background: '#0a0a0c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.3)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Connecting browser...</span>
          </div>
        ) : showNewTabPage ? (
          <NewTabPage onNavigate={navigateTo} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#0a0a0c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.3)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Opening browser...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ── Sub-components ─────────────────────────────────────

function TrafficLight({ color, hoverGlow, onClick }: { color: string; hoverGlow: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 12, height: 12, borderRadius: '50%',
        background: color, flexShrink: 0, cursor: onClick ? 'pointer' : 'default',
        border: 'none', padding: 0,
        boxShadow: hovered ? `0 0 6px ${hoverGlow}` : `0 0 0 0 transparent`,
        transition: 'box-shadow 0.15s ease',
      }}
    />
  );
}

function NavButton({
  children, onClick, disabled, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)',
        transition: 'color 0.15s, background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } }}
      onMouseLeave={e => { e.currentTarget.style.color = disabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'none'; }}
    >
      {children}
    </button>
  );
}

function TabButton({
  tab, onActivate, onClose,
}: {
  tab: ChromeTab;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const title = trimTitle(tab.title);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 'auto' }}
      exit={{ opacity: 0, width: 0 }}
      transition={spring}
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 34, maxWidth: 200, minWidth: 60,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px 0 10px',
        borderRadius: '7px 7px 0 0',
        cursor: 'pointer',
        flexShrink: 1, overflow: 'hidden',
        position: 'relative',
        background: tab.isActive
          ? 'rgba(255,255,255,0.07)'
          : hovered
            ? 'rgba(255,255,255,0.035)'
            : 'transparent',
        borderTop: tab.isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
        borderLeft: tab.isActive ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        borderRight: tab.isActive ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Active indicator */}
      {tab.isActive && (
        <div style={{
          position: 'absolute', bottom: 0, left: 8, right: 8, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(99,155,255,0.4), transparent)',
        }} />
      )}

      <FaviconDot favicon={tab.favicon} size={13} />

      <span style={{
        flex: 1, fontSize: 11, fontWeight: tab.isActive ? 500 : 400,
        color: tab.isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {title}
      </span>

      <button
        onClick={onClose}
        style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hovered || tab.isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)',
          opacity: hovered || tab.isActive ? 1 : 0,
          transition: 'opacity 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,80,60,0.2)';
          e.currentTarget.style.color = 'rgba(255,100,80,0.9)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
        }}
      >
        <CloseTabIcon />
      </button>
    </motion.div>
  );
}

