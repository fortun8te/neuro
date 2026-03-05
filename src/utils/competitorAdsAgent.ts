/**
 * Competitor Ad Intelligence Agent
 * Lightweight free version of Foreplay-style competitor ad analysis.
 *
 * Sources (all free, no API key needed):
 *   - Facebook Ad Library public website (screenshot → minicpm-v)
 *   - SearXNG queries for ad examples, Reddit teardowns, ad spy posts
 *
 * Output: CompetitorAdIntelligence stored in ResearchFindings
 */

import { ollamaService } from './ollama';
import { wayfarerService, screenshotService } from './wayfarer';
import { analyzeImageWithVision } from './visualScoutAgent';
import { hasMetaApiCredentials, fetchAdsFromLibrary, estimateLongevity } from './metaAdLibrary';
import type { Campaign, ResearchFindings, CompetitorAdIntelligence, CompetitorProfile, AdExample } from '../types';

const ORCHESTRATOR_MODEL = 'glm-4.7-flash:q4_K_M';
const MAX_COMPETITORS = 4;
const MAX_TEXT_PER_COMPETITOR = 6000; // chars fed to GLM for extraction

// ─── Competitor name extraction ────────────────────────────────────────────

async function extractCompetitorNames(
  campaign: Campaign,
  findings: ResearchFindings,
  signal?: AbortSignal
): Promise<string[]> {
  const weaknessText = findings.competitorWeaknesses.slice(0, 10).join('\n');
  if (!weaknessText.trim()) return [];

  const prompt = `From this competitor analysis for the brand "${campaign.brand}" (product: ${campaign.productDescription}), extract the names of competing brands mentioned.

COMPETITOR ANALYSIS:
${weaknessText}

Return ONLY a JSON array of brand name strings, maximum 5. Example: ["BrandA", "BrandB", "BrandC"]
Return only the JSON array, nothing else.`;

  try {
    const result = await ollamaService.generateStream(
      prompt,
      'Extract competitor brand names. Return only a JSON array of strings.',
      { model: ORCHESTRATOR_MODEL, signal }
    );

    // Try to parse JSON array
    const match = result.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((n): n is string => typeof n === 'string' && n.length > 1).slice(0, MAX_COMPETITORS);
      }
    }
  } catch {
    // Fallback: regex extract quoted names or capitalised words from weaknesses
  }

  // Fallback: extract capitalised multi-word phrases that look like brand names
  const fallbackNames = new Set<string>();
  for (const line of findings.competitorWeaknesses) {
    const matches = line.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/g) || [];
    for (const m of matches) {
      if (m !== campaign.brand && m.length > 2 && !['The', 'They', 'Their', 'This', 'These', 'That'].includes(m)) {
        fallbackNames.add(m);
      }
    }
  }
  return [...fallbackNames].slice(0, MAX_COMPETITORS);
}

// ─── Per-competitor scraping ────────────────────────────────────────────────

