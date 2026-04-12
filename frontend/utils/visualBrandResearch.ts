/**
 * Visual Brand Research Stage — Deep Brand Research Component
 *
 * Integrates with deepBrandResearch.ts as a research stage
 * Orchestrates image search, download, analysis, and pattern comparison
 * Outputs structured visual insights for downstream creative stages
 *
 * Stage ID: 'visual-brand-research'
 */

import { runImagePipeline, extractVisualInsights, ImageResearchConfig } from './imagePipelineIntegration';
import { createLogger } from './logger';

const log = createLogger('visual-brand-research');

export interface VisualBrandResearchStage {
  id: 'visual-brand-research';
  title: 'Visual Brand Analysis';
  scope: 'core' | 'extended';
  priority: 'critical' | 'high' | 'medium';
  description: string;
}

export interface VisualBrandResearchRequest {
  brandName: string;
  productCategories: string[];
  competitors: string[];
  searchPlatforms?: string[];
  maxImagesPerSource?: number;
  concurrency?: number;
  signal?: AbortSignal;
}

export interface VisualBrandResearchOutput {
  stage_id: 'visual-brand-research';
  completed_at: number;
  duration_ms: number;
  visual_findings: {
    brand_visual_profile: {
      primary_colors: string[];
      secondary_colors: string[];
      design_style: string;
      brand_tone: string[];
      packaging_assessment: {
        materials: string[];
        minimalism: number;
        premium_feel: number;
      };
      target_audience: string;
    };
    competitor_insights: {
      count: number;
      common_approaches: string[];
      visual_differentiation_gaps: string[];
    };
    social_media_aesthetic: {
      platform_strategies: Record<string, string>;
      visual_consistency: string;
      engagement_drivers: string[];
    };
    strategic_recommendations: {
      color_strategy: string;
      design_direction: string;
      tone_guidance: string;
      unique_positioning: string[];
      production_considerations: string[];
    };
  };
  raw_data: {
    total_images_analyzed: number;
    images_by_source: Record<string, number>;
    analysis_time_ms: number;
    cache_efficiency: {
      memory_images: number;
      disk_images: number;
      cache_hit_rate: number;
    };
  };
}

/**
 * Run visual brand research stage
 *
 * Executes complete image pipeline with progress tracking
 */
export async function runVisualBrandResearch(
  request: VisualBrandResearchRequest,
  onProgress?: (msg: string, progress?: number) => void,
  onChunk?: (text: string) => void
): Promise<VisualBrandResearchOutput> {
  const startTime = Date.now();

  try {
    log.info(`Starting visual brand research for ${request.brandName}`);
    onChunk?.(`\n=== VISUAL BRAND RESEARCH ===\nBrand: ${request.brandName}\n\n`);

    // Run image pipeline
    const pipelineConfig: ImageResearchConfig = {
      brandName: request.brandName,
      productCategories: request.productCategories,
      competitors: request.competitors,
      searchPlatforms: request.searchPlatforms || ['instagram', 'tiktok'],
      maxImagesPerSource: request.maxImagesPerSource || 10,
      concurrency: request.concurrency || 2,
      signal: request.signal,
      onProgress,
      onChunk,
    };

    const pipelineResults = await runImagePipeline(pipelineConfig);

    // Extract insights
    const insights = extractVisualInsights(pipelineResults);

    // Synthesize output
    const output: VisualBrandResearchOutput = {
      stage_id: 'visual-brand-research',
      completed_at: Date.now(),
      duration_ms: Date.now() - startTime,
      visual_findings: {
        brand_visual_profile: {
          primary_colors: pipelineResults.pattern_analysis.common_colors.slice(0, 3),
          secondary_colors: pipelineResults.pattern_analysis.common_colors.slice(3, 6),
          design_style: pipelineResults.pattern_analysis.common_styles[0] || 'Contemporary',
          brand_tone: pipelineResults.pattern_analysis.common_tones.slice(0, 3),
          packaging_assessment: {
            materials: extractPackagingMaterials(pipelineResults.brand_images),
            minimalism: calculateAverageScore(pipelineResults.brand_images, 'minimalism'),
            premium_feel: calculateAverageScore(pipelineResults.brand_images, 'premium'),
          },
          target_audience: pipelineResults.brand_images[0]?.target_audience?.demographics || 'To be determined',
        },
        competitor_insights: {
          count: pipelineResults.competitor_images.length,
          common_approaches: pipelineResults.pattern_analysis.design_trends,
          visual_differentiation_gaps: pipelineResults.pattern_analysis.gaps,
        },
        social_media_aesthetic: {
          platform_strategies: extractPlatformStrategies(pipelineResults.social_media_images),
          visual_consistency: assessVisualConsistency(pipelineResults.brand_images),
          engagement_drivers: extractEngagementDrivers(pipelineResults.social_media_images),
        },
        strategic_recommendations: {
          color_strategy: insights.color_strategy,
          design_direction: insights.design_direction,
          tone_guidance: insights.tone_guidance,
          unique_positioning: insights.differentiation_opportunities,
          production_considerations: generateProductionConsiderations(
            pipelineResults.brand_images
          ),
        },
      },
      raw_data: {
        total_images_analyzed: pipelineResults.total_analyzed,
        images_by_source: {
          brand: pipelineResults.brand_images.length,
          competitors: pipelineResults.competitor_images.length,
          social_media: pipelineResults.social_media_images.length,
        },
        analysis_time_ms: pipelineResults.elapsed_ms,
        cache_efficiency: {
          memory_images: pipelineResults.cache_stats.memory.count,
          disk_images: pipelineResults.cache_stats.indexeddb.count,
          cache_hit_rate: 0.85,  // Placeholder
        },
      },
    };

    log.info(`Visual brand research complete in ${output.duration_ms}ms`);
    onChunk?.(`\n=== RESEARCH COMPLETE ===\n`);

    return output;
  } catch (err) {
    log.error('Visual brand research failed', { brandName: request.brandName }, err);
    throw new Error(`Visual brand research failed: ${err}`);
  }
}

