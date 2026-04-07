# Phase 2 Coordinate Refinement — Testing Harness

## Overview

The Phase 2 testing harness is a comprehensive TypeScript-based system for validating the coordinate refinement system's click accuracy. It executes 20+ predefined click tests, measures refinement accuracy, and reports detailed metrics.

**Key Goals:**
- Validate that refined coordinates land within ±50px of expected targets
- Stretch goal: achieve ±30px accuracy
- Track refinement method effectiveness (vision, DOM, heuristic)
- Generate detailed audit trails for debugging

---

## Quick Start

### 1. Run Tests (Default Mode)

```bash
cd /Users/mk/Downloads/nomads
npx ts-node test-harness.ts --verbose
```

**Output:**
- Real-time test progress with pass/fail indicators
- Summary statistics (pass rate, distance metrics, confidence)
- Method breakdown showing each refinement approach's performance

### 2. Run with JSON Export

```bash
npx ts-node test-harness.ts --verbose --output results.json
```

**Creates:** `results.json` containing complete metrics for all tests

### 3. Run Silently (Minimal Output)

```bash
npx ts-node test-harness.ts
```

---

## Files

| File | Purpose |
|------|---------|
| `test-harness.ts` | Main test runner with execution logic |
| `test-suite.json` | 20 predefined click test definitions |
| `RUN_TESTS.md` | This documentation |
| `results.json` | Output file (created by `--output` flag) |

---

## Understanding the Test Suite

### test-suite.json Structure

```json
{
  "tests": [
    {
      "name": "Chrome dock icon",
      "description": "Test clicking app icon in macOS dock",
      "expectedX": 156,
      "expectedY": 858,
      "tolerance": 50
    },
    ...
  ]
}
```

**Field Meanings:**
- `name`: Brief test identifier
- `description`: Detailed description of what's being tested
- `expectedX` / `expectedY`: Absolute pixel coordinates of the intended click target
- `tolerance`: Maximum acceptable distance (±50px for success)

### Test Coverage Areas

The 20 tests span multiple UI regions:

**Menu Bar (Top, Y ≈ 12-100):**
- System clock (top-right)
- Safari menu items
- Browser buttons (back, forward, reload)
- Address bar and tabs

**Windows (Center, Y ≈ 200-600, X ≈ 400-1000):**
- Text input fields
- Buttons and controls
- Sidebar items
- Main content area

**Corners & Edges:**
- Close button (top-right)
- Settings icon (right side)
- Dock icons (bottom-left)
- Floating action button (bottom-right)

**Dialogs & Modals (Center):**
- Confirm/cancel buttons
- Modal content area

---

## Interpreting Results

### Console Output

When you run the harness with `--verbose`, you'll see output like:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 COORDINATE REFINEMENT — TEST SUITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total tests: 20
Start time: 2026-04-05T15:30:22.123Z

✓ [test-00] Chrome dock icon                    32.45px (vision)      ★
✓ [test-01] System menu clock                   18.32px (dom)         ★
✗ [test-02] Safari menu item                    67.89px (heuristic)
✓ [test-03] Search button in window             22.11px (vision)      ★
...
```

**Legend:**
- `✓` = Test passed (distance ≤ 50px)
- `✗` = Test failed (distance > 50px)
- `★` = Stretch goal met (distance ≤ 30px)
- Distance in pixels = Euclidean distance from refined to expected coordinates
- Method = Which refinement technique was used (vision, dom, or heuristic)

### Summary Section

```
TEST SUITE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESULTS:
  Total Tests:        20 (20 executed)
  Passed (±50px):     19 (95.0%)
  Stretch Goal (±30): 16 (80.0%)

DISTANCE METRICS (pixels):
  Average:            28.45
  Median:             26.32
  Min:                8.12
  Max:                52.67

CONFIDENCE:
  Average:            0.82 (0-1 scale)

METHOD BREAKDOWN:
  vision     —  7 tests, 100.0% pass, avg 22.34px
  dom        —  7 tests, 85.7% pass, avg 31.45px
  heuristic  —  6 tests, 83.3% pass, avg 35.67px
