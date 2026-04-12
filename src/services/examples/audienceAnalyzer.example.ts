/**
 * Audience Analyzer Examples
 * Demonstrates practical usage patterns for the audience intelligence service
 */

import { audienceAnalyzer, type ProductContext } from '../audienceAnalyzer';

/**
 * Example 1: Basic Analysis
 * Analyze research data from a hair care brand
 */
export function example1_basicAnalysis() {
  const researchData = `
    RACKS Hair Care Brand Analysis

    TARGET AUDIENCE:
    Primary: Women aged 25-45, health-conscious, eco-aware professionals
    Secondary: Men 28-40 interested in premium hair care, beauty enthusiasts

    DEMOGRAPHICS:
    - Age: 25-45 for women, 28-40 for men (growing segment)
    - Gender: 75% female, 25% male
    - Income: $60k-$150k+ (premium segment, willing to invest)
    - Geography: Urban areas in North America (70%), Europe (20%), Asia (10%)
    - Occupations: Tech, finance, creative, entrepreneurs, academics

    PSYCHOGRAPHICS:
    Values: Sustainability, authenticity, quality, health/wellness, transparency
    Interests: Natural beauty, wellness routines, sustainability, personal development
    Pain Points: Damaged hair from heat/color, scalp irritation, environmental guilt
    Aspirations: Achieve salon-quality results at home, reduce environmental impact
    Lifestyle: Active wellness-focused, minimalist, values-driven purchasing

    NEEDS ANALYSIS:
    Functional: Deep hair repair, scalp health, detoxification, color protection
    Emotional: Confidence, control over appearance, alignment with values
    Social: Belonging to conscious consumer community, status through ethics
    Unmet: Customized routines at scale, verified sustainability claims, community platform

    BEHAVIORAL PATTERNS:
    Purchase Frequency: Monthly subscription preferred (50%), repeat purchasers (35%)
    Loyalty: High repeat rate, brand ambassadors on social media, referrals
    Price Sensitivity: Premium positioning, see value not price, willing to pay $40-80
    Channels: Instagram (primary), TikTok (emerging), email, influencer recommendations
    Decision Factors: Ingredient quality, sustainability certifications, reviews, price
    Switch Triggers: Product ineffectiveness, greenwashing concerns, finding better value

    COMPETITOR CONTEXT:
    Traditional brands: Seen as outdated, chemical-heavy, non-sustainable
    Indie brands: Strong on values, weak on efficacy claims
    Luxury brands: Similar positioning but higher price point and limited sustainability
    Direct competitors: Strong in efficacy messaging, weak on community/values

    MARKET SIGNALS:
    - Growing search volume for "natural hair products"
    - High engagement on sustainability-focused content
    - TikTok haircare community rapidly expanding
    - Price resistance diminishing if values-aligned
    - Influencer partnerships driving discovery
  `;

  const productContext: ProductContext = {
    brandName: 'RACKS',
    productCategory: 'Hair Care',
    productName: 'Hair Serum & Shampoo Line',
    targetMarket: 'Eco-conscious premium segment'
  };

  const intelligence = audienceAnalyzer.analyzeAudience(researchData, productContext);

  console.log('=== AUDIENCE INTELLIGENCE REPORT ===\n');
  console.log(`Brand: ${intelligence.brand}`);
  console.log(`Confidence: ${(intelligence.confidenceScore * 100).toFixed(1)}%`);
  console.log(`Data Quality: ${intelligence.dataQuality}\n`);

  // Primary persona
  console.log('PRIMARY PERSONA:');
  console.log(`- Name: ${intelligence.primaryPersona.name}`);
  console.log(`- Description: ${intelligence.primaryPersona.description}`);
  console.log(`- Market Share: ${intelligence.primaryPersona.estimatedPercentage}%`);
  console.log(`- Primary Driver: ${intelligence.primaryPersona.purchaseDriver}`);
  console.log(`- Preferred Channels: ${intelligence.primaryPersona.preferredChannels.join(', ')}\n`);

  // Key insights
  console.log('KEY INSIGHTS:');
  intelligence.keyInsights.forEach((insight, i) => {
    console.log(`${i + 1}. ${insight}`);
  });
  console.log();

  return intelligence;
}

/**
 * Example 2: Extract Marketing Angles
 * Use audience intelligence to develop marketing strategy
 */
