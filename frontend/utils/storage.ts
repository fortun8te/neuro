import { set, get, del } from 'idb-keyval';
import type { Campaign, Cycle } from '../types';

const CAMPAIGNS_KEY = 'campaigns';
const CYCLES_KEY = 'cycles';
const GENERATED_IMAGES_KEY = 'generated_images';

// Bug fix #4: cap per-campaign cycle count to prevent unbounded IDB growth.
// Each completed cycle can hold megabytes of researchFindings + base64 visuals.
const MAX_CYCLES_PER_CAMPAIGN = 20;

// ── Generated Image (persisted to IndexedDB) ──
export interface StoredImage {
  id: string;
  imageBase64: string;          // The actual image data
  prompt: string;               // User's original prompt
  imagePrompt?: string;         // Final prompt sent to image model (may differ from user prompt)
  model: string;                // 'nano-banana-2' | 'seedream-5-lite'
  aspectRatio: string;          // '1:1' | '9:16' | '4:5' | '16:9'
  pipeline: string;             // 'direct' | 'preset-llm' | 'preset-html-llm' | 'research-llm' | 'research-html-llm'
  timestamp: number;
  label: string;                // 'Ad 1', 'Ad 2', etc.
  referenceImageCount: number;  // How many @img refs were used
  referenceImages?: string[];   // The actual base64 reference images (for display in lightbox)
  campaignId?: string;          // Which campaign this was for
  campaignBrand?: string;       // Brand name for display
  favorite?: boolean;           // User favorited this image
  heroImageBase64?: string;     // Optional hero image generated via Freepik Pikaso (Phase 10)
  htmlScreenshot?: string;      // Screenshot of the HTML layout wireframe (base64, for HTML pipeline)
  htmlSource?: string;          // Full HTML source code (for re-rendering, editing, reuse as template)
  strategyLabel?: string;       // e.g. "Product Hero - PAS" (for HTML ad variant cards)
  generationDurationMs?: number; // How long this ad took to generate (ms)
  inspiredByRef?: string;       // Which library reference inspired this ad (e.g. "Reference #3 - social-proof")
  sourceHtmlId?: string;        // Links rendered Freepik image back to its HTML draft
  visionFeedback?: string;      // Vision QA feedback from MiniCPM brand compliance check
  visionRounds?: VisionRound[]; // Full round-by-round history (persistent, browsable after generation)
  desireId?: string;            // Links ad to a specific DeepDesire
  desireLabel?: string;         // Denormalized desire label for display
}

/** One round of the vision QA loop */
export interface VisionRound {
  round: number;         // 0 = original/candidate, 1+ = revision
  imageBase64: string;   // The image at this round
  prompt: string;        // The prompt used for this round
  feedback: string;      // MiniCPM's feedback (or "selected by MiniCPM" / "original")
  status: 'original' | 'candidate' | 'revised' | 'passed'; // What happened
}

// Bug fix #2: serialize write operations on the cycles key so concurrent
// saveCycle() calls (e.g. from parallel stage completions) cannot interleave
// their read-modify-write and silently drop each other's updates.
let _cycleWriteQueue: Promise<void> = Promise.resolve();
let _imageWriteQueue: Promise<void> = Promise.resolve();

function enqueueImageWrite(fn: () => Promise<void>): Promise<void> {
  _imageWriteQueue = _imageWriteQueue.catch(() => {/* previous failure — proceed */}).then(fn);
  return _imageWriteQueue;
}

function enqueueCycleWrite(fn: () => Promise<void>): Promise<void> {
  // Bug fix: previous .catch(fn) re-executed fn on failure, causing double-writes
  // and swallowing errors.  Now we chain correctly: if the previous write failed,
  // still attempt the current one, but let the current one's errors propagate.
  _cycleWriteQueue = _cycleWriteQueue.catch(() => {/* previous failure — proceed */}).then(fn);
  return _cycleWriteQueue;
}

