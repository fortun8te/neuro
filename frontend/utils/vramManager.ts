/**
 * vramManager.ts — Smart VRAM lifecycle manager for Ollama models.
 *
 * Knows what's loaded, preloads what's needed, unloads what isn't.
 * Handles tier switching (duo → heavy → nemotron → duo) with auto-restore.
 *
 * VRAM budget (RTX 5080 16GB):
 *   duo:      9b(8K ~8.8GB) + 2b(4K ~4.2GB) = ~13GB  ✓
 *   heavy:    27b solo (VRAM + RAM spillover)
 *   nemotron: 120b solo (mostly RAM)
 *   light:    4b(8K ~5.8GB) + 2b(4K ~4.2GB) = ~10GB  ✓
 */

import { ollamaService } from './ollama';
import { getModelForStage, getContextSizeForModel } from './modelConfig';
import { createLogger } from './logger';

const log = createLogger('vram');

export type VramTier = 'duo' | 'heavy' | 'nemotron' | 'light';

interface LoadedModel {
  name: string;
  sizeVram: number;
  expiresAt: string;
}

/** Tier definitions — which models to load and how */
const TIER_SPECS: Record<VramTier, Array<{ model: () => string; numCtx: () => number; keepAlive: string }>> = {
  duo: [
    { model: () => getModelForStage('chat'), numCtx: () => getContextSizeForModel(getModelForStage('chat')), keepAlive: '30m' },
    { model: () => getModelForStage('fast'), numCtx: () => getContextSizeForModel(getModelForStage('fast')), keepAlive: '30m' },
  ],
  heavy: [
    { model: () => 'qwen3.5:27b', numCtx: () => 16384, keepAlive: '5m' },
  ],
  nemotron: [
    { model: () => 'nemotron-3-super:120b', numCtx: () => 16384, keepAlive: '5m' },
  ],
  light: [
    { model: () => getModelForStage('research') || 'qwen3.5:4b', numCtx: () => 8192, keepAlive: '30m' },
    { model: () => getModelForStage('fast'), numCtx: () => getContextSizeForModel(getModelForStage('fast')), keepAlive: '30m' },
  ],
};

/** Map task types to their required tier */
const TASK_TIER_MAP: Record<string, VramTier> = {
  chat: 'duo',
  research: 'duo',
  thinking: 'duo',
  planner: 'duo',
  executor: 'duo',
  'deep-analysis': 'heavy',
  architecture: 'heavy',
  'code-reasoning': 'heavy',
  'security-audit': 'heavy',
  production: 'nemotron',
  test: 'nemotron',
};

class VramManager {
  private _loaded = new Map<string, LoadedModel>();
  private _currentTier: VramTier = 'duo';
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _switching = false;

  get currentTier(): VramTier { return this._currentTier; }
  get loadedModels(): Map<string, LoadedModel> { return this._loaded; }

  /** Fetch /api/ps and update internal cache */
  async refresh(): Promise<LoadedModel[]> {
    const models = await ollamaService.getLoadedModels();
    this._loaded.clear();
    for (const m of models) {
      this._loaded.set(m.name, m);
    }
    return models;
  }

  /** Load a model if not already loaded */
  async ensureLoaded(model: string, numCtx: number, keepAlive = '30m'): Promise<void> {
    // Check cache first
    if (this._loaded.has(model)) return;
    // Refresh to be sure
    await this.refresh();
    if (this._loaded.has(model)) return;

    log.info(`Loading ${model} (ctx=${numCtx}, keep_alive=${keepAlive})`);
    await ollamaService.preloadModels([{ model, num_ctx: numCtx, keep_alive: keepAlive }]);
    // Update cache
    await this.refresh();
  }

  /** Unload all currently loaded models */
  async unloadAll(): Promise<void> {
    await this.refresh();
    const names = [...this._loaded.keys()];
    if (names.length === 0) return;
    log.info(`Unloading ${names.length} models: ${names.join(', ')}`);
    await Promise.allSettled(names.map(n => ollamaService.unloadModel(n)));
    this._loaded.clear();
  }

  /** Switch to a specific tier — unloads conflicting models, loads required ones */
  async switchTier(tier: VramTier): Promise<void> {
    if (this._switching) {
      log.warn(`Already switching tiers, skipping request for ${tier}`);
      return;
    }
    if (tier === this._currentTier) {
      // Just ensure models are loaded (they might have expired)
      await this._loadTierModels(tier);
      return;
    }

    this._switching = true;
    try {
      const targetModels = TIER_SPECS[tier].map(s => s.model());
      const currentModels = [...this._loaded.keys()];

      // If switching to heavy/nemotron, must unload everything first (solo models)
      if (tier === 'heavy' || tier === 'nemotron') {
        await this.unloadAll();
      } else {
        // For duo/light, only unload models that aren't needed
        const toUnload = currentModels.filter(m => !targetModels.includes(m));
        if (toUnload.length > 0) {
          await Promise.allSettled(toUnload.map(m => ollamaService.unloadModel(m)));
        }
      }

      await this._loadTierModels(tier);
      this._currentTier = tier;
      log.info(`Switched to tier: ${tier}`);
    } finally {
      this._switching = false;
    }
  }

  /** Load all models for a tier (parallel) */
  private async _loadTierModels(tier: VramTier): Promise<void> {
    const specs = TIER_SPECS[tier];
    await Promise.allSettled(specs.map(s =>
      this.ensureLoaded(s.model(), s.numCtx(), s.keepAlive)
    ));
  }

  /** Map a task/stage type to the right tier and switch if needed */
  async prepareForTask(taskType: string): Promise<void> {
    const tier = TASK_TIER_MAP[taskType] || 'duo';
    await this.switchTier(tier);
  }

  /** Auto-restore to default tier (duo) after heavy/nemotron task */
  async restoreDefault(): Promise<void> {
    if (this._currentTier === 'duo') return;
    log.info(`Restoring default tier (was: ${this._currentTier})`);
    await this.switchTier('duo');
  }

  /** Start background keep-alive loop — refreshes model expiry every 60s */
  startKeepAlive(intervalMs = 60_000): void {
    if (this._refreshTimer) return;
    this._refreshTimer = setInterval(async () => {
      try {
        const models = await this.refresh();
        if (models.length === 0 && this._currentTier === 'duo') {
          // Models expired — reload
          log.info('Models expired, reloading duo tier');
          await this._loadTierModels('duo');
        }
      } catch {
        // Network error — silently retry next interval
      }
    }, intervalMs);
  }

  stopKeepAlive(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }
}

export const vramManager = new VramManager();
