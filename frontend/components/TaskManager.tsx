/**
 * Task Manager — Real task management UI (Todoist-style)
 *
 * Features:
 * - Create tasks with simple title + description
 * - Click to edit inline
 * - Delete with trash/recovery
 * - Run long-running tasks
 * - Progress tracking
 * - Crash recovery built-in
 */

// @ts-nocheck
import { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import {
  createTask,
  getAllTasks,
  getTask,
  updateTask,
  deleteTask,
  archiveTask,
  startTask,
  pauseTask,
  resumeTask,
  completeTask,
  addCheckpoint,
  recordHeartbeat,
  startHeartbeat,
  formatDuration,
  type ExecutableTask,
  type TaskStatus,
} from '../utils/taskExecutor';
import { runAgentLoop } from '../utils/agentEngine';

export function TaskManager({ isDarkMode: parentIsDark }: { isDarkMode?: boolean } = {}) {
  // Accept isDarkMode from parent or use theme context
  const { isDarkMode: contextIsDark } = useTheme();
  const dark = parentIsDark ?? contextIsDark;
  const [tasks, setTasks] = useState<ExecutableTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const bg2 = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const hover = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  // Load tasks on mount
  useEffect(() => {
    (async () => {
      const allTasks = await getAllTasks();
      setTasks(allTasks);
      await startHeartbeat();
    })();
  }, []);

  // Refresh tasks every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const allTasks = await getAllTasks();
      setTasks(allTasks);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(async () => {
    const allTasks = await getAllTasks();
    setTasks(allTasks);
  }, []);

  // ── Create Task ──
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    const task = await createTask(
      newTaskTitle.trim(),
      newTaskTitle.trim(), // Use title as initial prompt
      newTaskDescription.trim()
    );

    setNewTaskTitle('');
    setNewTaskDescription('');
    await refresh();
  };

  // ── Start Execution ──
  const handleStartTask = async (taskId: string) => {
    const task = await getTask(taskId);
    if (!task) return;

    await startTask(taskId);
    setActiveTaskId(taskId);
    await refresh();

    // Execute the task
    try {
      const result = await runAgentLoop(task.prompt, '', {
        signal: new AbortController().signal,
        onEvent: async (event: any) => {
          // Record heartbeat
          await recordHeartbeat(taskId);

          // Update progress based on event type
          if (event.type === 'tool_start') {
            await addCheckpoint(taskId, `Running ${event.toolCall?.name}`, task.progress + 1);
          } else if (event.type === 'response_chunk') {
            // Increment progress slowly
            const currentTask = await getTask(taskId);
            if (currentTask && currentTask.progress < 95) {
              await addCheckpoint(taskId, 'Processing...', currentTask.progress + 1);
            }
          }
        },
      });

      await completeTask(taskId, result.finalResponse || 'Task completed');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Task execution error:', msg);
    }

    await refresh();
    setActiveTaskId(null);
  };

  // ── Pause/Resume ──
  const handlePauseTask = async (taskId: string) => {
    await pauseTask(taskId);
    await refresh();
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      await resumeTask(taskId);
      setActiveTaskId(taskId);
      await refresh();

      // Re-execute
      const task = await getTask(taskId);
      if (task) {
        const result = await runAgentLoop(task.prompt, '', {
          signal: new AbortController().signal,
          onEvent: async (event: any) => {
            await recordHeartbeat(taskId);
          },
        });
        await completeTask(taskId, result.finalResponse || 'Task completed');
      }
    } catch (error) {
      console.error('Resume failed:', error);
    }

    await refresh();
    setActiveTaskId(null);
  };

  // ── Edit Task ──
  const handleEditTask = async (task: ExecutableTask) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description);
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!editTitle.trim()) return;

    await updateTask(taskId, {
      title: editTitle.trim(),
      description: editDescription.trim(),
    });

    setEditingTaskId(null);
    await refresh();
  };

  // ── Delete Task ──
  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Delete this task? It will be moved to trash.')) {
      await deleteTask(taskId);
      await refresh();
    }
  };

  // ── Archive Task ──
  const handleArchiveTask = async (taskId: string) => {
    await archiveTask(taskId);
    await refresh();
  };

  const activeTasks = tasks.filter(
    (t) =>
      ['draft', 'queued', 'running', 'paused'].includes(t.status) &&
      (!editingTaskId || t.id !== editingTaskId)
  );

  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'running':
        return '#3b82f6';
      case 'completed':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'paused':
        return '#f59e0b';
      default:
        return '#94a3b8';
    }
  };

  const getStatusLabel = (status: TaskStatus): string => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'queued':
        return 'Queued';
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Done';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
        background: dark ? '#0a0a0a' : '#fff',
        color: dark ? '#fff' : '#000',
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📝 Tasks</div>

        {/* Quick Add */}
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            placeholder="Add a new task... (title)"
            style={{
              fontSize: 13,
              fontFamily: FONT_FAMILY,
              padding: '8px 10px',
              border: `1px solid ${border}`,
              borderRadius: 6,
              background: bg2,
              color: 'inherit',
              outline: 'none',
            }}
          />

          <textarea
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            style={{
              fontSize: 12,
              fontFamily: FONT_FAMILY,
              padding: '6px 10px',
              border: `1px solid ${border}`,
              borderRadius: 6,
              background: bg2,
              color: 'inherit',
              outline: 'none',
              resize: 'none',
            }}
          />

          <button
            onClick={handleCreateTask}
            disabled={!newTaskTitle.trim()}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 0',
              borderRadius: 6,
              border: 'none',
              background: newTaskTitle.trim() ? '#3b82f6' : border,
              color: newTaskTitle.trim() ? '#fff' : dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Create Task
          </button>
        </div>
      </div>

      {/* Task List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {activeTasks.length === 0 && completedTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.4, fontSize: 13 }}>
            No tasks yet. Create one above to get started.
          </div>
        )}

        {/* Active Tasks */}
        {activeTasks.map((task) => {
          const isEditing = editingTaskId === task.id;
          const isRunning = task.status === 'running' || task.id === activeTaskId;

          return (
            <div
              key={task.id}
              style={{
                padding: '10px',
                marginBottom: 8,
                borderRadius: 8,
                border: `1px solid ${border}`,
                background: isRunning ? `${getStatusColor(task.status)}10` : hover,
                transition: 'all 0.15s',
              }}
            >
              {isEditing ? (
                // Edit Mode
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    style={{
                      fontSize: 13,
                      fontFamily: FONT_FAMILY,
                      padding: '6px 8px',
                      border: `1px solid ${border}`,
                      borderRadius: 4,
                      background: bg2,
                      color: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      padding: '6px 8px',
                      border: `1px solid ${border}`,
                      borderRadius: 4,
                      background: bg2,
                      color: 'inherit',
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleSaveEdit(task.id)}
                      style={{
                        flex: 1,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '5px',
                        borderRadius: 4,
                        border: 'none',
                        background: '#3b82f6',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTaskId(null)}
                      style={{
                        flex: 1,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '5px',
                        borderRadius: 4,
                        border: `1px solid ${border}`,
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Normal View
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Status Indicator */}
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: getStatusColor(task.status),
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />

                    {/* Title + Description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        onClick={() => handleEditTask(task)}
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: task.status === 'completed' ? 0.5 : 1,
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </div>

                      {task.description && (
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.6,
                            marginTop: 4,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {task.description}
                        </div>
                      )}

                      {/* Progress Bar */}
                      {(task.status === 'running' || task.status === 'paused') && (
                        <div style={{ marginTop: 6 }}>
                          <div
                            style={{
                              height: 3,
                              background: border,
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${task.progress}%`,
                                background: getStatusColor(task.status),
                                transition: 'width 0.3s',
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 10, marginTop: 2, opacity: 0.6 }}>
                            {task.progress}% • {task.currentPhase}
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {task.error && (
                        <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>
                          ⚠️ {task.error}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {task.status === 'draft' || task.status === 'queued' ? (
                        <button
                          onClick={() => handleStartTask(task.id)}
                          title="Start task"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#3b82f6',
                            padding: 4,
                          }}
                        >
                          ▶
                        </button>
                      ) : task.status === 'running' ? (
                        <button
                          onClick={() => handlePauseTask(task.id)}
                          title="Pause task"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#f59e0b',
                            padding: 4,
                          }}
                        >
                          ⏸
                        </button>
                      ) : task.status === 'paused' ? (
                        <button
                          onClick={() => handleResumeTask(task.id)}
                          title="Resume task"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#3b82f6',
                            padding: 4,
                          }}
                        >
                          ▶
                        </button>
                      ) : null}

                      <button
                        onClick={() => handleEditTask(task)}
                        title="Edit task"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          opacity: 0.4,
                          padding: 4,
                        }}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        title="Delete task"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#ef4444',
                          opacity: 0.4,
                          padding: 4,
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              onClick={() => setShowCompleted(!showCompleted)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                opacity: 0.5,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              {showCompleted ? '▼' : '▶'} Completed ({completedTasks.length})
            </div>

            {showCompleted &&
              completedTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: '8px',
                    marginBottom: 6,
                    borderRadius: 6,
                    border: `1px solid ${border}`,
                    opacity: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ textDecoration: 'line-through', fontSize: 12 }}>
                    {task.title}
                  </div>
                  <button
                    onClick={() => handleArchiveTask(task.id)}
                    title="Archive"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 10,
                      opacity: 0.3,
                      padding: 4,
                    }}
                  >
                    📦
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskManager;
