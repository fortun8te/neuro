# RACKS Integration Quick Start

**Objective:** Integrate RACKS analyzers into your application  
**Time Required:** 10 minutes  
**Difficulty:** Beginner  

---

## Step 1: Import the Functions

```typescript
import {
  orchestrateFullAnalysis,
  generateComprehensiveReport,
  AnalyzerOrchestrator,
} from './src/core/analyzers';
```

## Step 2: Basic Analysis (Simplest)

```typescript
async function analyzeCompany() {
  try {
    const report = await orchestrateFullAnalysis({
      targetCompany: 'Nike',
      targetProduct: 'Air Max 90',
      targetMarket: 'Athletic Footwear',
    });
    
    console.log('Analysis Complete!');
    console.log(`Confidence: ${(report.confidenceScore * 100).toFixed(0)}%`);
    console.log(report.executiveSummary);
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

analyzeCompany();
```

## Step 3: With Progress Tracking

```typescript
async function analyzeWithProgress() {
  const report = await orchestrateFullAnalysis(
    {
      targetCompany: 'Apple',
      targetProduct: 'iPhone 15',
      targetMarket: 'Smartphones',
    },
    {
      onChunk: (stage, chunk) => {
        const data = JSON.parse(chunk);
        console.log(`[${stage}] ${data.type}: ${JSON.stringify(data).substring(0, 50)}...`);
      },
      onProgress: (stage, index, total) => {
        console.log(`Progress: ${stage} (${index}/${total})`);
      },
    }
  );
  
  return report;
}
```

## Step 4: Generate Structured Report

```typescript
async function generateReport() {
  const report = await generateComprehensiveReport({
    targetCompany: 'Tesla',
    targetProduct: 'Model S',
    targetMarket: 'Electric Vehicles',
  });
  
  // Access report sections
  console.log('=== EXECUTIVE SUMMARY ===');
  console.log(report.executiveSummary.content);
  
  console.log('\n=== BRAND OVERVIEW ===');
  console.log(report.brandOverview.content);
  console.log('Key Takeaways:', report.brandOverview.keyTakeaways);
  
  console.log('\n=== CONFIDENCE ===');
  console.log(`Score: ${report.confidenceMetrics.overallScore}`);
  console.log(`Data Points: ${report.confidenceMetrics.dataPoints}`);
  
  return report;
}
```

## Step 5: Manual Control (Advanced)

```typescript
async function manualAnalysis() {
  const orchestrator = new AnalyzerOrchestrator();
  
  const report = await orchestrator.runAllAnalyzers(
    {
      targetCompany: 'Microsoft',
      targetProduct: 'Windows 11',
      targetMarket: 'Operating Systems',
    },
    {
      timeout: 120000, // 2 minutes
      onProgress: (stage, idx, total) => {
        const pct = ((idx / total) * 100).toFixed(0);
        console.log(`[${pct}%] ${stage}`);
      },
    }
  );
  
  // Check progress details
  const progress = orchestrator.getProgress();
  progress.forEach(p => {
    console.log(`${p.stage}: ${p.status}`);
    if (p.error) console.error(`  Error: ${p.error}`);
  });
  
  return report;
}
```

## Step 6: Integrate Into API

```typescript
import express from 'express';
import { orchestrateFullAnalysis } from './src/core/analyzers';

const app = express();
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  try {
    const { targetCompany, targetProduct, targetMarket } = req.body;
    
    if (!targetCompany) {
      return res.status(400).json({ error: 'targetCompany is required' });
    }
    
    const report = await orchestrateFullAnalysis({
      targetCompany,
      targetProduct,
      targetMarket,
    });
    
    res.json({
      success: true,
      confidence: report.confidenceScore,
      summary: report.executiveSummary,
      report: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(3000, () => {
  console.log('RACKS API running on port 3000');
  console.log('POST /api/analyze');
});
```

## Step 7: Handle Errors Gracefully

```typescript
async function robustAnalysis(company: string) {
  const controller = new AbortController();
  
  // Cancel analysis after 5 minutes
  const timeout = setTimeout(() => controller.abort(), 300000);
  
  try {
    const report = await orchestrateFullAnalysis(
      { targetCompany: company },
      {
        signal: controller.signal,
        timeout: 300000,
      }
    );
    
    clearTimeout(timeout);
    
    if (report.confidenceScore < 0.6) {
      console.warn('Low confidence score - validate with primary research');
    }
    
    return report;
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        console.error('Analysis timed out - try again with longer timeout');
      } else if (error.message.includes('abort')) {
        console.error('Analysis was cancelled');
      } else {
        console.error('Analysis failed:', error.message);
      }
    }
    
    throw error;
  }
}
```

## Step 8: Test Installation

