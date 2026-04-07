#!/usr/bin/env python3
"""
filter_data.py -- Filter and clean GUI grounding datasets for Gemma 4 E2B fine-tuning.

Reads OmniACT, ScreenSpot, Mind2Web, and tracker session data. Applies quality
filters and outputs a unified JSONL dataset suitable for training a Mac desktop
click-prediction model.

Output format per line:
  {
    "screenshot":  "path/to/image.jpg",        # absolute or relative path
    "instruction": "Click the Save button",     # natural language task
    "bbox_gemma":  [y_min, x_min, y_max, x_max],  # 0-1000, Gemma's native format
    "bbox_norm":   [x_min, y_min, x_max, y_max],  # 0-1 normalized, standard format
    "platform":    "macos|web|windows",
    "app":         "Safari|Mail|Finder|etc",
    "source":      "omniact|screenspot|mind2web|tracker|synthetic"
  }

Usage:
  python filter_data.py                    # Filter all available datasets
  python filter_data.py --dry-run          # Show stats without writing
  python filter_data.py --val-split 0.1   # Custom validation split ratio
  python filter_data.py --synthetic-only  # Only generate synthetic examples
"""

import argparse
import hashlib
import json
import os
import random
import sys
from io import BytesIO
from pathlib import Path
from typing import Iterator, Optional

# ---------------------------------------------------------------------------
# Dependencies -- all standard or already in requirements.txt
# ---------------------------------------------------------------------------
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("[WARN] Pillow not installed. Image validation disabled. pip install Pillow")

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.progress import track
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
DATASETS_DIR = SCRIPT_DIR  # datasets/omniact, datasets/screenspot, etc. live here
FILTERED_DIR = SCRIPT_DIR / "filtered"
FILTERED_DIR.mkdir(parents=True, exist_ok=True)

TRAIN_PATH = FILTERED_DIR / "train.jsonl"
VAL_PATH   = FILTERED_DIR / "val.jsonl"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GEMMA_SCALE = 1000  # Gemma 4 E2B normalizes coords to 0-1000

# Mac-specific application names (case-insensitive substring match)
MAC_APPS = {
    "safari", "mail", "finder", "calendar", "system preferences",
    "system settings", "notes", "photos", "music", "messages",
    "facetime", "maps", "contacts", "reminders", "preview",
    "activity monitor", "terminal", "textedit", "xcode",
    "app store", "itunes", "icloud", "spotlight",
    "launchpad", "mission control", "stickies", "chess",
    "font book", "automator", "script editor", "keychain access",
    "disk utility", "boot camp", "migration assistant",
    "airdrop", "handoff", "siri",
}

# Windows-only UI signal strings -- presence means exclude the example
WINDOWS_SIGNALS = {
    "windows start button", "start menu", "taskbar", "windows defender",
    "control panel", "windows explorer", "microsoft edge taskbar",
    "windows update", "cortana", "windows search",
}

# Minimum bounding box dimension in Gemma 0-1000 coords
# 5 px on a 1920px image = 5/1920*1000 ≈ 2.6. We use 5 as the floor.
MIN_BBOX_DIM = 5  # in Gemma coords (0-1000)

# ---------------------------------------------------------------------------
# Rich console (graceful fallback)
# ---------------------------------------------------------------------------
if RICH_AVAILABLE:
    console = Console()
    def info(msg):  console.print(f"[cyan]{msg}[/cyan]")
    def warn(msg):  console.print(f"[yellow]{msg}[/yellow]")
    def ok(msg):    console.print(f"[green]{msg}[/green]")
    def err(msg):   console.print(f"[red]{msg}[/red]")
else:
    def info(msg): print(f"INFO  {msg}")
    def warn(msg): print(f"WARN  {msg}")
    def ok(msg):   print(f"OK    {msg}")
    def err(msg):  print(f"ERR   {msg}")


# ===========================================================================
# COORDINATE HELPERS
# ===========================================================================

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def pixel_to_norm(px: float, total: float) -> float:
    """Convert pixel coordinate to 0-1 fraction."""
    return clamp(px / total, 0.0, 1.0)


def norm_to_gemma(v: float) -> int:
    """Convert 0-1 fraction to Gemma 0-1000 integer."""
    return int(round(clamp(v, 0.0, 1.0) * GEMMA_SCALE))


