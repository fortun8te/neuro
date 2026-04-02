# Phase 1 Quick Reference — Developer Cheatsheet

**For: Developers implementing Phase 1**
**Use this document to quickly find specs, APIs, and implementation patterns**

---

## FILE LOCATIONS AT A GLANCE

| Component | File | Status | Lines |
|-----------|------|--------|-------|
| Download Service | src/utils/downloadService.ts | NEW | 200-250 |
| CSV Analysis | src/utils/csvService.ts | NEW | 250-300 |
| PDF Enhancement | src/utils/pdfUtils.ts | ENHANCE | +150 |
| Image Extension | src/utils/imageBatchService.ts | ENHANCE | +100 |
| Document Parser | wayfarer/document_parser_service.py | NEW | 300-400 |
| Wayfarer Server | wayfarer/wayfarer_server.py | ENHANCE | +30 |
| CLI Commands | src/cli.ts | ENHANCE | +100 |
| Types | src/types/documents.ts | NEW | 100+ |

---

## API SIGNATURES (COPY-PASTE READY)

### downloadService.ts
```typescript
// Single file download
async downloadFile(
  url: string,
  options?: {
    maxSize?: number;
    timeout?: number;
    onProgress?: (bytes: number) => void;
  }
): Promise<{
  path: string;
  size: number;
  mimeType: string;
  filename: string;
}>

// Batch download
async downloadBatch(
  urls: string[],
  options?: {
    concurrency?: number;
    maxSize?: number;
  }
): Promise<DownloadResult[]>

// Stream (for advanced use)
async streamDownload(url: string): Promise<NodeJS.ReadableStream>

// URL validation
validateUrl(url: string): boolean

// Session cleanup
async cleanupSession(sessionId: string): Promise<void>
```

### csvService.ts
```typescript
// CSV analysis
async analyzeCsv(
  pathOrUrl: string,
  options?: {
    delimiter?: 'auto' | ',' | '\t' | ';' | '|';
    sampleRows?: number;
    maxMemory?: number;
  }
): Promise<{
  delimiter: string;
  columns: ColumnSchema[];
  sampleRows: any[];
  stats: { totalRows: number; columnCount: number };
}>

// JSON analysis
async analyzeJson(
  pathOrUrl: string,
  options?: { sampleItems?: number }
): Promise<{
  format: 'array' | 'object' | 'ndjson';
  schema: JsonSchema;
  sampleData: any[];
  itemCount: number;
}>

// Auto-detect
async analyze(pathOrUrl: string): Promise<CsvAnalysisResult | JsonAnalysisResult>
```

### pdfUtils.ts (additions)
```typescript
// Text extraction
async extractText(
  pdfPath: string,
  options?: { pages?: number[] }
): Promise<{
  fullText: string;
  pages: Array<{
    pageNum: number;
    text: string;
    textConfidence: number;
  }>;
}>

// Table extraction
async extractTables(
  pdfPath: string
): Promise<Array<{
  pageNum: number;
  tableNum: number;
  data: string[][];
  format: 'json' | 'csv';
}>>

// Metadata
async getMetadata(pdfPath: string): Promise<{
  title?: string;
  author?: string;
  creationDate?: Date;
  pageCount: number;
  isScanned: boolean;
}>

// Full analysis
async analyzePdf(
  pdfPath: string,
  options?: { extractTables?: boolean; ocr?: boolean }
): Promise<PdfAnalysisResult>
```

### imageBatchService.ts (additions)
```typescript
// Download images from URLs
async downloadImages(
  urls: string[],
  options?: { concurrency?: number }
): Promise<Array<{ url: string; localPath: string }>>

// Analyze images from URLs
async analyzeImageUrls(
  urls: string[],
  options?: {
    concurrency?: number;
    analyzeAfterDownload?: boolean;
  },
  signal?: AbortSignal
): Promise<ImageAnalysisResult>
```

---

## TYPE DEFINITIONS (COPY-PASTE READY)

