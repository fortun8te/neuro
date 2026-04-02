/**
 * Tool Result Processor Module
 *
 * Handles post-execution processing of tool results: memory persistence,
 * source tracking, error classification, and context window management.
 * Extracted from agentEngine.ts for single responsibility and testability.
 */

import type { ToolResult, ToolCall, AgentEngineEvent } from './agentEngine';
import type { AgentEngineCallback } from './agentEngine';
import type { ToolCallError } from './toolValidator';
import { classifyToolError } from './toolValidator';
import { neuroMemory } from './neuroMemory';
import { semanticRouter } from './neuroContext';

export interface ToolFailureTracker {
  recordToolFailure(toolName: string): void;
  isToolBlacklisted(toolName: string): boolean;
  recordToolSuccess(toolName: string): void;
}

export interface SourceRegistry {
  registerSource(url: string, title?: string, snippet?: string): number;
  getSourcesSuffix(): string;
  extractAndRegisterSources(toolName: string, output: string): void;
}

export interface SourceEntry {
  title: string;
  url: string;
  index: number;
  snippet?: string;
}

/**
 * Create a tool failure tracker to blacklist repeatedly failing tools.
 */
export function createToolFailureTracker(maxFailures: number = 2): ToolFailureTracker {
  const failureCount = new Map<string, number>();

  return {
    recordToolFailure(toolName: string): void {
      const count = (failureCount.get(toolName) || 0) + 1;
      failureCount.set(toolName, count);
    },

    isToolBlacklisted(toolName: string): boolean {
      return (failureCount.get(toolName) || 0) >= maxFailures;
    },

    recordToolSuccess(toolName: string): void {
      failureCount.delete(toolName); // reset on success
    },
  };
}

/**
 * Create a source registry for tracking and formatting URLs found in tool results.
 */
export function createSourceRegistry(sourceTools: Set<string>): SourceRegistry {
  const registry = new Map<string, SourceEntry>();
  let counter = 0;

  return {
    registerSource(url: string, title?: string, snippet?: string): number {
      if (!url) return 0;

      if (registry.has(url)) {
        const existing = registry.get(url)!;
        if (snippet && !existing.snippet) {
          existing.snippet = snippet.slice(0, 200);
        }
        return existing.index;
      }

      counter++;
      registry.set(url, {
        title: title || url,
        url,
        index: counter,
        snippet: snippet ? snippet.slice(0, 200) : undefined,
      });
      return counter;
    },

    getSourcesSuffix(): string {
      if (registry.size === 0) return '';
      const refs = [...registry.values()]
        .sort((a, b) => a.index - b.index)
        .map(s => {
          const line = `[${s.index}] ${s.title} - ${s.url}`;
          return s.snippet ? `${line}\nsnippet: ${s.snippet}` : line;
        })
        .join('\n\n');
      return `\n\n## Sources\n\n${refs}`;
    },

    extractAndRegisterSources(toolName: string, output: string) {
      if (!sourceTools.has(toolName) || !output) return;

      // Web search format: [N] Title — URL\nKey content: snippet
      const wsPattern = /^\[\d+\]\s+(.+?)\s+[—–-]\s+(https?:\/\/[^\s\n]+)\n(?:Key content:\s*)?([\s\S]*?)(?=\n\[\d+\]|\n\n|$)/gm;
      let wsMatch;
      const wsUrls = new Set<string>();

      while ((wsMatch = wsPattern.exec(output)) !== null) {
        const title = wsMatch[1].trim();
        const url = wsMatch[2].trim();
        const snippet = wsMatch[3]?.trim().slice(0, 200) || undefined;
        this.registerSource(url, title, snippet);
        wsUrls.add(url);
      }

      // Markdown links [text](url)
      const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
      let match;
      while ((match = linkPattern.exec(output)) !== null) {
        if (!wsUrls.has(match[2])) {
          this.registerSource(match[2], match[1]);
        }
      }

      // URL: prefix pattern
      const urlPrefixPattern = /(?:URL:\s*|Source \d+:.*?\n\s*URL:\s*)(https?:\/\/[^\s\n]+)/gi;
      while ((match = urlPrefixPattern.exec(output)) !== null) {
        if (!wsUrls.has(match[1])) {
          this.registerSource(match[1]);
        }
      }

      // Raw URLs as fallback
      const rawUrlPattern = /(?:^|\s)(https?:\/\/[^\s\n<]+)/gm;
      while ((match = rawUrlPattern.exec(output)) !== null) {
        const url = match[1].replace(/[.,;)]+$/, '');
        if (!wsUrls.has(url)) {
          this.registerSource(url);
        }
      }
    },
  };
}

/**
 * Extract sources from text without registering globally.
 */
