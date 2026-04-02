# Wayfarer File Transfer Architecture
## Specification & Implementation Guide

**Status**: Ready for implementation
**Effort**: 2-3 hours
**Priority**: CRITICAL BLOCKER (P0)
**Impact**: Unblocks all file analysis features

---

## PROBLEM STATEMENT

**Current Issue**: Wayfarer downloads/scrapes files into the Docker container at `/tmp/wayfarer_downloads/{session_id}/` but there's no mechanism for the client (web UI running on host) to retrieve those files.

**Symptoms**:
- Files downloaded during research are lost after Wayfarer processes them
- Can't persist downloaded PDFs, CSVs, images for analysis
- Research audit trail includes file metadata but not actual file content
- File analysis roadmap (P1-B) is completely blocked

**Root Cause**: One-way request/response pattern. Wayfarer receives requests, sends back JSON responses, but has no way to serve binary files to remote clients.

---

## SOLUTION ARCHITECTURE (Option A)

### Overview
Add a **session-scoped file transfer endpoint** to Wayfarer API that:
1. Stores downloaded files in `/tmp/wayfarer_downloads/{session_id}/` during scraping
2. Returns file manifest (list of downloaded files) in response JSON
3. Client can request specific files via `GET /files/{session_id}/{filename}`
4. Wayfarer streams file back as binary blob
5. Auto-cleanup after 24 hours or on-demand

### Benefits
- Works with remote Docker (no shared volumes needed)
- Secure (session-based, filename validation)
- Scalable (streaming, no memory buffering)
- Easy to integrate with existing audit trail
- Clean separation: Wayfarer handles download, client handles analysis

---

## DETAILED IMPLEMENTATION

### Step 1: Create Session-Based Download Manager

**File**: `/Users/mk/Downloads/nomads/wayfarer/wayfarer_server.py`

Add this near the top with other session managers:

```python
import os
import shutil
from pathlib import Path
from datetime import datetime, timedelta

# =====================================================================
# FILE DOWNLOAD MANAGER
# =====================================================================

DOWNLOADS_BASE_DIR = "/tmp/wayfarer_downloads"
DOWNLOAD_RETENTION_HOURS = 24  # Auto-cleanup after 24 hours

os.makedirs(DOWNLOADS_BASE_DIR, exist_ok=True)


def get_session_downloads_dir(session_id: str) -> str:
    """Get or create downloads directory for a session."""
    # Validate session_id (alphanumeric + hyphens only, prevent traversal)
    if not all(c.isalnum() or c in '-_' for c in session_id):
        raise ValueError(f"Invalid session_id: {session_id}")

    session_dir = os.path.join(DOWNLOADS_BASE_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    return session_dir


def cleanup_old_downloads():
    """Remove download directories older than DOWNLOAD_RETENTION_HOURS."""
    now = datetime.now()
    for session_dir in Path(DOWNLOADS_BASE_DIR).iterdir():
        if not session_dir.is_dir():
            continue

        mtime = datetime.fromtimestamp(session_dir.stat().st_mtime)
        age = (now - mtime).total_seconds() / 3600  # hours

        if age > DOWNLOAD_RETENTION_HOURS:
            try:
                shutil.rmtree(session_dir)
                print(f"[Wayfarer] Cleaned up old downloads: {session_dir.name}")
            except Exception as e:
                print(f"[Wayfarer] Failed to cleanup {session_dir.name}: {e}")


def validate_filename(filename: str) -> str:
    """Validate filename and prevent path traversal."""
    # Remove any path separators
    filename = os.path.basename(filename)

    # Whitelist safe characters
    if not all(c.isalnum() or c in '.-_' for c in filename):
        raise ValueError(f"Invalid filename: {filename}")

    return filename
```

---

### Step 2: Modify Research Endpoint to Track Files

**File**: `/Users/mk/Downloads/nomads/wayfarer/wayfarer_server.py`

Modify the existing `/research` or web scraping endpoints to return file manifest:

