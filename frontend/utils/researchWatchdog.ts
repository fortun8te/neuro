/**
 * Research Watchdog — Per-site timeouts and coverage monitoring
 *
 * Monitors individual site scraping + synthesis operations and tracks
 * overall research coverage. Detects stalls, timeouts, and low coverage.
 * Coordinates replan decisions with the orchestrator.
 */

export interface SiteMonitor {
  url: string;
  startedAt: number;
  lastActivityAt: number;
  state: 'pending' | 'fetching' | 'compressing' | 'synthesizing' | 'done' | 'timeout' | 'error';
  durationMs?: number;
  errorMessage?: string;
}

export interface ResearchWatchdogConfig {
  /** Timeout per site (milliseconds) */
  siteTimeoutMs: number; // 60000ms = 60s default
  /** Warning threshold — log at 30s (half of timeout) */
  siteWarnThresholdMs: number; // 30000ms = 30s
  /** Overall research timeout */
  overallTimeoutMs: number; // 300000ms = 5 min default
  /** Minimum coverage to consider research sufficient */
  minCoveragePercentage: number; // 50% default
  /** If coverage below threshold, trigger replan */
  enableReplans: boolean;
}

export interface WatchdogStatus {
  sitesActive: number;
  sitesCompleted: number;
  sitesFailed: number;
  averageSiteDurationMs: number;
  warningThresholdHits: string[]; // URLs hitting 30s threshold
  timeoutHits: string[]; // URLs hitting 60s timeout
  overallElapsedMs: number;
  shouldReplan: boolean;
  replanReason?: string;
}

export class ResearchWatchdog {
  private config: ResearchWatchdogConfig;
  private sites: Map<string, SiteMonitor> = new Map();
  private startedAt: number = Date.now();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private onWarning?: (url: string, durationMs: number) => void;
  private onTimeout?: (url: string) => void;
  private onReplanNeeded?: (reason: string) => void;

  constructor(
    config: Partial<ResearchWatchdogConfig> = {},
    callbacks?: {
      onWarning?: (url: string, durationMs: number) => void;
      onTimeout?: (url: string) => void;
      onReplanNeeded?: (reason: string) => void;
    }
  ) {
    this.config = {
      siteTimeoutMs: config.siteTimeoutMs ?? 60_000,
      siteWarnThresholdMs: config.siteWarnThresholdMs ?? 30_000,
      overallTimeoutMs: config.overallTimeoutMs ?? 300_000,
      minCoveragePercentage: config.minCoveragePercentage ?? 50,
      enableReplans: config.enableReplans ?? true,
    };
    this.onWarning = callbacks?.onWarning;
    this.onTimeout = callbacks?.onTimeout;
    this.onReplanNeeded = callbacks?.onReplanNeeded;
  }

  /**
   * Start monitoring a site scrape/synthesis operation
   */
  startMonitoring(url: string): void {
    const now = Date.now();
    this.sites.set(url, {
      url,
      startedAt: now,
      lastActivityAt: now,
      state: 'pending',
    });
  }

  /**
   * Update site state (e.g., fetching -> compressing -> synthesizing)
   */
  recordActivity(url: string, state: SiteMonitor['state']): void {
    const monitor = this.sites.get(url);
    if (monitor) {
      monitor.lastActivityAt = Date.now();
      monitor.state = state;
    }
  }

  /**
   * Mark site as completed
   */
  markDone(url: string): void {
    const monitor = this.sites.get(url);
    if (monitor) {
      const now = Date.now();
      monitor.state = 'done';
      monitor.durationMs = now - monitor.startedAt;
      monitor.lastActivityAt = now;
    }
  }

  /**
   * Mark site as failed
   */
  markError(url: string, error: string): void {
    const monitor = this.sites.get(url);
    if (monitor) {
      const now = Date.now();
      monitor.state = 'error';
      monitor.durationMs = now - monitor.startedAt;
      monitor.errorMessage = error;
      monitor.lastActivityAt = now;
    }
  }

