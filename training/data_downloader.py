#!/usr/bin/env python3
"""
data_downloader.py -- Downloads GUI grounding datasets from HuggingFace.

Datasets:
  - OmniACT (Writer/omniact) -- 9.8K Mac desktop examples
  - ScreenSpot (rootsautomation/ScreenSpot) -- 1,272 click grounding examples
  - Mind2Web (osunlp/Multimodal-Mind2Web) -- 14K browser interaction actions

Usage:
  python data_downloader.py                    # Download all datasets
  python data_downloader.py --only omniact     # Download one dataset
  python data_downloader.py --only screenspot
  python data_downloader.py --only mind2web
"""

import os
import sys
import argparse
import shutil
from pathlib import Path

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.table import Table

console = Console()

BASE_DIR = Path(__file__).parent / "datasets"

DATASETS = {
    "omniact": {
        "repo_id": "Writer/omniact",
        "description": "9.8K Mac desktop examples with PyAutoGUI actions",
        "estimated_size": "418 MB",
        "dest": BASE_DIR / "omniact",
    },
    "screenspot": {
        "repo_id": "rootsautomation/ScreenSpot",
        "description": "1,272 click grounding examples (Mac, Windows, Web, Mobile)",
        "estimated_size": "602 MB",
        "dest": BASE_DIR / "screenspot",
    },
    "mind2web": {
        "repo_id": "osunlp/Multimodal-Mind2Web",
        "description": "14K real browser interaction actions",
        "estimated_size": "~4 GB",
        "dest": BASE_DIR / "mind2web",
    },
}


def check_disk_space(path: Path, required_gb: float = 10.0) -> bool:
    """Check if there is enough disk space."""
    stat = shutil.disk_usage(path.parent if path.exists() else path.parent.parent)
    free_gb = stat.free / (1024 ** 3)
    if free_gb < required_gb:
        console.print(
            f"[red]WARNING: Only {free_gb:.1f} GB free. "
            f"Recommended: {required_gb:.0f} GB.[/red]"
        )
        return False
    return True


def download_dataset(name: str, info: dict, force: bool = False) -> bool:
    """Download a single dataset from HuggingFace using snapshot_download."""
    from huggingface_hub import snapshot_download
    from huggingface_hub.utils import HfHubHTTPError, LocalEntryNotFoundError

    dest = info["dest"]

    # Check if already downloaded
    if dest.exists() and any(dest.iterdir()) and not force:
        console.print(f"  [yellow]Already exists at {dest}. Use --force to re-download.[/yellow]")
        return True

    dest.mkdir(parents=True, exist_ok=True)

    console.print(f"  [cyan]Downloading from [bold]{info['repo_id']}[/bold]...[/cyan]")
    console.print(f"  [dim]Estimated size: {info['estimated_size']}[/dim]")
    console.print(f"  [dim]Destination: {dest}[/dim]")

    try:
        snapshot_download(
            repo_id=info["repo_id"],
            repo_type="dataset",
            local_dir=str(dest),
            resume_download=True,
            max_workers=4,
        )
        console.print(f"  [green]Done.[/green]")
        return True

    except HfHubHTTPError as e:
        if "401" in str(e) or "403" in str(e):
            console.print(
                f"  [red]Authentication required for {info['repo_id']}.[/red]\n"
                f"  [yellow]Run: huggingface-cli login[/yellow]"
            )
        elif "404" in str(e):
            console.print(f"  [red]Dataset not found: {info['repo_id']}[/red]")
        else:
            console.print(f"  [red]HTTP error: {e}[/red]")
        return False

    except Exception as e:
        console.print(f"  [red]Download failed: {e}[/red]")
        return False


def show_status():
    """Show download status of all datasets."""
    table = Table(title="Dataset Status")
    table.add_column("Dataset", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Size on Disk", style="yellow")
    table.add_column("Path", style="dim")

    for name, info in DATASETS.items():
        dest = info["dest"]
        if dest.exists() and any(dest.iterdir()):
            # Calculate actual size
            total_size = sum(f.stat().st_size for f in dest.rglob("*") if f.is_file())
            size_str = format_size(total_size)
            status = "Downloaded"
        else:
            size_str = "-"
            status = "Not downloaded"

        table.add_row(name, status, size_str, str(dest))

    console.print(table)


def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable size."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def main():
    parser = argparse.ArgumentParser(
        description="Download GUI grounding datasets from HuggingFace"
    )
    parser.add_argument(
        "--only",
        choices=list(DATASETS.keys()),
        help="Download only this dataset",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-download even if dataset exists",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show download status without downloading",
    )
    args = parser.parse_args()

    console.print(Panel.fit(
        "[bold cyan]Gemma 4 E2B -- GUI Grounding Dataset Downloader[/bold cyan]\n"
        "[dim]Downloads OmniACT, ScreenSpot, and Mind2Web from HuggingFace[/dim]",
        border_style="blue",
    ))

    if args.status:
        show_status()
        return

    # Ensure base directory exists
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    check_disk_space(BASE_DIR, required_gb=8.0)

    # Determine which datasets to download
    if args.only:
        targets = {args.only: DATASETS[args.only]}
    else:
        targets = DATASETS

    results = {}
    for name, info in targets.items():
        console.print(f"\n[bold white]--- {name.upper()} ---[/bold white]")
        console.print(f"  {info['description']}")
        ok = download_dataset(name, info, force=args.force)
        results[name] = ok

    # Summary
    console.print("\n")
    success = sum(1 for v in results.values() if v)
    total = len(results)
    if success == total:
        console.print(f"[bold green]All {total} datasets ready.[/bold green]")
    else:
        console.print(
            f"[bold yellow]{success}/{total} datasets downloaded. "
            f"Check errors above.[/bold yellow]"
        )

    show_status()


if __name__ == "__main__":
    main()
