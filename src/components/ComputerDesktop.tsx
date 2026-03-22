/**
 * ComputerDesktop — macOS-style desktop with dock and file icons
 *
 * Window manager: tracks focus order so the last-clicked window is always on top.
 * Drag bug fix: each window gets an onFocus callback; windows apply a transparent
 * overlay over iframes/content during drag so mousemove isn't stolen.
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

// Window IDs
type WinId = 'finder' | 'chrome' | 'terminal';

// Base z-indices (before focus stacking)
const BASE_Z: Record<WinId, number> = { finder: 200, chrome: 200, terminal: 200 };

export interface ComputerDesktopHandle {
  runGoal: (goal: string, options?: VisionLoopOptions) => Promise<string>;
}

export const ComputerDesktop = forwardRef<ComputerDesktopHandle, Record<string, never>>(function ComputerDesktop(_props, ref) {
  const [time] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [isChromeOpen, setIsChromeOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  // Ask-user modal state (for computer agent high-stakes pauses)
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);
  const askUserResolveRef = useRef<((r: AskUserResponse) => void) | null>(null);

  // AI cursor overlay state
  const [aiCursorPos, setAiCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const aiCursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [aiCursorState, setAiCursorState] = useState<CursorState>('idle');
  const [aiCursorVisible, setAiCursorVisible] = useState(false);
  const aiCursorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Action badge state
  type ActionType = 'click' | 'typing' | 'scroll' | 'navigate' | 'looking' | 'thinking' | 'idle';
  const [actionBadge, setActionBadge] = useState<{ action: ActionType; x: number; y: number; visible: boolean } | null>(null);
  const actionBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Heatmap dots state (click positions collected during a task, shown on task end)
  const taskClicksRef = useRef<{ x: number; y: number }[]>([]);
  const [heatmapDots, setHeatmapDots] = useState<{ x: number; y: number; id: number }[]>([]);
  const heatmapCleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for the main desktop container (used by vision loop)
  const desktopRef = useRef<HTMLDivElement>(null);

  // Imperative refs for programmatic window control
  const chromeRef = useRef<ChromeWindowHandle>(null);
  const terminalRef = useRef<TerminalWindowHandle>(null);

  // Expose runGoal to parent components via ref
  useImperativeHandle(ref, () => ({
    runGoal: (goal: string, options?: VisionLoopOptions) => {
      if (!desktopRef.current) return Promise.resolve('Desktop element not mounted');
      return runDesktopVisionLoop(goal, desktopRef.current, options);
    },
  }));

  // Focus stack — last element is the topmost window
  const [focusStack, setFocusStack] = useState<WinId[]>([]);

  const bringToFront = useCallback((id: WinId) => {
    setFocusStack(prev => [...prev.filter(w => w !== id), id]);
  }, []);

  // Returns z-index for a window: base + position in focus stack * 10
  const zFor = useCallback((id: WinId): number => {
    const idx = focusStack.indexOf(id);
    return BASE_Z[id] + (idx === -1 ? 0 : (idx + 1) * 10);
  }, [focusStack]);

  const openWindow = useCallback((id: WinId, setOpen: (v: boolean) => void, isOpen: boolean) => {
    if (!isOpen) bringToFront(id);
    setOpen(!isOpen);
  }, [bringToFront]);

  // ── Desktop event bus subscription ──────────────────────────────────────
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      switch (event.type) {
        case 'open_window':
          if (event.window === 'chrome') { setIsChromeOpen(true); bringToFront('chrome'); }
          else if (event.window === 'finder') { setIsFinderOpen(true); bringToFront('finder'); }
          else if (event.window === 'terminal') { setIsTerminalOpen(true); bringToFront('terminal'); }
          break;
        case 'close_window':
          if (event.window === 'chrome') setIsChromeOpen(false);
          else if (event.window === 'finder') setIsFinderOpen(false);
          else if (event.window === 'terminal') setIsTerminalOpen(false);
          break;
        case 'navigate_chrome':
          setIsChromeOpen(true);
          bringToFront('chrome');
          // Small delay so React can mount ChromeWindow before we call the ref
          setTimeout(() => chromeRef.current?.navigateTo(event.url), 80);
          break;
        case 'run_terminal':
          setIsTerminalOpen(true);
          bringToFront('terminal');
          setTimeout(() => terminalRef.current?.runCommand(event.command), 80);
          break;
        case 'focus_window':
          bringToFront(event.window);
          break;
        case 'run_goal':
          if (desktopRef.current) {
            runComputerAgent(event.goal, desktopRef.current, {
              onStatus: (msg: string) => {
                console.log('[ComputerDesktop]', msg);
              },
              onScreenshot: (base64: string) => {
                // Screenshots are handled by the AI cursor overlay
                void base64;
              },
              onBrowserUrl: (url: string) => {
                chromeRef.current?.navigateTo(url);
              },
              onAskUser: (request: AskUserRequest) => new Promise<AskUserResponse>((resolve) => {
                desktopBus.emit({ type: 'ask_user', request, resolve });
              }),
            }).catch((err) => {
              console.error('[ComputerDesktop] runComputerAgent error:', err);
              // Ensure agent_status error is emitted so the sidebar Promise resolves.
              // The orchestrator emits this on its own catch, but if we fail before
              // the orchestrator runs (e.g. bad desktopEl), the sidebar would hang.
              desktopBus.emit({ type: 'agent_status', phase: 'error', message: err instanceof Error ? err.message : String(err) });
            });
          } else {
            // desktopRef not available — emit error so waiting Promises don't hang
            console.error('[ComputerDesktop] run_goal: desktopRef.current is null');
            desktopBus.emit({ type: 'agent_status', phase: 'error', message: 'Desktop element not available' });
          }
          break;
        case 'ask_user':
          askUserResolveRef.current = event.resolve;
          setAskUserRequest(event.request);
          break;
        case 'browser_stream':
          chromeRef.current?.connectStream(event.sessionId);
          // Auto-open Chrome window when stream starts
          setIsChromeOpen(true);
          bringToFront('chrome');
          break;
        case 'browser_stream_stop':
          chromeRef.current?.disconnectStream();
          break;
        case 'open_image':
          // Image viewing now handled by Finder preview panel
          break;
        case 'open_pdf':
          // PDF viewing now handled by Finder preview panel
          break;
        case 'move_window':
          // Window position is managed by useWindowDrag inside each window.
          // For now, bring to front so it's visible. Full drag-to-position
          // would require exposing setPos on each window ref.
          if (event.app === 'chrome' || event.app === 'finder' || event.app === 'terminal') {
            bringToFront(event.app as WinId);
          }
          break;
        case 'resize_window':
          // Window size is managed internally by each window component.
          // Log for debugging; full resize would require exposing setSize refs.
          console.log(`[ComputerDesktop] resize_window: ${event.app} to ${event.width}x${event.height} (not yet implemented)`);
          break;
        case 'terminal_run':
          setIsTerminalOpen(true);
          bringToFront('terminal');
          setTimeout(() => terminalRef.current?.runCommand(event.command), 80);
          break;
        case 'finder_navigate':
          setIsFinderOpen(true);
          bringToFront('finder');
          // FinderWindow listens to this event internally
          break;
        case 'finder_open_file':
          setIsFinderOpen(true);
          bringToFront('finder');
          // FinderWindow listens to this event internally
          break;
        case 'finder_select_file':
          setIsFinderOpen(true);
          bringToFront('finder');
          // FinderWindow listens to this event internally
          break;
        case 'window_scroll':
          // Scroll events are handled by each window internally
          break;
      }
    });
    return unsub;
  }, [bringToFront]);

  // AI cursor — listen to desktopBus cursor events
  // NOTE: This effect must have [] deps to avoid re-subscribing on every cursor move.
  // We use aiCursorPosRef (not aiCursorPos state) for the fallback badge position.
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      const resetHideTimer = () => {
        if (aiCursorHideTimerRef.current) clearTimeout(aiCursorHideTimerRef.current);
        aiCursorHideTimerRef.current = setTimeout(() => setAiCursorVisible(false), 4000);
      };

      if (event.type === 'ai_cursor_move') {
        const pos = { x: event.x, y: event.y };
        aiCursorPosRef.current = pos;
        setAiCursorPos(pos);
        setAiCursorState(event.cursorState);
        setAiCursorVisible(true);
        resetHideTimer();
      } else if (event.type === 'ai_cursor_click') {
        const pos = { x: event.x, y: event.y };
        aiCursorPosRef.current = pos;
        setAiCursorPos(pos);
        setAiCursorState('clicking');
        setAiCursorVisible(true);
        // Collect for heatmap
        taskClicksRef.current.push(pos);
        // Return to acting state after click animation completes
        setTimeout(() => setAiCursorState(s => s === 'clicking' ? 'acting' : s), 300);
        resetHideTimer();
      } else if (event.type === 'ai_cursor_state') {
        setAiCursorState(event.cursorState);
        if (event.cursorState !== 'idle') {
          setAiCursorVisible(true);
          resetHideTimer();
        } else {
          setAiCursorVisible(false);
          if (aiCursorHideTimerRef.current) clearTimeout(aiCursorHideTimerRef.current);
        }
      } else if (event.type === 'agent_status') {
        // Hide cursor shortly after agent finishes
        if (event.phase === 'done' || event.phase === 'error') {
          if (aiCursorHideTimerRef.current) clearTimeout(aiCursorHideTimerRef.current);
          aiCursorHideTimerRef.current = setTimeout(() => setAiCursorVisible(false), 1500);
        }
      } else if (event.type === 'ai_action') {
        // Map action to cursor visual state
        const actionToCursorState: Record<string, CursorState> = {
          click:    'clicking',
          typing:   'typing',
          scroll:   'acting',
          navigate: 'acting',
          looking:  'thinking',
          thinking: 'thinking',
          idle:     'idle',
        };
        const mappedState = actionToCursorState[event.action];
        if (mappedState && mappedState !== 'idle') {
          setAiCursorState(mappedState);
          setAiCursorVisible(true);
          resetHideTimer();
        }
        // Show action badge near cursor position (use ref for stable fallback)
        const badgeX = event.x ?? aiCursorPosRef.current.x;
        const badgeY = event.y ?? aiCursorPosRef.current.y;
        if (event.action === 'idle') {
          setActionBadge(null);
        } else {
          setActionBadge({ action: event.action as ActionType, x: badgeX, y: badgeY, visible: true });
          if (actionBadgeTimer.current) clearTimeout(actionBadgeTimer.current);
          actionBadgeTimer.current = setTimeout(() => {
            setActionBadge(prev => prev ? { ...prev, visible: false } : null);
            actionBadgeTimer.current = setTimeout(() => setActionBadge(null), 200);
          }, 800);
        }
      } else if (event.type === 'ai_task_start') {
        taskClicksRef.current = [];
        setHeatmapDots([]);
      } else if (event.type === 'ai_task_end') {
        const clicks = taskClicksRef.current;
        if (clicks.length > 0) {
          const dots = clicks.map((pt, i) => ({ ...pt, id: i }));
          setHeatmapDots(dots);
          if (heatmapCleanupTimer.current) clearTimeout(heatmapCleanupTimer.current);
          heatmapCleanupTimer.current = setTimeout(() => {
            setHeatmapDots([]);
            taskClicksRef.current = [];
          }, 2000);
        }
      }
    });
    return () => {
      unsub();
      if (aiCursorHideTimerRef.current) clearTimeout(aiCursorHideTimerRef.current);
      if (actionBadgeTimer.current) clearTimeout(actionBadgeTimer.current);
      if (heatmapCleanupTimer.current) clearTimeout(heatmapCleanupTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Action badge label map
  const ACTION_LABELS: Record<ActionType, string> = {
    click: '\uD83D\uDDB1 Click',
    typing: '\u2328 Typing',
    scroll: '\u2195 Scroll',
    navigate: '\uD83C\uDF10 Navigate',
    looking: '\uD83D\uDC41 Looking',
    thinking: '\uD83E\uDD14 Thinking',
    idle: '',
  };

  return (
    <ErrorBoundary>
    <div ref={desktopRef} data-desktop-root className="absolute inset-0 pointer-events-none z-20 flex flex-col">
      {/* Top menu bar */}
      <div className="h-6 px-4 flex items-center justify-end bg-black/[0.35] backdrop-blur-md border-b border-white/[0.04]">
        <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.30)' }}>{time}</div>
      </div>

      {/* Desktop area — windows here, pointer-events-auto so they're draggable */}
      <div className="flex-1 relative pointer-events-auto">
        <AnimatePresence>
          {isFinderOpen && (
            <FinderWindow
              onClose={() => setIsFinderOpen(false)}
              zIndex={zFor('finder')}
              onFocus={() => bringToFront('finder')}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isChromeOpen && (
            <ErrorBoundary fallback={
              <div style={{ position: 'absolute', inset: 40, background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, zIndex: zFor('chrome') }}>
                Chrome crashed. Close and reopen from the dock.
              </div>
            }>
              <ChromeWindow
                ref={chromeRef}
                onClose={() => setIsChromeOpen(false)}
                zIndex={zFor('chrome')}
                onFocus={() => bringToFront('chrome')}
              />
            </ErrorBoundary>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isTerminalOpen && (
            <TerminalWindow
              ref={terminalRef}
              onClose={() => setIsTerminalOpen(false)}
              zIndex={zFor('terminal')}
              onFocus={() => bringToFront('terminal')}
            />
          )}
        </AnimatePresence>
        {/* AI cursor overlay — isolated so a cursor crash doesn't kill the desktop */}
        <ErrorBoundary fallback={null}>
          <AICursor
            x={aiCursorPos.x}
            y={aiCursorPos.y}
            cursorState={aiCursorState}
            visible={aiCursorVisible}
          />
        </ErrorBoundary>

        {/* Action badge — floats 20px below the cursor, clamped to viewport edges */}
        {actionBadge && actionBadge.action !== 'idle' && (
          <div
            style={{
              position: 'absolute',
              left: Math.max(40, Math.min(actionBadge.x, (desktopRef.current?.clientWidth ?? 1280) - 40)),
              top: Math.min(actionBadge.y + 20, (desktopRef.current?.clientHeight ?? 800) - 30),
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 10000,
              background: 'rgba(14,14,18,0.82)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.88)',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              opacity: actionBadge.visible ? 1 : 0,
              transition: 'opacity 0.15s ease',
              letterSpacing: '0.03em',
            }}
          >
            {ACTION_LABELS[actionBadge.action]}
          </div>
        )}

        {/* Heatmap dots — pulse once on task end, shown for 2s */}
        {heatmapDots.map(dot => (
          <div
            key={dot.id}
            style={{
              position: 'absolute',
              left: dot.x,
              top: dot.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 9998,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'rgba(255, 110, 40, 0.85)',
              boxShadow: '0 0 6px rgba(255, 110, 40, 0.6)',
              animation: '_nomad_heatmap_pulse 0.6s ease-out forwards',
            }}
          />
        ))}

        {/* _nomad_heatmap_pulse keyframe is in index.css */}
      </div>

      {/* Bottom dock */}
      <div className="h-20 px-6 flex items-end justify-center pb-2 pointer-events-auto" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', zIndex: 500, position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center"
          style={{
            gap: 10,
            padding: '10px 16px',
            borderRadius: 14,
            background: 'rgba(20,20,28,0.55)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {/* Finder */}
          <DockIcon
            label="Finder"
            isOpen={isFinderOpen}
            onClick={() => openWindow('finder', setIsFinderOpen, isFinderOpen)}
            title="Open Finder — Browse session files"
            ariaLabel="Open Finder — Browse session files"
            hint="Click to open the Finder file browser window"
          >
            <IconFinderReal size={40} />
          </DockIcon>

          {/* Chrome */}
          <DockIcon
            label="Chrome"
            isOpen={isChromeOpen}
            onClick={() => openWindow('chrome', setIsChromeOpen, isChromeOpen)}
            title="Open Chrome — AI web browser"
            ariaLabel="Open Chrome — AI web browser"
            hint="Click to open the Chrome browser for web navigation"
          >
            <IconChromeReal size={40} />
          </DockIcon>

          {/* Terminal */}
          <DockIcon
            label="Terminal"
            isOpen={isTerminalOpen}
            onClick={() => openWindow('terminal', setIsTerminalOpen, isTerminalOpen)}
            title="Terminal — AI command interface"
            ariaLabel="Terminal — AI command interface"
            hint="Click to open the AI terminal command window"
          >
            <IconTerminalReal size={40} />
          </DockIcon>

        </motion.div>
      </div>

      {/* Ask-user modal — rendered when computer agent needs confirmation */}
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

// ── DockIcon sub-component ────────────────────────────────────────────────────

function DockIcon({
  children, label, isOpen, onClick, title, ariaLabel, hint,
}: {
  children: React.ReactNode;
  label: string;
  isOpen: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  hint: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ y: -6 }}
          whileTap={{ scale: 0.92, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={onClick}
          className="cursor-pointer pointer-events-auto"
          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56 }}
          title={title}
          aria-label={ariaLabel}
          data-ai-hint={hint}
        >
          {children}
        </motion.button>
        {isOpen && (
          <div style={{
            position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
            width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.7)',
          }} />
        )}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 1, letterSpacing: 0.2 }}>
        {label}
      </div>
    </div>
  );
}
