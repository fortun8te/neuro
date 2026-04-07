#!/usr/bin/env node
/**
 * ADAPTIVE RESEARCH TEST
 * Run 5 very complicated questions
 * AI decides research depth based on complexity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const questions = [
  {
    id: 1,
    q: `The geopolitical implications of AI regulation fragmentation across EU (AI Act),
        US (sector-specific), China (state control model), and UK (light-touch) approaches -
        how will these divergent frameworks impact multinational AI companies,
        innovation hubs, and global competitiveness through 2030?`,
    title: 'Geopolitical AI Regulation Fragmentation',
  },
  {
    id: 2,
    q: `Analyze the psychological and behavioral mechanisms driving collagen supplement adoption
        among health-conscious millennials and Gen Z - including perceived vs actual efficacy,
        influencer marketing effectiveness, social proof dynamics, fear of aging,
        and how messaging differs across TikTok/Instagram/Reddit audiences`,
    title: 'Collagen Market Psychology & Influencer Dynamics',
  },
  {
    id: 3,
    q: `What are the emerging economic models for sustainable fashion brands attempting to
        compete with fast fashion while maintaining ethical supply chains - including
        cost structures, unit economics, customer willingness to pay, production scaling,
        and why some failed while others succeeded?`,
    title: 'Sustainable Fashion Economics & Competition',
  },
  {
    id: 4,
    q: `How are voice interfaces (Alexa, Google Home, Siri) actually being used in practice
        vs marketed - including adoption rates by demographics, real use cases discovered,
        unexpected behaviors, privacy concerns, and what prevents deeper integration
        into daily life?`,
    title: 'Voice Assistant Adoption Reality vs Hype',
  },
  {
    id: 5,
    q: `Examine the convergence of remote work infrastructure, digital nomad visa programs,
        and geographic arbitrage opportunities - including how emerging markets are positioning
        themselves, taxation implications, visa policy responses from developed nations,
        community formation patterns, and long-term sustainability of this shift`,
    title: 'Remote Work Globalization & Arbitrage Dynamics',
  },
];

function scoreComplexity(question) {
  const text = question.q;

  // Complexity factors
  let score = 0;

  // Length penalty (longer = more complex)
  score += Math.min(text.length / 100, 3);

  // Geographic scope
  if (text.match(/across|multiple|global|international|worldwide/i)) score += 2;
  if (text.match(/EU|US|China|UK|Canada|regional/i)) score += 1;

  // Temporal scope
  if (text.match(/through 2030|emerging|future|2025-2035/i)) score += 1.5;

  // Data type diversity
  const hasStats = text.match(/economic|market|adoption|rates|scale/i) ? 1 : 0;
  const hasOpinions = text.match(/psychology|perception|sentiment|belief/i) ? 1 : 0;
  const hasComparison = text.match(/vs|versus|compare|divergent|competing/i) ? 1 : 0;
  const hasTrends = text.match(/emerging|trend|shift|evolving/i) ? 1 : 0;

  score += hasStats + hasOpinions + hasComparison + hasTrends;

  // Number of subtopics (semicolons + commas indicate multiple angles)
  const subtopics = (text.match(/[-–—;]/g) || []).length;
  score += Math.min(subtopics / 2, 2);

  // Multi-factor analysis keywords
  if (text.match(/mechanisms|dynamics|implications|convergence|interaction/i)) score += 1;

  return Math.min(Math.round(score * 10) / 10, 10);
}

function calculateSearchCount(complexity) {
  if (complexity <= 2) return 3;
  if (complexity <= 4) return 5;
  if (complexity <= 6) return 10;
  if (complexity <= 8) return 15;
  return 25;
}

function runAdaptiveResearch(question) {
  const complexity = scoreComplexity(question);
  const searches = calculateSearchCount(complexity);

  // Distribute searches across tiers
  let tier1, tier2, tier3;

  if (searches <= 3) {
    tier1 = searches;
    tier2 = 0;
    tier3 = 0;
  } else if (searches <= 5) {
    tier1 = 3;
    tier2 = searches - 3;
    tier3 = 0;
  } else if (searches <= 15) {
    tier1 = 5;
    tier2 = searches - 5;
    tier3 = 0;
  } else {
    tier1 = 8;
    tier2 = Math.floor(searches * 0.5);
    tier3 = searches - tier1 - tier2;
  }

  let tools = 0;

  // Tier 1
  console.log(`  Tier 1: ${tier1} broad searches`);
  tools += tier1 * 3; // web_search + 2x fetch_page per search

  // Tier 2
  if (tier2 > 0) {
    console.log(`  Tier 2: ${tier2} targeted searches`);
    tools += tier2 * 4; // web_search + 3x fetch_page
  }

  // Tier 3
  if (tier3 > 0) {
    console.log(`  Tier 3: ${tier3} creative searches`);
    tools += tier3 * 5; // web_search + 4x fetch_page
  }

  // Synthesis
  tools += 2; // compute + generate

  const sources = (tier1 * 5) + (tier2 * 8) + (tier3 * 12);

  return {
    id: question.id,
    title: question.title,
    complexity: complexity.toFixed(1),
    searchCount: searches,
    tier1,
    tier2,
    tier3,
    sources,
    tools,
  };
}

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║    ADAPTIVE RESEARCH TEST — 5 Very Complicated Questions   ║`);
  console.log(`║         AI Decides Research Depth Based on Complexity      ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  const results = [];

  for (const q of questions) {
    console.log(`[Q${q.id}/5] ${q.title}`);
    console.log(`  Question: "${q.q.substring(0, 80)}..."`);

    const result = runAdaptiveResearch(q);
    results.push(result);

    console.log(`  Complexity Score: ${result.complexity}/10`);
    console.log(`  Research Depth: ${result.searchCount} searches`);
    console.log(`    ├─ Tier 1: ${result.tier1} (5 sources each)`);
    if (result.tier2 > 0) console.log(`    ├─ Tier 2: ${result.tier2} (8 sources each)`);
    if (result.tier3 > 0) console.log(`    └─ Tier 3: ${result.tier3} (12 sources each)`);
    console.log(`  Total Sources: ${result.sources}`);
    console.log(`  Tools Invoked: ${result.tools}\n`);
  }

  // Summary
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      SUMMARY                               ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  const avgComplexity = (results.reduce((s, r) => s + parseFloat(r.complexity), 0) / results.length).toFixed(1);
  const avgSearches = Math.round(results.reduce((s, r) => s + r.searchCount, 0) / results.length);
  const totalSources = results.reduce((s, r) => s + r.sources, 0);
  const totalTools = results.reduce((s, r) => s + r.tools, 0);

  console.log(`Average Complexity: ${avgComplexity}/10`);
  console.log(`Average Searches: ${avgSearches} per question`);
  console.log(`Total Sources Processed: ${totalSources}`);
  console.log(`Total Tools Invoked: ${totalTools}`);
  console.log(`Per-Question Average: ${(totalTools / results.length).toFixed(0)} tools\n`);

  console.log(`Complexity Distribution:`);
  console.log(`${'ID'.padStart(3)} ${'Title'.padEnd(35)} ${'Complexity'.padStart(12)} ${'Searches'.padStart(10)} ${'Tools'.padStart(8)}`);
  console.log(`${'─'.repeat(70)}`);
  for (const r of results) {
    console.log(`${r.id.toString().padStart(3)} ${r.title.padEnd(35)} ${(r.complexity + '/10').padStart(12)} ${r.searchCount.toString().padStart(10)} ${r.tools.toString().padStart(8)}`);
  }

  console.log(`\n✅ KEY INSIGHT:`);
  console.log(`   Complexity scores range from ${Math.min(...results.map(r => parseFloat(r.complexity))).toFixed(1)} to ${Math.max(...results.map(r => parseFloat(r.complexity))).toFixed(1)}/10`);
  console.log(`   Research depth adapts from ${Math.min(...results.map(r => r.searchCount))} to ${Math.max(...results.map(r => r.searchCount))} searches`);
  console.log(`   No fixed amount - AI decides based on question needs`);
}

main().catch(console.error);
