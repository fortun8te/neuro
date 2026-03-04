import { ollamaService } from './ollama';
import { searxngService } from './searxng';
import type { Campaign } from '../types';

export interface ResearchQuery {
  topic: string;
  context: string;
  depth: 'quick' | 'thorough';
}

export interface ResearchResult {
  query: string;
  findings: string;
  sources: string[];
  coverage_graph: Record<string, boolean>; // Dimensional coverage tracking
}

export interface CoverageGraph {
  market_size_trends: boolean;
  competitor_analysis: boolean;
  customer_objections: boolean;
  emerging_trends: boolean;
  regional_differences: boolean;
  pricing_strategies: boolean;
  channel_effectiveness: boolean;
  brand_positioning_gaps: boolean;
  psychological_triggers: boolean;
  media_consumption_patterns: boolean;
  [key: string]: boolean; // Allow additional dimensions
}

export interface OrchestratorState {
  campaign: Campaign;
  researchGoals: string[];
  completedResearch: ResearchResult[];
  coverageThreshold: number; // Percentage of dimensions that must be covered (0.0 - 1.0)
  userProvidedContext?: Record<string, string>; // Answers to questions glm asked
}

export interface ResearchPauseEvent {
  type: 'pause_for_input';
  question: string;
  context: string; // Why is glm asking?
  suggestedAnswers?: string[]; // Optional suggestions
}

// Researcher agent - executes single research task with SearXNG web search
export const researcherAgent = {
  async research(query: ResearchQuery, onChunk?: (chunk: string) => void): Promise<ResearchResult> {
    try {
      onChunk?.(`Searching for: "${query.topic}"...\n`);

      // Step 1: Get real web search results from SearXNG
      const searchResults = await searxngService.searchAndSummarize(query.topic, 5);
      onChunk?.(`Found ${searchResults.split('\n').length} relevant sources\n`);

      // Step 2: Synthesize findings with LLM
      const synthesisPrompt = `You are a research analyst synthesizing web search results for marketing research.

Search Results:
${searchResults}

Topic: ${query.topic}
Context: ${query.context}
Depth: ${query.depth}

Based on the search results above, provide:
1. Key insights (2-3 paragraphs)
2. Notable trends or patterns
3. Specific evidence from sources

Identify which of these dimensions you've covered in your research:
- Market size and trends
- Competitor analysis
- Customer objections
- Emerging trends
- Regional differences
- Pricing strategies
- Channel effectiveness
- Brand positioning gaps
- Psychological triggers
- Media consumption patterns

Format as:
FINDINGS: [Your synthesis here]
COVERAGE: [dimension: covered/uncovered, dimension: covered/uncovered, ...]
SOURCES: [URLs from the search results]`;

      const response = await ollamaService.generateStream(
        synthesisPrompt,
        'You are synthesizing web research to inform marketing strategy. Be specific and cite sources. Clearly identify which research dimensions you covered.',
        {
          model: 'lfm-2.5:q4_K_M', // Fast model for synthesis
          onChunk,
        }
      );

      // Parse response to build coverage graph
      const coverage_graph = buildCoverageGraph(response);

      return {
        query: query.topic,
        findings: response,
        sources: extractSources(response),
        coverage_graph,
      };
    } catch (error) {
      console.error('Research agent error:', error);
      // Fallback to LLM-only research if SearXNG fails
      try {
        onChunk?.('(SearXNG unavailable, using LLM-only research)\n');
        const fallbackPrompt = `You are a research analyst. Provide insights on this topic based on your knowledge:
Topic: ${query.topic}
Context: ${query.context}

Note which research dimensions you cover in your analysis (market size, competitors, objections, trends, regional factors, pricing, channels, positioning, psychology, media patterns).`;

        const response = await ollamaService.generateStream(
          fallbackPrompt,
          'Provide research insights. Note which dimensions you cover.',
          {
            model: 'lfm-2.5:q4_K_M',
            onChunk,
          }
        );

        const coverage_graph = buildCoverageGraph(response);

        return {
          query: query.topic,
          findings: response,
          sources: [],
          coverage_graph,
        };
      } catch (fallbackError) {
        console.error('Research fallback error:', fallbackError);
        throw fallbackError;
      }
    }
  },
};

