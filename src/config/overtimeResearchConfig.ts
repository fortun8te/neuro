/**
 * Overnight Research Configuration
 * Optimized for long-running, unattended research cycles
 * Maximum depth preset with aggressive checkpointing and recovery
 */

import type { ResearchLimits } from '../types/index';

/**
 * Overnight research mode: MAXIMUM preset with optimization tweaks
 */
export const OVERNIGHT_RESEARCH_LIMITS: ResearchLimits = {
  // Base MAXIMUM preset parameters
  maxIterations: 100,
  minIterations: 25,
  coverageThreshold: 0.995,
  minSources: 400,
  maxResearchersPerIteration: 5,
  maxTimeMinutes: 480, // 8 hours for research phase only
  parallelCompressionCount: 12,

  // Feature flags - all advanced features enabled
  crossValidation: true,
  multiLanguageSearch: true,
  historicalAnalysis: true,
  communityDeepDive: true,
  competitorAdScrape: true,
  academicSearch: true,

  // Visual intelligence
  maxVisualBatches: 5,
  maxVisualUrls: 30,

  // Reflection and iteration
  skipReflection: false,
  singlePassResearch: false,

  // Subagent support
  useSubagents: true,
};

// Nested type definitions
interface CheckpointConfig {
  enabled: true;
  intervalMs: number;
  maxConcurrentCheckpoints: number;
  compressionLevel: 'aggressive';
}

interface ResourcesConfig {
  memoryLimitMb: number;
  maxCpuPercent: number;
  maxNetworkConcurrency: number;
}

interface RecoveryConfig {
  enabled: true;
  maxRetries: number;
  retryBackoffMs: number;
  resumeFromCheckpoint: true;
}

interface AlertThresholds {
  errorRate: number;
  memoryUsagePercent: number;
  checkpointFailureCount: number;
}

interface MonitoringConfig {
  healthCheckIntervalMs: number;
  logLevel: 'info' | 'debug';
  metricsCollection: boolean;
  alertThresholds: AlertThresholds;
}

interface DocumentConfig {
  enabled: true;
  format: 'docx';
  streamingOutput: true;
  includeCharts: true;
  includeImages: true;
}

interface ImagesConfig {
  enabled: true;
  maxImagesPerSession: number;
  maxImageSizeMb: number;
  formats: string[];
  compressionQuality: number;
}

interface TimeoutsConfig {
  researchPhaseMaxMs: number;
  singleRequestMaxMs: number;
  compressionTimeoutMs: number;
}

interface LoggingConfig {
  enabled: true;
  logDir: string;
  logFileName: string;
  enableVerboseApiLogging: boolean;
  enableStackTraces: true;
}

/**
 * Overnight research session configuration
 * Controls checkpointing, recovery, resource management
 */
export interface OvernightSessionConfig {
  // Session identity
  sessionId: string;
  campaignBrief: string;
  researchTopic: string;
  startTime: number;

  // Research parameters
  researchLimits: ResearchLimits;
  modelTier: 'maximum';

  // Checkpointing strategy
  checkpoint: CheckpointConfig;

  // Resource management
  resources: ResourcesConfig;

  // Recovery and restart policy
  recovery: RecoveryConfig;

  // Monitoring and health checks
  monitoring: MonitoringConfig;

  // Document generation
  document: DocumentConfig;

  // Image collection
  images: ImagesConfig;

  // Timeout policies
  timeouts: TimeoutsConfig;

  // Logging and output
  logging: LoggingConfig;
}

/**
 * Create a new overnight session configuration
 */
