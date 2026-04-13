/**
 * Fact Checker Agent
 * Validates research claims against multiple sources
 * Uses Wayfarer + LLM verification
 */

import { ollamaService } from './ollama';
import { wayfayerService } from './wayfayer';
import { recordResearchSource } from './researchAudit';
import type { ResearchFindings } from '../types';
import type {
  FactClaim,
  FactCheckResult,
  FlaggedClaim,
  FactCheckReport,
  SourceAuthority,
} from '../types/factCheck';

// ─────────────────────────────────────────────────────────────
// Source Authority Database
// ─────────────────────────────────────────────────────────────

const SOURCE_AUTHORITY_DB: Record<string, Partial<SourceAuthority>> = {
  'scholarly-sources': {
    authority: 0.95,
    category: 'academic',
    relevantFor: ['statistic', 'fact'],
    notSuitableFor: ['quote'],
  },
  'news-outlets': {
    authority: 0.80,
    category: 'news',
    relevantFor: ['fact', 'trend'],
    notSuitableFor: ['attribution'],
  },
  'official-brands': {
    authority: 0.90,
    category: 'official',
    relevantFor: ['fact', 'attribution'],
    notSuitableFor: [],
  },
  'reddit': {
    authority: 0.50,
    category: 'social',
    relevantFor: ['quote', 'trend'],
    notSuitableFor: ['statistic'],
    notes: 'Good for user sentiment, poor for facts',
  },
  'wikipedia': {
    authority: 0.70,
    category: 'review',
    relevantFor: ['fact', 'statistic'],
    notSuitableFor: ['attribution'],
    notes: 'Community-edited, verify with another source',
  },
  'blog': {
    authority: 0.40,
    category: 'blog',
    relevantFor: ['opinion'],
    notSuitableFor: ['statistic', 'fact'],
  },
};

// ─────────────────────────────────────────────────────────────
// Extract verifiable claims from findings
// ─────────────────────────────────────────────────────────────

export function extractClaimables(findings: ResearchFindings): FactClaim[] {
  const claims: FactClaim[] = [];
  let claimId = 0;

  // Extract from objections (numbers, statistics, pain points)
  findings.objections?.forEach((obj, idx) => {
    if (obj.objection && /\d+|percent|%|\$/.test(obj.objection)) {
      claims.push({
        id: `claim-objection-${claimId++}`,
        claim: obj.objection,
        sourceSection: 'objections',
        sourceIndex: idx,
        extractedAt: Date.now(),
        claimType: 'statistic',
        confidence: 0.7,
      });
    }
  });

  // Extract from competitive positioning (market claims)
  findings.competitivePositioning?.forEach((comp, idx) => {
    if (comp.positioning && comp.positioning.length > 10) {
      claims.push({
        id: `claim-positioning-${claimId++}`,
        claim: comp.positioning,
        sourceSection: 'competitivePositioning',
        sourceIndex: idx,
        extractedAt: Date.now(),
        claimType: 'fact',
        confidence: 0.65,
      });
    }
    if (comp.customerComplaint && /[\d%]|common|widespread|majority/.test(comp.customerComplaint)) {
      claims.push({
        id: `claim-complaint-${claimId++}`,
        claim: comp.customerComplaint,
        sourceSection: 'competitivePositioning',
        sourceIndex: idx,
        extractedAt: Date.now(),
        claimType: 'quote',
        confidence: 0.6,
      });
    }
  });

  // Extract from verbatim quotes (attribute-based)
  findings.verbatimQuotes?.forEach((quote, idx) => {
    if (quote.length > 15 && /[\d%]|research|study|found/.test(quote)) {
      claims.push({
        id: `claim-quote-${claimId++}`,
        claim: quote,
        sourceSection: 'verbatimQuotes',
        sourceIndex: idx,
        extractedAt: Date.now(),
        claimType: 'quote',
        confidence: 0.75,
      });
    }
  });

  // Extract from purchase journey (behavioral)
  if (findings.purchaseJourney) {
    const pj = findings.purchaseJourney;
    if (pj.typicalTimeline && /\d+ (day|week|month|hour)/.test(pj.typicalTimeline)) {
      claims.push({
        id: `claim-timeline-${claimId++}`,
        claim: `Typical purchase decision timeline: ${pj.typicalTimeline}`,
        sourceSection: 'purchaseJourney',
        extractedAt: Date.now(),
        claimType: 'fact',
        confidence: 0.65,
      });
    }
  }

  // Filter out purely subjective or opinion-based claims
  return claims.filter((c) => {
    const opinion = /opinion|believe|think|feel|subjective|prefer/i;
    return !opinion.test(c.claim) && c.claim.length > 10;
  });
}

// ─────────────────────────────────────────────────────────────
// Verify a single claim using web search + LLM validation
// ─────────────────────────────────────────────────────────────

