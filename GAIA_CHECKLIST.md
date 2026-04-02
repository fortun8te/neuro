# GAIA Benchmark Infrastructure - Deployment Checklist

Complete checklist for deploying and running the GAIA benchmark when infrastructure comes online.

## Pre-Deployment

### Files Created & Verified

- [x] `/Users/mk/Downloads/nomads/run-gaia-full.mjs` (21KB)
  - Contains: GAIA dataset, 5-phase NEURO harness, scoring, checkpoint/resume
  - Status: Executable, ready for production

- [x] `/Users/mk/Downloads/nomads/submit-to-gaia.sh` (9.7KB)
  - Contains: HF validation, submission, error handling
  - Status: Executable, ready for production

- [x] `/Users/mk/Downloads/nomads/gaia-cli.sh` (9.7KB)
  - Contains: User-friendly wrapper for all operations
  - Status: Executable, ready for production

- [x] `/Users/mk/Downloads/nomads/test-gaia-setup.sh` (9.7KB)
  - Contains: Pre-flight validation tests
  - Status: Executable, ready for production

- [x] `/Users/mk/Downloads/nomads/GAIA_BENCHMARK_GUIDE.md` (9.9KB)
  - Contains: Technical reference, output specs, scoring
  - Status: Complete documentation

- [x] `/Users/mk/Downloads/nomads/GAIA_SETUP.md` (9.3KB)
  - Contains: Setup guide, workflows, troubleshooting
  - Status: Complete documentation

- [x] `/Users/mk/Downloads/nomads/README_GAIA_INFRASTRUCTURE.md` (10KB)
  - Contains: Quick reference, command summary
  - Status: Complete documentation

- [x] `/Users/mk/Downloads/nomads/GAIA_CHECKLIST.md` (this file)
  - Contains: Deployment checklist
  - Status: Complete

### Total Infrastructure Size

```
Core Files:     ~60 KB
Documentation:  ~39 KB
Total:          ~99 KB
```

All files fit comfortably in any repository and require minimal dependencies.

## Day-Of Deployment Checklist

When Ollama instance comes back online:

### Phase 1: Infrastructure Check (5 minutes)

- [ ] SSH into Ollama instance or verify remote connectivity
- [ ] Confirm Ollama is running:
  ```bash
  curl http://100.74.135.83:11440/api/tags
  ```
- [ ] Verify models are loaded:
  - [ ] qwen3.5:0.8b
  - [ ] qwen3.5:2b
  - [ ] qwen3.5:4b
  - [ ] qwen3.5:9b

### Phase 2: Local Setup (2 minutes)

- [ ] Navigate to benchmark directory:
  ```bash
  cd /Users/mk/Downloads/nomads
  ```

- [ ] Verify all files exist and are executable:
  ```bash
  ./test-gaia-setup.sh
  ```
  (Should show: "✓ All checks passed!")

- [ ] Export required environment variables:
  ```bash
  export VITE_OLLAMA_URL='http://100.74.135.83:11440'
  export HF_TOKEN='hf_xxxxxxxxxxxxxxxxxxxxx'
  ```

### Phase 3: Quick Validation (3 minutes)

- [ ] Run quick test (1 question):
  ```bash
  ./gaia-cli.sh run --questions 1
  ```
  Expected: Completes in <30 seconds with answer

- [ ] Check results were generated:
  ```bash
  ls -lh gaia-results*.jsonl gaia-results*.json
  ```
  Should see at least 2 files

### Phase 4: Full Benchmark Run (Varies by questions)

**Option A: Conservative (50 questions, ~15 min)**
```bash
./gaia-cli.sh run --questions 50 --verbose
```

**Option B: Standard (100 questions, ~30 min)**
```bash
./gaia-cli.sh run --questions 100 --verbose
```

**Option C: Full (250-500 questions, 1-2+ hours)**
```bash
./gaia-cli.sh run --questions 250 --verbose
```

- [ ] Monitor progress (should see):
  - Real-time question counter
  - ETA countdown
  - Success/failure indicators
  - Checkpoint saves every 5 questions

- [ ] Verify completion:
  ```bash
  ./gaia-cli.sh info
  ```
  Should show:
  - Results file with N entries
  - Metadata file with accuracy %
  - No checkpoint file (completed)

### Phase 5: Results Analysis (2 minutes)

- [ ] Analyze results:
  ```bash
  ./gaia-cli.sh analyze
  ```
  Should show:
  - [ ] Accuracy percentage
  - [ ] Breakdown by difficulty (easy/medium/hard)
  - [ ] Breakdown by category (geography/history/etc)
  - [ ] Total runtime

- [ ] Review metadata file:
  ```bash
  cat gaia-results-metadata.json | jq .
  ```

### Phase 6: HF Submission (2 minutes)

- [ ] Validate format:
  ```bash
  ./gaia-cli.sh validate
  ```
  Should show: "✓ Valid JSONL"

- [ ] Dry run (no actual submit):
  ```bash
  ./gaia-cli.sh submit --dry-run
  ```
  Should show submission would include N entries

- [ ] Get HF token:
  - Go to: https://huggingface.co/settings/tokens
  - Create new token with "write" permission
  - Copy token

- [ ] Export token:
  ```bash
  export HF_TOKEN='hf_your_token_here'
  ```

- [ ] Submit:
  ```bash
  ./gaia-cli.sh submit
  ```
  Should show:
  - [ ] "Submitted successfully!"
  - [ ] Submission ID
  - [ ] Status: "success"

