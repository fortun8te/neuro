# Gemma 4 E2B -- GUI Grounding LoRA Fine-Tuning Pipeline

Fine-tune Google's Gemma 4 E2B (2.3B effective / 5.1B total params) for GUI grounding and computer-use agent tasks using LoRA via Unsloth.

## Overview

This pipeline takes GUI interaction datasets (screenshots + action annotations), converts them to Gemma's native bounding box format, fine-tunes with LoRA, and deploys to Ollama for inference.

```
data_downloader.py   -- Download OmniACT, ScreenSpot, Mind2Web from HuggingFace
         |
data_converter.py    -- Convert to unified Gemma 4 E2B format (0-1000 coords)
         |
train_lora.py        -- LoRA fine-tune with Unsloth (QLoRA for <16GB VRAM)
         |
export_ollama.py     -- Merge weights, GGUF export, register with Ollama
         |
evaluate.py          -- Benchmark on ScreenSpot (click accuracy, IoU, per-platform)
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Download datasets
python data_downloader.py

# 3. Convert to training format
python data_converter.py

# 4. Train (2-4 hours on a single GPU)
python train_lora.py --qlora --epochs 3

# 5. Export to Ollama
python export_ollama.py --quant q4_k_m

# 6. Evaluate
python evaluate.py --baseline
```

## Hardware Requirements

| Setup | GPU | VRAM | Training Time | Notes |
|-------|-----|------|---------------|-------|
| Minimum | RTX 3060 / RTX 4060 | 8 GB | ~4 hours | QLoRA (4-bit), batch 1 |
| Recommended | RTX 3090 / RTX 4080 | 16 GB | ~2.5 hours | QLoRA or full LoRA |
| Fast | A100 / H100 | 40+ GB | ~1 hour | Full LoRA, larger batches |
| Apple Silicon | M1 Pro+ | 16+ GB unified | ~6 hours | No QLoRA (MPS), full precision |

Disk space: ~10 GB for datasets + ~5 GB for checkpoints/exports.

## Gemma 4 E2B Coordinate System

Gemma 4 E2B uses a specific bounding box format:

```json
[{"box_2d": [y_min, x_min, y_max, x_max], "label": "element name"}]
```

- Coordinates normalized to **0-1000** scale
- Order is **[y_min, x_min, y_max, x_max]** -- NOT x,y order
- Multiple elements supported as array items

## Training Datasets

| Dataset | Size | Samples | Content |
|---------|------|---------|---------|
| OmniACT | 418 MB | 9.8K | Mac desktop actions (PyAutoGUI) |
| ScreenSpot | 602 MB | 1,272 | Click grounding (Mac/Win/Web/Mobile) |
| Mind2Web | ~4 GB | 14K | Browser interaction actions |

All datasets are converted to Gemma's native bounding box format by `data_converter.py`.

### Custom Tracker Data

You can also include your own data in JSONL format:

```json
{"screenshot": "screenshot_001.jpg", "action": "click", "x": 450, "y": 230, "width": 1920, "height": 1080, "element": "Send button", "bbox": [430, 210, 470, 250]}
```

Convert with: `python data_converter.py --tracker-dir path/to/sessions/`

## Training Configuration

Default LoRA settings (tuned for GUI grounding):

| Parameter | Value | Notes |
|-----------|-------|-------|
| LoRA rank | 16 | Good balance of capacity/memory |
| LoRA alpha | 16 | alpha = rank (standard) |
| Dropout | 0.0 | No dropout (small dataset) |
| Vision layers | Frozen | Save memory, vision already strong |
| Language layers | Trained | Adapt language output for boxes |
| Learning rate | 2e-4 | Cosine schedule with warmup |
| Batch size | 1 x 4 accum | Effective batch = 4 |
| Epochs | 3 | Early stopping on val loss |
| Max seq length | 2048 | Sufficient for box output |
| Vision tokens | 280 | Per-image token budget |

### QLoRA (4-bit)

Auto-enabled when VRAM < 16 GB. Force with `--qlora`:

```bash
python train_lora.py --qlora --epochs 3 --lr 2e-4
```

## File Reference

```
training/
  requirements.txt       -- Python dependencies
  data_downloader.py     -- Download datasets from HuggingFace
  data_converter.py      -- Convert to Gemma training format
  train_lora.py          -- LoRA fine-tuning with Unsloth
  export_ollama.py       -- GGUF export + Ollama registration
  evaluate.py            -- ScreenSpot benchmark evaluation
  datasets/
    omniact/             -- Raw OmniACT data
    screenspot/          -- Raw ScreenSpot data
    mind2web/            -- Raw Mind2Web data
    converted/
      train.jsonl        -- Training split (90%)
      val.jsonl          -- Validation split (5%)
      test.jsonl         -- Test split (5%)
      images/            -- Extracted images from HF datasets
  checkpoints/
    step-500/            -- Intermediate checkpoints
    step-1000/
    final/               -- Best/final model
    training_metrics.json
  exports/
    gemma4-gui-e2b-*.gguf  -- Quantized GGUF model
    Modelfile              -- Ollama model definition
  results/
    *.json               -- Evaluation results
```

## Evaluation Metrics

`evaluate.py` reports:

- **Click accuracy**: Is the center of the predicted box inside the ground truth box?
- **IoU** (Intersection over Union): Overlap between predicted and ground truth boxes
- **Per-platform breakdown**: Mac, Windows, Web, Mobile
- **Per-action breakdown**: Click, Type, Scroll, Select
- **Latency**: Inference time per sample
- **Baseline comparison**: Side-by-side with un-tuned `gemma4:e2b`

```bash
# Full evaluation with baseline comparison
python evaluate.py --baseline --export-results eval_results.json

# Quick sanity check (50 samples)
python evaluate.py --max-samples 50
```

## Ollama Deployment

After export, the model is available as `gemma4-gui:e2b`:

```bash
# Verify
ollama run gemma4-gui:e2b "Click the search bar in this screenshot"

# Use in code (Python)
import requests
resp = requests.post("http://100.74.135.83:11440/api/generate", json={
    "model": "gemma4-gui:e2b",
    "prompt": "Click the Submit button",
    "images": ["<base64_screenshot>"],
})
boxes = json.loads(resp.json()["response"])
# [{"box_2d": [120, 450, 150, 520], "label": "Submit button"}]
```

## Troubleshooting

**Out of memory during training**: Use `--qlora` and reduce `--batch-size 1 --grad-accum 2`

**HuggingFace auth required**: Run `huggingface-cli login` with your token

**Ollama registration fails**: Check the server is running and accessible, then try manual registration:
```bash
OLLAMA_HOST=http://100.74.135.83:11440 ollama create gemma4-gui:e2b -f exports/Modelfile
```

**MPS (Apple Silicon)**: QLoRA/bitsandbytes not supported on MPS. Training uses full precision which needs more memory. Use `--max-seq-len 1024` to reduce memory.

**Dataset download slow**: Use `--only omniact` to download one dataset at a time. Downloads support resume.

## License

Gemma 4 is released under Apache 2.0 -- no restrictions on fine-tuning or deployment.
