#!/opt/homebrew/bin/python3.11
"""
Mac Bridge Server — FastAPI on port 8891

Provides HTTP endpoints for desktop computer control:
  GET  /health        — status + permission summary
  GET  /screen_info   — logical + physical dimensions and scale factor
  POST /screenshot    — full-screen JPEG, base64-encoded (physical resolution)
  POST /click         — mouse click in logical pixel coordinates
  POST /type          — keyboard text input (ASCII fast path / Unicode via clipboard)
  POST /hotkey        — key combination (e.g. ["cmd", "s"])
  POST /scroll        — scroll wheel at a logical coordinate

Coordinate convention
---------------------
All x/y values in /click and /scroll are LOGICAL pixels (points).
On a Retina display the scale factor is 2.0:
  logical pixel (500, 300)  ==  physical pixel (1000, 600) in the screenshot.
/screen_info returns the scale factor so callers can convert when needed.
/screenshot always returns the image at full PHYSICAL resolution.

Run with:
  /opt/homebrew/bin/python3.11 -m uvicorn bridge_server:app \
      --host 0.0.0.0 --port 8891 --reload

Dependencies:
  /opt/homebrew/bin/pip3.11 install fastapi uvicorn pyautogui Pillow \
      pyobjc-core pyobjc-framework-Quartz pyobjc-framework-Cocoa \
      pyobjc-framework-ApplicationServices
"""

from __future__ import annotations

import base64
import io
import logging
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pyautogui
from PIL import Image

# ---------------------------------------------------------------------------
# pyautogui safety settings
# ---------------------------------------------------------------------------
pyautogui.FAILSAFE = False   # Don't abort on corner-move (caller controls abort)
pyautogui.PAUSE = 0.0        # No built-in pause between calls; callers control pacing

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [bridge] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Mac Bridge",
    description="macOS desktop control bridge for the Ad Agent pipeline",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Display info helpers
# ---------------------------------------------------------------------------

def _get_display_info() -> tuple[int, int, int, int, float]:
    """
    Returns (physical_width, physical_height, logical_width, logical_height, scale)
    for the main display.

    Falls back to pyautogui dimensions with scale=1.0 if Quartz is unavailable.
    """
    try:
        import Quartz
        main = Quartz.CGMainDisplayID()
        physical_w = Quartz.CGDisplayPixelsWide(main)
        physical_h = Quartz.CGDisplayPixelsHigh(main)
        bounds = Quartz.CGDisplayBounds(main)
        logical_w = int(bounds.size.width)
        logical_h = int(bounds.size.height)
        scale = round(physical_w / logical_w, 2) if logical_w > 0 else 1.0
        return physical_w, physical_h, logical_w, logical_h, scale
    except Exception:
        w, h = pyautogui.size()
        return w, h, w, h, 1.0


# ---------------------------------------------------------------------------
# Screenshot backends
# ---------------------------------------------------------------------------

def _screenshot_quartz(quality: int = 75) -> bytes:
    """
    Full-screen capture at PHYSICAL resolution using Quartz + AppKit.
    Returns raw JPEG bytes.
    Raises RuntimeError if Screen Recording permission is missing.
    """
    import Quartz
    import AppKit

    main = Quartz.CGMainDisplayID()
    image_ref = Quartz.CGDisplayCreateImage(main)
    if image_ref is None:
        raise RuntimeError(
            "CGDisplayCreateImage returned None — Screen Recording permission is missing. "
            "Run check_permissions.py to grant it."
        )

    ns_image = AppKit.NSImage.alloc().initWithCGImage_size_(
        image_ref, AppKit.NSZeroSize
    )
    tiff_data = ns_image.TIFFRepresentation()
    bitmap = AppKit.NSBitmapImageRep.imageRepWithData_(tiff_data)

    props = {AppKit.NSImageCompressionFactor: quality / 100.0}
    jpeg_data = bitmap.representationUsingType_properties_(
        AppKit.NSJPEGFileType, props
    )
    if jpeg_data is None:
        raise RuntimeError("JPEG encoding failed (NSBitmapImageRep returned None).")

    return bytes(jpeg_data)


