/**
 * ScheduleManager — UI for creating, editing, and managing scheduled tasks
 */

import React, { useState } from 'react';
import { useScheduler } from '../hooks/useScheduler';
import type { ScheduledTask, TaskType, ScheduleType } from '../utils/scheduler';

const TASK_TYPES: TaskType[] = ['research', 'report', 'healthcheck', 'custom'];

export function ScheduleManager() {
  const { tasks, createTask, updateTask, deleteTask, pauseTask, resumeTask } = useScheduler();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    type: 'research',
    scheduleType: 'recurring',
    cron: '0 9 * * 1-5',
    runAt: '',
    maxRetries: 3,
    timeout: 30000,
  });

  const handleCreateTask = async () => {
    try {
      const options: any = {
        description: formData.description,
        maxRetries: formData.maxRetries,
        timeout: formData.timeout,
      };

      if (formData.scheduleType === 'recurring') {
        options.cron = formData.cron;
      } else if (formData.scheduleType === 'once') {
        options.runAt = new Date(formData.runAt).getTime();
      }

      await createTask(
        formData.name,
        formData.type,
        formData.scheduleType,
        {}, // parameters
        options
      );

      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        type: 'research',
        scheduleType: 'recurring',
        cron: '0 9 * * 1-5',
        runAt: '',
        maxRetries: 3,
        timeout: 30000,
      });
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(id);
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const handleTogglePause = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await pauseTask(id);
      } else {
        await resumeTask(id);
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const getScheduleDisplay = (task: ScheduledTask): string => {
    if (task.scheduleType === 'once' && task.runAt) {
      return `Once at ${new Date(task.runAt).toLocaleString()}`;
    }
    if (task.scheduleType === 'recurring' && task.cron) {
      return `Recurring: ${task.cron}`;
    }
    return 'Manual';
  };

  const getNextRunDisplay = (task: ScheduledTask): string => {
    if (!task.nextRun) return 'Not scheduled';
    const now = Date.now();
    const diff = task.nextRun - now;

    if (diff < 0) return 'Running soon';

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `In ${days}d ${hours % 24}h`;
    if (hours > 0) return `In ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `In ${minutes}m`;
    return 'Very soon';
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Scheduled Tasks</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'New Task'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New Task</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Daily Research"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Type
                </label>
                <select
                  value={formData.scheduleType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scheduleType: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="recurring">Recurring (Cron)</option>
                  <option value="once">One-Time</option>
                  <option value="adhoc">Manual</option>
                </select>
              </div>

              {formData.scheduleType === 'recurring' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    value={formData.cron}
                    onChange={(e) =>
                      setFormData({ ...formData, cron: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0 9 * * 1-5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: minute hour day month dow (e.g., 0 9 * * 1-5 = 9am weekdays)
                  </p>
                </div>
              )}

              {formData.scheduleType === 'once' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Run At
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.runAt}
                    onChange={(e) =>
                      setFormData({ ...formData, runAt: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Retries
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.maxRetries}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxRetries: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={formData.timeout}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeout: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <button
              onClick={handleCreateTask}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create Task
            </button>
          </div>
        )}

        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No scheduled tasks yet</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{task.name}</h3>
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                    <div className="mt-2 flex gap-4 text-sm text-gray-600">
                      <span>Type: {task.type}</span>
                      <span>{getScheduleDisplay(task)}</span>
                      {task.nextRun && <span>{getNextRunDisplay(task)}</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTogglePause(task.id, task.enabled)}
                      className={`px-3 py-1 rounded text-sm ${
                        task.enabled
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                    >
                      {task.enabled ? 'Pause' : 'Resume'}
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
