#!/usr/bin/env python3
"""
evaluate.py -- Evaluate fine-tuned Gemma 4 E2B on ScreenSpot benchmark.

Measures click accuracy: whether the model's predicted bounding box center
falls within the ground truth bounding box.

Reports:
  - Overall accuracy
  - Per-platform breakdown (Mac, Windows, Web, Mobile)
  - Per-action-type breakdown
  - Comparison with baseline (un-tuned Gemma 4 E2B)
  - IoU distribution

Usage:
  python evaluate.py                                          # Evaluate fine-tuned model
  python evaluate.py --baseline                               # Also evaluate baseline
  python evaluate.py --model gemma4-gui:e2b                   # Specify model name
  python evaluate.py --test-file datasets/converted/test.jsonl # Custom test file
  python evaluate.py --max-samples 100                        # Limit samples for quick test
  python evaluate.py --export-results results.json            # Export detailed results
"""

import os
import sys
import json
import base64
import argparse
import logging
import time
from io import BytesIO
from pathlib import Path
from dataclasses import dataclass, field
from collections import defaultdict

import numpy as np
from PIL import Image
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import track
from tqdm import tqdm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("evaluate")

console = Console()

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "datasets" / "converted"
RESULTS_DIR = BASE_DIR / "results"

DEFAULT_OLLAMA_URL = "http://100.74.135.83:11440"
GEMMA_COORD_SCALE = 1000


# --------------------------------------------------------------------------
# Data Structures
# --------------------------------------------------------------------------

@dataclass
class EvalSample:
    """A single evaluation sample."""
    image_path: str
    instruction: str
    gt_boxes: list  # Ground truth: [{"box_2d": [y1,x1,y2,x2], "label": str}]
    platform: str
    action_type: str
    source: str


@dataclass
class PredictionResult:
    """Result of evaluating one sample."""
    sample: EvalSample
    pred_boxes: list  # Predicted boxes
    pred_raw: str  # Raw model output
    click_accurate: bool  # Center of prediction inside GT box
    iou: float  # IoU between pred and GT
    latency_ms: float  # Inference time


# --------------------------------------------------------------------------
# Load Test Data
# --------------------------------------------------------------------------

def load_test_data(test_file: str, max_samples: int = 0) -> list[EvalSample]:
    """Load test samples from JSONL."""
    samples = []

    with open(test_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                msgs = data["messages"]
                meta = data.get("metadata", {})

                # Extract image and instruction
                user_content = msgs[0]["content"]
                image_path = ""
                instruction = ""
                for item in user_content:
                    if item["type"] == "image":
                        image_path = item["image"]
                    elif item["type"] == "text":
                        instruction = item["text"]

                # Extract ground truth boxes
                gt_text = msgs[1]["content"][0]["text"]
                gt_boxes = json.loads(gt_text)

                if image_path and Path(image_path).exists():
                    samples.append(EvalSample(
                        image_path=image_path,
                        instruction=instruction,
                        gt_boxes=gt_boxes,
                        platform=meta.get("platform", "unknown"),
                        action_type=meta.get("action_type", "click"),
                        source=meta.get("source", "unknown"),
                    ))

            except (json.JSONDecodeError, KeyError, IndexError):
                continue

    if max_samples > 0:
        samples = samples[:max_samples]

    log.info(f"Loaded {len(samples)} test samples from {test_file}")
    return samples


# --------------------------------------------------------------------------
# Inference via Ollama
# --------------------------------------------------------------------------

def encode_image_base64(image_path: str) -> str:
    """Encode image to base64 for Ollama API."""
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        # Resize if too large (keep under 1024px for speed)
        max_dim = 1024
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("utf-8")


def run_inference(
    image_path: str,
    instruction: str,
    model_name: str,
    ollama_url: str,
) -> tuple[list, str, float]:
    """Run inference on a single sample via Ollama API. Returns (boxes, raw_text, latency_ms)."""
    import urllib.request

    image_b64 = encode_image_base64(image_path)

    payload = json.dumps({
        "model": model_name,
        "prompt": instruction,
        "images": [image_b64],
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 256,
        },
    }).encode("utf-8")

    url = f"{ollama_url}/api/generate"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return [], f"ERROR: {e}", 0.0

    latency = (time.time() - start) * 1000
    raw_text = data.get("response", "").strip()

    # Parse boxes from response
    boxes = parse_gemma_boxes(raw_text)

    return boxes, raw_text, latency


def parse_gemma_boxes(text: str) -> list[dict]:
    """Parse Gemma bounding box output from model response."""
    # Try direct JSON parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            valid = []
            for item in parsed:
                if isinstance(item, dict) and "box_2d" in item:
                    coords = item["box_2d"]
                    if isinstance(coords, list) and len(coords) == 4:
                        valid.append(item)
            return valid
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from surrounding text
    import re
    json_match = re.search(r'\[.*?\]', text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group())
            if isinstance(parsed, list):
                valid = []
                for item in parsed:
                    if isinstance(item, dict) and "box_2d" in item:
                        valid.append(item)
                return valid
        except json.JSONDecodeError:
            pass

    return []


