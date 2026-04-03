/**
 * Parallel Research
 * Deploy 3-5 researchers in parallel for high-speed web research
 * Each researcher: search → fetch → compress → synthesize
 */

import { executeParallel } from './parallelExecutor';
import type { ParallelTask, ParallelExecutionStats } from './parallelExecutor';

export interface ResearchQuery {
  id: string;
  query: string;
  depth: 'shallow' | 'medium' | 'deep';
  maxSources?: number;
}

export interface ResearchResult {
  queryId: string;
  query: string;
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
  synthesis: string;
  tokensUsed: number;
  duration: number;
}

/**
 * Deploy parallel researchers for multiple queries
 * Runs all researchers concurrently
 */
export async function deployParallelResearchers(
  queries: ResearchQuery[],
  options?: {
    maxConcurrent?: number;
    timeout?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{
  results: ResearchResult[];
  stats: ParallelExecutionStats;
}> {
  const maxConcurrent = options?.maxConcurrent || 5;
  const timeout = options?.timeout || 30000;

  // Create parallel tasks for each query
  const tasks: ParallelTask<ResearchResult>[] = queries.map((q) => ({
    id: q.id,
    name: `Researcher: ${q.query.substring(0, 40)}`,
    fn: async () => {
      const startTime = Date.now();

      // Simulate research (in real impl, calls Wayfarer)
      const sources = [
        {
          url: `https://source1.com/${q.id}`,
          title: `Result for "${q.query}"`,
          snippet: `Found relevant information about ${q.query}...`,
        },
        {
          url: `https://source2.com/${q.id}`,
          title: `Another result for "${q.query}"`,
          snippet: `Additional context about ${q.query}...`,
        },
      ];

      // Simulate processing time based on depth
      const processingTime =
        q.depth === 'shallow' ? 2000 : q.depth === 'medium' ? 5000 : 10000;
      await new Promise((r) => setTimeout(r, processingTime));

      return {
        queryId: q.id,
        query: q.query,
        sources: sources.slice(0, q.maxSources || 2),
        synthesis: `Synthesized findings for: ${q.query}`,
        tokensUsed: Math.floor(Math.random() * 500) + 200,
        duration: Date.now() - startTime,
      };
    },
    timeout,
    priority: 'normal',
  }));

  // Execute all researchers in parallel
  const { results, stats } = await executeParallel(tasks, {
    defaultTimeout: timeout,
    continueOnError: true,
  });

  // Extract successful results
  const successfulResults = results
    .filter((r) => r.status === 'success')
    .map((r) => r.result as ResearchResult);

  return { results: successfulResults, stats };
}

/**
 * Run parallel search → fetch → compress → synthesize pipeline
 */
export async function parallelResearchPipeline(
  queries: string[],
  options?: {
    researchDepth?: 'shallow' | 'medium' | 'deep';
    parallelism?: number;
    timeout?: number;
  }
): Promise<ResearchResult[]> {
  const depth = options?.researchDepth || 'medium';
  const parallelism = options?.parallelism || 5;

  const researchQueries: ResearchQuery[] = queries.map((q, i) => ({
    id: `query_${i}`,
    query: q,
    depth,
    maxSources: depth === 'shallow' ? 2 : depth === 'medium' ? 5 : 10,
  }));

  const { results } = await deployParallelResearchers(researchQueries, {
    maxConcurrent: parallelism,
    timeout: options?.timeout,
  });

  return results;
}

/**
 * Adaptive parallelism based on query complexity
 */
export async function adaptiveParallelResearch(
  queries: ResearchQuery[],
  options?: {
    timeout?: number;
  }
): Promise<ResearchResult[]> {
  // Simple queries: 5 parallel
  // Medium queries: 3 parallel
  // Deep queries: 1-2 parallel (they take longer)

  const simpleQueries = queries.filter((q) => q.depth === 'shallow');
  const mediumQueries = queries.filter((q) => q.depth === 'medium');
  const deepQueries = queries.filter((q) => q.depth === 'deep');

  const [simpleResults, mediumResults, deepResults] = await Promise.all([
    simpleQueries.length > 0
      ? deployParallelResearchers(simpleQueries, { maxConcurrent: 5, timeout: options?.timeout }).then((r) => r.results)
      : Promise.resolve([]),
    mediumQueries.length > 0
      ? deployParallelResearchers(mediumQueries, { maxConcurrent: 3, timeout: options?.timeout }).then((r) => r.results)
      : Promise.resolve([]),
    deepQueries.length > 0
      ? deployParallelResearchers(deepQueries, { maxConcurrent: 2, timeout: options?.timeout }).then((r) => r.results)
      : Promise.resolve([]),
  ]);

  return [...simpleResults, ...mediumResults, ...deepResults];
}

/**
 * Parallel research with throttling
 * Ensures upstream services don't get overwhelmed
 */
export async function throttledParallelResearch(
  queries: ResearchQuery[],
  throttleDelay: number = 100,
  options?: {
    timeout?: number;
  }
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);

    const { results: batchResults } = await deployParallelResearchers(batch, {
      maxConcurrent: 3,
      timeout: options?.timeout,
    });

    results.push(...batchResults);

    // Throttle between batches
    if (i + 3 < queries.length) {
      await new Promise((r) => setTimeout(r, throttleDelay));
    }
  }

  return results;
}
