# Wayfarer HTTP Server — FastAPI wrapper around wayfarer.research()
# Run: uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

import asyncio
import base64
import os
import traceback
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from wayfarer import research

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://100.74.135.83:11435")

# ── Playwright browser singleton ──
_browser = None
_playwright = None


async def _get_browser():
    """Lazy-init Playwright browser on first screenshot request."""
    global _browser, _playwright
    if _browser is None:
        try:
            from playwright.async_api import async_playwright
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(headless=True)
        except Exception as e:
            print(f"[Wayfarer] Playwright init failed: {e}")
            raise
    return _browser


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Cleanup on shutdown
    global _browser, _playwright
    if _browser:
        await _browser.close()
    if _playwright:
        await _playwright.stop()


app = FastAPI(title="Wayfarer", description="Async web research API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    query: str
    num_results: int = 10
    concurrency: int = 20
    extract_mode: str = "article"


class BatchQuery(BaseModel):
    query: str
    num_results: int = 10


class BatchRequest(BaseModel):
    queries: list[BatchQuery]
    concurrency: int = 20
    extract_mode: str = "article"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/research")
async def do_research(req: ResearchRequest):
    result = await research(
        query=req.query,
        num_results=req.num_results,
        concurrency=req.concurrency,
        extract_mode=req.extract_mode,
    )
    return result


@app.post("/batch")
async def do_batch(req: BatchRequest):
    tasks = [
        research(
            query=q.query,
            num_results=q.num_results,
            concurrency=req.concurrency,
            extract_mode=req.extract_mode,
        )
        for q in req.queries
    ]
    results = await asyncio.gather(*tasks)
    return {"results": list(results)}


# ── Screenshot endpoints ──


class ScreenshotRequest(BaseModel):
    url: str
    viewport_width: int = 1280
    viewport_height: int = 720
    quality: int = 60  # JPEG quality (0-100)


class ScreenshotBatchRequest(BaseModel):
    urls: list[str]
    viewport_width: int = 1280
    viewport_height: int = 720
    quality: int = 60
    concurrency: int = 3


async def _take_screenshot(url: str, width: int, height: int, quality: int) -> dict:
    """Capture a single URL screenshot. Returns dict with base64 image or error."""
    try:
        browser = await _get_browser()
        page = await browser.new_page(viewport={"width": width, "height": height})
        try:
            await page.goto(url, wait_until="networkidle", timeout=15000)
            screenshot_bytes = await page.screenshot(type="jpeg", quality=quality)
            img_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            return {
                "url": url,
                "image_base64": img_b64,
                "width": width,
                "height": height,
                "error": None,
            }
        finally:
            await page.close()
    except Exception as e:
        return {
            "url": url,
            "image_base64": "",
            "width": 0,
            "height": 0,
            "error": str(e),
        }


@app.post("/screenshot")
async def take_screenshot(req: ScreenshotRequest):
    return await _take_screenshot(req.url, req.viewport_width, req.viewport_height, req.quality)


@app.post("/screenshot/batch")
async def take_screenshots(req: ScreenshotBatchRequest):
    sem = asyncio.Semaphore(req.concurrency)

    async def bounded(url: str):
        async with sem:
            return await _take_screenshot(url, req.viewport_width, req.viewport_height, req.quality)

    results = await asyncio.gather(*[bounded(u) for u in req.urls])
    return {"screenshots": list(results)}


# ── Ollama proxy (bypasses browser CORS) ──

@app.api_route("/ollama/{path:path}", methods=["GET", "POST", "DELETE"])
async def ollama_proxy(path: str, request: Request):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    url = f"{OLLAMA_HOST}/{path}"

    async def stream_response():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(request.method, url, content=body, headers=headers) as resp:
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream_response(), media_type="application/x-ndjson")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8889)