# --------------------------------------------------------------------------
# Metrics
# --------------------------------------------------------------------------

def box_center(box: list[int]) -> tuple[float, float]:
    """Get center of [y1, x1, y2, x2] box. Returns (y_center, x_center)."""
    y1, x1, y2, x2 = box
    return ((y1 + y2) / 2, (x1 + x2) / 2)


def point_in_box(point: tuple[float, float], box: list[int]) -> bool:
    """Check if (y, x) point is inside [y1, x1, y2, x2] box."""
    py, px = point
    y1, x1, y2, x2 = box
    return y1 <= py <= y2 and x1 <= px <= x2


def compute_iou(box_a: list[int], box_b: list[int]) -> float:
    """Compute IoU between two [y1, x1, y2, x2] boxes."""
    y1_a, x1_a, y2_a, x2_a = box_a
    y1_b, x1_b, y2_b, x2_b = box_b

    # Intersection
    y1_i = max(y1_a, y1_b)
    x1_i = max(x1_a, x1_b)
    y2_i = min(y2_a, y2_b)
    x2_i = min(x2_a, x2_b)

    if y2_i <= y1_i or x2_i <= x1_i:
        return 0.0

    inter_area = (y2_i - y1_i) * (x2_i - x1_i)
    area_a = (y2_a - y1_a) * (x2_a - x1_a)
    area_b = (y2_b - y1_b) * (x2_b - x1_b)
    union_area = area_a + area_b - inter_area

    if union_area <= 0:
        return 0.0

    return inter_area / union_area


def evaluate_sample(
    sample: EvalSample,
    pred_boxes: list[dict],
    pred_raw: str,
    latency_ms: float,
) -> PredictionResult:
    """Evaluate a single prediction against ground truth."""
    if not pred_boxes or not sample.gt_boxes:
        return PredictionResult(
            sample=sample,
            pred_boxes=pred_boxes,
            pred_raw=pred_raw,
            click_accurate=False,
            iou=0.0,
            latency_ms=latency_ms,
        )

    # Use first predicted box vs first GT box
    pred_box = pred_boxes[0]["box_2d"]
    gt_box = sample.gt_boxes[0]["box_2d"]

    # Click accuracy: center of prediction inside GT box
    pred_center = box_center(pred_box)
    click_acc = point_in_box(pred_center, gt_box)

    # IoU
    iou = compute_iou(pred_box, gt_box)

    return PredictionResult(
        sample=sample,
        pred_boxes=pred_boxes,
        pred_raw=pred_raw,
        click_accurate=click_acc,
        iou=iou,
        latency_ms=latency_ms,
    )


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------

def compute_metrics(results: list[PredictionResult]) -> dict:
    """Compute aggregate metrics from evaluation results."""
    if not results:
        return {"total": 0}

    total = len(results)
    click_correct = sum(1 for r in results if r.click_accurate)
    ious = [r.iou for r in results]
    latencies = [r.latency_ms for r in results if r.latency_ms > 0]
    parse_failures = sum(1 for r in results if not r.pred_boxes)

    metrics = {
        "total": total,
        "click_accuracy": click_correct / total if total > 0 else 0,
        "click_correct": click_correct,
        "mean_iou": float(np.mean(ious)) if ious else 0,
        "median_iou": float(np.median(ious)) if ious else 0,
        "mean_latency_ms": float(np.mean(latencies)) if latencies else 0,
        "p95_latency_ms": float(np.percentile(latencies, 95)) if latencies else 0,
        "parse_failure_rate": parse_failures / total if total > 0 else 0,
        "parse_failures": parse_failures,
    }

    # Per-platform
    platforms = defaultdict(list)
    for r in results:
        platforms[r.sample.platform].append(r)

    metrics["per_platform"] = {}
    for plat, plat_results in sorted(platforms.items()):
        plat_total = len(plat_results)
        plat_correct = sum(1 for r in plat_results if r.click_accurate)
        plat_ious = [r.iou for r in plat_results]
        metrics["per_platform"][plat] = {
            "total": plat_total,
            "click_accuracy": plat_correct / plat_total if plat_total > 0 else 0,
            "mean_iou": float(np.mean(plat_ious)) if plat_ious else 0,
        }

    # Per-action-type
    actions = defaultdict(list)
    for r in results:
        actions[r.sample.action_type].append(r)

    metrics["per_action"] = {}
    for act, act_results in sorted(actions.items()):
        act_total = len(act_results)
        act_correct = sum(1 for r in act_results if r.click_accurate)
        metrics["per_action"][act] = {
            "total": act_total,
            "click_accuracy": act_correct / act_total if act_total > 0 else 0,
        }

    # Per-source
    sources = defaultdict(list)
    for r in results:
        sources[r.sample.source].append(r)

    metrics["per_source"] = {}
    for src, src_results in sorted(sources.items()):
        src_total = len(src_results)
        src_correct = sum(1 for r in src_results if r.click_accurate)
        metrics["per_source"][src] = {
            "total": src_total,
            "click_accuracy": src_correct / src_total if src_total > 0 else 0,
        }

    return metrics


