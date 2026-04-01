#!/usr/bin/env node

/**
 * Batch Research Runner — Execute all research prompts
 * Usage: node scripts/batch-research.js [--parallel] [--timeout 300]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let parallel = false;
let timeout = 300; // 5 minutes

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--parallel') {
    parallel = true;
  } else if (args[i] === '--timeout' && args[i + 1]) {
    timeout = parseInt(args[++i]);
  }
}

// Configuration
const researchDir = path.join(process.env.HOME || '/tmp', 'Downloads/research-results');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const batchDir = path.join(researchDir, `batch-${timestamp}`);
const resultsFile = path.join(batchDir, 'batch-results.txt');
const metricsFile = path.join(batchDir, 'batch-metrics.json');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Research prompts to run
const prompts = [
  {
    name: 'Claude Code Leak Analysis',
    command: 'research:leak',
    description: 'Comprehensive analysis of exposed Harness architecture',
  },
];

// Tracking
const results = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

console.log('================================================================================');
console.log('AUTONOMOUS RESEARCH BATCH RUNNER');
console.log('================================================================================');
console.log('');
console.log(`📁 Results directory: ${batchDir}`);
console.log(`⏱️  Timeout per research: ${timeout}s`);
console.log(`🔄 Parallel mode: ${parallel}`);
console.log(`📊 Total prompts: ${prompts.length}`);
console.log('');
console.log(`Starting batch run at ${new Date().toISOString()}`);
console.log('');

// Create batch directory
if (!fs.existsSync(batchDir)) {
  fs.mkdirSync(batchDir, { recursive: true });
}

/**
 * Run a single research prompt
 */
function runResearch(prompt, index) {
  console.log(`${colors.blue}[${String(index).padStart(2, '0')}] Running: ${prompt.name}${colors.reset}`);
  console.log(`  Command: npm run ${prompt.command}`);
  console.log(`  Description: ${prompt.description}`);

  const startTime = Date.now();
  const outputFile = path.join(batchDir, `${prompt.command}-output.txt`);

  try {
    // Run with timeout
    const cmd = `npm run ${prompt.command}`;
    execSync(cmd, {
      cwd: process.cwd(),
      timeout: timeout * 1000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const duration = (Date.now() - startTime) / 1000;
    const status = `${colors.green}✅ PASSED${colors.reset}`;

    console.log(`  Status: ${status}`);
    console.log(`  Time: ${duration.toFixed(1)}s`);

    passedTests++;
    results.push({
      name: prompt.name,
      command: prompt.command,
      status: 'PASSED',
      duration: duration.toFixed(1),
      score: 'N/A',
    });
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    let status = `${colors.red}❌ FAILED${colors.reset}`;

    if (error.killed) {
      status = `${colors.yellow}⏱️  TIMEOUT${colors.reset} (${timeout}s)`;
    }

    console.log(`  Status: ${status}`);
    console.log(`  Time: ${duration.toFixed(1)}s`);

    failedTests++;
    results.push({
      name: prompt.name,
      command: prompt.command,
      status: error.killed ? 'TIMEOUT' : 'FAILED',
      duration: duration.toFixed(1),
      score: 'N/A',
    });
  }

  totalTests++;
  console.log('');
}

/**
 * Generate results summary
 */
function generateSummary() {
  console.log('================================================================================');
  console.log('BATCH RESULTS SUMMARY');
  console.log('================================================================================');
  console.log('');

  const summary = [];
  summary.push('BATCH EXECUTION REPORT');
  summary.push('=====================');
  summary.push('');
  summary.push(`Execution Time: ${new Date().toISOString()}`);
  summary.push(`Total Tests: ${totalTests}`);
  summary.push(`Passed: ${passedTests}`);
  summary.push(`Failed: ${failedTests}`);
  summary.push(`Pass Rate: ${passedTests}/${totalTests} (${Math.round((passedTests * 100) / totalTests)}%)`);
  summary.push('');
  summary.push('DETAILED RESULTS:');
  summary.push('--------------');
  summary.push('');

  // Table header
  summary.push(
    `${String('Research').padEnd(40)} ${String('Status').padEnd(15)} ${String('Time').padEnd(10)} ${String('Score').padEnd(10)}`
  );
  summary.push(
    `${String('--------').padEnd(40)} ${String('------').padEnd(15)} ${String('----').padEnd(10)} ${String('-----').padEnd(10)}`
  );
  summary.push('');

  // Results table
  for (const result of results) {
    summary.push(
      `${result.name.padEnd(40)} ${result.status.padEnd(15)} ${result.duration.padEnd(10)}s ${result.score.padEnd(10)}`
    );
  }

  summary.push('');
  summary.push('FILES GENERATED:');
  summary.push('---------------');
  summary.push('');

  const files = fs.readdirSync(batchDir).sort();
  for (const file of files) {
    const filePath = path.join(batchDir, file);
    const stat = fs.statSync(filePath);
    summary.push(`  ${file} (${(stat.size / 1024).toFixed(1)}KB)`);
  }

  // Write to file
  const summaryText = summary.join('\n');
  console.log(summaryText);
  fs.writeFileSync(resultsFile, summaryText, 'utf-8');

  // Write metrics JSON
  const metrics = {
    batchId: path.basename(batchDir),
    executedAt: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests,
    passRate: Math.round((passedTests * 100) / totalTests),
    results,
  };

  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2), 'utf-8');

  console.log('');
  console.log('================================================================================');
  console.log('BATCH COMPLETE');
  console.log('================================================================================');
  console.log('');
  console.log(`${colors.green}✅ Results saved to: ${batchDir}${colors.reset}`);
  console.log('');
  console.log(`📄 Summary: ${resultsFile}`);
  console.log(`📊 Metrics: ${metricsFile}`);
  console.log(`📁 Full results: ${batchDir}/`);
  console.log('');

  if (passedTests === totalTests) {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  Some tests failed. Review results for details.${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Main execution
 */
if (parallel) {
  console.log('🔄 Running prompts in parallel mode...');
  console.log('');

  const promises = prompts.map((prompt, i) =>
    new Promise((resolve) => {
      setTimeout(() => {
        runResearch(prompt, i + 1);
        resolve();
      }, i * 100) // Stagger start by 100ms to avoid race conditions
    })
  );

  Promise.all(promises).then(() => generateSummary());
} else {
  console.log('▶️  Running prompts sequentially...');
  console.log('');

  for (let i = 0; i < prompts.length; i++) {
    runResearch(prompts[i], i + 1);
  }

  generateSummary();
}
