/**
 * TaskPanel — Create, queue, and schedule agent tasks
 * Each task spawns a new chat and sends the prompt autonomously.
 */
import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import {
  getScheduledTasks,
  scheduleTask,
  scheduleTaskTimeRange,
  scheduleTaskDeadline,
  cancelTask,
  deleteTask,
  clearCompletedTasks,
  type ScheduledTask,
} from '../utils/taskScheduler';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function statusColor(status: ScheduledTask['status'], dark: boolean) {
  switch (status) {
    case 'running':   return '#3b82f6';
    case 'pending':   return dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    case 'completed': return '#22c55e';
    case 'failed':    return '#ef4444';
    case 'cancelled': return dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
  }
}

function statusLabel(status: ScheduledTask['status']) {
  switch (status) {
    case 'running':   return 'Running';
    case 'pending':   return 'Pending';
    case 'completed': return 'Done';
    case 'failed':    return 'Failed';
    case 'cancelled': return 'Cancelled';
  }
}

function statusDot(status: ScheduledTask['status']) {
  if (status === 'running') return (
    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6', animation: 'pulse 1.5s ease-in-out infinite' }} />
  );
  const colors: Record<string, string> = { completed: '#22c55e', failed: '#ef4444', cancelled: '#64748b', pending: '#f59e0b' };
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: colors[status] ?? '#94a3b8' }} />;
}

function formatRelTime(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return diff < 0 ? 'just now' : 'in a moment';
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return diff < 0 ? `${m}m ago` : `in ${m}m`;
  }
  const h = Math.round(abs / 3_600_000);
  return diff < 0 ? `${h}h ago` : `in ${h}h`;
}

function SectionLabel({ label, count, isDarkMode }: { label: string; count: number; isDarkMode: boolean }) {
  if (count === 0) return null;
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', padding: '12px 4px 4px', fontFamily: FONT_FAMILY }}>
      {label} · {count}
    </div>
  );
}

