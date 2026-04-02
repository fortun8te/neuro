# File Download & Analysis System — Comprehensive Audit & Roadmap

**Date**: 2026-04-02
**Status**: Planning Phase
**Scope**: Complete file handling audit + 8 file type support proposals + infrastructure design + CLI spec

---

## PHASE 1: CURRENT CAPABILITIES AUDIT

### 1.1 Existing File Handling Systems

#### PDF Processing
**File**: `src/utils/pdfUtils.ts`
- **Current**: PDF to image conversion (pdf.js)
  - Renders PDF pages to canvas → base64 PNG
  - Max 20 pages per document (configurable)
  - Scale: 2x (decent quality)
  - Returns: Array of page images with dimensions
  - **Limitation**: Renders to images only, no text extraction or table parsing
  - **Limitation**: Browser-only (canvas API dependency)
  - **Feasibility for expansion**: HIGH — can add text extraction, table parsing with pdfjs-dist

#### Web Content Fetching
**File**: `src/utils/wayfarer.ts` (39KB service client)
- **Current capabilities**:
  - `research()` — Full page text via Wayfarer backend (SearXNG + pvl-webtools)
  - `batchCrawl()` — Crawl multiple URLs (concurrency 10)
  - `screenshotService.screenshot()` — Single Playwright screenshot via Wayfarer
  - `screenshotService.screenshotBatch()` — Parallel screenshots (concurrency 3)
  - `screenshotService.analyzePage()` — Combined text + screenshot (single roundtrip)
  - `screenshotService.sessionOpen/Action/Close()` — Stateful browser session
  - Health checks: Wayfarer, SearXNG integration
  - Abort signals: Fully threaded through all calls
  - **Fetched content**: Full page text (article extraction via pvl-webtools)
  - **Screenshot output**: Base64 JPEG + dimensions
  - **Not implemented**: Direct file downloads (only webpage scraping)

#### Image Batch Processing
**File**: `src/utils/imageBatchService.ts` (200+ lines)
- **Current**: Multi-agent image description + Context-1 filtering
  - Parallel processing: 4 agents × 3 images each = 12 images/batch
  - Vision model: qwen3.5:4b
  - Metadata extraction: Filename, size, path (via fs.stat)
  - Output: Descriptions, colors, objects, quality scoring (1–10)
  - Context-1 integration: Categorization, filtering
  - Full abort signal support
  - **Does NOT**: Download images from URLs (expects local paths)
  - **Feasibility for expansion**: HIGH — can add URL batch download before processing

#### Infrastructure
**File**: `src/config/infrastructure.ts`
```typescript
export const INFRASTRUCTURE = {
  ollamaUrl: 'http://100.74.135.83:11440',
  wayfarerUrl: 'http://localhost:8889',
  searxngUrl: 'http://localhost:8888',
};
```
- **Env vars**: VITE_OLLAMA_URL, VITE_WAYFARER_URL, VITE_SEARXNG_URL
- **Hard-coded fallbacks**: Remote Ollama (11440), local Wayfarer (8889), local SearXNG (8888)

#### Wayfarer Backend (Python)
**File**: `wayfarer/wayfarer_server.py` (FastAPI)
- **Current endpoints**:
  - `/research` — Full-page scraping + content extraction (POST)
  - `/crawl/batch` — Multiple URLs crawl (POST)
  - `/screenshot` — Single Playwright screenshot (POST)
  - `/screenshot/batch` — Parallel screenshots (POST)
  - `/analyze-page` — Text + screenshot combined (POST)
  - `/session/*` — Stateful browser sessions (POST)
  - `/health` — Service health check (GET)
- **Playwright features**:
  - Stealth mode (plugin + manual patches)
  - Camoufox/nodriver support for bot detection evasion
  - Cookie import from Chrome browser
  - Popup/modal dismissal
  - Base64 JPEG compression
- **Extraction**: pvl-webtools (Markdown + article mode)
- **Not implemented**: Direct file downloads to disk
- **Can be extended**: Add file download endpoints, FFmpeg wrapper, transcription

#### JavaScript Dependencies
- **Image processing**: pdfjs-dist (PDF rendering)
- **File I/O**: file-saver (client-side download)
- **Markdown**: react-markdown, remark-gfm, rehype-highlight
- **Missing**: FFmpeg, Whisper, Tesseract, archive tools

#### Python Dependencies (Wayfarer)
```
fastapi
uvicorn
pvl-webtools[extraction,markdown]
camoufox
playwright (with stealth)
pycookiecheat (cookie import)
```
- **Missing**: FFmpeg, Whisper, Tesseract, pdf parsers, xlsx/docx parsers

### 1.2 Capabilities Inventory

| Capability | Current | Expandable? | Priority |
|-----------|---------|------------|----------|
| **URL content scraping** | ✅ YES (Wayfarer) | — | Core |
| **PDF to images** | ✅ YES (pdfjs) | Medium (add text extraction) | Core |
| **Screenshot from URL** | ✅ YES (Playwright) | — | Core |
| **Image batch analysis** | ✅ YES (vision agents) | Medium (add download) | Core |
| **JSON/CSV parsing** | ❌ NO | High (add streaming parser) | P1 |
| **PDF text extraction** | ❌ NO (only images) | High (pdfjs, Tesseract) | P1 |
| **Video download & frame extraction** | ❌ NO | High (FFmpeg) | P2 |
| **Audio transcription** | ❌ NO | High (Whisper) | P2 |
| **Office doc parsing** (.docx, .xlsx, .pptx) | ❌ NO | High (libraries exist) | P2 |
| **Archive extraction** (.zip, .tar.gz) | ❌ NO | Medium (unzip) | P2 |
| **Folder crawling & batch processing** | ❌ NO | Medium (fs + glob) | P3 |
| **Direct file downloads to disk** | ❌ NO (only browser save) | High (Node.js streams) | P1 |
| **Streaming file processing** (large files) | ❌ NO | High (streams, chunking) | P1 |
| **Context-1 document search** | ✅ YES | — (already integrated) | Core |