def pixel_box_to_outputs(
    x1_px: float, y1_px: float, x2_px: float, y2_px: float,
    img_w: int, img_h: int,
) -> tuple[list[int], list[float]]:
    """
    Convert a pixel bounding box to both output formats.
    Returns (bbox_gemma, bbox_norm).
      bbox_gemma = [y_min, x_min, y_max, x_max]  (0-1000, Gemma format)
      bbox_norm  = [x_min, y_min, x_max, y_max]  (0-1, standard format)
    """
    x1 = pixel_to_norm(x1_px, img_w)
    y1 = pixel_to_norm(y1_px, img_h)
    x2 = pixel_to_norm(x2_px, img_w)
    y2 = pixel_to_norm(y2_px, img_h)

    # Ensure min <= max
    x_min, x_max = min(x1, x2), max(x1, x2)
    y_min, y_max = min(y1, y2), max(y1, y2)

    bbox_gemma = [
        norm_to_gemma(y_min),
        norm_to_gemma(x_min),
        norm_to_gemma(y_max),
        norm_to_gemma(x_max),
    ]
    bbox_norm = [x_min, y_min, x_max, y_max]
    return bbox_gemma, bbox_norm


def frac_box_to_outputs(
    x1: float, y1: float, x2: float, y2: float
) -> tuple[list[int], list[float]]:
    """Same as pixel_box_to_outputs but input is already 0-1 fractions."""
    x_min, x_max = min(x1, x2), max(x1, x2)
    y_min, y_max = min(y1, y2), max(y1, y2)

    bbox_gemma = [
        norm_to_gemma(y_min),
        norm_to_gemma(x_min),
        norm_to_gemma(y_max),
        norm_to_gemma(x_max),
    ]
    bbox_norm = [
        clamp(x_min, 0, 1), clamp(y_min, 0, 1),
        clamp(x_max, 0, 1), clamp(y_max, 0, 1),
    ]
    return bbox_gemma, bbox_norm


def click_point_to_outputs(
    x: float, y: float, img_w: int, img_h: int, frac: bool = False,
    half_px: float = 15.0,
) -> tuple[list[int], list[float]]:
    """
    Expand a click point into a small bounding box.
    half_px is the half-size of the box in pixels.
    """
    if frac:
        x_px = x * img_w
        y_px = y * img_h
    else:
        x_px = x
        y_px = y

    return pixel_box_to_outputs(
        x_px - half_px, y_px - half_px,
        x_px + half_px, y_px + half_px,
        img_w, img_h,
    )


# ===========================================================================
# IMAGE VALIDATION
# ===========================================================================

def image_hash(path: str) -> Optional[str]:
    """Return a perceptual-ish hash: MD5 of the raw file bytes."""
    try:
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except OSError:
        return None


def validate_image(path: str) -> tuple[bool, int, int]:
    """
    Check that a file is a valid, non-corrupt JPEG or PNG.
    Returns (is_valid, width, height).
    """
    if not PIL_AVAILABLE:
        # Can't validate -- assume valid, return dummy dimensions
        return True, 1920, 1080

    if not os.path.isfile(path):
        return False, 0, 0

    try:
        with Image.open(path) as img:
            img.verify()  # Detects truncation and corruption
        # Re-open after verify (verify leaves the file in a broken state)
        with Image.open(path) as img:
            img.load()    # Force full decode
            w, h = img.size
            fmt = img.format
        if fmt not in ("JPEG", "PNG", "WEBP"):
            return False, 0, 0
        if w == 0 or h == 0:
            return False, 0, 0
        return True, w, h
    except Exception:
        return False, 0, 0


# ===========================================================================
# QUALITY FILTERS
# ===========================================================================

def bbox_gemma_is_valid(bbox_gemma: list[int]) -> bool:
    """
    Check that a Gemma-format bbox [y1, x1, y2, x2] is non-degenerate.
    - All values in [0, 1000]
    - Width (x2-x1) >= MIN_BBOX_DIM
    - Height (y2-y1) >= MIN_BBOX_DIM
    """
    if len(bbox_gemma) != 4:
        return False
    y1, x1, y2, x2 = bbox_gemma
    if not all(0 <= v <= GEMMA_SCALE for v in [y1, x1, y2, x2]):
        return False
    if (x2 - x1) < MIN_BBOX_DIM:
        return False
    if (y2 - y1) < MIN_BBOX_DIM:
        return False
    return True


def has_windows_ui(instruction: str, app: str) -> bool:
    """Return True if the example shows Windows-specific UI patterns."""
    combined = (instruction + " " + app).lower()
    return any(signal in combined for signal in WINDOWS_SIGNALS)


def is_mac_app(app_name: str) -> bool:
    """Return True if the app name matches a known Mac application."""
    lower = app_name.lower()
    return any(mac in lower for mac in MAC_APPS)


def action_is_click(action: str) -> bool:
    """Return True if the action is a click or double-click."""
    a = action.lower().strip()
    return a in ("click", "double_click", "left_click", "tap", "press")


# ===========================================================================
# DATASET READERS
# ===========================================================================

