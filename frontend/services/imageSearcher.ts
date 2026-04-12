/**
 * Image Search Service — Find brand images across web
 *
 * Searches for brand-related images and extracts URLs from:
 * - Web image search results
 * - Product page screenshots
 * - Social media imagery
 * - Competitor websites
 *
 * Uses Wayfarer to scrape images and SearXNG for image search
 */

import { wayfayerService } from '../utils/wayfayer';
import { createLogger } from '../utils/logger';

const log = createLogger('image-searcher');

export interface ImageSearchResult {
  url: string;
  source: 'web-search' | 'product-page' | 'social-media' | 'competitor' | 'brand-site';
  title?: string;
  domain?: string;
  found_at?: string;  // Where the image was found
}

export interface ImageSearchBatch {
  query: string;
  total: number;
  images: ImageSearchResult[];
  sources: string[];
  elapsed_ms: number;
}

/**
 * Search for images using Wayfarer/web search
 * Returns URLs of found images
 */
export async function searchBrandImages(
  brandName: string,
  searchTerms: string[] = [],
  signal?: AbortSignal
): Promise<ImageSearchBatch> {
  const startTime = Date.now();
  const allImages: ImageSearchResult[] = new Set<string>();
  const sources = new Set<string>();

  try {
    // Default search terms if not provided
    const terms = searchTerms.length > 0
      ? searchTerms
      : [
          `${brandName} product images`,
          `${brandName} packaging design`,
          `${brandName} website products`,
          `${brandName} social media aesthetic`,
        ];

    // Search each term
    for (const term of terms) {
      if (signal?.aborted) break;

      try {
        log.info(`Searching images for: "${term}"`);

        // Use Wayfarer to find pages with images
        const result = await wayfayerService.research(
          `${term} image photo`,
          15,  // num_results
          signal,
          'month'  // freshness
        );

        // Extract image URLs from results
        const pageImages = extractImagesFromPages(result.pages);
        const batchImages = pageImages.map(url => ({
          url,
          source: 'web-search' as const,
          title: term,
          domain: new URL(url).hostname,
        }));

        // Deduplicate and add
        for (const img of batchImages) {
          if (!Array.from(allImages).some(existing => existing.url === img.url)) {
            allImages.add(img);
          }
        }

        // Track sources
        result.sources.forEach(s => sources.add(s.url));

        log.info(`Found ${pageImages.length} images for "${term}"`);
      } catch (err) {
        log.warn(`Image search for "${term}" failed`, {}, err);
        // Continue with next search term
      }
    }

    const elapsed = Date.now() - startTime;

    return {
      query: brandName,
      total: Array.from(allImages).length,
      images: Array.from(allImages),
      sources: Array.from(sources),
      elapsed_ms: elapsed,
    };
  } catch (err) {
    log.error('Brand image search failed', { brandName }, err);
    return {
      query: brandName,
      total: 0,
      images: [],
      sources: [],
      elapsed_ms: Date.now() - startTime,
    };
  }
}

/**
 * Search for competitor images on specific domain
 */
export async function searchCompetitorImages(
  competitorUrl: string,
  signal?: AbortSignal
): Promise<ImageSearchResult[]> {
  try {
    log.info(`Searching competitor images at: ${competitorUrl}`);

    // Fetch competitor page
    const result = await wayfayerService.research(
      `site:${new URL(competitorUrl).hostname} product image`,
      10,
      signal
    );

    const images = extractImagesFromPages(result.pages).map(url => ({
      url,
      source: 'competitor' as const,
      domain: new URL(competitorUrl).hostname,
      found_at: competitorUrl,
    }));

    log.info(`Found ${images.length} competitor images from ${competitorUrl}`);
    return images;
  } catch (err) {
    log.warn(`Competitor image search failed for ${competitorUrl}`, {}, err);
    return [];
  }
}

/**
 * Search for specific product type images for a brand
 */
