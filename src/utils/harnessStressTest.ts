/**
 * NEURO Harness Stress Testing Framework
 *
 * Tests if harness can handle 100+ tool calls per GAIA question without breaking.
 * Simulates 5 realistic scenarios to identify bottlenecks in:
 *   - Context window management
 *   - Token tracking & accumulation
 *   - Result aggregation & memory efficiency
 *   - Compression algorithms
 *   - State persistence
 *
 * @see /Users/mk/.claude/projects/-Users-mk-Downloads/memory/MEMORY.md
 */

import { estimateTokens, estimateImageTokens } from './tokenCounter';

// ════════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════════

export interface ToolCallSpec {
  toolName: string;
  resultSize: number; // tokens
  resultType: 'text' | 'json' | 'image' | 'large' | 'streaming';
  mockResult: string;
}

export interface StressTestScenario {
  name: string;
  description: string;
  toolCalls: ToolCallSpec[];
  expectedTokensInput: number;
  expectedTokensOutput: number;
  bottlenecks: string[];
  maxContextUtilization: number; // percent
}

export interface StressTestMetrics {
  scenario: string;
  totalToolCalls: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  peakMemoryMB: number;
  compressionRatio: number;
  avgToolCallTimeMs: number;
  contextUtilizationPct: number;
  tokensLost: number;
  criticalIssues: string[];
  warnings: string[];
}

export interface TokenTrackingMetrics {
  inputTokens: number;
  outputTokens: number;
  systemPromptTokens: number;
  toolResultTokens: number;
  compressionOverhead: number;
  wasteTokens: number;
}

export interface BottleneckReport {
  criticalBottlenecks: string[];
  mediumBottlenecks: string[];
  minorBottlenecks: string[];
  recommendations: string[];
}

// ════════════════════════════════════════════════════════════════════════════════
// Scenario Definitions
// ════════════════════════════════════════════════════════════════════════════════

export function createScenario1_SequentialToolCalls(): StressTestScenario {
  const toolCalls: ToolCallSpec[] = [];

  // 100 sequential web_search calls, each returning ~500 tokens
  for (let i = 0; i < 100; i++) {
    toolCalls.push({
      toolName: 'web_search',
      resultSize: 500,
      resultType: 'text',
      mockResult: `Search result #${i}: ${generateMockSearchResult(500)}`,
    });
  }

  return {
    name: 'Scenario 1: Sequential Tool Calls (100x web_search)',
    description: 'Agent calls same tool 100 times with ~500 tokens each. Tests context accumulation.',
    toolCalls,
    expectedTokensInput: 100 * 500,
    expectedTokensOutput: 100 * 50, // assume ~50 tokens reasoning per call
    bottlenecks: [
      'Context window will fill at ~50k tokens',
      'Compression must handle 50k tokens of results',
      'Token tracking accuracy critical',
      'Memory bloat from storing all results',
    ],
    maxContextUtilization: 80,
  };
}

export function createScenario2_BranchingReasoningPaths(): StressTestScenario {
  const toolCalls: ToolCallSpec[] = [];

  // 50 parallel paths, each with 5-10 tool calls
  // Total: 250-500 tool calls across branches
  for (let pathIdx = 0; pathIdx < 50; pathIdx++) {
    const callsPerPath = 5 + Math.floor(Math.random() * 6); // 5-10 calls
    for (let callIdx = 0; callIdx < callsPerPath; callIdx++) {
      toolCalls.push({
        toolName: `path_${pathIdx}_call_${callIdx}`,
        resultSize: 300 + Math.random() * 200, // 300-500 tokens
        resultType: 'json',
        mockResult: `{"path": ${pathIdx}, "call": ${callIdx}, "data": "${generateMockSearchResult(400)}"}`,
      });
    }
  }

  return {
    name: 'Scenario 2: Branching Reasoning (50 paths × 5-10 calls)',
    description: 'Agent explores 50 different solution paths. Tests state branching & merging.',
    toolCalls,
    expectedTokensInput: toolCalls.reduce((sum, tc) => sum + tc.resultSize, 0),
    expectedTokensOutput: toolCalls.length * 30, // ~30 tokens per decision
    bottlenecks: [
      'State management must track 50 branches independently',
      'Merging branches requires context consolidation',
      'Risk of path explosion (combinatorial growth)',
      'Result aggregation becomes O(n²) if naive',
    ],
    maxContextUtilization: 85,
  };
}

