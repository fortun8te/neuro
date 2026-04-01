/**
 * Autonomous Research Loop — Full Neuro + Agent Engine
 *
 * Uses complete agent engine with:
 * - Context-1 semantic routing
 * - Full tool suite (web_search, browse, memory_search, etc.)
 * - Neuro identity integration
 * - Live tool execution logging
 *
 * Single iteration: RESEARCH → EVALUATE → REPORT
 */

import { runAgentLoop } from './agentEngine';
import { ollamaService } from './ollama';
import { ResearchProgressTracker } from './researchProgressTracker';
import type { AgentEngineEvent } from './agentEngine';

// For token tracking
let lastSessionTokens = 0;

export { ResearchProgressTracker };
export type { } from './agentEngine';

export interface ResearchTask {
  objective: string;
  evaluationCriteria: string[];
  maxIterations: number;
  constraints: {
    maxTimePerIteration?: number;
    maxTokensPerIteration?: number;
    qualityThreshold?: number;
  };
}

export interface ResearchEvaluation {
  score: number;
  passedCriteria: string[];
  failedCriteria: string[];
  gaps: string[];
  suggestions: string[];
}

export interface ResearchApproach {
  searchStrategy: string;
  tools: string[];
  followUpQueries: string[];
  depthLevel: 'shallow' | 'medium' | 'deep';
}

// ─── Helpers ───

function extractJSON(text: string): any | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function llm(
  prompt: string,
  system: string,
  opts: { model?: string; temperature?: number; signal?: AbortSignal } = {}
): Promise<string> {
  let full = '';
  await ollamaService.generateStream(prompt, system, {
    model: opts.model || 'qwen3.5:4b',
    temperature: opts.temperature ?? 0.4,
    signal: opts.signal,
    onChunk: (chunk: string) => {
      full += chunk;
    },
  });
  return full;
}

// ─── Main Pipeline ───

