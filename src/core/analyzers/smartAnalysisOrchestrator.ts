/**
 * Smart Analysis Orchestrator
 *
 * Combines:
 * 1. Dynamic reasoning about what to research next
 * 2. Parallel analyzer execution
 * 3. Site visual analysis (full-page screenshots + Gemma vision)
 * 4. Quality-based iteration until confident
 *
 * Instead of following presets, it THINKS about what's needed.
 */

import { SubagentPool } from '../../utils/subagentManager';
import { createLogger } from '../../utils/logger';
import {
  reasonAboutNextResearch,
  generateNextQueries,
  type DynamicResearchPlan,
  type ResearchRecommendation,
} from '../dynamicReasoner';
import {
  analyzeSiteVisuals,
  type SiteVisualAnalysis,
} from '../../services/siteVisualAnalyzer';
import {
  analyzeProductPages,
  type ProductAnalysis,
} from '../../services/productPageAnalyzer';
import {
  analyzeImages,
  type ImageAnalysis,
} from '../../services/imageAnalyzer';
import {
  analyzeSocialPresence,
  type SocialAnalysis,
} from '../../services/socialPresenceAnalyzer';
import { estimateRevenue, type RevenueAnalysis } from '../../services/revenueEstimator';
import {
  analyzeCompetitorNiche,
  type CompetitorNicheAnalysis,
} from '../../services/competitorNicheAnalyzer';
import { analyzeAudience, type AudienceAnalysis } from '../../services/audienceAnalyzer';

const log = createLogger('smartOrchestrator');

export interface SmartAnalysisRequest {
  brandName: string;
  question: string;
  context: string; // What are we trying to accomplish?
  brandWebsite?: string;
  competitorWebsites?: string[];
  timeLimit: number; // ms
  iterationLimit: number;
  confidenceTarget?: number; // 0-100, default 85
}

export interface SmartAnalysisProgress {
  step: string;
  completion: number; // 0-100
  findings: Record<string, any>;
  dynamicPlan?: DynamicResearchPlan;
  nextActions?: string[];
}

export interface SmartAnalysisResult {
  brandName: string;
  question: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  confidence: number; // 0-100
  iterations: number;

  // Analysis results
  productAnalysis?: ProductAnalysis;
  imageAnalysis?: ImageAnalysis;
  siteVisuals?: SiteVisualAnalysis;
  competitorVisuals?: SiteVisualAnalysis[];
  socialAnalysis?: SocialAnalysis;
  audienceAnalysis?: AudienceAnalysis;
  revenueAnalysis?: RevenueAnalysis;
  competitorAnalysis?: CompetitorNicheAnalysis;

  // Dynamic reasoning results
  researchPlans: DynamicResearchPlan[];
  researchIterations: Array<{
    iteration: number;
    plan: DynamicResearchPlan;
    queriesExecuted: string[];
    timestamp: number;
  }>;

  // Summary
  summary: string;
  keyFindings: string[];
  nextSteps: string[];
}

/**
 * Execute smart analysis that reasons about what to research
 */
