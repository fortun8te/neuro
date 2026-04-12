/**
 * Site Visual Analyzer
 *
 * Takes full-page screenshots of websites and analyzes visual design,
 * colors, typography, layout, UX patterns with Gemma 4 vision model.
 *
 * Capabilities:
 * - Full-page screenshot via Wayfarer
 * - Color palette extraction (primary, secondary, accent, background)
 * - Typography analysis (font families, weights, sizing hierarchy)
 * - Layout structure (hero, sections, navigation, CTA patterns)
 * - Visual tone (premium, playful, corporate, minimalist, etc)
 * - UX patterns (buttons, forms, micro-interactions)
 * - Accessibility insights (contrast, spacing, readability)
 * - Competitive positioning (compare 3-5 competitor sites)
 */

import { createLogger } from '../utils/logger';
import { ollamaService } from './ollama';
import { screenshotService } from './wayfarer';
import type { VisualProfile } from '../types';

const log = createLogger('siteVisualAnalyzer');

export interface SiteColorPalette {
  primary: { hex: string; rgb: string; usage: string };
  secondary: { hex: string; rgb: string; usage: string };
  accent: { hex: string; rgb: string; usage: string };
  background: { hex: string; rgb: string; usage: string };
  text: { hex: string; rgb: string; contrast: string };
  additionalColors: Array<{ hex: string; usage: string }>;
}

export interface TypographyAnalysis {
  primaryFont: string;
  secondaryFont: string;
  headingStyle: string; // e.g., "Bold sans-serif, 2-3x larger than body"
  bodyStyle: string; // e.g., "Light gray on white, 16px"
  hierarchy: string[]; // Size progression
  readability: {
    score: number; // 0-100
    issues: string[];
  };
}

export interface LayoutStructure {
  sections: Array<{
    name: string; // "Hero", "Features", "Testimonials", etc
    height: string; // % of viewport
    layout: string; // "Full-width", "Grid 3-col", etc
    backgroundColor: string;
  }>;
  navigation: {
    type: string; // "Fixed top", "Sticky", "Floating", etc
    items: string[]; // Menu items
    style: string; // Visual description
  };
  ctas: Array<{
    text: string;
    placement: string; // "Top right", "Center hero", etc
    style: string; // "Solid button", "Link", etc
    color: string;
  }>;
  footerStructure: string;
}

export interface UXPatterns {
  buttonStyle: string;
  formFields: string;
  microInteractions: string[];
  scrollBehavior: string;
  mobileResponsiveness: string;
  loadingPatterns?: string;
  emptyStates?: string;
  errorHandling?: string;
}

export interface AccessibilityAssessment {
  contrastScore: number; // 0-100
  spacingAdequacy: string;
  fontSizeReadability: string;
  colorContrastIssues: string[];
  recommendations: string[];
}

export interface SiteVisualAnalysis {
  url: string;
  timestamp: number;
  screenshotBase64?: string; // Can be omitted to save space
  screenshotUrl?: string;

  // Visual breakdown
  colors: SiteColorPalette;
  typography: TypographyAnalysis;
  layout: LayoutStructure;
  uxPatterns: UXPatterns;
  accessibility: AccessibilityAssessment;

  // Holistic assessments
  visualTone: {
    primary: string; // "Premium", "Playful", "Corporate", "Minimalist", etc
    secondaryTraits: string[];
    brandPersonality: string;
  };

  overallQuality: {
    designScore: number; // 0-100
    modernness: number; // How current is the design?
    consistency: number; // How consistent across the site?
    brandCohesion: number; // Does it match brand identity?
    issues: string[];
    strengths: string[];
  };

  // Competitive analysis (when comparing sites)
  positioning?: {
    comparedTo?: string[]; // Other sites compared
    strengths: string[]; // Where this site stands out visually
    weaknesses: string[]; // Where it lags behind competitors
    differentiation: string;
  };

  // Key insights
  insights: string[];
  recommendations: string[];
}

/**
 * Analyze a single website's visual design
 */
