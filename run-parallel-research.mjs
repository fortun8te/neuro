#!/usr/bin/env node
const WAYFARER_URL = 'http://localhost:8889';
const questions = [
  {
    id: 1,
    category: 'biology',
    q: "What are the primary sources of dietary fiber and their impacts on human gut health?",
  },
  {
    id: 2,
    category: 'geopolitics',
    q: "Analyze the geopolitical implications of the BRICS expansion in 2024. Compare the economic and political motivations of each member state.",
  },
  {
    id: 3,
    category: 'science',
    q: "How have machine learning techniques revolutionized drug discovery? Discuss algorithms, limitations, and future prospects.",
  },
];

async function analyzeQuestion(q) {
  let score = 0;
  const factors = [];

  const wordCount = q.q.split(/\s+/).length;
  if (wordCount > 150) score += 3;
  else if (wordCount > 100) score += 2.5;

  const regions = (q.q.match(/EU|US|China|UK|global|international|BRICS/gi) || []).length;
  if (regions >= 3) {
    score += 3.5;
    factors.push(`${regions} regions`);
  } else if (regions >= 1) score += 1.5;

  if (q.q.match(/2024|emerging|future|outlook/i)) score += 2;
  if (q.q.match(/compare|analyze|assess|discuss/i)) score += 1.5;

  const dataTypes = 
    (q.q.match(/economic|political|market/i) ? 1.2 : 0) +
    (q.q.match(/mechanisms|algorithms|techniques/i) ? 1.2 : 0) +
    (q.q.match(/compare|different/i) ? 1.2 : 0) +
    (q.q.match(/case|evidence|benefits/i) ? 1.2 : 0);

  score += dataTypes;
  if (dataTypes > 0) factors.push(`${dataTypes.toFixed(1)} data types`);

  score = Math.min(Math.max(score, 1), 10);
  score = Math.round(score * 10) / 10;

  let searches;
  if (score <= 2) searches = 3;
  else if (score <= 3) searches = 5;
  else if (score <= 4) searches = 8;
  else if (score <= 5) searches = 12;
  else if (score <= 6) searches = 18;
  else if (score <= 7) searches = 25;
  else if (score <= 8) searches = 35;
  else if (score <= 9) searches = 45;
  else searches = 60;

  let tier1, tier2, tier3;
  if (searches <= 25) {
    tier1 = Math.ceil(searches * 0.4);
    tier2 = searches - tier1;
    tier3 = 0;
  } else {
    tier1 = Math.ceil(searches * 0.3);
    tier2 = Math.ceil(searches * 0.45);
    tier3 = searches - tier1 - tier2;
  }

  return { score, searches, tier1, tier2, tier3, factors: factors.join(', ') };
}

async function searchParallel(queries, limit = 3) {
  const toRun = queries.slice(0, limit);
  const start = Date.now();
  
  const results = await Promise.all(
    toRun.map(q => 
      fetch(`${WAYFARER_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          num_results: 5,
          concurrency: 10,
        }),
      })
        .then(r => r.json())
        .catch(e => ({ error: e.message, query: q }))
    )
  );
  
  const elapsed = Date.now() - start;
  return { results, elapsed };
}

async function runResearch(q) {
  console.log(`\n[Q${q.id}] ${q.category.toUpperCase()}`);
  console.log(`Question: "${q.q.substring(0, 70)}..."`);

  const analysis = await analyzeQuestion(q);
  console.log(`\nComplexity: ${analysis.score}/10`);
  console.log(`Research Depth: ${analysis.searches} searches`);
  console.log(`  ├─ Tier 1: ${analysis.tier1}`);
  console.log(`  ├─ Tier 2: ${analysis.tier2}`);
  console.log(`  └─ Tier 3: ${analysis.tier3}`);

  const topic = q.q.split(/[?!]/)[0].trim();
  const queries = [
    `${topic} 2024 2025`,
    `${topic} research analysis`,
    `${topic} latest trends`,
  ];

  console.log(`\nRunning ${queries.length} searches IN PARALLEL...`);
  const start = Date.now();
  
  const { results, elapsed } = await searchParallel(queries, queries.length);
  
  let totalPages = 0;
  let totalChars = 0;
  let allSources = [];
  let errors = 0;

  results.forEach((data, i) => {
    if (data.error) {
      console.log(`  ✗ Query ${i + 1}: ${data.error}`);
      errors++;
      return;
    }
    const pageCount = (data.pages || []).length;
    const charCount = (data.text || '').length;
    totalPages += pageCount;
    totalChars += charCount;
    allSources.push(...(data.sources || []));
    console.log(`  ✓ Query ${i + 1}: ${pageCount} pages, ~${Math.round(charCount / 1024)}KB`);
  });

  const uniqueSources = new Set(allSources.map(s => typeof s === 'string' ? s : JSON.stringify(s))).size;

  console.log(`\nResults: ${totalPages} pages, ${uniqueSources} sources, ~${Math.round(totalChars / 1024)}KB`);
  console.log(`Time: ${elapsed}ms (${queries.length} parallel queries)`);
  if (errors > 0) console.log(`⚠ ${errors} failed`);

  console.log(`${'─'.repeat(70)}`);
  return { analysis, totalPages, totalChars, uniqueSources, elapsed };
}

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║    LIVEBENCH PARALLEL ADAPTIVE RESEARCH                   ║`);
  console.log(`║         Multiple Searches Run Concurrently                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const start = Date.now();
  const results = [];
  
  for (const q of questions) {
    const result = await runResearch(q);
    results.push(result);
  }

  const totalTime = Date.now() - start;

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    SUMMARY                                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  const avgComplexity = (results.reduce((s, r) => s + r.analysis.score, 0) / results.length).toFixed(1);
  const avgSearches = Math.round(results.reduce((s, r) => s + r.analysis.searches, 0) / results.length);
  const totalPages = results.reduce((s, r) => s + r.totalPages, 0);
  const totalSources = results.reduce((s, r) => s + r.uniqueSources, 0);
  const totalChars = results.reduce((s, r) => s + r.totalChars, 0);
  const totalSearchTime = results.reduce((s, r) => s + r.elapsed, 0);

  console.log(`Average Complexity: ${avgComplexity}/10`);
  console.log(`Average Searches: ${avgSearches} per question`);
  console.log(`Total Pages: ${totalPages}`);
  console.log(`Total Sources: ${totalSources}`);
  console.log(`Total Data: ~${Math.round(totalChars / 1024)}KB\n`);
  
  console.log(`TIMING:`);
  console.log(`  Per-question search time: ${Math.round(totalSearchTime / results.length)}ms avg`);
  console.log(`  Total execution time: ${totalTime}ms`);
  console.log(`  (${results.length} questions × 3 parallel searches per question)\n`);
  
  console.log(`✅ Parallel adaptive research complete`);
}

main().catch(console.error);