// Orchestrator - manages researcher deployment and evaluation
export const orchestrator = {
  async orchestrateResearch(
    state: OrchestratorState,
    onProgressUpdate?: (message: string) => void,
    onPauseForInput?: (event: ResearchPauseEvent) => Promise<string>
  ): Promise<ResearchResult[]> {
    const allResults: ResearchResult[] = [...state.completedResearch];
    let iteration = 0;
    const maxIterations = 3; // Prevent infinite loops

    while (iteration < maxIterations) {
      iteration++;
      onProgressUpdate?.(`[Orchestrator] Evaluating research coverage & identifying gaps (iteration ${iteration})...`);

      // Ask glm-4.7 what to research next
      const evaluationPrompt = buildEvaluationPrompt(state, allResults, state.campaign.researchMode);

      try {
        const decision = await ollamaService.generate(
          evaluationPrompt,
          'You decide what research is needed. Be specific about topics.',
          'glm-4.7-flash:q4_K_M' // Smart orchestrator model
        );

        const nextTopics = parseOrchestratorDecision(decision);

        // Handle questions in interactive mode
        if (nextTopics[0]?.question && state.campaign.researchMode === 'interactive' && onPauseForInput) {
          onProgressUpdate?.(`\n[Orchestrator] Pausing for user input...\n`);
          const userAnswer = await onPauseForInput({
            type: 'pause_for_input',
            question: nextTopics[0].question,
            context: nextTopics[0].questionContext || 'Clarification needed',
            suggestedAnswers: state.campaign.productFeatures, // Use product features as suggestions
          });

          // Store user answer and continue
          if (!state.userProvidedContext) state.userProvidedContext = {};
          state.userProvidedContext[nextTopics[0].question] = userAnswer;
          onProgressUpdate?.(`User provided: ${userAnswer}\n`);
          continue; // Re-evaluate with user context
        }

        if (nextTopics.length === 0 || !nextTopics[0].shouldContinue) {
          onProgressUpdate?.('✓ Research phase complete - orchestrator satisfied with coverage');
          break;
        }

        // Deploy researchers in parallel (batch size of 3)
        onProgressUpdate?.(`Deploying ${nextTopics.length} researcher agents...`);
        const parallelResults = await Promise.all(
          nextTopics.slice(0, 3).map((topic) =>
            researcherAgent.research(
              {
                topic: topic.query,
                context: topic.context,
                depth: topic.depth,
              },
              (chunk) => {
                onProgressUpdate?.(`[Researcher] ${chunk}`);
              }
            )
          )
        );

        allResults.push(...parallelResults);

        // Evaluate coverage across all research results
        const coverageStatus = evaluateCoverage(allResults);
        const coveredDimensions = Object.values(coverageStatus).filter(Boolean).length;
        const totalDimensions = Object.keys(coverageStatus).length;
        const coveragePercentage = (coveredDimensions / totalDimensions) * 100;

        onProgressUpdate?.(
          `Research coverage: ${coveragePercentage.toFixed(0)}% (${coveredDimensions}/${totalDimensions} dimensions covered, threshold: ${(state.coverageThreshold * 100).toFixed(0)}%)`
        );

        if (coveragePercentage / 100 >= state.coverageThreshold) {
          onProgressUpdate?.('✓ Coverage threshold reached - research phase complete');
          break;
        }
      } catch (error) {
        console.error('Orchestrator error:', error);
        throw error;
      }
    }

    return allResults;
  },
};

// Helper functions
function extractSources(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlRegex) || [];

  const sourceRegex = /(?:from|via|source:|sources:)\s*([^.]+)/gi;
  const sourceMatches = text.match(sourceRegex) || [];

  return [...new Set([...urls, ...sourceMatches])].slice(0, 5);
}

interface OrchestratorDecision {
  query: string;
  context: string;
  depth: 'quick' | 'thorough';
  shouldContinue: boolean;
  question?: string; // If glm needs clarification from user
  questionContext?: string;
}