def _screenshot_screencapture(quality: int = 75) -> bytes:
    """
    Fallback: macOS screencapture CLI. Works even when pyobjc is not installed.
    Returns raw JPEG bytes. Re-encodes at target quality via Pillow.
    """
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        tmp_path = f.name
    try:
        result = subprocess.run(
            ["screencapture", "-x", "-t", "jpg", tmp_path],
            capture_output=True,
            timeout=10,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"screencapture exited {result.returncode}: {result.stderr.decode()}"
            )
        raw = Path(tmp_path).read_bytes()
        # Re-encode at target quality
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _take_screenshot(quality: int = 75) -> tuple[str, int, int, int, int, float]:
    """
    Capture the screen. Returns:
      (base64_jpeg, physical_w, physical_h, logical_w, logical_h, scale)

    Tries Quartz first (physical-resolution, no CLI subprocess).
    Falls back to screencapture CLI, then pyautogui.
    """
    physical_w, physical_h, logical_w, logical_h, scale = _get_display_info()

    # Try Quartz (native, physical res)
    try:
        jpeg_bytes = _screenshot_quartz(quality=quality)
        log.info(
            "screenshot (quartz) physical=%dx%d logical=%dx%d scale=%.1f %.1fKB",
            physical_w, physical_h, logical_w, logical_h, scale,
            len(jpeg_bytes) / 1024,
        )
        b64 = base64.b64encode(jpeg_bytes).decode("ascii")
        return b64, physical_w, physical_h, logical_w, logical_h, scale
    except Exception as e:
        log.warning("Quartz screenshot failed (%s), trying screencapture CLI...", e)

    # Try screencapture CLI
    try:
        jpeg_bytes = _screenshot_screencapture(quality=quality)
        img = Image.open(io.BytesIO(jpeg_bytes))
        log.info(
            "screenshot (screencapture) image=%dx%d logical=%dx%d scale=%.1f %.1fKB",
            img.width, img.height, logical_w, logical_h, scale,
            len(jpeg_bytes) / 1024,
        )
        b64 = base64.b64encode(jpeg_bytes).decode("ascii")
        return b64, img.width, img.height, logical_w, logical_h, scale
    except Exception as e:
        log.warning("screencapture CLI failed (%s), using pyautogui fallback...", e)

    # Last resort: pyautogui (logical resolution)
    pil_img = pyautogui.screenshot()
    buf = io.BytesIO()
    pil_img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
    jpeg_bytes = buf.getvalue()
    log.info(
        "screenshot (pyautogui) image=%dx%d %.1fKB",
        pil_img.width, pil_img.height, len(jpeg_bytes) / 1024,
    )
    b64 = base64.b64encode(jpeg_bytes).decode("ascii")
    return b64, pil_img.width, pil_img.height, logical_w, logical_h, scale


# ---------------------------------------------------------------------------
# Permission status (inline so bridge_server has no import dep on check_permissions)
# ---------------------------------------------------------------------------

def _permission_status() -> dict:
    status: dict = {}

    # Screen Recording
    try:
        import Quartz
        img = Quartz.CGWindowListCreateImage(
            Quartz.CGRectInfinite,
            Quartz.kCGWindowListOptionOnScreenOnly,
            Quartz.kCGNullWindowID,
            Quartz.kCGWindowImageDefault,
        )
        status["screen_recording"] = img is not None
    except Exception:
        status["screen_recording"] = False

    # Accessibility
    try:
        from ApplicationServices import AXIsProcessTrusted
        status["accessibility"] = bool(AXIsProcessTrusted())
    except Exception:
        status["accessibility"] = False

    # Input Monitoring
    try:
        from Quartz import CGPreflightListenEventAccess
        status["input_monitoring"] = bool(CGPreflightListenEventAccess())
    except Exception:
        status["input_monitoring"] = False

    # Automation
    try:
        r = subprocess.run(
            ["osascript", "-e", 'tell application "Finder" to get name'],
            capture_output=True, timeout=3,
        )
        status["automation"] = r.returncode == 0
    except Exception:
        status["automation"] = False

    return status


# ---------------------------------------------------------------------------
# Key name map: bridge API names → pyautogui names
# ---------------------------------------------------------------------------

_KEY_MAP: dict[str, str] = {
    "cmd": "command", "command": "command",
    "ctrl": "ctrl", "control": "ctrl",
    "alt": "alt", "option": "alt",
    "shift": "shift",
    "fn": "fn",
    "enter": "enter", "return": "enter",
    "escape": "escape", "esc": "escape",
    "tab": "tab",
    "backspace": "backspace", "delete": "backspace",
    "del": "delete",
    "space": "space",
    "up": "up", "down": "down", "left": "left", "right": "right",
    "home": "home", "end": "end",
    "pageup": "pageup", "pagedown": "pagedown",
    **{f"f{i}": f"f{i}" for i in range(1, 13)},
}


def _translate_key(key: str) -> str:
    lower = key.lower()
    return _KEY_MAP.get(lower, lower)


# ---------------------------------------------------------------------------
# Typing helpers
# ---------------------------------------------------------------------------

def _type_text(text: str, interval: float = 0.02):
    """
    Type text into the focused application.
    Uses typewrite for short ASCII strings, clipboard-paste for everything else.
    """
    if not text:
        return

    # Short ASCII path — typewrite is most reliable here
    if text.isascii() and len(text) <= 64:
        pyautogui.typewrite(text, interval=interval)
        return

    # Unicode / long strings: copy to clipboard then paste
    proc = subprocess.run(
        ["pbcopy"],
        input=text.encode("utf-8"),
        check=True,
        timeout=5,
    )
    time.sleep(0.05)
    pyautogui.hotkey("command", "v")
    time.sleep(0.05)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ClickRequest(BaseModel):
    x: float
    y: float
    button: Literal["left", "right", "middle"] = "left"
    double: bool = False


