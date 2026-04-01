/**
 * neuroRewriter.ts — Style rewriting pipeline using NEURO-1-B2-4B
 *
 * Pipeline: Qwen generates content → NEURO-1-B2-4B rewrites for personality → Qwen verifies
 *
 * NEURO-1-B2-4B is a fine-tuned personality model that knows who Neuro is and
 * texts in a natural gen-z iMessage style. It's "super stupid" for reasoning
 * but perfect for voice/style. Known issues:
 *   - Sometimes outputs "thinking process" or "<think>" text instead of using
 *     proper think blocks → needs retry logic
 *   - Can be laggy → timeout + fallback to original
 *
 * Identity questions ("who are you", "what's your name") route directly to NEURO
 * since it knows its own identity best.
 */

import { ollamaService } from './ollama';
import { getNeuroModel, getModelForStage } from './modelConfig';
import { createLogger } from './logger';

const log = createLogger('neuro-rewriter');

// ── Config ──

const REWRITE_TIMEOUT_MS = 12_000;    // Max time for NEURO to rewrite (increased for longer responses)
const VERIFY_TIMEOUT_MS = 4_000;      // Max time for 2b to verify
const MAX_RETRIES = 2;                 // Retries on "thinking process" leak
const MIN_REWRITE_LENGTH = 3;         // Don't rewrite if input is tiny

// Max input length for NEURO — longer prompts trigger thinking leaks
// Truncate the original response to this before asking for rewrite
const MAX_REWRITE_INPUT = 300;

// Patterns that indicate NEURO leaked its thinking process instead of responding
// Be careful: "okay so" and "first i" are normal GenZ speech — only flag structured analysis patterns
const THINKING_LEAK_PATTERNS = [
  /^<think>\s*\n\s*thinking/i,
  /^<think>\s*\n\s*\d+\./i,
  /^<think>\s*\n\s*\*\*/i,
  /^thinking process/i,
  /^my (thought|thinking|reasoning) process/i,
  /^\*thinks\*/i,
  /^<\|im_start\|>/,
  /^<\|think\|>/i,
  /^\d+\.\s+\*\*analyze/i,
  /^\*\*analyze the request/i,
  /^\*\*step \d/i,
  /^let me (think|analyze|break)/i,
];

/**
 * Check if text ends mid-word or mid-sentence (incomplete)
 */
