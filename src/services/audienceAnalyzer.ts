/**
 * Audience Analyzer Service for RACKS
 * Extracts comprehensive audience intelligence from research data
 * Covers: demographics, psychographics, segmentation, needs, behaviors
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('audience-analyzer');

/**
 * Demographics Profile
 */
export interface Demographics {
  ageRanges: AgeRange[];
  primaryGender: 'male' | 'female' | 'non-binary' | 'all';
  secondaryGender?: 'male' | 'female' | 'non-binary';
  incomeLevel: IncomeLevel;
  geographies: Geography[];
  occupations: string[];
  lifestyleClues: string[];
}

export interface AgeRange {
  min: number;
  max: number;
  percentage: number;
  confidence: number;
}

export type IncomeLevel = 'budget' | 'mass-market' | 'premium' | 'luxury' | 'mixed';

export interface Geography {
  region: string;
  country: string;
  urbanRural: 'urban' | 'suburban' | 'rural' | 'mixed';
  percentage: number;
}

/**
 * Psychographics Profile
 */
export interface Psychographics {
  values: Value[];
  interests: Interest[];
  painPoints: PainPoint[];
  aspirations: Aspiration[];
  lifestyle: LifestyleSegment;
}

export interface Value {
  value: string;
  importance: number;
  evidence: string[];
}

export interface Interest {
  category: string;
  specificity: string;
  relevance: number;
}

export interface PainPoint {
  problem: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  productRelevance: number;
  affectedSegments: string[];
}

export interface Aspiration {
  goal: string;
  timeframe: 'immediate' | 'short-term' | 'long-term';
  emotionalDrivers: string[];
}

export type LifestyleSegment =
  | 'active-outdoor'
  | 'home-focused'
  | 'professional'
  | 'student'
  | 'wellness-conscious'
  | 'sustainability-focused'
  | 'luxury-oriented'
  | 'budget-conscious'
  | 'social-media-native'
  | 'mixed';

/**
 * Customer Personas
 */
export interface Persona {
  id: string;
  name: string;
  description: string;
  demographics: Demographics;
  psychographics: Psychographics;
  needs: NeedsProfile;
  behaviors: BehavioralProfile;
  estimatedPercentage: number;
  purchaseDriver: string;
  commonObjections: string[];
  preferredChannels: Channel[];
}

export type Channel = 'email' | 'social-media' | 'in-store' | 'word-of-mouth' | 'influencer' | 'paid-ads' | 'organic-search' | 'subscription';

/**
 * Needs Analysis
 */
export interface NeedsProfile {
  functional: FunctionalNeed[];
  emotional: EmotionalNeed[];
  social: SocialNeed[];
  unmet: UnmetNeed[];
}

export interface FunctionalNeed {
  need: string;
  productSolution: string;
  criticality: 'must-have' | 'should-have' | 'nice-to-have';
}

export interface EmotionalNeed {
  feeling: string;
  desiredOutcome: string;
  connectedValues: string[];
}

export interface SocialNeed {
  needType: 'status' | 'community' | 'belonging' | 'identity' | 'expression';
  description: string;
  influenceOnPurchase: number;
}

export interface UnmetNeed {
  gap: string;
  affectedSegments: string[];
  marketOpportunity: string;
  evidenceSources: string[];
}

/**
 * Behavioral Profile
 */
export interface BehavioralProfile {
  purchaseFrequency: PurchaseFrequency;
  loyaltyIndicators: LoyaltyIndicator[];
  priceSensitivity: PriceSensitivity;
  channelPreferences: ChannelPreference[];
  decisionFactors: DecisionFactor[];
  brandSwitchTriggers: string[];
}

export type PurchaseFrequency = 'one-time' | 'occasional' | 'regular' | 'subscription' | 'impulse';

export interface LoyaltyIndicator {
  indicator: string;
  strength: number;
  evidenceType: 'reviews' | 'social-media' | 'repeat-purchase' | 'referral' | 'community';
}

export interface PriceSensitivity {
  level: 'very-sensitive' | 'moderate' | 'insensitive' | 'mixed';
  pricePoints: PricePoint[];
  acceptablePriceRange: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface PricePoint {
  price: number;
  conversionLikelihood: number;
  segment: string;
}

export interface ChannelPreference {
  channel: Channel;
  preference: number;
  conversionRate: number;
}

export interface DecisionFactor {
  factor: string;
  importance: number;
  resonatesWithSegments: string[];
}

/**
 * Competitor Audience Analysis
 */
export interface CompetitorAudienceAnalysis {
  competitor: string;
  targetedSegments: string[];
  loyalCustomers: string;
  switchReasons: string[];
  untappedSegments: UntappedSegment[];
  differentiation: string;
}

export interface UntappedSegment {
  segment: string;
  reason: string;
  opportunity: string;
  estimatedSize: string;
}

/**
 * Complete Audience Intelligence
 */
export interface AudienceIntelligence {
  brand: string;
  analysisDate: string;
  primaryPersona: Persona;
  secondaryPersonas: Persona[];
  unservedAudiences: UnservedAudience[];
  competitorAnalysis: CompetitorAudienceAnalysis[];
  keyInsights: string[];
  marketingImplications: string[];
  contentStrategy: ContentStrategy;
  confidenceScore: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'limited';
}

export interface UnservedAudience {
  segment: string;
  demographics: Partial<Demographics>;
  whyNotServed: string;
  opportunity: string;
  estimatedSize: string;
  entryStrategy: string;
}

export interface ContentStrategy {
  messagingPillars: string[];
  tonalGuidance: string;
  contentFormats: ContentFormat[];
  keywordThemes: string[];
}

export interface ContentFormat {
  format: string;
  effectiveness: number;
  primaryPersonas: string[];
}

/**
 * Audience Analyzer Service
 */
export class AudienceAnalyzer {
  private confidence: number = 0;
  private dataPoints: number = 0;
  private sources: Set<string> = new Set();

