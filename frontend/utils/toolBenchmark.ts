/**
 * Tool Benchmark System — Test tool execution capability
 *
 * Purpose: Verify that LLM can reliably invoke tools BEFORE using them in production
 * Key insight: Some models can't call tools reliably (<70% success), need escalation
 *
 * What's measured:
 *   - SUCCESS RATE: % of tests where tool was invoked correctly
 *   - LATENCY: How long tool invocation takes
 *   - ERRORS: What went wrong when it failed
 *
 * What's NOT measured:
 *   - Response quality (that's for response benchmarking)
 *   - Model reasoning ability (that's for LLM benchmarking)
 *   - Final answer correctness (that's for task benchmarking)
 *
 * Use case: Before running agent with tools, check: "Can this model call tools?"
 */

// A single test case for a tool
export interface ToolTest {
  name: string;              // Name of this test (e.g., "simple_search")
  input: any;               // Input/arguments for the tool
  expectedOutput?: any;     // Optional expected result (for validation)
  timeout?: number;         // Max execution time in milliseconds
}

// Results from benchmarking a single tool
export interface BenchmarkResult {
  toolName: string;         // Which tool was tested
  testCount: number;        // How many tests ran
  successCount: number;     // How many succeeded
  successRate: number;      // Success rate: 0-100 (e.g., 85%)
  avgLatency: number;       // Average time in milliseconds
  errors: string[];        // List of errors encountered
  timestamp: string;        // When this test ran (ISO 8601)
  model?: string;          // Which model was used
}

// Overall capability score across multiple tools
export interface ToolCapabilityScore {
  canCallTools: boolean;     // Safe to use tools? (success rate > 70%)
  successRate: number;       // Overall success rate: 0-100
  avgLatencyMs: number;      // Average latency across all tools
  recommendedModel?: string; // Should escalate to this model?
  details: BenchmarkResult[]; // Per-tool results
}

/**
 * Standard tool tests for common operations
 */
const STANDARD_TESTS: Record<string, ToolTest[]> = {
  'web_search': [
    { name: 'simple_search', input: { query: 'weather today' } },
    { name: 'complex_query', input: { query: 'latest AI research 2024' } },
    { name: 'with_filters', input: { query: 'python tutorial', language: 'en' } },
  ],
  'file_operations': [
    { name: 'read_file', input: { path: '/tmp/test.txt' } },
    { name: 'list_directory', input: { path: '/tmp' } },
  ],
  'code_execution': [
    { name: 'run_javascript', input: { code: 'console.log("test"); return 42;' } },
    { name: 'run_python', input: { code: 'print("test")\nreturn 42' } },
  ],
  'json_operations': [
    { name: 'parse_json', input: { data: '{"test": "value"}' } },
    { name: 'validate_json', input: { data: '{"nested": {"key": 123}}' } },
  ],
};

/**
 * Run a single tool test and measure success/latency
 *
 * This function:
 *   1. Calls the tool with test inputs
 *   2. Measures time taken
 *   3. Catches errors and timeouts
 *   4. Returns pass/fail + metrics
 */
