#!/usr/bin/env node
/**
 * Batch Research Runner — 50 Test Questions
 * Runs research questions, captures all output, stores findings
 * Usage: node scripts/batch-questions.js [--categories A,B,C] [--limit 10]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let filterCategories = null;
let limit = 50;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--categories' && args[i + 1]) {
    filterCategories = args[++i].split(',');
  } else if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[++i]);
  }
}

// All 70 test questions
const questions = [
  // Category A: Simple
  { id: 'A1', category: 'simple', q: 'What is a blockchain?' },
  { id: 'A2', category: 'simple', q: 'How does photosynthesis work?' },
  { id: 'A3', category: 'simple', q: 'What are the top 3 programming languages in 2026?' },
  { id: 'A4', category: 'simple', q: 'Explain machine learning in simple terms' },
  { id: 'A5', category: 'simple', q: 'What is cloud computing?' },
  { id: 'A6', category: 'simple', q: 'How do neural networks work?' },
  { id: 'A7', category: 'simple', q: 'What is cryptocurrency?' },
  { id: 'A8', category: 'simple', q: 'Explain API in simple terms' },
  { id: 'A9', category: 'simple', q: 'What is open source software?' },
  { id: 'A10', category: 'simple', q: 'How does the internet work?' },
  // Category B: General Knowledge
  { id: 'B1', category: 'general', q: 'What are the current trends in artificial intelligence?' },
  { id: 'B2', category: 'general', q: 'How is the job market changing due to automation?' },
  { id: 'B3', category: 'general', q: 'What are the main challenges in climate change?' },
  { id: 'B4', category: 'general', q: 'How do supply chains impact global economics?' },
  { id: 'B5', category: 'general', q: 'What is the state of renewable energy adoption in 2026?' },
  { id: 'B6', category: 'general', q: 'How is education transforming with technology?' },
  { id: 'B7', category: 'general', q: 'What are the major cybersecurity threats today?' },
  { id: 'B8', category: 'general', q: 'How is remote work reshaping business culture?' },
  { id: 'B9', category: 'general', q: 'What are the implications of 5G technology?' },
  { id: 'B10', category: 'general', q: 'How are governments regulating AI?' },
  // Category C: Technical
  { id: 'C1', category: 'technical', q: 'What are the differences between REST and GraphQL APIs?' },
  { id: 'C2', category: 'technical', q: 'Explain microservices vs monolithic architecture' },
  { id: 'C3', category: 'technical', q: 'How does containerization improve deployment?' },
  { id: 'C4', category: 'technical', q: 'What are the tradeoffs between SQL and NoSQL databases?' },
  { id: 'C5', category: 'technical', q: 'How does a compiler transform code?' },
  { id: 'C6', category: 'technical', q: 'Explain memory management in programming languages' },
  { id: 'C7', category: 'technical', q: 'What is the difference between sync and async programming?' },
  { id: 'C8', category: 'technical', q: 'How do caching strategies improve performance?' },
  { id: 'C9', category: 'technical', q: 'What are the principles of object-oriented design?' },
  { id: 'C10', category: 'technical', q: 'How does CI/CD pipeline automation work?' },
  // Category D: Business
  { id: 'D1', category: 'business', q: 'What is the current market size for AI/ML services?' },
  { id: 'D2', category: 'business', q: 'How are large language models disrupting the software industry?' },
  { id: 'D3', category: 'business', q: 'What are the leading cloud providers and their positioning?' },
  { id: 'D4', category: 'business', q: 'How is the cybersecurity market evolving?' },
  { id: 'D5', category: 'business', q: 'What are the business implications of quantum computing?' },
  { id: 'D6', category: 'business', q: 'How are companies leveraging data analytics?' },
  { id: 'D7', category: 'business', q: 'What is the competitive landscape in fintech?' },
  { id: 'D8', category: 'business', q: 'How are startups disrupting traditional industries?' },
  { id: 'D9', category: 'business', q: 'What are the investment trends in tech for 2026?' },
  { id: 'D10', category: 'business', q: 'How is the SaaS market evolving?' },
  // Category E: Specific Technical
  { id: 'E1', category: 'deep-tech', q: 'Analyze the React ecosystem and competing frameworks (Vue, Angular, Svelte)' },
  { id: 'E2', category: 'deep-tech', q: 'What are the security vulnerabilities in Python 3.11?' },
  { id: 'E3', category: 'deep-tech', q: 'Compare Kubernetes vs Docker Swarm for orchestration' },
  { id: 'E4', category: 'deep-tech', q: 'Analyze the performance of different WebAssembly runtimes' },
  { id: 'E5', category: 'deep-tech', q: 'What are the latest developments in Rust for systems programming?' },
  { id: 'E6', category: 'deep-tech', q: 'Analyze GraphQL adoption patterns and pain points' },
  { id: 'E7', category: 'deep-tech', q: 'What are the tradeoffs of different testing frameworks?' },
  { id: 'E8', category: 'deep-tech', q: 'Analyze the performance characteristics of different LLMs' },
  { id: 'E9', category: 'deep-tech', q: 'What are the security implications of OAuth vs SAML?' },
  { id: 'E10', category: 'deep-tech', q: 'Analyze the state of TypeScript adoption in enterprise' },
  // Category F: Vague
  { id: 'F1', category: 'vague', q: 'Tell me about the internet' },
  { id: 'F2', category: 'vague', q: "What's new in tech?" },
  { id: 'F3', category: 'vague', q: 'Analyze software engineering' },
  { id: 'F4', category: 'vague', q: 'Research the cloud' },
  { id: 'F5', category: 'vague', q: 'Investigate databases' },
  // Category G: Edge Cases
  { id: 'G4', category: 'edge', q: 'Synthesize opposite viewpoints on AI regulation' },
  { id: 'G7', category: 'edge', q: 'Research extinct programming languages and why they died' },
  // Category H: Complex
  { id: 'H1', category: 'complex', q: 'Conduct comprehensive analysis of the Claude Code leak (https://github.com/instructkr/claw-code): architecture, security implications, competitive intelligence, real-time industry reactions, strategic recommendations' },
  { id: 'H2', category: 'complex', q: 'Research complete AI/ML landscape: major players and positioning, technology capabilities comparison, market trends, investment landscape, talent gaps' },
  { id: 'H3', category: 'complex', q: 'Analyze the full software development lifecycle transformation: impact of LLMs on coding, DevOps evolution, testing quality assurance, security compliance, team structure changes' },
  { id: 'H6', category: 'complex', q: 'Research cybersecurity threat landscape: current vulnerabilities, industry defenses, regulatory requirements, tools and technologies, skills shortage' },
  { id: 'H7', category: 'complex', q: 'Analyze frontend technology evolution: React vs Vue vs Angular vs Svelte, build tools, state management, performance, industry adoption' },
  { id: 'H8', category: 'complex', q: 'Deep dive into cloud infrastructure: AWS vs Azure vs GCP positioning, Kubernetes, serverless computing, cost management, multi-cloud strategies' },
];

// Apply filters
let filteredQuestions = questions;
if (filterCategories) {
  filteredQuestions = questions.filter(q =>
    filterCategories.some(cat => q.id.startsWith(cat))
  );
}
filteredQuestions = filteredQuestions.slice(0, limit);

// Setup output dir
const researchDir = path.join(process.env.HOME || '/tmp', 'Downloads', 'research-results');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const batchDir = path.join(researchDir, `batch-${timestamp}`);
fs.mkdirSync(batchDir, { recursive: true });

const masterLog = path.join(batchDir, 'BATCH_LOG.txt');
const metricsFile = path.join(batchDir, 'BATCH_METRICS.json');

const metrics = {
  startedAt: new Date().toISOString(),
  totalQuestions: filteredQuestions.length,
  completed: 0,
  failed: 0,
  scores: {},
  results: [],
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(masterLog, line + '\n');
}

function runResearch(question, index) {
  return new Promise((resolve) => {
    log(`\n${'='.repeat(60)}`);
    log(`[${String(index).padStart(2, '0')}/${filteredQuestions.length}] ${question.id}: ${question.q.substring(0, 80)}`);
    log(`Category: ${question.category}`);

    const startTime = Date.now();
    const questionDir = path.join(batchDir, `${question.id}-${question.category}`);
    fs.mkdirSync(questionDir, { recursive: true });

    let outputBuffer = '';

    const child = spawn('npx', ['tsx', 'src/cli-research.ts', question.q], {
      cwd: '/Users/mk/Downloads/nomads',
      env: { ...process.env, FORCE_COLOR: '0' },
      timeout: 180000, // 3 min per question
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      outputBuffer += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      outputBuffer += text;
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Extract score from output
      const scoreMatch = outputBuffer.match(/Score:\s*(\d+)\/100/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

      // Save question output
      fs.writeFileSync(path.join(questionDir, 'output.txt'), outputBuffer);
      fs.writeFileSync(path.join(questionDir, 'meta.json'), JSON.stringify({
        id: question.id,
        category: question.category,
        question: question.q,
        score,
        duration,
        exitCode: code,
        completedAt: new Date().toISOString(),
      }, null, 2));

      // Check if findings were saved by the research system
      const recentResults = fs.readdirSync(researchDir)
        .filter(d => d.startsWith('general-research-') || d.startsWith('research-'))
        .sort().reverse();
      if (recentResults.length > 0) {
        const findingsDir = path.join(researchDir, recentResults[0]);
        const findingsFile = path.join(findingsDir, 'findings.txt');
        if (fs.existsSync(findingsFile) && fs.statSync(findingsFile).size > 0) {
          fs.copyFileSync(findingsFile, path.join(questionDir, 'findings.txt'));
        }
      }

      metrics.completed++;
      metrics.scores[question.id] = score;
      metrics.results.push({ id: question.id, category: question.category, score, duration, exitCode: code });

      // Save metrics after each question
      fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));

      const status = code === 0 ? '✅' : '❌';
      log(`${status} ${question.id} complete — Score: ${score}/100, Time: ${duration}s, Exit: ${code}`);

      resolve({ question, score, duration, success: code === 0 });
    });

    child.on('error', (err) => {
      log(`❌ ${question.id} error: ${err.message}`);
      metrics.failed++;
      resolve({ question, score: 0, duration: 0, success: false });
    });
  });
}

async function main() {
  log('BATCH RESEARCH RUNNER — 50 QUESTIONS');
  log(`Output: ${batchDir}`);
  log(`Questions: ${filteredQuestions.length}`);
  log('');

  const allResults = [];
  for (let i = 0; i < filteredQuestions.length; i++) {
    const result = await runResearch(filteredQuestions[i], i + 1);
    allResults.push(result);
  }

  // Final analysis
  const scores = allResults.map(r => r.score).filter(s => s > 0);
  const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
  const passed = allResults.filter(r => r.score >= 70).length;

  metrics.finishedAt = new Date().toISOString();
  metrics.averageScore = parseFloat(avgScore);
  metrics.passRate = `${passed}/${allResults.length}`;
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));

  log('\n' + '='.repeat(60));
  log('BATCH COMPLETE');
  log('='.repeat(60));
  log(`Total: ${allResults.length} questions`);
  log(`Average Score: ${avgScore}/100`);
  log(`Passed (70+): ${passed}/${allResults.length}`);
  log(`Results: ${batchDir}`);

  // Score by category
  const byCategory = {};
  allResults.forEach(r => {
    const cat = r.question.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r.score);
  });

  log('\nScores by category:');
  Object.entries(byCategory).forEach(([cat, scores]) => {
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    log(`  ${cat}: ${avg}/100 avg (${scores.length} questions)`);
  });
}

main().catch(console.error);
