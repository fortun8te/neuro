import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useTheme } from '../context/ThemeContext';
import type { Cycle, StageName, Campaign } from '../types';
import { ChevronDown, ChevronRight, Copy, Search, X, Command, Pause, Play, SkipForward, Download, Settings } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// ██ LOG ENTRY TYPES & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface LogEntry {
  id: string;
  level: LogLevel;
  timestamp: number;
  message: string;
  details?: string;
  expanded?: boolean;
}

interface MetricsSnapshot {
  sourcesFound: number;
  sourceTarget: number;
  coverage: number;
  quality: number;
  tokensUsed: number;
  tokenBudget: number;
  elapsedSeconds: number;
}

interface StageMetrics {
  stage: StageName;
  status: 'pending' | 'in-progress' | 'complete' | 'error' | 'stopped';
  tokensUsed: number;
  duration: number;
  qualityScore: number;
  progress: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ TERMINAL HEADER
// ═══════════════════════════════════════════════════════════════════════════

function TerminalHeader({
  campaign,
  currentStage,
  elapsedSeconds,
  status,
  tokensUsed,
  tokenBudget,
  isDark,
}: {
  campaign: Campaign;
  currentStage: StageName;
  elapsedSeconds: number;
  status: 'running' | 'complete' | 'error' | 'paused';
  tokensUsed: number;
  tokenBudget: number;
  isDark: boolean;
}) {
  const statusIcon =
    status === 'running' ? '●' : status === 'complete' ? '✓' : status === 'error' ? '✗' : '⏸';
  const statusColor =
    status === 'running'
      ? '#22c55e'
      : status === 'complete'
        ? '#3b82f6'
        : status === 'error'
          ? '#ef4444'
          : '#f59e0b';

  const tokenPercent = Math.min((tokensUsed / tokenBudget) * 100, 100);
  const tokenColor =
    tokenPercent < 60 ? '#22c55e' : tokenPercent < 80 ? '#f59e0b' : '#ef4444';

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div
      className={`flex-shrink-0 border-b px-6 py-4 ${
        isDark ? 'bg-zinc-950/50 border-white/[0.08]' : 'bg-white/30 border-black/[0.08]'
      }`}
    >
      <div className="flex items-center justify-between gap-6">
        {/* Left: Campaign + Stage */}
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-1">Campaign</div>
          <div className="text-sm font-mono truncate">{(campaign as any).name || 'Untitled'}</div>
          <div className="text-xs opacity-50 mt-1">
            Stage: <span className="font-mono">{currentStage}</span>
          </div>
        </div>

        {/* Center: Status + Time */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span style={{ color: statusColor, fontSize: '14px' }}>{statusIcon}</span>
            <span className="text-xs uppercase font-semibold" style={{ color: statusColor }}>
              {status}
            </span>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest opacity-60">Elapsed</div>
            <div className="text-sm font-mono">{formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        {/* Right: Token Bar */}
        <div className="flex-1 max-w-xs">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-1">Token Budget</div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-2 rounded-full overflow-hidden"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${tokenPercent}%`,
                  backgroundColor: tokenColor,
                  boxShadow: `0 0 8px ${tokenColor}60`,
                }}
              />
            </div>
            <span className="text-xs font-mono whitespace-nowrap">
              {tokensUsed.toLocaleString()}/{tokenBudget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ STAGE PANEL (CLICKABLE STAGES)
// ═══════════════════════════════════════════════════════════════════════════

function StagePanelComponent({
  metrics,
  currentStage,
  onSelectStage,
  isDark,
}: {
  metrics: StageMetrics[];
  currentStage: StageName;
  onSelectStage: (stage: StageName) => void;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex-shrink-0 border-b px-6 py-4 ${
        isDark ? 'bg-zinc-950/30 border-white/[0.08]' : 'bg-white/20 border-black/[0.08]'
      }`}
    >
      <div className="text-xs uppercase tracking-widest opacity-60 mb-3">Pipeline Stages</div>
      <div className="space-y-2">
        {metrics.map((m) => {
          const isActive = m.stage === currentStage;
          const barColor =
            m.status === 'complete'
              ? '#3b82f6'
              : m.status === 'in-progress'
                ? '#22c55e'
                : m.status === 'error'
                  ? '#ef4444'
                  : 'rgba(255, 255, 255, 0.2)';

          return (
            <button
              key={m.stage}
              onClick={() => onSelectStage(m.stage)}
              className={`w-full text-left p-2 rounded text-xs transition-colors ${
                isActive
                  ? isDark
                    ? 'bg-white/[0.08]'
                    : 'bg-black/[0.08]'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-semibold">{m.stage}</span>
                <span className="opacity-60">{m.tokensUsed} tokens</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    className="h-full transition-all"
                    style={{ width: `${m.progress}%`, backgroundColor: barColor }}
                  />
                </div>
                <span className="opacity-60 w-8 text-right">{m.progress}%</span>
              </div>
              <div className="flex justify-between mt-1 text-xs opacity-50">
                <span>{Math.round(m.duration)}s</span>
                <span>Q: {m.qualityScore.toFixed(1)}/10</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ METRICS BAR
// ═══════════════════════════════════════════════════════════════════════════

function MetricsBar({
  metrics,
  isDark,
}: {
  metrics: MetricsSnapshot;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex-shrink-0 border-b px-6 py-3 ${
        isDark ? 'bg-zinc-950/30 border-white/[0.08]' : 'bg-white/20 border-black/[0.08]'
      }`}
    >
      <div className="grid grid-cols-5 gap-6 text-xs">
        <div>
          <div className="uppercase tracking-widest opacity-60 mb-1">Sources</div>
          <div className="text-sm font-mono">
            {metrics.sourcesFound}/{metrics.sourceTarget}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-widest opacity-60 mb-1">Coverage</div>
          <div className="text-sm font-mono">{metrics.coverage}%</div>
        </div>
        <div>
          <div className="uppercase tracking-widest opacity-60 mb-1">Quality</div>
          <div className="text-sm font-mono">{metrics.quality.toFixed(1)}/10</div>
        </div>
        <div>
          <div className="uppercase tracking-widest opacity-60 mb-1">Token Budget</div>
          <div className="text-sm font-mono">
            {metrics.tokensUsed.toLocaleString()}/{metrics.tokenBudget.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-widest opacity-60 mb-1">Elapsed</div>
          <div className="text-sm font-mono">
            {Math.floor(metrics.elapsedSeconds / 60)}m {metrics.elapsedSeconds % 60}s
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ LOG VIEWER (SEARCHABLE, EXPANDABLE)
// ═══════════════════════════════════════════════════════════════════════════

function LogViewer({
  logs,
  isDark,
}: {
  logs: LogEntry[];
  isDark: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter(
    (log) =>
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'info':
        return '#3b82f6';
      case 'success':
        return '#22c55e';
      case 'warn':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      case 'debug':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 border-t ${
        isDark ? 'bg-zinc-950/40 border-white/[0.08]' : 'bg-white/10 border-black/[0.08]'
      }`}
    >
      {/* Search Bar */}
      <div className={`flex-shrink-0 border-b px-6 py-3 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded ${isDark ? 'bg-white/[0.05]' : 'bg-black/[0.05]'}`}>
          <Search size={14} className="opacity-50" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 bg-transparent text-xs outline-none placeholder:opacity-50 ${
              isDark ? 'text-white' : 'text-black'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-xs opacity-40 py-8">
            {searchQuery ? 'No logs match your search' : 'Waiting for output...'}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            const levelColor = getLevelColor(log.level);
            const timestamp = new Date(log.timestamp).toLocaleTimeString();

            return (
              <div key={log.id} className={isDark ? 'text-white/[0.87]' : 'text-black/[0.87]'}>
                <div
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.05]'
                  }`}
                  onClick={() => log.details && toggleExpand(log.id)}
                >
                  {log.details ? (
                    <ChevronRight
                      size={14}
                      className={`flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      style={{ color: levelColor }}
                    />
                  ) : (
                    <div className="w-3.5 flex items-center justify-center text-xs">•</div>
                  )}
                  <span style={{ color: levelColor }} className="font-semibold">
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="opacity-50">{timestamp}</span>
                  <span className="flex-1">{log.message}</span>
                  {log.message.length > 10 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(log.message);
                      }}
                      className="opacity-30 hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
                {isExpanded && log.details && (
                  <div
                    className={`ml-6 p-2 rounded text-xs ${
                      isDark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap break-words opacity-70">{log.details}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════════════════

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
  isDark: boolean;
  isRunning: boolean;
}

function CommandPalette({ isOpen, onClose, onCommand, isDark, isRunning }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const commands = [
    { name: 'Pause Cycle', key: 'pause', icon: Pause, disabled: !isRunning },
    { name: 'Resume Cycle', key: 'resume', icon: Play, disabled: isRunning },
    { name: 'Skip Stage', key: 'skip', icon: SkipForward, disabled: !isRunning },
    { name: 'Abort Cycle', key: 'abort', icon: X, disabled: false },
    { name: 'Export Report', key: 'export', icon: Download, disabled: false },
    { name: 'Open Settings', key: 'settings', icon: Settings, disabled: false },
  ];

  const filtered = commands.filter(
    (cmd) =>
      !cmd.disabled &&
      (cmd.name.toLowerCase().includes(query.toLowerCase()) || cmd.key.includes(query))
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-96 rounded-lg shadow-2xl overflow-hidden ${
          isDark ? 'bg-zinc-900 border border-white/[0.08]' : 'bg-white border border-black/[0.08]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div
          className={`border-b px-4 py-3 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}
        >
          <div className="flex items-center gap-2">
            <Command size={16} className="opacity-50" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type command or press ESC..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`flex-1 bg-transparent outline-none text-sm ${
                isDark ? 'text-white placeholder:opacity-30' : 'text-black placeholder:opacity-40'
              }`}
            />
          </div>
        </div>

        {/* Commands */}
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs opacity-50">No commands found</div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.key}
                onClick={() => {
                  onCommand(cmd.key);
                  onClose();
                }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                  isDark
                    ? 'hover:bg-white/[0.05] border-b border-white/[0.04]'
                    : 'hover:bg-black/[0.05] border-b border-black/[0.04]'
                }`}
              >
                <cmd.icon size={16} className="opacity-60" />
                <span>{cmd.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Shortcuts */}
        <div
          className={`px-4 py-2 text-xs opacity-50 border-t ${
            isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-black/[0.08] bg-black/[0.02]'
          }`}
        >
          Shortcuts: Cmd+P (pause) • Cmd+S (skip) • Cmd+E (export)
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ STUCK DETECTION PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface StuckDetectionProps {
  stageStartedAt: number | null;
  currentStage: StageName;
  tokensUsed: number;
  tokenBudget: number;
  ollamaHealthy: boolean;
  isDark: boolean;
  onAction: (action: 'skip' | 'pause' | 'restart') => void;
}

function StuckDetectionPanel({
  stageStartedAt,
  currentStage,
  tokensUsed,
  tokenBudget,
  ollamaHealthy,
  isDark,
  onAction,
}: StuckDetectionProps) {
  const now = Date.now();
  const stageElapsed = stageStartedAt ? (now - stageStartedAt) / 1000 : 0;
  const tokenPercent = (tokensUsed / tokenBudget) * 100;

  let stuckReason: { title: string; message: string; severity: 'info' | 'warn' | 'error' } | null =
    null;

  if (stageElapsed > 300 && stageElapsed < 600) {
    stuckReason = {
      title: 'Stuck Detection',
      message: `${currentStage} has been running for ${Math.round(stageElapsed / 60)}m. Consider skipping or restarting.`,
      severity: 'warn',
    };
  }

  if (stageElapsed > 600) {
    stuckReason = {
      title: 'Stuck - Long Running',
      message: `${currentStage} exceeded 10 minutes. Recommend abort or skip.`,
      severity: 'error',
    };
  }

  if (tokenPercent > 90) {
    stuckReason = {
      title: 'Token Budget Critical',
      message: `Using ${tokenPercent.toFixed(0)}% of budget. Compress context or skip remaining stages.`,
      severity: 'error',
    };
  }

  if (!ollamaHealthy) {
    stuckReason = {
      title: 'Service Offline',
      message: 'Ollama unreachable. Check connection or pause cycle.',
      severity: 'error',
    };
  }

  if (!stuckReason) return null;

  const bgColor =
    stuckReason.severity === 'error'
      ? isDark
        ? 'bg-red-950/20'
        : 'bg-red-50'
      : isDark
        ? 'bg-amber-950/20'
        : 'bg-amber-50';

  const borderColor =
    stuckReason.severity === 'error'
      ? isDark
        ? 'border-red-900/30'
        : 'border-red-100'
      : isDark
        ? 'border-amber-900/30'
        : 'border-amber-100';

  const textColor =
    stuckReason.severity === 'error'
      ? isDark
        ? 'text-red-400'
        : 'text-red-600'
      : isDark
        ? 'text-amber-400'
        : 'text-amber-600';

  return (
    <div className={`flex-shrink-0 border-b px-6 py-4 ${bgColor} border-t ${borderColor}`}>
      <div className={`flex items-start justify-between gap-4`}>
        <div>
          <div className={`font-semibold text-sm mb-1 ${textColor}`}>
            {stuckReason.severity === 'error' ? '⚠ ' : '⚡ '}
            {stuckReason.title}
          </div>
          <div className={`text-xs opacity-70 ${textColor}`}>{stuckReason.message}</div>
        </div>
        <div className="flex items-center gap-2">
          {stuckReason.severity === 'error' && (
            <>
              <button
                onClick={() => onAction('skip')}
                className={`px-3 py-1 text-xs rounded font-semibold transition-colors ${
                  isDark
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                Skip
              </button>
              <button
                onClick={() => onAction('restart')}
                className={`px-3 py-1 text-xs rounded font-semibold transition-colors ${
                  isDark
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                Restart
              </button>
            </>
          )}
          {stuckReason.severity === 'warn' && (
            <button
              onClick={() => onAction('skip')}
              className={`px-3 py-1 text-xs rounded font-semibold transition-colors ${
                isDark
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
              }`}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ MAIN NEURO TERMINAL UI
// ═══════════════════════════════════════════════════════════════════════════

export interface NeuroTerminalUIProps {
  cycle: Cycle;
  campaign: Campaign;
  isRunning: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onSkipStage?: () => void;
  onAbortCycle?: () => void;
  onExport?: () => void;
}

export function NeuroTerminalUI({
  cycle,
  campaign,
  isRunning,
  onPause,
  onResume,
  onSkipStage,
  onAbortCycle,
  onExport,
}: NeuroTerminalUIProps) {
  const { isDarkMode } = useTheme();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedStage, setSelectedStage] = useState<StageName>('research');
  const [ollamaHealthy, setOllamaHealthy] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const logsRef = useRef(logs);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'k') {
          e.preventDefault();
          setCommandPaletteOpen(!commandPaletteOpen);
        }
        if (e.key === 'p') {
          e.preventDefault();
          isRunning ? onPause?.() : onResume?.();
        }
        if (e.key === 's') {
          e.preventDefault();
          onSkipStage?.();
        }
        if (e.key === 'e') {
          e.preventDefault();
          onExport?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, onPause, onResume, onSkipStage, onExport, commandPaletteOpen]);

  // Elapsed time timer
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Ollama health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://100.74.135.83:11440/api/tags', {
          signal: AbortSignal.timeout(3000),
        });
        setOllamaHealthy(response.ok);
      } catch {
        setOllamaHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Mock stage metrics from cycle
  const stageMetrics: StageMetrics[] = [
    'research',
    'brand-dna',
    'persona-dna',
    'angles',
    'strategy',
    'copywriting',
    'production',
    'test',
  ].map((stage) => {
    const stageData = cycle.stages[stage as StageName];
    const isComplete = stageData.status === 'complete';
    const isActive = stage === cycle.currentStage;

    return {
      stage: stage as StageName,
      status: stageData.status,
      tokensUsed: Math.floor(Math.random() * 5000),
      duration: stageData.completedAt && stageData.startedAt ? (stageData.completedAt - stageData.startedAt) / 1000 : 0,
      qualityScore: isComplete ? 7 + Math.random() * 3 : isActive ? 6 + Math.random() : 0,
      progress: isComplete ? 100 : isActive ? Math.floor(Math.random() * 80) : 0,
    };
  });

  const metrics: MetricsSnapshot = {
    sourcesFound: Math.floor(Math.random() * 150) + 50,
    sourceTarget: 200,
    coverage: Math.floor(Math.random() * 40) + 60,
    quality: 7.8,
    tokensUsed: 45000,
    tokenBudget: 75000,
    elapsedSeconds,
  };

  const handleCommand = (command: string) => {
    switch (command) {
      case 'pause':
        onPause?.();
        break;
      case 'resume':
        onResume?.();
        break;
      case 'skip':
        onSkipStage?.();
        break;
      case 'abort':
        onAbortCycle?.();
        break;
      case 'export':
        onExport?.();
        break;
      case 'settings':
        // Open settings modal (to be wired into App)
        break;
    }
  };

  const handleStuckAction = (action: 'skip' | 'pause' | 'restart') => {
    if (action === 'skip') onSkipStage?.();
    if (action === 'pause') onPause?.();
    if (action === 'restart') {
      onPause?.();
      setTimeout(() => onResume?.(), 500);
    }
  };

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden ${
        isDarkMode ? 'bg-zinc-950 text-white/[0.87]' : 'bg-white text-zinc-900'
      }`}
    >
      <TerminalHeader
        campaign={campaign}
        currentStage={cycle.currentStage}
        elapsedSeconds={elapsedSeconds}
        status={isRunning ? 'running' : cycle.status === 'complete' ? 'complete' : 'paused'}
        tokensUsed={metrics.tokensUsed}
        tokenBudget={metrics.tokenBudget}
        isDark={isDarkMode}
      />

      <StagePanelComponent
        metrics={stageMetrics}
        currentStage={cycle.currentStage}
        onSelectStage={setSelectedStage}
        isDark={isDarkMode}
      />

      <MetricsBar metrics={metrics} isDark={isDarkMode} />

      {/* Stuck Detection */}
      {isRunning && (
        <StuckDetectionPanel
          stageStartedAt={cycle.stages[cycle.currentStage]?.startedAt}
          currentStage={cycle.currentStage}
          tokensUsed={metrics.tokensUsed}
          tokenBudget={metrics.tokenBudget}
          ollamaHealthy={ollamaHealthy}
          isDark={isDarkMode}
          onAction={handleStuckAction}
        />
      )}

      {/* Log Viewer */}
      <LogViewer logs={logs} isDark={isDarkMode} />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={handleCommand}
        isDark={isDarkMode}
        isRunning={isRunning}
      />

      {/* Footer Shortcuts */}
      <div
        className={`flex-shrink-0 border-t px-6 py-3 text-xs opacity-60 ${
          isDarkMode ? 'bg-zinc-950/50 border-white/[0.08]' : 'bg-white/30 border-black/[0.08]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="space-x-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.1]">Cmd+K</kbd> Command Palette
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.1]">Cmd+P</kbd> Pause/Resume
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.1]">Cmd+S</kbd> Skip Stage
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.1]">Cmd+E</kbd> Export
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ollamaHealthy ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Services OK</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Ollama Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
