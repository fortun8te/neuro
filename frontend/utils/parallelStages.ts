/**
 * Parallel Stages
 * Orchestrates parallel execution of pipeline stages
 * Some stages depend on earlier ones, others run in parallel
 */

export interface StageOutput {
  stageName: string;
  output: string;
  tokensUsed: number;
  duration: number;
  timestamp: number;
}

export interface CyclePhaseResult {
  phases: {
    research: StageOutput | null;
    objections: StageOutput | null;
    taste: StageOutput | null;
    make: StageOutput | null;
    test: StageOutput | null;
  };
  totalDuration: number;
  parallelizationGains: {
    theoreticalSequential: number;
    actualParallel: number;
    speedup: number;
  };
}

/**
 * Execute cycle phases with optimal parallelization
 *
 * Dependency graph:
 * Research (start)
 *   ├→ Objections (depends on research)
 *   ├→ Taste (depends on research)
 *   └→ Coverage (parallel with above)
 *        └→ Make (depends on research + objections + taste)
 *             └→ Test (depends on make)
 *
 * Optimal parallelization:
 * - Phase 1 (0ms): Research (start in parallel with everything)
 * - Phase 2 (at research+1ms): Objections + Taste (parallel, depend on research)
 * - Phase 3 (after both): Make (depends on all)
 * - Phase 4: Test (depends on make)
 */
export async function executeParallelCycle(
  briefing: any,
  options?: {
    researchTimeout?: number;
    phaseTimeout?: number;
    onPhaseStart?: (phase: string) => void;
    onPhaseComplete?: (phase: string, duration: number) => void;
  }
): Promise<CyclePhaseResult> {
  const cycleStartTime = Date.now();
  const phases = {
    research: null as StageOutput | null,
    objections: null as StageOutput | null,
    taste: null as StageOutput | null,
    make: null as StageOutput | null,
    test: null as StageOutput | null,
  };

  try {
    // Phase 1: Research (foundation)
    if (options?.onPhaseStart) options.onPhaseStart('research');
    const researchStart = Date.now();
    phases.research = {
      stageName: 'research',
      output: 'Parallel research results...',
      tokensUsed: 5000,
      duration: Date.now() - researchStart,
      timestamp: researchStart,
    };
    if (options?.onPhaseComplete) options.onPhaseComplete('research', phases.research.duration);

    // Phase 2: Parallel objections + taste (both depend on research)
    if (options?.onPhaseStart) {
      options.onPhaseStart('objections');
      options.onPhaseStart('taste');
    }

    const [objResult, tasteResult] = await Promise.all([
      // Objections phase
      (async () => {
        const start = Date.now();
        // Simulated work
        await new Promise((r) => setTimeout(r, 2000));
        return {
          stageName: 'objections',
          output: 'Objection analysis from research...',
          tokensUsed: 2000,
          duration: Date.now() - start,
          timestamp: start,
        };
      })(),
      // Taste phase
      (async () => {
        const start = Date.now();
        // Simulated work
        await new Promise((r) => setTimeout(r, 2000));
        return {
          stageName: 'taste',
          output: 'Taste/creative direction from research...',
          tokensUsed: 1500,
          duration: Date.now() - start,
          timestamp: start,
        };
      })(),
    ]);

    phases.objections = objResult;
    phases.taste = tasteResult;

    if (options?.onPhaseComplete) {
      options.onPhaseComplete('objections', phases.objections.duration);
      options.onPhaseComplete('taste', phases.taste.duration);
    }

    // Phase 3: Make (depends on research + objections + taste)
    if (options?.onPhaseStart) options.onPhaseStart('make');
    const makeStart = Date.now();
    // Simulated work
    await new Promise((r) => setTimeout(r, 3000));
    phases.make = {
      stageName: 'make',
      output: 'Generated ad concepts using all inputs...',
      tokensUsed: 3000,
      duration: Date.now() - makeStart,
      timestamp: makeStart,
    };
    if (options?.onPhaseComplete) options.onPhaseComplete('make', phases.make.duration);

    // Phase 4: Test (depends on make)
    if (options?.onPhaseStart) options.onPhaseStart('test');
    const testStart = Date.now();
    // Simulated work
    await new Promise((r) => setTimeout(r, 1500));
    phases.test = {
      stageName: 'test',
      output: 'Test evaluation complete, winner selected...',
      tokensUsed: 1000,
      duration: Date.now() - testStart,
      timestamp: testStart,
    };
    if (options?.onPhaseComplete) options.onPhaseComplete('test', phases.test.duration);

    // Calculate parallelization gains
    const sequentialDuration =
      (phases.research?.duration || 0) +
      (phases.objections?.duration || 0) +
      (phases.taste?.duration || 0) +
      (phases.make?.duration || 0) +
      (phases.test?.duration || 0);

    const actualDuration = Date.now() - cycleStartTime;

    return {
      phases,
      totalDuration: actualDuration,
      parallelizationGains: {
        theoreticalSequential: sequentialDuration,
        actualParallel: actualDuration,
        speedup: sequentialDuration / actualDuration,
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Print cycle results with parallelization stats
 */
export function printParallelCycleResults(result: CyclePhaseResult): void {
  process.stdout.write(`\n  ┌─ Parallel Cycle Results ────────────────────────┐\n`);

  for (const [phase, output] of Object.entries(result.phases)) {
    if (output) {
      process.stdout.write(`  │  ${phase.padEnd(15)} ${output.duration}ms  (${output.tokensUsed} tokens)\n`);
    } else {
      process.stdout.write(`  │  ${phase.padEnd(15)} skipped\n`);
    }
  }

  process.stdout.write(`  ├──────────────────────────────────────────────────\n`);
  process.stdout.write(
    `  │  Sequential would be: ${result.parallelizationGains.theoreticalSequential}ms\n`
  );
  process.stdout.write(`  │  Parallel actual:     ${result.parallelizationGains.actualParallel}ms\n`);
  process.stdout.write(
    `  │  Speedup:             ${result.parallelizationGains.speedup.toFixed(2)}x faster\n`
  );
  process.stdout.write(`  └──────────────────────────────────────────────────┘\n\n`);
}
