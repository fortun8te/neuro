/**
 * routeExecutor -- fast-path regex routing.
 * No compound command parsing -- the LLM and computer agent handle complexity.
 */

export function detectFastRoute(message: string): string | null {
  const t = message.trim().toLowerCase();

  // Empty
  if (!t) return 'chat';

  // Short greetings (yo, hi, hey, sup, etc.)
  if (t.length <= 8 && !/\.\w{2,}/.test(t)) return 'chat';

  // URLs -> browse
  if (/https?:\/\//i.test(t)) return 'browse';

  // localhost -> browse
  if (/^localhost[:/]/i.test(t)) return 'browse';

  // "go to X.com", "navigate to X.org"
  if (/^(?:go\s+to|navigate\s+to)\s+\S+\.\w{2,}/i.test(t)) return 'browse';

  // "open a new tab"
  if (/\bopen\s+a?\s*new\s+tab\b/i.test(t)) return 'browse';

  // Bare domain: "reddit.com", "nos.nl"
  if (/^\S+\.\w{2,}/.test(t) && !t.includes(' ')) return 'browse';

  // Apps -> desktop
  if (/^(?:open|launch|close)\s+(?:chrome|finder|terminal)\b/i.test(t)) return 'desktop';

  // CAPTCHA / verification -> desktop
  if (/(?:captcha|robot|recaptcha|not a robot)/i.test(t)) return 'desktop';

  // "use computer" / "use the browser" / "can you browse" -> desktop
  if (/(?:use|open|launch|start)\s+(?:the\s+)?(?:computer|browser|chrome)/i.test(t)) return 'desktop';

  // Search triggers -> search
  if (/^(?:google|search\s+for|look\s+up)\s+\S/i.test(t)) return 'search';

  // "look up X" / "find out X" with enough context -> search
  if (/^(?:look up|find out)\s+\S+/i.test(t) && t.split(' ').length > 3) return 'search';

  // "what is/are/was/were/does X" with enough words -> search
  if (/^what\s+(?:is|are|was|were|does)\s+\S+/i.test(t) && t.split(' ').length > 3) return 'search';

  // "check X" / "tell me about X" / "explain X" / "show me X" -> search
  if (/^(?:check|tell me about|explain|show me)\s+\S/i.test(t) && t.split(' ').length > 3) return 'search';

  // Research -> research (must be >3 words to avoid false positives)
  if (/^(?:research|analyze|investigate|deep\s+dive)/i.test(t) && t.split(' ').length > 3) return 'research';

  // Short questions -> chat
  if (/\?$/.test(t) && t.split(' ').length <= 6) return 'chat';

  // Everything else -> null (falls to LLM router)
  return null;
}
