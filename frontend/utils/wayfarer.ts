// Wayfayer — TypeScript client for the Wayfayer web research API
// Replaces the old searxng.ts (DuckDuckGo snippets) with full page scraping

import { INFRASTRUCTURE } from '../config/infrastructure';

export interface WayfayerPage {
  url: string;
  title: string;
  content: string;   // Full page text (not a snippet)
  snippet: string;   // Original search engine snippet
  source: string;    // "article" | "markdown" | "failed"
}

export interface WayfayerSource {
  url: string;
  title: string;
  snippet: string;
}

export interface WayfayerMeta {
  total: number;
  success: number;
  elapsed: number;
  error?: string | null;
}

export interface WayfayerResult {
  query: string;
  text: string;             // All pages concatenated with --- separators
  pages: WayfayerPage[];
  sources: WayfayerSource[];
  meta: WayfayerMeta;
}

const DEFAULT_HOST = INFRASTRUCTURE.wayfarerUrl;

function getHost(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('wayfarer_host');
    if (stored) return stored;
  }
  return DEFAULT_HOST;
}

// ── Health check state (cached, 1-minute TTL) ─────────────────────────────
let _wayfarerHealthy = true;
let _wayfarerLastCheck = 0;
const HEALTH_CHECK_INTERVAL = 60_000; // 1 minute

