/**
 * Natural Language Scheduler
 * Converts phrases like "remind me at 3pm" or "every Monday" into cron expressions
 * and scheduled task definitions.
 */

export interface ScheduledTaskDefinition {
  taskId: string;
  prompt: string;
  description: string;
  schedule: 'one-time' | 'recurring';
  cronExpression?: string; // for recurring
  fireAt?: string;         // ISO 8601 for one-time
}

/**
 * Parse natural language into scheduled task definition
 *
 * Examples:
 * - "remind me to review metrics at 9am tomorrow"
 * - "remind me every monday at 5pm to check PRs"
 * - "in 5 minutes, check if build passed"
 * - "every day at noon, run security audit"
 * - "tomorrow morning at 8am, launch UX audit"
 */
export function parseScheduledTask(input: string): ScheduledTaskDefinition | null {
  const taskId = `scheduled-${Date.now()}`;

  // Extract time expressions
  const timeMatch = extractTimeExpression(input);
  if (!timeMatch) {
    console.warn('[Scheduler] Could not parse time expression:', input);
    return null;
  }

  // Extract the actual task/prompt from the input
  const taskMatch = input.match(
    /(?:remind me to |remind me|do |run |launch |check if |execute |)\s*(.+?)(?:\s+(?:at|on|in|every|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|today|tonight)|$)/i
  );
  const taskPrompt = taskMatch?.[1] || input.replace(/(?:remind me|at|on|in|every).+/i, '').trim() || input;

  // Determine if recurring or one-time
  const isRecurring = /every|weekly|daily|monthly|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(input);

  if (isRecurring) {
    const cron = timeToCron(timeMatch);
    if (!cron) return null;

    return {
      taskId,
      prompt: `Execute scheduled task: ${taskPrompt}`,
      description: `Recurring task: ${input}`,
      schedule: 'recurring',
      cronExpression: cron,
    };
  } else {
    const fireAt = timeToISO8601(timeMatch);
    if (!fireAt) return null;

    return {
      taskId,
      prompt: `Execute scheduled task: ${taskPrompt}`,
      description: `One-time task: ${input}`,
      schedule: 'one-time',
      fireAt,
    };
  }
}

interface TimeExpression {
  type: 'absolute' | 'relative' | 'recurring';
  hour?: number;
  minute?: number;
  ampm?: 'am' | 'pm';
  dayOfWeek?: string;
  dayOffset?: number;  // 0 = today, 1 = tomorrow
  minutesFromNow?: number;
  hoursFromNow?: number;
  recurrencePattern?: string;
}

function extractTimeExpression(input: string): TimeExpression | null {
  // Relative: "in 5 minutes", "in 2 hours"
  const relativeMatch = input.match(/in\s+(\d+)\s+(minutes?|hours?)/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    return {
      type: 'relative',
      minutesFromNow: unit.startsWith('hour') ? amount * 60 : amount,
    };
  }

  // Absolute time today/tomorrow: "at 3pm", "at 9:30am", "at 14:00"
  const timeMatch = input.match(/(?:at|on|around)\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  const dayMatch = input.match(/(tomorrow|tonight|today|this morning|this afternoon|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);

  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase() as 'am' | 'pm' | undefined;

    // Convert to 24h format
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    // Determine day offset
    let dayOffset = 0;
    let dayOfWeek: string | undefined;

    if (dayMatch) {
      const day = dayMatch[1].toLowerCase();
      if (day === 'tomorrow') dayOffset = 1;
      else if (day === 'today' || day === 'this morning' || day === 'this afternoon' || day === 'this evening') dayOffset = 0;
      else {
        // Day of week
        dayOfWeek = day;
      }
    }

    return {
      type: 'absolute',
      hour,
      minute,
      ampm,
      dayOfWeek,
      dayOffset,
    };
  }

  // Recurring: "every monday", "every day at 9am"
  const recurringMatch = input.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|week|weekday)/i);
  const recurringTimeMatch = input.match(/every\s+\w+\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);

  if (recurringMatch) {
    const pattern = recurringMatch[1].toLowerCase();
    let hour = 9;
    let minute = 0;

    if (recurringTimeMatch) {
      hour = parseInt(recurringTimeMatch[1]);
      minute = recurringTimeMatch[2] ? parseInt(recurringTimeMatch[2]) : 0;
      const ampm = recurringTimeMatch[3]?.toLowerCase() as 'am' | 'pm' | undefined;
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    }

    return {
      type: 'recurring',
      hour,
      minute,
      recurrencePattern: pattern,
    };
  }

  return null;
}

function timeToISO8601(time: TimeExpression): string | null {
  if (time.type === 'relative') {
    const now = new Date();
    if (time.minutesFromNow) {
      now.setMinutes(now.getMinutes() + time.minutesFromNow);
    }
    if (time.hoursFromNow) {
      now.setHours(now.getHours() + time.hoursFromNow);
    }
    return now.toISOString();
  }

  if (time.type === 'absolute') {
    const date = new Date();

    // Set day
    if (time.dayOffset !== undefined && time.dayOffset > 0) {
      date.setDate(date.getDate() + time.dayOffset);
    }

    // Set time
    if (time.hour !== undefined) {
      date.setHours(time.hour);
    }
    if (time.minute !== undefined) {
      date.setMinutes(time.minute);
    }

    date.setSeconds(0);
    date.setMilliseconds(0);

    // If the time has already passed today, schedule for tomorrow
    if (time.dayOffset === 0 && date.getTime() < Date.now()) {
      date.setDate(date.getDate() + 1);
    }

    return date.toISOString();
  }

  return null;
}

function timeToCron(time: TimeExpression): string | null {
  if (time.type !== 'recurring' || !time.recurrencePattern) {
    return null;
  }

  const minute = time.minute ?? 0;
  const hour = time.hour ?? 9;
  const pattern = time.recurrencePattern.toLowerCase();

  // Convert to cron format: minute hour day-of-month month day-of-week

  if (pattern === 'day') {
    return `${minute} ${hour} * * *`;
  }

  if (pattern === 'week') {
    return `${minute} ${hour} * * 0`; // Sunday
  }

  if (pattern === 'weekday') {
    return `${minute} ${hour} * * 1-5`; // Mon-Fri
  }

  // Specific day of week
  const dayMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };

  if (dayMap[pattern] !== undefined) {
    return `${minute} ${hour} * * ${dayMap[pattern]}`;
  }

  return null;
}

/**
 * Format a cron expression as human-readable
 */
export function cronToHuman(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dom, month, dow] = parts;

  const hourNum = parseInt(hour);
  const minNum = parseInt(minute);
  const timeStr = `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;

  const dayNames: Record<string, string> = {
    '0': 'Sunday',
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
  };

  if (dow !== '*') {
    const dayName = dayNames[dow] || `day ${dow}`;
    return `Every ${dayName} at ${timeStr}`;
  }

  if (dom !== '*') {
    return `Day ${dom} of each month at ${timeStr}`;
  }

  return `Every day at ${timeStr}`;
}
