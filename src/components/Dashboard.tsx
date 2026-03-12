import { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useTheme } from '../context/ThemeContext';
import { CampaignSelector } from './CampaignSelector';
import { ControlPanel } from './ControlPanel';
import { CycleTimeline } from './CycleTimeline';
import { StagePanel } from './StagePanel';
import { CycleHistory } from './CycleHistory';
import { QuestionModal } from './QuestionModal';
import { DNAIcon } from './BrandHubDrawer';
import { getResearchModelConfig, getResearchLimits, getBrainTemperature, setBrainTemperature, getAllBrainTempDefaults, RESEARCH_PRESETS, applyResearchPreset, getActiveResearchPreset } from '../utils/modelConfig';
import type { ResearchDepthPreset } from '../utils/modelConfig';

import type { StageName, Campaign } from '../types';

interface DashboardProps {
  embedded?: boolean;
}

const STAGES: { name: StageName; label: string; desc: string; icon: string }[] = [
  { name: 'research',    label: 'Research',    desc: 'Market & audience',    icon: 'R' },
  { name: 'brand-dna',   label: 'Brand DNA',   desc: 'Brand identity',      icon: 'D' },
  { name: 'persona-dna', label: 'Persona',     desc: 'Customer personas',   icon: 'P' },
  { name: 'angles',      label: 'Angles',      desc: 'Ad angles',           icon: 'A' },
  { name: 'strategy',    label: 'Strategy',    desc: 'Evaluation',          icon: 'S' },
  { name: 'copywriting', label: 'Copy',        desc: 'Messaging',           icon: 'C' },
  { name: 'production',  label: 'Production',  desc: 'Ad generation',       icon: 'M' },
  { name: 'test',        label: 'Test',        desc: 'Results',             icon: 'T' },
];