def print_results(metrics: dict, model_name: str):
    """Print evaluation results in a formatted table."""
    console.print(Panel.fit(
        f"[bold cyan]Evaluation Results: {model_name}[/bold cyan]",
        border_style="blue",
    ))

    # Overall
    table = Table(title="Overall Metrics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green", justify="right")

    table.add_row("Total Samples", str(metrics["total"]))
    table.add_row(
        "Click Accuracy",
        f"{metrics['click_accuracy']:.1%} ({metrics['click_correct']}/{metrics['total']})",
    )
    table.add_row("Mean IoU", f"{metrics['mean_iou']:.3f}")
    table.add_row("Median IoU", f"{metrics['median_iou']:.3f}")
    table.add_row("Mean Latency", f"{metrics['mean_latency_ms']:.0f} ms")
    table.add_row("P95 Latency", f"{metrics['p95_latency_ms']:.0f} ms")
    table.add_row(
        "Parse Failures",
        f"{metrics['parse_failure_rate']:.1%} ({metrics['parse_failures']}/{metrics['total']})",
    )
    console.print(table)

    # Per-platform
    if metrics.get("per_platform"):
        table = Table(title="Per-Platform Breakdown")
        table.add_column("Platform", style="cyan")
        table.add_column("Samples", style="dim", justify="right")
        table.add_column("Click Accuracy", style="green", justify="right")
        table.add_column("Mean IoU", style="yellow", justify="right")

        for plat, data in sorted(metrics["per_platform"].items()):
            table.add_row(
                plat,
                str(data["total"]),
                f"{data['click_accuracy']:.1%}",
                f"{data['mean_iou']:.3f}",
            )
        console.print(table)

    # Per-action
    if metrics.get("per_action"):
        table = Table(title="Per-Action Breakdown")
        table.add_column("Action", style="cyan")
        table.add_column("Samples", style="dim", justify="right")
        table.add_column("Click Accuracy", style="green", justify="right")

        for act, data in sorted(metrics["per_action"].items()):
            table.add_row(act, str(data["total"]), f"{data['click_accuracy']:.1%}")
        console.print(table)


def print_comparison(finetuned: dict, baseline: dict):
    """Print side-by-side comparison of fine-tuned vs baseline."""
    table = Table(title="Fine-tuned vs Baseline Comparison")
    table.add_column("Metric", style="cyan")
    table.add_column("Baseline", style="yellow", justify="right")
    table.add_column("Fine-tuned", style="green", justify="right")
    table.add_column("Delta", style="bold", justify="right")

    # Overall
    for metric, label in [
        ("click_accuracy", "Click Accuracy"),
        ("mean_iou", "Mean IoU"),
    ]:
        base_val = baseline.get(metric, 0)
        ft_val = finetuned.get(metric, 0)
        delta = ft_val - base_val
        delta_str = f"+{delta:.1%}" if delta >= 0 else f"{delta:.1%}"
        color = "green" if delta > 0 else "red" if delta < 0 else "dim"
        table.add_row(
            label,
            f"{base_val:.1%}" if "accuracy" in metric else f"{base_val:.3f}",
            f"{ft_val:.1%}" if "accuracy" in metric else f"{ft_val:.3f}",
            f"[{color}]{delta_str}[/{color}]",
        )

    # Per-platform comparison
    for plat in sorted(
        set(list(finetuned.get("per_platform", {}).keys()) +
            list(baseline.get("per_platform", {}).keys()))
    ):
        base_acc = baseline.get("per_platform", {}).get(plat, {}).get("click_accuracy", 0)
        ft_acc = finetuned.get("per_platform", {}).get(plat, {}).get("click_accuracy", 0)
        delta = ft_acc - base_acc
        delta_str = f"+{delta:.1%}" if delta >= 0 else f"{delta:.1%}"
        color = "green" if delta > 0 else "red" if delta < 0 else "dim"
        table.add_row(
            f"  {plat}",
            f"{base_acc:.1%}",
            f"{ft_acc:.1%}",
            f"[{color}]{delta_str}[/{color}]",
        )

    console.print(table)


# --------------------------------------------------------------------------
# Main Evaluation Loop
# --------------------------------------------------------------------------

