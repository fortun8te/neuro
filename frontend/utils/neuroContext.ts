/**
 * NEURO CONTEXT INTEGRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Upgrades Neuro's decision-making by leveraging Context-1 capabilities:
 * - Vector-based semantic reasoning (instead of keyword routing)
 * - Semantic memory (past decisions stored as vectors)
 * - Intelligent tool selection via hybrid scoring
 * - Token budget aware planning
 * - Context compression with reranking
 * - Multi-round decision refinement
 *
 * This makes Neuro smarter, faster, and more aligned with its intentions.
 */

import { generateEmbedding, cosineSimilarity } from './embeddingService';
import { rerankChunks } from './rerankerService';
import { createLogger } from './logger';

const log = createLogger('neuro-context');

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC MEMORY TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MemoryVector {
  id: string;
  content: string;         // The memory (past decision, outcome, pattern)
  embedding: number[];     // 768-dim semantic representation
  timestamp: number;
  confidence: number;      // How reliable this memory is (0-1)
  category: 'decision' | 'outcome' | 'pattern' | 'strategy';
  metadata?: Record<string, unknown>;
}

export interface SemanticContext {
  query: string;
  queryEmbedding: number[];
  relevantMemories: MemoryVector[];
  confidenceAvg: number;
  durationMs: number;
}

export interface ToolRoutingDecision {
  toolName: string;
  confidence: number;      // 0-1 based on hybrid scoring
  reasoningSteps: string[];
  semanticScore: number;   // How well tool matches intent
  historicalScore: number; // Based on past successes
  tokenEstimate: number;
}

