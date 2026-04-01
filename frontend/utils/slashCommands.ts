/**
 * slashCommands — registry of /commands for the Neuro chat input.
 *
 * Core tools only — not all 39 agent tools, just the ones users would
 * commonly want to invoke directly.
 */

export interface SlashCommand {
  name: string;        // e.g. "search"
  tool: string;        // e.g. "web_search"  (maps to agent tool name)
  description: string; // one-liner shown in popover
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'browse',    tool: 'browse',           description: 'Open and read a URL' },
  { name: 'canvas',    tool: 'canvas_panel',     description: 'Open empty canvas to write' },
  { name: 'code',      tool: 'run_code',         description: 'Run code (python/js/bash)' },
  { name: 'computer',  tool: 'use_computer',     description: 'Open computer view' },
  { name: 'extract',   tool: 'extract_data',     description: 'Extract structured data' },
  { name: 'find',      tool: 'file_find',        description: 'Find files by pattern' },
  { name: 'image',     tool: 'image_analyze',    description: 'Analyze an image' },
  { name: 'memory',    tool: 'memory_store',     description: 'Store or search memory' },
  { name: 'plan',      tool: 'plan',             description: 'Create a task plan' },
  { name: 'read',      tool: 'file_read',        description: 'Read a file' },
  { name: 'research',  tool: 'deep_research',    description: 'Deep multi-source research' },
  { name: 'search',    tool: 'web_search',       description: 'Search the web' },
  { name: 'shell',     tool: 'shell_exec',       description: 'Run a shell command' },
  { name: 'summarize', tool: 'summarize',        description: 'Summarize content' },
  { name: 'think',     tool: 'think',            description: 'Reason through a problem' },
  { name: 'write',     tool: 'file_write',       description: 'Write a file' },
];

/** Filter commands by prefix/substring match. Returns sorted A-Z. */
export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_COMMANDS; // already sorted A-Z
  // Prioritize startsWith, then includes
  const starts = SLASH_COMMANDS.filter(c => c.name.startsWith(q));
  const contains = SLASH_COMMANDS.filter(c => !c.name.startsWith(q) && c.name.includes(q));
  return [...starts, ...contains];
}

/** Regex to match /command at start of line */
const SLASH_RE = /(?:^|\n)\/([a-z]+)\b/g;

/**
 * Parse slash commands from a message.
 * Returns cleaned message (commands stripped) + array of tool name hints.
 * Multiple /commands per message are supported.
 */
export function parseSlashHints(message: string): { cleanMessage: string; hints: string[] } {
  const hints: string[] = [];
  const commandMap = new Map(SLASH_COMMANDS.map(c => [c.name, c.tool]));

  const cleanMessage = message.replace(SLASH_RE, (_match, cmd: string) => {
    const tool = commandMap.get(cmd);
    if (tool && !hints.includes(tool)) {
      hints.push(tool);
    }
    // Keep the rest of the line (args after /command), just strip the /command prefix
    return '';
  }).trim();

  return { cleanMessage: cleanMessage || message.trim(), hints };
}
