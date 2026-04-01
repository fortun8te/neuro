#!/usr/bin/env node
/**
 * Neuro CLI Batch Test — Run 50 prompts, save results to ~/Downloads
 * Run: npm run batch
 * Run subset: npm run batch -- --limit 10 --start 0
 * Run category: npm run batch -- --category marketing
 */

import * as fs from 'fs';
import * as path from 'path';
import { setupNodeEnvironment } from './utils/nodeAdapter';

setupNodeEnvironment();

import { runAgentLoop } from './utils/agentEngine';

// ── CLI args ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(flag: string, def: string): string {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
}
const LIMIT   = parseInt(getArg('--limit', '60'));
const START   = parseInt(getArg('--start', '0'));
const FILTER  = getArg('--category', '').toLowerCase();
const TIMEOUT = parseInt(getArg('--timeout', '60')) * 1000;

// ── Spinner ────────────────────────────────────────────────────────────────
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let _spinTimer: ReturnType<typeof setInterval> | null = null;
let _spinFrame = 0;
let _spinMsg = '';

function spin(msg: string) {
  if (_spinTimer) clearInterval(_spinTimer);
  _spinMsg = msg;
  _spinFrame = 0;
  _spinTimer = setInterval(() => {
    process.stdout.write(`\r  ${FRAMES[_spinFrame++ % FRAMES.length]} ${_spinMsg}   `);
  }, 80);
}

function unspin(final?: string) {
  if (_spinTimer) { clearInterval(_spinTimer); _spinTimer = null; }
  process.stdout.write('\r' + ' '.repeat(_spinMsg.length + 8) + '\r');
  if (final) process.stdout.write(final);
}

// ── Prompts ────────────────────────────────────────────────────────────────
interface Prompt {
  id: number;
  category: string;
  prompt: string;
}

