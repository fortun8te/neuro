/**
 * Lead Generation Template — RACKS Philosophy
 *
 * Two-phase research for finding and qualifying prospects:
 *
 * PHASE 1: GENERAL FOUNDATION (50+ sources, ~30 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Broad understanding: What is the market? Who are the players?
 * How big is it? What's the market maturity? What are trends?
 * Goal: 60%+ coverage of market landscape before specialization
 *
 * PHASE 2: SPECIALIZED DEEP-DIVE (100-150+ sources, ~60 min)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deep expertise: Find actual companies, decision-maker intel,
 * growth signals, contact info, buying patterns, budget cycles
 * Goal: 80%+ coverage on prospect qualification and outreach
 *
 * Total: 150-200 sources, 90 minutes
 * Ideal for: Sales prospecting, partnership outreach, market mapping
 * Inputs: COMPANY (target type/space), DECISION_MAKER (role)
 */

import { createTemplate, createSection } from './templateRegistry';

export const leadGenerationTemplate = createTemplate(
  'lead-generation',
  'Lead Generation Research',
  'Find companies to pitch to, understand decision-makers, and identify sales opportunities',
  'RACKS: Start with market foundation, then deep-dive into prospect finding and decision-maker intel',
  [
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: GENERAL FOUNDATION (20 queries → 50+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'general-market-definition',
      'PHASE 1: General — Market Definition',
      'What is the market, scope, and scale',
      [
        'what is [COMPANY] market and category definition',
        '[COMPANY] market size and growth rate 2025',
        '[COMPANY] market scope and boundaries',
        'how big is the [COMPANY] opportunity',
        '[COMPANY] market segments and verticals',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-key-players',
      'PHASE 1: General — Key Players & Landscape',
      'Major companies, market leaders, competitive landscape',
      [
        'major players and leaders in [COMPANY] market',
        'top companies in [COMPANY] space 2025',
        'market concentration and competitive landscape',
        'biggest [COMPANY] vendors and providers',
        '[COMPANY] market structure and power dynamics',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'general-maturity-trends',
      'PHASE 1: General — Market Maturity & Trends',
      'Growth stage, current trends, market direction',
      [
        '[COMPANY] market growth trends and forecasts 2025',
        'emerging opportunities in [COMPANY] space',
        '[COMPANY] market maturity and growth stage',
        'consolidation and M&A activity [COMPANY]',
        'shifting customer needs in [COMPANY] market',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-customer-context',
      'PHASE 1: General — Customer Types & Buying Context',
      'Who buys, how they decide, buying patterns',
      [
        'who buys [COMPANY] type solutions and services',
        'customer types and buying patterns [COMPANY]',
        'how [COMPANY] customers make purchase decisions',
        'budget allocation for [COMPANY] solutions',
        '[COMPANY] sales cycle length and timing',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'general-adjacent-verticals',
      'PHASE 1: General — Adjacent Markets & Verticals',
      'Industries and markets that could benefit',
      [
        'industries that could use [COMPANY] solutions',
        'adjacent verticals to [COMPANY] market',
        'expansion opportunities from [COMPANY]',
        'secondary and tertiary [COMPANY] markets',
        'complementary business types to [COMPANY]',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: SPECIALIZED DEEP-DIVE (40 queries → 100-150+ sources)
    // ═══════════════════════════════════════════════════════════════════════

    createSection(
      'spec-prospect-companies',
      'PHASE 2: Specialized — Finding Prospect Companies',
      'Actual companies to target, company research, growth signals',
      [
        'list of companies in [COMPANY] space similar to [target]',
        'growth-stage [COMPANY] companies needing [SOLUTION]',
        '[COMPANY] companies with funding rounds 2024-2025',
        'recently funded startups in [COMPANY] space',
        'Series A/B funded [COMPANY] companies',
        '[COMPANY] companies expanding to new markets',
        'private equity backed companies in [COMPANY]',
        '[COMPANY] company directories and databases',
        'fastest growing [COMPANY] companies',
        'new entrants and challengers in [COMPANY]',
        '[COMPANY] companies expanding headcount',
        'profitable and growing [COMPANY] businesses',
      ],
      'core',
      'critical',
      {
        outputType: 'list',

      },
    ),

    createSection(
      'spec-decision-makers',
      'PHASE 2: Specialized — Decision-Maker Intelligence',
      'Who decides, roles, responsibilities, contact info, LinkedIn insights',
      [
        '[DECISION_MAKER] role and responsibilities in [COMPANY]',
        'titles of [DECISION_MAKER] making [SOLUTION] decisions',
        '[DECISION_MAKER] decision-making authority and influence',
        'how [DECISION_MAKER] evaluates [SOLUTION] vendors',
        'key concerns and priorities of [DECISION_MAKER]',
        '[DECISION_MAKER] career paths and background',
        'LinkedIn profiles and groups for [DECISION_MAKER]',
        'finding [DECISION_MAKER] contact information',
        'email patterns and contact strategies [DECISION_MAKER]',
        'influencers and stakeholders in [COMPANY] buying process',
      ],
      'core',
      'critical',
      {
        outputType: 'analysis',

      },
    ),

    createSection(
      'spec-buying-signals',
      'PHASE 2: Specialized — Buying Signals & Timing',
      'When they buy, what triggers purchases, budget cycles',
      [
        'buying signals indicating [COMPANY] needs [SOLUTION]',
        'budget allocation cycles in [COMPANY]',
        '[COMPANY] fiscal year and spending timing',
        'trigger events causing [COMPANY] to buy',
        'growth milestones triggering [SOLUTION] needs',
        'regulatory or compliance changes affecting [COMPANY]',
        'technology upgrades and refresh cycles [COMPANY]',
        'seasonal patterns in [COMPANY] purchasing',
        'how to identify [COMPANY] in buying mode',
        'decision timeline from awareness to purchase',
      ],
      'core',
      'critical',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-icp-qualification',
      'PHASE 2: Specialized — Ideal Customer Profile (ICP)',
      'Best-fit companies, qualification criteria, company characteristics',
      [
        'ideal company size for [SOLUTION]',
        'ideal revenue range of [SOLUTION] customers',
        'company stage for [SOLUTION] (startup/growth/enterprise)',
        'geographic focus for [SOLUTION] opportunities',
        'industry fit and vertical specialization',
        'company growth rate indicators [SOLUTION] fit',
        'team size and structure [SOLUTION] adopters',
        'technical infrastructure requirements [SOLUTION]',
        'cultural fit for [SOLUTION]',
        'past technology adoption patterns',
      ],
      'core',
      'critical',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-outreach-strategy',
      'PHASE 2: Specialized — Outreach & Engagement',
      'How to reach, messaging, common objections, relationship building',
      [
        'effective outreach strategies for [COMPANY] prospects',
        'cold email and messaging that works [COMPANY]',
        'LinkedIn strategies for [COMPANY] professionals',
        'common objections from [DECISION_MAKER] and how to overcome',
        'relationship building strategies with [COMPANY] buyers',
        'events and conferences for [COMPANY] decision-makers',
        '[COMPANY] industry associations and networking groups',
        'referral and warm introduction strategies',
        'multi-touch outreach cadence [COMPANY]',
        'partnership and collaboration opportunities',
      ],
      'core',
      'high',
      {
        outputType: 'strategic',

      },
    ),

    createSection(
      'spec-competitive-landscape',
      'PHASE 2: Specialized — Competitive Positioning',
      'How to position against competitors, differentiation for [COMPANY]',
      [
        'alternative solutions [COMPANY] might choose',
        'how [SOLUTION] compares to [COMPANY] alternatives',
        'competitive advantages for [COMPANY] prospects',
        'pricing and value positioning [COMPANY]',
        'why [COMPANY] customers choose [SOLUTION]',
        'objections from competitor comparisons',
        'win/loss analysis in [COMPANY] space',
        'unique positioning for [COMPANY] vertical',
      ],
      'core',
      'high',
      {
        outputType: 'comparison',

      },
    ),
  ],
  ['COMPANY', 'DECISION_MAKER'],
  [
    'PHASE 1 Summary: Market landscape and player overview',
    'PHASE 2 Summary: Qualified prospect list with company details',
    'PHASE 2 Summary: Decision-maker profiles and contact strategies',
    'PHASE 2 Summary: Buying signals and timing framework',
    'PHASE 2 Summary: Ideal Customer Profile (ICP) scorecard',
    'PHASE 2 Summary: Outreach and engagement playbook',
  ],
  {
    estimatedDuration: 90 * 60 * 1000, // 90 minutes
    optionalInputs: ['BUDGET_RANGE', 'GEOGRAPHY', 'INDUSTRY'],
    version: '2.0.0-RACKS', // NEW: RACKS version



  },
);
