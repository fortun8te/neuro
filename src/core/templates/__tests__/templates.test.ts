/**
 * Research Templates System Tests
 *
 * Tests for:
 * - Template validation
 * - Variable substitution
 * - Plan generation
 * - Core/related section separation
 * - All 6 concrete templates
 */

import {
  validateTemplate,
  createTemplate,
  createSection,
  parseTemplate,
  extractVariables,
  substituteVariables,
  validateVariables,
  extractQueries,
  getCoreSections,
  getRelatedSections,
  getTemplate,
  listTemplates,
  listTemplateIds,
} from '../index';

describe('Template Registry', () => {
  test('should have 6 templates registered', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(6);
  });

  test('should list all template IDs', () => {
    const ids = listTemplateIds();
    expect(ids).toContain('creative-strategy');
    expect(ids).toContain('lead-generation');
    expect(ids).toContain('general-research');
    expect(ids).toContain('github-single');
    expect(ids).toContain('github-multi');
    expect(ids).toContain('problem-solution');
  });

  test('should retrieve template by ID', () => {
    const template = getTemplate('creative-strategy');
    expect(template).toBeDefined();
    expect(template?.id).toBe('creative-strategy');
    expect(template?.name).toBe('Creative Strategy');
  });

  test('should return undefined for unknown template', () => {
    const template = getTemplate('nonexistent-template');
    expect(template).toBeUndefined();
  });
});

describe('Template Validation', () => {
  test('should validate a well-formed template', () => {
    const template = createTemplate(
      'test-template',
      'Test Template',
      'For testing',
      'Test goal',
      [
        createSection(
          'test-section',
          'Test Section',
          'Test description',
          ['test query 1', 'test query 2'],
          'core',
          'high',
        ),
      ],
      ['TEST_VAR'],
      ['test output'],
    );

    const errors = validateTemplate(template);
    expect(errors).toHaveLength(0);
  });

  test('should reject template without core section', () => {
    const template = createTemplate(
      'bad-template',
      'Bad Template',
      'For testing',
      'Test goal',
      [
        createSection(
          'related-section',
          'Related Section',
          'Test description',
          ['test query'],
          'related', // Only related, no core
          'high',
        ),
      ],
      ['TEST_VAR'],
      ['test output'],
    );

    const errors = validateTemplate(template);
    expect(errors.some(e => e.field === 'sections')).toBe(true);
  });

  test('should reject template without required inputs', () => {
    const template = {
      id: 'bad-id',
      name: 'Bad',
      description: 'Bad',
      primaryGoal: 'Bad',
      sections: [],
      judgeStrategy: 'core-focused' as const,
      estimatedDuration: 100,
      requiredInputs: undefined as any, // Missing
      outputs: [],
      version: '1.0.0',
    };

    const errors = validateTemplate(template);
    expect(errors.some(e => e.field === 'requiredInputs')).toBe(true);
  });
});

describe('Variable Extraction & Substitution', () => {
  test('should extract variables from string', () => {
    const text = 'what is [TOPIC] and how does [COMPANY] use [TOPIC]';
    const vars = extractVariables(text);
    expect(vars).toEqual(['TOPIC', 'COMPANY']);
  });

  test('should handle no variables', () => {
    const text = 'simple question without variables';
    const vars = extractVariables(text);
    expect(vars).toHaveLength(0);
  });

  test('should substitute single variable', () => {
    const text = 'what is [TOPIC]';
    const result = substituteVariables(text, { TOPIC: 'collagen' });
    expect(result).toBe('what is collagen');
  });

  test('should substitute multiple variables', () => {
    const text = '[COMPANY] sells [PRODUCT] to [AUDIENCE]';
    const result = substituteVariables(text, {
      COMPANY: 'Acme Inc',
      PRODUCT: 'widgets',
      AUDIENCE: 'enterprises',
    });
    expect(result).toBe('Acme Inc sells widgets to enterprises');
  });

  test('should handle repeated variable substitution', () => {
    const text = '[TOPIC] and [TOPIC] again';
    const result = substituteVariables(text, { TOPIC: 'AI' });
    expect(result).toBe('AI and AI again');
  });
});

