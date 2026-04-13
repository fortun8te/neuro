// ══════════════════════════════════════════════════════
// ██  Monitoring Types — Real-Time System Dashboard
// ══════════════════════════════════════════════════════

export interface ModelStatus {
  modelName: string;
  activeTasks: number;
  maxConcurrent: number;
  avgResponseTime: number; // ms, average of last 10 requests
  successRate: number; // 0-1
  vramEstimate: number; // MB
  status: 'idle' | 'busy' | 'overloaded' | 'offline';
  circuitState: 'closed' | 'open' | 'half-open';
  errorCount: number;
  lastErrorTime: number | null; // timestamp ms
  recoveryCountdownMs: number | null; // ms until circuit re-closes
}

export interface SystemHealth {
  models: ModelStatus[];
  globalActiveTasks: number;
  globalMaxTasks: number;
  totalVramUsedMB: number;
  totalVramAvailableMB: number; // 40GB default
  uptimeMs: number;
  requestsPerMinute: number;
  errorRate: number; // 0-1
  overallStatus: 'healthy' | 'degraded' | 'critical';
}

export interface TaskEvent {
  id: string;
  modelName: string;
  stage: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
  tokensGenerated?: number;
  durationMs?: number;
}

// RPM sparkline data point
export interface RpmPoint {
  ts: number; // timestamp
  count: number;
}
