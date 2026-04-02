# Quality Evaluation & Auto-Retry System (Phase 11)

## Overview

The Quality Evaluation & Auto-Retry System provides automated quality gates and self-healing capabilities for the NOMADS pipeline. It evaluates each stage output against quality rubrics, identifies failures, and automatically retries with feedback-driven improvements.

**Expected Impact:** 20-30% failure rate reduction, 70% success on first try

---

## Architecture

### 1. Quality Evaluator (`src/utils/qualityEvaluator.ts`)

Core evaluation engine with LLM-powered quality assessment.

#### Key Components

**Quality Rubrics** — Stage-specific criteria with weighted scoring:

- **research**: Coverage breadth (25%), source quality (20%), relevance depth (25%), structure clarity (15%), data recency (15%)
- **brand-dna**: Brand clarity (30%), customer resonance (25%), differentiation (25%), messaging coherence (20%)
- **persona-dna**: Specificity (30%), research grounding (25%), behavioral insight (25%), language authenticity (20%)
- **angles**: Idea novelty (30%), audience resonance (30%), differentiation (25%), execution feasibility (15%)
- **strategy**: Clarity (30%), feasibility (25%), competitive advantage (25%), message consistency (20%)
- **copywriting**: Persuasiveness (30%), relevance (25%), brand voice (20%), clarity & impact (25%)
- **production**: Visual impact (30%), message clarity (25%), technical quality (20%), CTA prominence (25%)
- **test**: Ranking consistency (30%), rationale quality (30%), winner clarity (25%), feedback actionability (15%)

**Severity Levels:**

- **Critical** (< 50): Retry required. Fundamental failures in core metrics.
- **Warning** (50-65): Flag for review. Quality below threshold but may be acceptable.
- **Pass** (65+): Meets quality standards. No action needed.

#### API

```typescript
// Evaluate a stage
const evaluation = await evaluateStageQuality(
  stageName,
  stageData,
  previousContext?
);
// Returns: QualityEvaluation with scores, metrics, severity, retry recommendation

// Check if retry is possible
const { canRetry, reason } = canRetry(retryContext);

// Generate retry strategy
const config = generateRetryConfig(evaluation, retryContext);
// Returns: { newModel, newTemperature, promptModification }
```

---

### 2. Quality Control Hook (`src/hooks/useQualityControl.ts`)

React hook for managing quality state within components.

```typescript
const {
  evaluateAndDecideRetry,    // Evaluate + determine retry need
  getRetryConfig,             // Get configuration for next attempt
  recordRetryAttempt,         // Track retry success/failure
  getCycleQualityMetrics,     // Get metrics for entire cycle
  resetStageQuality,          // Clear state for stage
  clearAllQuality,            // Reset all quality data
} = useQualityControl({
  maxRetries: 3,              // Max retries per stage
  timeoutMinutes: 30,         // Time budget per stage
  enableAutoRetry: true,      // Auto-retry on failure
});
```

---

### 3. Integration Module (`src/utils/qualityControlIntegration.ts`)

Lifecycle management and session tracking.

```typescript
// Initialize quality tracking for cycle
initializeQualityControl(cycleId);

// Evaluate and decide retry (called after stage completion)
const { evaluation, shouldRetry, retryConfig, reason } =
  await evaluateStageAndDecideRetry(cycle, stageName, stageData, campaign, {
    enableAutoRetry: true,
    maxRetries: 3,
    timeoutMinutes: 30,
  });

// Get session data
const session = getQualitySession(cycleId);

// Generate summary for UI
const summary = generateQualitySummary(cycleId);

// Export metrics for analytics
const metrics = exportQualityMetrics(cycleId);
```

---

### 4. Quality Dashboard (`src/components/QualityDashboard.tsx`)

React component for quality monitoring and analysis.

**Features:**

