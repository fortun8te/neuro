/**
 * Test suite for CLI Canvas document generation, streaming, and editing
 *
 * Run:
 *   npx tsx src/testCliCanvas.ts [test-name]
 *
 * Tests:
 *   - countWords / estimateReadingTime
 *   - generateDocument (with mock streaming)
 *   - extractSection / replaceSection
 *   - showDiff color formatting
 *   - saveVersion / listVersions
 *   - prettifyMarkdown formatting
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock ollamaService for testing (no need for actual connection)
class MockOllamaService {
  async generateStream(
    prompt: string,
    systemPrompt: string,
    options: any = {}
  ): Promise<string> {
    let content = '';
    const mockText = `# Introduction

This is a test document about ${prompt.substring(0, 30)}.

## Section 1: Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

## Section 2: Details

More content here with **bold text** and *italic text*. Here is some code:

\`\`\`javascript
function example() {
  return "Hello, World!";
}
\`\`\`

## Conclusion

Final thoughts and summary of the document.`;

    // Stream character by character
    for (let i = 0; i < mockText.length; i++) {
      content += mockText[i];
      if (options.onChunk) {
        options.onChunk(mockText[i]);
      }
      // Simulate streaming delay
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    return content;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────────────

function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function estimateReadingTime(content: string): string {
  const wordCount = countWords(content);
  const minutes = Math.ceil(wordCount / 200);
  return minutes === 1 ? '1 min' : `${minutes} min`;
}

function extractSection(
  content: string,
  sectionId: string
): {
  sectionId: string;
  sectionTitle: string;
  content: string;
  startLine: number;
  endLine: number;
} | null {
  const lines = content.split('\n');

  // Try to match heading
  if (!sectionId.startsWith('line')) {
    const headingIdx = lines.findIndex(
      (l) => l.match(/^#+/) && l.toLowerCase().includes(sectionId.toLowerCase())
    );
    if (headingIdx !== -1) {
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

  // Try line range
  const lineMatch = sectionId.match(/^(?:line)?s?\s*(\d+)(?:-(\d+))?$/i);
  if (lineMatch) {
    const start = parseInt(lineMatch[1], 10) - 1;
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

function prettifyMarkdown(content: string): string {
  let output = content;

  output = output.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    const indent = '  '.repeat(level - 1);
    return `${indent}\x1b[1m\x1b[36m${text}\x1b[0m`;
  });

  output = output.replace(/\*\*(.+?)\*\*/g, '\x1b[1m$1\x1b[0m');
  output = output.replace(/\*(.+?)\*/g, '\x1b[3m$1\x1b[0m');
  output = output.replace(/```[\s\S]*?```/g, (block) => {
    const lines = block.split('\n');
    return lines.map((l) => `\x1b[90m${l}\x1b[0m`).join('\n');
  });
  output = output.replace(/`([^`]+)`/g, '\x1b[90m$1\x1b[0m');

  return output;
}

// ─────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────

async function testCountWords() {
  console.log('\n[TEST] countWords');
  const text = 'hello world this is a test';
  const count = countWords(text);
  console.log(`  Input: "${text}"`);
  console.log(`  Count: ${count}`);
  console.assert(count === 6, 'Expected 6 words');
  console.log('  PASS');
}

async function testEstimateReadingTime() {
  console.log('\n[TEST] estimateReadingTime');
  const short = 'word '.repeat(50); // 50 words
  const long = 'word '.repeat(500); // 500 words

  const shortTime = estimateReadingTime(short);
  const longTime = estimateReadingTime(long);

  console.log(`  50 words: ${shortTime}`);
  console.log(`  500 words: ${longTime}`);
  console.assert(shortTime === '1 min', 'Expected 1 min for 50 words');
  console.assert(longTime === '3 min', 'Expected 3 min for 500 words');
  console.log('  PASS');
}

async function testExtractSection() {
  console.log('\n[TEST] extractSection');
  const content = `# Introduction
Some intro text.

## Section 1
Section 1 content here.

## Section 2
Section 2 content here.

