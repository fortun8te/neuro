/**
 * ApprovalModal — User confirmation for expensive operations
 *
 * Shows:
 * - Operation name (stage)
 * - Token count & estimated cost
 * - Options: [Cancel] [Approve] [Always Approve]
 * - Risk level indicator
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import type { StageName } from '../types';

interface ApprovalModalProps {
  isOpen: boolean;
  stage: StageName;
  estimatedTokens: number;
  estimatedCost: number; // USD
  modelName?: string;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysApprove: () => void;
}

/**
 * Determine risk level based on tokens
 */
function getRiskLevel(tokens: number): 'low' | 'medium' | 'high' {
  if (tokens > 20_000) return 'high';
  if (tokens > 10_000) return 'medium';
  return 'low';
}

function getRiskLevelStyles(riskLevel: 'low' | 'medium' | 'high') {
  switch (riskLevel) {
    case 'high':
      return {
        badge: 'bg-red-900/30 text-red-300 border-red-700/50',
        icon: 'text-red-400',
        accent: 'border-red-700/30',
        button: 'bg-red-600 hover:bg-red-500',
      };
    case 'medium':
      return {
        badge: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
        icon: 'text-amber-400',
        accent: 'border-amber-700/30',
        button: 'bg-amber-600 hover:bg-amber-500',
      };
    case 'low':
    default:
      return {
        badge: 'bg-blue-900/30 text-blue-300 border-blue-700/50',
        icon: 'text-blue-400',
        accent: 'border-blue-700/30',
        button: 'bg-blue-600 hover:bg-blue-500',
      };
  }
}

function getRiskLevelLabel(riskLevel: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'high':
      return 'High Cost';
    case 'medium':
      return 'Medium Cost';
    case 'low':
    default:
      return 'Low Cost';
  }
}

/**
 * Risk indicator icon
 */
function RiskIcon({ riskLevel }: { riskLevel: 'low' | 'medium' | 'high' }) {
  const styles = getRiskLevelStyles(riskLevel);

  if (riskLevel === 'high') {
    return (
      <svg className={`w-5 h-5 ${styles.icon}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }

  if (riskLevel === 'medium') {
    return (
      <svg className={`w-5 h-5 ${styles.icon}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    );
  }

  return (
    <svg className={`w-5 h-5 ${styles.icon}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Format stage name for display (brand-dna → Brand DNA)
 */
function formatStageName(stage: StageName): string {
  return stage
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ApprovalModal({
  isOpen,
  stage,
  estimatedTokens,
  estimatedCost,
  modelName,
  onApprove,
  onDeny,
  onAlwaysApprove,
}: ApprovalModalProps) {
  const { isDarkMode } = useTheme();
  const [showAlwaysApprove, setShowAlwaysApprove] = useState(false);

  const riskLevel = getRiskLevel(estimatedTokens);
  const styles = getRiskLevelStyles(riskLevel);

  const handleAlwaysApprove = () => {
    onAlwaysApprove();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onDeny();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDeny}
            className={`absolute inset-0 ${isDarkMode ? 'bg-black/60 backdrop-blur-sm' : 'bg-white/40 backdrop-blur-sm'}`}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`relative z-50 w-full max-w-md mx-4 rounded-2xl border ${
              isDarkMode
                ? `bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 ${styles.accent}`
                : `bg-gradient-to-b from-white to-slate-50 border-slate-200 ${styles.accent}`
            } shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}
            tabIndex={-1}
          >
            {/* Header with risk indicator */}
            <div className={`px-6 pt-6 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <RiskIcon riskLevel={riskLevel} />
                <div className="flex-1">
                  <h2
                    id="approval-modal-title"
                    className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                  >
                    Approve Operation?
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${styles.badge}`}
                      role="status"
                      aria-label={`Risk level: ${getRiskLevelLabel(riskLevel)}`}
                    >
                      {getRiskLevelLabel(riskLevel)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Operation */}
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Stage
                </p>
                <p className={`text-base font-semibold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {formatStageName(stage)}
                </p>
              </div>

              {/* Token count & cost */}
              <div className="grid grid-cols-2 gap-4 py-3 px-3 rounded-lg" style={{
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.8)',
              }}>
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Tokens
                  </p>
                  <p className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {estimatedTokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Est. Cost
                  </p>
                  <p className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    ${estimatedCost.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Model info */}
              {modelName && (
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Model: <span className="font-mono">{modelName}</span>
                </div>
              )}

              {/* Always approve checkbox */}
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-1 ${
                isDarkMode
                  ? 'hover:bg-slate-800/50 focus-within:ring-offset-slate-950'
                  : 'hover:bg-slate-100 focus-within:ring-offset-white'
              }`}>
                <input
                  type="checkbox"
                  checked={showAlwaysApprove}
                  onChange={(e) => setShowAlwaysApprove(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-400 cursor-pointer accent-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                  aria-label="Always approve this stage in future"
                />
                <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Always approve {formatStageName(stage)}
                </span>
              </label>
            </div>

            {/* Footer with buttons */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} flex gap-3 justify-end`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onDeny}
                className={`px-4 py-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white focus-visible:outline-slate-400'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 focus-visible:outline-slate-400'
                }`}
                aria-label="Deny this operation"
              >
                Deny
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (showAlwaysApprove) {
                    handleAlwaysApprove();
                  } else {
                    onApprove();
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offset-white ${styles.button}`}
                aria-label={showAlwaysApprove ? 'Always approve this stage' : 'Approve this operation'}
              >
                {showAlwaysApprove ? 'Always Approve' : 'Approve'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
