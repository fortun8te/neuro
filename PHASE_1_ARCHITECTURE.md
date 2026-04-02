# Phase 1 Architecture & Implementation Checklist

---

## ARCHITECTURE DIAGRAM

### Data Flow: URL → Download → Analysis → Storage

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1 PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Input (URL or local path)                                         │
│        ↓                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │ AUTO-DETECT FILE TYPE                                        │       │
│  │ ├─ .pdf         → Component 2 (PDF Analyzer)               │       │
│  │ ├─ .csv/.json   → Component 3 (CSV/JSON Analyzer)          │       │
│  │ ├─ .jpg/.png    → Component 4 (Image Analyzer)             │       │
│  │ └─ other        → Component 1 (Download only)              │       │
│  └──────────────────────────────────────────────────────────────┘       │
│        ↓                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │ COMPONENT 1: DOWNLOAD SERVICE (downloadService.ts)           │       │
│  │ ├─ validateUrl() → Security check                            │       │
│  │ ├─ downloadFile() → Stream to /tmp/nomads-{sessionId}       │       │
│  │ ├─ downloadBatch() → Concurrent (limit: 10)                 │       │
│  │ └─ cleanupSession() → Delete temp files on exit             │       │
│  └──────────────────────────────────────────────────────────────┘       │
│        ↓                                                                 │
│  LOCAL FILE AVAILABLE: /tmp/nomads-{sessionId}/{uuid}.{ext}             │
│        ↓                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │ COMPONENT 2-4: PARALLEL ANALYSIS BRANCHES                    │       │
│  ├─────────────────────────────────────────────────────────────┤       │
│  │ PDF Branch (pdfUtils.ts + document_parser_service.py)       │       │
│  │ ├─ pdfToImages() [existing, keep]                           │       │
│  │ ├─ extractText() [new] → pdf.js text layer                  │       │
│  │ ├─ extractTables() [new] → Wayfarer /parse-pdf backend      │       │
│  │ └─ getMetadata() [new] → Title, author, date               │       │
│  │ Output: {fullText, pages[], tables[], metadata}             │       │
│  ├─────────────────────────────────────────────────────────────┤       │
│  │ CSV/JSON Branch (csvService.ts)                             │       │
│  │ ├─ analyzeCsv() [new] → csv-parser + schema detection      │       │
│  │ ├─ analyzeJson() [new] → ndjson/array detection            │       │
│  │ └─ Schema: columns[], sampleRows[], stats{}                │       │
│  │ Output: {columns, sampleRows, stats}                        │       │
│  ├─────────────────────────────────────────────────────────────┤       │
│  │ Image Branch (imageBatchService.ts)                         │       │
│  │ ├─ downloadImages() [new] → URLs to /tmp                   │       │
│  │ ├─ analyzeImages() [existing, reuse]                       │       │
│  │ │  └─ 4 vision agents × 3 images = 12/batch               │       │
│  │ └─ analyzeImageUrls() [new] → Download + analyze           │       │
│  │ Output: {images[], colorPalette[], objectFrequency}        │       │
│  └──────────────────────────────────────────────────────────────┘       │
│        ↓                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │ CONTEXT-1 INTEGRATION (optional for Phase 1)                 │       │
│  │ ├─ Chunk large documents (3000 chars)                       │       │
│  │ ├─ Enable semantic search                                   │       │
│  │ └─ Enable pattern matching across documents                 │       │
│  └──────────────────────────────────────────────────────────────┘       │
│        ↓                                                                 │
│  RESULT: Structured JSON output + UI display                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## SERVICE DEPENDENCIES

