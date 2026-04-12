/**
 * Problem Solution Template — RACKS Philosophy
 *
 * Two-phase research for comprehensive problem-solving:
 *
 * PHASE 1: GENERAL FOUNDATION (50+ sources, ~25 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Broad understanding: What is the problem? Who experiences it?
 * Why does it happen? How common is it? What's the context?
 * Goal: 60%+ coverage of problem understanding
 *
 * PHASE 2: SPECIALIZED DEEP-DIVE (100-150+ sources, ~60 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deep expertise: Tutorials, community solutions, official docs,
 * workarounds, root causes, prevention, alternative approaches
 * Goal: 80%+ coverage on solution techniques and prevention
 *
 * Total: 150-200 sources, 90 minutes
 * Ideal for: Technical debugging, how-to research, solution finding
 * Inputs: PROBLEM, CONTEXT (optional)
 */

import { createTemplate, createSection } from './templateRegistry';

export const problemSolutionTemplate = createTemplate(
  'problem-solution',
  'Problem Solution Research',
  'Find solutions to problems through video tutorials, community advice, and technical Q&A',
  'RACKS: Start with problem understanding, then deep-dive into solutions and prevention',
  [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: GENERAL FOUNDATION (20 queries → 50+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'general-problem-definition',
      'PHASE 1: General — Problem Definition & Understanding',
      'What the problem is, clear explanation, scope',
      [
        'what is [PROBLEM] - detailed definition and explanation',
        '[PROBLEM] problem statement and scope',
        'how to recognize and identify [PROBLEM]',
        'common symptoms of [PROBLEM]',
        '[PROBLEM] impact and severity',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-prevalence-context',
      'PHASE 1: General — Prevalence & Context',
      'How common it is, who experiences it, when it happens',
      [
        'who experiences [PROBLEM] and frequency',
        'how common is [PROBLEM]',
        'when does [PROBLEM] occur',
        '[PROBLEM] in different [CONTEXT] scenarios',
        'environmental factors causing [PROBLEM]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-root-causes',
      'PHASE 1: General — Root Causes & Why It Happens',
      'Why the problem occurs, fundamental causes, triggers',
      [
        'why does [PROBLEM] occur',
        'root causes of [PROBLEM]',
        'technical reasons for [PROBLEM]',
        'common triggers of [PROBLEM]',
        'conditions that lead to [PROBLEM]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-impact-severity',
      'PHASE 1: General — Impact & Severity',
      'How serious the problem is, what it breaks, consequences',
      [
        'impact and consequences of [PROBLEM]',
        'severity levels of [PROBLEM]',
        'what [PROBLEM] breaks or affects',
        'how serious is [PROBLEM] in practice',
        'long-term vs short-term effects of [PROBLEM]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: SPECIALIZED DEEP-DIVE (40 queries → 100-150+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'spec-video-tutorials',
      'PHASE 2: Specialized — Video Tutorials & Walkthroughs',
      'Visual step-by-step guides, YouTube tutorials, video demonstrations',
      [
        'YouTube tutorials for [PROBLEM]',
        'video solutions for [PROBLEM]',
        'step-by-step video guides [PROBLEM]',
        'how-to videos solving [PROBLEM]',
        'video walkthroughs for [PROBLEM] in [CONTEXT]',
        'video explanations of [PROBLEM]',
        'tutorial series on [PROBLEM]',
        'video demonstrations of solutions',
        'screen recordings showing [PROBLEM] fix',
        'live coding sessions solving [PROBLEM]',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'spec-community-qa',
      'PHASE 2: Specialized — Community Solutions & Q&A',
      'Real answers from forums, Stack Overflow, Reddit, communities',
      [
        'Stack Overflow answers for [PROBLEM]',
        'Reddit solutions and discussions [PROBLEM]',
        'community forums discussing [PROBLEM]',
        'expert answers to [PROBLEM]',
        'Stack Exchange technical answers',
        'community best practices for [PROBLEM]',
        'crowdsourced solutions [PROBLEM]',
        'peer-to-peer advice [PROBLEM]',
        'community workarounds and hacks',
        'proven solutions from practitioners',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'spec-official-documentation',
      'PHASE 2: Specialized — Official Documentation & Technical Q&A',
      'Official docs, error messages, troubleshooting, FAQ',
      [
        'official documentation for [PROBLEM]',
        'technical explanations of [PROBLEM]',
        'error messages and solutions [PROBLEM]',
        'troubleshooting guide for [PROBLEM]',
        'FAQ and common questions [PROBLEM]',
        'vendor support documentation',
        'official knowledge base articles',
        'technical support guides [PROBLEM]',
        'official error resolution guide',
        'manufacturer documentation [PROBLEM]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'spec-workarounds-hacks',
      'PHASE 2: Specialized — Workarounds, Hacks & Quick Fixes',
      'Temporary solutions, quick fixes, and creative workarounds',
      [
        'workarounds for [PROBLEM]',
        'quick fixes for [PROBLEM]',
        'temporary solutions to [PROBLEM]',
        'hacks and tricks for [PROBLEM]',
        'emergency fixes for [PROBLEM]',
        'band-aid solutions [PROBLEM]',
        'creative approaches to [PROBLEM]',
        'unconventional solutions [PROBLEM]',
        'DIY fixes for [PROBLEM]',
        'improvised solutions [PROBLEM]',
      ],
      'core',
      'high',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'spec-best-practices-prevention',
      'PHASE 2: Specialized — Best Practices & Prevention',
      'How to prevent the problem, best practices, long-term solutions',
      [
        'best practices preventing [PROBLEM]',
        'recommended approaches for [PROBLEM]',
        'avoiding [PROBLEM] in [CONTEXT]',
        'prevention patterns and strategies',
        'industry standards addressing [PROBLEM]',
        'architectural patterns preventing [PROBLEM]',
        'design patterns avoiding [PROBLEM]',
        'preventive maintenance for [PROBLEM]',
        'long-term solutions vs quick fixes',
        'systemic approaches to [PROBLEM]',
      ],
      'core',
      'high',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-alternative-approaches',
      'PHASE 2: Specialized — Alternative Solutions & Approaches',
      'Different ways to solve, competing approaches, tool alternatives',
      [
        'alternative solutions to [PROBLEM]',
        'different approaches to [PROBLEM]',
        'competing methods for [PROBLEM]',
        'tool alternatives for [PROBLEM]',
        'library or framework alternatives [PROBLEM]',
        'different programming solutions [PROBLEM]',
        'comparison of solution approaches',
        'when to use each approach [PROBLEM]',
        'hybrid approaches combining multiple solutions',
        'custom solutions vs off-the-shelf [PROBLEM]',
      ],
      'core',
      'high',
      {
        outputType: 'comparison',

      },
    ),
  ],
  ['PROBLEM'],
  [
    'PHASE 1 Summary: Problem definition and understanding',
    'PHASE 1 Summary: Prevalence and context',
    'PHASE 1 Summary: Root causes and why it happens',
    'PHASE 2 Summary: Video tutorial and visual guide resources',
    'PHASE 2 Summary: Community Q&A solutions and discussions',
    'PHASE 2 Summary: Official documentation and troubleshooting',
    'PHASE 2 Summary: Workarounds, hacks, and quick fixes',
    'PHASE 2 Summary: Best practices and prevention strategies',
    'PHASE 2 Summary: Alternative approaches and solutions',
  ],
  {
    estimatedDuration: 90 * 60 * 1000, // 90 minutes (extended from 60)
    optionalInputs: ['CONTEXT', 'TECHNOLOGY_STACK', 'URGENCY'],
    version: '2.0.0-RACKS', // NEW: RACKS version



  },
);
