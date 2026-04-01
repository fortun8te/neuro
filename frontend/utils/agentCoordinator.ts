/**
 * Agent Coordinator — Master/worker coordination for multi-agent system.
 *
 * The master agent spawns workers via spawnWorker(). Each worker is a
 * runPlanAct() call that runs a browser automation goal. Workers post
 * their findings to the shared Blackboard as they complete steps.
 *
 * Workers can run on different Ollama machines (machineId selects the
 * base URL). The master reads the blackboard to stay informed.
 *
 * Keep it simple: workers are fire-and-forget runPlanAct calls with
 * results posted to the blackboard. No complex agent-to-agent messaging.
 */

import { runPlanAct, type PlanActCallbacks } from './planActAgent';
import { getPlannerModel, getExecutorModel } from './modelConfig';
import { Blackboard, blackboard } from './blackboard';

// ── Types ──

export interface WorkerAgent {
  id: string;
  machineId: string;
  goal: string;
  status: 'running' | 'done' | 'failed' | 'paused';
  startedAt: number;
  completedAt?: number;
  findings: string[];
  /** Pending messages from master to this worker (consumed on next step). */
  pendingMessages: string[];
  /** AbortController for this worker. */
  abortController: AbortController;
}

export type CoordinatorEventType =
  | 'worker_spawned'
  | 'worker_progress'
  | 'worker_done'
  | 'worker_failed'
  | 'worker_killed'
  | 'finding_posted';

export interface CoordinatorEvent {
  type: CoordinatorEventType;
  workerId: string;
  worker?: WorkerAgent;
  finding?: string;
  timestamp: number;
}

export type CoordinatorListener = (event: CoordinatorEvent) => void;

// ── Coordinator ──

export class AgentCoordinator {
  private workers: Map<string, WorkerAgent> = new Map();
  private listeners: Map<CoordinatorEventType, Set<CoordinatorListener>> = new Map();
  private bb: Blackboard;
  private idCounter = 0;

  constructor(bb?: Blackboard) {
    this.bb = bb || blackboard;
  }

  /**
   * Spawn a worker agent with a goal.
   * The worker runs runPlanAct in the background and posts findings to the blackboard.
   *
   * @param machineId - Identifier for the machine/Ollama instance (for future multi-machine)
   * @param goal - What the worker should accomplish
   * @param signal - Optional parent abort signal (killing parent kills worker too)
   * @returns workerId
   */
  spawnWorker(machineId: string, goal: string, signal?: AbortSignal): string {
    const workerId = `worker-${++this.idCounter}-${Date.now().toString(36)}`;
    const abortController = new AbortController();

    // If parent signal aborts, abort this worker too
    if (signal) {
      const onParentAbort = () => abortController.abort();
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    const worker: WorkerAgent = {
      id: workerId,
      machineId,
      goal,
      status: 'running',
      startedAt: Date.now(),
      findings: [],
      pendingMessages: [],
      abortController,
    };

    this.workers.set(workerId, worker);
    this.bb.post('worker_spawned', `Goal: ${goal}`, workerId, 'status');
    this.emit('worker_spawned', workerId, worker);

    // Run the worker in background (non-blocking)
    this.runWorker(worker).catch(() => {
      // Error handling is inside runWorker; this catch prevents unhandled rejection
    });

    return workerId;
  }

  /** Get status of all workers. */
  checkWorkers(): WorkerAgent[] {
    return Array.from(this.workers.values()).map(w => ({
      ...w,
      // Don't expose the AbortController to callers
      abortController: w.abortController,
    }));
  }

  /** Get a single worker by ID. */
  getWorker(workerId: string): WorkerAgent | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Send a follow-up instruction to a running worker.
   * The message is queued and injected into the worker's next planning cycle.
   */
  sendToWorker(workerId: string, message: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    if (worker.status !== 'running') return;

    worker.pendingMessages.push(message);
    this.bb.post('instruction', message, `master→${workerId}`, 'status');
  }

  /** Abort a specific worker. */
  killWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.abortController.abort();
    worker.status = 'failed';
    worker.completedAt = Date.now();
    this.bb.post('worker_killed', `Killed by master`, workerId, 'status');
    this.emit('worker_killed', workerId, worker);
  }