export function createOvernightSessionConfig(
  campaignBrief: string,
  researchTopic: string,
  sessionId?: string
): OvernightSessionConfig {
  return {
    sessionId: sessionId || `overnight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    campaignBrief,
    researchTopic,
    startTime: Date.now(),
    researchLimits: OVERNIGHT_RESEARCH_LIMITS,
    modelTier: 'maximum',
    checkpoint: {
      enabled: true,
      intervalMs: 30000,
      maxConcurrentCheckpoints: 2,
      compressionLevel: 'aggressive',
    },
    resources: {
      memoryLimitMb: 1024,
      maxCpuPercent: 85,
      maxNetworkConcurrency: 32,
    },
    recovery: {
      enabled: true,
      maxRetries: 3,
      retryBackoffMs: 5000,
      resumeFromCheckpoint: true,
    },
    monitoring: {
      healthCheckIntervalMs: 300000,
      logLevel: 'info',
      metricsCollection: true,
      alertThresholds: {
        errorRate: 0.1,
        memoryUsagePercent: 80,
        checkpointFailureCount: 3,
      },
    },
    document: {
      enabled: true,
      format: 'docx',
      streamingOutput: true,
      includeCharts: true,
      includeImages: true,
    },
    images: {
      enabled: true,
      maxImagesPerSession: 100,
      maxImageSizeMb: 5,
      formats: ['jpg', 'png', 'webp'],
      compressionQuality: 70,
    },
    timeouts: {
      researchPhaseMaxMs: 480 * 60 * 1000,
      singleRequestMaxMs: 120000,
      compressionTimeoutMs: 60000,
    },
    logging: {
      enabled: true,
      logDir: '/tmp',
      logFileName: 'session.log',
      enableVerboseApiLogging: false,
      enableStackTraces: true,
    },
  };
}

/**
 * Session state tracked during overnight run
 * Persisted to IndexedDB every checkpoint interval
 */
export interface OvernightSessionState {
  config: OvernightSessionConfig;
  status: 'initializing' | 'running' | 'paused' | 'complete' | 'failed' | 'recovered';
  currentCycleNum: number;
  currentStage: string; // 'research' | 'objections' | 'taste' | 'make' | 'test' | 'memories'

  // Research progress
  research: {
    iterationsCompleted: number;
    sourcesFound: number;
    tokensUsed: number;
    lastIterationTime: number;
    averageIterationTimeMs: number;
  },

  // Resource tracking
  resources: {
    memoryUsageMb: number;
    cpuPercentUsed: number;
    uptime: number;
    requestsInFlight: number;
  },

  // Checkpointing
  checkpoints: {
    totalCheckpoints: number;
    lastCheckpointTime: number;
    lastCheckpointSize: number;
    checkpointFailures: number;
  },

  // Recovery tracking
  recovery: {
    retryCount: number;
    lastRetryTime?: number;
    lastErrorMessage?: string;
    recoveredFromCheckpoint: boolean;
  },

  // Document generation
  document: {
    fileName?: string;
    startTime?: number;
    lastUpdateTime?: number;
    sizeBytes?: number;
  },

  // Image collection
  images: {
    downloaded: number;
    failed: number;
    totalSize: number;
  },

  // Performance metrics
  metrics: {
    totalTokensUsed: number;
    totalTimeMs: number;
    sourcesPerMinute: number;
    tokensPerMinute: number;
    averageCompressionTimeMs: number;
  },

  // Service health
  health: {
    ollamaHealthy: boolean;
    wayfarerHealthy: boolean;
    searxngHealthy: boolean;
    lastHealthCheckTime: number;
  },

  // Errors and warnings
  errors: Array<{
    timestamp: number;
    stage: string;
    message: string;
    stack?: string;
  }>;
}

/**
 * Create initial session state
 */
export function createInitialOvernightSessionState(
  config: OvernightSessionConfig
): OvernightSessionState {
  return {
    config,
    status: 'initializing',
    currentCycleNum: 1,
    currentStage: 'research',

    research: {
      iterationsCompleted: 0,
      sourcesFound: 0,
      tokensUsed: 0,
      lastIterationTime: 0,
      averageIterationTimeMs: 0,
    },

    resources: {
      memoryUsageMb: 0,
      cpuPercentUsed: 0,
      uptime: 0,
      requestsInFlight: 0,
    },

    checkpoints: {
      totalCheckpoints: 0,
      lastCheckpointTime: 0,
      lastCheckpointSize: 0,
      checkpointFailures: 0,
    },

    recovery: {
      retryCount: 0,
      recoveredFromCheckpoint: false,
    },

    document: {},

    images: {
      downloaded: 0,
      failed: 0,
      totalSize: 0,
    },

    metrics: {
      totalTokensUsed: 0,
      totalTimeMs: 0,
      sourcesPerMinute: 0,
      tokensPerMinute: 0,
      averageCompressionTimeMs: 0,
    },

    health: {
      ollamaHealthy: false,
      wayfarerHealthy: false,
      searxngHealthy: false,
      lastHealthCheckTime: 0,
    },

    errors: [],
  };
}

/**
 * Constants for overnight research operation
 */
export const OVERNIGHT_CONSTANTS = {
  // DB keys
  SESSION_KEY_PREFIX: 'overnight_session_',
  STATE_KEY_PREFIX: 'overnight_state_',
  CHECKPOINT_KEY_PREFIX: 'overnight_checkpoint_',

  // File paths (relative to session directory)
  LOG_FILE: 'session.log',
  STATUS_FILE: 'status.json',
  METRICS_FILE: 'metrics.json',
  OUTPUT_DOCX: 'overnight_research.docx',
  IMAGES_DIR: 'images',

  // Status update intervals
  STATUS_UPDATE_INTERVAL_MS: 300000, // 5 minutes
  METRICS_FLUSH_INTERVAL_MS: 60000, // 1 minute

  // Retry backoff strategy
  BACKOFF_INITIAL_MS: 5000,
  BACKOFF_MAX_MS: 60000,
  BACKOFF_MULTIPLIER: 2,

  // Memory pressure thresholds
  MEMORY_PRESSURE_MB: 800, // Start throttling at 800MB
  MEMORY_CRITICAL_MB: 950, // Reset cycle at 950MB

  // Alert conditions
  LONG_ITERATION_MS: 180000, // 3 minutes = slow iteration
  STALLED_ITERATION_MS: 600000, // 10 minutes = stalled (likely error)
};

/**
 * Utilities for overnight research
 */
export const OvernightUtils = {
  /**
   * Calculate estimated time remaining
   */
  estimateTimeRemaining(state: OvernightSessionState): number {
    const { research, config } = state;
    const { maxIterations } = config.researchLimits;
    const { iterationsCompleted, averageIterationTimeMs } = research;

    if (iterationsCompleted === 0) return config.timeouts.researchPhaseMaxMs;

    const remainingIterations = maxIterations - iterationsCompleted;
    return remainingIterations * averageIterationTimeMs;
  },

  /**
   * Check if session should trigger memory reset
   */
  shouldResetMemory(memoryMb: number, limit: number = OVERNIGHT_CONSTANTS.MEMORY_CRITICAL_MB): boolean {
    return memoryMb >= limit;
  },

  /**
   * Check if session should trigger health alert
   */
  shouldAlertHealth(state: OvernightSessionState): string | null {
    const { health, research } = state;
    const allServicesHealthy = health.ollamaHealthy && health.wayfarerHealthy && health.searxngHealthy;

    if (!allServicesHealthy) {
      return 'Service health degraded - check Ollama, Wayfarer, or SearXNG';
    }

    if (research.averageIterationTimeMs > OVERNIGHT_CONSTANTS.LONG_ITERATION_MS) {
      return 'Slow iterations detected - possible bottleneck';
    }

    return null;
  },

  /**
   * Format elapsed time for display
   */
  formatElapsedTime(elapsedMs: number): string {
    const hours = Math.floor(elapsedMs / 3600000);
    const minutes = Math.floor((elapsedMs % 3600000) / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  },

  /**
   * Format number with commas
   */
  formatNumber(num: number): string {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  },
};
