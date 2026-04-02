/**
 * CommandRouter — Enhanced routing for Phase 1 slash commands
 * Handles:
 * - Variable substitution ($LAST, $TURN_N, $MODEL, etc.)
 * - Reference resolution (/reference file.md lines 10-20)
 * - Image batch operations (/image-batch folder/)
 * - Context variable injection
 */

import type { ContextVariable, ReferenceSelector } from '../types/commandOutput';
import { resolveOutputVariable } from './outputStore';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Extended slash command with support for special operations */
export interface ExtendedSlashCommand {
  name: string;
  tool: string;
  description: string;
  category: 'basic' | 'reference' | 'image' | 'special';
}

export const EXTENDED_SLASH_COMMANDS: ExtendedSlashCommand[] = [
  // Basic commands (unchanged)
  { name: 'browse',    tool: 'browse',           description: 'Open and read a URL', category: 'basic' },
  { name: 'canvas',    tool: 'canvas_panel',     description: 'Open empty canvas to write', category: 'basic' },
  { name: 'code',      tool: 'run_code',         description: 'Run code (python/js/bash)', category: 'basic' },
  { name: 'computer',  tool: 'use_computer',     description: 'Open computer view', category: 'basic' },
  { name: 'extract',   tool: 'extract_data',     description: 'Extract structured data', category: 'basic' },
  { name: 'find',      tool: 'file_find',        description: 'Find files by pattern', category: 'basic' },
  { name: 'image',     tool: 'image_analyze',    description: 'Analyze an image', category: 'image' },
  { name: 'memory',    tool: 'memory_store',     description: 'Store or search memory', category: 'basic' },
  { name: 'plan',      tool: 'plan',             description: 'Create a task plan', category: 'basic' },
  { name: 'read',      tool: 'file_read',        description: 'Read a file', category: 'basic' },
  { name: 'research',  tool: 'deep_research',    description: 'Deep multi-source research', category: 'basic' },
  { name: 'search',    tool: 'web_search',       description: 'Search the web', category: 'basic' },
  { name: 'shell',     tool: 'shell_exec',       description: 'Run a shell command', category: 'basic' },
  { name: 'summarize', tool: 'summarize',        description: 'Summarize content', category: 'basic' },
  { name: 'think',     tool: 'think',            description: 'Reason through a problem', category: 'basic' },
  { name: 'write',     tool: 'file_write',       description: 'Write a file', category: 'basic' },

  // Phase 1 new commands
  { name: 'reference', tool: 'reference_section', description: 'Reference file sections (lines, headers, patterns)', category: 'reference' },
  { name: 'image-batch', tool: 'image_batch',    description: 'Analyze multiple images in batch', category: 'image' },

  // Phase 1: File Download & Analysis
  { name: 'download',        tool: 'download_file',     description: 'Download file from URL with validation', category: 'basic' },
  { name: 'download-batch',  tool: 'download_batch',    description: 'Download multiple files concurrently', category: 'basic' },
  { name: 'analyze',         tool: 'analyze_file',      description: 'Auto-detect file type and analyze', category: 'basic' },
  { name: 'parse-pdf',       tool: 'parse_pdf',         description: 'Extract text, tables, metadata from PDF', category: 'basic' },
  { name: 'parse-csv',       tool: 'parse_csv',         description: 'Analyze CSV schema, detect patterns', category: 'basic' },
  { name: 'analyze-images',  tool: 'analyze_images',    description: 'Analyze images from URLs (download + vision)', category: 'image' },
];

/**
 * Variable substitution context passed to command router.
 * Contains both context variables (from system state) and available output variables.
 */
export interface VariableContext {
  context: Partial<ContextVariable>;
  outputVariables?: Map<string, string>;
}

/**
 * Substitute all variables in a message.
 * Supports:
 * - $MODEL, $STAGE, $CYCLE, etc. (context variables)
 * - $LAST, $TURN_N, $COMMAND_OUTPUT (output variables)
 */
export async function substituteVariables(
  message: string,
  variableContext: VariableContext
): Promise<string> {
  let result = message;

  // Context variables (simple substitution)
  const contextVars = variableContext.context;
  if (contextVars.MODEL) result = result.replace(/\$MODEL\b/g, contextVars.MODEL);
  if (contextVars.STAGE) result = result.replace(/\$STAGE\b/g, contextVars.STAGE);
  if (contextVars.CYCLE !== undefined) result = result.replace(/\$CYCLE\b/g, String(contextVars.CYCLE));
  if (contextVars.TIMESTAMP) result = result.replace(/\$TIMESTAMP\b/g, contextVars.TIMESTAMP);
  if (contextVars.TOKENS_USED !== undefined) result = result.replace(/\$TOKENS_USED\b/g, String(contextVars.TOKENS_USED));
  if (contextVars.RESEARCH_DEPTH) result = result.replace(/\$RESEARCH_DEPTH\b/g, contextVars.RESEARCH_DEPTH);
  if (contextVars.MODE) result = result.replace(/\$MODE\b/g, contextVars.MODE);
  if (contextVars.MEMORY_COUNT !== undefined) result = result.replace(/\$MEMORY_COUNT\b/g, String(contextVars.MEMORY_COUNT));
  if (contextVars.CANVAS_ITEMS !== undefined) result = result.replace(/\$CANVAS_ITEMS\b/g, String(contextVars.CANVAS_ITEMS));

  // Output variables (async resolution)
  const outputVars = new Map<string, string>();

  // Find all output variable references in the message
  const varMatches = result.matchAll(/\$([A-Z_]+(?:_OUTPUT)?)\b/g);
  for (const match of varMatches) {
    const varName = '$' + match[1];
    if (!outputVars.has(varName)) {
      const value = await resolveOutputVariable(varName);
      if (value !== undefined) {
        outputVars.set(varName, value);
      }
    }
  }

  // Perform substitutions
  outputVars.forEach((value, varName) => {
    result = result.replace(new RegExp('\\' + varName + '\\b', 'g'), value);
  });

  return result;
}

