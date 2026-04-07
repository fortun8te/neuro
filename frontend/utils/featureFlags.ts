/**
 * Feature flag system for availability checks
 * Determines which features are available based on infrastructure mode
 */

import { INFRASTRUCTURE } from '../config/infrastructure';

/** Check if currently running in local infrastructure mode */
function isLocalMode(): boolean {
  try {
    return INFRASTRUCTURE.getMode() === 'local';
  } catch {
    return false;
  }
}

/**
 * Features that are unavailable in local mode (qwen3.5:2b only)
 * - Voice enhancement requires larger models
 * - Deep reasoning/thinking needs extended context and capability
 * - Subagents/parallel execution need VRAM and model quality
 * - Nemotron features require 120B model
 */
export const LOCAL_MODE_DISABLED_FEATURES = [
  'voice_enhancement',
  'deep_reasoning',
  'extended_thinking',
  'thinking_enabled',
  'subagents_parallel',
  'nemotron_features',
  'parallel_research',
  'voice_mode',
] as const;

export type DisabledFeature = typeof LOCAL_MODE_DISABLED_FEATURES[number];

/**
 * Check if a feature is available in the current mode
 * In local mode, some advanced features are greyed out
 * In remote mode, all features are available
 */
export function isFeatureAvailable(feature: string): boolean {
  if (!isLocalMode()) {
    return true; // All features available in remote mode
  }

  return !LOCAL_MODE_DISABLED_FEATURES.includes(feature as DisabledFeature);
}

/**
 * Get reason why feature is unavailable (for tooltips)
 */
export function getFeatureUnavailableReason(feature: string): string {
  if (isFeatureAvailable(feature)) {
    return '';
  }

  switch (feature) {
    case 'voice_enhancement':
      return 'Voice enhancement requires larger models (not available in local mode)';
    case 'deep_reasoning':
    case 'thinking_enabled':
      return 'Extended thinking requires larger models (not available in local mode)';
    case 'subagents_parallel':
      return 'Parallel subagents require more VRAM (local mode uses sequential execution)';
    case 'parallel_research':
      return 'Parallel research requires larger models (local mode uses sequential)';
    case 'nemotron_features':
      return 'Nemotron features require the 120B model (not available in local mode)';
    case 'extended_thinking':
      return 'Extended thinking not available in local mode';
    case 'voice_mode':
      return 'Voice mode requires larger models (not available in local mode)';
    default:
      return 'Not available in local mode';
  }
}
