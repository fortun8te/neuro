/**
 * visualScoutAgent — Production Visual Intelligence System
 *
 * Analyzes competitor screenshots using Playwright + vision LLM.
 * - Batches screenshots (concurrency limit: 3)
 * - Extracts visual properties (colors, layout, tone, CTA)
 * - Identifies patterns across competitors
 * - Detects visual gaps and differentiation opportunities
 * - Maintains screenshot cache per URL
 */

import type {
  VisualFindings,
  CompetitorVisual,
  VisualPattern,
  VisualGap,
  RecommendedDifferentiation,
  VisualScoutEvent,
  ColorPalette,
  VisualScoutConfig,
} from '../types/visual';
import { screenshotService } from './wayfarer';
import { ollamaService } from './ollama';
import { INFRASTRUCTURE } from '../config/infrastructure';

// ─────────────────────────────────────────────────────────────
// Screenshot Cache — prevent duplicate fetches
// ─────────────────────────────────────────────────────────────

/**
 * In-memory cache for competitor website screenshots
 *
 * Stores base64 JPEG images + dimensions with 30-minute TTL.
 * Keyed by normalized hostname+pathname (safe filesystem-compatible string).
 *
 * Reduces duplicate Playwright screenshots during visual scouting rounds.
 * Entries automatically expire after CACHE_TTL_MS (30 min).
 *
 * Type: Map<string (cache key), {image_base64, width, height, timestamp}>
 */
const screenshotCache = new Map<string, {
  image_base64: string;
  width: number;
  height: number;
  timestamp: number;
}>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generates filesystem-safe cache key from URL
 *
 * Normalizes URL hostname + pathname into alphanumeric string.
 * Replaces non-alphanumeric characters with underscore.
 * Truncates to 100 chars to prevent cache key length issues.
 *
 * @param url - Competitor website URL (e.g., "https://example.com/pricing")
 * @returns string - Cache key (e.g., "example_com_pricing")
 *
 * Example:
 * ```
 * const key = getCacheKey("https://stripe.com/pricing?tab=usage");
 * // Returns: "stripe_com_pricing"
 * ```
 */
function getCacheKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/[^a-z0-9]/gi, '_').slice(0, 100);
  } catch {
    return url.slice(0, 100).replace(/[^a-z0-9]/gi, '_');
  }
}

/**
 * Retrieves screenshot from cache if available and not expired
 *
 * Checks TTL timestamp. If entry is older than 30 minutes, deletes and returns null.
 *
 * @param url - Competitor website URL
 * @returns {image_base64, width, height} | null - Cached screenshot or null if expired/missing
 *
 * Side effects:
 * - Deletes expired entries from cache
 * - No external I/O
 */
function getScreenshotFromCache(url: string) {
  const key = getCacheKey(url);
  const cached = screenshotCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }
  screenshotCache.delete(key);
  return null;
}

/**
 * Stores screenshot in cache with current timestamp
 *
 * Called after successful Playwright screenshot capture.
 * Entry will expire after CACHE_TTL_MS (30 min) on next getScreenshotFromCache() call.
 *
 * @param url - Competitor website URL
 * @param data - {image_base64, width, height} - Screenshot data
 *
 * Side effects:
 * - Writes to in-memory Map
 * - Increases memory usage by ~size of base64 image
 */
function setScreenshotCache(url: string, data: { image_base64: string; width: number; height: number }) {
  const key = getCacheKey(url);
  screenshotCache.set(key, { ...data, timestamp: Date.now() });
}

// ─────────────────────────────────────────────────────────────
// Screenshot Batch Function
// ─────────────────────────────────────────────────────────────

