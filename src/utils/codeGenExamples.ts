/**
 * Code Generation Examples
 * ========================
 * Example workflows demonstrating how agents can generate code.
 * Use these as templates for your own code generation tasks.
 */

import { agentCodeTool } from './agentCodeTool';
import { codeExecutor } from './codeExecutor';
import {
  generateComponentFromDesign,
  generateTestSuite,
  generateAnalyzerFromResearch,
} from './agentCodeIntegration';

/**
 * Example 1: Agent generates a utility function
 *
 * Scenario: Agent researches market trends and needs a function to
 * analyze competitor pricing data.
 */
export async function exampleGenerateAnalyzer() {
  console.log('Example 1: Generate Market Analyzer Function');

  const response = await agentCodeTool.writeCode({
    type: 'function',
    name: 'analyzeCompetitorPricing',
    description:
      'Analyzes competitor pricing data to identify pricing gaps and opportunities. Takes an array of competitor data with name, price, and features.',
    language: 'typescript',
    requirements: [
      'Calculate average price point',
      'Identify pricing outliers',
      'Group by feature tier',
      'Return pricing recommendations',
      'Handle edge cases (missing prices, duplicate competitors)',
    ],
    dependencies: ['lodash', 'decimal.js'],
    style: 'production',
  });

  console.log('Generated successfully:', response.success);
  console.log('Code lines:', response.code?.code.split('\n').length);
  console.log('Test suggestions:', response.code?.test_suggestions);

  return response;
}

/**
 * Example 2: Agent generates a React component
 *
 * Scenario: Design team provides spec, agent generates component code.
 */
export async function exampleGenerateComponent() {
  console.log('Example 2: Generate React Component');

  const designSpec = `
    ProductCard Component:
    - Display product name, price, rating
    - Show product image (responsive)
    - "Add to Cart" button (with loading state)
    - Star rating (1-5 stars)
    - Color-coded badge for stock status (In Stock, Low Stock, Out of Stock)
    - Support dark mode via Tailwind
  `;

  const response = await generateComponentFromDesign('ProductCard', designSpec);

  console.log('Generated component:', response.success);
  if (response.code) {
    console.log('Component structure:', {
      exports: response.code.exports,
      imports: response.code.imports,
      complexity: response.code.estimatedComplexity,
    });
  }

  return response;
}

/**
 * Example 3: Agent generates tests for existing code
 *
 * Scenario: Legacy function needs test coverage before refactoring.
 */
export async function exampleGenerateTests() {
  console.log('Example 3: Generate Test Suite');

  const existingFunction = `
export function calculateDiscount(basePrice: number, discountPercent: number): number {
  if (basePrice <= 0) throw new Error('Base price must be positive');
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0-100');
  }
  return basePrice * (1 - discountPercent / 100);
}`;

  const response = await generateTestSuite(existingFunction, 'calculateDiscount');

  console.log('Generated test suite:', response.success);
  if (response.code) {
    console.log('Test file structure:', {
      lines: response.code.code.split('\n').length,
      suggestions: response.code.test_suggestions,
    });
  }

  return response;
}

/**
 * Example 4: Agent generates service layer
 *
 * Scenario: New API endpoint needs a service to handle business logic.
 */
export async function exampleGenerateService() {
  console.log('Example 4: Generate Service Layer');

  const response = await agentCodeTool.writeCode({
    type: 'service',
    name: 'UserPreferencesService',
    description:
      'Service to manage user preferences including theme, language, and notification settings. Integrates with auth system and preferences API.',
    language: 'typescript',
    requirements: [
      'Load user preferences from API',
      'Cache preferences for 5 minutes',
      'Handle preference updates',
      'Validate preference values',
      'Sync across browser tabs',
      'Handle offline scenarios',
    ],
    dependencies: ['@tanstack/react-query', 'zustand', 'axios'],
    context: `
Project uses:
- React 18+
- TanStack Query for server state
- Zustand for client state
- Axios for HTTP
- IndexedDB for local storage
    `,
    style: 'production',
  });

  console.log('Generated service:', response.success);
  if (response.code) {
    console.log('Service details:', {
      exports: response.code.exports,
      dependencies: response.code.dependencies,
    });
  }

  return response;
}

/**
 * Example 5: Agent generates custom hook
 *
 * Scenario: Complex state management needed for feature, agent generates hook.
 */
export async function exampleGenerateHook() {
  console.log('Example 5: Generate Custom React Hook');

  const response = await agentCodeTool.writeCode({
    type: 'hook',
    name: 'useFormValidation',
    description:
      'Custom hook for form validation with support for async validators, field-level validation, and form-level validation. Returns validation state and helper functions.',
    language: 'typescript',
    requirements: [
      'Validate individual fields',
      'Validate entire form',
      'Support async validators',
      'Track which fields have been touched',
      'Return validation errors per field',
      'Reset validation state',
      'Support custom validation rules',
    ],
    dependencies: ['react', 'zod'],
    context: 'Used in form components throughout the application',
    style: 'production',
  });

  console.log('Generated hook:', response.success);
  if (response.code) {
    console.log('Hook exports:', response.code.exports);
  }

  return response;
}

