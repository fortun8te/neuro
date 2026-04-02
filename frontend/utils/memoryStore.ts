/**
 * memoryStore — Persistent memory for the agent (localStorage-backed)
 *
 * Provides typed memory storage with tagging, access tracking, and
 * a React hook via useSyncExternalStore.
 */


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  type: 'general' | 'user' | 'campaign' | 'research';
  content: string;
  tags: string[];
  createdAt: string;       // ISO timestamp
  lastAccessedAt: string;  // ISO timestamp
  accessCount: number;
}

// ─────────────────────────────────────────────────────────────
// Storage key + internal state
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nomad_agent_memories';

type Listener = () => void;
const _listeners = new Set<Listener>();

// Cached snapshot — useSyncExternalStore requires a stable reference
// between renders when the store hasn't changed (React 18 requirement).
let _cache: Memory[] | null = null;

// FIX #4: Content hash index for O(1) duplicate detection (instead of O(n))
let _contentHashIndex = new Map<string, string>();  // hash → memory.id

function hashContent(content: string): string {
  // Simple FNV-1a hash, fast and collision-resistant enough for our use
  const normalized = content.toLowerCase().trim();
  let hash = 2166136261;  // FNV offset basis
  for (let i = 0; i < Math.min(normalized.length, 500); i++) {
    hash = hash ^ normalized.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash).toString(16);
}

function rebuildContentIndex(memories: Memory[]): void {
  _contentHashIndex.clear();
  for (const m of memories) {
    const hash = hashContent(m.content);
    _contentHashIndex.set(hash, m.id);
  }
}

function notify() {
  _cache = null; // invalidate cache on any write
  for (const cb of _listeners) {
    try { cb(); } catch (e) { console.warn('[memoryStore] Listener threw:', e instanceof Error ? e.message : String(e)); }
  }
}

// ─────────────────────────────────────────────────────────────
// Load / save helpers
// ─────────────────────────────────────────────────────────────

function loadAll(): Memory[] {
  if (_cache !== null) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Load the set of IDs the user has explicitly deleted (never re-add these)
    let deletedIds: Set<string>;
    try {
      deletedIds = new Set(JSON.parse(localStorage.getItem('nomad_deleted_memories') || '[]'));
    } catch {
      deletedIds = new Set();
    }

    if (!raw) {
      // First run — seed only with entries the user hasn't deleted
      _cache = getSeededMemories().filter(m => !deletedIds.has(m.id));
    } else {
      const parsed = JSON.parse(raw) as Memory[];
      if (!Array.isArray(parsed)) {
        _cache = getSeededMemories().filter(m => !deletedIds.has(m.id));
      } else {
        // Strip old deprecated seed IDs, respect deletedIds — never re-add anything deleted
        const deprecatedIds = new Set(['seed-1', 'seed-2', 'seed-3', 'user-context-work', 'user-context-personal', 'user-context-current', 'user-context-skills']);
        // Also filter out explicitly-deleted IDs — safety net in case saveAll had a transient failure
        const cleaned = parsed.filter(m => !deprecatedIds.has(m.id) && !deletedIds.has(m.id));

        // Add name seed only on first time (not in array yet, and not explicitly deleted)
        const hasName = cleaned.some(m => m.id === 'user-name');
        if (!hasName && !deletedIds.has('user-name')) {
          cleaned.unshift(...getSeededMemories());
        }

        _cache = cleaned;
      }
    }
  } catch {
    _cache = getSeededMemories();
  }
  return _cache;
}

/** FIX #3: Debounced batch writes instead of per-write serialization */
let _pendingFlush: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DEBOUNCE_MS = 500;

function debouncedSaveAll(memories: Memory[]): void {
  _cache = memories;  // Update in-memory cache immediately

  // Rebuild hash index with new memories (FIX #4)
  rebuildContentIndex(memories);

  if (_pendingFlush) {
    clearTimeout(_pendingFlush);
  }

  _pendingFlush = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache!));
      notify();
    } catch (e) {
      console.warn('[memoryStore] Failed to persist memories to localStorage:', e instanceof Error ? e.message : String(e));
    }
    _pendingFlush = null;
  }, FLUSH_DEBOUNCE_MS);
}

function saveAll(memories: Memory[]): void {
  debouncedSaveAll(memories);
}

