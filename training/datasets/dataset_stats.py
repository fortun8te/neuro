#!/usr/bin/env python3
"""
dataset_stats.py -- Statistics and sample previews for filtered GUI grounding datasets.

Reads the filtered JSONL files produced by filter_data.py and prints:
  - Example count per source
  - Mac vs non-Mac breakdown
  - Average bbox size (normalized area)
  - Bbox size distribution (tiny / small / medium / large)
  - Sample previews (instruction + bbox + app)
  - Quality heatmap by (platform x source)

Usage:
  python dataset_stats.py                   # Stats on filtered/train.jsonl + val.jsonl
  python dataset_stats.py --file path.jsonl # Stats on a specific file
  python dataset_stats.py --samples 10      # Show 10 random sample previews
  python dataset_stats.py --full            # All stats + samples
"""

import argparse
import json
import os
import random
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Optional rich for pretty output
# ---------------------------------------------------------------------------
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.bar import Bar
    RICH_AVAILABLE = True
    console = Console()
except ImportError:
    RICH_AVAILABLE = False
    console = None

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
FILTERED_DIR = SCRIPT_DIR / "filtered"
TRAIN_PATH = FILTERED_DIR / "train.jsonl"
VAL_PATH   = FILTERED_DIR / "val.jsonl"

GEMMA_SCALE = 1000


# ===========================================================================
# Helpers
# ===========================================================================

def load_jsonl(path: Path) -> list[dict]:
    """Load a JSONL file, return list of dicts. Skips malformed lines."""
    examples = []
    if not path.exists():
        return examples
    with open(path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                examples.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"  [WARN] Line {lineno}: JSON parse error: {e}")
    return examples


def bbox_area_norm(bbox_norm: list[float]) -> float:
    """Return normalized area [0-1] of a bbox_norm [x1, y1, x2, y2]."""
    x1, y1, x2, y2 = bbox_norm
    return max(0.0, (x2 - x1)) * max(0.0, (y2 - y1))


def bbox_dims_gemma(bbox_gemma: list[int]) -> tuple[int, int]:
    """Return (width, height) in Gemma 0-1000 coords."""
    y1, x1, y2, x2 = bbox_gemma
    return abs(x2 - x1), abs(y2 - y1)


def size_bucket(area_norm: float) -> str:
    """
    Categorize a bbox by its normalized area.
      tiny:   < 0.0001  (~10x10px on 1920x1080)
      small:  < 0.001   (~30x30px)
      medium: < 0.01    (~100x100px)
      large:  >= 0.01
    """
    if area_norm < 0.0001:
        return "tiny"
    elif area_norm < 0.001:
        return "small"
    elif area_norm < 0.01:
        return "medium"
    else:
        return "large"


def truncate(s: str, max_len: int = 60) -> str:
    return s if len(s) <= max_len else s[:max_len - 3] + "..."


# ===========================================================================
# Stats computation
# ===========================================================================