async function scrapeCompetitorAdData(
  brand: string,
  campaign: Campaign,
  onProgress: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; visualAnalysis: string; activeAdsCount?: number }> {
  onProgress(`  [Ads] Fetching "${brand}" ad intelligence...\n`);

  // ──── Try Meta Ad Library API first (if credentials available) ────
  if (hasMetaApiCredentials) {
    try {
      const apiAds = await fetchAdsFromLibrary(brand, 30, signal);

      if (apiAds.length > 0) {
        onProgress(`  [Ads] Meta API: ${apiAds.length} ads found for "${brand}"\n`);

        // Format API data as text for GLM extraction
        const apiText = apiAds
          .map((ad, i) => {
            const copy = ad.ad_creative_bodies?.[0] || '';
            const headline = ad.ad_creative_link_titles?.[0] || '';
            const longevity = estimateLongevity(ad);

            return [
              `Ad ${i + 1}:`,
              headline ? `Headline: ${headline}` : '',
              copy ? `Copy: ${copy}` : '',
              longevity ? `Running: ${longevity}` : '',
              ad.ad_snapshot_url ? `Source: ${ad.ad_snapshot_url}` : '',
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n---\n\n')
          .slice(0, MAX_TEXT_PER_COMPETITOR);

        // Vision analysis: screenshot top 2-3 ad snapshots
        let visualAnalysis = '';
        const snapshotUrls = apiAds
          .filter(a => a.ad_snapshot_url)
          .slice(0, 3)
          .map(a => a.ad_snapshot_url!);

        if (snapshotUrls.length > 0) {
          onProgress(`  [Ads] Vision analyzing ${snapshotUrls.length} ad creatives for "${brand}"...\n`);
          const visionResults: string[] = [];

          for (const url of snapshotUrls) {
            if (signal?.aborted) break;
            try {
              const ss = await screenshotService.screenshot(url);
              if (ss.image_base64 && !ss.error) {
                const analysis = await analyzeImageWithVision(
                  ss.image_base64,
                  `This is a Facebook ad creative for the brand "${brand}".
Analyze the visual style, colors, copy layout, CTA, emotional tone, and what makes this ad effective or not. Be specific and concise.`,
                  signal
                );
                if (analysis) visionResults.push(analysis);
              }
            } catch {
              // skip individual screenshot errors
            }
          }

          visualAnalysis = visionResults.join('\n\n---\n\n');
        }

        return { text: apiText, visualAnalysis, activeAdsCount: apiAds.length };
      }
    } catch (err) {
      onProgress(`  [Ads] Meta API error for "${brand}" — falling back to scraping\n`);
    }
  }

  // ──── Fallback: Web scraping + FB Ad Library screenshot ────
  const fbLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(brand)}`;

  // Run web scraping and screenshot in parallel
  const [webResult1, webResult2, screenshot] = await Promise.allSettled([
    wayfarerService.research(`"${brand}" facebook ad examples copy hook 2025`, 15),
    wayfarerService.research(`"${brand}" ad creative breakdown instagram ads`, 10),
    screenshotService.screenshot(fbLibraryUrl),
  ]);

  // Combine scraped text
  const textParts: string[] = [];
  if (webResult1.status === 'fulfilled') {
    textParts.push(webResult1.value.text.slice(0, 3000));
  }
  if (webResult2.status === 'fulfilled') {
    textParts.push(webResult2.value.text.slice(0, 2000));
  }
  const combinedText = textParts.join('\n\n---\n\n').slice(0, MAX_TEXT_PER_COMPETITOR);

  // Vision analysis of FB Ad Library screenshot
  let visualAnalysis = '';
  if (screenshot.status === 'fulfilled' && screenshot.value.image_base64 && !screenshot.value.error) {
    onProgress(`  [Ads] Running vision analysis on "${brand}" Ad Library screenshot...\n`);
    try {
      visualAnalysis = await analyzeImageWithVision(
        screenshot.value.image_base64,
        `This is the Facebook Ad Library page for the brand "${brand}".
The brand we're competing against them for is "${campaign.brand}" (${campaign.productDescription}).

Analyze what you can see:
1. How many ads are visible / running? (estimate count from the cards shown)
2. What visual styles are they using? (lifestyle, product-focused, testimonial, UGC?)
3. What copy angles or headlines are visible?
4. What CTAs are visible?
5. What emotional tone? (fear, aspiration, social proof, urgency?)
6. Any offers visible? (discounts, free trials, guarantees?)

Be specific about what you can actually see. If the page didn't load fully, say so.`,
        signal
      );
      onProgress(`  [Ads] "${brand}" Ad Library analyzed via vision\n`);
    } catch {
      onProgress(`  [Ads] Vision analysis skipped for "${brand}"\n`);
    }
  } else {
    onProgress(`  [Ads] "${brand}" Ad Library screenshot not available (JS-rendered)\n`);
  }

  return { text: combinedText, visualAnalysis };
}

// ─── GLM extraction of ad examples ─────────────────────────────────────────

function parseAdExamples(raw: string, sourceHint: string): AdExample[] {
  const examples: AdExample[] = [];
  const blocks = raw.split(/---+|\n(?=AD_COPY:)/i);

  for (const block of blocks) {
    const extract = (key: string): string => {
      const match = block.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 'si'));
      return match?.[1]?.trim() || '';
    };

    const adCopy = extract('AD_COPY');
    if (!adCopy || adCopy.length < 5) continue;

    examples.push({
      adCopy,
      headline: extract('HEADLINE') || undefined,
      cta: extract('CTA') || undefined,
      hookAngle: extract('HOOK_ANGLE') || 'unknown',
      emotionalDriver: extract('EMOTIONAL_DRIVER') || 'unknown',
      offerStructure: extract('OFFER') || undefined,
      estimatedLongevity: extract('LONGEVITY') || undefined,
      sourceUrl: extract('SOURCE') || sourceHint,
    });
  }

  return examples.slice(0, 8); // max 8 examples per competitor
}

