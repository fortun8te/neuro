// BrandDNAChat — natural language editor for campaign.presetData
// Sits below the Brand DNA button in the LeftPanel.
// User types e.g. "add sustainability to core values" → LLM returns JSON delta → merged into presetData

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { ollamaService } from '../utils/ollama';
import { getResearchModelConfig } from '../utils/modelConfig';
import type { Campaign } from '../types';

// ─────────────────────────────────────────────────────────────
// Deep merge utility (shallow at each level, recurse on objects)
// ─────────────────────────────────────────────────────────────

function deepMerge(target: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(patch)) {
    const tv = target[key];
    const pv = patch[key];
    if (pv !== null && typeof pv === 'object' && !Array.isArray(pv) && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv, pv);
    } else {
      result[key] = pv;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Extract JSON from LLM response (handles ```json fences)
// ─────────────────────────────────────────────────────────────

function extractJSON(text: string): Record<string, any> | null {
  // Strip ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();

  // Find outermost { ... }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Build a compact context snapshot (cap at ~4K chars)
// ─────────────────────────────────────────────────────────────

function buildContext(presetData: Record<string, any>): string {
  const snap: Record<string, any> = {};
  const sections = ['brand', 'audience', 'product', 'competitive', 'messaging', 'creative'];
  for (const s of sections) {
    if (presetData[s]) snap[s] = presetData[s];
  }
  const full = JSON.stringify(snap, null, 2);
  if (full.length <= 4000) return full;
  // Truncate gracefully
  return full.slice(0, 3900) + '\n... (truncated)';
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface StatusMsg {
  kind: 'ok' | 'err' | 'info';
  text: string;
}

interface BrandDNAChatProps {
  campaign: Campaign;
  isDark: boolean;
}

export function BrandDNAChat({ campaign, isDark }: BrandDNAChatProps) {
  const { updateCampaign } = useCampaign() as any;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatus = useCallback((ms = 4000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus(null), ms);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const submit = useCallback(async () => {
    const instruction = input.trim();
    if (!instruction || loading) return;

    setLoading(true);
    setStatus({ kind: 'info', text: 'Thinking…' });

    const presetData = campaign.presetData ?? {};
    const context = buildContext(presetData);
    const model = getResearchModelConfig().orchestratorModel;

    const systemPrompt = `You are a brand data editor. You will receive the current brand brief as JSON and an edit instruction. Return ONLY a valid JSON object containing the fields to update, using the same nested structure. Only include changed fields. No explanation.`;

    const prompt = `Current brand data:
${context}

Instruction: "${instruction}"

Return ONLY the JSON delta (changed fields only).`;

    let fullResponse = '';

    try {
      await ollamaService.generateStream(prompt, systemPrompt, {
        model,
        temperature: 0.3,
        onChunk: (chunk: string) => { fullResponse += chunk; },
      });

      const delta = extractJSON(fullResponse);

      if (!delta || Object.keys(delta).length === 0) {
        setStatus({ kind: 'err', text: 'No changes returned — try rephrasing' });
        clearStatus(5000);
        setLoading(false);
        return;
      }

      // Apply delta: deep merge into each top-level section
      const newPresetData = deepMerge(presetData, delta);
      await updateCampaign({ presetData: newPresetData });

      const changed = Object.keys(delta).join(', ');
      setStatus({ kind: 'ok', text: `Updated: ${changed}` });
      clearStatus(4000);
      setInput('');
    } catch (err) {
      setStatus({ kind: 'err', text: String(err).slice(0, 80) });
      clearStatus(6000);
    }

    setLoading(false);
  }, [input, loading, campaign, updateCampaign, clearStatus]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const dim = isDark ? 'text-zinc-600' : 'text-zinc-400';
  const divider = isDark ? 'border-zinc-800/60' : 'border-zinc-100';
  const bg = isDark ? 'bg-zinc-800/50' : 'bg-zinc-50';
  const border = isDark ? 'border-zinc-700/50' : 'border-zinc-200';

  return (
    <div className={`border-b ${divider}`}>
      {/* Header row — toggles expanded */}
      <button
        onClick={() => { setExpanded(e => !e); if (!expanded) setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`w-full px-4 py-2.5 flex items-center gap-2 transition-colors text-left ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-zinc-50'}`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#3f3f46' : '#d4d4d8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className={`text-[11px] font-medium flex-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Edit Brand DNA</span>
        <svg
          width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#3f3f46' : '#d4d4d8'}
          strokeWidth="3" strokeLinecap="round"
          className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Expanded chat area */}
      {expanded && (
        <div className="px-3 pb-3">
          <div className={`relative rounded-lg border ${border} ${bg} overflow-hidden`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
              placeholder={`e.g. "add sustainability to core values"\nor "change tone to more playful"`}
              rows={3}
              className={`w-full px-2.5 pt-2 pb-7 text-[11px] leading-relaxed resize-none outline-none bg-transparent ${
                isDark ? 'text-zinc-300 placeholder-zinc-700' : 'text-zinc-700 placeholder-zinc-400'
              } disabled:opacity-50`}
            />
            {/* Send button pinned bottom-right */}
            <button
              onClick={submit}
              disabled={!input.trim() || loading}
              className={`absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-all disabled:opacity-30 ${
                isDark
                  ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:hover:bg-zinc-700'
                  : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300 disabled:hover:bg-zinc-200'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
                  <span>…</span>
                </span>
              ) : (
                '↵ Update'
              )}
            </button>
          </div>

          {/* Status */}
          {status && (
            <p className={`mt-1.5 text-[10px] leading-snug px-0.5 transition-opacity ${
              status.kind === 'ok'   ? (isDark ? 'text-emerald-500' : 'text-emerald-600') :
              status.kind === 'err'  ? (isDark ? 'text-red-400' : 'text-red-500') :
              dim
            }`}>
              {status.text}
            </p>
          )}

          <p className={`mt-1 text-[9px] ${dim} px-0.5`}>
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      )}
    </div>
  );
}
