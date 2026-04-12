/**
 * Services Index — Central export for all service modules
 */

export { pdfExporter, PDFExporter, type PDFExportOptions } from './pdfExporter';
export { docGenerator, DocumentGenerator, type ResearchReport, type ReportSection } from './docGenerator';
export { chartGenerator, ChartGenerator, generatePositioningMatrix, generateCoverageChart, generateConfidenceGauge, svgToDataUrl, svgToBase64DataUrl, type ChartOptions, type ChartSize } from './chartGenerator';
export { exportOrchestrator, ExportOrchestrator, type ExportFormat, type ExportRequest, type ExportResult } from './exportOrchestrator';
export { citationService } from './citationService';
export {
  productPageAnalyzer,
  ProductPageAnalyzer,
  type ProductImage,
  type ProductVariant,
  type ProductReview,
  type RawProduct,
  type PricePositioning,
  type IngredientProfile,
  type FeatureAnalysis,
  type ReviewSentiment,
  type ProductAnalysis,
  type PortfolioMetrics,
  type CompetitorComparison,
  type PortfolioAnalysis,
} from './productPageAnalyzer';
export {
  revenueEstimator,
  RevenueEstimator,
  type RevenueInput,
  type RevenueEstimate,
  type EstimationMethod,
  type GrowthSignal,
  type DetailedCalculations,
} from './revenueEstimator';
export {
  socialPresenceAnalyzer,
  SocialPresenceAnalyzer,
  type SocialMediaIntelligence,
  type PlatformPresence,
  type EngagementAnalysis,
  type ContentStrategy,
  type AudienceInsights,
  type ViralPotential,
  type CompetitorComparison as SocialCompetitorComparison,
  type SocialPlatform,
} from './socialPresenceAnalyzer';
export {
  audienceAnalyzer,
  AudienceAnalyzer,
  AudienceAnalysisError,
  type Demographics,
  type AgeRange,
  type IncomeLevel,
  type Geography,
  type Psychographics,
  type Value,
  type Interest,
  type PainPoint,
  type Aspiration,
  type LifestyleSegment,
  type Persona,
  type Channel,
  type NeedsProfile,
  type FunctionalNeed,
  type EmotionalNeed,
  type SocialNeed,
  type UnmetNeed,
  type BehavioralProfile,
  type PurchaseFrequency,
  type LoyaltyIndicator,
  type PriceSensitivity,
  type PricePoint,
  type ChannelPreference,
  type DecisionFactor,
  type CompetitorAudienceAnalysis,
  type UntappedSegment,
  type AudienceIntelligence,
  type UnservedAudience,
  type AudienceContentStrategy,
  type ContentFormat,
  type ProductContext,
} from './audienceAnalyzer';
export {
  CompetitorNicheAnalyzer,
  createAnalyzer,
  getAnalyzer,
  type CompetitorAnalysis,
  type CompetitiveOutcome,
  type NicheAnalysis,
  type PositioningGap,
  type AudienceGap,
  type SupplyDemandMismatch,
  type CompetitorNicheReport,
  CompetitorType,
  MarketPositioning,
  MarketMaturity,
} from './competitorNicheAnalyzer';
