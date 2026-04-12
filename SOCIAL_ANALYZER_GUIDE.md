# Social Presence Analyzer for RACKS

## Overview

The `SocialPresenceAnalyzer` service provides comprehensive multi-platform social media intelligence. It analyzes competitor and market presence across 9 major platforms with deep engagement analysis, content strategy insights, audience intelligence, and competitive comparison capabilities.

**File:** `src/services/socialPresenceAnalyzer.ts`

## Features

### 1. Platform Presence Mapping

Analyzes presence across:
- **TikTok** — follower count, posting frequency, engagement rate, viral content, hashtags
- **Instagram** — followers, posts/week, aesthetic consistency, engagement, reels performance
- **YouTube** — subscribers, video count, avg views, content themes, audience retention
- **Reddit** — subreddits, community size, sentiment, top discussions
- **Twitter/X** — followers, posting style, engagement, brand voice
- **LinkedIn** — company page, employee signals, hiring, announcements
- **Pinterest** — boards, pins, style palette
- **Discord** — community size, activity level
- **Twitch** — streamers, follower count, stream frequency

### 2. Engagement Analysis

- **Engagement Rate** — likes, comments, shares per follower
- **Comment Sentiment** — positive, neutral, negative breakdown
- **Share Rate** — viral spread metric
- **Virality Score** — 0-100 based on engagement distribution
- **Follower Growth Momentum** — month-over-month growth percentage
- **Content Theme Performance** — which themes resonate most

### 3. Content Strategy Synthesis

- **Primary/Secondary Themes** — education, entertainment, community, sales, storytelling
- **Posting Schedule** — frequency (daily, multiple-per-day, weekly, sporadic) + consistency score
- **Hashtag Strategy** — hashtags, strategy type (trending, niche, branded, mixed)
- **Collaboration Patterns** — influencers, brands, frequency
- **UGC Strategy** — user-generated content encouragement and examples
- **Content Format Mix** — reels, carousels, videos, images, text posts, livestreams

### 4. Audience Insights

- **Demographics** — age range, gender split, top countries, interests
- **Community Tone** — supportive, critical, neutral, mixed
- **Community Size** — micro, small, medium, large, mega
- **Top Questions/Concerns** — what the audience cares about
- **Resonant Topics** — what gets engagement
- **Brand Sentiment** — very-positive to very-negative

### 5. Viral Potential Assessment

- **Virality Score** — 0-100 likelihood of viral content
- **Content Types Gone Viral** — formats with viral history
- **Trending Sounds/Formats** — what's working right now
- **Meme Potential** — 0-100 community creativity factor
- **UGC Percentage** — how much user-created content
- **Influencer Mention Frequency** — brand visibility metric

### 6. Competitor Comparison

- **Follower Ranking** — position vs competitors
- **Engagement Ranking** — engagement rate comparison
- **Content Quality Ranking** — qualitative positioning
- **Strengths vs Competitors** — competitive advantages
- **Weaknesses vs Competitors** — gaps to address
- **Competitive Gaps** — positioning opportunities
- **Opportunity Areas** — untapped market positions

## Usage Examples

### Basic Setup

```typescript
import { socialPresenceAnalyzer } from '@/services/socialPresenceAnalyzer';

// Create analyzer instance
const analyzer = socialPresenceAnalyzer;
```

### Platform Presence Analysis

```typescript
// Create TikTok presence record
const tiktokPresence = analyzer.createPlatformPresence('tiktok', {
  followers: 250000,
  isActive: true,
  engagementRate: 8.5,
  postsPerWeek: 5,
  averageViewsPerPost: 150000,
  averageLikesPerPost: 12500,
  averageCommentsPerPost: 850,
  averageSharesPerPost: 500,
  contentThemes: ['education', 'entertainment'],
  commonHashtags: ['learning', 'viral', 'trending', 'tiktok'],
  aestheticConsistency: 85,
  followerGrowthRate: 12.5, // percent per month
  trendingStatus: 'growing',
  bio: 'Learn something new every day with bite-sized content...',
});

// Result: fully formatted presence with follower count like "250K"
console.log(tiktokPresence.followersFormatted); // "250K"
```

### Engagement Analysis

```typescript
// Analyze engagement across platform content
const engagement = analyzer.analyzeEngagement('instagram', {
  likes: 180000,
  comments: 22500,
  shares: 5000,
  saves: 8000,
  followers: 125000,
  postsAnalyzed: 20,
  commentSentiment: {
    positive: 72,
    neutral: 18,
    negative: 10,
  },
});

// Returns:
// - Overall engagement rate (%)
// - Engagement breakdown by type
// - Share rate and virality score
// - Follower growth momentum
```

