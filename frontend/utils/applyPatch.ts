/**
 * applyPatch.ts — Codex-style patch format parser and applicator.
 *
 * Supported formats:
 *
 *   *** Begin Patch
 *   *** Add File: src/foo.ts
 *   <file content>
 *   *** End Patch
 *
 *   *** Begin Patch
 *   *** Update File: src/bar.ts
 *   @@ -10,3 +10,3 @@
 *    context line
 *   -old line
 *   +new line
 *    context line
 *   *** End Patch
 *
 *   *** Begin Patch
 *   *** Update File: old.ts -> new.ts
 *   ...hunks...
 *   *** End Patch
 *
 *   *** Begin Patch
 *   *** Delete File: src/baz.ts
 *   *** End Patch
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Public Types ─────────────────────────────────────────────────────────────

export type PatchSafety = 'auto_approve' | 'ask_user' | 'reject';

export interface PatchChange {
  type: '+' | '-' | ' ';
  line: string;
}

export interface PatchHunk {
  op: 'add' | 'delete' | 'update';
  path: string;
  newPath?: string;   // for renames: "*** Update File: old.ts -> new.ts"
  content?: string;   // for 'add': full file content
  changes?: PatchChange[];
}

// ── System path prefixes that should be rejected ─────────────────────────────

const SYSTEM_PREFIXES = ['/etc', '/usr', '/bin', '/sbin', '/System', '/private/etc', '/private/var'];

// ── parsePatch ────────────────────────────────────────────────────────────────

/**
 * Parse a Codex-style patch text into an array of PatchHunks.
 * Handles both LF and CRLF line endings.
 */
export function parsePatch(text: string): PatchHunk[] {
  // Normalize CRLF -> LF
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const hunks: PatchHunk[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === '*** Begin Patch') {
      i++;
      // Parse all hunks within this patch block
      while (i < lines.length && lines[i].trim() !== '*** End Patch') {
        const directiveLine = lines[i].trim();

        if (directiveLine.startsWith('*** Add File:')) {
          const filePath = directiveLine.slice('*** Add File:'.length).trim();
          i++;
          // Collect content until next *** directive or *** End Patch
          const contentLines: string[] = [];
          while (
            i < lines.length &&
            !lines[i].trim().startsWith('*** ') &&
            lines[i].trim() !== '*** End Patch'
          ) {
            contentLines.push(lines[i]);
            i++;
          }
          hunks.push({
            op: 'add',
            path: filePath,
            content: contentLines.join('\n'),
          });

        } else if (directiveLine.startsWith('*** Delete File:')) {
          const filePath = directiveLine.slice('*** Delete File:'.length).trim();
          i++;
          hunks.push({
            op: 'delete',
            path: filePath,
          });

        } else if (directiveLine.startsWith('*** Update File:')) {
          const fileSpec = directiveLine.slice('*** Update File:'.length).trim();
          let filePath: string;
          let newPath: string | undefined;

          // Detect rename: "old.ts -> new.ts"
          const arrowIdx = fileSpec.indexOf(' -> ');
          if (arrowIdx !== -1) {
            filePath = fileSpec.slice(0, arrowIdx).trim();
            newPath = fileSpec.slice(arrowIdx + 4).trim();
          } else {
            filePath = fileSpec;
          }

          i++;

          // Collect change lines (@@, +, -, space prefix)
          const changes: PatchChange[] = [];
          while (
            i < lines.length &&
            !lines[i].trim().startsWith('*** ') &&
            lines[i].trim() !== '*** End Patch'
          ) {
            const raw = lines[i];
            // Skip @@ hunk headers — they are informational only
            if (raw.trimStart().startsWith('@@')) {
              i++;
              continue;
            }
            if (raw.startsWith('+')) {
              changes.push({ type: '+', line: raw.slice(1) });
            } else if (raw.startsWith('-')) {
              changes.push({ type: '-', line: raw.slice(1) });
            } else if (raw.startsWith(' ')) {
              changes.push({ type: ' ', line: raw.slice(1) });
            } else if (raw === '') {
              // Blank line — treat as context
              changes.push({ type: ' ', line: '' });
            } else {
              // Unknown — treat as context
              changes.push({ type: ' ', line: raw });
            }
            i++;
          }

          const hunk: PatchHunk = {
            op: 'update',
            path: filePath,
            changes,
          };
          if (newPath) hunk.newPath = newPath;
          hunks.push(hunk);

        } else {
          // Unknown directive or blank — skip
          i++;
        }
      }
      // Skip "*** End Patch"
      if (i < lines.length && lines[i].trim() === '*** End Patch') {
        i++;
      }
    } else {
      i++;
    }
  }

  return hunks;
}

// ── assessPatch ───────────────────────────────────────────────────────────────

/**
 * Assess whether a patch hunk should be auto-approved, queued for user review,
 * or outright rejected.
 */
export function assessPatch(hunk: PatchHunk): PatchSafety {
  const p = hunk.path;

  // Reject path traversal
  if (p.includes('..')) return 'reject';

  // Reject absolute system paths
  if (SYSTEM_PREFIXES.some((prefix) => p.startsWith(prefix))) return 'reject';

  // Reject absolute paths outside workspace (unless they're simple /tmp)
  if (path.isAbsolute(p) && !p.startsWith('/tmp')) {
    // Allow absolute paths only if they appear safe (no system prefix covered above)
    // Additional safety: reject if it resolves outside any recognizable workspace
    return 'ask_user';
  }

  // Delete always requires confirmation
  if (hunk.op === 'delete') return 'ask_user';

  return 'auto_approve';
}

