import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Cycle, StageName } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ResearchOutput } from './ResearchOutput';
import { ModelOutputDebug } from './ModelOutputDebug';
import { MakeTestPanel } from './MakeTestPanel';
import { tokenTracker } from '../utils/tokenStats';
import { ShineText } from './ShineText';
import { WordCycler } from './WordCycler';

const STAGE_INFO: Record<StageName, { label: string; description: string; icon: string }> = {
  'research':    { label: 'Research',    description: 'Market & audience analysis',     icon: 'R' },
  'brand-dna':   { label: 'Brand DNA',   description: 'Brand identity & style',         icon: 'D' },
  'persona-dna': { label: 'Persona DNA', description: 'Customer personas',              icon: 'P' },
  'angles':      { label: 'Angles',      description: 'Ad angle brainstorm',            icon: 'A' },
  'strategy':    { label: 'Strategy',    description: 'Angle evaluation',               icon: 'S' },
  'copywriting': { label: 'Copywriting', description: 'Ad messaging',                   icon: 'C' },
  'production':  { label: 'Production',  description: 'Ad generation',                  icon: 'M' },
  'test':        { label: 'Test',        description: 'Evaluation',                     icon: 'T' },
};


interface StagePanelProps {
  cycle: Cycle | null;
  isRunning?: boolean;
  isDarkMode?: boolean;
  viewStage?: StageName | null;
  onUpdateOutput?: (stageName: StageName, output: string) => void;
  onPauseForInput?: (event: any) => Promise<string>;
}

