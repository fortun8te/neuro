/**
 * NeuroNetworkModal — Live pipeline visualization
 *
 * Shows the AI agent's data-flow as a horizontal 5-stage circuit board:
 *   Input → Router → Model → Tools → Output
 *
 * Animated SVG connections with flowing data-packet dots.
 * Live token/model data from tokenTracker (useSyncExternalStore).
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokenTracker, type TokenInfo } from '../utils/tokenStats';
import { FONT_FAMILY_MONO } from '../constants/ui';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

// ─── Live token hook ──────────────────────────────────────────────────────────
function useTokenInfo(): TokenInfo {
  return useSyncExternalStore(
    tokenTracker.subscribe.bind(tokenTracker),
    tokenTracker.getSnapshot.bind(tokenTracker),
  );
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
interface ToolDef {
  id: string;
  label: string;
  icon: string;
}

const TOOLS: ToolDef[] = [
  { id: 'web_search', label: 'Web Search', icon: '⊕' },
  { id: 'browse',     label: 'Browse',     icon: '◈' },
  { id: 'code',       label: 'Code',       icon: '⊞' },
  { id: 'files',      label: 'Files',      icon: '◧' },
  { id: 'memory',     label: 'Memory',     icon: '◉' },
  { id: 'shell',      label: 'Shell',      icon: '▶' },
  { id: 'analyze',    label: 'Analyze',    icon: '◆' },
];

// ─── Classifier steps shown inside Router stage ───────────────────────────────
const CLASSIFIERS = [
  'Instant Check',
  'Simple Q',
  'Identity',
  'Complexity',
];

// ─── Inline CSS keyframes injected once ──────────────────────────────────────
const STYLE_ID = 'neuro-pipeline-styles';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes packetFlow {
      0%   { stroke-dashoffset: 48; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes packetFlowV {
      0%   { stroke-dashoffset: 48; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes stageGlow {
      0%, 100% { box-shadow: 0 0 0px rgba(59,130,246,0); }
      50%       { box-shadow: 0 0 18px rgba(59,130,246,0.45); }
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(0.6); }
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .neuro-active-stage {
      animation: stageGlow 1.8s ease-in-out infinite;
      border-color: rgba(59,130,246,0.7) !important;
    }
    .neuro-packet-line {
      stroke-dasharray: 8 10;
      animation: packetFlow 0.9s linear infinite;
    }
    .neuro-packet-line-idle {
      stroke-dasharray: 4 14;
      stroke-dashoffset: 0;
    }
    .neuro-pulse-dot {
      animation: pulseDot 1.2s ease-in-out infinite;
    }
    .neuro-modal-enter {
      animation: slideDown 0.25s ease-out forwards;
    }
    .neuro-grid-bg {
      background-image:
        linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
      background-size: 28px 28px;
    }
  `;
  document.head.appendChild(el);
}

// ─── Routing decision from localStorage / last snippet ───────────────────────
function getRoutingDecision(snippet: string): string {
  if (!snippet) return 'Awaiting input...';
  const s = snippet.toLowerCase();
  if (s.includes('research') || s.includes('search')) return '→ Research path';
  if (s.includes('code') || s.includes('function'))   return '→ Code path';
  if (s.includes('file') || s.includes('read'))       return '→ File path';
  if (s.includes('memory'))                            return '→ Memory path';
  return '→ Direct response';
}

// ─── Stage box component ──────────────────────────────────────────────────────
interface StageBoxProps {
  label: string;
  isActive: boolean;
  children: React.ReactNode;
  isMobile?: boolean;
}
function StageBox({ label, isActive, children, isMobile }: StageBoxProps) {
  return (
    <div
      className={isActive ? 'neuro-active-stage' : ''}
      style={{
        background: 'rgba(15,20,30,0.85)',
        border: `1px solid ${isActive ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10,
        padding: isMobile ? '12px 14px' : '16px 18px',
        minWidth: isMobile ? 0 : 190,
        flex: isMobile ? '1 1 140px' : '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color 0.4s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Stage label pill */}
      <div style={{
        fontSize: 10,
        fontFamily: FONT_FAMILY_MONO,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: isActive ? '#3b82f6' : 'rgba(255,255,255,0.35)',
        fontWeight: 600,
        marginBottom: 2,
        transition: 'color 0.4s ease',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Mono value display ───────────────────────────────────────────────────────
function MonoVal({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span style={{
      fontFamily: FONT_FAMILY_MONO,
      fontSize: 11,
      color: dim ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
      letterSpacing: '0.02em',
    }}>
      {children}
    </span>
  );
}

// ─── SVG connection between stages ───────────────────────────────────────────
interface ConnectorProps {
  isActive: boolean;
  vertical?: boolean;
}
function Connector({ isActive, vertical }: ConnectorProps) {
  const color = isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)';
  if (vertical) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
        <svg width="2" height="32" overflow="visible">
          <line
            x1="1" y1="0" x2="1" y2="32"
            stroke={color}
            strokeWidth={isActive ? 2 : 1.5}
            className={isActive ? 'neuro-packet-line' : 'neuro-packet-line-idle'}
          />
        </svg>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
      <svg width="36" height="2" overflow="visible">
        <line
          x1="0" y1="1" x2="36" y2="1"
          stroke={color}
          strokeWidth={isActive ? 2 : 1.5}
          className={isActive ? 'neuro-packet-line' : 'neuro-packet-line-idle'}
        />
      </svg>
    </div>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={active ? 'neuro-pulse-dot' : ''}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: active ? '#3b82f6' : 'rgba(255,255,255,0.15)',
        flexShrink: 0,
        marginTop: 1,
      }}
    />
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function NeuroNetworkModal({ isOpen, onClose }: Props) {
  const tokens = useTokenInfo();
  const backdropRef = useRef<HTMLDivElement>(null);

  const isWorking = tokens.isGenerating || tokens.isThinking || tokens.isModelLoading;

  // Ensure styles injected
  useEffect(() => { ensureStyles(); }, []);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Backdrop click closes
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  // Derived display values
  const modelName = tokens.activeModel || 'idle';
  const liveTokens = tokens.liveTokens;
  const sessionTotal = tokens.sessionTotal;
  const tps = tokens.tokensPerSec > 0 ? tokens.tokensPerSec.toFixed(1) : '--';
  const routingDecision = getRoutingDecision(tokens.liveResponseSnippet);

  const activeStage: string = tokens.isModelLoading ? 'model'
    : tokens.isThinking ? 'model'
    : tokens.isGenerating ? 'output'
    : '';

  // Elapsed call time
  const elapsedMs = tokens.callStartTime ? Date.now() - tokens.callStartTime : 0;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 48,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 48,
        overflowY: 'auto',
      }}
    >
      <div
        className="neuro-modal-enter neuro-grid-bg"
        style={{
          width: '100%',
          maxWidth: 1060,
          background: 'rgba(8,12,20,0.97)',
          border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isWorking ? '#3b82f6' : 'rgba(255,255,255,0.2)',
              display: 'inline-block',
              boxShadow: isWorking ? '0 0 8px #3b82f6' : 'none',
              transition: 'all 0.4s',
            }} />
            <span style={{
              fontFamily: FONT_FAMILY_MONO,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.9)',
            }}>
              NEURO Architecture
            </span>
            <span style={{
              fontFamily: FONT_FAMILY_MONO,
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.08em',
            }}>
              / pipeline
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            X
          </button>
        </div>

        {/* ── Pipeline visualization ── */}
        <div style={{ padding: '24px 20px' }}>
          {/* Desktop: horizontal row. Mobile: vertical stack */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            alignItems: 'stretch',
          }}>

            {/* ── Stage 1: Input ── */}
            <StageBox label="01 / Input" isActive={activeStage === 'input'}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                Input
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                Message + files + context
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 5,
                padding: '6px 8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <MonoVal dim>session calls</MonoVal>
                  <MonoVal>{tokens.callCount}</MonoVal>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <MonoVal dim>session total</MonoVal>
                  <MonoVal>{sessionTotal.toLocaleString()} tok</MonoVal>
                </div>
              </div>
            </StageBox>

            <Connector isActive={isWorking} />

            {/* ── Stage 2: Router ── */}
            <StageBox label="02 / Router" isActive={activeStage === 'router'}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                Router
              </div>
              <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: FONT_FAMILY_MONO, marginBottom: 4 }}>
                {routingDecision}
              </div>
              {/* 4 classifier steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {CLASSIFIERS.map((cls, i) => (
                  <div key={cls} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '4px 7px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: 9,
                      color: 'rgba(59,130,246,0.6)',
                      minWidth: 12,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{cls}</span>
                  </div>
                ))}
              </div>
            </StageBox>

            <Connector isActive={isWorking} />

            {/* ── Stage 3: Model ── */}
            <StageBox label="03 / Model" isActive={activeStage === 'model'}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                Model
              </div>
              {/* Active model name */}
              <div style={{
                fontFamily: FONT_FAMILY_MONO,
                fontSize: 12,
                color: isWorking ? '#60a5fa' : 'rgba(255,255,255,0.45)',
                fontWeight: 600,
                padding: '5px 8px',
                background: isWorking ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                borderRadius: 5,
                border: `1px solid ${isWorking ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.4s',
                wordBreak: 'break-all',
              }}>
                {modelName}
              </div>
              {/* Token counts */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <MonoVal dim>live tokens</MonoVal>
                  <MonoVal>{liveTokens > 0 ? liveTokens.toLocaleString() : '--'}</MonoVal>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <MonoVal dim>speed</MonoVal>
                  <MonoVal>{tps} t/s</MonoVal>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <MonoVal dim>thinking</MonoVal>
                  <MonoVal>{tokens.thinkingTokenCount > 0 ? `${tokens.thinkingTokenCount} tok` : '--'}</MonoVal>
                </div>
              </div>
              {/* State badges */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[
                  { key: 'loading', label: 'Loading', active: tokens.isModelLoading },
                  { key: 'thinking', label: 'Thinking', active: tokens.isThinking },
                  { key: 'generating', label: 'Generating', active: tokens.isGenerating },
                ].map(({ key, label, active }) => (
                  <span key={key} style={{
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#60a5fa' : 'rgba(255,255,255,0.2)',
                    border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.3s',
                  }}>
                    {label}
                  </span>
                ))}
              </div>
            </StageBox>

            <Connector isActive={isWorking} />

            {/* ── Stage 4: Tools ── */}
            <StageBox label="04 / Tools" isActive={activeStage === 'tools'}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                Tools
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                42 available
              </div>
              {/* Tool pill grid */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TOOLS.map(tool => {
                  const toolActive = isWorking && (
                    tokens.liveResponseSnippet.toLowerCase().includes(tool.id.replace('_', ''))
                    || tokens.liveThinkSnippet.toLowerCase().includes(tool.id.replace('_', ''))
                  );
                  return (
                    <div key={tool.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: toolActive ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${toolActive ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'all 0.3s',
                    }}>
                      {toolActive && <StatusDot active />}
                      <span style={{
                        fontSize: 10,
                        fontFamily: FONT_FAMILY_MONO,
                        color: toolActive ? '#93c5fd' : 'rgba(255,255,255,0.35)',
                        transition: 'color 0.3s',
                      }}>
                        {tool.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </StageBox>

            <Connector isActive={tokens.isGenerating} />

            {/* ── Stage 5: Output ── */}
            <StageBox label="05 / Output" isActive={activeStage === 'output'}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                Output
              </div>
              {/* Status row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 8px',
                background: tokens.isGenerating ? 'rgba(59,130,246,0.07)' : 'rgba(255,255,255,0.03)',
                borderRadius: 5,
                border: `1px solid ${tokens.isGenerating ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.4s',
              }}>
                <StatusDot active={tokens.isGenerating} />
                <span style={{
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: 11,
                  color: tokens.isGenerating ? '#93c5fd' : 'rgba(255,255,255,0.3)',
                }}>
                  {tokens.isGenerating ? 'Streaming' : 'Idle'}
                </span>
              </div>
              {/* Timing / counters */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <MonoVal dim>elapsed</MonoVal>
                  <MonoVal>{isWorking ? `${elapsedSec}s` : '--'}</MonoVal>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <MonoVal dim>response tok</MonoVal>
                  <MonoVal>{tokens.responseTokens > 0 ? tokens.responseTokens.toLocaleString() : '--'}</MonoVal>
                </div>
              </div>
              {/* Live snippet preview */}
              {tokens.liveResponseSnippet && (
                <div style={{
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  padding: '5px 8px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.05)',
                  maxHeight: 52,
                  overflow: 'hidden',
                  lineHeight: 1.5,
                  wordBreak: 'break-all',
                }}>
                  {tokens.liveResponseSnippet.slice(-140)}
                </div>
              )}
            </StageBox>
          </div>
        </div>

        {/* ── Footer: legend + status bar ── */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {[
              { color: '#3b82f6', label: 'Active' },
              { color: 'rgba(255,255,255,0.15)', label: 'Idle' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  display: 'inline-block',
                  width: 18,
                  height: 2,
                  background: color,
                  borderRadius: 1,
                }} />
                <span style={{
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.06em',
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Status indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontFamily: FONT_FAMILY_MONO,
              fontSize: 10,
              color: 'rgba(255,255,255,0.25)',
            }}>
              {isWorking
                ? `${modelName} · ${liveTokens} tok · ${tps} t/s`
                : 'System idle'}
            </span>
            <span style={{
              fontFamily: FONT_FAMILY_MONO,
              fontSize: 10,
              color: 'rgba(255,255,255,0.18)',
            }}>
              ESC to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
