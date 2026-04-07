/**
 * Queue executor component for running queues and monitoring progress
 */

import React, { useState, useEffect } from 'react';
import { PromptQueue, QueuedPromptItem } from '../types/queuedPrompt';
import { QueuedPromptExecutor } from '../utils/queuedPromptExecutor';

interface QueueExecutorProps {
  queue: PromptQueue;
  onExecute: (queueId: string) => Promise<PromptQueue>;
  onCancel: (queueId: string) => void;
  onUpdateQueue: (queue: PromptQueue) => Promise<void>;
}

export default function QueueExecutor({
  queue,
  onExecute,
  onCancel,
  onUpdateQueue,
}: QueueExecutorProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const executionStatus = QueuedPromptExecutor.getExecutionStatus(queue);
  const completedCount = queue.items.filter((i) => i.status === 'completed' || i.status === 'failed')
    .length;
  const progressPercentage = (completedCount / queue.items.length) * 100;

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await onExecute(queue.id);
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = () => {
    onCancel(queue.id);
    setIsExecuting(false);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Execution controls */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          {!isExecuting ? (
            <button
              onClick={handleExecute}
              disabled={queue.items.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
            >
              Execute Queue
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
            >
              Cancel Execution
            </button>
          )}

          <div className="text-sm">
            {isExecuting ? (
              <span className="text-yellow-400">Executing...</span>
            ) : queue.status === 'completed' ? (
              <span className="text-green-400">Completed</span>
            ) : queue.status === 'failed' ? (
              <span className="text-red-400">Failed</span>
            ) : (
              <span className="text-gray-400">Ready</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1 text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-gray-300 font-mono">
              {completedCount}/{queue.items.length} ({Math.round(progressPercentage)}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-2 text-xs mt-4">
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Total Items</div>
            <div className="text-lg font-semibold">{queue.items.length}</div>
          </div>

          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Completed</div>
            <div className="text-lg font-semibold text-green-400">{queue.successCount}</div>
          </div>

          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Failed</div>
            <div className="text-lg font-semibold text-red-400">{queue.failureCount}</div>
          </div>

          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Duration</div>
            <div className="text-lg font-semibold">{queue.totalDuration ? `${(queue.totalDuration / 1000).toFixed(1)}s` : '—'}</div>
          </div>
        </div>
      </div>

      {/* Items with live updates */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex-1 overflow-auto">
        <h3 className="text-lg font-semibold mb-3">Queue Items</h3>

        <div className="space-y-2">
          {queue.items.map((item, idx) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border transition ${
                item.status === 'completed'
                  ? 'bg-green-900 border-green-700'
                  : item.status === 'failed'
                    ? 'bg-red-900 border-red-700'
                    : item.status === 'executing'
                      ? 'bg-blue-900 border-blue-700 animate-pulse'
                      : 'bg-gray-700 border-gray-600'
              }`}
            >
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() =>
                  setExpandedItemId(expandedItemId === item.id ? null : item.id)
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-opacity-30">
                      {item.status === 'completed' && (
                        <span className="text-green-200">✓ Completed</span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-red-200">✗ Failed</span>
                      )}
                      {item.status === 'executing' && (
                        <span className="text-blue-200">⟳ Executing</span>
                      )}
                      {item.status === 'pending' && (
                        <span className="text-gray-300">○ Pending</span>
                      )}
                    </span>
                    {item.duration && (
                      <span className="text-xs text-gray-400">
                        {(item.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {item.label && (
                    <p className="text-sm font-medium mt-1">{item.label}</p>
                  )}

                  {expandedItemId !== item.id && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {item.prompt.substring(0, 60)}...
                    </p>
                  )}
                </div>
              </div>

              {/* Expanded view */}
              {expandedItemId === item.id && (
                <div className="mt-3 pt-3 border-t border-opacity-30 border-white">
                  <div className="text-xs space-y-2">
                    <div>
                      <div className="text-gray-400 mb-1">Prompt:</div>
                      <p className="font-mono whitespace-pre-wrap bg-gray-600 bg-opacity-50 p-2 rounded">
                        {item.prompt}
                      </p>
                    </div>

                    {item.output && (
                      <div>
                        <div className="text-green-300 mb-1">Output:</div>
                        <p className="font-mono whitespace-pre-wrap bg-gray-600 bg-opacity-50 p-2 rounded max-h-32 overflow-auto">
                          {item.output.substring(0, 500)}
                          {item.output.length > 500 && '...'}
                        </p>
                      </div>
                    )}

                    {item.error && (
                      <div>
                        <div className="text-red-300 mb-1">Error:</div>
                        <p className="font-mono whitespace-pre-wrap bg-red-900 bg-opacity-50 p-2 rounded">
                          {item.error}
                        </p>
                      </div>
                    )}

                    {item.tokensUsed && (
                      <div className="text-gray-400">
                        Tokens: {item.tokensUsed} • Model: {item.model}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
