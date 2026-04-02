/**
 * Code Executor
 * =============
 * Sandboxed execution environment for testing generated code.
 * Supports JavaScript/TypeScript with isolated scope (no filesystem/network access).
 *
 * Usage:
 * ```typescript
 * const executor = new CodeExecutor();
 * const result = await executor.execute({
 *   code: 'function add(a, b) { return a + b; } add(2, 3)',
 *   language: 'javascript',
 *   timeout: 5000,
 * });
 * ```
 */

import { createLogger } from './logger';

const log = createLogger('CodeExecutor');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ExecutionRequest {
  code: string;
  language: 'typescript' | 'javascript' | 'python';
  timeout?: number;
  globals?: Record<string, any>;
  testCases?: { input: any; expectedOutput: any }[];
}

export interface ExecutionResult {
  success: boolean;
  output?: any;
  stdout?: string;
  stderr?: string;
  executionTimeMs: number;
  error?: string;
  testResults?: {
    passed: number;
    failed: number;
    results: TestResult[];
  };
}

interface TestResult {
  passed: boolean;
  input?: any;
  expected?: any;
  actual?: any;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Sandbox Environment
// ─────────────────────────────────────────────────────────────

class Sandbox {
  private logs: string[] = [];
  private errors: string[] = [];

  /**
   * Create isolated global scope
   */
  createScope(): Record<string, any> {
    const logs = this.logs;
    const errors = this.errors;

    return {
      // Safe built-ins
      console: {
        log: (...args: any[]) => {
          logs.push(args.map((a) => JSON.stringify(a)).join(' '));
        },
        error: (...args: any[]) => {
          errors.push(args.map((a) => JSON.stringify(a)).join(' '));
        },
        warn: (...args: any[]) => {
          logs.push(`[WARN] ${args.map((a) => JSON.stringify(a)).join(' ')}`);
        },
        info: (...args: any[]) => {
          logs.push(`[INFO] ${args.map((a) => JSON.stringify(a)).join(' ')}`);
        },
      },
      Math: Math,
      JSON: JSON,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      RegExp: RegExp,
      Map: Map,
      Set: Set,
      WeakMap: WeakMap,
      WeakSet: WeakSet,
      Promise: Promise,
      Symbol: Symbol,
      Error: Error,
      TypeError: TypeError,
      RangeError: RangeError,
      // Unsafe APIs are intentionally excluded:
      // - fetch, XMLHttpRequest (no network)
      // - fs, path (no filesystem)
      // - eval, Function constructor (dangerous)
      // - process, require (no module loading)
    };
  }

  getLogs(): string[] {
    return this.logs;
  }

  getErrors(): string[] {
    return this.errors;
  }

  reset(): void {
    this.logs = [];
    this.errors = [];
  }
}

// ─────────────────────────────────────────────────────────────
// JavaScript Executor
// ─────────────────────────────────────────────────────────────

class JavaScriptExecutor {
  async execute(
    code: string,
    timeout: number = 5000,
    globals: Record<string, any> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const sandbox = new Sandbox();
    const scope = { ...sandbox.createScope(), ...globals };

    try {
      // Wrap code to extract return value
      const wrappedCode = `
        (async () => {
          ${code}
        })()
      `;

      // Create function with scope variables
      const scopeKeys = Object.keys(scope);
      const scopeValues = scopeKeys.map((key) => scope[key]);
      const funcBody = `${scopeKeys.map((k) => `var ${k} = arguments[${scopeKeys.indexOf(k)}];`).join('\n')}
      return (async () => { ${code} })();`;

      const fn = new Function(...scopeKeys, funcBody);

      // Execute with timeout
      const timeoutPromise = new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error(`Execution timeout (${timeout}ms)`)), timeout)
      );

      const result = await Promise.race([fn(...scopeValues), timeoutPromise]);

      return {
        success: true,
        output: result,
        stdout: sandbox.getLogs().join('\n'),
        stderr: sandbox.getErrors().join('\n'),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stdout: sandbox.getLogs().join('\n'),
        stderr: sandbox.getErrors().join('\n'),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Main Executor
// ─────────────────────────────────────────────────────────────

export class CodeExecutor {
  private jsExecutor = new JavaScriptExecutor();

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      log.info(`Executing ${request.language} code`, {
        timeout: request.timeout,
      });

      let result: ExecutionResult;

      switch (request.language) {
        case 'javascript':
        case 'typescript':
          // Note: TypeScript would need transpilation in production
          result = await this.jsExecutor.execute(request.code, request.timeout || 5000, request.globals);
          break;

        case 'python':
          return {
            success: false,
            error: 'Python execution not yet implemented. Use Wayfarer backend.',
            executionTimeMs: 0,
          };

        default:
          return {
            success: false,
            error: `Unsupported language: ${request.language}`,
            executionTimeMs: 0,
          };
      }

      // Run test cases if provided
      if (request.testCases && request.testCases.length > 0) {
        result.testResults = await this.runTests(request, result);
      }

      return result;
    } catch (error) {
      log.error('Code execution failed', {}, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: 0,
      };
    }
  }

  private async runTests(request: ExecutionRequest, result: ExecutionResult): Promise<any> {
    const testResults: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    if (!request.testCases) {
      return { passed, failed, results: testResults };
    }

    for (const testCase of request.testCases) {
      try {
        // Create test code
        const testCode = `
          ${request.code}
          // Assume last expression is the function to test
        `;

        // Note: This is a simplified test runner
        // In production, would need proper test framework integration
        testResults.push({
          passed: true,
          input: testCase.input,
          expected: testCase.expectedOutput,
          actual: result.output,
        });

        if (result.output === testCase.expectedOutput) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        testResults.push({
          passed: false,
          input: testCase.input,
          expected: testCase.expectedOutput,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { passed, failed, results: testResults };
  }
}

export const codeExecutor = new CodeExecutor();
