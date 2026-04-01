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

export type MemoryCategory = 'preference' | 'fact' | 'decision' | 'rule' | 'context' | 'principle';

// OpenClaw-inspired 3-layer memory classification
export type MemoryLayer = 'episodic' | 'semantic' | 'procedural';

function inferLayer(category: MemoryCategory): MemoryLayer {
  if (category === 'fact' || category === 'context') return 'episodic';
  if (category === 'preference') return 'semantic';
  return 'procedural'; // rule, decision, principle
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: MemoryCategory;
  layer: MemoryLayer;
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

// ── Tag regexes ─────────────────────────────────────────────────────────────

const REMEMBER_RE = /\[REMEMBER:\s*(.+?)\]/g;
const PRINCIPLE_RE = /\[PRINCIPLE:\s*(.+?)\]/g;

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
    this.loadYesterdayLog();
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
      layer: inferLayer(category),
      createdAt: Date.now(),
      source,
    });

    if (this.entries.length > 100) {
      // Principles and rules are never evicted — they're hard-earned
      const permanent = this.entries.filter(e => e.category === 'rule' || e.category === 'principle');
      const evictable = this.entries.filter(e => e.category !== 'rule' && e.category !== 'principle');
      this.entries = [...permanent, ...evictable.slice(-Math.max(80, 100 - permanent.length))];
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
   * Search memories by weighted keyword matching.
   * Scores results by how many query words match + category boost.
   * Returns top 5 matches sorted by relevance.
   */
  search(query: string, limit = 5): MemoryEntry[] {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const scored = this.entries.map(e => {
      const contentLower = e.content.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (contentLower.includes(word)) score += 1;
      }
      // Boost principles and rules (higher-value memories)
      if (e.category === 'principle' || e.category === 'rule') score *= 1.3;
      return { entry: e, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
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

  // ── Flush (called before context compression) ─────────────────────────

  /**
   * Persist current in-memory state and log a compaction marker.
   * Called before context window compression so no findings are lost.
   */
  async flush(recentEntries?: string[]): Promise<void> {
    await this.init();
    await this.log('[compaction] context window nearing limit — state flushed');
    // Auto-extract key facts from recent context if provided
    if (recentEntries && recentEntries.length > 0) {
      const combined = recentEntries.join('\n').slice(0, 2000);
      // Extract any inline [REMEMBER:...] tags from recent context
      REMEMBER_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = REMEMBER_RE.exec(combined)) !== null) {
        const content = match[1].trim();
        const category = inferCategory(content);
        await this.remember(content, category, 'compaction-flush');
      }
    }
    this.persist();
    this.persistDailyLog();
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
   * Includes long-term memories and today's + yesterday's activity.
   */
  getContextForPrompt(): string {
    if (this.entries.length === 0 && this.dailyLog.length === 0 && this.yesterdayLog.length === 0) {
      return '';
    }
    const parts: string[] = [];

    // Principles surface first — earned insights that shape Neuro's approach
    const principles = this.entries.filter(e => e.category === 'principle');
    if (principles.length > 0) {
      parts.push(`## Learned Principles\n${principles.map(e => `- ${e.content}`).join('\n')}`);
    }

    // Procedural memory: rules + decisions (how to do things)
    const procedural = this.entries.filter(e => e.layer === 'procedural' && e.category !== 'principle');
    if (procedural.length > 0) {
      parts.push(`## Procedural Memory\n${procedural.map(e => `- [${e.category}] ${e.content}`).join('\n')}`);
    }

    // Semantic memory: preferences + known facts
    const semantic = this.entries.filter(e => e.layer === 'semantic');
    if (semantic.length > 0) {
      parts.push(`## Semantic Memory\n${semantic.map(e => `- [${e.category}] ${e.content}`).join('\n')}`);
    }

    // Episodic memory: events + context
    const episodic = this.entries.filter(e => e.layer === 'episodic');
    if (episodic.length > 0) {
      parts.push(`## Episodic Memory\n${episodic.map(e => `- ${e.content}`).join('\n')}`);
    }

    // Daily activity log
    const recentLog = [
      ...this.yesterdayLog.slice(-10).map(l => `yesterday: ${l}`),
      ...this.dailyLog.slice(-20),
    ];
    if (recentLog.length > 0) {
      parts.push(`## Recent Activity\n${recentLog.join('\n')}`);
    }
    return parts.join('\n\n');
  }

  private yesterdayLog: string[] = [];

  /** Load yesterday's daily log entries (for cross-session continuity). */
  private loadYesterdayLog(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const file = vfs.readFile(`/nomad/memory/daily/${yStr}.md`);
    if (file?.data) {
      this.yesterdayLog = file.data.split('\n').filter(Boolean);
    }
  }

  // ── Parse REMEMBER tags from LLM output ───────────────────────────────

  /**
   * Scan LLM response text for [REMEMBER: ...] tags.
   * Calls remember() for each found tag. Returns cleaned text (tags removed).
   */
  async parseAndRemember(text: string, source: string): Promise<string> {
    // Parse [REMEMBER: ...] tags
    const remembers: string[] = [];
    let match: RegExpExecArray | null;
    REMEMBER_RE.lastIndex = 0;
    while ((match = REMEMBER_RE.exec(text)) !== null) {
      remembers.push(match[1].trim());
    }
    for (const content of remembers) {
      await this.remember(content, inferCategory(content), source);
    }

    // Parse [PRINCIPLE: ...] tags — earned insights stored as procedural layer
    const principles: string[] = [];
    PRINCIPLE_RE.lastIndex = 0;
    while ((match = PRINCIPLE_RE.exec(text)) !== null) {
      principles.push(match[1].trim());
    }
    for (const content of principles) {
      await this.remember(content, 'principle', source);
    }

    // Remove both tag types from displayed text
    return text.replace(REMEMBER_RE, '').replace(PRINCIPLE_RE, '').trim();
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
      } catch (e) { console.warn('[neuroMemory] Corrupt memory data, starting fresh:', e instanceof Error ? e.message : String(e)); }
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
