/**
 * Research Templates — Phase C
 * Pre-configured research strategies for common use cases
 * (SaaS, E-commerce, Creator Economy, B2B, Healthcare)
 */

/**
 * Research dimension that a template focuses on.
 * These inform the orchestrator's search queries and researcher prompts.
 */
export interface TemplateFocusArea {
  dimension: string;          // e.g., "customer-pain-points", "pricing-strategy"
  description: string;        // What to look for
  keywords: string[];         // Search hints
  sources?: string[];         // Preferred source types (reddit, reviews, blogs, etc)
}

/**
 * Logical grouping of research queries under a theme.
 * Templates can have 3-5 sections, each covering different angles.
 */
export interface TemplateSection {
  sectionId: string;                    // e.g., "market-analysis", "customer-insights"
  title: string;                        // Display name
  description: string;                  // What this section researches
  initialQueries: string[];             // 2-4 search queries to kick off research
  focusAreas: TemplateFocusArea[];       // What researchers should focus on
  depthOverride?: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX'; // Override global preset for this section
  estimatedTime?: number;               // Estimated minutes for this section
}

/**
 * Pre-built research template for common industries/use cases.
 * Templates guide the research phase with domain-specific knowledge.
 */
export interface ResearchTemplate {
  id: string;                           // e.g., "saas", "ecommerce", "creator", "b2b", "healthcare"
  name: string;                         // Display name: "SaaS Research"
  description: string;                  // Quick explanation of what this template covers
  category: 'b2c' | 'b2b' | 'creator' | 'saas' | 'healthcare';
  icon?: string;                        // Optional emoji/icon representation

  // Target audience guidance
  targetAudience?: string;              // e.g., "Established SaaS companies exploring new markets"
  bestFor?: string;                     // Marketing scenario guidance

  // Research sections — ordered list
  sections: TemplateSection[];

  // Desired output format for final research
  desiredOutputFormat?: {
    includeMarketSize?: boolean;
    includeCompetitorBenchmarks?: boolean;
    includeCustomerJourney?: boolean;
    includePricingAnalysis?: boolean;
    includeVisualScouting?: boolean;
  };

  // Suggested depth preset when this template is selected
  suggestedPreset?: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX';

  // Estimated total research time (minutes)
  estimatedTotalTime?: number;

  // Example brands that would benefit from this template
  exampleBrands?: string[];

  // Keywords to help with template discovery
  keywords?: string[];
}

/**
 * Template registry — complete list of available templates
 * Exported as immutable constant from templates/index.ts
 */
export type TemplateRegistry = Record<string, ResearchTemplate>;
