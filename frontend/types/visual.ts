/**
 * visual.ts — Type definitions for Visual Intelligence System
 *
 * Defines the complete visual analysis pipeline from competitor screenshots
 * through pattern recognition to differentiation recommendations.
 */

/**
 * Represents a single competitor's visual properties extracted from screenshot
 */
export interface CompetitorVisual {
  url: string;
  screenshot_base64?: string;  // Base64 encoded JPEG
  screenshot_width?: number;
  screenshot_height?: number;
  analysisTimestamp: number;

  // Color analysis
  dominantColors: ColorPalette;
  secondaryColors?: string[];
  accentColor?: string;

  // Layout & structure
  layoutPattern: 'hero-dominant' | 'multi-section' | 'grid-based' | 'vertical-scroll' | 'mixed' | 'unknown';
  layoutDescription: string;
  heroPresent: boolean;
  sectionCount?: number;

  // Visual tone & style
  visualTone: 'professional' | 'casual' | 'premium' | 'playful' | 'minimalist' | 'bold' | 'unknown';
  toneDescription: string;

  // Key visual elements
  keyVisualElements: string[];
  imageUsagePattern?: 'hero-image' | 'product-focus' | 'lifestyle' | 'minimal' | 'mixed';

  // CTA & interaction patterns
  ctaPresent: boolean;
  ctaStyle?: 'button' | 'text-link' | 'image-link' | 'mixed' | 'unknown';
  ctaColor?: string;
  ctaDescription?: string;

  // Typography
  headlineStyle?: 'bold-large' | 'elegant' | 'modern' | 'playful' | 'unknown';
  bodyFontSize?: 'small' | 'medium' | 'large';

  // Competitive insight
  competitiveInsight: string;
  differentiationOpportunity?: string;

  // Vision model metadata
  analysisModel: string;
  confidence: number;  // 0-1
  visionRawOutput?: string;  // Raw vision model response for debugging
}

/**
 * Color palette extracted from competitor visual
 */
export interface ColorPalette {
  primary: string;      // Primary brand color (hex)
  secondary?: string;   // Secondary color (hex)
  accent?: string;      // Accent color (hex)
  background?: string;  // Page background (hex)
  text?: string;        // Text color (hex)
  description?: string; // Human description of palette
}

/**
 * Aggregated visual pattern across multiple competitors
 */
export interface VisualPattern {
  pattern: string;  // "Hero-first layout", "Premium serif typography", etc.
  category: 'layout' | 'color' | 'typography' | 'tone' | 'cta' | 'imagery' | 'other';
  frequency: number;  // Percentage (0-100) of competitors using this pattern
  competitors: string[];  // URLs where this pattern appears
  evidence: string[];  // Supporting details/quotes
  strength: 'dominant' | 'common' | 'emerging' | 'rare';
}

/**
 * Visual gap identified in competitor landscape
 */
export interface VisualGap {
  gap: string;  // Description of the gap
  evidence: string;  // Why this is a gap
  opportunity: string;  // How to exploit it
  impactLevel: 'high' | 'medium' | 'low';
  category: 'color' | 'layout' | 'typography' | 'tone' | 'imagery' | 'cta';
}

/**
 * Recommended differentiation strategy based on visual analysis
 */
export interface RecommendedDifferentiation {
  dimension: 'color' | 'layout' | 'typography' | 'tone' | 'imagery' | 'cta';
  recommendation: string;
  rationale: string;
  competitors_avoiding: string[];  // Competitors not using this approach
  confidence: number;  // 0-1
  implementation_examples?: string[];
}

/**
 * Complete visual findings from analyzing competitor landscape
 */
export interface VisualFindings {
  // Raw visual data
  competitorVisuals: CompetitorVisual[];

  // Aggregated patterns
  commonPatterns: VisualPattern[];

  // Opportunities
  visualGaps: VisualGap[];
  recommendedDifferentiation: RecommendedDifferentiation[];

  // Most common elements across competitors
  dominantColorPalettes: ColorPalette[];
  mostCommonLayout: string;
  mostCommonTone: string;
  mostCommonCTAStyle: string;

  // Summary metrics
  analysisModel: string;  // e.g., "qwen3.5:9b"
  totalScreenshots: number;
  totalAnalyzed: number;  // Successfully analyzed
  analysisStartTime?: number;
  analysisEndTime?: number;

  // Cache & deduplication
  cacheKey?: string;  // For screenshot caching
  requestHash?: string;  // Hash of URL list for dedup
}

/**
 * Visual scouting task configuration
 */
export interface VisualScoutConfig {
  urls: string[];
  maxConcurrency?: number;  // Default 3
  maxScreenshotConcurrency?: number;  // Playwright concurrency limit
  timeoutMs?: number;  // Per-URL timeout
  viewportWidth?: number;  // Default 1280
  viewportHeight?: number;  // Default 720
  screenshotQuality?: number;  // 0-100, default 60
  visionModel?: string;  // Model to use for analysis
  signal?: AbortSignal;  // Cancellation
}

/**
 * Event types emitted during visual scouting
 */
export interface VisualScoutEvent {
  type: 'start' | 'screenshotting' | 'analyzing' | 'pattern-found' | 'complete' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