Run the test suite to verify everything works:

```bash
npm test -- src/core/analyzers/__tests__/analyzers.test.ts
```

Expected output:
```
✓ Test Files  1 passed (1)
✓ Tests      33 passed (33)
```

---

## Common Patterns

### Pattern 1: Quick Check
```typescript
const report = await orchestrateFullAnalysis({ targetCompany: 'Competitor Name' });
console.log(report.competitors.analysis.threats);
```

### Pattern 2: Market Research
```typescript
const report = await orchestrateFullAnalysis({
  targetMarket: 'Cloud Services',
  targetCompany: 'AWS',
});
console.log(`Market Size: ${report.market.profile.totalMarketSize}`);
console.log(`CAGR: ${report.market.profile.marketCagr}%`);
```

### Pattern 3: Product Analysis
```typescript
const report = await orchestrateFullAnalysis({
  targetProduct: 'Product Name',
});
console.log(report.product.analysis.marketFit);
console.log(report.product.profile.userReviews);
```

### Pattern 4: Competitive Analysis
```typescript
const report = await orchestrateFullAnalysis({
  targetCompany: 'Our Company',
});
console.log(report.competitors.positioning.competitiveAdvantages);
console.log(report.competitors.analysis.threats);
console.log(report.competitors.analysis.opportunities);
```

### Pattern 5: Audience Insights
```typescript
const report = await orchestrateFullAnalysis({
  targetProduct: 'Product',
});
report.audience.profile.primarySegments.forEach(segment => {
  console.log(`${segment.segment}: ${segment.demographics.ageRange}`);
  console.log(`Motivations: ${segment.psychographics.desires.join(', ')}`);
});
```

---

## Environment Setup

### Option 1: Quick (No External Services)
```typescript
// Works out of the box with mock data
const report = await orchestrateFullAnalysis({
  targetCompany: 'Any Company',
});
```

### Option 2: With Data Services
```bash
# Set environment variables
export VITE_OLLAMA_URL=http://localhost:11440
export VITE_WAYFARER_URL=http://localhost:8889
export VITE_SEARXNG_URL=http://localhost:8888
```

---

## TypeScript Types

Use these types for better development experience:

```typescript
import {
  BrandAnalysisResult,
  ProductAnalysisResult,
  AudienceAnalysisResult,
  SocialMediaAnalysisResult,
  CompetitorAnalysisResult,
  MarketAnalysisResult,
  ComprehensiveResearchReport,
  StructuredResearchReport,
} from './src/core/analyzers';

// Strong typing for your code
const report: ComprehensiveResearchReport = await orchestrateFullAnalysis({...});

const brand: BrandAnalysisResult = report.brand;
const market: MarketAnalysisResult = report.market;
```

---

## Next Steps

1. **Read the full guide:** See `RACKS_GUIDE.md` for detailed documentation
2. **Check examples:** See `RACKS_GUIDE.md` "Examples" section for 4 detailed examples
3. **Run tests:** Verify installation with `npm test -- src/core/analyzers/__tests__`
4. **Explore API:** See API reference in `RACKS_GUIDE.md`
5. **Integrate data sources:** Connect to real data providers for production use

---

## Troubleshooting Integration

### Issue: Module not found
```
Error: Cannot find module 'src/core/analyzers'
```
**Solution:** Run `npm install` and check that TypeScript is configured correctly

### Issue: TypeScript errors
```
error TS2307: Cannot find module
```
**Solution:** Run `npx tsc --noEmit src/core/analyzers/index.ts` to check compilation

### Issue: Low confidence scores
**Solution:** Check that input data is valid and accessible. Use higher timeout for more thorough analysis.

### Issue: API integration errors
**Solution:** Ensure error handling is in place. See "Handle Errors Gracefully" section above.

---

## Example: Complete Application

```typescript
import express from 'express';
import { orchestrateFullAnalysis } from './src/core/analyzers';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ready', version: '1.0' });
});

// Analyze endpoint
app.post('/analyze', async (req, res) => {
  const { company, product, market } = req.body;
  
  try {
    // Validate input
    if (!company) {
      return res.status(400).json({ error: 'company required' });
    }
    
    // Run analysis
    const report = await orchestrateFullAnalysis({
      targetCompany: company,
      targetProduct: product,
      targetMarket: market,
    });
    
    // Return results
    res.json({
      success: true,
      data: {
        confidence: report.confidenceScore,
        summary: report.executiveSummary,
        competitors: report.competitors.positioning,
        market: report.market.profile,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RACKS API listening on port ${PORT}`);
});
```

---

**You're ready to use RACKS!** Start with Step 1 and integrate into your application. See `RACKS_GUIDE.md` for comprehensive documentation.
