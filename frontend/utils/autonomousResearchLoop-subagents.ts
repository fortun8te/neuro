/**
 * Autonomous Research Loop — Full Neuro + Parallel Subagents
 *
 * Uses complete agent engine with:
 * - Context-1 semantic routing
 * - Parallel subagent spawning and coordination
 * - Full tool suite (web_search, browse, memory_search, etc.)
 * - Neuro identity integration
 * - Live tool execution logging
 *
 * Pipeline: ORCHESTRATE → PARALLEL RESEARCH → EVALUATE → REPORT
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

// ─── Subagent Types ───

export interface SubagentTask {
  id: string;
  role: string;
  focus: string;
  prompt: string;
  context?: any;
  model?: string;     // Model override (e.g. nemotron for deep roles)
  think?: boolean;    // Enable extended thinking tokens
}

export interface SubagentResult {
  id: string;
  role: string;
  focus: string;
  output: string;
  executionTime: number;
  tokenCount: number;
  success: boolean;
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

// ─── Subagent Spawning ───

/**
 * Create subagent tasks based on research objective
 */
function createSubagentTasks(objective: string, criteria: string[]): SubagentTask[] {
  return [
    {
      id: 'subagent-1-architecture',
      role: 'architect',
      focus: 'Architecture & Structure',
      model: 'nemotron-3-super:120b',
      think: true,
      prompt: `You are a software architect running on a 120B parameter reasoning model. Use extended thinking extensively.

Analyze the following objective:
${objective}

Your task: Analyze the architecture, structure, design patterns, and system organization.
Focus on:
- Core components and their relationships
- Design patterns and architectural decisions
- System structure and organization
- Key abstractions and interfaces
- Coupling/cohesion analysis
- Technical debt identification

Provide detailed technical findings with [CONFIDENCE:0.XX] rating.`,
    },
    {
      id: 'subagent-2-implementation',
      role: 'implementer',
      focus: 'Implementation & Code Details',
      prompt: `You are a code implementation analyst analyzing the following objective:
${objective}

Your task: Analyze implementation details, algorithms, and technical approach.
Focus on:
- Core algorithms and implementations
- Code patterns and conventions
- Data structures and their usage
- Performance characteristics

Provide specific code-level findings.`,
    },
    {
      id: 'subagent-3-security',
      role: 'security',
      focus: 'Security & Risk Analysis',
      model: 'nemotron-3-super:120b',
      think: true,
      prompt: `You are a Security Analyst running on a 120B parameter reasoning model. Use extended thinking to trace attack paths thoroughly.

Analyze the following objective:
${objective}

Your task: Identify security vulnerabilities, risks, and safety considerations.
Focus on:
- Security vulnerabilities (OWASP Top 10)
- Permission and access control issues
- Data handling and privacy concerns
- Attack surfaces and risk vectors
- Injection points (SQL, XSS, command, prompt)
- Secrets management and credential handling

Output format:
[VULNERABILITY: <title>]
Severity: CRITICAL|HIGH|MEDIUM|LOW
Exploitability: trivial|moderate|difficult|theoretical
Description: <detailed explanation>
Mitigation: <recommended fix>

[CONFIDENCE:0.XX]`,
    },
    {
      id: 'subagent-4-research',
      role: 'researcher',
      focus: 'Research & External Context',
      prompt: `You are a research analyst analyzing the following objective:
${objective}

Your task: Find external context, news, reactions, and current information.
Focus on:
- Recent news and announcements
- Community reactions and discussions
- Expert analyses and opinions
- Timeline of related events

Provide current, timely findings from today and recent sources.`,
    },
    {
      id: 'subagent-5-competitive',
      role: 'analyst',
      focus: 'Competitive & Strategic Analysis',
      prompt: `You are a competitive analyst analyzing the following objective:
${objective}

Your task: Analyze competitive landscape, market positioning, and strategic implications.
Focus on:
- Competitive alternatives and comparisons
- Market positioning and differentiation
- Strategic implications and opportunities
- Industry impact and trends

Provide strategic and market-level insights.`,
    },
  ];
}

/**
 * Run a single subagent research task
 */
