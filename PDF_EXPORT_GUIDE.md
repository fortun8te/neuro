# PDF Export System — Complete Guide

## Overview

The PDF export system provides two professional-grade formats for exporting research findings:

1. **RAW Format** — Simple text dump with all data, organized by section
2. **POLISHED Format** — Professional report with tables, colored sections, TOC, visuals

Both formats are fully styled, printable, and ready for distribution.

## Quick Start

### Basic Export

```typescript
import { pdfExporter } from './src/services';
import { myResearchFindings } from './data';

// Export raw format
await pdfExporter.exportRaw(myResearchFindings, 'report-raw.pdf');

// Export polished format
await pdfExporter.exportPolished(myResearchFindings, 'report-polished.pdf');

// Export both
await pdfExporter.export(
  myResearchFindings,
  'report-raw.pdf',
  'report-polished.pdf'
);
```

### CLI Usage

```bash
# Export to default location with defaults
node -e "
  import('./src/utils/exportHelper.js').then(m => {
    m.exportHelper.exportFindings(findings, {
      formats: ['pdf-polished', 'markdown']
    }).then(r => console.log(r));
  });
"

# Or via script
tsx scripts/export-research.ts findings.json --format pdf-polished --output ./reports
```

## Format Details

### RAW Format (`pdf-raw`)

**Purpose:** Data extraction, parsing, integration

**Structure:**
```
RESEARCH FINDINGS EXPORT
Raw Data Dump Format
Generated: 2026-04-12

SECTION: DEEP DESIRES
═══════════════════════════════════
• Fact 1: [text]
  Sources: [url1], [url2]
  Confidence: 85%

• Fact 2: [text]
  Sources: [url3]
  Confidence: 75%

... (all sections: objections, language, competitors, audit)
```

**Characteristics:**
- Simple text-based layout
- One fact per bullet point
- Source citations and confidence scores
- No styling or colors
- Easy to parse and extract
- Small file size
- Fast generation

**Best For:**
- Data analysis and processing
- Machine parsing
- Archival and backup
- Legal/compliance records

### POLISHED Format (`pdf-polished`)

**Purpose:** Professional distribution, client presentations

**Structure:**
```
Page 1: Cover Page
  - Title
  - Date, company, author
  - Source count, coverage %

Page 2: Executive Summary
  - Brief overview
  - Key highlights (5 points)

Pages 3+: Detailed Sections
  - Customer Desires (table + layered model)
  - Purchase Objections (table)
  - Competitor Analysis (profiles + patterns)
  - Visual Analysis (patterns + gaps + recommendations)
  - Research Methodology (parameters, tokens, sources)
```

**Characteristics:**
- Professional typography (Helvetica)
- Color-coded sections (blue, red, orange, purple)
- Formatted tables with borders and alternating rows
- Colored headers and visual hierarchy
- Page numbers and running headers
- Cover page with metadata
- Executive summary
- Complete audit trail
- Print-ready formatting

**Best For:**
- Client presentations
- Marketing teams
- Executive briefs
- Distribution to stakeholders
- Formal documentation

## API Reference

### PDFExporter Class

```typescript
import { pdfExporter } from './src/services';

// Export raw format
await pdfExporter.exportRaw(findings, 'output.pdf');

// Export polished format with options
await pdfExporter.exportPolished(findings, 'output.pdf', {
  format: 'polished',
  includeVisuals: true,
  includeMetrics: true,
  companyName: 'Acme Corp',
  reportTitle: 'Q2 Market Research Report',
  authorName: 'Jane Smith',
  theme: 'default',
});

// Export both formats at once
await pdfExporter.export(
  findings,
  'raw.pdf',      // Pass undefined to skip
  'polished.pdf',
  { companyName: 'Acme Corp' }
);
```

### PDFExportOptions

```typescript
interface PDFExportOptions {
  format: 'raw' | 'polished';
  includeVisuals?: boolean;        // Show visual analysis section
  includeMetrics?: boolean;        // Show token/performance metrics
  companyLogo?: string;            // Logo image path (not yet implemented)
  companyName?: string;            // Shown on cover page
  reportTitle?: string;            // Custom report title
  authorName?: string;             // Author name on cover
  theme?: 'default' | 'dark';      // Color scheme
}
```

