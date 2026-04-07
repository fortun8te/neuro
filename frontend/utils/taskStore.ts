/**
 * Task Store — IndexedDB persistence for task logs and execution history
 * Uses idb-keyval with a custom store for task data.
 */
import { createStore, get, set, del, keys, getMany } from 'idb-keyval';

const taskStore = createStore('neuro-task-logs', 'tasks');

export interface TaskToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
}

export interface TaskReflection {
  goalAchieved: number;      // 0-10
  toolEfficiency: number;    // 0-10
  researchQuality: number;   // 0-10
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  whatWorked: string[];
  whatFailed: string[];
  improvements: string[];
  summary: string;
  gradedAt: number;
}

export interface TaskLog {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  toolCalls: TaskToolCall[];
  result?: string;
  error?: string;
  tokenCount?: number;
  reflection?: TaskReflection;
}

export async function saveTaskLog(log: TaskLog): Promise<void> {
  await set(log.id, log, taskStore);
}

export async function getTaskLog(id: string): Promise<TaskLog | undefined> {
  return get<TaskLog>(id, taskStore);
}

export async function updateTaskLog(id: string, update: Partial<TaskLog>): Promise<void> {
  const existing = await get<TaskLog>(id, taskStore);
  if (existing) {
    await set(id, { ...existing, ...update }, taskStore);
  }
}

export async function getAllTaskLogs(limit = 50): Promise<TaskLog[]> {
  const allKeys = await keys(taskStore);
  const logs = await getMany(allKeys as string[], taskStore) as (TaskLog | undefined)[];
  return logs
    .filter((l): l is TaskLog => l !== undefined)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit);
}

export async function deleteTaskLog(id: string): Promise<void> {
  await del(id, taskStore);
}

export async function getTaskStats(): Promise<{
  total: number;
  completed: number;
  failed: number;
  avgDurationMs: number;
  gradeDistribution: Record<string, number>;
}> {
  const logs = await getAllTaskLogs(200);
  const completed = logs.filter(l => l.status === 'completed');
  const failed = logs.filter(l => l.status === 'failed');
  const withDuration = completed.filter(l => l.durationMs);
  const avgDurationMs = withDuration.length > 0
    ? withDuration.reduce((s, l) => s + (l.durationMs ?? 0), 0) / withDuration.length
    : 0;
  const gradeDistribution: Record<string, number> = {};
  for (const log of logs) {
    if (log.reflection?.overallGrade) {
      const g = log.reflection.overallGrade;
      gradeDistribution[g] = (gradeDistribution[g] ?? 0) + 1;
    }
  }
  return { total: logs.length, completed: completed.length, failed: failed.length, avgDurationMs, gradeDistribution };
}