  /** Abort all running workers. */
  killAll(): void {
    for (const [id, worker] of this.workers) {
      if (worker.status === 'running') {
        worker.abortController.abort();
        worker.status = 'failed';
        worker.completedAt = Date.now();
        this.bb.post('worker_killed', 'Kill all', id, 'status');
        this.emit('worker_killed', id, worker);
      }
    }
  }

  /** Get the shared blackboard. */
  getBlackboard(): Blackboard {
    return this.bb;
  }

  /** Clear all workers and reset. */
  reset(): void {
    this.killAll();
    this.workers.clear();
    this.idCounter = 0;
  }

  // ── Event system ──

  on(event: CoordinatorEventType, callback: CoordinatorListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: CoordinatorEventType, callback: CoordinatorListener): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(type: CoordinatorEventType, workerId: string, worker?: WorkerAgent, finding?: string): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    const event: CoordinatorEvent = { type, workerId, worker, finding, timestamp: Date.now() };
    for (const cb of listeners) {
      try { cb(event); } catch { /* listener error */ }
    }
  }

  // ── Internal: run a worker ──

  private async runWorker(worker: WorkerAgent): Promise<void> {
    const { id: workerId, goal, abortController } = worker;
    const signal = abortController.signal;

    // Build callbacks that post to the blackboard
    const callbacks: PlanActCallbacks = {
      onPlan: (plan) => {
        const stepList = plan.steps.map(s => s.description).join(', ');
        this.bb.post('plan', `Steps: ${stepList}`, workerId, 'status');
        this.emit('worker_progress', workerId, worker);
      },

      onAction: (action, result) => {
        // Post significant action results as findings
        if (action.action === 'navigate' || action.action === 'done') {
          const finding = `[${action.action}] ${result}`;
          worker.findings.push(finding);
          this.bb.post(action.action, result, workerId, 'finding');
          this.emit('finding_posted', workerId, worker, finding);
        }
      },

      onStepComplete: (step) => {
        this.bb.post('step_complete', `${step.description} → ${step.status}`, workerId, 'status');
        this.emit('worker_progress', workerId, worker);
      },

      onDone: (summary) => {
        worker.status = 'done';
        worker.completedAt = Date.now();
        worker.findings.push(summary);
        this.bb.post('completed', summary, workerId, 'finding');
        this.emit('worker_done', workerId, worker, summary);
      },

      onError: (error) => {
        worker.status = 'failed';
        worker.completedAt = Date.now();
        this.bb.post('error', error, workerId, 'error');
        this.emit('worker_failed', workerId, worker, error);
      },
    };

    try {
      await runPlanAct(
        goal,
        getPlannerModel(),
        getExecutorModel(),
        callbacks,
        30,     // maxActions
        signal,
      );

      // If runPlanAct returned without calling onDone/onError, mark as done
      if (worker.status === 'running') {
        worker.status = 'done';
        worker.completedAt = Date.now();
        this.bb.post('completed', `Worker finished: ${goal}`, workerId, 'finding');
        this.emit('worker_done', workerId, worker);
      }
    } catch (err) {
      if (signal.aborted) {
        // Already handled by killWorker
        return;
      }
      worker.status = 'failed';
      worker.completedAt = Date.now();
      const errMsg = err instanceof Error ? err.message : String(err);
      this.bb.post('error', errMsg, workerId, 'error');
      this.emit('worker_failed', workerId, worker, errMsg);
    }
  }
}

// ── Singleton ──

export const agentCoordinator = new AgentCoordinator();
