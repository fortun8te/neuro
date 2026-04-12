# Vulnerability Judge Integration Guide

Complete walkthrough for integrating the Vulnerability Judge system into your RACKS research platform.

## Quick Start (5 minutes)

### 1. Import the Core Components
```typescript
import { judgeResearchQuality, type VulnerabilityReport } from './phases/vulnerabilityJudge';
import { 
  orchestrateResearchCycle, 
  generateNextQueries, 
  type ResearchContext 
} from './orchestrator';
import { SubagentPool } from '../utils/subagentManager';
```

### 2. Create a Subagent Pool
```typescript
const pool = new SubagentPool(5); // 5 concurrent critics
```

### 3. Judge Your Research
```typescript
const report = await judgeResearchQuality(
  currentFindings,
  'market_research',
  'What are customer pain points with current solutions?',
  pool,
);

console.log(`Coverage: ${report.coreTopicCoverage}%`);
console.log(`Core covered: ${report.isCoreCovered}`);
```

### 4. Make a Decision
```typescript
if (report.coreTopicCoverage >= 80) {
  // Proceed to next stage
  console.log('Research complete!');
} else {
  // Continue researching
  const nextQueries = report.recommendations;
  // Execute: await research(nextQueries);
}
```

---

## Integration Patterns

### Pattern 1: After Each Research Phase

**Use case:** Validate research before moving to analysis

```typescript
export async function executeResearchPhase(
  question: string,
  initialFindings: Record<string, any>,
  timeLimit: number,
): Promise<ResearchContext> {
  const pool = new SubagentPool(5);
  const context: ResearchContext = {
    originalQuestion: question,
    sessionId: generateSessionId(),
    findings: initialFindings,
    section: 'market_research',
    timeLimit,
    iterationLimit: 3,
    startTime: Date.now(),
  };

  // Judge the initial findings
  const report = await judgeResearchQuality(
    context.findings,
    context.section,
    question,
    pool,
  );

  if (report.isCoreCovered) {
    console.log('✓ Research covers core topic adequately');
    return context;
  }

  // If not covered, log gaps
  console.log(`⚠ Coverage: ${report.coreTopicCoverage}%`);
  console.log('Core gaps:');
  report.coreGaps.forEach(gap => {
    console.log(`  - ${gap.topic} [${gap.importance}]`);
  });

  return context;
}
```

### Pattern 2: Multi-Cycle Research Loop

**Use case:** Iteratively deepen research until coverage goal met

```typescript
export async function iterativeResearch(
  question: string,
  maxCycles: number = 5,
  coverageTarget: number = 0.85,
): Promise<{
  findings: Record<string, any>;
  report: VulnerabilityReport;
  cycleCount: number;
}> {
  const pool = new SubagentPool(5);
  const context: ResearchContext = {
    originalQuestion: question,
    sessionId: generateSessionId(),
    findings: null,
    section: 'main_research',
    timeLimit: 10 * 60 * 1000, // 10 minutes
    iterationLimit: maxCycles,
    startTime: Date.now(),
  };

  let cycleNum = 1;
  let lastReport: VulnerabilityReport | null = null;

  while (cycleNum <= maxCycles) {
    console.log(`\n--- Cycle ${cycleNum} ---`);

    // Execute research for this cycle
    context.findings = await conductResearch(
      question,
      cycleNum,
      lastReport?.recommendations || [],
    );

    // Judge results
    const decision = await orchestrateResearchCycle(context, pool);
    lastReport = decision.vulnerabilityReport;

    console.log(`Coverage: ${decision.vulnerabilityReport.coreTopicCoverage}%`);
    console.log(`Priority: ${decision.vulnerabilityReport.researchPriority}`);

    // Check termination criteria
    if (!decision.continueResearch) {
      console.log(`\n✓ Research complete: ${decision.reason}`);
      pool.close();
      return {
        findings: context.findings,
        report: decision.vulnerabilityReport,
        cycleCount: cycleNum,
      };
    }

    cycleNum++;
  }

  console.log(`\n⚠ Max cycles reached`);
  pool.close();
  return {
    findings: context.findings,
    report: lastReport!,
    cycleCount: cycleNum - 1,
  };
}
```

### Pattern 3: Integrated with Existing Pipeline

**Use case:** Drop into current research → analyze → create pipeline