const PROMPTS: Prompt[] = [
  // marketing
  { id: 1,  category: 'marketing', prompt: 'Write 3 Facebook ad headlines for a collagen supplement targeting women 35-55.' },
  { id: 2,  category: 'marketing', prompt: 'What are the top purchase objections for premium skincare ($80+ products) and how would you handle each?' },
  { id: 3,  category: 'marketing', prompt: 'Create a VSL hook for a weight loss program that opens with a pattern interrupt.' },
  { id: 4,  category: 'marketing', prompt: 'Write a customer avatar for a DTC men\'s grooming brand (ages 25-40, urban, professional).' },
  { id: 5,  category: 'marketing', prompt: 'List 10 desire-driven ad angles for a productivity app targeting freelancers.' },
  { id: 6,  category: 'marketing', prompt: 'Write a 150-word email subject line test — give 5 options for a Black Friday sale on supplements.' },
  { id: 7,  category: 'marketing', prompt: 'What Meta ad formats work best for DTC brands with AOV over $100? Explain why.' },
  { id: 8,  category: 'marketing', prompt: 'Write 3 UGC-style ad scripts for a sleep supplement — each under 30 seconds.' },
  { id: 9,  category: 'marketing', prompt: 'What is a good CPM benchmark for Meta ads in the health and wellness niche in 2025?' },
  { id: 10, category: 'marketing', prompt: 'Explain the AIDA framework and give an example applied to a DTC home goods brand.' },
  // research
  { id: 11, category: 'research', prompt: 'What are the key differences between Qwen 3, Llama 4, and Gemma 3 model families?' },
  { id: 12, category: 'research', prompt: 'Summarize the state of local LLM inference in 2025 — main tools, tradeoffs, and use cases.' },
  { id: 13, category: 'research', prompt: 'What is Retrieval-Augmented Generation (RAG)? Explain the pipeline step by step.' },
  { id: 14, category: 'research', prompt: 'What are the top trends in AI agents and multi-agent systems right now?' },
  { id: 15, category: 'research', prompt: 'Compare SearXNG vs Brave Search API vs Serper for programmatic web search. Pros and cons of each.' },
  { id: 16, category: 'research', prompt: 'What is the current state of text-to-video AI? Top models and their limitations.' },
  { id: 17, category: 'research', prompt: 'Explain structured outputs / function calling in LLMs and why it matters for agentic systems.' },
  { id: 18, category: 'research', prompt: 'What makes a good system prompt for a ReAct agent? Key elements and common mistakes.' },
  { id: 19, category: 'research', prompt: 'What is the difference between fine-tuning, RLHF, and GRPO for LLM training?' },
  { id: 20, category: 'research', prompt: 'Explain context window management strategies for long-running LLM conversations.' },
  // creative
  { id: 21, category: 'creative', prompt: 'Write a short brand story (150 words) for a sustainable activewear startup.' },
  { id: 22, category: 'creative', prompt: 'Generate 5 taglines for a premium cold brew coffee brand targeting WFH professionals.' },
  { id: 23, category: 'creative', prompt: 'Write a product description for a $350 mechanical keyboard — tone: confident, no filler.' },
  { id: 24, category: 'creative', prompt: 'Invent a brand name, logo concept, and color palette for a mental wellness app.' },
  { id: 25, category: 'creative', prompt: 'Write a landing page headline, subheadline, and CTA for a B2B SaaS onboarding tool.' },
  { id: 26, category: 'creative', prompt: 'Create a 3-email welcome sequence for a DTC pet food brand (premium, health-focused).' },
  { id: 27, category: 'creative', prompt: 'Write 5 short-form video concepts (TikTok/Reels) for a travel gear brand.' },
  { id: 28, category: 'creative', prompt: 'Generate a creative brief for a luxury watch campaign targeting tech founders.' },
  { id: 29, category: 'creative', prompt: 'Write a 90-second podcast ad script for a project management tool.' },
  { id: 30, category: 'creative', prompt: 'Create 3 ad concept directions (visual + copy angle) for a premium dog food brand.' },
  // technical
  { id: 31, category: 'technical', prompt: 'What is the difference between useEffect and useLayoutEffect in React? When should you use each?' },
  { id: 32, category: 'technical', prompt: 'Explain how Vite handles HMR (Hot Module Replacement) compared to Webpack.' },
  { id: 33, category: 'technical', prompt: 'What are the tradeoffs between IndexedDB, localStorage, and SQLite (via WASM) for browser storage?' },
  { id: 34, category: 'technical', prompt: 'Write a TypeScript utility type that makes all nested properties optional (deep partial).' },
  { id: 35, category: 'technical', prompt: 'What is the React 19 compiler and how does it change the mental model for performance optimization?' },
  { id: 36, category: 'technical', prompt: 'Explain Tailwind CSS v4\'s new architecture vs v3 — key changes for developers.' },
  { id: 37, category: 'technical', prompt: 'How do you implement streaming SSE responses in FastAPI? Give a minimal working example.' },
  { id: 38, category: 'technical', prompt: 'What is the Playwright MCP server and how can it be used in agentic browser automation?' },
  { id: 39, category: 'technical', prompt: 'Explain the actor model for concurrent systems and how it applies to AI agent architectures.' },
  { id: 40, category: 'technical', prompt: 'What are the key differences between REST, GraphQL, and tRPC for a React + TypeScript app?' },
  // strategy
  { id: 41, category: 'strategy', prompt: 'A DTC brand is doing $50K/month on Meta ads with 2.5x ROAS. What should they focus on to scale to $200K/month?' },
  { id: 42, category: 'strategy', prompt: 'What is the Jobs-to-be-Done framework and how does it apply to product positioning?' },
  { id: 43, category: 'strategy', prompt: 'A B2B SaaS has 30% monthly churn. What are the most likely root causes and how do you diagnose them?' },
  { id: 44, category: 'strategy', prompt: 'Explain the flywheel model and give 3 examples of companies that use it effectively.' },
  { id: 45, category: 'strategy', prompt: 'What are the key metrics for measuring creative performance on Meta ads? How do you identify a winning creative?' },
  { id: 46, category: 'strategy', prompt: 'How do you build a media buying testing framework for a new DTC brand with $10K/month ad budget?' },
  { id: 47, category: 'strategy', prompt: 'What is market positioning and how does it differ from marketing messaging? Give a concrete example.' },
  { id: 48, category: 'strategy', prompt: 'Explain the PMF (product-market fit) indicators and how you know when you\'ve achieved it.' },
  { id: 49, category: 'strategy', prompt: 'What are the pros and cons of influencer marketing vs paid social for a new DTC health brand?' },
  { id: 50, category: 'strategy', prompt: 'How do you identify and validate a blue ocean opportunity in a crowded DTC market?' },
  // deep reasoning — these trigger nemotron 120B routing
  { id: 51, category: 'deep', prompt: 'Perform a security audit of a Node.js REST API. What are the OWASP Top 10 vulnerabilities to check and how do you identify each?' },
  { id: 52, category: 'deep', prompt: 'Do an architecture review of a React + TypeScript SPA with Vite. What design patterns, coupling issues, and technical debt should I look for?' },
  { id: 53, category: 'deep', prompt: 'Conduct a codebase analysis of a Python FastAPI service. What refactor strategy would you recommend for a 10K LOC codebase with mixed concerns?' },
  { id: 54, category: 'deep', prompt: 'Perform a threat model for a SaaS product that stores user PII, payment data, and API keys. What are the attack surfaces?' },
  { id: 55, category: 'deep', prompt: 'Do a deep dive code review of a React context + hooks state management pattern. What are the performance pitfalls and how do you fix them?' },
  { id: 56, category: 'deep', prompt: 'Architecture analysis: how should a monolith be decomposed into services? Give a dependency graph methodology and service boundary strategy.' },
  { id: 57, category: 'deep', prompt: 'Security review: what XSS, CSRF, and injection vulnerabilities exist in a web app that accepts user-generated content and renders it in the DOM?' },
  { id: 58, category: 'deep', prompt: 'Technical debt assessment: what metrics and patterns indicate a codebase has high technical debt and what is a phased refactor strategy?' },
  { id: 59, category: 'deep', prompt: 'Code reasoning: explain how React reconciliation and the fiber architecture work under the hood, and where performance bottlenecks emerge.' },
  { id: 60, category: 'deep', prompt: 'Deep analysis: compare the security architecture of OAuth 2.0, PKCE, and session-based auth. Which is most appropriate for a mobile + web SPA and why?' },
];

