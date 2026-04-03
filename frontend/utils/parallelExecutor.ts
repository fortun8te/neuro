/**
 * Parallel Executor
 * Coordinates parallel execution of agents, stages, and tools
 * Ensures all parallelizable work runs concurrently via Promise.all()
 */

export interface ParallelTask<T> {
  id: string;
  name: string;
  fn: () => Promise<T>;
  timeout?: number;
  priority?: 'high' | 'normal' | 'low';
}

export interface ParallelResult<T> {
  taskId: string;
  status: 'success' | 'failed' | 'timeout';
  result?: T;
  error?: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface ParallelExecutionStats {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  timeoutTasks: number;
  totalDuration: number;
  parallelEfficiency: number; // (longestTask / totalDuration) * 100
  taskTimings: Array<{ taskId: string; duration: number; name: string }>;
}

/**
 * Execute multiple tasks in parallel with timeout support
 */
export async function executeParallel<T>(
  tasks: ParallelTask<T>[],
  options?: {
    defaultTimeout?: number;
    continueOnError?: boolean;
  }
): Promise<{
  results: ParallelResult<T>[];
  stats: ParallelExecutionStats;
}> {
  const defaultTimeout = options?.defaultTimeout || 30000;
  const continueOnError = options?.continueOnError !== false;

  const startTime = Date.now();
  const promises = tasks.map((task) =>
    executeWithTimeout(task.fn, task.timeout || defaultTimeout)
      .then((result) => ({
        taskId: task.id,
        status: 'success' as const,
        result,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        name: task.name,
      }))
      .catch((error) => ({
        taskId: task.id,
        status: (error.name === 'AbortError' ? 'timeout' : 'failed') as 'failed' | 'timeout',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        name: task.name,
      }))
  );

  // Execute all in parallel
  const results = await Promise.all(promises);

  // Calculate stats
  const stats: ParallelExecutionStats = {
    totalTasks: tasks.length,
    successfulTasks: results.filter((r) => r.status === 'success').length,
    failedTasks: results.filter((r) => r.status === 'failed').length,
    timeoutTasks: results.filter((r) => r.status === 'timeout').length,
    totalDuration: Date.now() - startTime,
    parallelEfficiency: 0,
    taskTimings: results
      .map((r) => ({
        taskId: r.taskId,
        duration: r.duration,
        name: (r as any).name || r.taskId,
      }))
      .sort((a, b) => b.duration - a.duration),
  };

  // Calculate parallel efficiency (how much time was actually parallel vs sequential)
  if (stats.taskTimings.length > 0) {
    const longestTask = stats.taskTimings[0].duration;
    stats.parallelEfficiency = (longestTask / stats.totalDuration) * 100;
  }

  return { results, stats };
}

/**
 * Execute a function with timeout
 */
async function executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    ),
  ]);
}

/**
 * Batch execute tasks with configurable concurrency
 * (Sequential batches, each batch parallel)
 */
export async function executeBatched<T>(
  tasks: ParallelTask<T>[],
  batchSize: number = 5,
  options?: {
    defaultTimeout?: number;
    continueOnError?: boolean;
  }
): Promise<{
  results: ParallelResult<T>[];
  stats: ParallelExecutionStats;
}> {
  const allResults: ParallelResult<T>[] = [];
  const startTime = Date.now();

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const { results } = await executeParallel(batch, options);
    allResults.push(...results);
  }

  // Calculate combined stats
  const stats: ParallelExecutionStats = {
    totalTasks: tasks.length,
    successfulTasks: allResults.filter((r) => r.status === 'success').length,
    failedTasks: allResults.filter((r) => r.status === 'failed').length,
    timeoutTasks: allResults.filter((r) => r.status === 'timeout').length,
    totalDuration: Date.now() - startTime,
    parallelEfficiency: 0,
    taskTimings: allResults
      .map((r) => ({
        taskId: r.taskId,
        duration: r.duration,
        name: r.taskId,
      }))
      .sort((a, b) => b.duration - a.duration),
  };

  if (stats.taskTimings.length > 0) {
    const longestTask = stats.taskTimings[0].duration;
    stats.parallelEfficiency = (longestTask / stats.totalDuration) * 100;
  }

  return { results: allResults, stats };
}

/**
 * Execute in parallel with early termination on first error
 */
export async function executeParallelRace<T>(
  tasks: ParallelTask<T>[]
): Promise<{
  winner: ParallelResult<T>;
  losers: ParallelResult<T>[];
}> {
  const startTime = Date.now();

  const promises = tasks.map((task) =>
    executeWithTimeout(task.fn, task.timeout || 30000)
      .then((result) => ({
        taskId: task.id,
        status: 'success' as const,
        result,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
      }))
      .catch((error) => ({
        taskId: task.id,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
      }))
  );

  const winner = await Promise.race(promises);
  const losers = (await Promise.allSettled(promises))
    .map((p) => (p.status === 'fulfilled' ? p.value : undefined))
    .filter((r) => r && r.taskId !== winner.taskId) as ParallelResult<T>[];

  return { winner, losers };
}

/**
 * Pretty-print execution stats
 */
export function printParallelStats(stats: ParallelExecutionStats): void {
  process.stdout.write(`\n  ┌─ Parallel Execution Stats ──────────────────────┐\n`);
  process.stdout.write(`  │  Total tasks:        ${stats.totalTasks}\n`);
  process.stdout.write(`  │  Successful:         ${stats.successfulTasks}\n`);
  process.stdout.write(`  │  Failed:             ${stats.failedTasks}\n`);
  process.stdout.write(`  │  Timeouts:           ${stats.timeoutTasks}\n`);
  process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
  process.stdout.write(`  │  Total duration:     ${stats.totalDuration}ms\n`);
  process.stdout.write(`  │  Parallel efficiency: ${stats.parallelEfficiency.toFixed(1)}%\n`);

  if (stats.taskTimings.length > 0) {
    process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
    process.stdout.write(`  │  Longest tasks:\n`);

    for (const timing of stats.taskTimings.slice(0, 5)) {
      process.stdout.write(`  │    ${timing.name.padEnd(25)} ${timing.duration}ms\n`);
    }
  }

  process.stdout.write(`  └──────────────────────────────────────────────────┘\n\n`);
}
