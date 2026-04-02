# File Download & Analysis System — Phase 1 Detailed Planning

**Date**: 2026-04-02
**Phase**: P1 (Foundation) — 40 hours
**Status**: Planning (awaiting P0-A completion)
**Coordinator**: Agent: File Download & Analysis Phase 1

---

## PHASE 1 SCOPE

### Goal
Build the foundational file system for 4 file types (PDF, CSV/JSON, Images, Download infrastructure).

### Dependency
**BLOCKS ON**: P0-A (Wayfarer file transfer) — Must complete before P1 implementation begins.

### Deliverables (40 hours total)

| Component | Estimated Hours | Status |
|-----------|-----------------|--------|
| 1. Download Service Foundation | 12h | Planned |
| 2. PDF Text Extraction (pdfUtils.ts upgrade) | 10h | Planned |
| 3. CSV/JSON Streaming Analysis | 10h | Planned |
| 4. Image Batch Download & Analysis | 8h | Planned |
| **Total** | **40h** | **Planned** |

---

## COMPONENT 1: DOWNLOAD SERVICE FOUNDATION (12 hours)

### File Path
`src/utils/downloadService.ts` (new, 200-250 lines)

### Requirements

#### 1.1 Core Features
- **Streaming HTTP download** (no memory buffering)
- **URL validation** (whitelist/blacklist, no localhost/internal IPs)
- **Content validation** (size check before download, MIME type validation)
- **Retry logic** (3 attempts, exponential backoff)
- **Resume support** (HTTP 206 Range requests for partial downloads)
- **Timeout handling** (30s default, configurable)
- **Temp file storage** (session-isolated, `/tmp/nomads-{sessionId}/`)
- **Session cleanup** (auto-delete on session end)
- **Progress callbacks** (onProgress hook for UI feedback)

#### 1.2 API Surface
```typescript
export const downloadService = {
  // Single file download
  async downloadFile(
    url: string,
    options?: {
      maxSize?: number;        // Default: 500MB
      timeout?: number;        // Default: 30s
      onProgress?: (bytes: number) => void;
    }
  ): Promise<{
    path: string;             // Local file path
    size: number;             // Final size in bytes
    mimeType: string;         // Content-Type header
    filename: string;         // Extracted from URL or header
  }>,

  // Batch download (concurrent)
  async downloadBatch(
    urls: string[],
    options?: {
      concurrency?: number;   // Default: 10
      maxSize?: number;       // Default: 500MB per file
    }
  ): Promise<DownloadResult[]>,

  // Raw stream for advanced use
  async streamDownload(url: string): Promise<NodeJS.ReadableStream>,

  // URL validation
  validateUrl(url: string): boolean,

  // Session temp cleanup
  async cleanupSession(sessionId: string): Promise<void>,
};
```

#### 1.3 Security Layer
**URL Validation Logic:**
- ✅ Allow: https://, http:// (public domains)
- ✅ Allow: localhost:8889, 127.0.0.1:8889 (Wayfarer in dev)
- ✅ Allow: localhost:8888 (SearXNG in dev)
- ❌ Block: Internal IP ranges (192.168.*, 10.*, 172.16.*)
- ❌ Block: localhost (except trusted dev ports)
- ❌ Block: file:// (except in test mode)

**File Size Limits (Phase 1):**
- PDF: 200MB
- Images: 50MB each, 100 batch total (5GB total)
- Text files: Unlimited (streaming)
- Session temp max: 5GB
- Auto-cleanup: 24h timeout or session end

#### 1.4 Error Handling
- **Network errors** → Auto-retry (3 attempts, 1s → 2s → 4s backoff)
- **Timeout** → Return error, log details
- **Invalid size** → Reject before download starts
- **Invalid MIME** → Type-mismatch warning (warn but allow)
- **Partial download** → Resume with HTTP 206 if supported

#### 1.5 Integration Points
- **Infrastructure config** (`src/config/infrastructure.ts`)
  - Already has OLLAMA_URL, WAYFARER_URL, SEARXNG_URL
  - Add: TEMP_STORAGE_PATH (default: `/tmp/nomads-{sessionId}`)
  - Add: MAX_DOWNLOAD_SIZE, MAX_SESSION_TEMP

- **Session management**
  - Hook into existing session creation (register sessionId)
  - Hook into session cleanup (auto-delete temp files)

