/**
 * CostDisplay — Shows token usage and cost in the agent panel
 *
 * Features:
 * - Live cost counter (top-right)
 * - Per-message cost breakdown
 * - Cost indicator (green/yellow/red)
 * - Soft limit warning modal
 * - Hard limit error notification
 */

import React, { useState, useEffect } from 'react';
import { costTracker, type CostEvent, type CostUsage } from '../utils/costTracker';

interface CostDisplayProps {
  showBreakdown?: boolean;
  compact?: boolean;
  position?: 'top-right' | 'inline' | 'modal';
}

interface CostState {
  usage: CostUsage;
  percentage: number;
  status: 'normal' | 'warning' | 'critical';
  remainingTokens: number;
}

export function CostDisplay({
  showBreakdown = true,
  compact = false,
  position = 'top-right',
}: CostDisplayProps) {
  const [cost, setCost] = useState<CostState>(() => {
    const usage = costTracker.getUsage();
    return {
      usage,
      percentage: costTracker.getUsagePercentage(),
      status: getStatus(costTracker.getUsagePercentage()),
      remainingTokens: costTracker.getRemainingTokens(),
    };
  });

  const [showSoftLimitWarning, setShowSoftLimitWarning] = useState(false);
  const [showHardLimitError, setShowHardLimitError] = useState(false);

  useEffect(() => {
    const unsubscribe = costTracker.subscribe((event: CostEvent) => {
      const newUsage = costTracker.getUsage();
      setCost({
        usage: newUsage,
        percentage: costTracker.getUsagePercentage(),
        status: getStatus(costTracker.getUsagePercentage()),
        remainingTokens: costTracker.getRemainingTokens(),
      });

      if (event.type === 'soft_limit_exceeded') {
        setShowSoftLimitWarning(true);
      } else if (event.type === 'hard_limit_exceeded') {
        setShowHardLimitError(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const formatCost = (dollars: number) => {
    if (dollars < 0.01) return '$0.00';
    return `$${dollars.toFixed(4)}`;
  };

  const colors = {
    normal: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', border: '#22c55e' },
    warning: { bg: 'rgba(234, 179, 8, 0.1)', text: '#eab308', border: '#eab308' },
    critical: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: '#ef4444' },
  };

  const c = colors[cost.status];

  if (position === 'top-right') {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            padding: '12px 16px',
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: '8px',
            color: c.text,
            fontSize: '13px',
            fontFamily: 'system-ui, sans-serif',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: c.text,
              }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>
                {cost.usage.totalTokens.toLocaleString()} tokens
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {formatCost(cost.usage.totalCost)} · {cost.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {showSoftLimitWarning && (
          <SoftLimitWarningModal
            onClose={() => setShowSoftLimitWarning(false)}
            cost={cost}
          />
        )}

        {showHardLimitError && (
          <HardLimitErrorModal
            onClose={() => setShowHardLimitError(false)}
          />
        )}
      </>
    );
  }

  if (position === 'modal') {
    return (
      <div
        style={{
          padding: '16px',
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: '12px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', color: c.text, fontSize: '14px' }}>
          Cost & Budget
        </h3>
        <CostBreakdown cost={cost} />
      </div>
    );
  }

  // inline
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: c.text,
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: c.text,
          }}
        />
        {cost.usage.totalTokens.toLocaleString()} tokens
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)' }}>·</div>
      <div style={{ color: c.text }}>
        {formatCost(cost.usage.totalCost)}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)' }}>·</div>
      <div style={{ color: c.text }}>
        {cost.percentage.toFixed(1)}%
      </div>
    </div>
  );
}

function CostBreakdown({ cost }: { cost: CostState }) {
  const byModel = costTracker.getCostByModel();
  const byTool = costTracker.getCostByTool();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Progress Bar */}
      <div>
        <div
          style={{
            width: '100%',
            height: '6px',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(cost.percentage, 100)}%`,
              height: '100%',
              background: cost.status === 'normal' ? '#22c55e' : cost.status === 'warning' ? '#eab308' : '#ef4444',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <span>{cost.usage.totalTokens.toLocaleString()} / {cost.usage.byModel && Object.values(cost.usage.byModel).length > 0 ? Object.values(cost.usage.byModel).reduce((a, b) => a + b.tokens, 0) : 0} tokens</span>
          <span>{cost.percentage.toFixed(1)}%</span>
        </div>
      </div>

      {/* By Model */}
      {Object.keys(byModel).length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px', opacity: 0.7 }}>
            By Model
          </div>
          {Object.entries(byModel).map(([model, data]) => (
            <div
              key={model}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                padding: '4px 0',
              }}
            >
              <span style={{ opacity: 0.7 }}>{model}</span>
              <span>
                {data.tokens.toLocaleString()}t · ${data.cost.toFixed(4)} ({data.percentage.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* By Tool */}
      {Object.keys(byTool).length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px', opacity: 0.7 }}>
            By Tool
          </div>
          {Object.entries(byTool).map(([tool, data]) => (
            <div
              key={tool}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                padding: '4px 0',
              }}
            >
              <span style={{ opacity: 0.7 }}>{tool}</span>
              <span>
                {data.tokens.toLocaleString()}t · ${data.cost.toFixed(4)} ({data.percentage.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SoftLimitWarningModal({
  onClose,
  cost,
}: {
  onClose: () => void;
  cost: CostState;
}) {
  const config = costTracker.getConfig();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          color: '#000',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>
          Soft Budget Limit Reached
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
          You have used {cost.usage.totalTokens.toLocaleString()} of{' '}
          {config.softLimitTokens.toLocaleString()} tokens (soft limit).
        </p>
        <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
          Hard limit is {config.hardLimitTokens.toLocaleString()} tokens.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#eab308',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
          <button
            onClick={() => {
              costTracker.resetUsage();
              onClose();
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#e5e7eb',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function HardLimitErrorModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          color: '#000',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ef4444' }}>
          Hard Budget Limit Exceeded
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
          Your token budget has been exhausted. No more tools can be executed until you reset your budget.
        </p>
        <button
          onClick={() => {
            costTracker.resetUsage();
            onClose();
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Reset Budget
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function getStatus(percentage: number): 'normal' | 'warning' | 'critical' {
  if (percentage >= 100) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'normal';
}
