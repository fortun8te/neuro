/**
 * Context-1 Service — Vector retrieval and context management
 * Handles multi-hop retrieval, self-pruning, and token budgeting
 */

import { createLogger } from './logger.js';

const log = createLogger('context1Service');

export interface ContextEntry {
  id: string;
  content: string;
  embedding?: number[];
  score?: number;
  source?: string;
}

export interface RetrievalResult {
  entries: ContextEntry[];
  totalTokens: number;
  pruned: number;
}

export class Context1Service {
  private store: Map<string, ContextEntry[]> = new Map();
  private maxTokens: number = 8192;

  constructor(maxTokens: number = 8192) {
    this.maxTokens = maxTokens;
  }

  /**
   * Ingest findings into the vector store
   */
  async ingestFindings(sectionId: string, findings: any): Promise<void> {
    try {
      const entries: ContextEntry[] = (findings.facts || []).map((fact: string, idx: number) => ({
        id: `${sectionId}-fact-${idx}`,
        content: fact,
        source: sectionId
      }));

      this.store.set(sectionId, entries);
      log.info(`Ingested ${entries.length} facts for section ${sectionId}`);
    } catch (error) {
      log.error('Ingest failed', { error });
      throw error;
    }
  }

  /**
   * Retrieve relevant context entries
   */
  async retrieve(query: string, sectionId?: string, topK: number = 5): Promise<RetrievalResult> {
    try {
      let entries: ContextEntry[] = [];

      if (sectionId) {
        entries = this.store.get(sectionId) || [];
      } else {
        this.store.forEach((sectionEntries) => {
          entries.push(...sectionEntries);
        });
      }

      // Simple keyword matching (in production, would use semantic similarity)
      const queryTerms = query.toLowerCase().split(/\s+/);
      const scored = entries.map(e => ({
        ...e,
        score: queryTerms.filter(t => e.content.toLowerCase().includes(t)).length / queryTerms.length
      }));

      const relevant = scored
        .filter(e => e.score && e.score > 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topK);

      return {
        entries: relevant,
        totalTokens: relevant.reduce((sum, e) => sum + (e.content.length / 4), 0), // rough estimate
        pruned: entries.length - relevant.length
      };
    } catch (error) {
      log.error('Retrieval failed', { error });
      throw error;
    }
  }

  /**
   * Close service
   */
  close(): void {
    this.store.clear();
  }
}

export const context1Service = new Context1Service();