### Content Strategy

```typescript
// Synthesize content strategy
const strategy = analyzer.synthesizeContentStrategy('youtube', {
  primaryThemes: ['education', 'how-to'],
  secondaryThemes: ['behind-the-scenes'],
  postingFrequency: 'several-per-week',
  consistencyScore: 92,
  hashtags: ['learning', 'education', 'viral'],
  collaborators: {
    influencers: ['MrBeast', 'Ali Abdaal'],
    brands: ['Skillshare', 'MasterClass'],
  },
  contentFormats: {
    videoClips: 150,
    liveStreams: 24,
    tutorials: 45,
  },
});

// Returns:
// - Themes and posting schedule
// - Hashtag strategy analysis
// - Collaboration patterns
// - Content format breakdown
```

### Audience Insights

```typescript
// Extract audience intelligence
const audience = analyzer.extractAudienceInsights('reddit', {
  demographics: {
    ageRange: '18-34',
    genderSplit: { male: 65, female: 30, other: 5 },
    topCountries: ['USA', 'UK', 'Canada'],
    interests: ['technology', 'startups', 'ai', 'entrepreneurship'],
  },
  communityTone: 'supportive',
  topCommonQuestions: [
    'How to start my business?',
    'What tools do you recommend?',
    'Funding advice?',
  ],
  commonConcerns: ['Funding', 'Market fit', 'Team building'],
  resonantTopics: ['AI trends', 'indie hacking', 'bootstrapping'],
  brandSentimentScore: 78,
});

// Returns:
// - Age, gender, location, interests
// - Community culture and tone
// - FAQ and concern analysis
// - Brand sentiment rating
```

### Viral Potential

```typescript
// Assess viral potential
const viral = analyzer.assessViralPotential('tiktok', {
  contentTypesViralCount: {
    'trending-sound-transition': 45,
    'dance-challenge': 32,
    'educational-series': 18,
    'day-in-life': 8,
  },
  trendingSounds: ['Levitating', 'Oh No', 'Blinding Lights'],
  trendingFormats: ['green-screen', 'transition', 'duet'],
  memePotentialScore: 75,
  ugcPercentage: 35,
  influencerMentionCount: 287,
});

// Returns:
// - Virality score (0-100)
// - Content types with viral history
// - Trending sounds and formats
// - Meme potential rating
// - UGC and influencer metrics
```

### Competitive Comparison

```typescript
// Compare against competitors
const comparison = analyzer.compareCompetitors(
  [
    {
      name: 'Competitor A',
      platform: 'instagram',
      followers: 500000,
      engagementRate: 6.2,
      contentStrategy: 'lifestyle + product',
    },
    {
      name: 'Competitor B',
      platform: 'instagram',
      followers: 350000,
      engagementRate: 8.8,
      contentStrategy: 'education + community',
    },
  ],
  ['Higher posting frequency', 'Stronger community engagement'],
  ['Lower follower count', 'Fewer influencer partnerships'],
  ['Positioning gap in education space', 'Limited UGC strategy'],
  ['Build thought leadership', 'Increase collaborations']
);

// Returns:
// - Competitors sorted by follower count
// - Market position rankings
// - Strengths, weaknesses, gaps, opportunities
```

### Complete Intelligence Report

```typescript
// Compile full social media intelligence
const intelligence = analyzer.compileSocialIntelligence(
  'RACKS',
  [tiktokPresence, instagramPresence, youtubePresence],
  [tiktokEngagement, instagramEngagement, youtubeEngagement],
  [tiktokStrategy, instagramStrategy, youtubeStrategy],
  [tiktokAudience, instagramAudience, youtubeAudience],
  [tiktokViral, instagramViral, youtubeViral],
  comparison
);

// Returns:
// - Total followers across platforms
// - Active platform count
// - Average engagement rate
// - Strongest/weakest platform
// - Primary audience and content theme
// - Overall brand sentiment
// - Top 5 opportunities
```

## Type System

### Core Types