def read_omniact(datasets_dir: Path) -> Iterator[dict]:
    """
    Read OmniACT examples.

    OmniACT (Writer/omniact) contains Mac desktop screenshots with PyAutoGUI
    action annotations. We filter to Mac-specific apps only.

    Expected raw schema (HuggingFace parquet rows or JSON):
      {
        "image": PIL.Image or path string,
        "instruction": str,
        "bbox": [x1, y1, x2, y2] in pixels,   -- OR --
        "click_x": float, "click_y": float,    (fractional)
        "application": str,
        "action_type": str,
        ...
      }
    """
    omniact_dir = datasets_dir / "omniact"
    if not omniact_dir.exists():
        warn("OmniACT directory not found -- skipping.")
        return

    info("Reading OmniACT...")

    # Try loading as HuggingFace dataset (parquet shards)
    try:
        from datasets import load_from_disk, load_dataset
        try:
            ds = load_dataset(str(omniact_dir), trust_remote_code=True)
        except Exception:
            ds = load_from_disk(str(omniact_dir))

        for split_name in ds:
            split = ds[split_name]
            info(f"  OmniACT/{split_name}: {len(split)} rows")
            for idx, row in enumerate(split):
                example = _parse_omniact_row(row, omniact_dir, idx, split_name)
                if example:
                    yield example
        return
    except Exception as e:
        warn(f"  Could not load via HF datasets: {e}. Falling back to JSON scan.")

    # Fallback: scan for JSON annotation files
    for json_file in sorted(omniact_dir.rglob("*.json")):
        try:
            with open(json_file) as f:
                data = json.load(f)
            rows = data if isinstance(data, list) else [data]
            for idx, row in enumerate(rows):
                example = _parse_omniact_row(row, omniact_dir, idx, json_file.stem)
                if example:
                    yield example
        except Exception as e:
            warn(f"  Skipping {json_file.name}: {e}")


def _parse_omniact_row(row: dict, base_dir: Path, idx: int, split: str) -> Optional[dict]:
    """Parse one OmniACT row into our intermediate dict."""
    try:
        # --- Image ---
        image_path = None
        img_w, img_h = 0, 0

        if "image" in row:
            img = row["image"]
            if isinstance(img, str):
                image_path = str(base_dir / img)
                _, img_w, img_h = validate_image(image_path)
            elif hasattr(img, "size"):
                # PIL Image in memory -- save it
                img_w, img_h = img.size
                save_dir = FILTERED_DIR / "images" / "omniact"
                save_dir.mkdir(parents=True, exist_ok=True)
                image_path = str(save_dir / f"{split}_{idx}.jpg")
                if not Path(image_path).exists():
                    img.convert("RGB").save(image_path, "JPEG", quality=90)
        elif "screenshot" in row:
            image_path = str(base_dir / row["screenshot"])
            _, img_w, img_h = validate_image(image_path)

        if not image_path or img_w == 0:
            return None

        # --- Action type ---
        action = str(row.get("action_type", row.get("action", "click"))).lower()
        if not action_is_click(action):
            return None

        # --- Instruction ---
        instruction = (
            row.get("instruction")
            or row.get("task")
            or row.get("action_description")
            or row.get("query")
            or ""
        )
        instruction = str(instruction).strip()
        if not instruction:
            return None

        # --- App ---
        app = str(row.get("application", row.get("app", ""))).strip()

        # OmniACT is Mac-only, but double-check for Windows signals
        if has_windows_ui(instruction, app):
            return None

        # Filter to Mac apps only (OmniACT is Mac, but some rows may be generic)
        # If app is empty, allow it -- OmniACT is Mac-native
        if app and not is_mac_app(app):
            return None

        # --- Bounding box ---
        bbox_gemma, bbox_norm = None, None

        if "bbox" in row:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                vals = [float(v) for v in bbox]
                # Detect fractional vs pixel
                if all(v <= 1.0 for v in vals):
                    bbox_gemma, bbox_norm = frac_box_to_outputs(*vals)
                else:
                    bbox_gemma, bbox_norm = pixel_box_to_outputs(*vals, img_w, img_h)

        elif "click_x" in row and "click_y" in row:
            cx, cy = float(row["click_x"]), float(row["click_y"])
            is_frac = (cx <= 1.0 and cy <= 1.0)
            bbox_gemma, bbox_norm = click_point_to_outputs(
                cx, cy, img_w, img_h, frac=is_frac
            )

        elif "element_bbox" in row:
            eb = row["element_bbox"]
            if isinstance(eb, dict):
                x1 = float(eb.get("x", eb.get("left", 0)))
                y1 = float(eb.get("y", eb.get("top", 0)))
                x2 = x1 + float(eb.get("width", 0))
                y2 = y1 + float(eb.get("height", 0))
                bbox_gemma, bbox_norm = pixel_box_to_outputs(x1, y1, x2, y2, img_w, img_h)

        if bbox_gemma is None:
            return None
        if not bbox_gemma_is_valid(bbox_gemma):
            return None

        return {
            "screenshot": image_path,
            "instruction": instruction,
            "bbox_gemma": bbox_gemma,
            "bbox_norm": [round(v, 6) for v in bbox_norm],
            "platform": "macos",
            "app": app or "unknown",
            "source": "omniact",
        }

    except Exception:
        return None


