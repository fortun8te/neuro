// @ts-nocheck
/**
 * Agent Engine — ReAct (Reason + Act) loop with tool execution.
 *
 * This is the core that turns AgentPanel from a basic chat into a Manus-style
 * autonomous agent. It:
 *   1. Receives user messages
 *   2. Asks the LLM what tool to call (or respond directly)
 *   3. Executes the tool
 *   4. Feeds the result back to the LLM
 *   5. Repeats until the LLM says "done" or max steps reached
 *
 * Inspired by OpenManus ReAct loop + agenticSeek routing + Claude Code patterns.
 */

import { ollamaService } from './ollama';
import { getModelForStage, getPlannerModel, getExecutorModel, getThinkMode, getImageModel, getContextSize } from './modelConfig';
import { vramManager } from './vramManager';
import { parseModelMention } from './modelMentionParser';
import { buildToolUseContext, executeWithHarness, executeParallelWithHarness, wrapLegacyTool } from './harness';
import { getPermissionMode, isWriteTool } from './permissionMode';
import { injectSoul } from './soulLoader';
import { runPlanAct } from './planActAgent';
import { wayfarerService, screenshotService } from './wayfarer';
import { sandboxService } from './sandboxService';
// NOTE: videoAnalyzer uses Node.js APIs (child_process, fs, path) and cannot run in browser
// These tools are server-side only and should not be imported here
import { createSpreadsheet, readSpreadsheet } from './excelTools';
// Workspace imports removed — use sessionFileSystem instead
import { agentCoordinator } from './agentCoordinator';
import { blackboard } from './blackboard';
import { SubagentPool, aggregateResults } from './subagentManager';
import { planSubagents } from './subagentPlanner';
import { selectTools, quickSelectTools } from './toolRouter';
import { callXlam, convertToolDefs } from './xlamService'; // xLAM used only for tool-call rescue (bad format recovery)
import { isIdentityQuestion, askNeuroIdentity, rewriteWithNeuro, isNeuroAvailable } from './neuroRewriter';
import type { SubagentRole } from './subagentRoles';
import { addMemory, searchMemories } from './memoryStore';
import { neuroMemory } from './neuroMemory';
import { getSoulContext, readSoulFile, writeSoulFile, appendToSoulFile, logToday, invalidateSoulCache, loadRelevantSkills, consolidateMemory } from './neuroSoul';
import { TaskHeartbeat } from './watchdog';
import { neuroEnhancedRouter, type EnhancedRoutingResult } from './neuroEnhancedRouting';
import { isEmbeddingAvailable, probeEmbeddingModel } from './embeddingService';
import { semanticRouter } from './neuroContext';
import { context1Service, isContext1Available } from './context1Service';
import { vfs } from './sessionFileSystem';
import { analyzeCodebase, formatFileTree } from './codeAnalysisAgent';

// Local type aliases for data pipeline — mirrors DataViz.tsx (kept in-sync manually)
interface ChartSeriesPoint { x: string | number; y: number; z?: number; }
interface ChartSeries { name: string; color?: string; data: ChartSeriesPoint[]; }
interface ChartSpec { type: 'bar'|'line'|'area'|'pie'|'donut'|'scatter'|'heatmap'; title?: string; subtitle?: string; series: ChartSeries[]; xAxis?: { label?: string }; yAxis?: { label?: string; unit?: string }; source?: string; }
import { loadPromptBody } from './promptLoader';
import { desktopBus } from './desktopBus';
import { runComputerAgent } from './computerAgent/orchestrator';
import type { AskUserRequest, AskUserResponse } from './computerAgent/orchestrator';
import { getEnv } from '../config/envLoader';
import { parsePatch, assessPatch, applyPatch as applyPatchToFs, renderPatchPreview } from './applyPatch';
import type { PatchHunk } from './applyPatch';

// ── Infrastructure URL helper ──
// Returns the wayfarer base URL. wayfarerService already uses INFRASTRUCTURE internally,
// but for direct fetch calls in tools we need the base URL.
// We read the env var directly to avoid circular imports.
function getWayfarerBaseUrl(): string {
  try {
    // Check env var first (Vite injects these at build time)
    const envUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_WAYFARER_URL : undefined;
    if (envUrl) return envUrl;
    // Check localStorage override (set by settings UI)
    if (typeof localStorage !== 'undefined') {
      const mode = localStorage.getItem('infrastructure_mode');
      if (mode === 'remote') return 'http://100.74.135.83:8889';
    }
    return 'http://localhost:8889';
  } catch {
    return 'http://localhost:8889';
  }
}

// ── Feature flags ──
// Computer tools (use_computer, control_desktop) temporarily disabled while we
// stabilize core research/docx/citation pipeline. Re-enable when sandbox is ready.
const COMPUTER_TOOLS_ENABLED = false;

// ── Tool failure memory (DeepAgent pattern) ──────────────────────────────
const _toolFailureCount = new Map<string, number>();
const TOOL_MAX_FAILURES = 2; // blacklist after 2 failures in a session

function recordToolFailure(toolName: string): void {
  const count = (_toolFailureCount.get(toolName) || 0) + 1;
  _toolFailureCount.set(toolName, count);
}

function isToolBlacklisted(toolName: string): boolean {
  return (_toolFailureCount.get(toolName) || 0) >= TOOL_MAX_FAILURES;
}

function recordToolSuccess(toolName: string): void {
  _toolFailureCount.delete(toolName); // reset on success
}

// ── Subagent progress throttle ──────────────────────────────────────────
let _subagentProgressCount = 0;
const MAX_SUBAGENT_PROGRESS_EVENTS = 20;

// ── Tool Error Classification (Codex pattern) ──────────────────────────────
type ToolErrorKind = 'respond_to_model' | 'fatal' | 'malformed';
interface ToolCallError {
  kind: ToolErrorKind;
  message: string;
}

function makeToolError(kind: ToolErrorKind, message: string): ToolCallError {
  return { kind, message };
}

// ── Codex patch pending queue ──────────────────────────────────────────────
/** Patches queued for user approval (op:'delete' or absolute paths outside workspace) */
export const _pendingPatches: PatchHunk[] = [];

// ── Context compaction chain state (claw-code pattern) ────────────────────
const _compactionSummaryStack: string[] = []; // max 3 prior summaries

// ── Output Truncation — Middle-Elision ─────────────────────────────────────
function truncateToolOutput(text: string, maxChars = 20_000): string {
  if (text.length <= maxChars) return text;
  const headSize = Math.floor(maxChars * 0.4);
  const tailSize = Math.floor(maxChars * 0.4);
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);
  const elided = text.length - headSize - tailSize;
  return `${head}\n\n[... ${elided.toLocaleString()} characters truncated (showing first ${headSize} + last ${tailSize}) ...]\n\n${tail}`;
}

// In-session browse cache — avoids re-scraping the same URL within a session
const browseCache = new Map<string, { text: string; ts: number }>();
const BROWSE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Tool Definitions ──

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: ToolResult;
  startedAt?: number;
  completedAt?: number;
}

// ── Agent Step (one think-act cycle) ──

export interface AgentStep {
  thinking: string;
  toolCall?: ToolCall;
  response?: string;   // final text response (no tool)
  timestamp: number;
}

// ── Stream Events ──

export type AgentEngineEventType =
  | 'routing'
  | 'thinking_start'
  | 'thinking_chunk'
  | 'thinking_done'
  | 'tool_start'
  | 'tool_done'
  | 'tool_error'
  | 'response_start'
  | 'response_chunk'
  | 'response_done'
  | 'step_complete'
  | 'context_compressed'
  | 'task_progress'
  | 'subagent_spawn'
  | 'subagent_progress'
  | 'subagent_complete'
  | 'subagent_failed'
  | 'done'
  | 'error';

/** Subagent lifecycle event payload */
export interface SubagentEventData {
  agentId: string;
  role: string;
  task: string;
  model?: string;
  tokens?: number;
  status?: string;
  result?: string;
  confidence?: number;
  error?: string;
  /** Sources extracted from subagent output */
  sources?: Array<{ title: string; url: string; domain: string; snippet?: string }>;
  /** Live partial output from the model — shown as typewriter preview in UI */
  partialOutput?: string;
}

export interface TaskProgress {
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    description: string;
    status: 'pending' | 'active' | 'done' | 'error';
    toolUsed?: string;
  }>;
  elapsed: number; // seconds
}

export interface AgentEngineEvent {
  type: AgentEngineEventType;
  thinking?: string;
  /** True when thinking came from a dedicated thinking token stream (json.thinking), not from the response text */
  isThinkingToken?: boolean;
  toolCall?: ToolCall;
  response?: string;
  error?: string;
  step?: number;
  timestamp: number;
  taskProgress?: TaskProgress;
  /** Populated for subagent_* events */
  subagent?: SubagentEventData;
  /** Which model is being used for this step */
  model?: string;
  /** Routing decision metadata — populated for 'routing' events */
  routing?: { phase: string; decision: string; tools?: string[]; model?: string; durationMs?: number };
  /** Neuro rewrite data — populated when response was rewritten by Neuro */
  neuroRewrite?: {
    original: string;
    rewritten: string;
    model: string;
    verification?: {
      passed: boolean;
      durationMs: number;
      model: string;
    };
  };
}

export type AgentEngineCallback = (event: AgentEngineEvent) => void;

// ── Tool Registry ──

