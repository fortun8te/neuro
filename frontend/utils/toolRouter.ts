/**
 * toolRouter.ts — LLM-powered tool selection router.
 *
 * Called by the agent when it needs tools. Instead of dumping all 42 tools
 * into context, the agent describes what it needs and this router picks
 * the right subset.
 *
 * Uses a 2b model for fast, accurate tool selection (~300-600ms).
 */

import { ollamaService } from './ollama';
import { getModelForStage, getContextSize } from './modelConfig';

export interface ToolRequest {
  /** What the agent wants to accomplish */
  goal: string;
  /** Original user message for context */
  userMessage: string;
  /** Optional: what the agent has already done */
  previousTools?: string[];
}

export interface ToolSelection {
  /** Tool names to provide to the agent */
  tools: string[];
  /** Why these tools were selected */
  reasoning: string;
}

// All available tools grouped by category
const TOOL_CATALOG = `
SEARCH & WEB:
- web_search: Search the web, get results from multiple sources
- browse: Read full content of a specific URL
- multi_browse: Fetch multiple URLs in parallel (up to 10)
- scrape_page: Quick text extraction from a URL
- analyze_page: Screenshot + text extraction from a URL
- deep_research: Multi-query parallel research with synthesis

FILES & DOCUMENTS:
- file_read: Read a file from disk
- file_write: Write a file to disk
- file_find: Find files by name/pattern
- file_browse: List files in a directory
- create_docx: Generate a .docx Word document
- read_pdf: Extract text from PDF
- apply_patch: Targeted edit on a file

CODE:
- shell_exec: Run a shell command
- run_code: Run python/javascript/bash snippet

MEMORY:
- memory_store: Save a fact to persistent memory
- memory_search: Search persistent memory
- soul_read: Read identity/style/memory files
- soul_update: Update identity files

COMPUTER (visual browser interaction):
- use_computer: Browser automation — click, type, navigate visually
- control_desktop: Vision-driven desktop control

CONTENT:
- write_content: Write polished content (blog, email, ad copy, report)
- summarize: Condense long content
- extract_data: Extract structured data (JSON/table)
- image_analyze: Analyze an image with vision AI

AGENTS:
- spawn_agents: Run 1-5 parallel subagents
- spawn_worker: Start a background browser worker
- check_workers: Check status of background workers
- read_findings: Read results from worker blackboard
- send_instruction: Send message to a running worker

RESEARCH (compound):
- competitor_swot: Full competitor SWOT analysis (search + screenshot + synthesis)
- social_intelligence: Social media sentiment and discussion analysis
- google_trends: Check trending interest for topics/keywords
- brand_voice: Get or set brand voice profile

SYSTEM:
- soul_log: Append to daily session log
- wait: Pause execution for a specified duration

ALWAYS AVAILABLE (don't need to request):
- think, plan, ask_user, done, say
`;

const TOOL_ROUTER_PROMPT = `/nothink
You are a tool selection router. Pick the MINIMUM tools needed. Reply ONLY with valid JSON. No explanation outside JSON.

${TOOL_CATALOG}

ROUTING RULES (follow exactly):

SEARCH vs BROWSE vs COMPUTER:
- "search for X" / "look up X" / "find X" / "what is X" → web_search
- "go to [url]" / "read [url]" / "open [url] and read" → browse (just reading)
- "go to [url] and click/fill/sign up/screenshot/interact" → use_computer (needs visual)
- "click" / "fill form" / "sign up" / "log in" / "take screenshot" → use_computer
- Multiple URLs to read → multi_browse

MEMORY:
- "remember X" / "save X" / "note that X" → memory_store
- "what did I say about" / "recall" / "my preferences" → memory_search
- Both if unclear

FILES:
- "read file" / "open file" → file_read
- "write file" / "save file" → file_write
- "create doc/docx" → create_docx
- "read pdf" → read_pdf

CONTENT:
- "write a post/email/ad/report" → write_content + web_search (for research)
- "summarize this" → summarize

GENERAL:
- Pick FEWEST tools. 1-3 is ideal. Max 8.
- If task spans categories, include from each
- When unsure, include web_search as fallback

Output: {"tools":["tool1","tool2"],"reasoning":"one sentence why"}`;