```typescript
// Download Service Types
interface DownloadResult {
  path: string;
  size: number;
  mimeType: string;
  filename: string;
}

interface DownloadOptions {
  maxSize?: number;        // Default: 500MB
  timeout?: number;        // Default: 30s
  onProgress?: (bytes: number) => void;
}

// CSV Service Types
interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  nullCount: number;
  pattern?: string;  // 'email', 'phone', 'url', etc.
}

interface CsvAnalysisResult {
  delimiter: string;
  columns: ColumnSchema[];
  sampleRows: any[];
  stats: {
    totalRows: number;
    columnCount: number;
  };
}

interface JsonSchema {
  format: 'array' | 'object' | 'ndjson';
  keys: string[];
  types: Record<string, string>;
  required: string[];
}

// PDF Service Types
interface PdfAnalysisResult {
  fullText: string;
  pages: PdfPage[];
  tables: PdfTable[];
  metadata: PdfMetadata;
}

interface PdfPage {
  pageNum: number;
  text: string;
  textConfidence: number;
}

interface PdfTable {
  pageNum: number;
  tableNum: number;
  data: string[][];
  format: 'json' | 'csv';
}

interface PdfMetadata {
  title?: string;
  author?: string;
  creationDate?: Date;
  pageCount: number;
  isScanned: boolean;
}

// Image Service Types
interface ImageAnalysisResult {
  images: ImageAnalysis[];
  colorPalette: string[];
  objectFrequency: Record<string, number>;
}

interface ImageAnalysis {
  url?: string;
  localPath: string;
  description: string;
  colors: ColorInfo[];
  objects: ObjectDetection[];
  quality: number;
  category: 'product' | 'lifestyle' | 'hero' | 'ui' | 'other';
}
```

---

## SECURITY REQUIREMENTS CHECKLIST

### URL Validation
```typescript
// ALLOW
✅ https://example.com/file.pdf
✅ http://example.com/file.csv
✅ http://localhost:8889/test    (Wayfarer dev)
✅ http://127.0.0.1:8888/search  (SearXNG dev)

// DENY
❌ http://localhost:3000/file.pdf (non-dev port)
❌ http://192.168.1.100/file.pdf (internal IP)
❌ http://10.0.0.1/file.pdf       (internal IP)
❌ file:///Users/mk/file.pdf      (file://)
❌ javascript:alert('xss')         (invalid protocol)
```

### File Size Limits
```typescript
PDF:       200MB max
Images:    50MB each, 100 batch (5GB total)
CSV:       Unlimited (streaming)
Session:   5GB max per session
Timeout:   30s per download
```

### Session Cleanup
```typescript
// On session end, delete:
- /tmp/nomads-{sessionId}/      (entire directory)
- IndexedDB temp records
- In-memory progress tracking

// Auto-cleanup if:
- Session timeout (24h)
- User closes browser
- Explicit /temp-clear command
```

---

## CLI COMMANDS (QUICK REFERENCE)

```bash
# Download
/download https://example.com/file.pdf
  → {path, size, mimeType, filename}

# PDF
/parse-pdf https://example.com/doc.pdf --extract-tables
  → {fullText, pages[], tables[], metadata}

# CSV
/parse-csv https://example.com/data.csv
  → {columns[], sampleRows[], stats}

# Images
/analyze-images https://... https://... https://...
  → {images[], colorPalette[], objectFrequency}

# Search (Context-1)
/find "pricing strategy" in https://example.com/doc.pdf
  → [matching chunks with context]

# Session management
/temp-files             → List temp files
/temp-clear --older-than 1h  → Delete old files
```

---

## IMPLEMENTATION PATTERNS

