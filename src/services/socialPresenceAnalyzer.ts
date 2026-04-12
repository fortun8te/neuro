/**
 * Social Presence Analyzer — Multi-platform social media intelligence
 * Analyzes competitor and market social presence across all major platforms
 *
 * Capabilities:
 * - Platform presence mapping (TikTok, Instagram, YouTube, Reddit, Twitter/X, LinkedIn, Pinterest)
 * - Engagement analysis (rates, sentiment, virality, growth)
 * - Content strategy insights (themes, posting schedule, hashtags, collaborations)
 * - Audience insights from social signals
 * - Viral potential assessment
 * - Competitive social comparison
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('social-presence-analyzer');

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export type SocialPlatform =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'reddit'
  | 'twitter'
  | 'linkedin'
  | 'pinterest'
  | 'discord'
  | 'twitch'
  | 'other';

export interface PlatformPresence {
  platform: SocialPlatform;
  profileUrl?: string;
  followers: number;
  followersFormatted: string;
  verified?: boolean;
  isActive: boolean;
  joinDate?: string;
  lastPostDate?: string;
  bio?: string;
  profileImageUrl?: string;

  // Platform-specific metrics
  engagementRate?: number;
  postsPerWeek?: number;
  averageViewsPerPost?: number;
  averageLikesPerPost?: number;
  averageCommentsPerPost?: number;
  averageSharesPerPost?: number;

  // Content characteristics
  topPostUrl?: string;
  topPostEngagement?: number;
  contentThemes?: string[];
  aestheticConsistency?: number; // 0-100

  // Hashtag strategy
  commonHashtags?: string[];
  hashtagCount?: number;

  // Audience info
  audienceDemographics?: {
    ageRange?: string;
    gender?: string;
    countries?: string[];
    interests?: string[];
  };

  // Growth metrics
  followerGrowthRate?: number; // percentage per month
  trendingStatus?: 'growing' | 'stable' | 'declining';
}

export interface EngagementAnalysis {
  platform: SocialPlatform;
  overallEngagementRate: number;
  engagementBreakdown: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  commentSentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  shareRate: number;
  viralityScore: number; // 0-100
  followerGrowthMomentum: number; // percentage change
  topContentThemes?: string[];
}

export interface ContentStrategy {
  platform: SocialPlatform;
  primaryThemes: string[]; // education, entertainment, community, sales, storytelling
  secondaryThemes?: string[];
  postingSchedule: {
    frequency: 'daily' | 'multiple-per-day' | 'several-per-week' | 'weekly' | 'sporadic';
    consistencyScore: number; // 0-100
    peakPostingTimes?: string[]; // UTC times
  };
  hashtagStrategy: {
    hashtags: string[];
    strategy: 'trending' | 'niche' | 'branded' | 'mixed';
    avgHashtagsPerPost: number;
  };
  collaborations: {
    influencers: string[];
    brands: string[];
    frequency: 'frequent' | 'occasional' | 'rare';
  };
  ugcStrategy: {
    encouragesUgc: boolean;
    ugcExamples?: string[];
    hashtag?: string;
  };
  contentFormats: {
    reels?: number;
    carousels?: number;
    videoClips?: number;
    images?: number;
    textPosts?: number;
    liveStreams?: number;
  };
}

export interface AudienceInsights {
  platform: SocialPlatform;
  estimatedDemographics: {
    ageRange: string;
    genderSplit: { male: number; female: number; other: number };
    topCountries: string[];
    interests: string[];
  };
  communityTone: 'supportive' | 'critical' | 'neutral' | 'mixed';
  communitySize: 'micro' | 'small' | 'medium' | 'large' | 'mega';
  topCommonQuestions?: string[];
  commonConcerns?: string[];
  resonantTopics?: string[];
  brandSentiment: 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative';
}

export interface ViralPotential {
  platform: SocialPlatform;
  viralityScore: number; // 0-100
  contentTypesGonViral: {
    format: string;
    frequency: 'common' | 'occasional' | 'rare';
    avgReach: number;
  }[];
  trendingSounds?: string[];
  trendingFormats?: string[];
  memePotential: number; // 0-100
  communityGeneratedContent: number; // percentage of user-created content
  influencerMentionFrequency: number; // times mentioned by influencers
}

export interface CompetitorComparison {
  competitors: {
    name: string;
    platform: SocialPlatform;
    followers: number;
    engagementRate: number;
    contentStrategy: string;
  }[];
  marketPosition: {
    followerRank: number;
    engagementRank: number;
    contentQualityRank: number;
  };
  strengthsVsCompetitors: string[];
  weaknessesVsCompetitors: string[];
  competitiveGaps: string[];
  opportunityAreas: string[];
}

export interface SocialMediaIntelligence {
  brand: string;
  analyzedAt: string;
  platforms: PlatformPresence[];
  engagement: EngagementAnalysis[];
  contentStrategies: ContentStrategy[];
  audienceInsights: AudienceInsights[];
  viralPotential: ViralPotential[];
  competitorComparison: CompetitorComparison;
  summary: {
    totalFollowers: number;
    totalFollowersFormatted: string;
    activePlatforms: number;
    overallEngagementRate: number;
    strongestPlatform: SocialPlatform;
    weakestPlatform?: SocialPlatform;
    primaryAudience: string;
    primaryContentTheme: string;
    overallBrandSentiment: string;
    key_opportunities: string[];
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  } else if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

function calculateEngagementRate(
  likes: number,
  comments: number,
  shares: number,
  followers: number
): number {
  if (followers === 0) return 0;
  const totalEngagement = likes + comments + shares;
  return Math.min((totalEngagement / followers) * 100, 100);
}

function normalizeScore(value: number, min: number = 0, max: number = 100): number {
  return Math.min(Math.max(value, min), max);
}

function detectTrendingStatus(
  currentFollowers: number,
  previousFollowers: number | undefined
): 'growing' | 'stable' | 'declining' {
  if (!previousFollowers) return 'stable';
  const change = ((currentFollowers - previousFollowers) / previousFollowers) * 100;
  if (change > 5) return 'growing';
  if (change < -5) return 'declining';
  return 'stable';
}

// ─────────────────────────────────────────────────────────────
// Main Service Class
// ─────────────────────────────────────────────────────────────

export class SocialPresenceAnalyzer {
  private cache: Map<string, SocialMediaIntelligence> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * Create or update a platform presence record
   */
  createPlatformPresence(
    platform: SocialPlatform,
    data: Partial<PlatformPresence>
  ): PlatformPresence {
    try {
      const presence: PlatformPresence = {
        platform,
        followers: data.followers || 0,
        followersFormatted: formatFollowerCount(data.followers || 0),
        isActive: data.isActive !== undefined ? data.isActive : true,
        verified: data.verified,
        profileUrl: data.profileUrl,
        joinDate: data.joinDate,
        lastPostDate: data.lastPostDate,
        bio: data.bio?.slice(0, 500),
        profileImageUrl: data.profileImageUrl,
        engagementRate: normalizeScore(data.engagementRate || 0),
        postsPerWeek: data.postsPerWeek || 0,
        averageViewsPerPost: data.averageViewsPerPost || 0,
        averageLikesPerPost: data.averageLikesPerPost || 0,
        averageCommentsPerPost: data.averageCommentsPerPost || 0,
        averageSharesPerPost: data.averageSharesPerPost || 0,
        topPostUrl: data.topPostUrl,
        topPostEngagement: data.topPostEngagement,
        contentThemes: data.contentThemes || [],
        aestheticConsistency: normalizeScore(data.aestheticConsistency || 50),
        commonHashtags: data.commonHashtags || [],
        hashtagCount: data.commonHashtags?.length || 0,
        audienceDemographics: data.audienceDemographics,
        followerGrowthRate: data.followerGrowthRate || 0,
        trendingStatus: data.trendingStatus || 'stable',
      };

      log.debug(`Created presence for ${platform}: ${data.followers} followers`);
      return presence;
    } catch (err) {
      log.error(`createPlatformPresence failed for ${platform}:`, err);
      return {
        platform,
        followers: 0,
        followersFormatted: '0',
        isActive: false,
      };
    }
  }

  /**
   * Analyze engagement metrics across a platform's content
   */
  analyzeEngagement(
    platform: SocialPlatform,
    metrics: {
      likes: number;
      comments: number;
      shares: number;
      saves?: number;
      followers: number;
      postsAnalyzed: number;
      commentSentiment?: { positive: number; neutral: number; negative: number };
    }
  ): EngagementAnalysis {
    try {
      const engagementRate = calculateEngagementRate(
        metrics.likes,
        metrics.comments,
        metrics.shares,
        metrics.followers
      );

      const shareRate = metrics.followers > 0
        ? (metrics.shares / metrics.followers) * 100
        : 0;

      // Viral score based on engagement distribution
      const totalEngagement = metrics.likes + metrics.comments + metrics.shares;
      const avgEngagementPerPost = metrics.postsAnalyzed > 0
        ? totalEngagement / metrics.postsAnalyzed
        : 0;
      const viralityScore = Math.min(avgEngagementPerPost / 10, 100);

      const analysis: EngagementAnalysis = {
        platform,
        overallEngagementRate: normalizeScore(engagementRate),
        engagementBreakdown: {
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          saves: metrics.saves || 0,
        },
        commentSentiment: metrics.commentSentiment || {
          positive: 50,
          neutral: 30,
          negative: 20,
        },
        shareRate: normalizeScore(shareRate),
        viralityScore: normalizeScore(viralityScore),
        followerGrowthMomentum: 0, // Would be calculated with time-series data
      };

      log.debug(`Analyzed engagement for ${platform}: ${engagementRate.toFixed(2)}% rate`);
      return analysis;
    } catch (err) {
      log.error(`analyzeEngagement failed for ${platform}:`, err);
      return {
        platform,
        overallEngagementRate: 0,
        engagementBreakdown: { likes: 0, comments: 0, shares: 0, saves: 0 },
        commentSentiment: { positive: 0, neutral: 0, negative: 0 },
        shareRate: 0,
        viralityScore: 0,
        followerGrowthMomentum: 0,
      };
    }
  }

  /**
   * Synthesize content strategy from social signals
   */
  synthesizeContentStrategy(
    platform: SocialPlatform,
    data: {
      primaryThemes: string[];
      secondaryThemes?: string[];
      postingFrequency: string;
      consistencyScore: number;
      hashtags: string[];
      collaborators?: { influencers: string[]; brands: string[] };
      contentFormats?: Record<string, number>;
    }
  ): ContentStrategy {
    try {
      const frequencyMap: Record<string, 'daily' | 'multiple-per-day' | 'several-per-week' | 'weekly' | 'sporadic'> = {
        'daily': 'daily',
        'multiple-daily': 'multiple-per-day',
        'several-per-week': 'several-per-week',
        'weekly': 'weekly',
        'sporadic': 'sporadic',
      };

      const strategy: ContentStrategy = {
        platform,
        primaryThemes: data.primaryThemes,
        secondaryThemes: data.secondaryThemes || [],
        postingSchedule: {
          frequency: frequencyMap[data.postingFrequency] || 'sporadic',
          consistencyScore: normalizeScore(data.consistencyScore),
          peakPostingTimes: [],
        },
        hashtagStrategy: {
          hashtags: data.hashtags.slice(0, 20),
          strategy: data.hashtags.length > 15 ? 'mixed' : 'niche',
          avgHashtagsPerPost: Math.round(data.hashtags.length / 10) || 5,
        },
        collaborations: {
          influencers: data.collaborators?.influencers || [],
          brands: data.collaborators?.brands || [],
          frequency: (data.collaborators?.influencers?.length || 0) > 3 ? 'frequent' : 'occasional',
        },
        ugcStrategy: {
          encouragesUgc: false,
          ugcExamples: [],
        },
        contentFormats: data.contentFormats || {},
      };

      log.debug(`Synthesized strategy for ${platform}: themes=${data.primaryThemes.join(',')}`);
      return strategy;
    } catch (err) {
      log.error(`synthesizeContentStrategy failed for ${platform}:`, err);
      return {
        platform,
        primaryThemes: [],
        postingSchedule: { frequency: 'sporadic', consistencyScore: 0 },
        hashtagStrategy: { hashtags: [], strategy: 'niche', avgHashtagsPerPost: 0 },
        collaborations: { influencers: [], brands: [], frequency: 'rare' },
        ugcStrategy: { encouragesUgc: false },
        contentFormats: {},
      };
    }
  }

  /**
   * Extract audience insights from social platform data
   */
  extractAudienceInsights(
    platform: SocialPlatform,
    data: {
      demographics?: {
        ageRange?: string;
        genderSplit?: { male: number; female: number; other: number };
        topCountries?: string[];
        interests?: string[];
      };
      communityTone?: string;
      topCommonQuestions?: string[];
      commonConcerns?: string[];
      resonantTopics?: string[];
      brandSentimentScore?: number; // 0-100
    }
  ): AudienceInsights {
    try {
      const sentimentMap: Record<number, 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative'> = {};
      const score = data.brandSentimentScore || 50;

      if (score >= 80) sentimentMap[score] = 'very-positive';
      else if (score >= 60) sentimentMap[score] = 'positive';
      else if (score >= 40) sentimentMap[score] = 'neutral';
      else if (score >= 20) sentimentMap[score] = 'negative';
      else sentimentMap[score] = 'very-negative';

      const insights: AudienceInsights = {
        platform,
        estimatedDemographics: {
          ageRange: data.demographics?.ageRange || 'unknown',
          genderSplit: data.demographics?.genderSplit || { male: 33, female: 33, other: 34 },
          topCountries: data.demographics?.topCountries || [],
          interests: data.demographics?.interests || [],
        },
        communityTone: (data.communityTone as any) || 'neutral',
        communitySize: 'medium',
        topCommonQuestions: data.topCommonQuestions || [],
        commonConcerns: data.commonConcerns || [],
        resonantTopics: data.resonantTopics || [],
        brandSentiment: sentimentMap[score] || 'neutral',
      };

      log.debug(`Extracted audience insights for ${platform}: sentiment=${insights.brandSentiment}`);
      return insights;
    } catch (err) {
      log.error(`extractAudienceInsights failed for ${platform}:`, err);
      return {
        platform,
        estimatedDemographics: {
          ageRange: 'unknown',
          genderSplit: { male: 33, female: 33, other: 34 },
          topCountries: [],
          interests: [],
        },
        communityTone: 'neutral',
        communitySize: 'medium',
      };
    }
  }

  /**
   * Assess viral potential of content
   */
  assessViralPotential(
    platform: SocialPlatform,
    data: {
      contentTypesViralCount?: Record<string, number>;
      trendingSounds?: string[];
      trendingFormats?: string[];
      memePotentialScore?: number;
      ugcPercentage?: number;
      influencerMentionCount?: number;
    }
  ): ViralPotential {
    try {
      const viralityScore = data.memePotentialScore || 40;

      const contentTypesGoViral = Object.entries(data.contentTypesViralCount || {})
        .map(([format, frequency]) => ({
          format,
          frequency: frequency > 5 ? 'common' : frequency > 2 ? 'occasional' : 'rare',
          avgReach: frequency * 1000,
        }));

      const potential: ViralPotential = {
        platform,
        viralityScore: normalizeScore(viralityScore),
        contentTypesGonViral: contentTypesGoViral,
        trendingSounds: data.trendingSounds || [],
        trendingFormats: data.trendingFormats || [],
        memePotential: normalizeScore(data.memePotentialScore || 30),
        communityGeneratedContent: data.ugcPercentage || 0,
        influencerMentionFrequency: data.influencerMentionCount || 0,
      };

      log.debug(`Assessed viral potential for ${platform}: score=${viralityScore}`);
      return potential;
    } catch (err) {
      log.error(`assessViralPotential failed for ${platform}:`, err);
      return {
        platform,
        viralityScore: 0,
        contentTypesGonViral: [],
        memePotential: 0,
        communityGeneratedContent: 0,
        influencerMentionFrequency: 0,
      };
    }
  }

  /**
   * Compare multiple competitors on social metrics
   */
  compareCompetitors(
    competitors: Array<{
      name: string;
      platform: SocialPlatform;
      followers: number;
      engagementRate: number;
      contentStrategy: string;
    }>,
    strengths: string[],
    weaknesses: string[],
    gaps: string[],
    opportunities: string[]
  ): CompetitorComparison {
    try {
      // Sort by follower count
      const sorted = [...competitors].sort((a, b) => b.followers - a.followers);

      const comparison: CompetitorComparison = {
        competitors: sorted,
        marketPosition: {
          followerRank: sorted.findIndex(c => c.followers > 0) + 1,
          engagementRank: sorted.sort((a, b) => b.engagementRate - a.engagementRate).findIndex(c => c.engagementRate > 0) + 1,
          contentQualityRank: 1,
        },
        strengthsVsCompetitors: strengths,
        weaknessesVsCompetitors: weaknesses,
        competitiveGaps: gaps,
        opportunityAreas: opportunities,
      };

      log.debug(`Compared ${competitors.length} competitors`);
      return comparison;
    } catch (err) {
      log.error('compareCompetitors failed:', err);
      return {
        competitors: [],
        marketPosition: { followerRank: 0, engagementRank: 0, contentQualityRank: 0 },
        strengthsVsCompetitors: [],
        weaknessesVsCompetitors: [],
        competitiveGaps: [],
        opportunityAreas: [],
      };
    }
  }

  /**
   * Compile complete social media intelligence report
   */
  compileSocialIntelligence(
    brand: string,
    platforms: PlatformPresence[],
    engagement: EngagementAnalysis[],
    contentStrategies: ContentStrategy[],
    audienceInsights: AudienceInsights[],
    viralPotential: ViralPotential[],
    competitorComparison: CompetitorComparison
  ): SocialMediaIntelligence {
    try {
      const totalFollowers = platforms.reduce((sum, p) => sum + p.followers, 0);
      const activePlatforms = platforms.filter(p => p.isActive).length;

      // Calculate average engagement rate
      const avgEngagementRate = engagement.length > 0
        ? engagement.reduce((sum, e) => sum + e.overallEngagementRate, 0) / engagement.length
        : 0;

      // Find strongest/weakest platform
      const strongestPlatform = platforms.reduce((prev, curr) =>
        curr.followers > prev.followers ? curr : prev
      );

      const weakestActive = platforms
        .filter(p => p.isActive)
        .reduce((prev, curr) =>
          curr.followers < prev.followers ? curr : prev
        );

      // Determine primary audience and content theme
      const allThemes = contentStrategies.flatMap(cs => cs.primaryThemes);
      const primaryTheme = allThemes.length > 0
        ? allThemes.sort((a, b) =>
            allThemes.filter(x => x === b).length - allThemes.filter(x => x === a).length
          )[0]
        : 'mixed';

      const avgSentiment = audienceInsights.length > 0
        ? audienceInsights.map(a =>
            a.brandSentiment === 'very-positive' ? 5 :
            a.brandSentiment === 'positive' ? 4 :
            a.brandSentiment === 'neutral' ? 3 :
            a.brandSentiment === 'negative' ? 2 : 1
          ).reduce((a, b) => a + b, 0) / audienceInsights.length
        : 3;

      const sentimentLabels = [
        'very-negative',
        'negative',
        'neutral',
        'positive',
        'very-positive',
      ];
      const overallSentiment = sentimentLabels[Math.round(avgSentiment) - 1] || 'neutral';

      const intelligence: SocialMediaIntelligence = {
        brand,
        analyzedAt: new Date().toISOString(),
        platforms,
        engagement,
        contentStrategies,
        audienceInsights,
        viralPotential,
        competitorComparison,
        summary: {
          totalFollowers,
          totalFollowersFormatted: formatFollowerCount(totalFollowers),
          activePlatforms,
          overallEngagementRate: normalizeScore(avgEngagementRate),
          strongestPlatform: strongestPlatform.platform,
          weakestPlatform: weakestActive?.platform,
          primaryAudience: audienceInsights[0]?.estimatedDemographics.ageRange || 'general',
          primaryContentTheme: primaryTheme,
          overallBrandSentiment: overallSentiment,
          key_opportunities: competitorComparison.opportunityAreas.slice(0, 5),
        },
      };

      log.debug(`Compiled social intelligence for ${brand}: ${totalFollowers} total followers`);
      this.cache.set(brand, intelligence);
      this.cacheExpiry.set(brand, Date.now() + this.CACHE_DURATION);

      return intelligence;
    } catch (err) {
      log.error('compileSocialIntelligence failed:', err);
      throw new Error('Failed to compile social intelligence');
    }
  }

  /**
   * Get cached intelligence if available
   */
  getCachedIntelligence(brand: string): SocialMediaIntelligence | null {
    try {
      const expiry = this.cacheExpiry.get(brand);
      if (expiry && expiry > Date.now()) {
        const cached = this.cache.get(brand);
        if (cached) {
          log.debug(`Cache hit for ${brand}`);
          return cached;
        }
      } else if (expiry) {
        this.cache.delete(brand);
        this.cacheExpiry.delete(brand);
      }
      return null;
    } catch (err) {
      log.error('getCachedIntelligence failed:', err);
      return null;
    }
  }

  /**
   * Clear cache for a brand or all brands
   */
  clearCache(brand?: string): void {
    try {
      if (brand) {
        this.cache.delete(brand);
        this.cacheExpiry.delete(brand);
        log.debug(`Cleared cache for ${brand}`);
      } else {
        this.cache.clear();
        this.cacheExpiry.clear();
        log.debug('Cleared all caches');
      }
    } catch (err) {
      log.error('clearCache failed:', err);
    }
  }

  /**
   * Get summary statistics across all platforms
   */
  getSummaryStats(platforms: PlatformPresence[]): {
    totalFollowers: number;
    averageEngagement: number;
    activePlatforms: number;
    mostActiveHours?: string[];
    topContentTypes?: string[];
  } {
    try {
      const totalFollowers = platforms.reduce((sum, p) => sum + p.followers, 0);
      const avgEngagement = platforms.length > 0
        ? platforms.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / platforms.length
        : 0;
      const activePlatforms = platforms.filter(p => p.isActive).length;

      return {
        totalFollowers,
        averageEngagement: normalizeScore(avgEngagement),
        activePlatforms,
      };
    } catch (err) {
      log.error('getSummaryStats failed:', err);
      return {
        totalFollowers: 0,
        averageEngagement: 0,
        activePlatforms: 0,
      };
    }
  }
}

export const socialPresenceAnalyzer = new SocialPresenceAnalyzer();
