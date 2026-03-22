/**
 * agentRouter — LLM-based message classifier (qwen3.5:2b)
 *
 * Replaces the keyword heuristic router with a single 2b LLM call.
 * Returns a RouteClassification matching the route table in router.ts.
 */

import { ollamaService } from './ollama';
import { loadPromptBody } from './promptLoader';
import type { RouteClassification } from './router';

// Legacy action route type (used by ActionSidebarCompact)
export type AgentRouteType = 'search' | 'write' | 'browse' | 'memory' | 'plan' | 'desktop' | 'research' | 'chat';
export interface AgentRoute { type: AgentRouteType; payload: string; }

/** Legacy compat — classifies what KIND of action (search/write/browse/etc.) */
export async function routeInstruction(
  instruction: string,
  _history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentRoute> {
  const text = instruction.trim();
  if (!text) return { type: 'chat', payload: '' };
  const systemPrompt = `Classify the instruction into one of: search, write, browse, memory, plan, desktop, research, chat.
- desktop: open/close apps (Chrome, Finder, Terminal), click something, navigate the browser, any UI action on the screen, solve a captcha, click a checkbox, do the robot verification, handle a reCAPTCHA, pass human verification
- search: look up information on the web (simple queries)
- research: deep investigation, mass web scraping, comparing many sources, analyzing a topic in depth, "research X", "deep dive into X", "investigate X", "analyze X across sources"
- browse: browse to a specific URL in the browser
- chat: general conversation, questions, explanations
Examples:
  "do the captcha" → desktop
  "I'm not a robot thing" → desktop
  "click the verify checkbox" → desktop
  "pass the human verification" → desktop
  "solve the recaptcha" → desktop
  "research collagen supplements market" → research
  "deep dive into AI chip supply chains" → research
  "investigate competitor pricing strategies" → research
  "analyze vitamin C serum reviews across sites" → research
Reply with one word only. Lowercase.`;
  try {
    const result = await ollamaService.generateStream(text, systemPrompt, {
      model: 'qwen3.5:2b', temperature: 0.0, num_predict: 8,
      signal: AbortSignal.timeout(8000),
    });
    const cleaned = result.trim().toLowerCase();
    const valid: AgentRouteType[] = ['search', 'write', 'browse', 'memory', 'plan', 'desktop', 'research', 'chat'];
    return { type: valid.includes(cleaned as AgentRouteType) ? cleaned as AgentRouteType : 'chat', payload: text };
  } catch {
    return { type: 'chat', payload: text };
  }
}

// ─────────────────────────────────────────────────────────────
// Fallback prompt (if file missing)
// ─────────────────────────────────────────────────────────────

const ROUTER_FALLBACK = `Classify the user message into one of: CHAT, DIRECT, QUICK, MEDIUM, COMPLEX, INTERRUPT. Reply with one word only. Uppercase.`;

// ─────────────────────────────────────────────────────────────
// Classifier
// ─────────────────────────────────────────────────────────────

export async function classifyMessage(
  message: string,
  hasActiveTasks: boolean,
  signal?: AbortSignal
): Promise<RouteClassification> {
  const systemPrompt = loadPromptBody('core/router.txt') || ROUTER_FALLBACK;

  // Prepend context hint if tasks are running (helps INTERRUPT detection)
  const input = hasActiveTasks
    ? `[Active tasks running]\n${message}`
    : message;

  try {
    const result = await ollamaService.generateStream(input, systemPrompt, {
      model: 'qwen3.5:2b',
      temperature: 0.0,
      num_predict: 10,
      signal: signal ?? AbortSignal.timeout(10000),
    });

    const cleaned = result.trim().toUpperCase();
    const valid: RouteClassification[] = ['CHAT', 'DIRECT', 'QUICK', 'MEDIUM', 'COMPLEX', 'INTERRUPT'];

    if (valid.includes(cleaned as RouteClassification)) {
      return cleaned as RouteClassification;
    }

    return 'CHAT';
  } catch (err) {
    console.warn('[agentRouter] Classification error, defaulting to CHAT:', err);
    return 'CHAT';
  }
}