export function example2_marketingStrategy(intelligence: any) {
  console.log('=== MARKETING STRATEGY ===\n');

  // Messaging pillars
  console.log('MESSAGING FRAMEWORK:');
  const strategy = intelligence.contentStrategy;
  console.log('Pillars:');
  strategy.messagingPillars.forEach((pillar: string) => {
    console.log(`  - ${pillar}`);
  });
  console.log(`\nTone: ${strategy.tonalGuidance}\n`);

  // Content recommendations
  console.log('CONTENT STRATEGY:');
  strategy.contentFormats
    .sort((a: any, b: any) => b.effectiveness - a.effectiveness)
    .slice(0, 3)
    .forEach((format: any) => {
      console.log(`- ${format.format} (effectiveness: ${(format.effectiveness * 100).toFixed(0)}%)`);
    });
  console.log();

  // Keyword strategy
  console.log('KEYWORD THEMES:');
  strategy.keywordThemes.forEach((keyword: string) => {
    console.log(`  - ${keyword}`);
  });
  console.log();

  // Implications
  console.log('MARKETING IMPLICATIONS:');
  intelligence.marketingImplications.forEach((implication: string) => {
    console.log(`• ${implication}`);
  });
  console.log();
}

/**
 * Example 3: Objection Handling Script
 * Create sales/copy talking points from audience pain points
 */
export function example3_objectionHandling(intelligence: any) {
  const persona = intelligence.primaryPersona;

  console.log('=== OBJECTION HANDLING GUIDE ===\n');

  console.log('COMMON OBJECTIONS & RESPONSES:');
  persona.commonObjections.forEach((objection: string, i: number) => {
    console.log(`\nObjection ${i + 1}: "${objection}"`);
    console.log('Response Framework:');

    // Generate response based on persona insights
    const values = persona.psychographics.values.slice(0, 2);
    const painPoints = persona.psychographics.painPoints.slice(0, 2);

    if (i === 0) {
      console.log('  - Lead with efficacy proof (testimonials, before/after)');
      console.log('  - Reference quality ingredients and testing');
    } else if (i === 1) {
      console.log(`  - Emphasize ${values[0]?.value || 'quality'} over price`);
      console.log('  - Show long-term value (months of use, results)');
    } else {
      console.log(`  - Address "${painPoints[0]?.problem || 'their pain points'}" directly`);
      console.log('  - Use social proof and expert validation');
    }
  });
  console.log();
}

/**
 * Example 4: Competitive Positioning
 * Identify market gaps and differentiation opportunities
 */
export function example4_competitivePositioning(intelligence: any) {
  console.log('=== COMPETITIVE POSITIONING ===\n');

  if (intelligence.competitorAnalysis.length > 0) {
    const competitor = intelligence.competitorAnalysis[0];

    console.log(`Competitor: ${competitor.competitor}`);
    console.log(`Target Segments: ${competitor.targetedSegments.join(', ')}`);
    console.log(`Loyal Customers: ${competitor.loyalCustomers}`);
    console.log(`Customer Switch Reasons:`);
    competitor.switchReasons.forEach((reason: string) => {
      console.log(`  - ${reason}`);
    });

    console.log('\nUNTAPPED MARKET OPPORTUNITIES:');
    competitor.untappedSegments.forEach((segment: any) => {
      console.log(`\nSegment: ${segment.segment}`);
      console.log(`  Why Not Served: ${segment.reason}`);
      console.log(`  Opportunity: ${segment.opportunity}`);
      console.log(`  Size: ${segment.estimatedSize}`);
    });
  }

  console.log('\nUNSERVED AUDIENCES IN MARKET:');
  intelligence.unservedAudiences.forEach((audience: any) => {
    console.log(`\n${audience.segment}`);
    console.log(`  Gap: ${audience.whyNotServed}`);
    console.log(`  Opportunity: ${audience.opportunity}`);
    console.log(`  Entry Strategy: ${audience.entryStrategy}`);
  });
  console.log();
}

/**
 * Example 5: Pricing Strategy
 * Extract pricing psychology and willingness to pay
 */
export function example5_pricingStrategy(intelligence: any) {
  const pricing = intelligence.primaryPersona.behaviors.priceSensitivity;

  console.log('=== PRICING STRATEGY ===\n');

  console.log(`Price Sensitivity Level: ${pricing.level}`);
  console.log(`Acceptable Range: $${pricing.acceptablePriceRange.min} - $${pricing.acceptablePriceRange.max} ${pricing.acceptablePriceRange.currency}\n`);

  console.log('PRICE POINT CONVERSION ANALYSIS:');
  pricing.pricePoints.forEach((point: any) => {
    const conversionPct = (point.conversionLikelihood * 100).toFixed(0);
    console.log(`  $${point.price}: ${conversionPct}% conversion (${point.segment})`);
  });
  console.log();

  // Recommendation
  const midRange = pricing.pricePoints.find((p: any) => p.conversionLikelihood > 0.7);
  if (midRange) {
    console.log(`RECOMMENDATION:`);
    console.log(`  Primary Price Point: $${midRange.price}`);
    console.log(`  Justification: Balances value perception with conversion likelihood`);
    console.log(`  Bundle Strategy: Higher-margin bundles at $${pricing.acceptablePriceRange.max}`);
  }
  console.log();
}

