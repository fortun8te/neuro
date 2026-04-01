/**
 * massResearch — traditional Wayfarer scraping + LLM summarization pipeline.
 *
 * NOT browser automation. Hits 10-500 sites in parallel via Wayfarer,
 * has qwen3.5:2b summarize each page, then qwen3.5:4b synthesizes.
 */

import { INFRASTRUCTURE } from '../config/infrastructure';
import { ollamaService } from './ollama';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ResearchSource {
  url: string;
  title: string;
  summary: string;
  rawLength: number;
}

export interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  synthesis: string;
  totalSources: number;
  elapsed: number;
}

export type ResearchProgressEvent =
  | { type: 'generating_queries' }
  | { type: 'searching'; queries: string[] }
  | { type: 'found_urls'; count: number }
  | { type: 'fetching'; total: number }
  | { type: 'summarizing'; total: number }
  | { type: 'summarizing_page'; index: number; url: string }
  | { type: 'synthesizing' }
  | { type: 'done'; result: ResearchResult };

export interface MassResearchOptions {
  maxSources?: number;         // default 20
  maxSearchQueries?: number;   // default 5
  signal?: AbortSignal;
  onProgress?: (event: ResearchProgressEvent) => void;
}

// ─────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────

export async function runMassResearch(
  goal: string,
  options: MassResearchOptions = {},
): Promise<ResearchResult> {
  const { maxSources = 20, maxSearchQueries = 5, signal, onProgress } = options;
  const t0 = Date.now();

  // Step 1: Generate search queries via qwen3.5:2b
  onProgress?.({ type: 'generating_queries' });
  const queries = await generateSearchQueries(goal, maxSearchQueries, signal);

  // Step 2: Search SearXNG for URLs
  onProgress?.({ type: 'searching', queries });
  const allUrls: string[] = [];
  const perQuery = Math.ceil(maxSources / queries.length);
  for (const query of queries) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const results = await searchSearXNG(query, perQuery);
    allUrls.push(...results.map(r => r.url));
  }
  const uniqueUrls = [...new Set(allUrls)].slice(0, maxSources);
  onProgress?.({ type: 'found_urls', count: uniqueUrls.length });

  if (uniqueUrls.length === 0) {
    return {
      query: goal,
      sources: [],
      synthesis: 'No sources found. SearXNG or Wayfarer may be unavailable.',
      totalSources: 0,
      elapsed: Date.now() - t0,
    };
  }

  // Step 3: Batch fetch via Wayfarer /research endpoint (parallel scraping)
  onProgress?.({ type: 'fetching', total: uniqueUrls.length });
  const pages = await batchFetchWayfarer(uniqueUrls, signal);

  const validPages = pages.filter(p => p.text.length > 50);
  if (validPages.length === 0) {
    return {
      query: goal,
      sources: [],
      synthesis: 'Fetched pages but none had enough content to summarize.',
      totalSources: 0,
      elapsed: Date.now() - t0,
    };
  }

  // Step 4: Summarize each page with qwen3.5:2b (parallel, batched)
  onProgress?.({ type: 'summarizing', total: validPages.length });
  const BATCH_SIZE = 8;
  const summaries: ResearchSource[] = [];
  for (let i = 0; i < validPages.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = validPages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((page, batchIdx) => {
        const idx = i + batchIdx;
        onProgress?.({ type: 'summarizing_page', index: idx, url: page.url });
        return summarizePage(page, goal, signal);
      })
    );
    summaries.push(...batchResults);
  }

  // Step 5: Synthesize with qwen3.5:4b
  onProgress?.({ type: 'synthesizing' });
  const synthesis = await synthesizeFindings(goal, summaries, signal);

  const result: ResearchResult = {
    query: goal,
    sources: summaries,
    synthesis,
    totalSources: summaries.length,
    elapsed: Date.now() - t0,
  };

  onProgress?.({ type: 'done', result });
  return result;
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