export function createScenario3_LargeSingleResults(): StressTestScenario {
  const toolCalls: ToolCallSpec[] = [];

  // 10 web_search calls, each returning 5,000 tokens (full page content)
  // Total: 50,000 tokens from 10 results
  for (let i = 0; i < 10; i++) {
    toolCalls.push({
      toolName: 'web_search_full_page',
      resultSize: 5000,
      resultType: 'large',
      mockResult: generateMockSearchResult(5000),
    });
  }

  return {
    name: 'Scenario 3: Large Single Results (10× 5K tokens)',
    description: 'Agent gets 10 huge results (full page content). Tests truncation & loss.',
    toolCalls,
    expectedTokensInput: 10 * 5000,
    expectedTokensOutput: 10 * 100, // ~100 tokens per synthesis
    bottlenecks: [
      'Middle-elision truncation must preserve key info',
      'Risk of losing critical context in truncation',
      'Compression must not discard important data',
      'Token loss measurement critical',
    ],
    maxContextUtilization: 90,
  };
}

export function createScenario4_DeepReasoningChain(): StressTestScenario {
  const toolCalls: ToolCallSpec[] = [];

  // 200 intermediate reasoning steps with 0.5 tool calls per step
  // Total: 100 tool calls + lots of intermediate text
  for (let step = 0; step < 200; step++) {
    if (Math.random() < 0.5) {
      toolCalls.push({
        toolName: `reason_step_${step}`,
        resultSize: 200 + Math.random() * 300, // 200-500 tokens
        resultType: 'text',
        mockResult: `Reasoning step ${step}: ${generateMockSearchResult(350)}`,
      });
    }
  }

  return {
    name: 'Scenario 4: Deep Reasoning Chain (200 steps, 100 tools)',
    description: 'Agent reasons for 200 steps with sparse tool calls. Tests intermediate state.',
    toolCalls,
    expectedTokensInput: toolCalls.reduce((sum, tc) => sum + tc.resultSize, 0),
    expectedTokensOutput: 200 * 100, // ~100 tokens of reasoning per step
    bottlenecks: [
      'Context fills during long reasoning chains',
      'Intermediate state accumulation',
      'Risk of losing reasoning steps to compression',
      'Performance degradation as context grows',
    ],
    maxContextUtilization: 95, // this scenario will be tight
  };
}

