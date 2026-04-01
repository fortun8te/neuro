import { useState, useCallback } from 'react';
import {
  type NeuroMode,
  MODE_PRESETS,
  getCurrentMode,
  setMode,
} from '../utils/modelConfig';

const MODE_ORDER: NeuroMode[] = ['lite', 'pro', 'max'];

const MODE_STYLES: Record<NeuroMode, { accent: string; activeBg: string; activeBorder: string; icon: string }> = {
  lite: {
    accent: 'text-sky-400',
    activeBg: 'bg-sky-500/15',
    activeBorder: 'border-sky-500/50',
    icon: '\u26A1',  // lightning
  },
  pro: {
    accent: 'text-violet-400',
    activeBg: 'bg-violet-500/15',
    activeBorder: 'border-violet-500/50',
    icon: '\u2B22',  // hexagon
  },
  max: {
    accent: 'text-red-400',
    activeBg: 'bg-red-500/15',
    activeBorder: 'border-red-500/50',
    icon: '\u2738',  // heavy eight-pointed star
  },
};

interface ModeSelectorProps {
  /** Called after mode is set -- parent can refresh UI state */
  onChange?: (mode: NeuroMode) => void;
}

export default function ModeSelector({ onChange }: ModeSelectorProps) {
  const [active, setActive] = useState<NeuroMode>(getCurrentMode);

  const handleSelect = useCallback(
    (mode: NeuroMode) => {
      setMode(mode);
      setActive(mode);
      onChange?.(mode);
    },
    [onChange],
  );

  return (
    <div className="flex gap-2 w-full" style={{ fontFamily: "'ABC Diatype Plus', sans-serif" }}>
      {MODE_ORDER.map((mode) => {
        const preset = MODE_PRESETS[mode];
        const style = MODE_STYLES[mode];
        const isActive = mode === active;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleSelect(mode)}
            className={[
              'flex-1 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 focus-visible:ring-violet-500',
              isActive
                ? `${style.activeBg} ${style.activeBorder} border`
                : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-xs ${isActive ? style.accent : 'text-zinc-500'}`}>
                {style.icon}
              </span>
              <span
                className={`text-xs font-semibold tracking-wide uppercase ${
                  isActive ? style.accent : 'text-zinc-400'
                }`}
              >
                {preset.label.replace('NEURO ', '')}
              </span>
              {isActive && (
                <span className={`ml-auto w-1.5 h-1.5 rounded-full ${style.accent.replace('text-', 'bg-')}`} />
              )}
            </div>

            {/* Description */}
            <p className="text-[10px] leading-tight text-zinc-500 line-clamp-1">
              {preset.description}
            </p>

            {/* Model summary */}
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-zinc-600">
              <span>{preset.fastModel.split(':')[1]}</span>
              <span>/</span>
              <span>{preset.capableModel.split(':')[1]}</span>
              <span>/</span>
              <span>{preset.heavyModel.split(':')[1]}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