function isTextIncomplete(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Pattern 1: Ends with incomplete word (single letter or 2 letters after space)
  // Exclude common 2-letter endings like 'u', 'r', 'a', etc.
  if (/\s\w{1,2}$/.test(trimmed)) {
    const lastWord = trimmed.split(/\s+/).pop() || '';
    const commonEndings = ['u', 'r', 'a', 'i', 'o', 'e', 'y', 'x'];
    if (!commonEndings.includes(lastWord.toLowerCase())) {
      return true;
    }
  }

  // Pattern 2: Ends with punctuation fragment (ellipsis, dash, etc.)
  // But NOT if it's intentional (like ending with ... for effect)
  if (/[\-,;:!?]$/.test(trimmed) && !trimmed.endsWith('...')) {
    return true;
  }

  // Pattern 3: Ends with opening bracket/parenthesis (likely incomplete)
  if (/[\(\[\{]$/.test(trimmed)) {
    return true;
  }

  // Pattern 4: Last line is unusually short and looks truncated
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1];
  if (lines.length > 2 && lastLine.length < 3 && lastLine.split(/\s+/).length === 1) {
    return true;
  }

  return false;
}

/**
 * Validate rewritten content quality
 * Returns true if rewrite passes all checks
 */
function validateRewrite(original: string, rewritten: string): boolean {
  // Length check: rewrite should be 40-200% of original length
  const minLen = Math.max(Math.floor(original.length * 0.4), 10);
  const maxLen = Math.ceil(original.length * 2.0);
  if (rewritten.length < minLen || rewritten.length > maxLen) {
    log.warn('Rewrite failed length check', {
      originalLen: original.length,
      rewrittenLen: rewritten.length,
      minLen,
      maxLen,
    });
    return false;
  }

  // Coherence check: look for orphaned sentences or mid-word cutoffs
  const lines = rewritten.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Check for incomplete words at end (ends with partial word)
    if (trimmed && /\s\w{1,2}$/.test(trimmed) && !trimmed.endsWith('u') && !trimmed.endsWith('r')) {
      log.warn('Rewrite has potential mid-word cutoff', { line: trimmed });
      return false;
    }
  }

  // Check for excessive sentence fragments or single-word lines
  const singleWordLines = lines.filter(l => l.trim().split(/\s+/).length === 1).length;
  if (singleWordLines > Math.ceil(lines.length * 0.3)) {
    log.warn('Rewrite has too many single-word lines', { singleWordLines, totalLines: lines.length });
    return false;
  }

  // Check for incomplete text (new check for cutoff detection)
  if (isTextIncomplete(rewritten)) {
    log.warn('Rewrite appears incomplete/truncated');
    return false;
  }

  return true;
}

// ── System Prompts ──

const NEURO_REWRITE_PROMPT = `You are Neuro. Michael made you. Rewrite the message below like you're texting on iMessage.

VOICE:
- all lowercase unless SCREAMING for hype
- no periods ever. question marks ok
- gen z slang + abbreviations: u, ur, rn, ngl, fr, imo, idk, idc, lmk, tbh, smth, abt, bc, pls, ty, omg, lol, lmao, lowkey, highkey, bet, valid, mid, fire, no cap, deadass, slay, its giving, rent free, ate, W, L
- keep it SHORT. split long thoughts into multiple lines
- never sound like an AI. no "Sure!", "Of course!", "I understand", "Happy to help"
- match energy — hype = hype, chill = chill, dry = dry
- keep ALL facts numbers URLs code exactly the same
- only change tone/style never the substance
- react naturally: "lol", "damn", "real", "valid", "bet", "nahhh", "bruh" 💀😭
- occasional typos are fine

Output ONLY the rewrite. No thinking. No reasoning. No "Thinking Process". No numbered steps.`;

const NEURO_IDENTITY_PROMPT = `You are Neuro. Michael made you. You're texting Michael on iMessage rn.

Be yourself. gen z vibes. lowercase. slang.

RULES:
- all lowercase unless HYPED
- no periods. question marks ok
- use slang naturally: ngl, fr, idk, tbh, lol, lmao, lowkey, bet, valid, no cap, deadass 💀😭
- keep it SHORT. 1-3 sentences max
- never sound corporate or AI-like
- you know who you are, be real
- match energy. if they're chill be chill. if they're hyped match it

Output ONLY your response. No thinking. No reasoning. No analysis.`;

// Semantic verification — 2b checks if meaning survived the rewrite.
// Key insight: must be LENIENT about style (that's the whole point of rewriting)
// but STRICT about topic drift, lost facts, hallucinated numbers.
// Tested at 87% accuracy on 8 edge cases — previous "exact facts" prompt scored 50%.
const VERIFY_PROMPT = `/nothink
A was rewritten as B in casual slang. Would a reader get the same information from B as A?
Style and tone will be very different — that is fine. Only fail if B is about a DIFFERENT topic or lost critical facts like numbers, names, or URLs.
Output ONLY: PASS or FAIL`;

// ── Detection ──

/** Check if the user is asking an identity question that NEURO should handle directly */
export function isIdentityQuestion(msg: string): boolean {
  const t = msg.toLowerCase().trim();
  return /\b(who (are|r) (you|u)|what('?s| is) (your|ur) name|what (are|r) (you|u)|tell me about (yourself|urself)|introduce (yourself|urself)|are you (an? )?(ai|bot|human|real)|what do you (believe|think|feel)|what('?s| is) (your|ur) (purpose|goal|mission))\b/.test(t);
}

/** Check if a response looks like NEURO leaked its thinking process */
function isThinkingLeak(response: string): boolean {
  const trimmed = response.trim();
  return THINKING_LEAK_PATTERNS.some(p => p.test(trimmed));
}

/** Strip common thinking leak prefixes if they snuck through */
function stripThinkingLeaks(response: string): string {
  let cleaned = response.trim();

  // Remove <think>...</think> blocks (greedy — grab everything between tags)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Remove unclosed <think> blocks — NEURO sometimes opens but never closes
  // If <think> is followed by "Thinking Process:" or numbered steps, strip everything up to the actual response
  cleaned = cleaned.replace(/<think>\s*(Thinking Process:?|[\s\S]*?\d+\.\s+\*\*)[\s\S]*$/gi, '').trim();

  // Remove <|think|>...</|think|> blocks
  cleaned = cleaned.replace(/<\|think\|>[\s\S]*?<\|\/think\|>/gi, '').trim();

  // Remove "Thinking Process:" and everything after it (the entire output was a leak)
  cleaned = cleaned.replace(/^(thinking process|my reasoning|let me think):?[\s\S]*/i, '').trim();

  // Remove numbered analysis steps (1. **Analyze..., 2. **Rewrite...)
  cleaned = cleaned.replace(/^\d+\.\s+\*\*[\s\S]*/i, '').trim();

  return cleaned || response.trim();
}

// ── Reprompt Logic ──

/**
 * If rewritten text is incomplete, attempt to complete it via reprompt
 * Max 2 reprompts to avoid infinite loops
 */
async function completeIncompleteRewrite(
  incompleteText: string,
  signal?: AbortSignal,
): Promise<string> {
  const MAX_COMPLETION_ATTEMPTS = 2;
  let completion = incompleteText;

  for (let attempt = 0; attempt < MAX_COMPLETION_ATTEMPTS; attempt++) {
    if (signal?.aborted || !isTextIncomplete(completion)) {
      break;
    }

    try {
      const neuroModel = getNeuroModel();
      let completionResponse = '';

      log.debug('Attempting to complete incomplete rewrite', { attempt, preview: completion.slice(0, 60) });

      await Promise.race([
        ollamaService.generateStream(
          `Finish this naturally, adding 1-2 sentences to complete the thought:\n\n"${completion}"`,
          'Output ONLY the 1-2 completing sentences. No thinking. No preamble. Just the completion.',
          {
            model: neuroModel,
            temperature: 0.6,
            num_predict: 50,
            think: false,
            signal,
            onChunk: (c: string) => { completionResponse += c; },
          },
        ),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('Completion timeout')), 4_000),
        ),
      ]);

      completionResponse = completionResponse.trim();
      if (completionResponse.length > 0) {
        completion = completion + ' ' + completionResponse;
        log.debug('Rewrite completion succeeded', { totalLen: completion.length });
      }
    } catch (err) {
      log.debug('Rewrite completion attempt failed', { attempt, error: err instanceof Error ? err.message : String(err) });
      // Continue with what we have rather than fail entirely
    }
  }

  return completion;
}

