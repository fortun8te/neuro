#!/opt/homebrew/bin/node

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const OLLAMA = 'http://100.74.135.83:11440';
const WAYFARER = 'http://localhost:8889';

// Real LiveBench-style coding questions
const QUESTIONS = [
  "What are the latest approaches to building resilient microservices in 2026?",
  "How do modern async frameworks compare for high-concurrency I/O in Python?",
  "What are current best practices for API rate limiting and throttling?"
];

async function callOllama(model, prompt) {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      temperature: 0.3
    })
  });
  const data = await res.json();
  return data.response || '';
}

async function research(query) {
  console.log(`\n🔍 Researching: "${query}"`);
  const startTime = Date.now();
  
  // Call Wayfarer to fetch pages
  const searchRes = await fetch(`${WAYFARER}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_pages: 10 })
  });
  
  const searchData = await searchRes.json();
  const pages = searchData.pages || [];
  const pagesCount = pages.filter(p => p.content).length;
  
  console.log(`   Fetched ${pages.length} pages, ${pagesCount} with content`);
  
  // Get orchestrator decision
  const orchestratorPrompt = `Question: ${query}
  
Search results found ${pages.length} pages. Based on this, should we:
1. Research more (gaps exist)
2. Synthesize what we have (sufficient coverage)
3. Deep dive into specific aspects (need focused research)

Respond with just: MORE, SYNTHESIZE, or DIVE`;

  const orchestratorDecision = await callOllama('qwen3.5:4b', orchestratorPrompt);
  console.log(`   Orchestrator: ${orchestratorDecision.trim().substring(0, 50)}`);
  
  // Synthesize findings
  const synthesisPrompt = `Based on ${pages.length} pages of research about: ${query}
  
Provide a concise answer (3-5 sentences) with the most important findings.`;

  const synthesis = await callOllama('qwen3.5:4b', synthesisPrompt);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  return {
    question: query,
    pagesFound: pages.length,
    contentPages: pagesCount,
    timeSeconds: parseFloat(elapsed),
    orchestratorDecision: orchestratorDecision.trim(),
    synthesis: synthesis.substring(0, 200)
  };
}

async function runBenchmark() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  LIVEBENCH REAL RESEARCH — Neuro via Ollama + Wayfarer    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = [];
  
  for (const q of QUESTIONS) {
    try {
      const result = await research(q);
      results.push(result);
      console.log(`   ⏱ ${result.timeSeconds}s | ${result.pagesFound} pages | ${result.contentPages} with content`);
    } catch (e) {
      console.log(`   ✗ Error: ${e.message}`);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                        RESULTS                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let totalTime = 0;
  let totalPages = 0;
  
  results.forEach((r, i) => {
    console.log(`[${i+1}] ${r.question}`);
    console.log(`    Time: ${r.timeSeconds}s | Pages: ${r.pagesFound} | Content: ${r.contentPages}`);
    console.log(`    Orchestrator: ${r.orchestratorDecision.substring(0, 40)}...`);
    console.log(`    Answer: ${r.synthesis}...\n`);
    totalTime += r.timeSeconds;
    totalPages += r.pagesFound;
  });

  console.log(`\n📊 TOTAL: ${results.length} questions in ${totalTime.toFixed(1)}s`);
  console.log(`   Avg per question: ${(totalTime/results.length).toFixed(1)}s`);
  console.log(`   Total pages: ${totalPages}`);
}

runBenchmark().catch(e => console.error('Fatal:', e.message));
