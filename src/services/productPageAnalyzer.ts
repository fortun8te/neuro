/**
 * Product Page Analyzer for RACKS
 *
 * Comprehensive product catalog analysis:
 * - Product scraping (name, price, description, ingredients, reviews)
 * - Price positioning & strategy analysis
 * - Feature & ingredient analysis
 * - Review aggregation & sentiment analysis
 * - Product mix intelligence
 * - SKU count & bundling strategy
 *
 * Production-ready with full error handling and validation.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('product-analyzer');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProductImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface ProductVariant {
  name: string;
  size?: string;
  price?: number;
  sku?: string;
  available?: boolean;
}

export interface ProductReview {
  rating: number; // 1-5
  text: string;
  author?: string;
  verified?: boolean;
  helpful?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  mentionedFeatures?: string[];
}

export interface RawProduct {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  longDescription?: string;
  ingredients?: string[];
  benefits?: string[];
  targetUseCases?: string[];
  hairType?: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  reviews: ProductReview[];
  rating?: number;
  reviewCount?: number;
  sku?: string;
  availability?: 'in-stock' | 'low-stock' | 'out-of-stock';
  category?: string;
  tags?: string[];
  url?: string;
  scrapedAt?: string;
}

export interface PricePositioning {
  tier: 'budget' | 'mid-market' | 'premium' | 'luxury';
  pricePerMl?: number;
  pricePerOz?: number;
  discount?: number;
  discountPercentage?: number;
}

export interface IngredientProfile {
  natural: number; // percentage
  chemical: number;
  proprietary: number;
  keyIngredients: string[];
  allergens: string[];
  certifications?: string[];
}

export interface FeatureAnalysis {
  uniqueFeatures: string[];
  commonFeatures: string[];
  differentiators: string[];
  targetAudience: string[];
}

export interface ReviewSentiment {
  positive: number;
  negative: number;
  neutral: number;
  averageRating: number;
  topProsCons: {
    pros: Array<{ feature: string; mentions: number }>;
    cons: Array<{ feature: string; mentions: number }>;
  };
  painPoints: string[];
  mostMentionedBenefits: string[];
}

export interface ProductAnalysis extends RawProduct {
  positioning: PricePositioning;
  ingredientProfile: IngredientProfile;
  featureAnalysis: FeatureAnalysis;
  reviewAnalysis: ReviewSentiment;
  estimatedPopularity?: number; // 0-100 based on reviews + rating
  recommendedPositioning?: string;
}

export interface PortfolioMetrics {
  totalProducts: number;
  priceRange: { min: number; max: number; average: number };
  averageRating: number;
  totalReviews: number;
  skuCount: number;
  categoryBreakdown: Record<string, number>;
  priceTierDistribution: Record<string, number>;
  bundlingStrategy: {
    individualSales: number;
    bundledProducts: number;
    subscriptionOffered: boolean;
    bundleSavings?: number;
  };
}

export interface CompetitorComparison {
  productName: string;
  ourPrice: number;
  competitorPrice?: number;
  pricePercentageDifference?: number;
  ourRating: number;
  competitorRating?: number;
  ourReviewCount: number;
  ourFeatures: string[];
  competitorFeatures?: string[];
  positioning: string;
}

export interface PortfolioAnalysis {
  brandName: string;
  analysisDate: string;
  products: ProductAnalysis[];
  metrics: PortfolioMetrics;
  strategyInsights: {
    productMixStrategy: string;
    pricingStrategy: string;
    targetMarketSegmentation: string;
    growthOpportunities: string[];
    cannibalitationRisks: string[];
    recommendedNewProducts: string[];
  };
  bestSellers?: ProductAnalysis[];
  underperformers?: ProductAnalysis[];
  opportunities?: {
    priceGaps: string[];
    featureGaps: string[];
    marketSegmentGaps: string[];
  };
}

// ============================================================================
// PRODUCT PAGE ANALYZER CLASS
// ============================================================================

export class ProductPageAnalyzer {
  private readonly minPrice = 0.01;
  private readonly maxPrice = 10000;
  private readonly ingredientKeywords = {
    natural: [
      'plant extract', 'essential oil', 'natural', 'organic', 'botanical',
      'herb', 'mineral', 'water', 'aloe', 'coconut', 'argan'
    ],
    chemical: [
      'sulfate', 'paraben', 'silicone', 'synthetic', 'alcohol', 'phthalate',
      'dye', 'fragrance', 'petrolatum', 'mineral oil'
    ],
  };

  private readonly sentimentKeywords = {
    positive: [
      'love', 'amazing', 'excellent', 'perfect', 'great', 'fantastic',
      'best', 'wonderful', 'highly recommend', 'impressed', 'impressive',
      'transformed', 'effective', 'works great', 'satisfied', 'happy'
    ],
    negative: [
      'hate', 'terrible', 'awful', 'waste', 'disappointed', 'poor',
      'bad', 'useless', 'broke out', 'irritating', 'expensive',
      'not worth', 'scam', 'regret', 'waste of money', 'ineffective'
    ],
  };

  private readonly featureKeywords = [
    'lightweight', 'hydrating', 'moisturizing', 'volumizing', 'strengthening',
    'anti-frizz', 'color-safe', 'sulfate-free', 'paraben-free', 'vegan',
    'cruelty-free', 'heat-protectant', 'shine-enhancing', 'repairing',
    'smoothing', 'clarifying', 'conditioning', 'cleansing', 'nourishing',
    'protecting', 'natural', 'organic', 'professional', 'drugstore',
    'long-lasting', 'fast-acting', 'dermatologist-tested', 'hypoallergenic'
  ];

  constructor() {
    log.info('ProductPageAnalyzer initialized');
  }

  /**
   * Analyze a single product's full profile
   */
  analyzeProduct(product: RawProduct): ProductAnalysis {
    try {
      const positioning = this.analyzePricing(product);
      const ingredientProfile = this.analyzeIngredients(product.ingredients || []);
      const featureAnalysis = this.analyzeFeatures(product);
      const reviewAnalysis = this.analyzeReviews(product.reviews);
      const estimatedPopularity = this.calculatePopularity(product, reviewAnalysis);

      return {
        ...product,
        positioning,
        ingredientProfile,
        featureAnalysis,
        reviewAnalysis,
        estimatedPopularity,
        recommendedPositioning: this.generatePositioningStatement(
          product,
          positioning,
          featureAnalysis,
          reviewAnalysis
        ),
      };
    } catch (err) {
      log.error('analyzeProduct failed:', err);
      throw new Error(`Product analysis failed for "${product.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Analyze pricing and positioning
   */
  private analyzePricing(product: RawProduct): PricePositioning {
    try {
      const price = product.price || 0;
      const originalPrice = product.originalPrice;
      let discount = 0;
      let discountPercentage = 0;

      if (originalPrice && originalPrice > price) {
        discount = originalPrice - price;
        discountPercentage = (discount / originalPrice) * 100;
      }

      // Estimate size for per-unit pricing (default 250ml for hair care)
      const estimatedSizeMl = 250;
      const estimatedSizeOz = estimatedSizeMl / 29.5735;

      const pricePerMl = price / estimatedSizeMl;
      const pricePerOz = price / estimatedSizeOz;

      // Tier pricing based on per-oz cost
      let tier: 'budget' | 'mid-market' | 'premium' | 'luxury' = 'mid-market';
      if (pricePerOz < 0.25) tier = 'budget';
      else if (pricePerOz < 0.65) tier = 'mid-market';
      else if (pricePerOz < 1.5) tier = 'premium';
      else tier = 'luxury';

      return {
        tier,
        pricePerMl: Math.round(pricePerMl * 100) / 100,
        pricePerOz: Math.round(pricePerOz * 100) / 100,
        discount: discount > 0 ? Math.round(discount * 100) / 100 : undefined,
        discountPercentage: discountPercentage > 0 ? Math.round(discountPercentage * 10) / 10 : undefined,
      };
    } catch (err) {
      log.warn('analyzePricing error:', err);
      return { tier: 'mid-market' };
    }
  }

  /**
   * Analyze ingredient composition
   */
  private analyzeIngredients(ingredients: string[]): IngredientProfile {
    try {
      if (!ingredients || ingredients.length === 0) {
        return {
          natural: 0,
          chemical: 0,
          proprietary: 100,
          keyIngredients: [],
          allergens: [],
        };
      }

      let naturalCount = 0;
      let chemicalCount = 0;
      const keyIngredients = new Set<string>();
      const allergens = new Set<string>();

      for (const ingredient of ingredients) {
        const lower = ingredient.toLowerCase();

        // Classify ingredient
        if (this.ingredientKeywords.natural.some(kw => lower.includes(kw))) {
          naturalCount++;
          keyIngredients.add(ingredient);
        }
        if (this.ingredientKeywords.chemical.some(kw => lower.includes(kw))) {
          chemicalCount++;
        }

        // Identify allergens
        if (/tree nut|peanut|shellfish|soy|gluten|sesame|milk|egg/i.test(ingredient)) {
          allergens.add(ingredient);
        }
      }

      const total = ingredients.length;
      const unclassified = total - naturalCount - chemicalCount;

      return {
        natural: Math.round((naturalCount / total) * 100),
        chemical: Math.round((chemicalCount / total) * 100),
        proprietary: Math.round((unclassified / total) * 100),
        keyIngredients: Array.from(keyIngredients).slice(0, 5),
        allergens: Array.from(allergens),
      };
    } catch (err) {
      log.warn('analyzeIngredients error:', err);
      return {
        natural: 0,
        chemical: 0,
        proprietary: 100,
        keyIngredients: [],
        allergens: [],
      };
    }
  }

  /**
   * Analyze product features and positioning
   */
  private analyzeFeatures(product: RawProduct): FeatureAnalysis {
    try {
      const text = `${product.name} ${product.description} ${product.longDescription || ''} ${(product.benefits || []).join(' ')} ${(product.tags || []).join(' ')}`.toLowerCase();

      const foundFeatures = new Set<string>();
      for (const feature of this.featureKeywords) {
        if (text.includes(feature)) {
          foundFeatures.add(feature);
        }
      }

      const uniqueFeatures = product.benefits || [];
      const targetAudience = new Set<string>();

      if (product.hairType && product.hairType.length > 0) {
        product.hairType.forEach(ht => targetAudience.add(ht));
      }

      if (text.includes('oily')) targetAudience.add('Oily Hair');
      if (text.includes('dry')) targetAudience.add('Dry Hair');
      if (text.includes('curly')) targetAudience.add('Curly Hair');
      if (text.includes('color-safe')) targetAudience.add('Color-Treated Hair');
      if (text.includes('professional')) targetAudience.add('Professional');
      if (text.includes('damaged')) targetAudience.add('Damaged Hair');

      return {
        uniqueFeatures: Array.from(foundFeatures).slice(0, 5),
        commonFeatures: Array.from(foundFeatures),
        differentiators: uniqueFeatures.slice(0, 3),
        targetAudience: Array.from(targetAudience),
      };
    } catch (err) {
      log.warn('analyzeFeatures error:', err);
      return {
        uniqueFeatures: [],
        commonFeatures: [],
        differentiators: [],
        targetAudience: [],
      };
    }
  }

  /**
   * Analyze reviews and extract sentiment
   */
  private analyzeReviews(reviews: ProductReview[]): ReviewSentiment {
    try {
      if (!reviews || reviews.length === 0) {
        return {
          positive: 0,
          negative: 0,
          neutral: 0,
          averageRating: 0,
          topProsCons: { pros: [], cons: [] },
          painPoints: [],
          mostMentionedBenefits: [],
        };
      }

      let positiveCount = 0;
      let negativeCount = 0;
      let neutralCount = 0;
      let totalRating = 0;
      const featureMentions: Record<string, number> = {};
      const painPoints = new Set<string>();
      const benefits = new Set<string>();

      for (const review of reviews) {
        // Update sentiment
        if (review.sentiment) {
          if (review.sentiment === 'positive') positiveCount++;
          else if (review.sentiment === 'negative') negativeCount++;
          else neutralCount++;
        } else {
          // Auto-detect sentiment
          const text = (review.text || '').toLowerCase();
          const posScore = this.sentimentKeywords.positive.filter(kw => text.includes(kw)).length;
          const negScore = this.sentimentKeywords.negative.filter(kw => text.includes(kw)).length;

          if (posScore > negScore) positiveCount++;
          else if (negScore > posScore) negativeCount++;
          else neutralCount++;
        }

        totalRating += review.rating || 0;

        // Extract feature mentions
        if (review.mentionedFeatures) {
          for (const feature of review.mentionedFeatures) {
            featureMentions[feature] = (featureMentions[feature] || 0) + 1;
          }
        }

        // Extract pain points and benefits from text
        const text = (review.text || '').toLowerCase();
        if (review.rating && review.rating <= 2) {
          if (text.includes('frizz')) painPoints.add('Frizz control');
          if (text.includes('dry')) painPoints.add('Dryness');
          if (text.includes('sticky') || text.includes('heavy')) painPoints.add('Product buildup');
          if (text.includes('price') || text.includes('expensive')) painPoints.add('Price value');
        }
        if (review.rating && review.rating >= 4) {
          if (text.includes('soft')) benefits.add('Soft texture');
          if (text.includes('shine')) benefits.add('Hair shine');
          if (text.includes('smooth')) benefits.add('Smooth finish');
          if (text.includes('volume')) benefits.add('Volume');
        }
      }

      const total = reviews.length;
      const topPros = Object.entries(featureMentions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([feature, mentions]) => ({ feature, mentions }));

      return {
        positive: Math.round((positiveCount / total) * 100),
        negative: Math.round((negativeCount / total) * 100),
        neutral: Math.round((neutralCount / total) * 100),
        averageRating: total > 0 ? Math.round((totalRating / total) * 10) / 10 : 0,
        topProsCons: {
          pros: topPros,
          cons: topPros.slice().reverse().slice(0, 3),
        },
        painPoints: Array.from(painPoints),
        mostMentionedBenefits: Array.from(benefits),
      };
    } catch (err) {
      log.warn('analyzeReviews error:', err);
      return {
        positive: 0,
        negative: 0,
        neutral: 0,
        averageRating: 0,
        topProsCons: { pros: [], cons: [] },
        painPoints: [],
        mostMentionedBenefits: [],
      };
    }
  }

  /**
   * Calculate product popularity score (0-100)
   */
  private calculatePopularity(product: RawProduct, reviewAnalysis: ReviewSentiment): number {
    try {
      let score = 0;

      // Rating contribution (0-40)
      if (product.rating) {
        score += (product.rating / 5) * 40;
      }

      // Review count contribution (0-30)
      if (product.reviewCount) {
        const reviewScore = Math.min(product.reviewCount / 500, 1);
        score += reviewScore * 30;
      }

      // Sentiment contribution (0-30)
      score += (reviewAnalysis.positive / 100) * 30;

      return Math.round(Math.min(score, 100));
    } catch (err) {
      log.warn('calculatePopularity error:', err);
      return 0;
    }
  }

  /**
   * Generate human-readable positioning statement
   */
  private generatePositioningStatement(
    product: RawProduct,
    positioning: PricePositioning,
    features: FeatureAnalysis,
    reviews: ReviewSentiment
  ): string {
    try {
      const tier = positioning.tier.charAt(0).toUpperCase() + positioning.tier.slice(1);
      const mainFeature = features.differentiators[0] || 'General care';
      const audience = features.targetAudience[0] || 'All hair types';
      const sentiment = reviews.positive > reviews.negative ? 'well-received' : 'needs improvement';

      return `${tier} ${mainFeature} for ${audience} (${sentiment}, ${reviews.averageRating}/5 stars)`;
    } catch (err) {
      log.warn('generatePositioningStatement error:', err);
      return 'General positioning';
    }
  }

  /**
   * Analyze complete product portfolio
   */
  analyzePortfolio(products: RawProduct[], brandName: string = 'Unknown Brand'): PortfolioAnalysis {
    try {
      if (!products || products.length === 0) {
        throw new Error('Portfolio must contain at least one product');
      }

      const analyzedProducts = products.map(p => this.analyzeProduct(p));

      // Calculate metrics
      const metrics = this.calculatePortfolioMetrics(analyzedProducts);

      // Identify best sellers and underperformers
      const sortedByPopularity = [...analyzedProducts].sort(
        (a, b) => (b.estimatedPopularity || 0) - (a.estimatedPopularity || 0)
      );
      const bestSellers = sortedByPopularity.slice(0, Math.ceil(products.length * 0.2));
      const underperformers = sortedByPopularity.slice(-Math.ceil(products.length * 0.2));

      // Generate strategy insights
      const strategyInsights = this.generateStrategyInsights(analyzedProducts, metrics);

      // Identify opportunities
      const opportunities = this.identifyOpportunities(analyzedProducts, metrics);

      return {
        brandName,
        analysisDate: new Date().toISOString(),
        products: analyzedProducts,
        metrics,
        strategyInsights,
        bestSellers: bestSellers.length > 0 ? bestSellers : undefined,
        underperformers: underperformers.length > 0 ? underperformers : undefined,
        opportunities,
      };
    } catch (err) {
      log.error('analyzePortfolio failed:', err);
      throw new Error(`Portfolio analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Calculate portfolio-level metrics
   */
  private calculatePortfolioMetrics(products: ProductAnalysis[]): PortfolioMetrics {
    try {
      const prices = products.map(p => p.price).filter(p => p >= this.minPrice && p <= this.maxPrice);
      const ratings = products.map(p => p.rating || 0).filter(r => r > 0);
      const reviews = products.reduce((sum, p) => sum + (p.reviewCount || 0), 0);

      const categoryBreakdown: Record<string, number> = {};
      const priceTierDistribution: Record<string, number> = {};

      for (const product of products) {
        if (product.category) {
          categoryBreakdown[product.category] = (categoryBreakdown[product.category] || 0) + 1;
        }
        const tier = product.positioning.tier;
        priceTierDistribution[tier] = (priceTierDistribution[tier] || 0) + 1;
      }

      // Calculate bundling strategy
      const bundledCount = products.filter(p => p.variants && p.variants.length > 1).length;
      const subscriptionOffered = products.some(p => {
        const descLower = p.description?.toLowerCase() || '';
        const hasSubscription = descLower.includes('subscription');
        const tagsHaveSubscription = p.tags ? p.tags.some(t => t.toLowerCase().includes('subscription')) : false;
        return hasSubscription || tagsHaveSubscription;
      });

      return {
        totalProducts: products.length,
        priceRange: {
          min: prices.length > 0 ? Math.min(...prices) : 0,
          max: prices.length > 0 ? Math.max(...prices) : 0,
          average: prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b) / prices.length) * 100) / 100 : 0,
        },
        averageRating: ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b) / ratings.length) * 10) / 10 : 0,
        totalReviews: reviews,
        skuCount: products.reduce((sum, p) => sum + (p.variants?.length || 1), 0),
        categoryBreakdown,
        priceTierDistribution,
        bundlingStrategy: {
          individualSales: products.length - bundledCount,
          bundledProducts: bundledCount,
          subscriptionOffered,
        },
      };
    } catch (err) {
      log.warn('calculatePortfolioMetrics error:', err);
      return {
        totalProducts: 0,
        priceRange: { min: 0, max: 0, average: 0 },
        averageRating: 0,
        totalReviews: 0,
        skuCount: 0,
        categoryBreakdown: {},
        priceTierDistribution: {},
        bundlingStrategy: {
          individualSales: 0,
          bundledProducts: 0,
          subscriptionOffered: false,
        },
      };
    }
  }

  /**
   * Generate strategic insights from portfolio analysis
   */
  private generateStrategyInsights(
    products: ProductAnalysis[],
    metrics: PortfolioMetrics
  ): PortfolioAnalysis['strategyInsights'] {
    try {
      const budgetProducts = products.filter(p => p.positioning.tier === 'budget');
      const premiumProducts = products.filter(p => p.positioning.tier === 'premium' || p.positioning.tier === 'luxury');

      const categories = Object.entries(metrics.categoryBreakdown).sort((a, b) => b[1] - a[1]);
      const dominantCategory = categories[0]?.[0] || 'General';

      // Identify opportunities
      const highRated = products.filter(p => (p.rating || 0) >= 4.5);
      const lowRated = products.filter(p => (p.rating || 0) < 3.5);

      return {
        productMixStrategy: `Portfolio emphasizes ${dominantCategory} with ${metrics.totalProducts} SKUs across ${Object.keys(metrics.categoryBreakdown).length} categories. Mix includes ${budgetProducts.length} budget-tier and ${premiumProducts.length} premium-tier products.`,

        pricingStrategy: `Price range: $${metrics.priceRange.min}-$${metrics.priceRange.max} (avg: $${metrics.priceRange.average}). Distribution: ${Object.entries(metrics.priceTierDistribution).map(([tier, count]) => `${count} ${tier}`).join(', ')}.`,

        targetMarketSegmentation: `Serving multiple segments: ${products.map(p => p.featureAnalysis.targetAudience[0] || 'General').filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ')}.`,

        growthOpportunities: [
          highRated.length > 0 ? `Scale ${highRated[0]?.name || 'top performers'} with increased marketing focus` : 'Improve product quality to drive ratings',
          metrics.bundlingStrategy.subscriptionOffered ? 'Expand subscription program reach' : 'Launch subscription offering for recurring revenue',
          premiumProducts.length < metrics.totalProducts * 0.2 ? 'Develop premium tier products for margin growth' : 'Maintain premium positioning strength',
        ],

        cannibalitationRisks: this.identifyCannibalitationRisks(products),

        recommendedNewProducts: this.recommendNewProducts(products, metrics),
      };
    } catch (err) {
      log.warn('generateStrategyInsights error:', err);
      return {
        productMixStrategy: 'Analysis unavailable',
        pricingStrategy: 'Analysis unavailable',
        targetMarketSegmentation: 'Analysis unavailable',
        growthOpportunities: [],
        cannibalitationRisks: [],
        recommendedNewProducts: [],
      };
    }
  }

  /**
   * Identify cannibalization risks
   */
  private identifyCannibalitationRisks(products: ProductAnalysis[]): string[] {
    const risks: string[] = [];

    try {
      // Group by similar positioning
      const similar: Record<string, ProductAnalysis[]> = {};

      for (const product of products) {
        const key = `${product.positioning.tier}-${product.featureAnalysis.targetAudience.join('-')}`;
        if (!similar[key]) similar[key] = [];
        similar[key].push(product);
      }

      // Identify groups with >2 similar products
      for (const [key, group] of Object.entries(similar)) {
        if (group.length > 2) {
          const avgRating = group.reduce((sum, p) => sum + (p.rating || 0), 0) / group.length;
          const highestRated = group.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
          risks.push(
            `${group.length} products compete in "${key}" segment. Consider consolidating around ${highestRated?.name || 'top performer'} (${avgRating.toFixed(1)} avg rating).`
          );
        }
      }
    } catch (err) {
      log.warn('identifyCannibalitationRisks error:', err);
    }

    return risks.length > 0 ? risks : ['No significant cannibalization detected'];
  }

  /**
   * Recommend new products based on portfolio analysis
   */
  private recommendNewProducts(products: ProductAnalysis[], metrics: PortfolioMetrics): string[] {
    const recommendations: string[] = [];

    try {
      // Identify underserved price tiers
      const priceTiers = metrics.priceTierDistribution;
      if (!priceTiers['luxury'] || priceTiers['luxury'] < 2) {
        recommendations.push('Launch luxury-tier product for premium market segment');
      }

      // Identify underserved hair types
      const allAudiences = new Set<string>();
      products.forEach(p => p.featureAnalysis.targetAudience.forEach(a => allAudiences.add(a)));

      if (!allAudiences.has('Curly Hair')) {
        recommendations.push('Develop specialized curly hair care line');
      }
      if (!allAudiences.has('Color-Treated Hair') && allAudiences.size > 0) {
        recommendations.push('Add color-safe product line');
      }

      // Identify trending features
      const featureCounts: Record<string, number> = {};
      products.forEach(p =>
        p.featureAnalysis.commonFeatures.forEach(f => {
          featureCounts[f] = (featureCounts[f] || 0) + 1;
        })
      );

      const trendingFeatures = Object.entries(featureCounts)
        .filter(([_, count]) => count >= products.length * 0.5)
        .map(([feature]) => feature);

      if (trendingFeatures.length > 0) {
        recommendations.push(`Develop product combining top features: ${trendingFeatures.slice(0, 2).join(', ')}`);
      }

      // Identify gap segments
      const lowRated = products.filter(p => (p.rating || 0) < 3.5);
      if (lowRated.length > 0 && lowRated.length / products.length < 0.2) {
        recommendations.push('Replace or reformulate lowest-rated products');
      }
    } catch (err) {
      log.warn('recommendNewProducts error:', err);
    }

    return recommendations.length > 0 ? recommendations : ['Portfolio is well-balanced'];
  }

  /**
   * Identify market opportunities
   */
  private identifyOpportunities(
    products: ProductAnalysis[],
    metrics: PortfolioMetrics
  ): PortfolioAnalysis['opportunities'] {
    try {
      const priceGaps: string[] = [];
      const featureGaps: string[] = [];
      const marketSegmentGaps: string[] = [];

      // Price gaps
      const tiers = Object.keys(metrics.priceTierDistribution);
      if (!tiers.includes('budget')) priceGaps.push('No budget-tier offering');
      if (!tiers.includes('luxury')) priceGaps.push('Luxury segment underrepresented');

      // Feature gaps
      const allFeatures = new Set<string>();
      products.forEach(p => p.featureAnalysis.commonFeatures.forEach(f => allFeatures.add(f)));

      const commonFeatures = ['sulfate-free', 'paraben-free', 'vegan', 'cruelty-free'];
      const missingFeatures = commonFeatures.filter(f => !allFeatures.has(f));
      if (missingFeatures.length > 0) {
        featureGaps.push(`Missing certifications: ${missingFeatures.join(', ')}`);
      }

      // Market segments
      const allAudiences = new Set<string>();
      products.forEach(p => p.featureAnalysis.targetAudience.forEach(a => allAudiences.add(a)));

      const commonAudiences = ['Oily Hair', 'Dry Hair', 'Curly Hair', 'Color-Treated Hair', 'Professional'];
      const missingAudiences = commonAudiences.filter(a => !allAudiences.has(a));
      if (missingAudiences.length > 0) {
        marketSegmentGaps.push(`Underserved segments: ${missingAudiences.slice(0, 2).join(', ')}`);
      }

      const result: PortfolioAnalysis['opportunities'] = {
        priceGaps: priceGaps.length > 0 ? priceGaps : undefined,
        featureGaps: featureGaps.length > 0 ? featureGaps : undefined,
        marketSegmentGaps: marketSegmentGaps.length > 0 ? marketSegmentGaps : undefined,
      };

      return result;
    } catch (err) {
      log.warn('identifyOpportunities error:', err);
      return {
        priceGaps: undefined,
        featureGaps: undefined,
        marketSegmentGaps: undefined,
      };
    }
  }

  /**
   * Compare product against competitors
   */
  compareWithCompetitors(
    product: ProductAnalysis,
    competitorProducts: ProductAnalysis[]
  ): CompetitorComparison[] {
    try {
      return competitorProducts.map(comp => {
        const priceDiff = product.price - comp.price;
        const pricePctDiff = comp.price > 0 ? (priceDiff / comp.price) * 100 : 0;

        return {
          productName: comp.name,
          ourPrice: product.price,
          competitorPrice: comp.price,
          pricePercentageDifference: Math.round(pricePctDiff * 10) / 10,
          ourRating: product.rating || 0,
          competitorRating: comp.rating || 0,
          ourReviewCount: product.reviewCount || 0,
          ourFeatures: product.featureAnalysis.uniqueFeatures,
          competitorFeatures: comp.featureAnalysis.uniqueFeatures,
          positioning: `Our product: ${product.positioning.tier} tier at $${product.price}. Competitor: ${comp.positioning.tier} tier at $${comp.price}`,
        };
      });
    } catch (err) {
      log.error('compareWithCompetitors failed:', err);
      return [];
    }
  }

  /**
   * Export analysis as JSON
   */
  exportAsJSON(analysis: PortfolioAnalysis): string {
    try {
      return JSON.stringify(analysis, null, 2);
    } catch (err) {
      log.error('exportAsJSON failed:', err);
      throw new Error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Export analysis as CSV (products only)
   */
  exportAsCSV(analysis: PortfolioAnalysis): string {
    try {
      const headers = [
        'Name',
        'Price',
        'Rating',
        'Review Count',
        'Tier',
        'Category',
        'Popularity Score',
        'Positioning',
      ];

      const rows = analysis.products.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.price,
        p.rating || 'N/A',
        p.reviewCount || 0,
        p.positioning.tier,
        p.category || 'N/A',
        p.estimatedPopularity || 0,
        `"${(p.recommendedPositioning || '').replace(/"/g, '""')}"`,
      ]);

      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } catch (err) {
      log.error('exportAsCSV failed:', err);
      throw new Error(`CSV export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const productPageAnalyzer = new ProductPageAnalyzer();
