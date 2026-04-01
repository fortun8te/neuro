/**
 * MCPTool — Model Context Protocol Tool Wrapper
 *
 * Implements the HarnessTool interface for MCP servers (Figma, computer-use, Chrome, Google Drive).
 * Handles JSON-RPC 2.0 communication with MCP servers, streaming responses, and error handling.
 *
 * Modeled after Claude Code's MCP integration layer.
 */

import type {
  HarnessTool,
  HarnessToolResult,
  PermissionResult,
  ToolProgressData,
  ToolUseContext,
} from './types';

// ── MCP Protocol Types ──────────────────────────────────────────────────────

export type MCPRequest = {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
};

export type MCPResponse = {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type MCPServerConfig = {
  name: string;
  description: string;
  endpoint?: string; // HTTP endpoint or stdio command
  command?: string; // For stdio-based servers
  args?: string[];
  env?: Record<string, string>;
  timeout?: number; // ms
};

export type MCPServerCapabilities = {
  resources?: boolean;
  tools?: boolean;
  prompts?: boolean;
  sampling?: boolean;
};

export type MCPTool = {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

export type MCPResource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

// ── MCPServer Client ────────────────────────────────────────────────────────

class MCPServerClient {
  private config: MCPServerConfig;
  private requestId = 0;
  private timeout: number;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.timeout = config.timeout || 30000;
  }

  async call(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    try {
      // For HTTP endpoints
      if (this.config.endpoint) {
        return await this.callHTTP(request);
      }

      // For stdio-based servers (requires Node.js subprocess)
      if (this.config.command) {
        return await this.callStdio(request);
      }

      throw new Error(`MCP server ${this.config.name} has no endpoint or command`);
    } catch (err) {
      throw new Error(
        `MCP call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async callHTTP(request: MCPRequest): Promise<unknown> {
    const response = await fetch(`${this.config.endpoint}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as MCPResponse;
    if (data.error) {
      throw new Error(`MCP error: ${data.error.message}`);
    }

    return data.result;
  }

  private async callStdio(request: MCPRequest): Promise<unknown> {
    // For stdio-based servers, we'd typically use Node.js child_process
    // For now, throw to indicate this needs Node.js backend
    throw new Error(
      `Stdio MCP servers require Node.js backend (not yet implemented in browser)`,
    );
  }

  async listTools(): Promise<MCPTool[]> {
    const result = (await this.call('tools/list')) as { tools: MCPTool[] };
    return result.tools || [];
  }

  async listResources(): Promise<MCPResource[]> {
    const result = (await this.call('resources/list')) as {
      resources: MCPResource[];
    };
    return result.resources || [];
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return this.call('tools/call', { name: toolName, arguments: args });
  }
}

// ── HarnessTool Wrapper for MCP ─────────────────────────────────────────────

export function createMCPTool(
  serverConfig: MCPServerConfig,
  toolName: string,
  toolDescription: string,
  options: {
    isReadOnly?: boolean;
    isConcurrencySafe?: boolean;
    isDestructive?: boolean;
    requiresApproval?: boolean;
    maxResultSize?: number;
  } = {},
): HarnessTool {
  const client = new MCPServerClient(serverConfig);

  return {
    name: `mcp:${serverConfig.name}:${toolName}`,
    aliases: [`${serverConfig.name}:${toolName}`],
    searchHint: `${serverConfig.name} — ${toolName}`,
    maxResultSizeChars: options.maxResultSize ?? 50_000,

    // ── Execution ──────────────────────────────────────────────────────────
    async call(
      args: Record<string, unknown>,
      context: ToolUseContext,
      onProgress?: (event: { toolUseID: string; data: ToolProgressData }) => void,
    ): Promise<HarnessToolResult<string>> {
      try {
        onProgress?.({
          toolUseID: context.sessionId,
          data: { type: 'status', message: `Calling ${serverConfig.name}...` },
        });

        const result = await client.callTool(toolName, args);

        onProgress?.({
          toolUseID: context.sessionId,
          data: {
            type: 'status',
            message: `${serverConfig.name} completed`,
          },
        });

        return {
          success: true,
          output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          data: result,
        };
      } catch (err) {
        if (context.abortController.signal.aborted) {
          return { success: false, output: 'MCP call aborted by user' };
        }

        const errorMsg = err instanceof Error ? err.message : String(err);
        context.addNotification?.(
          `MCP ${serverConfig.name} failed: ${errorMsg}`,
          'error',
        );

        return {
          success: false,
          output: `MCP Error: ${errorMsg}`,
        };
      }
    },

    // ── Description & Display ──────────────────────────────────────────────
    description(): string {
      return `${serverConfig.description} — ${toolDescription}`;
    },

    prompt(): string {
      return '';
    },

    userFacingName(input?: Record<string, unknown>): string {
      if (input && Object.keys(input).length > 0) {
        const firstKey = Object.keys(input)[0];
        const firstValue = String(input[firstKey] || '').slice(0, 40);
        return `${serverConfig.name}: ${toolName} (${firstValue})`;
      }
      return `${serverConfig.name}: ${toolName}`;
    },

    getActivityDescription(input?: Record<string, unknown>): string | null {
      const action = toolName.split('/').pop() || toolName;
      return `Calling ${serverConfig.name} — ${action}`;
    },

    getToolUseSummary(input?: Record<string, unknown>): string | null {
      return `${serverConfig.name}:${toolName}`;
    },

    // ── Safety Classification ──────────────────────────────────────────────
    isConcurrencySafe(): boolean {
      return options.isConcurrencySafe ?? true;
    },

    isReadOnly(): boolean {
      return options.isReadOnly ?? false;
    },

    isDestructive(): boolean {
      return options.isDestructive ?? false;
    },

    isEnabled(): boolean {
      return true; // Check availability dynamically in permission check
    },

    // ── Validation & Permissions ───────────────────────────────────────────
    async validateInput(): Promise<{ result: true }> {
      return { result: true };
    },

    async checkPermissions(
      input: Record<string, unknown>,
      context: ToolUseContext,
    ): Promise<PermissionResult> {
      // Destructive MCP operations should require approval
      if (options.isDestructive || options.requiresApproval) {
        return {
          type: 'ask',
          prompt: `Allow ${serverConfig.name} to ${toolName} with args: ${JSON.stringify(input).slice(0, 60)}?`,
          riskLevel: options.isDestructive ? 'high' : 'medium',
        };
      }

      // Read-only operations are typically allowed
      if (options.isReadOnly) {
        return { type: 'allow' };
      }

      // Default: ask for non-destructive modifications
      return {
        type: 'ask',
        prompt: `Allow ${serverConfig.name} to ${toolName}?`,
        riskLevel: 'medium',
      };
    },
  };
}

// ── Factory Functions for Common MCPs ───────────────────────────────────────

export function createFigmaMCPTool(endpoint: string = 'http://localhost:3000'): HarnessTool {
  return createMCPTool(
    {
      name: 'figma',
      description: 'Figma design-to-code integration',
      endpoint,
    },
    'design-to-code',
    'Convert Figma designs to React code, inspect components, manage versions',
    {
      isReadOnly: false,
      isConcurrencySafe: true,
      isDestructive: false,
      requiresApproval: false,
    },
  );
}

export function createComputerUseMCPTool(
  endpoint: string = 'http://localhost:3001',
): HarnessTool {
  return createMCPTool(
    {
      name: 'computer-use',
      description: 'Desktop automation and control',
      endpoint,
    },
    'control',
    'Take screenshots, click, type, navigate desktop applications',
    {
      isReadOnly: false,
      isConcurrencySafe: false,
      isDestructive: true,
      requiresApproval: true,
    },
  );
}

export function createChromeMCPTool(endpoint: string = 'http://localhost:3002'): HarnessTool {
  return createMCPTool(
    {
      name: 'chrome',
      description: 'Browser automation and page inspection',
      endpoint,
    },
    'navigate-and-inspect',
    'Navigate URLs, read page content, execute JavaScript, take screenshots',
    {
      isReadOnly: true,
      isConcurrencySafe: true,
      isDestructive: false,
      requiresApproval: false,
    },
  );
}

export function createGoogleDriveMCPTool(
  endpoint: string = 'http://localhost:3003',
): HarnessTool {
  return createMCPTool(
    {
      name: 'google-drive',
      description: 'Google Drive and Docs integration',
      endpoint,
    },
    'access-documents',
    'Read/write Google Docs, list files, upload documents, manage permissions',
    {
      isReadOnly: false,
      isConcurrencySafe: false,
      isDestructive: true,
      requiresApproval: true,
    },
  );
}

// ── MCP Server Registry ─────────────────────────────────────────────────────

export const DEFAULT_MCP_SERVERS: Record<string, MCPServerConfig> = {
  figma: {
    name: 'figma',
    description: 'Figma design-to-code',
    endpoint: 'http://localhost:3000',
  },
  'computer-use': {
    name: 'computer-use',
    description: 'Desktop automation',
    endpoint: 'http://localhost:3001',
  },
  chrome: {
    name: 'chrome',
    description: 'Browser automation',
    endpoint: 'http://localhost:3002',
  },
  'google-drive': {
    name: 'google-drive',
    description: 'Google Drive access',
    endpoint: 'http://localhost:3003',
  },
};

export async function discoverMCPServers(
  servers: Record<string, MCPServerConfig> = DEFAULT_MCP_SERVERS,
): Promise<MCPServerConfig[]> {
  const available: MCPServerConfig[] = [];

  for (const [, config] of Object.entries(servers)) {
    try {
      const response = await fetch(`${config.endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        available.push(config);
      }
    } catch {
      // Server not available, skip
    }
  }

  return available;
}
