/**
 * Product Page Analyzer Unit Tests
 *
 * Tests all core functionality with realistic product data
 */

import { ProductPageAnalyzer, type RawProduct } from '../productPageAnalyzer';

describe('ProductPageAnalyzer', () => {
  let analyzer: ProductPageAnalyzer;

  beforeEach(() => {
    analyzer = new ProductPageAnalyzer();
  });

  // Test data
  const mockProduct: RawProduct = {
    name: 'Premium Volumizing Shampoo',
    price: 24.99,
    originalPrice: 29.99,
    description: 'Sulfate-free volumizing shampoo designed for fine hair',
    longDescription: 'This lightweight, professional-grade shampoo adds volume and bounce without weighing hair down. Formulated with plant extracts and essential oils for natural conditioning.',
    ingredients: [
      'water',
      'sodium lauryl sulfate-free',
      'plant extract',
      'coconut oil',
      'argan oil',
      'essential oil of lavender',
    ],
    benefits: [
      'adds volume',
      'lightweight feel',
      'sulfate-free formula',
      'natural ingredients',
      'color-safe',
    ],
    hairType: ['Fine Hair', 'Oily Hair'],
    targetUseCases: ['Daily wash', 'lightweight care'],
    images: [
      {
        url: 'https://example.com/volumizing-shampoo-main.jpg',
        alt: 'Volumizing Shampoo Main',
        isPrimary: true,
      },
      {
        url: 'https://example.com/volumizing-shampoo-alt.jpg',
        alt: 'Volumizing Shampoo Alternative',
      },
    ],
    variants: [
      { name: 'Standard', size: '250ml', price: 24.99, available: true },
      { name: 'Large', size: '500ml', price: 39.99, available: true },
      { name: 'Travel', size: '50ml', price: 6.99, available: true },
    ],
    reviews: [
      {
        rating: 5,
        text: 'Absolutely love this shampoo! My hair looks amazing with so much volume. Highly recommend to anyone with fine hair!',
        author: 'Sarah M.',
        verified: true,
        helpful: 24,
        sentiment: 'positive',
        mentionedFeatures: ['volume', 'shine', 'lightweight'],
      },
      {
        rating: 4,
        text: 'Works well for my fine hair. Good lather and pleasant smell.',
        author: 'John D.',
        verified: true,
        helpful: 8,
        sentiment: 'positive',
      },
      {
        rating: 4,
        text: 'Great product! My only complaint is it can be a bit pricey.',
        author: 'Emma T.',
        verified: true,
        helpful: 5,
        sentiment: 'positive',
        mentionedFeatures: ['quality', 'price'],
      },
      {
        rating: 3,
        text: 'It is okay. Not life-changing, but does the job.',
        author: 'Michael K.',
        verified: false,
        helpful: 2,
        sentiment: 'neutral',
      },
    ],
    rating: 4.2,
    reviewCount: 156,
    sku: 'RACKS-SHAMPOO-VOL-250',
    availability: 'in-stock',
    category: 'Hair Care - Shampoo',
    tags: ['sulfate-free', 'volumizing', 'color-safe', 'professional'],
    url: 'https://racks.com/products/volumizing-shampoo',
    scrapedAt: new Date().toISOString(),
  };

  const budgetProduct: RawProduct = {
    name: 'Basic Shampoo',
    price: 3.99,
    description: 'Simple, affordable shampoo',
    ingredients: ['water', 'sodium sulfate', 'fragrance'],
    benefits: ['cleans hair'],
    images: [{ url: 'https://example.com/basic.jpg' }],
    variants: [{ name: 'Standard', price: 3.99 }],
    reviews: [
      { rating: 3, text: 'Does what it says', sentiment: 'neutral' },
    ],
    rating: 3.0,
    reviewCount: 20,
  };

  const luxuryProduct: RawProduct = {
    name: 'Luxury Hair Elixir',
    price: 89.99,
    description: 'Premium luxury hair treatment with rare ingredients',
    ingredients: [
      'water',
      'argan oil',
      'silk proteins',
      'gold flakes',
      'rare plant extract',
    ],
    benefits: ['luxury experience', 'extreme shine', 'premium feel'],
    images: [{ url: 'https://example.com/luxury.jpg' }],
    variants: [{ name: 'Premium', size: '100ml', price: 89.99 }],
    reviews: [
      { rating: 5, text: 'Worth every penny! Luxury at its finest.', sentiment: 'positive' },
    ],
    rating: 5.0,
    reviewCount: 47,
  };

  // ========================================================================
  // PRICING ANALYSIS TESTS
  // ========================================================================

  describe('analyzePricing', () => {
    test('should categorize premium products correctly', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.positioning.tier).toBe('premium');
      expect(result.positioning.pricePerOz).toBeGreaterThan(0.25);
    });

    test('should calculate discounts correctly', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.positioning.discount).toBe(5);
      expect(result.positioning.discountPercentage).toBeCloseTo(16.7);
    });

    test('should categorize budget products', () => {
      const result = analyzer.analyzeProduct(budgetProduct);
      expect(result.positioning.tier).toBe('budget');
    });

    test('should categorize luxury products', () => {
      const result = analyzer.analyzeProduct(luxuryProduct);
      expect(result.positioning.tier).toBe('luxury');
    });
  });

  // ========================================================================
  // INGREDIENT ANALYSIS TESTS
  // ========================================================================

  describe('analyzeIngredients', () => {
    test('should identify natural ingredients', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.ingredientProfile.natural).toBeGreaterThan(0);
      expect(result.ingredientProfile.keyIngredients.length).toBeGreaterThan(0);
    });

    test('should sum to 100 percent', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      const sum =
        result.ingredientProfile.natural +
        result.ingredientProfile.chemical +
        result.ingredientProfile.proprietary;
      expect(sum).toBe(100);
    });

    test('should handle missing ingredients gracefully', () => {
      const product = { ...mockProduct, ingredients: undefined };
      const result = analyzer.analyzeProduct(product);
      expect(result.ingredientProfile.proprietary).toBe(100);
      expect(result.ingredientProfile.keyIngredients.length).toBe(0);
    });

    test('should detect allergens', () => {
      const productWithAllergens: RawProduct = {
        ...mockProduct,
        ingredients: ['tree nut oil', 'peanut extract', 'gluten'],
      };
      const result = analyzer.analyzeProduct(productWithAllergens);
      expect(result.ingredientProfile.allergens.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // FEATURE ANALYSIS TESTS
  // ========================================================================

  describe('analyzeFeatures', () => {
    test('should identify features from product text', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.featureAnalysis.commonFeatures.length).toBeGreaterThan(0);
      expect(result.featureAnalysis.uniqueFeatures.length).toBeGreaterThan(0);
    });

    test('should identify target audience', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.featureAnalysis.targetAudience).toContain('Fine Hair');
      expect(result.featureAnalysis.targetAudience).toContain('Oily Hair');
    });

    test('should extract differentiators', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.featureAnalysis.differentiators.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // REVIEW SENTIMENT ANALYSIS TESTS
  // ========================================================================

  describe('analyzeReviews', () => {
    test('should detect positive sentiment', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.reviewAnalysis.positive).toBeGreaterThan(0);
    });

    test('should calculate average rating', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.reviewAnalysis.averageRating).toBe(4.0);
    });

    test('should identify pros and cons', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.reviewAnalysis.topProsCons.pros.length).toBeGreaterThan(0);
    });

    test('should handle empty reviews', () => {
      const product = { ...mockProduct, reviews: [] };
      const result = analyzer.analyzeProduct(product);
      expect(result.reviewAnalysis.averageRating).toBe(0);
      expect(result.reviewAnalysis.positive).toBe(0);
    });

    test('should identify pain points from negative reviews', () => {
      const productWithNegative: RawProduct = {
        ...mockProduct,
        reviews: [
          {
            rating: 1,
            text: 'Way too expensive and it dries my hair out. Terrible product.',
            sentiment: 'negative',
          },
        ],
      };
      const result = analyzer.analyzeProduct(productWithNegative);
      expect(result.reviewAnalysis.negative).toBeGreaterThan(0);
    });

    test('should identify benefits from positive reviews', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.reviewAnalysis.mostMentionedBenefits.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // POPULARITY CALCULATION TESTS
  // ========================================================================

  describe('calculatePopularity', () => {
    test('should give high score to well-rated products', () => {
      const result = analyzer.analyzeProduct(luxuryProduct);
      expect(result.estimatedPopularity).toBeGreaterThan(80);
    });

    test('should give low score to poorly-rated products', () => {
      const poorProduct: RawProduct = {
        ...mockProduct,
        rating: 2.0,
        reviewCount: 5,
      };
      const result = analyzer.analyzeProduct(poorProduct);
      expect(result.estimatedPopularity).toBeLessThan(50);
    });

    test('should max out at 100', () => {
      const result = analyzer.analyzeProduct(luxuryProduct);
      expect(result.estimatedPopularity).toBeLessThanOrEqual(100);
    });
  });

  // ========================================================================
  // PORTFOLIO ANALYSIS TESTS
  // ========================================================================

  describe('analyzePortfolio', () => {
    test('should analyze multiple products', () => {
      const portfolio = analyzer.analyzePortfolio(
        [mockProduct, budgetProduct, luxuryProduct],
        'RACKS'
      );
      expect(portfolio.products.length).toBe(3);
      expect(portfolio.brandName).toBe('RACKS');
    });

    test('should calculate price range', () => {
      const portfolio = analyzer.analyzePortfolio(
        [mockProduct, budgetProduct, luxuryProduct],
        'RACKS'
      );
      expect(portfolio.metrics.priceRange.min).toBe(3.99);
      expect(portfolio.metrics.priceRange.max).toBe(89.99);
    });

    test('should calculate tier distribution', () => {
      const portfolio = analyzer.analyzePortfolio(
        [mockProduct, budgetProduct, luxuryProduct],
        'RACKS'
      );
      expect(portfolio.metrics.priceTierDistribution.budget).toBe(1);
      expect(portfolio.metrics.priceTierDistribution.premium).toBe(1);
      expect(portfolio.metrics.priceTierDistribution.luxury).toBe(1);
    });

    test('should calculate SKU count including variants', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      expect(portfolio.metrics.skuCount).toBe(3); // 3 variants
    });

    test('should identify best sellers', () => {
      const portfolio = analyzer.analyzePortfolio(
        [mockProduct, budgetProduct, luxuryProduct],
        'RACKS'
      );
      expect(portfolio.bestSellers).toBeDefined();
      expect(portfolio.bestSellers!.length).toBeGreaterThan(0);
    });

    test('should generate strategy insights', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      expect(portfolio.strategyInsights.productMixStrategy).toBeDefined();
      expect(portfolio.strategyInsights.pricingStrategy).toBeDefined();
      expect(portfolio.strategyInsights.targetMarketSegmentation).toBeDefined();
      expect(portfolio.strategyInsights.growthOpportunities.length).toBeGreaterThan(0);
      expect(portfolio.strategyInsights.recommendedNewProducts.length).toBeGreaterThan(0);
    });

    test('should throw on empty portfolio', () => {
      expect(() => {
        analyzer.analyzePortfolio([], 'RACKS');
      }).toThrow();
    });
  });

  // ========================================================================
  // COMPETITIVE COMPARISON TESTS
  // ========================================================================

  describe('compareWithCompetitors', () => {
    test('should compare products correctly', () => {
      const prod1 = analyzer.analyzeProduct(mockProduct);
      const prod2 = analyzer.analyzeProduct(budgetProduct);

      const comparisons = analyzer.compareWithCompetitors(prod1, [prod2]);
      expect(comparisons.length).toBe(1);
      expect(comparisons[0].ourPrice).toBe(24.99);
      expect(comparisons[0].competitorPrice).toBe(3.99);
    });

    test('should calculate price percentage difference', () => {
      const prod1 = analyzer.analyzeProduct(mockProduct);
      const prod2 = analyzer.analyzeProduct(budgetProduct);

      const comparisons = analyzer.compareWithCompetitors(prod1, [prod2]);
      expect(comparisons[0].pricePercentageDifference).toBeGreaterThan(500);
    });
  });

  // ========================================================================
  // EXPORT TESTS
  // ========================================================================

  describe('exportAsJSON', () => {
    test('should export valid JSON', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      const json = analyzer.exportAsJSON(portfolio);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('should preserve data in JSON export', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      const json = analyzer.exportAsJSON(portfolio);
      const parsed = JSON.parse(json);

      expect(parsed.brandName).toBe('RACKS');
      expect(parsed.products.length).toBe(1);
      expect(parsed.products[0].name).toBe(mockProduct.name);
    });
  });

  describe('exportAsCSV', () => {
    test('should export valid CSV', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      const csv = analyzer.exportAsCSV(portfolio);

      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1); // Header + data
      expect(lines[0]).toContain('Name');
      expect(lines[0]).toContain('Price');
    });

    test('should escape quotes in CSV', () => {
      const productWithQuotes: RawProduct = {
        ...mockProduct,
        name: 'Product with "Quotes"',
      };
      const portfolio = analyzer.analyzePortfolio([productWithQuotes], 'RACKS');
      const csv = analyzer.exportAsCSV(portfolio);

      expect(csv).toContain('""'); // Escaped quotes
    });
  });

  // ========================================================================
  // ERROR HANDLING TESTS
  // ========================================================================

  describe('error handling', () => {
    test('should handle missing images gracefully', () => {
      const product = { ...mockProduct, images: [] };
      expect(() => analyzer.analyzeProduct(product)).not.toThrow();
    });

    test('should handle missing reviews gracefully', () => {
      const product = { ...mockProduct, reviews: [] };
      const result = analyzer.analyzeProduct(product);
      expect(result.reviewAnalysis.averageRating).toBe(0);
    });

    test('should handle invalid prices gracefully', () => {
      const product = { ...mockProduct, price: -100 };
      const result = analyzer.analyzeProduct(product);
      expect(result.positioning.tier).toBeDefined();
    });

    test('should handle missing optional fields', () => {
      const minimalProduct: RawProduct = {
        name: 'Test',
        price: 10,
        description: 'Test product',
        images: [{ url: 'http://test.jpg' }],
        variants: [],
        reviews: [],
      };
      const result = analyzer.analyzeProduct(minimalProduct);
      expect(result.name).toBe('Test');
      expect(result.positioning).toBeDefined();
    });
  });

  // ========================================================================
  // POSITIONING STATEMENT TESTS
  // ========================================================================

  describe('positioning statements', () => {
    test('should generate meaningful positioning statements', () => {
      const result = analyzer.analyzeProduct(mockProduct);
      expect(result.recommendedPositioning).toBeDefined();
      expect(result.recommendedPositioning).toContain('Premium');
      expect(result.recommendedPositioning).toContain('4.2');
    });

    test('should handle minimal products', () => {
      const minimalProduct: RawProduct = {
        name: 'Basic Product',
        price: 5,
        description: 'A basic product',
        images: [{ url: 'http://test.jpg' }],
        variants: [],
        reviews: [],
      };
      const result = analyzer.analyzeProduct(minimalProduct);
      expect(result.recommendedPositioning).toBeDefined();
    });
  });

  // ========================================================================
  // OPPORTUNITY IDENTIFICATION TESTS
  // ========================================================================

  describe('opportunity identification', () => {
    test('should identify price gaps', () => {
      const portfolio = analyzer.analyzePortfolio(
        [mockProduct, budgetProduct],
        'RACKS'
      );
      expect(portfolio.opportunities).toBeDefined();
      expect(portfolio.opportunities?.priceGaps).toBeDefined();
    });

    test('should identify feature gaps', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      expect(portfolio.opportunities?.featureGaps).toBeDefined();
    });

    test('should identify market segment gaps', () => {
      const portfolio = analyzer.analyzePortfolio([mockProduct], 'RACKS');
      expect(portfolio.opportunities?.marketSegmentGaps).toBeDefined();
    });
  });

  // ========================================================================
  // CANNIBALIZATION DETECTION TESTS
  // ========================================================================

  describe('cannibalization detection', () => {
    test('should detect similar products', () => {
      // Create 3 similar products
      const similar1: RawProduct = {
        ...mockProduct,
        name: 'Premium Volumizing Shampoo - Blue',
      };
      const similar2: RawProduct = {
        ...mockProduct,
        name: 'Premium Volumizing Shampoo - Red',
      };
      const similar3: RawProduct = {
        ...mockProduct,
        name: 'Premium Volumizing Shampoo - Green',
      };

      const portfolio = analyzer.analyzePortfolio(
        [similar1, similar2, similar3],
        'RACKS'
      );
      expect(portfolio.strategyInsights.cannibalitationRisks.length).toBeGreaterThan(0);
    });
  });
});
