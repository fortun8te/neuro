/**
 * AgentPanel -- Manus-style autonomous agent UI
 *
 * Chat interface with grouped step cards, action pills, morphing thinking
 * animation, sticky progress bar, browser preview thumbnails,
 * and a left conversation sidebar with full chat history persistence.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { TextShimmer } from './TextShimmer';
import { runAgentLoop } from '../utils/agentEngine';
import type { TaskProgress, AgentEngineEvent, ToolCall, CampaignContextData, SubagentEventData } from '../utils/agentEngine';
import { useCampaign } from '../context/CampaignContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { FONT_FAMILY } from '../constants/ui';
import { getMemories, deleteMemory } from '../utils/memoryStore';
import { getUserMemories, touchUserProfile } from '../utils/userProfile';
import { getModelForStage } from '../utils/modelConfig';
// Workspace imports removed — use sessionFileSystem instead
import {
  saveConversation,
  loadConversation,
  deleteConversation,
  listConversations,
  type Conversation,
  type StoredMessageBlock,
  type GroupedConversations,
  shouldRetitle,
  generateConversationTitle,
} from '../utils/chatHistory';
import VoiceInput from './VoiceInput';
import { ResponseStream } from './ResponseStream';
import { LiquidGlass } from './LiquidGlass';
import BlobAvatar, { getAgentColor } from './BlobAvatar';
import { getUserAvatarSeed, getUserAvatarColor } from './UserAvatar';
import { OrbitalLoader } from './OrbitalLoader';
import { renderWorkspaceResult } from './FilesystemTree';
import { AgentUIWrapper } from './AgentUIWrapper';
import type { StepConfig } from './AgentUIWrapper';
import { NeuroNetworkModal } from './NeuroNetworkModal';
import { ThinkingModal } from './ThinkingModal';
import { PermissionApprovalBanner } from './PermissionApprovalBanner';
import { ExecutionPlanModal, type ExecutionPlanItem } from './ExecutionPlanModal';
import { PermissionModeDropdown } from './PermissionModeDropdown';
import { FaviconCircle } from './FaviconCircle';
import { CanvasPanel, type CanvasContent } from './Canvas';
import { useCanvasState, createCanvasContent, shouldOpenCanvas, shouldShowOpenCanvasButton } from '../hooks/useCanvasState';
import { FinderWindow } from './FinderWindow';
import { saveAs } from 'file-saver';
import type { Campaign, Cycle } from '../types';
import { parseResumeCommand, getLatestResumableCheckpoint, autoSaveStopCheckpoint } from '../utils/agentResume'; // Phase 2: continue command
import { SourcesList } from './SourcesList';
import { SourceFooter } from './SourceFooter';
import { useSourcesFromMessage } from '../hooks/useSourcesFromMessage';
import { removeUrlsFromText } from '../utils/sourceExtractor';

/** Wrapper component so useSourcesFromMessage is called at component level (not inside .map()) */
function BlockSources({ content, findings, isDarkMode }: { content?: string; findings?: any; isDarkMode: boolean }) {
  const { sources, hasSources } = useSourcesFromMessage({ messageText: content, findings });
  if (!hasSources) return null;
  return (
    <SourceFooter sources={sources} isDarkMode={isDarkMode} variant="inline" />
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

/** An image or file pasted/dropped into the chat input */
interface ChatAttachment {
  id: string;
  dataUrl: string;       // base64 data URL for images, or empty for text files
  name: string;
  type: 'image' | 'text';
  textContent?: string;  // raw text for text-type attachments
}

const IMAGE_ACCEPT = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT_ACCEPT = ['application/pdf', 'text/plain', 'text/markdown', 'application/json'];

interface ActionPill {
  id: string;
  toolName: string;
  argsPreview: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  modelInfo?: string; // e.g. "using Qwen 3.5:4b" or "using Chroma DB Context-1"
  progress?: { percent: number; message?: string }; // Progress updates for long-running tools
}

type StepEntry =
  | { type: 'text'; content: string }
  | { type: 'action'; pill: ActionPill };

/** Live state for a single spawned subagent */
interface SubagentInfo {
  agentId: string;
  role: string;
  task: string;
  status: 'spawning' | 'running' | 'complete' | 'failed';
  tokens: number;
  result?: string;
  confidence?: number;
  error?: string;
  sources?: Array<{ title: string; url: string; domain: string; snippet?: string }>;
}

/** Phase 1 Feature: Queue progress display */
interface SubagentQueueProgressInfo {
  poolId: string;
  running: number;
  queued: number;
  completed: number;
  failed: number;
  total: number;
  percentComplete: number;
}

interface StepCard {
  id: string;
  title: string;
  /** @deprecated kept for back-compat with stored conversations */
  thinkingText: string;
  isThinking: boolean;
  /** @deprecated kept for back-compat with stored conversations */
  actions: ActionPill[];
  /** Interleaved text + action entries rendered in order */
  entries: StepEntry[];
  status: 'active' | 'done' | 'pending';
  browserUrl?: string;
  browserScreenshot?: string;
  /** Contextual status text based on current activity */
  activityLabel?: string;
  /** Active subagents spawned from this step */
  subagents?: SubagentInfo[];
}

function getActivityLabel(toolName?: string): string {
  if (!toolName) return 'Thinking';
  switch (toolName) {
    case 'browse': return 'Viewing browser';
    case 'analyze_page': return 'Analyzing page';
    case 'scrape_page': return 'Reading page';
    case 'web_search': return 'Searching the web';
    case 'shell_exec': return 'Running command';
    case 'run_code': return 'Executing code';
    case 'file_read': return 'Reading file';
    case 'file_write': return 'Writing file';
    case 'file_find': return 'Finding files';
    case 'use_computer': return 'Using computer';
    case 'think': return 'Reasoning';
    case 'remember': return 'Remembering';
    case 'wait': return 'Waiting';
    case 'spawn_agents': return 'Spawning agents';
    default: return 'Working';
  }
}

/** Format token counts: under 1000 as-is, 1k-9.9k with 1 decimal, 10k+ with 0 decimals */
function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

/** Format duration: <60s → "12s", 60s+ → "1m 4s", 60min+ → "1h 3m" */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface MessageBlock {
  id: string;
  timestamp: number;
  type: 'user' | 'agent' | 'upload';
  content: string;
  steps?: StepCard[];
  uploadFilename?: string;
  uploadSize?: string;
  /** Attached images/files sent with the message */
  attachments?: ChatAttachment[];
  /** Timing + tokens for agent messages */
  startedAt?: number;
  completedAt?: number;
  tokenCount?: number;
  /** Neuro rewrite data — original vs rewritten version */
  neuroRewrite?: {
    original: string;
    rewritten: string;
    model: string; // e.g. "NEURO-1-B2-4B"
    verification?: {
      passed: boolean;
      durationMs: number;
      model: string; // e.g. "qwen3.5:2b"
    };
  };
  /** Research findings or research data (for source extraction) */
  researchFindings?: any;
}

type AgentStatus = 'idle' | 'routing' | 'thinking' | 'streaming' | 'error';

/** Human-readable status text for the current activity */
function statusLabel(status: AgentStatus, toolName?: string): string {
  if (status === 'idle') return '';
  if (status === 'routing') return 'Routing';
  if (status === 'error') return 'Error';
  if (toolName) return getActivityLabel(toolName);
  if (status === 'thinking') return 'Thinking';
  return 'Working';
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}


function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}



function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FileDocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function SidebarToggleIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <polyline points="14 9 17 12 14 15" />
        </>
      )}
    </svg>
  );
}




function actionLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'web_search': return `Searching: "${String(args.query || '').slice(0, 60)}"`;
    case 'browse': return `Browsing ${String(args.url || '').slice(0, 50)}`;
    case 'scrape_page': return `Scraping ${String(args.url || '').slice(0, 50)}`;
    case 'analyze_page': return `Analyzing ${String(args.url || '').slice(0, 50)}`;
    case 'shell_exec': return `Running: ${String(args.command || '').slice(0, 60)}`;
    case 'run_code': return `Executing ${String(args.language || 'code')}`;
    case 'file_read': return `Reading ${String(args.path || '').split('/').pop() || 'file'}`;
    case 'file_write': return `Writing ${String(args.path || '').split('/').pop() || 'file'}`;
    case 'file_find': return `Finding "${String(args.pattern || '')}"`;
    case 'use_computer': return `Computer: ${String(args.goal || '').slice(0, 60)}`;
    case 'think': return 'Deep thinking...';
    case 'remember': return `Remembering: ${String(args.key || '')}`;
    case 'wait': return `Waiting ${String(args.seconds || '')}s`;
    case 'ask_user': return 'Asking user...';
    case 'spawn_agents': {
      const tasks = args.tasks as Array<{ role?: string; query?: string }> | undefined;
      const count = tasks?.length ?? 0;
      return `Spawning ${count} agent${count !== 1 ? 's' : ''}${args.reason ? ': ' + String(args.reason).slice(0, 40) : ''}`;
    }
    default: return name.replace(/_/g, ' ');
  }
}

function deriveStepTitle(thinking: string): string {
  if (!thinking) return 'Working...';
  const first = thinking.split(/[.\n]/)[0]?.trim() || thinking;
  return first.length > 80 ? first.slice(0, 77) + '...' : first;
}

// ── LiveTimer (ticks every second while agent is working) ──────────────────