def read_screenspot(datasets_dir: Path) -> Iterator[dict]:
    """
    Read ScreenSpot examples.

    ScreenSpot (rootsautomation/ScreenSpot) contains 1,272 click grounding examples
    across Mac, Windows, Web, and Mobile. Each has a screenshot + instruction + bbox.

    Raw schema:
      {
        "img_filename": str,
        "instruction": str,
        "bbox": [x1, y1, x2, y2],    # pixel coords OR 0-1 fractions
        "platform": "mac|windows|web|mobile",
        "application": str,
        "action_type": str,           # "click" or other
        ...
      }
    """
    ss_dir = datasets_dir / "screenspot"
    if not ss_dir.exists():
        warn("ScreenSpot directory not found -- skipping.")
        return

    info("Reading ScreenSpot...")

    # Try HuggingFace format first
    try:
        from datasets import load_from_disk, load_dataset
        try:
            ds = load_dataset(str(ss_dir), trust_remote_code=True)
        except Exception:
            ds = load_from_disk(str(ss_dir))

        for split_name in ds:
            split = ds[split_name]
            info(f"  ScreenSpot/{split_name}: {len(split)} rows")
            for idx, row in enumerate(split):
                example = _parse_screenspot_row(row, ss_dir, idx, split_name)
                if example:
                    yield example
        return
    except Exception as e:
        warn(f"  Could not load via HF datasets: {e}. Falling back to JSON scan.")

    # Fallback: JSON files
    for json_file in sorted(ss_dir.rglob("*.json")):
        try:
            with open(json_file) as f:
                data = json.load(f)
            rows = data if isinstance(data, list) else [data]
            for idx, row in enumerate(rows):
                example = _parse_screenspot_row(row, ss_dir, idx, json_file.stem)
                if example:
                    yield example
        except Exception as e:
            warn(f"  Skipping {json_file.name}: {e}")


def _parse_screenspot_row(row: dict, base_dir: Path, idx: int, split: str) -> Optional[dict]:
    """Parse one ScreenSpot row."""
    try:
        # --- Platform ---
        platform = str(row.get("platform", row.get("env", "web"))).lower()

        # Drop Windows-only examples entirely
        if platform == "windows":
            return None

        # Normalize platform name
        if platform in ("mac", "macos", "desktop"):
            platform = "macos"
        elif platform in ("mobile", "ios", "android"):
            return None  # Mobile is out of scope for a Mac agent
        elif platform in ("web", "browser"):
            platform = "web"

        # --- Action ---
        action = str(row.get("action_type", row.get("action", "click"))).lower()
        if not action_is_click(action):
            return None

        # --- Image ---
        image_path = None
        img_w, img_h = 0, 0

        img_filename = row.get("img_filename", row.get("image_path", row.get("image", "")))
        if isinstance(img_filename, str) and img_filename:
            image_path = str(base_dir / img_filename)
        elif hasattr(img_filename, "size"):
            # PIL image
            img_w, img_h = img_filename.size
            save_dir = FILTERED_DIR / "images" / "screenspot"
            save_dir.mkdir(parents=True, exist_ok=True)
            image_path = str(save_dir / f"{split}_{idx}.jpg")
            if not Path(image_path).exists():
                img_filename.convert("RGB").save(image_path, "JPEG", quality=90)

        if not image_path:
            return None

        if img_w == 0:
            valid, img_w, img_h = validate_image(image_path)
            if not valid:
                return None

        # --- Instruction ---
        instruction = str(
            row.get("instruction", row.get("task", row.get("query", "")))
        ).strip()
        if not instruction:
            return None

        # --- Windows UI check ---
        app = str(row.get("application", row.get("app", ""))).strip()
        if has_windows_ui(instruction, app):
            return None

        # --- Bounding box ---
        bbox = row.get("bbox", row.get("bounding_box", None))
        bbox_gemma, bbox_norm = None, None

        if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            vals = [float(v) for v in bbox]
            if all(v <= 1.0 for v in vals):
                bbox_gemma, bbox_norm = frac_box_to_outputs(*vals)
            else:
                bbox_gemma, bbox_norm = pixel_box_to_outputs(*vals, img_w, img_h)

        if bbox_gemma is None:
            return None
        if not bbox_gemma_is_valid(bbox_gemma):
            return None

        return {
            "screenshot": image_path,
            "instruction": instruction,
            "bbox_gemma": bbox_gemma,
            "bbox_norm": [round(v, 6) for v in bbox_norm],
            "platform": platform,
            "app": app or "unknown",
            "source": "screenspot",
        }

    except Exception:
        return None


