/**
 * TaskScheduleView -- Vertical day timeline for scheduled tasks
 * Resembles a calendar day view with hour rows, colored task blocks, and a "now" line.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import type { ScheduledTask } from '../utils/taskScheduler';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const START_HOUR = 6;   // timeline begins at 6 AM
const END_HOUR = 24;    // timeline ends at midnight
const HOUR_HEIGHT = 44; // px per hour row
const TOTAL_HOURS = END_HOUR - START_HOUR;
const GUTTER_WIDTH = 48; // left axis width

const CATEGORY_COLORS: Record<string, string> = {
  research:    '#3b82f6',
  creative:    '#a855f7',
  analysis:    '#22c55e',
  maintenance: '#6b7280',
};

const PRIORITY_LABELS: Record<string, string> = {
  low:      'Low',
  normal:   'Normal',
  high:     'High',
  critical: 'Critical',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TaskScheduleViewProps {
  tasks: ScheduledTask[];
  onCreateTask?: (hour: number) => void;
  onTaskClick?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatTimeRange(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => {
    const hh = d.getHours();
    const mm = d.getMinutes();
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return mm === 0 ? `${h12} ${suffix}` : `${h12}:${mm.toString().padStart(2, '0')} ${suffix}`;
  };
  return `${fmt(s)} -- ${fmt(e)}`;
}

function formatDateLabel(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}

/** Convert a timestamp to a Y offset (px) within the timeline */
function tsToY(ts: number): number {
  const d = new Date(ts);
  const fractionalHour = d.getHours() + d.getMinutes() / 60;
  return (fractionalHour - START_HOUR) * HOUR_HEIGHT;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TaskScheduleView({
  tasks,
  onCreateTask,
  onTaskClick,
  onCancelTask,
}: TaskScheduleViewProps) {
  const { isDarkMode } = useTheme();
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tick the "now" line every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const currentHour = new Date().getHours();
    const offset = Math.max(0, (currentHour - START_HOUR - 1) * HOUR_HEIGHT);
    scrollRef.current.scrollTop = offset;
  }, []);

  // Filter tasks for the selected day
  const dayTasks = useMemo(() => {
    return tasks.filter(t => {
      const ts = t.scheduledStart ?? t.runAt;
      return isSameDay(new Date(ts), selectedDay);
    });
  }, [tasks, selectedDay]);

  const isToday = isSameDay(selectedDay, new Date());

  // Day navigation
  const prevDay = useCallback(() => {
    setSelectedDay(d => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
  }, []);
  const nextDay = useCallback(() => {
    setSelectedDay(d => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
  }, []);
  const goToday = useCallback(() => setSelectedDay(new Date()), []);

  // Click on empty space to create a task at that hour
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCreateTask) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    const hour = Math.floor(y / HOUR_HEIGHT) + START_HOUR;
    if (hour >= START_HOUR && hour < END_HOUR) {
      onCreateTask(hour);
    }
  }, [onCreateTask]);

  /* ---- Styles ---- */

  const bg = isDarkMode ? '#0a0a0a' : '#fafafa';
  const cardBg = isDarkMode ? '#141414' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.88)';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const textTertiary = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const hoverBg = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  /* ---- Now line position ---- */
  const nowY = isToday ? tsToY(now) : -1;
  const showNowLine = isToday && nowY >= 0 && nowY <= TOTAL_HOURS * HOUR_HEIGHT;

  return (
    <div style={{
      fontFamily: FONT_FAMILY,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: bg,
      color: textPrimary,
    }}>
      {/* ---- Header / Day Nav ---- */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px 8px',
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={prevDay}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: textSecondary, fontSize: 18, padding: '4px 8px',
              borderRadius: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            &#8249;
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {formatDateLabel(selectedDay)}
          </span>
          <button
            onClick={nextDay}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: textSecondary, fontSize: 18, padding: '4px 8px',
              borderRadius: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            &#8250;
          </button>
        </div>

        <button
          onClick={goToday}
          style={{
            background: isToday ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
            border: `1px solid ${isToday ? 'transparent' : borderColor}`,
            borderRadius: 8,
            padding: '5px 14px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: isToday ? textTertiary : textSecondary,
            cursor: isToday ? 'default' : 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Today
        </button>
      </div>

      {/* ---- Scrollable Timeline ---- */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: TOTAL_HOURS * HOUR_HEIGHT,
            minHeight: '100%',
          }}
          onClick={handleTimelineClick}
        >
          {/* Hour rows */}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => {
            const hour = START_HOUR + i;
            return (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  top: i * HOUR_HEIGHT,
                  left: 0,
                  right: 0,
                  height: HOUR_HEIGHT,
                  display: 'flex',
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                {/* Hour label */}
                <div style={{
                  width: GUTTER_WIDTH,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                  paddingTop: 3,
                }}>
                  <span style={{
                    fontSize: 11,
                    color: textTertiary,
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                    transform: 'translateY(-7px)',
                  }}>
                    {formatHour(hour)}
                  </span>
                </div>
                {/* Grid cell */}
                <div style={{
                  flex: 1,
                  borderLeft: `1px solid ${borderColor}`,
                  cursor: onCreateTask ? 'pointer' : 'default',
                }} />
              </div>
            );
          })}

          {/* Task blocks */}
          {dayTasks.map(task => {
            const start = task.scheduledStart ?? task.runAt;
            const estimatedMs = task.estimatedDuration
              ? task.estimatedDuration * 60_000
              : (task.scheduledEnd ? task.scheduledEnd - start : 30 * 60_000);
            const end = task.scheduledEnd ?? (start + estimatedMs);

            const top = tsToY(start);
            const height = Math.max(24, tsToY(end) - top);
            const color = CATEGORY_COLORS[task.category || 'maintenance'] || '#6b7280';
            const isRunning = task.status === 'running';
            const isHovered = hoveredTaskId === task.id;

            return (
              <div
                key={task.id}
                style={{
                  position: 'absolute',
                  top,
                  left: GUTTER_WIDTH + 8,
                  right: 12,
                  height,
                  background: isDarkMode
                    ? `${color}18`
                    : `${color}12`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s ease, background 0.15s ease',
                  boxShadow: isRunning
                    ? `0 0 12px ${color}40, 0 0 4px ${color}30`
                    : isHovered
                      ? `0 2px 8px ${isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`
                      : 'none',
                  animation: isRunning ? 'taskPulse 2s ease-in-out infinite' : 'none',
                  zIndex: isHovered ? 10 : 1,
                }}
                onClick={e => {
                  e.stopPropagation();
                  onTaskClick?.(task.id);
                }}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                {/* Title + time */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 2,
                  justifyContent: 'space-between',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: textPrimary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}>
                      {task.title || task.prompt.slice(0, 40)}
                    </span>
                    <div style={{ fontSize: 10, color: textSecondary, marginTop: 1 }}>
                      {formatTimeRange(start, end)}
                    </div>
                  </div>

                  {/* Category badge */}
                  {task.category && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color,
                      background: `${color}20`,
                      padding: '1px 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                      letterSpacing: '0.03em',
                      textTransform: 'capitalize',
                    }}>
                      {task.category}
                    </span>
                  )}
                </div>

                {/* Progress bar for running tasks */}
                {isRunning && (
                  <div style={{
                    marginTop: 6,
                    height: 4,
                    background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      background: color,
                      width: `${Math.min(100, task.progress || 0)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}

                {/* Cancel button for running/pending tasks */}
                {isHovered && (isRunning || task.status === 'pending') && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onCancelTask?.(task.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 600,
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Cancel
                  </button>
                )}

                {/* Hover tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: isDarkMode ? '#1c1c1e' : '#ffffff',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    minWidth: 220,
                    maxWidth: 320,
                    boxShadow: isDarkMode
                      ? '0 8px 24px rgba(0,0,0,0.5)'
                      : '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 6 }}>
                      {task.title || task.prompt.slice(0, 60)}
                    </div>
                    <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4, lineHeight: 1.5 }}>
                      {task.prompt.length > 120 ? task.prompt.slice(0, 120) + '...' : task.prompt}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: textTertiary, marginTop: 6 }}>
                      <span>Status: {task.status}</span>
                    </div>
                    {onCancelTask && task.status === 'pending' && (
                      <div style={{ marginTop: 8, fontSize: 10, color: '#ef4444' }}>
                        Click to view -- right-click to cancel
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Now line */}
          {showNowLine && (
            <div style={{
              position: 'absolute',
              top: nowY,
              left: GUTTER_WIDTH - 4,
              right: 0,
              height: 2,
              background: '#ef4444',
              zIndex: 15,
              pointerEvents: 'none',
            }}>
              {/* Dot on the left end */}
              <div style={{
                position: 'absolute',
                left: -3,
                top: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Keyframe for running task pulse */}
      <style>{`
        @keyframes taskPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
