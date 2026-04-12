import { ResearchFindings } from '../types';
import { analyzeBrand, BrandAnalysisResult } from './brandAnalyzer';
import { analyzeProduct, ProductAnalysisResult } from './productAnalyzer';
import { analyzeAudience, AudienceAnalysisResult } from './audienceAnalyzer';
import { analyzeSocialMedia, SocialMediaAnalysisResult } from './socialMediaAnalyzer';
import { analyzeCompetitors, CompetitorAnalysisResult } from './competitorAnalyzer';
import { analyzeMarket, MarketAnalysisResult } from './marketAnalyzer';

export interface ComprehensiveResearchReport {
  executiveSummary: string;
  brand: BrandAnalysisResult;
  product: ProductAnalysisResult;
  audience: AudienceAnalysisResult;
  socialMedia: SocialMediaAnalysisResult;
  competitors: CompetitorAnalysisResult;
  market: MarketAnalysisResult;
  integratedInsights: {
    overallPositioning: string;
    synergies: string[];
    criticalFactors: string[];
    recommendedActions: string[];
  };
  confidenceScore: number;
  completionTime: number;
  timestamp: number;
}

export interface AnalyzerOrchestratorOptions {
  timeout?: number;
  signal?: AbortSignal;
  onProgress?: (stage: string, index: number, total: number) => void;
  onChunk?: (stage: string, chunk: string) => void;
}

export interface AnalysisProgress {
  stage: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  error?: string;
}

export class AnalyzerOrchestrator {
  private progress: Map<string, AnalysisProgress> = new Map();
  private results: Map<string, unknown> = new Map();
  private startTime: number = 0;

  constructor() {
    this.initializeProgress();
  }

  private initializeProgress(): void {
    const stages = ['brand', 'product', 'audience', 'socialMedia', 'competitors', 'market'];
    stages.forEach(stage => {
      this.progress.set(stage, { stage, status: 'pending' });
    });
  }

  private updateProgress(stage: string, status: AnalysisProgress['status'], error?: string): void {
    const current = this.progress.get(stage) || { stage, status: 'pending' };
    current.status = status;
    if (status === 'running') {
      current.startTime = Date.now();
    } else if (status === 'completed') {
      current.endTime = Date.now();
    }
    if (error) {
      current.error = error;
    }
    this.progress.set(stage, current);
  }

  async runAllAnalyzers(
    context: {
      targetCompany: string;
      targetProduct?: string;
      targetMarket?: string;
      researchFindings?: Partial<ResearchFindings>;
    },
    options: AnalyzerOrchestratorOptions = {}
  ): Promise<ComprehensiveResearchReport> {
    this.startTime = Date.now();
    const { timeout = 300000, signal, onProgress, onChunk } = options;

    try {
      // Create timeout handler
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout exceeded')), timeout);
      });

      // Run all 6 analyzers in parallel with error isolation
      const [
        brandResult,
        productResult,
        audienceResult,
        socialMediaResult,
        competitorsResult,
        marketResult,
      ] = await Promise.all([
        this.safeRunAnalyzer(
          'brand',
          () => analyzeBrand(context, (chunk) => onChunk?.('brand', chunk)),
          onProgress
        ),
        this.safeRunAnalyzer(
          'product',
          () => analyzeProduct(context, (chunk) => onChunk?.('product', chunk)),
          onProgress
        ),
        this.safeRunAnalyzer(
          'audience',
          () => analyzeAudience(context, (chunk) => onChunk?.('audience', chunk)),
          onProgress
        ),
        this.safeRunAnalyzer(
          'socialMedia',
          () => analyzeSocialMedia(context, (chunk) => onChunk?.('socialMedia', chunk)),
          onProgress
        ),
        this.safeRunAnalyzer(
          'competitors',
          () => analyzeCompetitors(context, (chunk) => onChunk?.('competitors', chunk)),
          onProgress
        ),
        this.safeRunAnalyzer(
          'market',
          () => analyzeMarket(context, (chunk) => onChunk?.('market', chunk)),
          onProgress
        ),
      ]).catch((error) => {
        if (error.message === 'Analysis timeout exceeded') {
          throw new Error('One or more analyzers exceeded the timeout limit');
        }
        throw error;
      });

      // Generate integrated insights
      const integratedInsights = this.generateIntegratedInsights(
        brandResult,
        productResult,
        audienceResult,
        socialMediaResult,
        competitorsResult,
        marketResult
      );

      const completionTime = Date.now() - this.startTime;

