#!/usr/bin/env python3
"""
data_converter.py -- Converts GUI grounding datasets into Gemma 4 E2B training format.

Converts OmniACT, ScreenSpot, Mind2Web, and custom tracker data into a unified
conversation format with Gemma's native bounding box output:
  [{"box_2d": [y_min, x_min, y_max, x_max], "label": "element"}]

Coordinates are normalized to Gemma's 0-1000 scale.
Order is [y_min, x_min, y_max, x_max] -- NOT x,y order.

Usage:
  python data_converter.py                         # Convert all datasets
  python data_converter.py --only omniact          # Convert one dataset
  python data_converter.py --tracker-dir path/     # Convert custom tracker data
  python data_converter.py --validate              # Validate output integrity
  python data_converter.py --stats                 # Show dataset statistics
"""

import json
import os
import sys
import argparse
import random
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict

from PIL import Image
from rich.console import Console
from rich.table import Table
from rich.progress import track
from tqdm import tqdm

console = Console()

BASE_DIR = Path(__file__).parent
DATASETS_DIR = BASE_DIR / "datasets"
OUTPUT_DIR = BASE_DIR / "datasets" / "converted"

# Gemma 4 E2B coordinate system: 0-1000 normalized, [y_min, x_min, y_max, x_max]
GEMMA_COORD_SCALE = 1000

# Default bounding box half-size for click-point datasets (in Gemma coords)
# A click point gets expanded to a small box around it
CLICK_BOX_HALF = 15  # ~1.5% of image dimension


@dataclass
class ConvertedSample:
    """A single converted training sample."""
    image_path: str
    instruction: str
    boxes: list  # List of {"box_2d": [y1, x1, y2, x2], "label": str}
    source_dataset: str
    platform: str = "unknown"  # mac, windows, web, mobile
    action_type: str = "click"  # click, type, scroll, etc.


# --------------------------------------------------------------------------
# Coordinate Utilities
# --------------------------------------------------------------------------

def normalize_to_gemma(x: float, y: float, img_w: int, img_h: int) -> tuple[int, int]:
    """Convert pixel coords to Gemma 0-1000 scale. Returns (y_norm, x_norm)."""
    x_norm = int(round((x / img_w) * GEMMA_COORD_SCALE))
    y_norm = int(round((y / img_h) * GEMMA_COORD_SCALE))
    return (
        max(0, min(GEMMA_COORD_SCALE, y_norm)),
        max(0, min(GEMMA_COORD_SCALE, x_norm)),
    )


def fractional_to_gemma(x_frac: float, y_frac: float) -> tuple[int, int]:
    """Convert 0-1 fractional coords to Gemma 0-1000. Returns (y_norm, x_norm)."""
    x_norm = int(round(x_frac * GEMMA_COORD_SCALE))
    y_norm = int(round(y_frac * GEMMA_COORD_SCALE))
    return (
        max(0, min(GEMMA_COORD_SCALE, y_norm)),
        max(0, min(GEMMA_COORD_SCALE, x_norm)),
    )


def click_to_box(y_norm: int, x_norm: int, half: int = CLICK_BOX_HALF) -> list[int]:
    """Expand a click point to a bounding box [y1, x1, y2, x2] in Gemma coords."""
    return [
        max(0, y_norm - half),
        max(0, x_norm - half),
        min(GEMMA_COORD_SCALE, y_norm + half),
        min(GEMMA_COORD_SCALE, x_norm + half),
    ]


def pixel_box_to_gemma(
    x1: int, y1: int, x2: int, y2: int, img_w: int, img_h: int
) -> list[int]:
    """Convert pixel bounding box to Gemma [y_min, x_min, y_max, x_max]."""
    y1_n, x1_n = normalize_to_gemma(x1, y1, img_w, img_h)
    y2_n, x2_n = normalize_to_gemma(x2, y2, img_w, img_h)
    return [
        min(y1_n, y2_n),
        min(x1_n, x2_n),
        max(y1_n, y2_n),
        max(x1_n, x2_n),
    ]


