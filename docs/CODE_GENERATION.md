# Agentic Code Generation System

Complete guide for agents to generate, validate, test, and manage code during execution.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Security & Review](#security--review)

## Quick Start

### Basic Code Generation

```typescript
import { agentCodeTool } from '@/utils/agentCodeTool';

const response = await agentCodeTool.writeCode({
  type: 'function',
  name: 'analyzeData',
  description: 'Analyzes market research data and returns insights',
  language: 'typescript',
  requirements: [
    'Process array of data points',
    'Calculate statistics',
    'Identify trends',
  ],
});

console.log(response.code?.code); // Generated code
console.log(response.code?.syntax_valid); // Validation result
```

### Code with Tests

```typescript
const response = await agentCodeTool.writeCode({
  type: 'function',
  name: 'calculatePrice',
  description: 'Calculates final price with tax and discount',
  language: 'typescript',
  requirements: [
    'Apply discount first',
    'Calculate tax on discounted amount',
    'Handle invalid inputs',
  ],
  autoValidate: true,
  autoFormat: true,
});

// Generated code includes test suggestions
console.log(response.code?.test_suggestions);
```

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│           Agent System                              │
│  (requests code generation)                         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│        AgentCodeTool (Main Interface)               │
│  - writeCode() - Main entry point                   │
│  - reviewCode() - Security review                   │
│  - validateCode() - Syntax validation               │
│  - getLibraryStats() - Reusable code tracking       │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────────┐  ┌──────────────────────┐
│ CodeGenerator    │  │ CodeReviewGate       │
│ - Generate code  │  │ - Security checks    │
│ - Validate       │  │ - Best practices     │
│ - Format         │  │ - Complexity review  │
└──────────────────┘  └──────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────────┐  ┌──────────────────────┐
│ Ollama LLM       │  │ CodeLibrary          │
│ (qwen3.5:4b/9b) │  │ - Store snippets     │
│ Generates code   │  │ - Search patterns    │
│ from prompts     │  │ - Track usage        │
└──────────────────┘  └──────────────────────┘

┌─────────────────────────────────────────────────────┐
│ SyntaxValidator (Multi-Language)                    │
│ - TypeScript/JavaScript validation                  │
│ - Python validation                                 │
│ - SQL validation                                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ CodeExecutor (Sandbox)                              │
│ - Execute generated JS/TS code                      │
│ - Run tests                                         │
│ - Capture output/errors                             │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Agent requests: writeCode(spec)
   ↓
2. CodeGenerator: Build LLM prompt from spec
   ↓
3. Ollama: Generate code (qwen3.5:4b/9b)
   ↓
4. SyntaxValidator: Validate syntax
   ↓
5. CodeReviewGate: Security & best practices review
   ↓
6. CodeLibrary: Save for reuse
   ↓
7. CodeExecutor: Test (optional)
   ↓
8. Return: GeneratedCode + validation + review results
```

## Core Components

### 1. CodeGenerator

Generates code from specifications using LLM.

**Features:**
- Multi-language support (TypeScript, Python, SQL)
- Automatic retry on syntax errors
- Code formatting
- Import/export detection
- Complexity estimation
- Test suggestions

**Models Used:**
- `qwen3.5:4b` - Standard code (functions, services, hooks)
- `qwen3.5:9b` - Complex code (escalated automatically)

**File:** `src/utils/codeGenerator.ts`

```typescript
class CodeGenerator {
  async generateCode(request: CodeGenerationRequest): Promise<GeneratedCode>
  async validateSyntax(code: string, language: string): Promise<SyntaxValidationResult>
  async formatCode(code: string, language: string): Promise<string>
}
```

### 2. SyntaxValidator

Validates code syntax for TypeScript, Python, and SQL.

**Features:**
- Bracket/parenthesis/quote matching
- Python indentation checking
- SQL keyword validation
- Detailed error reporting
- Warning detection

**File:** `src/utils/syntaxValidator.ts`

```typescript
function validateCode(code: string, language: string): ValidatorReport

interface ValidatorReport {
  valid: boolean
  totalLines: number
  errors: ValidationError[]
  warnings: ValidationError[]
  summary: string
}
```

### 3. CodeReviewGate

Reviews generated code for security, performance, and best practices.

**Checks:**
- Security issues (eval, innerHTML, pickle, etc.)
- Database operations (require manual review)
- File system access
- Network operations
- Code complexity
- Nesting levels

**File:** `src/utils/agentCodeTool.ts` (part of AgentCodeTool)

```typescript
class CodeReviewGate {
  review(code: string, language: string, type: string): ReviewResult
}

interface ReviewResult {
  approved: boolean
  issues: ReviewIssue[]
  recommendations: string[]
}
```

### 4. CodeLibrary

Stores and retrieves generated code snippets for reuse.

**Features:**
- Save generated code with metadata
- Search by name, description, tags
- Track usage count
- Organize by type/language

**File:** `src/utils/agentCodeTool.ts` (part of AgentCodeTool)

```typescript
class CodeLibrary {
  save(entry: CodeLibraryEntry): string
  search(query: string): CodeLibraryEntry[]
  getByType(type: string): CodeLibraryEntry[]
  get(id: string): CodeLibraryEntry | undefined
  recordUsage(id: string): void
  list(): CodeLibraryEntry[]
}
```

### 5. CodeExecutor

Executes generated code in a sandboxed environment.

**Features:**
- Safe JavaScript/TypeScript execution
- Timeout protection
- Isolated scope (no filesystem/network access)
- Test case support
- Output/error capture

**File:** `src/utils/codeExecutor.ts`

```typescript
class CodeExecutor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult>
}

