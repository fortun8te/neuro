/**
 * CLI Canvas — Document generation, streaming, editing, and versioning
 *
 * Provides:
 * - generateDocument(prompt) → LLM streaming to stdout
 * - editSection(content, sectionId, instruction) → EDIT agent refinement
 * - saveVersion(content, metadata) → IndexedDB + filesystem
 * - showVersions() → list all saved versions
 * - showDiff(oldText, newText) → color-coded diff
 * - prettifyMarkdown(content) → terminal markdown rendering
 */

import * as fs from 'fs';
import * as path from 'path';
import { ollamaService } from './ollama';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface CLICanvasConfig {
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  maxWords?: number;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

export interface DocumentVersion {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: number;
  editedAt?: number;
  model?: string;
}

export interface EditResult {
  oldText: string;
  newText: string;
  sectionId?: string;
  instruction: string;
  tokensUsed?: number;
  timingMs?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────

/**
 * Count words in content
 */
function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Estimate reading time (average 200 words/minute)
 */
function estimateReadingTime(content: string): string {
  const wordCount = countWords(content);
  const minutes = Math.ceil(wordCount / 200);
  return minutes === 1 ? '1 min' : `${minutes} min`;
}

// ─────────────────────────────────────────────────────────────────────
// In-memory version store (fallback when IndexedDB unavailable in CLI)
// ─────────────────────────────────────────────────────────────────────

const versionStore = new Map<string, DocumentVersion>();

// ─────────────────────────────────────────────────────────────────────
// Progress bar rendering
// ─────────────────────────────────────────────────────────────────────

/**
 * Render a purple gradient progress bar (30 chars wide)
 */
function renderProgressBar(percent: number): string {
  const filled = Math.round(30 * Math.min(percent / 100, 1));
  const empty = 30 - filled;
  const purples = ['\x1b[35m', '\x1b[95m', '\x1b[35m']; // alternating purples
  const bar = '\u2588'.repeat(filled).padEnd(30, '\u2591');
  return `${purples[0]}${bar}\x1b[0m ${Math.round(percent)}%`;
}

/**
 * Render word counter with word count indicator
 */
function renderWordCounter(current: number, target?: number): string {
  const count = `${current}`;
  const targetStr = target ? `/${target}` : '';
  return `\x1b[90m(${count}${targetStr} words)\x1b[0m`;
}

// ─────────────────────────────────────────────────────────────────────
// Document generation with streaming
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a document with streaming output to terminal
 * Displays progress bar + word counter as content streams
 */
export async function generateDocument(
  userPrompt: string,
  config: CLICanvasConfig = {}
): Promise<{ content: string; title: string; wordCount: number }> {
  const {
    model = 'qwen3.5:9b',
    temperature = 0.7,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxWords = 5000,
    onProgress,
    signal,
  } = config;

  let fullContent = '';
  let wordCount = 0;
  let lastRenderTime = Date.now();
  const startTime = Date.now();

  // Extract title from prompt (first meaningful phrase)
  const titleMatch = userPrompt.match(/^(?:write|create|generate|draft)\s+(?:a\s+)?(?:\d+[a-z-]*\s+)?(\w+.*?)(?:\s+about|\s+for|$)/i);
  const title = titleMatch ? titleMatch[1].trim().substring(0, 60) : 'Untitled Document';

  // Print header
  process.stdout.write('\n  Generating document...\n');
  process.stdout.write(`  Title: ${title}\n\n`);

  try {
    await ollamaService.generateStream(
      userPrompt,
      systemPrompt,
      {
        model,
        temperature,
        onChunk: (chunk: string) => {
          fullContent += chunk;
          wordCount = countWords(fullContent);

          // Update progress every 500ms
          const now = Date.now();
          if (now - lastRenderTime > 500) {
            const elapsed = Math.round((now - startTime) / 1000);
            const percent = Math.min((wordCount / maxWords) * 100, 100);
            process.stdout.write(`\r  ${renderProgressBar(percent)}  ${renderWordCounter(wordCount, maxWords)}  ${elapsed}s`);
            lastRenderTime = now;
          }
        },
        onError: (error: Error) => {
          process.stdout.write(`\n\n  [error] ${error.message}\n`);
          throw error;
        },
        signal,
      }
    );

    // Final render + newline
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const percent = Math.min((wordCount / maxWords) * 100, 100);
    process.stdout.write(`\r  ${renderProgressBar(percent)}  ${renderWordCounter(wordCount, maxWords)}  ${elapsed}s\n\n`);

    onProgress?.(`Generated: ${wordCount} words in ${estimateReadingTime(fullContent)}`);

    return { content: fullContent, title, wordCount };
  } catch (error) {
    if (signal?.aborted) {
      process.stdout.write('\n\n  [cancelled]\n\n');
      throw new Error('Document generation cancelled');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Section extraction and editing
// ─────────────────────────────────────────────────────────────────────

/**
 * Extract a section from content by identifier (heading, line range, or pattern)
 * Returns { sectionId, sectionTitle, content, startLine, endLine }
 */
function extractSection(content: string, sectionId: string): {
  sectionId: string;
  sectionTitle: string;
  content: string;
  startLine: number;
  endLine: number;
} | null {
  const lines = content.split('\n');

  // Try to match heading (## Section Name)
  if (!sectionId.startsWith('line')) {
    const headingIdx = lines.findIndex(l =>
      l.match(/^#+/) && l.toLowerCase().includes(sectionId.toLowerCase())
    );
    if (headingIdx !== -1) {
      // Find next heading or end of content
      const nextHeadingIdx = lines.findIndex((l, i) => i > headingIdx && l.match(/^#+/));
      const endIdx = nextHeadingIdx === -1 ? lines.length : nextHeadingIdx;
      return {
        sectionId,
        sectionTitle: lines[headingIdx].replace(/^#+\s*/, '').trim(),
        content: lines.slice(headingIdx, endIdx).join('\n'),
        startLine: headingIdx,
        endLine: endIdx,
      };
    }
  }

  // Try line range (line 15-20, lines 10-30)
  const lineMatch = sectionId.match(/^(?:line)?s?\s*(\d+)(?:-(\d+))?$/i);
  if (lineMatch) {
    const start = parseInt(lineMatch[1], 10) - 1; // 1-indexed → 0-indexed
    const end = lineMatch[2] ? parseInt(lineMatch[2], 10) : start + 1;
    if (start >= 0 && start < lines.length) {
      return {
        sectionId: `lines ${start + 1}-${end}`,
        sectionTitle: `Lines ${start + 1}-${end}`,
        content: lines.slice(start, end).join('\n'),
        startLine: start,
        endLine: end,
      };
    }
  }

  return null;
}

/**
 * Replace a section in content
 */
function replaceSection(content: string, startLine: number, endLine: number, newContent: string): string {
  const lines = content.split('\n');
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine);
  return [...before, newContent, ...after].join('\n');
}

/**
 * Edit a specific section with EDIT agent
 */
export async function editSection(
  fullContent: string,
  sectionId: string,
  instruction: string,
  config: CLICanvasConfig = {}
): Promise<EditResult> {
  const { model = 'qwen3.5:4b', temperature = 0.6, signal } = config;

  const section = extractSection(fullContent, sectionId);
  if (!section) {
    throw new Error(`Section "${sectionId}" not found. Try "Introduction" or "line 15-20"`);
  }

  process.stdout.write(`\n  Editing: ${section.sectionTitle}\n`);
  process.stdout.write(`  Instruction: ${instruction}\n`);
  process.stdout.write(`  Generating refined version...\n\n`);

  let newContent = '';
  const startTime = Date.now();

  const editPrompt = `You are an expert editor. Refine the following section:

ORIGINAL SECTION:
${section.content}

INSTRUCTION:
${instruction}

Provide ONLY the refined section text, no explanations or meta-commentary.`;

  try {
    await ollamaService.generateStream(
      editPrompt,
      'You are a professional editor and writer. Provide clear, concise refinements.',
      {
        model,
        temperature,
        onChunk: (chunk: string) => {
          newContent += chunk;
          process.stdout.write(chunk);
        },
        onError: (error: Error) => {
          throw error;
        },
        signal,
      }
    );

    process.stdout.write('\n\n');

    const timingMs = Date.now() - startTime;
    const oldText = section.content;

    return {
      oldText,
      newText: newContent.trim(),
      sectionId: section.sectionId,
      instruction,
      timingMs,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Edit cancelled');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Diff display (color-coded)
// ─────────────────────────────────────────────────────────────────────

/**
 * Show side-by-side diff of old vs new text
 */
export function showDiff(oldText: string, newText: string): void {
  process.stdout.write('\n  --- Diff ---\n\n');

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine === newLine) {
      // Same
      process.stdout.write(`  \x1b[90m${oldLine}\x1b[0m\n`);
    } else {
      if (oldLine) {
        process.stdout.write(`  \x1b[91m- ${oldLine}\x1b[0m\n`);
      }
      if (newLine) {
        process.stdout.write(`  \x1b[92m+ ${newLine}\x1b[0m\n`);
      }
    }
  }

  process.stdout.write('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Version management
// ─────────────────────────────────────────────────────────────────────

/**
 * Save a version to storage (memory + file)
 */
export async function saveVersion(
  content: string,
  metadata: Partial<DocumentVersion> = {}
): Promise<DocumentVersion> {
  const version: DocumentVersion = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: metadata.title || 'Untitled',
    content,
    wordCount: countWords(content),
    createdAt: metadata.createdAt || Date.now(),
    editedAt: Date.now(),
    model: metadata.model,
  };

  versionStore.set(version.id, version);

  // Also save to filesystem (~/Downloads/documents/)
  const docDir = path.join(process.env.HOME || '/tmp', 'Downloads', 'documents');
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  const filename = `${version.title.replace(/\s+/g, '-')}-${Date.now()}.md`;
  const filepath = path.join(docDir, filename);
  fs.writeFileSync(filepath, content, 'utf-8');

  process.stdout.write(`  [saved] ${filepath}\n`);

  return version;
}

/**
 * List all saved versions
 */
export function listVersions(): DocumentVersion[] {
  const versions = Array.from(versionStore.values());
  versions.sort((a, b) => b.editedAt! - a.editedAt!);

  if (versions.length === 0) {
    process.stdout.write('  No saved versions yet.\n');
    return [];
  }

  process.stdout.write('\n  Saved versions:\n\n');
  versions.forEach((v, i) => {
    const date = new Date(v.editedAt || v.createdAt).toLocaleString();
    process.stdout.write(`  ${i + 1}. ${v.title} (${v.wordCount} words, ${date})\n`);
  });
  process.stdout.write('\n');

  return versions;
}

/**
 * Download a version to ~/Downloads
 */
export function downloadVersion(version: DocumentVersion): string {
  const downloadsDir = path.join(process.env.HOME || '/tmp', 'Downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const filename = `document-${version.title.replace(/\s+/g, '-')}-${Date.now()}.md`;
  const filepath = path.join(downloadsDir, filename);
  fs.writeFileSync(filepath, version.content, 'utf-8');

  process.stdout.write(`  [download] ${filepath}\n`);
  return filepath;
}

// ─────────────────────────────────────────────────────────────────────
// Markdown prettification for terminal
// ─────────────────────────────────────────────────────────────────────

/**
 * Render markdown in terminal with colors
 */
export function prettifyMarkdown(content: string): string {
  let output = content;

  // Headings (# → bold + cyan)
  output = output.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    const indent = '  '.repeat(level - 1);
    return `${indent}\x1b[1m\x1b[36m${text}\x1b[0m`;
  });

  // Bold (**text** → bold)
  output = output.replace(/\*\*(.+?)\*\*/g, '\x1b[1m$1\x1b[0m');

  // Italic (*text* → italic)
  output = output.replace(/\*(.+?)\*/g, '\x1b[3m$1\x1b[0m');

  // Code blocks (```...``` → gray)
  output = output.replace(/```[\s\S]*?```/g, (block) => {
    const lines = block.split('\n');
    return lines.map(l => `\x1b[90m${l}\x1b[0m`).join('\n');
  });

  // Inline code (`text` → dim)
  output = output.replace(/`([^`]+)`/g, '\x1b[90m$1\x1b[0m');

  // Lists (- item → bullet)
  output = output.replace(/^[-*+]\s+(.+)$/gm, '  \x1b[33m●\x1b[0m $1');

  // Links ([text](url) → underlined cyan)
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '\x1b[36m\x1b[4m$1\x1b[0m');

  return output;
}

/**
 * Display content prettified
 */
export function showPrettified(content: string, title?: string): void {
  process.stdout.write('\n');
  if (title) {
    process.stdout.write(`\x1b[1m\x1b[36m${title}\x1b[0m\n`);
    process.stdout.write('\x1b[90m' + '='.repeat(title.length) + '\x1b[0m\n\n');
  }
  process.stdout.write(prettifyMarkdown(content));
  process.stdout.write('\n\n');
}

// ─────────────────────────────────────────────────────────────────────
// Default system prompt
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are a professional writer and creative agent. Generate high-quality, well-structured content. Use markdown formatting with clear headings, sections, and emphasis. Be concise, informative, and engaging. Output markdown-formatted text only.`;

// ─────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────

export const cliCanvas = {
  generateDocument,
  editSection,
  showDiff,
  saveVersion,
  listVersions,
  downloadVersion,
  prettifyMarkdown,
  showPrettified,
};
