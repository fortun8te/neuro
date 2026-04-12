/**
 * Image Pipeline Integration — Complete workflow for brand visual research
 *
 * Orchestrates the full image pipeline:
 * 1. Search for brand images across web
 * 2. Download and cache images
 * 3. Analyze with vision model
 * 4. Compare and extract patterns
 * 5. Synthesize insights for research findings
 *
 * Integrates with deepBrandResearch and research flow
 */

import { searchBrandImages, searchCompetitorImages, searchSocialMediaImages, deduplicateImages } from '../services/imageSearcher';
import { downloadImageBatch, getCacheStats } from '../services/imageDownloader';
import { analyzeImageBatch, compareVisualPatterns, VisualFindings } from '../services/imageAnalyzer';
import { createLogger } from './logger';

const log = createLogger('image-pipeline');

export interface ImageResearchConfig {
  brandName: string;
  productCategories?: string[];
  competitors?: string[];
  searchPlatforms?: string[];
  maxImagesPerSource?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (msg: string, progress?: number) => void;
  onChunk?: (chunk: string) => void;
}

export interface ImageResearchResults {
  brand_images: VisualFindings[];
  competitor_images: VisualFindings[];
  social_media_images: VisualFindings[];
  pattern_analysis: {
    common_colors: string[];
    common_styles: string[];
    common_tones: string[];
    design_trends: string[];
    visual_gaps: string[];
  };
  cache_stats: {
    memory: { count: number; bytes: number };
    indexeddb: { count: number; bytes: number };
  };
  total_analyzed: number;
  elapsed_ms: number;
  summary: string;
}

/**
 * Run complete image research pipeline
 */