```
User CLI Command
    ↓
┌─────────────────────────────────────┐
│ cli.ts (command router)             │
├─────────────────────────────────────┤
│ /download       → downloadService   │
│ /parse-pdf      → pdfUtils          │
│ /parse-csv      → csvService        │
│ /analyze-images → imageBatchService │
│ /find           → Context-1 + utils │
└─────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ Frontend Services (TypeScript)           │
├──────────────────────────────────────────┤
│ downloadService.ts (NEW)                 │
│   ├─ validateUrl()                       │
│   ├─ downloadFile()                      │
│   ├─ downloadBatch()                     │
│   └─ cleanupSession()                    │
│                                          │
│ pdfUtils.ts (ENHANCED)                   │
│   ├─ pdfToImages() [keep]                │
│   ├─ extractText() [new]                 │
│   ├─ extractTables() [new]               │
│   ├─ getMetadata() [new]                 │
│   └─ analyzePdf() [new wrapper]          │
│                                          │
│ csvService.ts (NEW)                      │
│   ├─ analyzeCsv()                        │
│   ├─ analyzeJson()                       │
│   └─ analyze() [auto-detect]             │
│                                          │
│ imageBatchService.ts (ENHANCED)          │
│   ├─ analyzeImages() [keep]              │
│   ├─ analyzeImageUrls() [new]            │
│   └─ downloadImages() [new helper]       │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ Backend Services (Python/Wayfarer)       │
├──────────────────────────────────────────┤
│ wayfarer/document_parser_service.py (NEW)│
│   ├─ parse_pdf()                         │
│   ├─ extract_tables()                    │
│   ├─ detect_scanned()                    │
│   └─ get_metadata()                      │
│                                          │
│ wayfarer/wayfarer_server.py (ENHANCED)   │
│   └─ POST /parse-pdf                     │
│       → Calls document_parser_service    │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ AI Models (Ollama)                       │
├──────────────────────────────────────────┤
│ qwen3.5:4b (vision, image analysis)      │
│ qwen3.5:2b (text compression, synthesis) │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ Storage                                  │
├──────────────────────────────────────────┤
│ /tmp/nomads-{sessionId}/                │
│   ├─ {uuid}.pdf                          │
│   ├─ {uuid}.csv                          │
│   ├─ {uuid}.jpg                          │
│   └─ {uuid}.json                         │
│                                          │
│ IndexedDB (Session metadata)              │
│   └─ downloadHistory[]                   │
│       analyzeHistory[]                   │
└──────────────────────────────────────────┘
```

---

## FILE STRUCTURE (Phase 1 Only)

### New Files to Create

```
src/
├── utils/
│   ├── downloadService.ts          ← NEW (200-250 lines)
│   ├── csvService.ts               ← NEW (250-300 lines)
│   ├── pdfUtils.ts                 ← ENHANCE (existing: ~150 lines → ~300 lines)
│   └── imageBatchService.ts        ← ENHANCE (existing: ~200 lines → ~300 lines)
│
└── config/
    └── infrastructure.ts           ← MAYBE UPDATE (add TEMP_STORAGE_PATH)

wayfarer/
└── document_parser_service.py      ← NEW (300-400 lines)

tests/
├── utils/
│   ├── downloadService.test.ts     ← NEW
│   ├── csvService.test.ts          ← NEW
│   ├── pdfUtils.test.ts            ← NEW
│   └── imageBatchService.test.ts   ← NEW
└── integration/
    └── fileAnalysisPipeline.test.ts ← NEW
```

### Modified Files

```
wayfarer/
└── wayfarer_server.py              ← Add /parse-pdf endpoint
    (import document_parser_service)

wayfarer/
└── requirements.txt                ← Add: pdfplumber, pypdf

src/
└── cli.ts                          ← Add 5 new commands
    (/download, /parse-pdf, /parse-csv, /analyze-images, /find)

src/
└── types/
    └── documents.ts               ← ADD types: DownloadResult, PdfAnalysisResult, etc.
```

---

## IMPLEMENTATION CHECKLIST

### Component 1: Download Service (12 hours)

- [ ] Create `src/utils/downloadService.ts`
  - [ ] Implement URL validation logic
  - [ ] Implement streaming download
  - [ ] Implement retry logic (3 attempts)
  - [ ] Implement size validation
  - [ ] Implement timeout handling
  - [ ] Add progress callback support
  - [ ] Add batch download with concurrency control
  - [ ] Implement session-based temp storage
  - [ ] Add cleanup logic