### Pattern 1: Streaming Download
```typescript
async downloadFile(url: string): Promise<string> {
  // 1. Validate
  if (!this.validateUrl(url)) throw new Error('Invalid URL');

  // 2. Check size (HEAD request)
  const head = await fetch(url, { method: 'HEAD' });
  const size = parseInt(head.headers.get('content-length') || '0');
  if (size > 500_000_000) throw new Error('File too large');

  // 3. Stream to temp file
  const tempPath = `/tmp/nomads-${generateId()}`;
  const writeStream = fs.createWriteStream(tempPath);
  const response = await fetch(url);
  response.body?.pipe(writeStream);

  // 4. Wait for completion
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return tempPath;
}
```

### Pattern 2: Type Inference (CSV)
```typescript
function inferType(values: string[]): string {
  const nonNull = values.filter(v => v && v.trim());
  if (nonNull.length === 0) return 'string';
  if (nonNull.every(v => /^-?\d+\.?\d*$/.test(v))) return 'number';
  if (nonNull.every(v => isValidDate(v))) return 'date';
  if (nonNull.every(v => /^(true|false|yes|no|1|0)$/i.test(v))) return 'boolean';
  return 'string';
}
```

### Pattern 3: Pattern Detection (CSV)
```typescript
function detectPattern(values: string[]): string | undefined {
  const nonNull = values.filter(v => v && v.trim());
  if (nonNull.length < 5) return undefined;

  const patterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    url: /^https?:\/\/.+\..+/,
    ip: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  };

  for (const [name, regex] of Object.entries(patterns)) {
    if (nonNull.every(v => regex.test(v))) return name;
  }

  return undefined;
}
```

### Pattern 4: Abort Signal Threading
```typescript
async function downloadFile(
  url: string,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) throw new Error('Download aborted');

  const writeStream = fs.createWriteStream(tempPath);
  signal?.addEventListener('abort', () => {
    writeStream.destroy();
  });

  const response = await fetch(url, { signal });
  response.body?.pipe(writeStream);

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}
```

### Pattern 5: Python Backend Error Handling
```python
# In document_parser_service.py
try:
    with pdfplumber.open(pdf_path) as pdf:
        tables = []
        for i, page in enumerate(pdf.pages):
            for table in page.extract_tables() or []:
                tables.append({
                    "page": i + 1,
                    "data": table
                })
        return {"tables": tables}
except Exception as e:
    logger.error(f"PDF parsing error: {e}")
    return {"tables": [], "error": str(e)}
```

---

## TESTING TEMPLATE

### Unit Test Example
```typescript
describe('downloadService', () => {
  it('should reject invalid URLs', () => {
    expect(downloadService.validateUrl('http://localhost:3000')).toBe(false);
    expect(downloadService.validateUrl('file:///path')).toBe(false);
    expect(downloadService.validateUrl('http://192.168.1.1')).toBe(false);
  });

  it('should accept valid public URLs', () => {
    expect(downloadService.validateUrl('https://example.com/file.pdf')).toBe(true);
    expect(downloadService.validateUrl('http://localhost:8889/test')).toBe(true);
  });

  it('should retry on timeout', async () => {
    // Mock fetch to timeout 2x, then succeed
    const result = await downloadService.downloadFile(url);
    expect(result.path).toBeDefined();
  });
});
```

### Integration Test Example
```typescript
describe('PDF analysis pipeline', () => {
  it('should download PDF → extract text → search', async () => {
    // 1. Download
    const { path } = await downloadService.downloadFile(pdfUrl);

    // 2. Extract
    const { fullText } = await pdfUtils.extractText(path);

    // 3. Verify
    expect(fullText.length).toBeGreaterThan(0);
    expect(fullText).toContain('expected text');
  });
});
```

---

## DEPENDENCY VERSIONS

```
Frontend (npm):
- None required (built-ins only)

Backend (pip):
pdfplumber==0.10.3
pypdf==4.0.1
```

Add to `wayfarer/requirements.txt` and run:
```bash
pip install -r wayfarer/requirements.txt
```

---

## PERFORMANCE TARGETS

