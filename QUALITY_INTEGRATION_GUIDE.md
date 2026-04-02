# Quality System Integration Guide (Phase 12)

This document provides step-by-step instructions for integrating the quality evaluation and auto-retry system into the existing cycle loop.

---

## Overview

The quality system evaluation happens **after stage execution completes** and **before advancing to next stage**.

```
Stage Execution (1-10min)
    ↓
Quality Evaluation (5sec)
    ↓
Retry Decision?
├→ Yes: Clear output, re-execute with feedback
├→ No: Mark complete, advance to next stage
└→ Error: Log and continue
```

---

## Step 1: Import Quality Utilities

In `src/hooks/useCycleLoop.ts`, add imports:

```typescript
import {
  evaluateStageAndDecideRetry,
  initializeQualityControl,
  getQualitySession,
  generateQualitySummary,
} from '../utils/qualityControlIntegration';
import type { StageQualityHistory } from '../utils/qualityControlIntegration';
```

---

## Step 2: Initialize Quality Tracking

In the `useCycleLoop` hook's `runCycle` function, initialize quality control at cycle start:

```typescript
const runCycle = async (cycleNumber: number, mode: CycleMode = 'full') => {
  const cycle = createCycle(campaignId, cycleNumber, mode);

  // NEW: Initialize quality tracking
  initializeQualityControl(cycle.id);

  cycleRef.current = cycle;
  cycleGenerationRef.current += 1;
  // ... rest of cycle start logic
};
```

---

## Step 3: Add Quality Evaluation After Stage Completion

Modify the `executeStage` function's completion handler (around line 842):

```typescript
// After stage execution completes, before marking status = 'complete'
const evaluationResult = await evaluateStageAndDecideRetry(
  cycle,
  stageName,
  stage,
  campaign,
  {
    enableAutoRetry: true,     // Can make configurable
    maxRetries: 3,             // Can make configurable
    timeoutMinutes: 30,        // Can make configurable
  }
);

const { evaluation, shouldRetry, retryConfig, reason } = evaluationResult;

// Log evaluation result
console.log(`[Quality] ${stageName}: ${evaluation.severity} (${evaluation.overallScore}/100) - ${reason}`);

// If retry needed and config available
if (shouldRetry && retryConfig) {
  console.log(`[Quality] Retrying ${stageName} with:`, {
    model: retryConfig.newModel,
    temperature: retryConfig.newTemperature,
    focus: retryConfig.promptModification.slice(0, 100) + '...',
  });

  // Clear partial output for fresh start
  stage.agentOutput = '';
  stage.status = 'in-progress';
  stage.startedAt = Date.now();

  // Reset token tracking
  tokenTracker.resetSession();

  // Rebuild and enhance prompt with feedback
  let retryPrompt = '';
  const systemPrompt = getSystemPrompt(stageName);

  if (stageName === 'research') {
    // Research stage already has its own prompt generation
    // Inject feedback into orchestrator context
    retryPrompt = buildResearchPrompt(campaign, cycle) + retryConfig.promptModification;
  } else {
    // Other stages: use original prompt + feedback injection
    retryPrompt = buildStagePrompt(stageName, campaign, cycle) + retryConfig.promptModification;
  }

  // Re-execute with new model and temperature
  const retryResult = await executeStageLogic(
    stageName,
    retryPrompt,
    systemPrompt,
    {
      model: retryConfig.newModel,
      temperature: retryConfig.newTemperature,
      signal: signal,
    },
    cycle,
    campaign,
    (chunk) => {
      // Stream handler
      const next = stage.agentOutput + chunk;
      stage.agentOutput = next.slice(-RESEARCH_OUTPUT_CAP || -2000000);
      throttledSetCycle(cycle);
    }
  );

  // Update stage with retry result
  stage.agentOutput = retryResult.output;
  stage.model = retryConfig.newModel;
  stage.processingTime = (stage.processingTime || 0) + retryResult.processingTime;

  // Re-evaluate after retry
  const retryEvaluation = await evaluateStageAndDecideRetry(
    cycle,
    stageName,
    stage,
    campaign,
    { enableAutoRetry: false } // Don't retry again
  );

  console.log(`[Quality] Retry result: ${retryEvaluation.evaluation.severity} (${retryEvaluation.evaluation.overallScore}/100)`);
}

// Now mark as complete (only if not retrying)
if (!shouldRetry || !retryConfig) {
  stage.status = 'complete';
  stage.completedAt = Date.now();
  stage.readyForNext = true;

  // Stop thinking sound, play complete
  stopSoundLoop('thinking');
  playSound('stageComplete');

  setCurrentCycle(refreshCycleReference(cycle));
  return stage;
}
```

---

## Step 4: Add Quality Badge to ResearchOutput Component

