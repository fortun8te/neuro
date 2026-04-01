/**
 * Neuro Network Modal — Top-to-bottom family tree
 *
 * Neuro at the top, children below. Starts collapsed so the initial view
 * is clean and readable. Click to expand/collapse. Scroll/pinch to zoom,
 * drag to pan.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import BlobAvatar from './BlobAvatar';
import { FONT_FAMILY } from '../constants/ui';

// ─── Layout constants ─────────────────────────────────────────────────────────
const NW  = 150;  // node width
const NH  = 42;   // node height
const HG  = 6;    // horizontal gap between siblings (tighter layout)
const VG  = 50;   // vertical gap between levels (more compact)
const PAD = 48;   // canvas padding

// ─── Categories ───────────────────────────────────────────────────────────────
type Cat = 'core' | 'chat' | 'research' | 'subagent' | 'tool' | 'infra' | 'computer' | 'memory';

const C: Record<Cat, string> = {
  core:     '#3b82f6',
  chat:     '#818cf8',
  research: '#0ea5e9',
  subagent: '#a78bfa',
  tool:     '#f59e0b',
  infra:    '#f87171',
  computer: '#fb923c',
  memory:   '#34d399',
};

interface N { id: string; p: string | null; label: string; sub?: string; cat: Cat; }

// ─── Node data — full input→output flow with routing/rerouting ───────────────
const NODES: N[] = [
  // ════════════════════════════════════════════════════════════════════════════
  //  MAIN PIPELINE: User Input → ... → Output  (top-to-bottom flow)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'input',      p: null,          label: 'User Input',          sub: 'message + files', cat: 'core'     },

  // ── Phase 1: Routing Layer (4 sequential classifiers) ───────────────────────
  { id: 'instant',    p: 'input',       label: 'Instant Path Check',  sub: 'time/weather regex',cat: 'chat'   },
  { id: 'widget',     p: 'instant',     label: 'Widget Response',     sub: '→ skip pipeline', cat: 'core'     },
  { id: 'simple_q',   p: 'instant',     label: 'Simple Q Classifier', sub: 'greeting regex',  cat: 'chat'    },
  { id: 'greet_out',  p: 'simple_q',    label: 'Fast Greeting',       sub: 'neuro or qwen:2b',cat: 'core'    },
  { id: 'identity_q', p: 'simple_q',    label: 'Identity Classifier', sub: '"who are you"',   cat: 'chat'    },
  { id: 'id_out',     p: 'identity_q',  label: 'Identity Handler',    sub: 'askNeuroIdentity',cat: 'core'    },
  { id: 'complex',    p: 'identity_q',  label: 'Complexity Detector', sub: 'research/analyze',cat: 'chat'    },

  // ── Phase 1B: Model Router ──────────────────────────────────────────────────
  { id: 'model_rt',   p: 'complex',     label: 'Model Router',        sub: 'length + keywords',cat: 'chat'   },
  { id: 'mr_tiny',    p: 'model_rt',    label: 'qwen3.5:0.8b',        sub: 'greetings <20ch', cat: 'infra'   },
  { id: 'mr_sm',      p: 'model_rt',    label: 'qwen3.5:4b',          sub: 'general <80ch',   cat: 'infra'   },
  { id: 'mr_lg',      p: 'model_rt',    label: 'qwen3.5:9b',          sub: 'research/code',   cat: 'infra'   },
  { id: 'mr_xl',      p: 'model_rt',    label: 'qwen3.5:27b',         sub: 'complex >300ch',  cat: 'infra'   },
  { id: 'mr_gpu',     p: 'model_rt',    label: 'nemotron-3-super:120b', sub: 'deep reasoning',  cat: 'infra'   },
  { id: 'mr_nemo_sec',p: 'mr_gpu',     label: 'Security Audit',        sub: '15K think tokens', cat: 'infra'   },
  { id: 'mr_nemo_arc',p: 'mr_gpu',     label: 'Architecture Analysis', sub: '12K think tokens', cat: 'infra'   },
  { id: 'mr_nemo_cod',p: 'mr_gpu',     label: 'Code Reasoning',        sub: '15K think tokens', cat: 'infra'   },
  { id: 'mr_nemo_val',p: 'mr_gpu',     label: 'Deep Validation',       sub: 'post-synthesis QA',cat: 'infra'   },

  // ── Phase 2: Tool Selection ─────────────────────────────────────────────────
  { id: 'tool_sel',   p: 'model_rt',    label: 'Tool Selection',      sub: '42 available',    cat: 'tool'    },
  { id: 'ts_fast',    p: 'tool_sel',    label: 'Quick Select',         sub: 'regex pre-filter',cat: 'tool'   },
  { id: 'ts_llm',     p: 'tool_sel',    label: 'LLM Router',          sub: 'qwen:2b fallback',cat: 'tool'   },
  { id: 'ts_prune',   p: 'tool_sel',    label: 'Prune Fallback',      sub: 'regex classify',  cat: 'tool'   },

  // ── Phase 3: Context Assembly ───────────────────────────────────────────────
  { id: 'soul',       p: 'tool_sel',    label: 'Soul Loader',         sub: 'neuroSoul.ts',   cat: 'memory'   },
  { id: 'soul_s',     p: 'soul',        label: 'SOUL.md',             sub: 'character/values',cat: 'memory'  },
  { id: 'soul_st',    p: 'soul',        label: 'STYLE.md',            sub: 'voice/syntax',   cat: 'memory'   },
  { id: 'soul_m',     p: 'soul',        label: 'MEMORY.md',           sub: 'persistent facts',cat: 'memory'  },
  { id: 'soul_log',   p: 'soul',        label: 'Daily Log',           sub: 'sessions/',      cat: 'memory'   },
  { id: 'ctx_b',      p: 'soul',        label: 'Context Builder',                            cat: 'chat'     },
  { id: 'hist',       p: 'ctx_b',       label: 'History Store',       sub: 'IndexedDB',      cat: 'chat'     },
  { id: 'tok',        p: 'ctx_b',       label: 'Token Counter',       sub: 'tokenCounter.ts',cat: 'chat'     },
  { id: 'ctx_tier',   p: 'ctx_b',       label: 'Context Tiers',       sub: 'contextTiers.ts',cat: 'chat'     },
  { id: 'sys_prompt',  p: 'ctx_b',      label: 'System Prompt Build', sub: 'soul+skills+tools',cat:'chat'    },

  // ── Phase 4: ReAct Agent Loop (step 0–200) ─────────────────────────────────
  { id: 'react',      p: 'sys_prompt',  label: 'ReAct Loop',          sub: 'gpt-oss-20b',     cat: 'chat'    },
  { id: 'think',      p: 'react',       label: 'Think Phase',         sub: 'stream to model', cat: 'chat'    },
  { id: 'parse',      p: 'think',       label: 'Parse Response',                              cat: 'chat'    },
  { id: 'tp_md',      p: 'parse',       label: 'Markdown Parser',     sub: '```tool blocks', cat: 'chat'     },
  { id: 'tp_xml',     p: 'parse',       label: 'XML Parser',          sub: '<tool_call>',    cat: 'chat'     },
  { id: 'tp_xlam',    p: 'parse',       label: 'xLAM Rescue',         sub: 'bad format fix', cat: 'chat'     },
  { id: 'no_tool',    p: 'parse',       label: 'Direct Response',     sub: 'no tool called', cat: 'core'     },

  // ── Phase 4B: Tool Execution (branch from parse) ───────────────────────────
  { id: 'tool_exec',  p: 'parse',       label: 'Tool Executor',       sub: '42 tools',       cat: 'tool'    },
  // Web tools
  { id: 'te_search',  p: 'tool_exec',   label: 'web_search',          sub: '→ SearXNG',      cat: 'tool'    },
  { id: 'te_browse',  p: 'tool_exec',   label: 'browse',              sub: '→ Wayfarer',     cat: 'tool'    },
  { id: 'te_multi',   p: 'tool_exec',   label: 'multi_browse',        sub: 'parallel fetch', cat: 'tool'    },
  // Code tools
  { id: 'te_code',    p: 'tool_exec',   label: 'run_code',            sub: '→ Sandbox Docker',cat:'tool'    },
  { id: 'te_shell',   p: 'tool_exec',   label: 'shell_exec',          sub: '→ /api/shell',   cat: 'tool'    },
  { id: 'te_file',    p: 'tool_exec',   label: 'file_read/write',     sub: '→ /api/file/*',  cat: 'tool'    },
  // Memory tools
  { id: 'te_mem',     p: 'tool_exec',   label: 'memory_store/search', sub: '→ neuroMemory',  cat: 'memory'  },
  // Media tools
  { id: 'te_img',     p: 'tool_exec',   label: 'image_analyze',       sub: '→ vision model', cat: 'tool'    },

  // ── REROUTE: use_computer → Computer Agent ─────────────────────────────────
  { id: 'te_comp',    p: 'tool_exec',   label: 'use_computer',        sub: '→ REROUTE',      cat: 'computer' },
  { id: 'ca_orch',    p: 'te_comp',     label: 'Orchestrator',        sub: 'orchestrator.ts',cat: 'computer' },
  { id: 'ca_amb',     p: 'ca_orch',     label: 'Ambiguity Classifier',sub: 'fast LLM check', cat: 'computer' },
  { id: 'ca_decomp',  p: 'ca_orch',     label: 'Goal Decomposer',     sub: '→ Phases',       cat: 'computer' },
  { id: 'ca_meml',    p: 'ca_orch',     label: 'Memory Recall',       sub: 'keyword search', cat: 'memory'   },
  { id: 'ca_plan',    p: 'ca_meml',     label: 'Planner',             sub: 'qwen3.5:9b',     cat: 'computer' },
  { id: 'ca_steps',   p: 'ca_plan',     label: 'Plan Steps',          sub: 'PlanStep[]',     cat: 'computer' },
  { id: 'ca_review',  p: 'ca_plan',     label: 'Phase Reviewer',      sub: 'done/retry?',    cat: 'computer' },
  { id: 'ca_exec',    p: 'ca_plan',     label: 'Executor Agent',      sub: 'gpt-oss-20b',     cat: 'computer' },
  { id: 'ca_dvl',     p: 'ca_exec',     label: 'Desktop Vision Loop', sub: 'html2canvas',    cat: 'computer' },
  { id: 'ca_wfs',     p: 'ca_exec',     label: 'Wayfarer Session',    sub: 'Playwright',     cat: 'computer' },
  { id: 'ca_bact',    p: 'ca_wfs',      label: 'Browser Actions',     sub: '30+ types',      cat: 'computer' },
  { id: 'ca_ax',      p: 'ca_wfs',      label: 'AX Tree Resolver',    sub: 'element lookup', cat: 'computer' },
  { id: 'ca_dbus',    p: 'ca_exec',     label: 'Desktop Bus',         sub: 'event emitter',  cat: 'computer' },
  { id: 'ca_vfs',     p: 'ca_exec',     label: 'Session File System', sub: 'VFS per session',cat: 'computer' },
  { id: 'ca_vis',     p: 'ca_exec',     label: 'Vision Agent',        sub: 'visionAgent.ts', cat: 'computer' },
  { id: 'ca_vis_ss',  p: 'ca_vis',      label: 'Desktop Capture',     sub: 'screenshot',     cat: 'computer' },
  { id: 'ca_vis_el',  p: 'ca_vis',      label: 'Element Locator',     sub: 'coords from vision',cat:'computer'},
  { id: 'ca_ret',     p: 'ca_exec',     label: '→ Return to Loop',    sub: 'results back',   cat: 'core'     },

  // ── REROUTE: spawn_agents → Subagent Pool ──────────────────────────────────
  { id: 'te_spawn',   p: 'tool_exec',   label: 'spawn_agents',        sub: '→ REROUTE',      cat: 'subagent' },
  { id: 'sub_pool',   p: 'te_spawn',    label: 'Pool Manager',        sub: '1-5 concurrent', cat: 'subagent' },
  { id: 'sub_retry',  p: 'sub_pool',    label: 'Retry Logic',         sub: '3x exp. backoff',cat: 'subagent' },
  { id: 'sub_abort',  p: 'sub_pool',    label: 'Abort Controller',    sub: 'signal threading',cat:'subagent' },
  { id: 'blackboard', p: 'sub_pool',    label: 'Blackboard',          sub: 'shared state',   cat: 'subagent' },
  { id: 'coord',      p: 'blackboard',  label: 'Agent Coordinator',                          cat: 'subagent' },
  { id: 'sub_roles',  p: 'coord',       label: 'Roles',               sub: '11 specialisations',cat:'subagent'},
  { id: 'sr_res',     p: 'sub_roles',   label: 'Researcher',          sub: 'qwen3.5:2b',    cat: 'subagent' },
  { id: 'sr_an',      p: 'sub_roles',   label: 'Analyzer',            sub: 'qwen3.5:4b',    cat: 'subagent' },
  { id: 'sr_sy',      p: 'sub_roles',   label: 'Synthesizer',         sub: 'qwen3.5:2b',    cat: 'subagent' },
  { id: 'sr_va',      p: 'sub_roles',   label: 'Validator',                                  cat: 'subagent' },
  { id: 'sr_st',      p: 'sub_roles',   label: 'Strategist',          sub: 'qwen3.5:4b',    cat: 'subagent' },
  { id: 'sr_co',      p: 'sub_roles',   label: 'Compressor',          sub: 'qwen3.5:0.8b',  cat: 'subagent' },
  { id: 'sr_ev',      p: 'sub_roles',   label: 'Evaluator',                                  cat: 'subagent' },
  { id: 'sr_deep',    p: 'sub_roles',   label: 'Deep Analyzer',       sub: 'nemotron 120B',  cat: 'subagent' },
  { id: 'sr_arch',    p: 'sub_roles',   label: 'Architect',           sub: 'nemotron 120B',  cat: 'subagent' },
  { id: 'sr_sec',     p: 'sub_roles',   label: 'Security Analyst',    sub: 'nemotron 120B',  cat: 'subagent' },
  { id: 'sr_c1',      p: 'sub_roles',   label: 'Retriever',           sub: 'Context-1 20B',  cat: 'research' },
  { id: 'c1_harness', p: 'sr_c1',      label: 'Harness',             sub: 'observe-reason-act',cat:'research'},
  { id: 'c1_search',  p: 'c1_harness', label: 'search_corpus',       sub: 'BM25 + dense',   cat: 'tool'    },
  { id: 'c1_grep',    p: 'c1_harness', label: 'grep_corpus',         sub: 'regex search',   cat: 'tool'    },
  { id: 'c1_read',    p: 'c1_harness', label: 'read_document',       sub: 'full doc + rerank',cat:'tool'    },
  { id: 'c1_prune',   p: 'c1_harness', label: 'prune_chunks',        sub: '32K budget mgmt',cat: 'tool'    },
  { id: 'sub_agg',    p: 'coord',       label: 'Aggregate Results',   sub: 'combine findings',cat:'subagent' },
  { id: 'sub_ret',    p: 'sub_agg',     label: '→ Return to Loop',    sub: 'results back',   cat: 'core'     },

  // ── Phase 4C: Result Injection ──────────────────────────────────────────────
  { id: 'result_inj', p: 'tool_exec',   label: 'Result Injector',     sub: 'add to context', cat: 'chat'     },
  { id: 'src_reg',    p: 'result_inj',  label: 'Source Registry',     sub: 'extract URLs',   cat: 'chat'     },
  { id: 'ctx_comp',   p: 'result_inj',  label: 'Context Compress',    sub: 'every ~10 steps',cat: 'chat'     },
  { id: 'loop_chk',   p: 'ctx_comp',    label: 'Loop Check',          sub: 'done/max/timeout',cat:'chat'     },

  // ── Phase 5: Response Generation ────────────────────────────────────────────
  { id: 'resp_gen',   p: 'loop_chk',    label: 'Response Stream',     sub: 'typewriter anim', cat: 'chat'    },
  { id: 'rewrite_chk',p: 'resp_gen',    label: 'Rewrite Check',       sub: 'identity Q?',    cat: 'chat'     },
  { id: 'neuro_rw',   p: 'rewrite_chk', label: 'Neuro Rewriter',      sub: 'neuro-1-b2-4b',  cat: 'core'     },
  { id: 'sem_verify', p: 'neuro_rw',    label: 'Semantic Verify',     sub: 'qwen:2b check',  cat: 'chat'     },
  { id: 'sanitize',   p: 'rewrite_chk', label: 'Sanitize + Sources',  sub: 'HTML escape',    cat: 'chat'     },

  // ── Phase 6: Output ─────────────────────────────────────────────────────────
  { id: 'output',     p: 'sanitize',    label: 'Output',              sub: '→ display to user',cat:'core'     },

  // ════════════════════════════════════════════════════════════════════════════
  //  INFRASTRUCTURE (shared services, shown below output)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'infra',      p: 'output',      label: 'Infrastructure',                             cat: 'infra'    },
  { id: 'ollama',     p: 'infra',       label: 'Ollama',              sub: ':11440 · 9 models',cat:'infra'   },
  { id: 'searxng',    p: 'ollama',      label: 'SearXNG',             sub: '8 instances · 59/min',cat:'infra'},
  { id: 'wayfsvc',    p: 'searxng',     label: 'Wayfarer Server',     sub: 'FastAPI :8889',  cat: 'infra'    },
  { id: 'wf_pw',      p: 'wayfsvc',     label: 'Playwright Engine',   sub: 'headless Chromium',cat:'infra'   },
  { id: 'wf_ext',     p: 'wayfsvc',     label: 'Article Extractor',   sub: 'pvlwebtools',    cat: 'infra'    },
  { id: 'wf_ax',      p: 'wayfsvc',     label: 'AX Tree API',         sub: 'accessibility',  cat: 'infra'    },
  { id: 'sandbox',    p: 'wayfsvc',     label: 'Sandbox',             sub: 'Docker :8080',   cat: 'infra'    },
  { id: 'c1svc',      p: 'sandbox',     label: 'Context-1 Harness',   sub: 'retrieval subagent',cat:'infra'   },
  { id: 'health',     p: 'c1svc',       label: 'Health Monitor',      sub: 'healthMonitor.ts',cat:'infra'    },
  { id: 'tokcnt',     p: 'health',      label: 'Token Tracker',       sub: 'tokenStats.ts',  cat: 'infra'    },
  { id: 'errrec',     p: 'tokcnt',      label: 'Error Recovery',      sub: 'errorRecovery.ts',cat:'infra'    },
];

// ─── Children map (built once) ────────────────────────────────────────────────
const CH = (() => {
  const m = new Map<string, string[]>();
  NODES.forEach(n => { if (!m.has(n.id)) m.set(n.id, []); });
  NODES.forEach(n => { if (n.p) m.get(n.p)?.push(n.id); });
  return m;
})();

function subtreeCount(id: string): number {
  const kids = CH.get(id) ?? [];
  if (!kids.length) return 0;
  return kids.length + kids.reduce((a, k) => a + subtreeCount(k), 0);
}

// ─── Top-down layout (root children stack vertically, rest horizontal) ────────
interface Pos { x: number; y: number; }

function computeLayout(collapsed: Set<string>) {
  // Max depth of a subtree (how many levels deep)
  function maxD(id: string): number {
    if (collapsed.has(id)) return 0;
    const kids = CH.get(id) ?? [];
    if (!kids.length) return 0;
    return 1 + Math.max(0, ...kids.map(k => maxD(k)));
  }

  // Subtree width = total horizontal pixels needed
  function subtW(id: string): number {
    if (collapsed.has(id)) return NW;
    const kids = CH.get(id) ?? [];
    if (!kids.length) return NW;
    // Root stacks children vertically → width = widest child
    if (id === 'input') return Math.max(NW, ...kids.map(k => subtW(k)));
    const sum = kids.reduce((a, k) => a + subtW(k), 0) + (kids.length - 1) * HG;
    return Math.max(NW, sum);
  }

  const pos = new Map<string, Pos>();

  function assign(id: string, left: number, depth: number) {
    const w = subtW(id);
    pos.set(id, {
      x: left + (w - NW) / 2,          // centre node in its band
      y: PAD + depth * (NH + VG),
    });
    if (collapsed.has(id)) return;
    const kids = CH.get(id) ?? [];

    if (id === 'input') {
      // Root children: stack vertically, each below the previous subtree
      let curDepth = depth + 1;
      kids.forEach(kid => {
        assign(kid, left, curDepth);
        curDepth += maxD(kid) + 1; // skip past this child's full subtree
      });
    } else {
      // Normal: horizontal siblings
      let cl = left;
      kids.forEach(kid => {
        assign(kid, cl, depth + 1);
        cl += subtW(kid) + HG;
      });
    }
  }

  assign('input', PAD, 0);

  let maxX = 0, maxY = 0;
  pos.forEach(p => { maxX = Math.max(maxX, p.x + NW + PAD); maxY = Math.max(maxY, p.y + NH + PAD); });
  return { pos, w: maxX, h: maxY };
}

// ─── Visible nodes/edges ──────────────────────────────────────────────────────
function getVisible(collapsed: Set<string>) {
  const vis = new Set<string>();
  function walk(id: string) { vis.add(id); if (!collapsed.has(id)) (CH.get(id) ?? []).forEach(walk); }
  walk('input');
  return vis;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props { isOpen: boolean; onClose: () => void; title?: string; }

// ─── Component ────────────────────────────────────────────────────────────────
export function NeuroNetworkModal({ isOpen, onClose, title = 'Neuro Network' }: Props) {
  const { isDarkMode } = useTheme();

  // Collapse heavy branches on open — main pipeline stays expanded, reroutes collapsed
  const INIT = useMemo(() => new Set(['te_comp','te_spawn','tool_exec','infra','model_rt','soul','parse']), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(INIT);

  const containerRef = useRef<HTMLDivElement>(null);
  // Use a ref for transform so wheel handler always sees fresh values without re-subscribing
  const xfRef = useRef({ tx: 0, ty: 0, scale: 1 });
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [xf, setXf] = useState({ tx: 0, ty: 0, scale: 1 });

  const layout = useMemo(() => computeLayout(collapsed), [collapsed]);
  const visible = useMemo(() => getVisible(collapsed), [collapsed]);
  const visNodes = useMemo(() => NODES.filter(n => visible.has(n.id)), [visible]);
  const visEdges = useMemo(() => NODES.filter(n => n.p && visible.has(n.id)), [visible]);

  // ── Fit to current visible layout ─────────────────────────────────────
  const fitView = useCallback((lyt = layout) => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const margin = 40;
    const s = Math.min((cw - margin * 2) / lyt.w, (ch - margin * 2) / lyt.h, 2);
    const next = { tx: (cw - lyt.w * s) / 2, ty: (ch - lyt.h * s) / 2, scale: s };
    xfRef.current = next;
    setXf(next);
  }, [layout]);

  useEffect(() => { if (isOpen) { const t = setTimeout(() => fitView(layout), 60); return () => clearTimeout(t); } }, [isOpen]); // eslint-disable-line

  // ESC
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── Drag ──────────────────────────────────────────────────────────────
  const drag = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null);
  const didMove = useRef(false);

  const onMD = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    drag.current = { ox: e.clientX, oy: e.clientY, tx: xfRef.current.tx, ty: xfRef.current.ty };
    didMove.current = false;
  }, []);

  const onMM = useCallback((e: React.MouseEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.ox, dy = e.clientY - drag.current.oy;
    if (!didMove.current && Math.abs(dx) + Math.abs(dy) > 4) didMove.current = true;
    const next = { ...xfRef.current, tx: drag.current.tx + dx, ty: drag.current.ty + dy };
    xfRef.current = next;
    setXf(next);
  }, []);

  const onMU = useCallback(() => { drag.current = null; didMove.current = false; }, []);

  // ── Wheel: ALL scroll/pinch = zoom centred on cursor, drag = pan ────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      // Skip if user is holding shift (system scroll)
      if (e.shiftKey && !e.ctrlKey) return;
      // Ignore micro-movements to prevent jitter
      if (Math.abs(e.deltaY) < 1.5) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { tx, ty, scale } = xfRef.current;

      // Zoom sensitivity adapts to input device:
      // - Trackpad pinch (ctrlKey): gentle but responsive zoom
      // - Trackpad scroll (no ctrlKey): very gentle per-tick zoom
      // - Mouse wheel (deltaMode=1): normalize line->px first
      let dy = e.deltaY; // scroll down = zoom out, scroll up = zoom in
      if (e.deltaMode === 1) dy *= 36; // line -> px for mouse wheel
      const sens = e.ctrlKey ? 0.92 : 0.995; // pinch gentler, scroll much gentler
      const factor = Math.pow(sens, dy);
      const ns = Math.max(0.15, Math.min(15, scale * factor)); // Prevent extreme zoom-out
      const r = ns / scale;
      const next = { tx: mx - (mx - tx) * r, ty: my - (my - ty) * r, scale: ns };
      xfRef.current = next;
      setXf(next);

      // Debounce any expensive recalculations after zoom settles
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      layoutDebounceRef.current = setTimeout(() => {
        layoutDebounceRef.current = null;
      }, 100);
    };
    el.addEventListener('wheel', handler, { passive: false });

    // ── Touch pinch-to-zoom ──
    let lastDist = 0;
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy2 = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.hypot(dx, dy2);
      }
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || lastDist === 0) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy2 = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy2);
      const pinchFactor = dist / lastDist;
      lastDist = dist;

      const rect = el.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const { tx, ty, scale } = xfRef.current;
      const ns = Math.max(0.04, Math.min(12, scale * pinchFactor));
      const r = ns / scale;
      const next = { tx: mx - (mx - tx) * r, ty: my - (my - ty) * r, scale: ns };
      xfRef.current = next;
      setXf(next);
    };
    const touchEnd = () => { lastDist = 0; };
    el.addEventListener('touchstart', touchStart, { passive: true });
    el.addEventListener('touchmove', touchMove, { passive: false });
    el.addEventListener('touchend', touchEnd, { passive: true });

    return () => {
      el.removeEventListener('wheel', handler);
      el.removeEventListener('touchstart', touchStart);
      el.removeEventListener('touchmove', touchMove);
      el.removeEventListener('touchend', touchEnd);
    };
  }, [isOpen]); // Re-run when modal opens so containerRef is populated

  // ── Toggle collapse ───────────────────────────────────────────────────
  const toggle = useCallback((id: string) => {
    if (didMove.current) return;
    if (!(CH.get(id) ?? []).length) return;
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Vertical bezier edge: parent bottom-center → child top-center ─────
  const edgePath = (pp: Pos, cp: Pos) => {
    const x1 = pp.x + NW / 2, y1 = pp.y + NH;
    const x2 = cp.x + NW / 2, y2 = cp.y;
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="nn-bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <motion.div
            key="nn-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={   { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 'min(98vw, 1600px)', height: 'min(95vh, 920px)',
              background: isDarkMode ? '#0c0c12' : '#f8f8f6',
              borderRadius: 18,
              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
              boxShadow: isDarkMode ? '0 48px 120px rgba(0,0,0,0.9)' : '0 20px 64px rgba(0,0,0,0.12)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 13px', flexShrink: 0,
              borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: FONT_FAMILY, letterSpacing: '-0.01em', color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.6)' }}>
                  {title}
                </span>
                <span style={{ fontSize: 9, fontFamily: FONT_FAMILY, padding: '1.5px 7px', borderRadius: 20, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)' }}>
                  {visNodes.length} / {NODES.length} nodes
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Btn onClick={() => fitView(layout)} dark={isDarkMode}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                  Fit
                </Btn>
                <Btn onClick={() => setCollapsed(new Set())} dark={isDarkMode}>Expand all</Btn>
                <Btn onClick={() => setCollapsed(new Set(INIT))} dark={isDarkMode}>Collapse</Btn>
                <div style={{ width: 1, height: 13, margin: '0 3px', background: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
                <button onClick={onClose} style={{ width: 25, height: 25, border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDarkMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.32)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>✕</button>
              </div>
            </div>

            {/* Canvas */}
            <div
              ref={containerRef}
              onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
              style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', cursor: drag.current ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none', background: isDarkMode ? '#0a0a10' : '#fafaf8' }}
            >
              {/* World */}
              <div style={{
                position: 'absolute', left: 0, top: 0,
                transform: `translate(${xf.tx}px,${xf.ty}px) scale(${xf.scale})`,
                transformOrigin: '0 0', willChange: 'transform',
              }}>
                {/* Edges */}
                <svg style={{ position: 'absolute', left: 0, top: 0, width: layout.w, height: layout.h, overflow: 'visible', pointerEvents: 'none', willChange: 'auto' }}>
                  <defs>
                    <style>{`
                      .edge-dash { animation: dashFlow 2s linear infinite; }
                      @keyframes dashFlow { to { stroke-dashoffset: -20; } }
                    `}</style>
                  </defs>
                  {visEdges.map(node => {
                    if (!node.p) return null;
                    const pp = layout.pos.get(node.p), cp = layout.pos.get(node.id);
                    if (!pp || !cp) return null;
                    return (
                      <path key={node.id} d={edgePath(pp, cp)} fill="none"
                        stroke={C[node.cat]} strokeOpacity={isDarkMode ? 0.12 : 0.14} strokeWidth={1.2}
                        strokeDasharray="6 4" className="edge-dash" />
                    );
                  })}
                </svg>

                {/* Nodes */}
                {visNodes.map(node => {
                  const p = layout.pos.get(node.id);
                  if (!p) return null;
                  const hex = C[node.cat];
                  const kids = CH.get(node.id) ?? [];
                  const hasKids = kids.length > 0;
                  const isCol = collapsed.has(node.id);
                  const isRoot = node.id === 'input';
                  const hidden = isCol ? subtreeCount(node.id) : 0;

                  return (
                    <div
                      key={node.id} data-node="1"
                      onClick={() => toggle(node.id)}
                      style={{
                        position: 'absolute', left: p.x, top: p.y, width: NW, height: NH,
                        display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px',
                        borderRadius: 8, cursor: hasKids ? 'pointer' : 'default', boxSizing: 'border-box',
                        background: isDarkMode
                          ? isRoot ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.035)'
                          : isRoot ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.028)',
                        border: isDarkMode
                          ? isRoot ? '1px solid rgba(59,130,246,0.42)' : '1px solid rgba(255,255,255,0.08)'
                          : isRoot ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(0,0,0,0.08)',
                        boxShadow: `0 0 8px ${hex}30`,
                        transition: 'background 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={e => {
                        if (!hasKids) return;
                        e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)';
                        e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.14)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isDarkMode
                          ? isRoot ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.035)'
                          : isRoot ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.028)';
                        e.currentTarget.style.borderColor = isDarkMode
                          ? isRoot ? 'rgba(59,130,246,0.42)' : 'rgba(255,255,255,0.08)'
                          : isRoot ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.08)';
                      }}
                    >
                      <div style={{ flexShrink: 0, opacity: 0.78 }}>
                        <BlobAvatar seed={node.id} color={hex} size={17} animated={false} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: isRoot ? 11 : 10, fontWeight: isRoot ? 700 : 500, fontFamily: FONT_FAMILY, color: isDarkMode ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.78)', lineHeight: 1.25, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {node.label}
                        </div>
                        {node.sub && (
                          <div style={{ fontSize: 8.5, marginTop: 1, fontFamily: FONT_FAMILY, color: isDarkMode ? 'rgba(255,255,255,0.27)' : 'rgba(0,0,0,0.32)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {node.sub}
                          </div>
                        )}
                      </div>
                      {hasKids && (
                        <div style={{
                          flexShrink: 0, fontSize: 8, fontFamily: FONT_FAMILY, fontWeight: 600,
                          lineHeight: 1, letterSpacing: '-0.01em', minWidth: 16, textAlign: 'center',
                          color: isCol ? hex : isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)',
                          background: isCol ? (isDarkMode ? `${hex}22` : `${hex}18`) : 'none',
                          border: isCol ? `1px solid ${hex}44` : 'none',
                          borderRadius: 4, padding: isCol ? '2px 4px' : '2px 2px',
                          transition: 'all 0.12s',
                        }}>
                          {isCol ? `+${hidden}` : '−'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* HUD overlays */}
              <div style={{ position: 'absolute', top: 9, right: 12, pointerEvents: 'none', fontSize: 8.5, fontFamily: FONT_FAMILY, color: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.16)' }}>
                scroll / pinch to zoom · drag to pan
              </div>
              <div style={{ position: 'absolute', bottom: 10, right: 13, pointerEvents: 'none', fontSize: 8.5, fontFamily: 'monospace', color: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)' }}>
                {Math.round(xf.scale * 100)}%
              </div>
              <div style={{ position: 'absolute', bottom: 10, left: 13, display: 'flex', flexWrap: 'wrap', gap: '5px 10px', maxWidth: '60%' }}>
                {(Object.entries(C) as [Cat, string][]).map(([cat, hex]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: hex, opacity: 0.5 }} />
                    <span style={{ fontSize: 8.5, fontFamily: FONT_FAMILY, fontWeight: 500, textTransform: 'capitalize', color: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.24)' }}>{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Btn({ onClick, dark, children }: { onClick: () => void; dark: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ height: 25, padding: '0 7px', borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', fontSize: 9.5, fontFamily: FONT_FAMILY, fontWeight: 500, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', gap: 4, transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {children}
    </button>
  );
}
