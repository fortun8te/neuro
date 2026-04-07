#!/usr/bin/env python3
"""
export_ollama.py -- Export fine-tuned Gemma 4 E2B to Ollama.

Pipeline:
  1. Load trained LoRA adapter + base model
  2. Merge LoRA weights into base model
  3. Convert to GGUF format (Q4_K_M by default)
  4. Generate Ollama Modelfile
  5. Register with Ollama as `gemma4-gui:e2b`

Usage:
  python export_ollama.py                                    # Export with defaults
  python export_ollama.py --quant q5_k_m                     # Different quantization
  python export_ollama.py --model-name gemma4-gui:custom      # Custom Ollama name
  python export_ollama.py --ollama-url http://host:11434      # Remote Ollama
  python export_ollama.py --skip-merge --gguf path/to.gguf   # Use existing GGUF
"""

import os
import sys
import json
import shutil
import argparse
import subprocess
import tempfile
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("export_ollama")

BASE_DIR = Path(__file__).parent
CHECKPOINT_DIR = BASE_DIR / "checkpoints" / "final"
EXPORT_DIR = BASE_DIR / "exports"

DEFAULT_OLLAMA_URL = "http://100.74.135.83:11440"
DEFAULT_MODEL_NAME = "gemma4-gui:e2b"


# --------------------------------------------------------------------------
# Modelfile Template
# --------------------------------------------------------------------------

MODELFILE_TEMPLATE = '''FROM {gguf_path}

# Gemma 4 E2B fine-tuned for GUI grounding / computer-use agent
# Trained on OmniACT + ScreenSpot + Mind2Web datasets

TEMPLATE """{{{{ if .System }}}}<start_of_turn>system
{{{{ .System }}}}<end_of_turn>
{{{{ end }}}}{{{{ range .Messages }}}}{{{{ if eq .Role "user" }}}}<start_of_turn>user
{{{{ .Content }}}}<end_of_turn>
{{{{ else if eq .Role "assistant" }}}}<start_of_turn>model
{{{{ .Content }}}}<end_of_turn>
{{{{ end }}}}{{{{ end }}}}<start_of_turn>model
"""

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_predict 256
PARAMETER stop "<end_of_turn>"

SYSTEM """You are a GUI grounding agent. Given a screenshot of a computer screen and a natural language instruction, identify the UI element(s) the user is referring to and output their bounding box coordinates.

Output format: JSON array of objects with box_2d (normalized 0-1000 coordinates in [y_min, x_min, y_max, x_max] order) and label fields.

Example: [{{"box_2d": [120, 450, 150, 520], "label": "Send button"}}]

Rules:
- Coordinates are normalized to 0-1000 scale
- Order is [y_min, x_min, y_max, x_max] -- NOT x,y
- Always output valid JSON
- Be precise -- tight bounding boxes around the target element
- If multiple elements match, include all of them"""
'''


# --------------------------------------------------------------------------
# Merge & Export
# --------------------------------------------------------------------------

def merge_and_export_gguf(
    checkpoint_dir: str,
    export_dir: str,
    base_model: str = "google/gemma-3n-E2B-it",
    quantization: str = "q4_k_m",
    max_seq_length: int = 2048,
) -> str:
    """Merge LoRA weights and export to GGUF."""
    from unsloth import FastModel

    export_path = Path(export_dir)
    export_path.mkdir(parents=True, exist_ok=True)

    gguf_basename = f"gemma4-gui-e2b-{quantization}"

    # Check if already exported
    expected_gguf = export_path / f"{gguf_basename}-unsloth.{quantization.upper()}.gguf"
    if expected_gguf.exists():
        log.info(f"GGUF already exists: {expected_gguf}")
        return str(expected_gguf)

    log.info(f"Loading model from {checkpoint_dir}")
    model, tokenizer = FastModel.from_pretrained(
        model_name=checkpoint_dir,
        max_seq_length=max_seq_length,
        load_in_4bit=False,  # Need full precision for merging
    )

    log.info(f"Exporting to GGUF ({quantization})...")
    model.save_pretrained_gguf(
        str(export_path / gguf_basename),
        tokenizer,
        quantization_method=quantization,
    )

    # Find the generated GGUF file
    gguf_files = list(export_path.glob("*.gguf"))
    if not gguf_files:
        log.error("GGUF export failed -- no .gguf file found")
        sys.exit(1)

    # Use the most recently created GGUF
    gguf_file = max(gguf_files, key=lambda f: f.stat().st_mtime)
    log.info(f"GGUF exported: {gguf_file} ({gguf_file.stat().st_size / 1024 / 1024:.0f} MB)")
    return str(gguf_file)