describe('Variable Validation', () => {
  test('should validate all required variables provided', () => {
    const result = validateVariables(['TOPIC', 'COMPANY'], {
      TOPIC: 'collagen',
      COMPANY: 'Acme Inc',
    });
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  test('should detect missing variables', () => {
    const result = validateVariables(['TOPIC', 'COMPANY'], {
      TOPIC: 'collagen',
      // COMPANY is missing
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('COMPANY');
  });

  test('should detect empty string variables', () => {
    const result = validateVariables(['TOPIC'], {
      TOPIC: '   ', // Empty/whitespace
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('TOPIC');
  });
});

describe('Template Parsing (parseTemplate)', () => {
  test('should parse creative-strategy template', () => {
    const template = getTemplate('creative-strategy');
    expect(template).toBeDefined();

    const { plan, errors } = parseTemplate(template!, {
      TOPIC: 'collagen supplements',
    });

    expect(errors).toHaveLength(0);
    expect(plan.templateId).toBe('creative-strategy');
    expect(plan.sections.length).toBeGreaterThan(0);
    expect(plan.coreThreshold).toBe(85);
  });

  test('should parse lead-generation template with all variables', () => {
    const template = getTemplate('lead-generation');
    const { plan, errors } = parseTemplate(template!, {
      COMPANY: 'B2B SaaS',
      DECISION_MAKER: 'CTO',
    });

    expect(errors).toHaveLength(0);
    expect(plan.variables.COMPANY).toBe('B2B SaaS');
    expect(plan.variables.DECISION_MAKER).toBe('CTO');
  });

  test('should error on missing required variables', () => {
    const template = getTemplate('creative-strategy');
    const { plan, errors } = parseTemplate(template!, {
      // Missing TOPIC
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Missing required inputs');
  });

  test('should substitute variables in queries', () => {
    const template = getTemplate('creative-strategy');
    const { plan } = parseTemplate(template!, {
      TOPIC: 'collagen',
    });

    // Check that [TOPIC] has been replaced
    const allQueries = plan.sections.flatMap(s => s.queries);
    expect(allQueries.some(q => q.includes('collagen'))).toBe(true);
    expect(allQueries.every(q => !q.includes('[TOPIC]'))).toBe(true);
  });

  test('should handle code analysis configs', () => {
    const template = getTemplate('github-single');
    const { plan } = parseTemplate(template!, {
      REPO_PATH: '/Users/mk/repos/myapp',
    });

    const archSection = plan.sections.find(s => s.id === 'architecture');
    expect(archSection?.codeAnalysisConfig).toBeDefined();
    expect(archSection?.codeAnalysisConfig?.paths).toContain('/Users/mk/repos/myapp');
  });

  test('should handle multi-repo comma-separated paths', () => {
    const template = getTemplate('github-multi');
    const { plan } = parseTemplate(template!, {
      REPO_PATHS: '/path/1,/path/2,/path/3',
      COMPARISON_FOCUS: 'API design',
    });

    const archSection = plan.sections.find(s => s.id === 'architecture-compare');
    expect(archSection?.codeAnalysisConfig?.paths).toContain('/path/1');
    expect(archSection?.codeAnalysisConfig?.paths).toContain('/path/2');
    expect(archSection?.codeAnalysisConfig?.paths).toContain('/path/3');
  });
});

describe('Core vs Related Sections', () => {
  test('should separate core and related sections', () => {
    const template = getTemplate('creative-strategy');
    const { plan } = parseTemplate(template!, { TOPIC: 'collagen' });

    const core = getCoreSections(plan);
    const related = getRelatedSections(plan);

    expect(core.length).toBeGreaterThan(0);
    expect(core.every(s => s.scope === 'core')).toBe(true);
    expect(related.every(s => s.scope === 'related')).toBe(true);
  });

  test('should identify core sections in general-research', () => {
    const template = getTemplate('general-research');
    const { plan } = parseTemplate(template!, { TOPIC: 'blockchain' });

    const core = getCoreSections(plan);
    const coreIds = core.map(s => s.id);

    expect(coreIds).toContain('fundamentals');
    expect(coreIds).toContain('current-state');
    expect(coreIds).toContain('applications');
    expect(coreIds).toContain('challenges');
  });

  test('should identify related sections in general-research', () => {
    const template = getTemplate('general-research');
    const { plan } = parseTemplate(template!, { TOPIC: 'blockchain' });

    const related = getRelatedSections(plan);
    const relatedIds = related.map(s => s.id);

    expect(relatedIds).toContain('related-angles');
    expect(relatedIds).toContain('expert-opinions');
  });
});

describe('Query Extraction', () => {
  test('should extract all queries in order', () => {
    const template = getTemplate('creative-strategy');
    const { plan } = parseTemplate(template!, { TOPIC: 'collagen' });

    const { queries, sectionIds } = extractQueries(plan);

    expect(queries.length).toBeGreaterThan(0);
    expect(sectionIds.length).toBe(queries.length);
  });

  test('should return core queries first', () => {
    const template = getTemplate('problem-solution');
    const { plan } = parseTemplate(template!, { PROBLEM: 'bug' });

    const { sectionIds } = extractQueries(plan);
    const core = getCoreSections(plan);
    const coreIds = core.map(s => s.id);

    // First queries should come from core sections
    const firstCoreSection = sectionIds[0];
    expect(coreIds).toContain(firstCoreSection);
  });

  test('should track section mapping', () => {
    const template = getTemplate('lead-generation');
    const { plan } = parseTemplate(template!, {
      COMPANY: 'SaaS',
      DECISION_MAKER: 'CTO',
    });

    const { queries, sectionIds } = extractQueries(plan);

    // Should have same length
    expect(sectionIds.length).toBe(queries.length);

    // Each query should be associated with a valid section
    sectionIds.forEach(id => {
      const section = plan.sections.find(s => s.id === id);
      expect(section).toBeDefined();
    });
  });
});

describe('All 6 Templates', () => {
  const templateIds = [
    'creative-strategy',
    'lead-generation',
    'general-research',
    'github-single',
    'github-multi',
    'problem-solution',
  ];

  test.each(templateIds)('should load template %s', id => {
    const template = getTemplate(id);
    expect(template).toBeDefined();
    expect(template?.id).toBe(id);
  });

  test.each(templateIds)('should validate template %s', id => {
    const template = getTemplate(id);
    const errors = validateTemplate(template!);
    expect(errors).toHaveLength(0);
  });

  test.each(templateIds)('should have at least one core section: %s', id => {
    const template = getTemplate(id);
    const core = template!.sections.filter(s => s.scope === 'core');
    expect(core.length).toBeGreaterThan(0);
  });

  test.each(templateIds)('should have required inputs: %s', id => {
    const template = getTemplate(id);
    expect(template!.requiredInputs.length).toBeGreaterThan(0);
  });
});