function parseOrchestratorDecision(decision: string): OrchestratorDecision[] {
  // Parse glm's structured decision about what to research
  const topics: OrchestratorDecision[] = [];

  // Check for QUESTION: [user input needed]
  const questionMatch = decision.match(/QUESTION:\s*(.+?)(?=\n|$)/i);
  if (questionMatch) {
    return [{
      query: '',
      context: '',
      depth: 'quick',
      shouldContinue: true,
      question: questionMatch[1].trim(),
      questionContext: 'glm needs clarification to continue research',
    }];
  }

  // Look for research decisions in the format:
  // RESEARCH_NEEDED: [topic]
  // or COMPLETE: true
  if (decision.toLowerCase().includes('complete') && decision.toLowerCase().includes('true')) {
    return [{ query: '', context: '', depth: 'quick', shouldContinue: false }];
  }

  // Extract research topics from response
  const lines = decision.split('\n');
  for (const line of lines) {
    if (line.includes('RESEARCH:') || line.includes('INVESTIGATE:')) {
      const topic = line.replace(/.*(?:RESEARCH|INVESTIGATE):\s*/i, '').trim();
      if (topic) {
        topics.push({
          query: topic,
          context: 'Marketing research for campaign optimization',
          depth: 'thorough',
          shouldContinue: true,
        });
      }
    }
  }

  // If no structured format found, extract key insights
  if (topics.length === 0) {
    topics.push({
      query: 'Additional competitive analysis',
      context: 'Marketing research',
      depth: 'quick',
      shouldContinue: false, // End research if no structured decision
    });
  }

  return topics;
}