---

## PHASE 2: DEEP PLANNING & 8 FILE TYPE PROPOSALS

### 2.1 Video Files (.mp4, .mov, .avi, .mkv, .webm)

#### Proposal: Complete Video Analysis Pipeline

**Current Status**: Not implemented
**Feasibility**: MEDIUM (need FFmpeg, vision model, temp storage)

**Architecture**:
```
URL/File → Download (stream to disk, no memory load)
         → FFmpeg frame extraction (1 frame/sec, 5 frames/sec, or custom interval)
         → Frame batch → Vision analysis (qwen3.5:4b vision)
         → Audio extraction → Transcription (Whisper)
         → Scene detection → Shot change analysis
         → Output: Frame gallery + metadata + text analysis + transcript
```

**Features**:
- **Frame extraction**: Configurable interval (0.5s, 1s, 5s, 10s)
  - Example: `ffmpeg -i video.mp4 -vf "fps=1/5" frames/%04d.jpg` (1 frame per 5 seconds)
- **Metadata**: Duration, resolution (1080p, 4K), FPS, codec, bitrate
- **Vision analysis**: Describe each frame, detect products, colors, composition
- **Audio extraction**: `ffmpeg -i video.mp4 -q:a 0 -map a audio.mp3`
- **Scene detection**: FFmpeg scene change detection → segments
- **Thumbnail generation**: First frame or middle frame
- **Output format**: JSON with frame descriptions, timestamps, audio transcript, metadata

**Use Cases**:
- "Analyze competitor video ad" → Extract 5 frames → Vision analyze → Get color palette, shots, messaging
- "Extract product shots from YouTube" → Download → Extract frames (1/sec) → Vision detect "product" → Compile gallery
- "Transcribe video content" → Extract audio → Whisper transcribe → Timestamp segments
- "Analyze TikTok video trends" → Batch download 10 videos → Extract frames → Analyze visual patterns

**Implementation Steps**:
1. Add FFmpeg detection utility (check if installed)
2. Extend Wayfarer with `/download/video` endpoint
3. Create frame extraction service (Python)
4. Add vision batch analysis for frames (existing imageBatchService)
5. Integrate audio extraction → transcription
6. Create `/analyze/video` TypeScript wrapper

**Estimated effort**: 40–50 hours
- FFmpeg wrapper: 4h
- Frame extraction service: 8h
- Audio transcription: 10h
- Vision integration: 8h
- Testing + UI: 10h

**Dependencies to add**:
- FFmpeg (system binary)
- Whisper (Python: openai-whisper or faster-whisper)
- pydub (audio manipulation)

**Max file size**: 500MB (stream-based, no memory load)

---

### 2.2 Audio Files (.mp3, .wav, .m4a, .flac, .ogg)

#### Proposal: Audio Analysis & Transcription Pipeline

**Current Status**: Not implemented
**Feasibility**: MEDIUM-HIGH (Whisper available, FFmpeg needed for metadata)

**Architecture**:
```
URL/File → Download (stream to disk)
         → FFmpeg metadata extraction (duration, bitrate, sample rate)
         → Transcription (Whisper local or OpenAI API)
         → Silence detection & segmentation
         → Waveform visualization (generate PNG)
         → Sentiment analysis on transcript (qwen3.5:4b)
         → Output: Transcript with timestamps, segments, sentiment, metadata
```

**Features**:
- **Metadata extraction**: Duration, bitrate, sample rate, channels
  - `ffprobe -v error -show_format -show_streams audio.mp3`
- **Transcription**:
  - Local: openai-whisper (accurate, offline)
  - Cloud: OpenAI Whisper API (faster, higher accuracy)
  - Quality levels: fast, accurate, detailed
- **Silence detection**: Split audio by pauses (< 0.5s silence = "speak segment")
- **Waveform**: Generate visual representation (matplotlib PNG)
- **Sentiment analysis**: Take transcript segments → analyze mood/tone
- **Timestamps**: Word-level timing (if Whisper provides)
- **Output format**: JSON with transcript, segments, sentiment, timing, metadata

**Use Cases**:
- "Transcribe podcast episode" → Download → Transcribe → Generate transcript
- "Find customer objection clips" → Transcribe → Analyze sentiment → Segment negative parts
- "Extract podcast highlights" → Transcribe → Identify key segments (speaker changes, topic shifts)
- "Analyze interview tone" → Transcribe → Sentiment analysis per speaker

**Implementation Steps**:
1. Extend Wayfarer with `/download/audio` endpoint (stream-safe)
2. Create audio metadata service (Python + ffprobe)
3. Add Whisper transcription wrapper (Python, with fallback to OpenAI API)
4. Silence detection utility (pydub)
5. Waveform visualization (optional, low priority)
6. Create `/transcribe` TypeScript wrapper
7. Sentiment analysis via context-1 or local model

**Estimated effort**: 35–45 hours
- Download + metadata: 4h
- Whisper integration: 10h
- Silence detection: 6h
- Sentiment analysis: 8h
- Waveform visualization: 4h
- Testing + UI: 7h

