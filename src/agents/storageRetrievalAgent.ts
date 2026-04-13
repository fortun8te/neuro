/**
 * Storage & Retrieval Agent for RACKS
 *
 * Ensures data is properly stored and retrieved:
 * - Database schema validation
 * - Query performance analysis
 * - Data consistency checks
 * - Recovery/backup strategies
 * - Retrieval speed optimization
 */

import { SubagentPool } from '../utils/subagentManager';
import { createLogger } from '../utils/logger';

const log = createLogger('storageAgent');

export interface StorageIssue {
  component: string; // "database", "cache", "index", "schema"
  severity: 'critical' | 'high' | 'medium';
  issue: string;
  impact: string;
  solution: string;
  verification: string;
}

export interface RetrievalMetric {
  query: string;
  currentTime: number; // ms
  optimalTime: number; // ms
  bottleneck: string;
  optimization: string;
}

/**
 * Audit storage implementation
 */
export async function auditStorage(
  storageConfig: {
    database: string; // "IndexedDB", "SQLite", etc
    tables: string[];
    indexes: string[];
    totalSize: number; // MB
  },
  pool: SubagentPool,
): Promise<StorageIssue[]> {
  log.info('[StorageAgent] Auditing data storage...');

  const response = await pool.submit({
    role: 'data_architect',
    task: 'Audit storage schema, indexes, and data consistency',
    prompt: `Audit RACKS data storage implementation.

Configuration:
- Database: ${storageConfig.database}
- Tables: ${storageConfig.tables.join(', ')}
- Indexes: ${storageConfig.indexes.join(', ')}
- Total size: ${storageConfig.totalSize}MB

STORAGE AUDIT:

1. SCHEMA VALIDATION
   - Are all required tables present?
   - Is schema normalized? (no redundant columns?)
   - Are relationships properly defined?
   - Are constraints enforced?
   - Type safety (text vs numbers vs dates)?

2. INDEXES
   - Are query columns indexed?
   - Over-indexed? (too many unnecessary indexes?)
   - Covering indexes for common queries?
   - Foreign key indexes?
   - Compound indexes for multi-column queries?

3. DATA INTEGRITY
   - Unique constraints on key fields?
   - Referential integrity checks?
   - Data type mismatches?
   - NULL values in wrong places?
   - Orphaned records (references to deleted items)?

4. QUERY PERFORMANCE
   - Common queries: SELECT, JOIN, FILTER
   - Are queries using indexes?
   - Any N+1 query problems?
   - Pagination implemented correctly?
   - Aggregation queries optimized?

5. CONSISTENCY
   - Is state consistent across tables?
   - Transaction handling?
   - Race conditions on concurrent writes?
   - Cascading deletes?
   - Audit trail (who changed what?)?

6. RECOVERY
   - Backup strategy?
   - Point-in-time recovery?
   - Data loss prevention?
   - Crash recovery?
   - Transaction log?

7. SCALABILITY
   - Can handle 1000s of findings?
   - Pagination for large result sets?
   - Archive strategy for old data?
   - Sharding strategy if needed?

For EACH issue found:
- What's the problem?
- Why does it matter?
- How to fix it?
- How to verify the fix?

Return JSON with issues ranked by severity and impact.`,
    context:
      'You are a database architect and data engineer. Ensure data is properly stored and retrievable.',
    maxSteps: 8,
  });

  return parseStorageIssues(response.text);
}

/**
 * Analyze retrieval performance
 */
export async function analyzeRetrievalPerformance(
  commonQueries: string[],
  pool: SubagentPool,
): Promise<RetrievalMetric[]> {
  log.info('[StorageAgent] Analyzing retrieval performance...');

  const response = await pool.submit({
    role: 'query_optimizer',
    task: 'Analyze and optimize common retrieval queries',
    prompt: `Optimize RACKS data retrieval queries.

Common queries to analyze:
${commonQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For EACH query:
1. Current implementation — how is it structured?
2. Performance baseline — expected time?
3. Bottleneck — what's the slowest part?
4. Optimization strategy:
   - Index hints?
   - Query rewriting?
   - Caching layer?
   - Materialized views?
   - Denormalization?
5. Expected improvement — how much faster?
6. Trade-offs — memory/storage cost?

Common retrieval patterns in RACKS:
- Find all findings for a research session
- Search findings by keyword
- Get findings for a specific brand
- Find duplicate facts
- Get high-confidence findings
- Retrieve competitor analysis
- Fetch research audit trail
- Get session history

For EACH pattern:
- Optimal index structure
- Query execution plan
- Caching strategy
- Pagination approach

Return JSON with:
{
  "query": "SQL or description",
  "currentTime": 150,
  "optimalTime": 50,
  "bottleneck": "What's slow?",
  "optimization": "How to fix?"
}`,
    context:
      'You are a query optimizer. Make retrieval blazingly fast with proper indexing and caching.',
    maxSteps: 6,
  });

  return parseRetrievalMetrics(response.text);
}

