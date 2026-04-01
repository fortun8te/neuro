/**
 * visualScoutAgent — stub placeholder.
 *
 * TODO: Implement real Playwright screenshot + vision analysis.
 * Should: visit competitor URLs, capture screenshots, analyze layout/color/typography
 * patterns via vision LLM, identify visual gaps and differentiation opportunities.
 */

import type { VisualFindings } from '../types';

export const visualScoutAgent = {
  async analyzeCompetitorVisuals(
    _urls: string[],
    _campaign: unknown,
    _onProgress?: (msg: string) => void,
    _signal?: AbortSignal,
    _onEvent?: (event: { type: string; [key: string]: unknown }) => void
  ): Promise<VisualFindings> {
    _onProgress?.('[VisualScout] Stub — not yet implemented. Returning empty results.');
    console.info('[visualScoutAgent] Stub called — implement Playwright + vision analysis to enable this feature');
    return {
      competitorVisuals: [],
      commonPatterns: [],
      visualGaps: [],
      recommendedDifferentiation: [],
      analysisModel: 'stub',
      totalScreenshots: 0,
      totalAnalyzed: 0,
    };
  },
};