function buildEvaluationPrompt(
  state: OrchestratorState,
  results: ResearchResult[],
  researchMode: 'interactive' | 'autonomous' = 'autonomous'
): string {
  const interactiveNote = researchMode === 'interactive'
    ? `\n\nIMPORTANT: You can ask the user for clarification if needed.
Format: QUESTION: [your clarifying question]
Example: QUESTION: What is your product's primary differentiator vs competitors?`
    : '';

  return `You are evaluating research completeness for an ad campaign.

Campaign Details:
- Brand: ${state.campaign.brand}
- Product: ${state.campaign.productDescription}
- Features: ${state.campaign.productFeatures?.join(', ') || 'Not specified'}
- Target Audience: ${state.campaign.targetAudience}
- Goal: ${state.campaign.marketingGoal}
${state.userProvidedContext ? `\nUser-Provided Context:\n${Object.entries(state.userProvidedContext).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}

Research Completed So Far:
${results.map((r) => {
  const covered = Object.values(r.coverage_graph).filter(Boolean).length;
  const total = Object.keys(r.coverage_graph).length;
  return `- ${r.query}: ${covered}/${total} dimensions covered`;
}).join('\n')}

Your Job: Evaluate research COVERAGE across 10 dimensions:
1. Market size & trends
2. Competitor analysis
3. Customer objections & pain points
4. Emerging market trends
5. Regional/cultural differences
6. Pricing strategies
7. Channel effectiveness
8. Brand positioning gaps
9. Psychological triggers
10. Media consumption patterns

If dimensions are missing, request targeted research to fill gaps. Use reflection-based approach: consider what perspectives are missing, what contradictions exist, and what an expert would criticize.

Format:
If incomplete: RESEARCH: [SPECIFIC gap to fill with evidence of why]
If you need user input: QUESTION: [your question]
If complete: COMPLETE: true${interactiveNote}`;
}

// Build coverage graph from research response
function buildCoverageGraph(response: string): CoverageGraph {
  const defaultGraph: CoverageGraph = {
    market_size_trends: false,
    competitor_analysis: false,
    customer_objections: false,
    emerging_trends: false,
    regional_differences: false,
    pricing_strategies: false,
    channel_effectiveness: false,
    brand_positioning_gaps: false,
    psychological_triggers: false,
    media_consumption_patterns: false,
  };

  const coverageMatch = response.match(/COVERAGE:\s*([^\n]+(?:\n[^\n]*)*)/i);
  if (!coverageMatch) return defaultGraph;

  const coverageText = coverageMatch[1];
  const dimensionMap: Record<string, keyof CoverageGraph> = {
    'market size': 'market_size_trends',
    'competitor': 'competitor_analysis',
    'objection': 'customer_objections',
    'trend': 'emerging_trends',
    'regional': 'regional_differences',
    'pricing': 'pricing_strategies',
    'channel': 'channel_effectiveness',
    'positioning': 'brand_positioning_gaps',
    'psychological': 'psychological_triggers',
    'media': 'media_consumption_patterns',
  };

  // Mark dimensions as covered if mentioned with "covered" keyword
  Object.entries(dimensionMap).forEach(([keyword, dimension]) => {
    const regex = new RegExp(`${keyword}[^,]*covered`, 'i');
    if (regex.test(coverageText)) {
      defaultGraph[dimension] = true;
    }
  });

  return defaultGraph;
}

// Evaluate overall coverage across all research results
function evaluateCoverage(results: ResearchResult[]): CoverageGraph {
  const merged: CoverageGraph = {
    market_size_trends: false,
    competitor_analysis: false,
    customer_objections: false,
    emerging_trends: false,
    regional_differences: false,
    pricing_strategies: false,
    channel_effectiveness: false,
    brand_positioning_gaps: false,
    psychological_triggers: false,
    media_consumption_patterns: false,
  };

  // Merge all coverage graphs - if ANY result covered a dimension, mark as covered
  results.forEach((result) => {
    Object.keys(merged).forEach((key) => {
      if (result.coverage_graph[key]) {
        merged[key as keyof CoverageGraph] = true;
      }
    });
  });

  return merged;
}

// Reflection Agent - AGGRESSIVE gap identification with 150% bar, not "good enough"
export const reflectionAgent = {
  async evaluateGaps(
    state: OrchestratorState,
    completedResults: ResearchResult[],
    onChunk?: (chunk: string) => void
  ): Promise<string[]> {
    try {
      const coverage = evaluateCoverage(completedResults);
      const gaps = Object.entries(coverage)
        .filter(([, covered]) => !covered)
        .map(([dimension]) => dimension);

      onChunk?.(`\n[🔍 REFLECTION AGENT - 150% BAR MODE] Aggressive gap analysis...\n`);
      onChunk?.(`Covered: ${10 - gaps.length}/10 dimensions. STILL MISSING: ${gaps.join(', ')}\n`);

      // AGGRESSIVE reflection prompt - push for contradictions, skepticism, and overconfidence detection
      const reflectionPrompt = `You are a CRITICAL research reflection agent operating at 150% thoroughness bar. Your job is to BRUTALLY identify what we DON'T know, not celebrate what we DO know.

Campaign Context:
- Brand: ${state.campaign.brand}
- Product: ${state.campaign.productDescription}
- Target: ${state.campaign.targetAudience}
- Goal: ${state.campaign.marketingGoal}

RESEARCH COMPLETED (${completedResults.length} queries):
${completedResults.map((r, i) => `${i + 1}. "${r.query}" → ${Object.values(r.coverage_graph).filter(Boolean).length}/10 dimensions`).join('\n')}

RESEARCH GAPS (NOT COVERED):
${gaps.length > 0 ? gaps.map((g, i) => `- [CRITICAL GAP ${i + 1}] ${g}`).join('\n') : 'NONE DECLARED (⚠️ OVERCONFIDENCE RISK!)'}

🚨 BRUTAL REFLECTION QUESTIONS - BE RUTHLESS:
1. WHO is missing from this research? (Competitors' customers? Detractors? Price-sensitive buyers? Heavy users?)
2. WHAT contradictions exist between sources? (One source says X, another says Y - which is RIGHT?)
3. WHAT would a SKEPTICAL EXPERT ridicule? (What's the weakest part of this research? What's obviously unstudied?)
4. WHAT assumptions are we making WITHOUT DATA? (Are we guessing about customer psychology?)
5. WHAT is Reddit/Trustpilot saying? (Is the brand on Trustpilot? What are actual customer complaints?)
6. WHAT does the website claim vs. what customers say? (Any mismatch = positioning gap)
7. WHAT regions/segments did we SKIP? (Did we research UK? Australia? Gen Z vs Boomers?)
8. WHAT second-order effects are HIDDEN? (Price drops affect perception. Market saturation. Seasonality.)
9. WHAT competitors aren't we researching? (Indirect competitors. Newer entrants. Substitutes.)
10. WHAT is the ACTUAL conversion journey? (How do people REALLY discover this? Not how they SAY they do.)

CRITICAL INSTRUCTION: If you find gaps, SUGGEST SPECIFIC RESEARCH to fill them. Not vague suggestions - CONCRETE angles.

EXAMPLES OF CONCRETE ANGLES:
❌ WEAK: "Research social media sentiment"
✅ STRONG: "Search TikTok videos about [product category] + common complaints/praise"

❌ WEAK: "Analyze competitor positioning"
✅ STRONG: "Extract exact claims from top 3 competitor homepages + customer objections from their Trustpilot reviews"

Format your response as:

OVERCONFIDENCE RISK LEVEL: [LOW/MEDIUM/HIGH/CRITICAL]
REASON: [Why are we at risk of thinking we know more than we do?]

CRITICAL GAPS ANALYSIS:
[For each gap dimension, explain WHY it's critical and what we're missing]

WEB RESEARCH OPPORTUNITIES:
1. [Brand name] + "trustpilot" reviews - actual customer complaints
2. Reddit r/[relevant subreddit] - authentic customer discussion
3. [Brand website] homepage - official claims vs reality
4. [Top competitor] Trustpilot - compare satisfaction rates
5. [Product category] + reviews/alternatives - market perception

AGGRESSIVE NEW RESEARCH ANGLES:
1. [SPECIFIC angle - not vague]
2. [SPECIFIC angle - not vague]
3. [SPECIFIC angle - not vague]
4. [SPECIFIC angle - not vague]
5. [SPECIFIC angle - not vague]`;

      const response = await ollamaService.generateStream(
        reflectionPrompt,
        `You are BRUTALLY critical. Your job is to make us realize what we DON'T KNOW. Find overconfidence. Find contradictions. Push for 150% bar, not "good enough". Suggest web research (Trustpilot, Reddit, websites). Be specific, not vague.`,
        {
          model: 'lfm-2.5:q4_K_M',
          temperature: 0.85, // Higher temp = more creative gap-finding
          onChunk,
        }
      );

      // Extract overconfidence risk level
      const riskMatch = response.match(/OVERCONFIDENCE RISK LEVEL:\s*(\w+)/i);
      const riskLevel = riskMatch ? riskMatch[1] : 'MEDIUM';
      onChunk?.(`⚠️  Overconfidence Risk: ${riskLevel}\n`);

      // Extract web research opportunities
      const webResearchMatch = response.match(/WEB RESEARCH OPPORTUNITIES:\s*([\s\S]*?)(?=AGGRESSIVE NEW|$)/i);
      if (webResearchMatch) {
        const opportunities = webResearchMatch[1]
          .split('\n')
          .filter((line) => /^\d+\.\s+/.test(line))
          .slice(0, 5);
        if (opportunities.length > 0) {
          onChunk?.(`\n🌐 Web Research Suggestions:\n${opportunities.map((o) => `  ${o}`).join('\n')}\n`);
        }
      }

      // Extract new research angles
      const anglesMatch = response.match(/AGGRESSIVE NEW RESEARCH ANGLES:\s*([\s\S]*?)(?=$)/i);
      if (!anglesMatch) {
        onChunk?.(`⚠️  No new research angles found - possible overconfidence!\n`);
        return [];
      }

      const angles = anglesMatch[1]
        .split('\n')
        .filter((line) => /^\d+\.\s+/.test(line))
        .map((line) => line.replace(/^\d+\.\s+/, '').trim())
        .filter((angle) => angle.length > 0 && !angle.startsWith('['));

      onChunk?.(`Found ${angles.length} CRITICAL new research angles to pursue\n`);
      return angles;
    } catch (error) {
      console.error('Reflection agent error:', error);
      return [];
    }
  },
};
