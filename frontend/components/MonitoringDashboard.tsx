/**
 * MonitoringDashboard — Real-Time System Monitor
 *
 * - Model Cards Row: per-model status, tasks, VRAM, response time
 * - Global Metrics Row: active tasks gauge, RPM sparkline, error rate, VRAM total
 * - Live Task Feed: scrolling list of recent tasks
 * - Circuit Breaker Status: per-model circuit state
 */

import { useMemo, useRef, useEffect } from 'react';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { useTheme } from '../context/ThemeContext';
import type { ModelStatus, TaskEvent, RpmPoint } from '../types/monitoring';
import { FONT_FAMILY } from '../constants/ui';

// ── Helpers ─────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatMs(ms: number): string {
  if (ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb}MB`;
}

function getModelSizeBadge(modelName: string): string {
  const m = modelName.match(/([\d.]+)b/i);
  if (m) return `${m[1]}B`;
  if (modelName.includes('20b') || modelName.includes('gpt-oss')) return '20B';
  return '?';
}

function getStageBadgeColor(stage: string, isDark: boolean): { bg: string; text: string } {
  if (stage.includes('research')) return { bg: isDark ? 'rgba(20,184,166,0.15)' : 'rgba(20,184,166,0.1)', text: '#14b8a6' };
  if (stage.includes('make') || stage.includes('production')) return { bg: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', text: '#a855f7' };
  if (stage.includes('test')) return { bg: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)', text: '#f59e0b' };
  return { bg: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.08)', text: isDark ? '#94a3b8' : '#64748b' };
}

function getStatusColor(status: ModelStatus['status']): string {
  switch (status) {
    case 'idle': return '#22c55e';
    case 'busy': return '#f59e0b';
    case 'overloaded': return '#ef4444';
    case 'offline': return '#6b7280';
  }
}

function getCircuitColor(state: ModelStatus['circuitState']): string {
  switch (state) {
    case 'closed': return '#22c55e';
    case 'half-open': return '#f59e0b';
    case 'open': return '#ef4444';
  }
}

function getVramColor(usedMB: number, totalMB: number): string {
  const pct = usedMB / totalMB;
  if (pct < 0.6) return '#22c55e';
  if (pct < 0.8) return '#f59e0b';
  return '#ef4444';
}

// ── Sparkline (canvas) ──────────────────────────────────────────

function Sparkline({ points, isDark }: { points: RpmPoint[]; isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (points.length < 2) return;

    const maxVal = Math.max(...points.map(p => p.count), 1);
    const step = w / (points.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = isDark ? '#3b82f6' : '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    points.forEach((p, i) => {
      const x = i * step;
      const y = h - (p.count / maxVal) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under line
    ctx.lineTo((points.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, isDark ? 'rgba(59,130,246,0.25)' : 'rgba(37,99,235,0.15)');
    gradient.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [points, isDark]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={32}
      style={{ display: 'block', width: '100%', height: 32 }}
    />
  );
}

// ── Progress Bar ────────────────────────────────────────────────

function ProgressBar({
  value, max, color, height = 4,
}: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{
      width: '100%', height, borderRadius: height,
      background: 'rgba(128,128,128,0.15)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: color,
        borderRadius: height,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ── Circular Gauge ──────────────────────────────────────────────

function CircularGauge({
  value, max, label, sublabel, color, size = 80,
}: {
  value: number; max: number; label: string; sublabel?: string;
  color: string; size?: number;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="rgba(128,128,128,0.15)" strokeWidth={5} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={5}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1, fontFamily: FONT_FAMILY }}>
            {value}
          </span>
          {sublabel && (
            <span style={{ fontSize: 9, opacity: 0.45, fontFamily: FONT_FAMILY }}>{sublabel}</span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 10, opacity: 0.5, fontFamily: FONT_FAMILY }}>{label}</span>
    </div>
  );
}

// ── Model Card ──────────────────────────────────────────────────

function ModelCard({ model, isDark }: { model: ModelStatus; isDark: boolean }) {
  const statusColor = getStatusColor(model.status);
  const vramColor = getVramColor(model.vramEstimate, 40 * 1024);
  const taskPct = model.maxConcurrent > 0 ? model.activeTasks / model.maxConcurrent : 0;
  const taskBarColor = taskPct >= 1 ? '#ef4444' : taskPct >= 0.75 ? '#f59e0b' : '#22c55e';
  const sizeBadge = getModelSizeBadge(model.modelName);

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
      minWidth: 160,
      flex: '1 1 160px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {/* Status dot */}
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 5px ${statusColor}60`,
            flexShrink: 0,
          }} />
          {/* Model name */}
          <span style={{
            fontSize: 11, fontWeight: 600, fontFamily: FONT_FAMILY,
            color: isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.75)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {model.modelName.replace(/^qwen3\.5:/, 'Qwen ')}
          </span>
        </div>
        {/* Size badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          fontFamily: FONT_FAMILY, flexShrink: 0,
        }}>
          {sizeBadge}
        </span>
      </div>

      {/* Tasks bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, opacity: 0.4, fontFamily: FONT_FAMILY }}>Tasks</span>
          <span style={{ fontSize: 9, fontWeight: 600, fontFamily: FONT_FAMILY, opacity: 0.65 }}>
            {model.activeTasks}/{model.maxConcurrent}
          </span>
        </div>
        <ProgressBar value={model.activeTasks} max={model.maxConcurrent} color={taskBarColor} height={4} />
      </div>

      {/* VRAM */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, opacity: 0.4, fontFamily: FONT_FAMILY }}>VRAM est.</span>
          <span style={{ fontSize: 9, fontWeight: 600, fontFamily: FONT_FAMILY, color: vramColor }}>
            {formatMB(model.vramEstimate)}
          </span>
        </div>
        <ProgressBar value={model.vramEstimate} max={40 * 1024} color={vramColor} height={3} />
      </div>

      {/* Bottom stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 8, opacity: 0.35, fontFamily: FONT_FAMILY }}>Avg resp</div>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT_FAMILY, opacity: 0.65 }}>
            {formatMs(model.avgResponseTime)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, opacity: 0.35, fontFamily: FONT_FAMILY }}>Success</div>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT_FAMILY,
            color: model.successRate >= 0.95 ? '#22c55e' : model.successRate >= 0.8 ? '#f59e0b' : '#ef4444',
          }}>
            {Math.round(model.successRate * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live Task Row ───────────────────────────────────────────────

function TaskRow({ task, isDark }: { task: TaskEvent; isDark: boolean }) {
  const elapsed = task.endTime
    ? task.durationMs ?? (task.endTime - task.startTime)
    : Date.now() - task.startTime;
  const stageColors = getStageBadgeColor(task.stage, isDark);
  const statusDot = task.status === 'running' ? '#3b82f6' : task.status === 'completed' ? '#22c55e' : '#ef4444';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: statusDot, flexShrink: 0,
        boxShadow: task.status === 'running' ? `0 0 4px ${statusDot}80` : undefined,
      }} />
      <span style={{
        fontSize: 10, fontFamily: FONT_FAMILY, opacity: 0.5,
        width: 70, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {task.modelName.replace(/^qwen3\.5:/, 'Qwen ')}
      </span>
      <span style={{
        fontSize: 9, padding: '1px 5px', borderRadius: 3,
        background: stageColors.bg, color: stageColors.text,
        fontFamily: FONT_FAMILY, fontWeight: 600,
        flexShrink: 0,
      }}>
        {task.stage}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 9, opacity: 0.4, fontFamily: FONT_FAMILY, flexShrink: 0 }}>
        {formatMs(elapsed)}
      </span>
    </div>
  );
}

// ── Circuit Breaker Panel ───────────────────────────────────────

function CircuitBreakerPanel({ models, isDark }: { models: ModelStatus[]; isDark: boolean }) {
  const relevant = models.filter(m => m.circuitState !== 'closed' || m.errorCount > 0);
  if (relevant.length === 0) {
    return (
      <div style={{ padding: '12px', textAlign: 'center', opacity: 0.35, fontSize: 11, fontFamily: FONT_FAMILY }}>
        All circuits closed
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {relevant.map(m => {
        const circuitColor = getCircuitColor(m.circuitState);
        return (
          <div key={m.modelName} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: circuitColor, flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 600, fontFamily: FONT_FAMILY, flex: 1,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
            }}>
              {m.modelName.replace(/^qwen3\.5:/, 'Qwen ')}
            </span>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4,
              background: circuitColor + '22', color: circuitColor,
              fontFamily: FONT_FAMILY, fontWeight: 700, textTransform: 'uppercase',
            }}>
              {m.circuitState}
            </span>
            {m.errorCount > 0 && (
              <span style={{ fontSize: 9, opacity: 0.4, fontFamily: FONT_FAMILY }}>
                {m.errorCount} err
              </span>
            )}
            {m.recoveryCountdownMs && (
              <span style={{ fontSize: 9, opacity: 0.4, fontFamily: FONT_FAMILY }}>
                ~{Math.ceil(m.recoveryCountdownMs / 1000)}s
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────────

function SectionHeader({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', opacity: 0.35,
      fontFamily: FONT_FAMILY, marginBottom: 8,
      color: isDark ? '#fff' : '#000',
    }}>
      {title}
    </div>
  );
}

// ── Panel Container ─────────────────────────────────────────────

function Panel({ children, isDark, style }: {
  children: React.ReactNode; isDark: boolean; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────

export function MonitoringDashboard() {
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode;
  const { health, tasks, rpmPoints, isLoading, lastUpdated } = useSystemHealth();

  const activeTasks = useMemo(
    () => tasks.filter(t => t.status === 'running').sort((a, b) => b.startTime - a.startTime),
    [tasks]
  );
  const recentTasks = useMemo(
    () => tasks.filter(t => t.status !== 'running').sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0)).slice(0, 30),
    [tasks]
  );
  const feedTasks = useMemo(
    () => [...activeTasks, ...recentTasks].slice(0, 40),
    [activeTasks, recentTasks]
  );

  const vramPct = health.totalVramAvailableMB > 0
    ? health.totalVramUsedMB / health.totalVramAvailableMB
    : 0;
  const vramColor = vramPct < 0.6 ? '#22c55e' : vramPct < 0.8 ? '#f59e0b' : '#ef4444';

  const globalTaskColor = health.globalActiveTasks >= health.globalMaxTasks
    ? '#ef4444'
    : health.globalActiveTasks >= health.globalMaxTasks * 0.75
      ? '#f59e0b'
      : '#22c55e';

  const overallDotColor = health.overallStatus === 'healthy'
    ? '#22c55e' : health.overallStatus === 'degraded' ? '#f59e0b' : '#ef4444';

  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '20px 20px 32px',
      display: 'flex', flexDirection: 'column', gap: 16,
      fontFamily: FONT_FAMILY,
      color: isDark ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: overallDotColor,
            boxShadow: `0 0 6px ${overallDotColor}60`,
          }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>System Monitor</span>
          {isLoading && (
            <span style={{ fontSize: 10, opacity: 0.35 }}>loading...</span>
          )}
        </div>
        {lastUpdated && (
          <span style={{ fontSize: 10, opacity: 0.3 }}>
            uptime {formatUptime(health.uptimeMs)}
          </span>
        )}
      </div>

      {/* ── Global Metrics Row ── */}
      <Panel isDark={isDark}>
        <SectionHeader title="Global Metrics" isDark={isDark} />
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Active tasks gauge */}
          <CircularGauge
            value={health.globalActiveTasks}
            max={health.globalMaxTasks}
            label="Active Tasks"
            sublabel={`/${health.globalMaxTasks}`}
            color={globalTaskColor}
            size={80}
          />

          {/* VRAM gauge */}
          <CircularGauge
            value={Math.round(vramPct * 100)}
            max={100}
            label="VRAM %"
            sublabel={formatMB(health.totalVramUsedMB)}
            color={vramColor}
            size={80}
          />

          {/* RPM + sparkline */}
          <div style={{ flex: '1 1 120px', minWidth: 120 }}>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 9, opacity: 0.35 }}>Req/min (60s)</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{health.requestsPerMinute}</span>
            </div>
            <Sparkline points={rpmPoints} isDark={isDark} />
          </div>

          {/* Error rate */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
            <span style={{ fontSize: 9, opacity: 0.35 }}>Error Rate</span>
            <span style={{
              fontSize: 22, fontWeight: 700,
              color: health.errorRate === 0 ? '#22c55e' : health.errorRate < 0.1 ? '#f59e0b' : '#ef4444',
            }}>
              {(health.errorRate * 100).toFixed(1)}%
            </span>
            {health.errorRate > 0 && (
              <span style={{ fontSize: 9, opacity: 0.4 }}>
                {health.errorRate > 0.1 ? 'high' : 'elevated'}
              </span>
            )}
          </div>

          {/* VRAM absolute */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span style={{ fontSize: 9, opacity: 0.35, marginBottom: 2 }}>VRAM Used</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: vramColor }}>
              {formatMB(health.totalVramUsedMB)}
            </span>
            <span style={{ fontSize: 9, opacity: 0.35 }}>
              of {formatMB(health.totalVramAvailableMB)}
            </span>
            <ProgressBar value={health.totalVramUsedMB} max={health.totalVramAvailableMB} color={vramColor} height={4} />
          </div>
        </div>
      </Panel>

      {/* ── Model Cards ── */}
      <div>
        <SectionHeader title="Model Status" isDark={isDark} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {health.models.length === 0 ? (
            <div style={{ opacity: 0.35, fontSize: 12 }}>No models detected</div>
          ) : (
            health.models.map(m => (
              <ModelCard key={m.modelName} model={m} isDark={isDark} />
            ))
          )}
        </div>
      </div>

      {/* ── Bottom Row: Live Feed + Circuit Breakers ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Live Task Feed */}
        <Panel isDark={isDark} style={{ flex: '2 1 280px', minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SectionHeader title="Live Task Feed" isDark={isDark} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 9, opacity: 0.4 }}>
                {activeTasks.length} running
              </span>
            </div>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {feedTasks.length === 0 ? (
              <div style={{ opacity: 0.35, fontSize: 11, textAlign: 'center', padding: '16px 0' }}>
                No recent tasks
              </div>
            ) : (
              feedTasks.map(t => (
                <TaskRow key={t.id} task={t} isDark={isDark} />
              ))
            )}
          </div>
        </Panel>

        {/* Circuit Breaker Status */}
        <Panel isDark={isDark} style={{ flex: '1 1 200px', minWidth: 200 }}>
          <SectionHeader title="Circuit Breakers" isDark={isDark} />
          <CircuitBreakerPanel models={health.models} isDark={isDark} />
        </Panel>
      </div>

    </div>
  );
}

// ── Compact Header Badge ────────────────────────────────────────
// Used in the top bar to show a quick health indicator

export function SystemHealthBadge({ activeTasks, overallStatus }: {
  activeTasks: number;
  overallStatus: 'healthy' | 'degraded' | 'critical';
}) {
  const dotColor = overallStatus === 'healthy' ? '#22c55e'
    : overallStatus === 'degraded' ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 20,
      background: `${dotColor}15`,
      border: `1px solid ${dotColor}30`,
      cursor: 'default',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dotColor,
        boxShadow: overallStatus !== 'healthy' ? `0 0 4px ${dotColor}80` : undefined,
      }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: dotColor, fontFamily: FONT_FAMILY }}>
        {activeTasks > 0 ? `${activeTasks} tasks` : 'idle'}
      </span>
    </div>
  );
}
