/**
 * Connector Types — Pluggable integration architecture for Neuro
 *
 * Connectors represent external services that Neuro can integrate with.
 * Each connector has a category, auth method, and configuration schema.
 *
 * Current built-in connectors:
 *   - SearXNG (web search) — already integrated
 *   - Wayfarer (web scraping) — already integrated
 *   - Context-1 (retrieval) — just integrated
 *   - Freepik (assets) — server exists
 *
 * Future connectors:
 *   - Google Drive, Notion, Slack, GitHub, Figma, etc.
 */

export type ConnectorCategory =
  | 'search'
  | 'storage'
  | 'communication'
  | 'analytics'
  | 'creative'
  | 'retrieval'
  | 'compute';

export type ConnectorStatus = 'available' | 'connected' | 'error' | 'disabled';
export type ConnectorAuthType = 'oauth' | 'api_key' | 'url' | 'none';

export interface ConnectorConfig {
  [key: string]: string | number | boolean;
}

export interface Connector {
  /** Unique identifier (e.g., 'searxng', 'google_drive') */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** SVG icon string or URL */
  icon: string;
  /** Category for grouping in UI */
  category: ConnectorCategory;
  /** Current connection status */
  status: ConnectorStatus;
  /** How the connector authenticates */
  authType: ConnectorAuthType;
  /** Current configuration (URL, API key, etc.) */
  config: ConnectorConfig;
  /** Whether this connector is built-in (can't be removed) */
  builtIn?: boolean;
  /** Health check URL (optional) */
  healthUrl?: string;
  /** Last successful health check timestamp */
  lastHealthCheck?: number;
  /** Error message if status is 'error' */
  error?: string;
}

export interface ConnectorHealthResult {
  connectorId: string;
  status: ConnectorStatus;
  latencyMs: number;
  error?: string;
}
