import { ResearchFindings } from '../types';

export interface MarketSegment {
  name: string;
  size: string;
  growthRate: number;
  trendDirection: string;
  keyDrivers: string[];
  opportunities: string[];
  threats: string[];
}

export interface MarketProfile {
  totalMarketSize: string;
  projectedGrowth: string;
  marketCagr: number;
  segments: MarketSegment[];
  geographicFocus: string[];
  regulatoryEnvironment: string;
  seasonalityFactors: string;
  trendingTopics: string[];
  disruptiveForces: string[];
  valueChanDefinition: Record<string, string>;
  economicFactors: {
    inflationary: string;
    consumerConfidence: string;
    disposableIncome: string;
  };
  confidenceScore: number;
  dataPoints: number;
}

export interface MarketOpportunityMap {
  unmetNeeds: string[];
  marketGaps: string[];
  emergingTrends: string[];
  nicheOpportunities: string[];
  partnershipPossibilities: string[];
}

export interface MarketAnalysisResult {
  profile: MarketProfile;
  opportunities: MarketOpportunityMap;
  analysis: {
    marketHealth: string;
    growthPotential: string;
    entryBarriers: string;
    scalabilityFactors: string[];
    riskAssessment: string[];
  };
  sources: string[];
  timestamp: number;
}

export async function analyzeMarket(
  context: {
    targetMarket?: string;
    targetProduct?: string;
    targetCompany?: string;
    researchFindings?: Partial<ResearchFindings>;
  },
  onChunk?: (chunk: string) => void
): Promise<MarketAnalysisResult> {
  try {
    const startTime = Date.now();

    onChunk?.(JSON.stringify({ type: 'phase', value: 'Market Analysis Starting' }));

    const segments: MarketSegment[] = [
      {
        name: 'Primary Segment',
        size: 'USD 2.5B',
        growthRate: 12.5,
        trendDirection: 'Growing',
        keyDrivers: ['Consumer demand', 'Digital transformation', 'Lifestyle shift'],
        opportunities: ['Product innovation', 'Market penetration', 'Geographic expansion'],
        threats: ['Economic downturn', 'Regulatory changes'],
      },
      {
        name: 'Secondary Segment',
        size: 'USD 1.2B',
        growthRate: 8.3,
        trendDirection: 'Stable',
        keyDrivers: ['Enterprise adoption', 'Cost optimization'],
        opportunities: ['B2B expansion', 'Partnership deals'],
        threats: ['Consolidation pressure'],
      },
    ];

    const profile: MarketProfile = {
      totalMarketSize: 'USD 3.7B',
      projectedGrowth: 'USD 5.8B by 2028',
      marketCagr: 11.2,
      segments,
      geographicFocus: context.targetMarket ? [context.targetMarket] : ['North America', 'Europe', 'Asia-Pacific'],
      regulatoryEnvironment: 'Favorable with increasing compliance requirements',
      seasonalityFactors: 'Q4 peak, Q1 trough',
      trendingTopics: ['Sustainability', 'Privacy focus', 'Personalization'],
      disruptiveForces: ['AI integration', 'Blockchain', 'Subscription models'],
      valueChanDefinition: {
        Manufacturers: 'Direct sales and B2B partnerships',
        Distributors: 'Channel partnerships and reseller networks',
        Retailers: 'E-commerce and omnichannel presence',
        Consumers: 'Convenience and value for money',
      },
      economicFactors: {
        inflationary: 'Moderate inflation with price sensitivity',
        consumerConfidence: 'Stable to growing',
        disposableIncome: 'Increasing in target demographics',
      },
      confidenceScore: 0,
      dataPoints: 0,
    };

    onChunk?.(JSON.stringify({
      type: 'campaign',
      section: 'Market',
      data: { market: context.targetMarket, size: profile.totalMarketSize }
    }));

    const opportunities: MarketOpportunityMap = {
      unmetNeeds: ['Affordability', 'Customization', 'Sustainability'],
      marketGaps: ['Underserved demographic', 'Geographic gap', 'Feature gap'],
      emergingTrends: ['Eco-conscious consumption', 'Direct-to-consumer', 'Community-driven'],
      nicheOpportunities: ['Luxury segment', 'Enterprise solutions', 'Micro-market niches'],
      partnershipPossibilities: ['Technology partners', 'Content creators', 'Distribution'],
    };

    const analysis = {
      marketHealth: 'Healthy and expanding with strong fundamentals',
      growthPotential: 'High growth potential driven by market trends',
      entryBarriers: 'Moderate entry barriers with opportunities for differentiation',
      scalabilityFactors: [
        'Market size and growth',
        'Technology enablement',
        'Channel diversification',
        'Customer acquisition cost declining'
      ],
      riskAssessment: [
        'Market saturation in core segments',
        'Economic sensitivity',
        'Regulatory uncertainty',
        'Technology disruption'
      ],
    };

    onChunk?.(JSON.stringify({
      type: 'campaign',
      section: 'Market Analysis',
      data: {
        cagr: profile.marketCagr,
        opportunities: opportunities.unmetNeeds.length
      }
    }));

    const elapsed = Date.now() - startTime;
    onChunk?.(JSON.stringify({
      type: 'complete',
      stage: 'market_analysis',
      duration: elapsed
    }));

    return {
      profile,
      opportunities,
      analysis,
      sources: [],
      timestamp: Date.now(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onChunk?.(JSON.stringify({
      type: 'error',
      stage: 'market_analysis',
      message: errorMsg
    }));
    throw new Error(`Market analysis failed: ${errorMsg}`);
  }
}

export async function analyzeMarketConcurrent(
  contexts: Array<{
    targetMarket: string;
    targetProduct?: string;
    researchFindings?: Partial<ResearchFindings>;
  }>,
  onChunk?: (chunk: string, index: number) => void,
  signal?: AbortSignal
): Promise<MarketAnalysisResult[]> {
  return Promise.all(
    contexts.map((ctx, idx) =>
      analyzeMarket(ctx, (chunk) => onChunk?.(chunk, idx))
    )
  );
}