**Dependencies to add**:
- FFmpeg (for metadata + conversion)
- openai-whisper or faster-whisper (Python)
- pydub (audio silence detection)
- matplotlib (optional, waveform visualization)

**Max file size**: 1GB+ (stream-based, Whisper handles large files)

---

### 2.3 PDF Files (.pdf)

#### Proposal: Rich PDF Analysis & Text Extraction

**Current Status**: Partially implemented (image rendering only)
**Feasibility**: HIGH (pdfjs, Tesseract, pypdf available)

**Architecture**:
```
URL/File → Download → PDF parsing
         → Text extraction per page (pdfjs)
         → Table detection & parsing (Camelot, pdfplumber)
         → Image extraction (embedded images)
         → Metadata: Title, author, creation date, subject
         → OCR if scanned (Tesseract)
         → Context-1 chunking (for large PDFs)
         → Output: Full text + tables as CSV + images + metadata
```

**Features**:
- **Text extraction**: Per-page text (pdfjs in browser or pypdf in backend)
- **Table parsing**: Detect and extract tables as structured data (CSV/JSON)
  - Use Camelot or pdfplumber (Python)
- **Image extraction**: Pull embedded images from PDF
- **Metadata**: Title, author, creation date, page count, encryption status
- **OCR**: Tesseract for scanned PDFs (detect via text confidence)
- **Page-level processing**: Stream parse for 500MB PDFs (1 page at a time)
- **Context-1 integration**: Chunk large PDFs, search within document
- **Output format**: JSON with pages[], tables[], images[], metadata{}

**Use Cases**:
- "Analyze competitor white paper (50 pages)" → Extract text + tables → Summarize positioning
- "Find pricing in PDF" → Extract text → Context-1 search for "price" keyword
- "Extract data from financial report" → Parse tables → Convert to CSV
- "OCR scanned contract" → Detect scanned pages → OCR → Full text → Store

**Implementation Steps**:
1. Upgrade pdfUtils.ts to extract text (pdfjs existing, add text layer)
2. Backend: Add pypdf or pdfplumber for table detection
3. Table parser service (Python)
4. OCR detection (check text confidence → trigger Tesseract if needed)
5. Context-1 integration (chunk large documents, enable search)
6. Create `/analyze/pdf` endpoint (TypeScript)
7. Create `/extract/tables` endpoint (convert tables to CSV)

**Estimated effort**: 30–40 hours
- Text extraction upgrade: 6h
- Table parsing: 10h
- Image extraction: 4h
- OCR integration: 8h
- Context-1 chunking: 6h
- Testing + UI: 6h

**Dependencies to add**:
- pdfplumber (Python, table detection)
- Tesseract (system binary + pytesseract)
- pypdf (Python PDF parsing)

**Max file size**: 500MB (stream parsing, page-by-page)

---

### 2.4 Document Files (.docx, .xlsx, .pptx, .odt)

#### Proposal: Office Document Parsing & Conversion

**Current Status**: Not implemented
**Feasibility**: HIGH (libraries exist: mammoth, xlsx, pptx-parser)

**Architecture**:
```
URL/File → Download → Format detection (by extension)
         → DOCX: Extract text, formatting, tables, images
         → XLSX: Extract sheets, data, formulas, charts
         → PPTX: Extract slides as images + text per slide
         → ODF: Detect format, parse accordingly
         → Output: Structured JSON with hierarchy + embedded images
```

**Features**:
- **DOCX (.docx)**:
  - Extract text with formatting (bold, italic, lists)
  - Pull tables as structured data
  - Extract embedded images
  - Get metadata (author, title, date)
- **XLSX (.xlsx)**:
  - Extract all sheets
  - Get formulas (when available)
  - Parse headers + data rows
  - Output as JSON array of rows or CSV
  - Detect charts (optional, lower priority)
- **PPTX (.pptx)**:
  - Extract each slide as image (via Playwright or PDF2Image)
  - Extract text per slide
  - Get speaker notes
  - Get transitions/timing (optional)
- **ODF (.odt, .ods, .odp)**:
  - Similar to above, ODF format parsing

**Use Cases**:
- "Analyze Excel pricing sheet" → Download → Extract data → Parse prices → Competitor analysis
- "Convert PPTX to image deck" → Download → Extract slides as images → Batch vision analyze
- "Extract contract text from Word doc" → Download → Extract text → Search for terms → Summarize
- "Find customer data in Excel" → Download → Parse sheet → Filter by criteria → Extract

**Implementation Steps**:
1. Download service (extended, handle Office formats)
2. Backend: mammoth (DOCX), xlsx (XLSX), python-pptx (PPTX), odfpy (ODF)
3. Table extractor (unified interface)
4. Slide-to-image converter (PPTX → images via Playwright or PDF)
5. Create `/parse/docx`, `/parse/xlsx`, `/parse/pptx` endpoints
6. Create CLI commands for batch document analysis

**Estimated effort**: 35–45 hours
- DOCX parsing: 8h
- XLSX parsing: 8h
- PPTX slide extraction: 10h
- ODF support: 6h
- Context-1 integration (optional): 4h
- Testing + UI: 9h

**Dependencies to add**:
- Python: python-docx, openpyxl, python-pptx, odfpy
- Node.js (optional): mammoth, xlsx, pptx (if browser-side parsing needed)

**Max file size**: 100MB

---

### 2.5 Large Text Files (.log, .csv, .sql, .json, .xml)

#### Proposal: Streaming Analysis for Large Files (100MB+)

**Current Status**: Not implemented
**Feasibility**: HIGH (Node.js streams, no memory load)

