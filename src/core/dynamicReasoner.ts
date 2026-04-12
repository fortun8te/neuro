/**
 * Dynamic Research Reasoner
 *
 * Instead of following presets, this analyzes current findings and reasons
 * about what to research next based on actual gaps and quality assessment.
 *
 * Flow:
 * 1. Analyze current findings quality
 * 2. Identify specific gaps (not generic)
 * 3. Reason about WHAT to research next and WHY
 * 4. Generate dynamic search queries
 * 5. Prioritize by importance + feasibility
 */

import { SubagentPool } from '../utils/subagentManager';
import { createLogger } from '../utils/logger';

const log = createLogger('dynamicReasoner');

export interface ResearchGap {
  aspect: string; // What's missing?
  importance: 'critical' | 'high' | 'medium'; // How important?
  whyMissing: string; // Why do we need this?
  impactIfMissing: string; // What breaks without this?
  suggestedQueries: string[]; // What to search for
  estimatedDuration: string; // How long will it take?
}

export interface ResearchRecommendation {
  priority: number; // 1-10, higher = more urgent
  gap: ResearchGap;
  rationale: string; // Why this matters for the goal
  expectedOutcome: string; // What we'll learn
  nextSteps: string[];
}

export interface DynamicResearchPlan {
  currentCoverage: number; // 0-100%
  analyzedAt: number;
  gaps: ResearchGap[];
  recommendations: ResearchRecommendation[];
  summary: string;
}

/**
 * Analyze findings and dynamically reason about what to research next
 */
export async function reasonAboutNextResearch(
  findings: Record<string, any>,
  originalQuestion: string,
  context: string, // The goal/context (e.g., "brand analysis for collagen supplement")
  pool: SubagentPool,
): Promise<DynamicResearchPlan> {
  log.info('[DynamicReasoner] Analyzing findings and planning next research...');

  // Find what we have so far
  const currentData = {
    images: findings.imageAnalysis?.total || 0,
    products: findings.productAnalysis?.products?.length || 0,
    audience: findings.audienceAnalysis ? 'yes' : 'no',
    social: findings.socialAnalysis?.platforms?.length || 0,
    revenue: findings.revenueEstimate?.estimate || null,
    competitors: findings.competitorAnalysis?.competitors?.length || 0,
  };

  log.debug('[DynamicReasoner] Current data:', currentData);

  // Use a reasoner subagent to think through gaps
  try {
    const response = await pool.submit({
      role: 'reasoner',
      task: `Analyze research findings and recommend what to research NEXT based on ACTUAL GAPS`,
      prompt: `Context: ${context}
Original Question: ${originalQuestion}

Current Findings:
- Images analyzed: ${currentData.images}
- Products found: ${currentData.products}
- Audience analyzed: ${currentData.audience}
- Social platforms: ${currentData.social}
- Revenue estimate: ${currentData.revenue ? '$' + currentData.revenue.toLocaleString() : 'Not estimated'}
- Competitors identified: ${currentData.competitors}

Raw findings summary:
${JSON.stringify(findings, null, 2).slice(0, 2000)}

Your task: Think deeply about what's MISSING or WEAK in understanding this context.

Return JSON with:
{
  "gaps": [
    {
      "aspect": "specific missing knowledge",
      "importance": "critical|high|medium",
      "whyMissing": "why we don't have this yet",
      "impactIfMissing": "what goes wrong without this",
      "suggestedQueries": ["search query 1", "search query 2"],
      "estimatedDuration": "how long will this take"
    }
  ],
  "summary": "overall assessment of what's missing"
}

Be specific. Don't say "more research". Say "We need to understand their supply chain strategy because it affects pricing power".
Don't suggest researching unrelated topics.
ONLY suggest things directly relevant to: "${originalQuestion}"`,
      context:
        'You are a research strategist. Think about gaps in understanding the original question.',
      maxSteps: 4,
    });

    // Parse response
    const reasoning = parseReasonerResponse(response.text);

    // Convert gaps to prioritized recommendations
    const recommendations = createRecommendations(
      reasoning.gaps,
      originalQuestion,
      context,
    );

    const plan: DynamicResearchPlan = {
      currentCoverage: calculateCoverage(currentData),
      analyzedAt: Date.now(),
      gaps: reasoning.gaps,
      recommendations: recommendations.sort((a, b) => b.priority - a.priority),
      summary: reasoning.summary,
    };

    log.info('[DynamicReasoner] Research plan created', {
      gaps: plan.gaps.length,
      recommendations: plan.recommendations.length,
      coverage: plan.currentCoverage,
    });

    return plan;
  } catch (error) {
    log.error('[DynamicReasoner] Failed to reason about next research', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback: basic gaps
    return {
      currentCoverage: calculateCoverage(currentData),
      analyzedAt: Date.now(),
      gaps: createBasicGaps(currentData),
      recommendations: [],
      summary:
        'Unable to dynamically reason about research gaps. Using fallback strategy.',
    };
  }
}

/**
 * Parse reasoner response JSON
 */
function parseReasonerResponse(text: string): {
  gaps: ResearchGap[];
  summary: string;
} {
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      gaps: (parsed.gaps || []).map((g: any) => ({
        aspect: g.aspect || '',
        importance: g.importance || 'medium',
        whyMissing: g.whyMissing || '',
        impactIfMissing: g.impactIfMissing || '',
        suggestedQueries: g.suggestedQueries || [],
        estimatedDuration: g.estimatedDuration || 'unknown',
      })),
      summary: parsed.summary || 'Analysis complete',
    };
  } catch (error) {
    log.error('[DynamicReasoner] Failed to parse response', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { gaps: [], summary: 'Parse error' };
  }
}

