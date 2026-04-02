/**
 * Track context budget across system, messages, tool results, and images
 */

import { countTokensAccurate, countImageTokens } from './tokenCounterAccurate';

export interface ContextBudgetSnapshot {
  system: number;
  messages: number;
  toolResults: number;
  images: number;
  total: number;
  available: number;
  utilizationPercent: number;
}

export class ContextBudgetTracker {
  private allocated = 0;
  private components = {
    system: 0,
    messages: 0,
    toolResults: 0,
    images: 0,
  };

  readonly window: number;
  readonly reserveForResponse: number;

  constructor(window: number = 32768, reserveForResponse: number = 4000) {
    this.window = window;
    this.reserveForResponse = reserveForResponse;
  }

  /**
   * Record system prompt tokens
   */
  recordSystem(prompt: string): void {
    this.components.system = countTokensAccurate(prompt);
    this.recalculateAllocated();
  }

  /**
   * Record message tokens
   */
  recordMessages(messages: Array<{ role: string; content: string }>): void {
    this.components.messages = messages.reduce(
      (sum, m) => sum + countTokensAccurate(m.content),
      0
    );
    this.recalculateAllocated();
  }

  /**
   * Record tool result tokens
   */
  addToolResult(content: string, resultId?: string): number {
    const tokens = countTokensAccurate(content);
    this.components.toolResults += tokens;
    this.recalculateAllocated();
    return tokens;
  }

  /**
   * Record image tokens
   */
  addImage(width: number, height: number, detail: 'low' | 'high' = 'high'): number {
    const tokens = countImageTokens(width, height, detail);
    this.components.images += tokens;
    this.recalculateAllocated();
    return tokens;
  }

  /**
   * Check if new tokens can fit
   */
  canAllocate(tokensNeeded: number): boolean {
    return this.allocated + tokensNeeded + this.reserveForResponse <= this.window;
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): ContextBudgetSnapshot {
    const total = this.allocated;
    const available = Math.max(0, this.window - total - this.reserveForResponse);
    const utilizationPercent = (total / (this.window - this.reserveForResponse)) * 100;

    return {
      system: this.components.system,
      messages: this.components.messages,
      toolResults: this.components.toolResults,
      images: this.components.images,
      total,
      available,
      utilizationPercent,
    };
  }

  /**
   * Get human-readable summary
   */
  getSummary(): string {
    const snap = this.getSnapshot();
    return `
Context Budget:
  System: ${snap.system} tokens
  Messages: ${snap.messages} tokens
  Tool Results: ${snap.toolResults} tokens
  Images: ${snap.images} tokens
  ─────────────────
  Total: ${snap.total} tokens
  Available: ${snap.available} tokens
  Utilization: ${snap.utilizationPercent.toFixed(1)}%
`;
  }

  private recalculateAllocated(): void {
    this.allocated =
      this.components.system +
      this.components.messages +
      this.components.toolResults +
      this.components.images;
  }
}

export const contextBudgetTracker = new ContextBudgetTracker();
