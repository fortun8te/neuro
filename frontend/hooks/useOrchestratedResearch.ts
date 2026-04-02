import { useCallback } from 'react';
import { ollamaService } from '../utils/ollama';
import { orchestrator, orchestratorWithRouting } from '../utils/researchAgents';
import type { OrchestratorState, ResearchPauseEvent } from '../utils/researchAgents';
import { useResearchAgent } from './useResearchAgent';
import { runCouncil, extractFindingsFromVerdict } from '../utils/council';
import type { CouncilVerdict } from '../utils/council';
import { getResearchModelConfig, getResearchLimits, getActiveResearchPreset, getCouncilScaling } from '../utils/modelConfig';
import { createResearchAudit, buildResearchAuditTrail, recordResearchModel } from '../utils/researchAudit';
import { SemanticCompressionEngine } from '../utils/semanticContextCompression';
import type { Campaign, ResearchFindings, VisualFindings } from '../types';

interface OrchestratedResearchResult {
  processedOutput: string;
  rawOutput: string;
  model: string;
  processingTime: number;
  researchFindings: ResearchFindings;
}

/**
 * Orchestrated Research Hook
 *
 * FLIPPED FLOW — Web research first, then brains analyze enriched data:
 *   Phase 1: Web Research — gather real-world data (Wayfayer + SearXNG)
 *   Phase 2: Desire-Driven Deep Dive — 4-layer structured analysis
 *   Phase 3: Council of Marketing Brains — 7 brains analyze sequentially with all data
 *   Phase 4: Council Re-run — if confidence < 8, re-analyze with all context
 *   Phase 5: Competitor Ad Intelligence — optional
 *
 * The council verdict feeds ALL downstream stages.
 */
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('econnrefused') || msg.includes('network') || msg.includes('cannot reach');
}

