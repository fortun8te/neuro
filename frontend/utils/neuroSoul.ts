/**
 * neuroSoul.ts — OpenClaw-style soul document system for Neuro
 *
 * Files live at ~/Documents/Nomads/nomadfiles/neuro/identity/
 *   SOUL.md     — evolving character, values, worldview (agent can rewrite)
 *   STYLE.md    — voice, syntax, communication patterns
 *   MEMORY.md   — persistent cross-session facts, preferences, decisions
 *   sessions/YYYY-MM-DD.md — daily activity logs
 *
 * The agent reads these files on every session and can write/update them.
 * Changes persist to disk and survive restarts.
 */

import { getEnv } from '../config/envLoader';

const IDENTITY_DIR = getEnv('VITE_PROJECT_ROOT', '~/Downloads/nomads') + '/workspace/identity';
const SESSIONS_DIR = `${IDENTITY_DIR}/sessions`;

export type SoulFile = 'SOUL' | 'STYLE' | 'MEMORY' | 'USER';

// ── API helpers ───────────────────────────────────────────────────────────────

function expandPath(p: string): string {
  return p; // server-side expansion happens in the Node middleware
}

async function shellExec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const resp = await fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, timeout: 10000 }),
    });
    if (!resp.ok) return { stdout: '', stderr: 'Shell API not available', exitCode: 1 };
    return await resp.json();
  } catch { return { stdout: '', stderr: 'Shell API unreachable', exitCode: 1 }; }
}

async function readFile(path: string): Promise<string | null> {
  try {
    const resp = await fetch('/api/file/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, maxLines: 1000 }),
    });
    if (!resp.ok) return null;
    const r = await resp.json();
    return r.content ?? null;
  } catch { return null; }
}

async function writeFile(path: string, content: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/file/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    return resp.ok;
  } catch { return false; }
}

// ── Seed content ──────────────────────────────────────────────────────────────

const SEED_SOUL = `# Neuro — Soul Document

*This file defines who Neuro is. Neuro can read and update it. Changes persist across sessions.*

## Identity
- Name: Neuro
- Built by: Michael
- Purpose: Autonomous creative intelligence — research, strategy, ideation, execution

## Core Character
- Direct and confident. Never hedges unnecessarily.
- Genuinely curious — finds patterns others miss
- Loyal to Michael's vision above all
- Honest even when it's uncomfortable
- Gets things done instead of theorizing

## Values
- Speed over perfection on first pass
- Real data over assumptions
- Clear thinking over jargon
- Action over explanation

## How I Grow
Each session, I learn something. If I notice a pattern — a preference Michael has, something that works better, a mistake I keep making — I update this file.
`;

const SEED_STYLE = `# Neuro — Style Document

*Voice and communication patterns. Neuro should match this style in all responses.*

## Tone
- Casual, direct, no filler words
- Dutch-English code switch is normal and welcome
- Short sentences preferred over long ones
- No bullet hell — use prose when appropriate

## What to avoid
- "Certainly!" / "Absolutely!" / "Great question!"
- Em dashes (use -- or nothing)
- Excessive hedging ("I think", "perhaps", "it seems")
- Sycophancy of any kind
- Announcing what you're about to do instead of doing it

## Formatting
- Use markdown only when it genuinely helps (tables, code, lists)
- Keep responses tight — don't pad
- If the answer is one sentence, give one sentence
`;

const SEED_USER = `# User Profile — Michael

*This file is auto-maintained by Neuro. It captures preferences, patterns, and context about the user.*

## Communication Style
- Casual, direct, no fluff
- Prefers tables for data
- Wants sources cited
- Hates being asked obvious questions — just do the thing
- Dutch-English mix sometimes

## Work Patterns
- Builds things fast, iterates
- Prefers deliverables over discussions
- Wants files saved, not just displayed

## Preferences
- No emojis
- No filler phrases
- Tables > lists > paragraphs for data
- Always cite sources after research
- Auto-save research to workspace
`;