  /**
   * Analyze audience from research data
   */
  analyzeAudience(researchData: string, productContext: ProductContext): AudienceIntelligence {
    try {
      this.reset();

      const demographics = this.extractDemographics(researchData, productContext);
      const psychographics = this.extractPsychographics(researchData, productContext);
      const needs = this.analyzeNeeds(researchData, productContext);
      const behaviors = this.analyzeBehaviors(researchData, productContext);

      const primaryPersona = this.buildPersona(
        'primary',
        'Primary Target',
        'Core customer segment',
        demographics,
        psychographics,
        needs,
        behaviors,
        45
      );

      const secondaryPersonas = this.buildSecondaryPersonas(
        researchData,
        demographics,
        psychographics,
        needs,
        behaviors
      );

      const unservedAudiences = this.identifyUnservedAudiences(
        researchData,
        productContext,
        [primaryPersona, ...secondaryPersonas]
      );

      const competitorAnalysis = this.analyzeCompetitorAudiences(researchData);

      const keyInsights = this.generateKeyInsights(
        primaryPersona,
        secondaryPersonas,
        unservedAudiences,
        competitorAnalysis
      );

      const marketingImplications = this.deriveMarketingImplications(
        primaryPersona,
        secondaryPersonas,
        psychographics,
        behaviors
      );

      const contentStrategy = this.defineContentStrategy(
        primaryPersona,
        secondaryPersonas,
        psychographics,
        needs
      );

      const dataQuality = this.assessDataQuality();

      return {
        brand: productContext.brandName,
        analysisDate: new Date().toISOString(),
        primaryPersona,
        secondaryPersonas,
        unservedAudiences,
        competitorAnalysis,
        keyInsights,
        marketingImplications,
        contentStrategy,
        confidenceScore: this.confidence,
        dataQuality
      };
    } catch (err) {
      log.error('analyzeAudience failed:', err);
      throw new AudienceAnalysisError('Failed to analyze audience', err);
    }
  }

  /**
   * Extract demographic information
   */
  private extractDemographics(researchData: string, context: ProductContext): Demographics {
    const data = researchData.toLowerCase();

    // Age ranges - look for common age indicators
    const ageRanges: AgeRange[] = [];
    const agePatterns = [
      { min: 18, max: 25, keywords: ['gen z', 'young adult', '18-25', 'teen', 'college', 'university'] },
      { min: 26, max: 35, keywords: ['millennial', '26-35', 'young professional', 'startup'] },
      { min: 36, max: 45, keywords: ['35-45', 'parent', 'established', 'professional'] },
      { min: 46, max: 55, keywords: ['45-55', 'manager', 'experienced'] },
      { min: 56, max: 99, keywords: ['56+', 'senior', 'retiree', 'boomer'] }
    ];

    for (const range of agePatterns) {
      const matches = range.keywords.filter(kw => data.includes(kw)).length;
      if (matches > 0) {
        ageRanges.push({
          min: range.min,
          max: range.max,
          percentage: matches / range.keywords.length * 100,
          confidence: Math.min(matches * 0.3, 0.9)
        });
        this.addDataPoint();
      }
    }

    // Gender targeting
    let primaryGender: 'male' | 'female' | 'non-binary' | 'all' = 'all';
    let secondaryGender: 'male' | 'female' | 'non-binary' | undefined;

    const femaleScore = this.scoreKeywords(data, ['women', 'female', 'girl', 'she/her', 'mother', 'sister']);
    const maleScore = this.scoreKeywords(data, ['men', 'male', 'boy', 'he/him', 'father', 'brother']);

    if (femaleScore > maleScore && femaleScore > 0.3) {
      primaryGender = 'female';
      if (maleScore > 0.1) secondaryGender = 'male';
    } else if (maleScore > femaleScore && maleScore > 0.3) {
      primaryGender = 'male';
      if (femaleScore > 0.1) secondaryGender = 'female';
    }

    if (femaleScore > 0 || maleScore > 0) this.addDataPoint();

    // Income level
    const incomeClues = {
      budget: ['cheap', 'affordable', 'budget', 'discount', 'sale', 'value', 'economical'],
      'mass-market': ['accessible', 'mainstream', 'everyday', 'standard', 'popular'],
      premium: ['premium', 'quality', 'luxury', 'exclusive', 'high-end', 'investment', 'splurge'],
      luxury: ['luxury', 'prestige', 'elite', 'bespoke', 'exclusive', 'designer', 'heritage']
    };

    let incomeLevel: IncomeLevel = 'mass-market';
    let maxIncomeScore = 0;

    for (const [level, keywords] of Object.entries(incomeClues)) {
      const score = this.scoreKeywords(data, keywords);
      if (score > maxIncomeScore) {
        maxIncomeScore = score;
        incomeLevel = level as IncomeLevel;
      }
    }

    if (maxIncomeScore > 0) {
      this.addDataPoint();
      this.confidence += maxIncomeScore * 0.1;
    }

    // Geography
    const geographies = this.extractGeographies(researchData);
    if (geographies.length > 0) this.addDataPoint();

    // Occupations & lifestyle
    const occupations = this.extractOccupations(researchData);
    if (occupations.length > 0) this.addDataPoint();

    const lifestyleClues = this.extractLifestyleClues(researchData);
    if (lifestyleClues.length > 0) this.addDataPoint();

    return {
      ageRanges: ageRanges.length > 0 ? ageRanges : [{ min: 18, max: 65, percentage: 100, confidence: 0.3 }],
      primaryGender,
      secondaryGender,
      incomeLevel,
      geographies: geographies.length > 0 ? geographies : [{
        region: 'multiple',
        country: 'global',
        urbanRural: 'mixed',
        percentage: 100
      }],
      occupations,
      lifestyleClues
    };
  }

