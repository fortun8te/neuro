/**
 * routeExecutor — fast-path regex routing and secondary-intent parsing.
 *
 * Extracted from ActionSidebarCompact.tsx so the routing logic can be tested
 * and reused independently of the React component.
 */

import { INFRASTRUCTURE } from '../config/infrastructure';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RouteResult = {
  route: string;
  secondaryActions?: Array<{ type: 'search' | 'browse' | 'finder'; payload: string }>;
};

export type SecondaryAction =
  | { kind: 'search'; query: string; url: string }
  | { kind: 'browse'; url: string }
  | { kind: 'finder'; path: string };

// ─────────────────────────────────────────────────────────────
// Search query extraction — strips conversational fluff
// ─────────────────────────────────────────────────────────────

/**
 * Extracts the actual search query from a message.
 * Only strips the direct trigger verb (google/search for/look up/find).
 * Conversational fluff ("can you", "please") is left to the LLM router —
 * if the message has conversational phrasing it shouldn't hit the fast-path
 * in the first place.
 */
export function extractSearchQuery(message: string): string {
  const q = message.trim()
    .replace(/^(?:google|search\s+for|look\s+up|find\s+me|find|search)\s+/i, '');
  return q.trim() || message.trim();
}

// ─────────────────────────────────────────────────────────────
// Fast-path regex routing (no LLM needed for obvious cases)
// ─────────────────────────────────────────────────────────────

