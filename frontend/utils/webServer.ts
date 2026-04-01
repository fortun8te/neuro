/**
 * webServer.ts — WebSocket server for streaming agent output to web frontend.
 *
 * Protocol (Codex pattern):
 *   Server → Client: agent:delta, agent:thinking, tool:start, tool:result,
 *                    turn:complete, approval:request, session:state
 *   Client → Server: turn:start, turn:abort, approval:response
 */

import { WebSocketServer, WebSocket } from 'ws';
import { runAgentLoop } from './agentEngine';
import type { AgentEngineEvent } from './agentEngine';
import type { ReviewDecision } from './approvalStore';

// ── Protocol types ─────────────────────────────────────────────────────────

export interface ServerToClientMessage {
  type:
    | 'agent:delta'      // streaming token
    | 'agent:thinking'   // reasoning token
    | 'tool:start'       // tool execution started
    | 'tool:result'      // tool result returned
    | 'turn:complete'    // agent turn finished
    | 'turn:error'       // agent turn failed
    | 'approval:request' // user approval needed
    | 'session:state';   // session sync payload
  turnId?: string;
  sessionId?: string;
  delta?: string;
  tool?: string;
  output?: string;
  success?: boolean;
  approvalId?: string;
  approvalType?: 'patch' | 'exec';
  approvalData?: unknown;
  error?: string;
  state?: SessionState;
}

export interface ClientToServerMessage {
  type:
    | 'turn:start'         // send a new message
    | 'turn:abort'         // cancel current turn
    | 'approval:response'; // respond to approval request
  message?: string;
  sessionId?: string;
  turnId?: string;
  approvalId?: string;
  decision?: ReviewDecision;
}

// ── Session state ──────────────────────────────────────────────────────────

interface SessionState {
  sessionId: string;
  model: string;
  mode: string;
  tokens: number;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: number;
  lastActive: number;
}

// In-memory session store (survives reconnects within the same process)
const sessions = new Map<string, SessionState>();

function getOrCreateSession(sessionId: string): SessionState {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      model: 'qwen3.5:9b',
      mode: 'bypass',
      tokens: 0,
      history: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    sessions.set(sessionId, session);
  }
  session.lastActive = Date.now();
  return session;
}

// ── Pending approvals ───────────────────────────────────────────────────────

interface PendingApproval {
  id: string;
  resolve: (decision: ReviewDecision) => void;
}

// ── WebSocket server ────────────────────────────────────────────────────────

export function createAgentWebSocketServer(port = 8890): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`[webServer] WebSocket agent server listening on ws://localhost:${port}`);
  });

  wss.on('connection', (ws: WebSocket) => {
    const pendingApprovals = new Map<string, PendingApproval>();
    let currentController: AbortController | null = null;

    function send(msg: ServerToClientMessage) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    ws.on('message', async (data) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return; // ignore malformed messages
      }

      if (msg.type === 'turn:start') {
        const sessionId = msg.sessionId || 'default';
        const turnId = msg.turnId || `turn-${Date.now()}`;
        const session = getOrCreateSession(sessionId);
        const userMessage = msg.message || '';

        if (!userMessage.trim()) return;

        // Build context from history
        const context = session.history
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');

        session.history.push({ role: 'user', content: userMessage });

        // Abort any running turn
        currentController?.abort();
        currentController = new AbortController();

        let fullResponse = '';

        try {
          await runAgentLoop(userMessage, context, {
            signal: currentController.signal,
            skipSemanticRouting: true,
            onEvent: (event: AgentEngineEvent) => {
              switch (event.type) {
                case 'thinking_chunk':
                  if (event.response) {
                    send({ type: 'agent:thinking', turnId, delta: event.response });
                  }
                  break;
                case 'response_chunk':
                  if (event.response) {
                    fullResponse += event.response;
                    send({ type: 'agent:delta', turnId, delta: event.response });
                  }
                  break;
                case 'tool_start':
                  if (event.toolCall) {
                    send({ type: 'tool:start', turnId, tool: event.toolCall.name });
                  }
                  break;
                case 'tool_done':
                  if (event.toolCall) {
                    send({
                      type: 'tool:result',
                      turnId,
                      tool: event.toolCall.name,
                      output: String(event.toolCall.result?.output || '').substring(0, 2000),
                      success: event.toolCall.result?.success !== false,
                    });
                  }
                  break;
                case 'response_done':
                  if ((event as any).tokens) {
                    const t = (event as any).tokens;
                    session.tokens += (t.input || 0) + (t.output || 0);
                  }
                  if ((event as any).model) {
                    session.model = (event as any).model;
                  }
                  break;
                case 'done':
                  if (event.response) fullResponse = event.response;
                  break;
              }
            },
            onAskUser: async (question: string, opts: string[]) => {
              // Send approval request to web client
              const approvalId = `approval-${Date.now()}`;
              send({
                type: 'approval:request',
                turnId,
                approvalId,
                approvalType: 'exec',
                approvalData: { question, options: opts },
              });

              // Wait for client response
              return new Promise<string>((resolve) => {
                const timeout = setTimeout(() => {
                  pendingApprovals.delete(approvalId);
                  resolve(opts[0] || 'n'); // default deny on timeout
                }, 30_000);

                pendingApprovals.set(approvalId, {
                  id: approvalId,
                  resolve: (decision) => {
                    clearTimeout(timeout);
                    pendingApprovals.delete(approvalId);
                    resolve(decision === 'allow_once' || decision === 'allow_session' ? 'y' : 'n');
                  },
                });
              });
            },
          });

          if (fullResponse) {
            session.history.push({ role: 'assistant', content: fullResponse });
          }

          send({ type: 'turn:complete', turnId, sessionId });
          send({ type: 'session:state', sessionId, state: { ...session } });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg !== 'AbortError' && !errorMsg.includes('aborted')) {
            send({ type: 'turn:error', turnId, error: errorMsg });
          }
        }
      }

      if (msg.type === 'turn:abort') {
        currentController?.abort();
        currentController = null;
      }

      if (msg.type === 'approval:response') {
        const { approvalId, decision } = msg;
        if (approvalId && decision) {
          const pending = pendingApprovals.get(approvalId);
          pending?.resolve(decision);
        }
      }
    });

    ws.on('close', () => {
      currentController?.abort();
    });
  });

  wss.on('error', (err) => {
    console.error('[webServer] WebSocket server error:', err);
  });

  return wss;
}

// ── Session utilities ────────────────────────────────────────────────────────

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

// ── Auto-start if run directly ────────────────────────────────────────────────

const PORT = parseInt(process.env.VITE_WS_PORT || '8890', 10);
export let wssInstance: WebSocketServer | null = null;

export function startWebSocketServer(port = PORT): WebSocketServer {
  if (wssInstance) return wssInstance;
  wssInstance = createAgentWebSocketServer(port);
  return wssInstance;
}

export function stopWebSocketServer(): void {
  wssInstance?.close();
  wssInstance = null;
}
