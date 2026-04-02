/**
 * Shared Type Definitions Index
 * Re-exports all type definitions for convenient importing.
 */

// Tool types
export type { ToolDef, ToolResult, ToolCall, AgentStep } from '../agentEngine';

// Event types
export type { AgentEngineEvent, AgentEngineEventType, AgentEngineCallback } from '../agentEngine';

// Agent types
export type { CampaignContextData } from '../agentEngine';

// Validator types
export type { ToolErrorKind, ToolCallError, ParsedToolCall } from '../toolValidator';

// TODO: After creating types/ modules in Week 3, update these exports
// export type { Common types } from './common';
// export type { Agent types } from './agent';
// export type { Tool types } from './tools';
