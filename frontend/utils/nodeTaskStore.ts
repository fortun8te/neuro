/**
 * Node.js File-Based Task Store
 * Simple JSON file storage for CLI task persistence
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STORE_DIR = join(homedir(), '.neuro', 'tasks');
const DB_FILE = join(STORE_DIR, 'tasks.json');

export interface StoredTask {
  id: string;
  title: string;
  description: string;
  prompt: string;
  status: 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'error' | 'archived';
  progress: number;
  currentPhase: string;
  lastHeartbeat: number;
  checkpoints: any[];
  failureCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;
  result?: string;
  error?: string;
}

let store: Map<string, StoredTask> | null = null;

function ensureDir() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function load() {
  ensureDir();
  if (existsSync(DB_FILE)) {
    try {
      const data = readFileSync(DB_FILE, 'utf-8');
      const tasks = JSON.parse(data) as StoredTask[];
      store = new Map(tasks.map(t => [t.id, t]));
    } catch (e) {
      store = new Map();
    }
  } else {
    store = new Map();
  }
}

function save() {
  if (!store) return;
  ensureDir();
  const tasks = Array.from(store.values());
  writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

export const nodeTaskStore = {
  async get(id: string): Promise<StoredTask | undefined> {
    if (!store) load();
    return store!.get(id);
  },

  async put(task: StoredTask): Promise<void> {
    if (!store) load();
    store!.set(task.id, task);
    save();
  },

  async delete(id: string): Promise<void> {
    if (!store) load();
    store!.delete(id);
    save();
  },

  async getAll(): Promise<StoredTask[]> {
    if (!store) load();
    return Array.from(store!.values());
  },

  async clear(): Promise<void> {
    store = new Map();
    save();
  },
};
