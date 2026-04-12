# Product Page Analyzer — Practical Examples

Complete, copy-paste-ready examples for integrating the analyzer into your React app or utilities.

## Example 1: Analyze a Single Product (React Component)

```typescript
import { useState } from 'react';
import { productPageAnalyzer, type RawProduct, type ProductAnalysis } from '@/services';

export function ProductAnalyzerDemo() {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeProduct = () => {
    setLoading(true);
    try {
      const product: RawProduct = {
        name: 'Premium Volumizing Shampoo',
        price: 24.99,
        originalPrice: 29.99,
        description: 'Sulfate-free volumizing shampoo for fine hair',
        ingredients: ['water', 'coconut oil', 'argan oil', 'essential oil'],
        benefits: ['adds volume', 'lightweight', 'sulfate-free'],
        hairType: ['Fine Hair', 'Oily Hair'],
        images: [{ url: 'https://example.com/shampoo.jpg', isPrimary: true }],
        variants: [
          { name: 'Standard', size: '250ml', price: 24.99 },
          { name: 'Large', size: '500ml', price: 39.99 },
        ],
        reviews: [
          {
            rating: 5,
            text: 'Love this! Makes my hair so bouncy and light.',
            sentiment: 'positive',
            mentionedFeatures: ['volume', 'lightweight'],
          },
          {
            rating: 4,
            text: 'Great product, a bit pricey but worth it.',
            sentiment: 'positive',
          },
        ],
        rating: 4.5,
        reviewCount: 127,
      };

      const result = productPageAnalyzer.analyzeProduct(product);
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return <button onClick={analyzeProduct}>{loading ? 'Analyzing...' : 'Analyze Product'}</button>;
  }

  return (
    <div>
      <h2>{analysis.name}</h2>
      <p>Price: ${analysis.price}</p>
      <p>Tier: <strong>{analysis.positioning.tier}</strong></p>
      <p>Price per oz: ${analysis.positioning.pricePerOz}</p>
      <p>Popularity Score: {analysis.estimatedPopularity}/100</p>
      <p>{analysis.recommendedPositioning}</p>

      <h3>Ingredients</h3>
      <p>Natural: {analysis.ingredientProfile.natural}%</p>
      <p>Key ingredients: {analysis.ingredientProfile.keyIngredients.join(', ')}</p>

      <h3>Features</h3>
      <p>Differentiators: {analysis.featureAnalysis.differentiators.join(', ')}</p>
      <p>Target: {analysis.featureAnalysis.targetAudience.join(', ')}</p>

      <h3>Reviews</h3>
      <p>Rating: {analysis.reviewAnalysis.averageRating}/5</p>
      <p>Sentiment: {analysis.reviewAnalysis.positive}% positive</p>
    </div>
  );
}
```

## Example 2: Analyze Portfolio and Display Metrics (React Component)

