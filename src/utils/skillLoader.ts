/**
 * skillLoader -- Loads SKILL.md files and provides them to the agent.
 *
 * Skills use OpenClaw's SKILL.md format: YAML frontmatter + markdown body.
 * In the browser we bundle them as Vite ?raw imports.
 */

// ── Vite raw imports ──

import webfetchSkill from '../../skills/webfetch/SKILL.md?raw';
import researchSkill from '../../skills/research/SKILL.md?raw';
import computerSkill from '../../skills/computer/SKILL.md?raw';

// ── Types ──

export interface Skill {
  name: string;
  description: string;
  version: string;
  instructions: string; // markdown body after frontmatter
}

// ── Parser ──

/** Parse a SKILL.md file (YAML frontmatter + markdown body) */
export function parseSkillMd(content: string): Skill | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  const name = frontmatter.match(/name:\s*(.+)/)?.[1]?.trim() ?? '';

  // Handle multi-line description (YAML folded scalar with >)
  const descMulti = frontmatter.match(
    /description:\s*>\s*\n([\s\S]*?)(?=\n[a-zA-Z]|\n---)/,
  );
  const descSingle = frontmatter.match(/description:\s*(?!>)(.+)/);
  const description = descMulti
    ? descMulti[1].replace(/\n\s+/g, ' ').trim()
    : descSingle?.[1]?.trim() ?? '';

  const version = frontmatter.match(/version:\s*(.+)/)?.[1]?.trim() ?? '1.0.0';

  return { name, description, version, instructions: body };
}

// ── Bundled skills registry ──

const BUNDLED_SKILLS: Record<string, string> = {
  webfetch: webfetchSkill,
  research: researchSkill,
  computer: computerSkill,
};

// ── Cached parse ──

let _cache: Skill[] | null = null;

/** Load all bundled skills. Cached after first call. */
export function loadSkills(): Skill[] {
  if (_cache) return _cache;

  const skills: Skill[] = [];
  for (const [, content] of Object.entries(BUNDLED_SKILLS)) {
    const skill = parseSkillMd(content);
    if (skill) skills.push(skill);
  }

  _cache = skills;
  return skills;
}

// ── Prompt formatting ──

/** Format skills as a compact list for the classifier system prompt */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  return skills.map((s) => `${s.name}: ${s.description}`).join('\n');
}

/** Get full markdown instructions for a specific skill (for injection into agent context) */
export function getSkillInstructions(
  skills: Skill[],
  name: string,
): string | null {
  const skill = skills.find((s) => s.name === name);
  return skill?.instructions ?? null;
}
