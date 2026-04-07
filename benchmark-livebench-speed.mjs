#!/opt/homebrew/bin/node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WAYFARER_URL = 'http://localhost:8889';

// Sample questions inspired by LiveBench - real current events / knowledge
const BENCHMARK_QUESTIONS = [
  {
    id: 'lb-1',
    question: 'What are the latest developments in affordable housing policy in the US in 2026?',
    category: 'policy',
    expectedComplexity: 'medium'
  },
  {
    id: 'lb-2',
    question: 'How is artificial general intelligence (AGI) defined in current machine learning research?',
    category: 'ai',
    expectedComplexity: 'high'
  },
  {
    id: 'lb-3',
    question: 'What new climate technologies have emerged for carbon capture in the past year?',
    category: 'climate',
    expectedComplexity: 'medium-high'
  },
  {
    id: 'lb-4',
    question: 'Which countries are leading in renewable energy adoption by percentage in 2026?',
    category: 'energy',
    expectedComplexity: 'medium'
  },
  {
    id: 'lb-5',
    question: 'What are the current treatments for Alzheimers disease in clinical trials?',
    category: 'medicine',
    expectedComplexity: 'high'
  }
];

async function research(question) {
  try {
    const response = await fetch(`${WAYFARER_URL}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, max_pages: 20, top_k: 5 })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Research failed: ${error.message}`);
    return null;
  }
}

async function runBenchmark() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     LIVEBENCH SPEED BENCHMARK — Real Research Harness      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const logsDir = 'harness-optimization-logs';
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(logsDir, `livebench-speed-${timestamp}.jsonl`);

  fs.appendFileSync(logPath, JSON.stringify({
    event: 'benchmark_start',
    timestamp: new Date().toISOString(),
    questionsCount: BENCHMARK_QUESTIONS.length
  }) + '\n');

  const results = [];

  for (const q of BENCHMARK_QUESTIONS) {
    console.log(`\n──────────────────────────────────────────────────────────`);
    console.log(`Testing [${q.id}] ${q.category}`);
    console.log(`Q: "${q.question}"`);
    console.log(`Expected complexity: ${q.expectedComplexity}`);
    console.log('');

    const startTime = performance.now();
    const result = await research(q.question);
    const elapsed = (performance.now() - startTime) / 1000;

    if (result) {
      const pages = result.pages?.length || 0;
      const sources = result.content?.split(/https?:\/\/[^\s]+/).length - 1 || 0;

      console.log(`  ✓ Completed in ${elapsed.toFixed(2)}s`);
      console.log(`  → Pages fetched: ${pages}`);
      console.log(`  → Content length: ${(result.content?.length || 0) / 1024}KB`);
      console.log(`  → Estimated sources: ${sources}`);

      const resultObj = {
        id: q.id,
        category: q.category,
        question: q.question,
        timeMs: Math.round(elapsed * 1000),
        pagesFetched: pages,
        contentBytes: result.content?.length || 0,
        sources: sources
      };

      results.push(resultObj);

      fs.appendFileSync(logPath, JSON.stringify({
        event: 'question_complete',
        ...resultObj,
        timestamp: new Date().toISOString()
      }) + '\n');
    } else {
      console.log(`  ✗ Research failed (Wayfarer may not be running)`);
      results.push({
        id: q.id,
        category: q.category,
        question: q.question,
        status: 'failed'
      });
    }
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    BENCHMARK SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.timeMs);
  if (successful.length > 0) {
    const totalTime = successful.reduce((sum, r) => sum + r.timeMs, 0);
    const avgTime = Math.round(totalTime / successful.length);
    const totalPages = successful.reduce((sum, r) => sum + r.pagesFetched, 0);
    const totalBytes = successful.reduce((sum, r) => sum + r.contentBytes, 0);

    console.log(`📊 Statistics (${successful.length}/${BENCHMARK_QUESTIONS.length} successful):`);
    console.log(`   Average time per question: ${avgTime}ms`);
    console.log(`   Total time for all: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Total pages: ${totalPages}`);
    console.log(`   Avg pages/question: ${(totalPages / successful.length).toFixed(1)}`);
    console.log(`   Total content: ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
    console.log('');

    console.log('Details per question:');
    successful.forEach(r => {
      console.log(`   [${r.id}] ${r.category.padEnd(10)} → ${r.timeMs}ms, ${r.pagesFetched} pages, ${(r.contentBytes / 1024).toFixed(1)}KB`);
    });
  } else {
    console.log('⚠ No questions completed successfully.');
    console.log('Make sure Wayfarer is running on port 8889.');
  }

  fs.appendFileSync(logPath, JSON.stringify({
    event: 'benchmark_complete',
    successfulCount: successful.length,
    totalCount: BENCHMARK_QUESTIONS.length,
    avgTimeMs: successful.length > 0 ? Math.round(successful.reduce((sum, r) => sum + r.timeMs, 0) / successful.length) : 0,
    timestamp: new Date().toISOString()
  }) + '\n');

  console.log(`\n📝 Log saved to: ${logPath}\n`);
}

runBenchmark().catch(console.error);