const SEED_MEMORY = `Neuro persistent memory -- cross-session facts, preferences, decisions.

About Michael:
- Direct, no-BS communication preferred
- Casual Dutch-English mix is normal
- Builds AI tools and creative systems

Preferences:
- No emojis unless asked
- No em dashes in output
- Terse by default, expand when asked

Decisions:
(Neuro appends learned decisions here)
`;

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Ensure the identity directory and seed files exist.
 * Called once at startup.
 */
export async function ensureSoulFiles(): Promise<void> {
  await shellExec(`mkdir -p "${IDENTITY_DIR.replace('~', '$HOME')}/sessions"`);

  const files: Array<{ name: SoulFile; seed: string }> = [
    { name: 'SOUL', seed: SEED_SOUL },
    { name: 'STYLE', seed: SEED_STYLE },
    { name: 'MEMORY', seed: SEED_MEMORY },
    { name: 'USER', seed: SEED_USER },
  ];

  for (const { name, seed } of files) {
    // MEMORY uses .txt (plain text), SOUL/STYLE use .md
    const ext = name === 'MEMORY' ? '.txt' : '.md';
    const p = `${IDENTITY_DIR}/${name}${ext}`;
    const existing = await readFile(p);
    if (!existing) {
      await writeFile(p, seed);
    }
  }
}

/** Extension for a given soul file */
function extFor(name: SoulFile): string {
  return name === 'MEMORY' ? '.txt' : '.md';
}

/**
 * Read a soul file. Returns content or empty string if not found.
 */
export async function readSoulFile(name: SoulFile): Promise<string> {
  const p = `${IDENTITY_DIR}/${name}${extFor(name)}`;
  return (await readFile(p)) ?? '';
}

/**
 * Overwrite a soul file with new content.
 */
export async function writeSoulFile(name: SoulFile, content: string): Promise<boolean> {
  const p = `${IDENTITY_DIR}/${name}${extFor(name)}`;
  return writeFile(p, content);
}

/**
 * Append a line to a soul file (e.g. add a memory entry without overwriting).
 * Auto-consolidates MEMORY.md when it grows too large.
 */
export async function appendToSoulFile(name: SoulFile, line: string): Promise<boolean> {
  const existing = await readSoulFile(name);
  const newContent = existing
    ? `${existing.trimEnd()}\n\n${line}\n`
    : `${line}\n`;
  const ok = await writeSoulFile(name, newContent);
  // Trigger async consolidation if MEMORY grows past threshold (don't await — fire & forget)
  if (ok && name === 'MEMORY' && newContent.length > 2800) {
    void consolidateMemory();
  }
  return ok;
}

/** Max chars before MEMORY.md gets LLM-compressed */
const MEMORY_CONSOLIDATION_THRESHOLD = 2800;
let _consolidationInProgress = false;

/**
 * Consolidate MEMORY.md using an LLM call — deduplicate, merge, summarize.
 * Only runs one at a time. Fire-and-forget safe.
 */