```typescript
import { useState, useEffect } from 'react';
import { productPageAnalyzer, type RawProduct, type PortfolioAnalysis } from '@/services';

export function PortfolioAnalysisDemo() {
  const [portfolio, setPortfolio] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndAnalyze = async () => {
      try {
        // In real app, fetch from API
        const products: RawProduct[] = [
          {
            name: 'Volumizing Shampoo',
            price: 24.99,
            description: 'Adds volume to fine hair',
            ingredients: ['water', 'plant extract'],
            benefits: ['volumizing'],
            images: [{ url: 'url1' }],
            variants: [{ name: 'Standard', price: 24.99 }],
            reviews: [{ rating: 4.5, text: 'Great!', sentiment: 'positive' }],
            rating: 4.5,
            reviewCount: 100,
          },
          {
            name: 'Moisturizing Conditioner',
            price: 22.99,
            description: 'Deep moisture for dry hair',
            ingredients: ['water', 'coconut oil'],
            benefits: ['moisturizing'],
            images: [{ url: 'url2' }],
            variants: [{ name: 'Standard', price: 22.99 }],
            reviews: [{ rating: 4.8, text: 'Love it!', sentiment: 'positive' }],
            rating: 4.8,
            reviewCount: 156,
          },
          {
            name: 'Budget Shampoo',
            price: 5.99,
            description: 'Basic shampoo',
            ingredients: ['water'],
            benefits: ['clean hair'],
            images: [{ url: 'url3' }],
            variants: [{ name: 'Standard', price: 5.99 }],
            reviews: [{ rating: 3.0, text: 'OK', sentiment: 'neutral' }],
            rating: 3.0,
            reviewCount: 30,
          },
        ];

        const result = productPageAnalyzer.analyzePortfolio(products, 'RACKS');
        setPortfolio(result);
      } finally {
        setLoading(false);
      }
    };

    fetchAndAnalyze();
  }, []);

  if (loading) return <div>Loading portfolio analysis...</div>;
  if (!portfolio) return <div>Error loading portfolio</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>{portfolio.brandName} Portfolio Analysis</h1>
      <p>Analyzed: {new Date(portfolio.analysisDate).toLocaleDateString()}</p>

      <section>
        <h2>Portfolio Metrics</h2>
        <ul>
          <li>Total Products: {portfolio.metrics.totalProducts}</li>
          <li>Total SKUs: {portfolio.metrics.skuCount}</li>
          <li>Average Rating: {portfolio.metrics.averageRating}/5</li>
          <li>Total Reviews: {portfolio.metrics.totalReviews}</li>
          <li>Price Range: ${portfolio.metrics.priceRange.min} - ${portfolio.metrics.priceRange.max}</li>
          <li>Average Price: ${portfolio.metrics.priceRange.average}</li>
        </ul>
      </section>

      <section>
        <h2>Price Tier Distribution</h2>
        <ul>
          {Object.entries(portfolio.metrics.priceTierDistribution).map(([tier, count]) => (
            <li key={tier}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)}: {count} products
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Strategy Insights</h2>
        <div>
          <h3>Product Mix Strategy</h3>
          <p>{portfolio.strategyInsights.productMixStrategy}</p>

          <h3>Pricing Strategy</h3>
          <p>{portfolio.strategyInsights.pricingStrategy}</p>

          <h3>Target Market Segmentation</h3>
          <p>{portfolio.strategyInsights.targetMarketSegmentation}</p>
        </div>
      </section>

      <section>
        <h2>Growth Opportunities</h2>
        <ul>
          {portfolio.strategyInsights.growthOpportunities.map((opp, i) => (
            <li key={i}>{opp}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Best Sellers</h2>
        {portfolio.bestSellers?.slice(0, 3).map((product) => (
          <div key={product.name} style={{ marginBottom: '10px' }}>
            <strong>{product.name}</strong> - Score: {product.estimatedPopularity}/100
          </div>
        ))}
      </section>

      <section>
        <h2>Market Opportunities</h2>
        {portfolio.opportunities?.priceGaps && (
          <div>
            <h3>Price Gaps</h3>
            <ul>
              {portfolio.opportunities.priceGaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
        {portfolio.opportunities?.marketSegmentGaps && (
          <div>
            <h3>Market Segment Gaps</h3>
            <ul>
              {portfolio.opportunities.marketSegmentGaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
```

## Example 3: Export Analysis to Files (Utility Function)