export async function runImagePipeline(
  config: ImageResearchConfig
): Promise<ImageResearchResults> {
  const startTime = Date.now();
  const { brandName, productCategories = [], competitors = [], searchPlatforms = [], maxImagesPerSource = 10, concurrency = 2, signal, onProgress, onChunk } = config;

  const allResults: VisualFindings[] = [];
  let step = 0;
  const totalSteps = 5;

  try {
    // Step 1: Search brand images
    step++;
    onProgress?.(`Searching brand images... (${step}/${totalSteps})`, step / totalSteps);
    log.info(`[Step 1] Searching images for ${brandName}`);

    const brandSearchTerms = [
      `${brandName} product images`,
      `${brandName} packaging design`,
      `${brandName} website products`,
      `${brandName} social media aesthetic`,
      ...productCategories.map(cat => `${brandName} ${cat} product`),
    ];

    const brandImageSearch = await searchBrandImages(brandName, brandSearchTerms, signal);
    const brandImages = deduplicateImages(brandImageSearch.images).slice(0, maxImagesPerSource * 2);

    onChunk?.(`Found ${brandImages.length} brand images\n`);
    log.info(`Found ${brandImages.length} brand images`);

    // Download brand images
    onProgress?.(`Downloading brand images... (${step}/${totalSteps})`, step / totalSteps);
    const downloadedBrand = await downloadImageBatch(
      brandImages.map(img => ({ url: img.url, label: brandName })),
      { concurrency, signal, onProgress: ({ completed, total }) => {
        onChunk?.(`Downloaded: ${completed}/${total} images\n`);
      }}
    );

    onChunk?.(`Downloaded ${downloadedBrand.length} brand images\n`);
    log.info(`Downloaded ${downloadedBrand.length} brand images`);

    // Analyze brand images
    step++;
    onProgress?.(`Analyzing brand images... (${step}/${totalSteps})`, step / totalSteps);
    const analyzedBrand = await analyzeImageBatch(
      downloadedBrand.map((img, i) => ({
        url: brandImages[i]?.url || 'unknown',
        label: brandName,
      })),
      {
        concurrency,
        signal,
        onProgress: ({ completed, total }) => {
          onChunk?.(`Analyzed: ${completed}/${total} images\n`);
        },
      }
    );

    allResults.push(...analyzedBrand);
    onChunk?.(`Analyzed ${analyzedBrand.length} brand images\n`);
    log.info(`Analyzed ${analyzedBrand.length} brand images`);

    // Step 2: Search competitor images
    step++;
    onProgress?.(`Searching competitor images... (${step}/${totalSteps})`, step / totalSteps);

    const competitorResults: VisualFindings[] = [];
    for (const competitor of competitors) {
      if (signal?.aborted) break;

      try {
        onChunk?.(`Searching ${competitor}...\n`);
        const compImages = await searchCompetitorImages(competitor, signal);
        const deduped = deduplicateImages(compImages).slice(0, maxImagesPerSource);

        const downloaded = await downloadImageBatch(
          deduped.map(img => ({ url: img.url, label: competitor })),
          { concurrency: 1, signal }
        );

        const analyzed = await analyzeImageBatch(
          downloaded.map((img, i) => ({
            url: deduped[i]?.url || 'unknown',
            label: competitor,
          })),
          { concurrency: 1, signal }
        );

        competitorResults.push(...analyzed);
        onChunk?.(`Analyzed ${analyzed.length} images from ${competitor}\n`);
      } catch (err) {
        log.warn(`Competitor image search failed for ${competitor}`, {}, err);
        onChunk?.(`Failed to analyze ${competitor}: ${err}\n`);
      }
    }

    allResults.push(...competitorResults);
    log.info(`Analyzed ${competitorResults.length} competitor images`);

    // Step 3: Search social media images
    step++;
    onProgress?.(`Searching social media images... (${step}/${totalSteps})`, step / totalSteps);

    const platforms = searchPlatforms.length > 0 ? searchPlatforms : ['instagram', 'tiktok'];
    const socialImages = await searchSocialMediaImages(brandName, platforms, signal);
    const deduped = deduplicateImages(socialImages).slice(0, maxImagesPerSource);

    onChunk?.(`Found ${deduped.length} social media images\n`);

    const downloadedSocial = await downloadImageBatch(
      deduped.map(img => ({ url: img.url, label: `${brandName}-social` })),
      { concurrency, signal, onProgress: ({ completed, total }) => {
        onChunk?.(`Downloaded social media: ${completed}/${total}\n`);
      }}
    );

    const analyzedSocial = await analyzeImageBatch(
      downloadedSocial.map((img, i) => ({
        url: deduped[i]?.url || 'unknown',
        label: `${brandName}-social`,
      })),
      { concurrency, signal }
    );

    allResults.push(...analyzedSocial);
    onChunk?.(`Analyzed ${analyzedSocial.length} social media images\n`);
    log.info(`Analyzed ${analyzedSocial.length} social media images`);

    // Step 4: Compare and extract patterns
    step++;
    onProgress?.(`Analyzing visual patterns... (${step}/${totalSteps})`, step / totalSteps);

    const patterns = await compareVisualPatterns(allResults);

    onChunk?.(`Found ${patterns.common_colors.length} common colors\n`);
    onChunk?.(`Found ${patterns.common_styles.length} common styles\n`);
    onChunk?.(`Identified ${patterns.design_trends.length} design trends\n`);
    onChunk?.(`Found ${patterns.gaps.length} visual gaps\n`);

    // Step 5: Compile results
    step++;
    onProgress?.(`Compiling research findings... (${step}/${totalSteps})`, step / totalSteps);

    const cacheStats = await getCacheStats();
    const elapsed = Date.now() - startTime;

    const summary = generateSummary(analyzedBrand, competitorResults, patterns, elapsed);

    onChunk?.(`\nImage research complete!\n`);
    onChunk?.(`Total images analyzed: ${allResults.length}\n`);
    onChunk?.(`Time elapsed: ${(elapsed / 1000).toFixed(1)}s\n`);

    return {
      brand_images: analyzedBrand,
      competitor_images: competitorResults,
      social_media_images: analyzedSocial,
      pattern_analysis: patterns,
      cache_stats: cacheStats,
      total_analyzed: allResults.length,
      elapsed_ms: elapsed,
      summary,
    };
  } catch (err) {
    log.error('Image pipeline failed', { brandName }, err);
    throw new Error(`Image research pipeline failed: ${err}`);
  }
}

/**
 * Generate markdown summary of image research
 */