  /**
   * Check for timeouts and stalls — call periodically
   * Returns status with warnings/timeouts
   */
  check(currentCoveragePercentage?: number): WatchdogStatus {
    const now = Date.now();
    const overallElapsed = now - this.startedAt;
    const warningThresholdHits: string[] = [];
    const timeoutHits: string[] = [];
    let sitesActive = 0;
    let sitesCompleted = 0;
    let sitesFailed = 0;
    let totalDuration = 0;
    let completedCount = 0;

    this.sites.forEach((monitor, url) => {
      const elapsed = now - monitor.startedAt;
      const lastActivity = now - monitor.lastActivityAt;

      // Check if site is stalled (no activity for half the timeout)
      if (monitor.state !== 'done' && monitor.state !== 'error' && monitor.state !== 'timeout') {
        sitesActive++;
        if (lastActivity > this.config.siteWarnThresholdMs) {
          warningThresholdHits.push(url);
          this.onWarning?.(url, elapsed);
        }
        if (elapsed > this.config.siteTimeoutMs) {
          monitor.state = 'timeout';
          monitor.durationMs = elapsed;
          timeoutHits.push(url);
          this.onTimeout?.(url);
        }
      } else if (monitor.state === 'done') {
        sitesCompleted++;
        if (monitor.durationMs) {
          totalDuration += monitor.durationMs;
          completedCount++;
        }
      } else if (monitor.state === 'error' || monitor.state === 'timeout') {
        sitesFailed++;
      }
    });

    const averageSiteDurationMs = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

    // Determine if replan is needed
    let shouldReplan = false;
    let replanReason: string | undefined;

    if (this.config.enableReplans) {
      // If overall time exceeds 5min AND coverage is still low, replan
      if (overallElapsed > this.config.overallTimeoutMs && currentCoveragePercentage && currentCoveragePercentage < this.config.minCoveragePercentage) {
        shouldReplan = true;
        replanReason = `Coverage low (${Math.round(currentCoveragePercentage)}%) after 5min, searching more sources`;
        this.onReplanNeeded?.(replanReason);
      }
    }

    return {
      sitesActive,
      sitesCompleted,
      sitesFailed,
      averageSiteDurationMs,
      warningThresholdHits,
      timeoutHits,
      overallElapsedMs: overallElapsed,
      shouldReplan,
      replanReason,
    };
  }

  /**
   * Start a periodic check loop
   */
  startChecking(
    intervalMs: number = 5_000,
    onStatusUpdate?: (status: WatchdogStatus, coverage?: number) => void,
    getCoveragePercentage?: () => number
  ): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      const coverage = getCoveragePercentage?.();
      const status = this.check(coverage);
      onStatusUpdate?.(status, coverage);
    }, intervalMs);
  }

  /**
   * Stop the periodic check loop
   */
  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current status without triggering callbacks
   */
  getStatus(currentCoveragePercentage?: number): WatchdogStatus {
    return this.check(currentCoveragePercentage);
  }

  /**
   * Get all monitored sites and their states
   */
  getSites(): SiteMonitor[] {
    const result: SiteMonitor[] = [];
    this.sites.forEach((monitor) => {
      result.push(monitor);
    });
    return result;
  }

  /**
   * Format a human-readable status report
   */
  formatReport(status: WatchdogStatus): string {
    const lines: string[] = [
      `Research Watchdog: ${status.sitesCompleted}/${status.sitesCompleted + status.sitesActive + status.sitesFailed} sites completed (${status.sitesFailed} failed)`,
      `Overall elapsed: ${Math.round(status.overallElapsedMs / 1000)}s`,
      `Avg site duration: ${status.averageSiteDurationMs}ms`,
    ];

    if (status.warningThresholdHits.length > 0) {
      lines.push(`Slow sites (>30s): ${status.warningThresholdHits.join(', ')}`);
    }

    if (status.timeoutHits.length > 0) {
      lines.push(`Timed out (>60s): ${status.timeoutHits.join(', ')}`);
    }

    if (status.shouldReplan) {
      lines.push(`REPLAN TRIGGERED: ${status.replanReason}`);
    }

    return lines.join('\n');
  }
}

/**
 * Helper to create an abort controller with a timeout
 * Returns (controller, cleanup function)
 */
export function createTimeoutController(
  timeoutMs: number,
  onTimeout?: () => void
): [AbortController, () => void] {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  timeoutId = setTimeout(() => {
    onTimeout?.();
    controller.abort();
  }, timeoutMs);

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return [controller, cleanup];
}