- **Abort signal support**
  - Thread AbortSignal through download pipeline
  - Implement early abort on signal.abort()

### Implementation Notes
1. **Use Node.js built-ins** (fs, http/https, stream) — no external deps if possible
2. **Streaming is critical** — never buffer entire file in memory
3. **Resume logic** — check HTTP Accept-Ranges header, use Range header
4. **Progress tracking** — emit bytes every 1MB or every 100ms
5. **Filename extraction** — parse Content-Disposition header first, then URL basename

---

## COMPONENT 2: PDF TEXT EXTRACTION UPGRADE (10 hours)

### File Path
`src/utils/pdfUtils.ts` (existing, enhance to ~300 lines)

### Current State
- Renders PDF pages to PNG images (pdf.js)
- Max 20 pages, scale 2x
- **Problem**: No text extraction, no table parsing

### Requirements

#### 2.1 Text Extraction
- Extract full text from each page (using pdf.js text layer)
- Return per-page text + full document text
- Preserve page breaks + structure
- Handle unicode, special chars

#### 2.2 Table Detection & Parsing
**Backend Python service** (`wayfarer/document_parser_service.py`):
- Use pdfplumber for table detection
- Extract table structure (rows, columns)
- Output as JSON (array of arrays)
- Fallback to text extraction if no tables detected

**Frontend integration**:
- Call backend `/parse-pdf` endpoint
- Combine image rendering + text extraction + tables

#### 2.3 Metadata Extraction
- Title (PDF info dictionary)
- Author, creation date
- Page count
- Encryption status
- Subject, keywords

#### 2.4 Page Structure Analysis
- Detect headers, footers
- Identify sections (if using outline/bookmarks)
- Get page dimensions

#### 2.5 Fallback: OCR for Scanned PDFs
- Detect if text layer exists (confidence check)
- If no text: Flag as "scanned" → suggest OCR
- Optional: Call Tesseract backend if enabled

#### 2.6 API Surface
```typescript
export const pdfUtils = {
  // Existing (keep as-is)
  async pdfToImages(
    pdfPath: string,
    options?: { maxPages?: number }
  ): Promise<PdfImage[]>,

  // New: Text extraction
  async extractText(
    pdfPath: string,
    options?: { pages?: number[] }
  ): Promise<{
    fullText: string;
    pages: Array<{
      pageNum: number;
      text: string;
      textConfidence: number;  // 0-1, low = likely scanned
    }>;
  }>,

  // New: Table extraction
  async extractTables(
    pdfPath: string
  ): Promise<Array<{
    pageNum: number;
    tableNum: number;
    data: string[][];        // 2D array of cells
    format: 'json' | 'csv';
  }>>,

  // New: Full metadata
  async getMetadata(pdfPath: string): Promise<{
    title?: string;
    author?: string;
    creationDate?: Date;
    pageCount: number;
    isScanned: boolean;
  }>,

  // New: Combined analysis
  async analyzePdf(
    pdfPath: string,
    options?: { extractTables?: boolean; ocr?: boolean }
  ): Promise<PdfAnalysisResult>,
};
```

#### 2.7 Backend Integration
**New Python file**: `wayfarer/document_parser_service.py`

```python
class DocumentParserService:
    @staticmethod
    async def parse_pdf(pdf_path: str, extract_tables: bool = True) -> Dict:
        """
        Returns:
        {
            "text_per_page": [{"page": 1, "text": "...", "confidence": 0.95}],
            "tables": [{"page": 1, "data": [[...]]}],
            "metadata": {"title": "...", "author": "..."},
        }
        """
        pass

    @staticmethod
    async def extract_tables(pdf_path: str) -> List[Dict]:
        """Returns list of tables with 2D arrays."""
        pass

    @staticmethod
    async def detect_scanned(pdf_path: str) -> bool:
        """Returns True if PDF is scanned (no text layer)."""
        pass
```

**Dependencies to add**:
- `pdfplumber` (Python, table detection)
- `pypdf` (Python, basic PDF parsing — fallback)

#### 2.8 Context-1 Integration
- Chunk large PDFs (3000 chars per chunk)
- Send chunks to Context-1 for semantic search
- Enable `/find "pricing info" in [pdf-url]` command