function LiveTimer({ startedAt, completedAt, tokenCount }: { startedAt: number; completedAt?: number; tokenCount?: number }) {
  const { isDarkMode } = useTheme();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // If already completed, calculate fixed elapsed time and don't set up interval
    if (completedAt) {
      setElapsed(Math.round((completedAt - startedAt) / 1000));
      return;
    }

    // Otherwise, set up interval to tick while active
    const MAX_ELAPSED_S = 30 * 60; // 30 minute defensive cap
    const interval = setInterval(() => {
      const now = Math.round((Date.now() - startedAt) / 1000);
      setElapsed(now >= MAX_ELAPSED_S ? MAX_ELAPSED_S : now);
      if (now >= MAX_ELAPSED_S) clearInterval(interval); // auto-stop after 30 min
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  return (
    <span className="text-[10px] font-sans" style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
      {formatDuration(elapsed)}{tokenCount != null && tokenCount > 0 ? <span style={{ color: 'rgba(43,121,255,0.6)' }}> · {formatTokens(tokenCount)}</span> : ''}
    </span>
  );
}

// ── ThinkingMorph ──────────────────────────────────────────────────────────
// WHITE thinking animation (not blue) for Manus Lite

function ThinkingMorph({ size = 18 }: { size?: number }) {
  // CSS animation is compositor-thread only — won't crash or desync on fast mount/unmount
  return (
    <span
      className="thinking-morph"
      style={{ width: size, height: size, borderRadius: '50%' }}
    />
  );
}

// ── Animated agent response — uses ResponseStream for new messages, static for old ──

function AnimatedAgentText({ text, animate }: { text: string; animate: boolean }) {
  const { isDarkMode } = useTheme();
  // Filter out full URLs from message text — they appear in source footer instead
  const cleanedText = removeUrlsFromText(text);

  if (!animate) {
    return <div className="space-y-1">{renderMarkdown(cleanedText, isDarkMode)}</div>;
  }
  // For long text, use typewriter with fast speed; for short, use fade
  const isLong = cleanedText.length > 600;
  return (
    <div style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.75)', fontFamily: FONT_FAMILY }}>
      <ResponseStream
        textStream={cleanedText}
        mode={isLong ? "typewriter" : "fade"}
        speed={isLong ? 50 : 40}
        className="whitespace-pre-wrap text-[13px] leading-[1.7]"
      />
    </div>
  );
}

// ── Markdown renderer ──────────────────────────────────────────────────────

function renderMarkdown(text: string, isDarkMode = true): React.ReactNode[] {
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.8)';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.65)';
  const textDim = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const codeBg = isDarkMode ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.04)';
  const tableBg = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const tableAltBg = isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const bulletBg = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```lang ... ```
    if (line.trim().startsWith('\`\`\`')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('\`\`\`')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      result.push(
        <pre
          key={`code-${i}`}
          className="my-2 p-3 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed"
          style={{
            background: codeBg,
            border: `1px solid ${borderColor}`,
            color: 'rgba(43,121,255,0.85)',
            fontFamily: 'monospace',
          }}
          data-lang={lang || undefined}
        >{codeLines.join('\n')}</pre>
      );
      continue;
    }

    // Table detection: line with | separators
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse table
      const rows = tableLines
        .filter(l => !l.match(/^\|[\s-:|]+\|$/)) // skip separator rows
        .map(l => l.split('|').map(c => c.trim()).filter(Boolean));
      if (rows.length > 0) {
        const header = rows[0];
        const body = rows.slice(1);
        result.push(
          <div key={`table-${i}`} className="my-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
            <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: tableBg }}>
                  {header.map((h, j) => (
                    <th key={j} className="text-left px-4 py-2.5 font-semibold" style={{ color: textPrimary, borderBottom: `1px solid ${borderColor}`, fontFamily: FONT_FAMILY }}>
                      {inlineFormat(h, isDarkMode)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : tableAltBg }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2.5" style={{
                        color: ci === 0 ? textPrimary : textSecondary,
                        fontWeight: ci === 0 ? 600 : 400,
                        borderBottom: `1px solid ${tableAltBg}`,
                        fontFamily: FONT_FAMILY,
                      }}>
                        {inlineFormat(cell, isDarkMode)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Blockquote: > text
    if (line.startsWith('> ')) {
      result.push(
        <div key={i} className="my-1.5 pl-3 py-0.5" style={{
          borderLeft: `2.5px solid ${isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
        }}>
          <span className="text-[13px] leading-relaxed italic" style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: FONT_FAMILY }}>{inlineFormat(line.slice(2), isDarkMode)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule: ---
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      result.push(<div key={i} className="my-3" style={{ height: 1, background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: 1 }} />);
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      result.push(<h4 key={i} className="text-[13px] font-semibold mt-3 mb-1" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>{inlineFormat(line.slice(4), isDarkMode)}</h4>);
    } else if (line.startsWith('## ')) {
      result.push(<h3 key={i} className="text-[15px] font-semibold mt-4 mb-1.5" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>{inlineFormat(line.slice(3), isDarkMode)}</h3>);
    } else if (line.startsWith('# ')) {
      result.push(<h2 key={i} className="text-[17px] font-bold mt-4 mb-2" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>{inlineFormat(line.slice(2), isDarkMode)}</h2>);
    } else if (line.match(/^[-*] /)) {
      result.push(<div key={i} className="flex gap-2 pl-1"><span className="shrink-0 mt-[7px] w-1 h-1 rounded-full" style={{ background: bulletBg }} /><span className="text-[13px] leading-relaxed" style={{ color: textSecondary, fontFamily: FONT_FAMILY }}>{inlineFormat(line.slice(2), isDarkMode)}</span></div>);
    } else if (line.match(/^\d+\.\s/)) {
      const m = line.match(/^(\d+\.)\s(.*)$/);
      if (m) result.push(<div key={i} className="flex gap-2 pl-1"><span className="shrink-0 text-[12px] font-sans" style={{ color: textDim }}>{m[1]}</span><span className="text-[13px] leading-relaxed" style={{ color: textSecondary, fontFamily: FONT_FAMILY }}>{inlineFormat(m[2], isDarkMode)}</span></div>);
    } else if (line.trim() === '') {
      result.push(<div key={i} className="h-2" />);
    } else {
      result.push(<p key={i} className="text-[13px] leading-relaxed" style={{ color: textSecondary, fontFamily: FONT_FAMILY }}>{inlineFormat(line, isDarkMode)}</p>);
    }
    i++;
  }
  return result;
}

function inlineFormat(text: string, isDarkMode = true): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="font-semibold" style={{ color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="text-[12px] font-sans px-1.5 py-0.5 rounded" style={{ background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: 'rgba(43,121,255,0.8)' }}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index} style={{ color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[') && token.includes('](')) {
      const textEnd = token.indexOf('](');
      const linkText = token.slice(1, textEnd);
      const href = token.slice(textEnd + 2, -1);
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'rgba(43,121,255,0.85)',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: '2px',
          }}
        >
          {linkText}
        </a>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

// ── Glass SVG icon system ───────────────────────────────────────────────────

/** Replace every id="X" and url(#X) in an SVG string with id="X{suffix}" */
function makeUniqueIds(svg: string, suffix: string): string {
  const ids: string[] = [];
  const re = /\bid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) ids.push(m[1]);
  let out = svg;
  for (const id of ids) {
    out = out
      .replace(new RegExp(`id="${id}"`, 'g'), `id="${id}${suffix}"`)
      .replace(new RegExp(`url\\(#${id}\\)`, 'g'), `url(#${id}${suffix})`);
  }
  return out;
}

// Shared glass background markup — IDs "gf" (filter) and "gg" (gradient) are uniquified per instance
const _GLASS_BG = `<defs><filter id="gf" x="-35.7%" y="-35.7%" width="171.4%" height="171.4%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dx="1" dy="-1"/><feGaussianBlur stdDeviation="1"/><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0"/><feBlend mode="normal" in2="shape" result="e1"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dx="-1" dy="1"/><feGaussianBlur stdDeviation="1.5"/><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"/><feBlend mode="normal" in2="e1"/></filter><linearGradient id="gg" x1="14" y1="0" x2="14" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity="0.16"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><g filter="url(#gf)"><rect x="0.429" y="0.429" width="27.143" height="27.143" rx="6.857" fill="#262626"/><rect x="0.429" y="0.429" width="27.143" height="27.143" rx="6.857" fill="url(#gg)"/><rect x="0.857" y="0.857" width="26.286" height="26.286" rx="6.429" stroke="#5F5F5F" stroke-width="0.857"/></g>`;

// Shared stroke attributes for icon paths
const _IS = `stroke="#ACACAC" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

const GLASS_ICONS: Record<string, string> = {
  // Magnifying glass (simple)
  search:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<circle cx="12.5" cy="12.5" r="5" ${_IS}/><line x1="16.5" y1="16.5" x2="20" y2="20" ${_IS}/></svg>`,
  // Globe with meridian lines
  browse:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<circle cx="14" cy="14" r="6" ${_IS}/><path d="M8 14h12" ${_IS}/><path d="M14 8c-2.5 2-2.5 8 0 12" ${_IS}/><path d="M14 8c2.5 2 2.5 8 0 12" ${_IS}/></svg>`,
  // Magnifying glass + search lines (research depth)
  research: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<circle cx="12" cy="12" r="5" ${_IS}/><line x1="16" y1="16" x2="20" y2="20" ${_IS}/><path d="M10 11h4M10 13h2.5" ${_IS}/></svg>`,
  // Stacked database cylinders
  memory:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<ellipse cx="14" cy="10" rx="5" ry="1.8" ${_IS}/><path d="M9 10v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-4" ${_IS}/><path d="M9 14v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-4" ${_IS}/></svg>`,
  // Lightbulb
  think:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<path d="M14 8a5 5 0 0 1 3.54 8.54l-.04.04A2.5 2.5 0 0 0 16.5 18.5h-5a2.5 2.5 0 0 0-1-1.92l-.04-.04A5 5 0 0 1 14 8z" ${_IS}/><line x1="11.5" y1="21" x2="16.5" y2="21" ${_IS}/></svg>`,
  // Terminal >_ brackets
  code:     `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<polyline points="10,10 7,14 10,18" ${_IS}/><polyline points="18,10 21,14 18,18" ${_IS}/><line x1="12.5" y1="9" x2="15.5" y2="19" ${_IS}/></svg>`,
  // Document with page-fold and lines
  files:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<path d="M8 9a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9z" ${_IS}/><path d="M14 8v3h3" ${_IS}/><line x1="11" y1="15" x2="17" y2="15" stroke="#ACACAC" stroke-width="1" stroke-linecap="round"/><line x1="11" y1="17.5" x2="15" y2="17.5" stroke="#ACACAC" stroke-width="1" stroke-linecap="round"/></svg>`,
  // Eye with iris
  analyze:  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<path d="M8 14c1-3 3.2-5 6-5s5 2 6 5c-1 3-3.2 5-6 5s-5-2-6-5z" ${_IS}/><circle cx="14" cy="14" r="2" ${_IS}/></svg>`,
  // Image viewer with play button
  vision:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<rect x="7" y="9" width="14" height="10" rx="1.5" ${_IS}/><path d="M12 12l4 2-4 2v-4z" ${_IS}/></svg>`,
  // Person silhouette (subagent)
  sub:      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<circle cx="14" cy="10.5" r="3" ${_IS}/><path d="M8 20.5c0-3.3 2.7-6 6-6s6 2.7 6 6" ${_IS}/></svg>`,
  // Photo frame with landscape
  img:      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">${_GLASS_BG}<rect x="7" y="9" width="14" height="10" rx="1.5" ${_IS}/><polyline points="7,17 10,13.5 13,15.5 16,11.5 21,17" ${_IS}/><circle cx="10.5" cy="12" r="1" stroke="#ACACAC" stroke-width="1" fill="none"/></svg>`,
};

let _tiIdx = 0;
function ToolIcon({ name, size = 22 }: { name: string; size?: number }) {
  // Stable unique suffix per component instance — avoids SVG filter ID collisions
  const suffix = useRef(`_i${_tiIdx++}`).current;
  const raw = GLASS_ICONS[name] ?? GLASS_ICONS['search'];
  const unique = makeUniqueIds(raw, suffix);
  const sized = unique.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sized) }}
    />
  );
}

// ── Mention metadata — used to render @tags in sent messages ───────────────

const MENTION_META: Record<string, { label: string; desc: string; cat: 'tool' | 'agent' | 'media' }> = {
  '@search':   { label: 'Web Search',  desc: 'Search the web for real-time information', cat: 'tool' },
  '@browse':   { label: 'Browse',      desc: 'Read and extract from a URL', cat: 'tool' },
  '@research': { label: 'Research',    desc: 'Multi-query deep research (Context-1)', cat: 'tool' },
  '@memory':   { label: 'Memory',      desc: 'Store or retrieve persistent memories', cat: 'tool' },
  '@think':    { label: 'Think',       desc: 'Extended reasoning before responding', cat: 'tool' },
  '@code':     { label: 'Code',        desc: 'Execute Python, JS or shell scripts', cat: 'tool' },
  '@files':    { label: 'Files',       desc: 'Read workspace files', cat: 'tool' },
  '@analyze':  { label: 'Analyze',     desc: 'Screenshot and analyze a page', cat: 'tool' },
  '@vision':   { label: 'Vision',      desc: 'Analyze images with vision model', cat: 'tool' },
  '@sub':      { label: 'Subagent',    desc: 'Spawn a parallel sub-agent', cat: 'agent' },
  '@img':      { label: 'Image',       desc: 'Reference an attached image', cat: 'media' },
};

function MentionPill({ token, isDarkMode }: { token: string; isDarkMode: boolean }) {
  const [showTip, setShowTip] = useState(false);
  // Match exact key or @subN (e.g. @sub1, @sub2)
  const key = token.replace(/\d+$/, '');
  const meta = MENTION_META[key.toLowerCase()];
  if (!meta) return <span>{token}</span>;

  const color = meta.cat === 'agent' ? 'rgba(139,92,246,0.9)' : meta.cat === 'media' ? 'rgba(236,72,153,0.9)' : 'rgba(59,130,246,0.9)';
  const bg   = meta.cat === 'agent' ? 'rgba(139,92,246,0.12)' : meta.cat === 'media' ? 'rgba(236,72,153,0.1)' : 'rgba(59,130,246,0.1)';

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px 1px 4px', borderRadius: 6, background: bg, color, fontWeight: 600, fontSize: 11, margin: '0 1px', verticalAlign: 'middle', cursor: 'default', userSelect: 'none' }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <ToolIcon name={key.replace('@', '')} size={15} />
      {meta.label}
      {/* tooltip */}
      {showTip && (
        <span style={{ position: 'absolute', bottom: 'calc(100% + 5px)', left: '50%', transform: 'translateX(-50%)', background: isDarkMode ? '#1a1a1a' : '#fff', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '5px 9px', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 400, color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 999, pointerEvents: 'none' }}>
          {meta.desc}
        </span>
      )}
    </span>
  );
}

function renderMessageContent(text: string, isDarkMode: boolean): React.ReactNode {
  // Split on @mention tokens, preserve the tokens
  const parts = text.split(/(@\w+)/g);
  if (parts.length === 1) return text; // no mentions
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part) && MENTION_META[part.replace(/\d+$/, '').toLowerCase()]) {
      return <MentionPill key={i} token={part} isDarkMode={isDarkMode} />;
    }
    return part || null;
  });
}

// ── ActionPillView — Manus style: ◎ text (no pill border) ─────────────────

// ── Shared tool-pill status dot ────────────────────────────────────────────
function ToolStatusDot({ status, isDarkMode }: { status: ActionPill['status']; isDarkMode: boolean }) {
  if (status === 'done') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.5)" strokeWidth="1.5"/>
      <polyline points="7 12 10 15 17 9" stroke="rgba(34,197,94,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (status === 'error') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.45)" strokeWidth="1.5"/>
      <line x1="8" y1="8" x2="16" y2="16" stroke="rgba(239,68,68,0.8)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="8" x2="8" y2="16" stroke="rgba(239,68,68,0.8)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  if (status === 'running') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 animate-pulse">
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(43,121,255,0.5)" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="4" fill="rgba(43,121,255,0.45)"/>
    </svg>
  );
  // pending
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'} strokeWidth="1.5"/>
    </svg>
  );
}

function ActionPillView({ action, isPageVisible = true, isCancelled = false }: { action: ActionPill; isPageVisible?: boolean; isCancelled?: boolean }) {
  const { isDarkMode } = useTheme();
  const isActive = action.status === 'running' && isPageVisible && !isCancelled;
  const isDone   = action.status === 'done';
  const isError  = action.status === 'error';

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 my-0.5"
      style={{
        borderRadius: 12,
        background: isActive
          ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 80%, transparent 100%)'
          : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
        backgroundSize: isActive ? '1000px 100%' : 'auto',
        border: `1px solid ${
          isError ? (isDarkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)') :
          isActive ? (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') :
                     (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)')
        }`,
        opacity: isDone ? 0.72 : 1,
        transition: 'opacity 0.2s, background 0.3s, border-color 0.2s',
        animation: isActive ? 'toolShimmer 2.5s linear infinite' : 'none',
      }}
    >
      <ToolStatusDot status={action.status} isDarkMode={isDarkMode} />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[12.5px] font-semibold leading-snug truncate" style={{
          color: isDone  ? (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') :
                 isError ? 'rgba(239,68,68,0.8)' :
                 isActive ? (isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)') :
                           (isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)'),
          fontFamily: FONT_FAMILY,
        }}>{action.argsPreview}</span>
        {/* Progress indicator for long-running tools */}
        {action.progress && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }}>
              <div className="h-full transition-all duration-300" style={{
                width: `${action.progress.percent}%`,
                background: isActive ? 'linear-gradient(90deg, #3b82f6, #2563eb)' : 'rgba(75,175,99,0.6)',
              }} />
            </div>
            <span className="text-[9px] whitespace-nowrap" style={{
              color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              fontFamily: FONT_FAMILY,
            }}>{Math.round(action.progress.percent)}%</span>
          </div>
        )}
        {action.modelInfo && (
          <span className="text-[10.5px] leading-none" style={{
            color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)',
            fontStyle: 'italic',
            fontFamily: FONT_FAMILY,
          }}>{action.modelInfo}</span>
        )}
      </div>
    </div>
  );
}

// ── SubagentPanel — shows spawned subagents in a compact list ──────────────

function roleIcon(role: string): string {
  switch (role) {
    case 'researcher': return 'R';
    case 'analyzer': return 'A';
    case 'synthesizer': return 'S';
    case 'validator': return 'V';
    case 'strategist': return 'T';
    case 'compressor': return 'C';
    case 'evaluator': return 'E';
    default: return role.charAt(0).toUpperCase();
  }
}

function roleColor(role: string): string {
  switch (role) {
    case 'researcher': return 'rgba(43,121,255,0.7)';
    case 'analyzer': return 'rgba(168,85,247,0.7)';
    case 'synthesizer': return 'rgba(16,185,129,0.7)';
    case 'validator': return 'rgba(245,158,11,0.7)';
    case 'strategist': return 'rgba(239,68,68,0.7)';
    case 'compressor': return 'rgba(100,116,139,0.7)';
    case 'evaluator': return 'rgba(251,146,60,0.7)';
    default: return 'rgba(255,255,255,0.4)';
  }
}

interface SubagentPanelProps {
  subagents: SubagentInfo[];
  queueProgress?: SubagentQueueProgressInfo; // Phase 1: queue status
}