- [ ] Update `src/config/infrastructure.ts`
  - [ ] Add TEMP_STORAGE_PATH constant
  - [ ] Add MAX_DOWNLOAD_SIZE constant
  - [ ] Add MAX_SESSION_TEMP constant

- [ ] Add types to `src/types/documents.ts`
  - [ ] DownloadResult interface
  - [ ] DownloadOptions interface
  - [ ] DownloadError type

- [ ] Unit tests
  - [ ] URL validation (whitelist/blacklist)
  - [ ] Streaming download
  - [ ] Retry logic
  - [ ] Size validation
  - [ ] Timeout handling
  - [ ] Temp file cleanup

- [ ] Integration tests
  - [ ] Download from real URL
  - [ ] Batch download (5+ URLs concurrently)
  - [ ] Error handling (404, timeout, oversized)

### Component 2: PDF Enhancement (10 hours)

- [ ] Enhance `src/utils/pdfUtils.ts`
  - [ ] Add `extractText()` method (using pdf.js text layer)
  - [ ] Add `getMetadata()` method
  - [ ] Add `analyzePdf()` wrapper method
  - [ ] Integrate abort signal support
  - [ ] Add per-page text confidence tracking

- [ ] Create `wayfarer/document_parser_service.py`
  - [ ] Import pdfplumber, pypdf
  - [ ] Implement `parse_pdf()` method
  - [ ] Implement `extract_tables()` method
  - [ ] Implement `detect_scanned()` method
  - [ ] Implement error handling

- [ ] Update `wayfarer/wayfarer_server.py`
  - [ ] Add POST `/parse-pdf` endpoint
  - [ ] Handle file upload + parsing
  - [ ] Return JSON with {text_per_page, tables, metadata}

- [ ] Update `wayfarer/requirements.txt`
  - [ ] Add pdfplumber
  - [ ] Add pypdf

- [ ] Add types
  - [ ] PdfAnalysisResult interface
  - [ ] PdfPage interface
  - [ ] PdfTable interface
  - [ ] PdfMetadata interface

- [ ] Unit tests
  - [ ] Text extraction from PDF
  - [ ] Table detection + parsing
  - [ ] Metadata extraction
  - [ ] Scanned PDF detection

- [ ] Integration tests
  - [ ] Download PDF → extract text → verify output
  - [ ] PDF with tables → extract tables → verify CSV output
  - [ ] Large PDF → streaming text extraction

### Component 3: CSV/JSON Service (10 hours)

- [ ] Create `src/utils/csvService.ts`
  - [ ] Implement `analyzeCsv()` method
    - [ ] Auto-detect delimiter
    - [ ] Stream parsing (no memory buffering)
    - [ ] Type inference (string, number, date, boolean, mixed)
    - [ ] Pattern detection (email, phone, url, ip, uuid)
    - [ ] Sample extraction (first N rows)
    - [ ] Summary stats (total rows, null counts, unique values)
  - [ ] Implement `analyzeJson()` method
    - [ ] Detect format (array, object, ndjson)
    - [ ] Extract schema (keys, types, required)
    - [ ] Sample data extraction
    - [ ] Item count
  - [ ] Implement `analyze()` auto-detect wrapper

- [ ] Implement type inference logic
  - [ ] Number detection (regex)
  - [ ] Date detection (Date.parse + date patterns)
  - [ ] Boolean detection (true/false variants)
  - [ ] Mixed type fallback

- [ ] Implement pattern detection
  - [ ] Email regex
  - [ ] Phone regex
  - [ ] URL regex
  - [ ] IP regex
  - [ ] UUID regex
  - [ ] Add extensibility for custom patterns

- [ ] Add types
  - [ ] CsvAnalysisResult interface
  - [ ] ColumnSchema interface
  - [ ] JsonAnalysisResult interface
  - [ ] JsonSchema interface

- [ ] Unit tests
  - [ ] CSV delimiter detection (comma, tab, semicolon, pipe)
  - [ ] Type inference (all types)
  - [ ] Pattern detection (email, phone, url)
  - [ ] Large CSV parsing (100K rows)
  - [ ] JSON array parsing
  - [ ] NDJSON parsing