/** Manually flush any pending writes (call at cycle completion) */
export function flushMemoriesSync(): void {
  if (_pendingFlush) {
    clearTimeout(_pendingFlush);
    _pendingFlush = null;
  }
  if (_cache) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
      notify();
    } catch (e) {
      console.warn('[memoryStore] Sync flush failed:', e instanceof Error ? e.message : String(e));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Seed memories — so UI isn't empty on first run
// ─────────────────────────────────────────────────────────────

function getSeededMemories(): Memory[] {
  // SECURITY FIX: Remove hardcoded user name from default seeds.
  // User names should only be stored if explicitly provided by the user
  // via configuration. Hardcoded values are exposed to anyone with browser access.
  return [];
}

// Initialize storage with seeds if empty
function ensureInitialized(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Filter out any seeds the user previously deleted
      const deleted: string[] = JSON.parse(localStorage.getItem('nomad_deleted_memories') || '[]');
      const seeds = getSeededMemories().filter(s => !deleted.includes(s.id));
      saveAll(seeds);
    } else {
      _cache = null;
    }
  } catch (e) { console.warn('[memoryStore] Init error:', e instanceof Error ? e.message : String(e)); }
}

if (typeof window !== 'undefined') {
  ensureInitialized();
}

// ─────────────────────────────────────────────────────────────
// ID generator
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Check if a memory with similar content already exists.
 * Uses normalized substring matching to catch near-duplicates.
 */
function isDuplicate(content: string, existing: Memory[]): Memory | null {
  const hash = hashContent(content);
  const matchId = _contentHashIndex.get(hash);
  if (matchId) {
    return existing.find(m => m.id === matchId) || null;
  }

  // Rebuild index if it drifted (every 100 adds or ~20% shrinkage)
  if (_contentHashIndex.size < Math.max(1, existing.length * 0.8)) {
    rebuildContentIndex(existing);
    const retryId = _contentHashIndex.get(hash);
    if (retryId) {
      return existing.find(m => m.id === retryId) || null;
    }
  }

  return null;
}

/**
 * Add a new memory entry. Returns existing memory if duplicate detected.
 */
export function addMemory(
  type: Memory['type'],
  content: string,
  tags: string[] = []
): Memory {
  const memories = loadAll();

  // Dedup: check if similar content already exists
  const existing = isDuplicate(content, memories);
  if (existing) {
    // Touch the existing memory instead of creating a duplicate
    touchMemory(existing.id);
    return existing;
  }

  const now = new Date().toISOString();
  const memory: Memory = {
    id: generateId(),
    type,
    content,
    tags,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
  };

  memories.unshift(memory); // newest first
  saveAll(memories);
  // Fire-and-forget filesystem persistence
  persistMemoryToFS(memory).catch((e) => { console.warn('[memoryStore] FS persist failed:', e instanceof Error ? e.message : String(e)); });
  return memory;
}

/**
 * Get all memories, optionally filtered by type.
 * Updates lastAccessedAt and accessCount for returned memories.
 */
export function getMemories(type?: Memory['type']): Memory[] {
  const memories = loadAll();
  if (!type) return memories;
  return memories.filter(m => m.type === type);
}

/**
 * Search memories by multi-word matching across content and tags.
 * Scores results by how many query words match, sorted best-first.
 * Words under 2 chars are ignored.
 */