export function detectFastRoute(message: string): string | null {
  const t = message.trim().toLowerCase();

  // 0. Empty / whitespace-only → reject
  if (!t) return 'chat';

  // 0b. Very short casual messages → always chat (prevents "yo", "hi", "hey" from misrouting)
  if (t.length <= 4 && !/\S+\.\S+/.test(t) && !/^(open|find|go|search|click|close|launch|do)/.test(t)) return 'chat';

  // No conversational prefix stripping — if the user says "can you look up X",
  // that's conversational phrasing and should fall through to the LLM router
  // which naturally understands intent. Fast-path only catches clean commands.
  const core = t;

  // 1. Browse: localhost URLs (e.g. "localhost:3000", "localhost:8888/search")
  if (/^localhost[:/]/i.test(t)) return 'browse';

  // 1b. Browse with explicit protocol — highest priority (e.g. "go to reddit.com and scroll down")
  if (/https?:\/\//i.test(t)) return 'browse';

  // 2. Browse: "go to X.com", "navigate to X.org", "open a new tab" patterns
  //    Must come before desktop so "go to reddit.com ..." is browse, not desktop
  if (/^(go\s+to|navigate\s+to)\s+\S+\.\w{2,}/i.test(core)) return 'browse';
  if (/\bopen\s+a?\s*new\s+tab\b/i.test(core)) return 'browse';
  // Bare domain mention: "nos.nl", "reddit.com and scroll down"
  if (/^\S+\.\w{2,}(\s|$)/.test(core) && /\.(com|org|net|io|co|dev|app|ai|nl|de|fr|uk|es|it|be|ru|jp|cn|au|ca|br|in|eu|us|gov|edu|info|biz|me|tv|cc|xyz)\b/i.test(core)) return 'browse';

  // 3. Desktop: open/close specific apps, click, navigate UI
  //    Requires a known app name so "open a new tab" doesn't match
  if (/^(open|close|click|launch)\s+(chrome|finder|terminal)\b/i.test(core)) return 'desktop';

  // 3b. Desktop: CAPTCHA / robot verification — must route before chat/search
  if (/(?:captcha|robot|recaptcha|verify|i.?m not a robot|checkbox|prove|human)/i.test(t)) return 'desktop';
  if (/(?:click|press|tap|check|tick)\s+(?:the\s+)?(?:box|button|checkbox)/i.test(t)) return 'desktop';
  if (/(?:do|solve|handle|complete|bypass|pass)\s+(?:the\s+)?(?:captcha|verification|check)/i.test(t)) return 'desktop';

  // 4. Search: trigger word + at least 2 words of query (avoids "search and destroy")
  //    "google X", "search for X", "look up X", "find me X", "find X online"
  //    Now also matches "can you look up X", "please google X" etc. via `core`.
  if (/^(?:google|search\s+for|look\s+up)\s+\S.+/i.test(core)) return 'search';
  if (/^find\s+(?:me\s+)?(?:\w+\s+){1,}.+/i.test(core)) return 'search';
  // "search <2+ words>" — negative lookahead excludes short phrases like "search and"
  if (/^search\s+(?!and\b)(?!or\b)(\S+\s+\S+)/i.test(core)) return 'search';

  // 5. Research: mass web fetch / deep investigation queries
  if (/(?:research|analyze|compare|find out about|investigate|deep dive|look into)\s+/i.test(t) && t.split(' ').length > 3) return 'research';
  if (/(?:scrape|fetch|crawl|check)\s+(?:\d+|multiple|many|several|all)\s+/i.test(t)) return 'research';

  // 6. Short questions → chat
  if (/\?$/.test(t) && t.split(' ').length <= 6) return 'chat';

  return null;
}

// ─────────────────────────────────────────────────────────────
// Secondary-intent parser
// ─────────────────────────────────────────────────────────────

/**
 * Splits a message on compound connectors and collects ALL secondary actions
 * (search / browse / finder) from each clause after the first.
 */
export function parseAllSecondaryIntents(msg: string): SecondaryAction[] {
  // Split on commas + connectors as well so 3-part commands work
  const parts = msg.split(/\s*[,;]\s*|\s+(?:and|then|also|after\s+that)\s+/i);
  if (parts.length < 2) return [];
  const actions: SecondaryAction[] = [];
  for (let i = 1; i < parts.length; i++) {
    const clause = parts[i].trim();

    // Search: "google <q>", "search for <q>", "search <q>",
    //         "look up <q>", "find <q>", "check out ... (search context)"
    const searchMatch = clause.match(
      /^(?:google|search\s+for|search|look\s+up|find|check\s+out)\s+(.+)$/i,
    );
    if (searchMatch) {
      const query = searchMatch[1].trim();
      // "check out youtube.com" → treat as browse if it looks like a URL
      const looksLikeUrl = /^https?:\/\/|^\S+\.(com|org|net|io|co|dev|app|ai)/i.test(query);
      if (looksLikeUrl) {
        let url = query.replace(/^https?:\/\//i, '');
        url = 'https://' + url.split(/\s+/)[0];
        actions.push({ kind: 'browse', url });
      } else {
        actions.push({
          kind: 'search',
          query,
          url: `${INFRASTRUCTURE.searxngUrl}/search?q=${encodeURIComponent(query)}`,
        });
      }
      continue;
    }

    // Browse: "go to <url>", "navigate to <url>", "open <url.tld>",
    //         bare domain like "youtube.com"
    const browseMatch = clause.match(
      /^(?:go\s+to|navigate\s+to|open)\s+(https?:\/\/\S+|\S+\.(?:com|org|net|io|co|dev|app|ai)\S*)/i,
    ) || clause.match(
      /^(https?:\/\/\S+|\S+\.(?:com|org|net|io|co|dev|app|ai)\S*)\s*$/i,
    );
    if (browseMatch) {
      let url = (browseMatch[1] || browseMatch[0]).trim().split(/\s+/)[0];
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      actions.push({ kind: 'browse', url });
      continue;
    }

    // Finder: "open downloads", "open documents", "open <folder>"
    const finderMatch = clause.match(
      /^open\s+(downloads?|documents?|desktop|pictures?|movies?|music|applications?|home)\b/i,
    );
    if (finderMatch) {
      const folderMap: Record<string, string> = {
        download: '~/Downloads', downloads: '~/Downloads',
        document: '~/Documents', documents: '~/Documents',
        desktop: '~/Desktop',
        picture: '~/Pictures', pictures: '~/Pictures',
        movie: '~/Movies', movies: '~/Movies',
        music: '~/Music',
        application: '/Applications', applications: '/Applications',
        home: '~',
      };
      const key = finderMatch[1].toLowerCase();
      const path = folderMap[key] || `~/${finderMatch[1]}`;
      actions.push({ kind: 'finder', path });
      continue;
    }
  }
  return actions;
}

/** Convenience wrapper — returns first action (legacy call sites). */
export function parseSecondaryIntent(msg: string): SecondaryAction | null {
  const all = parseAllSecondaryIntents(msg);
  return all.length > 0 ? all[0] : null;
}
