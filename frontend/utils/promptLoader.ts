/**
 * promptLoader — load prompts from /prompts/ folder at build time via Vite import.meta.glob
 *
 * Prompts are stored as .md files in /prompts/ and loaded as raw strings.
 * Falls back to empty string if the file is not found.
 *
 * Usage:
 *   import { loadPrompt } from './promptLoader';
 *   const prompt = loadPrompt('agents/nomad-identity.md');
 *
 * The prompt files contain a header block (# Title, **Stage**, etc.) followed by
 * a `---` separator, then the actual prompt text. Use `loadPromptBody()` to
 * strip the header and return only the prompt text.
 */

// ── Load prompt files: Vite (bundled) or Node.js (CLI/tsx) ──────────────────
// Node.js imports are optional and guarded for browser compatibility
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;
let url: typeof import('url') | null = null;

// Only load Node.js modules in Node.js environment
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
  try {
    fs = require('fs');
    path = require('path');
    url = require('url');
  } catch (e) {
    // Modules not available in this environment
  }
}

let promptFiles: Record<string, string> = {};

// Vite environment: use import.meta.glob for bundled access
if (typeof (import.meta as any).glob === 'function') {
  promptFiles = (import.meta as any).glob('/prompts/**/*.{md,txt}', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>;
} else if (fs && path && url) {
  // Node.js (CLI/tsx) environment: read files from disk
  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const promptsDir = path.resolve(__dirname, '../../prompts');
    if (fs.existsSync(promptsDir)) {
      function scanDir(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full);
          } else if (/\.(md|txt)$/.test(entry.name)) {
            const rel = '/prompts/' + path.relative(promptsDir, full).replace(/\\/g, '/');
            promptFiles[rel] = fs.readFileSync(full, 'utf-8');
          }
        }
      }
      scanDir(promptsDir);
    }
  } catch {
    // prompts not available in this environment
  }
}

/**
 * Load a prompt file by relative path (from /prompts/).
 * Returns the full file contents including the header block.
 *
 * @param filePath - Relative path from /prompts/, e.g. 'agents/nomad-identity.md'
 */
export function loadPrompt(filePath: string): string {
  const key = `/prompts/${filePath}`;
  return (promptFiles[key] as string) || '';
}

/**
 * Load a prompt file and strip the markdown header block.
 * Everything before and including the first `---` separator is removed.
 * Use this when you want only the prompt text for injection into an LLM.
 *
 * @param filePath - Relative path from /prompts/, e.g. 'agents/nomad-identity.md'
 */
export function loadPromptBody(filePath: string): string {
  const full = loadPrompt(filePath);
  if (!full) return '';
  // Find the first --- separator (header divider)
  const separatorIdx = full.indexOf('\n---\n');
  if (separatorIdx === -1) return full.trim();
  return full.slice(separatorIdx + 5).trim(); // skip past \n---\n
}

/**
 * List all available prompt paths (relative to /prompts/).
 * Useful for debugging or building a prompt browser UI.
 */
export function listPrompts(): string[] {
  return Object.keys(promptFiles).map(k => k.replace('/prompts/', ''));
}
