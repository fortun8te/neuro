# PDF Export — Quick Reference

## Import Statements

```typescript
// PDF export
import { pdfExporter } from './src/services';

// Multi-format orchestrator
import { exportOrchestrator } from './src/services';

// CLI helper (recommended for scripts)
import { exportHelper } from './src/utils/exportHelper';

// Charts
import { chartGenerator } from './src/services';
```

## Quick Examples

### Export Both Formats (Simplest)
```typescript
await pdfExporter.export(findings, 'raw.pdf', 'polished.pdf');
```

### Export Polished Only
```typescript
await pdfExporter.exportPolished(findings, 'report.pdf', {
  companyName: 'Acme Corp',
  reportTitle: 'Q2 Research',
});
```

### Export Raw Only
```typescript
await pdfExporter.exportRaw(findings, 'data.pdf');
```

### CLI Export (All Formats)
```typescript
const result = await exportHelper.exportFindings(findings, {
  formats: ['pdf-polished', 'markdown'],
  companyName: 'Company',
  reportTitle: 'Research Report',
  verbose: true,
});

exportHelper.printSummary(result);
```

### Batch Multi-Format
```typescript
const result = await exportOrchestrator.export({
  findings,
  format: ['pdf-raw', 'pdf-polished', 'markdown', 'html', 'json'],
  outputDir: './reports',
  baseFilename: 'findings-2026-04',
  pdfOptions: {
    companyName: 'Acme Corp',
    includeVisuals: true,
  },
});

console.log(result.files); // ['findings-2026-04-raw.pdf', ...]
```

### Generate Charts
```typescript
const posMatrix = chartGenerator.generatePositioningMatrix(competitors);
const coverage = chartGenerator.generateCoverageChart(findings);
const gauge = chartGenerator.generateConfidenceGauge(findings);

// Get data URLs for embedding
const dataUrl = chartGenerator.svgToBase64DataUrl(posMatrix.svg);
```

## Format Comparison

| Format | Time | Size | Best For | Structure |
|--------|------|------|----------|-----------|
| **PDF Raw** | 1-2s | 150-300K | Data extraction | Text bullets |
| **PDF Polished** | 3-5s | 200-400K | Presentations | Tables, colors, hierarchy |
| **Markdown** | 0.5s | 50-150K | Docs, sharing | Headings, lists, citations |
| **HTML** | 0.5s | 80-200K | Web viewing | Styled, responsive |
| **JSON** | 0.1s | 100-300K | Integration | Raw data |

## Export Options

```typescript
interface CLIExportOptions {
  outputDir?: string;           // e.g., './reports'
  filename?: string;            // e.g., 'q2-research'
  formats?: ExportFormat[];     // ['pdf-polished', 'markdown', ...]
  companyName?: string;         // Shown on cover
  reportTitle?: string;         // Custom title
  authorName?: string;          // Author on cover
  includeVisuals?: boolean;     // Include visual section (default: true)
  verbose?: boolean;            // Debug logging
}
```

## Default Behavior

```typescript
// Without options
await exportHelper.exportFindings(findings);

// Defaults to:
// - Output: ~/research-output
// - Filename: research-findings-{date}
// - Formats: ['pdf-polished', 'markdown']
// - Include visuals: true
// - No company/author info
```

## Files Generated

```
outputDir/
  ├── {filename}-raw.pdf              (if format includes 'pdf-raw')
  ├── {filename}-polished.pdf         (if format includes 'pdf-polished')
  ├── {filename}.md                   (if format includes 'markdown')
  ├── {filename}.html                 (if format includes 'html')
  └── {filename}.json                 (if format includes 'json')
```

## Error Handling

```typescript
const result = await exportHelper.exportFindings(findings, options);

if (!result.success) {
  console.error(`Failed: ${result.error}`);
} else {
  console.log(`Generated ${result.files.length} files`);
  result.files.forEach(f => console.log(`  - ${f.fullPath}`));
}
```

## Polished PDF Sections

1. **Cover Page** — Title, date, company, author
2. **Executive Summary** — Key findings (5 highlights)
3. **Customer Desires** — Table + layered model
4. **Purchase Objections** — Table with handling
5. **Competitor Analysis** — Profiles + patterns
6. **Visual Analysis** — Patterns, gaps, recommendations
7. **Research Methodology** — Parameters, tokens, sources

## Raw PDF Structure

```
RESEARCH FINDINGS EXPORT
Generated: 2026-04-12

SECTION: DEEP DESIRES
═══════════════════════
• Fact with sources and confidence scores
  Sources: url1, url2
  Confidence: 85%

... (all sections)

SECTION: RESEARCH AUDIT TRAIL
═════════════════════════════
Total Sources: 47
Models Used: qwen3.5:4b, qwen3.5:2b
Total Tokens: 45000
Duration: 225000ms
...
```