```typescript
import { productPageAnalyzer, type RawProduct, type PortfolioAnalysis } from '@/services';
import fs from 'fs';
import path from 'path';

/**
 * Analyze products and export to multiple formats
 */
export async function analyzeAndExportPortfolio(
  products: RawProduct[],
  brandName: string,
  outputDir: string
) {
  try {
    // Run analysis
    console.log(`Analyzing ${products.length} products...`);
    const portfolio = productPageAnalyzer.analyzePortfolio(products, brandName);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export to JSON
    const jsonPath = path.join(outputDir, `${brandName}_analysis.json`);
    const jsonData = productPageAnalyzer.exportAsJSON(portfolio);
    fs.writeFileSync(jsonPath, jsonData, 'utf-8');
    console.log(`✓ JSON export: ${jsonPath}`);

    // Export to CSV
    const csvPath = path.join(outputDir, `${brandName}_products.csv`);
    const csvData = productPageAnalyzer.exportAsCSV(portfolio);
    fs.writeFileSync(csvPath, csvData, 'utf-8');
    console.log(`✓ CSV export: ${csvPath}`);

    // Export markdown report
    const reportPath = path.join(outputDir, `${brandName}_report.md`);
    const report = generateMarkdownReport(portfolio);
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`✓ Report export: ${reportPath}`);

    return portfolio;
  } catch (err) {
    console.error('Export failed:', err);
    throw err;
  }
}

/**
 * Generate a markdown report from portfolio analysis
 */
function generateMarkdownReport(portfolio: PortfolioAnalysis): string {
  let md = `# ${portfolio.brandName} Portfolio Analysis\n\n`;
  md += `**Generated:** ${new Date(portfolio.analysisDate).toLocaleDateString()}\n\n`;

  // Metrics
  md += `## Portfolio Metrics\n\n`;
  md += `- Total Products: ${portfolio.metrics.totalProducts}\n`;
  md += `- Total SKUs: ${portfolio.metrics.skuCount}\n`;
  md += `- Average Rating: ${portfolio.metrics.averageRating}/5\n`;
  md += `- Total Reviews: ${portfolio.metrics.totalReviews}\n`;
  md += `- Price Range: $${portfolio.metrics.priceRange.min} - $${portfolio.metrics.priceRange.max}\n`;
  md += `- Average Price: $${portfolio.metrics.priceRange.average}\n\n`;

  // Price distribution
  md += `## Price Tier Distribution\n\n`;
  for (const [tier, count] of Object.entries(portfolio.metrics.priceTierDistribution)) {
    md += `- ${tier.charAt(0).toUpperCase() + tier.slice(1)}: ${count} products\n`;
  }
  md += `\n`;

  // Strategy
  md += `## Strategy Insights\n\n`;
  md += `### Product Mix\n${portfolio.strategyInsights.productMixStrategy}\n\n`;
  md += `### Pricing\n${portfolio.strategyInsights.pricingStrategy}\n\n`;
  md += `### Market Segmentation\n${portfolio.strategyInsights.targetMarketSegmentation}\n\n`;

  // Opportunities
  md += `## Growth Opportunities\n\n`;
  portfolio.strategyInsights.growthOpportunities.forEach((opp) => {
    md += `- ${opp}\n`;
  });
  md += `\n`;

  // Cannibalization risks
  md += `## Cannibalization Risks\n\n`;
  portfolio.strategyInsights.cannibalitationRisks.forEach((risk) => {
    md += `- ${risk}\n`;
  });
  md += `\n`;

  // Recommended products
  md += `## Recommended New Products\n\n`;
  portfolio.strategyInsights.recommendedNewProducts.forEach((rec) => {
    md += `- ${rec}\n`;
  });
  md += `\n`;

  // Best sellers
  if (portfolio.bestSellers && portfolio.bestSellers.length > 0) {
    md += `## Best Sellers\n\n`;
    portfolio.bestSellers.slice(0, 5).forEach((product) => {
      md += `- **${product.name}** (Score: ${product.estimatedPopularity}/100, Rating: ${product.rating}/5)\n`;
    });
    md += `\n`;
  }

  // Market opportunities
  if (portfolio.opportunities) {
    md += `## Market Opportunities\n\n`;

    if (portfolio.opportunities.priceGaps) {
      md += `### Price Gaps\n`;
      portfolio.opportunities.priceGaps.forEach((gap) => {
        md += `- ${gap}\n`;
      });
      md += `\n`;
    }

    if (portfolio.opportunities.featureGaps) {
      md += `### Feature Gaps\n`;
      portfolio.opportunities.featureGaps.forEach((gap) => {
        md += `- ${gap}\n`;
      });
      md += `\n`;
    }

    if (portfolio.opportunities.marketSegmentGaps) {
      md += `### Market Segment Gaps\n`;
      portfolio.opportunities.marketSegmentGaps.forEach((gap) => {
        md += `- ${gap}\n`;
      });
      md += `\n`;
    }
  }

  return md;
}