- **Summary Cards**: Overall score, pass rate, retry count, critical issues
- **Severity Filtering**: All / Critical / Warning / Pass tabs
- **Stage Details**: Expandable cards showing metrics, feedback, retry history
- **Failure Patterns**: Analysis of common failure modes
- **Pass Rate Trends**: Historical quality improvement tracking

**Usage:**

```typescript
<QualityDashboard
  cycle={currentCycle}
  qualityMetrics={qualityMetrics}
  onClose={() => setShowQuality(false)}
/>
```

---

## Integration Points

### useCycleLoop Hook Integration

After stage execution completes:

```typescript
// In executeStage completion handler
if (stage.status === 'complete') {
  // Evaluate quality
  const { evaluation, shouldRetry, retryConfig } =
    await evaluateStageAndDecideRetry(
      cycle,
      stageName,
      stage,
      campaign
    );

  // If retry needed
  if (shouldRetry && retryConfig) {
    // Clear output for fresh attempt
    stage.agentOutput = '';
    stage.status = 'in-progress';

    // Inject feedback into prompt
    const enhancedPrompt = originalPrompt + retryConfig.promptModification;

    // Use new model and temperature
    const result = await generate(
      enhancedPrompt,
      systemPrompt,
      {
        model: retryConfig.newModel,
        temperature: retryConfig.newTemperature,
      }
    );

    // Process result and re-evaluate...
  }
}
```

### Cycle Data Storage

Quality metrics stored in cycle:

```typescript
interface Cycle {
  // ... existing fields
  qualityMetrics?: {
    research: QualityEvaluation;
    'brand-dna': QualityEvaluation;
    'persona-dna': QualityEvaluation;
    // ... etc
  };
  qualityHistory?: StageQualityHistory[];
  totalRetries?: number;
}
```

---

## Retry Strategy

### Temperature Adjustment

- **Low temp (< 0.5)**: Was too deterministic → increase to 0.8 for more variation
- **High temp (> 1.0)**: Was too random → decrease to 0.6 for coherence
- **Default (0.5-1.0)**: Toggle between extremes

### Model Upgrade

Retry with stronger model tier:
- 2b → 4b → 9b → 27b → Nemotron (maximum)

### Prompt Injection

Focus on failed metrics:

```
FOCUS: The previous attempt scored low on "Coverage Breadth".
Specifically address: Insufficient coverage of competitor positioning.
Provide more detailed analysis of each competitor's unique angle.
```

### Constraints

- **Max retries**: 3 per stage
- **Time minimum**: 30 seconds remaining for next attempt
- **Max total time**: Configurable per stage (default 30 min)

---

## Quality Thresholds

| Severity | Score Range | Action | Retry Max |
|----------|-------------|--------|-----------|
| Critical | 0-50 | Mandatory retry | 3 |
| Warning | 50-65 | Optional retry | 3 |
| Pass | 65-100 | No action | N/A |

---

## Metrics & Analytics

### Cycle Summary

```typescript
{
  totalStages: 8,
  evaluatedStages: 8,
  passedStages: 6,
  failedStages: 2,
  totalRetries: 3,
  averageQualityScore: 72,
  qualityTrend: 'improving'  // improving | stable | declining
}
```

### Export Format

Quality data exportable for analysis:

```json
{
  "summary": {
    "totalStages": 8,
    "passRate": 75,
    "averageScore": 72,
    "qualityTrend": "improving"
  },
  "stageMetrics": {
    "research": {
      "finalStatus": "passed",
      "totalAttempts": 1,
      "latestScore": 78,
      "severity": "pass"
    }
  },
  "exportedAt": 1234567890
}
```

---

## Implementation Checklist

- [x] Create `qualityEvaluator.ts` with rubrics and evaluation logic
- [x] Create `useQualityControl.ts` hook for React integration
- [x] Create `qualityControlIntegration.ts` for lifecycle management
- [x] Create `QualityDashboard.tsx` UI component
- [x] Create integration tests (`qualityEvaluator.test.ts`)
- [ ] Integrate into `useCycleLoop.ts` (phase 12)
- [ ] Add quality badge to `ResearchOutput.tsx`
- [ ] Update Dashboard to show quality tab
- [ ] Add quality metrics export to PDF reports
- [ ] Create quality improvement recommendations

