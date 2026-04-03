/**
 * CLI State Persistence
 * Saves and restores CLI execution state across sessions
 * Enables resume-after-crash functionality
 */

import { set, get, del } from 'idb-keyval';

export interface CLIExecutionState {
  sessionId: string;
  startTime: number;
  lastUpdate: number;
  phase: string;
  step: number;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentModel: string;
  tokenCount: number;
  elapsedMs: number;
  cycleData?: Record<string, any>;
  errors: Array<{ message: string; timestamp: number }>;
}

const STATE_KEY = 'neuro_cli_state';
const STATE_HISTORY_KEY = 'neuro_cli_state_history';

/**
 * Initialize a new execution state
 */
export function createState(): CLIExecutionState {
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    phase: 'initialization',
    step: 0,
    conversationHistory: [],
    currentModel: 'qwen3.5:9b',
    tokenCount: 0,
    elapsedMs: 0,
    errors: [],
  };
}

/**
 * Save current state to IndexedDB
 */
export async function saveState(state: CLIExecutionState): Promise<void> {
  try {
    state.lastUpdate = Date.now();
    state.elapsedMs = Date.now() - state.startTime;
    await set(STATE_KEY, state);
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

/**
 * Load last saved state from IndexedDB
 */
export async function loadState(): Promise<CLIExecutionState | null> {
  try {
    const state = await get<CLIExecutionState>(STATE_KEY);
    return state || null;
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

/**
 * Save state to history (for audit trail)
 */
export async function saveStateToHistory(state: CLIExecutionState): Promise<void> {
  try {
    const history = (await get<CLIExecutionState[]>(STATE_HISTORY_KEY)) || [];
    history.push({
      ...state,
      // Create immutable snapshot
    });

    // Keep only last 100 states to avoid bloating IndexedDB
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    await set(STATE_HISTORY_KEY, history);
  } catch (error) {
    console.error('Failed to save state to history:', error);
  }
}

/**
 * Get state history
 */
export async function getStateHistory(): Promise<CLIExecutionState[]> {
  try {
    const history = await get<CLIExecutionState[]>(STATE_HISTORY_KEY);
    return history || [];
  } catch (error) {
    console.error('Failed to get state history:', error);
    return [];
  }
}

/**
 * Update phase in state
 */
export async function updatePhase(state: CLIExecutionState, phase: string, step: number = 0): Promise<void> {
  state.phase = phase;
  state.step = step;
  await saveState(state);
}

/**
 * Add message to conversation history in state
 */
export async function addMessage(
  state: CLIExecutionState,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  state.conversationHistory.push({ role, content });
  await saveState(state);
}

/**
 * Update token count in state
 */
export async function updateTokens(state: CLIExecutionState, inputTokens: number, outputTokens: number): Promise<void> {
  state.tokenCount += inputTokens + outputTokens;
  await saveState(state);
}

/**
 * Add error to state
 */
export async function recordError(state: CLIExecutionState, message: string): Promise<void> {
  state.errors.push({
    message,
    timestamp: Date.now(),
  });
  await saveState(state);
}

/**
 * Set cycle data in state
 */
export async function setCycleData(state: CLIExecutionState, data: Record<string, any>): Promise<void> {
  state.cycleData = data;
  await saveState(state);
}

/**
 * Clear state (on completion)
 */
export async function clearState(): Promise<void> {
  try {
    await del(STATE_KEY);
  } catch (error) {
    console.error('Failed to clear state:', error);
  }
}

/**
 * Print state summary
 */
export function printStateSummary(state: CLIExecutionState): void {
  process.stdout.write(`\n  ┌─ Session State ─────────────────────────────────┐\n`);
  process.stdout.write(`  │  Session ID:  ${state.sessionId.substring(0, 20)}...\n`);
  process.stdout.write(`  │  Phase:       ${state.phase}\n`);
  process.stdout.write(`  │  Step:        ${state.step}\n`);
  process.stdout.write(`  │  Elapsed:     ${Math.floor(state.elapsedMs / 1000)}s\n`);
  process.stdout.write(`  │  Tokens:      ${state.tokenCount}\n`);
  process.stdout.write(`  │  Model:       ${state.currentModel}\n`);
  process.stdout.write(`  │  Errors:      ${state.errors.length}\n`);
  process.stdout.write(`  │  Messages:    ${state.conversationHistory.length}\n`);
  process.stdout.write(`  └──────────────────────────────────────────────────┘\n\n`);
}