### ExportOrchestrator Class

```typescript
import { exportOrchestrator } from './src/services';

const result = await exportOrchestrator.export({
  findings,
  format: ['pdf-raw', 'pdf-polished', 'markdown'],
  outputDir: './reports',
  baseFilename: 'findings-2026-04',
  pdfOptions: {
    companyName: 'Acme Corp',
    reportTitle: 'Market Research Report',
    includeVisuals: true,
  },
});

console.log(result.files);     // ['findings-2026-04-raw.pdf', ...]
console.log(result.success);   // true
console.log(result.duration);  // 2500 (ms)
```

### ExportHelper Class (CLI-Friendly)

```typescript
import { exportHelper } from './src/utils/exportHelper';

const result = await exportHelper.exportFindings(findings, {
  outputDir: './reports',
  filename: 'Q2-research',
  formats: ['pdf-polished', 'markdown'],
  companyName: 'Acme Corp',
  reportTitle: 'Q2 Market Research',
  authorName: 'Jane Smith',
  includeVisuals: true,
  verbose: true,
});

// Print summary
exportHelper.printSummary(result);
// Output:
// ✓ Export successful!
// 
// Generated files (2):
//   • PDF (Polished)
//     Location: /Users/mk/reports/Q2-research-polished.pdf
//   • Markdown
//     Location: /Users/mk/reports/Q2-research.md
//
// Duration: 2.34s
// Output directory: /Users/mk/reports
```

## Data Included in Exports

### All Findings Sections
- Deep customer desires (surface → core, layered)
- Purchase objections (with handling strategies)
- Avatar language and voice patterns
- Where audience congregates
- What they tried before
- Competitor weaknesses

### Polished-Only Sections
- Executive summary
- Customer desires with layered model
- Objections table
- Competitor profiles and industry patterns
- Visual analysis (patterns, gaps, recommendations)
- Research methodology and audit trail

### Raw-Only Sections
- All of above in text format
- Research audit trail (sources, models, tokens)
- Metadata and timestamps

## Charts & Visualizations

Charts are generated as SVG and embedded in polished PDFs:

```typescript
import { chartGenerator } from './src/services';

// Positioning matrix (competitor placement)
const posMatrix = chartGenerator.generatePositioningMatrix(competitors);
// Returns { svg, width, height, mimeType }

// Coverage chart (research dimensions)
const coverage = chartGenerator.generateCoverageChart(findings);

// Confidence gauge
const gauge = chartGenerator.generateConfidenceGauge(findings);

// Convert to data URL for embedding
const dataUrl = chartGenerator.svgToBase64DataUrl(posMatrix.svg);
```

## Color Schemes

### Default Theme
- Primary: #1f2937 (dark gray)
- Secondary: #3b82f6 (blue)
- Accent: #10b981 (green)
- Text: #1f2937
- Light BG: #f3f4f6
- Borders: #e5e7eb

### Dark Theme (Future)
- Primary: #f3f4f6 (light gray)
- Secondary: #60a5fa (light blue)
- Accent: #34d399 (light green)
- Text: #f3f4f6
- Light BG: #1f2937
- Borders: #374151

### Section Colors
- Desires: #3b82f6 (blue)
- Objections: #ef4444 (red)
- Competitors: #f59e0b (amber)
- Visuals: #8b5cf6 (purple)
- Methodology: #10b981 (green)

## Integration Examples

### With Research Orchestrator

```typescript
import { orchestrateResearchCycle } from './src/core/orchestrator';
import { exportHelper } from './src/utils/exportHelper';

// ... run research ...
const findings = await orchestrateResearchCycle(context, subagentPool);

// Export after research completes
const result = await exportHelper.exportFindings(findings, {
  formats: ['pdf-polished', 'markdown'],
  companyName: 'Research Labs',
  verbose: true,
});

console.log(`Reports ready at: ${result.outputDir}`);
```