interface ExecutionRequest {
  code: string
  language: 'typescript' | 'javascript' | 'python'
  timeout?: number
  globals?: Record<string, any>
  testCases?: TestCase[]
}
```

## Usage Examples

### Example 1: Generate Analysis Function

```typescript
import { agentCodeTool } from '@/utils/agentCodeTool';

async function generateMarketAnalyzer() {
  const response = await agentCodeTool.writeCode({
    type: 'function',
    name: 'analyzeCompetitorPricing',
    description: `
      Analyzes competitor pricing data to identify:
      - Pricing gaps vs market average
      - Premium vs budget positioning
      - Pricing optimization opportunities
    `,
    language: 'typescript',
    requirements: [
      'Accept array of competitors with { name, price, features[] }',
      'Calculate percentile pricing',
      'Group by feature tier',
      'Identify outliers',
      'Return actionable recommendations',
    ],
    dependencies: ['lodash', 'decimal.js'],
    style: 'production',
  });

  if (response.success) {
    console.log('Function generated:', response.code?.name);
    console.log('Complexity:', response.code?.estimatedComplexity);
    console.log('Tests needed:', response.code?.test_suggestions);
  }
}
```

### Example 2: Generate React Component

```typescript
import { generateComponentFromDesign } from '@/utils/agentCodeIntegration';

async function generateProductCard() {
  const designSpec = `
    Component: ProductCard
    - Image (lazy-loaded, responsive)
    - Title and description
    - Price (with discount badge)
    - Star rating (1-5)
    - Add to Cart button (with loading state)
    - Wishlist toggle
    - Dark mode support
  `;

  const response = await generateComponentFromDesign('ProductCard', designSpec);

  if (response.success) {
    console.log('Component code:');
    console.log(response.code?.code);
  }
}
```

### Example 3: Generate and Test

```typescript
import { agentCodeTool } from '@/utils/agentCodeTool';
import { codeExecutor } from '@/utils/codeExecutor';

async function generateAndTest() {
  // Generate code
  const codeResponse = await agentCodeTool.writeCode({
    type: 'function',
    name: 'calculateTax',
    description: 'Calculates sales tax on subtotal',
    language: 'javascript',
    requirements: ['Apply tax rate', 'Return tax amount', 'Handle edge cases'],
    style: 'robust',
  });

  // Execute with test cases
  if (codeResponse.code) {
    const execResult = await codeExecutor.execute({
      code: codeResponse.code.code,
      language: 'javascript',
      timeout: 5000,
      testCases: [
        { input: 100, expectedOutput: 10 }, // 10% tax
        { input: 0, expectedOutput: 0 },
      ],
    });

    console.log('Tests passed:', execResult.testResults?.passed);
  }
}
```

### Example 4: Research-Based Code Generation

```typescript
import { generateCodeFromResearch } from '@/utils/agentCodeIntegration';

async function generateAnalyzerFromResearch(researchFindings) {
  const response = await generateCodeFromResearch(
    researchFindings,
    {
      type: 'function',
      name: 'extractMarketInsights',
      description: `
        Processes research findings to extract:
        - Market size estimates
        - Growth trends
        - Customer pain points
        - Competitive positioning
      `,
      language: 'typescript',
      requirements: [
        'Parse research data structure',
        'Extract key metrics',
        'Calculate trends',
        'Return structured insights',
      ],
      style: 'production',
    }
  );

  return response;
}
```

### Example 5: Code Review and Search

```typescript
async function reviewAndSearchCode() {
  // Get code from library
  const similar = agentCodeTool.searchLibrary('data analyzer');
  console.log(`Found ${similar.length} similar snippets`);

  // Review code for issues
  const review = agentCodeTool.reviewCode(
    generatedCode,
    'typescript',
    'function'
  );

  if (!review.approved) {
    console.log('Issues found:');
    review.issues.forEach((issue) => {
      console.log(`- [${issue.severity}] ${issue.message}`);
      if (issue.suggestion) {
        console.log(`  Suggestion: ${issue.suggestion}`);
      }
    });
  }

  // Get library stats
  const stats = agentCodeTool.getLibraryStats();
  console.log('Library stats:', stats);
}
```

## API Reference

### AgentCodeTool.writeCode()

Main interface for code generation.

```typescript
interface WriteCodeRequest extends CodeGenerationRequest {
  type: 'function' | 'component' | 'test' | 'service' | 'hook' | 'util'
  name: string
  description: string
  language: 'typescript' | 'javascript' | 'python' | 'sql'
  requirements: string[]
  dependencies?: string[]
  context?: string
  style?: 'minimal' | 'robust' | 'production'
  autoValidate?: boolean
  autoFormat?: boolean
}

