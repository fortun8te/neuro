/**
 * Model Selector Utility
 *
 * Intelligent model selection based on phase/role, with override support.
 * - Routes roles to configured models from modelConfig.ts
 * - Checks availability via loadMonitor
 * - Supports --model-override for testing
 * - Provides fallback models when primary is unavailable
 */

import { MODEL_CONFIG } from './modelConfig';
import { MODEL_ROUTING, ModelConfig, CONCURRENCY_LIMITS } from '../config/modelRouting';
import { loadMonitor } from '../services/loadMonitor';
import { createLogger } from './logger';

const log = createLogger('modelSelector');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ModelSelection {
  model: string;
  reason: 'primary' | 'override' | 'fallback' | 'capacity-limited';
  isAvailable: boolean;
  load: number;
}

export interface ModelSelectionOptions {
  phase?: string;
  role?: string;
  modelOverride?: string;
  allowUnavailable?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Model Override Storage (for testing/debugging)
// ─────────────────────────────────────────────────────────────

let _globalModelOverride: string | null = null;

/**
 * Set a global model override (for testing/debugging).
 * Pass null to clear.
 */
export function setModelOverride(model: string | null): void {
  if (model) {
    log.info('Model override set', { model });
  } else {
    log.info('Model override cleared');
  }
  _globalModelOverride = model;
}

/**
 * Get the current model override, if any.
 */
export function getModelOverride(): string | null {
  return _globalModelOverride;
}

// ─────────────────────────────────────────────────────────────
// Model Selection Logic
// ─────────────────────────────────────────────────────────────

/**
 * Select the best model for a given phase or role.
 *
 * Selection order:
 * 1. Global override (if set via setModelOverride())
 * 2. Phase-specific model from MODEL_ROUTING
 * 3. Role-based model from MODEL_CONFIG
 * 4. Fallback model (from MODEL_ROUTING or MODEL_CONFIG)
 *
 * Returns details about the selection including:
 * - Selected model
 * - Reason for selection
 * - Current load
 * - Availability status
 */
export async function selectModel(options: ModelSelectionOptions = {}): Promise<ModelSelection> {
  const { phase, role, modelOverride, allowUnavailable = false } = options;

  // 1. Global override (highest priority)
  if (_globalModelOverride) {
    const load = loadMonitor.getModelLoad(_globalModelOverride);
    return {
      model: _globalModelOverride,
      reason: 'override',
      isAvailable: true,
      load,
    };
  }

  // 2. Provided override
  if (modelOverride) {
    const load = loadMonitor.getModelLoad(modelOverride);
    return {
      model: modelOverride,
      reason: 'override',
      isAvailable: true,
      load,
    };
  }

  // 3. Try phase-specific routing config
  if (phase) {
    const phaseConfig = MODEL_ROUTING[phase as keyof typeof MODEL_ROUTING];
    if (phaseConfig) {
      const primaryModel = phaseConfig.model;
      const availability = await loadMonitor.checkAvailability(primaryModel);

      if (availability.available) {
        return {
          model: primaryModel,
          reason: 'primary',
          isAvailable: true,
          load: loadMonitor.getModelLoad(primaryModel),
        };
      }

      // Primary unavailable — try fallback
      if (phaseConfig.fallbackModel) {
        const fallbackAvailability = await loadMonitor.checkAvailability(phaseConfig.fallbackModel);
        const fallbackLoad = loadMonitor.getModelLoad(phaseConfig.fallbackModel);

        if (fallbackAvailability.available || allowUnavailable) {
          log.warn('Falling back to secondary model', {
            phase,
            primary: primaryModel,
            fallback: phaseConfig.fallbackModel,
            reason: availability.reason,
          });
          return {
            model: phaseConfig.fallbackModel,
            reason: 'fallback',
            isAvailable: fallbackAvailability.available,
            load: fallbackLoad,
          };
        }

        // Both primary and fallback at capacity
        if (allowUnavailable) {
          log.warn('Both primary and fallback at capacity, using primary anyway', {
            phase,
            primary: primaryModel,
            fallback: phaseConfig.fallbackModel,
          });
          return {
            model: primaryModel,
            reason: 'capacity-limited',
            isAvailable: false,
            load: 100,
          };
        }

        throw new Error(
          `Model selection failed for phase "${phase}": ` +
          `Primary (${primaryModel}) and fallback (${phaseConfig.fallbackModel}) both unavailable. ` +
          `${availability.reason}`
        );
      }

      // No fallback available
      if (allowUnavailable) {
        return {
          model: primaryModel,
          reason: 'capacity-limited',
          isAvailable: false,
          load: 100,
        };
      }

      throw new Error(
        `Model "${primaryModel}" for phase "${phase}" is unavailable: ${availability.reason}`
      );
    }
  }

  // 4. Try role-based lookup from MODEL_CONFIG
  if (role) {
    const roleModel = MODEL_CONFIG[role];
    if (roleModel) {
      const availability = await loadMonitor.checkAvailability(roleModel);
      const load = loadMonitor.getModelLoad(roleModel);

      if (availability.available) {
        return {
          model: roleModel,
          reason: 'primary',
          isAvailable: true,
          load,
        };
      }

      // Role model at capacity
      if (allowUnavailable) {
        return {
          model: roleModel,
          reason: 'capacity-limited',
          isAvailable: false,
          load: 100,
        };
      }

      throw new Error(
        `Model "${roleModel}" for role "${role}" is unavailable: ${availability.reason}`
      );
    }
  }

  // 5. Default fallback (if no phase or role specified)
  const defaultModel = 'qwen3.5:4b';
  const defaultAvailability = await loadMonitor.checkAvailability(defaultModel);
  if (defaultAvailability.available) {
    return {
      model: defaultModel,
      reason: 'primary',
      isAvailable: true,
      load: loadMonitor.getModelLoad(defaultModel),
    };
  }

  if (allowUnavailable) {
    return {
      model: defaultModel,
      reason: 'capacity-limited',
      isAvailable: false,
      load: 100,
    };
  }

  throw new Error(`No available model found. ${defaultAvailability.reason}`);
}

/**
 * Get the model for a specific phase without waiting for availability check.
 * Synchronous version — useful when you just need the configured model.
 */
export function getPhaseModel(phase: string): string {
  const phaseConfig = MODEL_ROUTING[phase as keyof typeof MODEL_ROUTING];
  if (phaseConfig) {
    return phaseConfig.model;
  }

  // Fall back to MODEL_CONFIG lookup
  const roleModel = MODEL_CONFIG[phase];
  if (roleModel) {
    return roleModel;
  }

  // Ultimate fallback
  return 'qwen3.5:4b';
}

/**
 * Get all available models in the system.
 */
export function getAllConfiguredModels(): string[] {
  const models = new Set<string>();

  // Add all models from MODEL_ROUTING
  Object.values(MODEL_ROUTING).forEach((config) => {
    models.add(config.model);
    if (config.fallbackModel) models.add(config.fallbackModel);
  });

  // Add all models from MODEL_CONFIG
  Object.values(MODEL_CONFIG).forEach((model) => {
    models.add(model);
  });

  // Add all models from concurrency limits
  Object.keys(CONCURRENCY_LIMITS.perModel).forEach((model) => {
    models.add(model);
  });

  return Array.from(models).sort();
}

/**
 * Validate that a model name is configured in the system.
 */
export function isValidModel(model: string): boolean {
  return getAllConfiguredModels().includes(model);
}

/**
 * Get memory requirement for a model.
 */
export function getModelMemoryRequired(model: string): string {
  return CONCURRENCY_LIMITS.memoryPerModel[model] || 'unknown';
}

/**
 * Get concurrency limit for a model.
 */
export function getModelConcurrencyLimit(model: string): number {
  return CONCURRENCY_LIMITS.perModel[model] || 1;
}