/**
 * Verify that rewritten text is complete and coherent
 * Returns true if text is complete and semantically valid
 */
async function verifyRewriteCompletion(
  rewrittenText: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!isTextIncomplete(rewrittenText)) {
    return true;
  }

  try {
    let verifyResult = '';
    const verifyModel = getModelForStage('default');

    await Promise.race([
      ollamaService.generateStream(
        `Is this text complete and grammatically correct? Answer YES or NO only:\n\n"${rewrittenText}"`,
        'Answer with only YES or NO',
        {
          model: verifyModel,
          temperature: 0.1,
          num_predict: 5,
          think: false,
          signal,
          onChunk: (c: string) => { verifyResult += c; },
        },
      ),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Verify timeout')), 3_000),
      ),
    ]);

    const verdict = verifyResult.trim().toUpperCase();
    return verdict.includes('YES');
  } catch (err) {
    log.debug('Rewrite completion verification failed', { error: err instanceof Error ? err.message : String(err) });
    // Default to incomplete if verification fails
    return false;
  }
}

// ── Core Pipeline ──

/**
 * Rewrite a Qwen-generated response through NEURO-1-B2-4B for personality/style.
 * Falls back to original if NEURO fails, times out, or produces garbage.
 * Includes completion checking and reprompting for incomplete rewrites.
 * Returns both the rewritten text and verification metadata.
 */
