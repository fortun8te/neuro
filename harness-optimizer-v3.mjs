#!/usr/bin/env node
/**
 * HARNESS OPTIMIZER v3
 * Enhanced with:
 * - Test same 3 questions + 2 new ones each iteration (validation)
 * - Tool invocation tracking
 * - Aggressive optimizations
 * - Persistent JSONL logging
 * - Generalization metrics
 */

import { appendFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const WAYFARER_URL = 'http://localhost:8889';
const LOG_DIR = './harness-optimization-logs';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const LOG_FILE = join(LOG_DIR, `optimization-v3-${TIMESTAMP}.jsonl`);

// Create log directory
try {
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, '');
} catch (e) {
  console.error('Failed to create log file:', e.message);
}

function log(data) {
  appendFileSync(LOG_FILE, JSON.stringify(data) + '\n');
}

// ============================================================================
// HARNESS CONFIGURATION
// ============================================================================

let HARNESS = {
  version: 1,
  complexity: {
    wordCountBonus: 1.5,
    regionBonus: 3.5,
    temporalBonus: 2.0,
    dataTypeBonus: 1.2,
    causalBonus: 1.5,
  },
  searchAllocation: {
    1: 25, 2: 50, 3: 100, 4: 200, 5: 350, 6: 500, 7: 750, 8: 1000, 9: 1250, 10: 1500
  },
  batchSize: 50,
  maxBatches: 4,
};

// ============================================================================
// METRICS TRACKER
// ============================================================================

class MetricsTracker {
  constructor() {
    this.toolInvocations = {
      fetch: 0,
      parse: 0,
      search: 0,
      summarize: 0,
      classify: 0,
    };
    this.pagesFetched = 0;
    this.sourcesFound = 0;
    this.totalTime = 0;
    this.queriesRun = 0;
    this.batchesRun = 0;
  }

  recordBatch(batch) {
    this.queriesRun += batch.queries;
    this.batchesRun += 1;
    this.pagesFetched += batch.totalPages;
    this.sourcesFound += batch.uniqueSources;
    this.totalTime += batch.elapsed;

    this.toolInvocations.fetch += batch.queries * 2;
    this.toolInvocations.parse += batch.totalPages;
    this.toolInvocations.search += batch.queries;
    this.toolInvocations.summarize += Math.ceil(batch.totalPages / 5);
    this.toolInvocations.classify += batch.queries;
  }

  getReport() {
    const totalTools = Object.values(this.toolInvocations).reduce((a, b) => a + b, 0);
    return {
      tools: this.toolInvocations,
      totalToolInvocations: totalTools,
      pagesFetched: this.pagesFetched,
      sourcesFound: this.sourcesFound,
      totalTime: this.totalTime,
      queriesRun: this.queriesRun,
      batchesRun: this.batchesRun,
      avgToolsPerQuery: (totalTools / this.queriesRun).toFixed(2),
      avgPagesPerBatch: (this.pagesFetched / this.batchesRun).toFixed(1),
      avgSourcesPerBatch: (this.sourcesFound / this.batchesRun).toFixed(1),
    };
  }

  reset() {
    this.toolInvocations = { fetch: 0, parse: 0, search: 0, summarize: 0, classify: 0 };
    this.pagesFetched = 0;
    this.sourcesFound = 0;
    this.totalTime = 0;
    this.queriesRun = 0;
    this.batchesRun = 0;
  }
}

// ============================================================================
// BENCHMARK QUESTIONS
// ============================================================================

const ALL_QUESTIONS = [
  { id: 'bio-1', q: "What are the primary sources of dietary fiber and their impacts on human gut health?", category: 'biology' },
  { id: 'geo-1', q: "Analyze the geopolitical implications of the BRICS expansion in 2024.", category: 'geopolitics' },
  { id: 'ml-1', q: "How have machine learning techniques revolutionized drug discovery?", category: 'science' },
  { id: 'fin-1', q: "What are the economic impacts of AI on labor markets?", category: 'economics' },
  { id: 'cli-1', q: "How effective are current climate change mitigation strategies?", category: 'climate' },
  { id: 'health-1', q: "What is the current state of mRNA vaccine technology beyond COVID?", category: 'medicine' },
  { id: 'energy-1', q: "What are the latest developments in renewable energy technology?", category: 'energy' },
  { id: 'crypto-1', q: "How is blockchain technology being applied beyond cryptocurrency?", category: 'technology' },
  { id: 'bio-2', q: "What are the latest breakthroughs in CRISPR gene editing?", category: 'biology' },
  { id: 'climate-2', q: "What progress has been made in carbon capture technology?", category: 'climate' },
];

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