# --------------------------------------------------------------------------
# Ollama Registration
# --------------------------------------------------------------------------

def create_modelfile(gguf_path: str, output_path: str) -> str:
    """Generate Ollama Modelfile."""
    content = MODELFILE_TEMPLATE.format(gguf_path=gguf_path)
    with open(output_path, "w") as f:
        f.write(content)
    log.info(f"Modelfile written to {output_path}")
    return output_path


def register_with_ollama(
    modelfile_path: str,
    model_name: str = DEFAULT_MODEL_NAME,
    ollama_url: str = DEFAULT_OLLAMA_URL,
) -> bool:
    """Register the model with Ollama."""
    import urllib.request
    import urllib.error

    log.info(f"Registering with Ollama as '{model_name}'...")

    # Method 1: Try ollama CLI
    try:
        env = os.environ.copy()
        env["OLLAMA_HOST"] = ollama_url

        result = subprocess.run(
            ["ollama", "create", model_name, "-f", modelfile_path],
            capture_output=True,
            text=True,
            env=env,
            timeout=600,  # 10 min timeout for large models
        )

        if result.returncode == 0:
            log.info(f"Model registered: {model_name}")
            log.info(result.stdout)
            return True
        else:
            log.warning(f"ollama CLI failed: {result.stderr}")
    except FileNotFoundError:
        log.warning("ollama CLI not found, trying API...")
    except subprocess.TimeoutExpired:
        log.warning("ollama CLI timed out")
    except Exception as e:
        log.warning(f"ollama CLI error: {e}")

    # Method 2: Try Ollama API
    try:
        with open(modelfile_path) as f:
            modelfile_content = f.read()

        payload = json.dumps({
            "name": model_name,
            "modelfile": modelfile_content,
        }).encode("utf-8")

        url = f"{ollama_url}/api/create"
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        log.info(f"POSTing to {url}...")
        with urllib.request.urlopen(req, timeout=600) as resp:
            # Ollama streams NDJSON responses
            for line in resp:
                line = line.decode("utf-8").strip()
                if line:
                    try:
                        data = json.loads(line)
                        status = data.get("status", "")
                        if status:
                            log.info(f"  {status}")
                    except json.JSONDecodeError:
                        pass

        log.info(f"Model registered via API: {model_name}")
        return True

    except urllib.error.URLError as e:
        log.error(f"Cannot connect to Ollama at {ollama_url}: {e}")
    except Exception as e:
        log.error(f"API registration failed: {e}")

    return False