async function runSubagentTask(
  task: SubagentTask,
  signal: AbortSignal,
  onEvent?: (event: string, data: any) => void
): Promise<SubagentResult> {
  const startTime = Date.now();

  onEvent?.('subagent_start', {
    subagentId: task.id,
    role: task.role,
    focus: task.focus,
    timestamp: Date.now(),
  });

  console.log(`\n  [SUBAGENT] ${task.role.toUpperCase()} — ${task.focus}`);
  process.stdout.write('    Progress: ');

  try {
    let output = '';

    // Use full agent engine with tools (web_search, browse, etc.)
    const agentResult = await runAgentLoop(task.prompt, '', {
      signal,
      onEvent: (event: AgentEngineEvent) => {
        if (event.type === 'tool_start' && event.toolCall) {
          process.stdout.write(`\n      [${task.role}] ${event.toolCall.name}...`);
        }
        if (event.type === 'response_chunk' && event.response) {
          output += event.response;
          process.stdout.write('.');
        }
      },
    });

    // Prefer finalResponse over accumulated chunks
    if (agentResult?.finalResponse && agentResult.finalResponse.length > output.length) {
      output = agentResult.finalResponse;
    }

    const duration = Date.now() - startTime;
    const tokenCount = Math.round(output.length / 4); // Rough estimate

    onEvent?.('subagent_complete', {
      subagentId: task.id,
      role: task.role,
      duration: duration / 1000,
      outputLength: output.length,
      tokenCount,
      timestamp: Date.now(),
    });

    console.log(` ✓ Complete (${(duration / 1000).toFixed(1)}s, ~${tokenCount} tokens)`);

    return {
      id: task.id,
      role: task.role,
      focus: task.focus,
      output,
      executionTime: duration,
      tokenCount,
      success: true,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    onEvent?.('subagent_error', {
      subagentId: task.id,
      role: task.role,
      error: (error as Error).message,
      duration: duration / 1000,
      timestamp: Date.now(),
    });

    console.log(` ✗ Failed: ${(error as Error).message}`);

    return {
      id: task.id,
      role: task.role,
      focus: task.focus,
      output: `[Error: ${(error as Error).message}]`,
      executionTime: duration,
      tokenCount: 0,
      success: false,
    };
  }
}

/**
 * Synthesize subagent results into unified research output
 */
async function synthesizeResults(
  results: SubagentResult[],
  objective: string,
  signal: AbortSignal,
  onEvent?: (event: string, data: any) => void
): Promise<string> {
  console.log('\n  [SYNTHESIS] Consolidating parallel research findings...');

  const resultsText = results
    .map(
      (r) => `
## ${r.role.toUpperCase()} — ${r.focus}

${r.output}
`
    )
    .join('\n');

  const synthesisPrompt = `You are synthesizing research findings from 5 parallel research subagents.

OBJECTIVE:
${objective}

SUBAGENT FINDINGS:
${resultsText}

TASK:
Create a unified, comprehensive research synthesis that:
1. Consolidates all findings into a coherent narrative
2. Eliminates redundancy
3. Identifies connections between findings
4. Highlights the most important discoveries
5. Maintains all critical details and specificity

Write a comprehensive synthesis (800-1200 words) that serves as the main research output.`;

  const synthesisPrompt2 = `Based on all subagent findings above, write the FINAL UNIFIED RESEARCH OUTPUT:

Structure:
- Executive Summary (key findings, critical insights)
- Architecture & Structure (from architect subagent)
- Implementation Details (from implementer subagent)
- Security & Risk Analysis (from security subagent)
- External Context & Events (from researcher subagent)
- Competitive & Strategic Context (from analyst subagent)
- Recommendations & Next Steps

Write with authority, specificity, and actionable insights.`;

  try {
    const synthesis = await llm(synthesisPrompt2, 'You are a research synthesis expert. Create the final unified research output.', {
      model: 'qwen3.5:4b',
      temperature: 0.4,
      signal,
    });

    onEvent?.('synthesis_complete', {
      outputLength: synthesis.length,
      timestamp: Date.now(),
    });

    return synthesis;
  } catch (error) {
    console.log(`\n  [SYNTHESIS] ✗ Error: ${(error as Error).message}`);
    return resultsText; // Fallback to raw results
  }
}

/**
 * Deep Validation Gate — nemotron reviews synthesis for accuracy and completeness
 * Runs AFTER synthesis but BEFORE evaluation scoring
 */
async function deepValidate(
  synthesis: string,
  objective: string,
  signal: AbortSignal,
  onEvent?: (event: string, data: any) => void
): Promise<string> {
  console.log('\n  [DEEP VALIDATION] Nemotron reviewing synthesis for accuracy...');

  const validationPrompt = `You are a senior technical reviewer running on a 120B parameter model with extended thinking.

OBJECTIVE: ${objective}

SYNTHESIS TO VALIDATE:
${synthesis.substring(0, 6000)}

Review this synthesis for:
1. LOGICAL CONSISTENCY — Are claims internally consistent? Any contradictions?
2. EVIDENCE QUALITY — Are findings backed by specific evidence or just assertions?
3. COMPLETENESS — Are there obvious gaps or missing perspectives?
4. ACCURACY — Any claims that seem incorrect or unsubstantiated?
5. ACTIONABILITY — Are recommendations specific enough to act on?

Output format:
[VALIDATION_PASS: <aspect>] — what's solid
[VALIDATION_ISSUE: <aspect>] Severity: HIGH|MEDIUM|LOW — what needs fixing
[VALIDATION_GAP: <topic>] — what's missing entirely
[OVERALL_QUALITY: <1-10>]
[CONFIDENCE:0.XX]`;

  try {
    const validation = await llm(validationPrompt, 'You are a rigorous technical reviewer. Be specific and constructive.', {
      model: 'nemotron-3-super:120b',
      temperature: 0.2,
      signal,
    });

    onEvent?.('deep_validation_complete', {
      outputLength: validation.length,
      timestamp: Date.now(),
    });

    console.log(`  [DEEP VALIDATION] ✓ Complete (${validation.length} chars)`);

    // Append validation notes to synthesis
    return `${synthesis}\n\n---\n## Quality Validation (Nemotron Deep Review)\n${validation}`;
  } catch (error) {
    console.log(`  [DEEP VALIDATION] ✗ Skipped: ${(error as Error).message}`);
    return synthesis; // Return original if validation fails
  }
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
  console.log('AUTONOMOUS RESEARCH — FULL NEURO + PARALLEL SUBAGENTS');
  console.log(`${'='.repeat(70)}`);
  console.log(`Objective: ${task.objective}`);
  console.log(`Evaluation Criteria:`);
  task.evaluationCriteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log(`${'='.repeat(70)}\n`);

  // ── RESEARCH: Parallel Subagents ──
  console.log('[RESEARCH] Deploying 5 parallel research subagents...\n');

  const subagentTasks = createSubagentTasks(task.objective, task.evaluationCriteria);
  const startTime = Date.now();

  // Run all subagents in parallel
  const subagentPromises = subagentTasks.map((task) => runSubagentTask(task, signal, onExecutionEvent));

  const results = await Promise.all(subagentPromises);
  const successCount = results.filter((r) => r.success).length;

  console.log(`\n  [SUBAGENTS] ✓ Complete: ${successCount}/${results.length} successful`);

  // Synthesize results
  let researchOutput = '';
  try {
    researchOutput = await synthesizeResults(results, task.objective, signal, onExecutionEvent);
  } catch (error) {
    console.log(`\n  [SYNTHESIS] ✗ Error: ${(error as Error).message}`);
    // Fallback: concatenate results
    researchOutput = results.map((r) => `## ${r.role.toUpperCase()}\n\n${r.output}`).join('\n\n');
  }

  // Deep validation gate — nemotron reviews synthesis before scoring
  if (researchOutput.length > 200) {
    try {
      researchOutput = await deepValidate(researchOutput, task.objective, signal, onExecutionEvent);
    } catch (error) {
      console.log(`  [DEEP VALIDATION] ✗ Skipped: ${(error as Error).message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[RESEARCH] ✓ Complete (${researchOutput.length} chars, ${duration}s)\n`);

  // Log research completion
  onExecutionEvent?.('research_complete', {
    duration: parseFloat(duration),
    outputLength: researchOutput.length,
    subagentsDeployed: subagentTasks.length,
    subagentsSuccessful: successCount,
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
1. Key findings and opportunities
2. Critical insights and discoveries
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
  console.log(`Subagents Deployed: ${subagentTasks.length}`);
  console.log(`Subagents Successful: ${successCount}`);
  console.log(`${'='.repeat(70)}\n`);

  if (onProgress) onProgress(tracker);

  return {
    finalResult: researchOutput,
    iterations: 1,
    finalScore: evaluation.score,
    tracker,
  };
}