```typescript
import type { ResearchFindings } from '../types';
import { stageManager } from '../services/stageManager';

export async function researchStageWithJudgment(
  originalQuestion: string,
  researchScope: string,
): Promise<{
  findings: ResearchFindings;
  vulnerabilityReport: VulnerabilityReport;
  shouldProceed: boolean;
}> {
  const pool = new SubagentPool(5);

  try {
    // Your existing research execution
    console.log(`Researching: ${originalQuestion}`);
    const findings = await stageManager.executeResearchPhase(
      originalQuestion,
      researchScope,
    );

    // NEW: Judge quality
    const vulnerabilityReport = await judgeResearchQuality(
      findings,
      researchScope,
      originalQuestion,
      pool,
    );

    // Decide: should proceed to next stage?
    const shouldProceed = vulnerabilityReport.isCoreCovered;

    return {
      findings,
      vulnerabilityReport,
      shouldProceed,
    };
  } finally {
    pool.close();
  }
}

// Usage in pipeline:
const phase1Result = await researchStageWithJudgment(
  'How do customers evaluate solutions in this space?',
  'customer_research',
);

if (phase1Result.shouldProceed) {
  // Proceed to objections phase
  const phase2Result = await objectionsStage(phase1Result.findings);
} else {
  // Log what's missing and re-research
  console.warn('Core gaps identified:');
  phase1Result.vulnerabilityReport.coreGaps.forEach(gap => {
    console.warn(`  - ${gap.topic}`);
  });
}
```

### Pattern 4: Real-Time Coverage Monitoring

**Use case:** Show user live coverage % as research progresses

```typescript
export async function researchWithLiveMonitoring(
  question: string,
): Promise<void> {
  const pool = new SubagentPool(5);
  const context: ResearchContext = {
    originalQuestion: question,
    sessionId: generateSessionId(),
    findings: {},
    section: 'monitored_research',
    timeLimit: 5 * 60 * 1000,
    iterationLimit: 5,
    startTime: Date.now(),
  };

  // Start research
  for (let cycle = 1; cycle <= 5; cycle++) {
    // Execute partial research
    context.findings = await conductSmallResearchBatch(question, cycle);

    // Assess live
    const report = await judgeResearchQuality(
      context.findings,
      context.section,
      question,
      pool,
    );

    // Display progress
    displayProgressBar({
      coverage: report.coreTopicCoverage,
      priority: report.researchPriority,
      gapCount: report.coreGaps.length,
      cycleNum: cycle,
    });

    if (report.isCoreCovered) break;
  }

  pool.close();
}

function displayProgressBar(status: any): void {
  const bar = '█'.repeat(Math.floor(status.coverage / 5)) +
    '░'.repeat(20 - Math.floor(status.coverage / 5));
  console.log(
    `[${bar}] ${status.coverage}% | Priority: ${status.priority} | Gaps: ${status.gapCount}`,
  );
}
```

---

## Integration Checklist

- [ ] Import VulnerabilityJudge components
- [ ] Create SubagentPool instance (or reuse existing)
- [ ] Identify where to add judgment calls in your pipeline
- [ ] Define coverage thresholds for your use cases
- [ ] Add logging/monitoring for reports
- [ ] Test with sample questions
- [ ] Validate decision logic matches your requirements
- [ ] Deploy to production

---

## Configuration Examples

### Conservative (High Bar)
```typescript
const report = await judgeResearchQuality(findings, section, question, pool);

if (report.coreTopicCoverage < 0.90) {
  // Continue researching (high bar)
  console.log('Need deeper research');
} else {
  console.log('Excellent coverage achieved');
}
```

### Balanced (Default)
```typescript
// Uses built-in 85% threshold in orchestrator
const decision = await orchestrateResearchCycle(context, pool);

if (!decision.continueResearch) {
  console.log('Sufficient coverage for proceeding');
}
```

### Fast-Track (Quick Decisions)
```typescript
const report = await judgeResearchQuality(findings, section, question, pool);

if (report.coreTopicCoverage >= 0.60 && report.researchPriority !== 'immediate') {
  // Lower bar for quick decisions
  console.log('Moving forward');
}
```

---

## Error Handling

### Critic Deployment Failure

The system gracefully degrades if the critic subagent fails:

```typescript
export async function judgeResearchQuality(
  findings,
  section,
  question,
  pool,
): Promise<VulnerabilityReport> {
  try {
    const report = await deployCritic(findings, question, coreTopics, pool);
    // Success path
  } catch (error) {
    log.warn('Critic deployment failed, using fallback');
    // Fallback: pattern-based assessment
    const gaps = assessGapsFromFindings(findings, coreTopics);
    // Return degraded but valid report
  }
}
```