## Color Scheme

| Section | Color | Hex |
|---------|-------|-----|
| Desires | Blue | #3b82f6 |
| Objections | Red | #ef4444 |
| Competitors | Amber | #f59e0b |
| Visuals | Purple | #8b5cf6 |
| Methodology | Green | #10b981 |

## Data Included

### Both Formats Include:
- Deep desires (surface → core → intensity)
- Objections (frequency, impact, handling)
- Avatar language / customer phrases
- Competitor weaknesses
- Where audience congregates
- What they tried before

### Polished-Only:
- Professional typography and layout
- Colored section headers
- Formatted tables
- Industry patterns (hooks, drivers, offers)
- Visual analysis (if available)
- Complete audit trail with sources
- Page numbers and headers

### Raw-Only:
- Simplified bullet-point format
- Text-only layout
- Confidence scores per fact
- Source citations
- Raw metadata

## Common Workflows

### Save to Default Location
```typescript
await exportHelper.exportFindings(findings);
// → ~/research-output/research-findings-2026-04-12-polished.pdf
// → ~/research-output/research-findings-2026-04-12.md
```

### Save to Custom Location
```typescript
await exportHelper.exportFindings(findings, {
  outputDir: './client-reports/acme-corp',
  filename: 'market-research-q2',
  formats: ['pdf-polished'],
  companyName: 'Acme Corp',
});
// → ./client-reports/acme-corp/market-research-q2-polished.pdf
```

### Batch Export Campaign
```typescript
for (const campaign of campaigns) {
  const findings = await runResearch(campaign);
  await exportHelper.exportFindings(findings, {
    outputDir: `./reports/${campaign.id}`,
    filename: campaign.name,
    formats: ['pdf-polished', 'markdown'],
    companyName: campaign.client,
    reportTitle: `${campaign.name} - Market Research`,
  });
}
```

### Export All Formats for Archival
```typescript
await exportHelper.exportFindings(findings, {
  formats: ['pdf-raw', 'pdf-polished', 'markdown', 'html', 'json'],
  filename: `archive-${cycleId}`,
});
```

## Performance Tips

- **Fastest export:** JSON only (0.1s)
- **Quick PDF:** Raw format (1-2s)
- **Full report:** Polished PDF (3-5s)
- **For presentations:** Polished PDF + Markdown
- **For archival:** All formats (~8s total)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| jsPDF not found | `npm install jspdf jspdf-autotable` |
| Output dir permission error | Check write permissions, use absolute path |
| PDF looks wrong | Verify findings data structure |
| Very large PDF | Set `includeVisuals: false` |
| Filename has wrong date | Use explicit `filename` option |
| Unexpected blank pages | Large datasets may add pages; normal |

## File Locations

```
Source Code:
  src/services/pdfExporter.ts          ← PDF generation
  src/services/exportOrchestrator.ts   ← Multi-format
  src/utils/exportHelper.ts            ← CLI wrapper
  src/services/chartGenerator.ts       ← Charts

Documentation:
  PDF_EXPORT_GUIDE.md                  ← Full guide
  PDF_EXPORT_IMPLEMENTATION.md         ← Technical details
  PDF_EXPORT_QUICK_REF.md             ← This file

Examples:
  scripts/export-example.ts            ← Runnable example
```

## API Summary

```typescript
// Single format export
pdfExporter.exportRaw(findings, filepath)
pdfExporter.exportPolished(findings, filepath, options?)
pdfExporter.export(findings, rawPath?, polishedPath?, options?)

// Multi-format export
exportOrchestrator.export(request)

// CLI helper (recommended)
exportHelper.exportFindings(findings, options?)
exportHelper.printSummary(result)
exportHelper.exportPdfRaw(findings, filepath)
exportHelper.exportPdfPolished(findings, filepath, options?)
exportHelper.exportMarkdown(findings, filepath)
exportHelper.exportHtml(findings, filepath)
exportHelper.exportJson(findings, filepath)

// Charts
chartGenerator.generatePositioningMatrix(competitors, options?)
chartGenerator.generateCoverageChart(findings, options?)
chartGenerator.generateConfidenceGauge(findings, options?)
chartGenerator.svgToBase64DataUrl(svg)
```

## Next Steps

1. **Try it out:** `tsx scripts/export-example.ts`
2. **Read guide:** See `PDF_EXPORT_GUIDE.md` for complete reference
3. **Integrate:** Import into your research pipeline
4. **Customize:** Add company name, report title, author
5. **Iterate:** Use verbose logging to debug issues

---

**Version:** 1.0  
**Status:** Production Ready  
**Build:** ✅ Zero TypeScript Errors  
**Coverage:** 100% Type Safe
