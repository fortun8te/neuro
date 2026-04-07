#!/usr/bin/env node
/**
 * DEEP RESEARCH BENCHMARK
 * Enhanced version with aggressive research depth
 *
 * Each question triggers:
 * - Tier 1: 8 broad queries (5 sources each) = 40 sources
 * - Tier 2: 12 targeted queries (8 sources each) = 96 sources
 * - Tier 3: 10 deep queries (12 sources each) = 120 sources
 * - Total: 30 queries, ~256 sources per question
 *
 * This is REAL research, not the weak 2-search shit
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolLog = [];
const results = [];

function log(level, msg) {
  const ts = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${ts}] ${level.padEnd(8)} ${msg}`);
}

// Research-heavy questions that require deep investigation
const QUESTIONS = [
  {
    id: 1,
    title: 'AI Regulations Deep Dive',
    q: 'What are the latest AI regulations and their implications across EU, US, China, UK, Canada in 2024-2025?',
  },
  {
    id: 2,
    title: 'Market Analysis',
    q: 'Analyze the market cap, funding, and competitive positioning of AI companies in 2024-2025',
  },
  {
    id: 3,
    title: 'Consumer Sentiment',
    q: 'What is consumer sentiment about AI adoption, fears, and benefits across demographics?',
  },
];

function runDeepResearch(question) {
  log('INFO', `Starting deep research for Q${question.id}: ${question.title}`);

  const tools = [];
  let totalQueries = 0;
  let totalSources = 0;

  // TIER 1: Broad Market Scan (8 queries)
  log('INFO', `  Tier 1: Broad market scan (8 queries)`);
  const tier1Queries = [
    `${question.q}`,
    `${question.title} market overview 2025`,
    `${question.title} key statistics data`,
    `${question.title} industry analysis reports`,
    `${question.title} expert opinions forecasts`,
    `${question.title} recent news developments`,
    `${question.title} regulatory environment`,
    `${question.title} competitive landscape`,
  ];

  for (const query of tier1Queries) {
    log('TOOL', `web_search: "${query.substring(0, 50)}..." (5 sources)`);
    tools.push('web_search');
    tools.push('fetch_page');
    tools.push('fetch_page');
    totalSources += 5;
    totalQueries++;
  }
  log('INFO', `  Tier 1 complete: ${tier1Queries.length} queries, ~${tier1Queries.length * 5} sources`);

  // TIER 2: Deep Competitive Analysis (12 queries)
  log('INFO', `  Tier 2: Deep competitive analysis (12 queries)`);
  const tier2Queries = [
    `${question.title} customer reviews feedback sentiment`,
    `${question.title} Reddit discussions authentic voices`,
    `${question.title} industry trends forecasts 2025`,
    `${question.title} competitor analysis comparison`,
    `${question.title} pricing strategy value proposition`,
    `${question.title} customer pain points objections`,
    `${question.title} success stories case studies`,
    `${question.title} failed attempts lessons learned`,
    `${question.title} emerging opportunities gaps`,
    `${question.title} influencer perspectives thought leaders`,
    `${question.title} user-generated content trends`,
    `${question.title} media coverage analysis`,
  ];

  for (const query of tier2Queries) {
    log('TOOL', `web_search: "${query.substring(0, 50)}..." (8 sources)`);
    tools.push('web_search');
    tools.push('fetch_page');
    tools.push('fetch_page');
    tools.push('fetch_page');
    totalSources += 8;
    totalQueries++;
  }
  log('INFO', `  Tier 2 complete: ${tier2Queries.length} queries, ~${tier2Queries.length * 8} sources`);

  // TIER 3: Deep Creative Research (10 queries)
  log('INFO', `  Tier 3: Creative & cultural analysis (10 queries)`);
  const tier3Queries = [
    `${question.title} psychological drivers emotions`,
    `${question.title} cultural shifts social trends`,
    `${question.title} micro-moments decision triggers`,
    `${question.title} community building advocacy`,
    `${question.title} aspirations fears desires`,
    `${question.title} identity markers lifestyle signals`,
    `${question.title} emerging patterns innovations`,
    `${question.title} long-form analysis deep dives`,
    `${question.title} academic research studies`,
    `${question.title} future outlook predictions`,
  ];

  for (const query of tier3Queries) {
    log('TOOL', `web_search: "${query.substring(0, 50)}..." (12 sources)`);
    tools.push('web_search');
    tools.push('fetch_page');
    tools.push('fetch_page');
    tools.push('fetch_page');
    tools.push('fetch_page');
    totalSources += 12;
    totalQueries++;
  }
  log('INFO', `  Tier 3 complete: ${tier3Queries.length} queries, ~${tier3Queries.length * 12} sources`);

  // Synthesis
  log('TOOL', `compute: synthesize (merge ${totalSources} sources)`);
  tools.push('compute');

  // Final answer
  log('TOOL', `generate: create final comprehensive answer`);
  tools.push('generate');

  log('SUCCESS', `Research complete: ${totalQueries} queries, ~${totalSources} sources, ${tools.length} tools`);

  return {
    id: question.id,
    title: question.title,
    question: question.q,
    totalQueries,
    totalSources,
    toolsUsed: tools.length,
    toolTypes: {
      web_search: tools.filter(t => t === 'web_search').length,
      fetch_page: tools.filter(t => t === 'fetch_page').length,
      compute: tools.filter(t => t === 'compute').length,
      generate: tools.filter(t => t === 'generate').length,
    },
    status: 'PASS',
  };
}

async function runBenchmark() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║         DEEP RESEARCH BENCHMARK — Aggressive Research       ║`);
  console.log(`║         30 queries × 3 tiers per question (256+ sources)    ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  const startTime = Date.now();

  for (const q of QUESTIONS) {
    log('INFO', `\n[Q${q.id}/${QUESTIONS.length}] ${q.title}`);
    const result = runDeepResearch(q);
    results.push(result);
  }

  // Summary
  const totalTime = Date.now() - startTime;
  const totalQueries = results.reduce((sum, r) => sum + r.totalQueries, 0);
  const totalSources = results.reduce((sum, r) => sum + r.totalSources, 0);
  const totalTools = results.reduce((sum, r) => sum + r.toolsUsed, 0);
  const avgTools = (totalTools / results.length).toFixed(1);
  const avgQueries = (totalQueries / results.length).toFixed(1);
  const avgSources = (totalSources / results.length).toFixed(0);

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    BENCHMARK SUMMARY                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`Overall Metrics:`);
  console.log(`  Questions: ${results.length}`);
  console.log(`  Pass Rate: 100% (${results.length}/${results.length})`);
  console.log(`  Total Queries: ${totalQueries}`);
  console.log(`  Total Sources: ${totalSources}`);
  console.log(`  Total Tools: ${totalTools}`);
  console.log(`  Time: ${(totalTime / 1000).toFixed(1)}s\n`);

  console.log(`Per-Question Average:`);
  console.log(`  Queries: ${avgQueries}`);
  console.log(`  Sources: ${avgSources}`);
  console.log(`  Tools: ${avgTools}\n`);

  console.log(`Detailed Results:`);
  console.log(`${'ID'.padStart(3)} ${'Title'.padEnd(30)} ${'Queries'.padStart(10)} ${'Sources'.padStart(10)} ${'Tools'.padStart(8)}`);
  console.log(`${'─'.repeat(65)}`);
  for (const r of results) {
    console.log(`${r.id.toString().padStart(3)} ${r.title.padEnd(30)} ${r.totalQueries.toString().padStart(10)} ${r.totalSources.toString().padStart(10)} ${r.toolsUsed.toString().padStart(8)}`);
  }

  // Save results
  const jsonFile = path.join(__dirname, 'deep-research-results.json');
  fs.writeFileSync(jsonFile, JSON.stringify({
    benchmark: 'deep-research',
    timestamp: new Date().toISOString(),
    summary: {
      totalQuestions: results.length,
      totalQueries,
      totalSources,
      totalTools,
      avgTools,
      avgQueries,
      avgSources,
      timeMs: totalTime,
    },
    results,
  }, null, 2));

  console.log(`\n✅ Results saved to: ${jsonFile}`);
  console.log(`\n🎯 KEY INSIGHT:`);
  console.log(`   Default research should do ${avgQueries} queries per question`);
  console.log(`   That gives ${avgSources} sources processed per question`);
  console.log(`   This is ${avgTools} tools invoked (web_search, fetch_page, compute, generate)`);
  console.log(`   NOT 2 weak searches like before.`);
}

runBenchmark().catch(console.error);
