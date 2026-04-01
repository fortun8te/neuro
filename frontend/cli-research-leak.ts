#!/usr/bin/env node
/**
 * Claude Code Leak Analysis Research
 * Deep analysis of exposed Harness architecture + real-time events
 * Run: npm run research:leak
 */

import * as fs from 'fs';
import * as path from 'path';
import { setupNodeEnvironment } from './utils/nodeAdapter';
import { runAutonomousResearchLoop } from './utils/autonomousResearchLoop';
import type { ResearchTask } from './utils/autonomousResearchLoop';

setupNodeEnvironment();

// Global execution log
let executionLog: any[] = [];
let totalTokensUsed = 0;

function logExecution(event: string, data: any): void {
  const logEntry: any = {
    timestamp: Date.now(),
    event,
    data,
  };

  if (data?.inputTokens !== undefined) {
    totalTokensUsed += (data.inputTokens + (data.outputTokens || 0) + (data.thinkingTokens || 0));
  }

  executionLog.push(logEntry);
}

function saveResearchResults(
  objective: string,
  finalResult: string,
  tracker: any,
  finalScore: number
): string {
  const downloadsPath = path.join(process.env.HOME || '/tmp', 'Downloads');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const resultsDir = path.join(downloadsPath, 'research-results', `leak-analysis-${timestamp}`);

  try {
    fs.mkdirSync(resultsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create results directory:', error);
    return '';
  }

  try {
    // Save findings
    fs.writeFileSync(
      path.join(resultsDir, 'findings.txt'),
      finalResult,
      'utf-8'
    );

    // Save tracking data
    fs.writeFileSync(
      path.join(resultsDir, 'data.json'),
      tracker.exportJSON(),
      'utf-8'
    );

    // Save execution log
    fs.writeFileSync(
      path.join(resultsDir, 'execution-log.json'),
      JSON.stringify(executionLog, null, 2),
      'utf-8'
    );

    // Save summary
    const summary = {
      objective,
      timestamp: new Date().toISOString(),
      finalScore,
      resultsPath: resultsDir,
      executionEvents: executionLog.length,
      totalTokensUsed,
      files: {
        findings: 'findings.txt (research findings)',
        data: 'data.json (research data)',
        executionLog: 'execution-log.json (tool/routing events + tokens)',
      },
    };

    fs.writeFileSync(
      path.join(resultsDir, 'SUMMARY.txt'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    );

    console.log(`\n📁 Results saved to: ${resultsDir}`);
    console.log(`   📊 Captured ${executionLog.length} execution events`);
    console.log(`   🎯 Estimated tokens: ${totalTokensUsed}`);
    return resultsDir;
  } catch (error) {
    console.error('Failed to save results:', error);
    return '';
  }
}

async function main() {
  const { runAutonomousResearchLoop: researchLoop } = await import('./utils/autonomousResearchLoop');

  // Load research prompt
  const promptPath = path.join(process.cwd(), 'src/prompts/research-claude-code-leak.md');
  let promptContent = '';

  try {
    promptContent = fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('Failed to load research prompt:', error);
    process.exit(1);
  }

  // Create research task
  const task: ResearchTask = {
    objective: `Analyze the Claude Code leak (https://github.com/instructkr/claw-code).

Research Brief:
${promptContent}

Use subagents to:
1. Analyze the Harness architecture and tool system from the repository
2. Identify security implications and vulnerabilities
3. Search for real-time news and reactions from TODAY
4. Assess competitive impact and industry response
5. Synthesize into actionable intelligence

Deploy parallel web search subagents for news coverage. Focus on technical accuracy, timeliness, and security insights.`,

    evaluationCriteria: [
      'Covers complete Harness architecture (tool definitions, permissions, routing)',
      'Identifies specific security vulnerabilities with severity assessment',
      'Includes real-time news and reactions from today',
      'Provides competitive analysis and industry positioning',
      'Evidence is cited with links and code excerpts',
      'Findings are actionable and implementable',
      'Analysis is technically accurate and timely',
      'Recommends defensive measures for similar systems',
    ],

    maxIterations: 1,

    constraints: {
      maxTimePerIteration: 90,
      qualityThreshold: 0.80,
      maxTokensPerIteration: 8000,
    },
  };

  console.log('\n' + '='.repeat(70));
  console.log('🔒 CLAUDE CODE LEAK ANALYSIS');
  console.log('Autonomous Research with Subagent Coordination');
  console.log('='.repeat(70));
  console.log('\nDeploying research subagents:');
  console.log('  1. Architecture Deep Dive (codebase analysis)');
  console.log('  2. Implementation Details (tool system design)');
  console.log('  3. Security Assessment (vulnerability analysis)');
  console.log('  4. Real-Time News (today\'s developments)');
  console.log('  5. Competitive Intelligence (industry impact)');
  console.log('\n' + '='.repeat(70) + '\n');

  try {
    const result = await researchLoop(
      task,
      (tracker) => {
        const progress = tracker.getProgress();
        const bar = '█'.repeat(Math.floor(progress.totalIterations / 2));
        process.stdout.write(
          `\r  Research Progress: [${bar.padEnd(5)}] ${progress.totalIterations} | Score: ${progress.bestScore}/100`
        );
      },
      logExecution
    );

    console.log('\n');
    console.log('='.repeat(70));
    console.log('RESEARCH COMPLETE');
    console.log('='.repeat(70));
    console.log(`\nFinal Score: ${result.finalScore}/100`);
    console.log(`Execution Events: ${executionLog.length}`);
    console.log(`Tokens Used: ${totalTokensUsed}`);

    // Save results
    const resultsPath = saveResearchResults(
      task.objective,
      result.finalResult,
      result.tracker,
      result.finalScore
    );

    console.log('\n' + '='.repeat(70));
    console.log('Key Findings:');
    console.log('='.repeat(70));
    console.log(result.finalResult.substring(0, 2000) + '...\n');

  } catch (error) {
    console.error('\n❌ Research failed:', error);
    process.exit(1);
  }
}

main();