def read_mind2web(datasets_dir: Path) -> Iterator[dict]:
    """
    Read Mind2Web examples.

    Mind2Web (osunlp/Multimodal-Mind2Web) contains 14K browser interaction actions.
    We keep web platform clicks only.

    Raw schema varies; common fields:
      {
        "screenshot": PIL.Image or path,
        "action_type": "CLICK|TYPE|SELECT|...",
        "element_desc": str,
        "task_description": str,
        "bbox": [x1, y1, x2, y2],
        "domain": str,   # website domain
        ...
      }
    """
    m2w_dir = datasets_dir / "mind2web"
    if not m2w_dir.exists():
        warn("Mind2Web directory not found -- skipping.")
        return

    info("Reading Mind2Web...")

    try:
        from datasets import load_from_disk, load_dataset
        try:
            ds = load_dataset(str(m2w_dir), trust_remote_code=True)
        except Exception:
            ds = load_from_disk(str(m2w_dir))

        for split_name in ds:
            split = ds[split_name]
            info(f"  Mind2Web/{split_name}: {len(split)} rows")
            for idx, row in enumerate(split):
                example = _parse_mind2web_row(row, m2w_dir, idx, split_name)
                if example:
                    yield example
        return
    except Exception as e:
        warn(f"  Could not load via HF datasets: {e}. Falling back to JSON scan.")

    for json_file in sorted(m2w_dir.rglob("*.json")):
        try:
            with open(json_file) as f:
                data = json.load(f)
            rows = data if isinstance(data, list) else [data]
            for idx, row in enumerate(rows):
                example = _parse_mind2web_row(row, m2w_dir, idx, json_file.stem)
                if example:
                    yield example
        except Exception as e:
            warn(f"  Skipping {json_file.name}: {e}")


def _parse_mind2web_row(row: dict, base_dir: Path, idx: int, split: str) -> Optional[dict]:
    """Parse one Mind2Web row."""
    try:
        # Mind2Web is web-only
        action = str(row.get("action_type", row.get("operation", {})
                             if not isinstance(row.get("operation"), str)
                             else row.get("operation", "click"))).lower()

        # Handle nested operation dict
        if isinstance(row.get("operation"), dict):
            action = str(row["operation"].get("op", "click")).lower()

        if not action_is_click(action):
            return None

        # --- Image ---
        image_path = None
        img_w, img_h = 1920, 1080  # Mind2Web default screen size

        screenshot = row.get("screenshot", row.get("image", None))
        if isinstance(screenshot, str) and screenshot:
            image_path = str(base_dir / screenshot)
            valid, img_w, img_h = validate_image(image_path)
            if not valid:
                return None
        elif hasattr(screenshot, "size"):
            img_w, img_h = screenshot.size
            save_dir = FILTERED_DIR / "images" / "mind2web"
            save_dir.mkdir(parents=True, exist_ok=True)
            image_path = str(save_dir / f"{split}_{idx}.jpg")
            if not Path(image_path).exists():
                screenshot.convert("RGB").save(image_path, "JPEG", quality=90)

        if not image_path:
            return None

        # --- Instruction ---
        # Mind2Web often has a task-level description + per-step element description
        task_desc = str(row.get("task_description", row.get("confirmed_task", ""))).strip()
        element_desc = str(row.get("element_desc", row.get("element_role", ""))).strip()
        if task_desc:
            instruction = task_desc
        elif element_desc:
            instruction = f"Click the {element_desc}"
        else:
            return None

        # --- Bounding box ---
        bbox_gemma, bbox_norm = None, None

        # Mind2Web bbox: [x1, y1, x2, y2] in pixels, OR relative coords
        bbox = row.get("bbox", row.get("bounding_box", None))
        if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            vals = [float(v) for v in bbox]
            if all(v <= 1.0 for v in vals):
                bbox_gemma, bbox_norm = frac_box_to_outputs(*vals)
            else:
                bbox_gemma, bbox_norm = pixel_box_to_outputs(*vals, img_w, img_h)

        # Fallback: center point
        elif "center" in row:
            cx = float(row["center"].get("x", 0))
            cy = float(row["center"].get("y", 0))
            bbox_gemma, bbox_norm = click_point_to_outputs(cx, cy, img_w, img_h)

        if bbox_gemma is None:
            return None
        if not bbox_gemma_is_valid(bbox_gemma):
            return None

        domain = str(row.get("domain", row.get("website", ""))).strip()

        return {
            "screenshot": image_path,
            "instruction": instruction,
            "bbox_gemma": bbox_gemma,
            "bbox_norm": [round(v, 6) for v in bbox_norm],
            "platform": "web",
            "app": domain or "browser",
            "source": "mind2web",
        }

    except Exception:
        return None


