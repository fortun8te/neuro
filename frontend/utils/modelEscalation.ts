/**
 * Model Escalation Detection
 * Analyzes task complexity and recommends higher-tier models when needed
 */

export interface EscalationSignal {
  signal: string;
  weight: number;
  description: string;
}

export interface EscalationRecommendation {
  shouldEscalate: boolean;
  currentModel: string;
  recommendedModel: string;
  escalationLevel: 'none' | 'minor' | 'moderate' | 'critical';
  signals: EscalationSignal[];
  confidenceScore: number; // 0-1
}

// Complexity signals and their weights
const COMPLEXITY_SIGNALS = {
  codeDetected: { weight: 0.15, pattern: /```|function|const |class |import|export|\{.*\}/ },
  multiStep: { weight: 0.12, pattern: /step|phase|first|second|then|after|meanwhile|along with/ },
  technicalTerms: { weight: 0.10, pattern: /algorithm|architecture|optimization|performance|latency|throughput|recursion/ },
  math: { weight: 0.08, pattern: /\d+\.\d+|formula|calculate|equation|sum|average|probability|statistics/ },
  reasoning: { weight: 0.10, pattern: /why|because|reason|explain|analyze|compare|contrast|evaluate/ },
  creativeTasks: { weight: 0.12, pattern: /create|design|write|generate|compose|brand|campaign|strategy/ },
  security: { weight: 0.15, pattern: /security|vulnerability|exploit|attack|threat|malicious|encrypt|auth/ },
  debugging: { weight: 0.12, pattern: /debug|error|bug|fix|crash|fail|issue|broken|not.*work/ },
  dataAnalysis: { weight: 0.10, pattern: /analyze|data|metric|insight|trend|pattern|correlation/ },
  codeReview: { weight: 0.12, pattern: /review|refactor|clean|improve|optimize|best practice|pattern/ },
};

/**
 * Detect complexity signals in input text
 */
function detectSignals(input: string): EscalationSignal[] {
  const signals: EscalationSignal[] = [];
  const normalizedInput = input.toLowerCase();

  for (const [key, { weight, pattern }] of Object.entries(COMPLEXITY_SIGNALS)) {
    if (pattern.test(normalizedInput)) {
      signals.push({
        signal: key,
        weight,
        description: `Detected: ${key.replace(/([A-Z])/g, ' $1').trim()}`,
      });
    }
  }

  return signals;
}

/**
 * Calculate overall complexity score (0-1)
 */
function calculateComplexityScore(signals: EscalationSignal[]): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  // Normalize to 0-1 range with diminishing returns
  return Math.min(totalWeight / 1.5, 1.0);
}

/**
 * Determine if escalation is needed and recommend model
 */
export function analyzeEscalation(
  input: string,
  currentModel: string,
  contextLength?: number
): EscalationRecommendation {
  const signals = detectSignals(input);
  const complexityScore = calculateComplexityScore(signals);

  // Determine escalation level
  let escalationLevel: 'none' | 'minor' | 'moderate' | 'critical' = 'none';
  if (complexityScore > 0.75) escalationLevel = 'critical';
  else if (complexityScore > 0.55) escalationLevel = 'moderate';
  else if (complexityScore > 0.35) escalationLevel = 'minor';

  // Map current model to tier and recommend upgrade
  const modelTiers: Record<string, number> = {
    'qwen3.5:2b': 1,
    'qwen3.5:4b': 2,
    'qwen3.5:9b': 3,
    'qwen3.5:27b': 4,
    'nemotron-3-super:120b': 5,
    'gpt-oss-20b': 3,
    'context-1': 2,
  };

  const currentTier = modelTiers[currentModel] || 2;

  // Escalation recommendation based on signals and complexity
  let recommendedModel = currentModel;
  let shouldEscalate = false;

  if (escalationLevel === 'critical' && currentTier < 4) {
    recommendedModel = 'qwen3.5:27b';
    shouldEscalate = true;
  } else if (escalationLevel === 'critical' && currentTier >= 4) {
    recommendedModel = 'nemotron-3-super:120b';
    shouldEscalate = currentTier < 5;
  } else if (escalationLevel === 'moderate' && currentTier < 3) {
    recommendedModel = 'qwen3.5:9b';
    shouldEscalate = true;
  } else if (escalationLevel === 'minor' && currentTier < 2) {
    recommendedModel = 'qwen3.5:4b';
    shouldEscalate = true;
  }

  // Add context length consideration
  if (contextLength && contextLength > 8000 && currentTier < 3) {
    recommendedModel = 'qwen3.5:9b';
    shouldEscalate = true;
    if (signals.length === 0) {
      signals.push({
        signal: 'largeContext',
        weight: 0.08,
        description: 'Large input context detected',
      });
    }
  }

  return {
    shouldEscalate,
    currentModel,
    recommendedModel,
    escalationLevel,
    signals,
    confidenceScore: complexityScore,
  };
}

/**
 * Check if a model escalation recommendation should be applied
 * (used by agentEngine to auto-escalate when complexity detected)
 */
export function shouldApplyEscalation(
  recommendation: EscalationRecommendation,
  allowAutoEscalate: boolean = true
): boolean {
  if (!allowAutoEscalate) return false;
  if (recommendation.escalationLevel === 'none') return false;
  if (recommendation.confidenceScore < 0.4) return false;
  return recommendation.shouldEscalate;
}
