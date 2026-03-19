/**
 * VoiceInput -- Reusable voice-to-text mic button using Web Speech API
 *
 * Accumulates all transcript segments during a recording session,
 * auto-restarts on silence, and flushes the full transcript on stop.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Web Speech API types (not in default TS lib) ─────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null;
}

// ── Props ────────────────────────────────────────────────────────────────

interface VoiceInputProps {
  /** Called with the full accumulated transcript when the user stops recording */
  onTranscript: (text: string) => void;
  /** Called with interim text while recording (for live preview in textarea) */
  onInterim?: (text: string) => void;
  /** Override button size (default 32) */
  size?: number;
  /** Extra class names */
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────

export default function VoiceInput({ onTranscript, onInterim, size = 32, className = '' }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [supported] = useState(() => getSpeechRecognition() !== null);

  // Refs to avoid stale closures in recognition callbacks
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isRecordingRef = useRef(false);
  const accumulatedRef = useRef('');
  const interimRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isRecordingRef.current = false;
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    // Reset accumulated text
    accumulatedRef.current = '';
    interimRef.current = '';

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    setRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result === undefined) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }

      if (finalChunk) {
        // Append finalized text with a space separator
        if (accumulatedRef.current && !accumulatedRef.current.endsWith(' ')) {
          accumulatedRef.current += ' ';
        }
        accumulatedRef.current += finalChunk.trim();
      }

      interimRef.current = interimChunk;

      // Report interim preview: accumulated + current interim
      const preview = (accumulatedRef.current + (interimChunk ? ' ' + interimChunk : '')).trim();
      onInterim?.(preview);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" and "no-speech" are not real errors
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      console.warn('[VoiceInput] Speech recognition error:', event.error);
      // On fatal errors, stop gracefully
      isRecordingRef.current = false;
      setRecording(false);
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't explicitly stopped
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // Browser refused restart -- flush what we have
          isRecordingRef.current = false;
          setRecording(false);
          flush();
        }
      }
    };

    try {
      recognition.start();
    } catch {
      isRecordingRef.current = false;
      setRecording(false);
    }
  }, [onInterim]);

  const flush = useCallback(() => {
    const text = accumulatedRef.current.trim();
    if (text) {
      onTranscript(text);
    }
    accumulatedRef.current = '';
    interimRef.current = '';
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setRecording(false);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    // Wait 500ms for any final results to land, then flush
    flushTimerRef.current = setTimeout(() => {
      flush();
      flushTimerRef.current = null;
    }, 500);
  }, [flush]);

  const toggle = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  // Don't render if browser doesn't support Speech API
  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`shrink-0 rounded-full flex items-center justify-center transition-all ${className}`}
      style={{
        width: size,
        height: size,
        background: recording ? 'rgba(43,121,255,0.2)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${recording ? 'rgba(43,121,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
        color: recording ? '#2B79FF' : 'rgba(255,255,255,0.25)',
        boxShadow: recording ? '0 0 12px rgba(43,121,255,0.3), 0 0 4px rgba(43,121,255,0.15)' : 'none',
        animation: recording ? 'voice-pulse 1.5s ease-in-out infinite' : 'none',
      }}
      title={recording ? 'Stop recording' : 'Voice input'}
    >
      {recording ? <RecordingIcon size={size * 0.45} /> : <MicIcon size={size * 0.45} />}
    </button>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="1.5" width="5" height="9" rx="2.5" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0" />
      <line x1="8" y1="12" x2="8" y2="14.5" />
      <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" />
    </svg>
  );
}

function RecordingIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="3" width="10" height="10" rx="2" />
    </svg>
  );
}