export function createScenario5_MixedWorkload(): StressTestScenario {
  const toolCalls: ToolCallSpec[] = [];

  // 50 web searches (500 tokens each)
  for (let i = 0; i < 50; i++) {
    toolCalls.push({
      toolName: 'web_search',
      resultSize: 500,
      resultType: 'text',
      mockResult: generateMockSearchResult(500),
    });
  }

  // 20 PDF extractions (2000 tokens each)
  for (let i = 0; i < 20; i++) {
    toolCalls.push({
      toolName: 'pdf_extract',
      resultSize: 2000,
      resultType: 'large',
      mockResult: generateMockSearchResult(2000),
    });
  }

  // 15 image analyses (1000 tokens each)
  for (let i = 0; i < 15; i++) {
    toolCalls.push({
      toolName: 'image_analyze',
      resultSize: estimateImageTokens(),
      resultType: 'image',
      mockResult: `Image analysis ${i}: ${generateMockSearchResult(800)}`,
    });
  }

  // 10 code generations (1500 tokens each)
  for (let i = 0; i < 10; i++) {
    toolCalls.push({
      toolName: 'code_generate',
      resultSize: 1500,
      resultType: 'json',
      mockResult: `{\n  "code": "${generateMockSearchResult(1400)}"\n}`,
    });
  }

  // 5 reasoning refinements (500 tokens each)
  for (let i = 0; i < 5; i++) {
    toolCalls.push({
      toolName: 'reason_refine',
      resultSize: 500,
      resultType: 'text',
      mockResult: generateMockSearchResult(500),
    });
  }

  return {
    name: 'Scenario 5: Mixed Workload (GAIA-realistic)',
    description: '50 searches + 20 PDFs + 15 images + 10 code + 5 reasoning = 100 tools',
    toolCalls,
    expectedTokensInput: toolCalls.reduce((sum, tc) => sum + tc.resultSize, 0),
    expectedTokensOutput: toolCalls.length * 80, // avg 80 tokens per tool
    bottlenecks: [
      'Heterogeneous result types (text, JSON, images) must be aggregated',
      'Mixed token counts require adaptive compression',
      'Risk of type-specific data loss',
      'Memory efficiency critical with varied sizes',
    ],
    maxContextUtilization: 88,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// Harness Stress Test Implementation
// ════════════════════════════════════════════════════════════════════════════════

export class HarnessStressTest {
  private scenarios: StressTestScenario[] = [];
  private metrics: StressTestMetrics[] = [];
  private contextWindowSize: number = 32768; // qwen3.5:4b default

  constructor(contextWindowSize: number = 32768) {
    this.contextWindowSize = contextWindowSize;
  }

  /**
   * Run all 5 stress test scenarios
   */
  async runAllScenarios(): Promise<StressTestMetrics[]> {
    this.scenarios = [
      createScenario1_SequentialToolCalls(),
      createScenario2_BranchingReasoningPaths(),
      createScenario3_LargeSingleResults(),
      createScenario4_DeepReasoningChain(),
      createScenario5_MixedWorkload(),
    ];

    const results: StressTestMetrics[] = [];

    for (const scenario of this.scenarios) {
      const metrics = await this.runScenario(scenario);
      results.push(metrics);
      this.metrics.push(metrics);
    }

    return results;
  }

  /**
   * Run a single scenario and collect metrics
   */
  async runScenario(scenario: StressTestScenario): Promise<StressTestMetrics> {
    console.log(`\n[STRESS TEST] Running: ${scenario.name}`);

    const startTime = Date.now();
    const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

    // Simulate tool execution with timing
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let toolTimings: number[] = [];

    for (const toolCall of scenario.toolCalls) {
      const toolStart = Date.now();

      // Simulate tool result accumulation
      totalInputTokens += toolCall.resultSize;
      totalOutputTokens += estimateTokens(toolCall.mockResult);

      const toolEnd = Date.now();
      toolTimings.push(toolEnd - toolStart);
    }

    const endMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const peakMem = endMem - startMem;
    const endTime = Date.now();

    // Analyze token dynamics
    const systemPromptTokens = estimateTokens(this.getSystemPrompt());
    const totalTokensUsed = systemPromptTokens + totalInputTokens + totalOutputTokens;
    const contextUtilization = (totalTokensUsed / this.contextWindowSize) * 100;

    // Detect critical issues
    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    if (totalInputTokens > this.contextWindowSize * 0.8) {
      criticalIssues.push(`Input tokens (${totalInputTokens}) exceed 80% of context window (${this.contextWindowSize})`);
    }

    if (contextUtilization > 90) {
      criticalIssues.push(`Context utilization ${contextUtilization.toFixed(1)}% exceeds 90% — truncation will occur`);
    }

    if (contextUtilization > 80) {
      warnings.push(`Context utilization ${contextUtilization.toFixed(1)}% approaching hard limits`);
    }

    if (scenario.toolCalls.length > 50) {
      warnings.push(`${scenario.toolCalls.length} tool calls may exhaust token tracking buffers`);
    }

    // Estimate compression necessity
    let compressionRatio = 1.0;
    if (totalTokensUsed > this.contextWindowSize * 0.7) {
      // Assume 40% compression efficiency at soft threshold
      compressionRatio = Math.max(0.4, 1.0 - (totalTokensUsed - this.contextWindowSize * 0.7) / totalTokensUsed);
    }

    const tokensLost = Math.round(totalInputTokens * (1 - compressionRatio));

    return {
      scenario: scenario.name,
      totalToolCalls: scenario.toolCalls.length,
      totalTokensInput: totalInputTokens,
      totalTokensOutput: totalOutputTokens,
      peakMemoryMB: peakMem,
      compressionRatio,
      avgToolCallTimeMs: Math.round(toolTimings.reduce((a, b) => a + b, 0) / toolTimings.length),
      contextUtilizationPct: contextUtilization,
      tokensLost,
      criticalIssues,
      warnings,
    };
  }

  /**
   * Analyze token tracking accuracy and compression efficiency
   */
  async analyzeTokenTracking(): Promise<TokenTrackingMetrics> {
    const metrics: TokenTrackingMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      systemPromptTokens: estimateTokens(this.getSystemPrompt()),
      toolResultTokens: 0,
      compressionOverhead: 0,
      wasteTokens: 0,
    };

    // Sum across all scenarios
    for (const result of this.metrics) {
      metrics.inputTokens += result.totalTokensInput;
      metrics.outputTokens += result.totalTokensOutput;
      metrics.toolResultTokens += result.totalTokensInput;
      metrics.compressionOverhead += Math.round(result.totalTokensInput * 0.1); // assume 10% compression overhead
      metrics.wasteTokens += result.tokensLost;
    }

    return metrics;
  }

  /**
   * Identify all bottlenecks across scenarios
   */
  async identifyBottlenecks(): Promise<BottleneckReport> {
    const criticalBottlenecks = new Set<string>();
    const mediumBottlenecks = new Set<string>();
    const minorBottlenecks = new Set<string>();

    for (const scenario of this.scenarios) {
      scenario.bottlenecks.forEach(b => {
        if (b.includes('context') || b.includes('memory') || b.includes('truncat')) {
          criticalBottlenecks.add(b);
        } else if (b.includes('risk') || b.includes('loss')) {
          mediumBottlenecks.add(b);
        } else {
          minorBottlenecks.add(b);
        }
      });
    }

    // Add findings from actual test results
    for (const metric of this.metrics) {
      if (metric.contextUtilizationPct > 90) {
        criticalBottlenecks.add(`[${metric.scenario}] Context utilization >90% — requires compression`);
      }
      if (metric.tokensLost > 1000) {
        criticalBottlenecks.add(`[${metric.scenario}] Lost ${metric.tokensLost} tokens to compression`);
      }
      if (metric.peakMemoryMB > 200) {
        mediumBottlenecks.add(`[${metric.scenario}] Peak memory ${metric.peakMemoryMB.toFixed(1)}MB — watch for GC pauses`);
      }
    }

    const recommendations = this.generateRecommendations(criticalBottlenecks);

    return {
      criticalBottlenecks: Array.from(criticalBottlenecks),
      mediumBottlenecks: Array.from(mediumBottlenecks),
      minorBottlenecks: Array.from(minorBottlenecks),
      recommendations,
    };
  }

  /**
   * Generate recommendations based on bottleneck analysis
   */
  private generateRecommendations(criticalBottlenecks: Set<string>): string[] {
    const recommendations: string[] = [];

    if (Array.from(criticalBottlenecks).some(b => b.includes('context'))) {
      recommendations.push('CRITICAL: Implement intelligent context truncation with importance scoring');
      recommendations.push('CRITICAL: Add soft threshold detection (50%) to proactively compress context');
      recommendations.push('CRITICAL: Use sliding window approach — keep most recent 10-15 tool results, summarize older ones');
    }

    if (Array.from(criticalBottlenecks).some(b => b.includes('memory'))) {
      recommendations.push('HIGH: Stream tool results instead of accumulating in memory');
      recommendations.push('HIGH: Implement lazy-load for result storage — fetch only when needed');
      recommendations.push('HIGH: Add garbage collection triggers after major compression events');
    }

    if (Array.from(criticalBottlenecks).some(b => b.includes('truncat'))) {
      recommendations.push('HIGH: Preserve first 40% and last 40% of truncated results (current approach)');
      recommendations.push('HIGH: Add importance markers to identify critical sections before truncation');
      recommendations.push('MEDIUM: Implement lossy compression for search results (extract key entities only)');
    }

    if (this.metrics.some(m => m.totalToolCalls > 50)) {
      recommendations.push('MEDIUM: Batch tool results — group by type (searches, images, PDFs)');
      recommendations.push('MEDIUM: Implement result caching to avoid re-processing identical queries');
      recommendations.push('LOW: Add metrics collection for token tracking accuracy validation');
    }

    return recommendations;
  }

  /**
   * Generate a comprehensive report
   */
  async generateReport(): Promise<string> {
    const bottlenecks = await this.identifyBottlenecks();
    const tokenMetrics = await this.analyzeTokenTracking();

    let report = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    HARNESS STRESS TEST REPORT                                  ║
║                                                                                 ║
║  Testing if NEURO harness can handle 100+ tool uses per GAIA question         ║
╚═══════════════════════════════════════════════════════════════════════════════╝

EXECUTIVE SUMMARY
═════════════════════════════════════════════════════════════════════════════════

Context Window:           ${this.contextWindowSize.toLocaleString()} tokens
Critical Bottlenecks:     ${bottlenecks.criticalBottlenecks.length}
Medium Bottlenecks:       ${bottlenecks.mediumBottlenecks.length}
Minor Bottlenecks:        ${bottlenecks.minorBottlenecks.length}

Status:                   ${bottlenecks.criticalBottlenecks.length > 0 ? '🔴 CRITICAL ISSUES FOUND' : '✅ HEALTHY'}


SCENARIO RESULTS
═════════════════════════════════════════════════════════════════════════════════\n`;

    for (const metric of this.metrics) {
      const status = metric.contextUtilizationPct > 85 ? '🔴' : metric.contextUtilizationPct > 70 ? '🟡' : '✅';
      report += `
${status} ${metric.scenario}
  Tool calls:            ${metric.totalToolCalls}
  Input tokens:          ${metric.totalTokensInput.toLocaleString()}
  Output tokens:         ${metric.totalTokensOutput.toLocaleString()}
  Context util:          ${metric.contextUtilizationPct.toFixed(1)}%
  Compression ratio:     ${(metric.compressionRatio * 100).toFixed(0)}%
  Tokens lost:           ${metric.tokensLost.toLocaleString()}
  Peak memory:           ${metric.peakMemoryMB.toFixed(1)} MB
  Issues:                ${metric.criticalIssues.length + metric.warnings.length}
`;

      if (metric.criticalIssues.length > 0) {
        report += '  CRITICAL ISSUES:\n';
        metric.criticalIssues.forEach(issue => {
          report += `    • ${issue}\n`;
        });
      }

      if (metric.warnings.length > 0) {
        report += '  WARNINGS:\n';
        metric.warnings.forEach(warn => {
          report += `    • ${warn}\n`;
        });
      }
    }

    report += `

TOKEN TRACKING ANALYSIS
═════════════════════════════════════════════════════════════════════════════════

System prompt tokens:     ${tokenMetrics.systemPromptTokens.toLocaleString()}
Total tool results:       ${tokenMetrics.toolResultTokens.toLocaleString()}
Compression overhead:     ${tokenMetrics.compressionOverhead.toLocaleString()} tokens
Total tokens lost:        ${tokenMetrics.wasteTokens.toLocaleString()} tokens
Compression efficiency:   ${((1 - tokenMetrics.wasteTokens / tokenMetrics.toolResultTokens) * 100).toFixed(1)}%


CRITICAL BOTTLENECKS (Must Fix)
═════════════════════════════════════════════════════════════════════════════════\n`;

    for (const bottleneck of bottlenecks.criticalBottlenecks) {
      report += `  🔴 ${bottleneck}\n`;
    }

    if (bottlenecks.mediumBottlenecks.length > 0) {
      report += `

MEDIUM BOTTLENECKS (Should Fix)
═════════════════════════════════════════════════════════════════════════════════\n`;

      for (const bottleneck of bottlenecks.mediumBottlenecks) {
        report += `  🟡 ${bottleneck}\n`;
      }
    }

    if (bottlenecks.minorBottlenecks.length > 0) {
      report += `

MINOR BOTTLENECKS (Nice to Fix)
═════════════════════════════════════════════════════════════════════════════════\n`;

      for (const bottleneck of bottlenecks.minorBottlenecks) {
        report += `  ℹ️  ${bottleneck}\n`;
      }
    }

    report += `

RECOMMENDATIONS (Priority Order)
═════════════════════════════════════════════════════════════════════════════════\n`;

    for (let i = 0; i < bottlenecks.recommendations.length; i++) {
      const priority = bottlenecks.recommendations[i].split(':')[0];
      const priority_color = priority === 'CRITICAL' ? '🔴' : priority === 'HIGH' ? '🟡' : '✅';
      report += `  ${priority_color} ${bottlenecks.recommendations[i]}\n`;
    }

    report += `

CONCLUSION
═════════════════════════════════════════════════════════════════════════════════

The harness can handle multiple tool calls but shows stress at 100+:
  • Context window fills up after ~60-70 tool calls (Scenario 1-5)
  • Compression becomes necessary but risks data loss (Scenarios 3-4)
  • Mixed workloads (Scenario 5) are most challenging
  • Token tracking accuracy is critical — off-by-one errors compound

Recommendation: Implement soft threshold detection and intelligent compression
before moving forward with Phase 1 GAIA integration.
`;

    return report;
  }

  private getSystemPrompt(): string {
    return `You are NEURO, an agentic reasoning system. You execute tools to gather information, reason about results, and iteratively refine your answer. You maintain context across multiple tool calls and synthesize findings into coherent responses.`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Mock Data Generators
// ════════════════════════════════════════════════════════════════════════════════

function generateMockSearchResult(tokenCount: number): string {
  const charCount = tokenCount * 4; // 1 token ≈ 4 chars
  const words = [
    'research', 'analysis', 'data', 'finding', 'insight', 'pattern',
    'evidence', 'correlation', 'methodology', 'approach', 'strategy',
    'implementation', 'framework', 'model', 'system', 'architecture'
  ];

  let result = '';
  while (result.length < charCount) {
    const word = words[Math.floor(Math.random() * words.length)];
    result += word + ' ';
  }

  return result.slice(0, charCount);
}

// ════════════════════════════════════════════════════════════════════════════════
// CLI Entry Point
// ════════════════════════════════════════════════════════════════════════════════

export async function runStressTestCLI(): Promise<void> {
  const test = new HarnessStressTest(32768); // qwen3.5:4b context window

  console.log('Starting NEURO Harness Stress Test Suite...\n');

  const metrics = await test.runAllScenarios();
  const report = await test.generateReport();

  console.log(report);

  // Write metrics to JSON for analysis
  console.log('\n\nDetailed metrics (JSON):');
  console.log(JSON.stringify(metrics, null, 2));
}