async function runToolTest(
  toolName: string,
  test: ToolTest,
  executorFn: (tool: string, input: any) => Promise<any>,
): Promise<{ success: boolean; latency: number; error?: string }> {
  // Start timer before invoking tool
  const startTime = performance.now();

  try {
    // Get timeout from test or use default 10s
    const timeout = test.timeout || 10000;

    // Create timeout promise that rejects after N ms
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    );

    // Create tool execution promise
    const resultPromise = executorFn(toolName, test.input);

    // Race: whichever finishes first (tool or timeout) wins
    // If timeout finishes first, we throw "Test timeout" error
    await Promise.race([resultPromise, timeoutPromise]);

    // Tool succeeded within timeout
    const latency = performance.now() - startTime;
    return { success: true, latency };
  } catch (error) {
    // Tool failed or timed out
    const latency = performance.now() - startTime;
    return {
      success: false,
      latency,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Benchmark a single tool
 */
export async function benchmarkTool(
  toolName: string,
  executorFn: (tool: string, input: any) => Promise<any>,
  customTests?: ToolTest[],
): Promise<BenchmarkResult> {
  const tests = customTests || STANDARD_TESTS[toolName] || [];

  if (tests.length === 0) {
    return {
      toolName,
      testCount: 0,
      successCount: 0,
      successRate: 0,
      avgLatency: 0,
      errors: ['No tests defined for this tool'],
      timestamp: new Date().toISOString(),
    };
  }

  const results = await Promise.allSettled(
    tests.map(test => runToolTest(toolName, test, executorFn))
  );

  const successes = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ) as PromiseFulfilledResult<{ success: true; latency: number }>[];

  const failures = results.filter(
    r => r.status === 'fulfilled' && !r.value.success
  ) as PromiseFulfilledResult<{ success: false; error?: string }>[];

  const latencies = successes.map(r => r.value.latency);
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  const errors = failures
    .map(r => r.value.error || 'Unknown error')
    .filter(Boolean);

  return {
    toolName,
    testCount: tests.length,
    successCount: successes.length,
    successRate: (successes.length / tests.length) * 100,
    avgLatency,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Comprehensive tool capability benchmark
 * Tests multiple tools and returns overall capability score
 */
export async function benchmarkToolCapability(
  toolNames: string[],
  executorFn: (tool: string, input: any) => Promise<any>,
  customTestsMap?: Record<string, ToolTest[]>,
): Promise<ToolCapabilityScore> {
  const results = await Promise.allSettled(
    toolNames.map(toolName =>
      benchmarkTool(
        toolName,
        executorFn,
        customTestsMap?.[toolName]
      )
    )
  );

  const successfulResults = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<BenchmarkResult>).value);

  const totalTests = successfulResults.reduce((sum, r) => sum + r.testCount, 0);
  const totalSuccesses = successfulResults.reduce((sum, r) => sum + r.successCount, 0);
  const overallSuccessRate = totalTests > 0 ? (totalSuccesses / totalTests) * 100 : 0;

  const allLatencies = successfulResults
    .filter(r => r.avgLatency > 0)
    .map(r => r.avgLatency);

  const avgLatency = allLatencies.length > 0
    ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
    : 0;

  // Determine capability: can call tools if success rate > 70%
  const canCallTools = overallSuccessRate >= 70;

  // Recommend model based on performance
  let recommendedModel: string | undefined;
  if (!canCallTools) {
    recommendedModel = 'qwen3.5:9b';  // Escalate to 9b for better tool calling
  } else if (overallSuccessRate < 85) {
    recommendedModel = 'qwen3.5:9b';  // Good but could be better
  }

  return {
    canCallTools,
    successRate: overallSuccessRate,
    avgLatencyMs: avgLatency,
    recommendedModel,
    details: successfulResults,
  };
}

/**
 * Quick tool capability check (< 5s)
 * Runs single fast test per tool
 */
export async function quickToolCheck(
  toolNames: string[],
  executorFn: (tool: string, input: any) => Promise<any>,
): Promise<ToolCapabilityScore> {
  const quickTests: Record<string, ToolTest[]> = {};

  toolNames.forEach(tool => {
    quickTests[tool] = STANDARD_TESTS[tool]?.slice(0, 1) || [
      { name: 'basic_test', input: {} }
    ];
  });

  return benchmarkToolCapability(toolNames, executorFn, quickTests);
}

/**
 * Determine if model needs tool calling improvement
 */
export function needsToolCallingImprovement(score: ToolCapabilityScore): boolean {
  return !score.canCallTools || score.successRate < 80;
}

/**
 * Get tool calling improvement recommendations
 */
export function getToolCallingRecommendations(
  score: ToolCapabilityScore
): string[] {
  const recommendations: string[] = [];

  if (!score.canCallTools) {
    recommendations.push('Model cannot reliably call tools — upgrade to 9b or larger');
  }

  if (score.successRate < 70) {
    recommendations.push('Tool success rate too low — check tool definitions and error handling');
  }

  if (score.successRate < 85) {
    recommendations.push('Consider using larger model (9b) for more reliable tool calling');
  }

  if (score.avgLatencyMs > 5000) {
    recommendations.push('Tool latency is high — optimize tool implementation or use faster endpoints');
  }

  return recommendations;
}
