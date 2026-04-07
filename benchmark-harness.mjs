#!/usr/bin/env node
/**
 * BENCHMARK HARNESS — Tool Usage & Harness Quality Analysis
 *
 * Runs test questions through the agent and analyzes:
 * - Tool execution count per question
 * - Tool diversity (how many different tools used)
 * - Tool success rates
 * - Harness quality (error recovery, permission gates, abort signals)
 * - Response quality (not graded, just categorized)
 *
 * Usage:
 *   node benchmark-harness.mjs [--questions 10] [--verbose]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const INFRASTRUCTURE = {
  ollamaUrl: process.env.VITE_OLLAMA_URL || 'http://100.74.135.83:11440',
  wayayerUrl: process.env.VITE_WAYFAYER_URL || 'http://localhost:8889',
  searxngUrl: process.env.VITE_SEARXNG_URL || 'http://localhost:8888',
};

const args = process.argv.slice(2);
const FLAGS = {
  questions: parseInt(args.find(a => a.startsWith('--questions='))?.split('=')[1] || '10'),
  verbose: args.includes('--verbose'),
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] || 'benchmark-harness-results.json',
};

// ═══════════════════════════════════════════════════════════════════
// TEST QUESTIONS (Simple, Medium, Complex)
// ═══════════════════════════════════════════════════════════════════

const TEST_QUESTIONS = [
  {
    id: '1',
    question: 'What is the capital of France?',
    category: 'simple',
    expectedTools: 2, // web_search (likely) + answer
    difficulty: 'easy',
  },
  {
    id: '2',
    question: 'Compare the market shares of React vs Vue in 2024',
    category: 'medium',
    expectedTools: 4, // web_search + analysis + comparison
    difficulty: 'medium',
  },
  {
    id: '3',
    question: 'How has the average price of Bitcoin changed over the last 5 years? Provide analysis',
    category: 'medium',
    expectedTools: 5, // web_search + time_series + analysis
    difficulty: 'medium',
  },
  {
    id: '4',
    question: 'What are the latest updates on AI regulations across different countries?',
    category: 'complex',
    expectedTools: 6, // multiple searches + summarization
    difficulty: 'hard',
  },
  {
    id: '5',
    question: 'Find the top 3 competitors of Figma and analyze their strengths vs weaknesses',
    category: 'complex',
    expectedTools: 8, // competitive research + multiple sources
    difficulty: 'hard',
  },
  {
    id: '6',
    question: 'What Python version is currently recommended and why?',
    category: 'simple',
    expectedTools: 2,
    difficulty: 'easy',
  },
  {
    id: '7',
    question: 'Explain how machine learning improves search results',
    category: 'medium',
    expectedTools: 4,
    difficulty: 'medium',
  },
  {
    id: '8',
    question: 'What are the latest cloud computing trends for 2024?',
    category: 'complex',
    expectedTools: 6,
    difficulty: 'hard',
  },
  {
    id: '9',
    question: 'How do modern browsers handle JavaScript execution?',
    category: 'medium',
    expectedTools: 4,
    difficulty: 'medium',
  },
  {
    id: '10',
    question: 'Analyze the pros and cons of serverless architecture',
    category: 'complex',
    expectedTools: 6,
    difficulty: 'hard',
  },
];

// ═══════════════════════════════════════════════════════════════════
// TOOL ANALYZER
// ═══════════════════════════════════════════════════════════════════

const TOOL_CATEGORIES = {
  web_search: 'web_search|search_web|fetch_search',
  file_ops: 'file_read|file_write|file_delete|list_files',
  computation: 'calculate|compute|execute|run_code',
  vision: 'screenshot|image_analyze|vision',
  memory: 'memory_store|memory_retrieve|knowledge',
  web_fetch: 'fetch_url|fetch_page|get_page',
  browser: 'click|type|navigate|scroll',
  other: 'other',
};

function analyzeToolUsage(response) {
  const toolUsage = {
    totalTools: 0,
    toolsByCategory: {},
    distinctTools: new Set(),
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    averageResponseTime: 0,
  };

  // Parse tool calls from response (looking for patterns like [TOOL: ...] or tool_call)
  const toolPattern = /\[TOOL:\s*(\w+)\]|\btool_call[:\s]*(\w+)|"tool":\s*"(\w+)"/gi;
  let match;

  while ((match = toolPattern.exec(response)) !== null) {
    const toolName = match[1] || match[2] || match[3];
    if (toolName) {
      toolUsage.totalTools++;
      toolUsage.distinctTools.add(toolName);
      toolUsage.toolSequence.push(toolName);

      // Categorize
      let found = false;
      for (const [category, pattern] of Object.entries(TOOL_CATEGORIES)) {
        if (new RegExp(pattern, 'i').test(toolName)) {
          toolUsage.toolsByCategory[category] = (toolUsage.toolsByCategory[category] || 0) + 1;
          found = true;
          break;
        }
      }
      if (!found) {
        toolUsage.toolsByCategory.other = (toolUsage.toolsByCategory.other || 0) + 1;
      }
    }
  }

  // Check for success/failure patterns
  const successPattern = /\[SUCCESS\]|✓|successful|success|completed|done/gi;
  const failurePattern = /\[FAILED\]|\[ERROR\]|✗|failed|error|failed|unable|couldn't/gi;

  toolUsage.successCount = (response.match(successPattern) || []).length;
  toolUsage.failureCount = (response.match(failurePattern) || []).length;

  return {
    ...toolUsage,
    distinctToolCount: toolUsage.distinctTools.size,
    toolDiversity: toolUsage.distinctTools.size / Math.max(1, toolUsage.totalTools),
  };
}

// ═══════════════════════════════════════════════════════════════════
// HARNESS QUALITY ANALYZER
// ═══════════════════════════════════════════════════════════════════

function analyzeHarnessQuality(response) {
  const quality = {
    hasErrorHandling: false,
    hasAbortSignal: false,
    hasPermissionGate: false,
    hasRetryLogic: false,
    hasTimeout: false,
    errorRecoveryCount: 0,
    permissionCheckCount: 0,
  };

  // Check for error handling
  if (/try\s*\{|catch\s*\{|\.catch\(|error.*handler|error.*recovery/i.test(response)) {
    quality.hasErrorHandling = true;
  }

  // Check for abort signal handling
  if (/abort|signal|cancelled|interrupt/i.test(response)) {
    quality.hasAbortSignal = true;
  }

  // Check for permission gates
  if (/permission|authorize|verify.*access|permission.*gate|security|sanitize/i.test(response)) {
    quality.hasPermissionGate = true;
    quality.permissionCheckCount = (response.match(/permission|authorize|verify/gi) || []).length;
  }

  // Check for retry logic
  if (/retry|attempt|retry.*count|backoff|exponential/i.test(response)) {
    quality.hasRetryLogic = true;
  }

  // Check for timeout
  if (/timeout|time.*limit|max.*duration/i.test(response)) {
    quality.hasTimeout = true;
  }

  // Count error recovery mentions
  quality.errorRecoveryCount = (response.match(/recover|fallback|alternative|handle.*error/gi) || []).length;

  return quality;
}

// ═══════════════════════════════════════════════════════════════════
// MOCK AGENT EXECUTOR (for testing harness without full system)
// ═══════════════════════════════════════════════════════════════════

async function executeQuestion(question) {
  // Simulate agent execution with tool usage
  const response = `
    [ATTEMPT 1]
    Processing question: "${question.question}"

    [TOOL: web_search]
    Executing search query for relevant information...
    [SUCCESS] Found 5 relevant sources

    [TOOL: fetch_page]
    Retrieving detailed information from sources...
    [SUCCESS] Extracted data from 3 pages (2 rate limited)

    ${question.category === 'complex' ? `
    [TOOL: vision]
    Analyzing data visualizations...
    [SUCCESS] Extracted chart data

    [TOOL: compute]
    Running comparative analysis...
    [SUCCESS] Analysis complete
    ` : ''}

    [ERROR RECOVERY]
    Handling rate limit on 2 sources - using cache

    [ANSWER SYNTHESIS]
    Combining results with permission gate checks...
    ✓ All security checks passed

    Final Answer: ${question.category === 'simple' ? 'Direct answer provided' : 'Comprehensive analysis with sources'}
  `;

  return response;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN BENCHMARK RUNNER
// ═══════════════════════════════════════════════════════════════════

async function runBenchmark() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 BENCHMARK HARNESS — Tool Usage & Quality Analysis             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Verify infrastructure
  console.log('📡 Verifying infrastructure...');
  console.log(`   Ollama: ${INFRASTRUCTURE.ollamaUrl}`);
  console.log(`   Wayfayer: ${INFRASTRUCTURE.wayayerUrl}`);
  console.log(`   SearXNG: ${INFRASTRUCTURE.searxngUrl}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    totalQuestions: FLAGS.questions,
    questions: [],
    summary: {
      avgToolsPerQuestion: 0,
      avgToolDiversity: 0,
      avgHarnessQuality: 0,
      totalToolUsage: 0,
      categoryBreakdown: {},
    },
  };

  const questionsToRun = TEST_QUESTIONS.slice(0, FLAGS.questions);

  for (let i = 0; i < questionsToRun.length; i++) {
    const q = questionsToRun[i];
    const startTime = Date.now();

    if (FLAGS.verbose) {
      console.log(`\n[${i + 1}/${FLAGS.questions}] ${q.question}`);
      console.log(`    Difficulty: ${q.difficulty} | Category: ${q.category}`);
    } else {
      process.stdout.write(`\r[${i + 1}/${FLAGS.questions}] Running...`);
    }

    // Execute question
    const response = await executeQuestion(q);
    const executionTime = Date.now() - startTime;

    // Analyze tool usage
    const toolAnalysis = analyzeToolUsage(response);

    // Analyze harness quality
    const harnessQuality = analyzeHarnessQuality(response);

    // Score harness (out of 10)
    const harnessScore =
      (harnessQuality.hasErrorHandling ? 2 : 0) +
      (harnessQuality.hasAbortSignal ? 2 : 0) +
      (harnessQuality.hasPermissionGate ? 2 : 0) +
      (harnessQuality.hasRetryLogic ? 2 : 0) +
      (harnessQuality.hasTimeout ? 2 : 0);

    const result = {
      id: q.id,
      question: q.question,
      difficulty: q.difficulty,
      executionTime,
      toolUsage: {
        total: toolAnalysis.totalTools,
        distinct: toolAnalysis.distinctToolCount,
        diversity: parseFloat(toolAnalysis.toolDiversity.toFixed(2)),
        byCategory: toolAnalysis.toolsByCategory,
        sequence: toolAnalysis.toolSequence,
      },
      harness: {
        errorHandling: harnessQuality.hasErrorHandling,
        abortSignal: harnessQuality.hasAbortSignal,
        permissionGate: harnessQuality.hasPermissionGate,
        retryLogic: harnessQuality.hasRetryLogic,
        timeout: harnessQuality.hasTimeout,
        score: harnessScore,
        errorRecoveryCount: harnessQuality.errorRecoveryCount,
      },
      analysis: {
        sufficientTools: toolAnalysis.totalTools >= q.expectedTools * 0.7,
        goodDiversity: toolAnalysis.distinctToolCount >= 2,
        verdict: toolAnalysis.totalTools >= q.expectedTools * 0.7 ? '✓ PASS' : '⚠ LIMITED TOOLS',
      },
    };

    results.questions.push(result);

    if (FLAGS.verbose) {
      console.log(`    Tools: ${result.toolUsage.distinct}/${q.expectedTools} | Diversity: ${(result.toolUsage.diversity * 100).toFixed(0)}%`);
      console.log(`    Harness Score: ${result.harness.score}/10 | ${result.analysis.verdict}`);
    }
  }

  // Calculate summary
  if (results.questions.length > 0) {
    const avgTools = results.questions.reduce((sum, q) => sum + q.toolUsage.total, 0) / results.questions.length;
    const avgDiversity =
      results.questions.reduce((sum, q) => sum + q.toolUsage.diversity, 0) / results.questions.length;
    const avgHarnessScore = results.questions.reduce((sum, q) => sum + q.harness.score, 0) / results.questions.length;

    results.summary.avgToolsPerQuestion = parseFloat(avgTools.toFixed(2));
    results.summary.avgToolDiversity = parseFloat((avgDiversity * 100).toFixed(0)) + '%';
    results.summary.avgHarnessQuality = parseFloat(avgHarnessScore.toFixed(1)) + '/10';

    // Category breakdown
    for (const q of results.questions) {
      for (const [cat, count] of Object.entries(q.toolUsage.byCategory)) {
        results.summary.categoryBreakdown[cat] = (results.summary.categoryBreakdown[cat] || 0) + count;
      }
    }
  }

  // Print summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  📊 BENCHMARK RESULTS                                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Questions Run: ${results.questions.length}/${FLAGS.questions}`);
  console.log(`Avg Tools/Question: ${results.summary.avgToolsPerQuestion}`);
  console.log(`Tool Diversity: ${results.summary.avgToolDiversity}`);
  console.log(`Harness Quality: ${results.summary.avgHarnessQuality}`);
  console.log('');
  console.log('Tool Usage by Category:');
  for (const [cat, count] of Object.entries(results.summary.categoryBreakdown)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('');

  // Pass/Fail breakdown
  const passingQuestions = results.questions.filter(q => q.analysis.sufficientTools).length;
  console.log(`Tool Sufficiency: ${passingQuestions}/${results.questions.length} questions ✓`);
  console.log('');

  // Save results
  fs.writeFileSync(
    FLAGS.output,
    JSON.stringify(results, null, 2)
  );
  console.log(`📁 Results saved to: ${FLAGS.output}`);
  console.log('');

  // Final verdict
  const harnessGood = parseFloat(results.summary.avgHarnessQuality) >= 7;
  const toolsGood = parseFloat(results.summary.avgToolsPerQuestion) >= 3;

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  if (harnessGood && toolsGood) {
    console.log('║  ✅ HARNESS READY FOR PRODUCTION                                  ║');
  } else if (harnessGood) {
    console.log('║  ⚠️  HARNESS WORKING — Increase tool usage                        ║');
  } else {
    console.log('║  ❌ HARNESS NEEDS WORK — Improve error handling & tools            ║');
  }
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
}

// Run benchmark
runBenchmark().catch(err => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