/**
 * Parse /reference command with various selector syntaxes.
 * Examples:
 * - /reference file.md lines 10-50
 * - /reference file.md section "Competitors"
 * - /reference file.md pattern /TODO/i
 * - /reference file.md range 30%
 */
export function parseReferenceCommand(args: string): { file: string; selector: ReferenceSelector } | null {
  const tokens = args.trim().split(/\s+/);
  if (tokens.length < 3) return null;

  const file = tokens[0];

  // lines N-M
  if (tokens[1] === 'lines' && tokens.length >= 4) {
    const [start, end] = tokens[2].split('-').map(n => parseInt(n, 10));
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return { file, selector: { type: 'lines', start, end } };
  }

  // section "Header Name"
  if (tokens[1] === 'section') {
    const name = tokens.slice(2).join(' ').replace(/^["']|["']$/g, '');
    return { file, selector: { type: 'section', name } };
  }

  // pattern /regex/flags
  if (tokens[1] === 'pattern' && tokens.length >= 3) {
    const patternStr = tokens.slice(2).join(' ');
    const match = patternStr.match(/^\/(.+)\/([gimuy]*)$/);
    if (!match) return null;
    try {
      const regex = new RegExp(match[1], match[2]);
      return { file, selector: { type: 'pattern', regex } };
    } catch {
      return null;
    }
  }

  // range N%
  if (tokens[1] === 'range' && tokens.length >= 3) {
    const percent = parseInt(tokens[2], 10);
    if (Number.isNaN(percent) || percent < 1 || percent > 100) return null;
    return { file, selector: { type: 'range', percent } };
  }

  return null;
}

/**
 * Resolve a reference to actual file content.
 */
export async function resolveReference(
  file: string,
  selector: ReferenceSelector
): Promise<{ content: string; lineRange?: [number, number] } | null> {
  try {
    const fullPath = path.resolve(process.cwd(), file);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    switch (selector.type) {
      case 'lines': {
        const start = Math.max(0, selector.start - 1);
        const end = Math.min(lines.length, selector.end);
        const selected = lines.slice(start, end).join('\n');
        return { content: selected, lineRange: [selector.start, selector.end] };
      }

      case 'section': {
        // Simple markdown header detection
        const headerRegex = new RegExp(`^#+\\s+${selector.name}\\s*$`, 'im');
        const startIdx = lines.findIndex(l => headerRegex.test(l));
        if (startIdx === -1) return null;

        // Find next header of same or higher level
        const headerLevel = lines[startIdx].match(/^#+/)?.[0].length ?? 2;
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
          const match = lines[i].match(/^#+/);
          if (match && match[0].length <= headerLevel) {
            endIdx = i;
            break;
          }
        }

        const selected = lines.slice(startIdx, endIdx).join('\n');
        return { content: selected, lineRange: [startIdx + 1, endIdx] };
      }

      case 'pattern': {
        const matches: string[] = [];
        const matchLines: number[] = [];
        lines.forEach((line, idx) => {
          if (selector.regex.test(line)) {
            matches.push(line);
            matchLines.push(idx + 1);
          }
        });

        if (matches.length === 0) return null;

        const content = matches.join('\n');
        const lineRange: [number, number] = [
          Math.min(...matchLines),
          Math.max(...matchLines),
        ];
        return { content, lineRange };
      }

      case 'range': {
        const targetLine = Math.ceil((lines.length * selector.percent) / 100);
        const selected = lines.slice(0, targetLine).join('\n');
        return { content: selected, lineRange: [1, targetLine] };
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Filter commands by prefix/substring match.
 */
export function filterCommands(query: string): ExtendedSlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return EXTENDED_SLASH_COMMANDS;

  const starts = EXTENDED_SLASH_COMMANDS.filter(c => c.name.startsWith(q));
  const contains = EXTENDED_SLASH_COMMANDS.filter(
    c => !c.name.startsWith(q) && c.name.includes(q)
  );
  return [...starts, ...contains];
}
