/**
 * Stage Parallelizer
 * Identifies and executes parallelizable stages concurrently
 * Respects dependencies while maximizing parallelization
 */

import type { Cycle, StageName, Campaign } from '../types';

export interface StageGroup {
  parallel: StageName[];
  sequential: StageName[];
}

/**
 * Analyze stage dependencies and group parallelizable stages
 * Returns array of stage groups — each group can run in parallel,
 * but groups must execute sequentially
 */
export function analyzeStageGroups(stageOrder: StageName[]): StageGroup[] {
  // Dependency map — what each stage needs to complete first
  const stageDependencies: Record<StageName, StageName[]> = {
    'research': [],
    'brand-dna': ['research'],
    'persona-dna': ['research', 'brand-dna'],
    'angles': ['research', 'brand-dna', 'persona-dna'],
    'strategy': ['research', 'brand-dna', 'persona-dna', 'angles'],
    'copywriting': ['strategy'],
    'production': ['copywriting'],
    'test': ['production'],
  };

  const groups: StageGroup[] = [];
  const completed = new Set<StageName>();

  for (const stage of stageOrder) {
    const deps = stageDependencies[stage] || [];
    const depsComplete = deps.every(d => completed.has(d));

    if (depsComplete) {
      // Can this stage run in parallel with others?
      // Find other stages that also have complete dependencies
      const parallelizable = stageOrder.filter(s => {
        if (completed.has(s) || s === stage) return false;
        const sDeps = stageDependencies[s] || [];
        // Parallelizable if same deps are complete and no cross-deps
        const sCanRun = sDeps.every(d => completed.has(d));
        if (!sCanRun) return false;
        // Check for dependencies between s and stage
        const stageDeps = stageDependencies[stage] || [];
        return !stageDeps.includes(s) && !sDeps.includes(stage);
      });

      if (parallelizable.length > 0) {
        groups.push({
          parallel: [stage, ...parallelizable],
          sequential: [],
        });
        parallelizable.forEach(s => completed.add(s));
      } else {
        groups.push({
          parallel: [stage],
          sequential: [],
        });
      }

      completed.add(stage);
    }
  }

  return groups;
}

/**
 * Type for a stage executor function
 */
export type StageExecutor = (stageName: StageName) => Promise<void>;

/**
 * Execute stages in parallel groups
 * Returns total time for all groups
 */
export async function executeStageGroupsParallel(
  groups: StageGroup[],
  stageExecutor: StageExecutor
): Promise<{ totalDuration: number; groupTimings: Array<{ group: number; duration: number; stagesCompleted: StageName[] }> }> {
  const startTime = Date.now();
  const groupTimings: Array<{ group: number; duration: number; stagesCompleted: StageName[] }> = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupStartTime = Date.now();

    // Execute all stages in this group in parallel
    await Promise.all(
      group.parallel.map(stage => stageExecutor(stage))
    );

    const groupDuration = Date.now() - groupStartTime;
    groupTimings.push({
      group: i,
      duration: groupDuration,
      stagesCompleted: group.parallel,
    });
  }

  const totalDuration = Date.now() - startTime;

  return {
    totalDuration,
    groupTimings,
  };
}
