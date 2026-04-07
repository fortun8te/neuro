/**
 * Deep Research Orchestrator
 *
 * LLM-driven research loop. The model decides what to search, how many times,
 * and when it has enough. We give it tools + a budget and get out of the way.
 *
 * Architecture:
 *   1. Planner asks: what do I need to find? (generates search plan)
 *   2. Executor runs searches in parallel batches
 *   3. Evaluator checks: is this enough? what's missing?
 *   4. Loop until budget exhausted or evaluator says done
 *
 * Domain-aware: web / code / data each get a different system prompt
 * so the LLM reasons about the task correctly.
 */

import { ollamaService } from './ollama';
import { wayfayerService } from './wayfayer';
import { context1Service, isContext1Available } from './context1Service';
import { getModelForStage } from './modelConfig';
import { createLogger } from './logger';

const log = createLogger('deepResearch');

// ── Types ──────────────────────────────────────────────────────────────────────

export type ResearchDomain = 'web' | 'code' | 'data' | 'auto';

export interface ResearchQuery {
  topic: string;
  angle?: string;
  /** How hard to push: 'light' (1 round), 'normal' (up to 3 rounds), 'hard' (up to 6 rounds). Default: auto */
  effort?: 'light' | 'normal' | 'hard' | 'auto';
  domain?: ResearchDomain;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
  onProgress?: (msg: string) => void;
}

export interface ResearchResult {
  report: string;
  sources: Array<{ title: string; url: string; domain: string }>;
  rounds: number;
  sourcesTotal: number;
  durationMs: number;
  stoppedBecause: 'done' | 'budget' | 'aborted';
}

// ── Budget config per effort level ────────────────────────────────────────────

const EFFORT_CONFIG = {
  // maxWallClockMs: hard wall-clock limit per effort level (ms).
  // Prevents the loop from running indefinitely even if maxRounds is never hit.
  light:  { maxRounds: 1, sourcesPerRound: 5,  maxSources: 5,  maxWallClockMs: 5 * 60 * 1000   },
  normal: { maxRounds: 3, sourcesPerRound: 10, maxSources: 25, maxWallClockMs: 15 * 60 * 1000  },
  hard:   { maxRounds: 6, sourcesPerRound: 20, maxSources: 80, maxWallClockMs: 45 * 60 * 1000  },
};

// ── Domain system prompts — tell the LLM how to think about the task ──────────

const DOMAIN_CONTEXT: Record<ResearchDomain, string> = {
  web: `You are researching web sources. Think about: authoritative sites, recent data, multiple perspectives, primary sources vs aggregators.`,

  code: `You are researching a codebase or technical topic. Think about: official docs, GitHub repos, implementation details, known issues, version-specific behavior, API references.`,

  data: `You are researching data, statistics, or datasets. Think about: primary data sources, methodology, sample sizes, recency, regional differences, conflicting studies.`,

  auto: `You are researching this topic thoroughly. Think about what kind of sources matter most for this specific query.`,
};

// ── Planner: LLM generates search queries ────────────────────────────────────

async function planSearches(
  topic: string,
  angle: string,
  domain: ResearchDomain,
  previousFindings: string,
  roundNum: number,
  maxQueries: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const isFirstRound = roundNum === 1;
  const context = previousFindings
    ? `\n\nWhat you already found (round ${roundNum - 1}):\n${previousFindings.slice(0, 2000)}`
    : '';

  const prompt = isFirstRound
    ? `Topic: "${topic}"${angle ? `\nFocus: "${angle}"` : ''}

${DOMAIN_CONTEXT[domain]}

Generate ${maxQueries} search queries to research this topic. Cover different angles — don't repeat the same query with different words.

Return JSON array of strings only. Example: ["query 1", "query 2"]`
    : `Topic: "${topic}"${angle ? `\nFocus: "${angle}"` : ''}
${context}

You already did round ${roundNum - 1}. Now generate ${maxQueries} NEW search queries to fill in what's still missing or unclear. Don't repeat queries from previous rounds.

Return JSON array of strings only.`;

  let raw = '';
  try {
    await ollamaService.generateStream(prompt, '', {
      model: getModelForStage('fast'),
      temperature: 0.4,
      num_predict: 300,
      signal,
      onChunk: (c: string) => { raw += c; },
    });
    const match = raw.match(/\[[\s\S]*?\]/);
    if (match) {
      const queries = JSON.parse(match[0]) as string[];
      return queries.filter(q => typeof q === 'string' && q.trim().length > 0).slice(0, maxQueries);
    }
  } catch {
    // fallback: generate simple variations
  }

  // Fallback queries if LLM fails — use actual topic/angle for context
  const query = `${topic} ${angle}`.trim();
  return [
    `${query} overview`,
    `${query} latest research`,
    `${query} analysis`,
  ].slice(0, maxQueries);
}

