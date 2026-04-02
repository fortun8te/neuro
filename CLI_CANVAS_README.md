# CLI Canvas — Document Generation & Editing

Full document lifecycle in the Neuro CLI: **generate → stream → edit → refine → save → manage versions**.

## Overview

The CLI Canvas system adds professional document authoring capabilities to the Neuro CLI, with real-time streaming, section-level editing via agent refinement, version tracking, and formatted terminal output.

### Key Features

- **Document Generation**: Stream markdown from LLM with progress bar and word counter
- **Live Streaming**: Character-by-character output with purple progress indicator
- **Section Editing**: Edit any heading or line range; EDIT agent refines the section
- **Diff Display**: Color-coded old/new comparison (red for removed, green for added)
- **Version Management**: Save versions locally + to filesystem
- **Markdown Rendering**: Terminal-optimized display with colors and formatting
- **Word Counting**: Real-time word count with reading time estimation

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/utils/cliCanvas.ts` | Core canvas orchestrator (generate, edit, save, display) |
| `src/cli.ts` | CLI command handlers (`/doc`, `/edit`, `/show`, `/save`, `/versions`) |
| `src/testCliCanvas.ts` | Test suite for canvas functions |

### Design Principles

- **Streaming First**: Content streams to stdout character-by-character (no buffering)
- **Non-blocking UI**: Progress bar updates every 500ms to avoid terminal spam
- **Agent-Driven Edits**: EDIT agent refines sections based on instructions
- **Local + Cloud**: Versions saved to memory, filesystem, and IndexedDB (when available)
- **Terminal-Native**: ANSI color codes, no external rendering libraries

## Usage

### 1. Generate a Document

```bash
/doc write a 500-word blog post about AI trends
```

**Output:**
```
  Generating document...
  Title: blog post about AI trends

  [████████████████████░░░░░░░░] 65%  (245/500 words)  12s
```

The system streams markdown in real-time, updating progress every 500ms. Once complete, you see:

```
  Options: [E]dit / [S]how / [D]ownload / [S]ave / [V]ersions / [Q]uit
```

### 2. Show the Document

```bash
/show
```

Pretty-prints the document with:
- **Bold headings** (cyan + bold)
- **Bold text** (`**bold**` rendered as bold)
- *Italic text* (`*italic*` rendered as italic)
- Code blocks (dim gray background)
- Inline code (dim font)
- Bullet points with symbols

### 3. Edit a Section

```bash
/edit "Features"
Edit instruction (what should I change?): Add more technical details about implementation
```

**Flow:**
1. Extracts the "Features" section (by heading match or line range)
2. Spawns EDIT agent with the instruction
3. Shows diff (old vs new, color-coded)
4. Prompts: `Accept this edit? (y/n) > `
5. Updates document if approved

**Edit Target Options:**
- `"Introduction"` — Match heading (case-insensitive)
- `"Section 2: Details"` — Full heading text
- `"line 15-20"` — Specific lines
- `"lines 5"` — Single line

### 4. Save the Document

```bash
/save
  [saved] /Users/mk/Downloads/documents/blog-post-about-AI-trends-1711234567.md
```

Saves to:
- **In-memory**: Current session (cleared on exit)
- **Filesystem**: `~/Downloads/documents/` (persistent)
- **IndexedDB**: If running in browser context (via web app)

### 5. Download the Document

```
  Options: [E]dit / [S]how / [D]ownload / [S]ave / [V]ersions / [Q]uit
  > d
  [download] /Users/mk/Downloads/document-blog-post-about-AI-trends-1711234567.md
```

Downloads active document to `~/Downloads/` with timestamp.

### 6. Manage Versions

```bash
/versions

  Saved versions:

  1. Blog Post About AI (2345 words, 4/2/2026 2:34 PM)
  2. Product Marketing Copy (1200 words, 4/2/2026 1:15 PM)
  3. Feature Announcement (890 words, 4/1/2026 11:22 PM)

  Download version #? (enter number or q to cancel) > 1
  [download] /Users/mk/Downloads/Blog-Post-About-AI-1711234567.md
