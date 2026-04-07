# Architecture Notes — System Design Clarity

## System Overview

The coordinate refinement system is a **4-stage pipeline** for improving click accuracy in vision-driven desktop automation. Each stage is independent and can fail gracefully to the next.

```
Vision Coordinates
       ↓
   [Stage 1: Bounds Validation]
       ↓ (fail if out-of-range)
   [Stage 2: Accessibility Tree Snap]
       ↓ (fail if low confidence)
   [Stage 3: Retry with Jitter]
       ↓ (fail if not found)
   [Stage 4: Fallback to Vision]
       ↓
   Refined Coordinates + Confidence
```

---

## File Architecture

### 1. coordinateRefinement.ts
**Purpose:** Orchestrate 4-stage coordinate refinement pipeline

**Key Components:**
- `refineCoordinates()` — Main pipeline orchestration
- `refineViaAccessibilityTree()` — Stage 2 implementation
- `retryWithJitter()` — Stage 3 implementation
- `executeRefinedClick()` — End-to-end click execution

**Design Decisions:**
- Early returns prevent cascade failures
- Confidence scoring enables quality analysis
- Each stage is optional (accessibility tree requires sessionId)
- Fallback guarantees always returns coordinates

**Why This Design:**
- Accessibility tree is most reliable but unavailable offline
- Jitter handles minor vision inaccuracies
- Fallback prevents infinite loops
- Confidence scoring enables adaptive behavior

---

### 2. desktopVisionLoop.ts
**Purpose:** Closed-loop vision-driven desktop automation

**Key Components:**
- `runDesktopVisionLoop()` — Main automation loop
- `decideAction()` — Vision model integration
- `executeAction()` — DOM interaction dispatch
- `waitForDomStability()` — Change detection

**Design Decisions:**
- Low temperature (0.1) for deterministic actions
- Screenshot → Decide → Execute → Wait cycle
- Action history provides context
- Parse failures trigger max-attempt safety net

**Why This Design:**
- Vision model sees complete screen context
- No tool definitions = maximum flexibility
- Parse failures are critical (stop instead of retry forever)
- DOM stability detection uses mutation observer + position check

**Execution Flow:**
```
Loop Start
  ↓
Capture Screenshot
  ↓
Ask Vision Model
  ↓
Check if Done
  ↓
Execute Action
  ↓
Wait for DOM Stability
  ↓
(Loop until goal or max steps)
```

---

### 3. clickEnhancements.ts
**Purpose:** Optimize click accuracy through element analysis

**Key Components:**
- `detectClickableType()` — Classify elements
- `getOptimalClickPoint()` — Calculate best click location
- `shouldScrollBeforeClick()` — Visibility check
- `postClickFocus()` — Input preparation
- `calculateClickReliability()` — Quality scoring

**Design Decisions:**
- Native elements > ARIA roles > custom attributes
- Click points vary by type (center vs. inside-left)
- Post-click focus prepares for next type action
- Reliability uses weighted scoring (visibility 40%, state 30%, point 30%)

**Why This Design:**
- Priority order respects semantic clarity
- Input fields need special treatment (click near start, not center)
- Post-click focus bridges click → type gap
- Reliability scoring enables predictive analysis

**Type-Specific Click Strategies:**
```
Button/Link:  Click center (visual feedback)
Input:        Click inside-left (position cursor at start)
Contenteditable: Click and place cursor at end
Custom:       Click center (fallback)
```

---

### 4. visibilityOptimizer.ts
**Purpose:** Ensure elements are visible for interaction

**Key Components:**
- `ensureElementVisible()` — Main visibility orchestration
- `getScrollPath()` — Calculate scroll needed
- `waitForScrollCompletion()` — Animation detection
- `getVisibilityState()` — Detailed metrics

**Design Decisions:**
- Two-phase scroll detection: wait for estimated time, then check stability
- Retry loop with reduced padding for sticky headers
- 95% visibility accepted (handles sticky/fixed elements)
- Hard timeout prevents infinite waits

**Why This Design:**
- Smooth scroll animation duration varies by content
- Position stability checks multiple times (debounced)
- Reduced padding on retry handles sticky headers
- Hard timeout prevents infinite loops

**Scroll Animation Detection:**
```
Wait(estimatedDuration)
  ↓
Listen for scroll events
  ↓
Check position stability
  ↓
(if stable for 2 checks, done)
  ↓
(hard timeout after 5s total)
```

---

### 5. metricsCollector.ts
**Purpose:** Collect and analyze refinement metrics

**Key Components:**
- `MetricsCollector` — Singleton per session
- `addClickMetric()` — Record individual click
- `getSessionMetrics()` — Aggregate stats
- `generateReport()` — Markdown export

**Design Decisions:**
- Singleton-per-session isolation
- Element-level success tracking for debugging
- Per-method stats enable algorithm comparison
- Multiple export formats (JSON/CSV)

**Why This Design:**
- Session isolation prevents data leakage
- Element tracking reveals problematic UI components
- Method comparison shows which refinement works best
- Export formats enable external analysis

