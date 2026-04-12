/**
 * Research Templates System
 *
 * Core exports for template registry, factory, and all 6 concrete templates.
 */

// Template Infrastructure
export {
  type ResearchTemplate,
  type TemplateSection,
  type CodeAnalysisConfig,
  type TemplateRegistryInstance,
  type TemplateValidationError,
  createTemplateRegistry,
  validateTemplate,
  createSection,
  createTemplate,
} from './templateRegistry';

// Template Factory (parsing and planning)
export {
  type ResearchPlan,
  type ResearchSection,
  parseTemplate,
  extractVariables,
  substituteVariables,
  validateVariables,
  formatPlanForCLI,
  extractQueries,
  getCoreSections,
  getRelatedSections,
} from './templateFactory';

// Concrete Templates (import them here)
export { creativeStrategyTemplate } from './creativeStrategy';
export { leadGenerationTemplate } from './leadGeneration';
export { generalResearchTemplate } from './generalResearch';
export { githubSingleTemplate } from './githubSingle';
export { githubMultiTemplate } from './githubMulti';
export { problemSolutionTemplate } from './problemSolution';

// Template Registry Instance
import { createTemplateRegistry } from './templateRegistry';
import { creativeStrategyTemplate } from './creativeStrategy';
import { leadGenerationTemplate } from './leadGeneration';
import { generalResearchTemplate } from './generalResearch';
import { githubSingleTemplate } from './githubSingle';
import { githubMultiTemplate } from './githubMulti';
import { problemSolutionTemplate } from './problemSolution';

/**
 * Global template registry with all 6 templates
 */
export const templateRegistry = createTemplateRegistry([
  creativeStrategyTemplate,
  leadGenerationTemplate,
  generalResearchTemplate,
  githubSingleTemplate,
  githubMultiTemplate,
  problemSolutionTemplate,
]);

/**
 * Get a template by ID
 * @param id Template ID (e.g., 'creative-strategy', 'github-single')
 * @returns Template or undefined
 */
export function getTemplate(id: string) {
  return templateRegistry.getTemplate(id);
}

/**
 * List all available templates
 */
export function listTemplates() {
  return templateRegistry.listTemplates();
}

/**
 * List all template IDs for CLI completion
 */
export function listTemplateIds(): string[] {
  return templateRegistry.listTemplates().map(t => t.id);
}