class TypeRequest(BaseModel):
    text: str
    interval: float = Field(default=0.02, description="Seconds between keystrokes (ASCII path)")


class HotkeyRequest(BaseModel):
    keys: List[str] = Field(..., description='e.g. ["cmd", "s"] or ["cmd", "shift", "s"]')


class ScrollRequest(BaseModel):
    x: float
    y: float
    direction: Literal["up", "down", "left", "right"] = "down"
    amount: int = Field(default=3, ge=1, le=50)


class OkResponse(BaseModel):
    ok: bool = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check — returns status and all permission states."""
    permissions = _permission_status()
    all_ok = all(permissions.values())
    physical_w, physical_h, logical_w, logical_h, scale = _get_display_info()
    return {
        "status": "ok" if all_ok else "degraded",
        "permissions": permissions,
        "screen": {
            "physical_width": physical_w,
            "physical_height": physical_h,
            "logical_width": logical_w,
            "logical_height": logical_h,
            "scale": scale,
        },
        "python": sys.version.split()[0],
        "server": "mac_bridge v1.0",
    }


@app.get("/screen_info")
async def screen_info():
    """
    Return display dimensions and scale factor.
    Use scale to convert between physical (screenshot pixels) and logical (click coords).
    """
    physical_w, physical_h, logical_w, logical_h, scale = _get_display_info()
    return {
        "physical_width": physical_w,
        "physical_height": physical_h,
        "logical_width": logical_w,
        "logical_height": logical_h,
        # Convenience aliases
        "width": logical_w,
        "height": logical_h,
        "scale": scale,
    }


@app.post("/screenshot")
async def screenshot(quality: int = 75):
    """
    Capture the full screen at PHYSICAL resolution.
    Returns base64-encoded JPEG + dimension info.

    quality: JPEG quality 1-100 (default 75)
    """
    try:
        b64, phys_w, phys_h, log_w, log_h, scale = _take_screenshot(quality=quality)
    except Exception as e:
        log.error("screenshot error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "image_base64": b64,
        # Physical dimensions (actual screenshot pixel size)
        "width": phys_w,
        "height": phys_h,
        # Logical dimensions (pass to /click)
        "logical_width": log_w,
        "logical_height": log_h,
        "scale": scale,
        "format": "jpeg",
    }


@app.post("/click", response_model=OkResponse)
async def click(req: ClickRequest):
    """
    Click at (x, y) in LOGICAL pixel coordinates.
    pyautogui handles Retina 2x scaling automatically.
    """
    try:
        x, y = int(req.x), int(req.y)
        log.info("click %s%s at (%d, %d)", req.button, " double" if req.double else "", x, y)

        # Brief moveTo so macOS registers the cursor position change
        pyautogui.moveTo(x, y, duration=0.05)

        if req.double:
            pyautogui.doubleClick(x, y, button=req.button)
        else:
            pyautogui.click(x, y, button=req.button)

        return OkResponse()
    except Exception as e:
        log.error("click error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/type", response_model=OkResponse)
async def type_text(req: TypeRequest):
    """
    Type a string of text. ASCII uses pyautogui.typewrite; Unicode uses clipboard paste.
    """
    try:
        log.info("type %d chars: %r", len(req.text), req.text[:60])
        _type_text(req.text, interval=req.interval)
        return OkResponse()
    except Exception as e:
        log.error("type error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/hotkey", response_model=OkResponse)
async def hotkey(req: HotkeyRequest):
    """
    Press a key combination simultaneously.
    Accepts bridge key names: "cmd", "ctrl", "alt", "shift", "enter", "esc", "f1"-"f12", etc.
    Example: {"keys": ["cmd", "shift", "s"]}
    """
    if not req.keys:
        raise HTTPException(status_code=400, detail="keys list must not be empty")

    try:
        translated = [_translate_key(k) for k in req.keys]
        log.info("hotkey %s -> %s", req.keys, translated)
        pyautogui.hotkey(*translated)
        return OkResponse()
    except Exception as e:
        log.error("hotkey error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/scroll", response_model=OkResponse)
async def scroll(req: ScrollRequest):
    """
    Scroll at (x, y) in LOGICAL pixel coordinates.
    direction: "up" | "down" | "left" | "right"
    amount: number of scroll clicks (1-50, default 3)
    """
    try:
        x, y = int(req.x), int(req.y)
        log.info("scroll %s x%d at (%d, %d)", req.direction, req.amount, x, y)

        pyautogui.moveTo(x, y, duration=0.04)
        time.sleep(0.02)

        if req.direction == "up":
            pyautogui.scroll(req.amount, x=x, y=y)
        elif req.direction == "down":
            pyautogui.scroll(-req.amount, x=x, y=y)
        elif req.direction == "left":
            pyautogui.hscroll(-req.amount, x=x, y=y)
        elif req.direction == "right":
            pyautogui.hscroll(req.amount, x=x, y=y)

        return OkResponse()
    except Exception as e:
        log.error("scroll error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e