```typescript
type SocialPlatform =
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

interface PlatformPresence {
  platform: SocialPlatform;
  followers: number;
  followersFormatted: string;
  isActive: boolean;
  engagementRate?: number;
  postsPerWeek?: number;
  // ... 20+ metrics
}

interface EngagementAnalysis {
  platform: SocialPlatform;
  overallEngagementRate: number;
  engagementBreakdown: { likes, comments, shares, saves };
  commentSentiment: { positive, neutral, negative };
  viralityScore: number; // 0-100
  // ...
}

interface ContentStrategy {
  primaryThemes: string[];
  postingSchedule: { frequency, consistencyScore };
  hashtagStrategy: { hashtags, strategy, avgHashtagsPerPost };
  collaborations: { influencers, brands, frequency };
  ugcStrategy: { encouragesUgc, examples };
  // ...
}

interface AudienceInsights {
  estimatedDemographics: { ageRange, genderSplit, topCountries, interests };
  communityTone: 'supportive' | 'critical' | 'neutral' | 'mixed';
  communitySize: 'micro' | 'small' | 'medium' | 'large' | 'mega';
  brandSentiment: 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative';
  // ...
}

interface ViralPotential {
  viralityScore: number; // 0-100
  contentTypesGonViral: { format, frequency, avgReach }[];
  memePotential: number; // 0-100
  communityGeneratedContent: number; // percentage
  // ...
}

interface SocialMediaIntelligence {
  brand: string;
  analyzedAt: string;
  platforms: PlatformPresence[];
  engagement: EngagementAnalysis[];
  contentStrategies: ContentStrategy[];
  audienceInsights: AudienceInsights[];
  viralPotential: ViralPotential[];
  competitorComparison: CompetitorComparison;
  summary: { /* key metrics */ };
}
```

## Methods

### Main Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `createPlatformPresence()` | Create platform record | `PlatformPresence` |
| `analyzeEngagement()` | Analyze engagement metrics | `EngagementAnalysis` |
| `synthesizeContentStrategy()` | Extract content strategy | `ContentStrategy` |
| `extractAudienceInsights()` | Get audience intelligence | `AudienceInsights` |
| `assessViralPotential()` | Evaluate viral likelihood | `ViralPotential` |
| `compareCompetitors()` | Compare vs competitors | `CompetitorComparison` |
| `compileSocialIntelligence()` | Compile full report | `SocialMediaIntelligence` |
| `getCachedIntelligence()` | Get 1-hour cached report | `SocialMediaIntelligence \| null` |
| `clearCache()` | Clear cache | `void` |
| `getSummaryStats()` | Get quick overview | Summary stats object |

## Caching

The analyzer includes intelligent 1-hour caching for compiled intelligence reports:

```typescript
// Check cache first
const cached = analyzer.getCachedIntelligence('RACKS');
if (cached) {
  return cached; // Fresh data within 1 hour
}

// Clear cache if needed
analyzer.clearCache('RACKS'); // Clear specific brand
analyzer.clearCache(); // Clear all caches
```

## Error Handling

All methods include comprehensive error handling with graceful fallbacks:

```typescript
try {
  const presence = analyzer.createPlatformPresence('tiktok', data);
  // Method never throws; returns safe default on error
} catch (err) {
  // This won't happen - errors are logged but not thrown
}
```

## Production Readiness

✅ **No Crashes** — All methods include try/catch with safe defaults
✅ **Type Safety** — Full TypeScript types for all data
✅ **Logging** — Integration with RACKS logger (4 debug levels)
✅ **Memory Safe** — Caching with automatic expiry
✅ **Scalable** — Handles unlimited platforms/competitors
✅ **Flexible** — Optional fields for partial data
✅ **Formatted Output** — Human-readable follower counts (250K, 1.2M)

## Integration Example

```typescript
// Import and use in your research/analysis pipeline
import { socialPresenceAnalyzer } from '@/services';

// In your orchestrator or analysis workflow:
async function analyzeSocialPresence(brand: string, competitors: string[]) {
  const cachedIntelligence = analyzer.getCachedIntelligence(brand);
  if (cachedIntelligence) {
    return cachedIntelligence;
  }

  // Fetch real social data (from API, web scraping, etc.)
  const tiktokData = await fetchTikTokData(brand);
  const instagramData = await fetchInstagramData(brand);
  // ... fetch other platforms

  // Create platform records
  const platforms = [
    analyzer.createPlatformPresence('tiktok', tiktokData),
    analyzer.createPlatformPresence('instagram', instagramData),
    // ...
  ];

  // Analyze each
  const engagement = platforms.map(p => 
    analyzer.analyzeEngagement(p.platform, p)
  );

  // Compile report
  const intelligence = analyzer.compileSocialIntelligence(
    brand,
    platforms,
    engagement,
    // ... other analysis
  );

  return intelligence;
}
```

## API Summary

**Location:** `src/services/socialPresenceAnalyzer.ts`
**Export:** `socialPresenceAnalyzer` (singleton instance) and `SocialPresenceAnalyzer` (class)
**Dependencies:** Logger utility only (no external packages)
**Size:** ~24KB, Zero runtime dependencies beyond standard utilities
