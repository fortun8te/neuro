/**
 * intentRouter.ts — LLM-powered intent classification for message routing.
 *
 * Instead of brittle regex matching, uses a fast small model to answer
 * structured questions about the user's intent. Returns a routing decision.
 */

import { ollamaService } from './ollama';
import { getModelForStage } from './modelConfig';

export interface RoutingDecision {
  /** Is this a simple greeting/chat with no tool needed? */
  isChat: boolean;
  /** Does this need the computer (visual browser, clicking, forms, UI interaction)? */
  needsComputer: boolean;
  /** Would a simple web fetch/search handle this? */
  needsWebFetch: boolean;
  /** Does this involve memory (recall, save, look at memories)? */
  needsMemory: boolean;
  /** Does this need file operations (create docx, read pdf, write file)? */
  needsFiles: boolean;
  /** Does this need multiple tools in sequence (research + write, fetch + analyze)? */
  needsMultiStep: boolean;
  /** One-line reasoning for the decision */
  reasoning: string;
  /** Confidence 0-1 */
  confidence: number;
}

const ROUTER_PROMPT = `You are a task router for an AI agent. Given a user message, classify the intent by answering these questions. Reply ONLY with valid JSON, no other text.

Questions to evaluate:
1. isChat: Is this just a greeting, casual chat, or simple question needing no tools? (true/false)
2. needsComputer: Does this REQUIRE visual browser interaction — clicking buttons, filling forms, signing in, purchasing, taking screenshots, interacting with a UI? (true/false). NOTE: Simply reading a webpage or fetching data does NOT need computer. Only visual interaction does.
3. needsWebFetch: Can this be solved by searching the web or fetching/reading a URL? Weather, prices, news, page content, any data lookup. (true/false)
4. needsMemory: Does this involve the agent's memory — recalling past info, saving facts, looking at memories/notes? (true/false)
5. needsFiles: Does this need file operations — creating a document (docx, pdf), reading a file, writing code to a file? (true/false)
6. needsMultiStep: Does this require multiple tools in sequence — like research then write, or fetch multiple sites then compare? (true/false)
7. reasoning: One short sentence explaining why.
8. confidence: How confident are you? 0.0 to 1.0

CRITICAL RULES:
- "browse a page", "fetch a URL", "search for X", "what's the weather" = needsWebFetch, NOT needsComputer
- "click", "fill form", "sign in", "buy", "screenshot" = needsComputer
- When in doubt between computer and web fetch, choose web fetch. Computer is SLOW and should be last resort.
- "can you browse" or "web fetch" = needsWebFetch
- Only needsComputer if the user EXPLICITLY needs to interact with a visual interface

Example:
User: "yo can u browse like simple web fetch?"
{"isChat":false,"needsComputer":false,"needsWebFetch":true,"needsMemory":false,"needsFiles":false,"needsMultiStep":false,"reasoning":"User explicitly asks for simple web fetch, not computer interaction","confidence":0.95}

User: "click the buy button on amazon"
{"isChat":false,"needsComputer":true,"needsWebFetch":false,"needsMemory":false,"needsFiles":false,"needsMultiStep":false,"reasoning":"Clicking a button requires visual browser interaction","confidence":0.95}

User: "what's the weather in london"
{"isChat":false,"needsComputer":false,"needsWebFetch":true,"needsMemory":false,"needsFiles":false,"needsMultiStep":false,"reasoning":"Weather lookup is a simple web search","confidence":0.95}

User: "research collagen market and write me a docx report"
{"isChat":false,"needsComputer":false,"needsWebFetch":true,"needsMemory":false,"needsFiles":true,"needsMultiStep":true,"reasoning":"Needs web research then document creation","confidence":0.9}`;

/**
 * Classify user intent using a fast LLM call.
 * Uses the smallest/fastest model for speed (~200-500ms).
 * Falls back to safe defaults if LLM fails.
 */
export async function classifyIntent(
  userMessage: string,
  signal?: AbortSignal,
): Promise<RoutingDecision> {
  const defaultDecision: RoutingDecision = {
    isChat: false,
    needsComputer: false,
    needsWebFetch: false,
    needsMemory: false,
    needsFiles: false,
    needsMultiStep: false,
    reasoning: 'fallback — routing to general agent',
    confidence: 0.3,
  };

  try {
    let response = '';
    await ollamaService.generateStream(
      `User: "${userMessage}"`,
      ROUTER_PROMPT,
      {
        model: getModelForStage('fast'),
        temperature: 0.1,
        num_predict: 200,
        signal: signal ?? AbortSignal.timeout(3000), // 3s max
        onChunk: (c: string) => { response += c; },
      }
    );

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return defaultDecision;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      isChat: Boolean(parsed.isChat),
      needsComputer: Boolean(parsed.needsComputer),
      needsWebFetch: Boolean(parsed.needsWebFetch),
      needsMemory: Boolean(parsed.needsMemory),
      needsFiles: Boolean(parsed.needsFiles),
      needsMultiStep: Boolean(parsed.needsMultiStep),
      reasoning: String(parsed.reasoning || ''),
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch (err) {
    console.warn('[intentRouter] LLM classification failed, using fallback:', err);
    return defaultDecision;
  }
}

/**
 * Quick regex pre-filter for obvious cases that don't need LLM.
 * Returns null if LLM classification is needed.
 */
export function quickClassify(message: string): RoutingDecision | null {
  const lc = message.toLowerCase().trim();

  // Obvious greetings
  if (/^(yo|hey|hi|hello|sup|what'?s up|gm|good morning|good evening)\s*[!?.]*$/i.test(lc)) {
    return { isChat: true, needsComputer: false, needsWebFetch: false, needsMemory: false, needsFiles: false, needsMultiStep: false, reasoning: 'greeting', confidence: 0.99 };
  }

  // Explicit computer commands (click, fill form, screenshot)
  if (/\b(click|right.?click|double.?click|fill (in|out) .*(form|field)|take (a )?screenshot|sign (up|in)|log ?in|add to cart|checkout|place.* order)\b/.test(lc)) {
    return { isChat: false, needsComputer: true, needsWebFetch: false, needsMemory: false, needsFiles: false, needsMultiStep: false, reasoning: 'explicit UI interaction', confidence: 0.95 };
  }

  // Explicit "use computer" / "open chrome"
  if (/\b(use (the )?computer|open (chrome|safari|firefox|finder|terminal)|control (the )?desktop)\b/.test(lc)) {
    return { isChat: false, needsComputer: true, needsWebFetch: false, needsMemory: false, needsFiles: false, needsMultiStep: false, reasoning: 'explicit computer request', confidence: 0.95 };
  }

  // Explicit memory
  if (/\b(look at.*(memor|notes)|your (memories|notes)|remember|recall|what (do|did) you (know|remember))\b/.test(lc)) {
    return { isChat: false, needsComputer: false, needsWebFetch: false, needsMemory: true, needsFiles: false, needsMultiStep: false, reasoning: 'memory operation', confidence: 0.95 };
  }

  // Anything else — needs LLM classification
  return null;
}