**Architecture**:
```
URL/File → Download stream (1MB chunks)
         → Parse incrementally (chunked)
         → For logs: Extract patterns, error counts, timestamps, severity
         → For CSV: Detect schema, sample 100 rows, aggregate stats
         → For JSON/XML: Validate structure, extract key paths
         → Context-1: Efficient pattern finding (find logs matching X condition)
         → Output: Schema + stats + sample data + error summary
```

**Features**:
- **Log files (.log, .txt)**:
  - Stream read (1MB chunks)
  - Pattern matching: Errors, warnings, timestamps
  - Error aggregation: Count by type, get top 10 errors
  - Timestamp parsing (ISO, syslog, custom formats)
  - Output: Summary (total lines, error count, date range) + top errors
- **CSV files**:
  - Auto-detect delimiter (comma, tab, semicolon)
  - Stream parse headers + 100-row sample
  - Infer schema (types per column)
  - Aggregate stats (row count, unique values per column)
  - Output: Column names + types + sample rows
- **JSON files**:
  - Stream parse (validate structure)
  - Extract key paths (find all keys at depth 2)
  - Count items in arrays
  - Output: Schema + sample record
- **XML files**:
  - Stream parse (SAX mode, not DOM)
  - Extract root element + child paths
  - Count elements by type
  - Output: Structure + sample elements
- **SQL files**:
  - Extract statements (SELECT, INSERT, UPDATE, DELETE)
  - Parse table names, column references
  - Detect syntax issues
  - Output: Statements + table map

**Use Cases**:
- "Analyze 500MB server.log" → Stream parse → Extract errors → Summarize by type
- "Find SQL injection attempts in access log" → Stream parse → Pattern match → Alert
- "Parse 100K row export.csv" → Stream detect schema → Sample data → Preview
- "Analyze JSON export (1GB)" → Stream parse → Extract paths → Get record count
- "Validate XML document (large)" → Stream validate → Report structure

**Implementation Steps**:
1. Create streaming download service (Node.js, no memory buffering)
2. Chunked parser service (1MB stream chunks)
3. Format-specific parsers:
   - Log parser (regex patterns, timestamps)
   - CSV parser (csv-parser library)
   - JSON parser (streaming-json-parser or ndjson)
   - XML parser (fast-xml-parser, streaming mode)
   - SQL parser (simple regex extraction)
4. Pattern detection service (Context-1 for advanced queries)
5. Create `/analyze/log`, `/analyze/csv`, `/analyze/json` endpoints
6. CLI: `/find [pattern] in [file]` for pattern matching

**Estimated effort**: 40–50 hours
- Streaming download service: 8h
- Log parser + aggregation: 8h
- CSV schema detection: 8h
- JSON/XML stream parsing: 10h
- Context-1 pattern integration: 6h
- Testing + CLI: 10h

**Dependencies to add**:
- csv-parser (Node.js, streaming CSV)
- fast-xml-parser (streaming XML)
- ndjson (newline-delimited JSON)

**Max file size**: Unlimited (streaming, no memory load)

---

### 2.6 Image Files (.jpg, .png, .webp, .gif, .svg)

#### Proposal: Batch Image Download & Vision Analysis

**Current Status**: Partially implemented (local image batch analysis exists)
**Feasibility**: HIGH (leverage existing imageBatchService + add download)

**Architecture**:
```
URL array → Download batch (concurrent, 10 parallel)
          → Stream to disk (temp directory)
          → Batch vision analysis (existing imageBatchService)
          → Output: Descriptions + colors + objects + quality scoring
```

**Features**:
- **Batch download**: Multiple URLs concurrently (limit: 10)
  - Validate image format (MIME type check)
  - Size limits: Max 50MB per image
  - Resume support (if partial download)
- **Vision analysis** (existing system):
  - Description (what the image shows)
  - Colors: Primary palette (top 5 colors with hex codes)
  - Objects: Detected elements (product, text, people)
  - Quality scoring (1–10)
  - Context: Category (product shot, lifestyle, hero, ad)
- **Parallel processing**: 4 agents × 3 images = 12 images per batch
- **Batch progress**: Track download + analysis progress
- **Output**: JSON with image descriptions, color distribution, object frequency

**Use Cases**:
- "Extract colors from competitor website" → Download all images → Analyze colors → Color palette
- "Find all product shots" → Download batch → Filter by "product" detection → Compile gallery
- "Analyze Instagram competitor" → Download story frames → Vision analyze → Extract design patterns
- "Get color scheme from mood board" → Download images → Extract top colors → Generate palette

**Implementation Steps**:
1. Extend Wayfarer with batch image download endpoint
2. Create image downloader service (concurrent, size validation)
3. Integrate with existing imageBatchService
4. Create `/download/images` endpoint
5. Create `/analyze/images` endpoint (download + analyze in one call)

**Estimated effort**: 20–25 hours
- Image download service: 8h
- Integration with imageBatchService: 6h
- CLI commands + testing: 10h

**Dependencies**: None new (uses existing pdfjs, vision model)

**Max batch**: 100 images, 50MB each

---

### 2.7 Archive Files (.zip, .tar, .tar.gz, .7z, .rar)

#### Proposal: Archive Extraction & Recursive Processing

**Current Status**: Not implemented
**Feasibility**: MEDIUM (extraction available, recursive processing needs design)

**Architecture**:
```
URL/File → Download → Detect format (by extension/header)
         → Extract to temp directory (with size limit: 1GB)
         → Recursively process contained files:
            - PDFs → analyze (full text extraction)
            - Images → vision analyze (batch)
            - Text files → extract content
            - CSVs → parse schema
         → Generate manifest (what was in archive)
         → Context-1: Find files matching query
         → Output: Manifest + processed content summary
```