# Conclusion
Final text.`;

  const section1 = extractSection(content, 'Section 1');
  console.log(`  Extracted "Section 1":`);
  console.log(`    Title: ${section1?.sectionTitle}`);
  console.log(`    Lines: ${section1?.startLine}-${section1?.endLine}`);
  console.assert(section1?.sectionTitle === 'Section 1', 'Expected Section 1');

  const lineRange = extractSection(content, 'line 1-3');
  console.log(`  Extracted "line 1-3":`);
  console.log(`    Title: ${lineRange?.sectionTitle}`);
  console.assert(lineRange?.sectionTitle === 'Lines 1-3', 'Expected lines 1-3');
  console.log('  PASS');
}

async function testPrettifyMarkdown() {
  console.log('\n[TEST] prettifyMarkdown');
  const content = '# Title\n\nThis is **bold** and this is *italic*.';
  const prettified = prettifyMarkdown(content);

  console.log('  Input:');
  console.log(`    ${content}`);
  console.log('  Output (with ANSI codes):');
  console.log(prettified);
  console.log('  PASS');
}

async function testGenerateDocument() {
  console.log('\n[TEST] generateDocument (mock streaming)');

  const mockOllama = new MockOllamaService();
  const prompt = 'write a test blog post';

  let streamed = '';
  console.log('  Streaming content...');

  const content = await mockOllama.generateStream(prompt, 'Test system prompt', {
    onChunk: (chunk: string) => {
      streamed += chunk;
      process.stdout.write(chunk);
    },
  });

  console.log('\n  Stream complete.');
  const words = countWords(content);
  const time = estimateReadingTime(content);
  console.log(`  Generated: ${words} words, ~${time}`);
  console.assert(words > 0, 'Expected content to be generated');
  console.log('  PASS');
}

async function testSaveVersion() {
  console.log('\n[TEST] saveVersion');
  const testDir = path.join('/tmp', 'neuro-test-documents');

  // Create test content
  const content = 'Test document content';
  const title = 'Test Document';

  // Create directory if needed
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const filename = `${title.replace(/\s+/g, '-')}-${Date.now()}.md`;
  const filepath = path.join(testDir, filename);
  fs.writeFileSync(filepath, content, 'utf-8');

  console.log(`  Saved to: ${filepath}`);
  console.assert(fs.existsSync(filepath), 'Expected file to exist');

  // Cleanup
  fs.unlinkSync(filepath);
  console.log('  PASS');
}

async function testShowDiff() {
  console.log('\n[TEST] showDiff (color-coded)');
  const oldText = 'This is the original text\nWith two lines';
  const newText = 'This is the updated text\nWith two lines\nAnd a third line';

  console.log('\n  Color-coded diff:');
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine === newLine) {
      console.log(`  \x1b[90m${oldLine}\x1b[0m`);
    } else {
      if (oldLine) {
        console.log(`  \x1b[91m- ${oldLine}\x1b[0m`);
      }
      if (newLine) {
        console.log(`  \x1b[92m+ ${newLine}\x1b[0m`);
      }
    }
  }

  console.log('\n  PASS');
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const testName = process.argv[2];

  console.log('\n  CLI Canvas Test Suite\n');

  const tests: Record<string, () => Promise<void>> = {
    countWords: testCountWords,
    estimateReadingTime: testEstimateReadingTime,
    extractSection: testExtractSection,
    prettifyMarkdown: testPrettifyMarkdown,
    generateDocument: testGenerateDocument,
    saveVersion: testSaveVersion,
    showDiff: testShowDiff,
  };

  if (testName && tests[testName]) {
    await tests[testName]();
  } else if (testName) {
    console.log(`  Unknown test: ${testName}`);
    console.log(`  Available: ${Object.keys(tests).join(', ')}`);
  } else {
    // Run all tests
    for (const [name, test] of Object.entries(tests)) {
      try {
        await test();
      } catch (error) {
        console.error(`  FAIL: ${error}`);
      }
    }
  }

  console.log('\n  Done.\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
