/**
 * Template Factory
 *
 * Parses templates, substitutes variables, and generates research plans.
 * Handles variable substitution ([TOPIC], [COMPANY], etc.) and produces
 * structured research plans compatible with the orchestrator.
 */

import { ResearchTemplate, TemplateSection } from './templateRegistry';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ResearchSection {
  id: string;
  title: string;
  description: string;
  queries: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  scope: 'core' | 'related'; // Judge uses this to determine coverage thresholds
  outputType?: 'list' | 'comparison' | 'analysis' | 'strategic' | 'technical';
  codeAnalysisConfig?: {
    paths: string[]; // Resolved paths after variable substitution
    analyze: Array<'structure' | 'complexity' | 'patterns' | 'differences' | 'quality'>;
    depth: 'shallow' | 'medium' | 'deep';
  };
}

export interface ResearchPlan {
  templateId: string;
  templateName: string;
  primaryGoal: string;
  sections: ResearchSection[];
  variables: Record<string, string>;
  coreThreshold: number; // Usually 85% coverage required
  estimatedDuration: number;
  judgeStrategy: 'core-focused';
}

// ─────────────────────────────────────────────────────────────
// Variable Substitution
// ─────────────────────────────────────────────────────────────

/**
 * Find all variables in a string (e.g., [TOPIC], [COMPANY])
 */
export function extractVariables(text: string): string[] {
  const matches = text.match(/\[([A-Z_]+)\]/g) || [];
  return Array.from(new Set(matches.map(m => m.slice(1, -1))));
}

/**
 * Substitute variables in a string
 * E.g., "what is [TOPIC]" with { TOPIC: "collagen" } => "what is collagen"
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\[${key}\\]`, 'g');
    result = result.replace(pattern, value);
  }
  return result;
}

/**
 * Validate that all required variables are provided
 */
export function validateVariables(
  required: string[],
  provided: Record<string, string>,
): { valid: boolean; missing: string[] } {
  const missing = required.filter(v => !provided[v] || provided[v].trim() === '');
  return {
    valid: missing.length === 0,
    missing,
  };
}

// ─────────────────────────────────────────────────────────────
// Template Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse a template section with variable substitution
 */
function parseSection(
  section: TemplateSection,
  variables: Record<string, string>,
): ResearchSection {
  // Substitute variables in queries
  const queries = section.researchQueries.map(q => substituteVariables(q, variables));
  const relatedQueries = (section.relatedQueries || []).map(q =>
    substituteVariables(q, variables),
  );

  // Combine for core, separate for related
  const allQueries = section.scope === 'core' ? [...queries, ...relatedQueries] : queries;

  // Resolve code analysis paths if present
  let codeAnalysisConfig = undefined;
  if (section.codeAnalysis) {
    const paths: string[] = [];

    if (section.codeAnalysis.path) {
      paths.push(substituteVariables(section.codeAnalysis.path, variables));
    }

    if (section.codeAnalysis.repos) {
      for (const repo of section.codeAnalysis.repos) {
        const resolved = substituteVariables(repo, variables);
        // Handle comma-separated repos
        paths.push(
          ...resolved
            .split(',')
            .map(p => p.trim())
            .filter(p => p),
        );
      }
    }

    if (paths.length > 0) {
      codeAnalysisConfig = {
        paths,
        analyze: section.codeAnalysis.analyze,
        depth: section.codeAnalysis.depth || 'medium',
      };
    }
  }

  return {
    id: section.id,
    title: section.title,
    description: section.description,
    queries: allQueries,
    priority: section.priority,
    scope: section.scope,
    outputType: section.outputType,
    codeAnalysisConfig,
  };
}

/**
 * Convert a template into a research plan
 * Handles variable substitution, validation, and plan generation
 */
export function parseTemplate(
  template: ResearchTemplate,
  inputs: Record<string, string>,
): { plan: ResearchPlan; errors: string[] } {
  const errors: string[] = [];

  // 1. Validate required inputs
  const validation = validateVariables(template.requiredInputs, inputs);
  if (!validation.valid) {
    errors.push(`Missing required inputs: ${validation.missing.join(', ')}`);
  }

  // 2. Parse sections
  const sections = template.sections.map(section => parseSection(section, inputs));

  // 3. Build plan
  const plan: ResearchPlan = {
    templateId: template.id,
    templateName: template.name,
    primaryGoal: template.primaryGoal,
    sections,
    variables: inputs,
    coreThreshold: 85, // Core sections must reach 85% coverage
    estimatedDuration: template.estimatedDuration,
    judgeStrategy: 'core-focused',
  };

  return { plan, errors };
}

// ─────────────────────────────────────────────────────────────
// CLI Integration Helper
// ─────────────────────────────────────────────────────────────

/**
 * Format a plan for CLI output
 */
export function formatPlanForCLI(plan: ResearchPlan): string {
  const lines: string[] = [];

  lines.push(`Template: ${plan.templateName}`);
  lines.push(`Goal: ${plan.primaryGoal}`);
  lines.push(`Estimated Duration: ${(plan.estimatedDuration / 60 / 1000).toFixed(0)} minutes`);
  lines.push('');

  // Variables
  lines.push('Variables:');
  for (const [key, value] of Object.entries(plan.variables)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push('');

  // Sections
  const coreSections = plan.sections.filter(s => s.scope === 'core');
  const relatedSections = plan.sections.filter(s => s.scope === 'related');

  lines.push(`Core Sections (${coreSections.length}):`);
  for (const section of coreSections) {
    lines.push(`  [${section.priority.toUpperCase()}] ${section.title}`);
    lines.push(`    ${section.queries.length} queries`);
  }
  lines.push('');

  if (relatedSections.length > 0) {
    lines.push(`Related Sections (${relatedSections.length}):`);
    for (const section of relatedSections) {
      lines.push(`  [${section.priority.toUpperCase()}] ${section.title}`);
      lines.push(`    ${section.queries.length} queries`);
    }
    lines.push('');
  }

  lines.push(`Coverage Threshold: ${plan.coreThreshold}% (core sections)`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Query Generation
// ─────────────────────────────────────────────────────────────

/**
 * Extract all queries from a plan in execution order
 * Core first, then related
 */
export function extractQueries(plan: ResearchPlan): { queries: string[]; sectionIds: string[] } {
  const queries: string[] = [];
  const sectionIds: string[] = [];

  // Core sections first
  for (const section of plan.sections.filter(s => s.scope === 'core')) {
    queries.push(...section.queries);
    for (let i = 0; i < section.queries.length; i++) {
      sectionIds.push(section.id);
    }
  }

  // Then related
  for (const section of plan.sections.filter(s => s.scope === 'related')) {
    queries.push(...section.queries);
    for (let i = 0; i < section.queries.length; i++) {
      sectionIds.push(section.id);
    }
  }

  return { queries, sectionIds };
}

/**
 * Get sections that are marked as "core" in the plan
 * These must reach the coverage threshold for research to terminate
 */
export function getCoreSections(plan: ResearchPlan): ResearchSection[] {
  return plan.sections.filter(s => s.scope === 'core');
}

/**
 * Get sections that are marked as "related"
 * These are optional and only researched if time allows
 */
export function getRelatedSections(plan: ResearchPlan): ResearchSection[] {
  return plan.sections.filter(s => s.scope === 'related');
}