def get_image_size(image_path: str) -> tuple[int, int]:
    """Get image dimensions without loading full image into memory."""
    try:
        with Image.open(image_path) as img:
            return img.size  # (width, height)
    except Exception:
        return (0, 0)


# --------------------------------------------------------------------------
# Format Output
# --------------------------------------------------------------------------

def format_sample(sample: ConvertedSample) -> dict:
    """Format a ConvertedSample into the Gemma 4 E2B conversation format."""
    box_json = json.dumps(sample.boxes, separators=(",", ":"))
    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": sample.image_path},
                    {"type": "text", "text": sample.instruction},
                ],
            },
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": box_json},
                ],
            },
        ],
        "metadata": {
            "source": sample.source_dataset,
            "platform": sample.platform,
            "action_type": sample.action_type,
        },
    }


# --------------------------------------------------------------------------
# OmniACT Converter
# --------------------------------------------------------------------------

def convert_omniact() -> list[ConvertedSample]:
    """
    Convert OmniACT dataset.

    OmniACT structure:
    - data/ directory with JSON annotations
    - Each annotation has: screenshot path, element bounding boxes, PyAutoGUI actions
    - Bounding boxes are in pixel coordinates
    """
    omniact_dir = DATASETS_DIR / "omniact"
    if not omniact_dir.exists():
        console.print("[yellow]OmniACT not found. Run data_downloader.py first.[/yellow]")
        return []

    samples = []
    console.print("[cyan]Converting OmniACT...[/cyan]")

    # OmniACT stores data in parquet or json format
    # Try loading via HuggingFace datasets first
    try:
        from datasets import load_from_disk, load_dataset
    except ImportError:
        console.print("[red]Install 'datasets' package.[/red]")
        return []

    try:
        # Try loading as a HuggingFace dataset from disk
        ds = load_dataset(str(omniact_dir), trust_remote_code=True)
    except Exception:
        try:
            ds = load_from_disk(str(omniact_dir))
        except Exception:
            # Fall back to scanning for parquet/json files
            ds = None

    if ds is not None:
        # Process each split
        for split_name in ds:
            split = ds[split_name]
            console.print(f"  Processing split '{split_name}': {len(split)} samples")
            for i, row in enumerate(tqdm(split, desc=f"  OmniACT/{split_name}", leave=False)):
                sample = _convert_omniact_row(row, omniact_dir, i, split_name)
                if sample:
                    samples.append(sample)
    else:
        # Scan for annotation files directly
        for json_file in sorted(omniact_dir.rglob("*.json")):
            try:
                with open(json_file) as f:
                    data = json.load(f)
                if isinstance(data, list):
                    for i, row in enumerate(data):
                        sample = _convert_omniact_row(row, omniact_dir, i, "manual")
                        if sample:
                            samples.append(sample)
                elif isinstance(data, dict):
                    sample = _convert_omniact_row(data, omniact_dir, 0, "manual")
                    if sample:
                        samples.append(sample)
            except Exception as e:
                console.print(f"  [dim]Skipping {json_file.name}: {e}[/dim]")

    console.print(f"  [green]Converted {len(samples)} OmniACT samples.[/green]")
    return samples


