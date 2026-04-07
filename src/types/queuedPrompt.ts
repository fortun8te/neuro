/**
 * Queued Prompts Type Definitions
 * Supports multi-prompt sequences, scheduling, dependencies, and template management
 */

export type PromptScheduleType = 'immediate' | 'scheduled' | 'delayed';
export type QueuedPromptStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'paused' | 'cancelled';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'creative' | 'analysis' | 'custom';
  prompt: string;
  variables: PromptVariable[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  usageCount: number;
}

export interface PromptVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: string[];
  required: boolean;
  description?: string;
}

export interface QueuedPromptItem {
  id: string;
  queueId: string;
  sequenceNumber: number;
  status: QueuedPromptStatus;

  // Prompt content
  prompt: string;
  templateId?: string;
  templateVariables?: Record<string, unknown>;
  model: string;

  // Configuration
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;

  // Dependencies
  dependsOnIds?: string[]; // IDs of prompts that must complete before this one
  outputReference?: string; // e.g., "output_1" to reference previous prompt output

  // Timing
  scheduledFor?: number; // unix timestamp
  delayMs?: number; // delay after previous completion
  timeout?: number; // execution timeout in ms

  // Results
  input?: string;
  output?: string;
  error?: string;
  executedAt?: number;
  completedAt?: number;
  duration?: number; // milliseconds
  tokensUsed?: number;

  // UI metadata
  label?: string;
  notes?: string;
  collapsed?: boolean;
  color?: string;
}

export interface PromptQueue {
  id: string;
  name: string;
  description?: string;

  // Execution state
  status: QueuedPromptStatus;
  items: QueuedPromptItem[];
  currentItemIndex: number;

  // Schedule
  schedule: {
    type: PromptScheduleType;
    startTime?: number;
    endTime?: number;
    timezone?: string;
    recurringPattern?: string; // cron-like pattern
  };

  // Configuration
  parallelExecutionLimit: number; // max parallel prompts if dependencies allow
  stopOnError: boolean;
  retryOnFailure: number; // number of retries per failed item

  // Results & metrics
  totalDuration?: number;
  totalTokensUsed?: number;
  successCount: number;
  failureCount: number;

  // Metadata
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;

  // UI state
  isPinned?: boolean;
  isFavorite?: boolean;
  viewMode?: 'compact' | 'detailed' | 'graph';
}

export interface QueueExecutionContext {
  queueId: string;
  currentItemId: string;
  previousOutputs: Record<string, string>;
  abortSignal?: AbortSignal;

  // Progress tracking
  progress: {
    current: number;
    total: number;
    percentage: number;
  };

  // Performance metrics
  metrics: {
    startTime: number;
    itemsCompleted: number;
    itemsFailed: number;
    totalTokens: number;
    averageLatency: number;
  };
}

export interface QueueEvent {
  type:
    | 'queue_started'
    | 'queue_paused'
    | 'queue_resumed'
    | 'queue_completed'
    | 'queue_error'
    | 'item_started'
    | 'item_progress'
    | 'item_completed'
    | 'item_error'
    | 'item_retrying';
  queueId: string;
  itemId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface QueueTemplateGroup {
  id: string;
  name: string;
  description: string;
  templates: PromptTemplate[];
  category: string;
  isReadOnly: boolean;
}

// Storage types
export interface QueueStorageEntry {
  id: string;
  queue: PromptQueue;
  history: QueueExecutionContext[];
}
