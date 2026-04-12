/**
 * Image Analyzer Service — Vision model analysis of images
 *
 * Analyzes images using vision-capable models:
 * - Colors and color psychology
 * - Packaging design and materials
 * - Brand tone and aesthetic
 * - Design style classification
 * - Target demographic appeal
 * - Competitive differentiation
 *
 * Supports multiple input formats:
 * - URL (fetches directly)
 * - Base64 (from imageDownloader)
 * - File path
 */

import { ollamaService } from '../utils/ollama';
import { createLogger } from '../utils/logger';
import { getCachedImage, downloadImage } from './imageDownloader';

const log = createLogger('image-analyzer');

export interface ColorAnalysis {
  hex: string;
  rgb: string;
  name: string;
  psychology: string;
  usage: 'dominant' | 'accent' | 'supporting';
}

export interface PackagingAnalysis {
  material: string;
  shape: string;
  minimalism_score: number;  // 0-10, 10 = ultra minimal
  premium_score: number;      // 0-10, 10 = luxury
  sustainability: string;     // eco-friendly assessment
  unique_features: string[];
}

export interface BrandToneAnalysis {
  adjectives: string[];
  personality: string;
  confidence: number;  // 0-1
}

export interface DesignStyleAnalysis {
  primary_style: string;  // modern, retro, natural, tech, luxury, minimal, playful, etc
  secondary_styles: string[];
  era_feel: string;  // contemporary, timeless, vintage, futuristic
  cultural_elements?: string[];
}

export interface VisualFindings {
  url: string;
  analyzed_at: number;
  color_palette: ColorAnalysis[];
  packaging: PackagingAnalysis;
  tone: BrandToneAnalysis;
  design_style: DesignStyleAnalysis;
  target_audience: {
    demographics: string;
    psychographics: string;
    emotions_evoked: string[];
  };
  differentiation: {
    unique_aspects: string[];
    competitive_advantages: string[];
    improvement_opportunities: string[];
  };
  summary: string;
}

const VISION_MODEL = 'local:gemma4:e2b';  // Use local vision model for speed
const FALLBACK_MODEL = 'qwen3.5:9b';      // Fallback if vision model unavailable

/**
 * Analyze image from URL
 */
export async function analyzeImageUrl(
  url: string,
  options?: {
    model?: string;
    signal?: AbortSignal;
    onChunk?: (chunk: string) => void;
  }
): Promise<VisualFindings> {
  try {
    // Download image first
    const cached = await downloadImage(url, {
      timeout: 45_000,
      maxBytes: 10 * 1024 * 1024,  // 10MB for vision
      signal: options?.signal,
    });

    return analyzeImageBase64(cached.base64, url, options);
  } catch (err) {
    log.error('Failed to analyze image URL', { url }, err);
    throw new Error(`Image analysis failed for ${url}: ${err}`);
  }
}

/**
 * Analyze image from base64
 */