def _convert_omniact_row(
    row: dict, base_dir: Path, idx: int, split: str
) -> Optional[ConvertedSample]:
    """Convert a single OmniACT row to ConvertedSample."""
    try:
        # OmniACT fields vary -- handle common schemas
        # Schema 1: {"image": PIL.Image or path, "instruction": str, "bbox": [x1,y1,x2,y2], ...}
        # Schema 2: {"screenshot": path, "action": str, "element_bbox": {...}, ...}

        # Get image
        image_path = None
        img_w, img_h = 0, 0

        if "image" in row:
            img = row["image"]
            if isinstance(img, str):
                image_path = str(base_dir / img)
                img_w, img_h = get_image_size(image_path)
            elif hasattr(img, "size"):
                # PIL Image -- save it
                img_w, img_h = img.size
                save_dir = OUTPUT_DIR / "images" / "omniact"
                save_dir.mkdir(parents=True, exist_ok=True)
                image_path = str(save_dir / f"{split}_{idx}.jpg")
                if not Path(image_path).exists():
                    img.convert("RGB").save(image_path, "JPEG", quality=85)
        elif "screenshot" in row:
            image_path = str(base_dir / row["screenshot"])
            img_w, img_h = get_image_size(image_path)

        if not image_path or img_w == 0:
            return None

        # Get instruction
        instruction = (
            row.get("instruction")
            or row.get("task")
            or row.get("action_description")
            or row.get("query")
            or ""
        )
        if not instruction:
            return None

        # Get bounding box
        boxes = []

        # Try direct bbox field
        if "bbox" in row:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                x1, y1, x2, y2 = [float(v) for v in bbox]
                # Determine if pixel or fractional coords
                if all(v <= 1.0 for v in [x1, y1, x2, y2]):
                    gemma_box = [
                        int(y1 * GEMMA_COORD_SCALE),
                        int(x1 * GEMMA_COORD_SCALE),
                        int(y2 * GEMMA_COORD_SCALE),
                        int(x2 * GEMMA_COORD_SCALE),
                    ]
                else:
                    gemma_box = pixel_box_to_gemma(
                        int(x1), int(y1), int(x2), int(y2), img_w, img_h
                    )
                boxes.append({
                    "box_2d": gemma_box,
                    "label": row.get("element_name", row.get("label", "target")),
                })

        # Try click coordinates (pyautogui format)
        elif "click_x" in row and "click_y" in row:
            cx, cy = float(row["click_x"]), float(row["click_y"])
            if cx <= 1.0 and cy <= 1.0:
                y_n, x_n = fractional_to_gemma(cx, cy)
            else:
                y_n, x_n = normalize_to_gemma(cx, cy, img_w, img_h)
            boxes.append({
                "box_2d": click_to_box(y_n, x_n),
                "label": row.get("element_name", "target"),
            })

        # Try element_bbox dict
        elif "element_bbox" in row:
            eb = row["element_bbox"]
            if isinstance(eb, dict):
                x1 = float(eb.get("x", eb.get("left", 0)))
                y1 = float(eb.get("y", eb.get("top", 0)))
                w = float(eb.get("width", eb.get("w", 0)))
                h = float(eb.get("height", eb.get("h", 0)))
                gemma_box = pixel_box_to_gemma(
                    int(x1), int(y1), int(x1 + w), int(y1 + h), img_w, img_h
                )
                boxes.append({
                    "box_2d": gemma_box,
                    "label": row.get("element_name", "target"),
                })

        if not boxes:
            return None

        return ConvertedSample(
            image_path=image_path,
            instruction=instruction,
            boxes=boxes,
            source_dataset="omniact",
            platform="mac",
            action_type=row.get("action_type", "click"),
        )

    except Exception as e:
        return None


# --------------------------------------------------------------------------
# ScreenSpot Converter
# --------------------------------------------------------------------------

def convert_screenspot() -> list[ConvertedSample]:
    """
    Convert ScreenSpot dataset.

    ScreenSpot provides click grounding with:
    - Screenshots from Mac, Windows, Web, Mobile
    - Click targets in 0-1 normalized coordinates (or pixel coords)
    - Bounding boxes in [x1, y1, x2, y2] format
    """
    ss_dir = DATASETS_DIR / "screenspot"
    if not ss_dir.exists():
        console.print("[yellow]ScreenSpot not found. Run data_downloader.py first.[/yellow]")
        return []

    samples = []
    console.print("[cyan]Converting ScreenSpot...[/cyan]")

    try:
        from datasets import load_from_disk, load_dataset
    except ImportError:
        console.print("[red]Install 'datasets' package.[/red]")
        return []

    try:
        ds = load_dataset(str(ss_dir), trust_remote_code=True)
    except Exception:
        try:
            ds = load_from_disk(str(ss_dir))
        except Exception:
            ds = None

    if ds is not None:
        for split_name in ds:
            split = ds[split_name]
            console.print(f"  Processing split '{split_name}': {len(split)} samples")
            for i, row in enumerate(tqdm(split, desc=f"  ScreenSpot/{split_name}", leave=False)):
                sample = _convert_screenspot_row(row, ss_dir, i, split_name)
                if sample:
                    samples.append(sample)
    else:
        # Try JSON files
        for json_file in sorted(ss_dir.rglob("*.json")):
            try:
                with open(json_file) as f:
                    data = json.load(f)
                rows = data if isinstance(data, list) else [data]
                for i, row in enumerate(rows):
                    sample = _convert_screenspot_row(row, ss_dir, i, "manual")
                    if sample:
                        samples.append(sample)
            except Exception:
                pass

    console.print(f"  [green]Converted {len(samples)} ScreenSpot samples.[/green]")
    return samples


