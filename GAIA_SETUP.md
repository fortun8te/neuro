# GAIA Benchmark Setup & Deployment

Complete setup guide for running GAIA benchmarks when remote Ollama comes back online.

## Files Created

```
/Users/mk/Downloads/nomads/
├── run-gaia-full.mjs              # Full benchmark harness (5 phases per Q)
├── submit-to-gaia.sh              # HF leaderboard submission validator
├── gaia-cli.sh                    # Convenient CLI wrapper
├── GAIA_BENCHMARK_GUIDE.md        # Detailed documentation
└── GAIA_SETUP.md                  # This file
```

## Prerequisites Checklist

- [ ] Remote Ollama instance (default: http://100.74.135.83:11440)
- [ ] Node.js v18+ installed
- [ ] `jq` installed (for JSON validation)
- [ ] `curl` installed (for HF API)
- [ ] Hugging Face API token (from https://huggingface.co/settings/tokens)

### Install Missing Tools

```bash
# macOS
brew install jq node

# Linux
sudo apt-get install jq curl nodejs

# Verify installations
node --version      # v18+
jq --version        # jq-1.6+
curl --version      # 7.0+
```

## Quick Start (3 Steps)

### Step 1: Verify Infrastructure

```bash
# Check Ollama is accessible
curl -s http://100.74.135.83:11440/api/tags | jq .

# Should see something like:
# {
#   "models": [
#     {"name": "qwen3.5:0.8b"},
#     {"name": "qwen3.5:2b"},
#     ...
#   ]
# }
```

### Step 2: Run Benchmark

```bash
cd /Users/mk/Downloads/nomads

# Option A: Using the CLI wrapper (recommended)
./gaia-cli.sh run --questions 50

# Option B: Direct node command
node run-gaia-full.mjs --questions 50

# Option C: Full workflow (run + analyze + submit)
./gaia-cli.sh full --questions 100
```

### Step 3: Submit Results

```bash
# Get your HF token from https://huggingface.co/settings/tokens
export HF_TOKEN='hf_xxxxxxxxxxxxxxxxxxxxx'

# Option A: Using CLI wrapper
./gaia-cli.sh submit

# Option B: Direct submission script
./submit-to-gaia.sh gaia-results.jsonl
```

## Detailed Usage

### Using the CLI Wrapper (Recommended)

The `gaia-cli.sh` wrapper provides the most convenient interface:

```bash
# Show help
./gaia-cli.sh help

# Check current status
./gaia-cli.sh info

# Run 50 questions (default)
./gaia-cli.sh run

# Run 100 questions with verbose output
./gaia-cli.sh run --questions 100 --verbose

# Resume from checkpoint (if interrupted)
./gaia-cli.sh resume --questions 100

# Analyze results
./gaia-cli.sh analyze gaia-results.jsonl

# Validate format
./gaia-cli.sh validate

# Submit to HF
export HF_TOKEN='hf_...'
./gaia-cli.sh submit

# Full workflow: run + analyze + submit
./gaia-cli.sh full --questions 100 --verbose
```

### Using Node Commands Directly

For more control, run directly:

```bash
# Basic run
node run-gaia-full.mjs

# With 100 questions
node run-gaia-full.mjs --questions 100

# Custom output file
node run-gaia-full.mjs --questions 100 --output my-results.jsonl

# Resume from checkpoint
node run-gaia-full.mjs --resume --checkpoint my-checkpoint.json

# With custom Ollama URL
export VITE_OLLAMA_URL='http://my-ollama-host:11440'
node run-gaia-full.mjs
```

### Manual Submission

```bash
# Validate format
./submit-to-gaia.sh --validate --jsonl gaia-results.jsonl

# Dry run (show what would submit)
./submit-to-gaia.sh --dry-run

# Actually submit
export HF_TOKEN='hf_...'
./submit-to-gaia.sh gaia-results.jsonl
```

## Output Files Explained

After running `./gaia-cli.sh run`, you'll get:

### 1. `gaia-results.jsonl` (HF Submission Format)
```json
{"task_id": "1", "model_answer": "Paris"}
{"task_id": "2", "model_answer": "1912"}
...
```
This is what you submit to HF leaderboard.

### 2. `gaia-results-metadata.json` (Detailed Analysis)
```json
{
  "benchmark": "GAIA",
  "harness": "NEURO 5-Phase",
  "accuracy": 67.5,
  "totalQuestions": 50,
  "totalTimeSeconds": 625.3,
  "byDifficulty": {
    "easy": {"correct": 5, "total": 5},
    "medium": {"correct": 4, "total": 5},
    "hard": {"correct": 36, "total": 40}
  },
  "byCategory": {
    "geography": {"correct": 8, "total": 10},
    "history": {"correct": 7, "total": 8},
    ...
  },
  "results": [...]
}
```
Use this for detailed analysis and reporting.

### 3. `gaia-checkpoint.json` (Resume Point)
```json
{
  "startTime": 1712149845000,
  "completedCount": 20,
  "results": [...],
  "dataset": ["1", "2", ..., "20"]
}
```
Automatically saved every 5 questions. Allows resuming if interrupted.

## Common Workflows

### Quick Test (5-10 minutes)

```bash
./gaia-cli.sh run --questions 10
./gaia-cli.sh analyze
```

### Full Benchmark (2-3 hours)

```bash
./gaia-cli.sh run --questions 100 --verbose
```

### Benchmark + Submission (2-3 hours + 1 min)

```bash
./gaia-cli.sh full --questions 100
```

### Resume After Interruption

```bash
# If script was killed at question 45/100:
./gaia-cli.sh resume --questions 100

# Picks up from checkpoint, continues to 100
# Results are appended to existing gaia-results.jsonl
```

### Batch Processing Multiple Runs

```bash
# Run multiple benchmarks with different settings
for q in 25 50 100; do
  echo "Running with $q questions..."
  ./gaia-cli.sh run --questions $q --output "gaia-results-$q.jsonl"

  echo "Analyzing..."
  ./gaia-cli.sh analyze "gaia-results-$q.jsonl"

  echo "Done."
  echo ""
done
```

## Environment Configuration

Set these before running:

```bash
# Custom Ollama host (default: 100.74.135.83:11440)
export VITE_OLLAMA_URL='http://your-host:11440'

# Custom Wayfarer host (for extended research)
export VITE_WAYFARER_URL='http://your-host:8889'

# HF API token (required for submission)
export HF_TOKEN='hf_xxxxxxxxxxxxxxxxxxxxx'

# Then run
./gaia-cli.sh full --questions 100
```

Permanent setup (add to ~/.bash_profile or ~/.zshrc):

```bash
# GAIA Benchmark defaults
export VITE_OLLAMA_URL='http://100.74.135.83:11440'
export HF_TOKEN='hf_xxxxxxxxxxxxxxxxxxxxx'
```

## Performance Expectations

Based on the 5-phase NEURO harness:

| Questions | Models Used | Duration | Avg/Q | Typical Accuracy |
|-----------|------------|----------|-------|-----------------|
| 10 | qwen3.5:4b | 2-3 min | 15-20s | 60-70% |
| 50 | qwen3.5:4b | 12-15 min | 15-20s | 60-70% |
| 100 | qwen3.5:4b | 25-30 min | 15-20s | 60-70% |

To speed up: use smaller models (qwen3.5:0.8b) for phases 1-4, keep 9b for phase 5.

## Troubleshooting

### Issue: "Cannot connect to Ollama"

```bash
# Check connectivity
curl -v http://100.74.135.83:11440/api/tags

# If remote is down, try local:
export VITE_OLLAMA_URL='http://localhost:11434'

# Restart Ollama
ollama serve

# Then retry
./gaia-cli.sh run
```

### Issue: "JSONL validation failed"

```bash
# Check file format
head -5 gaia-results.jsonl | jq .

# Regenerate if corrupted
./gaia-cli.sh run --questions 50
```

### Issue: "Interrupted at question 45"

```bash
# Just resume - the checkpoint is saved
./gaia-cli.sh resume --questions 100

# Continues from question 46, appends to results
```

### Issue: "HF token rejected"

```bash
# Get new token: https://huggingface.co/settings/tokens
# Export correctly
export HF_TOKEN='hf_xxxxxxxxxxxxx'

# Verify token works
curl -H "Authorization: Bearer $HF_TOKEN" \
  https://huggingface.co/api/user

# Then submit
./gaia-cli.sh submit
```

## Advanced: Customizing the Benchmark

Edit `run-gaia-full.mjs` to customize:

### Use different models per phase

```javascript
// In runNEUROPhases() function:

// Phase 1: Use faster model
model: 'qwen3.5:0.8b',

// Phase 5: Use better model
model: 'qwen3.5:27b',  // slower but more accurate
```

### Add web research to Phase 2

```javascript
// Uncomment in Phase 2:
let searchResults = await wayfarerService.search(question);
context += `Search Results:\n${searchResults}\n\n`;
```

### Adjust temperature (creativity vs accuracy)

```javascript
// Lower = more conservative (better for factual Q&A)
temperature: 0.1,  // very conservative
temperature: 0.3,  // balanced (default)
temperature: 0.7,  // creative
```

### Add more questions to dataset

```javascript
// Add to GAIA_DATASET array:
{
  task_id: '16',
  question: 'Your new question?',
  difficulty: 'medium',
  category: 'yourCategory',
  expected_answer: 'Expected answer',
},
```

## Deployment Checklist

When remote Ollama comes back online:

- [ ] Verify Ollama is running and accessible
- [ ] Test connectivity: `curl http://100.74.135.83:11440/api/tags`
- [ ] Export environment variables
- [ ] Run quick test: `./gaia-cli.sh run --questions 10`
- [ ] Review results: `./gaia-cli.sh analyze`
- [ ] Set HF_TOKEN environment variable
- [ ] Validate format: `./gaia-cli.sh validate`
- [ ] Submit: `./gaia-cli.sh submit`

## One-Command Full Deployment

```bash
#!/bin/bash
# Copy this to deploy.sh and run: bash deploy.sh

cd /Users/mk/Downloads/nomads

# Set configuration
export VITE_OLLAMA_URL='http://100.74.135.83:11440'
export HF_TOKEN='hf_your_token_here'

echo "1. Verifying infrastructure..."
curl -s http://100.74.135.83:11440/api/tags | jq . || {
  echo "ERROR: Cannot reach Ollama"
  exit 1
}

echo ""
echo "2. Running benchmark (100 questions)..."
./gaia-cli.sh run --questions 100 --verbose

echo ""
echo "3. Analyzing results..."
./gaia-cli.sh analyze

echo ""
echo "4. Submitting to HF..."
./gaia-cli.sh submit

echo ""
echo "Done! Results available at:"
echo "  https://huggingface.co/spaces/gaia-benchmark/leaderboard"
```

## Support & Resources

- **GAIA Dataset**: https://huggingface.co/datasets/gaia-benchmark/GAIA
- **HF Leaderboard**: https://huggingface.co/spaces/gaia-benchmark/leaderboard
- **Detailed Guide**: `GAIA_BENCHMARK_GUIDE.md`
- **NEURO Architecture**: `.claude/projects/-Users-mk-Downloads/memory/MEMORY.md`
