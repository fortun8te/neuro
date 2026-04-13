/**
 * useResearchTemplate Hook
 * Loads, applies, and manages research templates
 */

import { useCallback } from 'react';
import type { Campaign, Cycle } from '../types';
import type { ResearchTemplate, TemplateSection } from '../types/template';
import { getTemplate, getTemplateList, searchTemplates } from '../data/templates';

/**
 * Load a template by ID
 */
export const useLoadTemplate = () => {
  return useCallback((templateId: string): ResearchTemplate | null => {
    try {
      const template = getTemplate(templateId);
      if (!template) {
        console.warn(`Template "${templateId}" not found`);
        return null;
      }
      return template;
    } catch (error) {
      console.error(`Error loading template "${templateId}":`, error);
      return null;
    }
  }, []);
};

/**
 * Apply a template to a campaign
 * Mutates campaign object with template metadata and initial queries
 */
export const useApplyTemplate = () => {
  return useCallback(
    (campaign: Campaign, template: ResearchTemplate): Campaign => {
      return {
        ...campaign,
        // Store template ID for reference
        presetData: {
          ...(campaign.presetData || {}),
          templateId: template.id,
          templateName: template.name,
          templateAppliedAt: Date.now(),
          templateSections: template.sections.map((s) => ({
            sectionId: s.sectionId,
            title: s.title,
            focusAreas: s.focusAreas,
          })),
        },
      };
    },
    []
  );
};

/**
 * Extract initial search queries from a template's first N sections
 * Returns flattened array of queries ready for orchestrator dispatch
 */
export const useGetInitialQueries = () => {
  return useCallback((template: ResearchTemplate, maxSections?: number): string[] => {
    const sections = maxSections ? template.sections.slice(0, maxSections) : template.sections;
    const queries: string[] = [];

    sections.forEach((section) => {
      if (section.initialQueries && Array.isArray(section.initialQueries)) {
        queries.push(...section.initialQueries);
      }
    });

    return queries;
  }, []);
};

/**
 * Extract focus areas from all template sections
 * These are passed to researchers as context constraints
 */
export const useGetTemplateFocusAreas = () => {
  return useCallback(
    (template: ResearchTemplate) => {
      const focusAreas: Record<string, any> = {};

      template.sections.forEach((section) => {
        focusAreas[section.sectionId] = {
          sectionTitle: section.title,
          dimensions: section.focusAreas.map((fa) => ({
            dimension: fa.dimension,
            description: fa.description,
            keywords: fa.keywords,
            sources: fa.sources || [],
          })),
        };
      });

      return focusAreas;
    },
    []
  );
};

/**
 * Get all available templates for UI display
 */
export const useGetAvailableTemplates = () => {
  return useCallback(() => {
    return getTemplateList();
  }, []);
};

/**
 * Search templates by keyword
 */
export const useSearchTemplates = () => {
  return useCallback((query: string): ResearchTemplate[] => {
    if (!query.trim()) {
      return getTemplateList().map((item) => getTemplate(item.id)!);
    }
    return searchTemplates(query);
  }, []);
};

/**
 * Build orchestrator context with template information
 * Used to guide research agent decisions
 */
export const useBuildTemplateContext = () => {
  return useCallback(
    (template: ResearchTemplate) => {
      return {
        templateId: template.id,
        templateName: template.name,
        templateDescription: template.description,
        sections: template.sections.map((s) => ({
          id: s.sectionId,
          title: s.title,
          focusAreas: s.focusAreas.map((fa) => fa.dimension),
          estimatedTime: s.estimatedTime,
        })),
        totalEstimatedTime: template.estimatedTotalTime,
        suggestedPreset: template.suggestedPreset,
        focusGuidance: `Focus on: ${template.sections.map((s) => s.title).join(', ')}. Avoid tangential research.`,
      };
    },
    []
  );
};

/**
 * Create a research context string for prompt injection
 * Tells the orchestrator how to constrain research to template dimensions
 */
export const useGetTemplatePromptContext = () => {
  return useCallback((template: ResearchTemplate): string => {
    const sections = template.sections.map((s) => {
      const dimensions = s.focusAreas.map((fa) => `- ${fa.dimension}: ${fa.description}`).join('\n');
      return `## ${s.title}\n${dimensions}`;
    }).join('\n\n');

    return `Research Template: ${template.name}\n\nFocus your research on these dimensions:\n\n${sections}\n\nAvoid researching tangential topics. Stay focused on the dimensions above.`;
  }, []);
};

/**
 * Main hook that encapsulates all template operations
 */
export const useResearchTemplate = () => {
  const loadTemplate = useLoadTemplate();
  const applyTemplate = useApplyTemplate();
  const getInitialQueries = useGetInitialQueries();
  const getTemplateFocusAreas = useGetTemplateFocusAreas();
  const getAvailableTemplates = useGetAvailableTemplates();
  const searchTemplates = useSearchTemplates();
  const buildTemplateContext = useBuildTemplateContext();
  const getTemplatePromptContext = useGetTemplatePromptContext();

  return {
    loadTemplate,
    applyTemplate,
    getInitialQueries,
    getTemplateFocusAreas,
    getAvailableTemplates,
    searchTemplates,
    buildTemplateContext,
    getTemplatePromptContext,
  };
};