/**
 * Convert gaps into prioritized recommendations
 */
function createRecommendations(
  gaps: ResearchGap[],
  question: string,
  context: string,
): ResearchRecommendation[] {
  return gaps.map((gap, index) => {
    const importanceScore =
      gap.importance === 'critical' ? 10 : gap.importance === 'high' ? 7 : 4;

    return {
      priority: importanceScore - index * 0.5, // Slightly decrease priority for later gaps
      gap,
      rationale: `${gap.aspect} is ${gap.importance}. ${gap.impactIfMissing}`,
      expectedOutcome: `Better understanding of ${gap.aspect} to answer: ${question}`,
      nextSteps: gap.suggestedQueries,
    };
  });
}

/**
 * Calculate overall research coverage (0-100)
 */
function calculateCoverage(data: Record<string, any>): number {
  let score = 0;
  let items = 0;

  if (data.images && data.images > 5) {
    score += 20;
  } else if (data.images > 0) {
    score += 10;
  }
  items++;

  if (data.products && data.products > 5) {
    score += 20;
  } else if (data.products > 0) {
    score += 10;
  }
  items++;

  if (data.audience === 'yes') {
    score += 20;
  }
  items++;

  if (data.social && data.social > 0) {
    score += 20;
  }
  items++;

  if (data.revenue) {
    score += 20;
  }
  items++;

  if (data.competitors && data.competitors > 0) {
    score += 20;
  }
  items++;

  return Math.min(100, Math.round((score / (items * 20)) * 100));
}

/**
 * Fallback gaps if reasoner fails
 */
function createBasicGaps(data: Record<string, any>): ResearchGap[] {
  const gaps: ResearchGap[] = [];

  if (!data.images || data.images < 10) {
    gaps.push({
      aspect: 'Brand visual identity',
      importance: 'high',
      whyMissing: 'Need to see actual product packaging and website design',
      impactIfMissing: 'Cannot assess visual positioning or design consistency',
      suggestedQueries: ['brand packaging design', 'website design screenshots'],
      estimatedDuration: '5-10 minutes',
    });
  }

  if (!data.audience || data.audience === 'no') {
    gaps.push({
      aspect: 'Target audience demographics',
      importance: 'critical',
      whyMissing: 'Who exactly is buying this brand?',
      impactIfMissing: 'Cannot tailor messaging or understand market segment',
      suggestedQueries: ['customer demographics', 'target market analysis'],
      estimatedDuration: '10-15 minutes',
    });
  }

  if (!data.social || data.social < 3) {
    gaps.push({
      aspect: 'Social media presence and engagement',
      importance: 'high',
      whyMissing: 'Need to understand how brand engages with audience',
      impactIfMissing: 'Missing insights into brand voice and community',
      suggestedQueries: [
        'social media strategy',
        'instagram followers engagement',
      ],
      estimatedDuration: '5-10 minutes',
    });
  }

  if (!data.revenue) {
    gaps.push({
      aspect: 'Revenue and business metrics',
      importance: 'medium',
      whyMissing: 'Need to understand business scale and growth',
      impactIfMissing: 'Cannot assess market traction or success',
      suggestedQueries: ['company revenue', 'business funding rounds'],
      estimatedDuration: '5-10 minutes',
    });
  }

  return gaps;
}

/**
 * Generate next queries based on recommendations
 */
export function generateNextQueries(
  recommendations: ResearchRecommendation[],
  maxQueries: number = 5,
): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  for (const rec of recommendations.slice(0, 5)) {
    for (const query of rec.gap.suggestedQueries) {
      if (!seen.has(query) && queries.length < maxQueries) {
        queries.push(query);
        seen.add(query);
      }
    }
  }

  return queries;
}
