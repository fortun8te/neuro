/**
 * Agent Code Tool
 * ===============
 * Enables agents to write code during execution.
 * Provides a tool interface for agents to request code generation,
 * validation, and integration.
 *
 * Usage by agents:
 * agent.tools.write_code({
 *   type: 'function',
 *   name: 'analyzeMarketTrends',
 *   description: 'Function to analyze market trends from research data',
 *   language: 'typescript',
 *   requirements: ['Takes market data array', 'Returns trend analysis', 'Handles edge cases'],
 * })
 */

import { codeGenerator, type CodeGenerationRequest, type GeneratedCode } from './codeGenerator';
import { validateCode, type ValidatorReport } from './syntaxValidator';
import { createLogger } from './logger';

const log = createLogger('AgentCodeTool');

// ─────────────────────────────────────────────────────────────
// Tool Request/Response Types
// ─────────────────────────────────────────────────────────────

export interface WriteCodeRequest extends CodeGenerationRequest {
  autoValidate?: boolean;
  autoFormat?: boolean;
  generateTests?: boolean;
}

export interface WriteCodeResponse {
  success: boolean;
  code?: GeneratedCode;
  validation?: ValidatorReport;
  testSuggestions?: string[];
  error?: string;
  executionTimeMs?: number;
}

export interface TestCodeRequest {
  code: string;
  language: string;
  testCases?: string[];
  timeout?: number;
}

export interface TestCodeResponse {
  success: boolean;
  output?: string;
  errors?: string[];
  testsPassed?: number;
  testsFailed?: number;
}

// ─────────────────────────────────────────────────────────────
// Code Review Gate
// ─────────────────────────────────────────────────────────────

interface ReviewResult {
  approved: boolean;
  issues: ReviewIssue[];
  recommendations: string[];
}

interface ReviewIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  suggestion?: string;
}

class CodeReviewGate {
  /**
   * Review generated code for security and best practices
   */
  review(code: string, language: string, type: string): ReviewResult {
    const issues: ReviewIssue[] = [];
    const recommendations: string[] = [];

    // Security checks
    if (language === 'typescript' || language === 'javascript') {
      if (code.includes('eval(')) {
        issues.push({
          severity: 'high',
          category: 'security',
          message: 'eval() is a security risk',
          suggestion: 'Use safer alternatives like Function() or JSON.parse()',
        });
      }

      if (code.includes('innerHtml') || code.includes('innerHTML')) {
        issues.push({
          severity: 'high',
          category: 'security',
          message: 'Direct HTML injection via innerHTML can cause XSS',
          suggestion: 'Use textContent or sanitize HTML with DOMPurify',
        });
      }

      if (code.includes('dangerouslySetInnerHTML')) {
        issues.push({
          severity: 'medium',
          category: 'security',
          message: 'dangerouslySetInnerHTML should only be used with sanitized HTML',
          suggestion: 'Ensure HTML is sanitized before use',
        });
      }

      if (code.match(/fetch\s*\(\s*['"`]\$\{/) || code.includes('new URL(user')) {
        issues.push({
          severity: 'medium',
          category: 'security',
          message: 'URL constructed from user input without validation',
          suggestion: 'Validate and sanitize URL inputs',
        });
      }
    }

    if (language === 'python') {
      if (code.includes('exec(') || code.includes('eval(')) {
        issues.push({
          severity: 'high',
          category: 'security',
          message: 'exec() and eval() are security risks',
          suggestion: 'Use safer alternatives or subprocess',
        });
      }

      if (code.includes('os.system(') || code.includes('subprocess')) {
        issues.push({
          severity: 'medium',
          category: 'security',
          message: 'Shell commands should be executed carefully',
          suggestion: 'Use subprocess.run() with shell=False',
        });
      }

      if (code.includes('pickle.load') || code.includes('pickle.loads')) {
        issues.push({
          severity: 'high',
          category: 'security',
          message: 'pickle can execute arbitrary code',
          suggestion: 'Use JSON or yaml.safe_load() instead',
        });
      }
    }

    // Complexity checks
    const lines = code.split('\n').length;
    if (lines > 500) {
      recommendations.push('Function is very long (>500 lines). Consider breaking into smaller functions.');
    }

    const nestingLevel = this.calculateMaxNesting(code);
    if (nestingLevel > 5) {
      recommendations.push('High nesting level. Consider refactoring with helper functions.');
    }

    // Database operations (require review)
    if (code.match(/INSERT|UPDATE|DELETE|DROP/i)) {
      issues.push({
        severity: 'high',
        category: 'database',
        message: 'Code contains database mutations',
        suggestion: 'Ensure parameterized queries are used. Manual review required.',
      });
    }

    // File system operations
    if (code.includes('fs.') || code.includes('open(') || code.includes('write(')) {
      issues.push({
        severity: 'medium',
        category: 'permissions',
        message: 'Code accesses file system',
        suggestion: 'Ensure proper permissions and error handling.',
      });
    }

    // Network operations
    if (code.includes('fetch') || code.includes('http.') || code.includes('requests.')) {
      recommendations.push('Code makes network requests. Ensure proper error handling and timeout.');
    }

    // Determine approval
    const approved = issues.filter((i) => i.severity === 'high').length === 0;

    return {
      approved,
      issues,
      recommendations,
    };
  }

  private calculateMaxNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    for (const char of code) {
      if (char === '{' || char === '[' || char === '(') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}' || char === ']' || char === ')') {
        currentNesting--;
      }
    }
    return maxNesting;
  }
}