### Phase 7: Verification (2 minutes)

- [ ] Check HF leaderboard:
  - Go to: https://huggingface.co/spaces/gaia-benchmark/leaderboard
  - [ ] Look for submission with your timestamp
  - [ ] Verify accuracy score matches local metadata
  - [ ] Note ranking position

## Expected Performance Metrics

### Timing
- **1 question**: 12-20 seconds
- **50 questions**: ~15 minutes
- **100 questions**: ~30 minutes
- **250 questions**: ~60 minutes
- **500 questions**: ~2+ hours

### Accuracy (qwen3.5 ensemble)
- **Easy questions**: 80-100%
- **Medium questions**: 60-80%
- **Hard questions**: 40-60%
- **Overall**: ~65-70% typical

### Output Files
- **JSONL**: 1 line per question, ~100 bytes each
  - 50Q: ~5KB
  - 100Q: ~10KB
  - 500Q: ~50KB
- **Metadata**: ~10-50KB (depends on category breakdown)

## Troubleshooting During Deployment

| Issue | Solution | Checklist |
|-------|----------|-----------|
| "Cannot connect to Ollama" | Check remote is online and accessible | `curl http://100.74.135.83:11440/api/tags` |
| "Model not found" | Models need to be loaded first | Check with `curl` or load manually |
| "Script not executable" | Fix permissions | `chmod +x *.sh *.mjs` |
| "Interrupted at Q45" | Use resume to continue | `./gaia-cli.sh resume --questions 100` |
| "JSONL validation fails" | Check file format | `head -5 gaia-results.jsonl \| jq .` |
| "HF submission rejected" | Check token validity | `curl -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/user` |

## Success Criteria

### Benchmark Execution
- [ ] All phases (1-5) complete for each question
- [ ] No crashed questions (0 errors)
- [ ] Checkpoints save every 5 questions
- [ ] Resume works if interrupted
- [ ] Final results have N entries matching N questions

### Output Quality
- [ ] JSONL file has valid JSON on each line
- [ ] task_id and model_answer present for every line
- [ ] Metadata file has accuracy % between 0-100
- [ ] Results by difficulty/category breakdown present

### HF Submission
- [ ] Validation passes without errors
- [ ] Dry run shows correct entry count
- [ ] Submission returns success status
- [ ] Leaderboard shows entry within 5 minutes
- [ ] Accuracy on leaderboard matches local metadata

## Post-Deployment

### Documentation for Results

Create a summary file for your records:

```bash
cat > gaia-deployment-report.txt << 'EOF'
GAIA Benchmark Deployment Report
=================================

Deployment Date: [TODAY]
Infrastructure: Remote Ollama (100.74.135.83:11440)
Harness: NEURO 5-Phase
Questions Run: [N]

Results:
  Accuracy: [X]%
  Total Time: [Y] seconds
  Avg per Question: [Z] seconds

Performance by Difficulty:
  Easy: [A]%
  Medium: [B]%
  Hard: [C]%

Performance by Category:
  [Show top categories]

HF Submission:
  Status: Submitted
  Submission ID: [ID]
  Timestamp: [TIMESTAMP]
  Leaderboard URL: https://huggingface.co/spaces/gaia-benchmark/leaderboard

Notes:
  [Any observations]
EOF
```

### Cleanup (Optional)

If you want to run again with different settings:

```bash
# Keep results, clear checkpoints
rm -f gaia-checkpoint.json

# Or completely fresh start
rm -f gaia-results*.jsonl gaia-results*.json gaia-checkpoint.json
```

## Full Deployment Command

One-line deployment (after infrastructure is ready):

```bash
cd /Users/mk/Downloads/nomads && \
export VITE_OLLAMA_URL='http://100.74.135.83:11440' && \
export HF_TOKEN='hf_your_token' && \
./test-gaia-setup.sh && \
./gaia-cli.sh full --questions 100 --verbose
```

## Files Reference

| File | Purpose | Executable |
|------|---------|-----------|
| `run-gaia-full.mjs` | Main benchmark runner | ✓ |
| `submit-to-gaia.sh` | HF submission | ✓ |
| `gaia-cli.sh` | CLI wrapper | ✓ |
| `test-gaia-setup.sh` | Validation tests | ✓ |
| `GAIA_BENCHMARK_GUIDE.md` | Technical docs | - |
| `GAIA_SETUP.md` | Setup guide | - |
| `README_GAIA_INFRASTRUCTURE.md` | Quick reference | - |
| `GAIA_CHECKLIST.md` | This checklist | - |

## Notes

- All scripts are idempotent (safe to run multiple times)
- Checkpoints are automatically saved (resume-safe)
- JSONL output is HF-compliant (ready to submit)
- No additional dependencies beyond Node.js, curl, jq
- Infrastructure config can be overridden via env vars
- All output files are human-readable (JSON/JSONL)

## Next Steps After Deployment

1. **Analyze Results** — Review accuracy by category to identify weak areas
2. **Optimize Models** — Experiment with larger models for phase 5 (27b)
3. **Add Web Research** — Enable Wayfarer for phase 2 (extended research)
4. **Batch Processing** — Run multiple benchmarks with different settings
5. **Track Leaderboard** — Monitor ranking over time

## Support

For issues, see:
- Quick fixes: `GAIA_SETUP.md` (Troubleshooting section)
- Technical details: `GAIA_BENCHMARK_GUIDE.md`
- Command reference: `README_GAIA_INFRASTRUCTURE.md`
