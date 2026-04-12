/**
 * Creative Strategy Template — RACKS Philosophy
 *
 * Two-phase research for creative positioning discovery:
 *
 * PHASE 1: GENERAL FOUNDATION (50+ sources, ~45 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Broad understanding: What is the market? Who are the players?
 * How big is it? What are trends? What's the baseline context?
 * Goal: 60%+ coverage before specialization
 *
 * PHASE 2: SPECIALIZED DEEP-DIVE (50-80+ sources, ~45 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deep expertise: Customer psychology, emotional triggers, positioning gaps,
 * objections, proof strategies, unique angles competitors miss
 * Goal: 80%+ coverage on creative/emotional dimensions
 *
 * Total: 100-130 sources, 90 minutes
 * Ideal for: Creative briefs, positioning statements, unique angle discovery
 * Inputs: TOPIC (product/market), BRAND (optional), AUDIENCE (optional)
 */

import { createTemplate, createSection } from './templateRegistry';

export const creativeStrategyTemplate = createTemplate(
  'creative-strategy',
  'Creative Strategy',
  'Discover positioning angles, emotional motivations, and competitive differentiation',
  'RACKS: Start with broad market foundation, then deep-dive into creative psychology and positioning gaps',
  [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: GENERAL FOUNDATION (20 queries → 50+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'general-market-definition',
      'PHASE 1: General — What Is The Market?',
      'Definition, scope, basics, and landscape overview',
      [
        'what is the [TOPIC] market and category definition',
        '[TOPIC] market size and overall scale 2025',
        'who are the major companies in [TOPIC] market',
        'key players and leaders in [TOPIC]',
        '[TOPIC] market overview and landscape',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-history-context',
      'PHASE 1: General — History & Context',
      'Evolution, how we got here, baseline facts',
      [
        'history of [TOPIC] market and evolution',
        '[TOPIC] category origins and how it developed',
        'key milestones and turning points [TOPIC]',
        'how [TOPIC] market has changed over time',
        '[TOPIC] timeline of major developments 2020-2025',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-players-competitors',
      'PHASE 1: General — Major Players',
      'Who the significant competitors are, top companies',
      [
        'top 10 companies in [TOPIC] space',
        'major competitors in [TOPIC] market',
        'market leaders and their market share [TOPIC]',
        '[TOPIC] companies by size and influence',
        'emerging companies disrupting [TOPIC] market',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'general-trends-current',
      'PHASE 1: General — Current Trends',
      'What\'s happening now, market movements, zeitgeist',
      [
        'current trends in [TOPIC] market 2025',
        'emerging trends and shifts in [TOPIC]',
        'what\'s changing in [TOPIC] category',
        '[TOPIC] market growth trends and forecasts',
        'consumer sentiment trends [TOPIC]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-context-why',
      'PHASE 1: General — Why It Matters',
      'Relevance, importance, scope, and impact',
      [
        'why is [TOPIC] market important and growing',
        '[TOPIC] customer needs and why they buy',
        'problems [TOPIC] solves for customers',
        '[TOPIC] market relevance and future outlook',
        'role of [TOPIC] in broader market context',
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
      'spec-customer-psychology',
      'PHASE 2: Specialized — Customer Psychology & Desires',
      'Deep emotional drivers, aspirations, psychological motivations behind purchases',
      [
        'emotional motivations for [TOPIC] purchases',
        'psychological pain points [TOPIC] solves',
        'why customers choose [TOPIC] over alternatives',
        'aspirational identity when using [TOPIC]',
        'status and social motivations in [TOPIC]',
        'fear and anxiety [TOPIC] addresses',
        'desire hierarchy and motivation priority [TOPIC]',
        'subconscious triggers in [TOPIC] decision-making',
        'lifestyle aspirations connected to [TOPIC]',
        'belonging and community desires [TOPIC]',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'spec-positioning-gaps',
      'PHASE 2: Specialized — Positioning Gaps & Angles',
      'Where competitors position, what they miss, unique opportunities',
      [
        'how [TOPIC] competitors position emotionally',
        'competitor messaging and positioning angles',
        'positioning gaps in [TOPIC] market',
        'underutilized emotional angles [TOPIC]',
        'unique positioning opportunities [TOPIC]',
        'what competitors are NOT saying about [TOPIC]',
        'emotional positioning competitors miss',
        'alternative messaging strategies [TOPIC]',
        'blue ocean positioning opportunities [TOPIC]',
        'narrative angles competitors ignore [TOPIC]',
      ],
      'core',
      'critical',
      {
        outputType: 'comparison',

      },
    ),

    createSection(
      'spec-objections-proof',
      'PHASE 2: Specialized — Objections & Proof Strategy',
      'Common objections, how to overcome them, social proof sources',
      [
        'customer objections and hesitations about [TOPIC]',
        'concerns preventing [TOPIC] purchase decisions',
        'skepticism and doubt about [TOPIC]',
        'how to address common [TOPIC] objections',
        'scientific evidence supporting [TOPIC] benefits',
        'customer testimonials and success stories [TOPIC]',
        'before/after results and case studies [TOPIC]',
        'celebrity and influencer endorsements [TOPIC]',
        'third-party certifications and awards [TOPIC]',
        'social proof mechanisms in [TOPIC] category',
      ],
      'core',
      'critical',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-unique-angles',
      'PHASE 2: Specialized — Unique Creative Angles',
      'Cultural trends, storytelling, differentiation that resonates',
      [
        'cultural trends affecting [TOPIC] perception',
        'storytelling opportunities in [TOPIC]',
        'brand narrative angles in [TOPIC]',
        'controversial or unconventional angles [TOPIC]',
        'humor and tone strategies [TOPIC]',
        'authenticity and transparency angles [TOPIC]',
        'premium vs value positioning approaches',
        'sustainability/ethical angles in [TOPIC]',
        'innovation and cutting-edge messaging [TOPIC]',
        'niche/community positioning in [TOPIC]',
      ],
      'core',
      'high',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-audience-segments',
      'PHASE 2: Specialized — Audience Segmentation & Appeals',
      'Different audience groups, what resonates with each, segment-specific positioning',
      [
        'audience segments in [TOPIC] market',
        'different customer personas for [TOPIC]',
        'what messaging resonates with each segment [TOPIC]',
        'demographic differences in [TOPIC] preferences',
        'generational differences in [TOPIC] perception',
        'psychographic segments in [TOPIC]',
        'income/class considerations in [TOPIC] positioning',
        'geographic variations in [TOPIC] appeal',
        '[TOPIC] messaging for early adopters vs mainstream',
        'segment-specific pain points [TOPIC]',
      ],
      'core',
      'high',
      {
        outputType: 'analysis',

      },
    ),
  ],
  ['TOPIC'],
  [
    'PHASE 1 Summary: Market foundation (definition, size, players, trends, context)',
    'PHASE 2 Summary: Deep psychology and emotional drivers',
    'PHASE 2 Summary: Positioning gaps and unique angles',
    'PHASE 2 Summary: Objections framework and proof strategy',
    'PHASE 2 Summary: Creative differentiation opportunities',
    'PHASE 2 Summary: Audience segmentation and tailored appeals',
  ],
  {
    estimatedDuration: 90 * 60 * 1000, // 90 minutes
    optionalInputs: ['BRAND', 'AUDIENCE', 'BUDGET'],
    version: '2.0.0-RACKS', // NEW: RACKS version



  },
);