// ─────────────────────────────────────────────────────────────
// Code Library for Reusable Snippets
// ─────────────────────────────────────────────────────────────

interface CodeLibraryEntry {
  id: string;
  name: string;
  type: string;
  language: string;
  code: string;
  description: string;
  tags: string[];
  createdAt: number;
  usageCount: number;
}

class CodeLibrary {
  private entries: Map<string, CodeLibraryEntry> = new Map();

  save(entry: Omit<CodeLibraryEntry, 'id' | 'createdAt' | 'usageCount'>): string {
    const id = `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullEntry: CodeLibraryEntry = {
      ...entry,
      id,
      createdAt: Date.now(),
      usageCount: 0,
    };
    this.entries.set(id, fullEntry);
    log.info(`Saved code snippet: ${entry.name}`, { id });
    return id;
  }

  search(query: string): CodeLibraryEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values()).filter(
      (entry) =>
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getByType(type: string): CodeLibraryEntry[] {
    return Array.from(this.entries.values()).filter((entry) => entry.type === type);
  }

  get(id: string): CodeLibraryEntry | undefined {
    return this.entries.get(id);
  }

  recordUsage(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.usageCount++;
    }
  }

  list(): CodeLibraryEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Tool Implementation
// ─────────────────────────────────────────────────────────────

class AgentCodeTool {
  private reviewer = new CodeReviewGate();
  private library = new CodeLibrary();

  /**
   * Main tool for agents: write code
   */
  async writeCode(request: WriteCodeRequest, signal?: AbortSignal): Promise<WriteCodeResponse> {
    const startTime = Date.now();

    try {
      log.info(`Agent requesting code generation: ${request.name}`, {
        type: request.type,
        language: request.language,
      });

      // Generate code
      const code = await codeGenerator.generateCode(request, signal);

      // Validate
      let validation: ValidatorReport | undefined;
      if (request.autoValidate !== false) {
        validation = validateCode(code.code, code.language);
        if (!validation.valid && validation.errors.length > 0) {
          log.warn(`Code validation failed: ${request.name}`, {
            errorCount: validation.errors.length,
            summary: validation.summary,
          });
        }
      }

      // Review for security/best practices
      const review = this.reviewer.review(code.code, code.language, code.type);
      if (!review.approved) {
        log.warn(`Code review flagged issues: ${request.name}`, {
          issueCount: review.issues.length,
          highSeverityCount: review.issues.filter((i) => i.severity === 'high').length,
        });
      }

      // Save to library if requested
      const libraryId = this.library.save({
        name: request.name,
        type: request.type,
        language: request.language,
        code: code.code,
        description: request.description,
        tags: request.requirements,
      });

      return {
        success: validation?.valid ?? true,
        code,
        validation,
        testSuggestions: code.test_suggestions,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      log.error(`Code generation failed: ${request.name}`, {}, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get generated code from library
   */
  getFromLibrary(id: string): CodeLibraryEntry | undefined {
    return this.library.get(id);
  }

  /**
   * Search library for similar code
   */
  searchLibrary(query: string): CodeLibraryEntry[] {
    return this.library.search(query);
  }

  /**
   * Get code review for existing code
   */
  reviewCode(code: string, language: string, type: string = 'function'): ReviewResult {
    return this.reviewer.review(code, language, type);
  }

  /**
   * Validate code syntax
   */
  validateCode(code: string, language: string): ValidatorReport {
    return validateCode(code, language);
  }

  /**
   * Get library statistics
   */
  getLibraryStats() {
    const entries = this.library.list();
    return {
      totalEntries: entries.length,
      byType: Array.from(new Set(entries.map((e) => e.type))).reduce(
        (acc, type) => {
          acc[type] = entries.filter((e) => e.type === type).length;
          return acc;
        },
        {} as Record<string, number>
      ),
      byLanguage: Array.from(new Set(entries.map((e) => e.language))).reduce(
        (acc, lang) => {
          acc[lang] = entries.filter((e) => e.language === lang).length;
          return acc;
        },
        {} as Record<string, number>
      ),
      mostUsed: entries.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

export const agentCodeTool = new AgentCodeTool();

/**
 * Export tool interface for agent systems
 */
export const codeToolDefinition = {
  name: 'write_code',
  description:
    'Generate production code (functions, components, tests, services). Validates syntax, reviews for security, and stores in library.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['function', 'component', 'test', 'service', 'hook', 'util'],
        description: 'Type of code to generate',
      },
      name: {
        type: 'string',
        description: 'Name of the function/component/service',
      },
      description: {
        type: 'string',
        description: 'Detailed description of what the code should do',
      },
      language: {
        type: 'string',
        enum: ['typescript', 'javascript', 'python', 'sql'],
        description: 'Programming language',
      },
      requirements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific requirements the code must meet',
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'External dependencies the code will use',
      },
      context: {
        type: 'string',
        description: 'Project context or additional information',
      },
      style: {
        type: 'string',
        enum: ['minimal', 'robust', 'production'],
        description: 'Code style preference',
      },
      autoValidate: {
        type: 'boolean',
        description: 'Automatically validate syntax (default: true)',
      },
      autoFormat: {
        type: 'boolean',
        description: 'Automatically format code (default: true)',
      },
    },
    required: ['type', 'name', 'description', 'language', 'requirements'],
  },
};