interface WriteCodeResponse {
  success: boolean
  code?: GeneratedCode
  validation?: ValidatorReport
  testSuggestions?: string[]
  error?: string
  executionTimeMs?: number
}

interface GeneratedCode {
  code: string
  language: string
  type: string
  name: string
  syntax_valid: boolean
  imports: string[]
  exports: string[]
  test_suggestions: string[]
  dependencies: string[]
  formatted: boolean
  estimatedComplexity: 'simple' | 'moderate' | 'complex'
  tokensUsed?: number
  generationTimeMs?: number
}
```

### AgentCodeTool.reviewCode()

Review code for security and best practices.

```typescript
function reviewCode(
  code: string,
  language: string,
  type: string
): ReviewResult

interface ReviewResult {
  approved: boolean
  issues: ReviewIssue[]
  recommendations: string[]
}

interface ReviewIssue {
  severity: 'high' | 'medium' | 'low'
  category: string
  message: string
  suggestion?: string
}
```

### AgentCodeTool.validateCode()

Validate code syntax without executing.

```typescript
function validateCode(
  code: string,
  language: string
): ValidatorReport

interface ValidatorReport {
  valid: boolean
  totalLines: number
  errors: ValidationError[]
  warnings: ValidationError[]
  summary: string
}

interface ValidationError {
  line?: number
  column?: number
  message: string
  code?: string
  severity: 'error' | 'warning'
}
```

### CodeExecutor.execute()

Execute generated code in sandbox.

```typescript
interface ExecutionRequest {
  code: string
  language: 'typescript' | 'javascript' | 'python'
  timeout?: number
  globals?: Record<string, any>
  testCases?: { input: any; expectedOutput: any }[]
}

interface ExecutionResult {
  success: boolean
  output?: any
  stdout?: string
  stderr?: string
  executionTimeMs: number
  error?: string
  testResults?: {
    passed: number
    failed: number
    results: TestResult[]
  }
}
```

## Best Practices

### 1. Be Specific in Requirements

```typescript
// Good: Clear, specific requirements
requirements: [
  'Accept array of { id, price, currency }',
  'Convert all prices to USD',
  'Calculate sum and average',
  'Handle missing/invalid prices gracefully',
  'Return { sum, average, count, errors }',
]

// Avoid: Vague requirements
requirements: ['Calculate prices']
```

### 2. Provide Project Context

```typescript
const response = await agentCodeTool.writeCode({
  type: 'function',
  name: 'fetchUserData',
  language: 'typescript',
  // ... other fields ...
  context: `
    Project uses:
    - React 18 with hooks
    - TanStack Query for data fetching
    - Zod for validation
    - Tailwind CSS

    Our API uses JWT tokens in Authorization header.
    All errors should be logged to Sentry.
  `,
  style: 'production',
});
```

### 3. Choose Appropriate Code Style

```typescript
// For quick prototypes
style: 'minimal'  // Concise, minimal error handling

// For most cases
style: 'robust'   // Good error handling, comments, validation

// For production/security-critical
style: 'production'  // Comprehensive: logging, validation, security checks
```

### 4. Enable Validation for Critical Code

```typescript
// For security-sensitive code
const response = await agentCodeTool.writeCode({
  type: 'function',
  name: 'validatePayment',
  // ...
  autoValidate: true,  // Always validate syntax
  autoFormat: true,    // Ensure consistent formatting
});

// Check review results
if (response.code) {
  const review = agentCodeTool.reviewCode(
    response.code.code,
    'typescript',
    'function'
  );
  console.log('Security review:', review);
}
```

### 5. Test Generated Code

```typescript
// Generate function
const codeResp = await agentCodeTool.writeCode({
  type: 'function',
  name: 'calculateDiscount',
  language: 'typescript',
  requirements: [
    'Apply discount percentage',
    'Return rounded amount',
    'Handle edge cases',
  ],
});