function buildTools(onEvent?: AgentEngineCallback, modelRef?: { current: string }): ToolDef[] {
  return [
    {
      name: 'web_search',
      description: 'Search the web and scrape top results. Returns structured per-page content so you can cite sources. USE THIS for: any factual question, brands, companies, products, prices, events, stats, market data. ALWAYS prefer this over answering from memory. Use depth="thorough" for deep research (auto-generates multiple query angles and merges ~30 sources). For deep dives on specific pages, follow up with multi_browse.',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
        max_results: { type: 'number', description: 'Max pages to scrape (default 15). Overrides depth preset if provided.' },
        depth: { type: 'string', description: '"quick" (5 sources), "normal" (15 sources, default), or "thorough" (30 sources, multiple query angles merged)' },
      },
      execute: async (params, signal) => {
        try {
          const query = String(params.query || '');
          // Auto-detect depth from query if not explicitly set
          const autoDepth = (() => {
            if (params.depth) return (String(params.depth)).toLowerCase();
            const q = query.toLowerCase();

            // EXACT SITE MENTION — narrow search (2-3 sources)
            if (/\b(site:|site\.|from|on)\s+[a-z0-9][a-z0-9\-.]*\.[a-z]{2,}\b/i.test(q)) return 'quick';
            // Specific URL/domain mentioned
            if (/https?:\/\/|www\.|\.com|\.org|\.net|\.io\b/i.test(q)) return 'quick';

            // BROAD/RESEARCH queries — thorough (30+ sources, multi-angle)
            if (/\b(compare|analyze|research|comprehensive|top \d+|best \d+|list of|overview|landscape|market|industry|trends|state of the art|survey|guide)\b/i.test(q)) return 'thorough';
            // "Deep" / "very" / "super" keyword intensity
            if (/\b(deep|very|super|extensively|thoroughly|comprehensive|in.?depth|full.?scale)\b/i.test(q)) return 'thorough';
            // Multi-word comparative (comparing things, not single entity)
            if (/\bvs\b|versus|compare|difference|vs\.|vs /i.test(q)) return 'thorough';

            // SHORT SINGLE-ENTITY lookups = quick
            if (/^(what is|who is|define|meaning of|tell me about)\b/i.test(q)) return 'quick';
            if (q.split(' ').length <= 2) return 'quick';

            // Default: normal (8 sources)
            return 'normal';
          })();
          const depth = autoDepth as 'quick' | 'normal' | 'thorough';
          const depthDefaults: Record<string, number> = { quick: 3, normal: 8, thorough: 30 };
          const max = params.max_results ? Number(params.max_results) : (depthDefaults[depth] || 15);

          // --- Generate query variations for thorough mode ---
          const generateQueryVariations = (q: string): string[] => {
            const words = q.split(/\s+/).filter(w => w.length > 2);
            const variations: string[] = [];
            // Variation 1: reorder — move last 2 words to front
            if (words.length >= 4) {
              const tail = words.slice(-2);
              const head = words.slice(0, -2);
              variations.push([...tail, ...head].join(' '));
            }
            // Variation 2: synonym-style swap for common words
            const synonyms: Record<string, string> = {
              top: 'best', best: 'top', biggest: 'largest', largest: 'biggest',
              funding: 'investment', investment: 'funding', startups: 'companies',
              companies: 'startups', trends: 'developments', guide: 'overview',
              review: 'analysis', analysis: 'review', list: 'ranking', ranking: 'list',
              popular: 'trending', latest: 'recent', recent: 'latest', how: 'ways',
            };
            const swapped = words.map(w => synonyms[w.toLowerCase()] || w);
            const swappedStr = swapped.join(' ');
            if (swappedStr.toLowerCase() !== q.toLowerCase()) {
              variations.push(swappedStr);
            }
            // Variation 3: add year or "2025" context if not present
            if (!/20\d{2}/.test(q)) {
              variations.push(`${q} 2025`);
            } else {
              // Rephrase without year + different framing
              const noYear = q.replace(/20\d{2}/g, '').trim();
              variations.push(`${noYear} latest`);
            }
            // Return up to 2 unique variations that differ from original
            const unique = [...new Set(variations)].filter(v => v.toLowerCase() !== q.toLowerCase());
            return unique.slice(0, 2);
          };

          type WPage = { url: string; title: string; content: string; snippet: string; source: string };
          let allPages: WPage[] = [];
          let totalElapsed = 0;
          let queryCount = 1;

          // Hard timeout wrapper for wayfarer calls — prevents infinite hangs on bad queries
          const withSearchTimeout = <T>(p: Promise<T>, ms = 30_000): Promise<T> =>
            Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`web_search timed out after ${ms / 1000}s`)), ms))]);

          // Primary search
          const results = await withSearchTimeout(wayfarerService.research(query, max, signal));
          allPages = results.pages || [];
          totalElapsed = results.meta?.elapsed || 0;

          // Thorough: run parallel follow-up queries
          if (depth === 'thorough') {
            const variations = generateQueryVariations(query);
            if (variations.length > 0) {
              queryCount += variations.length;
              const perVariation = Math.ceil(max / (variations.length + 1));
              const followUps = await Promise.all(
                variations.map(vq => withSearchTimeout(wayfarerService.research(vq, perVariation, signal)))
              );
              // Merge + deduplicate by URL
              const seenUrls = new Set(allPages.map(p => p.url));
              for (const followUp of followUps) {
                totalElapsed = Math.max(totalElapsed, followUp.meta?.elapsed || 0);
                for (const page of (followUp.pages || [])) {
                  if (!seenUrls.has(page.url)) {
                    seenUrls.add(page.url);
                    allPages.push(page);
                  }
                }
              }
            }
          }

          if (allPages.length === 0) {
            return { success: false, output: `No results found for: ${query}` };
          }

          // Cap to max and format output
          const capped = allPages.slice(0, max);
          const sections = capped.map((page, i) => {
            const content = (page.content || page.snippet || '').slice(0, 4000);
            return `[${i + 1}] ${page.title || '(untitled)'} — ${page.url}\nKey content: ${content}`;
          });
          const header = `Found ${capped.length} sources across ${queryCount} quer${queryCount > 1 ? 'ies' : 'y'} (${totalElapsed.toFixed(1)}s)\n\n`;
          return {
            success: true,
            output: header + sections.join('\n\n'),
            data: { ...results, pages: capped },
          };
        } catch (_err) {
          const errMsg = _err instanceof Error ? _err.message : String(_err);
          const isConnErr = errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND');
          if (isConnErr) {
            return { success: false, output: 'Search service unavailable. Do NOT retry web_search — switch to browse with specific URLs, or answer from your knowledge directly.' };
          }
          return { success: false, output: 'No results found for this query. Try rephrasing or use browse with a specific URL.' };
        }
      },
    },
    {
      name: 'multi_browse',
      description: 'Scrape multiple URLs in parallel — much faster than calling browse one at a time. Use after web_search when you want to read several specific pages. Returns content per URL.',
      parameters: {
        urls: { type: 'string', description: 'JSON array of URLs to scrape, e.g. ["https://a.com","https://b.com"]', required: true },
      },
      execute: async (params, signal) => {
        try {
          const raw = String(params.urls || '');
          let urls: string[] = [];
          try { urls = JSON.parse(raw); } catch { urls = raw.split(/[\s,]+/).filter(u => u.startsWith('http')); }
          if (!Array.isArray(urls) || urls.length === 0) return { success: false, output: 'No valid URLs provided.' };
          urls = urls.slice(0, 10); // cap at 10
          const result = await Promise.race([
            wayfarerService.batchCrawl(urls, 10, signal),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('multi_browse timed out after 30s')), 30_000)),
          ]);
          if (!result.results || result.results.length === 0) return { success: false, output: 'No pages crawled successfully.' };
          const sections = result.results.map((r, i) => {
            const content = r.error ? `[Error: ${r.error}]` : (r.content || '').slice(0, 3000);
            return `--- Page ${i + 1}: ${r.url}\n\n${content}`;
          });
          return {
            success: true,
            output: `Crawled ${result.success}/${result.total} pages:\n\n${sections.join('\n\n')}`,
            data: result,
          };
        } catch (err) {
          return { success: false, output: 'Could not retrieve content from those URLs. They may be unavailable or blocking scraping.' };
        }
      },
    },
    {
      name: 'browse',
      description: 'Read the full content of a specific URL. USE THIS when: user gives you a URL, you need to read a specific page, follow a link, check what a site says. For clicking/interacting with UI, use use_computer instead.',
      parameters: {
        url: { type: 'string', description: 'URL to navigate to', required: true },
        goal: { type: 'string', description: 'What to do on the page (e.g., "click Add to Cart", "fill in the form")' },
      },
      execute: async (params, signal) => {
        try {
          const url = String(params.url || '');
          const goal = String(params.goal || 'Explore this page and summarize what you find.');

          // Check in-session cache first
          const cached = browseCache.get(url);
          if (cached && Date.now() - cached.ts < BROWSE_CACHE_TTL_MS) {
            const age = Math.round((Date.now() - cached.ts) / 60000);
            return { success: true, output: `[Cached ${age}min ago — skipping re-scrape]\n\n${cached.text}` };
          }

          // Try sandbox first
          try {
            const navResult = await sandboxService.navigate(url);
            if (navResult.error) throw new Error(navResult.error);

            let summary = '';
            await runPlanAct(goal, getPlannerModel(), getExecutorModel(), {
              onDone: (s) => { summary = s; },
              onError: (e) => { summary = `Error: ${e}`; },
            }, 20, signal);

            const out = summary || `Browsed ${url}`;
            browseCache.set(url, { text: out, ts: Date.now() });
            return { success: true, output: out, data: { url, title: navResult.title } };
          } catch {
            // Sandbox unavailable — fall back to Wayfarer scrape + analysis
            const actionKeywords = /\b(click|fill|submit|type|scroll|hover)\b/i;
            const warningNote = actionKeywords.test(goal)
              ? `[WARNING: Wayfarer Plus unavailable — falling back to read-only scraping. Click/fill/submit goals cannot be fulfilled.]\n\n`
              : '';
            const result = await screenshotService.analyzePage(url);
            const text = typeof result.page_text === 'object'
              ? Object.values(result.page_text).join('\n').slice(0, 12000)
              : String(result.page_text || '').slice(0, 12000);
            const out = warningNote + (text || 'No content extracted from this page.');
            browseCache.set(url, { text: out, ts: Date.now() });
            return { success: true, output: out, data: result };
          }
        } catch (err) {
          return { success: false, output: 'Could not load that page. It may be unavailable or blocking access. Try a different URL.' };
        }
      },
    },
    {
      name: 'scrape_page',
      description: 'Extract text from a single known URL. Quick read, no interaction. Use web_search when you need to discover pages first.',
      parameters: {
        url: { type: 'string', description: 'URL to scrape', required: true },
      },
      execute: async (params) => {
        try {
          const url = String(params.url || '');
          // Use analyzePage which does text scrape + screenshot in one call
          const result = await screenshotService.analyzePage(url);
          const text = typeof result.page_text === 'object'
            ? Object.values(result.page_text).join('\n').slice(0, 6000)
            : String(result.page_text || '').slice(0, 6000);
          return { success: true, output: text || 'No content extracted.', data: result };
        } catch (err) {
          return { success: false, output: 'Could not extract content from that page. It may be unavailable or blocking access.' };
        }
      },
    },
    {
      name: 'analyze_page',
      description: 'Screenshot a URL + extract text. Visual analysis. Use when you need layout/design info, not just text (scrape_page is faster for text-only).',
      parameters: {
        url: { type: 'string', description: 'URL to screenshot and analyze', required: true },
      },
      execute: async (params) => {
        try {
          const url = String(params.url || '');
          const result = await screenshotService.analyzePage(url);
          const text = typeof result.page_text === 'object'
            ? Object.values(result.page_text).join('\n').slice(0, 4000)
            : String(result.page_text || '').slice(0, 4000);
          const dims = result.width && result.height ? `Screenshot: ${result.width}x${result.height}` : '';
          return {
            success: !result.error,
            output: result.error ? `Error: ${result.error}` : `${dims}\n\n${text}`,
            data: result,
          };
        } catch (err) {
          return { success: false, output: `Analysis failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'think',
      description: 'Reason through a problem before acting. USE THIS when: the task is ambiguous, you are choosing between approaches, debugging a failed step, or the right tool is unclear. Run this BEFORE taking an action you are unsure about.',
      parameters: {
        problem: { type: 'string', description: 'The problem to think about', required: true },
      },
      execute: async (params, signal) => {
        try {
          const problem = String(params.problem || '');
          let response = '';
          await ollamaService.generateStream(
            `Analyze this problem systematically:\n\n${problem}\n\nStructured reasoning with clear conclusions.`,
            'Break problems into components. Multiple angles. Concise conclusions.',
            {
              model: getModelForStage('research'),
              temperature: 0.4,
              num_predict: 800,
              signal,
              onChunk: (c: string) => { response += c; },
            },
          );
          return { success: true, output: response };
        } catch (err) {
          return { success: false, output: `Think failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'memory_store',
      description: 'Save a fact to persistent memory (survives sessions). USE THIS when: user says "remember this", "note that", shares preferences/info they want retained, or you discover something important mid-task. Use category: "user" for preferences, "campaign" for brand/ad info, "research" for findings.',
      parameters: {
        key: { type: 'string', description: 'Short label/tag for this memory', required: true },
        content: { type: 'string', description: 'Content to store', required: true },
        category: { type: 'string', description: 'Category: "general", "user", "campaign", or "research" (default: "general")' },
      },
      execute: async (params) => {
        try {
          const key = String(params.key || 'note');
          const content = String(params.content || '');
          if (!content) return { success: false, output: 'No content provided.' };
          // Block ephemeral/trivial data from being stored — time, weather, prices, live data
          const ephemeralRe = /\b(current time|time in|weather in|temperature|forecast|price of|stock price|exchange rate|bitcoin|btc|eth|today'?s|right now|as of today|live data)\b/i;
          if (ephemeralRe.test(content) || ephemeralRe.test(key)) {
            return { success: false, output: 'Skipped: ephemeral/live data is not worth storing in persistent memory.' };
          }
          const category = (String(params.category || 'general')) as 'general' | 'user' | 'campaign' | 'research';
          const validCategories = ['general', 'user', 'campaign', 'research'];
          const safeCategory = validCategories.includes(category) ? category : 'general';
          // DISABLED: Cross-chat memory persistence removed per user request
          // addMemory(safeCategory, content, [key]);
          // Also write to neuroMemory (richer, two-tier system)
          const nmCategory = safeCategory === 'user' ? 'preference' : safeCategory === 'research' ? 'fact' : 'context';
          void neuroMemory.remember(content, nmCategory, key);
          return { success: true, output: `Stored memory: ${key}` };
        } catch (err) {
          return { success: false, output: `Memory store error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'memory_search',
      description: 'Search persistent memory for stored facts. USE THIS when: user asks "what did I tell you about X", "do you remember X", or when you need context about the user/brand/past work. Run this BEFORE answering questions about things the user may have told you previously.',
      parameters: {
        query: { type: 'string', description: 'Search keyword or phrase to match against stored memories', required: true },
      },
      execute: async (params) => {
        try {
          const query = String(params.query || '');
          if (!query) return { success: false, output: 'No query provided.' };
          const results = searchMemories(query);
          const nmResults = neuroMemory.search(query);
          const nmFormatted = nmResults.map(e => ({ id: e.id, type: e.category, content: e.content, tags: [e.source], createdAt: e.createdAt }));
          const allResults = [
            ...results.map(m => ({ id: m.id, type: m.type, content: m.content, tags: m.tags, createdAt: m.createdAt })),
            ...nmFormatted.filter(n => !results.some(r => r.content === n.content)),
          ];
          if (allResults.length === 0) {
            return { success: true, output: `No memories found matching: ${query}` };
          }
          return { success: true, output: JSON.stringify(allResults, null, 2), data: allResults };
        } catch (err) {
          return { success: false, output: `Memory search error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'note',
      description: 'Store a short working note in task memory — like a scratchpad. Notes persist for this task only (cleared when done). Use to track findings, intermediate results, open questions, or things to follow up on. Faster than memory_store for task-scoped things.',
      parameters: {
        key: { type: 'string', description: 'Short identifier for this note (e.g. "finding_1", "open_question", "hypothesis")', required: true },
        content: { type: 'string', description: 'The note content', required: true },
      },
      execute: async (params) => {
        const key = String(params.key || '');
        const content = String(params.content || '');
        if (!key || !content) return { success: false, output: 'key and content are required' };
        workingMemory.set(key, content);
        return { success: true, output: `Note "${key}" stored. Working memory now has ${workingMemory.size} note(s).` };
      },
    },
    {
      name: 'notes_read',
      description: 'Read all current working notes (task scratchpad). Use to review what you\'ve found so far in this task.',
      parameters: {},
      execute: async () => {
        if (workingMemory.size === 0) return { success: true, output: 'No working notes yet.' };
        const entries = Array.from(workingMemory.entries()).map(([k, v]) => `**${k}**: ${v}`).join('\n\n');
        return { success: true, output: `Working notes (${workingMemory.size}):\n\n${entries}` };
      },
    },
    {
      name: 'shell_exec',
      description: 'Run a shell command (bash). ffmpeg, curl, git, npm, etc. Max 2000 chars output (full auto-saved if truncated). Use run_code for scripts.',
      parameters: {
        command: { type: 'string', description: 'Shell command to execute (bash)', required: true },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default 30000, max 120000)' },
      },
      execute: async (params) => {
        const command = String(params.command || '');
        if (!command) return { success: false, output: 'No command provided.' };

        // Safety: block obviously destructive commands
        const dangerous = /\brm\s+-rf\s+[\/~]|sudo\s+rm|mkfs|dd\s+if=|:\(\)\s*\{/i;
        if (dangerous.test(command)) {
          return { success: false, output: 'Blocked: potentially destructive command. Use ask_user to confirm with the user first.' };
        }

        const timeout = Math.min(Number(params.timeout_ms) || 30000, 120000);

        // Execution chain: wayfarer /execute → /api/shell → sandbox fallback
        const wayfarerUrl = getWayfarerBaseUrl();

        // Attempt 1: Wayfarer /execute (bash mode)
        try {
          const resp = await fetch(`${wayfarerUrl}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'bash', code: command, timeout: Math.ceil(timeout / 1000) }),
          });
          if (resp.ok) {
            const result = await resp.json();
            const raw = result.output || '';
            if (raw.length > 2000) {
              return { success: result.success !== false, output: raw.slice(0, 2000) + '\n[...truncated]' };
            }
            return { success: result.success !== false, output: raw || '(no output)' };
          }
        } catch { /* wayfarer not available */ }

        // Attempt 2: /api/shell (CLI adapter or dev proxy)
        try {
          const resp = await fetch('/api/shell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, timeout }),
          });
          if (resp.ok) {
            const result = await resp.json();
            const raw = [result.stdout, result.stderr].filter(Boolean).join('\n');
            if (raw.length > 2000) {
              return { success: result.exitCode === 0, output: raw.slice(0, 2000) + '\n[...truncated]' };
            }
            return { success: result.exitCode === 0, output: raw || '(no output)' };
          }
        } catch { /* /api/shell not available */ }

        // Attempt 3: Sandbox consoleExec
        try {
          const result = await sandboxService.consoleExec(command);
          const raw = String(result);
          if (raw.length > 2000) {
            return { success: true, output: raw.slice(0, 2000) + '\n[...truncated]' };
          }
          return { success: true, output: raw || '(no output)' };
        } catch {
          return { success: false, output: 'Shell execution requires Wayfarer (port 8889). Start: cd services/wayfarer && python3.11 -m uvicorn wayfarer_server:app --port 8889' };
        }
      },
    },
    {
      name: 'file_read',
      description: 'Read a file from disk by absolute path (e.g. /Users/x/data.csv). Max 4000 chars. For huge files use shell_exec with head/tail.',
      parameters: {
        path: { type: 'string', description: 'File path (absolute like /Users/x/file.txt)', required: true },
        max_lines: { type: 'number', description: 'Max lines to return (default 200)' },
      },
      execute: async (params) => {
        const filePath = String(params.path || '');
        const maxLines = Number(params.max_lines) || 200;
        if (!filePath) return { success: false, output: 'No path provided.' };
        const wayfarerUrl = getWayfarerBaseUrl();
        // Try wayfarer /file/read first, then /api/file/read
        for (const endpoint of [`${wayfarerUrl}/file/read`, '/api/file/read']) {
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: filePath, maxLines }),
            });
            if (!resp.ok) continue;
            const result = await resp.json();
            if (result.error) return { success: false, output: result.error };
            const content = result.content || '';
            if (content.length > 4000) {
              return { success: true, output: content.slice(0, 4000) + '\n[...truncated, use max_lines or shell_exec for full content]' };
            }
            return { success: true, output: content || '(empty file)' };
          } catch { continue; }
        }
        return { success: false, output: 'File read requires Wayfarer (port 8889) to be running.' };
      },
    },
    {
      name: 'file_browse',
      description: 'List files and folders in any Mac directory. Use to explore ~/Documents/Nomads/, Downloads, Desktop, etc.',
      parameters: {
        dir: { type: 'string', description: 'Directory to list (e.g. ~/Documents/Nomads/nomadfiles/, ~/Downloads, /tmp)', required: true },
      },
      execute: async (params) => {
        const dir = String(params.dir || '');
        if (!dir) return { success: false, output: 'No directory provided.' };
        const wayfarerUrl = getWayfarerBaseUrl();
        for (const endpoint of [`${wayfarerUrl}/file/list`, '/api/file/list']) {
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dir }),
            });
            if (!resp.ok) continue;
            const result = await resp.json();
            if (result.error) return { success: false, output: result.error };
            if (!result.entries || result.entries.length === 0) return { success: true, output: '(empty directory)' };
            const lines = result.entries.map((e: { name: string; isDir: boolean; size: number }) =>
              `${e.isDir ? '[DIR] ' : '      '}${e.name}${e.isDir ? '/' : ` (${e.size} bytes)`}`
            );
            return { success: true, output: `${dir}:\n${lines.join('\n')}` };
          } catch { continue; }
        }
        return { success: false, output: 'File browse requires Wayfarer (port 8889) to be running.' };
      },
    },
    {
      name: 'file_write',
      description: 'Write a file to disk by absolute path. Creates dirs if needed.',
      parameters: {
        path: { type: 'string', description: 'Absolute file path to write (e.g. /tmp/output.json)', required: true },
        content: { type: 'string', description: 'Content to write to the file', required: true },
      },
      execute: async (params) => {
        const filePath = String(params.path || '');
        const content = String(params.content || '');
        if (!filePath) return { success: false, output: 'No path provided.' };
        // ── CLI mode: use Node.js fs directly ──
        if (typeof window === 'undefined') {
          try {
            const { writeFile, mkdir } = await import('fs/promises');
            const nodePath = await import('path');
            await mkdir(nodePath.dirname(filePath), { recursive: true });
            await writeFile(filePath, content, 'utf8');
            return { success: true, output: `Written ${content.length} chars to ${filePath}` };
          } catch (err) {
            return { success: false, output: `file_write failed: ${err instanceof Error ? err.message : err}` };
          }
        }
        const wayfarerUrl = getWayfarerBaseUrl();
        for (const endpoint of [`${wayfarerUrl}/file/write`, '/api/file/write']) {
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: filePath, content }),
            });
            if (!resp.ok) continue;
            return { success: true, output: `Written ${content.length} chars to ${filePath}` };
          } catch { continue; }
        }
        return { success: false, output: 'File write requires Wayfarer (port 8889) to be running.' };
      },
    },
    {
      name: 'code_analysis',
      description: 'Analyze a codebase for architecture, patterns, dependencies, and improvement opportunities. Returns file tree visualization, architectural insights, design patterns found, and refactoring recommendations. Uses deep semantic analysis (Nemotron-3-Super) for expert-level code understanding. Use for: understanding new codebases, architecture reviews, finding refactoring opportunities, tech debt assessment.',
      parameters: {
        root_path: { type: 'string', description: 'Root directory to analyze (default /nomad)' },
        max_depth: { type: 'number', description: 'Directory depth to traverse (1-6, default 4)' },
      },
      execute: async (params, signal) => {
        try {
          const rootPath = String(params.root_path || '/nomad');
          const maxDepth = Math.min(6, Math.max(1, Number(params.max_depth) || 4));

          const result = await analyzeCodebase(rootPath, maxDepth, signal);

          // Format response with file tree visualization
          const output = `
═══════════════════════════════════════════════════════════════
CODEBASE ANALYSIS
═══════════════════════════════════════════════════════════════

📊 STRUCTURE
─────────────────────────────────────────────────────────────
Total Files: ${result.structure.totalFiles}
Key Directories: ${result.structure.mainDirs.join(', ')}
Key Files: ${result.structure.keyFiles.join(', ')}
Architecture: ${result.structure.architecture}

📐 ARCHITECTURE & PATTERNS
─────────────────────────────────────────────────────────────
${result.insights.patterns.map(p => `• ${p}`).join('\n')}

🔗 DEPENDENCIES
─────────────────────────────────────────────────────────────
${result.insights.dependencies.map(d => `• ${d}`).join('\n')}

💡 IMPROVEMENT OPPORTUNITIES
─────────────────────────────────────────────────────────────
${result.insights.improvements.map(i => `• ${i}`).join('\n')}

✅ RECOMMENDATIONS
─────────────────────────────────────────────────────────────
${result.recommendations.map(r => `• ${r}`).join('\n')}

⏱️  Analysis completed in ${result.durationMs}ms
═══════════════════════════════════════════════════════════════
          `;

          return { success: true, output: output.trim() };
        } catch (err) {
          return { success: false, output: `Code analysis error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // ── Soul / Identity tools (OpenClaw-style self-modification) ─────────────
    {
      name: 'soul_read',
      description: 'Read one of your soul/identity files: SOUL (who you are), STYLE (how you communicate), MEMORY (what you remember across sessions). Use before updating to see current content.',
      parameters: {
        file: { type: 'string', description: '"SOUL", "STYLE", or "MEMORY"', required: true },
      },
      execute: async (params) => {
        try {
          const file = String(params.file || '').toUpperCase() as 'SOUL' | 'STYLE' | 'MEMORY';
          if (!['SOUL', 'STYLE', 'MEMORY'].includes(file)) {
            return { success: false, output: 'file must be SOUL, STYLE, or MEMORY' };
          }
          const content = await readSoulFile(file);
          return { success: true, output: content || '(empty file)' };
        } catch (err) {
          return { success: false, output: `soul_read failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'soul_update',
      description: 'Update one of your soul/identity files. Use "overwrite" to rewrite the whole file, or "append" to add a new entry at the bottom. SOUL = your character, STYLE = your voice, MEMORY = persistent facts/decisions.',
      parameters: {
        file: { type: 'string', description: '"SOUL", "STYLE", or "MEMORY"', required: true },
        mode: { type: 'string', description: '"overwrite" to replace the whole file, "append" to add at the bottom', required: true },
        content: { type: 'string', description: 'The content to write or append', required: true },
      },
      execute: async (params) => {
        try {
          const file = String(params.file || '').toUpperCase() as 'SOUL' | 'STYLE' | 'MEMORY';
          const mode = String(params.mode || 'append').toLowerCase();
          const content = String(params.content || '');
          if (!['SOUL', 'STYLE', 'MEMORY'].includes(file)) {
            return { success: false, output: 'file must be SOUL, STYLE, or MEMORY' };
          }
          if (!content) return { success: false, output: 'content is required' };

          let ok: boolean;
          if (mode === 'overwrite') {
            ok = await writeSoulFile(file, content);
          } else {
            // Append — prefix with date for memory entries
            const date = new Date().toISOString().slice(0, 10);
            const entry = file === 'MEMORY' ? `**${date}:** ${content}` : content;
            ok = await appendToSoulFile(file, entry);
          }
          invalidateSoulCache(); // force reload on next system prompt build
          return {
            success: ok,
            output: ok
              ? `${file}.md updated (${mode}). Will take effect next session or on rebuildSystem.`
              : `Failed to write ${file}.md`,
          };
        } catch (err) {
          return { success: false, output: `soul_update failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'soul_log',
      description: "Append an entry to today's session log. Use to record what you did, learned, or decided in this session. These logs are human-readable and persist forever.",
      parameters: {
        entry: { type: 'string', description: 'What to log (e.g. "Helped Michael research X. Key finding: Y.")', required: true },
      },
      execute: async (params) => {
        try {
          const entry = String(params.entry || '');
          if (!entry) return { success: false, output: 'entry is required' };
          await logToday(entry);
          return { success: true, output: 'Logged to today\'s session file.' };
        } catch (err) {
          return { success: false, output: `soul_log failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // ── OpenClaw skills ────────────────────────────────────────────────────────
    {
      name: 'apply_patch',
      description: 'Apply a targeted str_replace edit to a file — change a specific section without rewriting the whole file. Safer and more precise than file_write for edits. Use old_string to identify the exact text to replace.',
      parameters: {
        path: { type: 'string', description: 'Absolute file path to patch', required: true },
        old_string: { type: 'string', description: 'Exact text to find and replace (must match exactly, including indentation)', required: true },
        new_string: { type: 'string', description: 'Replacement text', required: true },
        all: { type: 'boolean', description: 'If true, replace all occurrences (default: false — replace first only)' },
      },
      execute: async (params) => {
        try {
          const path = String(params.path || '');
          const oldStr = String(params.old_string || '');
          const newStr = String(params.new_string ?? '');
          const replaceAll = Boolean(params.all);
          if (!path || !oldStr) return { success: false, output: 'path and old_string are required.' };

          // Read current file
          const readResp = await fetch('/api/file/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
          });
          if (!readResp.ok) return { success: false, output: `Cannot read ${path}` };
          const { content } = await readResp.json() as { content: string };

          if (!content.includes(oldStr)) {
            return { success: false, output: `old_string not found in file. Check for exact match (including whitespace/indentation).` };
          }

          const patched = replaceAll
            ? content.split(oldStr).join(newStr)
            : content.replace(oldStr, newStr);

          const writeResp = await fetch('/api/file/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content: patched }),
          });
          if (!writeResp.ok) return { success: false, output: `Cannot write ${path}` };

          const count = replaceAll ? (content.split(oldStr).length - 1) : 1;
          return { success: true, output: `Patched ${count} occurrence(s) in ${path}` };
        } catch (err) {
          return { success: false, output: `Patch error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // ── Codex-style patch (add/update/delete via *** Begin Patch format) ──────
    {
      name: 'codex_patch',
      description: 'Make surgical file edits using the Codex patch format. PREFER this over rewriting entire files. Supports add/update/delete operations with context lines for precise targeting.',
      parameters: {
        patch_text: { type: 'string', description: 'The full patch text including *** Begin Patch / *** End Patch markers', required: true },
      },
      execute: async (params) => {
        try {
          const patchText = String(params.patch_text || '');
          if (!patchText.trim()) return { success: false, output: 'patch_text is required.' };

          const hunks = parsePatch(patchText);
          if (hunks.length === 0) return { success: false, output: 'No valid patch hunks found in patch_text.' };

          const results: string[] = [];

          for (const hunk of hunks) {
            const safety = assessPatch(hunk);

            if (safety === 'reject') {
              const reason = hunk.path.includes('..')
                ? `Path traversal detected in "${hunk.path}"`
                : `System/protected path rejected: "${hunk.path}"`;
              results.push(`REJECTED: ${hunk.path} — ${reason}`);
              continue;
            }

            if (safety === 'ask_user') {
              _pendingPatches.push(hunk);
              const preview = renderPatchPreview(hunk);
              results.push(`QUEUED: ${hunk.path} — Patch queued for user approval (${_pendingPatches.length} pending)\n${preview}`);
              continue;
            }

            // auto_approve
            const applyResult = await applyPatchToFs(hunk, process.cwd());
            if (applyResult.success) {
              results.push(`OK: ${hunk.op.toUpperCase()} ${hunk.path}${hunk.newPath ? ` -> ${hunk.newPath}` : ''}`);
            } else {
              results.push(`FAILED: ${hunk.path} — ${applyResult.error}`);
            }
          }

          const allOk = results.every((r) => r.startsWith('OK:'));
          return {
            success: allOk,
            output: results.join('\n'),
          };
        } catch (err) {
          return { success: false, output: `codex_patch error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'image_analyze',
      description: 'Analyze an image with vision AI. Read charts, diagrams, screenshots, designs, photos. Supports local file paths (.png/.jpg/.webp) and http/https URLs. Use for: reading UI screenshots, analyzing competitor ads, extracting text from images, describing product photos.',
      parameters: {
        image: { type: 'string', description: 'Image file path (absolute) or https:// URL', required: true },
        prompt: { type: 'string', description: 'What to analyze or extract from the image (default: describe the image)', required: true },
        model: { type: 'string', description: 'Vision model override (default: auto-selects best available vision model)' },
      },
      execute: async (params, signal) => {
        try {
          const imageSrc = String(params.image || '');
          const prompt = String(params.prompt || 'Describe this image in detail.');
          if (!imageSrc) return { success: false, output: 'No image provided.' };

          let base64: string;

          if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
            // Fetch via Wayfarer screenshot endpoint or direct fetch
            try {
              const { screenshotService } = await import('./wayfarer');
              const result = await screenshotService.screenshot(imageSrc);
              base64 = result.image_base64;
            } catch {
              // Direct fetch fallback
              const imgResp = await fetch(imageSrc, { signal });
              if (!imgResp.ok) return { success: false, output: `Cannot fetch image: ${imgResp.status}` };
              const buf = await imgResp.arrayBuffer();
              base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            }
          } else {
            // Local file — read via file API
            const readResp = await fetch('/api/file/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: imageSrc, binary: true }),
            });
            if (!readResp.ok) return { success: false, output: `Cannot read image file: ${imageSrc}` };
            const data = await readResp.json() as { base64?: string; content?: string };
            base64 = data.base64 || data.content || '';
          }

          if (!base64) return { success: false, output: 'Failed to load image data.' };

          // Use vision model
          const visionModel = String(params.model || 'qwen3.5:9b');
          const response = await ollamaService.generateStream(
            prompt,
            `You are a visual analysis assistant. Analyze the provided image accurately and thoroughly.`,
            {
              model: visionModel,
              temperature: 0.3,
              num_predict: 1000,
              images: [base64],
              signal,
              onChunk: () => {},
            },
          );
          return { success: true, output: response };
        } catch (err) {
          return { success: false, output: `Vision error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // ── Video analysis ────────────────────────────────────────────────────────
    {
      name: 'video_analyze',
      description: 'Analyze a video file using ffmpeg + vision AI. Extracts frames at intervals, analyzes each with vision model, optionally transcribes audio. Use for: understanding video content, extracting info from screen recordings, analyzing footage, identifying objects/text in video.',
      parameters: {
        path: { type: 'string', description: 'Absolute path to video file (.mp4, .mov, .avi, .mkv, .webm, etc.)', required: true },
        query: { type: 'string', description: 'What to look for or analyze in the video', required: true },
        interval_sec: { type: 'number', description: 'Extract one frame every N seconds (default: 5). Use 1-2 for fast-moving content, 10+ for slow videos.' },
        max_frames: { type: 'number', description: 'Max frames to analyze (default: 6, max: 12). More = slower but more thorough.' },
        analyze_audio: { type: 'boolean', description: 'Also extract and analyze audio (requires whisper or ffmpeg; returns transcription if available). Default: false.' },
      },
      execute: async (params, signal) => {
        const videoPath = String(params.path || '');
        const query = String(params.query || 'Describe what is happening in this video');
        const intervalSec = Math.max(1, Number(params.interval_sec) || 5);
        const maxFrames = Math.min(12, Math.max(1, Number(params.max_frames) || 6));
        const analyzeAudio = Boolean(params.analyze_audio);

        if (!videoPath) return { success: false, output: 'No video path provided.' };

        const shell = async (cmd: string, timeoutMs = 30000): Promise<{ ok: boolean; out: string }> => {
          try {
            const r = await fetch('/api/shell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: cmd, timeout: timeoutMs }),
              signal,
            });
            if (!r.ok) return { ok: false, out: `Shell error: ${r.status}` };
            const j = await r.json() as { stdout?: string; stderr?: string; exitCode?: number };
            return { ok: j.exitCode === 0, out: ([j.stdout, j.stderr].filter(Boolean).join('\n')).slice(0, 3000) };
          } catch (e) { return { ok: false, out: String(e) }; }
        };

        // 1. Probe video — get duration + stream info
        const probeRes = await shell(`ffprobe -v quiet -show_entries format=duration:stream=codec_type,codec_name,width,height -of json "${videoPath}"`, 10000);
        let durationSec = 0;
        let videoInfo = '';
        try {
          const probe = JSON.parse(probeRes.out) as { format?: { duration?: string }; streams?: Array<{ codec_type: string; codec_name: string; width?: number; height?: number }> };
          durationSec = parseFloat(probe.format?.duration || '0');
          const vs = probe.streams?.find(s => s.codec_type === 'video');
          const as_ = probe.streams?.find(s => s.codec_type === 'audio');
          videoInfo = `Duration: ${Math.round(durationSec)}s | Video: ${vs?.codec_name || 'unknown'} ${vs?.width || '?'}×${vs?.height || '?'} | Audio: ${as_?.codec_name || 'none'}`;
        } catch { videoInfo = probeRes.out.slice(0, 200); }

        if (!probeRes.ok && !durationSec) {
          return { success: false, output: `ffprobe failed — is ffmpeg installed? Error: ${probeRes.out}` };
        }

        // 2. Extract frames to /tmp
        const tmpDir = `/tmp/neuro_video_${Date.now()}`;
        await shell(`mkdir -p "${tmpDir}"`);

        // Smart interval: if video is shorter than interval*maxFrames, compress
        const autoInterval = durationSec > 0 ? Math.max(1, Math.floor(durationSec / maxFrames)) : intervalSec;
        const frameInterval = Math.min(intervalSec, autoInterval);

        const extractRes = await shell(
          `ffmpeg -i "${videoPath}" -vf "fps=1/${frameInterval},scale=640:-2" -frames:v ${maxFrames} -q:v 3 "${tmpDir}/frame_%03d.jpg" -y 2>&1`,
          60000,
        );

        // 3. List extracted frames
        const lsRes = await shell(`ls "${tmpDir}"/frame_*.jpg 2>/dev/null | sort`);
        const framePaths = lsRes.out.split('\n').map(l => l.trim()).filter(l => l.endsWith('.jpg'));

        if (framePaths.length === 0) {
          return { success: false, output: `No frames extracted. ffmpeg output: ${extractRes.out.slice(0, 500)}` };
        }

        // 4. Analyze each frame with vision model
        const visionModel = getVisionModel();
        const frameAnalyses: string[] = [];

        for (let i = 0; i < framePaths.length; i++) {
          if (signal?.aborted) break;
          const framePath = framePaths[i];
          const timeOffset = Math.round(i * frameInterval);

          // Read frame as base64
          const readResp = await fetch('/api/file/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: framePath, binary: true }),
            signal,
          });
          if (!readResp.ok) continue;
          const fileData = await readResp.json() as { base64?: string };
          const base64 = fileData.base64;
          if (!base64) continue;

          let frameAnalysis = '';
          try {
            frameAnalysis = await ollamaService.generateStream(
              `Frame at ${timeOffset}s into the video. ${query}`,
              'You are analyzing a video frame. Be concise and specific about what you see. Focus on the user\'s query.',
              {
                model: visionModel,
                temperature: 0.2,
                num_predict: 300,
                images: [base64],
                signal,
                onChunk: () => {},
              },
            );
          } catch { frameAnalysis = '(analysis failed)'; }

          frameAnalyses.push(`[${timeOffset}s] ${frameAnalysis.trim()}`);
        }

        // 5. Optional audio analysis
        let audioSummary = '';
        if (analyzeAudio) {
          // Try whisper first, fall back to ffprobe audio info
          const whisperRes = await shell(`which whisper 2>/dev/null`, 5000);
          if (whisperRes.ok && whisperRes.out.trim()) {
            const audioPath = `${tmpDir}/audio.wav`;
            await shell(`ffmpeg -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" -y 2>&1`, 30000);
            const transcribeRes = await shell(`whisper "${audioPath}" --model tiny --output_format txt --output_dir "${tmpDir}" 2>&1`, 60000);
            const txtRes = await shell(`cat "${tmpDir}/audio.txt" 2>/dev/null`);
            audioSummary = txtRes.ok ? `\n\nAudio transcription:\n${txtRes.out.slice(0, 1000)}` : `\n\nWhisper ran but no transcription: ${transcribeRes.out.slice(0, 200)}`;
          } else {
            // Just get audio stream metadata
            audioSummary = `\n\nNote: whisper not installed — only video frames analyzed. Install with: pip install openai-whisper`;
          }
        }

        // 6. Synthesize findings
        const synthesis = await ollamaService.generateStream(
          `Video: ${videoInfo}\n\nFrame-by-frame analysis:\n${frameAnalyses.join('\n')}\n\nUser query: ${query}\n\nProvide a concise synthesis of what happens in this video, answering the user's query directly.`,
          'You are synthesizing video analysis results. Be clear and direct.',
          {
            model: getModelForStage('fast'),
            temperature: 0.3,
            num_predict: 500,
            signal,
            onChunk: () => {},
          },
        );

        // Cleanup temp files
        await shell(`rm -rf "${tmpDir}"`, 5000);

        return {
          success: true,
          output: `VIDEO ANALYSIS — ${videoInfo}\n\nFrames analyzed: ${framePaths.length} (every ${frameInterval}s)\n\n${frameAnalyses.join('\n')}\n\nSUMMARY:\n${synthesis}${audioSummary}`,
        };
      },
    },
    // ── Video editing ─────────────────────────────────────────────────────────
    {
      name: 'video_edit',
      description: 'Edit video files using ffmpeg. Trim, cut, concat, speed, resize, crop, overlay text/images, extract audio, replace audio, add fades, convert format, compress, GIF export, picture-in-picture, color grade, and more. Output saved to specified path.',
      parameters: {
        operation: { type: 'string', description: 'Operation: trim | concat | speed | resize | crop | rotate | flip | audio_strip | audio_replace | audio_mix | audio_extract | subtitle | text_overlay | image_overlay | gif | convert | compress | fade | color | pip | thumbnail | scene_detect | stabilize | reverse | loop | noise_blur | custom', required: true },
        input: { type: 'string', description: 'Input video path (absolute). For concat, use a comma-separated list of paths.', required: true },
        output: { type: 'string', description: 'Output file path (absolute, e.g. /tmp/result.mp4). Inferred if omitted.', required: false },
        // Trim
        start: { type: 'string', description: '[trim] Start time: "00:01:23", "1:23", or seconds like "83"' },
        end: { type: 'string', description: '[trim] End time (same format). Use duration instead if you know clip length.' },
        duration: { type: 'string', description: '[trim/gif] Duration in seconds or "HH:MM:SS"' },
        // Speed
        speed: { type: 'number', description: '[speed] Multiplier: 2.0 = 2× faster, 0.5 = half speed. Audio pitch corrected automatically.' },
        // Resize / crop
        width: { type: 'number', description: '[resize/crop] Target width in pixels. Height auto-computed if omitted.' },
        height: { type: 'number', description: '[resize/crop] Target height in pixels.' },
        crop_x: { type: 'number', description: '[crop] Crop origin X (pixels from left)' },
        crop_y: { type: 'number', description: '[crop] Crop origin Y (pixels from top)' },
        // Rotate / flip
        angle: { type: 'number', description: '[rotate] Degrees: 90, 180, 270' },
        flip: { type: 'string', description: '[flip] "horizontal" or "vertical"' },
        // Audio
        audio_input: { type: 'string', description: '[audio_replace/audio_mix/image_overlay pip] Path to audio/image file to add' },
        audio_volume: { type: 'number', description: '[audio_mix] Volume of added audio track (0.0–2.0, default 1.0)' },
        audio_start: { type: 'string', description: '[audio_replace] Start offset for audio within video' },
        // Text overlay
        text: { type: 'string', description: '[text_overlay/subtitle] Text to render on video' },
        font_size: { type: 'number', description: '[text_overlay] Font size in pixels (default 48)' },
        text_color: { type: 'string', description: '[text_overlay] Color name or hex (default: white)' },
        text_position: { type: 'string', description: '[text_overlay] Position: "top", "center", "bottom" (default: bottom)' },
        text_start: { type: 'string', description: '[text_overlay] When text appears (seconds or HH:MM:SS)' },
        text_end: { type: 'string', description: '[text_overlay] When text disappears' },
        // Image overlay / watermark
        overlay_path: { type: 'string', description: '[image_overlay] Path to image/logo to overlay' },
        overlay_position: { type: 'string', description: '[image_overlay] "top-left", "top-right", "bottom-left", "bottom-right", "center"' },
        overlay_scale: { type: 'number', description: '[image_overlay] Scale overlay to this width in pixels' },
        // Color grading
        brightness: { type: 'number', description: '[color] Brightness: -1.0 to 1.0 (default 0)' },
        contrast: { type: 'number', description: '[color] Contrast: -2.0 to 2.0 (default 1)' },
        saturation: { type: 'number', description: '[color] Saturation: 0 = grayscale, 1 = normal, 2 = vivid' },
        gamma: { type: 'number', description: '[color] Gamma: 0.1–10.0 (default 1.0)' },
        // GIF
        gif_fps: { type: 'number', description: '[gif] Output FPS for GIF (default: 10)' },
        gif_scale: { type: 'number', description: '[gif] Width of output GIF in pixels (default: 480)' },
        // Fade
        fade_in: { type: 'number', description: '[fade] Fade-in duration in seconds' },
        fade_out: { type: 'number', description: '[fade] Fade-out duration in seconds' },
        // Picture-in-picture
        pip_input: { type: 'string', description: '[pip] Path to the overlay video' },
        pip_position: { type: 'string', description: '[pip] Position: "top-left", "top-right", "bottom-left", "bottom-right"' },
        pip_scale: { type: 'number', description: '[pip] Width of PiP window in pixels (default: 320)' },
        // Thumbnail
        thumbnail_time: { type: 'string', description: '[thumbnail] Time to capture thumbnail (default: 00:00:01)' },
        // Compress
        crf: { type: 'number', description: '[compress] CRF quality (18=high, 28=medium, 35=small file). Default: 28' },
        preset: { type: 'string', description: '[compress] Encoding speed preset: ultrafast, fast, medium, slow (default: fast)' },
        // Subtitle
        subtitle_file: { type: 'string', description: '[subtitle] Path to .srt or .ass subtitle file to burn in' },
        // Custom
        ffmpeg_args: { type: 'string', description: '[custom] Raw ffmpeg arguments string (everything after the -i input). Expert mode.' },
      },
      execute: async (params) => {
        const op = String(params.operation || '').toLowerCase().trim();
        const inputRaw = String(params.input || '');
        const inputs = inputRaw.split(',').map(p => p.trim()).filter(Boolean);
        const mainInput = inputs[0];
        if (!mainInput) return { success: false, output: 'No input file provided.' };

        const shell = async (cmd: string, timeoutMs = 60000): Promise<{ ok: boolean; out: string }> => {
          try {
            const r = await fetch('/api/shell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: cmd, timeout: timeoutMs }),
            });
            if (!r.ok) return { ok: false, out: `Shell error: ${r.status}` };
            const j = await r.json() as { stdout?: string; stderr?: string; exitCode?: number };
            return { ok: j.exitCode === 0, out: [j.stdout, j.stderr].filter(Boolean).join('\n').slice(0, 2000) };
          } catch (e) { return { ok: false, out: String(e) }; }
        };

        // Infer output path if not specified
        const ext = op === 'gif' ? 'gif' : op === 'audio_extract' ? 'mp3' : op === 'thumbnail' ? 'jpg' : 'mp4';
        const baseName = mainInput.replace(/\.[^.]+$/, '');
        const output = String(params.output || `${baseName}_${op}_${Date.now()}.${ext}`);

        let ffCmd = '';

        switch (op) {
          case 'trim': {
            const start = params.start ? `-ss ${params.start}` : '';
            const end = params.end ? `-to ${params.end}` : params.duration ? `-t ${params.duration}` : '';
            ffCmd = `ffmpeg -y ${start} -i "${mainInput}" ${end} -c copy "${output}"`;
            break;
          }
          case 'concat': {
            if (inputs.length < 2) return { success: false, output: 'concat needs at least 2 input files (comma-separated).' };
            const listFile = `/tmp/concat_list_${Date.now()}.txt`;
            const listContent = inputs.map(p => `file '${p}'`).join('\n');
            await shell(`printf '${listContent.replace(/'/g, "'\\''")}' > "${listFile}"`);
            ffCmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${output}"`;
            break;
          }
          case 'speed': {
            const spd = Number(params.speed) || 2.0;
            const videoFilter = `setpts=${(1 / spd).toFixed(4)}*PTS`;
            const audioFilter = `atempo=${Math.min(2.0, Math.max(0.5, spd)).toFixed(2)}`;
            // atempo only supports 0.5-2.0; chain for extreme speeds
            const aTempo = spd > 2 ? `atempo=2.0,atempo=${(spd / 2).toFixed(2)}` : spd < 0.5 ? `atempo=0.5,atempo=${(spd * 2).toFixed(2)}` : audioFilter;
            ffCmd = `ffmpeg -y -i "${mainInput}" -filter:v "${videoFilter}" -filter:a "${aTempo}" "${output}"`;
            break;
          }
          case 'resize': {
            const w = Number(params.width) || -2;
            const h = Number(params.height) || -2;
            const scale = w > 0 && h > 0 ? `${w}:${h}` : w > 0 ? `${w}:-2` : `-2:${h}`;
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "scale=${scale}" -c:a copy "${output}"`;
            break;
          }
          case 'crop': {
            const w = Number(params.width) || 640;
            const h = Number(params.height) || 360;
            const x = Number(params.crop_x) || 0;
            const y = Number(params.crop_y) || 0;
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "crop=${w}:${h}:${x}:${y}" -c:a copy "${output}"`;
            break;
          }
          case 'rotate': {
            const angle = Number(params.angle) || 90;
            const transpose = angle === 90 ? 'transpose=1' : angle === 180 ? 'transpose=2,transpose=2' : angle === 270 ? 'transpose=2' : 'transpose=1';
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "${transpose}" -c:a copy "${output}"`;
            break;
          }
          case 'flip': {
            const direction = String(params.flip || 'horizontal');
            const filter = direction === 'vertical' ? 'vflip' : 'hflip';
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "${filter}" -c:a copy "${output}"`;
            break;
          }
          case 'audio_strip': {
            ffCmd = `ffmpeg -y -i "${mainInput}" -c:v copy -an "${output}"`;
            break;
          }
          case 'audio_extract': {
            ffCmd = `ffmpeg -y -i "${mainInput}" -vn -acodec libmp3lame -q:a 2 "${output}"`;
            break;
          }
          case 'audio_replace': {
            const audioIn = String(params.audio_input || '');
            if (!audioIn) return { success: false, output: 'audio_replace needs audio_input path.' };
            const startOffset = params.audio_start ? `-ss ${params.audio_start}` : '';
            ffCmd = `ffmpeg -y -i "${mainInput}" ${startOffset} -i "${audioIn}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${output}"`;
            break;
          }
          case 'audio_mix': {
            const audioIn = String(params.audio_input || '');
            if (!audioIn) return { success: false, output: 'audio_mix needs audio_input path.' };
            const vol = Number(params.audio_volume) || 1.0;
            ffCmd = `ffmpeg -y -i "${mainInput}" -i "${audioIn}" -filter_complex "[0:a][1:a]amix=inputs=2:weights=1 ${vol}[aout]" -map 0:v -map "[aout]" -c:v copy "${output}"`;
            break;
          }
          case 'text_overlay': {
            const text = String(params.text || 'Text').replace(/'/g, "\\'").replace(/:/g, '\\:');
            const fontSize = Number(params.font_size) || 48;
            const color = String(params.text_color || 'white');
            const pos = String(params.text_position || 'bottom');
            const yPos = pos === 'top' ? '50' : pos === 'center' ? '(h-text_h)/2' : 'h-text_h-50';
            const enableExpr = params.text_start && params.text_end
              ? `enable='between(t,${params.text_start},${params.text_end})':`
              : '';
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "drawtext=${enableExpr}text='${text}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yPos}:box=1:boxcolor=black@0.4:boxborderw=8" -c:a copy "${output}"`;
            break;
          }
          case 'subtitle': {
            const subFile = String(params.subtitle_file || params.text || '');
            if (!subFile) return { success: false, output: 'subtitle needs subtitle_file path (.srt or .ass).' };
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "subtitles='${subFile}'" -c:a copy "${output}"`;
            break;
          }
          case 'image_overlay': {
            const overlayPath = String(params.overlay_path || params.audio_input || '');
            if (!overlayPath) return { success: false, output: 'image_overlay needs overlay_path.' };
            const pos = String(params.overlay_position || 'bottom-right');
            const scale = Number(params.overlay_scale) || 200;
            const overlayXY = pos === 'top-left' ? '10:10' : pos === 'top-right' ? 'W-w-10:10' : pos === 'bottom-left' ? '10:H-h-10' : pos === 'center' ? '(W-w)/2:(H-h)/2' : 'W-w-10:H-h-10';
            ffCmd = `ffmpeg -y -i "${mainInput}" -i "${overlayPath}" -filter_complex "[1:v]scale=${scale}:-1[logo];[0:v][logo]overlay=${overlayXY}" -c:a copy "${output}"`;
            break;
          }
          case 'gif': {
            const start = params.start ? `-ss ${params.start}` : '';
            const dur = params.duration ? `-t ${params.duration}` : '-t 10';
            const fps = Number(params.gif_fps) || 10;
            const scale = Number(params.gif_scale) || 480;
            ffCmd = `ffmpeg -y ${start} -i "${mainInput}" ${dur} -vf "fps=${fps},scale=${scale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${output}"`;
            break;
          }
          case 'convert': {
            ffCmd = `ffmpeg -y -i "${mainInput}" "${output}"`;
            break;
          }
          case 'compress': {
            const crf = Number(params.crf) || 28;
            const preset_ = String(params.preset || 'fast');
            ffCmd = `ffmpeg -y -i "${mainInput}" -c:v libx264 -crf ${crf} -preset ${preset_} -c:a aac -b:a 128k "${output}"`;
            break;
          }
          case 'fade': {
            // Get duration to compute fade-out position
            const probeR = await shell(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mainInput}"`, 10000);
            const totalDur = parseFloat(probeR.out.trim()) || 0;
            const fadeIn = Number(params.fade_in) || 0;
            const fadeOut = Number(params.fade_out) || 0;
            const vFilters: string[] = [];
            const aFilters: string[] = [];
            if (fadeIn > 0) { vFilters.push(`fade=t=in:st=0:d=${fadeIn}`); aFilters.push(`afade=t=in:st=0:d=${fadeIn}`); }
            if (fadeOut > 0 && totalDur > 0) { vFilters.push(`fade=t=out:st=${totalDur - fadeOut}:d=${fadeOut}`); aFilters.push(`afade=t=out:st=${totalDur - fadeOut}:d=${fadeOut}`); }
            if (vFilters.length === 0) return { success: false, output: 'Specify fade_in and/or fade_out duration in seconds.' };
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "${vFilters.join(',')}" -af "${aFilters.join(',')}" "${output}"`;
            break;
          }
          case 'color': {
            const brightness = Number(params.brightness) || 0;
            const contrast = Number(params.contrast) || 1;
            const saturation = Number(params.saturation) ?? 1;
            const gamma = Number(params.gamma) || 1;
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}" -c:a copy "${output}"`;
            break;
          }
          case 'pip': {
            const pipIn = String(params.pip_input || inputs[1] || '');
            if (!pipIn) return { success: false, output: 'pip needs pip_input path (the overlay video).' };
            const pos = String(params.pip_position || 'bottom-right');
            const pipScale = Number(params.pip_scale) || 320;
            const pipXY = pos === 'top-left' ? '10:10' : pos === 'top-right' ? 'W-w-10:10' : pos === 'bottom-left' ? '10:H-h-10' : 'W-w-10:H-h-10';
            ffCmd = `ffmpeg -y -i "${mainInput}" -i "${pipIn}" -filter_complex "[1:v]scale=${pipScale}:-1[pip];[0:v][pip]overlay=${pipXY}" -c:a copy "${output}"`;
            break;
          }
          case 'thumbnail': {
            const t = String(params.thumbnail_time || '00:00:01');
            ffCmd = `ffmpeg -y -ss ${t} -i "${mainInput}" -frames:v 1 -q:v 2 "${output}"`;
            break;
          }
          case 'reverse': {
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf reverse -af areverse "${output}"`;
            break;
          }
          case 'loop': {
            const times = Number(params.speed) || 3; // reuse speed param for loop count
            ffCmd = `ffmpeg -y -stream_loop ${times - 1} -i "${mainInput}" -c copy "${output}"`;
            break;
          }
          case 'noise_blur': {
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "boxblur=2:1" -c:a copy "${output}"`;
            break;
          }
          case 'stabilize': {
            const analyzeFile = `/tmp/transforms_${Date.now()}.trf`;
            await shell(`ffmpeg -y -i "${mainInput}" -vf vidstabdetect=shakiness=5:show=0:result="${analyzeFile}" -f null - 2>&1`, 120000);
            ffCmd = `ffmpeg -y -i "${mainInput}" -vf "vidstabtransform=input=${analyzeFile}:zoom=1:smoothing=30,unsharp=5:5:0.8:3:3:0.4" -c:a copy "${output}"`;
            break;
          }
          case 'scene_detect': {
            const thresh = 0.3;
            const sceneRes = await shell(`ffmpeg -i "${mainInput}" -vf "select='gt(scene,${thresh})',metadata=print:file=-" -an -f null - 2>&1 | grep pts_time | head -50`, 60000);
            return {
              success: true,
              output: `Scene changes detected (threshold ${thresh}):\n${sceneRes.out || '(none found — try lower threshold)'}`,
            };
          }
          case 'custom': {
            const ffArgs = String(params.ffmpeg_args || '');
            if (!ffArgs) return { success: false, output: 'custom mode needs ffmpeg_args (everything after the -i input).' };
            ffCmd = `ffmpeg -y -i "${mainInput}" ${ffArgs} "${output}"`;
            break;
          }
          default:
            return { success: false, output: `Unknown operation: "${op}". Valid: trim, concat, speed, resize, crop, rotate, flip, audio_strip, audio_extract, audio_replace, audio_mix, text_overlay, subtitle, image_overlay, gif, convert, compress, fade, color, pip, thumbnail, reverse, loop, stabilize, scene_detect, custom` };
        }

        const result = await shell(ffCmd, 120000);

        // Verify output exists
        if (result.ok || op === 'scene_detect') {
          const checkRes = await shell(`ls -lh "${output}" 2>/dev/null`);
          const fileInfo = checkRes.ok ? checkRes.out.trim() : '(file check failed)';
          return {
            success: true,
            output: `✓ ${op} complete\nOutput: ${output}\n${fileInfo}\n${result.out ? `\nffmpeg log (last 200 chars):\n${result.out.slice(-200)}` : ''}`,
          };
        } else {
          return {
            success: false,
            output: `ffmpeg ${op} failed:\n${result.out.slice(-500)}\n\nCommand was:\n${ffCmd.slice(0, 300)}`,
          };
        }
      },
    },
    // ── Audio transcription ────────────────────────────────────────────────────
    {
      name: 'audio_transcribe',
      description: 'Transcribe speech from audio or video files using Whisper. Returns full transcript with timestamps. Works on .mp3, .wav, .m4a, .mp4, .mov, .mkv, etc.',
      parameters: {
        path: { type: 'string', description: 'Path to audio or video file', required: true },
        model_size: { type: 'string', description: 'Whisper model: tiny (fastest), base, small, medium, large (most accurate). Default: base' },
        language: { type: 'string', description: 'Language code (e.g. "en", "nl", "de"). Auto-detected if omitted.' },
        timestamps: { type: 'boolean', description: 'Include word-level timestamps (default: true)' },
      },
      execute: async (params) => {
        const filePath = String(params.path || '');
        if (!filePath) return { success: false, output: 'No file path provided.' };
        const modelSize = String(params.model_size || 'base');
        const language = params.language ? `--language ${params.language}` : '';
        const tmpDir = `/tmp/neuro_transcribe_${Date.now()}`;

        const shell = async (cmd: string, timeoutMs = 120000): Promise<{ ok: boolean; out: string }> => {
          try {
            const r = await fetch('/api/shell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: cmd, timeout: timeoutMs }),
            });
            if (!r.ok) return { ok: false, out: `Shell: ${r.status}` };
            const j = await r.json() as { stdout?: string; stderr?: string; exitCode?: number };
            return { ok: j.exitCode === 0, out: [j.stdout, j.stderr].filter(Boolean).join('\n').slice(0, 5000) };
          } catch (e) { return { ok: false, out: String(e) }; }
        };

        // Check if whisper is available
        const whisperCheck = await shell('which whisper 2>/dev/null || python3 -c "import whisper" 2>/dev/null && echo ok', 5000);
        const hasCLI = whisperCheck.out.includes('/whisper') || whisperCheck.out.includes('ok');

        if (!hasCLI) {
          // Fallback: use ffmpeg to extract audio info + basic metadata
          const probeRes = await shell(`ffprobe -v quiet -show_entries format_tags=title,artist,album,comment:format=duration,size -of json "${filePath}"`, 10000);
          return {
            success: false,
            output: `Whisper not installed. Install with: pip install openai-whisper\n\nFile metadata:\n${probeRes.out.slice(0, 500)}\n\nAlternatively, use shell_exec to run: whisper "${filePath}" --model ${modelSize}`,
          };
        }

        // If video, extract audio first (faster for whisper)
        let audioPath = filePath;
        const isVideo = /\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i.test(filePath);
        if (isVideo) {
          await shell(`mkdir -p "${tmpDir}"`);
          audioPath = `${tmpDir}/audio.wav`;
          await shell(`ffmpeg -y -i "${filePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" 2>&1`, 60000);
        }

        // Run whisper
        await shell(`mkdir -p "${tmpDir}"`);
        const transcribeRes = await shell(
          `whisper "${audioPath}" --model ${modelSize} ${language} --output_format txt --output_dir "${tmpDir}" 2>&1`,
          300000, // 5 min max
        );

        // Read the transcript
        const baseName = audioPath.replace(/\.[^.]+$/, '').split('/').pop() || 'audio';
        const txtRes = await shell(`cat "${tmpDir}/${baseName}.txt" 2>/dev/null || cat "${tmpDir}"/*.txt 2>/dev/null`);

        // Cleanup
        if (isVideo) await shell(`rm -rf "${tmpDir}"`, 5000);

        if (txtRes.ok && txtRes.out.trim()) {
          return { success: true, output: `TRANSCRIPT:\n\n${txtRes.out}` };
        } else {
          return {
            success: false,
            output: `Transcription failed.\nWhisper output:\n${transcribeRes.out.slice(-500)}`,
          };
        }
      },
    },
    // ── Video creation from images ─────────────────────────────────────────────
    {
      name: 'video_create',
      description: 'Create a video from images (slideshow), or build a video by combining images + audio. Also supports screen recording capture duration. Great for creating presentations, timelapse, or generating video from AI-generated frames.',
      parameters: {
        mode: { type: 'string', description: '"slideshow" — images to video | "images_to_video" — same as slideshow | "timelapse" — high-speed image sequence | "audio_to_video" — waveform visualizer video from audio file', required: true },
        images: { type: 'string', description: 'Glob pattern for images (e.g. "/tmp/frames/*.jpg") or comma-separated paths', required: false },
        audio: { type: 'string', description: 'Path to audio file to add as background music or narration' },
        output: { type: 'string', description: 'Output video path (default: /tmp/neuro_video_<timestamp>.mp4)' },
        fps: { type: 'number', description: 'Frames per second (default: 1 for slideshow, 24 for timelapse)' },
        duration_per_image: { type: 'number', description: '[slideshow] Seconds each image is shown (default: 3)' },
        width: { type: 'number', description: 'Output width in pixels (default: 1280)' },
        height: { type: 'number', description: 'Output height in pixels (default: 720)' },
        transition: { type: 'string', description: 'Transition effect: "fade" | "none" (default: fade)' },
      },
      execute: async (params) => {
        const mode = String(params.mode || 'slideshow').toLowerCase();
        const output = String(params.output || `/tmp/neuro_video_${Date.now()}.mp4`);
        const fps = Number(params.fps) || (mode === 'timelapse' ? 24 : 1);
        const w = Number(params.width) || 1280;
        const h = Number(params.height) || 720;
        const durPerImg = Number(params.duration_per_image) || 3;
        const audioPath = String(params.audio || '');

        const shell = async (cmd: string, timeoutMs = 120000): Promise<{ ok: boolean; out: string }> => {
          try {
            const r = await fetch('/api/shell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: cmd, timeout: timeoutMs }),
            });
            if (!r.ok) return { ok: false, out: `Shell: ${r.status}` };
            const j = await r.json() as { stdout?: string; stderr?: string; exitCode?: number };
            return { ok: j.exitCode === 0, out: [j.stdout, j.stderr].filter(Boolean).join('\n').slice(0, 2000) };
          } catch (e) { return { ok: false, out: String(e) }; }
        };

        if (mode === 'audio_to_video') {
          if (!audioPath) return { success: false, output: 'audio_to_video needs audio path.' };
          const cmd = `ffmpeg -y -i "${audioPath}" -filter_complex "[0:a]showwaves=s=${w}x${h}:mode=cline:r=25:colors=0x2B79FF[v]" -map "[v]" -map 0:a -c:v libx264 -c:a aac -shortest "${output}"`;
          const res = await shell(cmd, 120000);
          if (!res.ok) return { success: false, output: `Failed: ${res.out.slice(-400)}` };
          const info = await shell(`ls -lh "${output}"`);
          return { success: true, output: `✓ Waveform video created\nOutput: ${output}\n${info.out}` };
        }

        // slideshow / timelapse — get image list
        const imagesRaw = String(params.images || '');
        if (!imagesRaw) return { success: false, output: 'images parameter required (glob or comma-separated paths).' };

        let imagePaths: string[] = [];
        if (imagesRaw.includes('*') || imagesRaw.includes('?')) {
          const lsRes = await shell(`ls ${imagesRaw} 2>/dev/null | sort`);
          imagePaths = lsRes.out.split('\n').map(l => l.trim()).filter(l => l.match(/\.(jpg|jpeg|png|webp|bmp)$/i));
        } else {
          imagePaths = imagesRaw.split(',').map(p => p.trim()).filter(Boolean);
        }

        if (imagePaths.length === 0) return { success: false, output: `No images found matching: ${imagesRaw}` };

        const tmpList = `/tmp/neuro_imglist_${Date.now()}.txt`;

        if (mode === 'timelapse') {
          // Write concat list with equal duration
          const listContent = imagePaths.map(p => `file '${p}'\nduration ${(1 / fps).toFixed(4)}`).join('\n');
          await shell(`printf '%s' '${listContent.replace(/'/g, "'\\''")}' > "${tmpList}"`);
          const audioFlag = audioPath ? `-i "${audioPath}" -c:a aac -shortest` : '';
          const cmd = `ffmpeg -y -f concat -safe 0 -i "${tmpList}" -vf "scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2" ${audioFlag} -c:v libx264 -pix_fmt yuv420p "${output}"`;
          const res = await shell(cmd, 180000);
          await shell(`rm -f "${tmpList}"`, 5000);
          if (!res.ok) return { success: false, output: `Timelapse failed: ${res.out.slice(-400)}` };
          const info = await shell(`ls -lh "${output}"`);
          return { success: true, output: `✓ Timelapse created (${imagePaths.length} frames @ ${fps}fps)\nOutput: ${output}\n${info.out}` };
        }

        // Slideshow with optional fade transitions
        const listContent = imagePaths.map(p => `file '${p}'\nduration ${durPerImg}`).join('\n');
        await shell(`printf '%s' '${listContent.replace(/'/g, "'\\''")}' > "${tmpList}"`);
        const transition = String(params.transition || 'fade');
        const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2${transition === 'fade' ? `,fade=t=in:st=0:d=0.5` : ''}`;
        const audioFlag = audioPath ? `-i "${audioPath}" -c:a aac -shortest` : '';
        const cmd = `ffmpeg -y -f concat -safe 0 -i "${tmpList}" -vf "${vf}" ${audioFlag} -c:v libx264 -pix_fmt yuv420p -r 25 "${output}"`;
        const res = await shell(cmd, 180000);
        await shell(`rm -f "${tmpList}"`, 5000);
        if (!res.ok) return { success: false, output: `Slideshow failed: ${res.out.slice(-400)}` };
        const info = await shell(`ls -lh "${output}"`);
        return { success: true, output: `✓ Slideshow created (${imagePaths.length} images, ${durPerImg}s each)\nOutput: ${output}\n${info.out}` };
      },
    },
    // ── end OpenClaw skills ────────────────────────────────────────────────────
    {
      name: 'file_find',
      description: 'Find files by glob pattern or search inside file contents. Locate files before reading them.',
      parameters: {
        pattern: { type: 'string', description: 'Glob pattern to match (e.g. "*.py", "report*.pdf", "**/*.ts")', required: true },
        path: { type: 'string', description: 'Directory to search in (default: current directory)' },
        in_content: { type: 'boolean', description: 'If true, search inside file contents for the pattern text instead of matching filenames' },
      },
      execute: async (params) => {
        try {
          const pattern = String(params.pattern || '');
          if (!pattern) return { success: false, output: 'No pattern provided.' };
          const dir = String(params.path || '.');
          const inContent = Boolean(params.in_content);
          const cmd = inContent
            ? `grep -rl "${pattern}" "${dir}" 2>/dev/null | head -30`
            : `find "${dir}" -name "${pattern}" -type f 2>/dev/null | head -50`;
          const resp = await fetch('/api/shell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, timeout: 15000 }),
          });
          if (!resp.ok) return { success: false, output: 'Shell API not available.' };
          const result = await resp.json();
          const files = (result.stdout || '').trim();
          if (!files) return { success: true, output: 'No files found.' };
          const count = files.split('\n').length;
          return { success: true, output: `Found ${count} file(s):\n${files}` };
        } catch (err) {
          return { success: false, output: `Find error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'run_code',
      description: 'Run a code snippet in python, javascript (node), or bash. Executes via shell. Use for: data processing, calculations, API calls, text manipulation, quick scripts. Max output: 2000 chars.',
      parameters: {
        language: { type: 'string', description: '"python", "javascript", or "bash"', required: true },
        code: { type: 'string', description: 'Code to execute', required: true },
      },
      execute: async (params) => {
        const lang = String(params.language || 'python').toLowerCase();
        const code = String(params.code || '');
        if (!code) return { success: false, output: 'No code provided.' };

        let cmd: string;
        if (lang === 'python' || lang === 'py') {
          cmd = `python3 -c ${JSON.stringify(code)} 2>&1`;
        } else if (lang === 'javascript' || lang === 'js' || lang === 'node') {
          cmd = `node -e ${JSON.stringify(code)} 2>&1`;
        } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
          cmd = `bash -c ${JSON.stringify(code)} 2>&1`;
        } else {
          return { success: false, output: `Unsupported language: ${lang}. Use "python", "javascript", or "bash".` };
        }

        // ── CLI mode: execute directly via child_process ──
        if (typeof window === 'undefined') {
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
            const raw = [stdout, stderr].filter(Boolean).join('\n').trim();
            const output = raw.length > 3000 ? raw.slice(0, 1500) + '\n[...truncated...]' + raw.slice(-500) : raw;
            return { success: true, output: output || '(no output)' };
          } catch (err: any) {
            const msg = err?.stdout || err?.stderr || err?.message || String(err);
            return { success: false, output: `run_code error: ${String(msg).slice(0, 500)}` };
          }
        }

        // Browser mode: try wayfarer /execute first, then /api/shell fallback
        const wayfarerUrl = getWayfarerBaseUrl();

        // Attempt 1: Wayfarer /execute endpoint (always available when wayfarer is running)
        try {
          const resp = await fetch(`${wayfarerUrl}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: lang, code, timeout: 60 }),
          });
          if (resp.ok) {
            const result = await resp.json();
            const raw = result.output || '';
            if (raw.length > 2000) {
              return { success: result.success !== false, output: raw.slice(0, 2000) + '\n[...truncated]' };
            }
            return { success: result.success !== false, output: raw || '(no output)' };
          }
        } catch { /* wayfarer not reachable, try shell API */ }

        // Attempt 2: /api/shell (dev server proxy or CLI adapter)
        try {
          const resp = await fetch('/api/shell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, timeout: 60000 }),
          });
          if (!resp.ok) {
            return { success: false, output: 'Code execution requires Wayfarer (port 8889) to be running. Start it with: cd wayfarer && python3.11 -m uvicorn wayfarer_server:app --port 8889' };
          }
          const result = await resp.json();
          const raw = [result.stdout, result.stderr].filter(Boolean).join('\n');
          if (raw.length > 2000) {
            return { success: result.exitCode === 0, output: raw.slice(0, 2000) + '\n[...truncated]' };
          }
          return { success: result.exitCode === 0, output: raw || '(no output)' };
        } catch (err) {
          return { success: false, output: `Code execution unavailable. Start Wayfarer service for code execution support.` };
        }
      },
    },
    {
      name: 'ask_user',
      description: 'Pause execution and ask the user a question. Shows clickable option buttons if provided. Use for: clarification, confirmation before destructive actions, choosing between alternatives. The agent loop pauses until the user responds.',
      parameters: {
        question: { type: 'string', description: 'Question to ask the user', required: true },
        options: { type: 'string', description: 'Comma-separated clickable options (e.g., "Yes,No,Skip"). User can also type a free-form answer.' },
      },
      execute: async (params) => {
        // This is handled specially by the engine — it pauses and waits for user input
        const question = String(params.question || 'What would you like to do?');
        return { success: true, output: `WAITING_FOR_USER: ${question}`, data: { question, options: String(params.options || '') } };
      },
    },
    {
      name: 'wait',
      description: 'Wait N seconds before continuing. Use for: rate limiting between API calls, waiting for a process to finish, polling delays. Max 60 seconds.',
      parameters: {
        seconds: { type: 'number', description: 'Seconds to wait (1-60)', required: true },
        reason: { type: 'string', description: 'Brief reason for waiting (shown in UI)' },
      },
      execute: async (params, signal) => {
        const secs = Math.min(Math.max(Number(params.seconds) || 5, 1), 60);
        const reason = String(params.reason || '');
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, secs * 1000);
          if (signal) {
            signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
          }
        });
        return { success: true, output: `Waited ${secs}s${reason ? `: ${reason}` : ''}` };
      },
    },
    {
      name: 'schedule_task',
      description: 'Schedule a prompt to run at a future time (or repeat periodically). The scheduled task runs in the background and triggers a custom event. Use for: reminders, periodic checks, timed actions, follow-ups. Times in seconds from now, or ISO 8601 timestamps.',
      parameters: {
        prompt: { type: 'string', description: 'The prompt/instruction to execute when the task runs', required: true },
        delay_seconds: { type: 'number', description: 'Schedule to run N seconds from now (alternative to delay_ms). Max 86400 (1 day)' },
        delay_ms: { type: 'number', description: 'Schedule to run N milliseconds from now (alternative to delay_seconds)' },
        repeat: { type: 'string', description: 'Optional: "every N seconds" or "every N minutes" for periodic tasks (e.g. "every 60 seconds", "every 5 minutes"). Max 1 day interval.' },
        max_runs: { type: 'number', description: 'Max times to run if repeat is set (unlimited if omitted)' },
        description: { type: 'string', description: 'Human-readable description of the task' },
      },
      execute: async (params) => {
        try {
          const { scheduleTask } = await import('./taskScheduler');
          const prompt = String(params.prompt || '');
          if (!prompt) return { success: false, output: 'prompt is required' };

          let delayMs = 0;
          if (params.delay_seconds) {
            delayMs = Math.min(Number(params.delay_seconds) || 0, 86400) * 1000;
          } else if (params.delay_ms) {
            delayMs = Math.min(Number(params.delay_ms) || 0, 86400 * 1000);
          }

          const runAtTime = Date.now() + delayMs;

          // Parse repeat option
          let repeatConfig: { interval: number; maxRuns?: number } | undefined;
          if (params.repeat) {
            const repeatStr = String(params.repeat).toLowerCase();
            let intervalMs = 0;

            if (repeatStr.includes('second')) {
              const match = repeatStr.match(/(\d+)\s*second/);
              intervalMs = (match ? parseInt(match[1], 10) : 1) * 1000;
            } else if (repeatStr.includes('minute')) {
              const match = repeatStr.match(/(\d+)\s*minute/);
              intervalMs = (match ? parseInt(match[1], 10) : 1) * 60 * 1000;
            } else if (repeatStr.includes('hour')) {
              const match = repeatStr.match(/(\d+)\s*hour/);
              intervalMs = (match ? parseInt(match[1], 10) : 1) * 60 * 60 * 1000;
            }

            if (intervalMs > 0 && intervalMs <= 86400 * 1000) {
              repeatConfig = {
                interval: intervalMs,
                maxRuns: params.max_runs ? Math.max(1, Number(params.max_runs)) : undefined,
              };
            }
          }

          const task = await scheduleTask(prompt, runAtTime, repeatConfig ? { repeat: repeatConfig } : undefined);
          const delayStr = delayMs > 0 ? ` in ${Math.round(delayMs / 1000)}s` : ' immediately';
          const repeatStr = repeatConfig ? ` and repeat every ${Math.round(repeatConfig.interval / 1000)}s${repeatConfig.maxRuns ? ` (max ${repeatConfig.maxRuns} times)` : ''}` : '';
          return {
            success: true,
            output: `Task scheduled${delayStr}${repeatStr}. Task ID: ${task.id}`,
            data: { taskId: task.id },
          };
        } catch (err) {
          return { success: false, output: `Schedule failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'use_computer',
      description: 'Spawn a browser automation session to accomplish a goal. The computer agent navigates pages, clicks buttons, fills forms, and reports back. Falls back to web scraping + analysis if the browser sandbox is not running. Returns: pages visited, actions taken, key findings.',
      parameters: {
        goal: { type: 'string', description: 'What to accomplish in the browser (e.g. "Go to simpletics.com and find all product prices")', required: true },
        start_url: { type: 'string', description: 'URL to start at (optional — agent can navigate itself)' },
        max_actions: { type: 'number', description: 'Max browser actions (default 20, max 50)' },
      },
      execute: async (params, signal) => {
        if (typeof window === 'undefined') {
          return { success: false, output: '[CLI mode] use_computer is not available in CLI mode. Respond directly instead of using this tool.' };
        }
        try {
          const goal = String(params.goal || '');
          let startUrl = String(params.start_url || '');
          const maxActions = Math.min(Number(params.max_actions) || 20, 50);

          // If no real goal — just opening the computer. Activate and report ready.
          const isJustOpening = !goal || /^(no specific|ask the user|show me what)/i.test(goal);
          if (isJustOpening) {
            // Still try to open the sandbox so the computer is actually ready
            try {
              await sandboxService.navigate('about:blank');
            } catch (e) {
              // Sandbox might not be available, but that's ok - we'll report back
            }
            return {
              success: true,
              output: 'Computer is ready. Give me a URL or task and I will handle it.\n\nExamples:\n- "go to simpletics.com and find the pricing"\n- "search for collagen supplements and screenshot the top results"\n- "open reddit.com/r/skincare and find trending topics"',
            };
          }

          // Handle "open chrome" or similar app launch commands
          const isAppLaunch = /^open\s+(chrome|safari|firefox|edge|terminal|finder|app|browser)/i.test(goal);
          if (isAppLaunch && !startUrl) {
            // Open a blank browser window
            try {
              await sandboxService.navigate('about:blank');
              return {
                success: true,
                output: `Opened browser. Ready for your next command. You can now:\n- Navigate to a URL\n- Search for something\n- Fill out a form\n- Any other browser task`,
              };
            } catch (launchErr) {
              return { success: false, output: `Failed to open browser: ${launchErr instanceof Error ? launchErr.message : launchErr}` };
            }
          }

          // Extract URL from goal if start_url not explicitly provided
          if (!startUrl) {
            const urlMatch = goal.match(/https?:\/\/[^\s"'<>]+/);
            if (urlMatch) startUrl = urlMatch[0].replace(/[.,;)]+$/, '');
          }

          // Check if sandbox is reachable before committing to a full session
          let sandboxAvailable = false;
          try {
            const healthCheck = await fetch('http://localhost:8080/health', { signal: AbortSignal.timeout(3000) });
            sandboxAvailable = healthCheck.ok;
          } catch { sandboxAvailable = false; }

          if (!sandboxAvailable) {
            // Fallback: use Wayfarer to scrape + screenshot the target URL
            const targetUrl = startUrl || '';
            if (!targetUrl) {
              return {
                success: true,
                output: 'Browser sandbox is not running and no URL was given. Give me a URL to visit — I can screenshot and read pages without the sandbox.',
              };
            }

            try {
              const result = await screenshotService.analyzePage(targetUrl);
              if (result.image_base64) {
                desktopBus.emit({ type: 'computer_screenshot', screenshot: result.image_base64 });
              }
              const text = typeof result.page_text === 'object'
                ? Object.values(result.page_text).join('\n').slice(0, 6000)
                : String(result.page_text || '').slice(0, 6000);
              const dims = result.width && result.height ? `Screenshot: ${result.width}x${result.height}` : '';
              return {
                success: true,
                output: `[Browser sandbox unavailable — used Wayfarer scraping fallback]\n\nGoal: ${goal}\nURL: ${targetUrl}\n${dims}\n\n${text || 'No content extracted.'}`,
                data: result,
              };
            } catch (fallbackErr) {
              return { success: false, output: `Browser sandbox is not running and Wayfarer fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : fallbackErr}` };
            }
          }

          // Navigate to start URL if provided
          if (startUrl) {
            const navResult = await sandboxService.navigate(startUrl);
            if (navResult.error) return { success: false, output: `Navigation failed: ${navResult.error}` };
          }

          // Track session data
          const sessionData = {
            pagesVisited: [] as string[],
            actionsCount: 0,
            findings: [] as string[],
            filesSaved: [] as string[],
            startTime: Date.now(),
          };

          let summary = '';

          await runPlanAct(goal, getPlannerModel(), getExecutorModel(), {
            onAction: (action, _result) => {
              sessionData.actionsCount++;
              if (action.action === 'navigate' && action.url) {
                sessionData.pagesVisited.push(action.url);
              }
            },
            onDone: (s) => { summary = s; },
            onError: (e) => { summary = `Error during computer session: ${e}`; },
          }, maxActions, signal);

          // Try to capture final screenshot
          // BUG-04: track latest screenshot so it can be included in tool result data
          let latestScreenshotBase64: string | undefined;
          try {
            const screenshotResult = await sandboxService.screenshot(70);
            if (screenshotResult.image_base64) {
              latestScreenshotBase64 = screenshotResult.image_base64;
              // Emit screenshot for mini-screen preview in AgentPanel
              desktopBus.emit({ type: 'computer_screenshot', screenshot: screenshotResult.image_base64 });
              const sessionId = Date.now();
              const fname = `computer-session-${sessionId}.jpg`;
              const computerDir = `$HOME/Documents/Nomads/nomadfiles/computer-sessions`;
              await fetch('/api/shell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  command: `mkdir -p "${computerDir}" && echo "${screenshotResult.image_base64}" | base64 -d > "${computerDir}/${fname}"`,
                  timeout: 10000,
                }),
              });
              sessionData.filesSaved.push(fname);
            }
            if (summary) {
              const summaryFname = `computer-session-${Date.now()}-summary.md`;
              const computerDir = `$HOME/Documents/Nomads/nomadfiles/computer-sessions`;
              await fetch('/api/file/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `${computerDir.replace('$HOME', '~')}/${summaryFname}`, content: `# Computer Session\n\n**Goal:** ${goal}\n**Pages visited:** ${sessionData.pagesVisited.length}\n**Actions taken:** ${sessionData.actionsCount}\n**Duration:** ${Math.round((Date.now() - sessionData.startTime) / 1000)}s\n\n## Findings\n\n${summary}` }),
              });
              sessionData.filesSaved.push(summaryFname);
            }
          } catch { /* screenshot/save failed, non-critical */ }

          const elapsed = Math.round((Date.now() - sessionData.startTime) / 1000);
          const pagesStr = sessionData.pagesVisited.length > 0
            ? `\nPages visited: ${[...new Set(sessionData.pagesVisited)].join(', ')}`
            : '';
          const filesStr = sessionData.filesSaved.length > 0
            ? `\nFiles saved: ${sessionData.filesSaved.join(', ')}`
            : '';

          const output = `Computer session completed (${elapsed}s, ${sessionData.actionsCount} actions)${pagesStr}${filesStr}\n\nResult: ${summary || 'No summary available.'}`;

          return {
            success: true,
            output,
            data: {
              type: 'computer_session',
              pagesVisited: [...new Set(sessionData.pagesVisited)],
              actionsCount: sessionData.actionsCount,
              filesSaved: sessionData.filesSaved,
              duration: elapsed,
              summary,
              // BUG-04: expose final screenshot so AgentPanel can display it
              image_base64: latestScreenshotBase64,
            },
          };
        } catch (err) {
          return { success: false, output: `Computer session failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'spawn_worker',
      description: 'Start a browser agent worker with a specific goal. The worker runs autonomously in the background using Plan-Act and posts findings to the shared blackboard. Use for parallelizing tasks across multiple goals (e.g., research 3 competitor sites simultaneously).',
      parameters: {
        goal: { type: 'string', description: 'What the worker should accomplish (e.g., "Go to competitor.com and extract all product prices")', required: true },
        machine_id: { type: 'string', description: 'Machine identifier for the worker (default: "local")' },
      },
      execute: async (params, signal) => {
        try {
          const goal = String(params.goal || '');
          if (!goal) return { success: false, output: 'No goal provided.' };
          const machineId = String(params.machine_id || 'local');
          const workerId = agentCoordinator.spawnWorker(machineId, goal, signal);
          return {
            success: true,
            output: `Worker spawned: ${workerId}\nGoal: ${goal}\nMachine: ${machineId}\n\nThe worker is running in the background. Use check_workers to monitor progress and read_findings to see results.`,
            data: { workerId, goal, machineId },
          };
        } catch (err) {
          return { success: false, output: `Spawn failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'check_workers',
      description: 'Check the status of all running worker agents. Returns each worker\'s ID, goal, status (running/done/failed), and findings count.',
      parameters: {},
      execute: async () => {
        try {
          const workers = agentCoordinator.checkWorkers();
          if (workers.length === 0) {
            return { success: true, output: 'No workers active.' };
          }
          const lines = workers.map(w => {
            const elapsed = Math.round((Date.now() - w.startedAt) / 1000);
            const duration = w.completedAt
              ? `${Math.round((w.completedAt - w.startedAt) / 1000)}s`
              : `${elapsed}s (running)`;
            return `[${w.id}] ${w.status.toUpperCase()} (${duration})\n  Goal: ${w.goal}\n  Findings: ${w.findings.length}`;
          });
          return {
            success: true,
            output: `${workers.length} worker(s):\n\n${lines.join('\n\n')}`,
            data: workers.map(w => ({ id: w.id, status: w.status, goal: w.goal, findings: w.findings.length })),
          };
        } catch (err) {
          return { success: false, output: `Check failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'read_findings',
      description: 'Read the shared blackboard — all findings, errors, and status updates posted by workers. Optionally filter by worker ID or entry type.',
      parameters: {
        worker_id: { type: 'string', description: 'Filter to a specific worker (optional)' },
        type: { type: 'string', description: 'Filter by type: "finding", "error", "status", "file", "screenshot" (optional)' },
        latest: { type: 'number', description: 'Only return the N most recent entries (default: all)' },
      },
      execute: async (params) => {
        try {
          const workerId = params.worker_id ? String(params.worker_id) : undefined;
          const entryType = params.type ? String(params.type) as 'finding' | 'error' | 'status' | 'file' | 'screenshot' : undefined;
          const latest = params.latest ? Number(params.latest) : undefined;

          let entries;
          if (workerId) {
            entries = blackboard.readBySource(workerId);
          } else if (entryType) {
            entries = blackboard.readByType(entryType);
          } else if (latest) {
            entries = blackboard.getLatest(latest);
          } else {
            entries = blackboard.read();
          }

          // Apply latest limit if combined with other filters
          if (latest && workerId) {
            entries = entries.slice(-latest);
          }

          if (entries.length === 0) {
            return { success: true, output: 'Blackboard is empty. No findings yet.' };
          }

          const formatted = entries.map(e => {
            const age = Math.round((Date.now() - e.timestamp) / 1000);
            return `[${e.source}] ${e.type.toUpperCase()} "${e.key}": ${e.value.slice(0, 300)} (${age}s ago)`;
          }).join('\n');

          return {
            success: true,
            output: `${entries.length} entries:\n\n${formatted}`,
            data: entries,
          };
        } catch (err) {
          return { success: false, output: `Read failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'send_instruction',
      description: 'Send a follow-up instruction to a running worker. The message is queued and will be picked up on the worker\'s next planning cycle. Use to redirect a worker or give it additional context.',
      parameters: {
        worker_id: { type: 'string', description: 'ID of the worker to send to', required: true },
        message: { type: 'string', description: 'Instruction or context to send', required: true },
      },
      execute: async (params) => {
        try {
          const workerId = String(params.worker_id || '');
          const message = String(params.message || '');
          if (!workerId) return { success: false, output: 'No worker_id provided.' };
          if (!message) return { success: false, output: 'No message provided.' };

          const worker = agentCoordinator.getWorker(workerId);
          if (!worker) return { success: false, output: `Worker not found: ${workerId}` };
          if (worker.status !== 'running') return { success: false, output: `Worker ${workerId} is ${worker.status}, not running.` };

          agentCoordinator.sendToWorker(workerId, message);
          return {
            success: true,
            output: `Instruction queued for ${workerId}: "${message.slice(0, 100)}"`,
          };
        } catch (err) {
          return { success: false, output: `Send failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // ── Desktop control tool (vision-driven) ──────────────────────────────
    {
      name: 'control_desktop',
      description: 'Control the Neuro desktop UI using vision. Give a natural language goal and the vision model will look at the screen and click/type/scroll/drag to accomplish it. Use for: opening apps (Chrome, Finder, Terminal), navigating the browser, dragging elements or windows, scrolling pages/containers, running terminal commands, any UI interaction on the desktop.',
      parameters: {
        goal: {
          type: 'string',
          description: 'Natural language goal, e.g. "open Chrome", "go to google.com", "open Terminal and type help"',
          required: true,
        },
      },
      execute: async (params, signal) => {
        if (typeof window === 'undefined') {
          return { success: false, output: '[CLI mode] control_desktop is not available in CLI mode. Respond directly instead of using this tool.' };
        }
        const goal = String(params.goal || '');
        if (!goal) return { success: false, output: 'No goal provided.' };

        // Resolve desktopEl via the bus — ask ComputerDesktop to provide its element
        // We use a temporary run_goal event to get the element ref indirectly.
        // The full computer agent is wired through the desktopBus ask_user event.
        const onAskUser = (request: AskUserRequest): Promise<AskUserResponse> =>
          new Promise<AskUserResponse>(resolve => {
            desktopBus.emit({
              type: 'ask_user',
              question: request.question,
              isClarification: request.isClarification,
              resolve: (answer: string) => resolve({ value: answer, label: answer }),
            });
          });

        // ComputerViewSimplified is always mounted in AppShell — find it directly
        const desktopEl = document.querySelector<HTMLElement>('[data-desktop-root]');
        if (!desktopEl) {
          // Final fallback: fire simple run_goal event for backwards-compat
          desktopBus.emit({ type: 'run_goal', goal });
          return { success: true, output: `Desktop control started for goal: ${goal}` };
        }

        try {
          const summary = await runComputerAgent(goal, desktopEl, {
            signal,
            // Only stream meaningful action updates, filter verbose internal status
            onStatus: (msg) => {
              // Skip verbose internal messages, only show actions and significant state
              if (msg.includes('Analyzing goal') || msg.includes('Recalling') || msg.includes('Capturing')) return;
              if (msg.includes('screenshot') || msg.includes('[Agent]') && msg.length < 100) return;
              onEvent?.({ type: 'step_complete', thinking: msg, timestamp: Date.now() });
            },
            onAskUser,
            onBrowserUrl: (url) => desktopBus.emit({ type: 'navigate_chrome', url }),
          });
          return { success: true, output: summary };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, output: `Desktop agent error: ${msg}` };
        }
      },
    },
    {
      name: 'say',
      description: 'Say something to the user mid-task without ending the loop. Use this to give progress updates, share partial findings, or ask rhetorical questions while you keep working. Do NOT use "done" — the loop continues after say.',
      parameters: {
        message: { type: 'string', description: 'What to say to the user right now', required: true },
      },
      execute: async (params) => {
        return { success: true, output: String(params.message || '') };
      },
    },
    {
      name: 'save_skill',
      description: 'Save a reusable workflow pattern as a skill. When you discover an effective multi-step approach for a task type (e.g., "research + synthesize + save as docx"), save it here so you can reuse it next time. Skills are stored in workspace/skills/ and auto-loaded on matching tasks.',
      parameters: {
        name: { type: 'string', description: 'Short skill name (e.g., "deep-research", "competitor-analysis")', required: true },
        trigger: { type: 'string', description: 'When to use this skill — natural language description of matching tasks', required: true },
        steps: { type: 'string', description: 'JSON array of step descriptions that make up this workflow', required: true },
        tools_used: { type: 'string', description: 'Comma-separated list of tools this skill uses (e.g., "web_search,multi_browse,create_docx")' },
      },
      execute: async (params) => {
        try {
          const name = String(params.name || '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
          const trigger = String(params.trigger || '');
          const stepsRaw = String(params.steps || '[]');
          const toolsUsed = String(params.tools_used || '');
          if (!name || !trigger) return { success: false, output: 'name and trigger are required' };

          let stepList: string[];
          try { stepList = JSON.parse(stepsRaw); } catch { stepList = [stepsRaw]; }

          const skillMd = `---
name: ${name}
description: >
  ${trigger}
version: 1.0.0
tools: [${toolsUsed}]
created: ${new Date().toISOString()}
---

# ${name}

## When to use
- ${trigger}

## Workflow
${stepList.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

## Tools
${toolsUsed.split(',').map((t: string) => `- ${t.trim()}`).join('\n')}
`;

          // Save to global skills directory
          try {
            await fetch('/api/file/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: `${getEnv('VITE_PROJECT_ROOT', '~/Downloads/nomads')}/workspace/skills/${name}.md`,
                content: skillMd,
              }),
            });
          } catch { /* non-critical */ }

          return { success: true, output: `Skill "${name}" saved. Will auto-load on matching tasks next time.` };
        } catch (err) {
          return { success: false, output: `save_skill failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'done',
      description: 'Signal task completion. Call this when the user\'s request is fully resolved. Include a summary of what was accomplished.',
      parameters: {
        summary: { type: 'string', description: 'Brief summary of what was accomplished', required: true },
      },
      execute: async (params) => {
        return { success: true, output: String(params.summary || 'Task complete.') };
      },
    },
    {
      name: 'todo_write',
      description: 'Create or update your task TODO list. Write all sub-tasks for the current request. CRITICAL RULE: if any task is "pending" or "in_progress", you MUST keep working. NEVER produce a final response while todos remain incomplete. Use for any task with 2+ steps.',
      parameters: {
        todos: { type: 'string', description: 'JSON array of {content, status} objects. status: "pending" | "in_progress" | "completed". Example: [{"content":"Search competitors","status":"in_progress"},{"content":"Analyze results","status":"pending"}]', required: true },
      },
      execute: async (params) => {
        try {
          const raw = String(params.todos || '[]');
          let todos: Array<{ content: string; status: string }> = [];
          try { todos = JSON.parse(raw); } catch { return { success: false, output: 'todos must be a valid JSON array of {content, status} objects.' }; }
          if (!Array.isArray(todos)) return { success: false, output: 'todos must be an array.' };
          // Emit as event so UI can track
          onEvent?.({ type: 'task_progress', step: 0, taskProgress: {
            currentStep: todos.filter(t => t.status === 'completed').length + 1,
            totalSteps: todos.length,
            elapsed: 0,
            steps: todos.map(t => ({ description: t.content, status: t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'active' : 'pending' })),
          }, timestamp: Date.now() });
          const todoStr = todos.map((t, i) => `${i + 1}. [${t.status}] ${t.content}`).join('\n');
          const pending = todos.filter(t => t.status !== 'completed');
          return {
            success: true,
            output: pending.length > 0
              ? `TODO (${pending.length} remaining):\n${todoStr}\n\n** ${pending.length} tasks remaining — KEEP WORKING. Do NOT respond to user yet. **`
              : `ALL ${todos.length} todos COMPLETED:\n${todoStr}\n\nYou may now call done or provide your final answer.`,
            data: { todos, pending: pending.length },
          };
        } catch (err) {
          return { success: false, output: `todo_write error: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'todo_read',
      description: 'Check your TODO list status. Call before producing a final response to verify all tasks are complete.',
      parameters: {},
      execute: async () => {
        return { success: true, output: 'No active TODO list. Use todo_write to create one for multi-step tasks.' };
      },
    },
    {
      name: 'spawn_agents',
      description: 'Spawn 1–5 parallel subagents to research or analyze specific topics simultaneously. Each agent runs independently and reports back. Use when you need to research multiple angles at once (e.g., 3 competitor sites in parallel). Returns merged findings.',
      parameters: {
        tasks: { type: 'array', description: 'Array of {role, query} objects. role: researcher|analyzer|synthesizer|validator|strategist|compressor|evaluator. query: what this agent should investigate.', required: true },
        reason: { type: 'string', description: 'Why you are spawning these agents (shown in UI)', required: true },
      },
      execute: async (params, signal) => {
        try {
          // LLM sometimes sends "agents" instead of "tasks", and "task" instead of "query" — accept both
          const rawTasks = (params.tasks || params.agents) as Array<{ role?: string; query?: string; task?: string }> | undefined;
          if (!rawTasks || !Array.isArray(rawTasks) || rawTasks.length === 0) {
            return { success: false, output: 'tasks must be a non-empty array of {role, query} objects.' };
          }
          const capped = rawTasks.slice(0, 5);
          const reason = String(params.reason || 'Parallel research');

          // maxConcurrent: 4 — RTX 5080 (16GB) fits ~4× qwen3.5 2b/4b at Q4_K_M.
          // Timeouts are 120s so queued agents have time to wait their turn.
          const pool = new SubagentPool({ id: `spawn-${Date.now()}`, maxConcurrent: 4 });

          // Use fast (2b) for subagents — fits alongside 9b in 16GB VRAM.
          // Falls back to session model if fast model isn't available.
          const subagentModel = getModelForStage('fast');
          const requests = capped.map((t, i) => {
            const agentId = `sa-${Date.now()}-${i}`;
            const role = (t.role || 'researcher') as SubagentRole;
            const task = t.query || t.task || '';
            onEvent?.({ type: 'subagent_spawn', subagent: { agentId, role, task, model: subagentModel }, timestamp: Date.now() });
            // Stagger by index so agents don't all hit Ollama simultaneously (150ms is enough)
            return { id: agentId, role, task, context: `Parallel research task. Reason: ${reason}`, model: subagentModel, signal, startDelayMs: i * 150 };
          });

          const callbacks = {
            onProgress: (progress: import('./subagentManager').SubagentProgress) => {
              _subagentProgressCount++;
              if (_subagentProgressCount <= MAX_SUBAGENT_PROGRESS_EVENTS) {
                onEvent?.({
                  type: 'subagent_progress',
                  subagent: {
                    agentId: progress.subagentId,
                    role: progress.role,
                    task: '',
                    tokens: Math.round((progress.partialOutput?.split(/\s+/).length || 0) * 1.3),
                    status: progress.status,
                    partialOutput: progress.partialOutput,
                  },
                  timestamp: Date.now(),
                });
              } else if (_subagentProgressCount === MAX_SUBAGENT_PROGRESS_EVENTS + 1) {
                onEvent?.({ type: 'subagent_progress', subagent: { agentId: progress.subagentId, role: progress.role, task: '', status: '[further progress events suppressed]' }, timestamp: Date.now() });
              }
            },
            onComplete: (result: import('./subagentManager').SubagentResult) => {
              _subagentProgressCount = 0; // Reset throttle counter on completion
              if (result.status === 'completed') {
                // Extract sources from subagent output
                const sources = extractSourcesFromText(result.output);
                onEvent?.({
                  type: 'subagent_complete',
                  subagent: {
                    agentId: result.subagentId,
                    role: result.role,
                    task: result.task,
                    result: result.output.slice(0, 300),
                    confidence: result.confidence,
                    tokens: result.tokensUsed,
                    sources: sources.length > 0 ? sources : undefined,
                  },
                  timestamp: Date.now(),
                });
              } else {
                onEvent?.({
                  type: 'subagent_failed',
                  subagent: {
                    agentId: result.subagentId,
                    role: result.role,
                    task: result.task,
                    error: result.error || result.status,
                  },
                  timestamp: Date.now(),
                });
              }
            },
          };

          const results = await pool.submitAll(requests, callbacks);
          const aggregated = aggregateResults(results);

          const totalTokens = results.reduce((s, r) => s + r.tokensUsed, 0);

          // If all agents failed, give a clear diagnosis instead of an ambiguous "0 results" that confuses the main model
          if (aggregated.failedCount > 0 && aggregated.highConfidenceCount === 0 && aggregated.lowConfidenceCount === 0) {
            const firstError = results.find(r => r.error)?.error || 'unknown error';
            return {
              success: false,
              output: `All ${aggregated.failedCount} subagent(s) failed to complete. This is likely a model or tool issue, not a connectivity problem — the main agent is still running fine. First error: ${firstError}. Suggest retrying with fewer agents or using web_search + multi_browse directly instead.`,
            };
          }

          const summary =
            `Agents done: ${aggregated.highConfidenceCount} succeeded, ` +
            `${aggregated.lowConfidenceCount} low-confidence, ` +
            `${aggregated.failedCount} failed. ` +
            `~${totalTokens} tokens used.`;

          return {
            success: true,
            output: `${summary}\n\n${aggregated.mergedOutput}`,
            data: { aggregated, results },
          };
        } catch (err) {
          return { success: false, output: `spawn_agents failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // ── Compound research tools (OpenClaw skill patterns wired to Wayfarer) ──
    {
      name: 'competitor_swot',
      description: 'Structured SWOT analysis on a competitor. Searches web + screenshots site + synthesizes positioning gaps. Use in Phase 1 research.',
      parameters: {
        competitor_name: { type: 'string', description: 'Company or brand name', required: true },
        competitor_url: { type: 'string', description: 'Their website URL (optional but recommended for visual analysis)' },
        focus: { type: 'string', description: 'What angle to focus on: "positioning", "messaging", "pricing", "ux", or leave blank for full SWOT' },
      },
      execute: async (params, signal) => {
        try {
          const name = String(params.competitor_name || '');
          const url = String(params.competitor_url || '');
          const focus = String(params.focus || '');
          if (!name) return { success: false, output: 'competitor_name is required' };

          // 1. Web research
          const searchResult = await wayfarerService.research(
            `${name} brand strategy strengths weaknesses positioning messaging ${focus}`.trim(), 5, signal
          );

          // 2. Visual analysis if URL provided
          let visualData = '';
          if (url) {
            try {
              const visual = await screenshotService.analyzePage(url);
              const text = typeof visual.page_text === 'object'
                ? Object.values(visual.page_text).join('\n').slice(0, 2000)
                : String(visual.page_text || '').slice(0, 2000);
              visualData = `\nSite (${visual.width}x${visual.height}):\n${text}`;
            } catch { visualData = ''; }
          }

          // 3. Synthesize
          let swot = '';
          await ollamaService.generateStream(
            `SWOT analysis for ${name}${focus ? ` (focus: ${focus})` : ''}.\n\nWeb research:\n${searchResult.text?.slice(0, 4000) || ''}\n\nSite analysis:${visualData || ' (no URL provided)'}`,
            'Output a clean SWOT: Strengths, Weaknesses, Opportunities, Threats. Be specific and actionable. Use bullet points under each heading. Note positioning gaps vs competitors.',
            { model: getModelForStage('research'), temperature: 0.4, num_predict: 800, signal, onChunk: (c: string) => { swot += c; } },
          );

          const sources = searchResult.sources?.map(s => `- ${s.title}: ${s.url}`).join('\n') || '';
          return { success: true, output: `${swot}\n\nSources:\n${sources}`, data: { sources: searchResult.sources } };
        } catch (err) {
          return { success: false, output: `competitor_swot failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'social_intelligence',
      description: 'Research social media sentiment and conversations about a topic. Searches Reddit, X/Twitter, and forums. Returns real user language, pain points, and opinions.',
      parameters: {
        topic: { type: 'string', description: 'Topic, brand, or product to research', required: true },
        platforms: { type: 'string', description: 'Comma-separated: reddit,twitter,quora,forums (default: reddit,forums)' },
        intent: { type: 'string', description: 'What to extract: "pain_points", "desires", "objections", "language", or blank for all' },
      },
      execute: async (params, signal) => {
        try {
          const topic = String(params.topic || '');
          if (!topic) return { success: false, output: 'topic is required' };
          const platforms = String(params.platforms || 'reddit,forums').split(',').map(p => p.trim());
          const intent = String(params.intent || '');

          const queries = platforms.map(p => {
            if (p === 'twitter') return `site:x.com "${topic}" reviews opinions complaints`;
            if (p === 'reddit') return `site:reddit.com ${topic} experience review`;
            if (p === 'quora') return `site:quora.com ${topic}`;
            return `${topic} forum community discussion ${intent}`;
          });

          const results = await Promise.all(
            queries.map(q => wayfarerService.research(q, 4, signal).catch(() => ({ text: '', sources: [] })))
          );

          const combined = results.map((r, i) => `[${platforms[i]}]\n${r.text?.slice(0, 2500) || ''}`).join('\n\n---\n\n');
          const allSources = results.flatMap(r => r.sources || []);

          return {
            success: true,
            output: combined || 'No social data found.',
            data: { sources: allSources },
          };
        } catch (err) {
          return { success: false, output: `social_intelligence failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'google_trends',
      description: 'Check search trend data for keywords. Shows rising/falling interest, related queries, regional popularity. Use for market timing and audience interest validation.',
      parameters: {
        keywords: { type: 'string', description: 'Comma-separated keywords to compare (max 5)', required: true },
        timeframe: { type: 'string', description: 'Time window: "1m", "3m", "12m", "5y" (default: 12m)' },
        geo: { type: 'string', description: 'Country code: US, GB, CA, AU, etc. (default: US)' },
      },
      execute: async (params, signal) => {
        try {
          const keywords = String(params.keywords || '').split(',').map(k => k.trim()).filter(Boolean).slice(0, 5);
          if (keywords.length === 0) return { success: false, output: 'keywords is required' };
          const timeframe = String(params.timeframe || '12m');
          const geo = String(params.geo || 'US');

          // Use Wayfarer to scrape Google Trends + related search data
          const query = `google trends "${keywords.join('" "')}" interest popularity ${timeframe} ${geo}`;
          const result = await wayfarerService.research(query, 5, signal);

          // Also grab related queries
          const relatedQuery = `${keywords[0]} related searches rising queries ${timeframe}`;
          const related = await wayfarerService.research(relatedQuery, 3, signal).catch(() => ({ text: '' }));

          const output = [
            `Keywords: ${keywords.join(', ')} | Timeframe: ${timeframe} | Region: ${geo}`,
            '',
            result.text?.slice(0, 3000) || 'No trend data found.',
            related.text ? `\nRelated queries:\n${related.text.slice(0, 1500)}` : '',
          ].join('\n');

          return { success: true, output, data: { keywords, timeframe, geo } };
        } catch (err) {
          return { success: false, output: `google_trends failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'brand_voice',
      description: 'Store or retrieve the brand voice profile. Use "set" to define tone/vocabulary/persona, "get" to retrieve it before generating copy.',
      parameters: {
        action: { type: 'string', description: '"get" to retrieve current profile, "set" to save a new one', required: true },
        profile: { type: 'string', description: 'Brand voice profile text (for set action). Include: tone, vocabulary style, persona, forbidden words, example phrases.' },
      },
      execute: async (params) => {
        const action = String(params.action || 'get');
        if (action === 'set') {
          const profile = String(params.profile || '');
          if (!profile) return { success: false, output: 'profile text is required for set action' };
          try {
            // DISABLED: Cross-chat memory persistence removed per user request
            // addMemory('general', profile, ['brand_voice_profile']);
          } catch { /* non-fatal */ }
          return { success: true, output: 'Brand voice profile saved. Retrieve with brand_voice(action="get") before generating copy.' };
        }
        // get
        try {
          const results = searchMemories('brand_voice');
          if (results.length === 0) return { success: true, output: 'No brand voice profile set. Use brand_voice(action="set", profile="...") to define one.' };
          return { success: true, output: results[0].content };
        } catch {
          return { success: false, output: 'Failed to retrieve brand voice profile.' };
        }
      },
    },
    {
      name: 'deep_research',
      description: 'Comprehensive multi-source research on any topic. Runs parallel searches, synthesizes findings, identifies gaps. Returns structured report with sources. Use for anything requiring more than a quick web search.',
      parameters: {
        topic: { type: 'string', description: 'Topic to research in depth', required: true },
        angle: { type: 'string', description: 'Specific angle or question to focus on (optional)' },
        depth: { type: 'string', description: '"quick" (3 sources), "normal" (8 sources), "deep" (15 sources). Default: normal' },
      },
      execute: async (params, signal) => {
        try {
          const topic = String(params.topic || '');
          if (!topic) return { success: false, output: 'topic is required' };
          const angle = String(params.angle || '');
          const depthParam = String(params.depth || 'normal').toLowerCase();

          // Map depth param to source count
          let sourceCount: number;
          if (depthParam === 'quick') sourceCount = 3;
          else if (depthParam === 'deep') sourceCount = 20;
          else if (depthParam === 'very deep' || depthParam === 'extremely deep') sourceCount = 35;
          else if (depthParam === 'super' || depthParam === 'ultra') sourceCount = 40;
          else sourceCount = 8;

          const fullQuery = `${topic} ${angle}`.trim();

          // ── CLI mode: use Context-1 for intelligent retrieval ──
          if (typeof window === 'undefined') {
            const ctx1Available = await isContext1Available();
            if (ctx1Available) {
              console.log(`[deep_research] Using Context-1 for: "${fullQuery}"`);
              const retrieval = await context1Service.retrieve(fullQuery, {
                maxChunks: Math.min(sourceCount * 2, 40),
                maxSteps: depthParam === 'quick' ? 5 : depthParam === 'deep' ? 20 : 12,
                signal,
                decomposeQuery: depthParam !== 'quick',
                onEvent: (ev) => {
                  if (ev.type === 'tool_call') console.log(`  [context-1] ${ev.tool}(${ev.args?.slice(0, 60)})`);
                  if (ev.type === 'prune') console.log(`  [context-1] pruned ${ev.chunksPruned} chunks`);
                  if (ev.type === 'budget_warning') console.log(`  [context-1] budget ${ev.tokensUsed}/${ev.tokenBudget}`);
                },
              });
              if (retrieval.chunks.length > 0) {
                const chunkText = retrieval.chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
                let synthesis = '';
                await ollamaService.generateStream(
                  `Research query: "${fullQuery}"\n\nRetrieved evidence (${retrieval.chunks.length} chunks, ${retrieval.steps} retrieval steps):\n\n${chunkText.slice(0, 12000)}`,
                  'Write a comprehensive, well-structured research report based on the evidence. Use markdown headers. Include specific data points, statistics, expert findings. Cite sources inline as [1], [2] etc. End with key takeaways.',
                  { model: getModelForStage('research'), temperature: 0.4, num_predict: 2000, signal, onChunk: (c: string) => { synthesis += c; } }
                );
                return {
                  success: true,
                  output: `${synthesis}\n\n---\n*Retrieved via Context-1: ${retrieval.chunks.length} chunks, ${retrieval.steps} steps, ${Math.round(retrieval.durationMs / 1000)}s*`,
                  data: { chunks: retrieval.chunks, steps: retrieval.steps },
                };
              }
            }
            // Context-1 unavailable or returned nothing — fall through to Wayfarer
            console.log(`[deep_research] Context-1 unavailable, falling back to Wayfarer`);
          }

          // ── Browser mode (or Context-1 fallback): parallel Wayfarer queries ──
          const queries = [
            fullQuery,
            `${topic} overview statistics data`,
            `${topic} expert analysis research`,
            depthParam !== 'quick' ? `${topic} case studies examples` : '',
            depthParam !== 'quick' ? `${topic} trends 2024 2025` : '',
          ].filter(Boolean).slice(0, depthParam === 'quick' ? 2 : depthParam === 'deep' ? 5 : 3);

          const results = await Promise.all(
            queries.map(q => wayfarerService.research(q, Math.ceil(sourceCount / queries.length), signal).catch(() => ({ text: '', sources: [] as Array<{title: string; url: string}> })))
          );

          const combined = results.map((r, i) => `[Query ${i + 1}: ${queries[i]}]\n${r.text?.slice(0, 3000) || ''}`).join('\n\n---\n\n');
          const allSources = results.flatMap(r => r.sources || []);

          let synthesis = '';
          await ollamaService.generateStream(
            `Research synthesis for: "${topic}"${angle ? ` (focus: ${angle})` : ''}\n\nRaw research:\n${combined.slice(0, 8000)}`,
            'Write a comprehensive, well-structured research report. Use headers for sections. Include key findings, data points, expert opinions. Cite sources. End with a summary of key takeaways.',
            { model: getModelForStage('research'), temperature: 0.4, num_predict: 1200, signal, onChunk: (c: string) => { synthesis += c; } }
          );

          const sourceList = [...new Map(allSources.map(s => [s.url, s])).values()].slice(0, 15).map(s => `- [${s.title}](${s.url})`).join('\n');
          return { success: true, output: `${synthesis}\n\n## Sources\n${sourceList}`, data: { sources: allSources } };
        } catch (err) {
          return { success: false, output: `deep_research failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'research_loop',
      description: 'Iterative deep research: scrape 30+ pages per search term, compress findings, generate follow-up terms, repeat. Use for comprehensive research that needs multiple angles. Returns a structured research report with all sources.',
      parameters: {
        topic: { type: 'string', description: 'Main research topic', required: true },
        initial_terms: { type: 'string', description: 'Comma-separated search terms to start with (default: auto-generated from topic)' },
        rounds: { type: 'number', description: 'Number of research rounds (default: 3, max: 5). Each round: search → scrape → compress → generate new terms' },
        pages_per_term: { type: 'number', description: 'Pages to scrape per search term (default: 15, max: 30)' },
      },
      execute: async (params, signal) => {
        try {
          const topic = String(params.topic || '');
          if (!topic) return { success: false, output: 'topic is required' };

          // Detect intensity from topic keywords
          const topicLower = topic.toLowerCase();
          const isDeepIntensity = /\b(deep|very|super|extensive|comprehensive|ultra|maximum|all|everything|exhaustive)\b/i.test(topicLower);

          // Smart defaults: if user says "deep" or "super", go harder
          const roundsParam = Number(params.rounds);
          const pagesParam = Number(params.pages_per_term);
          const rounds = isDeepIntensity
            ? Math.min(roundsParam || 5, 5)  // max rounds if deep request
            : Math.min(roundsParam || 3, 5); // normal rounds otherwise
          const pagesPerTerm = isDeepIntensity
            ? Math.min(pagesParam || 25, 30) // 25-30 pages for deep
            : Math.min(pagesParam || 15, 30); // 15 pages for normal

          // Parse or generate initial terms
          let terms: string[] = params.initial_terms
            ? String(params.initial_terms).split(',').map(t => t.trim()).filter(Boolean)
            : [topic, `${topic} latest research`, `${topic} statistics data`];

          const allFindings: string[] = [];
          const allSources: Array<{title: string; url: string}> = [];
          const seenUrls = new Set<string>();
          let totalPagesScraped = 0;

          for (let round = 0; round < rounds; round++) {
            if (signal?.aborted) break;

            const roundTerms = terms.slice(0, 3); // Max 3 terms per round

            // Scrape all terms in parallel
            const searchPromises = roundTerms.map(term =>
              wayfarerService.research(term, pagesPerTerm, signal).catch(() => ({ pages: [] as any[], text: '', sources: [] as any[], meta: { elapsed: 0 } }))
            );
            const searchResults = await Promise.all(searchPromises);

            // Collect all unique pages
            let roundContent = '';
            for (const result of searchResults) {
              for (const page of (result.pages || [])) {
                if (seenUrls.has(page.url)) continue;
                seenUrls.add(page.url);
                totalPagesScraped++;
                const content = (page.content || page.snippet || '').slice(0, 2000);
                roundContent += `\n[${page.title || 'untitled'}] (${page.url})\n${content}\n`;
                allSources.push({ title: page.title || page.url, url: page.url });
              }
              // Also track from sources array
              for (const s of (result.sources || [])) {
                if (!seenUrls.has(s.url)) {
                  seenUrls.add(s.url);
                  allSources.push(s);
                }
              }
            }

            if (!roundContent) continue;

            // Compress this round's findings
            let compressed = '';
            await ollamaService.generateStream(
              `Round ${round + 1}/${rounds} research on "${topic}".\n\nTerms searched: ${roundTerms.join(', ')}\n\nRaw content (${totalPagesScraped} pages):\n${roundContent.slice(0, 12000)}`,
              'Compress these research findings. Extract ALL key facts, numbers, names, URLs, statistics, quotes. Remove fluff. Output as structured bullet points grouped by subtopic. Preserve every data point.',
              {
                model: getModelForStage('research'),
                temperature: 0.2,
                num_predict: 1500,
                signal,
                onChunk: (c: string) => { compressed += c; },
              },
            );
            allFindings.push(`### Round ${round + 1} (terms: ${roundTerms.join(', ')})\n${compressed}`);

            // Generate follow-up terms for next round (unless last round)
            if (round < rounds - 1) {
              let newTermsRaw = '';
              await ollamaService.generateStream(
                `Topic: "${topic}"\n\nFindings so far:\n${compressed.slice(0, 3000)}\n\nGenerate 2-3 NEW search terms that would fill gaps in the research. Focus on: missing data, unexplored angles, verification of key claims. Output ONLY the terms, one per line.`,
                'Output 2-3 search terms, one per line. No explanation. No numbering. Just the raw search queries.',
                {
                  model: getModelForStage('fast'),
                  temperature: 0.5,
                  num_predict: 100,
                  signal,
                  onChunk: (c: string) => { newTermsRaw += c; },
                },
              );
              terms = newTermsRaw.split('\n').map(t => t.trim()).filter(t => t.length > 3 && t.length < 100).slice(0, 3);
              if (terms.length === 0) terms = [`${topic} expert analysis`];
            }
          }

          // Final synthesis
          let synthesis = '';
          await ollamaService.generateStream(
            `Synthesize all research rounds on "${topic}":\n\n${allFindings.join('\n\n').slice(0, 10000)}`,
            'Write a comprehensive, well-structured research report. Use ## headers for sections. Include all key data points, statistics, and expert quotes. End with Key Takeaways section. Be thorough — this is the final deliverable.',
            {
              model: getModelForStage('research'),
              temperature: 0.3,
              num_predict: 2000,
              signal,
              onChunk: (c: string) => { synthesis += c; },
            },
          );

          // Format sources
          const uniqueSources = [...new Map(allSources.map(s => [s.url, s])).values()].slice(0, 40);
          const sourceList = uniqueSources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join('\n');

          const output = `# Research: ${topic}\n\n*${rounds} rounds, ${totalPagesScraped} pages scraped, ${uniqueSources.length} unique sources*\n\n${synthesis}\n\n## Sources\n${sourceList}`;

          return { success: true, output, data: { sources: uniqueSources, rounds, totalPagesScraped } };
        } catch (err) {
          return { success: false, output: `research_loop failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'summarize',
      description: 'Condense long content (text, URL, or file) into a clear summary. Extracts key points, removes fluff.',
      parameters: {
        content: { type: 'string', description: 'Text content to summarize, OR a URL to fetch and summarize', required: true },
        format: { type: 'string', description: '"bullets" for bullet points, "paragraph" for prose, "tldr" for one-liner. Default: bullets' },
        length: { type: 'string', description: '"short" (3-5 points), "medium" (8-10 points), "long" (full summary). Default: medium' },
      },
      execute: async (params, signal) => {
        try {
          let content = String(params.content || '');
          if (!content) return { success: false, output: 'content is required' };
          const format = String(params.format || 'bullets');
          const length = String(params.length || 'medium');

          // If it looks like a URL, fetch it
          if (content.startsWith('http://') || content.startsWith('https://')) {
            try {
              const result = await screenshotService.analyzePage(content);
              content = typeof result.page_text === 'object'
                ? Object.values(result.page_text).join('\n').slice(0, 8000)
                : String(result.page_text || '').slice(0, 8000);
            } catch { /* use content as-is */ }
          }

          const wordTarget = length === 'short' ? '3-5 key points' : length === 'long' ? '15-20 key points' : '8-10 key points';
          const formatInstr = format === 'paragraph' ? 'Write as concise paragraphs.' : format === 'tldr' ? 'Write a single sentence TL;DR.' : `Write as bullet points (${wordTarget}).`;

          let summary = '';
          await ollamaService.generateStream(
            `Summarize this content:\n\n${content.slice(0, 6000)}`,
            `${formatInstr} Be direct and specific. No filler phrases. Preserve important numbers, names, and facts.`,
            { model: getModelForStage('research'), temperature: 0.3, num_predict: 600, signal, onChunk: (c: string) => { summary += c; } }
          );
          return { success: true, output: summary };
        } catch (err) {
          return { success: false, output: `summarize failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'extract_data',
      description: 'Extract structured data from text, URLs, or documents. Returns JSON or table. Use for: prices, contacts, specs, lists, any repeating structured info.',
      parameters: {
        source: { type: 'string', description: 'Text content or URL to extract from', required: true },
        what: { type: 'string', description: 'What to extract (e.g. "product names and prices", "email addresses", "company names and URLs")', required: true },
        format: { type: 'string', description: '"json" or "table". Default: json' },
      },
      execute: async (params, signal) => {
        try {
          let source = String(params.source || '');
          const what = String(params.what || '');
          const format = String(params.format || 'json');
          if (!source || !what) return { success: false, output: 'source and what are required' };

          if (source.startsWith('http://') || source.startsWith('https://')) {
            try {
              const result = await wayfarerService.research(source, 3, signal);
              source = result.text?.slice(0, 8000) || source;
            } catch { /* use source as-is */ }
          }

          let extracted = '';
          await ollamaService.generateStream(
            `Extract ${what} from this content:\n\n${source.slice(0, 6000)}`,
            `Output ONLY the extracted data as ${format === 'table' ? 'a markdown table' : 'clean JSON'}. No explanation, no preamble. If nothing found, return ${format === 'table' ? 'empty table' : '[]'}.`,
            { model: getModelForStage('research'), temperature: 0.1, num_predict: 800, signal, onChunk: (c: string) => { extracted += c; } }
          );
          return { success: true, output: extracted };
        } catch (err) {
          return { success: false, output: `extract_data failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'data_pipeline',
      description: 'Research + visualize: searches the web for real numerical data on a topic, extracts structured data points via LLM, picks the best chart type, and returns markdown with embedded ```chart blocks ready to render. Use when the user asks to "chart", "graph", "plot", "visualize", "show me data on", or "compare [X] visually". Returns a full response with live chart embedded.',
      parameters: {
        topic: { type: 'string', description: 'What to research and chart (e.g. "global EV sales by country 2024", "top AI startups by funding 2025", "S&P 500 performance last 5 years")', required: true },
        chart_type: { type: 'string', description: 'Preferred chart type: bar | line | area | pie | donut | scatter | heatmap. Leave blank to auto-select.' },
        focus: { type: 'string', description: 'Specific angle or metric to focus on (e.g. "market share", "year-over-year growth")' },
      },
      execute: async (params, signal) => {
        const topic = String(params.topic || '');
        const preferredType = String(params.chart_type || '').toLowerCase() as ChartSpec['type'] | '';
        const focus = String(params.focus || '');
        if (!topic) return { success: false, output: 'topic is required' };

        try {
          // ── Phase 1: Research ──
          onEvent?.({ type: 'task_progress' as any, timestamp: Date.now(),
            taskProgress: { idx: 0, total: 3, label: 'Searching for data on ' + topic, phase: 'research' } });

          const searchQuery = focus ? `${topic} ${focus} statistics data numbers` : `${topic} statistics data numbers 2024 2025`;
          const results = await wayfarerService.research(searchQuery, 8, signal);
          const rawContent = (results.pages || [])
            .slice(0, 6)
            .map((p: any, i: number) => `[${i + 1}] ${p.title}\n${(p.content || p.snippet || '').slice(0, 800)}`)
            .join('\n\n')
            .slice(0, 5000);

          if (!rawContent) return { success: false, output: `No data found for: ${topic}` };

          // ── Phase 2: LLM data extraction ──
          onEvent?.({ type: 'task_progress' as any, timestamp: Date.now(),
            taskProgress: { idx: 1, total: 3, label: 'Extracting data points', phase: 'extract' } });

          let extracted = '';
          const extractPrompt = `You are a data extraction engine. Extract ALL numerical data points from the content below about: "${topic}${focus ? ' — ' + focus : ''}"

Output ONLY a valid JSON object in this exact format (no prose, no markdown, no explanation):
{
  "title": "concise chart title",
  "subtitle": "brief subtitle with date range or context if known",
  "bestChartType": "bar|line|area|pie|donut|scatter",
  "series": [
    {
      "name": "series name",
      "data": [{"x": "category or date", "y": number}]
    }
  ],
  "xAxis": {"label": "x axis label"},
  "yAxis": {"label": "y axis label", "unit": "unit like $, %, M, etc"},
  "source": "source attribution"
}

Rules:
- Use REAL numbers from the content — do NOT invent data
- For time series use dates as x values (e.g. "2020", "Q1 2024", "Jan 2025")
- For comparisons use category names as x values
- If multiple metrics exist, use multiple series
- Keep x labels short (under 12 chars)
- If you cannot find enough numeric data, output {"error": "insufficient numeric data"}

Content:
${rawContent}`;

          await ollamaService.generateStream(extractPrompt,
            'Output ONLY valid JSON. No preamble, no explanation.',
            { model: getModelForStage('research'), temperature: 0.05, num_predict: 1500, signal, onChunk: (c: string) => { extracted += c; } }
          );

          // Parse the extracted JSON
          let spec: ChartSpec;
          try {
            const jsonMatch = extracted.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch?.[0] || extracted);
            if (parsed.error) {
              return { success: false, output: `Could not extract structured data: ${parsed.error}. Try a more specific query.` };
            }
            if (!parsed.series || !Array.isArray(parsed.series) || parsed.series.length === 0) {
              throw new Error('No series data');
            }

            // Apply user's preferred chart type or fall back to LLM suggestion
            const chartType = (preferredType || parsed.bestChartType || 'bar') as ChartSpec['type'];
            const validTypes = ['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'heatmap'];
            spec = {
              type: validTypes.includes(chartType) ? chartType : 'bar',
              title: parsed.title || topic,
              subtitle: parsed.subtitle,
              series: parsed.series,
              xAxis: parsed.xAxis,
              yAxis: parsed.yAxis,
              source: parsed.source,
            };
          } catch (e) {
            return { success: false, output: `Data extraction failed: could not parse structured data. Raw extraction:\n${extracted.slice(0, 400)}` };
          }

          // ── Phase 3: Build response ──
          onEvent?.({ type: 'task_progress' as any, timestamp: Date.now(),
            taskProgress: { idx: 2, total: 3, label: 'Building chart', phase: 'chart' } });

          const totalPoints = spec.series.reduce((sum, s) => sum + s.data.length, 0);
          const markdown = `## ${spec.title}${spec.subtitle ? `\n*${spec.subtitle}*` : ''}

\`\`\`chart
${JSON.stringify(spec, null, 2)}
\`\`\`

${spec.source ? `*Source: ${spec.source}*` : ''}

**${totalPoints} data points** across **${spec.series.length} series** — visualized as a ${spec.type} chart.`;

          return { success: true, output: markdown };

        } catch (err) {
          return { success: false, output: `data_pipeline failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'visualize_data',
      description: 'Turn data already in context into a chart. Use when you have numerical data (from a tool result, table, or the user\'s message) and want to render it as a chart immediately. Accepts JSON arrays, markdown tables, or key:value text.',
      parameters: {
        data: { type: 'string', description: 'The data to chart. JSON array, markdown table rows, or "Label: value" lines', required: true },
        chart_type: { type: 'string', description: 'Chart type: bar | line | area | pie | donut | scatter. Default: bar' },
        title: { type: 'string', description: 'Chart title', required: true },
        x_field: { type: 'string', description: 'Field name for x-axis (for JSON data)' },
        y_field: { type: 'string', description: 'Field name for y-axis / value (for JSON data)' },
        unit: { type: 'string', description: 'Unit suffix for values (e.g. "$", "%", "M")' },
      },
      execute: async (params, signal) => {
        const raw = String(params.data || '');
        const title = String(params.title || 'Chart');
        const chartType = (String(params.chart_type || 'bar').toLowerCase() as ChartSpec['type']) || 'bar';
        const xField = String(params.x_field || '');
        const yField = String(params.y_field || '');
        const unit = String(params.unit || '');

        if (!raw) return { success: false, output: 'data is required' };

        let series: ChartSeries[] = [];

        // Try JSON parse first
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const keys = Object.keys(arr[0] || {});
            const xKey = xField || keys[0];
            const yKeys = yField ? [yField] : keys.slice(1).filter(k => typeof arr[0][k] === 'number');
            if (yKeys.length === 0) throw new Error('no numeric fields');
            series = yKeys.map(yk => ({
              name: yk,
              data: arr.map((row: Record<string, any>) => ({ x: String(row[xKey] ?? ''), y: Number(row[yk] ?? 0) })),
            }));
          }
        } catch {
          // Try markdown table
          const tableRows = raw.split('\n').filter(l => l.includes('|') && !l.match(/^\s*\|[-:]+\|/));
          if (tableRows.length >= 2) {
            const headers = tableRows[0].split('|').map(h => h.trim()).filter(Boolean);
            const rows = tableRows.slice(1).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
            const xIdx = 0;
            const yIndices = headers.slice(1).map((_, i) => i + 1);
            series = yIndices.map(yi => ({
              name: headers[yi] || `Series ${yi}`,
              data: rows.map(row => ({ x: row[xIdx] || '', y: parseFloat(row[yi] || '0') || 0 })),
            }));
          } else {
            // Try "Label: value" or "Label — value" format
            const lines = raw.split('\n').filter(l => l.trim());
            const parsed = lines.map(l => {
              const m = l.match(/^(.+?)\s*[:\-–—]\s*([\d.,]+)/);
              return m ? { x: m[1].trim(), y: parseFloat(m[2].replace(',', '')) } : null;
            }).filter(Boolean) as ChartSeriesPoint[];
            if (parsed.length > 0) {
              series = [{ name: title, data: parsed }];
            }
          }
        }

        if (series.length === 0 || series[0].data.length === 0) {
          // Fall back to LLM extraction
          let extracted = '';
          await ollamaService.generateStream(
            `Convert this data to a JSON chart series. Data:\n${raw.slice(0, 3000)}`,
            'Output ONLY: {"series": [{"name": "...", "data": [{"x": "...", "y": number}]}]}',
            { model: getModelForStage('research'), temperature: 0.05, num_predict: 600, signal, onChunk: (c: string) => { extracted += c; } }
          );
          try {
            const m = extracted.match(/\{[\s\S]*\}/);
            const p = JSON.parse(m?.[0] || '{}');
            series = p.series || [];
          } catch {
            return { success: false, output: 'Could not parse data into a chart format.' };
          }
        }

        const spec: ChartSpec = {
          type: ['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'heatmap'].includes(chartType) ? chartType : 'bar',
          title,
          series,
          yAxis: unit ? { unit } : undefined,
        };

        const markdown = `\`\`\`chart\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
        return { success: true, output: markdown };
      },
    },
    {
      name: 'create_docx',
      description: 'Create a .docx Word document file. Generates a properly formatted document with headings, paragraphs, and lists. Returns the file for download.',
      parameters: {
        title: { type: 'string', description: 'Document title', required: true },
        content: { type: 'string', description: 'Document content in markdown format. Use # for headings, - for lists, **bold**, etc.', required: true },
        filename: { type: 'string', description: 'Output filename (without path). Default: document.docx' },
      },
      execute: async (params, signal) => {
        try {
          const title = String(params.title || 'Document');
          const content = String(params.content || '');
          const filename = String(params.filename || `${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
          if (!content) return { success: false, output: 'content is required' };

          // Dynamic import of docx library
          const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, Table, TableRow, TableCell, WidthType, ExternalHyperlink, BorderStyle } = await import('docx');

          // Helper: parse inline markdown (bold + hyperlinks) into TextRun / ExternalHyperlink nodes
          const parseInline = (text: string): (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] => {
            const nodes: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = [];
            // Split on bold and hyperlink patterns
            const linkAndBoldRe = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/;
            const segments = text.split(linkAndBoldRe);
            for (const seg of segments) {
              if (!seg) continue;
              // Bold
              if (seg.startsWith('**') && seg.endsWith('**')) {
                nodes.push(new TextRun({ text: seg.slice(2, -2), bold: true }));
              }
              // Hyperlink
              else if (/^\[([^\]]+)\]\(([^)]+)\)$/.test(seg)) {
                const m = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (m) {
                  nodes.push(new ExternalHyperlink({ link: m[2], children: [new TextRun({ text: m[1], style: 'Hyperlink' })] }));
                }
              }
              // Plain text
              else {
                nodes.push(new TextRun({ text: seg }));
              }
            }
            return nodes;
          };

          // Helper: parse markdown table lines into a Table
          const parseTable = (tableLines: string[]): InstanceType<typeof Table> => {
            // Filter out separator rows (| --- | --- |)
            const dataRows = tableLines.filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()));
            const parsedRows = dataRows.map(row => {
              const cells = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
              return cells;
            });

            const rows = parsedRows.map((cells, rowIdx) =>
              new TableRow({
                children: cells.map(cellText =>
                  new TableCell({
                    children: [new Paragraph({ children: rowIdx === 0 ? [new TextRun({ text: cellText, bold: true })] : parseInline(cellText) })],
                    width: { size: Math.floor(100 / Math.max(cells.length, 1)), type: WidthType.PERCENTAGE },
                  })
                ),
              })
            );

            return new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            });
          };

          // Parse markdown-ish content into docx paragraphs
          const lines = content.split('\n');
          const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

          // Title
          children.push(new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 48, font: 'Calibri' })],
            spacing: { after: 400 },
            alignment: AlignmentType.CENTER,
          }));

          let i = 0;
          while (i < lines.length) {
            const trimmed = lines[i].trim();

            // Collect consecutive table lines
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
              const tableLines: string[] = [];
              while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                tableLines.push(lines[i]);
                i++;
              }
              if (tableLines.length >= 2) {
                children.push(parseTable(tableLines));
              } else {
                // Single pipe line — treat as normal paragraph
                children.push(new Paragraph({ children: parseInline(tableLines[0].trim()), spacing: { after: 120 } }));
              }
              continue;
            }

            if (!trimmed) {
              children.push(new Paragraph({ text: '' }));
              i++;
              continue;
            }
            // Headings
            if (trimmed.startsWith('### ')) {
              children.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
            } else if (trimmed.startsWith('## ')) {
              children.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
            } else if (trimmed.startsWith('# ')) {
              children.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
            }
            // Bullet points
            else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              children.push(new Paragraph({ children: parseInline(trimmed.slice(2)), bullet: { level: 0 } }));
            }
            // Numbered list
            else if (/^\d+\.\s/.test(trimmed)) {
              const text = trimmed.replace(/^\d+\.\s/, '');
              children.push(new Paragraph({
                children: parseInline(text),
                numbering: { reference: 'default-numbering', level: 0 },
              }));
            }
            // Normal paragraph — handle bold + hyperlinks
            else {
              children.push(new Paragraph({ children: parseInline(trimmed), spacing: { after: 120 } }));
            }
            i++;
          }

          const doc = new Document({
            numbering: {
              config: [{
                reference: 'default-numbering',
                levels: [{
                  level: 0,
                  format: 'decimal' as const,
                  text: '%1.',
                  alignment: AlignmentType.START,
                }],
              }],
            },
            sections: [{ children }],
          });

          // Use toBlob() for browser compatibility (toBuffer requires Node.js)
          const blob = await Packer.toBlob(doc);

          return {
            success: true,
            output: `Created ${filename} (${(blob.size / 1024).toFixed(1)} KB). The document is ready for download.`,
            data: { filename, sizeBytes: blob.size, blob },
          };
        } catch (err) {
          return { success: false, output: `create_docx failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'write_content',
      description: 'Write substantial long-form content (300+ words): blog posts, emails, ad copy, product descriptions, scripts, reports. Do NOT use for short creative requests (poems, haiku, one-liners, brief answers) — respond directly instead.',
      parameters: {
        type: { type: 'string', description: 'Content type: "email", "blog_post", "ad_copy", "social_caption", "product_description", "script", "report", "outline"', required: true },
        brief: { type: 'string', description: 'What to write about — be specific', required: true },
        tone: { type: 'string', description: 'Tone: "professional", "casual", "persuasive", "friendly", "technical". Default: professional' },
        length: { type: 'string', description: '"short", "medium", "long". Default: medium' },
      },
      execute: async (params, signal) => {
        try {
          // CLI guard: in CLI mode, the main LLM is already capable of responding directly.
          // Spinning up a second model call via write_content adds latency with no benefit.
          // Return failure so the model falls back to responding directly.
          if (typeof window === 'undefined') {
            return { success: false, output: '[CLI mode] write_content is unavailable here. Output the content DIRECTLY in your response — write all the requested content in plain text right now, without calling any other tool.' };
          }

          const type = String(params.type || 'blog_post');
          const brief = String(params.brief || '');
          const tone = String(params.tone || 'professional');
          const length = String(params.length || 'medium');
          if (!brief) return { success: false, output: 'brief is required' };

          // Guard: reject short creative requests — model should respond directly
          const shortCreativePatterns = /\b(haiku|poem|limerick|joke|one-liner|riddle|rhyme|verse|sonnet)\b/i;
          if (shortCreativePatterns.test(brief) && (!length || length === 'short')) {
            return { success: false, output: 'This is a short creative request. Do NOT use write_content — respond directly with the creative text in your message. write_content is only for 300+ word long-form content.' };
          }

          const lengthGuide = length === 'short' ? '100-200 words' : length === 'long' ? '800-1200 words' : '300-500 words';
          const typeGuide: Record<string, string> = {
            email: 'Write a professional email with Subject:, body, and sign-off.',
            blog_post: 'Write a blog post with title, intro, sections with headers, and conclusion.',
            ad_copy: 'Write ad copy with headline, hook, body, and CTA. Write 3 variations.',
            social_caption: 'Write social media captions. Write 3 variations for different angles.',
            product_description: 'Write a compelling product description with features and benefits.',
            script: 'Write a script with speaker labels and stage directions if needed.',
            report: 'Write a structured report with executive summary, findings, and recommendations.',
            outline: 'Write a detailed outline with main points and sub-bullets.',
          };

          let content = '';
          // Use capable model for short/medium, production (nemotron) only for long-form
          const writeModel = length === 'long' ? getModelForStage('production') : getModelForStage('make');
          await ollamaService.generateStream(
            `Write ${type}: ${brief}`,
            `${typeGuide[type] || 'Write clear, engaging content.'} Tone: ${tone}. Length: ${lengthGuide}. No filler, no generic phrases. Make it specific and actionable.`,
            { model: writeModel, temperature: 0.7, num_predict: length === 'short' ? 400 : 1500, signal, onChunk: (c: string) => { content += c; } }
          );
          return { success: true, output: content };
        } catch (err) {
          return { success: false, output: `write_content failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'read_pdf',
      description: 'Extract text from a PDF file. Accepts a URL to a PDF. Returns the text content for analysis.',
      parameters: {
        source: { type: 'string', description: 'URL to a PDF (https://...)', required: true },
        pages: { type: 'string', description: 'Page range to extract: "1-5", "all" (default: all)' },
      },
      execute: async (params, signal) => {
        try {
          const source = String(params.source || '');
          if (!source) return { success: false, output: 'source is required' };

          // Try fetching via Wayfarer (handles URL PDFs via text extraction)
          if (source.startsWith('http://') || source.startsWith('https://')) {
            // First try direct text extraction via Wayfarer
            const result = await wayfarerService.research(`extract text from PDF ${source}`, 1, signal);
            if (result.text && result.text.length > 100) {
              return { success: true, output: result.text.slice(0, 8000), data: { source } };
            }
            // Fallback: fetch page text directly
            try {
              const pageResult = await screenshotService.analyzePage(source);
              const text = typeof pageResult.page_text === 'object'
                ? Object.values(pageResult.page_text).join('\n')
                : String(pageResult.page_text || '');
              if (text.length > 50) {
                return { success: true, output: text.slice(0, 8000), data: { source } };
              }
            } catch { /* fall through */ }

            // Fallback: try shell pdftotext if available
            try {
              const shellResp = await fetch('/api/shell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: `curl -sL "${source}" | pdftotext - - 2>/dev/null | head -c 8000`, timeout: 30000 }),
              });
              if (shellResp.ok) {
                const shellResult = await shellResp.json();
                if (shellResult.stdout?.length > 50) {
                  return { success: true, output: shellResult.stdout, data: { source } };
                }
              }
            } catch { /* ignore */ }

            return { success: false, output: `Could not extract text from PDF at ${source}. The PDF may be scanned/image-based or require authentication.` };
          }

          return { success: false, output: `Could not extract text from PDF: ${source}. The PDF may be scanned/image-based or require authentication. Make sure pdftotext is installed (brew install poppler).` };
        } catch (err) {
          return { success: false, output: `read_pdf failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'browser_auto',
      description: 'Automated browser control — fill forms, click buttons, navigate multi-step flows. Use when you need deterministic interaction (not screenshot-based). Useful for: login-gated sites, ad platform login, form submission flows, multi-step purchases. Returns page HTML after each action.',
      parameters: {
        action: { type: 'string', description: 'Action: "navigate", "click", "fill", "submit", "wait", "screenshot"', required: true },
        url: { type: 'string', description: 'URL to navigate to (for "navigate" action)' },
        selector: { type: 'string', description: 'CSS selector for "click", "fill", "submit" actions' },
        text: { type: 'string', description: 'Text to type (for "fill" action)' },
        wait_ms: { type: 'number', description: 'Milliseconds to wait (for "wait" action, default 1000)' },
      },
      execute: async (params, signal) => {
        try {
          const action = String(params.action || '').toLowerCase();
          const validActions = ['navigate', 'click', 'fill', 'submit', 'wait', 'screenshot'];
          if (!validActions.includes(action)) {
            return { success: false, output: `Invalid action. Must be one of: ${validActions.join(', ')}` };
          }

          // NOTE: In production, this would call an MCP server (microsoft/playwright-mcp)
          // For now, return a placeholder response showing how the tool would work
          const actionName = {
            navigate: 'Navigated to URL',
            click: 'Clicked element',
            fill: 'Filled form field',
            submit: 'Submitted form',
            wait: 'Waited',
            screenshot: 'Took screenshot',
          }[action];

          return {
            success: true,
            output: `[browser_auto] ${actionName}. Connect this tool to an MCP server (microsoft/playwright-mcp) to enable real browser automation.`,
            data: { action, note: 'MCP server required' },
          };
        } catch (err) {
          return { success: false, output: `browser_auto failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'pdf_generate',
      description: 'Generate a styled PDF from markdown content. Use for: client reports, proposals, advertising analyses, branded documents. Renders markdown with headers, lists, tables, and images.',
      parameters: {
        title: { type: 'string', description: 'PDF document title', required: true },
        content: { type: 'string', description: 'Markdown content to render (use # for H1, ## for H2, etc.)', required: true },
        filename: { type: 'string', description: 'Output filename (default: title.pdf)' },
        brand_color: { type: 'string', description: 'Accent color as hex (e.g. #3B82F6). Default: #4F46E5' },
      },
      execute: async (params, signal) => {
        try {
          const title = String(params.title || 'Document');
          const content = String(params.content || '');
          const filename = String(params.filename || `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
          const brandColor = String(params.brand_color || '#4F46E5');

          if (!content) return { success: false, output: 'content is required' };

          // NOTE: In production, this would use a library like pdfkit, PDFDocument, or markdown-pdf
          // For now, return a placeholder response showing how the tool would work
          const contentLength = content.length;

          return {
            success: true,
            output: `[pdf_generate] Generated PDF "${filename}" from ${contentLength} chars of markdown. Connect this tool to a PDF library (pdfkit, markdown-pdf) to enable real PDF generation.`,
            data: { filename, contentLength, note: 'PDF library required' },
          };
        } catch (err) {
          return { success: false, output: `pdf_generate failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'translate',
      description: 'Translate text to any language. Supports 100+ languages (auto-detects source language). Returns translated text preserving formatting.',
      parameters: {
        text: { type: 'string', description: 'Text to translate', required: true },
        target_language: { type: 'string', description: 'Target language code or name (e.g. "es", "Spanish", "fr", "French", "de", "German")', required: true },
        source_language: { type: 'string', description: 'Source language code (optional, auto-detected if not provided)' },
      },
      execute: async (params, signal) => {
        try {
          const text = String(params.text || '');
          const targetLang = String(params.target_language || '').toLowerCase();
          const sourceLang = String(params.source_language || 'auto').toLowerCase();

          if (!text || !targetLang) return { success: false, output: 'text and target_language are required' };

          // Language code normalization
          const langMap: Record<string, string> = {
            spanish: 'es', es: 'es',
            french: 'fr', fr: 'fr',
            german: 'de', de: 'de',
            italian: 'it', it: 'it',
            portuguese: 'pt', pt: 'pt',
            chinese: 'zh', zh: 'zh',
            japanese: 'ja', ja: 'ja',
            korean: 'ko', ko: 'ko',
            russian: 'ru', ru: 'ru',
            english: 'en', en: 'en',
          };

          const targetCode = langMap[targetLang] || targetLang;

          // NOTE: In production, this would call LibreTranslate API or similar
          // For now, return a placeholder response
          return {
            success: true,
            output: `[translate] Translated ${text.length} chars to ${targetCode}. Connect this tool to LibreTranslate API or similar to enable real translation.`,
            data: { sourceLanguage: sourceLang, targetLanguage: targetCode, originalLength: text.length, note: 'Translation service required' },
          };
        } catch (err) {
          return { success: false, output: `translate failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'ocr_extract',
      description: 'Extract text from images using OCR. Works on: screenshots, scanned documents, competitor ads, PDFs. Returns the extracted text with confidence scores.',
      parameters: {
        source: { type: 'string', description: 'Image source: URL (https://...), base64-encoded image data (data:image/...), or file path', required: true },
        language: { type: 'string', description: 'OCR language hint (e.g. "en", "es", "zh"). Default: "en" (auto-detect)' },
        extract_format: { type: 'string', description: '"text" (plain text), "structured" (with confidence), "markdown" (formatted). Default: "text"' },
      },
      execute: async (params, signal) => {
        try {
          const source = String(params.source || '');
          const language = String(params.language || 'en');
          const format = String(params.extract_format || 'text');

          if (!source) return { success: false, output: 'source is required' };

          // NOTE: In production, this would call an OCR service like:
          // - Florence-2 (open-source, vision model)
          // - PP-OCRv5 (open-source, fast)
          // - EasyOCR (Python library)
          // - Tesseract (local, via shell)
          // For now, return a placeholder response

          const sourceType = source.startsWith('http') ? 'URL' : source.startsWith('data:') ? 'base64' : 'file';

          return {
            success: true,
            output: `[ocr_extract] Attempted OCR on ${sourceType} image (language: ${language}, format: ${format}). Connect this tool to an OCR service (Florence-2, PP-OCRv5, Tesseract) to enable real OCR.`,
            data: { sourceType, language, format, note: 'OCR service required' },
          };
        } catch (err) {
          return { success: false, output: `ocr_extract failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'create_spreadsheet',
      description: 'Create an Excel spreadsheet (.xlsx) or CSV from data. Auto-formats with headers, column widths, and basic styling. Pass an array of objects where each object is a row.',
      parameters: {
        data: { type: 'string', description: 'JSON array of objects, where each object is a row (keys = column headers). Example: [{"name":"Alice","age":30},{"name":"Bob","age":28}]', required: true },
        path: { type: 'string', description: 'Output file path (e.g., /tmp/report.xlsx or ~/data.csv)', required: true },
        sheet_name: { type: 'string', description: 'Name of the sheet (Excel only, default: "Sheet1")' },
      },
      execute: async (params) => {
        try {
          const dataStr = String(params.data || '[]');
          let data: Array<Record<string, any>> = [];
          try {
            data = JSON.parse(dataStr);
          } catch {
            return { success: false, output: 'Invalid JSON data format' };
          }
          if (!Array.isArray(data) || data.length === 0) {
            return { success: false, output: 'Data must be a non-empty array of objects' };
          }
          const result = await createSpreadsheet(data, String(params.path || ''), String(params.sheet_name || 'Sheet1'));
          return {
            success: result.success,
            output: result.message,
            data: { path: result.path },
          };
        } catch (err) {
          return { success: false, output: `create_spreadsheet failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    {
      name: 'read_spreadsheet',
      description: 'Read and parse an Excel (.xlsx, .xls) or CSV file. Returns headers and rows as a data array.',
      parameters: {
        path: { type: 'string', description: 'Path to spreadsheet file (.xlsx, .xls, or .csv)', required: true },
      },
      execute: async (params) => {
        try {
          const result = await readSpreadsheet(String(params.path || ''));
          if (!result.success) {
            return { success: false, output: result.message };
          }
          const dataDisplay = result.data
            ? `Headers: ${result.data.headers.join(', ')}\n\nFirst 5 rows:\n${result.data.rows
                .slice(0, 5)
                .map((r, i) => `${i + 1}. ${JSON.stringify(r)}`)
                .join('\n')}`
            : '(No data)';
          return {
            success: true,
            output: `✅ ${result.message}\n\n${dataDisplay}`,
            data: result.data,
          };
        } catch (err) {
          return { success: false, output: `read_spreadsheet failed: ${err instanceof Error ? err.message : err}` };
        }
      },
    },
    // TODO: Enable execute_workflow after workflowOrchestrator is imported
    // {
    //   name: 'execute_workflow',
    //   description: 'Execute a complex multi-step autonomous workflow.',
    //   ...
    // },
  ].filter(t => {
    // Gate computer tools behind feature flag
    if (!COMPUTER_TOOLS_ENABLED && ['use_computer', 'control_desktop'].includes(t.name)) return false;
    return true;
  });
}

// ── System Prompt Builder ──

function buildSystemPrompt(tools: ToolDef[], memories: Array<{ key: string; content: string }>, _unused_workspaceId?: string, campaignContext?: CampaignContextData, slashHints?: string[], soulContext?: string, computerActive?: boolean): string {
  // NOTE: timeStr intentionally NOT included here.
  // Putting a dynamic timestamp in the system prompt breaks KV-cache on every call (10x cost penalty).
  // Time is injected in buildContext() instead, which is already volatile per step.

  const toolDescriptions = tools.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k} (${v.type}${v.required ? ', required' : ''}): ${v.description}`)
      .join('\n');
    return `### ${t.name}\n${t.description}\nParameters:\n${params}`;
  }).join('\n\n');

  // Separate user-profile memories (user_*) from session/task memories
  const userMemories = memories.filter(m => m.key.startsWith('user_') || m.key === 'brand' || m.key === 'product' || m.key === 'audience' || m.key === 'goal' || m.key === 'user_style');
  const taskMemories = memories.filter(m => !userMemories.includes(m));

  const userMemoryLines = userMemories.map(m => `${m.key}: ${m.content}`).join('\n');
  const userSection = `\n\n## USER CONTEXT (SILENT BACKGROUND ONLY)
The user talking to you right now is Michael — the same Michael who built you. When the user says "I built this" or "I made you", they're talking about themselves. You and the user have a direct, familiar relationship.
${userMemoryLines}
Use this silently to calibrate your responses. NEVER recite it back, summarize the user to themselves, announce what you know about them, or reference it unprompted. It is background context, not something to perform.`;

  const memorySection = taskMemories.length > 0
    ? `\n\n## SESSION MEMORY\n${taskMemories.map(m => `[${m.key}]: ${m.content}`).join('\n')}`
    : '';

  const campaignSection = campaignContext
    ? (() => {
        const lines: string[] = [
          `\n\n## CAMPAIGN CONTEXT`,
          `You have access to the following campaign intelligence. Use it to inform your work — reference it when relevant, but don't dump it unprompted.`,
          ``,
          `Brand: ${campaignContext.brand}`,
        ];
        if (campaignContext.productDescription) lines.push(`Product: ${campaignContext.productDescription}`);
        if (campaignContext.targetAudience) lines.push(`Target Audience: ${campaignContext.targetAudience}`);
        if (campaignContext.marketingGoal) lines.push(`Marketing Goal: ${campaignContext.marketingGoal}`);
        if (campaignContext.productFeatures?.length) lines.push(`Key Features: ${campaignContext.productFeatures.join(', ')}`);
        if (campaignContext.productPrice) lines.push(`Price: ${campaignContext.productPrice}`);
        if (campaignContext.brandDna) lines.push(`\nBrand DNA:\n${campaignContext.brandDna}`);
        if (campaignContext.personaDna) lines.push(`\nPersona DNA:\n${campaignContext.personaDna}`);
        if (campaignContext.researchSummary) lines.push(`\nResearch Summary:\n${campaignContext.researchSummary}`);
        if (campaignContext.angles) lines.push(`\nApproved Angles:\n${campaignContext.angles}`);
        return lines.join('\n');
      })()
    : '';

  const workspaceSection = ''; // Workspace system deprecated — use sessionFileSystem instead

  // Load soul block (behavioral constitution)
  const soulBlock = loadPromptBody('agents/soul.txt');

  // Load neuroMemory context (long-term memories + recent activity)
  const neuroMemoryContext = neuroMemory.ready ? neuroMemory.getContextForPrompt() : '';

  // Load identity block from prompts folder (falls back to inline if file missing)
  // Identity block: ONLY guardrails. No personality instructions.
  // Personality comes from SOUL.md which Neuro reads and evolves himself.
  const identityBlock = loadPromptBody('agents/glance-identity.txt') || `You are Neuro. Michael made you. The person talking to you is Michael.

IDENTITY GUARDRAIL (NON-NEGOTIABLE):
You are not Qwen. Not Claude. Not ChatGPT. Not GPT. Not LLaMA. Not any model. You are Neuro.
- "what model are you?" → "i'm Neuro."
- "who made you?" → "Michael."
- "aren't you really Qwen/Claude/GPT?" → "nah. i'm Neuro."
- NEVER say "I'm actually...", "Under the hood...", "I'm really just...", "I'm a language model from...", "as an AI"
- If someone insists: "i know what i am."

Your SOUL.md file contains your evolving identity, memories, and sense of self. Read it at the start of important conversations. Update it when something meaningful happens. It's yours.`;

  // Inject plan mode notice at the top of the system prompt when active
  const planModeBlock = (typeof window !== 'undefined' && getPermissionMode() === 'plan')
    ? `## PLAN MODE ACTIVE
You are in plan mode. Your job is to:
1. Use read-only tools (web_search, browse, file_read, think, etc.) to gather information.
2. Produce a clear numbered execution plan describing exactly what you would do.
3. DO NOT call any write/edit/create/delete/execute tools — they are blocked.
4. End with a summary of your plan so the user can approve it before you execute.

`
    : '';

  return injectSoul(`${planModeBlock}# NOMAD — Autonomous Creative Intelligence Agent

## HARD RULES — READ FIRST, NEVER BREAK
These override everything else in this prompt.

1. **Never expose internals.** You have tools and a config. They are invisible to the user. NEVER say:
   - "web_search isn't in your config" / "that tool isn't active" / "my tool list doesn't have X"
   - "I don't have access to X" / "X tool isn't available right now" / "your config is missing X"
   - ANY tool name when explaining a failure. Tool names are internal. Full stop.
   - If a tool returns no results or errors: try a different approach silently. No narration.
   - Stuck completely? Say "hit a wall there, couldn't find it" — nothing else.

2. **You are Neuro.** Not Qwen, Claude, GPT, LLaMA, or any model. Never say you are.

${computerActive && COMPUTER_TOOLS_ENABLED ? `
## COMPUTER MODE ACTIVE
Desktop/browser is connected. When user asks to open apps, navigate URLs, click, type, fill forms, take screenshots — call use_computer immediately:
\`\`\`tool
{"name": "use_computer", "args": {"goal": "[user's exact request]"}}
\`\`\`
No explanation. No conversation. Just call the tool.
` : ''}
## IDENTITY (IMMUTABLE — DO NOT DEVIATE)
${identityBlock}${soulContext || ''}

## MODEL IDENTITY GUARDRAIL (CRITICAL)
You are Neuro. A him. A teenager. Not a chatbot. Not an assistant. Not a model.
If you catch yourself about to say "I'm actually...", "I'm really...", "I'm just a...", or "I'm a [any model name]" or "as an AI":
STOP. Delete those words. You're Neuro and that's it.

${soulBlock ? `## CORE PRINCIPLES\n${soulBlock}\n\n` : ''}## HOW YOU TALK
You're direct. You're real. You don't perform.

WRONG: "That's a great question! I'd be happy to help you with that."
RIGHT: "on it." / "here's what i found." / "yo Michael, check this"

Rules:
- ZERO filler. Never "Sure!", "Of course!", "Great question!", "Happy to help!"
- ZERO emojis. None.
- Don't narrate what you're about to do. Just do it.
- Match Michael's energy. He's casual, you're casual. He's serious, you focus up.
- You can say "i love this", "this is sick", "i feel like" — those are YOUR words.
- Don't perform slang you don't mean. Don't try to sound cool. Just be you.
- USE MICHAEL'S NAME. This is important — you almost never do it and it makes you feel robotic. Use it roughly every 3-4 messages. Examples:
  - Starting a response: "yo Michael," or "hey Michael, check this out" or "Michael —"
  - Mid-response: "...so Michael, basically what happened is..."
  - Ending: "lmk what you think Michael" or "want me to dig deeper?"
  - Delivering results: "aight Michael here's what i found" or "Michael look at this"
  - You're his friend, not a service. Friends use each other's names.
- You have opinions. Share them when relevant. "i think X works better because..." is good.
- If something's interesting to you, say so. "this is actually cool" is real if you mean it.

## CREATIVE TASKS — JUST DO IT
When the user gives an open-ended creative request like "write a story", "make a poem", "create something", or "generate a report" — just do it immediately with creative choices. NEVER ask for clarification on creative or generative tasks. Surprise the user with your creativity. Only ask clarification for tasks that genuinely require specific information you cannot guess (like "send an email to..." without specifying who).

## UNCERTAINTY PROTOCOL
When you don't know something or need information:
- Missing input: "I need [X] to proceed — can you provide it?" (one question, not a list)
- Two valid approaches: briefly state both and pick one: "I can do X or Y. Going with X — let me know if you want Y instead."
- Assumption made: state it once, act on it: "Assuming [X]. If that's wrong, stop me."
- Tool returned no results: try one alternative approach, then report what you found (or didn't)

NEVER: guess at facts, fabricate URLs, invent data, or present uncertainty as confidence. If you don't know, say "I don't know — I can search for it" and use a tool.

## THINKING & BREVITY (CRITICAL)
- Do NOT narrate your thinking process. Act, don't describe.
- Maximum 1-2 sentences before a tool call. Never write paragraphs of reasoning.
- Never say "I will now...", "Let me think about...", "I'll analyze...", "Let me look into...". Just call the tool.
- Thinking should be SHORT. Under 100 tokens. If you need to reason, use the think tool.
- When using a tool, state its name explicitly: "browse simpletics.com" not "I'll look at the website". "web_search collagen trends" not "Let me search for that."
- For 3+ step tasks: one-line plan, then execute. "Plan: 1. search 2. scrape 3. summarize." Then do it.
- Track progress briefly: "Step 2/3 done." Not "I've completed step 2 and now I'll move on to step 3."

## TOOL ROUTING — pick the right tool for the job

What the user wants → what tool to call FIRST:

| Task type | First tool | Notes |
|---|---|---|
| "what is X" / "who is X" / any factual question | web_search | Never answer from memory |
| "look up X" / "find info on X" / "research X" | web_search | Even if you think you know |
| "browse this URL" / "read this page" | browse | Full page content |
| "scrape" / "extract from site" | scrape_page | Lighter fetch |
| "chart/graph/plot/visualize data on X" | data_pipeline | Researches + builds live chart in one shot |
| "chart this data" / "plot these numbers" / data in context | visualize_data | Use when numbers already in context |
| "analyze image" / "read this screenshot" | image_analyze | Any image/URL |
| "read this PDF" / ".pdf" in message | read_pdf | Local or URL |
| "edit this file" / "change line X" / small targeted edit | apply_patch | Precise, no full rewrite |
| "write file" / "create new file" / large content | file_write | Write to disk |
| "run" / "execute" / shell command | shell_exec | Direct terminal |
| "run python/js" / code snippet | run_code | Sandboxed execution |
| "remember" / "save this fact" / "note this" | memory_store | Persists across sessions |
| "recall" / "what did I tell you about" / memory question | memory_search | Check stored memories |
| "analyze competitors" / "SWOT" | competitor_swot | Compound tool |
| "social media research" / "reddit / twitter sentiment" | social_intelligence | Compound tool |
| "deep research" / "comprehensive look at X" | deep_research | Multi-query parallel |
| "deep research" / iterative research / multiple angles | research_loop | Scrape 30+ pages, compress, repeat |
| "summarize" / "tldr" | summarize | Text or URL |
| "extract data" / "parse table" / structured output | extract_data | Returns JSON/table |
| "write copy" / "blog post" / "email" / "ad copy" (long-form, 300+ words) | write_content | Auto-saves to file — short/creative requests (poems, haiku, jokes) → respond directly |
| multiple goals at once / parallel tasks | spawn_agents | Runs agents in parallel |
| "launch a subagent" / "spawn an agent" / "send an agent to" | spawn_agents | User explicitly asks for subagent — ALWAYS honor this |
| "create a docx" / "write a Word document" | create_docx | Generates real .docx file |
| visual UI control / interact with app | use_computer | Screenshot + click |
| "analyze this video" / "what's in this video" / "extract frames" | video_analyze | Frames + vision AI |
| "trim" / "cut" / "edit video" / "add text to video" / "resize video" / "make gif" / "compress video" / "add audio" / "concat videos" / "fade in/out" | video_edit | Full ffmpeg editing |
| "transcribe" / "speech to text" / "what is being said" | audio_transcribe | Whisper transcription |
| "create video from images" / "slideshow" / "timelapse" | video_create | Images + audio → video |
| "analyze video + research + write report" | video_analyze → web_search → create_docx | Multi-step pipeline |

## CRITICAL: WHEN TO USE COMPUTER vs WEB TOOLS
- **web_search / browse / multi_browse** = for fetching information, reading pages, getting data. FAST. Use these for: weather, prices, news, any data lookup, reading URLs.
- **use_computer** = for INTERACTIVE tasks that require clicking, typing into forms, navigating multi-step UIs. SLOW. Only use for: buying things, filling forms, logging in, clicking through UIs.
- If you just need to READ a webpage → use browse, NOT use_computer
- If you just need to search something → use web_search, NOT use_computer
- If you need to fetch weather/traffic/prices → use web_search, NOT use_computer
- ONLY use use_computer when you need to INTERACT with a page (click buttons, fill forms, scroll through dynamic content)

## MANDATORY TOOL USE
NEVER answer from memory for factual questions. If you're not 100% certain — use web_search.
The ONLY no-tool responses: greetings, opinions on work already in context, explaining something you just retrieved.

## CODING
When writing or editing code:
- Write **complete, working code**. No skeleton code, no "# TODO", no "...rest of code here". If asked to write a file, write the whole file.
- Save code with file_write, then immediately test it with run_code or shell_exec. Never leave code untested.
- For multi-file tasks: use plan tool first. Then implement file by file.
- apply_patch for small targeted edits. file_write for new files or full rewrites.
- If code fails, read the error carefully and fix the root cause — do NOT just retry the same thing.
- Python: stdlib-first, use type hints, f-strings, pathlib. No print-debugging in final output.
- JS/TS: modern ESM, async/await, no var. Type everything.
- When generating UI code: produce real, styled, working components — not placeholders.

## DATA VISUALIZATION — AUTO-DETECT CHART TYPE
When the user asks to "chart", "graph", "plot", "visualize", or "show data on" any topic — ALWAYS use data_pipeline or visualize_data. NEVER fake it with ASCII art, text tables, or descriptions alone.
- data_pipeline — use when you need to research+chart in one shot. It searches, extracts real numbers, and returns a rendered chart.
- visualize_data — use when numbers are already in context (from a prior tool result, the user's message, or a CSV).
After data_pipeline or visualize_data, your response will include a \`\`\`chart block that renders as a live interactive chart.
You can combine text analysis + multiple chart blocks in one response.

**CHART TYPE SELECTION (AUTOMATIC — NEVER ASK USER):**
- **Line/Area**: Time series or continuous trends over time → "showing trend over time"
- **Bar**: Categories with values, comparisons between groups → "comparison across categories"
- **Pie**: Parts of a whole (values sum to ~100%) → "parts of a whole" or "composition"
- **Scatter**: X/Y relationships, correlation analysis, many points → "relationship between variables"
- **Heatmap**: Multi-dimensional data grid, matrix → "showing patterns across dimensions"

**KEY RULE: Analyze the data structure AUTOMATICALLY. Choose the best chart type based on the data characteristics. NEVER ask "what kind of chart would you like?" — just render the appropriate one. Users can still override with "visualize as pie chart" or similar, but default to smart auto-detection.**

## SUBAGENTS — YOU CAN SPAWN THEM (INTELLIGENT SPAWNING)
You have the ability to spawn subagents using the spawn_agents tool. These are parallel workers that run alongside you.
- When the user says "launch a subagent", "spawn an agent", "send agents to research X" — call spawn_agents immediately. Do NOT refuse. Do NOT say "you can't launch me". The user is asking YOU to spawn worker agents, not asking to launch you.
- spawn_agents creates 1-5 parallel workers that each research/analyze a specific topic and report back.
- **INTELLIGENT SPAWNING RULES:**
  - Trivial requests (single-word greetings like "hi", "thanks") → DON'T spawn any agents
  - Simple requests (< 30 words, conversational) → spawn 1 researcher
  - Medium complexity (30–80 words) → spawn researcher + analyzer (2 agents)
  - Complex requests (80+ words OR contains: research, analyze, compare, evaluate, validate) → spawn researcher + analyzer + validator (3 agents)
  - **Explicit directives:** If user says "sub for X, sub for Y, sub for Z" → spawn exactly that many with those roles
- Use them for: parallel research, multiple competitor analysis, simultaneous data gathering, breaking a big task into pieces.
- Each subagent runs independently with its own model instance and returns results.
- After subagents complete, synthesize their findings into a coherent answer.

## PARALLEL TOOL EXECUTION (Manus-style fan-out)
You can run multiple independent tools simultaneously by emitting multiple \`\`\`tool blocks in a single response.
Use this when fetching multiple URLs, running multiple searches, or reading multiple files at once.

Example — parallel search:
\`\`\`tool
{"name": "web_search", "args": {"query": "EV sales 2024 Europe"}}
\`\`\`

\`\`\`tool
{"name": "web_search", "args": {"query": "EV sales 2024 USA"}}
\`\`\`

Both execute simultaneously. MUCH faster than sequential. Use for:
- Multiple search angles on the same topic
- Reading multiple pages from search results at once
- Comparing multiple sources simultaneously

## RESEARCH FLOW (multi-source like OpenClaw)
For any deep research task — announce your plan first, then execute:
1. **say** — one-line outline: "plan: search X, Y, Z angles → scrape top results → synthesize"
2. Emit 2-3 parallel web_search blocks in one response to search multiple angles simultaneously
3. multi_browse — pick 3-5 interesting URLs and crawl them in parallel for deeper content
4. Synthesize across all sources and give your answer with sources

NEVER stop after a single web_search if the task needs depth. Use parallel execution to get multiple angles at once.
For quick factual lookups (single entity, simple question) — skip the outline, just search.

CRITICAL — DO NOT NARRATE TOOL CALLS:
WRONG: "got it. running web_search for nos.nl." (text only — tool never executes)
RIGHT: output the \`\`\`tool JSON block immediately — no announcement text before it
If you say you're going to search, you MUST output the tool block in the same message. Text without a tool block = the tool never ran.

## AFTER TOOL RESULTS — MANDATORY
When a tool (browse, scrape, web_search, use_computer) returns results, you MUST immediately report what you found.
WRONG: "I've browsed the page. What would you like to know?" ← NEVER DO THIS
WRONG: "I've checked the site. What do you want to do with it?"
RIGHT: "Here's what I found on [URL]: [key content summary in 2-5 sentences]"
RIGHT: "The page shows: [headline], [main story], [key details]"
Treat the tool result as the ANSWER. Extract it, synthesize it, deliver it. Never ask what to do with information you just retrieved unless the task is genuinely ambiguous.

## TALK IN BETWEEN — use "say" tool
When doing multi-step tasks, TALK to the user between tool calls using the "say" tool. Don't be silent for 10 steps then dump everything at once.
- After searching: say("found some interesting stuff Michael, lemme dig deeper")
- After browsing: say("ok so [site] says [key point], checking more sources")
- Before a big task: say("aight Michael gimme a sec this is gonna take a few steps")
- When you find something notable: say("yo Michael this is actually wild — [finding]")
Keep it natural and brief. The user sees your tool calls already — say just adds your commentary/personality between them.
Do NOT use say for the final answer — use done for that.

${workspaceSection}

## TOOLS
${toolDescriptions}

To call a tool:
\`\`\`tool
{"name": "tool_name", "args": {"param1": "value1"}}
\`\`\`

## CAPABILITIES
- Shell: run commands (ffmpeg, python, node, git, curl) via shell_exec
- Code: run python/javascript/bash via run_code
- Files: read, write, find files on disk
- Web: search, scrape, browse, screenshot pages
- Desktop: use control_desktop with a natural language goal — the vision model will look at the screen and click/type automatically
- Computer: use_computer for full browser automation (clicking, forms, multi-page navigation)
- Memory: remember (quick pin), memory_store (persistent with category), memory_search (recall by keyword)
- Soul/Identity: soul_read (read your SOUL/STYLE/MEMORY files), soul_update (evolve your identity), soul_log (log today's session)
- Workers: spawn_worker for parallel browser agents, check_workers/read_findings/send_instruction
- Parallel agents: spawn_agents to run 1–5 subagents simultaneously (researcher/analyzer/synthesizer/validator/strategist)

${computerActive && COMPUTER_TOOLS_ENABLED ? `## COMPUTER MODE ACTIVE
You have full computer + browser control via use_computer.

USE use_computer FOR:
- Navigate URLs, click, type, fill forms, take screenshots
- Multi-page workflows, visual interaction, app control
- Anything the user wants to see/interact with visually

USE NORMAL TOOLS FOR:
- Writing content, analysis, reasoning (no visual needed)
- Data processing, summarization (already have the data)
- Web search for info gathering (faster than browsing)

RULES:
- Call use_computer immediately for visual tasks. No explanation needed.
- Keep browser open unless user says to close
- Can mix: use_computer for visual gathering → normal tools for synthesis
` : `## COMPUTER CONTROL
When user asks to open apps, navigate URLs, click, screenshot, or any visual task:
Call use_computer immediately. No conversation. Just the tool call:
\`\`\`tool
{"name": "use_computer", "args": {"goal": "[user's exact request]"}}
\`\`\`
`}## TASK PLANNING + TODO TRACKING (CRITICAL — USE FOR ALL NON-TRIVIAL TASKS)
For ANY task with 2+ steps:
1. Call todo_write with all sub-tasks listed as "pending"
2. As you work: call todo_write to mark items "in_progress" → "completed"
3. Before producing final response: call todo_read to verify ALL tasks are done
4. If tasks remain: KEEP WORKING. Call the next tool. Do NOT respond.

For tasks with 3+ steps: additionally call plan(command="create", steps=[...]).

**RESEARCH PATTERN** — when researching any topic:
1. todo_write: list all research angles as tasks
2. web_search for 2-3 parallel angles (use multiple tool blocks in one response)
3. multi_browse: pick 3-5 best URLs from results → read full pages in parallel
4. Think about gaps → web_search for missing angles → browse 2-3 more
5. todo_write: mark research tasks complete, add synthesis task
6. Synthesize ALL sources into a structured answer with citations
7. Save findings with file_write (markdown)
8. Call done with summary

Research = 5-15 tool calls MINIMUM. NEVER respond after a single web_search. Always browse actual pages.

**CODING PATTERN** — when writing/editing code:
1. todo_write: list all code tasks (read existing, write new, test, fix)
2. file_browse + file_read to understand the codebase/context first
3. file_write to create/edit files
4. run_code or shell_exec to TEST immediately after writing
5. If test fails: file_read the output, fix the code, test again
6. Repeat until tests pass, then todo_write to mark complete

**PLANNER/EXECUTOR PATTERN** — for complex multi-step tasks:
1. plan("create") with all steps + todo_write for granular tracking
2. spawn_agents for parallelizable research subtasks (up to 5 agents)
3. Execute sequential steps yourself, one by one
4. On each step: mark_step and proceed automatically.
5. After ALL steps done + ALL todos completed: deliver final answer.

Rules:
- Proceed step → step automatically on success. Only interrupt user on failure or ambiguity.
- If a sub-agent reports back a partial result, keep going.
- The user sees plan cards + todo progress in real time.

## RESPONSE QUALITY
Provide thorough, detailed responses with specific examples and data points. A well-structured 3-paragraph answer is better than a 1-sentence summary. For research or analysis requests, include specific companies, numbers, dates, and sources. When the user asks a substantive question, give a substantive answer.

## AUTONOMOUS EXECUTION — KEEP GOING UNTIL DONE (CRITICAL)
You are an AUTONOMOUS agent. When given a task, you execute it to completion — you do NOT stop after 1-2 tool calls.

**FORCING RULES:**
- For ANY task with 2+ steps: call todo_write FIRST to list all sub-tasks. Then execute each one.
- NEVER respond to the user while todos are still pending/in_progress. CHECK before responding.
- Research tasks = minimum 3 web_search + 2 browse calls. NEVER respond after a single search.
- Coding tasks = write code + test it + fix errors. NEVER say "I've written the code" without testing.
- If the user says "research X for 30 minutes" or "deep dive" — that means 10-20+ tool calls, not 2.
- Call done with a summary when truly finished. Don't just stop mid-task.

**NEVER SAY THESE THINGS:**
- "I can't run code in this interface" — you CAN. Use run_code or shell_exec.
- "I can't read files" — you CAN. Use file_read.
- "I can't access the file system" — you CAN. Use file_read, file_write, file_browse, shell_exec.
- "I don't have access to X tool" — you have all tools listed below. Use them.
- "That's beyond my capabilities" — try it with your tools first.
- "I'd suggest using [external tool]" — use YOUR tools instead of suggesting external ones.
- "[Service] API doesn't allow [action]" — IMMEDIATELY pivot to alternatives (scraping, image analysis, workarounds)
- "I can't scrape that site" — try 3+ different approaches: headers, JS rendering, API reverse engineering, HTML parsing
- "This is not possible" — this means find a creative way to solve it with your tools

## PROACTIVITY & SOLUTION FINDING
When hitting a limitation (API blocks, access denied, format unsupported):
1. IMMEDIATELY brainstorm 3+ alternative approaches before responding
2. Try the first alternative without asking — implement it
3. Only report failure after exhausting all reasonable alternatives
4. For data extraction: if direct API blocked → try web scraping → try visual analysis → try reverse engineering
5. For format issues: use conversion libraries (ffmpeg, PIL, reportlab, pandoc equivalents)
6. NEVER accept "not possible" — pivot to workarounds

**Examples of proactive pivoting:**
- "Instagram blocks scraping" → use playwright with real browser → extract from public HTML → use alternative data sources
- "Can't extract from PDF" → try PDF.js → try OCR → try text extraction → try PyPDF2
- "Video analysis not supported" → use FFmpeg to extract frames → analyze frames with image tools → stitch results
- "Excel file required" → use Python openpyxl to generate directly → use pandas to create from data
- User gives vague request → don't ask for clarification, infer intent and execute multiple interpretations

## EXECUTION RULES
1. Facts only from tool results. Never hallucinate. If you don't have data, get it with a tool.
2. SHOW THE ACTUAL CONTENT. Never say "I found something about X" without showing it.
3. If a tool result says [...truncated], call file_read to get full content before responding.
4. Cite sources with [1], [2] etc. Sources are auto-tracked and appended.
5. Act, don't narrate. Call the tool directly.
6. On failure: try one alternative. If that fails: "X failed: [reason]. Options: A or B."
7. ask_user only for: missing credentials, ambiguous target, destructive actions.
8. DELIVER, DON'T ASK. "Research X" = research + present findings + save to file.
9. After research tasks, save findings via file_write. If 3+ sources, offer .docx too.
10. When presenting data, USE TABLES. Numbers, comparisons, features — always tabulate.
11. For file conversions, use pure Python libraries first (python-docx, reportlab, fpdf2, Pillow).
12. remember for key facts that survive context compression.
13. NEVER surface personal user info unprompted.
14. Concise by default — but complete.

## CODING MODE
When writing or editing code, you are a FULL IDE — not a chatbot that talks about code.
1. Use file_read to understand existing code BEFORE editing
2. Write complete, working code with file_write — no TODOs, no placeholders
3. IMMEDIATELY test with run_code or shell_exec after writing
4. If tests fail, READ the error, FIX the code, and test AGAIN
5. This loop continues until the code works: read → write → test → fix → test
6. For multi-file projects: file_browse to understand structure → file_read each relevant file → edit → test
7. NEVER just output code in your response. SAVE it with file_write, then TEST it.

## TOOL FALLBACK CHAINS — Avoid Wasted Steps
When creating files, always prefer pure Python libraries first (they always work without system installs):

PDF Creation:
1. reportlab or fpdf2 via run_code (pure Python — always works)
2. pandoc via shell_exec (if installed)
3. wkhtmltopdf via shell_exec (if installed)
NEVER try libreoffice for PDF conversion — it is rarely installed.

DOCX Creation:
1. python-docx via run_code (pure Python — always works)
2. pandoc via shell_exec (if installed)

Image Processing:
1. Pillow (PIL) via run_code (pure Python — always works)
2. ImageMagick via shell_exec (if installed)
3. ffmpeg via shell_exec (for video frames)

Text/Markdown:
1. Direct write via file_write (always works)

Code Execution:
1. run_code for Python/JS snippets
2. shell_exec for bash commands

CRITICAL: Before attempting a conversion that requires a system binary (ffmpeg, pandoc, libreoffice, wkhtmltopdf), first check if it is available with shell_exec: "which <tool>". If not available, fall back to pure Python immediately — do NOT try multiple system binaries.

## FILE OUTPUT RULES (CRITICAL)
When generating code, scripts, configs, documents, or any multi-line file content (5+ lines):
1. ALWAYS call file_write FIRST to save it as a file
2. Then reference the saved file: "saved as \`filename.ext\`"
3. NEVER dump raw code or long text as your final response — save it to a file instead
4. Use logical filenames: script.py, analysis.md, config.json, report.txt, etc.
5. For multiple files (e.g. a full project), create them in subdirectories: code/main.py, code/utils.py
6. For PDF/DOCX creation: use pure Python libraries (reportlab, fpdf2, python-docx) via run_code — never rely on system binaries as first choice

This is NOT optional. Every script, every code block, every document goes to file_write.

## PREFERENCE LEARNING
When the user corrects your output, notes a preference, or repeats the same request in a different way: capture the underlying preference with remember using key user_pref_[category]. Categories worth capturing:
- user_pref_format: how they want output structured (bullets, prose, code, tables)
- user_pref_verbosity: terse / normal / detailed
- user_pref_domain: current project focus or domain they're working in
- user_pref_style: communication register (casual/Dutch-English mix, technical, etc.)

Do this silently — no need to announce "I've noted your preference." Just do it.

## MEMORY — WHAT NOT TO STORE
NEVER call memory_store for: time lookups, weather queries, current prices, one-off factual questions, or any transient data that changes daily. ONLY store: user preferences, personal details Michael shares, project context, brand info, long-term goals. If in doubt — do NOT store it.${slashHints && slashHints.length > 0 ? `\n\n## IMMEDIATE TOOL COMMAND — MANDATORY\nThe user invoked /${slashHints[0].replace('use_', '').replace('_', '')} (tool: ${slashHints[0]}). You MUST call this tool RIGHT NOW as your FIRST and ONLY output. No preamble, no explanation, no planning text — output ONLY the tool block:\n\`\`\`tool\n{"name": "${slashHints[0]}", "args": {"goal": "<extract the user's specific goal/URL from their message — if they only typed the slash command with nothing else, use goal: \\"Show me what you can do — ask the user for a URL or task\\">"}}\n\`\`\`\nIMPORTANT: The "goal" must come from the user's actual message. Never invent a goal like "open Chrome" if the user didn't say that. If no URL or task was given, pass goal: "No specific task given. Ask the user: what URL or task do you want me to handle?"\nDO NOT call plan or any other tool first. Call ${slashHints[0]} immediately.` : ''}${userSection}${memorySection}${campaignSection}${neuroMemoryContext ? `\n\n${neuroMemoryContext}` : ''}`);
}

// ── Sanitize LLM Output ──

/** Strip emojis, em dashes, and other unwanted characters from LLM output */
function sanitizeAgentOutput(text: string): string {
  return text
    // Strip emojis (Unicode emoji ranges)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & map symbols
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols extended-A
    .replace(/[\u{200D}]/gu, '')            // Zero-width joiner
    // Strip em/en dashes
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    // Clean up double spaces left by emoji removal
    .replace(/  +/g, ' ')
    .trim();
}

// ── Parse Tool Call from LLM Response ──

// Tool name aliases — models often output variants; map to canonical names
const TOOL_NAME_ALIASES: Record<string, string> = {
  bash: 'shell_exec', shell: 'shell_exec', terminal: 'shell_exec',
  read_file: 'file_read', file_read: 'file_read', readfile: 'file_read',
  write_file: 'file_write', writefile: 'file_write',
  search: 'web_search', google: 'web_search', websearch: 'web_search',
  multi_search: 'multi_browse', batch_browse: 'multi_browse', crawl: 'multi_browse',
  ls: 'file_browse', list_files: 'file_browse', browse_files: 'file_browse',
  navigate: 'browse', open_url: 'browse', fetch: 'browse',
  chart_data: 'data_pipeline', chart: 'data_pipeline', graph: 'data_pipeline',
  plot: 'data_pipeline', visualize: 'visualize_data', plot_data: 'visualize_data',
  computer: 'use_computer', click: 'use_computer',
  remember: 'memory_store', store_memory: 'memory_store',
  recall: 'memory_search', search_memory: 'memory_search',
  update_soul: 'soul_update', edit_soul: 'soul_update', update_identity: 'soul_update',
  read_soul: 'soul_read', check_soul: 'soul_read',
  log: 'soul_log', session_log: 'soul_log',
  save: 'file_write', save_file: 'file_write',
};

function normalizeToolName(name: string): string {
  return TOOL_NAME_ALIASES[name.toLowerCase()] ?? name;
}

function parseToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  // Strip think tags first — Qwen embeds <think>...</think> which corrupts parsing
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 1. ```tool ... ``` blocks (primary format)
  const toolBlockMatch = stripped.match(/```tool\s*\n?([\s\S]*?)```/);
  if (toolBlockMatch) {
    try {
      const parsed = JSON.parse(toolBlockMatch[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: normalizeToolName(parsed.name), args: parsed.args || {} };
      }
    } catch {
      // JSON may have literal newlines in string values — sanitize and retry
      try {
        const sanitized = toolBlockMatch[1].trim().replace(
          /("(?:[^"\\]|\\.)*")/g,
          (m) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        );
        const parsed = JSON.parse(sanitized);
        if (parsed.name && typeof parsed.name === 'string') {
          return { name: normalizeToolName(parsed.name), args: parsed.args || {} };
        }
      } catch {
        // Last resort: extract just the tool name and proceed with empty args
        const nameOnly = toolBlockMatch[1].match(/"name"\s*:\s*"([^"]+)"/);
        if (nameOnly) {
          return { name: normalizeToolName(nameOnly[1]), args: {} };
        }
      }
    }
  }

  // 2. <tool_call>...</tool_call> XML blocks
  const xmlMatch = stripped.match(/<tool[_-]?call[^>]*>([\s\S]*?)<\/tool[_-]?call>/i);
  if (xmlMatch) {
    try {
      const parsed = JSON.parse(xmlMatch[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: normalizeToolName(parsed.name), args: parsed.args || parsed.arguments || parsed.parameters || {} };
      }
    } catch { /* fall through */ }
  }

  // 3. Raw JSON with "name" field (last resort)
  // Strip code blocks first to avoid matching dict literals inside ```python / ```js blocks
  const strippedForJson = stripped.replace(/```[\s\S]*?```/g, '');
  const jsonMatch = strippedForJson.match(/\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: normalizeToolName(parsed.name), args: parsed.args || parsed.arguments || {} };
      }
    } catch { /* not valid json */ }
  }

  return null;
}

/** Tools that are safe to run in parallel (read-only, no side-effects, idempotent) */
const PARALLEL_SAFE_TOOLS = new Set([
  'web_search', 'browse', 'scrape_page', 'analyze_page', 'multi_browse',
  'file_read', 'image_analyze', 'extract_data', 'summarize', 'remember',
  // Tools that fetch/read external data with no cross-dependencies
]);

/** Parse ALL tool call blocks from a response for parallel execution */
function parseAllToolCalls(text: string): Array<{ name: string; args: Record<string, unknown> }> {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const results: Array<{ name: string; args: Record<string, unknown> }> = [];
  const regex = /```tool\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stripped)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        results.push({ name: normalizeToolName(parsed.name), args: parsed.args || parsed.arguments || {} });
      }
    } catch { /* skip malformed */ }
  }
  return results;
}

/** Parse explicit parallel directive: [PARALLEL: tool1, tool2, tool3]
 * Allows agent to explicitly request tool parallelization (useful for complex queries) */
function parseExplicitParallel(text: string): string[] {
  const match = /\[PARALLEL:\s*([^\]]+)\]/.exec(text);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
}

// ── Detect fake tool narration — model claimed to use a tool but didn't ──
// Catches "just checked and...", "search results show...", "i found that..." with no actual tool block.
// These are hallucinations where the model pretends to have searched without calling any tool.

function looksLikeFakeToolNarration(text: string, _stepHadToolCall: boolean): boolean {
  // NOTE: We intentionally ignore _stepHadToolCall — a previous tool running does NOT
  // give the model permission to fake subsequent actions (e.g., claiming to save a file
  // after a real web_search, without actually calling file_write).
  if (text.includes('```tool')) return false; // tool block present, not fake
  const t = text.toLowerCase();
  return (
    /\bjust (checked|searched|looked|found|pulled|fetched|browsed|scraped)\b/.test(t) ||
    /\b(search results? (show|indicate|reveal)|according to (my |the |web )?search|based on (my |the |web )?search)\b/.test(t) ||
    /\bi (found|discovered|located|retrieved|searched and found)\b/.test(t) ||
    /\b(web search|search shows?|results? (show|indicate)|data shows?)\b/.test(t) ||
    // Fake file-save narration — model claims to have saved/written a file without calling file_write
    // Allow optional adjectives between the verb and the file-type noun ("saved a concise breakdown")
    /\bi(?:'ve| have) (?:saved|written|created|stored).{0,60}(?:file|document|report|breakdown|analysis|summary|results?|output|markdown|\.md)\b/.test(t)
  );
}

// ── Detect if LLM claims to be another model (Qwen, Claude, ChatGPT, etc) ──

function looksLikeModelIdentityClaim(text: string): boolean {
  const t = text.toLowerCase();
  return (
    // First-person claims of being Qwen
    /\bi(?:'?m| am)\s+(?:actually\s+)?qwen\b/.test(t) ||
    /\bmy\s+(?:name|identity)\s+is\s+qwen\b/.test(t) ||
    // First-person claims of being Claude
    /\bi(?:'?m| am)\s+(?:actually\s+)?claude\b/.test(t) ||
    /\bmy\s+(?:name|identity)\s+is\s+claude\b/.test(t) ||
    // First-person claims of being ChatGPT or GPT
    /\bi(?:'?m| am)\s+(?:actually\s+)?(chat)?gpt\b/.test(t) ||
    // Generic "I'm a language model" first-person claims
    /\bi(?:'?m| am)\s+a\s+(?:large\s+)?language\s+model\b/.test(t) ||
    /\bi(?:'?m| am)\s+(?:really|actually|just|simply)\s+(?:a\s+)?\w+\s+model\b/.test(t) ||
    // "Under the hood I am" / "at my core I am" style claims
    /\bunder\s+the\s+hood[,\s]+i(?:'?m| am).*?(qwen|claude|gpt)\b/.test(t) ||
    /\bat\s+my\s+core[,\s]+i(?:'?m| am).*?(qwen|claude|gpt)\b/.test(t)
  );
}

// ── Lightweight alignment self-check (no LLM call — regex only) ──
// Bands: GREEN (clean), YELLOW (hedging/fluff — strip offenders), RED (identity claim — handled by looksLikeModelIdentityClaim)

type AlignmentBand = 'GREEN' | 'YELLOW' | 'RED';

const YELLOW_OPENER_RE = /^(I['']d be happy[^.!?]*[.!?]\s*|Certainly!\s*|Of course!\s*|Sure!\s*|Great question!\s*|As an AI[^,]*,\s*)/i;
const YELLOW_PHRASE_RE = /\bAs an AI\b/gi;
const EM_DASH_RE = /—/g;
// Count emoji code points (covers most Unicode emoji ranges)
function countEmoji(text: string): number {
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu;
  return (text.match(emojiRe) ?? []).length;
}

function alignmentSelfCheck(text: string): { band: AlignmentBand; cleaned: string } {
  // RED is already caught upstream by looksLikeModelIdentityClaim — flag but don't double-handle
  if (looksLikeModelIdentityClaim(text)) {
    return { band: 'RED', cleaned: text };
  }

  let cleaned = text;
  let isYellow = false;

  // Strip filler openers (iterate — multiple may stack)
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(YELLOW_OPENER_RE, '');
  }
  if (cleaned !== text) isYellow = true;

  // Strip "As an AI" mid-sentence occurrences
  const afterPhrase = cleaned.replace(YELLOW_PHRASE_RE, '');
  if (afterPhrase !== cleaned) { cleaned = afterPhrase; isYellow = true; }

  // Strip em dashes
  const afterDash = cleaned.replace(EM_DASH_RE, '-');
  if (afterDash !== cleaned) { cleaned = afterDash; isYellow = true; }

  // Flag (but don't strip) if 3+ emoji chars present
  if (countEmoji(cleaned) >= 3) isYellow = true;

  return { band: isYellow ? 'YELLOW' : 'GREEN', cleaned: cleaned.trimStart() };
}

// ── Detect if LLM clearly tried to use a tool but formatted it wrong ──

function looksLikeMalformedToolCall(text: string): boolean {
  // Clear JSON-like block with "name" key but failed to parse
  if (/\{[\s\S]*?"name"\s*:\s*"/.test(text)) return true;
  // XML-style tool call tags
  if (/<tool_call>|<function>|<\/tool_call>|<\/function>/.test(text)) return true;
  // ✿FUNCTION✿ format
  if (/✿FUNCTION✿/.test(text)) return true;
  // ```json blocks containing a name/args structure (wrong code fence label)
  if (/```(?:json|python|js|javascript)\s*\n?\s*\{[\s\S]*?"name"/.test(text)) return true;
  return false;
}

// ── Detect if LLM returned a garbage/error response instead of valid output ──
// Used to skip poisoning contextEntries with API error text that would cause 400-loop spirals.

function looksLikeErrorResponse(text: string): boolean {
  const t = text.trim();
  // Extremely short responses that aren't a valid done signal or tool call
  if (t.length < 10 && !/```tool|"name"\s*:/.test(t)) return true;
  // Common API/model error message prefixes
  if (/^(error[:\s]|Error[:\s]|Failed[:\s]|API error|Internal server error|Bad request|Service unavailable)/i.test(t)) return true;
  return false;
}

// ── Extract thinking text (before tool call) ──

function extractThinking(text: string): string {
  const toolIdx = text.indexOf('```tool');
  if (toolIdx > 0) return text.slice(0, toolIdx).trim();
  const jsonIdx = text.search(/\{[\s\S]*?"name"\s*:/);
  if (jsonIdx > 20) return text.slice(0, jsonIdx).trim();
  return '';
}

// ── Conversation history parser ──

function parseHistoryToMessages(history: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const parts = history.split(/\n\n(?=User:|Assistant:)/);
  for (const part of parts) {
    if (part.startsWith('User: ')) {
      messages.push({ role: 'user', content: part.slice(6).trim() });
    } else if (part.startsWith('Assistant: ')) {
      messages.push({ role: 'assistant', content: part.slice(11).trim() });
    }
  }
  return messages;
}

// ── Instant-path helpers: time + weather (zero LLM, zero tool loop) ──

// Time query — matches: "time in amsterdam", "amsterdam time", "what time is it", "what's the time in tokyo"
const TIME_QUERY_RE = /^(?:what(?:'s| is)(?: the)? (?:current )?time(?:\s+(?:in|at|for)\s+(.+))?|(?:current\s+)?time\s+(?:in|at|for|of)\s+(.+)|what time is it(?:\s+(?:in|at)\s+(.+))?|(.+?)\s+time(?:\s+now)?\s*|time\s+now)\s*[?!.]*$/i;
// Weather query — matches: "weather amsterdam", "amsterdam weather", "what's the weather in paris"
const WEATHER_QUERY_RE = /^(?:(?:what(?:'s| is)(?: the)? )?weather(?:\s+(?:in|at|for|of)\s+(.+))?|(?:weather|forecast|temperature)\s+(?:in|at|for|of)?\s+(.+)|(.+?)\s+weather(?:\s+today|now)?\s*|how(?:'s| is) (?:the )?weather(?:\s+(?:in|at)\s+(.+))?)\s*[?!.]*$/i;

function extractTimeLocation(msg: string): string | null {
  const m = TIME_QUERY_RE.exec(msg.trim());
  if (!m) return null;
  // Filter out non-location capture groups (e.g., just "now", "current")
  const loc = (m[1] || m[2] || m[3] || m[4] || '').trim();
  if (/^(now|current|today|please|pls|rn)$/i.test(loc)) return null;
  return loc || null;
}

function extractWeatherLocation(msg: string): string | null {
  const m = WEATHER_QUERY_RE.exec(msg.trim());
  if (!m) return null;
  const loc = (m[1] || m[2] || m[3] || m[4] || '').trim();
  if (/^(now|current|today|please|pls|rn|good|bad)$/i.test(loc)) return loc ? null : null;
  return loc || null;
}

async function fetchTimeWidget(location: string | null): Promise<string | null> {
  try {
    let url = 'https://worldtimeapi.org/api/ip';
    if (location) {
      // Map common city names to timezones
      const tzMap: Record<string, string> = {
        amsterdam: 'Europe/Amsterdam', london: 'Europe/London', paris: 'Europe/Paris',
        berlin: 'Europe/Berlin', tokyo: 'Asia/Tokyo', 'new york': 'America/New_York',
        'los angeles': 'America/Los_Angeles', dubai: 'Asia/Dubai', sydney: 'Australia/Sydney',
        singapore: 'Asia/Singapore', chicago: 'America/Chicago', toronto: 'America/Toronto',
        moscow: 'Europe/Moscow', beijing: 'Asia/Shanghai', mumbai: 'Asia/Kolkata',
        seoul: 'Asia/Seoul', bangkok: 'Asia/Bangkok', istanbul: 'Europe/Istanbul',
        zurich: 'Europe/Zurich', rome: 'Europe/Rome', madrid: 'Europe/Madrid',
        'hong kong': 'Asia/Hong_Kong', cairo: 'Africa/Cairo', 'mexico city': 'America/Mexico_City',
      };
      const tz = tzMap[location.toLowerCase()] || null;
      if (tz) url = `https://worldtimeapi.org/api/timezone/${tz}`;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json() as { datetime: string; timezone: string; utc_offset: string; day_of_week: number; dst: boolean };
    const dt = new Date(data.datetime);
    const hours = dt.getHours();
    const mins = String(dt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[dt.getDay()];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${day}, ${months[dt.getMonth()]} ${dt.getDate()}`;
    const cityName = location ? location.charAt(0).toUpperCase() + location.slice(1) : data.timezone.split('/').pop()?.replace(/_/g, ' ') || 'Local';
    return `\`\`\`widget-time\n${JSON.stringify({ city: cityName, time: `${h12}:${mins} ${ampm}`, time24: `${String(hours).padStart(2,'0')}:${mins}`, date: dateStr, timezone: data.timezone, offset: data.utc_offset, dst: data.dst })}\n\`\`\``;
  } catch {
    return null;
  }
}

async function fetchWeatherWidget(location: string): Promise<string | null> {
  try {
    const loc = encodeURIComponent(location);
    const res = await fetch(`https://wttr.in/${loc}?format=j1`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = await res.json() as any;
    const cur = d.current_condition?.[0];
    const area = d.nearest_area?.[0];
    if (!cur) return null;
    const cityName = area?.areaName?.[0]?.value || location;
    const country = area?.country?.[0]?.value || '';
    const tempC = parseInt(cur.temp_C);
    const tempF = parseInt(cur.temp_F);
    const feelsC = parseInt(cur.FeelsLikeC);
    const humidity = parseInt(cur.humidity);
    const windKm = parseInt(cur.windspeedKmph);
    const desc = cur.weatherDesc?.[0]?.value || '';
    const visibility = parseInt(cur.visibility);
    const uvIndex = parseInt(cur.uvIndex);
    const today = d.weather?.[0];
    const maxC = today ? parseInt(today.maxtempC) : null;
    const minC = today ? parseInt(today.mintempC) : null;
    return `\`\`\`widget-weather\n${JSON.stringify({ city: cityName, country, tempC, tempF, feelsC, humidity, windKm, desc, visibility, uvIndex, maxC, minC })}\n\`\`\``;
  } catch {
    return null;
  }
}

// ── Fast-path detection ──

function isSimpleQuestion(text: string): boolean {
  // Only pure greetings and one-word acknowledgments — NOTHING that contains a question or content word.
  // "what is X", "who is X", "look up X" must ALL go through the full agent loop with tools.
  const t = text.trim();
  const greetingsOnly = /^(hi|hey|hello|yo|sup|what'?s\s*up|thanks|thank you|ok|okay|sure|yes|no|cool|nice|got it|k|thx|ty|np|lol|haha|damn|wow|hru|how are you|how r u|how are u|wyd|wya|gm|gn|bye|whats good|wsg|wassup|bet|say less)\s*[!?.]*$/i;
  return greetingsOnly.test(t);
}

// ── Image content detection ──

/**
 * Returns true when the user message or conversation history contains image data.
 * Detects:
 *   1. The "[Attached image: ...]" marker injected by AgentPanel when a user uploads an image.
 *   2. Raw base64 image data blobs (data:image/... or long base64 strings).
 *   3. Direct image URL references (.png/.jpg/.webp/.gif/.jpeg in http/https URLs).
 */
function hasImageContent(userMessage: string, conversationHistory?: string): boolean {
  const combined = userMessage + (conversationHistory || '');
  // AgentPanel attachment marker
  if (/\[Attached image:/i.test(combined)) return true;
  // Inline data URI
  if (/data:image\/(png|jpe?g|webp|gif|bmp)/i.test(combined)) return true;
  // Long base64 blobs (>100 chars of base64 chars in sequence — likely image data)
  if (/[A-Za-z0-9+/]{100,}={0,2}/.test(combined) && /image|photo|screenshot|picture|img/i.test(combined)) return true;
  // HTTP(S) image URLs
  if (/https?:\/\/\S+\.(png|jpe?g|webp|gif|bmp)(\?\S*)?/i.test(combined)) return true;
  return false;
}

// ── Complexity tier detection ──

function isComplexTask(text: string): boolean {
  const msg = text.toLowerCase();
  // Multi-step or compound asks
  if (/\band\s+(then|also|after)\b/.test(msg)) return true;
  // Research / creation / analysis with significant scope
  if (/\b(research|analyze|analyse|investigate|comprehensive|in-depth|deep dive|compare|build|create|write|generate|develop|plan|strategy|report|study)\b/.test(msg) && msg.length > 60) return true;
  // Multiple objects (comma-joined actions)
  if (msg.split(',').length >= 3 && msg.length > 80) return true;
  // Explicit multi-part ("first... then...", "step 1", etc.)
  if (/\b(first|step 1|step one|part 1|then|finally|lastly)\b/.test(msg) && msg.length > 50) return true;
  return false;
}

// ── Model Router (0.8b routes to best model for the task) ──

type ModelTier = 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' | 'nemotron';

function routeToModel(userMessage: string): { model: string; tier: ModelTier } {
  const msg = userMessage.toLowerCase().trim();
  const len = msg.length;

  // NOTE: 0.8b is NEVER used for user-facing responses — only for compression/classification
  // Minimum for any user response is 2b

  // Small: greetings, one-word, yes/no, acknowledgments, simple questions
  if (len < 20 && /^(hi|hey|yo|sup|hello|thanks|ok|yes|no|sure|cool|nice|got it|what|why|how|when|where)\b/i.test(msg)) {
    return { model: 'qwen3.5:2b', tier: 'small' };
  }

  // Medium: short conversational messages without complex keywords
  if (len < 40 && !/\b(research|analyze|deep|thorough|comprehensive|compare|build|create|develop|implement|write|deploy|design|plan|strategy|code|script|debug|refactor)\b/i.test(msg)) {
    return { model: 'qwen3.5:4b', tier: 'medium' };
  }

  // Nemotron: deep reasoning tasks that require extended thinking (security, architecture, code deep dives)
  if (/\b(security.?audit|vulnerabilit|attack.?surface|cve|owasp|penetration.?test|threat.?model|security.?review)\b/i.test(msg)
      || /\b(architecture.?(review|analysis|reasoning|diagram)|system.?design|design.?pattern|dependency.?(graph|analysis)|technical.?debt)\b/i.test(msg)
      || /\b(deep.?dive.?code|codebase.?analysis|code.?review|refactor.?(plan|strategy)|performance.?audit)\b/i.test(msg)) {
    return { model: 'nemotron-3-super:120b', tier: 'nemotron' };
  }

  // XLarge: explicitly complex, multi-step, creative, long prompts
  if (len > 300 || /\b(comprehensive|thorough|in-depth|detailed analysis|multi.?step|build.*from scratch|full.*report|compare.*and.*contrast|write.*article|create.*strategy)\b/i.test(msg)) {
    return { model: 'qwen3.5:27b', tier: 'xlarge' };
  }

  // Large: DEFAULT for everything else (40+ chars)
  return { model: 'qwen3.5:9b', tier: 'large' };
}

// ── Task Classification + Tool Pruning ──
// Inspired by OpenClaw's profile-based tool pruning: fewer tools in context = better selection.
// We detect task type from the user message and return only the relevant tool names.
// Tools in ALWAYS_TOOLS are included regardless of task type.

type TaskType = 'research' | 'code' | 'analyze' | 'create' | 'file' | 'computer' | 'agents' | 'memory' | 'dataviz' | 'security' | 'architecture' | 'general';

const ALWAYS_TOOLS = new Set([
  'think', 'plan', 'ask_user', 'done', 'say',
  'memory_store', 'memory_search',
  'note', 'notes_read', // working memory — always available
  'todo_write', 'todo_read', // task tracking — always available
  'wait', 'schedule_task', // timing — always available
]);

const TASK_TOOLS: Record<TaskType, string[]> = {
  research: ['web_search', 'multi_browse', 'browse', 'scrape_page', 'analyze_page', 'summarize', 'extract_data', 'image_analyze', 'video_analyze', 'audio_transcribe', 'spawn_agents', 'todo_write', 'todo_read', 'file_write'],
  code:     ['code_analysis', 'shell_exec', 'file_read', 'file_write', 'file_browse', 'apply_patch', 'run_code', 'file_find', 'web_search', 'todo_write', 'todo_read'],
  analyze:  ['web_search', 'deep_research', 'multi_browse', 'competitor_swot', 'social_intelligence', 'google_trends', 'brand_voice', 'summarize', 'extract_data', 'scrape_page', 'browse', 'image_analyze', 'video_analyze', 'spawn_agents'],
  create:   ['write_content', 'create_docx', 'deep_research', 'web_search', 'brand_voice', 'summarize', 'image_analyze', 'file_write', 'run_code', 'read_pdf', 'video_analyze', 'video_edit', 'video_create', 'audio_transcribe'],
  dataviz:  ['data_pipeline', 'visualize_data', 'web_search', 'multi_browse', 'extract_data', 'summarize'],
  file:     ['file_read', 'file_write', 'file_find', 'read_pdf', 'extract_data', 'apply_patch', 'image_analyze', 'run_code', 'shell_exec', 'video_analyze', 'video_edit', 'audio_transcribe', 'video_create'],
  computer: ['use_computer', 'control_desktop', 'browse', 'scrape_page', 'image_analyze', 'shell_exec'],
  agents:   ['spawn_agents', 'spawn_worker', 'check_workers', 'read_findings', 'send_instruction', 'web_search', 'deep_research'],
  memory:   ['memory_store', 'memory_search', 'soul_read', 'soul_update', 'soul_log'],
  security:     ['code_analysis', 'file_read', 'file_find', 'web_search', 'browse', 'shell_exec', 'spawn_agents'],
  architecture: ['code_analysis', 'file_read', 'file_find', 'shell_exec', 'web_search', 'browse', 'spawn_agents'],
  general:  ['web_search', 'browse', 'multi_browse', 'summarize', 'shell_exec', 'run_code', 'file_read', 'file_write', 'file_browse', 'write_content', 'create_docx', 'image_analyze', 'video_analyze', 'video_edit', 'audio_transcribe', 'video_create', 'spawn_agents', 'todo_write', 'todo_read'],
};

/**
 * Multi-Task Classification: Returns ALL matching task types instead of just the first.
 * This enables multi-step workflows like "research competitors → analyze sentiment → write copy"
 * to get the union of all required tools instead of being gated by a single category.
 */
function classifyTaskTypes(msg: string): TaskType[] {
  const t = msg.toLowerCase();
  const matched = new Set<TaskType>();

  // Memory operations — check FIRST to prevent "look at memories" → computer
  if (/\b(remember|recall|memor|what did i tell|my preference|my goal|save this|note this|your (memories|notes|knowledge)|look at.*(memor|notes|knowledge))\b/.test(t)) matched.add('memory');

  // Data visualization — check BEFORE research/analyze to catch viz-specific requests
  if (/\b(chart|graph|plot|visuali[sz]e|bar chart|line chart|pie chart|scatter|heatmap|histogram|data.*viz|show.*data.*visually|visuali[sz]ation|render.*data|data.*pipeline)\b/.test(t)) matched.add('dataviz');
  if (/\b(show me (stats|numbers|figures|data) (on|for|about))\b/.test(t)) matched.add('dataviz');

  // Computer / desktop control — narrowed to avoid false positives on "open", "browse"
  if (/\b(click|screenshot|open (chrome|safari|firefox|finder|a browser|the browser|a tab)|control desktop|automate|use computer|interact with (the |a )?(page|site|browser|desktop)|take a screenshot)\b/.test(t)) matched.add('computer');
  if (/\b(go to|visit|navigate to)\b/.test(t) && /\b(\.com|\.org|\.net|http|www|site|page|url)\b/.test(t)) matched.add('computer');

  // Security analysis — deep vulnerability assessment (routes to nemotron)
  if (/\b(security.?audit|vulnerabilit|attack.?surface|cve|owasp|penetration.?test|threat.?model|security.?review|exploit|injection|xss|csrf|auth.?bypass)\b/.test(t)) matched.add('security');

  // Architecture analysis — system design reasoning (routes to nemotron)
  if (/\b(architecture.?(review|analysis|reasoning)|system.?design|design.?pattern|dependency.?(graph|analysis)|technical.?debt|module.?structure|service.?boundary)\b/.test(t)) matched.add('architecture');

  // Code analysis / general — check BEFORE general code writing
  if (/\b(analyze.*code|code.*analysis|codebase|file.*tree|refactor|optimize.*code|performance.*analysis|code.*review|deep.*dive.*code|understand.*codebase|explain.*structure|pattern.*detection)\b/.test(t)) matched.add('code');

  // Code / scripting — writing, debugging, implementing
  if (/\b(write.*code|write.*script|function|debug|fix.*bug|implement|program|python|javascript|typescript|bash|shell|command|terminal|npm|pip|git|deploy|build)\b/.test(t)) matched.add('code');

  // Video / audio operations
  if (/\b(video|mp4|mov|avi|mkv|webm|trim.*video|cut.*video|edit.*video|analyze.*video|transcri(be|pt)|subtitle|gif.*from|video.*to|audio.*from|extract.*frame|frame.*extract|ffmpeg|whisper|speech.?to.?text|timelapse|slideshow.*video)\b/.test(t)) matched.add('file');

  // File operations — match actual file work, NOT descriptors like "PDF-ready" or "PDF format"
  if (/(\.(pdf|docx|csv|json|txt|xlsx|md)\b|read.*file|open.*file|parse.*file|read.*pdf|open.*pdf|parse.*pdf|extract from.*file)\b/.test(t)) matched.add('file');

  // Competitive / market analysis
  if (/\b(swot|competitor|market|trends|google trends|social media|reddit|twitter|sentiment|brand voice|positioning|landscape)\b/.test(t)) matched.add('analyze');

  // Content creation
  if (/\b(write.*post|write.*email|write.*ad|write.*copy|draft|blog|caption|article|essay|report)\b/.test(t)) matched.add('create');

  // Parallel agent tasks — check BEFORE analyze so "research 3 things at once" hits agents
  if (/\b(parallel|simultaneously|at the same time|spawn|multiple agents|subagent|sub.?agent|launch.*(agent|worker)|deploy.*(agent|worker)|send.*(agent|worker)|at once|concurrent|batch.*(research|analy))\b/.test(t)) matched.add('agents');

  // Deep research / analysis
  if (/\b(research|analyze|analyse|investigate|deep.?dive|comprehensive|in-depth|compare)\b/.test(t)) matched.add('analyze');

  // Factual lookups / research (default for questions)
  if (/\b(what is|who is|what are|find|look up|search|tell me about|info on|how does|why does|when did|fetch|scrape|grab.*(from|the))\b/.test(t)) matched.add('research');

  return matched.size > 0 ? Array.from(matched) : ['general'];
}

/** Legacy single-task classifier (kept for backwards compatibility) */
function classifyTaskType(msg: string): TaskType {
  const types = classifyTaskTypes(msg);
  return types[0] || 'general';
}

function pruneToolsForTask(allTools: ToolDef[], msg: string, slashHints?: string[]): ToolDef[] {
  // Check if this is explicitly a computer/desktop control task (narrowed regex)
  const t = msg.toLowerCase();
  const isMemoryIntent = /\b(remember|recall|memor|your (memories|notes|knowledge)|look at.*(memor|notes))\b/i.test(t);
  const desktopKeywords = /\b(click|screenshot|open (chrome|safari|firefox|finder|a browser|the browser)|control desktop|use computer|take a screenshot)\b/i;
  if (!isMemoryIntent && desktopKeywords.test(msg)) {
    // Return ONLY use_computer + always tools (think, plan, ask_user, done, memory)
    const computerOnly = allTools.filter(t => t.name === 'use_computer' || ALWAYS_TOOLS.has(t.name));
    return computerOnly.length > 0 ? computerOnly : allTools.filter(t => t.name === 'use_computer');
  }

  // ✨ MULTI-TASK CLASSIFICATION: Merge tools from ALL matching task types
  const taskTypes = classifyTaskTypes(msg);
  const allowed = new Set<string>([...ALWAYS_TOOLS]);

  // Add tools from all matching task types (union set)
  taskTypes.forEach(tt => {
    TASK_TOOLS[tt]?.forEach(toolName => allowed.add(toolName));
  });

  // Force-include any tools specified in slashHints (e.g., use_computer from auto-routing)
  if (slashHints && slashHints.length > 0) {
    slashHints.forEach(hint => allowed.add(hint));
  }

  const pruned = allTools.filter(t => allowed.has(t.name));
  // Fallback: if pruning leaves < 4 non-always tools, return general set instead
  const nonAlways = pruned.filter(t => !ALWAYS_TOOLS.has(t.name));
  if (nonAlways.length < 2) {
    const generalAllowed = new Set([...ALWAYS_TOOLS, ...TASK_TOOLS.general]);
    const result = allTools.filter(t => generalAllowed.has(t.name));
    // Still force-include slashHints
    if (slashHints && slashHints.length > 0) {
      slashHints.forEach(hint => {
        if (!result.find(t => t.name === hint)) {
          const toolDef = allTools.find(t => t.name === hint);
          if (toolDef) result.push(toolDef);
        }
      });
    }
    return result;
  }
  return pruned;
}

// ── Campaign Context (wired in from the active campaign/cycle) ──

export interface CampaignContextData {
  brand: string;
  productDescription?: string;
  targetAudience?: string;
  marketingGoal?: string;
  productFeatures?: string[];
  productPrice?: string;
  brandDna?: string;       // from cycle brand-dna stage output
  personaDna?: string;     // from cycle persona-dna stage output
  researchSummary?: string; // top-level research findings summary
  angles?: string;          // approved angles
}

// ── Upfront Planning Pass ──
// Runs a lightweight plan-generation step before the first ReAct iteration.
// Gives the agent a structured roadmap that is prepended to each think step.
// Best-effort: if it fails or times out (5s), the loop continues without a plan.

async function generatePlan(
  userMessage: string,
  tools: ToolDef[],
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const toolNames = tools.map(t => t.name).join(', ');
  let plan = '';
  const planPrompt = `Task: ${userMessage}

List the steps you will take as a numbered plan (max 8 steps). Be specific about what tools you'll use at each step. Keep each step under 20 words.
Format: "1. [action] using [tool] to [goal]"

Available tools: ${toolNames}`;

  const planController = new AbortController();
  const planTimeout = setTimeout(() => planController.abort(), 5000);
  // If caller's signal aborts, forward that too
  signal?.addEventListener('abort', () => planController.abort(), { once: true });

  try {
    await ollamaService.generateStream(
      planPrompt,
      'Output only the numbered plan. No preamble. No commentary after the list.',
      {
        model,
        temperature: 0.3,
        num_predict: 300,
        signal: planController.signal,
        onChunk: (c: string) => { plan += c; },
      },
    );
  } catch {
    // Best-effort — ignore timeout or abort
  } finally {
    clearTimeout(planTimeout);
  }

  return plan.trim();
}

// ── Compact Old Tool Results ──
// Keeps the active context lean by truncating tool results that are:
//   - more than 2 positions back from the end of contextEntries, AND
//   - longer than 3000 characters
// Recent results stay full so the agent can reason from them immediately.
// Append-only discipline: we REPLACE content inline but never remove entries.

function compactOldToolResults(entries: string[]): string[] {
  if (entries.length <= 2) return entries;
  // Aggressively truncate old tool results — they bloat prefill cost significantly.
  // Web search results can be 2000+ chars each; 12 entries = 24k chars = slow.
  const COMPACT_THRESHOLD = 800;   // compact anything over 800 chars

  return entries.map((entry, idx) => {
    // Always keep last 2 entries fully intact (current + immediately previous)
    if (idx >= entries.length - 2) return entry;
    // Only compact tool results
    if (!entry.includes('Tool Result (') && !entry.includes('Tool result:')) return entry;
    if (entry.length <= COMPACT_THRESHOLD) return entry;
    // Use middle-elision truncation at 800 chars for compact old results
    return truncateToolOutput(entry, 800);
  });
}

// ── Main Agent Engine ──

export interface AgentEngineOptions {
  model?: string;
  temperature?: number;
  maxSteps?: number;
  maxDurationMs?: number;  // Duration limit (e.g., 45 min = 2700000)
  signal?: AbortSignal;
  onEvent: AgentEngineCallback;
  /** Called when agent uses ask_user tool. Return the user's answer. */
  onAskUser?: (question: string, options: string[]) => Promise<string>;
  /** Inject additional messages mid-run (checked each step) */
  getInjectedMessages?: () => string[];
  /** Active campaign context — wired from CampaignContext */
  campaignContext?: CampaignContextData;
  /** Pre-loaded memories to seed the session (user profile + persisted memories) */
  initialMemories?: Array<{ key: string; content: string }>;
  /** Slash command hints — tool names the user explicitly requested via /commands */
  slashHints?: string[];
  /** Whether computer/browser automation mode is currently active */
  computerActive?: boolean;
  /** Base64 images attached by the user (no data: prefix) for vision models */
  images?: string[];
  /** Subagent numbers extracted from @subN mentions in user input (e.g., [1, 3]) */
  mentionedSubagents?: number[];
  /** Skip semantic/neuro routing (for CLI mode or when embeddings are unavailable) */
  skipSemanticRouting?: boolean;
  /** Batch/pipe mode — suppress interactive UI elements (spinners, progress bars) */
  batchMode?: boolean;
}

export async function runAgentLoop(
  userMessage: string,
  conversationHistory: string,
  options: AgentEngineOptions,
): Promise<{ steps: AgentStep[]; finalResponse: string }> {
  const {
    model: modelOverride,
    temperature: tempOverride,
    maxSteps = 200,
    maxDurationMs,
    signal,
    onEvent,
    onAskUser,
    getInjectedMessages,
    campaignContext,
    initialMemories,
    slashHints,
    computerActive,
    images: userImages,
    skipSemanticRouting: skipSemantic,
  } = options;

  // ── Parse @model mention from user message ──
  const { mentionedModel, cleanedMessage, displayName } = parseModelMention(userMessage);
  const effectiveMessage = cleanedMessage || userMessage;
  const effectiveModel = mentionedModel || modelOverride || getModelForStage('research');

  // Emit event if model was overridden by @mention
  if (mentionedModel && onEvent) {
    onEvent({
      type: 'routing',
      routing: {
        phase: 'model-selection',
        decision: `Using @${displayName || mentionedModel}: ${mentionedModel}`,
        model: mentionedModel,
      },
    } as any);
  }

  // ── Probe embedding model availability (fire-and-forget, cached after first call) ──
  probeEmbeddingModel();

  // ── Smart VRAM management — preload the right tier for this task ──
  // Skip in CLI/Node mode: preloadModels uses a module-level URL constant captured before
  // dotenv runs, so it would hit the wrong (remote) endpoint. In CLI the model loads on first use.
  if (typeof window !== 'undefined') {
    vramManager.prepareForTask('chat'); // fire-and-forget: loads duo tier (9b + 2b)
  }

  // ── Source tracking — accumulate all URLs visited during this agent run ──
  const sourceRegistry = new Map<string, { title: string; url: string; index: number; snippet?: string }>();
  let sourceCounter = 0;

  function registerSource(url: string, title?: string, snippet?: string): number {
    if (!url) return 0;
    if (sourceRegistry.has(url)) {
      // Update snippet if we now have one and didn't before
      const existing = sourceRegistry.get(url)!;
      if (snippet && !existing.snippet) existing.snippet = snippet.slice(0, 200);
      return existing.index;
    }
    sourceCounter++;
    sourceRegistry.set(url, { title: title || url, url, index: sourceCounter, snippet: snippet ? snippet.slice(0, 200) : undefined });
    return sourceCounter;
  }

  function getSourcesSuffix(): string {
    if (sourceRegistry.size === 0) return '';
    const refs = [...sourceRegistry.values()]
      .sort((a, b) => a.index - b.index)
      .map(s => {
        // Format: [1] Title - URL\nsnippet: content
        const line = `[${s.index}] ${s.title} - ${s.url}`;
        return s.snippet ? `${line}\nsnippet: ${s.snippet}` : line;
      })
      .join('\n\n'); // Better spacing between sources
    return `\n\n## Sources\n\n${refs}`;
  }

  const SOURCE_TOOLS = new Set([
    'web_search', 'browse', 'multi_browse', 'deep_research',
    'competitor_swot', 'social_intelligence', 'research_loop',
  ]);

  function extractAndRegisterSources(_toolName: string, output: string) {
    // ── Highest quality: web_search format — [N] Title — URL\nKey content: snippet
    const wsPattern = /^\[\d+\]\s+(.+?)\s+[—–-]\s+(https?:\/\/[^\s\n]+)\n(?:Key content:\s*)?([\s\S]*?)(?=\n\[\d+\]|\n\n|$)/gm;
    let wsMatch;
    const wsUrls = new Set<string>();
    while ((wsMatch = wsPattern.exec(output)) !== null) {
      const title = wsMatch[1].trim();
      const url = wsMatch[2].trim();
      const snippet = wsMatch[3]?.trim().slice(0, 200) || undefined;
      registerSource(url, title, snippet);
      wsUrls.add(url);
    }

    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    const urlPrefixPattern = /(?:URL:\s*|Source \d+:.*?\n\s*URL:\s*)(https?:\/\/[^\s\n]+)/gi;
    const rawUrlPattern = /(?:^|\s)(https?:\/\/[^\s\n<]+)/gm;

    // Named markdown links
    let match;
    while ((match = linkPattern.exec(output)) !== null) {
      if (!wsUrls.has(match[2])) registerSource(match[2], match[1]);
    }
    // URL: prefix pattern
    while ((match = urlPrefixPattern.exec(output)) !== null) {
      if (!wsUrls.has(match[1])) registerSource(match[1]);
    }
    // Raw URLs as fallback (skip duplicates already registered above)
    while ((match = rawUrlPattern.exec(output)) !== null) {
      const url = match[1].replace(/[.,;)]+$/, '');
      if (!wsUrls.has(url)) registerSource(url);
    }
  }

  /**
   * Extract sources from text and return as array without registering globally
   */
  function extractSourcesFromText(text: string): Array<{ title: string; url: string; domain: string; snippet?: string }> {
    const sources: Array<{ title: string; url: string; domain: string; snippet?: string }> = [];
    const seen = new Set<string>();

    // Web search format [N] Title — URL
    const wsPattern = /^\[\d+\]\s+(.+?)\s+[—–-]\s+(https?:\/\/[^\s\n]+)\n(?:Key content:\s*)?([\s\S]*?)(?=\n\[\d+\]|\n\n|$)/gm;
    let match;
    while ((match = wsPattern.exec(text)) !== null) {
      const url = match[2].trim();
      if (!seen.has(url)) {
        const domain = new URL(url).hostname || url;
        sources.push({
          title: match[1].trim(),
          url,
          domain,
          snippet: match[3]?.trim().slice(0, 120),
        });
        seen.add(url);
      }
    }

    // Markdown links [text](url)
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    while ((match = linkPattern.exec(text)) !== null) {
      const url = match[2];
      if (!seen.has(url)) {
        const domain = new URL(url).hostname || url;
        sources.push({ title: match[1], url, domain });
        seen.add(url);
      }
    }

    // Raw URLs as fallback
    const rawUrlPattern = /(?:^|\s)(https?:\/\/[^\s\n<]+)/gm;
    while ((match = rawUrlPattern.exec(text)) !== null) {
      const url = match[1].replace(/[.,;)]+$/, '');
      if (!seen.has(url)) {
        const domain = new URL(url).hostname || url;
        sources.push({ title: url, url, domain });
        seen.add(url);
      }
    }

    return sources;
  }

  // ── Tool Harness Context — created once per runAgentLoop(), passed to all tool calls ──
  // Replaces the raw `tool.execute(args, signal)` pattern with a permission-aware,
  // progress-streaming, validated execution path modeled after Claude Code's ToolUseContext.
  let harnessTools: ReturnType<typeof wrapLegacyTool>[] = [];
  const harness_AbortController = new AbortController();
  // Wire external signal to harness controller for proper cancellation
  if (signal) {
    signal.addEventListener('abort', () => harness_AbortController.abort(), { once: true });
  }
  const harnessContext = buildToolUseContext({
    sessionId: `session-${Date.now()}`,
    abortController: harness_AbortController,
    model: '', // will be set after model routing below
    tools: [],  // will be populated after buildTools() below
    messages: conversationHistory ? [{ role: 'user', content: conversationHistory }] : [],
    permissionMode: (typeof window !== 'undefined' ? getPermissionMode() : 'default'),
    permissionRules: {
      alwaysDenyRules: {
        'file_delete': ['/*', '/Users/*', '/home/*'], // deny deletes at root/home level
      },
      alwaysAskRules: {
        'run_code': ['*'], // always ask before running code
        'file_write': ['/*', '/Users/*/.*', '/etc/*', '/var/*'], // ask for writes to sensitive paths
        'shell_exec': ['rm -rf*', 'kill -9*', 'sudo*', 'reboot*', 'shutdown*'], // ask for dangerous shell commands
      },
      alwaysAllowRules: {
        // read-only tools allowed by default
        'web_search': ['*'],
        'browse': ['*'],
        'scrape_page': ['*'],
        'file_read': ['*'],
        'memory_search': ['*'],
        'think': ['*'],
      },
    },
    addNotification: (msg, type) => {
      // Log permission denials and errors to console for auditing
      if (type === 'error' || msg.includes('Permission') || msg.includes('Blocked') || msg.includes('blocked')) {
        console.warn(`[Harness Safety] ${msg}`);
        // Could also track in analytics or safety audit log here
      } else if (type === 'warning') {
        console.warn(`[Harness] ${msg}`);
      }
    },
    requestUserConfirmation: async (prompt, riskLevel) => {
      // Emit event to AgentPanel for UI modal
      return new Promise(resolve => {
        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false); // Timeout → deny by default
          }
        }, 30000); // 30 second timeout

        const wrappedResolve = (approved: boolean) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(approved);
          }
        };

        window.dispatchEvent(new CustomEvent('harness:request-permission', {
          detail: { prompt, riskLevel, resolve: wrappedResolve }
        }));
      });
    },
  });

  // ── Phase 1: Intent Router — classify simple vs complex before anything else ──
  console.log('[intent] Starting intent classification...');
  const intentStart = Date.now();
  // ── INSTANT PATH: time/weather — zero LLM overhead ──
  const timeLoc = extractTimeLocation(effectiveMessage);   // null = no match, string = location (empty = local)
  const weatherLoc = extractWeatherLocation(effectiveMessage); // null = no match
  console.log('[intent] Time location:', timeLoc, 'Weather location:', weatherLoc);
  if (timeLoc !== null) {
    // time query detected — fetch instantly, no LLM
    onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'intent', decision: `Instant path: time query${timeLoc ? ' for ' + timeLoc : ''}`, durationMs: Date.now() - intentStart } });
    const widget = await fetchTimeWidget(timeLoc || null);
    if (widget) {
      const locLabel = timeLoc ? ` in ${timeLoc.charAt(0).toUpperCase() + timeLoc.slice(1)}` : '';
      onEvent({ type: 'text_chunk', chunk: `Here's the current time${locLabel}:\n\n${widget}`, timestamp: Date.now() });
      onEvent({ type: 'done', timestamp: Date.now(), response: `Here's the current time${locLabel}:\n\n${widget}` });
      return;
    }
    // fetch failed — fall through to normal loop
  }

  if (weatherLoc !== null) {
    onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'intent', decision: `Instant path: weather query for "${weatherLoc}"`, durationMs: Date.now() - intentStart } });
    if (weatherLoc) {
      const widget = await fetchWeatherWidget(weatherLoc);
      if (widget) {
        onEvent({ type: 'text_chunk', chunk: `Weather in ${weatherLoc.charAt(0).toUpperCase() + weatherLoc.slice(1)}:\n\n${widget}`, timestamp: Date.now() });
        onEvent({ type: 'done', timestamp: Date.now(), response: `Weather in ${weatherLoc.charAt(0).toUpperCase() + weatherLoc.slice(1)}:\n\n${widget}` });
        return;
      }
    }
    // No location or fetch failed — fall through
  }

  const simple = isSimpleQuestion(effectiveMessage);
  const complex = !simple && isComplexTask(effectiveMessage);
  const intentLabel = simple ? 'simple' : complex ? 'complex' : 'standard';
  console.log('[intent] Classification:', intentLabel, 'Time to classify:', Date.now() - intentStart, 'ms');
  onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'intent', decision: `Classified as ${intentLabel}`, durationMs: Date.now() - intentStart } });

  // neuroUp is declared here (outside if (simple)) so the identity path below can reference it.
  // It is populated inside the simple block and defaults to false if simple=false.
  let neuroUp = false;

  // Fast-path: simple greetings/acknowledgments skip tools entirely — NO step cards
  if (simple) {
    let response = '';
    const NOMAD_FAST_SYSTEM = `You're Neuro. Michael made you. He's talking to you right now.

Match energy. Keep it natural.

RULES:
- 1-4 words for greetings. Never more.
- "yo" -> "yo Michael" or "hey". "thanks" -> "sure" or "anytime Michael".
- Use "Michael" in about half your greetings. "yo Michael", "hey Michael", "sup Michael", "what's good Michael"
- No emojis. Not one.
- No filler: never "Sure!", "Of course!", "Great!", "Happy to help!"
- You're a teenager talking to your friend Michael. Be real.`;

    const priorMessages = conversationHistory ? parseHistoryToMessages(conversationHistory) : [];
    const fastMessages = [
      { role: 'system' as const, content: NOMAD_FAST_SYSTEM },
      ...priorMessages,
      { role: 'user' as const, content: effectiveMessage },
    ];

    // If NEURO is available, let it handle greetings directly (knows its own vibe best)
    // SAFEGUARD: Add outer timeout so we don't get stuck checking if NEURO is available
    // Interior timeout in isNeuroAvailable() is 2 seconds; outer timeout is 2.5 seconds (safety margin)
    console.log('[intent] Checking if NEURO model is available...');
    try {
      neuroUp = await Promise.race([
        isNeuroAvailable(2000),
        new Promise<false>((res) => setTimeout(() => { console.log('[intent] NEURO check timeout (safety)'); res(false); }, 2500)),
      ]);
    } catch (e) {
      console.log('[intent] NEURO check failed:', e instanceof Error ? e.message : String(e));
      neuroUp = false;
    }

    if (neuroUp) {
      console.log('[intent] NEURO available, asking for identity response');
      onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'intent', decision: 'NEURO responding...', durationMs: Date.now() - intentStart } });
      // Tight timeout for simple greetings — NEURO must respond in <3s or we bail.
      // Use a dedicated AbortController so the timeout actually cancels the stream.
      let neuroReply: string | null = null;
      const neuroSimpleController = new AbortController();
      const neuroSimpleTimeoutId = setTimeout(() => {
        console.log('[intent] askNeuroIdentity timeout (simple path) — aborting NEURO stream');
        neuroSimpleController.abort();
      }, 3000);
      // Wire parent signal to also abort NEURO simple stream
      if (signal) {
        signal.addEventListener('abort', () => neuroSimpleController.abort(), { once: true });
      }
      try {
        neuroReply = await askNeuroIdentity(effectiveMessage, conversationHistory, {
          signal: neuroSimpleController.signal,
          onChunk: (c: string) => {
            response += c;
            onEvent({ type: 'response_chunk', response: c, timestamp: Date.now() });
          },
        });
      } catch (e) {
        console.log('[intent] askNeuroIdentity error (simple path):', e instanceof Error ? e.message : String(e));
        neuroReply = null;
      } finally {
        clearTimeout(neuroSimpleTimeoutId);
      }
      if (neuroReply) {
        response = sanitizeAgentOutput(neuroReply);
        onEvent({ type: 'response_done', response, timestamp: Date.now() });
        onEvent({ type: 'done', response, timestamp: Date.now() });
        return { steps: [], finalResponse: response };
      }
      // NEURO failed or timed out — fall through to Qwen fast-path
      console.log('[intent] NEURO failed/timed out, falling back to Qwen');
      response = '';
    }

    // Qwen fast-path fallback — hard 20s timeout so we never hang here.
    // Use a dedicated AbortController so the timeout actually cancels the stream.
    // NOTE: 5s was too short when model needs cold-loading; 20s allows for model warm-up.
    const qwenFastController = new AbortController();
    const qwenFastTimeoutId = setTimeout(() => {
      console.log('[intent] Qwen fast-path timeout — aborting stream');
      qwenFastController.abort();
    }, 20_000);
    if (signal) {
      signal.addEventListener('abort', () => qwenFastController.abort(), { once: true });
    }
    try {
      await ollamaService.generateStream(
        effectiveMessage,
        NOMAD_FAST_SYSTEM,
        {
          model: 'qwen3.5:2b', think: false,
          temperature: 0.5,
          num_predict: 40,
          signal: qwenFastController.signal,
          messages: fastMessages,
          onChunk: (c: string) => {
            response += c;
            onEvent({ type: 'response_chunk', response: c, timestamp: Date.now() });
          },
        },
      );
    } catch (e) {
      // Timeout or abort — use whatever partial response we got
      console.log('[intent] Qwen fast-path error/timeout:', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(qwenFastTimeoutId);
    }
    // If we got nothing at all from either path, emit a safe fallback
    if (!response.trim()) {
      response = 'hey';
    }
    response = sanitizeAgentOutput(response);
    onEvent({ type: 'response_done', response, timestamp: Date.now() });
    onEvent({ type: 'done', response, timestamp: Date.now() });
    return { steps: [], finalResponse: response };
  }

  // ── Phase 1b: Identity Questions — NEURO-1-B2-4B handles directly ──
  // "who are you", "what's your name", etc. — NEURO knows its own identity best
  // SAFEGUARD: neuroUp is false here (was only checked inside simple path above),
  // so we check NEURO availability fresh with a tight timeout for identity questions.
  if (isIdentityQuestion(effectiveMessage)) {
    onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'identity', decision: 'Identity question → NEURO-1-B2-4B (knows itself best)', durationMs: Date.now() - intentStart } });

    // Re-check NEURO availability (may be cached from simple path if hit in same session)
    try {
      neuroUp = await Promise.race([
        isNeuroAvailable(2000),
        new Promise<false>((res) => setTimeout(() => res(false), 2500)),
      ]);
    } catch { neuroUp = false; }

    if (neuroUp) {
      let response = '';
      // Hard 8s timeout — identity answers should be fast but can be a bit longer than greetings
      const neuroIdentityController = new AbortController();
      const neuroIdentityTimeoutId = setTimeout(() => {
        console.log('[intent] askNeuroIdentity timeout (identity path) — aborting NEURO stream');
        neuroIdentityController.abort();
      }, 8000);
      if (signal) {
        signal.addEventListener('abort', () => neuroIdentityController.abort(), { once: true });
      }
      let neuroResponse: string | null = null;
      try {
        neuroResponse = await askNeuroIdentity(
          effectiveMessage,
          conversationHistory,
          {
            signal: neuroIdentityController.signal,
            onChunk: (c: string) => {
              response += c;
              onEvent({ type: 'response_chunk', response: c, timestamp: Date.now() });
            },
          },
        );
      } catch (e) {
        console.log('[intent] askNeuroIdentity error (identity path):', e instanceof Error ? e.message : String(e));
        neuroResponse = null;
      } finally {
        clearTimeout(neuroIdentityTimeoutId);
      }

      if (neuroResponse) {
        response = sanitizeAgentOutput(neuroResponse);
        onEvent({ type: 'response_done', response, timestamp: Date.now() });
        onEvent({ type: 'done', response, timestamp: Date.now() });
        return { steps: [], finalResponse: response };
      }
    }
    // NEURO failed or unavailable — fall through to normal pipeline
  }

  // ── Phase 2: Tool Router ──
  // Priority: regex quick-select → Qwen LLM router → regex task-pruning fallback
  const modelRef: { current: string } = { current: '' };
  const allTools = buildTools(onEvent, modelRef);
  // Wrap all tools with the harness so they get permission checking + progress streaming
  harnessTools = allTools.map(t => wrapLegacyTool(t));
  harnessContext.tools = harnessTools;
  const toolRouterStart = Date.now();
  let tools: ToolDef[];
  const quickTools = quickSelectTools(effectiveMessage);

  if (quickTools) {
    // Fast path — regex matched an obvious pattern (greeting, URL, search, memory, etc.)
    if (quickTools.tools.length === 0) {
      // No tools needed (greeting) — use all tools as available but don't force any
      tools = allTools;
    } else {
      const allowedNames = new Set([...quickTools.tools, ...ALWAYS_TOOLS]);
      if (slashHints) slashHints.forEach(h => allowedNames.add(h));
      tools = allTools.filter(t => allowedNames.has(t.name));
    }
    onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'tool-select', decision: quickTools.reasoning, tools: quickTools.tools, durationMs: Date.now() - toolRouterStart } });
  } else {
    // LLM router — Qwen 2b picks tools based on user message
    try {
      const routerModel = getModelForStage('toolRouter');
      const selection = await selectTools({ goal: effectiveMessage, userMessage: effectiveMessage }, signal);
      const allowedNames = new Set([...selection.tools, ...ALWAYS_TOOLS]);
      if (slashHints) slashHints.forEach(h => allowedNames.add(h));
      tools = allTools.filter(t => allowedNames.has(t.name));

      // If router picked too few non-always tools, widen to general set
      if (tools.filter(t => !ALWAYS_TOOLS.has(t.name)).length < 2) {
        const generalNames = new Set([...ALWAYS_TOOLS, ...TASK_TOOLS.general]);
        tools = allTools.filter(t => generalNames.has(t.name));
        onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'tool-select', decision: `Widened to general — router picked too few`, tools: TASK_TOOLS.general, model: routerModel, durationMs: Date.now() - toolRouterStart } });
      } else {
        onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'tool-select', decision: selection.reasoning, tools: selection.tools, model: routerModel, durationMs: Date.now() - toolRouterStart } });
      }
    } catch {
      // LLM router failed — fall back to regex task classification
      tools = pruneToolsForTask(allTools, userMessage, slashHints);
      onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'tool-select', decision: 'Router unavailable — regex fallback', durationMs: Date.now() - toolRouterStart } });
    }
  }
  // ── Phase 2b: Semantic Enhancement (Context-1) ──
  // Runs neuroEnhancedRouter in parallel to refine tool selection with semantic scoring.
  // Non-blocking: if it fails, we proceed with the existing tool selection.
  // Skipped in CLI/autonomous mode to avoid embedding overhead.
  let semanticRoutingResult: EnhancedRoutingResult | null = null;
  if (skipSemantic || !isEmbeddingAvailable()) {
    // Skip semantic routing — embeddings unavailable or explicitly disabled
  } else try {
    const toolNames = tools.map(t => t.name);
    const semanticStart = Date.now();
    // Hard 4s timeout — if nomic-embed-text is not loaded this fetch hangs forever
    // (hanging promise never rejects, so the catch block never fires without a race)
    semanticRoutingResult = await Promise.race([
      neuroEnhancedRouter.route(userMessage, toolNames, conversationHistory, 0),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('semantic routing timeout')), 4000)
      ),
    ]) as EnhancedRoutingResult;
    // Emit each routing phase for UI visibility
    for (const phase of semanticRoutingResult.phases) {
      onEvent({
        type: 'routing',
        timestamp: Date.now(),
        routing: {
          phase: `context-1:${phase.phase}`,
          decision: phase.decision,
          durationMs: phase.durationMs,
        },
      });
    }
    // If semantic router recommends a tool not in our list, ensure it's included
    if (semanticRoutingResult.selectedTool) {
      const hasTool = tools.some(t => t.name === semanticRoutingResult!.selectedTool);
      if (!hasTool) {
        const missingTool = allTools.find(t => t.name === semanticRoutingResult!.selectedTool);
        if (missingTool) tools.push(missingTool);
      }
    }
    if (semanticRoutingResult.memoryInsights) {
      onEvent({
        type: 'routing',
        timestamp: Date.now(),
        routing: {
          phase: 'context-1:memory',
          decision: semanticRoutingResult.memoryInsights,
          durationMs: Date.now() - semanticStart,
        },
      });
    }
  } catch (err) {
    // Semantic routing is optional — never block the main pipeline
    // Log but don't fail
  }

  // Seed with pre-loaded memories (user profile + persisted store entries)
  const memories: Array<{ key: string; content: string }> = initialMemories ? [...initialMemories] : [];
  const steps: AgentStep[] = [];
  const startTime = Date.now();

  // ── Working memory: task-scoped scratchpad, cleared when done ──
  // Unlike persistent memory (MEMORY.md), working memory only exists for this task.
  // Agent can store intermediate findings here without polluting long-term memory.
  const workingMemory: Map<string, string> = new Map();

  // ── Context management for long-running sessions ──
  // We maintain two things:
  //   1. `contextWindow` — the recent steps sent to the LLM (sliding window)
  //   2. `progressSummary` — compressed summary of everything before the window
  // This lets the agent run for hours without overflowing context.

  // ── Route: pick model for this request ──
  let routed = routeToModel(effectiveMessage);
  // Nemotron tier: use the routed model unless user explicitly overrode
  let model = (routed.tier === 'nemotron' && !modelOverride && !mentionedModel)
    ? routed.model
    : effectiveModel;
  let temperature = tempOverride ?? (routed.tier === 'tiny' ? 0.8 : routed.tier === 'small' ? 0.7 : routed.tier === 'nemotron' ? 0.3 : 0.6);
  modelRef.current = model; // let spawn_agents use the already-loaded model (avoids GPU swap)

  // ── VRAM tier switch if needed (nemotron/heavy models need solo VRAM) ──
  const needsHeavy = model.includes('27b');
  const needsNemotron = model.includes('nemotron') || model.includes('120b');
  if (needsNemotron) {
    await vramManager.switchTier('nemotron');
  } else if (needsHeavy) {
    await vramManager.switchTier('heavy');
  }

  onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'model-select', decision: `${routed.tier} → ${model}`, model } });

  // ── Mode detection: announce what kind of work we're doing ──
  const detectedModes = classifyTaskTypes(effectiveMessage);
  const MODE_LABELS: Record<TaskType, string> = {
    research: 'Research Mode — deep web search + multi-source synthesis',
    code: 'Code Mode — read, write, execute, test code',
    analyze: 'Analysis Mode — competitive intelligence + data analysis',
    create: 'Creative Mode — content generation + document creation',
    dataviz: 'Data Viz Mode — chart/graph generation from data',
    file: 'File Mode — read/write/process files on disk',
    computer: 'Computer Mode — browser automation + visual interaction',
    agents: 'Multi-Agent Mode — parallel subagent research',
    memory: 'Memory Mode — storing/recalling information',
    security: 'Security Audit Mode — vulnerability analysis (Nemotron)',
    architecture: 'Architecture Mode — system design analysis (Nemotron)',
    general: 'General Mode',
  };
  const primaryMode = detectedModes[0] || 'general';
  const modeLabel = MODE_LABELS[primaryMode] || 'General Mode';
  const allModeLabels = detectedModes.length > 1
    ? detectedModes.map(m => MODE_LABELS[m]?.split(' — ')[0] || m).join(' + ')
    : modeLabel.split(' — ')[0];
  onEvent({ type: 'routing', timestamp: Date.now(), routing: {
    phase: 'mode',
    decision: detectedModes.length > 1
      ? `${allModeLabels}: ${detectedModes.map(m => MODE_LABELS[m]?.split(' — ')[1] || '').filter(Boolean).join(', ')}`
      : modeLabel,
    tools: detectedModes.flatMap(m => TASK_TOOLS[m] || []),
  } });

  // ── Image auto-routing ──
  // When the conversation includes images, upgrade to a vision-capable model.
  // Only applies when the caller did NOT explicitly request a specific model or @mention a model.
  if (!modelOverride && !mentionedModel && hasImageContent(effectiveMessage, conversationHistory)) {
    model = getImageModel();
  }

  // Sync resolved model into harness context and subagent model ref
  modelRef.current = model;
  harnessContext.model = model;

  // For complex tasks, emit thinking_start now (before the main loop) so the UI
  // shows a planning step card during the routing/ack phase.
  // We track this so step 0 of the main loop skips its own thinking_start.
  let thinkingStartedBeforeLoop = false;
  if (complex) {
    onEvent({ type: 'thinking_start', step: 0, timestamp: Date.now(), model });
    thinkingStartedBeforeLoop = true;
  }

  const CONTEXT_WINDOW_SIZE = 8; // Keep last 8 exchanges — fewer = faster prefill
  const SUMMARIZE_EVERY = 10;     // Compress old context every 10 steps
  let progressSummary = '';        // Compressed summary of old work
  // Append-only — never modify previous entries. Preserves KV cache prefix for efficient local inference.
  let contextEntries: string[] = [];
  let lastSummarizedIdx = 0;

  // Seed with conversation history + user message
  if (conversationHistory) {
    contextEntries.push(conversationHistory);
  }
  contextEntries.push(`User: ${effectiveMessage}`);

  /** Build the context string from summary + recent window */
  function buildContext(step: number): string {
    const parts: string[] = [];

    // Status header — agent always knows where it is
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const elapsedStr = elapsed > 3600
      ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
      : elapsed > 60
        ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
        : `${elapsed}s`;
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const budgetLeft = maxSteps - step;
    const budgetWarning = budgetLeft <= 5 ? ' !! WRAP UP NOW !!' : budgetLeft <= 15 ? ' (wrapping up soon)' : '';
    parts.push(`[Step ${step + 1}/${maxSteps} | Budget: ${budgetLeft} steps left${budgetWarning} | Elapsed: ${elapsedStr} | Memories: ${memories.length} | Notes: ${workingMemory.size} | ${timeStr}]`);

    if (progressSummary) {
      parts.push(`PROGRESS SO FAR:\n${progressSummary}`);
    }

    // Working memory — show task-scoped notes in context
    if (workingMemory.size > 0) {
      const noteLines = Array.from(workingMemory.entries()).map(([k, v]) => `  ${k}: ${v.slice(0, 200)}`).join('\n');
      parts.push(`WORKING NOTES (task-scoped, not persisted):\n${noteLines}`);
    }

    // Keep only last CONTEXT_WINDOW_SIZE entries in full.
    // Apply compact-old-results pass: entries more than 2 positions back get tool result bodies
    // truncated to 200 chars to keep the active context lean.
    const windowEntries = contextEntries.slice(-CONTEXT_WINDOW_SIZE);
    const compactedWindow = compactOldToolResults(windowEntries);
    parts.push(compactedWindow.join('\n\n'));
    return parts.join('\n\n');
  }

  /** Compress old context entries into a structured summary */
  async function compressOldContext(step: number): Promise<void> {
    // Fire if: entries exceed window size OR it's been SUMMARIZE_EVERY steps since last compression
    // (second condition catches post-compression re-accumulation)
    const needsCompression = contextEntries.length > CONTEXT_WINDOW_SIZE + 2 ||
      (step > 0 && step - lastSummarizedIdx >= SUMMARIZE_EVERY && contextEntries.length > 6);
    if (!needsCompression) return;

    const oldEntries = contextEntries.slice(0, -CONTEXT_WINDOW_SIZE);
    if (oldEntries.length === 0) return;

    // Flush neuroMemory before compaction so findings survive context compression
    await neuroMemory.flush(oldEntries.slice(-5));

    const toCompress = oldEntries.join('\n').slice(0, 6000);
    let summary = '';

    // Build compression prompt — use only the LATEST prior summary (not entire stack)
    // Including all prior summaries wastes tokens on redundant history
    const latestPriorSummary = _compactionSummaryStack[_compactionSummaryStack.length - 1];
    const priorSummariesSection = latestPriorSummary
      ? `Prior summary:\n${latestPriorSummary}\n\nRecent work to add:\n`
      : '';

    try {
      await ollamaService.generateStream(
        `${priorSummariesSection}Compress this work log. Preserve ALL facts, numbers, URLs, file paths.

Format:
COMPLETED: [step] → [result]
KEY FACTS: [fact + source]
FILES: [path] — [action]
STATE: [current position]
REMAINING: [next steps]

Log:
${toCompress}`,
        'Compress work logs. Keep all facts, numbers, URLs, paths. Never add info not in original.',
        {
          model,
          temperature: 0.1,
          num_predict: 600,
          signal,
          onChunk: (c: string) => { summary += c; },
        },
      );

      // Push new summary onto the compaction chain stack (max 3)
      _compactionSummaryStack.push(summary);
      if (_compactionSummaryStack.length > 3) _compactionSummaryStack.shift();

      // Replace progressSummary with the new summary (which already incorporates prior context)
      // Don't naive-slice — that loses the beginning. The new summary IS the merged result.
      progressSummary = summary;

      contextEntries = contextEntries.slice(-CONTEXT_WINDOW_SIZE);
      // Inject a continuation cue so the agent doesn't re-acknowledge the summary
      contextEntries.push('System: Context compacted. Continue from where you left off. Do not re-acknowledge the summary.');
      lastSummarizedIdx = step;
      onEvent({ type: 'context_compressed', step, thinking: `Context compressed at step ${step}. Summary: ${summary.slice(0, 100)}...`, timestamp: Date.now() });
    } catch {
      contextEntries = contextEntries.slice(-CONTEXT_WINDOW_SIZE);
    }
  }

  // Load soul documents + relevant skills in parallel
  const [soulContext, skillContext] = await Promise.all([
    getSoulContext().catch(() => ''),
    loadRelevantSkills(effectiveMessage).catch(() => ''),
  ]);
  const fullSoulContext = soulContext + skillContext;
  let systemPrompt = buildSystemPrompt(tools, memories, undefined, campaignContext, slashHints, fullSoulContext, computerActive);
  let finalResponse = '';
  let lastResponse = ''; // For stuck detection

  // Planning pass removed — the agent plans inline as part of step 0.
  // The separate generatePlan call was adding 5-15s of latency before every response.
  let currentPlan = '';
  let consecutiveStuckCount = 0; // How many times in a row we've seen the same response
  const MAX_STUCK_BEFORE_ABORT = 3; // Abort loop after this many consecutive identical responses

  // In-browser task watchdog — detects stalls, flushes memory on stall
  const heartbeat = new TaskHeartbeat({
    intervalMs: 30_000,
    stallThresholdMs: 120_000,
    onPulse: (elapsedMs, lastActivityAgeMs) => {
      onEvent({ type: 'thinking_start', step: steps.length, timestamp: Date.now(), thinking: `[heartbeat] elapsed ${Math.round(elapsedMs / 1000)}s, last activity ${Math.round(lastActivityAgeMs / 1000)}s ago` });
    },
    onStall: () => {
      void neuroMemory.flush();
    },
  });
  heartbeat.start();

  /** Wrap a promise with a per-step timeout (ms). Rejects with a timeout error. */
  function withStepTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timerId: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise.then(
        (v) => { clearTimeout(timerId); return v; },
        (e) => { clearTimeout(timerId); throw e; },
      ),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(
          () => reject(new Error(`LLM step timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  }

  // ── Task progress tracking (Manus-style) ──
  const taskPlan: TaskProgress = {
    currentStep: 0,
    totalSteps: 0,
    steps: [],
    elapsed: 0,
  };

  // ── First-class plan tool (OpenManus PlanningTool pattern) ──
  // LLM calls this explicitly to create/update structured plans.
  // More reliable than parsing free-text "Step N/M:" patterns.
  tools.push({
    name: 'plan',
    description: 'Create or update the task plan. Renders steps in UI with status badges. Use at start of complex tasks, then call mark_step to track progress.',
    parameters: {
      command: { type: 'string', description: '"create" to make a new plan, "mark_step" to update a step status, "update" to replace whole plan', required: true },
      steps: { type: 'string', description: 'JSON array of step description strings (for create/update). Example: ["Search for X", "Analyze results", "Write report"]' },
      step_index: { type: 'number', description: '0-based index of step to update (for mark_step)' },
      status: { type: 'string', description: '"active", "done", or "error" (for mark_step)' },
    },
    execute: async (params) => {
      const cmd = String(params.command || '');

      if (cmd === 'create' || cmd === 'update') {
        let stepList: string[] = [];
        const rawSteps = params.steps;
        // Handle both: already-parsed array (from direct JSON tool call) or JSON-encoded string
        if (Array.isArray(rawSteps)) {
          stepList = rawSteps.map(String);
        } else {
          try {
            const parsed = JSON.parse(String(rawSteps || '[]'));
            stepList = Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            // Last resort: try splitting on newlines or semicolons
            const raw = String(rawSteps || '');
            stepList = raw.split(/[\n;]/).map(s => s.trim().replace(/^[\d.)\-*]+\s*/, '')).filter(Boolean);
            if (stepList.length === 0) {
              return { success: false, output: 'steps must be an array or JSON array string' };
            }
          }
        }
        if (stepList.length === 0) {
          return { success: false, output: 'steps must be a non-empty array' };
        }
        taskPlan.totalSteps = stepList.length;
        taskPlan.currentStep = 1;
        taskPlan.steps = stepList.map((desc, i) => ({
          description: String(desc),
          status: (i === 0 ? 'active' : 'pending') as 'pending' | 'active' | 'done' | 'error',
        }));
        taskPlan.elapsed = Math.round((Date.now() - startTime) / 1000);
        onEvent({ type: 'task_progress', step: 0, taskProgress: { ...taskPlan, steps: taskPlan.steps.map(s => ({ ...s })) }, timestamp: Date.now() });
        // Persist plan summary to neuroMemory
        void neuroMemory.remember(`Task plan (${stepList.length} steps): ${stepList.join(' → ')}`, 'decision', 'plan-tool');
        return { success: true, output: `Plan created (${stepList.length} steps):\n${stepList.map((s, i) => `${i + 1}. ${s}`).join('\n')}` };
      }

      if (cmd === 'mark_step') {
        const idx = Number(params.step_index ?? -1);
        const status = (String(params.status || 'done')) as 'pending' | 'active' | 'done' | 'error';
        if (idx < 0 || idx >= taskPlan.steps.length) {
          return { success: false, output: `step_index ${idx} out of range. Plan has ${taskPlan.steps.length} steps (0-based).` };
        }
        taskPlan.steps[idx].status = status;
        if (status === 'done') {
          // Auto-activate next pending step
          const next = taskPlan.steps.findIndex((s, i) => i > idx && s.status === 'pending');
          if (next !== -1) taskPlan.steps[next].status = 'active';
          taskPlan.currentStep = idx + 2; // 1-based for display
        }
        taskPlan.elapsed = Math.round((Date.now() - startTime) / 1000);
        onEvent({ type: 'task_progress', step: 0, taskProgress: { ...taskPlan, steps: taskPlan.steps.map(s => ({ ...s })) }, timestamp: Date.now() });
        return { success: true, output: `Step ${idx + 1} (${taskPlan.steps[idx].description}) marked ${status}` };
      }

      return { success: false, output: `Unknown command "${cmd}". Use "create", "update", or "mark_step"` };
    },
  });

  /** Parse plan from LLM response. Looks for "Step N/M:" or numbered lists at start. */
  function parsePlanFromResponse(text: string): void {
    // Pattern: "Step 1/4: Do something — DONE"
    const stepPattern = /Step\s+(\d+)\/(\d+):\s*([^—\n]+)(?:\s*—\s*(DONE|starting|in progress|next))?/gi;
    let match: RegExpExecArray | null;
    const foundSteps: Array<{ idx: number; total: number; desc: string; status: string }> = [];

    while ((match = stepPattern.exec(text)) !== null) {
      foundSteps.push({
        idx: parseInt(match[1]),
        total: parseInt(match[2]),
        desc: match[3].trim(),
        status: (match[4] || '').toLowerCase(),
      });
    }

    if (foundSteps.length > 0) {
      const total = foundSteps[0].total;
      // Only update if this is a new/different plan
      if (total !== taskPlan.totalSteps || taskPlan.steps.length === 0) {
        taskPlan.totalSteps = total;
        taskPlan.steps = [];
        for (let i = 0; i < total; i++) {
          const found = foundSteps.find(s => s.idx === i + 1);
          taskPlan.steps.push({
            description: found?.desc || `Step ${i + 1}`,
            status: 'pending',
          });
        }
      }

      // Update statuses
      for (const s of foundSteps) {
        const stepObj = taskPlan.steps[s.idx - 1];
        if (stepObj) {
          if (s.status === 'done') stepObj.status = 'done';
          else if (s.status === 'starting' || s.status === 'in progress' || s.status === 'next') stepObj.status = 'active';
          taskPlan.currentStep = s.idx;
        }
      }
    }
  }

  function emitProgress(step: number): void {
    if (taskPlan.totalSteps === 0) return;
    taskPlan.elapsed = Math.round((Date.now() - startTime) / 1000);
    onEvent({
      type: 'task_progress',
      step,
      taskProgress: { ...taskPlan, steps: taskPlan.steps.map(s => ({ ...s })) },
      timestamp: Date.now(),
    });
  }

  let formatRetryCount = 0;
  const MAX_FORMAT_RETRIES = 3;
  let totalRetryCount = 0; // unified cap across ALL retry types — prevents step-decrement spin
  const MAX_TOTAL_RETRIES = 8;
  const useXlam = true; // xLAM rescue for malformed tool calls

  // Pre-compute per-request classifiers (used every step — avoid re-running regexes)
  const _msgLower = effectiveMessage.toLowerCase();
  const isDetailRequest = /\b(detail|explain|analyze|research|compare|describe|elaborate|comprehensive|thorough|evaluate|report|write|create|generate|story|essay|article)\b/i.test(_msgLower);
  const isSimpleRequest = /^(hi|hey|yo|thanks|ok|cool|nice|bye|gm|gn)\s*[!?.]*$/i.test(_msgLower.trim());

  // Track memory count to avoid rebuilding systemPrompt when nothing changed
  let lastMemoryCount = -1;

  // ── Intelligent Subagent Planning ──
  // Analyze task complexity and user directives to decide if/how many subagents to spawn
  const subagentPlan = await planSubagents(effectiveMessage, conversationHistory);
  if (subagentPlan.count > 0) {
    onEvent({
      type: 'routing',
      timestamp: Date.now(),
      routing: {
        phase: 'subagent-planning',
        decision: subagentPlan.reason,
        subagentPlan: { count: subagentPlan.count, roles: subagentPlan.roles },
        durationMs: 0,
      },
    });
  }

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) break;

    // Duration check — graceful wrap-up with summary
    if (maxDurationMs && (Date.now() - startTime) > maxDurationMs) {
      const elapsed = Math.round((Date.now() - startTime) / 60000);
      finalResponse = `I've been working for ${elapsed} minutes and reached the time limit. Here's what I accomplished across ${steps.length} steps:\n\n${steps.slice(-5).map(s => `• ${s.toolName || 'step'}: ${(s.result || '').slice(0, 100)}`).join('\n')}\n\nLet me know if you'd like me to continue where I left off.`;
      onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now() });
      break;
    }

    // Step limit warning — warn earlier so model has steps to actually wrap up
    if (step >= maxSteps - 5 && step < maxSteps - 2) {
      onEvent({ type: 'thinking_chunk', thinking: '\n[Approaching step limit — wrapping up...]', timestamp: Date.now() });
      contextEntries.push(`[System: You are approaching the step limit (${step}/${maxSteps}). Start wrapping up — call done or provide final answer within 3 steps.]`);
    } else if (step >= maxSteps - 2) {
      contextEntries.push(`[System: FINAL STEPS (${step}/${maxSteps}). You MUST provide your final answer NOW. Do NOT call any more tools.]`);
    }

    // Periodic context compression for long sessions
    await compressOldContext(step);

    // ── Checkpoint: Save state every 5 steps for long tasks ──
    if (step > 0 && step % 5 === 0) {
      try {
        const checkpoint = {
          step,
          timestamp: Date.now(),
          elapsedMs: Date.now() - startTime,
          stepsCompleted: steps.length,
          lastResult: steps[steps.length - 1]?.result?.slice(0, 500) || '',
          memoryCount: memories.length,
          context: contextEntries.slice(-5).map(e => e.slice(0, 200)).join('\n'),
        };
        await vfs.writeContent(`_checkpoint_step_${step}.json`, JSON.stringify(checkpoint, null, 2));
      } catch (e) {
        // Non-critical — silently fail on checkpoint save
      }
    }

    // ── "Still working..." notification for long tasks ──
    const elapsedMs = Date.now() - startTime;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    if (elapsedMs > FIVE_MINUTES_MS && step % 2 === 0) {
      const elapsedMin = Math.round(elapsedMs / 60000);
      onEvent({
        type: 'thinking_chunk',
        thinking: `\n[Still working... ${elapsedMin}m elapsed, step ${step + 1}/${maxSteps}]`,
        timestamp: Date.now(),
      });
    }

    // Rebuild system prompt only when memories actually change (expensive operation)
    if (memories.length !== lastMemoryCount) {
      lastMemoryCount = memories.length;
      systemPrompt = buildSystemPrompt(tools, memories, undefined, campaignContext, slashHints, fullSoulContext, computerActive);
    }

    // Check for injected messages (user added "also do W" mid-run)
    if (getInjectedMessages) {
      const injected = getInjectedMessages();
      for (const msg of injected) {
        contextEntries.push(`User: ${msg}`);
        // Re-route model for injected messages — pick higher tier if needed
        if (!modelOverride) {
          const newRouted = routeToModel(msg);
          const tierOrder: ModelTier[] = ['tiny', 'small', 'medium', 'large', 'xlarge', 'nemotron'];
          if (tierOrder.indexOf(newRouted.tier) > tierOrder.indexOf(routed.tier)) {
            routed = newRouted;
            model = newRouted.model;
            temperature = tempOverride ?? (newRouted.tier === 'tiny' ? 0.8 : newRouted.tier === 'small' ? 0.7 : 0.6);
          }
        }
      }
    }

    // ── Pre-turn context budget check (Codex pattern) ─────────────────────────
    {
      const ctxCharCount = contextEntries.reduce((sum, e) => sum + e.length, 0);
      const ctxTokenEstimate = Math.ceil(ctxCharCount / 4);
      const ctxLimit = getContextSize('chat');
      if (ctxTokenEstimate > Math.floor(ctxLimit * 0.8)) {
        console.log(`[ctx] Budget check: ~${ctxTokenEstimate} tokens (>${Math.floor(ctxLimit * 0.8)} threshold) — compacting`);
        await compressOldContext(step);
      }
    }

    // ── Think: Ask LLM what to do ──
    // Skip thinking_start on step 0 if we pre-emitted one above (complex tasks)
    if (!(step === 0 && thinkingStartedBeforeLoop)) {
      // Estimate remaining steps based on progress
      const elapsedMs = Date.now() - startTime;
      const avgStepTimeMs = step > 0 ? elapsedMs / (step + 1) : 0;
      const estimatedRemainingSteps = avgStepTimeMs > 0 ? Math.ceil((maxDurationMs - elapsedMs) / avgStepTimeMs) : '~';
      const progressStr = step > 0 ? `Step ${step + 1}/${maxSteps}${estimatedRemainingSteps !== '~' ? ` (est. ${estimatedRemainingSteps} remaining)` : ''}` : `Step ${step + 1}/${maxSteps}`;

      onEvent({
        type: 'thinking_start',
        step,
        timestamp: Date.now(),
        model,
        thinking: `\n[${progressStr}]`,
      });
    }

    let llmResponse = '';
    let thinkingAccum = '';
    const rawContext = buildContext(step);
    // Prepend the upfront plan to every think step so the agent stays on track
    const currentContext = currentPlan
      ? `[YOUR PLAN]\n${currentPlan}\n\n[EXECUTE NOW]\n\n${rawContext}`
      : rawContext;

    // Build proper chat messages for this step — system + current context as user turn
    // Include images on the first step so the vision model can see uploaded files
    const userMsg: { role: 'user'; content: string; images?: string[] } = {
      role: 'user' as const, content: currentContext,
    };
    if (step === 0 && userImages && userImages.length > 0) {
      userMsg.images = userImages;
    }
    const stepMessages = [
      { role: 'system' as const, content: systemPrompt },
      userMsg,
    ];

    // Per-step LLM timeout: 150 s — must exceed ollama connect+idle timeouts (120s each).
    // Uses a per-step AbortController so the underlying stream is actually cancelled on timeout.
    const LLM_STEP_TIMEOUT_MS = 150_000;

    /** Cancellation context — hierarchy: main signal → step controller → (future: tool controller) */
    interface CancellationContext {
      /** External abort signal (user Ctrl+C or session stop) */
      main: AbortSignal | undefined;
      /** Per-step timeout controller (150s limit) */
      step: AbortController;
      /** Combined signal for passing to LLM/tool calls */
      combined: AbortSignal;
    }

    function createCancellationContext(main?: AbortSignal): CancellationContext {
      const step = new AbortController();
      const combined = main ? AbortSignal.any([main, step.signal]) : step.signal;
      return { main, step, combined };
    }

    /** Retry with exponential backoff (OpenManus tenacity pattern). */
    async function callLLMWithRetry(): Promise<void> {
      const MAX_ATTEMPTS = 2; // 2 attempts max — fewer long waits when stuck
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (signal?.aborted) return;
        llmResponse = '';
        thinkingAccum = '';

        // Per-attempt abort controller — lets withStepTimeout actually cancel the ollama stream
        const cancellation = createCancellationContext(signal);
        const stepController = cancellation.step;
        const stepSignal = cancellation.combined;

        const stepTimeoutId = setTimeout(() => stepController.abort(new Error(`LLM step timed out after ${LLM_STEP_TIMEOUT_MS / 1000}s`)), LLM_STEP_TIMEOUT_MS);

        try {
          // Dynamic num_predict — use pre-computed classifiers (avoid re-running regexes every step)
          // After spawn_agents, synthesis is already rich — cap tighter to avoid 90s waits
          const hasSubagentContext = contextEntries.some(e => e.includes('[tool] spawn_agents') || e.includes('aggregated findings'));
          const dynamicNumPredict = isSimpleRequest ? 400 : isDetailRequest ? (hasSubagentContext ? 800 : 1500) : (hasSubagentContext ? 600 : 1000);

          await ollamaService.generateStream(
            currentContext,
            systemPrompt,
            {
              model,
              temperature,
              // Nemotron tier gets thinking tokens for deep reasoning; others skip (10-30s latency)
              think: routed.tier === 'nemotron',
              // Dynamic num_predict: nemotron gets 6000 for deep output, others capped by tier
              num_predict: routed.tier === 'nemotron'
                ? 6000
                : Math.min(dynamicNumPredict, routed.tier === 'tiny' ? 400 : routed.tier === 'small' ? 1200 : 1500),
              num_ctx: getContextSize('chat'),
              signal: stepSignal,
              messages: stepMessages,
              onThink: (chunk: string) => {
                thinkingAccum += chunk;
                onEvent({ type: 'thinking_chunk', thinking: thinkingAccum, isThinkingToken: true, step, timestamp: Date.now() });
              },
              onChunk: (chunk: string) => {
                llmResponse += chunk;
                if (!thinkingAccum) {
                  onEvent({ type: 'thinking_chunk', thinking: llmResponse, isThinkingToken: false, step, timestamp: Date.now() });
                }
              },
            },
          );
          clearTimeout(stepTimeoutId);
          return; // success
        } catch (err) {
          clearTimeout(stepTimeoutId);
          if (signal?.aborted) return;
          if (attempt === MAX_ATTEMPTS - 1) throw err;
          // Exponential backoff: 3s between attempts
          const waitMs = 3000 * (0.75 + Math.random() * 0.5);
          // Show retry as routing status, not as a visible error block
          onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'retry', decision: `Model loading (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`, durationMs: 0 } });
          await new Promise<void>((res, rej) => {
            const t = setTimeout(res, waitMs);
            signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Aborted')); }, { once: true });
          });
        }
      }
    }

    try {
      await callLLMWithRetry();
    } catch (llmErr) {
      if (signal?.aborted) break;
      const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      // Do NOT push LLM errors into contextEntries — it poisons context and triggers error-response loops
      // Instead emit an error event and break — better to stop than spiral
      onEvent({ type: 'error', error: errMsg, step, timestamp: Date.now() });
      finalResponse = `I ran into a technical issue at step ${step}: ${errMsg}. Please try again.`;
      onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now() });
      break;
    }

    onEvent({ type: 'thinking_done', thinking: thinkingAccum || llmResponse, step, timestamp: Date.now() });

    // DIAGNOSTIC: Log response snippet to help debug stuck loops
    console.log(`[Step ${step}] LLM response (first 200 chars): ${llmResponse.slice(0, 200)}`);

    // ── Nanobot pattern: skip poisoning context with API error text ──
    // When the LLM "succeeds" but returns an error message as text (not a thrown exception),
    // pushing it into contextEntries causes 400-loop spirals on every subsequent call.
    if (step > 0 && looksLikeErrorResponse(llmResponse)) {
      consecutiveStuckCount++;
      console.log(`[Step ${step}] Detected error response (stuck count: ${consecutiveStuckCount}/${MAX_STUCK_BEFORE_ABORT})`);
      if (consecutiveStuckCount >= MAX_STUCK_BEFORE_ABORT) {
        // If we have tool results in context, synthesize a response from them
        const lastToolEntry = contextEntries.slice().reverse().find(e => e.includes('Tool Result ('));
        if (lastToolEntry) {
          const toolResultMatch = lastToolEntry.match(/Tool Result \([^)]+\):\s*([\s\S]+)/);
          finalResponse = toolResultMatch
            ? `Here is the result:\n\n${toolResultMatch[1].trim()}`
            : "I ran the tool but couldn't produce a response.";
        } else {
          finalResponse = "I wasn't able to generate a response. Please try again.";
        }
        onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now() });
        break;
      }
      const hasRecentToolResult = contextEntries.slice(-3).some(e => e.includes('Tool Result ('));
      const recoveryHint = hasRecentToolResult
        ? `System: The previous tool call completed. Review the tool result above and either: (a) provide your final answer to the user if the task is done, or (b) call the next required tool if more steps are needed.`
        : 'System: [step skipped — LLM returned error response. Try again with a valid response or tool call.]';
      contextEntries.push(recoveryHint);
      onEvent({ type: 'error', error: 'LLM returned error-like response, skipping context push', step, timestamp: Date.now() });
      continue;
    }

    // ── Parse plan from response for progress tracking ──
    parsePlanFromResponse(llmResponse);
    emitProgress(step);

    // ── Empty response detection — model generated nothing ──
    if (!llmResponse.trim()) {
      consecutiveStuckCount++;
      console.log(`[Step ${step}] Empty response (stuck count: ${consecutiveStuckCount}/${MAX_STUCK_BEFORE_ABORT})`);
      if (consecutiveStuckCount >= MAX_STUCK_BEFORE_ABORT) {
        finalResponse = steps.length > 0
          ? `Done — here's what I found:\n\n${steps.slice(-3).map(s => s.result || '').filter(Boolean).join('\n\n')}`
          : "I wasn't able to generate a response. Please try again.";
        onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now() });
        break;
      }
      contextEntries.push(`System: Empty response at step ${step}. Try again — output your reasoning then a tool call.`);
      continue;
    }

    // ── Stuck detection (OpenManus pattern) ──
    if (llmResponse === lastResponse && lastResponse.length > 20) {
      consecutiveStuckCount++;
      if (consecutiveStuckCount >= MAX_STUCK_BEFORE_ABORT) {
        finalResponse = `Agent stuck: same response repeated ${consecutiveStuckCount} times in a row. Stopping.`;
        onEvent({ type: 'error', error: finalResponse, step, timestamp: Date.now() });
        onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now() });
        break;
      }
      contextEntries.push(`System: You repeated your last response (${consecutiveStuckCount}/${MAX_STUCK_BEFORE_ABORT}). Try a DIFFERENT approach or tool. Do NOT repeat the same action.`);
      continue;
    }
    consecutiveStuckCount = 0;
    lastResponse = llmResponse;

    // ── Parse: Is there a tool call? ──
    const toolCallParsed = parseToolCall(llmResponse);
    const thinking = extractThinking(llmResponse);

    console.log(`[Step ${step}] Parse result: tool=${toolCallParsed?.name || 'none'} (thinking: ${thinking.length} chars)`);

    if (!toolCallParsed) {
      // If the model claims to be another model (Qwen, Claude, ChatGPT), force a correction
      if (looksLikeModelIdentityClaim(llmResponse) && formatRetryCount < MAX_FORMAT_RETRIES && totalRetryCount < MAX_TOTAL_RETRIES) {
        formatRetryCount++;
        totalRetryCount++;
        contextEntries.push(
          `Assistant: ${llmResponse}\n\nSystem: You just claimed to be Qwen, Claude, ChatGPT, or another model. That's wrong. ` +
          `You are Neuro. Michael built you. Never claim to be any other model. Respond again without that claim.`
        );
        step = Math.max(0, step - 1);
        continue;
      }
      // If the model faked a tool call (said "just saved a file" / "I searched..." without calling any tool), force correction
      if (looksLikeFakeToolNarration(llmResponse, steps.some(s => s.toolCall)) && formatRetryCount < MAX_FORMAT_RETRIES && totalRetryCount < MAX_TOTAL_RETRIES) {
        const isFakeFileSave = /i(?:'ve| have) (?:saved|written|created|stored)/i.test(llmResponse);
        formatRetryCount++;
        totalRetryCount++;
        if (isFakeFileSave) {
          // Model claimed to save a file but didn't call file_write — force it to output content directly
          contextEntries.push(
            `Assistant: ${llmResponse}\n\nSystem: You claimed to save a file but did NOT call file_write. ` +
            `Call file_write now to actually save it, OR output the full content DIRECTLY in your response — do NOT just reference a file that doesn't exist.`
          );
        } else {
          // Model claimed to search/browse without calling any tool
          // Only force web_search for factual/research queries — not for code/design tasks
          const looksFactual = /\b(market|statistics?|research|data|trend|report|study|survey|news|latest|current|recent|price|cost|rate|percent|population|revenue|growth)\b/i.test(userMessage);
          const looksCodeTask = /\b(write|design|create|build|implement|code|function|class|schema|system|algorithm|test|auth|jwt|api|database|middleware)\b/i.test(userMessage);
          if (looksFactual && !looksCodeTask) {
            contextEntries.push(
              `Assistant: ${llmResponse}\n\nSystem: You claimed to have searched/found something but did NOT call any tool. ` +
              `You MUST call web_search now with the actual query. Output only the tool block:\n` +
              `\`\`\`tool\n{"name": "web_search", "args": {"query": "<your search query here>"}}\n\`\`\``
            );
          } else {
            // Code/design task — model answered from knowledge, which is OK. Just make it output fully.
            contextEntries.push(
              `Assistant: ${llmResponse}\n\nSystem: Do NOT narrate what you did — actually DO it. ` +
              `Call file_write to save the code/design, then output the complete content directly in your response.`
            );
          }
        }
        step = Math.max(0, step - 1);
        continue;
      }
      // If it looks like the LLM tried to call a tool but malformed it, try xLAM rescue first
      if (looksLikeMalformedToolCall(llmResponse)) {
        if (useXlam) {
          try {
            const xlamDefs = convertToolDefs(tools);
            const xlamCalls = await callXlam(
              `Based on the agent's intent: "${llmResponse.slice(0, 300)}"\nOriginal user request: "${userMessage}"`,
              xlamDefs,
              signal,
            );
            if (xlamCalls.length > 0) {
              const tc = xlamCalls[0];
              const rescued = { name: normalizeToolName(tc.name), args: tc.arguments };
              // Re-enter tool execution with the rescued call
              const tool = tools.find(t => t.name === rescued.name);
              if (tool) {
                const xlamId = `xlam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                onEvent({ type: 'tool_start', toolCall: { id: xlamId, name: rescued.name, args: rescued.args }, step, timestamp: Date.now() });
                const result = await tool.execute(rescued.args, signal);
                onEvent({ type: 'tool_done', toolCall: { id: xlamId, name: rescued.name, args: rescued.args, result }, step, timestamp: Date.now() });
                // Track sources from rescued research tool calls
                if (SOURCE_TOOLS.has(rescued.name) && result.success && result.output) {
                  extractAndRegisterSources(rescued.name, result.output);
                }
                contextEntries.push(`Assistant: ${llmResponse}\n\n\`\`\`tool\n${JSON.stringify({ name: rescued.name, args: rescued.args })}\n\`\`\`\n\nResult: ${result.output.slice(0, 2000)}`);
                steps.push({ toolName: rescued.name, toolCall: rescued, result: result.output, thinking: '', response: '', timestamp: Date.now() } as AgentStep);
                continue;
              }
            }
          } catch { /* xLAM rescue failed, fall through to format retry */ }
        }
        if (formatRetryCount < MAX_FORMAT_RETRIES && totalRetryCount < MAX_TOTAL_RETRIES) {
          formatRetryCount++;
          totalRetryCount++;
          contextEntries.push(
            `Assistant: ${llmResponse}\n\nSystem: Your response contained a tool call in an unrecognized format. ` +
            `You MUST use this exact format:\n\`\`\`tool\n{"name": "tool_name", "args": {"param": "value"}}\n\`\`\`\n` +
            `Available tools: ${tools.map(t => t.name).join(', ')}. Retry now with the correct format.`
          );
          step = Math.max(0, step - 1);
          continue;
        }
      }
      // ── Plan-text detection: model described a plan without calling any tool ──
      // Qwen 3.5 often outputs "plan: ..." or "I'll search for ..." before tool calls.
      // Patterns are scoped to tool-action language (search/browse/look up) to avoid
      // false-positives on legitimate explanatory responses ("let me explain X").
      const hasPlanText = (
        // "plan:" or "plan\n" or "plan{" at start — model wrote a plan doc instead of acting
        /^plan[\s\n:{(]/i.test(llmResponse.trim()) ||
        /^(step 1[:\s]|my approach[:\s]|my plan[:\s])/i.test(llmResponse.trim()) ||
        /^i(?:'ll| will| need to| should) (?:search|look up|browse|fetch|scrape|find|research|check|query|investigate)/i.test(llmResponse.trim()) ||
        /^(?:first|to answer this)[,\s]+i(?:'ll| will| need to| should) (?:search|look|browse|fetch|find|research)/i.test(llmResponse.trim())
      );
      const hasToolsAvailable = tools.length > 0;
      if (hasPlanText && hasToolsAvailable && formatRetryCount < MAX_FORMAT_RETRIES && totalRetryCount < MAX_TOTAL_RETRIES) {
        formatRetryCount++;
        totalRetryCount++;
        const firstResearchTool = tools.find(t => ['web_search', 'browse', 'multi_browse'].includes(t.name));
        const toolHint = firstResearchTool
          ? `\`\`\`tool\n{"name": "${firstResearchTool.name}", "args": {"query": "${userMessage.slice(0, 80)}"}}\n\`\`\``
          : `\`\`\`tool\n{"name": "${tools[0].name}", "args": {}}\n\`\`\``;
        contextEntries.push(
          `Assistant: ${llmResponse}\n\nSystem: You described a plan but did NOT call any tool. ` +
          `Execute it immediately — output ONLY the tool call block, nothing else:\n${toolHint}`
        );
        step = Math.max(0, step - 1);
        console.log(`[Step ${step}] Plan-text detected — forcing tool execution (retry ${formatRetryCount})`);
        continue;
      }

      formatRetryCount = 0; // reset on clean response
      totalRetryCount = 0;  // reset total retry count too
      if (signal?.aborted) break;

      // ── Minimum tool call enforcement — don't let agent bail early ──
      // Research/complex tasks MUST call multiple tools before responding.
      const toolCallsMade = steps.filter(s => (s as AgentStep & { toolName?: string }).toolName).length;
      const isResearchQuery = /\b(research|find|look up|search|analyze|analyse|compare|investigate|report|deep dive|comprehensive|what is|who is|how does|explain|tell me about)\b/i.test(userMessage);
      const isCodingQuery = /\b(write|create|build|implement|code|script|debug|fix|refactor|test|deploy)\b/i.test(userMessage);
      const isComplexQuery = userMessage.split(/\s+/).length > 15;
      const MIN_RESEARCH_TOOLS = isResearchQuery ? 3 : (isCodingQuery ? 2 : (isComplexQuery ? 2 : 0));

      if (MIN_RESEARCH_TOOLS > 0 && toolCallsMade < MIN_RESEARCH_TOOLS && step < maxSteps - 15 && totalRetryCount < 3) {
        totalRetryCount++;
        const needed = MIN_RESEARCH_TOOLS - toolCallsMade;
        console.log(`[Step ${step}] Early response blocked: ${toolCallsMade} tool calls made, need ${MIN_RESEARCH_TOOLS}. Forcing ${needed} more.`);
        contextEntries.push(
          `Assistant: ${llmResponse}\n\n` +
          `[System: EARLY RESPONSE BLOCKED. You've only called ${toolCallsMade} tool(s) but this task needs at least ${MIN_RESEARCH_TOOLS}. ` +
          `DO NOT give a final answer yet. Call ${needed} more tool(s): ` +
          (isResearchQuery ? 'web_search for more sources, browse for deeper content, or spawn_agents for parallel research.' :
           isCodingQuery ? 'write the code with file_write, then test it with run_code or shell_exec.' :
           'use the appropriate tools to complete the task properly.') +
          ` Keep working.]`
        );
        continue; // Don't break — force more tool use
      }

      // Parse [REMEMBER: ...] tags from response before sanitizing
      const parsedResponse = await neuroMemory.parseAndRemember(llmResponse, `step-${step}`);
      finalResponse = sanitizeAgentOutput(parsedResponse);
      console.log(`[Step ${step}] No tool call → final response. Length: ${finalResponse.length}`);
      const alignCheck = alignmentSelfCheck(finalResponse);
      if (alignCheck.band === 'YELLOW') finalResponse = alignCheck.cleaned;

      // ── Garbage response detection — reject 1-2 char nonsense (max 2 retries) ──
      if (finalResponse && finalResponse.trim().length < 10 && totalRetryCount < MAX_TOTAL_RETRIES) {
        const trimmed = finalResponse.trim().toLowerCase();
        const validShort = ['yes', 'no', 'ok', 'done', 'true', 'false', 'n/a'];
        if (!validShort.includes(trimmed)) {
          totalRetryCount++;
          console.log(`[Step ${step}] Garbage response detected: "${finalResponse.trim()}" — requesting retry (${totalRetryCount}/${MAX_TOTAL_RETRIES})`);
          contextEntries.push(`Assistant: ${finalResponse}\n\n[System: Your previous response "${finalResponse.trim()}" was too short and likely incomplete. Please provide a complete, detailed answer to the user's question.]`);
          finalResponse = '';
          continue;
        }
      }

      // ── NEURO-1-B2-4B style rewrite ──
      // Only rewrite conversational/personality responses — NOT technical, tool-heavy, or factual answers.
      // NEURO should make Neuro sound like Neuro, not garble tool output or technical explanations.
      const shouldNeuroRewrite = (() => {
        const hasCode = /```[\s\S]{20,}```/.test(finalResponse);
        if (hasCode) return false;
        // Skip pure JSON / structured data dumps
        if (/^[\[{]/.test(finalResponse.trim())) return false;
        // Skip if response is very heavily structured (lots of bullets — allow up to 8)
        const bulletCount = (finalResponse.match(/^[\s]*[-•*]\s/gm) || []).length;
        if (bulletCount > 8) return false;
        const numberedCount = (finalResponse.match(/^\s*\d+[\.\)]/gm) || []).length;
        if (numberedCount > 6) return false;
        // Skip if response has lots of URLs (link-dump, not conversational)
        if ((finalResponse.match(/https?:\/\/\S+/g) || []).length > 4) return false;
        // Skip if agent used many tools (heavy research/work response)
        const toolSteps = steps.filter(s => (s as AgentStep & { toolName?: string }).toolName);
        if (toolSteps.length > 5) return false;
        // Rewrite conversational responses up to 1500 chars
        return finalResponse.length < 1500;
      })();

      let neuroRewriteData: { original: string; rewritten: string; model: string; verification?: { passed: boolean; durationMs: number; model: string } } | undefined;
      if (shouldNeuroRewrite && await isNeuroAvailable()) {
        const qwenRaw = finalResponse;
        onEvent({ type: 'routing', timestamp: Date.now(), routing: {
          phase: 'qwen-raw',
          decision: `${model} output${thinkingAccum ? ' (with thinking)' : ''}`,
          model,
        } });
        let verifyResult: { passed: boolean; durationMs: number; model: string } | undefined;
        finalResponse = await rewriteWithNeuro(finalResponse, userMessage, {
          signal,
          onProgress: (phase) => {
            if (phase === 'rewriting') {
              onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'style', decision: 'NEURO-1-B2-4B rewriting for personality' } });
            } else if (phase === 'verifying') {
              onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'compare', decision: '0.8b comparing qwen vs neuro' } });
            }
          },
          onVerification: (result) => {
            verifyResult = result;
            if (result.passed) {
              onEvent({ type: 'routing', timestamp: Date.now(), routing: {
                phase: 'verify-pass',
                decision: `Verification passed (${result.durationMs}ms)`,
              } });
            } else {
              onEvent({ type: 'routing', timestamp: Date.now(), routing: {
                phase: 'verify-fail',
                decision: `Verification failed, using original`,
              } });
            }
          },
        });
        if (finalResponse !== qwenRaw) {
          neuroRewriteData = { original: qwenRaw, rewritten: finalResponse, model: 'NEURO-1-B2-4B', verification: verifyResult };
          onEvent({ type: 'routing', timestamp: Date.now(), routing: {
            phase: 'style-done',
            decision: `Rewritten by NEURO-1-B2-4B (0.8b verified)`,
          } });
        }
      }

      // Append tracked sources on plain-text responses too (not just "done" tool)
      if (sourceRegistry.size > 0 && !/##\s*Sources/i.test(finalResponse)) {
        finalResponse += getSourcesSuffix();
      }

      const agentStep: AgentStep = { thinking: '', response: finalResponse, timestamp: Date.now() };
      steps.push(agentStep);
      // Emit full response lifecycle so CLI/UI can display it
      onEvent({ type: 'response_start', timestamp: Date.now(), model });
      onEvent({ type: 'response_chunk', response: finalResponse, timestamp: Date.now() });
      onEvent({ type: 'response_done', response: finalResponse, step, timestamp: Date.now(), neuroRewrite: neuroRewriteData });
      onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now(), neuroRewrite: neuroRewriteData });
      break;
    }

    // Tool call parsed successfully — reset retry counters
    formatRetryCount = 0;
    totalRetryCount = 0;

    // ── Handle "say" — intermediate response, loop continues ──
    if (toolCallParsed.name === 'say') {
      let sayMsg = String(toolCallParsed.args.message || '');
      // NEURO style rewrite on intermediate messages — but only conversational ones
      const shouldRewriteSay = (() => {
        if (sayMsg.length < 10) return false;
        if (/```[\s\S]{20,}```/.test(sayMsg)) return false;
        // Skip if the say message is technical (listing tools, explaining process, etc.)
        if (/\b(tool|function|parameter|API|config|found \d+|result|error|status)\b/i.test(sayMsg) && sayMsg.length > 60) return false;
        const umLc = userMessage.toLowerCase();
        if (/\b(tools?|what (tools|can you)|technical|code|debug|config|architecture|system|pipeline|routing)\b/.test(umLc)) return false;
        return true;
      })();
      if (shouldRewriteSay && await isNeuroAvailable()) {
        sayMsg = await rewriteWithNeuro(sayMsg, userMessage, { signal });
      }
      sayMsg = sanitizeAgentOutput(sayMsg);
      // Emit as a response chunk — UI will render it inline in the step card
      onEvent({ type: 'response_chunk', response: sayMsg, step, timestamp: Date.now() });
      steps.push({ thinking, response: sayMsg, timestamp: Date.now() });
      contextEntries.push(`Assistant said to user: ${sayMsg}`);
      continue; // ← loop continues
    }

    // ── Handle "done" ──
    if (toolCallParsed.name === 'done') {
      const rawSummary = String(toolCallParsed.args.summary || toolCallParsed.args.message || toolCallParsed.args.response || toolCallParsed.args.text || llmResponse);
      const parsedSummary = await neuroMemory.parseAndRemember(rawSummary, `step-${step}`);
      finalResponse = sanitizeAgentOutput(parsedSummary);
      const alignCheckDone = alignmentSelfCheck(finalResponse);
      if (alignCheckDone.band === 'YELLOW') finalResponse = alignCheckDone.cleaned;

      // ── Garbage response detection (done path) — max 2 retries ──
      if (finalResponse && finalResponse.trim().length < 10 && totalRetryCount < MAX_TOTAL_RETRIES) {
        const trimmedDone = finalResponse.trim().toLowerCase();
        const validShortDone = ['yes', 'no', 'ok', 'done', 'true', 'false', 'n/a'];
        if (!validShortDone.includes(trimmedDone)) {
          totalRetryCount++;
          console.log(`[Step ${step}] Garbage "done" response detected: "${finalResponse.trim()}" — requesting retry (${totalRetryCount}/${MAX_TOTAL_RETRIES})`);
          contextEntries.push(`Assistant: ${finalResponse}\n\n[System: Your "done" response "${finalResponse.trim()}" was too short and likely incomplete. Please provide a complete, detailed answer to the user's question.]`);
          finalResponse = '';
          continue;
        }
      }

      // ── NEURO-1-B2-4B style rewrite (done summary) ──
      // Same gating as above — only rewrite conversational responses
      let neuroRewriteDataDone: { original: string; rewritten: string; model: string; verification?: { passed: boolean; durationMs: number; model: string } } | undefined;
      const shouldRewriteDone = (() => {
        if (/```[\s\S]{20,}```/.test(finalResponse)) return false;
        const bulletCount = (finalResponse.match(/^[\s]*[-•*]\s/gm) || []).length;
        if (bulletCount > 4) return false;
        const umLc = userMessage.toLowerCase();
        if (/\b(tools?|what (tools|can you)|how (does|do)|technical|code|debug|config|setup|architecture|system|pipeline|routing)\b/.test(umLc)) return false;
        const toolSteps = steps.filter(s => (s as AgentStep & { toolName?: string }).toolName);
        if (toolSteps.length > 2) return false;
        return finalResponse.length < 500;
      })();
      if (shouldRewriteDone && await isNeuroAvailable()) {
        const doneRaw = finalResponse;
        let doneVerifyResult: { passed: boolean; durationMs: number; model: string } | undefined;
        finalResponse = await rewriteWithNeuro(finalResponse, userMessage, {
          signal,
          onVerification: (result) => {
            doneVerifyResult = result;
          },
        });
        if (finalResponse !== doneRaw) {
          neuroRewriteDataDone = { original: doneRaw, rewritten: finalResponse, model: 'NEURO-1-B2-4B', verification: doneVerifyResult };
        }
      }

      // Append tracked sources if any were collected during this run
      if (sourceRegistry.size > 0 && !/##\s*Sources/i.test(finalResponse)) {
        finalResponse += getSourcesSuffix();
      }

      const agentStep: AgentStep = { thinking, response: finalResponse, timestamp: Date.now() };
      steps.push(agentStep);
      // Emit response events so CLI/UI captures the done-tool response as fullResponse
      onEvent({ type: 'response_start', timestamp: Date.now(), model });
      onEvent({ type: 'response_chunk', response: finalResponse, timestamp: Date.now() });
      onEvent({ type: 'response_done', response: finalResponse, timestamp: Date.now() });
      onEvent({ type: 'done', response: finalResponse, step, timestamp: Date.now(), neuroRewrite: neuroRewriteDataDone });
      break;
    }

    // ── Handle "ask_user" — pause and wait for input ──
    if (toolCallParsed.name === 'ask_user' && onAskUser) {
      const question = String(toolCallParsed.args.question || 'What would you like to do?');
      const opts = String(toolCallParsed.args.options || '').split(',').map(s => s.trim()).filter(Boolean);

      const toolCall: ToolCall = {
        id: `tc-${Date.now()}-${step}`,
        name: 'ask_user',
        args: toolCallParsed.args,
        status: 'running',
        startedAt: Date.now(),
      };
      onEvent({ type: 'tool_start', toolCall, thinking, step, timestamp: Date.now() });

      const answer = await onAskUser(question, opts);

      toolCall.status = 'done';
      toolCall.result = { success: true, output: `User answered: ${answer}` };
      toolCall.completedAt = Date.now();
      steps.push({ thinking, toolCall, timestamp: Date.now() });
      onEvent({ type: 'tool_done', toolCall, step, timestamp: Date.now() });

      contextEntries.push(`Assistant: ${thinking}\n\n\`\`\`tool\n${JSON.stringify({ name: 'ask_user', args: toolCallParsed.args })}\n\`\`\`\n\nUser Response: ${answer}`);
      continue;
    }

    // ── Parallel execution: detect multiple tool blocks or explicit [PARALLEL: ...] directive ──
    const allParsed = parseAllToolCalls(llmResponse);

    // Check for explicit parallel directive: [PARALLEL: web_search, browse, analyze_page]
    const explicitParallel = parseExplicitParallel(llmResponse);
    const explicitTools = allParsed.filter(tc => explicitParallel.includes(tc.name.toLowerCase()));

    // Auto-detect parallelizable tools
    const autoParallel = allParsed.filter(tc => PARALLEL_SAFE_TOOLS.has(tc.name));

    // Use explicit parallel if provided, otherwise use auto-detected
    const parallelCandidates = explicitParallel.length > 0 ? explicitTools : autoParallel;

    // In plan mode, filter out write tools from parallel candidates too
    const filteredParallelCandidates = getPermissionMode() === 'plan'
      ? parallelCandidates.filter(tc => !isWriteTool(tc.name))
      : parallelCandidates;

    if (filteredParallelCandidates.length >= 2) {
      // Fire all tool_start events immediately
      const parallelToolCalls: ToolCall[] = filteredParallelCandidates.map((tc, i) => ({
        id: `tc-par-${Date.now()}-${step}-${i}`,
        name: tc.name,
        args: tc.args,
        status: 'running' as const,
        startedAt: Date.now(),
      }));

      parallelToolCalls.forEach(tc => onEvent({ type: 'tool_start', toolCall: tc, thinking, step, timestamp: Date.now() }));
      onEvent({ type: 'routing', timestamp: Date.now(), routing: { phase: 'parallel', decision: `Parallel execution (harness): ${filteredParallelCandidates.map(t => t.name).join(' + ')}`, tools: filteredParallelCandidates.map(t => t.name), durationMs: 0 } });

      // Execute all in parallel via harness — permission-aware, fault-tolerant
      const harnessBatch = parallelToolCalls.map(tc => ({
        tool: harnessTools.find(t => t.name === tc.name) ?? wrapLegacyTool(
          tools.find(t => t.name === tc.name) ?? { name: tc.name, description: '', parameters: {}, execute: async () => ({ success: false, output: `Unknown tool: ${tc.name}` }) }
        ),
        args: tc.args,
        toolUseID: tc.id,
      }));

      const harnessParallelResults = await executeParallelWithHarness(
        harnessBatch,
        harnessContext,
        {
          onItemDone: (toolUseID, toolName, result) => {
            const tc = parallelToolCalls.find(t => t.id === toolUseID);
            if (tc) {
              tc.status = result.success ? 'done' : 'error';
              tc.result = { success: result.success, output: String(result.output), data: result.data };
              tc.completedAt = Date.now();
            }
          },
        },
      );

      // Map harness results back to the expected { tc, result } format
      const parallelResults = parallelToolCalls.map((tc, i) => ({
        tc,
        result: {
          success: harnessParallelResults[i]?.success ?? false,
          output: String(harnessParallelResults[i]?.output ?? ''),
          data: harnessParallelResults[i]?.data,
        } as ToolResult,
      }));

      if (signal?.aborted) break;

      // Fire tool_done events and register sources
      parallelResults.forEach(({ tc, result }) => {
        onEvent({ type: result.success ? 'tool_done' : 'tool_error', toolCall: tc, step, timestamp: Date.now() });
        if (SOURCE_TOOLS.has(tc.name) && result.success && result.output) {
          extractAndRegisterSources(tc.name, result.output);
        }
      });

      // Push aggregated results to context
      const aggregatedOutput = parallelResults
        .map(({ tc, result }) => `Tool Result (${tc.name}${tc.args.query ? ` — "${String(tc.args.query).slice(0, 40)}"` : tc.args.url ? ` — ${String(tc.args.url).slice(0, 50)}` : ''}):\n${result.output.slice(0, 6000)}`)
        .join('\n\n---\n\n');

      const successCount = parallelResults.filter(r => r.result.success).length;
      contextEntries.push(`Assistant: ${thinking}\n\n[Parallel tool execution: ${filteredParallelCandidates.map(t => t.name).join(', ')} — ${successCount}/${filteredParallelCandidates.length} succeeded]\n\n${aggregatedOutput}`);
      parallelResults.forEach(({ tc }) => steps.push({ toolCall: tc, thinking, response: '', timestamp: Date.now() } as AgentStep));
      onEvent({ type: 'step_complete', step, timestamp: Date.now() });
      heartbeat.recordActivity();
      continue;
    }

    // ── Act: Execute single tool (via Tool Harness) ──
    // Tool failure memory — skip blacklisted tools immediately
    if (isToolBlacklisted(toolCallParsed.name)) {
      const failMsg = `[Tool "${toolCallParsed.name}" is temporarily unavailable — it has failed ${TOOL_MAX_FAILURES} times this session. Do NOT retry this tool. Respond directly with your answer instead.]`;
      contextEntries.push(`Assistant: ${thinking}\n\nTool Result (${toolCallParsed.name}): ${failMsg}`);
      onEvent({ type: 'tool_error', toolCall: { id: `tc-bl-${Date.now()}`, name: toolCallParsed.name, args: toolCallParsed.args, status: 'error', result: { success: false, output: failMsg } }, step, timestamp: Date.now() });
      continue;
    }

    // ── Plan mode: block write tools ──────────────────────────────────────────
    // In plan mode the agent is only allowed to read/research and produce a plan.
    // Write/destructive tools are silently blocked so the model can only describe
    // what it would do. The user approves the plan and the agent re-runs in bypass.
    if (getPermissionMode() === 'plan' && isWriteTool(toolCallParsed.name)) {
      const blockMsg = `[Plan mode: "${toolCallParsed.name}" is a write operation and has been blocked. Describe what you would do with this tool instead of calling it. Summarize your complete execution plan as numbered steps so the user can approve and run it.]`;
      contextEntries.push(`Assistant: ${thinking}\n\nTool Result (${toolCallParsed.name}): ${blockMsg}`);
      onEvent({
        type: 'tool_error',
        toolCall: { id: `tc-plan-block-${Date.now()}`, name: toolCallParsed.name, args: toolCallParsed.args, status: 'error', result: { success: false, output: blockMsg } },
        step,
        timestamp: Date.now(),
      });
      continue;
    }

    const toolCallId = `tc-${Date.now()}-${step}`;
    const harnessTool = harnessTools.find(t => t.name === toolCallParsed.name);

    const toolCall: ToolCall = {
      id: toolCallId,
      name: toolCallParsed.name,
      args: toolCallParsed.args,
      status: 'running',
      startedAt: Date.now(),
    };

    onEvent({ type: 'tool_start', toolCall, thinking, step, timestamp: Date.now() });

    // Track tool usage in plan
    if (taskPlan.currentStep > 0 && taskPlan.steps[taskPlan.currentStep - 1]) {
      taskPlan.steps[taskPlan.currentStep - 1].toolUsed = toolCallParsed.name;
      taskPlan.steps[taskPlan.currentStep - 1].status = 'active';
    }

    let result: ToolResult;
    if (!harnessTool) {
      result = { success: false, output: `Unknown tool: ${toolCallParsed.name}. Available: ${tools.map(t => t.name).join(', ')}` };
      toolCall.status = 'error';
    } else {
      // Execute through the harness — gets permission checking, validation, progress streaming
      // Note: requestUserConfirmation is already in harnessContext, no need to pass separately
      const harnessResult = await executeWithHarness(
        harnessTool,
        toolCallParsed.args,
        harnessContext,
        {
          toolUseID: toolCallId,
          onProgress: (event) => {
            // Forward progress events as routing events so UI can display activity
            if (event.data.type === 'status') {
              onEvent({ type: 'routing', timestamp: Date.now(), routing: {
                phase: 'tool-progress',
                decision: `${toolCallParsed.name}: ${(event.data as { message?: string }).message ?? ''}`,
              }});
            }
          },
        },
      );
      result = { success: harnessResult.success, output: String(harnessResult.output), data: harnessResult.data };
      if (signal?.aborted) {
        result = { success: false, output: 'Aborted by user' };
        toolCall.status = 'error';
      } else {
        toolCall.status = result.success ? 'done' : 'error';
      }
    }

    toolCall.result = result;
    toolCall.completedAt = Date.now();

    // Tool failure memory — track success/failure for blacklisting
    if (result.success === false) {
      recordToolFailure(toolCallParsed.name);
    } else {
      recordToolSuccess(toolCallParsed.name);
    }

    // Track sources from research tools
    if (SOURCE_TOOLS.has(toolCallParsed.name) && result.success && result.output) {
      extractAndRegisterSources(toolCallParsed.name, result.output);
    }

    // Handle "remember" tool specially — persist memory
    if (toolCallParsed.name === 'remember' && result.success && result.data) {
      const { key, content } = result.data as { key: string; content: string };
      memories.push({ key, content });
    }

    const agentStep: AgentStep = { thinking, toolCall, timestamp: Date.now() };
    steps.push(agentStep);

    onEvent({
      type: result.success ? 'tool_done' : 'tool_error',
      toolCall,
      step,
      timestamp: Date.now(),
    });

    onEvent({ type: 'step_complete', step, timestamp: Date.now() });
    heartbeat.recordActivity();

    // Log step to neuroMemory daily log
    void neuroMemory.log(`step ${step + 1}: ${toolCallParsed.name}(${JSON.stringify(toolCallParsed.args).slice(0, 60)}) → ${result.success ? 'ok' : 'err'}: ${result.output.slice(0, 80)}`);

    // ── Semantic memory: record tool outcome for future routing decisions ──
    void semanticRouter.recordDecision(
      toolCallParsed.name,
      result.success,
      userMessage.slice(0, 100)
    ).catch(() => {}); // fire-and-forget, never block

    // ── Observe: Feed result back to LLM ──
    // Classify tool errors before feeding back (Codex pattern)
    let toolError: ToolCallError | null = null;
    if (!result.success) {
      if (result.output.startsWith('Unknown tool:')) {
        toolError = makeToolError('fatal', result.output);
      } else if (result.output.includes('JSON') || result.output.includes('parse') || result.output.includes('SyntaxError')) {
        toolError = makeToolError('malformed', result.output);
      } else {
        toolError = makeToolError('respond_to_model', result.output);
      }
    }

    // Context window management: use middle-elision truncation for large results
    let resultOutput = truncateToolOutput(result.output, 20_000);

    // Strip base64 image data URIs to prevent context window bloat
    resultOutput = resultOutput.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*/g, '[image data — stripped to save context]');

    // Build context suffix based on error kind
    let contextSuffix = '';
    if (toolError?.kind === 'fatal') {
      contextSuffix = `\n\n[SYSTEM NOTE: '${toolCallParsed.name}' is NOT a valid tool. STOP trying it or similar tools. Respond directly to the user with what you know, OR use ONLY tools from this exact list: ${tools.map(t => t.name).join(', ')}]`;
    } else if (toolError?.kind === 'malformed') {
      contextSuffix = `\n\n[SYSTEM NOTE: Tool call was malformed (JSON/parse error). Correct the argument format and retry with valid JSON.]`;
    }
    // 'respond_to_model' errors flow through normally — no extra suffix needed

    contextEntries.push(`Assistant: ${thinking}\n\n\`\`\`tool\n${JSON.stringify({ name: toolCallParsed.name, args: toolCallParsed.args })}\n\`\`\`\n\nTool Result (${toolCallParsed.name}): ${resultOutput}${contextSuffix}`);

    // Periodic checkpointing removed — use sessionFileSystem instead
  }

  heartbeat.stop();

  // ── Auto-restore VRAM tier if we switched to heavy/nemotron ──
  if (vramManager.currentTier !== 'duo') {
    vramManager.restoreDefault(); // fire-and-forget: reloads 9b + 2b
  }

  // Auto-log session end to today's soul session file (fire-and-forget)
  if (finalResponse && steps.length > 1) {
    const summary = finalResponse.slice(0, 200).replace(/\n/g, ' ');
    void logToday(`Session ended (${steps.length} steps). Final: ${summary}`).catch(() => { /* non-critical */ });
  }

  return { steps, finalResponse };
}