async function verifySingleClaim(
  claim: FactClaim,
  signal?: AbortSignal
): Promise<FactCheckResult> {
  const startTime = Date.now();
  const sourceUrls: string[] = [];
  const supporting: string[] = [];
  const contradicting: string[] = [];
  const neutral: string[] = [];

  try {
    // Step 1: Web search for claim via Wayfarer
    let searchResults = '';
    try {
      const wayfarerResult = await wayfayerService.research(
        claim.claim.slice(0, 100),
        5,  // numResults
        signal
      );

      if (wayfarerResult?.pages) {
        searchResults = wayfarerResult.pages.map(p => p.content).join('\n\n');
        wayfarerResult.pages.forEach((page) => {
          sourceUrls.push(page.url);
          recordResearchSource({
            url: page.url,
            query: claim.claim,
            source: 'text',
            extractedSnippet: page.snippet || page.content.slice(0, 200),
          });
        });
      }
    } catch (err) {
      console.warn('[factChecker] Wayfarer search failed:', err);
    }

    // Step 2: LLM verification using qwen3.5:4b (fact checker)
    const verificationPrompt = `You are a fact-checking expert. Verify this claim:

CLAIM: "${claim.claim}"
CLAIM TYPE: ${claim.claimType}

SEARCH RESULTS:
${searchResults.slice(0, 3000)}

Analyze the search results and provide:
1. VERDICT: 'verified', 'disputed', or 'unverified' (be strict: verified only if explicit confirmation found)
2. SUPPORTING EVIDENCE: List of facts/quotes that support the claim (max 3)
3. CONTRADICTING EVIDENCE: List of facts/quotes that contradict the claim (max 3)
4. SOURCE_AGREEMENT: % of sources that support the claim (0-100)
5. CONFIDENCE: Your confidence in the verdict (0-100)
6. REASON: Brief explanation (one paragraph)

Format your response as:
VERDICT: [verified/disputed/unverified]
SUPPORTING: [comma-separated list or NONE]
CONTRADICTING: [comma-separated list or NONE]
SOURCE_AGREEMENT: [number]
CONFIDENCE: [number]
REASON: [explanation]`;

    let verificationOutput = '';
    verificationOutput = await ollamaService.generateStream(
      verificationPrompt,
      'You are a fact-checking expert.',
      {
        model: 'qwen3.5:4b',
        temperature: 0.3,
        top_p: 0.9,
        onChunk: (chunk) => {
          verificationOutput += chunk;
        },
        signal,
      }
    );

    // Parse the verification output
    const vlines = verificationOutput.split('\n');
    let verdict: 'verified' | 'disputed' | 'unverified' = 'unverified';
    let sourceAgreement = 0;
    let confidence = 0.5;
    let reasonForVerdict = '';

    for (const line of vlines) {
      if (line.startsWith('VERDICT:')) {
        const v = line.replace('VERDICT:', '').trim().toLowerCase();
        if (v.includes('verified') && !v.includes('unverified')) verdict = 'verified';
        else if (v.includes('disputed')) verdict = 'disputed';
        else verdict = 'unverified';
      }
      if (line.startsWith('SOURCE_AGREEMENT:')) {
        sourceAgreement = parseInt(line.replace('SOURCE_AGREEMENT:', '').trim()) || 0;
      }
      if (line.startsWith('CONFIDENCE:')) {
        confidence = parseInt(line.replace('CONFIDENCE:', '').trim()) / 100 || 0.5;
      }
      if (line.startsWith('REASON:')) {
        reasonForVerdict = line.replace('REASON:', '').trim();
      }
      if (line.startsWith('SUPPORTING:') && !line.includes('NONE')) {
        const items = line
          .replace('SUPPORTING:', '')
          .trim()
          .split(',')
          .filter((s) => s.trim());
        supporting.push(...items);
      }
      if (line.startsWith('CONTRADICTING:') && !line.includes('NONE')) {
        const items = line
          .replace('CONTRADICTING:', '')
          .trim()
          .split(',')
          .filter((s) => s.trim());
        contradicting.push(...items);
      }
    }

    return {
      claimId: claim.id,
      claim: claim.claim,
      verdict,
      confidence,
      evidence: { supporting, contradicting, neutral },
      sourceAgreement,
      reasonForVerdict,
      checkedAt: Date.now(),
      sourceUrls: [...new Set(sourceUrls)],
    };
  } catch (err) {
    console.warn(`[factChecker] Verification failed for claim "${claim.claim}":`, err);
    return {
      claimId: claim.id,
      claim: claim.claim,
      verdict: 'unverified',
      confidence: 0,
      evidence: { supporting: [], contradicting: [], neutral: [] },
      sourceAgreement: 0,
      reasonForVerdict: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
      checkedAt: Date.now(),
      sourceUrls,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Batch verify multiple claims
// ─────────────────────────────────────────────────────────────

export async function verifyClaimsInBatch(
  claims: FactClaim[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  concurrency: number = 2
): Promise<FactCheckResult[]> {
  if (claims.length === 0) return [];

  onProgress?.(`Fact-checking ${claims.length} claims...\n`);

  const results: FactCheckResult[] = [];
  const queue = [...claims];

  // Process with concurrency limit
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, claims.length); i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const claim = queue.shift();
          if (!claim) break;

          onProgress?.(`  Checking: "${claim.claim.slice(0, 60)}..."\n`);
          const result = await verifySingleClaim(claim, signal);
          results.push(result);
          onProgress?.(
            `  Result: ${result.verdict.toUpperCase()} (confidence: ${Math.round(result.confidence * 100)}%, source agreement: ${result.sourceAgreement}%)\n`
          );
        }
      })()
    );
  }

  await Promise.all(workers);
  return results;
}