async function generateSearchQueries(
  goal: string,
  count: number,
  signal?: AbortSignal,
): Promise<string[]> {
  let result = '';
  try {
    await ollamaService.generateStream(
      `Generate ${count} diverse search queries for researching: "${goal}"\n\nReturn ONLY a JSON array of strings, no explanation, no markdown.\nExample: ["query 1", "query 2"]`,
      'You are a search query generator. Output valid JSON only.',
      {
        model: 'qwen3.5:2b',
        temperature: 0.4,
        num_predict: 300,
        think: false,
        signal,
        onChunk: (chunk) => { result += chunk; },
      },
    );
    // Extract JSON array from response (handle markdown fences)
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String).slice(0, count);
      }
    }
  } catch {
    // fallback
  }
  return [goal];
}

async function searchSearXNG(
  query: string,
  limit: number,
): Promise<Array<{ url: string; title: string }>> {
  try {
    const resp = await fetch(
      `${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || [])
      .slice(0, limit)
      .map((r: { url?: string; title?: string }) => ({
        url: r.url || '',
        title: r.title || '',
      }))
      .filter((r: { url: string }) => r.url.length > 0);
  } catch {
    return [];
  }
}

interface FetchedPage {
  url: string;
  title: string;
  text: string;
}

async function batchFetchWayfarer(
  urls: string[],
  signal?: AbortSignal,
): Promise<FetchedPage[]> {
  // Use Wayfarer's /crawl/batch endpoint for direct URL fetching
  try {
    const resp = await fetch(`${INFRASTRUCTURE.wayfarerUrl}/crawl/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        concurrency: INFRASTRUCTURE.wayfarerConcurrency,
        extract_mode: 'article',
      }),
      signal,
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || []).map((r: { url?: string; content?: string; title?: string }) => ({
      url: r.url || '',
      title: r.title || '',
      text: (r.content || '').slice(0, 4000),
    }));
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error('[massResearch] batchFetchWayfarer error:', err);
    return [];
  }
}

async function summarizePage(
  page: FetchedPage,
  goal: string,
  signal?: AbortSignal,
): Promise<ResearchSource> {
  let summary = '';
  try {
    await ollamaService.generateStream(
      `Summarize this page in 2-3 sentences, focusing on information relevant to: "${goal}"\n\nPage title: ${page.title}\nContent:\n${page.text.slice(0, 2500)}`,
      'You are a research assistant. Be concise and extract only relevant facts.',
      {
        model: 'qwen3.5:2b',
        temperature: 0.2,
        num_predict: 150,
        think: false,
        signal,
        onChunk: (chunk) => { summary += chunk; },
      },
    );
  } catch {
    summary = page.text.slice(0, 200) + '...';
  }
  return {
    url: page.url,
    title: page.title,
    summary: summary.trim() || 'No summary generated.',
    rawLength: page.text.length,
  };
}

async function synthesizeFindings(
  goal: string,
  summaries: ResearchSource[],
  signal?: AbortSignal,
): Promise<string> {
  let result = '';
  const context = summaries
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.summary}`)
    .join('\n\n');
  try {
    await ollamaService.generateStream(
      `Based on these ${summaries.length} sources, provide a comprehensive answer to: "${goal}"\n\nSources:\n${context}\n\nSynthesize the key findings into a clear, well-organized response. Cite source numbers [1], [2], etc.`,
      'You are a research analyst. Synthesize multiple sources into a clear, direct answer. Use en dashes -- not hyphens for punctuation.',
      {
        model: 'qwen3.5:4b',
        temperature: 0.4,
        num_predict: 800,
        think: false,
        signal,
        onChunk: (chunk) => { result += chunk; },
      },
    );
  } catch {
    result = summaries.map((s, i) => `[${i + 1}] ${s.title}: ${s.summary}`).join('\n\n');
  }
  return result.trim();
}