def _convert_screenspot_row(
    row: dict, base_dir: Path, idx: int, split: str
) -> Optional[ConvertedSample]:
    """Convert a single ScreenSpot row."""
    try:
        # Get image
        image_path = None
        img_w, img_h = 0, 0

        if "image" in row:
            img = row["image"]
            if isinstance(img, str):
                image_path = str(base_dir / img)
                img_w, img_h = get_image_size(image_path)
            elif hasattr(img, "size"):
                img_w, img_h = img.size
                save_dir = OUTPUT_DIR / "images" / "screenspot"
                save_dir.mkdir(parents=True, exist_ok=True)
                image_path = str(save_dir / f"{split}_{idx}.jpg")
                if not Path(image_path).exists():
                    img.convert("RGB").save(image_path, "JPEG", quality=85)
        elif "img_path" in row or "screenshot" in row:
            p = row.get("img_path") or row.get("screenshot")
            image_path = str(base_dir / p)
            img_w, img_h = get_image_size(image_path)

        if not image_path or img_w == 0:
            return None

        # Get instruction
        instruction = (
            row.get("instruction")
            or row.get("task")
            or row.get("query")
            or row.get("command")
            or ""
        )
        if not instruction:
            return None

        # Detect platform
        platform = "unknown"
        for key in ["platform", "source", "device_type"]:
            if key in row:
                val = str(row[key]).lower()
                if "mac" in val or "macos" in val:
                    platform = "mac"
                elif "win" in val:
                    platform = "windows"
                elif "web" in val or "browser" in val:
                    platform = "web"
                elif "mobile" in val or "ios" in val or "android" in val:
                    platform = "mobile"
                break

        # Get bounding box -- ScreenSpot uses various formats
        boxes = []
        label = row.get("element_name", row.get("label", "target"))

        # Format 1: bbox as [x1, y1, x2, y2] in 0-1 normalized
        if "bbox" in row:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                vals = [float(v) for v in bbox]
                if all(0 <= v <= 1.0 for v in vals):
                    # 0-1 normalized -> 0-1000
                    x1, y1, x2, y2 = vals
                    gemma_box = [
                        int(y1 * GEMMA_COORD_SCALE),
                        int(x1 * GEMMA_COORD_SCALE),
                        int(y2 * GEMMA_COORD_SCALE),
                        int(x2 * GEMMA_COORD_SCALE),
                    ]
                else:
                    # Pixel coords
                    gemma_box = pixel_box_to_gemma(
                        int(vals[0]), int(vals[1]),
                        int(vals[2]), int(vals[3]),
                        img_w, img_h,
                    )
                boxes.append({"box_2d": gemma_box, "label": label})

        # Format 2: click point
        elif "click_point" in row or ("x" in row and "y" in row):
            if "click_point" in row:
                pt = row["click_point"]
                cx = float(pt[0] if isinstance(pt, (list, tuple)) else pt.get("x", 0))
                cy = float(pt[1] if isinstance(pt, (list, tuple)) else pt.get("y", 0))
            else:
                cx, cy = float(row["x"]), float(row["y"])

            if cx <= 1.0 and cy <= 1.0:
                y_n, x_n = fractional_to_gemma(cx, cy)
            else:
                y_n, x_n = normalize_to_gemma(cx, cy, img_w, img_h)
            boxes.append({"box_2d": click_to_box(y_n, x_n), "label": label})

        if not boxes:
            return None

        return ConvertedSample(
            image_path=image_path,
            instruction=instruction,
            boxes=boxes,
            source_dataset="screenspot",
            platform=platform,
        )

    except Exception:
        return None


