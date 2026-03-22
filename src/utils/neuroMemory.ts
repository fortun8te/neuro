/**
 * neuroMemory.ts -- Two-tier memory system for the Neuro agent.
 *
 * Tier 1: Curated long-term memory (max ~100 entries, persisted as JSON in VFS)
 * Tier 2: Daily activity log + session transcripts (JSONL in VFS)
 *
 * Inspired by OpenClaw's approach, adapted for browser-based VFS.
 */

import { vfs, vfsReady } from './sessionFileSystem';

// ── Types ──────────────────────────────────────────────────────────────────

export type MemoryCategory = 'preference' | 'fact' | 'decision' | 'rule' | 'context';

export interface MemoryEntry {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: number;
  source: string; // which session/task created this
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `nmem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]; // 2026-03-22
}

function timeString(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── REMEMBER tag regex ──────────────────────────────────────────────────────

const REMEMBER_RE = /\[REMEMBER:\s*(.+?)\]/g;

// ── NeuroMemory class ───────────────────────────────────────────────────────

class NeuroMemory {
  private entries: MemoryEntry[] = [];
  private dailyLog: string[] = [];
  private currentDate: string = '';
  private _ready = false;

  // ── Init (load from VFS) ──────────────────────────────────────────────

  async init(): Promise<void> {
    if (this._ready) return;
    await vfsReady();
    this.ensureFolders();
    this.loadMemories();
    this.loadDailyLog();
    this._ready = true;
  }

  get ready(): boolean {
    return this._ready;
  }

  // ── Tier 1: Curated long-term memory ──────────────────────────────────

  /**
   * Add a curated memory (long-term, max ~100 entries).
   * Rules are never evicted; other categories keep most recent 80.
   */
  async remember(content: string, category: MemoryCategory, source: string): Promise<void> {
    await this.init();

    // Deduplicate: skip if identical content already exists
    if (this.entries.some(e => e.content === content)) return;

    this.entries.push({
      id: generateId(),
      content,
      category,
      createdAt: Date.now(),
      source,
    });

    if (this.entries.length > 100) {
      const rules = this.entries.filter(e => e.category === 'rule');
      const nonRules = this.entries.filter(e => e.category !== 'rule');
      this.entries = [...rules, ...nonRules.slice(-Math.max(80, 100 - rules.length))];
    }

    this.persist();
  }

  /**
   * Remove a memory by ID.
   */
  async forget(id: string): Promise<void> {
    await this.init();
    this.entries = this.entries.filter(e => e.id !== id);
    this.persist();
  }

  /**
   * Get all curated memories.
   */
  getEntries(): ReadonlyArray<MemoryEntry> {
    return this.entries;
  }

  /**
   * Search memories by keyword (simple substring match).
   * Returns top 5 matches.
   */
  search(query: string): MemoryEntry[] {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];
    return this.entries
      .filter(e => words.some(w => e.content.toLowerCase().includes(w)))
      .slice(0, 5);
  }

  // ── Tier 2: Daily activity log ────────────────────────────────────────

  /**
   * Append an entry to today's daily log.
   */
  async log(entry: string): Promise<void> {
    await this.init();
    const today = todayString();
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.dailyLog = [];
    }
    this.dailyLog.push(`${timeString()} -- ${entry}`);
    this.persistDailyLog();
  }

  /**
   * Get today's log entries.
   */
  getDailyLog(): ReadonlyArray<string> {
    return this.dailyLog;
  }

  // ── Tier 2: Session transcripts ───────────────────────────────────────

  /**
   * Append a transcript entry for a session.
   */
  async appendTranscript(sessionId: string, entry: TranscriptEntry): Promise<void> {
    await this.init();
    const line = JSON.stringify(entry);
    const path = `/nomad/memory/sessions/${sessionId}`;
    const existing = vfs.readFile(`${path}/transcript.jsonl`);
    const content = existing?.data ? `${existing.data}\n${line}` : line;
    vfs.createFile(path, 'transcript.jsonl', content, 'application/jsonl');
  }

  // ── Context for system prompt ─────────────────────────────────────────

  /**
   * Build a context block to inject into the LLM system prompt.
   * Includes long-term memories and recent daily activity.
   */
  getContextForPrompt(): string {
    const memories = this.entries.map(e => `- [${e.category}] ${e.content}`).join('\n');
    const log = this.dailyLog.slice(-20).join('\n'); // last 20 entries from today
    return `## Long-term Memory\n${memories || '(none yet)'}\n\n## Today\'s Activity\n${log || '(nothing yet)'}`;
  }

  // ── Parse REMEMBER tags from LLM output ───────────────────────────────

  /**
   * Scan LLM response text for [REMEMBER: ...] tags.
   * Calls remember() for each found tag. Returns cleaned text (tags removed).
   */
  async parseAndRemember(text: string, source: string): Promise<string> {
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    // Reset regex state
    REMEMBER_RE.lastIndex = 0;
    while ((match = REMEMBER_RE.exec(text)) !== null) {
      matches.push(match[1].trim());
    }

    for (const content of matches) {
      // Infer category from content
      const category = inferCategory(content);
      await this.remember(content, category, source);
    }

    // Remove tags from displayed text
    return text.replace(REMEMBER_RE, '').trim();
  }

  // ── Persistence (VFS) ─────────────────────────────────────────────────

  private ensureFolders(): void {
    // These calls are idempotent -- createFolder returns existing if present
    if (!vfs.getByPath('/nomad/memory')) {
      vfs.createFolder('/nomad', 'memory');
    }
    if (!vfs.getByPath('/nomad/memory/daily')) {
      vfs.createFolder('/nomad/memory', 'daily');
    }
    if (!vfs.getByPath('/nomad/memory/sessions')) {
      vfs.createFolder('/nomad/memory', 'sessions');
    }
  }

  private persist(): void {
    const content = JSON.stringify(this.entries, null, 2);
    vfs.createFile('/nomad/memory', 'memories.json', content, 'application/json');
  }

  private persistDailyLog(): void {
    const today = todayString();
    const content = this.dailyLog.join('\n');
    vfs.createFile('/nomad/memory/daily', `${today}.md`, content, 'text/markdown');
  }

  private loadMemories(): void {
    const file = vfs.readFile('/nomad/memory/memories.json');
    if (file?.data) {
      try {
        const parsed = JSON.parse(file.data);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        }
      } catch { /* corrupt data -- start fresh */ }
    }
  }

  private loadDailyLog(): void {
    const today = todayString();
    this.currentDate = today;
    const file = vfs.readFile(`/nomad/memory/daily/${today}.md`);
    if (file?.data) {
      this.dailyLog = file.data.split('\n').filter(Boolean);
    }
  }
}

// ── Category inference ──────────────────────────────────────────────────────

function inferCategory(content: string): MemoryCategory {
  const lower = content.toLowerCase();
  if (/\b(prefer|like|dislike|want|style|tone|hate)\b/.test(lower)) return 'preference';
  if (/\b(always|never|must|rule|guideline|require)\b/.test(lower)) return 'rule';
  if (/\b(decided|chose|picked|selected|went with|decision)\b/.test(lower)) return 'decision';
  if (/\b(located|based in|lives in|works at|name is|born|age)\b/.test(lower)) return 'fact';
  return 'context';
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const neuroMemory = new NeuroMemory();
