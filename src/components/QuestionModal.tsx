import { useState } from 'react';
import type { UserQuestion } from '../types';
import { useSoundEngine } from '../hooks/useSoundEngine';

interface QuestionModalProps {
  question: UserQuestion;
  onAnswer: (answer: string) => void;
  isDarkMode: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C'];

export function QuestionModal({ question, onAnswer, isDarkMode }: QuestionModalProps) {
  const { play } = useSoundEngine();
  const [selected, setSelected] = useState<number | null>(null);
  const [customText, setCustomText] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const handleSelect = (index: number) => {
    play('select');
    setSelected(index);
    setIsCustom(false);
  };

  const handleCustom = () => {
    setSelected(null);
    setIsCustom(true);
  };

  const handleSubmit = () => {
    if (isCustom && customText.trim()) {
      onAnswer(customText.trim());
    } else if (selected !== null && question.options[selected]) {
      onAnswer(question.options[selected]);
    }
  };

  const canSubmit = (isCustom && customText.trim().length > 0) || selected !== null;

  const checkpointLabel = {
    'pre-research': 'Before Research',
    'mid-pipeline': 'Mid-Pipeline',
    'pre-make': 'Before Creative',
  }[question.checkpoint];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className={`pointer-events-auto w-[480px] ${
          isDarkMode
            ? 'bg-[#0a0a0a] border-zinc-800'
            : 'bg-white border-zinc-200'
        } border shadow-2xl`}>

          {/* Header */}
          <div className={`px-6 py-4 border-b ${
            isDarkMode ? 'border-zinc-800' : 'border-zinc-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2 h-2 rounded-full ${
                isDarkMode ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]' : 'bg-amber-500'
              } animate-pulse`} />
              <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                isDarkMode ? 'text-amber-400/70' : 'text-amber-600'
              }`}>
                {checkpointLabel} — Input Needed
              </span>
            </div>
            <h2 className={`font-mono text-sm leading-relaxed ${
              isDarkMode ? 'text-zinc-200' : 'text-zinc-800'
            }`}>
              {question.question}
            </h2>
            {question.context && (
              <p className={`font-mono text-[11px] mt-2 ${
                isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                {question.context}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="px-6 py-4 space-y-2">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                className={`w-full text-left px-4 py-3 border transition-all duration-150 flex items-start gap-3 ${
                  selected === index
                    ? isDarkMode
                      ? 'border-white bg-white/5'
                      : 'border-black bg-black/5'
                    : isDarkMode
                      ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50'
                      : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                }`}
              >
                <span className={`font-mono text-[11px] font-bold mt-0.5 shrink-0 ${
                  selected === index
                    ? isDarkMode ? 'text-white' : 'text-black'
                    : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
                }`}>
                  {OPTION_LETTERS[index]}
                </span>
                <span className={`font-mono text-xs leading-relaxed ${
                  selected === index
                    ? isDarkMode ? 'text-zinc-200' : 'text-zinc-800'
                    : isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {option}
                </span>
              </button>
            ))}

            {/* Custom option */}
            <button
              onClick={handleCustom}
              className={`w-full text-left px-4 py-3 border transition-all duration-150 flex items-start gap-3 ${
                isCustom
                  ? isDarkMode
                    ? 'border-white bg-white/5'
                    : 'border-black bg-black/5'
                  : isDarkMode
                    ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50'
                    : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
              }`}
            >
              <span className={`font-mono text-[11px] font-bold mt-0.5 shrink-0 ${
                isCustom
                  ? isDarkMode ? 'text-white' : 'text-black'
                  : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                D
              </span>
              <span className={`font-mono text-xs ${
                isCustom
                  ? isDarkMode ? 'text-zinc-200' : 'text-zinc-800'
                  : isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                Write your own...
              </span>
            </button>

            {/* Custom text input */}
            {isCustom && (
              <div className="pl-7">
                <textarea
                  value={customText}
                  onChange={(e) => { setCustomText(e.target.value); play('typing'); }}
                  placeholder="Type your direction here..."
                  autoFocus
                  rows={3}
                  className={`w-full px-3 py-2 font-mono text-xs border resize-none transition-colors ${
                    isDarkMode
                      ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-600 focus:border-zinc-500'
                      : 'bg-white border-zinc-300 text-black placeholder-zinc-400 focus:border-zinc-500'
                  } outline-none`}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-6 py-3 border-t ${
            isDarkMode ? 'border-zinc-800' : 'border-zinc-200'
          } flex items-center justify-between`}>
            <span className={`font-mono text-[10px] ${
              isDarkMode ? 'text-zinc-700' : 'text-zinc-400'
            }`}>
              Pipeline paused — waiting for input
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-5 py-1.5 font-mono text-xs uppercase tracking-widest transition-all duration-150 ${
                canSubmit
                  ? isDarkMode
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-black text-white hover:bg-zinc-800'
                  : isDarkMode
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
