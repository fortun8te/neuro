import { ResearchFindings } from '../types';

export interface AudienceSegment {
  segment: string;
  demographics: {
    ageRange: string;
    gender?: string;
    income?: string;
    education?: string;
    location?: string;
  };
  psychographics: {
    values: string[];
    interests: string[];
    painPoints: string[];
    desires: string[];
  };
  behaviors: {
    purchaseFrequency: string;
    decisionMakers: string[];
    loyaltyLevel: string;
    onlineSearchBehavior: string[];
  };
  size: string;
  growthTrend: string;
}

export interface AudienceProfile {
  primarySegments: AudienceSegment[];
  secondarySegments: AudienceSegment[];
  overallSize: string;
  buyingPower: string;
  decisionCycle: string;
  topMotivations: string[];
  mainObjections: string[];
  communicationPreferences: string[];
  trustFactors: string[];
  confidenceScore: number;
  dataPoints: number;
}

export interface AudienceAnalysis {
  segmentationStrategy: string;
  languageAndTone: string;
  contentPreferences: string;
  channelRecommendations: string[];
  engagementOpportunities: string[];
  audienceResonance?: string;
}

export interface AudienceAnalysisResult {
  profile: AudienceProfile;
  analysis: AudienceAnalysis;
  sources: string[];
  timestamp: number;
}

export async function analyzeAudience(
  context: {
    targetProduct?: string;
    targetCompany?: string;
    targetMarket?: string;
    researchFindings?: Partial<ResearchFindings>;
  },
  onChunk?: (chunk: string) => void
): Promise<AudienceAnalysisResult> {
  try {
    const startTime = Date.now();

    onChunk?.(JSON.stringify({ type: 'phase', value: 'Audience Analysis Starting' }));

    const profile: AudienceProfile = {
      primarySegments: [
        {
          segment: 'Primary Users',
          demographics: {
            ageRange: '25-45',
            gender: 'All',
            income: 'Middle to upper-middle',
            education: 'Bachelor degree or higher',
            location: 'Urban and suburban areas',
          },
          psychographics: {
            values: ['Quality', 'Innovation', 'Sustainability'],
            interests: ['Self-improvement', 'Technology', 'Health'],
            painPoints: ['Time scarcity', 'Decision paralysis'],
            desires: ['Convenience', 'Status', 'Community'],
          },
          behaviors: {
            purchaseFrequency: 'Regular',
            decisionMakers: ['Self', 'Partner'],
            loyaltyLevel: 'Medium to high',
            onlineSearchBehavior: ['Reviews', 'Comparisons', 'Social proof'],
          },
          size: 'Large',
          growthTrend: 'Growing steadily',
        }
      ],
      secondarySegments: [],
      overallSize: 'Multi-million market',
      buyingPower: 'Strong',
      decisionCycle: '2-4 weeks',
      topMotivations: ['Solving a real problem', 'Quality assurance', 'Social proof'],
      mainObjections: ['Price', 'Switching costs', 'Trust barriers'],
      communicationPreferences: ['Social media', 'Email', 'Reviews'],
      trustFactors: ['Customer testimonials', 'Expert endorsements', 'Transparent pricing'],
      confidenceScore: 0,
      dataPoints: 0,
    };

    onChunk?.(JSON.stringify({
      type: 'campaign',
      section: 'Audience',
      data: { target: context.targetProduct, segments: profile.primarySegments.length }
    }));

    const analysis: AudienceAnalysis = {
      segmentationStrategy: 'Behavioral and demographic-based segmentation',
      languageAndTone: 'Friendly, aspirational, and trustworthy',
      contentPreferences: 'Visual content, short-form video, authentic stories',
      channelRecommendations: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn'],
      engagementOpportunities: ['Community building', 'User-generated content', 'Educational content'],
      audienceResonance: 'Strong resonance with target demographics',
    };

    onChunk?.(JSON.stringify({
      type: 'campaign',
      section: 'Audience Analysis',
      data: {
        segments: profile.primarySegments.length,
        channels: analysis.channelRecommendations.length
      }
    }));

    const elapsed = Date.now() - startTime;
    onChunk?.(JSON.stringify({
      type: 'complete',
      stage: 'audience_analysis',
      duration: elapsed
    }));

    return {
      profile,
      analysis,
      sources: [],
      timestamp: Date.now(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onChunk?.(JSON.stringify({
      type: 'error',
      stage: 'audience_analysis',
      message: errorMsg
    }));
    throw new Error(`Audience analysis failed: ${errorMsg}`);
  }
}

export async function analyzeAudienceConcurrent(
  contexts: Array<{
    targetProduct: string;
    targetMarket?: string;
    researchFindings?: Partial<ResearchFindings>;
  }>,
  onChunk?: (chunk: string, index: number) => void,
  signal?: AbortSignal
): Promise<AudienceAnalysisResult[]> {
  return Promise.all(
    contexts.map((ctx, idx) =>
      analyzeAudience(ctx, (chunk) => onChunk?.(chunk, idx))
    )
  );
}
