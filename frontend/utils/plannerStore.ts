/**
 * Planner Store — IndexedDB persistence for time blocks and task queues.
 *
 * Architecture:
 *   TimeBlock = a scheduled window of time on the calendar (e.g. "Work session 9–12")
 *   PlanTask  = a unit of work inside a block, executed sequentially top→bottom
 *   Backlog   = unscheduled tasks not yet assigned to any block
 */

import { openDB, type DBSchema } from 'idb';

// ── Types ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

export interface PlanTask {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  progress?: number;        // 0–100
  createdAt: number;
  completedAt?: number;
}

export interface TimeBlock {
  id: string;
  title: string;
  /** Day as ISO date string YYYY-MM-DD */
  day: string;
  /** Start hour (decimal, e.g. 9.5 = 9:30 AM) */
  startHour: number;
  /** End hour (decimal) */
  endHour: number;
  /** Ordered task queue — priority = index 0 is first */
  tasks: PlanTask[];
  /** Visual color accent */
  color: string;
}

// ── DB ──────────────────────────────────────────────────────────────────────

interface PlannerDB extends DBSchema {
  blocks: { key: string; value: TimeBlock };
  backlog: { key: string; value: PlanTask };
}

const DB_NAME = 'neuro_planner';
const DB_VER = 1;

let _db: ReturnType<typeof openDB<PlannerDB>> | null = null;
function db() {
  if (!_db) {
    _db = openDB<PlannerDB>(DB_NAME, DB_VER, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('blocks')) d.createObjectStore('blocks', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('backlog')) d.createObjectStore('backlog', { keyPath: 'id' });
      },
    });
  }
  return _db;
}

// ── ID generator ────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Block CRUD ──────────────────────────────────────────────────────────────

export async function getBlocks(): Promise<TimeBlock[]> {
  return (await db()).getAll('blocks');
}

export async function getBlock(id: string): Promise<TimeBlock | undefined> {
  return (await db()).get('blocks', id);
}

export async function createBlock(day: string, startHour: number, endHour: number, title?: string, color?: string): Promise<TimeBlock> {
  const block: TimeBlock = {
    id: uid(),
    title: title || 'Work session',
    day,
    startHour,
    endHour: Math.max(endHour, startHour + 0.25),
    tasks: [],
    color: color || '#3b82f6',
  };
  await (await db()).put('blocks', block);
  return block;
}

export async function updateBlock(id: string, updates: Partial<Omit<TimeBlock, 'id'>>): Promise<void> {
  const d = await db();
  const block = await d.get('blocks', id);
  if (!block) return;
  Object.assign(block, updates);
  await d.put('blocks', block);
}

export async function deleteBlock(id: string): Promise<void> {
  await (await db()).delete('blocks', id);
}

export async function moveBlock(id: string, day: string, startHour: number, endHour: number): Promise<void> {
  await updateBlock(id, { day, startHour, endHour });
}

export async function resizeBlock(id: string, endHour: number): Promise<void> {
  const d = await db();
  const block = await d.get('blocks', id);
  if (!block) return;
  block.endHour = Math.max(endHour, block.startHour + 0.25);
  await d.put('blocks', block);
}

// ── Task Queue Operations ───────────────────────────────────────────────────

export async function addTaskToBlock(blockId: string, name: string, description?: string): Promise<PlanTask> {
  const d = await db();
  const block = await d.get('blocks', blockId);
  if (!block) throw new Error('Block not found');
  const task: PlanTask = { id: uid(), name, description, status: 'not_started', createdAt: Date.now() };
  block.tasks.push(task);
  await d.put('blocks', block);
  return task;
}

export async function updateTaskInBlock(blockId: string, taskId: string, updates: Partial<Omit<PlanTask, 'id'>>): Promise<void> {
  const d = await db();
  const block = await d.get('blocks', blockId);
  if (!block) return;
  const task = block.tasks.find((t) => t.id === taskId);
  if (!task) return;
  Object.assign(task, updates);
  if (updates.status === 'completed') task.completedAt = Date.now();
  await d.put('blocks', block);
}

export async function removeTaskFromBlock(blockId: string, taskId: string): Promise<void> {
  const d = await db();
  const block = await d.get('blocks', blockId);
  if (!block) return;
  block.tasks = block.tasks.filter((t) => t.id !== taskId);
  await d.put('blocks', block);
}