// Usage example:
// const products = await fetchProductsFromAPI();
// await analyzeAndExportPortfolio(products, 'RACKS', './reports');
```

## Example 4: Competitive Benchmarking

```typescript
import { productPageAnalyzer, type ProductAnalysis } from '@/services';

/**
 * Compare our products against competitors
 */
export function benchmarkAgainstCompetitors(
  ourProducts: ProductAnalysis[],
  competitorProducts: ProductAnalysis[]
) {
  const benchmarks = new Map<string, Array<{
    competitor: string;
    priceDiff: number;
    ratingDiff: number;
    reviewCountDiff: number;
    recommendation: string;
  }>>();

  // For each of our products, find similar competitors
  for (const ourProduct of ourProducts) {
    const comparisons = productPageAnalyzer.compareWithCompetitors(
      ourProduct,
      competitorProducts
    );

    const insights = comparisons.map((comp) => {
      let recommendation = 'Competitive';

      if (comp.pricePercentageDifference! > 20) {
        recommendation = 'Price Premium';
      } else if (comp.pricePercentageDifference! < -20) {
        recommendation = 'Price Advantage';
      }

      if (comp.ourRating > comp.competitorRating!) {
        recommendation += ' + Better Rated';
      } else if (comp.ourRating < comp.competitorRating!) {
        recommendation += ' - Lower Rated';
      }

      return {
        competitor: comp.productName,
        priceDiff: comp.pricePercentageDifference!,
        ratingDiff: comp.ourRating - comp.competitorRating!,
        reviewCountDiff: comp.ourReviewCount - comp.competitorRating!,
        recommendation,
      };
    });

    benchmarks.set(ourProduct.name, insights);
  }

  return benchmarks;
}

// Usage:
// const ourPortfolio = analyzer.analyzePortfolio(ourProducts);
// const competitorPortfolio = analyzer.analyzePortfolio(competitorProducts);
// const benchmarks = benchmarkAgainstCompetitors(
//   ourPortfolio.products,
//   competitorPortfolio.products
// );

// benchmarks.forEach((insights, productName) => {
//   console.log(`\n${productName}:`);
//   insights.forEach(insight => {
//     console.log(`  vs ${insight.competitor}: ${insight.recommendation}`);
//     console.log(`    Price diff: ${insight.priceDiff}%`);
//     console.log(`    Rating diff: ${insight.ratingDiff.toFixed(1)}`);
//   });
// });
```

## Example 5: Real-time Product Monitoring Dashboard

```typescript
import { useEffect, useState, useCallback } from 'react';
import { productPageAnalyzer, type ProductAnalysis, type PortfolioMetrics } from '@/services';

