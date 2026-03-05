/**
 * Module-level token statistics tracker.
 * Lets any component subscribe to live token counts without prop drilling.
 * Updated by ollamaService on every chunk and on call completion.
 *
 * States:
 *   idle           → nothing running
 *   isModelLoading → startCall() fired, waiting for first token (cold start / VRAM loading)
 *   isThinking     → thinking tokens arriving (GLM-4.7, Qwen3 internal reasoning)
 *   isGenerating   → response tokens arriving (actual output)
 */

type Listener = () => void;

export interface TokenInfo {
  /** Tokens so far in the current call — thinking + response combined */
  liveTokens: number;
  /** Tokens/sec computed from Ollama's eval_duration (updated on call complete) */
  tokensPerSec: number;
  /** Accumulated total across all calls this session */
  sessionTotal: number;
  /** True between startCall() and first token — model is loading into VRAM */
  isModelLoading: boolean;
  /** True while thinking tokens are streaming (model reasoning, not yet outputting) */
  isThinking: boolean;
  /** True while response tokens are streaming (actual output) */
  isGenerating: boolean;
  /** Timestamp of startCall() — lets UI compute "loading for Xs" */
  callStartTime: number | null;
}

const state: TokenInfo = {
  liveTokens: 0,
  tokensPerSec: 0,
  sessionTotal: 0,
  isModelLoading: false,
  isThinking: false,
  isGenerating: false,
  callStartTime: null,
};

const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export const tokenTracker = {
  /** Read current stats (returns a snapshot) */
  get(): TokenInfo {
    return { ...state };
  },

  /** Subscribe to changes — returns an unsubscribe function */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Call at the start of each generateStream request */
  startCall() {
    state.liveTokens = 0;
    state.isModelLoading = true;
    state.isThinking = false;
    state.isGenerating = false;
    state.callStartTime = Date.now();
    notify();
  },

  /** Call for each thinking token (internal model reasoning) */
  tickThinking() {
    if (state.isModelLoading) {
      state.isModelLoading = false;
    }
    state.isThinking = true;
    state.liveTokens++;
    notify();
  },

  /** Call for each response token (actual output) */
  tick() {
    if (state.isModelLoading || state.isThinking) {
      state.isModelLoading = false;
      state.isThinking = false;
      state.isGenerating = true;
    }
    state.liveTokens++;
    notify();
  },

  /**
   * Call when the stream finishes.
   * eval_count    = total tokens generated (from Ollama done message)
   * eval_duration = nanoseconds spent generating (from Ollama done message)
   */
  endCall(evalCount?: number, evalDuration?: number) {
    const finalCount = evalCount ?? state.liveTokens;
    state.sessionTotal += finalCount;
    state.liveTokens = finalCount;
    if (evalCount && evalDuration && evalDuration > 0) {
      state.tokensPerSec = Math.round(evalCount / (evalDuration / 1e9));
    }
    state.isModelLoading = false;
    state.isThinking = false;
    state.isGenerating = false;
    notify();
  },

  /** Reset session total (e.g. on new campaign run) */
  resetSession() {
    state.liveTokens = 0;
    state.tokensPerSec = 0;
    state.sessionTotal = 0;
    state.isModelLoading = false;
    state.isThinking = false;
    state.isGenerating = false;
    state.callStartTime = null;
    notify();
  },
};
