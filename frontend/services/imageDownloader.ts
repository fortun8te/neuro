/**
 * Image Downloader Service — Download and cache images locally
 *
 * Fetches images from URLs and:
 * - Converts to base64 for vision model input
 * - Caches locally to avoid re-downloading
 * - Handles failures gracefully
 * - Respects rate limits
 *
 * Cache is stored in memory + IndexedDB for persistence
 */

import { createLogger } from '../utils/logger';

const log = createLogger('image-downloader');

export interface CachedImage {
  url: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  bytes: number;
  cached_at: number;
  cache_key: string;
}

export interface DownloadProgress {
  url: string;
  status: 'downloading' | 'cached' | 'success' | 'error' | 'skipped';
  error?: string;
  bytes?: number;
}

// Memory cache (LRU with 50 image limit)
const MEMORY_CACHE = new Map<string, CachedImage>();
const MAX_MEMORY_CACHE = 50;

// Download queue for rate limiting
let downloadQueue: Promise<any> = Promise.resolve();
const CONCURRENT_DOWNLOADS = 3;

/**
 * Download image from URL and convert to base64
 * Checks cache first, downloads if needed
 */
export async function downloadImage(
  url: string,
  options?: {
    timeout?: number;
    maxBytes?: number;
    forceRefresh?: boolean;
    signal?: AbortSignal;
  }
): Promise<CachedImage> {
  const {
    timeout = 30_000,
    maxBytes = 5 * 1024 * 1024,  // 5MB max
    forceRefresh = false,
    signal,
  } = options || {};

  const cacheKey = getCacheKey(url);

  // Check memory cache
  if (!forceRefresh && MEMORY_CACHE.has(cacheKey)) {
    const cached = MEMORY_CACHE.get(cacheKey)!;
    log.info(`Image cache hit: ${url.slice(0, 60)}...`);
    return cached;
  }

  // Check IndexedDB cache
  if (!forceRefresh) {
    const cached = await getFromIndexedDB(cacheKey);
    if (cached) {
      // Restore to memory cache
      MEMORY_CACHE.set(cacheKey, cached);
      log.info(`Image restored from IndexedDB: ${url.slice(0, 60)}...`);
      return cached;
    }
  }

  // Download the image
  return downloadImageInternal(url, { timeout, maxBytes, cacheKey, signal });
}

/**
 * Download multiple images with concurrency control
 */
export async function downloadImageBatch(
  urls: string[],
  options?: {
    onProgress?: (progress: DownloadProgress) => void;
    timeout?: number;
    maxBytes?: number;
    signal?: AbortSignal;
  }
): Promise<CachedImage[]> {
  const { onProgress, ...downloadOpts } = options || {};
  const results: CachedImage[] = [];
  const errors: string[] = [];

  // Limit concurrency
  const chunks = chunkArray(urls, CONCURRENT_DOWNLOADS);

  for (const chunk of chunks) {
    if (options?.signal?.aborted) break;

    const promises = chunk.map(async url => {
      try {
        onProgress?.({ url, status: 'downloading' });
        const img = await downloadImage(url, downloadOpts);
        onProgress?.({ url, status: 'success', bytes: img.bytes });
        return img;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onProgress?.({ url, status: 'error', error: msg });
        errors.push(`${url}: ${msg}`);
        return null;
      }
    });

    const batch = await Promise.all(promises);
    results.push(...batch.filter((img): img is CachedImage => img !== null));
  }

  if (errors.length > 0) {
    log.warn(`Download batch completed with ${errors.length} errors`, { errors });
  }

  return results;
}

/**
 * Internal download implementation
 */
