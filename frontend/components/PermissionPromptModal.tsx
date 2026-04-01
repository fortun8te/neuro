/**
 * PermissionPromptModal — User confirmation for tool execution
 *
 * Displays when the harness system requires user approval for a tool execution.
 * Shows permission prompt, risk level indicator, and approve/deny buttons.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

interface PermissionPromptModalProps {
  isOpen: boolean;
  prompt: string;
  riskLevel?: 'low' | 'medium' | 'high';
  onApprove: () => void;
  onDeny: () => void;
}

/**
 * Get color classes for risk level
 */
function getRiskLevelStyles(riskLevel?: 'low' | 'medium' | 'high') {
  switch (riskLevel) {
    case 'high':
      return {
        badge: 'bg-red-900/30 text-red-300 border-red-700/50',
        icon: 'text-red-400',
        accent: 'border-red-700/30',
      };
    case 'medium':
      return {
        badge: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
        icon: 'text-amber-400',
        accent: 'border-amber-700/30',
      };
    case 'low':
    default:
      return {
        badge: 'bg-blue-900/30 text-blue-300 border-blue-700/50',
        icon: 'text-blue-400',
        accent: 'border-blue-700/30',
      };
  }
}

function getRiskLevelLabel(riskLevel?: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'high':
      return 'High Risk';
    case 'medium':
      return 'Medium Risk';
    case 'low':
    default:
      return 'Low Risk';
  }
}

/**
 * Risk indicator icon
 */
function RiskIcon({ riskLevel }: { riskLevel?: 'low' | 'medium' | 'high' }) {
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

export function PermissionPromptModal({
  isOpen,
  prompt,
  riskLevel,
  onApprove,
  onDeny,
}: PermissionPromptModalProps) {
  const { isDarkMode } = useTheme();
  const styles = getRiskLevelStyles(riskLevel);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDeny}
            className={`absolute inset-0 ${isDarkMode ? 'bg-black/60 backdrop-blur-sm' : 'bg-white/40 backdrop-blur-sm'}`}
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
            } shadow-2xl`}
          >
            {/* Header with risk indicator */}
            <div className={`px-6 pt-6 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <RiskIcon riskLevel={riskLevel} />
                <div className="flex-1">
                  <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Permission Required
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${styles.badge}`}>
                      {getRiskLevelLabel(riskLevel)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                {prompt}
              </p>
            </div>

            {/* Footer with buttons */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} flex gap-3 justify-end`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onDeny}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900'
                }`}
              >
                Deny
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onApprove}
                className="px-4 py-2 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Approve
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