### Pool Exhaustion

If subagent pool capacity is exceeded:

```typescript
try {
  const pool = new SubagentPool(5); // Max 5 concurrent
  // Submit up to 5 tasks in parallel
  const reports = await Promise.all([
    judgeResearchQuality(findings1, section1, q1, pool),
    judgeResearchQuality(findings2, section2, q2, pool),
    judgeResearchQuality(findings3, section3, q3, pool),
  ]);
} catch (error) {
  console.warn('Pool capacity exceeded, queuing next request');
  // Retry or use smaller pool
}
```

---

## Testing Integration

### Unit Tests
```typescript
import { judgeResearchQuality } from './phases/vulnerabilityJudge';

describe('Integration with Research Pipeline', () => {
  it('should judge findings and return valid report', async () => {
    const report = await judgeResearchQuality(
      { technique: 'knife method' },
      'peeling',
      'How to peel an apple?',
      pool,
    );

    expect(report.coreTopicCoverage).toBeGreaterThanOrEqual(0);
    expect(report.coreTopicCoverage).toBeLessThanOrEqual(100);
  });
});
```

### Integration Tests
```typescript
describe('Research Phase with Judgment', () => {
  it('should complete research cycle with coverage threshold', async () => {
    const result = await iterativeResearch(
      'What are customer pain points?',
      5,        // max cycles
      0.85,     // coverage target
    );

    expect(result.report.coreTopicCoverage).toBeGreaterThanOrEqual(0.85);
    expect(result.cycleCount).toBeLessThanOrEqual(5);
  });
});
```

---

## Monitoring & Observability

### Log Judgment Results

```typescript
const report = await judgeResearchQuality(findings, section, question, pool);

// Log to your monitoring system
monitor.log({
  event: 'research_judgment',
  question: question.substring(0, 50),
  coverage: report.coreTopicCoverage,
  priority: report.researchPriority,
  gapCount: report.coreGaps.length,
  timestamp: Date.now(),
});
```

### Metrics to Track

- `coreTopicCoverage` — Trend over time, by topic
- `researchPriority` — Distribution across research sessions
- `coreGaps` — Frequency of gap types
- `cycleCount` — Cycles to achieve coverage target
- `timeToCompletion` — Wall-clock time per research session

---

## Troubleshooting

### Coverage Too Low

**Symptom:** Report shows < 40% coverage

**Check:**
1. Is `originalQuestion` specific and clear?
2. Are `findings` actually populated?
3. Is the critic getting proper context?

**Fix:**
```typescript
// Debug: enable verbose logging
const report = await judgeResearchQuality(findings, section, question, pool);

console.log('Core topics extracted:', Object.keys(report.coverageByFacet));
console.log('Coverage by facet:', report.coverageByFacet);
console.log('Gaps:', report.coreGaps.map(g => g.topic));
```

### Inconsistent Reports

**Symptom:** Same findings produce different coverage %

**Cause:** Critic subagent has inherent variance

**Fix:**
```typescript
// Run multiple times and average
const reports = await Promise.all([
  judgeResearchQuality(findings, section, question, pool),
  judgeResearchQuality(findings, section, question, pool),
  judgeResearchQuality(findings, section, question, pool),
]);

const avgCoverage = reports.reduce((sum, r) => sum + r.coreTopicCoverage, 0) / 3;
```

### Pool Closing Prematurely

**Symptom:** "Pool closed" error in second cycle

**Fix:**
```typescript
// Create pool ONCE per session
const pool = new SubagentPool(5);

for (let cycle = 0; cycle < 3; cycle++) {
  const report = await judgeResearchQuality(findings, section, question, pool);
  // Don't close pool here
}

pool.close(); // Close once at the end
```

---

## Next Steps

1. **Review Examples:** `/src/core/examples/vulnerabilityJudgeIntegration.ts`
2. **Read Full Docs:** `/src/core/phases/README_VulnerabilityJudge.md`
3. **Run Tests:** `npm test -- vulnerabilityJudge`
4. **Integrate Gradually:** Start with one research phase, expand to others

---

## Support & Questions

For issues or questions:
1. Check the troubleshooting section above
2. Review example implementations in examples directory
3. Check test cases for usage patterns
4. Review logs for judge output and decision rationale
