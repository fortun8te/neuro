/**
 * GitHub Multi-Repository Comparison Template — RACKS Philosophy
 *
 * Two-phase comparative analysis across multiple repositories:
 *
 * PHASE 1: GENERAL FOUNDATION (40+ sources, ~20 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Broad understanding: What does each repo do? Who maintains them?
 * What are the differences? What's the tech stack? How mature are they?
 * Goal: 60%+ coverage of fundamentals and comparison basics
 *
 * PHASE 2: SPECIALIZED DEEP-DIVE (60-100+ sources, ~70 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deep expertise: Architecture comparison, code quality differences,
 * performance tradeoffs, best practices, lessons learned
 * Goal: 80%+ coverage on comparative architecture and quality
 *
 * Total: 100-140 sources, 90 minutes
 * Ideal for: Evaluating multiple solutions, learning from examples, standards
 * Inputs: REPO_PATHS (comma-separated), COMPARISON_FOCUS
 */

import { createTemplate, createSection } from './templateRegistry';

export const githubMultiTemplate = createTemplate(
  'github-multi',
  'Multi-Repository Comparison',
  'Compare multiple repositories to identify best practices, patterns, and differences',
  'RACKS: Start with repo comparison basics, then deep-dive into architecture and quality tradeoffs',
  [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: GENERAL FOUNDATION (15 queries → 40+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'general-comparison-overview',
      'PHASE 1: General — Repository Comparison Overview',
      'What each repo does, purpose, scope, and basic differences',
      [
        'purpose and scope comparison [REPO_PATHS]',
        'what each repository solves and does',
        'main use cases and applications [REPO_PATHS]',
        'how these projects compare at high level',
        'when to use each approach [REPO_PATHS]',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',
        codeAnalysis: {
          repos: ['[REPO_PATHS]'],
          analyze: ['structure'],
          depth: 'shallow',
        },

      },
    ),

    createSection(
      'general-maturity-status',
      'PHASE 1: General — Maturity & Project Status',
      'Development status, community health, maintenance, maturity',
      [
        'project maturity and maintenance status [REPO_PATHS]',
        'community activity and engagement comparison',
        'documentation quality across [REPO_PATHS]',
        'release cadence and development velocity',
        'contributor counts and project health [REPO_PATHS]',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',

      },
    ),

    createSection(
      'general-tech-stack',
      'PHASE 1: General — Technology Stack Choices',
      'Languages, frameworks, key technology differences',
      [
        'technology stack differences [REPO_PATHS]',
        'programming languages used [REPO_PATHS]',
        'framework and library choices',
        'language and version selection [REPO_PATHS]',
        'build tools and infrastructure approaches',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',

      },
    ),

    createSection(
      'general-positioning',
      'PHASE 1: General — Market & Design Philosophy',
      'How projects are positioned, philosophy, design goals',
      [
        'project goals and design philosophy [REPO_PATHS]',
        'target audience for each project',
        'design philosophy differences',
        'tradeoffs in approach across [REPO_PATHS]',
        'positioning and niche for each [REPO_PATHS]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: SPECIALIZED DEEP-DIVE (35 queries → 100+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'spec-architecture-comparison',
      'PHASE 2: Specialized — Architecture Comparison',
      'How each repo structures code, design patterns, module organization',
      [
        'architecture comparison across [REPO_PATHS]',
        'different architectural approaches to [COMPARISON_FOCUS]',
        'module organization and dependencies compared',
        'layering and separation of concerns [REPO_PATHS]',
        'design pattern usage across [REPO_PATHS]',
        'coupling and cohesion comparison',
        'component interaction patterns compared',
        'state management approaches [REPO_PATHS]',
        'event handling and messaging patterns',
        'extensibility and plugin architecture compared',
        'scalability architectures compared [REPO_PATHS]',
        'distributed system approaches if applicable',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',
        codeAnalysis: {
          repos: ['[REPO_PATHS]'],
          analyze: ['structure', 'patterns', 'differences'],
          depth: 'deep',
        },

      },
    ),

    createSection(
      'spec-quality-testing',
      'PHASE 2: Specialized — Quality & Testing Comparison',
      'Code quality, testing strategies, maintainability, technical debt',
      [
        'code quality comparison [REPO_PATHS]',
        'testing strategies across [REPO_PATHS]',
        'test coverage and testing philosophy differences',
        'error handling approaches compared',
        'code style and conventions [REPO_PATHS]',
        'technical debt assessment and comparison',
        'refactoring and maintenance strategies',
        'code duplication patterns',
        'complexity metrics and analysis',
        'maintainability and readability comparison',
        'documentation of code [REPO_PATHS]',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',
        codeAnalysis: {
          repos: ['[REPO_PATHS]'],
          analyze: ['quality', 'patterns', 'complexity'],
        },

      },
    ),

    createSection(
      'spec-performance-scalability',
      'PHASE 2: Specialized — Performance & Scalability',
      'Performance optimizations, caching, database, scaling approaches',
      [
        'performance optimization differences [REPO_PATHS]',
        'caching strategies compared [REPO_PATHS]',
        'database design comparison [REPO_PATH]',
        'scalability approach differences [REPO_PATHS]',
        'bottleneck identification across [REPO_PATHS]',
        'memory efficiency and resource usage',
        'concurrency handling approaches',
        'load balancing and distribution strategies',
        'monitoring and observability approaches',
        'performance trade-offs between approaches',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',
        codeAnalysis: {
          repos: ['[REPO_PATHS]'],
          analyze: ['complexity', 'patterns'],
        },

      },
    ),

    createSection(
      'spec-best-practices-lessons',
      'PHASE 2: Specialized — Best Practices & Lessons',
      'Identified best practices, lessons learned, recommended approach',
      [
        'best practices from [REPO_PATHS]',
        'common patterns across [REPO_PATHS]',
        'innovative approaches in [REPO_PATHS]',
        'what works well in each approach',
        'what to avoid based on [REPO_PATHS]',
        'lessons learned from each [REPO_PATHS]',
        'recommended approach for [COMPARISON_FOCUS]',
        'when to use each approach',
        'hybrid approaches combining strengths',
        'trade-off analysis and decision framework',
      ],
      'core',
      'high',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-feature-capability',
      'PHASE 2: Specialized — Features & Capabilities',
      'Feature completeness, capabilities, extensibility, plugins',
      [
        'feature completeness [REPO_PATHS]',
        'capabilities comparison [REPO_PATHS]',
        'feature implementation approaches compared',
        'extensibility mechanisms [REPO_PATHS]',
        'plugin and integration systems compared',
        'customization possibilities [REPO_PATHS]',
        'API and external integration support',
        'third-party tool integration',
        'community extensions and plugins',
        'roadmap and feature plans [REPO_PATHS]',
      ],
      'core',
      'high',
      {
        outputType: 'comparison',

      },
    ),
  ],
  ['REPO_PATHS', 'COMPARISON_FOCUS'],
  [
    'PHASE 1 Summary: Repository comparison overview',
    'PHASE 1 Summary: Maturity and project status comparison',
    'PHASE 1 Summary: Technology stack differences',
    'PHASE 2 Summary: Architecture comparison matrix',
    'PHASE 2 Summary: Code quality and testing scorecard',
    'PHASE 2 Summary: Performance and scalability analysis',
    'PHASE 2 Summary: Best practices and lessons learned',
    'PHASE 2 Summary: Features and capabilities matrix',
  ],
  {
    estimatedDuration: 90 * 60 * 1000, // 90 minutes
    optionalInputs: ['EVALUATION_CRITERIA', 'PREFERRED_OUTCOME'],
    version: '2.0.0-RACKS', // NEW: RACKS version



  },
);