// Test it
if (codeResp.code) {
  const testResult = await codeExecutor.execute({
    code: codeResp.code.code,
    language: 'typescript',
    timeout: 5000,
    testCases: [
      { input: { price: 100, discount: 10 }, expectedOutput: 90 },
      { input: { price: 0, discount: 10 }, expectedOutput: 0 },
    ],
  });
}
```

### 6. Reuse from Library

```typescript
// Search for similar code first
const similar = agentCodeTool.searchLibrary('calculate discount');
if (similar.length > 0) {
  console.log('Found existing implementation:', similar[0].code);
  // Consider reusing instead of regenerating
}

// If generating new code
const response = await agentCodeTool.writeCode({
  /* ... */
});
// Code is automatically saved to library
```

## Security & Review

### Security Checks

Code is automatically reviewed for:

#### High Severity Issues (blocks approval)
- `eval()` / `exec()` usage
- Direct `innerHTML` assignment (XSS risk)
- `pickle.load()` (code execution risk)
- Database mutations without parameterization

#### Medium Severity Issues (warns)
- File system access without validation
- Network operations without error handling
- Shell commands without proper escaping
- Dangerous crypto operations

#### Low Severity Issues (recommends)
- Missing error handling
- High complexity
- Code length
- Performance concerns

### Review Gate Workflow

```
Generated Code
    ↓
Security Review (CodeReviewGate)
    ↓
    ├─→ High severity issues? → Block approval, return issues
    │
    └─→ No high severity? → Approve with warnings/recommendations
    ↓
Return: {
  approved: boolean
  issues: ReviewIssue[]
  recommendations: string[]
}
```

### Database Operations

Code accessing databases requires manual review:

```typescript
// This code will flag for review
const code = `
  UPDATE users SET email = ? WHERE id = ?
`;

const review = agentCodeTool.reviewCode(code, 'sql', 'service');
// Result: { approved: false, issues: [{ severity: 'high', ... }] }
```

## Integration with Agent System

### As Agent Tool

```typescript
// In agent system, define tool:
const codeGenTool = {
  name: 'write_code',
  description: 'Generate and validate code during execution',
  handler: async (request: WriteCodeRequest) => {
    return await agentCodeTool.writeCode(request);
  },
};

// Agent can then use:
await agent.tools.write_code({
  type: 'function',
  name: 'myFunction',
  // ...
});
```

### In Research Cycle

```typescript
// During research, generate analyzers
const researchFindings = await orchestrateResearch(/* ... */);

const analyzer = await generateAnalyzerFromResearch(
  researchFindings,
  'MarketTrends'
);

// Use generated code in downstream stages
const insights = await executeGeneratedCode(
  analyzer.code.code,
  researchFindings
);
```

### Version Control

```typescript
import { codeVersionManager } from '@/utils/agentCodeIntegration';

// Save snapshot after generating
const snapshot = codeVersionManager.snapshot(
  generatedCode,
  'typescript',
  cycle,
  { stage: 'research', description: 'Market analyzer' }
);

// Track changes across cycles
const history = codeVersionManager.getHistory(snapshot.codeId);
const diff = codeVersionManager.diff(codeId, 1, 2);
```

## Troubleshooting

### Syntax Validation Fails

```typescript
// Check validation errors
if (!response.code?.syntax_valid) {
  console.log('Errors:', response.code?.syntax_errors);
  // Generator will auto-retry (max 3 attempts)
}
```

### Code Review Issues

```typescript
// Review code separately
const review = agentCodeTool.reviewCode(code, 'typescript', 'function');

if (!review.approved) {
  review.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.message}`);
    if (issue.suggestion) console.log(issue.suggestion);
  });
}
```

### Execution Fails

```typescript
// Check execution result
if (!execResult.success) {
  console.log('Error:', execResult.error);
  console.log('Stderr:', execResult.stderr);
  console.log('Stdout:', execResult.stdout);
}
```

## Performance Characteristics

| Operation | Typical Time | Notes |
|-----------|-------------|-------|
| Generate simple function | 3-8s | qwen3.5:4b |
| Generate complex service | 10-15s | qwen3.5:9b (auto-escalated) |
| Validate syntax | <100ms | All languages |
| Execute code | <500ms | JS/TS in sandbox |
| Search library | <10ms | Indexed search |
| Code review | 200-500ms | Security scanning |

## Future Enhancements

1. **Python Execution** - Add Python sandbox execution
2. **SQL Execution** - Add SQL query validation/execution
3. **AI Code Review** - Use LLM for deeper code review
4. **Distributed Generation** - Parallel code generation
5. **Language Support** - Add Go, Rust, Java
6. **Test Generation** - Auto-generate comprehensive tests
7. **Documentation Generation** - Auto-generate JSDoc/docstrings
8. **Performance Profiling** - Profile generated code performance
