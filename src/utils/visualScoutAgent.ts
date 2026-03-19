// Visual Scout Agent — screenshots competitor URLs + analyzes with vision model
// Returns structured VisualFindings for downstream pipeline stages

import { ollamaService } from './ollama';
import { screenshotService, type ScreenshotResult } from './wayfayer';
import { recordResearchSource } from './researchAudit';
import { getVisionModel, getThinkMode } from './modelConfig';
import type { Campaign, VisualAnalysis, VisualFindings } from '../types';

const VISION_MODEL = getVisionModel();

// ─────────────────────────────────────────────────────────────
// Progress event types for live UI visibility
// ─────────────────────────────────────────────────────────────

export type VisualProgressEvent =
  | { type: 'screenshot_batch_start'; urls: string[] }
  | { type: 'screenshot_start'; url: string; index: number; total: number }
  | { type: 'screenshot_done'; url: string; index: number; total: number; thumbnail?: string; error?: string }
  | { type: 'analysis_start'; url: string; index: number; total: number }
  | { type: 'analysis_done'; url: string; index: number; total: number; findings: { tone?: string; colors?: string[]; layout?: string; insight?: string } }
  | { type: 'synthesis_start'; count: number }
  | { type: 'synthesis_done'; patterns: string[]; gaps: string[] }
  | { type: 'complete'; totalScreenshots: number; totalAnalyzed: number };

// ─────────────────────────────────────────────────────────────
// Single screenshot analysis
// ─────────────────────────────────────────────────────────────