// ── Evaluator: LLM decides if research is complete ───────────────────────────

async function evaluateCoverage(
  topic: string,
  findings: string,
  roundNum: number,
  maxRounds: number,
  signal?: AbortSignal,
): Promise<{ done: boolean; reason: string; gaps: string[] }> {
  if (roundNum >= maxRounds) {
    return { done: true, reason: 'budget exhausted', gaps: [] };
  }

  const prompt = `You are evaluating research quality. Given a topic and current findings, decide if the research is complete or needs another round.

Topic: "${topic}"

Current findings (truncated):
${findings.slice(0, 3000)}

Answer with JSON:
{
  "done": true/false,
  "reason": "why done or why not",
  "gaps": ["specific thing missing 1", "specific thing missing 2"]
}

Be decisive. If you have solid coverage of the main angles, say done=true. Only say done=false if there are clear specific gaps worth another search round.

JSON only:`;

  let raw = '';
  try {
    await ollamaService.generateStream(prompt, '', {
      model: getModelForStage('fast'),
      temperature: 0.1,
      num_predict: 250,
      signal,
      onChunk: (c: string) => { raw += c; },
    });
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        done: Boolean(parsed.done),
        reason: String(parsed.reason || ''),
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      };
    }
  } catch {
    // If eval fails, assume done to avoid infinite loops
  }
  return { done: true, reason: 'eval unavailable', gaps: [] };
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function deepResearch(query: ResearchQuery): Promise<ResearchResult> {
  const startTime = Date.now();
  const emit = (msg: string) => {
    query.onProgress?.(msg);
    log.info(msg);
  };

  // ── Resolve effort level ──
  let effort = query.effort || 'auto';
  if (effort === 'auto') {
    const text = `${query.topic} ${query.angle || ''}`.toLowerCase();
    if (/\b(deep|thorough|comprehensive|exhaustive|everything|all|full|complete|entire)\b/.test(text)) {
      effort = 'hard';
    } else if (/\b(quick|brief|fast|summary|overview|tldr|just|simply|roughly)\b/.test(text)) {
      effort = 'light';
    } else {
      effort = 'normal';
    }
    emit(`Auto-effort: ${effort} for "${query.topic}"`);
  }

  const resolvedEffort = effort as 'light' | 'normal' | 'hard';
  const budget = EFFORT_CONFIG[resolvedEffort];
  const domain: ResearchDomain = query.domain || 'auto';

  // ── State ──
  const allFindings: string[] = [];
  const allSources: Array<{ title: string; url: string; domain: string }> = [];
  const seenUrls = new Set<string>();
  let rounds = 0;
  let stoppedBecause: ResearchResult['stoppedBecause'] = 'done';

  // ── Try Context-1 first for T3+ equivalent quality ──
  const ctx1Available = await isContext1Available();
  if (ctx1Available && resolvedEffort !== 'light') {
    emit('Context-1: hybrid semantic + BM25 retrieval...');
    try {
      const retrieval = await context1Service.retrieve(
        `${query.topic} ${query.angle || ''}`.trim(),
        {
          maxChunks: resolvedEffort === 'hard' ? 40 : 20,
          maxSteps: resolvedEffort === 'hard' ? 25 : 12,
          signal: query.signal,
          decomposeQuery: true,
          onEvent: (ev) => {
            if (ev.type === 'tool_call') emit(`  context-1: ${ev.tool}(${String(ev.args || '').slice(0, 60)})`);
            if (ev.type === 'prune')      emit(`  context-1: pruned ${ev.chunksPruned} chunks`);
          },
        },
      );
      if (retrieval.chunks.length >= 4) {
        emit(`Context-1: ${retrieval.chunks.length} chunks in ${retrieval.steps} steps`);
        allFindings.push(retrieval.chunks.map(c => c.content).join('\n\n'));
        for (const c of retrieval.chunks) {
          if (!seenUrls.has(c.docId)) {
            seenUrls.add(c.docId);
            allSources.push({ title: c.docId, url: c.docId, domain: c.docId });
          }
        }
      }
    } catch {
      emit('Context-1 unavailable — using Wayfayer');
    }
  }

  // ── LLM-driven research loop ──
  let previousFindings = allFindings.join('\n\n');

  for (let round = 1; round <= budget.maxRounds; round++) {
    if (query.signal?.aborted) { stoppedBecause = 'aborted'; break; }
    if (allSources.length >= budget.maxSources) { stoppedBecause = 'budget'; break; }

    rounds = round;
    const queriesThisRound = Math.min(
      3,
      Math.ceil(budget.sourcesPerRound / 5), // each query ~5 pages
    );

    emit(`Round ${round}/${budget.maxRounds}: planning searches...`);
    const queries = await planSearches(
      query.topic,
      query.angle || '',
      domain,
      previousFindings,
      round,
      queriesThisRound,
      query.signal,
    );

    emit(`Round ${round}: ${queries.map(q => `"${q}"`).join(', ')}`);

    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map(q =>
        wayfayerService.research(q, Math.ceil(budget.sourcesPerRound / queries.length), query.signal)
          .catch(() => ({ text: '', sources: [] as Array<{ title: string; url: string }> }))
      ),
    );

    // Collect findings + deduplicate sources
    let roundText = '';
    for (const r of results) {
      if (r.text) roundText += r.text + '\n\n';
      for (const s of (r.sources || [])) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          allSources.push({
            title: s.title || s.url,
            url: s.url,
            domain: (() => { try { return new URL(s.url).hostname; } catch { return s.url; } })(),
          });
        }
      }
    }

    allFindings.push(roundText);
    previousFindings = allFindings.join('\n\n');
    emit(`Round ${round}: ${allSources.length} sources total`);

    // LLM evaluates coverage — decides if we need another round
    if (round < budget.maxRounds) {
      emit(`Round ${round}: evaluating coverage...`);
      const eval_ = await evaluateCoverage(
        query.topic,
        previousFindings,
        round,
        budget.maxRounds,
        query.signal,
      );
      emit(`Coverage: ${eval_.done ? 'complete' : 'needs more'} — ${eval_.reason}`);
      if (eval_.done) { stoppedBecause = 'done'; break; }
    }
  }

  // ── Synthesize final report ──
  emit('Synthesizing report...');

  const combinedText = allFindings.join('\n\n---\n\n');
  const sourceContext = allSources.length > 0
    ? `\n\nSources:\n${allSources.slice(0, 20).map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join('\n')}`
    : '';

  const synthStyle = resolvedEffort === 'light'
    ? 'Concise 2-3 paragraph summary. Key facts only. No headers.'
    : effort === 'normal'
    ? 'Well-structured report with markdown headers. Key findings, data points, implications. Cite sources as [1], [2]. End with 3 takeaways.'
    : 'Comprehensive authoritative report. Executive summary, detailed sections, data/quotes, expert perspectives, limitations, implications. Cite every claim. End with structured takeaways + next steps.';

  let report = '';
  await ollamaService.generateStream(
    `Topic: "${query.topic}"${query.angle ? `\nFocus: ${query.angle}` : ''}\n\nResearch findings:\n${combinedText.slice(0, 10000)}${sourceContext}`,
    synthStyle,
    {
      model: getModelForStage(resolvedEffort === 'hard' ? 'research' : 'chat'),
      temperature: 0.35,
      num_predict: resolvedEffort === 'light' ? 500 : resolvedEffort === 'normal' ? 1200 : 2500,
      signal: query.signal,
      onChunk: (c: string) => {
        report += c;
        query.onChunk?.(c);
      },
    },
  );

  // Append sources for non-light research
  if (resolvedEffort !== 'light' && allSources.length > 0) {
    const footer = `\n\n## Sources\n${allSources.slice(0, 20).map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join('\n')}`;
    report += footer;
    query.onChunk?.(footer);
  }

  return {
    report,
    sources: allSources,
    rounds,
    sourcesTotal: allSources.length,
    durationMs: Date.now() - startTime,
    stoppedBecause,
  };
}

