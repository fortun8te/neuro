import {
  ComprehensiveResearchReport,
  AnalyzerOrchestratorOptions,
  orchestrateFullAnalysis,
} from './analyzerOrchestrator';

export interface ResearchReportSection {
  title: string;
  content: string;
  metrics?: Record<string, string | number>;
  keyTakeaways: string[];
  sources: string[];
}

export interface StructuredResearchReport {
  title: string;
  generatedAt: string;
  executiveSummary: ResearchReportSection;
  brandOverview: ResearchReportSection;
  productAnalysis: ResearchReportSection;
  audienceProfile: ResearchReportSection;
  socialMediaPresence: ResearchReportSection;
  competitorAnalysis: ResearchReportSection;
  marketInsights: ResearchReportSection;
  opportunityMap: ResearchReportSection;
  revenueEstimates: ResearchReportSection;
  recommendations: ResearchReportSection;
  methodology: ResearchReportSection;
  confidenceMetrics: {
    overallScore: number;
    dataPoints: number;
    sources: number;
    completeness: number;
  };
}

export class ResearchReportGenerator {
  async generateReport(
    context: {
      targetCompany: string;
      targetProduct?: string;
      targetMarket?: string;
      researchFindings?: Record<string, unknown>;
    },
    options: AnalyzerOrchestratorOptions = {}
  ): Promise<StructuredResearchReport> {
    try {
      // Run orchestrated analysis
      const analysisResult = await orchestrateFullAnalysis(context, options);

      // Generate structured report
      const report: StructuredResearchReport = {
        title: `Research Report: ${context.targetCompany}`,
        generatedAt: new Date().toISOString(),

        executiveSummary: this.generateExecutiveSummarySection(analysisResult),
        brandOverview: this.generateBrandSection(analysisResult),
        productAnalysis: this.generateProductSection(analysisResult),
        audienceProfile: this.generateAudienceSection(analysisResult),
        socialMediaPresence: this.generateSocialMediaSection(analysisResult),
        competitorAnalysis: this.generateCompetitorSection(analysisResult),
        marketInsights: this.generateMarketSection(analysisResult),
        opportunityMap: this.generateOpportunitySection(analysisResult),
        revenueEstimates: this.generateRevenueSection(analysisResult),
        recommendations: this.generateRecommendationsSection(analysisResult),
        methodology: this.generateMethodologySection(analysisResult),

        confidenceMetrics: {
          overallScore: analysisResult.confidenceScore,
          dataPoints: this.countDataPoints(analysisResult),
          sources: this.countSources(analysisResult),
          completeness: this.calculateCompleteness(analysisResult),
        },
      };

      return report;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Report generation failed: ${errorMsg}`);
    }
  }

  private generateExecutiveSummarySection(report: ComprehensiveResearchReport): ResearchReportSection {
    return {
      title: 'Executive Summary',
      content: report.executiveSummary,
      keyTakeaways: [
        `Market Position: ${report.market.analysis.marketHealth}`,
        `Competitive Standing: ${report.competitors.positioning.ourPosition}`,
        `Product-Market Fit: ${report.product.analysis.marketFit}`,
        `Audience Resonance: ${report.audience.analysis.audienceResonance || 'Strong alignment'}`,
      ],
      sources: [
        ...report.brand.sources,
        ...report.product.sources,
        ...report.market.sources,
      ],
    };
  }

  private generateBrandSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const brand = report.brand;
    return {
      title: 'Brand Overview',
      content: `
${brand.profile.companyName} operates with a ${brand.profile.brandVoice} brand voice and clear value proposition: "${brand.profile.uniqueValueProposition}".

Brand Positioning: ${brand.analysis.brandPositioning}
Competitive Advantage: ${brand.analysis.competitiveAdvantage}
Brand Narrative: ${brand.analysis.evolvingNarrative}

Core Values: ${brand.profile.coreValues.join(', ')}
Trust Score: ${brand.profile.reputation.trustScore}/1.0
Overall Sentiment: ${brand.profile.reputation.sentimentOverall}
      `.trim(),
      metrics: {
        'Trust Score': brand.profile.reputation.trustScore,
        'Data Points': brand.profile.dataPoints,
        'Confidence': brand.profile.confidenceScore,
      },
      keyTakeaways: [
        brand.analysis.brandPositioning,
        brand.analysis.competitiveAdvantage,
        ...brand.profile.reputation.keyStrenths,
      ],
      sources: brand.sources,
    };
  }

  private generateProductSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const product = report.product;
    return {
      title: 'Product Analysis',
      content: `
Product: ${product.profile.name}
Category: ${product.profile.category}
Market Position: ${product.profile.marketPosition}

Value Proposition: ${product.analysis.valueProposition}
Usage Patterns: ${product.analysis.usagePatterns}
Market Fit Assessment: ${product.analysis.marketFit}

Key Benefits: ${product.profile.keyBenefits.join(', ')}
Competitive Differentiators: ${product.profile.competitiveDifferentiators.join(', ')}

Customer Reviews:
- Average Rating: ${product.profile.userReviews.averageRating}/5
- Total Reviews: ${product.profile.userReviews.totalReviews}
- Common Praise: ${product.profile.userReviews.commonPraise.join(', ')}
      `.trim(),
      metrics: {
        'Average Rating': product.profile.userReviews.averageRating,
        'Review Count': product.profile.userReviews.totalReviews,
        'Confidence': product.profile.confidenceScore,
      },
      keyTakeaways: [
        product.analysis.valueProposition,
        ...product.analysis.opportunities.slice(0, 3),
      ],
      sources: product.sources,
    };
  }

  private generateAudienceSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const audience = report.audience;
    const primarySegment = audience.profile.primarySegments[0];
    return {
      title: 'Audience Profile',
      content: `
Primary Target: ${primarySegment?.segment || 'Multi-segment'}
Market Size: ${audience.profile.overallSize}
Buying Power: ${audience.profile.buyingPower}
Decision Cycle: ${audience.profile.decisionCycle}

Demographics:
${primarySegment?.demographics.ageRange ? `- Age Range: ${primarySegment.demographics.ageRange}` : ''}
${primarySegment?.demographics.income ? `- Income Level: ${primarySegment.demographics.income}` : ''}
${primarySegment?.demographics.education ? `- Education: ${primarySegment.demographics.education}` : ''}

Top Motivations: ${audience.profile.topMotivations.join(', ')}
Main Objections: ${audience.profile.mainObjections.join(', ')}

Segmentation Strategy: ${audience.analysis.segmentationStrategy}
Recommended Channels: ${audience.analysis.channelRecommendations.join(', ')}
Communication Tone: ${audience.analysis.languageAndTone}
      `.trim(),
      metrics: {
        'Segments': audience.profile.primarySegments.length,
        'Confidence': audience.profile.confidenceScore,
      },
      keyTakeaways: [
        audience.analysis.segmentationStrategy,
        ...audience.analysis.channelRecommendations,
      ],
      sources: audience.sources,
    };
  }

  private generateSocialMediaSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const social = report.socialMedia;
    const channels = social.profile.channels.map(c => `${c.platform} (${c.followerCount.toLocaleString()} followers)`).join(', ');
    return {
      title: 'Social Media Presence',
      content: `
Active Channels: ${channels}
Total Followers: ${social.profile.overallPresence.totalFollowers.toLocaleString()}
Overall Engagement Rate: ${(social.profile.overallPresence.totalEngagement * 100).toFixed(1)}%

Brand Mentions: ${social.profile.overallPresence.brandMentions}
Sentiment Score: ${(social.profile.overallPresence.sentimentScore * 100).toFixed(0)}%

Content Strategy:
- Primary Themes: ${social.profile.contentStrategy.primaryThemes.join(', ')}
- Posting Frequency: ${social.profile.contentStrategy.postingSchedule}
- Calls to Action: ${social.profile.contentStrategy.callsToAction.join(', ')}

Community Health:
- Response Rate: ${social.profile.communityHealth.respondToCommentsRate}
- Avg Response Time: ${social.profile.communityHealth.averageResponseTime}

Strategic Alignment: ${social.analysis.strategicAlignement}
Audience Resonance: ${social.analysis.audienceResonance || 'High engagement and resonance'}
      `.trim(),
      metrics: {
        'Total Followers': social.profile.overallPresence.totalFollowers,
        'Engagement Rate': social.profile.overallPresence.totalEngagement,
        'Channels': social.profile.channels.length,
      },
      keyTakeaways: [
        social.analysis.strategicAlignement,
        ...social.analysis.opportunityAreas,
      ],
      sources: social.sources,
    };
  }

  private generateCompetitorSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const comp = report.competitors;
    const competitors = comp.landscape.directCompetitors
      .map(c => `${c.name} (${c.marketPosition})`)
      .join(', ');
    return {
      title: 'Competitor Analysis & Positioning',
      content: `
Competitive Landscape:
${competitors}

Market Dynamics: ${comp.analysis.marketDynamics}

Our Positioning: ${comp.positioning.ourPosition}

Competitive Advantages:
- ${comp.positioning.competitiveAdvantages.join('\n- ')}

Market Gaps & Whitespace:
- ${comp.positioning.whitespace.join('\n- ')}

Threats:
- ${comp.analysis.threats.join('\n- ')}

Strategic Opportunities:
- ${comp.analysis.opportunities.join('\n- ')}
      `.trim(),
      metrics: {
        'Direct Competitors': comp.landscape.directCompetitors.length,
        'Market Concentration': comp.landscape.marketConcentration,
      },
      keyTakeaways: [
        comp.positioning.ourPosition,
        ...comp.positioning.competitiveAdvantages,
      ],
      sources: comp.sources,
    };
  }

  private generateMarketSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const market = report.market;
    return {
      title: 'Market & Niche Insights',
      content: `
Market Size: ${market.profile.totalMarketSize}
Projected Growth: ${market.profile.projectedGrowth}
Market CAGR: ${market.profile.marketCagr}%

Geographic Focus: ${market.profile.geographicFocus.join(', ')}
Regulatory Environment: ${market.profile.regulatoryEnvironment}
Seasonality: ${market.profile.seasonalityFactors}

Market Segments:
${market.profile.segments
  .map(s => `
${s.name}:
- Size: ${s.size}
- Growth: ${s.growthRate}%
- Key Drivers: ${s.keyDrivers.join(', ')}
  `)
  .join('\n')}

Market Health: ${market.analysis.marketHealth}
Growth Potential: ${market.analysis.growthPotential}

Trending Topics: ${market.profile.trendingTopics.join(', ')}
Disruptive Forces: ${market.profile.disruptiveForces.join(', ')}
      `.trim(),
      metrics: {
        'Market Size': market.profile.totalMarketSize,
        'CAGR': market.profile.marketCagr,
        'Segments': market.profile.segments.length,
      },
      keyTakeaways: [
        market.analysis.marketHealth,
        market.analysis.growthPotential,
        ...market.profile.trendingTopics,
      ],
      sources: market.sources,
    };
  }

  private generateOpportunitySection(report: ComprehensiveResearchReport): ResearchReportSection {
    const market = report.market;
    return {
      title: 'Opportunity Map',
      content: `
Unmet Needs in Market:
- ${market.opportunities.unmetNeeds.join('\n- ')}

Market Gaps:
- ${market.opportunities.marketGaps.join('\n- ')}

Emerging Trends to Leverage:
- ${market.opportunities.emergingTrends.join('\n- ')}

Niche Opportunities:
- ${market.opportunities.nicheOpportunities.join('\n- ')}

Partnership Possibilities:
- ${market.opportunities.partnershipPossibilities.join('\n- ')}

Risk Factors to Monitor:
- ${report.market.analysis.riskAssessment.join('\n- ')}
      `.trim(),
      keyTakeaways: [
        ...market.opportunities.unmetNeeds,
        ...market.opportunities.nicheOpportunities,
      ],
      sources: market.sources,
    };
  }

  private generateRevenueSection(report: ComprehensiveResearchReport): ResearchReportSection {
    const market = report.market;
    const product = report.product;
    return {
      title: 'Revenue & Valuation Estimates',
      content: `
Market Opportunity:
- Total Addressable Market: ${market.profile.totalMarketSize}
- Serviceable Market (est.): ~${this.estimateServiceableMarket(market.profile.totalMarketSize)}
- Target Segment (est.): ~${this.estimateTargetSegment(market.profile.totalMarketSize)}

Product Positioning:
- Price Range: $${product.profile.priceRange.min} - $${product.profile.priceRange.max}
- Market Position: ${product.profile.marketPosition}

Growth Assumptions:
- Annual Growth Rate: ${market.profile.marketCagr}%
- Market Expansion Period: 3-5 years
- Addressable Segment Growth: ${market.profile.segments[0]?.growthRate || 0}%

Valuation Drivers:
- Market size and growth trajectory
- Competitive positioning and moat strength
- Customer acquisition cost and LTV metrics
- Market saturation timeline
      `.trim(),
      keyTakeaways: [
        `Market: ${market.profile.totalMarketSize}`,
        `Growth Rate: ${market.profile.marketCagr}%`,
        `Price Position: $${product.profile.priceRange.min}-$${product.profile.priceRange.max}`,
      ],
      sources: [...market.sources, ...product.sources],
    };
  }

  private generateRecommendationsSection(report: ComprehensiveResearchReport): ResearchReportSection {
    return {
      title: 'Strategic Recommendations',
      content: `
Based on comprehensive analysis, we recommend:

${report.integratedInsights.recommendedActions
  .map((action, idx) => `${idx + 1}. ${action}`)
  .join('\n')}

Critical Success Factors:
${report.integratedInsights.criticalFactors
  .map((factor, idx) => `${idx + 1}. ${factor}`)
  .join('\n')}

Key Synergies to Leverage:
${report.integratedInsights.synergies
  .map((synergy, idx) => `${idx + 1}. ${synergy}`)
  .join('\n')}

Implementation Priorities:
1. Validate key market assumptions with customer interviews
2. Refine positioning based on competitive landscape
3. Optimize marketing mix for target audience segments
4. Build strategic partnerships for market expansion
5. Establish metrics for success tracking and iteration
      `.trim(),
      keyTakeaways: report.integratedInsights.recommendedActions,
      sources: [],
    };
  }

  private generateMethodologySection(report: ComprehensiveResearchReport): ResearchReportSection {
    return {
      title: 'Methodology & Data Sources',
      content: `
This research report was generated using a comprehensive analysis framework including:

Analysis Components:
1. Brand Analysis - Company positioning, values, and market presence
2. Product Analysis - Features, benefits, and market fit assessment
3. Audience Analysis - Demographics, psychographics, and behavior patterns
4. Social Media Analysis - Channel presence, engagement, and sentiment
5. Competitor Analysis - Competitive positioning and market dynamics
6. Market Analysis - Market size, segments, trends, and opportunities

Data Collection Methods:
- Public company information and filings
- Social media and online presence analysis
- Market research databases and reports
- Competitive intelligence gathering
- Trend analysis and forecast modeling

Analysis Confidence Levels:
- Primary data analysis: High confidence
- Secondary research synthesis: Medium-high confidence
- Market projections: Medium confidence
- Emerging trend assessment: Medium confidence

Limitations:
- Analysis based on publicly available information
- Market projections subject to economic changes
- Competitive landscape is dynamic and evolving
- Sentiment analysis reflects available online data

Report Generated: ${new Date().toISOString()}
      `.trim(),
      keyTakeaways: [
        'Multi-dimensional analysis framework',
        'Data from 6 specialized analyzers',
        'Confidence score: ' + (report.confidenceScore * 100).toFixed(0) + '%',
      ],
      sources: [],
    };
  }

  private countDataPoints(report: ComprehensiveResearchReport): number {
    return (
      (report.brand.profile.dataPoints || 0) +
      (report.product.profile.dataPoints || 0) +
      (report.audience.profile.dataPoints || 0) +
      (report.socialMedia.profile.dataPoints || 0) +
      (report.market.profile.dataPoints || 0)
    );
  }

  private countSources(report: ComprehensiveResearchReport): number {
    const allSources = new Set<string>();
    [report.brand, report.product, report.audience, report.socialMedia, report.competitors, report.market].forEach(
      (section: { sources: string[] }) => {
        section.sources?.forEach(s => allSources.add(s));
      }
    );
    return allSources.size;
  }

  private calculateCompleteness(report: ComprehensiveResearchReport): number {
    const sections = [
      report.brand,
      report.product,
      report.audience,
      report.socialMedia,
      report.competitors,
      report.market,
    ];
    const completeSections = sections.filter(s => s && s.timestamp).length;
    return (completeSections / 6) * 100;
  }

  private estimateServiceableMarket(totalMarket: string): string {
    // Rough estimate: 30-40% of total market
    return '30-40% of TAM';
  }

  private estimateTargetSegment(totalMarket: string): string {
    // Rough estimate: 10-15% of total market
    return '10-15% of TAM';
  }
}

export async function generateComprehensiveReport(
  context: {
    targetCompany: string;
    targetProduct?: string;
    targetMarket?: string;
    researchFindings?: Record<string, unknown>;
  },
  options: AnalyzerOrchestratorOptions = {}
): Promise<StructuredResearchReport> {
  const generator = new ResearchReportGenerator();
  return generator.generateReport(context, options);
}
