/**
 * Research Template Registry
 *
 * Core infrastructure for defining reusable research workflows.
 * Templates define sections (core vs related), queries, code analysis,
 * and judge strategies for consistent research execution.
 */

// ─────────────────────────────────────────────────────────────
// Core Interfaces
// ─────────────────────────────────────────────────────────────

export interface CodeAnalysisConfig {
  path?: string; // Single repo path: '/Users/mk/repos/myrepo'
  repos?: string[]; // Multiple repos: ['/path/1', '/path/2']
  analyze: Array<'structure' | 'complexity' | 'patterns' | 'differences' | 'quality'>;
  depth?: 'shallow' | 'medium' | 'deep'; // Default: 'medium'
}

export interface TemplateSection {
  /** Unique identifier within template */
  id: string;

  /** Display title */
  title: string;

  /** What this section explores */
  description: string;

  /** Core research queries (always executed) */
  researchQueries: string[];

  /** Related queries (only if --include-related or after core done) */
  relatedQueries?: string[];

  /** Research priority */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Scope: core = required, related = optional */
  scope: 'core' | 'related';

  /** Optional GitHub code analysis */
  codeAnalysis?: CodeAnalysisConfig;

  /** Expected output type for downstream usage */
  outputType?: 'list' | 'comparison' | 'analysis' | 'strategic' | 'technical';
}

export interface ResearchTemplate {
  /** Unique template ID (kebab-case) */
  id: string;

  /** Display name */
  name: string;

  /** What this template is for */
  description: string;

  /** Primary research goal */
  primaryGoal: string;

  /** Organized research sections */
  sections: TemplateSection[];

  /** How to judge when research is "done" */
  judgeStrategy: 'core-focused'; // Extensible for future strategies

  /** How long research typically takes (ms) */
  estimatedDuration: number;

  /** Input variables required (e.g., ['TOPIC', 'COMPANY']) */
  requiredInputs: string[];

  /** Optional inputs */
  optionalInputs?: string[];

  /** What outputs this template produces */
  outputs: string[];

  /** Version for tracking changes */
  version: string;
}

// ─────────────────────────────────────────────────────────────
// Template Registry
// ─────────────────────────────────────────────────────────────

export interface TemplateRegistryInstance {
  templates: Map<string, ResearchTemplate>;
  getTemplate: (id: string) => ResearchTemplate | undefined;
  listTemplates: () => ResearchTemplate[];
  getTemplatesByGoal: (goal: string) => ResearchTemplate[];
}

/**
 * Create a template registry instance
 * Templates are registered in separate files and imported
 */
export function createTemplateRegistry(templates: ResearchTemplate[]): TemplateRegistryInstance {
  const registry = new Map<string, ResearchTemplate>();

  for (const template of templates) {
    registry.set(template.id, template);
  }

  return {
    templates: registry,

    getTemplate(id: string) {
      return registry.get(id);
    },

    listTemplates() {
      return Array.from(registry.values());
    },

    getTemplatesByGoal(goal: string) {
      return Array.from(registry.values()).filter(t =>
        t.primaryGoal.toLowerCase().includes(goal.toLowerCase()),
      );
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Template Validation
// ─────────────────────────────────────────────────────────────

export interface TemplateValidationError {
  field: string;
  message: string;
}

/**
 * Validate a template for correctness and consistency
 */
export function validateTemplate(template: ResearchTemplate): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  // Check required fields
  if (!template.id || !/^[a-z0-9\-]+$/.test(template.id)) {
    errors.push({ field: 'id', message: 'Template ID must be kebab-case alphanumeric' });
  }

  if (!template.name?.trim()) {
    errors.push({ field: 'name', message: 'Template name is required' });
  }

  if (!template.primaryGoal?.trim()) {
    errors.push({ field: 'primaryGoal', message: 'Primary goal is required' });
  }

  if (!Array.isArray(template.sections) || template.sections.length === 0) {
    errors.push({ field: 'sections', message: 'At least one section is required' });
  }

  if (!template.requiredInputs || !Array.isArray(template.requiredInputs)) {
    errors.push({ field: 'requiredInputs', message: 'Required inputs array is required' });
  }

  // Validate sections
  for (let i = 0; i < template.sections.length; i++) {
    const section = template.sections[i];

    if (!section.id?.trim()) {
      errors.push({ field: `sections[${i}].id`, message: 'Section ID is required' });
    }

    if (!section.title?.trim()) {
      errors.push({ field: `sections[${i}].title`, message: 'Section title is required' });
    }

    if (!Array.isArray(section.researchQueries) || section.researchQueries.length === 0) {
      errors.push({
        field: `sections[${i}].researchQueries`,
        message: 'At least one research query is required',
      });
    }

    if (!['core', 'related'].includes(section.scope)) {
      errors.push({
        field: `sections[${i}].scope`,
        message: 'Scope must be "core" or "related"',
      });
    }

    if (!['critical', 'high', 'medium', 'low'].includes(section.priority)) {
      errors.push({
        field: `sections[${i}].priority`,
        message: 'Priority must be critical, high, medium, or low',
      });
    }
  }

  // Validate at least some core sections
  const coreSections = template.sections.filter(s => s.scope === 'core');
  if (coreSections.length === 0) {
    errors.push({
      field: 'sections',
      message: 'At least one core section is required',
    });
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────
// Helper: Create section
// ─────────────────────────────────────────────────────────────

export function createSection(
  id: string,
  title: string,
  description: string,
  queries: string[],
  scope: 'core' | 'related' = 'core',
  priority: 'critical' | 'high' | 'medium' | 'low' = 'high',
  options?: {
    relatedQueries?: string[];
    outputType?: 'list' | 'comparison' | 'analysis' | 'strategic' | 'technical';
    codeAnalysis?: CodeAnalysisConfig;
  },
): TemplateSection {
  return {
    id,
    title,
    description,
    researchQueries: queries,
    relatedQueries: options?.relatedQueries,
    scope,
    priority,
    outputType: options?.outputType,
    codeAnalysis: options?.codeAnalysis,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: Create template
// ─────────────────────────────────────────────────────────────

export function createTemplate(
  id: string,
  name: string,
  description: string,
  primaryGoal: string,
  sections: TemplateSection[],
  requiredInputs: string[],
  outputs: string[],
  options?: {
    estimatedDuration?: number;
    optionalInputs?: string[];
    version?: string;
  },
): ResearchTemplate {
  return {
    id,
    name,
    description,
    primaryGoal,
    sections,
    judgeStrategy: 'core-focused',
    estimatedDuration: options?.estimatedDuration || 90 * 60 * 1000, // Default 90 minutes
    requiredInputs,
    optionalInputs: options?.optionalInputs,
    outputs,
    version: options?.version || '1.0.0',
  };
}