export async function analyzeImageBase64(
  base64: string,
  sourceUrl?: string,
  options?: {
    model?: string;
    signal?: AbortSignal;
    onChunk?: (chunk: string) => void;
  }
): Promise<VisualFindings> {
  const model = options?.model || VISION_MODEL;
  const sourceUrl_ = sourceUrl || 'base64-image';

  try {
    log.info(`Analyzing image with model ${model}`);

    const prompt = `You are a visual branding expert analyzing a product image.

ANALYZE THIS IMAGE AND PROVIDE A JSON RESPONSE WITH:

1. COLOR_PALETTE: Array of 3-5 dominant colors with:
   - hex: hex code
   - rgb: rgb values
   - name: color name
   - psychology: 1 sentence on color psychology
   - usage: "dominant" | "accent" | "supporting"

2. PACKAGING: If visible, analyze:
   - material: glass, plastic, cardboard, metal, etc
   - shape: describe shape/silhouette
   - minimalism_score: 0-10 (10 = ultra minimal)
   - premium_score: 0-10 (10 = luxury feeling)
   - sustainability: eco-friendly assessment
   - unique_features: array of distinctive design elements

3. BRAND_TONE: What personality does this convey?
   - adjectives: array of 5-7 adjectives
   - personality: one sentence summary
   - confidence: 0-1 how confident you are

4. DESIGN_STYLE: Classify the visual style
   - primary_style: modern, retro, natural, tech, luxury, minimal, playful, bohemian, corporate, artisanal, etc
   - secondary_styles: array of 0-3 additional style elements
   - era_feel: contemporary, timeless, vintage, futuristic
   - cultural_elements: if present, what cultural/regional aesthetic

5. TARGET_AUDIENCE: Who is this designed for?
   - demographics: age range, gender, lifestyle
   - psychographics: values, aspirations, lifestyle
   - emotions_evoked: array of 3-5 emotions

6. DIFFERENTIATION: Competitive analysis
   - unique_aspects: what makes this stand out
   - competitive_advantages: vs typical products in category
   - improvement_opportunities: what could be enhanced

7. SUMMARY: 2-3 sentences capturing the overall brand essence from this image

RETURN VALID JSON ONLY. NO MARKDOWN CODE BLOCKS.`;

    // Stream analysis with vision model
    let fullResponse = '';

    await new Promise<void>((resolve, reject) => {
      ollamaService.generateStream(
        prompt,
        'Analyze product image for brand research',
        {
          model,
          images: [base64],
          temperature: 0.3,
          num_predict: 1500,
          signal: options?.signal,
          onChunk: (chunk) => {
            fullResponse += chunk;
            options?.onChunk?.(chunk);
          },
          onComplete: resolve,
          onError: reject,
        }
      );
    });

    // Parse JSON response
    const parsed = parseAnalysisResponse(fullResponse);

    const findings: VisualFindings = {
      url: sourceUrl_,
      analyzed_at: Date.now(),
      color_palette: parsed.color_palette || [],
      packaging: parsed.packaging || {
        material: 'unknown',
        shape: 'unknown',
        minimalism_score: 5,
        premium_score: 5,
        sustainability: 'unknown',
        unique_features: [],
      },
      tone: parsed.tone || {
        adjectives: [],
        personality: 'Unable to determine',
        confidence: 0.3,
      },
      design_style: parsed.design_style || {
        primary_style: 'contemporary',
        secondary_styles: [],
        era_feel: 'contemporary',
      },
      target_audience: parsed.target_audience || {
        demographics: 'Unknown',
        psychographics: 'Unknown',
        emotions_evoked: [],
      },
      differentiation: parsed.differentiation || {
        unique_aspects: [],
        competitive_advantages: [],
        improvement_opportunities: [],
      },
      summary: parsed.summary || 'Image analysis incomplete',
    };

    log.info(`Image analysis complete: ${sourceUrl_}`);
    return findings;
  } catch (err) {
    log.error('Image analysis failed', { sourceUrl: sourceUrl_ }, err);
    throw err;
  }
}

/**
 * Batch analyze multiple images
 */
export async function analyzeImageBatch(
  images: Array<{ url: string; label?: string }>,
  options?: {
    concurrency?: number;
    signal?: AbortSignal;
    onProgress?: (progress: { completed: number; total: number; url: string }) => void;
  }
): Promise<VisualFindings[]> {
  const { concurrency = 2, signal, onProgress } = options || {};
  const results: VisualFindings[] = [];

  // Process in batches to avoid overwhelming model
  const chunks = chunkArray(images, concurrency);
  let completed = 0;

  for (const chunk of chunks) {
    if (signal?.aborted) break;

    const promises = chunk.map(async img => {
      try {
        const analysis = await analyzeImageUrl(img.url, { signal });
        onProgress?.({ completed: ++completed, total: images.length, url: img.url });
        return analysis;
      } catch (err) {
        log.warn(`Failed to analyze ${img.url}`, {}, err);
        onProgress?.({ completed: ++completed, total: images.length, url: img.url });
        return null;
      }
    });

    const batch = await Promise.all(promises);
    results.push(...batch.filter((r): r is VisualFindings => r !== null));
  }

  return results;
}

/**
 * Compare multiple images and extract common patterns
 */
