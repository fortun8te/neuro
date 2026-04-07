/**
 * MCP Adapter — Wraps existing tools into MCP format
 * Lets any tool become pluggable (OpenCode pattern)
 */

import type { MCPServer, ToolDefinition, ToolResult } from './types';

/**
 * Convert our existing ToolDef format to MCP ToolDefinition
 */
export function adaptToolDef(toolDef: any): ToolDefinition {
  return {
    name: toolDef.name,
    description: toolDef.description,
    parameters: {
      type: 'object',
      properties: toolDef.parameters.properties,
      required: toolDef.parameters.required || [],
    },
  };
}

/**
 * Wrap any tool function as an MCP server
 * Usage:
 *   const webSearchMCP = createMCPAdapter('web_search', webSearchTool);
 *   const tools = await webSearchMCP.discover();
 *   const result = await webSearchMCP.execute('web_search', { query: '...' });
 */
export function createMCPAdapter(
  toolName: string,
  executeFn: (args: Record<string, any>) => Promise<any>,
  toolDef?: any
): MCPServer {
  return {
    name: toolName,
    transport: 'direct',

    async discover(): Promise<ToolDefinition[]> {
      if (toolDef) {
        return [adaptToolDef(toolDef)];
      }
      // Fallback: return basic definition
      return [
        {
          name: toolName,
          description: `Tool: ${toolName}`,
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ];
    },

    async execute(name: string, args: Record<string, any>): Promise<ToolResult> {
      if (name !== toolName) {
        return {
          success: false,
          error: `Tool ${name} not found in adapter ${toolName}`,
        };
      }

      try {
        const start = Date.now();
        const data = await executeFn(args);
        const executionTime = Date.now() - start;

        return {
          success: true,
          data,
          metadata: { executionTime },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async health() {
      return true;
    },
  };
}

/**
 * Tool registry — collect all MCP servers
 * Usage:
 *   const registry = new MCPRegistry();
 *   registry.register(webSearchMCP);
 *   registry.register(browsePageMCP);
 *   const allTools = await registry.discoverAll();
 */
export class MCPRegistry {
  private servers = new Map<string, MCPServer>();

  register(server: MCPServer) {
    this.servers.set(server.name, server);
  }

  async discoverAll(): Promise<ToolDefinition[]> {
    const results: ToolDefinition[] = [];
    for (const [, server] of this.servers) {
      const tools = await server.discover();
      results.push(...tools);
    }
    return results;
  }

  async execute(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    // Try each server (some might provide the tool)
    for (const [, server] of this.servers) {
      const tools = await server.discover();
      if (tools.some(t => t.name === toolName)) {
        return server.execute(toolName, args);
      }
    }

    return {
      success: false,
      error: `Tool ${toolName} not found in any MCP server`,
    };
  }
}

export const mcpRegistry = new MCPRegistry();
