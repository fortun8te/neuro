/**
 * MCP Types — Model Context Protocol (OpenCode pattern)
 * Standard interface for any tool, local or remote
 */

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokens?: number;
    provider?: string;
  };
}

export interface MCPServer {
  name: string;
  transport: 'stdio' | 'sse' | 'direct';
  discover(): Promise<ToolDefinition[]>;
  execute(toolName: string, args: Record<string, any>): Promise<ToolResult>;
  health?(): Promise<boolean>;
}

// Transport options
export interface StdioTransport {
  command: string;
  args?: string[];
  timeout?: number; // ms
}

export interface SSETransport {
  url: string;
  apiKey?: string;
}
