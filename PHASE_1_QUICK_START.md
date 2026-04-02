# Phase 1 Quick Start Guide

## What Was Built

5 new components for file handling:

### 1. Download Service (`src/utils/downloadService.ts`)
```typescript
import { downloadService } from './downloadService';

// Download single file
const result = await downloadService.downloadFile(
  'https://example.com/document.pdf',
  { sessionId: 'user123' }
);

// Download batch
const results = await downloadService.downloadBatch(
  ['https://...', 'https://...'],
  { concurrency: 10, sessionId: 'user123' }
);

// Cleanup session
await downloadService.cleanupSession('user123');
```

### 2. PDF Analysis (`src/utils/pdfUtils.ts`)
```typescript
import { extractText, getMetadata, analyzePdf } from './pdfUtils';

const pdfData = new ArrayBuffer(...);

// Extract text
const text = await extractText(pdfData);
console.log(text.fullText);

// Get metadata
const meta = await getMetadata(pdfData);
console.log(meta.title);

// Full analysis
const analysis = await analyzePdf(pdfData);
```

### 3. CSV/JSON Analysis (`src/utils/csvService.ts`)
```typescript
import { csvService } from './csvService';

// Analyze CSV
const csv = await csvService.analyzeCsv('https://example.com/data.csv');
csv.columns.forEach(col => {
  console.log(`${col.name}: ${col.type} (${col.pattern})`);
});

// Analyze JSON
const json = await csvService.analyzeJson('https://example.com/data.json');
console.log(json.schema.itemSchema);
```

### 4. Image Batch Download (`src/utils/imageBatchService.ts`)
```typescript
import { imageBatchService } from './imageBatchService';

// Download and analyze images
const result = await imageBatchService.analyzeImageUrls(
  ['https://...', 'https://...'],
  { sessionId: 'user123' }
);

console.log(result.colorDistribution);
console.log(result.descriptions);
```

### 5. CLI Commands
```bash
/download https://example.com/document.pdf
/download-batch url1 url2 url3
/analyze https://example.com/file.csv
/parse-pdf https://example.com/doc.pdf
/parse-csv https://example.com/data.csv
/analyze-images url1 url2 url3
```

## File Locations

- Frontend: `src/utils/downloadService.ts`, `src/utils/csvService.ts`, etc.
- Backend: `wayfarer/document_parser_service.py`
- API Endpoints: Added to `wayfarer_server.py` (`/parse-pdf`, `/analyze-pdf-url`)

## Security Features

- URL validation (blocks internal IPs)
- Size limits enforced
- Session isolation
- Auto-cleanup (24h timeout)

## Next Phase

Phase 2 will add:
- Full table extraction from PDFs
- OCR for scanned documents
- Office document support (.docx, .xlsx, .pptx)