export function extractSourcesFromText(text: string): Array<{
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}> {
  const sources: Array<{
    title: string;
    url: string;
    domain: string;
    snippet?: string;
  }> = [];
  const seen = new Set<string>();

  // Web search format [N] Title — URL
  const wsPattern = /^\[\d+\]\s+(.+?)\s+[—–-]\s+(https?:\/\/[^\s\n]+)\n(?:Key content:\s*)?([\s\S]*?)(?=\n\[\d+\]|\n\n|$)/gm;
  let match;

  while ((match = wsPattern.exec(text)) !== null) {
    const url = match[2].trim();
    if (!seen.has(url)) {
      const domain = new URL(url).hostname || url;
      sources.push({
        title: match[1].trim(),
        url,
        domain,
        snippet: match[3]?.trim().slice(0, 120),
      });
      seen.add(url);
    }
  }

  // Markdown links [text](url)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  while ((match = linkPattern.exec(text)) !== null) {
    const url = match[2];
    if (!seen.has(url)) {
      const domain = new URL(url).hostname || url;
      sources.push({ title: match[1], url, domain });
      seen.add(url);
    }
  }

  // Raw URLs as fallback
  const rawUrlPattern = /(?:^|\s)(https?:\/\/[^\s\n<]+)/gm;
  while ((match = rawUrlPattern.exec(text)) !== null) {
    const url = match[1].replace(/[.,;)]+$/, '');
    if (!seen.has(url)) {
      const domain = new URL(url).hostname || url;
      sources.push({ title: url, url, domain });
      seen.add(url);
    }
  }

  return sources;
}

/**
 * Truncate tool output using middle-elision to preserve both start and end context.
 */
export function truncateToolOutput(text: string, maxChars: number = 20_000): string {
  if (text.length <= maxChars) return text;

  // Keep start and end, ellipsize middle
  const overhead = '[...truncated...]\n'.length;
  const charsPerSide = (maxChars - overhead) / 2;

  const start = text.slice(0, charsPerSide);
  const end = text.slice(-charsPerSide);
  return `${start}\n\n[...truncated ${text.length - maxChars} chars...]\n\n${end}`;
}

/**
 * Prepare tool result for LLM context by truncating and stripping large data.
 */
export function prepareToolResultForContext(result: string, maxChars: number = 20_000): string {
  let output = truncateToolOutput(result, maxChars);

  // Strip base64 image data URIs to prevent context window bloat
  output = output.replace(
    /data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*/g,
    '[image data — stripped to save context]'
  );

  return output;
}

/**
 * Build context suffix for tool errors.
 */
export function buildErrorContextSuffix(
  toolError: ToolCallError | null,
  toolName: string,
  availableTools: string[]
): string {
  if (!toolError) return '';

  switch (toolError.kind) {
    case 'fatal':
      return `\n\n[SYSTEM NOTE: '${toolName}' is NOT a valid tool. STOP trying it or similar tools. Respond directly to the user with what you know, OR use ONLY tools from this exact list: ${availableTools.join(', ')}]`;

    case 'malformed':
      return '\n\n[SYSTEM NOTE: Tool call was malformed (JSON/parse error). Correct the argument format and retry with valid JSON.]';

    case 'respond_to_model':
    default:
      return ''; // errors flow through normally
  }
}

/**
 * Process tool result completion: update metrics, log, track sources.
 */
export interface ProcessToolResultOptions {
  onEvent?: AgentEngineCallback;
  failureTracker: ToolFailureTracker;
  sourceRegistry: SourceRegistry;
  sourceTools: Set<string>;
  step: number;
  userMessage: string;
}

export async function processToolResultCompletion(
  toolCall: ToolCall,
  result: ToolResult,
  options: ProcessToolResultOptions
): Promise<void> {
  const { onEvent, failureTracker, sourceRegistry, sourceTools, step, userMessage } = options;

  // Track success/failure for blacklisting
  if (result.success === false) {
    failureTracker.recordToolFailure(toolCall.name);
  } else {
    failureTracker.recordToolSuccess(toolCall.name);
  }

  // Track sources from research tools
  if (sourceTools.has(toolCall.name) && result.success && result.output) {
    sourceRegistry.extractAndRegisterSources(toolCall.name, result.output);
  }

  // Log to neuro memory
  void neuroMemory
    .log(
      `step ${step + 1}: ${toolCall.name}(${JSON.stringify(toolCall.args).slice(0, 60)}) → ${result.success ? 'ok' : 'err'}: ${result.output.slice(0, 80)}`
    )
    .catch(() => {});

  // Record in semantic router for future routing decisions
  void semanticRouter
    .recordDecision(toolCall.name, result.success, userMessage.slice(0, 100))
    .catch(() => {}); // fire-and-forget

  // Emit event
  if (onEvent) {
    onEvent({
      type: result.success ? 'tool_done' : 'tool_error',
      toolCall,
      step,
      timestamp: Date.now(),
    } as any as AgentEngineEvent);
  }
}