export async function analyzeSiteVisuals(
  url: string,
  options: {
    compareWith?: string[]; // URLs to compare against
    focus?: 'colors' | 'typography' | 'layout' | 'all'; // What to focus on
    includeScreenshot?: boolean; // Save screenshot base64
  } = {},
): Promise<SiteVisualAnalysis> {
  log.info('[SiteVisualAnalyzer] Analyzing site visuals', { url });

  try {
    // 1. Get screenshot via Wayfarer
    log.debug('[SiteVisualAnalyzer] Requesting screenshot...');
    const screenshot = await screenshotService.screenshot(url);

    if (!screenshot) {
      throw new Error(`Failed to get screenshot for ${url}`);
    }

    // 2. Analyze with Gemma 4 vision model
    log.debug('[SiteVisualAnalyzer] Analyzing screenshot with vision model...');
    const analysis = await analyzeScreenshotWithVision(
      screenshot.base64,
      url,
      options,
    );

    // 3. If comparing with competitors, analyze them too
    if (options.compareWith && options.compareWith.length > 0) {
      log.debug('[SiteVisualAnalyzer] Analyzing competitor sites...');
      const competitorAnalyses = await Promise.all(
        options.compareWith.map(compUrl =>
          analyzeScreenshotWithVision(
            (await screenshotService.screenshot(compUrl))?.base64 || '',
            compUrl,
            options,
          ),
        ),
      );

      // Compare and add positioning insights
      analysis.positioning = compareVisualPositioning(
        analysis,
        competitorAnalyses,
      );
    }

    log.info('[SiteVisualAnalyzer] Analysis complete', {
      designScore: analysis.overallQuality.designScore,
      insights: analysis.insights.length,
    });

    return analysis;
  } catch (error) {
    log.error('[SiteVisualAnalyzer] Failed to analyze site visuals', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Use Gemma 4 vision model to analyze screenshot
 */
async function analyzeScreenshotWithVision(
  screenshotBase64: string,
  url: string,
  options: any,
): Promise<SiteVisualAnalysis> {
  const prompt = `You are a world-class web design analyst. Analyze this website screenshot in detail.

URL: ${url}

Return a detailed JSON analysis with:

{
  "colors": {
    "primary": { "hex": "#XXXXXX", "rgb": "rgb(...)", "usage": "..." },
    "secondary": { "hex": "#XXXXXX", "rgb": "rgb(...)", "usage": "..." },
    "accent": { "hex": "#XXXXXX", "rgb": "rgb(...)", "usage": "..." },
    "background": { "hex": "#XXXXXX", "rgb": "rgb(...)", "usage": "..." },
    "text": { "hex": "#XXXXXX", "rgb": "rgb(...)", "contrast": "good/fair/poor" },
    "additionalColors": [{ "hex": "#XXXXXX", "usage": "..." }]
  },
  "typography": {
    "primaryFont": "Font family (e.g., 'Inter' or 'Georgia')",
    "secondaryFont": "Secondary font if used",
    "headingStyle": "Description of heading appearance",
    "bodyStyle": "Description of body text",
    "hierarchy": ["16px body", "24px subheading", "32px heading"],
    "readability": {
      "score": 85,
      "issues": ["Any readability problems"]
    }
  },
  "layout": {
    "sections": [
      {
        "name": "Hero",
        "height": "100vh",
        "layout": "Full-width image background",
        "backgroundColor": "#XXXXXX"
      }
    ],
    "navigation": {
      "type": "Fixed top",
      "items": ["Home", "About", "Products", "Contact"],
      "style": "White text on dark background"
    },
    "ctas": [
      {
        "text": "Shop Now",
        "placement": "Hero center",
        "style": "Solid button",
        "color": "#XXXXXX"
      }
    ],
    "footerStructure": "Description of footer layout"
  },
  "uxPatterns": {
    "buttonStyle": "Description",
    "formFields": "Description",
    "microInteractions": ["Hover effects", "Animations"],
    "scrollBehavior": "Parallax / smooth / normal",
    "mobileResponsiveness": "Appears responsive / Limited mobile",
    "loadingPatterns": "Skeleton loading / Spinners",
    "emptyStates": "Custom empty states / Generic",
    "errorHandling": "Error messages shown / Not visible"
  },
  "accessibility": {
    "contrastScore": 85,
    "spacingAdequacy": "Adequate padding and margins",
    "fontSizeReadability": "Readable (16px+ body text)",
    "colorContrastIssues": [],
    "recommendations": ["Add skip to main content link"]
  },
  "visualTone": {
    "primary": "Premium",
    "secondaryTraits": ["Modern", "Minimalist"],
    "brandPersonality": "Luxury and simplicity"
  },
  "overallQuality": {
    "designScore": 85,
    "modernness": 90,
    "consistency": 88,
    "brandCohesion": 92,
    "issues": ["Minor spacing inconsistency on mobile"],
    "strengths": ["Excellent color harmony", "Clear typography hierarchy"]
  },
  "insights": [
    "Strong visual hierarchy guides user attention",
    "Color palette conveys premium positioning",
    "Accessibility is well-considered"
  ],
  "recommendations": [
    "Consider adding subtle animations to CTAs",
    "Ensure mobile spacing matches desktop consistency"
  ]
}

Be specific and detailed. Analyze actual pixels, colors, fonts you see.`;

  try {
    const response = await ollamaService.generateWithImage(
      prompt,
      screenshotBase64,
      {
        model: 'gemma4:e2b', // Vision-capable model
        temperature: 0.3, // More deterministic for analysis
        numPredict: 2000,
      },
    );

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in vision response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      url,
      timestamp: Date.now(),
      screenshotBase64: undefined, // Don't store base64 to save space
      screenshotUrl: `${url}/screenshot.png`,
      ...parsed,
    } as SiteVisualAnalysis;
  } catch (error) {
    log.error('[SiteVisualAnalyzer] Vision analysis failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Compare visual positioning across competitors
 */
function compareVisualPositioning(
  mainSite: SiteVisualAnalysis,
  competitors: SiteVisualAnalysis[],
): { comparedTo: string[]; strengths: string[]; weaknesses: string[]; differentiation: string } {
  const mainScore = mainSite.overallQuality.designScore;
  const competitorScores = competitors.map(c => c.overallQuality.designScore);
  const avgCompetitorScore =
    competitorScores.reduce((a, b) => a + b, 0) / competitorScores.length;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Compare design scores
  if (mainScore > avgCompetitorScore) {
    strengths.push(
      `Better design quality (${mainScore} vs ${avgCompetitorScore.toFixed(0)})`,
    );
  } else {
    weaknesses.push(
      `Lower design quality (${mainScore} vs ${avgCompetitorScore.toFixed(0)})`,
    );
  }

  // Compare color sophistication
  const mainColorCount = mainSite.colors.additionalColors.length;
  const avgCompetitorColors =
    competitors.reduce((sum, c) => sum + c.colors.additionalColors.length, 0) /
    competitors.length;

  if (mainColorCount > avgCompetitorColors) {
    strengths.push('More sophisticated color palette');
  } else if (mainColorCount < avgCompetitorColors) {
    weaknesses.push('Simpler color palette than competitors');
  }

  // Typography comparison
  if (
    mainSite.typography.readability.score >
    competitors.reduce((sum, c) => sum + c.typography.readability.score, 0) /
      competitors.length
  ) {
    strengths.push('Better typography and readability');
  }

  return {
    comparedTo: competitors.map(c => c.url),
    strengths,
    weaknesses,
    differentiation: `Positioned as ${mainSite.visualTone.primary} brand vs competitors' ${competitors.map(c => c.visualTone.primary).join(', ')}`,
  };
}

/**
 * Extract dominant colors from site for brand guidelines
 */
export function extractColorPalette(analysis: SiteVisualAnalysis): string[] {
  return [
    analysis.colors.primary.hex,
    analysis.colors.secondary.hex,
    analysis.colors.accent.hex,
    ...analysis.colors.additionalColors.map(c => c.hex),
  ].slice(0, 5);
}

/**
 * Generate visual design recommendations
 */
export function generateVisualRecommendations(
  analysis: SiteVisualAnalysis,
): string[] {
  const recs: string[] = [];

  // Color recommendations
  if (
    analysis.accessibility.contrastScore < 80 ||
    analysis.accessibility.colorContrastIssues.length > 0
  ) {
    recs.push(
      'Improve color contrast for better accessibility and readability',
    );
  }

  // Typography recommendations
  if (analysis.typography.readability.issues.length > 0) {
    recs.push(`Fix typography issues: ${analysis.typography.readability.issues.join(', ')}`);
  }

  // Layout recommendations
  if (
    !analysis.uxPatterns.mobileResponsiveness.includes('responsive')
  ) {
    recs.push('Optimize layout for mobile devices');
  }

  // Add custom recommendations from analysis
  recs.push(...analysis.recommendations);

  return recs;
}