function TaskCard({ task, isDarkMode, onCancel, onDelete, onNavigate }: {
  task: ScheduledTask;
  isDarkMode: boolean;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: (chatId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = task.status === 'running' || task.status === 'pending';
  const canCancel = task.status === 'pending' || task.status === 'running';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: hovered
          ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
          : (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        marginBottom: 6,
        transition: 'background 0.15s',
        cursor: task.chatId ? 'pointer' : 'default',
      }}
      onClick={() => task.chatId && onNavigate?.(task.chatId)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Status dot */}
        <div style={{ paddingTop: 4, flexShrink: 0 }}>{statusDot(task.status)}</div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#111', fontFamily: FONT_FAMILY, marginBottom: 2, lineHeight: 1.4 }}>
            {task.title || task.prompt.slice(0, 60)}
          </div>
          {task.title && task.prompt !== task.title && (
            <div style={{ fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)', fontFamily: FONT_FAMILY, marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.prompt.slice(0, 80)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: statusColor(task.status, isDarkMode), fontWeight: 500, fontFamily: FONT_FAMILY }}>
              {statusLabel(task.status)}
            </span>
            {task.status === 'pending' && (
              <span style={{ fontSize: 10, color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', fontFamily: FONT_FAMILY }}>
                {task.queued ? '· queued' : `· ${formatRelTime(task.runAt)}`}
              </span>
            )}
            {task.chatId && (
              <span style={{ fontSize: 10, color: '#3b82f6', fontFamily: FONT_FAMILY }}>· open chat →</span>
            )}
            {task.error && (
              <span style={{ fontSize: 10, color: '#ef4444', fontFamily: FONT_FAMILY }} title={task.error}>· {task.error.slice(0, 30)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {hovered && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {canCancel && (
              <button
                onClick={e => { e.stopPropagation(); onCancel(task.id); }}
                style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'none', cursor: 'pointer', color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: FONT_FAMILY }}
              >
                cancel
              </button>
            )}
            {!isActive && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: `1px solid rgba(239,68,68,0.2)`, background: 'none', cursor: 'pointer', color: '#ef4444', fontFamily: FONT_FAMILY }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TaskPanel({ isOpen, onClose }: Props) {
  const { isDarkMode } = useTheme();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [scheduleType, setScheduleType] = useState<'timeRange' | 'deadline'>('timeRange');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const all = await getScheduledTasks();
    // Sort: running first, then pending (queued last), then by createdAt desc
    all.sort((a, b) => {
      const order = { running: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.createdAt - a.createdAt;
    });
    setTasks(all);
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Listen for task status changes dispatched by AppShell
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('neuro-tasks-updated', handler);
    return () => window.removeEventListener('neuro-tasks-updated', handler);
  }, []);

  const handleCreate = async () => {
    if (!prompt.trim() || creating) return;

    // Validate scheduling form
    if (showForm) {
      if (scheduleType === 'timeRange') {
        if (!startTime || !endTime) {
          alert('Please set start and end times');
          return;
        }
      } else {
        if (!dueDate || !estimatedMinutes) {
          alert('Please set due date and estimated duration');
          return;
        }
      }
    }

    setCreating(true);
    try {
      if (showForm && scheduleType === 'timeRange' && startTime && endTime) {
        // Parse start/end times (format: HH:MM)
        const today = new Date();
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const start = new Date(today);
        start.setHours(startHour, startMin, 0, 0);
        const end = new Date(today);
        end.setHours(endHour, endMin, 0, 0);

        await scheduleTaskTimeRange(
          prompt.trim(),
          undefined,
          start.getTime(),
          end.getTime(),
          undefined
        );
      } else if (showForm && scheduleType === 'deadline' && dueDate && estimatedMinutes) {
        // Parse due date (format: YYYY-MM-DD)
        const due = new Date(dueDate + 'T23:59:59');
        await scheduleTaskDeadline(
          prompt.trim(),
          undefined,
          due.getTime(),
          parseInt(estimatedMinutes) || 30,
          undefined
        );
      } else {
        // Simple queue (immediate)
        await scheduleTask(prompt.trim(), Date.now());
      }

      setPrompt('');
      setShowForm(false);
      setStartTime('');
      setEndTime('');
      setDueDate('');
      setEstimatedMinutes('30');
      await refresh();
      // Notify AppShell to check immediately
      window.dispatchEvent(new CustomEvent('neuro-tasks-updated'));
      inputRef.current?.focus();
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    await cancelTask(id);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    await refresh();
  };

  const handleClearDone = async () => {
    await clearCompletedTasks();
    await refresh();
  };

  const handleNavigate = (chatId: string) => {
    window.dispatchEvent(new CustomEvent('neuro-navigate-chat', { detail: { chatId } }));
    onClose();
  };

  const running  = tasks.filter(t => t.status === 'running');
  const pending  = tasks.filter(t => t.status === 'pending');
  const done     = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

  const bg = isDarkMode ? 'rgba(12,12,18,0.97)' : 'rgba(255,255,255,0.97)';
  const border = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text = isDarkMode ? 'rgba(255,255,255,0.85)' : '#111';
  const muted = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  const inputBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const inputBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
              background: bg, backdropFilter: 'blur(24px)',
              borderLeft: `1px solid ${border}`,
              zIndex: 200, display: 'flex', flexDirection: 'column',
              fontFamily: FONT_FAMILY,
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text }}>Tasks</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
                  {running.length > 0 ? `${running.length} running` : pending.length > 0 ? `${pending.length} queued` : 'No active tasks'}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {/* Create task form */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: showForm ? 12 : 0 }}>
                <input
                  ref={inputRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !showForm) handleCreate(); }}
                  placeholder="What should NEURO work on?"
                  style={{
                    flex: 1, padding: '8px 11px', borderRadius: 8,
                    background: inputBg, border: `1px solid ${inputBorder}`,
                    color: text, fontFamily: FONT_FAMILY, fontSize: 13,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setShowForm(!showForm)}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    border: `1px solid ${inputBorder}`,
                    cursor: 'pointer',
                    color: muted, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 500,
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                >
                  {showForm ? 'Hide' : 'Schedule'}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!prompt.trim() || creating}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    background: prompt.trim() ? (isDarkMode ? '#3b82f6' : '#2563eb') : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                    border: 'none', cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                    color: prompt.trim() ? '#fff' : muted,
                    fontSize: 12, fontWeight: 600, fontFamily: FONT_FAMILY,
                    transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {creating ? 'Queueing…' : 'Queue'}
                </button>
              </div>

              {/* Schedule type selector */}
              {showForm && (
                <div style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${inputBorder}`,
                  borderRadius: 8,
                  padding: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule Type</div>

                  {/* Radio buttons */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: text }}>
                      <input
                        type="radio"
                        checked={scheduleType === 'timeRange'}
                        onChange={() => setScheduleType('timeRange')}
                        style={{ cursor: 'pointer' }}
                      />
                      Time Range
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: text }}>
                      <input
                        type="radio"
                        checked={scheduleType === 'deadline'}
                        onChange={() => setScheduleType('deadline')}
                        style={{ cursor: 'pointer' }}
                      />
                      Deadline
                    </label>
                  </div>

                  {/* Time Range inputs */}
                  {scheduleType === 'timeRange' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: muted, display: 'block', marginBottom: 4 }}>Start</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={e => setStartTime(e.target.value)}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 6,
                            background: inputBg, border: `1px solid ${inputBorder}`,
                            color: text, fontFamily: FONT_FAMILY, fontSize: 12,
                            boxSizing: 'border-box', outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: muted, display: 'block', marginBottom: 4 }}>End</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 6,
                            background: inputBg, border: `1px solid ${inputBorder}`,
                            color: text, fontFamily: FONT_FAMILY, fontSize: 12,
                            boxSizing: 'border-box', outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Deadline inputs */}
                  {scheduleType === 'deadline' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: muted, display: 'block', marginBottom: 4 }}>Due Date</label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 6,
                            background: inputBg, border: `1px solid ${inputBorder}`,
                            color: text, fontFamily: FONT_FAMILY, fontSize: 12,
                            boxSizing: 'border-box', outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ width: 100 }}>
                        <label style={{ fontSize: 10, color: muted, display: 'block', marginBottom: 4 }}>Est. Minutes</label>
                        <input
                          type="number"
                          value={estimatedMinutes}
                          onChange={e => setEstimatedMinutes(e.target.value)}
                          min="1"
                          max="1440"
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 6,
                            background: inputBg, border: `1px solid ${inputBorder}`,
                            color: text, fontFamily: FONT_FAMILY, fontSize: 12,
                            boxSizing: 'border-box', outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Task list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
              {tasks.length === 0 && (
                <div style={{ textAlign: 'center', color: muted, fontSize: 12, marginTop: 40 }}>
                  No tasks yet — create one above
                </div>
              )}

              <SectionLabel label="Running" count={running.length} isDarkMode={isDarkMode} />
              <AnimatePresence>
                {running.map(t => (
                  <TaskCard key={t.id} task={t} isDarkMode={isDarkMode} onCancel={handleCancel} onDelete={handleDelete} onNavigate={handleNavigate} />
                ))}
              </AnimatePresence>

              <SectionLabel label="Queued" count={pending.length} isDarkMode={isDarkMode} />
              <AnimatePresence>
                {pending.map(t => (
                  <TaskCard key={t.id} task={t} isDarkMode={isDarkMode} onCancel={handleCancel} onDelete={handleDelete} onNavigate={handleNavigate} />
                ))}
              </AnimatePresence>

              {done.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel label="Done" count={done.length} isDarkMode={isDarkMode} />
                    <button onClick={handleClearDone} style={{ fontSize: 10, color: muted, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 4px 4px', fontFamily: FONT_FAMILY }}>
                      clear
                    </button>
                  </div>
                  <AnimatePresence>
                    {done.map(t => (
                      <TaskCard key={t.id} task={t} isDarkMode={isDarkMode} onCancel={handleCancel} onDelete={handleDelete} onNavigate={handleNavigate} />
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