def read_tracker_sessions(tracker_dir: Path) -> Iterator[dict]:
    """
    Read custom tracker session data from /tracker/sessions/.

    Each session directory contains:
      - screenshots/*.jpg  (or *.png)
      - events.jsonl       (one event per line)

    Each events.jsonl line:
      {
        "type": "click" | "double_click" | "scroll" | ...,
        "x": float,         # pixel x
        "y": float,         # pixel y
        "screenshot": "screenshots/frame_001.jpg",
        "width": int,       # screen width
        "height": int,      # screen height
        "element": str,     # description of clicked element
        "app": str,
        "timestamp": float
      }
    """
    if not tracker_dir.exists():
        return

    session_dirs = [d for d in sorted(tracker_dir.iterdir()) if d.is_dir()]
    if not session_dirs:
        return

    info(f"Reading {len(session_dirs)} tracker sessions...")

    for session_dir in session_dirs:
        events_file = session_dir / "events.jsonl"
        if not events_file.exists():
            # Also try metadata.json
            events_file = session_dir / "metadata.json"
        if not events_file.exists():
            continue

        try:
            with open(events_file) as f:
                lines = f.readlines()

            for line in lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Skip non-click actions
                action = str(row.get("type", row.get("action", "click"))).lower()
                if not action_is_click(action):
                    continue

                # Image path
                screenshot_rel = row.get("screenshot", "")
                if screenshot_rel:
                    image_path = str(session_dir / screenshot_rel)
                else:
                    continue

                valid, img_w, img_h = validate_image(image_path)
                if not valid:
                    continue

                # Use recorded width/height if available (handles Retina scaling)
                screen_w = int(row.get("width", img_w))
                screen_h = int(row.get("height", img_h))

                # Coordinates
                x = float(row.get("x", 0))
                y = float(row.get("y", 0))

                # Check bounds (x, y must be within screen)
                if not (0 <= x <= screen_w and 0 <= y <= screen_h):
                    continue

                bbox_gemma, bbox_norm = click_point_to_outputs(x, y, screen_w, screen_h)

                if not bbox_gemma_is_valid(bbox_gemma):
                    continue

                instruction = str(row.get("element", row.get("description", ""))).strip()
                if instruction:
                    instruction = f"Click the {instruction}"
                else:
                    continue

                app = str(row.get("app", row.get("application", ""))).strip()

                if has_windows_ui(instruction, app):
                    continue

                yield {
                    "screenshot": image_path,
                    "instruction": instruction,
                    "bbox_gemma": bbox_gemma,
                    "bbox_norm": [round(v, 6) for v in bbox_norm],
                    "platform": "macos",
                    "app": app or "unknown",
                    "source": "tracker",
                }

        except Exception as e:
            warn(f"  Error reading {session_dir.name}: {e}")


# ===========================================================================
# SYNTHETIC DATA GENERATOR
# ===========================================================================

def generate_synthetic_examples() -> list[dict]:
    """
    Generate 5 synthetic Mac screenshot examples for testing the pipeline
    when no real datasets are available.

    These are purely descriptive -- they reference placeholder image paths and
    contain realistic-looking bboxes. Do NOT use for actual training.
    """
    info("Generating synthetic Mac examples for pipeline testing...")

    # Each example gets its own distinct image so deduplication doesn't collapse them.
    # Colors are varied per example -- different file contents = different MD5 hash.
    # Dimensions are realistic Mac Retina (1440x900 logical = 2880x1800 physical).

    synthetic_dir = FILTERED_DIR / "synthetic_images"
    synthetic_dir.mkdir(parents=True, exist_ok=True)

    # (instruction, app, platform, bbox_px [x1,y1,x2,y2], img_wh, bg_color_rgb)
    examples_spec = [
        {
            "instruction": "Click the Compose button to write a new email",
            "app": "Mail",
            "platform": "macos",
            # Compose button top-left in Mail.app sidebar -- roughly x=20-90, y=70-105
            "bbox_px": (20, 70, 90, 105),
            "img_wh": (1920, 1080),
            "bg_color": (245, 245, 247),  # macOS light gray
        },
        {
            "instruction": "Click the Search field in the toolbar",
            "app": "Safari",
            "platform": "macos",
            # Safari address bar spans most of toolbar -- x=480-1440, y=50-82
            "bbox_px": (480, 50, 1440, 82),
            "img_wh": (1920, 1080),
            "bg_color": (255, 255, 255),  # white Safari window
        },
        {
            "instruction": "Click the New Folder button in Finder",
            "app": "Finder",
            "platform": "macos",
            # Finder toolbar action button -- x=116-158, y=55-85
            "bbox_px": (116, 55, 158, 85),
            "img_wh": (1920, 1080),
            "bg_color": (236, 236, 236),  # Finder sidebar gray
        },
        {
            "instruction": "Click the red close button to dismiss the dialog",
            "app": "System Preferences",
            "platform": "macos",
            # Traffic-light close button -- x=16-28, y=16-28
            "bbox_px": (16, 16, 28, 28),
            "img_wh": (1920, 1080),
            "bg_color": (248, 248, 250),  # System Prefs light background
        },
        {
            "instruction": "Click the Save button in the Notes editor",
            "app": "Notes",
            "platform": "macos",
            # Notes Done/Save button top-right -- x=1780-1860, y=58-84
            "bbox_px": (1780, 58, 1860, 84),
            "img_wh": (1920, 1080),
            "bg_color": (255, 249, 196),  # Notes yellow background
        },
    ]

    results = []
    for idx, spec in enumerate(examples_spec):
        x1, y1, x2, y2 = spec["bbox_px"]
        w, h = spec["img_wh"]

        # Generate a unique image for this example
        image_path = str(synthetic_dir / f"synthetic_{idx:03d}_{spec['app'].lower()}.jpg")
        if PIL_AVAILABLE:
            try:
                img = Image.new("RGB", (w, h), color=spec["bg_color"])
                # Draw a faint bbox rectangle to make the image non-trivial
                from PIL import ImageDraw
                draw = ImageDraw.Draw(img)
                # Highlight the target element in a slightly different shade
                r, g, b = spec["bg_color"]
                highlight = (max(0, r - 30), max(0, g - 30), min(255, b + 20))
                draw.rectangle([x1, y1, x2, y2], fill=highlight, outline=(100, 100, 200))
                img.save(image_path, "JPEG", quality=90)
            except Exception as e:
                warn(f"  Could not create synthetic image {idx}: {e}")
                # Write a tiny sentinel file so the path is non-empty
                Path(image_path).write_bytes(b"SYNTH")

        else:
            # No Pillow -- write a unique binary sentinel so hashes differ
            Path(image_path).write_bytes(f"SYNTHETIC_{idx}_{spec['app']}".encode())

        bbox_gemma, bbox_norm = pixel_box_to_outputs(x1, y1, x2, y2, w, h)

        if not bbox_gemma_is_valid(bbox_gemma):
            warn(f"  Synthetic example has invalid bbox: {spec['instruction']}")
            continue

        results.append({
            "screenshot": image_path,
            "instruction": spec["instruction"],
            "bbox_gemma": bbox_gemma,
            "bbox_norm": [round(v, 6) for v in bbox_norm],
            "platform": spec["platform"],
            "app": spec["app"],
            "source": "synthetic",
        })

    ok(f"  Generated {len(results)} synthetic examples.")
    return results