/**
 * Ask the tool router which tools the agent needs.
 * Fast 2b model call, ~300-600ms.
 */
export async function selectTools(
  request: ToolRequest,
  signal?: AbortSignal,
): Promise<ToolSelection> {
  const defaultTools: ToolSelection = {
    tools: ['web_search', 'browse', 'summarize', 'file_read', 'write_content'],
    reasoning: 'fallback — general purpose tools',
  };

  try {
    let response = '';
    const prompt = request.previousTools?.length
      ? `Agent goal: "${request.goal}"\nUser said: "${request.userMessage}"\nAlready used: ${request.previousTools.join(', ')}\nWhat additional tools are needed?`
      : `Agent goal: "${request.goal}"\nUser said: "${request.userMessage}"\nWhat tools does the agent need?`;

    // Hard 8s timeout — tool routing must be fast. If Ollama is loading the
    // model we can't wait 120s; fall through to regex fallback instead.
    const routerController = new AbortController();
    const routerTimeout = setTimeout(() => routerController.abort(), 8000);
    if (signal) signal.addEventListener('abort', () => routerController.abort(), { once: true });
    try {
      await ollamaService.generateStream(
        prompt,
        TOOL_ROUTER_PROMPT,
        {
          model: getModelForStage('toolRouter'),
          temperature: 0.1,
          think: false,
          num_predict: 150,
          num_ctx: getContextSize('toolRouter'),
          signal: routerController.signal,
          onChunk: (c: string) => { response += c; },
        }
      );
    } finally {
      clearTimeout(routerTimeout);
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return defaultTools;

    const parsed = JSON.parse(jsonMatch[0]);
    const tools = Array.isArray(parsed.tools) ? parsed.tools.filter((t: unknown) => typeof t === 'string') : [];

    if (tools.length === 0) return defaultTools;

    return {
      tools,
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (err) {
    console.warn('[toolRouter] Failed, using fallback:', err);
    return defaultTools;
  }
}

/**
 * Quick tool selection for obvious cases — no LLM needed.
 * Returns null if LLM selection is needed.
 */
export function quickSelectTools(userMessage: string): ToolSelection | null {
  const lc = userMessage.toLowerCase().trim();

  // Pure greeting — exact match, fastest path
  if (/^(yo|hey|hi|hello|sup|gm|thanks|ok|cool|nice|bye|gn|hru|how are you|how r u|how are u|wyd|wya|whats up|what's up|wassup|wsg)\s*[!?.]*$/i.test(lc)) {
    return { tools: [], reasoning: 'greeting — no tools needed' };
  }

  // ── Specific tool patterns FIRST (before conversational catch-all) ──

  // Explicit memory
  if (/\b(memor|remember|recall|your (memories|notes)|what did i (say|tell)|my preference)\b/.test(lc)) {
    return { tools: ['memory_search', 'memory_store', 'soul_read'], reasoning: 'memory operation' };
  }

  // Explicit computer/visual interaction — clicking, forms, screenshots, visual browsing
  if (/\b(click|fill.*(form|field)|sign (up|in)|log ?in|take.?a?.?screenshot|use computer|open (chrome|safari|firefox|browser)|interact with|automate|fill out)\b/.test(lc)) {
    return { tools: ['use_computer', 'control_desktop'], reasoning: 'visual browser interaction' };
  }

  // "go to [url] and [action]" — if action implies interaction → computer, otherwise browse
  if (/\b(go to|navigate to|visit)\b/.test(lc) && /\.(com|org|net|io|ai|co|dev|app|xyz|me|gov|edu)\b/.test(lc)) {
    if (/\b(click|fill|sign|log|screenshot|interact|type|submit|select|check|search|enter|press|drag)\b/.test(lc)) {
      return { tools: ['use_computer', 'control_desktop'], reasoning: 'navigate + interact = computer' };
    }
    return { tools: ['browse', 'scrape_page'], reasoning: 'navigate + read = browse' };
  }

  // Explicit URL reading — "read/open [url]"
  if (/https?:\/\/\S+/.test(lc) && !/\b(click|fill|sign|screenshot)\b/.test(lc)) {
    const urls = lc.match(/https?:\/\/\S+/g) || [];
    if (urls.length > 1) return { tools: ['multi_browse', 'summarize'], reasoning: 'multiple URLs → multi_browse' };
    return { tools: ['browse', 'summarize'], reasoning: 'URL → browse' };
  }

  // Explicit web search — "search for", "search the web for", "look up", "find info", "what is"
  if (/\b(search\b.*\bfor|look up|google|find (info|out|me)|what (is|are|was|were) .{5,}|check the \w+)\b/.test(lc) && !/https?:\/\//.test(lc)) {
    return { tools: ['web_search', 'browse', 'summarize'], reasoning: 'search query → web_search' };
  }

  // Explicit docx
  if (/\b(docx|word doc|create.*(document|doc))\b/.test(lc)) {
    return { tools: ['create_docx', 'web_search', 'browse'], reasoning: 'document creation' };
  }

  // Explicit PDF — only match actual file ops, not descriptors like "PDF-ready" or "PDF format"
  if (/(\.(pdf)\b|read.*pdf|open.*pdf|parse.*pdf|extract.*from.*pdf|summarize.*pdf)\b/.test(lc)) {
    return { tools: ['read_pdf', 'extract_data', 'summarize'], reasoning: 'PDF operation' };
  }

  // Explicit code/shell
  if (/\b(run (this|code|script)|execute|shell|terminal|npm|pip|python|bash)\b/.test(lc)) {
    return { tools: ['shell_exec', 'run_code', 'file_read', 'file_write'], reasoning: 'code execution' };
  }

  // Subagents / parallel workers
  if (/\b(subagent|sub.?agent|spawn agent|launch agent|parallel agent|worker agent|5 agent|4 agent|3 agent|\d+ agent)\b/.test(lc) || /\b(launch|spawn|send|deploy)\b.*\b(agent|subagent|sub.?agent|worker|task)\b/.test(lc)) {
    return { tools: ['spawn_agents', 'web_search', 'multi_browse', 'browse', 'summarize'], reasoning: 'agent orchestration' };
  }

  // Browsing with typo tolerance (browse/browsing/webbrowsing/webbrwosing etc)
  if (/brows/.test(lc) && !/\b(click|fill|sign|screenshot)\b/.test(lc)) {
    return { tools: ['browse', 'multi_browse', 'scrape_page', 'summarize'], reasoning: 'browsing request' };
  }

  // ── Conversational catch-all LAST — only if nothing above matched ──
  // Short message + no action verbs = pure conversation, no tools needed.
  // This MUST be after all specific patterns so "what is quantum computing" hits search first.
  if (lc.length <= 150 && !/\b(search|find|look up|google|create|write|make|build|open|read|go to|navigate|browse|download|upload|run|execute|deploy|install|analyze|scrape|extract|summarize|generate|file|pdf|docx|click|fill|sign|screenshot|remember|save|code|script|shell|terminal|npm|pip|python|bash|compare|evaluate|check|research|strategy|swot|competitor|trends|report|document|email|blog|article|plan|implement|design|debug|fix|refactor|diagram|weather|launch|agent|spawn)\b/.test(lc) && !/brows/.test(lc)) {
    return { tools: [], reasoning: 'conversational — no tools needed' };
  }

  return null; // needs LLM router
}
