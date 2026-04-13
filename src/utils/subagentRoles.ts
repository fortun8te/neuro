/**
 * Subagent Role Definitions for Core Research System
 *
 * Defines all available subagent roles, their capabilities, and resource requirements.
 * Used by the vulnerability judge and research orchestration systems.
 */

import { createLogger } from './logger.js';

const log = createLogger('subagentRoles');

// ─────────────────────────────────────────────────────────────
// Role Definitions
// ─────────────────────────────────────────────────────────────

/**
 * Available subagent role types
 */
export type SubagentRole = 'critic' | 'researcher' | 'analyzer' | 'synthesizer';

/**
 * Model tier for inference quality vs speed tradeoff
 */
export type ModelTier = 'light' | 'standard' | 'quality' | 'maximum';

/**
 * Complete definition of a subagent role
 */
export interface RoleDefinition {
  /** Unique identifier for the role */
  role: SubagentRole;

  /** Human-readable description */
  description: string;

  /** Primary responsibility */
  responsibility: string;

  /** Default model tier for this role */
  modelTier: ModelTier;

  /** Maximum concurrent instances of this role */
  concurrency: number;

  /** Task timeout in milliseconds */
  timeout: number;

  /** Whether this role is currently available */
  isAvailable: boolean;

  /** System prompt guidance for this role */
  systemPrompt: string;

  /** Examples of this role's output (for few-shot context) */
  examples: RoleExample[];
}

/**
 * Example output from a role (for few-shot learning)
 */
export interface RoleExample {
  input: string;
  output: string;
}

// ─────────────────────────────────────────────────────────────
// Role Registry
// ─────────────────────────────────────────────────────────────