export function useOrchestratedResearch() {
  const { executeResearch: executeDesireResearch } = useResearchAgent();

  // useCallback with [executeDesireResearch] so the function reference is
  // stable across renders.  Without this the reference changes every render,
  // which invalidates the executeStage useCallback in useCycleLoop and causes
  // unnecessary re-creations of the entire stage execution closure.
  const executeOrchestratedResearch = useCallback(async (
    campaign: Campaign,
    onProgress?: (msg: string) => void,
    enableWebSearch: boolean = true,
    onPauseForInput?: (event: ResearchPauseEvent) => Promise<string>,
    signal?: AbortSignal,
    priorMemories?: { id: string; content: string; tags: string[] }[]
  ): Promise<OrchestratedResearchResult> => {
    const startTime = Date.now();
    const limits = getResearchLimits();
    const activePreset = getActiveResearchPreset();
    const researchConfig = getResearchModelConfig();

    // Initialize audit trail to track all sources and tokens
    createResearchAudit();
    recordResearchModel(researchConfig.orchestratorModel);
    recordResearchModel(researchConfig.compressionModel);
    recordResearchModel(researchConfig.desireLayerModel);

    onProgress?.('\n════════════════════════════════════════════════════════════════════\n');
    onProgress?.(`ORCHESTRATED RESEARCH [${activePreset.toUpperCase()}]: Web → Analysis → Council\n`);
    onProgress?.(`Models: orch=${researchConfig.orchestratorModel} comp=${researchConfig.compressionModel} synth=${researchConfig.researcherSynthesisModel}\n`);
    onProgress?.(`Limits: ${limits.maxIterations} iters, ${limits.minSources} sources, ${limits.maxVisualBatches} visual batches\n`);
    onProgress?.('════════════════════════════════════════════════════════════════════\n\n');

    // Verify Ollama is reachable before starting LLM-heavy phases
    const ollamaReachable = await ollamaService.checkConnection().catch(() => false);
    if (!ollamaReachable) {
      onProgress?.('════════════════════════════════════════════════════════════════════\n');
      onProgress?.('OLLAMA OFFLINE\n');
      onProgress?.('════════════════════════════════════════════════════════════════════\n');
      onProgress?.("Can't reach Ollama. Research requires the LLM to be running.\n\n");
      onProgress?.('To fix:\n');
      onProgress?.('  1. Check that Ollama is running on your machine\n');
      onProgress?.('  2. Verify the URL in Settings matches your Ollama address\n');
      onProgress?.(`  3. Current URL: ${(await import('../config/infrastructure')).INFRASTRUCTURE.ollamaUrl}\n\n`);
      onProgress?.('Web scraping (Wayfarer) does not require Ollama — only the analysis phases do.\n');
      throw new Error("Can't reach Ollama — check Settings > Connection");
    }

    // Display prior cycle memories for context
    if (priorMemories && priorMemories.length > 0) {
      onProgress?.('[MEMORY INPUT] Learnings from previous cycles:\n');
      priorMemories.forEach(m => {
        onProgress?.(`  • ${m.content} [${m.tags.join(', ')}]\n`);
      });
      onProgress?.('\n');
    }

    // Initialize findings
    let researchFindings: ResearchFindings = {
      deepDesires: [],
      objections: [],
      avatarLanguage: [],
      whereAudienceCongregates: [],
      whatTheyTriedBefore: [],
      competitorWeaknesses: [],
    };

    let councilVerdict: CouncilVerdict | null = null;
    let councilOutput = '';
    let webResearchContext = ''; // Accumulated web findings text — fed into desire analysis + council

    // ──────────────────────────────────────────────────
    // PHASE 1: Web Research — gather real-world data FIRST
    // This gives brains actual data to analyze instead of guessing
    // ──────────────────────────────────────────────────
    if (enableWebSearch && !signal?.aborted) {
      onProgress?.('[PHASE 1] Web Research — Gathering real-world intelligence\n\n');

      const researchGoals = [
        'Find VERBATIM customer language — how real people describe this problem on Reddit, forums, Trustpilot (NOT brand language)',
        'Research competitor ADVERTISING — Meta Ad Library, ad hooks, what visuals/angles are running now',
        'Find NEGATIVE REVIEWS of competitors — Trustpilot 1-star, Amazon complaints, Reddit rants',
        'Validate TURNING POINTS — when does this pain become unbearable? What triggers the purchase?',
        'Research FAILED SOLUTIONS — what specific products did people try before? Why did they fail?',
        'Identify market trends, growth rates, and new entrants disrupting the space',
        'Find competitor STRUCTURAL WEAKNESSES — what can they NEVER claim?',
        'Analyze pricing strategies, willingness-to-pay, and value perception',
        'Research ADJACENT NICHES — what approaches from other industries could work here?',
      ];

      const orchestratorState: OrchestratorState = {
        campaign,
        researchGoals,
        completedResearch: [],
        coverageThreshold: getResearchLimits().coverageThreshold,
      };

      try {
        // Phase 1: Check for advanced query routing feature flag
        const ADVANCED_ROUTING_ENABLED = import.meta.env.VITE_QUERY_ROUTING_ENABLED === 'true';

        let webResearchResults;

        if (ADVANCED_ROUTING_ENABLED) {
          onProgress?.('[ORCHESTRATOR] Using advanced query routing (60% token reduction)...\n');
          // Use new orchestratorWithRouting function
          const routedQueries = await orchestratorWithRouting(
            campaign,
            orchestratorState,
            activePreset,
            (msg) => {
              councilOutput += msg;
              onProgress?.(msg);
            },
            signal
          );
          // For now, convert routed queries to expected format for downstream pipeline
          // In future iterations, this will feed directly into researcher execution
          webResearchResults = [];
        } else {
          // Use original orchestrator
          const result = await orchestrator.orchestrateResearch(
            orchestratorState,
            (msg) => {
              councilOutput += msg;
              onProgress?.(msg);
            },
            onPauseForInput,
            signal
          );
          webResearchResults = result;
        }

        onProgress?.('\n[PHASE 1 COMPLETE] Web research done.\n\n');

        // ── Extract structured data from web research ──
        // Build a context string with ALL findings for downstream consumption
        const findingsBlocks: string[] = [];
        webResearchResults.forEach((r) => {
          if (r.findings && r.findings.length > 50) {
            findingsBlocks.push(`[Research: ${r.query}]\n${r.findings}`);
          }
        });
        webResearchContext = findingsBlocks.join('\n\n---\n\n');

        // Extract structured findings from web research text using keyword heuristics
        const allFindings = webResearchResults.map(r => r.findings).join('\n');

        // Extract verbatim language (look for quoted text in web findings)
        const verbatimMatches = allFindings.match(/"([^"]{10,200})"/g);
        if (verbatimMatches) {
          researchFindings.avatarLanguage = verbatimMatches
            .map(m => m.replace(/^"|"$/g, ''))
            .filter(m => m.length > 10 && m.length < 200)
            .slice(0, 15);
        }

        // Extract competitor mentions
        const competitorWeaknesses: string[] = [];
        const weaknessPatterns = [/weakness[es]*[:.\s]+([^\n]+)/gi, /gap[s]*[:.\s]+([^\n]+)/gi, /can(?:'t| not|never)\s+claim\s+([^\n]+)/gi, /structural(?:ly)?\s+(?:limited|trapped|constrained)\s*[:.\s]+([^\n]+)/gi];
        for (const pat of weaknessPatterns) {
          let m;
          while ((m = pat.exec(allFindings)) !== null) {
            if (m[1]?.trim().length > 10) competitorWeaknesses.push(m[1].trim());
          }
        }
        if (competitorWeaknesses.length > 0) {
          researchFindings.competitorWeaknesses = competitorWeaknesses.slice(0, 10);
        }

        // Extract where audience congregates from web findings
        const communityPatterns = [/r\/\w+/g, /facebook\s+group[s]*\s*[:.\-]?\s*"?([^"\n]+)/gi, /subreddit[s]*[:.\s]+([^\n]+)/gi];
        const communities: string[] = [];
        for (const pat of communityPatterns) {
          const matches = allFindings.match(pat);
          if (matches) communities.push(...matches.map(m => m.trim()));
        }
        if (communities.length > 0) {
          researchFindings.whereAudienceCongregates = [...new Set(communities)].slice(0, 10);
        }

        // Merge visual findings if captured
        const visualFindings = orchestratorState._visualFindings;
        if (visualFindings) {
          researchFindings.visualFindings = visualFindings as VisualFindings;
        }

        // Summary for output
        const totalSources = new Set(webResearchResults.flatMap(r => r.sources)).size;
        onProgress?.(`Web research extracted: ${researchFindings.avatarLanguage.length} verbatim quotes, ${researchFindings.competitorWeaknesses.length} competitor weaknesses, ${researchFindings.whereAudienceCongregates.length} communities, ${totalSources} unique sources\n`);
        onProgress?.(`Web context: ${(webResearchContext.length / 1000).toFixed(0)}K chars available for downstream phases\n\n`);

        // ── Structured phase summary for UI ──
        const summaryLines = [
          `\n${'═'.repeat(68)}`,
          `WEB RESEARCH FINDINGS SUMMARY`,
          `${'═'.repeat(68)}`,
          `Sources scraped: ${totalSources} unique URLs`,
          `Queries completed: ${webResearchResults.length}`,
          `Web context: ${(webResearchContext.length / 1000).toFixed(0)}K chars`,
          ``,
          `Extracted:`,
          `  Verbatim quotes: ${researchFindings.avatarLanguage.length}`,
          `  Competitor weaknesses: ${researchFindings.competitorWeaknesses.length}`,
          `  Communities found: ${researchFindings.whereAudienceCongregates.length}`,
        ];
        if (researchFindings.avatarLanguage.length > 0) {
          summaryLines.push(`  Sample language: "${researchFindings.avatarLanguage[0]}"`);
        }
        if (researchFindings.competitorWeaknesses.length > 0) {
          summaryLines.push(`  Top weakness: ${researchFindings.competitorWeaknesses[0]}`);
        }
        summaryLines.push('');
        const summaryText = summaryLines.join('\n');
        onProgress?.(summaryText);
        councilOutput += summaryText;
      } catch (err) {
        if (signal?.aborted) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isIdleTimeout = errMsg.includes('No response from model');
        onProgress?.(`\n[PHASE 1 ERROR] Web research failed: ${errMsg}\n`);
        if (isIdleTimeout) {
          onProgress?.('  → Model is not responding. Check that Ollama is running and the model is loaded.\n');
          onProgress?.('  → Try: ollama list (to see loaded models), then ollama run <model> to warm it up.\n');
        } else {
          onProgress?.('  → Is Wayfayer running on port 8889? Is SearXNG up on port 8888?\n');
        }
        onProgress?.('  → Continuing with LLM analysis only.\n\n');
        console.error('Web research error:', err);
      }
    }

    // ──────────────────────────────────────────────────
    // PHASE 2: Desire-Driven Deep Dive (4-layer analysis)
    // Now has web data to work with for enriched analysis
    // ──────────────────────────────────────────────────
    if (!signal?.aborted) {
      onProgress?.('[PHASE 2] Desire-Driven Deep Dive (4-Layer Analysis)\n\n');

      try {
        const desireResult = await executeDesireResearch(
          campaign,
          (msg) => onProgress?.(msg),
          researchConfig.desireLayerModel,
          signal,
          webResearchContext || undefined  // Pass web findings so desire analysis uses real data
        );

        if (desireResult.researchFindings) {
          // Merge desire findings
          researchFindings = {
            ...researchFindings,
            deepDesires: desireResult.researchFindings.deepDesires || researchFindings.deepDesires,
            objections: desireResult.researchFindings.objections || researchFindings.objections,
            avatarLanguage: [
              ...researchFindings.avatarLanguage,
              ...(desireResult.researchFindings.avatarLanguage || []),
            ].filter((v, i, a) => a.indexOf(v) === i),
            whereAudienceCongregates: desireResult.researchFindings.whereAudienceCongregates || [],
            whatTheyTriedBefore: desireResult.researchFindings.whatTheyTriedBefore || [],
            competitorWeaknesses: [
              ...researchFindings.competitorWeaknesses,
              ...(desireResult.researchFindings.competitorWeaknesses || []),
            ].filter((v, i, a) => a.indexOf(v) === i),
            marketSophistication: desireResult.researchFindings.marketSophistication,
            rootCauseMechanism: desireResult.researchFindings.rootCauseMechanism,
            persona: desireResult.researchFindings.persona,
            purchaseJourney: desireResult.researchFindings.purchaseJourney,
            emotionalLandscape: desireResult.researchFindings.emotionalLandscape,
            competitivePositioning: desireResult.researchFindings.competitivePositioning,
          };
          councilOutput += '\n' + desireResult.processedOutput;
        }

        onProgress?.('\n[PHASE 2 COMPLETE] Deep desire analysis done.\n\n');
      } catch (err) {
        if (signal?.aborted) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        onProgress?.('\n[PHASE 2 ERROR] Desire analysis failed\n');
        if (isConnectionError(err)) {
          onProgress?.("  → Ollama went offline mid-research. Check your connection in Settings.\n");
        } else if (errMsg.includes('No response from model')) {
          onProgress?.('  → Model stopped responding (timeout). Ollama may be overloaded.\n');
        } else {
          onProgress?.(`  → ${errMsg}\n`);
        }
        onProgress?.('  → Continuing with web findings only.\n\n');
        console.error('Desire research error:', err);
      }
    }

    // ──────────────────────────────────────────────────
    // PHASE 3: Council of Marketing Brains
    // Scales with preset: SQ/QK skip, NR 4 brains, EX 7 brains, MX 13 brains
    // ──────────────────────────────────────────────────
    if (!signal?.aborted) {
      const councilScale = getCouncilScaling();

      if (councilScale.skipCouncil) {
        onProgress?.('[PHASE 3] Council SKIPPED (SQ/QK preset — using orchestrator decisions)\n\n');
      } else {
        onProgress?.(`[PHASE 3] Council of Marketing Brains — ${councilScale.brainIds.length} Brains -> ${councilScale.councilHeadCount} Head(s) -> Verdict\n\n`);
      }

      try {
        // Get competitor screenshots if available (for Visual Brain)
        const competitorScreenshots = campaign.referenceImages
          ?.filter(img => img.type === 'layout' || img.type === 'product')
          .map(img => img.base64)
          .filter(Boolean) as string[] | undefined;

        councilVerdict = await runCouncil(
          campaign,
          researchFindings,
          (msg) => {
            councilOutput += msg;
            onProgress?.(msg);
          },
          signal,
          {
            maxIterations: 2,
            confidenceThreshold: 7,
            competitorScreenshots,
          }
        );

        // Extract findings from council
        const councilFindings = extractFindingsFromVerdict(councilVerdict);
        researchFindings = { ...researchFindings, ...councilFindings };
        researchFindings.councilVerdict = councilVerdict;

        const creativeNote = councilVerdict.creativeAngles?.length
          ? ` + ${councilVerdict.creativeAngles.length} creative angles`
          : '';
        const mergeNote = councilVerdict.mergedBrains?.length
          ? ` (${councilVerdict.mergedBrains.length} brain pairs merged for overlap)`
          : '';
        onProgress?.(`\n[PHASE 3 COMPLETE] Council verdict delivered${creativeNote}${mergeNote}.\n\n`);
      } catch (err) {
        if (signal?.aborted) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        onProgress?.('\n[COUNCIL ERROR] Council failed\n');
        if (isConnectionError(err)) {
          onProgress?.("  -> Ollama went offline during council. Check your connection in Settings.\n");
        } else if (errMsg.includes('No response from model')) {
          onProgress?.('  -> Model stopped responding (30s+ timeout). Ollama may be overloaded.\n');
        } else {
          onProgress?.(`  -> ${errMsg}\n`);
        }
        onProgress?.('  -> Using web + desire findings only.\n\n');
        console.error('Council error:', err);
      }
    }

    // ──────────────────────────────────────────────────
    // PHASE 4: Competitor Ad Intelligence (optional)
    // ──────────────────────────────────────────────────
    if (!signal?.aborted && researchFindings.competitorWeaknesses.length > 0) {
      onProgress?.(`${'═'.repeat(68)}\n`);
      onProgress?.('[PHASE 4] Competitor Ad Intelligence\n');
      onProgress?.(`${'═'.repeat(68)}\n\n`);
      try {
        const { analyzeCompetitorAds } = await import('../utils/competitorAdsAgent');
        const competitorAds = await analyzeCompetitorAds(
          campaign,
          researchFindings,
          (msg) => {
            councilOutput += msg;
            onProgress?.(msg);
          },
          signal
        );
        researchFindings.competitorAds = competitorAds;
        const totalAds = competitorAds.competitors.reduce((s, c) => s + c.adExamples.length, 0);
        onProgress?.(`\n[PHASE 4 COMPLETE] ${totalAds} ad examples across ${competitorAds.competitors.length} competitors | ${competitorAds.visionAnalyzed} vision-analyzed\n\n`);
      } catch (err) {
        onProgress?.('[PHASE 4] Competitor ad intelligence skipped\n\n');
        console.warn('Competitor ads phase failed:', err);
      }
    }

    // ──────────────────────────────────────────────────
    // VALIDATION: Warn if findings are minimal
    // ──────────────────────────────────────────────────
    const findingsScore =
      (researchFindings.deepDesires.length > 0 ? 1 : 0) +
      (researchFindings.objections.length > 0 ? 1 : 0) +
      (researchFindings.avatarLanguage.length > 0 ? 1 : 0) +
      (researchFindings.competitorWeaknesses.length > 0 ? 1 : 0) +
      (researchFindings.rootCauseMechanism ? 1 : 0) +
      (researchFindings.persona ? 1 : 0);

    if (findingsScore < 3) {
      onProgress?.(`\n[WARNING] Research findings are thin (${findingsScore}/6 categories populated).\n`);
      onProgress?.('  → Downstream stages will generate based on campaign brief instead.\n');
      onProgress?.('  → For better results: check Ollama connection, try different models, or add more product details.\n\n');
    }

    // ──────────────────────────────────────────────────
    // SYNTHESIS: Final output
    // ──────────────────────────────────────────────────
    const verdictSummary = councilVerdict ? `
${'═'.repeat(68)}
COUNCIL VERDICT (Confidence: ${councilVerdict.confidenceScore}/10)
${'═'.repeat(68)}

Strategic Direction: ${councilVerdict.strategicDirection}
Primary Ad Type: ${councilVerdict.primaryAdType}
Secondary Ad Type: ${councilVerdict.secondaryAdType}
Headline Hook: ${councilVerdict.headlineStrategy.hookType} — ${councilVerdict.headlineStrategy.why}
Headlines: ${councilVerdict.headlineStrategy.examples.join(' | ')}
Offer: ${councilVerdict.offerStructure}
Visual Concept: ${councilVerdict.visualConcept}
Audience Language: ${councilVerdict.audienceLanguage.join(', ')}

Key Insights:
${councilVerdict.keyInsights.map((i, idx) => `  ${idx + 1}. ${i}`).join('\n')}

Avoid:
${councilVerdict.avoidList.map(a => `  - ${a}`).join('\n')}

Dissent (where brains disagreed):
${councilVerdict.dissent.map(d => `  - ${d}`).join('\n')}
` : '';

    const finalOutput = councilOutput + verdictSummary + `
${'═'.repeat(68)}
RESEARCH COMPLETE
${'═'.repeat(68)}

Phases completed:
- Phase 1: Web research (Wayfayer + SearXNG) — ${new Set(([] as string[]).concat(...(researchFindings.avatarLanguage || []))).size > 0 ? 'verbatim data gathered' : 'web data gathered'}
- Phase 2: 4-layer desire analysis — desires, root cause, objections, market
- Phase 3: Council of Marketing Brains — 7 brains → 3 heads → verdict
${researchFindings.visualFindings ? '- Visual competitive intelligence\n' : ''}${researchFindings.competitorAds ? '- Competitor ad intelligence\n' : ''}
Ready for: Brand DNA → Persona DNA → Angles`;

    onProgress?.('\nRESEARCH COMPLETE\n');
    onProgress?.(`${'═'.repeat(68)}\n\n`);

    // Finalize audit trail
    const auditTrail = buildResearchAuditTrail();
    if (auditTrail) {
      researchFindings.auditTrail = auditTrail;
      onProgress?.(`\n[AUDIT] Research provenance: ${auditTrail.totalSources} sources, ${auditTrail.totalTokensGenerated} tokens generated\n`);
    }

    // ──────────────────────────────────────────────────
    // SEMANTIC COMPRESSION: Compress research findings
    // ──────────────────────────────────────────────────
    // Estimate original size for compression ratio calculation
    const originalSize = JSON.stringify(researchFindings).length;
    const compressor = new SemanticCompressionEngine();
    const compressed = compressor.compress(researchFindings, originalSize);
    const compressionRatio = (100 - (compressed.metadata.compressedSizeBytes / originalSize * 100)).toFixed(1);

    onProgress?.(`\n[COMPRESSION] Original: ${(originalSize / 1024).toFixed(1)}KB → Compressed: ${(compressed.metadata.compressedSizeBytes / 1024).toFixed(1)}KB (${compressionRatio}% reduction, ${compressed.triples.length} semantic triples)\n`);

    // Store compressed version in findings for downstream use (optional)
    // This allows stages to access semantic triples if they need efficient context recall
    (researchFindings as any).__compressed = compressed;

    return {
      processedOutput: finalOutput,
      rawOutput: finalOutput,
      model: `wayfarer + council + ${researchConfig.orchestratorModel}`,
      processingTime: Date.now() - startTime,
      researchFindings,
    };
  }, [executeDesireResearch]);

  return {
    executeOrchestratedResearch,
  };
}