export function StagePanel({ cycle, isRunning, isDarkMode: propDarkMode, viewStage }: StagePanelProps) {
  const { isDarkMode: themeDarkMode } = useTheme();
  const isDarkMode = propDarkMode !== undefined ? propDarkMode : themeDarkMode;
  const outputRef = useRef<HTMLDivElement>(null);
  const [prevStage, setPrevStage] = useState<StageName | null>(null);
  const [, setTick] = useState(0);
  const tokenInfo = useSyncExternalStore(tokenTracker.subscribe, tokenTracker.getSnapshot);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [cycle?.stages[cycle?.currentStage || 'research']?.agentOutput]);

  useEffect(() => {
    if (cycle && cycle.currentStage !== prevStage && prevStage !== null) {
      setPrevStage(cycle.currentStage);
    } else if (cycle && !prevStage) {
      setPrevStage(cycle.currentStage);
    }
  }, [cycle?.currentStage, prevStage]);

  if (!cycle) return null;

  const currentStage = viewStage || cycle.currentStage;
  const stageData = cycle.stages[currentStage];
  if (!stageData) return null;

  const elapsed = stageData.startedAt
    ? Math.round(((stageData.completedAt || Date.now()) - stageData.startedAt) / 1000)
    : null;

  const info = STAGE_INFO[currentStage];

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  };

  const statusLabel = stageData.status === 'in-progress' ? 'Running' : stageData.status === 'complete' ? 'Complete' : 'Pending';

  return (
    <div className={`rounded-2xl overflow-hidden relative ${
      isDarkMode
        ? 'bg-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]'
        : 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)]'
    }`}>
      {/* Header */}
      <div className={`px-5 py-3.5 flex items-center justify-between ${
        isDarkMode ? 'border-b border-zinc-800/60' : 'border-b border-zinc-100'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
            stageData.status === 'in-progress'
              ? isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              : stageData.status === 'complete'
              ? isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              : isDarkMode ? 'bg-zinc-800/50 text-zinc-600' : 'bg-zinc-50 text-zinc-300'
          }`}>
            {info.icon}
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>{info.label}</h3>
            <p className={`text-[11px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>{info.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
            stageData.status === 'in-progress'
              ? isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              : stageData.status === 'complete'
              ? isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              : isDarkMode ? 'bg-zinc-800/50 text-zinc-600' : 'bg-zinc-50 text-zinc-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              stageData.status === 'in-progress'
                ? (isDarkMode ? 'bg-emerald-400' : 'bg-emerald-500') + ' animate-pulse'
                : stageData.status === 'complete'
                ? isDarkMode ? 'bg-zinc-500' : 'bg-zinc-400'
                : isDarkMode ? 'bg-zinc-700' : 'bg-zinc-300'
            }`} />
            {statusLabel}
          </span>
          {elapsed !== null && (
            <span className={`text-xs font-medium tabular-nums ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {formatTime(elapsed)}
            </span>
          )}
        </div>
      </div>

      {/* Output Console */}
      <div
        ref={outputRef}
        className={`${currentStage === 'research' ? 'p-5 min-h-[500px] max-h-[700px]' : 'p-5 h-96'} overflow-y-auto ${
          isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50/50'
        } space-y-2`}
      >
        {stageData.agentOutput ? (
          <div className="space-y-2">
            {prevStage && prevStage !== currentStage && (
              <div className={`border-l-2 pl-3 py-1 text-[11px] ${
                isDarkMode ? 'border-zinc-700 text-zinc-500' : 'border-zinc-300 text-zinc-400'
              }`}>
                {currentStage}
              </div>
            )}

            {currentStage === 'research' ? (
              <ResearchOutput output={stageData.agentOutput} isDarkMode={isDarkMode} />
            ) : (
              <div className={`${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {stageData.agentOutput.split('\n').map((line, idx) => (
                  <div key={idx} className={`text-[13px] leading-relaxed ${
                    line.startsWith('§')
                      ? isDarkMode ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold'
                      : ''
                  }`}>
                    {line.startsWith('§') ? line.substring(1) : line || <span className={isDarkMode ? 'text-zinc-800' : 'text-zinc-200'}>.</span>}
                  </div>
                ))}
              </div>
            )}

            <ModelOutputDebug
              rawOutput={stageData.rawOutput}
              model={stageData.model}
              tokensUsed={stageData.tokensUsed}
              processingTime={stageData.processingTime}
              stageName={currentStage}
            />
          </div>
        ) : (
          <>
            {currentStage === 'production' && !isRunning ? (
              <MakeTestPanel isDarkMode={isDarkMode} />
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                {isRunning ? (
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full animate-slow-bounce ${isDarkMode ? 'bg-zinc-600' : 'bg-zinc-300'}`} />
                      <div className={`w-1.5 h-1.5 rounded-full animate-slow-bounce ${isDarkMode ? 'bg-zinc-600' : 'bg-zinc-300'}`} style={{animationDelay:'0.15s'}} />
                      <div className={`w-1.5 h-1.5 rounded-full animate-slow-bounce ${isDarkMode ? 'bg-zinc-600' : 'bg-zinc-300'}`} style={{animationDelay:'0.3s'}} />
                    </div>
                    <ShineText variant={isDarkMode ? 'dark' : 'light'} className="text-[11px]" speed={2.5}>
                      Awaiting output
                    </ShineText>
                  </div>
                ) : (
                  <span className={`text-[11px] ${isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}`}>No output yet</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Live Activity Bar ── */}
      {stageData.status === 'in-progress' && (
        <div className={`px-5 py-2.5 flex items-center justify-between ${
          isDarkMode
            ? 'border-t border-zinc-800/60 bg-zinc-900/80'
            : 'border-t border-zinc-100 bg-white/80'
        } backdrop-blur-sm`}>
          {/* Left: Status + Model */}
          <div className="flex items-center gap-3">
            {/* Pulsing status dot */}
            <div className={`w-2 h-2 rounded-full ${
              tokenInfo.isModelLoading
                ? 'bg-amber-400 animate-pulse'
                : tokenInfo.isThinking
                ? 'bg-violet-400 animate-pulse'
                : tokenInfo.isGenerating
                ? 'bg-emerald-400 animate-pulse'
                : isDarkMode ? 'bg-zinc-600 animate-pulse' : 'bg-zinc-300 animate-pulse'
            }`} />

            {/* Status label */}
            {tokenInfo.isModelLoading ? (
              <WordCycler
                prefix="Loading"
                words={['model', 'weights', 'context', 'layers', 'model']}
                color={isDarkMode ? '#fbbf24' : '#d97706'}
                speed={3}
                className="text-xs font-medium"
              />
            ) : (
              <span className={`text-xs font-medium ${
                tokenInfo.isThinking
                  ? isDarkMode ? 'text-violet-400' : 'text-violet-600'
                  : tokenInfo.isGenerating
                  ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                {tokenInfo.isThinking ? 'Thinking' : tokenInfo.isGenerating ? 'Generating' : 'Processing'}
              </span>
            )}

            {/* Model name pill */}
            {tokenInfo.activeModel && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {tokenInfo.activeModel.split(':')[0]}
              </span>
            )}

            {/* Loading timer */}
            {tokenInfo.isModelLoading && tokenInfo.callStartTime && (
              <span className={`text-[11px] tabular-nums ${isDarkMode ? 'text-amber-500/70' : 'text-amber-600/70'}`}>
                {Math.floor((Date.now() - tokenInfo.callStartTime) / 1000)}s
              </span>
            )}
          </div>

          {/* Right: Token metrics */}
          <div className="flex items-center gap-3 tabular-nums">
            {/* Live token count for current call */}
            {(tokenInfo.isThinking || tokenInfo.isGenerating) && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${
                  tokenInfo.isThinking
                    ? isDarkMode ? 'text-violet-400' : 'text-violet-600'
                    : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                }`}>
                  {tokenInfo.liveTokens.toLocaleString()} tok
                </span>
                {tokenInfo.tokensPerSec > 0 && (
                  <span className={`text-[11px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {tokenInfo.tokensPerSec} t/s
                  </span>
                )}
              </div>
            )}

            {/* Separator */}
            {(tokenInfo.isThinking || tokenInfo.isGenerating) && tokenInfo.sessionTotal > 0 && (
              <span className={`text-[10px] ${isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}`}>|</span>
            )}

            {/* Session total */}
            {tokenInfo.sessionTotal > 0 && (
              <span className={`text-[11px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {tokenInfo.sessionTotal.toLocaleString()} total
              </span>
            )}

            {/* Call count */}
            {tokenInfo.callCount > 0 && (
              <span className={`text-[10px] ${isDarkMode ? 'text-zinc-600' : 'text-zinc-300'}`}>
                #{tokenInfo.callCount}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
