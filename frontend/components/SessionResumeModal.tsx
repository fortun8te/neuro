/**
 * SessionResumeModal — Prompt user to resume from a checkpoint
 *
 * Shows when:
 * - Returning to a campaign with incomplete sessions
 * - Session has saved checkpoints
 * - Allows user to: resume from checkpoint, start fresh, or cancel
 */

import React, { useState } from 'react';
import type { SessionState, Checkpoint } from '../utils/sessionCheckpoint';

interface SessionResumeModalProps {
  session: SessionState;
  checkpoints: Checkpoint[];
  onResume: (checkpointId: string) => void;
  onStartFresh: () => void;
  onCancel: () => void;
}

export function SessionResumeModal({
  session,
  checkpoints,
  onResume,
  onStartFresh,
  onCancel,
}: SessionResumeModalProps) {
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(
    checkpoints[checkpoints.length - 1]?.id ?? null
  );

  const selectedCheckpoint = selectedCheckpointId
    ? checkpoints.find((cp) => cp.id === selectedCheckpointId)
    : null;

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
    const now = new Date();

    // If same day, show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Otherwise show date and time
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="session-resume-modal-overlay">
      <div className="session-resume-modal">
        {/* Header */}
        <div className="srm-header">
          <h2>Resume Session?</h2>
          <p className="srm-subtitle">
            You have an incomplete session with saved checkpoints
          </p>
        </div>

        {/* Session Info */}
        <div className="srm-session-info">
          <div className="ssi-row">
            <span className="ssi-label">Task:</span>
            <span className="ssi-value">{session.taskDescription || 'Unnamed'}</span>
          </div>
          <div className="ssi-row">
            <span className="ssi-label">Started:</span>
            <span className="ssi-value">{formatDate(session.startTime)}</span>
          </div>
          {session.elapsedMs && (
            <div className="ssi-row">
              <span className="ssi-label">Time Invested:</span>
              <span className="ssi-value">{formatTime(session.elapsedMs)}</span>
            </div>
          )}
          <div className="ssi-row">
            <span className="ssi-label">Checkpoints Saved:</span>
            <span className="ssi-value">{checkpoints.length}</span>
          </div>
        </div>

        {/* Checkpoint Selection */}
        <div className="srm-checkpoints">
          <h3>Select Checkpoint to Resume From</h3>
          <div className="checkpoint-options">
            {checkpoints.map((checkpoint) => (
              <label key={checkpoint.id} className="checkpoint-option">
                <input
                  type="radio"
                  name="checkpoint"
                  value={checkpoint.id}
                  checked={selectedCheckpointId === checkpoint.id}
                  onChange={(e) => setSelectedCheckpointId(e.target.value)}
                />
                <span className="option-content">
                  <span className="option-step">
                    Step {checkpoint.stepNumber}
                    {checkpoint.label && ` — ${checkpoint.label}`}
                  </span>
                  <span className="option-meta">
                    {formatDate(checkpoint.timestamp)}
                    {checkpoint.progress && (
                      <>
                        {' '}
                        · {checkpoint.progress.completed}/{checkpoint.progress.total}
                        {' '}
                        ({checkpoint.progress.percentComplete}%)
                      </>
                    )}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview of selected checkpoint */}
        {selectedCheckpoint && (
          <div className="srm-preview">
            <h4>Preview</h4>
            <div className="preview-content">
              <div className="preview-row">
                <span className="preview-label">Progress:</span>
                <span className="preview-value">
                  {selectedCheckpoint.progress?.completed || 0} / {selectedCheckpoint.progress?.total || '?'}
                  {' '}
                  steps
                </span>
              </div>
              {selectedCheckpoint.progress && (
                <div className="preview-progress-bar">
                  <div
                    className="preview-progress-fill"
                    style={{ width: `${selectedCheckpoint.progress.percentComplete}%` }}
                  />
                </div>
              )}
              {selectedCheckpoint.estimatedTimeRemaining && (
                <div className="preview-row">
                  <span className="preview-label">Est. Time Remaining:</span>
                  <span className="preview-value">
                    {formatTime(selectedCheckpoint.estimatedTimeRemaining * 60 * 1000)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="srm-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (selectedCheckpointId) {
                onResume(selectedCheckpointId);
              }
            }}
            disabled={!selectedCheckpointId}
          >
            <span className="btn-icon">▶</span>
            Resume from Checkpoint
          </button>
          <button className="btn btn-secondary" onClick={onStartFresh}>
            <span className="btn-icon">✨</span>
            Start Fresh
          </button>
          <button className="btn btn-tertiary" onClick={onCancel}>
            <span className="btn-icon">✕</span>
            Cancel
          </button>
        </div>

        {/* Styles */}
        <style>{`
          .session-resume-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 16px;
          }

          .session-resume-modal {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            padding: 0;
            display: flex;
            flex-direction: column;
          }

          .srm-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e0e0e0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .srm-header h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 600;
          }

          .srm-subtitle {
            margin: 0;
            font-size: 13px;
            opacity: 0.9;
          }

          .srm-session-info {
            padding: 16px 24px;
            background: #f9f9f9;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
          }

          .ssi-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
          }

          .ssi-row:not(:last-child) {
            border-bottom: 1px solid #f0f0f0;
          }

          .ssi-label {
            font-weight: 500;
            color: #666;
          }

          .ssi-value {
            color: #333;
            word-break: break-all;
          }

          .srm-checkpoints {
            padding: 16px 24px;
            flex: 1;
            overflow-y: auto;
          }

          .srm-checkpoints h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            font-weight: 600;
            color: #333;
          }

          .checkpoint-options {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .checkpoint-option {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .checkpoint-option:hover {
            border-color: #667eea;
            background: #f9f9f9;
          }

          .checkpoint-option input[type="radio"] {
            margin-top: 4px;
            cursor: pointer;
            accent-color: #667eea;
          }

          .checkpoint-option input[type="radio"]:checked {
            accent-color: #667eea;
          }

          .checkpoint-option input[type="radio"]:checked + .option-content {
            color: #667eea;
          }

          .checkpoint-option:has(input[type="radio"]:checked) {
            border-color: #667eea;
            background: #f0f4ff;
          }

          .option-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
          }

          .option-step {
            font-size: 13px;
            font-weight: 500;
            color: #333;
          }

          .option-meta {
            font-size: 12px;
            color: #999;
          }

          .srm-preview {
            padding: 16px 24px;
            background: #e8edf7;
            border-top: 1px solid #dae4f0;
            border-bottom: 1px solid #dae4f0;
          }

          .srm-preview h4 {
            margin: 0 0 12px 0;
            font-size: 13px;
            font-weight: 600;
            color: #333;
          }

          .preview-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .preview-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
          }

          .preview-label {
            color: #666;
            font-weight: 500;
          }

          .preview-value {
            color: #333;
          }

          .preview-progress-bar {
            width: 100%;
            height: 6px;
            background: rgba(102, 126, 234, 0.2);
            border-radius: 3px;
            overflow: hidden;
            margin: 8px 0;
          }

          .preview-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
          }

          .srm-actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 20px 24px;
            border-top: 1px solid #e0e0e0;
          }

          .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-icon {
            font-size: 16px;
          }

          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
          }

          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: #f0f0f0;
            color: #333;
            border: 1px solid #e0e0e0;
          }

          .btn-secondary:hover {
            background: #e8e8e8;
            border-color: #d0d0d0;
          }

          .btn-tertiary {
            background: transparent;
            color: #666;
            border: 1px solid #e0e0e0;
          }

          .btn-tertiary:hover {
            background: #f9f9f9;
            border-color: #d0d0d0;
          }

          @media (max-width: 600px) {
            .session-resume-modal-overlay {
              padding: 0;
            }

            .session-resume-modal {
              border-radius: 0;
              max-height: 100vh;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
