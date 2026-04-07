/**
 * Queue history and completed queues viewer
 */

import React, { useState } from 'react';
import { PromptQueue } from '../types/queuedPrompt';

interface QueueHistoryProps {
  queues: PromptQueue[];
}

export default function QueueHistory({ queues }: QueueHistoryProps) {
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);

  const completedQueues = queues.filter((q) => q.status === 'completed' || q.status === 'failed');

  if (completedQueues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No completed queues yet</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Queue History</h2>

      <div className="space-y-2">
        {completedQueues.map((queue) => (
          <div
            key={queue.id}
            className={`p-4 rounded-lg border transition ${
              queue.status === 'completed'
                ? 'bg-green-900 border-green-700'
                : 'bg-red-900 border-red-700'
            }`}
          >
            <div
              className="flex items-start justify-between cursor-pointer"
              onClick={() =>
                setExpandedQueueId(expandedQueueId === queue.id ? null : queue.id)
              }
            >
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{queue.name}</h3>
                <p className="text-sm text-gray-300 mt-1">
                  {queue.completedAt && new Date(queue.completedAt).toLocaleString()}
                </p>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold">
                  {queue.successCount}/{queue.items.length}
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  {queue.totalDuration && `${(queue.totalDuration / 1000).toFixed(1)}s`}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {expandedQueueId === queue.id && (
              <div className="mt-4 pt-4 border-t border-opacity-30 border-white space-y-3">
                {/* Overall stats */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-300">Success</div>
                    <div className="text-xl font-bold text-green-300">
                      {queue.successCount}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-300">Failed</div>
                    <div className="text-xl font-bold text-red-300">
                      {queue.failureCount}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-300">Tokens Used</div>
                    <div className="text-xl font-bold">
                      {queue.totalTokensUsed || '—'}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {queue.description && (
                  <div>
                    <div className="text-sm text-gray-300 mb-1">Description:</div>
                    <p className="text-sm text-gray-400">{queue.description}</p>
                  </div>
                )}

                {/* Item results */}
                <div>
                  <div className="text-sm font-semibold mb-2">Item Results:</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {queue.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`text-xs p-2 rounded ${
                          item.status === 'completed'
                            ? 'bg-green-800 bg-opacity-30'
                            : 'bg-red-800 bg-opacity-30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-gray-400">
                            #{idx + 1} {item.label || 'Item'}
                          </span>
                          <span
                            className={
                              item.status === 'completed'
                                ? 'text-green-300'
                                : 'text-red-300'
                            }
                          >
                            {item.status}
                          </span>
                        </div>

                        {item.duration && (
                          <div className="text-xs text-gray-400 mt-1">
                            {(item.duration / 1000).toFixed(1)}s
                            {item.tokensUsed && ` • ${item.tokensUsed} tokens`}
                          </div>
                        )}

                        {item.error && (
                          <div className="text-xs text-red-300 mt-1 truncate">
                            {item.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configuration */}
                <div>
                  <div className="text-sm font-semibold mb-2">Configuration:</div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Parallel Limit: {queue.parallelExecutionLimit}</div>
                    <div>Stop on Error: {queue.stopOnError ? 'Yes' : 'No'}</div>
                    <div>Retry on Failure: {queue.retryOnFailure}x</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
