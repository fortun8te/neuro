// ══════════════════════════════════════════════════════
// ██  Competitive Intelligence Utility
// Scrapes competitor pages via Wayfarer, extracts profiles
// using qwen3.5:4b, identifies gaps and opportunities.
// ══════════════════════════════════════════════════════

import { wayfayerService } from './wayfayer';
import { ollamaService } from './ollama';
import type { CompetitorProfile, CompetitiveMatrix, CompetitiveInsight } from '../types/competitive';

// ── Constants ─────────────────────────────────────────

const ANALYSIS_MODEL = 'qwen3.5:4b';
const ANALYSIS_TIMEOUT_MS = 90_000;

// ── Helpers ───────────────────────────────────────────

/** Extract a clean domain name from a URL */
function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0];
  }
}

/** Extract brand name from domain */
function brandFromDomain(domain: string): string {
  return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Parse a JSON block from LLM output, falling back to a default */
function parseJsonBlock<T>(text: string, fallback: T): T {
  // Try to find a JSON object/array in the output
  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ||
                    text.match(/\{[\s\S]+\}/) ;
  if (!jsonMatch) return fallback;
  const raw = jsonMatch[1] ?? jsonMatch[0];
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Determine price point label from price text */
function classifyPricePoint(priceText: string): CompetitorProfile['pricePoint'] {
  const lower = priceText.toLowerCase();
  if (lower.includes('luxury') || (lower.includes('premium') && lower.includes('high-end'))) return 'luxury';
  if (lower.includes('premium') || lower.includes('high-end') || lower.includes('expensive')) return 'premium';
  if (lower.includes('budget') || lower.includes('cheap') || lower.includes('affordable') || lower.includes('low-cost')) return 'budget';
  return 'mid';
}

/** Build a threat level (0–3) from strengths / weaknesses arrays */
function inferThreatLevel(
  strengths: string[],
  weaknesses: string[],
  channels: string[]
): CompetitorProfile['threatLevel'] {
  let score = 0;
  if (strengths.length >= 4) score += 1;
  if (weaknesses.length <= 1) score += 1;
  if (channels.length >= 4) score += 1;
  return Math.min(score, 3) as CompetitorProfile['threatLevel'];
}

// ── Core Functions ────────────────────────────────────

/**
 * Scrape a competitor URL via Wayfarer and extract a structured
 * CompetitorProfile using qwen3.5:4b.
 *
 * Falls back gracefully to a stub profile on any error so callers
 * always receive a typed value.
 */
export async function analyzeCompetitor(
  url: string,
  signal?: AbortSignal
): Promise<CompetitorProfile> {
  const domain = extractDomain(url);
  const name = brandFromDomain(domain);

  // Build a stub so we have something to return on failure
  const stub: CompetitorProfile = {
    name,
    domain,
    positioning: '',
    targetAudience: '',
    keyMessages: [],
    pricePoint: 'mid',
    channels: [],
    strengths: [],
    weaknesses: [],
    visualStyle: '',
    ctaStyle: '',
    recentActivity: [],
    threatLevel: 0,
  };

  // ── 1. Scrape competitor page via Wayfarer ──
  let pageContent = '';
  try {
    const result = await wayfayerService.research(
      `site:${domain} OR "${name}" product positioning pricing marketing`,
      8,
      signal
    );
    pageContent = result.text?.slice(0, 6000) ?? '';

    // Also scrape the root domain directly
    const homepageQuery = `"${name}" official site features pricing`;
    const hp = await wayfayerService.research(homepageQuery, 5, signal);
    pageContent += '\n\n' + (hp.text?.slice(0, 4000) ?? '');
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // Wayfarer failed — proceed with empty content; LLM will extract minimal info
    pageContent = `Unable to scrape ${domain}. Limited information available.`;
  }

  if (!pageContent.trim()) {
    return { ...stub, weaknesses: ['No public information available'] };
  }

  // ── 2. Extract structured profile via qwen3.5:4b ──
  const systemPrompt = `You are a competitive intelligence analyst. Extract a precise competitor profile from the provided page content.
Return ONLY valid JSON matching this schema exactly — no prose, no markdown outside the code block:

\`\`\`json
{
  "positioning": "one-sentence core brand claim",
  "targetAudience": "who they target",
  "keyMessages": ["message 1", "message 2", "message 3"],
  "pricePoint": "budget|mid|premium|luxury",
  "channels": ["channel1", "channel2"],
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "visualStyle": "description of visual brand style",
  "ctaStyle": "how their CTAs are worded",
  "recentActivity": ["recent initiative 1", "recent initiative 2"]
}
\`\`\`

Rules:
- Extract only information that is ACTUALLY in the content. Do not guess or hallucinate.
- If a field cannot be determined, use an empty string or empty array.
- pricePoint must be exactly one of: budget, mid, premium, luxury
- Be concise — each string should be under 120 characters.`;

  const userPrompt = `Competitor domain: ${domain}
Brand name: ${name}

Page content:
${pageContent}

Extract the competitor profile JSON.`;

  let profileData: Partial<CompetitorProfile> = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    const mergedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    const raw = await ollamaService.generateStream(userPrompt, systemPrompt, {
      model: ANALYSIS_MODEL,
      temperature: 0.2,
      num_ctx: 8192,
      signal: mergedSignal,
    });
    clearTimeout(timeout);

    profileData = parseJsonBlock<Partial<CompetitorProfile>>(raw, {});
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // LLM failed — return stub
    return stub;
  }

  // ── 3. Merge extracted data with defaults ──
  const channels = Array.isArray(profileData.channels) ? profileData.channels : [];
  const strengths = Array.isArray(profileData.strengths) ? profileData.strengths : [];
  const weaknesses = Array.isArray(profileData.weaknesses) ? profileData.weaknesses : [];

  let pricePoint: CompetitorProfile['pricePoint'] = 'mid';
  if (profileData.pricePoint && ['budget', 'mid', 'premium', 'luxury'].includes(profileData.pricePoint as string)) {
    pricePoint = profileData.pricePoint as CompetitorProfile['pricePoint'];
  } else if (typeof profileData.pricePoint === 'string') {
    pricePoint = classifyPricePoint(profileData.pricePoint);
  }

  const profile: CompetitorProfile = {
    name,
    domain,
    positioning: profileData.positioning ?? '',
    targetAudience: profileData.targetAudience ?? '',
    keyMessages: Array.isArray(profileData.keyMessages) ? profileData.keyMessages : [],
    pricePoint,
    channels,
    strengths,
    weaknesses,
    visualStyle: profileData.visualStyle ?? '',
    ctaStyle: profileData.ctaStyle ?? '',
    recentActivity: Array.isArray(profileData.recentActivity) ? profileData.recentActivity : [],
    threatLevel: inferThreatLevel(strengths, weaknesses, channels),
  };

  return profile;
}

/**
 * Build a CompetitiveMatrix from a set of scraped competitor profiles.
 *
 * Uses qwen3.5:4b to synthesize market gaps, opportunities, and direct threats
 * based on all profiles plus existing research findings.
 */
export async function buildCompetitiveMatrix(
  brand: string,
  competitors: CompetitorProfile[],
  findings: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<CompetitiveMatrix> {
  // Base matrix — gaps/opportunities derived locally if LLM fails
  const base: CompetitiveMatrix = {
    brand,
    competitors,
    marketGaps: [],
    positioningOpportunities: [],
    directThreats: [],
    timestamp: Date.now(),
  };

  if (competitors.length === 0) return base;

  // ── Synthesize with LLM ──
  const competitorSummary = competitors
    .map(c =>
      `- ${c.name} (${c.domain}): ${c.positioning || 'unknown positioning'} | ${c.pricePoint} price | strengths: ${c.strengths.slice(0, 2).join(', ')} | weaknesses: ${c.weaknesses.slice(0, 2).join(', ')}`
    )
    .join('\n');

  const extraContext = findings.competitorWeaknesses
    ? `Known competitor weaknesses from research: ${(findings.competitorWeaknesses as string[]).slice(0, 5).join('; ')}`
    : '';

  const systemPrompt = `You are a strategic positioning analyst. Based on competitor profiles and research findings, identify market gaps and opportunities for the brand.
Return ONLY valid JSON:

\`\`\`json
{
  "marketGaps": ["gap 1", "gap 2", "gap 3"],
  "positioningOpportunities": ["opportunity 1", "opportunity 2"],
  "directThreats": ["threat 1", "threat 2"]
}
\`\`\`

Rules:
- marketGaps: Segments, price points, or messaging angles NO competitor owns
- positioningOpportunities: Specific ways the brand can differentiate (be concrete)
- directThreats: Competitor names or positions that most directly compete with the brand
- Be specific and actionable. No generic advice.`;

  const userPrompt = `Brand: ${brand}

Competitors:
${competitorSummary}

${extraContext}

Identify the market gaps, positioning opportunities, and direct threats.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    const mergedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    const raw = await ollamaService.generateStream(userPrompt, systemPrompt, {
      model: ANALYSIS_MODEL,
      temperature: 0.3,
      num_ctx: 6144,
      signal: mergedSignal,
    });
    clearTimeout(timeout);

    const parsed = parseJsonBlock<{
      marketGaps?: string[];
      positioningOpportunities?: string[];
      directThreats?: string[];
    }>(raw, {});

    base.marketGaps = Array.isArray(parsed.marketGaps) ? parsed.marketGaps : [];
    base.positioningOpportunities = Array.isArray(parsed.positioningOpportunities) ? parsed.positioningOpportunities : [];
    base.directThreats = Array.isArray(parsed.directThreats) ? parsed.directThreats : [];
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // Fall back to locally-derived gaps
    base.marketGaps = deriveGapsLocally(competitors);
  }

  base.timestamp = Date.now();
  return base;
}

/** Derive basic gaps without LLM (fallback) */
function deriveGapsLocally(competitors: CompetitorProfile[]): string[] {
  const gaps: string[] = [];
  const pricePoints = competitors.map(c => c.pricePoint);

  if (!pricePoints.includes('budget')) gaps.push('No budget-friendly competitor in this space');
  if (!pricePoints.includes('luxury')) gaps.push('No luxury/premium-tier competitor');
  if (competitors.every(c => c.weaknesses.length > 1)) {
    gaps.push('All competitors share common weaknesses — opportunity to lead on that axis');
  }

  return gaps;
}

/**
 * Generate CompetitiveInsights from a matrix.
 * All insights are derived from actual data in the matrix — no hallucination.
 */
export function identifyGaps(matrix: CompetitiveMatrix): CompetitiveInsight[] {
  const insights: CompetitiveInsight[] = [];

  // Gap insights from marketGaps
  matrix.marketGaps.forEach(gap => {
    insights.push({
      type: 'gap',
      description: gap,
      confidence: 0.75,
      sources: matrix.competitors.map(c => c.domain),
      actionable: true,
      recommendation: `Consider positioning ${matrix.brand} to fill this gap: ${gap}`,
    });
  });

  // Opportunity insights from positioningOpportunities
  matrix.positioningOpportunities.forEach(opp => {
    insights.push({
      type: 'opportunity',
      description: opp,
      confidence: 0.70,
      sources: matrix.competitors.map(c => c.domain),
      actionable: true,
      recommendation: opp,
    });
  });

  // Threat insights from directThreats
  matrix.directThreats.forEach(threat => {
    insights.push({
      type: 'threat',
      description: threat,
      confidence: 0.80,
      sources: matrix.competitors.map(c => c.domain),
      actionable: true,
      recommendation: `Monitor and differentiate from: ${threat}`,
    });
  });

  // Common weakness patterns across competitors
  const allWeaknesses: Record<string, number> = {};
  matrix.competitors.forEach(c =>
    c.weaknesses.forEach(w => {
      const key = w.toLowerCase().slice(0, 40);
      allWeaknesses[key] = (allWeaknesses[key] ?? 0) + 1;
    })
  );

  Object.entries(allWeaknesses)
    .filter(([, count]) => count >= 2)
    .forEach(([w]) => {
      insights.push({
        type: 'gap',
        description: `Multiple competitors share this weakness: "${w}"`,
        confidence: 0.85,
        sources: matrix.competitors
          .filter(c => c.weaknesses.some(wk => wk.toLowerCase().includes(w)))
          .map(c => c.domain),
        actionable: true,
        recommendation: `${matrix.brand} can differentiate by excelling where competitors fail at: ${w}`,
      });
    });

  return insights;
}

/**
 * Rank competitors by threat level (descending).
 * Ties broken by number of strengths.
 */
export function rankThreats(matrix: CompetitiveMatrix): CompetitorProfile[] {
  return [...matrix.competitors].sort((a, b) => {
    if (b.threatLevel !== a.threatLevel) return b.threatLevel - a.threatLevel;
    return b.strengths.length - a.strengths.length;
  });
}

/**
 * Generate concrete positioning recommendations for the brand
 * based on the competitive matrix.
 * Returns a string array — all grounded in the matrix data.
 */
export function generatePositioningRecommendations(matrix: CompetitiveMatrix): string[] {
  const recs: string[] = [];

  // Use identified gaps
  matrix.marketGaps.slice(0, 3).forEach(gap => {
    recs.push(`Own the gap: ${gap}`);
  });

  // Use positioning opportunities
  matrix.positioningOpportunities.slice(0, 3).forEach(opp => {
    recs.push(opp);
  });

  // Analyze channel coverage
  const allChannels = new Set(matrix.competitors.flatMap(c => c.channels));
  const commonChannels = ['Instagram', 'TikTok', 'YouTube', 'Google', 'Facebook', 'Email'];
  const unusedChannels = commonChannels.filter(ch =>
    !Array.from(allChannels).some(ac => ac.toLowerCase().includes(ch.toLowerCase()))
  );
  if (unusedChannels.length > 0) {
    recs.push(`Competitors are absent on: ${unusedChannels.join(', ')} — opportunity to own those channels`);
  }

  // Pricing differentiation
  const pricePoints = matrix.competitors.map(c => c.pricePoint);
  if (!pricePoints.includes('mid') && pricePoints.includes('premium') && pricePoints.includes('budget')) {
    recs.push('Significant mid-market gap — position as the premium-quality, accessible option');
  }

  // Highlight repeated weaknesses shared across competitors
  const allCompetitorWeaknesses = matrix.competitors.flatMap(c => c.weaknesses);
  const repeatedWeaknesses = allCompetitorWeaknesses.filter(
    (w, i) => allCompetitorWeaknesses.findIndex(x => x.toLowerCase() === w.toLowerCase()) === i && allCompetitorWeaknesses.some((x, j) => j !== i && x.toLowerCase() === w.toLowerCase())
  );
  if (repeatedWeaknesses.length > 0) {
    recs.push(`Differentiate on: ${repeatedWeaknesses[0]} — all competitors fail here`);
  }

  return recs.filter(Boolean).slice(0, 8);
}

/**
 * Convert market gaps to high-priority research topics
 * for injection into the research orchestrator.
 */
export function matrixToResearchTopics(matrix: CompetitiveMatrix): string[] {
  const topics: string[] = [];

  matrix.marketGaps.forEach(gap => {
    topics.push(`Explore market gap: ${gap}`);
  });

  matrix.directThreats.forEach(threat => {
    topics.push(`Deep-dive competitor threat: ${threat}`);
  });

  matrix.positioningOpportunities.forEach(opp => {
    topics.push(`Validate positioning opportunity: ${opp}`);
  });

  return topics.slice(0, 6); // Cap to avoid overwhelming the orchestrator
}
