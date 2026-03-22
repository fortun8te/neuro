/**
 * desktopBus — singleton event bus for controlling the virtual macOS desktop.
 *
 * Components subscribe to receive events; tools emit them.
 * This decouples the agent engine (which has no React context) from the desktop UI.
 */

import type { AskUserRequest, AskUserResponse } from './computerAgent/orchestrator';

export type DesktopEvent =
  | { type: 'open_window'; window: 'chrome' | 'finder' | 'terminal' }
  | { type: 'close_window'; window: 'chrome' | 'finder' | 'terminal' }
  | { type: 'navigate_chrome'; url: string }
  | { type: 'run_terminal'; command: string }
  | { type: 'focus_window'; window: 'chrome' | 'finder' | 'terminal' }
  | { type: 'open_path'; path: string }
  | { type: 'run_goal'; goal: string }
  | { type: 'ask_user'; request: AskUserRequest; resolve: (response: AskUserResponse) => void }
  | { type: 'browser_stream'; sessionId: string }
  | { type: 'browser_stream_stop' }
  | { type: 'agent_status'; phase: 'planning' | 'executing' | 'verifying' | 'asking' | 'done' | 'error'; message: string; stepIndex?: number; totalSteps?: number }
  | { type: 'agent_plan'; steps: Array<{ instruction: string; highStakes: boolean }> }
  | { type: 'agent_step_start'; stepIndex: number; instruction: string; expectedState: string; reasoning?: string }
  | { type: 'agent_step_verify'; stepIndex: number }
  | { type: 'agent_step_done'; stepIndex: number; success: boolean; result: string }
  | { type: 'agent_iteration'; stepIndex: number; iter: number; maxIter: number }
  // AI cursor overlay events
  | { type: 'ai_cursor_move'; x: number; y: number; cursorState: 'idle' | 'thinking' | 'acting' | 'clicking' | 'typing' | 'dragging' }
  | { type: 'ai_cursor_click'; x: number; y: number }
  | { type: 'ai_cursor_state'; cursorState: 'idle' | 'thinking' | 'acting' | 'clicking' | 'typing' | 'dragging' }
  // Agent vision loop events (screenshots + action descriptions for sidebar)
  | { type: 'agent_screenshot'; stepIndex: number; screenshot: string; iteration: number }
  | { type: 'agent_action_desc'; stepIndex: number; description: string; actionType: string; iteration: number; screenState?: string }
  // Agent action badge
  | { type: 'ai_action'; action: 'click' | 'typing' | 'scroll' | 'navigate' | 'looking' | 'thinking' | 'idle'; x?: number; y?: number }
  // Task-level events for heatmap
  | { type: 'ai_task_start' }
  | { type: 'ai_task_end' }
  // Focus region highlight (shown before click, relative to Chrome viewport image)
  | { type: 'ai_cursor_focus_region'; x: number; y: number; w: number; h: number }
  // Chrome window bounds for cursor coordinate mapping
  | { type: 'chrome_window_bounds'; left: number; top: number; width: number; height: number; headerHeight: number; streamWidth: number; streamHeight: number }
  // Notes app events
  | { type: 'note_write'; title: string; content: string }
  | { type: 'note_read'; title: string }
  | { type: 'note_content'; title: string; content: string | null }
  // Image viewer events
  | { type: 'open_image'; src: string; name?: string }
  // PDF viewer events
  | { type: 'open_pdf'; src: string; name?: string }
  | { type: 'pdf_extract'; path: string }
  | { type: 'pdf_content'; path: string; text: string | null }
  // Desktop window management events (from executor agent)
  | { type: 'move_window'; app: string; x: number; y: number }
  | { type: 'resize_window'; app: string; width: number; height: number }
  // Finder events
  | { type: 'finder_navigate'; path: string }
  | { type: 'finder_open_file'; path: string }
  | { type: 'finder_select_file'; path: string }
  // Terminal events
  | { type: 'terminal_run'; command: string }
  // Window scroll events
  | { type: 'window_scroll'; app: string; direction: string; amount: number }
  // Human control summary — emitted when user releases control of the browser
  | { type: 'human_control_summary'; actions: HumanAction[]; screenshot: string; summary: string };

export interface HumanAction {
  type: 'click' | 'scroll' | 'type' | 'drag';
  x?: number;
  y?: number;
  deltaY?: number;
  text?: string;
  endX?: number;
  endY?: number;
  timestamp: number;
}

type DesktopListener = (event: DesktopEvent) => void;

class DesktopBus {
  private listeners: DesktopListener[] = [];

  emit(event: DesktopEvent) {
    this.listeners.forEach(l => l(event));
  }

  subscribe(l: DesktopListener): () => void {
    this.listeners.push(l);
    return () => {
      this.listeners = this.listeners.filter(x => x !== l);
    };
  }
}

export const desktopBus = new DesktopBus();
