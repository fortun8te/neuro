/**
 * SessionCheckpointUI — Checkpoint management and session resume UI
 *
 * Displays:
 * - Current session progress
 * - Available checkpoints with restore buttons
 * - Manual checkpoint creation
 * - Auto-save indicator
 */

import React, { useState, useEffect } from 'react';
import { useSessionState } from '../hooks/useSessionState';
import type { Checkpoint, SessionState } from '../utils/sessionCheckpoint';

interface SessionCheckpointUIProps {
  onResumeCheckpoint?: (checkpoint: Checkpoint) => void;
  showAutoBadge?: boolean;
}

export function SessionCheckpointUI({
  onResumeCheckpoint,
  showAutoBadge = true,
}: SessionCheckpointUIProps) {
  const {
    sessionId,
    session,
    checkpoints,
    latestCheckpoint,
    createCheckpoint,
    resumeFromCheckpoint,
    deleteCheckpoint,
    loading,
    error,
    checkpointSaved,
  } = useSessionState();

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);

  const handleResumeCheckpoint = async (checkpoint: Checkpoint) => {
    await resumeFromCheckpoint(checkpoint.id);
    setSelectedCheckpoint(checkpoint.id);
    onResumeCheckpoint?.(checkpoint);
  };

  const handleDeleteCheckpoint = async (checkpoint: Checkpoint) => {
    if (confirm(`Delete checkpoint "${checkpoint.label || checkpoint.id.slice(0, 8)}"?`)) {
      await deleteCheckpoint(checkpoint.id);
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="session-checkpoint-ui">
      {/* Header / Toggle */}
      <div className="checkpoint-header">
        <button
          className="checkpoint-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span className="checkpoint-icon">⏱️</span>
          <span className="checkpoint-label">Checkpoints</span>
          {checkpointSaved && showAutoBadge && (
            <span className="auto-save-badge" title="Checkpoint auto-saved">
              ✓ Saved
            </span>
          )}
          <span className={`chevron ${isExpanded ? 'open' : ''}`}>▼</span>
        </button>

        {session && (
          <div className="session-info">
            <span className="session-status" data-status={session.status}>
              {session.status === 'in-progress' && '● Running'}
              {session.status === 'completed' && '✓ Complete'}
              {session.status === 'paused' && '⏸ Paused'}
              {session.status === 'cancelled' && '✕ Cancelled'}
            </span>
            {session.elapsedMs && (
              <span className="session-time">
                {formatTime(session.elapsedMs)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="checkpoint-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="checkpoint-panel">
          {/* Session Info */}
          {session && (
            <div className="session-details">
              <div className="detail-row">
                <span className="detail-label">Session ID:</span>
                <code className="detail-value">{session.sessionId.slice(0, 12)}...</code>
              </div>
              {session.taskDescription && (
                <div className="detail-row">
                  <span className="detail-label">Task:</span>
                  <span className="detail-value">{session.taskDescription}</span>
                </div>
              )}
              {session.model && (
                <div className="detail-row">
                  <span className="detail-label">Model:</span>
                  <span className="detail-value">{session.model}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Started:</span>
                <span className="detail-value">{formatDate(session.startTime)}</span>
              </div>
              {session.resumedAt && (
                <div className="detail-row highlight">
                  <span className="detail-label">Resumed:</span>
                  <span className="detail-value">{formatDate(session.resumedAt)}</span>
                </div>
              )}
            </div>
          )}

          {/* Checkpoints List */}
          <div className="checkpoints-list">
            <div className="list-header">
              <h4>Checkpoints</h4>
              <span className="count">{checkpoints.length}</span>
            </div>

            {checkpoints.length === 0 ? (
              <div className="empty-state">
                No checkpoints yet. They will be created automatically.
              </div>
            ) : (
              <div className="checkpoints-scroll">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className={`checkpoint-item ${selectedCheckpoint === cp.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCheckpoint(cp.id)}
                  >
                    <div className="checkpoint-main">
                      <div className="checkpoint-title">
                        {cp.label && (
                          <>
                            <span className="cp-label">{cp.label}</span>
                            <span className="cp-meta">Step {cp.stepNumber}</span>
                          </>
                        )}
                        {!cp.label && (
                          <span className="cp-label">Step {cp.stepNumber}</span>
                        )}
                      </div>
                      <div className="checkpoint-meta">
                        <span className="cp-time">{formatDate(cp.timestamp)}</span>
                        {cp.progress && (
                          <span className="cp-progress">
                            {cp.progress.completed}/{cp.progress.total}
                            {' '}
                            ({cp.progress.percentComplete}%)
                          </span>
                        )}
                        {cp.estimatedTimeRemaining && (
                          <span className="cp-eta">
                            ETA: {formatTime(cp.estimatedTimeRemaining * 60 * 1000)}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {cp.progress && (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${cp.progress.percentComplete}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="checkpoint-actions">
                      <button
                        className="btn-resume"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResumeCheckpoint(cp);
                        }}
                        disabled={loading}
                        title="Resume from this checkpoint"
                      >
                        Resume
                      </button>
                      <button
                        className="btn-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCheckpoint(cp);
                        }}
                        disabled={loading}
                        title="Delete this checkpoint"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest checkpoint info */}
          {latestCheckpoint && (
            <div className="latest-checkpoint">
              <div className="lc-header">Latest Checkpoint</div>
              <div className="lc-content">
                <div className="lc-row">
                  <span>Step {latestCheckpoint.stepNumber}</span>
                  <span className="lc-time">
                    {formatDate(latestCheckpoint.timestamp)}
                  </span>
                </div>
                {latestCheckpoint.progress && (
                  <div className="lc-progress">
                    <div className="progress-text">
                      {latestCheckpoint.progress.completed} / {latestCheckpoint.progress.total}
                      {' '}
                      steps
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${latestCheckpoint.progress.percentComplete}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="loading-indicator">
              <span className="spinner" />
              Saving checkpoint...
            </div>
          )}
        </div>
      )}

      {/* Styles */}
      <style>{`
        .session-checkpoint-ui {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #fafafa;
          overflow: hidden;
        }

        .checkpoint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .checkpoint-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-weight: 500;
          color: #333;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .checkpoint-toggle:hover {
          background: #f0f0f0;
        }

        .checkpoint-icon {
          font-size: 16px;
        }

        .checkpoint-label {
          font-size: 14px;
        }

        .auto-save-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .chevron {
          transition: transform 0.2s;
          font-size: 12px;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .session-info {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 13px;
        }

        .session-status {
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .session-status[data-status="in-progress"] {
          color: #1976d2;
          background: #e3f2fd;
        }

        .session-status[data-status="completed"] {
          color: #388e3c;
          background: #e8f5e9;
        }

        .session-status[data-status="paused"] {
          color: #f57c00;
          background: #fff3e0;
        }

        .session-time {
          font-family: monospace;
          color: #666;
        }

        .checkpoint-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #ffebee;
          color: #c62828;
          font-size: 13px;
        }

        .error-icon {
          font-size: 16px;
        }

        .checkpoint-panel {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 600px;
          overflow-y: auto;
        }

        .session-details {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
          font-size: 13px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row.highlight {
          background: #e8f5e9;
          padding: 6px 8px;
          margin: 0 -12px;
          padding-left: 12px;
          padding-right: 12px;
        }

        .detail-label {
          font-weight: 500;
          color: #666;
        }

        .detail-value {
          color: #333;
          word-break: break-all;
        }

        .checkpoints-list {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          overflow: hidden;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f5f5f5;
          border-bottom: 1px solid #e0e0e0;
        }

        .list-header h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .count {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          background: #e0e0e0;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #666;
        }

        .empty-state {
          padding: 24px 16px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .checkpoints-scroll {
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .checkpoint-item {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          transition: background 0.2s;
        }

        .checkpoint-item:last-child {
          border-bottom: none;
        }

        .checkpoint-item:hover {
          background: #f9f9f9;
        }

        .checkpoint-item.selected {
          background: #e3f2fd;
          border-left: 3px solid #1976d2;
        }

        .checkpoint-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .checkpoint-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .cp-label {
          color: #333;
        }

        .cp-meta {
          color: #999;
          font-weight: normal;
          font-size: 12px;
        }

        .checkpoint-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #666;
        }

        .cp-time {
          font-family: monospace;
        }

        .cp-progress {
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .cp-eta {
          background: #fff3e0;
          padding: 2px 6px;
          border-radius: 3px;
          color: #f57c00;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #1976d2;
          transition: width 0.3s ease;
        }

        .checkpoint-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn-resume,
        .btn-delete {
          padding: 6px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-resume:hover:not(:disabled) {
          background: #1976d2;
          color: white;
          border-color: #1976d2;
        }

        .btn-delete:hover:not(:disabled) {
          background: #f44336;
          color: white;
          border-color: #f44336;
        }

        .btn-resume:disabled,
        .btn-delete:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .latest-checkpoint {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
          font-size: 13px;
        }

        .lc-header {
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }

        .lc-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lc-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .lc-time {
          color: #666;
          font-family: monospace;
          font-size: 12px;
        }

        .lc-progress {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-text {
          font-size: 12px;
          color: #666;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 13px;
          color: #666;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #e0e0e0;
          border-top-color: #1976d2;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