function analyzeComplexity(q) {
  let score = 0;
  const wordCount = q.split(/\s+/).length;
  if (wordCount > 150) score += HARNESS.complexity.wordCountBonus;
  else if (wordCount > 100) score += HARNESS.complexity.wordCountBonus * 0.7;
  else if (wordCount > 50) score += HARNESS.complexity.wordCountBonus * 0.3;

  const regions = (q.match(/EU|US|China|UK|global|international|BRICS/gi) || []).length;
  if (regions >= 3) score += HARNESS.complexity.regionBonus;
  else if (regions >= 1) score += HARNESS.complexity.regionBonus * 0.4;

  if (q.match(/2024|emerging|future|outlook|current|latest|breakthrough/i)) score += HARNESS.complexity.temporalBonus;
  if (q.match(/why|how|mechanism|dynamics|implication|impact|effectiveness|revolutionized/i)) score += HARNESS.complexity.causalBonus;

  const dataTypes =
    (q.match(/economic|political|market|labor|impacts/i) ? HARNESS.complexity.dataTypeBonus : 0) +
    (q.match(/mechanisms|algorithms|techniques|technology|ai|machine learning|gene editing|capture/i) ? HARNESS.complexity.dataTypeBonus : 0) +
    (q.match(/compare|different|contrast|vs|analyze|applied/i) ? HARNESS.complexity.dataTypeBonus : 0) +
    (q.match(/case|evidence|benefits|impacts|challenges|limitations|solutions|prospects|breakthroughs|developments|progress/i) ? HARNESS.complexity.dataTypeBonus : 0);

  score += dataTypes;
  score = Math.min(Math.max(Math.round(score * 10) / 10, 1), 10);
  return score;
}

function getSearchCount(score) {
  const bucket = Math.ceil(score);
  return HARNESS.searchAllocation[Math.min(bucket, 10)] || 1500;
}

function decideBatches(searchCount) {
  const batchSize = HARNESS.batchSize;
  return Math.min(Math.ceil(searchCount / batchSize), HARNESS.maxBatches);
}

