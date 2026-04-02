/**
 * Scheduler CLI Commands — Integration layer for task scheduling commands
 * Handles: /schedule create/list/delete/pause/resume
 *          /heartbeat check/logs/config
 */

import { scheduler, type ScheduledTask, type TaskType, type ScheduleType } from './scheduler';
import { schedulerStorage } from './schedulerStorage';
import { healthMonitor } from './healthMonitor';
import { heartbeatMonitor } from './heartbeatMonitor';

export interface CliCommandResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * /schedule list — Show all scheduled tasks
 */
export async function scheduleList(): Promise<CliCommandResult> {
  try {
    const tasks = scheduler.getAllTasks();

    if (tasks.length === 0) {
      return {
        success: true,
        message: 'No scheduled tasks',
      };
    }

    let output = '\nScheduled Tasks:\n';
    output += '─'.repeat(80) + '\n';

    for (const task of tasks) {
      output += `\n[${task.enabled ? '✓' : '○'}] ${task.name} (${task.type})\n`;
      output += `    Schedule: ${getScheduleDisplay(task)}\n`;
      if (task.nextRun) {
        output += `    Next run: ${new Date(task.nextRun).toLocaleString()}\n`;
      }
      if (task.lastRun) {
        output += `    Last run: ${new Date(task.lastRun).toLocaleString()}\n`;
      }
      if (task.description) {
        output += `    Description: ${task.description}\n`;
      }
    }

    output += '\n' + '─'.repeat(80) + '\n';

    return {
      success: true,
      message: output,
      data: { count: tasks.length, tasks },
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to list tasks: ${err}`,
    };
  }
}

/**
 * /schedule create <name> <type> <schedule> [options]
 * Examples:
 *   /schedule create "Daily Research" research recurring 0 9 * * 1-5
 *   /schedule create "Weekly Report" report recurring 0 17 * * 5
 *   /schedule create "One-time Check" healthcheck once 2026-04-15T14:30:00
 */
export async function scheduleCreate(
  name: string,
  type: TaskType,
  scheduleType: ScheduleType,
  cronOrDate: string,
  options?: Record<string, any>
): Promise<CliCommandResult> {
  try {
    // Validate inputs
    if (!name || !type || !scheduleType) {
      return {
        success: false,
        message: 'Usage: /schedule create <name> <type> <recurring|once> <cron|datetime> [--description="..."] [--retries=N] [--timeout=ms]',
      };
    }

    const createOptions: any = {
      description: options?.description,
      maxRetries: options?.retries ?? 3,
      timeout: options?.timeout ?? 30000,
    };

    if (scheduleType === 'recurring') {
      createOptions.cron = cronOrDate;
    } else if (scheduleType === 'once') {
      createOptions.runAt = new Date(cronOrDate).getTime();
      if (isNaN(createOptions.runAt)) {
        return {
          success: false,
          message: 'Invalid datetime format. Use ISO 8601 format: 2026-04-15T14:30:00',
        };
      }
    }

    const task = scheduler.createTask(name, type, scheduleType, {}, createOptions);
    await schedulerStorage.saveTask(task);

    return {
      success: true,
      message: `Created task "${name}" (${task.id})`,
      data: task,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to create task: ${err}`,
    };
  }
}

/**
 * /schedule delete <taskId>
 */
export async function scheduleDelete(taskId: string): Promise<CliCommandResult> {
  try {
    const task = scheduler.getTask(taskId);
    if (!task) {
      return {
        success: false,
        message: `Task not found: ${taskId}`,
      };
    }

    scheduler.deleteTask(taskId);
    await schedulerStorage.deleteTask(taskId);

    return {
      success: true,
      message: `Deleted task "${task.name}"`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to delete task: ${err}`,
    };
  }
}

/**
 * /schedule pause <taskId>
 */
export async function schedulePause(taskId: string): Promise<CliCommandResult> {
  try {
    const task = scheduler.getTask(taskId);
    if (!task) {
      return {
        success: false,
        message: `Task not found: ${taskId}`,
      };
    }

    scheduler.pauseTask(taskId);
    await schedulerStorage.saveTask(task);

    return {
      success: true,
      message: `Paused task "${task.name}"`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to pause task: ${err}`,
    };
  }
}

/**
 * /schedule resume <taskId>
 */