/**
 * Example 6: Agent generates and tests code end-to-end
 *
 * Scenario: Simple utility function is generated and immediately tested.
 */
export async function exampleGenerateAndTest() {
  console.log('Example 6: Generate and Test');

  // Generate a simple utility function
  const codeResponse = await agentCodeTool.writeCode({
    type: 'function',
    name: 'calculateAgeFromBirthDate',
    description: 'Calculates age in years from a birth date string (YYYY-MM-DD)',
    language: 'javascript',
    requirements: [
      'Accept date string in YYYY-MM-DD format',
      'Return age as integer',
      'Handle invalid dates',
      'Throw error for future dates',
    ],
    style: 'robust',
  });

  console.log('Code generated:', codeResponse.success);

  if (codeResponse.code) {
    // Execute the generated code with test cases
    const executionResult = await codeExecutor.execute({
      code: codeResponse.code.code,
      language: 'javascript',
      timeout: 5000,
      testCases: [
        { input: '2000-01-01', expectedOutput: 24 },
        { input: '1990-06-15', expectedOutput: 33 },
      ],
    });

    console.log('Execution result:', {
      success: executionResult.success,
      output: executionResult.output,
      tests: executionResult.testResults?.passed,
      stdout: executionResult.stdout,
    });
  }

  return codeResponse;
}

/**
 * Example 7: Agent generates utility to process research data
 *
 * Scenario: After research phase, agent generates code to process findings.
 */
export async function exampleGenerateResearchProcessor() {
  console.log('Example 7: Generate Research Data Processor');

  const mockResearchFindings = {
    urlVisited: ['url1', 'url2', 'url3'],
    keyFindings: ['finding1', 'finding2'],
    competitorPositioning: [
      { name: 'competitor1', position: 'premium' },
      { name: 'competitor2', position: 'budget' },
    ],
    visualFindings: {
      commonPatterns: ['pattern1', 'pattern2'],
    },
  };

  const response = await generateAnalyzerFromResearch(
    mockResearchFindings as any,
    'MarketTrends'
  );

  console.log('Generated analyzer:', response.success);
  if (response.code) {
    console.log('Analyzer function:', response.code.exports);
  }

  return response;
}

/**
 * Example 8: Agent generates security-sensitive code
 *
 * Scenario: Agent generates authentication-related code that goes through review.
 */
export async function exampleGenerateSecureCode() {
  console.log('Example 8: Generate Secure Code (with review)');

  const response = await agentCodeTool.writeCode({
    type: 'function',
    name: 'validatePasswordStrength',
    description: 'Validates password strength according to security standards',
    language: 'typescript',
    requirements: [
      'Minimum 12 characters',
      'Require uppercase, lowercase, number, special char',
      'Check against common passwords',
      'Return detailed feedback',
    ],
    style: 'production',
  });

  console.log('Generated security function:', response.success);

  // Check review results
  if (response.code) {
    const review = agentCodeTool.reviewCode(response.code.code, 'typescript', 'function');
    console.log('Security review:', {
      approved: review.approved,
      issues: review.issues.length,
      recommendations: review.recommendations.length,
    });
  }

  return response;
}

/**
 * Example 9: Agent searches and reuses code from library
 *
 * Scenario: Agent generates code, then searches library for similar patterns.
 */
export async function exampleLibrarySearch() {
  console.log('Example 9: Library Search and Reuse');

  // First generate some code
  const response = await agentCodeTool.writeCode({
    type: 'function',
    name: 'memoizeFunction',
    description: 'Creates a memoized version of a function',
    language: 'typescript',
    requirements: ['Cache results', 'Handle multiple arguments', 'Clear cache method'],
    style: 'production',
  });

  if (response.code) {
    // Search library for similar patterns
    const similar = agentCodeTool.searchLibrary('memoize');
    console.log(`Found ${similar.length} similar code snippets in library`);

    const stats = agentCodeTool.getLibraryStats();
    console.log('Library stats:', stats);
  }

  return response;
}

// ─────────────────────────────────────────────────────────────
// Run all examples
// ─────────────────────────────────────────────────────────────

export async function runAllExamples() {
  const examples = [
    exampleGenerateAnalyzer,
    exampleGenerateComponent,
    exampleGenerateTests,
    exampleGenerateService,
    exampleGenerateHook,
    exampleGenerateAndTest,
    exampleGenerateResearchProcessor,
    exampleGenerateSecureCode,
    exampleLibrarySearch,
  ];

  for (const example of examples) {
    try {
      await example();
      console.log('---\n');
    } catch (error) {
      console.error(`Example failed: ${example.name}`, error);
    }
  }
}
