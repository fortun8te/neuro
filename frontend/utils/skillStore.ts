/**
 * skillStore -- Persistent skill storage for the Neuro agent (localStorage-backed)
 *
 * Skills are learned action patterns the agent can recall and reuse.
 * Backed by localStorage with fire-and-forget filesystem persistence
 * to ~/Documents/Nomads/nomadfiles/skills/{id}.json
 */


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  trigger: string;              // "when researching supplements"
  triggerKeywords: string[];    // ["supplements", "research"]
  steps: string[];              // ordered action steps
  source: string;               // task/session that created it
  sourceModel: string;          // model used
  successCount: number;
  failureCount: number;
  confidence: number;           // success / (success + failure)
  tags: string[];
  createdAt: string;            // ISO timestamp
  lastUsedAt: string;           // ISO timestamp
}

// ─────────────────────────────────────────────────────────────
// Storage key + internal state
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nomad_agent_skills';

type Listener = () => void;
const _listeners = new Set<Listener>();

// Cached snapshot -- useSyncExternalStore requires a stable reference
// between renders when the store hasn't changed (React 18 requirement).
let _cache: Skill[] | null = null;

function notify() {
  _cache = null; // invalidate cache on any write
  for (const cb of _listeners) {
    try { cb(); } catch (e) { console.warn('[skillStore] Listener threw:', e instanceof Error ? e.message : String(e)); }
  }
}

// ─────────────────────────────────────────────────────────────
// Load / save helpers
// ─────────────────────────────────────────────────────────────

function loadAll(): Skill[] {
  if (_cache !== null) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _cache = [];
    } else {
      const parsed = JSON.parse(raw);
      _cache = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    _cache = [];
  }
  return _cache;
}

function saveAll(skills: Skill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
    notify();
    _cache = skills;
  } catch (e) {
    console.warn('[skillStore] Failed to persist skills to localStorage:', e instanceof Error ? e.message : String(e));
  }
}

// ─────────────────────────────────────────────────────────────
// ID generator
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Add a new skill. Returns the created skill.
 */
export function addSkill(partial: {
  trigger: string;
  triggerKeywords?: string[];
  steps: string[];
  source?: string;
  sourceModel?: string;
  tags?: string[];
}): Skill {
  const now = new Date().toISOString();
  const skill: Skill = {
    id: generateId(),
    trigger: partial.trigger,
    triggerKeywords: partial.triggerKeywords || extractKeywords(partial.trigger),
    steps: partial.steps,
    source: partial.source || 'unknown',
    sourceModel: partial.sourceModel || 'unknown',
    successCount: 0,
    failureCount: 0,
    confidence: 0,
    tags: partial.tags || [],
    createdAt: now,
    lastUsedAt: now,
  };

  const skills = loadAll();
  skills.unshift(skill); // newest first
  saveAll(skills);
  // Fire-and-forget filesystem persistence
  persistSkillToFS(skill).catch((e) => { console.warn('[skillStore] FS persist failed:', e instanceof Error ? e.message : String(e)); });
  return skill;
}

/**
 * Get all skills.
 */
export function getSkills(): Skill[] {
  return loadAll();
}

/**
 * Find skills matching a query string.
 * Scoring: triggerKeywords x2 + tags x1 + confidence x0.5
 */
export function getMatchingSkills(query: string, limit = 3): Skill[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return [];

  const scored = loadAll().map(skill => {
    let score = 0;

    // triggerKeywords match (x2 weight)
    const kwLower = skill.triggerKeywords.map(k => k.toLowerCase());
    for (const word of words) {
      if (kwLower.some(kw => kw.includes(word) || word.includes(kw))) score += 2;
    }

    // tags match (x1 weight)
    const tagLower = skill.tags.map(t => t.toLowerCase());
    for (const word of words) {
      if (tagLower.some(tag => tag.includes(word) || word.includes(tag))) score += 1;
    }

    // confidence boost (x0.5 weight)
    score += skill.confidence * 0.5;

    return { skill, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.skill);
}

/**
 * Record the outcome of using a skill. Updates counts and confidence.
 */
export function recordSkillOutcome(id: string, success: boolean): void {
  const skills = loadAll();
  const idx = skills.findIndex(s => s.id === id);
  if (idx === -1) return;

  if (success) {
    skills[idx].successCount += 1;
  } else {
    skills[idx].failureCount += 1;
  }

  const total = skills[idx].successCount + skills[idx].failureCount;
  skills[idx].confidence = total > 0 ? skills[idx].successCount / total : 0;
  skills[idx].lastUsedAt = new Date().toISOString();

  saveAll(skills);
  persistSkillToFS(skills[idx]).catch(() => { /* non-fatal */ });
}

/**
 * Delete a skill by ID.
 */
export function deleteSkill(id: string): void {
  const skills = loadAll().filter(s => s.id !== id);
  saveAll(skills);
  deleteSkillFromFS(id).catch(() => { /* non-fatal */ });
}

/**
 * Get total skill count.
 */
export function getSkillCount(): number {
  return loadAll().length;
}

// ─────────────────────────────────────────────────────────────
// Keyword extraction helper
// ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'when', 'where', 'how', 'what', 'which', 'who',
  'this', 'that', 'these', 'those', 'it', 'its', 'and', 'but', 'or',
  'not', 'no', 'nor', 'so', 'yet', 'if', 'then', 'than', 'too', 'very',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ─────────────────────────────────────────────────────────────
// Filesystem persistence -- ~/Documents/Nomads/nomadfiles/skills/
// ─────────────────────────────────────────────────────────────

const SKILLS_FS_DIR = '$HOME/Documents/Nomads/nomadfiles/skills';

/**
 * Ensure the skills directory exists on the filesystem.
 */
async function ensureSkillsDir(): Promise<void> {
  try {
    await fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: `mkdir -p "${SKILLS_FS_DIR}"`, timeout: 5000 }),
    });
  } catch (e) { console.debug('[skillStore] ensureSkillsDir failed (shell API may not be available):', e instanceof Error ? e.message : String(e)); }
}

/**
 * Persist a single skill to ~/Documents/Nomads/nomadfiles/skills/<id>.json
 */
async function persistSkillToFS(skill: Skill): Promise<void> {
  try {
    await ensureSkillsDir();
    const filename = `${SKILLS_FS_DIR}/${skill.id}.json`;
    const content = JSON.stringify(skill, null, 2);

    // Try file write API first
    const resp = await fetch('/api/file/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filename.replace('$HOME', '~'), content }),
    });

    if (!resp.ok) {
      // Fallback: shell heredoc write
      const escaped = content.replace(/'/g, "'\\''");
      await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `cat > "${filename}" << 'SKILL_EOF'\n${escaped}\nSKILL_EOF`,
          timeout: 10000,
        }),
      });
    }
  } catch (e) {
    console.debug('[skillStore] FS persist failed (non-fatal):', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Delete a skill file from ~/Documents/Nomads/nomadfiles/skills/<id>.json
 */
async function deleteSkillFromFS(id: string): Promise<void> {
  try {
    const filename = `${SKILLS_FS_DIR}/${id}.json`;
    const resp = await fetch('/api/file/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filename.replace('$HOME', '~') }),
    });
    if (!resp.ok) {
      // Fallback: shell rm
      await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `rm -f "${filename}"`, timeout: 5000 }),
      });
    }
  } catch (e) { console.debug('[skillStore] FS delete failed (non-fatal):', e instanceof Error ? e.message : String(e)); }
}