export async function searchProductCategoryImages(
  brandName: string,
  productType: string,
  signal?: AbortSignal
): Promise<ImageSearchResult[]> {
  try {
    log.info(`Searching ${productType} images for ${brandName}`);

    const result = await wayfayerService.research(
      `${brandName} ${productType} product photo bottle packaging`,
      12,
      signal,
      'month'
    );

    const images = extractImagesFromPages(result.pages).map(url => ({
      url,
      source: 'product-page' as const,
      title: `${brandName} ${productType}`,
      domain: new URL(url).hostname,
    }));

    log.info(`Found ${images.length} ${productType} images for ${brandName}`);
    return images;
  } catch (err) {
    log.warn(`Product category image search failed`, { brandName, productType }, err);
    return [];
  }
}

/**
 * Extract image URLs from page content
 * Looks for:
 * - Direct image links in content
 * - Social media image URLs
 * - Product/gallery image patterns
 */
function extractImagesFromPages(pages: any[]): string[] {
  const imageUrls = new Set<string>();
  const imageExtensions = /\.(jpg|jpeg|png|webp|gif)$/i;
  const imagePatterns = [
    /https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/gi,
    /(?:src|data-src)=["']([^"']+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?)/gi,
  ];

  for (const page of pages) {
    if (!page.content || typeof page.content !== 'string') continue;

    const content = page.content;

    // Try all patterns
    for (const pattern of imagePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1] || match[0];
        // Filter out small tracking pixels and common blockers
        if (url && url.length > 50 && !isBlacklisted(url)) {
          imageUrls.add(url);
        }
      }
    }

    // Extract from HTML-like tags
    const tagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      const url = match[1];
      if (url && url.length > 50 && imageExtensions.test(url)) {
        imageUrls.add(url);
      }
    }
  }

  return Array.from(imageUrls).slice(0, 100);  // Cap at 100 images
}

/**
 * Blacklist common tracking pixels and data URLs
 */
function isBlacklisted(url: string): boolean {
  const blacklist = [
    'pixel',
    'beacon',
    'tracker',
    'analytics',
    'data:image',
    'base64',
    '1x1',
    '1px',
    'spacer',
    'shim',
    '/ads/',
    '/tracking/',
  ];

  const lower = url.toLowerCase();
  return blacklist.some(term => lower.includes(term));
}

/**
 * Validate and normalize image URL
 */
export function validateImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Must be HTTP(S) and valid image extension
    return ['http:', 'https:'].includes(u.protocol) &&
           /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  } catch {
    return false;
  }
}

/**
 * Deduplicate images by URL and normalize
 */
export function deduplicateImages(images: ImageSearchResult[]): ImageSearchResult[] {
  const seen = new Set<string>();
  return images.filter(img => {
    const normalized = new URL(img.url).href;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Search social media for brand images
 * Targets Instagram, TikTok, Pinterest, etc
 */
export async function searchSocialMediaImages(
  brandName: string,
  platforms: string[] = ['instagram', 'tiktok', 'pinterest'],
  signal?: AbortSignal
): Promise<ImageSearchResult[]> {
  const allImages: ImageSearchResult[] = [];

  for (const platform of platforms) {
    if (signal?.aborted) break;

    try {
      log.info(`Searching ${platform} for ${brandName}`);

      let query = `${brandName} ${platform}`;
      if (platform === 'instagram') query = `site:instagram.com @${brandName}`;
      if (platform === 'tiktok') query = `site:tiktok.com ${brandName}`;
      if (platform === 'pinterest') query = `site:pinterest.com ${brandName}`;

      const result = await wayfayerService.research(query, 8, signal, 'week');
      const images = extractImagesFromPages(result.pages).map(url => ({
        url,
        source: 'social-media' as const,
        title: `${brandName} on ${platform}`,
        domain: platform,
      }));

      allImages.push(...images);
      log.info(`Found ${images.length} ${platform} images`);
    } catch (err) {
      log.warn(`Social media search failed for ${platform}`, { brandName }, err);
    }
  }

  return deduplicateImages(allImages);
}