// ── Result type ────────────────────────────────────────────────────────────
interface Result {
  id: number;
  category: string;
  prompt: string;
  response: string;
  tokensEstimate: number;
  durationMs: number;
  status: 'ok' | 'error' | 'timeout';
  error?: string;
}

// ── Output dir ─────────────────────────────────────────────────────────────
const downloadsDir = path.join(process.env.HOME || '/tmp', 'Downloads');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(downloadsDir, `neuro-batch-${timestamp}`);
fs.mkdirSync(outDir, { recursive: true });

// ── Run single prompt ──────────────────────────────────────────────────────
async function runPrompt(p: Prompt): Promise<Result> {
  const start = Date.now();
  let response = '';
  let tokensEstimate = 0;
  let status: Result['status'] = 'ok';
  let error: string | undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    await runAgentLoop(p.prompt, '', {
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'response_chunk' && event.response) {
          response += event.response;
        }
        if (event.type === 'done' && (event as any).response) {
          response = (event as any).response;
        }
        if (event.type === 'response_done' && (event as any).tokens) {
          const t = (event as any).tokens;
          tokensEstimate = (t.input || 0) + (t.output || 0);
        }
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      status = 'timeout';
      error = `timeout after ${TIMEOUT / 1000}s`;
    } else {
      status = 'error';
      error = err?.message || String(err);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response) response = '[no response]';

  return {
    id: p.id,
    category: p.category,
    prompt: p.prompt,
    response,
    tokensEstimate,
    durationMs: Date.now() - start,
    status,
    error,
  };
}