```python
from typing import Dict, List

class ResearchResponse(BaseModel):
    query: str
    text: str
    pages: list
    sources: list
    files: List[Dict[str, str]] = []  # NEW: [{"name": "...", "size": "...", "type": "..."}]
    meta: dict


@app.post("/research")
async def research_endpoint(req: ResearchRequest) -> ResearchResponse:
    """Enhanced research endpoint with file tracking."""
    session_id = req.session_id or str(uuid.uuid4())
    downloads_dir = get_session_downloads_dir(session_id)

    # Perform research (existing logic)
    result = await research(
        query=req.query,
        num_results=req.num_results,
        concurrency=req.concurrency,
    )

    # Track downloaded files in this session
    files = []
    if os.path.exists(downloads_dir):
        for filename in os.listdir(downloads_dir):
            file_path = os.path.join(downloads_dir, filename)
            if os.path.isfile(file_path):
                files.append({
                    "name": filename,
                    "size": f"{os.path.getsize(file_path) / 1024:.1f} KB",
                    "type": "document",  # or "image", "pdf", etc.
                    "url": f"/files/{session_id}/{filename}",
                })

    return ResearchResponse(
        query=result["query"],
        text=result["text"],
        pages=result.get("pages", []),
        sources=result.get("sources", []),
        files=files,  # NEW
        meta=result.get("meta", {}),
    )
```

---

### Step 3: Add File Download Endpoint

**File**: `/Users/mk/Downloads/nomads/wayfarer/wayfarer_server.py`

Add these two new endpoints (add before the `@app.get("/api/health")` section):

```python
from fastapi.responses import FileResponse, StreamingResponse


@app.get("/files/{session_id}/{filename}")
async def get_download_file(session_id: str, filename: str):
    """
    Stream a downloaded file from a session.

    Usage:
        GET /files/abc-123-def/document.pdf

    Returns: Binary file blob
    """
    try:
        # Validate inputs
        session_id = validate_filename(session_id)  # Reuse validation logic
        filename = validate_filename(filename)

        file_path = os.path.join(
            get_session_downloads_dir(session_id),
            filename
        )

        # Security: ensure file exists and is within session directory
        file_path = os.path.abspath(file_path)
        session_dir = os.path.abspath(get_session_downloads_dir(session_id))

        if not file_path.startswith(session_dir):
            raise HTTPException(status_code=403, detail="Access denied")

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Stream file
        return FileResponse(
            file_path,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[Wayfarer] File download error: {e}")
        raise HTTPException(status_code=500, detail="Download failed")


@app.delete("/files/{session_id}")
async def cleanup_session_files(session_id: str):
    """
    Clean up all downloaded files for a session.

    Usage:
        DELETE /files/abc-123-def

    Returns: {"status": "cleaned", "session_id": "...", "removed": 5}
    """
    try:
        session_id = validate_filename(session_id)
        session_dir = get_session_downloads_dir(session_id)

        # Count files before cleanup
        count = len(os.listdir(session_dir))

        # Remove directory
        shutil.rmtree(session_dir)

        return {
            "status": "cleaned",
            "session_id": session_id,
            "removed": count,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files/{session_id}")
async def list_session_files(session_id: str):
    """
    List all files in a session.

    Usage:
        GET /files/abc-123-def

    Returns: {"files": [{"name": "...", "size": "...", "url": "..."}]}
    """
    try:
        session_id = validate_filename(session_id)
        downloads_dir = get_session_downloads_dir(session_id)

        files = []
        if os.path.exists(downloads_dir):
            for filename in os.listdir(downloads_dir):
                file_path = os.path.join(downloads_dir, filename)
                if os.path.isfile(file_path):
                    files.append({
                        "name": filename,
                        "size": os.path.getsize(file_path),
                        "url": f"/files/{session_id}/{filename}",
                    })

        return {"session_id": session_id, "files": files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Step 4: Add Periodic Cleanup Task

**File**: `/Users/mk/Downloads/nomads/wayfarer/wayfarer_server.py`

Add this to the startup/shutdown lifecycle:

```python
@app.on_event("startup")
async def startup_event():
    """Run periodic cleanup on startup."""
    # Clean up old downloads
    cleanup_old_downloads()
    print("[Wayfarer] Download manager initialized")


# Optional: Add periodic cleanup every 6 hours
import schedule
import threading