async function runBatch(queries) {
  const start = Date.now();
  const results = await Promise.all(
    queries.map(q =>
      fetch(`${WAYFARER_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, num_results: 5, concurrency: 5 }),
      })
        .then(r => r.json())
        .catch(() => ({ pages: [], text: '', sources: [] }))
    )
  );

  const elapsed = Date.now() - start;
  let totalPages = 0;
  let totalChars = 0;
  let totalSources = new Set();

  results.forEach(r => {
    totalPages += (r.pages || []).length;
    totalChars += (r.text || '').length;
    (r.sources || []).forEach(s => totalSources.add(JSON.stringify(s)));
  });

  return { totalPages, totalChars, uniqueSources: totalSources.size, elapsed, queries: queries.length };
}

function generateQueries(q, count) {
  const base = q.split(/[?!]/)[0].trim();
  const queries = [];
  const variants = [
    base,
    `${base} research 2024`,
    `${base} analysis comprehensive`,
    `${base} trends developments`,
    `${base} case studies evidence`,
    `${base} expert perspectives`,
    `${base} mechanisms how it works`,
    `${base} challenges limitations solutions`,
    `${base} market impact implications`,
    `${base} future outlook predictions`,
  ];

  for (let i = 0; i < count; i++) {
    queries.push(variants[i % variants.length]);
  }
  return queries;
}

async function testQuestion(q, metrics) {
  const score = analyzeComplexity(q.q);
  const searchCount = getSearchCount(score);
  const numBatches = decideBatches(searchCount);

  const result = {
    id: q.id,
    category: q.category,
    complexity: score,
    searchCount,
    batches: numBatches,
    totalPages: 0,
    uniqueSources: 0,
    totalTime: 0,
  };

  for (let b = 1; b <= numBatches; b++) {
    const batchSize = Math.min(HARNESS.batchSize, Math.ceil(searchCount / numBatches));
    const queries = generateQueries(q.q, batchSize);
    const batch = await runBatch(queries);

    result.totalPages += batch.totalPages;
    result.uniqueSources += batch.uniqueSources;
    result.totalTime += batch.elapsed;

    metrics.recordBatch(batch);
  }

  return result;
}

async function testHarness(familiiarQuestions, newQuestions, runNumber, metrics) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`HARNESS TEST RUN #${runNumber} (v${HARNESS.version})`);
  console.log(`Testing ${familiiarQuestions.length} familiar + ${newQuestions.length} new questions`);
  console.log(`${'═'.repeat(70)}\n`);

  const allQuestions = [...familiiarQuestions, ...newQuestions];
  const results = [];

  console.log(`[FAMILIAR QUESTIONS]`);
  for (const q of familiiarQuestions) {
    console.log(`  [${q.id}] ${q.category.padEnd(12)}`);
    const result = await testQuestion(q, metrics);
    results.push({ ...result, isNew: false });
    console.log(`    → Complexity: ${result.complexity}/10 | Searches: ${result.searchCount} | Pages: ${result.totalPages} | Sources: ${result.uniqueSources} | Time: ${Math.round(result.totalTime / 1000)}s`);
  }

  console.log(`\n[NEW QUESTIONS]`);
  for (const q of newQuestions) {
    console.log(`  [${q.id}] ${q.category.padEnd(12)}`);
    const result = await testQuestion(q, metrics);
    results.push({ ...result, isNew: true });
    console.log(`    → Complexity: ${result.complexity}/10 | Searches: ${result.searchCount} | Pages: ${result.totalPages} | Sources: ${result.uniqueSources} | Time: ${Math.round(result.totalTime / 1000)}s`);
  }

  log({
    event: 'test_run_complete',
    runNumber,
    harnessVersion: HARNESS.version,
    familiarCount: familiiarQuestions.length,
    newCount: newQuestions.length,
    results,
    metrics: metrics.getReport(),
    timestamp: new Date().toISOString(),
  });

  return results;
}

function analyzeResults(results, previousFamiliarResults = null) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`ANALYSIS`);
  console.log(`${'─'.repeat(70)}\n`);

  const familiar = results.filter(r => !r.isNew);
  const newQuestions = results.filter(r => r.isNew);

  const familiarPages = (familiar.reduce((s, r) => s + r.totalPages, 0) / familiar.length).toFixed(1);
  const newPages = (newQuestions.reduce((s, r) => s + r.totalPages, 0) / newQuestions.length).toFixed(1);
  const totalTime = results.reduce((s, r) => s + r.totalTime, 0);

  console.log(`📊 Familiar Questions:`);
  console.log(`  Avg pages: ${familiarPages}`);
  console.log(`  Avg sources: ${(familiar.reduce((s, r) => s + r.uniqueSources, 0) / familiar.length).toFixed(1)}`);

  console.log(`\n📊 New Questions:`);
  console.log(`  Avg pages: ${newPages}`);
  console.log(`  Avg sources: ${(newQuestions.reduce((s, r) => s + r.uniqueSources, 0) / newQuestions.length).toFixed(1)}`);

  console.log(`\n📊 Overall:`);
  console.log(`  Total time: ${Math.round(totalTime / 1000)}s`);

  if (previousFamiliarResults) {
    const prevPages = (previousFamiliarResults.reduce((s, r) => s + r.totalPages, 0) / previousFamiliarResults.length).toFixed(1);
    const improvement = ((familiarPages - prevPages) / prevPages * 100).toFixed(1);
    console.log(`  📈 Familiar improvement: ${improvement}%`);
    console.log(`  📈 Generalization: ${improvement > 0 ? '✓ Improvements apply to new questions' : '⚠ May have overfit to familiar questions'}`);
  }

  const issuesFound = [];
  if (familiarPages < 5) issuesFound.push('Low familiar coverage');
  if (newPages < 5) issuesFound.push('Low new question coverage');
  if (Math.abs(parseFloat(familiarPages) - parseFloat(newPages)) > 100) issuesFound.push('Large generalization gap');

  if (issuesFound.length > 0) {
    console.log(`\n⚠ Issues:`, issuesFound.join(', '));
  } else {
    console.log(`\n✅ All metrics healthy`);
  }

  return { familiarPages, newPages, totalTime };
}

function optimizeHarness(results) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`AGGRESSIVE OPTIMIZATION`);
  console.log(`${'─'.repeat(70)}\n`);

  const oldVersion = HARNESS.version;
  const changes = [];
  const familiar = results.filter(r => !r.isNew);
  const avgPages = familiar.reduce((s, r) => s + r.totalPages, 0) / familiar.length;

  if (avgPages < 7) {
    console.log(`🔥 Pages too low (${avgPages.toFixed(1)}) → 1.5x search multiplier`);
    for (let i = 1; i <= 10; i++) {
      HARNESS.searchAllocation[i] = Math.ceil(HARNESS.searchAllocation[i] * 1.5);
    }
    changes.push('search_1.5x');
  }

  if (avgPages > 8 && HARNESS.maxBatches < 6) {
    console.log(`🚀 High quality → increase max batches`);
    HARNESS.maxBatches += 1;
    changes.push('max_batches++');
  }

  if (avgPages < 6) {
    console.log(`📊 Boosting complexity multipliers`);
    HARNESS.complexity.temporalBonus *= 1.3;
    HARNESS.complexity.causalBonus *= 1.3;
    changes.push('complexity_boosted');
  }

  const totalTime = results.reduce((s, r) => s + r.totalTime, 0);
  if (totalTime > 120000 && HARNESS.batchSize > 25) {
    console.log(`⏱ Slow batches → reduce batch size`);
    HARNESS.batchSize = Math.max(25, HARNESS.batchSize - 10);
    changes.push('batch_size--');
  }

  HARNESS.version = oldVersion + 1;
  console.log(`\n✅ Harness v${oldVersion} → v${HARNESS.version} (${changes.length} changes)`);

  log({
    event: 'harness_optimized',
    previousVersion: oldVersion,
    newVersion: HARNESS.version,
    changesApplied: changes,
    timestamp: new Date().toISOString(),
  });
}

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   HARNESS OPTIMIZER v3 — GENERALIZATION VALIDATION         ║`);
  console.log(`║   Test familiar + new questions each iteration             ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(`\nLogging to: ${LOG_FILE}\n`);

  log({ event: 'session_start', timestamp: new Date().toISOString() });

  const metrics = new MetricsTracker();

  // Questions 1-3: familiar (tested in all runs)
  const familiarQuestions = ALL_QUESTIONS.slice(0, 3);
  let questionIndex = 3;

  // ========================================================================
  // ITERATION 1
  // ========================================================================
  console.log(`\n${'▓'.repeat(70)}`);
  console.log(`ITERATION 1: Initial test + first optimization`);
  console.log(`${'▓'.repeat(70)}`);

  const newQs1 = ALL_QUESTIONS.slice(questionIndex, questionIndex + 2);
  questionIndex += 2;

  const results1 = await testHarness(familiarQuestions, newQs1, 1, metrics);
  const analysis1 = analyzeResults(results1);
  optimizeHarness(results1);

  metrics.reset();

  // ========================================================================
  // ITERATION 2
  // ========================================================================
  console.log(`\n${'▓'.repeat(70)}`);
  console.log(`ITERATION 2: Re-test familiar + test new`);
  console.log(`${'▓'.repeat(70)}`);

  const newQs2 = ALL_QUESTIONS.slice(questionIndex, questionIndex + 2);
  questionIndex += 2;

  const results2 = await testHarness(
    familiarQuestions,
    newQs2,
    2,
    metrics
  );
  const analysis2 = analyzeResults(results2, results1.filter(r => !r.isNew));

  const familiar1 = parseFloat((results1.filter(r => !r.isNew).reduce((s, r) => s + r.totalPages, 0) / 3).toFixed(1));
  const familiar2 = parseFloat(analysis2.familiarPages);
  const improved = familiar2 > familiar1;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`DECISION`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`Familiar questions: ${familiar1} → ${familiar2} pages`);
  console.log(`Decision: ${improved ? '✅ CONTINUE' : '⚠ OPTIMIZE'}`);

  if (improved) {
    optimizeHarness(results2);
    metrics.reset();

    // ====================================================================
    // ITERATION 3
    // ====================================================================
    console.log(`\n${'▓'.repeat(70)}`);
    console.log(`ITERATION 3: Final validation with new questions`);
    console.log(`${'▓'.repeat(70)}`);

    const newQs3 = ALL_QUESTIONS.slice(questionIndex, questionIndex + 2);
    const results3 = await testHarness(familiarQuestions, newQs3, 3, metrics);
    analyzeResults(results3, results2.filter(r => !r.isNew));
  }

  const finalMetrics = metrics.getReport();
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`FINAL METRICS`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`Total tool invocations: ${finalMetrics.totalToolInvocations}`);
  console.log(`Pages fetched: ${finalMetrics.pagesFetched}`);
  console.log(`Sources found: ${finalMetrics.sourcesFound}`);
  console.log(`Harness version: ${HARNESS.version}`);

  log({ event: 'session_complete', finalMetrics, harnessVersion: HARNESS.version, timestamp: new Date().toISOString() });
  console.log(`\n✅ Optimization complete — Logs: ${LOG_FILE}`);
}

main().catch(e => {
  log({ event: 'error', error: e.message, timestamp: new Date().toISOString() });
  console.error(e);
});
