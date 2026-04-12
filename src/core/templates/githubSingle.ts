/**
 * GitHub Single Repository Analysis Template — RACKS Philosophy
 *
 * Two-phase analysis of a single repository:
 *
 * PHASE 1: GENERAL FOUNDATION (40+ sources, ~20 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Broad understanding: What is the repo? What does it do?
 * Who maintains it? What's the tech stack? How mature is it?
 * Goal: 60%+ coverage of fundamentals and landscape
 *
 * PHASE 2: SPECIALIZED DEEP-DIVE (40-60+ sources, ~40 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deep expertise: Code patterns, testing approach, performance,
 * security, scalability, quality metrics, documentation
 * Goal: 80%+ coverage on code quality and architecture
 *
 * Total: 80-100 sources, 60 minutes
 * Ideal for: Code review, architecture understanding, quality assessment
 * Inputs: REPO_PATH (absolute path or GitHub URL)
 */

import { createTemplate, createSection } from './templateRegistry';

export const githubSingleTemplate = createTemplate(
  'github-single',
  'Single Repository Analysis',
  'Analyze repository architecture, code quality, and technical patterns',
  'RACKS: Start with repo fundamentals, then deep-dive into code quality and architecture',
  [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: GENERAL FOUNDATION (15 queries → 40+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'general-fundamentals',
      'PHASE 1: General — Repository Fundamentals',
      'What the repo is, what it does, purpose and overview',
      [
        '[REPO_PATH] project purpose and what it does',
        '[REPO_PATH] README and project overview',
        '[REPO_PATH] project description and goals',
        '[REPO_PATH] main use cases and applications',
        '[REPO_PATH] problem it solves',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',
        codeAnalysis: {
          path: '[REPO_PATH]',
          analyze: ['structure'],
          depth: 'shallow',
        },

      },
    ),

    createSection(
      'general-status-maturity',
      'PHASE 1: General — Project Status & Maturity',
      'Development status, maintenance, community health, activity',
      [
        '[REPO_PATH] project status and maintenance level',
        '[REPO_PATH] active development status 2025',
        '[REPO_PATH] contributors and maintainers',
        '[REPO_PATH] community activity and engagement',
        '[REPO_PATH] issue tracker and pull requests',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-tech-overview',
      'PHASE 1: General — Technology & Stack Overview',
      'Language, frameworks, core libraries, build system',
      [
        '[REPO_PATH] programming language and version',
        '[REPO_PATH] frameworks and core libraries',
        '[REPO_PATH] major dependencies and versions',
        '[REPO_PATH] build tools and configuration',
        '[REPO_PATH] external service integrations',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'general-structure',
      'PHASE 1: General — Directory Structure & Organization',
      'How the code is organized, high-level layout',
      [
        '[REPO_PATH] directory structure and organization',
        '[REPO_PATH] module layout and separation',
        '[REPO_PATH] entry points and main files',
        '[REPO_PATH] file organization strategy',
        '[REPO_PATH] configuration file overview',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',
        codeAnalysis: {
          path: '[REPO_PATH]',
          analyze: ['structure'],
          depth: 'shallow',
        },

      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: SPECIALIZED DEEP-DIVE (30 queries → 60+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'spec-architecture-patterns',
      'PHASE 2: Specialized — Architecture & Code Patterns',
      'Architectural decisions, design patterns, module dependencies',
      [
        '[REPO_PATH] architectural pattern and design',
        '[REPO_PATH] design patterns and conventions',
        '[REPO_PATH] module organization and dependencies',
        '[REPO_PATH] layering and separation of concerns',
        '[REPO_PATH] coupling and cohesion analysis',
        '[REPO_PATH] component interaction patterns',
        '[REPO_PATH] data flow and control flow',
        '[REPO_PATH] event handling and messaging patterns',
        '[REPO_PATH] state management approach',
        '[REPO_PATH] plugin or extension architecture',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',
        codeAnalysis: {
          path: '[REPO_PATH]',
          analyze: ['structure', 'patterns'],
          depth: 'deep',
        },

      },
    ),

    createSection(
      'spec-code-quality',
      'PHASE 2: Specialized — Code Quality & Testing',
      'Testing strategy, error handling, code practices, technical debt',
      [
        '[REPO_PATH] testing approach and strategy',
        '[REPO_PATH] test coverage metrics and analysis',
        '[REPO_PATH] error handling and exception management',
        '[REPO_PATH] code style and conventions enforcement',
        '[REPO_PATH] technical debt assessment',
        '[REPO_PATH] refactoring opportunities',
        '[REPO_PATH] code duplication analysis',
        '[REPO_PATH] complexity metrics and hotspots',
        '[REPO_PATH] maintainability assessment',
        '[REPO_PATH] code review practices',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',
        codeAnalysis: {
          path: '[REPO_PATH]',
          analyze: ['quality', 'patterns', 'complexity'],
          depth: 'deep',
        },

      },
    ),

    createSection(
      'spec-performance-scalability',
      'PHASE 2: Specialized — Performance & Scalability',
      'Performance optimization, bottlenecks, caching, database, scaling',
      [
        '[REPO_PATH] performance optimization techniques',
        '[REPO_PATH] caching strategies and implementation',
        '[REPO_PATH] database design and query optimization',
        '[REPO_PATH] memory usage and resource efficiency',
        '[REPO_PATH] concurrency and parallelization',
        '[REPO_PATH] bottleneck identification and analysis',
        '[REPO_PATH] load testing and stress testing',
        '[REPO_PATH] horizontal and vertical scaling approach',
        '[REPO_PATH] distributed system considerations',
        '[REPO_PATH] performance monitoring and metrics',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',
        codeAnalysis: {
          path: '[REPO_PATH]',
          analyze: ['complexity', 'patterns'],
        },

      },
    ),

    createSection(
      'spec-security-compliance',
      'PHASE 2: Specialized — Security & Compliance',
      'Security practices, authentication, data protection, vulnerabilities',
      [
        '[REPO_PATH] security practices and architecture',
        '[REPO_PATH] authentication and authorization mechanisms',
        '[REPO_PATH] data protection and encryption approach',
        '[REPO_PATH] input validation and sanitization',
        '[REPO_PATH] security vulnerabilities or known issues',
        '[REPO_PATH] compliance requirements (GDPR, SOC2, etc.)',
        '[REPO_PATH] security testing and vulnerability scanning',
        '[REPO_PATH] dependency vulnerability management',
        '[REPO_PATH] secrets management strategy',
        '[REPO_PATH] audit logging and monitoring',
      ],
      'core',
      'high',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'spec-documentation-dx',
      'PHASE 2: Specialized — Documentation & Developer Experience',
      'Code documentation, README, setup, contribution guide, API docs',
      [
        '[REPO_PATH] documentation quality and completeness',
        '[REPO_PATH] README content and clarity',
        '[REPO_PATH] inline code documentation and comments',
        '[REPO_PATH] API documentation and specifications',
        '[REPO_PATH] developer setup and getting started guide',
        '[REPO_PATH] contribution guidelines and code of conduct',
        '[REPO_PATH] architecture documentation',
        '[REPO_PATH] troubleshooting and FAQ',
        '[REPO_PATH] examples and tutorials',
        '[REPO_PATH] change log and version history',
      ],
      'core',
      'high',
      {
        outputType: 'list',

      },
    ),
  ],
  ['REPO_PATH'],
  [
    'PHASE 1 Summary: Repository fundamentals and purpose',
    'PHASE 1 Summary: Project status and technology stack',
    'PHASE 1 Summary: Code structure and organization',
    'PHASE 2 Summary: Architecture and design patterns',
    'PHASE 2 Summary: Code quality and testing strategy',
    'PHASE 2 Summary: Performance and scalability analysis',
    'PHASE 2 Summary: Security and compliance assessment',
    'PHASE 2 Summary: Documentation and developer experience',
  ],
  {
    estimatedDuration: 60 * 60 * 1000, // 60 minutes
    optionalInputs: ['REPO_URL', 'FOCUS_AREA'],
    version: '2.0.0-RACKS', // NEW: RACKS version



  },
);