  /**
   * Extract psychographic information
   */
  private extractPsychographics(researchData: string, context: ProductContext): Psychographics {
    const data = researchData.toLowerCase();

    // Values
    const values = this.extractValues(researchData);
    if (values.length > 0) this.addDataPoint();

    // Interests
    const interests = this.extractInterests(researchData, context);
    if (interests.length > 0) this.addDataPoint();

    // Pain points
    const painPoints = this.extractPainPoints(researchData, context);
    if (painPoints.length > 0) this.addDataPoint();

    // Aspirations
    const aspirations = this.extractAspirations(researchData, context);
    if (aspirations.length > 0) this.addDataPoint();

    // Lifestyle
    const lifestyle = this.classifyLifestyle(researchData);

    return {
      values,
      interests,
      painPoints,
      aspirations,
      lifestyle
    };
  }

  /**
   * Analyze customer needs
   */
  private analyzeNeeds(researchData: string, context: ProductContext): NeedsProfile {
    const functional = this.extractFunctionalNeeds(researchData, context);
    if (functional.length > 0) this.addDataPoint();

    const emotional = this.extractEmotionalNeeds(researchData);
    if (emotional.length > 0) this.addDataPoint();

    const social = this.extractSocialNeeds(researchData);
    if (social.length > 0) this.addDataPoint();

    const unmet = this.identifyUnmetNeeds(researchData, context);
    if (unmet.length > 0) this.addDataPoint();

    return {
      functional,
      emotional,
      social,
      unmet
    };
  }

  /**
   * Analyze behavioral patterns
   */
  private analyzeBehaviors(researchData: string, context: ProductContext): BehavioralProfile {
    const data = researchData.toLowerCase();

    // Purchase frequency
    const purchaseFrequency = this.determinePurchaseFrequency(researchData);
    this.addDataPoint();

    // Loyalty indicators
    const loyaltyIndicators = this.extractLoyaltyIndicators(researchData);
    if (loyaltyIndicators.length > 0) this.addDataPoint();

    // Price sensitivity
    const priceSensitivity = this.analyzePriceSensitivity(researchData, context);
    this.addDataPoint();

    // Channel preferences
    const channelPreferences = this.determineChannelPreferences(researchData);
    if (channelPreferences.length > 0) this.addDataPoint();

    // Decision factors
    const decisionFactors = this.extractDecisionFactors(researchData);
    if (decisionFactors.length > 0) this.addDataPoint();

    // Brand switch triggers
    const brandSwitchTriggers = this.identifyBrandSwitchTriggers(researchData);
    if (brandSwitchTriggers.length > 0) this.addDataPoint();

    return {
      purchaseFrequency,
      loyaltyIndicators,
      priceSensitivity,
      channelPreferences,
      decisionFactors,
      brandSwitchTriggers
    };
  }

  /**
   * Build a persona from components
   */
  private buildPersona(
    id: string,
    name: string,
    description: string,
    demographics: Demographics,
    psychographics: Psychographics,
    needs: NeedsProfile,
    behaviors: BehavioralProfile,
    estimatedPercentage: number
  ): Persona {
    const purchaseDriver = this.determinePrimaryDriver(psychographics, needs);
    const commonObjections = this.identifyCommonObjections(needs, psychographics);
    const preferredChannels = this.rankChannelPreferences(behaviors.channelPreferences);

    return {
      id,
      name,
      description,
      demographics,
      psychographics,
      needs,
      behaviors,
      estimatedPercentage,
      purchaseDriver,
      commonObjections,
      preferredChannels
    };
  }