### Implementation Plan
1. Add text extraction to pdfUtils.ts (pdf.js text layer API)
2. Create Python document_parser_service.py with pdfplumber
3. Add Wayfarer endpoint `/parse-pdf` (POST, returns JSON)
4. Update TypeScript pdfUtils to call backend for tables + metadata
5. Wire into Context-1 for document search
6. Test: Local PDF + remote PDF (via downloadService)

---

## COMPONENT 3: CSV/JSON STREAMING ANALYSIS (10 hours)

### File Path
`src/utils/csvService.ts` (new, 250-300 lines)

### Requirements

#### 3.1 CSV Analysis
- **Auto-detect delimiter** (comma, tab, semicolon, pipe)
- **Stream parsing** (no memory load for large files)
- **Schema detection**:
  - Column names (from header)
  - Data types per column (string, number, date, boolean)
  - Null counts
  - Patterns (e.g., "email", "phone", "date")
- **Sample data** (first 100 rows)
- **Summary stats**:
  - Total rows
  - Row count per type
  - Unique values per column
  - Min/max for numeric columns
  - Date range for date columns

#### 3.2 JSON Analysis
- **Auto-detect format**:
  - JSON array: `[{...}, {...}]`
  - JSON object: `{...}`
  - NDJSON: `{...}\n{...}`
- **Stream parsing** (line-by-line for NDJSON)
- **Schema extraction**:
  - Root structure (array vs object)
  - Key paths at depth 2 (e.g., `person.name`, `person.age`)
  - Data types per key
  - Required vs optional keys
- **Sample record** (first item or 100 items from array)
- **Summary stats**:
  - Item count (for arrays)
  - Unique keys
  - Max nesting depth

#### 3.3 API Surface
```typescript
export const csvService = {
  // Analyze CSV file/stream
  async analyzeCsv(
    pathOrUrl: string,
    options?: {
      delimiter?: 'auto' | ',' | '\t' | ';' | '|';
      sampleRows?: number;  // Default: 100
      maxMemory?: number;   // For streaming cutoff
    }
  ): Promise<{
    delimiter: string;
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
      nullCount: number;
      pattern?: string;     // 'email', 'phone', 'url', 'ip', 'uuid', etc.
    }>;
    sampleRows: Array<Record<string, any>>;
    stats: {
      totalRows: number;
      columnCount: number;
    };
  }>,

  // Analyze JSON
  async analyzeJson(
    pathOrUrl: string,
    options?: { sampleItems?: number }
  ): Promise<{
    format: 'array' | 'object' | 'ndjson';
    schema: JsonSchema;
    sampleData: any[];
    itemCount: number;
  }>,

  // Generic: detect type and analyze
  async analyze(
    pathOrUrl: string
  ): Promise<CsvAnalysisResult | JsonAnalysisResult>,
};
```

#### 3.4 Schema Detection Logic
**CSV Type Inference:**
```typescript
function inferType(values: string[]): ColumnType {
  const nonNull = values.filter(v => v && v.trim());
  if (nonNull.length === 0) return 'string';

  // Try number
  if (nonNull.every(v => /^-?\d+\.?\d*$/.test(v))) return 'number';

  // Try date
  if (nonNull.every(v => isValidDate(v))) return 'date';

  // Try boolean
  if (nonNull.every(v => ['true', 'false', 'yes', 'no', '1', '0'].includes(v.toLowerCase())))
    return 'boolean';

  return 'string';
}
```

**Pattern Detection:**
```typescript
function detectPattern(values: string[]): string | undefined {
  const nonNull = values.filter(v => v && v.trim());
  if (nonNull.length < 5) return undefined;

  // Check email pattern
  if (nonNull.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return 'email';

  // Check phone
  if (nonNull.every(v => /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v)))
    return 'phone';

  // Add more patterns: URL, IP, UUID, SSN, ZIP, etc.
  return undefined;
}
```

#### 3.5 Streaming Implementation
- **Use csv-parser library** for CSV parsing
- **Implement chunked reading** (1MB chunks)
- **Sample first N rows** during initial parse
- **For large files**: Stop after 100K rows (timeout safeguard)

#### 3.6 Integration Points
- **Download service**: `downloadService.downloadFile()` returns path
- **Context-1 search**: Chunk CSV rows, enable pattern matching
- **Image analysis**: Export CSV sample as table visualization (future)