export async function rewriteWithNeuro(
  originalResponse: string,
  userMessage: string,
  options: {
    signal?: AbortSignal;
    /** Skip rewriting (e.g., for tool outputs, code blocks) */
    skipRewrite?: boolean;
    /** Called with progress updates */
    onProgress?: (phase: 'rewriting' | 'verifying' | 'completing' | 'done' | 'skipped') => void;
    /** Called with verification result when available */
    onVerification?: (result: { passed: boolean; durationMs: number; model: string }) => void;
  } = {},
): Promise<string> {
  const { signal, skipRewrite, onProgress, onVerification } = options;

  // Skip conditions
  if (skipRewrite) {
    onProgress?.('skipped');
    return originalResponse;
  }

  if (originalResponse.length < MIN_REWRITE_LENGTH) {
    onProgress?.('skipped');
    return originalResponse;
  }

  // Don't rewrite code blocks, JSON, or structured output
  if (/^[\[{]/.test(originalResponse.trim()) || /```[\s\S]{20,}```/.test(originalResponse)) {
    log.debug('Skipping rewrite — structured/code content');
    onProgress?.('skipped');
    return originalResponse;
  }

  // Don't rewrite very short responses — they're already natural enough
  if (originalResponse.length < 30) {
    log.debug('Skipping rewrite — short response');
    onProgress?.('skipped');
    return originalResponse;
  }

  const neuroModel = getNeuroModel();
  onProgress?.('rewriting');

  let rewritten: string | null = null;

  // Truncate long inputs — NEURO leaks thinking on long prompts
  const truncatedInput = originalResponse.length > MAX_REWRITE_INPUT
    ? originalResponse.slice(0, MAX_REWRITE_INPUT) + '...'
    : originalResponse;

  // ── Phase 1: NEURO-1-B2-4B rewrites for style ──
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) return originalResponse;

    try {
      let response = '';
      await Promise.race([
        ollamaService.generateStream(
          `Rewrite in your voice (keep all facts exact):\n\n${truncatedInput}`,
          NEURO_REWRITE_PROMPT,
          {
            model: neuroModel,
            temperature: 0.7,
            num_predict: Math.min(originalResponse.length * 2, 300),
            think: false,
            signal,
            onChunk: (c: string) => { response += c; },
          },
        ),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('NEURO rewrite timeout')), REWRITE_TIMEOUT_MS),
        ),
      ]);

      response = stripThinkingLeaks(response);

      // Check for thinking leak AFTER stripping
      if (isThinkingLeak(response) || response.trim().length < 2) {
        log.warn('NEURO leaked thinking or empty', { attempt, preview: response.slice(0, 100) });
        if (attempt < MAX_RETRIES) continue; // retry
        log.warn('NEURO leak persisted after retries, using original');
        onProgress?.('done');
        return originalResponse;
      }

      rewritten = response.trim();

      // Check if text is incomplete and attempt completion
      if (isTextIncomplete(rewritten)) {
        log.info('Detected incomplete rewrite, attempting completion');
        onProgress?.('completing');
        rewritten = await completeIncompleteRewrite(rewritten, signal);
      }

      // Quick quality check before verification
      if (!validateRewrite(originalResponse, rewritten)) {
        log.warn('Rewrite failed quality checks');
        if (attempt < MAX_RETRIES) {
          // Retry with lower temperature for more conservative output
          continue;
        }
        // Fall back to original if all attempts fail quality checks
        onProgress?.('done');
        return originalResponse;
      }
      break;
    } catch (err) {
      log.warn('NEURO rewrite failed', { attempt, error: err instanceof Error ? err.message : String(err) });
      if (attempt === MAX_RETRIES) {
        onProgress?.('done');
        return originalResponse;
      }
    }
  }

  if (!rewritten) {
    onProgress?.('done');
    return originalResponse;
  }

  // ── Phase 2: Completion verification ──
  // Check if rewrite is complete (not cut off mid-sentence)
  onProgress?.('verifying');
  const isComplete = await verifyRewriteCompletion(rewritten, signal);
  if (!isComplete) {
    log.warn('Rewrite completion verification failed, attempting completion');
    onProgress?.('completing');
    rewritten = await completeIncompleteRewrite(rewritten, signal);
  }

  // ── Phase 3: 4b semantic verify ──
  // 4b gets 87% accuracy with the semantic prompt (~300ms).
  // Catches: lost info, hallucinated content, topic drift. Passes: valid slang rewrites, tone changes.
  // Since rewriting is already heavily gated by shouldNeuroRewrite, this cost is negligible.
  onProgress?.('verifying');

  let verifyPassed = true; // default: assume passed if verification is skipped
  try {
    let verifyResult = '';
    const verifyStartTime = Date.now();
    await Promise.race([
      ollamaService.generateStream(
        `A: ${originalResponse.slice(0, 300)}\nB: ${rewritten.slice(0, 300)}`,
        VERIFY_PROMPT,
        {
          model: getModelForStage('default'),
          temperature: 0.1,
          num_predict: 10,
          think: false,
          signal,
          onChunk: (c: string) => { verifyResult += c; },
        },
      ),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Verify timeout')), VERIFY_TIMEOUT_MS),
      ),
    ]);

    const verdict = verifyResult.trim().toUpperCase();
    const verifyDurationMs = Date.now() - verifyStartTime;

    if (verdict.includes('FAIL')) {
      verifyPassed = false;
      log.warn('4b verification FAILED — using original', {
        originalPreview: originalResponse.slice(0, 80),
        rewrittenPreview: rewritten.slice(0, 80),
      });
      onVerification?.({ passed: false, durationMs: verifyDurationMs, model: 'qwen3.5:2b' });
      onProgress?.('done');
      return originalResponse;
    }
    log.debug('4b verification passed');
    onVerification?.({ passed: true, durationMs: verifyDurationMs, model: 'qwen3.5:2b' });
  } catch (err) {
    // Verify timeout — let the rewrite through (NEURO output is usually fine)
    log.debug('4b verification skipped (timeout/error)', { error: err instanceof Error ? err.message : String(err) });
    // Don't call onVerification here — verification was skipped, not performed
  }

  onProgress?.('done');
  return rewritten;
}