### With CLI Deep Research

```typescript
// After deep research completes:
if (findings) {
  const exportResult = await exportHelper.exportFindings(findings, {
    formats: ['pdf-polished', 'markdown', 'json'],
    filename: `${campaign}-research-${cycleNumber}`,
    companyName: 'Nomads AI',
    reportTitle: `Research Report: ${campaign}`,
    authorName: 'Deep Research Harness',
    includeVisuals: true,
    verbose: true,
  });

  if (exportResult.success) {
    console.log(`✓ Reports generated:`);
    exportResult.files.forEach(f => {
      console.log(`  • ${f.fullPath}`);
    });
  }
}
```

### Batch Export

```typescript
import { exportOrchestrator } from './src/services';
import * as fs from 'fs/promises';

const campaigns = ['campaign-a', 'campaign-b', 'campaign-c'];

for (const campaign of campaigns) {
  const findingsPath = `./findings/${campaign}.json`;
  const findings = JSON.parse(await fs.readFile(findingsPath, 'utf-8'));

  await exportOrchestrator.export({
    findings,
    format: ['pdf-polished', 'markdown'],
    outputDir: './reports',
    baseFilename: campaign,
  });
}
```

## File Generation Timeline

For a typical research findings export:

- **RAW PDF:** 1-2 seconds (simple text generation)
- **POLISHED PDF:** 3-5 seconds (tables, formatting, styling)
- **MARKDOWN:** 0.5-1 second (text conversion)
- **HTML:** 0.5-1 second (HTML generation)
- **JSON:** 0.1-0.2 seconds (serialization)

Total time for all formats: ~6-10 seconds

## Output Examples

### File Sizes
- Raw PDF: 150-300 KB
- Polished PDF: 200-400 KB
- Markdown: 50-150 KB
- HTML: 80-200 KB
- JSON: 100-300 KB

### Typical Directory Structure
```
~/research-output/
  ├── campaign-2026-04-raw.pdf
  ├── campaign-2026-04-polished.pdf
  ├── campaign-2026-04.md
  ├── campaign-2026-04.html
  └── campaign-2026-04.json
```

## Error Handling

```typescript
import { exportHelper } from './src/utils/exportHelper';

try {
  const result = await exportHelper.exportFindings(findings, {
    formats: ['pdf-polished', 'markdown'],
  });

  if (!result.success) {
    console.error(`Export failed: ${result.error}`);
    console.error(`Files created: ${result.files.length}`);
    // Partial results may still be available
  }
} catch (error) {
  console.error(`Export exception: ${error.message}`);
  // Handle unexpected errors
}
```

## Performance Notes

- Large research findings (500+ sources, 50+ competitors) may take 8-12 seconds
- PDF generation is CPU-bound (jsPDF + autotable)
- Consider exporting non-PDF formats first if time-sensitive
- All operations are blocking (async but single-threaded)

## Future Enhancements

- [ ] Company logo embedding
- [ ] Custom CSS styling
- [ ] Dark theme support
- [ ] Chart embedding in polished PDF
- [ ] Interactive PDF features
- [ ] Password protection
- [ ] Batch export with progress callback
- [ ] Export templates (minimal, detailed, executive-only)
- [ ] Custom section ordering
- [ ] Multi-language support

## Troubleshooting

### Export fails with "Module not found"
Ensure jsPDF and jsPDF-autotable are installed:
```bash
npm install jspdf jspdf-autotable
```

### PDF looks incorrect
- Check that findings data is valid (especially arrays and objects)
- Verify output directory has write permissions
- Try exporting to a simpler path first (no special characters)

### Polished PDF is very large
- Set `includeVisuals: false` to skip large visual analysis sections
- Use raw format instead
- Split research findings into smaller batches

### Timestamp in filename shows wrong date
- Check system timezone is correct
- Use explicit filename option instead of default

## License & Attribution

PDF Export System — Part of NOMADS Deep Research Platform
Uses: jsPDF, jsPDF-autotable (MIT licenses)