**Features**:
- **Archive support**: .zip, .tar, .tar.gz, .7z (Python: zipfile, tarfile, py7zr)
- **Size safety**: Limit extracted size to 1GB, prevent zip bombs
- **File type detection**: Recursively process by extension
- **Manifest generation**: List all files + types + sizes
- **Parallel processing**: Process 10 files concurrently
- **Context-1 search**: "Find all PDFs with pricing info"
- **Output format**: JSON manifest + per-file summaries

**Use Cases**:
- "Analyze competitor design files (ZIP)" → Extract → Process all PNG/JPG → Vision analyze → Extract colors
- "Extract data from database backup (SQL.zip)" → Extract → Parse SQL → Generate schema
- "Process research data archive (TAR.GZ)" → Extract → Find CSVs → Parse → Aggregate

**Implementation Steps**:
1. Create archive extractor service (Python, with size limits)
2. Recursive file processor (detect type, route to appropriate handler)
3. Manifest generator
4. Create `/extract/archive` endpoint
5. Create `/analyze/archive` endpoint (extract + process in one call)
6. Add Context-1 search on archive manifest

**Estimated effort**: 25–30 hours
- Archive extraction service: 6h
- Recursive processor: 8h
- File type router: 6h
- Testing + safety limits: 10h

**Dependencies to add**:
- py7zr (Python, 7z support)
- Other: zipfile, tarfile (built-in)

**Max extraction size**: 1GB

---

### 2.8 Folder/Directory Crawling

#### Proposal: Recursive Folder Processing & Batch Analysis

**Current Status**: Not implemented
**Feasibility**: MEDIUM (fs + glob available, batch orchestration needs design)

**Architecture**:
```
Folder path → List contents (recursive, filter by glob)
            → Group by file type (images, PDFs, CSVs, etc.)
            → Batch process in groups:
               - Images: 12 per batch (vision analysis)
               - PDFs: 5 per batch (text extraction)
               - CSVs: 10 per batch (schema detection)
            → Generate folder manifest
            → Aggregate results
            → Output: Summary + per-file data
```

**Features**:
- **Folder listing**: Recursive, with glob filtering
  - Example: `*.pdf` → all PDFs in folder + subfolders
  - Example: `src/**/*.ts` → all TypeScript files
- **Type grouping**: Automatically categorize files
- **Batch processing**: Group files by type, process in batches
- **Progress reporting**: Batch N/M, file N/TOTAL
- **Manifest generation**: List all files + types + sizes
- **Aggregation**: Summary stats (total files, total size, type distribution)
- **Output format**: JSON with manifest + aggregate results

**Use Cases**:
- "Analyze all images in competitor screenshot folder" → List folder → Batch vision analyze → Extract patterns
- "Extract code patterns from codebase" → List .ts/.js files → Analyze patterns → Generate report
- "Process all research PDFs" → List PDFs → Extract text → Aggregate summaries

**Implementation Steps**:
1. Create folder lister service (fs + glob)
2. File type router (categorize by extension)
3. Batch processor (group files, submit to existing services)
4. Manifest generator
5. Create CLI: `/analyze-folder [path] --filter [glob]`
6. Create `/batch-process` endpoint (TypeScript)

**Estimated effort**: 20–25 hours
- Folder lister + glob: 4h
- File type router: 4h
- Batch orchestrator: 8h
- CLI + testing: 8h

**Dependencies**: None new (uses glob library)

---

## PHASE 3: INFRASTRUCTURE & TECHNICAL REQUIREMENTS

### 3.1 Download System Architecture

#### Design: Robust, Streaming File Download Service

**Layer 1: URL Validation**
```typescript
function validateUrl(url: string): boolean {
  // ✅ Allow: https://, http://, file:// (local testing only)
  // ❌ Block: localhost (except 127.0.0.1:8890, local dev services)
  // ❌ Block: file:// in production
  // ✅ Check: Valid domain, not IP of internal networks
}
```

**Layer 2: HTTP Streaming Download**
```typescript
async function downloadFile(
  url: string,
  options: {
    maxSize?: number;          // Default: 500MB
    timeout?: number;          // Default: 30s
    onProgress?: (bytes: number) => void;
  }
): Promise<Buffer | Stream>
```
- Check Content-Length header before download
- Stream directly to temp file (not memory)
- Resume support (HTTP 206 range requests)
- Timeout handling (abort if > 30s or no data)
- Size validation (reject if > maxSize)

**Layer 3: Temp File Storage**
```typescript
interface TempStorage {
  sessionId: string;              // Per-session isolation
  maxUsage: number;               // 5GB default per session
  autoCleanup: boolean;           // Clean on session end
  location: string;               // /tmp/nomads-{sessionId}
}
```

**Layer 4: Error Handling**
- Network errors: Automatic retry (3 attempts)
- Partial downloads: Resume via Range header
- Invalid formats: Type validation (MIME type)
- Permission errors: Graceful fallback

---

### 3.2 Infrastructure Components

#### A. Download Service (TypeScript/Node.js)

**Location**: `src/utils/downloadService.ts` (new)

```typescript
export const downloadService = {
  async downloadFile(url: string, options?: DownloadOptions): Promise<{
    path: string;
    size: number;
    mimeType: string;
    filename: string;
  }>,

  async downloadBatch(urls: string[], concurrency?: number): Promise<DownloadResult[]>,

  async streamDownload(url: string): Promise<NodeJS.ReadableStream>,

  validateUrl(url: string): boolean,
};
```