export interface DecisionContext {
  situation: string;
  intent: string;
  constraints: {
    tokenBudget: number;
    timeLimit?: number;
    toolsAvailable: string[];
  };
  pastSimilarDecisions: MemoryVector[];
  recommendedTools: ToolRoutingDecision[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC MEMORY STORE
// ═══════════════════════════════════════════════════════════════════════════

class SemanticMemoryStore {
  private memories: Map<string, MemoryVector> = new Map();
  private nextId = 0;

  /**
   * Add a memory (decision, outcome, pattern) to semantic store
   */
  async addMemory(
    content: string,
    category: MemoryVector['category'],
    confidence: number = 0.8,
    metadata?: Record<string, unknown>
  ): Promise<MemoryVector> {
    try {
      const result = await generateEmbedding(content);

      const memory: MemoryVector = {
        id: `mem_${this.nextId++}`,
        content,
        embedding: result.embedding,
        timestamp: Date.now(),
        confidence,
        category,
        metadata,
      };

      this.memories.set(memory.id, memory);
      log.info(`Added ${category} memory`, { id: memory.id, confidence });

      return memory;
    } catch (err) {
      log.error('Failed to add memory', {}, err);
      throw err;
    }
  }

  /**
   * Retrieve semantically similar memories
   */
  async retrieveSimilar(
    query: string,
    topK: number = 5,
    minConfidence: number = 0.6
  ): Promise<MemoryVector[]> {
    try {
      const result = await generateEmbedding(query);

      const scored = Array.from(this.memories.values())
        .filter(m => m.confidence >= minConfidence)
        .map(m => ({
          ...m,
          similarity: cosineSimilarity(result.embedding, m.embedding),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(({ similarity, ...m }) => m);

      return scored;
    } catch (err) {
      log.error('Failed to retrieve memories', {}, err);
      return [];
    }
  }

  /**
   * Get context-aware memories for a situation
   */
  async getContextualMemories(
    situation: string,
    category?: MemoryVector['category']
  ): Promise<SemanticContext> {
    try {
      const startTime = Date.now();
      const result = await generateEmbedding(situation);

      let candidates = Array.from(this.memories.values());
      if (category) {
        candidates = candidates.filter(m => m.category === category);
      }

      const scored = candidates
        .map(m => ({
          ...m,
          similarity: cosineSimilarity(result.embedding, m.embedding),
        }))
        .filter(m => m.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10)
        .map(({ similarity, ...m }) => m);

      const confidenceAvg =
        scored.length > 0
          ? scored.reduce((sum, m) => sum + m.confidence, 0) / scored.length
          : 0;

      return {
        query: situation,
        queryEmbedding: result.embedding,
        relevantMemories: scored,
        confidenceAvg,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      log.error('Failed to get contextual memories', {}, err);
      return {
        query: situation,
        queryEmbedding: Array(768).fill(0),
        relevantMemories: [],
        confidenceAvg: 0,
        durationMs: 0,
      };
    }
  }

  /**
   * Consolidate memories by removing redundant ones
   */
  async consolidate(similarityThreshold: number = 0.85): Promise<number> {
    const memories = Array.from(this.memories.values());
    const removed = new Set<string>();

    for (let i = 0; i < memories.length; i++) {
      if (removed.has(memories[i].id)) continue;

      for (let j = i + 1; j < memories.length; j++) {
        if (removed.has(memories[j].id)) continue;

        const similarity = cosineSimilarity(
          memories[i].embedding,
          memories[j].embedding
        );

        if (similarity > similarityThreshold) {
          // Keep higher confidence memory, remove lower
          const toRemove =
            memories[i].confidence >= memories[j].confidence ? j : i;
          removed.add(memories[toRemove].id);
          this.memories.delete(memories[toRemove].id);
        }
      }
    }

    log.info(`Consolidated memories`, { removed: removed.size });
    return removed.size;
  }

  /**
   * Export all memories for persistence
   */
  export(): MemoryVector[] {
    return Array.from(this.memories.values());
  }

  /**
   * Import memories from persistence
   */
  import(memories: MemoryVector[]): void {
    for (const m of memories) {
      this.memories.set(m.id, m);
      this.nextId = Math.max(this.nextId, parseInt(m.id.split('_')[1]) + 1);
    }
    log.info(`Imported memories`, { count: memories.length });
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
    this.nextId = 0;
    log.info('Cleared all memories');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC TOOL ROUTING
// ═══════════════════════════════════════════════════════════════════════════

export class SemanticToolRouter {
  private memoryStore: SemanticMemoryStore;

  constructor() {
    this.memoryStore = new SemanticMemoryStore();
  }

  /**
   * Recommend tools using semantic reasoning + historical patterns
   */
  async decideTools(
    situation: string,
    intent: string,
    availableTools: string[],
    tokenBudget: number
  ): Promise<DecisionContext> {
    try {
      // 1. Get contextual memories from past similar decisions
      const context = await this.memoryStore.getContextualMemories(
        `${situation} ${intent}`,
        'decision'
      );

      // 2. Score each tool semantically
      const toolScores: ToolRoutingDecision[] = [];

      for (const tool of availableTools) {
        // Semantic match: how relevant is this tool to the intent?
        const toolResult = await generateEmbedding(tool);
        const semanticScore = cosineSimilarity(
          context.queryEmbedding,
          toolResult.embedding
        );

        // Historical score: how often has this tool succeeded in similar situations?
        const pastSuccesses = context.relevantMemories
          .filter(m => m.metadata?.tool === tool && m.category === 'outcome')
          .map(m => m.confidence);

        const historicalScore =
          pastSuccesses.length > 0
            ? pastSuccesses.reduce((a, b) => a + b) / pastSuccesses.length
            : 0.5; // neutral if no history

        // Combined confidence
        const confidence = semanticScore * 0.6 + historicalScore * 0.4;

        // Estimate tokens (rough)
        const tokenEstimate = this.estimateTokens(tool);

        toolScores.push({
          toolName: tool,
          confidence,
          reasoningSteps: [
            `Semantic match: ${(semanticScore * 100).toFixed(0)}%`,
            `Historical success: ${(historicalScore * 100).toFixed(0)}%`,
            `Est. tokens: ${tokenEstimate}`,
          ],
          semanticScore,
          historicalScore,
          tokenEstimate,
        });
      }

      // 3. Filter by token budget
      const recommended = toolScores
        .filter(t => t.tokenEstimate <= tokenBudget * 0.5) // Use max 50% budget per tool
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Top 3 options

      return {
        situation,
        intent,
        constraints: {
          tokenBudget,
          toolsAvailable: availableTools,
        },
        pastSimilarDecisions: context.relevantMemories,
        recommendedTools: recommended,
      };
    } catch (err) {
      log.error('Tool routing failed', {}, err);
      return {
        situation,
        intent,
        constraints: { tokenBudget, toolsAvailable: availableTools },
        pastSimilarDecisions: [],
        recommendedTools: availableTools.slice(0, 3).map(tool => ({
          toolName: tool,
          confidence: 0.5,
          reasoningSteps: ['Fallback routing'],
          semanticScore: 0.5,
          historicalScore: 0.5,
          tokenEstimate: 100,
        })),
      };
    }
  }

  /**
   * Record a tool use and its outcome
   */
  async recordDecision(
    tool: string,
    success: boolean,
    situation: string
  ): Promise<void> {
    const confidence = success ? 0.9 : 0.3;
    await this.memoryStore.addMemory(
      `Used ${tool} for: ${situation}`,
      'decision',
      confidence,
      { tool, success, situation }
    );

    if (success) {
      await this.memoryStore.addMemory(
        `${tool} succeeded when: ${situation}`,
        'outcome',
        0.9,
        { tool, success: true }
      );
    }
  }

  /**
   * Rough token estimator for tools
   */
  private estimateTokens(toolName: string): number {
    const estimates: Record<string, number> = {
      web_search: 200,
      multi_browse: 300,
      workspace_save: 50,
      workspace_read: 200,
      think: 150,
      search_knowledge: 300,
      analyze: 250,
    };

    return estimates[toolName] || 100;
  }

  /**
   * Get memory store for direct access
   */
  getMemoryStore(): SemanticMemoryStore {
    return this.memoryStore;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT COMPRESSION WITH RERANKING
// ═══════════════════════════════════════════════════════════════════════════

export async function compressContext(
  context: string,
  query: string,
  maxTokens: number = 1000
): Promise<{ compressed: string; quality: number }> {
  try {
    // Split context into chunks
    const sentences = context.match(/[^.!?]+[.!?]+/g) || [context];
    const chunks = sentences.map((s, i) => ({ chunkId: `chunk_${i}`, content: s.trim() }));

    // Rerank by relevance to query
    const reranked = await rerankChunks(query, chunks);

    // Select top chunks until token limit
    let selected = '';
    let tokens = 0;

    for (const chunk of reranked) {
      const chunkTokens = chunk.content.split(/\s+/).length;
      if (tokens + chunkTokens > maxTokens) break;

      selected += chunk.content + ' ';
      tokens += chunkTokens;
    }

    const quality = reranked.length > 0 ? reranked[0].relevanceScore : 0.5;

    return {
      compressed: selected.trim(),
      quality,
    };
  } catch (err) {
    log.error('Context compression failed', {}, err);
    return { compressed: context.slice(0, maxTokens * 4), quality: 0.3 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTENT DETECTION WITH SEMANTIC ROUTING
// ═══════════════════════════════════════════════════════════════════════════

export async function detectIntent(
  userMessage: string
): Promise<{ intent: string; confidence: number; category: string }> {
  try {
    const intentPatterns = [
      {
        category: 'research',
        keywords: ['research', 'find', 'look up', 'investigate', 'analyze'],
      },
      {
        category: 'creative',
        keywords: ['create', 'write', 'design', 'generate', 'compose'],
      },
      {
        category: 'planning',
        keywords: ['plan', 'organize', 'schedule', 'arrange', 'structure'],
      },
      {
        category: 'coding',
        keywords: ['code', 'program', 'debug', 'implement', 'build'],
      },
      {
        category: 'analysis',
        keywords: ['analyze', 'compare', 'evaluate', 'review', 'assess'],
      },
    ];

    const msgResult = await generateEmbedding(userMessage);
    let bestMatch = { category: 'general', confidence: 0 };

    for (const pattern of intentPatterns) {
      for (const keyword of pattern.keywords) {
        const keywordResult = await generateEmbedding(keyword);
        const similarity = cosineSimilarity(msgResult.embedding, keywordResult.embedding);

        if (similarity > bestMatch.confidence) {
          bestMatch = { category: pattern.category, confidence: similarity };
        }
      }
    }

    return {
      intent: userMessage,
      confidence: bestMatch.confidence,
      category: bestMatch.category,
    };
  } catch (err) {
    log.error('Intent detection failed', {}, err);
    return { intent: userMessage, confidence: 0.5, category: 'general' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCES
// ═══════════════════════════════════════════════════════════════════════════

export const semanticRouter = new SemanticToolRouter();
