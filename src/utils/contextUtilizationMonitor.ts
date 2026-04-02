/**
 * Monitor context utilization and trigger proactive compression
 */

export interface UtilizationBudget {
  totalWindow: number;
  used: number;
  reserved: number;
  available: number;
  percentUsed: number;
}

export interface UtilizationEvent {
  type: 'healthy' | 'warning' | 'critical' | 'emergency';
  utilization: number;
  message: string;
  recommendation?: string;
}

export class ContextUtilizationMonitor {
  // Thresholds (as percentages, 0-100)
  readonly SOFT_THRESHOLD = 50;    // 50% — start thinking about compression
  readonly WARNING_THRESHOLD = 70; // 70% — recommend compression soon
  readonly HARD_CEILING = 85;      // 85% — compress immediately
  readonly CRITICAL = 95;           // 95% — stop accepting new tools

  readonly contextWindowSize: number;
  readonly reserveForResponse: number;

  constructor(
    contextWindowSize: number = 32768,
    reserveForResponse: number = 4000
  ) {
    this.contextWindowSize = contextWindowSize;
    this.reserveForResponse = reserveForResponse;
  }

  /**
   * Calculate utilization budget
   */
  calculateBudget(
    systemPromptTokens: number,
    messageTokens: number,
    toolResultTokens: number,
    imageTokens: number = 0
  ): UtilizationBudget {
    const used = systemPromptTokens + messageTokens + toolResultTokens + imageTokens;
    const usableWindow = this.contextWindowSize - this.reserveForResponse;
    const available = Math.max(0, usableWindow - used);
    const percentUsed = (used / usableWindow) * 100;

    return {
      totalWindow: this.contextWindowSize,
      used,
      reserved: this.reserveForResponse,
      available,
      percentUsed,
    };
  }

  /**
   * Get current utilization status
   */
  getStatus(budget: UtilizationBudget): UtilizationEvent {
    const util = budget.percentUsed / 100;

    if (budget.percentUsed >= this.CRITICAL) {
      return {
        type: 'emergency',
        utilization: util,
        message: `EMERGENCY: Context at ${budget.percentUsed.toFixed(0)}% — rejecting new tools`,
        recommendation: 'Abort current operation and compress'
      };
    }

    if (budget.percentUsed >= this.HARD_CEILING) {
      return {
        type: 'critical',
        utilization: util,
        message: `CRITICAL: Context at ${budget.percentUsed.toFixed(0)}% — compress now`,
        recommendation: 'Trigger emergency compression'
      };
    }

    if (budget.percentUsed >= this.WARNING_THRESHOLD) {
      return {
        type: 'warning',
        utilization: util,
        message: `WARNING: Context at ${budget.percentUsed.toFixed(0)}% — compression recommended`,
        recommendation: 'Consider compression, fewer parallel tools'
      };
    }

    if (budget.percentUsed >= this.SOFT_THRESHOLD) {
      return {
        type: 'warning',
        utilization: util,
        message: `Context at ${budget.percentUsed.toFixed(0)}% — soft threshold reached`,
        recommendation: 'Begin proactive compression planning'
      };
    }

    return {
      type: 'healthy',
      utilization: util,
      message: `Context utilization: ${budget.percentUsed.toFixed(0)}%`
    };
  }

  /**
   * Check if new tool call should be rejected
   */
  shouldRejectNewTool(budget: UtilizationBudget): boolean {
    return budget.percentUsed > 95;
  }

  /**
   * Check if compression should be triggered
   */
  shouldTriggerCompression(budget: UtilizationBudget): boolean {
    return budget.percentUsed >= this.SOFT_THRESHOLD;
  }

  /**
   * Estimate tokens needed for new tool call
   */
  canAllocate(budget: UtilizationBudget, tokensNeeded: number): boolean {
    return budget.available >= tokensNeeded;
  }
}