# --------------------------------------------------------------------------
# Mind2Web Converter
# --------------------------------------------------------------------------

def convert_mind2web() -> list[ConvertedSample]:
    """
    Convert Mind2Web dataset.

    Mind2Web has multi-step browser interactions:
    - Screenshots at each step
    - Element bounding boxes
    - Action type (click, type, select)
    - Text input for type actions
    """
    m2w_dir = DATASETS_DIR / "mind2web"
    if not m2w_dir.exists():
        console.print("[yellow]Mind2Web not found. Run data_downloader.py first.[/yellow]")
        return []

    samples = []
    console.print("[cyan]Converting Mind2Web...[/cyan]")

    try:
        from datasets import load_from_disk, load_dataset
    except ImportError:
        console.print("[red]Install 'datasets' package.[/red]")
        return []

    try:
        ds = load_dataset(str(m2w_dir), trust_remote_code=True)
    except Exception:
        try:
            ds = load_from_disk(str(m2w_dir))
        except Exception:
            ds = None

    if ds is not None:
        for split_name in ds:
            split = ds[split_name]
            console.print(f"  Processing split '{split_name}': {len(split)} samples")
            for i, row in enumerate(tqdm(split, desc=f"  Mind2Web/{split_name}", leave=False)):
                row_samples = _convert_mind2web_row(row, m2w_dir, i, split_name)
                samples.extend(row_samples)
    else:
        for json_file in sorted(m2w_dir.rglob("*.json"))[:50]:  # Cap for safety
            try:
                with open(json_file) as f:
                    data = json.load(f)
                rows = data if isinstance(data, list) else [data]
                for i, row in enumerate(rows):
                    samples.extend(_convert_mind2web_row(row, m2w_dir, i, "manual"))
            except Exception:
                pass

    console.print(f"  [green]Converted {len(samples)} Mind2Web samples.[/green]")
    return samples


def _convert_mind2web_row(
    row: dict, base_dir: Path, idx: int, split: str
) -> list[ConvertedSample]:
    """Convert a Mind2Web row. May produce multiple samples (one per action step)."""
    results = []

    try:
        # Mind2Web can have nested action sequences
        actions = row.get("actions", row.get("action_reprs", []))
        if not actions and "action" in row:
            actions = [row]

        # Get the screenshot
        image_path = None
        img_w, img_h = 0, 0

        if "image" in row:
            img = row["image"]
            if isinstance(img, str):
                image_path = str(base_dir / img)
                img_w, img_h = get_image_size(image_path)
            elif hasattr(img, "size"):
                img_w, img_h = img.size
                save_dir = OUTPUT_DIR / "images" / "mind2web"
                save_dir.mkdir(parents=True, exist_ok=True)
                image_path = str(save_dir / f"{split}_{idx}.jpg")
                if not Path(image_path).exists():
                    img.convert("RGB").save(image_path, "JPEG", quality=85)
        elif "screenshot" in row:
            sc = row["screenshot"]
            if isinstance(sc, str):
                image_path = str(base_dir / sc)
                img_w, img_h = get_image_size(image_path)
            elif hasattr(sc, "size"):
                img_w, img_h = sc.size
                save_dir = OUTPUT_DIR / "images" / "mind2web"
                save_dir.mkdir(parents=True, exist_ok=True)
                image_path = str(save_dir / f"{split}_{idx}.jpg")
                if not Path(image_path).exists():
                    sc.convert("RGB").save(image_path, "JPEG", quality=85)

        if not image_path or img_w == 0:
            return results

        # Process each action
        for action in (actions if isinstance(actions, list) else [actions]):
            if isinstance(action, str):
                # Action repr string -- skip, no coordinates
                continue

            if not isinstance(action, dict):
                continue

            # Get action type and instruction
            action_type = str(action.get("action_type", action.get("operation", "click"))).lower()
            element_name = action.get("element_name", action.get("tag", "element"))

            # Build instruction based on action type
            if action_type in ("click", "tap"):
                instruction = f"Click on {element_name}"
            elif action_type in ("type", "input"):
                text = action.get("value", action.get("text", ""))
                instruction = f"Click on the {element_name} input field to type: {text}"
            elif action_type == "select":
                value = action.get("value", "")
                instruction = f"Click on the {element_name} dropdown and select: {value}"
            elif action_type == "scroll":
                direction = action.get("direction", "down")
                instruction = f"Scroll {direction} on {element_name}"
            else:
                instruction = f"Interact with {element_name}"

            # Get bounding box
            bbox = action.get("bbox", action.get("element_bbox", None))
            if bbox and isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                vals = [float(v) for v in bbox]
                if all(0 <= v <= 1.0 for v in vals):
                    x1, y1, x2, y2 = vals
                    gemma_box = [
                        int(y1 * GEMMA_COORD_SCALE),
                        int(x1 * GEMMA_COORD_SCALE),
                        int(y2 * GEMMA_COORD_SCALE),
                        int(x2 * GEMMA_COORD_SCALE),
                    ]
                else:
                    gemma_box = pixel_box_to_gemma(
                        int(vals[0]), int(vals[1]),
                        int(vals[2]), int(vals[3]),
                        img_w, img_h,
                    )

                results.append(ConvertedSample(
                    image_path=image_path,
                    instruction=instruction,
                    boxes=[{"box_2d": gemma_box, "label": element_name}],
                    source_dataset="mind2web",
                    platform="web",
                    action_type=action_type,
                ))

    except Exception:
        pass

    return results


