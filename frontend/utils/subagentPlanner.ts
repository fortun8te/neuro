/**
 * Intelligent Subagent Planner
 *
 * Analyzes task complexity and user directives to decide:
 * - How many subagents to spawn
 * - What roles/tasks they should have
 * - Whether to spawn any at all
 */

/**
 * Result of subagent planning
 */
export interface SubagentPlan {
  count: number;
  roles: string[];
  reason: string; // Why this many?
}

/**
 * Parse explicit "sub for X, sub for Y" directives from user message
 */
function parseExplicitSubDirectives(message: string): string[] {
  const matches = message.match(/sub\s+(?:for\s+)?([^,.\n]+)/gi) || [];
  return matches.map((m) => m.replace(/^sub\s+(?:for\s+)?/i, '').trim()).filter(Boolean);
}

/**
 * Analyze message complexity based on:
 * - Word count
 * - Keywords indicating research/analysis
 * - Message intent
 */
function analyzeComplexity(message: string): 'trivial' | 'simple' | 'medium' | 'complex' {
  const wordCount = message.split(/\s+/).filter((w) => w.length > 0).length;
  const lowerMsg = message.toLowerCase();

  // Check for research/analysis keywords
  const complexKeywords = /\b(research|analyze|compare|evaluate|validate|verify|investigate|explore|survey|examine|assess|review|audit|test|benchmark|profile)\b/i;
  const hasComplexKeywords = complexKeywords.test(lowerMsg);

  // Trivial: very short, simple questions
  if (wordCount < 10 && !hasComplexKeywords) return 'trivial';

  // Simple: short but potentially actionable
  if (wordCount < 30) return 'simple';

  // Medium: moderate length with some complexity
  if (wordCount < 80) {
    if (hasComplexKeywords) return 'complex';
    return 'medium';
  }

  // Complex: longer or explicitly complex keywords
  if (hasComplexKeywords) return 'complex';
  return 'medium';
}

/**
 * Detect if message needs deep reasoning (nemotron) roles
 */
function needsDeepRoles(message: string): { security: boolean; architecture: boolean; codeAnalysis: boolean } {
  const m = message.toLowerCase();
  return {
    security: /\b(security.?audit|vulnerabilit|attack.?surface|cve|owasp|penetration.?test|threat.?model|security.?review|exploit|injection|xss|csrf)\b/.test(m),
    architecture: /\b(architecture.?(review|analysis|reasoning)|system.?design|design.?pattern|dependency.?(graph|analysis)|technical.?debt|module.?structure)\b/.test(m),
    codeAnalysis: /\b(deep.?dive.?code|codebase.?analysis|code.?review|refactor.?(plan|strategy)|performance.?audit)\b/.test(m),
  };
}

/**
 * Map complexity level to subagent roles
 */
function complexityToRoles(complexity: 'trivial' | 'simple' | 'medium' | 'complex', message = ''): string[] {
  const deep = needsDeepRoles(message);

  // Deep reasoning tasks — nemotron subagents
  if (deep.security) return ['security-analyst', 'researcher'];
  if (deep.architecture) return ['architect', 'analyzer'];
  if (deep.codeAnalysis) return ['deep-analyzer', 'researcher'];

  switch (complexity) {
    case 'trivial':
      return [];
    case 'simple':
      return ['researcher'];
    case 'medium':
      return ['researcher', 'analyzer'];
    case 'complex':
      return ['researcher', 'analyzer', 'validator'];
  }
}

/**
 * Plan subagent spawning based on task analysis
 */
export async function planSubagents(
  userMessage: string,
  _context?: string // Available for future use
): Promise<SubagentPlan> {
  // 1. Parse explicit "sub for X, sub for Y" directives
  const explicitSubs = parseExplicitSubDirectives(userMessage);
  if (explicitSubs.length > 0) {
    return {
      count: explicitSubs.length,
      roles: explicitSubs,
      reason: `User explicitly requested ${explicitSubs.length} subagent(s): ${explicitSubs.join(', ')}`,
    };
  }

  // 2. Analyze task complexity
  const complexity = analyzeComplexity(userMessage);

  // 3. Decide spawn count based on complexity
  const roles = complexityToRoles(complexity, userMessage);
  const deep = needsDeepRoles(userMessage);
  const deepReason = deep.security
    ? 'Security audit detected — deploying security-analyst (nemotron 120B) + researcher'
    : deep.architecture
    ? 'Architecture analysis detected — deploying architect (nemotron 120B) + analyzer'
    : deep.codeAnalysis
    ? 'Code deep dive detected — deploying deep-analyzer (nemotron 120B) + researcher'
    : null;

  const reasons: Record<string, string> = {
    trivial: 'Task is trivial; no subagents needed',
    simple: 'Task is simple; one researcher subagent sufficient',
    medium: 'Task is moderately complex; researcher + analyzer subagents',
    complex: 'Task is complex; deploying researcher, analyzer, and validator subagents',
  };
  if (deepReason) {
    return { count: roles.length, roles, reason: deepReason };
  }

  return {
    count: roles.length,
    roles,
    reason: reasons[complexity] || 'Subagents planned based on task analysis',
  };
}

/**
 * Check if a message is a trivial greeting or command that needs no subagents
 */
export function isTrivialRequest(message: string): boolean {
  const lowerMsg = message.trim().toLowerCase();
  const greetings = /^(hi|hey|hello|thanks|thankyou|ok|okay|sure|yes|no|what|when|where|who|how|why)[\s!?]*$/;
  return greetings.test(lowerMsg);
}