# ===========================================================================
# DEDUPLICATION
# ===========================================================================

def deduplicate(examples: list[dict]) -> list[dict]:
    """
    Remove examples with duplicate screenshots using MD5 file hash.
    Keeps the first occurrence.
    """
    seen_hashes: set[str] = set()
    unique = []
    dupes = 0

    for ex in examples:
        h = image_hash(ex["screenshot"])
        if h is None:
            # Can't hash (file missing or unreadable) -- skip
            dupes += 1
            continue
        if h in seen_hashes:
            dupes += 1
            continue
        seen_hashes.add(h)
        unique.append(ex)

    if dupes:
        info(f"  Removed {dupes} duplicate/missing-image examples.")
    return unique


# ===========================================================================
# MAIN PIPELINE
# ===========================================================================

def compute_quality_score(examples: list[dict]) -> float:
    """
    Compute an overall quality score 0-100 for the dataset.

    Criteria:
      - % of examples with valid bboxes (already guaranteed by filters)
      - % of examples that are Mac/web (not synthetic)
      - Average normalized bbox area (bigger target = higher confidence label)
    """
    if not examples:
        return 0.0

    mac_count = sum(1 for e in examples if e["platform"] == "macos")
    mac_frac = mac_count / len(examples)

    # Average bbox area in normalized coords
    total_area = 0.0
    for ex in examples:
        xmin, ymin, xmax, ymax = ex["bbox_norm"]
        total_area += (xmax - xmin) * (ymax - ymin)
    avg_area = total_area / len(examples)

    # Score: 50% from Mac ratio, 30% from non-synthetic, 20% from bbox area clarity
    non_synthetic = sum(1 for e in examples if e["source"] != "synthetic")
    source_score = non_synthetic / len(examples)

    # Ideal bbox area: 0.001-0.01 (small but not tiny)
    # Score degrades outside that range
    area_score = 1.0 - min(1.0, abs(avg_area - 0.005) / 0.01)

    score = (mac_frac * 50) + (source_score * 30) + (area_score * 20)
    return round(score, 1)