# --------------------------------------------------------------------------
# Custom Tracker Converter
# --------------------------------------------------------------------------

def convert_tracker(tracker_dir: str) -> list[ConvertedSample]:
    """
    Convert custom tracker JSONL data.

    Expected JSONL format per line:
    {
        "screenshot": "path/to/screenshot.jpg",
        "action": "click" | "type" | "scroll",
        "x": 450,         # pixel x
        "y": 230,         # pixel y
        "width": 1920,    # screen width
        "height": 1080,   # screen height
        "element": "Send button",
        "instruction": "Click the Send button",  # optional
        "text": "hello",  # for type actions, optional
        "bbox": [x1, y1, x2, y2],  # optional, pixel coords
        "timestamp": 1234567890
    }
    """
    tracker_path = Path(tracker_dir)
    if not tracker_path.exists():
        console.print(f"[yellow]Tracker directory not found: {tracker_path}[/yellow]")
        return []

    samples = []
    console.print(f"[cyan]Converting tracker data from {tracker_path}...[/cyan]")

    jsonl_files = list(tracker_path.rglob("*.jsonl")) + list(tracker_path.rglob("*.json"))

    for jf in tqdm(jsonl_files, desc="  Tracker files"):
        try:
            with open(jf) as f:
                if jf.suffix == ".jsonl":
                    lines = f.readlines()
                else:
                    content = f.read().strip()
                    if content.startswith("["):
                        lines = [json.dumps(item) for item in json.loads(content)]
                    else:
                        lines = [content]

            for line in lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue

                sample = _convert_tracker_row(row, tracker_path)
                if sample:
                    samples.append(sample)

        except Exception as e:
            console.print(f"  [dim]Error in {jf.name}: {e}[/dim]")

    console.print(f"  [green]Converted {len(samples)} tracker samples.[/green]")
    return samples


