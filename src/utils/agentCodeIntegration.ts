/**
 * Agent Code Integration
 * ======================
 * Integrates code generation with the agent system.
 * Provides hooks for agent workflows to request and manage generated code.
 */

import { agentCodeTool, type WriteCodeRequest, type WriteCodeResponse } from './agentCodeTool';
import { codeExecutor } from './codeExecutor';
import { createLogger } from './logger';

const log = createLogger('AgentCodeIntegration');

// ─────────────────────────────────────────────────────────────
// Code Generation Request from Research
// ─────────────────────────────────────────────────────────────

/**
 * Request handler for agents to generate code from research findings
 */
export async function generateCodeFromResearch(
  researchFindings: Record<string, any>,
  requestSpec: Partial<WriteCodeRequest>,
  signal?: AbortSignal
): Promise<WriteCodeResponse> {
  const context = `
Research Data Summary:
- Total sources analyzed: ${(researchFindings.urlVisited as any[])?.length || 0}
- Key findings: ${(researchFindings.keyFindings as any[])?.slice(0, 3).join('; ') || 'None'}
- Competitor analysis: ${(researchFindings.competitorPositioning as any[])?.length || 0} competitors
- Visual insights: ${(researchFindings.visualFindings as any)?.commonPatterns?.length || 0} patterns
`;

  const fullRequest: WriteCodeRequest = {
    type: 'function',
    name: requestSpec.name || 'generated',
    description: requestSpec.description || 'Generated code',
    language: 'typescript',
    requirements: requestSpec.requirements || [],
    style: 'production',
    ...requestSpec,
    context: context + (requestSpec.context || ''),
  };

  return agentCodeTool.writeCode(fullRequest, signal);
}

// ─────────────────────────────────────────────────────────────
// Code Generation Workflow
// ─────────────────────────────────────────────────────────────

export interface CodeGenerationWorkflow {
  name: string;
  stages: CodeGenerationStage[];
  targetLanguage: 'typescript' | 'python';
}

export interface CodeGenerationStage {
  name: string;
  code: string;
  tests: string[];
  validationRules: string[];
}

/**
 * Execute multi-stage code generation workflow
 */