export const storage = {
  // ── Campaign operations ──

  // Bug fix #1: wrap every IDB operation in try-catch so quota/corruption
  // errors surface as thrown exceptions the caller can handle, instead of
  // crashing silently inside an unhandled promise rejection.
  async saveCampaign(campaign: Campaign): Promise<void> {
    try {
      const campaigns = (await get(CAMPAIGNS_KEY)) || {};
      campaigns[campaign.id] = campaign;
      await set(CAMPAIGNS_KEY, campaigns);
    } catch (err) {
      console.error('[storage] saveCampaign failed:', err);
      throw err;
    }
  },

  async getCampaign(id: string): Promise<Campaign | null> {
    try {
      const campaigns = (await get(CAMPAIGNS_KEY)) || {};
      return campaigns[id] ?? null;
    } catch (err) {
      console.error('[storage] getCampaign failed:', err);
      throw err;
    }
  },

  async getAllCampaigns(): Promise<Campaign[]> {
    try {
      const campaigns = (await get(CAMPAIGNS_KEY)) || {};
      return Object.values(campaigns);
    } catch (err) {
      console.error('[storage] getAllCampaigns failed:', err);
      throw err;
    }
  },

  async deleteCampaign(id: string): Promise<void> {
    try {
      // CRITICAL FIX: Cascade delete all associated data
      // 1. Delete all cycles for this campaign
      await this.deleteCyclesForCampaign(id);

      // 2. Delete all images for this campaign
      const images = (await get(GENERATED_IMAGES_KEY)) || {};
      const imagesToDelete = Object.keys(images).filter(
        (imgId) => (images[imgId] as StoredImage).campaignId === id
      );
      for (const imgId of imagesToDelete) {
        delete images[imgId];
      }
      if (imagesToDelete.length > 0) {
        await set(GENERATED_IMAGES_KEY, images);
      }

      // 3. Finally delete the campaign itself
      const campaigns = (await get(CAMPAIGNS_KEY)) || {};
      delete campaigns[id];
      await set(CAMPAIGNS_KEY, campaigns);

      console.log(`[storage] Cascade deleted campaign ${id}: ${imagesToDelete.length} images, all associated cycles`);
    } catch (err) {
      console.error('[storage] deleteCampaign failed:', err);
      throw err;
    }
  },

  // ── Cycle operations ──

  // Bug fix #2 (continued) + Bug fix #1 + Bug fix #4:
  // - Serialised via _cycleWriteQueue (no concurrent read-modify-write races)
  // - Wrapped in try-catch (quota errors surface)
  // - Old cycles pruned to MAX_CYCLES_PER_CAMPAIGN (unbounded growth fixed)
  async saveCycle(cycle: Cycle): Promise<void> {
    return enqueueCycleWrite(async () => {
      try {
        // Ensure we only save serializable data
        const serializableCycle = {
          ...cycle,
          researchFindings: cycle.researchFindings
            ? JSON.parse(JSON.stringify(cycle.researchFindings))
            : undefined,
        };

        const cycles = (await get(CYCLES_KEY)) || {};
        cycles[cycle.id] = serializableCycle;

        // Bug fix #4: Prune oldest cycles for this campaign so the blob
        // doesn't grow without bound.  Keep the newest MAX_CYCLES_PER_CAMPAIGN.
        const campaignCycleEntries = Object.entries(cycles)
          .filter(([, c]) => (c as Cycle).campaignId === cycle.campaignId)
          .sort(([, a], [, b]) => ((b as Cycle).startedAt ?? 0) - ((a as Cycle).startedAt ?? 0));

        if (campaignCycleEntries.length > MAX_CYCLES_PER_CAMPAIGN) {
          const toRemove = campaignCycleEntries.slice(MAX_CYCLES_PER_CAMPAIGN);
          for (const [id] of toRemove) {
            delete cycles[id];
          }
        }

        await set(CYCLES_KEY, cycles);
      } catch (err) {
        console.error('[storage] saveCycle failed:', err);
        throw err;
      }
    });
  },

  async getCycle(id: string): Promise<Cycle | null> {
    try {
      const cycles = (await get(CYCLES_KEY)) || {};
      return cycles[id] ?? null;
    } catch (err) {
      console.error('[storage] getCycle failed:', err);
      throw err;
    }
  },

  async getCyclesByCampaign(campaignId: string): Promise<Cycle[]> {
    try {
      const cycles = (await get(CYCLES_KEY)) || {};
      return (Object.values(cycles) as Cycle[]).filter(
        (c) => c.campaignId === campaignId
      );
    } catch (err) {
      console.error('[storage] getCyclesByCampaign failed:', err);
      throw err;
    }
  },

  async updateCycle(cycle: Cycle): Promise<void> {
    return this.saveCycle(cycle);
  },

  // ── Generated Image operations ──

  async saveImage(image: StoredImage): Promise<void> {
    return enqueueImageWrite(async () => {
      try {
        const images = (await get(GENERATED_IMAGES_KEY)) || {};
        images[image.id] = image;
        await set(GENERATED_IMAGES_KEY, images);
      } catch (err) {
        console.error('[storage] saveImage failed:', err);
        throw err;
      }
    });
  },

  async getImage(id: string): Promise<StoredImage | null> {
    try {
      const images = (await get(GENERATED_IMAGES_KEY)) || {};
      return images[id] ?? null;
    } catch (err) {
      console.error('[storage] getImage failed:', err);
      throw err;
    }
  },

  async getAllImages(): Promise<StoredImage[]> {
    try {
      const images = (await get(GENERATED_IMAGES_KEY)) || {};
      return (Object.values(images) as StoredImage[]).sort(
        (a, b) => b.timestamp - a.timestamp
      );
    } catch (err) {
      console.error('[storage] getAllImages failed:', err);
      throw err;
    }
  },

  async toggleFavorite(id: string): Promise<StoredImage | null> {
    let result: StoredImage | null = null;
    await enqueueImageWrite(async () => {
      try {
        const images = (await get(GENERATED_IMAGES_KEY)) || {};
        const img = images[id];
        if (!img) { result = null; return; }
        img.favorite = !img.favorite;
        images[id] = img;
        await set(GENERATED_IMAGES_KEY, images);
        result = img as StoredImage;
      } catch (err) {
        console.error('[storage] toggleFavorite failed:', err);
        throw err;
      }
    });
    return result;
  },

  async deleteImage(id: string): Promise<void> {
    return enqueueImageWrite(async () => {
      try {
        const images = (await get(GENERATED_IMAGES_KEY)) || {};
        delete images[id];
        await set(GENERATED_IMAGES_KEY, images);
      } catch (err) {
        console.error('[storage] deleteImage failed:', err);
        throw err;
      }
    });
  },

  async getImageCount(): Promise<number> {
    try {
      const images = (await get(GENERATED_IMAGES_KEY)) || {};
      return Object.keys(images).length;
    } catch (err) {
      console.error('[storage] getImageCount failed:', err);
      return 0;
    }
  },

  // Delete all cycles for a specific campaign (reset research)
  async deleteCyclesForCampaign(campaignId: string): Promise<void> {
    return enqueueCycleWrite(async () => {
      try {
        const cycles = (await get(CYCLES_KEY)) || {};
        const toDelete = Object.keys(cycles).filter(
          (id) => (cycles[id] as Cycle).campaignId === campaignId
        );
        for (const id of toDelete) delete cycles[id];
        await set(CYCLES_KEY, cycles);
      } catch (err) {
        console.error('[storage] deleteCyclesForCampaign failed:', err);
        throw err;
      }
    });
  },

  // Bug fix #3: clear() now also deletes images so "clear all" is truly complete.
  async clear(): Promise<void> {
    try {
      await del(CAMPAIGNS_KEY);
      await del(CYCLES_KEY);
      await del(GENERATED_IMAGES_KEY);
    } catch (err) {
      console.error('[storage] clear failed:', err);
      throw err;
    }
  },

  // ── Helper for getting all images for a campaign ──

  async getImagesByCampaign(campaignId: string): Promise<StoredImage[]> {
    try {
      const images = (await get(GENERATED_IMAGES_KEY)) || {};
      return (Object.values(images) as StoredImage[])
        .filter((img) => img.campaignId === campaignId)
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.error('[storage] getImagesByCampaign failed:', err);
      throw err;
    }
  },

  // ── Helper for cleaning up images for a campaign ──

  async deleteImagesForCampaign(campaignId: string): Promise<void> {
    return enqueueImageWrite(async () => {
      try {
        const images = (await get(GENERATED_IMAGES_KEY)) || {};
        const toDelete = Object.keys(images).filter(
          (id) => (images[id] as StoredImage).campaignId === campaignId
        );
        for (const id of toDelete) delete images[id];
        if (toDelete.length > 0) {
          await set(GENERATED_IMAGES_KEY, images);
          console.log(`[storage] Deleted ${toDelete.length} images for campaign ${campaignId}`);
        }
      } catch (err) {
        console.error('[storage] deleteImagesForCampaign failed:', err);
        throw err;
      }
    });
  },

  // ── Checkpoint operations (Phase 11) ──

  // Note: These methods are deprecated in favor of sessionCheckpoint.ts
  // Kept for backward compatibility if needed, but new checkpoint logic
  // should use sessionCheckpoint service directly.

  async saveCheckpoint(checkpointKey: string, checkpointData: unknown): Promise<void> {
    try {
      await set(checkpointKey, checkpointData);
    } catch (err) {
      console.error('[storage] saveCheckpoint failed:', err);
      throw err;
    }
  },

  async loadCheckpoint(checkpointKey: string): Promise<unknown> {
    try {
      return (await get(checkpointKey)) ?? null;
    } catch (err) {
      console.error('[storage] loadCheckpoint failed:', err);
      throw err;
    }
  },

  async deleteCheckpoint(checkpointKey: string): Promise<void> {
    try {
      await del(checkpointKey);
    } catch (err) {
      console.error('[storage] deleteCheckpoint failed:', err);
      throw err;
    }
  },
};