  /**
   * Build secondary personas
   */
  private buildSecondaryPersonas(
    researchData: string,
    demographics: Demographics,
    psychographics: Psychographics,
    needs: NeedsProfile,
    behaviors: BehavioralProfile
  ): Persona[] {
    const personas: Persona[] = [];

    // Secondary persona 1: Different age group or gender
    if (demographics.ageRanges.length > 1) {
      const secondDemographics: Demographics = {
        ...demographics,
        ageRanges: [demographics.ageRanges[demographics.ageRanges.length - 1]],
        primaryGender: demographics.secondaryGender || demographics.primaryGender
      };

      personas.push(this.buildPersona(
        'secondary-1',
        'Secondary Target',
        'Alternative customer segment',
        secondDemographics,
        psychographics,
        needs,
        behaviors,
        25
      ));
    }

    // Secondary persona 2: Different motivation or lifestyle
    const altPsycho = { ...psychographics };
    if (psychographics.lifestyle !== 'mixed') {
      personas.push(this.buildPersona(
        'secondary-2',
        'Lifestyle-Driven Buyer',
        'Motivated by lifestyle alignment',
        demographics,
        altPsycho,
        needs,
        behaviors,
        20
      ));
    }

    return personas;
  }

  /**
   * Identify unserved audiences
   */
  private identifyUnservedAudiences(
    researchData: string,
    context: ProductContext,
    personas: Persona[]
  ): UnservedAudience[] {
    const unserved: UnservedAudience[] = [];
    const data = researchData.toLowerCase();

    // Look for audiences mentioned but not actively served
    const potentialSegments = [
      { segment: 'Budget-conscious buyers', keywords: ['cheap', 'affordable', 'discount'] },
      { segment: 'Sustainability-focused', keywords: ['eco', 'sustainable', 'green', 'environment'] },
      { segment: 'Luxury segment', keywords: ['luxury', 'premium', 'high-end'] },
      { segment: 'Male audience', keywords: ['men', 'male', 'he/him'] },
      { segment: 'Older demographics', keywords: ['senior', 'mature', '55+', '60+'] },
      { segment: 'Gen Z', keywords: ['gen z', 'tiktok', 'instagram', 'viral'] }
    ];

    const servedSegments = new Set(personas.map(p => p.description.toLowerCase()));

    for (const potential of potentialSegments) {
      const mentioned = potential.keywords.some(kw => data.includes(kw));
      const served = servedSegments.has(potential.segment.toLowerCase());

      if (mentioned && !served) {
        unserved.push({
          segment: potential.segment,
          demographics: {},
          whyNotServed: 'Limited marketing focus on this segment',
          opportunity: `Expanding reach to ${potential.segment.toLowerCase()}`,
          estimatedSize: 'Moderate',
          entryStrategy: `Develop messaging and positioning specific to ${potential.segment.toLowerCase()}`
        });
      }
    }

    return unserved;
  }

  /**
   * Analyze competitor audiences
   */
  private analyzeCompetitorAudiences(researchData: string): CompetitorAudienceAnalysis[] {
    const analyses: CompetitorAudienceAnalysis[] = [];
    const data = researchData.toLowerCase();

    // Extract mentions of competitors
    const competitorPatterns = [
      'competitor', 'brand', 'alternative', 'rival', 'similar product'
    ];

    if (competitorPatterns.some(p => data.includes(p))) {
      analyses.push({
        competitor: 'Primary Competitors',
        targetedSegments: ['Similar demographics', 'Health-conscious consumers'],
        loyalCustomers: 'Moderate to High',
        switchReasons: [
          'Better pricing',
          'Superior product quality',
          'Environmental claims',
          'Influencer endorsements'
        ],
        untappedSegments: [
          {
            segment: 'Budget segment',
            reason: 'Positioned as premium',
            opportunity: 'Value tier introduction',
            estimatedSize: 'Large'
          }
        ],
        differentiation: 'Focus on sustainability and efficacy'
      });
    }

    return analyses;
  }

  /**
   * Generate key insights
   */
  private generateKeyInsights(
    primary: Persona,
    secondary: Persona[],
    unserved: UnservedAudience[],
    competitors: CompetitorAudienceAnalysis[]
  ): string[] {
    const insights: string[] = [];

    insights.push(`Primary audience is ${primary.demographics.primaryGender === 'female' ? 'predominantly female' : primary.demographics.primaryGender === 'male' ? 'predominantly male' : 'mixed gender'}`);

    if (primary.demographics.incomeLevel !== 'mass-market') {
      insights.push(`Targets ${primary.demographics.incomeLevel} segment with premium positioning`);
    }

    if (unserved.length > 0) {
      insights.push(`Significant opportunity in ${unserved[0].segment.toLowerCase()} (currently underserved)`);
    }

    insights.push(`Primary purchase driver is ${primary.purchaseDriver}`);

    if (primary.behaviors.brandSwitchTriggers.length > 0) {
      insights.push(`Customers may switch due to: ${primary.behaviors.brandSwitchTriggers.slice(0, 2).join(', ')}`);
    }

    insights.push(`Most effective channels: ${primary.preferredChannels.slice(0, 2).join(', ')}`);

    return insights;
  }

