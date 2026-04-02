/**
 * ExecutionPlanModal — Shows planned tool execution before running
 *
 * Used in 'plan' mode to display what tools will be executed, in what order,
 * and estimated execution time/cost. User can approve, request changes, or abort.
 */

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';

export interface ExecutionPlanItem {
  id: string;
  name: string;
  description?: string;
  type: 'read' | 'write' | 'destructive' | 'other';
  estimatedDurationMs?: number;
  children?: ExecutionPlanItem[];
}

interface ExecutionPlanModalProps {
  isOpen: boolean;
  plan: ExecutionPlanItem[];
  estimatedTotalDurationMs?: number;
  onApprove: () => void;
  onRequestChanges: (instructions: string) => void;
  onAbort: () => void;
}

const getTypeColor = (type: 'read' | 'write' | 'destructive' | 'other', isDarkMode: boolean): { bg: string; border: string; text: string } => {
  switch (type) {
    case 'read':
      return isDarkMode
        ? { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: 'rgba(59,130,246,0.8)' }
        : { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)', text: 'rgba(29,78,216,0.8)' };
    case 'write':
      return isDarkMode
        ? { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: 'rgba(245,158,11,0.8)' }
        : { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', text: 'rgba(180,83,9,0.8)' };
    case 'destructive':
      return isDarkMode
        ? { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: 'rgba(239,68,68,0.8)' }
        : { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', text: 'rgba(159,18,57,0.8)' };
    default:
      return isDarkMode
        ? { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', text: 'rgba(100,116,139,0.8)' }
        : { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.15)', text: 'rgba(30,41,59,0.8)' };
  }
};

const formatDuration = (ms?: number): string => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

function PlanTreeNode({ item, level = 0, isDarkMode }: { item: ExecutionPlanItem; level?: number; isDarkMode: boolean }) {
  const color = getTypeColor(item.type, isDarkMode);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div key={item.id}>
      <div
        className="flex items-start gap-3 px-3 py-2.5 rounded-lg mb-1"
        style={{
          marginLeft: `${level * 16}px`,
          background: color.bg,
          border: `1px solid ${color.border}`,
          fontFamily: FONT_FAMILY,
        }}
      >
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 mt-0.5"
          style={{
            background: color.border,
            color: color.text,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            minWidth: 'max-content',
          }}
        >
          {item.type === 'read' ? 'Read' : item.type === 'write' ? 'Write' : item.type === 'destructive' ? 'Delete' : 'Other'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold" style={{ color: color.text }}>
            {item.name}
          </div>
          {item.description && (
            <div
              className="text-[10px] mt-0.5 leading-relaxed"
              style={{
                color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              }}
            >
              {item.description}
            </div>
          )}
        </div>
        {item.estimatedDurationMs && (
          <div
            className="text-[10px] tabular-nums whitespace-nowrap"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
          >
            {formatDuration(item.estimatedDurationMs)}
          </div>
        )}
      </div>
      {hasChildren && item.children?.map(child => <PlanTreeNode key={child.id} item={child} level={level + 1} isDarkMode={isDarkMode} />)}
    </div>
  );
}

export function ExecutionPlanModal({
  isOpen,
  plan,
  estimatedTotalDurationMs,
  onApprove,
  onRequestChanges,
  onAbort,
}: ExecutionPlanModalProps) {
  const { isDarkMode } = useTheme();
  const [showChangesInput, setShowChangesInput] = useState(false);
  const [changesText, setChangesText] = useState('');

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onAbort();
    }
  };

  if (!isOpen) return null;

  const readCount = plan.filter(p => p.type === 'read').length;
  const writeCount = plan.filter(p => p.type === 'write').length;
  const destructiveCount = plan.filter(p => p.type === 'destructive').length;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onAbort();
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="execution-plan-title"
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        style={{
          background: isDarkMode ? 'rgba(20,20,28,0.95)' : 'rgba(255,255,255,0.95)',
          border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <h2
            id="execution-plan-title"
            className="text-[16px] font-bold mb-1"
            style={{
              color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
              fontFamily: FONT_FAMILY,
            }}
          >
            Execution Plan
          </h2>
          <p
            className="text-[12px]"
            style={{
              color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
              fontFamily: FONT_FAMILY,
            }}
            role="status"
          >
            {plan.length} tool{plan.length !== 1 ? 's' : ''} will be executed in sequence
          </p>
        </div>

        {/* Summary stats */}
        <div className="px-6 py-3 border-b" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
          <div className="flex flex-wrap gap-4">
            {readCount > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                    color: isDarkMode ? 'rgba(59,130,246,0.8)' : 'rgba(29,78,216,0.8)',
                    fontWeight: 600,
                  }}
                >
                  Read: {readCount}
                </span>
              </div>
            )}
            {writeCount > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: isDarkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
                    color: isDarkMode ? 'rgba(245,158,11,0.8)' : 'rgba(180,83,9,0.8)',
                    fontWeight: 600,
                  }}
                >
                  Write: {writeCount}
                </span>
              </div>
            )}
            {destructiveCount > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                    color: isDarkMode ? 'rgba(239,68,68,0.8)' : 'rgba(159,18,57,0.8)',
                    fontWeight: 600,
                  }}
                >
                  Delete: {destructiveCount}
                </span>
              </div>
            )}
            {estimatedTotalDurationMs && (
              <div className="flex items-center gap-2 ml-auto">
                <span
                  className="text-[10px]"
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  Est. {formatDuration(estimatedTotalDurationMs)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Plan tree (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {plan.length === 0 ? (
            <p style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 12 }}>
              No tools planned
            </p>
          ) : (
            plan.map(item => <PlanTreeNode key={item.id} item={item} isDarkMode={isDarkMode} />)
          )}
        </div>

        {/* Changes input */}
        {showChangesInput && (
          <div
            className="px-6 py-3 border-t"
            style={{
              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <label
              className="text-[12px] font-medium block mb-2"
              style={{
                color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                fontFamily: FONT_FAMILY,
              }}
            >
              What changes would you like?
            </label>
            <textarea
              value={changesText}
              onChange={e => setChangesText(e.target.value)}
              placeholder="e.g., skip the file_write step, use a different API..."
              className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none"
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                fontFamily: FONT_FAMILY,
              }}
              rows={3}
            />
          </div>
        )}

        {/* Buttons */}
        <div
          className="px-6 py-4 border-t flex gap-3 items-center justify-between"
          style={{
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          {showChangesInput ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={() => {
                  if (changesText.trim()) {
                    onRequestChanges(changesText.trim());
                    setChangesText('');
                    setShowChangesInput(false);
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={{
                  background: 'rgba(59,130,246,0.8)',
                  color: '#fff',
                  border: 'none',
                  cursor: changesText.trim() ? 'pointer' : 'default',
                  opacity: changesText.trim() ? 1 : 0.5,
                }}
                aria-label="Submit requested changes"
              >
                Submit Changes
              </button>
              <button
                onClick={() => setShowChangesInput(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                  border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                }}
                aria-label="Cancel requesting changes"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onAbort}
                className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                  border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                }}
                aria-label="Abort execution plan"
              >
                Abort
              </button>
              <button
                onClick={() => setShowChangesInput(true)}
                className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                  border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                }}
                aria-label="Request changes to execution plan"
              >
                Request Changes
              </button>
              <button
                onClick={onApprove}
                className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={{
                  background: 'rgba(34,197,94,0.8)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="Approve execution plan"
              >
                Approve Plan
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