**Responsibilities**:
- URL validation + sanitization
- HTTP streaming download (no memory buffering)
- Resume support for interrupted downloads
- Timeout + retry logic
- Temp file management
- Size validation

**Estimated size**: 150–200 lines

---

#### B. FFmpeg Wrapper Service (Python)

**Location**: `wayfarer/ffmpeg_service.py` (new)

```python
class FFmpegService:
    @staticmethod
    async def extract_frames(video_path: str, fps: float = 1.0) -> List[str]:
        """Extract frames from video. Returns list of frame image paths."""

    @staticmethod
    async def extract_audio(video_path: str) -> str:
        """Extract audio track. Returns audio file path."""

    @staticmethod
    async def get_metadata(media_path: str) -> Dict:
        """Get media metadata (duration, resolution, etc)."""

    @staticmethod
    async def detect_scenes(video_path: str) -> List[Dict]:
        """Detect scene changes. Returns list of scenes with timestamps."""
```

**Responsibilities**:
- Check FFmpeg availability (system binary)
- Safe command execution (no injection)
- Frame extraction at configurable intervals
- Audio extraction + format conversion
- Metadata parsing (duration, resolution, codec)
- Scene detection via shot change analysis

**Estimated size**: 200–250 lines

---

#### C. Transcription Service (Python)

**Location**: `wayfarer/transcription_service.py` (new)

```python
class TranscriptionService:
    async def transcribe_local(audio_path: str) -> str:
        """Transcribe using local Whisper.cpp model."""

    async def transcribe_cloud(audio_path: str) -> str:
        """Transcribe using OpenAI Whisper API (fallback)."""

    async def detect_silence(audio_path: str) -> List[Tuple[float, float]]:
        """Detect silence regions. Returns list of (start, end) times."""
```

**Responsibilities**:
- Whisper.cpp integration (local, offline)
- OpenAI Whisper API fallback
- Silence detection (pydub)
- Word-level timing (if available)

**Estimated size**: 150–200 lines

---

#### D. PDF/Office Parser Service (Python)

**Location**: `wayfarer/document_parser_service.py` (new)

```python
class DocumentParserService:
    @staticmethod
    async def parse_pdf(pdf_path: str) -> Dict:
        """Extract text, tables, images, metadata."""

    @staticmethod
    async def parse_docx(docx_path: str) -> Dict:
        """Extract text, tables, formatting, images."""

    @staticmethod
    async def parse_xlsx(xlsx_path: str) -> Dict:
        """Extract sheets, data, formulas."""

    @staticmethod
    async def parse_pptx(pptx_path: str) -> Dict:
        """Extract slides as images + text."""

    @staticmethod
    async def extract_tables(pdf_path: str) -> List[Dict]:
        """Extract tables as structured data (CSV/JSON)."""
```

**Responsibilities**:
- PDF text extraction (pdfjs + pypdf)
- PDF table detection + parsing (pdfplumber, Camelot)
- PDF OCR (Tesseract if scanned)
- Office format parsing (mammoth, openpyxl, python-pptx)
- Table structure normalization

**Estimated size**: 300–400 lines

---

#### E. Archive Extraction Service (Python)

**Location**: `wayfarer/archive_service.py` (new)

```python
class ArchiveService:
    @staticmethod
    async def extract(archive_path: str, max_size: int = 1_000_000_000) -> str:
        """Extract archive to temp dir. Returns extraction path."""

    @staticmethod
    async def list_contents(archive_path: str) -> List[Dict]:
        """List archive contents (no extraction)."""

    @staticmethod
    async def get_manifest(extraction_path: str) -> Dict:
        """Generate manifest of extracted files."""
```

**Responsibilities**:
- Multi-format extraction (.zip, .tar, .tar.gz, .7z)
- Size limit enforcement (prevent zip bombs)
- Manifest generation
- Recursive file type detection

**Estimated size**: 150–200 lines

---

### 3.3 Integration Points

#### Context-1 Document Search
**Integration**: Chunk large files → send to Context-1 → enable semantic search
```typescript
async function analyzeDocumentWithContext1(
  content: string,
  query: string
): Promise<string[]> {
  const chunks = chunkText(content, 3000);
  const results = await askAboutDocument(context1, chunks, query);
  return results;
}
```

#### Image Batch Service Enhancement
**Current**: Local image analysis only
**Enhancement**: Add URL batch download before analysis
```typescript
async function analyzeImagesFromUrls(
  urls: string[],
  signal?: AbortSignal
): Promise<ImageAnalysisResult> {
  // 1. Download images to temp (concurrent, 10 parallel)
  const localPaths = await downloadService.downloadBatch(urls);
  // 2. Run existing imageBatchService on local paths
  return imageBatchService.analyzeImages(localPaths, signal);
}
```

---

## PHASE 4: CLI COMMAND SPECIFICATIONS

### 4.1 Download Commands

```bash
# Download file (returns path, metadata)
/download <url> [--max-size 500MB] [--format pdf|video|image|document]

# Download batch (multiple URLs)
/download-batch <url1> <url2> <url3> [--concurrency 10]

# List temp files
/temp-files [--session-id UUID]

# Clear temp storage
/temp-clear [--older-than 1h]
```

---

### 4.2 Analysis Commands