export async function compareVisualPatterns(
  findings: VisualFindings[]
): Promise<{
  common_colors: string[];
  common_styles: string[];
  common_tones: string[];
  design_trends: string[];
  gaps: string[];
}> {
  if (findings.length === 0) {
    return {
      common_colors: [],
      common_styles: [],
      common_tones: [],
      design_trends: [],
      gaps: [],
    };
  }

  const colorFreq = new Map<string, number>();
  const styleFreq = new Map<string, number>();
  const toneFreq = new Map<string, number>();

  // Aggregate data
  for (const finding of findings) {
    // Colors
    for (const color of finding.color_palette) {
      colorFreq.set(color.name, (colorFreq.get(color.name) || 0) + 1);
    }

    // Styles
    if (finding.design_style.primary_style) {
      styleFreq.set(
        finding.design_style.primary_style,
        (styleFreq.get(finding.design_style.primary_style) || 0) + 1
      );
    }

    // Tones
    for (const adj of finding.tone.adjectives) {
      toneFreq.set(adj, (toneFreq.get(adj) || 0) + 1);
    }
  }

  // Get top items (appearing in 50%+ of images)
  const threshold = Math.ceil(findings.length * 0.5);
  const common_colors = Array.from(colorFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([color]) => color)
    .slice(0, 5);

  const common_styles = Array.from(styleFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([style]) => style)
    .slice(0, 3);

  const common_tones = Array.from(toneFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([tone]) => tone)
    .slice(0, 5);

  // Identify gaps (things NOT being done by competitors)
  const design_trends = identifyTrends(findings);
  const gaps = identifyGaps(findings, design_trends);

  return {
    common_colors,
    common_styles,
    common_tones,
    design_trends,
    gaps,
  };
}

// ── Helper functions ────────────────────────────────────────────────────────

function parseAnalysisResponse(response: string): Partial<VisualFindings> {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('No JSON found in response');
      return {};
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      color_palette: normalizeColors(data.COLOR_PALETTE || []),
      packaging: data.PACKAGING,
      tone: data.BRAND_TONE,
      design_style: data.DESIGN_STYLE,
      target_audience: data.TARGET_AUDIENCE,
      differentiation: data.DIFFERENTIATION,
      summary: data.SUMMARY,
    };
  } catch (err) {
    log.warn('Failed to parse analysis response', {}, err);
    return {};
  }
}

function normalizeColors(colors: any[]): ColorAnalysis[] {
  if (!Array.isArray(colors)) return [];

  return colors.map(c => ({
    hex: c.hex || '#000000',
    rgb: c.rgb || 'rgb(0, 0, 0)',
    name: c.name || 'Unknown',
    psychology: c.psychology || '',
    usage: c.usage || 'dominant',
  }));
}

function identifyTrends(findings: VisualFindings[]): string[] {
  const trends: string[] = [];

  // Minimalism trend
  const avgMinimalism = findings.reduce((sum, f) => sum + (f.packaging?.minimalism_score || 5), 0) /
    findings.length;
  if (avgMinimalism > 7) trends.push('Ultra-minimalist design');
  else if (avgMinimalism > 6) trends.push('Minimalist aesthetic');

  // Premium positioning
  const avgPremium = findings.reduce((sum, f) => sum + (f.packaging?.premium_score || 5), 0) /
    findings.length;
  if (avgPremium > 7) trends.push('Luxury positioning');

  // Common style themes
  const primaryStyles = findings
    .map(f => f.design_style.primary_style)
    .filter(Boolean);
  const styleMode = getMostFrequent(primaryStyles);
  if (styleMode) trends.push(`${styleMode} design style prevalent`);

  return trends;
}

function identifyGaps(findings: VisualFindings[], trends: string[]): string[] {
  const gaps: string[] = [];

  // If all are minimalist, gap is maximalist/expressive
  if (trends.some(t => t.includes('minimalist'))) {
    gaps.push('Opportunity for bold, expressive design');
  }

  // If all are premium, gap is accessible/playful
  if (trends.some(t => t.includes('Luxury'))) {
    gaps.push('Opportunity for approachable, friendly positioning');
  }

  // If all use same colors, gap is differentiation
  const colorGaps = findings.filter(f => !f.color_palette?.length);
  if (colorGaps.length > 0) {
    gaps.push('Opportunity for distinctive color palette');
  }

  return gaps;
}

function getMostFrequent(items: string[]): string | null {
  const freq = new Map<string, number>();
  for (const item of items) {
    freq.set(item, (freq.get(item) || 0) + 1);
  }

  let max = 0;
  let mostFrequent: string | null = null;
  for (const [item, count] of freq) {
    if (count > max) {
      max = count;
      mostFrequent = item;
    }
  }

  return mostFrequent;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