async function analyzeScreenshot(
  screenshot: ScreenshotResult,
  campaign: Campaign,
  signal?: AbortSignal
): Promise<VisualAnalysis | null> {
  if (!screenshot.image_base64 || screenshot.error) return null;

  const prompt = `Competitor page for "${campaign.productDescription}". Extract exactly:
COLORS: [3-4 hex or named colors visible in hero/header/CTA]
LAYOUT: [hero-banner|split-screen|product-grid|long-scroll|minimal-centered]
TONE: [premium|clinical|playful|warm|edgy|trustworthy|corporate]
HERO: [what is the main visual — photo/illustration/video/gradient, subject matter]
SOCIAL_PROOF: [testimonials|star-ratings|badges|logos|user-counts|none]
TYPOGRAPHY: [headline style: bold-sans|elegant-serif|handwritten|minimal] [body: size estimate]
CTA: [button color] [text on button] [position: top|center|bottom|sticky] [shape: rounded|pill|square]
DIFFERENTIATOR: [1 sentence — what visual choice makes this brand stand out from others in this category]`;

  try {
    const result = await ollamaService.generateStream(
      prompt,
      'One line per label. No preamble. Exact values only.',
      {
        model: VISION_MODEL,
        temperature: 0.2,
        num_predict: 400,
        think: getThinkMode('vision'),
        images: [screenshot.image_base64],
        signal,
      }
    );

    return parseVisualAnalysis(result, screenshot.url);
  } catch (error) {
    console.error(`Visual analysis failed for ${screenshot.url}:`, error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Parse vision model output into structured VisualAnalysis
// ─────────────────────────────────────────────────────────────

function parseVisualAnalysis(output: string, url: string): VisualAnalysis {
  const extract = (key: string): string => {
    const match = output.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's'));
    return match?.[1]?.trim() || '';
  };

  const extractList = (key: string): string[] => {
    const value = extract(key);
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  };

  return {
    url,
    analysisTimestamp: Date.now(),
    dominantColors: extractList('COLORS'),
    layoutStyle: extract('LAYOUT'),
    visualTone: extract('TONE'),
    keyVisualElements: [...extractList('HERO'), ...extractList('SOCIAL_PROOF')].filter(Boolean),
    textOverlayStyle: extract('TYPOGRAPHY'),
    ctaStyle: extract('CTA'),
    overallImpression: extract('DIFFERENTIATOR'),
    competitiveInsight: extract('DIFFERENTIATOR'),
  };
}

// ─────────────────────────────────────────────────────────────
// Synthesize across all visual analyses (uses Qwen 3.5 for strategy)
// ─────────────────────────────────────────────────────────────

async function synthesizeVisualFindings(
  analyses: VisualAnalysis[],
  campaign: Campaign,
  signal?: AbortSignal
): Promise<{
  commonPatterns: string[];
  visualGaps: string[];
  recommendedDifferentiation: string[];
}> {
  const analysisText = analyses.map((a, i) =>
    `Competitor ${i + 1} (${a.url}):
     Colors: ${a.dominantColors.join(', ')}
     Layout: ${a.layoutStyle}
     Tone: ${a.visualTone}
     Key Elements: ${a.keyVisualElements.join(', ')}
     CTA: ${a.ctaStyle}
     Strategy: ${a.competitiveInsight}`
  ).join('\n\n');

  const prompt = `Visual strategy for ${campaign.brand} (${campaign.productDescription}).

${analysisText}

COMMON_PATTERNS:
- [what ALL/MOST competitors share visually]

VISUAL_GAPS:
- [what NONE do — unclaimed visual territory]

RECOMMENDED_DIFFERENTIATION:
- [how ${campaign.brand} should look DIFFERENT — specific choices]`;

  try {
    const result = await ollamaService.generateStream(
      prompt,
      'Bullet points only. Be specific — name colors, layouts, patterns. No preamble.',
      { model: 'qwen3.5:9b', temperature: 0.3, num_predict: 500, think: getThinkMode('strategy'), signal }
    );

    const extractSection = (key: string): string[] => {
      const match = result.match(new RegExp(`${key}:([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, 'i'));
      if (!match) return [];
      return match[1]
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(l => l.length > 5);
    };

    return {
      commonPatterns: extractSection('COMMON_PATTERNS'),
      visualGaps: extractSection('VISUAL_GAPS'),
      recommendedDifferentiation: extractSection('RECOMMENDED_DIFFERENTIATION'),
    };
  } catch {
    return { commonPatterns: [], visualGaps: [], recommendedDifferentiation: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// Analyze a single image with vision model (for reflector use)
// ─────────────────────────────────────────────────────────────

export async function analyzeImageWithVision(
  imageBase64: string,
  analysisPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  try {
    return await ollamaService.generateStream(
      analysisPrompt,
      'Structured output only. Format: WHAT: [subject/content] WHERE: [layout/placement] STYLE: [visual treatment] MOOD: [emotional tone]. No preamble.',
      {
        model: VISION_MODEL,
        temperature: 0.2,
        num_predict: 400,
        think: getThinkMode('vision'),
        images: [imageBase64],
        signal,
      }
    );
  } catch (error) {
    console.error('Vision analysis failed:', error);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Main Visual Scout Agent
// ─────────────────────────────────────────────────────────────

function emptyVisualFindings(): VisualFindings {
  return {
    competitorVisuals: [],
    commonPatterns: [],
    visualGaps: [],
    recommendedDifferentiation: [],
    analysisModel: VISION_MODEL,
    totalScreenshots: 0,
    totalAnalyzed: 0,
  };
}

export const visualScoutAgent = {
  /**
   * Screenshot competitor URLs and analyze with vision model:8b
   * Returns structured VisualFindings for downstream stages
   */
  async analyzeCompetitorVisuals(
    urls: string[],
    campaign: Campaign,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    onProgress?: (event: VisualProgressEvent) => void
  ): Promise<VisualFindings> {
    onChunk?.(`[Visual Scout] Screenshotting ${urls.length} competitor pages...\n`);
    onProgress?.({ type: 'screenshot_batch_start', urls });

    // Step 1: Take screenshots in batch — emit per-URL progress
    // We use individual screenshots to get per-URL events
    const screenshots: ScreenshotResult[] = [];
    for (let i = 0; i < urls.length; i++) {
      if (signal?.aborted) break;
      const url = urls[i];
      onProgress?.({ type: 'screenshot_start', url, index: i, total: urls.length });
      try {
        const result = await screenshotService.screenshot(url, { quality: 60 });
        screenshots.push(result);
        onProgress?.({
          type: 'screenshot_done',
          url,
          index: i,
          total: urls.length,
          thumbnail: result.image_base64 || undefined, // full base64 for live thumbnail display
          error: result.error ?? undefined,
        });
      } catch (err) {
        screenshots.push({ url, image_base64: '', error: String(err), width: 0, height: 0 });
        onProgress?.({
          type: 'screenshot_done',
          url,
          index: i,
          total: urls.length,
          error: String(err),
        });
      }
    }

    const validScreenshots = screenshots.filter(s => s.image_base64 && !s.error);
    onChunk?.(`[Visual Scout] Captured ${validScreenshots.length}/${urls.length} screenshots\n`);

    // Record visual sources in audit trail
    validScreenshots.forEach((ss) => {
      recordResearchSource({
        url: ss.url,
        query: 'Visual Scout — Competitor Analysis',
        source: 'visual',
      });
    });

    if (validScreenshots.length === 0) {
      onChunk?.(`[Visual Scout] No screenshots captured — skipping visual analysis\n`);
      onProgress?.({ type: 'complete', totalScreenshots: urls.length, totalAnalyzed: 0 });
      return emptyVisualFindings();
    }

    // Step 2: Analyze each screenshot sequentially with vision model
    const analyses: VisualAnalysis[] = [];
    for (let i = 0; i < validScreenshots.length; i++) {
      if (signal?.aborted) break;

      const ss = validScreenshots[i];
      onChunk?.(`[Visual Scout] Analyzing ${i + 1}/${validScreenshots.length}: ${ss.url.slice(0, 60)}...\n`);
      onProgress?.({ type: 'analysis_start', url: ss.url, index: i, total: validScreenshots.length });

      const analysis = await analyzeScreenshot(ss, campaign, signal);
      if (analysis) {
        analyses.push(analysis);
        onChunk?.(`[Visual Scout] → tone: ${analysis.visualTone}, colors: ${analysis.dominantColors.slice(0, 3).join(', ')}\n`);
        onProgress?.({
          type: 'analysis_done',
          url: ss.url,
          index: i,
          total: validScreenshots.length,
          findings: {
            tone: analysis.visualTone,
            colors: analysis.dominantColors,
            layout: analysis.layoutStyle,
            insight: analysis.competitiveInsight,
          },
        });
      }
    }

    onChunk?.(`[Visual Scout] Analyzed ${analyses.length} competitor visuals\n`);

    if (analyses.length === 0) {
      onProgress?.({ type: 'complete', totalScreenshots: urls.length, totalAnalyzed: 0 });
      return emptyVisualFindings();
    }

    // Step 3: Synthesize across all analyses
    onChunk?.(`[Visual Scout] Synthesizing visual competitive landscape...\n`);
    onProgress?.({ type: 'synthesis_start', count: analyses.length });
    const synthesis = await synthesizeVisualFindings(analyses, campaign, signal);

    if (synthesis.commonPatterns.length > 0) {
      onChunk?.(`[Visual Scout] Common patterns: ${synthesis.commonPatterns.slice(0, 2).join('; ')}\n`);
    }
    if (synthesis.visualGaps.length > 0) {
      onChunk?.(`[Visual Scout] Visual gaps found: ${synthesis.visualGaps.slice(0, 2).join('; ')}\n`);
    }

    onProgress?.({
      type: 'synthesis_done',
      patterns: synthesis.commonPatterns,
      gaps: synthesis.visualGaps,
    });
    onProgress?.({ type: 'complete', totalScreenshots: urls.length, totalAnalyzed: analyses.length });

    return {
      competitorVisuals: analyses,
      commonPatterns: synthesis.commonPatterns,
      visualGaps: synthesis.visualGaps,
      recommendedDifferentiation: synthesis.recommendedDifferentiation,
      analysisModel: VISION_MODEL,
      totalScreenshots: urls.length,
      totalAnalyzed: analyses.length,
    };
  },

  /**
   * Screenshot + analyze a single URL (for reflector ad-hoc use)
   */
  async analyzeSingleUrl(
    url: string,
    campaign: Campaign,
    signal?: AbortSignal
  ): Promise<VisualAnalysis | null> {
    const screenshot = await screenshotService.screenshot(url);
    if (!screenshot.image_base64 || screenshot.error) return null;
    return analyzeScreenshot(screenshot, campaign, signal);
  },
};
