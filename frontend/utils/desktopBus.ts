/**
 * desktopBus -- singleton event bus for controlling the virtual macOS desktop.
 *
 * Components subscribe to receive events; tools emit them.
 * This decouples the agent engine (which has no React context) from the desktop UI.
 */

/** Human control action recorded during manual takeover */
export type HumanAction =
  | { type: 'click'; x: number; y: number; timestamp: number }
  | { type: 'scroll'; deltaY: number; timestamp: number }
  | { type: 'drag'; x: number; y: number; endX: number; endY: number; timestamp: number }
  | { type: 'type'; text: string; timestamp: number };

export type DesktopEvent =
  // Window management
  | { type: 'open_window'; app: 'chrome' | 'finder' | 'terminal' }
  | { type: 'close_window'; app: string }
  | { type: 'focus_window'; app: string }
  | { type: 'move_window'; app: string; x: number; y: number }
  // Navigation
  | { type: 'navigate_chrome'; url: string }
  // Agent orchestration
  | { type: 'run_goal'; goal: string; workspaceId?: string }
  | { type: 'ask_user'; question: string; isClarification?: boolean; resolve?: (answer: string) => void }
  // Agent progress
  | { type: 'agent_status'; phase: string; message: string; stepIndex?: number; totalSteps?: number; screenshots?: string[] }
  | { type: 'agent_plan'; steps: Array<{ instruction: string; highStakes?: boolean }> }
  | { type: 'agent_step_start'; stepIndex: number; description: string; reasoning?: string }
  | { type: 'agent_step_done'; stepIndex: number; success: boolean; result?: string }
  | { type: 'agent_step_verify' }
  | { type: 'agent_iteration'; iteration: number; maxIterations?: number }
  | { type: 'agent_screenshot'; stepIndex: number; screenshot: string; iteration: number }
  | { type: 'agent_action_desc'; stepIndex: number; description: string; actionType: string; iteration: number; screenState?: string }
  // Cursor
  | { type: 'ai_cursor_move'; x: number; y: number; state: string }
  | { type: 'ai_cursor_click'; x: number; y: number }
  | { type: 'ai_cursor_state'; state: string }
  | { type: 'ai_cursor_scroll'; x: number; y: number; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'ai_cursor_drag_trail'; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'ai_cursor_focus_region'; x: number; y: number; w: number; h: number }
  | { type: 'chrome_window_bounds'; left: number; top: number; width: number; height: number; headerHeight: number; streamWidth: number; streamHeight: number }
  // File operations
  | { type: 'finder_navigate'; path: string }
  | { type: 'finder_open_file'; path: string }
  | { type: 'finder_select_file'; path: string }
  | { type: 'terminal_run'; command: string }
  // Notes
  | { type: 'note_write'; title: string; content: string }
  | { type: 'note_read'; title: string }
  | { type: 'note_content'; title: string; content: string | null }
  // PDF
  | { type: 'pdf_extract'; path: string }
  | { type: 'pdf_content'; path: string; text: string | null }
  // Desktop management
  | { type: 'resize_window'; app: string; width: number; height: number }
  | { type: 'window_scroll'; app: string; direction: string; amount: number }
  // AI action hint (used by ComputerDesktop cursor animation)
  | { type: 'ai_action'; action: string }
  // File viewer events
  | { type: 'open_image'; src: string }
  | { type: 'open_pdf'; path: string }
  // Terminal
  | { type: 'run_terminal'; command: string }
  // Human control
  | { type: 'human_control_summary'; actions: any[]; screenshot: string; summary: string }
  // Browser stream
  | { type: 'browser_stream'; sessionId: string; frame: string }
  | { type: 'browser_stream_stop' }
  // Navigation request from agent to app shell
  | { type: 'request_computer_view' }
  // Computer screenshot for mini-screen preview in AgentPanel
  | { type: 'computer_screenshot'; screenshot: string };

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