def compute_stats(examples: list[dict]) -> dict:
    """Compute a stats dict from a list of examples."""
    stats = {
        "total": len(examples),
        "by_source": defaultdict(int),
        "by_platform": defaultdict(int),
        "by_app": defaultdict(int),
        "size_buckets": defaultdict(int),
        "areas": [],
        "bbox_widths": [],   # in Gemma coords
        "bbox_heights": [],
        "mac_count": 0,
        "non_mac_count": 0,
    }

    for ex in examples:
        source   = ex.get("source", "unknown")
        platform = ex.get("platform", "unknown")
        app      = ex.get("app", "unknown")

        stats["by_source"][source] += 1
        stats["by_platform"][platform] += 1
        stats["by_app"][app] += 1

        if platform == "macos":
            stats["mac_count"] += 1
        else:
            stats["non_mac_count"] += 1

        bbox_norm = ex.get("bbox_norm")
        if bbox_norm and len(bbox_norm) == 4:
            area = bbox_area_norm(bbox_norm)
            stats["areas"].append(area)
            stats["size_buckets"][size_bucket(area)] += 1

        bbox_gemma = ex.get("bbox_gemma")
        if bbox_gemma and len(bbox_gemma) == 4:
            w, h = bbox_dims_gemma(bbox_gemma)
            stats["bbox_widths"].append(w)
            stats["bbox_heights"].append(h)

    # Aggregate numeric stats
    if stats["areas"]:
        stats["avg_area_pct"] = 100 * sum(stats["areas"]) / len(stats["areas"])
        stats["median_area_pct"] = 100 * sorted(stats["areas"])[len(stats["areas"]) // 2]
        stats["min_area_pct"] = 100 * min(stats["areas"])
        stats["max_area_pct"] = 100 * max(stats["areas"])
    else:
        stats["avg_area_pct"] = stats["median_area_pct"] = 0.0
        stats["min_area_pct"] = stats["max_area_pct"] = 0.0

    if stats["bbox_widths"]:
        stats["avg_width_gemma"]  = sum(stats["bbox_widths"]) / len(stats["bbox_widths"])
        stats["avg_height_gemma"] = sum(stats["bbox_heights"]) / len(stats["bbox_heights"])
    else:
        stats["avg_width_gemma"] = stats["avg_height_gemma"] = 0.0

    return stats


# ===========================================================================
# Printers
# ===========================================================================

def _bar(count: int, total: int, width: int = 30) -> str:
    """ASCII progress bar."""
    if total == 0:
        return " " * width
    filled = int(width * count / total)
    return "#" * filled + "-" * (width - filled)


def print_stats(stats: dict, label: str = ""):
    """Print formatted stats to stdout."""
    n = stats["total"]
    prefix = f"[{label}] " if label else ""

    print()
    print("=" * 70)
    print(f"  {prefix}DATASET STATISTICS")
    print("=" * 70)
    print(f"  Total examples:  {n}")
    print(f"  Mac examples:    {stats['mac_count']}  ({100*stats['mac_count']/n:.1f}%)" if n else "  Mac examples:  0")
    print(f"  Non-Mac:         {stats['non_mac_count']}")
    print()

    # --- By source ---
    print("  EXAMPLES BY SOURCE")
    print("  " + "-" * 50)
    for src, cnt in sorted(stats["by_source"].items(), key=lambda x: -x[1]):
        pct = 100 * cnt / n if n else 0
        bar = _bar(cnt, n)
        print(f"  {src:<15} {cnt:>6}  ({pct:5.1f}%)  [{bar}]")

    print()

    # --- By platform ---
    print("  EXAMPLES BY PLATFORM")
    print("  " + "-" * 50)
    for plat, cnt in sorted(stats["by_platform"].items(), key=lambda x: -x[1]):
        pct = 100 * cnt / n if n else 0
        bar = _bar(cnt, n)
        print(f"  {plat:<15} {cnt:>6}  ({pct:5.1f}%)  [{bar}]")

    print()

    # --- By app (top 15) ---
    top_apps = sorted(stats["by_app"].items(), key=lambda x: -x[1])[:15]
    print("  TOP APPS")
    print("  " + "-" * 50)
    for app, cnt in top_apps:
        pct = 100 * cnt / n if n else 0
        print(f"  {app:<25} {cnt:>6}  ({pct:5.1f}%)")

    print()

    # --- BBox size stats ---
    print("  BOUNDING BOX SIZE ANALYSIS")
    print("  " + "-" * 50)
    print(f"  Avg area:        {stats['avg_area_pct']:.4f}%  of screen")
    print(f"  Median area:     {stats['median_area_pct']:.4f}%")
    print(f"  Min area:        {stats['min_area_pct']:.6f}%")
    print(f"  Max area:        {stats['max_area_pct']:.3f}%")
    print(f"  Avg width:       {stats['avg_width_gemma']:.1f}  (Gemma 0-1000)")
    print(f"  Avg height:      {stats['avg_height_gemma']:.1f}  (Gemma 0-1000)")
    print()

    # --- Size bucket breakdown ---
    print("  SIZE DISTRIBUTION  (by normalized bbox area)")
    print("  " + "-" * 50)
    bucket_order = ["tiny", "small", "medium", "large"]
    for bucket in bucket_order:
        cnt = stats["size_buckets"].get(bucket, 0)
        pct = 100 * cnt / n if n else 0
        bar = _bar(cnt, n)
        print(f"  {bucket:<8}  {cnt:>6}  ({pct:5.1f}%)  [{bar}]")
    print()
    print("  tiny   = area < 0.0001  (e.g., 10x10px on 1920x1080)")
    print("  small  = area < 0.001   (e.g., 30x30px)")
    print("  medium = area < 0.01    (e.g., 100x100px)")
    print("  large  = area >= 0.01")
    print()


def print_samples(examples: list[dict], n_samples: int = 5, seed: int = 42):
    """Print random sample previews."""
    rng = random.Random(seed)
    samples = rng.sample(examples, min(n_samples, len(examples)))

    print("=" * 70)
    print(f"  SAMPLE PREVIEWS  ({len(samples)} of {len(examples)})")
    print("=" * 70)

    for i, ex in enumerate(samples, 1):
        screenshot = ex.get("screenshot", "")
        # Show only the last two path components
        short_path = "/".join(Path(screenshot).parts[-2:]) if screenshot else "?"

        bbox_g = ex.get("bbox_gemma", [])
        bbox_n = ex.get("bbox_norm", [])

        if bbox_g:
            y1, x1, y2, x2 = bbox_g
            w_g = x2 - x1
            h_g = y2 - y1
            bbox_g_str = f"[{y1}, {x1}, {y2}, {x2}]  (WxH: {w_g}x{h_g})"
        else:
            bbox_g_str = "missing"

        if bbox_n:
            area = bbox_area_norm(bbox_n)
            bucket = size_bucket(area)
            bbox_n_str = f"[{bbox_n[0]:.3f}, {bbox_n[1]:.3f}, {bbox_n[2]:.3f}, {bbox_n[3]:.3f}]  ({bucket})"
        else:
            bbox_n_str = "missing"

        print(f"\n  [{i}] Source: {ex.get('source','?')}  |  Platform: {ex.get('platform','?')}  |  App: {ex.get('app','?')}")
        print(f"      Instruction: {truncate(ex.get('instruction',''), 65)}")
        print(f"      bbox_gemma:  {bbox_g_str}")
        print(f"      bbox_norm:   {bbox_n_str}")
        print(f"      Screenshot:  .../{short_path}")

    print()


def print_cross_table(examples: list[dict]):
    """Print a platform x source cross-table."""
    platforms = sorted({ex.get("platform", "?") for ex in examples})
    sources   = sorted({ex.get("source", "?") for ex in examples})

    # Count by (platform, source)
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for ex in examples:
        counts[(ex.get("platform", "?"), ex.get("source", "?"))] += 1

    col_w = 12
    header = f"  {'platform':<12}" + "".join(f"{s:>{col_w}}" for s in sources)
    print("  PLATFORM x SOURCE CROSS-TABLE")
    print("  " + "-" * len(header.rstrip()))
    print(header)
    for plat in platforms:
        row = f"  {plat:<12}"
        for src in sources:
            cnt = counts.get((plat, src), 0)
            row += f"{cnt:>{col_w}}"
        print(row)
    print()


# ===========================================================================
# Main
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Show statistics for filtered GUI grounding dataset",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=None,
        help="Specific JSONL file to analyze (default: reads both train.jsonl and val.jsonl)",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=5,
        metavar="N",
        help="Number of random sample previews to show (default: 5)",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Show all stats including cross-table and more samples",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for sample selection",
    )
    args = parser.parse_args()

    # --- Load data ---
    if args.file:
        paths = [args.file]
        label = args.file.stem
    else:
        paths = [TRAIN_PATH, VAL_PATH]
        label = "all"

    all_examples = []
    for path in paths:
        loaded = load_jsonl(path)
        if loaded:
            print(f"  Loaded {len(loaded)} examples from {path}")
            all_examples.extend(loaded)
        else:
            print(f"  [WARN] No examples found at {path}")

    if not all_examples:
        print()
        print("  No data found. Run filter_data.py first to generate filtered datasets.")
        print(f"  Expected: {TRAIN_PATH}")
        print()
        return 1

    # --- Stats for combined set ---
    stats = compute_stats(all_examples)
    print_stats(stats, label="combined")

    # --- Train vs Val breakdown ---
    if not args.file and TRAIN_PATH.exists() and VAL_PATH.exists():
        train_ex = load_jsonl(TRAIN_PATH)
        val_ex   = load_jsonl(VAL_PATH)
        if train_ex:
            train_stats = compute_stats(train_ex)
            print_stats(train_stats, label="train")
        if val_ex:
            val_stats = compute_stats(val_ex)
            print_stats(val_stats, label="val")

    # --- Cross-table ---
    if args.full or len({ex.get("source") for ex in all_examples}) > 1:
        print_cross_table(all_examples)

    # --- Samples ---
    n = args.samples if not args.full else 10
    print_samples(all_examples, n_samples=n, seed=args.seed)

    # --- Manifest check ---
    manifest_path = FILTERED_DIR / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
        print("  MANIFEST")
        print("  " + "-" * 40)
        for k, v in manifest.items():
            print(f"  {k:<20} {v}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