/**
 * Example 6: Channel Strategy
 * Allocate marketing budget across channels
 */
export function example6_channelStrategy(intelligence: any) {
  const channels = intelligence.primaryPersona.behaviors.channelPreferences
    .sort((a: any, b: any) => b.preference - a.preference)
    .slice(0, 5);

  console.log('=== CHANNEL ALLOCATION STRATEGY ===\n');

  const totalPreference = channels.reduce((sum: number, c: any) => sum + c.preference, 0);

  channels.forEach((channel: any, i: number) => {
    const allocation = (channel.preference / totalPreference * 100).toFixed(0);
    const conversionPct = (channel.conversionRate * 100).toFixed(0);

    console.log(`${i + 1}. ${channel.channel.toUpperCase()}`);
    console.log(`   Budget Allocation: ${allocation}%`);
    console.log(`   Expected Conversion: ${conversionPct}%`);
    console.log(`   Recommendation: ${getChannelRecommendation(channel.channel)}\n`);
  });

  function getChannelRecommendation(channel: string): string {
    const recs: Record<string, string> = {
      'social-media': 'Organic + Paid ads, focus on visual content and hashtags',
      'influencer': 'Partner with 5-10 micro-influencers in wellness space',
      'email': 'Newsletter 2x/month, segmented by purchase history',
      'organic-search': 'SEO for long-tail keywords, educational content',
      'word-of-mouth': 'Referral program with exclusive benefits',
      'in-store': 'Partner with wellness retailers for displays',
      'paid-ads': 'Retargeting and lookalike audiences on Meta/Google',
      'subscription': 'VIP subscription tier with exclusive products'
    };
    return recs[channel] || 'Primary promotional channel';
  }
}

/**
 * Example 7: Full Campaign Briefing
 * Generate comprehensive one-page briefing
 */
export function example7_campaignBriefing(intelligence: any) {
  const primary = intelligence.primaryPersona;

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║          CAMPAIGN BRIEF - RACKS HAIR CARE              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // WHO
  console.log('WHO: Primary Audience Profile');
  console.log(`  Name: ${primary.name}`);
  const ageRange = primary.demographics.ageRanges[0];
  console.log(`  Age: ${ageRange?.min}-${ageRange?.max}`);
  console.log(`  Gender: ${primary.demographics.primaryGender}`);
  console.log(`  Income: ${primary.demographics.incomeLevel}`);
  console.log(`  Lifestyle: ${primary.psychographics.lifestyle}\n`);

  // WHAT
  console.log('WHAT: Key Values & Pain Points');
  primary.psychographics.values.slice(0, 3).forEach((v: any) => {
    console.log(`  • Values: ${v.value}`);
  });
  primary.psychographics.painPoints.slice(0, 2).forEach((p: any) => {
    console.log(`  • Pain Point: ${p.problem}`);
  });
  console.log();

  // HOW
  console.log('HOW: Primary Driver & Messaging');
  console.log(`  Purchase Driver: ${primary.purchaseDriver}`);
  console.log(`  Tone: ${intelligence.contentStrategy.tonalGuidance}`);
  console.log(`  Top Channels: ${primary.preferredChannels.slice(0, 2).join(', ')}\n`);

  // WHERE
  console.log('WHERE: Top Geographic Markets');
  primary.demographics.geographies.slice(0, 2).forEach((g: any) => {
    console.log(`  • ${g.region} (${g.percentage}%)`);
  });
  console.log();

  // KEY INSIGHTS
  console.log('KEY INSIGHTS:');
  intelligence.keyInsights.slice(0, 3).forEach((insight: string) => {
    console.log(`  → ${insight}`);
  });
  console.log();

  // NEXT STEPS
  console.log('NEXT STEPS:');
  console.log('  1. Develop messaging framework around core values');
  console.log('  2. Create content calendar emphasizing social channels');
  console.log('  3. Identify 5-10 micro-influencers for partnerships');
  console.log('  4. Build email nurture sequence addressing objections');
  console.log('  5. Set up A/B testing for pricing ($40 vs $60)');
  console.log();
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('\n========================================');
  console.log('  AUDIENCE ANALYZER - USAGE EXAMPLES');
  console.log('========================================\n');

  const intel = example1_basicAnalysis();
  example2_marketingStrategy(intel);
  example3_objectionHandling(intel);
  example4_competitivePositioning(intel);
  example5_pricingStrategy(intel);
  example6_channelStrategy(intel);
  example7_campaignBriefing(intel);
}

// Run examples if executed directly
if (require.main === module) {
  runAllExamples();
}
