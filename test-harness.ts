/**
 * Phase 2 Coordinate Refinement System — Testing Harness
 *
 * Comprehensive test runner for click accuracy validation.
 * Measures distance between original and refined coordinates.
 * Tracks success/failure against tolerance thresholds.
 *
 * Usage:
 *   npx ts-node test-harness.ts
 *   npx ts-node test-harness.ts --output results.json
 *
 * Output: JSON array with complete metrics for each test
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Individual click test definition
 */
export interface ClickTest {
  name: string;
  description: string;
  expectedX: number;
  expectedY: number;
  tolerance: number; // ±pixels
}

/**
 * Coordinate refinement result from any refinement method
 */
export interface RefinementResult {
  originalX: number;
  originalY: number;
  refinedX: number;
  refinedY: number;
  method: string; // e.g., 'vision', 'dom', 'heuristic'
  confidence: number; // 0-1
  metadata?: Record<string, unknown>;
}

/**
 * Complete test execution record
 */
export interface TestResult {
  testId: string;
  testName: string;
  testDescription: string;
  expectedX: number;
  expectedY: number;
  originalX: number;
  originalY: number;
  refinedX: number;
  refinedY: number;
  method: string;
  confidence: number;
  tolerance: number;
  distance: number; // Euclidean distance to expected
  distanceX: number; // Horizontal offset
  distanceY: number; // Vertical offset
  success: boolean; // true if distance <= tolerance
  stretchGoalMet: boolean; // true if distance <= 30px
  timestamp: string;
  durationMs: number;
}

/**
 * Aggregated test suite results
 */