```
Component 1: Download Service
├─ 10MB file: < 2s
├─ 100MB file: < 10s
├─ Batch 10×5MB: < 5s (concurrent)
└─ Retry backoff: 1s → 2s → 4s

Component 2: PDF Analysis
├─ 10 pages: < 2s (text + tables)
├─ 50 pages: < 5s
└─ 500 pages: < 20s (streaming)

Component 3: CSV Analysis
├─ 1K rows: < 1s
├─ 100K rows: < 3s (streaming)
└─ 1M rows: < 10s (partial)

Component 4: Image Analysis
├─ Download 10×5MB: < 5s
├─ Analyze 12 images: 10-15s
└─ Download + analyze: < 20s
```

---

## COMMON ISSUES & FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| "Invalid URL" error | URL validation too strict | Check whitelist (localhost:8889, 8888 OK) |
| File not found after download | Temp path wrong | Verify /tmp/nomads-{sessionId} exists |
| CSV type inference wrong | Sample too small | Increase sample rows, check edge cases |
| Image batch timeout | Too many concurrent | Reduce concurrency from 10 → 5 |
| PDF text extraction empty | Scanned PDF | detectScanned() should return true, suggest OCR |
| TypeScript errors | Missing types | Check src/types/documents.ts |
| Build fails | pdfplumber not installed | Run `pip install pdfplumber==0.10.3` |

---

## INTEGRATION CHECKPOINTS

### P0-A Coordination
```
P0-A Deliverable: Wayfarer /download endpoint
P1 Assumption: POST /download → { path, size, mimeType }
If different: Update downloadService to match
Fallback: Use Node.js built-in HTTP client
```

### Session Management
```
On session init:
  → Register sessionId
  → Create /tmp/nomads-{sessionId} directory

On session cleanup:
  → Delete /tmp/nomads-{sessionId}
  → Clear IndexedDB temp records
```

### Context-1 Integration
```
For document search:
  1. Chunk file content (3000 chars/chunk)
  2. Send chunks to Context-1
  3. Return matching chunks with context
  4. Enable /find "query" in document
```

---

## GIT COMMITS (SUGGESTED SEQUENCE)

```bash
git commit -m "feat: add downloadService with streaming + validation"
git commit -m "feat: add csvService with schema detection"
git commit -m "feat: enhance pdfUtils with text + table extraction"
git commit -m "feat: enhance imageBatchService with URL download"
git commit -m "feat: add Phase 1 CLI commands (/download, /parse-pdf, etc)"
git commit -m "test: add integration tests for Phase 1 pipeline"
git commit -m "docs: Phase 1 complete with API reference"
```

---

## DEBUGGING TIPS

### Download Service
```typescript
// Add logging
console.log(`[downloadService] Downloading: ${url}`);
console.log(`[downloadService] Size: ${size} bytes`);
console.log(`[downloadService] Saved to: ${tempPath}`);
```

### CSV Analysis
```typescript
// Log inferred schema
console.log(`[csvService] Columns: ${columns.map(c => c.name).join(', ')}`);
console.log(`[csvService] Types: ${columns.map(c => c.type).join(', ')}`);
```

### PDF Extraction
```python
# In document_parser_service.py
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.debug(f"PDF pages: {len(pdf.pages)}")
```

---

## FINAL CHECKLIST BEFORE SUBMISSION

- [ ] All 4 components implemented
- [ ] All 5 CLI commands working
- [ ] Zero TypeScript errors (`npm run build`)
- [ ] Unit tests passing (`npm run test`)
- [ ] Integration tests passing (`npm run test:integration`)
- [ ] Temp files cleaned up on session end
- [ ] URL validation working (whitelist/blacklist)
- [ ] Abort signals threading through all async
- [ ] Documentation complete (README + JSDoc)
- [ ] No console errors
- [ ] Dev server starts cleanly
- [ ] Real file tests successful (PDF, CSV, images)

---

**Last Updated**: 2026-04-02
**For**: Phase 1 developers
**Questions?**: Check PHASE_1_DETAILED_PLAN.md or PHASE_1_ARCHITECTURE.md