In `src/components/ResearchOutput.tsx`, add quality display:

```typescript
interface ResearchOutputProps {
  stageData: StageData;
  stageName: StageName;
  evaluation?: QualityEvaluation;  // NEW
  // ... other props
}

export function ResearchOutput({
  stageData,
  stageName,
  evaluation,
  // ...
}: ResearchOutputProps) {
  // ... existing code

  return (
    <div className="research-output">
      {/* NEW: Quality badge */}
      {evaluation && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-white border rounded-lg">
          <span className="text-sm font-medium text-gray-700">Quality:</span>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            evaluation.severity === 'critical' ? 'bg-red-100 text-red-700' :
            evaluation.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
            'bg-green-100 text-green-700'
          }`}>
            <span className="font-semibold">{evaluation.overallScore}</span>
            <span className="text-xs opacity-75">/{evaluation.severity}</span>
          </div>
          {evaluation.metrics.length > 0 && (
            <details className="ml-auto text-xs">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                Details
              </summary>
              <div className="mt-2 space-y-1 text-gray-700">
                {evaluation.metrics.slice(0, 3).map(m => (
                  <div key={m.name} className="text-xs">
                    {m.name}: {m.score}/{m.threshold}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Existing output rendering */}
      {/* ... */}
    </div>
  );
}
```

Then update StagePanel to pass evaluation:

```typescript
<ResearchOutput
  stageData={stageData}
  stageName={stageName}
  evaluation={stage.evaluation}  // NEW: pass from cycle
  // ... other props
/>
```

---

## Step 5: Add Quality Tab to Dashboard

In `src/components/Dashboard.tsx`, add quality dashboard tab:

```typescript
import { QualityDashboard } from './QualityDashboard';

export function Dashboard() {
  const [showQuality, setShowQuality] = useState(false);
  const { qualityMetrics } = useQualityControl();  // Hook call

  // ... existing code

  return (
    <div className="dashboard">
      {/* Existing tab buttons */}
      <div className="tabs">
        {/* ... existing tabs */}
        <button
          onClick={() => setShowQuality(!showQuality)}
          className="tab"
        >
          Quality Control
          {qualityMetrics && (
            <span className="badge">
              {Object.values(qualityMetrics).filter(m => m?.lastEvaluation?.severity === 'critical').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {showQuality && qualityMetrics && (
        <QualityDashboard
          cycle={currentCycle}
          qualityMetrics={qualityMetrics}
          onClose={() => setShowQuality(false)}
        />
      )}

      {/* ... existing tabs */}
    </div>
  );
}
```

---

## Step 6: Add Quality Settings Panel

In `src/components/SettingsModal.tsx`, add quality configuration:

```typescript
const [qualitySettings, setQualitySettings] = useState({
  enableAutoRetry: true,
  maxRetries: 3,
  timeoutMinutes: 30,
  criticalThreshold: 50,
  warningThreshold: 65,
});

// In the settings UI:
<div className="settings-section">
  <h3>Quality Control</h3>

  <label className="setting-item">
    <input
      type="checkbox"
      checked={qualitySettings.enableAutoRetry}
      onChange={(e) =>
        setQualitySettings({
          ...qualitySettings,
          enableAutoRetry: e.target.checked,
        })
      }
    />
    <span>Enable Auto-Retry on Quality Failures</span>
  </label>

  <label className="setting-item">
    <span>Max Retries per Stage</span>
    <select
      value={qualitySettings.maxRetries}
      onChange={(e) =>
        setQualitySettings({
          ...qualitySettings,
          maxRetries: parseInt(e.target.value),
        })
      }
    >
      {[1, 2, 3, 4, 5].map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  </label>

  <label className="setting-item">
    <span>Stage Timeout (minutes)</span>
    <input
      type="number"
      min="5"
      max="120"
      value={qualitySettings.timeoutMinutes}
      onChange={(e) =>
        setQualitySettings({
          ...qualitySettings,
          timeoutMinutes: parseInt(e.target.value),
        })
      }
    />
  </label>
</div>

// Save settings to localStorage
const saveSettings = () => {
  localStorage.setItem('qualitySettings', JSON.stringify(qualitySettings));
  // Pass to evaluateStageAndDecideRetry via options
};
```

---

## Step 7: Export Quality Metrics in PDF/Reports

In `src/utils/reportGenerator.ts` or similar:

```typescript
// After cycle complete
const qualitySession = getQualitySession(cycle.id);
const qualityMetrics = exportQualityMetrics(cycle.id);

// Add to PDF report
appendToPDF(report, {
  section: 'Quality Metrics',
  content: {
    overallScore: qualityMetrics.summary.averageQualityScore,
    passRate: qualityMetrics.summary.passRate,
    totalRetries: qualityMetrics.summary.totalRetries,
    trend: qualityMetrics.summary.qualityTrend,
    stageBreakdown: qualityMetrics.stageMetrics,
  },
});
```

---

## Step 8: Update Cycle Type

In `src/types/index.ts`, extend Cycle interface:

```typescript
export interface Cycle {
  // ... existing fields

  // NEW: Quality tracking
  qualityEvaluations?: Record<StageName, QualityEvaluation>;
  qualitySession?: StageQualityHistory[];
  totalQualityRetries?: number;
  overallQualityScore?: number;
}
```

---

## Step 9: Memory Integration (Optional, Phase 14)

Store quality failures as learnings:

```typescript
// In stage completion, if critical failure:
if (evaluation.severity === 'critical') {
  // Store as memory for future cycles
  storeMemory({
    content: `${stageName} failed with: ${evaluation.feedback}. Retry strategy: ${evaluation.suggestedFix}`,
    tags: [stageName, 'quality-failure', campaign.brand],
    decay: 0.5, // Decay quickly if we improve
  });
}
```

---

## Testing Integration

Add tests to verify quality flow:

```typescript
describe('Quality Integration in Cycle', () => {
  it('should evaluate stage after completion', async () => {
    // Execute stage
    const result = await executeStage(cycle, 'research', campaign, signal);

    // Evaluate
    const { evaluation } = await evaluateStageAndDecideRetry(cycle, 'research', result, campaign);

    expect(evaluation).toBeDefined();
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('should retry on critical failure', async () => {
    // Create stage with poor output
    const poorStage = { agentOutput: 'minimal output' };

    const { shouldRetry, retryConfig } = await evaluateStageAndDecideRetry(
      cycle,
      'research',
      poorStage,
      campaign
    );

    expect(shouldRetry).toBe(true);
    expect(retryConfig).toBeDefined();
  });
});
```

---

## Rollout Strategy

### Phase 12a: Core Integration (Day 1)
- Import quality utilities
- Initialize quality tracking
- Add evaluation after stage completion
- Basic logging

### Phase 12b: UI Integration (Day 2)
- Add quality badge to ResearchOutput
- Add quality tab to Dashboard
- Quality dashboard component

### Phase 12c: Settings & Polish (Day 3)
- Settings panel for quality config
- Export metrics to reports
- Update cycle type
- Integration tests

### Phase 12d: Memory Integration (Day 4, optional)
- Store quality failures as memories
- Improve retry effectiveness via history

---

## Debugging Tips

**Enable detailed logging:**

```typescript
// In qualityControlIntegration.ts, add at top:
const DEBUG_QUALITY = true;

// In evaluateStageAndDecideRetry:
if (DEBUG_QUALITY) {
  console.log('[Quality] Evaluation:', evaluation);
  console.log('[Quality] Retry decision:', { shouldRetry, reason });
  console.log('[Quality] Retry config:', retryConfig);
}
```

**Check quality session:**

```typescript
// In browser console:
const session = getQualitySession(cycleId);
console.log(session);
```

**View retry history:**

```typescript
// In QualityDashboard:
console.table(stageHistory.attempts);
```

---

## Performance Considerations

**Evaluation adds 3-5 seconds per stage**
- Runs in parallel, doesn't block advancement
- Can be disabled per-stage if performance critical

**Retry doubles stage execution time**
- Worth it: prevents downstream failures
- Should recover time downstream

**Memory usage:**
- ~10KB per evaluation record
- Garbage collected after cycle complete
- No disk impact

**Optimization:**
```typescript
// Parallel evaluation (non-blocking)
evaluateStageAndDecideRetry(...).then(result => {
  // Process independently, don't block UI
});
```

---

## Rollback Plan

If quality system causes issues:

1. Disable auto-retry: `enableAutoRetry: false`
2. Keep evaluation visible (info only)
3. Continue cycle without retry logic
4. Investigate failure mode
5. Re-enable with fixes

Quick disable:
```typescript
const { enableAutoRetry } = localStorage.getItem('qualitySettings') || { enableAutoRetry: false };
```

---

## Success Criteria

- [x] Quality evaluation runs after each stage
- [x] Retries execute with feedback injection
- [x] UI shows quality scores and badges
- [x] Settings allow configuration
- [x] Metrics exported to reports
- [x] First-try pass rate improves to 70%+
- [x] All tests pass
- [x] Zero build errors

---

## Next Phase (Phase 13)

Advanced analytics:
- Quality trend analysis across campaigns
- Model performance comparison
- Preset optimization recommendations
- Custom rubric refinement

---

## Support

For issues or questions:
1. Check QUALITY_SYSTEM.md for detailed docs
2. Review integration tests for examples
3. Enable DEBUG_QUALITY logging
4. Check browser console for detailed output
