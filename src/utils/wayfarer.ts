/**
 * Wayfarer Service — Web research and content fetching
 * Wraps Wayfarer API for SearXNG integration and Playwright screenshots
 */

import { createLogger } from './logger.js';

const log = createLogger('wayfarer');

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
}

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
}

export class WayfarerService {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.VITE_WAYFARER_URL || 'http://localhost:8889') {
    this.baseUrl = baseUrl;
  }

  /**
   * Search using SearXNG
   */
  async search(query: string, numPages: number = 5): Promise<SearchResult[]> {
    try {
      log.info(`Searching: "${query}" (${numPages} pages)`);

      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, num_pages: numPages })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.results || [];
    } catch (error) {
      log.error('Search failed', { error });
      return [];
    }
  }

  /**
   * Fetch and parse a URL
   */
  async fetch(url: string): Promise<FetchedContent | null> {
    try {
      log.info(`Fetching: ${url}`);

      const response = await fetch(`${this.baseUrl}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        log.warn(`Fetch failed for ${url}`, { status: response.status });
        return null;
      }

      const data = await response.json() as any;
      return {
        url,
        title: data.title || 'Untitled',
        content: data.content || '',
        metadata: data.metadata || {}
      };
    } catch (error) {
      log.error(`Fetch error for ${url}`, { error });
      return null;
    }
  }

  /**
   * Search and fetch multiple URLs in parallel
   */
  async searchAndFetch(query: string, maxResults: number = 5): Promise<FetchedContent[]> {
    try {
      const results = await this.search(query, Math.ceil(maxResults / 5));
      const urls = results.slice(0, maxResults).map(r => r.url);

      const fetched = await Promise.all(
        urls.map(url => this.fetch(url))
      );

      return fetched.filter((f): f is FetchedContent => f !== null);
    } catch (error) {
      log.error('Search and fetch failed', { error });
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const wayfarerService = new WayfarerService();
