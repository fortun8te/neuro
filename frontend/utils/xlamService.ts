/**
 * xlamService.ts — xLAM function-calling model integration.
 *
 * Uses Salesforce xLAM-2-1b-fc-r via Ollama for structured tool calling.
 * This 1B model outperforms GPT-3.5-Turbo on function calling benchmarks
 * while running locally in ~50ms.
 *
 * Setup: ollama pull allenporter/xlam:1b
 *   Or create custom: download GGUF from Salesforce/xLAM-2-1b-fc-r-gguf
 *
 * Used for:
 *   1. Tool selection in the agent loop (replaces Qwen-based toolRouter)
 *   2. Per-step tool calling in the ReAct loop (structured JSON output)
 */

import { ollamaService } from './ollama';
import { INFRASTRUCTURE } from '../config/infrastructure';

// ── Model name ──
// Check localStorage first, then fallback to community Ollama model
function getXlamModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('model_xlam');
    if (stored) return stored;
  }
  return 'allenporter/xlam:1b';
}

// ── Types ──

export interface XlamToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface XlamToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// ── Availability check (cached) ──

let _available: boolean | null = null;
let _checkPromise: Promise<boolean> | null = null;

export async function isXlamAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  if (_checkPromise) return _checkPromise;

  _checkPromise = (async () => {
    try {
      const model = getXlamModel();
      const resp = await fetch(`${INFRASTRUCTURE.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return (_available = false);
      const data = await resp.json() as { models: Array<{ name: string }> };
      _available = data.models.some(m => m.name === model || m.name.startsWith(model.split(':')[0]));
      return _available;
    } catch {
      return (_available = false);
    } finally {
      _checkPromise = null;
    }
  })();

  return _checkPromise;
}

/** Reset availability cache (e.g., after user pulls the model) */
export function resetXlamCache(): void {
  _available = null;
}

// ── Format tools for xLAM system prompt ──

function formatToolsForPrompt(tools: XlamToolDef[]): string {
  return tools.map(t => JSON.stringify(t, null, 2)).join('\n\n');
}

function buildSystemPrompt(tools: XlamToolDef[]): string {
  return `You are a helpful assistant that can use tools. You have access to a set of tools. When using tools, make calls in a single JSON array:

[{"name": "tool_call_name", "arguments": {"arg1": "value1", "arg2": "value2"}}, ... (additional parallel tool calls as needed)]

If no tool is suitable, state that explicitly. If the user's input lacks required parameters, ask for clarification. Do not interpret or respond until tool results are returned. For tasks that don't require tools, respond directly in plain text.
The available tools are:

${formatToolsForPrompt(tools)}`;
}

// ── Core: call xLAM for tool selection ──

/**
 * Ask xLAM which tool(s) to call for a given user message.
 * Returns an array of tool calls (may be empty if no tool needed).
 */
export async function callXlam(
  userMessage: string,
  tools: XlamToolDef[],
  signal?: AbortSignal,
): Promise<XlamToolCall[]> {
  const model = getXlamModel();
  const systemPrompt = buildSystemPrompt(tools);

  let response = '';
  await ollamaService.generateStream(
    userMessage,
    systemPrompt,
    {
      model,
      temperature: 0.1,
      num_predict: 300,
      signal: signal ?? AbortSignal.timeout(5000),
      onChunk: (c: string) => { response += c; },
    },
  );

  return parseXlamResponse(response);
}

/**
 * Parse xLAM output — expects JSON array of tool calls or plain text.
 */
function parseXlamResponse(response: string): XlamToolCall[] {
  // Strip think tags if present
  const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Try to find JSON array
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((tc: unknown): tc is XlamToolCall =>
            typeof tc === 'object' && tc !== null &&
            typeof (tc as Record<string, unknown>).name === 'string'
          )
          .map(tc => ({
            name: tc.name,
            arguments: tc.arguments || {},
          }));
      }
    } catch { /* fall through */ }
  }

  // Try single JSON object
  const objMatch = cleaned.match(/\{[\s\S]*?"name"\s*:[\s\S]*?\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (typeof parsed.name === 'string') {
        return [{ name: parsed.name, arguments: parsed.arguments || {} }];
      }
    } catch { /* not valid */ }
  }

  // No tool call — plain text response
  return [];
}

// ── Convenience: convert ToolDef[] (agentEngine format) to XlamToolDef[] ──

export function convertToolDefs(tools: Array<{
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}>): XlamToolDef[] {
  return tools.map(t => {
    const properties: Record<string, { type: string; description: string }> = {};
    const required: string[] = [];
    for (const [key, param] of Object.entries(t.parameters)) {
      properties[key] = { type: param.type, description: param.description };
      if (param.required) required.push(key);
    }
    return {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    };
  });
}

// ── Tool Router replacement: use xLAM for tool selection ──

/**
 * Use xLAM to select which tools the agent needs.
 * Drop-in replacement for toolRouter.selectTools().
 */
export async function xlamSelectTools(
  userMessage: string,
  availableTools: Array<{ name: string; description: string; parameters: Record<string, { type: string; description: string; required?: boolean }> }>,
  signal?: AbortSignal,
): Promise<{ tools: string[]; reasoning: string }> {
  const xlamTools = convertToolDefs(availableTools);
  const calls = await callXlam(userMessage, xlamTools, signal);

  if (calls.length === 0) {
    return { tools: [], reasoning: 'xLAM: no tools needed' };
  }

  const toolNames = [...new Set(calls.map(c => c.name))];
  return {
    tools: toolNames,
    reasoning: `xLAM selected: ${toolNames.join(', ')}`,
  };
}

// ── Per-step tool calling: use xLAM to decide the next tool call ──

/**
 * Ask xLAM what tool to call next given the current context.
 * Returns the first tool call, or null if no tool needed.
 */
export async function xlamDecideToolCall(
  context: string,
  tools: XlamToolDef[],
  signal?: AbortSignal,
): Promise<XlamToolCall | null> {
  const calls = await callXlam(context, tools, signal);
  return calls.length > 0 ? calls[0] : null;
}