/**
 * Screenshots multiple competitor URLs with caching and parallelization
 *
 * Two-phase process:
 * 1. Check cache for all URLs, reuse cached screenshots
 * 2. Batch screenshot uncached URLs via Wayfarer (Playwright, concurrency 3)
 *
 * Results sorted to match original URL order for consistency.
 *
 * @param urls - Array of competitor website URLs to screenshot
 * @param config - VisualScoutConfig with viewport, quality, concurrency settings
 * @param onProgress - Optional callback for progress messages
 * @returns Array<{url, image_base64, width, height, error?}> - Screenshots in original URL order
 *
 * Side effects:
 * - Calls Wayfarer API (screenshotService.screenshotBatch)
 * - Updates screenshot cache with new entries
 * - May throw if config.signal (AbortSignal) is aborted
 *
 * Performance characteristics:
 * - Cache hits: O(n) lookup, immediate return
 * - Cache misses: ~20-40s for 5 URLs (3 concurrent Playwright instances)
 *
 * Example:
 * ```
 * const shots = await batchScreenshot(
 *   ["https://stripe.com", "https://paddle.com"],
 *   {maxScreenshotConcurrency: 3, viewportWidth: 1280},
 *   (msg) => console.log(msg)
 * );
 * // Returns: [{url: "https://stripe.com", image_base64: "...", width: 1280, height: 720}, ...]
 * ```
 */