export async function reorderTasksInBlock(blockId: string, taskIds: string[]): Promise<void> {
  const d = await db();
  const block = await d.get('blocks', blockId);
  if (!block) return;
  const map = new Map(block.tasks.map((t) => [t.id, t]));
  block.tasks = taskIds.map((id) => map.get(id)!).filter(Boolean);
  await d.put('blocks', block);
}

export async function moveTaskBetweenBlocks(
  fromBlockId: string,
  toBlockId: string,
  taskId: string,
  insertIndex?: number
): Promise<void> {
  const d = await db();
  const from = await d.get('blocks', fromBlockId);
  const to = await d.get('blocks', toBlockId);
  if (!from || !to) return;
  const taskIdx = from.tasks.findIndex((t) => t.id === taskId);
  if (taskIdx === -1) return;
  const [task] = from.tasks.splice(taskIdx, 1);
  if (insertIndex !== undefined) to.tasks.splice(insertIndex, 0, task);
  else to.tasks.push(task);
  await d.put('blocks', from);
  await d.put('blocks', to);
}

/** Complete current task, advance to next in queue */
export async function advanceQueue(blockId: string): Promise<PlanTask | null> {
  const d = await db();
  const block = await d.get('blocks', blockId);
  if (!block) return null;
  const current = block.tasks.find((t) => t.status === 'in_progress');
  if (current) { current.status = 'completed'; current.completedAt = Date.now(); }
  const next = block.tasks.find((t) => t.status === 'not_started');
  if (next) { next.status = 'in_progress'; }
  await d.put('blocks', block);
  return next || null;
}

// ── Backlog ─────────────────────────────────────────────────────────────────

export async function getBacklog(): Promise<PlanTask[]> {
  return (await db()).getAll('backlog');
}

export async function addToBacklog(name: string, description?: string): Promise<PlanTask> {
  const task: PlanTask = { id: uid(), name, description, status: 'not_started', createdAt: Date.now() };
  await (await db()).put('backlog', task);
  return task;
}

export async function removeFromBacklog(taskId: string): Promise<void> {
  await (await db()).delete('backlog', taskId);
}

export async function moveBacklogToBlock(taskId: string, blockId: string, insertIndex?: number): Promise<void> {
  const d = await db();
  const task = await d.get('backlog', taskId);
  if (!task) return;
  const block = await d.get('blocks', blockId);
  if (!block) return;
  if (insertIndex !== undefined) block.tasks.splice(insertIndex, 0, task);
  else block.tasks.push(task);
  await d.put('blocks', block);
  await d.delete('backlog', taskId);
}

export async function moveBlockTaskToBacklog(blockId: string, taskId: string): Promise<void> {
  const d = await db();
  const block = await d.get('blocks', blockId);
  if (!block) return;
  const idx = block.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;
  const [task] = block.tasks.splice(idx, 1);
  task.status = 'not_started';
  await d.put('blocks', block);
  await d.put('backlog', task);
}

// ── Carry-over Logic ────────────────────────────────────────────────────────

/** Move incomplete tasks from an expired block to the next available block */
export async function carryOverIncompleteTasks(expiredBlockId: string): Promise<void> {
  const d = await db();
  const expired = await d.get('blocks', expiredBlockId);
  if (!expired) return;
  const incomplete = expired.tasks.filter((t) => t.status !== 'completed');
  if (incomplete.length === 0) return;

  // Find the next block chronologically
  const allBlocks = await d.getAll('blocks');
  const sorted = allBlocks
    .filter((b) => b.id !== expiredBlockId && (b.day > expired.day || (b.day === expired.day && b.startHour > expired.endHour)))
    .sort((a, b) => a.day.localeCompare(b.day) || a.startHour - b.startHour);

  if (sorted.length === 0) return; // No future block — tasks stay

  const nextBlock = sorted[0];
  // Prepend incomplete tasks to the top of the next block
  nextBlock.tasks = [...incomplete.map((t) => ({ ...t, status: 'not_started' as TaskStatus })), ...nextBlock.tasks];
  expired.tasks = expired.tasks.filter((t) => t.status === 'completed');

  await d.put('blocks', expired);
  await d.put('blocks', nextBlock);
}
