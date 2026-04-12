/**
 * General Research Template — RACKS Philosophy
 *
 * Two-phase research for comprehensive topic exploration:
 *
 * PHASE 1: GENERAL FOUNDATION (50+ sources, ~45 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Broad understanding: What is it? Who's involved? How big? What are trends?
 * Goal: 60%+ coverage of fundamentals and current landscape
 *
 * PHASE 2: SPECIALIZED DEEP-DIVE (50+ sources, ~45 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deep expertise: Expert opinions, thought leaders, emerging research,
 * controversies, advanced concepts, expert perspectives
 * Goal: 80%+ coverage on expert insights and emerging trends
 *
 * Total: 100-130 sources, 120 minutes
 * Ideal for: Learning a topic, competitive analysis, industry overviews
 * Inputs: TOPIC
 */

import { createTemplate, createSection } from './templateRegistry';

export const generalResearchTemplate = createTemplate(
  'general-research',
  'General Topic Research',
  'Comprehensive overview of a topic including fundamentals, current state, and applications',
  'RACKS: Start with broad fundamentals, then deep-dive into expert opinions and emerging insights',
  [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: GENERAL FOUNDATION (20 queries → 50+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'general-definition',
      'PHASE 1: General — Definition & Fundamentals',
      'What it is, basic explanation, essential concepts',
      [
        'what is [TOPIC] - definition and explanation',
        '[TOPIC] key concepts and terminology explained',
        'essential fundamentals of [TOPIC]',
        'history and evolution of [TOPIC]',
        '[TOPIC] origins and how it developed',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-landscape',
      'PHASE 1: General — Current Landscape & Players',
      'Who\'s involved, major players, market size, current state',
      [
        'current state of [TOPIC] 2025',
        'major players and leaders in [TOPIC]',
        'who is involved in [TOPIC]',
        'market size and scale of [TOPIC]',
        '[TOPIC] landscape and industry overview',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',

      },
    ),

    createSection(
      'general-how-it-works',
      'PHASE 1: General — How It Works & Applications',
      'How it functions, real-world uses, practical applications',
      [
        'how does [TOPIC] work - basic mechanics',
        'applications of [TOPIC] in practice',
        'use cases and real-world examples [TOPIC]',
        'who uses [TOPIC] and target audiences',
        '[TOPIC] workflow and implementation',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'general-importance',
      'PHASE 1: General — Why It Matters',
      'Significance, relevance, benefits, problems it solves',
      [
        'why is [TOPIC] important and relevant',
        'what problem does [TOPIC] solve',
        'benefits and advantages of [TOPIC]',
        'impact of [TOPIC] on industries and society',
        '[TOPIC] relevance and future importance',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-trends-outlook',
      'PHASE 1: General — Current Trends & Outlook',
      'What\'s happening now, recent developments, future direction',
      [
        'current trends in [TOPIC] 2025',
        'recent developments and changes [TOPIC]',
        'emerging trends affecting [TOPIC]',
        'future outlook and trajectory of [TOPIC]',
        'upcoming changes in [TOPIC] landscape',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: SPECIALIZED DEEP-DIVE (30 queries → 80+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'spec-expert-perspectives',
      'PHASE 2: Specialized — Expert Perspectives & Thought Leaders',
      'Leading experts, academic research, authoritative voices on [TOPIC]',
      [
        'experts and thought leaders in [TOPIC]',
        'influential voices discussing [TOPIC]',
        'academic research on [TOPIC]',
        'expert opinions and analysis [TOPIC]',
        'recognized authorities in [TOPIC] field',
        'keynote speakers and influencers [TOPIC]',
        'research institutions studying [TOPIC]',
        'published research papers on [TOPIC]',
        'expert recommendations for [TOPIC]',
        'peer-reviewed studies on [TOPIC]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'spec-emerging-trends',
      'PHASE 2: Specialized — Emerging Trends & Innovations',
      'Cutting-edge developments, emerging approaches, innovation frontiers',
      [
        'emerging trends and innovations [TOPIC]',
        'cutting-edge research in [TOPIC]',
        'next-generation approaches to [TOPIC]',
        'experimental and novel [TOPIC] applications',
        'breakthrough developments [TOPIC]',
        'frontier topics in [TOPIC] field',
        'latest advancements in [TOPIC]',
        'bleeding-edge research on [TOPIC]',
        'innovative solutions in [TOPIC]',
        'future-forward thinking about [TOPIC]',
      ],
      'core',
      'critical',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-challenges-controversies',
      'PHASE 2: Specialized — Challenges, Limitations & Controversies',
      'Obstacles, debates, criticisms, areas of disagreement',
      [
        'challenges and limitations of [TOPIC]',
        'problems and obstacles in [TOPIC]',
        'criticisms of [TOPIC]',
        'controversies surrounding [TOPIC]',
        'debates in [TOPIC] field',
        'barriers to adoption of [TOPIC]',
        'risks and concerns about [TOPIC]',
        'ethical considerations [TOPIC]',
        'sustainability issues [TOPIC]',
        'technical challenges in [TOPIC]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'spec-advanced-concepts',
      'PHASE 2: Specialized — Advanced Concepts & Deep Dives',
      'Complex theories, specialized knowledge, sophisticated applications',
      [
        'advanced concepts in [TOPIC]',
        'specialized applications of [TOPIC]',
        'complex theories underlying [TOPIC]',
        'technical depth and nuance in [TOPIC]',
        'advanced research directions [TOPIC]',
        'specialized use cases and niches',
        'theoretical frameworks for [TOPIC]',
        'advanced best practices [TOPIC]',
        'expert-level understanding of [TOPIC]',
        'mastery resources and in-depth guides',
      ],
      'core',
      'high',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-resource-learning',
      'PHASE 2: Specialized — Resources, Learning & Community',
      'Best resources, learning materials, communities, educational paths',
      [
        'best resources for learning [TOPIC]',
        'top courses and certifications [TOPIC]',
        'learning paths for [TOPIC] mastery',
        'communities and forums for [TOPIC]',
        'conferences and events [TOPIC]',
        'books and publications [TOPIC]',
        'online courses and tutorials [TOPIC]',
        'community platforms and networks',
        'professional organizations [TOPIC]',
        'podcast and media resources [TOPIC]',
      ],
      'core',
      'high',
      {
        outputType: 'list',

      },
    ),
  ],
  ['TOPIC'],
  [
    'PHASE 1 Summary: Foundational definition and concepts',
    'PHASE 1 Summary: Current landscape and market overview',
    'PHASE 1 Summary: How it works and practical applications',
    'PHASE 2 Summary: Expert perspectives and academic research',
    'PHASE 2 Summary: Emerging trends and innovations',
    'PHASE 2 Summary: Challenges, limitations, and debates',
    'PHASE 2 Summary: Advanced concepts and learning resources',
  ],
  {
    estimatedDuration: 120 * 60 * 1000, // 120 minutes
    optionalInputs: ['DEPTH', 'SPECIFIC_ANGLE'],
    version: '2.0.0-RACKS', // NEW: RACKS version



  },
);
