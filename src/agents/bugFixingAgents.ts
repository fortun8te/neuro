/**
 * Bug Fixing Agents for RACKS
 *
 * 2 agents systematically identify and fix bugs:
 * - Agent 1: Critical bugs (crashes, data loss, security)
 * - Agent 2: Logic bugs (wrong behavior, edge cases, performance)
 */

import { SubagentPool } from '../utils/subagentManager';
import { createLogger } from '../utils/logger';

const log = createLogger('bugFixingAgents');

export interface BugReport {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  location: string; // File path
  description: string;
  impact: string;
  reproduction: string;
  fix: string;
  testCase: string;
}

/**
 * Agent 1: Critical Bug Finder
 * Finds bugs that cause crashes, data loss, security issues
 */
export async function findCriticalBugs(
  codebaseSize: string,
  recentErrors: string[],
  pool: SubagentPool,
): Promise<BugReport[]> {
  log.info('[BugFixer-1] Scanning for critical bugs...');

  const response = await pool.submit({
    role: 'bug_detective',
    task: 'Find critical bugs: crashes, data loss, security issues',
    prompt: `Analyze RACKS research system for CRITICAL bugs.

Recent errors observed:
${recentErrors.slice(0, 5).join('\n')}

CRITICAL BUG PATTERNS TO HUNT:
1. Promise rejection handling — Are errors silently swallowed?
2. Database transactions — Can data be lost on crash?
3. Memory leaks — Are resources properly freed?
4. Null/undefined checks — Do we handle missing data?
5. Concurrency issues — Race conditions in parallel analysis?
6. Type safety violations — Any 'as any' bypasses?
7. Resource exhaustion — Can subagent pool overflow?
8. Unvalidated input — Are user inputs sanitized?
9. Timeout handling — Do long operations properly timeout?
10. State inconsistency — Can state get corrupted?

For EACH critical bug found:
- Exact code location (file + line)
- Why it causes a crash or data loss
- Minimal reproduction case
- 3-line fix
- Unit test to verify fix

Focus on:
1. Research pipeline failures (orchestrator, phases)
2. Analyzer crashes (image, product, social)
3. Database write failures (IndexedDB, SQLite)
4. Subagent pool overload/deadlock
5. Vision model timeout handling`,
    context:
      'You are a security and stability auditor. Find bugs that crash the system or lose data.',
    maxSteps: 8,
  });

  return parseBugReport(response.text, 'critical');
}

/**
 * Agent 2: Logic Bug Finder
 * Finds bugs in business logic, edge cases, performance
 */
export async function findLogicBugs(
  features: string[],
  pool: SubagentPool,
): Promise<BugReport[]> {
  log.info('[BugFixer-2] Scanning for logic bugs...');

  const response = await pool.submit({
    role: 'bug_auditor',
    task: 'Find logic bugs: wrong behavior, edge cases, performance',
    prompt: `Analyze RACKS research system for LOGIC BUGS.

Key features to audit:
${features.join('\n')}

LOGIC BUG PATTERNS:
1. Incorrect calculations — Revenue estimation, confidence scoring
2. Wrong conditionals — If/else logic that doesn't match requirements
3. Off-by-one errors — Array indexing, pagination, limits
4. Type coercion bugs — String vs number, undefined vs null
5. Async/await mistakes — Promises not awaited, race conditions
6. Data transformation errors — JSON parsing, format conversion
7. Filter/sort bugs — Results in wrong order, missing items
8. Duplicate data — Same fact counted twice in findings
9. Edge case handling — Empty arrays, null values, extreme inputs
10. Performance bugs — O(n²) loops, unnecessary computations

For EACH logic bug:
- Feature/function affected
- Current wrong behavior
- Expected correct behavior
- Example input that reproduces
- 3-line fix
- Edge cases to test

Priority areas:
1. Dynamic reasoning (gap identification logic)
2. Confidence scoring (how is it calculated?)
3. Deduplication (are duplicates actually removed?)
4. Sorting/prioritization (are items ranked correctly?)
5. Filtering (are results correctly filtered?)`,
    context:
      'You are a quality assurance engineer. Find bugs in business logic and edge cases.',
    maxSteps: 8,
  });

  return parseBugReport(response.text, 'high');
}

/**
 * Run both bug-fixing agents in parallel
 */
export async function runBugAudit(
  codebaseInfo: {
    size: string;
    features: string[];
    recentErrors: string[];
  },
  pool: SubagentPool,
): Promise<{ critical: BugReport[]; logic: BugReport[] }> {
  log.info('[BugAudit] Running comprehensive bug scan...');

  const [criticalResults, logicResults] = await Promise.allSettled([
    findCriticalBugs(codebaseInfo.size, codebaseInfo.recentErrors, pool),
    findLogicBugs(codebaseInfo.features, pool),
  ]);

  const critical =
    criticalResults.status === 'fulfilled' ? criticalResults.value : [];
  const logic =
    logicResults.status === 'fulfilled' ? logicResults.value : [];

  log.info('[BugAudit] Complete', {
    critical: critical.length,
    logic: logic.length,
    total: critical.length + logic.length,
  });

  return { critical, logic };
}

/**
 * Parse bug reports from agent response
 */
function parseBugReport(text: string, severity: string): BugReport[] {
  const bugs: BugReport[] = [];
  const bugSections = text.split(/bug\s+\d+:|###\s+/i);

  for (const section of bugSections.slice(1)) {
    const lines = section.split('\n');
    let currentBug: Partial<BugReport> = {
      severity: severity as any,
      id: `bug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    for (const line of lines) {
      if (line.includes('location') || line.includes('file:')) {
        currentBug.location = extractValue(line);
      } else if (line.includes('description') || line.includes('issue:')) {
        currentBug.description = extractValue(line);
      } else if (line.includes('impact') || line.includes('consequence:')) {
        currentBug.impact = extractValue(line);
      } else if (
        line.includes('reproduce') ||
        line.includes('reproduction:')
      ) {
        currentBug.reproduction = extractValue(line);
      } else if (line.includes('fix') || line.includes('solution:')) {
        currentBug.fix = extractValue(line);
      } else if (line.includes('test') || line.includes('test case:')) {
        currentBug.testCase = extractValue(line);
      } else if (line.includes('category') || line.includes('type:')) {
        currentBug.category = extractValue(line);
      }
    }

    if (currentBug.description && currentBug.location) {
      bugs.push(currentBug as BugReport);
    }
  }

  return bugs.slice(0, 50); // Max 50 bugs per agent
}

/**
 * Extract value from "key: value" line
 */
function extractValue(line: string): string {
  const match = line.match(/:\s*(.+)$/);
  return match ? match[1].trim() : '';
}

/**
 * Generate fix summary for a bug
 */
export function generateFixSummary(bug: BugReport): string {
  return `
🐛 ${bug.severity.toUpperCase()}: ${bug.description}
📍 Location: ${bug.location}
💥 Impact: ${bug.impact}
🔧 Fix: ${bug.fix}
✅ Test: ${bug.testCase}
`;
}