// ─────────────────────────────────────────────────────────────
// Flag unusual claims or authority issues
// ─────────────────────────────────────────────────────────────

export function flagUnlikelyExperts(findings: ResearchFindings): FlaggedClaim[] {
  const flags: FlaggedClaim[] = [];
  let flagId = 0;

  // Flag social media as source for technical claims
  findings.whereAudienceCongregates?.forEach((source) => {
    if (
      /reddit|facebook|twitter|tiktok|instagram/i.test(source) &&
      (findings.objections?.some((o) => /scientific|clinical|medical/i.test(o.objection)) ||
        findings.competitivePositioning?.some((c) => /efficacy|safety|study/i.test(c.positioning)))
    ) {
      flags.push({
        claimId: `flag-authority-${flagId++}`,
        claim: `Source authority mismatch: ${source} for technical/medical claims`,
        flag: 'low-authority',
        reason: `${source} may not be authoritative for medical/scientific claims`,
        recommendation: 'Verify technical claims with academic or official sources',
        severity: 'high',
      });
    }
  });

  // Flag review sites for product specs
  if (findings.competitivePositioning) {
    findings.competitivePositioning.forEach((comp) => {
      if (/specification|standard|iso|fda|regulation/i.test(comp.positioning)) {
        flags.push({
          claimId: `flag-attribution-${flagId++}`,
          claim: `Regulatory claim without attribution: ${comp.positioning.slice(0, 50)}...`,
          flag: 'requires-attribution',
          reason: 'Regulatory/standard claims must cite official sources',
          recommendation: 'Add specific regulation name or official source reference',
          severity: 'high',
        });
      }
    });
  }

  // Flag statistical claims without source
  findings.objections?.forEach((obj, idx) => {
    if (/\d+%|[\d.,]+\s*(million|billion|thousand|people|customer)/.test(obj.objection)) {
      flags.push({
        claimId: `flag-stats-${flagId++}`,
        claim: obj.objection,
        flag: 'requires-attribution',
        reason: 'Statistical claims require proper citation',
        recommendation: 'Include source (e.g., "71% of customers (Capterra, 2024)")',
        severity: 'medium',
      });
    }
  });

  return flags;
}

// ─────────────────────────────────────────────────────────────
// Build complete fact check report
// ─────────────────────────────────────────────────────────────

export async function factCheckFindings(
  findings: ResearchFindings,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<FactCheckReport> {
  const startTime = Date.now();

  onProgress?.('\n════════════════════════════════════════════════════════════════════\n');
  onProgress?.('[FACT CHECK] Validating research claims\n');
  onProgress?.('════════════════════════════════════════════════════════════════════\n\n');

  // Extract claimables
  const claims = extractClaimables(findings);
  onProgress?.(`Extracted ${claims.length} verifiable claims\n\n`);

  // Verify claims
  const checkedClaims = await verifyClaimsInBatch(claims, onProgress, signal, 2);

  // Flag problematic sources
  const flaggedClaims = flagUnlikelyExperts(findings);

  // Calculate credibility metrics
  const verifiedCount = checkedClaims.filter((c) => c.verdict === 'verified').length;
  const disputedCount = checkedClaims.filter((c) => c.verdict === 'disputed').length;
  const unverifiedCount = checkedClaims.filter((c) => c.verdict === 'unverified').length;

  // Weight credibility by claim confidence + source agreement
  const weightedConfidence =
    checkedClaims.length > 0
      ? Math.round(
          (checkedClaims.reduce((sum, c) => {
            const verdict_weight = c.verdict === 'verified' ? 1 : c.verdict === 'disputed' ? 0 : 0.3;
            return sum + c.confidence * c.sourceAgreement * verdict_weight;
          }, 0) /
            checkedClaims.length) *
            100
        )
      : 75;

  const report: FactCheckReport = {
    checkedClaims,
    totalClaimsChecked: checkedClaims.length,
    verifiedCount,
    disputedCount,
    unverifiedCount,
    overallCredibility: Math.min(100, Math.max(0, weightedConfidence)),
    flaggedClaims,
    uncheckedClaims: {
      ids: [],
      reasons: [],
    },
    completedAt: Date.now(),
    processingTimeMs: Date.now() - startTime,
    checkerModel: 'qwen3.5:4b',
    validatorModel: 'qwen3.5:2b',
  };

  onProgress?.(`\n════════════════════════════════════════════════════════════════════\n`);
  onProgress?.(
    `FACT CHECK COMPLETE: ${verifiedCount} verified, ${disputedCount} disputed, ${unverifiedCount} unverified\n`
  );
  onProgress?.(`Overall Credibility: ${report.overallCredibility}%\n`);
  onProgress?.(`Processing time: ${report.processingTimeMs}ms\n`);
  onProgress?.(`════════════════════════════════════════════════════════════════════\n\n`);

  return report;
}
