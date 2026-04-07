/**
 * TasksPage v6 — Apple Calendar weekly planner with task queues inside time blocks.
 *
 * Architecture:
 *   Calendar shows TIME BLOCKS (available work windows).
 *   Each block contains a TASK QUEUE executed sequentially top→bottom.
 *   Click task = Apple Calendar-style popover (edit name, description, delete).
 *   Full 24-hour day view with past date prevention.
 */

// @ts-nocheck
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import {
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  moveBlock,
  resizeBlock,
  addTaskToBlock,
  updateTaskInBlock,
  removeTaskFromBlock,
  reorderTasksInBlock,
  moveTaskBetweenBlocks,
  advanceQueue,
  getBacklog,
  addToBacklog,
  removeFromBacklog,
  moveBacklogToBlock,
  moveBlockTaskToBacklog,
  type TimeBlock,
  type PlanTask,
  type TaskStatus,
} from '../utils/plannerStore';

// ── Constants ───────────────────────────────────────────────────────────────

const HOUR_PX = 64;
const SNAP_MIN = 15;
const HOURS = Array.from({ length: 24 }, (_, i) => i); // Full 24-hour day
const TIME_GUTTER = 52;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLOCK_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#f43f5e'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIsoDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function mondayOfWeek(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  const day = r.getDay(); // 0=Sun
  r.setDate(r.getDate() - ((day + 6) % 7)); // shift to Monday
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function fmtHour(h: number): string {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const disp = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return min === 0 ? `${disp} ${ampm}` : `${disp}:${String(min).padStart(2, '0')} ${ampm}`;
}

function snapHour(raw: number): number {
  return Math.round(raw * (60 / SNAP_MIN)) / (60 / SNAP_MIN);
}

function yToHour(y: number): number {
  return snapHour(HOURS[0] + y / HOUR_PX);
}

function hourToY(h: number): number {
  return (h - HOURS[0]) * HOUR_PX;
}

function xToCol(clientX: number, rect: DOMRect): number {
  const contentLeft = rect.left + TIME_GUTTER;
  const colW = (rect.width - TIME_GUTTER) / 7;
  return Math.min(6, Math.max(0, Math.floor((clientX - contentLeft) / colW)));
}

// ── Status helpers ──────────────────────────────────────────────────────────

function statusIcon(s: TaskStatus): string {
  if (s === 'completed') return '✓';
  if (s === 'in_progress') return '▶';
  return '○';
}

function statusColor(s: TaskStatus): string {
  if (s === 'completed') return '#22c55e';
  if (s === 'in_progress') return '#3b82f6';
  return '#94a3b8';
}

// ════════════════════════════════════════════════════════════════════════════
// TASK POPOVER (Apple Calendar style — single click to edit)
// ════════════════════════════════════════════════════════════════════════════

