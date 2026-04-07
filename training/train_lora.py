#!/usr/bin/env python3
"""
train_lora.py -- LoRA fine-tuning of Gemma 4 E2B for GUI grounding.

Uses Unsloth for 2-5x faster training with 50-80% less memory.
Supports QLoRA (4-bit) for consumer GPUs with 8-10 GB VRAM.

Usage:
  python train_lora.py                                  # Train with defaults
  python train_lora.py --epochs 5 --lr 1e-4             # Custom hyperparams
  python train_lora.py --resume checkpoints/step-1000   # Resume from checkpoint
  python train_lora.py --qlora                           # Force 4-bit quantization
  python train_lora.py --export-gguf                     # Export after training
  python train_lora.py --dry-run                         # Validate config only
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from dataclasses import dataclass, field

import torch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("train_lora")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "datasets" / "converted"
CHECKPOINT_DIR = BASE_DIR / "checkpoints"
EXPORT_DIR = BASE_DIR / "exports"


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

@dataclass
class TrainConfig:
    # Model
    model_name: str = "google/gemma-3n-E2B-it"
    max_seq_length: int = 2048
    vision_token_budget: int = 280  # Balance of speed/quality for training

    # LoRA
    lora_rank: int = 16
    lora_alpha: int = 16
    lora_dropout: float = 0.0
    target_modules: list = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ])

    # What to fine-tune
    finetune_vision_layers: bool = False    # Save memory -- freeze vision
    finetune_language_layers: bool = True
    finetune_attention_modules: bool = True
    finetune_mlp_modules: bool = True

    # Training
    num_epochs: int = 3
    batch_size: int = 1
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    warmup_ratio: float = 0.03
    lr_scheduler_type: str = "cosine"
    max_grad_norm: float = 1.0
    bf16: bool = True
    fp16: bool = False

    # QLoRA
    use_qlora: bool = False  # Auto-detected based on VRAM
    load_in_4bit: bool = False

    # Checkpointing
    save_steps: int = 500
    eval_steps: int = 250
    logging_steps: int = 10
    save_total_limit: int = 3

    # Early stopping
    early_stopping_patience: int = 5
    early_stopping_threshold: float = 0.001

    # Paths
    train_file: str = ""
    val_file: str = ""
    output_dir: str = ""
    resume_from: str = ""

    def __post_init__(self):
        if not self.train_file:
            self.train_file = str(DATA_DIR / "train.jsonl")
        if not self.val_file:
            self.val_file = str(DATA_DIR / "val.jsonl")
        if not self.output_dir:
            self.output_dir = str(CHECKPOINT_DIR)


def detect_hardware() -> dict:
    """Detect GPU hardware and recommend settings."""
    info = {
        "cuda_available": torch.cuda.is_available(),
        "gpu_count": 0,
        "gpu_name": "N/A",
        "vram_gb": 0,
        "recommend_qlora": False,
    }

    if torch.cuda.is_available():
        info["gpu_count"] = torch.cuda.device_count()
        info["gpu_name"] = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_mem / (1024 ** 3)
        info["vram_gb"] = round(vram, 1)
        # Recommend QLoRA for GPUs with less than 16 GB
        info["recommend_qlora"] = vram < 16.0
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        info["gpu_name"] = "Apple Silicon (MPS)"
        info["cuda_available"] = False
        # MPS -- cannot use bitsandbytes, use different approach
        log.warning("MPS detected. QLoRA (bitsandbytes) not supported on MPS.")
        log.warning("Training will use full precision on MPS. Expect higher memory usage.")

    return info


# --------------------------------------------------------------------------
# Dataset Loading
# --------------------------------------------------------------------------

def load_training_data(config: TrainConfig):
    """Load and prepare the training dataset for vision fine-tuning."""
    from datasets import Dataset
    from PIL import Image

    def load_jsonl(path: str) -> list[dict]:
        samples = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    samples.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return samples

    log.info(f"Loading training data from {config.train_file}")
    train_raw = load_jsonl(config.train_file)
    log.info(f"Loaded {len(train_raw)} training samples")

    val_raw = []
    if Path(config.val_file).exists():
        log.info(f"Loading validation data from {config.val_file}")
        val_raw = load_jsonl(config.val_file)
        log.info(f"Loaded {len(val_raw)} validation samples")

    def process_sample(sample: dict) -> dict:
        """Convert our JSONL format to Unsloth/TRL conversation format."""
        messages = sample["messages"]
        user_msg = messages[0]
        assistant_msg = messages[1]

        # Extract image path and text from user content
        image_path = None
        text_parts = []
        for content_item in user_msg["content"]:
            if content_item["type"] == "image":
                image_path = content_item["image"]
            elif content_item["type"] == "text":
                text_parts.append(content_item["text"])

        user_text = " ".join(text_parts)
        assistant_text = assistant_msg["content"][0]["text"]

        # Load image
        image = None
        if image_path and Path(image_path).exists():
            try:
                image = Image.open(image_path).convert("RGB")
            except Exception:
                pass

        return {
            "image": image,
            "user_text": user_text,
            "assistant_text": assistant_text,
        }

    # Process into format for Unsloth
    train_processed = []
    skipped = 0
    for s in train_raw:
        p = process_sample(s)
        if p["image"] is not None:
            train_processed.append(p)
        else:
            skipped += 1

    if skipped:
        log.warning(f"Skipped {skipped} training samples (missing images)")

    val_processed = []
    for s in val_raw:
        p = process_sample(s)
        if p["image"] is not None:
            val_processed.append(p)

    log.info(f"Final: {len(train_processed)} train, {len(val_processed)} val samples")
    return train_processed, val_processed


def build_conversation_dataset(samples: list[dict]):
    """Convert processed samples into Unsloth conversation format."""
    conversations = []
    images = []

    for s in samples:
        conv = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": s["user_text"]},
                ],
            },
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": s["assistant_text"]},
                ],
            },
        ]
        conversations.append(conv)
        images.append(s["image"])

    from datasets import Dataset

    return Dataset.from_dict({
        "conversations": conversations,
        "images": images,
    })


# --------------------------------------------------------------------------
# Model Setup
# --------------------------------------------------------------------------

def setup_model(config: TrainConfig, hw_info: dict):
    """Load model with Unsloth and apply LoRA."""
    from unsloth import FastModel

    log.info(f"Loading model: {config.model_name}")
    log.info(f"LoRA rank={config.lora_rank}, alpha={config.lora_alpha}")
    log.info(f"Vision layers frozen: {not config.finetune_vision_layers}")

    # Determine quantization
    load_in_4bit = config.load_in_4bit or config.use_qlora
    if hw_info.get("recommend_qlora") and not load_in_4bit:
        log.info("Auto-enabling QLoRA (4-bit) -- detected <16 GB VRAM")
        load_in_4bit = True

    # Load model
    model, tokenizer = FastModel.from_pretrained(
        model_name=config.model_name,
        max_seq_length=config.max_seq_length,
        load_in_4bit=load_in_4bit,
        full_finetuning=False,
    )

    # Apply LoRA
    model = FastModel.get_peft_model(
        model,
        finetune_vision_layers=config.finetune_vision_layers,
        finetune_language_layers=config.finetune_language_layers,
        finetune_attention_modules=config.finetune_attention_modules,
        finetune_mlp_modules=config.finetune_mlp_modules,
        r=config.lora_rank,
        lora_alpha=config.lora_alpha,
        lora_dropout=config.lora_dropout,
        bias="none",
        random_state=42,
    )

    # Print trainable parameters
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    log.info(f"Trainable params: {trainable:,} / {total:,} ({100 * trainable / total:.2f}%)")

    return model, tokenizer


# --------------------------------------------------------------------------
# Training
# --------------------------------------------------------------------------

def train(config: TrainConfig):
    """Main training loop."""
    from trl import SFTTrainer, SFTConfig
    from transformers import EarlyStoppingCallback

    # Hardware detection
    hw_info = detect_hardware()
    log.info(f"Hardware: {hw_info['gpu_name']}, VRAM: {hw_info['vram_gb']} GB")

    # Load data
    train_samples, val_samples = load_training_data(config)
    if not train_samples:
        log.error("No training samples loaded. Run data_converter.py first.")
        sys.exit(1)

    train_dataset = build_conversation_dataset(train_samples)
    val_dataset = build_conversation_dataset(val_samples) if val_samples else None

    log.info(f"Train dataset: {len(train_dataset)} samples")
    if val_dataset:
        log.info(f"Val dataset: {len(val_dataset)} samples")

    # Setup model
    model, tokenizer = setup_model(config, hw_info)

    # Training arguments
    output_dir = config.output_dir
    os.makedirs(output_dir, exist_ok=True)

    sft_config = SFTConfig(
        output_dir=output_dir,
        num_train_epochs=config.num_epochs,
        per_device_train_batch_size=config.batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        learning_rate=config.learning_rate,
        weight_decay=config.weight_decay,
        warmup_ratio=config.warmup_ratio,
        lr_scheduler_type=config.lr_scheduler_type,
        max_grad_norm=config.max_grad_norm,
        bf16=config.bf16 and torch.cuda.is_bf16_supported() if torch.cuda.is_available() else False,
        fp16=config.fp16,
        logging_steps=config.logging_steps,
        save_steps=config.save_steps,
        eval_steps=config.eval_steps if val_dataset else None,
        eval_strategy="steps" if val_dataset else "no",
        save_total_limit=config.save_total_limit,
        load_best_model_at_end=bool(val_dataset),
        metric_for_best_model="eval_loss" if val_dataset else None,
        greater_is_better=False,
        report_to="none",  # Disable wandb etc. by default
        max_seq_length=config.max_seq_length,
        dataset_text_field="",  # Unused for conversation format
        dataset_kwargs={"skip_prepare_dataset": True},
        remove_unused_columns=False,
        dataloader_pin_memory=True,
        seed=42,
    )

    # Callbacks
    callbacks = []
    if val_dataset:
        callbacks.append(
            EarlyStoppingCallback(
                early_stopping_patience=config.early_stopping_patience,
                early_stopping_threshold=config.early_stopping_threshold,
            )
        )

    # Trainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        args=sft_config,
        callbacks=callbacks,
    )

    # Resume from checkpoint
    resume_path = None
    if config.resume_from:
        resume_path = config.resume_from
        log.info(f"Resuming from {resume_path}")

    # Train
    log.info("=" * 60)
    log.info("STARTING TRAINING")
    log.info("=" * 60)
    start_time = time.time()

    train_result = trainer.train(resume_from_checkpoint=resume_path)

    elapsed = time.time() - start_time
    hours = int(elapsed // 3600)
    mins = int((elapsed % 3600) // 60)
    log.info(f"Training completed in {hours}h {mins}m")
    log.info(f"Final train loss: {train_result.training_loss:.4f}")

    # Save final model
    final_dir = Path(output_dir) / "final"
    log.info(f"Saving final model to {final_dir}")
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))

    # Save training metrics
    metrics = {
        "train_loss": train_result.training_loss,
        "train_runtime": train_result.metrics.get("train_runtime", elapsed),
        "train_samples": len(train_dataset),
        "train_epochs": config.num_epochs,
        "lora_rank": config.lora_rank,
        "model": config.model_name,
        "hardware": hw_info,
    }
    metrics_file = Path(output_dir) / "training_metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics, f, indent=2)
    log.info(f"Metrics saved to {metrics_file}")

    return model, tokenizer


# --------------------------------------------------------------------------
# GGUF Export (optional post-training)
# --------------------------------------------------------------------------

def export_gguf(config: TrainConfig, quantization: str = "q4_k_m"):
    """Export trained model to GGUF format."""
    from unsloth import FastModel

    final_dir = Path(config.output_dir) / "final"
    if not final_dir.exists():
        log.error(f"No trained model found at {final_dir}")
        sys.exit(1)

    export_dir = EXPORT_DIR
    export_dir.mkdir(parents=True, exist_ok=True)

    log.info(f"Loading trained model from {final_dir}")
    model, tokenizer = FastModel.from_pretrained(
        model_name=str(final_dir),
        max_seq_length=config.max_seq_length,
        load_in_4bit=False,
    )

    log.info(f"Exporting to GGUF ({quantization})...")
    model.save_pretrained_gguf(
        str(export_dir / "gemma4-gui-e2b"),
        tokenizer,
        quantization_method=quantization,
    )

    log.info(f"GGUF exported to {export_dir}")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="LoRA fine-tune Gemma 4 E2B for GUI grounding"
    )

    # Model
    parser.add_argument("--model", type=str, default="google/gemma-3n-E2B-it",
                        help="Base model name/path")
    parser.add_argument("--max-seq-len", type=int, default=2048)

    # LoRA
    parser.add_argument("--lora-rank", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=16)

    # Training
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accum", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--warmup", type=float, default=0.03)

    # QLoRA
    parser.add_argument("--qlora", action="store_true", help="Force 4-bit quantization")

    # Data
    parser.add_argument("--train-file", type=str, default="")
    parser.add_argument("--val-file", type=str, default="")
    parser.add_argument("--output-dir", type=str, default="")

    # Checkpointing
    parser.add_argument("--save-steps", type=int, default=500)
    parser.add_argument("--resume", type=str, default="", help="Resume from checkpoint path")

    # Post-training
    parser.add_argument("--export-gguf", action="store_true", help="Export to GGUF after training")
    parser.add_argument("--quantization", type=str, default="q4_k_m",
                        choices=["q4_k_m", "q5_k_m", "q8_0", "f16"],
                        help="GGUF quantization method")

    # Misc
    parser.add_argument("--dry-run", action="store_true", help="Validate config and exit")
    parser.add_argument("--vision-tokens", type=int, default=280,
                        help="Vision token budget per image (default 280)")

    args = parser.parse_args()

    # Build config
    config = TrainConfig(
        model_name=args.model,
        max_seq_length=args.max_seq_len,
        vision_token_budget=args.vision_tokens,
        lora_rank=args.lora_rank,
        lora_alpha=args.lora_alpha,
        num_epochs=args.epochs,
        batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_ratio=args.warmup,
        use_qlora=args.qlora,
        load_in_4bit=args.qlora,
        save_steps=args.save_steps,
        train_file=args.train_file,
        val_file=args.val_file,
        output_dir=args.output_dir,
        resume_from=args.resume,
    )

    # Print config
    hw = detect_hardware()
    log.info("=" * 60)
    log.info("Gemma 4 E2B LoRA Fine-Tuning")
    log.info("=" * 60)
    log.info(f"Model:     {config.model_name}")
    log.info(f"LoRA:      rank={config.lora_rank}, alpha={config.lora_alpha}")
    log.info(f"QLoRA:     {'yes (4-bit)' if config.use_qlora or hw.get('recommend_qlora') else 'no (full precision)'}")
    log.info(f"Epochs:    {config.num_epochs}")
    log.info(f"Batch:     {config.batch_size} x {config.gradient_accumulation_steps} accum = {config.batch_size * config.gradient_accumulation_steps} effective")
    log.info(f"LR:        {config.learning_rate}")
    log.info(f"Seq len:   {config.max_seq_length}")
    log.info(f"Vision:    {config.vision_token_budget} tokens/image")
    log.info(f"GPU:       {hw['gpu_name']} ({hw['vram_gb']} GB)")
    log.info(f"Train:     {config.train_file}")
    log.info(f"Val:       {config.val_file}")
    log.info(f"Output:    {config.output_dir}")

    if args.dry_run:
        log.info("Dry run -- validating config...")
        if not Path(config.train_file).exists():
            log.error(f"Training file not found: {config.train_file}")
            sys.exit(1)
        log.info("Config valid. Exiting (--dry-run).")
        return

    # Train
    model, tokenizer = train(config)

    # Optional GGUF export
    if args.export_gguf:
        export_gguf(config, quantization=args.quantization)

    log.info("Done.")


if __name__ == "__main__":
    main()