```

## Implementation Details

### Document Generation

```typescript
const result = await cliCanvas.generateDocument(
  'write a marketing email about productivity tools',
  {
    model: 'qwen3.5:9b',
    temperature: 0.7,
    maxWords: 1000,
    signal: abortController.signal,
  }
);

// Returns:
// {
//   content: "# Subject: Boost Your Productivity...",
//   title: "marketing email about productivity tools",
//   wordCount: 287
// }
```

**Streaming Callback:**
```typescript
onChunk: (chunk: string) => {
  // Character-by-character callback (use for progress bar)
  process.stdout.write(chunk);
  updateProgressBar(wordCount, maxWords);
}
```

### Section Editing

```typescript
const editResult = await cliCanvas.editSection(
  fullContent,
  'Introduction', // section identifier
  'Make this more engaging for technical audiences',
  { model: 'qwen3.5:4b', signal }
);

// Returns:
// {
//   oldText: "[original intro]",
//   newText: "[refined intro]",
//   sectionId: "Introduction",
//   instruction: "Make this more...",
//   timingMs: 3200
// }
```

**Agent Behavior:**
- EDIT agent receives original section + instruction
- Generates refined version (single section)
- Returns diff for user approval
- On accept: seamlessly replaces section in document

### Diff Display

```typescript
cliCanvas.showDiff(oldText, newText);
```

**Color Scheme:**
- **Red** (`\x1b[91m`) — Removed lines
- **Green** (`\x1b[92m`) — Added lines
- **Gray** (`\x1b[90m`) — Unchanged lines

Example:
```
  - This is the old implementation
  + This is the new implementation
  This line remains the same
  + Added: a new feature
```

### Version Storage

**Metadata Tracked:**
```typescript
{
  id: "doc-1711234567890-abc123",
  title: "Blog Post",
  content: "# Full markdown content...",
  wordCount: 2345,
  createdAt: 1711234567890,
  editedAt: 1711234890123,
  model: "qwen3.5:9b" // which model generated it
}
```

**Storage Tiers:**
1. **Memory**: Fast, session-only, cleared on exit
2. **Filesystem**: Persistent, local file for backup
3. **IndexedDB**: Available in web app for sync across sessions

### Markdown Prettification

```typescript
cliCanvas.prettifyMarkdown(content);
```

**Transformations:**
| Input | Output | Code |
|-------|--------|------|
| `# Heading` | Bold cyan heading | `\x1b[1m\x1b[36m...\x1b[0m` |
| `**bold**` | Bold text | `\x1b[1m...\x1b[0m` |
| `*italic*` | Italic text | `\x1b[3m...\x1b[0m` |
| `` `code` `` | Dim code | `\x1b[90m...\x1b[0m` |
| `- item` | Bullet with symbol | `\x1b[33m●\x1b[0m` |

## Command Reference

### Document Commands

| Command | Arg | Purpose |
|---------|-----|---------|
| `/doc` | `[prompt]` | Generate new document from prompt |
| `/show` | — | Pretty-print current document |
| `/edit` | `[section]` | Edit a specific section |
| `/save` | — | Save version to storage |
| `/versions` | — | List all saved versions |

### Interactive Menu (After /doc)

```
Options: [E]dit / [S]how / [D]ownload / [S]ave / [V]ersions / [Q]uit
```

- **E** — Enter edit mode (prompts for section + instruction)
- **S** — Display prettified document
- **D** — Download to ~/Downloads/
- **S** — Save version
- **V** — Show version history
- **Q** — Quit (return to CLI)

## Testing

### Run All Tests

```bash
npx tsx src/testCliCanvas.ts
```

**Output:**
```
  CLI Canvas Test Suite

[TEST] countWords
  Input: "hello world this is a test"
  Count: 6
  PASS

[TEST] estimateReadingTime
  50 words: 1 min
  500 words: 3 min
  PASS

[TEST] extractSection
  Extracted "Section 1":
    Title: Section 1
    Lines: 3-6
  PASS

... (more tests)
```

### Run Single Test

```bash
npx tsx src/testCliCanvas.ts generateDocument
```

### Test Functions Covered

- `countWords` — Word counting logic
- `estimateReadingTime` — Reading time calculation
- `extractSection` — Section detection by heading or line range
- `prettifyMarkdown` — Terminal markdown rendering
- `generateDocument` — Full streaming pipeline (with mock Ollama)
- `saveVersion` — File persistence
- `showDiff` — Color-coded diff display

## Terminal Progress Bar

The progress bar renders during document generation:

```
  [████████████████████░░░░░░░░] 65%  (245/500 words)  12s
```

**Components:**
- **Filled portion** (purple `\x1b[35m`): Progress toward max words
- **Empty portion** (dim `\u2591`): Remaining words
- **Percentage**: Current progress
- **Word count**: Current/max words
- **Elapsed time**: Seconds elapsed

**Updates:** Every 500ms (throttled to avoid terminal spam)

## Configuration

### Model Selection

```bash
# Default: qwen3.5:9b for generation, qwen3.5:4b for editing
# Customizable in cliCanvas.generateDocument() / editSection()
```

### System Prompt

```typescript
const DEFAULT_SYSTEM_PROMPT = `You are a professional writer and creative agent.
Generate high-quality, well-structured content. Use markdown formatting with clear
headings, sections, and emphasis. Be concise, informative, and engaging.
Output markdown-formatted text only.`;
```

Override by passing `systemPrompt` in config:
```typescript
await cliCanvas.generateDocument(prompt, {
  systemPrompt: 'You are a technical writer...',
});
```

## Error Handling

All canvas operations are wrapped in try-catch:

```typescript
try {
  await cliCanvas.generateDocument(prompt, { signal });
} catch (error) {
  if (signal?.aborted) {
    process.stdout.write('  [cancelled]\n');
  } else {
    process.stdout.write(`  [error] ${error.message}\n`);
  }
}
```

**Abort Signal Support:**
- User can Ctrl+C during generation/editing
- AbortController propagates through streaming pipeline
- Cleanup is automatic (timers, readers)

## Future Enhancements

- [ ] Multi-document workspace
- [ ] Template library (business letters, reports, etc.)
- [ ] Collaborative editing (shared versions)
- [ ] Prompt library (saved generation prompts)
- [ ] Export to PDF, DOCX, Google Docs
- [ ] Interactive section reordering
- [ ] Plagiarism checker integration
- [ ] AI-powered outlining before generation

## Troubleshooting

### No progress bar visible
- Check terminal width (should be 80+ columns)
- Verify stdout is not redirected
- Try `/show` to see final document

### Edit section not found
- Use exact heading name: `/edit "Introduction"` (case-insensitive)
- Or use line ranges: `/edit line 10-20`
- Check with `/show` to see available sections

### Ollama not responding
- Ensure Ollama is running: `ollama serve` in another terminal
- Check endpoint: `VITE_OLLAMA_URL` env var
- Verify model is pulled: `ollama pull qwen3.5:9b`

### Document not saved
- Check ~/Downloads/documents/ exists (auto-created if missing)
- Ensure write permissions: `chmod 755 ~/Downloads`
- Use `/versions` to confirm save succeeded

## Files Generated by Canvas

### In-Memory (Current Session)
- Cleared when CLI exits
- Accessed via `documentState` in `src/cli.ts`

### Filesystem
- **Location**: `~/Downloads/documents/[title]-[timestamp].md`
- **Format**: Plain markdown
- **Access**: Can open with any text editor

### Indexed DB (Web App Only)
- Stored in browser cache
- Syncs across sessions
- Lost when cache is cleared

## License

Part of the Neuro autonomous agent framework.
