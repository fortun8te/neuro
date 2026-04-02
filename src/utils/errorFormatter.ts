/**
 * Error Message Formatter
 *
 * Standardizes error messages across all API integrations.
 * Format: "[Service] [Action] failed: [Reason] (HTTP [Status]). [Suggestion]"
 */

export interface FormattedErrorOptions {
  service: string;           // Service name (e.g., "Ollama", "Wayfarer", "SearXNG")
  action: string;            // Action name (e.g., "generate", "research", "screenshot")
  reason: string;            // Error reason/message
  httpStatus?: number;       // HTTP status code (e.g., 500, 503)
  suggestion?: string;       // User-facing suggestion for recovery
  context?: Record<string, unknown>; // Additional context for logging
}

/**
 * Format an error message according to the standard template
 */
export function formatError(options: FormattedErrorOptions): string {
  const { service, action, reason, httpStatus, suggestion } = options;

  let msg = `${service} ${action} failed: ${reason}`;

  if (httpStatus) {
    msg += ` (HTTP ${httpStatus})`;
  }

  if (suggestion) {
    msg += `. ${suggestion}`;
  }

  return msg;
}

/**
 * Create an Error object with formatted message
 */
export function createFormattedError(options: FormattedErrorOptions): Error {
  const message = formatError(options);
  return new Error(message);
}

/**
 * Common error factories for typical failures
 */
export const errorFactories = {
  /**
   * Connection failure — service is unreachable
   */
  connectionFailed(service: string, endpoint: string, timeout?: number): Error {
    const suggestion = `Check that ${service} is running at ${endpoint}. ` +
      (timeout ? `Connection timeout: ${timeout}ms.` : '');
    return createFormattedError({
      service,
      action: 'connect',
      reason: 'Cannot reach service',
      suggestion: suggestion.trim(),
    });
  },

  /**
   * HTTP error — service responded with error status
   */
  httpError(service: string, action: string, status: number, statusText: string): Error {
    const suggestions: Record<number, string> = {
      400: 'Bad request — check input parameters',
      401: 'Unauthorized — check authentication credentials',
      403: 'Forbidden — check permissions',
      404: 'Not found — check endpoint/model name',
      429: 'Too many requests — rate limit exceeded. Wait before retrying.',
      500: 'Internal server error — try again in a few seconds',
      502: 'Bad gateway — check service configuration',
      503: 'Service unavailable — service is down for maintenance',
      504: 'Gateway timeout — service is not responding',
    };

    return createFormattedError({
      service,
      action,
      reason: statusText || 'HTTP error',
      httpStatus: status,
      suggestion: suggestions[status] || 'Check service status',
    });
  },

  /**
   * Timeout error — request took too long
   */
  timeout(service: string, action: string, timeoutMs: number): Error {
    return createFormattedError({
      service,
      action,
      reason: `Request timeout after ${timeoutMs}ms`,
      suggestion: 'Request took too long. Try again or increase timeout.',
    });
  },

  /**
   * JSON parsing error — response was not valid JSON
   */
  invalidJson(service: string, action: string): Error {
    return createFormattedError({
      service,
      action,
      reason: 'Invalid JSON response',
      suggestion: 'Service returned non-JSON data. Check service logs.',
    });
  },

  /**
   * Schema validation error — response doesn't match expected format
   */
  schemaValidation(service: string, fieldName: string, expectedType: string): Error {
    return createFormattedError({
      service,
      action: 'validate',
      reason: `Field "${fieldName}" has wrong type (expected ${expectedType})`,
      suggestion: 'Response format changed. Check service version compatibility.',
    });
  },

  /**
   * Circuit breaker error — service is marked unavailable
   */
  circuitBreakerOpen(service: string, failureCount: number, resetTimeMs: number): Error {
    return createFormattedError({
      service,
      action: 'request',
      reason: `Service unavailable after ${failureCount} consecutive failures`,
      suggestion: `Service is temporarily unavailable. Retry in ${Math.ceil(resetTimeMs / 1000)}s.`,
    });
  },

  /**
   * Rate limit error — too many requests in short time
   */
  rateLimited(service: string, retryAfterSeconds?: number): Error {
    const suggestion = retryAfterSeconds
      ? `Wait ${retryAfterSeconds}s before retrying`
      : 'Wait before retrying';

    return createFormattedError({
      service,
      action: 'request',
      httpStatus: 429,
      reason: 'Rate limit exceeded',
      suggestion,
    });
  },

  /**
   * Abort/cancellation error — request was cancelled by user
   */
  aborted(service: string, action: string): Error {
    return createFormattedError({
      service,
      action,
      reason: 'Request cancelled',
      suggestion: 'Operation was interrupted by user',
    });
  },
};