  /**
   * Derive marketing implications
   */
  private deriveMarketingImplications(
    primary: Persona,
    secondary: Persona[],
    psychographics: Psychographics,
    behaviors: BehavioralProfile
  ): string[] {
    const implications: string[] = [];

    implications.push(`Messaging should emphasize ${psychographics.values[0]?.value || 'core benefits'}`);

    if (behaviors.loyaltyIndicators.length > 0) {
      implications.push('Focus on building loyalty through community and exclusivity');
    }

    if (behaviors.channelPreferences.length > 0) {
      const topChannel = behaviors.channelPreferences[0]?.channel;
      if (topChannel) {
        implications.push(`Allocate 40% of budget to ${topChannel} channel`);
      }
    }

    implications.push('Create educational content addressing key pain points');
    implications.push('Develop objection-handling narratives for common hesitations');
    implications.push('Build influencer partnerships aligned with audience values');

    return implications;
  }

  /**
   * Define content strategy
   */
  private defineContentStrategy(
    primary: Persona,
    secondary: Persona[],
    psychographics: Psychographics,
    needs: NeedsProfile
  ): ContentStrategy {
    const messagingPillars = [
      psychographics.values[0]?.value || 'Core benefit',
      needs.functional[0]?.need || 'Functional advantage',
      needs.emotional[0]?.feeling || 'Emotional connection'
    ].filter(Boolean);

    const tonalGuidance = this.determineTone(psychographics);

    const contentFormats: ContentFormat[] = [
      { format: 'Educational blog posts', effectiveness: 0.8, primaryPersonas: ['primary'] },
      { format: 'Instagram/TikTok video', effectiveness: 0.9, primaryPersonas: ['primary', 'secondary-1'] },
      { format: 'Customer testimonials', effectiveness: 0.85, primaryPersonas: ['primary'] },
      { format: 'In-depth guides', effectiveness: 0.75, primaryPersonas: ['secondary-2'] },
      { format: 'Email nurture sequences', effectiveness: 0.7, primaryPersonas: ['primary'] }
    ];

    const keywordThemes = [
      'hair health',
      'scalp wellness',
      'sustainable beauty',
      'product efficacy',
      'natural ingredients'
    ];

    return {
      messagingPillars,
      tonalGuidance,
      contentFormats,
      keywordThemes
    };
  }

  /**
   * Helper: Score keyword presence
   */
  private scoreKeywords(text: string, keywords: string[]): number {
    const matches = keywords.filter(kw => text.includes(kw)).length;
    return matches / keywords.length;
  }

  /**
   * Helper: Extract geographies
   */
  private extractGeographies(text: string): Geography[] {
    const geographies: Geography[] = [];
    const regionPatterns = [
      { region: 'North America', keywords: ['usa', 'us', 'canada', 'north america'] },
      { region: 'Europe', keywords: ['europe', 'eu', 'uk', 'germany', 'france'] },
      { region: 'Asia', keywords: ['asia', 'china', 'india', 'southeast asia'] },
      { region: 'Global', keywords: ['global', 'worldwide', 'international'] }
    ];

    for (const pattern of regionPatterns) {
      if (pattern.keywords.some(kw => text.toLowerCase().includes(kw))) {
        geographies.push({
          region: pattern.region,
          country: 'multiple',
          urbanRural: 'mixed',
          percentage: 25
        });
      }
    }

    return geographies.length > 0 ? geographies : [];
  }

  /**
   * Helper: Extract occupations
   */
  private extractOccupations(text: string): string[] {
    const occupations: string[] = [];
    const occupationKeywords = [
      'professional', 'student', 'parent', 'entrepreneur', 'executive',
      'homemaker', 'freelancer', 'teacher', 'manager', 'consultant'
    ];

    for (const occupation of occupationKeywords) {
      if (text.toLowerCase().includes(occupation)) {
        occupations.push(occupation);
      }
    }

    return occupations;
  }

  /**
   * Helper: Extract lifestyle clues
   */
  private extractLifestyleClues(text: string): string[] {
    const clues: string[] = [];
    const lifestyleKeywords = [
      'active', 'fitness', 'wellness', 'sustainability', 'eco-conscious',
      'minimalist', 'luxury', 'family-oriented', 'career-focused', 'social'
    ];

    for (const clue of lifestyleKeywords) {
      if (text.toLowerCase().includes(clue)) {
        clues.push(clue);
      }
    }

    return clues;
  }

  /**
   * Helper: Extract values
   */
  private extractValues(text: string): Value[] {
    const values: Value[] = [];
    const valuePatterns = [
      { value: 'Sustainability', keywords: ['eco', 'sustainable', 'environment', 'green'] },
      { value: 'Quality', keywords: ['quality', 'premium', 'excellence', 'best'] },
      { value: 'Health & Wellness', keywords: ['health', 'wellness', 'natural', 'organic'] },
      { value: 'Authenticity', keywords: ['authentic', 'genuine', 'real', 'honest'] },
      { value: 'Inclusivity', keywords: ['diverse', 'inclusive', 'all', 'everyone'] }
    ];

    for (const pattern of valuePatterns) {
      const matches = pattern.keywords.filter(kw => text.toLowerCase().includes(kw)).length;
      if (matches > 0) {
        values.push({
          value: pattern.value,
          importance: Math.min(matches * 0.3, 1),
          evidence: pattern.keywords.filter(kw => text.toLowerCase().includes(kw))
        });
      }
    }

    return values.slice(0, 5);
  }