function SubagentPanel({ subagents, queueProgress }: SubagentPanelProps) {
  const { isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (subagents.length === 0) return null;

  const activeCount = subagents.filter(s => s.status === 'spawning' || s.status === 'running').length;
  const completeCount = subagents.filter(s => s.status === 'complete').length;
  const failedCount = subagents.filter(s => s.status === 'failed').length;
  const totalTokens = subagents.reduce((s, a) => s + (a.tokens || 0), 0);
  const allDone = activeCount === 0;

  // Phase 1: Compute queue status string if available
  const queueStatusStr = queueProgress
    ? `Running ${queueProgress.running}/${queueProgress.total}, Queued ${queueProgress.queued}`
    : null;

  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ border: isDarkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
      {/* Header row — collapsed summary */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left"
        style={{ borderBottom: expanded ? (isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)') : 'none' }}
      >
        {/* Status indicator */}
        {allDone ? (
          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckIcon size={8} />
          </div>
        ) : (
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'rgba(59,130,246,0.8)' }} />
        )}

        {/* Label */}
        <span className="text-[11px] font-medium flex-1" style={{ color: allDone ? (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') : (isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'), fontFamily: FONT_FAMILY }}>
          {allDone
            ? `${subagents.length} agent${subagents.length !== 1 ? 's' : ''} complete — ${formatTokens(totalTokens)} tokens`
            : queueStatusStr // Phase 1: Show queue info when available
            ? queueStatusStr
            : `${activeCount} agent${activeCount !== 1 ? 's' : ''} running${completeCount > 0 ? ` · ${completeCount} done` : ''}`}
          {failedCount > 0 && <span style={{ color: 'rgba(239,68,68,0.6)' }}> · {failedCount} failed</span>}
        </span>

        {/* Role badges (collapsed) */}
        {!expanded && (
          <div className="flex gap-1">
            {subagents.map(sa => (
              <span key={sa.agentId} className="text-[9px] font-bold w-4 h-4 rounded flex items-center justify-center" style={{ background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: roleColor(sa.role) }}>
                {roleIcon(sa.role)}
              </span>
            ))}
          </div>
        )}

        <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)' }}><ChevronIcon open={expanded} /></span>
      </button>

      {/* Phase 1: Queue progress bar */}
      {queueProgress && !allDone && (
        <div style={{ padding: '0.5rem 0.75rem' }}>
          <div style={{ fontSize: '9px', color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginBottom: '0.25rem', fontFamily: FONT_FAMILY }}>
            Progress: {queueProgress.percentComplete}% complete
          </div>
          <div style={{ height: 3, background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, rgba(59,130,246,0.8), rgba(59,130,246,0.5))',
                width: `${Math.min(queueProgress.percentComplete, 100)}%`,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Expanded rows */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="px-3 py-2 space-y-1.5">
              {subagents.map(sa => (
                <div key={sa.agentId}>
                  <div className="flex items-start gap-2.5">
                    {/* Status icon */}
                    <div className="shrink-0 mt-0.5">
                      {sa.status === 'complete' ? (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                          <CheckIcon size={7} />
                        </div>
                      ) : sa.status === 'failed' ? (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                          <XIcon />
                        </div>
                      ) : (
                        <span className="w-2 h-2 mt-1 rounded-full block animate-pulse" style={{ background: roleColor(sa.role) }} />
                      )}
                    </div>

                    {/* Role badge */}
                    <span className="text-[9px] font-bold shrink-0 px-1 py-0.5 rounded" style={{ background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: roleColor(sa.role) }}>
                      {sa.role}
                    </span>

                    {/* Task text */}
                    <span className="text-[11px] flex-1 leading-snug" style={{ color: sa.status === 'complete' ? (isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)') : sa.status === 'failed' ? 'rgba(239,68,68,0.5)' : (isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'), fontFamily: FONT_FAMILY }}>
                      {sa.error ? sa.error.slice(0, 80) : sa.task.slice(0, 80)}
                    </span>

                    {/* Token count */}
                    {sa.tokens != null && sa.tokens > 0 && (
                      <span className="text-[9px] shrink-0 font-sans" style={{ color: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)' }}>{formatTokens(sa.tokens!)}</span>
                    )}

                    {/* Confidence pill */}
                    {sa.status === 'complete' && sa.confidence != null && (
                      <span className="text-[9px] shrink-0 px-1 rounded" style={{ background: sa.confidence > 0.7 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', color: sa.confidence > 0.7 ? 'rgba(34,197,94,0.6)' : 'rgba(245,158,11,0.6)' }}>
                        {Math.round(sa.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Sources display */}
                  {sa.sources && sa.sources.length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 26, paddingTop: 8, borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: '10px', color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', marginBottom: 6, fontFamily: FONT_FAMILY }}>SOURCES</div>
                      {sa.sources.map((source, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                          <FaviconCircle url={source.url} size={16} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', fontFamily: FONT_FAMILY }}>{source.title.slice(0, 60)}</div>
                            <div style={{ fontSize: '9px', color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: FONT_FAMILY }}>{source.domain}</div>
                            {source.snippet && (
                              <div style={{ fontSize: '9px', color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', marginTop: 2, lineHeight: 1.3, fontFamily: FONT_FAMILY, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {source.snippet.slice(0, 120)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ── StepCardView — Manus-style collapsible step block ──────────────────────

function StepCardView({ step, isPageVisible = true, isCancelled = false }: { step: StepCard; isPageVisible?: boolean; isCancelled?: boolean }) {
  const { isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(step.status === 'active');
  // Expand when active, collapse when done
  useEffect(() => {
    if (step.status === 'active') setExpanded(true);
    else if (step.status === 'done') setExpanded(false);
  }, [step.status]);

  // Use entries if available, else fall back to legacy thinkingText + actions
  const entries: StepEntry[] = step.entries && step.entries.length > 0
    ? step.entries
    : [
        ...(step.thinkingText ? [{ type: 'text' as const, content: step.thinkingText }] : []),
        ...step.actions.map(a => ({ type: 'action' as const, pill: a })),
      ];

  // Title to show in header
  const headerTitle = step.title || (step.isThinking ? 'Thinking...' : 'Working...');

  return (
    <div className="mt-2.5">
      {/* Step header: ▼ Title   ∧ (chevron) */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {/* Leading triangle — ▶ collapsed / ▼ expanded */}
        <span className="shrink-0 text-[10px]" style={{ color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)', lineHeight: 1, marginTop: 1, transition: 'transform 0.15s ease', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        {/* Title */}
        {(step.isThinking || step.status === 'active') && isPageVisible ? (
          <TextShimmer
            className={`text-[13px] font-medium flex-1 leading-snug ${isDarkMode ? '[--shimmer-base:rgba(255,255,255,0.35)] [--shimmer-highlight:rgba(255,255,255,0.9)]' : '[--shimmer-base:rgba(0,0,0,0.32)] [--shimmer-highlight:rgba(0,0,0,0.82)]'}`}
            duration={1.8}
          >
            {headerTitle}
          </TextShimmer>
        ) : (
          <span
            className="text-[13px] font-medium flex-1 leading-snug"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: FONT_FAMILY }}
          >
            {headerTitle}
          </span>
        )}
        {/* Trailing chevron */}
        <span className="shrink-0" style={{ color: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)' }}>
          <ChevronIcon open={expanded} />
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-5 space-y-1.5">
              {/* Interleaved text + action entries */}
              {entries.map((entry, idx) => {
                if (entry.type === 'text') {
                  // Skip raw tool call JSON — already shown via ActionPill
                  if (/```tool\s*\{|tool\s*\{"name":|"name"\s*:\s*"[^"]+"\s*,\s*"args"\s*:/.test(entry.content)) return null;
                  const isLast = idx === entries.length - 1;
                  // Live thinking stream: show as italic grey blurred text
                  if (isLast && step.isThinking) {
                    return (
                      <div key={`t-${idx}`} className="relative overflow-hidden rounded-lg" style={{ maxHeight: 120, maxWidth: '85%', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`, padding: '8px 10px' }}>
                        <p
                          className="text-[12px] leading-relaxed whitespace-pre-wrap"
                          style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', fontStyle: 'italic', fontFamily: FONT_FAMILY }}
                        >
                          {entry.content.slice(-400)}
                        </p>
                        {/* Fade-out at bottom */}
                        <div className="rounded-b-lg" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, background: isDarkMode ? 'linear-gradient(transparent, rgba(16,16,20,0.95))' : 'linear-gradient(transparent, rgba(255,255,255,0.95))' }} />
                      </div>
                    );
                  }
                  // Completed thinking text — show brief description in a contained card
                  const brief = entry.content.length > 160 ? entry.content.slice(0, 157) + '...' : entry.content;
                  return (
                    <div key={`t-${idx}`} className="rounded-lg" style={{ maxWidth: '85%', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`, padding: '6px 10px' }}>
                      <p className="text-[12px] leading-relaxed" style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', fontStyle: 'italic', fontFamily: FONT_FAMILY }}>
                        {brief}
                      </p>
                    </div>
                  );
                }
                // Action entry: ◎ text (Manus style)
                const wsResult = entry.pill.status === 'done' && entry.pill.result
                  ? renderWorkspaceResult(entry.pill.toolName, entry.pill.result)
                  : null;
                return (
                  <div key={entry.pill.id}>
                    <ActionPillView action={entry.pill} isPageVisible={isPageVisible} isCancelled={isCancelled} />
                    {wsResult}
                  </div>
                );
              })}

              {/* Subagent panel — rendered inside expanded step card */}
              {step.subagents && step.subagents.length > 0 && (
                <SubagentPanel subagents={step.subagents} />
              )}

              {/* Browser preview thumbnail */}
              {step.browserUrl && (
                <div className="mt-2 rounded-lg overflow-hidden" style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, maxWidth: 280 }}>
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)', flexShrink: 0 }}><GlobeIcon /></span>
                    <span className="text-[9px] font-sans truncate flex-1" style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)' }}>{step.browserUrl}</span>
                    <a href={step.browserUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[8px] font-medium px-1 py-0.5 rounded" style={{ color: 'rgba(43,121,255,0.5)', background: 'rgba(43,121,255,0.07)' }} onClick={e => e.stopPropagation()}>open</a>
                  </div>
                  {step.browserScreenshot && (
                    <img src={`data:image/jpeg;base64,${step.browserScreenshot}`} alt="Page screenshot" className="w-full block" style={{ maxHeight: 160, objectFit: 'cover', objectPosition: 'top' }} />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// BottomStatusBar removed — tool usage now shown inline in message stream

// ── NomadLogo ──────────────────────────────────────────────────────────────

function NomadLogo() {
  return (
    <div
      className="w-7 h-7 rounded-lg shrink-0"
      style={{
        background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 50%, #6366f1 100%)',
        boxShadow: '0 0 12px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
      }}
    />
  );
}

// ── ConversationSidebar ────────────────────────────────────────────────────

function ConversationSidebar({ groups, currentId, onSelect, onDelete, onNewChat, onRename, isCollapsed, onClose, isCreatingChat }: {
  groups: GroupedConversations[]; currentId: string | null; onSelect: (id: string) => void; onDelete: (id: string) => void; onNewChat: () => void; onRename: (id: string, title: string) => void; isCollapsed: boolean; onClose: () => void; isCreatingChat?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  return (
    <AnimatePresence>
      {!isCollapsed && (
        <>
          {/* Scrim backdrop -- click anywhere to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            role="button"
            tabIndex={0}
            aria-label="Close sidebar"
          />
          {/* Sidebar panel */}
          <motion.div
            initial={{ x: -240, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -240, opacity: 0.8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 top-0 bottom-0 z-50 flex flex-col"
            style={{ width: 240, background: 'rgba(12,12,16,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255,255,255,0.06)', boxShadow: '4px 0 32px rgba(0,0,0,0.5)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 h-11 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Chats</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onNewChat}
                  disabled={isCreatingChat}
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isCreatingChat ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.05]'}`}
                  style={{ color: isCreatingChat ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)' }}
                  title={isCreatingChat ? 'Creating new chat...' : 'New chat'}
                >
                  <NewChatIcon />
                </button>
                <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/[0.05] transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }} title="Close"><XIcon /></button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-0.5">
              {groups.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>No chats yet</span>
                </div>
              ) : groups.map(group => (
                <div key={group.group}>
                  <div className="px-3 pt-2.5 pb-0.5">
                    <span className="text-[8px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>{group.group}</span>
                  </div>
                  {group.items.map(conv => {
                    const isActive = conv.id === currentId;
                    const isEditing = editingId === conv.id;
                    return (
                      <div key={conv.id} className="group px-1">
                        <div
                          onClick={() => !isEditing && onSelect(conv.id)}
                          onDoubleClick={() => { setEditingId(conv.id); setEditValue(conv.title); }}
                          className="w-full text-left px-2 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                          style={{ background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                              className="text-[11px] flex-1 min-w-0 bg-transparent outline-none px-0.5 rounded"
                              style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.06)' }}
                            />
                          ) : (
                            <span className="text-[11px] flex-1 truncate" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                              {conv.title}
                            </span>
                          )}
                          <span className="text-[9px] shrink-0" style={{ color: 'rgba(255,255,255,0.1)' }}>
                            {formatTime(conv.updatedAt)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                            className="shrink-0 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]"
                            style={{ color: 'rgba(255,255,255,0.15)' }}
                            title="Delete chat"
                            aria-label="Delete chat"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── AttachmentMenu ─────────────────────────────────────────────────────────

function AttachmentMenu({ onClose, onUploadClick }: { onClose: () => void; onUploadClick: () => void }) {
  const items = [
    { icon: <UploadIcon />, label: 'Upload file', desc: 'Add a file to workspace', onClick: onUploadClick },
    { icon: <FolderIcon />, label: 'Add from workspace', desc: 'Reference an existing file', onClick: onClose },
    { icon: <GlobeIcon />, label: 'Browse a URL', desc: 'Fetch and analyze a webpage', onClick: onClose },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.12 }} className="absolute bottom-full left-0 mb-2 rounded-xl overflow-hidden z-30" style={{ background: 'rgba(20,20,24,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={item.onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{item.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.label}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{item.desc}</div>
          </div>
        </button>
      ))}
    </motion.div>
  );
}

// ── Campaign context builder ────────────────────────────────────────────────

function buildCampaignContext(campaign: Campaign | null, cycle: Cycle | null): CampaignContextData | undefined {
  if (!campaign) return undefined;
  const ctx: CampaignContextData = {
    brand: campaign.brand,
    productDescription: campaign.productDescription || undefined,
    targetAudience: campaign.targetAudience || undefined,
    marketingGoal: campaign.marketingGoal || undefined,
    productFeatures: campaign.productFeatures?.length ? campaign.productFeatures : undefined,
    productPrice: campaign.productPrice || undefined,
  };
  if (cycle) {
    const brandDnaStage = cycle.stages['brand-dna'];
    if (brandDnaStage?.agentOutput) ctx.brandDna = brandDnaStage.agentOutput.slice(0, 2000);
    const personaStage = cycle.stages['persona-dna'];
    if (personaStage?.agentOutput) ctx.personaDna = personaStage.agentOutput.slice(0, 2000);
    const anglesStage = cycle.stages['angles'];
    if (anglesStage?.agentOutput) ctx.angles = anglesStage.agentOutput.slice(0, 1000);
    if (cycle.researchFindings?.deepDesires?.length) {
      const desires = cycle.researchFindings.deepDesires
        .slice(0, 3)
        .map(d => `• ${d.deepestDesire}`)
        .join('\n');
      ctx.researchSummary = `Top customer desires:\n${desires}`;
    }
  }
  return ctx;
}

// ── Model info helper ──────────────────────────────────────────────────────────
/**
 * Determine which model is being used for a given tool
 */
function getModelInfoForTool(toolName: string): string {
  switch (toolName) {
    case 'research_orchestrator':
    case 'orchestrate_research':
      return 'Context-1';
    case 'code_analysis':
      return 'nemotron 120B';
    case 'spawn_agents':
      return 'subagent pool';
    case 'browse':
    case 'analyze_page':
    case 'use_computer':
      return 'Qwen 3.5:9b';
    case 'rewrite':
    case 'generate_copy':
    case 'synthesize':
      return 'Qwen 3.5:9b';
    default:
      return '';
  }
}

// ── Subagent mention detection ──────────────────────────────────────────────
/**
 * Extract @subN mentions from input text
 * Supports: @sub1, @sub2, ... @sub9 (case-insensitive)
 * Returns array of unique subagent numbers in order of appearance
 */
function detectSubagentMentions(text: string): number[] {
  const pattern = /@sub([1-9])\b/gi;
  const matches: number[] = [];
  const seen = new Set<number>();
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!seen.has(num)) {
      matches.push(num);
      seen.add(num);
    }
  }

  return matches;
}

// ── Helper Components for User Avatar/Name ──────────────────────────────────

/**
 * Extract initials from user name (e.g., "Michael" → "M", "John Doe" → "JD")
 */
function extractInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * User Name Display Component — Shows real user name or fallback
 */
function UserNameDisplay() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const displayName = user?.name || 'You';

  return (
    <span
      className="text-[11px] font-medium"
      style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', fontFamily: FONT_FAMILY }}
    >
      {displayName}
    </span>
  );
}

/**
 * User Avatar with Real Initials — Shows M for Michael, JD for John Doe, etc.
 */
function UserAvatarWithInitials() {
  const { user } = useAuth();
  const userName = user?.name || 'You';
  const initials = extractInitials(userName);

  return (
    <BlobAvatar
      seed={getUserAvatarSeed()}
      color={getUserAvatarColor()}
      size={20}
      animated={false}
      initials={initials}
    />
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface AgentPanelProps {
  initialChatId?: string;
  hideSidebar?: boolean;
  initialMessage?: string;
  onInitialMessageSent?: () => void; // FIX: Callback to clear initialMessage after auto-send
}

export function AgentPanel({ initialChatId, hideSidebar, initialMessage, onInitialMessageSent }: AgentPanelProps = {}) {
  const { campaign, currentCycle } = useCampaign();
  const { isDarkMode, animationsEnabled } = useTheme();
  /** Track if page is visible to disable shimmer when tab is not focused */
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  const [blocks, setBlocks] = useState<MessageBlock[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [currentToolName, setCurrentToolName] = useState<string | undefined>();
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  /** True when user has manually scrolled up -- freezes auto-scroll until they return to bottom */
  const userScrolledUpRef = useRef(false);
  const [askUserPrompt, setAskUserPrompt] = useState<{ question: string; options: string[]; resolve: (answer: string) => void } | null>(null);
  const [askUserInput, setAskUserInput] = useState('');
  const taskProgressRef = useRef<TaskProgress | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [mentionedSubagents, setMentionedSubagents] = useState<number[]>([]);
  const [mentionPopover, setMentionPopover] = useState<{ query: string; startIndex: number } | null>(null);
  const [mentionSelected, setMentionSelected] = useState(0);
  const [sessionMemories, setSessionMemories] = useState<Array<{ key: string; content: string }>>([]);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showThinkingModal, setShowThinkingModal] = useState(false);
  const [showFinder, setShowFinder] = useState(false);
  const [permissionPrompt, setPermissionPrompt] = useState<{
    prompt: string;
    riskLevel?: 'low' | 'medium' | 'high';
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [executionPlan, setExecutionPlan] = useState<{
    plan: ExecutionPlanItem[];
    totalDurationMs?: number;
    resolve: (approved: boolean, changes?: string) => void;
  } | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const dragCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const seenBlockContentRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const injectedMessagesRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  const activeStepIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  /** Tracks how much thinking text was already committed before last tool_start */
  const committedThinkingLenRef = useRef<number>(0);
  /** Tracks timestamp of the last event received — used by watchdog to detect stalled state */
  const lastEventTimeRef = useRef<number>(Date.now());
  /** Timer ref for debouncing mention popover updates to prevent race conditions */
  const mentionPopoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat history
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  // Unique agent avatar color per conversation — derived from conversationId hash
  const agentColor = useMemo(() => {
    let h = 0;
    for (let i = 0; i < conversationId.length; i++) h = Math.imul(31, h) + conversationId.charCodeAt(i) | 0;
    return getAgentColor(Math.abs(h));
  }, [conversationId]);
  const [conversationGroups, setConversationGroups] = useState<GroupedConversations[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Canvas side panel state
  const canvasState = useCanvasState();
  const [chatConflictModal, setChatConflictModal] = useState<{ targetChatId: string } | null>(null);

  // Helper to calculate responsive canvas width
  const getCanvasWidthPercent = () => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    if (windowWidth < 640) return 70; // Mobile: 70%
    if (windowWidth < 1024) return 50; // Tablet: 50%
    return 45; // Desktop: 45%
  };
  const [canvasWidthPercent] = useState(getCanvasWidthPercent());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userMsgCountRef = useRef<number>(0);
  const newChatLockRef = useRef<boolean>(false);
  const initializedRef = useRef(false);

  const refreshConversationList = useCallback(async () => {
    try {
      const groups = await listConversations();
      setConversationGroups(groups);
    } catch (error) {
      console.error('Failed to refresh conversation list:', error);
    }
  }, []);

  useEffect(() => { refreshConversationList(); }, [refreshConversationList]);

  // Abort any running agent loop on unmount to prevent background fetch leaks
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort('unmount');
        abortRef.current = null;
      }
      // Clean up mention popover debounce timer
      if (mentionPopoverTimerRef.current) {
        clearTimeout(mentionPopoverTimerRef.current);
        mentionPopoverTimerRef.current = null;
      }
    };
  }, []);

  // Listen for permission request events from harness
  useEffect(() => {
    const handlePermissionRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ prompt: string; riskLevel?: 'low' | 'medium' | 'high'; resolve: (approved: boolean) => void }>;
      setPermissionPrompt({
        prompt: customEvent.detail.prompt,
        riskLevel: customEvent.detail.riskLevel,
        resolve: customEvent.detail.resolve,
      });
    };
    window.addEventListener('harness:request-permission', handlePermissionRequest);
    return () => window.removeEventListener('harness:request-permission', handlePermissionRequest);
  }, []);

  const handlePermissionResponse = useCallback((approved: boolean) => {
    if (permissionPrompt) {
      permissionPrompt.resolve(approved);
      setPermissionPrompt(null);
    }
  }, [permissionPrompt]);

  const handleExecutionPlanResponse = useCallback((approved: boolean, changes?: string) => {
    if (executionPlan) {
      executionPlan.resolve(approved, changes);
      setExecutionPlan(null);
    }
  }, [executionPlan]);

  // Listen for network open event from AppShell toolbar
  useEffect(() => {
    const handler = () => { setShowNetworkModal(true); };
    window.addEventListener('neuro-open-network', handler);
    return () => window.removeEventListener('neuro-open-network', handler);
  }, []);

  // Listen for files open event from AppShell toolbar
  useEffect(() => {
    const handler = () => { setShowFinder(true); };
    window.addEventListener('neuro-open-files', handler);
    return () => window.removeEventListener('neuro-open-files', handler);
  }, []);

  // Track document visibility to disable shimmer when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Load memories on mount — user profile + persisted memoryStore entries
  useEffect(() => {
    const loaded: Array<{ key: string; content: string }> = [];

    // 1. User profile memories (name, style, preferences, expertise)
    const profileMems = getUserMemories();
    loaded.push(...profileMems);

    // 2. Persisted memoryStore entries (max 30, newest first)
    const stored = getMemories();
    stored.slice(0, 30).forEach(m => {
      // Skip seed memories with do-not-surface tag — they are already in the profile
      if (m.tags.includes('do-not-surface-unprompted')) return;
      const key = m.tags[0] || m.type;
      loaded.push({ key, content: m.content });
    });

    setSessionMemories(loaded);
    touchUserProfile();
  }, []);

  // Auto-save (debounced) — preserves existing LLM-generated title if one exists
  useEffect(() => {
    if (blocks.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        // Check if conversation already has an LLM-generated title
        const existing = await loadConversation(conversationId);
        let title: string;
        if (existing && existing.title && existing.title !== 'New conversation' && !existing.title.endsWith('...')) {
          // Keep the existing LLM-generated title
          title = existing.title;
        } else {
          // Fallback: derive from first user message
          const firstUser = blocks.find(b => b.type === 'user');
          title = firstUser ? (firstUser.content.length > 50 ? firstUser.content.slice(0, 47) + '...' : firstUser.content) : 'New conversation';
        }
        const conv: Conversation = {
          id: conversationId, title, messages: blocks as StoredMessageBlock[],
          createdAt: blocks[0]?.timestamp || Date.now(), updatedAt: Date.now(),
          messageCount: blocks.filter(b => b.type === 'user' || b.type === 'agent').length,
        };
        await saveConversation(conv);
        refreshConversationList();
      } catch (error) {
        console.error('Failed to auto-save conversation:', error);
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [blocks, conversationId, refreshConversationList]);

  const handleNewChat = useCallback(async () => {
    // Prevent duplicate chat creation via double-click or rapid clicks
    if (newChatLockRef.current || isCreatingChat) return;

    newChatLockRef.current = true;
    setIsCreatingChat(true);

    try {
      // Abort any running operations
      abortRef.current?.abort();
      abortRef.current = null;

      // Reset all UI and operation state
      setStatus('idle');
      taskProgressRef.current = null;
      activeBlockIdRef.current = null;
      activeStepIdRef.current = null;
      seenBlockContentRef.current.clear();
      userMsgCountRef.current = 0;

      // Generate new IDs for the conversation and workspace
      const newConversationId = crypto.randomUUID(); // Clear all chat and input state atomically
      setBlocks([]);
      setConversationId(newConversationId); clearInputDiv();
      setAskUserPrompt(null);
      setAskUserInput('');

      // Clear any pending save timer to prevent race condition with new empty state
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      // Refresh conversation list to reflect the UI change
      await refreshConversationList();

      // Focus input field after state settles
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      newChatLockRef.current = false;
      setIsCreatingChat(false);
    }
  }, [isCreatingChat, refreshConversationList]);

  const handleSelectConversation = useCallback(async (id: string, force?: boolean) => {
    if (id === conversationId) return;
    if (status !== 'idle' && !force) {
      setChatConflictModal({ targetChatId: id });
      return;
    }
    abortRef.current?.abort(); abortRef.current = null;
    setStatus('idle'); taskProgressRef.current = null;
    // FIX: Call cleanupActiveState to ensure all active states are cleared when switching conversations
    cleanupActiveState();
    const conv = await loadConversation(id);
    if (!conv) {
      // New chat that hasn't been saved yet — initialize it with the correct ID
      setConversationId(id);
      setBlocks([]);
      seenBlockContentRef.current.clear();
      userMsgCountRef.current = 0;
      return;
    }
    setConversationId(conv.id); setBlocks(conv.messages as MessageBlock[]);
    seenBlockContentRef.current.clear();
    userMsgCountRef.current = conv.messages.filter(m => m.type === 'user').length;
    setAskUserPrompt(null); setAskUserInput(''); clearInputDiv();
    setChatConflictModal(null);
  }, [conversationId, status]);

  // Load conversation from initialChatId (passed from URL router)
  useEffect(() => {
    if (!initialChatId || initializedRef.current) return;
    initializedRef.current = true;
    handleSelectConversation(initialChatId).catch(() => {
      initializedRef.current = false;
    });
  }, [initialChatId, handleSelectConversation]);

  // Auto-send initialMessage if provided (e.g., from HomeScreen quick send)
  const initialMessageSentRef = useRef(false);
  useEffect(() => {
    if (!initialMessage || !conversationId || initialMessageSentRef.current) return;

    // Mark as sent to prevent re-running on re-renders
    initialMessageSentRef.current = true;

    // Defer sending to next frame to ensure DOM is ready
    const timeoutId = setTimeout(async () => {
      try {
        console.debug('Auto-sending initialMessage:', initialMessage.slice(0, 50) + '...');

        // Set input field value by finding the contenteditable div and setting its textContent
        const inputDiv = inputRef.current;
        if (inputDiv) {
          inputDiv.textContent = initialMessage;
          // Trigger an input event so React state updates
          inputDiv.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Wait one frame for input state to update
        await new Promise(r => setTimeout(r, 50));

        // Now click the send button to trigger the full agent loop via handleSubmit
        // This avoids a stale closure issue and ensures handleSubmit is fully initialized
        const sendBtn = document.querySelector('[data-testid="send-message-btn"]') as HTMLButtonElement;
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          // FIX: Call callback to clear initialMessage in parent after auto-send
          onInitialMessageSent?.();
        }
      } catch (e) {
        console.error('Failed to auto-send initialMessage:', e);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [initialMessage, conversationId, onInitialMessageSent]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (id === conversationId) handleNewChat();
    refreshConversationList();
  }, [conversationId, handleNewChat, refreshConversationList]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    const conv = await loadConversation(id);
    if (!conv) return;
    conv.title = newTitle;
    await saveConversation(conv);
    refreshConversationList();
  }, [refreshConversationList]);

  /** Fire-and-forget: generate a short LLM title if the message count hits a retitle checkpoint */
  const maybeRetitle = useCallback((currentBlocks: MessageBlock[], convId: string) => {
    const userCount = currentBlocks.filter(b => b.type === 'user').length;
    if (!shouldRetitle(userCount)) return;

    // Fire-and-forget -- don't await, don't block UI
    generateConversationTitle(currentBlocks as StoredMessageBlock[]).then(async (title) => {
      if (!title) return;
      const conv = await loadConversation(convId);
      if (!conv) return;
      conv.title = title;
      await saveConversation(conv);
      refreshConversationList();
    }).catch(() => { /* swallow -- keep existing title */ });
  }, [refreshConversationList]);

  const scrollToBottom = useCallback(() => {
    // Clear the frozen-scroll flag so auto-scroll resumes
    userScrolledUpRef.current = false;
    setShowScrollBtn(false);
    requestAnimationFrame(() => {
      const c = scrollContainerRef.current;
      if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  // Track previous block count to detect when a new block is appended vs content update.
  const blockCountRef = useRef(0);
  // Scroll when a new message block appears (not just a content update on existing ones).
  // Skips if user has manually scrolled up to read history.
  useEffect(() => {
    const prevCount = blockCountRef.current;
    blockCountRef.current = blocks.length;
    if (blocks.length > prevCount && !userScrolledUpRef.current) {
      scrollToBottom();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.length]);

  // Auto-scroll when DOM content grows (streaming tokens, new steps)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => {
      // Respect user scroll: if they've scrolled up to read history, do not auto-scroll
      if (userScrolledUpRef.current) return;
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (nearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distFromBottom > 120;
    // Freeze / unfreeze auto-scroll based on user position
    userScrolledUpRef.current = scrolledUp;
    setShowScrollBtn(scrolledUp);
  }, []);

  const isWorking = status === 'routing' || status === 'thinking' || status === 'streaming';

  // Convert current agent block's StepCards to StepConfig[] for AgentUIWrapper
  const agentSteps: StepConfig[] = (() => {
    const activeBlock = blocks.find(b => b.id === activeBlockIdRef.current);
    const steps = activeBlock?.steps || [];
    if (steps.length === 0) return [];
    return steps.map((s): StepConfig => ({
      id: s.id,
      title: s.title,
      status: s.status === 'active' ? 'active' : s.status === 'done' ? 'completed' : 'pending',
      isThinking: s.isThinking,
      liveThinkingText: (s.entries.find(e => e.type === 'text' && s.isThinking) as { type: 'text'; content: string } | undefined)?.content,
      subItems: s.entries
        .filter(e => e.type === 'action')
        .map(e => {
          const pill = (e as { type: 'action'; pill: ActionPill }).pill;
          return {
            id: pill.id,
            type: pill.status === 'done' ? 'completed' as const : pill.status === 'running' ? 'query' as const : 'pending' as const,
            label: `${pill.toolName}: ${pill.argsPreview}`,
          };
        }),
    }));
  })();

  // Show the AgentUIWrapper overview panel when there are steps to display
  const [stepOverviewOpen, setStepOverviewOpen] = useState(false);

  // Workspace seeding removed — use sessionFileSystem instead

  // Update mentioned subagents as user types
  useEffect(() => {
    const detected = detectSubagentMentions(input);
    setMentionedSubagents(detected);
  }, [input]);

  // ── Attachment helpers (paste / drop into chat input) ──────────────────

  const fileToAttachment = useCallback((file: File): Promise<ChatAttachment | null> => {
    return new Promise((resolve) => {
      if (IMAGE_ACCEPT.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: crypto.randomUUID(), dataUrl: reader.result as string, name: file.name, type: 'image' });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } else if (TEXT_ACCEPT.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: crypto.randomUUID(), dataUrl: '', name: file.name, type: 'text', textContent: reader.result as string });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      } else {
        resolve(null);
      }
    });
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCountRef.current++; if (e.dataTransfer.types.includes('Files')) setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCountRef.current--; if (dragCountRef.current <= 0) { dragCountRef.current = 0; setIsDragOver(false); } }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false); dragCountRef.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const newAttachments: ChatAttachment[] = [];
    for (const file of files) {
      const att = await fileToAttachment(file);
      if (att) newAttachments.push(att);
    }
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments]);
  }, [fileToAttachment]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newAttachments: ChatAttachment[] = [];
    for (const file of files) {
      const att = await fileToAttachment(file);
      if (att) newAttachments.push(att);
    }
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [fileToAttachment]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const fileItems = items.filter(item => item.kind === 'file' && (IMAGE_ACCEPT.includes(item.type) || TEXT_ACCEPT.includes(item.type)));
    if (fileItems.length === 0) return;
    e.preventDefault();
    const newAttachments: ChatAttachment[] = [];
    for (const item of fileItems) {
      const file = item.getAsFile();
      if (!file) continue;
      const att = await fileToAttachment(file);
      if (att) newAttachments.push(att);
    }
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments]);
  }, [fileToAttachment]);

  const handleInputDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false); dragCountRef.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const newAttachments: ChatAttachment[] = [];
    for (const file of files) {
      const att = await fileToAttachment(file);
      if (att) newAttachments.push(att);
    }
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments]);
  }, [fileToAttachment]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const ensureAgentBlock = useCallback((): string => {
    if (activeBlockIdRef.current) return activeBlockIdRef.current;
    const blockId = crypto.randomUUID();
    activeBlockIdRef.current = blockId;
    setBlocks(prev => [...prev, { id: blockId, type: 'agent' as const, content: '', steps: [], timestamp: Date.now(), startedAt: Date.now(), tokenCount: 0 }]);
    return blockId;
  }, []);

  const addStepToBlock = useCallback((blockId: string, step: StepCard) => {
    activeStepIdRef.current = step.id;
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, steps: [...(b.steps || []), step] } : b));
  }, []);

  const updateCurrentStep = useCallback((updater: (step: StepCard) => StepCard) => {
    const stepId = activeStepIdRef.current; const blockId = activeBlockIdRef.current;
    if (!stepId || !blockId) return;
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, steps: (b.steps || []).map(s => s.id === stepId ? updater(s) : s) } : b));
  }, []);

  const completeCurrentStep = useCallback(() => {
    updateCurrentStep(s => ({ ...s, status: 'done', isThinking: false }));
    activeStepIdRef.current = null;
  }, [updateCurrentStep]);

  // Read plain text from contentEditable div (mention spans → their data-mention value)
  const readInputText = (): string => {
    const el = inputRef.current;
    if (!el) return '';
    return Array.from(el.childNodes).reduce((txt: string, node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) return txt + (node.textContent || '');
      if (node instanceof HTMLElement && node.dataset.mention) return txt + node.dataset.mention;
      return txt + (node.textContent || '');
    }, '');
  };

  const clearInputDiv = () => {
    if (inputRef.current) inputRef.current.innerHTML = '';
    setInput('');
  };

  const handleSubmit = async () => {
    const text = readInputText().trim();
    const currentAttachments = [...attachments];
    if (!text && currentAttachments.length === 0) return;

    // Handle /canvas command — open empty canvas
    if (text.toLowerCase() === '/canvas') {
      clearInputDiv();
      const emptyCanvas = createCanvasContent('canvas', { title: 'Untitled', filename: 'document.md' });
      if (emptyCanvas) canvasState.openCanvas(emptyCanvas);
      return;
    }

    // Detect @subN mentions in the input text
    const subagentNums = detectSubagentMentions(text);
    setMentionedSubagents(subagentNums);

    // Build attachment context string for the agent
    let attachmentContext = '';
    if (currentAttachments.length > 0) {
      const parts: string[] = [];
      for (const att of currentAttachments) {
        if (att.type === 'image') {
          parts.push(`[Attached image: ${att.name}] (base64 data available)`);
        } else if (att.type === 'text' && att.textContent) {
          const preview = att.textContent.length > 2000 ? att.textContent.slice(0, 2000) + '...(truncated)' : att.textContent;
          parts.push(`[Attached file: ${att.name}]\n\`\`\`\n${preview}\n\`\`\``);
        }
      }
      attachmentContext = '\n\n' + parts.join('\n\n');
    }
    const fullMessage = (text || '') + attachmentContext;

    if (isWorking) {
      injectedMessagesRef.current.push(fullMessage);
      userMsgCountRef.current += 1;
      setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'user' as const, content: text || '(attached files)', attachments: currentAttachments.length > 0 ? currentAttachments : undefined, timestamp: Date.now() }]);
      clearInputDiv(); setAttachments([]); setMentionedSubagents([]); setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    userMsgCountRef.current += 1;
    setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'user' as const, content: text || '(attached files)', attachments: currentAttachments.length > 0 ? currentAttachments : undefined, timestamp: Date.now() }]);
    clearInputDiv(); setAttachments([]); setMentionedSubagents([]); setTimeout(() => inputRef.current?.focus(), 0);
    setStatus('routing');
    cancelledRef.current = false;
    const controller = new AbortController(); abortRef.current = controller;
    // Ensure agent block exists IMMEDIATELY so "Routing..." appears right away
    ensureAgentBlock();
    activeStepIdRef.current = null;
    const conversationHistory = blocks.filter(b => b.type === 'user' || b.type === 'agent').map(b => `${b.type === 'user' ? 'User' : 'Assistant'}: ${b.content}`).join('\n\n');

    try {
      // Build initial memories: profile + stored + campaign context snapshot
      const campaignCtx = buildCampaignContext(campaign, currentCycle);
      const campaignMemories: Array<{ key: string; content: string }> = [];
      if (campaignCtx) {
        if (campaignCtx.brand) campaignMemories.push({ key: 'brand', content: campaignCtx.brand });
        if (campaignCtx.productDescription) campaignMemories.push({ key: 'product', content: campaignCtx.productDescription });
        if (campaignCtx.targetAudience) campaignMemories.push({ key: 'audience', content: campaignCtx.targetAudience });
        if (campaignCtx.marketingGoal) campaignMemories.push({ key: 'goal', content: campaignCtx.marketingGoal });
      }
      const allInitialMemories = [...sessionMemories, ...campaignMemories];

      await runAgentLoop(fullMessage, conversationHistory, {
        model: getModelForStage('research'), temperature: 0.7, maxSteps: 999, maxDurationMs: 5 * 60 * 60 * 1000,
        signal: controller.signal,
        campaignContext: campaignCtx,
        initialMemories: allInitialMemories,
        mentionedSubagents: subagentNums,
        onAskUser: (question, options) => new Promise<string>((resolve) => { setAskUserPrompt({ question, options, resolve }); }),
        getInjectedMessages: () => { const msgs = [...injectedMessagesRef.current]; injectedMessagesRef.current = []; return msgs; },
        onEvent: (event: AgentEngineEvent) => {
          if (!abortRef.current) return; // Skip stale events after cancel
          lastEventTimeRef.current = Date.now(); // Watchdog: record last event timestamp
          switch (event.type) {
            case 'routing': {
              const blockId = ensureAgentBlock();
              if (event.routing) {
                // Handle tool-progress routing events (from progress tracking)
                if (event.routing.phase === 'tool-progress' && event.routing.decision) {
                  // Parse progress message: "tool_name: message... NN%"
                  const msg = event.routing.decision;
                  const percentMatch = msg.match(/(\d+)%$/);
                  const percent = percentMatch ? parseInt(percentMatch[1], 10) : 0;

                  // Update the most recent running action pill with progress
                  updateCurrentStep(s => {
                    const updatedEntries = [...s.entries];
                    // Find the last action pill that's running
                    for (let i = updatedEntries.length - 1; i >= 0; i--) {
                      const entry = updatedEntries[i];
                      if (entry.type === 'action' && entry.pill.status === 'running') {
                        updatedEntries[i] = {
                          type: 'action',
                          pill: {
                            ...entry.pill,
                            progress: { percent, message: msg },
                          },
                        };
                        break;
                      }
                    }
                    return { ...s, entries: updatedEntries };
                  });
                } else {
                  // Regular routing trace
                  const routedModel = event.routing!.model || '';
                  const isDeepReasoningRoute = routedModel.includes('nemotron') || event.routing!.decision.includes('nemotron');
                  setBlocks(prev => prev.map(b =>
                    b.id === blockId ? {
                      ...b,
                      isDeepReasoning: isDeepReasoningRoute ? true : (b as any).isDeepReasoning,
                      routingTrace: [...((b as any).routingTrace || []), {
                        phase: event.routing!.phase,
                        decision: event.routing!.decision,
                        tools: event.routing!.tools,
                        model: event.routing!.model,
                        durationMs: event.routing!.durationMs,
                        timestamp: event.timestamp,
                      }],
                    } : b
                  ));
                }
              }
              break;
            }
            case 'response_chunk': {
              // If canvas is open and streaming, stream chunks to canvas instead of chat
              if (canvasState.isOpen && canvasState.content?.isWriting && event.response) {
                canvasState.streamChunk(event.response);
              } else if (event.response) {
                // Otherwise, show as agent intro text in chat
                const blockId = ensureAgentBlock();
                setBlocks(prev => prev.map(b =>
                  b.id === blockId ? { ...b, content: event.response || '' } : b
                ));
              }
              break;
            }

            case 'thinking_start': {
              setStatus('thinking');
              setCurrentToolName(undefined);
              const blockId = ensureAgentBlock();
              committedThinkingLenRef.current = 0;
              setShowThinkingModal(true);
              const thinkModel = (event as any).model as string | undefined;
              const isDeepReason = thinkModel?.includes('nemotron') || thinkModel?.includes('120b');
              const thinkLabel = isDeepReason ? 'Deep Reasoning' : 'Thinking';
              addStepToBlock(blockId, { id: crypto.randomUUID(), title: '', thinkingText: '', isThinking: true, actions: [], entries: [], status: 'active', activityLabel: thinkLabel });
              break;
            }
            case 'thinking_chunk': {
              if (event.thinking) {
                const raw = event.thinking;
                const idx = raw.indexOf('```tool');
                const clean = idx > 0 ? raw.slice(0, idx).trim() : raw.trim();
                if (event.isThinkingToken) {
                  // Real thinking tokens from json.thinking — stream into collapsible box inside step card
                  updateCurrentStep(s => {
                    const entries = [...s.entries];
                    const last = entries[entries.length - 1];
                    if (last && last.type === 'text') {
                      entries[entries.length - 1] = { type: 'text', content: clean };
                    } else {
                      if (clean) entries.push({ type: 'text', content: clean });
                    }
                    return { ...s, thinkingText: clean, entries };
                  });
                } else {
                  // Response text streaming (no dedicated thinking stream) — derive step title only, no text entry
                  const newPortion = clean.slice(committedThinkingLenRef.current).trim();
                  updateCurrentStep(s => ({ ...s, title: deriveStepTitle(newPortion || clean), thinkingText: clean }));
                }
                // Update token count on the agent block
                const bid = activeBlockIdRef.current;
                if (bid) setBlocks(prev => prev.map(b => b.id === bid ? { ...b, tokenCount: (b.tokenCount || 0) + 1 } : b));
              }
              break;
            }
            case 'thinking_done': updateCurrentStep(s => ({ ...s, isThinking: false })); break;
            case 'tool_start': {
              if (event.toolCall) {
                setStatus('streaming');
                setCurrentToolName(event.toolCall.name);
                const tc: ToolCall = event.toolCall;
                const isBrowser = tc.name === 'browse' || tc.name === 'analyze_page' || tc.name === 'use_computer';
                const url = isBrowser ? String(tc.args.url || tc.args.start_url || '') : undefined;
                const pill: ActionPill = { id: tc.id, toolName: tc.name, argsPreview: actionLabel(tc.name, tc.args), status: 'running', modelInfo: getModelInfoForTool(tc.name) };

                // Open Canvas for document-generating tools starting
                if (shouldOpenCanvas(tc.name)) {
                  const filename = String(tc.args?.filename || tc.args?.title || 'Document');
                  const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
                  canvasState.openCanvas({
                    title: filename,
                    content: '', // Start empty, will fill on tool_done
                    fileType: ext as any,
                    isWriting: true,
                  });
                }

                // Commit current thinking length so next thinking_chunk starts a new text entry
                updateCurrentStep(s => {
                  committedThinkingLenRef.current = s.thinkingText.length;
                  return {
                    ...s, isThinking: false, activityLabel: getActivityLabel(tc.name),
                    actions: [...s.actions, pill],
                    entries: [...s.entries, { type: 'action', pill }],
                    ...(url ? { browserUrl: url } : {}),
                  };
                });
              }
              break;
            }
            case 'tool_done': case 'tool_error': {
              setCurrentToolName(undefined);
              if (event.toolCall) {
                const tcId = event.toolCall.id;
                const tcName = event.toolCall.name;
                const ns = event.type === 'tool_done' ? 'done' as const : 'error' as const;
                const result = event.toolCall?.result?.output?.slice(0, 500);

                // BUG-01: extract screenshot from tool result data for browser tools
                const isBrowserTool = ['browse', 'browser_screenshot', 'use_computer', 'analyze_page'].includes(tcName);
                const screenshotBase64: string | undefined = isBrowserTool
                  ? (event.toolCall.result?.data as { image_base64?: string } | undefined)?.image_base64
                  : undefined;

                // BUG-07: extract URL from tool result output for browser URL chip
                const outputText = event.toolCall?.result?.output || '';
                const urlMatch = outputText.match(/https?:\/\/[^\s"']+/);
                const extractedUrl = urlMatch ? urlMatch[0] : undefined;

                updateCurrentStep(s => ({
                  ...s,
                  actions: s.actions.map(a => a.id === tcId ? { ...a, status: ns, result } : a),
                  entries: s.entries.map(e => e.type === 'action' && e.pill.id === tcId ? { type: 'action', pill: { ...e.pill, status: ns, result } } : e),
                  ...(screenshotBase64 ? { browserScreenshot: screenshotBase64 } : {}),
                  ...(extractedUrl ? { browserUrl: extractedUrl } : {}),
                }));

                // Update Canvas for document-generating tools on completion
                if (event.type === 'tool_done' && shouldOpenCanvas(tcName)) {
                  const canvasContent = createCanvasContent(
                    tcName,
                    event.toolCall.args || {},
                    event.toolCall.result,
                    false, // not writing anymore
                  );
                  if (canvasContent) {
                    // If canvas is already open (from tool_start), update it; otherwise open it
                    if (canvasState.isOpen) {
                      canvasState.updateContent({
                        content: canvasContent.content,
                        isWriting: false,
                        blob: canvasContent.blob,
                      });
                    } else {
                      canvasState.openCanvas(canvasContent);
                    }
                  }
                }

                // Auto-refresh after filesystem-modifying tools
                if (event.type === 'tool_done' && ['file_write', 'use_computer'].includes(tcName)) {

                }
              }
              break;
            }
            case 'step_complete': completeCurrentStep(); break;
            case 'response_done': {
              // End streaming to canvas if it was streaming
              if (canvasState.isStreaming) {
                canvasState.endStreaming();
              }

              if (event.response) {
                const blockId = activeBlockIdRef.current;
                if (blockId) {
                  completeCurrentStep();
                  // Replace content (router ack may have set a placeholder)
                  setBlocks(prev => prev.map(b =>
                    b.id === blockId ? { ...b, content: event.response || '', completedAt: Date.now(), neuroRewrite: event.neuroRewrite } : b
                  ));
                } else {
                  setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'agent' as const, content: event.response || '', steps: [], entries: [], timestamp: Date.now(), completedAt: Date.now(), neuroRewrite: event.neuroRewrite }]);
                }
              }
              break;
            }
            case 'done': {
              // Clean up all active state: refs, animations, thinking UI
              if (canvasState.isStreaming) {
                canvasState.endStreaming();
              }
              cancelledRef.current = false; // Reset cancel flag
              activeBlockIdRef.current = null; activeStepIdRef.current = null; abortRef.current = null;
              setStatus('idle');
              setCurrentToolName(undefined);

              // Mark all running steps as done
              setBlocks(prev => prev.map(b => ({
                ...b,
                steps: (b.steps || []).map(s => ({
                  ...s,
                  status: 'done' as const,
                  isThinking: false,
                  actions: s.actions.map(a => a.status === 'running' ? { ...a, status: 'done' as const } : a),
                  entries: s.entries.map(e => e.type === 'action' && (e as any).pill?.status === 'running' ? { type: 'action' as const, pill: { ...(e as any).pill, status: 'done' as const } } : e),
                })),
              })));

              // Auto-title: read current blocks via setState callback, fire-and-forget
              setBlocks(prev => { maybeRetitle(prev, conversationId); return prev; });
              break;
            }
            case 'task_progress': if (event.taskProgress) taskProgressRef.current = event.taskProgress ?? null; break;

            // ── Subagent lifecycle events ──
            case 'subagent_spawn': {
              const sa = event.subagent as SubagentEventData;
              if (!sa) break;
              const newAgent: SubagentInfo = {
                agentId: sa.agentId,
                role: sa.role,
                task: sa.task,
                status: 'spawning',
                tokens: 0,
              };
              updateCurrentStep(s => ({
                ...s,
                subagents: [...(s.subagents || []), newAgent],
              }));
              break;
            }
            case 'subagent_progress': {
              const sa = event.subagent as SubagentEventData;
              if (!sa) break;
              updateCurrentStep(s => ({
                ...s,
                subagents: (s.subagents || []).map(a =>
                  a.agentId === sa.agentId
                    ? { ...a, status: 'running' as const, tokens: sa.tokens ?? a.tokens }
                    : a,
                ),
              }));
              break;
            }
            case 'subagent_complete': {
              const sa = event.subagent as SubagentEventData;
              if (!sa) break;
              updateCurrentStep(s => ({
                ...s,
                subagents: (s.subagents || []).map(a =>
                  a.agentId === sa.agentId
                    ? { ...a, status: 'complete' as const, tokens: sa.tokens ?? a.tokens, result: sa.result, confidence: sa.confidence }
                    : a,
                ),
              }));
              break;
            }
            case 'subagent_failed': {
              const sa = event.subagent as SubagentEventData;
              if (!sa) break;
              updateCurrentStep(s => ({
                ...s,
                subagents: (s.subagents || []).map(a =>
                  a.agentId === sa.agentId
                    ? { ...a, status: 'failed' as const, error: sa.error }
                    : a,
                ),
              }));
              break;
            }

            case 'error': {
              completeCurrentStep();
              setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'agent' as const, content: `Error: ${event.error || 'Unknown error'}`, steps: [], timestamp: Date.now(), completedAt: Date.now() }]);
              activeBlockIdRef.current = null; activeStepIdRef.current = null;
              break;
            }
          }
        },
      });
      setStatus('idle'); taskProgressRef.current = null; abortRef.current = null;
      // FIX: Call cleanupActiveState to ensure all thinking/shimmer is cleared on normal completion
      cleanupActiveState();
      // Ensure completedAt is set on the active block when loop finishes normally
      const blockId = activeBlockIdRef.current;
      if (blockId) {
        setBlocks(prev => prev.map(b =>
          b.id === blockId && !b.completedAt ? { ...b, completedAt: Date.now() } : b
        ));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = (err instanceof DOMException && err.name === 'AbortError')
        || (err instanceof Error && err.name === 'AbortError')
        || msg.toLowerCase().includes('abort')
        || msg.toLowerCase().includes('stopped');
      if (isAbort) { setStatus('idle'); }
      else {
        setStatus('error');
        const friendly = msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('econnrefused')
          ? "Can't reach Ollama — check your connection in Settings"
          : msg;
        setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'agent' as const, content: friendly, steps: [], timestamp: Date.now() }]);
      }
      activeBlockIdRef.current = null; activeStepIdRef.current = null; abortRef.current = null;
    }
  };

  // FIX: Shared cleanup function to clear active state, thinking, shimmer — called on both stop and normal completion
  const cleanupActiveState = () => {
    setCurrentToolName(undefined);
    setBlocks(prev => prev.map(b => {
      const hasRunning = (b.steps || []).some(s => s.isThinking || s.status === 'active' || s.actions.some(a => a.status === 'running'));
      if (!hasRunning) return b;
      return {
        ...b,
        completedAt: b.completedAt ?? Date.now(),
        steps: (b.steps || []).map(s => ({
          ...s,
          status: 'done' as const,
          isThinking: false, // FIX: Ensure thinking is cleared even if thinking_done event was slow/missed
          activityLabel: s.activityLabel === 'Stopped' ? s.activityLabel : (s.isThinking || s.status === 'active' ? 'Stopped' : s.activityLabel),
          actions: s.actions.map(a => a.status === 'running' ? { ...a, status: 'error' as const, result: 'Aborted by user' } : a),
          entries: s.entries.map(e => e.type === 'action' && (e as any).pill?.status === 'running' ? { type: 'action' as const, pill: { ...(e as any).pill, status: 'error' as const, result: 'Aborted by user' } } : e),
        })),
      };
    }));
    activeBlockIdRef.current = null;
    activeStepIdRef.current = null;
  };

  const handleStop = () => {
    cancelledRef.current = true; // Immediate synchronous flag — stops all animations before React re-renders
    abortRef.current?.abort('stopped');
    abortRef.current = null;
    setStatus('idle'); taskProgressRef.current = null;
    cleanupActiveState();
  };

  // Watchdog: poll every 5s — if no event received for 15s while active, force cleanup
  useEffect(() => {
    if (status !== 'routing' && status !== 'thinking' && status !== 'streaming') return;

    const watchdog = setInterval(() => {
      const stale = Date.now() - lastEventTimeRef.current > 15_000;
      if (stale) {
        console.warn('[watchdog] No events for 15s while status =', status, '— forcing idle');
        cleanupActiveState();
        setStatus('idle');
      }
    }, 5_000);

    return () => clearInterval(watchdog);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionPopover) {
      const items = getFilteredMentionItems(mentionPopover.query);
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSelected(i => Math.min(i + 1, items.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionSelected(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (items[mentionSelected]) insertMention(items[mentionSelected]); return; }
      if (e.key === 'Escape') { setMentionPopover(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  // ── @ mention menu ──────────────────────────────────────────────────────────
  const MENTION_ITEMS = [
    { label: 'Web Search',   insert: '@search',   category: 'tool',  desc: 'Search the web for real-time information' },
    { label: 'Browse',       insert: '@browse',    category: 'tool',  desc: 'Read and extract from a URL' },
    { label: 'Research',     insert: '@research',  category: 'tool',  desc: 'Multi-query deep research (Context-1)' },
    { label: 'Memory',       insert: '@memory',    category: 'tool',  desc: 'Store or retrieve persistent memories' },
    { label: 'Think',        insert: '@think',     category: 'tool',  desc: 'Extended reasoning before responding' },
    { label: 'Code Runner',  insert: '@code',      category: 'tool',  desc: 'Execute Python, JS or shell scripts' },
    { label: 'Files',        insert: '@files',     category: 'tool',  desc: 'Read workspace files' },
    { label: 'Analyze',      insert: '@analyze',   category: 'tool',  desc: 'Screenshot and analyze a page' },
    { label: 'Vision',       insert: '@vision',    category: 'tool',  desc: 'Analyze images with vision model' },
    { label: 'Subagent',     insert: '@sub',       category: 'agent', desc: 'Spawn a parallel sub-agent' },
    { label: 'Image',        insert: '@img',       category: 'media', desc: 'Reference an attached image' },
  ];

  function getFilteredMentionItems(query: string) {
    const q = query.toLowerCase();
    return MENTION_ITEMS.filter(m => !q || m.label.toLowerCase().includes(q) || m.insert.toLowerCase().includes(q));
  }

  const insertMention = (item: { label: string; insert: string; category: string; desc: string }) => {
    setMentionPopover(null);
    setMentionSelected(0);
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent || '';
      const before = text.slice(0, range.startOffset);
      const match = before.match(/@(\w*)$/);
      if (match) {
        // Delete @query
        const delRange = document.createRange();
        delRange.setStart(textNode, before.length - match[0].length);
        delRange.setEnd(textNode, range.startOffset);
        delRange.deleteContents();
        // Build mention pill span
        const span = document.createElement('span');
        span.contentEditable = 'false';
        span.dataset.mention = item.insert;
        span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:1px 8px 1px 4px;border-radius:6px;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.2);color:rgba(139,92,246,0.9);font-weight:600;font-size:12px;user-select:none;margin:0 2px;vertical-align:middle;cursor:default;';
        const iconBox = document.createElement('span');
        iconBox.style.cssText = 'width:16px;height:16px;border-radius:4px;background:rgba(139,92,246,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0;';
        iconBox.textContent = item.insert.slice(1, 2).toUpperCase();
        span.appendChild(iconBox);
        span.appendChild(document.createTextNode('\u00A0' + item.label));
        // Insert at cursor
        const insertRange = sel.getRangeAt(0);
        insertRange.insertNode(span);
        // Move cursor after span + add space
        const after = document.createRange();
        after.setStartAfter(span);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        document.execCommand('insertText', false, ' ');
      }
    }
    setInput(readInputText());
  };

  const handleInputChange = (e: React.FormEvent<HTMLDivElement>) => {
    const rawText = (e.currentTarget as HTMLDivElement).textContent || '';
    setInput(rawText);

    // Clear any pending mention popover timer
    if (mentionPopoverTimerRef.current) {
      clearTimeout(mentionPopoverTimerRef.current);
    }

    // Detect @ pattern — look at the text node before cursor
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      // Debounce closing the popover (50ms) to prevent rapid flickering
      mentionPopoverTimerRef.current = setTimeout(() => {
        setMentionPopover(null);
      }, 50);
      return;
    }

    const range = sel.getRangeAt(0);
    const textBeforeCursor = (range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.textContent || ''
      : '').slice(0, range.startOffset);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      // Capture the matched query in closure to avoid stale references
      const query = atMatch[1];
      // Debounce opening the popover (50ms) to prevent rapid re-renders during typing
      mentionPopoverTimerRef.current = setTimeout(() => {
        setMentionPopover({ query, startIndex: 0 });
        setMentionSelected(0);
      }, 50);
    } else {
      // Debounce closing the popover (50ms)
      mentionPopoverTimerRef.current = setTimeout(() => {
        setMentionPopover(null);
      }, 50);
    }
  };

  const isEmpty = blocks.length === 0;
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex relative overflow-hidden" style={{ background: 'transparent', flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
      {/* Main chat area wrapper - shrinks when canvas is open (responsive width) */}
      <div className="flex flex-col min-w-0" style={{ flex: canvasState.isOpen ? `0 1 calc(100% - ${canvasWidthPercent}%)` : 1, transition: 'flex 0.2s ease', overflow: 'hidden' }}>
      {/* Overlay Conversation Sidebar */}
      {!hideSidebar && (
        <ConversationSidebar groups={conversationGroups} currentId={blocks.length > 0 ? conversationId : null} onSelect={(id) => { handleSelectConversation(id); setSidebarOpen(false); }} onDelete={handleDeleteConversation} onNewChat={() => { handleNewChat(); setSidebarOpen(false); }} onRename={handleRenameConversation} isCollapsed={!sidebarOpen} onClose={() => setSidebarOpen(false)} isCreatingChat={isCreatingChat} />
      )}

      {/* Old standalone toolbar removed — AppShell now always wraps AgentPanel */}

      {/* ── Network Modal ──────────────────────────────────────── */}
      <NeuroNetworkModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
      />

      {/* ── Thinking Modal ──────────────────────────────────────── */}
      <ThinkingModal
        isOpen={showThinkingModal}
        onClose={() => setShowThinkingModal(false)}
      />

      {/* PermissionPromptModal replaced by inline PermissionApprovalBanner above the input */}

      {/* ── Execution Plan Modal (plan mode) ────────────────────── */}
      <ExecutionPlanModal
        isOpen={!!executionPlan}
        plan={executionPlan?.plan || []}
        estimatedTotalDurationMs={executionPlan?.totalDurationMs}
        onApprove={() => handleExecutionPlanResponse(true)}
        onRequestChanges={(changes) => handleExecutionPlanResponse(true, changes)}
        onAbort={() => handleExecutionPlanResponse(false)}
      />

      {/* ── Files Finder Window ──────────────────────────────────── */}
      {showFinder && (
        <FinderWindow onClose={() => setShowFinder(false)} />
      )}

      {/* AgentUIWrapper step overview panel (right-side slide-in) */}
      <AnimatePresence>
        {stepOverviewOpen && agentSteps.length > 0 && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute top-0 bottom-0 z-[40] w-72 shadow-2xl"
            style={{ right: canvasState.isOpen ? `${canvasWidthPercent}%` : 0, borderLeft: '1px solid rgba(255,255,255,0.06)', transition: 'right 0.3s ease' }}
          >
            <AgentUIWrapper
              taskDescription={blocks.find(b => b.type === 'user')?.content || 'Agent task in progress'}
              steps={agentSteps}
              isThinking={isWorking}
              onStepToggle={() => {}}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex-1 flex flex-col relative min-w-0 min-h-0" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />

        {/* Subtle animated progress line at top */}
        {isWorking && (
          <div className="absolute top-0 left-0 right-0 h-px z-10 overflow-hidden" style={{ background: 'rgba(43,121,255,0.04)' }}>
            <div className="h-full" style={{ width: '30%', background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent)', animation: 'agentProgressSlide 2s ease-in-out infinite' }} />
          </div>
        )}

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(10,10,14,0.85)', border: '2px dashed rgba(43,121,255,0.4)', borderRadius: 12 }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(43,121,255,0.12)', border: '1px solid rgba(43,121,255,0.2)' }}><span style={{ color: 'rgba(43,121,255,0.7)' }}><UploadIcon /></span></div>
                <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Drop to attach</span>
                <span className="text-[10px] font-sans" style={{ color: 'rgba(255,255,255,0.2)' }}>Images and files will be added to your message</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative flex flex-col" style={{ minHeight: 0 }}>
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ gap: 20, paddingBottom: 80 }}>
              {/* Glow ring behind blob */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  inset: -16,
                  borderRadius: '50%',
                  background: isDarkMode
                    ? `radial-gradient(circle, ${agentColor}1f 0%, transparent 70%)`
                    : `radial-gradient(circle, ${agentColor}14 0%, transparent 70%)`,
                  filter: 'blur(8px)',
                  pointerEvents: 'none',
                }} />
                <BlobAvatar seed={conversationId} color={agentColor} size={72} animated={animationsEnabled} />
              </div>
              <div className="text-center" style={{ maxWidth: 300 }}>
                <p style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)',
                  fontFamily: FONT_FAMILY,
                  margin: 0,
                  lineHeight: 1.3,
                }}>What can I help you with?</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-6 pt-4 pb-8 flex flex-col gap-5">
              {blocks.map(block => {
                switch (block.type) {
                  case 'user':
                    return (
                      <div key={block.id} className="flex gap-3 justify-end">
                        <div className="flex-1 min-w-0 flex flex-col items-end">
                          {/* User identity line */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <UserNameDisplay />
                            <span className="text-[10px]" style={{ color: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)', fontFamily: FONT_FAMILY }}>{formatTimestamp(block.timestamp)}</span>
                          </div>
                          {/* Message bubble */}
                          <div
                            className="max-w-[75%] px-4 py-2.5"
                            style={{
                              borderRadius: '18px 18px 4px 18px',
                              background: isDarkMode ? 'rgba(40,40,50,0.95)' : 'rgba(0,0,0,0.06)',
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            }}
                          >
                            {block.attachments && block.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {block.attachments.map(att => (
                                  att.type === 'image' ? (
                                    <img key={att.id} src={att.dataUrl} alt={att.name} className="w-10 h-10 rounded object-cover" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
                                  ) : (
                                    <span key={att.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(43,121,255,0.08)', border: '1px solid rgba(43,121,255,0.15)' }}>
                                      <FileDocIcon />
                                      <span className="text-[10px] max-w-[100px] truncate" style={{ color: 'rgba(43,121,255,0.7)' }}>{att.name}</span>
                                    </span>
                                  )
                                ))}
                              </div>
                            )}
                            <p className="text-[13px] leading-[1.6] whitespace-pre-wrap" style={{ color: isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.82)' }}>{renderMessageContent(block.content, isDarkMode)}</p>
                          </div>
                        </div>
                        {/* User avatar */}
                        <div className="shrink-0 mt-0.5">
                          <UserAvatarWithInitials />
                        </div>
                      </div>
                    );
                  case 'agent':
                    return (
                      <div key={block.id} className="flex gap-3">
                        {/* Neuro agent icon */}
                        <div className="shrink-0 mt-0.5"><BlobAvatar seed={conversationId} color={agentColor} size={20} animated={animationsEnabled} /></div>
                        <div className="flex-1 min-w-0 pt-0">
                          {/* Identity line: "neuro" —  */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[13px]" style={{ fontWeight: 700, letterSpacing: '0.03em', color: isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)', fontFamily: FONT_FAMILY }}>NEURO</span>
                            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.03em', padding: '2px 5px', borderRadius: 3, border: `1.5px solid ${isDarkMode ? 'rgba(102,102,102,0.3)' : 'rgba(0,0,0,0.12)'}`, color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)', fontFamily: FONT_FAMILY, lineHeight: 1, animation: 'maxBadgeShimmer 3s ease-in-out infinite' }}>MAX</span>
                            {(block as any).isDeepReasoning && (
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 3, border: `1.5px solid ${isDarkMode ? 'rgba(139,92,246,0.5)' : 'rgba(109,40,217,0.3)'}`, color: isDarkMode ? 'rgba(167,139,250,0.9)' : 'rgba(109,40,217,0.8)', fontFamily: FONT_FAMILY, lineHeight: 1, background: isDarkMode ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.06)' }}>DEEP</span>
                            )}
                            <span className="text-[10px]" style={{ color: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.25)', marginLeft: 2, fontFamily: FONT_FAMILY }}>{formatTimestamp(block.timestamp)}</span>
                            {block.completedAt && block.startedAt && (
                              <span className="text-[10px] font-sans" style={{ color: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.3)' }}>
                                {formatDuration(Math.round((block.completedAt - block.startedAt) / 1000))}{block.tokenCount ? <span style={{ color: 'rgba(43,121,255,0.4)' }}> · {formatTokens(block.tokenCount)}</span> : ''}
                              </span>
                            )}
                            {!block.completedAt && block.startedAt && (
                              <LiveTimer startedAt={block.startedAt} completedAt={block.completedAt} tokenCount={block.tokenCount} />
                            )}
                          </div>
                          {/* ── Routing trace — collapsible full routing pipeline ── */}
                          {(block as any).routingTrace && (block as any).routingTrace.length > 0 && (() => {
                            const trace = (block as any).routingTrace as Array<{ phase: string; decision: string; tools?: string[]; model?: string; durationMs?: number; timestamp: number }>;
                            const lastModel = trace.find(t => t.model)?.model || trace.find(t => t.phase === 'model-select')?.decision;
                            const totalMs = trace.reduce((sum, t) => sum + (t.durationMs || 0), 0);
                            const mutedColor = isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
                            const dimColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)';
                            return (
                              <details className="group mb-1.5">
                                <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none py-0.5" style={{ color: mutedColor }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                  {!block.completedAt && isPageVisible && !cancelledRef.current ? (
                                    <TextShimmer
                                      className={`text-[11px] ${isDarkMode ? '[--shimmer-base:rgba(255,255,255,0.22)] [--shimmer-highlight:rgba(255,255,255,0.75)]' : '[--shimmer-base:rgba(0,0,0,0.2)] [--shimmer-highlight:rgba(0,0,0,0.7)]'}`}
                                      duration={1.6}
                                    >
                                      {(block as any).isDeepReasoning
                                        ? 'Deep Reasoning — nemotron 120B...'
                                        : `Routing${lastModel ? ` → ${lastModel}` : ''}...`}
                                    </TextShimmer>
                                  ) : (
                                    <span className="text-[11px]">
                                      {(block as any).isDeepReasoning
                                        ? `Deep Reasoning — nemotron 120B${totalMs > 0 ? ` · ${totalMs}ms` : ''}`
                                        : `Routed${lastModel ? ` → ${lastModel}` : ''}${totalMs > 0 ? ` · ${totalMs}ms` : ''}`}
                                    </span>
                                  )}
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6"/></svg>
                                </summary>
                                <div className="ml-5 mt-1 space-y-0.5 pb-1">
                                  {trace.map((rt, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px]" style={{ color: dimColor }}>
                                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: dimColor }} />
                                      <span className="font-medium shrink-0 opacity-70" style={{ minWidth: 65 }}>{rt.phase}</span>
                                      <span className="truncate opacity-60">{rt.decision}</span>
                                      {rt.durationMs != null && <span className="ml-auto shrink-0 opacity-40 tabular-nums">{rt.durationMs}ms</span>}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          })()}
                          {/* ── Reasoning + tools — grouped into one section ── */}
                          {block.steps && block.steps.length > 0 && (() => {
                            const completedSteps = block.steps.filter(s => !s.isThinking);
                            const activeStep = block.steps.find(s => s.isThinking);
                            const allTools = completedSteps.flatMap(s => s.entries.filter(e => e.type === 'action').map(e => (e as { type: 'action'; pill: ActionPill }).pill));
                            const toolCount = allTools.length;
                            const stepCount = completedSteps.filter(s => s.thinkingText).length;
                            const muted = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                            const dim = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.22)';
                            return (
                              <div className="mb-2 space-y-1">
                                {/* All completed iterations grouped under one collapsible */}
                                {completedSteps.length > 0 && (
                                  <details className="group" open={!!activeStep}>
                                    <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none py-0.5" style={{ color: muted }}>
                                      <span className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center" style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dim }} />
                                      </span>
                                      {activeStep && !cancelledRef.current ? (
                                        <TextShimmer
                                          className={`text-[11px] ${isDarkMode ? '[--shimmer-base:rgba(255,255,255,0.28)] [--shimmer-highlight:rgba(255,255,255,0.8)]' : '[--shimmer-base:rgba(0,0,0,0.26)] [--shimmer-highlight:rgba(0,0,0,0.72)]'}`}
                                          duration={1.7}
                                        >
                                          {`Reasoning${stepCount > 0 ? ` · ${stepCount} step${stepCount !== 1 ? 's' : ''}` : ''}${toolCount > 0 ? ` · ${toolCount} tool${toolCount !== 1 ? 's' : ''}` : ''}...`}
                                        </TextShimmer>
                                      ) : (
                                        <span className="text-[11px]">
                                          Reasoned{stepCount > 0 ? ` · ${stepCount} step${stepCount !== 1 ? 's' : ''}` : ''}
                                          {toolCount > 0 ? ` · ${toolCount} tool${toolCount !== 1 ? 's' : ''}` : ''}
                                        </span>
                                      )}
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6"/></svg>
                                    </summary>
                                    <div className="ml-4 mt-0.5 space-y-0.5 pb-0.5">
                                      {completedSteps.map((step, idx) => {
                                        const isStepExpanded = expandedSteps.has(idx);
                                        return (
                                        <div key={step.id} className="space-y-0">
                                          {/* Thought text -- clickable to expand */}
                                          {step.thinkingText && (
                                            <div
                                              className="flex gap-1.5 mb-1 rounded px-0.5 -mx-0.5 transition-colors"
                                              style={{ cursor: 'pointer' }}
                                              onClick={() => setExpandedSteps(prev => {
                                                const next = new Set(prev);
                                                next.has(idx) ? next.delete(idx) : next.add(idx);
                                                return next;
                                              })}
                                              onMouseEnter={e => (e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
                                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                              <span className="text-[10px] shrink-0 tabular-nums" style={{ color: dim, minWidth: 14, textAlign: 'right' }}>{idx + 1}.</span>
                                              <span className="text-[8px] shrink-0 select-none" style={{ color: dim, lineHeight: '16px' }}>{isStepExpanded ? '\u25BE' : '\u25B8'}</span>
                                              <span className="text-[10px] leading-relaxed" style={{ color: dim, fontStyle: 'italic' }}>
                                                {isStepExpanded
                                                  ? step.thinkingText
                                                  : step.thinkingText.length > 150 ? step.thinkingText.slice(0, 150) + '\u2026' : step.thinkingText}
                                              </span>
                                              {(step as any).durationMs != null && (
                                                <span className="ml-auto shrink-0 text-[9px] tabular-nums" style={{ color: dim, opacity: 0.6 }}>{(step as any).durationMs}ms</span>
                                              )}
                                            </div>
                                          )}
                                          {/* Tool actions from entries */}
                                          {step.entries.filter(e => e.type === 'action').map((e) => {
                                            const pill = (e as { type: 'action'; pill: ActionPill }).pill;
                                            const isSearch = pill.toolName?.includes('search') || pill.toolName?.includes('browse');
                                            const isWrite = pill.toolName?.includes('write') || pill.toolName?.includes('edit') || pill.toolName?.includes('save');
                                            const iconC = isSearch ? 'rgba(59,130,246,0.55)' : isWrite ? 'rgba(168,85,247,0.55)' : dim;
                                            const isToolExpanded = expandedTools.has(pill.id);
                                            return (
                                              <div key={pill.id} className="ml-3 mb-0">
                                                <div
                                                  className="flex items-center gap-1.5 px-2 py-1"
                                                  style={{
                                                    borderRadius: isToolExpanded ? '6px 6px 0 0' : 6,
                                                    background: pill.status === 'running'
                                                      ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 80%, transparent 100%)'
                                                      : (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                                                    backgroundSize: pill.status === 'running' ? '1000px 100%' : 'auto',
                                                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.055)'}`,
                                                    borderBottom: isToolExpanded ? 'none' : undefined,
                                                    opacity: pill.status === 'done' ? 0.65 : 1,
                                                    cursor: pill.status === 'done' ? 'pointer' : 'default',
                                                    transition: 'background 0.3s',
                                                    animation: pill.status === 'running' && !cancelledRef.current ? 'toolShimmer 2.5s linear infinite' : 'none',
                                                  }}
                                                  onClick={() => {
                                                    if (pill.status !== 'done') return;
                                                    setExpandedTools(prev => {
                                                      const next = new Set(prev);
                                                      next.has(pill.id) ? next.delete(pill.id) : next.add(pill.id);
                                                      return next;
                                                    });
                                                  }}
                                                >
                                                  {/* Icon box */}
                                                  <span className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center shrink-0" style={{ background: isSearch ? 'rgba(59,130,246,0.1)' : isWrite ? 'rgba(168,85,247,0.1)' : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') }}>
                                                    {isSearch
                                                      ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconC} strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                                      : isWrite
                                                      ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconC} strokeWidth="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                      : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconC} strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                                    }
                                                  </span>
                                                  {/* Chevron for done tools */}
                                                  {pill.status === 'done' && (
                                                    <span className="text-[8px] shrink-0 select-none" style={{ color: dim }}>{isToolExpanded ? '\u25BE' : '\u25B8'}</span>
                                                  )}
                                                  {/* Label -- plain text (box pulses instead) */}
                                                  <span className="text-[10px] leading-tight truncate flex-1 min-w-0" style={{
                                                    color: pill.status === 'running'
                                                      ? (isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)')
                                                      : iconC,
                                                  }}>{pill.argsPreview || pill.toolName}</span>
                                                  {/* Status badge */}
                                                  {pill.status === 'done' && <svg className="ml-auto shrink-0" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                                                  {pill.status === 'error' && <svg className="ml-auto shrink-0" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.55)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                                                </div>
                                                {/* Expanded tool details */}
                                                {isToolExpanded && (
                                                  <div
                                                    className="px-2 py-1.5 text-[9px] leading-relaxed space-y-1"
                                                    style={{
                                                      borderRadius: '0 0 6px 6px',
                                                      background: isDarkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
                                                      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.055)'}`,
                                                      borderTop: 'none',
                                                      color: dim,
                                                    }}
                                                  >
                                                    {pill.argsPreview && (
                                                      <div>
                                                        <span style={{ opacity: 0.5 }}>Args: </span>
                                                        <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{pill.argsPreview}</span>
                                                      </div>
                                                    )}
                                                    {(pill as any).resultPreview && (
                                                      <div>
                                                        <span style={{ opacity: 0.5 }}>Result: </span>
                                                        <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{(pill as any).resultPreview}</span>
                                                      </div>
                                                    )}
                                                    {!(pill as any).resultPreview && !pill.argsPreview && (
                                                      <span style={{ opacity: 0.4 }}>No details available</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                )}
                                {/* Active thinking at bottom — only one, always last */}
                                {activeStep && !cancelledRef.current && (
                                  <div className="flex items-center gap-2 py-0.5">
                                    <ThinkingMorph size={14} />
                                    <TextShimmer
                                      className={`text-[11px] font-medium ${isDarkMode ? '[--shimmer-base:rgba(255,255,255,0.35)] [--shimmer-highlight:rgba(147,197,253,0.95)]' : '[--shimmer-base:rgba(0,0,0,0.3)] [--shimmer-highlight:rgba(37,99,235,0.9)]'}`}
                                      duration={1.6}
                                    >
                                      Thinking...
                                    </TextShimmer>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* ── Agent content in glass bubble ── */}
                          {block.content && (() => {
                            const isNew = !seenBlockContentRef.current.has(block.id);
                            if (isNew) seenBlockContentRef.current.add(block.id);
                            const isRecent = isNew;
                            return (
                              <div className="mb-3 space-y-1.5">
                                <div style={{
                                  background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                                  borderRadius: 14,
                                  padding: '10px 14px',
                                  border: isDarkMode ? 'none' : '1px solid rgba(0,0,0,0.06)',
                                }}>
                                  <AnimatedAgentText text={block.content} animate={isNew && isRecent} />
                                </div>
                                {/* ── Open in Canvas button ── Only show for document-like content */}
                                {block.content && shouldShowOpenCanvasButton(block.content) && (
                                  <button
                                    onClick={() => {
                                      canvasState.openCanvas({
                                        title: 'Response',
                                        content: block.content,
                                        fileType: 'md',
                                        isWriting: false,
                                      });
                                    }}
                                    className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                                    style={{
                                      background: isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
                                      border: isDarkMode ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(139,92,246,0.2)',
                                      color: isDarkMode ? 'rgba(139,92,246,0.8)' : 'rgba(139,92,246,0.75)',
                                      cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.background = isDarkMode ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.15)';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)';
                                    }}
                                  >
                                    ✎ Open in Canvas
                                  </button>
                                )}
                                {/* ── Neuro rewrite section ── */}
                                {block.neuroRewrite && (
                                  <details className="group">
                                    <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none py-0.5 px-2" style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                                      <span className="text-[11px] font-medium">Rewritten by {block.neuroRewrite.model}</span>
                                      {block.neuroRewrite.verification && (
                                        <span
                                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                          style={{
                                            background: block.neuroRewrite.verification.passed
                                              ? (isDarkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)')
                                              : (isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'),
                                            color: block.neuroRewrite.verification.passed
                                              ? (isDarkMode ? '#10b981' : '#059669')
                                              : (isDarkMode ? '#ef4444' : '#dc2626'),
                                            border: `1px solid ${
                                              block.neuroRewrite.verification.passed
                                                ? (isDarkMode ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.25)')
                                                : (isDarkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)')
                                            }`,
                                          }}
                                        >
                                          ✓ {block.neuroRewrite.verification.passed ? 'PASS' : 'FAIL'} ({block.neuroRewrite.verification.model.replace('qwen3.5:', '')} · {block.neuroRewrite.verification.durationMs}ms)
                                        </span>
                                      )}

                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6"/></svg>
                                    </summary>
                                    <div className="ml-2 mt-1.5 space-y-1.5">
                                      {/* Original version */}
                                      <div style={{
                                        background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                                        borderRadius: 10,
                                        padding: '8px 12px',
                                        border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
                                      }}>
                                        <div className="text-[10px] font-medium mb-1" style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>Original ({block.neuroRewrite.model.replace('NEURO-', 'Qwen')})</div>
                                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.65)' }}>
                                          {block.neuroRewrite.original}
                                        </div>
                                      </div>
                                      {/* Rewritten version */}
                                      <div style={{
                                        background: isDarkMode ? 'rgba(102,255,102,0.04)' : 'rgba(34,197,94,0.03)',
                                        borderRadius: 10,
                                        padding: '8px 12px',
                                        border: isDarkMode ? '1px solid rgba(102,255,102,0.08)' : '1px solid rgba(34,197,94,0.1)',
                                      }}>
                                        <div className="text-[10px] font-medium mb-1" style={{ color: isDarkMode ? 'rgba(102,255,102,0.6)' : 'rgba(34,197,94,0.7)' }}>Rewritten (Neuro)</div>
                                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.8)' }}>
                                          {block.neuroRewrite.rewritten}
                                        </div>
                                      </div>
                                    </div>
                                  </details>
                                )}
                                {/* ── Sources section ── */}
                                <BlockSources content={block.content} findings={block.researchFindings} isDarkMode={isDarkMode} />
                              </div>
                            );
                          })()}
                          {/* ── Empty state: routing / thinking (hide if routing trace exists) ── */}
                          {!block.content && (!block.steps || block.steps.length === 0) && (status === 'routing' || status === 'thinking') && !cancelledRef.current && !(block as any).routingTrace?.length && (
                            <div className="flex items-center gap-2 py-1">
                              {status === 'thinking' ? (
                                <ThinkingMorph size={14} />
                              ) : (
                                <OrbitalLoader size={16} />
                              )}
                              <TextShimmer
                                className={`text-[12px] ${isDarkMode ? '[--shimmer-base:rgba(255,255,255,0.35)] [--shimmer-highlight:rgba(255,255,255,0.9)]' : '[--shimmer-base:rgba(0,0,0,0.3)] [--shimmer-highlight:rgba(0,0,0,0.8)]'}`}
                                duration={1.6}
                              >
                                {status === 'routing' ? 'Routing...' : 'Thinking...'}
                              </TextShimmer>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  case 'upload':
                    return (
                      <div key={block.id} className="flex justify-end">
                        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderRadius: 12, background: isDarkMode ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.08)', border: isDarkMode ? '1px solid rgba(34,197,94,0.12)' : '1px solid rgba(34,197,94,0.18)' }}>
                          <span style={{ color: isDarkMode ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.6)' }}><UploadIcon /></span>
                          <span className="text-[11px] font-medium" style={{ color: isDarkMode ? 'rgba(34,197,94,0.7)' : 'rgba(22,163,74,0.8)' }}>Uploaded: {block.uploadFilename}</span>
                          <span className="text-[10px] font-sans" style={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)' }}>({block.uploadSize})</span>
                        </div>
                      </div>
                    );
                }
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        {/* BottomStatusBar removed — tool usage shown inline */}

        {/* Scroll button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }} onClick={scrollToBottom} className="absolute left-1/2 -translate-x-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:brightness-125" style={{ bottom: 130, background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
              <ArrowDownIcon />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Ask User */}
        {askUserPrompt && (
          <LiquidGlass intensity="medium" className="px-5 py-3 relative z-30" style={{ borderTop: '1px solid rgba(43,121,255,0.12)', borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none', background: 'rgba(43,121,255,0.04)' }}>
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgba(59,130,246,0.8)' }} /><span className="text-[12px] font-medium" style={{ color: 'rgba(43,121,255,0.8)' }}>Agent is asking:</span></div>
              <p className="text-[13px] mb-3" style={{ color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)', fontFamily: FONT_FAMILY }}>{askUserPrompt.question}</p>
              {askUserPrompt.options.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {askUserPrompt.options.map((opt, i) => (
                    <button key={i} onClick={() => { askUserPrompt.resolve(opt); setAskUserPrompt(null); setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'user' as const, content: opt, timestamp: Date.now() }]); }} className="nomad-glass-btn nomad-glass-btn-primary px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ color: 'rgba(43,121,255,0.8)' }}>{opt}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={askUserInput} onChange={e => setAskUserInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && askUserInput.trim()) { askUserPrompt.resolve(askUserInput.trim()); setAskUserPrompt(null); setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'user' as const, content: askUserInput.trim(), timestamp: Date.now() }]); setAskUserInput(''); } }} placeholder="Type your answer..." className="flex-1 bg-transparent text-[12px] outline-none px-3 py-2 rounded-lg" style={{ background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)', color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', fontFamily: FONT_FAMILY }} />
                <button onClick={() => { if (askUserInput.trim()) { askUserPrompt.resolve(askUserInput.trim()); setAskUserPrompt(null); setBlocks(prev => [...prev, { id: crypto.randomUUID(), type: 'user' as const, content: askUserInput.trim(), timestamp: Date.now() }]); setAskUserInput(''); } }} className="nomad-glass-btn nomad-glass-btn-primary px-3 py-2 rounded-lg text-[11px] font-medium" style={{ color: 'rgba(43,121,255,0.8)' }}>Send</button>
              </div>
            </div>
          </LiquidGlass>
        )}

        {/* Permission Mode Control Bar */}
        <div className="px-5 py-2 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', background: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}>
          <div className="max-w-3xl mx-auto w-full flex items-center justify-end">
            <PermissionModeDropdown />
          </div>
        </div>

        {/* Permission Approval Banner — inline, above input */}
        {permissionPrompt && (
          <div className="px-5 pb-2 relative z-20">
            <div className="max-w-3xl mx-auto w-full">
              <PermissionApprovalBanner
                permission={permissionPrompt}
                onApprove={() => handlePermissionResponse(true)}
                onDeny={() => handlePermissionResponse(false)}
              />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="px-5 pb-4 pt-2 relative z-10">
          <div className="max-w-3xl mx-auto w-full" style={{ position: 'relative' }}>
            {/* @ mention popover — only show when input is focused */}
            {mentionPopover && inputRef.current === document.activeElement && (() => {
              const allItems = getFilteredMentionItems(mentionPopover.query);
              if (!allItems.length) return null;
              const toolItems = allItems.filter(i => i.category === 'tool');
              const agentItems = allItems.filter(i => i.category === 'agent');
              const mediaItems = allItems.filter(i => i.category === 'media');
              let idx = 0;
              const renderGroup = (label: string, items: typeof allItems) => {
                if (!items.length) return null;
                return (
                  <div key={label}>
                    <div style={{ padding: '4px 12px 2px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)', fontFamily: FONT_FAMILY }}>{label}</div>
                    {items.map(item => {
                      const i = idx++;
                      return (
                        <button
                          key={item.insert}
                          onMouseDown={e => { e.preventDefault(); insertMention(item); }}
                          onMouseEnter={() => setMentionSelected(i)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 12px',
                            background: i === mentionSelected ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                            border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                            fontFamily: FONT_FAMILY,
                            transition: 'background 0.08s',
                          }}
                        >
                          <ToolIcon name={item.insert.replace('@', '')} size={22} />
                          <span style={{ fontWeight: 600, fontSize: 11.5, color: isDarkMode ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)', flexShrink: 0 }}>{item.label}</span>
                          <span style={{ fontSize: 10.5, color: isDarkMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.32)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              };
              return (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, background: isDarkMode ? '#1a1a1a' : '#ffffff', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)', borderRadius: 16, boxShadow: isDarkMode ? '0 16px 48px rgba(0,0,0,0.6)' : '0 8px 40px rgba(0,0,0,0.14)', overflow: 'hidden', zIndex: 200, padding: '6px 0 8px' }}>
                  {renderGroup('Tools', toolItems)}
                  {renderGroup('Subagents', agentItems)}
                  {renderGroup('Media', mediaItems)}
                </div>
              );
            })()}

            <div className="nomad-glass-medium" style={{ borderRadius: 15, position: 'relative', boxShadow: '0px 4px 15px rgba(0,0,0,0.05)', pointerEvents: 'auto', zIndex: 10 }} onDrop={handleInputDrop} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}>
              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3.5 pt-3 pb-1">
                  {attachments.map(att => (
                    <div key={att.id} className="relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
                      {att.type === 'image' ? (
                        <img src={att.dataUrl} alt={att.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <span className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'rgba(43,121,255,0.08)', color: 'rgba(43,121,255,0.6)' }}><FileDocIcon /></span>
                      )}
                      <span className="text-[10px] max-w-[80px] truncate" style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>{att.name}</span>
                      <button onClick={() => removeAttachment(att.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(239,68,68,0.8)', color: '#fff' }}><XIcon /></button>
                    </div>
                  ))}
                </div>
              )}
              {/* Subagent mention indicators */}
              {mentionedSubagents.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3.5 pt-3 pb-1">
                  {mentionedSubagents.map(num => (
                    <div key={`sub${num}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                      <span className="text-[10px] font-semibold" style={{ color: 'rgba(139, 92, 246, 0.8)' }}>@sub{num}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 px-3.5 py-3">
                <div
                  ref={inputRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInputChange as unknown as React.FormEventHandler<HTMLDivElement>}
                  onKeyDown={handleKeyDown}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onMouseDown={(e) => { if (e.button === 2) e.preventDefault(); }}
                  onPaste={e => {
                    const items = Array.from(e.clipboardData?.items || []);
                    const hasFile = items.some(i => i.kind === 'file');
                    if (hasFile) {
                      handlePaste(e as unknown as React.ClipboardEvent<HTMLTextAreaElement>);
                      return;
                    }
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                  }}
                  data-placeholder="Ask anything"
                  className={`flex-1 bg-transparent text-[13px] leading-relaxed outline-none ${isDarkMode ? 'placeholder-dark' : 'placeholder-light'}`}
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)',
                    minHeight: 24,
                    maxHeight: 120,
                    overflowY: 'auto',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontFamily: FONT_FAMILY,
                  }}
                />
                {isWorking ? (
                  <button onClick={handleStop} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.7)' }}><StopIcon /></button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim() && attachments.length === 0}
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                      color: isDarkMode ? '#0c0c0c' : '#ffffff',
                      opacity: (input.trim() || attachments.length > 0) ? 1 : 0.25,
                      transition: 'opacity 0.15s ease',
                    }}
                  ><ArrowUpIcon /></button>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
      </div>

      {/* Canvas Side Panel */}
      {canvasState.isOpen && canvasState.content && (
        <CanvasPanel
          content={canvasState.content}
          onClose={canvasState.closeCanvas}
          onDownload={(blob, filename) => {
            saveAs(blob, filename);
          }}
          onEditModeChange={canvasState.setEditMode}
          isAIWriting={canvasState.isAIWriting}
        />
      )}

      {/* Chat Conflict Modal */}
      <AnimatePresence>
        {chatConflictModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setChatConflictModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 rounded-lg p-6 max-w-sm"
              style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>Chat operation in progress</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>You're currently running an agent task. Do you want to stop it and switch chats, or keep working?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setChatConflictModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                >
                  Keep working
                </button>
                <button
                  onClick={() => {
                    const targetId = chatConflictModal.targetChatId;
                    setChatConflictModal(null);
                    handleSelectConversation(targetId, true);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.9)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                >
                  Stop and switch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