async function batchScreenshot(
  urls: string[],
  config: VisualScoutConfig,
  onProgress?: (msg: string) => void,
): Promise<Array<{ url: string; image_base64: string; width: number; height: number; error?: string }>> {
  const results: Array<{ url: string; image_base64: string; width: number; height: number; error?: string }> = [];

  // Check cache first
  const uncached: string[] = [];
  for (const url of urls) {
    const cached = getScreenshotFromCache(url);
    if (cached) {
      results.push({ url, ...cached });
      onProgress?.(`[Visual Scout] Loaded ${url} from cache`);
    } else {
      uncached.push(url);
    }
  }

  // If all cached, return early
  if (uncached.length === 0) {
    return results.sort((a, b) => urls.indexOf(a.url) - urls.indexOf(b.url));
  }

  // Batch screenshot uncached URLs
  onProgress?.(`[Visual Scout] Screenshotting ${uncached.length} competitor pages (concurrency: ${config.maxScreenshotConcurrency || 3})`);

  try {
    const screenshots = await screenshotService.screenshotBatch(uncached, {
      viewportWidth: config.viewportWidth,
      viewportHeight: config.viewportHeight,
      quality: config.screenshotQuality,
      concurrency: config.maxScreenshotConcurrency || 3,
      signal: config.signal,
      timeoutMs: config.timeoutMs || 120000,
    });

    for (const screenshot of screenshots) {
      if (screenshot.error) {
        onProgress?.(`[Visual Scout] Failed to screenshot ${screenshot.url}: ${screenshot.error}`);
        results.push({ url: screenshot.url, image_base64: '', width: 0, height: 0, error: screenshot.error });
      } else {
        // Cache successful screenshot
        setScreenshotCache(screenshot.url, screenshot);
        results.push(screenshot);
        onProgress?.(`[Visual Scout] Captured ${screenshot.url}`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    onProgress?.(`[Visual Scout] Screenshot batch failed: ${msg}`);
    for (const url of uncached) {
      results.push({ url, image_base64: '', width: 0, height: 0, error: msg });
    }
  }

  // Sort results to match original URL order
  return results.sort((a, b) => urls.indexOf(a.url) - urls.indexOf(b.url));
}

// ─────────────────────────────────────────────────────────────
// Vision Analysis — Extract Visual Properties
// ─────────────────────────────────────────────────────────────

/**
 * Analyzes competitor website screenshot using vision LLM
 *
 * Sends base64 JPEG + structured prompt to qwen3.5:9b vision model.
 * Extracts 18 visual properties: colors, layout, tone, CTA, typography, insights.
 *
 * If screenshot is missing/empty, returns default partial result with confidence 0.
 * If vision analysis fails, returns default with low confidence but no error thrown.
 *
 * @param url - Competitor website URL (for reference in output)
 * @param screenshot_base64 - JPEG image data as base64 string
 * @param width - Screenshot viewport width in pixels
 * @param height - Screenshot viewport height in pixels
 * @param onChunk - Optional callback for streaming tokens from vision model
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise<Partial<CompetitorVisual>> - Visual properties extracted from screenshot
 *
 * Side effects:
 * - Calls Ollama generateStream API (ollamaService)
 * - May stream tokens to onChunk callback
 * - Respects AbortSignal if provided
 *
 * Extracted properties:
 * - dominantColors: {primary, secondary?, accent?, description}
 * - layoutPattern: 'hero-dominant|multi-section|grid-based|vertical-scroll|mixed|unknown'
 * - visualTone: 'professional|casual|premium|playful|minimalist|bold|unknown'
 * - ctaPresent: boolean, ctaStyle, ctaColor, ctaDescription
 * - headlineStyle, imageUsagePattern, competitiveInsight, differentiationOpportunity
 * - confidence: 0-1 (vision model's self-assessed confidence)
 *
 * ⚠️ IMPORTANT: Graceful degradation. If vision analysis fails, returns partial
 * default result with low confidence rather than throwing. Prevents one bad screenshot
 * from breaking entire visual scouting round.
 *
 * Example:
 * ```
 * const visual = await analyzeScreenshotWithVision(
 *   "https://stripe.com",
 *   "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
 *   1280, 720,
 *   (chunk) => console.log(chunk)
 * );
 * // Returns: {url, dominantColors, layoutPattern, visualTone, confidence: 0.85, ...}
 * ```
 */
async function analyzeScreenshotWithVision(
  url: string,
  screenshot_base64: string,
  width: number,
  height: number,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<Partial<CompetitorVisual>> {
  if (!screenshot_base64 || screenshot_base64.length === 0) {
    return {
      url,
      screenshot_width: width,
      screenshot_height: height,
      analysisTimestamp: Date.now(),
      dominantColors: { primary: '#999999', description: 'Screenshot failed' },
      layoutPattern: 'unknown',
      layoutDescription: 'Screenshot failed',
      visualTone: 'unknown',
      toneDescription: 'Screenshot failed',
      keyVisualElements: [],
      ctaPresent: false,
      competitiveInsight: 'Unable to analyze due to screenshot failure',
      analysisModel: 'unknown',
      confidence: 0,
    };
  }

  const visionPrompt = `Analyze this competitor website screenshot and extract visual intelligence.

Return JSON (no markdown, no backticks) with exactly these fields:
{
  "primary_color": "#rrggbb",
  "secondary_color": "#rrggbb",
  "accent_color": "#rrggbb",
  "layout_pattern": "hero-dominant|multi-section|grid-based|vertical-scroll|mixed|unknown",
  "layout_description": "2-3 sentence description of layout structure",
  "tone": "professional|casual|premium|playful|minimalist|bold|unknown",
  "tone_description": "2-3 sentences describing the visual tone and brand personality",
  "key_elements": ["element1", "element2", "element3"],
  "cta_present": true/false,
  "cta_style": "button|text-link|image-link|mixed|unknown",
  "cta_color": "#rrggbb or null",
  "cta_description": "2-3 words describing CTA placement and style",
  "image_pattern": "hero-image|product-focus|lifestyle|minimal|mixed",
  "headline_style": "bold-large|elegant|modern|playful|unknown",
  "competitive_insight": "2-3 sentence strategic insight about this competitor's positioning",
  "differentiation_opportunity": "1-2 sentence opportunity to differentiate from this approach",
  "confidence": 0.0 to 1.0
}`;

  let analysisResult: Partial<CompetitorVisual> = {
    url,
    screenshot_width: width,
    screenshot_height: height,
    analysisTimestamp: Date.now(),
    dominantColors: { primary: '#999999' },
    layoutPattern: 'unknown',
    layoutDescription: '',
    visualTone: 'unknown',
    toneDescription: '',
    keyVisualElements: [],
    ctaPresent: false,
    competitiveInsight: '',
    analysisModel: 'qwen3.5:9b',
    confidence: 0.5,
  };

  let responseText = '';

  try {
    // Stream vision analysis from LLM
    await ollamaService.generateStream(
      visionPrompt,
      'Extract visual intelligence from website screenshots. Return valid JSON only.',
      {
        model: 'qwen3.5:9b',
        images: [screenshot_base64],
        temperature: 0.3,
        signal,
        onChunk: (chunk) => {
          responseText += chunk;
          onChunk?.(chunk);
        },
      },
    );

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);

        const colorPalette: ColorPalette = {
          primary: json.primary_color || '#999999',
          secondary: json.secondary_color,
          accent: json.accent_color,
          description: `Primary: ${json.primary_color}, Secondary: ${json.secondary_color || 'none'}, Accent: ${json.accent_color || 'none'}`,
        };

        analysisResult = {
          url,
          screenshot_base64,
          screenshot_width: width,
          screenshot_height: height,
          analysisTimestamp: Date.now(),
          dominantColors: colorPalette,
          secondaryColors: json.secondary_color ? [json.secondary_color] : [],
          accentColor: json.accent_color,
          layoutPattern: json.layout_pattern || 'unknown',
          layoutDescription: json.layout_description || '',
          heroPresent: (json.layout_pattern || '').includes('hero'),
          visualTone: json.tone || 'unknown',
          toneDescription: json.tone_description || '',
          keyVisualElements: Array.isArray(json.key_elements) ? json.key_elements : [],
          imageUsagePattern: json.image_pattern,
          ctaPresent: json.cta_present || false,
          ctaStyle: json.cta_style,
          ctaColor: json.cta_color,
          ctaDescription: json.cta_description,
          headlineStyle: json.headline_style,
          competitiveInsight: json.competitive_insight || '',
          differentiationOpportunity: json.differentiation_opportunity,
          analysisModel: 'qwen3.5:9b',
          confidence: json.confidence || 0.7,
          visionRawOutput: responseText.slice(0, 500), // Store first 500 chars for debugging
        };
      } catch (parseErr) {
        console.error('[Visual Scout] JSON parse error:', parseErr, 'Raw:', jsonMatch[0].slice(0, 200));
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Visual Scout] Vision analysis failed:', msg);
    analysisResult.competitiveInsight = `Analysis failed: ${msg}`;
    analysisResult.confidence = 0;
  }

  return analysisResult;
}

// ─────────────────────────────────────────────────────────────
// Pattern Analysis — Aggregate Findings
// ─────────────────────────────────────────────────────────────

function analyzeVisualPatterns(visuals: CompetitorVisual[]): {
  patterns: VisualPattern[];
  gaps: VisualGap[];
  colorPalettes: ColorPalette[];
  layouts: string[];
  tones: string[];
  ctas: string[];
} {
  const patterns: VisualPattern[] = [];
  const gaps: VisualGap[] = [];

  // Count layout patterns
  const layoutCounts: Record<string, string[]> = {};
  const toneCounts: Record<string, string[]> = {};
  const ctaCounts: Record<string, string[]> = {};
  const colorPatterns: ColorPalette[] = [];

  for (const visual of visuals) {
    // Aggregate layouts
    if (!layoutCounts[visual.layoutPattern]) layoutCounts[visual.layoutPattern] = [];
    layoutCounts[visual.layoutPattern].push(visual.url);

    // Aggregate tones
    if (!toneCounts[visual.visualTone]) toneCounts[visual.visualTone] = [];
    toneCounts[visual.visualTone].push(visual.url);

    // Aggregate CTAs
    if (visual.ctaStyle && !ctaCounts[visual.ctaStyle]) ctaCounts[visual.ctaStyle] = [];
    if (visual.ctaStyle) ctaCounts[visual.ctaStyle].push(visual.url);

    // Collect color palettes
    if (visual.dominantColors.primary) {
      colorPatterns.push(visual.dominantColors);
    }
  }

  // Create pattern objects
  for (const [layout, urls] of Object.entries(layoutCounts)) {
    if (layout !== 'unknown') {
      const freq = Math.round((urls.length / visuals.length) * 100);
      patterns.push({
        pattern: `${layout} layout`,
        category: 'layout',
        frequency: freq,
        competitors: urls,
        evidence: urls.slice(0, 2),
        strength: freq >= 60 ? 'dominant' : freq >= 40 ? 'common' : freq >= 20 ? 'emerging' : 'rare',
      });
    }
  }

  for (const [tone, urls] of Object.entries(toneCounts)) {
    if (tone !== 'unknown') {
      const freq = Math.round((urls.length / visuals.length) * 100);
      patterns.push({
        pattern: `${tone} tone`,
        category: 'tone',
        frequency: freq,
        competitors: urls,
        evidence: urls.slice(0, 2),
        strength: freq >= 60 ? 'dominant' : freq >= 40 ? 'common' : freq >= 20 ? 'emerging' : 'rare',
      });
    }
  }

  for (const [cta, urls] of Object.entries(ctaCounts)) {
    const freq = Math.round((urls.length / visuals.length) * 100);
    patterns.push({
      pattern: `${cta} CTA style`,
      category: 'cta',
      frequency: freq,
      competitors: urls,
      evidence: urls.slice(0, 2),
      strength: freq >= 60 ? 'dominant' : freq >= 40 ? 'common' : 'emerging',
    });
  }

  // Identify gaps
  const allTones = Object.keys(toneCounts);
  const unused: Record<string, string> = {
    'premium': 'Luxury/premium positioning',
    'playful': 'Playful, approachable brand voice',
    'minimalist': 'Minimalist, clean aesthetic',
    'bold': 'Bold, high-contrast design',
  };

  for (const [tone, desc] of Object.entries(unused)) {
    if (!allTones.includes(tone) && tone !== 'unknown') {
      gaps.push({
        gap: `${tone} visual identity`,
        evidence: `No competitors are using a ${tone} tone`,
        opportunity: `Differentiate by adopting a distinctive ${tone} aesthetic`,
        impactLevel: 'high',
        category: 'tone',
      });
    }
  }

  // Layout gaps
  const layouts = Object.keys(layoutCounts);
  if (layouts.length === 1 && !layouts.includes('unknown')) {
    gaps.push({
      gap: 'Alternative layout pattern',
      evidence: `All analyzed competitors use ${layouts[0]} layout`,
      opportunity: 'Stand out with a contrasting layout approach (e.g., hero-dominant if all are grid-based)',
      impactLevel: 'high',
      category: 'layout',
    });
  }

  return {
    patterns,
    gaps,
    colorPalettes: colorPatterns.slice(0, 5),
    layouts: Object.keys(layoutCounts),
    tones: Object.keys(toneCounts),
    ctas: Object.keys(ctaCounts),
  };
}

// ─────────────────────────────────────────────────────────────
// Main Visual Scout Agent
// ─────────────────────────────────────────────────────────────

export const visualScoutAgent = {
  async analyzeCompetitorVisuals(
    urls: string[],
    _campaign: unknown,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal,
    onEvent?: (event: VisualScoutEvent) => void,
  ): Promise<VisualFindings> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!urls || urls.length === 0) {
        onProgress?.('[Visual Scout] No URLs provided');
        return {
          competitorVisuals: [],
          commonPatterns: [],
          visualGaps: [],
          recommendedDifferentiation: [],
          dominantColorPalettes: [],
          mostCommonLayout: '',
          mostCommonTone: '',
          mostCommonCTAStyle: '',
          analysisModel: 'qwen3.5:9b',
          totalScreenshots: 0,
          totalAnalyzed: 0,
          analysisStartTime: startTime,
          analysisEndTime: Date.now(),
        };
      }

      const config: VisualScoutConfig = {
        urls,
        maxConcurrency: 3,
        maxScreenshotConcurrency: 3,
        signal,
      };

      onEvent?.({ type: 'start', message: `Analyzing ${urls.length} competitor URLs`, timestamp: Date.now() });

      // Step 1: Batch screenshot
      onProgress?.(`[Visual Scout] Starting visual analysis on ${urls.length} competitor pages`);
      onEvent?.({ type: 'screenshotting', message: `Capturing screenshots`, timestamp: Date.now() });

      const screenshots = await batchScreenshot(urls, config, onProgress);
      const successfulScreenshots = screenshots.filter(s => !s.error);

      onProgress?.(`[Visual Scout] Got ${successfulScreenshots.length}/${urls.length} screenshots`);

      // Step 2: Analyze each screenshot with vision model
      onProgress?.('[Visual Scout] Analyzing with vision model (qwen3.5:9b)');
      onEvent?.({ type: 'analyzing', message: `Vision analysis in progress`, timestamp: Date.now() });

      const visuals: CompetitorVisual[] = [];

      for (const screenshot of successfulScreenshots) {
        if (signal?.aborted) break;

        const visual = await analyzeScreenshotWithVision(
          screenshot.url,
          screenshot.image_base64,
          screenshot.width,
          screenshot.height,
          (chunk) => onProgress?.(`[Visual Scout Vision] ${chunk.slice(0, 80)}`),
          signal,
        );

        visuals.push(visual as CompetitorVisual);
        onProgress?.(`[Visual Scout] Analyzed ${screenshot.url}`);
      }

      // Step 3: Aggregate patterns
      const { patterns, gaps, colorPalettes, layouts, tones, ctas } = analyzeVisualPatterns(visuals);

      onProgress?.(`[Visual Scout] Identified ${patterns.length} patterns and ${gaps.length} gaps`);

      // Step 4: Generate differentiation recommendations
      const recommendations: RecommendedDifferentiation[] = [];

      if (tones.length > 0) {
        recommendations.push({
          dimension: 'tone',
          recommendation: `Adopt a distinctive tone: consider ${tones.includes('premium') ? 'premium' : tones.includes('playful') ? 'playful' : 'bold'} positioning`,
          rationale: `Most competitors use ${tones.slice(0, 2).join(', ')} tones. Differentiate with an underused approach.`,
          competitors_avoiding: tones.filter(t => !['professional', 'premium'].includes(t)),
          confidence: 0.85,
        });
      }

      if (layouts.length > 0 && !layouts.includes('hero-dominant')) {
        recommendations.push({
          dimension: 'layout',
          recommendation: 'Lead with a hero section to immediately capture attention',
          rationale: `No competitors use a hero-dominant layout. This creates immediate visual impact.`,
          competitors_avoiding: urls.slice(0, 3),
          confidence: 0.8,
        });
      }

      if (colorPalettes.length > 0) {
        const primaryColors = colorPalettes.map(p => p.primary).filter(c => c && c !== '#999999');
        const uniqueColor = primaryColors.length > 0 ? primaryColors[0] : null;

        recommendations.push({
          dimension: 'color',
          recommendation: `Use a distinctive color palette. Consider colors not heavily used by competitors.`,
          rationale: `Most competitors cluster around similar colors. Break through with a complementary palette.`,
          competitors_avoiding: urls.slice(0, 2),
          confidence: 0.75,
          implementation_examples: uniqueColor ? [uniqueColor] : undefined,
        });
      }

      // Emit synthesis events for progress UI
      onEvent?.({
        type: 'synthesis_done',
        message: `Found ${patterns.length} visual patterns and ${gaps.length} gaps`,
        patterns: patterns.map(p => p.pattern),
        gaps: gaps.map(g => g.gap),
        colorPatterns: colorPalettes,
        timestamp: Date.now(),
      } as any);

      const findings: VisualFindings = {
        competitorVisuals: visuals,
        commonPatterns: patterns,
        visualGaps: gaps,
        recommendedDifferentiation: recommendations,
        dominantColorPalettes: colorPalettes.slice(0, 3),
        mostCommonLayout: layouts[0] || 'mixed',
        mostCommonTone: tones[0] || 'professional',
        mostCommonCTAStyle: ctas[0] || 'button',
        analysisModel: 'qwen3.5:9b',
        totalScreenshots: screenshots.length,
        totalAnalyzed: visuals.length,
        analysisStartTime: startTime,
        analysisEndTime: Date.now(),
      };

      onEvent?.({
        type: 'complete',
        message: `Visual analysis complete: ${visuals.length} analyzed, ${patterns.length} patterns`,
        timestamp: Date.now(),
      });

      onProgress?.(
        `[Visual Scout] Analysis complete: ${visuals.length} sites analyzed, ${patterns.length} patterns, ${gaps.length} gaps, ${recommendations.length} recommendations`,
      );

      return findings;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onProgress?.(`[Visual Scout] Error: ${msg}`);
      onEvent?.({
        type: 'error',
        message: msg,
        timestamp: Date.now(),
      });

      return {
        competitorVisuals: [],
        commonPatterns: [],
        visualGaps: [],
        recommendedDifferentiation: [],
        dominantColorPalettes: [],
        mostCommonLayout: '',
        mostCommonTone: '',
        mostCommonCTAStyle: '',
        analysisModel: 'qwen3.5:9b',
        totalScreenshots: 0,
        totalAnalyzed: 0,
        analysisStartTime: startTime,
        analysisEndTime: Date.now(),
      };
    }
  },
};