export async function executeSmartAnalysis(
  request: SmartAnalysisRequest,
  pool: SubagentPool,
  onProgress?: (progress: SmartAnalysisProgress) => void,
): Promise<SmartAnalysisResult> {
  const startTime = Date.now();
  const confidenceTarget = request.confidenceTarget || 85;
  let iteration = 0;
  let confidence = 0;
  const researchPlans: DynamicResearchPlan[] = [];
  const researchIterations: SmartAnalysisResult['researchIterations'] = [];
  const findings: Record<string, any> = {};

  log.info('[SmartOrchestrator] Starting smart analysis', {
    brand: request.brandName,
    question: request.question,
  });

  try {
    // Phase 1: Initial analysis (parallel execution of all analyzers)
    onProgress?.({
      step: 'Analyzing brand website and basic data...',
      completion: 5,
      findings,
    });

    log.info('[SmartOrchestrator] Phase 1: Initial analysis');

    // Parallel execution of all available analyzers
    const [
      productAnalysis,
      imageAnalysis,
      siteVisuals,
      socialAnalysis,
      audienceAnalysis,
      revenueAnalysis,
      competitorAnalysis,
    ] = await Promise.allSettled([
      request.brandWebsite
        ? analyzeProductPages(request.brandWebsite, {})
        : Promise.resolve(undefined),
      request.brandWebsite
        ? analyzeImages(request.brandWebsite, { maxImages: 50 })
        : Promise.resolve(undefined),
      request.brandWebsite
        ? analyzeSiteVisuals(request.brandWebsite, {
            compareWith: request.competitorWebsites,
            focus: 'all',
          })
        : Promise.resolve(undefined),
      analyzeSocialPresence(request.brandName, {}),
      analyzeAudience(
        {
          question: request.question,
          context: request.context,
        },
        pool,
      ),
      estimateRevenue(request.brandName, {}),
      analyzeCompetitorNiche(request.brandName, {}),
    ]);

    // Collect results
    if (productAnalysis.status === 'fulfilled')
      findings.productAnalysis = productAnalysis.value;
    if (imageAnalysis.status === 'fulfilled')
      findings.imageAnalysis = imageAnalysis.value;
    if (siteVisuals.status === 'fulfilled')
      findings.siteVisuals = siteVisuals.value;
    if (socialAnalysis.status === 'fulfilled')
      findings.socialAnalysis = socialAnalysis.value;
    if (audienceAnalysis.status === 'fulfilled')
      findings.audienceAnalysis = audienceAnalysis.value;
    if (revenueAnalysis.status === 'fulfilled')
      findings.revenueAnalysis = revenueAnalysis.value;
    if (competitorAnalysis.status === 'fulfilled')
      findings.competitorAnalysis = competitorAnalysis.value;

    // Get competitor visuals if available
    if (
      request.competitorWebsites &&
      request.competitorWebsites.length > 0 &&
      siteVisuals.status === 'fulfilled'
    ) {
      findings.competitorVisuals = (siteVisuals.value?.positioning
        ?.comparedTo || []) as unknown as SiteVisualAnalysis[];
    }

    onProgress?.({
      step: 'Initial analysis complete. Planning additional research...',
      completion: 25,
      findings,
    });

    // Phase 2: Dynamic reasoning about what to research next
    log.info('[SmartOrchestrator] Phase 2: Dynamic reasoning');

    while (
      confidence < confidenceTarget &&
      iteration < request.iterationLimit &&
      Date.now() - startTime < request.timeLimit
    ) {
      iteration++;
      log.info(`[SmartOrchestrator] Iteration ${iteration}`);

      // Reason about what we need to research next
      const plan = await reasonAboutNextResearch(
        findings,
        request.question,
        request.context,
        pool,
      );

      researchPlans.push(plan);
      confidence = plan.currentCoverage;

      onProgress?.({
        step: `Dynamic reasoning: Found ${plan.gaps.length} gaps, confidence ${confidence}%`,
        completion: 25 + iteration * 5,
        findings,
        dynamicPlan: plan,
        nextActions: generateNextQueries(plan.recommendations, 3),
      });

      // If high confidence, we're done reasoning
      if (confidence >= confidenceTarget || iteration >= request.iterationLimit) {
        break;
      }

      // Generate next queries based on recommendations
      const nextQueries = generateNextQueries(
        plan.recommendations.sort((a, b) => b.priority - a.priority),
        3,
      );

      log.debug('[SmartOrchestrator] Next queries', { queries: nextQueries });

      // Execute web research for top recommendations
      if (nextQueries.length > 0) {
        onProgress?.({
          step: `Executing targeted research: ${nextQueries[0]}`,
          completion: 25 + iteration * 5,
          findings,
          nextActions: nextQueries,
        });

        // TODO: Execute web research with nextQueries
        // This would call researchers to fetch and analyze URLs
      }

      researchIterations.push({
        iteration,
        plan,
        queriesExecuted: nextQueries,
        timestamp: Date.now(),
      });
    }

    // Phase 3: Generate summary and key findings
    log.info('[SmartOrchestrator] Phase 3: Generating summary');

    const keyFindings = extractKeyFindings(findings);
    const nextSteps = generateNextSteps(findings, researchPlans);

    onProgress?.({
      step: 'Analysis complete, generating report...',
      completion: 95,
      findings,
    });

    const result: SmartAnalysisResult = {
      brandName: request.brandName,
      question: request.question,
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      confidence,
      iterations: iteration,

      productAnalysis: findings.productAnalysis,
      imageAnalysis: findings.imageAnalysis,
      siteVisuals: findings.siteVisuals,
      competitorVisuals: findings.competitorVisuals,
      socialAnalysis: findings.socialAnalysis,
      audienceAnalysis: findings.audienceAnalysis,
      revenueAnalysis: findings.revenueAnalysis,
      competitorAnalysis: findings.competitorAnalysis,

      researchPlans,
      researchIterations,

      summary: generateSummary(findings, request.question),
      keyFindings,
      nextSteps,
    };

    log.info('[SmartOrchestrator] Analysis complete', {
      confidence: result.confidence,
      iterations: result.iterations,
      duration: result.durationMs,
    });

    onProgress?.({
      step: 'Complete',
      completion: 100,
      findings,
    });

    return result;
  } catch (error) {
    log.error('[SmartOrchestrator] Analysis failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Extract key findings from all analyses
 */
function extractKeyFindings(findings: Record<string, any>): string[] {
  const findings_list: string[] = [];

  if (findings.siteVisuals?.insights) {
    findings_list.push(
      ...findings.siteVisuals.insights.slice(0, 3),
    );
  }

  if (findings.productAnalysis?.products) {
    const productCount = findings.productAnalysis.products.length;
    const priceRange = `$${findings.productAnalysis.priceRange?.min || 0}-$${findings.productAnalysis.priceRange?.max || 0}`;
    findings_list.push(`Portfolio: ${productCount} products (${priceRange})`);
  }

  if (findings.socialAnalysis?.platforms) {
    const platformCount = findings.socialAnalysis.platforms.length;
    const totalFollowers = findings.socialAnalysis.platforms.reduce(
      (sum: number, p: any) => sum + (p.followers || 0),
      0,
    );
    findings_list.push(
      `Social presence: ${platformCount} platforms, ${totalFollowers.toLocaleString()} followers`,
    );
  }

  if (findings.revenueAnalysis?.estimate) {
    const revenue = findings.revenueAnalysis.estimate;
    const confidence = findings.revenueAnalysis.confidence;
    findings_list.push(
      `Estimated annual revenue: $${revenue.toLocaleString()} (${confidence}% confidence)`,
    );
  }

  if (findings.audienceAnalysis?.primaryPersona) {
    const persona = findings.audienceAnalysis.primaryPersona;
    findings_list.push(
      `Primary audience: ${persona.ageRange} ${persona.gender}, ${persona.values?.join(', ') || 'engaged'}`,
    );
  }

  if (findings.competitorAnalysis?.competitors) {
    const compCount = findings.competitorAnalysis.competitors.length;
    findings_list.push(`Analyzed ${compCount} competitors`);
  }

  return findings_list;
}

/**
 * Generate next steps based on findings
 */
function generateNextSteps(
  findings: Record<string, any>,
  plans: DynamicResearchPlan[],
): string[] {
  const steps: string[] = [];

  // Based on gaps identified in reasoning
  if (plans.length > 0) {
    const latestPlan = plans[plans.length - 1];
    if (latestPlan.gaps.length > 0) {
      steps.push(`Address top gap: ${latestPlan.gaps[0].aspect}`);
      steps.push(`Recommended queries: ${latestPlan.gaps[0].suggestedQueries.join(', ')}`);
    }
  }

  // Suggest deeper analysis based on what's missing
  if (!findings.audienceAnalysis) {
    steps.push('Conduct deeper audience segmentation research');
  }

  if (!findings.competitorAnalysis) {
    steps.push('Expand competitor analysis to adjacent markets');
  }

  if (findings.revenueAnalysis?.confidence < 70) {
    steps.push(
      'Improve revenue estimate with more data sources',
    );
  }

  return steps.slice(0, 5);
}

/**
 * Generate summary paragraph
 */
function generateSummary(findings: Record<string, any>, question: string): string {
  const parts: string[] = [];

  if (findings.siteVisuals) {
    const tone = findings.siteVisuals.visualTone?.primary || 'distinctive';
    parts.push(`Visual identity is ${tone}`);
  }

  if (findings.productAnalysis?.products) {
    parts.push(
      `${findings.productAnalysis.products.length} products in portfolio`,
    );
  }

  if (findings.audienceAnalysis?.primaryPersona) {
    parts.push(
      `Targets ${findings.audienceAnalysis.primaryPersona.description || 'specific demographics'}`,
    );
  }

  if (findings.revenueAnalysis?.estimate) {
    parts.push(
      `Revenue estimated at $${findings.revenueAnalysis.estimate.toLocaleString()}`,
    );
  }

  return `Analysis of ${parts.join(', ')}. Addressing question: ${question}`;
}