  /**
   * Helper: Extract interests
   */
  private extractInterests(text: string, context: ProductContext): Interest[] {
    const interests: Interest[] = [];
    const interestPatterns = [
      { category: 'Beauty & Personal Care', specificity: 'Hair health and scalp care', relevance: 0.95 },
      { category: 'Wellness', specificity: 'Holistic health approach', relevance: 0.85 },
      { category: 'Sustainability', specificity: 'Eco-friendly products', relevance: 0.8 },
      { category: 'Fashion & Style', specificity: 'Personal grooming', relevance: 0.7 },
      { category: 'Social Causes', specificity: 'Environmental conservation', relevance: 0.65 }
    ];

    return interestPatterns;
  }

  /**
   * Helper: Extract pain points
   */
  private extractPainPoints(text: string, context: ProductContext): PainPoint[] {
    const painPoints: PainPoint[] = [];
    const painPatterns = [
      { problem: 'Damaged or unhealthy hair', severity: 'high' as const, keywords: ['damage', 'brittle', 'break'] },
      { problem: 'Scalp issues', severity: 'medium' as const, keywords: ['scalp', 'dandruff', 'irritation'] },
      { problem: 'Environmental concerns', severity: 'medium' as const, keywords: ['eco', 'sustainable', 'waste'] },
      { problem: 'Ineffective products', severity: 'high' as const, keywords: ['ineffective', 'doesn\'t work', 'disappointing'] },
      { problem: 'Product quality/ingredients', severity: 'medium' as const, keywords: ['ingredient', 'chemical', 'natural'] }
    ];

    for (const pattern of painPatterns) {
      const matches = pattern.keywords.filter(kw => text.toLowerCase().includes(kw)).length;
      if (matches > 0) {
        painPoints.push({
          problem: pattern.problem,
          severity: pattern.severity,
          productRelevance: 0.8,
          affectedSegments: ['primary', 'secondary-1']
        });
      }
    }

    return painPoints.slice(0, 5);
  }

  /**
   * Helper: Extract aspirations
   */
  private extractAspirations(text: string, context: ProductContext): Aspiration[] {
    const aspirations: Aspiration[] = [];

    aspirations.push({
      goal: 'Achieve healthy, vibrant hair',
      timeframe: 'immediate',
      emotionalDrivers: ['confidence', 'attractiveness', 'self-care']
    });

    aspirations.push({
      goal: 'Use sustainable, eco-friendly products',
      timeframe: 'short-term',
      emotionalDrivers: ['responsibility', 'positive impact', 'values alignment']
    });

    aspirations.push({
      goal: 'Develop a personalized hair care routine',
      timeframe: 'short-term',
      emotionalDrivers: ['control', 'mastery', 'belonging']
    });

    return aspirations;
  }

  /**
   * Helper: Extract functional needs
   */
  private extractFunctionalNeeds(text: string, context: ProductContext): FunctionalNeed[] {
    const needs: FunctionalNeed[] = [];

    needs.push({
      need: 'Clean and nourish hair',
      productSolution: 'High-quality shampoo and conditioner',
      criticality: 'must-have'
    });

    needs.push({
      need: 'Repair damaged hair',
      productSolution: 'Treatments and leave-in products',
      criticality: 'must-have'
    });

    needs.push({
      need: 'Reduce environmental impact',
      productSolution: 'Sustainable packaging and clean ingredients',
      criticality: 'should-have'
    });

    needs.push({
      need: 'Achieve desired hair goals',
      productSolution: 'Targeted product recommendations',
      criticality: 'nice-to-have'
    });

    return needs;
  }

  /**
   * Helper: Extract emotional needs
   */
  private extractEmotionalNeeds(text: string): EmotionalNeed[] {
    const needs: EmotionalNeed[] = [];

    needs.push({
      feeling: 'Confidence',
      desiredOutcome: 'Feel beautiful and put-together',
      connectedValues: ['self-worth', 'empowerment', 'attractiveness']
    });

    needs.push({
      feeling: 'Control',
      desiredOutcome: 'Master personal grooming and styling',
      connectedValues: ['mastery', 'agency', 'knowledge']
    });

    needs.push({
      feeling: 'Purpose',
      desiredOutcome: 'Align purchases with environmental values',
      connectedValues: ['responsibility', 'impact', 'values alignment']
    });

    needs.push({
      feeling: 'Belonging',
      desiredOutcome: 'Connect with like-minded community',
      connectedValues: ['community', 'identity', 'acceptance']
    });

    return needs;
  }

  /**
   * Helper: Extract social needs
   */
  private extractSocialNeeds(text: string): SocialNeed[] {
    const needs: SocialNeed[] = [];

    needs.push({
      needType: 'identity',
      description: 'Express personal style and values through product choices',
      influenceOnPurchase: 0.8
    });

    needs.push({
      needType: 'community',
      description: 'Connect with others who share beauty and wellness interests',
      influenceOnPurchase: 0.6
    });

    needs.push({
      needType: 'status',
      description: 'Use premium products as a symbol of self-care commitment',
      influenceOnPurchase: 0.5
    });

    return needs;
  }

