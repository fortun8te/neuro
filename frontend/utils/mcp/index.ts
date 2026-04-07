/**
 * MCP (Model Context Protocol) — Tool extensibility system
 * Stolen from OpenCode: standard interface for any tool
 */

export * from './types';
export * from './adapter';
export { mcpRegistry, createMCPAdapter } from './adapter';