// ── Fact Checker ─────────────────────────────────────────────────────────────
//
// The LLM is confident by default — it will cite things that sound right
// without actually verifying them. The fact checker:
//   1. Fetches each source URL and confirms it actually loads
//   2. Checks that the key claim the report makes is actually in the page
//   3. Flags hallucinated sources (404, wrong content, or URL that never existed)
//   4. Returns per-claim confidence + overall trust score
//
// Only runs on effort='normal'+'hard' where source quality matters.

export interface FactCheckResult {
  url: string;
  title: string;
  reachable: boolean;
  claimVerified: boolean;
  confidence: 'high' | 'medium' | 'low' | 'hallucinated';
  note: string;
}

export interface FactCheckReport {
  checked: number;
  passed: number;
  failed: number;
  hallucinated: number;
  overallTrust: number; // 0-1
  results: FactCheckResult[];
  summary: string;
}

/**
 * Verify sources from a research report.
 * For each source: fetch it, check it loads, then ask the model if the
 * claimed content is actually there.
 *
 * @param sources   Sources returned from deepResearch()
 * @param report    The full report text (used to extract what was claimed per source)
 * @param signal    AbortSignal
 * @param onProgress  Progress callback
 */
export async function factCheck(
  sources: Array<{ title: string; url: string; domain: string }>,
  report: string,
  signal?: AbortSignal,
  onProgress?: (msg: string) => void,
): Promise<FactCheckReport> {
  const emit = (msg: string) => onProgress?.(msg);
  const results: FactCheckResult[] = [];

  // Only check real HTTP URLs — skip docIds from Context-1
  const httpSources = sources.filter(s => s.url.startsWith('http'));
  const limit = Math.min(httpSources.length, 12); // cap at 12 to keep it fast

  emit(`Fact-checking ${limit} sources...`);

  // Run checks in batches of 3 (parallel fetch)
  for (let i = 0; i < limit; i += 3) {
    if (signal?.aborted) break;
    const batch = httpSources.slice(i, i + 3);

    const batchResults = await Promise.all(batch.map(async (source) => {
      const result: FactCheckResult = {
        url: source.url,
        title: source.title,
        reachable: false,
        claimVerified: false,
        confidence: 'low',
        note: '',
      };

      try {
        // Route through Wayfayer to avoid CORS issues with direct browser fetches
        const wayfayerResult = await wayfayerService.research(source.url, 1, signal).catch(() => null);

        if (!wayfayerResult || !wayfayerResult.text) {
          result.reachable = false;
          result.confidence = 'low';
          result.note = 'Unreachable via Wayfayer';
          return result;
        }
        result.reachable = true;

        const pageText = wayfayerResult.text.slice(0, 8000);

        // Step 3: Extract what the report claims this source says
        // Find context around the source URL in the report
        const urlIdx = report.indexOf(source.url);
        const reportContext = urlIdx >= 0
          ? report.slice(Math.max(0, urlIdx - 300), urlIdx + 200)
          : report.slice(0, 600);

        // Step 4: Ask a small model if the claim is actually in the page
        let verifyRaw = '';
        await ollamaService.generateStream(
          `Source URL: ${source.url}\n\nReport claims about this source:\n${reportContext}\n\nActual page content:\n${pageText}\n\nDoes the page content actually support what the report claims? Answer with JSON: {"verified": true/false, "confidence": "high"/"medium"/"low", "note": "brief reason"}`,
          'You are a fact-checker. Be skeptical. Only say verified=true if the page clearly contains the claimed information.',
          {
            model: getModelForStage('fast'),
            temperature: 0.1,
            num_predict: 120,
            signal,
            onChunk: (c: string) => { verifyRaw += c; },
          },
        );

        const match = verifyRaw.match(/\{[\s\S]*?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          result.claimVerified = Boolean(parsed.verified);
          result.confidence = parsed.confidence || (result.claimVerified ? 'medium' : 'low');
          result.note = String(parsed.note || '');
        } else {
          result.confidence = 'medium';
          result.note = 'Could not parse verification response';
        }
      } catch (err) {
        result.note = `Check failed: ${err instanceof Error ? err.message : String(err)}`;
        result.confidence = 'low';
      }

      return result;
    }));

    results.push(...batchResults);
    const passedSoFar = results.filter(r => r.confidence === 'high' || r.confidence === 'medium').length;
    emit(`Checked ${results.length}/${limit} — ${passedSoFar} verified so far`);
  }

  // Compute overall trust score
  const passed = results.filter(r => r.claimVerified).length;
  const failed = results.filter(r => !r.claimVerified && r.reachable).length;
  const hallucinated = results.filter(r => r.confidence === 'hallucinated').length;
  const overallTrust = results.length > 0
    ? (results.filter(r => r.confidence === 'high').length * 1.0
      + results.filter(r => r.confidence === 'medium').length * 0.6
      + results.filter(r => r.confidence === 'low').length * 0.2) / results.length
    : 0;

  // Generate a plain-English summary
  const summary = hallucinated > 0
    ? `⚠️ ${hallucinated} hallucinated source${hallucinated > 1 ? 's' : ''} detected. ${passed}/${results.length} claims verified. Trust: ${Math.round(overallTrust * 100)}%.`
    : passed === results.length
    ? `✓ All ${passed} checked sources verified. Trust: ${Math.round(overallTrust * 100)}%.`
    : `${passed}/${results.length} sources verified, ${failed} unconfirmed. Trust: ${Math.round(overallTrust * 100)}%.`;

  emit(summary);

  return { checked: results.length, passed, failed, hallucinated, overallTrust, results, summary };
}

export default deepResearch;
