/**
 * CLI Parallelization Test
 * Validates that parallel execution utilities work correctly
 */

import { executeParallel, executeBatched, executeParallelRace, type ParallelTask, type ParallelExecutionStats } from '../utils/parallelExecutor';
import { deployParallelResearchers, type ResearchQuery } from '../utils/parallelResearch';
import { executeParallelCycle } from '../utils/parallelStages';

export interface ParallelizationTest {
  name: string;
  description: string;
  passed: boolean;
  duration: number;
  metrics?: Record<string, any>;
}

/**
 * Test 1: Basic Parallel Execution
 */
export async function testBasicParallelExecution(): Promise<ParallelizationTest> {
  const startTime = Date.now();

  try {
    const tasks: ParallelTask<number>[] = [
      {
        id: 'task1',
        name: 'Simulate researcher 1',
        fn: async () => {
          await new Promise(r => setTimeout(r, 1000));
          return 1;
        },
        timeout: 5000,
        priority: 'normal',
      },
      {
        id: 'task2',
        name: 'Simulate researcher 2',
        fn: async () => {
          await new Promise(r => setTimeout(r, 1000));
          return 2;
        },
        timeout: 5000,
        priority: 'normal',
      },
      {
        id: 'task3',
        name: 'Simulate researcher 3',
        fn: async () => {
          await new Promise(r => setTimeout(r, 1000));
          return 3;
        },
        timeout: 5000,
        priority: 'normal',
      },
    ];

    const { results, stats } = await executeParallel(tasks, { continueOnError: true });

    const passed = results.every(r => r.status === 'success');
    const duration = Date.now() - startTime;

    // All 3 tasks should complete in ~1 second (parallel), not 3 seconds (sequential)
    const isParallel = duration < 2000; // Allow some overhead

    return {
      name: 'Basic Parallel Execution',
      description: '3 tasks run in parallel, completing in ~1s instead of 3s',
      passed: passed && isParallel,
      duration,
      metrics: {
        totalTasks: stats.totalTasks,
        successful: stats.successfulTasks,
        parallelTime: duration,
        expectedSequentialTime: 3000,
        speedup: stats.taskTimings.length > 0 ? (3000 / duration).toFixed(2) + 'x' : 'N/A',
      },
    };
  } catch (error) {
    return {
      name: 'Basic Parallel Execution',
      description: '3 tasks run in parallel, completing in ~1s instead of 3s',
      passed: false,
      duration: Date.now() - startTime,
      metrics: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Test 2: Batched Execution (Sequential batches, each batch parallel)
 */
export async function testBatchedExecution(): Promise<ParallelizationTest> {
  const startTime = Date.now();

  try {
    const tasks: ParallelTask<string>[] = Array.from({ length: 6 }, (_, i) => ({
      id: `batch-task-${i}`,
      name: `Batch task ${i}`,
      fn: async () => {
        await new Promise(r => setTimeout(r, 500));
        return `Result ${i}`;
      },
      timeout: 5000,
      priority: 'normal',
    }));

    const { results, stats } = await executeBatched(tasks, 3, { continueOnError: true });

    const passed = results.every(r => r.status === 'success');
    const duration = Date.now() - startTime;

    // 6 tasks in 2 batches of 3: should take ~1 second (2 * 500ms)
    const isBatched = duration < 1500;

    return {
      name: 'Batched Execution',
      description: '6 tasks in 2 batches of 3, completing in ~1s instead of 3s',
      passed: passed && isBatched,
      duration,
      metrics: {
        totalTasks: stats.totalTasks,
        successful: stats.successfulTasks,
        batchedTime: duration,
        expectedSequentialTime: 3000,
        speedup: stats.taskTimings.length > 0 ? (3000 / duration).toFixed(2) + 'x' : 'N/A',
      },
    };
  } catch (error) {
    return {
      name: 'Batched Execution',
      description: '6 tasks in 2 batches of 3, completing in ~1s instead of 3s',
      passed: false,
      duration: Date.now() - startTime,
      metrics: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Test 3: Race Execution (First success wins)
 */
export async function testRaceExecution(): Promise<ParallelizationTest> {
  const startTime = Date.now();

  try {
    const tasks: ParallelTask<number>[] = [
      {
        id: 'race1',
        name: 'Slow task',
        fn: async () => {
          await new Promise(r => setTimeout(r, 5000));
          return 1;
        },
        timeout: 10000,
        priority: 'low',
      },
      {
        id: 'race2',
        name: 'Fast task',
        fn: async () => {
          await new Promise(r => setTimeout(r, 100));
          return 2;
        },
        timeout: 10000,
        priority: 'high',
      },
      {
        id: 'race3',
        name: 'Medium task',
        fn: async () => {
          await new Promise(r => setTimeout(r, 1000));
          return 3;
        },
        timeout: 10000,
        priority: 'normal',
      },
    ];

    const { winner, losers } = await executeParallelRace(tasks);

    const passed = winner.status === 'success' && winner.taskId === 'race2';
    const duration = Date.now() - startTime;

    // Should complete in ~100ms (when fastest task completes)
    const isFast = duration < 500;

    return {
      name: 'Race Execution',
      description: 'Multiple tasks race, fastest completes first (~100ms not 5000ms)',
      passed: passed && isFast,
      duration,
      metrics: {
        winner: winner.taskId,
        losers: losers.map(l => l.taskId),
        raceTime: duration,
        expectedSlowestTime: 5000,
        speedup: (5000 / duration).toFixed(2) + 'x',
      },
    };
  } catch (error) {
    return {
      name: 'Race Execution',
      description: 'Multiple tasks race, fastest completes first (~100ms not 5000ms)',
      passed: false,
      duration: Date.now() - startTime,
      metrics: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Test 4: Parallel Cycle Stages
 */
export async function testParallelCycleStages(): Promise<ParallelizationTest> {
  const startTime = Date.now();

  try {
    const result = await executeParallelCycle({ brand: 'Test Brand' }, {
      researchTimeout: 2000,
      phaseTimeout: 1500,
    });

    const passed = Object.values(result.phases).some(p => p !== null);
    const duration = Date.now() - startTime;

    // Check speedup exists
    const speedupExists = result.parallelizationGains.speedup > 1;

    return {
      name: 'Parallel Cycle Stages',
      description: 'Research → (Objections + Taste parallel) → Make → Test with speedup calc',
      passed: passed && speedupExists,
      duration,
      metrics: {
        theoreticalSequential: `${result.parallelizationGains.theoreticalSequential}ms`,
        actualParallel: `${result.parallelizationGains.actualParallel}ms`,
        speedup: result.parallelizationGains.speedup.toFixed(2) + 'x',
        phasesCompleted: Object.entries(result.phases)
          .filter(([_, p]) => p !== null)
          .map(([name, _]) => name)
          .join(', '),
      },
    };
  } catch (error) {
    return {
      name: 'Parallel Cycle Stages',
      description: 'Research → (Objections + Taste parallel) → Make → Test with speedup calc',
      passed: false,
      duration: Date.now() - startTime,
      metrics: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Run all parallelization tests
 */
export async function runParallelizationTests(): Promise<ParallelizationTest[]> {
  process.stdout.write('\n');
  process.stdout.write('  ╔════════════════════════════════════════════════════╗\n');
  process.stdout.write('  ║     PARALLELIZATION ARCHITECTURE TESTS            ║\n');
  process.stdout.write('  ║                                                    ║\n');
  process.stdout.write('  ║  Testing: Promise.all() parallel execution        ║\n');
  process.stdout.write('  ║           Batched execution, Race patterns        ║\n');
  process.stdout.write('  ╚════════════════════════════════════════════════════╝\n\n');

  const tests: ParallelizationTest[] = [];

  process.stdout.write('  [1/4] Basic Parallel Execution...\n');
  tests.push(await testBasicParallelExecution());

  process.stdout.write('  [2/4] Batched Execution...\n');
  tests.push(await testBatchedExecution());

  process.stdout.write('  [3/4] Race Execution...\n');
  tests.push(await testRaceExecution());

  process.stdout.write('  [4/4] Parallel Cycle Stages...\n');
  tests.push(await testParallelCycleStages());

  // Print results
  process.stdout.write('\n');
  process.stdout.write('  ┌─ Results ──────────────────────────────────────┐\n');
  for (const test of tests) {
    const icon = test.passed ? '✅' : '❌';
    process.stdout.write(`  │  ${icon} ${test.name.padEnd(30)} ${test.duration}ms\n`);
    if (test.metrics) {
      const metricsStr = Object.entries(test.metrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      process.stdout.write(`  │     ${metricsStr}\n`);
    }
  }

  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;
  process.stdout.write('  ├─────────────────────────────────────────────────\n');
  process.stdout.write(`  │  Score: ${passed}/${total} (${Math.round((passed / total) * 100)}%)\n`);
  process.stdout.write(`  │  ${passed === total ? '✅ ALL TESTS PASSED' : passed >= 2 ? '⚠️ PARTIAL PASS' : '❌ FAILED'}\n`);
  process.stdout.write('  └─────────────────────────────────────────────────┘\n\n');

  return tests;
}

export async function runParallelizationTestCLI(): Promise<void> {
  await runParallelizationTests();
}