- [ ] Integration tests
  - [ ] Download CSV → analyze → display schema
  - [ ] Download JSON → analyze → extract sample
  - [ ] Large CSV streaming parse

### Component 4: Image Batch Service (8 hours)

- [ ] Enhance `src/utils/imageBatchService.ts`
  - [ ] Add `downloadImages()` method
    - [ ] Validate image URLs
    - [ ] Stream download to temp storage
    - [ ] Concurrent limit (10)
    - [ ] MIME type validation
  - [ ] Add `analyzeImageUrls()` method
    - [ ] Combine downloadImages + analyzeImages
    - [ ] Progress tracking (download % + analysis %)
    - [ ] Abort signal support

- [ ] Ensure existing `analyzeImages()` works with abs paths
  - [ ] Update filepath handling
  - [ ] Ensure abort signals flow through

- [ ] Add types
  - [ ] ImageDownloadResult interface
  - [ ] ImageAnalysisOptions interface

- [ ] Unit tests
  - [ ] Image URL validation
  - [ ] Batch download (10+ images)
  - [ ] Size validation per image
  - [ ] MIME type validation

- [ ] Integration tests
  - [ ] Download 20 images → analyze → extract colors
  - [ ] Progress callback verification

### Component 5: CLI Commands (4 hours)

- [ ] Update `src/cli.ts`
  - [ ] Add `/download <url>` command
  - [ ] Add `/parse-pdf <url>` command
  - [ ] Add `/parse-csv <url>` command
  - [ ] Add `/analyze-images <urls>` command
  - [ ] Add `/find <query> in <url>` command

- [ ] Command parsing + validation
  - [ ] URL parameter parsing
  - [ ] Options parsing (--format, --extract-tables, etc.)
  - [ ] Error messages + help text

- [ ] Command output formatting
  - [ ] JSON output for /download
  - [ ] Table output for /parse-csv
  - [ ] Structured text for /parse-pdf
  - [ ] Gallery preview for /analyze-images

### Testing & Documentation (6 hours)

- [ ] Integration test suite
  - [ ] End-to-end PDF analysis
  - [ ] End-to-end CSV analysis
  - [ ] End-to-end image analysis
  - [ ] Error handling (all components)

- [ ] Documentation
  - [ ] README for Phase 1
  - [ ] API documentation (downloadService, csvService, etc.)
  - [ ] CLI command reference
  - [ ] Example usage (code snippets)
  - [ ] Known limitations

- [ ] Build verification
  - [ ] `npm run build` (zero TypeScript errors)
  - [ ] Dev server startup
  - [ ] No console errors

---

## SECURITY CHECKLIST

### URL Validation
- [ ] Whitelist public domains
- [ ] Block internal IP ranges (192.168.*, 10.*, 172.16.*)
- [ ] Block localhost (except dev services: 8889, 8888)
- [ ] Block file:// protocol
- [ ] Enforce HTTPS (except dev localhost)

### File Safety
- [ ] Size validation (reject oversized files)
- [ ] MIME type checking (reject non-matching types)
- [ ] Temp file cleanup on session end
- [ ] No persistent storage of downloaded files
- [ ] Secure temp directory (/tmp with session ID)

### Process Safety
- [ ] Abort signals fully threaded
- [ ] Graceful error handling (no process crashes)
- [ ] No command injection (pdfplumber, csv-parser use safe APIs)
- [ ] Timeout enforcement (no hanging processes)

### Privacy
- [ ] No logging of file contents
- [ ] No storing of analyzed data beyond session
- [ ] No external API calls (except authorized services)

---

## PERFORMANCE BENCHMARKS (Target)

### Download Service
- Single file (10MB): < 2s
- Single file (100MB): < 10s
- Batch 10 files (5MB each): < 5s (concurrent)
- Retry on timeout: 1s → 2s → 4s backoff

### PDF Analysis
- Small PDF (10 pages): < 2s text + tables
- Medium PDF (50 pages): < 5s
- Large PDF (500 pages): < 20s (streaming)