// ── Save individual result ─────────────────────────────────────────────────
function saveResult(r: Result) {
  const name = `${String(r.id).padStart(2, '0')}-${r.category}-${r.prompt.substring(0, 30).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
  const content = [
    `ID: ${r.id}`,
    `Category: ${r.category}`,
    `Status: ${r.status}`,
    `Duration: ${(r.durationMs / 1000).toFixed(1)}s`,
    `Tokens (est): ${r.tokensEstimate}`,
    '',
    'PROMPT',
    '──────',
    r.prompt,
    '',
    'RESPONSE',
    '────────',
    r.response,
    r.error ? `\nERROR: ${r.error}` : '',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, `${name}.txt`), content, 'utf-8');
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // Filter and slice
  let prompts = PROMPTS;
  if (FILTER) prompts = prompts.filter((p) => p.category === FILTER);
  prompts = prompts.slice(START, START + LIMIT);

  const total = prompts.length;

  process.stdout.write('\n  NEURO  batch test\n');
  process.stdout.write('  ' + '─'.repeat(50) + '\n');
  process.stdout.write(`  prompts: ${total}  timeout: ${TIMEOUT / 1000}s\n`);
  process.stdout.write(`  output:  ${outDir}\n\n`);

  const results: Result[] = [];
  let passed = 0, failed = 0, timedOut = 0;
  const batchStart = Date.now();

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    const label = `[${String(i + 1).padStart(2, '0')}/${total}] ${p.category}  ${p.prompt.substring(0, 45)}${p.prompt.length > 45 ? '...' : ''}`;

    spin(label);

    const result = await runPrompt(p);
    saveResult(result);
    results.push(result);

    const dur = (result.durationMs / 1000).toFixed(1);
    const mark = result.status === 'ok' ? 'ok' : result.status === 'timeout' ? 'timeout' : 'fail';

    unspin(`  [${String(i + 1).padStart(2, '0')}/${total}] ${mark.padEnd(8)} ${dur}s  ${p.category}  ${p.prompt.substring(0, 42)}${p.prompt.length > 42 ? '...' : ''}\n`);

    if (result.status === 'ok') passed++;
    else if (result.status === 'timeout') timedOut++;
    else failed++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - batchStart) / 1000).toFixed(0);
  const avgDur = (results.reduce((s, r) => s + r.durationMs, 0) / results.length / 1000).toFixed(1);
  const totalTokens = results.reduce((s, r) => s + r.tokensEstimate, 0);

  process.stdout.write('\n  ' + '─'.repeat(50) + '\n');
  process.stdout.write(`  done in ${elapsed}s  avg: ${avgDur}s/prompt\n`);
  process.stdout.write(`  ok:${passed}  fail:${failed}  timeout:${timedOut}  tokens:${totalTokens}\n\n`);

  // Category breakdown
  const cats = [...new Set(results.map((r) => r.category))];
  for (const cat of cats) {
    const catResults = results.filter((r) => r.category === cat);
    const catOk = catResults.filter((r) => r.status === 'ok').length;
    process.stdout.write(`  ${cat.padEnd(12)} ${catOk}/${catResults.length} ok\n`);
  }

  // Save batch summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed,
    timedOut,
    elapsedSeconds: parseInt(elapsed),
    avgDurationSeconds: parseFloat(avgDur),
    totalTokensEstimate: totalTokens,
    outputDir: outDir,
    results: results.map((r) => ({
      id: r.id,
      category: r.category,
      prompt: r.prompt,
      status: r.status,
      durationMs: r.durationMs,
      tokensEstimate: r.tokensEstimate,
      responseLength: r.response.length,
      error: r.error,
    })),
  };

  const summaryPath = path.join(outDir, '00-SUMMARY.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  // Save readable summary
  const lines = [
    'NEURO BATCH TEST SUMMARY',
    '========================',
    '',
    `Date:     ${new Date().toISOString()}`,
    `Total:    ${total}`,
    `OK:       ${passed}`,
    `Failed:   ${failed}`,
    `Timeout:  ${timedOut}`,
    `Elapsed:  ${elapsed}s`,
    `Avg/prompt: ${avgDur}s`,
    `Tokens (est): ${totalTokens}`,
    '',
    'RESULTS',
    '-------',
    '',
    ...results.map(
      (r) =>
        `[${String(r.id).padStart(2, '0')}] ${r.status.padEnd(8)} ${(r.durationMs / 1000).toFixed(1).padStart(5)}s  ${r.category.padEnd(12)} ${r.prompt.substring(0, 50)}`
    ),
    '',
    `Full results: ${outDir}`,
  ];

  fs.writeFileSync(path.join(outDir, '00-SUMMARY.txt'), lines.join('\n'), 'utf-8');

  process.stdout.write(`\n  results -> ${outDir}\n\n`);
}

main().catch((err) => {
  unspin();
  console.error('fatal:', err);
  process.exit(1);
});
