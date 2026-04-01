#!/usr/bin/env node
/**
 * Claude Code Leak Analysis Research — With Parallel Subagents
 * Deep analysis with 5 parallel research subagents
 * Run: npm run research:leak:subagents
 */

import * as fs from 'fs';
import * as path from 'path';
import { setupNodeEnvironment } from './utils/nodeAdapter';
import { runAutonomousResearchLoop } from './utils/autonomousResearchLoop-subagents';
import type { ResearchTask } from './utils/autonomousResearchLoop-subagents';

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

  // Also track subagent tokens
  if (data?.tokenCount !== undefined) {
    totalTokensUsed += data.tokenCount;
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
  const resultsDir = path.join(downloadsPath, 'research-results', `leak-analysis-subagents-${timestamp}`);

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
      researchMode: 'parallel-subagents',
      executionEvents: executionLog.length,
      totalTokensUsed,
      subagentEvents: executionLog.filter(e => e.event.includes('subagent')).length,
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
  const { runAutonomousResearchLoop: researchLoop } = await import('./utils/autonomousResearchLoop-subagents');

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

Deploy 5 PARALLEL RESEARCH SUBAGENTS:

1. ARCHITECT SUBAGENT
   Focus: Harness architecture, design patterns, system structure
   Task: Analyze the complete architecture including tool system, routing, permissions

2. IMPLEMENTER SUBAGENT
   Focus: Code implementation details, algorithms, technical approach
   Task: Deep-dive into implementation patterns and code-level specifics

3. SECURITY SUBAGENT
   Focus: Vulnerabilities, risks, security implications
   Task: Identify exploitable vulnerabilities and severity ratings

4. RESEARCHER SUBAGENT
   Focus: Real-time news, reactions, current events from TODAY
   Task: Find latest news articles, expert analyses, community discussions

5. ANALYST SUBAGENT
   Focus: Competitive landscape and strategic context
   Task: Compare Claude's system to competitors, assess market impact

Each subagent runs in parallel with full tool access. Results synthesized into unified analysis.`,

    evaluationCriteria: [
      'All 5 subagents deployed and executed successfully',
      'Covers complete Harness architecture from all angles',
      'Identifies specific security vulnerabilities with severity',
      'Includes real-time news and reactions from today',
      'Provides competitive analysis and industry positioning',
      'Evidence is cited with links and code excerpts',
      'Findings are synthesized into coherent narrative',
      'Recommendations are actionable and specific',
    ],

    maxIterations: 1,

    constraints: {
      maxTimePerIteration: 120,
      qualityThreshold: 0.80,
      maxTokensPerIteration: 12000,
    },
  };

  console.log('\n' + '='.repeat(70));
  console.log('🔒 CLAUDE CODE LEAK ANALYSIS — PARALLEL SUBAGENTS');
  console.log('Autonomous Research with 5 Parallel Research Agents');
  console.log('='.repeat(70));
  console.log('\nDeploying research subagents:');
  console.log('  1. 🏗️  Architect — Architecture & design patterns');
  console.log('  2. 💻 Implementer — Code & implementation details');
  console.log('  3. 🔒 Security — Vulnerabilities & risk analysis');
  console.log('  4. 📰 Researcher — Real-time news & reactions');
  console.log('  5. 📊 Analyst — Competitive & strategic context');
  console.log('\nAll subagents run in PARALLEL for maximum efficiency.');
  console.log('='.repeat(70) + '\n');

  try {
    const result = await researchLoop(
      task,
      (tracker) => {
        const progress = tracker.getProgress();
        const bar = '█'.repeat(Math.floor(progress.totalIterations / 2));
        process.stdout.write(
          `\r  Research Progress: [${bar.padEnd(5)}] Score: ${progress.bestScore}/100`
        );
      },
      logExecution
    );

    console.log('\n');
    console.log('='.repeat(70));
    console.log('RESEARCH COMPLETE — PARALLEL EXECUTION');
    console.log('='.repeat(70));
    console.log(`\nFinal Score: ${result.finalScore}/100`);
    console.log(`Execution Events: ${executionLog.length}`);
    console.log(`Subagent Events: ${executionLog.filter(e => e.event.includes('subagent')).length}`);
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