def run_evaluation(
    samples: list[EvalSample],
    model_name: str,
    ollama_url: str,
    label: str = "",
) -> list[PredictionResult]:
    """Run evaluation on all samples."""
    results = []
    desc = f"Evaluating {label or model_name}"

    for sample in tqdm(samples, desc=desc):
        pred_boxes, pred_raw, latency = run_inference(
            image_path=sample.image_path,
            instruction=sample.instruction,
            model_name=model_name,
            ollama_url=ollama_url,
        )

        result = evaluate_sample(sample, pred_boxes, pred_raw, latency)
        results.append(result)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate Gemma 4 E2B on GUI grounding benchmark"
    )
    parser.add_argument("--model", type=str, default="gemma4-gui:e2b",
                        help="Fine-tuned model name in Ollama")
    parser.add_argument("--baseline-model", type=str, default="gemma4:e2b",
                        help="Baseline model name in Ollama")
    parser.add_argument("--baseline", action="store_true",
                        help="Also evaluate baseline model for comparison")
    parser.add_argument("--test-file", type=str, default=str(DATA_DIR / "test.jsonl"),
                        help="Test JSONL file path")
    parser.add_argument("--ollama-url", type=str, default=DEFAULT_OLLAMA_URL)
    parser.add_argument("--max-samples", type=int, default=0,
                        help="Limit evaluation to N samples (0 = all)")
    parser.add_argument("--export-results", type=str, default="",
                        help="Export detailed results to JSON file")
    args = parser.parse_args()

    console.print(Panel.fit(
        "[bold cyan]Gemma 4 E2B -- GUI Grounding Evaluation[/bold cyan]\n"
        "[dim]ScreenSpot benchmark with click accuracy and IoU metrics[/dim]",
        border_style="blue",
    ))

    # Load test data
    if not Path(args.test_file).exists():
        log.error(f"Test file not found: {args.test_file}")
        log.error("Run data_converter.py first to generate test data.")
        sys.exit(1)

    samples = load_test_data(args.test_file, max_samples=args.max_samples)
    if not samples:
        log.error("No valid test samples found.")
        sys.exit(1)

    # Platform distribution
    plat_dist = defaultdict(int)
    for s in samples:
        plat_dist[s.platform] += 1
    console.print(f"\nTest set: {len(samples)} samples")
    for p, c in sorted(plat_dist.items()):
        console.print(f"  {p}: {c}")

    # Evaluate fine-tuned model
    console.print(f"\n[bold]Evaluating fine-tuned model: {args.model}[/bold]")
    ft_results = run_evaluation(samples, args.model, args.ollama_url, "fine-tuned")
    ft_metrics = compute_metrics(ft_results)
    print_results(ft_metrics, args.model)

    # Evaluate baseline
    baseline_metrics = None
    if args.baseline:
        console.print(f"\n[bold]Evaluating baseline model: {args.baseline_model}[/bold]")
        bl_results = run_evaluation(samples, args.baseline_model, args.ollama_url, "baseline")
        baseline_metrics = compute_metrics(bl_results)
        print_results(baseline_metrics, args.baseline_model)

        # Comparison
        console.print("")
        print_comparison(ft_metrics, baseline_metrics)

    # Export results
    if args.export_results:
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        export_path = RESULTS_DIR / args.export_results

        export_data = {
            "model": args.model,
            "test_file": args.test_file,
            "num_samples": len(samples),
            "finetuned_metrics": ft_metrics,
        }
        if baseline_metrics:
            export_data["baseline_model"] = args.baseline_model
            export_data["baseline_metrics"] = baseline_metrics

        # Add per-sample details
        export_data["samples"] = []
        for r in ft_results:
            export_data["samples"].append({
                "instruction": r.sample.instruction,
                "platform": r.sample.platform,
                "action_type": r.sample.action_type,
                "gt_boxes": r.sample.gt_boxes,
                "pred_boxes": r.pred_boxes,
                "pred_raw": r.pred_raw,
                "click_accurate": r.click_accurate,
                "iou": r.iou,
                "latency_ms": r.latency_ms,
            })

        with open(export_path, "w") as f:
            json.dump(export_data, f, indent=2)
        console.print(f"\nDetailed results exported to: {export_path}")

    # Summary
    console.print(f"\n[bold green]Evaluation complete.[/bold green]")
    console.print(f"Click Accuracy: {ft_metrics['click_accuracy']:.1%}")
    console.print(f"Mean IoU: {ft_metrics['mean_iou']:.3f}")
    if baseline_metrics:
        delta = ft_metrics["click_accuracy"] - baseline_metrics["click_accuracy"]
        sign = "+" if delta >= 0 else ""
        console.print(f"vs Baseline: {sign}{delta:.1%}")


if __name__ == "__main__":
    main()
