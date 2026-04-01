/**
 * computerAgent/types.ts — shared data contracts for the computer agent system.
 */

// Step from planner
export interface PlanStep {
  id: string;
  instruction: string;      // "Click the Chrome icon in the dock"
  expectedState: string;    // "Chrome window is open in the desktop area"
  highStakes: boolean;      // true = pause and ask user before executing
  context: string;          // why this step matters to the overall goal
}

// Execution context — where the action targets
export type ExecutionContext = 'desktop' | 'browser';
// desktop = DOM event dispatch on the React UI
// browser = Playwright via Wayfarer session

// Action the executor decides
export interface ExecutorAction {
  type:
    | 'click'
    | 'type'
    | 'scroll'
    | 'press'
    | 'wait'
    | 'done'
    | 'fail'
    | 'browser_navigate'
    | 'browser_click'
    | 'browser_type'
    | 'browser_scroll'
    | 'browser_press'
    | 'browser_screenshot'
    | 'browser_shortcut'
    | 'browser_drag'
    | 'browser_select'
    | 'browser_back'
    | 'browser_reload'
    | 'browser_eval'
    | 'browser_extract_text'
    | 'browser_hover'
    // Element-index based actions (browser-use style targeting)
    | 'click_element'
    | 'type_element'
    | 'select_element'
    // Desktop / window management
    | 'desktop_open_app'
    | 'desktop_close_window'
    | 'desktop_drag_window'
    | 'desktop_resize_window'
    | 'desktop_focus_window'
    | 'desktop_scroll'
    // Finder interactions
    | 'finder_navigate'
    | 'finder_select_file'
    | 'finder_open_file'
    // Terminal interactions
    | 'terminal_run'
    | 'terminal_read'
    // File operations
    | 'file_create'
    | 'file_read'
    | 'file_write'
    | 'file_delete'
    | 'file_rename'
    | 'file_move'
    | 'file_download'
    | 'file_list';
  index?: number;     // for click_element / type_element / select_element: element index from getElements
  x?: number;
  y?: number;
  startX?: number;    // for browser_drag
  startY?: number;    // for browser_drag
  endX?: number;      // for browser_drag
  endY?: number;      // for browser_drag
  text?: string;
  key?: string;
  keys?: string;      // for browser_shortcut (e.g. "Control+t", "Escape")
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;  // pixels to scroll (default 300)
  clear?: boolean;    // for browser_type: clear existing text before typing
  url?: string;       // for browser_navigate
  selector?: string;  // CSS selector for browser_type / browser_click / browser_select target
  value?: string;     // for browser_select: option value to select
  optionText?: string; // for browser_select: option visible text to select
  script?: string;    // for browser_eval: JS to evaluate
  targetText?: string; // for browser_click: find element by visible text before using coords
  result?: string;    // for done action: description of what was achieved
  screenState?: string; // executor's brief description of current screen state (ME-2)
  // Desktop action fields
  app?: 'chrome' | 'finder' | 'terminal';  // target app for desktop_* actions
  toX?: number;       // for desktop_drag_window: target x position
  toY?: number;       // for desktop_drag_window: target y position
  width?: number;     // for desktop_resize_window
  height?: number;    // for desktop_resize_window
  path?: string;      // for finder_navigate / finder_select_file / finder_open_file
  command?: string;   // for terminal_run
  amount?: number;    // for desktop_scroll: pixels to scroll
  // File operation fields
  content?: string;   // file content for file_create / file_write
  name?: string;      // file name for file_create
  newName?: string;   // new name for file_rename
  destPath?: string;  // destination path for file_move / file_download
  reasoning: string;
  selfCheck: string;  // executor's assessment of whether this action will work
}

// Vision response for element location
export interface ElementLocation {
  found: boolean;
  x?: number;
  y?: number;
  elementDescription: string;
  confidence: 'high' | 'medium' | 'low';
}

// Vision response for state verification
export interface StateVerification {
  matches: boolean;
  confidence: 'high' | 'medium' | 'low';
  currentStateDescription: string;
  discrepancy?: string;  // what differs from expectedState
  screenshot: string;    // base64
}

// Result from one executor step
export interface StepResult {
  stepId: string;
  success: boolean;
  result: string;
  screenshot: string;
  currentStateDescription: string;
  actionsTaken: string[];
  failureReason?: string;
  failureMode?: 'element_not_found' | 'page_error' | 'timeout' | 'interaction_blocked' | 'executor_gave_up';
}

export interface Phase {
  id: string;
  name: string;
  subGoal: string;
  /** Phase type — determines executor maxIterations ceiling */
  phaseType?: 'action' | 'browse' | 'summarize' | 'research';
}

// Goal ambiguity analysis
export interface GoalAnalysis {
  clarity: 'clear' | 'ambiguous' | 'complex';
  interpretation: string;   // best guess at what the user wants
  missingInfo?: string;     // what is unclear (if ambiguous)
  clarifyQuestion?: string; // smart question to ask the user (if ambiguous)
  confidence: number;       // 0-1
}

// Memory entry
export interface MemoryEntry {
  id: string;
  goal: string;
  steps: string[];
  outcome: 'success' | 'failure';
  timestamp: number;
  tags: string[];
}
