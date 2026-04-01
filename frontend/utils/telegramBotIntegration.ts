/**
 * Telegram Bot Integration for Neuro Agent
 *
 * Strategy: Edit a single message as the agent executes tools
 * - Tool tracking message updates in real-time
 * - Final summary posted as separate message
 * - No message spam - clean, readable output
 */

import { Telegraf, Context } from 'telegraf';
import { executeAgentStreaming, type TelegramToolEvent } from './telegramAgentExecutor.ts';

interface TelegramSession {
  userId: string;
  chatId: number;
  trackingMessageId?: number;
  toolsExecuted: string[];
  startTime: number;
}

interface ToolEvent {
  type: 'tool_start' | 'tool_complete' | 'tool_error' | 'thinking' | 'done';
  toolName?: string;
  result?: string;
  error?: string;
  timestamp: number;
}

/**
 * Create a Telegram bot that integrates with Neuro agent
 * Uses message editing to show progress without spam
 */
export function createTelegramBot(botToken: string) {
  const bot = new Telegraf(botToken);
  const sessions = new Map<number, TelegramSession>();

  /**
   * Start command - welcome message
   */
  bot.start((ctx) => {
    const session: TelegramSession = {
      userId: ctx.from?.id.toString() || 'unknown',
      chatId: ctx.chat.id,
      toolsExecuted: [],
      startTime: Date.now(),
    };
    sessions.set(ctx.chat.id, session);

    return ctx.reply(
      '🤖 **Neuro Agent at Your Service**\n\n' +
      'Send me any task and I\'ll execute it with full transparency:\n' +
      '• Tool execution tracking (real-time updates)\n' +
      '• Deep reasoning & thinking process\n' +
      '• Single message editing (no spam)\n' +
      '• Final summary when complete\n\n' +
      'Try: "Analyze this codebase for me" or "Research the latest AI trends"',
      { parse_mode: 'Markdown' }
    );
  });

  /**
   * Handle user messages
   */
  bot.on('message', async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;

    const userMessage = ctx.message.text;
    const session = sessions.get(ctx.chat.id) || {
      userId: ctx.from?.id.toString() || 'unknown',
      chatId: ctx.chat.id,
      toolsExecuted: [],
      startTime: Date.now(),
    };
    sessions.set(ctx.chat.id, session);

    // Send initial tracking message
    const trackingMsg = await ctx.reply(
      '⏳ **Processing your request...**\n\n' +
      '📊 Tools Executed: None yet\n' +
      '⏱️ Elapsed: 0s'
    );

    session.trackingMessageId = trackingMsg.message_id;

    try {
      // Simulate agent execution (in real implementation, this calls runAgentLoop)
      await simulateAgentExecution(ctx, session, userMessage);
    } catch (error) {
      try {
        await (ctx.telegram.editMessageText as any)(
          ctx.chat.id,
          trackingMsg.message_id,
          `❌ **Error Processing Request**\n\n${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } catch (e) {
        // Silently fail if can't edit
      }
    }
  });

  return bot;
}

/**
 * Production agent execution with real-time tool tracking
 * Edits single message as tools execute, then posts final summary separately
 */
async function simulateAgentExecution(
  ctx: Context<any>,
  session: TelegramSession,
  userMessage: string
) {
  const toolsExecuted: { name: string; status: string; duration: number }[] = [];
  const startTime = Date.now();
  let currentThinking = '';

  // Create event handler for message updates
  const onEvent = async (event: TelegramToolEvent) => {
    if (event.type === 'thinking') {
      currentThinking = event.output || '';
      await updateTrackingMessage(ctx, session, toolsExecuted, 0, currentThinking);
    } else if (event.type === 'tool_start') {
      // Update with active tool
      await updateTrackingMessage(ctx, session, toolsExecuted, 0, currentThinking, event.toolName);
    } else if (event.type === 'tool_complete') {
      // Add to completed tools and update
      if (event.toolName && event.duration) {
        toolsExecuted.push({
          name: event.toolName,
          status: '✅',
          duration: event.duration,
        });
      }
      await updateTrackingMessage(ctx, session, toolsExecuted, 0, currentThinking);
    } else if (event.type === 'tool_error') {
      // Show error but continue
      currentThinking = `Error: ${event.error}`;
      await updateTrackingMessage(ctx, session, toolsExecuted, 0, currentThinking);
    }
  };

  try {
    let finalResponse = '';

    // Execute agent with streaming events
    const executor = executeAgentStreaming(userMessage, onEvent);

    for await (const event of executor) {
      if (event.type === 'response') {
        finalResponse = event.output || '';
      }
    }

    // Post final summary as separate message
    const totalTime = (Date.now() - startTime) / 1000;
    const summaryText = formatFinalSummary(userMessage, toolsExecuted, totalTime, finalResponse);
    await ctx.reply(summaryText, { parse_mode: 'Markdown' });

    // Edit tracking message to show completion
    if (session.trackingMessageId) {
      try {
        await (ctx.telegram.editMessageText as any)(
          ctx.chat.id,
          session.trackingMessageId,
          '✅ **Execution Complete**\n\n' +
          `📊 Tools executed: ${toolsExecuted.length}\n` +
          `⏱️ Total time: ${totalTime.toFixed(2)}s`
        );
      } catch (e) {
        // Silently fail if can't edit
      }
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Update the tracking message with current progress
 * Edits the same message instead of sending new ones
 */
async function updateTrackingMessage(
  ctx: Context<any>,
  session: TelegramSession,
  toolsExecuted: { name: string; status: string; duration: number }[],
  currentStep: number,
  thinking: string,
  activeToolName?: string
) {
  if (!session.trackingMessageId) return;

  const elapsed = ((Date.now() - session.startTime) / 1000).toFixed(1);
  const toolsList = toolsExecuted
    .map(t => `  ${t.status} ${t.name} (${t.duration}ms)`)
    .join('\n');

  let text = '⚙️ **Tool Execution**\n\n';
  text += `💭 ${thinking}\n\n`;

  if (activeToolName) {
    text += `🔄 **Running:** ${activeToolName}...\n\n`;
  }

  text += '📊 **Completed Tools:**\n';
  text += toolsList || '  (none yet)\n';

  text += `\n⏱️ Elapsed: ${elapsed}s`;

  try {
    await (ctx.telegram.editMessageText as any)(
      session.chatId,
      session.trackingMessageId,
      text
    );
  } catch (error) {
    // Silently fail if message is too old to edit (Telegram has limits)
  }
}

/**
 * Format the final summary message
 * Sent as a separate message after tracking completes
 */
function formatFinalSummary(
  userMessage: string,
  tools: { name: string; status: string; duration: number }[],
  totalTime: number,
  finalResponse: string = ''
): string {
  const toolsDetail = tools.length > 0
    ? tools.map((t, i) => `${i + 1}. **${t.name}** - ${t.status} (${t.duration}ms)`).join('\n')
    : 'None';

  const responsePreview = finalResponse.slice(0, 500);

  return (
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '✅ **EXECUTION SUMMARY**\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    `📝 **Request:** ${userMessage}\n\n` +
    `🔧 **Tools Used:** ${tools.length}\n` +
    `${toolsDetail}\n\n` +
    `⏱️ **Total Time:** ${totalTime.toFixed(2)}s\n\n` +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '**Response:**\n' +
    responsePreview + (finalResponse.length > 500 ? '\n\n*(truncated)*' : '')
  );
}

/**
 * Hook for integrating with real agent events
 * Call this from agentEngine when tools execute
 */
export function createAgentEventBridge(telegramCtx: Context<any>, session: TelegramSession) {
  return {
    onToolStart: (toolName: string) => {
      console.log(`[Telegram] Tool started: ${toolName}`);
    },
    onToolComplete: (toolName: string, result: string, duration: number) => {
      console.log(`[Telegram] Tool completed: ${toolName} (${duration}ms)`);
    },
    onThinkingChunk: (chunk: string) => {
      console.log(`[Telegram] Thinking: ${chunk}`);
    },
    onComplete: (finalResult: string) => {
      console.log(`[Telegram] Agent complete`);
    },
  };
}

/**
 * Start the bot
 * In production, integrate with your existing infrastructure
 */
export async function startTelegramBot(botToken: string) {
  const bot = createTelegramBot(botToken);

  console.log('🤖 Starting Neuro Telegram Bot...');
  console.log('Token length:', botToken.length);

  // Graceful shutdown handlers
  process.once('SIGINT', () => {
    console.log('Shutting down bot...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('Shutting down bot...');
    bot.stop('SIGTERM');
  });

  // For local development - use long polling
  try {
    await bot.launch({
      allowedUpdates: ['message'],
    });
    console.log('✅ Telegram bot is running!');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    throw error;
  }
}

/**
 * For serverless/webhook deployment (Vercel)
 */
export function getTelegramWebhookHandler(botToken: string) {
  const bot = createTelegramBot(botToken);
  return bot.webhookCallback('/telegram');
}

export type { TelegramSession, ToolEvent };