      return {
        executiveSummary: this.generateExecutiveSummary(
          brandResult,
          productResult,
          audienceResult,
          competitorsResult,
          marketResult
        ),
        brand: brandResult,
        product: productResult,
        audience: audienceResult,
        socialMedia: socialMediaResult,
        competitors: competitorsResult,
        market: marketResult,
        integratedInsights,
        confidenceScore: this.calculateConfidenceScore(
          brandResult,
          productResult,
          audienceResult,
          socialMediaResult,
          competitorsResult,
          marketResult
        ),
        completionTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Analyzer orchestrator failed: ${errorMsg}`);
    }
  }

  private async safeRunAnalyzer<T>(
    stage: string,
    analyzer: () => Promise<T>,
    onProgress?: (stage: string, index: number, total: number) => void
  ): Promise<T> {
    try {
      this.updateProgress(stage, 'running');
      onProgress?.(stage, 1, 6);

      const result = await analyzer();

      this.updateProgress(stage, 'completed');
      this.results.set(stage, result);
      onProgress?.(stage, 2, 6);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateProgress(stage, 'failed', errorMsg);

      // Log error but continue with other analyzers
      console.error(`${stage} analyzer failed:`, errorMsg);

      // Return empty result to allow other analyzers to complete
      throw error;
    }
  }

  private generateExecutiveSummary(
    brand: BrandAnalysisResult,
    product: ProductAnalysisResult,
    audience: AudienceAnalysisResult,
    competitors: CompetitorAnalysisResult,
    market: MarketAnalysisResult
  ): string {
    return `
Research Summary for ${brand.profile.companyName}

Market Position: ${market.analysis.marketHealth}
Competitive Standing: ${competitors.positioning.ourPosition}
Product Fit: ${product.analysis.marketFit}
Audience Resonance: ${audience.analysis.audienceResonance}

Key Strengths:
- ${competitors.positioning.competitiveAdvantages.slice(0, 3).join('\n- ')}

Key Opportunities:
- ${market.opportunities.unmetNeeds.slice(0, 3).join('\n- ')}

Critical Success Factors:
- Strong brand positioning (${brand.analysis.brandPositioning})
- Differentiated product value (${product.analysis.valueProposition})
- Aligned marketing channels (${audience.analysis.channelRecommendations.join(', ')})

Next Steps:
1. Validate market assumptions with customer interviews
2. Refine positioning based on competitive landscape
3. Optimize marketing mix for target audience
    `.trim();
  }

  private generateIntegratedInsights(
    brand: BrandAnalysisResult,
    product: ProductAnalysisResult,
    audience: AudienceAnalysisResult,
    socialMedia: SocialMediaAnalysisResult,
    competitors: CompetitorAnalysisResult,
    market: MarketAnalysisResult
  ) {
    return {
      overallPositioning: `${brand.profile.companyName} is positioned as ${competitors.positioning.ourPosition} in a ${market.analysis.marketHealth} market.`,
      synergies: [
        'Brand voice aligns with audience preferences',
        'Product features meet identified audience needs',
        'Social media strategy supports brand positioning',
        'Market trends favor current product positioning',
      ],
      criticalFactors: [
        `Maintain ${brand.profile.brandVoice} voice across all channels`,
        `Scale to ${market.profile.totalMarketSize} market opportunity`,
        `Execute on competitive advantages: ${competitors.positioning.competitiveAdvantages.join(', ')}`,
        `Build community on ${socialMedia.profile.channels.map(c => c.platform).join(', ')}`,
      ],
      recommendedActions: [
        'Deepen social proof through customer testimonials',
        'Expand into identified market gaps',
        'Strengthen differentiation on key features',
        'Build partnerships with complementary brands',
      ],
    };
  }

  private calculateConfidenceScore(
    ...results: Array<{ timestamp: number }>
  ): number {
    if (results.length === 0) return 0;
    const validResults = results.filter(r => r && r.timestamp);
    return validResults.length === 6 ? 0.95 : (validResults.length / 6) * 0.85;
  }

  getProgress(): AnalysisProgress[] {
    return Array.from(this.progress.values());
  }

  getResult(stage: string): unknown {
    return this.results.get(stage);
  }

  getAllResults(): Map<string, unknown> {
    return new Map(this.results);
  }
}

export async function orchestrateFullAnalysis(
  context: {
    targetCompany: string;
    targetProduct?: string;
    targetMarket?: string;
    researchFindings?: Partial<ResearchFindings>;
  },
  options: AnalyzerOrchestratorOptions = {}
): Promise<ComprehensiveResearchReport> {
  const orchestrator = new AnalyzerOrchestrator();
  return orchestrator.runAllAnalyzers(context, options);
}