def print_summary(all_examples: list[dict], train: list[dict], val: list[dict]):
    """Print a formatted summary of the filtered dataset."""
    by_source: dict[str, int] = {}
    by_platform: dict[str, int] = {}
    by_app: dict[str, int] = {}

    for ex in all_examples:
        by_source[ex["source"]] = by_source.get(ex["source"], 0) + 1
        by_platform[ex["platform"]] = by_platform.get(ex["platform"], 0) + 1
        app = ex["app"] or "unknown"
        by_app[app] = by_app.get(app, 0) + 1

    # Average bbox area
    total_area = 0.0
    for ex in all_examples:
        xmin, ymin, xmax, ymax = ex["bbox_norm"]
        total_area += (xmax - xmin) * (ymax - ymin)
    avg_area = (total_area / len(all_examples) * 100) if all_examples else 0

    quality = compute_quality_score(all_examples)

    print()
    print("=" * 60)
    print("  FILTER SUMMARY")
    print("=" * 60)
    print(f"  Total examples:  {len(all_examples)}")
    print(f"  Train split:     {len(train)}")
    print(f"  Val split:       {len(val)}")
    print(f"  Quality score:   {quality}/100")
    print(f"  Avg bbox area:   {avg_area:.3f}%")
    print()
    print("  By source:")
    for src, cnt in sorted(by_source.items(), key=lambda x: -x[1]):
        pct = 100 * cnt / len(all_examples) if all_examples else 0
        print(f"    {src:<15} {cnt:>6}  ({pct:.1f}%)")
    print()
    print("  By platform:")
    for plat, cnt in sorted(by_platform.items(), key=lambda x: -x[1]):
        pct = 100 * cnt / len(all_examples) if all_examples else 0
        print(f"    {plat:<15} {cnt:>6}  ({pct:.1f}%)")
    print()
    top_apps = sorted(by_app.items(), key=lambda x: -x[1])[:10]
    print("  Top apps:")
    for app, cnt in top_apps:
        print(f"    {app:<20} {cnt:>6}")
    print("=" * 60)
    print()


def run_filter(
    val_split: float = 0.1,
    dry_run: bool = False,
    synthetic_only: bool = False,
    seed: int = 42,
):
    """Main entry point: read, filter, deduplicate, split, write."""
    random.seed(seed)

    datasets_base = DATASETS_DIR

    # Tracker sessions directory (sibling to training/)
    tracker_sessions = DATASETS_DIR.parent.parent / "tracker" / "sessions"

    # ---------- Collect examples ----------
    all_examples: list[dict] = []
    any_real_data = False

    if not synthetic_only:
        # OmniACT
        for ex in read_omniact(datasets_base):
            all_examples.append(ex)
            any_real_data = True

        # ScreenSpot
        for ex in read_screenspot(datasets_base):
            all_examples.append(ex)
            any_real_data = True

        # Mind2Web
        for ex in read_mind2web(datasets_base):
            all_examples.append(ex)
            any_real_data = True

        # Tracker sessions
        for ex in read_tracker_sessions(tracker_sessions):
            all_examples.append(ex)
            any_real_data = True

    # If no real data, generate synthetic examples for pipeline testing
    if not all_examples:
        warn("No real datasets found. Generating synthetic examples for pipeline testing.")
        all_examples = generate_synthetic_examples()
    elif synthetic_only:
        all_examples = generate_synthetic_examples()

    info(f"Collected {len(all_examples)} examples before deduplication.")

    # ---------- Deduplication ----------
    all_examples = deduplicate(all_examples)
    info(f"After deduplication: {len(all_examples)} examples.")

    # ---------- Shuffle and split ----------
    random.shuffle(all_examples)
    n_val = max(1, int(len(all_examples) * val_split))
    val_set = all_examples[:n_val]
    train_set = all_examples[n_val:]

    # ---------- Summary ----------
    print_summary(all_examples, train_set, val_set)

    if dry_run:
        info("Dry run -- no files written.")
        return

    # ---------- Write JSONL ----------
    FILTERED_DIR.mkdir(parents=True, exist_ok=True)

    with open(TRAIN_PATH, "w") as f:
        for ex in train_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    with open(VAL_PATH, "w") as f:
        for ex in val_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    ok(f"Wrote {len(train_set)} train examples to:  {TRAIN_PATH}")
    ok(f"Wrote {len(val_set)} val examples to:    {VAL_PATH}")

    # Write a manifest for downstream tools
    manifest = {
        "train": str(TRAIN_PATH),
        "val": str(VAL_PATH),
        "total_examples": len(all_examples),
        "train_count": len(train_set),
        "val_count": len(val_set),
        "sources": list({ex["source"] for ex in all_examples}),
        "platforms": list({ex["platform"] for ex in all_examples}),
        "quality_score": compute_quality_score(all_examples),
        "val_split": val_split,
        "seed": seed,
    }
    manifest_path = FILTERED_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    ok(f"Manifest written to:             {manifest_path}")


# ===========================================================================
# CLI
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Filter and clean GUI grounding datasets for Gemma 4 E2B",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--val-split",
        type=float,
        default=0.1,
        metavar="RATIO",
        help="Fraction of data to reserve for validation (default: 0.1)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary stats without writing any files",
    )
    parser.add_argument(
        "--synthetic-only",
        action="store_true",
        help="Skip real datasets, generate synthetic examples only (for testing)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for shuffle/split (default: 42)",
    )
    args = parser.parse_args()

    run_filter(
        val_split=args.val_split,
        dry_run=args.dry_run,
        synthetic_only=args.synthetic_only,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
