/**
 * Core type definitions for RACKS Phase 1 and analyzer modules
 */

// ─────────────────────────────────────────────────────────────
// Research Context Types
// ─────────────────────────────────────────────────────────────

export interface ResearchContext {
  originalQuestion: string;
  sessionId: string;
  findings: Record<string, any> | null;
  section: string;
  timeLimit: number;
  iterationLimit: number;
  startTime: number;
}

export interface ResearchFindings {
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────
// Subagent Message Types
// ─────────────────────────────────────────────────────────────

export interface SubagentMessage {
  type: 'request' | 'response' | 'error' | 'status';
  stage: string;
  content: any;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Analysis Result Types
// ─────────────────────────────────────────────────────────────

export interface BaseAnalysisResult {
  timestamp: number;
  sources: string[];
  confidenceScore?: number;
  dataPoints?: number;
}

export interface VulnerabilityReport {
  coreTopicCoverage: number;
  isCoreCovered: boolean;
  coreGaps: string[];
  coverage: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// Orchestration Types
// ─────────────────────────────────────────────────────────────

export interface OrchestrationDecision {
  continueResearch: boolean;
  reason: string;
  nextAction?: 'query' | 'expand' | 'deepen' | 'terminate';
  vulnerabilityReport?: VulnerabilityReport;
}

export interface ResearchCycle {
  cycleNumber: number;
  findings: Record<string, any>;
  vulnerabilityReport?: VulnerabilityReport;
  decision?: OrchestrationDecision;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  modelId: string;
  maxTokens: number;
  temperature: number;
  tier: 'light' | 'standard' | 'quality' | 'maximum';
}

export interface ResearchConfig {
  depth: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX';
  modelTier: ModelConfig['tier'];
  timeout: number;
  maxIterations: number;
}