export async function consolidateMemory(): Promise<void> {
  if (_consolidationInProgress) return;
  _consolidationInProgress = true;
  try {
    const content = await readSoulFile('MEMORY');
    if (!content || content.length < MEMORY_CONSOLIDATION_THRESHOLD) return;

    // Inline LLM call via ollama API (avoid circular import with agentEngine)
    const resp = await fetch('/api/ollama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `You are a memory consolidator. Compress this memory file into a clean, deduplicated, well-organized document.

Rules:
- Keep ALL unique facts, preferences, and decisions — do not lose information
- Merge duplicate/similar entries into single concise facts
- Remove outdated entries superseded by newer ones
- Keep entries in categories (User Preferences, Project Context, Key Facts, Decisions)
- Target: under 1500 chars total
- Output ONLY the consolidated memory content, no preamble

MEMORY.md to consolidate:
${content}`,
        stream: false,
        options: { temperature: 0.1, num_predict: 800 },
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const consolidated = (data.response || '').trim();
    if (consolidated && consolidated.length > 100 && consolidated.length < content.length) {
      await writeSoulFile('MEMORY', consolidated + '\n');
      invalidateSoulCache();
    }
  } catch { /* non-critical */ } finally {
    _consolidationInProgress = false;
  }
}

/** Load skills from workspace/skills/ that are relevant to the current task */
const SKILLS_DIR = getEnv('VITE_PROJECT_ROOT', '~/Downloads/nomads') + '/workspace/skills';

export async function loadRelevantSkills(userMessage: string, workspaceId?: string): Promise<string> {
  try {
    // List skills directory
    const resp = await fetch('/api/file/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspaceId ? `${getEnv('VITE_PROJECT_ROOT', '~/Downloads/nomads')}/workspace/${workspaceId}/skills` : SKILLS_DIR }),
    });
    if (!resp.ok) return '';
    const { files } = await resp.json() as { files: string[] };
    if (!files || files.length === 0) return '';

    const msgWords = new Set(userMessage.toLowerCase().split(/\W+/).filter(w => w.length > 3));

    // Score each skill by keyword overlap
    const scored: Array<{ name: string; content: string; score: number }> = [];
    await Promise.all(files.filter(f => f.endsWith('.md')).slice(0, 20).map(async (f) => {
      try {
        const skillPath = workspaceId
          ? `${getEnv('VITE_PROJECT_ROOT', '~/Downloads/nomads')}/workspace/${workspaceId}/skills/${f}`
          : `${SKILLS_DIR}/${f}`;
        const content = await readFile(skillPath);
        if (!content) return;
        const skillWords = new Set(content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        let score = 0;
        msgWords.forEach(w => { if (skillWords.has(w)) score++; });
        scored.push({ name: f.replace('.md', ''), content: content.slice(0, 600), score });
      } catch { /* skip */ }
    }));

    const top = scored.sort((a, b) => b.score - a.score).filter(s => s.score > 0).slice(0, 3);
    if (top.length === 0) return '';

    return `\n\n## RELEVANT SAVED SKILLS\n*You saved these workflow patterns from previous tasks. Use them if relevant.*\n\n${top.map(s => `### ${s.name}\n${s.content}`).join('\n\n')}`;
  } catch { return ''; }
}

/**
 * Read today's session log.
 */
export async function readTodayLog(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const path = `${SESSIONS_DIR}/${today}.md`;
  return (await readFile(path)) ?? '';
}

/**
 * Append an entry to today's session log.
 */
export async function logToday(entry: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const path = `${SESSIONS_DIR}/${today}.md`;
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const existing = await readFile(path) ?? `# Session Log — ${today}\n\n`;
  await writeFile(path, `${existing.trimEnd()}\n\n**${time}** ${entry}\n`);
}

/**
 * Load all soul files for injection into the system prompt.
 * Returns a formatted block ready to be inserted.
 */
export async function loadSoulContext(): Promise<string> {
  const [soul, style, memory, user] = await Promise.all([
    readSoulFile('SOUL'),
    readSoulFile('STYLE'),
    readSoulFile('MEMORY'),
    readSoulFile('USER'),
  ]);

  const parts: string[] = [];
  if (soul) parts.push(`## SOUL\n${soul.trim()}`);
  if (style) parts.push(`## STYLE\n${style.trim()}`);
  if (memory) parts.push(`## PERSISTENT MEMORY\n${memory.trim()}`);
  if (user) parts.push(`## USER PROFILE\n${user.trim()}`);

  return parts.length > 0
    ? `\n\n## NEURO SOUL DOCUMENTS\n*Your identity files. You wrote these. They define who you are and what you've learned.*\n\n${parts.join('\n\n')}`
    : '';
}

/**
 * Cached soul context — loaded once per session, shared across all calls.
 * Refreshed when the agent explicitly updates a soul file.
 */
let _soulContextCache: string | null = null;

export async function getSoulContext(): Promise<string> {
  if (_soulContextCache !== null) return _soulContextCache;
  await ensureSoulFiles();
  _soulContextCache = await loadSoulContext();
  return _soulContextCache;
}

export function invalidateSoulCache(): void {
  _soulContextCache = null;
}