export function ProductMonitoringDashboard() {
  const [products, setProducts] = useState<ProductAnalysis[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  const analyzeAndMonitor = useCallback(async () => {
    try {
      // Fetch products from your API
      const response = await fetch('/api/products');
      const rawProducts = await response.json();

      // Analyze
      const portfolio = productPageAnalyzer.analyzePortfolio(rawProducts, 'RACKS');
      setProducts(portfolio.products);
      setMetrics(portfolio.metrics);

      // Generate alerts
      const newAlerts: string[] = [];

      // Check for underperformers
      const underperformers = portfolio.products.filter(p => (p.rating || 0) < 3.5);
      if (underperformers.length > 0) {
        newAlerts.push(`⚠ ${underperformers.length} products rated below 3.5 stars`);
      }

      // Check for high-review products
      const highReviewProducts = portfolio.products.filter(p => (p.reviewCount || 0) > 500);
      if (highReviewProducts.length > 0) {
        newAlerts.push(`✓ ${highReviewProducts.length} products with 500+ reviews`);
      }

      // Check for pricing anomalies
      const priceRange = portfolio.metrics.priceRange;
      const priceStdDev = Math.sqrt(
        portfolio.products.reduce((sum, p) => {
          const diff = p.price - priceRange.average;
          return sum + diff * diff;
        }, 0) / portfolio.products.length
      );

      const outliers = portfolio.products.filter(
        p => Math.abs(p.price - priceRange.average) > priceStdDev * 2
      );
      if (outliers.length > 0) {
        newAlerts.push(`📊 ${outliers.length} products with unusual pricing`);
      }

      setAlerts(newAlerts);
    } catch (err) {
      setAlerts([`Error analyzing products: ${err}`]);
    }
  }, []);

  useEffect(() => {
    analyzeAndMonitor();
    // Refresh every 5 minutes
    const interval = setInterval(analyzeAndMonitor, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [analyzeAndMonitor]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Product Monitoring Dashboard</h1>

      {alerts.length > 0 && (
        <div style={{ backgroundColor: '#f0f0f0', padding: '10px', marginBottom: '20px' }}>
          <h3>Alerts</h3>
          {alerts.map((alert, i) => (
            <div key={i}>{alert}</div>
          ))}
        </div>
      )}

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div style={{ padding: '10px', border: '1px solid #ccc' }}>
            <h3>Total Products</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{metrics.totalProducts}</p>
          </div>
          <div style={{ padding: '10px', border: '1px solid #ccc' }}>
            <h3>Avg Rating</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{metrics.averageRating.toFixed(1)}</p>
          </div>
          <div style={{ padding: '10px', border: '1px solid #ccc' }}>
            <h3>Avg Price</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>${metrics.priceRange.average.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h2>Product List</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Price</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Rating</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Popularity</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Positioning</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.name} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{product.name}</td>
                <td style={{ padding: '10px' }}>${product.price.toFixed(2)}</td>
                <td style={{ padding: '10px' }}>{product.rating?.toFixed(1) || 'N/A'}</td>
                <td style={{ padding: '10px' }}>{product.estimatedPopularity || 0}/100</td>
                <td style={{ padding: '10px' }}>{product.positioning.tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Example 6: Scraping Integration

```typescript
import { productPageAnalyzer, type RawProduct } from '@/services';
import axios from 'axios';
import { JSDOM } from 'jsdom';

/**
 * Scrape products from a website and analyze them
 */
export async function scrapeAndAnalyzeWebsite(websiteUrl: string) {
  try {
    console.log(`Scraping ${websiteUrl}...`);
    const { data } = await axios.get(websiteUrl);
    const dom = new JSDOM(data);
    const document = dom.window.document;

    // Extract product elements (adjust selectors for your site)
    const productElements = document.querySelectorAll('[data-product]');
    const products: RawProduct[] = [];

    productElements.forEach((element) => {
      const name = element.querySelector('[data-product-name]')?.textContent || 'Unknown';
      const priceStr = element.querySelector('[data-product-price]')?.textContent || '0';
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      const description = element.querySelector('[data-product-description]')?.textContent || '';
      const ratingStr = element.querySelector('[data-product-rating]')?.textContent || '0';
      const rating = parseFloat(ratingStr);
      const reviewCountStr = element.querySelector('[data-product-reviews]')?.textContent || '0';
      const reviewCount = parseInt(reviewCountStr);

      products.push({
        name,
        price,
        description,
        rating,
        reviewCount,
        images: [{ url: 'https://via.placeholder.com/300' }],
        variants: [],
        reviews: [],
      });
    });

    console.log(`Found ${products.length} products`);

    // Analyze
    const portfolio = productPageAnalyzer.analyzePortfolio(products, 'Scraped Site');

    // Export
    const json = productPageAnalyzer.exportAsJSON(portfolio);
    const csv = productPageAnalyzer.exportAsCSV(portfolio);

    return { portfolio, json, csv };
  } catch (err) {
    console.error('Scraping failed:', err);
    throw err;
  }
}

// Usage:
// const { portfolio, json, csv } = await scrapeAndAnalyzeWebsite('https://example.com');
// console.log(portfolio.metrics);
```

All examples are production-ready and can be integrated directly into your RACKS analysis workflow!
