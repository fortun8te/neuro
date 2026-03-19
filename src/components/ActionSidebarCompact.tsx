/**
 * ActionSidebarCompact — Instruction log panel
 *
 * Shows execution log (clicks, navigations, thoughts) and instruction input.
 * Routes instructions via agentRouter → search / write / browse / memory / plan / chat.
 * Includes a collapsible MEMORY section showing recent agent memories.
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconFinderReal } from './RealMacOSIcons';
import { routeInstruction } from '../utils/agentRouter';
import { addMemory, deleteMemory, formatMemoryAge, useMemories } from '../utils/memoryStore';
import { ollamaService } from '../utils/ollama';
import { getChatModel } from '../utils/modelConfig';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  type: 'click' | 'type' | 'navigate' | 'think' | 'action' | 'result' | 'route' | 'stream';
  text: string;
  timestamp: number;
}

interface ActionSidebarCompactProps {
  machineId: string;
}

// ─────────────────────────────────────────────────────────────
// Route type → color
// ─────────────────────────────────────────────────────────────

const ROUTE_COLORS: Record<string, string> = {
  search:  'rgba(56,189,248,0.80)',   // sky
  write:   'rgba(167,139,250,0.80)',  // violet
  browse:  'rgba(52,211,153,0.80)',   // emerald
  memory:  'rgba(251,191,36,0.80)',   // amber
  plan:    'rgba(129,140,248,0.80)',  // indigo
  chat:    'rgba(255,255,255,0.50)',  // neutral
};

// ─────────────────────────────────────────────────────────────
// Memory type badge colors
// ─────────────────────────────────────────────────────────────

const MEMORY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  general:  { bg: 'rgba(255,255,255,0.06)',  text: 'rgba(255,255,255,0.40)' },
  user:     { bg: 'rgba(56,189,248,0.10)',   text: 'rgba(56,189,248,0.70)' },
  campaign: { bg: 'rgba(167,139,250,0.10)',  text: 'rgba(167,139,250,0.70)' },
  research: { bg: 'rgba(52,211,153,0.10)',   text: 'rgba(52,211,153,0.70)' },
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function LogIcon({ type }: { type: LogEntry['type'] }) {
  const common = {
    width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'click':
      return <svg {...common}><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="12" r="8.5" /></svg>;
    case 'type':
      return <svg {...common}><path d="M5 8h14M5 12h14M5 16h10" /></svg>;
    case 'navigate':
      return <IconFinderReal size={10} />;
    case 'think':
      return <svg {...common}><circle cx="12" cy="7" r="1.5" /><circle cx="7.5" cy="16" r="1" /><circle cx="16.5" cy="16" r="1" /></svg>;
    case 'action':
      return <svg {...common}><path d="M12 2v20M2 12h20" /></svg>;
    case 'result':
      return <svg {...common}><polyline points="19 6 9 16 5 12" /></svg>;
    case 'route':
      return <svg {...common}><path d="M5 12h14M12 5l7 7-7 7" /></svg>;
    case 'stream':
      return <svg {...common}><circle cx="12" cy="12" r="1" /><circle cx="6" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></svg>;
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function ActionSidebarCompact({ machineId: _machineId }: ActionSidebarCompactProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [isRouting, setIsRouting] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Live memories from store (last 3)
  const memories = useMemories();
  const recentMemories = memories.slice(0, 3);

  // ── Log helpers ──

  const addLog = useCallback((type: LogEntry['type'], text: string): number => {
    const id = ++logIdRef.current;
    setLogs(prev => [...prev, { id, type, text, timestamp: Date.now() }]);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 0);
    return id;
  }, []);

  const updateLog = useCallback((id: number, text: string) => {
    setLogs(prev => prev.map(e => e.id === id ? { ...e, text } : e));
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 0);
  }, []);

  // ── Send instruction ──

  const handleSendInstruction = useCallback(async () => {
    const text = input.trim();
    if (!text || isRouting) return;

    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsRouting(true);

    // Log the raw instruction
    addLog('action', `→ ${text}`);

    // Abort any previous streaming chat
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      // Route the instruction
      const route = await routeInstruction(text);

      // Log the route type
      const routeColor = ROUTE_COLORS[route.type] || ROUTE_COLORS.chat;
      addLog('route', `[${route.type}] ${text}`);

      // Handle each route type
      switch (route.type) {
        case 'memory': {
          addMemory('general', text);
          addLog('result', 'Saved to memory.');
          break;
        }

        case 'chat': {
          // Stream GLM-4.7 response (qwen3.5:9b is the production equivalent)
          const streamId = addLog('stream', '...');
          let accumulated = '';

          await ollamaService.generateStream(
            text,
            'You are a helpful AI agent assistant in a marketing creative system called Nomad. Answer concisely.',
            {
              model: getChatModel(),
              temperature: 0.7,
              num_predict: 512,
              signal: abortRef.current.signal,
              onChunk: (chunk) => {
                accumulated += chunk;
                updateLog(streamId, accumulated);
              },
            }
          );
          break;
        }

        case 'search': {
          addLog('think', `Searching: ${text}...`);
          addLog('result', 'Search routed — connect Wayfarer to execute.');
          break;
        }

        case 'write': {
          addLog('result', 'Canvas opened — open the Canvas dock icon to write.');
          break;
        }

        case 'browse': {
          addLog('navigate', `Navigating: ${text}`);
          addLog('result', 'Browse routed — open Chrome from dock to navigate.');
          break;
        }

        case 'plan': {
          addLog('think', 'Building plan...');
          // Stream a plan from the chat model
          const planId = addLog('stream', '...');
          let planText = '';

          await ollamaService.generateStream(
            `Create a concise numbered action plan for: ${text}`,
            'You are a strategic planning assistant. Output a clear numbered plan. Be concise.',
            {
              model: getChatModel(),
              temperature: 0.6,
              num_predict: 400,
              signal: abortRef.current.signal,
              onChunk: (chunk) => {
                planText += chunk;
                updateLog(planId, planText);
              },
            }
          );
          break;
        }

        default: {
          addLog('result', `Routed as ${route.type}.`);
        }
      }

      // Suppress unused variable warning
      void routeColor;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      addLog('result', `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRouting(false);
    }
  }, [input, isRouting, addLog, updateLog]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 60) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInstruction();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div
      className="w-[242px] shrink-0 flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(15,15,20,0.85) 0%, rgba(10,12,18,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* ── Header ── */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white/[0.55] uppercase tracking-widest">Agent Log</span>
        {isRouting && (
          <span className="text-[9px] text-white/[0.30] animate-pulse">routing...</span>
        )}
      </div>

      {/* ── Execution log (scrollable) ── */}
      <div className="flex-1 relative min-h-0 overflow-hidden flex flex-col">
        {/* Top blur */}
        <div className="absolute top-0 left-0 right-0 h-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(12,12,18,0.95), transparent)' }}
        />

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1" ref={scrollRef}>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/[0.12]">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="text-[9px] text-white/[0.15]">No activity yet</span>
            </div>
          ) : (
            <AnimatePresence>
              {logs.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex gap-2 items-start text-[10px] group"
                  data-role="agent-log-entry"
                  data-entry-type={entry.type}
                >
                  <div className="text-white/[0.25] shrink-0 mt-0.5">
                    <LogIcon type={entry.type} />
                  </div>
                  <div
                    className="flex-1 leading-snug break-words"
                    style={{
                      color: entry.type === 'route'
                        ? ROUTE_COLORS[entry.text.match(/^\[(\w+)\]/)?.[1] || 'chat']
                        : 'rgba(255,255,255,0.50)',
                      fontFamily: entry.type === 'stream' ? "'JetBrains Mono', monospace" : undefined,
                      fontSize: entry.type === 'stream' ? 9 : undefined,
                    }}
                  >
                    {entry.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Bottom blur */}
        <div className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, rgba(12,12,18,0.95), transparent)' }}
        />
      </div>

      {/* ── Memory section ── */}
      <div className="border-t border-white/[0.05]">
        {/* Memory header toggle */}
        <button
          onClick={() => setIsMemoryOpen(prev => !prev)}
          className="w-full px-3.5 py-2 flex items-center justify-between transition-colors hover:bg-white/[0.02]"
        >
          <span className="text-[9px] font-semibold text-white/[0.30] uppercase tracking-widest">Memory</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/[0.20]">{memories.length}</span>
            <svg
              width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-white/[0.25] transition-transform"
              style={{ transform: isMemoryOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        <AnimatePresence>
          {isMemoryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-2.5 pb-2 space-y-1">
                {recentMemories.length === 0 ? (
                  <div className="text-center py-3 text-[9px] text-white/[0.20]">No memories yet</div>
                ) : (
                  recentMemories.map(mem => {
                    const isExpanded = expandedMemoryId === mem.id;
                    const colors = MEMORY_TYPE_COLORS[mem.type] || MEMORY_TYPE_COLORS.general;
                    return (
                      <div
                        key={mem.id}
                        className="rounded-md px-2 py-1.5 cursor-pointer group/mem transition-colors"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                        onClick={() => setExpandedMemoryId(isExpanded ? null : mem.id)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Type badge */}
                            <span
                              className="shrink-0 text-[8px] font-semibold rounded px-1 py-0.5 uppercase tracking-wide"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {mem.type}
                            </span>
                            <span className="text-[9px] text-white/[0.20] shrink-0">
                              {formatMemoryAge(mem.createdAt)}
                            </span>
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={e => { e.stopPropagation(); deleteMemory(mem.id); }}
                            className="shrink-0 opacity-0 group-hover/mem:opacity-100 transition-opacity text-white/[0.30] hover:text-white/[0.60]"
                            title="Delete memory"
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <div
                          className="mt-1 text-[9px] text-white/[0.45] leading-snug"
                          style={{
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: isExpanded ? 999 : 2,
                            WebkitBoxOrient: 'vertical' as const,
                          } as React.CSSProperties}
                        >
                          {mem.content}
                        </div>
                        {mem.tags.length > 0 && isExpanded && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {mem.tags.map(tag => (
                              <span key={tag} className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Instruction input ── */}
      <div className="px-3 py-3 border-t border-white/[0.06] flex flex-col gap-1.5">
        {/* Label */}
        <div className="text-[9px] text-white/[0.30] select-none">
          ↓ Give the AI an instruction
        </div>
        {/* Input row */}
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Search for collagen supplement reviews..."
            disabled={isRouting}
            className="flex-1 px-2.5 py-2 rounded-lg text-[11px] bg-white/[0.04] text-white/[0.80] placeholder-white/[0.20] border border-white/[0.06] focus:border-white/[0.12] focus:outline-none focus:bg-white/[0.06] resize-none transition-all"
            style={{
              minHeight: '32px',
              maxHeight: '60px',
              backdropFilter: 'blur(8px)',
              opacity: isRouting ? 0.5 : 1,
            }}
            data-role="instruction-input"
            aria-label="Instruction input — type a command for the AI agent"
          />
          <button
            onClick={handleSendInstruction}
            disabled={!input.trim() || isRouting}
            data-role="send-button"
            aria-label="Send instruction to AI agent"
            title="Send instruction"
            className="shrink-0 flex items-center justify-center rounded-lg transition-all"
            style={{
              width: 32,
              height: 32,
              background: input.trim() && !isRouting
                ? 'rgba(43,121,255,0.18)'
                : 'rgba(255,255,255,0.04)',
              border: input.trim() && !isRouting
                ? '1px solid rgba(43,121,255,0.30)'
                : '1px solid rgba(255,255,255,0.07)',
              color: input.trim() && !isRouting
                ? 'rgba(43,121,255,0.9)'
                : 'rgba(255,255,255,0.20)',
              cursor: input.trim() && !isRouting ? 'pointer' : 'default',
              backdropFilter: 'blur(8px)',
            }}
          >
            {isRouting ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
                <span style={{
                  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
                }}>SEND</span>
              </>
            )}
          </button>
        </div>
        <div className="text-[9px] text-white/[0.20]">
          {input.trim() ? 'Enter to send · Shift+Enter for newline' : 'Shift+Enter for newline'}
        </div>
      </div>
    </div>
  );
}