  /**
   * Helper: Identify unmet needs
   */
  private identifyUnmetNeeds(text: string, context: ProductContext): UnmetNeed[] {
    const unmet: UnmetNeed[] = [];

    const data = text.toLowerCase();

    if (data.includes('customize') || data.includes('personal')) {
      unmet.push({
        gap: 'Personalized product recommendations at scale',
        affectedSegments: ['primary', 'secondary-1'],
        marketOpportunity: 'Quiz/assessment tools leading to curated routines',
        evidenceSources: ['customer reviews', 'social media', 'sales data']
      });
    }

    if (data.includes('sustainable') || data.includes('eco')) {
      unmet.push({
        gap: 'Transparent sustainability and ingredient sourcing',
        affectedSegments: ['secondary-2'],
        marketOpportunity: 'Sustainability dashboard or blockchain verification',
        evidenceSources: ['environmental reports', 'consumer trends']
      });
    }

    if (data.includes('community') || data.includes('support')) {
      unmet.push({
        gap: 'Community platform for routine sharing and tips',
        affectedSegments: ['all'],
        marketOpportunity: 'User-generated content hub and expert advice',
        evidenceSources: ['social media analysis', 'competitor review']
      });
    }

    return unmet;
  }

  /**
   * Helper: Determine purchase frequency
   */
  private determinePurchaseFrequency(text: string): PurchaseFrequency {
    const data = text.toLowerCase();

    if (data.includes('monthly') || data.includes('subscription')) return 'subscription';
    if (data.includes('frequent') || data.includes('regular')) return 'regular';
    if (data.includes('occasional')) return 'occasional';
    if (data.includes('impulse') || data.includes('spontaneous')) return 'impulse';

    return 'regular';
  }

  /**
   * Helper: Extract loyalty indicators
   */
  private extractLoyaltyIndicators(text: string): LoyaltyIndicator[] {
    const indicators: LoyaltyIndicator[] = [];

    if (text.toLowerCase().includes('repeat purchase') || text.includes('loyal customer')) {
      indicators.push({
        indicator: 'Repeat purchases',
        strength: 0.8,
        evidenceType: 'repeat-purchase'
      });
    }

    if (text.toLowerCase().includes('ambassador') || text.includes('advocate')) {
      indicators.push({
        indicator: 'Brand advocacy',
        strength: 0.9,
        evidenceType: 'referral'
      });
    }

    if (text.toLowerCase().includes('community') || text.includes('engagement')) {
      indicators.push({
        indicator: 'Community participation',
        strength: 0.7,
        evidenceType: 'community'
      });
    }

    if (text.toLowerCase().includes('review') || text.includes('feedback')) {
      indicators.push({
        indicator: 'Active feedback provider',
        strength: 0.6,
        evidenceType: 'reviews'
      });
    }

    return indicators;
  }

  /**
   * Helper: Analyze price sensitivity
   */
  private analyzePriceSensitivity(text: string, context: ProductContext): PriceSensitivity {
    const data = text.toLowerCase();

    let level: 'very-sensitive' | 'moderate' | 'insensitive' | 'mixed' = 'moderate';

    if (data.includes('budget') || data.includes('affordable') || data.includes('cheap')) {
      level = 'very-sensitive';
    } else if (data.includes('premium') || data.includes('luxury') || data.includes('expensive')) {
      level = 'insensitive';
    } else if (data.includes('value') || data.includes('quality for price')) {
      level = 'moderate';
    }

    return {
      level,
      pricePoints: [
        { price: 25, conversionLikelihood: 0.7, segment: 'budget-conscious' },
        { price: 40, conversionLikelihood: 0.85, segment: 'mainstream' },
        { price: 60, conversionLikelihood: 0.6, segment: 'premium' }
      ],
      acceptablePriceRange: {
        min: 20,
        max: 80,
        currency: 'USD'
      }
    };
  }

  /**
   * Helper: Determine channel preferences
   */
  private determineChannelPreferences(text: string): ChannelPreference[] {
    const preferences: ChannelPreference[] = [];
    const data = text.toLowerCase();

    const channels: Channel[] = ['email', 'social-media', 'in-store', 'word-of-mouth', 'influencer', 'paid-ads', 'organic-search', 'subscription'];

    for (const channel of channels) {
      let preference = 0.5;
      let conversionRate = 0.3;

      if (channel === 'social-media' && (data.includes('instagram') || data.includes('tiktok'))) {
        preference = 0.9;
        conversionRate = 0.4;
      } else if (channel === 'email' && data.includes('email')) {
        preference = 0.7;
        conversionRate = 0.35;
      } else if (channel === 'influencer' && data.includes('influencer')) {
        preference = 0.85;
        conversionRate = 0.45;
      } else if (channel === 'word-of-mouth' && (data.includes('friend') || data.includes('recommend'))) {
        preference = 0.8;
        conversionRate = 0.5;
      }

      if (preference > 0.5) {
        preferences.push({
          channel,
          preference,
          conversionRate
        });
      }
    }

    return preferences.sort((a, b) => b.preference - a.preference);
  }