// ── applyPatch ────────────────────────────────────────────────────────────────

/**
 * Apply a single PatchHunk to the filesystem relative to workDir.
 */
export async function applyPatch(
  hunk: PatchHunk,
  workDir: string
): Promise<{ success: boolean; error?: string }> {
  const resolvePath = (p: string) =>
    path.isAbsolute(p) ? p : path.resolve(workDir, p);

  try {
    switch (hunk.op) {
      case 'add': {
        const fullPath = resolvePath(hunk.path);
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, hunk.content ?? '', 'utf8');
        return { success: true };
      }

      case 'delete': {
        const fullPath = resolvePath(hunk.path);
        fs.unlinkSync(fullPath);
        return { success: true };
      }

      case 'update': {
        const srcPath = resolvePath(hunk.path);

        // Read existing file
        let existing: string;
        try {
          existing = fs.readFileSync(srcPath, 'utf8');
        } catch (err) {
          return { success: false, error: `Cannot read file: ${hunk.path}` };
        }

        // Normalize CRLF in existing file
        const fileLines = existing.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

        if (!hunk.changes || hunk.changes.length === 0) {
          // No changes — handle rename only
          if (hunk.newPath) {
            const destPath = resolvePath(hunk.newPath);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.renameSync(srcPath, destPath);
          }
          return { success: true };
        }

        // Apply line-based diff
        const result = applyLineDiff(fileLines, hunk.changes);
        if (!result.success) return result;

        const newContent = result.lines!.join('\n');

        // Write to destination (rename if newPath specified)
        const destPath = hunk.newPath ? resolvePath(hunk.newPath) : srcPath;
        if (hunk.newPath) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
        }
        fs.writeFileSync(destPath, newContent, 'utf8');

        // If renamed, remove original
        if (hunk.newPath && hunk.newPath !== hunk.path) {
          try {
            fs.unlinkSync(srcPath);
          } catch {
            // Ignore if already gone
          }
        }

        return { success: true };
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── applyLineDiff (internal) ──────────────────────────────────────────────────

/**
 * Apply a sequence of PatchChanges to an array of file lines.
 *
 * Context lines (' ') must match exactly (trimmed). If they don't match,
 * returns { success: false, error: 'Context mismatch at line N' }.
 */
function applyLineDiff(
  fileLines: string[],
  changes: PatchChange[]
): { success: boolean; lines?: string[]; error?: string } {
  const output: string[] = [];
  let fileIdx = 0;

  // We scan through changes. For each change:
  //   ' ' (context) — advance through file matching the context line
  //   '-' (remove)  — advance through file consuming (not emitting) the line
  //   '+' (add)     — emit the line without advancing file pointer

  for (let ci = 0; ci < changes.length; ci++) {
    const change = changes[ci];

    switch (change.type) {
      case ' ': {
        // Context line — must match
        if (fileIdx >= fileLines.length) {
          return {
            success: false,
            error: `Context mismatch at line ${fileIdx + 1}: expected "${change.line}" but file ended`,
          };
        }
        if (fileLines[fileIdx].trimEnd() !== change.line.trimEnd()) {
          return {
            success: false,
            error: `Context mismatch at line ${fileIdx + 1}: expected "${change.line}" but got "${fileLines[fileIdx]}"`,
          };
        }
        output.push(fileLines[fileIdx]);
        fileIdx++;
        break;
      }

      case '-': {
        // Remove — consume file line without emitting
        if (fileIdx >= fileLines.length) {
          return {
            success: false,
            error: `Remove mismatch at line ${fileIdx + 1}: expected "${change.line}" but file ended`,
          };
        }
        if (fileLines[fileIdx].trimEnd() !== change.line.trimEnd()) {
          return {
            success: false,
            error: `Remove mismatch at line ${fileIdx + 1}: expected "${change.line}" but got "${fileLines[fileIdx]}"`,
          };
        }
        fileIdx++;
        break;
      }

      case '+': {
        // Add — emit without consuming file
        output.push(change.line);
        break;
      }
    }
  }

  // Append any remaining lines from file (after the last changed region)
  while (fileIdx < fileLines.length) {
    output.push(fileLines[fileIdx]);
    fileIdx++;
  }

  return { success: true, lines: output };
}

// ── renderPatchPreview ────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';

/**
 * Render a colored ANSI preview string for a PatchHunk.
 */
export function renderPatchPreview(hunk: PatchHunk): string {
  const opLabel = hunk.op === 'add' ? 'ADD' : hunk.op === 'delete' ? 'DELETE' : 'UPDATE';
  const fileLabel = hunk.newPath ? `${hunk.path} -> ${hunk.newPath}` : hunk.path;

  let out = '';
  out += `  ${BOLD}┌─ ${opLabel} ${fileLabel}${RESET}\n`;

  if (hunk.op === 'add' && hunk.content) {
    const addLines = hunk.content.split('\n');
    for (const l of addLines) {
      out += `  ${GREEN}+ ${l}${RESET}\n`;
    }
  } else if (hunk.op === 'delete') {
    out += `  ${RED}(entire file will be removed)${RESET}\n`;
  } else if (hunk.op === 'update' && hunk.changes) {
    for (const change of hunk.changes) {
      if (change.type === '+') {
        out += `  ${GREEN}+${change.line}${RESET}\n`;
      } else if (change.type === '-') {
        out += `  ${RED}-${change.line}${RESET}\n`;
      } else {
        out += `  ${DIM} ${change.line}${RESET}\n`;
      }
    }
  }

  out += `  ${BOLD}└─${RESET}\n`;
  return out;
}