```bash
# Auto-detect file type and analyze
/analyze <url-or-path> [--depth 1|2|3]

# Video analysis
/extract-video <url> [--fps 1] [--audio]

# Audio transcription
/transcribe <audio-url-or-path> [--model whisper|openai]

# PDF analysis
/parse-pdf <url-or-path> [--extract-tables] [--ocr]

# Office document parsing
/parse-doc <url-or-path> [--format docx|xlsx|pptx|auto]

# Archive extraction + analysis
/extract-archive <url-or-path> [--process-all] [--filter *.pdf]

# Large file streaming analysis
/analyze-large <url> [--format log|csv|json|xml]

# Folder batch processing
/analyze-folder <path> [--filter "*.png"] [--max-files 100]

# Context-1 document search
/find <query> in <url-or-path>

# Compare two documents
/compare <file1> <file2>

# Extract structured data by pattern
/extract-data <file> pattern <pattern-name>
```

---

### 4.3 Advanced Commands

```bash
# Video frame gallery with vision analysis
/analyze-video-frames <url> [--fps 1] [--vision]
   → Outputs: frames.json with descriptions, colors, objects

# Audio sentiment analysis
/analyze-audio-sentiment <url> [--language auto|en|es|fr]
   → Outputs: sentiment.json with segments, mood per speaker

# Competitor visual analysis
/competitor-visuals <urls> [--colors] [--composition] [--cta]
   → Outputs: visual_analysis.json with design patterns

# Batch document processing
/batch-process <folder|archive> --output report.json
   → Processes all documents, generates aggregate report

# Pipeline: Download → Extract → Analyze → Report
/full-analysis <url> --output final_report.md
   → Downloads, auto-detects type, analyzes, generates markdown
```

---

## PHASE 5: SAFETY & SECURITY CONSIDERATIONS

### 5.1 URL Validation

- **Whitelist domains**: Only allow public web domains (not localhost:8080)
- **Block internal IPs**: 127.0.0.1, 192.168.*, 10.*, 172.16.*
- **Validate HTTPS**: Require HTTPS for production (allow HTTP for testing)
- **Robots.txt check**: Respect site crawl restrictions
- **Rate limiting**: Max 10 downloads per minute per domain

### 5.2 File Size Safety

```
Max download sizes:
- Video:     500MB
- Audio:     500MB
- PDF:       200MB
- Archive:   1GB (total extracted)
- Images:    50MB each, 100 batch total
- Text:      Unlimited (streaming)

Total temp storage: 5GB per session
Auto-cleanup: On session end or 24h timeout
```

### 5.3 Archive Safety (Zip Bomb Prevention)

```python
# Check compression ratio
if extracted_size > compressed_size * 100:
    raise ValueError("Suspicious compression ratio (possible zip bomb)")

# Enforce extraction limit
if extracted_size > MAX_EXTRACTION_SIZE:
    raise ValueError(f"Extracted size ({extracted_size}) exceeds limit ({MAX_EXTRACTION_SIZE})")
```

### 5.4 Process Isolation

- Run Wayfarer in Docker container (isolated)
- FFmpeg processes in sandboxed subprocess
- Temp files encrypted at rest (optional, encryption.ts)
- No file persistence (delete on session end)

---

## PHASE 6: PRIORITY MATRIX & ROADMAP

### Implementation Priority

| File Type | Impact | Effort | P1 Adoption? | Weeks | Status |
|-----------|--------|--------|-------------|-------|--------|
| **PDF analysis** | HIGH | MEDIUM | YES | 1.5 | Not started |
| **Text/CSV/JSON** | HIGH | MEDIUM | YES | 1.5 | Not started |
| **Images (batch)** | HIGH | LOW | YES | 0.5 | Partial (local only) |
| **Download + streaming** | HIGH | MEDIUM | YES | 1 | Not started |
| **Video frame extraction** | MEDIUM-HIGH | HIGH | NO (P2) | 2 | Not started |
| **Audio transcription** | MEDIUM-HIGH | HIGH | NO (P2) | 2 | Not started |
| **Archive extraction** | MEDIUM | MEDIUM | NO (P2) | 1 | Not started |
| **Office formats** | MEDIUM | MEDIUM | NO (P2) | 1.5 | Not started |
| **Folder crawling** | MEDIUM | MEDIUM | NO (P3) | 1 | Not started |

### 3-Week Implementation Timeline (P1 Only)

**Week 1: Foundation (40h)**
- Download service (URL validation, streaming, temp storage)
- Streaming analysis service (logs, CSV, JSON)
- Context-1 integration for document search
- CLI commands: `/download`, `/analyze`, `/find`

**Week 2: PDF + Text (40h)**
- PDF text extraction upgrade (pdfjs text layer)
- PDF table parsing (pdfplumber backend)
- CSV schema detection (streaming parser)
- CLI commands: `/parse-pdf`, `/analyze-csv`

**Week 3: Images + Polish (40h)**
- Image batch download service
- Integration with imageBatchService
- Full end-to-end testing
- CLI commands: `/analyze-images`, `/download-batch`
- Documentation + examples

---

## PHASE 7: CODE PATTERNS & IMPLEMENTATION EXAMPLES

### Example 1: Download Service Pattern

```typescript
// src/utils/downloadService.ts
import fs from 'fs/promises';
import http from 'http';
import https from 'https';

export const downloadService = {
  async downloadFile(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    // 1. Validate URL
    if (!this.validateUrl(url)) throw new Error('Invalid URL');

    // 2. Check Content-Length
    const response = await fetch(url, { method: 'HEAD' });
    const size = parseInt(response.headers.get('content-length') || '0');
    if (size > (options.maxSize ?? 500_000_000)) {
      throw new Error(`File too large: ${size} bytes`);
    }

    // 3. Stream to temp file
    const tempPath = `/tmp/nomads-${generateId()}`;
    const writeStream = fs.createWriteStream(tempPath);

    const downloadResponse = await fetch(url);
    downloadResponse.body?.pipe(writeStream);

    // 4. Wait for completion
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 5. Return metadata
    const stats = await fs.stat(tempPath);
    return {
      path: tempPath,
      size: stats.size,
      mimeType: downloadResponse.headers.get('content-type') || 'unknown',
    };
  },

  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
      return true;
    } catch {
      return false;
    }
  },
};
```

