#!/usr/bin/env node
/**
 * Neuro CLI - Terminal agent interface
 * Run: npm run cli
 */

// ── Load .env so VITE_* vars are available via process.env in Node/CLI mode ─
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
loadDotenv({ path: resolve(process.cwd(), '.env') });

// ── Browser API shims (MUST run before any module imports that use them) ────
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

import * as readline from 'readline';
import { setupNodeEnvironment } from './utils/nodeAdapter';
import { runAgentLoop, _pendingPatches } from './utils/agentEngine';
import type { AgentEngineEvent } from './utils/agentEngine';
import { vramManager } from './utils/vramManager';
import { applyPatch, renderPatchPreview } from './utils/applyPatch';
import type { PatchHunk } from './utils/applyPatch';
import { cliCanvas } from './utils/cliCanvas';
import type { DocumentVersion } from './utils/cliCanvas';

// ── CLI Fixes: Health checks, logging, state persistence, benchmarking ────────
import { runHealthCheckCLI } from './cli/cliHealthCheck';
import { runInfrastructureTestCLI } from './cli/cliInfrastructureTest';
import { runModelSwitchTestCLI } from './cli/cliModelSwitchTest';
import { runBenchmarkCLI } from './cli/architectureBenchmark';
import { runParallelizationTestCLI } from './cli/cliParallelizationTest';
import { initLogger, closeLogger, getLogPath, log as logEntry } from './cli/cliLogger';
import * as cliState from './cli/cliState';
import * as cliTasks from './cli/cliTaskManager';
import * as cliRemote from './cli/cliRemoteResearch';

setupNodeEnvironment();

