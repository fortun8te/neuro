/**
 * useAmbientSound — Subtle SaaS ambient background soundtrack
 *
 * Procedurally generated using Web Audio API — no external files.
 * Creates a warm, low-frequency pad with gentle modulation.
 * Toggle on/off, persists preference to localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const LS_KEY = 'nomad-ambient-on';

// ── Audio nodes ──
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isPlaying = false;
const oscillators: OscillatorNode[] = [];
const gains: GainNode[] = [];

function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return { ctx: audioCtx, master: masterGain! };
}

function startAmbient() {
  if (isPlaying) return;
  const { ctx, master } = getCtx();

  // Clean previous
  oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
  gains.forEach(g => { try { g.disconnect(); } catch {} });
  oscillators.length = 0;
  gains.length = 0;

  // Frequencies: A1, E2, A2 (deep warm pad in A major)
  const freqs = [55, 82.41, 110, 164.81];
  const types: OscillatorType[] = ['sine', 'sine', 'sine', 'triangle'];

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = types[i];
    osc.frequency.value = freq;

    // Very subtle detuning for warmth
    osc.detune.value = (i - 1.5) * 3;

    // Low-pass to keep it mellow
    filter.type = 'lowpass';
    filter.frequency.value = 200 + i * 40;
    filter.Q.value = 0.5;

    // Individual gain — quieter for higher frequencies
    gain.gain.value = i === 0 ? 0.04 : i === 1 ? 0.03 : i === 2 ? 0.02 : 0.015;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();

    oscillators.push(osc);
    gains.push(gain);

    // Slow LFO modulation on gain for breathing effect
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08 + i * 0.02; // Very slow: 0.08-0.14 Hz
    lfoGain.gain.value = gain.gain.value * 0.3; // 30% depth modulation
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    oscillators.push(lfo);
    gains.push(lfoGain);
  });

  // Fade in over 3 seconds
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);

  isPlaying = true;
}

function stopAmbient() {
  if (!isPlaying || !audioCtx || !masterGain) return;

  // Fade out over 2 seconds
  const now = audioCtx.currentTime;
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + 2);

  // Stop oscillators after fade
  setTimeout(() => {
    oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
    gains.forEach(g => { try { g.disconnect(); } catch {} });
    oscillators.length = 0;
    gains.length = 0;
    isPlaying = false;
  }, 2200);
}

export function useAmbientSound() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });
  const initializedRef = useRef(false);

  // Sync with enabled state
  useEffect(() => {
    if (enabled) {
      // Need a user gesture first — defer until AudioContext can start
      const start = () => {
        startAmbient();
        initializedRef.current = true;
      };
      if (audioCtx && audioCtx.state === 'running') {
        start();
      } else {
        // Will start on next user interaction
        const handler = () => { start(); document.removeEventListener('click', handler); };
        document.addEventListener('click', handler, { once: true });
        return () => document.removeEventListener('click', handler);
      }
    } else {
      if (initializedRef.current) stopAmbient();
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAmbient(); };
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  return { ambientEnabled: enabled, toggleAmbient: toggle };
}
