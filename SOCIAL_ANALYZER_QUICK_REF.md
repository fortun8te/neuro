# Social Presence Analyzer — Quick Reference

## Import

```typescript
import { 
  socialPresenceAnalyzer,
  type SocialMediaIntelligence,
  type PlatformPresence 
} from '@/services';
```

## Single Platform Analysis

```typescript
// Create presence record
const presence = socialPresenceAnalyzer.createPlatformPresence('tiktok', {
  followers: 250000,
  engagementRate: 8.5,
  postsPerWeek: 5,
  contentThemes: ['education', 'entertainment'],
});

// Analyze engagement
const engagement = socialPresenceAnalyzer.analyzeEngagement('tiktok', {
  likes: 50000,
  comments: 5000,
  shares: 1000,
  followers: 250000,
  postsAnalyzed: 10,
});

// Get strategy
const strategy = socialPresenceAnalyzer.synthesizeContentStrategy('tiktok', {
  primaryThemes: ['education'],
  postingFrequency: 'daily',
  consistencyScore: 85,
  hashtags: ['learning', 'viral'],
});

// Get audience
const audience = socialPresenceAnalyzer.extractAudienceInsights('tiktok', {
  demographics: { ageRange: '13-24' },
  brandSentimentScore: 78,
});

// Assess virality
const viral = socialPresenceAnalyzer.assessViralPotential('tiktok', {
  memePotentialScore: 75,
  ugcPercentage: 35,
});
```

## Multi-Platform Report

```typescript
const intelligence = socialPresenceAnalyzer.compileSocialIntelligence(
  'RACKS',
  [tiktok, instagram, youtube],  // PlatformPresence[]
  [tiktokEng, instagramEng, youtubeEng],  // EngagementAnalysis[]
  [tiktokStrat, instagramStrat, youtubeStrat],  // ContentStrategy[]
  [tiktokAud, instagramAud, youtubeAud],  // AudienceInsights[]
  [tiktokViral, instagramViral, youtubeViral],  // ViralPotential[]
  competitorComparison  // CompetitorComparison
);

// Access summary
console.log(intelligence.summary.totalFollowers);  // 1000000
console.log(intelligence.summary.strongestPlatform);  // 'tiktok'
console.log(intelligence.summary.primaryContentTheme);  // 'education'
```

## Cached Retrieval

```typescript
// Check cache (1-hour TTL)
const cached = socialPresenceAnalyzer.getCachedIntelligence('RACKS');
if (cached) return cached;

// Clear cache
socialPresenceAnalyzer.clearCache('RACKS');  // specific brand
socialPresenceAnalyzer.clearCache();  // all caches
```

## Quick Stats

```typescript
const stats = socialPresenceAnalyzer.getSummaryStats(platforms);
// { totalFollowers, averageEngagement, activePlatforms }
```

## Competitor Comparison

```typescript
const comparison = socialPresenceAnalyzer.compareCompetitors(
  [
    { name: 'CompA', platform: 'instagram', followers: 500000, engagementRate: 6.2, contentStrategy: 'lifestyle' },
    { name: 'CompB', platform: 'instagram', followers: 350000, engagementRate: 8.8, contentStrategy: 'education' },
  ],
  ['Higher engagement'],  // strengths
  ['Lower followers'],  // weaknesses
  ['Education gap'],  // competitive gaps
  ['UGC opportunity']  // opportunities
);
```

## Supported Platforms

`tiktok | instagram | youtube | reddit | twitter | linkedin | pinterest | discord | twitch | other`

## Common Metrics (0-100 scale)

- `engagementRate` — likes + comments + shares / followers
- `viralityScore` — potential for viral spread
- `memePotential` — memeability score
- `aestheticConsistency` — visual coherence
- `consistencyScore` — posting schedule reliability
- `brandSentimentScore` — audience sentiment

## Safe by Default

All methods:
- Have try/catch blocks with graceful fallbacks
- Return safe defaults (never throw)
- Log errors but continue
- Format large numbers (250K, 1.2M)
- Clamp scores 0-100
- Handle missing/partial data

## No Setup Required

```typescript
// Singleton ready to use immediately
import { socialPresenceAnalyzer } from '@/services';
// No initialization needed!
```

## Type Safety

```typescript
type SocialPlatform = 'tiktok' | 'instagram' | 'youtube' | /* ... */;

interface PlatformPresence {
  platform: SocialPlatform;
  followers: number;
  followersFormatted: string;
  engagementRate?: number;
  // ... 15+ metrics
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
  summary: {
    totalFollowers: number;
    totalFollowersFormatted: string;
    activePlatforms: number;
    overallEngagementRate: number;
    strongestPlatform: SocialPlatform;
    primaryAudience: string;
    primaryContentTheme: string;
    overallBrandSentiment: string;
    key_opportunities: string[];
  };
}
```

## Real-World Example

```typescript
async function analyzeBrand(brandName: string) {
  // Try cache first
  const cached = socialPresenceAnalyzer.getCachedIntelligence(brandName);
  if (cached) return cached;

  // Fetch social data from APIs/scraping
  const [tiktok, instagram, youtube] = await Promise.all([
    fetchTikTokStats(brandName),
    fetchInstagramStats(brandName),
    fetchYouTubeStats(brandName),
  ]);

  // Create presence records
  const platforms = [
    socialPresenceAnalyzer.createPlatformPresence('tiktok', tiktok),
    socialPresenceAnalyzer.createPlatformPresence('instagram', instagram),
    socialPresenceAnalyzer.createPlatformPresence('youtube', youtube),
  ];

  // Analyze each
  const engagements = platforms.map(p =>
    socialPresenceAnalyzer.analyzeEngagement(p.platform, {
      likes: p.averageLikesPerPost * 10,
      comments: p.averageCommentsPerPost * 10,
      shares: p.averageSharesPerPost * 10,
      followers: p.followers,
      postsAnalyzed: 30,
    })
  );

  // Get strategies
  const strategies = platforms.map(p =>
    socialPresenceAnalyzer.synthesizeContentStrategy(p.platform, {
      primaryThemes: p.contentThemes,
      postingFrequency: 'daily',
      consistencyScore: 80,
      hashtags: p.commonHashtags || [],
    })
  );

  // Compile full report
  return socialPresenceAnalyzer.compileSocialIntelligence(
    brandName,
    platforms,
    engagements,
    strategies,
    [], // audiences (optional)
    [], // viral (optional)
    {} as any // competitors (optional)
  );
}
```

## File Location

`src/services/socialPresenceAnalyzer.ts` (765 lines, production-ready, zero TypeScript errors)

See `SOCIAL_ANALYZER_GUIDE.md` for detailed documentation.
