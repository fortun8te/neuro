/**
 * TaskQueueViewer — View execution history and status of scheduled tasks
 */

import React, { useState, useEffect } from 'react';
import { useScheduler } from '../hooks/useScheduler';
import type { TaskExecution } from '../utils/scheduler';

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

interface TaskQueueViewerProps {
  limit?: number;
}

export function TaskQueueViewer({ limit = 50 }: TaskQueueViewerProps) {
  const { tasks, executions, executeTaskNow } = useScheduler();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);

  const filteredExecutions = selectedTaskId
    ? executions.filter((e) => e.taskId === selectedTaskId).slice(0, limit)
    : executions.slice(0, limit);

  const handleExecuteTask = async (taskId: string) => {
    setIsExecuting(true);
    try {
      await executeTaskNow(taskId);
    } catch (err) {
      console.error('Failed to execute task:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Task Queue</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold mb-4">Tasks</h2>

              {tasks.length === 0 ? (
                <p className="text-gray-500 text-sm">No scheduled tasks</p>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedTaskId(null)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      selectedTaskId === null
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    All Tasks ({executions.length})
                  </button>

                  {tasks.map((task) => {
                    const taskExecutions = executions.filter(
                      (e) => e.taskId === task.id
                    );
                    const recentStatus = taskExecutions[0]?.status;

                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedTaskId === task.id
                            ? 'bg-blue-100 text-blue-900 font-semibold'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium truncate">{task.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {taskExecutions.length} executions
                        </div>
                        {recentStatus && (
                          <div
                            className={`text-xs mt-1 px-2 py-1 rounded w-fit ${getStatusColor(
                              recentStatus
                            )}`}
                          >
                            {recentStatus}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedTaskId && (
                <button
                  onClick={() => handleExecuteTask(selectedTaskId)}
                  disabled={isExecuting}
                  className="w-full mt-4 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isExecuting ? 'Executing...' : 'Execute Now'}
                </button>
              )}
            </div>
          </div>

          {/* Execution History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold mb-4">
                Execution History
                {selectedTaskId &&
                  ` — ${tasks.find((t) => t.id === selectedTaskId)?.name || 'Task'}`}
              </h2>

              {filteredExecutions.length === 0 ? (
                <p className="text-gray-500 text-sm">No executions</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredExecutions.map((execution) => {
                    const isExpanded = expandedExecution === execution.id;

                    return (
                      <div
                        key={execution.id}
                        className="border border-gray-200 rounded"
                      >
                        <button
                          onClick={() =>
                            setExpandedExecution(
                              isExpanded ? null : execution.id
                            )
                          }
                          className="w-full text-left p-3 hover:bg-gray-50"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 text-xs rounded font-semibold ${getStatusColor(
                                    execution.status
                                  )}`}
                                >
                                  {execution.status.toUpperCase()}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {formatDate(execution.startedAt)}
                                </span>
                              </div>

                              <div className="text-xs text-gray-500 mt-1">
                                Duration: {formatDuration(execution.duration)}
                                {execution.retriesUsed > 0 &&
                                  ` (Retry ${execution.retriesUsed})`}
                              </div>
                            </div>

                            <span className="text-gray-400">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="bg-gray-50 p-3 border-t border-gray-200 text-xs">
                            {execution.error && (
                              <div className="mb-3">
                                <p className="font-semibold text-red-600 mb-1">
                                  Error:
                                </p>
                                <pre className="bg-red-50 p-2 rounded text-red-800 overflow-x-auto whitespace-pre-wrap break-words">
                                  {execution.error}
                                </pre>
                              </div>
                            )}

                            {execution.result && (
                              <div>
                                <p className="font-semibold text-green-600 mb-1">
                                  Result:
                                </p>
                                <pre className="bg-green-50 p-2 rounded text-green-800 overflow-x-auto whitespace-pre-wrap break-words max-h-40">
                                  {typeof execution.result === 'string'
                                    ? execution.result
                                    : JSON.stringify(execution.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Total Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Total Executions</p>
            <p className="text-3xl font-bold text-gray-900">{executions.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Success Rate</p>
            <p className="text-3xl font-bold text-green-600">
              {executions.length > 0
                ? Math.round(
                    (executions.filter((e) => e.status === 'completed').length /
                      executions.length) *
                      100
                  )
                : 0}
              %
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Avg Duration</p>
            <p className="text-3xl font-bold text-gray-900">
              {executions.length > 0
                ? formatDuration(
                    Math.round(
                      executions.reduce((sum, e) => sum + e.duration, 0) /
                        executions.length
                    )
                  )
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
