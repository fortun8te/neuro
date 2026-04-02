/**
 * Phase 1 Features Test Suite
 * Tests for variable substitution, references, image batch parsing
 *
 * Run with: npx tsx test-phase1.ts
 */

import {
  substituteVariables,
  parseReferenceCommand,
  filterCommands,
  VariableContext,
} from './src/utils/commandRouter';
import {
  parseImageBatchArgs,
  buildImageBatchCommand,
  formatImageBatchResultMarkdown,
} from './src/utils/imageBatchRouter';
import {
  storeCommandOutput,
  getLastCommandOutput,
  getOutputByTurnOffset,
  resolveOutputVariable,
  clearAllOutputs,
} from './src/utils/outputStore';
import type { ContextVariable } from './src/types/commandOutput';

let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}${message ? ': ' + message : ''}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

// ─ TESTS ─────────────────────────────────────────────────────────────────

console.log('🧪 Phase 1: Variable Substitution Tests\n');

await test('should substitute context variables', async () => {
  const context: Partial<ContextVariable> = {
    MODEL: 'qwen3.5:9b',
    STAGE: 'research',
    CYCLE: 1,
  };

  const message = 'Using $MODEL for $STAGE stage in cycle $CYCLE';
  const result = await substituteVariables(message, { context });

  assertTrue(result.includes('qwen3.5:9b'), 'Should contain model');
  assertTrue(result.includes('research'), 'Should contain stage');
  assertTrue(result.includes('1'), 'Should contain cycle');
});

await test('should handle multiple variable substitutions', async () => {
  const context: Partial<ContextVariable> = {
    MODEL: 'qwen3.5:9b',
    TOKENS_USED: 5000,
    RESEARCH_DEPTH: 'EX',
  };

  const message = 'Model: $MODEL | Tokens: $TOKENS_USED | Depth: $RESEARCH_DEPTH';
  const result = await substituteVariables(message, { context });

  assertTrue(result.includes('qwen3.5:9b'), 'Should contain model');
  assertTrue(result.includes('5000'), 'Should contain tokens');
  assertTrue(result.includes('EX'), 'Should contain depth');
});

await test('should not replace variables not in context', async () => {
  const context: Partial<ContextVariable> = {
    MODEL: 'qwen3.5:9b',
  };

  const message = 'Using $MODEL but not $STAGE';
  const result = await substituteVariables(message, { context });

  assertTrue(result.includes('qwen3.5:9b'), 'Should contain MODEL');
  assertTrue(result.includes('$STAGE'), 'Should preserve undefined STAGE');
});

console.log('\n🧪 Phase 1: Output Variables Tests\n');

await test('should store command outputs', async () => {
  await clearAllOutputs();

  const output = await storeCommandOutput(
    'research',
    'customer pain points',
    'Found 5 key pain points...',
    0,
    'qwen3.5:9b',
    1500
  );

  assertTrue(output.id !== undefined, 'Should have ID');
  assertEquals(output.command, 'research', 'Command should match');
  assertTrue(output.output.includes('pain'), 'Output should be stored');
});

await test('should retrieve last output', async () => {
  await clearAllOutputs();

  await storeCommandOutput('research', 'topic', 'Research output 1', 0);
  await storeCommandOutput('analyze', 'data', 'Analysis output 2', 1);

  const last = await getLastCommandOutput();
  assertEquals(last?.command, 'analyze', 'Last command should be analyze');
});

await test('should retrieve output by turn offset', async () => {
  await clearAllOutputs();

  await storeCommandOutput('research', 'topic1', 'Output 1', 0);
  await storeCommandOutput('analyze', 'topic2', 'Output 2', 1);
  await storeCommandOutput('summarize', 'topic3', 'Output 3', 2);

  const turn0 = await getOutputByTurnOffset(0);
  const turn1 = await getOutputByTurnOffset(1);

  assertEquals(turn0?.command, 'summarize', 'Most recent turn should be summarize');
  assertEquals(turn1?.command, 'analyze', 'Previous turn should be analyze');
});

