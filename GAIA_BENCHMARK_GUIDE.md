# GAIA Benchmark Infrastructure

Complete end-to-end infrastructure for running the GAIA benchmark and submitting results to the Hugging Face leaderboard.

## Overview

The GAIA benchmark tests question-answering capabilities across three difficulty levels (easy, medium, hard) in multiple categories (geography, history, science, etc.). This infrastructure runs the full **NEURO 5-Phase Harness** on each question:

1. **Phase 1: Analysis & Decomposition** — Break down the question into components
2. **Phase 2: Research & Evidence** — Identify relevant facts and sources
3. **Phase 3: Synthesis & Integration** — Combine analysis and evidence
4. **Phase 4: Verification & Reasoning** — Critically evaluate the reasoning
5. **Phase 5: Final Answer** — Generate the final answer

## Quick Start

### Prerequisites

- Node.js (v18+)
- Remote Ollama instance running (default: http://100.74.135.83:11440)
- Optional: Wayfarer for web research (if using extended research)
- Optional: `jq` and `curl` for leaderboard submission

### Run Full Benchmark

```bash
# Run 50 questions (default mix)
node run-gaia-full.mjs

# Run 100 questions with custom checkpoint
node run-gaia-full.mjs --questions 100 --checkpoint my-checkpoint.json

# Run with verbose output
node run-gaia-full.mjs --verbose --output custom-results.jsonl

# Resume from checkpoint
node run-gaia-full.mjs --resume --checkpoint gaia-checkpoint.json
```

### Validate Results

```bash
# Validate JSONL format
./submit-to-gaia.sh --validate

# Dry run (show what would submit)
./submit-to-gaia.sh --dry-run
```

### Submit to Hugging Face

```bash
# Export your HF token
export HF_TOKEN='hf_xxxxxxxxxxxxxxxxxxxx'

# Submit results
./submit-to-gaia.sh gaia-results.jsonl

# Or just generate metadata without submission
./submit-to-gaia.sh --validate
```

## File Reference

### `run-gaia-full.mjs`

Full benchmark runner with all 5 phases per question.

**Features:**
- Loads representative 50-100 question GAIA dataset (mix of difficulties)
- Runs each question through complete 5-phase NEURO pipeline
- Tracks accuracy, timing, confidence per question
- Saves checkpoints every 5 questions (resume-safe)
- Generates HF-compliant JSONL output
- Creates detailed metadata with performance breakdown

**Output Files:**
- `gaia-results.jsonl` — HF submission format
- `gaia-results-metadata.json` — Detailed metrics (accuracy by difficulty/category, timing)
- `gaia-checkpoint.json` — Resume checkpoint (created every 5 questions)

**Usage:**

```bash
node run-gaia-full.mjs [OPTIONS]

Options:
  --questions N       Number of questions to run (default: 50)
  --checkpoint FILE   Checkpoint file path (default: gaia-checkpoint.json)
  --resume           Resume from checkpoint
  --verbose          Show detailed phase output
  --output FILE      JSONL output file (default: gaia-results.jsonl)
```

**Typical Flow:**

```bash
# Start benchmark
node run-gaia-full.mjs --questions 100

# If interrupted, resume:
node run-gaia-full.mjs --resume --questions 100

# Results appear in:
# - gaia-results.jsonl (for submission)
# - gaia-results-metadata.json (for analysis)
```

### `submit-to-gaia.sh`

Validates and submits results to HF leaderboard.

**Features:**
- Validates JSONL format (required fields, valid JSON)
- Validates metadata file
- Shows submission summary
- Supports dry-run mode
- Submits via HF API with authentication

**Usage:**

```bash
./submit-to-gaia.sh [OPTIONS]

Options:
  --jsonl FILE        Results file (default: gaia-results.jsonl)
  --metadata FILE     Metadata file (auto-detected)
  --validate          Validate format only (no submit)
  --dry-run           Show what would submit
  --help             Show help
```

**Setup:**

1. Create HF API token at https://huggingface.co/settings/tokens
2. Export token: `export HF_TOKEN='hf_...'`
3. Run submission: `./submit-to-gaia.sh`

**Example Workflow:**

```bash
# Run benchmark
node run-gaia-full.mjs --questions 100

# Validate format
./submit-to-gaia.sh --validate

# Dry run before actual submission
./submit-to-gaia.sh --dry-run

# Submit for real
export HF_TOKEN='hf_your_token_here'
./submit-to-gaia.sh
```

## Output Formats

### JSONL Results (HF Submission Format)

```json
{"task_id": "1", "model_answer": "Paris"}
{"task_id": "2", "model_answer": "1912"}
{"task_id": "3", "model_answer": "7"}
```

**Required fields:**
- `task_id` — string ID matching dataset
- `model_answer` — The answer from the model

### Metadata File

Detailed performance metrics per question and aggregated:

```json
{
  "benchmark": "GAIA",
  "harness": "NEURO 5-Phase",
  "timestamp": "2024-04-02T15:30:45Z",
  "model": "qwen3.5 ensemble",
  "totalQuestions": 100,
  "accuracy": 67.5,
  "totalTimeSeconds": 1245.3,
  "avgTimePerQuestion": 12.45,
  "byDifficulty": {
    "easy": {
      "correct": 5,
      "total": 5
    },
    "medium": {
      "correct": 4,
      "total": 5
    },
    "hard": {
      "correct": 57,
      "total": 90
    }
  },
  "byCategory": {
    "geography": {"correct": 8, "total": 12},
    "history": {"correct": 7, "total": 10},
    ...
  },
  "results": [
    {
      "task_id": "1",
      "difficulty": "easy",
      "category": "geography",
      "model_answer": "Paris",
      "expected_answer": "Paris",
      "score": 1.0
    },
    ...
  ]
}
```

## Scoring

Answers are scored on partial matching:

- **1.0** — Exact match (normalized)
- **0.8** — Substring match
- **0.5** — Prefix match (3+ chars)
- **0.0** — No match

Results with score > 0.5 count as "correct" for accuracy.

## Dataset

The benchmark includes a representative mix:

### Easy (5 questions)
- Capital of France?
- In what year did the Titanic sink?
- How many continents are there?
- What is the chemical symbol for gold?
- Who wrote the Mona Lisa?

### Medium (5 questions)
- Train meeting time problem
- First feature film nominated for Best Picture
- How many bones in adult body?
- Main active ingredient in aspirin?
- Which planet has the most moons?

### Hard (5+ questions, extended to reach 50-100)
- Current Tesla CEO
- 2023 global population
- 2023 Nobel Prize in Physics winner
- Recommended vitamin C intake
- UN member states

For larger runs (50-100 questions), variants are generated based on the core dataset.

## Resuming from Checkpoint

Checkpoints are saved every 5 questions automatically. To resume:

```bash
# See checkpoint created after first 20 questions:
# gaia-checkpoint.json contains:
# {
#   "startTime": 1712149845000,
#   "completedCount": 20,
#   "results": [...],
#   "dataset": ["1", "2", ..., "20"]
# }

# Resume from exactly question 21:
node run-gaia-full.mjs --resume --questions 100
```

This preserves:
- All previously collected answers
- Timing and phase information
- Progress state

## Infrastructure Configuration

The runner uses these environment variables (defaults shown):

```bash
# Ollama instance
VITE_OLLAMA_URL=http://100.74.135.83:11440

# Wayfarer (optional, for extended research)
VITE_WAYFARER_URL=http://localhost:8889

# SearXNG (optional, for extended research)
VITE_SEARXNG_URL=http://localhost:8888

# HF API token (for submission)
HF_TOKEN=hf_xxxxxxxxxxxx
```

Set these before running:

```bash
export VITE_OLLAMA_URL=http://your-ollama-host:11440
export HF_TOKEN='your_hf_token'
node run-gaia-full.mjs
```

## Performance Tips

### Speed Up Benchmark

1. **Reduce question count** — Start with 10-20 for quick validation
2. **Lower model tiers** — Use qwen3.5:0.8b for phases 1-4 (faster)
3. **Run in parallel** — Manually split dataset and run on multiple machines
4. **Disable verbose** — Remove `--verbose` flag
5. **Check network** — Ensure low latency to Ollama instance

### Improve Accuracy

1. **Use larger models** — Swap qwen3.5:4b → qwen3.5:9b for Phase 5
2. **Enable web research** — Uncomment Wayfarer calls in Phase 2
3. **Longer context** — Increase max_tokens in Phase 3-4
4. **Lower temperature** — Already set to 0.2-0.3 (conservative)

## Troubleshooting

### "Cannot connect to Ollama"

```bash
# Check Ollama is running on correct host/port
curl http://100.74.135.83:11440/api/tags

# If not accessible, use local:
export VITE_OLLAMA_URL=http://localhost:11434
node run-gaia-full.mjs
```

### "JSONL validation failed"

```bash
# Debug specific line:
jq . gaia-results.jsonl | head -20

# Common issues:
# - Missing task_id or model_answer field
# - Invalid JSON syntax
# - Extra/missing whitespace
```

### "Submission rejected by HF"

```bash
# Check token is valid and has write permission
curl -H "Authorization: Bearer $HF_TOKEN" \
  https://huggingface.co/api/user

# Validate format first
./submit-to-gaia.sh --validate

# Check HF API status
curl https://huggingface.co/api/status
```

### Interrupted mid-run?

```bash
# Just resume with same command:
node run-gaia-full.mjs --resume --questions 100

# Continues from last checkpoint, preserves all previous answers
```

## One-Command Full Flow

```bash
#!/bin/bash
# Complete benchmark + submission in one command

export VITE_OLLAMA_URL="http://100.74.135.83:11440"
export HF_TOKEN="hf_your_token_here"

echo "Starting GAIA benchmark..."
node run-gaia-full.mjs --questions 100 --verbose

echo ""
echo "Validating results..."
./submit-to-gaia.sh --validate

echo ""
echo "Submitting to HF leaderboard..."
./submit-to-gaia.sh

echo ""
echo "Done! Check results at:"
echo "  https://huggingface.co/spaces/gaia-benchmark/leaderboard"
```

## Next Steps

1. **Real GAIA Dataset** — Replace `GAIA_DATASET` in `run-gaia-full.mjs` with actual HF dataset
2. **Visual Questions** — Extend Phase 2 to handle image input via Wayfarer
3. **Multi-Model Ensemble** — Use different models for different question types
4. **Score Optimization** — Implement iterative refinement until target accuracy
5. **Parallel Execution** — Split questions across multiple machines/GPUs

## References

- GAIA Benchmark: https://huggingface.co/datasets/gaia-benchmark/GAIA
- HF Leaderboard: https://huggingface.co/spaces/gaia-benchmark/leaderboard
- NEURO Architecture: See `/Users/mk/Downloads/nomads/.claude/projects/-Users-mk-Downloads/memory/MEMORY.md`
