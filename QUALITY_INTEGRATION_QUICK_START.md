# Quality Gates Quick Start Guide

## What Was Done

Phase 11 Quality Gates integration is now COMPLETE. The system:
- Evaluates each stage output after completion
- Automatically retries critical failures with model upgrades
- Tracks quality metrics and retry history
- Provides a dashboard for viewing results

---

## Quick Integration Steps

### Step 1: Add Quality Dashboard to UI (Optional but Recommended)

In `src/components/Dashboard.tsx`, add:

```typescript
import { QualityDashboard } from './QualityDashboard';
import { useState } from 'react';

export function Dashboard() {
  const [showQuality, setShowQuality] = useState(false);
  
  // ... existing code ...

  return (
    <div>
      {/* Existing dashboard content */}
      
      {/* Add quality button */}
      <button 
        onClick={() => setShowQuality(!showQuality)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Quality Control
      </button>

      {/* Add quality dashboard */}
      {showQuality && (
        <div className="mt-4">
          <QualityDashboard 
            cycle={currentCycle} 
            onClose={() => setShowQuality(false)}
          />
        </div>
      )}
    </div>
  );
}
```

### Step 2: Configure Quality Settings (Optional)

Quality defaults are:
- Auto-retry enabled
- Max 3 retries per stage
- 30-minute timeout per stage

To customize, users can set in browser localStorage:
```javascript
localStorage.setItem('qualitySettings', JSON.stringify({
  enableAutoRetry: true,     // true/false
  maxRetries: 3,              // 1-5
  timeoutMinutes: 30          // 5-120
}));
```

### Step 3: Monitor Quality in Cycle

After a cycle completes, access quality data:

```typescript
import { getQualitySession } from './utils/qualityControlIntegration';

const cycle = currentCycle;
const session = getQualitySession(cycle.id);

console.log('Quality session:', session);
console.log('Stage history:', session.stageHistory);
```

---

## Key Features Now Active

### Auto-Retry on Failure
When a stage scores below 50 (critical):
1. Output is cleared
2. Stage is re-executed with:
   - Stronger model (upgraded tier)
   - Adjusted temperature (0.9 vs 0.3)
   - Feedback injection from first attempt
3. Quality is re-evaluated
4. Cycle continues (retried or failed)

### Quality Metrics
Each stage gets scored on:
- **Research:** Coverage, source quality, relevance, structure, recency
- **Brand DNA:** Clarity, resonance, differentiation, coherence
- **Personas:** Specificity, research grounding, behavioral insight, language
- **Angles:** Novelty, audience resonance, differentiation, feasibility
- **Strategy:** Clarity, feasibility, competitive advantage, consistency
- **Copywriting:** Persuasiveness, relevance, brand voice, clarity
- **Production:** Visual impact, message clarity, technical quality, CTA
- **Testing:** Ranking consistency, rationale, winner clarity, feedback

### Quality Severity Levels
- **PASS (65+):** Stage output acceptable, proceed
- **WARNING (50-64):** Flag but continue (no auto-retry)
- **CRITICAL (<50):** Auto-retry if enabled

---

## Console Logging

Quality events appear with `[Quality]` prefix:

```
[Quality] research: pass (78/100) - Quality evaluation passed
[Quality] angles: warning (64/100) - Quality score below warning threshold
[Quality] angles: Retrying with: { model: 'qwen3.5:9b', temperature: 0.9, ... }
[Quality] Retry result: pass (72/100)
```

Enable detailed logging:
```javascript
localStorage.setItem('debugQuality', 'true');
```

---

## Testing the Integration

### Basic Test
1. Run a cycle normally
2. Quality evaluations run automatically after each stage
3. Open browser console to see [Quality] logs
4. Check that stages complete normally

### Retry Test
1. Lower quality thresholds to trigger retries:
```javascript
localStorage.setItem('qualitySettings', JSON.stringify({
  enableAutoRetry: true,
  maxRetries: 3,
  timeoutMinutes: 30
}));
```
2. Run a cycle
3. Watch console for [Quality] logs showing retries
4. Verify stage times increase when retries occur

### Dashboard Test
1. Add QualityDashboard to your UI
2. Run a cycle
3. Click "Quality Control" button after cycle completes
4. Verify dashboard shows:
   - Average score
   - Pass/fail counts
   - Per-stage details with metrics
   - Retry counts

---

## Troubleshooting

### Quality evaluation takes too long
- Default: 3-5 seconds per stage
- If slower: may indicate Ollama slowness
- Check: `localStorage.getItem('qualitySettings')`
- Solution: Can disable with `enableAutoRetry: false`

### Retries keep failing
- Check console logs for evaluation details
- Verify different models are available
- Check Ollama has sufficient memory
- Solution: Manually disable retries in settings

### Quality data not persisting
- Evaluations stored in `cycle.stages[stageName].evaluation`
- Session data stored in memory (not persisted across reloads)
- Solution: Export cycle before page refresh

### Dashboard shows no data
- Ensure cycle has completed stages
- Verify `getQualitySession(cycle.id)` returns non-null
- Check: `cycle.stages[stageName].evaluation` exists

---

## What's NOT Included Yet (Phase 12+)

These will be added in future phases:
- [ ] Quality settings panel in SettingsModal
- [ ] Quality badge on ResearchOutput
- [ ] Quality metrics in PDF reports
- [ ] Cross-cycle quality analytics
- [ ] Model performance comparison
- [ ] Memory integration for learning

---

## Files Modified/Created

**Modified:**
- `src/types/index.ts` - Added QualityEvaluation type and field
- `src/hooks/useCycleLoop.ts` - Integrated quality evaluation and retry logic

**Created:**
- `src/components/QualityDashboard.tsx` - Quality metrics dashboard

**Already Existed (Used):**
- `src/utils/qualityEvaluator.ts` - Quality rubrics and evaluation
- `src/utils/qualityControlIntegration.ts` - Quality session management
- `src/hooks/useQualityControl.ts` - Quality control hook

---

## Support

Check the detailed integration guide:
- `QUALITY_GATES_INTEGRATION_SUMMARY.md` - Complete technical reference
- `QUALITY_INTEGRATION_GUIDE.md` - Step-by-step implementation

For issues or questions:
1. Check console logs for [Quality] prefix messages
2. Enable `localStorage.setItem('debugQuality', 'true')`
3. Review quality session: `getQualitySession(cycleId)`
4. Check quality settings: `JSON.parse(localStorage.getItem('qualitySettings'))`