await test('should resolve $LAST variable', async () => {
  await clearAllOutputs();

  await storeCommandOutput('research', 'topic', 'Research findings', 0);
  const value = await resolveOutputVariable('$LAST');

  assertEquals(value, 'Research findings', 'Should resolve $LAST');
});

await test('should resolve $TURN_N variables', async () => {
  await clearAllOutputs();

  await storeCommandOutput('research', 'topic1', 'Output 1', 0);
  await storeCommandOutput('analyze', 'topic2', 'Output 2', 1);

  const turn1 = await resolveOutputVariable('$TURN_1');
  assertEquals(turn1, 'Output 1', 'Should resolve $TURN_1');
});

await test('should resolve $COMMAND_OUTPUT variables', async () => {
  await clearAllOutputs();

  await storeCommandOutput('research', 'topic', 'Research output', 0);
  await storeCommandOutput('analyze', 'data', 'Analysis output', 1);

  const researchOutput = await resolveOutputVariable('$RESEARCH_OUTPUT');
  const analyzeOutput = await resolveOutputVariable('$ANALYZE_OUTPUT');

  assertEquals(researchOutput, 'Research output', 'Should resolve $RESEARCH_OUTPUT');
  assertEquals(analyzeOutput, 'Analysis output', 'Should resolve $ANALYZE_OUTPUT');
});

await test('should truncate large outputs', async () => {
  await clearAllOutputs();

  const largeOutput = 'x'.repeat(100000);
  const stored = await storeCommandOutput(
    'research',
    'topic',
    largeOutput,
    0,
    'qwen3.5:9b',
    5000
  );

  assertTrue(stored.truncated === true, 'Should be marked truncated');
  assertEquals(stored.originalLength, 100000, 'Should store original length');
  assertTrue(stored.output.length < largeOutput.length, 'Output should be shorter');
});

console.log('\n🧪 Phase 1: Reference Command Parsing Tests\n');

await test('should parse lines selector', () => {
  const result = parseReferenceCommand('document.md lines 10-50');

  assertTrue(result !== null, 'Should parse successfully');
  assertEquals(result?.file, 'document.md', 'File should match');
  assertEquals(result?.selector.type, 'lines', 'Selector type should be lines');

  if (result?.selector.type === 'lines') {
    assertEquals(result.selector.start, 10, 'Start line should be 10');
    assertEquals(result.selector.end, 50, 'End line should be 50');
  }
});

await test('should parse section selector', () => {
  const result = parseReferenceCommand('document.md section "Competitive Analysis"');

  assertTrue(result !== null, 'Should parse successfully');
  assertEquals(result?.selector.type, 'section', 'Selector type should be section');

  if (result?.selector.type === 'section') {
    assertEquals(result.selector.name, 'Competitive Analysis', 'Section name should match');
  }
});

await test('should parse pattern selector', () => {
  const result = parseReferenceCommand('document.md pattern /TODO/i');

  assertTrue(result !== null, 'Should parse successfully');
  assertEquals(result?.selector.type, 'pattern', 'Selector type should be pattern');

  if (result?.selector.type === 'pattern') {
    assertTrue(result.selector.regex.test('TODO'), 'Regex should match TODO');
    assertTrue(result.selector.regex.test('todo'), 'Regex should match todo (case insensitive)');
  }
});

await test('should parse range selector', () => {
  const result = parseReferenceCommand('document.md range 30%');

  assertTrue(result !== null, 'Should parse successfully');
  assertEquals(result?.selector.type, 'range', 'Selector type should be range');

  if (result?.selector.type === 'range') {
    assertEquals(result.selector.percent, 30, 'Percent should be 30');
  }
});

await test('should reject invalid inputs', () => {
  assertEquals(parseReferenceCommand(''), null, 'Empty input should fail');
  assertEquals(parseReferenceCommand('file.md'), null, 'Missing selector should fail');
  assertEquals(parseReferenceCommand('file.md invalid'), null, 'Invalid selector should fail');
});

console.log('\n🧪 Phase 1: Image Batch Parsing Tests\n');