/**
 * Format visual research output for deep brand research integration
 */
export function formatForDeepBrandResearch(output: VisualBrandResearchOutput): Record<string, any> {
  return {
    section: 'visual_identity',
    findings: output.visual_findings,
    metadata: {
      stage: 'visual-brand-research',
      timestamp: output.completed_at,
      duration_seconds: Math.round(output.duration_ms / 1000),
    },
  };
}

// ── Helper functions ────────────────────────────────────────────────────────

function extractPackagingMaterials(images: any[]): string[] {
  const materials = new Set<string>();

  for (const img of images) {
    if (img.packaging?.material) {
      materials.add(img.packaging.material);
    }
  }

  return Array.from(materials);
}

function calculateAverageScore(images: any[], scoreType: 'minimalism' | 'premium'): number {
  if (images.length === 0) return 5;

  const key = scoreType === 'minimalism' ? 'minimalism_score' : 'premium_score';
  const sum = images.reduce((acc, img) => acc + (img.packaging?.[key] || 5), 0);

  return Math.round((sum / images.length) * 10) / 10;
}

function extractPlatformStrategies(images: any[]): Record<string, string> {
  const strategies: Record<string, string> = {};

  // Group by platform and determine strategy
  const byPlatform = new Map<string, any[]>();

  for (const img of images) {
    const platform = img.url.includes('instagram') ? 'instagram'
      : img.url.includes('tiktok') ? 'tiktok'
      : 'other';

    if (!byPlatform.has(platform)) {
      byPlatform.set(platform, []);
    }
    byPlatform.get(platform)!.push(img);
  }

  for (const [platform, imgs] of byPlatform) {
    const primaryStyle = imgs[0]?.design_style?.primary_style || 'Mixed';
    const tones = imgs[0]?.tone?.adjectives || [];
    strategies[platform] = `${primaryStyle} aesthetic with ${tones.slice(0, 2).join(', ')} tone`;
  }

  return strategies;
}

function assessVisualConsistency(images: any[]): string {
  if (images.length < 2) return 'Insufficient data';

  // Check if primary style, colors, and tones are consistent across images
  const styles = images.map(img => img.design_style.primary_style);
  const uniqueStyles = new Set(styles).size;

  const colors = images.flatMap(img => img.color_palette.map((c: any) => c.name));
  const uniqueColors = new Set(colors).size;

  const consistency = (1 - (uniqueStyles / images.length)) * 100;

  if (consistency > 80) return 'Highly consistent visual identity';
  if (consistency > 60) return 'Generally consistent with some variation';
  if (consistency > 40) return 'Moderately diverse visual approach';
  return 'Highly varied visual strategy';
}

function extractEngagementDrivers(images: any[]): string[] {
  const drivers = new Set<string>();

  for (const img of images) {
    // Bright/vibrant colors
    if (img.color_palette?.length > 0) {
      const hasVibrant = img.color_palette.some((c: any) =>
        ['red', 'orange', 'yellow', 'pink', 'purple'].some(col =>
          c.name.toLowerCase().includes(col)
        )
      );
      if (hasVibrant) drivers.add('Vibrant color palette');
    }

    // Minimalist (clean, modern)
    if (img.packaging?.minimalism_score > 7) {
      drivers.add('Clean, minimal design');
    }

    // Premium positioning
    if (img.packaging?.premium_score > 7) {
      drivers.add('Luxury positioning');
    }

    // Playful tone
    if (img.tone?.adjectives?.some((adj: string) =>
      ['playful', 'fun', 'vibrant', 'bold'].includes(adj.toLowerCase())
    )) {
      drivers.add('Playful, engaging personality');
    }
  }

  return Array.from(drivers);
}

function generateProductionConsiderations(images: any[]): string[] {
  const considerations: string[] = [];

  // Material considerations
  const materials = new Set<string>();
  for (const img of images) {
    if (img.packaging?.material) {
      materials.add(img.packaging.material);
    }
  }

  if (materials.has('glass') || materials.has('premium')) {
    considerations.push('Premium materials (glass, metal) suggest upscale positioning');
  }
  if (materials.has('sustainable') || materials.has('eco')) {
    considerations.push('Eco-friendly materials suggest sustainability focus');
  }

  // Color production
  if (images.length > 0 && images[0].color_palette?.length > 0) {
    const colors = images[0].color_palette.slice(0, 3);
    considerations.push(
      `Color matching critical: ensure ${colors.map((c: any) => c.name).join(', ')} are consistently reproduced`
    );
  }

  // Scale and dimensions
  considerations.push('Photography/product placement should emphasize premium positioning');

  // Typography (if any)
  considerations.push('Typography should align with design style and brand tone');

  return considerations;
}

/**
 * Stage definition for use in deepBrandResearch
 */
export const VISUAL_BRAND_RESEARCH_STAGE: VisualBrandResearchStage = {
  id: 'visual-brand-research',
  title: 'Visual Brand Analysis',
  scope: 'core',
  priority: 'critical',
  description: 'Deep visual analysis of brand identity, packaging, design style, and competitive landscape through image research, downloading, and vision model analysis',
};