```

**Metrics Explained:**

- **Pass Rate (±50px):** Percentage of tests where refined coordinates landed within tolerance
- **Stretch Rate (±30px):** Percentage of tests achieving the aggressive accuracy target
- **Distance Metrics:** Statistical distribution of errors:
  - Average = mean distance across all tests
  - Median = middle value (robust to outliers)
  - Min/Max = best and worst cases
- **Confidence:** Average confidence score (0-1) reported by the refinement method
- **Method Breakdown:** How each refinement approach performed

---

## Success Criteria

### Primary Threshold (Go/No-Go)

```
PASS: 18 or more tests within ±50px (90% pass rate)
FAIL: 17 or fewer tests within ±50px
```

### Stretch Goals

```
EXCELLENT: 16+ tests within ±30px (80% stretch rate)
GOOD:      12+ tests within ±30px (60% stretch rate)
```

### Exit Codes

- `0` = All criteria met (✓ PASS)
- `1` = One or more criteria failed (✗ FAIL)

---

## JSON Output Format

When using `--output results.json`, the file structure is:

```json
{
  "suite": "Phase 2 Coordinate Refinement",
  "timestamp": "2026-04-05T15:30:22.123Z",
  "totalTests": 20,
  "passedTests": 19,
  "failedTests": 1,
  "stretchGoalsMet": 16,
  "successRate": 95.0,
  "stretchRate": 80.0,
  "averageDistance": 28.45,
  "medianDistance": 26.32,
  "minDistance": 8.12,
  "maxDistance": 52.67,
  "averageConfidence": 0.82,
  "methodBreakdown": {
    "vision": {
      "count": 7,
      "passRate": 100.0,
      "avgDistance": 22.34
    },
    "dom": {
      "count": 7,
      "passRate": 85.7,
      "avgDistance": 31.45
    },
    "heuristic": {
      "count": 6,
      "passRate": 83.3,
      "avgDistance": 35.67
    }
  },
  "results": [
    {
      "testId": "test-00",
      "testName": "Chrome dock icon",
      "testDescription": "Test clicking app icon in macOS dock",
      "expectedX": 156,
      "expectedY": 858,
      "originalX": 171,
      "originalY": 843,
      "refinedX": 155,
      "refinedY": 858,
      "method": "vision",
      "confidence": 0.92,
      "tolerance": 50,
      "distance": 1.23,
      "distanceX": -1,
      "distanceY": 0,
      "success": true,
      "stretchGoalMet": true,
      "timestamp": "2026-04-05T15:30:22.123Z",
      "durationMs": 12.34
    },
    ...
  ]
}
```

### Per-Test Fields

- `testId`: Unique test identifier (test-00, test-01, ...)
- `testName` / `testDescription`: From test-suite.json
- `expectedX` / `expectedY`: Target coordinates
- `originalX` / `originalY`: Initial (unrefined) click coordinates
- `refinedX` / `refinedY`: Output from refinement algorithm
- `distance`: Euclidean distance from refined to expected (pixels)
- `distanceX` / `distanceY`: Signed axis-aligned offsets (pixels)
- `success`: True if distance ≤ tolerance
- `stretchGoalMet`: True if distance ≤ 30px
- `method`: Which refinement technique was used
- `confidence`: Confidence score (0-1) from the method
- `durationMs`: Execution time for this test

---

## Analyzing Results

### Finding Problem Areas

```bash
# Extract failed tests from JSON
jq '.results[] | select(.success == false)' results.json
```

**Output shows tests that didn't meet the ±50px threshold.**

### Method Performance Comparison

```bash
# Group by method and calculate statistics
jq '.results | group_by(.method) | map({
  method: .[0].method,
  count: length,
  passRate: (map(select(.success)) | length / length * 100),
  avgDistance: (map(.distance) | add / length)
})' results.json
```

### Confidence vs. Accuracy

```bash
# Show correlation between confidence and success
jq '.results | map({
  confidence: .confidence,
  distance: .distance,
  success: .success
}) | sort_by(.confidence)' results.json
```

### Outliers

```bash
# Find tests with distance > 40px
jq '.results[] | select(.distance > 40)' results.json
```

---

## Extending the Test Suite

To add new tests, edit `test-suite.json`:

```json
{
  "name": "Your Test Name",
  "description": "What this test validates",
  "expectedX": 640,
  "expectedY": 360,
  "tolerance": 50
}
```

**Guidelines:**
- Use actual screen coordinates from your target environment
- Keep tolerance at 50px (standard) unless testing edge cases
- Include a clear, descriptive name and description
- Cover diverse screen regions and UI element types

---

## Troubleshooting

### "test-suite.json not found"

Ensure both files are in the same directory:
```bash
ls -la /Users/mk/Downloads/nomads/test-*.* /Users/mk/Downloads/nomads/RUN_TESTS.md
```

### "Cannot find module 'ts-node'"

Install TypeScript and ts-node:
```bash
npm install --save-dev typescript ts-node @types/node
```

### Tests Running Slowly

Add more parallelism (future enhancement) or profile with:
```bash
npx ts-node --transpile-only test-harness.ts --verbose
```

### Results Look Wrong

Verify:
1. `test-suite.json` has valid coordinates
2. No other processes interfering with mouse/keyboard
3. Screen resolution matches expected coordinates
4. Check console output for error messages

---

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run coordinate refinement tests
  run: npx ts-node test-harness.ts --output results.json

- name: Check test results
  run: |
    PASSED=$(jq '.passedTests' results.json)
    [ "$PASSED" -ge 18 ] || exit 1
```

### Jenkins

```groovy
stage('Test Coordinate Refinement') {
  steps {
    sh 'npx ts-node test-harness.ts --verbose --output results.json'
    junit 'results.json'
  }
}
```

---

## Performance Notes

| Operation | Time |
|-----------|------|
| Load test suite | ~50ms |
| Per-test execution | ~2-5ms |
| Full suite (20 tests) | ~50-100ms |
| JSON export | ~10-20ms |
| **Total runtime** | **~100-150ms** |

---

## Next Steps

Once Phase 2 testing is complete:

1. **Phase 3:** Multi-method fusion (combine vision + DOM + heuristic results)
2. **Phase 4:** Live refinement during interaction (no batch processing)
3. **Phase 5:** Adaptive confidence thresholds based on method combination

---

## Questions?

Refer to test-harness.ts implementation for detailed code comments and type definitions.
