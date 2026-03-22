/**
 * ComputerDesktop -- macOS-style desktop with menu bar, windows, and dock
 *
 * Fills its parent container. Parent provides the gradient background.
 * - Top: 24px menu bar (time, right-aligned)
 * - Middle: window area (Finder, Chrome, Terminal)
 * - Bottom: dock (3 icons, glass bg, centered)
 * - AICursor overlay
 * - desktopBus event handlers for window/agent control
 */

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconFinderReal, IconChromeReal, IconTerminalReal } from './RealMacOSIcons';
import { FinderWindow } from './FinderWindow';
import { ChromeWindow, type ChromeWindowHandle } from './ChromeWindow';
import { TerminalWindow, type TerminalWindowHandle } from './TerminalWindow';
import { desktopBus } from '../utils/desktopBus';
import { runDesktopVisionLoop, type VisionLoopOptions } from '../utils/desktopVisionLoop';
import { runComputerAgent } from '../utils/computerAgent/orchestrator';
import { AskUserModal } from './AskUserModal';
import type { AskUserRequest, AskUserResponse } from '../utils/computerAgent/orchestrator';
import { AICursor, type CursorState } from './AICursor';
import { ErrorBoundary } from './ErrorBoundary';

type WinId = 'finder' | 'chrome' | 'terminal';

export interface ComputerDesktopHandle {
  runGoal: (goal: string, options?: VisionLoopOptions) => Promise<string>;
}

interface ComputerDesktopProps {
  sessionId?: string;
  computerId?: string;
  humanControl?: boolean;
  onHumanControlChange?: (value: boolean) => void;
}

