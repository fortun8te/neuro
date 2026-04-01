/**
 * competitorAdsAgent — stub placeholder.
 *
 * TODO: Implement real competitor ad scraping + vision analysis.
 * Should: scrape ad libraries (Meta, TikTok), capture screenshots,
 * run vision model analysis on creative patterns, extract hooks/offers.
 */

import type { Campaign } from '../types';
import type { ResearchFindings, CompetitorAdIntelligence } from '../types';

export async function analyzeCompetitorAds(
  _campaign: Campaign,
  _findings: ResearchFindings,
  _onProgress?: (msg: string) => void,
  _signal?: AbortSignal
): Promise<CompetitorAdIntelligence> {
  _onProgress?.('[CompetitorAds] Stub — not yet implemented. Returning empty results.');
  console.info('[competitorAdsAgent] Stub called — implement real ad scraping to enable this feature');
  return {
    competitors: [],
    industryPatterns: {
      dominantHooks: [],
      commonEmotionalDrivers: [],
      unusedAngles: [],
      dominantFormats: [],
      commonOffers: [],
    },
    visionAnalyzed: 0,
  };
}