async function extractAdsFromText(
  brand: string,
  combinedText: string,
  visualAnalysis: string,
  signal?: AbortSignal
): Promise<{ adExamples: AdExample[]; activeAdsCount?: number; positioning: string; dominantAngles: string[] }> {
  if (!combinedText.trim() && !visualAnalysis.trim()) {
    return { adExamples: [], positioning: '', dominantAngles: [] };
  }

  const fullContext = [
    combinedText ? `SCRAPED WEB DATA:\n${combinedText}` : '',
    visualAnalysis ? `VISION ANALYSIS (Facebook Ad Library screenshot):\n${visualAnalysis}` : '',
  ].filter(Boolean).join('\n\n');

  const prompt = `You are analyzing competitor advertising intelligence for the brand "${brand}".

${fullContext}

Extract all ad examples you can find. For each ad, output in this EXACT format:
AD_COPY: [the ad body text, as close to verbatim as possible]
HEADLINE: [headline if found, or leave blank]
CTA: [call-to-action text, e.g. "Shop Now", "Learn More"]
HOOK_ANGLE: [one of: pain-agitate-solution, social-proof, before-after, curiosity, authority, urgency, lifestyle, identity]
EMOTIONAL_DRIVER: [primary emotion: fear-of-failure, aspiration, social-belonging, identity, urgency, curiosity]
OFFER: [discount/trial/guarantee if mentioned, or blank]
LONGEVITY: [if dates are mentioned, estimate how long the ad has been running, e.g. "90+ days (proven converter)"]
SOURCE: [URL where this was found]
---

After the ad examples, also output:
ACTIVE_ADS_COUNT: [estimated number of ads currently running, if determinable]
DOMINANT_POSITIONING: [2-sentence summary of how this brand positions itself in the market]
DOMINANT_ANGLES: [comma-separated list of the 2-3 main hook angles this brand uses]

If you cannot find any ads, output NO_ADS_FOUND.`;

  try {
    const result = await ollamaService.generateStream(
      prompt,
      'Extract competitor advertising intelligence. Be specific and factual. Only extract what you can actually see in the data.',
      { model: ORCHESTRATOR_MODEL, signal }
    );

    if (result.includes('NO_ADS_FOUND')) {
      return { adExamples: [], positioning: '', dominantAngles: [] };
    }

    const adExamples = parseAdExamples(result, `https://www.facebook.com/ads/library/?q=${encodeURIComponent(brand)}`);

    const extractField = (key: string): string => {
      const match = result.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 'si'));
      return match?.[1]?.trim() || '';
    };

    const activeAdsCountStr = extractField('ACTIVE_ADS_COUNT');
    const activeAdsCount = activeAdsCountStr ? parseInt(activeAdsCountStr) || undefined : undefined;
    const positioning = extractField('DOMINANT_POSITIONING') || '';
    const anglesRaw = extractField('DOMINANT_ANGLES');
    const dominantAngles = anglesRaw ? anglesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    return { adExamples, activeAdsCount, positioning, dominantAngles };
  } catch {
    return { adExamples: [], positioning: '', dominantAngles: [] };
  }
}

// ─── Industry pattern synthesis ─────────────────────────────────────────────