await test('should parse basic image-batch command', () => {
  const result = parseImageBatchArgs('~/screenshots/');

  assertTrue(result !== null, 'Should parse successfully');
  assertEquals(result?.source, '~/screenshots/', 'Source should match');
});

await test('should parse depth option', () => {
  const result = parseImageBatchArgs('~/images/ --depth detailed');

  assertEquals(result?.options.depth, 'detailed', 'Depth should be detailed');
});

await test('should parse multiple options', () => {
  const result = parseImageBatchArgs(
    '~/images/ --depth full --colors --objects --export json'
  );

  assertEquals(result?.options.depth, 'full', 'Depth should be full');
  assertTrue(result?.options.colors === true, 'Colors should be true');
  assertTrue(result?.options.objects === true, 'Objects should be true');
  assertEquals(result?.options.export, 'json', 'Export should be json');
});

await test('should parse filter option', () => {
  const result = parseImageBatchArgs('~/images/ --filter product');

  assertEquals(result?.options.filter, 'product', 'Filter should be product');
});

await test('should build command string', () => {
  const command = buildImageBatchCommand(['img1.jpg', 'img2.jpg'], {
    depth: 'detailed',
    colors: true,
  });

  assertTrue(command.includes('2 images'), 'Should mention image count');
  assertTrue(command.includes('detailed'), 'Should mention depth');
  assertTrue(command.includes('color'), 'Should mention colors');
});

await test('should format markdown output', () => {
  const markdown = formatImageBatchResultMarkdown(
    ['image1.jpg', 'image2.jpg'],
    { depth: 'full', colors: true }
  );

  assertTrue(markdown.includes('Image Batch Analysis'), 'Should have title');
  assertTrue(markdown.includes('2'), 'Should mention count');
  assertTrue(markdown.includes('image1.jpg'), 'Should list images');
});

console.log('\n🧪 Phase 1: Command Filtering Tests\n');

await test('should filter by prefix', () => {
  const results = filterCommands('im');

  const hasImage = results.some(c => c.name === 'image');
  const hasBatch = results.some(c => c.name === 'image-batch');

  assertTrue(hasImage, 'Should include image command');
  assertTrue(hasBatch, 'Should include image-batch command');
});

await test('should filter by substring', () => {
  const results = filterCommands('batch');

  const hasBatch = results.some(c => c.name === 'image-batch');
  assertTrue(hasBatch, 'Should include image-batch command');
});

await test('should return all commands for empty query', () => {
  const results = filterCommands('');

  assertTrue(results.length > 15, 'Should return 15+ commands');
});

console.log('\n🧪 Phase 1: Integration Tests\n');

await test('should integrate variable substitution with output storage', async () => {
  await clearAllOutputs();

  await storeCommandOutput(
    'research',
    'customer pain',
    'Key findings: frustration with solutions',
    0
  );

  const message = 'Analyze this: $RESEARCH_OUTPUT';
  const result = await substituteVariables(message, { context: { MODEL: 'qwen3.5:9b' } });

  assertTrue(result.includes('frustration'), 'Should contain research output');
  assertTrue(result.includes('qwen3.5:9b'), 'Should contain model');
});

await test('should handle multiple variable types together', async () => {
  await clearAllOutputs();

  await storeCommandOutput('analyze', 'data', 'Analysis complete', 0);

  const context: Partial<ContextVariable> = {
    STAGE: 'analysis',
    CYCLE: 2,
  };

  const message = 'In $STAGE (cycle $CYCLE), based on $ANALYZE_OUTPUT, next step...';
  const result = await substituteVariables(message, { context });

  assertTrue(result.includes('analysis'), 'Should contain stage');
  assertTrue(result.includes('2'), 'Should contain cycle');
  assertTrue(result.includes('Analysis'), 'Should contain output');
});

// ─ SUMMARY ───────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`\n✓ Tests Passed: ${testsPassed}`);
console.log(`✗ Tests Failed: ${testsFailed}`);
console.log(`\nTotal: ${testsPassed + testsFailed} tests\n`);

if (testsFailed > 0) {
  process.exit(1);
}
