/**
 * Research Templates Registry
 * Loads and exports all pre-built research templates
 */

import type { ResearchTemplate, TemplateRegistry } from '../../types/template';

// Import JSON templates
import saasTemplate from './saas.json';
import ecommerceTemplate from './ecommerce.json';
import creatorTemplate from './creator.json';
import b2bTemplate from './b2b.json';
import healthcareTemplate from './healthcare.json';

/**
 * Complete registry of all available research templates
 * Each template is a pre-configured research strategy for specific industries/use cases
 */
export const TEMPLATES: TemplateRegistry = {
  saas: saasTemplate as ResearchTemplate,
  ecommerce: ecommerceTemplate as ResearchTemplate,
  creator: creatorTemplate as ResearchTemplate,
  b2b: b2bTemplate as ResearchTemplate,
  healthcare: healthcareTemplate as ResearchTemplate,
};

/**
 * Get all template metadata for UI display
 */
export const getTemplateList = () => {
  return Object.entries(TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    targetAudience: template.targetAudience,
    estimatedTotalTime: template.estimatedTotalTime,
    suggestedPreset: template.suggestedPreset,
    exampleBrands: template.exampleBrands,
  }));
};

/**
 * Get template by ID
 */
export const getTemplate = (templateId: string): ResearchTemplate | null => {
  return TEMPLATES[templateId] || null;
};

/**
 * Search templates by keyword
 */
export const searchTemplates = (query: string): ResearchTemplate[] => {
  const q = query.toLowerCase();
  return Object.values(TEMPLATES).filter((template) => {
    const searchableText = [
      template.name,
      template.description,
      template.category,
      template.targetAudience,
      ...(template.keywords || []),
      ...(template.exampleBrands || []),
    ].join(' ').toLowerCase();
    return searchableText.includes(q);
  });
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: string): ResearchTemplate[] => {
  return Object.values(TEMPLATES).filter((t) => t.category === category);
};

/**
 * Get all unique categories
 */
export const getTemplateCategories = () => {
  const categories = new Set(Object.values(TEMPLATES).map((t) => t.category));
  return Array.from(categories).sort();
};
