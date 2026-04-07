#!/usr/bin/env node
/**
 * HARNESS OPTIMIZER AGENT
 * Meta-Harness meets AutoResearch: optimize the research harness itself
 * 
 * Loop:
 * 1. Test harness on 3 questions
 * 2. Analyze results (tools used, coverage, quality)
 * 3. Identify improvements
 * 4. Modify harness parameters
 * 5. Re-test same 3 questions
 * 6. If better: advance to next 3 questions
 * 7. Every 3 questions: deep analysis + optimization
 */

const WAYFARER_URL = 'http://localhost:8889';

// ============================================================================
// HARNESS CONFIGURATION (THE THING WE OPTIMIZE)
// ============================================================================

let HARNESS = {
  version: 1,
  complexity: {
    wordCountBonus: 1.5,
    regionBonus: 3.5,
    temporalBonus: 2.0,
    dataTypeBonus: 1.2,
  },
  searchAllocation: {
    // Maps complexity score to search count
    1: 10, 2: 25, 3: 50, 4: 100, 5: 200, 6: 350, 7: 500, 8: 750, 9: 1000, 10: 1500
  },
  batchSize: 50,
  maxBatches: 3,
  analysisDensity: 'moderate', // light, moderate, aggressive
};

// ============================================================================
// BENCHMARK QUESTIONS
// ============================================================================

const BENCHMARK_QUESTIONS = [
  {
    id: 'bio-1',
    q: "What are the primary sources of dietary fiber and their impacts on human gut health?",
    category: 'biology',
  },
  {
    id: 'geo-1', 
    q: "Analyze the geopolitical implications of the BRICS expansion in 2024. Compare economic and political motivations.",
    category: 'geopolitics',
  },
  {
    id: 'ml-1',
    q: "How have machine learning techniques revolutionized drug discovery? Discuss algorithms, limitations, and future prospects.",
    category: 'science',
  },
  {
    id: 'fin-1',
    q: "What are the economic impacts of AI on labor markets? Analyze displacement, new opportunities, and policy responses.",
    category: 'economics',
  },
  {
    id: 'cli-1',
    q: "How effective are current climate change mitigation strategies? Compare carbon pricing, regulations, and technological solutions.",
    category: 'climate',
  },
  {
    id: 'health-1',
    q: "What is the current state of mRNA vaccine technology beyond COVID? Discuss clinical trials, challenges, and future applications.",
    category: 'medicine',
  },
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

  if (q.match(/2024|emerging|future|outlook|current|latest/i)) score += HARNESS.complexity.temporalBonus;
  if (q.match(/why|how|mechanism|dynamics|implication|impact|effectiveness/i)) score += 1.5;

  const dataTypes =
    (q.match(/economic|political|market/i) ? HARNESS.complexity.dataTypeBonus : 0) +
    (q.match(/mechanisms|algorithms|techniques|technology/i) ? HARNESS.complexity.dataTypeBonus : 0) +
    (q.match(/compare|different|contrast|vs/i) ? HARNESS.complexity.dataTypeBonus : 0) +
    (q.match(/case|evidence|benefits|impacts|challenges|limitations|solutions/i) ? HARNESS.complexity.dataTypeBonus : 0);

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
  const numBatches = Math.min(
    Math.ceil(searchCount / batchSize),
    HARNESS.maxBatches
  );
  return numBatches;
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

  return {
    totalPages,
    totalChars,
    uniqueSources: totalSources.size,
    elapsed,
    queries: queries.length,
  };
}

function generateQueries(q, count) {
  const base = q.split(/[?!]/)[0].trim();
  const queries = [];
  const variants = [
    base,
    `${base} research`,
    `${base} analysis`,
    `${base} trends`,
    `${base} 2024`,
    `${base} recent developments`,
    `${base} expert analysis`,
    `${base} case studies`,
  ];

  for (let i = 0; i < count; i++) {
    queries.push(variants[i % variants.length]);
  }
  return queries;
}

async function testQuestion(q) {
  const score = analyzeComplexity(q.q);
  const searchCount = getSearchCount(score);
  const numBatches = decideBatches(searchCount);

  const result = {
    id: q.id,
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
  }

  return result;
}