function TaskPopover({
  task, block, position, onClose, onUpdate, dark,
}: {
  task: PlanTask;
  block: TimeBlock;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: () => void;
  dark: boolean;
}) {
  const [name, setName] = useState(task.name);
  const [desc, setDesc] = useState(task.description || '');
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const bg = dark ? '#1a1a1a' : '#fff';
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    if (name.trim()) {
      await updateTaskInBlock(block.id, task.id, { name: name.trim(), description: desc.trim() || undefined });
      onUpdate();
    }
    onClose();
  };

  const handleDelete = async () => {
    if (confirm('Delete this task?')) {
      await removeTaskFromBlock(block.id, task.id);
      onUpdate();
      onClose();
    }
  };

  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 320,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        boxShadow: dark ? '0 20px 25px -5px rgba(0,0,0,0.3)' : '0 20px 25px -5px rgba(0,0,0,0.1)',
        zIndex: 1000,
        fontFamily: FONT_FAMILY,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Task name */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Task Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{
            width: '100%',
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            padding: '8px 10px',
            border: `1px solid ${border}`,
            borderRadius: 8,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: 'inherit',
            outline: 'none',
            marginTop: 6,
          }}
        />
      </div>

      {/* Description */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Description</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Optional prompt or notes..."
          rows={2}
          style={{
            width: '100%',
            fontSize: 12,
            fontFamily: FONT_FAMILY,
            padding: '8px 10px',
            border: `1px solid ${border}`,
            borderRadius: 8,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: 'inherit',
            outline: 'none',
            resize: 'none',
            marginTop: 6,
          }}
        />
      </div>

      {/* Status */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Status</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {(['not_started', 'in_progress', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => updateTaskInBlock(block.id, task.id, { status }).then(() => onUpdate())}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: task.status === status ? 'none' : `1px solid ${border}`,
                background: task.status === status ? block.color : 'transparent',
                color: task.status === status ? '#fff' : 'inherit',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {status === 'not_started' ? 'Not started' : status === 'in_progress' ? 'In progress' : 'Done'}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: `1px solid ${border}` }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: block.color,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: `1px solid ${border}`,
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
          }}
          title="Delete task"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK DETAIL PANEL (task queue inside a block)
// ════════════════════════════════════════════════════════════════════════════

function BlockDetail({
  block, onClose, onUpdate, dark,
}: {
  block: TimeBlock;
  onClose: () => void;
  onUpdate: () => void;
  dark: boolean;
}) {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [selectedTask, setSelectedTask] = useState<PlanTask | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const bg2 = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const activeTask = block.tasks.find((t) => t.status === 'in_progress');

  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    await addTaskToBlock(block.id, newTaskName.trim(), newTaskDesc.trim() || undefined);
    setNewTaskName('');
    setNewTaskDesc('');
    onUpdate();
  };

  const handleTaskClick = (task: PlanTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPos({ x: rect.left + rect.width + 12, y: rect.top });
  };

  // Drag reorder
  const handleDragEnd = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const ids = block.tasks.map((t) => t.id);
    const [moved] = ids.splice(dragIdx, 1);
    ids.splice(dragOverIdx, 0, moved);
    await reorderTasksInBlock(block.id, ids);
    setDragIdx(null); setDragOverIdx(null);
    onUpdate();
  };

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, background: dark ? '#0f0f0f' : '#fafafa', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: block.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{block.title}</div>
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>
            {parseIsoDay(block.day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {fmtHour(block.startHour)} — {fmtHour(block.endHour)}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.4, padding: 4 }}>×</button>
      </div>

      {/* Task queue */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {block.tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', opacity: 0.3, fontSize: 12 }}>
            No tasks in this block yet.
          </div>
        )}

        {block.tasks.map((task, idx) => {
          const isActive = task.status === 'in_progress';
          const isDone = task.status === 'completed';
          const isDragOver = dragOverIdx === idx;

          return (
            <div
              key={task.id}
              draggable
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => handleTaskClick(task, e)}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
              onDrop={handleDragEnd}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${isActive ? block.color : isDragOver ? '#3b82f680' : border}`,
                background: isActive ? `${block.color}12` : isDragOver ? 'rgba(59,130,246,0.05)' : 'transparent',
                marginBottom: 6,
                cursor: 'pointer',
                opacity: isDone ? 0.5 : 1,
                transition: 'all 0.12s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Status button */}
                <button
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive) {
                      updateTaskInBlock(block.id, task.id, { status: 'completed' }).then(() => onUpdate());
                    } else if (!isDone) {
                      updateTaskInBlock(block.id, task.id, { status: 'in_progress' }).then(() => onUpdate());
                    }
                  }}
                  style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: `2px solid ${statusColor(task.status)}`,
                    background: isDone ? statusColor(task.status) : 'transparent',
                    color: isDone ? '#fff' : statusColor(task.status),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0, padding: 0,
                  }}
                >
                  {statusIcon(task.status)}
                </button>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.name}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add task form */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
        <input
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          onContextMenu={(e) => e.preventDefault()}
          placeholder="Task name..."
          style={{ width: '100%', fontSize: 12, fontFamily: FONT_FAMILY, padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 6, background: bg2, color: 'inherit', outline: 'none', marginBottom: 6 }}
        />
        <textarea
          value={newTaskDesc}
          onChange={(e) => setNewTaskDesc(e.target.value)}
          onContextMenu={(e) => e.preventDefault()}
          placeholder="Description / prompt for NEURO... (optional)"
          rows={2}
          style={{ width: '100%', fontSize: 11, fontFamily: FONT_FAMILY, padding: '6px 10px', border: `1px solid ${border}`, borderRadius: 6, background: bg2, color: 'inherit', outline: 'none', resize: 'none', marginBottom: 6 }}
        />
        <button
          onClick={handleAddTask}
          disabled={!newTaskName.trim()}
          style={{
            width: '100%', fontSize: 11, fontWeight: 600, fontFamily: FONT_FAMILY,
            padding: '7px 0', borderRadius: 6, border: 'none',
            background: newTaskName.trim() ? block.color : border,
            color: newTaskName.trim() ? '#fff' : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
            cursor: newTaskName.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.12s',
          }}
        >
          Add Task
        </button>
      </div>

      {/* Task popover */}
      {selectedTask && popoverPos && (
        <TaskPopover
          task={selectedTask}
          block={block}
          position={popoverPos}
          onClose={() => { setSelectedTask(null); setPopoverPos(null); }}
          onUpdate={onUpdate}
          dark={dark}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CALENDAR GRID
// ════════════════════════════════════════════════════════════════════════════

function WeekCalendar({
  blocks, onBlockClick, onRefresh, dark, weekStart, setWeekStart,
}: {
  blocks: TimeBlock[];
  onBlockClick: (block: TimeBlock) => void;
  onRefresh: () => void;
  dark: boolean;
  weekStart: Date;
  setWeekStart: (d: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [dragCreate, setDragCreate] = useState<{ colIdx: number; startY: number; currentY: number } | null>(null);
  const [dragBlock, setDragBlock] = useState<{ blockId: string; action: 'move' | 'resize'; startMouseY: number; startMouseX: number; origStartHour: number; origEndHour: number; origCol: number } | null>(null);

  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textMuted = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const today = new Date();
  const todayIso = isoDay(today);
  const todayStartOfDay = new Date(today);
  todayStartOfDay.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, today.getHours() * HOUR_PX - 300);
  }, []);

  // ── Create block by drag ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const col = xToCol(e.clientX, rect);
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    setDragCreate({ colIdx: col, startY: y, currentY: y });
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragCreate || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    setDragCreate((prev) => prev ? { ...prev, currentY: y } : null);
  }, [dragCreate]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!dragCreate) return;
    const y1 = Math.min(dragCreate.startY, dragCreate.currentY);
    const y2 = Math.max(dragCreate.startY, dragCreate.currentY);
    if (y2 - y1 < HOUR_PX * 0.3) { setDragCreate(null); return; }
    const startH = yToHour(y1);
    const endH = yToHour(y2);
    const day = isoDay(days[dragCreate.colIdx]);
    const blockDay = parseIsoDay(day);

    // Prevent past date scheduling
    if (blockDay < todayStartOfDay) {
      alert('Cannot schedule tasks in the past');
      setDragCreate(null);
      return;
    }

    const colorIdx = blocks.length % BLOCK_COLORS.length;
    const created = await createBlock(day, startH, endH, 'Work session', BLOCK_COLORS[colorIdx]);
    setDragCreate(null);
    onRefresh();
    onBlockClick(created);
  }, [dragCreate, days, blocks.length, onRefresh, onBlockClick, todayStartOfDay]);

  // ── Move/resize existing block ──
  const startBlockDrag = useCallback((e: React.MouseEvent, block: TimeBlock, action: 'move' | 'resize') => {
    e.stopPropagation(); e.preventDefault();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragBlock({
      blockId: block.id, action,
      startMouseY: e.clientY, startMouseX: e.clientX,
      origStartHour: block.startHour, origEndHour: block.endHour,
      origCol: days.findIndex((d) => isoDay(d) === block.day),
    });
  }, [days]);

  useEffect(() => {
    if (!dragBlock) return;
    const onUp = async (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) { setDragBlock(null); return; }
      const deltaY = e.clientY - dragBlock.startMouseY;
      const deltaHours = snapHour(deltaY / HOUR_PX);
      const newCol = xToCol(e.clientX, rect);
      const dayDelta = newCol - dragBlock.origCol;
      const newDay = isoDay(addDays(weekStart, newCol));
      const newDayParsed = parseIsoDay(newDay);

      // Prevent moving to past
      if (newDayParsed < todayStartOfDay) {
        alert('Cannot schedule tasks in the past');
        setDragBlock(null);
        return;
      }

      if (dragBlock.action === 'move') {
        await moveBlock(dragBlock.blockId, newDay, dragBlock.origStartHour + deltaHours, dragBlock.origEndHour + deltaHours);
      } else {
        await resizeBlock(dragBlock.blockId, dragBlock.origEndHour + deltaHours);
      }
      setDragBlock(null);
      onRefresh();
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [dragBlock, weekStart, onRefresh, todayStartOfDay]);

  const goWeek = (d: number) => setWeekStart(addDays(weekStart, d * 7));
  const nowHour = today.getHours() + today.getMinutes() / 60;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT_FAMILY }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${border}`, gap: 10, flexShrink: 0 }}>
        <button onClick={() => goWeek(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.4, padding: '0 4px' }}>‹</button>
        <div style={{ fontSize: 13, fontWeight: 600, minWidth: 200 }}>
          {weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })} — {addDays(weekStart, 6).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <button onClick={() => goWeek(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.4, padding: '0 4px' }}>›</button>
        <button onClick={() => setWeekStart(mondayOfWeek(new Date()))} style={{ fontSize: 10, fontWeight: 600, padding: '4px 12px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', fontFamily: FONT_FAMILY }}>Today</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: `${TIME_GUTTER}px repeat(7, 1fr)`, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div />
        {days.map((day) => {
          const iso = isoDay(day);
          const isToday = iso === todayIso;
          return (
            <div key={iso} style={{ textAlign: 'center', padding: '8px 0 6px', borderLeft: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: isToday ? '#3b82f6' : textMuted }}>{DAY_NAMES[days.indexOf(day)]}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, width: 32, height: 32, lineHeight: '32px', borderRadius: '50%', margin: '0 auto', background: isToday ? '#3b82f6' : 'transparent', color: isToday ? '#fff' : dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div
          ref={gridRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ display: 'grid', gridTemplateColumns: `${TIME_GUTTER}px repeat(7, 1fr)`, position: 'relative', minHeight: HOURS.length * HOUR_PX, userSelect: 'none', cursor: dragCreate ? 'ns-resize' : 'default' }}
        >
          {/* Time labels */}
          <div>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_PX, fontSize: 9, color: textMuted, textAlign: 'right', paddingRight: 6, paddingTop: 2, borderBottom: `1px solid ${border}`, boxSizing: 'border-box' }}>
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIdx) => {
            const iso = isoDay(day);
            const colBlocks = blocks.filter((b) => b.day === iso);

            return (
              <div key={iso} style={{ position: 'relative', borderLeft: `1px solid ${border}` }} onContextMenu={(e) => e.preventDefault()}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_PX, borderBottom: `1px solid ${border}` }} />
                ))}

                {/* Blocks */}
                {colBlocks.map((block) => {
                  const top = hourToY(block.startHour);
                  const height = Math.max((block.endHour - block.startHour) * HOUR_PX, 24);
                  const taskCount = block.tasks.length;
                  const doneCount = block.tasks.filter((t) => t.status === 'completed').length;

                  return (
                    <div
                      key={block.id}
                      data-block
                      onClick={(e) => { e.stopPropagation(); onBlockClick(block); }}
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).dataset.resize) startBlockDrag(e, block, 'resize');
                        else startBlockDrag(e, block, 'move');
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      style={{
                        position: 'absolute', top, left: 3, right: 3, height,
                        background: `${block.color}15`,
                        border: `1px solid ${block.color}50`,
                        borderLeft: `4px solid ${block.color}`,
                        borderRadius: 8,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        zIndex: 3,
                        transition: 'box-shadow 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: block.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {block.title}
                      </div>
                      <div style={{ fontSize: 9, color: textMuted, marginTop: 1 }}>
                        {fmtHour(block.startHour)} — {fmtHour(block.endHour)}
                      </div>

                      {/* Task preview */}
                      {taskCount > 0 && height > 60 && (
                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {block.tasks.slice(0, Math.floor((height - 50) / 16)).map((t) => (
                            <div key={t.id} style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, opacity: t.status === 'completed' ? 0.4 : 1 }}>
                              <span style={{ color: statusColor(t.status), fontSize: 8 }}>{statusIcon(t.status)}</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>{t.name}</span>
                            </div>
                          ))}
                          {taskCount > Math.floor((height - 50) / 16) && (
                            <div style={{ fontSize: 8, opacity: 0.4 }}>+{taskCount - Math.floor((height - 50) / 16)} more</div>
                          )}
                        </div>
                      )}

                      {taskCount > 0 && height <= 60 && (
                        <div style={{ fontSize: 8, opacity: 0.5, marginTop: 2 }}>
                          {doneCount}/{taskCount} done
                        </div>
                      )}

                      {/* Resize handle */}
                      <div data-resize="true" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, cursor: 'ns-resize', borderRadius: '0 0 8px 8px', background: `${block.color}25` }} />
                    </div>
                  );
                })}

                {/* Drag-create highlight */}
                {dragCreate && dragCreate.colIdx === colIdx && (() => {
                  const y1 = Math.min(dragCreate.startY, dragCreate.currentY);
                  const y2 = Math.max(dragCreate.startY, dragCreate.currentY);
                  return (
                    <div style={{ position: 'absolute', top: y1, height: y2 - y1, left: 3, right: 3, background: 'rgba(59,130,246,0.12)', border: '2px dashed rgba(59,130,246,0.5)', borderRadius: 8, zIndex: 20, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                      {fmtHour(yToHour(y1))} — {fmtHour(yToHour(y2))}
                    </div>
                  );
                })()}

                {/* Now line */}
                {iso === todayIso && nowHour >= HOURS[0] && nowHour <= HOURS[HOURS.length - 1] + 1 && (
                  <div style={{ position: 'absolute', top: hourToY(nowHour), left: 0, right: 0, height: 2, background: '#ef4444', zIndex: 10, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

export function TasksPage() {
  const { dark } = useTheme();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [openBlock, setOpenBlock] = useState<TimeBlock | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));

  const refresh = useCallback(async () => {
    const b = await getBlocks();
    setBlocks(b);
    // Refresh open block
    if (openBlock) {
      const updated = b.find((x) => x.id === openBlock.id);
      if (updated) setOpenBlock(updated);
      else setOpenBlock(null);
    }
  }, [openBlock]);

  useEffect(() => { refresh(); }, []);
  useEffect(() => { const iv = setInterval(refresh, 4000); return () => clearInterval(iv); }, [refresh]);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: FONT_FAMILY, background: dark ? '#0a0a0a' : '#fff', color: dark ? '#fff' : '#000' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>

      {/* Calendar */}
      <WeekCalendar
        blocks={blocks}
        onBlockClick={(b) => setOpenBlock(b)}
        onRefresh={refresh}
        dark={dark}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
      />

      {/* Right panel: block detail only */}
      {openBlock && (
        <BlockDetail block={openBlock} onClose={() => setOpenBlock(null)} onUpdate={refresh} dark={dark} />
      )}
    </div>
  );
}

export default TasksPage;
