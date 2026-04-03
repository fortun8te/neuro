/**
 * CLI Infrastructure Mode Test
 * Validates infrastructure mode switching (local ↔ remote)
 * Tests that VITE_INFRASTRUCTURE_MODE env var correctly routes to local/remote services
 */

import { INFRASTRUCTURE, validateInfrastructureMode } from '../config/infrastructure';

export interface InfrastructureTest {
  mode: 'local' | 'remote';
  ollamaUrl: string;
  wayfarerUrl: string;
  searxngUrl: string;
  modeCorrect: boolean;
  urlsCorrect: boolean;
  passed: boolean;
}

/**
 * Test infrastructure mode detection
 */
export function testInfrastructureMode(): InfrastructureTest {
  const mode = INFRASTRUCTURE.getMode();

  const ollamaUrl = INFRASTRUCTURE.ollamaUrl;
  const wayfarerUrl = INFRASTRUCTURE.wayfarerUrl;
  const searxngUrl = INFRASTRUCTURE.searxngUrl;

  // Validate mode detection
  const modeCorrect =
    mode === 'local' || mode === 'remote';

  // Validate URLs match mode
  const urlsCorrect =
    mode === 'local'
      ? ollamaUrl.includes('localhost') &&
        wayfarerUrl.includes('localhost') &&
        searxngUrl.includes('localhost')
      : ollamaUrl.includes('100.74.135.83') &&
        wayfarerUrl.includes('100.74.135.83') &&
        searxngUrl.includes('100.74.135.83');

  const passed = modeCorrect && urlsCorrect;

  return {
    mode,
    ollamaUrl,
    wayfarerUrl,
    searxngUrl,
    modeCorrect,
    urlsCorrect,
    passed,
  };
}

/**
 * Test mode validation function
 */
export function testModeValidation(): { testsPassed: number; testsFailed: number } {
  let passed = 0;
  let failed = 0;

  // Valid modes
  const validModes = ['local', 'remote'];
  for (const mode of validModes) {
    const result = validateInfrastructureMode(mode);
    if (result === mode) {
      passed++;
    } else {
      failed++;
    }
  }

  // Invalid modes should return 'remote' (safe default)
  const invalidModes = ['invalid', 'cloud', 'kubernetes', 123, null, undefined, {}];
  for (const mode of invalidModes) {
    const result = validateInfrastructureMode(mode);
    if (result === 'remote') {
      passed++;
    } else {
      failed++;
    }
  }

  return { testsPassed: passed, testsFailed: failed };
}

/**
 * Pretty-print infrastructure test results
 */
export function printInfrastructureTest(test: InfrastructureTest): void {
  const icon = test.passed ? '✅' : '❌';

  process.stdout.write(`\n  ┌─ Infrastructure Mode Test ──────────────────────┐\n`);
  process.stdout.write(`  │  ${icon} ${test.passed ? 'PASS' : 'FAIL'}\n`);
  process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
  process.stdout.write(`  │  Mode:        ${test.mode}\n`);
  process.stdout.write(`  │  Ollama:      ${test.ollamaUrl}\n`);
  process.stdout.write(`  │  Wayfarer:    ${test.wayfarerUrl}\n`);
  process.stdout.write(`  │  SearXNG:     ${test.searxngUrl}\n`);
  process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
  process.stdout.write(`  │  Mode Detection:  ${test.modeCorrect ? '✅ OK' : '❌ FAIL'}\n`);
  process.stdout.write(`  │  URLs Correct:    ${test.urlsCorrect ? '✅ OK' : '❌ FAIL'}\n`);
  process.stdout.write(`  └──────────────────────────────────────────────────┘\n\n`);
}

/**
 * CLI entrypoint: Run infrastructure test
 */
export async function runInfrastructureTestCLI(): Promise<boolean> {
  const test = testInfrastructureMode();
  const validation = testModeValidation();

  printInfrastructureTest(test);

  process.stdout.write(`  Mode Validation Tests:  ${validation.testsPassed} passed, ${validation.testsFailed} failed\n\n`);

  return test.passed && validation.testsFailed === 0;
}