/**
 * Parse storage issues from response
 */
function parseStorageIssues(text: string): StorageIssue[] {
  const issues: StorageIssue[] = [];
  const sections = text.split(/issue\s+\d+:|###/i);

  for (const section of sections.slice(1)) {
    const lines = section.split('\n');
    let issue: Partial<StorageIssue> = {};

    for (const line of lines) {
      if (line.includes('component') || line.includes('area:')) {
        issue.component = extractValue(line);
      } else if (line.includes('severity') || line.includes('level:')) {
        const val = extractValue(line).toLowerCase();
        if (val.includes('critical'))
          issue.severity = 'critical';
        else if (val.includes('high'))
          issue.severity = 'high';
        else
          issue.severity = 'medium';
      } else if (line.includes('issue') || line.includes('problem:')) {
        issue.issue = extractValue(line);
      } else if (line.includes('impact') || line.includes('consequence:')) {
        issue.impact = extractValue(line);
      } else if (line.includes('solution') || line.includes('fix:')) {
        issue.solution = extractValue(line);
      } else if (
        line.includes('verification') ||
        line.includes('verify:')
      ) {
        issue.verification = extractValue(line);
      }
    }

    if (issue.issue && issue.component) {
      issues.push({
        component: issue.component || 'database',
        severity: issue.severity || 'medium',
        issue: issue.issue || '',
        impact: issue.impact || '',
        solution: issue.solution || '',
        verification: issue.verification || '',
      });
    }
  }

  return issues;
}

/**
 * Parse retrieval metrics from response
 */
function parseRetrievalMetrics(text: string): RetrievalMetric[] {
  const metrics: RetrievalMetric[] = [];
  const sections = text.split(/query\s+\d+:|###/i);

  for (const section of sections.slice(1)) {
    const lines = section.split('\n');
    let metric: Partial<RetrievalMetric> = {};

    for (const line of lines) {
      if (line.includes('query') && !line.includes('query_')) {
        metric.query = extractValue(line);
      } else if (
        line.includes('currentTime') ||
        line.includes('current time:')
      ) {
        metric.currentTime = parseInt(extractValue(line)) || 100;
      } else if (line.includes('optimalTime') || line.includes('optimal:')) {
        metric.optimalTime = parseInt(extractValue(line)) || 50;
      } else if (line.includes('bottleneck')) {
        metric.bottleneck = extractValue(line);
      } else if (line.includes('optimization')) {
        metric.optimization = extractValue(line);
      }
    }

    if (metric.query) {
      metrics.push({
        query: metric.query || '',
        currentTime: metric.currentTime || 100,
        optimalTime: metric.optimalTime || 50,
        bottleneck: metric.bottleneck || '',
        optimization: metric.optimization || '',
      });
    }
  }

  return metrics.slice(0, 10);
}

/**
 * Extract value from "key: value" line
 */
function extractValue(line: string): string {
  const match = line.match(/:\s*(.+)$/);
  return match ? match[1].trim() : '';
}

/**
 * Generate storage health report
 */
export function generateStorageReport(
  issues: StorageIssue[],
  metrics: RetrievalMetric[],
): string {
  const critical = issues.filter(i => i.severity === 'critical');
  const high = issues.filter(i => i.severity === 'high');

  const avgCurrent =
    metrics.reduce((sum, m) => sum + m.currentTime, 0) / metrics.length || 0;
  const avgOptimal =
    metrics.reduce((sum, m) => sum + m.optimalTime, 0) / metrics.length || 0;
  const speedupMultiplier = (avgCurrent / avgOptimal).toFixed(1);

  return `
📦 RACKS STORAGE & RETRIEVAL REPORT

Critical Issues: ${critical.length}
${critical.map(i => `  🔴 ${i.component}: ${i.issue}`).join('\n')}

High Priority Issues: ${high.length}
${high.map(i => `  🟠 ${i.component}: ${i.issue}`).join('\n')}

Retrieval Performance:
- Current avg time: ${avgCurrent.toFixed(0)}ms
- Optimal avg time: ${avgOptimal.toFixed(0)}ms
- Potential speedup: ${speedupMultiplier}x

Top optimization targets:
${metrics
  .sort(
    (a, b) =>
      (b.currentTime - b.optimalTime) - (a.currentTime - a.optimalTime),
  )
  .slice(0, 3)
  .map(m => `  ⚡ ${m.query}: ${m.bottleneck}`)
  .join('\n')}

Recommended actions:
1. Fix critical issues immediately
2. Add missing indexes
3. Implement query caching
4. Optimize pagination
`;
}