def _convert_tracker_row(row: dict, base_dir: Path) -> Optional[ConvertedSample]:
    """Convert a single tracker JSONL row."""
    try:
        # Get screenshot
        screenshot = row.get("screenshot", "")
        if not screenshot:
            return None

        image_path = str(base_dir / screenshot) if not os.path.isabs(screenshot) else screenshot
        if not Path(image_path).exists():
            return None

        img_w = int(row.get("width", 0))
        img_h = int(row.get("height", 0))
        if img_w == 0 or img_h == 0:
            img_w, img_h = get_image_size(image_path)
        if img_w == 0:
            return None

        # Get action info
        action = row.get("action", "click")
        element = row.get("element", "target")

        # Build instruction
        instruction = row.get("instruction", "")
        if not instruction:
            if action == "click":
                instruction = f"Click on {element}"
            elif action == "type":
                text = row.get("text", "")
                instruction = f"Click on {element} to type: {text}"
            elif action == "scroll":
                instruction = f"Scroll on {element}"
            else:
                instruction = f"Interact with {element}"

        # Get bounding box
        boxes = []
        if "bbox" in row:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                gemma_box = pixel_box_to_gemma(
                    int(bbox[0]), int(bbox[1]),
                    int(bbox[2]), int(bbox[3]),
                    img_w, img_h,
                )
                boxes.append({"box_2d": gemma_box, "label": element})
        elif "x" in row and "y" in row:
            x, y = float(row["x"]), float(row["y"])
            y_n, x_n = normalize_to_gemma(x, y, img_w, img_h)
            boxes.append({"box_2d": click_to_box(y_n, x_n), "label": element})
        else:
            return None

        return ConvertedSample(
            image_path=image_path,
            instruction=instruction,
            boxes=boxes,
            source_dataset="tracker",
            platform="mac",
            action_type=action,
        )

    except Exception:
        return None


# --------------------------------------------------------------------------
# Main Pipeline
# --------------------------------------------------------------------------