### Implementation Plan
1. Create csvService.ts with CSV analysis
2. Add JSON analysis
3. Integrate pattern detection library or regex patterns
4. Add Wayfarer endpoint `/parse-csv` (returns schema JSON)
5. Wire Context-1 for CSV search
6. Test: Local CSV + remote CSV (via downloadService)

---

## COMPONENT 4: IMAGE BATCH DOWNLOAD & ANALYSIS (8 hours)

### File Path
`src/utils/imageBatchService.ts` (existing, enhance ~100 lines)

### Current State
- Analyzes local image files (path-based)
- 4 parallel agents, 3 images each = 12 images/batch
- Vision model: qwen3.5:4b
- Output: Descriptions, colors, objects, quality (1-10)
- **Missing**: URL download capability

### Requirements

#### 4.1 Image Download
- **Batch download** URLs to temp storage
- **Concurrent**: 10 parallel (configurable)
- **Validation**:
  - MIME type check (image/* only)
  - Size limit: 50MB per image
  - Format support: jpg, png, webp, gif, svg (svg → rasterize)
- **Progress tracking**: Download % + analysis %

#### 4.2 Enhanced API
```typescript
export const imageBatchService = {
  // Existing: local file analysis
  async analyzeImages(
    filePaths: string[],
    signal?: AbortSignal
  ): Promise<ImageAnalysisResult>,

  // New: URL batch download + analysis
  async analyzeImageUrls(
    urls: string[],
    options?: {
      concurrency?: number;   // Default: 10
      analyzeAfterDownload?: boolean;  // Default: true
    },
    signal?: AbortSignal
  ): Promise<ImageAnalysisResult>,

  // Helper: Download images only
  async downloadImages(
    urls: string[],
    options?: { concurrency?: number }
  ): Promise<Array<{ url: string; localPath: string }>>,
};
```

#### 4.3 Output Format (unchanged)
```typescript
interface ImageAnalysisResult {
  images: Array<{
    url?: string;
    localPath: string;
    description: string;
    colors: Array<{
      hex: string;
      name: string;
      percentage: number;
    }>;
    objects: Array<{
      name: string;
      confidence: number;
    }>;
    quality: number;        // 1-10
    category: 'product' | 'lifestyle' | 'hero' | 'ui' | 'other';
  }>;
  colorPalette: string[];  // Top 5 hex colors
  objectFrequency: Record<string, number>;  // Count by object type
}
```

#### 4.4 Integration
- **Download service**: Validate URLs, stream downloads
- **Existing imageBatchService**: Reuse analysis pipeline
- **Context-1**: Store color palettes, object lists for search

### Implementation Plan
1. Extend imageBatchService with `analyzeImageUrls()` method
2. Add `downloadImages()` helper
3. Wire abort signal through download + analysis
4. Update progress callback to combine download + analysis %
5. Test: Batch of 10-50 images from various sources

---

## CLI COMMANDS (Phase 1 Subset)

### Basic Download Commands
```bash
# Download single file
/download https://example.com/document.pdf
  → Returns: { path, size, mimeType, filename }

# Download batch
/download-batch https://... https://... https://...
  → Returns: Array of download results

# List temp files for session
/temp-files
  → Shows: session_id, files[], total_size

# Clear old temp files
/temp-clear --older-than 1h
```

### Analysis Commands
```bash
# Auto-detect and analyze
/analyze https://example.com/file.pdf
  → Detects PDF, runs analyzePdf()

# Extract PDF text + tables
/parse-pdf https://example.com/doc.pdf --extract-tables
  → Returns: { text, tables, metadata }

# Analyze CSV
/parse-csv https://example.com/data.csv
  → Returns: { columns, sampleRows, stats }

# Analyze images from URLs
/analyze-images https://... https://... https://...
  → Returns: { images, colorPalette, objectFrequency }

# Context-1 document search
/find "pricing strategy" in https://example.com/doc.pdf
  → Returns: Matching chunks with context
```

---

## TESTING STRATEGY

### Unit Tests
1. **downloadService**:
   - URL validation (whitelist/blacklist)
   - Streaming download (mock server)
   - Retry logic
   - Size validation

2. **csvService**:
   - Delimiter detection (comma, tab, semicolon)
   - Type inference (string, number, date, boolean)
   - Pattern detection (email, phone)
   - Sample extraction

3. **pdfUtils enhancement**:
   - Text extraction (pdf.js)
   - Table detection (backend mock)
   - Metadata extraction

4. **imageBatchService extension**:
   - URL validation
   - Batch download
   - Concurrent limits

### Integration Tests
1. **End-to-end download + analyze**:
   - Download PDF → extract text → Context-1 search
   - Download CSV → parse schema → display sample
   - Download images → batch analyze → color extraction

2. **Error handling**:
   - Invalid URLs
   - Oversized files
   - Timeouts
   - Network interruption (retry)

3. **Session cleanup**:
   - Verify temp files created
   - Verify cleanup on session end
   - Verify no orphaned files

### Manual Testing
1. **Real PDFs**: Whitepaper, research report, contract
2. **Real CSVs**: Marketing data, financial data, log export
3. **Real images**: Web screenshots, competitor imagery (100+ images)
4. **Error cases**: Broken links, large files, slow servers

---

## DEPENDENCIES TO ADD

### npm (Node.js frontend + dev server)
None required for Phase 1 (use built-ins: fs, http, https, stream).

Optional (if needed):
- `csv-parser` (streaming CSV parse — ~50KB)
- `fast-json-stringify` (JSON serialization optimization)

### Python (Wayfarer backend)
- `pdfplumber` — Table detection in PDFs
- `pypdf` — PDF parsing (fallback)

Add to `wayfarer/requirements.txt`:
```
pdfplumber==0.10.3
pypdf==4.0.1
```

---

## COORDINATION WITH P0-A

**P0-A Deliverable**: Wayfarer file transfer endpoint
- Expected: `/download` endpoint on Wayfarer
- P1 will: Call Wayfarer `/download`, get local file path
- Or: P1 implements own streaming downloader in Node.js

**Assumption**: P0-A does NOT block P1 start:
- If P0-A done: Use Wayfarer `/download` for backend downloads
- If P0-A pending: Use Node.js built-ins for frontend downloads

---

## BLOCKERS & ASSUMPTIONS

### Hard Blockers
1. **P0-A completion**: Wayfarer file transfer endpoint
2. **Python environment**: Python 3.11 available (already installed)

### Soft Dependencies
1. **pdfplumber availability**: Required for table parsing (can fallback to no tables)
2. **Tesseract**: Optional for OCR (can skip for Phase 1)
3. **FFmpeg**: Not needed for Phase 1 (needed for Phase 2)

### Risk Mitigation
- **If Wayfarer download unavailable**: Use Node.js built-in HTTP client
- **If pdfplumber fails**: Skip table extraction, return text only
- **If CSV > 100K rows**: Stop parsing, return partial results with warning

---

## SUCCESS CRITERIA

### Phase 1 Complete When:
1. ✅ downloadService.ts created + all functions working
2. ✅ pdfUtils.ts enhanced with text extraction + table parsing
3. ✅ csvService.ts created with schema detection
4. ✅ imageBatchService extended with URL download
5. ✅ All 5 CLI commands working (download, parse-pdf, parse-csv, analyze-images, find)
6. ✅ Integration tests passing (end-to-end workflows)
7. ✅ Zero TypeScript errors
8. ✅ Build compiles cleanly

### Code Quality:
- No console errors
- Abort signals fully threaded
- Proper error messages + logging
- Session cleanup verified
- Security checks in place

### Documentation:
- README with Phase 1 examples
- CLI command reference
- API examples for each service
- Known limitations listed

---

## NEXT PHASES

### Phase 2 (Not in scope):
- Video file support (FFmpeg frame extraction)
- Audio transcription (Whisper)
- Office documents (.docx, .xlsx, .pptx)

### Phase 3 (Not in scope):
- Archive extraction (.zip, .tar.gz, .7z)
- Folder crawling & batch processing

### Phase 4+ (Future):
- Advanced pattern matching
- Batch document comparison
- Report generation

---

## SUMMARY

**Phase 1 Foundation** builds the critical infrastructure for file handling:

1. **Streaming downloads** (12h) — Safe, validated, session-managed file ingestion
2. **PDF analysis** (10h) — Text + tables + metadata extraction
3. **CSV/JSON analysis** (10h) — Schema detection, streaming, summary stats
4. **Image batching** (8h) — URL download + vision analysis

**Total: 40 hours**
**Timeline**: 1 week (assuming P0-A complete by start)
**Unblocks**: File-based research, document referencing in Quick Menu, all Phase 2+ work

**Status**: Awaiting P0-A completion to begin implementation.
