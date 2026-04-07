/**
 * OnboardingModal — First-launch welcome flow for NEURO.
 * Shows once when localStorage key 'neuro_onboarded' is not set.
 * 3 slides with Framer Motion transitions.
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import BlobAvatar from './BlobAvatar';
import { FONT_FAMILY } from '../constants/ui';

const ONBOARDING_KEY = 'neuro_onboarded';

interface OnboardingModalProps {
  onComplete: () => void;
}

// ── Capability card data ────────────────────────────────────────────────────

const CAPABILITIES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    title: 'Web Search',
    desc: 'Real-time search across the web with source citations',
    color: '#2B79FF',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
    title: 'Code Mode',
    desc: 'Write, run, and debug code in any language',
    color: '#22d3ee',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
    title: 'Tasks',
    desc: 'Multi-step autonomous task execution',
    color: '#a78bfa',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
      </svg>
    ),
    title: 'Memory',
    desc: 'Remembers context and learns your preferences',
    color: '#f59e0b',
  },
];

// ── Slide transitions ────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const transition = { type: 'spring' as const, stiffness: 300, damping: 30 };

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { isDarkMode, animationsEnabled } = useTheme();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const TOTAL_STEPS = 3;

  const c = {
    overlay: 'rgba(0,0,0,0.7)',
    bg: isDarkMode ? '#111111' : '#FFFFFF',
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDarkMode ? 'rgba(255,255,255,0.92)' : '#0F0F0F',
    textSec: isDarkMode ? 'rgba(255,255,255,0.45)' : '#6B7280',
    accent: '#2B79FF',
    cardBg: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    cardBorder: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    dotActive: '#2B79FF',
    dotInactive: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
    skipBg: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    skipText: isDarkMode ? 'rgba(255,255,255,0.4)' : '#9CA3AF',
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep(s => s + 1);
    } else {
      handleComplete();
    }
  };

  const goPrev = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: c.overlay,
        backdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Skip button */}
      <button
        onClick={handleComplete}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: c.skipBg, border: 'none',
          borderRadius: 8, padding: '7px 14px',
          fontSize: 13, color: c.skipText,
          cursor: 'pointer', fontFamily: FONT_FAMILY,
        }}
      >
        Skip
      </button>

      {/* Card */}
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: c.bg,
          borderRadius: 22,
          border: `1px solid ${c.border}`,
          boxShadow: '0 32px 100px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 460,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Slide content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={animationsEnabled ? slideVariants : undefined}
              initial={animationsEnabled ? 'enter' : false}
              animate="center"
              exit={animationsEnabled ? 'exit' : undefined}
              transition={transition}
              style={{
                padding: '52px 40px 28px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', gap: 0,
              }}
            >

              {/* ── Slide 0: Welcome ── */}
              {step === 0 && (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <BlobAvatar seed="neuro-onboarding" size={80} initials="N" animated={animationsEnabled} />
                  </div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: c.text, margin: '0 0 12px', lineHeight: 1.2 }}>
                    Welcome to NEURO
                  </h1>
                  <p style={{ fontSize: 15, color: c.textSec, margin: 0, lineHeight: 1.65, maxWidth: 340 }}>
                    Your autonomous AI agent. Ask anything, build anything, research anything.
                  </p>
                </>
              )}

              {/* ── Slide 1: Capabilities ── */}
              {step === 1 && (
                <>
                  <h2 style={{ fontSize: 26, fontWeight: 700, color: c.text, margin: '0 0 8px', letterSpacing: '-0.3px' }}>
                    What NEURO can do
                  </h2>
                  <p style={{ fontSize: 15, color: c.textSec, margin: '0 0 32px', lineHeight: 1.6 }}>
                    Powerful tools built for productivity.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%' }}>
                    {CAPABILITIES.map((cap, idx) => (
                      <motion.div
                        key={cap.title}
                        initial={animationsEnabled ? { opacity: 0, y: 8 } : false}
                        animate={animationsEnabled ? { opacity: 1, y: 0 } : false}
                        transition={animationsEnabled ? { delay: idx * 0.08, duration: 0.3 } : {}}
                        style={{
                          background: c.cardBg,
                          border: `1px solid ${c.cardBorder}`,
                          borderRadius: 16,
                          padding: '18px 16px',
                          textAlign: 'left',
                          cursor: 'default',
                          transition: 'all 0.25s ease',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                          e.currentTarget.style.borderColor = cap.color + '40';
                          e.currentTarget.style.boxShadow = `0 8px 24px ${cap.color}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = c.cardBg;
                          e.currentTarget.style.borderColor = c.cardBorder;
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Accent line */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: cap.color,
                          opacity: 0.6,
                        }} />

                        <div style={{ color: cap.color, marginBottom: 12, marginTop: 3 }}>{cap.icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 6, letterSpacing: '-0.2px' }}>
                          {cap.title}
                        </div>
                        <div style={{ fontSize: 13, color: c.textSec, lineHeight: 1.55 }}>
                          {cap.desc}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Slide 2: Ready ── */}
              {step === 2 && (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2B79FF 0%, #7c3aed 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto',
                    }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    </div>
                  </div>
                  <h2 style={{ fontSize: 26, fontWeight: 700, color: c.text, margin: '0 0 12px' }}>
                    You're all set
                  </h2>
                  <p style={{ fontSize: 15, color: c.textSec, margin: '0 0 32px', lineHeight: 1.65, maxWidth: 300 }}>
                    Start a conversation and let NEURO handle the rest.
                  </p>
                  <button
                    onClick={handleComplete}
                    style={{
                      padding: '14px 40px',
                      background: c.accent,
                      color: '#fff',
                      border: 'none', borderRadius: 12,
                      fontSize: 15, fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT_FAMILY,
                      boxShadow: '0 4px 20px rgba(43,121,255,0.4)',
                    }}
                  >
                    Start chatting
                  </button>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Bottom nav ── */}
        <div style={{
          padding: '24px 40px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: `1px solid ${c.border}`,
          background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.01)',
        }}>
          {/* Back button */}
          <button
            onClick={goPrev}
            disabled={step === 0}
            style={{
              background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: 10, padding: '10px 18px',
              fontSize: 14, fontWeight: 500, color: step === 0 ? c.dotInactive : c.text,
              cursor: step === 0 ? 'default' : 'pointer',
              fontFamily: FONT_FAMILY, opacity: step === 0 ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (step > 0) {
                e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
              e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
            }}
          >
            ← Back
          </button>

          {/* Dots */}
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                style={{
                  width: i === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === step ? c.dotActive : c.dotInactive,
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.25s ease',
                }}
              />
            ))}
          </div>

          {/* Next / Start */}
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={goNext}
              style={{
                background: c.accent, color: '#fff',
                border: 'none', borderRadius: 10, padding: '10px 24px',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: FONT_FAMILY,
                boxShadow: `0 4px 16px ${c.accent}30`,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 6px 24px ${c.accent}45`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 4px 16px ${c.accent}30`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Next →
            </button>
          ) : (
            <div style={{ width: 60 }} /> // spacer to balance layout on last slide
          )}
        </div>
      </div>
    </div>
  );
}

/** Check if onboarding should be shown */
export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(ONBOARDING_KEY);
}