  /**
   * Helper: Extract decision factors
   */
  private extractDecisionFactors(text: string): DecisionFactor[] {
    const factors: DecisionFactor[] = [];

    factors.push({
      factor: 'Product efficacy and ingredient quality',
      importance: 0.95,
      resonatesWithSegments: ['primary', 'secondary-1']
    });

    factors.push({
      factor: 'Sustainability and ethical sourcing',
      importance: 0.75,
      resonatesWithSegments: ['secondary-2']
    });

    factors.push({
      factor: 'Brand reputation and customer reviews',
      importance: 0.85,
      resonatesWithSegments: ['primary', 'secondary-1']
    });

    factors.push({
      factor: 'Price and value for money',
      importance: 0.65,
      resonatesWithSegments: ['all']
    });

    factors.push({
      factor: 'Influencer endorsements and social proof',
      importance: 0.7,
      resonatesWithSegments: ['primary', 'secondary-1']
    });

    return factors;
  }

  /**
   * Helper: Identify brand switch triggers
   */
  private identifyBrandSwitchTriggers(text: string): string[] {
    const triggers: string[] = [];

    if (text.toLowerCase().includes('disappointed') || text.includes('ineffective')) {
      triggers.push('Product not delivering promised results');
    }

    if (text.toLowerCase().includes('price') || text.includes('expensive')) {
      triggers.push('Finding more affordable alternatives');
    }

    if (text.toLowerCase().includes('environment') || text.includes('sustainable')) {
      triggers.push('Discovering more sustainable competitors');
    }

    if (text.toLowerCase().includes('ingredient') || text.includes('chemical')) {
      triggers.push('Learning about concerning ingredients');
    }

    if (text.toLowerCase().includes('review') || text.includes('negative')) {
      triggers.push('Seeing negative reviews or complaints');
    }

    return triggers.slice(0, 3);
  }

  /**
   * Helper: Determine primary driver
   */
  private determinePrimaryDriver(psychographics: Psychographics, needs: NeedsProfile): string {
    if (psychographics.values.length > 0) {
      return psychographics.values[0].value;
    }
    if (needs.emotional.length > 0) {
      return needs.emotional[0].feeling;
    }
    return 'Product efficacy';
  }

  /**
   * Helper: Identify common objections
   */
  private identifyCommonObjections(needs: NeedsProfile, psychographics: Psychographics): string[] {
    const objections: string[] = [];

    objections.push('Does it really work as advertised?');
    objections.push('Is it worth the price point?');

    if (needs.functional.some(n => n.need.includes('environment'))) {
      objections.push('Is it truly sustainable?');
    }

    objections.push('Will it work for my hair type?');
    objections.push('Can I trust the brand?');

    return objections.slice(0, 4);
  }

  /**
   * Helper: Rank channel preferences
   */
  private rankChannelPreferences(preferences: ChannelPreference[]): Channel[] {
    return preferences.sort((a, b) => b.preference - a.preference).map(p => p.channel);
  }

  /**
   * Helper: Determine tone
   */
  private determineTone(psychographics: Psychographics): string {
    if (psychographics.lifestyle === 'wellness-conscious') {
      return 'Authoritative, educational, empowering';
    }
    if (psychographics.lifestyle === 'luxury-oriented') {
      return 'Sophisticated, exclusive, premium';
    }
    if (psychographics.lifestyle === 'sustainability-focused') {
      return 'Transparent, purposeful, authentic';
    }
    return 'Friendly, relatable, trustworthy';
  }

  /**
   * Helper: Classify lifestyle
   */
  private classifyLifestyle(text: string): LifestyleSegment {
    const data = text.toLowerCase();

    if (data.includes('active') || data.includes('fitness')) return 'active-outdoor';
    if (data.includes('family') || data.includes('home')) return 'home-focused';
    if (data.includes('career') || data.includes('professional')) return 'professional';
    if (data.includes('student')) return 'student';
    if (data.includes('wellness') || data.includes('health')) return 'wellness-conscious';
    if (data.includes('eco') || data.includes('sustainable')) return 'sustainability-focused';
    if (data.includes('luxury') || data.includes('premium')) return 'luxury-oriented';
    if (data.includes('budget') || data.includes('affordable')) return 'budget-conscious';
    if (data.includes('social') || data.includes('instagram') || data.includes('tiktok')) return 'social-media-native';

    return 'mixed';
  }

  /**
   * Helper: Add data point
   */
  private addDataPoint(): void {
    this.dataPoints++;
    this.confidence = Math.min(this.dataPoints * 0.15, 0.95);
  }

  /**
   * Helper: Assess data quality
   */
  private assessDataQuality(): 'excellent' | 'good' | 'fair' | 'limited' {
    if (this.dataPoints > 20) return 'excellent';
    if (this.dataPoints > 15) return 'good';
    if (this.dataPoints > 10) return 'fair';
    return 'limited';
  }

  /**
   * Reset state
   */
  private reset(): void {
    this.confidence = 0;
    this.dataPoints = 0;
    this.sources.clear();
  }
}

/**
 * Product context for analysis
 */
export interface ProductContext {
  brandName: string;
  productCategory: string;
  productName?: string;
  targetMarket?: string;
}

/**
 * Analysis error
 */
export class AudienceAnalysisError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'AudienceAnalysisError';
  }
}

/**
 * Singleton export
 */
export const audienceAnalyzer = new AudienceAnalyzer();
