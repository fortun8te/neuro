/**
 * Deep Research Orchestrator — Planning + Research + Reflection Loop
 *
 * Architecture:
 * 1. PLANNING: Decompose question into logical sections/subtopics
 * 2. RESEARCH: For each section, spawn parallel subagents to research
 * 3. REFLECTION: Analyze coverage/gaps, decide if more research needed
 * 4. LOOP: Continue until coverage × confidence > threshold or time/iterations exhausted
 *
 * Key Insight: Don't just iterate blindly. Plan the structure, research
 * methodically per section, reflect on what's missing.
 */

import { ollamaService } from './ollama.js';
import { context1Service } from './context1Service.js';
import { wayfarerService } from './wayfarer.js';
import { SubagentPool } from './subagentManager.js';
import { createLogger } from './logger.js';
import type { ResearchTask } from './deepResearchTaskQueue.js';

const log = createLogger('deepResearchOrchestrator');

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Extract JSON from response that may be wrapped in markdown code blocks
 */
function extractJSON(response: string): string {
  const trimmed = response.trim();

  // Try to extract from ```json ... ``` blocks
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }

  // If it starts with [ or { but wrapped in backticks, extract that
  if (trimmed.startsWith('```')) {
    const end = trimmed.lastIndexOf('```');
    if (end > 3) {
      return trimmed.substring(3, end).trim().replace(/^json\s*\n?/, '');
    }
  }

  // Otherwise return as-is
  return trimmed;
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ResearchSection {
  id: string;
  title: string;
  description: string;
  keyQuestions: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface SectionFindings {
  sectionId: string;
  facts: string[];
  quotes: string[];
  statistics: Record<string, string>;
  sources: string[];
  confidence: number;
  researched: boolean;
}

export interface ResearchPlan {
  question: string;
  sections: ResearchSection[];
  totalEstimatedSources: number;
  researchStrategy: string;
}

export interface ResearchState {
  plan: ResearchPlan;
  findings: Map<string, SectionFindings>;
  iteration: number;
  coverage: number;
  confidence: number;
  readyScore: number;
  gaps: string[];
}

export interface ResearchConfig {
  maxIterations: number;
  sourcesPerSection: number;
  coverageThreshold: number;
  maxParallelAgents: number;
  timeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────
// STANDARD RESEARCH CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const STANDARD_RESEARCH_CONFIG: ResearchConfig = {
  maxIterations: 4,
  sourcesPerSection: 50,
  coverageThreshold: 0.75,
  maxParallelAgents: 7,
  timeoutMs: 2 * 60 * 60 * 1000 // 2 hours
};

// ─────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────

export class DeepResearchOrchestrator {
  private config: ResearchConfig;
  private agentPool: SubagentPool;
  private startTime: number = 0;

  constructor() {
    this.config = STANDARD_RESEARCH_CONFIG;
    this.agentPool = new SubagentPool(this.config.maxParallelAgents);
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: PLANNING
  // ─────────────────────────────────────────────────────────────

  /**
   * Decompose question into logical research sections
   */
  async planResearch(question: string): Promise<ResearchPlan> {
    log.info(`Planning research for: ${question}`);

    const prompt = `You are a research planning expert. Decompose this research question into 5-8 logical sections that together would fully answer it.

Question: "${question}"

For each section, provide:
1. Title (short, descriptive)
2. Description (1-2 sentences on what this section covers)
3. Key questions (3-4 specific questions to answer)
4. Priority (high/medium/low based on importance to answering the main question)

Format as JSON array:
[
  {
    "title": "Section Title",
    "description": "What this covers",
    "keyQuestions": ["Q1", "Q2", "Q3"],
    "priority": "high"
  }
]

Focus on creating a logical flow where sections build on each other.
Make each section specific and research-friendly (not too broad).`;

    try {
      const response = await ollamaService.generateStream(
        prompt,
        'gemma4:e4b', // Reasoning model for planning
        { temperature: 0.7, num_ctx: 8192 }
      );

      const sections = JSON.parse(extractJSON(response));

      return {
        question,
        sections: sections.map((s: any, i: number) => ({
          id: `section-${i}`,
          title: s.title,
          description: s.description,
          keyQuestions: s.keyQuestions,
          priority: s.priority || 'medium'
        })),
        totalEstimatedSources: this.config.sourcesPerSection * sections.length,
        researchStrategy: `Multi-section research: ${sections.length} sections, ~${this.config.sourcesPerSection} sources per section`
      };
    } catch (error) {
      log.error('Planning failed:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: RESEARCH (Per Section)
  // ─────────────────────────────────────────────────────────────

  /**
   * Research a single section using parallel subagents
   */
  async researchSection(
    section: ResearchSection,
    existingFindings: Map<string, SectionFindings>
  ): Promise<SectionFindings> {
    log.info(`Researching section: ${section.title}`);

    // Generate search queries for this section
    const queries = await this.generateSearchQueries(section, existingFindings);

    // Spawn parallel subagents to research different aspects
    const subagentPromises = queries.map((query, i) =>
      this.agentPool.submit({
        role: 'researcher',
        task: `Research: ${query}`,
        query,
        context: section.description,
        maxSteps: 5
      })
    );

    const results = await Promise.all(subagentPromises);

    // Aggregate findings from all subagents
    const sourceSet = new Set<string>();
    const findings: SectionFindings = {
      sectionId: section.id,
      facts: [],
      quotes: [],
      statistics: {},
      sources: [],
      confidence: 0,
      researched: true
    };

    for (const result of results) {
      if (result.success) {
        findings.facts.push(...(result.facts || []));
        findings.quotes.push(...(result.quotes || []));
        Object.assign(findings.statistics, result.statistics || {});
        (result.sources || []).forEach(s => sourceSet.add(s));
      }
    }

    findings.sources = Array.from(sourceSet);

    // Score confidence based on specificity and corroboration
    findings.confidence = this.scoreConfidence(findings);

    // Ingest into Context-1 vector DB
    await context1Service.ingestFindings(section.id, findings);

    return findings;
  }

  /**
   * Generate targeted search queries for a section
   */
  private async generateSearchQueries(
    section: ResearchSection,
    existingFindings: Map<string, SectionFindings>
  ): Promise<string[]> {
    const prompt = `Generate 3-5 specific search queries to research this section thoroughly.

Section: ${section.title}
Description: ${section.description}
Key Questions: ${section.keyQuestions.join(', ')}

Make queries:
- Specific and searchable (5-10 words)
- Varied (market research, Reddit, academic, news, etc.)
- Progressive (start broad, get specific)

Return as JSON array of strings:
["query 1", "query 2", "query 3"]`;

    try {
      const response = await ollamaService.generateStream(prompt, 'gemma4:e4b', { temperature: 0.7 });
      const parsed = JSON.parse(extractJSON(response));
      return Array.isArray(parsed) ? parsed : [section.title];
    } catch (error) {
      log.warn(`Failed to generate search queries for section ${section.id}, using section title as fallback`);
      return [section.title];
    }
  }

  /**
   * Score confidence of findings (0-1 scale)
   */
  private scoreConfidence(findings: SectionFindings): number {
    let score = 0;

    // Specificity bonus (exact numbers, dates, quotes)
    const specificity = findings.facts.filter(f =>
      /\$\d+|20\d{2}|"[^"]{10,}"|\d+%/g.test(f)
    ).length / Math.max(findings.facts.length, 1);
    score += specificity * 0.3;

    // Source diversity bonus
    const sourceTypes = new Set(findings.sources.map(s => this.categorizeSource(s)));
    score += Math.min(sourceTypes.size / 4, 1) * 0.3; // Max 4 source types

    // Corroboration bonus (multiple sources for same fact)
    const corroborationRatio = Math.min(findings.sources.length / Math.max(findings.facts.length, 1), 2);
    score += Math.min(corroborationRatio / 2, 1) * 0.4;

    return Math.min(score, 1.0);
  }

  private categorizeSource(url: string): string {
    if (url.includes('reddit.com')) return 'community';
    if (url.includes('pubmed.gov') || url.includes('arxiv.org')) return 'academic';
    if (url.includes('github.com')) return 'code';
    return 'industry';
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 3: REFLECTION & GAP ANALYSIS
  // ─────────────────────────────────────────────────────────────

  /**
   * Analyze coverage and identify gaps
   */
  async analyzeGaps(plan: ResearchPlan, findings: Map<string, SectionFindings>): Promise<string[]> {
    const gaps: string[] = [];
    let coverageCount = 0;

    for (const section of plan.sections) {
      const sectionFindings = findings.get(section.id);

      if (!sectionFindings || !sectionFindings.researched) {
        gaps.push(`Missing: ${section.title}`);
      } else if (sectionFindings.confidence < 0.5) {
        gaps.push(`Weak confidence in: ${section.title}`);
      } else {
        coverageCount++;
      }
    }

    // Run reflection agent to detect non-obvious gaps
    const reflectionGaps = await this.runReflectionAgent(plan, findings);
    gaps.push(...reflectionGaps);

    return gaps;
  }

  /**
   * Run reflection agent (Devil's Advocate, Depth Auditor, Coverage Checker)
   */
  private async runReflectionAgent(
    plan: ResearchPlan,
    findings: Map<string, SectionFindings>
  ): Promise<string[]> {
    // Summarize current findings
    const summary = Array.from(findings.values())
      .map(f => `${f.facts.slice(0, 3).join('; ')} [confidence: ${f.confidence.toFixed(2)}]`)
      .join('\n');

    const prompt = `Review this research and identify gaps:

Question: "${plan.question}"

Findings Summary:
${summary}

For each gap identified, suggest what specific research would fill it.
Format as JSON:
{
  "gaps": ["gap 1", "gap 2"],
  "suggestedQueries": ["query 1", "query 2"]
}`;

    try {
      const response = await ollamaService.generateStream(prompt, 'gemma4:e4b', { temperature: 0.7 });
      const result = JSON.parse(extractJSON(response));
      return result.gaps || [];
    } catch (error) {
      log.warn('Reflection agent JSON parsing failed, returning empty gaps', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN LOOP
  // ─────────────────────────────────────────────────────────────

  /**
   * Main orchestration loop: Plan → Research → Reflect → Loop
   */
  async orchestrate(
    task: ResearchTask,
    onProgress?: (state: ResearchState) => void
  ): Promise<ResearchState> {
    this.startTime = Date.now();

    log.info(`Starting research orchestration for task: ${task.id}`);
    log.info(`Config: ${JSON.stringify(this.config)}`);

    // PHASE 1: PLAN
    const plan = await this.planResearch(task.question);
    log.info(`Created plan with ${plan.sections.length} sections`);

    const state: ResearchState = {
      plan,
      findings: new Map(),
      iteration: 0,
      coverage: 0,
      confidence: 0,
      readyScore: 0,
      gaps: []
    };

    // PHASE 2-4: RESEARCH LOOP
    let previousReadyScore = 0;
    let plateauCount = 0;

    for (let i = 1; i <= this.config.maxIterations; i++) {
      state.iteration = i;

      log.info(`Iteration ${i}/${this.config.maxIterations}`);

      // Check time limit
      if (this.config.timeoutMs && Date.now() - this.startTime > this.config.timeoutMs) {
        log.warn(`Time limit reached (${this.config.timeoutMs}ms)`);
        break;
      }

      // Research each section in parallel
      const sectionPromises = plan.sections.map(section =>
        this.researchSection(section, state.findings)
          .then(findings => {
            state.findings.set(section.id, findings);
          })
      );

      await Promise.all(sectionPromises);

      // Evaluate coverage & confidence
      const completedSections = Array.from(state.findings.values()).filter(f => f.researched).length;
      state.coverage = (completedSections / plan.sections.length) * 100;
      state.confidence = Array.from(state.findings.values()).reduce((sum, f) => sum + f.confidence, 0) / plan.sections.length;
      state.readyScore = (state.coverage / 100) * state.confidence;

      log.info(`Coverage: ${state.coverage.toFixed(0)}% | Confidence: ${state.confidence.toFixed(2)} | Ready: ${state.readyScore.toFixed(2)}`);

      // Check termination conditions
      if (state.readyScore >= this.config.coverageThreshold) {
        log.info(`Ready score (${state.readyScore.toFixed(2)}) exceeds threshold (${this.config.coverageThreshold})`);
        break;
      }

      // Plateau detection
      if (Math.abs(state.readyScore - previousReadyScore) < 0.01) {
        plateauCount++;
        if (plateauCount >= 2) {
          log.warn(`Plateau detected (< 1% improvement for 2 iterations)`);
          break;
        }
      } else {
        plateauCount = 0;
      }
      previousReadyScore = state.readyScore;

      // Emit progress
      if (onProgress) {
        onProgress(state);
      }

      // Gap analysis (if not final iteration)
      if (i < this.config.maxIterations) {
        state.gaps = await this.analyzeGaps(plan, state.findings);
        log.info(`Identified ${state.gaps.length} gaps`);
      }
    }

    log.info(`Research complete. Ready score: ${state.readyScore.toFixed(2)}, Iterations: ${state.iteration}`);

    return state;
  }

  close(): void {
    this.agentPool.close();
    context1Service.close();
  }
}
