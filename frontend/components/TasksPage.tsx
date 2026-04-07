/**
 * TasksPage — Full-screen calendar app UI with monthly/weekly/daily views,
 * left sidebar navigation, and right panel for task creation/editing.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import {
  getScheduledTasks,
  scheduleTask,
  cancelTask,
  deleteTask,
  getTaskStats,
  type ScheduledTask,
} from '../utils/taskScheduler';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_SHORT  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Hours shown in weekly/daily views
const HOURS: number[] = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm

type CalView = 'month' | 'week' | 'day';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function taskHour(task: ScheduledTask): number {
  return new Date(task.runAt).getHours() + new Date(task.runAt).getMinutes() / 60;
}

function statusColor(status: ScheduledTask['status']): string {
  switch (status) {
    case 'pending':   return '#f59e0b';
    case 'completed': return '#22c55e';
    case 'failed':    return '#ef4444';
    case 'cancelled': return '#64748b';
  }
}

function statusBg(status: ScheduledTask['status'], dark: boolean): string {
  switch (status) {
    case 'pending':   return dark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)';
    case 'completed': return dark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)';
    case 'failed':    return dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)';
    case 'cancelled': return dark ? 'rgba(100,116,139,0.15)' : 'rgba(100,116,139,0.10)';
  }
}

function isRunningNow(task: ScheduledTask): boolean {
  return task.status === 'pending' && task.runAt <= Date.now();
}

// Pad time string input like "09:30"
function parseTimeInput(val: string): { h: number; m: number } {
  const [h, m] = val.split(':').map(Number);
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Running Banner ────────────────────────────────────────────────────────────

function RunningBanner({ task, dark }: { task: ScheduledTask; dark: boolean }) {
  const preview = task.prompt.length > 70 ? task.prompt.slice(0, 70) + '...' : task.prompt;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 20px',
      background: dark ? 'rgba(245,158,11,0.13)' : 'rgba(245,158,11,0.10)',
      borderBottom: `1px solid ${dark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.22)'}`,
      fontFamily: FONT_FAMILY,
      flexShrink: 0,
    }}>
      <PulsingDot color="#f59e0b" />
      <span style={{ fontSize: 13, color: dark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.78)', flex: 1 }}>
        <span style={{ fontWeight: 600, color: '#f59e0b' }}>Task running</span>
        {' — NEURO is working on: '}
        <span style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}>{preview}</span>
      </span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('neuro-switch-to-chat'))}
        style={{
          fontSize: 12, fontFamily: FONT_FAMILY, fontWeight: 500,
          padding: '4px 12px', borderRadius: 6, border: '1px solid #f59e0b',
          background: 'transparent', color: '#f59e0b', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        View in Chat
      </button>
    </div>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10, flexShrink: 0 }}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, animation: 'pulse-ring 1.3s ease-out infinite',
      }} />
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, position: 'relative' }} />
    </span>
  );
}

// ── Mini Month Navigator ──────────────────────────────────────────────────────

function MiniMonth({
  navDate, today, onNavigate, onSelectDate, dark,
}: {
  navDate: Date;
  today: Date;
  onNavigate: (d: Date) => void;
  onSelectDate: (d: Date) => void;
  dark: boolean;
}) {
  const year  = navDate.getFullYear();
  const month = navDate.getMonth();
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const textPrimary = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)';
  const textDim     = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)';
  const textMuted   = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  return (
    <div style={{ fontFamily: FONT_FAMILY, userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button
          onClick={() => onNavigate(new Date(year, month - 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 14, padding: '2px 4px' }}
        >
          ‹
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary, letterSpacing: '0.03em' }}>
          {MONTH_NAMES[month].slice(0, 3)} {year}
        </span>
        <button
          onClick={() => onNavigate(new Date(year, month + 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 14, padding: '2px 4px' }}
        >
          ›
        </button>
      </div>
      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 3 }}>
        {DAY_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, color: textDim, fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const cellDate = new Date(year, month, day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = isSameDay(cellDate, navDate) && !isToday;
          return (
            <button
              key={idx}
              onClick={() => onSelectDate(cellDate)}
              style={{
                background: isToday ? '#3b82f6' : isSelected ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)') : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontFamily: FONT_FAMILY, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#fff' : textPrimary,
                padding: '3px 0', textAlign: 'center', lineHeight: 1.4,
                transition: 'background 0.12s',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────

function Sidebar({
  view, setView, navDate, today, onNavigate, onSelectDate,
  stats, onNewTask, dark,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  navDate: Date;
  today: Date;
  onNavigate: (d: Date) => void;
  onSelectDate: (d: Date) => void;
  stats: { pending: number; completed: number; failed: number };
  onNewTask: () => void;
  dark: boolean;
}) {
  const bg      = dark ? '#141414' : '#f9f9f9';
  const border  = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPri = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';

  const views: { key: CalView; label: string }[] = [
    { key: 'month', label: 'Month' },
    { key: 'week', label: 'Week' },
    { key: 'day', label: 'Day' },
  ];

  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: bg, borderRight: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', padding: '20px 16px',
      gap: 20, overflowY: 'auto',
    }}>
      {/* Title */}
      <div style={{ fontSize: 16, fontWeight: 700, color: textPri, fontFamily: FONT_FAMILY }}>
        Tasks
      </div>

      {/* View switcher */}
      <div style={{
        display: 'flex', gap: 4,
        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        borderRadius: 8, padding: 3,
      }}>
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              flex: 1, fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 600,
              padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              transition: 'background 0.14s, color 0.14s',
              background: view === v.key
                ? (dark ? 'rgba(255,255,255,0.12)' : '#fff')
                : 'transparent',
              color: view === v.key ? textPri : (dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'),
              boxShadow: view === v.key ? (dark ? 'none' : '0 1px 3px rgba(0,0,0,0.10)') : 'none',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Mini month */}
      <MiniMonth
        navDate={navDate}
        today={today}
        onNavigate={onNavigate}
        onSelectDate={(d) => { onSelectDate(d); setView('day'); }}
        dark={dark}
      />

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', fontFamily: FONT_FAMILY, textTransform: 'uppercase' }}>
          Stats
        </div>
        {[
          { label: 'Pending',   count: stats.pending,   color: '#f59e0b' },
          { label: 'Completed', count: stats.completed, color: '#22c55e' },
          { label: 'Failed',    count: stats.failed,    color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT_FAMILY }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.60)', flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.70)' }}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* New Task button */}
      <button
        onClick={onNewTask}
        style={{
          fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 600,
          padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#3b82f6', color: '#fff',
          transition: 'opacity 0.14s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        + New Task
      </button>
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  navDate, today, tasks, onDayClick, dark,
}: {
  navDate: Date;
  today: Date;
  tasks: ScheduledTask[];
  onDayClick: (d: Date) => void;
  dark: boolean;
}) {
  const year  = navDate.getFullYear();
  const month = navDate.getMonth();
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const cells: { date: Date | null; isCurrentMonth: boolean }[] = [];

  // Prev month filler
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear  = month === 0 ? year - 1 : year;
  const daysInPrev = getDaysInMonth(prevYear, prevMonth);
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(prevYear, prevMonth, daysInPrev - i), isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Next month filler
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear  = month === 11 ? year + 1 : year;
  let nd = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(nextYear, nextMonth, nd++), isCurrentMonth: false });
  }

  const border  = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPri = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const textDim = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)';

  function tasksForDay(d: Date): ScheduledTask[] {
    return tasks.filter(t => isSameDay(new Date(t.runAt), d));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Day headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
        borderBottom: `1px solid ${border}`,
      }}>
        {DAY_ABBREV.map(d => (
          <div key={d} style={{
            padding: '10px 0', textAlign: 'center',
            fontSize: 11, fontWeight: 600, fontFamily: FONT_FAMILY,
            color: textDim, letterSpacing: '0.04em',
          }}>
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
        gridTemplateRows: `repeat(${cells.length / 7}, 1fr)`,
        flex: 1, overflow: 'hidden',
      }}>
        {cells.map((cell, idx) => {
          if (!cell.date) return <div key={idx} />;
          const isToday = isSameDay(cell.date, today);
          const dayTasks = tasksForDay(cell.date);
          const isLast = idx === cells.length - 1;
          const isLastInRow = (idx + 1) % 7 === 0;
          return (
            <div
              key={idx}
              onClick={() => cell.date && onDayClick(cell.date)}
              style={{
                borderRight: isLastInRow ? 'none' : `1px solid ${border}`,
                borderBottom: isLast || idx >= cells.length - 7 ? 'none' : `1px solid ${border}`,
                padding: '8px 8px 6px',
                cursor: 'pointer',
                background: isToday
                  ? (dark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)')
                  : 'transparent',
                transition: 'background 0.12s',
                display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!isToday) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isToday ? (dark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)') : 'transparent';
              }}
            >
              {/* Date number */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 12, fontWeight: isToday ? 700 : 400,
                  color: !cell.isCurrentMonth ? textDim : isToday ? '#3b82f6' : textPri,
                  ...(isToday ? {
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#3b82f6', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  } : {}),
                }}>
                  {cell.date.getDate()}
                </span>
              </div>
              {/* Task dots / bars */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {dayTasks.slice(0, 5).map(t => (
                  <span
                    key={t.id}
                    title={t.prompt.slice(0, 60)}
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: statusColor(t.status), flexShrink: 0,
                    }}
                  />
                ))}
                {dayTasks.length > 5 && (
                  <span style={{ fontSize: 9, color: textDim, fontFamily: FONT_FAMILY }}>+{dayTasks.length - 5}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  navDate, today, tasks, onSlotClick, onTaskClick, dark,
}: {
  navDate: Date;
  today: Date;
  tasks: ScheduledTask[];
  onSlotClick: (date: Date, hour: number) => void;
  onTaskClick: (task: ScheduledTask) => void;
  dark: boolean;
}) {
  const weekStart = startOfWeek(navDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const border    = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPri   = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const textMuted = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.32)';

  // Current time fraction of hour (for indicator)
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;

  const HOUR_HEIGHT = 56; // px per hour

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', fontFamily: FONT_FAMILY }}>
      {/* Day headers */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ width: 52, flexShrink: 0 }} />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              borderLeft: `1px solid ${border}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: textMuted, letterSpacing: '0.04em' }}>
                {DAY_ABBREV[d.getDay()].toUpperCase()}
              </div>
              <div style={{
                fontSize: 18, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#3b82f6' : textPri,
                marginTop: 2,
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', position: 'relative' }}>
          {/* Time labels column */}
          <div style={{ width: 52, flexShrink: 0 }}>
            {HOURS.map(h => (
              <div key={h} style={{
                height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start',
                justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4,
                fontSize: 10, color: textMuted,
              }}>
                {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, di) => {
            const dayTasks = tasks.filter(t => isSameDay(new Date(t.runAt), d));
            const isToday  = isSameDay(d, today);

            return (
              <div key={di} style={{
                flex: 1, borderLeft: `1px solid ${border}`, position: 'relative',
                background: isToday ? (dark ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.025)') : 'transparent',
              }}>
                {/* Hour slots */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(d, h)}
                    style={{
                      height: HOUR_HEIGHT,
                      borderTop: `1px solid ${border}`,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  />
                ))}

                {/* Tasks as time blocks */}
                {dayTasks.map(task => {
                  const taskH = taskHour(task);
                  const minH = HOURS[0];
                  const maxH = HOURS[HOURS.length - 1] + 1;
                  if (taskH < minH || taskH >= maxH) return null;
                  const topPct = ((taskH - minH) / (maxH - minH)) * 100;
                  const heightPx = Math.max(24, HOUR_HEIGHT * 0.5);
                  return (
                    <div
                      key={task.id}
                      onClick={e => { e.stopPropagation(); onTaskClick(task); }}
                      title={task.prompt}
                      style={{
                        position: 'absolute',
                        top: `${topPct}%`,
                        left: 3, right: 3,
                        height: heightPx,
                        borderRadius: 5,
                        background: statusBg(task.status, dark),
                        borderLeft: `3px solid ${statusColor(task.status)}`,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        zIndex: 2,
                        transition: 'opacity 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: statusColor(task.status), fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatTime(task.runAt)}
                      </div>
                      <div style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)', fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.prompt.slice(0, 30)}
                      </div>
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && nowHour >= HOURS[0] && nowHour < HOURS[HOURS.length - 1] + 1 && (
                  <div style={{
                    position: 'absolute',
                    top: `${((nowHour - HOURS[0]) / (HOURS[HOURS.length - 1] + 1 - HOURS[0])) * 100}%`,
                    left: 0, right: 0, height: 2,
                    background: '#3b82f6',
                    zIndex: 3,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({
  navDate, today, tasks, onSlotClick, onTaskClick, dark,
}: {
  navDate: Date;
  today: Date;
  tasks: ScheduledTask[];
  onSlotClick: (date: Date, hour: number) => void;
  onTaskClick: (task: ScheduledTask) => void;
  dark: boolean;
}) {
  const border    = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPri   = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const textMuted = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.32)';
  const isToday   = isSameDay(navDate, today);
  const nowHour   = new Date().getHours() + new Date().getMinutes() / 60;

  const dayTasks = tasks.filter(t => isSameDay(new Date(t.runAt), navDate));
  const HOUR_HEIGHT = 72;

  // All hours: midnight to 11pm
  const ALL_HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', fontFamily: FONT_FAMILY }}>
      {/* Day header */}
      <div style={{
        padding: '16px 24px 12px',
        borderBottom: `1px solid ${border}`,
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 700,
            color: isToday ? '#3b82f6' : textPri,
          }}>
            {navDate.getDate()}
          </div>
          <div style={{ fontSize: 12, color: textMuted, marginTop: 1 }}>
            {DAY_ABBREV[navDate.getDay()]}, {MONTH_NAMES[navDate.getMonth()]} {navDate.getFullYear()}
          </div>
        </div>
        {dayTasks.length > 0 && (
          <div style={{ fontSize: 12, color: textMuted, marginLeft: 8 }}>
            {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', position: 'relative' }}>
          {/* Time labels */}
          <div style={{ width: 64, flexShrink: 0 }}>
            {ALL_HOURS.map(h => (
              <div key={h} style={{
                height: HOUR_HEIGHT,
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'flex-end', paddingRight: 12, paddingTop: 5,
                fontSize: 11, color: textMuted,
              }}>
                {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
              </div>
            ))}
          </div>

          {/* Main column */}
          <div style={{ flex: 1, borderLeft: `1px solid ${border}`, position: 'relative' }}>
            {ALL_HOURS.map(h => (
              <div
                key={h}
                onClick={() => onSlotClick(navDate, h)}
                style={{
                  height: HOUR_HEIGHT,
                  borderTop: `1px solid ${border}`,
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              />
            ))}

            {/* Task cards */}
            {dayTasks.map(task => {
              const taskH = taskHour(task);
              const topPx = taskH * HOUR_HEIGHT;
              const heightPx = Math.max(36, HOUR_HEIGHT * 0.75);
              return (
                <div
                  key={task.id}
                  onClick={e => { e.stopPropagation(); onTaskClick(task); }}
                  style={{
                    position: 'absolute',
                    top: topPx + 4,
                    left: 12, right: 12,
                    minHeight: heightPx,
                    borderRadius: 8,
                    background: statusBg(task.status, dark),
                    borderLeft: `4px solid ${statusColor(task.status)}`,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    zIndex: 2,
                    transition: 'box-shadow 0.12s',
                    boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.10)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = dark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 3px 10px rgba(0,0,0,0.14)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = dark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.10)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(task.status), flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(task.status) }}>
                      {formatTime(task.runAt)}
                    </span>
                    <span style={{ fontSize: 10, color: textMuted, marginLeft: 'auto' }}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: textPri, lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {task.prompt.slice(0, 120)}{task.prompt.length > 120 ? '...' : ''}
                  </div>
                  {task.repeat && (
                    <div style={{ fontSize: 10, color: textMuted, marginTop: 4 }}>
                      Repeats every {Math.round(task.repeat.interval / 60000)}m
                      {task.repeat.maxRuns ? ` (max ${task.repeat.maxRuns})` : ''}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Current time indicator */}
            {isToday && (
              <div style={{
                position: 'absolute',
                top: nowHour * HOUR_HEIGHT,
                left: 0, right: 0, height: 2,
                background: '#3b82f6',
                zIndex: 3,
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', left: -5, top: -4,
                  width: 10, height: 10, borderRadius: '50%', background: '#3b82f6',
                }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Area Header ──────────────────────────────────────────────────────────

function MainHeader({
  view, navDate, today, onPrev, onNext, onToday, dark,
}: {
  view: CalView;
  navDate: Date;
  today: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  dark: boolean;
}) {
  const border  = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPri = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const textMuted = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.32)';

  function title() {
    if (view === 'month') return `${MONTH_NAMES[navDate.getMonth()]} ${navDate.getFullYear()}`;
    if (view === 'day') return formatDate(navDate);
    const ws = startOfWeek(navDate);
    const we = addDays(ws, 6);
    if (ws.getMonth() === we.getMonth()) {
      return `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${ws.getFullYear()}`;
    }
    return `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()]} ${we.getDate()}, ${ws.getFullYear()}`;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 20px',
      borderBottom: `1px solid ${border}`,
      flexShrink: 0, fontFamily: FONT_FAMILY,
    }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: textPri, flex: 1 }}>{title()}</span>
      <button
        onClick={onToday}
        style={{
          fontSize: 11, fontFamily: FONT_FAMILY, fontWeight: 600,
          padding: '5px 12px', borderRadius: 6,
          border: `1px solid ${border}`,
          background: 'transparent', color: textMuted, cursor: 'pointer',
        }}
      >
        Today
      </button>
      <div style={{ display: 'flex', gap: 2 }}>
        {['‹', '›'].map((arrow, i) => (
          <button
            key={arrow}
            onClick={i === 0 ? onPrev : onNext}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: textMuted, padding: '2px 8px', borderRadius: 5,
              fontFamily: FONT_FAMILY,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = textPri; }}
            onMouseLeave={e => { e.currentTarget.style.color = textMuted; }}
          >
            {arrow}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Right Panel — Create / Edit Task ─────────────────────────────────────────

interface PanelState {
  open: boolean;
  task: ScheduledTask | null; // null = create mode
  prefillDate?: Date;
  prefillHour?: number;
}

function TaskPanel({
  state, onClose, onSaved, onDeleted, dark,
}: {
  state: PanelState;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  dark: boolean;
}) {
  const isEdit = !!state.task;
  const task   = state.task;

  // Form state
  const [prompt, setPrompt]         = useState('');
  const [datetimeVal, setDatetime]  = useState('');
  const [repeatMode, setRepeatMode] = useState<'none' | 'daily' | 'weekly' | 'custom'>('none');
  const [customMinutes, setCustomM] = useState('60');
  const [maxRuns, setMaxRuns]       = useState('');
  const [priority, setPriority]     = useState<'normal' | 'high'>('normal');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Populate form when panel opens
  useEffect(() => {
    if (!state.open) return;
    if (task) {
      setPrompt(task.prompt);
      setDatetime(toDatetimeLocal(task.runAt));
      if (task.repeat) {
        const min = task.repeat.interval / 60000;
        if (min === 1440) { setRepeatMode('daily'); }
        else if (min === 10080) { setRepeatMode('weekly'); }
        else { setRepeatMode('custom'); setCustomM(String(min)); }
        setMaxRuns(task.repeat.maxRuns ? String(task.repeat.maxRuns) : '');
      } else {
        setRepeatMode('none');
        setMaxRuns('');
      }
    } else {
      setPrompt('');
      // Prefill from slot click
      const base = state.prefillDate || new Date();
      const h    = state.prefillHour !== undefined ? state.prefillHour : base.getHours() + 1;
      const d    = new Date(base);
      d.setHours(h, 0, 0, 0);
      setDatetime(toDatetimeLocal(d.getTime()));
      setRepeatMode('none');
      setCustomM('60');
      setMaxRuns('');
      setPriority('normal');
    }
    setError('');
    setSaving(false);
  }, [state.open, state.task, state.prefillDate, state.prefillHour]);

  const bg      = dark ? '#1a1a1a' : '#fff';
  const border  = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
  const textPri = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const textMut = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const inputBg = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  const inputStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY, fontSize: 13, color: textPri,
    background: inputBg, border: `1px solid ${border}`,
    borderRadius: 7, padding: '8px 10px', width: '100%',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.12s',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: textMut, fontFamily: FONT_FAMILY,
    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5,
  };

  async function handleSchedule() {
    if (!prompt.trim()) { setError('Please enter a prompt.'); return; }
    if (!datetimeVal) { setError('Please choose a date and time.'); return; }
    const runAt = new Date(datetimeVal).getTime();
    if (isNaN(runAt)) { setError('Invalid date/time.'); return; }

    let repeat: { interval: number; maxRuns?: number } | undefined;
    if (repeatMode === 'daily')   repeat = { interval: 1440 * 60000 };
    if (repeatMode === 'weekly')  repeat = { interval: 10080 * 60000 };
    if (repeatMode === 'custom')  repeat = { interval: Number(customMinutes) * 60000 };
    if (repeat && maxRuns) repeat.maxRuns = Number(maxRuns);

    setSaving(true);
    setError('');
    try {
      await scheduleTask(prompt.trim(), runAt, { repeat });
      onSaved();
    } catch (e) {
      setError('Failed to schedule task.');
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!task) return;
    await cancelTask(task.id);
    onDeleted();
  }

  async function handleDelete() {
    if (!task) return;
    await deleteTask(task.id);
    onDeleted();
  }

  return (
    <>
      {/* Overlay */}
      {state.open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'transparent',
          }}
        />
      )}
      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 320,
          background: bg,
          borderLeft: `1px solid ${border}`,
          boxShadow: dark ? '-8px 0 32px rgba(0,0,0,0.4)' : '-4px 0 20px rgba(0,0,0,0.08)',
          zIndex: 50,
          display: 'flex', flexDirection: 'column',
          transform: state.open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1)',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: textPri }}>
            {isEdit ? (task?.prompt.slice(0, 32) + (task && task.prompt.length > 32 ? '...' : '')) : 'New Task'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: textMut, padding: '2px 6px', borderRadius: 5,
              lineHeight: 1, fontFamily: FONT_FAMILY,
            }}
          >
            x
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Status badge for existing task */}
          {isEdit && task && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: statusBg(task.status, dark),
                color: statusColor(task.status),
                fontFamily: FONT_FAMILY, letterSpacing: '0.04em',
              }}>
                {task.status.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: textMut }}>
                Created {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Prompt */}
          {!isEdit && (
            <div>
              <label style={labelStyle}>What should NEURO do?</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the task..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          )}

          {/* Prompt (read-only edit) */}
          {isEdit && task && (
            <div>
              <label style={labelStyle}>Prompt</label>
              <div style={{
                ...inputStyle,
                lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                minHeight: 60, userSelect: 'text',
              }}>
                {task.prompt}
              </div>
            </div>
          )}

          {/* Date + Time */}
          {!isEdit && (
            <div>
              <label style={labelStyle}>When</label>
              <input
                type="datetime-local"
                value={datetimeVal}
                onChange={e => setDatetime(e.target.value)}
                style={{ ...inputStyle, colorScheme: dark ? 'dark' : 'light' }}
              />
            </div>
          )}

          {/* Scheduled time (read-only for edit) */}
          {isEdit && task && (
            <div>
              <label style={labelStyle}>Scheduled</label>
              <div style={{ fontSize: 13, color: textPri }}>{formatDate(new Date(task.runAt))} at {formatTime(task.runAt)}</div>
            </div>
          )}

          {/* Repeat */}
          {!isEdit && (
            <div>
              <label style={labelStyle}>Repeat</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['none', 'daily', 'weekly', 'custom'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRepeatMode(r)}
                    style={{
                      fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 600,
                      padding: '5px 11px', borderRadius: 6,
                      border: `1px solid ${repeatMode === r ? '#3b82f6' : border}`,
                      background: repeatMode === r ? (dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)') : 'transparent',
                      color: repeatMode === r ? '#3b82f6' : textMut,
                      cursor: 'pointer',
                    }}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              {repeatMode === 'custom' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={e => setCustomM(e.target.value)}
                    min="1"
                    style={{ ...inputStyle, width: 80 }}
                  />
                  <span style={{ fontSize: 12, color: textMut }}>minutes</span>
                </div>
              )}
              {repeatMode !== 'none' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Max runs</label>
                  <input
                    type="number"
                    value={maxRuns}
                    onChange={e => setMaxRuns(e.target.value)}
                    placeholder="unlimited"
                    min="1"
                    style={{ ...inputStyle, width: 100 }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Repeat info for existing task */}
          {isEdit && task?.repeat && (
            <div>
              <label style={labelStyle}>Repeat</label>
              <div style={{ fontSize: 13, color: textPri }}>
                Every {Math.round(task.repeat.interval / 60000)} minutes
                {task.repeat.maxRuns ? ` (max ${task.repeat.maxRuns} runs)` : ' (unlimited)'}
                {task.runsCompleted !== undefined && ` — ${task.runsCompleted} completed`}
              </div>
            </div>
          )}

          {/* Priority */}
          {!isEdit && (
            <div>
              <label style={labelStyle}>Priority</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['normal', 'high'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 600,
                      padding: '5px 14px', borderRadius: 6,
                      border: `1px solid ${priority === p ? (p === 'high' ? '#ef4444' : '#3b82f6') : border}`,
                      background: priority === p
                        ? (p === 'high'
                          ? (dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.10)')
                          : (dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)'))
                        : 'transparent',
                      color: priority === p ? (p === 'high' ? '#ef4444' : '#3b82f6') : textMut,
                      cursor: 'pointer',
                    }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', fontFamily: FONT_FAMILY }}>{error}</div>
          )}
        </div>

        {/* Panel footer */}
        <div style={{
          padding: '16px 20px', borderTop: `1px solid ${border}`,
          flexShrink: 0, display: 'flex', gap: 8, flexDirection: 'column',
        }}>
          {!isEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSchedule}
                disabled={saving}
                style={{
                  flex: 1, fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 700,
                  padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#3b82f6', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1, transition: 'opacity 0.14s',
                }}
              >
                {saving ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          )}
          {isEdit && task && (
            <div style={{ display: 'flex', gap: 8 }}>
              {task.status === 'pending' && (
                <button
                  onClick={handleCancel}
                  style={{
                    flex: 1, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 600,
                    padding: '8px 0', borderRadius: 7,
                    border: `1px solid ${dark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.4)'}`,
                    background: 'transparent', color: '#f59e0b', cursor: 'pointer',
                  }}
                >
                  Cancel Task
                </button>
              )}
              <button
                onClick={handleDelete}
                style={{
                  flex: 1, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 600,
                  padding: '8px 0', borderRadius: 7,
                  border: `1px solid ${dark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.4)'}`,
                  background: 'transparent', color: '#ef4444', cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { isDarkMode: dark } = useTheme();
  const today = useRef(new Date()).current;

  const [tasks, setTasks]   = useState<ScheduledTask[]>([]);
  const [stats, setStats]   = useState({ pending: 0, completed: 0, failed: 0 });
  const [view, setView]     = useState<CalView>('week');
  const [navDate, setNavDate] = useState<Date>(new Date());

  // Panel state
  const [panel, setPanel] = useState<PanelState>({ open: false, task: null });

  // Poll for tasks
  const refresh = useCallback(async () => {
    const [fetched, s] = await Promise.all([getScheduledTasks(), getTaskStats()]);
    setTasks(fetched);
    setStats({ pending: s.pending, completed: s.completed, failed: s.failed });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Navigation
  function navigatePrev() {
    if (view === 'month') setNavDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === 'week') setNavDate(d => addDays(d, -7));
    else setNavDate(d => addDays(d, -1));
  }

  function navigateNext() {
    if (view === 'month') setNavDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === 'week') setNavDate(d => addDays(d, 7));
    else setNavDate(d => addDays(d, 1));
  }

  function goToday() {
    setNavDate(new Date());
  }

  // Panel handlers
  function openNewTask(prefillDate?: Date, prefillHour?: number) {
    setPanel({ open: true, task: null, prefillDate, prefillHour });
  }

  function openEditTask(task: ScheduledTask) {
    setPanel({ open: true, task });
  }

  function closePanel() {
    setPanel(p => ({ ...p, open: false }));
  }

  function handleSaved() {
    closePanel();
    refresh();
  }

  function handleDeleted() {
    closePanel();
    refresh();
  }

  // Running task
  const runningTask = tasks.find(isRunningNow) || null;

  const bg     = dark ? '#111' : '#fff';
  const border = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      background: bg, fontFamily: FONT_FAMILY,
      overflow: 'hidden',
    }}>
      {/* Running banner */}
      {runningTask && <RunningBanner task={runningTask} dark={dark} />}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar — hidden below 768px via media query (inline style can't do this, so we use a class approach) */}
        <style>{`
          @media (max-width: 767px) {
            .tasks-sidebar { display: none !important; }
            .tasks-mobile-header { display: flex !important; }
          }
          @media (min-width: 768px) {
            .tasks-mobile-header { display: none !important; }
          }
        `}</style>

        <div className="tasks-sidebar" style={{ display: 'flex' }}>
          <Sidebar
            view={view}
            setView={(v) => { setView(v); }}
            navDate={navDate}
            today={today}
            onNavigate={setNavDate}
            onSelectDate={(d) => { setNavDate(d); setView('day'); }}
            stats={stats}
            onNewTask={() => openNewTask()}
            dark={dark}
          />
        </div>

        {/* Main calendar area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Mobile view switcher (hidden on desktop) */}
          <div
            className="tasks-mobile-header"
            style={{
              display: 'none',
              alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: `1px solid ${border}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)', fontFamily: FONT_FAMILY }}>Tasks</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['month', 'week', 'day'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 600,
                    padding: '5px 10px', borderRadius: 6,
                    border: `1px solid ${view === v ? '#3b82f6' : border}`,
                    background: view === v ? (dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)') : 'transparent',
                    color: view === v ? '#3b82f6' : (dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'),
                    cursor: 'pointer',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => openNewTask()}
              style={{
                fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 600,
                padding: '6px 12px', borderRadius: 7, border: 'none',
                background: '#3b82f6', color: '#fff', cursor: 'pointer',
              }}
            >
              + New
            </button>
          </div>

          {/* Nav header */}
          <MainHeader
            view={view}
            navDate={navDate}
            today={today}
            onPrev={navigatePrev}
            onNext={navigateNext}
            onToday={goToday}
            dark={dark}
          />

          {/* Calendar views — animate between them */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              opacity: view === 'month' ? 1 : 0,
              pointerEvents: view === 'month' ? 'auto' : 'none',
              transition: 'opacity 0.15s',
            }}>
              <MonthView
                navDate={navDate}
                today={today}
                tasks={tasks}
                onDayClick={(d) => { setNavDate(d); setView('day'); }}
                dark={dark}
              />
            </div>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              opacity: view === 'week' ? 1 : 0,
              pointerEvents: view === 'week' ? 'auto' : 'none',
              transition: 'opacity 0.15s',
            }}>
              <WeekView
                navDate={navDate}
                today={today}
                tasks={tasks}
                onSlotClick={(date, hour) => openNewTask(date, hour)}
                onTaskClick={openEditTask}
                dark={dark}
              />
            </div>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              opacity: view === 'day' ? 1 : 0,
              pointerEvents: view === 'day' ? 'auto' : 'none',
              transition: 'opacity 0.15s',
            }}>
              <DayView
                navDate={navDate}
                today={today}
                tasks={tasks}
                onSlotClick={(date, hour) => openNewTask(date, hour)}
                onTaskClick={openEditTask}
                dark={dark}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <TaskPanel
        state={panel}
        onClose={closePanel}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        dark={dark}
      />
    </div>
  );
}