---

## Testing

Run integration tests:

```bash
npm run test -- qualityEvaluator.test.ts
```

Test coverage includes:

- Empty/short output detection
- Metric scoring and thresholds
- Retry constraint evaluation
- Model and temperature selection
- Prompt modification injection
- All stage rubrics

---

## Future Enhancements

### Phase 12: Cycle Loop Integration

- Auto-retry hook wiring
- Feedback injection into prompts
- Retry state tracking
- Quality badge in ResearchOutput

### Phase 13: Advanced Analytics

- Quality trend analysis
- Root cause clustering
- Model performance comparison
- Preset optimization (which models/temps work best)

### Phase 14: Feedback Loops

- Memory system integration (store quality failures)
- Fine-tuning dataset generation
- A/B testing different retry strategies
- Custom rubric refinement

---

## Configuration

### Environment Variables

No additional env vars needed. Defaults:

- `MAX_RETRIES_PER_STAGE`: 3
- `QUALITY_TIMEOUT_MINUTES`: 30
- `AUTO_RETRY_ENABLED`: true
- `CRITICAL_THRESHOLD`: 50
- `WARNING_THRESHOLD`: 65

Override in Dashboard → Settings → Quality:

```typescript
{
  enableAutoRetry: true,
  maxRetries: 3,
  timeoutMinutes: 30,
  criticalThreshold: 50,
  warningThreshold: 65,
}
```

---

## Troubleshooting

### Quality scores too low

- Check research depth (increase preset)
- Verify prompt engineering (check injection)
- Review model selection (upgrade tier)
- Analyze competitor outputs (benchmark)

### Retries not triggering

- Verify `enableAutoRetry: true` in settings
- Check time budget (may be exceeding timeout)
- Confirm alternative models available
- Review max retries (may be exhausted)

### Evaluation failures

- Check Ollama connection (evaluation model)
- Verify model available (qwen3.5:9b default)
- Check output length (must be > 50 chars)
- Review error logs for LLM parsing issues

---

## Performance Notes

**Evaluation overhead:** ~3-5 seconds per stage (LLM-based evaluation)

**Retry overhead:** Full stage re-execution (varies: research 5min, others 1-2min)

**Storage overhead:** ~10KB per stage history record

**Optimization:**

- Evaluation runs in parallel to next stage prep
- Retry decisions cached to avoid re-evaluation
- Quality session garbage collected after cycle complete

---

## Example Workflow

```
Cycle starts
  ↓
Research stage executes → 4min
  ↓
Quality evaluation → 5sec
  ↓
Score: 68 (warning) → Retry? Yes
  ↓
Inject feedback + use stronger model
  ↓
Research re-executes → 4min
  ↓
Quality re-evaluation → 5sec
  ↓
Score: 78 (pass) → Continue
  ↓
Brand DNA stage executes → 2min
  ↓
Quality evaluation → 5sec
  ↓
Score: 82 (pass) → Continue
  ↓
[continue through remaining stages...]
  ↓
Cycle complete
  ↓
Export quality summary
```

---

## References

- `src/utils/qualityEvaluator.ts` — Core evaluation engine
- `src/hooks/useQualityControl.ts` — React integration
- `src/utils/qualityControlIntegration.ts` — Lifecycle management
- `src/components/QualityDashboard.tsx` — UI component
- `src/utils/__tests__/qualityEvaluator.test.ts` — Tests

---

## Success Metrics

- **First-try pass rate**: Target 70% (up from ~50%)
- **Failure detection rate**: 95%+ (catch real issues)
- **False positive rate**: < 10% (avoid unnecessary retries)
- **Retry success rate**: 80%+ (feedback actually helps)
- **Average GAIA improvement**: +20% (via early failure detection)
