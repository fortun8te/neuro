/**
 * ResponseStream — animated text streaming component
 *
 * Two modes:
 *   - "typewriter": characters appear one by one (fast, raw feel)
 *   - "fade": words/segments fade in with a subtle translateY animation
 *
 * Replaces the old TypewriterText with a richer, more configurable system.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

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
        setIsStarted(true);
      }
    })();
    setIsStarted(true);

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
            // For async, keep polling until the text stops growing
            timerRef.current = setTimeout(tick, intervalMs * 2);
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
          if (typeof textStream === 'string') {
            setIsComplete(true);
            onCompleteRef.current?.();
          }
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

// ── ResponseStream component ─────────────────────────────────

export type ResponseStreamProps = {
  textStream: string | AsyncIterable<string>;
  mode?: Mode;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  as?: keyof React.JSX.IntrinsicElements;
  fadeDuration?: number;
  segmentDelay?: number;
  characterChunkSize?: number;
};

export function ResponseStream({
  textStream,
  mode = 'typewriter',
  speed = 50,
  className,
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
}: ResponseStreamProps) {
  const {
    displayedText,
    isComplete,
    segments,
    getFadeDuration,
  } = useTextStream({
    textStream,
    mode,
    speed,
    onComplete,
    fadeDuration,
    segmentDelay,
    characterChunkSize,
  });

  if (mode === 'typewriter') {
    return (
      <div className={className || ''}>
        {displayedText}
        {!isComplete && (
          <span
            className="inline-block w-[2px] h-[1em] ml-[1px] align-text-bottom animate-pulse"
            style={{ background: 'rgba(43,121,255,0.6)' }}
          />
        )}
      </div>
    );
  }

  // Fade mode
  const dur = getFadeDuration();

  return (
    <div className={className || ''}>
      {segments.map((seg) => {
        const isWhitespace = /^\s+$/.test(seg.text);
        return (
          <span
            key={seg.index}
            className={`nomad-fade-segment${isWhitespace ? ' nomad-fade-segment-space' : ''}`}
            style={{
              animation: `nomad-fadeIn ${dur}ms ease-out both`,
              display: 'inline',
            }}
          >
            {seg.text}
          </span>
        );
      })}
      {!isComplete && (
        <span
          className="inline-block w-[2px] h-[1em] ml-[1px] align-text-bottom animate-pulse"
          style={{ background: 'rgba(43,121,255,0.4)' }}
        />
      )}
    </div>
  );
}
