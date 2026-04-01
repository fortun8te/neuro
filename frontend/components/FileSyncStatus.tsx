/**
 * File Sync Status — UI component showing sync progress and conflicts
 *
 * Displays:
 * - Current sync status (idle, syncing, conflicts)
 * - Last sync time
 * - Quota usage indicator
 * - Conflict resolution UI
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { type SyncStatus, type SyncConflict } from '../utils/cloudSyncManager';

interface FileSyncStatusProps {
  syncStatus: SyncStatus;
  onResolveConflict?: (conflict: SyncConflict, resolution: 'useCloud' | 'useLocal' | 'merge') => Promise<void>;
  onManualSync?: () => Promise<void>;
}

export function FileSyncStatus({ syncStatus, onResolveConflict, onManualSync }: FileSyncStatusProps) {
  const { isDarkMode } = useTheme();
  const [expandedConflictId, setExpandedConflictId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const hasConflicts = syncStatus.conflicts.length > 0;
  const lastSyncTime = syncStatus.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleTimeString()
    : 'Never';

  const handleResolve = async (conflict: SyncConflict, resolution: 'useCloud' | 'useLocal' | 'merge') => {
    setIsResolving(true);
    try {
      await onResolveConflict?.(conflict, resolution);
      setExpandedConflictId(null);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Sync Status Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {syncStatus.isSyncing ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
              <Cloud size={16} color="#3b82f6" />
            </motion.div>
          ) : hasConflicts ? (
            <AlertTriangle size={16} color="#f97316" />
          ) : (
            <CheckCircle size={16} color="#10b981" />
          )}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? '#ffffff' : '#000000' }}>
              {syncStatus.isSyncing ? 'Syncing...' : hasConflicts ? 'Conflicts detected' : 'In sync'}
            </div>
            <div style={{ fontSize: '10px', color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
              Last sync: {lastSyncTime}
            </div>
          </div>
        </div>

        <button
          onClick={() => onManualSync?.()}
          disabled={syncStatus.isSyncing}
          style={{
            background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: syncStatus.isSyncing ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            opacity: syncStatus.isSyncing ? 0.5 : 1,
          }}
        >
          Sync now
        </button>
      </div>

      {/* Sync Progress */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '4px' }}>
          Synced: {syncStatus.syncedCount} / {syncStatus.totalCount}
        </div>
        <div
          style={{
            background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            height: '4px',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <motion.div
            style={{
              background: '#3b82f6',
              height: '100%',
              width: `${(syncStatus.syncedCount / Math.max(syncStatus.totalCount, 1)) * 100}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Error Message */}
      {syncStatus.errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '12px',
            fontSize: '11px',
            color: '#ef4444',
          }}
        >
          {syncStatus.errorMessage}
        </div>
      )}

      {/* Conflicts */}
      <AnimatePresence>
        {syncStatus.conflicts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: '#f97316' }}>
              {syncStatus.conflicts.length} conflict{syncStatus.conflicts.length === 1 ? '' : 's'}
            </div>

            {syncStatus.conflicts.map((conflict) => (
              <motion.div
                key={conflict.docId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  background: isDarkMode ? 'rgba(249, 115, 22, 0.05)' : 'rgba(249, 115, 22, 0.1)',
                  border: `1px solid ${isDarkMode ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.3)'}`,
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '6px',
                }}
              >
                <div
                  onClick={() =>
                    setExpandedConflictId(expandedConflictId === conflict.docId ? null : conflict.docId)
                  }
                  style={{ cursor: 'pointer', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}
                >
                  {conflict.title}
                </div>

                <AnimatePresence>
                  {expandedConflictId === conflict.docId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        fontSize: '10px',
                        color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        marginBottom: '8px',
                      }}
                    >
                      <div>Cloud updated: {new Date(conflict.cloudUpdatedAt).toLocaleString()}</div>
                      <div>Local updated: {new Date(conflict.localUpdatedAt).toLocaleString()}</div>

                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          onClick={() => handleResolve(conflict, 'useCloud')}
                          disabled={isResolving}
                          style={{
                            flex: 1,
                            background: '#3b82f6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            cursor: isResolving ? 'not-allowed' : 'pointer',
                            opacity: isResolving ? 0.5 : 1,
                          }}
                        >
                          Use Cloud
                        </button>
                        <button
                          onClick={() => handleResolve(conflict, 'useLocal')}
                          disabled={isResolving}
                          style={{
                            flex: 1,
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            cursor: isResolving ? 'not-allowed' : 'pointer',
                            opacity: isResolving ? 0.5 : 1,
                          }}
                        >
                          Use Local
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