// ── Quick event logger ────────────────────────────────────────────────────────
function logEvent(type: string, data: Record<string, any>): void {
  try {
    logEntry(type, data);
  } catch (error) {
    // Silent fail for logging errors
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── CLI State ────────────────────────────────────────────────────────────────
interface CLIState {
  model: string;
  mode: string;
  tokens: number;
  canvasPending: number;
}

let currentState: CLIState = {
  model: 'qwen3.5:9b',
  mode: 'bypass',
  tokens: 0,
  canvasPending: 0,
};

// ── Canvas state (Codex patch queue) ────────────────────────────────────────
interface CanvasState {
  pendingPatches: PatchHunk[];
  appliedPatches: PatchHunk[];
  rejectedPatches: PatchHunk[];
}
const canvasState: CanvasState = {
  pendingPatches: [],
  appliedPatches: [],
  rejectedPatches: [],
};

// ── Document state (CLI canvas documents) ────────────────────────────────────
interface DocumentState {
  currentDocument: string;
  currentTitle: string;
  currentWordCount: number;
  generatedAt?: number;
  versions: DocumentVersion[];
}
const documentState: DocumentState = {
  currentDocument: '',
  currentTitle: '',
  currentWordCount: 0,
  versions: [],
};

// ── Simple Header (one-liner printed to stdout) ────────────────────────────
function printHeader(state: CLIState) {
  const canvasPart = state.canvasPending > 0 ? ` | canvas:${state.canvasPending}` : '';
  process.stdout.write(`  model: ${state.model}  |  mode: ${state.mode}  |  tokens: ${state.tokens}${canvasPart}\n`);
}

// ── Shimmer Animation (simple inline spinner) ────────────────────────────────
const SHIMMER_CHARS = ['\u28fe', '\u28fd', '\u28fb', '\u287f', '\u283f', '\u28df', '\u28ef', '\u28f7'];
let shimmerIdx = 0;
let spinInterval: ReturnType<typeof setInterval> | null = null;
let spinnerActive = false;

// Batch/pipe mode: suppress spinners when stdin is not a TTY (piped input)
const isBatchMode = !process.stdin.isTTY;

function startShimmer(label: string) {
  if (isBatchMode) return; // no spinners in pipe/batch mode
  if (spinnerActive) stopShimmer();
  spinnerActive = true;
  shimmerIdx = 0;
  // Inline spinner on same line
  process.stdout.write(`  ${SHIMMER_CHARS[0]} ${label} `);

  spinInterval = setInterval(() => {
    const char = SHIMMER_CHARS[shimmerIdx++ % SHIMMER_CHARS.length];
    process.stdout.write(`\r  ${char} ${label} `);
  }, 80);
}

function stopShimmer(finalMsg?: string) {
  if (spinInterval) {
    clearInterval(spinInterval);
    spinInterval = null;
  }
  spinnerActive = false;
  if (isBatchMode) return; // no cursor/line manipulation in pipe mode
  process.stdout.write('\r'); // clear spinner line
  if (finalMsg) process.stdout.write(finalMsg);
}

// ── 3-tier route classifier ──────────────────────────────────────────────────
const DIRECT_PATTERNS = /^(hi|hello|hey|thanks|what('s| is) ([\d+\-*/.() ]+)|calculate |how are|good (morning|afternoon|evening))/i;
const DEEP_PATTERNS = /\b(research|analyze|investigate|deep dive|find all|scrape|build|implement|create .+system|write .+app)\b/i;

function classifyRoute(msg: string): 'direct' | 'tool' | 'deep' {
  if (DIRECT_PATTERNS.test(msg)) return 'direct';
  if (DEEP_PATTERNS.test(msg)) return 'deep';
  return 'tool';
}

// ── Banner (startup with Neuro wordmark) ─────────────────────────────────────
function printBanner() {
  process.stdout.write('\n');
  process.stdout.write('  ╔═══════════════════════════════════════╗\n');
  process.stdout.write('  ║                                       ║\n');
  process.stdout.write('  ║      🧠  N E U R O   v0.4  🧠       ║\n');
  process.stdout.write('  ║                                       ║\n');
  process.stdout.write('  ║   Autonomous Research + Creative      ║\n');
  process.stdout.write('  ║   Multi-Agent ReAct Loop              ║\n');
  process.stdout.write('  ║                                       ║\n');
  process.stdout.write('  ╚═══════════════════════════════════════╝\n');
  process.stdout.write('\n');
  printHeader(currentState);
  process.stdout.write('\n');
  process.stdout.write('  Commands: exit / clear / help / /canvas / /doc [prompt] / [message]\n\n');
}

// ── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  process.stdout.write('\n');
  process.stdout.write('  ╔════════════════════════════════════════════════════════════════╗\n');
  process.stdout.write('  ║                     NEURO CLI — Agent Interface                ║\n');
  process.stdout.write('  ╚════════════════════════════════════════════════════════════════╝\n');
  process.stdout.write('\n');
  process.stdout.write('  Chat & Agent:\n');
  process.stdout.write('    Just type anything → Agent responds with reasoning & tools\n');
  process.stdout.write('    Supported: research, coding, analysis, data scraping, generation\n');
  process.stdout.write('\n');
  process.stdout.write('  Research (AI-Powered, 10+ hours):\n');
  process.stdout.write('    /research on "Topic"               Start live 10-hour research with live logs\n');
  process.stdout.write('    /research watch <task-id>          Monitor research progress in real-time\n');
  process.stdout.write('    /research list                      List all research tasks\n');
  process.stdout.write('\n');
  process.stdout.write('  Long-Running Tasks (crash recovery, 10+ hours):\n');
  process.stdout.write('    /task create "Title" [description]  Create a new task\n');
  process.stdout.write('    /task list                          List all tasks\n');
  process.stdout.write('    /task start <id>                    Start/execute a task\n');
  process.stdout.write('    /task pause <id>                    Pause running task\n');
  process.stdout.write('    /task resume <id>                   Resume paused task\n');
  process.stdout.write('    /task view <id>                     View task details\n');
  process.stdout.write('    /task delete <id>                   Delete a task\n');
  process.stdout.write('\n');
  process.stdout.write('  Document Generation:\n');
  process.stdout.write('    /doc [prompt]     Generate a document\n');
  process.stdout.write('    /show             Display current document\n');
  process.stdout.write('    /save             Save document to file\n');
  process.stdout.write('    /versions         List document versions\n');
  process.stdout.write('\n');
  process.stdout.write('  Code & Canvas:\n');
  process.stdout.write('    /canvas           Show pending code patches\n');
  process.stdout.write('    /canvas apply     Apply patches with approval\n');
  process.stdout.write('    /canvas reset     Discard all patches\n');
  process.stdout.write('\n');
  process.stdout.write('  System & Debug:\n');
  process.stdout.write('    /status           Show system status & token usage\n');
  process.stdout.write('    /model [name]     Switch LLM model\n');
  process.stdout.write('    /clear            Clear chat history\n');
  process.stdout.write('    /exit             Quit the CLI\n');
  process.stdout.write('    /help             Show this help message\n');
  process.stdout.write('\n');
  process.stdout.write('  🚀 Command-line Flags:\n');
  process.stdout.write('    --health/-h       Run service health checks\n');
  process.stdout.write('    --benchmark/-b    Run architecture benchmark (6 tests)\n');
  process.stdout.write('    --parallel/-p     Test parallelization performance\n');
  process.stdout.write('    --debug/-d        Verbose output (tools, tokens, timing)\n');
  process.stdout.write('    --infra/-i        Test infrastructure (Ollama, Wayfarer, SearXNG)\n');
  process.stdout.write('    --ws              Start WebSocket server (port 8890)\n');
  process.stdout.write('\n');
  process.stdout.write('  🌍 Environment:\n');
  process.stdout.write('    VITE_INFRASTRUCTURE_MODE=local|remote  (default: local)\n');
  process.stdout.write('    DEBUG=*                                Enable debug logging\n');
  process.stdout.write('    VITE_OLLAMA_URL                        Custom Ollama endpoint\n');
  process.stdout.write('\n');
  process.stdout.write('  💡 Tips:\n');
  process.stdout.write('    • Ask for research: "research the market for AI agents"\n');
  process.stdout.write('    • Ask for code: "write a React component for authentication"\n');
  process.stdout.write('    • Generate documents: /doc write a blog post about web3\n');
  process.stdout.write('    • Check status: /status\n');
  process.stdout.write('\n');
}

// ── Event display (verbose, always show important info) ────────────────────
let thinkingTokenCount = 0;
let streamedChunks = false; // tracks whether response_chunk already streamed text

function displayEvent(event: AgentEngineEvent, debugMode: boolean) {
  switch (event.type) {
    case 'routing':
      if (event.routing) {
        const isNemo = event.routing.decision.includes('nemotron') || (event.routing.model || '').includes('nemotron');
        if (isNemo) {
          process.stdout.write(`  [route decision]  deep reasoning -> nemotron 120B\n`);
        } else {
          // Always show route decision (not just debug mode)
          process.stdout.write(`  [route decision]  ${event.routing.phase} -> ${event.routing.decision}\n`);
          if (event.routing.tools?.length) {
            process.stdout.write(`  [tools selected]  ${event.routing.tools.join(', ')}\n`);
          }
        }
        // Log routing decision to JSONL
        logEvent('routing_decision', {
          phase: event.routing.phase,
          decision: event.routing.decision,
          model: event.routing.model,
          toolsSelected: event.routing.tools?.length || 0,
        });
      }
      break;

    case 'tool_start':
      if (event.toolCall) {
        const params = (event.toolCall as any).input ? JSON.stringify((event.toolCall as any).input).substring(0, 100) : '';
        startShimmer(`${event.toolCall.name}${params ? ` ${params}` : ''}`);
      }
      break;

    case 'tool_done':
      if (event.toolCall) {
        const ok = event.toolCall.result?.success !== false;
        const status = ok ? 'ok' : 'fail';
        // Internal tools (plan, think, mark_step) — suppress output unless debug mode
        const INTERNAL_TOOLS = new Set(['plan', 'think', 'mark_step']);
        const isInternal = INTERNAL_TOOLS.has(event.toolCall.name);
        stopShimmer(`  [tool] ${event.toolCall.name}  ${status}\n`);
        // Show tool output unless it's an internal tool (suppress raw JSON noise)
        if (event.toolCall.result?.output && (!isInternal || debugMode)) {
          const out = String(event.toolCall.result.output);
          if (out.length > 5000) {
            process.stdout.write(`         ${out.substring(0, 500).replace(/\n/g, ' ')}... [${out.length} total chars]\n`);
          } else if (out.length > 0) {
            process.stdout.write(`         ${out.replace(/\n/g, ' ')}\n`);
          }
        }
        // Log tool call to JSONL
        logEvent('tool_call', {
          tool: event.toolCall.name,
          status,
          input: (event.toolCall as any).input,
          hasOutput: !!event.toolCall.result?.output,
        });
      }
      break;

    case 'tool_error':
      stopShimmer(`  [tool-error] ${(event as any).error || 'unknown'}\n`);
      break;

    case 'thinking_start': {
      thinkingTokenCount = 0;
      const thinkModel = (event as any).model as string | undefined;
      const isDeep = thinkModel?.includes('nemotron') || thinkModel?.includes('120b');
      startShimmer(isDeep ? 'deep reasoning  [nemotron 120B]' : 'thinking...');
      break;
    }

    case 'thinking_chunk':
      thinkingTokenCount++;
      // Update shimmer inline to show token count (every 10 tokens)
      if (!isBatchMode && thinkingTokenCount % 10 === 0) {
        process.stdout.write(`\r  thinking... [${thinkingTokenCount} tokens] `);
      }
      break;

    case 'thinking_done':
      stopShimmer(`  [thinking] ${thinkingTokenCount} tokens\n`);
      break;

    case 'response_start': {
      const mdl = (event as any).model as string | undefined;
      if (mdl) {
        currentState.model = mdl;
      }
      // Always show model
      process.stdout.write(`  [model: ${mdl || currentState.model}]\n`);
      process.stdout.write('\n');
      streamedChunks = false; // reset for new response
      break;
    }

    case 'response_chunk':
      if (event.response) {
        process.stdout.write(event.response);
        streamedChunks = true;
      }
      break;

    case 'response_done':
      process.stdout.write('\n');
      // Don't re-emit response text — it was already streamed via response_chunk.
      // Just update token counts.
      if ((event as any).tokens) {
        const t = (event as any).tokens;
        currentState.tokens += (t.input || 0) + (t.output || 0);
        process.stdout.write(`  [tokens] in:${t.input}  out:${t.output}\n`);
        // Log response completion
        logEvent('response_complete', {
          inputTokens: t.input || 0,
          outputTokens: t.output || 0,
        });
      } else if (event.response && !streamedChunks) {
        // Only estimate tokens if we didn't already stream (fallback path)
        const estimated = Math.round(event.response.split(/\s+/).filter(Boolean).length * 1.3);
        currentState.tokens += estimated;
        process.stdout.write(`  [tokens] ~${estimated} estimated\n`);
        logEvent('response_complete', { estimatedTokens: estimated });
      } else if (event.response) {
        // Already streamed — still count tokens but don't re-display
        const estimated = Math.round(event.response.split(/\s+/).filter(Boolean).length * 1.3);
        currentState.tokens += estimated;
        process.stdout.write(`  [tokens] ~${estimated} estimated\n`);
        logEvent('response_complete', { estimatedTokens: estimated });
      }
      streamedChunks = false;
      break;

    case 'step_complete':
      // Always show step completion with timing
      if ((event as any).stepName) {
        const timing = (event as any).timingMs || 0;
        process.stdout.write(`  [step] ${(event as any).stepName}  ${timing}ms\n`);
      }
      break;

    case 'subagent_spawn':
      process.stdout.write(`  [spawn] ${(event as any).role || 'agent'}  ${((event as any).task || '').substring(0, 80)}\n`);
      break;

    case 'subagent_progress':
      process.stdout.write(`  [subagent progress] ${(event as any).message || ''}\n`);
      break;

    case 'subagent_complete':
      process.stdout.write(`  [subagent done] ${(event as any).agentId || ''}\n`);
      break;

    case 'subagent_failed':
      process.stdout.write(`  [subagent fail] ${(event as any).agentId || ''}  ${(event as any).error || ''}\n`);
      break;

    case 'context_compressed':
      // Always show compression ratio
      if ((event as any).originalSize) {
        const ratio = (((event as any).compressedSize / (event as any).originalSize) * 100).toFixed(0);
        process.stdout.write(`  [compress] ${(event as any).originalSize} -> ${(event as any).compressedSize} chars (${ratio}%)\n`);
      }
      break;

    case 'task_progress':
      if (!isBatchMode && (event as any).percent !== undefined) {
        process.stdout.write(`\r  ${(event as any).percent}%  ${(event as any).message || ''}   `);
      }
      break;

    case 'done':
      stopShimmer();
      // Response is already shown via response_start/response_chunk/response_done events.
      // Only show summary if no response was emitted (fallback).
      if (!event.response && (event as any).summary) {
        process.stdout.write(`  [done] ${(event as any).summary}\n`);
      }
      break;

    case 'error':
      stopShimmer();
      if (event.error) {
        process.stdout.write(`\n  [error] ${event.error}\n`);
        if (debugMode && (event as any).stack) {
          process.stdout.write((event as any).stack + '\n');
        }
      }
      break;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const debugMode =
    process.env.DEBUG === '*' ||
    process.env.DEBUG === 'neuro' ||
    args.includes('--debug') ||
    args.includes('-d');

  // ── Benchmark mode: Run tests and exit ────────────────────────────────────
  if (args.includes('--benchmark') || args.includes('-b')) {
    try {
      const logPath = initLogger();
      process.stdout.write(`\n  [logger] Initialized at ${logPath}\n`);

      await runBenchmarkCLI();
      await closeLogger();
      process.exit(0);
    } catch (error) {
      console.error('Benchmark failed:', error);
      await closeLogger();
      process.exit(1);
    }
  }

  // ── Health check mode: Run checks and exit ────────────────────────────────
  if (args.includes('--health') || args.includes('-h')) {
    try {
      const healthy = await runHealthCheckCLI();
      process.exit(healthy ? 0 : 1);
    } catch (error) {
      console.error('Health check failed:', error);
      process.exit(1);
    }
  }

  // ── Parallelization test mode: Test parallel execution and exit ─────────────
  if (args.includes('--parallel') || args.includes('-p')) {
    try {
      await runParallelizationTestCLI();
      process.exit(0);
    } catch (error) {
      console.error('Parallelization test failed:', error);
      process.exit(1);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const wsMode = args.includes('--ws');
  if (wsMode) {
    const { startWebSocketServer } = await import('./utils/webServer');
    startWebSocketServer();
  }

  // ── Initialize CLI logger and state ───────────────────────────────────────
  const logPath = initLogger();
  let executionState = await cliState.loadState();
  if (!executionState) {
    executionState = cliState.createState();
  }

  if (debugMode) {
    process.stdout.write(`  [state] Loaded session: ${executionState.sessionId.substring(0, 20)}...\n`);
    process.stdout.write(`  [logger] Initialized at ${logPath}\n\n`);
  }

  const conversationHistory: Message[] = [];

  if (!isBatchMode) {
    printBanner();
    if (debugMode) process.stdout.write('  [debug mode]\n\n');
  }

  // Start VRAM keep-alive loop — keeps models warm between messages
  // Only in browser/remote mode; in CLI the preload URL is wrong before dotenv runs
  if (typeof window !== 'undefined') {
    vramManager.startKeepAlive();
  }

  // Start task heartbeat system for crash recovery
  (async () => {
    try {
      const { startHeartbeat } = await import('./utils/taskExecutor');
      await startHeartbeat();
      if (debugMode) {
        process.stdout.write('  [tasks] Heartbeat monitoring started\n');
      }
    } catch (e) {
      // Non-fatal if heartbeat fails
      console.warn('Warning: Could not start task heartbeat:', e);
    }
  })();

  // In piped/non-interactive mode, stdin closes right after delivering input.
  // Track that so we exit cleanly after processing completes (not before).
  let stdinClosed = false;

  const ask = () => {
    // If stdin already closed (piped mode — input fully consumed), exit after last response
    if (stdinClosed) {
      process.exit(0);
    }

    // Sync any new patches queued by the engine before showing prompt
    while (_pendingPatches.length > 0) {
      canvasState.pendingPatches.push(_pendingPatches.shift()!);
    }
    // Keep currentState in sync with canvasState
    currentState.canvasPending = canvasState.pendingPatches.length;

    // Build intelligent prompt with context
    const parts: string[] = [];
    if (canvasState.pendingPatches.length > 0) {
      parts.push(`canvas:${canvasState.pendingPatches.length}`);
    }
    if (conversationHistory.length > 0) {
      const msgCount = Math.ceil(conversationHistory.length / 2);
      parts.push(`msgs:${msgCount}`);
    }
    if (currentState.tokens > 0) {
      parts.push(`tokens:${currentState.tokens}`);
    }

    const contextPart = parts.length > 0 ? `[${parts.join(' ')}] ` : '';
    const prompt = `${contextPart}» `;

    rl.question(prompt, async (input) => {
      const userInput = input.trim();

      // JSON Task Mode: detect if input is JSON (for programmatic benchmark execution)
      if (userInput.startsWith('{')) {
        try {
          const task = JSON.parse(userInput);
          if (task.id && (task.pillar || task.type)) {
            // Valid task object — execute directly through agent loop
            const taskPrompt = task.prompt || '';
            conversationHistory.push({ role: 'user', content: taskPrompt });

            try {
              const result = await runAgentLoop(taskPrompt, '', {
                signal: new AbortController().signal,
                skipSemanticRouting: true,
                batchMode: true,
                onEvent: () => {}, // suppress console output in batch mode
              });

              // Output structured JSON result
              const taskResult = {
                task_id: task.id,
                status: 'completed',
                result: result.finalResponse || '',
                tool_calls: result.steps?.filter(s => s.toolCall).length || 0,
                tokens_used: 0, // not tracked per-step in AgentStep/ToolResult yet
              };
              process.stdout.write(JSON.stringify(taskResult) + '\n');
              ask();
              return;
            } catch (error) {
              const taskResult = {
                task_id: task.id,
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
              };
              process.stdout.write(JSON.stringify(taskResult) + '\n');
              ask();
              return;
            }
          }
        } catch (parseError) {
          // Not valid JSON, treat as regular input
        }
      }

      if (userInput.toLowerCase() === 'exit') {
        // Save state before exiting
        (async () => {
          await cliState.saveState(executionState);
          await closeLogger();
          rl.close();
          process.exit(0);
        })();
        return;
      }

      if (userInput.toLowerCase() === 'clear') {
        conversationHistory.length = 0;
        process.stdout.write('  cleared\n\n');
        ask();
        return;
      }

      if (userInput.toLowerCase() === 'help' || userInput.toLowerCase() === '/help') {
        printHelp();
        ask();
        return;
      }

      if (userInput.toLowerCase() === '/status') {
        process.stdout.write('\n  ┌─ System Status ────────────────────────────────────┐\n');
        process.stdout.write(`  │ Model:        ${currentState.model.padEnd(36)} │\n`);
        process.stdout.write(`  │ Tokens used:  ${currentState.tokens.toString().padEnd(36)} │\n`);
        process.stdout.write(`  │ Mode:         ${currentState.mode.padEnd(36)} │\n`);
        process.stdout.write(`  │ Patches:      ${canvasState.pendingPatches.length} pending, ${canvasState.appliedPatches.length} applied, ${canvasState.rejectedPatches.length} rejected │\n`);
        process.stdout.write(`  │ Chat history: ${conversationHistory.length} messages                           │\n`);
        process.stdout.write('  └────────────────────────────────────────────────────┘\n\n');
        ask();
        return;
      }

      if (userInput.toLowerCase().startsWith('/model')) {
        const modelName = userInput.slice(6).trim();
        if (!modelName) {
          process.stdout.write('  Available models:\n');
          process.stdout.write('    qwen3.5:0.8b   - Fast, 530MB (compression, extraction)\n');
          process.stdout.write('    qwen3.5:2b     - Small, 1.5GB (synthesis, archiving)\n');
          process.stdout.write('    qwen3.5:4b     - Medium, 2.8GB (orchestration, analysis)\n');
          process.stdout.write('    qwen3.5:9b     - Large, 6.6GB (council, chat, generation)\n');
          process.stdout.write('    qwen3.5:27b    - XL, 18GB (deep creative work)\n');
          process.stdout.write('    gpt-oss-20b    - Resident, 13GB (agent, file, executor)\n\n');
          process.stdout.write('  Usage: /model qwen3.5:9b\n\n');
          ask();
          return;
        }
        currentState.model = modelName;
        process.stdout.write(`  Switched to: ${modelName}\n\n`);
        ask();
        return;
      }

      // Sync pending patches from the engine's module-level queue into canvasState
      while (_pendingPatches.length > 0) {
        canvasState.pendingPatches.push(_pendingPatches.shift()!);
      }

      if (userInput.toLowerCase() === '/canvas') {
        // Show pending patches summary + previews
        const pending = canvasState.pendingPatches;
        if (pending.length === 0) {
          process.stdout.write('  [canvas] No pending patches.\n\n');
        } else {
          process.stdout.write(`\n  [canvas] ${pending.length} pending patch(es):\n\n`);
          for (let idx = 0; idx < pending.length; idx++) {
            process.stdout.write(`  --- Patch ${idx + 1} ---\n`);
            process.stdout.write(renderPatchPreview(pending[idx]));
          }
        }
        ask();
        return;
      }

      if (userInput.toLowerCase() === '/canvas apply') {
        const pending = [...canvasState.pendingPatches];
        if (pending.length === 0) {
          process.stdout.write('  [canvas] No pending patches to apply.\n\n');
          ask();
          return;
        }
        process.stdout.write(`\n  [canvas] Applying ${pending.length} pending patch(es)...\n`);
        // Per-patch accept/reject prompts
        const applyPatches = async () => {
          const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
          const question = (q: string) => new Promise<string>((res) => rl2.question(q, res));
          try {
            for (const hunk of pending) {
              process.stdout.write('\n');
              process.stdout.write(renderPatchPreview(hunk));
              const answer = await question(`  Apply this patch? (y/n) > `);
              if (answer.trim().toLowerCase() === 'y') {
                const result = await applyPatch(hunk, process.cwd());
                if (result.success) {
                  process.stdout.write(`  [canvas] Applied: ${hunk.op.toUpperCase()} ${hunk.path}\n`);
                  canvasState.appliedPatches.push(hunk);
                } else {
                  process.stdout.write(`  [canvas] Failed: ${result.error}\n`);
                }
              } else {
                process.stdout.write(`  [canvas] Skipped.\n`);
                canvasState.rejectedPatches.push(hunk);
              }
              // Remove from pending regardless
              const idx = canvasState.pendingPatches.indexOf(hunk);
              if (idx !== -1) canvasState.pendingPatches.splice(idx, 1);
            }
          } finally {
            rl2.close(); // always close, even on error
          }
          process.stdout.write('\n  [canvas] Done.\n\n');
          currentState.canvasPending = canvasState.pendingPatches.length;
          ask();
        };
        await applyPatches();
        return;
      }

      if (userInput.toLowerCase() === '/canvas reset') {
        const count = canvasState.pendingPatches.length;
        canvasState.pendingPatches.length = 0;
        currentState.canvasPending = 0;
        process.stdout.write(`  [canvas] Discarded ${count} pending patch(es).\n\n`);
        ask();
        return;
      }

      // ─ Document canvas commands ─────────────────────────────────────────
      if (userInput.toLowerCase().startsWith('/doc')) {
        const docPrompt = userInput.slice(4).trim();
        if (!docPrompt) {
          process.stdout.write('  Usage: /doc [prompt]\n  Example: /doc write a 500-word blog post about AI\n\n');
          ask();
          return;
        }

        const controller = new AbortController();
        try {
          const result = await cliCanvas.generateDocument(docPrompt, {
            model: currentState.model,
            signal: controller.signal,
          });
          documentState.currentDocument = result.content;
          documentState.currentTitle = result.title;
          documentState.currentWordCount = result.wordCount;
          documentState.generatedAt = Date.now();

          process.stdout.write(`  Options: [E]dit / [S]how / [D]ownload / [S]ave / [V]ersions / [Q]uit\n\n`);
          process.stdout.write('  > ');

          rl.once('line', async (action) => {
            await handleDocumentAction(action.trim().toLowerCase(), rl);
            ask();
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          process.stdout.write(`\n  [error] ${msg}\n\n`);
          ask();
        }
        return;
      }

      if (userInput.toLowerCase() === '/show') {
        if (!documentState.currentDocument) {
          process.stdout.write('  No document generated yet. Use /doc [prompt] first.\n\n');
          ask();
          return;
        }
        cliCanvas.showPrettified(documentState.currentDocument, documentState.currentTitle);
        ask();
        return;
      }

      if (userInput.toLowerCase().startsWith('/edit')) {
        if (!documentState.currentDocument) {
          process.stdout.write('  No document to edit. Use /doc [prompt] first.\n\n');
          ask();
          return;
        }

        const sectionId = userInput.slice(5).trim();
        if (!sectionId) {
          process.stdout.write('  Available sections: [heading name] or [line N-M]\n');
          process.stdout.write('  Examples: /edit Introduction, /edit "Section 2", /edit line 10-20\n\n');
          ask();
          return;
        }

        // Prompt for edit instruction
        rl.question('  Edit instruction (what should I change?): ', async (instruction) => {
          if (!instruction.trim()) {
            process.stdout.write('  Cancelled.\n\n');
            ask();
            return;
          }

          const controller = new AbortController();
          try {
            const editResult = await cliCanvas.editSection(
              documentState.currentDocument,
              sectionId,
              instruction,
              { signal: controller.signal, model: 'qwen3.5:4b' }
            );

            cliCanvas.showDiff(editResult.oldText, editResult.newText);

            rl.question('  Accept this edit? (y/n) > ', (answer) => {
              if (answer.trim().toLowerCase() === 'y') {
                // Replace section in document
                const lines = documentState.currentDocument.split('\n');
                const updatedDoc = lines
                  .slice(0, editResult.oldText.split('\n').length)
                  .concat(editResult.newText.split('\n'))
                  .concat(lines.slice(editResult.oldText.split('\n').length))
                  .join('\n');
                documentState.currentDocument = updatedDoc;
                documentState.currentWordCount = updatedDoc.split(/\s+/).filter(Boolean).length;
                process.stdout.write('  Updated.\n\n');
              } else {
                process.stdout.write('  Reverted.\n\n');
              }
              ask();
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            process.stdout.write(`\n  [error] ${msg}\n\n`);
            ask();
          }
        });
        return;
      }

      if (userInput.toLowerCase() === '/save') {
        if (!documentState.currentDocument) {
          process.stdout.write('  No document to save.\n\n');
          ask();
          return;
        }

        (async () => {
          try {
            const version = await cliCanvas.saveVersion(documentState.currentDocument, {
              title: documentState.currentTitle,
              model: currentState.model,
            });
            documentState.versions.push(version);
            ask();
          } catch (error) {
            process.stdout.write(`  [error] ${error instanceof Error ? error.message : String(error)}\n\n`);
            ask();
          }
        })();
        return;
      }

      if (userInput.toLowerCase() === '/versions') {
        const versions = cliCanvas.listVersions();
        if (versions.length > 0 && versions[0]) {
          rl.question('  Download version #? (enter number or q to cancel) > ', (choice) => {
            const idx = parseInt(choice, 10) - 1;
            if (idx >= 0 && idx < versions.length) {
              cliCanvas.downloadVersion(versions[idx]);
              process.stdout.write('\n');
            }
            ask();
          });
        } else {
          ask();
        }
        return;
      }

      // ── Remote Research Command ────────────────────────────────────────────
      if (userInput.toLowerCase().startsWith('/research')) {
        (async () => {
          const parts = userInput.slice(9).trim().split(/\s+/);
          const subcommand = parts[0]?.toLowerCase();

          try {
            if (!subcommand || subcommand === 'help') {
              process.stdout.write('\n  /research on <title>      Start 10-hour research task\n');
              process.stdout.write('  /research watch <task-id>  Monitor live progress\n');
              process.stdout.write('  /research list             List research tasks\n\n');
              ask();
              return;
            }

            if (subcommand === 'on') {
              // Create and start research task
              const titleMatch = userInput.match(/\/research\s+on\s+"([^"]*)"/);
              const title = titleMatch ? titleMatch[1] : userInput.slice(12).trim();

              if (!title) {
                process.stdout.write('  Usage: /research on "Research Title"\n\n');
                ask();
                return;
              }

              const researchPrompt = `Comprehensive research on: ${title}.

Scope: Deep investigation covering all relevant technical solutions, tools, libraries, approaches, frameworks, platforms, and emerging technologies. Explore traditional methods, AI-based solutions, procedural generation, hybrid approaches, and experimental techniques.

Research intensity: Maximum depth. Keep investigating until all major options are evaluated. Do not stop prematurely.

Deliverables:
1. Tool/solution comparison matrix
2. Pros/cons analysis for each approach
3. Production timeline estimates
4. Cost breakdown
5. Code examples for top solutions
6. Quality benchmarks if applicable
7. Risk assessment
8. Final recommendations

Keep researching continuously, exploring deeper, finding more options, comparing, analyzing. Maximum depth. Thoroughness is key.`;

              const taskId = await cliRemote.createResearchTask(title, researchPrompt);
              await cliRemote.executeResearch(taskId);
              ask();
              return;
            }

            if (subcommand === 'watch') {
              const taskId = parts[1];
              if (!taskId) {
                process.stdout.write('  Usage: /research watch <task-id>\n\n');
                ask();
                return;
              }
              await cliRemote.watchResearch(taskId);
              // watchResearch exits on Ctrl+C
              return;
            }

            if (subcommand === 'list') {
              await cliTasks.listTasks();
              ask();
              return;
            }

            process.stdout.write('  Unknown command. Try: /research help\n\n');
            ask();
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            process.stdout.write(`  Error: ${msg}\n\n`);
            ask();
          }
        })();
        return;
      }

      // ── Task Management Commands ──────────────────────────────────────────
      if (userInput.toLowerCase().startsWith('/task')) {
        (async () => {
          const parts = userInput.slice(5).trim().split(/\s+/);
          const subcommand = parts[0]?.toLowerCase();
          const args = parts.slice(1);

          try {
            if (subcommand === 'create') {
              if (args.length === 0) {
                process.stdout.write('  Usage: /task create "Title" [description]\n\n');
              } else {
                // Parse quoted title and optional description
                const fullArg = userInput.slice(5).trim().slice('create'.length).trim();
                const match = fullArg.match(/^"([^"]*)"\s*(.*)?$/);
                if (match) {
                  const title = match[1];
                  const description = match[2] || '';
                  await cliTasks.createTask(title, description);
                } else {
                  process.stdout.write('  Error: Title must be quoted. Usage: /task create "Title" [description]\n\n');
                }
              }
            } else if (subcommand === 'list') {
              await cliTasks.listTasks();
            } else if (subcommand === 'start') {
              if (args.length === 0) {
                process.stdout.write('  Usage: /task start <task-id>\n\n');
              } else {
                const taskId = args[0];
                await cliTasks.startTask(taskId);
              }
            } else if (subcommand === 'pause') {
              if (args.length === 0) {
                process.stdout.write('  Usage: /task pause <task-id>\n\n');
              } else {
                const taskId = args[0];
                await cliTasks.pauseTask(taskId);
              }
            } else if (subcommand === 'resume') {
              if (args.length === 0) {
                process.stdout.write('  Usage: /task resume <task-id>\n\n');
              } else {
                const taskId = args[0];
                await cliTasks.resumeTask(taskId);
              }
            } else if (subcommand === 'view') {
              if (args.length === 0) {
                process.stdout.write('  Usage: /task view <task-id>\n\n');
              } else {
                const taskId = args[0];
                await cliTasks.viewTask(taskId);
              }
            } else if (subcommand === 'delete') {
              if (args.length === 0) {
                process.stdout.write('  Usage: /task delete <task-id>\n\n');
              } else {
                const taskId = args[0];
                rl.question(`  Delete task ${taskId}? (y/n) > `, async (answer) => {
                  if (answer.toLowerCase() === 'y') {
                    await cliTasks.deleteTask(taskId);
                  }
                  ask();
                });
                return;
              }
            } else {
              process.stdout.write('  Unknown command. Use /help for task commands.\n\n');
            }
            ask();
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            process.stdout.write(`  Error: ${msg}\n\n`);
            ask();
          }
        })();
        return;
      }

      if (!userInput) {
        ask();
        return;
      }

      // Classify route (available as hint; skipSemanticRouting is still passed)
      const _routeHint = classifyRoute(userInput); // eslint-disable-line @typescript-eslint/no-unused-vars

      conversationHistory.push({ role: 'user', content: userInput });

      const contextMessages = conversationHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      try {
        let fullResponse = '';
        const controller = new AbortController();

        const result = await runAgentLoop(userInput, contextMessages, {
          signal: controller.signal,
          skipSemanticRouting: true, // CLI: no embedding model needed
          onEvent: (event: AgentEngineEvent) => {
            displayEvent(event, debugMode);
            if (event.type === 'response_chunk' && event.response) {
              fullResponse += event.response;
            }
            // 'done' is the canonical final response — use it directly (don't accumulate chunks twice)
            if (event.type === 'done' && event.response) {
              fullResponse = event.response; // always take the engine's final answer
            }
          },
          onAskUser: async (question: string, opts: string[]) => {
            return new Promise<string>((resolve) => {
              const optStr = opts.length > 0 ? ` (${opts.join(' / ')})` : '';
              rl.question(`\n  ? ${question}${optStr}\n> `, (answer) => {
                resolve(answer.trim());
              });
            });
          },
        });

        if (!fullResponse && result.finalResponse) {
          fullResponse = result.finalResponse;
        }

        if (fullResponse) {
          conversationHistory.push({ role: 'assistant', content: fullResponse });
        }
      } catch (error) {
        stopShimmer();
        const msg = error instanceof Error ? error.message : String(error);
        process.stdout.write(`\n  [error] ${msg}\n`);
      }

      process.stdout.write('\n');
      ask();
    });
  };

  // When stdin is a pipe and closes after delivering input, readline emits 'close'.
  // DON'T exit immediately — the agent is still processing the prompt.
  // Set a flag; ask() will call process.exit(0) after the response is delivered.
  rl.on('close', () => {
    stdinClosed = true;
  });

  process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ERR_USE_AFTER_CLOSE') {
      process.exit(0); // normal pipe termination
    }
    stopShimmer();
    console.error('fatal:', err);
    process.exit(1);
  });

  ask();
}

// ── Document action handler ──────────────────────────────────────────────────
async function handleDocumentAction(action: string, rl: readline.Interface): Promise<void> {
  switch (action) {
    case 'e':
      process.stdout.write(
        '\n  Available sections: heading name or line N-M\n' +
        '  Examples: edit "Features", edit line 10-20\n' +
        '  Section: '
      );
      return new Promise((resolve) => {
        rl.once('line', async (sectionId) => {
          if (sectionId.trim()) {
            rl.question('  Edit instruction: ', async (instruction) => {
              const controller = new AbortController();
              try {
                const editResult = await cliCanvas.editSection(documentState.currentDocument, sectionId, instruction, {
                  signal: controller.signal,
                });
                cliCanvas.showDiff(editResult.oldText, editResult.newText);
                rl.question('  Accept? (y/n) > ', (answer) => {
                  if (answer.trim().toLowerCase() === 'y') {
                    const lines = documentState.currentDocument.split('\n');
                    const start = editResult.oldText.split('\n').length;
                    const updated = [...lines.slice(0, start), ...editResult.newText.split('\n'), ...lines.slice(start)].join(
                      '\n'
                    );
                    documentState.currentDocument = updated;
                    documentState.currentWordCount = updated.split(/\s+/).filter(Boolean).length;
                    process.stdout.write('  Updated.\n\n');
                  }
                  resolve();
                });
              } catch (error) {
                process.stdout.write(`\n  [error] ${error instanceof Error ? error.message : String(error)}\n\n`);
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      });

    case 's':
      cliCanvas.showPrettified(documentState.currentDocument, documentState.currentTitle);
      break;

    case 'd':
      try {
        cliCanvas.downloadVersion({
          id: `doc-${Date.now()}`,
          title: documentState.currentTitle,
          content: documentState.currentDocument,
          wordCount: documentState.currentWordCount,
          createdAt: documentState.generatedAt || Date.now(),
        });
        process.stdout.write('\n');
      } catch (error) {
        process.stdout.write(`\n  [error] ${error instanceof Error ? error.message : String(error)}\n\n`);
      }
      break;

    case 'v':
      cliCanvas.listVersions();
      break;

    case 'q':
      process.stdout.write('\n');
      break;

    default:
      process.stdout.write('  Invalid action. Try [E]dit / [S]how / [D]ownload / [V]ersions / [Q]uit\n\n');
  }
}

main().catch((error) => {
  stopShimmer();
  console.error('fatal:', error);
  process.exit(1);
});