async function downloadImageInternal(
  url: string,
  options: {
    timeout: number;
    maxBytes: number;
    cacheKey: string;
    signal?: AbortSignal;
  }
): Promise<CachedImage> {
  const { timeout, maxBytes, cacheKey, signal } = options;

  try {
    log.info(`Downloading image: ${url.slice(0, 60)}...`);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    // Set up signal listeners
    signal?.addEventListener('abort', () => controller.abort());

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      credentials: 'omit',  // Don't send credentials for cross-origin
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!isValidImageType(contentType)) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Check size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBytes) {
      throw new Error(`Image too large: ${contentLength} bytes (max ${maxBytes})`);
    }

    // Download blob
    const blob = await response.blob();

    // Double-check size
    if (blob.size > maxBytes) {
      throw new Error(`Downloaded image too large: ${blob.size} bytes (max ${maxBytes})`);
    }

    // Convert to base64
    const base64 = await blobToBase64(blob);
    const mediaType = (contentType || 'image/jpeg') as any;

    const cached: CachedImage = {
      url,
      base64,
      mediaType,
      bytes: blob.size,
      cached_at: Date.now(),
      cache_key: cacheKey,
    };

    // Cache in memory
    addToMemoryCache(cacheKey, cached);

    // Cache in IndexedDB
    await saveToIndexedDB(cached);

    log.info(`Downloaded image (${blob.size} bytes): ${url.slice(0, 60)}...`);
    return cached;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Image download failed: ${url.slice(0, 60)}...`, {}, err);
    throw new Error(`Failed to download image: ${msg}`);
  }
}

/**
 * Get existing cached image
 */
export async function getCachedImage(url: string): Promise<CachedImage | null> {
  const cacheKey = getCacheKey(url);

  // Check memory cache
  if (MEMORY_CACHE.has(cacheKey)) {
    return MEMORY_CACHE.get(cacheKey) || null;
  }

  // Check IndexedDB
  return getFromIndexedDB(cacheKey);
}

/**
 * Clear image cache
 */
export async function clearImageCache(): Promise<void> {
  MEMORY_CACHE.clear();
  await clearIndexedDB();
  log.info('Image cache cleared');
}

/**
 * Get cache size statistics
 */
export async function getCacheStats(): Promise<{
  memory: { count: number; bytes: number };
  indexeddb: { count: number; bytes: number };
}> {
  const memoryBytes = Array.from(MEMORY_CACHE.values()).reduce(
    (sum, img) => sum + img.bytes,
    0
  );

  const indexeddbStats = await getIndexedDBStats();

  return {
    memory: { count: MEMORY_CACHE.size, bytes: memoryBytes },
    indexeddb: indexeddbStats,
  };
}

// ── Helper functions ────────────────────────────────────────────────────────

function getCacheKey(url: string): string {
  // Use URL as key (normalized)
  return encodeURIComponent(url);
}

function isValidImageType(contentType?: string | null): boolean {
  if (!contentType) return true;  // Assume valid if no content-type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return validTypes.some(type => contentType.includes(type));
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 part (remove "data:image/...;base64," prefix)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function addToMemoryCache(key: string, image: CachedImage): void {
  MEMORY_CACHE.set(key, image);

  // Evict oldest if cache is full (simple LRU)
  if (MEMORY_CACHE.size > MAX_MEMORY_CACHE) {
    const firstKey = MEMORY_CACHE.keys().next().value;
    if (firstKey) {
      MEMORY_CACHE.delete(firstKey);
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── IndexedDB persistence ──────────────────────────────────────────────────

const DB_NAME = 'RACKS_ImageCache';
const STORE_NAME = 'images';

let _dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (_dbInstance) return _dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      _dbInstance = request.result;
      resolve(_dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cache_key' });
        store.createIndex('cached_at', 'cached_at', { unique: false });
      }
    };
  });
}

async function saveToIndexedDB(image: CachedImage): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(image);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    log.warn('Failed to save to IndexedDB', {}, err);
    // Non-critical, don't throw
  }
}

async function getFromIndexedDB(cacheKey: string): Promise<CachedImage | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(cacheKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (err) {
    log.warn('Failed to read from IndexedDB', {}, err);
    return null;
  }
}

async function clearIndexedDB(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    log.warn('Failed to clear IndexedDB', {}, err);
  }
}

async function getIndexedDBStats(): Promise<{ count: number; bytes: number }> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const images = request.result as CachedImage[];
        const bytes = images.reduce((sum, img) => sum + img.bytes, 0);
        resolve({ count: images.length, bytes });
      };
      request.onerror = () => resolve({ count: 0, bytes: 0 });
    });
  } catch {
    return { count: 0, bytes: 0 };
  }
}
