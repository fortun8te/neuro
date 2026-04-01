/**
 * subagentTools.ts — Tool definitions available to subagents in the ReAct loop.
 *
 * Extracted from subagentManager.ts so they can be imported independently,
 * tested, or extended without touching the core manager.
 */

import { wayfarerService, screenshotService } from './wayfarer';
import { ollamaService } from './ollama';
import { getContextSize } from './modelConfig';

// ── Parallel-safety classification ────────────────────────────────────────
export const PARALLEL_SAFE_TOOLS = new Set([
  'web_search', 'browse', 'scrape_page', 'multi_browse', 'summarize',
  'extract_data', 'image_analyze', 'analyze_page',
]);

// ── Tool interface ─────────────────────────────────────────────────────────

export interface SubagentToolDef {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<string>;
}

// ── Tool registry ──────────────────────────────────────────────────────────

export function getSubagentTools(): SubagentToolDef[] {
  return [
    {
      name: 'web_search',
      description: 'Search the web for information. Returns search results with snippets and page content.',
      parameters: {
        query: 'string — the search query',
        max_results: 'number (optional, default 5) — how many results to fetch',
      },
      async execute(args, signal) {
        const query = String(args.query || '');
        if (!query) return '[Error] web_search requires a "query" argument.';
        const maxResults = typeof args.max_results === 'number' ? args.max_results : 5;
        try {
          const result = await wayfarerService.research(query, maxResults, signal);
          if (!result.sources.length && !result.text) {
            return `[web_search] No results found for: "${query}"`;
          }
          const sourcesList = result.sources.slice(0, maxResults).map(
            (s, i) => `${i + 1}. ${s.title}\n   ${s.url}\n   ${s.snippet}`,
          ).join('\n');
          const textPreview = result.text.slice(0, 3000);
          return `[web_search] Results for "${query}" (${result.meta.success}/${result.meta.total} pages):\n\nSources:\n${sourcesList}\n\nExtracted content:\n${textPreview}`;
        } catch (err) {
          if (signal?.aborted) throw err;
          return `[web_search] Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },

    {
      name: 'browse',
      description: 'Navigate to a specific URL and extract its text content.',
      parameters: { url: 'string — the URL to visit' },
      async execute(args, signal) {
        const url = String(args.url || '');
        if (!url) return '[Error] browse requires a "url" argument.';
        try {
          const result = await wayfarerService.batchCrawl([url], 1, signal);
          const page = result.results[0];
          if (!page || page.error) {
            return `[browse] Failed to load ${url}: ${page?.error || 'unknown error'}`;
          }
          return `[browse] Content from ${url} (${page.content_length} chars):\n${page.content.slice(0, 4000)}`;
        } catch (err) {
          if (signal?.aborted) throw err;
          return `[browse] Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },

    {
      name: 'multi_browse',
      description: 'Browse multiple URLs simultaneously. More efficient than calling browse multiple times.',
      parameters: { urls: 'string[] — array of URLs to visit' },
      async execute(args, signal) {
        const urls = Array.isArray(args.urls) ? args.urls.map(String) : [];
        if (!urls.length) return '[Error] multi_browse requires a "urls" array argument.';
        try {
          const result = await wayfarerService.batchCrawl(urls, 5, signal);
          const summaries = result.results.map((page, i) => {
            if (page.error) return `${i + 1}. ${page.url} — ERROR: ${page.error}`;
            return `${i + 1}. ${page.url} (${page.content_length} chars):\n${page.content.slice(0, 1500)}`;
          });
          return `[multi_browse] Fetched ${result.success}/${result.total} pages:\n\n${summaries.join('\n---\n')}`;
        } catch (err) {
          if (signal?.aborted) throw err;
          return `[multi_browse] Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },

    {
      name: 'scrape_page',
      description: 'Scrape a page with full rendering (Playwright). Gets both text content and visual analysis. More thorough than browse but slower.',
      parameters: { url: 'string — the URL to scrape' },
      async execute(args, signal) {
        const url = String(args.url || '');
        if (!url) return '[Error] scrape_page requires a "url" argument.';
        try {
          const result = await screenshotService.analyzePage(url, {
            viewportWidth: 1280,
            viewportHeight: 900,
            quality: 50,
            signal,
            timeoutMs: 30000,
          });
          if (result.error) {
            return `[scrape_page] Error scraping ${url}: ${result.error}`;
          }
          const textParts: string[] = [];
          const pt = result.page_text as Record<string, unknown>;
          if (pt) {
            if (pt.title) textParts.push(`Title: ${pt.title}`);
            if (pt.meta_description) textParts.push(`Description: ${pt.meta_description}`);
            if (pt.headings) textParts.push(`Headings: ${JSON.stringify(pt.headings).slice(0, 500)}`);
            if (pt.body_text) textParts.push(`Body: ${String(pt.body_text).slice(0, 3000)}`);
          }
          return `[scrape_page] Scraped ${url}:\n${textParts.join('\n') || '(no text extracted)'}`;
        } catch (err) {
          if (signal?.aborted) throw err;
          return `[scrape_page] Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },

    {
      name: 'summarize',
      description: 'Summarize a long block of text into key points. Useful for condensing research before final output.',
      parameters: {
        text: 'string — the text to summarize',
        focus: 'string (optional) — what aspect to focus the summary on',
      },
      async execute(args, signal) {
        const text = String(args.text || '');
        if (!text || text.length < 50) return '[Error] summarize requires a "text" argument with substantial content.';
        const focus = args.focus ? ` Focus on: ${args.focus}` : '';
        try {
          const summary = await ollamaService.generateStream(
            `Summarize the following text into concise key points.${focus}\n\nText:\n${text.slice(0, 6000)}`,
            'You are a concise summarizer. Output only the summary, nothing else. Use bullet points.',
            { num_predict: 500, num_ctx: getContextSize('subagent'), signal },
          );
          return `[summarize] ${summary}`;
        } catch (err) {
          if (signal?.aborted) throw err;
          return `[summarize] Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
  ];
}

/** Build the tool description block to inject into the subagent system prompt */
export function buildToolDescriptions(tools: SubagentToolDef[]): string {
  const lines = tools.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `    "${k}": ${v}`)
      .join('\n');
    return `- **${t.name}**: ${t.description}\n  Parameters:\n${params}`;
  });
  return `You have access to the following tools. To use a tool, output a tool call block in this exact format:

\`\`\`tool
{
  "name": "tool_name",
  "args": { "param": "value" }
}
\`\`\`

Available tools:
${lines.join('\n\n')}

You may call ONE tool per response. After calling a tool, you will receive the result and can then decide to call another tool or provide your final answer. If you don't need any tools, just respond directly with your findings.`;
}

/**
 * Parse a tool call from subagent LLM output.
 * Supports \`\`\`tool blocks, <tool_call> XML, and raw JSON with "name" field.
 */
export function parseSubagentToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  // Strip think tags
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 1. ```tool ... ``` blocks (primary format)
  const toolBlockMatch = stripped.match(/```tool\s*\n?([\s\S]*?)```/);
  if (toolBlockMatch) {
    try {
      const parsed = JSON.parse(toolBlockMatch[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: parsed.name, args: parsed.args || {} };
      }
    } catch { /* fall through */ }
  }

  // 2. <tool_call>...</tool_call> XML blocks
  const xmlMatch = stripped.match(/<tool[_-]?call[^>]*>([\s\S]*?)<\/tool[_-]?call>/i);
  if (xmlMatch) {
    try {
      const parsed = JSON.parse(xmlMatch[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: parsed.name, args: parsed.args || parsed.arguments || parsed.parameters || {} };
      }
    } catch { /* fall through */ }
  }

  // 3. Raw JSON with "name" field (last resort)
  const jsonMatch = stripped.match(/\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: parsed.name, args: parsed.args || parsed.arguments || {} };
      }
    } catch { /* not valid json */ }
  }

  return null;
}