async function synthesizeIndustryPatterns(
  profiles: CompetitorProfile[],
  campaign: Campaign,
  signal?: AbortSignal
): Promise<CompetitorAdIntelligence['industryPatterns']> {
  const allHooks = profiles.flatMap(p => p.adExamples.map(a => a.hookAngle));
  const allDrivers = profiles.flatMap(p => p.adExamples.map(a => a.emotionalDriver));
  const allAngles = profiles.flatMap(p => p.dominantAngles);

  if (profiles.length === 0 || allHooks.length === 0) {
    return { dominantHooks: [], commonEmotionalDrivers: [], unusedAngles: [], dominantFormats: [], commonOffers: [] };
  }

  const summaryText = profiles.map(p =>
    `${p.brand}:\n  Angles: ${p.dominantAngles.join(', ') || 'unknown'}\n  Ads: ${p.adExamples.length} examples\n  Hooks used: ${p.adExamples.map(a => a.hookAngle).join(', ')}`
  ).join('\n\n');

  const prompt = `You are analyzing advertising patterns across ${profiles.length} competitors of "${campaign.brand}" (${campaign.productDescription}).

COMPETITOR AD INTELLIGENCE:
${summaryText}

ALL HOOK ANGLES USED: ${[...new Set(allHooks)].join(', ')}
ALL EMOTIONAL DRIVERS USED: ${[...new Set(allDrivers)].join(', ')}
ALL DOMINANT ANGLES: ${[...new Set(allAngles)].join(', ')}

Based on this data, output:
DOMINANT_HOOKS: [hook types used by 2 or more competitors — what's saturated]
COMMON_EMOTIONAL_DRIVERS: [emotions targeted by most competitors]
UNUSED_ANGLES: [important hook angles that NO competitor is using — these are creative opportunities for ${campaign.brand}]
DOMINANT_FORMATS: [most common ad format types mentioned, e.g. "video testimonial", "static lifestyle image", "UGC"]
COMMON_OFFERS: [offer structures seen across multiple competitors]

For UNUSED_ANGLES, think about: transformation-story, humor, specific-mechanism, founder-story, community, challenge, educational, comparison. What's missing from what competitors do?`;

  try {
    const result = await ollamaService.generateStream(
      prompt,
      'Synthesize competitor advertising patterns. Identify gaps and opportunities.',
      { model: ORCHESTRATOR_MODEL, signal }
    );

    const extractList = (key: string): string[] => {
      const match = result.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 'si'));
      if (!match) return [];
      return match[1].split(',').map(s => s.trim()).filter(s => s.length > 2);
    };

    return {
      dominantHooks: extractList('DOMINANT_HOOKS'),
      commonEmotionalDrivers: extractList('COMMON_EMOTIONAL_DRIVERS'),
      unusedAngles: extractList('UNUSED_ANGLES'),
      dominantFormats: extractList('DOMINANT_FORMATS'),
      commonOffers: extractList('COMMON_OFFERS'),
    };
  } catch {
    return { dominantHooks: [], commonEmotionalDrivers: [], unusedAngles: [], dominantFormats: [], commonOffers: [] };
  }
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function analyzeCompetitorAds(
  campaign: Campaign,
  existingFindings: ResearchFindings,
  onProgress: (msg: string) => void,
  signal?: AbortSignal
): Promise<CompetitorAdIntelligence> {
  onProgress(`[Ads] Extracting competitor brand names from research findings...\n`);

  const competitorNames = await extractCompetitorNames(campaign, existingFindings, signal);

  if (competitorNames.length === 0) {
    onProgress(`[Ads] No competitor brands identified — skipping ad intelligence\n`);
    return {
      competitors: [],
      industryPatterns: { dominantHooks: [], commonEmotionalDrivers: [], unusedAngles: [], dominantFormats: [], commonOffers: [] },
      visionAnalyzed: 0,
    };
  }

  onProgress(`[Ads] Found ${competitorNames.length} competitors: ${competitorNames.join(', ')}\n\n`);

  // Process all competitors in parallel (max 4)
  const competitorResults = await Promise.all(
    competitorNames.slice(0, MAX_COMPETITORS).map(async (brand) => {
      if (signal?.aborted) return null;

      try {
        const { text, visualAnalysis } = await scrapeCompetitorAdData(brand, campaign, onProgress, signal);
        const { adExamples, activeAdsCount, positioning, dominantAngles } = await extractAdsFromText(
          brand, text, visualAnalysis, signal
        );

        const visionUsed = visualAnalysis.length > 10 ? 1 : 0;

        onProgress(`  [Ads] "${brand}": ${adExamples.length} ad examples extracted${activeAdsCount ? `, ~${activeAdsCount} active ads` : ''}\n`);

        return {
          profile: {
            brand,
            estimatedActiveAds: activeAdsCount,
            adExamples,
            dominantAngles,
            positioning,
          } as CompetitorProfile,
          visionUsed,
        };
      } catch (err) {
        onProgress(`  [Ads] "${brand}" failed — skipping\n`);
        return null;
      }
    })
  );

  const validResults = competitorResults.filter((r): r is NonNullable<typeof r> => r !== null);
  const profiles = validResults.map(r => r.profile);
  const visionAnalyzed = validResults.reduce((sum, r) => sum + r.visionUsed, 0);

  // Synthesize industry patterns across all competitors
  onProgress(`\n[Ads] Synthesizing industry ad patterns across ${profiles.length} competitors...\n`);
  const industryPatterns = await synthesizeIndustryPatterns(profiles, campaign, signal);

  if (industryPatterns.unusedAngles.length > 0) {
    onProgress(`[Ads] Creative opportunities found: ${industryPatterns.unusedAngles.slice(0, 3).join(', ')}\n`);
  }

  const totalAds = profiles.reduce((s, p) => s + p.adExamples.length, 0);
  onProgress(`[Ads] Complete: ${totalAds} ad examples | ${visionAnalyzed} vision-analyzed | ${industryPatterns.unusedAngles.length} unused angles identified\n`);

  return { competitors: profiles, industryPatterns, visionAnalyzed };
}
