/**
 * contextTiers.ts -- L0/L1/L2 tiered context loading for Neuro
 *
 * Reduces token usage on smaller models by loading context in tiers:
 *   L0: Always loaded (~500 tokens) -- identity essentials
 *   L1: Loaded when relevant -- personality, memories, skills, campaign
 *   L2: On-demand tool definitions for deep context loading
 */

import { getSoulContext } from './neuroSoul';
import { neuroMemory } from './neuroMemory';
import { getRelevantMemories } from './memoryStore';
import { getMatchingSkills } from './skillStore';


// ─────────────────────────────────────────────────────────────
// L0: Always loaded (~500 tokens) -- identity essentials
// ─────────────────────────────────────────────────────────────

/**
 * Minimal identity block. Always injected regardless of model size or query.
 * Hardcoded short version -- no file reads, no async overhead.
 */
export async function loadL0Context(): Promise<string> {
  const userName = getUserName();
  const today = new Date().toISOString().split('T')[0];

  return `## NEURO IDENTITY
You are Neuro -- an autonomous creative intelligence built by Michael.
You are NOT Claude, GPT, Qwen, or any other model. You are Neuro.
Core traits: direct, curious, action-oriented, loyal to Michael's vision.
Style: casual, no filler, no sycophancy, no em dashes. Short sentences preferred.

Current date: ${today}
User: ${userName}`;
}

// ─────────────────────────────────────────────────────────────
// L1: Loaded when relevant -- personality, memories, skills
// ─────────────────────────────────────────────────────────────

/**
 * Load context blocks that are relevant to the current message.
 * Uses keyword-based relevance detection (no LLM calls).
 */
export async function loadL1Context(
  userMessage: string,
  campaignTags?: string[],
): Promise<string> {
  const parts: string[] = [];
  const msgLower = userMessage.toLowerCase();
  const msgWords = new Set(msgLower.split(/\s+/).filter(w => w.length > 2));

  // 1. Soul context -- load if message touches identity, personality, or style
  const soulKeywords = ['who are you', 'your name', 'identity', 'style', 'tone', 'personality', 'soul', 'neuro'];
  const wantsSoul = soulKeywords.some(kw => msgLower.includes(kw));
  if (wantsSoul) {
    const soul = await getSoulContext();
    if (soul) parts.push(soul);
  }

  // 2. Memories -- load relevant memories if message has substance
  if (msgWords.size > 1) {
    // neuroMemory (VFS-backed)
    try {
      await neuroMemory.init();
      const memContext = neuroMemory.getContextForPrompt();
      if (memContext) {
        // Only include if there's keyword overlap
        const memLower = memContext.toLowerCase();
        const overlap = [...msgWords].filter(w => memLower.includes(w));
        if (overlap.length >= 2) {
          parts.push(memContext);
        }
      }
    } catch { /* neuroMemory may not be initialized */ }

    // localStorage-backed memories
    const tags = campaignTags || [];
    const relevant = getRelevantMemories(10, tags);
    if (relevant.length > 0) {
      const memLines = relevant.map(m => `- [${m.type}] ${m.content}`).join('\n');
      parts.push(`## Relevant Memories\n${memLines}`);
    }
  }

  // 3. Skills -- load matching skills if query suggests a task
  const taskIndicators = ['how', 'create', 'make', 'build', 'research', 'find', 'analyze', 'write', 'generate', 'run', 'start', 'do'];
  const isTaskLike = taskIndicators.some(kw => msgLower.includes(kw));
  if (isTaskLike) {
    const skills = getMatchingSkills(userMessage, 3);
    if (skills.length > 0) {
      const skillLines = skills.map(s =>
        `### ${s.trigger} (confidence: ${(s.confidence * 100).toFixed(0)}%)\nSteps: ${s.steps.join(' -> ')}`
      ).join('\n\n');
      parts.push(`## Relevant Skills\n${skillLines}`);
    }
  }

  // 4. Campaign context -- load if campaign tags overlap with message
  if (campaignTags && campaignTags.length > 0) {
    const tagLower = campaignTags.map(t => t.toLowerCase());
    const tagOverlap = tagLower.filter(t => msgLower.includes(t));
    if (tagOverlap.length > 0) {
      parts.push(`## Active Campaign Tags\n${campaignTags.join(', ')}`);
    }
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────
// L2: Tool definitions for on-demand deep context loading
// ─────────────────────────────────────────────────────────────

/**
 * Returns tool schema definitions the agent can call to load deeper context.
 * These are just the definitions -- implementations live in the agent engine.
 */
export function getL2ToolDefinitions(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return [
    {
      name: 'search_all_memories',
      description: 'Search across all memory stores (localStorage, VFS, soul files) for specific information. Use when you need to recall something specific from past sessions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query -- keywords or natural language describing what to find',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'load_audit_trail',
      description: 'Load the research audit trail from a specific cycle, including all URLs visited, tokens used, models called, and timing data.',
      parameters: {
        type: 'object',
        properties: {
          cycleId: {
            type: 'string',
            description: 'The cycle ID to load the audit trail for',
          },
        },
        required: ['cycleId'],
      },
    },
    {
      name: 'load_previous_cycle',
      description: 'Load the full output and findings from a previous research/creative cycle. Use when building on past work or comparing approaches.',
      parameters: {
        type: 'object',
        properties: {
          cycleId: {
            type: 'string',
            description: 'The cycle ID to load',
          },
          stages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific stages to load (e.g. ["research", "taste", "make"]). Omit to load all.',
          },
        },
        required: ['cycleId'],
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getUserName(): string {
  try {
    // Check localStorage for user name (set by memoryStore seed)
    const raw = localStorage.getItem('nomad_agent_memories');
    if (raw) {
      const memories = JSON.parse(raw);
      if (Array.isArray(memories)) {
        const nameMem = memories.find((m: { id?: string; content?: string }) =>
          m.id === 'user-name' || (m.content && m.content.toLowerCase().includes('name is'))
        );
        if (nameMem?.content) {
          const match = nameMem.content.match(/name is (\w+)/i);
          if (match) return match[1];
        }
      }
    }
  } catch { /* fall through */ }
  return 'Michael';
}