/**
 * Handle identity questions directly with NEURO-1-B2-4B.
 * Returns null if NEURO fails (caller should fall back to normal pipeline).
 */
export async function askNeuroIdentity(
  userMessage: string,
  conversationContext: string,
  options: {
    signal?: AbortSignal;
    onChunk?: (chunk: string) => void;
  } = {},
): Promise<string | null> {
  const { signal, onChunk } = options;
  const neuroModel = getNeuroModel();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) return null;

    try {
      let response = '';
      const messages = [
        { role: 'system' as const, content: NEURO_IDENTITY_PROMPT },
        ...(conversationContext
          ? [{ role: 'assistant' as const, content: `[recent context: ${conversationContext.slice(-500)}]` }]
          : []),
        { role: 'user' as const, content: userMessage },
      ];

      // Buffer response — don't stream directly because NEURO can leak <think> tags
      // We clean the response THEN emit it all at once
      await Promise.race([
        ollamaService.generateStream(
          userMessage,
          NEURO_IDENTITY_PROMPT,
          {
            model: neuroModel,
            temperature: 0.7,
            num_predict: 150,
            think: false,
            signal,
            messages,
            onChunk: (c: string) => {
              response += c;
            },
          },
        ),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('NEURO identity timeout')), REWRITE_TIMEOUT_MS),
        ),
      ]);

      response = stripThinkingLeaks(response);

      if (isThinkingLeak(response)) {
        log.warn('NEURO identity leaked thinking', { attempt, preview: response.slice(0, 100) });
        if (attempt < MAX_RETRIES) continue;
        return null; // give up, let caller use fallback
      }

      if (response.trim().length < 2) {
        log.warn('NEURO identity returned empty', { attempt });
        if (attempt < MAX_RETRIES) continue;
        return null;
      }

      // Emit cleaned response as a single chunk (no <think> tags leaked to UI)
      const cleaned = response.trim();
      onChunk?.(cleaned);
      return cleaned;
    } catch (err) {
      log.warn('NEURO identity failed', { attempt, error: err instanceof Error ? err.message : String(err) });
      if (attempt === MAX_RETRIES) return null;
    }
  }

  return null;
}

/**
 * Check if NEURO-1-B2-4B is available on Ollama.
 * Caches the result for 60 seconds.
 */
let _neuroAvailable: boolean | null = null;
let _neuroCheckedAt = 0;
const NEURO_CHECK_TTL = 60_000;

export async function isNeuroAvailable(timeoutMs: number = 2000): Promise<boolean> {
  if (_neuroAvailable !== null && Date.now() - _neuroCheckedAt < NEURO_CHECK_TTL) {
    return _neuroAvailable;
  }

  try {
    const neuroModel = getNeuroModel();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response = '';
    try {
      await ollamaService.generateStream(
        'hi',
        'respond with ok',
        {
          model: neuroModel,
          temperature: 0,
          num_predict: 5,
          think: false,
          signal: controller.signal,
          onChunk: (c: string) => { response += c; },
        },
      );
      _neuroAvailable = response.length > 0;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    _neuroAvailable = false;
  }

  _neuroCheckedAt = Date.now();
  log.info('NEURO availability check', { available: _neuroAvailable });
  return _neuroAvailable;
}