def write_output(samples: list[ConvertedSample], output_name: str):
    """Write converted samples to JSONL file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / f"{output_name}.jsonl"

    with open(output_file, "w") as f:
        for sample in samples:
            formatted = format_sample(sample)
            f.write(json.dumps(formatted, ensure_ascii=False) + "\n")

    console.print(f"  Wrote {len(samples)} samples to [bold]{output_file}[/bold]")
    return output_file


def create_splits(
    all_samples: list[ConvertedSample],
    train_ratio: float = 0.9,
    val_ratio: float = 0.05,
    test_ratio: float = 0.05,
    seed: int = 42,
):
    """Split samples into train/val/test and write separate JSONL files."""
    random.seed(seed)
    shuffled = list(all_samples)
    random.shuffle(shuffled)

    n = len(shuffled)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)

    train = shuffled[:n_train]
    val = shuffled[n_train : n_train + n_val]
    test = shuffled[n_train + n_val :]

    write_output(train, "train")
    write_output(val, "val")
    write_output(test, "test")

    return train, val, test


def validate_output():
    """Validate the converted output files."""
    console.print("\n[cyan]Validating output...[/cyan]")
    issues = 0

    for split in ["train", "val", "test"]:
        fpath = OUTPUT_DIR / f"{split}.jsonl"
        if not fpath.exists():
            console.print(f"  [red]Missing: {fpath}[/red]")
            issues += 1
            continue

        line_count = 0
        bad_lines = 0
        missing_images = 0

        with open(fpath) as f:
            for line_num, line in enumerate(f, 1):
                line_count += 1
                try:
                    data = json.loads(line)
                    msgs = data["messages"]
                    assert len(msgs) == 2
                    assert msgs[0]["role"] == "user"
                    assert msgs[1]["role"] == "assistant"

                    # Check image exists
                    user_content = msgs[0]["content"]
                    image_item = next(
                        (c for c in user_content if c.get("type") == "image"), None
                    )
                    if image_item and not Path(image_item["image"]).exists():
                        missing_images += 1

                    # Validate box format
                    assistant_text = msgs[1]["content"][0]["text"]
                    boxes = json.loads(assistant_text)
                    for box in boxes:
                        coords = box["box_2d"]
                        assert len(coords) == 4
                        assert all(0 <= c <= GEMMA_COORD_SCALE for c in coords)
                        assert "label" in box

                except Exception as e:
                    bad_lines += 1
                    if bad_lines <= 3:
                        console.print(f"  [red]Line {line_num} in {split}: {e}[/red]")

        status = "[green]OK[/green]" if bad_lines == 0 else f"[red]{bad_lines} errors[/red]"
        console.print(
            f"  {split}: {line_count} samples, {status}"
            + (f", {missing_images} missing images" if missing_images else "")
        )
        issues += bad_lines

    if issues == 0:
        console.print("[bold green]All validations passed.[/bold green]")
    else:
        console.print(f"[bold red]{issues} total issues found.[/bold red]")


def show_stats():
    """Show statistics about converted datasets."""
    table = Table(title="Converted Dataset Statistics")
    table.add_column("Split", style="cyan")
    table.add_column("Samples", style="green", justify="right")
    table.add_column("Size", style="yellow", justify="right")
    table.add_column("Sources", style="dim")

    for split in ["train", "val", "test"]:
        fpath = OUTPUT_DIR / f"{split}.jsonl"
        if not fpath.exists():
            table.add_row(split, "-", "-", "-")
            continue

        sources = {}
        count = 0
        with open(fpath) as f:
            for line in f:
                count += 1
                try:
                    data = json.loads(line)
                    src = data.get("metadata", {}).get("source", "unknown")
                    sources[src] = sources.get(src, 0) + 1
                except Exception:
                    pass

        size = fpath.stat().st_size
        size_str = f"{size / 1024 / 1024:.1f} MB" if size > 1024 * 1024 else f"{size / 1024:.0f} KB"
        src_str = ", ".join(f"{k}:{v}" for k, v in sorted(sources.items()))
        table.add_row(split, str(count), size_str, src_str)

    console.print(table)


def main():
    parser = argparse.ArgumentParser(
        description="Convert GUI grounding datasets to Gemma 4 E2B format"
    )
    parser.add_argument(
        "--only",
        choices=["omniact", "screenspot", "mind2web"],
        help="Convert only this dataset",
    )
    parser.add_argument(
        "--tracker-dir",
        type=str,
        help="Path to custom tracker JSONL data directory",
    )
    parser.add_argument("--validate", action="store_true", help="Validate output files")
    parser.add_argument("--stats", action="store_true", help="Show dataset statistics")
    parser.add_argument(
        "--train-ratio", type=float, default=0.9, help="Training split ratio (default 0.9)"
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for splits")
    args = parser.parse_args()

    from rich.panel import Panel

    console.print(Panel.fit(
        "[bold cyan]Gemma 4 E2B -- Dataset Converter[/bold cyan]\n"
        "[dim]Converts to Gemma native bounding box format (0-1000 scale)[/dim]",
        border_style="blue",
    ))

    if args.stats:
        show_stats()
        return

    if args.validate:
        validate_output()
        return

    all_samples = []

    # Convert requested datasets
    if args.only:
        converters = {
            "omniact": convert_omniact,
            "screenspot": convert_screenspot,
            "mind2web": convert_mind2web,
        }
        samples = converters[args.only]()
        all_samples.extend(samples)
    else:
        # Convert all datasets
        all_samples.extend(convert_omniact())
        all_samples.extend(convert_screenspot())
        all_samples.extend(convert_mind2web())

    # Convert tracker data if provided
    if args.tracker_dir:
        all_samples.extend(convert_tracker(args.tracker_dir))

    if not all_samples:
        console.print("[red]No samples converted. Check that datasets are downloaded.[/red]")
        return

    # Create train/val/test splits
    console.print(f"\n[cyan]Creating splits from {len(all_samples)} total samples...[/cyan]")
    val_ratio = (1 - args.train_ratio) / 2
    train, val, test = create_splits(
        all_samples,
        train_ratio=args.train_ratio,
        val_ratio=val_ratio,
        test_ratio=val_ratio,
        seed=args.seed,
    )

    console.print(f"\n[bold green]Conversion complete.[/bold green]")
    console.print(f"  Train: {len(train)} | Val: {len(val)} | Test: {len(test)}")
    console.print(f"  Output: {OUTPUT_DIR}")

    # Validate
    validate_output()


if __name__ == "__main__":
    main()
