/**
 * TerminalWindow — AI-first command interface
 *
 * Not a real bash terminal. Every command is interpreted by the AI (chat model).
 * Looks and feels like a real terminal (dark, monospace, green cursor), but
 * the AI decides what to do and streams its response back as terminal output.
 */

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { ollamaService } from '../utils/ollama';
import { getChatModel } from '../utils/modelConfig';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { desktopBus } from '../utils/desktopBus';

// ── Types ──────────────────────────────────────────────────────────────────

type LineType = 'prompt' | 'output' | 'error' | 'success' | 'streaming' | 'system';

interface TerminalLine {
  id: string;
  type: LineType;
  text: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PROMPT = 'glance@agent:~$ ';

const SYSTEM_PROMPT = `You are an AI agent terminal. The user types commands that you execute intelligently.
Available commands: search <query>, remember <text>, analyze <url>, plan <task>, write <doc>, clear, history, help
Respond as streaming terminal output. Start each line with "> ". Be concise and technical.
Keep responses under 8 lines total. No markdown. Plain text only. No bullet symbols.
For search commands: describe what you found and key themes.
For remember commands: confirm what was saved with an ID like mem_abc123.
For analyze commands: describe the URL structure, tone, and positioning.
For plan commands: outline the steps concisely.
For write commands: produce a brief structured document in plain text.
Unknown commands: suggest the closest valid command.`;

const HELP_TEXT: TerminalLine[] = [
  { id: 'h1', type: 'output', text: '> Available commands:' },
  { id: 'h2', type: 'success', text: '>   search <query>    — AI web research on any topic' },
  { id: 'h3', type: 'success', text: '>   remember <text>  — Save a note to agent memory' },
  { id: 'h4', type: 'success', text: '>   analyze <url>    — Visual + content analysis of a URL' },
  { id: 'h5', type: 'success', text: '>   plan <task>      — Generate a step-by-step plan' },
  { id: 'h6', type: 'success', text: '>   write <doc>      — Draft a document or brief' },
  { id: 'h7', type: 'success', text: '>   history          — Show command history' },
  { id: 'h8', type: 'success', text: '>   clear            — Clear the terminal' },
  { id: 'h9', type: 'success', text: '>   help             — Show this message' },
];

const WELCOME: TerminalLine[] = [
  { id: 'w1', type: 'system', text: 'Glance AI Terminal  v1.0.0' },
  { id: 'w2', type: 'system', text: `Model: ${getChatModel()}` },
  { id: 'w3', type: 'system', text: 'Type "help" to see available commands.' },
  { id: 'w4', type: 'system', text: '' },
];

// ── Colors per line type ───────────────────────────────────────────────────

function lineColor(type: LineType): string {
  switch (type) {
    case 'prompt':    return '#4ade80';        // green
    case 'output':    return 'rgba(255,255,255,0.60)';
    case 'error':     return '#ef4444';
    case 'success':   return '#22c55e';
    case 'streaming': return 'rgba(180,210,255,0.80)';
    case 'system':    return 'rgba(255,255,255,0.28)';
    default:          return 'rgba(255,255,255,0.6)';
  }
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

// ── Main ───────────────────────────────────────────────────────────────────

export interface TerminalWindowHandle {
  runCommand: (cmd: string) => void;
}

export const TerminalWindow = forwardRef<TerminalWindowHandle, { onClose: () => void; zIndex?: number; onFocus?: () => void }>(function TerminalWindow({ onClose, zIndex, onFocus }, ref) {
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [_historyIdx, setHistoryIdx] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const {
    windowRef,
    pos,
    isDragging: isDraggingWindow,
    onTitleBarMouseDown,
  } = useWindowDrag({ windowWidth: 640, windowHeight: 380 });

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const uid = () => `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const appendLine = useCallback((type: LineType, text: string): string => {
    const id = uid();
    setLines(prev => [...prev, { id, type, text }]);
    return id;
  }, []);

  const _updateLine = useCallback((id: string, text: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, text } : l));
  }, []);
  void _updateLine;

  // ── Built-in commands ─────────────────────────────────────────────────────

  const runBuiltin = useCallback((cmd: string, args: string): boolean => {
    if (cmd === 'clear') {
      setLines([]);
      return true;
    }
    if (cmd === 'help') {
      setLines(prev => [...prev, ...HELP_TEXT]);
      return true;
    }
    if (cmd === 'history') {
      if (cmdHistory.length === 0) {
        appendLine('output', '> No commands in history yet.');
      } else {
        cmdHistory.forEach((c, i) => appendLine('output', `>   ${i + 1}  ${c}`));
      }
      return true;
    }
    void args;
    return false;
  }, [cmdHistory, appendLine]);

  // ── AI command ────────────────────────────────────────────────────────────

  const runAI = useCallback(async (fullCommand: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    // Start a streaming line
    const streamId = uid();
    streamingIdRef.current = streamId;
    setLines(prev => [...prev, { id: streamId, type: 'streaming', text: '' }]);

    let accumulated = '';

    try {
      await ollamaService.generateStream(
        `Command: ${fullCommand}`,
        SYSTEM_PROMPT,
        {
          model: getChatModel(),
          temperature: 0.4,
          num_predict: 256,
          think: false,
          signal: controller.signal,
          onChunk: (chunk: string) => {
            accumulated += chunk;
            // Split accumulated into lines — show last line in streaming slot,
            // flush completed lines above it
            const rawLines = accumulated.split('\n');
            const completedLines = rawLines.slice(0, -1);
            const currentLine = rawLines[rawLines.length - 1];

            setLines(prev => {
              // Remove existing streaming line
              const withoutStream = prev.filter(l => l.id !== streamId);
              // Add completed lines as output (skip the streaming slot we'll re-add)
              const newCompleted: TerminalLine[] = completedLines.map((t, i) => ({
                id: `${streamId}_c${i}_${t.slice(0, 8)}`,
                type: 'output' as LineType,
                text: t,
              }));
              // Replace any already-flushed completed lines to avoid duplicates
              // Strategy: keep all non-streaming, non-chunk lines; append new completed; re-add streaming
              const base = withoutStream.filter(l => !l.id.startsWith(`${streamId}_c`));
              return [
                ...base,
                ...newCompleted,
                { id: streamId, type: 'streaming' as LineType, text: currentLine },
              ];
            });
          },
        }
      );

      // Finalize: flush any remaining text, remove streaming line
      setLines(prev => {
        const withoutStream = prev.filter(l => l.id !== streamId);
        const withoutChunks = withoutStream.filter(l => !l.id.startsWith(`${streamId}_c`));
        const finalLines = accumulated.split('\n').filter(t => t.trim() !== '' || accumulated.endsWith('\n')).map((t, i) => ({
          id: `${streamId}_f${i}`,
          type: 'output' as LineType,
          text: t,
        }));
        return [...withoutChunks, ...finalLines];
      });
    } catch (err) {
      setLines(prev => prev.filter(l => l.id !== streamId && !l.id.startsWith(`${streamId}_c`)));
      if (err instanceof Error && err.name !== 'AbortError') {
        appendLine('error', `> Error: ${err.message}`);
      }
    } finally {
      streamingIdRef.current = null;
      abortRef.current = null;
      setIsRunning(false);
    }
  }, [appendLine]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const raw = input.trim();
    if (!raw) return;

    // Echo the command
    appendLine('prompt', `${PROMPT}${raw}`);

    // Update history
    setCmdHistory(prev => {
      const next = [raw, ...prev.filter(c => c !== raw)].slice(0, 100);
      return next;
    });
    setHistoryIdx(-1);
    setInput('');

    const [cmd, ...rest] = raw.split(/\s+/);
    const args = rest.join(' ');

    // Try built-ins first
    if (runBuiltin(cmd.toLowerCase(), args)) return;

    // AI command
    if (isRunning) {
      // Abort existing
      abortRef.current?.abort();
    }
    setIsRunning(true);
    runAI(raw);
  }, [input, appendLine, runBuiltin, isRunning, runAI]);

  // ── Imperative handle for external control ──────────────────────────────

  useImperativeHandle(ref, () => ({
    runCommand: (cmd: string) => {
      setInput(cmd);
      // Use a microtask so setInput flushes before handleSubmit reads `input`
      setTimeout(() => {
        appendLine('prompt', `${PROMPT}${cmd}`);
        setCmdHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 100));
        setHistoryIdx(-1);
        setInput('');
        const [command, ...rest] = cmd.split(/\s+/);
        const args = rest.join(' ');
        if (runBuiltin(command.toLowerCase(), args)) return;
        setIsRunning(true);
        runAI(cmd);
      }, 0);
    },
  }), [appendLine, runBuiltin, runAI]);

  // ── Desktop bus subscription (agent-driven commands) ───────────────────────

  const runCommandRef = useRef<(cmd: string) => void>();
  runCommandRef.current = (cmd: string) => {
    appendLine('prompt', `${PROMPT}${cmd}`);
    setCmdHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 100));
    setHistoryIdx(-1);
    setInput('');
    const [command, ...rest] = cmd.split(/\s+/);
    const args = rest.join(' ');
    if (runBuiltin(command.toLowerCase(), args)) return;
    setIsRunning(true);
    runAI(cmd);
  };

  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'terminal_run' && event.command) {
        setTimeout(() => runCommandRef.current?.(event.command), 80);
      }
    });
    return unsub;
  }, []);

  // ── Key handler ───────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistoryIdx(prev => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        if (cmdHistory[next] !== undefined) setInput(cmdHistory[next]);
        return next;
      });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistoryIdx(prev => {
        const next = Math.max(prev - 1, -1);
        setInput(next === -1 ? '' : (cmdHistory[next] ?? ''));
        return next;
      });
      return;
    }
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (isRunning) {
        abortRef.current?.abort();
        setIsRunning(false);
        appendLine('error', '^C');
      }
      return;
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
      return;
    }
  }, [handleSubmit, cmdHistory, isRunning, appendLine]);

  // ── Cursor blink ──────────────────────────────────────────────────────────

  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      ref={windowRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={() => inputRef.current?.focus()}
      onMouseDownCapture={onFocus}
      style={{
        position: 'absolute',
        ...(pos !== null
          ? { left: pos.x, top: pos.y, transform: 'none' }
          : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        ),
        width: 640,
        height: 380,
        maxWidth: 'calc(100% - 8px)',
        maxHeight: 'calc(100% - 8px)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: zIndex ?? 220,
        pointerEvents: 'auto',
        background: '#0a0a0c',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        border: 'none',
        fontFamily: 'ui-monospace,"SF Mono","Fira Mono","Cascadia Code","JetBrains Mono",monospace',
        userSelect: 'none',
      }}
    >
      {/* Drag overlay — prevents content from stealing mousemove during drag */}
      {isDraggingWindow && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9999, cursor: 'grabbing' }} />
      )}
      {/* Title bar */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          paddingRight: 14,
          background: '#1c1c1e',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
          cursor: 'default',
          position: 'relative',
        }}
      >
        <TrafficLights onClose={onClose} />
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: 0.2,
          fontFamily: 'ui-monospace,"SF Mono",monospace',
        }}>
          glance — zsh
        </div>
        {isRunning && (
          <div style={{
            position: 'absolute',
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10,
            color: 'rgba(74,222,128,0.6)',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              display: 'inline-block',
              animation: 'pulse 1.2s ease-in-out infinite',
            }} />
            running
          </div>
        )}
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {lines.map(line => (
          <div
            key={line.id}
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: lineColor(line.type),
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              minHeight: line.text === '' ? '0.8em' : undefined,
            }}
          >
            {line.text}
          </div>
        ))}
      </div>

      {/* Input row */}
      <div style={{
        height: 38,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: '#0d0d10',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        flexShrink: 0,
        gap: 0,
      }}>
        <span style={{
          fontSize: 12.5,
          color: '#4ade80',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          userSelect: 'none',
        }}>
          {PROMPT}
        </span>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={false}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.88)',
              fontFamily: 'inherit',
              caretColor: 'transparent',
              width: '100%',
            }}
          />
          {/* Custom blinking cursor */}
          <span
            style={{
              position: 'absolute',
              left: `${input.length}ch`,
              top: '50%',
              transform: 'translateY(-50%)',
              width: '0.55em',
              height: '1.2em',
              background: cursorVisible ? '#4ade80' : 'transparent',
              display: 'inline-block',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
});
