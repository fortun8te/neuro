/**
 * useTextStream — streaming text animation hook
 *
 * Two modes:
 *   - "typewriter": characters appear one by one (fast, raw feel)
 *   - "fade": words/segments fade in with a subtle translateY animation
 *
 * Supports both string input and async iterables for streaming API responses.
 * Includes pause/resume, reset, and completion callbacks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────

export type Mode = 'typewriter' | 'fade';

export type UseTextStreamOptions = {
  textStream: string | AsyncIterable<string>;
  speed?: number;          // 1 = slowest, 100 = fastest
  mode?: Mode;
  onComplete?: () => void;
  fadeDuration?: number;   // ms for each segment fade-in (fade mode)
  segmentDelay?: number;   // ms between segments appearing (fade mode)
  characterChunkSize?: number; // chars per tick (typewriter mode)
};

export type UseTextStreamResult = {
  displayedText: string;
  isComplete: boolean;
  segments: { text: string; index: number }[];
  getFadeDuration: () => number;
  reset: () => void;
  startStreaming: () => void;
  pause: () => void;
  resume: () => void;
};

// ── Speed mapping helpers ────────────────────────────────────

function speedToTypewriterMs(speed: number): number {
  // speed 1 => ~80ms per chunk, speed 100 => ~2ms per chunk
  const clamped = Math.max(1, Math.min(100, speed));
  return Math.round(80 - (clamped - 1) * (78 / 99));
}

function speedToFadeDuration(speed: number, fallback?: number): number {
  if (fallback !== undefined) return fallback;
  const clamped = Math.max(1, Math.min(100, speed));
  return Math.round(600 - (clamped - 1) * (500 / 99));
}

function speedToSegmentDelay(speed: number, fallback?: number): number {
  if (fallback !== undefined) return fallback;
  const clamped = Math.max(1, Math.min(100, speed));
  return Math.round(60 - (clamped - 1) * (55 / 99));
}

// ── useTextStream hook ───────────────────────────────────────

export function useTextStream(options: UseTextStreamOptions): UseTextStreamResult {
  const {
    textStream,
    speed = 50,
    mode = 'typewriter',
    onComplete,
    fadeDuration,
    segmentDelay,
    characterChunkSize = 1,
  } = options;

  const [fullText, setFullText] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [segments, setSegments] = useState<{ text: string; index: number }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = useRef(0);
  const segIdxRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Resolve text from string or async iterable
  useEffect(() => {
    if (typeof textStream === 'string') {
      setFullText(textStream);
      setIsStarted(true);
      return;
    }

    // async iterable
    let cancelled = false;
    let accumulated = '';
    (async () => {
      for await (const chunk of textStream) {
        if (cancelled) break;
        accumulated += chunk;
        setFullText(accumulated);
      }
      if (!cancelled) {
        // Mark streaming complete only after the iterable is fully consumed.
        // Do NOT set this synchronously — the animation must not start until
        // there is text to display and the stream is done.
        setIsStarted(true);
      }
    })();
    // NOTE: intentionally NOT calling setIsStarted(true) here synchronously.
    // Doing so would start the typewriter with an empty fullText and then the
    // animation effect would fire onComplete immediately (infinite-poll branch
    // for async streams) before any content has arrived.

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textStream]);

  // Auto-start streaming when text is available
  useEffect(() => {
    if (!isStarted || !fullText || isPaused) return;

    if (mode === 'typewriter') {
      const intervalMs = speedToTypewriterMs(speed);
      const chunkSize = characterChunkSize;

      const tick = () => {
        posRef.current = Math.min(posRef.current + chunkSize, fullText.length);
        setDisplayedText(fullText.slice(0, posRef.current));

        if (posRef.current >= fullText.length) {
          if (typeof textStream === 'string') {
            setIsComplete(true);
            onCompleteRef.current?.();
          } else {
            // For async iterables: isStarted becomes true only after the iterable
            // is fully consumed (see the resolve effect above). Until then, poll
            // so the typewriter can keep up as new chunks arrive. Once isStarted
            // is true the stream is done — mark complete instead of looping forever.
            if (isStarted) {
              setIsComplete(true);
              onCompleteRef.current?.();
            } else {
              timerRef.current = setTimeout(tick, intervalMs * 2);
            }
          }
          return;
        }
        timerRef.current = setTimeout(tick, intervalMs);
      };

      tick();

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // Fade mode: split into word segments
    if (mode === 'fade') {
      const words = splitIntoSegments(fullText);
      const delay = speedToSegmentDelay(speed, segmentDelay);

      const addNext = () => {
        if (segIdxRef.current >= words.length) {
          // For strings the stream is complete when segments are exhausted.
          // For async iterables, isStarted is set true only after the iterable
          // is fully consumed, so we can use it as the completion signal here too.
          if (typeof textStream === 'string' || isStarted) {
            setIsComplete(true);
            onCompleteRef.current?.();
          }
          // If isStarted is still false, new chunks may arrive and re-trigger
          // this effect with a larger fullText — do nothing for now.
          return;
        }
        segIdxRef.current += 1;
        setSegments(words.slice(0, segIdxRef.current));
        setDisplayedText(words.slice(0, segIdxRef.current).map(s => s.text).join(''));
        timerRef.current = setTimeout(addNext, delay);
      };

      addNext();

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, isStarted, isPaused, mode, speed, characterChunkSize, segmentDelay]);

  const reset = useCallback(() => {
    posRef.current = 0;
    segIdxRef.current = 0;
    setDisplayedText('');
    setSegments([]);
    setIsComplete(false);
    setIsStarted(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startStreaming = useCallback(() => {
    setIsStarted(true);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const getFadeDuration = useCallback(
    () => speedToFadeDuration(speed, fadeDuration),
    [speed, fadeDuration],
  );

  return {
    displayedText,
    isComplete,
    segments,
    getFadeDuration,
    reset,
    startStreaming,
    pause,
    resume,
  };
}

// ── Segment splitting ────────────────────────────────────────

function splitIntoSegments(text: string): { text: string; index: number }[] {
  const result: { text: string; index: number }[] = [];
  // Split on word boundaries, keeping whitespace attached
  const regex = /(\S+\s*|\s+)/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    result.push({ text: match[0], index: idx++ });
  }
  return result;
}