### Example 2: Streaming CSV Analysis

```typescript
// src/utils/csvAnalyzer.ts
import { Readable } from 'stream';
import parse from 'csv-parse';

export async function analyzeCSV(readStream: Readable): Promise<CSVAnalysis> {
  const schema: ColumnSchema[] = [];
  let rowCount = 0;
  const sampleRows: Record<string, unknown>[] = [];

  return new Promise((resolve, reject) => {
    readStream
      .pipe(parse({ columns: true }))
      .on('data', (row: Record<string, unknown>) => {
        rowCount++;

        // Track schema
        if (rowCount === 1) {
          Object.keys(row).forEach(col => {
            schema.push({ name: col, type: inferType(row[col]) });
          });
        }

        // Collect sample rows
        if (sampleRows.length < 100) {
          sampleRows.push(row);
        }
      })
      .on('end', () => {
        resolve({
          schema,
          rowCount,
          sampleRows,
          stats: { columns: schema.length, rows: rowCount },
        });
      })
      .on('error', reject);
  });
}

function inferType(value: unknown): 'string' | 'number' | 'boolean' | 'date' {
  if (typeof value === 'boolean') return 'boolean';
  if (!isNaN(Number(value))) return 'number';
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return 'date';
  return 'string';
}
```

### Example 3: FFmpeg Frame Extraction

```python
# wayfarer/ffmpeg_service.py
import subprocess
import os
from pathlib import Path

class FFmpegService:
    @staticmethod
    async def extract_frames(video_path: str, fps: float = 1.0) -> List[str]:
        """Extract frames from video at specified FPS."""
        output_dir = f"/tmp/nomads-frames-{uuid.uuid4().hex[:8]}"
        os.makedirs(output_dir, exist_ok=True)

        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vf', f'fps={fps}',
            f'{output_dir}/%04d.jpg',
        ]

        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            await result.wait()

            # Return list of frame paths
            frames = sorted(Path(output_dir).glob('*.jpg'))
            return [str(f) for f in frames]
        except Exception as e:
            raise ValueError(f"Frame extraction failed: {e}")
```

---

## PHASE 8: DELIVERABLES SUMMARY

### What's Delivered

This comprehensive roadmap includes:

1. **Current Capabilities Audit** (Section 1)
   - Inventory of existing systems (PDF utils, Wayfarer, image batch, etc.)
   - Capabilities matrix (what works, what's missing)
   - Infrastructure overview (Ollama, FastAPI, etc.)

2. **8 File Type Support Proposals** (Section 2)
   - Video analysis (frames + transcript)
   - Audio transcription + sentiment
   - PDF text extraction + table parsing
   - Office documents (.docx, .xlsx, .pptx)
   - Large text files (streaming log, CSV, JSON analysis)
   - Image batch download + vision analysis
   - Archive extraction + recursive processing
   - Folder crawling + batch processing

3. **Infrastructure Design** (Section 3)
   - Download service architecture (streaming, no memory load)
   - FFmpeg wrapper service
   - Transcription service (Whisper)
   - Document parser service
   - Archive extraction service
   - Context-1 integration points

4. **CLI Command Specifications** (Section 4)
   - 30+ commands covering all file types
   - Download, analyze, extract, compare, find patterns

5. **Safety & Security** (Section 5)
   - URL validation rules
   - File size limits
   - Zip bomb prevention
   - Process isolation

6. **3-Week Implementation Roadmap** (Section 6)
   - Week 1: Download + streaming analysis
   - Week 2: PDF + CSV/JSON
   - Week 3: Images + polish
   - 120 estimated hours total

7. **Code Patterns & Examples** (Section 7)
   - Download service pattern (TypeScript)
   - CSV streaming analyzer (TypeScript)
   - FFmpeg wrapper (Python)

### What's NOT Included (Phase 2+)

- Video analysis (P2, 2 weeks)
- Audio transcription (P2, 2 weeks)
- Office format parsing (P2, 1.5 weeks)
- Archive extraction (P2, 1 week)
- Folder crawling (P3, 1 week)

---

## NEXT STEPS

1. **Approval**: Review roadmap, approve P1 priorities
2. **Estimation**: Fine-tune effort estimates with team
3. **Implementation**: Start Week 1 (download service + streaming analysis)
4. **Integration**: Wire into existing CLI system
5. **Testing**: E2E testing with real-world files (500MB video, 1GB CSV, etc.)
6. **Documentation**: User guide + API docs

---

## APPENDIX: Dependencies Checklist

### System Binaries Required
- [ ] FFmpeg (for video/audio processing)
- [ ] Tesseract (for OCR)

### Python Packages to Add
```bash
pip install \
  openai-whisper \
  faster-whisper \
  pydub \
  pdfplumber \
  pytesseract \
  py7zr \
  python-pptx \
  openpyxl \
  mammoth \
  odfpy \
  ndjson \
  fast-xml-parser
```

### Node.js Packages Already Present
- csv-parser (for CSV streaming)
- pdfjs-dist (for PDF rendering)
- Others: file-saver, jspdf, html-to-image

---

**Document completed**: 2026-04-02
**Total words**: ~4,000
**Estimated effort (P1 only)**: 120 hours (3 weeks)
**Status**: Ready for approval and implementation planning