export async function scheduleResume(taskId: string): Promise<CliCommandResult> {
  try {
    const task = scheduler.getTask(taskId);
    if (!task) {
      return {
        success: false,
        message: `Task not found: ${taskId}`,
      };
    }

    scheduler.resumeTask(taskId);
    await schedulerStorage.saveTask(task);

    return {
      success: true,
      message: `Resumed task "${task.name}"`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to resume task: ${err}`,
    };
  }
}

/**
 * /schedule run <taskId> — Execute immediately
 */
export async function scheduleRun(taskId: string): Promise<CliCommandResult> {
  try {
    const execution = await scheduler.executeTask(taskId);

    return {
      success: execution.status === 'completed',
      message: `Task execution: ${execution.status}`,
      data: execution,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to execute task: ${err}`,
    };
  }
}

/**
 * /heartbeat check — Run health check on all services
 */
export async function heartbeatCheck(): Promise<CliCommandResult> {
  try {
    const snapshot = await healthMonitor.checkAll();
    const log = await heartbeatMonitor.captureSnapshot();

    let output = '\nHealth Check Results:\n';
    output += '─'.repeat(80) + '\n';
    output += `Overall Health: ${log.overallHealth.toUpperCase()}\n\n`;

    for (const [name, service] of Object.entries(snapshot)) {
      const icon =
        service.status === 'healthy'
          ? '✓'
          : service.status === 'degraded'
            ? '!'
            : '✕';
      output += `${icon} ${name.padEnd(15)} ${service.status.padEnd(10)} (${service.latencyMs}ms)\n`;
      if (service.lastError) {
        output += `    Error: ${service.lastError}\n`;
      }
    }

    output += '\n' + '─'.repeat(80) + '\n';

    return {
      success: log.overallHealth !== 'critical',
      message: output,
      data: log,
    };
  } catch (err) {
    return {
      success: false,
      message: `Health check failed: ${err}`,
    };
  }
}

/**
 * /heartbeat logs [limit] — Show recent health logs
 */
export async function heartbeatLogs(limit: number = 10): Promise<CliCommandResult> {
  try {
    const logs = await heartbeatMonitor.getLogs(limit);

    if (logs.length === 0) {
      return {
        success: true,
        message: 'No health logs available',
      };
    }

    let output = `\nRecent Health Logs (last ${logs.length}):\n`;
    output += '─'.repeat(80) + '\n';

    for (const log of logs) {
      output += `\n${new Date(log.timestamp).toLocaleString()}\n`;
      output += `  Health: ${log.overallHealth}\n`;
      output += `  Alerts: ${log.alertsTriggered.length}\n`;
    }

    output += '\n' + '─'.repeat(80) + '\n';

    return {
      success: true,
      message: output,
      data: logs,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to load logs: ${err}`,
    };
  }
}

/**
 * /heartbeat status — Show current overall health status
 */
export async function heartbeatStatus(): Promise<CliCommandResult> {
  try {
    const report = await heartbeatMonitor.getHealthReport();

    let output = '\nSystem Health Report:\n';
    output += '─'.repeat(80) + '\n';
    output += `Overall Status: ${report.overallHealth.toUpperCase()}\n`;
    output += `Uptime: ${report.stats.uptimePercent.toFixed(2)}%\n`;
    output += `\nServices:\n`;

    for (const service of report.services) {
      const icon =
        service.status === 'healthy'
          ? '✓'
          : service.status === 'degraded'
            ? '!'
            : '✕';
      output += `  ${icon} ${service.name.padEnd(15)} ${service.status.padEnd(10)} (${service.latencyMs}ms)\n`;
    }

    if (report.recentAlerts.length > 0) {
      output += `\nRecent Alerts (${report.recentAlerts.length}):\n`;
      for (const alert of report.recentAlerts.slice(0, 5)) {
        output += `  - ${alert.message}\n`;
      }
    }

    output += '\n' + '─'.repeat(80) + '\n';

    return {
      success: report.overallHealth !== 'critical',
      message: output,
      data: report,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to get health report: ${err}`,
    };
  }
}

// ── Helper functions ────

function getScheduleDisplay(task: ScheduledTask): string {
  if (task.scheduleType === 'once' && task.runAt) {
    return `Once at ${new Date(task.runAt).toLocaleString()}`;
  }
  if (task.scheduleType === 'recurring' && task.cron) {
    return `Recurring: ${task.cron}`;
  }
  return 'Manual';
}
