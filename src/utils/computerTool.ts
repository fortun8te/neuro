/**
 * computerTool.ts -- Clean external interface for invoking the computer agent.
 *
 * This is the interface that external agents (Claude, OpenClaw, pipeline stages)
 * call to run a goal on the computer. Single function: give it a goal, get back
 * an answer + files + screenshots.
 *
 * NOTE: The full orchestrator pipeline runs client-side (React frontend).
 * The wayfarer_server.py /api/task endpoint is a simplified server-side version.
 * For the full pipeline (planning + vision + executor + file ops), use this module.
 */

import type { Phase } from './computerAgent/types';

// ── Public types ──────────────────────────────────────────────────────────

export interface ComputerToolRequest {
  goal: string;                    // "Research vitamin C competitors and save findings"
  sessionId?: string;              // Reuse existing agent session
  computerId?: string;             // Reuse existing computer
  maxPhases?: number;              // Max decomposition depth (default 5)
  timeout?: number;                // Max seconds (default 300)
  onProgress?: (event: ComputerToolEvent) => void;  // Progress callback
}

export interface ComputerToolResult {
  success: boolean;
  answer: string;                  // Final synthesized answer
  steps: Array<{
    instruction: string;
    result: string;
    screenshots: string[];         // base64 screenshots
  }>;
  files: Array<{                   // Files created during execution
    path: string;
    name: string;
    type: string;
  }>;
  elapsed: number;
  sessionId: string;
  computerId: string;
}

export type ComputerToolEvent =
  | { type: 'phase_start'; phase: string; index: number; total: number }
  | { type: 'step_start'; step: string; index: number }
  | { type: 'step_done'; step: string; result: string }
  | { type: 'screenshot'; data: string }
  | { type: 'action'; description: string }
  | { type: 'file_created'; path: string; name: string }
  | { type: 'answer'; text: string }
  | { type: 'error'; message: string };

// ── Implementation ────────────────────────────────────────────────────────

export async function runComputerTool(request: ComputerToolRequest): Promise<ComputerToolResult> {
  const startTime = Date.now();
  const { goal, timeout = 300, onProgress } = request;

  // Generate session/computer IDs (or reuse provided ones)
  const sessionId = request.sessionId || `tool-${Date.now().toString(36)}`;
  const computerId = request.computerId || `comp-${Date.now().toString(36)}`;

  // Track collected data
  const collectedSteps: ComputerToolResult['steps'] = [];
  const collectedFiles: ComputerToolResult['files'] = [];
  const collectedScreenshots: string[] = [];
  let currentPhaseIndex = 0;
  let totalPhases = 1;

  // Initialize VFS session
  const { vfs } = await import('./sessionFileSystem');
  vfs.initComputer(sessionId, computerId);

  // Track files created before the run to detect new ones
  const preExistingFiles = new Set(
    vfs.getSessionFiles(sessionId).map(f => f.path),
  );

  // Set up timeout
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeout * 1000);

  // Subscribe to desktopBus for screenshots and status
  const { desktopBus } = await import('./desktopBus');
  const unsubBus = desktopBus.subscribe((event) => {
    if (event.type === 'agent_screenshot' && event.screenshot) {
      collectedScreenshots.push(event.screenshot);
      onProgress?.({ type: 'screenshot', data: event.screenshot });
    }
    if (event.type === 'agent_status') {
      if (event.phase === 'executing') {
        onProgress?.({ type: 'action', description: event.message });
      }
      if (event.phase === 'error') {
        onProgress?.({ type: 'error', message: event.message });
      }
    }
    if (event.type === 'agent_step_start') {
      onProgress?.({ type: 'step_start', step: event.instruction, index: event.stepIndex });
    }
    if (event.type === 'agent_step_done') {
      const step = {
        instruction: '',
        result: event.result,
        screenshots: [...collectedScreenshots],
      };
      collectedSteps.push(step);
      collectedScreenshots.length = 0;
      onProgress?.({ type: 'step_done', step: event.result, result: event.result });
    }
    if (event.type === 'agent_action_desc') {
      onProgress?.({ type: 'action', description: event.description });
    }
  });

  let answer = '';

  try {
    // We need a desktop element for the orchestrator. In a headless/tool context,
    // create a minimal hidden container if none is available.
    let desktopEl = document.querySelector<HTMLElement>('[data-desktop-root]');
    if (!desktopEl) {
      desktopEl = document.createElement('div');
      desktopEl.setAttribute('data-desktop-root', '');
      desktopEl.style.position = 'fixed';
      desktopEl.style.width = '1280px';
      desktopEl.style.height = '800px';
      desktopEl.style.left = '-9999px';
      desktopEl.style.top = '0';
      document.body.appendChild(desktopEl);
    }

    // Import and run the existing orchestrator
    const { runComputerAgent } = await import('./computerAgent/orchestrator');

    // Wire phase tracking via onChunk parsing
    const phaseTracker = (chunk: string) => {
      // The orchestrator emits phase info in its chunks
      const phaseMatch = chunk.match(/Phase (\d+)\/(\d+)/);
      if (phaseMatch) {
        currentPhaseIndex = parseInt(phaseMatch[1], 10) - 1;
        totalPhases = parseInt(phaseMatch[2], 10);
        onProgress?.({
          type: 'phase_start',
          phase: chunk.trim(),
          index: currentPhaseIndex,
          total: totalPhases,
        });
      }
    };

    answer = await runComputerAgent(goal, desktopEl, {
      signal: controller.signal,
      onStatus: (msg) => {
        onProgress?.({ type: 'action', description: msg });
      },
      onChunk: phaseTracker,
      onScreenshot: (base64) => {
        // Screenshots already captured via desktopBus subscription
        void base64;
      },
    });

    onProgress?.({ type: 'answer', text: answer });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    answer = `Error: ${errMsg}`;
    onProgress?.({ type: 'error', message: errMsg });
  } finally {
    clearTimeout(timeoutHandle);
    unsubBus();
  }

  // Collect newly created files
  const postFiles = vfs.getSessionFiles(sessionId);
  for (const f of postFiles) {
    if (!preExistingFiles.has(f.path)) {
      collectedFiles.push({
        path: f.path,
        name: f.name,
        type: f.mimeType || 'application/octet-stream',
      });
      onProgress?.({ type: 'file_created', path: f.path, name: f.name });
    }
  }

  // Save activity log
  vfs.saveActivity(sessionId, computerId, goal, JSON.stringify({
    goal,
    answer,
    steps: collectedSteps.length,
    files: collectedFiles.length,
    elapsed: Date.now() - startTime,
  }));

  return {
    success: !answer.startsWith('Error:'),
    answer,
    steps: collectedSteps,
    files: collectedFiles,
    elapsed: Date.now() - startTime,
    sessionId,
    computerId,
  };
}

// Re-export types for convenience
export type { Phase };
