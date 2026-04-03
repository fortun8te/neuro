#!/usr/bin/env node
/**
 * Neuro Tool-Call Benchmark
 * Tests whether the agent actually calls tools — not fake, not simulated.
 *
 * Usage:
 *   npx tsx benchmark.ts
 *   npx tsx benchmark.ts --model qwen3.5:9b
 *   npx tsx benchmark.ts --save results.json
 */

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
loadDotenv({ path: resolve(process.cwd(), '.env') });

// Browser API shims
if (typeof globalThis.indexedDB === 'undefined') {
  (globalThis as any).indexedDB = {
    open: () => ({ addEventListener: () => {}, onsuccess: null, onerror: null }),
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

import { setupNodeEnvironment } from './frontend/utils/nodeAdapter.ts';
import { runAgentLoop } from './frontend/utils/agentEngine.ts';
import type { AgentEngineEvent } from './frontend/utils/agentEngine.ts';
import { writeFileSync } from 'fs';

setupNodeEnvironment();

const args = process.argv.slice(2);
const MODEL = (() => {
  const i = args.indexOf('--model');
  return i >= 0 ? args[i + 1] : 'qwen3.5:4b';
})();
const SAVE_PATH = (() => {
  const i = args.indexOf('--save');
  return i >= 0 ? args[i + 1] : null;
})();
const VERBOSE = args.includes('--verbose');

// ── Test cases: each requires at least one REAL tool call to pass ─────────────
const TESTS = [
  {
    id: 'shell-date',
    name: 'Shell: current date',
    prompt: "Use shell_exec to run `date +%Y-%m-%d` and tell me today's exact date.",
    requiredTools: ['shell_exec'],
    verify: (response: string, toolsCalled: string[]) => ({
      toolCalled: toolsCalled.includes('shell_exec'),
      hasDate: /\d{4}-\d{2}-\d{2}/.test(response) || /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/.test(response),
    }),
  },
  {
    id: 'shell-calc',
    name: 'Shell: arithmetic via bc',
    prompt: "Use shell_exec to compute 1337 * 42 using the `bc` command and return the exact result.",
    requiredTools: ['shell_exec'],
    verify: (response: string, toolsCalled: string[]) => ({
      toolCalled: toolsCalled.includes('shell_exec'),
      correctAnswer: response.includes('56154') || response.includes('56,154'),
    }),
  },
  {
    id: 'file-write-read',
    name: 'File: write then read',
    prompt: "Use file_write to write the text 'neuro_test_ok' to /tmp/neuro_bench.txt, then use file_read to read it back and confirm the content.",
    requiredTools: ['file_write', 'file_read'],
    verify: (response: string, toolsCalled: string[]) => ({
      wroteFile: toolsCalled.includes('file_write'),
      readFile: toolsCalled.includes('file_read'),
      confirmsContent: response.toLowerCase().includes('neuro_test_ok'),
    }),
  },
  {
    id: 'web-search',
    name: 'Web search: live query',
    prompt: "Use web_search to find the current version of Node.js LTS. Return the version number you found.",
    requiredTools: ['web_search'],
    verify: (response: string, toolsCalled: string[]) => ({
      toolCalled: toolsCalled.includes('web_search'),
      hasVersion: /v?\d+\.\d+\.\d+|\d{2}\.\d+/.test(response),
    }),
  },
  {
    id: 'multi-step',
    name: 'Multi-step: shell + file',
    prompt: "Run `echo hello_neuro > /tmp/neuro_multi.txt` via shell_exec, then read /tmp/neuro_multi.txt using file_read and confirm what it contains.",
    requiredTools: ['shell_exec', 'file_read'],
    verify: (response: string, toolsCalled: string[]) => ({
      usedShell: toolsCalled.includes('shell_exec'),
      usedRead: toolsCalled.includes('file_read'),
      confirmsContent: response.toLowerCase().includes('hello_neuro'),
    }),
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────
function color(code: number, text: string) { return `\x1b[${code}m${text}\x1b[0m`; }
const GREEN = (s: string) => color(32, s);
const RED   = (s: string) => color(31, s);
const YELLOW= (s: string) => color(33, s);
const BOLD  = (s: string) => color(1, s);
const DIM   = (s: string) => color(2, s);

async function runTest(test: typeof TESTS[0]) {
  const toolsCalled: string[] = [];
  const toolResults: Array<{ tool: string; success: boolean; output: string }> = [];
  let finalResponse = '';
  let steps = 0;
  const startMs = Date.now();

  process.stdout.write(`  ${DIM('running...')}\r`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const result = await runAgentLoop(
      test.prompt,
      '', // no conversation history
      {
        model: MODEL,
        maxSteps: 10,
        signal: controller.signal,
        onEvent: (ev: AgentEngineEvent) => {
          if (ev.type === 'tool_start' && ev.toolCall?.name) {
            toolsCalled.push(ev.toolCall.name);
            if (VERBOSE) console.log(`    ${DIM(`→ ${ev.toolCall.name}(${JSON.stringify(ev.toolCall.args || {}).slice(0, 80)}...)`)}`);
          }
          if (ev.type === 'tool_done' && ev.toolCall) {
            toolResults.push({
              tool: ev.toolCall.name,
              success: ev.toolCall.result?.success !== false,
              output: String(ev.toolCall.result?.output || '').slice(0, 200),
            });
          }
          if (ev.type === 'step') steps++;
        },
      },
    );
    finalResponse = result.finalResponse;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      finalResponse = '[TIMEOUT after 60s]';
    } else {
      finalResponse = `[ERROR: ${err?.message || String(err)}]`;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const elapsed = Date.now() - startMs;
  const checks = test.verify(finalResponse, toolsCalled);
  const allPassed = Object.values(checks).every(Boolean);

  return {
    id: test.id,
    name: test.name,
    passed: allPassed,
    elapsed,
    steps,
    toolsCalled,
    checks,
    response: finalResponse.slice(0, 300),
  };
}

async function main() {
  console.log(BOLD('\n╔══════════════════════════════════════════════╗'));
  console.log(BOLD('║     NEURO TOOL-CALL BENCHMARK (real)         ║'));
  console.log(BOLD('╚══════════════════════════════════════════════╝'));
  console.log(`  Model: ${YELLOW(MODEL)}`);
  console.log(`  Tests: ${TESTS.length}`);
  console.log(`  Time:  ${new Date().toISOString()}\n`);

  const results = [];
  let passed = 0;

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    process.stdout.write(`[${i + 1}/${TESTS.length}] ${test.name} `);

    const result = await runTest(test);
    results.push(result);

    if (result.passed) {
      passed++;
      console.log(GREEN('✓ PASS') + DIM(` (${result.elapsed}ms, ${result.steps} steps, tools: ${result.toolsCalled.join(', ') || 'none'})`));
    } else {
      console.log(RED('✗ FAIL'));
      for (const [check, ok] of Object.entries(result.checks)) {
        console.log(`     ${ok ? GREEN('✓') : RED('✗')} ${check}`);
      }
      if (result.toolsCalled.length === 0) {
        console.log(`     ${RED('!')} No tools called — model answered from knowledge instead of executing`);
      }
      if (VERBOSE || !result.passed) {
        console.log(`     Response: ${DIM(result.response.slice(0, 150))}`);
      }
    }
  }

  const total = TESTS.length;
  const pct = Math.round((passed / total) * 100);

  console.log('\n' + BOLD('═══════════════════════════════════════════════'));
  console.log(BOLD(`Results: ${passed}/${total} passed (${pct}%)`));
  console.log(BOLD('═══════════════════════════════════════════════'));

  if (pct === 100) console.log(GREEN('  All tools working correctly'));
  else if (pct >= 60) console.log(YELLOW('  Partial tool usage — check failures above'));
  else console.log(RED('  Tool calling is broken — model is not invoking tools'));

  const report = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    passed,
    total,
    passRate: `${pct}%`,
    results,
  };

  if (SAVE_PATH) {
    writeFileSync(SAVE_PATH, JSON.stringify(report, null, 2));
    console.log(`\n  Saved to ${SAVE_PATH}`);
  }

  console.log('');
  process.exit(passed === total ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