**Tracking Strategy:**
```
Per-Click Data
  ↓
  ├→ Original coordinates
  ├→ Refined coordinates
  ├→ Confidence score
  └→ Success flag
     ↓
Element Success Map
  ↓
Per-Method Breakdown
  ↓
Problematic Elements Analysis
```

---

## Design Patterns Used

### 1. Pipeline Pattern
**Where:** coordinateRefinement.ts
**Why:** Each stage can fail independently, allowing graceful degradation
**Benefit:** Clear error handling, easy to test per-stage

### 2. Singleton Pattern
**Where:** metricsCollector.ts
**Why:** One metrics collector per session, no global state
**Benefit:** Isolated tracking, easy cleanup per session

### 3. Strategy Pattern
**Where:** clickEnhancements.ts (click strategies per type)
**Why:** Different elements need different click approaches
**Benefit:** Type-specific optimization, extensible

### 4. Observer Pattern
**Where:** visibilityOptimizer.ts (mutation observer)
**Why:** Detect when DOM stops changing
**Benefit:** Robust animation completion, no magic delays

### 5. Factory Pattern
**Where:** desktopVisionLoop.ts (action creation)
**Why:** Encapsulate action object creation
**Benefit:** Centralized validation, easier testing

---

## Key Design Tradeoffs

### Tradeoff 1: Confidence vs. Availability
**Decision:** Prefer accessibility tree (higher confidence) but fall back to vision
**Rationale:** Accessibility tree unavailable offline, vision always works
**Impact:** System always functional, quality varies

### Tradeoff 2: Speed vs. Accuracy
**Decision:** 4-stage pipeline adds latency
**Rationale:** Better accuracy > faster execution
**Impact:** Slower but more reliable clicks

### Tradeoff 3: Complexity vs. Clarity
**Decision:** Separate refinement from enhancement logic
**Rationale:** Each concern has single responsibility
**Impact:** Larger codebase but easier to understand

### Tradeoff 4: Precision vs. Pragmatism
**Decision:** Accept 95% visibility instead of requiring 100%
**Rationale:** Some elements can't be fully visible (sticky headers)
**Impact:** More reliable in real-world scenarios

### Tradeoff 5: Flexibility vs. Safety
**Decision:** Vision model has no tool definitions
**Rationale:** Vision + raw DOM = maximum flexibility
**Impact:** More powerful but less predictable

---

## Error Handling Strategy

### Bounds Validation (Stage 1)
```
If out-of-bounds:
  → Return fallback (screen center)
  → Log warning
  → No retry
```

### Accessibility Tree (Stage 2)
```
If fetch fails:
  → Silently continue to next stage
  → Log debug message
If confidence too low:
  → Continue to next stage
If element not within tolerance:
  → Continue to next stage
```

### Jitter Retry (Stage 3)
```
If element found:
  → Return refined coordinates
If all retries exhausted:
  → Continue to fallback
```

### Fallback (Stage 4)
```
Return original vision coordinates
  (always succeeds, guaranteed return)
```

---

## Performance Considerations

### Screenshot Capture
- **Quality:** 0.78 (balanced: readable text + small payload)
- **Size:** ~50KB per screenshot
- **Time:** <100ms for typical desktop

### Vision Model
- **Temperature:** 0.1 (deterministic)
- **Max tokens:** 200 (force brevity)
- **Time:** 2-5s per decision

### DOM Stability Detection
- **Quiet time:** 200ms (click/press), 150ms (other)
- **Hard timeout:** 1500ms (click/press), 800ms (other)
- **Check interval:** 50ms

### Scroll Animation
- **Estimated duration:** 0.3ms per pixel (max 500ms)
- **Stability checks:** Every 50ms
- **Hard timeout:** 5s total

---

## Future Improvements

### Short Term
1. Add streaming metrics to UI dashboard
2. Implement element-level caching
3. Add visual debug mode (highlight elements)

### Medium Term
1. Adaptive confidence thresholds
2. Machine learning for method selection
3. Keyboard navigation fallback

### Long Term
1. Multi-modal interaction (voice + click)
2. Predictive scrolling (prefetch visible elements)
3. Real-time layout change detection

---

## Testing Strategy

### Unit Tests
- Per-stage refinement (mock accessibility tree)
- Click point calculation (known elements)
- Metrics aggregation (synthetic data)

### Integration Tests
- Full pipeline with real accessibility tree
- Vision loop with mock vision model
- End-to-end clicks on test UI

### Performance Tests
- Screenshot capture time
- Refinement latency per stage
- Metrics collection overhead

### Edge Cases
- Out-of-bounds coordinates
- Missing accessibility tree
- Rapid layout changes
- Sticky/fixed elements

---

## Conclusion

This architecture is designed for **robustness and clarity**:

1. **Robustness:** Multiple fallback stages ensure clicks always execute
2. **Clarity:** Each module has a single responsibility
3. **Flexibility:** Vision model can adapt to any UI without tool definitions
4. **Debuggability:** Comprehensive metrics enable troubleshooting
5. **Extensibility:** Easy to add new refinement stages or metrics

The system successfully balances **power** (no tool constraints) with **safety** (multiple fallbacks) and **clarity** (clear architecture).

---

**Architecture Status:** ✅ SOUND AND MAINTAINABLE