export interface TestSuiteResults {
  suite: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  stretchGoalsMet: number;
  successRate: number; // 0-100%
  stretchRate: number; // 0-100%
  averageDistance: number;
  medianDistance: number;
  minDistance: number;
  maxDistance: number;
  averageConfidence: number;
  results: TestResult[];
  methodBreakdown: Record<string, { count: number; passRate: number; avgDistance: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK REFINEMENT IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate vision-based coordinate refinement
 * (In production, this would call actual vision model)
 */
function refineWithVision(originalX: number, originalY: number, seed: number): RefinementResult {
  // Simulate: vision is accurate within ±20px for good targets
  const error = (Math.sin(seed * 2.718281828) * 25) + (Math.cos(seed * 3.141592653) * 15);
  return {
    originalX,
    originalY,
    refinedX: Math.round(originalX + error * 0.7),
    refinedY: Math.round(originalY + error * 0.5),
    method: 'vision',
    confidence: 0.85 + Math.random() * 0.15,
  };
}

/**
 * Simulate DOM-based coordinate refinement
 * (In production, this would query actual DOM elements)
 */
function refineWithDOM(originalX: number, originalY: number, seed: number): RefinementResult {
  // Simulate: DOM is accurate within ±35px for clickable elements
  const error = (Math.sin(seed * 1.618033988) * 40) + (Math.cos(seed * 2.236067977) * 25);
  return {
    originalX,
    originalY,
    refinedX: Math.round(originalX + error * 0.6),
    refinedY: Math.round(originalY + error * 0.4),
    method: 'dom',
    confidence: 0.75 + Math.random() * 0.2,
  };
}

/**
 * Simulate heuristic-based coordinate refinement
 * (In production, this would apply edge-detection and geometric analysis)
 */
function refineWithHeuristic(originalX: number, originalY: number, seed: number): RefinementResult {
  // Simulate: heuristics are accurate within ±45px
  const error = (Math.sin(seed * 0.618033988) * 50) + (Math.cos(seed * 1.414213562) * 30);
  return {
    originalX,
    originalY,
    refinedX: Math.round(originalX + error * 0.5),
    refinedY: Math.round(originalY + error * 0.3),
    method: 'heuristic',
    confidence: 0.65 + Math.random() * 0.25,
  };
}

/**
 * Select refinement method based on test characteristics
 */
function selectRefinementMethod(
  testIndex: number,
  testName: string,
): (x: number, y: number, seed: number) => RefinementResult {
  // Distribute methods across tests
  const methodIndex = testIndex % 3;

  if (methodIndex === 0) return refineWithVision;
  if (methodIndex === 1) return refineWithDOM;
  return refineWithHeuristic;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTANCE CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Euclidean distance from refined to expected coordinates
 */
function calculateDistance(
  refinedX: number,
  refinedY: number,
  expectedX: number,
  expectedY: number,
): number {
  const dx = refinedX - expectedX;
  const dy = refinedY - expectedY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate axis-aligned offsets
 */
function calculateOffsets(
  refinedX: number,
  refinedY: number,
  expectedX: number,
  expectedY: number,
): { x: number; y: number } {
  return {
    x: refinedX - expectedX,
    y: refinedY - expectedY,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single click test with refinement
 */
async function executeTest(
  test: ClickTest,
  testIndex: number,
  abortSignal?: AbortSignal,
): Promise<TestResult> {
  const startTime = performance.now();

  if (abortSignal?.aborted) {
    throw new Error(`Test aborted: ${test.name}`);
  }

  // Simulate original click coordinates (slight offset from expected)
  const originalOffset = 15 + testIndex * 3;
  const originalX = test.expectedX + originalOffset;
  const originalY = test.expectedY - originalOffset * 0.5;

  // Apply refinement
  const refinementFn = selectRefinementMethod(testIndex, test.name);
  const refinement = refinementFn(originalX, originalY, testIndex * 1.618033988);

  // Calculate distance metrics
  const distance = calculateDistance(
    refinement.refinedX,
    refinement.refinedY,
    test.expectedX,
    test.expectedY,
  );

  const offsets = calculateOffsets(
    refinement.refinedX,
    refinement.refinedY,
    test.expectedX,
    test.expectedY,
  );

  const success = distance <= test.tolerance;
  const stretchGoalMet = distance <= 30;

  const durationMs = performance.now() - startTime;

  return {
    testId: `test-${testIndex.toString().padStart(2, '0')}`,
    testName: test.name,
    testDescription: test.description,
    expectedX: test.expectedX,
    expectedY: test.expectedY,
    originalX: Math.round(originalX),
    originalY: Math.round(originalY),
    refinedX: refinement.refinedX,
    refinedY: refinement.refinedY,
    method: refinement.method,
    confidence: Math.round(refinement.confidence * 100) / 100,
    tolerance: test.tolerance,
    distance: Math.round(distance * 100) / 100,
    distanceX: offsets.x,
    distanceY: offsets.y,
    success,
    stretchGoalMet,
    timestamp: new Date().toISOString(),
    durationMs: Math.round(durationMs * 100) / 100,
  };
}

/**
 * Execute entire test suite
 */
async function executeTestSuite(
  tests: ClickTest[],
  options: { verbose?: boolean; abortSignal?: AbortSignal } = {},
): Promise<TestSuiteResults> {
  const startTime = new Date();
  const results: TestResult[] = [];
  let passedCount = 0;
  let stretchGoalCount = 0;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`PHASE 2 COORDINATE REFINEMENT — TEST SUITE`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total tests: ${tests.length}`);
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`\n`);

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];

    try {
      const result = await executeTest(test, i, options.abortSignal);
      results.push(result);

      if (result.success) passedCount++;
      if (result.stretchGoalMet) stretchGoalCount++;

      if (options.verbose) {
        const statusIcon = result.success ? '✓' : '✗';
        const stretchIcon = result.stretchGoalMet ? '★' : ' ';
        console.log(
          `${statusIcon} [${result.testId}] ${result.testName.padEnd(35)} ` +
            `${result.distance.toString().padStart(6)}px ` +
            `(${result.method.padEnd(10)}) ${stretchIcon}`,
        );
      }
    } catch (err) {
      if (options.abortSignal?.aborted) {
        console.log(`\n[ABORTED] Test suite interrupted at test ${i + 1}/${tests.length}`);
        break;
      }
      console.error(`ERROR in test ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Calculate aggregate statistics
  const distances = results.map((r) => r.distance).sort((a, b) => a - b);
  const confidences = results.map((r) => r.confidence);

  const methodBreakdown: Record<
    string,
    { count: number; passRate: number; avgDistance: number }
  > = {};

  for (const method of ['vision', 'dom', 'heuristic']) {
    const methodResults = results.filter((r) => r.method === method);
    if (methodResults.length > 0) {
      methodBreakdown[method] = {
        count: methodResults.length,
        passRate: (methodResults.filter((r) => r.success).length / methodResults.length) * 100,
        avgDistance:
          methodResults.reduce((sum, r) => sum + r.distance, 0) / methodResults.length,
      };
    }
  }

  const endTime = new Date();
  const durationSec = (endTime.getTime() - startTime.getTime()) / 1000;

  const suiteResults: TestSuiteResults = {
    suite: 'Phase 2 Coordinate Refinement',
    timestamp: startTime.toISOString(),
    totalTests: results.length,
    passedTests: passedCount,
    failedTests: results.length - passedCount,
    stretchGoalsMet: stretchGoalCount,
    successRate: (passedCount / results.length) * 100,
    stretchRate: (stretchGoalCount / results.length) * 100,
    averageDistance:
      results.reduce((sum, r) => sum + r.distance, 0) / results.length,
    medianDistance: distances[Math.floor(distances.length / 2)],
    minDistance: Math.min(...distances),
    maxDistance: Math.max(...distances),
    averageConfidence: confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
    results,
    methodBreakdown,
  };

  // Print summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`TEST SUITE SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\nRESULTS:`);
  console.log(
    `  Total Tests:        ${suiteResults.totalTests} (${suiteResults.results.length} executed)`,
  );
  console.log(`  Passed (±50px):     ${suiteResults.passedTests} (${suiteResults.successRate.toFixed(1)}%)`);
  console.log(`  Stretch Goal (±30): ${suiteResults.stretchGoalsMet} (${suiteResults.stretchRate.toFixed(1)}%)`);
  console.log(`\nDISTANCE METRICS (pixels):`);
  console.log(`  Average:            ${suiteResults.averageDistance.toFixed(2)}`);
  console.log(`  Median:             ${suiteResults.medianDistance.toFixed(2)}`);
  console.log(`  Min:                ${suiteResults.minDistance.toFixed(2)}`);
  console.log(`  Max:                ${suiteResults.maxDistance.toFixed(2)}`);
  console.log(`\nCONFIDENCE:`);
  console.log(`  Average:            ${suiteResults.averageConfidence.toFixed(2)} (0-1 scale)`);
  console.log(`\nMETHOD BREAKDOWN:`);

  for (const [method, stats] of Object.entries(suiteResults.methodBreakdown)) {
    console.log(
      `  ${method.padEnd(10)} — ${stats.count.toString().padStart(2)} tests, ` +
        `${stats.passRate.toFixed(1)}% pass, avg ${stats.avgDistance.toFixed(2)}px`,
    );
  }

  console.log(`\nDURATION:           ${durationSec.toFixed(2)}s`);
  console.log(`End time:           ${endTime.toISOString()}`);

  // Success criteria evaluation
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`SUCCESS CRITERIA`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const minRequired = 18;
  const criteria = suiteResults.passedTests >= minRequired;

  console.log(
    `\nPRIMARY: 18/20 within ±50px ${criteria ? '✓ PASS' : '✗ FAIL'} ` +
      `(${suiteResults.passedTests}/${suiteResults.totalTests})`,
  );

  if (criteria) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`PHASE 2 TESTING HARNESS: ALL SYSTEMS GO ✓`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } else {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`PHASE 2 TESTING HARNESS: NEEDS REFINEMENT ✗`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  return suiteResults;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  try {
    // Load test suite from test-suite.json
    const testSuitePath = path.join(__dirname, 'test-suite.json');

    if (!fs.existsSync(testSuitePath)) {
      console.error(`ERROR: test-suite.json not found at ${testSuitePath}`);
      console.error(`Please run the test suite setup first.`);
      process.exit(1);
    }

    const testSuiteData = JSON.parse(fs.readFileSync(testSuitePath, 'utf-8'));
    const tests: ClickTest[] = testSuiteData.tests || testSuiteData;

    console.log(`Loaded ${tests.length} tests from test-suite.json`);

    // Parse CLI arguments
    const args = process.argv.slice(2);
    const outputFlag = args.indexOf('--output');
    const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : null;
    const verboseMode = args.includes('--verbose');

    // Execute test suite
    const results = await executeTestSuite(tests, { verbose: verboseMode });

    // Export results to JSON if requested
    if (outputPath) {
      const fullPath = path.resolve(outputPath);
      fs.writeFileSync(fullPath, JSON.stringify(results, null, 2));
      console.log(`\nResults exported to: ${fullPath}`);
    }

    // Exit with appropriate code
    const SUCCESS_THRESHOLD = 18;
    const success = results.passedTests >= SUCCESS_THRESHOLD;
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Run if invoked directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

// Export for use in other modules
export { executeTest, executeTestSuite };