### CSV Analysis
- Small CSV (1000 rows): < 1s
- Medium CSV (100K rows): < 3s (streaming)
- Large CSV (1M rows): < 10s (streaming, partial)

### Image Batch
- Download 10 images (5MB each): < 5s (concurrent)
- Analyze 12 images: 10-15s (4 agents × 3 images)
- Download + analyze 10 images: < 20s total

---

## ERROR HANDLING MATRIX

| Error | Component | Handling | User Message |
|-------|-----------|----------|--------------|
| Invalid URL | downloadService | Reject before download | "Invalid URL format" |
| URL timeout | downloadService | Retry 3x, then fail | "Download timeout after 30s" |
| Oversized file | downloadService | Reject on Content-Length | "File too large (XXX MB)" |
| Network error | downloadService | Retry with backoff | "Network error, retrying..." |
| Invalid MIME | downloadService | Warn, allow anyway | "Warning: unexpected file type" |
| Corrupt PDF | pdfUtils | Fallback to image extraction | "PDF parsing error, using fallback" |
| No text in PDF | pdfUtils | Flag as scanned | "Scanned PDF detected, no text layer" |
| Invalid CSV | csvService | Return partial results | "CSV parsing stopped at row XXX" |
| JSON format error | csvService | Reject | "Invalid JSON format" |
| Image URL invalid | imageBatchService | Skip image | "Image XXX unreachable" |
| Session timeout | downloadService | Cleanup temp files | (automatic) |

---

## SUCCESS VERIFICATION

### Build & Type Safety
```bash
npm run build  # Must complete with zero errors
npm run type-check  # Must pass all checks
npm run lint  # Should pass (non-critical failures OK)
```

### Unit Test Coverage
```bash
npm run test  # All Phase 1 tests must pass
# Target: 80%+ coverage for new code
```

### Integration Tests
```bash
npm run test:integration  # Real file downloads + analysis
```

### Manual QA
- [ ] Download real PDF from web → extract text
- [ ] Download real CSV from web → detect schema
- [ ] Download 10+ real images → analyze colors
- [ ] Verify temp files created in /tmp/nomads-{sessionId}
- [ ] Verify cleanup on session end
- [ ] Test error cases (404, timeout, oversized)

### Final Checklist
- [ ] All 4 components complete
- [ ] All 5 CLI commands working
- [ ] All tests passing
- [ ] Zero TypeScript errors
- [ ] Build clean
- [ ] Dev server starts without errors
- [ ] Documentation complete

---

## NOTES & REMINDERS

1. **Always use streaming** — No memory buffering for downloads
2. **Abort signals matter** — Thread through all async operations
3. **Session cleanup is critical** — Auto-delete temp files on exit
4. **Security-first** — Validate all URLs, reject internal IPs
5. **Error messages matter** — User-friendly, actionable errors
6. **Tests first** — Write tests before implementation
7. **Documentation as you go** — Don't leave docs to the end
8. **Coordinate with P0-A** — May need to adjust if Wayfarer file endpoint differs

---

## ESTIMATED TIMELINE

Assuming P0-A complete:
- **Days 1-2**: Component 1 (downloadService) + Component 3 (csvService)
- **Days 3-4**: Component 2 (PDF enhancement) + Component 4 (image extension)
- **Days 5**: CLI commands + integration tests
- **Days 6**: Documentation + final testing
- **Days 7**: Buffer + polish

**Total: 40 hours = 1 week (5 working days)**

---

## HANDOFF & NEXT STEPS

When P0-A is complete:
1. Notify with summary of P0-A deliverables (file transfer endpoint URL, response format)
2. Begin Component 1 (downloadService) in parallel with P0-A final polish
3. Hold kickoff meeting to align on architecture before P1 full start
4. Daily sync on blockers / coordinate test data

---

**Status**: READY FOR IMPLEMENTATION (pending P0-A)
**Last Updated**: 2026-04-02
**Owned by**: Agent: File Download & Analysis Phase 1
