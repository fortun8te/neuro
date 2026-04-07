/**
 * LEAN Monitoring — Health checks + basic alerts only
 */

// ============================================================================
// HEALTH MONITOR (simple status checks)
// ============================================================================

export class HealthMonitor {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private lastStatus: Map<string, boolean> = new Map();

  registerCheck(name: string, checker: () => Promise<boolean>) {
    this.checks.set(name, checker);
  }

  async runAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, check] of this.checks) {
      try {
        const healthy = await check();
        results[name] = healthy;
        this.lastStatus.set(name, healthy);
      } catch (e) {
        results[name] = false;
        this.lastStatus.set(name, false);
      }
    }
    return results;
  }

  getStatus() {
    const result: Record<string, boolean> = {};
    this.lastStatus.forEach((v, k) => (result[k] = v));
    return result;
  }
}

// ============================================================================
// ALERT MANAGER (simple threshold-based alerts)
// ============================================================================

export class AlertManager {
  private rules: Map<
    string,
    {
      check: (metrics: any) => boolean;
      severity: 'warning' | 'critical';
      handler: () => Promise<void>;
    }
  > = new Map();
  private recentAlerts: { rule: string; severity: string; timestamp: number }[] = [];

  registerRule(
    name: string,
    check: (metrics: any) => boolean,
    severity: 'warning' | 'critical',
    handler: () => Promise<void>
  ) {
    this.rules.set(name, { check, severity, handler });
  }

  async evaluate(metrics: any) {
    for (const [name, rule] of this.rules) {
      if (rule.check(metrics)) {
        this.recentAlerts.push({ rule: name, severity: rule.severity, timestamp: Date.now() });
        await rule.handler().catch(() => {});
        if (this.recentAlerts.length > 50) this.recentAlerts.shift();
      }
    }
  }

  getAlerts(since?: number) {
    if (!since) return this.recentAlerts;
    return this.recentAlerts.filter(a => a.timestamp > since);
  }
}

// ============================================================================
// OBSERVABILITY DASHBOARD (simple aggregator)
// ============================================================================

export class ObservabilityDashboard {
  healthChecks = new HealthMonitor();
  alerts = new AlertManager();

  getStatus() {
    return {
      timestamp: new Date().toISOString(),
      health: this.healthChecks.getStatus(),
      recentAlerts: this.alerts.getAlerts(),
    };
  }
}