export async function checkWayfarerHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - _wayfarerLastCheck < HEALTH_CHECK_INTERVAL) return _wayfarerHealthy;
  _wayfarerLastCheck = now;
  try {
    const resp = await fetch(`${getHost()}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    _wayfarerHealthy = resp.ok;
  } catch {
    _wayfarerHealthy = false;
  }
  return _wayfarerHealthy;
}

export function isWayfarerHealthySync(): boolean {
  return _wayfarerHealthy;
}

/**
 * Check if Wayfarer is reachable. Convenience export for other modules.
 * Also updates the cached health state.
 */
export async function isWayfarerHealthy(): Promise<boolean> {
  return checkWayfarerHealth();
}

/**
 * Check if SearXNG is reachable.
 */
export async function isSearxngHealthy(): Promise<boolean> {
  try {
    const resp = await fetch(`${INFRASTRUCTURE.searxngUrl}/healthz`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch { return false; }
}

export const wayfarerService = {
  getHost,

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${getHost()}/health`, { signal: AbortSignal.timeout(5000) });
      return resp.ok;
    } catch {
      return false;
    }
  },

  async research(
    query: string,
    numResults: number = 10,
    signal?: AbortSignal,
    freshness?: 'any' | 'week' | 'month',
  ): Promise<WayfayerResult> {
    const body: Record<string, unknown> = {
      query,
      num_results: numResults,
      concurrency: 20,
      extract_mode: 'article',
    };
    if (freshness && freshness !== 'any') {
      body.time_range = freshness;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const resp = await fetch(`${getHost()}/research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });

        if (resp.status >= 500 && attempt < 2) {
          console.warn(`Wayfayer: HTTP ${resp.status} on attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (!resp.ok) {
          console.error(`Wayfayer error: ${resp.status} ${resp.statusText}`);
          return emptyResult(query);
        }

        try {
          return await resp.json();
        } catch {
          console.error('Wayfayer: non-JSON response from /research');
          return emptyResult(query);
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error as Error;
        if (attempt < 2) {
          console.warn(`Wayfayer fetch error on attempt ${attempt + 1}, retrying:`, error);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    console.error('Wayfayer fetch error (all attempts failed):', lastError);
    return emptyResult(query);
  },

  /** Batch crawl multiple URLs simultaneously (no search, direct fetch) */
  async batchCrawl(urls: string[], concurrency: number = 10, signal?: AbortSignal): Promise<BatchCrawlResult> {
    try {
      const resp = await fetch(`${getHost()}/crawl/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, concurrency, extract_mode: 'article' }),
        signal,
      });

      if (!resp.ok) {
        return { results: [], total: urls.length, success: 0 };
      }

      try {
        return await resp.json();
      } catch {
        console.error('Wayfayer: non-JSON response from /crawl/batch');
        return { results: [], total: urls.length, success: 0 };
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      console.error('Batch crawl error:', error);
      return { results: [], total: urls.length, success: 0 };
    }
  },
};

export interface CrawlPageResult {
  url: string;
  content: string;
  content_length: number;
  error: string | null;
}

export interface BatchCrawlResult {
  results: CrawlPageResult[];
  total: number;
  success: number;
}

function emptyResult(query: string): WayfayerResult {
  return {
    query,
    text: '',
    pages: [],
    sources: [],
    meta: { total: 0, success: 0, elapsed: 0, error: 'Wayfayer unavailable' },
  };
}

// ── Screenshot types + methods ──

export interface ScreenshotResult {
  url: string;
  image_base64: string;   // Raw base64 JPEG, no data: prefix
  width: number;
  height: number;
  error: string | null;
}

// ── Combined text + screenshot result ──

interface PageAnalysisResult {
  url: string;
  image_base64: string;
  width: number;
  height: number;
  page_text: {
    title?: string;
    h1?: string;
    price?: string;
    description?: string;
    ingredients?: string;
    fullText?: string;
    metaDescription?: string;
    structuredData?: unknown[];
  };
  error: string | null;
}

export const screenshotService = {
  async screenshot(url: string, options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    quality?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<ScreenshotResult> {
    try {
      // Build controller that combines user cancel + generous timeout (2 min)
      // Playwright needs time: cold browser launch + navigate + popup dismissal + render
      const timeout = options?.timeoutMs ?? 120000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      // Forward user abort to our controller
      if (options?.signal) {
        if (options.signal.aborted) {
          clearTimeout(timer);
          return { url, image_base64: '', width: 0, height: 0, error: 'Cancelled' };
        }
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      let resp: Response;
      try {
        resp = await fetch(`${getHost()}/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            viewport_width: options?.viewportWidth ?? 1280,
            viewport_height: options?.viewportHeight ?? 720,
            quality: options?.quality ?? 60,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) return { url, image_base64: '', width: 0, height: 0, error: `HTTP ${resp.status}` };
      return await resp.json();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('abort') || msg.includes('Abort') || msg.includes('timeout') || msg.includes('cancel')) {
        return { url, image_base64: '', width: 0, height: 0, error: 'Request timed out or cancelled' };
      }
      return { url, image_base64: '', width: 0, height: 0, error: msg };
    }
  },

  async screenshotBatch(urls: string[], options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    quality?: number;
    concurrency?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<ScreenshotResult[]> {
    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? 180000; // 3 min for batch Playwright
    const timer = setTimeout(() => controller.abort(), timeout);
    if (options?.signal) {
      if (options.signal.aborted) { clearTimeout(timer); return urls.map(u => ({ url: u, image_base64: '', width: 0, height: 0, error: 'Cancelled' })); }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      let resp: Response;
      try {
        resp = await fetch(`${getHost()}/screenshot/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls,
            viewport_width: options?.viewportWidth ?? 1280,
            viewport_height: options?.viewportHeight ?? 720,
            quality: options?.quality ?? 60,
            concurrency: options?.concurrency ?? 3,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) return urls.map(u => ({ url: u, image_base64: '', width: 0, height: 0, error: `HTTP ${resp.status}` }));
      try {
        const data = await resp.json();
        return data.screenshots;
      } catch {
        return urls.map(u => ({ url: u, image_base64: '', width: 0, height: 0, error: 'Non-JSON response from /screenshot/batch' }));
      }
    } catch (error) {
      return urls.map(u => ({ url: u, image_base64: '', width: 0, height: 0, error: String(error) }));
    }
  },

  /** Open an agentic page session — keeps page alive for scroll/click/evaluate */
  async sessionOpen(url: string, options?: {
    viewportWidth?: number; viewportHeight?: number; signal?: AbortSignal;
  }): Promise<{ session_id: string; url: string; image_base64: string; width: number; height: number; title: string; error: string | null }> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      if (options?.signal) {
        if (options.signal.aborted) { clearTimeout(timer); return { session_id: '', url, image_base64: '', width: 0, height: 0, title: '', error: 'Cancelled' }; }
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      let resp: Response;
      try {
        resp = await fetch(`${getHost()}/session/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, viewport_width: options?.viewportWidth ?? 1280, viewport_height: options?.viewportHeight ?? 900 }),
          signal: controller.signal,
        });
      } finally { clearTimeout(timer); }
      if (!resp.ok) return { session_id: '', url, image_base64: '', width: 0, height: 0, title: '', error: `HTTP ${resp.status}` };
      return await resp.json();
    } catch (error) {
      return { session_id: '', url, image_base64: '', width: 0, height: 0, title: '', error: String(error) };
    }
  },

  /** Perform action on active session (screenshot, scroll, click, evaluate, extract_text, find, navigate, hover) */
  async sessionAction(sessionId: string, action: string, opts?: {
    selector?: string; js?: string; scrollY?: number; clickX?: number; clickY?: number;
    quality?: number; signal?: AbortSignal;
  }): Promise<{ error: string | null; result: unknown; image_base64: string; title?: string; current_url?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000); // 60s per action
    if (opts?.signal) {
      if (opts.signal.aborted) { clearTimeout(timer); return { error: 'Cancelled', result: null, image_base64: '' }; }
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      let resp: Response;
      try {
        resp = await fetch(`${getHost()}/session/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            action,
            selector: opts?.selector ?? '',
            js: opts?.js ?? '',
            scroll_y: opts?.scrollY ?? 0,
            click_x: opts?.clickX ?? -1,
            click_y: opts?.clickY ?? -1,
            quality: opts?.quality ?? 60,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) return { error: `HTTP ${resp.status}`, result: null, image_base64: '' };
      try {
        return await resp.json();
      } catch {
        return { error: 'Non-JSON response from /session/action', result: null, image_base64: '' };
      }
    } catch (error) {
      return { error: String(error), result: null, image_base64: '' };
    }
  },

  /** Close an active session */
  async sessionClose(sessionId: string): Promise<void> {
    try { await fetch(`${getHost()}/session/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) }); } catch {}
  },

  /**
   * Combined text scrape + screenshot in a single Playwright session.
   * Gets both raw page text AND visual screenshot — no extra roundtrip.
   */
  async analyzePage(url: string, options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    quality?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<PageAnalysisResult> {
    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? 120000; // 2 min for Playwright analyze
    const timer = setTimeout(() => controller.abort(), timeout);
    if (options?.signal) {
      if (options.signal.aborted) { clearTimeout(timer); return { url, image_base64: '', width: 0, height: 0, page_text: {}, error: 'Cancelled' }; }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      let resp: Response;
      try {
        resp = await fetch(`${getHost()}/analyze-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            viewport_width: options?.viewportWidth ?? 1280,
            viewport_height: options?.viewportHeight ?? 1080,
            quality: options?.quality ?? 70,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) return { url, image_base64: '', width: 0, height: 0, page_text: {}, error: `HTTP ${resp.status}` };
      try {
        return await resp.json();
      } catch {
        return { url, image_base64: '', width: 0, height: 0, page_text: {}, error: 'Non-JSON response from /analyze-page' };
      }
    } catch (error) {
      return { url, image_base64: '', width: 0, height: 0, page_text: {}, error: String(error) };
    }
  },
};

// ── Product page analyzer (screenshot + vision + LLM) ──

import type { ProductPageAnalysis } from '../types';
import { ollamaService } from './ollama';
import { getModelForStage, getResearchModelConfig } from './modelConfig';
// wayfarer uses researcherSynthesisModel for product page parsing

async function parseProductPageVision(
  visionOutput: string,
  signal?: AbortSignal
): Promise<Partial<ProductPageAnalysis>> {
  // Parse vision output with GLM for structured extraction
  const extractionPrompt = `Parse this product page vision analysis into JSON.

Vision output:
${visionOutput}

Extract into JSON with these fields (use empty array/string if not found):
{
  "description": "2-3 sentence product description",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "pricing": [{"tier": "name", "price": "amount", "discount": "percentage"}],
  "testimonials": [{"text": "quote", "author": "name", "rating": 5}],
  "guarantees": ["guarantee text"],
  "features": ["feature1", "feature2"],
  "scents": ["scent1", "scent2"],
  "brand_messaging": "main brand tagline or positioning",
  "socialProof": [{"metric": "customers sold", "value": "200,000+"}]
}

Return ONLY valid JSON, no markdown, no code blocks.`;

  try {
    const response = await ollamaService.generateStream(
      extractionPrompt,
      'Extract product page data into structured JSON.',
      { model: getResearchModelConfig().researcherSynthesisModel, signal }
    );

    // Try to parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('LLM extraction failed:', error);
  }

  return {};
}

export async function analyzeProductPage(
  url: string,
  productName: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<ProductPageAnalysis> {
  const result: ProductPageAnalysis = {
    url,
    productName,
  };

  try {
    onProgress?.(`[Product Analysis] Analyzing ${url} (text + vision)...`);

    // Step 1: Combined text scrape + screenshot in one Playwright session
    const pageData = await screenshotService.analyzePage(url, {
      viewportWidth: 1280,
      viewportHeight: 1080,
      quality: 70,
    });

    if (pageData.error || !pageData.image_base64) {
      result.error = `Page analysis failed: ${pageData.error || 'empty image'}`;
      return result;
    }

    // Step 2: Build combined context from text scraping
    const textContext = buildTextContext(pageData.page_text);
    onProgress?.(`[Product Analysis] Got ${textContext.length} chars of page text + screenshot`);

    onProgress?.(`[Product Analysis] Running vision analysis...`);

    // Step 3: Vision analysis with text context enrichment
    const visionPrompt = `You are analyzing a product page screenshot for: "${productName}".
${textContext ? `\nPage text data (from HTML scraping):\n${textContext}\n` : ''}
Using BOTH the screenshot AND the text data above, extract ALL information:
1. PRODUCT_DESCRIPTION: What does this product do? (2-3 sentences)
2. INGREDIENTS: List ALL ingredients (check text data — ingredients often hidden below fold)
3. PRICING: All price tiers with discounts (format: "Tier Name - $XX - discount%")
4. TESTIMONIALS: Customer quotes with author names and ratings
5. GUARANTEES: Money-back guarantees or warranties
6. FEATURES: Key product features or benefits
7. SCENTS: Available scent options
8. BRAND_MESSAGING: Main tagline or brand promise
9. SOCIAL_PROOF: Customer counts, ratings, awards (format: "Metric: Value")

Format output with clear labels. Be thorough — combine what you see in the image with what's in the text data.`;

    const visionResponse = await ollamaService.generateStream(
      visionPrompt,
      'Extract product page information from screenshot and text data.',
      {
        model: getModelForStage('vision'),
        images: [pageData.image_base64],
        signal,
      }
    );

    result.visionRawOutput = visionResponse;
    onProgress?.(`[Product Analysis] Parsing with LLM...`);

    // Step 4: Parse vision output with LLM (include structured data if available)
    const structuredHint = pageData.page_text.structuredData?.length
      ? `\n\nJSON-LD structured data from page:\n${JSON.stringify(pageData.page_text.structuredData, null, 2).slice(0, 2000)}`
      : '';
    const parsed = await parseProductPageVision(visionResponse + structuredHint, signal);
    Object.assign(result, parsed);

    const counts = [
      parsed.ingredients?.length ? `${parsed.ingredients.length} ingredients` : null,
      parsed.pricing?.length ? `${parsed.pricing.length} pricing tiers` : null,
      parsed.features?.length ? `${parsed.features.length} features` : null,
      parsed.testimonials?.length ? `${parsed.testimonials.length} testimonials` : null,
    ].filter(Boolean).join(', ');

    onProgress?.(`[Product Analysis] Complete: ${counts || 'basic data extracted'}`);
    return result;
  } catch (error) {
    result.error = `Product analysis failed: ${String(error)}`;
    onProgress?.(`[Product Analysis] Error: ${result.error}`);
    return result;
  }
}

/**
 * Build text context from page scraping for vision enrichment.
 */
function buildTextContext(pageText: PageAnalysisResult['page_text']): string {
  const parts: string[] = [];

  if (pageText.h1) parts.push(`Product: ${pageText.h1}`);
  if (pageText.price) parts.push(`Price: ${pageText.price}`);
  if (pageText.description) parts.push(`Description: ${pageText.description}`);
  if (pageText.ingredients) parts.push(`Ingredients: ${pageText.ingredients}`);
  if (pageText.metaDescription) parts.push(`Meta: ${pageText.metaDescription}`);

  // Include structured data summary
  if (pageText.structuredData?.length) {
    for (const sd of pageText.structuredData) {
      const data = sd as Record<string, unknown>;
      if (data['@type'] === 'Product') {
        if (data.name) parts.push(`Structured Name: ${data.name}`);
        if (data.description) parts.push(`Structured Desc: ${String(data.description).slice(0, 300)}`);
        const offers = data.offers as Record<string, unknown> | undefined;
        if (offers?.price) parts.push(`Structured Price: $${offers.price}`);
        const rating = data.aggregateRating as Record<string, unknown> | undefined;
        if (rating) parts.push(`Rating: ${rating.ratingValue}/5 (${rating.reviewCount} reviews)`);
      }
    }
  }

  // Add truncated full text as fallback
  if (pageText.fullText && parts.length < 3) {
    parts.push(`Full page text (truncated):\n${pageText.fullText.slice(0, 3000)}`);
  }

  return parts.join('\n');
}

// ── Autonomous competitor intelligence system ──

import type { CrawledProduct, CompetitorProductIntelligence } from '../types';

interface CrawlLink {
  href: string;
  text: string;
}

/**
 * Crawl a URL and extract all links (uses Wayfayer /crawl endpoint with Playwright).
 */
async function crawlLinks(url: string, linkPattern?: string): Promise<CrawlLink[]> {
  try {
    let resp: Response;
    try {
      resp = await fetch(`${getHost()}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, link_pattern: linkPattern || '' }),
        signal: AbortSignal.timeout(30000), // 30s — Playwright page load
      });
    } catch {
      return [];
    }
    if (!resp.ok) return [];
    try {
      const data = await resp.json();
      return data.links || [];
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}

/**
 * Product URL patterns for common e-commerce platforms.
 */
const PRODUCT_URL_PATTERNS = [
  /\/products\/[a-z0-9-]+$/i,
  /\/product\/[a-z0-9-]+$/i,
  /\/item\/[a-z0-9-]+$/i,
  /\/p\/[a-z0-9-]+$/i,
];

const JUNK_URL_PATTERNS = [
  /#/,               // Anchors
  /javascript:/i,    // JS links
  /mailto:/i,        // Email links
  /\/cart/i,         // Cart pages
  /\/account/i,      // Account pages
  /\/login/i,        // Login pages
  /\/search/i,       // Search pages
];

const COLLECTION_PATHS = [
  '/collections/all',
  '/collections',
  '/products',
  '/shop',
  '/shop/all',
  '/all-products',
];

/**
 * Check if a URL looks like a real product page (not junk/nav links).
 */
function isProductUrl(url: string): boolean {
  if (JUNK_URL_PATTERNS.some(p => p.test(url))) return false;
  return PRODUCT_URL_PATTERNS.some(p => p.test(url));
}

/**
 * siteCrawler — Autonomously discovers product pages on a domain.
 *
 * Strategy (multi-layered):
 * 1. SearXNG search "site:domain /products/" → finds indexed product pages
 * 2. Crawl common collection paths (Shopify, WooCommerce, etc.)
 * 3. Crawl homepage for product links
 * 4. Deduplicate and return
 */
export async function siteCrawler(
  domain: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<CrawledProduct[]> {
  const startTime = Date.now();
  const allProducts = new Map<string, CrawledProduct>(); // url → product

  // Normalize domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseUrl = `https://${cleanDomain}`;

  onProgress?.(`[Site Crawler] Discovering products on ${cleanDomain}...`);

  // ── Strategy 1: SearXNG search for indexed product pages ──
  onProgress?.(`[Site Crawler] Searching for indexed product pages...`);
  try {
    const searchResult = await wayfarerService.research(
      `site:${cleanDomain} products`,
      15
    );
    if (searchResult.sources) {
      for (const source of searchResult.sources) {
        if (isProductUrl(source.url)) {
          const name = inferProductName(source.url, source.title);
          allProducts.set(source.url, { url: source.url, name });
        }
      }
    }
    onProgress?.(`[Site Crawler] Search found ${allProducts.size} product URLs`);
  } catch (err) {
    onProgress?.(`[Site Crawler] Search failed: ${err}`);
  }

  if (signal?.aborted) return Array.from(allProducts.values());

  // ── Strategy 2: Crawl collection/listing pages ──
  onProgress?.(`[Site Crawler] Crawling collection pages...`);
  const crawlPromises = COLLECTION_PATHS.map(async (path) => {
    const links = await crawlLinks(`${baseUrl}${path}`, '/products/[a-z]|/product/[a-z]');
    return links;
  });

  const crawlResults = await Promise.all(crawlPromises);
  for (const links of crawlResults) {
    for (const link of links) {
      if (isProductUrl(link.href) && !allProducts.has(link.href)) {
        const name = inferProductName(link.href, link.text);
        allProducts.set(link.href, { url: link.href, name });
      }
    }
  }
  onProgress?.(`[Site Crawler] After crawl: ${allProducts.size} total product URLs`);

  if (signal?.aborted) return Array.from(allProducts.values());

  // ── Strategy 3: Crawl homepage ──
  if (allProducts.size < 3) {
    onProgress?.(`[Site Crawler] Crawling homepage for more products...`);
    const homeLinks = await crawlLinks(baseUrl, '/products/|/product/');
    for (const link of homeLinks) {
      if (isProductUrl(link.href) && !allProducts.has(link.href)) {
        const name = inferProductName(link.href, link.text);
        allProducts.set(link.href, { url: link.href, name });
      }
    }
    onProgress?.(`[Site Crawler] After homepage: ${allProducts.size} total product URLs`);
  }

  const elapsed = Date.now() - startTime;
  onProgress?.(`[Site Crawler] Complete: ${allProducts.size} products found in ${(elapsed / 1000).toFixed(1)}s`);

  return Array.from(allProducts.values());
}

/**
 * Infer a product name from URL slug and link text.
 */
function inferProductName(url: string, linkText?: string): string {
  // Use link text if it's meaningful
  if (linkText) {
    const cleaned = linkText.replace(/\s+/g, ' ').trim();
    // Filter out noise like "BUY-$64.80$81.00"
    if (cleaned.length > 2 && cleaned.length < 100 && !/^\$|^BUY|^ADD/i.test(cleaned)) {
      return cleaned;
    }
  }

  // Fall back to URL slug
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split('/').filter(Boolean).pop() || 'Unknown';
    return slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return 'Unknown Product';
  }
}

/**
 * batchAnalyzeProducts — Parallel vision analysis of multiple product pages.
 *
 * 1. Batch screenshot all URLs (parallel via Wayfayer)
 * 2. Run vision model on each screenshot (sequential — model can only handle one at a time)
 * 3. Qwen 3.5 parse each vision output into structured data
 * 4. Return array of ProductPageAnalysis
 */
export async function batchAnalyzeProducts(
  products: CrawledProduct[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<ProductPageAnalysis[]> {
  if (products.length === 0) return [];

  onProgress?.(`[Batch Analysis] Analyzing ${products.length} products (text + vision)...`);

  // Analyze products sequentially (vision model bottleneck)
  // Each call uses the combo analyze-page endpoint for text + screenshot
  const results: ProductPageAnalysis[] = [];

  for (let i = 0; i < products.length; i++) {
    if (signal?.aborted) break;

    const product = products[i];
    onProgress?.(`[Batch Analysis] ${product.name} (${i + 1}/${products.length})...`);

    const analysis = await analyzeProductPage(
      product.url,
      product.name,
      (msg) => onProgress?.(`   ${msg}`),
      signal,
    );

    results.push(analysis);

    const counts = [
      analysis.features?.length ? `${analysis.features.length} features` : null,
      analysis.pricing?.length ? `${analysis.pricing.length} pricing` : null,
      analysis.ingredients?.length ? `${analysis.ingredients.length} ingredients` : null,
    ].filter(Boolean).join(', ');

    onProgress?.(`[Batch Analysis] ${product.name}: ${analysis.error ? 'FAILED' : counts || 'done'}`);
  }

  return results;
}

/**
 * analyzeCompetitor — Fully autonomous entry point.
 *
 * Pass a brand name → get complete product intelligence.
 *
 * 1. Searches for brand's website (via SearXNG)
 * 2. Crawls site for all product pages
 * 3. Batch analyzes products with vision
 * 4. Synthesizes competitive intelligence
 */
export async function analyzeCompetitor(
  brandName: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<CompetitorProductIntelligence> {
  const startTime = Date.now();

  const result: CompetitorProductIntelligence = {
    brand: brandName,
    domain: '',
    products: [],
    summary: { totalProducts: 0 },
    crawledUrls: [],
    visionAnalyzed: 0,
    elapsed: 0,
  };

  try {
    // ── Step 1: Find brand's website ──
    onProgress?.(`\n[Competitor Intel] Finding ${brandName} website...`);

    const searchResult = await wayfarerService.research(
      `"${brandName}" official website products`,
      5
    );

    // Find the most likely official domain from search results
    let domain = '';
    if (searchResult.sources && searchResult.sources.length > 0) {
      // Look for the brand name in the domain
      const brandSlug = brandName.toLowerCase().replace(/\s+/g, '');
      const match = searchResult.sources.find(s => {
        const host = new URL(s.url).hostname.toLowerCase();
        return host.includes(brandSlug) || host.includes(brandName.toLowerCase().replace(/\s+/g, '-'));
      });

      if (match) {
        domain = new URL(match.url).hostname;
      } else {
        // Fall back to first result
        domain = new URL(searchResult.sources[0].url).hostname;
      }
    }

    if (!domain) {
      result.error = `Could not find website for "${brandName}"`;
      result.elapsed = Date.now() - startTime;
      return result;
    }

    result.domain = domain;
    onProgress?.(`[Competitor Intel] Found domain: ${domain}`);

    if (signal?.aborted) { result.elapsed = Date.now() - startTime; return result; }

    // ── Step 2: Crawl for product pages ──
    onProgress?.(`[Competitor Intel] Crawling ${domain} for products...`);
    const products = await siteCrawler(domain, onProgress, signal);

    if (products.length === 0) {
      result.error = `No product pages found on ${domain}`;
      result.elapsed = Date.now() - startTime;
      return result;
    }

    result.crawledUrls = products.map(p => p.url);

    // Limit to top 8 products (avoid excessive API calls)
    const productsToAnalyze = products.slice(0, 8);
    onProgress?.(`[Competitor Intel] Analyzing ${productsToAnalyze.length} products (${products.length} found)...`);

    if (signal?.aborted) { result.elapsed = Date.now() - startTime; return result; }

    // ── Step 3: Batch analyze ──
    const analyses = await batchAnalyzeProducts(productsToAnalyze, onProgress, signal);
    result.products = analyses;
    result.visionAnalyzed = analyses.filter(a => a.visionRawOutput && !a.error).length;

    // ── Step 4: Synthesize summary ──
    onProgress?.(`[Competitor Intel] Synthesizing intelligence...`);
    result.summary = synthesizeCompetitorSummary(analyses, brandName);
    result.summary.totalProducts = products.length;

    result.elapsed = Date.now() - startTime;
    onProgress?.(`\n[Competitor Intel] COMPLETE: ${result.visionAnalyzed} products analyzed from ${domain} in ${(result.elapsed / 1000).toFixed(1)}s`);

  } catch (err) {
    result.error = `Competitor analysis failed: ${String(err)}`;
    result.elapsed = Date.now() - startTime;
    onProgress?.(`[Competitor Intel] FAILED: ${err}`);
  }

  return result;
}

/**
 * Synthesize competitive summary from multiple product analyses.
 */
function synthesizeCompetitorSummary(
  products: ProductPageAnalysis[],
  _brandName: string
): CompetitorProductIntelligence['summary'] {
  const validProducts = products.filter(p => !p.error);

  // Collect all prices
  const allPrices: number[] = [];
  for (const p of validProducts) {
    if (p.pricing) {
      for (const tier of p.pricing) {
        const price = parseFloat(tier.price?.replace(/[^0-9.]/g, '') || '0');
        if (price > 0) allPrices.push(price);
      }
    }
  }

  // Collect all ingredients
  const ingredientCounts = new Map<string, number>();
  for (const p of validProducts) {
    if (p.ingredients) {
      for (const ing of p.ingredients) {
        const key = ing.toLowerCase().trim();
        ingredientCounts.set(key, (ingredientCounts.get(key) || 0) + 1);
      }
    }
  }

  // Collect all features
  const featureCounts = new Map<string, number>();
  for (const p of validProducts) {
    if (p.features) {
      for (const feat of p.features) {
        const key = feat.toLowerCase().trim();
        featureCounts.set(key, (featureCounts.get(key) || 0) + 1);
      }
    }
  }

  // Collect guarantees
  const guarantees = new Set<string>();
  for (const p of validProducts) {
    if (p.guarantees) p.guarantees.forEach(g => guarantees.add(g));
  }

  // Collect social proof
  const socialProof = new Set<string>();
  for (const p of validProducts) {
    if (p.socialProof) p.socialProof.forEach(s => socialProof.add(`${s.metric}: ${s.value}`));
  }

  // Collect brand messaging
  const messaging = validProducts
    .filter(p => p.brand_messaging)
    .map(p => p.brand_messaging!)
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    totalProducts: validProducts.length,
    avgPrice: allPrices.length > 0
      ? `$${(allPrices.reduce((a, b) => a + b, 0) / allPrices.length).toFixed(2)}`
      : undefined,
    priceRange: allPrices.length > 0
      ? `$${Math.min(...allPrices).toFixed(2)} - $${Math.max(...allPrices).toFixed(2)}`
      : undefined,
    commonIngredients: Array.from(ingredientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ing]) => ing),
    commonFeatures: Array.from(featureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([feat]) => feat),
    brandPositioning: messaging.length > 0 ? messaging[0] : undefined,
    guarantees: Array.from(guarantees),
    socialProofHighlights: Array.from(socialProof),
  };
}

// ── Reddit PullPush integration ──

export interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  score: number;
  subreddit: string;
  created_utc: number;
  num_comments: number;
}

export interface RedditSearchResult {
  posts: RedditPost[];
  query: string;
  totalFound: number;
}

/**
 * Search Reddit via PullPush API — no auth required, free.
 * Best for: audience language, objections, social proof, complaints, reviews.
 * Uses api.pullpush.io which provides Reddit search without OAuth.
 */
export async function searchReddit(
  query: string,
  options: {
    size?: number;        // max results (default 10)
    minScore?: number;    // filter low-quality posts (default 5)
    subreddit?: string;   // optional subreddit filter
    after?: number;       // unix timestamp for recency filter
    signal?: AbortSignal;
  } = {}
): Promise<RedditSearchResult> {
  const { size = 10, minScore = 5, subreddit, after, signal } = options;

  const params = new URLSearchParams({
    q: query,
    size: String(Math.min(size, 25)),
    sort: 'score',
    sort_type: 'score',
  });
  if (subreddit) params.set('subreddit', subreddit);
  if (after) params.set('after', String(after));

  const url = `https://api.pullpush.io/reddit/submission/search?${params}`;

  try {
    const resp = await fetch(url, {
      signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) throw new Error(`PullPush HTTP ${resp.status}`);
    const data = await resp.json() as { data?: RedditPost[] };
    const posts = (data.data || []).filter(p => p.score >= minScore);
    return { posts, query, totalFound: posts.length };
  } catch (err) {
    console.warn(`[searchReddit] Failed for "${query}":`, err instanceof Error ? err.message : err);
    return { posts: [], query, totalFound: 0 };
  }
}

/**
 * Format Reddit results as text for LLM consumption.
 * Extracts key signals: titles, scores, key phrases from selftext.
 */
export function formatRedditResults(result: RedditSearchResult): string {
  if (result.posts.length === 0) return `No Reddit posts found for "${result.query}"`;

  const lines = [`Reddit: "${result.query}" — ${result.posts.length} posts\n`];
  for (const post of result.posts.slice(0, 8)) {
    lines.push(`r/${post.subreddit} [${post.score}↑] ${post.title}`);
    if (post.selftext && post.selftext.length > 50) {
      lines.push(`  ${post.selftext.slice(0, 200).replace(/\n/g, ' ')}...`);
    }
  }
  return lines.join('\n');
}