export async function runAutonomousResearchLoop(
  task: ResearchTask,
  onProgress?: (tracker: ResearchProgressTracker) => void,
  onExecutionEvent?: (event: string, data: any) => void
): Promise<{
  finalResult: string;
  iterations: number;
  finalScore: number;
  tracker: ResearchProgressTracker;
}> {
  const tracker = new ResearchProgressTracker(task.objective);
  const abortController = new AbortController();
  const signal = abortController.signal;

  // Log start
  onExecutionEvent?.('research_start', { objective: task.objective, timestamp: Date.now() });

  console.log(`\n${'='.repeat(70)}`);
  console.log('AUTONOMOUS RESEARCH — FULL NEURO SYSTEM');
  console.log(`${'='.repeat(70)}`);
  console.log(`Objective: ${task.objective}`);
  console.log(`Evaluation Criteria:`);
  task.evaluationCriteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log(`${'='.repeat(70)}\n`);

  // ── RESEARCH: Full agent engine with Context-1, tools, etc. ──
  console.log('[RESEARCH] Running full agent engine with Context-1 semantic routing...\n');

  let researchOutput = '';
  let currentTool = '';
  let toolOutput = '';
  const startTime = Date.now();

  const agentResult = await runAgentLoop(task.objective, '', {
    signal,
    onEvent: (event: AgentEngineEvent) => {
      // Show thinking
      if (event.type === 'thinking_chunk' && event.thinking) {
        process.stdout.write(`💭 `);
      }

      // Show tool execution
      if (event.type === 'tool_start' && event.toolCall) {
        currentTool = event.toolCall.name;
        toolOutput = '';
        console.log(`\n  [TOOL] Executing: ${currentTool}`);
        if (event.toolCall.args) {
          console.log(`    Args: ${JSON.stringify(event.toolCall.args).substring(0, 100)}...`);
        }
        process.stdout.write('    Output: ');

        // Log tool execution
        onExecutionEvent?.('tool_start', {
          toolName: currentTool,
          args: event.toolCall.args,
          timestamp: Date.now(),
        });
      }

      // Show tool result streaming
      if (event.type === 'tool_done' && event.toolCall) {
        console.log(`\n  [TOOL] ✓ ${currentTool} complete`);

        // Log tool completion
        onExecutionEvent?.('tool_complete', {
          toolName: currentTool,
          timestamp: Date.now(),
        });

        currentTool = '';
      }

      // Show response chunks (synthesis)
      if (event.type === 'response_chunk' && event.response) {
        process.stdout.write('.');
        researchOutput += event.response;
      }

      // Show routing decisions
      if (event.type === 'routing' && event.routing) {
        console.log(`\n  [ROUTING] ${event.routing.phase}: ${event.routing.decision}`);
        if (event.routing.tools) {
          console.log(`    Tools: ${event.routing.tools.join(', ')}`);
        }

        // Log routing decision
        onExecutionEvent?.('routing_decision', {
          phase: event.routing.phase,
          decision: event.routing.decision,
          tools: event.routing.tools,
          timestamp: Date.now(),
        });
      }

      // Show model info
      if (event.model && event.type === 'response_start') {
        console.log(`\n  [MODEL] Using: ${event.model}`);

        // Log model selection
        onExecutionEvent?.('model_selected', {
          model: event.model,
          timestamp: Date.now(),
        });
      }
    },
  });

  // Capture finalResponse if streaming chunks didn't accumulate output
  if (!researchOutput && agentResult?.finalResponse) {
    researchOutput = agentResult.finalResponse;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n[RESEARCH] ✓ Complete (${researchOutput.length} chars, ${duration}s)\n`);

  // Log research completion
  onExecutionEvent?.('research_complete', {
    duration: parseFloat(duration),
    outputLength: researchOutput.length,
    timestamp: Date.now(),
  });

  // ── EVALUATE: Score quality ──
  console.log('[EVALUATE] Scoring research quality...\n');

  const system = 'You are a research evaluator. Respond ONLY with valid JSON. No other text.';

  const evalPrompt = `Rate this research against these criteria:

RESEARCH:
${researchOutput.substring(0, 3000)}

CRITERIA:
${task.evaluationCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Score 0-100 (85+ excellent, 60-84 good, <60 poor).
Respond with ONLY this JSON:
{"score":75,"reasoning":"<brief>","passedCriteria":[""],"failedCriteria":[""],"gaps":[""],"suggestions":[""]}`;

  const fallback: ResearchEvaluation = {
    score: 50,
    passedCriteria: [],
    failedCriteria: task.evaluationCriteria.slice(),
    gaps: ['Could not evaluate'],
    suggestions: ['Retry'],
  };

  let evaluation = fallback;
  try {
    const evalStart = Date.now();
    const response = await llm(evalPrompt, system, { temperature: 0.2, signal });
    const parsed = extractJSON(response);

    if (parsed && typeof parsed.score === 'number') {
      const evalDuration = ((Date.now() - evalStart) / 1000).toFixed(1);
      evaluation = {
        score: Math.min(100, Math.max(0, parsed.score)),
        passedCriteria: parsed.passedCriteria || [],
        failedCriteria: parsed.failedCriteria || [],
        gaps: parsed.gaps || [],
        suggestions: parsed.suggestions || [],
      };

      console.log(`[EVALUATE] ✓ Complete (${evalDuration}s)\n`);
      console.log(`Score: ${evaluation.score}/100`);
      if (parsed.reasoning) console.log(`Reasoning: ${parsed.reasoning}`);
      if (evaluation.passedCriteria.length) {
        console.log('\nPassed:');
        evaluation.passedCriteria.forEach((c) => console.log(`  ✓ ${c}`));
      }
      if (evaluation.failedCriteria.length) {
        console.log('\nFailed:');
        evaluation.failedCriteria.forEach((c) => console.log(`  ✗ ${c}`));
      }
      if (evaluation.gaps.length) {
        console.log('\nGaps:');
        evaluation.gaps.forEach((g) => console.log(`  - ${g}`));
      }
      console.log('');
    }
  } catch (error) {
    console.log(`[EVALUATE] ✗ Error: ${(error as Error).message}\n`);
  }

  // Record in tracker
  tracker.addIteration(
    task.objective,
    evaluation.score,
    { confidence: 0.85, speed: 75, efficiency: 80, quality: evaluation.score > 70 ? 'good' : 'fair' },
    evaluation,
    true
  );

  // ── REPORT: Executive summary ──
  console.log('[REPORT] Generating executive summary...\n');

  const reportPrompt = `Objective: ${task.objective}

Research Quality Score: ${evaluation.score}/100

Key Research Findings:
${researchOutput.substring(0, 4000)}

Write a 300-400 word EXECUTIVE SUMMARY covering:
1. Key findings and market opportunities
2. Critical success factors
3. Recommended next steps

Do NOT use em dashes.`;

  let report = '';
  try {
    const reportStart = Date.now();
    report = await llm(reportPrompt, 'You are a business analyst. Write a concise executive summary.', {
      temperature: 0.4,
      signal,
    });
    const reportDuration = ((Date.now() - reportStart) / 1000).toFixed(1);

    const cleaned = report.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    console.log(`[REPORT] ✓ Complete (${reportDuration}s)\n`);
    console.log(cleaned);
  } catch (error) {
    console.log(`[REPORT] ✗ Error: ${(error as Error).message}`);
    report = researchOutput;
  }

  // ── FINAL SUMMARY ──
  console.log(`\n${'='.repeat(70)}`);
  console.log('RESEARCH COMPLETE');
  console.log(`${'='.repeat(70)}`);
  console.log(tracker.generateReport());
  console.log(`\nFinal Score: ${evaluation.score}/100`);
  console.log(`${'='.repeat(70)}\n`);

  if (onProgress) onProgress(tracker);

  return {
    finalResult: researchOutput,
    iterations: 1,
    finalScore: evaluation.score,
    tracker,
  };
}
