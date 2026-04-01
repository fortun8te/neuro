/**
 * AskUserModal — appears when the computer agent needs user confirmation
 * before executing a high-stakes action, or needs goal clarification.
 */

import { useState } from 'react';
import type { AskUserRequest, AskUserResponse } from '../utils/computerAgent/orchestrator';

interface AskUserModalProps {
  request: AskUserRequest | null;
  onResponse: (response: AskUserResponse) => void;
}

export function AskUserModal({ request, onResponse }: AskUserModalProps) {
  const [customText, setCustomText] = useState('');
  const [answered, setAnswered] = useState(false);

  if (!request) return null;

  const isClarification = Boolean(request.isClarification);

  function handleOption(label: string, value: string) {
    setCustomText('');
    onResponse({ value, label });
  }

  function handleCustomSubmit() {
    if (!customText.trim()) return;
    const val = customText.trim();
    setCustomText('');
    if (isClarification) {
      setAnswered(true);
      // Brief delay so "Got it" flashes before modal closes
      setTimeout(() => {
        setAnswered(false);
        onResponse({ value: val, label: val });
      }, 600);
    } else {
      onResponse({ value: val, label: val });
    }
  }

  // Accent colours: blue for clarification, amber for high-stakes
  const accentColor = isClarification ? 'rgba(59,130,246,0.85)' : 'rgba(255,180,50,0.8)';
  const borderColor = isClarification ? 'rgba(59,130,246,0.35)' : 'var(--glass-bg-light)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-user-question"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'rgb(18,18,26)',
          border: `1px solid ${borderColor}`,
          borderRadius: 14,
          padding: '28px 32px',
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: accentColor,
            marginBottom: 12,
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isClarification ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: accentColor }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Quick question
            </>
          ) : 'Agent needs confirmation'}
        </div>

        {/* Question */}
        <p
          id="ask-user-question"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            margin: '0 0 10px 0',
          }}
        >
          {request.question}
        </p>

        {/* Context */}
        {request.context && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              margin: '0 0 20px 0',
            }}
          >
            {request.context}
          </p>
        )}

        {/* Option buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {request.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleOption(opt.label, opt.value)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--glass-border-medium)',
                background: opt.value === 'abort'
                  ? 'rgba(220,50,50,0.15)'
                  : opt.value === 'proceed'
                  ? 'rgba(234,88,12,0.18)'
                  : 'var(--glass-border-light)',
                color: opt.value === 'abort'
                  ? 'rgba(255,100,100,0.9)'
                  : opt.value === 'proceed'
                  ? 'rgba(100,160,255,0.95)'
                  : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom input */}
        {request.allowCustom && (
          answered ? (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: 'rgba(100,160,255,0.9)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              Got it, proceeding...
            </div>
          ) : (
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
                placeholder={isClarification ? 'Your answer...' : 'Type a custom response...'}
                autoFocus={isClarification}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: `1px solid ${isClarification ? 'rgba(59,130,246,0.30)' : 'var(--glass-border-medium)'}`,
                  background: 'var(--glass-border-light)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customText.trim()}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: `1px solid ${isClarification ? 'rgba(59,130,246,0.30)' : 'var(--text-ghost)'}`,
                  background: isClarification ? 'rgba(59,130,246,0.18)' : 'rgba(234,88,12,0.2)',
                  color: isClarification ? 'rgba(100,160,255,0.95)' : 'rgba(100,160,255,0.9)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: customText.trim() ? 'pointer' : 'not-allowed',
                  opacity: customText.trim() ? 1 : 0.4,
                }}
              >
                {isClarification ? 'Answer' : 'Send'}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