export async function executeCodeWorkflow(
  workflow: CodeGenerationWorkflow,
  cycle: Record<string, any>,
  signal?: AbortSignal
): Promise<Record<string, WriteCodeResponse>> {
  const results: Record<string, WriteCodeResponse> = {};

  for (const stage of workflow.stages) {
    log.info(`Executing code generation stage: ${stage.name}`);

    const response = await agentCodeTool.writeCode(
      {
        type: 'function',
        name: stage.name,
        description: `Generated during ${cycle.campaignId} cycle`,
        language: workflow.targetLanguage,
        requirements: stage.validationRules,
        context: `Cycle: ${cycle.cycleNumber}, Campaign: ${cycle.campaignId}`,
        style: 'production',
      },
      signal
    );

    results[stage.name] = response;

    // Run tests if provided
    if (stage.tests.length > 0 && response.code) {
      log.info(`Running ${stage.tests.length} tests for ${stage.name}`);
      const testResult = await codeExecutor.execute({
        code: response.code.code,
        language: workflow.targetLanguage as any,
        testCases: stage.tests.map((test) => ({
          input: test,
          expectedOutput: true,
        })),
        timeout: 10000,
      });

      if (!testResult.success) {
        log.warn(`Tests failed for ${stage.name}`, {
          error: testResult.error,
          executionTimeMs: testResult.executionTimeMs,
        });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Code Hooks for Agent Lifecycle
// ─────────────────────────────────────────────────────────────

export interface CodeHooks {
  onBeforeGenerate?: (request: WriteCodeRequest) => Promise<void>;
  onAfterGenerate?: (response: WriteCodeResponse) => Promise<void>;
  onValidationFail?: (response: WriteCodeResponse) => Promise<void>;
  onReviewIssue?: (issue: any) => Promise<void>;
}

export class AgentCodeHookManager {
  private hooks: CodeHooks = {};

  register(hooks: Partial<CodeHooks>): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  async runBeforeGenerate(request: WriteCodeRequest): Promise<void> {
    if (this.hooks.onBeforeGenerate) {
      await this.hooks.onBeforeGenerate(request);
    }
  }

  async runAfterGenerate(response: WriteCodeResponse): Promise<void> {
    if (this.hooks.onAfterGenerate) {
      await this.hooks.onAfterGenerate(response);
    }
  }

  async runValidationFail(response: WriteCodeResponse): Promise<void> {
    if (this.hooks.onValidationFail) {
      await this.hooks.onValidationFail(response);
    }
  }

  async runReviewIssue(issue: any): Promise<void> {
    if (this.hooks.onReviewIssue) {
      await this.hooks.onReviewIssue(issue);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Code Snapshot & Versioning
// ─────────────────────────────────────────────────────────────

export interface CodeSnapshot {
  codeId: string;
  version: number;
  cycleNumber: number;
  campaignId: string;
  code: string;
  language: string;
  timestamp: number;
  metadata: Record<string, any>;
}

/**
 * Snapshot and track code changes across cycles
 */
export class CodeVersionManager {
  private snapshots: Map<string, CodeSnapshot[]> = new Map();

  snapshot(
    code: string,
    language: string,
    cycle: Record<string, any>,
    metadata: Record<string, any> = {}
  ): CodeSnapshot {
    const campaignId = cycle.campaignId || 'unknown';
    const codeId = `code_${campaignId}_${Date.now()}`;
    const version = this.snapshots.get(codeId)?.length ?? 0;

    const snap: CodeSnapshot = {
      codeId,
      version: version + 1,
      cycleNumber: cycle.cycleNumber || 0,
      campaignId: campaignId,
      code,
      language,
      timestamp: Date.now(),
      metadata,
    };

    const existing = this.snapshots.get(codeId) || [];
    existing.push(snap);
    this.snapshots.set(codeId, existing);

    log.info(`Snapshotted code: ${codeId} v${snap.version}`);

    return snap;
  }

  getHistory(codeId: string): CodeSnapshot[] {
    return this.snapshots.get(codeId) || [];
  }

  getLatest(codeId: string): CodeSnapshot | undefined {
    const history = this.getHistory(codeId);
    return history[history.length - 1];
  }

  diff(codeId: string, v1: number, v2: number): string {
    const history = this.getHistory(codeId);
    const snap1 = history[v1 - 1];
    const snap2 = history[v2 - 1];

    if (!snap1 || !snap2) {
      return 'Versions not found';
    }

    // Simple diff (in production, use difflib or similar)
    const lines1 = snap1.code.split('\n');
    const lines2 = snap2.code.split('\n');

    const diff: string[] = [];
    const maxLen = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLen; i++) {
      const l1 = lines1[i] || '';
      const l2 = lines2[i] || '';

      if (l1 !== l2) {
        if (l1) diff.push(`- ${l1}`);
        if (l2) diff.push(`+ ${l2}`);
      }
    }

    return diff.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────
// Singletons
// ─────────────────────────────────────────────────────────────

export const codeHookManager = new AgentCodeHookManager();
export const codeVersionManager = new CodeVersionManager();

// ─────────────────────────────────────────────────────────────
// Example Workflows
// ─────────────────────────────────────────────────────────────

/**
 * Example: Generate React component from design spec
 */
export async function generateComponentFromDesign(
  componentName: string,
  designSpec: string,
  signal?: AbortSignal
): Promise<WriteCodeResponse> {
  return agentCodeTool.writeCode(
    {
      type: 'component',
      name: componentName,
      description: `React component based on design spec:\n${designSpec}`,
      language: 'typescript',
      requirements: [
        'Responsive design',
        'Accessible (WCAG AA)',
        'Tailwind CSS styling',
        'TypeScript strict mode',
      ],
      dependencies: ['react', '@radix-ui/react-button', 'tailwindcss'],
      style: 'production',
      autoValidate: true,
      autoFormat: true,
    },
    signal
  );
}

/**
 * Example: Generate test suite for function
 */
export async function generateTestSuite(
  functionCode: string,
  functionName: string,
  signal?: AbortSignal
): Promise<WriteCodeResponse> {
  return agentCodeTool.writeCode(
    {
      type: 'test',
      name: `${functionName}.test`,
      description: `Comprehensive test suite for ${functionName}`,
      language: 'typescript',
      requirements: [
        'Unit tests',
        'Edge case coverage',
        'Error handling tests',
        'Performance tests',
      ],
      context: `Function to test:\n\`\`\`typescript\n${functionCode}\n\`\`\``,
      dependencies: ['vitest', '@testing-library/react'],
      style: 'production',
    },
    signal
  );
}

/**
 * Example: Generate data analyzer from research
 */
export async function generateAnalyzerFromResearch(
  researchFindings: Record<string, any>,
  analysisType: string,
  signal?: AbortSignal
): Promise<WriteCodeResponse> {
  return generateCodeFromResearch(
    researchFindings,
    {
      type: 'function',
      name: `analyze${analysisType}`,
      description: `Analyzer function that processes research findings to extract ${analysisType}`,
      language: 'typescript',
      requirements: [
        `Extract ${analysisType} from research data`,
        'Handle missing/incomplete data',
        'Return structured results',
      ],
      style: 'production',
    },
    signal
  );
}
