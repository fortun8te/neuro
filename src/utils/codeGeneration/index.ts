/**
 * Code Generation Module Exports
 * ==============================
 * Central export point for all code generation utilities.
 */

export { codeGenerator, type CodeGenerationRequest, type GeneratedCode } from '../codeGenerator';
export { syntaxValidator, type ValidatorReport, type ValidationError } from '../syntaxValidator';
export {
  agentCodeTool,
  type WriteCodeRequest,
  type WriteCodeResponse,
  type TestCodeRequest,
  type TestCodeResponse,
  codeToolDefinition,
} from '../agentCodeTool';
export { codeExecutor, type ExecutionRequest, type ExecutionResult } from '../codeExecutor';
export {
  generateCodeFromResearch,
  generateComponentFromDesign,
  generateTestSuite,
  generateAnalyzerFromResearch,
  codeHookManager,
  codeVersionManager,
  type CodeGenerationWorkflow,
  type CodeVersionManager as ICodeVersionManager,
} from '../agentCodeIntegration';
export {
  exampleGenerateAnalyzer,
  exampleGenerateComponent,
  exampleGenerateTests,
  exampleGenerateService,
  exampleGenerateHook,
  exampleGenerateAndTest,
  exampleGenerateResearchProcessor,
  exampleGenerateSecureCode,
  exampleLibrarySearch,
  runAllExamples,
} from '../codeGenExamples';