function generateSummary(
  brandImages: VisualFindings[],
  competitorImages: VisualFindings[],
  patterns: any,
  elapsed: number
): string {
  const brandSummary = brandImages.length > 0
    ? brandImages.map(img => `- ${img.summary}`).join('\n')
    : 'No brand images analyzed';

  const competitorSummary = competitorImages.length > 0
    ? `Analyzed ${competitorImages.length} competitor images. Common patterns: ${patterns.common_styles.join(', ')}`
    : 'No competitor images analyzed';

  return `## Visual Brand Research Summary

### Brand Visual Identity
${brandSummary}

### Key Findings
- **Common Colors**: ${patterns.common_colors.join(', ') || 'None identified'}
- **Design Styles**: ${patterns.common_styles.join(', ') || 'Varied'}
- **Brand Tone**: ${patterns.common_tones.join(', ') || 'Mixed'}
- **Design Trends**: ${patterns.design_trends.join(', ') || 'None identified'}

### Competitive Landscape
${competitorSummary}

### Visual Opportunities
${patterns.gaps.map(gap => `- ${gap}`).join('\n') || 'No gaps identified'}

### Analysis Time
Completed in ${(elapsed / 1000).toFixed(1)} seconds`;
}

/**
 * Extract key insights for use in downstream research stages
 */
export function extractVisualInsights(results: ImageResearchResults): {
  color_strategy: string;
  design_direction: string;
  tone_guidance: string;
  differentiation_opportunities: string[];
  social_media_strategy: string;
} {
  const { brand_images, competitor_images, pattern_analysis, social_media_images } = results;

  // Color strategy from brand analysis
  const colorStrategy = brand_images.length > 0
    ? `Use colors: ${brand_images[0].color_palette.slice(0, 3).map(c => c.name).join(', ')}. ${brand_images[0].color_palette[0]?.psychology || ''}`
    : 'Determine primary color palette';

  // Design direction from patterns
  const designDirection = pattern_analysis.common_styles.length > 0
    ? `Lean into ${pattern_analysis.common_styles[0]} design with elements of ${pattern_analysis.common_styles.slice(1).join(', ')}`
    : 'Establish distinctive design style';

  // Tone from brand analysis
  const toneGuidance = brand_images.length > 0
    ? `Brand tone: ${brand_images[0].tone.adjectives.slice(0, 3).join(', ')}. ${brand_images[0].tone.personality}`
    : 'Define brand personality';

  // Opportunities from gaps
  const opportunities = pattern_analysis.gaps;

  // Social media strategy
  const socialMediaStrategy = social_media_images.length > 0
    ? `Social aesthetic should reflect: ${social_media_images[0].design_style.primary_style} with ${social_media_images[0].tone.adjectives[0] || 'engaging'} tone`
    : 'Establish consistent social media visual language';

  return {
    color_strategy: colorStrategy,
    design_direction: designDirection,
    tone_guidance: toneGuidance,
    differentiation_opportunities: opportunities,
    social_media_strategy: socialMediaStrategy,
  };
}

/**
 * Format image research results for inclusion in PDF report
 */
export function formatImageResearchForPDF(results: ImageResearchResults): {
  visual_brand_analysis: any;
  competitive_visual_analysis: any;
  color_palette: any;
  design_insights: any;
} {
  const brandImages = results.brand_images;
  const competitorImages = results.competitor_images;
  const patterns = results.pattern_analysis;

  return {
    visual_brand_analysis: {
      total_images_analyzed: results.total_analyzed,
      key_colors: patterns.common_colors,
      design_style: patterns.common_styles[0] || 'Mixed',
      brand_tone_adjectives: patterns.common_tones,
      sample_findings: brandImages.slice(0, 3).map(img => ({
        url: img.url,
        primary_color: img.color_palette[0]?.name,
        design_style: img.design_style.primary_style,
        tone: img.tone.personality,
      })),
    },
    competitive_visual_analysis: {
      competitors_analyzed: competitorImages.length,
      common_strategies: patterns.design_trends,
      visual_gaps_identified: patterns.gaps,
      sample_competitor_findings: competitorImages.slice(0, 2).map(img => ({
        url: img.url,
        design_approach: img.design_style.primary_style,
        premium_score: img.packaging.premium_score,
      })),
    },
    color_palette: {
      primary_colors: patterns.common_colors.slice(0, 3),
      color_psychology: brandImages[0]?.color_palette?.map(c => ({
        color: c.name,
        psychology: c.psychology,
      })) || [],
    },
    design_insights: {
      primary_style: patterns.common_styles[0],
      era_feel: brandImages[0]?.design_style?.era_feel || 'Contemporary',
      target_audience: brandImages[0]?.target_audience?.demographics || 'TBD',
      differentiation_opportunities: patterns.gaps,
    },
  };
}