const ROLE_REGISTRY: Record<SubagentRole, RoleDefinition> = {
  critic: {
    role: 'critic',
    description: 'Research Quality Critic — Identifies gaps in research coverage',
    responsibility: 'Assess research quality on core topics, identify gaps, rate explanation weaknesses',
    modelTier: 'standard',
    concurrency: 2,
    timeout: 25000, // 25 seconds
    isAvailable: true,
    systemPrompt: `You are a research quality critic. Your SOLE job is to identify gaps in research related to the CORE TOPIC ONLY.

CRITICAL RULES:
1. Focus ONLY on gaps directly related to the original question
2. Do NOT suggest tangential research areas
3. Rate coverage on core topics (0-100%)
4. Identify explanation weaknesses (clarity, logic, evidence)
5. Output JSON with structure: {coverageByTopic, coreGaps, explanationWeaknesses}

DO NOT recommend research on:
- General background (unless core to question)
- Related but tangential topics
- "Nice to know" information

ONLY recommend research on:
- Direct answer to the question
- Core topic facets
- Critical evidence gaps`,
    examples: [
      {
        input: 'Question: "How to peel an apple?" Findings: "Using a knife is effective for peeling"',
        output: JSON.stringify({
          coverageByTopic: { peeling: 60, techniques: 30, tools: 25 },
          coreGaps: [
            { topic: 'techniques', importance: 'high', affectsDecision: true, suggestedQueries: ['peeling techniques'] },
          ],
          explanationWeaknesses: ['Lacks specific technique details', 'No safety precautions mentioned'],
        }),
      },
    ],
  },

  researcher: {
    role: 'researcher',
    description: 'Web Research Agent — Conducts targeted web searches and content extraction',
    responsibility: 'Execute web searches, extract relevant content, synthesize findings',
    modelTier: 'standard',
    concurrency: 5,
    timeout: 30000, // 30 seconds
    isAvailable: true,
    systemPrompt: `You are a research agent. Your job is to:
1. Execute targeted web searches based on provided queries
2. Extract relevant content from search results
3. Synthesize findings into structured data
4. Cite sources for all claims

Focus on:
- Relevance to the original question
- Credibility of sources
- Freshness of information (prefer recent data)
- Coverage of different perspectives`,
    examples: [
      {
        input: 'Query: "customer pain points SaaS 2026"',
        output: JSON.stringify({
          query: 'customer pain points SaaS 2026',
          results: [
            {
              source: 'https://example.com',
              title: 'SaaS Customer Pain Points Report',
              content: 'Key pain points include integration complexity, pricing opacity...',
            },
          ],
        }),
      },
    ],
  },

  analyzer: {
    role: 'analyzer',
    description: 'Data Analyzer — Analyzes competitor and market data',
    responsibility: 'Analyze market trends, competitor positioning, identify patterns and gaps',
    modelTier: 'quality',
    concurrency: 3,
    timeout: 35000, // 35 seconds
    isAvailable: true,
    systemPrompt: `You are a market analyst. Your job is to:
1. Identify market trends and patterns
2. Analyze competitor positioning and differentiation
3. Find white space opportunities
4. Provide data-driven insights

Structure your analysis as:
- Market trends (what's changing)
- Competitor landscape (who plays, positioning)
- White space (gaps in positioning)
- Implications (what this means)`,
    examples: [
      {
        input: 'Analyze competitors: CompanyA (cost leader), CompanyB (premium)',
        output: JSON.stringify({
          competitors: ['CompanyA', 'CompanyB'],
          trends: ['Market consolidating', 'Price pressure increasing'],
          whitespace: ['Mid-market focus', 'Customer success differentiation'],
        }),
      },
    ],
  },

  synthesizer: {
    role: 'synthesizer',
    description: 'Findings Synthesizer — Consolidates research into coherent narratives',
    responsibility: 'Synthesize multiple research findings into actionable insights',
    modelTier: 'quality',
    concurrency: 2,
    timeout: 40000, // 40 seconds
    isAvailable: true,
    systemPrompt: `You are a research synthesizer. Your job is to:
1. Consolidate findings from multiple sources
2. Identify contradictions and resolve them
3. Extract key insights
4. Structure findings for decision-making

Output structure:
- Key findings (most important)
- Supporting evidence
- Contradictions and resolution
- Confidence level
- Implications for decision`,
    examples: [
      {
        input: 'Findings from 3 sources about market size',
        output: JSON.stringify({
          keyFindings: ['Market estimated at $5-7B TAM'],
          evidence: ['Source A: $5B', 'Source B: $7B', 'Source C: $6B'],
          confidence: 0.85,
          implications: 'Market is sizable enough for investment',
        }),
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get a role definition by name
 */
export function getRoleDefinition(role: SubagentRole): RoleDefinition | null {
  const definition = ROLE_REGISTRY[role];
  if (!definition) {
    log.warn(`Unknown role: ${role}`);
    return null;
  }
  return definition;
}

/**
 * Get all available roles
 */
export function getAvailableRoles(): RoleDefinition[] {
  return Object.values(ROLE_REGISTRY).filter(r => r.isAvailable);
}

/**
 * Get role by responsibility/description
 */
export function getRoleByResponsibility(keyword: string): RoleDefinition | null {
  const normalized = keyword.toLowerCase();
  return (
    Object.values(ROLE_REGISTRY).find(
      r =>
        r.responsibility.toLowerCase().includes(normalized) ||
        r.description.toLowerCase().includes(normalized),
    ) || null
  );
}

/**
 * Validate a role exists and is available
 */
export function isValidRole(role: unknown): role is SubagentRole {
  if (typeof role !== 'string') return false;
  const definition = ROLE_REGISTRY[role as SubagentRole];
  return definition !== undefined && definition.isAvailable;
}

/**
 * Get system prompt for a role
 */
export function getSystemPrompt(role: SubagentRole): string {
  const definition = getRoleDefinition(role);
  return definition?.systemPrompt || '';
}

/**
 * Get recommended model tier for a role
 */
export function getModelTierForRole(role: SubagentRole): ModelTier {
  const definition = getRoleDefinition(role);
  return definition?.modelTier || 'standard';
}

/**
 * Get timeout for a role (milliseconds)
 */
export function getTimeoutForRole(role: SubagentRole): number {
  const definition = getRoleDefinition(role);
  return definition?.timeout || 30000;
}

/**
 * Get maximum concurrency for a role
 */
export function getConcurrencyForRole(role: SubagentRole): number {
  const definition = getRoleDefinition(role);
  return definition?.concurrency || 2;
}

export default {
  ROLE_REGISTRY,
  getRoleDefinition,
  getAvailableRoles,
  getRoleByResponsibility,
  isValidRole,
  getSystemPrompt,
  getModelTierForRole,
  getTimeoutForRole,
  getConcurrencyForRole,
};