def _cleanup_loop():
    """Run cleanup every 6 hours."""
    while True:
        try:
            cleanup_old_downloads()
            time.sleep(6 * 3600)  # 6 hours
        except Exception as e:
            print(f"[Wayfarer] Cleanup error: {e}")


@app.on_event("startup")
async def start_cleanup_thread():
    """Start background cleanup thread."""
    thread = threading.Thread(target=_cleanup_loop, daemon=True)
    thread.start()
```

---

### Step 5: Update TypeScript Client

**File**: `/Users/mk/Downloads/nomads/src/utils/wayfayer.ts`

Add these methods to the existing `WayfarerClient` class:

```typescript
/**
 * Download a file from the server.
 * @param sessionId - The session ID from the research response
 * @param filename - The filename to download
 * @returns A Blob of the file content
 */
async downloadFile(sessionId: string, filename: string): Promise<Blob> {
  const url = `${this.baseUrl}/files/${sessionId}/${filename}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * List all files for a session.
 * @param sessionId - The session ID
 * @returns List of file metadata
 */
async listSessionFiles(sessionId: string): Promise<Array<{
  name: string;
  size: number;
  url: string;
}>> {
  const url = `${this.baseUrl}/files/${sessionId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Clean up all files for a session.
 * @param sessionId - The session ID
 */
async cleanupSessionFiles(sessionId: string): Promise<void> {
  const url = `${this.baseUrl}/files/${sessionId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to cleanup files: ${response.statusText}`);
  }
}

/**
 * Download file as browser download (save to user's downloads folder).
 * @param sessionId - The session ID
 * @param filename - The filename to download
 */