export function Dashboard({ embedded = false }: DashboardProps) {
  const { systemStatus, error, currentCycle, cycles, campaign, pendingQuestion, answerQuestion } = useCampaign();
  const { isDarkMode } = useTheme();
  const isRunning = systemStatus === 'running';
  const [selectedStage, setSelectedStage] = useState<StageName | null>(null);

  useEffect(() => {
    if (currentCycle) {
      setSelectedStage(currentCycle.currentStage);
    }
  }, [currentCycle?.currentStage]);

  return (
    <div className={`${embedded ? 'flex-1 overflow-y-auto' : 'min-h-screen'} ${isDarkMode ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      {!embedded && <ControlPanel />}

      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Error banner */}
        {error && (
          <div className={`rounded-xl p-4 mb-5 flex items-start gap-3 ${
            isDarkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
          }`}>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Error</span>
            <span className={`text-xs ${isDarkMode ? 'text-red-300/80' : 'text-red-700'}`}>{error}</span>
          </div>
        )}

        {/* Running indicator */}
        {!error && isRunning && (
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-[11px] font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Pipeline running</span>
          </div>
        )}

        {!campaign ? (
          /* ── No campaign: CampaignSelector takes full width ── */
          <div className="max-w-3xl mx-auto">
            <CampaignSelector />
          </div>
        ) : (
          /* ── Campaign active: sidebar + pipeline ── */
          <div className="grid grid-cols-12 gap-4">
            {/* Left — Campaign info */}
            <div className="col-span-3 space-y-3">
              <CampaignSelector />
              <ResearchSettingsPanel isDark={isDarkMode} />
              <BrandDNAPanel campaign={campaign} isDark={isDarkMode} />
              <CycleHistory cycles={cycles} />

              {/* Stage legend */}
              <div className={`rounded-xl p-3 ${
                isDarkMode
                  ? 'bg-zinc-900 border border-zinc-800/60'
                  : 'bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
              }`}>
                <span className={`text-[10px] uppercase tracking-wider font-semibold block mb-2 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Stages
                </span>
                <div className="space-y-1">
                  {STAGES.map((s) => {
                    const stageData = currentCycle?.stages[s.name];
                    const isActive = stageData?.status === 'in-progress';
                    const isComplete = stageData?.status === 'complete';
                    return (
                      <button
                        key={s.name}
                        onClick={() => {
                          if (currentCycle) setSelectedStage(s.name);
                        }}
                        disabled={!currentCycle}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all ${
                          currentCycle
                            ? isDarkMode
                              ? 'hover:bg-zinc-800/80 cursor-pointer'
                              : 'hover:bg-zinc-50 cursor-pointer'
                            : 'opacity-40 cursor-not-allowed'
                        } ${
                          selectedStage === s.name
                            ? isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'
                            : ''
                        }`}
                      >
                        <span className="text-sm">{s.icon}</span>
                        <div className="flex-1 text-left">
                          <span className={`text-[11px] font-medium ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>{s.label}</span>
                        </div>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        {isComplete && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? '#71717a' : '#a1a1aa'} strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — Active stage */}
            <div className="col-span-9 space-y-3">
              {currentCycle ? (
                <>
                  <CycleTimeline cycle={currentCycle} selectedStage={selectedStage} onSelectStage={setSelectedStage} />
                  <StagePanel cycle={currentCycle} isRunning={isRunning} isDarkMode={isDarkMode} viewStage={selectedStage} />
                </>
              ) : (
                <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${
                  isDarkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white'
                }`}>
                  <p className={`text-sm ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    Press Start to begin the pipeline
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive question modal */}
      {pendingQuestion && (
        <QuestionModal
          question={pendingQuestion}
          onAnswer={answerQuestion}
          isDarkMode={isDarkMode}
        />
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════
// Research Settings Panel — inline model config
// ══════════════════════════════════════════════════════

function ResearchSettingsPanel({ isDark }: { isDark: boolean }) {
  const config = getResearchModelConfig();
  const limits = getResearchLimits();

  // Depth preset
  const [activePreset, setActivePreset] = useState<ResearchDepthPreset | 'custom'>(getActiveResearchPreset());

  // Model role states
  const [models, setModels] = useState({
    orchestrator: config.orchestratorModel,
    researcherSynthesis: config.researcherSynthesisModel,
    compression: config.compressionModel,
    reflection: config.reflectionModel,
    desireLayer: config.desireLayerModel,
    personaSynthesis: config.personaSynthesisModel,
    councilBrain: config.councilBrainModel,
  });
  const [temperature, setTemperature] = useState(config.temperature);
  const [showModelRoles, setShowModelRoles] = useState(false);
  const [showIntensity, setShowIntensity] = useState(false);
  const [showBrainTemps, setShowBrainTemps] = useState(false);

  // Research intensity states
  const [intensity, setIntensity] = useState({
    maxIterations: limits.maxIterations,
    minIterations: limits.minIterations,
    coverageThreshold: limits.coverageThreshold,
    minSources: limits.minSources,
    maxResearchersPerIteration: limits.maxResearchersPerIteration,
    maxTimeMinutes: limits.maxTimeMinutes,
    parallelCompressionCount: limits.parallelCompressionCount,
  });

  // Per-brain temperatures
  const brainDefaults = getAllBrainTempDefaults();
  const brainIds = Object.keys(brainDefaults);
  const [brainTemps, setBrainTemps] = useState<Record<string, number>>(() => {
    const temps: Record<string, number> = {};
    brainIds.forEach(id => { temps[id] = getBrainTemperature(id); });
    return temps;
  });

  const label = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const selectCls = `w-full text-[10px] font-medium rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer ${
    isDark ? 'text-zinc-300 bg-zinc-800 border border-zinc-700' : 'text-zinc-700 bg-zinc-50 border border-zinc-200'
  }`;
  const save = (key: string, val: string) => localStorage.setItem(key, val);

  const modelOptions = [
    { value: 'qwen3.5:9b', label: 'Qwen 3.5 9B' },
    { value: 'qwen3.5:35b', label: 'Qwen 3.5 35B' },
    { value: 'local:qwen3.5:9b', label: 'Qwen 9B Local' },
    { value: 'local:qwen3.5:35b', label: 'Qwen 35B Local' },
    { value: 'gpt-oss:20b', label: 'GPT-OSS 20B' },
    { value: 'lfm2.5-thinking:latest', label: 'LFM 2.5' },
    { value: 'qwen3.5:0.8b', label: 'Qwen 0.8B' },
  ];

  // Model role config: key → localStorage key + display label
  const modelRoles: { id: keyof typeof models; storageKey: string; label: string }[] = [
    { id: 'orchestrator', storageKey: 'research_model', label: 'Orchestrator' },
    { id: 'researcherSynthesis', storageKey: 'researcher_synthesis_model', label: 'Synthesis' },
    { id: 'compression', storageKey: 'compression_model', label: 'Compression' },
    { id: 'reflection', storageKey: 'reflection_model', label: 'Reflection' },
    { id: 'desireLayer', storageKey: 'desire_layer_model', label: 'Desire Analysis' },
    { id: 'personaSynthesis', storageKey: 'persona_synthesis_model', label: 'Persona' },
    { id: 'councilBrain', storageKey: 'council_brain_model', label: 'Council' },
  ];

  // Intensity config: key → localStorage key + display label + min/max
  const intensityFields: { id: keyof typeof intensity; storageKey: string; label: string; min: number; max: number; step: number; isFloat?: boolean }[] = [
    { id: 'maxIterations', storageKey: 'max_research_iterations', label: 'Max Iterations', min: 3, max: 250, step: 1 },
    { id: 'minIterations', storageKey: 'min_research_iterations', label: 'Min Iterations', min: 1, max: 50, step: 1 },
    { id: 'coverageThreshold', storageKey: 'coverage_target', label: 'Coverage Target', min: 0.5, max: 1.0, step: 0.005, isFloat: true },
    { id: 'minSources', storageKey: 'min_research_sources', label: 'Min Sources', min: 5, max: 600, step: 5 },
    { id: 'maxResearchersPerIteration', storageKey: 'max_researchers_per_iteration', label: 'Agents / Iteration', min: 1, max: 10, step: 1 },
    { id: 'maxTimeMinutes', storageKey: 'max_research_time_minutes', label: 'Max Time (min)', min: 5, max: 3000, step: 5 },
    { id: 'parallelCompressionCount', storageKey: 'parallel_compression_count', label: 'Parallel Compress', min: 1, max: 8, step: 1 },
  ];

  const brainNames: Record<string, string> = {
    desire: 'Desire', persuasion: 'Persuasion', offer: 'Offer',
    creative: 'Creative', avatar: 'Avatar', contrarian: 'Contrarian', visual: 'Visual',
  };

  const CollapsibleHeader = ({ open, onToggle, text }: { open: boolean; onToggle: () => void; text: string }) => (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between text-[9px] uppercase tracking-wider font-semibold py-1 ${label}`}
    >
      <span>{text}</span>
      <svg
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className={`transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );

  return (
    <div className={`rounded-xl overflow-hidden ${
      isDark
        ? 'bg-zinc-900 border border-zinc-800/60'
        : 'bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
    }`}>
      <div className={`px-3 py-2.5 flex items-center gap-2 border-b ${isDark ? 'border-zinc-800/60' : 'border-zinc-100'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#a1a1aa' : '#71717a'} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Research Config
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* ── Research Depth Preset Selector ── */}
        <div>
          <div className={`text-[9px] uppercase tracking-wider font-semibold mb-1.5 ${label}`}>Research Depth</div>
          <div className="grid grid-cols-5 gap-1">
            {RESEARCH_PRESETS.map(p => {
              const isActive = activePreset === p.id;
              const colorMap: Record<string, { ring: string; bg: string; text: string; activeBg: string; activeText: string }> = {
                sky:     { ring: 'ring-sky-500/40',     bg: 'bg-sky-500/8',     text: 'text-sky-400',     activeBg: 'bg-sky-500/20',     activeText: 'text-sky-300' },
                emerald: { ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/8', text: 'text-emerald-400', activeBg: 'bg-emerald-500/20', activeText: 'text-emerald-300' },
                violet:  { ring: 'ring-violet-500/40',  bg: 'bg-violet-500/8',  text: 'text-violet-400',  activeBg: 'bg-violet-500/20',  activeText: 'text-violet-300' },
                amber:   { ring: 'ring-amber-500/40',   bg: 'bg-amber-500/8',   text: 'text-amber-400',   activeBg: 'bg-amber-500/20',   activeText: 'text-amber-300' },
                red:     { ring: 'ring-red-500/40',     bg: 'bg-red-500/8',     text: 'text-red-400',     activeBg: 'bg-red-500/20',     activeText: 'text-red-300' },
              };
              const colorMapLight: Record<string, { ring: string; bg: string; text: string; activeBg: string; activeText: string }> = {
                sky:     { ring: 'ring-sky-400/50',     bg: 'bg-sky-50',     text: 'text-sky-600',     activeBg: 'bg-sky-100',     activeText: 'text-sky-700' },
                emerald: { ring: 'ring-emerald-400/50', bg: 'bg-emerald-50', text: 'text-emerald-600', activeBg: 'bg-emerald-100', activeText: 'text-emerald-700' },
                violet:  { ring: 'ring-violet-400/50',  bg: 'bg-violet-50',  text: 'text-violet-600',  activeBg: 'bg-violet-100',  activeText: 'text-violet-700' },
                amber:   { ring: 'ring-amber-400/50',   bg: 'bg-amber-50',   text: 'text-amber-600',   activeBg: 'bg-amber-100',   activeText: 'text-amber-700' },
                red:     { ring: 'ring-red-400/50',     bg: 'bg-red-50',     text: 'text-red-600',     activeBg: 'bg-red-100',     activeText: 'text-red-700' },
              };
              const c = isDark ? (colorMap[p.color] || colorMap.violet) : (colorMapLight[p.color] || colorMapLight.violet);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    applyResearchPreset(p.id);
                    setActivePreset(p.id);
                    // Sync intensity sliders with the new preset values
                    setIntensity({
                      maxIterations: p.limits.maxIterations,
                      minIterations: p.limits.minIterations,
                      coverageThreshold: p.limits.coverageThreshold,
                      minSources: p.limits.minSources,
                      maxResearchersPerIteration: p.limits.maxResearchersPerIteration,
                      maxTimeMinutes: p.limits.maxTimeMinutes,
                      parallelCompressionCount: p.limits.parallelCompressionCount,
                    });
                  }}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-1 transition-all text-center ${
                    isActive
                      ? `${c.activeBg} ${c.activeText} ring-1 ${c.ring}`
                      : `${c.bg} ${c.text} hover:${c.activeBg}`
                  }`}
                  title={`${p.label} — ${p.description}\n${p.time}`}
                >
                  <span className="text-[10px] font-bold leading-none">{p.shortLabel}</span>
                  <span className={`text-[8px] leading-none ${isActive ? '' : 'opacity-60'}`}>{p.time}</span>
                </button>
              );
            })}
          </div>
          {/* Active preset description */}
          {activePreset !== 'custom' && (() => {
            const ap = RESEARCH_PRESETS.find(pr => pr.id === activePreset);
            if (!ap) return null;
            const features = [];
            if (ap.limits.crossValidation) features.push('Cross-Validation');
            if (ap.limits.multiLanguageSearch) features.push('Multi-Language');
            if (ap.limits.historicalAnalysis) features.push('Historical');
            if (ap.limits.communityDeepDive) features.push('Community');
            if (ap.limits.competitorAdScrape) features.push('Ad Scrape');
            if (ap.limits.academicSearch) features.push('Academic');
            return (
              <div className={`mt-1.5 text-[9px] leading-relaxed ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                <span className={`font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{ap.label}:</span>{' '}
                {ap.description}
                {' · '}{ap.limits.maxIterations} iter · {ap.limits.minSources} sources · {(ap.limits.coverageThreshold * 100).toFixed(0)}% target
                {features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {features.map(f => (
                      <span key={f} className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-medium ${
                        isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
                      }`}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Primary model (orchestrator) — always visible */}
        <div>
          <div className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${label}`}>Brain model</div>
          <select
            value={models.orchestrator}
            onChange={(e) => {
              setModels(prev => ({ ...prev, orchestrator: e.target.value }));
              save('research_model', e.target.value);
            }}
            className={selectCls}
          >
            {modelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Compression — always visible */}
        <div>
          <div className={`text-[9px] uppercase tracking-wider font-semibold mb-1 ${label}`}>Compression</div>
          <select
            value={models.compression}
            onChange={(e) => {
              setModels(prev => ({ ...prev, compression: e.target.value }));
              save('compression_model', e.target.value);
            }}
            className={selectCls}
          >
            {modelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Model Roles (collapsible) */}
        <div>
          <CollapsibleHeader open={showModelRoles} onToggle={() => setShowModelRoles(!showModelRoles)} text="Model Roles" />
          {showModelRoles && (
            <div className="space-y-2 mt-1.5">
              {modelRoles
                .filter(r => r.id !== 'orchestrator' && r.id !== 'compression')
                .map(role => (
                  <div key={role.id}>
                    <div className={`text-[9px] mb-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{role.label}</div>
                    <select
                      value={models[role.id]}
                      onChange={(e) => {
                        setModels(prev => ({ ...prev, [role.id]: e.target.value }));
                        save(role.storageKey, e.target.value);
                      }}
                      className={selectCls}
                    >
                      {modelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Research Intensity (collapsible) */}
        <div>
          <CollapsibleHeader open={showIntensity} onToggle={() => setShowIntensity(!showIntensity)} text="Research Intensity" />
          {showIntensity && (
            <div className="space-y-2 mt-1.5">
              {intensityFields.map(field => (
                <div key={field.id}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{field.label}</span>
                    <span className={`text-[9px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {field.isFloat ? (intensity[field.id] as number).toFixed(2) : intensity[field.id]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={intensity[field.id]}
                    onChange={(e) => {
                      const v = field.isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                      setIntensity(prev => ({ ...prev, [field.id]: v }));
                      save(field.storageKey, String(v));
                    }}
                    className="w-full h-0.5 rounded-full appearance-none cursor-pointer accent-violet-400 mt-0.5"
                    style={{ background: isDark ? '#27272a' : '#e4e4e7' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Temperature */}
        <div>
          <div className="flex items-center justify-between">
            <span className={`text-[9px] uppercase tracking-wider font-semibold ${label}`}>Default Temp</span>
            <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{temperature.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => { const v = parseFloat(e.target.value); setTemperature(v); save('research_temperature', String(v)); }}
            className="w-full h-1 rounded-full appearance-none cursor-pointer accent-violet-500 mt-1"
            style={{ background: isDark ? '#27272a' : '#e4e4e7' }}
          />
        </div>

        {/* Per-brain temperatures (collapsible) */}
        <div>
          <CollapsibleHeader open={showBrainTemps} onToggle={() => setShowBrainTemps(!showBrainTemps)} text="Brain Temperatures" />
          {showBrainTemps && (
            <div className="space-y-2 mt-1.5">
              {brainIds.map(id => (
                <div key={id}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{brainNames[id] || id}</span>
                    <span className={`text-[9px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{brainTemps[id]?.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={brainTemps[id] ?? 0.7}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setBrainTemps(prev => ({ ...prev, [id]: v }));
                      setBrainTemperature(id, v);
                    }}
                    className="w-full h-0.5 rounded-full appearance-none cursor-pointer accent-violet-400 mt-0.5"
                    style={{ background: isDark ? '#27272a' : '#e4e4e7' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Brand DNA Panel — expandable sidebar card with full-screen drawer
// ══════════════════════════════════════════════════════

function BrandDNAPanel({ campaign, isDark }: { campaign: Campaign; isDark: boolean }) {
  const p = campaign.presetData;
  const hasBrand = p?.brand?.name || campaign.brand;
  if (!hasBrand) return null;

  const brandName = p?.brand?.name || campaign.brand;

  // Extract hex colors from the colors string
  const colorStr = typeof p?.brand?.colors === 'string' ? p.brand.colors : '';
  const hexColors = colorStr.match(/#[0-9A-Fa-f]{6}/g) || [];

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('nomad-open-brand-hub'))}
      className={`w-full text-left rounded-xl overflow-hidden transition-all hover:scale-[1.01] ${
        isDark
          ? 'bg-zinc-900 border border-zinc-800/60 hover:border-violet-800/40'
          : 'bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-violet-300'
      }`}
    >
      <div className={`px-3 py-2.5 flex items-center gap-2 border-b ${isDark ? 'border-zinc-800/60' : 'border-zinc-100'}`}>
        <DNAIcon size={16} isDark={isDark} />
        <span className={`text-[10px] uppercase tracking-wider font-semibold flex-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Brand DNA
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#71717a' : '#a1a1aa'} strokeWidth="2.5" strokeLinecap="round">
          <path d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      </div>
      <div className="p-3 space-y-1.5">
        <div className={`text-[15px] font-bold tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
          {brandName}
        </div>
        {p?.brand?.positioning && (
          <div className={`text-[10px] leading-relaxed line-clamp-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            {p.brand.positioning}
          </div>
        )}
        {hexColors.length > 0 && (
          <div className="flex gap-1 pt-1">
            {hexColors.slice(0, 6).map((c: string, i: number) => (
              <div key={i} className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: c }} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

