/**
 * Competitor & Niche Analyzer — Usage Example
 *
 * This example demonstrates how to use the CompetitorNicheAnalyzer
 * to analyze competitors, identify positioning gaps, find audience gaps,
 * and detect supply/demand mismatches for market intelligence.
 */

import {
  CompetitorNicheAnalyzer,
  CompetitorType,
  MarketPositioning,
  MarketMaturity,
  type CompetitorAnalysis,
  type NicheAnalysis,
} from '../services/competitorNicheAnalyzer';

/**
 * Example: Analyze skincare market for a hypothetical "GlowUp" brand
 */
async function exampleSkincarAnalysis() {
  console.log('=== Competitor & Niche Analyzer Example ===\n');

  // Initialize analyzer
  const analyzer = new CompetitorNicheAnalyzer(
    'GlowUp Skincare',
    'Premium Natural Skincare'
  );

  // Step 1: Add competitors
  console.log('Step 1: Adding competitors to analysis...\n');

  const competitors: CompetitorAnalysis[] = [
    {
      id: 'comp-1',
      name: 'Glossier',
      type: CompetitorType.DIRECT,
      positioning: MarketPositioning.PREMIUM_NATURAL,
      priceRange: {
        min: 28,
        max: 88,
        currency: 'USD',
        typical: 58,
      },
      productRange: {
        breadth: 'broad',
        depth: 'moderate',
        categories: [
          'Cleansers',
          'Moisturizers',
          'Serums',
          'Sunscreen',
          'Makeup',
        ],
        keyProducts: ['Milky Jelly Cleanser', 'Priming Moisturizer', 'Boy Brow'],
      },
      distribution: {
        channels: ['online', 'retail', 'flagship stores'],
        geographies: ['USA', 'Europe', 'Asia', 'Canada'],
        omnichannel: true,
      },
      brandStrength: {
        followers: 3200000,
        reviews: 45000,
        averageRating: 4.2,
        sentiment: 'positive',
        sentimentScore: 0.72,
        mentionVolume: 8500,
        trendingDirection: 'stable',
      },
      strengths: [
        'Strong brand identity and Gen Z loyalty',
        'Excellent digital marketing',
        'High social media engagement',
        'Innovative product development',
      ],
      weaknesses: [
        'Premium pricing limits market reach',
        'Limited dermatological focus',
        'Sustainability messaging could be stronger',
      ],
      marketShareEstimate: 8.5,
      growthRate: 18,
      fundingStatus: 'IPO 2023',
      targetAudience: [
        'Women 18-35',
        'Gen Z',
        'Urban professionals',
        'Social media native',
      ],
      uniqueValueProposition: 'Beauty from the inside: clean, effective, inclusive',
    },
    {
      id: 'comp-2',
      name: 'The Ordinary',
      type: CompetitorType.DIRECT,
      positioning: MarketPositioning.AFFORDABLE_ACCESSIBLE,
      priceRange: {
        min: 4,
        max: 14,
        currency: 'USD',
        typical: 8,
      },
      productRange: {
        breadth: 'broad',
        depth: 'deep',
        categories: [
          'Actives',
          'Serums',
          'Moisturizers',
          'Oils',
          'Treatments',
        ],
        keyProducts: [
          'Niacinamide 10%',
          'Hyaluronic Acid 2%',
          'Retinol 0.2%',
        ],
      },
      distribution: {
        channels: ['online', 'marketplace'],
        geographies: ['Global'],
        omnichannel: false,
      },
      brandStrength: {
        followers: 2100000,
        reviews: 89000,
        averageRating: 4.5,
        sentiment: 'positive',
        sentimentScore: 0.81,
        mentionVolume: 12000,
        trendingDirection: 'up',
      },
      strengths: [
        'Extreme affordability',
        'Ingredient transparency',
        'Strong scientific backing',
        'Cult following among skincare enthusiasts',
      ],
      weaknesses: [
        'Minimal packaging',
        'Limited customer service',
        'Steep learning curve for users',
      ],
      marketShareEstimate: 6.2,
      growthRate: 34,
      fundingStatus: 'Private',
      targetAudience: [
        'Budget-conscious',
        'Skincare enthusiasts',
        'Reddit community',
        'Young professionals',
      ],
      uniqueValueProposition:
        'Clinical-grade ingredients at unbeatable prices',
    },
    {
      id: 'comp-3',
      name: 'SK-II',
      type: CompetitorType.DIRECT,
      positioning: MarketPositioning.LUXURY_PREMIUM,
      priceRange: {
        min: 65,
        max: 380,
        currency: 'USD',
        typical: 165,
      },
      productRange: {
        breadth: 'moderate',
        depth: 'deep',
        categories: [
          'Essences',
          'Toners',
          'Moisturizers',
          'Masks',
          'Eye Care',
        ],
        keyProducts: ['Facial Treatment Essence', 'GenOptics Essence', 'Cleanser'],
      },
      distribution: {
        channels: ['luxury retail', 'online', 'department stores'],
        geographies: ['Japan', 'USA', 'Europe', 'Asia'],
        omnichannel: true,
      },
      brandStrength: {
        followers: 980000,
        reviews: 12000,
        averageRating: 4.6,
        sentiment: 'positive',
        sentimentScore: 0.85,
        mentionVolume: 4200,
        trendingDirection: 'stable',
      },
      strengths: [
        'Japanese heritage and prestige',
        'Patented Pitera ingredient',
        'Luxury positioning',
        'Strong loyalty in Asia',
      ],
      weaknesses: [
        'Very high price point',
        'Limited accessibility',
        'Aging brand perception',
      ],
      marketShareEstimate: 4.1,
      growthRate: 8,
      fundingStatus: 'Public (Procter & Gamble subsidiary)',
      targetAudience: [
        'Luxury consumers',
        'Women 35-55',
        'Professionals',
        'Asian markets',
      ],
      uniqueValueProposition: 'Luxury Japanese skincare with patented Pitera essence',
    },
    {
      id: 'comp-4',
      name: 'La Roche Posay',
      type: CompetitorType.DIRECT,
      positioning: MarketPositioning.CLINICAL_SCIENCE,
      priceRange: {
        min: 10,
        max: 65,
        currency: 'USD',
        typical: 35,
      },
      productRange: {
        breadth: 'broad',
        depth: 'moderate',
        categories: [
          'Acne',
          'Sensitive',
          'Anti-aging',
          'Sun care',
          'Hydration',
        ],
        keyProducts: ['Toleriane Hydrating Cleanser', 'Cicaplast Balm', 'Anthelios'],
      },
      distribution: {
        channels: ['pharmacy', 'online', 'dermatology offices'],
        geographies: ['Global'],
        omnichannel: true,
      },
      brandStrength: {
        followers: 1200000,
        reviews: 34000,
        averageRating: 4.4,
        sentiment: 'positive',
        sentimentScore: 0.78,
        mentionVolume: 6800,
        trendingDirection: 'stable',
      },
      strengths: [
        'Dermatologist recommended',
        'Clinical efficacy',
        'Sensitive skin expertise',
        'Accessible price point',
      ],
      weaknesses: [
        'Less glamorous positioning',
        'Limited luxury appeal',
        'Smaller social following',
      ],
      marketShareEstimate: 5.8,
      growthRate: 12,
      fundingStatus: 'Public (L\'Oréal subsidiary)',
      targetAudience: [
        'Sensitive skin consumers',
        'Acne sufferers',
        'Clinical focus',
        'Women 25-45',
      ],
      uniqueValueProposition:
        'Dermatologist-recommended clinical skincare for sensitive skin',
    },
    {
      id: 'comp-5',
      name: 'Drunk Elephant',
      type: CompetitorType.DIRECT,
      positioning: MarketPositioning.PREMIUM_NATURAL,
      priceRange: {
        min: 32,
        max: 78,
        currency: 'USD',
        typical: 54,
      },
      productRange: {
        breadth: 'broad',
        depth: 'moderate',
        categories: [
          'Cleansers',
          'Serums',
          'Moisturizers',
          'Masks',
          'Sunscreen',
        ],
        keyProducts: ['C-Firma Serum', 'Protini Moisturizer', 'Umbra Tinta'],
      },
      distribution: {
        channels: ['online', 'Sephora', 'retailer partnerships'],
        geographies: ['USA', 'Canada', 'Europe'],
        omnichannel: true,
      },
      brandStrength: {
        followers: 2800000,
        reviews: 52000,
        averageRating: 4.3,
        sentiment: 'mixed',
        sentimentScore: 0.65,
        mentionVolume: 7200,
        trendingDirection: 'stable',
      },
      strengths: [
        'Clean beauty positioning',
        'Strong influencer partnerships',
        'Luxury aesthetic',
        'Scientific formulations',
      ],
      weaknesses: [
        'Premium pricing controversy',
        'Some ingredient scrutiny',
        'Market saturation in clean beauty',
      ],
      marketShareEstimate: 5.2,
      growthRate: 15,
      fundingStatus: 'Acquired by Unilever (2021)',
      targetAudience: [
        'Clean beauty advocates',
        'Women 25-40',
        'Affluent consumers',
        'Wellness-focused',
      ],
      uniqueValueProposition:
        'Clean, non-toxic skincare without compromise on efficacy',
    },
    {
      id: 'comp-6',
      name: 'CeraVe',
      type: CompetitorType.INDIRECT,
      positioning: MarketPositioning.AFFORDABLE_ACCESSIBLE,
      priceRange: {
        min: 8,
        max: 25,
        currency: 'USD',
        typical: 14,
      },
      productRange: {
        breadth: 'broad',
        depth: 'moderate',
        categories: [
          'Moisturizers',
          'Cleansers',
          'Sun care',
          'Acne',
          'Treatments',
        ],
        keyProducts: ['Moisturizing Cream', 'Foaming Facial Cleanser', 'SPF 50'],
      },
      distribution: {
        channels: ['pharmacy', 'retail', 'online'],
        geographies: ['North America', 'Europe'],
        omnichannel: true,
      },
      brandStrength: {
        followers: 890000,
        reviews: 67000,
        averageRating: 4.5,
        sentiment: 'positive',
        sentimentScore: 0.80,
        mentionVolume: 5200,
        trendingDirection: 'up',
      },
      strengths: [
        'Dermatologist recommended',
        'Affordable price',
        'Ceramide formulations',
        'Wide accessibility',
      ],
      weaknesses: [
        'Uninspiring brand image',
        'Limited luxury appeal',
        'Smaller social presence',
      ],
      marketShareEstimate: 7.1,
      growthRate: 11,
      fundingStatus: 'Public (Nestlé subsidiary)',
      targetAudience: [
        'Budget-conscious',
        'Sensitive skin',
        'Clinical focus',
        'Families',
      ],
      uniqueValueProposition: 'Affordable dermatologist-recommended skincare',
    },
    {
      id: 'comp-7',
      name: 'Olaplex',
      type: CompetitorType.ADJACENT,
      positioning: MarketPositioning.INNOVATIVE_TECH,
      priceRange: {
        min: 30,
        max: 75,
        currency: 'USD',
        typical: 48,
      },
      productRange: {
        breadth: 'moderate',
        depth: 'moderate',
        categories: [
          'Hair care',
          'Treatments',
          'Styling',
          'Hair masks',
        ],
        keyProducts: ['No. 3 Hair Perfector', 'No. 4 Bond Maintenance Shampoo'],
      },
      distribution: {
        channels: ['online', 'salons', 'Sephora'],
        geographies: ['Global'],
        omnichannel: true,
      },
      brandStrength: {
        followers: 1400000,
        reviews: 28000,
        averageRating: 4.4,
        sentiment: 'positive',
        sentimentScore: 0.76,
        mentionVolume: 4100,
        trendingDirection: 'up',
      },
      strengths: [
        'Patented bond-building technology',
        'Professional salon partnerships',
        'Strong growth trajectory',
        'Influencer adoption',
      ],
      weaknesses: [
        'Higher price point',
        'Limited product range',
        'Newer brand',
      ],
      marketShareEstimate: 2.1,
      growthRate: 42,
      fundingStatus: 'Private (Series E)',
      targetAudience: [
        'Hair-conscious women',
        'Premium beauty',
        'Professional users',
      ],
      uniqueValueProposition:
        'Revolutionary bond-building hair care technology',
    },
    {
      id: 'comp-8',
      name: 'Inkey List',
      type: CompetitorType.EMERGING,
      positioning: MarketPositioning.PREMIUM_NATURAL,
      priceRange: {
        min: 12,
        max: 68,
        currency: 'USD',
        typical: 38,
      },
      productRange: {
        breadth: 'broad',
        depth: 'moderate',
        categories: [
          'Serums',
          'Moisturizers',
          'Cleansers',
          'Supplements',
        ],
        keyProducts: [
          'Hyaluronic Acid',
          'Caffeine Eye Cream',
          'Salicylic Acid Cleanser',
        ],
      },
      distribution: {
        channels: ['online', 'marketplace'],
        geographies: ['Global'],
        omnichannel: false,
      },
      brandStrength: {
        followers: 650000,
        reviews: 15000,
        averageRating: 4.3,
        sentiment: 'positive',
        sentimentScore: 0.74,
        mentionVolume: 2100,
        trendingDirection: 'up',
      },
      strengths: [
        'Transparent ingredient labeling',
        'Affordable luxury positioning',
        'Educational content',
        'Fast growth',
      ],
      weaknesses: [
        'Limited brand awareness',
        'Smaller customer base',
        'Less proven track record',
      ],
      marketShareEstimate: 1.8,
      growthRate: 52,
      fundingStatus: 'Series B',
      targetAudience: [
        'Ingredient-conscious',
        'Millennials',
        'Digital natives',
      ],
      uniqueValueProposition: 'Transparent, affordable luxury skincare with education',
    },
  ];

  analyzer.addCompetitors(competitors);
  console.log(`Added ${competitors.length} competitors\n`);

  // Step 2: Set niche analysis data
  console.log('Step 2: Setting niche analysis data...\n');

  const nicheAnalysis: NicheAnalysis = {
    categoryName: 'Premium Natural Skincare',
    marketSize: {
      tam: '$60B global skincare market',
      sam: '$18B premium natural segment',
      som: '$2B addressable in US alone',
    },
    marketGrowth: {
      cagr: 7.8,
      period: '2023-2028',
      confidence: 'high',
    },
    maturity: MarketMaturity.GROWTH,
    keyTrends: [
      {
        trend: 'Clean beauty movement',
        strength: 'growing',
        examples: [
          'Non-toxic formulations',
          'Ingredient transparency',
        ],
      },
      {
        trend: 'Personalization & customization',
        strength: 'growing',
        examples: [
          'Skin type assessment',
          'AI-powered recommendations',
        ],
      },
      {
        trend: 'Sustainability focus',
        strength: 'dominant',
        examples: [
          'Eco-friendly packaging',
          'Refillable containers',
        ],
      },
      {
        trend: 'Tech-infused skincare',
        strength: 'emerging',
        examples: [
          'Smart mirrors',
          'Data-driven formulations',
        ],
      },
    ],
    willingness: {
      assessment:
        'High willingness to pay premium for clean, effective, sustainable skincare',
      priceSweets: ['$30-60 for serums', '$20-40 for moisturizers', '$10-25 for cleansers'],
      premiumWilling: 67,
    },
    distributionChannels: [
      {
        channel: 'Direct-to-Consumer (DTC)',
        prominence: 9,
        effectiveness: 'mature',
      },
      {
        channel: 'Sephora & Ulta',
        prominence: 8,
        effectiveness: 'mature',
      },
      {
        channel: 'Amazon & Marketplaces',
        prominence: 8,
        effectiveness: 'mature',
      },
      {
        channel: 'Specialty beauty retailers',
        prominence: 6,
        effectiveness: 'mature',
      },
      {
        channel: 'Luxury department stores',
        prominence: 5,
        effectiveness: 'declining',
      },
    ],
    barriers: [
      {
        type: 'Brand building',
        height: 'high',
        description: 'Requires strong marketing and influencer partnerships',
      },
      {
        type: 'Supply chain',
        height: 'medium',
        description: 'Ingredient sourcing and manufacturing complexity',
      },
      {
        type: 'Regulatory',
        height: 'medium',
        description: 'FDA cosmetics regulations and claims substantiation',
      },
      {
        type: 'Capital requirements',
        height: 'medium',
        description: 'Need for significant inventory and marketing spend',
      },
    ],
  };

  analyzer.setNicheAnalysis(nicheAnalysis);
  console.log('Niche analysis set\n');

  // Step 3: Generate comprehensive report
  console.log('Step 3: Generating comprehensive report...\n');
  const report = analyzer.generateReport();

  // Step 4: Display key insights
  console.log('=== KEY INSIGHTS ===\n');

  console.log(`Total Competitors Analyzed: ${report.competitors.total}`);
  console.log(
    `  - Direct: ${report.competitors.byType.direct?.length || 0}`
  );
  console.log(
    `  - Indirect: ${report.competitors.byType.indirect?.length || 0}`
  );
  console.log(
    `  - Adjacent: ${report.competitors.byType.adjacent?.length || 0}`
  );
  console.log(
    `  - Emerging: ${report.competitors.byType.emerging?.length || 0}`
  );
  console.log('');

  console.log(`Market Fragmentation: ${report.landscape.fragmentationLevel}`);
  console.log(`  ${report.landscape.fragmentationDetail}\n`);

  if (report.landscape.marketLeaders.length > 0) {
    console.log('Market Leaders:');
    for (const leader of report.landscape.marketLeaders) {
      console.log(
        `  - ${leader.name} (${leader.positioning})`
      );
    }
    console.log('');
  }

  console.log(`Positioning Gaps:
  Taken: ${report.positioningStrategy.taken.length} positionings
  Empty: ${report.positioningStrategy.empty.length} positionings
  Most Crowded: ${report.positioningStrategy.mostCrowded}
  Least Served: ${report.positioningStrategy.leastServed}\n`);

  console.log(`Audience Analysis:
  Well Served: ${report.audienceSummary.wellServed.length} segments
  Underserved: ${report.audienceSummary.underserved.length} segments
  Unserved: ${report.audienceSummary.unserved.length} segments\n`);

  if (report.opportunities.highPriority.length > 0) {
    console.log('High-Priority Opportunities:');
    for (const opp of report.opportunities.highPriority) {
      console.log(`  - ${opp.title}`);
      console.log(`    ${opp.reason}`);
      console.log(`    Est. Size: ${opp.estimatedMarketSize}`);
    }
    console.log('');
  }

  console.log(`Overall Confidence: ${Math.round(report.confidence.overall * 100)}%\n`);

  // Step 5: Export results
  console.log('Step 4: Exporting results...\n');

  const markdown = analyzer.exportMarkdown();
  console.log('Markdown export ready (truncated for display):');
  console.log(markdown.split('\n').slice(0, 30).join('\n'));
  console.log('...\n');

  // Return full report for further processing
  return report;
}

// Main execution
exampleSkincarAnalysis()
  .then((report) => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log(`Generated report with ${report.competitors.all.length} competitors`);
    console.log(
      `Identified ${report.opportunities.highPriority.length} high-priority opportunities`
    );
  })
  .catch((err) => {
    console.error('Error during analysis:', err);
    process.exit(1);
  });