def verify_model(
    model_name: str = DEFAULT_MODEL_NAME,
    ollama_url: str = DEFAULT_OLLAMA_URL,
) -> bool:
    """Verify the model is registered and can generate."""
    import urllib.request
    import urllib.error

    log.info(f"Verifying model '{model_name}'...")

    try:
        # Check model exists
        url = f"{ollama_url}/api/show"
        payload = json.dumps({"name": model_name}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            model_info = data.get("modelfile", "")
            log.info(f"Model found. Size: {data.get('size', 'unknown')}")

        # Quick generation test
        url = f"{ollama_url}/api/generate"
        payload = json.dumps({
            "model": model_name,
            "prompt": "Identify the search bar in this screenshot.",
            "stream": False,
            "options": {"num_predict": 50},
        }).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        log.info("Running test generation...")
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            response_text = data.get("response", "")
            log.info(f"Test response: {response_text[:200]}")

        log.info("Verification passed.")
        return True

    except urllib.error.URLError as e:
        log.error(f"Verification failed -- cannot reach Ollama: {e}")
    except Exception as e:
        log.error(f"Verification failed: {e}")

    return False


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Export fine-tuned Gemma 4 E2B to Ollama"
    )

    parser.add_argument("--checkpoint-dir", type=str, default=str(CHECKPOINT_DIR),
                        help="Path to trained model checkpoint")
    parser.add_argument("--export-dir", type=str, default=str(EXPORT_DIR),
                        help="Directory for GGUF output")
    parser.add_argument("--base-model", type=str, default="google/gemma-3n-E2B-it",
                        help="Base model name for merging")
    parser.add_argument("--quant", type=str, default="q4_k_m",
                        choices=["q4_k_m", "q5_k_m", "q8_0", "f16"],
                        help="GGUF quantization method")
    parser.add_argument("--model-name", type=str, default=DEFAULT_MODEL_NAME,
                        help="Ollama model name")
    parser.add_argument("--ollama-url", type=str, default=DEFAULT_OLLAMA_URL,
                        help="Ollama server URL")
    parser.add_argument("--skip-merge", action="store_true",
                        help="Skip merge step, use existing GGUF")
    parser.add_argument("--gguf", type=str, default="",
                        help="Path to existing GGUF file (with --skip-merge)")
    parser.add_argument("--no-register", action="store_true",
                        help="Export GGUF only, do not register with Ollama")
    parser.add_argument("--verify", action="store_true",
                        help="Only verify existing model registration")

    args = parser.parse_args()

    log.info("=" * 60)
    log.info("Gemma 4 E2B -- Ollama Export Pipeline")
    log.info("=" * 60)

    # Verify only
    if args.verify:
        ok = verify_model(args.model_name, args.ollama_url)
        sys.exit(0 if ok else 1)

    # Get GGUF file
    if args.skip_merge:
        if not args.gguf:
            # Find most recent GGUF in export dir
            gguf_files = list(Path(args.export_dir).glob("*.gguf"))
            if not gguf_files:
                log.error("No GGUF files found. Run without --skip-merge.")
                sys.exit(1)
            gguf_path = str(max(gguf_files, key=lambda f: f.stat().st_mtime))
        else:
            gguf_path = args.gguf
            if not Path(gguf_path).exists():
                log.error(f"GGUF not found: {gguf_path}")
                sys.exit(1)
    else:
        if not Path(args.checkpoint_dir).exists():
            log.error(f"Checkpoint not found: {args.checkpoint_dir}")
            log.error("Run train_lora.py first.")
            sys.exit(1)

        gguf_path = merge_and_export_gguf(
            checkpoint_dir=args.checkpoint_dir,
            export_dir=args.export_dir,
            base_model=args.base_model,
            quantization=args.quant,
        )

    log.info(f"GGUF file: {gguf_path}")

    if args.no_register:
        log.info("Skipping Ollama registration (--no-register).")
        log.info(f"GGUF ready at: {gguf_path}")
        return

    # Create Modelfile
    modelfile_path = str(Path(args.export_dir) / "Modelfile")
    create_modelfile(gguf_path, modelfile_path)

    # Register
    ok = register_with_ollama(modelfile_path, args.model_name, args.ollama_url)
    if not ok:
        log.error("Registration failed. You can manually register with:")
        log.error(f"  OLLAMA_HOST={args.ollama_url} ollama create {args.model_name} -f {modelfile_path}")
        sys.exit(1)

    # Verify
    verify_model(args.model_name, args.ollama_url)

    log.info("=" * 60)
    log.info(f"Model ready: {args.model_name}")
    log.info(f"  ollama run {args.model_name}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
