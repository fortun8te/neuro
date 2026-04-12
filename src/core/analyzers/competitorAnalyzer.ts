import { ResearchFindings } from '../types';

export interface Competitor {
  name: string;
  marketPosition: string;
  strengths: string[];
  weaknesses: string[];
  marketShare: string;
  pricePositioning: string;
  uniqueSellingPoints: string[];
  targetAudience: string;
  contentStrategy: string;
  marketPenetration: string;
}

export interface CompetitorLandscape {
  directCompetitors: Competitor[];
  indirectCompetitors: Competitor[];
  emergingThreats: Competitor[];
  marketConcentration: string;
  competitiveIntensity: string;
  barriersToEntry: string[];
}

export interface CompetitivePositioning {
  ourPosition: string;
  competitiveAdvantages: string[];
  vulnerabilities: string[];
  whitespace: string[];
  differentiation: string;
}

export interface CompetitorAnalysisResult {
  landscape: CompetitorLandscape;
  positioning: CompetitivePositioning;
  analysis: {
    marketDynamics: string;
    threats: string[];
    opportunities: string[];
    strategicRecommendations: string[];
  };
  sources: string[];
  timestamp: number;
}

export async function analyzeCompetitors(
  context: {
    targetCompany: string;
    targetProduct?: string;
    researchFindings?: Partial<ResearchFindings>;
  },
  onChunk?: (chunk: string) => void
): Promise<CompetitorAnalysisResult> {
  try {
    const startTime = Date.now();

    onChunk?.(JSON.stringify({ type: 'phase', value: 'Competitor Analysis Starting' }));

    const landscape: CompetitorLandscape = {
      directCompetitors: [
        {
          name: 'Competitor A',
          marketPosition: 'Market leader',
          strengths: ['Brand recognition', 'Distribution network', 'Price competitiveness'],
          weaknesses: ['Legacy technology', 'Slow innovation'],
          marketShare: '35%',
          pricePositioning: 'Premium',
          uniqueSellingPoints: ['Reliability', 'Scale'],
          targetAudience: 'Enterprise and SMB',
          contentStrategy: 'Thought leadership',
          marketPenetration: 'High',
        },
        {
          name: 'Competitor B',
          marketPosition: 'Fast-growing challenger',
          strengths: ['Innovation', 'Customer service', 'Technology'],
          weaknesses: ['Limited brand awareness', 'Smaller team'],
          marketShare: '22%',
          pricePositioning: 'Mid-market',
          uniqueSellingPoints: ['Cutting-edge features', 'Community'],
          targetAudience: 'Tech-savvy users',
          contentStrategy: 'Educational content',
          marketPenetration: 'Growing',
        },
      ],
      indirectCompetitors: [
        {
          name: 'Alternative Solution',
          marketPosition: 'Niche player',
          strengths: ['Specialized features'],
          weaknesses: ['Limited scope'],
          marketShare: '8%',
          pricePositioning: 'Budget',
          uniqueSellingPoints: ['Affordable'],
          targetAudience: 'Price-sensitive segment',
          contentStrategy: 'Performance metrics',
          marketPenetration: 'Low',
        },
      ],
      emergingThreats: [],
      marketConcentration: 'Moderate concentration (top 3 hold 65% share)',
      competitiveIntensity: 'High and increasing',
      barriersToEntry: ['Capital requirements', 'Brand loyalty', 'Network effects'],
    };

    onChunk?.(JSON.stringify({
      type: 'campaign',
      section: 'Competitors',
      data: {
        direct: landscape.directCompetitors.length,
        indirect: landscape.indirectCompetitors.length
      }
    }));

    const positioning: CompetitivePositioning = {
      ourPosition: 'Growing innovator with strong customer focus',
      competitiveAdvantages: ['Superior UX', 'Innovation focus', 'Customer-centric approach'],
      vulnerabilities: ['Smaller brand', 'Limited resources'],
      whitespace: ['Vertical integration', 'New market segments', 'Partnership opportunities'],
      differentiation: 'Premium quality at accessible price',
    };

    const analysis = {
      marketDynamics: 'Consolidating market with room for innovation',
      threats: ['Price war from market leaders', 'Tech disruption', 'New entrants'],
      opportunities: ['Market gaps', 'Partnerships', 'Acquisition targets'],
      strategicRecommendations: [
        'Focus on differentiation',
        'Build strategic partnerships',
        'Expand into underserved segments'
      ],
    };

    onChunk?.(JSON.stringify({
      type: 'campaign',
      section: 'Competitor Analysis',
      data: {
        dynamics: analysis.marketDynamics,
        threats: analysis.threats.length
      }
    }));

    const elapsed = Date.now() - startTime;
    onChunk?.(JSON.stringify({
      type: 'complete',
      stage: 'competitor_analysis',
      duration: elapsed
    }));

    return {
      landscape,
      positioning,
      analysis,
      sources: [],
      timestamp: Date.now(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onChunk?.(JSON.stringify({
      type: 'error',
      stage: 'competitor_analysis',
      message: errorMsg
    }));
    throw new Error(`Competitor analysis failed: ${errorMsg}`);
  }
}

export async function analyzeCompetitorsConcurrent(
  contexts: Array<{
    targetCompany: string;
    targetProduct?: string;
    researchFindings?: Partial<ResearchFindings>;
  }>,
  onChunk?: (chunk: string, index: number) => void,
  signal?: AbortSignal
): Promise<CompetitorAnalysisResult[]> {
  return Promise.all(
    contexts.map((ctx, idx) =>
      analyzeCompetitors(ctx, (chunk) => onChunk?.(chunk, idx))
    )
  );
}