export function searchMemories(query: string): Memory[] {
  if (!query.trim()) return loadAll();

  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) {
    // Fall back to full substring match for short queries
    const q = query.toLowerCase();
    return loadAll().filter(m =>
      m.content.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  const scored = loadAll().map(m => {
    const contentLower = m.content.toLowerCase();
    const tagStr = m.tags.join(' ').toLowerCase();
    let score = 0;
    for (const word of words) {
      if (contentLower.includes(word)) score += 2;
      if (tagStr.includes(word)) score += 1;
    }
    return { memory: m, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.memory);
}

/**
 * Delete a memory by ID.
 * Removes from localStorage and filesystem.
 */
export function deleteMemory(id: string): void {
  const memories = loadAll().filter(m => m.id !== id);
  saveAll(memories);
  // Track deleted IDs so seeds don't respawn
  try {
    const deleted = JSON.parse(localStorage.getItem('nomad_deleted_memories') || '[]');
    if (!deleted.includes(id)) { deleted.push(id); localStorage.setItem('nomad_deleted_memories', JSON.stringify(deleted)); }
  } catch (e) { console.warn('[memoryStore] Failed to track deleted ID:', e instanceof Error ? e.message : String(e)); }
  // Fire-and-forget filesystem deletion
  deleteMemoryFromFS(id).catch(() => { /* non-fatal */ });
}

// ─────────────────────────────────────────────────────────────
// Activation / decay scoring
// ─────────────────────────────────────────────────────────────

/**
 * Score a memory from 0-1 using recency decay and access frequency.
 *
 * Recency:   e^(-λ * ageDays), λ = ln(2)/30 → half-life of 30 days
 *   - today  → 1.0
 *   - 7 days → ~0.85
 *   - 30 days → 0.50
 * Frequency: min(1, accessCount / 10)  — saturates at 10 accesses
 * Combined:  0.7 * recency + 0.3 * frequency
 */
function scoreMemory(memory: Memory, now: Date = new Date()): number {
  const LAMBDA = Math.LN2 / 30; // half-life = 30 days
  const ageDays = (now.getTime() - new Date(memory.lastAccessedAt).getTime()) / 86_400_000;
  const recency = Math.exp(-LAMBDA * Math.max(0, ageDays));
  const frequency = Math.min(1, memory.accessCount / 10);
  return 0.7 * recency + 0.3 * frequency;
}

/**
 * Get memories sorted by activation score (highest first).
 * If `tags` are supplied, memories whose tags overlap receive a 1.5x boost (capped at 1).
 * Default limit: 15.
 */
export function getRelevantMemories(limit = 15, tags?: string[]): Memory[] {
  const now = new Date();
  const lowerTags = tags ? tags.map(t => t.toLowerCase()) : [];

  return loadAll()
    .map(m => {
      let score = scoreMemory(m, now);
      if (lowerTags.length > 0) {
        const hasOverlap = m.tags.some(t => lowerTags.includes(t.toLowerCase()));
        if (hasOverlap) score = Math.min(1, score * 1.5);
      }
      return { memory: m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory }) => memory);
}

/**
 * Returns "battle-tested" campaign memories: type === 'campaign',
 * accessCount >= 5, and current score > 0.6.
 * Inject these as priority context at the start of every cycle.
 */
export function getCrystallizedMemories(): Memory[] {
  const now = new Date();
  return loadAll().filter(
    m => m.type === 'campaign' && m.accessCount >= 5 && scoreMemory(m, now) > 0.6
  );
}

/**
 * Update a memory's content and/or tags by ID.
 */
export function updateMemory(id: string, updates: { content?: string; tags?: string[] }): Memory | null {
  const memories = loadAll();
  const idx = memories.findIndex(m => m.id === id);
  if (idx === -1) return null;
  memories[idx] = {
    ...memories[idx],
    ...(updates.content !== undefined ? { content: updates.content } : {}),
    ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
    lastAccessedAt: new Date().toISOString(),
  };
  saveAll(memories);
  persistMemoryToFS(memories[idx]).catch(() => {});
  return memories[idx];
}

/**
 * Get total memory count (useful for UI and consolidation triggers).
 */
export function getMemoryCount(): number {
  return loadAll().length;
}

/**
 * Update lastAccessedAt and increment accessCount for a memory.
 */
export function touchMemory(id: string): void {
  const memories = loadAll();
  const idx = memories.findIndex(m => m.id === id);
  if (idx === -1) return;
  memories[idx] = {
    ...memories[idx],
    lastAccessedAt: new Date().toISOString(),
    accessCount: memories[idx].accessCount + 1,
  };
  saveAll(memories);
}


// ─────────────────────────────────────────────────────────────
// Filesystem persistence — ~/Documents/Neuro/memories/
// ─────────────────────────────────────────────────────────────

const MEMORIES_FS_DIR = '$HOME/Documents/Nomads/nomadfiles/memories';

/**
 * Ensure the memories directory exists on the filesystem.
 * Called lazily on first write.
 */
async function ensureMemoriesDir(): Promise<void> {
  try {
    await fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: `mkdir -p "${MEMORIES_FS_DIR}"`, timeout: 5000 }),
    });
  } catch (e) { console.debug('[memoryStore] ensureMemoriesDir failed (shell API may not be available):', e instanceof Error ? e.message : String(e)); }
}

/**
 * Persist a single memory to ~/Documents/Neuro/memories/<id>.json
 * The agent can read these files directly via file tools.
 */
async function persistMemoryToFS(memory: Memory): Promise<void> {
  try {
    await ensureMemoriesDir();
    const filename = `${MEMORIES_FS_DIR}/${memory.id}.json`;
    const content = JSON.stringify(memory, null, 2);

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
          command: `cat > "${filename}" << 'MEMORY_EOF'\n${escaped}\nMEMORY_EOF`,
          timeout: 10000,
        }),
      });
    }
  } catch (e) {
    console.debug('[memoryStore] FS persist failed (non-fatal):', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Delete a memory file from ~/Documents/Neuro/memories/<id>.json
 */
async function deleteMemoryFromFS(id: string): Promise<void> {
  try {
    const filename = `${MEMORIES_FS_DIR}/${id}.json`;
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
  } catch (e) { console.debug('[memoryStore] FS delete failed (non-fatal):', e instanceof Error ? e.message : String(e)); }
}