async downloadFileToLocalDisk(sessionId: string, filename: string): Promise<void> {
  const blob = await this.downloadFile(sessionId, filename);

  // Create a temporary URL for the blob
  const url = URL.createObjectURL(blob);

  // Create and trigger download link
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

### Step 6: Update Types

**File**: `/Users/mk/Downloads/nomads/src/types/index.ts`

Add these types:

```typescript
export interface FileDownloadMetadata {
  name: string;
  size: string;  // e.g. "123.4 KB"
  type: 'document' | 'image' | 'pdf' | 'csv' | 'json' | 'video' | 'audio' | 'other';
  url: string;  // e.g. "/files/{sessionId}/{filename}"
}

export interface ResearchResponse {
  query: string;
  text: string;
  pages: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  files: FileDownloadMetadata[];  // NEW
  meta: {
    total: number;
    successful: number;
    failed: number;
    elapsed: number;
  };
}

export interface FileListResponse {
  session_id: string;
  files: Array<{
    name: string;
    size: number;  // bytes
    url: string;
  }>;
}

export interface CleanupResponse {
  status: 'cleaned';
  session_id: string;
  removed: number;
}
```

---

### Step 7: Integrate into Research Audit Trail

**File**: `/Users/mk/Downloads/nomads/src/utils/researchAudit.ts`

Update the audit to track file downloads:

```typescript
export interface ResearchAuditEntry {
  // ... existing fields
  downloadedFiles?: Array<{
    filename: string;
    size: string;
    type: string;
    downloadedAt: string;  // ISO timestamp
    contentHash?: string;  // Optional: SHA256 for integrity
  }>;
}

// In recordResearchRound function:
function recordResearchRound(
  // ... existing params
  downloadedFiles?: FileDownloadMetadata[]
) {
  const entry: ResearchAuditEntry = {
    // ... existing fields
    downloadedFiles: downloadedFiles?.map(f => ({
      filename: f.name,
      size: f.size,
      type: f.type,
      downloadedAt: new Date().toISOString(),
    })),
  };

  return entry;
}
```

---

## TESTING CHECKLIST

### Unit Tests

```typescript
// wayfarer_server_test.py
def test_validate_filename_accepts_safe():
    assert validate_filename("report.pdf") == "report.pdf"
    assert validate_filename("my-file_2024.csv") == "my-file_2024.csv"

def test_validate_filename_rejects_traversal():
    with pytest.raises(ValueError):
        validate_filename("../etc/passwd")
    with pytest.raises(ValueError):
        validate_filename("..\\windows\\system32")

def test_session_dir_creation():
    session_id = "test-123-abc"
    dir = get_session_downloads_dir(session_id)
    assert os.path.exists(dir)
    assert "test-123-abc" in dir

def test_file_download_security():
    session_id = "test-session"
    dir = get_session_downloads_dir(session_id)

    # Create a file
    with open(os.path.join(dir, "test.txt"), "w") as f:
        f.write("test content")

    # Should succeed
    assert os.path.exists(os.path.join(dir, "test.txt"))

    # Should fail (traversal attempt)
    with pytest.raises(HTTPException):
        # Mock endpoint with "../other-file.txt"
        pass
```

### Integration Tests

```bash
# Start Wayfarer locally
python -m uvicorn wayfarer_server:app --port 8889

# Test file download endpoints
curl -X GET http://localhost:8889/files/test-session
# Expected: {"session_id": "test-session", "files": []}

# Test file cleanup
curl -X DELETE http://localhost:8889/files/test-session
# Expected: {"status": "cleaned", "session_id": "test-session", "removed": 0}

# Test with actual research
curl -X POST http://localhost:8889/research \
  -H "Content-Type: application/json" \
  -d '{"query": "collagen supplement market", "session_id": "test-session"}'
# Expected: response includes "files" array with downloaded files
```

### E2E Tests (Client Side)

```typescript
// In React test suite
describe('WayfarerClient file downloads', () => {
  it('should list session files', async () => {
    const client = new WayfarerClient('http://localhost:8889', 'test-key');
    const files = await client.listSessionFiles('test-session');
    expect(files).toBeInstanceOf(Array);
  });

  it('should download file as blob', async () => {
    const blob = await client.downloadFile('test-session', 'report.pdf');
    expect(blob.type).toBe('application/pdf');
  });

  it('should trigger browser download', async () => {
    await client.downloadFileToLocalDisk('test-session', 'report.pdf');
    // Check that download was triggered (mocked in test)
  });

  it('should cleanup files', async () => {
    await client.cleanupSessionFiles('test-session');
    const files = await client.listSessionFiles('test-session');
    expect(files).toHaveLength(0);
  });
});
```

---

## DEPLOYMENT CHECKLIST

- [ ] Update `wayfarer_server.py` with all 4 endpoints
- [ ] Update `src/utils/wayfayer.ts` with 4 new methods
- [ ] Update `src/types/index.ts` with file types
- [ ] Update audit trail in `researchAudit.ts`
- [ ] Test locally with 100MB+ files
- [ ] Test on remote Wayfarer instance
- [ ] Add error handling for network failures
- [ ] Document new endpoints in README
- [ ] Add user-facing UI for file downloads
- [ ] Monitor `/tmp/wayfarer_downloads/` disk usage

---

## BACKWARDS COMPATIBILITY

- Existing endpoints unchanged
- New `files` field in research response is optional (defaults to `[]`)
- Old clients ignore `files` field
- No breaking changes to API contract

---

## MONITORING & OBSERVABILITY

Add logging for:
1. File downloads: `[Wayfarer] Downloaded {filename} ({size} KB) for session {session_id}`
2. File cleanup: `[Wayfarer] Cleaned up old downloads: {session_id} ({count} files)`
3. Errors: `[Wayfarer] File download error: {session_id}/{filename}: {error}`

Add metrics:
- Total files downloaded per session
- Total file size per session
- Cleanup frequency and effectiveness
- Error rate for file operations

---

## NEXT STEPS AFTER IMPLEMENTATION

1. **File Analysis Service** (Phase 1-B): Create `fileAnalysisService.ts` to parse PDFs, CSVs, etc.
2. **Document Upload Widget** (Phase 1-B): UI for user to upload files
3. **Streaming CSV Analyzer** (Phase 1-B): Process 100MB+ CSV without loading into memory
4. **PDF Table Extraction** (Phase 1-B): Use Context-1 to extract tables from PDFs
5. **Research Integration** (Phase 1-B): Integrate file download into research orchestration

---

**Implementation Time**: 2-3 hours
**Complexity**: Low
**Risk**: Very low (no changes to core logic)
**ROI**: Critical blocker for file analysis roadmap

This specification is ready for immediate implementation.
