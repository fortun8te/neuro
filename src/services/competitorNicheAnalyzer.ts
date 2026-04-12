/**
 * Competitor & Niche Analyzer for RACKS
 *
 * Comprehensive market intelligence service providing:
 * - Competitor identification and analysis (direct, indirect, adjacent)
 * - Competitive landscape mapping
 * - Niche/category analysis and market sizing
 * - Positioning gap analysis
 * - Audience segmentation gaps
 * - Supply/demand mismatch detection
 *
 * Designed to be production-ready with error handling and no crashes.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('competitor-niche-analyzer');

// ─────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────

export enum CompetitorType {
  DIRECT = 'direct',
  INDIRECT = 'indirect',
  ADJACENT = 'adjacent',
  EMERGING = 'emerging',
  LEGACY = 'legacy',
}

export enum MarketPositioning {
  PREMIUM_NATURAL = 'premium_natural',
  AFFORDABLE_ACCESSIBLE = 'affordable_accessible',
  LUXURY_PREMIUM = 'luxury_premium',
  INNOVATIVE_TECH = 'innovative_tech',
  CLINICAL_SCIENCE = 'clinical_science',
  SUSTAINABLE_ECO = 'sustainable_eco',
  PERSONALIZED_CUSTOM = 'personalized_custom',
  VALUE_MASS = 'value_mass',
}

export enum MarketMaturity {
  EMERGING = 'emerging',
  GROWTH = 'growth',
  MATURE = 'mature',
  DECLINE = 'decline',
}

export interface CompetitorMetrics {
  followers?: number;
  reviews?: number;
  averageRating?: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore?: number; // -1 to 1
  mentionVolume?: number;
  trendingDirection?: 'up' | 'down' | 'stable';
}

export interface CompetitorAnalysis {
  id: string;
  name: string;
  type: CompetitorType;
  positioning: MarketPositioning;
  priceRange?: {
    min: number;
    max: number;
    currency: string;
    typical: number;
  };
  productRange: {
    breadth: 'narrow' | 'moderate' | 'broad';
    depth: 'shallow' | 'moderate' | 'deep';
    categories: string[];
    keyProducts: string[];
  };
  distribution: {
    channels: string[]; // 'online', 'retail', 'subscription', 'direct', etc
    geographies: string[];
    omnichannel: boolean;
  };
  brandStrength: CompetitorMetrics;
  strengths: string[];
  weaknesses: string[];
  marketShareEstimate?: number; // 0-100 percentage
  growthRate?: number; // YoY percentage
  fundingStatus?: string; // 'bootstrapped', 'Series A', 'IPO', etc
  targetAudience: string[];
  uniqueValueProposition: string;
}

export interface PositioningGap {
  positioning: MarketPositioning;
  filled: boolean;
  leaders: string[]; // competitor names filling this positioning
  underservedSegments?: string[];
  opportunity?: {
    description: string;
    estimatedMarketSize?: string;
    difficulty: 'low' | 'medium' | 'high';
  };
}

export interface AudienceGap {
  segment: string;
  description: string;
  size?: string;
  servedWell: boolean;
  currentProviders?: string[];
  unmetNeeds?: string[];
  willingness?: {
    toPay: 'low' | 'medium' | 'high';
    rationale: string;
  };
}

export interface SupplyDemandMismatch {
  category: string;
  demand: {
    description: string;
    strength: 'low' | 'medium' | 'high';
    evidence: string[];
  };
  currentSupply: {
    solutions: string[];
    adequacy: 'insufficient' | 'adequate' | 'oversupplied';
  };
  gap: {
    type: 'price' | 'feature' | 'combination' | 'positioning' | 'availability';
    description: string;
    marketOpportunity: string;
  };
}

export interface NicheAnalysis {
  categoryName: string;
  marketSize: {
    tam: string; // Total Addressable Market
    sam?: string; // Serviceable Available Market
    som?: string; // Serviceable Obtainable Market
  };
  marketGrowth: {
    cagr: number; // Compound Annual Growth Rate
    period: string; // e.g., "2023-2028"
    confidence: 'low' | 'medium' | 'high';
  };
  maturity: MarketMaturity;
  keyTrends: {
    trend: string;
    strength: 'emerging' | 'growing' | 'dominant' | 'declining';
    examples?: string[];
  }[];
  willingness: {
    assessment: string;
    priceSweets?: string[];
    premiumWilling?: number; // % willing to pay premium
  };
  distributionChannels: {
    channel: string;
    prominence: number; // 1-10
    effectiveness: 'emerging' | 'mature' | 'declining';
  }[];
  barriers: {
    type: string;
    height: 'low' | 'medium' | 'high';
    description: string;
  }[];
}

export interface CompetitiveOutcome {
  fragmentationLevel: 'fragmented' | 'moderate' | 'consolidated';
  fragmentationDetail: string;
  marketLeaders: {
    name: string;
    positioning: MarketPositioning;
    strategy: string;
  }[];
  growthLeaders: {
    name: string;
    type: CompetitorType;
    growthRate: number;
    strategy: string;
  }[];
  consolidationTrends: string[];
  barrierToEntry: 'low' | 'medium' | 'high';
  nextMovePredictions: string[];
}

export interface CompetitorNicheReport {
  generatedAt: timestamp;
  product: string;
  category: string;

  // Section 1: Competitor Landscape
  competitors: {
    all: CompetitorAnalysis[];
    byType: Record<CompetitorType, CompetitorAnalysis[]>;
    total: number;
  };

  // Section 2: Competitive Dynamics
  landscape: CompetitiveOutcome;

  // Section 3: Niche/Category Intelligence
  niche: NicheAnalysis;

  // Section 4: Positioning Analysis
  positioningGaps: PositioningGap[];
  positioningStrategy: {
    taken: MarketPositioning[];
    empty: MarketPositioning[];
    mostCrowded: MarketPositioning;
    leastServed: MarketPositioning;
  };

  // Section 5: Audience Gaps
  audienceGaps: AudienceGap[];
  audienceSummary: {
    wellServed: string[];
    underserved: string[];
    unserved: string[];
    geographic?: {
      wellCovered: string[];
      emerging: string[];
      unserved: string[];
    };
  };

  // Section 6: Supply/Demand Mismatch
  supplyDemandMismatches: SupplyDemandMismatch[];

  // Section 7: Opportunity Map
  opportunities: {
    highPriority: {
      title: string;
      reason: string;
      targetAudience: string;
      estimatedMarketSize: string;
      difficulty: 'low' | 'medium' | 'high';
      evidence: string[];
    }[];
    emerging: {
      title: string;
      reason: string;
      signals: string[];
    }[];
  };

  // Meta
  confidence: {
    overall: number; // 0-1
    bySection: Record<string, number>;
  };
  dataQuality: {
    completeness: number; // 0-1
    recency: string; // e.g., "Q1 2026"
  };
  limitations: string[];
}

// Type alias for backward compatibility
type timestamp = number;

// ─────────────────────────────────────────────────────────────────────
// MAIN SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────

export class CompetitorNicheAnalyzer {
  private competitors: Map<string, CompetitorAnalysis> = new Map();
  private niche: NicheAnalysis | null = null;
  private report: CompetitorNicheReport | null = null;

  constructor(private product: string, private category: string) {
    log.info(`Initializing analyzer for: ${product} (${category})`);
  }

  /**
   * Add a competitor to the analysis
   */
  addCompetitor(competitor: CompetitorAnalysis): void {
    try {
      if (!competitor.id || !competitor.name) {
        log.warn('Competitor missing required fields:', competitor);
        return;
      }
      this.competitors.set(competitor.id, competitor);
      log.debug(`Added competitor: ${competitor.name}`);
    } catch (err) {
      log.error('Error adding competitor:', err);
    }
  }

  /**
   * Add multiple competitors in batch
   */
  addCompetitors(competitors: CompetitorAnalysis[]): void {
    try {
      for (const competitor of competitors) {
        this.addCompetitor(competitor);
      }
      log.info(`Added ${competitors.length} competitors`);
    } catch (err) {
      log.error('Error batch adding competitors:', err);
    }
  }

  /**
   * Set niche/category analysis data
   */
  setNicheAnalysis(niche: NicheAnalysis): void {
    try {
      this.niche = niche;
      log.info(`Niche analysis set for: ${niche.categoryName}`);
    } catch (err) {
      log.error('Error setting niche analysis:', err);
    }
  }

  /**
   * Analyze competitive landscape
   */
  analyzeCompetitiveLandscape(): CompetitiveOutcome {
    try {
      const competitors = Array.from(this.competitors.values());

      if (competitors.length === 0) {
        return this.getDefaultCompetitiveOutcome();
      }

      const byType = this.groupByType(competitors);
      const totalMarketShare = competitors.reduce(
        (sum, c) => sum + (c.marketShareEstimate || 0),
        0
      );

      // Fragmentation calculation
      let fragmentationLevel: 'fragmented' | 'moderate' | 'consolidated';
      if (competitors.length > 10 && totalMarketShare < 60) {
        fragmentationLevel = 'fragmented';
      } else if (competitors.length > 5 && totalMarketShare < 80) {
        fragmentationLevel = 'moderate';
      } else {
        fragmentationLevel = 'consolidated';
      }

      // Find market leaders
      const marketLeaders = competitors
        .filter((c) => c.marketShareEstimate && c.marketShareEstimate > 10)
        .sort((a, b) => (b.marketShareEstimate || 0) - (a.marketShareEstimate || 0))
        .slice(0, 3)
        .map((c) => ({
          name: c.name,
          positioning: c.positioning,
          strategy: this.inferStrategy(c),
        }));

      // Find growth leaders
      const growthLeaders = competitors
        .filter((c) => c.growthRate && c.growthRate > 20)
        .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
        .slice(0, 3)
        .map((c) => ({
          name: c.name,
          type: c.type,
          growthRate: c.growthRate || 0,
          strategy: this.inferStrategy(c),
        }));

      // Consolidation trends
      const consolidationTrends = this.identifyConsolidationTrends(competitors);

      // Barrier to entry assessment
      const barrierToEntry = this.assessBarrierToEntry(competitors);

      // Next move predictions
      const nextMovePredictions = this.predictNextMoves(competitors);

      return {
        fragmentationLevel,
        fragmentationDetail: this.getFragmentationDetail(
          competitors.length,
          totalMarketShare
        ),
        marketLeaders: marketLeaders.length > 0 ? marketLeaders : [],
        growthLeaders: growthLeaders.length > 0 ? growthLeaders : [],
        consolidationTrends,
        barrierToEntry,
        nextMovePredictions,
      };
    } catch (err) {
      log.error('Error analyzing competitive landscape:', err);
      return this.getDefaultCompetitiveOutcome();
    }
  }

  /**
   * Identify positioning gaps
   */
  analyzePositioningGaps(): PositioningGap[] {
    try {
      const competitors = Array.from(this.competitors.values());
      const gaps: PositioningGap[] = [];

      // Define all possible positionings
      const allPositionings = Object.values(MarketPositioning);

      for (const positioning of allPositionings) {
        const leaders = competitors
          .filter((c) => c.positioning === positioning)
          .map((c) => c.name);

        const gap: PositioningGap = {
          positioning,
          filled: leaders.length > 0,
          leaders,
        };

        // If filled, identify what's underserved
        if (gap.filled) {
          const positioningCompetitors = competitors.filter(
            (c) => c.positioning === positioning
          );
          gap.underservedSegments = this.findUnderservedSegments(
            positioningCompetitors
          );
        } else {
          // If not filled, assess opportunity
          gap.opportunity = {
            description: this.describePositioningOpportunity(positioning),
            estimatedMarketSize: this.estimateMarketSizeForPositioning(
              positioning
            ),
            difficulty: this.assessDifficultyOfPositioning(positioning),
          };
        }

        gaps.push(gap);
      }

      return gaps;
    } catch (err) {
      log.error('Error analyzing positioning gaps:', err);
      return [];
    }
  }

  /**
   * Analyze audience gaps and underserved segments
   */
  analyzeAudienceGaps(): AudienceGap[] {
    try {
      const competitors = Array.from(this.competitors.values());
      const gaps: AudienceGap[] = [];
      const allSegments = this.extractAllAudienceSegments(competitors);

      for (const segment of allSegments) {
        const providersFor = competitors
          .filter((c) => c.targetAudience?.includes(segment))
          .map((c) => c.name);

        gaps.push({
          segment,
          description: this.describeAudienceSegment(segment),
          size: this.estimateSegmentSize(segment),
          servedWell: providersFor.length >= 2,
          currentProviders: providersFor,
          unmetNeeds: this.identifyUnmetNeeds(segment, providersFor),
          willingness: this.assessWillingness(segment),
        });
      }

      // Add potential unserved segments
      const potentialSegments = this.identifyPotentialSegments();
      for (const segment of potentialSegments) {
        if (!allSegments.includes(segment)) {
          gaps.push({
            segment,
            description: this.describeAudienceSegment(segment),
            size: this.estimateSegmentSize(segment),
            servedWell: false,
            currentProviders: [],
            unmetNeeds: [
              'Primary offering',
              'Market awareness',
              'Trust building',
            ],
            willingness: this.assessWillingness(segment),
          });
        }
      }

      return gaps;
    } catch (err) {
      log.error('Error analyzing audience gaps:', err);
      return [];
    }
  }

  /**
   * Analyze supply/demand mismatches
   */
  analyzeSupplyDemandMismatches(): SupplyDemandMismatch[] {
    try {
      const mismatches: SupplyDemandMismatch[] = [];
      const competitors = Array.from(this.competitors.values());

      // Price-based mismatches
      if (competitors.length > 0) {
        const priceMismatch = this.analyzePriceMismatch(competitors);
        if (priceMismatch) {
          mismatches.push(priceMismatch);
        }
      }

      // Feature-based mismatches
      const featureMismatch = this.analyzeFeatureMismatch(competitors);
      if (featureMismatch) {
        mismatches.push(featureMismatch);
      }

      // Positioning mismatches
      const positioningMismatch = this.analyzePositioningMismatch(competitors);
      if (positioningMismatch) {
        mismatches.push(positioningMismatch);
      }

      // Availability mismatches
      const availabilityMismatch = this.analyzeAvailabilityMismatch(
        competitors
      );
      if (availabilityMismatch) {
        mismatches.push(availabilityMismatch);
      }

      return mismatches.filter((m) => m !== undefined);
    } catch (err) {
      log.error('Error analyzing supply/demand mismatches:', err);
      return [];
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport(): CompetitorNicheReport {
    try {
      const competitors = Array.from(this.competitors.values());

      const report: CompetitorNicheReport = {
        generatedAt: Date.now(),
        product: this.product,
        category: this.category,

        // Competitors
        competitors: {
          all: competitors,
          byType: this.groupByType(competitors),
          total: competitors.length,
        },

        // Landscape
        landscape: this.analyzeCompetitiveLandscape(),

        // Niche
        niche: this.niche || this.getDefaultNicheAnalysis(),

        // Positioning
        positioningGaps: this.analyzePositioningGaps(),
        positioningStrategy: this.analyzePositioningStrategy(competitors),

        // Audience
        audienceGaps: this.analyzeAudienceGaps(),
        audienceSummary: this.summarizeAudience(competitors),

        // Supply/Demand
        supplyDemandMismatches: this.analyzeSupplyDemandMismatches(),

        // Opportunities
        opportunities: this.identifyOpportunities(competitors),

        // Confidence & Quality
        confidence: this.calculateConfidence(competitors),
        dataQuality: {
          completeness: this.assessDataCompleteness(competitors),
          recency: 'Q2 2026',
        },
        limitations: this.identifyLimitations(competitors),
      };

      this.report = report;
      log.info('Report generated successfully');
      return report;
    } catch (err) {
      log.error('Error generating report:', err);
      return this.getDefaultReport();
    }
  }

  /**
   * Get the generated report
   */
  getReport(): CompetitorNicheReport | null {
    return this.report;
  }

  /**
   * Export report as JSON
   */
  exportJSON(): string {
    try {
      if (!this.report) {
        this.generateReport();
      }
      return JSON.stringify(this.report, null, 2);
    } catch (err) {
      log.error('Error exporting JSON:', err);
      return '{}';
    }
  }

  /**
   * Export report as markdown
   */
  exportMarkdown(): string {
    try {
      if (!this.report) {
        this.generateReport();
      }

      const md = this.generateMarkdown(this.report);
      return md;
    } catch (err) {
      log.error('Error exporting markdown:', err);
      return '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────

  private groupByType(
    competitors: CompetitorAnalysis[]
  ): Record<CompetitorType, CompetitorAnalysis[]> {
    const grouped: Record<CompetitorType, CompetitorAnalysis[]> = {
      [CompetitorType.DIRECT]: [],
      [CompetitorType.INDIRECT]: [],
      [CompetitorType.ADJACENT]: [],
      [CompetitorType.EMERGING]: [],
      [CompetitorType.LEGACY]: [],
    };

    for (const competitor of competitors) {
      grouped[competitor.type].push(competitor);
    }

    return grouped;
  }

  private inferStrategy(competitor: CompetitorAnalysis): string {
    try {
      const positioning = competitor.positioning;
      const breadth = competitor.productRange.breadth;
      const distribution = competitor.distribution.channels;

      if (positioning === MarketPositioning.PREMIUM_NATURAL) {
        return 'Premium positioning with natural/clean ingredients focus';
      }
      if (positioning === MarketPositioning.AFFORDABLE_ACCESSIBLE) {
        return 'Mass market accessibility with value pricing';
      }
      if (breadth === 'broad' && distribution.includes('retail')) {
        return 'Omnichannel expansion with broad product portfolio';
      }
      if (competitor.type === CompetitorType.EMERGING) {
        return 'Disruptive growth with digital-first approach';
      }

      return 'Market presence with steady growth';
    } catch (err) {
      log.debug('Error inferring strategy:', err);
      return 'Standard market strategy';
    }
  }

  private identifyConsolidationTrends(
    competitors: CompetitorAnalysis[]
  ): string[] {
    try {
      const trends: string[] = [];

      // Check for large player acquisitions
      const largeAcquisitors = competitors.filter(
        (c) => c.type === CompetitorType.DIRECT && c.marketShareEstimate! > 20
      );
      if (largeAcquisitors.length > 0) {
        trends.push(
          'Large players consolidating market through acquisition'
        );
      }

      // Check for legacy player modernization
      const modernizingLegacy = competitors.filter(
        (c) =>
          c.type === CompetitorType.LEGACY &&
          c.distribution.channels.includes('online')
      );
      if (modernizingLegacy.length > 0) {
        trends.push('Legacy brands digitizing to remain relevant');
      }

      // Check for emerging consolidation
      const emergeingGrowth = competitors.filter(
        (c) => c.type === CompetitorType.EMERGING && (c.growthRate || 0) > 30
      );
      if (emergeingGrowth.length > 2) {
        trends.push('Multiple emerging players competing for market position');
      }

      return trends.length > 0
        ? trends
        : ['Market maintains current competitive structure'];
    } catch (err) {
      log.debug('Error identifying consolidation trends:', err);
      return [];
    }
  }

  private assessBarrierToEntry(
    competitors: CompetitorAnalysis[]
  ): 'low' | 'medium' | 'high' {
    try {
      const avgMarketShare =
        competitors.reduce((sum, c) => sum + (c.marketShareEstimate || 0), 0) /
        Math.max(competitors.length, 1);
      const legacyPresence = competitors.filter(
        (c) => c.type === CompetitorType.LEGACY
      ).length;
      const broadDistribution = competitors.filter(
        (c) => c.distribution.channels.length > 3
      ).length;

      if (avgMarketShare < 5 && legacyPresence === 0) {
        return 'low';
      }
      if (avgMarketShare < 15 && legacyPresence < 2) {
        return 'medium';
      }
      return 'high';
    } catch (err) {
      log.debug('Error assessing barrier to entry:', err);
      return 'medium';
    }
  }

  private predictNextMoves(competitors: CompetitorAnalysis[]): string[] {
    try {
      const moves: string[] = [];

      // Fast growers may expand internationally
      const fastGrowers = competitors.filter((c) => (c.growthRate || 0) > 30);
      if (fastGrowers.length > 0) {
        moves.push(
          'Fast-growing competitors likely to expand into new geographies'
        );
      }

      // Premium players may go into adjacent categories
      const premiumPlayers = competitors.filter(
        (c) =>
          c.positioning === MarketPositioning.PREMIUM_NATURAL ||
          c.positioning === MarketPositioning.LUXURY_PREMIUM
      );
      if (premiumPlayers.length > 0) {
        moves.push('Premium brands likely to extend into adjacent categories');
      }

      // Limited distribution may expand channels
      const limitedDistribution = competitors.filter(
        (c) => c.distribution.channels.length < 2
      );
      if (limitedDistribution.length > 2) {
        moves.push(
          'Direct-to-consumer brands may seek retail partnerships for growth'
        );
      }

      // New entrants may consolidate
      const emerginPlayers = competitors.filter(
        (c) => c.type === CompetitorType.EMERGING && !c.fundingStatus
      );
      if (emerginPlayers.length > 3) {
        moves.push('Emerging players may seek funding or acquisition exits');
      }

      return moves.length > 0
        ? moves
        : ['Market expected to maintain current competitive dynamics'];
    } catch (err) {
      log.debug('Error predicting next moves:', err);
      return [];
    }
  }

  private getFragmentationDetail(totalCompetitors: number, share: number) {
    try {
      if (totalCompetitors > 10 && share < 60) {
        return `Highly fragmented with ${totalCompetitors}+ competitors and top 3 holding ~${Math.round(share)}% share`;
      }
      if (totalCompetitors > 5 && share < 80) {
        return `Moderately fragmented with ${totalCompetitors} competitors and top 3 holding ~${Math.round(share)}% share`;
      }
      return `Consolidated market with ${totalCompetitors} major competitors and top 3 holding ~${Math.round(share)}% share`;
    } catch (err) {
      log.debug('Error getting fragmentation detail:', err);
      return 'Market structure unclear';
    }
  }

  private findUnderservedSegments(positioningCompetitors: CompetitorAnalysis[]) {
    try {
      const segments = new Set<string>();
      const audienceCount: Record<string, number> = {};

      for (const comp of positioningCompetitors) {
        for (const audience of comp.targetAudience) {
          audienceCount[audience] = (audienceCount[audience] || 0) + 1;
          if (audienceCount[audience] === 1) {
            segments.add(audience);
          }
        }
      }

      // Underserved = only served by this positioning
      const underserved = Object.entries(audienceCount)
        .filter(([, count]) => count === 1)
        .map(([segment]) => segment);

      return underserved;
    } catch (err) {
      log.debug('Error finding underserved segments:', err);
      return [];
    }
  }

  private describePositioningOpportunity(positioning: MarketPositioning) {
    try {
      const descriptions: Record<MarketPositioning, string> = {
        [MarketPositioning.PREMIUM_NATURAL]:
          'Clean, natural ingredients with premium pricing',
        [MarketPositioning.AFFORDABLE_ACCESSIBLE]:
          'Accessible price point with strong quality',
        [MarketPositioning.LUXURY_PREMIUM]:
          'Luxury positioning with exclusive positioning',
        [MarketPositioning.INNOVATIVE_TECH]:
          'Technology-driven innovation and benefits',
        [MarketPositioning.CLINICAL_SCIENCE]:
          'Clinical efficacy and scientific backing',
        [MarketPositioning.SUSTAINABLE_ECO]:
          'Sustainable and eco-friendly positioning',
        [MarketPositioning.PERSONALIZED_CUSTOM]:
          'Personalized products for individual needs',
        [MarketPositioning.VALUE_MASS]:
          'Value-for-money for mass market',
      };

      return descriptions[positioning] || 'Market positioning opportunity';
    } catch (err) {
      log.debug('Error describing positioning opportunity:', err);
      return 'Market positioning opportunity';
    }
  }

  private estimateMarketSizeForPositioning(positioning: MarketPositioning) {
    try {
      // Rough estimates based on positioning type
      const estimates: Record<MarketPositioning, string> = {
        [MarketPositioning.PREMIUM_NATURAL]: '$500M - $2B',
        [MarketPositioning.AFFORDABLE_ACCESSIBLE]: '$2B - $10B',
        [MarketPositioning.LUXURY_PREMIUM]: '$100M - $500M',
        [MarketPositioning.INNOVATIVE_TECH]: '$300M - $1.5B',
        [MarketPositioning.CLINICAL_SCIENCE]: '$400M - $2B',
        [MarketPositioning.SUSTAINABLE_ECO]: '$200M - $800M',
        [MarketPositioning.PERSONALIZED_CUSTOM]: '$100M - $600M',
        [MarketPositioning.VALUE_MASS]: '$3B - $15B',
      };

      return estimates[positioning] || '$500M - $2B';
    } catch (err) {
      log.debug('Error estimating market size:', err);
      return '$500M - $2B';
    }
  }

  private assessDifficultyOfPositioning(positioning: MarketPositioning) {
    try {
      const difficulties: Record<MarketPositioning, 'low' | 'medium' | 'high'> =
        {
          [MarketPositioning.PREMIUM_NATURAL]: 'medium',
          [MarketPositioning.AFFORDABLE_ACCESSIBLE]: 'high',
          [MarketPositioning.LUXURY_PREMIUM]: 'medium',
          [MarketPositioning.INNOVATIVE_TECH]: 'high',
          [MarketPositioning.CLINICAL_SCIENCE]: 'high',
          [MarketPositioning.SUSTAINABLE_ECO]: 'medium',
          [MarketPositioning.PERSONALIZED_CUSTOM]: 'medium',
          [MarketPositioning.VALUE_MASS]: 'high',
        };

      return difficulties[positioning] || 'medium';
    } catch (err) {
      log.debug('Error assessing difficulty:', err);
      return 'medium';
    }
  }

  private extractAllAudienceSegments(competitors: CompetitorAnalysis[]) {
    try {
      const segments = new Set<string>();
      for (const comp of competitors) {
        for (const audience of comp.targetAudience) {
          segments.add(audience);
        }
      }
      return Array.from(segments);
    } catch (err) {
      log.debug('Error extracting audience segments:', err);
      return [];
    }
  }

  private describeAudienceSegment(segment: string) {
    try {
      const descriptions: Record<string, string> = {
        'Women 18-35': 'Younger women with digital-first lifestyles',
        'Women 35-50': 'Mid-career women with purchasing power',
        'Men 25-45': 'Male consumers in personal care category',
        'Parents': 'Families prioritizing safety and efficacy',
        'Professionals': 'High-income professionals seeking premium quality',
        'Eco-conscious': 'Environmentally minded consumers valuing sustainability',
        'Budget-conscious': 'Price-sensitive consumers seeking value',
        'Gen Z': 'Digital natives influenced by social proof',
        'Millennials': 'Experience-driven consumers with brand loyalty',
      };

      return descriptions[segment] || `${segment} consumer segment`;
    } catch (err) {
      log.debug('Error describing segment:', err);
      return `${segment} consumer segment`;
    }
  }

  private estimateSegmentSize(segment: string) {
    try {
      const sizes: Record<string, string> = {
        'Women 18-35': '~30M US',
        'Women 35-50': '~25M US',
        'Men 25-45': '~20M US',
        'Parents': '~35M US',
        'Professionals': '~15M US',
        'Eco-conscious': '~40M US',
        'Budget-conscious': '~80M US',
        'Gen Z': '~25M US',
        'Millennials': '~70M US',
      };

      return sizes[segment] || '~10M - 50M';
    } catch (err) {
      log.debug('Error estimating segment size:', err);
      return '~10M - 50M';
    }
  }

  private identifyUnmetNeeds(
    segment: string,
    providers: string[]
  ): string[] {
    try {
      if (providers.length === 0) {
        return [
          'No current market offering',
          'Awareness and education needed',
          'Trust-building required',
        ];
      }
      if (providers.length === 1) {
        return [
          'Limited competitive alternatives',
          'Potential for differentiation',
          'Quality/price trade-off issues',
        ];
      }

      // Generic unmet needs
      return [
        'Better value proposition',
        'Improved accessibility',
        'Enhanced effectiveness claims',
      ];
    } catch (err) {
      log.debug('Error identifying unmet needs:', err);
      return [];
    }
  }

  private assessWillingness(segment: string): { toPay: 'low' | 'medium' | 'high'; rationale: string } {
    try {
      const assessments: Record<
        string,
        { toPay: 'low' | 'medium' | 'high'; rationale: string }
      > = {
        'Women 18-35': {
          toPay: 'high',
          rationale: 'Value quality and brand credibility',
        },
        'Professionals': {
          toPay: 'high',
          rationale: 'Willing to pay premium for results',
        },
        'Budget-conscious': {
          toPay: 'low',
          rationale: 'Price is primary decision factor',
        },
        'Eco-conscious': {
          toPay: 'high',
          rationale: 'Value sustainability over price',
        },
      };

      return (
        assessments[segment] || {
          toPay: 'medium' as const,
          rationale: 'Balanced price-quality sensitivity',
        }
      );
    } catch (err) {
      log.debug('Error assessing willingness:', err);
      return { toPay: 'medium', rationale: 'Standard market willingness' };
    }
  }

  private identifyPotentialSegments(): string[] {
    try {
      return [
        'Men 25-45',
        'Gen Z',
        'Eco-conscious',
        'Professionals',
        'International markets',
      ];
    } catch (err) {
      log.debug('Error identifying potential segments:', err);
      return [];
    }
  }

  private analyzePriceMismatch(competitors: CompetitorAnalysis[]) {
    try {
      const priceRanges = competitors
        .filter((c) => c.priceRange)
        .map((c) => c.priceRange!);

      if (priceRanges.length === 0) return null;

      const minPrice = Math.min(...priceRanges.map((p) => p.min));
      const maxPrice = Math.max(...priceRanges.map((p) => p.max));
      const gaps = this.identifyPriceGaps(priceRanges);

      if (gaps.length === 0) return null;

      return {
        category: 'Pricing',
        demand: {
          description: `Demand exists across price points from $${minPrice} to $${maxPrice}`,
          strength: 'high',
          evidence: [
            'Multiple price tiers in market',
            'Consumer segments with different budgets',
          ],
        },
        currentSupply: {
          solutions: competitors.map((c) => c.name),
          adequacy: gaps.length > 1 ? 'insufficient' : 'adequate',
        },
        gap: {
          type: 'price',
          description: gaps
            .map(
              (g) =>
                `Gap between $${g.min} - $${g.max} with limited options`
            )
            .join('; '),
          marketOpportunity: `Fill pricing gaps for better market segmentation`,
        },
      } as SupplyDemandMismatch;
    } catch (err) {
      log.debug('Error analyzing price mismatch:', err);
      return null;
    }
  }

  private identifyPriceGaps(
    priceRanges: Array<{ min: number; max: number; currency: string }>
  ) {
    try {
      const sorted = priceRanges
        .sort((a, b) => a.max - b.max)
        .map((p) => p.max);

      const gaps = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1] - sorted[i];
        if (gap > sorted[i] * 0.5) {
          // > 50% gap
          gaps.push({ min: sorted[i], max: sorted[i + 1] });
        }
      }
      return gaps;
    } catch (err) {
      log.debug('Error identifying price gaps:', err);
      return [];
    }
  }

  private analyzeFeatureMismatch(
    competitors: CompetitorAnalysis[]
  ): SupplyDemandMismatch | null {
    try {
      const hasDeepProduct = competitors.some((c) => c.productRange.depth === 'deep');
      const hasNarrowProduct = competitors.some(
        (c) => c.productRange.depth === 'shallow'
      );

      if (!hasDeepProduct || !hasNarrowProduct) return null;

      return {
        category: 'Product Features',
        demand: {
          description: 'Consumers demand both simple and comprehensive solutions',
          strength: 'high',
          evidence: [
            'Mix of minimalist and feature-rich brands in market',
            'Different customer needs for simplicity vs features',
          ],
        },
        currentSupply: {
          solutions: competitors.map((c) => c.name),
          adequacy: 'adequate',
        },
        gap: {
          type: 'feature',
          description:
            'Gap between minimalist solutions and comprehensive feature sets',
          marketOpportunity: 'Position as the balanced middle ground',
        },
      };
    } catch (err) {
      log.debug('Error analyzing feature mismatch:', err);
      return null;
    }
  }

  private analyzePositioningMismatch(
    competitors: CompetitorAnalysis[]
  ): SupplyDemandMismatch | null {
    try {
      const positionings = new Set(competitors.map((c) => c.positioning));
      const allPositionings = Object.values(MarketPositioning);

      const uncovered = allPositionings.filter((p) => !positionings.has(p));

      if (uncovered.length === 0) return null;

      return {
        category: 'Positioning',
        demand: {
          description: `Unserved positioning angles: ${uncovered.join(', ')}`,
          strength: 'medium',
          evidence: [
            'Multiple positioning gaps in market',
            'Opportunity for differentiation',
          ],
        },
        currentSupply: {
          solutions: competitors.map((c) => c.name),
          adequacy: 'insufficient',
        },
        gap: {
          type: 'positioning',
          description: `${uncovered.length} unserved positioning angles`,
          marketOpportunity: 'Own unique positioning for competitive advantage',
        },
      };
    } catch (err) {
      log.debug('Error analyzing positioning mismatch:', err);
      return null;
    }
  }

  private analyzeAvailabilityMismatch(
    competitors: CompetitorAnalysis[]
  ): SupplyDemandMismatch | null {
    try {
      const channelsUsed = new Set<string>();
      const geographiesUsed = new Set<string>();

      competitors.forEach((c) => {
        c.distribution.channels.forEach((ch) => channelsUsed.add(ch));
        c.distribution.geographies.forEach((geo) => geographiesUsed.add(geo));
      });

      const expectedChannels = [
        'online',
        'retail',
        'subscription',
        'direct',
        'marketplace',
      ];
      const uncoveredChannels = expectedChannels.filter(
        (ch) => !channelsUsed.has(ch)
      );

      if (uncoveredChannels.length === 0 && geographiesUsed.size > 1) {
        return null;
      }

      return {
        category: 'Availability',
        demand: {
          description: 'Consumers expect access via multiple channels/geographies',
          strength: 'high',
          evidence: [
            'Omnichannel expectations in modern retail',
            'Global market access desires',
          ],
        },
        currentSupply: {
          solutions: competitors.map((c) => c.name),
          adequacy:
            uncoveredChannels.length > 2 || geographiesUsed.size < 2
              ? 'insufficient'
              : 'adequate',
        },
        gap: {
          type: 'availability',
          description: `Limited access via ${uncoveredChannels.slice(0, 2).join(', ')} channels`,
          marketOpportunity: 'Expand distribution for market penetration',
        },
      };
    } catch (err) {
      log.debug('Error analyzing availability mismatch:', err);
      return null;
    }
  }

  private analyzePositioningStrategy(competitors: CompetitorAnalysis[]) {
    try {
      const taken = new Set<MarketPositioning>();
      competitors.forEach((c) => taken.add(c.positioning));

      const all = Object.values(MarketPositioning);
      const empty = all.filter((p) => !taken.has(p));

      const positioningCounts: Record<string, number> = {};
      competitors.forEach((c) => {
        positioningCounts[c.positioning] =
          (positioningCounts[c.positioning] || 0) + 1;
      });

      const mostCrowded = (
        Object.entries(positioningCounts).sort((a, b) => b[1] - a[1])[0] ||
        ['premium_natural', 0]
      )[0] as MarketPositioning;
      const leastServed = empty[0] || (Array.from(taken)[0] as MarketPositioning);

      return {
        taken: Array.from(taken),
        empty,
        mostCrowded,
        leastServed,
      };
    } catch (err) {
      log.debug('Error analyzing positioning strategy:', err);
      return {
        taken: [],
        empty: [],
        mostCrowded: MarketPositioning.PREMIUM_NATURAL,
        leastServed: MarketPositioning.VALUE_MASS,
      };
    }
  }

  private summarizeAudience(competitors: CompetitorAnalysis[]) {
    try {
      const served = new Set<string>();
      const underserved = new Set<string>();
      const allSegments = this.extractAllAudienceSegments(competitors);

      const audienceCounts: Record<string, number> = {};
      competitors.forEach((c) => {
        c.targetAudience.forEach((a) => {
          audienceCounts[a] = (audienceCounts[a] || 0) + 1;
          if (audienceCounts[a] >= 2) {
            served.add(a);
          } else {
            underserved.add(a);
          }
        });
      });

      const potentialSegments = this.identifyPotentialSegments();
      const unserved = potentialSegments.filter(
        (s) => !allSegments.includes(s)
      );

      return {
        wellServed: Array.from(served),
        underserved: Array.from(underserved),
        unserved,
      };
    } catch (err) {
      log.debug('Error summarizing audience:', err);
      return {
        wellServed: [],
        underserved: [],
        unserved: [],
      };
    }
  }

  private identifyOpportunities(competitors: CompetitorAnalysis[]) {
    try {
      const highPriority = [];
      const emerging = [];

      // Price gap opportunities
      const pricingGaps = this.identifyPriceGaps(
        competitors
          .filter((c) => c.priceRange)
          .map((c) => c.priceRange!)
      );
      if (pricingGaps.length > 0) {
        highPriority.push({
          title: 'Price Sweet Spot',
          reason: `Identified ${pricingGaps.length} pricing gaps in market`,
          targetAudience: 'Value-conscious consumers',
          estimatedMarketSize: '$200M - $500M',
          difficulty: 'low',
          evidence: pricingGaps.map(
            (g) => `Gap between $${g.min} - $${g.max}`
          ),
        });
      }

      // Underserved positioning
      const posGaps = this.analyzePositioningGaps();
      const emptyPositionings = posGaps.filter((p) => !p.filled && p.opportunity);
      if (emptyPositionings.length > 0) {
        highPriority.push({
          title: 'Unique Positioning',
          reason: `${emptyPositionings.length} positioning angles uncovered`,
          targetAudience: 'Differentiation-seeking consumers',
          estimatedMarketSize: emptyPositionings[0]?.opportunity?.estimatedMarketSize || '$500M - $2B',
          difficulty: emptyPositionings[0]?.opportunity?.difficulty || 'medium',
          evidence: emptyPositionings.map(
            (p) => p.opportunity?.description || 'Market opportunity'
          ),
        });
      }

      // Emerging segment opportunities
      const audienceGaps = this.analyzeAudienceGaps();
      const emerginGaps = audienceGaps.filter((a) => !a.servedWell);
      if (emerginGaps.length > 0) {
        emerging.push({
          title: 'Underserved Audience Expansion',
          reason: `${emerginGaps.length} segments underserved by current competitors`,
          signals: emerginGaps.slice(0, 3).map((a) => a.segment),
        });
      }

      return {
        highPriority: highPriority.length > 0 ? highPriority : this.getDefaultOpportunities(),
        emerging,
      };
    } catch (err) {
      log.debug('Error identifying opportunities:', err);
      return {
        highPriority: this.getDefaultOpportunities(),
        emerging: [],
      };
    }
  }

  private getDefaultOpportunities() {
    return [
      {
        title: 'Market Positioning',
        reason: 'Opportunity for unique positioning in market',
        targetAudience: 'Target consumers',
        estimatedMarketSize: '$500M - $2B',
        difficulty: 'medium',
        evidence: ['Market gap identified', 'Underserved segment opportunity'],
      },
    ];
  }

  private calculateConfidence(competitors: CompetitorAnalysis[]) {
    try {
      if (competitors.length === 0) {
        return {
          overall: 0.3,
          bySection: {
            competitors: 0.3,
            landscape: 0.2,
            niche: 0.4,
            positioning: 0.4,
            audience: 0.3,
            supplyDemand: 0.3,
            opportunities: 0.4,
          },
        };
      }

      const completeFilled = competitors.filter(
        (c) =>
          c.marketShareEstimate !== undefined &&
          c.growthRate !== undefined &&
          c.priceRange !== undefined
      ).length;

      const completenessRatio = completeFilled / competitors.length;
      const baseConfidence = 0.4 + completenessRatio * 0.5;

      return {
        overall: Math.min(baseConfidence, 0.95),
        bySection: {
          competitors: Math.min(baseConfidence, 0.9),
          landscape: Math.min(baseConfidence * 0.9, 0.8),
          niche: this.niche ? 0.75 : 0.4,
          positioning: Math.min(baseConfidence * 0.95, 0.85),
          audience: Math.min(baseConfidence * 0.8, 0.7),
          supplyDemand: Math.min(baseConfidence * 0.85, 0.75),
          opportunities: Math.min(baseConfidence * 0.8, 0.7),
        },
      };
    } catch (err) {
      log.debug('Error calculating confidence:', err);
      return {
        overall: 0.5,
        bySection: {},
      };
    }
  }

  private assessDataCompleteness(competitors: CompetitorAnalysis[]) {
    try {
      if (competitors.length === 0) return 0;

      let complete = 0;
      for (const comp of competitors) {
        let fieldCount = 0;
        if (comp.marketShareEstimate) fieldCount++;
        if (comp.growthRate) fieldCount++;
        if (comp.priceRange) fieldCount++;
        if (comp.brandStrength?.followers) fieldCount++;
        if (comp.fundingStatus) fieldCount++;

        if (fieldCount >= 4) complete++;
      }

      return complete / competitors.length;
    } catch (err) {
      log.debug('Error assessing data completeness:', err);
      return 0.5;
    }
  }

  private identifyLimitations(competitors: CompetitorAnalysis[]) {
    try {
      const limitations: string[] = [];

      if (competitors.length < 5) {
        limitations.push('Limited competitor dataset may not represent full market');
      }

      const withMetrics = competitors.filter(
        (c) => c.brandStrength?.followers || c.marketShareEstimate
      );
      if (withMetrics.length < competitors.length * 0.6) {
        limitations.push('Missing market share and brand metrics for some competitors');
      }

      const withPricing = competitors.filter((c) => c.priceRange);
      if (withPricing.length < competitors.length * 0.8) {
        limitations.push('Incomplete pricing information limits price gap analysis');
      }

      if (!this.niche) {
        limitations.push(
          'Market sizing estimates are approximate without primary market data'
        );
      }

      return limitations.length > 0
        ? limitations
        : [
            'Analysis based on available data; primary research recommended for validation',
          ];
    } catch (err) {
      log.debug('Error identifying limitations:', err);
      return ['Data limitations exist'];
    }
  }

  private generateMarkdown(report: CompetitorNicheReport): string {
    try {
      let md = `# Competitor & Niche Analysis Report\n\n`;
      md += `**Product:** ${report.product}\n`;
      md += `**Category:** ${report.category}\n`;
      md += `**Generated:** ${new Date(report.generatedAt).toISOString()}\n\n`;

      // Executive summary
      md += `## Executive Summary\n\n`;
      md += `Market has **${report.competitors.total} competitors** across ${Object.keys(report.competitors.byType).filter((k) => report.competitors.byType[k as CompetitorType].length > 0).length} categories.\n`;
      md += `Market is **${report.landscape.fragmentationLevel}** with **${report.landscape.barrierToEntry} barriers to entry**.\n\n`;

      // Competitors
      md += `## Competitor Landscape (${report.competitors.total} Total)\n\n`;
      for (const type of Object.values(CompetitorType)) {
        const comps = report.competitors.byType[type];
        if (comps.length === 0) continue;
        md += `### ${type.toUpperCase()} Competitors (${comps.length})\n\n`;
        for (const comp of comps) {
          md += `- **${comp.name}** — ${comp.positioning}\n`;
          if (comp.marketShareEstimate)
            md += `  - Market Share: ${comp.marketShareEstimate}%\n`;
          if (comp.growthRate)
            md += `  - Growth: ${comp.growthRate}% YoY\n`;
        }
        md += `\n`;
      }

      // Landscape
      md += `## Competitive Dynamics\n\n`;
      md += `**Fragmentation:** ${report.landscape.fragmentationDetail}\n\n`;
      if (report.landscape.marketLeaders.length > 0) {
        md += `**Market Leaders:**\n`;
        for (const leader of report.landscape.marketLeaders) {
          md += `- ${leader.name} (${leader.positioning})\n`;
        }
        md += `\n`;
      }

      // Positioning gaps
      md += `## Positioning Analysis\n\n`;
      const emptyPositionings = report.positioningGaps.filter((p) => !p.filled);
      md += `**Taken:** ${report.positioningStrategy.taken.join(', ')}\n`;
      md += `**Empty:** ${report.positioningStrategy.empty.join(', ')}\n\n`;
      if (emptyPositionings.length > 0) {
        md += `**Opportunities:**\n`;
        for (const gap of emptyPositionings.slice(0, 3)) {
          md += `- ${gap.positioning}: ${gap.opportunity?.description || 'Market gap'}\n`;
        }
        md += `\n`;
      }

      // Opportunities
      md += `## Key Opportunities\n\n`;
      for (const opp of report.opportunities.highPriority) {
        md += `### ${opp.title}\n`;
        md += `**Reason:** ${opp.reason}\n`;
        md += `**Target:** ${opp.targetAudience}\n`;
        md += `**Size:** ${opp.estimatedMarketSize}\n\n`;
      }

      // Data quality
      md += `## Data Quality & Confidence\n\n`;
      md += `**Overall Confidence:** ${Math.round(report.confidence.overall * 100)}%\n`;
      md += `**Data Completeness:** ${Math.round(report.dataQuality.completeness * 100)}%\n\n`;
      if (report.limitations.length > 0) {
        md += `**Limitations:**\n`;
        for (const limit of report.limitations) {
          md += `- ${limit}\n`;
        }
      }

      return md;
    } catch (err) {
      log.error('Error generating markdown:', err);
      return '# Report Generation Error\n\nUnable to generate markdown report.';
    }
  }

  private getDefaultCompetitiveOutcome(): CompetitiveOutcome {
    return {
      fragmentationLevel: 'moderate',
      fragmentationDetail: 'Market structure not yet determined',
      marketLeaders: [],
      growthLeaders: [],
      consolidationTrends: [],
      barrierToEntry: 'medium',
      nextMovePredictions: [],
    };
  }

  private getDefaultNicheAnalysis(): NicheAnalysis {
    return {
      categoryName: this.category,
      marketSize: {
        tam: 'Pending analysis',
      },
      marketGrowth: {
        cagr: 0,
        period: '2023-2028',
        confidence: 'low',
      },
      maturity: MarketMaturity.GROWTH,
      keyTrends: [],
      willingness: {
        assessment: 'Market willingness to pay assessed during analysis',
      },
      distributionChannels: [],
      barriers: [],
    };
  }

  private getDefaultReport(): CompetitorNicheReport {
    return {
      generatedAt: Date.now(),
      product: this.product,
      category: this.category,
      competitors: {
        all: [],
        byType: {
          [CompetitorType.DIRECT]: [],
          [CompetitorType.INDIRECT]: [],
          [CompetitorType.ADJACENT]: [],
          [CompetitorType.EMERGING]: [],
          [CompetitorType.LEGACY]: [],
        },
        total: 0,
      },
      landscape: this.getDefaultCompetitiveOutcome(),
      niche: this.getDefaultNicheAnalysis(),
      positioningGaps: [],
      positioningStrategy: {
        taken: [],
        empty: Object.values(MarketPositioning),
        mostCrowded: MarketPositioning.PREMIUM_NATURAL,
        leastServed: MarketPositioning.VALUE_MASS,
      },
      audienceGaps: [],
      audienceSummary: {
        wellServed: [],
        underserved: [],
        unserved: [],
      },
      supplyDemandMismatches: [],
      opportunities: {
        highPriority: [],
        emerging: [],
      },
      confidence: {
        overall: 0.3,
        bySection: {},
      },
      dataQuality: {
        completeness: 0,
        recency: 'Unknown',
      },
      limitations: ['No competitors analyzed yet'],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE & EXPORTS
// ─────────────────────────────────────────────────────────────────────

let analyzerInstance: CompetitorNicheAnalyzer | null = null;

export function createAnalyzer(
  product: string,
  category: string
): CompetitorNicheAnalyzer {
  try {
    analyzerInstance = new CompetitorNicheAnalyzer(product, category);
    return analyzerInstance;
  } catch (err) {
    log.error('Error creating analyzer:', err);
    return new CompetitorNicheAnalyzer(product, category);
  }
}

export function getAnalyzer(): CompetitorNicheAnalyzer | null {
  return analyzerInstance;
}

export default CompetitorNicheAnalyzer;