export const ComputerDesktop = forwardRef<ComputerDesktopHandle, ComputerDesktopProps>(function ComputerDesktop({ sessionId, computerId, humanControl, onHumanControlChange }, ref) {
  const [time] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  // Window open state
  const [openWindows, setOpenWindows] = useState<Record<WinId, boolean>>({ finder: false, chrome: false, terminal: false });
  const setWindowOpen = useCallback((id: WinId, open: boolean) => {
    setOpenWindows(prev => ({ ...prev, [id]: open }));
  }, []);

  // Focus stack -- last element is topmost
  const [focusStack, setFocusStack] = useState<WinId[]>([]);
  const bringToFront = useCallback((id: WinId) => {
    setFocusStack(prev => [...prev.filter(w => w !== id), id]);
  }, []);
  const zFor = useCallback((id: WinId): number => {
    const idx = focusStack.indexOf(id);
    return 200 + (idx === -1 ? 0 : (idx + 1) * 10);
  }, [focusStack]);

  const toggleWindow = useCallback((id: WinId) => {
    setOpenWindows(prev => {
      const willOpen = !prev[id];
      if (willOpen) bringToFront(id);
      return { ...prev, [id]: willOpen };
    });
  }, [bringToFront]);

  // Ask-user modal
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);
  const askUserResolveRef = useRef<((r: AskUserResponse) => void) | null>(null);

  // AI cursor
  const [aiCursorPos, setAiCursorPos] = useState({ x: 0, y: 0 });
  const aiCursorPosRef = useRef({ x: 0, y: 0 });
  const [aiCursorState, setAiCursorState] = useState<CursorState>('idle');
  const [aiCursorVisible, setAiCursorVisible] = useState(false);
  const aiCursorHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const desktopRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<ChromeWindowHandle>(null);
  const terminalRef = useRef<TerminalWindowHandle>(null);

  // ── Human action recording ──
  const humanActionsRef = useRef<Array<{
    type: 'click' | 'scroll' | 'drag' | 'type' | 'window_open' | 'window_close' | 'window_drag';
    target?: string;
    x?: number; y?: number;
    details?: string;
    timestamp: number;
  }>>([]);
  const humanControlStartRef = useRef<number>(0);
  const prevHumanControlRef = useRef<boolean>(false);

  // Record desktop-level clicks and scrolls when human has control
  useEffect(() => {
    if (!humanControl || !desktopRef.current) return;
    const root = desktopRef.current;

    const identifyTarget = (e: Event): string => {
      const el = e.target as HTMLElement;
      if (!el) return 'desktop';
      const closest = el.closest?.('[data-desktop-root]');
      if (!closest) return 'desktop';
      // Check if inside a known window
      if (el.closest?.('[data-app="chrome"]')) return 'chrome';
      if (el.closest?.('[data-app="finder"]')) return 'finder';
      if (el.closest?.('[data-app="terminal"]')) return 'terminal';
      // Check if in the dock
      if (el.closest?.('[data-dock]')) return 'dock';
      return 'desktop';
    };

    const onClick = (e: MouseEvent) => {
      humanActionsRef.current.push({
        type: 'click', target: identifyTarget(e),
        x: e.clientX, y: e.clientY, timestamp: Date.now(),
      });
    };
    const onWheel = (e: WheelEvent) => {
      humanActionsRef.current.push({
        type: 'scroll', target: identifyTarget(e),
        details: `${e.deltaY > 0 ? 'down' : 'up'} ${Math.abs(Math.round(e.deltaY))}px`,
        timestamp: Date.now(),
      });
    };

    root.addEventListener('click', onClick, true);
    root.addEventListener('wheel', onWheel, true);
    return () => {
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('wheel', onWheel, true);
    };
  }, [humanControl]);

  // Record window open/close via bus while human has control
  useEffect(() => {
    if (!humanControl) return;
    return desktopBus.subscribe(event => {
      if (event.type === 'open_window') {
        humanActionsRef.current.push({ type: 'window_open', target: event.app, timestamp: Date.now() });
      } else if (event.type === 'close_window') {
        humanActionsRef.current.push({ type: 'window_close', target: event.app, timestamp: Date.now() });
      }
    });
  }, [humanControl]);

  // Auto-recap: emit summary when humanControl transitions true -> false
  useEffect(() => {
    if (prevHumanControlRef.current && !humanControl) {
      const actions = humanActionsRef.current;
      const elapsed = Math.round((Date.now() - humanControlStartRef.current) / 1000);
      const lines = actions.map(a => {
        switch (a.type) {
          case 'click': return `Clicked in ${a.target || 'desktop'} at (${a.x}, ${a.y})`;
          case 'scroll': return `Scrolled ${a.details || ''} in ${a.target || 'desktop'}`;
          case 'type': return `Typed "${a.details || ''}"`;
          case 'window_open': return `Opened ${a.target || 'window'}`;
          case 'window_close': return `Closed ${a.target || 'window'}`;
          case 'window_drag': return `Dragged ${a.target || 'window'}`;
          case 'drag': return `Dragged in ${a.target || 'desktop'}`;
          default: return '';
        }
      }).filter(Boolean);
      const summary = actions.length === 0
        ? `User took control for ${elapsed} seconds but performed no actions.`
        : `User took control for ${elapsed} seconds and performed ${actions.length} action(s):\n${lines.map(l => `- ${l}`).join('\n')}`;

      let screenshot = '';
      // Try to grab current frame from Chrome stream img
      try {
        const img = desktopRef.current?.querySelector('img[alt="Live browser"]') as HTMLImageElement | null;
        if (img) {
          const c = document.createElement('canvas'); c.width = 1280; c.height = 800;
          const ctx = c.getContext('2d');
          if (ctx) { ctx.drawImage(img, 0, 0, 1280, 800); screenshot = c.toDataURL('image/jpeg', 0.7).replace(/^data:image\/jpeg;base64,/, ''); }
        }
      } catch { /* tainted canvas */ }

      desktopBus.emit({ type: 'human_control_summary', actions, screenshot, summary });
      humanActionsRef.current = [];
    }
    if (humanControl && !prevHumanControlRef.current) {
      humanControlStartRef.current = Date.now();
      humanActionsRef.current = [];
    }
    prevHumanControlRef.current = !!humanControl;
  }, [humanControl]);

  // Expose runGoal to parent
  useImperativeHandle(ref, () => ({
    runGoal: (goal: string, options?: VisionLoopOptions) => {
      if (!desktopRef.current) return Promise.resolve('Desktop element not mounted');
      return runDesktopVisionLoop(goal, desktopRef.current, options);
    },
  }));

  // -- Desktop event bus -- window management + agent control
  useEffect(() => {
    return desktopBus.subscribe(event => {
      switch (event.type) {
        case 'open_window':
          setWindowOpen(event.app, true);
          bringToFront(event.app);
          break;
        case 'close_window':
          setWindowOpen(event.app as any, false);
          break;
        case 'focus_window':
          bringToFront(event.app as any);
          break;
        case 'navigate_chrome':
          setWindowOpen('chrome', true);
          bringToFront('chrome');
          setTimeout(() => chromeRef.current?.navigateTo(event.url), 80);
          break;
        case 'run_terminal':
        case 'terminal_run':
          setWindowOpen('terminal', true);
          bringToFront('terminal');
          setTimeout(() => terminalRef.current?.runCommand(event.command), 80);
          break;
        case 'move_window':
          if (event.app === 'chrome' || event.app === 'finder' || event.app === 'terminal') {
            bringToFront(event.app as WinId);
          }
          break;
        case 'resize_window':
          break;
        case 'finder_navigate':
        case 'finder_open_file':
        case 'finder_select_file':
          setWindowOpen('finder', true);
          bringToFront('finder');
          break;
        case 'browser_stream':
          chromeRef.current?.connectStream(event.sessionId);
          setWindowOpen('chrome', true);
          bringToFront('chrome');
          break;
        case 'browser_stream_stop':
          chromeRef.current?.disconnectStream();
          break;
        case 'run_goal':
          if (desktopRef.current) {
            runComputerAgent(event.goal, desktopRef.current, {
              onStatus: (msg: string) => console.log('[ComputerDesktop]', msg),
              onBrowserUrl: (url: string) => chromeRef.current?.navigateTo(url),
              onAskUser: (request: AskUserRequest) => new Promise<AskUserResponse>((resolve) => {
                desktopBus.emit({
                  type: 'ask_user',
                  question: request.question,
                  isClarification: request.isClarification,
                  resolve: (answer: string) => resolve({ value: answer, label: answer }),
                });
              }),
            }).catch((err) => {
              console.error('[ComputerDesktop] runComputerAgent error:', err);
              desktopBus.emit({ type: 'agent_status', phase: 'error', message: err instanceof Error ? err.message : String(err) });
            });
          } else {
            desktopBus.emit({ type: 'agent_status', phase: 'error', message: 'Desktop element not available' });
          }
          break;
        case 'ask_user':
          askUserResolveRef.current = event.resolve ? (r) => event.resolve!(r.value) : null;
          setAskUserRequest({
            id: `ask_${Date.now()}`,
            question: event.question,
            context: '',
            options: [],
            allowCustom: true,
            isClarification: event.isClarification,
          });
          break;
        case 'open_image':
        case 'open_pdf':
        case 'window_scroll':
          break;
      }
    });
  }, [bringToFront, setWindowOpen]);

  // -- AI cursor events (stable [] deps to avoid re-subscribing on every move)
  useEffect(() => {
    const resetHideTimer = () => {
      if (aiCursorHideTimer.current) clearTimeout(aiCursorHideTimer.current);
      aiCursorHideTimer.current = setTimeout(() => setAiCursorVisible(false), 4000);
    };

    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'ai_cursor_move') {
        const pos = { x: event.x, y: event.y };
        aiCursorPosRef.current = pos;
        setAiCursorPos(pos);
        setAiCursorState(event.state as CursorState);
        setAiCursorVisible(true);
        resetHideTimer();
      } else if (event.type === 'ai_cursor_click') {
        const pos = { x: event.x, y: event.y };
        aiCursorPosRef.current = pos;
        setAiCursorPos(pos);
        setAiCursorState('clicking');
        setAiCursorVisible(true);
        setTimeout(() => setAiCursorState(s => s === 'clicking' ? 'acting' : s), 300);
        resetHideTimer();
      } else if (event.type === 'ai_cursor_state') {
        setAiCursorState(event.state as CursorState);
        if (event.state !== 'idle') {
          setAiCursorVisible(true);
          resetHideTimer();
        } else {
          setAiCursorVisible(false);
          if (aiCursorHideTimer.current) clearTimeout(aiCursorHideTimer.current);
        }
      } else if (event.type === 'agent_status') {
        if (event.phase === 'done' || event.phase === 'error') {
          if (aiCursorHideTimer.current) clearTimeout(aiCursorHideTimer.current);
          aiCursorHideTimer.current = setTimeout(() => setAiCursorVisible(false), 1500);
        }
      } else if (event.type === 'ai_action') {
        const map: Record<string, CursorState> = { click: 'clicking', typing: 'typing', scroll: 'acting', navigate: 'acting', looking: 'thinking', thinking: 'thinking' };
        const mapped = map[event.action];
        if (mapped) {
          setAiCursorState(mapped);
          setAiCursorVisible(true);
          resetHideTimer();
        }
      }
    });

    return () => {
      unsub();
      if (aiCursorHideTimer.current) clearTimeout(aiCursorHideTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <div ref={desktopRef} data-desktop-root className="w-full h-full flex flex-col" style={{ position: 'relative', pointerEvents: humanControl ? 'auto' : 'none' }}>
        {/* Menu bar */}
        <div style={{
          height: 24, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.30)' }}>{time}</span>
        </div>

        {/* Window area */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <AnimatePresence>
            {openWindows.finder && (
              <FinderWindow onClose={() => setWindowOpen('finder', false)} zIndex={zFor('finder')} onFocus={() => bringToFront('finder')} rootPath={sessionId && computerId ? `/nomad/sessions/${sessionId}/computers/${computerId}` : '/nomad'} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {openWindows.chrome && (
              <ErrorBoundary fallback={
                <div style={{ position: 'absolute', inset: 40, background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, zIndex: zFor('chrome') }}>
                  Chrome crashed. Close and reopen from the dock.
                </div>
              }>
                <ChromeWindow ref={chromeRef} onClose={() => setWindowOpen('chrome', false)} zIndex={zFor('chrome')} onFocus={() => bringToFront('chrome')} externalHumanControl={humanControl} onHumanControlChange={onHumanControlChange} />
              </ErrorBoundary>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {openWindows.terminal && (
              <TerminalWindow ref={terminalRef} onClose={() => setWindowOpen('terminal', false)} zIndex={zFor('terminal')} onFocus={() => bringToFront('terminal')} />
            )}
          </AnimatePresence>

          {/* AI cursor overlay */}
          <ErrorBoundary fallback={null}>
            <AICursor x={aiCursorPos.x} y={aiCursorPos.y} cursorState={aiCursorState} visible={aiCursorVisible} />
          </ErrorBoundary>
        </div>

        {/* Dock */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
          position: 'relative', zIndex: 500,
        }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 14,
              background: 'rgba(20,20,28,0.55)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            <DockIcon label="Finder" isOpen={openWindows.finder} onClick={() => toggleWindow('finder')}>
              <IconFinderReal size={40} />
            </DockIcon>
            <DockIcon label="Chrome" isOpen={openWindows.chrome} onClick={() => toggleWindow('chrome')}>
              <IconChromeReal size={40} />
            </DockIcon>
            <DockIcon label="Terminal" isOpen={openWindows.terminal} onClick={() => toggleWindow('terminal')}>
              <IconTerminalReal size={40} />
            </DockIcon>
          </motion.div>
        </div>

        {/* Ask-user modal */}
        <AskUserModal
          request={askUserRequest}
          onResponse={(r) => {
            askUserResolveRef.current?.(r);
            askUserResolveRef.current = null;
            setAskUserRequest(null);
          }}
        />
      </div>
    </ErrorBoundary>
  );
});

// -- DockIcon --
function DockIcon({ children, label, isOpen, onClick }: {
  children: React.ReactNode;
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ y: -6 }}
          whileTap={{ scale: 0.92, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={onClick}
          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, cursor: 'pointer' }}
          title={label}
        >
          {children}
        </motion.button>
        {isOpen && (
          <div style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
        )}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 1 }}>{label}</div>
    </div>
  );
}