async function testHarness(questions, testRun = 1) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`HARNESS TEST RUN #${testRun}`);
  console.log(`${'═'.repeat(70)}\n`);

  const results = [];
  for (const q of questions) {
    console.log(`Testing [${q.id}] ${q.category.padEnd(12)} ...`);
    const result = await testQuestion(q);
    results.push(result);
    console.log(`  Complexity: ${result.complexity}/10 | Searches: ${result.searchCount} | Pages: ${result.totalPages} | Sources: ${result.uniqueSources} | Time: ${Math.round(result.totalTime / 1000)}s`);
  }

  return results;
}

function analyzeResults(results, previousResults = null) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`ANALYSIS`);
  console.log(`${'─'.repeat(70)}\n`);

  const avgPages = (results.reduce((s, r) => s + r.totalPages, 0) / results.length).toFixed(1);
  const avgSources = (results.reduce((s, r) => s + r.uniqueSources, 0) / results.length).toFixed(1);
  const totalTime = results.reduce((s, r) => s + r.totalTime, 0);

  console.log(`📊 Metrics:`);
  console.log(`  Avg pages/question: ${avgPages}`);
  console.log(`  Avg sources/question: ${avgSources}`);
  console.log(`  Total time: ${Math.round(totalTime / 1000)}s`);

  if (previousResults) {
    const prevAvgPages = (previousResults.reduce((s, r) => s + r.totalPages, 0) / previousResults.length).toFixed(1);
    const improvement = ((avgPages - prevAvgPages) / prevAvgPages * 100).toFixed(1);
    console.log(`  📈 Improvement: ${improvement}% more pages`);
  }

  const issuesFound = [];
  if (avgPages < 5) issuesFound.push('Low page count — increase batch size or searches');
  if (avgSources < 3) issuesFound.push('Low source diversity — improve query generation');

  if (issuesFound.length > 0) {
    console.log(`\n⚠ Issues found:`);
    issuesFound.forEach(i => console.log(`  • ${i}`));
  }

  return { avgPages, avgSources, totalTime };
}

function optimizeHarness(results) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`HARNESS OPTIMIZATION`);
  console.log(`${'─'.repeat(70)}\n`);

  const oldVersion = HARNESS.version;

  // Optimization 1: If low coverage, increase search counts
  const avgPages = results.reduce((s, r) => s + r.totalPages, 0) / results.length;
  if (avgPages < 5) {
    console.log(`📈 Increasing search allocation (avg ${avgPages.toFixed(1)} pages)`);
    for (let i = 1; i <= 10; i++) {
      HARNESS.searchAllocation[i] = Math.ceil(HARNESS.searchAllocation[i] * 1.3);
    }
  }

  // Optimization 2: If taking too long, reduce batch iterations
  const totalTime = results.reduce((s, r) => s + r.totalTime, 0);
  if (totalTime > 120000) {
    console.log(`⏱ Reducing max batches (${totalTime}ms total)`);
    HARNESS.maxBatches = Math.max(1, HARNESS.maxBatches - 1);
  }

  // Optimization 3: Adjust complexity multipliers
  if (avgPages > 10) {
    console.log(`✨ Pages are good, tweaking multipliers for precision`);
    HARNESS.complexity.dataTypeBonus *= 1.05;
  }

  HARNESS.version = oldVersion + 1;
  console.log(`\n✅ Harness v${oldVersion} → v${HARNESS.version}`);
  console.log(`Current config:`, JSON.stringify(HARNESS, null, 2).split('\n').slice(0, 10).join('\n'));
}

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   HARNESS OPTIMIZER AGENT — Meta-Harness AutoResearch      ║`);
  console.log(`║   Autonomously optimize the research harness               ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  // Test on first 3 questions
  const batch1 = BENCHMARK_QUESTIONS.slice(0, 3);
  const results1 = await testHarness(batch1, 1);
  analyzeResults(results1);
  optimizeHarness(results1);

  // Re-test same 3 with optimized harness
  const results2 = await testHarness(batch1, 2);
  analyzeResults(results2, results1);

  // Decision: if better, advance to next batch
  const improvement = (results2[0].totalPages > results1[0].totalPages);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`DECISION`);
  console.log(`${'═'.repeat(70)}`);
  console.log(improvement ? `✅ Improved — advancing to next batch` : `⚠ No improvement — trying different optimization`);

  if (improvement) {
    const batch2 = BENCHMARK_QUESTIONS.slice(3, 6);
    const results3 = await testHarness(batch2, 3);
    analyzeResults(results3);
  }

  console.log(`\n✅ Harness optimization loop complete`);
}

main().catch(console.error);
